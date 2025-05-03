from pydantic import BaseSettings, AnyUrl


class Settings(BaseSettings):
    database_url: AnyUrl
    google_client_id: str
    google_client_secret: str
    secret_key: str
    base_url: AnyUrl

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()