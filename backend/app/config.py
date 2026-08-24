from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration.

    All secrets and environment-specific values are loaded from a `.env`
    file (never hard-coded, never sent to the frontend). Copy
    `.env.example` to `.env` and fill in real values before running.
    """

    mistral_api_key: str = ""

    jwt_secret_key: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    database_url: str = "sqlite:///./notes.db"

    upload_dir: str = "./uploads"
    max_upload_mb: int = 25

    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def mistral_configured(self) -> bool:
        return bool(self.mistral_api_key) and self.mistral_api_key != "your_mistral_api_key_here"


settings = Settings()
