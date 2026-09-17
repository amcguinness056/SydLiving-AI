---
name: SydLiving AI
description: Australian coastal glassmorphic design system for AI property search and commute intelligence.
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  primary-light: "#e0e7ff"
  accent-coastal: "#60a5fa"
  neutral-bg: "#f8fafc"
  neutral-surface: "#ffffff"
  neutral-glass: "rgba(255, 255, 255, 0.4)"
  neutral-border: "rgba(255, 255, 255, 0.5)"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.5rem)"
    fontWeight: 700
    lineHeight: "1.25"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
rounded:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card-property:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: SydLiving AI

## Overview

**Creative North Star: "The Coastal Glass Sanctuary"**

SydLiving AI captures the essence of Sydney's coastal radiance and natural Australian light through ultra-refined glassmorphism, fluid spatial mapping, and organic depth. The system combines frosted translucent surfaces with crisp indigo accents and oceanic highlights, evoking the clarity of Sydney Harbor and coastal sunbeams filtering through glass.

Designed for effortless relocation research, the visual environment balances high-density information (commute matrices, property filters, spatial maps) with a calm, tactile atmosphere. Floating panels, ambient backdrop blurs, and organic rounded contours give every interaction a modern, premium feel.

**Key Characteristics:**
- Australian coastal radiance with layered glassmorphism (`backdrop-blur-xl` and `backdrop-blur-3xl`).
- Vibrant Sydney Pacific indigo accents balanced by crisp slate neutrals and sea-foam blue highlights.
- Spatial-first split-screen canvas with resizable panel boundaries and floating AI chat widgets.
- Tactile, rounded surface geometry (`2rem` master container radii, `1.5rem` cards).

## Colors

The palette grounds high-tech AI search in Sydney's natural coastal environment, using vibrant oceanic indigo as the primary action tone and semi-transparent frosted white for tactile surface glass.

### Primary
- **Sydney Pacific Indigo** (`#4f46e5` / `rgb(79, 70, 229)`): Used for primary call-to-action buttons, active map selection highlights, active badge pills, and AI sparkles.

### Secondary
- **Bondi Coastal Blue** (`#60a5fa` / `rgb(96, 165, 250)`): Used for lifestyle metrics (beach proximity indicators, transport route tags) and secondary accents.

### Neutral
- **Harbor Mist Glass** (`rgba(255, 255, 255, 0.4)` / `backdrop-filter: blur(24px)`): Primary panel and container background, providing glassmorphic depth.
- **Frosted Surface White** (`#ffffff`): Card containers, floating dialogs, and popovers.
- **Deep Slate Text** (`#0f172a`): High-contrast primary headings and property titles.
- **Muted Coastal Slate** (`#64748b`): Subtitles, address text, meta information, and secondary labels.
- **Sunlit Border White** (`rgba(255, 255, 255, 0.5)`): Semi-transparent borders defining glass panels and card contours.

### Named Rules
**The 10% Indigo Rule.** Primary indigo is reserved strictly for key interactive triggers, active selected states, and AI sparkles. Its rarity maintains focus across complex map views.
**The Frosted Layering Rule.** Never layer solid white containers directly on solid backgrounds; always use backdrop-blur glass filters (`backdrop-blur-xl` or `2xl`) to maintain spatial depth.

## Typography

**Display Font:** Inter (system-ui, -apple-system, sans-serif)  
**Body Font:** Inter (system-ui, -apple-system, sans-serif)  
**Character:** Crisp, legible modern sans-serif with high legibility across dense data tables, map tooltips, and chat bubbles.

### Hierarchy
- **Display** (Bold 700, `clamp(1.25rem, 2vw, 1.5rem)`, `1.25` line-height): Application brand title and hero headers with gradient clip text.
- **Headline** (Semi-bold 600 / Bold 700, `1.125rem` / `18px`, `1.3` line-height): Section titles, property names in detail panel.
- **Title** (Semi-bold 600, `0.9375rem` / `15px`, `1.4` line-height): Property card titles and chat headers.
- **Body** (Regular 400, `0.875rem` / `14px`, `1.5` line-height): Main chat prose, description copy, filter labels (65-75ch optimal width).
- **Label** (Medium 500 / Bold 700, `0.75rem` / `12px`, uppercase or pill format): Badge pills, rent tags, amenity distance indicators.

### Named Rules
**The Gradient Title Rule.** Brand headers and key milestone titles use gradient text fills (`bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500`).

## Layout

The spatial framework relies on a responsive, 3-panel split-screen canvas with dynamic resizable dividers (`react-resizable-panels`). 

- **Left Panel (Property List):** Fixed default width ~25%, scrollable list of property cards with glass header.
- **Center Panel (Interactive Map):** Flexible middle canvas housing the React-Leaflet map view.
- **Right Panel (Property Details):** Slide-in drawer ~22% default width when a listing is selected.
- **Floating AI Chat Widget:** Fixed bottom-right overlay positioned dynamically relative to active panel widths.
- **Master Outer Frame:** Outer padding `1rem` (`p-4`), master container radius `2rem` (`rounded-[2rem]`), drop shadow `shadow-2xl`.

## Elevation & Depth

SydLiving AI uses a hybrid depth strategy: soft glassmorphism combined with layered drop shadows (`shadow-xl` to `shadow-2xl`) and translucent white borders (`border border-white/40`). 

### Shadow Vocabulary
- **Panel Elevation** (`shadow-2xl`, `0 25px 50px -12px rgba(0, 0, 0, 0.25)`): Outer main app container and active floating chat window.
- **Floating Action Glow** (`shadow-xl shadow-indigo-200`, `0 20px 25px -5px rgba(79, 70, 229, 0.2)`): Floating AI chat trigger button.
- **Card Hover Elevation** (`shadow-md`, `0 4px 6px -1px rgba(0, 0, 0, 0.1)`): Interactive property cards on hover.

### Named Rules
**The Glass Border Rule.** Every translucent panel must carry a hairline white border (`border border-white/40` or `border-white/60`) to delineate glass boundaries against map textures.

## Shapes

The form language is defined by generous, friendly organic curves and rounded pill geometries.

- **Master Application Container:** `2rem` (`rounded-[2rem]`) radius.
- **Cards and Dialogs:** `1.5rem` (`rounded-3xl` / `rounded-2xl`) radius.
- **Buttons & Inputs:** `0.75rem` (`rounded-xl`) to `1rem` (`rounded-2xl`) radius.
- **Badges & Action Triggers:** Fully rounded pills (`rounded-full`).

## Components

### Primary Button
- **Shape:** Rounded pill or `12px` rounded rectangle (`rounded-xl` / `rounded-full`).
- **Primary:** `background: #4f46e5; color: #ffffff; padding: 10px 24px; font-weight: 600;`
- **Hover / Focus:** `background: #4338ca; shadow: shadow-md shadow-indigo-200; transform: translateY(-1px);`

### Property Card
- **Shape:** `1rem` radius (`rounded-2xl`), `16px` padding (`p-4`).
- **Background:** `background: #ffffff; border: 1px solid #f1f5f9;`
- **Selected State:** `ring-2 ring-indigo-500 bg-indigo-50/50;`
- **Internal Elements:** Price tag pill (`bg-indigo-600 text-white rounded-full px-2.5 py-1 text-xs font-bold`), amenity icons with subtle colored tint (`text-indigo-400` / `text-blue-400`).

### Floating Chat Panel
- **Shape:** `1.5rem` (`rounded-3xl`) container, `backdrop-blur-3xl bg-white/60`.
- **User Bubble:** `bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm`.
- **AI Bubble:** `bg-white/80 border border-white/40 text-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-md`.

### Interactive Leaflet Map
- **Shape:** Map container enclosed in `1.5rem` (`rounded-3xl`) glass wrapper.
- **Custom Overlays:** Glass property popups with direct detail panel triggers.

### Real-Time Data Indicators (Phase 1)
- **Live Transit Status Pill:** `rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1`. Features a pulsing green indicator (`w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse`).
- **Domain Listing Verification Badge:** `rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1`. Indicates authentic Domain Developer API listing data.
- **Departure Monitor Card:** Frosted translucent glass card (`backdrop-blur-md bg-white/70 border border-white/60 rounded-xl p-2.5`) displaying upcoming real-time transit departure countdowns.

### Multi-Option Trade-Off Cards (Phase 2)
- **Container:** `bg-white/90 hover:bg-white border border-white/80 rounded-xl p-3 shadow-xs hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer`.
- **Cheapest Pill:** `bg-emerald-500/10 border-emerald-500/30 text-emerald-700` with tag icon. Emphasizes maximum weekly rent savings.
- **Fastest Commute Pill:** `bg-blue-500/10 border-blue-500/30 text-blue-700` with lightning zap icon. Emphasizes lowest door-to-door minutes to workplace.
- **Best Overall Pill:** `bg-amber-500/10 border-amber-500/30 text-amber-700` with award icon. Highlights composite balance of vibe score, transit, and price.
- **Session Hub Badge:** Pill indicator in chat header (`bg-white/80 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-semibold`) displaying active workplace destination without re-prompting.

### Lease & Inspection Auditor Modal (Phase 3)
- **Modal Wrapper:** Floating centered card `max-w-2xl w-full max-h-[90vh] bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/60`.
- **Drag-and-Drop Uploader:** `border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 bg-indigo-50/20` with rounded circular icon badge.
- **Risk Score Banners:**
  - High Risk: `bg-rose-500/10 text-rose-700 border-rose-500/30` with `ShieldAlert` icon.
  - Moderate Risk: `bg-amber-500/10 text-amber-700 border-amber-500/30` with `AlertTriangle` icon.
  - Low Risk: `bg-emerald-500/10 text-emerald-700 border-emerald-500/30` with `ShieldCheck` icon.
- **Red Flag Cards:** Distinct white container with hairline border, severity dot, verbatim clause block in monospace font, and legislative citation pills.

## Do's and Don'ts

### Do:
- **Do** wrap primary layout panels in translucent glass layers with `backdrop-blur-xl` and `border border-white/40`.
- **Do** preserve 2rem master container radii across desktop layout viewports.
- **Do** use Bondi Coastal Blue (`#60a5fa`) for ocean/beach distance and transit highlights.
- **Do** maintain smooth transition states (`transition-all duration-300`) on panel resizes and maximize overlays.

### Don't:
- **Don't** use opaque solid gray or black backgrounds for floating panels or chat overlays.
- **Don't** use sharp, 0px-radius box corners; all interactive containers must be rounded.
- **Don't** saturate screens with more than 10% primary indigo; maintain clean white and glass negative space.
- **Don't** introduce hard black borders or heavy solid shadows that break the coastal glass illusion.
