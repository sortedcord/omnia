---
title: Attributes & Privacy
description: Attribute-level access control and epistemic privacy model
---

Every entity, item, and location in Omnia is an attribute bag. Each attribute carries its own visibility (`PUBLIC` or `PRIVATE`) with an explicit access list.

## How Privacy Works

"The sword is cursed" is a private attribute checked in code, not a rule the model is politely asked to honor. Privacy lives at the level of the fact, not the entity:

- A character can be publicly a blacksmith and privately a spy.
- Even facts about _itself_ can be hidden from it unless explicitly granted (amnesia, repression, and sleeper agents come free with the model).

## Prompt-Injection-Proof Secrets

There is no instruction to override because the information was never serialized into the prompt. Epistemic privacy turns "the model shouldn't say this" (hard, unreliable) into "the model doesn't know this" (trivial, absolute).

## Key Components

- `hasAccess()` / ACL grant-revoke logic
- `getVisibleAttributesFor()` — viewer-relative attribute filtering
- Attribute schema with visibility metadata
