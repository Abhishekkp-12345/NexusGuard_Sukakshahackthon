"""
ForgeShield AI — Layer 1: ELA Engine
======================================
Error Level Analysis (ELA) — detects pixel-level tampering in images.

How ELA works:
  1. Take the original image.
  2. Re-save it at a known JPEG quality (e.g. 75%).
  3. Compute the absolute pixel difference between original and re-saved.
  4. Amplify the difference for visibility.
  5. Tampered regions (re-compressed multiple times) show up as bright areas.
"""

from __future__ import annotations

import base64
import io
import logging
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

# ELA re-compression quality
ELA_QUALITY = 75
# Amplification factor for visualization
ELA_AMPLIFY = 10


def run_ela(image_path: Path) -> dict:
    """
    Run ELA on an image file.

    Returns:
        {
            "tamper_score": float (0–100, higher = more likely tampered),
            "mean_diff": float,
            "max_diff": float,
            "heatmap_b64": str (base64 PNG of ELA heatmap),
            "suspicious_regions": list[str],
        }
    """
    try:
        original = Image.open(image_path).convert("RGB")
    except Exception as e:
        logger.error(f"ELA: cannot open image {image_path}: {e}")
        return _error_result(str(e))

    # Re-save at lower quality into a buffer
    buf = io.BytesIO()
    original.save(buf, format="JPEG", quality=ELA_QUALITY)
    buf.seek(0)
    recompressed = Image.open(buf).convert("RGB")

    # Compute pixel-level absolute difference
    orig_arr = np.array(original, dtype=np.float32)
    recomp_arr = np.array(recompressed, dtype=np.float32)
    diff_arr = np.abs(orig_arr - recomp_arr)

    mean_diff = float(diff_arr.mean())
    max_diff = float(diff_arr.max())

    # Amplify and convert to heatmap
    amplified = np.clip(diff_arr * ELA_AMPLIFY, 0, 255).astype(np.uint8)
    heatmap_img = Image.fromarray(amplified)

    # Apply a colormap-like effect: red channel emphasis
    r, g, b = heatmap_img.split()
    red_emphasis = Image.merge("RGB", (
        ImageEnhance.Brightness(r).enhance(2.0),
        g,
        b,
    ))

    # Encode heatmap as base64 PNG
    out_buf = io.BytesIO()
    red_emphasis.save(out_buf, format="PNG")
    heatmap_b64 = base64.b64encode(out_buf.getvalue()).decode()

    # Score: normalize mean_diff to 0–100
    # Typically clean images have mean_diff < 5, tampered > 15
    tamper_score = min(100.0, (mean_diff / 30.0) * 100.0)

    # Detect suspicious regions (simple quadrant analysis)
    suspicious_regions = _detect_suspicious_quadrants(diff_arr)

    result = {
        "tamper_score": round(tamper_score, 2),
        "mean_diff": round(mean_diff, 4),
        "max_diff": round(max_diff, 4),
        "heatmap_b64": heatmap_b64,
        "suspicious_regions": suspicious_regions,
        "ela_quality_used": ELA_QUALITY,
    }
    logger.info(f"ELA complete — tamper_score={tamper_score:.1f}%  mean_diff={mean_diff:.2f}")
    return result


def _detect_suspicious_quadrants(diff_arr: np.ndarray) -> list[str]:
    """Identify which quadrants of the image have highest ELA values."""
    h, w = diff_arr.shape[:2]
    mid_h, mid_w = h // 2, w // 2
    quadrants = {
        "top-left":     diff_arr[:mid_h, :mid_w],
        "top-right":    diff_arr[:mid_h, mid_w:],
        "bottom-left":  diff_arr[mid_h:, :mid_w],
        "bottom-right": diff_arr[mid_h:, mid_w:],
    }
    threshold = diff_arr.mean() * 2.5
    return [name for name, quad in quadrants.items() if quad.mean() > threshold]


def _error_result(error: str) -> dict:
    return {
        "tamper_score": 0.0,
        "mean_diff": 0.0,
        "max_diff": 0.0,
        "heatmap_b64": "",
        "suspicious_regions": [],
        "error": error,
    }


def ela_authenticity_score(ela_result: dict) -> float:
    """Convert ELA tamper_score to authenticity score (inverted, 0–100)."""
    return round(100.0 - ela_result.get("tamper_score", 0.0), 2)
