import jwt
import time

from app.config import (
    JWT_SECRET,
    JWT_EXPIRE
)


def create_token(
    fs_id: str,
    file_type: str = "stream"
):

    payload = {
        "fs_id": fs_id,
        "type": file_type,
        "exp": int(time.time()) + JWT_EXPIRE
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )


def verify_token(token: str):

    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"]
    )
