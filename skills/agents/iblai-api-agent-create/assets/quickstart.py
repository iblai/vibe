from __future__ import annotations

import asyncio
import logging
import os
import random
import sys

import api

logging.basicConfig(level=logging.INFO, format="%(message)s")

log = logging.getLogger("quickstart")

TENANT = os.getenv("IBL_TENANT", "")
USERNAME = os.getenv("IBL_USERNAME", "")
PLATFORM_API_KEY = os.getenv("IBL_PLATFORM_API_KEY", "")
MENTOR_ID = os.getenv("IBL_MENTOR_ID", "")
SESSION_ID = os.getenv("IBL_SESSION_ID", "")


def run(prompt: str, mentor_unique_id: str = "", session_id: str = "") -> None:
    """Chat with an agent using an existing agent/session or create a new one.

    - Provide a mentor_unique_id to create a new session with an existing agent.
    - Provide a mentor_unique_id and session_id to continue an existing session.
    """
    if not mentor_unique_id:
        mentor_name = f"Agent-{random.randint(0, 100)}"
        log.info("Creating a new agent: %s", mentor_name)
        mentor_settings = {
            "new_mentor_name": mentor_name,
            "template_name": "ai-agent",
            "display_name": mentor_name,
            "description": "An agent used to explain difficult concepts in simple terms",
            "system_prompt": "Explain it like the user is a 5-year-old",
        }
        agent = api.create_mentor(
            api_token=PLATFORM_API_KEY,
            tenant=TENANT,
            username=USERNAME,
            settings=mentor_settings,
        )
        mentor_unique_id = agent["unique_id"]
        log.info("Created Agent: %s", mentor_unique_id)
    else:
        log.info("Using existing Agent: %s", mentor_unique_id)

    if not session_id:
        log.info("Creating a new session for agent: %s", mentor_unique_id)
        session_id = api.create_chat_session(
            username=USERNAME,
            tenant=TENANT,
            mentor_unique_id=mentor_unique_id,
        )
        log.info("Created Session ID: %s", session_id)
    else:
        log.info("Using existing Session ID: %s", session_id)

    asyncio.run(
        api.chat_with_websocket(
            prompt=prompt,
            session_id=session_id,
            agent=mentor_unique_id,
            tenant=TENANT,
            username=USERNAME,
            api_key=PLATFORM_API_KEY,
        )
    )


if __name__ == "__main__":
    api.validate_env("IBL_TENANT", "IBL_USERNAME", "IBL_PLATFORM_API_KEY")
    log.info("Using tenant=%s, username=%s", TENANT, USERNAME)
    log.info("Using Manager URL: %s", api.MANAGER_URL)
    log.info("Using Asgi URL: %s", api.ASGI_URL)
    if len(sys.argv) < 2:
        log.error('Usage: python quickstart.py "<prompt>"')
        sys.exit(1)
    prompt = sys.argv[1]

    if SESSION_ID and not MENTOR_ID:
        log.error("Error: If IBL_SESSION_ID is set, IBL_MENTOR_ID must also be set.")
        sys.exit(1)
    # - Provide a mentor_unique_id to create a new session with an existing agent.
    # - Provide a mentor_unique_id and session_id to continue an existing session.
    run(prompt, mentor_unique_id=MENTOR_ID, session_id=SESSION_ID)
