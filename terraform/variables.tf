variable "project_id" {
  description = "The GCP Project ID where resources will be deployed."
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources into (defaults to Sydney, Australia)."
  type        = string
  default     = "australia-southeast1"
}

variable "environment" {
  description = "Deployment environment name (e.g. production, staging, dev)."
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application prefix for naming resources."
  type        = string
  default     = "sydliving"
}

variable "backend_image" {
  description = "Docker image URI for the backend service. Defaults to a placeholder until built and pushed."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "frontend_image" {
  description = "Docker image URI for the frontend service. Defaults to a placeholder until built and pushed."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "gemini_api_key" {
  description = "Google Gemini API Key for AI Agent natural language processing."
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_maps_api_key" {
  description = "Google Maps API Key for Distance Matrix and Places transit lookups."
  type        = string
  sensitive   = true
  default     = ""
}

variable "domain_api_key" {
  description = "Optional Domain.com.au API Key for real-time rental listings."
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_path" {
  description = "Path to the SQLite database file inside the container."
  type        = string
  default     = "/app/sydliving.db"
}

variable "allowed_origins" {
  description = "Additional allowed CORS origins for the FastAPI backend (e.g., custom domains)."
  type        = list(string)
  default     = []
}

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo' for Workload Identity Federation (e.g., 'amcguinness056/SydLiving-AI')."
  type        = string
  default     = ""
}
