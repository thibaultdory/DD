import logging
from app.core.config import settings

def setup_logging():
    logging.basicConfig(
        level=settings.log_level.upper(),
        format=settings.log_format,
        handlers=[
            logging.StreamHandler()  # Log to console
            # You can add other handlers here, like FileHandler
            # logging.FileHandler("app.log"),
        ]
    )
    # You can also configure specific loggers here if needed
    # logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
