# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Young professionals, expats, and students relocating to Sydney, Australia who need to find suitable sharehouses or rental properties while accounting for real door-to-door transit commute times to Sydney CBD hubs and key employment centers.

## Product Purpose
SydLiving AI makes finding a home in Sydney intuitive and stress-free by providing natural language property discovery paired with precise door-to-door commute calculations. Success means helping users discover housing options that match their budget, lifestyle, and workplace commute without manually cross-referencing transit apps and listing portals.

## Positioning
An AI-augmented Sydney relocation and housing search platform that seamlessly unifies natural language property filtering with Transport for NSW (TfNSW) door-to-door transit commute matrices and interactive spatial mapping in a single split-screen workspace.

## Operating Context
Relocation planning, rental house hunting, and commute evaluation. Used on desktop and mobile web browsers by people evaluating potential Sydney suburbs and rental properties prior to or during a move.

## Capabilities and Constraints
- Natural language query processing via Gemini Pro API native tool calling.
- Property search filtering by suburb, maximum rent, and minimum bedroom count.
- Door-to-door commute calculations from origin suburbs to Sydney CBD transit hubs using TfNSW transit matrix data.
- Interactive split-screen UI layout featuring a glassmorphic chat interface, React-Leaflet map view, and property listing cards.
- Local-first prototype using FastAPI backend with SQLite database (`sydliving.db`) and React 19 + Vite + Tailwind CSS frontend.

## Brand Commitments
- Name: SydLiving AI
- Voice: Intelligent, reassuring, precise, and modern.
- Visual Identity: Premium glassmorphic UI, crisp typography, and fluid spatial mapping.

## Evidence on Hand
- Existing full-stack codebase (`backend/` with FastAPI & SQLite schema, `frontend/` with React 19 + Vite + Tailwind CSS).
- Seeded database (`sydliving.db`) containing Sydney suburbs, mock property listings, and commute matrices.

## Product Principles
1. **Commute-Aware Discovery**: Always ground property listings in real door-to-door commute reality.
2. **Conversational & Map Synergy**: Spatial map overlays and chat responses must remain dynamically synchronized.
3. **Frictionless Relocation**: Demystify Sydney geography and transit routes for newcomers.
4. **Instant Visual Clarity**: Present complex listing filters and route data with clean, high-craft visual hierarchy.
