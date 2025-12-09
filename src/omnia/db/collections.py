from omnia.db.client import db


# Avoid circular imports with delayed access functions
def characters():
    return db["characters"]


def locations():
    return db["locations"]


def items():
    return db["items"]


def quests():
    return db["quests"]


def world():
    return db["world"]
