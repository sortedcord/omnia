from omnia.db.client import get_db


# Avoid circular imports with delayed access functions
def characters():
    return get_db()["characters"]


def locations():
    return get_db()["locations"]


def items():
    return get_db()["items"]


def quests():
    return get_db()["quests"]


def world():
    return get_db()["world"]
