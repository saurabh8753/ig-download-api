from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter()


@router.get("/thumbnail")
async def thumbnail(url: str):

    return RedirectResponse(url)
