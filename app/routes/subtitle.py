from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter()

@router.get("/subtitle")
async def subtitle(url: str):

    return RedirectResponse(url)
