from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import typing as t

import requests
from websockets.client import connect

log = logging.getLogger("api")

DEFAULT_MANAGER_URL = "https://base.manager.iblai.app"
DEFAULT_ASGI_URL = "wss://asgi.data.iblai.app"
MANAGER_URL = os.getenv("IBL_MANAGER_URL", DEFAULT_MANAGER_URL) or DEFAULT_MANAGER_URL
ASGI_URL = os.getenv("IBL_ASGI_URL", DEFAULT_ASGI_URL) or DEFAULT_ASGI_URL


def create_mentor(
    api_token: str, tenant: str, username: str, settings: dict[str, str]
) -> dict[str, t.Any]:
    """Create a new agent with the provided settings."""
    headers = {"Authorization": f"Api-Token {api_token}"}
    resp = requests.post(
        f"{MANAGER_URL}/api/ai-agent/orgs/{tenant}/users/{username}/agent-with-settings/",
        headers=headers,
        json=settings,
    )
    if not resp.ok:
        log.error(
            "Failed to create agent (status=%s): %s",
            resp.status_code,
            resp.text,
        )
        sys.exit(1)
    return resp.json()


def create_chat_session(username: str, tenant: str, mentor_unique_id: str) -> str:
    """Create a new chat session for the given user and agent."""
    resp = requests.post(
        f"{MANAGER_URL}/api/ai-agent/orgs/{tenant}/users/{username}/sessions/",
        json={"agent": mentor_unique_id},
    )
    if not resp.ok:
        log.error(
            "Failed to create chat session (status=%s): %s",
            resp.status_code,
            resp.json(),
        )
        sys.exit(1)
    session_id = resp.json().get("session_id")
    return session_id


async def chat_with_websocket(
    prompt: str, session_id: str, agent: str, tenant: str, username: str, api_key: str
):
    data = {
        "flow": {
            "name": agent,
            "tenant": tenant,
            "username": username,
            "pathway": agent,
        },
        "session_id": session_id,
        "token": api_key,
        "prompt": prompt,
    }

    ws = await connect(f"{ASGI_URL}/ws/langflow/")
    log.info("Connected to Agent")
    print("Response: ", end="")
    await ws.send(json.dumps(data))
    eos = False
    while not eos:
        try:
            data = await asyncio.wait_for(ws.recv(), timeout=10)
            msg: dict[str, str] = json.loads(data)
            if "error" in msg:
                log.error("Error from server: %s", msg["error"])
                await ws.close()
                sys.exit(1)

            if "data" in msg:
                print(msg["data"], end="", flush=True)

            if msg.get("eos"):
                eos = True
                print("")

        except asyncio.TimeoutError:
            log.warning("Timeout while waiting for response. Exiting...")
            await ws.close()
            sys.exit(1)

    await ws.close()


def validate_env(*args: str) -> None:
    """Validate that all required environment variables are set."""
    for key in args:
        if not os.getenv(key, None):
            log.error(f"Environment variable {key} is not set.")
            sys.exit(1)
