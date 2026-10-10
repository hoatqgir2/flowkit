"""Story Shorts Service — AI Auto-Split Shorts Extractor for Story Studio.

Features:
1. Ensure synthetic royalty-free SFX (Ding, Whoosh) generated mathematically.
2. AI Semantic Mining & Virality Scoring (25-58s micro-narratives with high hook potential).
3. Precision Voice-Only Audio Slicing + SFX Mixing (Voice at 0dB, Ding at hook, Whoosh at transitions).
4. Vertical 9:16 Video Compositing (Stacked Explainer with blurred background & hook banner).
5. Subtitle synchronization with safe-zone positioning.
"""

import asyncio
import json
import logging
import math
import os
import re
import shutil
import struct
import time
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from agent.config import (
    BASE_DIR,
    STORY_AI_BASE_URL,
    STORY_AI_API_KEY,
    STORY_AI_MODEL,
)
from agent.services.story_studio import (
    get_project,
    save_project,
    get_project_dir,
    get_ffmpeg_path,
    _call_llm_completion,
)

logger = logging.getLogger(__name__)

SFX_DIR = BASE_DIR / "agent" / "assets" / "sfx"


def ensure_sfx_assets() -> Dict[str, Path]:
    """Ensure crisp, royalty-free synthetic SFX assets (ding.wav, whoosh.wav) exist."""
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    ding_path = SFX_DIR / "ding.wav"
    whoosh_path = SFX_DIR / "whoosh.wav"

    if not ding_path.exists():
        # Ding chime: Two harmonized sine waves (A6 1760Hz + E7 2637Hz) with exponential decay
        duration = 0.6
        n_samples = int(sample_rate * duration)
        with wave.open(str(ding_path), "w") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            for i in range(n_samples):
                t = i / sample_rate
                decay = math.exp(-6.0 * t)
                val = 0.7 * math.sin(2 * math.pi * 1760 * t) + 0.3 * math.sin(2 * math.pi * 2637 * t)
                sample = int(val * decay * 32767 * 0.8)
                wav.writeframes(struct.pack("<h", max(-32768, min(32767, sample))))

    if not whoosh_path.exists():
        # Whoosh swoosh: Filtered white noise with frequency sweep and bell envelope
        import random
        duration = 0.35
        n_samples = int(sample_rate * duration)
        with wave.open(str(whoosh_path), "w") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            prev = 0.0
            for i in range(n_samples):
                t = i / duration
                envelope = math.sin(math.pi * t) ** 2
                cutoff_factor = 0.15 + 0.5 * math.sin(math.pi * t)
                noise = random.uniform(-1.0, 1.0)
                filtered = prev + cutoff_factor * (noise - prev)
                prev = filtered
                sample = int(filtered * envelope * 32767 * 0.85)
                wav.writeframes(struct.pack("<h", max(-32768, min(32767, sample))))

    return {"ding": ding_path, "whoosh": whoosh_path}


def format_srt_time(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm."""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        secs += 1
        millis = 0
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def create_shorts_srt(scenes: List[Dict[str, Any]], offset_start_s: float, srt_path: Path) -> None:
    """Create SRT file re-indexed relative to offset_start_s for the Short clip."""
    lines = []
    idx = 1
    for sc in scenes:
        orig_start = float(sc.get("start_s", 0.0))
        orig_end = float(sc.get("end_s", orig_start + 3.0))
        rel_start = max(0.0, round(orig_start - offset_start_s, 2))
        rel_end = max(rel_start + 0.5, round(orig_end - offset_start_s, 2))
        txt = (sc.get("text") or "").strip()
        if not txt:
            continue
        lines.append(f"{idx}")
        lines.append(f"{format_srt_time(rel_start)} --> {format_srt_time(rel_end)}")
        lines.append(txt)
        lines.append("")
        idx += 1

    srt_path.write_text("\n".join(lines), encoding="utf-8")


def _heuristic_find_short_candidates(scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Algorithmic fallback to find 2-4 solid short segments (50-60s each) if LLM call is unavailable."""
    candidates = []
    total_scenes = len(scenes)
    if total_scenes < 2:
        return candidates

    # Group scenes into windows of ~50-60s
    cur_start_idx = 0
    short_num = 1
    while cur_start_idx < total_scenes and short_num <= 4:
        cur_end_idx = cur_start_idx
        start_time = float(scenes[cur_start_idx].get("start_s", 0.0))
        
        while cur_end_idx < total_scenes:
            end_time = float(scenes[cur_end_idx].get("end_s", start_time + 3.0))
            dur = end_time - start_time
            if dur >= 50.0:
                # If adding this scene makes it exceed 60s and we already have >= 45s, drop it
                if dur > 60.0 and cur_end_idx > cur_start_idx:
                    prev_end = float(scenes[cur_end_idx - 1].get("end_s", start_time))
                    if (prev_end - start_time) >= 45.0:
                        cur_end_idx -= 1
                break
            cur_end_idx += 1

        if cur_end_idx >= total_scenes:
            cur_end_idx = total_scenes - 1

        actual_end_time = float(scenes[cur_end_idx].get("end_s", start_time + 50.0))
        clip_dur = max(1.0, round(actual_end_time - start_time, 2))

        if 45.0 <= clip_dur <= 60.5 or (clip_dur >= 40.0 and cur_end_idx == total_scenes - 1):
            first_text = (scenes[cur_start_idx].get("text") or "").strip()
            hook_words = re.sub(r"[^\w\s]", "", first_text).upper().split()[:6]
            hook_title = " ".join(hook_words) if hook_words else f"STORY PART #{short_num}"

            candidates.append({
                "id": f"short_{short_num}",
                "title": f"Short #{short_num}: {hook_title.title()} ⚡ #shorts",
                "description": f"Discover the shocking reality of this ancient secret. Watch until the end for the full explanation! Subscribe for more fascinating history and science insights. #shorts #history #facts",
                "hook_text": hook_title[:32],
                "hook_reason": "High pacing segment with strong narrative hook",
                "virality_score": 85 + (short_num * 2),
                "start_scene_id": scenes[cur_start_idx]["id"],
                "end_scene_id": scenes[cur_end_idx]["id"],
                "start_s": start_time,
                "end_s": actual_end_time,
                "duration_s": clip_dur,
                "hashtags": ["#shorts", "#facts", "#history", "#viral"],
                "status": "ready",
            })
            short_num += 1

        cur_start_idx = cur_end_idx + 1

    return candidates


async def analyze_shorts_candidates_ai(
    project_id: str,
    base_url: str = "",
    api_key: str = "",
    model: str = "",
    custom_instructions: str = "",
) -> List[Dict[str, Any]]:
    """Scan project transcript and scenes to identify 2-4 optimal viral shorts (25s-58s)."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    scenes = proj.get("scenes", [])
    if not scenes or len(scenes) < 2:
        raise ValueError("Project must have at least 2 scenes to extract Shorts.")

    pdir = get_project_dir(project_id)
    audio_file = pdir / "narration.mp3"
    if not audio_file.exists():
        raise ValueError("Audio narration file not found. Complete Stage 3 first.")

    title = proj.get("title", "")
    script_text = proj.get("script_text", "")

    # Format scenes list for AI
    scene_lines = []
    for sc in scenes:
        sid = sc["id"]
        s_start = float(sc.get("start_s", 0.0))
        s_end = float(sc.get("end_s", s_start + 3.0))
        s_dur = round(s_end - s_start, 2)
        txt = (sc.get("text") or "").strip()
        scene_lines.append(f"- Scene #{sid} [{s_start:.2f}s - {s_end:.2f}s, {s_dur}s]: \"{txt}\"")

    burl = (base_url or STORY_AI_BASE_URL).rstrip("/")
    key = api_key or STORY_AI_API_KEY
    mod = model or STORY_AI_MODEL

    candidates: List[Dict[str, Any]] = []

    if key and burl:
        system_prompt = (
            "You are an elite YouTube Shorts & TikTok Viral Producer specializing in educational/explainer content.\n"
            "Your task is to analyze the complete scene sequence and transcript of a video, then identify 2 to 4 "
            "highly engaging, standalone micro-stories (Shorts) that directly address the core fascinating question of the project.\n\n"
            "CRITICAL RULES:\n"
            "1. DURATION: Total duration (end_s - start_s) MUST be between 50.0s and 60.0s (strictly targeting 50-60 seconds for maximum watch-time & monetization). NEVER pick under 45s. NEVER exceed 60.0s.\n"
            "2. TOPIC RELEVANCE: Each short MUST focus on a clear, mind-blowing revelation or technique directly answering the title topic (e.g. specific ancient birth control recipes, biological nursing mechanisms, archaeological discoveries). Do NOT select generic introductory wandering scenes.\n"
            "3. STANDALONE ARC: Must start with a compelling hook scene and conclude with a satisfying payoff/twist within the 50-60s window.\n"
            "4. VIRAL TITLE: High-CTR clickbait title (under 65 chars, with emojis & punchy phrasing, e.g. 'The 3,500-Year-Old Egyptian Birth Control Recipe 🍯 #shorts').\n"
            "5. VIRAL DESCRIPTION: A compelling 2-4 sentence description for YouTube Shorts / TikTok detailing the shocking facts revealed in this clip, a clear Call-To-Action (e.g. 'Watch the full documentary on our channel for more!'), and 4-6 hashtags.\n"
            "6. OUTPUT FORMAT: Return strictly a valid JSON array of objects with keys:\n"
            "   - start_scene_id (int)\n"
            "   - end_scene_id (int)\n"
            "   - title (str, clickbait title under 65 chars with emoji)\n"
            "   - description (str, compelling 2-4 sentence SEO description with CTA and hashtags)\n"
            "   - hook_text (str, ALL-CAPS under 32 chars for topic tracking)\n"
            "   - hook_reason (str, why this segment hooks viewer)\n"
            "   - virality_score (int, 80 to 98)\n"
            "   - hashtags (list of 4-6 strings like ['#shorts', '#history', '#science'])\n"
        )

        user_prompt = (
            f"=== PROJECT TITLE ===\n{title}\n\n"
            f"=== SCRIPT OVERVIEW ===\n{script_text[:1500]}\n\n"
            f"=== SCENES WITH TIMESTAMPS ===\n" + "\n".join(scene_lines) + "\n\n"
            f"{f'Custom Director Notes: {custom_instructions}' if custom_instructions else ''}\n"
            "Analyze and return strictly the JSON array of 2 to 4 viral shorts (each 50-60s):"
        )

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
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
                        "temperature": 0.5,
                    },
                    stream=True,
                )

                # Parse JSON array from content
                cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
                m = re.search(r"\[\s*\{.*\}\s*\]", cleaned, re.DOTALL)
                if m:
                    raw_list = json.loads(m.group(0))
                    scene_map = {sc["id"]: sc for sc in scenes}
                    for idx, item in enumerate(raw_list):
                        s_id = int(item.get("start_scene_id", 1))
                        e_id = int(item.get("end_scene_id", s_id))
                        if s_id in scene_map and e_id in scene_map and e_id >= s_id:
                            st_time = float(scene_map[s_id].get("start_s", 0.0))
                            en_time = float(scene_map[e_id].get("end_s", st_time + 3.0))
                            dur = round(en_time - st_time, 2)

                            # Auto-trim trailing scene if duration slightly overshoots 60s
                            if dur > 60.0 and e_id > s_id:
                                alt_e = e_id - 1
                                alt_en = float(scene_map[alt_e].get("end_s", st_time))
                                if (alt_en - st_time) >= 45.0:
                                    e_id = alt_e
                                    en_time = alt_en
                                    dur = round(en_time - st_time, 2)

                            # Target valid 50-60s shorts window
                            if 45.0 <= dur <= 60.5:
                                candidates.append({
                                    "id": f"short_{idx + 1}",
                                    "title": item.get("title", f"Short #{idx + 1}"),
                                    "description": (item.get("description") or "").strip(),
                                    "hook_text": (item.get("hook_text") or "WATCH TILL THE END")[:32].upper(),
                                    "hook_reason": item.get("hook_reason", "Strong curiosity hook"),
                                    "virality_score": int(item.get("virality_score", 90)),
                                    "start_scene_id": s_id,
                                    "end_scene_id": e_id,
                                    "start_s": st_time,
                                    "end_s": en_time,
                                    "duration_s": dur,
                                    "hashtags": item.get("hashtags", ["#shorts", "#facts"]),
                                    "status": "ready",
                                })
        except Exception as e:
            logger.warning("LLM Shorts Candidate analysis failed (%r), using heuristic fallback...", e)

    # If LLM didn't produce candidates or failed, use heuristic
    if not candidates:
        logger.info("Using algorithmic heuristic fallback for shorts candidates...")
        candidates = _heuristic_find_short_candidates(scenes)

    # Save candidates to project
    proj["shorts_candidates"] = candidates
    save_project(proj)
    return candidates


async def render_single_short(
    project_id: str,
    short_id: str,
    layout_mode: str = "stacked",
    burn_subtitles: bool = False,
    sfx_mode: str = "none",
) -> Dict[str, Any]:
    """Render a single 9:16 Short (Clean Voice-Only, zero transition hiss, Stacked Explainer Layout)."""
    ensure_sfx_assets()
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    pdir = get_project_dir(project_id)
    ffmpeg = get_ffmpeg_path()
    audio_file = pdir / "narration.mp3"
    if not audio_file.exists():
        raise ValueError("narration.mp3 not found. Generate audio first.")

    # Find the candidate
    candidates = proj.get("shorts_candidates", [])
    cand = next((c for c in candidates if c["id"] == short_id), None)
    if not cand:
        # Check existing shorts
        shorts = proj.get("shorts", [])
        cand = next((s for s in shorts if s["id"] == short_id), None)

    if not cand:
        raise ValueError(f"Short candidate '{short_id}' not found")

    start_scene_id = int(cand["start_scene_id"])
    end_scene_id = int(cand["end_scene_id"])

    # Extract relevant scenes
    all_scenes = proj.get("scenes", [])
    target_scenes = [sc for sc in all_scenes if start_scene_id <= sc["id"] <= end_scene_id]
    if not target_scenes:
        raise ValueError(f"No scenes found between ID {start_scene_id} and {end_scene_id}")

    start_s = float(target_scenes[0].get("start_s", 0.0))
    end_s = float(target_scenes[-1].get("end_s", start_s + 3.0))
    total_duration = max(1.0, round(end_s - start_s, 2))

    shorts_dir = pdir / "shorts"
    shorts_dir.mkdir(parents=True, exist_ok=True)
    temp_clips_dir = shorts_dir / f".temp_{short_id}"
    if temp_clips_dir.exists():
        shutil.rmtree(temp_clips_dir, ignore_errors=True)
    temp_clips_dir.mkdir(parents=True, exist_ok=True)

    # 1. Ensure scene images exist
    for sc in target_scenes:
        sid = sc["id"]
        sc_img = pdir / "scenes" / f"scene_{sid:03d}.png"
        if not sc_img.exists():
            ref_img = pdir / "character_ref.png"
            if ref_img.exists():
                shutil.copyfile(ref_img, sc_img)
            else:
                raise ValueError(f"Scene image #{sid} not found and no reference image available")

    # 2. Render individual 9:16 scene clips (Clean visual, zero hook banner, yuv420p for universal compatibility)
    clip_paths = []
    sem = asyncio.Semaphore(4)

    async def _render_scene_clip(sc_item: Dict[str, Any]):
        sid = sc_item["id"]
        s_dur = max(0.5, round(float(sc_item.get("end_s", 3.0)) - float(sc_item.get("start_s", 0.0)), 2))
        img_p = pdir / "scenes" / f"scene_{sid:03d}.png"
        clip_out = temp_clips_dir / f"clip_{sid:03d}.mp4"

        if layout_mode == "stacked":
            # Stacked Explainer: Blurred 1080x1920 background + sharp 1080x608 foreground in center (no text overlays)
            filter_c = (
                "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
                "[0:v]scale=1080:608:force_original_aspect_ratio=decrease[fg];"
                "[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[out]"
            )
        else:
            # Full 9:16 crop mode (no text overlays)
            filter_c = (
                "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p[out]"
            )

        cmd = [
            ffmpeg, "-y",
            "-framerate", "24",
            "-loop", "1",
            "-t", str(s_dur),
            "-i", str(img_p.resolve()),
            "-filter_complex", filter_c,
            "-map", "[out]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-preset", "veryfast",
            "-crf", "20",
            "-r", "24",
            str(clip_out.resolve()),
        ]

        async with sem:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="ignore")
                raise RuntimeError(f"FFmpeg error on short scene #{sid}: {err_msg[-250:]}")
        return clip_out

    logger.info("Rendering %d scene clips for short '%s'...", len(target_scenes), short_id)
    clip_paths = await asyncio.gather(*[_render_scene_clip(sc) for sc in target_scenes])

    # 3. Create manifest for video concat
    manifest_file = temp_clips_dir / "manifest.txt"
    manifest_lines = ["ffconcat version 1.0"]
    for c in clip_paths:
        manifest_lines.append(f"file '{c.name}'")
    manifest_file.write_text("\n".join(manifest_lines), encoding="utf-8")

    # 4. Prepare Voice Audio (Pure clean voice, zero annoying transition noises)
    ding_file = SFX_DIR / "ding.wav"

    if sfx_mode == "ding" and ding_file.exists():
        # Soft opening ding chime at 0.1s + clean voice
        audio_inputs = [
            "-ss", str(start_s),
            "-t", str(total_duration),
            "-i", str(audio_file.resolve()),
            "-i", str(ding_file.resolve()),
        ]
        audio_filtergraph = "[2:a]adelay=100|100,volume=0.22[a_ding];[1:a][a_ding]amix=inputs=2:dropout_transition=0:normalize=0[aout]"
    else:
        # Default: Pure 100% clean voice narration, zero whoosh, zero background hiss/scratch
        audio_inputs = [
            "-ss", str(start_s),
            "-t", str(total_duration),
            "-i", str(audio_file.resolve()),
        ]
        audio_filtergraph = "[1:a]volume=1.0[aout]"

    # 5. Subtitles filter (Burn Subtitles)
    srt_file = temp_clips_dir / "subtitles.srt"
    sub_filter_str = None
    if burn_subtitles:
        create_shorts_srt(target_scenes, start_s, srt_file)
        srt_escaped = str(srt_file.resolve()).replace("\\", "/").replace(":", "\\:")
        sub_filter_str = (
            f"subtitles='{srt_escaped}':force_style="
            f"'FontName=Arial,FontSize=20,Bold=1,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Alignment=2,MarginV=30'"
        )

    # 6. Final assembly command
    output_video = shorts_dir / f"{short_id}.mp4"
    cmd_final = [
        ffmpeg, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(manifest_file.resolve()),
    ]
    cmd_final.extend(audio_inputs)

    if sub_filter_str:
        cmd_final.extend([
            "-filter_complex", f"[0:v]{sub_filter_str}[vout];{audio_filtergraph}",
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
            "-preset", "fast",
            "-crf", "20",
        ])
    else:
        cmd_final.extend([
            "-filter_complex", audio_filtergraph,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
        ])

    cmd_final.extend([
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        str(output_video.resolve()),
    ])

    logger.info("Assembling short video '%s': %s", short_id, " ".join(cmd_final[:10]))
    proc_final = await asyncio.create_subprocess_exec(
        *cmd_final,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc_final.communicate()
    if proc_final.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"FFmpeg short assembly failed: {err_msg[-350:]}")

    # 7. Generate 9:16 Thumbnail Frame at 0.8s
    thumb_file = shorts_dir / f"{short_id}_thumb.jpg"
    cmd_thumb = [
        ffmpeg, "-y",
        "-ss", "00:00:00.800",
        "-i", str(output_video.resolve()),
        "-vframes", "1",
        "-q:v", "2",
        str(thumb_file.resolve()),
    ]
    proc_th = await asyncio.create_subprocess_exec(
        *cmd_thumb,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc_th.communicate()

    # Cleanup temp directory
    shutil.rmtree(temp_clips_dir, ignore_errors=True)

    # 8. Update project metadata
    file_size = output_video.stat().st_size if output_video.exists() else 0
    short_record = {
        "id": short_id,
        "title": cand.get("title", f"Short #{short_id}"),
        "description": cand.get("description", ""),
        "hook_text": cand.get("hook_text", ""),
        "hook_reason": cand.get("hook_reason", ""),
        "virality_score": cand.get("virality_score", 92),
        "start_scene_id": start_scene_id,
        "end_scene_id": end_scene_id,
        "start_s": start_s,
        "end_s": end_s,
        "duration_s": total_duration,
        "layout_mode": layout_mode,
        "status": "completed",
        "video_url": f"/output/story_studio/{project_id}/shorts/{short_id}.mp4?t={int(time.time())}",
        "thumb_url": f"/output/story_studio/{project_id}/shorts/{short_id}_thumb.jpg?t={int(time.time())}",
        "video_size": file_size,
        "hashtags": cand.get("hashtags", ["#shorts", "#facts"]),
        "created_at": time.time(),
    }

    # Store into project.json under 'shorts'
    existing_shorts = proj.get("shorts", [])
    # Replace if exists, else append
    existing_shorts = [s for s in existing_shorts if s.get("id") != short_id]
    existing_shorts.append(short_record)
    proj["shorts"] = existing_shorts

    # Also update candidate status if present
    for c in proj.get("shorts_candidates", []):
        if c.get("id") == short_id:
            c["status"] = "completed"

    save_project(proj)
    logger.info("Successfully rendered short '%s' (%d bytes)", short_id, file_size)
    return short_record


async def batch_render_all_shorts(
    project_id: str,
    layout_mode: str = "stacked",
    burn_subtitles: bool = False,
    sfx_mode: str = "none",
) -> List[Dict[str, Any]]:
    """Batch render all available short candidates for a project."""
    proj = get_project(project_id)
    if not proj:
        raise ValueError(f"Project {project_id} not found")

    candidates = proj.get("shorts_candidates", [])
    if not candidates:
        # If no candidates yet, run analysis first
        candidates = await analyze_shorts_candidates_ai(project_id)

    results = []
    for cand in candidates:
        sid = cand["id"]
        res = await render_single_short(
            project_id=project_id,
            short_id=sid,
            layout_mode=layout_mode,
            burn_subtitles=burn_subtitles,
            sfx_mode=sfx_mode,
        )
        results.append(res)

    return results


def delete_project_short(project_id: str, short_id: str) -> bool:
    """Delete a generated short MP4 and remove its metadata record."""
    proj = get_project(project_id)
    if not proj:
        return False

    pdir = get_project_dir(project_id)
    short_video = pdir / "shorts" / f"{short_id}.mp4"
    thumb_file = pdir / "shorts" / f"{short_id}_thumb.jpg"

    if short_video.exists():
        short_video.unlink(missing_ok=True)
    if thumb_file.exists():
        thumb_file.unlink(missing_ok=True)

    # Remove from shorts list
    shorts = proj.get("shorts", [])
    proj["shorts"] = [s for s in shorts if s.get("id") != short_id]

    # Reset candidate status to ready
    for c in proj.get("shorts_candidates", []):
        if c.get("id") == short_id:
            c["status"] = "ready"

    save_project(proj)
    return True
