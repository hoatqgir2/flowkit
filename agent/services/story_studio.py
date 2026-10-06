"""Story Studio Service — Forgotten Civilizations & Doodle Story Pipeline.

Full workflow:
1. Character Reference (Hero Lock consistency).
2. Script Generation (2nd-person narrative, historical evidence, modern mirror).
3. TTS Audio Generation (Minimax T2A v2 / Speech-01, upload/custom audio).
4. Audio to Timestamped Transcript ([mm:ss] format).
5. Scene Image Prompts (2D doodle animation style with Hero Lock).
6. Video Assembly (Synchronized image chain + audio + optional subtitles via FFmpeg).
"""

import asyncio
import base64
import json
import logging
import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from agent.config import BASE_DIR, OUTPUT_DIR, GROQ_API_KEY, GROQ_BASE_URL, GROQ_WHISPER_MODEL
from agent.services.flow_client import get_flow_client

logger = logging.getLogger(__name__)

STORY_STUDIO_DIR = OUTPUT_DIR / "story_studio"
STORY_STUDIO_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_FILE = STORY_STUDIO_DIR / "projects.json"

DEFAULT_HERO_LOCK = "The main stick figure character from the reference image"

SYSTEM_PROMPT_CIVILIZATION = """
You are a viral educational documentary scriptwriter specializing in the ordinary daily life of forgotten and under-covered civilizations (hand-drawn doodle animation channel).
Format: Educational explainer narrated in calm, intelligent 2nd-person ("you", "your boat", "your field", "your market") — never "we" or "I".
Length: 600–1200 words.

Structure:
1. Hook: Drop viewer immediately into a sensory morning ("You wake to woodsmoke and river mud. No bell. No clock."). Name the place and the approximate year in the first two sentences.
2. Contrast: Contrast against what people think they know (temples, kings, treasure) and pivot to the ordinary worker.
3. Rhythm: Short sentence. Short sentence. One longer sentence that builds depth. Short sentence. A reflective question every 4–6 sentences.
4. Evidence Stack: Weave at least 3 real named historical sources (chronicles, inscriptions, archaeologists, excavation sites, travelogues).
5. Reconstruct one concrete workday: Morning to evening of a real role (salt trader, river pilot, potter, farmer, monsoon sailor).
6. Modern Mirror: Reflect the ancient workday back onto something the viewer does today (a commute, a meal, an alarm, a job you keep delaying leaving).
7. Conclusion: Close with a line that directly echoes the opening line, completely reframed.

Write PURE narration text only — NO stage directions, NO bracketed notes, NO headings, NO asterisks. Just pure voiceover narration text.
"""


def get_ffmpeg_path() -> str:
    """Find available ffmpeg binary."""
    # 1. Virtualenv Scripts
    venv_ffmpeg = BASE_DIR / "venv" / "Scripts" / "ffmpeg.exe"
    if venv_ffmpeg.exists():
        return str(venv_ffmpeg)
    
    # 2. System PATH
    found = shutil.which("ffmpeg")
    if found:
        return found
    
    # 3. static_ffmpeg python package if installed
    try:
        import static_ffmpeg
        static_ffmpeg.add_paths()
        found = shutil.which("ffmpeg")
        if found:
            return found
    except Exception:
        pass
    
    return "ffmpeg"


def get_project_dir(project_id: str) -> Path:
    pdir = STORY_STUDIO_DIR / project_id
    pdir.mkdir(parents=True, exist_ok=True)
    (pdir / "scenes").mkdir(parents=True, exist_ok=True)
    return pdir


def load_projects_index() -> List[Dict[str, Any]]:
    if not PROJECTS_FILE.exists():
        return []
    try:
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Failed to load story studio projects: %s", e)
        return []


def save_projects_index(projects: List[Dict[str, Any]]) -> None:
    try:
        with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
            json.dump(projects, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("Failed to save story studio projects: %s", e)


def get_project(project_id: str) -> Optional[Dict[str, Any]]:
    pdir = get_project_dir(project_id)
    pfile = pdir / "project.json"
    if pfile.exists():
        try:
            with open(pfile, "r", encoding="utf-8") as f:
                proj = json.load(f)

            needs_save = False
            # Auto-recover narration.mp3 if it exists on disk but audio_url is missing
            audio_file = pdir / "narration.mp3"
            if audio_file.exists() and not proj.get("audio_url"):
                proj["audio_url"] = f"/output/story_studio/{project_id}/narration.mp3?t={int(audio_file.stat().st_mtime)}"
                if not proj.get("audio_duration"):
                    proj["audio_duration"] = get_audio_duration(audio_file)
                proj["current_stage"] = max(proj.get("current_stage", 1), 3)
                needs_save = True

            # Auto-recover character_ref.png if it exists on disk but character_image_url is missing
            char_file = pdir / "character_ref.png"
            if char_file.exists() and not proj.get("character_image_url"):
                proj["character_image_url"] = f"/output/story_studio/{project_id}/character_ref.png?t={int(char_file.stat().st_mtime)}"
                needs_save = True

            # Auto-reconcile scene images and clear stuck/orphan 'generating' status
            scenes = proj.get("scenes", [])
            for sc in scenes:
                sc_id = sc.get("id")
                if not sc_id:
                    continue
                scene_file = pdir / "scenes" / f"scene_{sc_id:03d}.png"
                if scene_file.exists() and scene_file.stat().st_size > 1000:
                    if sc.get("status") != "completed" or not sc.get("image_url"):
                        sc["status"] = "completed"
                        sc["image_url"] = f"/output/story_studio/{project_id}/scenes/scene_{sc_id:03d}.png?t={int(scene_file.stat().st_mtime)}"
                        sc["error"] = None
                        needs_save = True
                elif sc.get("status") == "generating":
                    # File does not exist on disk, reset interrupted 'generating' to 'pending'
                    sc["status"] = "pending"
                    sc["error"] = None
                    needs_save = True

            if needs_save:
                save_project(proj)

            return proj
        except Exception as e:
            logger.error("Failed to read project %s: %s", project_id, e)
    return None


def save_project(project_data: Dict[str, Any]) -> Dict[str, Any]:
    project_id = project_data.get("id") or str(uuid.uuid4())
    project_data["id"] = project_id
    project_data["updated_at"] = time.time()
    if "created_at" not in project_data:
        project_data["created_at"] = time.time()

    pdir = get_project_dir(project_id)
    pfile = pdir / "project.json"
    with open(pfile, "w", encoding="utf-8") as f:
        json.dump(project_data, f, ensure_ascii=False, indent=2)

    # Update index
    index = load_projects_index()
    existing_idx = next((i for i, p in enumerate(index) if p["id"] == project_id), None)
    summary = {
        "id": project_id,
        "title": project_data.get("title", "Untitled Story"),
        "keyword": project_data.get("keyword", ""),
        "created_at": project_data["created_at"],
        "updated_at": project_data["updated_at"],
        "stage": project_data.get("current_stage", 1),
        "character_image_url": project_data.get("character_image_url", ""),
        "has_audio": bool(project_data.get("audio_url")),
        "scene_count": len(project_data.get("scenes", [])),
        "has_video": bool(project_data.get("video_url")),
    }
    if existing_idx is not None:
        index[existing_idx] = summary
    else:
        index.insert(0, summary)
    save_projects_index(index)
    return project_data


def delete_project(project_id: str) -> bool:
    pdir = STORY_STUDIO_DIR / project_id
    if pdir.exists():
        shutil.rmtree(pdir, ignore_errors=True)
    index = load_projects_index()
    new_index = [p for p in index if p["id"] != project_id]
    save_projects_index(new_index)
    return True


def get_audio_duration(file_path: Path) -> float:
    """Measure exact duration of an audio file in seconds via ffmpeg."""
    ffmpeg = get_ffmpeg_path()
    try:
        res = subprocess.run(
            [ffmpeg, "-i", str(file_path)],
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            timeout=10,
        )
        output = res.stderr
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", output)
        if m:
            hours, mins, secs = float(m.group(1)), float(m.group(2)), float(m.group(3))
            return hours * 3600 + mins * 60 + secs
    except Exception as e:
        logger.warning("Failed to inspect audio duration via ffmpeg: %s", e)
    return 60.0


# ── Stage 1: Character Reference ──────────────────────────────────────


async def save_character_reference(
    project_id: str,
    file_bytes: bytes,
    filename: str = "character_ref.png",
    hero_lock: str = "",
    flow_project_id: str = "",
) -> Dict[str, Any]:
    pdir = get_project_dir(project_id)
    ref_path = pdir / "character_ref.png"
    ref_path.write_bytes(file_bytes)

    rel_url = f"/output/story_studio/{project_id}/character_ref.png?t={int(time.time())}"
    media_id = None

    # Optionally upload to Google Flow to get media_id UUID
    client = get_flow_client()
    if client.connected:
        try:
            b64_data = base64.b64encode(file_bytes).decode("utf-8")
            ext = Path(filename).suffix.lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            flow_pid = flow_project_id or client.flow_project_id or ""
            upload_res = await client.upload_image(
                image_base64=b64_data,
                mime_type=mime,
                project_id=flow_pid,
                file_name=filename,
            )
            media_id = upload_res.get("_mediaId") or upload_res.get("data", {}).get("media", {}).get("name")
        except Exception as e:
            logger.warning("Upload character to Flow failed (non-fatal): %s", e)

    proj = get_project(project_id) or {"id": project_id}
    proj["character_image_url"] = rel_url
    if media_id:
        proj["character_media_id"] = media_id
    if hero_lock:
        proj["hero_lock"] = hero_lock
    if flow_project_id:
        proj["flow_project_id"] = flow_project_id
    save_project(proj)

    return {
        "character_image_url": rel_url,
        "character_media_id": media_id,
        "flow_project_id": proj.get("flow_project_id", ""),
        "hero_lock": proj.get("hero_lock", DEFAULT_HERO_LOCK),
    }


async def resync_character_reference(
    project_id: str,
    flow_project_id: str = "",
) -> Dict[str, Any]:
    """Re-upload the saved character reference image to the active Google Flow account.
    
    This is used when switching Google accounts due to quota/rate limits, to register
    the same hero reference image under the new account and obtain a fresh media_id UUID.
    """
    pdir = get_project_dir(project_id)
    ref_path = pdir / "character_ref.png"
    if not ref_path.exists():
        raise FileNotFoundError("Không tìm thấy ảnh tham chiếu gốc character_ref.png trên ổ đĩa.")

    file_bytes = ref_path.read_bytes()
    client = get_flow_client()
    if not client.connected:
        raise RuntimeError("Extension Chrome chưa kết nối. Hãy mở flow.google.com trên tài khoản mới.")

    proj = get_project(project_id) or {"id": project_id}
    effective_flow_pid = flow_project_id or proj.get("flow_project_id", "")
    if not effective_flow_pid:
        raise ValueError("Vui lòng nhập Google Flow Project ID của tài khoản mới (lấy từ URL flow.google.com/u/X/project/<UUID>).")

    b64_data = base64.b64encode(file_bytes).decode("utf-8")
    upload_res = await client.upload_image(
        image_base64=b64_data,
        mime_type="image/png",
        project_id=effective_flow_pid,
        file_name="character_ref.png",
    )

    if upload_res.get("status", 200) >= 400 or upload_res.get("error"):
        err = upload_res.get("error") or "Upload image to Flow failed"
        raise RuntimeError(f"Lỗi tải ảnh lên Google Flow mới: {err}")

    media_id = upload_res.get("_mediaId") or upload_res.get("data", {}).get("media", {}).get("name")
    if not media_id:
        raise RuntimeError("Không lấy được UUID media_id từ tài khoản Flow mới.")

    proj["character_media_id"] = media_id
    if flow_project_id:
        proj["flow_project_id"] = flow_project_id
    save_project(proj)

    # Reset any rate limit / unusual activity cooldown from the previous account
    client._generation_unusual_until = 0.0

    return {
        "ok": True,
        "character_media_id": media_id,
        "flow_project_id": proj.get("flow_project_id", ""),
        "message": f"Đã đồng bộ ảnh tham chiếu sang tài khoản Flow mới thành công! (UUID: {media_id})",
    }


# ── Stage 2: Script Generation (LLM) ──────────────────────────────────


async def generate_script(
    topic: str,
    provider: str = "demo",
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    custom_system_prompt: str = "",
) -> Dict[str, Any]:
    """Generate script matching the DNA of flow_nen_van_minh_bi_bo_quen.txt."""
    sys_prompt = custom_system_prompt or SYSTEM_PROMPT_CIVILIZATION
    user_prompt = f"Topic: {topic}\n\nPlease write the full viral educational narration script based on the guidelines."

    if provider == "openai" or (provider in ("openrouter", "groq", "custom") and api_key):
        burl = base_url or (
            "https://openrouter.ai/api/v1" if provider == "openrouter" else
            "https://api.groq.com/openai/v1" if provider == "groq" else
            "https://api.openai.com/v1"
        )
        mod = model or ("gpt-4o-mini" if provider == "openai" else "llama-3.3-70b-versatile" if provider == "groq" else "openai/gpt-4o-mini")
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f"{burl.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": mod,
                    "messages": [
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            script_text = data["choices"][0]["message"]["content"].strip()

    elif provider == "gemini" and api_key:
        mod = model or "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{mod}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                url,
                json={
                    "contents": [{"parts": [{"text": f"{sys_prompt}\n\n{user_prompt}"}]}],
                    "generationConfig": {"temperature": 0.7},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            script_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()

    elif provider == "claude" and api_key:
        mod = model or "claude-3-5-haiku-20241022"
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": mod,
                    "system": sys_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                    "max_tokens": 4096,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            script_text = data["content"][0]["text"].strip()

    else:
        # High-quality built-in demo script based on flow_nen_van_minh_bi_bo_quen.txt
        script_text = (
            f"You wake to woodsmoke and river mud. No bell. No clock.\n"
            f"You are on the Musi river, in Srivijaya. The year is about 700.\n"
            f"Most people think of lost kingdoms as towering stone temples and gold crowns. "
            f"That is not your life.\n"
            f"Your life is this small wooden boat, two paddle strokes wide.\n"
            f"Zhou Daguan and the Kedukan Bukit inscription tell us how this water kingdom moved. "
            f"George Coedès spent decades piecing together its ports.\n"
            f"Before the sun cuts the mist, you untie your line. Your child is still asleep under the palm thatch.\n"
            f"The morning market is already trading dried fish for salt blocks. "
            f"You steer into the current, watching the monsoon winds shift.\n"
            f"Is it courage that keeps you out here, or simply the rhythm of the tide?\n"
            f"You know every sandbar before the empire gave it a name.\n"
            f"By dusk, the water turns to brass. You bank the embers for the night.\n"
            f"Twelve centuries later, you open your laptop at a desk. You check an inbox before you have decided anything.\n"
            f"You wake to woodsmoke and river mud. Now you know the river never really stopped."
        )

    words = len(script_text.split())
    # Natural narration pace ~130-150 words per minute
    est_duration_s = round(words / 140 * 60, 1)

    return {
        "script": script_text,
        "word_count": words,
        "est_duration_seconds": est_duration_s,
    }


# ── Stage 3: Audio Generation (Minimax T2A v2) ────────────────────────


async def generate_minimax_audio(
    project_id: str,
    text: str,
    api_key: str,
    group_id: str = "",
    voice_id: str = "male-qn-qingse",
    model: str = "speech-02-turbo",
    speed: float = 1.0,
    pitch: float = 0,
    vol: float = 1.0,
) -> Dict[str, Any]:
    """Call Minimax T2A v2 API to synthesize narration audio."""
    if not api_key:
        raise ValueError("Minimax API Key is required")

    pdir = get_project_dir(project_id)
    audio_path = pdir / "narration.mp3"

    url = "https://api.minimax.io/v1/t2a_v2"
    if group_id:
        url += f"?GroupId={group_id}"

    payload = {
        "model": model or "speech-02-turbo",
        "text": text,
        "stream": False,
        "voice_setting": {
            "voice_id": voice_id or "male-qn-qingse",
            "speed": max(0.5, min(2.0, float(speed))),
            "vol": max(0.1, min(2.0, float(vol))),
            "pitch": int(pitch),
        },
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
    }

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Minimax API returned HTTP {resp.status_code}: {resp.text[:300]}")
        
        data = resp.json()

    base_resp = data.get("base_resp", {})
    if base_resp.get("status_code", 0) != 0:
        raise RuntimeError(f"Minimax Error: {base_resp.get('status_msg')} (Code {base_resp.get('status_code')})")

    audio_bytes = None
    if "audio_file" in data:
        raw = data["audio_file"]
        try:
            audio_bytes = base64.b64decode(raw)
        except Exception:
            audio_bytes = bytes.fromhex(raw)
    elif "data" in data and isinstance(data["data"], dict) and "audio" in data["data"]:
        audio_bytes = bytes.fromhex(data["data"]["audio"])

    if not audio_bytes:
        raise RuntimeError("No audio data found in Minimax response")

    audio_path.write_bytes(audio_bytes)
    duration = get_audio_duration(audio_path)
    rel_url = f"/output/story_studio/{project_id}/narration.mp3?t={int(time.time())}"

    proj = get_project(project_id) or {"id": project_id}
    proj["audio_url"] = rel_url
    proj["audio_duration"] = duration
    proj["tts_provider"] = "minimax"
    proj["tts_config"] = {
        "voice_id": voice_id,
        "model": model,
        "speed": speed,
    }
    proj["current_stage"] = max(proj.get("current_stage", 1), 3)
    save_project(proj)

    return {
        "audio_url": rel_url,
        "duration": duration,
        "file_size": len(audio_bytes),
    }


def save_custom_audio(project_id: str, file_bytes: bytes, filename: str) -> Dict[str, Any]:
    pdir = get_project_dir(project_id)
    audio_path = pdir / "narration.mp3"
    audio_path.write_bytes(file_bytes)
    duration = get_audio_duration(audio_path)
    rel_url = f"/output/story_studio/{project_id}/narration.mp3?t={int(time.time())}"

    proj = get_project(project_id) or {"id": project_id}
    proj["audio_url"] = rel_url
    proj["audio_duration"] = duration
    proj["tts_provider"] = "custom_upload"
    proj["current_stage"] = max(proj.get("current_stage", 1), 3)
    save_project(proj)

    return {"audio_url": rel_url, "duration": duration, "file_size": len(file_bytes)}


# ── Stage 4: Transcript Alignment [mm:ss] ─────────────────────────────


def parse_timestamp_str(ts_str: str) -> float:
    """Parse [m:ss] or [mm:ss] or [hh:mm:ss] to seconds."""
    clean = ts_str.strip().strip("[]()")
    parts = clean.split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    elif len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    return 0.0


def format_timestamp(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"[{m}:{s:02d}]"


async def transcribe_with_groq(
    project_id: str,
    api_key: str = "",
    model: str = "",
) -> List[Dict[str, Any]]:
    """Transcribe project narration audio via Groq Whisper API (whisper-large-v3) with exact timestamps."""
    pdir = get_project_dir(project_id)
    audio_path = pdir / "narration.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(f"Chưa tìm thấy file narration.mp3 trong dự án {project_id}. Hãy tạo hoặc tải lên audio ở Bước 3 trước.")

    key = (api_key or GROQ_API_KEY or "").strip()
    if not key:
        raise ValueError("Chưa có Groq API Key. Vui lòng thêm GROQ_API_KEY vào .env hoặc nhập trực tiếp.")

    whisper_model = model or GROQ_WHISPER_MODEL or "whisper-large-v3"
    url = f"{GROQ_BASE_URL.rstrip('/')}/audio/transcriptions"
    headers = {"Authorization": f"Bearer {key}"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(audio_path, "rb") as f:
            files = {"file": (audio_path.name, f, "audio/mpeg")}
            data = {
                "model": whisper_model,
                "response_format": "verbose_json",
                "timestamp_granularities[]": ["segment", "word"],
            }
            resp = await client.post(url, headers=headers, files=files, data=data)
            if resp.status_code != 200:
                raise RuntimeError(f"Groq Whisper API lỗi (HTTP {resp.status_code}): {resp.text[:300]}")
            result = resp.json()

    words = result.get("words", [])
    segments = result.get("segments", [])
    if not segments and not words:
        raise RuntimeError("Groq Whisper không trả về phân đoạn (segments) âm thanh nào.")

    proj = get_project(project_id) or {}
    script_text = proj.get("script_text", "").strip()
    dur = get_audio_duration(audio_path)
    items: List[Dict[str, Any]] = []

    # 1. If script exists, align each script sentence to exact Whisper word timestamps
    if script_text and words:
        text_clean = script_text.replace("\r\n", "\n")
        raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", text_clean)
        sentences = [s.strip() for s in raw_sentences if s.strip()]

        def clean_tok(w: str) -> str:
            return re.sub(r"[^\w]", "", w).lower()

        word_idx = 0
        for idx, s in enumerate(sentences):
            s_tokens = [clean_tok(w) for w in s.split() if clean_tok(w)]
            if not s_tokens:
                continue

            start_s = None
            end_s = None

            search_limit = min(len(words), word_idx + 80)
            for i in range(word_idx, search_limit):
                if clean_tok(words[i].get("word", "")) == s_tokens[0]:
                    check_len = min(len(s_tokens), 3)
                    matched = True
                    for k in range(check_len):
                        if i + k >= len(words) or clean_tok(words[i + k].get("word", "")) != s_tokens[k]:
                            matched = False
                            break
                    if matched:
                        start_s = round(float(words[i]["start"]), 2)
                        end_token_idx = min(len(words) - 1, i + len(s_tokens) - 1)
                        end_s = round(float(words[end_token_idx]["end"]), 2)
                        word_idx = i + len(s_tokens)
                        break

            items.append({
                "id": idx + 1,
                "timestamp_str": format_timestamp(start_s) if start_s is not None else "[--:--]",
                "start_s": start_s,
                "end_s": end_s,
                "duration": round(end_s - start_s, 2) if (start_s is not None and end_s is not None) else 3.0,
                "text": s,
            })

        # Interpolate any missing timestamps between known points
        for i in range(len(items)):
            if items[i]["start_s"] is None:
                prev_s = items[i - 1]["end_s"] if i > 0 and items[i - 1]["end_s"] is not None else 0.0
                next_s = None
                for j in range(i + 1, len(items)):
                    if items[j]["start_s"] is not None:
                        next_s = items[j]["start_s"]
                        break
                next_s = next_s or dur
                items[i]["start_s"] = round(prev_s, 2)
                items[i]["end_s"] = round(next_s, 2)
                items[i]["duration"] = round(max(1.0, items[i]["end_s"] - items[i]["start_s"]), 2)
                items[i]["timestamp_str"] = format_timestamp(items[i]["start_s"])

        # Contiguous alignment: link end_s to next start_s for smooth playback
        for i in range(len(items) - 1):
            items[i]["end_s"] = items[i + 1]["start_s"]
            items[i]["duration"] = round(items[i]["end_s"] - items[i]["start_s"], 2)

        if items:
            items[-1]["end_s"] = round(dur, 2)
            items[-1]["duration"] = round(max(1.0, items[-1]["end_s"] - items[-1]["start_s"]), 2)

    # 2. Fallback to Whisper's own segments if no script
    if not items and segments:
        for idx, seg in enumerate(segments):
            start_s = round(float(seg.get("start", 0.0)), 2)
            end_s = round(float(seg.get("end", start_s + 3.0)), 2)
            text = seg.get("text", "").strip()
            if not text:
                continue
            items.append({
                "id": idx + 1,
                "timestamp_str": format_timestamp(start_s),
                "start_s": start_s,
                "end_s": end_s,
                "duration": round(max(0.5, end_s - start_s), 2),
                "text": text,
            })
        for i in range(len(items) - 1):
            if items[i]["end_s"] < items[i + 1]["start_s"]:
                items[i]["end_s"] = items[i + 1]["start_s"]
                items[i]["duration"] = round(items[i]["end_s"] - items[i]["start_s"], 2)
        if items and dur > items[-1]["end_s"]:
            items[-1]["end_s"] = round(dur, 2)
            items[-1]["duration"] = round(items[-1]["end_s"] - items[-1]["start_s"], 2)

    return items


def parse_or_segment_transcript(
    script_text: str,
    audio_duration: float,
    raw_transcript: str = "",
) -> List[Dict[str, Any]]:
    """Parse pasted [mm:ss] text or auto-segment script over audio duration."""
    items: List[Dict[str, Any]] = []

    # 1. If user provided a raw transcript in [mm:ss] format (like transcript.txt)
    if raw_transcript and "[" in raw_transcript:
        lines = [ln.strip() for ln in raw_transcript.splitlines() if ln.strip()]
        for idx, line in enumerate(lines):
            m = re.match(r"^\[(\d+:\d{2}(?:\.\d+)?)\]\s*(.*)$", line)
            if m:
                ts_str = f"[{m.group(1)}]"
                start_s = parse_timestamp_str(m.group(1))
                text = m.group(2).strip()
                items.append({
                    "id": idx + 1,
                    "timestamp_str": ts_str,
                    "start_s": start_s,
                    "end_s": start_s + 3.0,  # tentative, will compute next
                    "text": text,
                })
        
        # Calculate end_s based on next start_s
        for i in range(len(items)):
            if i + 1 < len(items):
                items[i]["end_s"] = items[i + 1]["start_s"]
            else:
                items[i]["end_s"] = max(items[i]["start_s"] + 3.0, audio_duration or (items[i]["start_s"] + 4.0))

        if items:
            return items

    # 2. Auto-segment from script sentences & proportion over audio_duration
    text_clean = script_text.replace("\r\n", "\n")
    # Split by periods, exclamation marks, question marks, and clean double newlines
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", text_clean)
    sentences = [s.strip() for s in raw_sentences if s.strip()]

    if not sentences:
        return []

    dur = max(audio_duration, 10.0) if audio_duration else max(float(len(sentences) * 3.5), 15.0)
    total_words = sum(max(1, len(s.split())) for s in sentences)

    current_s = 0.0
    for idx, s in enumerate(sentences):
        words = max(1, len(s.split()))
        fraction = words / total_words
        seg_dur = max(1.5, fraction * dur)
        end_s = current_s + seg_dur
        if idx == len(sentences) - 1:
            end_s = max(end_s, dur)

        items.append({
            "id": idx + 1,
            "timestamp_str": format_timestamp(current_s),
            "start_s": round(current_s, 2),
            "end_s": round(end_s, 2),
            "duration": round(end_s - current_s, 2),
            "text": s,
        })
        current_s = end_s

    return items


# ── Stage 5: Scene Prompts & Image Generation ─────────────────────────


def build_scene_prompts(
    scenes: List[Dict[str, Any]],
    hero_lock: str = "",
    topic: str = "",
) -> List[Dict[str, Any]]:
    """Build high-consistency 2D doodle prompts per flow_nen_van_minh_bi_bo_quen.txt."""
    prefix = (
        "Hand-drawn 2D doodle cartoon animation, flat solid colors, "
        "bold black hand-drawn outlines, slightly wobbly imperfect marker lines, "
    )
    suffix = (
        ", same character design as the reference image, exactly preserving the character's facial features, hair style, hair color, and clothing from the reference image, "
        "do not redesign the character, do not change hair color or clothes, "
        "no blank background, "
        "no gradients, no drop shadows, no photographic textures, no photorealism, "
        "no 3D render, no realistic faces, no realistic skin, no anime, 16:9 widescreen, "
        "simple educational YouTube explainer doodle style."
    )

    # Clean hero anchor so it doesn't force conflicting hair/clothing
    hero_clean = (hero_lock or "").strip()
    if not hero_clean or ("dark brown hair" in hero_clean.lower() and "indigo tunic" in hero_clean.lower()):
        hero_anchor = "The main stick figure character from the reference image"
    else:
        hero_anchor = hero_clean

    enriched = []
    for item in scenes:
        txt = item["text"]
        
        # Translate transcript statement to a scene action without overriding appearance
        if any(w in txt.lower() for w in ["laptop", "desk", "inbox", "screen", "computer"]):
            action = f"{hero_anchor}, sitting at a minimalist modern wooden desk looking at a laptop with tired posture, cream background"
        elif any(w in txt.lower() for w in ["wake", "morning", "mud", "smoke"]):
            action = f"{hero_anchor}, waking up on a wooden floor inside a rustic stilt hut, rubbing eyes, river mist through window"
        elif any(w in txt.lower() for w in ["boat", "river", "paddle", "water", "current", "tide"]):
            action = f"{hero_anchor}, standing in a narrow wooden dugout boat holding a paddle, calm blue water and simple green trees"
        elif any(w in txt.lower() for w in ["market", "trade", "fish", "salt", "coin"]):
            action = f"{hero_anchor}, in a bustling open-air village market holding a clay jar, bundles of salt and dried fish on wooden mats"
        elif any(w in txt.lower() for w in ["temple", "ruin", "gold", "king", "treasure"]):
            action = f"{hero_anchor} standing in foreground, small stone temple ruin in background marked with a bold red hand-drawn X"
        elif any(w in txt.lower() for w in ["dusk", "night", "stars", "moon", "sleep", "dark"]):
            action = f"{hero_anchor}, resting by a small glowing campfire beside the river, dark navy night sky with a simple yellow crescent moon"
        else:
            action = f"{hero_anchor}, acting out scene: '{txt}', simple hand-drawn environment, bold flat color zones"

        full_prompt = f"{prefix}{action}{suffix}"
        enriched.append({
            **item,
            "prompt": full_prompt,
            "status": item.get("status", "pending"),
            "image_url": item.get("image_url", ""),
        })

    return enriched


async def generate_single_scene_image(
    project_id: str,
    scene_id: int,
    prompt: str,
    character_media_id: str = "",
    flow_project_id: str = "",
    image_model: str = "BELUGA",
    timeout_seconds: float = 60.0,
) -> Dict[str, Any]:
    """Generate image for a scene and save locally."""
    client = get_flow_client()
    if not client.connected:
        raise RuntimeError("Flow Extension is not connected. Open flow.google.com and connect extension.")

    proj = get_project(project_id) or {}
    pid = flow_project_id or proj.get("flow_project_id") or ""
    effective_char_id = character_media_id or proj.get("character_media_id", "")
    refs = [effective_char_id] if effective_char_id else []

    try:
        res = await asyncio.wait_for(
            client.generate_images(
                prompt=prompt,
                project_id=pid,
                character_media_ids=refs,
                aspect_ratio="IMAGE_ASPECT_RATIO_LANDSCAPE",
                image_model=image_model,
                count=1,
            ),
            timeout=float(timeout_seconds or 60.0),
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"Tạo ảnh cảnh {scene_id} quá {int(timeout_seconds)}s (Timeout) - coi như thất bại.")

    if res.get("status", 200) >= 400 or res.get("error"):
        err_msg = str(res.get("error") or res.get("data") or "Flow image generation failed")
        lower_err = err_msg.lower()
        if any(k in lower_err for k in ["quota", "limit", "429", "unusual", "exhausted", "paygate", "credit", "cooldown", "too many requests", "hết lượt"]):
            err_msg = f"[QUOTA_LIMIT] Tài khoản Google Flow đã chạm giới hạn quota hoặc rate limit ({err_msg}). Hãy chuyển sang tài khoản Google khác trên Chrome và bấm 'Đồng bộ tham chiếu sang Acc mới' để tiếp tục."
        raise RuntimeError(err_msg)

    media_list = res.get("data", {}).get("media", [])
    if not media_list:
        raise RuntimeError("No media returned by Flow generator")

    first_item = media_list[0]
    cdn_url = (
        first_item.get("url")
        or first_item.get("image", {}).get("generatedImage", {}).get("fifeUrl")
        or first_item.get("image", {}).get("fifeUrl")
        or first_item.get("fifeUrl")
    )
    if not cdn_url:
        logger.error("Failed to extract image url from Flow response: %s", res)
        raise RuntimeError(f"No image URL returned by Flow generator. Response: {first_item}")

    pdir = get_project_dir(project_id)
    scene_dir = pdir / "scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)
    local_path = scene_dir / f"scene_{scene_id:03d}.png"

    # Download to local disk for reliable video stitching
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http:
            img_resp = await http.get(cdn_url)
            if img_resp.status_code == 200:
                local_path.write_bytes(img_resp.content)
            else:
                logger.warning("Image download status %s for scene %s", img_resp.status_code, scene_id)
    except Exception as e:
        logger.warning("Could not cache image %s locally: %s", scene_id, e)

    local_url = f"/output/story_studio/{project_id}/scenes/scene_{scene_id:03d}.png?t={int(time.time())}"
    return {
        "scene_id": scene_id,
        "image_url": local_url if local_path.exists() else cdn_url,
        "cdn_url": cdn_url,
        "status": "completed",
    }


# ── Stage 6: Video Assembly (FFmpeg) ──────────────────────────────────


def format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def create_srt_file(scenes: List[Dict[str, Any]], srt_path: Path) -> None:
    lines = []
    for idx, sc in enumerate(scenes):
        start = format_srt_time(sc.get("start_s", 0.0))
        end = format_srt_time(sc.get("end_s", sc.get("start_s", 0.0) + 3.0))
        text = sc.get("text", "")
        lines.append(f"{idx + 1}\n{start} --> {end}\n{text}\n")
    srt_path.write_text("\n".join(lines), encoding="utf-8")


async def render_final_video(
    project_id: str,
    burn_subtitles: bool = True,
) -> Dict[str, Any]:
    """Assemble all scene images and audio into a final MP4."""
    pdir = get_project_dir(project_id)
    proj = get_project(project_id)
    if not proj:
        raise ValueError("Project not found")

    scenes = proj.get("scenes", [])
    if not scenes:
        raise ValueError("No scenes found to assemble")

    audio_file = pdir / "narration.mp3"
    if not audio_file.exists():
        raise ValueError("Audio narration file not found. Generate or upload audio first.")

    # Check that scenes have local images
    manifest_lines = ["ffconcat version 1.0"]
    for sc in scenes:
        sid = sc["id"]
        sc_img = pdir / "scenes" / f"scene_{sid:03d}.png"
        if not sc_img.exists():
            # If scene hasn't been generated, use character ref or create placeholder
            ref_img = pdir / "character_ref.png"
            if ref_img.exists():
                shutil.copyfile(ref_img, sc_img)
            else:
                raise ValueError(f"Scene {sid} has not been generated and no reference image exists.")

        dur = max(0.5, round(sc.get("end_s", sc.get("start_s", 0.0) + 3.0) - sc.get("start_s", 0.0), 2))
        # In ffconcat format: file path relative or safe absolute, then duration
        path_escaped = str(sc_img.resolve()).replace("\\", "/")
        manifest_lines.append(f"file '{path_escaped}'")
        manifest_lines.append(f"duration {dur}")

    # FFmpeg concat requires the last file to be repeated without duration
    last_img = pdir / "scenes" / f"scene_{scenes[-1]['id']:03d}.png"
    manifest_lines.append(f"file '{str(last_img.resolve()).replace(chr(92), '/')}'")

    manifest_path = pdir / "concat_manifest.txt"
    manifest_path.write_text("\n".join(manifest_lines), encoding="utf-8")

    output_video = pdir / "final_video.mp4"
    ffmpeg = get_ffmpeg_path()

    # Video filters
    vf_filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
        "format=yuv420p",
    ]

    if burn_subtitles:
        srt_file = pdir / "subtitles.srt"
        create_srt_file(scenes, srt_file)
        srt_escaped = str(srt_file.resolve()).replace("\\", "/").replace(":", "\\:")
        # Bold educational explainer subtitle styling
        sub_filter = (
            f"subtitles='{srt_escaped}':force_style="
            f"'FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Alignment=2,MarginV=45'"
        )
        vf_filters.append(sub_filter)

    cmd = [
        ffmpeg,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(manifest_path.resolve()),
        "-i", str(audio_file.resolve()),
        "-vf", ",".join(vf_filters),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-r", "24",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output_video.resolve()),
    ]

    logger.info("Rendering video via FFmpeg: %s", " ".join(cmd))
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore")
        logger.error("FFmpeg failed: %s", err_msg)
        raise RuntimeError(f"FFmpeg error: {err_msg[-400:]}")

    rel_video_url = f"/output/story_studio/{project_id}/final_video.mp4?t={int(time.time())}"
    video_size = output_video.stat().st_size if output_video.exists() else 0

    proj["video_url"] = rel_video_url
    proj["video_size"] = video_size
    proj["has_subtitles"] = burn_subtitles
    proj["current_stage"] = 6
    save_project(proj)

    return {
        "video_url": rel_video_url,
        "file_size": video_size,
        "duration": proj.get("audio_duration", 0),
    }
