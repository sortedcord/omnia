from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "omnia_world"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
