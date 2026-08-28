from fastapi.testclient import TestClient


def test_health_reports_liveness(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "serviceops-api",
        "version": "0.5.0",
    }


def test_ready_reports_completed_checks(client: TestClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"configuration": "ok", "database": "ok"},
    }


def test_openapi_is_versioned(client: TestClient) -> None:
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "ServiceOps API"
    assert response.json()["info"]["version"] == "0.5.0"
