from functools import lru_cache

import email_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def apply_environment_configurations(settings: Settings) -> None:
    # Restrict test-environment reserved domains (e.g. .test) to development and testing only
    email_validator.TEST_ENVIRONMENT = settings.app_env in ("development", "testing")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    apply_environment_configurations(settings)
    return settings
