from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application configuration from environment variables."""

    # Server
    port: int = 8000
    debug: bool = False

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # CORS - Read from ALLOWED_ORIGINS env var
    # Production domains + localhost for development
    allowed_origins: str = (
        "http://localhost:3000,"
        "http://localhost:3001,"
        "https://propertyiq.app,"
        "https://app.propertyiq.app,"
        "https://api.propertyiq.app"
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated origins into list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
