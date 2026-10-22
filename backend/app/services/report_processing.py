"""Full-video analysis worker for the PARA AI analysis workflow."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
from time import monotonic
from typing import Any

import numpy as np
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.adapters.license_plate_detector import OpenCVPlateDetector
from app.adapters.paddle_ocr import PaddleOCRAdapter
from app.core.config import Settings, get_settings
from app.core.database import SessionLocal
from app.models.report import Incident, Report
from app.schemas.incidents import BoundingBox
from app.services.frame_sampling import FrameSampler
from app.services.license_plate_recognition import (
    LicensePlateRecognitionService,
)
from app.services.video_reader import VideoOpenError, VideoReader

logger = logging.getLogger(__name__)
_models: dict[str, Any] = {}


class ModelLoadError(RuntimeError):
    """Raised when a configured model cannot be loaded."""


def _normalize_label(label: str) -> str:
    """Normalize class labels for reliable matching."""
    return label.strip().lower().replace("_", " ").replace("-", " ")


def _configured_labels(labels: Any) -> set[str]:
    """Normalize configured labels."""
    return {_normalize_label(str(label)) for label in labels}


def _model(name: str, path: str) -> Any:
    """Load and cache a YOLO model."""
    if name in _models:
        return _models[name]

    source = Path(path)
    if not source.is_file() and not path.startswith(
        ("http://", "https://")
    ):
        raise ModelLoadError(
            f"{name} weights are missing at {path}. See README model setup."
        )

    try:
        from ultralytics import YOLO

        _models[name] = YOLO(path)
        logger.info("%s model loaded from %s", name, path)
        return _models[name]
    except Exception as exc:
        raise ModelLoadError(
            f"Unable to load {name} model: {exc}"
        ) from exc


def _optional_model(
    name: str,
    path: str,
    warnings: list[str],
) -> Any | None:
    """Load an optional model, allowing configured demo mode to continue."""
    try:
        return _model(name, path)
    except ModelLoadError as exc:
        if not settings.demo_inference:
            raise

        message = str(exc)
        warnings.append(message)
        logger.warning(
            "%s; continuing in demo mode without this detector",
            message,
        )
        return None


def _boxes(
    model: Any,
    image: np.ndarray,
    confidence: float,
) -> list[tuple[str, float, BoundingBox]]:
    """Normalize model detections into labels, scores, and bounding boxes."""
    result = model.predict(
        image,
        conf=confidence,
        verbose=False,
    )

    if not result:
        return []

    names = result[0].names
    normalized: list[tuple[str, float, BoundingBox]] = []

    for box in result[0].boxes or []:
        try:
            class_id = int(float(box.cls.item()))

            if isinstance(names, dict):
                label = str(names.get(class_id, class_id))
            else:
                label = str(names[class_id])

            x1, y1, x2, y2 = (
                float(value) for value in box.xyxy[0].tolist()
            )
            score = float(box.conf.item())
        except (
            AttributeError,
            IndexError,
            TypeError,
            ValueError,
        ):
            logger.debug(
                "Skipping an invalid model detection",
                exc_info=True,
            )
            continue

        if x2 > x1 and y2 > y1:
            normalized.append(
                (
                    _normalize_label(label),
                    score,
                    BoundingBox(
                        left=x1,
                        top=y1,
                        right=x2,
                        bottom=y2,
                    ),
                )
            )

    return normalized


def _overlaps(
    first: BoundingBox,
    second: BoundingBox,
) -> bool:
    """Return whether two bounding boxes intersect."""
    return (
        min(first.right, second.right)
        > max(first.left, second.left)
        and min(first.bottom, second.bottom)
        > max(first.top, second.top)
    )


def _intersection_over_union(
    first: BoundingBox,
    second: BoundingBox,
) -> float:
    """Calculate intersection over union for two bounding boxes."""
    left = max(first.left, second.left)
    top = max(first.top, second.top)
    right = min(first.right, second.right)
    bottom = min(first.bottom, second.bottom)

    intersection = max(0.0, right - left) * max(
        0.0,
        bottom - top,
    )

    first_area = max(0.0, first.right - first.left) * max(
        0.0,
        first.bottom - first.top,
    )
    second_area = max(0.0, second.right - second.left) * max(
        0.0,
        second.bottom - second.top,
    )

    union = first_area + second_area - intersection
    return intersection / union if union > 0 else 0.0


def _associate_rider(
    helmet_box: BoundingBox,
    riders: list[tuple[float, BoundingBox]],
) -> BoundingBox | None:
    """Associate a no-helmet detection with its most plausible rider.

    First prefer a rider box that overlaps the detection. If the two boxes
    narrowly miss each other, consider a nearby rider whose box is
    geometrically close to the detected head region.
    """
    if not riders:
        return None

    helmet_center_x = (helmet_box.left + helmet_box.right) / 2
    helmet_center_y = (helmet_box.top + helmet_box.bottom) / 2
    helmet_width = max(1.0, helmet_box.right - helmet_box.left)
    helmet_height = max(1.0, helmet_box.bottom - helmet_box.top)

    best_rider: BoundingBox | None = None
    best_score = -1.0

    for rider_confidence, rider_box in riders:
        rider_width = max(1.0, rider_box.right - rider_box.left)
        rider_height = max(1.0, rider_box.bottom - rider_box.top)

        center_inside = (
            rider_box.left - helmet_width * 0.15
            <= helmet_center_x
            <= rider_box.right + helmet_width * 0.15
            and rider_box.top - helmet_height * 0.15
            <= helmet_center_y
            <= rider_box.bottom + helmet_height * 0.15
        )

        overlap = _intersection_over_union(helmet_box, rider_box)

        dx = (
            helmet_center_x
            - (rider_box.left + rider_box.right) / 2
        ) / rider_width

        dy = (
            helmet_center_y
            - (rider_box.top + rider_box.bottom) / 2
        ) / rider_height

        normalized_distance = (dx * dx + dy * dy) ** 0.5

        # Require overlap or a plausible geometric relationship.
        if not _overlaps(helmet_box, rider_box) and not (
            center_inside and normalized_distance <= 0.8
        ):
            continue

        association_score = (
            overlap * 2.0
            + (0.5 if center_inside else 0.0)
            + rider_confidence * 0.1
            - normalized_distance * 0.05
        )

        if association_score > best_score:
            best_score = association_score
            best_rider = rider_box

    return best_rider


def _plate_search_region(
    associated_box: BoundingBox,
    image: np.ndarray,
) -> BoundingBox | None:
    """Build a bounded search region below and around an associated rider.

    This is a heuristic search region, NOT a detected motorcycle bounding
    box. It allows the plate detector to inspect nearby lower-frame content
    without searching the entire image.
    """
    if image.ndim < 2:
        return None

    image_height, image_width = image.shape[:2]

    box_width = associated_box.right - associated_box.left
    box_height = associated_box.bottom - associated_box.top

    if box_width <= 0 or box_height <= 0:
        return None

    center_x = (associated_box.left + associated_box.right) / 2

    # Include some surrounding width and the lower part of the rider.
    half_width = box_width * 0.9
    left = max(0.0, center_x - half_width)
    right = min(float(image_width), center_x + half_width)

    top = max(
        0.0,
        associated_box.top + box_height * 0.35,
    )
    bottom = min(
        float(image_height),
        associated_box.bottom + box_height * 0.65,
    )

    if right <= left or bottom <= top:
        return None

    return BoundingBox(
        left=left,
        top=top,
        right=right,
        bottom=bottom,
    )


def _traffic_candidates(
    model: Any,
    image: np.ndarray,
    confidence: float,
    settings: Settings,
) -> list[tuple[float, BoundingBox | None]]:
    """Find missing-helmet detections and associate rider boxes.

    The helmet model does not have a motorcycle class. Therefore, its rider
    box is returned as an association candidate; it must not be represented
    as a confirmed motorcycle detection.
    """
    detections = _boxes(
        model,
        image,
        min(confidence, 0.15),
    )

    rider_labels = _configured_labels(settings.rider_labels)
    no_helmet_labels = _configured_labels(settings.no_helmet_labels)

    riders = [
        (score, box)
        for label, score, box in detections
        if label in rider_labels
    ]

    missing_helmets = [
        (score, box)
        for label, score, box in detections
        if label in no_helmet_labels and score >= confidence
    ]

    candidates: list[tuple[float, BoundingBox | None]] = []

    for score, helmet_box in missing_helmets:
        rider_box = _associate_rider(helmet_box, riders)

        if rider_box is None:
            logger.warning(
                "No rider could be associated with a no-helmet detection; "
                "retaining incident for human review without OCR"
            )

        candidates.append((score, rider_box))

    return candidates


def _pothole_candidates(
    model: Any,
    image: np.ndarray,
    confidence: float,
) -> list[tuple[float, BoundingBox]]:
    """Return detections matching the supported pothole class."""
    return [
        (score, box)
        for label, score, box in _boxes(model, image, confidence)
        if label in {"pothole", "0"}
    ]


def _save_evidence(
    image: np.ndarray,
    report_id: str,
    frame_number: int,
) -> str | None:
    """Save the selected evidence frame."""
    target = (
        Path(get_settings().evidence_path)
        / f"{report_id}-{frame_number}.jpg"
    )

    try:
        import cv2

        target.parent.mkdir(parents=True, exist_ok=True)

        return (
            f"evidence/{target.name}"
            if cv2.imwrite(str(target), image)
            else None
        )
    except Exception:
        logger.warning(
            "Evidence frame could not be written",
            exc_info=True,
        )
        return None


def _set_progress(
    report: Report,
    *,
    read: int,
    stage: str,
    percent: float,
    timestamp: float = 0.0,
) -> None:
    """Update processing progress in the report summary."""
    summary = dict(report.summary_json or {})
    summary["progress"] = {
        "frames_read": read,
        "current_timestamp": round(timestamp, 3),
        "percent_complete": round(
            min(100.0, max(0.0, percent)),
            2,
        ),
        "current_stage": stage,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    report.summary_json = summary


def _incident_box(incident: Incident) -> BoundingBox | None:
    """Return the stored associated box when it is valid."""
    values = incident.bounding_box
    if not isinstance(values, list) or len(values) != 4:
        return None
    try:
        return BoundingBox(
            left=float(values[0]),
            top=float(values[1]),
            right=float(values[2]),
            bottom=float(values[3]),
        )
    except (TypeError, ValueError):
        return None


def _matches_recent_incident(
    previous: Incident,
    timestamp: float,
    bounding_box: BoundingBox | None,
) -> bool:
    """Match one object across nearby frames without merging neighbors."""
    if timestamp - previous.timestamp > settings.incident_deduplication_seconds:
        return False

    previous_box = _incident_box(previous)
    if previous_box is None or bounding_box is None:
        return previous_box is None and bounding_box is None

    return _intersection_over_union(previous_box, bounding_box) >= settings.pothole_event_iou


def _recognize_plate(
    image: np.ndarray,
    associated_box: BoundingBox,
    report_id: str,
) -> tuple[str, float, bool]:
    """Attempt OCR inside a heuristic plate-search region.

    Returns (plate_text, OCR_confidence, search_region_used).
    """
    region = _plate_search_region(associated_box, image)

    if region is None:
        logger.info(
            "Plate recognition skipped for report %s: "
            "unable to construct a valid search region",
            report_id,
        )
        return settings.unknown_label, 0.0, False

    logger.info(
        "Attempting plate recognition for report %s using a "
        "heuristic search region (not a confirmed motorcycle box)",
        report_id,
    )

    try:
        recognition = LicensePlateRecognitionService(
            OpenCVPlateDetector(),
            PaddleOCRAdapter(),
        ).recognize(
            image,
            helmet_violation=True,
            motorcycle_bounding_box=region,
        )

        plate = recognition.license_plate
        ocr_confidence = float(recognition.ocr_confidence)

        if not plate or plate == settings.unknown_label:
            logger.info(
                "Plate recognition returned UNKNOWN for report %s",
                report_id,
            )
            return settings.unknown_label, ocr_confidence, True

        logger.info(
            "Plate recognition returned a candidate for report %s "
            "with OCR confidence %.3f",
            report_id,
            ocr_confidence,
        )
        return plate, ocr_confidence, True

    except Exception:
        logger.warning(
            "Plate recognition failed for report %s",
            report_id,
            exc_info=True,
        )
        return settings.unknown_label, 0.0, True


def _record(
    database: Session,
    report: Report,
    recent: dict[str, list[Incident]],
    *,
    kind: str,
    title: str,
    timestamp: float,
    frame_number: int,
    confidence: float,
    image: np.ndarray,
    motorcycle: BoundingBox | None = None,
) -> None:
    """Save an incident and update evidence when a better detection appears."""
    candidates = recent.setdefault(kind, [])
    previous = next(
        (
            item
            for item in reversed(candidates)
            if _matches_recent_incident(item, timestamp, motorcycle)
        ),
        None,
    )

    if previous is not None:
        if confidence <= previous.confidence:
            return

        previous.timestamp = timestamp
        previous.frame_number = frame_number
        previous.confidence = confidence
        previous.evidence_path = _save_evidence(
            image,
            report.id,
            frame_number,
        )

        if motorcycle is not None:
            previous.bounding_box = [
                motorcycle.left,
                motorcycle.top,
                motorcycle.right,
                motorcycle.bottom,
            ]

        return

    plate = settings.unknown_label
    ocr_confidence = 0.0
    ocr_attempted = False
    search_region_available = False

    if kind == "HELMET_VIOLATION" and motorcycle is not None:
        plate, ocr_confidence, search_region_available = (
            _recognize_plate(
                image,
                motorcycle,
                report.id,
            )
        )
        ocr_attempted = search_region_available

    incident = Incident(
        report_id=report.id,
        type=kind,
        title=title,
        timestamp=timestamp,
        frame_number=frame_number,
        confidence=confidence,
        license_plate=plate,
        ocr_confidence=ocr_confidence,
        evidence_path=_save_evidence(
            image,
            report.id,
            frame_number,
        ),
        # This is the associated detection box, not a confirmed vehicle box.
        bounding_box=(
            [
                motorcycle.left,
                motorcycle.top,
                motorcycle.right,
                motorcycle.bottom,
            ]
            if motorcycle is not None
            else None
        ),
        severity="HIGH" if confidence >= 0.8 else "MEDIUM",
        reward_credits=150 if kind == "HELMET_VIOLATION" else 80,
        details={
            "ocr_attempted": ocr_attempted,
            "source": "approved_model",
            "vehicle_box_available": False,
            "associated_rider_box_available": motorcycle is not None,
            "plate_search_region_available": search_region_available,
            "plate_search_region_type": (
                "heuristic_rider_region"
                if search_region_available
                else None
            ),
        },
    )

    database.add(incident)
    database.flush()
    candidates.append(incident)


settings = get_settings()


def process_report(report_id: str) -> None:
    """Run traffic, road, OCR, and incident generation for a stored video."""
    database: Session = SessionLocal()
    started = monotonic()

    try:
        report = database.get(Report, report_id)
        if report is None:
            logger.warning(
                "Analysis requested for missing report %s",
                report_id,
            )
            return

        # Re-analysis replaces this report's previous detections.
        database.execute(
            delete(Incident).where(Incident.report_id == report.id)
        )

        model_warnings: list[str] = []

        traffic_model = _optional_model(
            "Bike-Helmet-Detectionv2",
            settings.bike_helmet_model_path,
            model_warnings,
        )

        pothole_model = _optional_model(
            "PeterHdd/pothole-detection-yolo",
            settings.model_path,
            model_warnings,
        )

        traffic_sampler = FrameSampler(settings.traffic_fps)
        road_sampler = FrameSampler(settings.road_fps)
        traffic_next = 0.0
        road_next = 0.0
        recent: dict[str, list[Incident]] = {}

        with VideoReader(report.video_path) as reader:
            metadata = reader.metadata

            for frame in reader.frames():
                traffic_due, traffic_next = traffic_sampler.accepts(
                    frame,
                    traffic_next,
                )
                road_due, road_next = road_sampler.accepts(
                    frame,
                    road_next,
                )

                if traffic_due and traffic_model is not None:
                    for confidence, associated_box in _traffic_candidates(
                        traffic_model,
                        frame.image,
                        settings.traffic_confidence_threshold,
                        settings,
                    ):
                        _record(
                            database,
                            report,
                            recent,
                            kind="HELMET_VIOLATION",
                            title="Missing Helmet Detection",
                            timestamp=frame.timestamp,
                            frame_number=frame.frame_number,
                            confidence=confidence,
                            image=frame.image,
                            motorcycle=associated_box,
                        )

                if road_due and pothole_model is not None:
                    for confidence, box in _pothole_candidates(
                        pothole_model,
                        frame.image,
                        settings.pothole_confidence,
                    ):
                        _record(
                            database,
                            report,
                            recent,
                            kind="POTHOLE",
                            title="Road Surface Pothole",
                            timestamp=frame.timestamp,
                            frame_number=frame.frame_number,
                            confidence=confidence,
                            image=frame.image,
                            motorcycle=box,
                        )

                if frame.frame_number % max(
                    1,
                    int(metadata.fps),
                ) == 0:
                    _set_progress(
                        report,
                        read=frame.frame_number + 1,
                        stage="Traffic and road analysis",
                        percent=(
                            (frame.frame_number + 1)
                            / metadata.frame_count
                            * 100
                        ),
                        timestamp=frame.timestamp,
                    )
                    database.commit()

            report.processing_time = monotonic() - started
            report.completed_at = datetime.now(timezone.utc)
            report.status = "READY_FOR_REVIEW"
            report.summary_json = {
                "helmet_violations": sum(
                    item.type == "HELMET_VIOLATION"
                    for group in recent.values()
                    for item in group
                ),
                "potholes": sum(
                    item.type == "POTHOLE"
                    for group in recent.values()
                    for item in group
                ),
                "model_warnings": model_warnings,
                "inference_mode": (
                    "demo" if model_warnings else "model"
                ),
            }

            _set_progress(
                report,
                read=metadata.frame_count,
                stage="Ready for human verification",
                percent=100,
                timestamp=metadata.duration,
            )
            database.commit()

    except (
        ModelLoadError,
        VideoOpenError,
        OSError,
        ValueError,
    ) as exc:
        database.rollback()
        report = database.get(Report, report_id)

        if report is not None:
            report.status = "FAILED"
            report.processing_error = str(exc)
            _set_progress(
                report,
                read=0,
                stage="Failed",
                percent=0,
            )
            database.commit()

        logger.exception(
            "Analysis failed for report %s",
            report_id,
        )

    except Exception:
        database.rollback()
        report = database.get(Report, report_id)

        if report is not None:
            report.status = "FAILED"
            report.processing_error = (
                "Analysis failed unexpectedly; inspect backend logs."
            )
            _set_progress(
                report,
                read=0,
                stage="Failed",
                percent=0,
            )
            database.commit()

        logger.exception(
            "Unexpected analysis failure for report %s",
            report_id,
        )

    finally:
        database.close()