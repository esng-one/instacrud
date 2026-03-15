# config.py

import tempfile

from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # === Mode ===
    MODE: str = "test"  # prod | test

    # === BASE URLs ===
    BASE_URL: str = "http://localhost:8000"
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # === JWT ===
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    TOKEN_EXPIRATION_SECONDS: int = 86400

    # === Connection URL Encryption ===
    # Dedicated key for encrypting org mongo_url values stored in the system DB.
    # STRONGLY RECOMMENDED to set this separately from SECRET_KEY.
    # If not set, SECRET_KEY is used as fallback — but rotating SECRET_KEY
    # (e.g. after a JWT compromise) will then break all encrypted DB connections.
    MONGO_URL_SECRET_KEY: Optional[str] = None

    # === Database ===
    # Supported DB_ENGINE values: mongo, atlas, firestore
    DB_ENGINE: str = "mongo"
    MONGO_URL: str = "mongodb://test:test@localhost:27017/"
    MONGO_TLS_ALLOW_INVALID: bool = False
    # When true and DB_ENGINE is mongo/atlas, use Organization.mongo_url if set
    MONGO_USE_ORG_DB: bool = False

    # === GCP Firebase ===
    # Auth type: "ADC" (Application Default Credentials, default — works on
    # Cloud Run, GKE, or local `gcloud auth`) or "JSON" (explicit SA key).
    GCP_FIREBASE_AUTH_TYPE: str = "ADC"
    GCP_FIREBASE_SA_JSON: Optional[str] = None  # only needed when AUTH_TYPE=JSON
    GCP_PROJECT_ID: Optional[str] = None

    # === CORS ===
    CORS_ALLOW_ORIGINS: str = "*"
    CORS_ALLOW_CREDENTIALS: bool = False
    CORS_ALLOW_METHODS: str = "*"
    CORS_ALLOW_HEADERS: str = "*"

    # === Google OAuth ===
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # === Microsoft OAuth ===
    MS_CLIENT_ID: Optional[str] = None
    MS_CLIENT_SECRET: Optional[str] = None
    MS_TENANT_ID: str = "common"

    # === DeepInfra API ===
    DEEP_INFRA_KEY: Optional[str] = None

    # === Cloudflare Turnstile ===
    # If this is not set, Turnstile is treated as disabled.
    TURNSTILE_SECRET_KEY: Optional[str] = None
    TURNSTILE_SITE_KEY: Optional[str] = None
    TURNSTILE_MODE: str = "normal"  # normal | invisible

    @property
    def TURNSTILE_ENABLED(self) -> bool:
        return bool(self.TURNSTILE_SECRET_KEY and self.TURNSTILE_SITE_KEY)

    # === Public Settings ===
    OPEN_REGISTRATION: bool = False
    SUGGEST_LOADING_MOCK_DATA: bool = False
    SUGGEST_LOADING_MOCK_DATA_DEFAULT: bool = False
    DEFAULT_TIER_CODE: Optional[str] = None

    # === Usage Tracking ===
    USAGE_RESET_PERIOD_SECONDS: int = 86400  # Default: 1 day (24 hours)

    # === Search (operational tuning only) ===
    SEARCH_FALLBACK_ENABLED: bool = True
    SEARCH_FALLBACK_MIN_QUERY_LEN: int = 3
    SEARCH_FALLBACK_LIMIT: int = 20

    # === Index Management ===
    AUTO_CREATE_SEARCH_INDEXES: bool = False

    # === Email Configuration ===
    EMAIL_ENABLED: bool = False
    EMAIL_CARRIER: str = "file"  # file | brevo | smtp | gmail
    EMAIL_DUMP_PATH: str = tempfile.gettempdir() + "/instacrud_emails"

    # === SMTP Configuration ===
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # === Gmail Configuration ===
    GMAIL_USERNAME: Optional[str] = None
    GMAIL_PASSWORD: Optional[str] = None

    BREVO_API_KEY: Optional[str] = None
    EMAIL_FROM_ADDRESS: str = "noreply@yourdomain.com"
    EMAIL_FROM_NAME: str = "InstaCRUD"

    # === Embeddings ===
    DEFAULT_EMBEDDING_MODEL: str = "intfloat/multilingual-e5-large"

    # === Validators ===
    @field_validator("EMAIL_CARRIER")
    def validate_email_driver(cls, v):
        if v not in {"file", "brevo", "smtp", "gmail"}:
            raise ValueError("EMAIL_CARRIER must be 'file', 'brevo', 'smtp', or 'gmail'")
        return v

    @field_validator("CORS_ALLOW_ORIGINS", "CORS_ALLOW_METHODS", "CORS_ALLOW_HEADERS")
    def parse_comma_separated(cls, v: str) -> List[str]:
        return [v] if v.strip() == "*" else [i.strip() for i in v.split(",")]

    # === Helper methods ===
    def oauth_enabled(self) -> bool:
        required = [
            self.GOOGLE_CLIENT_ID,
            self.GOOGLE_CLIENT_SECRET,
            self.MS_CLIENT_ID,
            self.MS_CLIENT_SECRET,
        ]
        return all(required)

    def check_oauth(self):
        if not self.oauth_enabled():
            print(
                f"\033[33mWARNING:\033[0m OAuth is not fully configured. "
                "Google/Microsoft login will be disabled."
            )

    def check_email(self):
        if not self.EMAIL_ENABLED:
            print(
                f"\033[33mWARNING:\033[0m Email sending is disabled (EMAIL_ENABLED=false). "
                "No emails will be sent."
            )

    def check_mongo_url_secret_key(self):
        if not self.MONGO_URL_SECRET_KEY:
            print(
                f"\033[33mWARNING:\033[0m MONGO_URL_SECRET_KEY is not set. "
                "Falling back to SECRET_KEY for encrypting database connection URLs. "
                "If you rotate SECRET_KEY (e.g. after a JWT emergency), ALL encrypted "
                "org database connections will break. Set MONGO_URL_SECRET_KEY to a "
                "separate, stable secret to avoid this risk."
            )

# Global settings instance
settings = AppSettings()
settings.check_oauth()
settings.check_email()
settings.check_mongo_url_secret_key()
