from fastapi import APIRouter, HTTPException
from omnia.models.character import Character
from omnia.db.collections import characters

router = APIRouter()


@router.get("/{char_id}", response_model=Character)
async def get_character(char_id: str):
    doc = await characters().find_one({"id": char_id})
    if not doc:
        raise HTTPException(404, "Character not found")
    return Character(**doc)


@router.post("/", response_model=Character)
async def create_character(character: Character):
    await characters().insert_one(character.model_dump())
    return character


@router.put("/{char_id}", response_model=Character)
async def update_character(char_id: str, character: Character):
    character.id = char_id
    await characters().replace_one({"id": char_id}, character.model_dump(), upsert=True)
    return character
