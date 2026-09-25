# Workload Identity Federation for GitHub Actions (Keyless Authentication)

locals {
  enable_github_actions = var.github_repo != ""
}

# Workload Identity Pool
resource "google_iam_workload_identity_pool" "github_pool" {
  count                     = local.enable_github_actions ? 1 : 0
  project                   = var.project_id
  workload_identity_pool_id = "${var.app_name}-github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions OIDC federation"

  depends_on = [google_project_service.enabled_apis]
}

# Workload Identity Provider
resource "google_iam_workload_identity_pool_provider" "github_provider" {
  count                              = local.enable_github_actions ? 1 : 0
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_pool[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Actions Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Dedicated Service Account for GitHub Actions CI/CD
resource "google_service_account" "github_actions_sa" {
  count        = local.enable_github_actions ? 1 : 0
  project      = var.project_id
  account_id   = "${var.app_name}-gh-deployer"
  display_name = "GitHub Actions CI/CD Service Account"

  depends_on = [google_project_service.enabled_apis]
}

# Allow GitHub Actions to impersonate this Service Account via OIDC
resource "google_service_account_iam_member" "wif_binding" {
  count              = local.enable_github_actions ? 1 : 0
  service_account_id = google_service_account.github_actions_sa[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_pool[0].name}/attribute.repository/${var.github_repo}"
}

# Grant CI/CD Service Account permissions to build and deploy
resource "google_project_iam_member" "gh_run_admin" {
  count   = local.enable_github_actions ? 1 : 0
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions_sa[0].email}"
}

resource "google_project_iam_member" "gh_ar_writer" {
  count   = local.enable_github_actions ? 1 : 0
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions_sa[0].email}"
}

# Allow GitHub Actions Service Account to act as the Cloud Run runtime SA
resource "google_service_account_iam_member" "gh_act_as_runtime_sa" {
  count              = local.enable_github_actions ? 1 : 0
  service_account_id = google_service_account.cloud_run_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_actions_sa[0].email}"
}

# Allow GitHub Actions Service Account to read secrets (for build-time injection like Google Maps)
resource "google_project_iam_member" "gh_secret_accessor" {
  count   = local.enable_github_actions ? 1 : 0
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.github_actions_sa[0].email}"
}
