from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Video Render Worker API"
    WORKER_API_KEY: str = "super-secret-key-change-me"
    
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""
    FIREBASE_PRIVATE_KEY: str = ""

    model_config = ConfigDict(env_file=".env")

settings = Settings()
