"""FastAPI Router for Story Studio — Forgotten Civilizations & Doodle Video Studio."""

import shutil
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from agent.services import story_studio as ss
from agent.services import story_shorts as sshorts

router = APIRouter(prefix="/story-studio", tags=["story-studio"])


class CreateStoryProjectRequest(BaseModel):
    title: str = "New Forgotten Civilization Story"
    keyword: str = ""
    hero_lock: Optional[str] = None
    prompt_style: Optional[str] = "forgotten_civilizations"
    background_mode: Optional[str] = "dynamic"
    topic_requirements: Optional[str] = ""
    chaining_mode: Optional[bool] = False


class UpdateStoryProjectRequest(BaseModel):
    title: Optional[str] = None
    keyword: Optional[str] = None
    hero_lock: Optional[str] = None
    prompt_style: Optional[str] = None
    background_mode: Optional[str] = None
    topic_requirements: Optional[str] = None
    current_stage: Optional[int] = None
    chaining_mode: Optional[bool] = None


class GenerateScriptRequest(BaseModel):
    topic: str
    provider: str = "demo"  # "demo", "openai", "gemini", "claude", "openrouter", "groq", "custom"
    api_key: Optional[str] = ""
    model: Optional[str] = ""
    base_url: Optional[str] = ""
    custom_system_prompt: Optional[str] = None


class UpdateScriptRequest(BaseModel):
    script_text: str


class GenerateAudioRequest(BaseModel):
    provider: str = "minimax"
    api_key: str
    group_id: Optional[str] = ""
    voice_id: Optional[str] = "male-qn-qingse"
    model: Optional[str] = "speech-02-turbo"
    speed: Optional[float] = 1.0
    pitch: Optional[float] = 0
    vol: Optional[float] = 1.0


class TranscribeRequest(BaseModel):
    raw_transcript: Optional[str] = ""  # If user pastes [mm:ss] format
    method: Optional[str] = "groq"  # "groq" (Whisper Large V3) or "heuristic"
    groq_api_key: Optional[str] = ""
    whisper_model: Optional[str] = ""


class UpdateTranscriptRequest(BaseModel):
    scenes: List[Dict[str, Any]]


class UpdateSceneRequest(BaseModel):
    prompt: Optional[str] = None
    text: Optional[str] = None
    transition_type: Optional[str] = None
    source_scene_id: Optional[int] = None


class BuildPromptsRequest(BaseModel):
    hero_lock: Optional[str] = None
    style: Optional[str] = "forgotten_civilizations"
    use_ai: Optional[bool] = False
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    background_mode: Optional[str] = "dynamic"
    topic_requirements: Optional[str] = None
    chaining_mode: Optional[bool] = False


class GeneratePromptsAIRequest(BaseModel):
    style: Optional[str] = None
    hero_lock: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    batch_size: Optional[int] = 25
    scene_id: Optional[int] = None
    background_mode: Optional[str] = "dynamic"
    topic_requirements: Optional[str] = None
    script_text: Optional[str] = None
    chaining_mode: Optional[bool] = False


class GenerateSceneImageRequest(BaseModel):
    scene_id: int
    prompt: Optional[str] = None
    image_model: Optional[str] = "BELUGA"
    flow_project_id: Optional[str] = ""
    timeout_seconds: Optional[float] = 60.0
    transition_type: Optional[str] = None
    source_scene_id: Optional[int] = None


class RenderVideoRequest(BaseModel):
    burn_subtitles: bool = True
    ken_burns: Optional[bool] = True


class GenerateYoutubeMetadataRequest(BaseModel):
    language: Optional[str] = "en"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    custom_instructions: Optional[str] = None


class GenerateThumbnailRequest(BaseModel):
    prompt: str
    image_model: Optional[str] = "BELUGA"
    timeout_seconds: Optional[float] = 60.0
    flow_project_id: Optional[str] = None
    hook_text: Optional[str] = ""
    burn_text: Optional[bool] = False


class BurnThumbnailTextRequest(BaseModel):
    hook_text: Optional[str] = ""
    position: Optional[str] = "top_left"
    color: Optional[str] = "yellow"


class AnalyzeShortsRequest(BaseModel):
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    custom_instructions: Optional[str] = None


class RenderShortRequest(BaseModel):
    short_id: str
    layout_mode: Optional[str] = "stacked"
    burn_subtitles: Optional[bool] = False
    sfx_mode: Optional[str] = "none"


class BatchRenderShortsRequest(BaseModel):
    layout_mode: Optional[str] = "stacked"
    burn_subtitles: Optional[bool] = False
    sfx_mode: Optional[str] = "none"


# ── Project CRUD ─────────────────────────────────────────────────────


@router.get("/styles")
async def get_styles():
    """Get list of available doodle prompt styles with explanations."""
    return {"styles": ss.get_available_styles()}


@router.get("/projects")
async def list_projects():
    """List all Story Studio projects."""
    return {"projects": ss.load_projects_index()}


@router.post("/projects")
async def create_project(req: CreateStoryProjectRequest):
    """Create a new Story Studio project."""
    pid = str(uuid.uuid4())
    proj = {
        "id": pid,
        "title": req.title,
        "keyword": req.keyword,
        "current_stage": 1,
        "hero_lock": req.hero_lock or ss.DEFAULT_HERO_LOCK,
        "prompt_style": req.prompt_style or "forgotten_civilizations",
        "background_mode": req.background_mode or "dynamic",
        "topic_requirements": req.topic_requirements or "",
        "chaining_mode": bool(req.chaining_mode) if req.chaining_mode is not None else False,
        "scenes": [],
    }
    return ss.save_project(proj)


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get project details."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj


@router.patch("/projects/{project_id}")
@router.put("/projects/{project_id}")
async def update_project(project_id: str, req: UpdateStoryProjectRequest):
    """Update project metadata like title, keyword, prompt_style."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    if req.title is not None and req.title.strip():
        proj["title"] = req.title.strip()
    if req.keyword is not None:
        proj["keyword"] = req.keyword.strip()
    if req.prompt_style is not None and req.prompt_style.strip():
        proj["prompt_style"] = req.prompt_style.strip()
    if req.background_mode is not None and req.background_mode.strip():
        proj["background_mode"] = req.background_mode.strip()
    if req.topic_requirements is not None:
        proj["topic_requirements"] = req.topic_requirements.strip()
    if req.hero_lock is not None:
        proj["hero_lock"] = req.hero_lock
    if req.chaining_mode is not None:
        proj["chaining_mode"] = bool(req.chaining_mode)
    if req.current_stage is not None and req.current_stage >= 1:
        proj["current_stage"] = req.current_stage
    return ss.save_project(proj)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a Story Studio project."""
    proj = ss.get_project(project_id)
    pdir = ss.STORY_STUDIO_DIR / project_id
    index = ss.load_projects_index()
    in_index = any(p.get("id") == project_id for p in index)
    if not proj and not in_index and not pdir.exists():
        raise HTTPException(404, "Project not found")
    ok = ss.delete_project(project_id)
    return {"ok": ok, "id": project_id}


# ── Stage 1: Character Reference ──────────────────────────────────────


@router.post("/projects/{project_id}/character")
async def upload_character(
    project_id: str,
    file: UploadFile = File(...),
    hero_lock: Optional[str] = Form(None),
    flow_project_id: Optional[str] = Form(""),
):
    """Upload character reference image & define Hero Lock."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty image file")
    
    result = await ss.save_character_reference(
        project_id=project_id,
        file_bytes=content,
        filename=file.filename or "character.png",
        hero_lock=hero_lock or "",
        flow_project_id=flow_project_id or "",
    )
    return result


class ResyncCharacterRequest(BaseModel):
    flow_project_id: Optional[str] = ""


@router.post("/projects/{project_id}/resync-character")
async def resync_character(project_id: str, req: ResyncCharacterRequest):
    """Re-sync saved character reference image to the active Google Flow account/project."""
    try:
        return await ss.resync_character_reference(
            project_id=project_id,
            flow_project_id=req.flow_project_id or "",
        )
    except Exception as e:
        raise HTTPException(502, f"Đồng bộ tham chiếu thất bại: {e}")


@router.put("/projects/{project_id}/hero-lock")
async def update_hero_lock(project_id: str, body: Dict[str, str]):
    """Update hero lock definition."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    proj["hero_lock"] = body.get("hero_lock", ss.DEFAULT_HERO_LOCK)
    return ss.save_project(proj)


# ── Stage 2: Script Generation ────────────────────────────────────────


@router.post("/projects/{project_id}/generate-script")
async def generate_script_endpoint(project_id: str, req: GenerateScriptRequest):
    """Generate script matching forgotten civilizations DNA."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    
    try:
        res = await ss.generate_script(
            topic=req.topic,
            provider=req.provider,
            api_key=req.api_key or "",
            model=req.model or "",
            base_url=req.base_url or "",
            custom_system_prompt=req.custom_system_prompt or "",
        )
    except Exception as e:
        raise HTTPException(500, f"Script generation failed: {e}")

    proj["script_text"] = res["script"]
    proj["word_count"] = res["word_count"]
    proj["est_duration_seconds"] = res["est_duration_seconds"]
    proj["keyword"] = req.topic
    proj["current_stage"] = max(proj.get("current_stage", 1), 2)
    ss.save_project(proj)
    return res


@router.put("/projects/{project_id}/script")
async def update_script(project_id: str, req: UpdateScriptRequest):
    """Update script text directly."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    proj["script_text"] = req.script_text
    proj["word_count"] = len(req.script_text.split())
    proj["est_duration_seconds"] = round(proj["word_count"] / 140 * 60, 1)
    proj["current_stage"] = max(proj.get("current_stage", 1), 2)
    return ss.save_project(proj)


# ── Stage 3: Audio Generation (Minimax Audio) ─────────────────────────


@router.post("/projects/{project_id}/generate-audio")
async def generate_audio_endpoint(project_id: str, req: GenerateAudioRequest):
    """Call Minimax T2A v2 to synthesize speech."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    
    script = proj.get("script_text")
    if not script:
        raise HTTPException(400, "Project has no script yet. Generate or write script first.")

    try:
        res = await ss.generate_minimax_audio(
            project_id=project_id,
            text=script,
            api_key=req.api_key,
            group_id=req.group_id or "",
            voice_id=req.voice_id or "male-qn-qingse",
            model=req.model or "speech-02-turbo",
            speed=req.speed or 1.0,
            pitch=req.pitch or 0,
            vol=req.vol or 1.0,
        )
        return res
    except Exception as e:
        raise HTTPException(502, f"Minimax TTS error: {e}")


@router.post("/projects/{project_id}/upload-audio")
async def upload_audio_endpoint(project_id: str, file: UploadFile = File(...)):
    """Upload custom narration audio file."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty audio file")
    
    res = ss.save_custom_audio(project_id, content, file.filename or "audio.mp3")
    return res


# ── Stage 4: Timestamped Transcript ───────────────────────────────────


@router.post("/projects/{project_id}/transcribe")
async def transcribe_endpoint(project_id: str, req: TranscribeRequest):
    """Segment script into [mm:ss] timestamped scenes via Groq Whisper AI or pasted transcript."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    scenes = []
    # 1. If manual raw transcript is provided
    if req.raw_transcript and "[" in req.raw_transcript:
        scenes = ss.parse_or_segment_transcript(
            script_text=proj.get("script_text", ""),
            audio_duration=proj.get("audio_duration", 0.0),
            raw_transcript=req.raw_transcript,
        )
    # 2. If Groq Whisper is requested (default)
    elif req.method != "heuristic":
        try:
            scenes = await ss.transcribe_with_groq(
                project_id=project_id,
                api_key=req.groq_api_key or "",
                model=req.whisper_model or "",
            )
        except Exception as e:
            # Fall back to heuristic if script exists, otherwise raise
            if proj.get("script_text"):
                scenes = ss.parse_or_segment_transcript(
                    script_text=proj.get("script_text", ""),
                    audio_duration=proj.get("audio_duration", 0.0),
                )
            else:
                raise HTTPException(502, f"Lỗi Groq Whisper: {e}")
    else:
        # Heuristic fallback
        scenes = ss.parse_or_segment_transcript(
            script_text=proj.get("script_text", ""),
            audio_duration=proj.get("audio_duration", 0.0),
        )

    # Automatically build 2D doodle prompts with Hero Lock & selected style
    hero_lock = proj.get("hero_lock") or ss.DEFAULT_HERO_LOCK
    prompt_style = proj.get("prompt_style") or "forgotten_civilizations"
    background_mode = proj.get("background_mode") or "dynamic"
    scenes = ss.build_scene_prompts(
        scenes,
        hero_lock,
        proj.get("keyword", ""),
        style=prompt_style,
        background_mode=background_mode,
    )

    proj["scenes"] = scenes
    proj["prompt_style"] = prompt_style
    proj["background_mode"] = background_mode
    proj["current_stage"] = max(proj.get("current_stage", 1), 4)
    ss.save_project(proj)
    return {"scenes": scenes, "count": len(scenes)}


@router.put("/projects/{project_id}/transcript")
async def update_transcript_endpoint(project_id: str, req: UpdateTranscriptRequest):
    """Update scenes list with edited text/timestamps."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    proj["scenes"] = req.scenes
    return ss.save_project(proj)


@router.patch("/projects/{project_id}/scenes/{scene_id}")
@router.put("/projects/{project_id}/scenes/{scene_id}")
async def update_scene_endpoint(project_id: str, scene_id: int, req: UpdateSceneRequest):
    """Update an individual scene's prompt or transcript text."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    scenes = proj.get("scenes", [])
    target = next((s for s in scenes if s["id"] == scene_id), None)
    if not target:
        raise HTTPException(404, f"Scene #{scene_id} not found")

    if req.prompt is not None:
        target["prompt"] = req.prompt.strip()
    if req.text is not None:
        target["text"] = req.text.strip()
    if req.transition_type is not None:
        target["transition_type"] = req.transition_type
    if req.source_scene_id is not None:
        target["source_scene_id"] = req.source_scene_id

    ss.save_project(proj)
    return {"ok": True, "scene": target}


# ── Stage 5: Scene Prompts & Image Generation ─────────────────────────


@router.post("/projects/{project_id}/build-prompts")
async def build_prompts_endpoint(project_id: str, req: BuildPromptsRequest):
    """Rebuild doodle prompts for all scenes with selected style (rule-based or AI)."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    prompt_style = req.style or proj.get("prompt_style") or "forgotten_civilizations"
    hero_lock = req.hero_lock or proj.get("hero_lock") or ss.DEFAULT_HERO_LOCK
    topic = proj.get("title") or proj.get("keyword") or ""
    background_mode = req.background_mode or proj.get("background_mode") or "dynamic"
    topic_requirements = req.topic_requirements if req.topic_requirements is not None else proj.get("topic_requirements", "")
    full_script = (proj.get("script_text") or "").strip()
    chaining_mode = bool(req.chaining_mode) if req.chaining_mode is not None else bool(proj.get("chaining_mode", False))

    if req.use_ai:
        scenes = await ss.generate_scene_prompts_ai(
            proj.get("scenes", []),
            hero_lock=hero_lock,
            topic=topic,
            style=prompt_style,
            base_url=req.base_url or "",
            api_key=req.api_key or "",
            model=req.model or "",
            background_mode=background_mode,
            topic_requirements=topic_requirements,
            full_script=full_script,
            chaining_mode=chaining_mode,
        )
    else:
        scenes = ss.build_scene_prompts(
            proj.get("scenes", []),
            hero_lock,
            proj.get("keyword", ""),
            style=prompt_style,
            background_mode=background_mode,
            topic_requirements=topic_requirements,
        )

    proj["scenes"] = scenes
    proj["hero_lock"] = hero_lock
    proj["prompt_style"] = prompt_style
    proj["background_mode"] = background_mode
    proj["topic_requirements"] = topic_requirements
    proj["chaining_mode"] = chaining_mode
    proj["current_stage"] = max(proj.get("current_stage", 1), 5)
    ss.save_project(proj)
    return {
        "scenes": scenes,
        "prompt_style": prompt_style,
        "background_mode": background_mode,
        "topic_requirements": topic_requirements,
        "chaining_mode": chaining_mode,
    }


@router.post("/projects/{project_id}/generate-prompts-ai")
async def generate_prompts_ai_endpoint(project_id: str, req: GeneratePromptsAIRequest):
    """Generate intelligent 2D doodle prompts using OpenAI-compatible LLM."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    prompt_style = req.style or proj.get("prompt_style") or "brain_psychology"
    hero_lock = req.hero_lock or proj.get("hero_lock") or ss.DEFAULT_HERO_LOCK
    topic = proj.get("title") or proj.get("keyword") or ""
    background_mode = req.background_mode or proj.get("background_mode") or "dynamic"
    topic_requirements = req.topic_requirements if req.topic_requirements is not None else proj.get("topic_requirements", "")
    full_script = (req.script_text or "").strip() or (proj.get("script_text") or "").strip()
    chaining_mode = bool(req.chaining_mode) if req.chaining_mode is not None else bool(proj.get("chaining_mode", False))

    all_scenes = proj.get("scenes", [])
    if req.scene_id is not None:
        target_scenes = [s for s in all_scenes if s.get("id") == req.scene_id]
        if not target_scenes:
            raise HTTPException(404, f"Scene #{req.scene_id} not found")
        updated = await ss.generate_scene_prompts_ai(
            all_scenes,
            hero_lock=hero_lock,
            topic=topic,
            style=prompt_style,
            base_url=req.base_url or "",
            api_key=req.api_key or "",
            model=req.model or "",
            batch_size=1,
            background_mode=background_mode,
            topic_requirements=topic_requirements,
            full_script=full_script,
            target_scene_id=req.scene_id,
            chaining_mode=chaining_mode,
        )
        if updated:
            new_target = next((s for s in updated if s.get("id") == req.scene_id), None)
            if new_target:
                for s in all_scenes:
                    if s.get("id") == req.scene_id:
                        s["prompt"] = new_target["prompt"]
                        if "transition_type" in new_target:
                            s["transition_type"] = new_target["transition_type"]
                        if "source_scene_id" in new_target:
                            s["source_scene_id"] = new_target["source_scene_id"]
                        break
        scenes = all_scenes
    else:
        scenes = await ss.generate_scene_prompts_ai(
            all_scenes,
            hero_lock=hero_lock,
            topic=topic,
            style=prompt_style,
            base_url=req.base_url or "",
            api_key=req.api_key or "",
            model=req.model or "",
            batch_size=req.batch_size or 25,
            background_mode=background_mode,
            topic_requirements=topic_requirements,
            full_script=full_script,
            chaining_mode=chaining_mode,
        )

    proj["scenes"] = scenes
    proj["hero_lock"] = hero_lock
    proj["prompt_style"] = prompt_style
    proj["background_mode"] = background_mode
    proj["topic_requirements"] = topic_requirements
    proj["chaining_mode"] = chaining_mode
    proj["current_stage"] = max(proj.get("current_stage", 1), 5)
    ss.save_project(proj)
    return {
        "scenes": scenes,
        "prompt_style": prompt_style,
        "background_mode": background_mode,
        "topic_requirements": topic_requirements,
        "chaining_mode": chaining_mode,
        "count": len(scenes),
    }


@router.post("/projects/{project_id}/generate-scene-image")
async def generate_scene_image_endpoint(project_id: str, req: GenerateSceneImageRequest):
    """Generate image for one specific scene using character reference."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    scenes = proj.get("scenes", [])
    target = next((s for s in scenes if s["id"] == req.scene_id), None)
    if not target:
        raise HTTPException(404, f"Scene {req.scene_id} not found")

    prompt = req.prompt or target.get("prompt")
    if not prompt:
        raise HTTPException(400, "Scene has no prompt")
    target["prompt"] = prompt

    if req.transition_type is not None:
        target["transition_type"] = req.transition_type
    if req.source_scene_id is not None:
        target["source_scene_id"] = req.source_scene_id

    trans_type = target.get("transition_type")
    src_id = target.get("source_scene_id")

    # If this scene is hold_frame and we already have source scene image locally, copy directly (instant ~5ms)
    if trans_type == "hold_frame" and src_id:
        src_scene = next((s for s in scenes if s.get("id") == src_id), None)
        pdir = ss.get_project_dir(project_id)
        scene_dir = pdir / "scenes"
        src_file = scene_dir / f"scene_{src_id:03d}.png"
        target_file = scene_dir / f"scene_{req.scene_id:03d}.png"
        if src_file.exists():
            shutil.copy2(src_file, target_file)
            local_url = f"/output/story_studio/{project_id}/scenes/scene_{req.scene_id:03d}.png?t={int(time.time())}"
            target["image_url"] = local_url
            target["cdn_url"] = (src_scene or {}).get("cdn_url", local_url)
            target["media_id"] = (src_scene or {}).get("media_id", "")
            target["status"] = "completed"
            target["watermark_removed"] = (src_scene or {}).get("watermark_removed", False)
            target["error"] = None
            proj["current_stage"] = max(proj.get("current_stage", 1), 5)
            ss.save_project(proj)
            return {
                "scene_id": req.scene_id,
                "image_url": local_url,
                "cdn_url": target["cdn_url"],
                "media_id": target["media_id"],
                "status": "completed",
                "hold_frame": True,
            }

    base_media_id = ""
    if trans_type == "inherit_edit" and src_id:
        src_scene = next((s for s in scenes if s.get("id") == src_id), None)
        if src_scene and src_scene.get("media_id"):
            base_media_id = src_scene.get("media_id")

    if req.flow_project_id and req.flow_project_id != proj.get("flow_project_id"):
        proj["flow_project_id"] = req.flow_project_id

    target["status"] = "generating"
    ss.save_project(proj)

    try:
        res = await ss.generate_single_scene_image(
            project_id=project_id,
            scene_id=req.scene_id,
            prompt=prompt,
            character_media_id=proj.get("character_media_id", ""),
            flow_project_id=req.flow_project_id or proj.get("flow_project_id", ""),
            image_model=req.image_model or "BELUGA",
            timeout_seconds=float(req.timeout_seconds or 60.0),
            base_media_id=base_media_id,
        )
        target["image_url"] = res["image_url"]
        target["cdn_url"] = res["cdn_url"]
        target["media_id"] = res.get("media_id", "")
        target["status"] = "completed"
        target["watermark_removed"] = False
        target["error"] = None
        proj["current_stage"] = max(proj.get("current_stage", 1), 5)
        ss.save_project(proj)
        return res
    except Exception as e:
        target["status"] = "failed"
        target["error"] = str(e)
        ss.save_project(proj)
        raise HTTPException(502, f"Image generation failed: {e}")


@router.post("/projects/{project_id}/scenes/{scene_id}/remove-watermark")
async def remove_scene_watermark_endpoint(project_id: str, scene_id: int):
    """Remove Gemini watermark from a single scene image."""
    try:
        return ss.remove_scene_watermark(project_id, scene_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Watermark removal failed: {e}")


@router.post("/projects/{project_id}/remove-watermark-all")
async def remove_all_watermarks_endpoint(project_id: str):
    """Remove Gemini watermark from all completed scene images in the project."""
    try:
        return ss.remove_all_scene_watermarks(project_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Batch watermark removal failed: {e}")


@router.post("/projects/{project_id}/clear-images")
async def clear_all_images_endpoint(project_id: str):
    """Delete all generated scene image files and reset scene statuses to pending."""
    try:
        return ss.clear_all_scene_images(project_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Clear images failed: {e}")


# ── Stage 6: Video Assembly ───────────────────────────────────────────


@router.post("/projects/{project_id}/render-video")
async def render_video_endpoint(project_id: str, req: RenderVideoRequest):
    """Assemble scenes and audio into a final video with FFmpeg."""
    try:
        res = await ss.render_final_video(
            project_id=project_id,
            burn_subtitles=req.burn_subtitles,
            ken_burns=bool(req.ken_burns) if req.ken_burns is not None else True,
        )
        return res
    except Exception as e:
        raise HTTPException(500, f"Video render failed: {e}")


# ── Stage 7: Viral YouTube SEO & Thumbnail Kit ─────────────────────────


@router.post("/projects/{project_id}/youtube-metadata")
async def generate_youtube_metadata_endpoint(project_id: str, req: GenerateYoutubeMetadataRequest):
    """Generate viral YouTube titles, description with chapters, tags, and thumbnail concepts."""
    try:
        return await ss.generate_youtube_metadata_ai(
            project_id=project_id,
            language=req.language or "vi",
            base_url=req.base_url or "",
            api_key=req.api_key or "",
            model=req.model or "",
            custom_instructions=req.custom_instructions or "",
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"YouTube metadata generation failed: {e}")


@router.post("/projects/{project_id}/generate-thumbnail")
async def generate_thumbnail_endpoint(project_id: str, req: GenerateThumbnailRequest):
    """Generate YouTube thumbnail image via Google Flow with Hero Lock, watermark removal, and bold hook typography."""
    try:
        return await ss.generate_thumbnail_image(
            project_id=project_id,
            prompt=req.prompt,
            image_model=req.image_model or "BELUGA",
            timeout_seconds=float(req.timeout_seconds or 60.0),
            flow_project_id=req.flow_project_id or "",
            hook_text=req.hook_text or "",
            burn_text=bool(req.burn_text) if req.burn_text is not None else True,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Thumbnail generation failed: {e}")


@router.post("/projects/{project_id}/remove-thumbnail-watermark")
async def remove_thumbnail_watermark_endpoint(project_id: str):
    """Remove watermark from the project's generated thumbnail image file."""
    try:
        return ss.remove_thumbnail_watermark(project_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Watermark removal failed: {e}")


@router.post("/projects/{project_id}/burn-thumbnail-text")
async def burn_thumbnail_text_endpoint(project_id: str, req: BurnThumbnailTextRequest):
    """Overlay large bold hook typography onto project thumbnail image."""
    try:
        return ss.burn_thumbnail_text(
            project_id=project_id,
            text=req.hook_text or "",
            position=req.position or "top_left",
            color=req.color or "yellow",
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Burn text failed: {e}")


# ── Stage 8: Auto AI Shorts Extractor (Voice + SFX) ───────────────────


@router.post("/projects/{project_id}/shorts/analyze")
async def analyze_shorts_endpoint(project_id: str, req: AnalyzeShortsRequest):
    """Scan project transcript and scenes to identify 2-4 viral short candidates."""
    try:
        candidates = await sshorts.analyze_shorts_candidates_ai(
            project_id=project_id,
            base_url=req.base_url or "",
            api_key=req.api_key or "",
            model=req.model or "",
            custom_instructions=req.custom_instructions or "",
        )
        return {"candidates": candidates}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Shorts analysis failed: {e}")


@router.post("/projects/{project_id}/shorts/render")
async def render_short_endpoint(project_id: str, req: RenderShortRequest):
    """Render a single 9:16 short with Clean Voice-Only (or optional soft ding) and Stacked layout."""
    try:
        res = await sshorts.render_single_short(
            project_id=project_id,
            short_id=req.short_id,
            layout_mode=req.layout_mode or "stacked",
            burn_subtitles=bool(req.burn_subtitles) if req.burn_subtitles is not None else False,
            sfx_mode=req.sfx_mode or "none",
        )
        return res
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Render short failed: {e}")


@router.post("/projects/{project_id}/shorts/batch-render")
async def batch_render_shorts_endpoint(project_id: str, req: BatchRenderShortsRequest):
    """Batch render all available short candidates for a project."""
    try:
        results = await sshorts.batch_render_all_shorts(
            project_id=project_id,
            layout_mode=req.layout_mode or "stacked",
            burn_subtitles=bool(req.burn_subtitles) if req.burn_subtitles is not None else False,
            sfx_mode=req.sfx_mode or "none",
        )
        return {"shorts": results}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Batch render shorts failed: {e}")


@router.get("/projects/{project_id}/shorts")
async def get_project_shorts_endpoint(project_id: str):
    """Get all candidates and rendered shorts for a project."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return {
        "candidates": proj.get("shorts_candidates", []),
        "shorts": proj.get("shorts", []),
    }


@router.delete("/projects/{project_id}/shorts/{short_id}")
async def delete_project_short_endpoint(project_id: str, short_id: str):
    """Delete a rendered short file and record."""
    success = sshorts.delete_project_short(project_id, short_id)
    if not success:
        raise HTTPException(404, "Short not found or project missing")
    return {"status": "deleted", "short_id": short_id}



