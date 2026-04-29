# InstaCRUD — Google Cloud Infrastructure

Terraform configuration for deploying InstaCRUD on Google Cloud Platform.

## What gets created

| Resource | Name | Purpose |
|---|---|---|
| Artifact Registry repo | `instacrud` | Stores Docker images (created manually) |
| Service account | `instacrud-cloud-run` | Identity for Cloud Run services |
| Firestore database | `instacrud-system` | System-level application data |
| Secret Manager secrets | see below | All sensitive config values |
| Cloud Run service | `instacrud-backend` | FastAPI backend (port 8000) |
| Cloud Run service | `instacrud-frontend` | Next.js frontend (port 80) |

Both Cloud Run services are public and scale to zero by default (cold start ~30–60 s).

Org-specific databases (`org-{id}`) are created automatically by the application at runtime — no manual setup needed.

`MONGO_URL` is derived automatically from the Firestore database name — no manual step required.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) authenticated
- [Docker Desktop](https://docs.docker.com/get-docker/) installed and running
- A GCP project with billing enabled

## Step-by-step setup

All commands below assume the repo root as the working directory unless stated otherwise.

### 1. Authenticate with GCP

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Create the Artifact Registry repository

The repository is managed manually (not by Terraform). Create it once per GCP project:

```bash
gcloud artifacts repositories create instacrud \
  --repository-format=docker \
  --location=us-central1 \
  --description="InstaCRUD container images"

gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 3. Compute the service URLs

Cloud Run v2 URLs are deterministic. Get the project number once and derive both URLs upfront — no redeployment needed later.

```bash
REGION="us-central1"
PROJECT="YOUR_PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format="value(projectNumber)")

BACKEND_URL="https://instacrud-backend-${PROJECT_NUMBER}.${REGION}.run.app"
FRONTEND_URL="https://instacrud-frontend-${PROJECT_NUMBER}.${REGION}.run.app"

echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
```

### 4. Build and push images

```bash
REPO="$REGION-docker.pkg.dev/$PROJECT/instacrud"

# Backend
docker build -t "$REPO/backend:latest" ./backend
docker push "$REPO/backend:latest"

# Frontend — backend URL is baked in at build time
docker build --build-arg NEXT_PUBLIC_API_BASE_URL="$BACKEND_URL" \
  -t "$REPO/frontend:latest" ./frontend
docker push "$REPO/frontend:latest"
```

### 5. Create `terraform.tfvars`

All Terraform commands run from the `infrastructure/` directory.

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and fill in your values. **Never commit this file** — it contains secrets.

### 6. Initialise and deploy

> **Note:** Revert the provider version if you have an existing `.terraform.lock.hcl` pinned to 5.x — run `terraform init -upgrade` once to pull 6.x.

```bash
# from infrastructure/
terraform init
terraform apply
```

Review the plan and type `yes` to confirm. One apply — done.

### 6b. GCP propagation delays — re-run `terraform apply` if needed

Terraform provisions Firestore resources (database, user credentials, IAM bindings) and then
immediately deploys Cloud Run services that depend on them. GCP needs time to propagate these
resources internally, and the first `apply` may fail with errors such as:

```
Error 400: The operation was aborted.
Error 400: Precondition check failed.
Error creating UserCreds: googleapi: Error 409: The operation was aborted.
Error: Error waiting for operation to complete: error code 400
```

These are transient — the resources exist but GCP hasn't finished making them available cluster-wide.
Simply re-run:

```bash
terraform apply
```

A second apply will succeed once propagation is complete. No manual changes needed.

### 7. Configure OAuth redirect URIs

Add the callback URLs to your OAuth provider consoles (you already know these from step 3):

```
https://instacrud-backend-PROJECT_NUMBER.REGION.run.app/auth/google/callback
https://instacrud-backend-PROJECT_NUMBER.REGION.run.app/auth/microsoft/callback
```

## Secrets

| Secret Manager name | Env var | Notes |
|---|---|---|
| `SECRET_KEY` | `SECRET_KEY` | JWT signing key — required |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` | Optional — Google OAuth |
| `MS_CLIENT_SECRET` | `MS_CLIENT_SECRET` | Optional — Microsoft OAuth |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` | Optional |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | Optional |
| `DEEP_INFRA_KEY` | `DEEP_INFRA_KEY` | Optional |
| `BREVO_API_KEY` | `BREVO_API_KEY` | Optional — email |
| `TURNSTILE_SECRET_KEY` | `TURNSTILE_SECRET_KEY` | Optional — Cloudflare Turnstile |

Plain env vars (not secrets): `MONGO_URL` (derived from Firestore DB name), `GOOGLE_CLIENT_ID`, `MS_CLIENT_ID`.

## Outputs

```bash
# from infrastructure/
terraform output
```

| Output | Description |
|---|---|
| `artifact_registry_url` | Image prefix for `docker push` |
| `backend_url` | Backend Cloud Run URL |
| `frontend_url` | Frontend Cloud Run URL |
| `firestore_system_db` | Firestore system database name |
| `cloud_run_service_account` | Service account email |

## Updating a deployment

From the repo root, rebuild and push the changed image, then re-apply:

```bash
REGION="us-central1"
PROJECT="YOUR_PROJECT_ID"
REPO="$REGION-docker.pkg.dev/$PROJECT/instacrud"

docker build -t "$REPO/backend:latest" ./backend
docker push "$REPO/backend:latest"

# from infrastructure/
terraform apply
```

## Troubleshooting

### 400 — Secret Manager payload required

Happens when an optional secret (e.g. `GOOGLE_CLIENT_SECRET`) is left as an empty string in `terraform.tfvars`. Empty secrets are skipped automatically — if you see this error, ensure you are on the latest version of `gcp.tf`.

## Teardown

```bash
# from infrastructure/
terraform destroy
```

This removes all managed resources including secrets and the Firestore database. **Data will be lost.**
