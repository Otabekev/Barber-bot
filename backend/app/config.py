from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BOT_TOKEN: str = "test_token"
    SECRET_KEY: str = "changeme_in_production"
    DATABASE_URL: str = "sqlite+aiosqlite:///./barber.db"
    # Set to true in .env for local browser dev only — NEVER in production
    DEV_MODE: bool = False
    # URL of the deployed Mini App frontend (used by bot for WebApp buttons)
    MINI_APP_URL: str = "https://your-frontend.up.railway.app"
    # Shared secret so the bot can call privileged backend endpoints
    BOT_SECRET: str = "changeme_bot_secret"
    BOT_USERNAME: str  # without @, used for deep links — MUST be set in env

    @property
    def async_database_url(self) -> str:
        """
        Railway provides DATABASE_URL as postgresql://...
        SQLAlchemy async needs postgresql+asyncpg://...
        This fixes it automatically.
        """
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"


settings = Settings()
