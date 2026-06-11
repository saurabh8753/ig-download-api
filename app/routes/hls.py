from fastapi import APIRouter

router = APIRouter()

@router.get("/hls")
async def hls(token: str):

    return {
        "playlist":
        f"/playlist/{token}"
    }
