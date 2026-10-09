"""Unit tests for Story Studio scene chaining and continuity mode."""

import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from agent.services import story_studio as ss
from agent.api.story_studio import (
    BuildPromptsRequest,
    GeneratePromptsAIRequest,
    GenerateSceneImageRequest,
    build_prompts_endpoint,
    generate_prompts_ai_endpoint,
    generate_scene_image_endpoint,
)


def test_extract_chained_actions_json():
    # Test valid JSON array
    json_text = json.dumps([
        {"id": 1, "transition_type": "new_scene", "source_scene_id": None, "action": "A wide shot of savanna"},
        {"id": 2, "transition_type": "inherit_edit", "source_scene_id": 1, "action": "Same savanna, figure picks up spear"},
        {"id": 3, "transition_type": "hold_frame", "source_scene_id": 2, "action": "Hold same frame"},
    ])
    res = ss._extract_chained_actions_json(json_text)
    assert len(res) == 3
    assert res[1]["transition_type"] == "new_scene"
    assert res[1]["source_scene_id"] is None
    assert res[2]["transition_type"] == "inherit_edit"
    assert res[2]["source_scene_id"] == 1
    assert res[3]["transition_type"] == "hold_frame"
    assert res[3]["source_scene_id"] == 2

    # Test markdown fenced JSON
    fenced_text = f"```json\n{json_text}\n```"
    res_fenced = ss._extract_chained_actions_json(fenced_text)
    assert len(res_fenced) == 3

    # Test dictionary with 'scenes' key
    dict_text = json.dumps({"scenes": [
        {"id": 1, "transition_type": "new_scene", "source_scene_id": None, "action": "Opening scene"}
    ]})
    res_dict = ss._extract_chained_actions_json(dict_text)
    assert len(res_dict) == 1
    assert res_dict[1]["action"] == "Opening scene"


@pytest.mark.asyncio
async def test_generate_scene_prompts_ai_legacy_independent_mode():
    scenes = [
        {"id": 1, "text": "Con người xuất hiện"},
        {"id": 2, "text": "Họ tìm cách sinh tồn"},
    ]
    # In legacy mode (chaining_mode=False), mocked LLM returns standard [{"id": 1, "action": "..."}]
    mock_llm_response = json.dumps([
        {"id": 1, "action": "Character standing alone"},
        {"id": 2, "action": "Character finding food"},
    ])

    with patch("agent.services.story_studio._call_llm_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_response
        res = await ss.generate_scene_prompts_ai(
            scenes=scenes,
            api_key="mock_key",
            base_url="https://api.openai.com/v1",
            chaining_mode=False,
        )

    assert len(res) == 2
    assert "Character standing alone" in res[0]["prompt"]
    assert "Character finding food" in res[1]["prompt"]
    # No transition_type forced in legacy mode
    assert res[0].get("transition_type") is None


@pytest.mark.asyncio
async def test_generate_scene_prompts_ai_chaining_mode():
    scenes = [
        {"id": 1, "text": "Con người xuất hiện"},
        {"id": 2, "text": "Họ cầm giáo săn mồi"},
    ]
    mock_chained_response = json.dumps([
        {"id": 1, "transition_type": "new_scene", "source_scene_id": None, "action": "Wide prehistoric savanna"},
        {"id": 2, "transition_type": "inherit_edit", "source_scene_id": 1, "action": "Same savanna, holding spear"},
    ])

    with patch("agent.services.story_studio._call_llm_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_chained_response
        res = await ss.generate_scene_prompts_ai(
            scenes=scenes,
            api_key="mock_key",
            base_url="https://api.openai.com/v1",
            chaining_mode=True,
        )

    assert len(res) == 2
    assert res[0]["transition_type"] == "new_scene"
    assert res[0]["source_scene_id"] is None
    assert res[1]["transition_type"] == "inherit_edit"
    assert res[1]["source_scene_id"] == 1


@pytest.mark.asyncio
async def test_generate_scene_image_hold_frame_instant(tmp_path, monkeypatch):
    proj_id = "test-chaining-project"
    pdir = tmp_path / proj_id
    scene_dir = pdir / "scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)

    # Create dummy image for scene 1
    src_file = scene_dir / "scene_001.png"
    src_file.write_bytes(b"dummy_png_data")

    project_data = {
        "id": proj_id,
        "title": "Chaining Test",
        "scenes": [
            {
                "id": 1,
                "text": "Scene 1",
                "prompt": "Prompt 1",
                "image_url": f"/output/story_studio/{proj_id}/scenes/scene_001.png",
                "cdn_url": "https://cdn.example.com/scene1.png",
                "media_id": "00000000-0000-0000-0000-000000000001",
                "status": "completed",
            },
            {
                "id": 2,
                "text": "Scene 2",
                "prompt": "Prompt 2",
                "transition_type": "hold_frame",
                "source_scene_id": 1,
                "status": "pending",
            },
        ],
    }

    monkeypatch.setattr(ss, "get_project", lambda pid: project_data)
    monkeypatch.setattr(ss, "save_project", lambda p: p)
    monkeypatch.setattr(ss, "get_project_dir", lambda pid: pdir)

    req = GenerateSceneImageRequest(scene_id=2)
    # Should not call Flow at all, should complete instantly by copying scene 1
    with patch("agent.services.story_studio.generate_single_scene_image") as mock_flow_gen:
        res = await generate_scene_image_endpoint(proj_id, req)
        mock_flow_gen.assert_not_called()

    assert res["status"] == "completed"
    assert res.get("hold_frame") is True
    assert (scene_dir / "scene_002.png").exists()
    assert (scene_dir / "scene_002.png").read_bytes() == b"dummy_png_data"


@pytest.mark.asyncio
async def test_generate_scene_image_inherit_edit_passes_base_media_id(tmp_path, monkeypatch):
    proj_id = "test-chaining-project-2"
    project_data = {
        "id": proj_id,
        "title": "Inherit Edit Test",
        "character_media_id": "char-ref-uuid",
        "flow_project_id": "flow-pid",
        "scenes": [
            {
                "id": 1,
                "text": "Scene 1",
                "prompt": "Prompt 1",
                "media_id": "11111111-2222-3333-4444-555555555555",
                "status": "completed",
            },
            {
                "id": 2,
                "text": "Scene 2",
                "prompt": "Prompt 2",
                "transition_type": "inherit_edit",
                "source_scene_id": 1,
                "status": "pending",
            },
        ],
    }

    monkeypatch.setattr(ss, "get_project", lambda pid: project_data)
    monkeypatch.setattr(ss, "save_project", lambda p: p)

    req = GenerateSceneImageRequest(scene_id=2)
    with patch("agent.services.story_studio.generate_single_scene_image", new_callable=AsyncMock) as mock_flow_gen:
        mock_flow_gen.return_value = {
            "scene_id": 2,
            "image_url": "/test.png",
            "cdn_url": "https://cdn.example.com/2.png",
            "media_id": "99999999-8888-7777-6666-555555555555",
            "status": "completed",
        }
        res = await generate_scene_image_endpoint(proj_id, req)

    mock_flow_gen.assert_called_once_with(
        project_id=proj_id,
        scene_id=2,
        prompt="Prompt 2",
        character_media_id="char-ref-uuid",
        flow_project_id="flow-pid",
        image_model="BELUGA",
        timeout_seconds=60.0,
        base_media_id="11111111-2222-3333-4444-555555555555",
    )
    assert res["media_id"] == "99999999-8888-7777-6666-555555555555"


def test_build_ken_burns_filter():
    # Test standard zoom in
    zf, z_end = ss._build_ken_burns_filter(duration=3.0, is_hold=False, motion_type="zoom_in")
    assert "zoompan=" in zf
    assert "min(1.0000+" in zf
    assert z_end == 1.05

    # Test zoom out
    zf_out, z_end_out = ss._build_ken_burns_filter(duration=3.0, is_hold=False, motion_type="zoom_out")
    assert "max(1.0500-" in zf_out
    assert z_end_out == 1.00

    # Test hold_frame camera continuity
    zf_hold, z_end_hold = ss._build_ken_burns_filter(duration=3.0, is_hold=True, prev_zoom_end=1.05)
    assert "min(1.0500+" in zf_hold
    assert z_end_hold > 1.05
    assert z_end_hold <= 1.09

