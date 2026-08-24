"""
Real image preprocessing for handwritten notes, using OpenCV + Pillow.

Pipeline: grayscale -> denoise -> contrast enhancement (CLAHE) ->
deskew (via minAreaRect on text contours) -> resize if too large/small.

This runs before OCR to improve recognition quality on photographed
handwritten pages (uneven lighting, slight rotation, noise from phone
cameras, etc).
"""
import cv2
import numpy as np


MAX_DIM = 2200
MIN_DIM = 900


def _deskew(gray: np.ndarray) -> np.ndarray:
    # Binarize to find text mass, then find the minimum-area rotated
    # rectangle around non-background pixels to estimate skew angle.
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 50:
        return gray  # not enough signal to safely estimate skew

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Ignore near-zero corrections and wild outliers (likely mis-detection)
    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray

    (h, w) = gray.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    return rotated


def _resize_if_needed(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    longest = max(h, w)
    shortest = min(h, w)

    if longest > MAX_DIM:
        scale = MAX_DIM / longest
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    elif shortest < MIN_DIM:
        scale = MIN_DIM / shortest
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    return img


def preprocess_image(input_path: str, output_path: str) -> None:
    """
    Reads an image from input_path, applies denoise/contrast/deskew,
    and writes a cleaned-up version to output_path. Raises on unreadable
    files so the caller can surface a clear error to the user.
    """
    img = cv2.imread(input_path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not read image file — it may be corrupted or an unsupported format.")

    img = _resize_if_needed(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Denoise (handles phone-camera grain / paper texture)
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # CLAHE contrast enhancement — brings faint pencil/pen strokes forward
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    contrasted = clahe.apply(denoised)

    deskewed = _deskew(contrasted)

    # Mild sharpening to counter the blur introduced by denoising
    blur = cv2.GaussianBlur(deskewed, (0, 0), sigmaX=3)
    sharpened = cv2.addWeighted(deskewed, 1.5, blur, -0.5, 0)

    cv2.imwrite(output_path, sharpened)
