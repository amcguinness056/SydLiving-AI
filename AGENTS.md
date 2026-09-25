# Developer & Agent Guidelines: SydLiving AI

This document establishes development standards, architectural rules, and mandatory policies for all developers and AI coding agents working on the SydLiving AI codebase.

---

## 📸 Visual Assets & Screenshot Policy (PR Preparation Only)

> [!IMPORTANT]
> **Canonical documentation screenshots must ONLY be generated when preparing, opening, or updating a Pull Request (PR), or when explicitly requested by the user.**
>
> **DO NOT** execute `./scripts/update_screenshots.sh` on routine coding turns, incremental refactors, or general task completions. Screenshot generation launches browser automation and should strictly be reserved for final PR submission when UI/UX modifications are ready to merge.

### Canonical Screenshots:
1. `docs/screenshots/dark_mode_commute_map.png` — Main application canvas in dark mode (map, listings, and Kai Concierge Capsule with greeting bubble).
2. `docs/screenshots/kai_ai_concierge_chat.png` — Active chat drawer showing Kai's multi-agent responses, streaming steps, and property links.
3. `docs/screenshots/shortlist_compare_modal.png` — Shortlist comparison modal showing side-by-side properties and the "Ask Kai to Compare" section.

### Automated Update Command (Run ONLY on PR Creation/Update):
Ensure the backend (`uvicorn main:app`) and frontend (`npm run dev`) are running, then execute:

```bash
./scripts/update_screenshots.sh
```

This script uses the Playwright CLI to set up dark mode, load sample shortlists, trigger Kai inquiries, and capture all 3 canonical screenshots directly into `docs/screenshots/`.

---

## 🎨 UI/UX & Design System Rules (Impeccable)

- **Color Palette**: Sydney **Bondi Blue** (`blue-600` / `#2563eb`, `blue-500` / `#3b82f6`) is the primary interactive brand color. Never introduce ungrounded indigo/purple AI gradient slop.
- **Contrast Floor**: Body text and interactive labels must satisfy WCAG AAA standards (`text-slate-900` on light, `text-white` or `text-slate-100`/`text-slate-200` on dark). Avoid gray-on-color contrast warnings (`text-slate-700` on `bg-blue-600` is banned).
- **Tailwind v4 Conventions**: Use standard Tailwind CSS classes. Do not invent non-existent utility classes (e.g. `bg-slate-850`).
- **Audit Verification**: Always audit modified UI files with the Impeccable mechanical detector:
  ```bash
  ./.agent/skills/impeccable/scripts/impeccable detect --json <modified_files>
  ```
  Zero warnings are required before committing.

---

## 🤖 Kai AI Concierge & Multi-Agent Guidelines

- **Persona**: Kai is an upbeat, savvy, candid Sydney insider. Avoid dry, clinical academic report headers (e.g. `1. The Vibe & Crowd`). Use first-person storytelling (`"G'day! Here's my honest take..."`), share **"💡 Kai's Insider Tip"**, and provide a punchy **"🎯 My Verdict"**.
- **Model Standard**: The default model is `gemini-3.8-flash` via `GEMINI_MODEL`.
- **Property Linking Rule**: Whenever Kai lists, compares, or mentions rental properties, ALWAYS format the title as a clickable link using its exact ID:
  `[Property Title](property:<id>)`
  This enables direct in-app selection chips that highlight the listing on the map.

---

## 🧪 Verification Commands

### Routine Verification (Run during development):
```bash
# 1. Frontend Build & Lint
npm --prefix frontend run build
npm --prefix frontend run lint

# 2. Backend Unit & Deep Agent Tests
backend/.venv/bin/pytest backend/tests -v
```

### Pull Request Finalization (Run ONLY when preparing or updating a PR that touches UI):
```bash
# Refresh canonical documentation screenshots
./scripts/update_screenshots.sh
```
