from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Video Render Worker API"
    WORKER_API_KEY: str = "super-secret-key-change-me"  # Güvenlik için, Vercel buradan erişecek
    FIREBASE_SERVICE_ACCOUNT_JSON: str = "" # Render env var üzerinden verilecek (Base64 veya JSON string)

    model_config = ConfigDict(env_file=".env")

settings = Settings()
