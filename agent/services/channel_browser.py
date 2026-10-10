"""Channel Browser Service — Isolated Chrome Profiles & DrissionPage Anti-Detect.

Manages dedicated Chromium user-data profiles for each YouTube channel.
Features:
1. Complete profile isolation (independent cookies, local storage, sessions, cache).
2. Anti-detect automation flags (suppresses navigator.webdriver).
3. Dedicated CDP debug port per channel to allow concurrent multi-channel windows.
4. One-click launch for interactive YouTube Studio management.
"""

import logging
import os
import shutil
import socket
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from agent.config import OUTPUT_DIR

logger = logging.getLogger(__name__)

BROWSER_PROFILES_DIR = OUTPUT_DIR / "story_studio" / "browser_profiles"
BROWSER_PROFILES_DIR.mkdir(parents=True, exist_ok=True)

CHROME_CANDIDATE_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]


def find_chrome_path() -> Optional[str]:
    """Find local Google Chrome executable."""
    for p in CHROME_CANDIDATE_PATHS:
        if os.path.exists(p):
            return p
    which_chrome = shutil.which("chrome") or shutil.which("google-chrome")
    if which_chrome:
        return which_chrome
    return None


def get_channel_profile_dir(channel_id: str) -> Path:
    """Return isolated User Data Directory path for a specific channel."""
    safe_name = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in channel_id)
    pdir = BROWSER_PROFILES_DIR / safe_name
    pdir.mkdir(parents=True, exist_ok=True)
    return pdir


def get_channel_debug_port(channel_id: str) -> int:
    """Deterministic yet isolated debugging port per channel (between 9500 and 9770)."""
    h = sum(ord(c) for c in channel_id)
    return 9500 + (h % 270)


def is_port_in_use(port: int) -> bool:
    """Check if a TCP port is currently open and bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def is_channel_browser_open(channel_id: str) -> bool:
    """Check if the channel's Chrome debugging port is active."""
    port = get_channel_debug_port(channel_id)
    return is_port_in_use(port)


def launch_channel_browser(
    channel_id: str,
    target_url: str = "https://studio.youtube.com",
    proxy: Optional[str] = None,
) -> Dict[str, Any]:
    """Launch an interactive, anti-detect Chrome browser window for a specific channel.
    
    If browser is already running on this channel's port, navigates or brings to focus.
    """
    profile_dir = get_channel_profile_dir(channel_id)
    port = get_channel_debug_port(channel_id)
    chrome_path = find_chrome_path()

    if not chrome_path:
        raise FileNotFoundError(
            "Google Chrome executable not found on the system. Please ensure Chrome is installed."
        )

    # Check if already running on this port
    if is_port_in_use(port):
        try:
            from DrissionPage import ChromiumPage, ChromiumOptions
            co = ChromiumOptions()
            co.set_local_port(port)
            page = ChromiumPage(addr_or_opts=co)
            if target_url and page.url != target_url:
                page.get(target_url)
            return {
                "ok": True,
                "status": "already_open",
                "message": f"Channel profile is already running. Focused on port {port}.",
                "port": port,
                "profile_dir": str(profile_dir),
                "url": page.url,
            }
        except Exception as e:
            logger.warning("Port %d in use but DrissionPage attach failed: %s", port, e)

    # Build anti-detect launch arguments
    args = [
        chrome_path,
        f"--user-data-dir={profile_dir}",
        f"--remote-debugging-port={port}",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        "--password-store=basic",
        "--lang=vi,en-US,en",
    ]

    if proxy:
        args.append(f"--proxy-server={proxy}")

    if target_url:
        args.append(target_url)

    # Launch Chrome as an independent GUI process (non-blocking)
    try:
        # On Windows, DETACHED_PROCESS ensures Chrome remains open even if server restarts
        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

        proc = subprocess.Popen(
            args,
            creationflags=creationflags,
            close_fds=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        logger.info(
            "Launched Chrome for channel %s (pid=%s, port=%d, profile=%s)",
            channel_id,
            proc.pid,
            port,
            profile_dir,
        )

        return {
            "ok": True,
            "status": "launched",
            "message": f"Cửa sổ trình duyệt cho kênh đã được mở thành công trên máy (Port {port}).",
            "port": port,
            "profile_dir": str(profile_dir),
            "pid": proc.pid,
            "target_url": target_url,
        }
    except Exception as e:
        logger.error("Failed to launch Chrome for channel %s: %s", channel_id, e)
        raise RuntimeError(f"Không thể mở trình duyệt: {e}")
