from fastapi import Header
from fastapi import HTTPException

VALID_KEYS = [
    "test_key"
]

async def api_key_check(
    x_api_key: str = Header(...)
):

    if x_api_key not in VALID_KEYS:

        raise HTTPException(
            403,
            "invalid api key"
        )
