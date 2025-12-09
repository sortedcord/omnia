from omnia.db.collections import characters
from omnia.models.character import Character


class CharacterRepository:
    collection = characters()

    async def get(self, char_id: str) -> Character | None:
        doc = await self.collection.find_one({"id": char_id})
        return Character(**doc) if doc else None

    async def save(self, character: Character):
        await self.collection.replace_one(
            {"id": character.id}, character.model_dump(), upsert=True
        )
