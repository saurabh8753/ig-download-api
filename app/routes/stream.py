from fastapi import APIRouter
from fastapi import Request
from fastapi.responses import StreamingResponse

import aiohttp

from app.services.jwt_service import (
    verify_token
)

from app.services.terabox import (
    get_dlink
)

router = APIRouter()


@router.get("/stream")
async def stream(
    request: Request,
    token: str
):

    payload = verify_token(token)

    fs_id = payload["fs_id"]

    dlink = await get_dlink(fs_id)

    headers = {}

    range_header = request.headers.get(
        "Range"
    )

    if range_header:
        headers["Range"] = range_header

    session = aiohttp.ClientSession()

    upstream = await session.get(
        dlink,
        headers=headers,
        allow_redirects=True
    )

    async def generate():

        try:

            async for chunk in upstream.content.iter_chunked(
                1024 * 1024
            ):
                yield chunk

        finally:

            await session.close()

    response = StreamingResponse(
        generate(),
        media_type=upstream.headers.get(
            "Content-Type",
            "video/mp4"
        ),
        status_code=upstream.status
    )

    response.headers["Accept-Ranges"] = "bytes"

    if "Content-Range" in upstream.headers:
        response.headers["Content-Range"] = upstream.headers["Content-Range"]

    if "Content-Length" in upstream.headers:
        response.headers["Content-Length"] = upstream.headers["Content-Length"]

    return response
