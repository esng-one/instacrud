#!/usr/bin/env bash
# init_gh.sh — Create and populate GitHub Actions environments for instacrud
# Usage: gh auth login  (then run this script)
#        REPO=owner/repo bash .github/init_gh.sh

set -euo pipefail

REPO="${REPO:-esng-one/instacrud}"  # replace with your repository

# Helper: set an environment variable (forces string type via raw JSON)
set_var() {
  local env=$1 name=$2 value=$3
  gh api --method POST "repos/$REPO/environments/$env/variables" \
    --input - <<< "{\"name\":\"$name\",\"value\":\"$value\"}" > /dev/null
  echo "  var  $name"
}

# Helper: set an environment secret
set_secret() {
  local env=$1 name=$2 value=$3
  gh secret set "$name" --body "$value" --env "$env" --repo "$REPO"
  echo "  secret $name"
}

# ─────────────────────────────────────────────
# STAGE environment
# ─────────────────────────────────────────────
echo "Creating environment: stage"
gh api --method PUT "repos/$REPO/environments/stage" > /dev/null

echo "Setting stage variables..."
set_var stage GCP_PROJECT_ID        "your-gcp-project-id"
set_var stage GCP_REGION            "us-central1"
set_var stage GCP_SERVICE_ACCOUNT   "github-actions-deployer@your-gcp-project-id.iam.gserviceaccount.com"
set_var stage GCP_WIF_PROVIDER      "projects/000000000000/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
set_var stage AR_HOST               "us-central1-docker.pkg.dev"
set_var stage AR_REPO               "your-ar-repo-name"
set_var stage BACKEND_IMAGE_NAME    "instacrud-app-backend"
set_var stage BACKEND_SERVICE_NAME  "stage-instacrud-app-backend"
set_var stage FRONTEND_IMAGE_NAME   "instacrud-app-frontend"
set_var stage FRONTEND_SERVICE_NAME "stage-instacrud-app-frontend"
set_var stage NEXT_PUBLIC_API_BASE_URL "https://your-backend-url.run.app"

echo "Stage environment ready."
echo

# ─────────────────────────────────────────────
# VPS environment
# ─────────────────────────────────────────────
echo "Creating environment: vps"
gh api --method PUT "repos/$REPO/environments/vps" > /dev/null

echo "Setting vps variables..."
set_var vps DOMAIN                          "your-domain.com"
set_var vps SSL_ENABLED                     "true"
set_var vps EMAIL_ENABLED                   "true"
set_var vps EMAIL_CARRIER                   "brevo"
set_var vps EMAIL_FROM_ADDRESS              "noreply@your-domain.com"
set_var vps EMAIL_FROM_NAME                 "YourAppName"
set_var vps TURNSTILE_SITE_KEY              "your-turnstile-site-key"
set_var vps TURNSTILE_MODE                  "normal"
set_var vps OPEN_REGISTRATION               "true"
set_var vps SUGGEST_LOADING_MOCK_DATA       "true"
set_var vps SUGGEST_LOADING_MOCK_DATA_DEFAULT "true"
set_var vps DEFAULT_TIER_CODE               "free"
set_var vps GOOGLE_CLIENT_ID               "your-google-client-id.apps.googleusercontent.com"
set_var vps MS_CLIENT_ID                   "your-ms-client-id"
set_var vps MS_TENANT_ID                   "common"

echo "Setting vps secrets..."
set_secret vps VPS_HOST             "your-vps-ip-or-hostname"
set_secret vps VPS_USERNAME         "ubuntu"
set_secret vps VPS_PASSWORD         "your-vps-password"
set_secret vps MONGO_PASSWORD       "your-mongo-password"
set_secret vps SECRET_KEY           "your-jwt-secret-key-min-32-chars"
set_secret vps DEEP_INFRA_KEY       "your-deepinfra-api-key"
set_secret vps TURNSTILE_SECRET_KEY "your-turnstile-secret-key"
set_secret vps MS_CLIENT_SECRET     "your-ms-client-secret"
set_secret vps GOOGLE_CLIENT_SECRET "your-google-client-secret"
set_secret vps BREVO_API_KEY        "your-brevo-api-key"

echo "VPS environment ready."
echo
echo "Done. Both environments created in $REPO"
echo "Replace dummy values with real ones before running workflows."
