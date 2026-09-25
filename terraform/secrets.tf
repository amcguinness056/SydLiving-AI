# Gemini API Key Secret
resource "google_secret_manager_secret" "gemini_key" {
  project   = var.project_id
  secret_id = "${var.app_name}-gemini-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "gemini_key_version" {
  count       = var.gemini_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.gemini_key.id
  secret_data = var.gemini_api_key
}

# Google Maps API Key Secret
resource "google_secret_manager_secret" "google_maps_key" {
  project   = var.project_id
  secret_id = "${var.app_name}-google-maps-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "google_maps_key_version" {
  count       = var.google_maps_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.google_maps_key.id
  secret_data = var.google_maps_api_key
}

# Domain.com.au API Key Secret
resource "google_secret_manager_secret" "domain_key" {
  project   = var.project_id
  secret_id = "${var.app_name}-domain-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled_apis]
}

resource "google_secret_manager_secret_version" "domain_key_version" {
  secret      = google_secret_manager_secret.domain_key.id
  secret_data = var.domain_api_key != "" ? var.domain_api_key : "none"
}
