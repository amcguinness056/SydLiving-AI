# SydLiving AI

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Gemini](https://img.shields.io/badge/AI_Agent-Gemini_3.8_Flash-4285F4?style=flat&logo=google-gemini&logoColor=white)](https://ai.google.dev)
[![LangChain](https://img.shields.io/badge/Orchestration-LangChain_Deep_Agents-1C3C3C?style=flat&logo=langchain&logoColor=white)](https://python.langchain.com)
[![Leaflet](https://img.shields.io/badge/Maps-React_Leaflet-199900?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Site](https://img.shields.io/badge/Live_Demo-sydliving.com-2563eb?style=flat&logo=google-chrome&logoColor=white)](https://sydliving.com)

> 🌐 **Live Application**: **[https://sydliving.com](https://sydliving.com)** (or **[https://www.sydliving.com](https://www.sydliving.com)**)

**SydLiving AI** is an AI-augmented property discovery and commute intelligence platform tailored for professionals, students, and expats relocating to Sydney, Australia.

Moving to Sydney often means balancing steep rental markets against complex public transit commutes across Sydney Harbour, the Eastern Suburbs, and Greater Western Sydney. SydLiving AI demystifies Sydney housing by unifying **Kai — an authentic AI Living Concierge**, **LangChain Deep Multi-Agent orchestration**, **Transport for NSW (TfNSW) transit matrices**, and a **side-by-side shortlist comparison suite** in a single glassmorphic workspace.

---

![SydLiving AI Overview](docs/screenshots/dark_mode_commute_map.png)

---

## 🌟 Key Features

### 1. Kai — Sydney Living AI Concierge (Deep Multi-Agent Engine)
Meet **Kai**, Sydney's dedicated AI relocation concierge. Kai brings authentic local knowledge to your search—from morning sun angles, beach wind conditions, and cafe strips to door-to-door transit nuances across the **Sydney Metro M1**, **Light Rail (L1/L2/L3)**, **Sydney Ferries**, and **Express Buses**.

- **Multi-Agent Orchestration:** Powered by LangChain Deep Agents coordinating specialized subagents in parallel:
  - `property_scout`: Searches verified Domain listings and local rental data by budget and specs.
  - `commute_specialist`: Calculates transit schedules, transfer points, and door-to-door travel times.
  - `lifestyle_scout`: Investigates local cafes, gyms, beach proximity, and neighborhood vibe.
- **Real-Time Step Streaming:** Live visual activity log showing agent thoughts, subagent delegations, and stopwatch latency tracking.
- **Interactive In-App Property Linking:** Kai formats every property recommendation as a clickable `[Title](property:<id>)` link. Clicking any chip in chat immediately centers the listing on the map and opens its detail drawer.
- **Contextual Inquiry Cards:**
  - **Property Detail Drawer:** One-click "Ask Kai About This Home" chips covering commute breakdowns, beach lifestyle, rent fairness, and local dining, plus an inline question box.
  - **Shortlist Comparison:** "Ask Kai to Compare" presets that synthesize multi-property trade-offs.
- **Elevated Concierge Capsule & Greeting Bubble:** A prominent floating launcher featuring Kai's avatar with an active live pulse indicator and a dismissible proactive greeting bubble with one-click search chips.

![Kai AI Concierge Chat](docs/screenshots/kai_ai_concierge_chat.png)

---

### 2. Side-by-Side Shortlist & Living Cost Suite
Compare shortlisted properties side-by-side to make informed relocation decisions.

- **Financial Clarity:** View weekly rent alongside projected monthly housing obligations.
- **Door-to-Door Commute Breakdown:** Compare travel minutes and transit lines to major commercial centers.
- **Opal Transit Fare Estimates:** Estimated weekly transit expenses based on a standard 10-trip weekly commute.
- **Lifestyle Metrics:** Proximity to iconic beaches (Bondi, Manly, Coogee, Bronte, Clovelly) and transfer friction.
- **Ask Kai to Compare:** Instantly feeds your shortlisted homes to Kai for a comparative breakdown of transit convenience, neighborhood vibe, and total weekly living cost.

![Shortlist Comparison Modal](docs/screenshots/shortlist_compare_modal.png)

---

### 3. Clean Spatial Property Discovery (285+ Live Sydney Rentals)
Explore a rich dataset of **285 live rental listings** across Sydney's most sought-after regions, including the Eastern Suburbs (Bondi, Coogee, Randwick, Maroubra, Bronte, Double Bay, Paddington), Inner West (Newtown, Surry Hills), Lower North Shore (Chatswood), and Northern Beaches (Manly).

- **Curated Photography & Multi-Photo Galleries:** Rich multi-photo carousels with smooth lightbox viewer and floor plan previews.
- **Decluttered Map Canvas:** Fast, responsive Google Maps canvas with subtle Bondi Blue price markers, dark mode styling, and cluster grouping.
- **Spatial Drawing Filters:** Draw custom circles or polygons directly on the map to bound property searches.
- **Natural Language Search Helper:** An organic `"Or ask Kai"` prompt helper embedded beneath search filters.

---

## 🏗️ Architecture

SydLiving AI is architected as a local-first, production-grade cloud platform:

- **Backend:** FastAPI (Python 3.11+), Pydantic v2
- **Agent Framework:** LangChain Deep Agents with hierarchical multi-agent supervisor and subagents
- **AI Model:** Google Gemini (`gemini-3.8-flash`) via `langchain-google-genai` and Google GenAI SDK
- **Database:** SQLite (`sydliving.db` containing 285 properties and 216 commute matrix routes)
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, Google Maps JavaScript API

```mermaid
graph TD
    User([User]) <-->|Natural Language Queries & Prompts| UI[React 19 + Tailwind v4 UI]
    User <-->|Interactive Map & Shortlist| UI
    
    UI <-->|REST API & SSE Event Stream| API[FastAPI Backend]
    
    API <-->|Multi-Agent Orchestration| Supervisor[Kai Supervisor Agent]
    Supervisor <-->|Property Queries| Scout[Property Scout Subagent]
    Supervisor <-->|Transit Calculations| Commute[Commute Specialist Subagent]
    Supervisor <-->|Amenities & Vibe| Lifestyle[Lifestyle Scout Subagent]
    
    Scout <-->|Domain & Local Search| DB[(SQLite Database: sydliving.db)]
    Commute <-->|Commute Matrix & TfNSW| DB
    Lifestyle <-->|Google Places| Places[Google Places API]
```

---

## 🚀 Development Setup

### Prerequisites
- Python 3.11+
- Node.js (v18+ recommended)
- Git

### 1. Database Setup & Data Seeding
Generate the SQLite database and seed it with 252 Sydney property listings, destination hubs, and commute matrices:

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Seed the database
python3 seed.py
```
*Creates `sydliving.db` containing 252 rental listings with curated Unsplash photography and 216 commute routes.*

### 2. Environment Configuration
Create a `.env` file in `backend/`:

```env
# Google Gemini API Key for conversational AI agent
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash

# Optional: Domain Group API Key & Google Places API Key
DOMAIN_API_KEY=
GOOGLE_API_KEY=
```

### 3. Run FastAPI Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 4. Run React + Vite Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
The frontend application will be live at `http://localhost:5173`.

---

## ☁️ Google Cloud Platform (GCP) Hosting Architecture

SydLiving AI is fully hosted and operated on **Google Cloud Platform (GCP)** within the **`australia-southeast1` (Sydney)** region to minimize latency for Australian users, real estate APIs, and Transport for NSW services.

### 🌐 Live Production Endpoints
- **Primary Custom Domain:** [https://sydliving.com](https://sydliving.com) (and [https://www.sydliving.com](https://www.sydliving.com))
- **Firebase Global CDN Mirror:** [https://sydliving-ai.web.app](https://sydliving-ai.web.app)
- **Cloud Run Backend Service:** `https://sydliving-backend-rnlsfkvaba-ts.a.run.app`
- **GCP Project:** `sydliving-ai` | **Default Region:** `australia-southeast1` (Sydney)

---

### 🏛️ Cloud Architecture Diagram

```mermaid
graph TD
    User([User / Browser]) <-->|HTTPS / HTTP3| CDN[Firebase Hosting Edge CDN<br/>sydliving.com]
    
    subgraph GCP ["Google Cloud Platform (australia-southeast1)"]
        subgraph EdgeRouting ["Edge Traffic Routing (firebase.json)"]
            CDN -->|Static Assets & SPA Routes /**| Frontend[Cloud Run: sydliving-frontend<br/>React 19 + Nginx]
            CDN -->|API Requests /api/**| Backend[Cloud Run: sydliving-backend<br/>FastAPI + Python 3.11]
        end
        
        subgraph StoragePersistence ["Data Persistence & Storage"]
            Backend <-->|Volume Mount /data| GCSBucket[(Google Cloud Storage Bucket<br/>sydliving.db Persistence)]
        end
        
        subgraph SecuritySecrets ["Zero-Trust Secrets Management"]
            GSM[(Google Secret Manager)] -.->|Runtime Env Injection| Backend
            GSM --- GemKey[sydliving-gemini-api-key]
            GSM --- MapKey[sydliving-google-maps-api-key]
            GSM --- DomKey[sydliving-domain-api-key]
            GSM --- ApfKey[sydliving-apify-api-token]
        end
        
        subgraph CI_CD ["Automated CI/CD Pipeline"]
            GHA[GitHub Actions Runner] -->|Keyless OIDC Auth| WIF[Workload Identity Federation]
            WIF --> ServiceAccount[sydliving-runner Service Account]
            ServiceAccount --> ArtifactRegistry[Artifact Registry<br/>Docker Images]
            ArtifactRegistry -.->|Rolling Deploy| Backend
            ArtifactRegistry -.->|Rolling Deploy| Frontend
        end
    end
    
    subgraph ExternalServices ["External Intelligence Services"]
        Backend <-->|AI Living Concierge| Gemini[Google Gemini 3.8 Flash]
        Backend <-->|Distance Matrix & Isochrones| GoogleMaps[Google Maps Platform]
        Backend <-->|Live Rental Listings| ApifyDomain[Apify / Domain.com.au]
    end
```

---

### 🧩 Core GCP Services & Implementation

| GCP Service | Role in SydLiving AI | Technical Details |
|---|---|---|
| **Firebase Hosting** | Global Edge CDN & SSL Termination | Provides HTTP/3, global edge caching, and custom domain SSL for `sydliving.com`. Rewrites `/api/**` directly to Cloud Run backend, completely eliminating cross-origin (CORS) overhead. |
| **Cloud Run v2** | Serverless Container Compute | Runs `sydliving-backend` and `sydliving-frontend` with scale-to-zero autoscaling (0 to 10 instances) for minimal idle cost and rapid sub-second scale out under load. |
| **Google Cloud Storage (GCS)** | Persistent Database Storage | Backs Cloud Run second-generation volume mount at `/data/sydliving.db`, ensuring SQLite property data, commute caches, and user shortlists survive container revisions and restarts. |
| **Google Secret Manager** | Secure Runtime Secrets | Encrypts and injects API credentials (`GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `DOMAIN_API_KEY`, `APIFY_API_TOKEN`) directly into the container runtime. Zero secrets are committed to git or baked into Docker layers. |
| **Google Artifact Registry** | Container Registry | Secure Docker repository (`australia-southeast1-docker.pkg.dev/sydliving-ai/sydliving-repo`) storing immutable, commit-SHA-tagged container images. |
| **Workload Identity Federation** | Keyless CI/CD Authentication | Allows GitHub Actions to securely assume GCP IAM service account roles via short-lived OIDC tokens without storing static service account JSON private keys. |
| **Terraform (IaC)** | Declarative Infrastructure | Fully codified infrastructure under `terraform/` enabling reproducible provisioning of all GCP resources. |

---

### 🚀 Automated Deployment Pipeline

Deployments to production are completely automated via GitHub Actions (`.github/workflows/deploy.yml`):

1. **Trigger:** Push or PR merge to the `main` branch.
2. **Keyless Authentication:** GitHub Actions exchanges an OpenID Connect (OIDC) JWT with Google Workload Identity Federation to assume the `sydliving-runner` Service Account.
3. **Build & Push:**
   - Multi-stage Docker builds for backend (`python:3.11-slim`) and frontend (`node:22-alpine` + `nginx:alpine-slim`).
   - Pushes commit-SHA-tagged and `:latest` images to Artifact Registry.
4. **Cloud Run Rolling Update:**
   - Deploys container updates to `sydliving-backend` and `sydliving-frontend` with zero downtime.
5. **Firebase Hosting CDN Refresh:**
   - Syncs static frontend bundle and edge rewrites to Firebase Hosting CDN.

For detailed step-by-step manual setup or infrastructure recreation, see:
- [docs/gcp_deployment_guide.md](docs/gcp_deployment_guide.md) — Comprehensive Terraform IaC and manual deploy guide.
- [docs/github_actions_gcp_guide.md](docs/github_actions_gcp_guide.md) — Workload Identity Federation and GitHub Actions setup.

---

## 📸 Visual Assets & UI Verification Policy (Mandatory)

> [!IMPORTANT]
> **All future UI/UX modifications require updating the canonical documentation screenshots.**
> Whenever components, styling, or layouts are changed, you must regenerate the visual assets before opening or updating a Pull Request.

### Canonical Visual Assets:
1. `docs/screenshots/dark_mode_commute_map.png` — Main application canvas in dark mode showing map, 252 property listings, and Kai's Concierge Capsule with proactive greeting bubble.
2. `docs/screenshots/kai_ai_concierge_chat.png` — Active chat drawer showing Kai's multi-agent streaming responses, local advice, and property links.
3. `docs/screenshots/shortlist_compare_modal.png` — Shortlist comparison modal showing side-by-side properties and the "Ask Kai to Compare" action bar.

### Automated Screenshot Capture:
With both frontend (`npm run dev`) and backend (`uvicorn main:app`) running, execute:

```bash
./scripts/update_screenshots.sh
```

This automated Playwright script sets up dark mode, loads sample shortlists, interacts with Kai, and updates all three canonical screenshot assets in `docs/screenshots/`.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/hubs` | Retrieve all Sydney destination CBD hubs |
| `GET` | `/api/properties` | Search properties with filters: `keyword`, `property_type`, `max_rent`, `min_bedrooms`, `circle`, `polygon` |
| `GET` | `/api/properties/{id}` | Retrieve individual property listing details |
| `GET` | `/api/properties/saved` | Fetch saved/shortlisted properties for authenticated user |
| `POST` | `/api/properties/saved/{id}` | Toggle saved property |
| `GET` | `/api/commute` | Lookup transit duration and route between `origin_suburb` and `destination_cbd_hub` |
| `POST` | `/api/chat/deep` | Streaming Server-Sent Events (SSE) endpoint for LangChain Deep Multi-Agent chat |
| `GET` | `/api/chat/sessions` | Fetch conversation history for authenticated user |
| `DELETE` | `/api/chat/sessions/{id}` | Delete a chat session |

---

## 🧪 Testing

Run backend automated test suite:

```bash
cd backend
pytest
```

Run frontend linting & production build:

```bash
cd frontend
npm run lint
npm run build
```

---

## 📄 License
MIT License. Created for professionals relocating to Sydney, Australia.
