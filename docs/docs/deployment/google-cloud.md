---
sidebar_position: 3
title: Google Cloud
---

# Google Cloud Deployment

Deploy InstaCRUD to Google Cloud using Cloud Run for serverless containers and Firestore with MongoDB compatibility for the database.

---

## Architecture Overview


```
┌─────────────────────────────────────────────────────────┐
│                    Google Cloud                         │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Cloud Run  │    │  Cloud Run  │    │  Firestore  │  │
│  │  Frontend   │───>│  Backend    │───>│  (MongoDB)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                   │                            │
│        └───────┬───────────┘                            │
│                ▼                                        │
│       ┌─────────────┐                                   │
│       │ Secret Mgr  │                                   │
│       └─────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

**Components:**

- **Cloud Run** — Serverless container hosting for backend and frontend
- **Firestore** — MongoDB-compatible database (Enterprise edition)
- **Secret Manager** — Secure storage for API keys and credentials
- **Artifact Registry** — Docker image storage

---

## Prerequisites

1. Google Cloud account with billing enabled
2. `gcloud` CLI installed and configured
3. Docker installed locally

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

---

## Service Account Permissions

The default Compute Engine service account (e.g., `4839201756382-compute@developer.gserviceaccount.com`) needs the following IAM roles to deploy and run InstaCRUD. You can grant these roles manually via the [IAM Console](https://console.cloud.google.com/iam-admin/iam) or using the `gcloud` CLI commands below.

| Role | Purpose |
|------|---------|
| **Cloud Datastore Owner** | Full access to Firestore databases (create, read, write, delete) |
| **Project IAM Admin** | Manage IAM policies for multi-tenant database access |
| **Secret Manager Secret Accessor** | Read secrets at runtime (API keys, credentials) |

```bash
# Grant roles to the default Compute Engine service account
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/datastore.owner"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/resourcemanager.projectIamAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Step 1: Create Firestore System Database

Only the system database (`instacrud-system`) needs to be created manually. Organization databases are created automatically by the application during signup.

### Create Database

1. Go to [Firestore Console](https://console.cloud.google.com/firestore)
2. Click **Create Database**
3. Select **Firestore with MongoDB compatibility** (Enterprise edition)
4. Choose a location (e.g., `us-central1`)
5. Set the database ID to `instacrud-system`

### Create a Database User

1. Open your `instacrud-system` database in the [Firestore Console](https://console.cloud.google.com/firestore)
2. Go to **Security** (or navigate directly to `https://console.cloud.google.com/firestore/databases/instacrud-system/security/auth?project=YOUR_PROJECT_ID`)
3. Click **Add User**
4. Enter a username (e.g., `instacrud-system`)
5. Select the **User** role
6. Save and **copy the full connection string** — it is only shown once

The connection string will look like:

```
mongodb://USERNAME:PASSWORD@UID.LOCATION.firestore.goog:443/instacrud-system?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false
```

Use this value as the `MONGO_URL` secret when deploying the backend (see Step 4).

---

## Step 2: Set Up Artifact Registry

Create a Docker repository for your images:

```bash
# Enable API
gcloud services enable artifactregistry.googleapis.com

# Create repository
gcloud artifacts repositories create instacrud-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="InstaCRUD Docker images"

# Configure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## Step 3: Build and Push Images

### Backend Dockerfile

Ensure your backend `Dockerfile` exposes port 8080 (Cloud Run requirement):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-dev

COPY . .

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "instacrud.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Build and Push

```bash
# Backend
cd backend
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/backend:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/backend:latest

# Frontend
cd ../frontend
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/frontend:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/frontend:latest
```

---

## Step 4: Create Secrets

Store sensitive values in Secret Manager:

```bash
# Enable API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your-mongo-url" | gcloud secrets create MONGO_URL --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create SECRET_KEY --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "your-ms-client-secret" | gcloud secrets create MS_CLIENT_SECRET --data-file=-
echo -n "your-turnstile-secret-key" | gcloud secrets create TURNSTILE_SECRET_KEY --data-file=-
echo -n "your-brevo-api-key" | gcloud secrets create BREVO_API_KEY --data-file=-
echo -n "your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-deep-infra-key" | gcloud secrets create DEEP_INFRA_KEY --data-file=-
```

The `MONGO_URL` value is the connection string built in Step 1.

---

## Step 5: Deploy Backend to Cloud Run

```bash
gcloud run deploy instacrud-backend \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/backend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=0 \
  --max-instances=3 \
  --no-cpu-throttling=false \
  --set-env-vars="
    BASE_URL=http://localhost:8000,
    FRONTEND_BASE_URL=https://instacrud-frontend-HASH.us-central1.run.app,
    ALGORITHM=HS256,
    TOKEN_EXPIRATION_SECONDS=86400,
    DB_ENGINE=firestore,
    MONGO_TLS_ALLOW_INVALID=False,
    CORS_ALLOW_ORIGINS=*,
    CORS_ALLOW_CREDENTIALS=True,
    CORS_ALLOW_METHODS=*,
    CORS_ALLOW_HEADERS=*,
    GOOGLE_CLIENT_ID=your-google-client-id,
    MS_CLIENT_ID=your-ms-client-id,
    MS_TENANT_ID=common,
    OPEN_REGISTRATION=False,
    TURNSTILE_SITE_KEY=your-turnstile-site-key,
    TURNSTILE_MODE=normal,
    EMAIL_ENABLED=true,
    EMAIL_CARRIER=brevo,
    EMAIL_DRIVER=brevo,
    EMAIL_FROM_ADDRESS=noreply@yourdomain.com,
    EMAIL_FROM_NAME=InstaCRUD,
    SUGGEST_LOADING_MOCK_DATA=True,
    SUGGEST_LOADING_MOCK_DATA_DEFAULT=True,
    DEFAULT_TIER_CODE=free
  " \
  --set-secrets="
    MONGO_URL=MONGO_URL:latest,
    SECRET_KEY=SECRET_KEY:latest,
    GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,
    MS_CLIENT_SECRET=MS_CLIENT_SECRET:latest,
    TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest,
    BREVO_API_KEY=BREVO_API_KEY:latest,
    OPENAI_API_KEY=OPENAI_API_KEY:latest,
    ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,
    DEEP_INFRA_KEY=DEEP_INFRA_KEY:latest
  "
```

Note the deployed URL (e.g., `https://instacrud-backend-abc123-uc.a.run.app`).

---

## Step 6: Deploy Frontend to Cloud Run

```bash
gcloud run deploy instacrud-frontend \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT/instacrud-images/frontend:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=80 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=3 \
  --no-cpu-throttling=false \
  --set-env-vars="
    NEXT_PUBLIC_API_BASE_URL=https://instacrud-backend-HASH.us-central1.run.app
  "
```

---

## Step 7: Update Backend URL

After deploying frontend, update the backend with the correct frontend URL:

```bash
gcloud run services update instacrud-backend \
  --region=us-central1 \
  --update-env-vars="FRONTEND_BASE_URL=https://instacrud-frontend-xyz789-uc.a.run.app"
```

---

## Step 8: Configure OAuth Redirects

Update your OAuth providers with the Cloud Run URLs:

### Google Cloud Console

Add redirect URI:
```
https://instacrud-backend-abc123-uc.a.run.app/oauth/google/callback
```

### Microsoft Azure Portal

Add redirect URI:
```
https://instacrud-backend-abc123-uc.a.run.app/oauth/microsoft/callback
```

---

## Custom Domain (Optional)

Map a custom domain to Cloud Run:

```bash
gcloud run domain-mappings create \
  --service=instacrud-frontend \
  --domain=app.yourdomain.com \
  --region=us-central1
```

Follow the DNS verification steps provided by Google.

---

## GitHub Environment Setup

The repository includes `.github/init_gh.sh`, a script that creates the `stage` GitHub Actions environment and populates all variables in one shot.

**Why this is best practice:**
- Keeps configuration as code — reviewable, diffable, and repeatable across forks or new team members
- Variables and secrets are separated cleanly: non-sensitive config (GCP project, region, service names) in variables (visible in the UI), credentials in secrets (masked in logs)
- Eliminates manual click-through in GitHub settings, reducing the risk of misconfiguration or missed values

**How to use it:**

```bash
# 1. Authenticate with GitHub CLI
gh auth login

# 2. Run the script (defaults to esng-one/instacrud)
bash .github/init_gh.sh

# Or target a different repo (e.g. your own fork)
REPO=your-username/instacrud bash .github/init_gh.sh
```

The script ships with dummy placeholder values (`your-gcp-project-id`, `your-ar-repo-name`, etc.). Replace them with your actual GCP project values before running, or update them manually in your repo under **Settings → Environments → stage** afterwards.

---

## CI/CD with GitHub Actions

Automate deployments with GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: your-project-id
  REGION: us-central1

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and Push
        run: |
          docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/instacrud-images/backend:latest ./backend
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/instacrud-images/backend:latest

      - name: Deploy
        run: |
          gcloud run deploy instacrud-backend \
            --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/instacrud-images/backend:latest \
            --region=${{ env.REGION }}
```

---

## Firestore Database Management

### Organization Databases

Organization databases are created **automatically** by the application when a new organization is registered. The backend uses the GCP Firestore Admin API to:

1. Create a new Firestore database (`org-{organization-id}`)
2. Generate SCRAM-SHA-256 credentials for the database
3. Grant the `roles/datastore.user` IAM role scoped to that database
4. Store the resulting MongoDB connection string in the organization record

No manual database creation is needed for organizations.

### Database Naming Convention

- System database: `instacrud-system` (created manually)
- Organization databases: `org-{organization-id}` (created automatically)

---

## Cost Optimization

### Cloud Run Billing Modes

Cloud Run offers two CPU allocation modes that significantly impact costs:

**Request-based billing (default):**
- You're charged only when processing requests, during startup, and shutdown
- CPU is allocated exclusively during active request processing
- Idle instances are billed at a lower rate
- Best for sporadic or bursty traffic patterns

**Instance-based billing:**
- Charged for the entire container lifecycle, even when idle
- Required for background async processes, goroutines, threads, or monitoring agents (e.g., OpenTelemetry)
- Better for steady, high-volume traffic

:::tip Most Economical Setup
For the lowest cost, use **request-based billing** with `--min-instances=0`:

```bash
gcloud run deploy instacrud-backend \
  --min-instances=0 \
  --no-cpu-throttling=false \
  # ... other flags
```

This scales your service to zero when inactive. The tradeoff is **cold starts of approximately 30-60 seconds** when the first request arrives after idle periods.

Once you have stable traffic, set `--min-instances=1` to eliminate cold starts while still benefiting from request-based billing for cost savings.
:::

:::warning Request-Based Billing Limitations
Request-based billing does **not** allocate CPU outside of request processing. This means:
- Background tasks and async work after returning responses won't execute
- Long-running background processes are not supported
- Monitoring agents that run continuously won't work properly

If your application requires background processing, you have to use instance-based billing with `--no-cpu-throttling`, which increases costs significantly.
:::

### Cloud Run Instance Settings

- `--min-instances=0` — Scale to zero when idle (default, most economical)
- `--min-instances=1` — Keep one instance warm to avoid cold starts
- `--max-instances` — Set limits to control maximum spend

### Firestore

- Use Enterprise edition for MongoDB compatibility
- Monitor read/write operations
- Implement caching where appropriate

### Estimated Monthly Costs (as of early 2026)

For a **minimal configuration** (1 CPU, 512MB–1GB memory per service, 1 system database + 2 organization databases):

| Configuration | Estimated Monthly Cost |
|---------------|------------------------|
| `--min-instances=0` + request-based billing | < $50 |
| `--min-instances=1` + request-based billing | ~$70 |
| `--min-instances=1` + instance-based billing | ~$180 |

:::caution Disclaimer
These are average costs observed by the authors for a minimal setup. Your actual costs may vary based on usage patterns, region, and resource configuration. Always monitor your spending and set up [budget alerts](https://cloud.google.com/billing/docs/how-to/budgets) in the Google Cloud Console.
:::

---

## Summary

Google Cloud deployment provides:

- Serverless scaling with Cloud Run
- Managed MongoDB-compatible database with Firestore
- Secure secret management
- Automatic HTTPS and SSL certificates
- Global CDN for static assets
- CI/CD integration with GitHub Actions
