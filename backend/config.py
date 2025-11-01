import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # API Configuration
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Faculty Publications API"
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",  # Next.js frontend
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    

    
    # Google Scholar Scraping Configuration
    SELENIUM_TIMEOUT: int = 30
    SELENIUM_HEADLESS: bool = True
    CHROME_DRIVER_PATH: str = os.getenv("CHROME_DRIVER_PATH", "")
    
    # Data Storage
    FACULTY_DATA_FILE: str = "faculty_data.json"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Development/Production
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    @classmethod
    def get_cors_origins(cls):
        """Get CORS origins from environment or use defaults"""
        cors_origins = os.getenv("BACKEND_CORS_ORIGINS")
        if cors_origins:
            return [origin.strip() for origin in cors_origins.split(",")]
        return cls.BACKEND_CORS_ORIGINS

# Create config instance
config = Config()
