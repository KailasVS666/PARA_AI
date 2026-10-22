"""Tests for the model-backed report worker's helmet candidate filter."""

from types import SimpleNamespace

import numpy as np

from app.core.config import Settings
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
