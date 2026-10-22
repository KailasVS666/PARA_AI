"""Tests for the model-backed report worker's helmet candidate filter."""

from types import SimpleNamespace

import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.database import Base
from app.models.report import Incident, Report
from app.schemas.incidents import BoundingBox
import app.services.report_processing as report_processing
from app.services.report_processing import _traffic_candidates


class FakeBox:
    def __init__(self, class_id: int, confidence: float, coordinates: list[float]) -> None:
        self.cls = np.array([class_id])
        self.conf = np.array([confidence])
        self.xyxy = np.array([coordinates])


class FakeModel:
    def predict(self, *_: object, **__: object) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                names={0: "Bike_Rider", 1: "Helmet", 2: "No_Helmet"},
                boxes=[
                    FakeBox(0, 0.93, [10, 10, 100, 100]),
                    FakeBox(2, 0.82, [30, 20, 55, 45]),
                ],
            )
        ]


def test_report_worker_accepts_upstream_bike_rider_and_no_helmet_classes() -> None:
    settings = Settings(traffic_confidence_threshold=0.4)

    candidates = _traffic_candidates(
        FakeModel(), np.zeros((120, 120, 3), dtype=np.uint8), 0.4, settings
    )

    assert len(candidates) == 1
    assert candidates[0][0] == 0.82
    assert candidates[0][1].left == 10


def test_report_worker_keeps_distinct_nearby_same_type_incidents(monkeypatch) -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    report = Report(
        id="report-1",
        filename="drive.mp4",
        video_path="uploads/videos/drive.mp4",
        status="PROCESSING",
    )
    session.add(report)
    session.flush()
    monkeypatch.setattr(report_processing, "_save_evidence", lambda *_: None)

    recent: dict[str, list[Incident]] = {}
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    report_processing._record(
        session,
        report,
        recent,
        kind="POTHOLE",
        title="Road Surface Pothole",
        timestamp=1.0,
        frame_number=10,
        confidence=0.8,
        image=image,
        motorcycle=BoundingBox(left=5, top=50, right=25, bottom=70),
    )
    report_processing._record(
        session,
        report,
        recent,
        kind="POTHOLE",
        title="Road Surface Pothole",
        timestamp=1.5,
        frame_number=15,
        confidence=0.85,
        image=image,
        motorcycle=BoundingBox(left=65, top=50, right=85, bottom=70),
    )

    assert session.query(Incident).filter_by(report_id=report.id).count() == 2
