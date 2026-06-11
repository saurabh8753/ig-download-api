from fastapi import FastAPI

from app.routes.resolve import router as resolve_router
from app.routes.token import router as token_router
from app.routes.download import router as download_router
from app.routes.stream import router as stream_router
from app.routes.thumbnail import router as thumbnail_router

app = FastAPI(
    title="TeraBox API",
    version="1.0.0"
)

app.include_router(resolve_router)
app.include_router(token_router)
app.include_router(download_router)
app.include_router(stream_router)
app.include_router(thumbnail_router)


@app.get("/")
async def root():
    return {
        "status": "running",
        "version": "1.0.0"
    }
