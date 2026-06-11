from fastapi import APIRouter

from app.services.jwt_service import (
    create_token
)

router = APIRouter()


@router.get("/token")
async def token(fs_id: str):

    return {
        "token": create_token(fs_id)
    }
