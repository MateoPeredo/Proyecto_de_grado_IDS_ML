"""
Configuración central del backend.
Lee variables de entorno (definidas en docker-compose) con valores por defecto
pensados para correr dentro de la red de Docker.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "SigmaIDS Backend"
    DEBUG: bool = True

    # ── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "cambia-esto-en-produccion"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 8  # 8 horas

    # ── MySQL ────────────────────────────────────────────────────────────────
    MYSQL_HOST: str = "mysql"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "ids"
    MYSQL_PASSWORD: str = "ids_pass"
    MYSQL_DB: str = "ids"

    @property
    def mysql_url(self) -> str:
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
        )

    # ── ClickHouse ───────────────────────────────────────────────────────────
    CLICKHOUSE_HOST: str = "clickhouse"
    CLICKHOUSE_PORT: int = 8123          # puerto HTTP
    CLICKHOUSE_USER: str = "default"
    CLICKHOUSE_PASSWORD: str = ""
    CLICKHOUSE_DB: str = "ids_metrics"

    # ── Elasticsearch ────────────────────────────────────────────────────────
    ELASTIC_HOST: str = "http://elasticsearch:9200"
    ELASTIC_USER: str = ""
    ELASTIC_PASSWORD: str = ""

    # ── Modelo ML ────────────────────────────────────────────────────────────
    MODEL_PATH: str = "/app/app/ml/model.joblib"

    # ── SMTP (envío de notificaciones por correo) ────────────────────────────
    # SMTP_PROVIDER define el host automáticamente: "gmail" o "outlook".
    # Para otro servidor, poné SMTP_PROVIDER=custom y completá SMTP_HOST.
    # Puerto 465 = SSL directo (recomendado, suele pasar firewalls/ISP).
    # Puerto 587 = STARTTLS (si tu red lo permite).
    SMTP_PROVIDER: str = "gmail"          # gmail | outlook | custom
    SMTP_HOST: str = ""                    # solo si SMTP_PROVIDER=custom
    SMTP_PORT: int = 465                   # 465 = SSL directo | 587 = STARTTLS
    SMTP_USER: str = ""                    # cuenta remitente, ej. ids.ml.noti@gmail.com
    SMTP_PASSWORD: str = ""                # contraseña de APLICACIÓN (16 dígitos), NO la normal
    SMTP_FROM_NAME: str = "IDS ML - Notificaciones"

    # Servidor SMTP según proveedor (usa el puerto SMTP_PORT configurado)
    @property
    def smtp_server(self) -> tuple[str, int]:
        hosts = {
            "gmail":   "smtp.gmail.com",
            "outlook": "smtp-mail.outlook.com",
        }
        if self.SMTP_PROVIDER in hosts:
            return (hosts[self.SMTP_PROVIDER], self.SMTP_PORT)
        return (self.SMTP_HOST, self.SMTP_PORT)


settings = Settings()
