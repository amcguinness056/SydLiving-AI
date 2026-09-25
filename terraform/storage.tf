resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Cloud Storage bucket for persistent volume storage / backups
resource "google_storage_bucket" "data_bucket" {
  name                        = "${var.app_name}-data-${random_id.bucket_suffix.hex}"
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
  }

  depends_on = [google_project_service.enabled_apis]
}
