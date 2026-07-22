# Implementation Plan — Production-Level Document Forensics

We will implement a production-grade forensics suite in ForgeShield. This plan details the deterministic checkers for advanced tampering, face similarity matching, OCR enhancements, and real-time visualization of tampered regions (with red bounding boxes) and face verification in the UI.

## User Review Required

> [!IMPORTANT]
> **Haar Cascade Offline Classifier**
> OpenCV's built-in frontal face Haar Cascade (`cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'`) will be used for offline, CPU-based face detection on ID cards.
> 
> **Tamper Bounding Box Generation**
> Suspicious pixel differentials in the ELA difference image will be grouped into clusters using morphological dilation and erosion. Rectangular coordinates of these clusters will be highlighted in red directly on the original document image.

## Proposed Changes

We will introduce two new forensic layers (`face_verifier.py` and `tamper_detector.py`) and update existing processors to aggregate findings and render them in the UI.

---

### Backend Components

#### [NEW] [face_verifier.py](file:///e:/Canara%20Hack/ForgeShield/backend/forensics/face_verifier.py)
- Implement face detection using OpenCV's Haar Cascade.
- Implement face comparison using HSV color histogram correlation (highly robust to card lamination reflections and document scan lighting variations).
- If similarity is below `65%`, report `FACE_MISMATCH` with severity `HIGH`.

#### [NEW] [tamper_detector.py](file:///e:/Canara%20Hack/ForgeShield/backend/forensics/tamper_detector.py)
- **JPEG Artifact Analysis**: Scan for double-compression signatures.
- **Noise Inconsistency Analysis**: Block-wise standard deviation comparison to identify pasted content.
- **Copy-Move/Clone Detection**: Map ORB feature descriptors to detect duplicated patches within the same image.
- **Text Alignment Anomaly**: Evaluate the baseline vertical offset of characters in OCR line blocks.
- **OCR vs Digital Layer Verification**: Highlight hidden/altered text if PDF digital text differs from the OCR result (Jaccard similarity threshold `0.85`).
- **Bounding Box Highlights**: Contour clusters on the ELA differential will be outlined with a red rectangle (`#EF4444`) on a visualization image.

#### [MODIFY] [ocr_extractor.py](file:///e:/Canara%20Hack/ForgeShield/backend/forensics/ocr_extractor.py)
- Extend Father's Name extraction to Aadhaar Card and Driving License using C/O and S/O regex patterns.
- Propagate low-confidence word status as warnings.

#### [MODIFY] [semantic_checker.py](file:///e:/Canara%20Hack/ForgeShield/backend/forensics/semantic_checker.py)
- Include **Father's Name** and **Face Similarity** in the deterministic cross-document validation engine.
- Penalize name mismatch (-40), Aadhaar mismatch (-50), DOB mismatch (-30), and low confidence (-15).

#### [MODIFY] [risk_scorer.py](file:///e:/Canara%20Hack/ForgeShield/backend/ai_engine/risk_scorer.py)
- Reduce overall safety score by `-40` if any edited region (tampering) is detected.
- Cap overall score at `< 30.0` and force a `REJECT` verdict if any critical identity mismatch or tampering is verified.

#### [MODIFY] [forensics.py](file:///e:/Canara%20Hack/ForgeShield/backend/routers/forensics.py)
- Run `face_verifier` and `tamper_detector` inside the analysis pipeline.
- Return `tamper_visualization` (base64) and `face_verification` data in each document report.

---

### Frontend Components

#### [MODIFY] [DocumentIntegrityViewer.tsx](file:///e:/Canara%20Hack/ForgeShield/frontend/src/components/DocumentIntegrityViewer.tsx)
- Render the actual ELA difference image or highlighted red bounding box visualization (`tamper_visualization`) when available.
- Replace the static mock checklist with the real backend findings and anomalies list.
- Display a face verification card showing cropped face thumbnails and comparison scores.

---

## Verification Plan

### Automated Tests
- Run `test_verification_pipeline.py` with added test cases:
  - Face similarity mismatch.
  - Image tampering and bounding box contour generation.
  - OCR line alignment anomaly.
  
### Manual Verification
- Deploy backend and upload:
  - Mismatched documents (confirming `REJECT` and `< 30%` score).
  - Suspected tampered bank statements (confirming red boxes highlight the modified areas).
