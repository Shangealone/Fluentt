from functools import lru_cache
from uuid import UUID

import email_validator
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    speech_recognition_enabled: bool = False
    speech_assessment_enabled: bool = False
    speech_internal_qa_user_ids: list[UUID] = Field(default_factory=list)
    speech_recognition_url: str = ""
    speech_assessment_url: str = ""
    speech_service_token: str = ""
    speech_max_inflight: int = Field(default=2, ge=1, le=8)
    speech_worker_timeout_seconds: float = Field(default=30.0, ge=1, le=120)
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def secure_speech_urls(self):
        from urllib.parse import urlsplit

        for url in (self.speech_recognition_url, self.speech_assessment_url):
            if not url:
                continue
            parsed = urlsplit(url)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("Invalid private speech worker URL")
            if (
                self.app_env not in ("development", "testing")
                and parsed.scheme != "https"
            ):
                raise ValueError("Production speech workers require HTTPS")
        return self


def apply_environment_configurations(settings: Settings) -> None:
    # Restrict test-environment reserved domains (e.g. .test) to development and testing only
    email_validator.TEST_ENVIRONMENT = settings.app_env in ("development", "testing")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    apply_environment_configurations(settings)
    return settings
