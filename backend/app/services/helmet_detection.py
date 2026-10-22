from __future__ import annotations

from typing import Any

from app.schemas.incidents import BoundingBox


def _normalize_label(label: str) -> str:
    """Normalize model labels for reliable matching."""
    return label.strip().lower().replace("_", " ").replace("-", " ")


def _get_box_coordinates(box: Any) -> tuple[float, float, float, float] | None:
    """Extract bounding-box coordinates from a YOLO detection."""
    try:
        coordinates = box.xyxy[0].tolist()

        if len(coordinates) != 4:
            return None

        return tuple(float(value) for value in coordinates)

    except (AttributeError, IndexError, TypeError, ValueError):
        return None


def _get_box_confidence(box: Any) -> float:
    """Extract the confidence score from a YOLO detection."""
    try:
        return float(box.conf[0].item())
    except (AttributeError, IndexError, TypeError, ValueError):
        return 0.0


def _get_class_name(names: Any, class_id: int) -> str:
    """Resolve a class ID to its configured model label."""
    try:
        if isinstance(names, dict):
            return str(names[class_id])

        return str(names[class_id])

    except (KeyError, IndexError, TypeError):
        return str(class_id)


def _intersection_over_union(
    first: tuple[float, float, float, float],
    second: tuple[float, float, float, float],
) -> float:
    """Calculate intersection over union for two bounding boxes."""
    ax1, ay1, ax2, ay2 = first
    bx1, by1, bx2, by2 = second

    intersection_x1 = max(ax1, bx1)
    intersection_y1 = max(ay1, by1)
    intersection_x2 = min(ax2, bx2)
    intersection_y2 = min(ay2, by2)

    intersection_width = max(0.0, intersection_x2 - intersection_x1)
    intersection_height = max(0.0, intersection_y2 - intersection_y1)

    intersection_area = intersection_width * intersection_height

    first_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    second_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)

    union_area = first_area + second_area - intersection_area

    if union_area <= 0:
        return 0.0

    return intersection_area / union_area


def _to_bounding_box(
    coordinates: tuple[float, float, float, float],
) -> BoundingBox:
    """Convert coordinates into the application's BoundingBox schema."""
    x1, y1, x2, y2 = coordinates

    return BoundingBox(
        x1=int(round(x1)),
        y1=int(round(y1)),
        x2=int(round(x2)),
        y2=int(round(y2)),
    )


def detect_missing_helmets(
    model: Any,
    image: Any,
    confidence: float,
    settings: Any,
) -> list[tuple[float, BoundingBox | None]]:
    """
    Detect potential no-helmet incidents.

    The model is queried with a lower confidence threshold so that a weak
    rider detection does not prevent a strong No_Helmet detection from
    being considered.

    Only No_Helmet detections meeting the configured confidence threshold
    are returned.

    If a rider bounding box is available, it is associated with the
    detection. Otherwise, the incident is returned without a rider box
    for subsequent human review.

    Returns:
        A list of (confidence_score, rider_bounding_box) pairs.
        The bounding box is None when no suitable rider was detected.
    """
    if model is None or image is None:
        return []

    try:
        prediction_results = model.predict(
            image,
            conf=min(float(confidence), 0.15),
            verbose=False,
        )
    except Exception:
        return []

    if not prediction_results:
        return []

    result = prediction_results[0]
    boxes = getattr(result, "boxes", None)

    if boxes is None:
        return []

    names = getattr(result, "names", None)

    if names is None:
        names = getattr(model, "names", {})

    rider_labels = {
        _normalize_label(label)
        for label in getattr(
            settings,
            "rider_labels",
            ["Bike_Rider"],
        )
    }

    no_helmet_labels = {
        _normalize_label(label)
        for label in getattr(
            settings,
            "no_helmet_labels",
            ["No_Helmet"],
        )
    }

    motorcycle_labels = {
        _normalize_label(label)
        for label in getattr(
            settings,
            "motorcycle_labels",
            ["Motorcycle", "Motorbike"],
        )
    }

    riders: list[
        tuple[tuple[float, float, float, float], float]
    ] = []

    motorcycles: list[
        tuple[tuple[float, float, float, float], float]
    ] = []

    no_helmet_detections: list[
        tuple[tuple[float, float, float, float], float]
    ] = []

    for box in boxes:
        try:
            class_id = int(box.cls[0].item())
        except (AttributeError, IndexError, TypeError, ValueError):
            continue

        label = _normalize_label(_get_class_name(names, class_id))
        score = _get_box_confidence(box)
        coordinates = _get_box_coordinates(box)

        if coordinates is None:
            continue

        if label in rider_labels:
            riders.append((coordinates, score))

        elif label in motorcycle_labels:
            motorcycles.append((coordinates, score))

        elif label in no_helmet_labels and score >= confidence:
            no_helmet_detections.append((coordinates, score))

    candidates: list[tuple[float, BoundingBox | None]] = []

    for no_helmet_box, no_helmet_score in no_helmet_detections:
        best_rider_box = None
        best_overlap = 0.0

        for rider_box, _rider_score in riders:
            overlap = _intersection_over_union(
                no_helmet_box,
                rider_box,
            )

            if overlap > best_overlap:
                best_overlap = overlap
                best_rider_box = rider_box

        # Prefer a rider whose box overlaps the no-helmet detection.
        if best_rider_box is not None and best_overlap > 0:
            rider_bounding_box = _to_bounding_box(best_rider_box)
        else:
            # Keep the detection for review even if the rider class
            # was not detected in this frame.
            rider_bounding_box = None

        candidates.append((no_helmet_score, rider_bounding_box))

    return candidates