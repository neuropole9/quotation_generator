from __future__ import annotations

import base64
import os
from functools import lru_cache
from typing import Any

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWTError


load_dotenv()

_bearer_scheme = HTTPBearer(
    auto_error=False,
)


def _clerk_secret_key() -> str:
    value = os.getenv(
        "CLERK_SECRET_KEY",
        "",
    ).strip()

    if not value:
        raise RuntimeError(
            "CLERK_SECRET_KEY is missing."
        )

    return value


def _issuer_from_publishable_key(
    publishable_key: str,
) -> str:
    """
    Derive the Clerk instance issuer from a Clerk publishable key.

    Clerk publishable keys contain a base64-encoded frontend host.
    Example result:
        https://example.clerk.accounts.dev
    """
    value = publishable_key.strip()

    prefixes = (
        "pk_test_",
        "pk_live_",
    )

    encoded = ""

    for prefix in prefixes:
        if value.startswith(prefix):
            encoded = value[
                len(prefix):
            ]
            break

    if not encoded:
        return ""

    try:
        padding = (
            "="
            * (
                (
                    4
                    - len(encoded) % 4
                )
                % 4
            )
        )

        decoded = base64.b64decode(
            encoded + padding
        ).decode(
            "utf-8"
        )

        host = decoded.rstrip(
            "$"
        ).strip()

        if not host:
            return ""

        return f"https://{host}"

    except (
        ValueError,
        UnicodeDecodeError,
    ):
        return ""


def _clerk_issuer() -> str:
    configured = os.getenv(
        "CLERK_ISSUER",
        "",
    ).strip().rstrip("/")

    if configured:
        if not configured.startswith(
            "https://"
        ):
            raise RuntimeError(
                "CLERK_ISSUER must use https://"
            )

        return configured

    publishable_key = (
        os.getenv(
            "CLERK_PUBLISHABLE_KEY",
            "",
        ).strip()
        or os.getenv(
            "VITE_CLERK_PUBLISHABLE_KEY",
            "",
        ).strip()
    )

    derived = (
        _issuer_from_publishable_key(
            publishable_key,
        )
        if publishable_key
        else ""
    )

    if derived:
        return derived.rstrip("/")

    raise RuntimeError(
        "CLERK_ISSUER or "
        "CLERK_PUBLISHABLE_KEY is missing."
    )


def _clerk_jwks_url() -> str:
    configured = os.getenv(
        "CLERK_JWKS_URL",
        "",
    ).strip()

    if configured:
        if not configured.startswith(
            "https://"
        ):
            raise RuntimeError(
                "CLERK_JWKS_URL must use https://"
            )

        return configured

    return (
        f"{_clerk_issuer()}"
        "/.well-known/jwks.json"
    )


@lru_cache(maxsize=4)
def _jwks_client(
    jwks_url: str,
) -> PyJWKClient:
    return PyJWKClient(
        jwks_url,
        cache_keys=True,
    )


def _audience() -> str | None:
    value = os.getenv(
        "CLERK_AUDIENCE",
        "",
    ).strip()

    return value or None


def _authorized_parties() -> set[str]:
    raw = os.getenv(
        "CLERK_AUTHORIZED_PARTIES",
        "",
    ).strip()

    if not raw:
        return set()

    return {
        value.strip().rstrip("/")
        for value in raw.split(",")
        if value.strip()
    }


def _verify_session_token(
    token: str,
) -> dict[str, Any]:
    issuer = _clerk_issuer()
    jwks_url = _clerk_jwks_url()
    audience = _audience()

    signing_key = (
        _jwks_client(
            jwks_url,
        ).get_signing_key_from_jwt(
            token,
        )
    )

    options: dict[str, bool] = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_nbf": True,
        "verify_iat": True,
        "verify_iss": True,
        "verify_aud": (
            audience is not None
        ),
    }

    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=[
            "RS256",
        ],
        issuer=issuer,
        audience=audience,
        options=options,
    )

    if not isinstance(
        claims,
        dict,
    ):
        raise PyJWTError(
            "Invalid Clerk token payload."
        )

    authorized_parties = (
        _authorized_parties()
    )

    if authorized_parties:
        azp = str(
            claims.get(
                "azp",
                "",
            )
            or ""
        ).rstrip("/")

        if (
            not azp
            or azp
            not in authorized_parties
        ):
            raise PyJWTError(
                "Invalid authorized party."
            )

    user_id = str(
        claims.get(
            "sub",
            "",
        )
        or ""
    ).strip()

    if not user_id:
        raise PyJWTError(
            "Clerk token has no user id."
        )

    return claims


def _clerk_headers() -> dict[str, str]:
    return {
        "Authorization": (
            f"Bearer "
            f"{_clerk_secret_key()}"
        ),
        "Accept": "application/json",
    }


async def _load_clerk_user(
    user_id: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(
        timeout=20.0,
    ) as client:
        response = await client.get(
            (
                "https://api.clerk.com"
                f"/v1/users/{user_id}"
            ),
            headers=_clerk_headers(),
        )

    if response.status_code == 404:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Authenticated Clerk user "
                "was not found."
            ),
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Unable to load the "
                "authenticated Clerk user."
            ),
        )

    body = response.json()

    if not isinstance(
        body,
        dict,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_502_BAD_GATEWAY
            ),
            detail=(
                "Invalid Clerk user response."
            ),
        )

    return body


def get_user_role(
    user: dict[str, Any],
) -> str:
    public_metadata = user.get(
        "public_metadata",
        {},
    )

    if not isinstance(
        public_metadata,
        dict,
    ):
        public_metadata = {}

    role = str(
        public_metadata.get(
            "role",
            "user",
        )
        or "user"
    ).strip().lower()

    normalized = role.replace(
        "-",
        "_",
    ).replace(
        " ",
        "_",
    )

    if normalized in {
        "superadmin",
        "super_admin",
    }:
        return "super_admin"

    if normalized == "admin":
        return "admin"

    return "user"


def is_admin_user(
    user: dict[str, Any],
) -> bool:
    return (
        get_user_role(user)
        in {
            "admin",
            "super_admin",
        }
    )


def get_user_primary_email(
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
            isinstance(
                item,
                dict,
            )
            and item.get(
                "id",
            )
            == primary_id
        ):
            return str(
                item.get(
                    "email_address",
                    "",
                )
                or ""
            ).strip()

    for item in email_addresses:
        if isinstance(
            item,
            dict,
        ):
            value = str(
                item.get(
                    "email_address",
                    "",
                )
                or ""
            ).strip()

            if value:
                return value

    return ""


def get_user_display_name(
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

    full_name = " ".join(
        value
        for value in (
            first_name,
            last_name,
        )
        if value
    ).strip()

    if full_name:
        return full_name

    email = get_user_primary_email(
        user,
    )

    if email:
        return email

    return "User"


async def get_current_user(
    credentials: (
        HTTPAuthorizationCredentials
        | None
    ) = Depends(
        _bearer_scheme,
    ),
) -> dict[str, Any]:
    if (
        credentials is None
        or credentials.scheme.lower()
        != "bearer"
        or not credentials.credentials
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Authentication required."
            ),
            headers={
                "WWW-Authenticate":
                    "Bearer",
            },
        )

    token = (
        credentials.credentials.strip()
    )

    try:
        claims = _verify_session_token(
            token,
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Clerk authentication is "
                "not configured correctly."
            ),
        ) from exc

    except (
        PyJWTError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid or expired "
                "authentication token."
            ),
            headers={
                "WWW-Authenticate":
                    "Bearer",
            },
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Unable to verify "
                "authentication token."
            ),
            headers={
                "WWW-Authenticate":
                    "Bearer",
            },
        ) from exc

    user_id = str(
        claims.get(
            "sub",
            "",
        )
        or ""
    ).strip()

    user = await _load_clerk_user(
        user_id,
    )

    # Keep verified token claims available internally for
    # authorization/audit logic without exposing the raw token.
    user["_session_claims"] = claims

    return user


async def require_admin(
    current_user: dict[str, Any] = Depends(
        get_current_user,
    ),
) -> dict[str, Any]:
    if not is_admin_user(
        current_user,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Administrator access "
                "required."
            ),
        )

    return current_user
