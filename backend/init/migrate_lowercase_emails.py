# init/migrate_lowercase_emails.py

import asyncio

from instacrud.database import init_system_db
from instacrud.model.system_model import User


async def main():
    """One-time migration: lowercase any stored User.email.

    Earlier password-signup stored the email as typed (`.insert()` skipped the save()-time
    lowercasing), while sign-in / uniqueness / reset all look the user up by `email.lower()`.
    Mixed-case rows therefore can't sign in. New rows are normalized by the model's email
    validator; this backfills existing rows. Safe to run multiple times; not needed for fresh
    installations.

    Case-variant collisions (e.g. both `John@x.com` and `john@x.com` exist) are reported and
    skipped — they need a human decision (merge/delete) before the unique index would allow
    lowercasing the second one.
    """
    await init_system_db()
    coll = User.get_pymongo_collection()

    fixed = 0
    conflicts = []
    skipped_already_lower = 0

    async for doc in coll.find({}, {"email": 1}):
        email = doc.get("email")
        if not isinstance(email, str):
            continue
        low = email.lower()
        if email == low:
            skipped_already_lower += 1
            continue
        # Would lowercasing collide with an existing (different) account?
        clash = await coll.find_one({"email": low, "_id": {"$ne": doc["_id"]}})
        if clash:
            conflicts.append((str(doc["_id"]), email, str(clash["_id"])))
            print(f"  ! CONFLICT: {email} ({doc['_id']}) -> {low} already used by {clash['_id']} — skipped")
            continue
        await coll.update_one({"_id": doc["_id"]}, {"$set": {"email": low}})
        fixed += 1
        print(f"  • {email} -> {low}")

    print(f"\nLowercased {fixed} email(s); {skipped_already_lower} already lowercase; "
          f"{len(conflicts)} conflict(s) need manual resolution.")
    if conflicts:
        print("Conflicts (mixed_id, mixed_email, existing_lower_id):")
        for row in conflicts:
            print("  ", row)


if __name__ == "__main__":
    asyncio.run(main())
