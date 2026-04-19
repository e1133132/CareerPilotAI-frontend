import io
import pytest
import requests
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_index_page(client):
    response = client.get("/")
    assert response.status_code == 200


def test_missing_file(client):
    response = client.post("/api/careerpilot/run")
    assert response.status_code == 400

    data = response.get_json()
    assert data["ok"] is False
    assert "Missing resume_file" in data["error"]


def test_success_response(client, monkeypatch):
    class MockResponse:
        status_code = 200

        def json(self):
            return {
                "ok": True,
                "result": "test success"
            }

    def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("requests.post", mock_post)

    data = {
        "resume_file": (io.BytesIO(b"dummy pdf content"), "resume.pdf"),
        "target_roles": "AI Engineer"
    }

    response = client.post(
        "/api/careerpilot/run",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    json_data = response.get_json()
    assert json_data["ok"] is True
    assert json_data["result"] == "test success"


def test_non_json_response(client, monkeypatch):
    class MockResponse:
        status_code = 500
        text = "<html>Error</html>"

        def json(self):
            raise ValueError("Not JSON")

    def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr("requests.post", mock_post)

    data = {
        "resume_file": (io.BytesIO(b"dummy pdf content"), "resume.pdf")
    }

    response = client.post(
        "/api/careerpilot/run",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 502
    json_data = response.get_json()
    assert json_data["ok"] is False
    assert "non-JSON" in json_data["error"]


def test_backend_connection_error(client, monkeypatch):
    def mock_post(*args, **kwargs):
        raise requests.exceptions.ConnectionError()

    monkeypatch.setattr("requests.post", mock_post)

    data = {
        "resume_file": (io.BytesIO(b"dummy pdf content"), "resume.pdf")
    }

    response = client.post(
        "/api/careerpilot/run",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 502
    json_data = response.get_json()
    assert json_data["ok"] is False
    assert "Cannot connect to backend service" in json_data["error"]


def test_backend_timeout(client, monkeypatch):
    def mock_post(*args, **kwargs):
        raise requests.exceptions.Timeout()

    monkeypatch.setattr("requests.post", mock_post)

    data = {
        "resume_file": (io.BytesIO(b"dummy pdf content"), "resume.pdf")
    }

    response = client.post(
        "/api/careerpilot/run",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 504
    json_data = response.get_json()
    assert json_data["ok"] is False
    assert "Backend service timed out" in json_data["error"]


def test_unexpected_exception(client, monkeypatch):
    def mock_post(*args, **kwargs):
        raise Exception("Unexpected error")

    monkeypatch.setattr("requests.post", mock_post)

    data = {
        "resume_file": (io.BytesIO(b"dummy pdf content"), "resume.pdf")
    }

    response = client.post(
        "/api/careerpilot/run",
        data=data,
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    json_data = response.get_json()
    assert json_data["ok"] is False
    assert "Unexpected error" in json_data["error"]