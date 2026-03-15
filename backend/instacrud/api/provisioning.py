# api/provisioning.py
from loguru import logger
from instacrud.model.system_model import Organization
import instacrud.database as db
from instacrud.config import settings
from instacrud.crypto import encrypt_connection_url

async def provision_organization_task(
    organization_id: str,
    mongo_url: str | None,
    firestore_mode: bool,
    load_mock_data: bool
):
    org = None  # ensure availability in except block

    try:
        org = await Organization.get(organization_id)
        if not org:
            logger.error(f"Organization {organization_id} not found for provisioning")
            return

        if firestore_mode:
            logger.info(f"Creating firestore DB for org={organization_id}")
            await db.create_firestore_org_db(organization_id)
            mongo_url = db.assign_firestore_org_db(organization_id)
            org.mongo_url = encrypt_connection_url(mongo_url)
            await org.save()
            
            # wait for IAM propagation
            from instacrud.helpers.gcp_firebase_helper import gcp_firestore_wait_for_iam
            await gcp_firestore_wait_for_iam(mongo_url)
            logger.info(f"IAM ready for org={organization_id}, initializing org DB")
            await db.init_org_db(organization_id, mongo_url=mongo_url)
        else:
            await db.init_org_db(organization_id, mongo_url=mongo_url)
            
        if load_mock_data and settings.SUGGEST_LOADING_MOCK_DATA:
            try:
                from init.mock_data_helper import populate_org_mock_data
                await populate_org_mock_data(organization_id, create_indexes=not firestore_mode, mongo_url=mongo_url)
                logger.info(f"Mock data loaded for new organization {organization_id}")
            except Exception:
                logger.exception(f"Failed to load mock data for org {organization_id}")

        # Finalize org status
        org.status = "ACTIVE"
        await org.save()
        logger.info(f"Organization {organization_id} provisioned successfully")
        
    except Exception:
        logger.exception(f"Failed to provision org {organization_id}")

        if org:
            try:
                org.status = "FAILED"
                await org.save()

            except Exception:
                logger.exception(
                    f"Failed to mark org {organization_id} as FAILED"
                )