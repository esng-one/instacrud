# init_mock_db.py

import asyncio
import json
from pathlib import Path
from loguru import logger
from passlib.context import CryptContext

from instacrud.model.system_model import User, Organization, Role
from instacrud.model.organization_model import ClientType
from instacrud.database import init_system_db, assign_firestore_org_db, firestore_mode, create_firestore_org_db, init_org_db
from instacrud.helpers.gcp_firebase_helper import gcp_firestore_wait_for_iam
from instacrud.crypto import encrypt_connection_url
from init.mock_data_helper import populate_org_data, SAMPLE_CLIENTS, SAMPLE_PROJECTS, SAMPLE_DOC_CONTENT

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -------------------------------------------------------------------
# Mock credentials
# -------------------------------------------------------------------
CREDENTIALS = {
    "admin": ("admin@test.org", "admin123"),
    "east_admin": ("east_admin@test.org", "eastpass"),
    "east_user": ("east_user@test.org", "userpass"),
    "east_ro": ("east_ro@test.org", "ropass123"),
    "west_admin": ("west_admin@test.org", "westpass"),
    "west_user": ("west_user@test.org", "userpass"),
    "west_ro": ("west_ro@test.org", "ropass123"),
}

# -------------------------------------------------------------------
# West-specific clients and projects (East uses the shared SAMPLE_* data)
# -------------------------------------------------------------------
CLIENTS_WEST = [
    (
        "pacific_energy",
        ClientType.COMPANY,
        "Pacific Energy Solutions",
        [("Laura Kim", "Engineering Director", "laura.kim@pacenergy.com", "+1-310-555-0400")],
        [("200 Ocean Blvd", None, "Los Angeles", "CA", "90045", "USA")]
    ),
    (
        "redwood_architects",
        ClientType.COMPANY,
        "Redwood Architects Group",
        [("David Rodriguez", "Lead Architect", "david.rodriguez@redwoodarch.com", "+1-415-555-0712")],
        [("500 Pine St", "5th Floor", "San Francisco", "CA", "94108", "USA")]
    ),
    (
        "michael_turner",
        ClientType.PERSON,
        "Michael Turner (Private Client)",
        [("Michael Turner", "Entrepreneur", "michael.turner@email.com", "+1-415-555-0803")],
        [("88 Skyline Drive", None, "Aspen", "CO", "81611", "USA")]
    ),
    (
        "summit_outdoors",
        ClientType.COMPANY,
        "Summit Outdoor Gear Inc.",
        [("Emily Davis", "Marketing Manager", "emily.davis@summitoutdoors.com", "+1-503-555-0921")],
        [("910 River Rd", None, "Portland", "OR", "97205", "USA")]
    ),
    (
        "silvercrest_homes",
        ClientType.COMPANY,
        "Silvercrest Custom Homes",
        [("Grace Li", "Client Relations", "grace.li@silvercresthomes.com", "+1-408-555-0581")],
        [("321 Coastal Dr", None, "San Diego", "CA", "92101", "USA")]
    ),
    (
        "zenith_creative",
        ClientType.COMPANY,
        "Zenith Creative Studios",
        [("Carlos Mendez", "Design Director", "carlos@zenithcreative.com", "+1-702-555-0642")],
        [("202 Neon Ave", "Suite 10", "Las Vegas", "NV", "89109", "USA")]
    ),
    (
        "marina_lakehouse",
        ClientType.PERSON,
        "Lana Rhodes (Lakehouse Owner)",
        [("Lana Rhodes", "Investor", "lana.rhodes@email.com", "+1-925-555-0789")],
        [("18 Lakeside Dr", None, "Lake Tahoe", "CA", "96150", "USA")]
    ),
    (
        "cascade_ventures",
        ClientType.COMPANY,
        "Cascade Ventures",
        [("Jordan Bell", "Venture Partner", "jordan@cascadeventures.com", "+1-206-555-0822")],
        [("450 Summit Ave", "Floor 8", "Seattle", "WA", "98104", "USA")]
    ),
    (
        "catalyst_energy",
        ClientType.COMPANY,
        "Catalyst Renewable Energy",
        [("Jin Park", "VP of Projects", "jin.park@catalystrenew.com", "+1-408-555-0901")],
        [("789 Innovation Way", None, "San Jose", "CA", "95134", "USA")]
    ),
    (
        "terra_architects",
        ClientType.COMPANY,
        "Terra Architects",
        [("Naomi Wells", "Senior Designer", "naomi@terraarch.com", "+1-415-555-0623")],
        [("342 Pine Hill Rd", "Studio 8", "Santa Rosa", "CA", "95401", "USA")]
    ),
    (
        "mission_foods",
        ClientType.COMPANY,
        "Mission Valley Foods",
        [("George Elias", "Facilities Manager", "g.elias@missionfoods.com", "+1-619-555-0788")],
        [("2100 Produce Row", None, "San Diego", "CA", "92140", "USA")]
    ),
    (
        "orion_startups",
        ClientType.COMPANY,
        "Orion Startup Collective",
        [("Meghan Chu", "Program Director", "meghan@orionstartups.com", "+1-310-555-0950")],
        [("77 Satellite Blvd", "Floor 4", "Los Angeles", "CA", "90089", "USA")]
    ),
]

PROJECTS_WEST = [
    ("west_P001", "Solar Plant Expansion", "Expansion of solar farm facilities for Pacific Energy."),
    ("west_P002", "Redwood Tower Project", "Design and build Redwood Architects HQ tower."),
    ("west_P003", "Mountain Cabin", "Private mountain retreat for Michael Turner."),
    ("west_P004", "Luxury Villa Construction", "New build for Silvercrest in San Diego hills."),
    ("west_P005", "Creative Studio Redesign", "Interior rework for Zenith's Las Vegas studio."),
    ("west_P006", "Lakehouse Expansion", "Second-floor addition to Lana Rhodes' Tahoe property."),
    ("west_P007", "Startup Accelerator Setup", "Launch space and branding for Cascade Ventures."),
    ("west_P008", "Battery Storage Facility", "Grid-scale storage for renewable energy overflow."),
    ("west_P009", "Civic Center Pavilion", "Community green space and stage designed by Terra."),
    ("west_P010", "Food Hub Expansion", "Additional warehouse space for Mission Valley Foods."),
    ("west_P011", "Accelerator Demo Lab", "Tech demo space for Orion-backed ventures."),
]


async def create_admin():
    email, pwd = CREDENTIALS["admin"]
    user = User(
        email=email,
        hashed_password=pwd_context.hash(pwd),
        name="Global Admin",
        role=Role.ADMIN
    )
    await user.insert()
    return user


async def create_org(name: str, org_code: str, prefix: str, client_data, project_data):
    org = Organization(
        name=name,
        code=org_code,
        description=f"{name} main organization"
    )
    await org.insert()

    # If in firestore mode, provision the database and update mongo_url
    if firestore_mode:
        logger.info(f"Provisioning Firestore for {name}...")
        await create_firestore_org_db(str(org.id))
        mongo_url = assign_firestore_org_db(str(org.id))
        org.mongo_url = encrypt_connection_url(mongo_url)
        await org.save()
        logger.info(f"Firestore provisioned: {mongo_url}")

        # Wait for IAM propagation
        logger.info("Waiting for IAM propagation (may take a minute)...")
        await gcp_firestore_wait_for_iam(mongo_url)
        logger.info("IAM ready.")

        # Initialize org DB session for this organization
        await init_org_db(str(org.id), mongo_url=mongo_url)
    else:
        await init_org_db(str(org.id))

    # Users
    for role_key, role_name in [("admin", Role.ORG_ADMIN), ("user", Role.USER), ("ro", Role.RO_USER)]:
        email, pwd = CREDENTIALS[f"{prefix}_{role_key}"]
        await User(
            email=email,
            hashed_password=pwd_context.hash(pwd),
            name=f"{name} {role_key.capitalize()}",
            role=role_name,
            organization_id=org.id,
        ).insert()

    # Load embeddings
    embeddings_by_title = None
    embeddings_file = Path(__file__).parent / "embeddings_output.json"
    if embeddings_file.exists():
        with open(embeddings_file, "r") as f:
            embeddings_data = json.load(f)
        embeddings_by_title = {item["title"]: item["embedding"] for item in embeddings_data}

    result = await populate_org_data(
        org_id=str(org.id),
        client_data=client_data,
        project_data=project_data,
        doc_content=SAMPLE_DOC_CONTENT,
        embeddings_by_title=embeddings_by_title,
        create_indexes=True
    )
    logger.info(f"Org {org.code} populated: {result}")

async def main():
    # Init system DB
    await init_system_db()

    # Cleanup system collections
    await User.delete_all()
    await Organization.delete_all()

    # Create Admin + Orgs
    await create_admin()
    await create_org("East LLC", "east_llc_001", "east", SAMPLE_CLIENTS, SAMPLE_PROJECTS)
    await create_org("West LLC", "west_llc_001", "west", CLIENTS_WEST, PROJECTS_WEST)

    logger.success("Mock DB initialized with Admin, Orgs, Users, Clients, Contacts, Addresses, Projects, and Documents.")


if __name__ == "__main__":
    asyncio.run(main())
