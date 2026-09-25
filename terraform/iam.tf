# Dedicated Service Account for Cloud Run runtime
resource "google_service_account" "cloud_run_sa" {
  project      = var.project_id
  account_id   = "${var.app_name}-runner"
  display_name = "Cloud Run runtime service account for ${var.app_name}"

  depends_on = [google_project_service.enabled_apis]
}

# Grant access to pull container images from Artifact Registry
resource "google_artifact_registry_repository_iam_member" "repo_reader" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.docker_repo.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant access to read secrets from Secret Manager
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant access to read/write persistent files in the storage bucket
resource "google_storage_bucket_iam_member" "bucket_admin" {
  bucket = google_storage_bucket.data_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
