from motor.motor_asyncio import AsyncIOMotorClient
from omnia.config import settings

client: AsyncIOMotorClient | None = None
db = None


def get_db():
    if db is None:
        raise Exception("Database not connected. Call connect_to_mongo first.")
    return db


async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]


async def disconnect_from_mongo():
    if isinstance(client, AsyncIOMotorClient):
        client.close()
