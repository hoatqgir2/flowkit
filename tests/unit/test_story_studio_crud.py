import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from agent.api.story_studio import router
import agent.services.story_studio as ss


@pytest.fixture
def client(tmp_path, monkeypatch):
    test_dir = tmp_path / "story_studio"
    test_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(ss, "STORY_STUDIO_DIR", test_dir)
    monkeypatch.setattr(ss, "PROJECTS_FILE", test_dir / "projects.json")
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


def test_story_studio_update_topic_requirements_and_background_mode(client):
    # 1. Create project with defaults
    res = client.post("/api/story-studio/projects", json={
        "title": "Ancient History Project",
        "keyword": "evolution",
    })
    assert res.status_code == 200
    proj_id = res.json()["id"]
    assert res.json()["background_mode"] == "dynamic"
    assert res.json()["topic_requirements"] == ""

    # 2. Update topic_requirements and background_mode via PATCH
    custom_rules = "- Savanna acacia trees\n- Big boulder with 'SURVIVAL' label\n- Campfire with tribe"
    res_patch = client.patch(f"/api/story-studio/projects/{proj_id}", json={
        "topic_requirements": custom_rules,
        "background_mode": "fixed",
        "prompt_style": "ancient_humans",
    })
    assert res_patch.status_code == 200
    updated_data = res_patch.json()
    assert updated_data["topic_requirements"] == custom_rules
    assert updated_data["background_mode"] == "fixed"
    assert updated_data["prompt_style"] == "ancient_humans"

    # 3. Verify GET returns persisted data (like page reload)
    res_get = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert get_data["topic_requirements"] == custom_rules
    assert get_data["background_mode"] == "fixed"
    assert get_data["prompt_style"] == "ancient_humans"

    # 4. Verify clearing topic_requirements to empty string works
    res_clear = client.patch(f"/api/story-studio/projects/{proj_id}", json={
        "topic_requirements": "",
    })
    assert res_clear.status_code == 200
    assert res_clear.json()["topic_requirements"] == ""

    # 5. Verify GET reflects empty string
    res_get2 = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get2.status_code == 200
    assert res_get2.json()["topic_requirements"] == ""
    # other fields preserved
    assert res_get2.json()["background_mode"] == "fixed"
    assert res_get2.json()["prompt_style"] == "ancient_humans"


def test_story_studio_scene_prompt_persistence_and_update(client):
    # 1. Create project
    res = client.post("/api/story-studio/projects", json={
        "title": "Scene Prompt Test Project",
        "keyword": "ancient",
    })
    assert res.status_code == 200
    proj_id = res.json()["id"]

    # 2. Add scenes with prompts via PUT transcript
    scenes_data = [
        {"id": 1, "timestamp_str": "00:00", "start_s": 0.0, "end_s": 3.0, "text": "Sentence 1", "prompt": "Original prompt 1"},
        {"id": 2, "timestamp_str": "00:03", "start_s": 3.0, "end_s": 6.0, "text": "Sentence 2", "prompt": "Original prompt 2"},
    ]
    res_transcript = client.put(f"/api/story-studio/projects/{proj_id}/transcript", json={
        "scenes": scenes_data,
    })
    assert res_transcript.status_code == 200

    # Verify initial prompts saved
    res_get1 = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get1.status_code == 200
    assert len(res_get1.json()["scenes"]) == 2
    assert res_get1.json()["scenes"][0]["prompt"] == "Original prompt 1"
    assert res_get1.json()["scenes"][1]["prompt"] == "Original prompt 2"

    # 3. Update single scene prompt via PATCH /scenes/{scene_id}
    new_prompt_1 = "Hand-drawn 2D doodle cartoon, customized prompt with spiky orange hair and acacia tree"
    res_patch_sc = client.patch(f"/api/story-studio/projects/{proj_id}/scenes/1", json={
        "prompt": new_prompt_1,
    })
    assert res_patch_sc.status_code == 200
    assert res_patch_sc.json()["scene"]["prompt"] == new_prompt_1

    # 4. Verify reload (GET) returns the updated scene prompt intact
    res_get2 = client.get(f"/api/story-studio/projects/{proj_id}")
    assert res_get2.status_code == 200
    assert res_get2.json()["scenes"][0]["prompt"] == new_prompt_1
    assert res_get2.json()["scenes"][1]["prompt"] == "Original prompt 2"


