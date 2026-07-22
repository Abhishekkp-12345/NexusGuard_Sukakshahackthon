"""
ForgeShield AI — Layer 1.5: Face Verification Engine (Production)
=================================================================
Offline face detection and multi-method similarity comparison on identity docs.

Methods used (no deep learning model required — all OpenCV-only):
  1. ORB Keypoint descriptor matching — structural comparison
  2. SSIM (Structural Similarity Index) — pixel-level structural match
  3. Haar Cascade face detection — locate face region in document

Combined score: 0.55 * ORB_score + 0.45 * SSIM_score

Interpretation:
  >= 70%  → Likely same person
  50-69%  → Uncertain, flag for manual review
  <  50%  → FACE_MISMATCH — likely different people

Why NOT HSV histogram correlation (old method):
  - Two people with similar skin tones and lighting score very high
  - Does not capture facial structure, only color distribution
  - Has been replaced by structural ORB + SSIM which compare actual shape
"""

from __future__ import annotations

import base64
import cv2
import io
import logging
from pathlib import Path
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ── Face Detection Setup ──────────────────────────────────────────────
face_cascade = None
_FACE_DETECTION_AVAILABLE = False

try:
    if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data"):
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _cascade = cv2.CascadeClassifier(cascade_path)
        if not _cascade.empty():
            face_cascade = _cascade
            _FACE_DETECTION_AVAILABLE = True
            logger.info("Haar Cascade face detector loaded.")
        else:
            logger.warning("Haar Cascade XML is empty — face detection unavailable.")
    else:
        logger.warning(
            "CascadeClassifier not available in this OpenCV build (headless/v5+). "
            "Face detection will be skipped; ORB+SSIM comparison still available."
        )
except Exception as e:
    logger.warning(f"Face detection init failed: {e}")


# ── Face similarity thresholds ────────────────────────────────────────
FACE_MATCH_THRESHOLD = 70.0    # >= this → MATCH
FACE_UNCERTAIN_THRESHOLD = 50.0  # >= this → UNCERTAIN (manual review)
# < FACE_UNCERTAIN_THRESHOLD → MISMATCH


def detect_and_crop_face(image_path: Path) -> tuple[np.ndarray | None, str | None]:
    """
    Detect the applicant's face photo in an identity document.

    Returns:
        tuple (cropped_face_cv2_image, face_base64_png)
        Returns (None, None) if no face found or cascade not available.
    """
    if not _FACE_DETECTION_AVAILABLE or face_cascade is None or not image_path.exists():
        return None, None

    try:
        img = cv2.imread(str(image_path))
        if img is None:
            return None, None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Try different scale factors and neighbor thresholds for robustness
        faces = None
        for scale, neighbors in [(1.1, 5), (1.05, 4), (1.15, 3)]:
            detected = face_cascade.detectMultiScale(
                gray,
                scaleFactor=scale,
                minNeighbors=neighbors,
                minSize=(50, 50),
            )
            if len(detected) > 0:
                faces = detected
                break

        if faces is None or len(faces) == 0:
            return None, None

        # Extract the largest detected face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

        # Add a small padding around the face region
        pad = int(w * 0.15)
        h_img, w_img = img.shape[:2]
        y1 = max(0, y - pad)
        y2 = min(h_img, y + h + pad)
        x1 = max(0, x - pad)
        x2 = min(w_img, x + w + pad)

        cropped = img[y1:y2, x1:x2]

        # Convert to base64 PNG
        _, encoded = cv2.imencode(".png", cropped)
        b64_str = base64.b64encode(encoded.tobytes()).decode("utf-8")

        return cropped, b64_str

    except Exception as e:
        logger.warning(f"Face detection failed on {image_path.name}: {e}")
        return None, None


def calculate_face_similarity(
    face1: np.ndarray,
    face2: np.ndarray,
) -> dict:
    """
    Compare two cropped face images using ORB keypoint matching + SSIM.

    Returns:
        {
            "similarity": float (0-100),
            "orb_score": float,
            "ssim_score": float,
            "verdict": "MATCH" | "UNCERTAIN" | "MISMATCH",
            "detail": str,
        }
    """
    if face1 is None or face2 is None:
        return _face_result(0.0, 0.0, 0.0, "MISMATCH", "One or both face images unavailable.")

    try:
        # Standardize dimensions
        target_size = (128, 128)
        f1_resized = cv2.resize(face1, target_size)
        f2_resized = cv2.resize(face2, target_size)

        g1 = cv2.cvtColor(f1_resized, cv2.COLOR_BGR2GRAY)
        g2 = cv2.cvtColor(f2_resized, cv2.COLOR_BGR2GRAY)

        # ── Method 1: ORB Keypoint Matching ──────────────────────────
        orb_score = _compute_orb_score(g1, g2)

        # ── Method 2: SSIM ───────────────────────────────────────────
        ssim_score = _compute_ssim(g1, g2)

        # ── Combined Score ────────────────────────────────────────────
        combined = 0.55 * orb_score + 0.45 * ssim_score
        combined = round(min(100.0, max(0.0, combined)), 2)

        # ── Verdict ───────────────────────────────────────────────────
        if combined >= FACE_MATCH_THRESHOLD:
            verdict = "MATCH"
            detail = f"Face similarity {combined:.1f}% — likely the same person."
        elif combined >= FACE_UNCERTAIN_THRESHOLD:
            verdict = "UNCERTAIN"
            detail = (
                f"Face similarity {combined:.1f}% — inconclusive. "
                f"Manual visual review recommended."
            )
        else:
            verdict = "MISMATCH"
            detail = (
                f"Face similarity {combined:.1f}% is below threshold {FACE_UNCERTAIN_THRESHOLD:.0f}%. "
                f"Faces appear to belong to different individuals."
            )

        return _face_result(combined, orb_score, ssim_score, verdict, detail)

    except Exception as e:
        logger.warning(f"Face comparison failed: {e}")
        return _face_result(0.0, 0.0, 0.0, "MISMATCH", f"Face comparison error: {str(e)}")


def compare_faces_across_docs(
    identity_doc_paths: list[tuple[str, Path]],  # (doc_label, image_path)
) -> dict:
    """
    Detect and compare faces across multiple identity documents.

    Args:
        identity_doc_paths: list of (label, path) tuples for docs with photos

    Returns:
        {
            "face_detected_count": int,
            "comparisons": list[dict],
            "overall_face_verdict": "MATCH" | "UNCERTAIN" | "MISMATCH" | "NOT_DETECTED",
            "face_penalty": float,
            "findings": list[dict],
            "faces_b64": dict[label → base64 str],
        }
    """
    faces_found: dict[str, np.ndarray] = {}
    faces_b64: dict[str, str] = {}
    comparisons: list[dict] = []
    findings: list[dict] = []
    face_penalty = 0.0

    # ── Detect faces in each document ────────────────────────────────
    for label, img_path in identity_doc_paths:
        face_arr, face_b64 = detect_and_crop_face(img_path)
        if face_arr is not None:
            faces_found[label] = face_arr
            if face_b64:
                faces_b64[label] = face_b64
        else:
            findings.append({
                "type": "FACE_NOT_DETECTED",
                "severity": "MEDIUM",
                "detail": (
                    f"No face detected in '{label}'. "
                    f"The document may be blurry, low-quality, or not contain a photograph."
                ),
            })

    face_detected_count = len(faces_found)

    # ── Compare pairs ─────────────────────────────────────────────────
    labels = list(faces_found.keys())
    overall_verdicts: list[str] = []

    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            lbl_a = labels[i]
            lbl_b = labels[j]
            result = calculate_face_similarity(faces_found[lbl_a], faces_found[lbl_b])

            comparisons.append({
                "docA": lbl_a,
                "docB": lbl_b,
                **result,
            })

            overall_verdicts.append(result["verdict"])

            if result["verdict"] == "MISMATCH":
                face_penalty += 30.0
                findings.append({
                    "type": "FACE_MISMATCH",
                    "severity": "HIGH",
                    "detail": (
                        f"❌ Face in '{lbl_a}' does not match face in '{lbl_b}'. "
                        f"{result['detail']}"
                    ),
                    "penalty": 30,
                })
            elif result["verdict"] == "UNCERTAIN":
                face_penalty += 10.0
                findings.append({
                    "type": "FACE_UNCERTAIN",
                    "severity": "MEDIUM",
                    "detail": (
                        f"⚠️ Face comparison between '{lbl_a}' and '{lbl_b}' is inconclusive. "
                        f"{result['detail']}"
                    ),
                    "penalty": 10,
                })

    # ── Overall verdict ───────────────────────────────────────────────
    if face_detected_count == 0:
        overall_verdict = "NOT_DETECTED"
    elif "MISMATCH" in overall_verdicts:
        overall_verdict = "MISMATCH"
    elif "UNCERTAIN" in overall_verdicts:
        overall_verdict = "UNCERTAIN"
    elif overall_verdicts:
        overall_verdict = "MATCH"
    else:
        overall_verdict = "NOT_DETECTED"

    return {
        "face_detected_count": face_detected_count,
        "comparisons": comparisons,
        "overall_face_verdict": overall_verdict,
        "face_penalty": min(face_penalty, 30.0),  # cap at 30
        "findings": findings,
        "faces_b64": faces_b64,
    }


# ── Internal Methods ──────────────────────────────────────────────────

def _compute_orb_score(g1: np.ndarray, g2: np.ndarray) -> float:
    """
    ORB keypoint descriptor matching score.
    Returns percentage (0-100) of good matches relative to keypoints found.
    """
    try:
        orb = cv2.ORB_create(nfeatures=300)
        kp1, des1 = orb.detectAndCompute(g1, None)
        kp2, des2 = orb.detectAndCompute(g2, None)

        if des1 is None or des2 is None or len(des1) < 5 or len(des2) < 5:
            return 0.0

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        matches = bf.knnMatch(des1, des2, k=2)

        # Ratio test (Lowe's ratio test)
        good_matches = []
        for pair in matches:
            if len(pair) == 2:
                m, n = pair
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)

        total_kp = max(len(kp1), len(kp2))
        if total_kp == 0:
            return 0.0

        # Normalize: good matches as % of total keypoints (cap at 100)
        score = (len(good_matches) / total_kp) * 100.0 * 3.0  # scale factor
        return min(100.0, score)

    except Exception as e:
        logger.debug(f"ORB score computation failed: {e}")
        return 0.0


def _compute_ssim(g1: np.ndarray, g2: np.ndarray) -> float:
    """
    Simplified SSIM (Structural Similarity Index) without scikit-image.
    Returns 0-100.
    """
    try:
        # Compute means
        mu1 = g1.mean()
        mu2 = g2.mean()

        # Compute variances and covariance
        sigma1_sq = g1.var()
        sigma2_sq = g2.var()
        sigma12 = float(np.cov(g1.flatten(), g2.flatten())[0][1])

        # SSIM constants
        C1 = (0.01 * 255) ** 2
        C2 = (0.03 * 255) ** 2

        numerator = (2 * mu1 * mu2 + C1) * (2 * sigma12 + C2)
        denominator = (mu1**2 + mu2**2 + C1) * (sigma1_sq + sigma2_sq + C2)

        ssim_val = numerator / denominator if denominator != 0 else 0.0
        # Map from [-1, 1] to [0, 100]
        return max(0.0, min(100.0, (ssim_val + 1.0) / 2.0 * 100.0))

    except Exception as e:
        logger.debug(f"SSIM computation failed: {e}")
        return 0.0


def _face_result(
    similarity: float,
    orb_score: float,
    ssim_score: float,
    verdict: str,
    detail: str,
) -> dict:
    return {
        "similarity": similarity,
        "orb_score": round(orb_score, 2),
        "ssim_score": round(ssim_score, 2),
        "verdict": verdict,
        "detail": detail,
    }
