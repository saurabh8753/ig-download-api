from pydantic import BaseModel

class FileItem(BaseModel):
    fs_id: str
    filename: str
    size: int
    thumbnail: str | None = None
