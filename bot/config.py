import os
from dataclasses import dataclass


@dataclass
class Config:
    BOT_TOKEN: str
    BACKEND_URL: str
    BOT_SECRET: str
    MINI_APP_URL: str


def load_config() -> Config:
    return Config(
        BOT_TOKEN=os.environ["BOT_TOKEN"],
        BACKEND_URL=os.environ.get("BACKEND_URL", "http://localhost:8000"),
        BOT_SECRET=os.environ.get("BOT_SECRET", "changeme_bot_secret"),
        MINI_APP_URL=os.environ.get("MINI_APP_URL", "https://your-frontend.up.railway.app"),
    )
