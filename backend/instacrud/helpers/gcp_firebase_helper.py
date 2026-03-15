import json
from google.cloud import firestore_admin_v1, firestore
from google.cloud.firestore_admin_v1 import types as firestore_admin_types
from google.oauth2 import service_account
from loguru import logger

from instacrud.config import settings


def org_to_firestore_id(organization_id: str) -> str:
    """Convert an organization ID (MongoDB ObjectId hex) to a valid Firestore database ID.

    Firestore requires: 4-63 chars, lowercase letters/digits/hyphens, must start with a letter.
    """
    return f"org-{organization_id}"


def gcp_get_credentials():
    """Return GCP credentials.

    AUTH_TYPE="ADC" (default): uses Application Default Credentials —
        works automatically on Cloud Run, GKE, or locally via `gcloud auth`.
    AUTH_TYPE="JSON": parses an explicit service-account JSON from
        GCP_FIREBASE_SA_JSON (for VPS / non-GCP environments).
    """
    auth_type = settings.GCP_FIREBASE_AUTH_TYPE.upper()

    if auth_type == "ADC":
        from google.auth import default
        credentials, project = default()
        if not settings.GCP_PROJECT_ID and project:
            settings.GCP_PROJECT_ID = project
        return credentials

    if auth_type == "JSON":
        if not settings.GCP_FIREBASE_SA_JSON:
            raise ValueError("GCP_FIREBASE_SA_JSON environment variable not set")

        try:
            sa_dict = json.loads(settings.GCP_FIREBASE_SA_JSON)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in GCP_FIREBASE_SA_JSON: {str(e)}")

        return service_account.Credentials.from_service_account_info(sa_dict)

    raise ValueError(f"Unsupported GCP_FIREBASE_AUTH_TYPE: {auth_type}. Use 'ADC' or 'JSON'.")


def gcp_firestore_database_exist(database_id: str, credentials=None) -> bool:

    if credentials is None:
        credentials = gcp_get_credentials()

    client = firestore_admin_v1.FirestoreAdminClient(credentials=credentials)
    parent = f"projects/{settings.GCP_PROJECT_ID}/databases/{database_id}"

    try:
        client.get_database(name=parent)
        return True
    except Exception:
        return False


def gcp_firestore_create_database(database_id: str, credentials=None) -> dict:

    if credentials is None:
        credentials = gcp_get_credentials()

    client = firestore_admin_v1.FirestoreAdminClient(credentials=credentials)
    parent = f"projects/{settings.GCP_PROJECT_ID}"

    database = firestore_admin_types.Database(
        type_=firestore_admin_types.Database.DatabaseType.FIRESTORE_NATIVE,
        location_id="us-central1",
        concurrency_mode=firestore_admin_types.Database.ConcurrencyMode.PESSIMISTIC,
        database_edition=firestore_admin_types.Database.DatabaseEdition.ENTERPRISE,
    )

    try:
        operation = client.create_database(
            parent=parent,
            database_id=database_id,
            database=database,
        )
        response = operation.result()
        return response
    except Exception as e:
        raise ValueError(f"Failed to create Firestore database {database_id}: {str(e)}")


def gcp_firestore_revoke_db_iam(database_id: str, credentials=None) -> None:
    """Remove all IAM bindings scoped to a specific Firestore database.

    Deletes any project-level IAM bindings whose condition references
    the given database (as created by gcp_firestore_grant_db_role).
    """
    from google.cloud import resourcemanager_v3
    from google.iam.v1 import iam_policy_pb2

    if credentials is None:
        credentials = gcp_get_credentials()

    rm_client = resourcemanager_v3.ProjectsClient(credentials=credentials)
    project_resource = f"projects/{settings.GCP_PROJECT_ID}"

    get_request = iam_policy_pb2.GetIamPolicyRequest(resource=project_resource)
    get_request.options.requested_policy_version = 3
    policy = rm_client.get_iam_policy(request=get_request)
    policy.version = 3

    db_resource = f"projects/{settings.GCP_PROJECT_ID}/databases/{database_id}"
    new_bindings = [
        b for b in policy.bindings
        if not (b.condition and db_resource in b.condition.expression)
    ]

    if len(new_bindings) == len(policy.bindings):
        return  # nothing to remove

    del policy.bindings[:]
    policy.bindings.extend(new_bindings)

    set_request = iam_policy_pb2.SetIamPolicyRequest(
        resource=project_resource,
        policy=policy,
    )
    rm_client.set_iam_policy(request=set_request)
    logger.info(f"revoke_db_iam: removed IAM bindings for database {database_id}")


def gcp_firestore_delete_database(database_id: str, credentials=None) -> None:

    if credentials is None:
        credentials = gcp_get_credentials()

    if not gcp_firestore_database_exist(database_id, credentials=credentials):
        return

    client = firestore_admin_v1.FirestoreAdminClient(credentials=credentials)
    name = f"projects/{settings.GCP_PROJECT_ID}/databases/{database_id}"

    try:
        client.delete_database(name=name)
    except Exception as e:
        raise ValueError(f"Failed to delete Firestore database {database_id}: {str(e)}")

    try:
        gcp_firestore_revoke_db_iam(database_id, credentials=credentials)
    except Exception as e:
        logger.warning(f"delete_database: IAM cleanup failed for {database_id}: {e}")


def gcp_firestore_get_database(database_id: str, credentials=None):
    """Get Firestore database metadata (uid, location_id, etc.)."""
    if credentials is None:
        credentials = gcp_get_credentials()

    client = firestore_admin_v1.FirestoreAdminClient(credentials=credentials)
    name = f"projects/{settings.GCP_PROJECT_ID}/databases/{database_id}"
    return client.get_database(name=name)


def gcp_firestore_create_user_creds(database_id: str, username: str, credentials=None) -> tuple[str, str]:
    """Create SCRAM-SHA-256 user credentials for a Firestore database.

    Returns (password, principal). Password is only available at creation time.
    The principal must be granted roles/datastore.user via IAM.
    """
    if credentials is None:
        credentials = gcp_get_credentials()

    client = firestore_admin_v1.FirestoreAdminClient(credentials=credentials)
    request = firestore_admin_types.CreateUserCredsRequest(
        parent=f"projects/{settings.GCP_PROJECT_ID}/databases/{database_id}",
        user_creds=firestore_admin_types.UserCreds(),
        user_creds_id=username,
    )
    response = client.create_user_creds(request)
    return response.secure_password, response.resource_identity.principal


def gcp_firestore_grant_db_role(principal: str, database_id: str, credentials=None) -> None:
    """Grant roles/datastore.user scoped to a specific Firestore database.

    Uses Resource Manager IAM policy with a condition to scope the role
    to the specific database resource.
    """
    from google.cloud import resourcemanager_v3
    from google.iam.v1 import iam_policy_pb2, policy_pb2
    from google.type import expr_pb2

    if credentials is None:
        credentials = gcp_get_credentials()

    rm_client = resourcemanager_v3.ProjectsClient(credentials=credentials)
    project_resource = f"projects/{settings.GCP_PROJECT_ID}"

    get_request = iam_policy_pb2.GetIamPolicyRequest(resource=project_resource)
    get_request.options.requested_policy_version = 3
    policy = rm_client.get_iam_policy(request=get_request)
    policy.version = 3

    condition = expr_pb2.Expr(
        title=f"firestore-user-{database_id}",
        expression=f'resource.name == "projects/{settings.GCP_PROJECT_ID}/databases/{database_id}"',
    )

    new_binding = policy_pb2.Binding(
        role="roles/datastore.user",
        condition=condition,
    )
    new_binding.members.append(principal)
    policy.bindings.append(new_binding)

    set_request = iam_policy_pb2.SetIamPolicyRequest(
        resource=project_resource,
        policy=policy,
    )
    rm_client.set_iam_policy(request=set_request)


def gcp_firestore_build_mongo_url(database_id: str, credentials=None) -> str:
    """Create user credentials and build a full MongoDB-compatible connection URL
    for a Firestore database.

    Returns a connection string like:
        mongodb://USERNAME:PASSWORD@UID.LOCATION.firestore.goog:443/DATABASE_ID
        ?loadBalanced=true&authMechanism=SCRAM-SHA-256&tls=true&retryWrites=false
    """
    from urllib.parse import quote_plus

    if credentials is None:
        credentials = gcp_get_credentials()

    # Get database UID and location
    db_info = gcp_firestore_get_database(database_id, credentials=credentials)
    uid = db_info.uid
    location = db_info.location_id
    logger.info(f"build_mongo_url: database_id={database_id}, uid={uid}, location={location}")

    # Create SCRAM credentials (username = database_id) and grant IAM role
    username = database_id
    password, principal = gcp_firestore_create_user_creds(database_id, username, credentials=credentials)
    logger.info(f"build_mongo_url: credentials created for username={username}, principal={principal}")
    gcp_firestore_grant_db_role(principal, database_id, credentials=credentials)
    logger.info(f"build_mongo_url: IAM role granted for principal={principal}")

    url = (
        f"mongodb://{quote_plus(username)}:{quote_plus(password)}"
        f"@{uid}.{location}.firestore.goog:443/{database_id}"
        f"?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false"
    )
    return url


async def gcp_firestore_wait_for_iam(mongo_url: str, timeout_seconds: int = 240,
                                     required_successes: int = 3):
    """Poll until IAM role propagates and data operations succeed consistently.

    Requires multiple consecutive successes because Firestore IAM propagation
    can be flaky — a single successful probe does not guarantee the next
    connection will also work.

    DEMO ONLY! Blocks the request for up to 2 minutes while GCP IAM propagates.
    In production this should be done asynchronously (e.g. task queue / callback)
    to avoid keeping the user waiting.
    """
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    db_name = mongo_url.split('@')[1].split('/')[1].split('?')[0] if '@' in mongo_url else '?'
    logger.info(f"wait_for_iam: waiting for IAM propagation on {db_name} (timeout={timeout_seconds}s, required_successes={required_successes})")

    interval = 5
    elapsed = 0
    consecutive_ok = 0
    while elapsed < timeout_seconds:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
        try:
            db = client.get_default_database()
            await db["_iam_probe"].insert_one({"_probe": True})
            await db["_iam_probe"].delete_many({"_probe": True})
            consecutive_ok += 1
            logger.info(f"wait_for_iam: SUCCESS at {elapsed}s, consecutive_ok={consecutive_ok}/{required_successes}")
            if consecutive_ok >= required_successes:
                logger.info(f"wait_for_iam: IAM ready for {db_name} after {elapsed}s ({required_successes} consecutive successes)")
                return
        except Exception as e:
            errmsg = getattr(e, 'details', {}).get('errmsg', str(e)) if hasattr(e, 'details') and isinstance(getattr(e, 'details', None), dict) else str(e)
            logger.warning(f"wait_for_iam: FAIL at {elapsed}s (consecutive_ok reset {consecutive_ok}->0): {errmsg}")
            consecutive_ok = 0
        finally:
            client.close()
        await asyncio.sleep(interval)
        elapsed += interval

    logger.error(f"wait_for_iam: TIMEOUT after {timeout_seconds}s for {db_name}, last consecutive_ok={consecutive_ok}")
    raise TimeoutError(f"IAM role did not propagate within {timeout_seconds}s for {mongo_url.split('@')[1].split('/')[1].split('?')[0]}")


def gcp_firestore_create_collections(database_id: str, collection_names: list, credentials=None) -> None:

    if credentials is None:
        credentials = gcp_get_credentials()

    try:
        client = firestore.Client(
            project=settings.GCP_PROJECT_ID,
            database=database_id,
            credentials=credentials
        )

        for collection_name in collection_names:
            try:
                marker_doc = client.collection(collection_name).document("_initialization_marker")
                marker_doc.set({"_created": True})
            except Exception as e:
                print(f"Warning: Could not initialize collection {collection_name} in {database_id}: {str(e)}")

    except Exception as e:
        raise ValueError(f"Failed to create collections in Firestore database {database_id}: {str(e)}")
