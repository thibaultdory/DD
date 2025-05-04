from pydantic import BaseSettings, AnyUrl


class Settings(BaseSettings):
    database_url: AnyUrl
    google_client_id: str
    google_client_secret: str
    secret_key: str
    base_url: AnyUrl
    frontend_url: str = "http://localhost:54287"  # Default to local dev frontend

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()