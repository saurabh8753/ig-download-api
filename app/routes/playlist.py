from fastapi import APIRouter

router = APIRouter()

@router.get("/playlist/{token}")
async def playlist(token: str):

    playlist = """
#EXTM3U
#EXT-X-VERSION:3

#EXTINF:10,
segment1.ts

#EXTINF:10,
segment2.ts

#EXTINF:10,
segment3.ts

#EXT-X-ENDLIST
"""

    return Response(
        playlist,
        media_type=
        "application/vnd.apple.mpegurl"
    )
