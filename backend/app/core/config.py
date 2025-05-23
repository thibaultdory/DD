from pydantic import BaseSettings, AnyUrl
from urllib.parse import urlparse


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

    # Logging settings
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    @property
    def backend_domain(self) -> str:
        """Extract domain from backend URL for cookie configuration"""
        parsed = urlparse(self.base_url)
        return parsed.hostname or "localhost"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()