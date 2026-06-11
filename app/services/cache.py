import redis
import json

from app.config import REDIS_URL

r = redis.from_url(
    REDIS_URL,
    decode_responses=True
)

CACHE_TIME = 600

def get(key):

    value = r.get(key)

    if value:
        return json.loads(value)

    return None

def set(key, value):

    r.setex(
        key,
        CACHE_TIME,
        json.dumps(value)
    )
