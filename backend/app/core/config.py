from pydantic import BaseSettings, AnyUrl


class Settings(BaseSettings):
    # Database settings
    database_url: AnyUrl

    # OAuth settings
    google_client_id: str
    google_client_secret: str
    
    # Security settings
    secret_key: str
    
    # URL settings
    base_url: str  # Backend URL
    frontend_url: str  # Frontend URL

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()