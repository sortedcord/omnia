from fastapi import FastAPI
from contextlib import asynccontextmanager
from omnia.routers import characters, locations
from omnia.db.client import connect_to_mongo, disconnect_from_mongo

app = FastAPI(title="Omnia Engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    print("Connected to MongoDB")

    yield

    await disconnect_from_mongo()
    print("Disconnected from MongoDB")


app = FastAPI(title="Omnia Engine", lifespan=lifespan)


app.include_router(characters.router, prefix="/characters", tags=["characters"])
app.include_router(locations.router, prefix="/locations", tags=["locations"])
# app.include_router(items.router, prefix="/items", tags=["items"])
# app.include_router(quests.router, prefix="/quests", tags=["quests"])
# app.include_router(world.router, prefix="/world", tags=["world"])
