"""FastAPI Router for Story Studio — Forgotten Civilizations & Doodle Video Studio."""

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from agent.services import story_studio as ss

router = APIRouter(prefix="/story-studio", tags=["story-studio"])


class CreateStoryProjectRequest(BaseModel):
    title: str = "New Forgotten Civilization Story"
    keyword: str = ""
    hero_lock: Optional[str] = None
    prompt_style: Optional[str] = "forgotten_civilizations"


class UpdateStoryProjectRequest(BaseModel):
    title: Optional[str] = None
    keyword: Optional[str] = None
    hero_lock: Optional[str] = None
    prompt_style: Optional[str] = None


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


class BuildPromptsRequest(BaseModel):
    hero_lock: Optional[str] = None
    style: Optional[str] = "forgotten_civilizations"


class GenerateSceneImageRequest(BaseModel):
    scene_id: int
    prompt: Optional[str] = None
    image_model: Optional[str] = "BELUGA"
    flow_project_id: Optional[str] = ""
    timeout_seconds: Optional[float] = 60.0


class RenderVideoRequest(BaseModel):
    burn_subtitles: bool = True


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
    if req.hero_lock is not None:
        proj["hero_lock"] = req.hero_lock
    return ss.save_project(proj)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a Story Studio project."""
    proj = ss.get_project(project_id)
    if not proj:
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
    scenes = ss.build_scene_prompts(scenes, hero_lock, proj.get("keyword", ""), style=prompt_style)

    proj["scenes"] = scenes
    proj["prompt_style"] = prompt_style
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


# ── Stage 5: Scene Prompts & Image Generation ─────────────────────────


@router.post("/projects/{project_id}/build-prompts")
async def build_prompts_endpoint(project_id: str, req: BuildPromptsRequest):
    """Rebuild doodle prompts for all scenes with selected style."""
    proj = ss.get_project(project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    prompt_style = req.style or proj.get("prompt_style") or "forgotten_civilizations"
    hero_lock = req.hero_lock or proj.get("hero_lock") or ss.DEFAULT_HERO_LOCK
    scenes = ss.build_scene_prompts(proj.get("scenes", []), hero_lock, proj.get("keyword", ""), style=prompt_style)
    proj["scenes"] = scenes
    proj["hero_lock"] = hero_lock
    proj["prompt_style"] = prompt_style
    proj["current_stage"] = max(proj.get("current_stage", 1), 5)
    ss.save_project(proj)
    return {"scenes": scenes, "prompt_style": prompt_style}


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
        )
        target["image_url"] = res["image_url"]
        target["cdn_url"] = res["cdn_url"]
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


# ── Stage 6: Video Assembly ───────────────────────────────────────────


@router.post("/projects/{project_id}/render-video")
async def render_video_endpoint(project_id: str, req: RenderVideoRequest):
    """Assemble scenes and audio into a final video with FFmpeg."""
    try:
        res = await ss.render_final_video(
            project_id=project_id,
            burn_subtitles=req.burn_subtitles,
        )
        return res
    except Exception as e:
        raise HTTPException(500, f"Video render failed: {e}")
