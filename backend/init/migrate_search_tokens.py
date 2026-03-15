# init/migrate_search_tokens.py

import asyncio

from instacrud.database import init_system_db, init_org_db, ensure_search_indexes_for_org, firestore_mode
from instacrud.model.system_model import Organization
from instacrud.api.organization_api import SEARCH_MODELS
from instacrud.api.search import build_search_tokens


async def migrate_org(org_id: str):
    """
    One-time migration to backfill search_tokens for existing data.
    Safe to run multiple times.
    Not required for fresh installations.
    """
    print(f"\nMigrating search tokens for org {org_id}")
    await init_org_db(org_id)

    for entry in SEARCH_MODELS:
        model = entry["model"]
        fields = entry["fields"]

        updated = 0

        async for doc in model.find({"search_tokens": {"$exists": False}}):
            values = [getattr(doc, f, None) for f in fields]
            doc.search_tokens = build_search_tokens(*values)
            await doc.save()
            updated += 1

        print(f"  • {model.__name__}: updated {updated} documents")

    # Optionally ensure indexes (Mongo only)
    if not firestore_mode:
        await ensure_search_indexes_for_org(org_id, SEARCH_MODELS)
        print("  • Search indexes ensured")


async def main():
    await init_system_db()

    # Migrate all organizations
    orgs = await Organization.find_all().to_list()
    for org in orgs:
        await migrate_org(str(org.id))

    print("\nSearch token migration completed")


if __name__ == "__main__":
    asyncio.run(main())
