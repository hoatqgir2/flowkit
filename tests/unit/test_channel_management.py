"""Unit tests for Story Studio YouTube Channel Management."""

import pytest
from starlette.testclient import TestClient
from agent.main import app
import agent.services.story_studio as ss
import agent.services.channel_browser as cb


@pytest.fixture
def client():
    return TestClient(app)


def test_channel_migration_and_defaults(client):
    """Ensure K1 and K2 channels exist and existing projects are indexed."""
    res = client.get("/api/story-studio/channels")
    assert res.status_code == 200
    data = res.json()
    channels = data.get("channels", [])
    assert len(channels) >= 2
    c_ids = [c["id"] for c in channels]
    assert "channel_k1" in c_ids
    assert "channel_k2" in c_ids


def test_channel_crud_and_overrides(client):
    """Create a new channel, patch its prompt templates, and verify retrieval."""
    # 1. Create channel
    create_res = client.post("/api/story-studio/channels", json={
        "name": "Kênh 3 — Triết Học",
        "title_prefix": "K3 - ",
        "niche": "brain_psychology",
        "description": "Kênh về triết học khắc kỷ",
        "prompt_templates": {
            "scene_prefix": "Stoic philosopher doodle drawing",
            "scene_suffix_no_text": ", no text, ancient greek style",
            "scene_suffix_concept_card": ", red text card",
            "ai_director_system_prompt": "Direct in stoic style",
        },
    })
    assert create_res.status_code == 200
    created = create_res.json()
    cid = created["id"]
    assert created["name"] == "Kênh 3 — Triết Học"
    assert created["prompt_templates"]["scene_prefix"] == "Stoic philosopher doodle drawing"

    # 2. Update channel
    patch_res = client.patch(f"/api/story-studio/channels/{cid}", json={
        "handle": "@triethoc",
        "title_prefix": "K3-Stoic - ",
    })
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["handle"] == "@triethoc"
    assert patched["title_prefix"] == "K3-Stoic - "

    # 3. Create a project inheriting from this channel
    proj_res = client.post("/api/story-studio/projects", json={
        "channel_id": cid,
        "title": "Meditations Marcus Aurelius",
        "keyword": "stoicism",
    })
    assert proj_res.status_code == 200
    proj = proj_res.json()
    pid = proj["id"]
    assert proj["channel_id"] == cid
    assert proj["title"].startswith("K3-Stoic - ")
    assert proj["prompt_config"]["scene_prefix"] == "Stoic philosopher doodle drawing"

    # 4. Filter projects by channel
    filter_res = client.get(f"/api/story-studio/projects?channel_id={cid}")
    assert filter_res.status_code == 200
    f_projs = filter_res.json().get("projects", [])
    assert any(p["id"] == pid for p in f_projs)

    # 5. Check browser status for channel
    status_res = client.get(f"/api/story-studio/channels/{cid}/browser-status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "is_open" in status_data
    assert "port" in status_data

    # 6. Delete channel
    del_res = client.delete(f"/api/story-studio/channels/{cid}?delete_projects=true")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True
