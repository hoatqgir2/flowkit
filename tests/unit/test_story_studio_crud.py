import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from agent.api.story_studio import router
import agent.services.story_studio as ss


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(ss, "STORY_STUDIO_DIR", tmp_path / "story_studio")
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app, raise_server_exceptions=False)


def test_story_studio_rename_and_delete_project(client):
    # 1. Create project
    res = client.post("/api/story-studio/projects", json={
        "title": "Old Project Name",
        "keyword": "ancient civilization",
    })
    assert res.status_code == 200
    data = res.json()
    proj_id = data["id"]
    assert data["title"] == "Old Project Name"

    # 2. Rename project via PATCH
    res_patch = client.patch(f"/api/story-studio/projects/{proj_id}", json={
        "title": "New Awesome Story Title",
    })
    assert res_patch.status_code == 200
    assert res_patch.json()["title"] == "New Awesome Story Title"

    # Verify GET returns new title
    res_get = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get.status_code == 200
    assert res_get.json()["title"] == "New Awesome Story Title"

    # Verify listing shows new title
    res_list = client.get("/api/story-studio/projects")
    assert res_list.status_code == 200
    projects = res_list.json()["projects"]
    assert any(p["id"] == proj_id and p["title"] == "New Awesome Story Title" for p in projects)

    # 3. Delete project
    res_del = client.delete(f"/api/story-studio/projects/{proj_id}")
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True

    # 4. Verify project is gone
    res_get_deleted = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get_deleted.status_code == 404

    res_list_after = client.get("/api/story-studio/projects")
    assert not any(p["id"] == proj_id for p in res_list_after.json()["projects"])
