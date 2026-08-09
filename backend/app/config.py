"""Loads config.yaml (all variable data) once, plus env overrides."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

CONFIG_PATH = Path(os.environ.get("CONFIG_PATH", Path(__file__).resolve().parent.parent / "config.yaml"))


@lru_cache
def cfg() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    # env overrides for the few infra knobs
    data["app"]["jwt_secret"] = os.environ.get("JWT_SECRET", data["app"]["jwt_secret"])
    return data


def pricing_cfg() -> dict:
    return cfg()["pricing"]
