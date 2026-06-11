import aiohttp

HEADERS = {
    "User-Agent": "Mozilla/5.0"
}


async def resolve_share(url: str):

    """
    Share link resolve karke
    file metadata return karega.
    """

    # TODO:
    # actual terabox resolver

    return {
        "fs_id": "598219647269049",
        "filename": "video.mp4",
        "size": 250929610,
        "thumbnail": "",
        "dlink": "https://example.com/video.mp4"
    }


async def get_dlink(fs_id: str):

    """
    fs_id se fresh dlink lao
    """

    file_info = await resolve_share("")

    return file_info["dlink"]
