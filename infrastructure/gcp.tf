terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.30.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "0.11.1"
    }
  }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "secret_key" {
  description = "JWT SECRET_KEY"
  type        = string
  sensitive   = true
}

variable "mongo_url_secret_key" {
  description = "Encryption key for org database connection URLs. Defaults to SECRET_KEY if not set — but rotating SECRET_KEY will then break all org DB connections."
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client ID (plain env var)"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ms_client_id" {
  description = "Microsoft OAuth client ID (plain env var)"
  type        = string
  default     = ""
}

variable "ms_client_secret" {
  description = "Microsoft OAuth client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "deepinfra_api_key" {
  description = "DeepInfra API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "brevo_api_key" {
  description = "Brevo (email) API key"
  type        = string
  sensitive   = true
  default     = ""
}

# ---------------------------------------------------------------------------
# App configuration variables
# ---------------------------------------------------------------------------

variable "ms_tenant_id" {
  type    = string
  default = "common"
}

variable "turnstile_site_key" {
  type    = string
  default = ""
}

variable "turnstile_mode" {
  type    = string
  default = "normal"
}

variable "open_registration" {
  type    = string
  default = "false"
}

variable "email_enabled" {
  type    = string
  default = "false"
}

variable "email_carrier" {
  type    = string
  default = "brevo"
}

variable "email_from_address" {
  type    = string
  default = ""
}

variable "email_from_name" {
  type    = string
  default = "InstaCRUD"
}

variable "tools_guardrail_model" {
  type    = string
  default = ""
}

variable "default_tier_code" {
  description = "Default subscription tier assigned to new organisations"
  type        = string
  default     = "free"
}

variable "suggest_loading_mock_data" {
  description = "Show mock data loading suggestion to new users"
  type        = string
  default     = "true"
}

# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Project info — used to compute deterministic Cloud Run URLs
# ---------------------------------------------------------------------------

data "google_project" "project" {}

locals {
  backend_url  = "https://instacrud-backend-${data.google_project.project.number}.${var.region}.run.app"
  frontend_url = "https://instacrud-frontend-${data.google_project.project.number}.${var.region}.run.app"
}

# ---------------------------------------------------------------------------
# Enable required APIs
# ---------------------------------------------------------------------------

resource "google_project_service" "services" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = true
}

# ---------------------------------------------------------------------------
# Service account for Cloud Run
# ---------------------------------------------------------------------------

resource "google_service_account" "cloud_run" {
  account_id   = "instacrud-cloud-run"
  display_name = "InstaCRUD Cloud Run SA"
}

resource "google_project_iam_member" "datastore_owner" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "project_iam_admin" {
  project = var.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ---------------------------------------------------------------------------
# Service account for Firestore management (instacrud-fsmgr)
# ---------------------------------------------------------------------------

resource "google_service_account" "fsmgr" {
  account_id   = "instacrud-fsmgr"
  display_name = "InstaCRUD Firestore Manager SA"
}

resource "google_project_iam_member" "fsmgr_datastore_owner" {
  project = var.project_id
  role    = "roles/datastore.owner"
  member  = "serviceAccount:${google_service_account.fsmgr.email}"
}

resource "google_project_iam_member" "fsmgr_database_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.fsmgr.email}"
}

resource "google_project_iam_member" "fsmgr_firebase_admin" {
  project = var.project_id
  role    = "roles/firebase.admin"
  member  = "serviceAccount:${google_service_account.fsmgr.email}"
}

# ---------------------------------------------------------------------------
# Firestore — system database (Enterprise, PESSIMISTIC for MongoDB compatibility)
# ---------------------------------------------------------------------------

resource "google_firestore_database" "mongodb_compatible_db" {
  provider    = google-beta
  project = var.project_id
  name        = "instacrud-system"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Set to ENTERPRISE to unlock MongoDB features
  database_edition = "ENTERPRISE"

  # Explicitly enable the MongoDB API access mode
  mongodb_compatible_data_access_mode = "DATA_ACCESS_MODE_ENABLED"

  delete_protection_state = "DELETE_PROTECTION_DISABLED"
  deletion_policy         = "DELETE"

  depends_on = [google_project_service.services]
}

resource "time_sleep" "waitf_for_mongo_db" {
  depends_on = [google_firestore_database.mongodb_compatible_db]

  create_duration = "30s"
}

resource "google_firestore_user_creds" "mongo_user" {
  provider  = google-beta
  project   = var.project_id
  database  = google_firestore_database.mongodb_compatible_db.name
  name      = "instacrud-system"

  depends_on = [time_sleep.waitf_for_mongo_db]
}

resource "google_project_iam_member" "mongo_user_owner" {
  project = var.project_id
  role    = "roles/datastore.owner" # Gives full access to all Firestore/Mongo data
  
  # Firestore Mongo user credentials expose a principal:// identity (not a
  # serviceAccount: identity). In Cloud Console this principal type may appear
  # as CUSTOM even though the bound role is roles/datastore.owner.
  # This attribute links the username/password to the actual IAM permission.
  member  = google_firestore_user_creds.mongo_user.resource_identity[0].principal


  condition {
    title       = "[Auto-generated from Firestore Authentication page]"
    expression  = "resource.name == \"projects/${var.project_id}/databases/${google_firestore_database.mongodb_compatible_db.name}\""
  }
}

resource "time_sleep" "wait_for_mongo_user_iam" {
  depends_on = [google_project_iam_member.mongo_user_owner]

  # IAM role propagation on fresh projects is eventually consistent.
  create_duration = "30s"
}

# ---------------------------------------------------------------------------
# MONGO_URL — constructed from Firestore user credentials
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret" "mongo_url" {
  secret_id = "MONGO_URL"

  replication {
    auto {}
  }
 
  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "mongo_url_version" {
  secret = google_secret_manager_secret.mongo_url.id
  secret_data = join("", [
    "mongodb://",
    urlencode(google_firestore_user_creds.mongo_user.name),
    ":",
    urlencode(google_firestore_user_creds.mongo_user.secure_password),
    "@",
    google_firestore_database.mongodb_compatible_db.uid,
    ".",
    google_firestore_database.mongodb_compatible_db.location_id,
    ".firestore.goog:443/",
    google_firestore_database.mongodb_compatible_db.name,
    "?loadBalanced=true&tls=true&authMechanism=SCRAM-SHA-256&retryWrites=false",
  ])
}

# ---------------------------------------------------------------------------
# Secret Manager
# ---------------------------------------------------------------------------

locals {
  backend_image  = "${var.region}-docker.pkg.dev/${var.project_id}/instacrud/backend:latest"
  frontend_image = "${var.region}-docker.pkg.dev/${var.project_id}/instacrud/frontend:latest"
}

locals {
  variable_secrets = {
    SECRET_KEY           = var.secret_key
    MONGO_URL_SECRET_KEY = var.mongo_url_secret_key
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    MS_CLIENT_SECRET     = var.ms_client_secret
    OPENAI_API_KEY       = var.openai_api_key
    ANTHROPIC_API_KEY    = var.anthropic_api_key
    DEEP_INFRA_KEY       = var.deepinfra_api_key
    BREVO_API_KEY        = var.brevo_api_key
    TURNSTILE_SECRET_KEY = var.turnstile_secret_key
  }
}

resource "google_secret_manager_secret" "variable_secrets" {
  for_each  = local.variable_secrets
  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

locals {
  populated_secret_keys = toset([
    for k, v in local.variable_secrets : k if nonsensitive(v != "")
  ])
}

resource "google_secret_manager_secret_version" "secret_values" {
  for_each = local.populated_secret_keys

  secret      = google_secret_manager_secret.variable_secrets[each.key].id
  secret_data = local.variable_secrets[each.key]
}

# ---------------------------------------------------------------------------
# Backend Cloud Run service
# ---------------------------------------------------------------------------

locals {
  frontend_secret_keys = toset([
    for k in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEP_INFRA_KEY"] : k
    if contains(local.populated_secret_keys, k)
  ])
}

resource "google_cloud_run_v2_service" "backend" {
  name     = "instacrud-backend"
  location = var.region

  template {
    service_account                  = google_service_account.cloud_run.email
    timeout                          = "300s"
    max_instance_request_concurrency = 80

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = local.backend_image

      ports {
        container_port = 8080
      }

      startup_probe {
        timeout_seconds   = 240
        period_seconds    = 240
        failure_threshold = 1
        tcp_socket {
          port = 8080
        }
      }

      env {
        name  = "MODE"
        value = "prod"
      }
      env {
        name  = "BASE_URL"
        value = "http://localhost:8000"
      }
      env {
        name  = "DB_ENGINE"
        value = "firestore"
      }
      env {
        name  = "FRONTEND_BASE_URL"
        value = local.frontend_url
      }
      env {
        name  = "CORS_ALLOW_ORIGINS"
        value = "*"
      }
      env {
        name  = "CORS_ALLOW_CREDENTIALS"
        value = "True"
      }
      env {
        name  = "CORS_ALLOW_METHODS"
        value = "*"
      }
      env {
        name  = "CORS_ALLOW_HEADERS"
        value = "*"
      }
      env {
        name  = "MONGO_TLS_ALLOW_INVALID"
        value = "False"
      }
      env {
        name  = "ALGORITHM"
        value = "HS256"
      }
      env {
        name  = "TOKEN_EXPIRATION_SECONDS"
        value = "86400"
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "MS_CLIENT_ID"
        value = var.ms_client_id
      }
      env {
        name  = "MS_TENANT_ID"
        value = var.ms_tenant_id
      }
      env {
        name  = "TURNSTILE_SITE_KEY"
        value = var.turnstile_site_key
      }
      env {
        name  = "TURNSTILE_MODE"
        value = var.turnstile_mode
      }
      env {
        name  = "OPEN_REGISTRATION"
        value = var.open_registration
      }
      env {
        name  = "EMAIL_ENABLED"
        value = var.email_enabled
      }
      env {
        name  = "EMAIL_CARRIER"
        value = var.email_carrier
      }
      env {
        name  = "EMAIL_DRIVER"
        value = var.email_carrier
      }
      env {
        name  = "EMAIL_FROM_ADDRESS"
        value = var.email_from_address
      }
      env {
        name  = "EMAIL_FROM_NAME"
        value = var.email_from_name
      }
      env {
        name  = "DEFAULT_TIER_CODE"
        value = var.default_tier_code
      }
      env {
        name  = "SUGGEST_LOADING_MOCK_DATA"
        value = var.suggest_loading_mock_data
      }
      env {
        name  = "SUGGEST_LOADING_MOCK_DATA_DEFAULT"
        value = var.suggest_loading_mock_data
      }
      env {
        name  = "ALLOW_AI_TOOLS"
        value = "true"
      }
      env {
        name  = "ALLOW_AI_RW_ACCESS"
        value = "true"
      }
      env {
        name  = "ALLOW_AI_SYSTEM_ACCESS"
        value = "false"
      }
      env {
        name  = "TOOLS_GUARDRAIL_MODEL"
        value = var.tools_guardrail_model
      }

      env {
        name = "MONGO_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mongo_url.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = local.populated_secret_keys
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.variable_secrets[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
    }
  }

  depends_on = [
    google_project_service.services,
    google_firestore_database.mongodb_compatible_db,
    time_sleep.wait_for_mongo_user_iam,
    google_secret_manager_secret_version.secret_values,
    google_secret_manager_secret_version.mongo_url_version,
    google_cloud_run_v2_service.frontend,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Frontend Cloud Run service
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "frontend" {
  name     = "instacrud-frontend"
  location = var.region

  template {
    service_account                  = google_service_account.cloud_run.email
    timeout                          = "300s"
    max_instance_request_concurrency = 80

    # annotations = {
    #   "run.googleapis.com/startup-cpu-boost" = "true"
    # }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = local.frontend_image

      ports {
        container_port = 80
      }

      startup_probe {
        timeout_seconds   = 240
        period_seconds    = 240
        failure_threshold = 3
        tcp_socket {
          port = 80
        }
      }

      env {
        name  = "NEXT_PUBLIC_API_BASE_URL"
        value = local.backend_url
      }

      dynamic "env" {
        for_each = local.frontend_secret_keys
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.variable_secrets[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/instacrud"
}

output "backend_url" {
  value = local.backend_url
}

output "frontend_url" {
  value = local.frontend_url
}

output "firestore_system_db" {
  value = google_firestore_database.mongodb_compatible_db.name
}

output "cloud_run_service_account" {
  value = google_service_account.cloud_run.email
}
