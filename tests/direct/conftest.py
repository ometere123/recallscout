import sys
import pytest


@pytest.fixture(autouse=True)
def ignore_windows_fd0_unlink(monkeypatch):
    import os

    original_unlink = os.unlink

    def safe_unlink(path, *args, **kwargs):
        try:
            return original_unlink(path, *args, **kwargs)
        except PermissionError:
            return None

    monkeypatch.setattr(os, "unlink", safe_unlink)


def warp_to(direct_vm, iso: str) -> None:
    direct_vm.warp(iso)
    gl = sys.modules.get("genlayer.gl")
    if gl is None:
        return
    raw = getattr(gl, "message_raw", None)
    if isinstance(raw, dict):
        raw["datetime"] = iso
    nested = getattr(getattr(gl, "message", None), "raw", None)
    if isinstance(nested, dict):
        nested["datetime"] = iso


@pytest.fixture
def deploy_recall(direct_deploy):
    return direct_deploy("contracts/recall_scout.py")
