output "backend_url" {
  description = "The public URL of the deployed SydLiving backend service."
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "The public URL of the deployed SydLiving frontend service."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "artifact_registry_repository" {
  description = "The Docker repository URL in Google Artifact Registry."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

output "data_bucket_name" {
  description = "The Cloud Storage bucket used for persistent SQLite storage and backups."
  value       = google_storage_bucket.data_bucket.name
}

output "service_account_email" {
  description = "The dedicated Cloud Run runtime service account."
  value       = google_service_account.cloud_run_sa.email
}

output "github_workload_identity_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions."
  value       = var.github_repo != "" ? google_iam_workload_identity_pool_provider.github_provider[0].name : "Not configured (set var.github_repo)"
}

output "github_actions_service_account" {
  description = "Service account email for GitHub Actions to authenticate as."
  value       = var.github_repo != "" ? google_service_account.github_actions_sa[0].email : "Not configured (set var.github_repo)"
}
