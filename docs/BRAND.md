# Route — Branding & Visual Identity

**Version:** 0.2 (locked for redesign)  
**Date:** 2026-11-13  
**Status:** Draft — pending Decision for redesign  
**Domain (planned):** useroute.dev (not yet purchased)

## Product

- **Name:** Route  
- **Domain (planned, not purchased):** useroute.dev  
- **Tagline:** Honest model routing observability  
- **One-line:** A real-time, local-first switchboard for OpenCode routing that shows what actually happened (suggestions, context, routes, usage, errors) without inventing execution or attribution the logs cannot prove.

## Aesthetic North Star

Linear + Cursor + SpaceX control-room clarity.  
Dark-first, precise, dense when needed, zero decoration.  
Information hierarchy comes from luminance steps and a single accent, not from shadows, gradients, or illustration.

## Logo

- Icon: geometric routing node — white central circle with three thin cyan lines ending in small cyan dots (Y-shaped).  
- Wordmark: **ROUTE** or **Route** in bold geometric sans, tight tracking, white, with the node icon.  
- The icon must work alone (favicon, app icon, 16–32 px).  
- No underline, no extra strokes, no glow by default.

## Color Palette

| Token              | Hex       | Usage                                      |
|--------------------|-----------|--------------------------------------------|
| bg                 | `#0A0A0B` | Main background                            |
| surface            | `#141416` | Panels, cards, sidebars                    |
| surface-elevated   | `#1C1C1F` | Hover, modals, raised elements             |
| border             | `#27272A` | Hairline dividers, subtle edges            |
| text               | `#F4F4F5` | Primary text, titles                       |
| text-secondary     | `#A1A1AA` | Secondary text, metadata                   |
| text-muted         | `#71717A` | Placeholders, disabled                     |
| accent             | `#22D3EE` | Links, focus, logo, nodes, CTAs            |
| accent-hover       | `#06B6D4` | Hover on accent elements                   |
| success            | `#34D399` | Positive states (used sparingly)           |
| error              | `#F87171` | Errors, failures                           |

Rules:
- Accent is used once or twice per view maximum (focus, primary action, logo).
- Everything else is near-black / gray / white.
- Borders are hairlines; depth comes from surface steps, not drop shadows.

## Typography

- Display / wordmark / large titles: geometric sans with tight tracking (Space Grotesk, Geist, or similar).
- UI body: Inter or Geist (clean, high x-height).
- Mono / data / codes: Geist Mono or JetBrains Mono.
- Weights: 400 regular, 500/600 medium for emphasis, 700 only for the wordmark or very large titles.
- Negative letter-spacing on large display sizes.

## Principles

1. Honesty over decoration. Never invent visual language that implies data the system does not have.
2. Density is fine; noise is not. Prefer clear hierarchy and keyboard-first patterns.
3. Local-first feel: the UI should feel like a precise instrument, not a SaaS marketing site.
4. Motion is minimal and purposeful (state changes, focus, live updates). No gratuitous animation.
5. Accessibility: high contrast on text, focus rings visible, reduced-motion respected.

## What the App Should Feel Like

A live switchboard.  
Left or top: source selector (local / PC / Orca) with clear connection state.  
Center: the routing flow — suggestions, recorded context, chosen route — as a clean timeline or lane view, not a graph that invents edges.  
Right or bottom drawer: detail of the selected event (raw record + why this suggestion).  
Secondary views (Usage, Errors, History, Agreement) as focused panels that open without leaving the main context.  
Empty and partial states are first-class and labeled (DEMO, missing source, truncated window).  
Everything is scannable at a glance and inspectable on demand.

## Do Not

- Use pure black `#000000`.
- Add gradients, heavy shadows, or illustration.
- Use the accent for large background areas.
- Invent metrics, success rates, or execution paths visually.
- Make the logo “fun” or rounded beyond the geometric node.

---

This document is the visual contract for the redesign. Implementation follows the existing product evidence rules in the repo (no invented execution, Decision=Approved gate, etc.).
