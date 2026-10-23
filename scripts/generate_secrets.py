"""Print fresh application secrets for a private environment file."""

import base64
import secrets


def generate():
    return {
        "JWT_SECRET": secrets.token_urlsafe(48),
        "CREDENTIAL_ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode("ascii"),
    }


if __name__ == "__main__":
    for name, value in generate().items():
        print(f"{name}={value}")
