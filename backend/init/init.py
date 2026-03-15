import asyncio
import sys
import getpass
from loguru import logger
from passlib.context import CryptContext

from instacrud.database import init_system_db
from instacrud.model.system_model import User, Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def main():
    # Initialize DB and models once
    await init_system_db()

    # Check if any users exist
    if await User.find_all().count() > 0:
        logger.info("Users already exist. Initialization skipped.")
        return

    # Ask for confirmation before proceeding
    confirm = input("Do you want to create the first ADMIN user? (y/N): ").strip().lower()
    if confirm != "y":
        logger.info("Initialization cancelled.")
        return

    # Gather params (CLI args or prompt)
    if len(sys.argv) >= 4:
        email = sys.argv[1]
        password = sys.argv[2]
        name = sys.argv[3]
    else:
        email = input("Enter admin email: ").strip()

        # Loop until passwords match
        while True:
            password = getpass.getpass("Enter admin password: ")
            password_confirm = getpass.getpass("Re-enter admin password: ")
            if password == password_confirm:
                break
            else:
                logger.warning("Passwords do not match. Please try again.")

        name = input("Enter admin name: ").strip() or "Administrator"

    # Create first admin
    hashed_password = pwd_context.hash(password)
    admin = User(
        email=email,
        hashed_password=hashed_password,
        name=name,
        role=Role.ADMIN
    )
    await admin.insert()

    logger.success(f"First ADMIN user created: {email} ({name})")


if __name__ == "__main__":
    asyncio.run(main())