from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import HTTPException, Request, status

load_dotenv()


def _clerk_secret_key() -> str:
    secret_key = os.getenv("CLERK_SECRET_KEY", "").strip()
    if not secret_key:
        raise RuntimeError(
            "CLERK_SECRET_KEY is missing. Add it to backend/.env before starting the API."
        )
    return secret_key


def _authorized_parties() -> list[str]:
    parties = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    production_frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if production_frontend:
        parties.append(production_frontend)

    configured = os.getenv("CLERK_AUTHORIZED_PARTIES", "")
    if configured:
        parties.extend(
            value.strip().rstrip("/")
            for value in configured.split(",")
            if value.strip()
        )

    return list(dict.fromkeys(parties))


@lru_cache(maxsize=1)
def get_clerk() -> Clerk:
    return Clerk(bearer_auth=_clerk_secret_key())


def _as_httpx_request(request: Request) -> httpx.Request:
    return httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers),
    )


async def _get_clerk_user(user_id: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {_clerk_secret_key()}",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers=headers,
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated Clerk user was not found.",
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to retrieve the authenticated user from Clerk.",
        )

    return response.json()


async def require_clerk_user(request: Request) -> dict[str, Any]:
    """
    Verify the Clerk session token sent by the frontend and return the current user.

    Frontend header:
        Authorization: Bearer <Clerk session token>
    """
    try:
        state = get_clerk().authenticate_request(
            _as_httpx_request(request),
            AuthenticateRequestOptions(
                authorized_parties=_authorized_parties(),
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify Clerk authentication.",
        ) from exc

    if not state.is_signed_in:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = state.payload or {}
    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Clerk session.",
        )

    return await _get_clerk_user(user_id)


async def require_admin(request: Request) -> dict[str, Any]:
    user = await require_clerk_user(request)

    metadata = user.get("public_metadata")
    if not isinstance(metadata, dict):
        metadata = {}

    role = str(metadata.get("role", "")).strip().lower()

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    return user
