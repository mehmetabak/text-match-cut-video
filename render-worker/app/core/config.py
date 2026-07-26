from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Video Render Worker API"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    WORKER_API_KEY: str = "super-secret-key-change-me"  # Güvenlik için, Vercel buradan erişecek

    model_config = ConfigDict(env_file=".env")

settings = Settings()
