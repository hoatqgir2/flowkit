import pytest
from agent.services.story_studio import STYLES_REGISTRY, get_available_styles, build_scene_prompts


def test_styles_registry():
    styles = get_available_styles()
    assert len(styles) >= 3
    style_ids = [s["id"] for s in styles]
    assert "forgotten_civilizations" in style_ids
    assert "ancient_humans" in style_ids
    assert "brain_psychology" in style_ids


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


def test_build_scene_prompts_brain_psychology():
    scenes = [
        {"id": 1, "text": "Why does your brain treat sound advice like a threat?"},
        {"id": 2, "text": "When someone gives you advice, you ignore it and cover your ears."},
        {"id": 3, "text": "Psychologists call this phenomenon reactance."},
        {"id": 4, "text": "Your thumb keeps scrolling on your phone in the dark."},
        {"id": 5, "text": "Someone gives you genuinely great advice and you nod along."},
    ]
    # Test with exact alias string matching user's query
    res = build_scene_prompts(scenes, style="why your brain ignores good advice psychology")
    assert len(res) == 5

    p1 = res[0]["prompt"]
    assert "defensive" in p1
    assert "advice" in p1
    assert "no text, no words, no letters" in p1

    p2 = res[1]["prompt"]
    assert "ears" in p2
    assert "megaphone" in p2

    p3 = res[2]["prompt"]
    assert "REACTANCE" in p3

    p4 = res[3]["prompt"]
    assert "smartphone" in p4 or "scroll" in p4

    p5 = res[4]["prompt"]
    assert "conversation" in p5 or "nod" in p5

    # Ensure pink cartoon brain is NOT spammed on every scene
    assert sum("pink cartoon brain" in s["prompt"] for s in res) == 0


import pytest

@pytest.mark.asyncio
async def test_generate_scene_prompts_ai_fallback(monkeypatch):
    import agent.services.story_studio as ss
    monkeypatch.setattr(ss, "STORY_AI_API_KEY", "")
    scenes = [{"id": 1, "text": "Why does your brain treat sound advice like a threat?"}]
    # When no API key is available, falls back to rule-based prompt builder
    res = await ss.generate_scene_prompts_ai(scenes, style="brain_psychology", api_key="")
    assert len(res) == 1
    assert "defensive" in res[0]["prompt"]


@pytest.mark.asyncio
async def test_generate_scene_prompts_ai_single_shot(monkeypatch):
    import agent.services.story_studio as ss
    import json

    call_count = 0
    received_payload = {}

    class DummyResponse:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {
                "choices": [{
                    "message": {
                        "content": json.dumps([
                            {"id": 1, "action": "The main stick figure character standing in confusion"},
                            {"id": 2, "action": "The main stick figure character reading a wise book"},
                            {"id": 3, "action": "The main stick figure character nodding in agreement"},
                        ])
                    }
                }]
            }

    class DummyClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            nonlocal call_count, received_payload
            call_count += 1
            received_payload = kwargs.get("json", {})
            return DummyResponse()

    monkeypatch.setattr(ss.httpx, "AsyncClient", lambda **kw: DummyClient())

    scenes = [
        {"id": 1, "text": "Sentence one."},
        {"id": 2, "text": "Sentence two."},
        {"id": 3, "text": "Sentence three."},
    ]

    res = await ss.generate_scene_prompts_ai(
        scenes,
        hero_lock="The main stick figure character",
        topic="Test Topic",
        base_url="https://fake.ai.com/v1",
        api_key="fake-key",
        model="fake-model",
    )

    # Must be exactly 1 call (single-shot full transcript)
    assert call_count == 1
    assert len(res) == 3
    assert res[0]["id"] == 1
    assert "standing in confusion" in res[0]["prompt"]
    assert "no text, no words, no letters" in res[0]["prompt"]
    assert res[1]["id"] == 2
    assert "reading a wise book" in res[1]["prompt"]
    assert res[2]["id"] == 3
    assert "nodding in agreement" in res[2]["prompt"]


@pytest.mark.asyncio
async def test_call_llm_completion_streaming():
    import agent.services.story_studio as ss
    import json

    class DummyStreamResponse:
        status_code = 200
        def raise_for_status(self): pass
        async def aiter_lines(self):
            lines = [
                'data: ' + json.dumps({"choices": [{"delta": {"content": '[{"id": 1, '}}]}),
                'data: ' + json.dumps({"choices": [{"delta": {"content": '"action": "test action"}]'}}]}),
                'data: [DONE]',
            ]
            for ln in lines:
                yield ln

    class DummyStreamingContext:
        async def __aenter__(self):
            return DummyStreamResponse()
        async def __aexit__(self, *args):
            pass

    class DummyClient:
        def stream(self, method, url, **kwargs):
            return DummyStreamingContext()

    client = DummyClient()
    out = await ss._call_llm_completion(client, "https://fake.url", {}, {"messages": []}, stream=True)
    assert out == '[{"id": 1, "action": "test action"}]'



