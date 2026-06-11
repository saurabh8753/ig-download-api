from fastapi import APIRouter
from fastapi.responses import StreamingResponse

import aiohttp

from app.services.jwt_service import (
    verify_token
)

from app.services.terabox import (
    get_dlink
)

router = APIRouter()


@router.get("/download")
async def download(token: str):

    payload = verify_token(token)

    fs_id = payload["fs_id"]

    dlink = await get_dlink(fs_id)

    session = aiohttp.ClientSession()

    upstream = await session.get(
        dlink,
        allow_redirects=True
    )

    async def stream():

        try:
            async for chunk in upstream.content.iter_chunked(
                1024 * 1024
            ):
                yield chunk
        finally:
            await session.close()

    return StreamingResponse(
        stream(),
        media_type=upstream.headers.get(
            "Content-Type",
            "application/octet-stream"
        )
    )
