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

from agent.config import (
    BASE_DIR,
    OUTPUT_DIR,
    GROQ_API_KEY,
    GROQ_BASE_URL,
    GROQ_WHISPER_MODEL,
    STORY_AI_BASE_URL,
    STORY_AI_API_KEY,
    STORY_AI_MODEL,
)
from agent.services.flow_client import get_flow_client

logger = logging.getLogger(__name__)

STORY_STUDIO_DIR = OUTPUT_DIR / "story_studio"
STORY_STUDIO_DIR.mkdir(parents=True, exist_ok=True)
PROJECTS_FILE = STORY_STUDIO_DIR / "projects.json"
CHANNELS_DIR = STORY_STUDIO_DIR / "channels"
CHANNELS_DIR.mkdir(parents=True, exist_ok=True)
CHANNELS_FILE = STORY_STUDIO_DIR / "channels.json"

DEFAULT_HERO_LOCK = "The main stick figure character from the reference image"

STYLES_REGISTRY: Dict[str, Dict[str, Any]] = {
    "forgotten_civilizations": {
        "id": "forgotten_civilizations",
        "name": "Nền Văn Minh Bị Bỏ Quên (Mặc định)",
        "short_desc": "Đời thường cổ đại, sông nước, chợ làng, đền đài gạch chéo đỏ",
        "description_vi": "Phong cách hoạt hình doodle 2D vẽ tay tái hiện đời thường cổ đại (chèo thuyền độc mộc trên sông, chợ búa trao đổi muối/cá, lò gốm, nhà sàn gỗ, đền đài bị gạch chéo đỏ X để xóa bỏ ảo tưởng hoàng gia). Nhân vật khóa chuẩn theo ảnh tham chiếu, tông màu đất, nước, trời tự nhiên.",
        "default_hero_lock": "The main stick figure character from the reference image",
        "default_topic_requirements": (
            "- Setting & Environment: Rustic stilt wooden huts, gentle river mist at dawn, narrow wooden dugout boats with paddles on calm river water.\n"
            "- Daily life: Bustling open-air village markets with clay pottery jars, bundles of salt and dried fish on wooden mats, lush green countryside rice fields.\n"
            "- Signature devices: Ancient stone temple ruins crossed out with a bold RED hand-drawn X to debunk myths of royal palaces; evening campfire beside river under crescent moon."
        ),
    },
    "ancient_humans": {
        "id": "ancient_humans",
        "name": "Con Người Cổ Đại & Tiến Hóa (Ancient Humans)",
        "short_desc": "Doodle tiền sử, thảo nguyên savanna, tảng đá dán nhãn, lửa trại bộ lạc",
        "description_vi": "Phong cách doodle 2D chuẩn Ancient Humans về con người tiền sử, tiến hóa và sinh tồn. Nhân vật que đầu tròn tóc cam nhọn đặc trưng (#F58220) hoặc người tiền sử tóc nâu xù. Đặc trưng: tảng đá dán nhãn chữ trắng ALL-CAPS (SURVIVAL), thảo nguyên savanna cây keo lẻ loi, mây mưa khó khăn, lửa trại bộ lạc, nhà khảo cổ nón cối, dấu X đỏ phủ định quan niệm sai.",
        "default_hero_lock": "The main stick figure character from the reference image with spiky bright orange hair",
        "default_topic_requirements": (
            "- Setting & Environment: Prehistoric savanna landscape with warm orange/tan sky, tan dirt ground with small grass tufts and lone flat acacia tree in distance; outdoor daytime light blue sky and tan ground.\n"
            "- Character rules: The main 'you' figure has spiky bright orange hair (#F58220); early ancestral humans have shaggy messy brown hair; modern figures have a bald round white head.\n"
            "- Signature devices (Ancient Humans Framework):\n"
            "  * Primitive wooden spear held with determined gritted-teeth expression when hunting or facing predators.\n"
            "  * Huge dark gray boulder with bold white ALL-CAPS hand-lettered label 'SURVIVAL' for abstract survival concepts.\n"
            "  * Friendly small tribe of stick figures sitting in a circle around crackling orange campfire.\n"
            "  * Explorer/archaeologist stick figure wearing brown pith helmet, backpack, holding glowing yellow lantern beside dark brown cave entrance.\n"
            "  * Hardship / pain: sad stick figure curled up hugging knees under flat dark gray rain cloud pouring blue raindrops.\n"
            "  * Negation / myth: confident figure or concept illustration crossed out with a big bold RED hand-drawn X across the frame ('wrong / not this').\n"
            "  * Milestone text frame: plain cream background with bold red ALL-CAPS text (e.g. '300,000 YEARS')."
        ),
    },
    "brain_psychology": {
        "id": "brain_psychology",
        "name": "Tâm Lý Học Não Bộ (Why Your Brain Ignores Advice)",
        "short_desc": "Doodle tâm lý học, não bộ hồng 2D ngộ nghĩnh, lời khuyên bị phớt lờ, thiên kiến nhận thức",
        "description_vi": "Phong cách hoạt hình doodle 2D chuyên đề Tâm lý học & Khoa học Hành vi (Psychology & Behavioral Neuroscience). Nhân vật que tối giản tương tác cùng bộ não hoạt hình 2D màu hồng pastel/san hô với biểu cảm ngộ nghĩnh (bối rối, lười biếng, hoảng sợ), người que bịt tai phớt lờ loa phóng thanh lời khuyên, đám mây suy nghĩ rối như tơ vò, bẫy dopamine lướt điện thoại, ngã rẽ thói quen và các thí nghiệm tâm lý với dấu X đỏ phủ định.",
        "default_hero_lock": "The main minimalist stick figure character from the reference image with a round white head",
        "default_topic_requirements": (
            "- Setting & Characters: Minimalist stick figures with round white head; modern relatable settings (minimalist desk with laptop, dark bedroom, fork in the road).\n"
            "- Signature devices:\n"
            "  * Person covering both ears turning away from a loud red megaphone shouting advice.\n"
            "  * Dark bedroom at night: lying in bed under blankets with glowing blue smartphone screen and thumb scrolling.\n"
            "  * Ego defense: hastily building a defensive cartoon brick wall in front of self and peeking over top.\n"
            "  * Tangled dark scribble yarn cloud floating over head for overthinking or anxiety.\n"
            "  * Cute small 2D flat pink cartoon brain character for specific neuroscience gags.\n"
            "  * Big bold RED hand-drawn X across false myths and cognitive biases."
        ),
    },
}


def get_available_styles() -> List[Dict[str, Any]]:
    """Return all supported doodle styles with descriptions."""
    return list(STYLES_REGISTRY.values())

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

SYSTEM_PROMPT_PSYCHOLOGY = """
You are a viral educational documentary scriptwriter specializing in psychology, cognitive biases, neuroscience, and human behavioral science (in the style of "Why your brain ignores good advice").
Format: Educational explainer narrated in calm, intelligent 2nd-person ("you", "your brain", "your ego", "your limbic system") — never "we" or "I".
Length: 600–1200 words.

Structure:
1. Hook: Drop viewer immediately into a relatable behavioral contradiction ("Someone gives you genuinely great advice. You nod. You agree completely. And then you do the exact opposite.").
2. The Core Mechanism: Explain why the brain treats good advice as a threat (psychological reactance, ego defense, cognitive dissonance, dopamine anticipation vs delayed reward).
3. Rhythm: Short sentence. Short sentence. One longer sentence that builds depth. Short sentence. A reflective question every 4–6 sentences.
4. Evidence Stack: Weave at least 3 real named psychological experiments, researchers, or concepts (Jack Brehm 1966 reactance theory, Leon Festinger cognitive dissonance, Daniel Kahneman, dopamine loops).
5. Concrete Everyday Mirror: Reconstruct a common everyday struggle (doomscrolling at midnight instead of sleeping, ignoring financial or health advice, staying in comfort zones).
6. Twist & Resolution: Refocus the struggle — it is not a lack of willpower, it is an evolutionary survival mechanism misfiring in the modern world.
7. Closing line: Directly echoes the opening hook with a profound reframe.

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


def get_channel_dir(channel_id: str) -> Path:
    safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in channel_id)
    cdir = CHANNELS_DIR / safe_name
    cdir.mkdir(parents=True, exist_ok=True)
    return cdir


def load_channels_index() -> List[Dict[str, Any]]:
    if not CHANNELS_FILE.exists():
        return ensure_default_channels_and_migration()
    try:
        with open(CHANNELS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not raw:
            return ensure_default_channels_and_migration()
        valid = []
        for ch in raw:
            cid = ch.get("id")
            if cid and (CHANNELS_DIR / cid / "channel.json").exists():
                valid.append(ch)
        if not valid:
            return ensure_default_channels_and_migration()
        return valid
    except Exception as e:
        logger.error("Failed to load story studio channels: %s", e)
        return ensure_default_channels_and_migration()


def save_channels_index(channels: List[Dict[str, Any]]) -> None:
    try:
        with open(CHANNELS_FILE, "w", encoding="utf-8") as f:
            json.dump(channels, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("Failed to save channels index: %s", e)


def get_channel(channel_id: str) -> Optional[Dict[str, Any]]:
    cdir = get_channel_dir(channel_id)
    cfile = cdir / "channel.json"
    if cfile.exists():
        try:
            with open(cfile, "r", encoding="utf-8") as f:
                ch = json.load(f)
            projects = load_projects_index()
            ch_projects = [p for p in projects if p.get("channel_id") == channel_id]
            ch["video_count"] = len(ch_projects)
            char_file = cdir / "character_ref.png"
            if char_file.exists():
                ch.setdefault("character_settings", {})
                ch["character_settings"]["character_image_url"] = f"/output/story_studio/channels/{channel_id}/character_ref.png?t={int(char_file.stat().st_mtime)}"
            return ch
        except Exception as e:
            logger.error("Failed to read channel %s: %s", channel_id, e)
    return None


def save_channel(channel_data: Dict[str, Any]) -> Dict[str, Any]:
    channel_id = channel_data.get("id")
    if not channel_id:
        channel_id = f"channel_{uuid.uuid4().hex[:8]}"
        channel_data["id"] = channel_id
    channel_data["updated_at"] = time.time()
    if "created_at" not in channel_data:
        channel_data["created_at"] = time.time()

    cdir = get_channel_dir(channel_id)
    cfile = cdir / "channel.json"
    with open(cfile, "w", encoding="utf-8") as f:
        json.dump(channel_data, f, ensure_ascii=False, indent=2)

    try:
        all_projs = load_projects_index()
        video_count = sum(1 for p in all_projs if p.get("channel_id") == channel_id)
    except Exception:
        video_count = channel_data.get("video_count", 0)

    index = [c for c in load_channels_index() if c["id"] != channel_id]
    summary = {
        "id": channel_id,
        "name": channel_data.get("name", "Untitled Channel"),
        "handle": channel_data.get("handle", ""),
        "title_prefix": channel_data.get("title_prefix", ""),
        "description": channel_data.get("description", ""),
        "niche": channel_data.get("niche", "brain_psychology"),
        "character_image_url": channel_data.get("character_settings", {}).get("character_image_url", ""),
        "hero_lock": channel_data.get("character_settings", {}).get("hero_lock", ""),
        "video_count": video_count,
        "created_at": channel_data["created_at"],
        "updated_at": channel_data["updated_at"],
    }
    index.append(summary)
    save_channels_index(index)
    return channel_data


def delete_channel(channel_id: str, delete_projects: bool = False) -> bool:
    cdir = CHANNELS_DIR / channel_id
    if cdir.exists():
        shutil.rmtree(cdir, ignore_errors=True)
    index = [c for c in load_channels_index() if c["id"] != channel_id]
    save_channels_index(index)
    if delete_projects:
        projects = load_projects_index()
        for p in projects:
            if p.get("channel_id") == channel_id:
                delete_project(p["id"])
    return True


def upload_channel_character(channel_id: str, file_bytes: bytes, filename: str = "character_ref.png") -> Dict[str, Any]:
    cdir = get_channel_dir(channel_id)
    char_file = cdir / "character_ref.png"
    with open(char_file, "wb") as f:
        f.write(file_bytes)
    ch = get_channel(channel_id) or {"id": channel_id}
    ch.setdefault("character_settings", {})
    ts = int(time.time())
    url = f"/output/story_studio/channels/{channel_id}/character_ref.png?t={ts}"
    ch["character_settings"]["character_image_url"] = url
    save_channel(ch)
    return {"ok": True, "url": url}


def ensure_default_channels_and_migration() -> List[Dict[str, Any]]:
    """Initialize default Channel 1 (Psychology) and Channel 2 (Ancient Humans),
    and auto-migrate existing projects by matching 'K1' and 'K2' titles.
    """
    default_channels = [
        {
            "id": "channel_k1",
            "name": "Kênh 1 — Tâm Lý Học & Não Bộ (Brain Psychology)",
            "handle": "@BrainPsychologyExplained",
            "title_prefix": "K1-p - ",
            "description": "Kênh hoạt hình 2D doodle giải mã thiên kiến nhận thức, tâm lý học hành vi và cạm bẫy não bộ hiện đại.",
            "niche": "brain_psychology",
            "character_settings": {
                "character_image_url": "/output/story_studio/channels/channel_k1/character_ref.png",
                "character_media_id": "",
                "flow_project_id": "",
                "hero_lock": "The main minimalist stick figure character from the reference image with a round white head",
            },
            "prompt_templates": {
                "prompt_style": "brain_psychology",
                "background_mode": "dynamic",
                "scene_prefix": "Hand-drawn 2D doodle cartoon animation, flat solid colors, bold black hand-drawn outlines, slightly wobbly imperfect marker lines, minimalist style, ",
                "scene_suffix_no_text": ", same character design as the reference image, preserving character facial features and minimalist stick figure body, do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, no photorealism, no 3D render, no CGI, no realistic shading, 16:9 widescreen, simple educational YouTube explainer doodle style.",
                "scene_suffix_concept_card": ", centered single bold red hand-lettered keyword text on plain background only, no subtitles, no paragraphs, no extra words, no gradients, no photographic textures, 16:9 widescreen, simple educational YouTube explainer doodle style.",
                "topic_requirements": STYLES_REGISTRY.get("brain_psychology", {}).get("default_topic_requirements", ""),
                "ai_director_system_prompt": "",
                "script_system_prompt": "",
            },
            "thumbnail_templates": {
                "prefix": "YouTube high-CTR thumbnail, 16:9 aspect ratio, 2D minimalist doodle style, bold contrasting colors, ",
                "suffix": ", same character design as the reference image, extremely expressive facial expression, uncluttered composition, eye-catching visual paradox, no small text, high resolution",
            },
            "tts_preset": {
                "provider": "minimax",
                "voice_id": "male-qn-qingse",
                "model": "speech-02-turbo",
                "speed": 1.05,
            },
            "browser_profile": {
                "profile_dir": "output/story_studio/browser_profiles/channel_k1",
                "proxy": None,
                "last_opened_at": None,
            },
        },
        {
            "id": "channel_k2",
            "name": "Kênh 2 — Con Người Cổ Đại & Sinh Tồn (Ancient Humans)",
            "handle": "@AncientHumansExplained",
            "title_prefix": "K2-p - ",
            "description": "Kênh hoạt hình 2D doodle về nguồn gốc nhân loại, tiến hóa sinh tồn và nhân chủng học tiền sử.",
            "niche": "ancient_humans",
            "character_settings": {
                "character_image_url": "/output/story_studio/channels/channel_k2/character_ref.png",
                "character_media_id": "",
                "flow_project_id": "",
                "hero_lock": "The main stick figure character from the reference image with spiky bright orange hair",
            },
            "prompt_templates": {
                "prompt_style": "ancient_humans",
                "background_mode": "dynamic",
                "scene_prefix": "Hand-drawn 2D doodle cartoon animation, flat solid colors, bold black hand-drawn outlines, slightly wobbly imperfect marker lines, minimalist style, ",
                "scene_suffix_no_text": ", same character design as the reference image, preserving character facial features and hair style, do not redesign the character, do not change hair color or clothes, no text, no words, no letters, no subtitles, no speech bubbles, no captions, no blank background, no photorealism, no 3D render, no CGI, no realistic shading, 16:9 widescreen, simple educational YouTube explainer doodle style.",
                "scene_suffix_concept_card": ", centered single bold red hand-lettered keyword text on plain background only, no subtitles, no paragraphs, no extra words, no gradients, no photographic textures, 16:9 widescreen, simple educational YouTube explainer doodle style.",
                "topic_requirements": STYLES_REGISTRY.get("ancient_humans", {}).get("default_topic_requirements", ""),
                "ai_director_system_prompt": "",
                "script_system_prompt": "",
            },
            "thumbnail_templates": {
                "prefix": "YouTube high-CTR thumbnail, 16:9 aspect ratio, 2D minimalist doodle style, bold contrasting colors, ",
                "suffix": ", same character design as the reference image with spiky bright orange hair, extremely expressive facial expression, eye-catching visual paradox, high resolution",
            },
            "tts_preset": {
                "provider": "minimax",
                "voice_id": "male-qn-qingse",
                "model": "speech-02-turbo",
                "speed": 1.0,
            },
            "browser_profile": {
                "profile_dir": "output/story_studio/browser_profiles/channel_k2",
                "proxy": None,
                "last_opened_at": None,
            },
        },
    ]

    index = []
    for ch_data in default_channels:
        cid = ch_data["id"]
        cdir = get_channel_dir(cid)
        cfile = cdir / "channel.json"
        
        if not (cdir / "character_ref.png").exists():
            candidate_pids = []
            if cid == "channel_k1":
                candidate_pids = ["6f197433-e252-4a4b-89cf-ea90ced9addc", "970fb0bb-7caf-464b-a02e-a7c5429ed272", "dca6c023-5ffc-48d3-b3dd-c294de74bf2a"]
            else:
                candidate_pids = ["3b3b3318-c6b3-40c9-b490-a99ea8d52b96", "1f8a31f7-9b9b-4b53-8ea4-5b2a77cee3e3", "2db7990d-8d58-471b-9f32-349308d55da3"]
            for pid in candidate_pids:
                p_char = STORY_STUDIO_DIR / pid / "character_ref.png"
                if p_char.exists():
                    try:
                        shutil.copy2(p_char, cdir / "character_ref.png")
                        break
                    except Exception:
                        pass

        char_file = cdir / "character_ref.png"
        if char_file.exists():
            ch_data["character_settings"]["character_image_url"] = f"/output/story_studio/channels/{cid}/character_ref.png?t={int(char_file.stat().st_mtime)}"
        
        ch_data["created_at"] = time.time()
        ch_data["updated_at"] = time.time()
        with open(cfile, "w", encoding="utf-8") as f:
            json.dump(ch_data, f, ensure_ascii=False, indent=2)

        index.append({
            "id": cid,
            "name": ch_data["name"],
            "handle": ch_data["handle"],
            "title_prefix": ch_data["title_prefix"],
            "description": ch_data["description"],
            "niche": ch_data["niche"],
            "character_image_url": ch_data["character_settings"]["character_image_url"],
            "hero_lock": ch_data["character_settings"]["hero_lock"],
            "video_count": 0,
            "created_at": ch_data["created_at"],
            "updated_at": ch_data["updated_at"],
        })
    save_channels_index(index)

    if PROJECTS_FILE.exists():
        try:
            with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
                projs = json.load(f)
            updated_projs = []
            for p in projs:
                pid = p.get("id")
                title = p.get("title", "")
                assigned_cid = "channel_k2" if "K2" in title.upper() else "channel_k1"
                p["channel_id"] = assigned_cid
                updated_projs.append(p)

                pfile = STORY_STUDIO_DIR / pid / "project.json"
                if pfile.exists():
                    try:
                        with open(pfile, "r", encoding="utf-8") as pf:
                            p_data = json.load(pf)
                        p_data["channel_id"] = assigned_cid
                        with open(pfile, "w", encoding="utf-8") as pf:
                            json.dump(p_data, pf, ensure_ascii=False, indent=2)
                    except Exception:
                        pass
            save_projects_index(updated_projs)
            
            for idx_ch in index:
                c_cnt = sum(1 for p in updated_projs if p.get("channel_id") == idx_ch["id"])
                idx_ch["video_count"] = c_cnt
                ch_obj = get_channel(idx_ch["id"])
                if ch_obj:
                    ch_obj["video_count"] = c_cnt
                    save_channel(ch_obj)
            save_channels_index(index)
        except Exception as e:
            logger.error("Failed to migrate projects to channels: %s", e)

    return index


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
            raw_projects = json.load(f)
        valid_projects = []
        needs_prune = False
        for p in raw_projects:
            pid = p.get("id")
            if pid and (STORY_STUDIO_DIR / pid / "project.json").exists():
                if not p.get("channel_id"):
                    t = (p.get("title") or "").upper()
                    p["channel_id"] = "channel_k2" if "K2" in t else "channel_k1"
                    needs_prune = True
                valid_projects.append(p)
            else:
                needs_prune = True
        if needs_prune:
            save_projects_index(valid_projects)
        return valid_projects
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
            # Auto-assign channel_id if missing
            if not proj.get("channel_id"):
                t = (proj.get("title") or "").upper()
                proj["channel_id"] = "channel_k2" if "K2" in t else "channel_k1"
                needs_save = True

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

    if "channel_id" not in project_data:
        title = project_data.get("title", "")
        project_data["channel_id"] = "channel_k2" if "K2" in title.upper() else "channel_k1"

    pdir = get_project_dir(project_id)
    pfile = pdir / "project.json"
    with open(pfile, "w", encoding="utf-8") as f:
        json.dump(project_data, f, ensure_ascii=False, indent=2)

    # Update index
    index = load_projects_index()
    existing_idx = next((i for i, p in enumerate(index) if p["id"] == project_id), None)
    summary = {
        "id": project_id,
        "channel_id": project_data.get("channel_id", "channel_k1"),
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
    """Generate script matching the DNA of the chosen genre."""
    is_psychology = any(w in topic.lower() for w in ["brain", "psychology", "advice", "bias", "behavior", "habit"])
    sys_prompt = custom_system_prompt or (SYSTEM_PROMPT_PSYCHOLOGY if is_psychology else SYSTEM_PROMPT_CIVILIZATION)
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
        # High-quality built-in demo script
        if is_psychology:
            script_text = (
                f"Someone gives you genuinely great advice. You nod. You agree completely. And then you do the exact opposite.\n"
                f"Why does your brain treat sound advice like a threat?\n"
                f"Psychologists call the first culprit psychological reactance. When someone tells you what to do, your brain hears a threat to your freedom.\n"
                f"Jack Brehm discovered this back in 1966. The moment an option is pushed on you, your instinct is to push right back.\n"
                f"The second culprit is cognitive dissonance. Admitting that someone else's advice is right often means admitting that your past choices were wrong.\n"
                f"Your ego hates that. It would rather defend a painful mistake than admit a simple truth.\n"
                f"And then there is the dopamine trap. Good advice asks you to sacrifice comfort now for a reward in three months.\n"
                f"Your ancient limbic system didn't evolve for three months from now. It evolved to survive the next ten minutes.\n"
                f"So tonight, when you hear that quiet voice telling you to put the phone down and go to sleep, watch what happens.\n"
                f"You agree completely. And then your thumb keeps scrolling.\n"
                f"Now you know: it was never a lack of discipline. It was your brain protecting itself from the wrong kind of danger."
            )
        else:
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


def _extract_milestone_label(txt: str) -> str:
    """Extract a clean uppercase English label for milestone concept frames."""
    m_years = re.search(r"\b(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(years?)\b", txt, re.IGNORECASE)
    if m_years:
        return f"{m_years.group(1)} {m_years.group(2).upper()}"
    m_num = re.search(r"\b(\d{3,4})\b", txt)
    if m_num:
        return f"AROUND {m_num.group(1)}"
    m_cen = re.search(r"(\d+)(?:st|nd|rd|th)?\s*century", txt.lower())
    if m_cen:
        return f"{m_cen.group(1)}TH CENTURY"
    return "CHRONICLE"


def build_scene_prompts(
    scenes: List[Dict[str, Any]],
    hero_lock: str = "",
    topic: str = "",
    style: str = "forgotten_civilizations",
    background_mode: str = "dynamic",
    topic_requirements: str = "",
    custom_prefix: Optional[str] = None,
    custom_suffix_no_text: Optional[str] = None,
    custom_suffix_concept: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Build high-consistency 2D doodle prompts with strict text control (100% English prompts)."""
    style_key = style.lower().strip() if style else "forgotten_civilizations"
    if any(w in style_key for w in ["brain", "advice", "psychology"]):
        style_key = "brain_psychology"
    elif any(w in style_key for w in ["ancient", "human"]):
        style_key = "ancient_humans"
    elif style_key not in STYLES_REGISTRY:
        style_key = "forgotten_civilizations"

    prefix = custom_prefix if (custom_prefix and custom_prefix.strip()) else (
        "Hand-drawn 2D doodle cartoon animation, flat solid colors, "
        "bold black hand-drawn outlines, slightly wobbly imperfect marker lines, "
    )

    hero_clean = (hero_lock or "").strip()

    if style_key == "brain_psychology":
        suffix_no_text = custom_suffix_no_text if (custom_suffix_no_text and custom_suffix_no_text.strip()) else (
            ", same character design as the reference image, preserving facial features and minimalist stick figure body, "
            "do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )
        suffix_emphasis_text = custom_suffix_concept if (custom_suffix_concept and custom_suffix_concept.strip()) else (
            ", same character design as the reference image, preserving facial features and minimalist stick figure body, "
            "do not redesign the character, single bold keyword on object only, no subtitles, no paragraph text, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )
        if not hero_clean or ("dark brown hair" in hero_clean.lower() and "indigo tunic" in hero_clean.lower()) or "orange hair" in hero_clean.lower():
            hero_anchor = "The main stick figure character from the reference image with a round white head"
        else:
            hero_anchor = hero_clean

        enriched = []
        for item in scenes:
            txt = item["text"]
            txt_lower = txt.lower()

            # Selective concept emphasis (single bold red keyword only when defining a concept or key term)
            matched_term = None
            psych_terms = [
                ("reactance", "REACTANCE"),
                ("cognitive dissonance", "COGNITIVE DISSONANCE"),
                ("status quo", "STATUS QUO BIAS"),
                ("loss aversion", "LOSS AVERSION"),
                ("confirmation bias", "CONFIRMATION BIAS"),
                ("dopamine", "DOPAMINE"),
                ("ego trap", "EGO TRAP"),
                ("bias", "BIAS"),
            ]
            for kw, term_label in psych_terms:
                if kw in txt_lower and any(w in txt_lower for w in ["call", "culprit", "term", "trap", "phenomenon", "known as"]) and len(txt.split()) <= 15:
                    matched_term = term_label
                    break

            is_stat_or_year = any(w in txt_lower for w in ["percent", "1966", "1970"]) and any(c.isdigit() for c in txt) and len(txt.split()) <= 10

            current_suffix = suffix_no_text

            # 1. Concept definition card (only when explicitly naming a term)
            if matched_term:
                action = f"Plain cream background with a gray ground strip, {hero_anchor} standing beside a clean minimalist concept card with a single bold RED hand-lettered term '{matched_term}', educational psychology frame"
                current_suffix = suffix_emphasis_text

            # 2. Historical year / statistic card
            elif is_stat_or_year:
                label = _extract_milestone_label(txt)
                action = f"Plain cream background with a gray ground strip, {hero_anchor} standing beside a bold RED hand-lettered text '{label}', minimal educational psychology card"
                current_suffix = suffix_emphasis_text

            # 3. Endless thumb scrolling (high priority specific action)
            elif any(w in txt_lower for w in ["thumb", "keeps scrolling", "scrolling", "doomscroll", "feed"]):
                action = f"Close-up shot of {hero_anchor}'s cartoon stick figure hands holding a glowing phone, thumb flicking upward repeatedly in an endless scrolling motion, glowing screen"

            # 4. Ego defense / Brick wall (prioritize over general 'admit')
            elif any(w in txt_lower for w in ["ego", "pride", "defend a painful", "defend", "simple truth"]):
                action = f"{hero_anchor} hastily stacking a defensive cartoon brick wall in front of themselves, peeking over the top with a stubborn defensive frown, plain cream background"

            # 5. Ancient survival / Limbic instinct (prioritize over 'three months')
            elif any(w in txt_lower for w in ["ancient", "evolve", "limbic", "ten minutes", "predator", "wild"]):
                action = f"An early ancestral human stick figure running swiftly through tall savanna grass under a hot sun, looking over shoulder alert for wild beasts, dynamic prehistoric survival atmosphere"

            # 6. Late night bedroom / Phone struggle
            elif any(w in txt_lower for w in ["put the phone down", "go to sleep", "tonight", "quiet voice", "bedtime", "lights out"]):
                action = f"{hero_anchor} lying in bed under blankets in a dark bedroom at night, face illuminated by the bright blue glow of a smartphone screen held in hands, plain navy-dark background"

            # 7. Threat to freedom & barriers
            elif any(w in txt_lower for w in ["freedom", "told what to do", "threat to freedom", "control", "forced"]):
                action = f"{hero_anchor} backing away defensively with hands raised, breaking away from cartoon wooden fence barriers trying to enclose their space, plain cream background"

            # 8. Pushing back / Rebellion against pressure
            elif any(w in txt_lower for w in ["push back", "push right back", "pushed on you", "instinct to push", "resist"]):
                action = f"{hero_anchor} with a determined gritted-teeth expression leaning forward and shoving a heavy wooden crate back with two hands, stubborn resistance, plain cream background"

            # 9. Ears covered / Ignoring advice
            elif any(w in txt_lower for w in ["ignore", "deaf", "cover your ears", "cover ears", "plug your ears", "refuse to listen"]):
                action = f"{hero_anchor} looking stubborn with hands tightly covering both ears, turning away from a large red megaphone mounted on a stand shouting soundwave symbols, plain cream background"

            # 10. Giving / receiving advice & polite agreement
            elif any(w in txt_lower for w in ["giving advice", "gives you", "friend tells", "recommend", "nod", "agree"]):
                action = f"Two minimalist stick figures standing in friendly conversation, one person earnestly offering a helpful book while {hero_anchor} nods along politely with an agreeable smile, plain cream background"

            # 11. Doing the opposite / Defiance
            elif any(w in txt_lower for w in ["opposite", "exact opposite", "contrary", "turn around"]):
                action = f"{hero_anchor} abruptly turning on heel and marching in the exact opposite direction of a directional signpost, walking away with a determined mischievous posture, plain cream background"

            # 12. Admitting past mistakes / Regret (toy blocks)
            elif any(w in txt_lower for w in ["admit", "past choices", "past mistake", "were wrong", "regret", "fault"]):
                action = f"{hero_anchor} looking back over shoulder with a bashful hand scratching neck, at a messy trail of knocked-over cartoon toy blocks on the ground, plain cream background"

            # 13. Comfort now vs future reward (couch vs calendar)
            elif any(w in txt_lower for w in ["comfort now", "reward in", "three months", "sacrifice comfort", "delayed reward"]):
                action = f"Side-by-side comparison frame: on the left {hero_anchor} lounging on a soft cozy sofa with snacks, on the right a distant mountain path with a flip calendar pointing to the future, plain cream background"

            # 14. Relief / Self-compassion / Epiphany
            elif any(w in txt_lower for w in ["now you know", "lack of discipline", "discipline", "protecting itself", "wrong kind of danger", "relief"]):
                action = f"{hero_anchor} taking a deep relaxing breath with closed peaceful eyes, dropping a heavy cartoon sack off shoulders onto the ground, peaceful warm lighting, plain cream background"

            # 15. Phone / Screen distraction
            elif any(w in txt_lower for w in ["phone", "screen", "social media", "notification", "app"]):
                action = f"{hero_anchor} sitting cross-legged staring in a trance at a glowing smartphone screen with thumb scrolling, tiny floating notification icons, plain cream background"

            # 16. Threat perception / Defensive block
            elif "threat" in txt_lower or ("brain" in txt_lower and any(w in txt_lower for w in ["treat", "hear", "see", "react", "danger"])):
                action = f"{hero_anchor} standing defensive with wide alert eyes, raising arms to block an incoming friendly advice envelope as if it were a flying arrow, plain cream background"

            # 16. Sleep / Alarm clock / Procrastination
            elif any(w in txt_lower for w in ["sleep", "bed", "blanket", "morning", "night", "alarm", "clock", "procrastinat", "lazy", "delay", "tomorrow"]):
                action = f"{hero_anchor} wrapped up like a burrito in a blue blanket lying flat on a mattress looking guilty, a ringing red alarm clock on the side table, plain cream background"

            # 18. Fork in the road / Choice
            elif any(w in txt_lower for w in ["choice", "choose", "decision", "fork", "path", "dilemma", "direction", "two options"]):
                action = f"{hero_anchor} standing at a fork in the road with two diverging dirt paths, scratching head with a confused spiral question mark expression, plain cream background"

            # 19. Overthinking / Anxiety
            elif any(w in txt_lower for w in ["think", "overthink", "thought", "stress", "anxious", "anxiety", "spiral", "worry", "panic", "chaos"]):
                action = f"{hero_anchor} clutching both temples with wide dizzy eyes, a large dark tangled scribble yarn cloud floating directly above their head, plain cream background"

            # 20. Researcher / Study / Lab
            elif any(w in txt_lower for w in ["brehm", "kahneman", "festinger", "scientist", "psychologist", "researcher", "study", "experiment", "lab"]):
                action = f"A friendly scientist stick figure wearing round black glasses and a white lab coat holding a yellow clipboard, explaining data to {hero_anchor}, plain cream background"

            # 21. Food / Diet temptation
            elif any(w in txt_lower for w in ["eat", "food", "salad", "burger", "diet", "sugar", "craving", "snack"]):
                action = f"{hero_anchor} at a dining table looking hilariously torn, holding a fork pointed towards a tiny green salad while eyes stare hypnotized at a giant juicy burger, plain cream background"

            # 22. Gym / Workout / Shoes
            elif any(w in txt_lower for w in ["gym", "workout", "exercise", "shoes", "run", "pushup"]):
                action = f"{hero_anchor} sitting on the floor staring thoughtfully at a pair of brand-new running shoes with a guilty pensive expression, plain cream background"

            # 23. False beliefs / Myth / Red X
            elif any(w in txt_lower for w in ["myth", "wrong", "mistake", "lie", "false", "trap", "never", "illusion"]):
                action = f"{hero_anchor} standing with folded arms and a skeptical frown, while a concept illustration behind is crossed out with a big bold RED hand-drawn X across the frame"

            # 24. Desk / Modern computer work
            elif any(w in txt_lower for w in ["laptop", "desk", "work", "office", "computer", "job"]):
                action = f"{hero_anchor} sitting at a minimalist modern white desk with slumped posture staring blankly at a glowing laptop, plain cream background with a gray ground strip"

            # 25. Lightbulb / Idea / Solution
            elif any(w in txt_lower for w in ["realize", "solution", "habit", "trick", "secret", "lightbulb", "idea", "strategy"]):
                action = f"{hero_anchor} with wide happy eyes pointing one finger upward, a single glowing bright yellow lightbulb floating right above their head, plain cream background"

            # 26. Biological brain structure (specific gags only, rare)
            elif any(w in txt_lower for w in ["amygdala", "cortex", "neuron", "neural", "chemical", "neuroscience"]):
                action = f"A small cute 2D flat pink cartoon brain character wearing a tiny firefighter helmet pulling a red emergency lever on a cartoon control panel, plain cream background"

            # 27. General everyday human behavioral illustration (NO PINK BRAIN SPAM!)
            else:
                action = f"{hero_anchor} in an expressive thoughtful pose illustrating everyday human habits and behavior, plain cream background with a gray ground strip, clean educational cartoon doodle composition"

            full_prompt = f"{prefix}{action}{current_suffix}"
            enriched.append({
                **item,
                "prompt": full_prompt,
                "status": item.get("status", "pending"),
                "image_url": item.get("image_url", ""),
            })
        return enriched

    elif style_key == "ancient_humans":
        # Suffix with NO text allowed for normal scenes
        suffix_no_text = custom_suffix_no_text if (custom_suffix_no_text and custom_suffix_no_text.strip()) else (
            ", same character design as the reference image, preserving facial features, spiky orange hair and stick figure body, "
            "do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )
        suffix_emphasis_text = custom_suffix_concept if (custom_suffix_concept and custom_suffix_concept.strip()) else (
            ", same character design as the reference image, preserving facial features, spiky orange hair and stick figure body, "
            "do not redesign the character, single bold keyword on object only, no subtitles, no paragraph text, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )
        if not hero_clean or ("dark brown hair" in hero_clean.lower() and "indigo tunic" in hero_clean.lower()):
            hero_anchor = "The main stick figure character from the reference image with spiky bright orange hair"
        else:
            hero_anchor = hero_clean

        enriched = []
        for item in scenes:
            txt = item["text"]
            txt_lower = txt.lower()

            is_survival_emphasis = any(w in txt_lower for w in ["survival", "predator", "deadly beast", "ice age", "starvation"]) and not any(w in txt_lower for w in ["savanna", "landscape"])
            is_stat_or_milestone = (
                any(w in txt_lower for w in ["300,000", "thousand years", "million years", "years ago"])
                and any(c.isdigit() for c in txt)
                and not any(w in txt_lower for w in ["savanna", "landscape", "tree", "river", "walk", "fire", "camp"])
            )

            current_suffix = suffix_no_text

            if any(w in txt_lower for w in ["laptop", "desk", "inbox", "screen", "computer", "phone", "office", "alarm", "commute", "clock", "modern"]):
                action = f"{hero_anchor}, sitting at a minimalist modern white desk looking exhausted at a glowing laptop screen, a ringing red alarm clock on the side, plain white background with a gray ground strip"
            elif is_stat_or_milestone:
                label = _extract_milestone_label(txt)
                action = f"Plain cream background with a gray ground strip, {hero_anchor} standing beside a massive floating bold RED hand-lettered text '{label}', minimal educational text frame"
                current_suffix = suffix_emphasis_text
            elif is_survival_emphasis:
                action = f"{hero_anchor} with a determined gritted-teeth expression holding a primitive wooden spear, huge gray boulder in background with bold white ALL-CAPS label 'SURVIVAL', light blue sky, tan dirt ground"
                current_suffix = suffix_emphasis_text
            elif any(w in txt_lower for w in ["savanna", "prehistoric", "dawn", "sunrise", "dusk", "ancestor", "origin"]):
                action = f"{hero_anchor}, standing on a vast prehistoric savanna landscape, warm orange sky, tan dirt ground with small grass tufts and a lone flat acacia tree in distance"
            elif any(w in txt_lower for w in ["hunt", "hunter", "spear", "mammoth", "animal", "prey", "danger", "struggle"]):
                action = f"{hero_anchor} with a determined expression creeping forward holding a wooden spear, light blue sky, tan dirt ground with rugged boulders"
            elif any(w in txt_lower for w in ["fire", "campfire", "tribe", "clan", "band", "community", "social", "gather", "family", "together"]):
                action = f"A small friendly tribe of stick figures including {hero_anchor} sitting in a circle around a crackling orange campfire, light blue daytime sky, tan ground with simple green bushes"
            elif any(w in txt_lower for w in ["cold", "freeze", "winter", "ice", "snow", "rain", "storm", "starve", "hunger", "pain", "sad", "suffer", "hardship", "loss"]):
                action = f"{hero_anchor} sitting on the ground curled up hugging knees with a worried frown, under a flat dark gray rain cloud pouring blue raindrops, plain cream background"
            elif any(w in txt_lower for w in ["archaeologist", "excavation", "fossil", "skull", "bone", "cave", "discover", "study", "research", "evidence", "site", "scientist"]):
                action = f"An explorer stick figure wearing a brown pith helmet and backpack holding a glowing yellow lantern, standing beside {hero_anchor} at a dark brown cave entrance in rocky ground, light blue sky"
            elif any(w in txt_lower for w in ["myth", "trap", "wrong", "mistake", "lie", "illusion", "false", "never", "not true"]):
                action = f"{hero_anchor} standing with a shrug in the foreground, while a large concept illustration behind is crossed out with a big bold RED hand-drawn X across the frame"
            elif any(w in txt_lower for w in ["night", "sleep", "dream", "moon", "stars", "bed", "rest", "dark"]):
                action = f"{hero_anchor} sleeping peacefully on a simple tan ground mat, deep indigo night sky dotted with simple white star dots and a glowing yellow crescent moon"
            elif any(w in txt_lower for w in ["wake", "morning", "sunlight", "body"]):
                action = f"{hero_anchor} stretching arms happily under morning sunlight, simple outdoor ancestral camp, light blue sky and tan ground"
            else:
                action = f"{hero_anchor}, moving across an ancient outdoor prehistoric terrain, chunky flat cartoon shapes, outdoor nature with light blue sky and tan ground, bold flat color zones"

            full_prompt = f"{prefix}{action}{current_suffix}"
            enriched.append({
                **item,
                "prompt": full_prompt,
                "status": item.get("status", "pending"),
                "image_url": item.get("image_url", ""),
            })
        return enriched

    else:
        # Default: forgotten_civilizations per flow_nen_van_minh_bi_bo_quen.txt
        # Normal scenes STRICTLY prohibit text to prevent AI from painting subtitles on drawings
        suffix_no_text = custom_suffix_no_text if (custom_suffix_no_text and custom_suffix_no_text.strip()) else (
            ", same character design as the reference image, exactly preserving the character's facial features, hair style, hair color, and clothing from the reference image, "
            "do not redesign the character, do not change hair color or clothes, "
            "no text, no words, no letters, no subtitles, no speech bubbles, no captions, "
            "no blank background, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no realistic skin, no anime, 16:9 widescreen, "
            "simple educational YouTube explainer doodle style."
        )
        suffix_concept_text = custom_suffix_concept if (custom_suffix_concept and custom_suffix_concept.strip()) else (
            ", centered single bold red hand-lettered keyword text only, no subtitles, no paragraphs, no extra words, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, "
            "no 3D render, no realistic faces, no anime, 16:9 widescreen, "
            "simple educational YouTube explainer doodle style."
        )

        if not hero_clean or ("dark brown hair" in hero_clean.lower() and "indigo tunic" in hero_clean.lower()):
            hero_anchor = "The main stick figure character from the reference image"
        else:
            hero_anchor = hero_clean

        enriched = []
        for item in scenes:
            txt = item["text"]
            txt_lower = txt.lower()

            # 1. Milestone year / century emphasis (ONLY when explicitly stating a year or century)
            is_year_milestone = (
                any(w in txt_lower for w in ["year is", "year was", "around ", "in the year", "century"])
                and any(c.isdigit() for c in txt)
                and len(txt.split()) <= 15
            )

            # 2. Historical definition / inscription explanation
            is_definition_concept = (
                any(w in txt_lower for w in ["inscription", "chronicle", "kedukan bukit", "mandala", "corvee", "corvée", "definition", "meaning"])
                and any(w in txt_lower for w in ["record", "stone", "tells", "word", "term", "system", "means"])
            )

            current_suffix = suffix_no_text

            if is_year_milestone:
                label = _extract_milestone_label(txt)
                action = f"Concept milestone frame, plain cream background, centered large bold RED hand-lettered text '{label}', minimal educational explainer text card"
                current_suffix = suffix_concept_text

            elif is_definition_concept:
                action = f"{hero_anchor} standing in foreground pointing at a clean concept card on plain cream background with a single bold RED hand-lettered term, educational explainer frame"
                current_suffix = suffix_concept_text

            elif any(w in txt_lower for w in ["laptop", "desk", "inbox", "screen", "computer", "office"]):
                action = f"{hero_anchor}, sitting at a minimalist modern wooden desk looking at a laptop with tired posture, plain cream background"

            elif any(w in txt_lower for w in ["wake", "morning", "mud", "smoke", "hut", "stilt", "dawn"]):
                action = f"{hero_anchor}, waking up on a rustic wooden floor inside a rustic stilt hut, rubbing eyes, gentle river mist through open window"

            elif any(w in txt_lower for w in ["boat", "river", "paddle", "water", "current", "tide", "stream", "dugout", "row", "canal"]):
                action = f"{hero_anchor}, standing in a narrow wooden dugout boat holding a single paddle, calm blue river water, simple green trees on bank"

            elif any(w in txt_lower for w in ["market", "trade", "fish", "salt", "coin", "pottery", "jar", "goods", "merchant", "sell", "buy", "weigh", "scale"]):
                action = f"{hero_anchor}, in a bustling open-air village market holding a clay jar, bundles of salt and dried fish on wooden mats"

            elif any(w in txt_lower for w in ["temple", "ruin", "gold", "king", "treasure", "palace", "monument", "statue", "crown", "empire"]):
                action = f"{hero_anchor} standing in foreground, small ancient stone temple ruin in background marked with a bold red hand-drawn X across the temple"

            elif any(w in txt_lower for w in ["rice", "field", "farm", "crop", "harvest", "plant", "kiln", "labor", "plow"]):
                action = f"{hero_anchor}, working in a lush green countryside rice field, holding a small bundle of rice stalks under daylight sky"

            elif any(w in txt_lower for w in ["eat", "meal", "cook", "food", "kitchen", "bowl", "hearth", "taste"]):
                action = f"{hero_anchor}, sitting cross-legged on a wooden floor eating simple food from a clay bowl, warm indoor hut atmosphere"

            elif any(w in txt_lower for w in ["walk", "carry", "basket", "road", "path", "trail", "foot", "travel", "village"]):
                action = f"{hero_anchor}, walking along a dusty dirt village path carrying a rustic woven basket on back, lush tropical nature"

            elif any(w in txt_lower for w in ["dusk", "night", "stars", "moon", "sleep", "dark", "fire", "campfire", "evening"]):
                action = f"{hero_anchor}, resting quietly by a small glowing campfire beside the river, dark navy night sky with a simple yellow crescent moon"

            elif any(w in txt_lower for w in ["look", "watch", "gaze", "think", "wonder", "listen", "eye", "see"]):
                action = f"{hero_anchor}, standing peacefully on the riverbank gazing out across the calm water, serene posture"

            else:
                action = f"{hero_anchor}, engaged in daily life activity in a historic village setting, simple hand-drawn environment, bold flat color zones"

            full_prompt = f"{prefix}{action}{current_suffix}"
            enriched.append({
                **item,
                "prompt": full_prompt,
                "status": item.get("status", "pending"),
                "image_url": item.get("image_url", ""),
            })
        return enriched


async def _call_llm_completion(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    payload: Dict[str, Any],
    stream: bool = True,
) -> str:
    """Execute LLM chat completion with streaming support to prevent Cloudflare HTTP 524 timeouts."""
    if stream:
        req_payload = {**payload, "stream": True}
        chunks: List[str] = []
        try:
            async with client.stream("POST", url, headers=headers, json=req_payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta:
                                chunks.append(delta)
                        except Exception:
                            pass
            content = "".join(chunks).strip()
            if content:
                return content
        except Exception as e:
            logger.warning("Streaming completion encountered error, retrying without stream: %s", e)

    # Fallback to standard non-streaming POST
    req_payload = {**payload, "stream": False}
    resp = await client.post(url, headers=headers, json=req_payload)
    resp.raise_for_status()
    data = resp.json()
    return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()


def _parse_llm_json_actions(content: str) -> Dict[int, str]:
    """Extract {id: action} mapping from LLM output across formats (JSON array, object, code fences)."""
    actions: Dict[int, str] = {}
    if not content:
        return actions

    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    # 1. Direct JSON parse
    try:
        data = json.loads(text)
        if isinstance(data, list):
            for it in data:
                if isinstance(it, dict) and "id" in it and "action" in it:
                    actions[int(it["id"])] = str(it["action"]).strip()
            if actions:
                return actions
        elif isinstance(data, dict):
            items = data.get("scenes") or data.get("actions") or []
            if isinstance(items, list):
                for it in items:
                    if isinstance(it, dict) and "id" in it and "action" in it:
                        actions[int(it["id"])] = str(it["action"]).strip()
                if actions:
                    return actions
            elif "id" in data and "action" in data:
                actions[int(data["id"])] = str(data["action"]).strip()
                return actions
    except Exception:
        pass

    # 2. Regex search for JSON array [ ... ]
    m_arr = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if not m_arr:
        m_arr = re.search(r"\[.*\]", text, re.DOTALL)
    if m_arr:
        try:
            parsed = json.loads(m_arr.group(0))
            if isinstance(parsed, list):
                for it in parsed:
                    if isinstance(it, dict) and "id" in it and "action" in it:
                        actions[int(it["id"])] = str(it["action"]).strip()
                if actions:
                    return actions
        except Exception:
            pass

    # 3. Regex search for JSON object { ... }
    m_obj = re.search(r"\{.*\}", text, re.DOTALL)
    if m_obj:
        try:
            parsed = json.loads(m_obj.group(0))
            if isinstance(parsed, dict):
                items = parsed.get("scenes") or parsed.get("actions") or []
                if isinstance(items, list):
                    for it in items:
                        if isinstance(it, dict) and "id" in it and "action" in it:
                            actions[int(it["id"])] = str(it["action"]).strip()
                elif "id" in parsed and "action" in parsed:
                    actions[int(parsed["id"])] = str(parsed["action"]).strip()
        except Exception:
            pass

    return actions


def _extract_chained_actions_json(content: str) -> Dict[int, Dict[str, Any]]:
    """Extract {id: {'action': str, 'transition_type': str, 'source_scene_id': int | None}} from LLM output."""
    results: Dict[int, Dict[str, Any]] = {}
    if not content:
        return results

    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    def process_items(items):
        for it in items:
            if isinstance(it, dict) and "id" in it and "action" in it:
                sid = int(it["id"])
                ttype = str(it.get("transition_type", "new_scene")).strip().lower()
                if ttype not in ("new_scene", "inherit_edit", "hold_frame"):
                    ttype = "new_scene"
                src_id = it.get("source_scene_id")
                if src_id is not None:
                    try:
                        src_id = int(src_id)
                    except (ValueError, TypeError):
                        src_id = None
                results[sid] = {
                    "action": str(it["action"]).strip(),
                    "transition_type": ttype,
                    "source_scene_id": src_id,
                }

    try:
        data = json.loads(text)
        if isinstance(data, list):
            process_items(data)
            if results:
                return results
        elif isinstance(data, dict):
            items = data.get("scenes") or data.get("actions") or []
            if isinstance(items, list):
                process_items(items)
                if results:
                    return results
    except Exception:
        pass

    m_arr = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if not m_arr:
        m_arr = re.search(r"\[.*\]", text, re.DOTALL)
    if m_arr:
        try:
            parsed = json.loads(m_arr.group(0))
            if isinstance(parsed, list):
                process_items(parsed)
                if results:
                    return results
        except Exception:
            pass

    return results


async def generate_scene_prompts_ai(
    scenes: List[Dict[str, Any]],
    hero_lock: str = "",
    topic: str = "",
    style: str = "doodle",
    base_url: str = "",
    api_key: str = "",
    model: str = "",
    batch_size: int = 25,
    background_mode: str = "dynamic",
    topic_requirements: str = "",
    full_script: str = "",
    target_scene_id: Optional[int] = None,
    chaining_mode: bool = False,
    custom_prefix: Optional[str] = None,
    custom_suffix: Optional[str] = None,
    custom_system_prompt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Universal AI-driven 2D doodle storyboard generator (OpenAI-compatible / Gemini 3.8 Flash).
    
    Feeds the FULL original script and complete scene timeline to the AI visual director.
    The AI reads and comprehends the whole story arc first, ensuring every scene's prompt
    follows the narrative flow and thematic setting with high visual continuity.
    """
    if not scenes:
        return []

    prefix = custom_prefix if (custom_prefix and custom_prefix.strip()) else (
        "Hand-drawn 2D doodle cartoon animation, flat solid colors, "
        "bold black hand-drawn outlines, slightly wobbly imperfect marker lines, "
    )

    hero_clean = (hero_lock or "").strip()
    hero_anchor = hero_clean or "The main stick figure character from the reference image"

    is_fixed_bg = (background_mode or "").strip().lower() == "fixed"

    if custom_suffix and custom_suffix.strip():
        suffix = custom_suffix
    elif is_fixed_bg:
        suffix = (
            ", plain cream background with a gray ground strip, "
            "same character design as the reference image, preserving facial features and minimalist stick figure body, "
            "do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, no 3D render, "
            "no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )
    else:
        suffix = (
            ", same character design as the reference image, preserving facial features and minimalist stick figure body, "
            "do not redesign the character, no text, no words, no letters, no subtitles, no speech bubbles, no captions, "
            "no gradients, no drop shadows, no photographic textures, no photorealism, no 3D render, "
            "no realistic faces, no anime, 16:9 widescreen, simple educational YouTube explainer doodle style."
        )

    if is_fixed_bg:
        bg_instruction = (
            "1. BACKGROUND & ENVIRONMENT (FIXED MINIMALIST STUDIO):\n"
            "   All scenes MUST take place against a minimalist plain cream background with a gray ground strip.\n"
            "   Do NOT describe varied outdoor environments, rooms, walls, or scenic landscapes.\n"
            "   Focus purely on character expressions, poses, props, and symbolic interactions in front of this clean minimalist studio backdrop."
        )
    else:
        bg_instruction = (
            "1. BACKGROUND & ENVIRONMENT (DYNAMIC CONTEXTUAL SETTING):\n"
            "   Deeply understand the story context and genre from the full script and narration sentences.\n"
            "   For EACH scene, describe a distinct, context-specific 2D doodle background setting and environment matching the story era "
            "   (e.g., sunny prehistoric savanna with acacia trees, cozy dark bedroom at night with glowing smartphone, bustling ancient riverside market, "
            "   minimalist modern office desk with laptop, outdoor crossroad with directional signs, campfire under starry sky).\n"
            "   Vary environments naturally to match the story's visual journey while keeping flat solid colors and 2D doodle cartoon style."
        )

    # Process topic requirements (custom or style defaults)
    reqs_clean = (topic_requirements or "").strip()
    style_key = style.lower().strip() if style else "doodle"
    if not reqs_clean and style_key in STYLES_REGISTRY:
        reqs_clean = STYLES_REGISTRY[style_key].get("default_topic_requirements", "").strip()

    topic_rules_instruction = ""
    if reqs_clean:
        topic_rules_instruction = (
            f"MANDATORY THEME & TOPIC RULES (YOU MUST STRICTLY INCORPORATE THESE SPECIFIC THEME ELEMENTS WHERE APPLICABLE):\n"
            f"{reqs_clean}\n"
        )

    burl = (base_url or STORY_AI_BASE_URL).rstrip("/")
    key = api_key or STORY_AI_API_KEY
    mod = model or STORY_AI_MODEL

    if not key or not burl:
        logger.warning("No AI API key or base_url configured, falling back to rule-based prompt builder.")
        return build_scene_prompts(scenes, hero_lock, topic, style=style, background_mode=background_mode, topic_requirements=topic_requirements)

    # Prepare complete narrative script
    script_content = (full_script or "").strip()
    if not script_content:
        # Reconstruct narrative from scene texts with timestamps
        lines = []
        for i, s in enumerate(scenes):
            txt = s.get("text", "").strip()
            if txt:
                sid = s.get("id", i + 1)
                t_str = s.get("timestamp_str") or f"Scene {sid}"
                lines.append(f"[{t_str}] {txt}")
        script_content = "\n".join(lines)

    if chaining_mode:
        output_format_instruction = """4. INTELLIGENT STORY CHAINING & VISUAL CONTINUITY (MANDATORY):
   Group consecutive scenes that share the same visual concept/moment into a cohesive "Visual Beat".
   Do NOT jump to a completely different angle or background every 2-3 seconds unless the story topic genuinely changes.

   RULES FOR TRANSITIONS & CINEMATOGRAPHY:
   - "transition_type":
     * "new_scene": Use ONLY when starting a completely new setting/location, or transitioning to a different place/time (e.g. from day to night, or savanna to cave). Set "source_scene_id": null.
     * "inherit_edit": Use when continuing the SAME visual beat. The background plate and camera stay identical; only ADD or MODIFY an element, character action, or prop. The "action" MUST strictly start with:
       "Same [environment/framing] as Scene #{source_scene_id}, preserving the exact background plate and camera angle. ONLY modify: [specific character action / new held prop / new visual icon]..."
     * "hold_frame": Use when the narration continues the exact same visual statement or when the line is a short pause/reinforcement (< 2.0s) without needing any new drawing at all. Set "source_scene_id": [id of preceding scene].
   - "source_scene_id": The id of the preceding scene in this beat (null for "new_scene").
   - "action": Specific English description of the action or edit.

   DIRECTOR CONTINUITY RULES (CRITICAL):
   - RULE A (DURATION-AWARE PACING): Check "duration_s" for each scene. For very short lines (duration_s <= 2.0s), STRONGLY prefer "hold_frame" or "inherit_edit" with a subtle, quick visual reaction (e.g., small question mark icon, red 'X', or alert expression). NEVER start a "new_scene" for lines under 2.0s unless it is an extreme dramatic smash cut!
   - RULE B (PROP & INVENTORY PERSISTENCE): If the character picks up or holds a key prop (e.g. wooden spear, oar/paddle, glowing lantern, torch, stone axe, pottery jar, smartphone, book) in a scene, ANY subsequent "inherit_edit" scene in that beat MUST KEEP that prop in hand/use unless the narration explicitly describes dropping or stowing it. Do not let objects magically disappear!
   - RULE C (KINETIC & POSE CONTINUITY): When continuing in "inherit_edit", smoothly transition the character's pose. If they were kneeling in the source scene, describe them rising from kneeling or shifting posture; do not teleport poses abruptly.
   - RULE D (NARRATIVE TROPES & CONTRAST): If the line presents a contrast ("While kings build palaces, ordinary people live in mud huts" or "You think it's willpower, but it's ancient biology"): Use a split-screen layout ("Split-screen doodle: on the left side, [myth/palace] crossed out with bold red hand-drawn X; on the right side, [reality] with [hero_anchor]...") or sequential negation (first frame shows myth, next inherit_edit frame slashes it with red X).

OUTPUT FORMAT:
Return strictly a valid JSON array of objects with keys "id", "transition_type", "source_scene_id", "action":
[
  {"id": 1, "transition_type": "new_scene", "source_scene_id": null, "action": "Wide shot of prehistoric savanna with lone acacia tree under dawn sky, stick figure standing curious"},
  {"id": 2, "transition_type": "inherit_edit", "source_scene_id": 1, "action": "Same savanna and stick figure as Scene #1, preserving the exact background plate and camera angle. ONLY modify: stick figure is now kneeling and carving a sharp tip on a wooden spear"},
  {"id": 3, "transition_type": "inherit_edit", "source_scene_id": 2, "action": "Same savanna as Scene #2, preserving the exact background plate and camera angle. ONLY modify: stick figure rises from kneeling pose, gripping the carved spear defensively while giant boulder labeled 'SURVIVAL' drops beside him"},
  {"id": 4, "transition_type": "hold_frame", "source_scene_id": 3, "action": "Hold frame from Scene #3"}
]
"""
    else:
        output_format_instruction = """4. OUTPUT FORMAT:
   - Each visual action description must be in ENGLISH (15–30 words) describing: [Subject/Character] + [Specific action & expression] + [Key props/metaphor] + [Environment].
   - Return strictly valid JSON array of objects with keys "id" (int) and "action" (string):
   [
     {"id": 1, "action": "..."},
     {"id": 2, "action": "..."}
   ]
"""

    if custom_system_prompt and custom_system_prompt.strip():
        system_prompt = custom_system_prompt
    else:
        system_prompt = f"""You are an elite Visual Director and Lead Storyboard Illustrator for viral educational 2D doodle animations (Kurzgesagt / MinutePhysics / AsapSCIENCE style).

PRIMARY GOAL:
You will be given the FULL NARRATIVE SCRIPT of the video and its chronological scene segments.
You MUST read and deeply digest the entire script first to grasp the overarching topic, world-building, emotional tone, and narrative progression.
Then, translate each scene segment into a contextually accurate, visually engaging 2D doodle storyboard action that directly illustrates that narration line while keeping seamless visual continuity with the story.

CORE ARTISTIC SPECIFICATIONS:
- Visual Style: Hand-drawn 2D doodle cartoon animation, flat solid colors, bold black hand-drawn outlines, slightly wobbly imperfect marker lines.
- Main Character Anchor: {hero_anchor}.
{bg_instruction}
{topic_rules_instruction}
STRICT DIRECTING & VISUAL CONTINUITY RULES:
1. DEEP STORY COMPREHENSION (AVOID OFF-TOPIC VISUALS):
   - The narration sentences may be in Vietnamese or English. You must translate the semantic meaning of each sentence into an accurate 2D doodle scene description in ENGLISH.
   - Ground every scene in the story's actual world:
     * If the story is about Ancient Humans on the prehistoric savanna: the environment must be savanna dirt, acacia trees, limestone caves, campfire, or starry sky. NEVER draw modern bedrooms, cars, or office desks unless the script is making an explicit modern contrast!
     * If the story is about Ancient Civilizations (e.g. Srivijaya, Angkor, Mali): draw wooden stilt huts, dugout river boats, bustling clay pottery markets, salt bundles, river mist, or overgrown temple ruins.
     * If the story is about Brain Psychology / Behavioral Science: draw relatable struggles, the 2D flat pink cartoon brain character with funny expressions, red megaphone shouting advice, brick walls of ego defense, dark bedroom with phone screen light, tangled dark scribble thought clouds, or bold red 'X' over false beliefs.

2. STORYBOARD CONTINUITY & CINEMATOGRAPHY:
   - Scenes must flow naturally like a cohesive movie storyboard.
   - Do NOT just have the stick figure character standing in the center in every single scene. Vary the compositions:
     * Establishing environment shots setting the mood and era (e.g., lone acacia tree under orange sunrise sky, misty river with stilt huts).
     * Action & interaction shots (e.g., crouching by campfire blowing embers, spearfishing from wooden boat, running from predators).
     * Close-ups of hands or significant props (e.g., weathered hands tying flint spearhead, holding glowing lantern, phone screen in dark).
     * Conceptual & metaphorical shots (e.g., giant dark boulder with white label 'SURVIVAL', person building brick wall in front of self, big bold RED X slashing across a misconception).

3. STRICT TEXT & LETTERING RULES:
   - STRICTLY NO TEXT, NO SUBTITLES, NO WORDS, NO SPEECH BUBBLES IN THE DRAWING.
   - The visual storytelling must be 100% illustrative.
   - ONLY allow short ALL-CAPS single-word labels if explicitly specified by theme devices (e.g. 'SURVIVAL' on a boulder, 'REACTANCE', '300,000 YEARS').

{output_format_instruction}
"""

    actions_map: Dict[int, str] = {}
    chained_actions_map: Dict[int, Dict[str, Any]] = {}
    input_items = [
        {
            "id": s["id"],
            "timestamp": s.get("timestamp_str", ""),
            "duration_s": round(float(s.get("duration", (s.get("end_s", 0) - s.get("start_s", 0)) if (s.get("end_s") is not None and s.get("start_s") is not None and s.get("end_s") > s.get("start_s")) else 3.0)), 1),
            "text": s["text"],
        }
        for s in scenes
    ]

    if target_scene_id is not None:
        target_item = next((s for s in scenes if s["id"] == target_scene_id), None) or scenes[0]
        prev_scenes = [s for s in scenes if s["id"] < target_item["id"]][-3:]
        next_scenes = [s for s in scenes if s["id"] > target_item["id"]][:3]
        timeline_context = []
        for ps in prev_scenes:
            dur_p = ps.get("duration", 3.0)
            ttype_p = ps.get("transition_type", "new_scene")
            timeline_context.append(f"Scene #{ps['id']} [{ps.get('timestamp_str', '')}] ({dur_p}s) [{ttype_p}]: \"{ps.get('text', '')}\" -> Action: {ps.get('prompt', '')[:120]}")
        cur_dur = round(float(target_item.get("duration", 3.0)), 1)
        timeline_context.append(f">>> [CURRENT TARGET SCENE #{target_item['id']}] ({cur_dur}s): \"{target_item.get('text', '')}\" <<<")
        for ns in next_scenes:
            dur_n = ns.get("duration", 3.0)
            timeline_context.append(f"Scene #{ns['id']} [{ns.get('timestamp_str', '')}] ({dur_n}s): \"{ns.get('text', '')}\"")

        if chaining_mode:
            sample_obj = f'{{"id": {target_item["id"]}, "transition_type": "new_scene|inherit_edit|hold_frame", "source_scene_id": {target_item["id"] - 1 if target_item["id"] > 1 else "null"}, "action": "..."}}'
            user_prompt = (
                f"=== 1. STORY TOPIC & CORE CONCEPT ===\n"
                f"{topic or 'Educational Story Explainer'}\n\n"
                f"=== 2. FULL ORIGINAL SCRIPT (FULL CONTEXT - READ & COMPREHEND FIRST) ===\n"
                f"{script_content}\n\n"
                f"=== 3. SURROUNDING TIMELINE CONTEXT ===\n"
                f"{chr(10).join(timeline_context)}\n\n"
                f"=== INSTRUCTION ===\n"
                f"Generate a rich, cohesive visual action description specifically for TARGET SCENE #{target_item['id']} with STORY CHAINING.\n"
                f"Sentence to illustrate: \"{target_item.get('text', '')}\" (duration: {cur_dur}s)\n"
                f"Evaluate if this scene should be 'new_scene', 'inherit_edit', or 'hold_frame' relative to preceding scenes, respecting prop/pose continuity, duration-aware pacing, and delta prompting.\n"
                f"Return ONLY a JSON array with this single object:\n"
                f"[\n"
                f"  {sample_obj}\n"
                f"]"
            )
        else:
            user_prompt = (
                f"=== 1. STORY TOPIC & CORE CONCEPT ===\n"
                f"{topic or 'Educational Story Explainer'}\n\n"
                f"=== 2. FULL ORIGINAL SCRIPT (FULL CONTEXT - READ & COMPREHEND FIRST) ===\n"
                f"{script_content}\n\n"
                f"=== 3. SURROUNDING TIMELINE CONTEXT ===\n"
                f"{chr(10).join(timeline_context)}\n\n"
                f"=== INSTRUCTION ===\n"
                f"Generate a rich, cohesive visual action description specifically for TARGET SCENE #{target_item['id']}.\n"
                f"Sentence to illustrate: \"{target_item.get('text', '')}\"\n"
                f"Make sure this scene visual directly represents that sentence and fits seamlessly with the surrounding scenes in the story world.\n"
                f"Return ONLY a JSON array with this single object:\n"
                f"[\n"
                f"  {{\"id\": {target_item['id']}, \"action\": \"...\"}}\n"
                f"]"
            )
    else:
        user_prompt = (
            f"=== 1. STORY TOPIC & CORE CONCEPT ===\n"
            f"{topic or 'Educational Story Explainer'}\n\n"
            f"=== 2. FULL ORIGINAL SCRIPT (READ & DIGEST THIS ENTIRE NARRATIVE FIRST) ===\n"
            f"{script_content}\n\n"
            f"=== 3. CHRONOLOGICAL SCENE TIMELINE ({len(scenes)} SCENES WITH DURATION) ===\n"
            f"Here are the {len(scenes)} scenes in exact chronological order:\n"
            f"{json.dumps(input_items, ensure_ascii=False, indent=2)}\n\n"
            f"=== INSTRUCTION ===\n"
            f"Based on your comprehension of the FULL SCRIPT above, storyboard all {len(scenes)} scenes in exact numerical order"
            + (" with STORY CHAINING (detect visual beats, inherit_edit or hold_frame where appropriate, applying duration-aware pacing, prop persistence, kinetic pose flow, and delta prompting).\n" if chaining_mode else ".\n")
            + f"Ensure every scene directly illustrates its narration sentence while keeping seamless visual continuity with the story arc.\n"
            f"Return ONLY the JSON array (id 1 to {len(scenes)}):"
        )

    # Execute LLM request with streaming to prevent Cloudflare 524 timeout
    async with httpx.AsyncClient(timeout=300.0) as client:
        for attempt in range(2):
            try:
                content = await _call_llm_completion(
                    client=client,
                    url=f"{burl}/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    payload={
                        "model": mod,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.35,
                    },
                    stream=True,
                )
                if chaining_mode:
                    parsed_chained = _extract_chained_actions_json(content)
                    if parsed_chained:
                        chained_actions_map.update(parsed_chained)
                        for sid, val in parsed_chained.items():
                            actions_map[sid] = val["action"]
                        logger.info("Successfully received %d chained scene actions from AI", len(chained_actions_map))
                        break
                    else:
                        logger.warning("Attempt %d: Failed to parse chained JSON from AI response: %s", attempt + 1, content[:200])
                else:
                    parsed_actions = _parse_llm_json_actions(content)
                    if parsed_actions:
                        actions_map.update(parsed_actions)
                        logger.info("Successfully received %d scene actions from AI (target=%s)", len(actions_map), target_scene_id or "all")
                        break
                    else:
                        logger.warning("Attempt %d: Failed to parse JSON from AI response: %s", attempt + 1, content[:200])
            except Exception as e:
                logger.warning("Attempt %d failed for prompt generation: %s", attempt + 1, e)
                if attempt == 0:
                    await asyncio.sleep(2.0)

    # If generating all scenes and any IDs were skipped, do a targeted fill for those missing IDs
    if target_scene_id is None:
        missing_ids = [s["id"] for s in scenes if s["id"] not in actions_map]
        if missing_ids and len(missing_ids) <= 20:
            logger.info("Filling %d missing scene IDs from AI: %s", len(missing_ids), missing_ids)
            missing_scenes = [s for s in scenes if s["id"] in missing_ids]
            missing_items = [{"id": s["id"], "text": s["text"]} for s in missing_scenes]
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    c = await _call_llm_completion(
                        client=client,
                        url=f"{burl}/chat/completions",
                        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                        payload={
                            "model": mod,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": f"Generate missing scene actions in JSON array:\n{json.dumps(missing_items, ensure_ascii=False)}"},
                            ],
                            "temperature": 0.3,
                        },
                        stream=True,
                    )
                    if chaining_mode:
                        fill_c = _extract_chained_actions_json(c)
                        chained_actions_map.update(fill_c)
                        for sid, val in fill_c.items():
                            actions_map[sid] = val["action"]
                    else:
                        fill_actions = _parse_llm_json_actions(c)
                        actions_map.update(fill_actions)
            except Exception as err:
                logger.warning("Failed to fill missing scenes with AI: %s", err)

    # Fallback to rule-based for any scenes that still missed AI generation
    rule_scenes = build_scene_prompts(scenes, hero_lock, topic, style=style, background_mode=background_mode, topic_requirements=topic_requirements)
    rule_map = {s["id"]: s["prompt"] for s in rule_scenes}

    enriched = []
    for item in scenes:
        sid = item["id"]
        if (target_scene_id is None or sid == target_scene_id) and sid in actions_map:
            raw_action = actions_map[sid]
            # Strip accidental repeated prefix/suffix from model
            clean_act = re.sub(r"^Hand-drawn.*?marker lines,\s*", "", raw_action, flags=re.IGNORECASE)
            if is_fixed_bg:
                clean_act = re.sub(r",\s*plain cream background.*$", "", clean_act, flags=re.IGNORECASE)
            clean_act = re.sub(r",\s*no text.*$", "", clean_act, flags=re.IGNORECASE)
            clean_act = clean_act.strip().rstrip(",")

            # Check if action intentionally features an on-object label (e.g. 'SURVIVAL' or '300,000 YEARS')
            has_quoted_label = bool(re.search(r"['\"][A-Z0-9_\s]{2,25}['\"]", clean_act))
            cur_suffix = suffix
            if has_quoted_label and "no text" in cur_suffix:
                cur_suffix = cur_suffix.replace(
                    "no text, no words, no letters, no subtitles, no speech bubbles, no captions",
                    "single bold keyword on object only, no subtitles, no paragraph text, no speech bubbles, no captions"
                )

            full_prompt = f"{prefix}{clean_act}{cur_suffix}"
        else:
            full_prompt = item.get("prompt") or rule_map.get(sid, "")

        ch_meta = chained_actions_map.get(sid, {}) if chaining_mode else {}

        scene_dict = {
            **item,
            "prompt": full_prompt,
            "status": item.get("status", "pending"),
            "image_url": item.get("image_url", ""),
        }
        if chaining_mode:
            scene_dict["transition_type"] = ch_meta.get("transition_type") or item.get("transition_type", "new_scene")
            scene_dict["source_scene_id"] = ch_meta.get("source_scene_id") if "source_scene_id" in ch_meta else item.get("source_scene_id", None)
        elif "transition_type" in item:
            scene_dict["transition_type"] = item["transition_type"]
            scene_dict["source_scene_id"] = item.get("source_scene_id")

        enriched.append(scene_dict)

    return enriched


async def generate_single_scene_image(
    project_id: str,
    scene_id: int,
    prompt: str,
    character_media_id: str = "",
    flow_project_id: str = "",
    image_model: str = "BELUGA",
    timeout_seconds: float = 60.0,
    base_media_id: str = "",
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
                base_media_id=base_media_id or None,
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

    media_id = (
        first_item.get("name")
        or first_item.get("image", {}).get("generatedImage", {}).get("mediaId")
        or first_item.get("mediaId")
    )
    if not media_id or not re.search(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', str(media_id), re.I):
        m = re.search(r'/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', str(cdn_url or ""), re.I)
        if m:
            media_id = m.group(1)

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
        "media_id": str(media_id) if media_id else "",
        "status": "completed",
    }


_FLOW_GEMINI_ALPHA_B64 = (
    "eNrNmk1oXFUUx6egSI1ULBS/cGFVmghSLFk0JO/ZTSUG3JUG6qKiNd0oWG2idGWnCzULMVgXo7WSqqUkLiqUip1ZiMW6"
    "abISTCQE3ARtQRddNFRt7e+G/3hyuPfNTPPRLP5M5s2b+37n3nPOPedOxueeqR7fe61Q4zfvsdp9fUvN6sTgkz3ohbGP"
    "F+m7J3ZmyF/34622PP+uuVIGf/eNTd0I5un+6Wygrz+/eGAg/2jrsezZSh7s0D38zTU+u938mn9x/XHwWDa0/6Ec/tnq"
    "YH7P+uqa5p85/1y39R/xb/52IH/+aDn/5/LVDBtKWw5nF6Z2ZA/8dL2HV/hlV8yvNP5q8COxwzu2szf/4qtysOHdbzqC"
    "DZ5fa7DS/H58jfv7pgfPofHSvmADLPg9cy9+awNrALeUims/P6vBj//gy/seacv/nNoemM/8NZJPTC/4UGwN1iL/zAcd"
    "IW49/43Nvfm9O9ryx6qf1/kVx8vNr7GK8rYd//FtXTU+x3c09/Id+NdPjIRrll95KLa/3MrcWsk39frmv3dlQ5N7utGV"
    "PeX698RAzMrv73utP39/djDf+EYlnxw7FcTfe2cXbOAe7iVWiBnWTuto5zrGFZtHz+3FdbGL39+PX6PK39sD/+6u4UX8"
    "r7ePhvesB+tj+cUuftlg569Z/pTEzjog5W3VB7Azr55fNnh+YpxYYd/+9eDpHuVfKcaWyuNFa6RX5hx5fus3cMHu+ZHl"
    "J69yv2zo/PpQqD1i/J7VvxbFtv9Mew0ijyM4xI7wewS/twFxjc+xQetwZON08BHVINYWmyPkX9bPUvz+c62J5cdnxE2+"
    "RJ7f2mHfE8eI75JvbY3q+W18ePm1iInPyTHEEs9RbWPZS+3Di+T5U5K97GmywfIXsdf3nhb5rb9r3lvl9351sb2WxWyA"
    "r/r9b4V2DI681yNZH2JfOdQ5WONVzJaburj2YiV/u3Kqzu25rN9bsS9LvFdc27wE/zvrPqwhz1yZm+mWPLcVn+HvjOvn"
    "XPxoKfxINV4qtzKP2BHzD/hsHaIYZQxyg9iVG+s+e5NX/M36e4pfdjIuc0NM82zl11g+lDw/8QkzY6gW8+zibzVeU/za"
    "pzUez9xV6l3ITdfuzmP7k3pz7aN+L5KPUDvGcqKNw1b5vWydJBt4NoJj62fT9f5N9bfqL/Uc1seVn2Gn7mrkz0tVLGaw"
    "gWfDQGzTPyBqWOyRLcy7YlLcqn2lleZPiboDG/YfqQQ71EeoF2JN4OeMQ+vFPd4Gu76ev3Pd0JI5GcPK56Yf7xwNmi+X"
    "87eOLuQpfAUblGtUE2AbNmIHfQcSv7cjtuYxnamOBPk8y/zGxJxLcMD79KsLsYyUm5QrUzYg5fkUc7P8Jw6Um+KHWfuB"
    "9gSYn5qYyrJLnwZ9siHPtG/Z8wviQbUldhArtq5M8TVT41j5PKp1FbtqbPVqzC3M4rZ7rs3/6qcU2/SqqjOL9oBWajXP"
    "b/On7TEVn6qJ/L5l839R/2hrtlTd2ai+aST5ufwFdvIKz1aPn1IjfsRYZ8+fy06evLpof9MaNNpfi+yw/Yz8Rf2x32tj"
    "5+H4ko/lVE9p9zrVFsR3yq8vdI0W2qIYrb7UFuZcvs5zdKaNPLdiQPHAd6SYDaX5X6qMozzVCr+3wc477IyhfUjcXil2"
    "ZK9Jdi0Q16i1NZ7t30Nd4uLA88+fLdfrTOL04ftH63UBPuP7x1gPW6QifrGn+FV/FM2/54ed76je9/17q+eHnt9L43j7"
    "xJ86f/B+rz3V9yqpeV+u81s/judXbrXnP55ftZQ9O1GflZr3W+X339f5lWR7Hf1eYc8Ptc+pNta8c5a77eeOen5XvDZz"
    "hrAS/Do/VM3x6PD/Z4g6w0U2XsVufb6IvRX+1PePv7whyPPbPVrrYM+gVXdS+4pfNQH7KnkZrdS8e37ZEDv3tTbAaesj"
    "+NknsI17YB/54cvqcvM3+/tLKj8rJujvyDH4zeH8dOiXVJMp36iuufJKX63R/K3070d6rxpc/PR9zD3s6jnWEr+XYgJ+"
    "fGi8bzj0b8y77Zl8XXa7+dmb7W8J9A30PjrDIGZjtdVa5tca0IPiU5a91TyyGvzI5lX42auIXf871lrjv2NossfzK47x"
    "fdtDLff/MvwHqY6hIw=="
)
_FLOW_GEMINI_ALPHA_MAP = None


def _get_flow_gemini_alpha_map():
    global _FLOW_GEMINI_ALPHA_MAP
    if _FLOW_GEMINI_ALPHA_MAP is None:
        import base64
        import zlib
        import numpy as np
        raw = zlib.decompress(base64.b64decode(_FLOW_GEMINI_ALPHA_B64))
        _FLOW_GEMINI_ALPHA_MAP = np.frombuffer(raw, dtype=np.float32).reshape((48, 48))
    return _FLOW_GEMINI_ALPHA_MAP


def remove_gemini_watermark_from_file(image_path: Path | str, output_path: Path | str = None) -> bool:
    """Remove Gemini/Google Flow bottom-right star watermark using reverse alpha blending without blurring."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        logger.error("opencv-python is required for watermark removal")
        return False

    image_path = Path(image_path)
    output_path = Path(output_path or image_path)
    if not image_path.exists():
        return False

    img = cv2.imread(str(image_path))
    if img is None:
        return False

    h, w = img.shape[:2]
    alpha_map = _get_flow_gemini_alpha_map()

    # Google Flow standard positioning: 48x48 star logo at 73px margins from bottom-right
    if w == 1376 and h == 768:
        x, y = w - 73 - 48, h - 73 - 48
    elif w == 768 and h == 1376:  # 9:16 vertical
        x, y = w - 73 - 48, h - 73 - 48
    else:
        scale = min(w / 1376.0, h / 768.0)
        target_size = int(max(32, round(48 * scale)))
        x = int(w - 73 * scale - target_size)
        y = int(h - 73 * scale - target_size)
        alpha_map = cv2.resize(alpha_map, (target_size, target_size), interpolation=cv2.INTER_LINEAR)

    kw, kh = alpha_map.shape[1], alpha_map.shape[0]
    if x < 0 or y < 0 or x + kw > w or y + kh > h:
        return False

    patch = img[y:y+kh, x:x+kw].astype(np.float32)
    cleaned = patch.copy()

    # Pure mathematical reverse alpha blend:
    # W = (1 - a) * Orig + a * Logo => Orig = (W - a * Logo) / (1 - a)
    # For positive alpha (white star logo = 255): Orig = (W - a * 255) / (1 - a)
    # For negative alpha (dark shadow logo = 0): Orig = W / (1 - |a|)
    pos_mask = alpha_map > 0.005
    neg_mask = alpha_map < -0.005

    pos_a = np.minimum(alpha_map[pos_mask], 0.95)[:, None]
    cleaned[pos_mask] = (patch[pos_mask] - pos_a * 255.0) / (1.0 - pos_a)

    neg_mag = np.minimum(np.abs(alpha_map[neg_mask]), 0.95)[:, None]
    cleaned[neg_mask] = patch[neg_mask] / (1.0 - neg_mag)

    cleaned = np.clip(np.round(cleaned), 0, 255).astype(np.uint8)
    img[y:y+kh, x:x+kw] = cleaned
    cv2.imwrite(str(output_path), img)
    return True


def remove_scene_watermark(project_id: str, scene_id: int) -> Dict[str, Any]:
    """Remove watermark for a single scene image in the project."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    scenes = proj.get("scenes", [])
    target = next((s for s in scenes if s["id"] == scene_id), None)
    if not target:
        raise ValueError(f"Scene {scene_id} not found")

    pdir = get_project_dir(project_id)
    local_path = pdir / "scenes" / f"scene_{scene_id:03d}.png"
    if not local_path.exists():
        raise FileNotFoundError(f"Local image file not found for scene {scene_id}")

    ok = remove_gemini_watermark_from_file(local_path)
    if not ok:
        raise RuntimeError(f"Failed to remove watermark from scene {scene_id}")

    now_ts = int(time.time())
    target["watermark_removed"] = True
    target["image_url"] = f"/output/story_studio/{project_id}/scenes/scene_{scene_id:03d}.png?t={now_ts}"
    save_project(proj)

    return {
        "scene_id": scene_id,
        "watermark_removed": True,
        "image_url": target["image_url"],
    }


def remove_all_scene_watermarks(project_id: str) -> Dict[str, Any]:
    """Remove watermark for all completed scenes with local images in the project."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    scenes = proj.get("scenes", [])
    pdir = get_project_dir(project_id)
    scene_dir = pdir / "scenes"

    cleaned_count = 0
    now_ts = int(time.time())

    for sc in scenes:
        sid = sc.get("id")
        img_file = scene_dir / f"scene_{sid:03d}.png"
        if img_file.exists():
            if remove_gemini_watermark_from_file(img_file):
                sc["watermark_removed"] = True
                sc["image_url"] = f"/output/story_studio/{project_id}/scenes/scene_{sid:03d}.png?t={now_ts}"
                cleaned_count += 1

    save_project(proj)
    return {
        "project_id": project_id,
        "total_cleaned": cleaned_count,
        "scenes": scenes,
    }


def clear_all_scene_images(project_id: str) -> Dict[str, Any]:
    """Delete all generated scene image files and reset scene statuses to pending."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    pdir = get_project_dir(project_id)
    scene_dir = pdir / "scenes"

    deleted_count = 0
    if scene_dir.exists():
        for img_file in scene_dir.glob("scene_*.png"):
            try:
                img_file.unlink(missing_ok=True)
                deleted_count += 1
            except Exception as e:
                logger.warning("Failed to delete scene image %s: %s", img_file, e)

    scenes = proj.get("scenes", [])
    for sc in scenes:
        sc["image_url"] = ""
        sc["cdn_url"] = ""
        sc["media_id"] = ""
        sc["status"] = "pending"
        sc["watermark_removed"] = False
        sc["error"] = None

    save_project(proj)
    logger.info("Cleared all images for project %s (%d files deleted, %d scenes reset)", project_id, deleted_count, len(scenes))
    return {
        "project_id": project_id,
        "deleted_files_count": deleted_count,
        "reset_scenes_count": len(scenes),
        "scenes": scenes,
        "message": f"Đã xóa toàn bộ {deleted_count} file ảnh và đưa {len(scenes)} cảnh về trạng thái sẵn sàng tạo mới!",
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


def _build_ken_burns_filter(
    duration: float,
    is_hold: bool = False,
    prev_zoom_end: float = 1.0,
    motion_type: str = "zoom_in",
) -> tuple[str, float]:
    """Build smooth 24fps Ken Burns zoom/pan expression.
    
    Subtle 3-6% camera movement. For hold_frame scenes, continues previous
    scene's zoom level smoothly without sudden reset jump-cuts.
    """
    total_frames = max(1, int(round(duration * 24)))

    if is_hold and prev_zoom_end > 1.01:
        # Continue previous scene's zoom smoothly (e.g. 1.04 -> 1.08)
        z_start = min(1.055, prev_zoom_end)
        z_end = min(1.09, z_start + 0.035)
        step = (z_end - z_start) / total_frames
        z_expr = f"min({z_start:.4f}+on*{step:.6f},{z_end:.4f})"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
        new_zoom_end = z_end
    elif motion_type == "zoom_out":
        # Slow zoom out (1.05 -> 1.00)
        z_start = 1.05
        z_end = 1.00
        step = (z_start - z_end) / total_frames
        z_expr = f"max({z_start:.4f}-on*{step:.6f},{z_end:.4f})"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
        new_zoom_end = 1.00
    else:  # "zoom_in"
        # Slow zoom in (1.00 -> 1.05)
        z_start = 1.00
        z_end = 1.05
        step = (z_end - z_start) / total_frames
        z_expr = f"min({z_start:.4f}+on*{step:.6f},{z_end:.4f})"
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
        new_zoom_end = 1.05

    zf = f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':d=1:s=1920x1080:fps=24"
    return zf, new_zoom_end


async def render_final_video(
    project_id: str,
    burn_subtitles: bool = True,
    ken_burns: bool = True,
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
    for sc in scenes:
        sid = sc["id"]
        sc_img = pdir / "scenes" / f"scene_{sid:03d}.png"
        if not sc_img.exists():
            ref_img = pdir / "character_ref.png"
            if ref_img.exists():
                shutil.copyfile(ref_img, sc_img)
            else:
                raise ValueError(f"Scene {sid} has not been generated and no reference image exists.")

    output_video = pdir / "final_video.mp4"
    ffmpeg = get_ffmpeg_path()

    srt_file = pdir / "subtitles.srt"
    sub_filter = None
    if burn_subtitles:
        create_srt_file(scenes, srt_file)
        srt_escaped = str(srt_file.resolve()).replace("\\", "/").replace(":", "\\:")
        sub_filter = (
            f"subtitles='{srt_escaped}':force_style="
            f"'FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Alignment=2,MarginV=45'"
        )

    rendered_via_ken_burns = False

    if ken_burns:
        try:
            clips_dir = pdir / ".temp_clips"
            if clips_dir.exists():
                shutil.rmtree(clips_dir, ignore_errors=True)
            clips_dir.mkdir(parents=True, exist_ok=True)

            # Build motion parameters per scene with hold_frame camera continuity
            prev_zoom_end = 1.0
            clip_tasks_info = []
            for idx, sc in enumerate(scenes):
                dur = max(0.5, round(sc.get("end_s", sc.get("start_s", 0.0) + 3.0) - sc.get("start_s", 0.0), 2))
                is_hold = (sc.get("transition_type") == "hold_frame")
                motion_type = "zoom_out" if (idx % 4 == 3 and not is_hold) else "zoom_in"
                zf, new_zoom = _build_ken_burns_filter(dur, is_hold=is_hold, prev_zoom_end=prev_zoom_end, motion_type=motion_type)
                prev_zoom_end = new_zoom
                clip_tasks_info.append((sc, zf, dur))

            sem = asyncio.Semaphore(4)

            async def _render_clip(sc_item, zoom_f, duration_s):
                s_id = sc_item["id"]
                img_p = pdir / "scenes" / f"scene_{s_id:03d}.png"
                c_out = clips_dir / f"clip_{s_id:03d}.mp4"
                cmd_clip = [
                    ffmpeg, "-y",
                    "-framerate", "24",
                    "-loop", "1",
                    "-t", str(duration_s),
                    "-i", str(img_p.resolve()),
                    "-vf", f"scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,{zoom_f},format=yuv420p",
                    "-c:v", "libx264",
                    "-preset", "veryfast",
                    "-crf", "20",
                    "-r", "24",
                    str(c_out.resolve()),
                ]
                async with sem:
                    proc = await asyncio.create_subprocess_exec(
                        *cmd_clip,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    _, stderr = await proc.communicate()
                    if proc.returncode != 0:
                        err = stderr.decode("utf-8", errors="ignore")
                        raise RuntimeError(f"FFmpeg error on scene clip #{s_id}: {err[-200:]}")
                return c_out

            logger.info("Generating %d Ken Burns scene clips...", len(clip_tasks_info))
            await asyncio.gather(*[_render_clip(sc, zf, dur) for sc, zf, dur in clip_tasks_info])

            # Write manifest using relative paths inside clips_dir
            manifest_lines = ["ffconcat version 1.0"]
            for sc in scenes:
                manifest_lines.append(f"file 'clip_{sc['id']:03d}.mp4'")
            clips_manifest = clips_dir / "manifest.txt"
            clips_manifest.write_text("\n".join(manifest_lines), encoding="utf-8")

            # Final assembly command from clips
            cmd_final = [
                ffmpeg, "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(clips_manifest.resolve()),
                "-i", str(audio_file.resolve()),
            ]
            if sub_filter:
                cmd_final.extend([
                    "-vf", sub_filter,
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "20",
                ])
            else:
                cmd_final.extend(["-c:v", "copy"])

            cmd_final.extend([
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_video.resolve()),
            ])

            logger.info("Assembling Ken Burns video with audio: %s", " ".join(cmd_final))
            proc_final = await asyncio.create_subprocess_exec(
                *cmd_final,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc_final.communicate()
            if proc_final.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="ignore")
                logger.warning("Ken Burns concat failed (%s), falling back to static concat...", err_msg[-200:])
            else:
                rendered_via_ken_burns = True

            # Clean up temporary clips
            shutil.rmtree(clips_dir, ignore_errors=True)

        except Exception as kb_err:
            logger.warning("Ken Burns rendering encountered an error: %s. Falling back to static concat.", kb_err)

    if not rendered_via_ken_burns:
        # Standard static image concat manifest (fallback or when ken_burns=False)
        manifest_lines = ["ffconcat version 1.0"]
        for sc in scenes:
            sid = sc["id"]
            sc_img = pdir / "scenes" / f"scene_{sid:03d}.png"
            dur = max(0.5, round(sc.get("end_s", sc.get("start_s", 0.0) + 3.0) - sc.get("start_s", 0.0), 2))
            path_escaped = str(sc_img.resolve()).replace("\\", "/")
            manifest_lines.append(f"file '{path_escaped}'")
            manifest_lines.append(f"duration {dur}")

        last_img = pdir / "scenes" / f"scene_{scenes[-1]['id']:03d}.png"
        manifest_lines.append(f"file '{str(last_img.resolve()).replace(chr(92), '/')}'")

        manifest_path = pdir / "concat_manifest.txt"
        manifest_path.write_text("\n".join(manifest_lines), encoding="utf-8")

        vf_filters = [
            "scale=1920:1080:force_original_aspect_ratio=decrease",
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
            "format=yuv420p",
        ]
        if sub_filter:
            vf_filters.append(sub_filter)

        cmd = [
            ffmpeg, "-y",
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

        logger.info("Rendering static video via FFmpeg: %s", " ".join(cmd))
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err_msg = stderr.decode("utf-8", errors="ignore")
            logger.error("FFmpeg failed: %s", err_msg)
            raise RuntimeError(f"FFmpeg error: {err_msg[-400:]}")

    rel_video_url = f"/output/story_studio/{project_id}/final_video.mp4?t={int(time.time())}"
    video_size = output_video.stat().st_size if output_video.exists() else 0

    proj["video_url"] = rel_video_url
    proj["video_size"] = video_size
    proj["has_subtitles"] = burn_subtitles
    proj["ken_burns"] = ken_burns
    proj["current_stage"] = 6
    save_project(proj)

    return {
        "video_url": rel_video_url,
        "file_size": video_size,
        "duration": proj.get("audio_duration", 0),
        "ken_burns": ken_burns,
    }


# ── Stage 7: Viral YouTube SEO & Thumbnail Kit ─────────────────────────

SYSTEM_PROMPT_YOUTUBE_SEO = """You are a World-Class YouTube Growth Strategist & Viral Metadata Architect specializing in high-CTR educational explainer channels (Kurzgesagt – In a Nutshell, MinutePhysics, Veritasium, Johnny Harris, AsapSCIENCE).

CRITICAL REQUIREMENT:
ALL OUTPUT MUST BE 100% IN ENGLISH. Never use Vietnamese or other languages. This metadata is strictly for a global English YouTube audience.

Follow these strict viral YouTube standards:
1. TITLES (5 Distinct English Hook Formulas, MAX 65-70 characters each):
   - Formula 1 (Question Hook): Intense curiosity question that the viewer MUST click to find out (e.g. "How Did Ancient Humans Avoid Pregnancy?").
   - Formula 2 (Shocking Statement): Counters common wisdom with an unbelievable fact (e.g. "Ancient Birth Control Was Pure Insanity").
   - Formula 3 (Paradox / Contradiction): Two opposing ideas in conflict (e.g. "No Doctors, No Pills, Yet It Worked").
   - Formula 4 (Secret / Revelation): Uncovering hidden history or suppressed biological truths (e.g. "The Banned Herb That Rome Used For Centuries").
   - Formula 5 (Numbers & Stakes): Specific metrics and timeframes (e.g. "300,000 Years of Primitive Medicine Explained").
   Every title must feature high-power words, high curiosity gap, and optional clean bracket tags like [Explained] or [Animation] or [Documentary].

2. DESCRIPTION (3-Zone YouTube Explainer Architecture, 100% English):
   - Zone 1 (Above the Fold - first 150 chars): Irresistible hook sentence restating the mystery + Call-to-action (Subscribe).
   - Zone 2 (Story Deep-Dive & Chapters): 2-3 engaging paragraphs exploring the core scientific/historical mystery without spoilers, followed by 5-8 chronological Chapter Timestamps (e.g. "00:00 The Ancient Dilemma\\n01:15 Herbal Secrets...").
   - Zone 3 (SEO Footer): 4-6 viral hashtags (#ancienthistory, #science, #animation...), targeted search keywords, and animation credits.

3. TAGS (100% English):
   - 15-20 comma-separated high-volume English search keywords (mix of broad educational keywords, long-tail search queries, and specific historical/scientific terms).

4. THUMBNAIL CONCEPTS (4 High-CTR 2D Doodle Variants):
   For each variant, provide:
   - "variant": integer (1 to 4)
   - "name": English concept title (e.g., "Variant 1: The Forgotten Method", "Variant 2: Split-Screen Nomadic vs Modern", "Variant 3: The Energy Threshold", "Variant 4: The Ancient Secret")
   - "slogan": An ultra-compelling, topic-specific YouTube thumbnail slogan / hook phrase.
     STRICT LENGTH & PSYCHOLOGY RULES:
     * Length: Strictly 3 to 6 words (NEVER too short like 1-2 words; NEVER too long like 7+ words).
     * Style: ALL CAPS (e.g. "NO PILLS FOR 300,000 YEARS", "THE SECRET THEY FORGOT", "THEY KNEW THE TRICK!", "HOW DID THEY SURVIVE?!", "NATURE'S 4-YEAR SECRET", "BEFORE MODERN MEDICINE EXISTED").
     * Must be directly relevant to the video topic, creating an irresistible curiosity gap that drives clicks.
   - "hook_text": (set to the exact same value as "slogan")
   - "visual_description": Clear visual breakdown of doodle stick figure expression, props, and composition.
   - "prompt": Complete English generation prompt for Google Flow. MUST explicitly instruct the AI image generator to draw this exact slogan directly into the artwork as prominent, large bold comic/doodle typography:
     "Hand-drawn 2D doodle cartoon animation, [scene composition & stick figure action], prominently featuring large bold graphic cartoon typography reading \"{slogan}\" written in vibrant high-contrast letters with thick black outlines across the top of the scene, flat solid colors, high CTR YouTube thumbnail style, 16:9 widescreen, clean vector doodle art, eye-catching composition."

OUTPUT FORMAT:
Return strictly a valid JSON object:
{
  "titles": [
    {"type": "Question Hook", "title": "..."},
    {"type": "Shocking Statement", "title": "..."},
    {"type": "Paradox / Contradiction", "title": "..."},
    {"type": "Secret / Revelation", "title": "..."},
    {"type": "Numbers & Stakes", "title": "..."}
  ],
  "description": "...",
  "tags": "tag1, tag2, tag3, ...",
  "hashtags": ["#ancienthistory", "#education", ...],
  "thumbnail_concepts": [
    {
      "variant": 1,
      "name": "The Forgotten Method",
      "slogan": "THE SECRET THEY FORGOT",
      "hook_text": "THE SECRET THEY FORGOT",
      "visual_description": "...",
      "prompt": "Hand-drawn 2D doodle cartoon animation, minimalist stick figure woman carrying a toddler across a vast desert with shocked wide-eyed expression, prominently featuring large bold graphic cartoon typography reading \"THE SECRET THEY FORGOT\" written in vibrant yellow letters with thick black outlines across the top of the scene, flat solid colors, high CTR YouTube thumbnail style, 16:9 widescreen"
    }
  ]
}
"""


async def generate_youtube_metadata_ai(
    project_id: str,
    language: str = "en",
    base_url: str = "",
    api_key: str = "",
    model: str = "",
    custom_instructions: str = "",
) -> Dict[str, Any]:
    """Generate viral YouTube titles, description with chapters, tags, and 4 thumbnail concepts (100% English)."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    title = proj.get("title", "")
    script_text = proj.get("script_text", "")
    scenes = proj.get("scenes", [])
    prompt_style = proj.get("prompt_style", "forgotten_civilizations")
    hero_lock = proj.get("hero_lock", DEFAULT_HERO_LOCK)

    # Sample strategic milestone timestamps for chapters
    sampled_chapters = []
    if scenes:
        step = max(1, len(scenes) // 6)
        for i in range(0, len(scenes), step):
            sc = scenes[i]
            ts = sc.get("timestamp_str", "").strip("[]")
            txt = sc.get("text", "")[:40].strip()
            if ts:
                sampled_chapters.append(f"{ts} - {txt}")
        # Always include first and last
        if sampled_chapters and not sampled_chapters[0].startswith("00:00"):
            sampled_chapters.insert(0, "00:00 - Introduction")

    burl = (base_url or STORY_AI_BASE_URL).rstrip("/")
    key = api_key or STORY_AI_API_KEY
    mod = model or STORY_AI_MODEL

    if not key or not burl:
        raise RuntimeError("Chưa cấu hình API Key hoặc Base URL cho AI Director.")

    lang_instr = "ENGLISH ONLY (High-CTR viral educational YouTube voice like Kurzgesagt, MinutePhysics, Veritasium). All titles, description, chapters, tags, and thumbnail text MUST be strictly 100% in English."

    user_prompt = f"""=== PROJECT TOPIC & TITLE ===
{title}

=== STORY STYLE & GENRE ===
Style: {prompt_style}
Hero anchor: {hero_lock}

=== FULL SCRIPT / NARRATIVE ===
{script_text[:4000]}

=== TIMELINE CHAPTER MILESTONES ===
{chr(10).join(sampled_chapters[:8])}

=== INSTRUCTION ===
Generate complete viral YouTube metadata in {lang_instr}.
{f'Custom notes: {custom_instructions}' if custom_instructions else ''}

Ensure:
1. All 5 titles are 100% in English, under 65 characters with extreme clickability.
2. Description has 3 zones, including the timeline chapters formatted as 'mm:ss - Chapter Title' in English.
3. 15-20 comma-separated SEO tags in English.
4. 4 High-CTR 2D Doodle Thumbnail concepts with English names, English hook text, and complete Google Flow English prompts.

Return strictly the valid JSON object:"""

    async with httpx.AsyncClient(timeout=120.0) as client:
        content = await _call_llm_completion(
            client=client,
            url=f"{burl}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            payload={
                "model": mod,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT_YOUTUBE_SEO},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.4,
            },
            stream=True,
        )

    # Parse JSON
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()

    metadata: Dict[str, Any] = {}
    try:
        metadata = json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                metadata = json.loads(m.group(0))
            except Exception:
                pass

    if not metadata or not metadata.get("titles"):
        logger.warning("Failed to parse YouTube metadata JSON, raw response: %s", content[:300])
        raise RuntimeError("AI không trả về cấu trúc JSON metadata hợp lệ. Vui lòng thử lại.")

    proj["youtube_metadata"] = metadata
    save_project(proj)

    return metadata


async def generate_thumbnail_image(
    project_id: str,
    prompt: str,
    image_model: str = "BELUGA",
    timeout_seconds: float = 60.0,
    flow_project_id: str = "",
    hook_text: str = "",
    burn_text: bool = False,
) -> Dict[str, Any]:
    """Generate a high-CTR YouTube thumbnail via Google Flow with Hero Lock and AI integrated typography."""
    client = get_flow_client()
    if not client.connected:
        raise RuntimeError("Flow Extension is not connected. Open flow.google.com and connect extension.")

    proj = get_project(project_id) or {}
    pid = flow_project_id or proj.get("flow_project_id") or ""
    effective_char_id = proj.get("character_media_id", "")
    refs = [effective_char_id] if effective_char_id else []

    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("Thumbnail prompt cannot be empty.")

    # Automatically ensure viral slogan typography instruction is included in the prompt
    ht = hook_text.strip()
    if ht and f'"{ht}"' not in clean_prompt and f"'{ht}'" not in clean_prompt:
        clean_prompt += f', prominently featuring large bold graphic cartoon typography reading "{ht}" in vibrant letters with thick black outlines across the top'

    try:
        res = await asyncio.wait_for(
            client.generate_images(
                prompt=clean_prompt,
                project_id=pid,
                character_media_ids=refs,
                aspect_ratio="IMAGE_ASPECT_RATIO_LANDSCAPE",
                image_model=image_model,
                count=1,
            ),
            timeout=float(timeout_seconds or 60.0),
        )
    except asyncio.TimeoutError:
        raise RuntimeError(f"Tạo thumbnail quá {int(timeout_seconds)}s (Timeout).")

    if res.get("status", 200) >= 400 or res.get("error"):
        err_msg = str(res.get("error") or res.get("data") or "Flow thumbnail generation failed")
        raise RuntimeError(err_msg)

    media_list = res.get("data", {}).get("media", [])
    if not media_list:
        raise RuntimeError("No media returned by Flow generator for thumbnail")

    first_item = media_list[0]
    cdn_url = (
        first_item.get("url")
        or first_item.get("image", {}).get("generatedImage", {}).get("fifeUrl")
        or first_item.get("image", {}).get("fifeUrl")
        or first_item.get("fifeUrl")
    )
    if not cdn_url:
        raise RuntimeError(f"No image URL returned by Flow for thumbnail. Response: {first_item}")

    pdir = get_project_dir(project_id)
    thumb_path = pdir / "thumbnail.png"

    # Download locally
    watermark_removed = False
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http:
            img_resp = await http.get(cdn_url)
            if img_resp.status_code == 200:
                thumb_path.write_bytes(img_resp.content)
                # Auto-remove Gemini watermark if possible
                try:
                    watermark_removed = remove_gemini_watermark_from_file(thumb_path)
                except Exception as wm_err:
                    logger.warning("Could not remove watermark from thumbnail: %s", wm_err)
                
                # Keep raw copy for re-burning text
                try:
                    raw_path = pdir / "thumbnail_raw.png"
                    shutil.copy2(thumb_path, raw_path)
                except Exception:
                    pass
    except Exception as e:
        logger.warning("Could not cache thumbnail locally: %s", e)

    # Automatically overlay bold hook text if requested and available
    text_burned = False
    if burn_text and hook_text.strip() and thumb_path.exists():
        try:
            burn_thumbnail_text(project_id, text=hook_text.strip(), position="top_left", color="yellow")
            text_burned = True
        except Exception as burn_err:
            logger.warning("Could not burn hook text onto thumbnail: %s", burn_err)

    now_ts = int(time.time())
    local_url = f"/output/story_studio/{project_id}/thumbnail.png?t={now_ts}"
    final_url = local_url if thumb_path.exists() else cdn_url

    proj = get_project(project_id) or {}
    proj["thumbnail_url"] = final_url
    proj["thumbnail_watermark_removed"] = watermark_removed
    if text_burned:
        proj["thumbnail_hook_text"] = hook_text.strip()
        proj["thumbnail_text_burned"] = True
    save_project(proj)

    return {
        "project_id": project_id,
        "thumbnail_url": final_url,
        "cdn_url": cdn_url,
        "thumbnail_watermark_removed": watermark_removed,
        "thumbnail_text_burned": text_burned,
        "hook_text": hook_text.strip() if text_burned else "",
        "status": "completed",
    }


def remove_thumbnail_watermark(project_id: str) -> Dict[str, Any]:
    """Remove watermark from the project's generated thumbnail image file."""
    pdir = get_project_dir(project_id)
    thumb_path = pdir / "thumbnail.png"
    if not thumb_path.exists():
        raise FileNotFoundError(f"Chưa có ảnh thumbnail tại {thumb_path}. Vui lòng tạo thumbnail trước.")

    ok = remove_gemini_watermark_from_file(thumb_path)
    if not ok:
        raise RuntimeError("Không thể xóa watermark trên ảnh thumbnail (opencv-python không xử lý được)")

    raw_path = pdir / "thumbnail_raw.png"
    if raw_path.exists():
        try:
            remove_gemini_watermark_from_file(raw_path)
        except Exception:
            pass

    proj = get_project(project_id)
    now_ts = int(time.time())
    local_url = f"/output/story_studio/{project_id}/thumbnail.png?t={now_ts}"
    proj["thumbnail_url"] = local_url
    proj["thumbnail_watermark_removed"] = True
    save_project(proj)

    return {
        "project_id": project_id,
        "thumbnail_url": local_url,
        "thumbnail_watermark_removed": True,
        "status": "success",
    }


def burn_thumbnail_text(
    project_id: str,
    text: str = "",
    position: str = "top_left",
    color: str = "yellow",
) -> Dict[str, Any]:
    """Overlay large, bold, high-contrast YouTube thumbnail hook typography onto thumbnail.png."""
    pdir = get_project_dir(project_id)
    thumb_path = pdir / "thumbnail.png"
    if not thumb_path.exists():
        raise FileNotFoundError(f"Chưa có ảnh thumbnail tại {thumb_path}. Vui lòng tạo thumbnail trước.")

    hook_text = (text or "").strip()
    if not hook_text:
        proj = get_project(project_id) or {}
        ym = proj.get("youtube_metadata", {})
        concepts = ym.get("thumbnail_concepts", [])
        if concepts:
            hook_text = concepts[0].get("hook_text", "")

    if not hook_text:
        raise ValueError("Chưa có nội dung chữ hook để đè lên thumbnail.")

    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(thumb_path).convert("RGBA")
    w, h = img.size

    font_candidates = [
        r"C:\Windows\Fonts\impact.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\seguiemj.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
    ]
    font_path = None
    for fc in font_candidates:
        if os.path.exists(fc):
            font_path = fc
            break

    # Responsive font sizing (approx 10-12% of image height)
    font_size = max(44, int(h * 0.11))
    if len(hook_text) > 16:
        font_size = int(font_size * 0.75)
    elif len(hook_text) > 10:
        font_size = int(font_size * 0.88)

    try:
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
    except Exception:
        font = ImageFont.load_default()

    draw = ImageDraw.Draw(img)

    fill_map = {
        "yellow": "#FFE600",
        "white": "#FFFFFF",
        "red": "#FF2A2A",
        "cyan": "#00E5FF",
    }
    fill_color = fill_map.get(color.lower(), "#FFE600")
    stroke_color = "#000000"
    stroke_width = max(6, int(font_size * 0.08))

    bbox = draw.textbbox((0, 0), hook_text, font=font, stroke_width=stroke_width)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    pad_x = int(w * 0.05)
    pad_y = int(h * 0.06)

    if position == "top_left":
        pos_x = pad_x
        pos_y = pad_y
    elif position == "top_center":
        pos_x = (w - text_w) // 2
        pos_y = pad_y
    elif position == "top_right":
        pos_x = w - text_w - pad_x
        pos_y = pad_y
    elif position == "bottom_left":
        pos_x = pad_x
        pos_y = h - text_h - pad_y
    elif position == "bottom_center":
        pos_x = (w - text_w) // 2
        pos_y = h - text_h - pad_y
    else:
        pos_x = pad_x
        pos_y = pad_y

    # Shadow offset
    shadow_offset = max(4, int(stroke_width * 0.8))
    draw.text(
        (pos_x + shadow_offset, pos_y + shadow_offset),
        hook_text,
        font=font,
        fill=(0, 0, 0, 190),
        stroke_width=stroke_width,
        stroke_fill=(0, 0, 0, 190),
    )

    # Main text with thick stroke
    draw.text(
        (pos_x, pos_y),
        hook_text,
        font=font,
        fill=fill_color,
        stroke_width=stroke_width,
        stroke_fill=stroke_color,
    )

    final_img = img.convert("RGB")
    final_img.save(thumb_path, format="PNG")

    now_ts = int(time.time())
    local_url = f"/output/story_studio/{project_id}/thumbnail.png?t={now_ts}"

    proj = get_project(project_id) or {}
    proj["thumbnail_url"] = local_url
    proj["thumbnail_hook_text"] = hook_text
    proj["thumbnail_text_burned"] = True
    save_project(proj)

    return {
        "status": "success",
        "thumbnail_url": local_url,
        "hook_text": hook_text,
        "position": position,
        "color": color,
    }

