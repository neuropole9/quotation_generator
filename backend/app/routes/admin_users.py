from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.clerk_auth import require_admin


load_dotenv()

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin Users"],
)


class CreateUserRequest(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )
    last_name: str = Field(
        default="",
        max_length=100,
    )
    email: str = Field(
        min_length=3,
        max_length=320,
    )
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class UpdateUserRequest(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )
    last_name: str = Field(
        default="",
        max_length=100,
    )


def _secret_key() -> str:
    value = os.getenv(
        "CLERK_SECRET_KEY",
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            "CLERK_SECRET_KEY is missing."
        )

    return value


def _headers() -> dict[str, str]:
    return {
        "Authorization": (
            f"Bearer {_secret_key()}"
        ),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _primary_email(
    user: dict[str, Any],
) -> str:
    email_addresses = user.get(
        "email_addresses",
        [],
    )

    if not isinstance(
        email_addresses,
        list,
    ):
        return ""

    primary_id = user.get(
        "primary_email_address_id",
    )

    for item in email_addresses:
        if (
            isinstance(item, dict)
            and item.get("id") == primary_id
        ):
            return str(
                item.get(
                    "email_address",
                    "",
                )
            )

    if (
        email_addresses
        and isinstance(
            email_addresses[0],
            dict,
        )
    ):
        return str(
            email_addresses[0].get(
                "email_address",
                "",
            )
        )

    return ""


def _display_name(
    user: dict[str, Any],
) -> str:
    first_name = str(
        user.get(
            "first_name",
            "",
        )
        or ""
    ).strip()

    last_name = str(
        user.get(
            "last_name",
            "",
        )
        or ""
    ).strip()

    name = " ".join(
        value
        for value in [
            first_name,
            last_name,
        ]
        if value
    ).strip()

    return (
        name
        or _primary_email(user)
        or "Admin"
    )


def _role(
    user: dict[str, Any],
) -> str:
    metadata = user.get(
        "public_metadata",
        {},
    )

    if not isinstance(
        metadata,
        dict,
    ):
        return "user"

    return str(
        metadata.get(
            "role",
            "user",
        )
        or "user"
    ).strip().lower()


def _serialize_user(
    user: dict[str, Any],
) -> dict[str, Any]:
    public_metadata = user.get(
        "public_metadata",
        {},
    )

    if not isinstance(
        public_metadata,
        dict,
    ):
        public_metadata = {}

    private_metadata = user.get(
        "private_metadata",
        {},
    )

    if not isinstance(
        private_metadata,
        dict,
    ):
        private_metadata = {}

    created_by = {
        "id": str(
            private_metadata.get(
                "created_by_admin_id",
                "",
            )
            or ""
        ),
        "name": str(
            private_metadata.get(
                "created_by_admin_name",
                "",
            )
            or ""
        ),
        "email": str(
            private_metadata.get(
                "created_by_admin_email",
                "",
            )
            or ""
        ),
    }

    if not any(
        created_by.values()
    ):
        created_by = None

    return {
        "id": user.get(
            "id",
            "",
        ),
        "firstName": user.get(
            "first_name",
            "",
        )
        or "",
        "lastName": user.get(
            "last_name",
            "",
        )
        or "",
        "email": _primary_email(
            user,
        ),
        "role": public_metadata.get(
            "role",
            "user",
        ),
        "banned": bool(
            user.get(
                "banned",
                False,
            )
        ),
        "locked": bool(
            user.get(
                "locked",
                False,
            )
        ),
        "createdAt": user.get(
            "created_at",
        ),
        "updatedAt": user.get(
            "updated_at",
        ),
        "lastSignInAt": user.get(
            "last_sign_in_at",
        ),
        "createdBy": created_by,
    }


def _clerk_error_message(
    response: httpx.Response,
    fallback: str,
) -> str:
    try:
        body = response.json()
    except ValueError:
        return fallback

    if not isinstance(
        body,
        dict,
    ):
        return fallback

    errors = body.get(
        "errors",
    )

    if (
        isinstance(
            errors,
            list,
        )
        and errors
        and isinstance(
            errors[0],
            dict,
        )
    ):
        first_error = errors[0]

        return str(
            first_error.get(
                "long_message",
            )
            or first_error.get(
                "message",
            )
            or fallback
        )

    return str(
        body.get(
            "message",
        )
        or fallback
    )


async def _get_clerk_user(
    user_id: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.get(
            (
                "https://api.clerk.com/v1/users/"
                f"{user_id}"
            ),
            headers=_headers(),
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_clerk_error_message(
                response,
                "Unable to load the Clerk user.",
            ),
        )

    body = response.json()

    if not isinstance(
        body,
        dict,
    ):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid Clerk user response.",
        )

    return body


def _ensure_manageable_user(
    target_user: dict[str, Any],
    admin: dict[str, Any],
) -> None:
    target_id = str(
        target_user.get(
            "id",
            "",
        )
        or ""
    )

    admin_id = str(
        admin.get(
            "id",
            "",
        )
        or ""
    )

    if (
        target_id
        and target_id == admin_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "You cannot edit, deactivate, or delete "
                "your own admin account here."
            ),
        )

    if _role(
        target_user,
    ) == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Admin accounts are protected from these "
                "user-management actions."
            ),
        )


@router.get("")
async def list_users(
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.get(
            "https://api.clerk.com/v1/users",
            headers=_headers(),
            params={
                "limit": 100,
                "offset": 0,
                "order_by": "-created_at",
            },
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_clerk_error_message(
                response,
                "Unable to load users from Clerk.",
            ),
        )

    raw_users = response.json()

    if not isinstance(
        raw_users,
        list,
    ):
        raw_users = []

    users = [
        _serialize_user(
            user,
        )
        for user in raw_users
        if isinstance(
            user,
            dict,
        )
    ]

    admin_id = str(
        admin.get(
            "id",
            "",
        )
        or ""
    )

    total_users = len(
        users,
    )

    active_users = sum(
        1
        for user in users
        if not user[
            "banned"
        ]
        and not user[
            "locked"
        ]
    )

    admin_count = sum(
        1
        for user in users
        if str(
            user.get(
                "role",
                "",
            )
        ).strip().lower()
        == "admin"
    )

    created_by_me = sum(
        1
        for user in users
        if isinstance(
            user.get(
                "createdBy",
            ),
            dict,
        )
        and str(
            user["createdBy"].get(
                "id",
                "",
            )
        )
        == admin_id
    )

    return {
        "users": users,
        "count": total_users,
        "summary": {
            "totalUsers": total_users,
            "activeUsers": active_users,
            "adminCount": admin_count,
            "createdByMe": created_by_me,
        },
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    data: CreateUserRequest,
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    email = (
        data.email.strip().lower()
    )

    if (
        "@" not in email
        or email.startswith(
            "@"
        )
        or email.endswith(
            "@"
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please enter a valid email address.",
        )

    admin_id = str(
        admin.get(
            "id",
            "",
        )
        or ""
    )

    admin_name = _display_name(
        admin,
    )

    admin_email = _primary_email(
        admin,
    )

    payload = {
        "email_address": [
            email,
        ],
        "password": data.password,
        "first_name": (
            data.first_name.strip()
        ),
        "last_name": (
            data.last_name.strip()
        ),
        "public_metadata": {
            "role": "user",
        },
        "private_metadata": {
            "created_by_admin_id": admin_id,
            "created_by_admin_name": admin_name,
            "created_by_admin_email": admin_email,
        },
    }

    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.post(
            "https://api.clerk.com/v1/users",
            headers=_headers(),
            json=payload,
        )

    if response.status_code >= 400:
        client_status = (
            response.status_code
            if 400
            <= response.status_code
            < 500
            else status.HTTP_502_BAD_GATEWAY
        )

        raise HTTPException(
            status_code=client_status,
            detail=_clerk_error_message(
                response,
                "Unable to create the Clerk user.",
            ),
        )

    user = response.json()

    return {
        "message": "User created successfully.",
        "user": _serialize_user(
            user,
        ),
    }


@router.patch(
    "/{user_id}",
)
async def update_user(
    user_id: str,
    data: UpdateUserRequest,
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    target_user = await _get_clerk_user(
        user_id,
    )

    _ensure_manageable_user(
        target_user,
        admin,
    )

    payload = {
        "first_name": (
            data.first_name.strip()
        ),
        "last_name": (
            data.last_name.strip()
        ),
    }

    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.patch(
            (
                "https://api.clerk.com/v1/users/"
                f"{user_id}"
            ),
            headers=_headers(),
            json=payload,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=(
                response.status_code
                if 400
                <= response.status_code
                < 500
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail=_clerk_error_message(
                response,
                "Unable to update the user.",
            ),
        )

    body = response.json()

    return {
        "message": "User updated successfully.",
        "user": _serialize_user(
            body,
        ),
    }


@router.post(
    "/{user_id}/ban",
)
async def ban_user(
    user_id: str,
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    target_user = await _get_clerk_user(
        user_id,
    )

    _ensure_manageable_user(
        target_user,
        admin,
    )

    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.post(
            (
                "https://api.clerk.com/v1/users/"
                f"{user_id}/ban"
            ),
            headers=_headers(),
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=(
                response.status_code
                if 400
                <= response.status_code
                < 500
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail=_clerk_error_message(
                response,
                "Unable to deactivate the user.",
            ),
        )

    body = response.json()

    return {
        "message": "User deactivated successfully.",
        "user": _serialize_user(
            body,
        ),
    }


@router.post(
    "/{user_id}/unban",
)
async def unban_user(
    user_id: str,
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    target_user = await _get_clerk_user(
        user_id,
    )

    _ensure_manageable_user(
        target_user,
        admin,
    )

    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.post(
            (
                "https://api.clerk.com/v1/users/"
                f"{user_id}/unban"
            ),
            headers=_headers(),
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=(
                response.status_code
                if 400
                <= response.status_code
                < 500
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail=_clerk_error_message(
                response,
                "Unable to reactivate the user.",
            ),
        )

    body = response.json()

    return {
        "message": "User reactivated successfully.",
        "user": _serialize_user(
            body,
        ),
    }


@router.delete(
    "/{user_id}",
)
async def delete_user(
    user_id: str,
    admin: dict[str, Any] = Depends(
        require_admin,
    ),
):
    target_user = await _get_clerk_user(
        user_id,
    )

    _ensure_manageable_user(
        target_user,
        admin,
    )

    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.delete(
            (
                "https://api.clerk.com/v1/users/"
                f"{user_id}"
            ),
            headers=_headers(),
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=(
                response.status_code
                if 400
                <= response.status_code
                < 500
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail=_clerk_error_message(
                response,
                "Unable to delete the user.",
            ),
        )

    return {
        "message": "User deleted successfully.",
        "userId": user_id,
    }
