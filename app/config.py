from dotenv import load_dotenv
import os

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_EXPIRE = int(os.getenv("JWT_EXPIRE", 3600))

TERABOX_COOKIE = os.getenv("TERABOX_COOKIE")

REDIS_URL = os.getenv("REDIS_URL")
