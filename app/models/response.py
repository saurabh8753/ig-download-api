from pydantic import BaseModel
from typing import List

from app.models.file import FileItem


class ResolveResponse(BaseModel):
    status: str
    total_files: int
    files: List[FileItem]
