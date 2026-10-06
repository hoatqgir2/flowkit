import pytest
from agent.services.story_studio import STYLES_REGISTRY, get_available_styles, build_scene_prompts


def test_styles_registry():
    styles = get_available_styles()
    assert len(styles) >= 2
    style_ids = [s["id"] for s in styles]
    assert "forgotten_civilizations" in style_ids
    assert "ancient_humans" in style_ids


def test_build_scene_prompts_forgotten_civilizations():
    scenes = [
        {"id": 1, "text": "You wake to woodsmoke and river mud."},
        {"id": 2, "text": "You board a narrow wooden boat on the river."},
    ]
    res = build_scene_prompts(scenes, style="forgotten_civilizations")
    assert len(res) == 2
    p1 = res[0]["prompt"]
    assert "Hand-drawn 2D doodle cartoon animation" in p1
    assert "rustic stilt hut" in p1
    assert "simple educational YouTube explainer doodle style" in p1

    p2 = res[1]["prompt"]
    assert "narrow wooden dugout boat" in p2


def test_build_scene_prompts_ancient_humans():
    scenes = [
        {"id": 1, "text": "For 300,000 years on the prehistoric savanna."},
        {"id": 2, "text": "Survival was a constant struggle against deadly predators."},
        {"id": 3, "text": "A tribe sitting around the campfire."},
    ]
    res = build_scene_prompts(scenes, style="ancient_humans")
    assert len(res) == 3

    p1 = res[0]["prompt"]
    assert "Hand-drawn 2D doodle cartoon animation" in p1
    assert "savanna" in p1
    assert "acacia tree" in p1
    assert "spiky orange hair" in p1

    p2 = res[1]["prompt"]
    assert "SURVIVAL" in p2
    assert "wooden spear" in p2

    p3 = res[2]["prompt"]
    assert "campfire" in p3
    assert "tribe" in p3
