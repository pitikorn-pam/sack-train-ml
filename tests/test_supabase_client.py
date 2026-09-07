"""The client that carries a multi-hour training run's results home.

Two properties matter more than the rest and neither had a test. The HMAC signature must
be computed over the exact bytes that are sent — a signature over a re-serialised body
is invalid every time, and would reject every callback. And `log_step` must never raise:
it sits between the expensive stages, so a dead callback endpoint must not be able to
discard finished work.

Every test here stubs the transport. Nothing reaches the network.

    pytest tests/test_supabase_client.py
"""
from __future__ import annotations

import hashlib
import hmac
import json
from urllib.error import HTTPError, URLError

import pytest

from sack_train_ml import supabase_client as sc
from sack_train_ml.supabase_client import RegistryClient, RegistryError


class _Response:
    def __init__(self, payload=b""):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture()
def client():
    return RegistryClient(
        supabase_url="https://example.supabase.co/",
        service_role_key="service-key",
        callback_secret="shhh",
    )


@pytest.fixture()
def sent(monkeypatch):
    """Capture every request instead of sending it."""
    calls: list = []

    def fake_urlopen(req, timeout=None):
        calls.append(req)
        return _Response(b"[]")

    monkeypatch.setattr(sc, "urlopen", fake_urlopen)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    return calls


# --------------------------------------------------------------------------
# the signature
# --------------------------------------------------------------------------

def test_the_signature_covers_the_exact_bytes_that_are_sent(client, sent):
    client.log_metric("run-1", step=3, name="map50", value=0.91)
    req = sent[-1]
    body = req.data
    header = req.headers["X-training-signature"]
    expected = hmac.new(b"shhh", body, hashlib.sha256).hexdigest()
    assert header == f"sha256={expected}", (
        "the signature must be over the bytes on the wire; a signature over a "
        "re-serialised body is invalid every single time"
    )


def test_no_secret_means_no_signature_header_rather_than_an_empty_one():
    c = RegistryClient(supabase_url="https://x", service_role_key="k", callback_secret="")
    assert c.callback_secret == ""


def test_the_body_is_compact_json_so_the_signature_is_stable(client, sent):
    client.log_metric("run-1", step=1, name="loss", value=0.5)
    assert b", " not in sent[-1].data, "whitespace in the payload would change the digest"


# --------------------------------------------------------------------------
# log_step: best-effort by contract
# --------------------------------------------------------------------------

def test_log_step_never_raises_even_when_the_endpoint_is_dead(client, monkeypatch, capsys):
    def boom(req, timeout=None):
        raise URLError("connection refused")

    monkeypatch.setattr(sc, "urlopen", boom)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    client.log_step("run-1", 6, "upload", "ok", "uploaded best.pt")  # must not raise
    assert "dropped" in capsys.readouterr().out


def test_the_things_that_must_succeed_still_raise(client, monkeypatch):
    """patch_run is not best-effort: a run that silently fails to record its status is
    indistinguishable from one that never started."""
    def boom(req, timeout=None):
        raise HTTPError("u", 500, "server error", {}, None)

    monkeypatch.setattr(sc, "urlopen", boom)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    with pytest.raises(RegistryError):
        client.patch_run("run-1", {"status": "running"})


# --------------------------------------------------------------------------
# retries
# --------------------------------------------------------------------------

def test_a_transient_5xx_is_retried_rather_than_failing_the_run(client, monkeypatch):
    """A callback that gives up after half a second can take a multi-hour run with it."""
    attempts = {"n": 0}

    def flaky(req, timeout=None):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise HTTPError("u", 502, "bad gateway", {}, None)
        return _Response(b"")

    monkeypatch.setattr(sc, "urlopen", flaky)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    client.finalize_run("run-1", status="succeeded")
    assert attempts["n"] == 3


def test_a_4xx_is_not_retried_because_repeating_it_cannot_help(client, monkeypatch):
    attempts = {"n": 0}

    def rejected(req, timeout=None):
        attempts["n"] += 1
        raise HTTPError("u", 401, "unauthorized", {}, None)

    monkeypatch.setattr(sc, "urlopen", rejected)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    with pytest.raises(RegistryError, match="401"):
        client.finalize_run("run-1")
    assert attempts["n"] == 1


def test_retries_are_bounded(client, monkeypatch):
    attempts = {"n": 0}

    def always_down(req, timeout=None):
        attempts["n"] += 1
        raise HTTPError("u", 503, "unavailable", {}, None)

    monkeypatch.setattr(sc, "urlopen", always_down)
    monkeypatch.setattr(sc.time, "sleep", lambda _s: None)
    with pytest.raises(RegistryError):
        client.finalize_run("run-1")
    assert attempts["n"] == 4


# --------------------------------------------------------------------------
# payload shapes
# --------------------------------------------------------------------------

def test_finalize_sends_the_error_only_when_it_failed(client, sent):
    client.finalize_run("run-1", status="succeeded")
    assert "error" not in json.loads(sent[-1].data)

    client.finalize_run("run-1", status="failed", error="HEF compile failed")
    body = json.loads(sent[-1].data)
    assert body["type"] == "failed" and body["error"] == "HEF compile failed"


def test_epoch_defaults_to_step_rather_than_being_absent(client, sent):
    """The dashboard charts against epoch; a null would drop the point silently."""
    client.log_metric("run-1", step=7, name="loss", value=0.2)
    assert json.loads(sent[-1].data)["epoch"] == 7


def test_an_explicit_epoch_wins(client, sent):
    client.log_metric("run-1", step=7, name="loss", value=0.2, epoch=3)
    assert json.loads(sent[-1].data)["epoch"] == 3


def test_a_missing_run_is_an_error_not_an_empty_config(client, monkeypatch):
    monkeypatch.setattr(sc, "urlopen", lambda req, timeout=None: _Response(b"[]"))
    with pytest.raises(RegistryError, match="run not found"):
        client.fetch_run("nope")


def test_the_url_is_normalised_so_paths_do_not_double_slash():
    c = RegistryClient(supabase_url="https://x.supabase.co/", service_role_key="k")
    assert c.url == "https://x.supabase.co"


def test_rest_errors_carry_the_server_detail(client, monkeypatch):
    class _Err(HTTPError):
        def read(self):
            return b'{"message":"permission denied for table runs"}'

    monkeypatch.setattr(
        sc, "urlopen",
        lambda req, timeout=None: (_ for _ in ()).throw(_Err("u", 403, "forbidden", {}, None)),
    )
    with pytest.raises(RegistryError, match="permission denied"):
        client.fetch_run("run-1")


# --------------------------------------------------------------------------
# the signature is mandatory, and the failure has to be legible
# --------------------------------------------------------------------------

def test_it_refuses_to_send_an_unsigned_callback(monkeypatch):
    """training-callback no longer accepts a service-role claim in place of a signature,
    because that claim was never verified. Sending unsigned would 401 halfway through a
    multi-hour run; refusing here names the environment variable while it can still be
    fixed cheaply."""
    monkeypatch.setattr(sc, "urlopen", lambda req, timeout=None: _Response(b""))
    c = RegistryClient(supabase_url="https://x", service_role_key="k", callback_secret="")
    with pytest.raises(RegistryError, match="TRAINING_CALLBACK_SECRET"):
        c.finalize_run("run-1")


def test_the_refusal_explains_why_the_old_shortcut_is_gone(monkeypatch):
    monkeypatch.setattr(sc, "urlopen", lambda req, timeout=None: _Response(b""))
    c = RegistryClient(supabase_url="https://x", service_role_key="k", callback_secret="")
    with pytest.raises(RegistryError, match="never verified"):
        c.log_metric("run-1", 1, "loss", 0.5)


def test_log_step_still_swallows_it_because_it_is_best_effort(monkeypatch, capsys):
    """A missing secret must not take a finished run down through the progress logger,
    which is the one call documented as never raising."""
    monkeypatch.setattr(sc, "urlopen", lambda req, timeout=None: _Response(b""))
    c = RegistryClient(supabase_url="https://x", service_role_key="k", callback_secret="")
    c.log_step("run-1", 6, "upload", "ok", "done")  # must not raise
    assert "dropped" in capsys.readouterr().out
