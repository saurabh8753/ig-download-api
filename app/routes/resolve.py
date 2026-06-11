from fastapi import APIRouter

from app.services.terabox import (
    resolve_share
)

router = APIRouter()


@router.get("/resolve")
async def resolve(url: str):

    file_info = await resolve_share(url)

    return {
        "status": "success",
        "file": file_info
    }
