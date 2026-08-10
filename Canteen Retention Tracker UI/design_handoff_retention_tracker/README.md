# Handoff: Canteen Retention Tracker UI

Target repo: `sablebc/canteen-retention-tracker-tool` (monorepo — `/frontend` React 19 + Vite + Tailwind v4, `/backend` Django + DRF).

## Overview
A branded, Smartsheet-density productivity UI for the Canteen Canada retention tracker. Four surfaces: a header bar with tab switcher, three views (Grid, My Calls, Map), and a slide-out site detail panel with a call-logging form.

## About the design files
`Canteen Retention Tracker.dc.html` in this bundle is a **design reference built in HTML** — a working prototype of look, density, and behavior, not production code to copy. Recreate it in `/frontend` using that app's existing patterns: React 19 function components, Tailwind v4 utility classes, `src/api/client.js` for data, `maplibre-gl` for the map, AG Grid for the spreadsheet view. The prototype's data is generated fixtures; real data comes from the DRF endpoints.

Field names in the prototype match `backend/retention/models.py` (`Site`, `RevenueSnapshot`, `RepAssignment`, `CallRecord`, `StatusHistory`) and `serializers.py`, so mapping is 1:1.

## Fidelity
**High fidelity.** Colors, type sizes, row heights, borders, and spacing are final — match them. Layout structure and interactions are final. Copy strings are final where quoted below.

---

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| Primary dark teal | `#1B3A4B` | Header bar, table header rows, panel header, panel section headers |
| Teal hairline | `#2F5568` | Column dividers inside dark header rows |
| Teal deep | `#12303E` | Text on green fills; 1px border under the app header |
| Accent green | `#7AC143` | Active tab underline, progress fill, primary buttons, active badges, selected rating, editable-cell hover outline |
| Green hover/border | `#6BB033` | Primary button hover + border |
| White | `#FFFFFF` | Content backgrounds, odd table rows, text on dark |
| Light grey | `#F8F9FA` | Even table rows, toolbars, read-only field block, imported history rows |
| Body text | `#1E293B` | All body copy |
| Muted text | `#5A6B76` | Labels, secondary metadata |
| Muted text on teal | `#B7C8D1` (inactive tab), `#C6D3DA` / `#A9BEC9` (header + panel metadata) | |
| Border | `#C9D1D7` | Inputs, panels, floating cards |
| Border light | `#E1E5E8` | Cell dividers, section rules |
| Row divider | `#EAEDEF` | Bottom border on body rows |
| Warning text | `#8A5A16` | `[Pending]`, unsaved-changes note |
| Success text | `#3E7A15` | `[Called]` |
| Disabled text | `#8A97A0` / `#9AA7AF` | Imported call history, inactive Save button |
| Marker orange | `#E8833A` | My uncalled sites |
| Marker blue | `#3B82F6` | Other reps |
| Marker grey | `#94A3B8` | Unassigned |

Type: `'Helvetica Neue', Helvetica, Arial, sans-serif`. Base 12px body, 11px labels/metadata, 10px uppercase eyebrows (`letter-spacing: .06em`), 13–14px titles. Numeric columns use `font-variant-numeric: tabular-nums`.

Radii: **0 everywhere** except map markers and legend dots (circles). Shadows: only `0 1px 2px rgba(16,36,48,.14)` on floating map cards and `-2px 0 6px rgba(16,36,48,.16)` on the detail panel. No other shadows.

Spacing: 6–8px inside cells, 10–14px inside panels, 6px between form rows.

---

## Header bar
- 48px tall, `#1B3A4B`, white text, `padding-left: 16px`, 1px `#12303E` bottom border.
- 18×18 solid `#7AC143` square as logo mark, 10px gap, then "Canteen Retention Tracker" — 14px/600, `letter-spacing: .02em`. 28px right padding before the tabs.
- Tab switcher, in this order: **Map / Grid / My Calls**. Full-height buttons, `padding: 0 18px`, 12px. Active: white text, 700, `border-bottom: 3px solid #7AC143`. Inactive: `#B7C8D1`, 500, transparent 3px bottom border.
- Right side: "FY26 Retention Cycle" (11px `#C6D3DA`), a 1×18 `#2F5568` divider, then a 22×22 green `SB` avatar square (10px/700, `#12303E`) and "S. Brooks".

---

## View 1 — Grid (AG Grid)
Full-height flex column; only the grid body scrolls.

**Toolbar** (34px, `#F8F9FA`, 1px `#D9DEE3` bottom border, 10px side padding): "ALL SITES" (11px/600 uppercase `.06em` `#5A6B76`), a `|` divider `#D9DEE3`, then "220 rows · 20 columns · 3 pinned". Right-aligned: 180×22 search input placeholder "Search sites", a 22px "Filters" button (white, `#C9D1D7` border), and a 22px "Export" button (`#1B3A4B` fill, white text).

**Header row**: 30px, `#1B3A4B`, white 11px/600, `position: sticky; top: 0`. Column dividers `1px solid #2F5568`. Every header has a right-aligned 8×8 funnel filter icon filled `#9FB4BF`. The third pinned column's right edge is `2px solid #7AC143`; the body's matching edge is `2px solid #D9DEE3` — this is the pinned/scrolling seam.

**Pinned columns** (`position: sticky` left, offsets 0 / 44 / 104): `RS` 44px (600, `#1B3A4B`), `#` 60px (`#5A6B76`, tabular), `Site Name` 210px (500, ellipsis). Sticky cells must repeat the row's background color or content shows through.

**Remaining 17 columns** (px widths): Address 200, City 110, Prov. 62, Branch 118, LOB 118*, Account Status 118, Contact Name 140*, Phone 122*, Method of Ordering 146*, Last Order 100, F25 Revenue 112 (right), Annual Revenue 122 (right), Rev. Risk 80 (right), Calls 58 (right), Last Call 100, Rating 62 (right), Actions Required 170. `*` = inline-editable.

**Rows**: 26px compact (32px in the "comfortable" density option), alternating `#FFFFFF` / `#F8F9FA`, `1px solid #EAEDEF` bottom border, `1px solid #E1E5E8` cell dividers, no wrapping (ellipsis). Whole row is clickable → opens the detail panel.

**Editable cells**: no chrome at rest; on hover, `background: #FFFFFF` plus `outline: 1px solid #7AC143; outline-offset: -1px`. In AG Grid, use `cellClass` + a hover rule; keep `singleClickEdit` off so row-click still opens the panel (or use a dedicated affordance).

**Status bar** (24px, `#F8F9FA`, top border `#D9DEE3`, 11px `#5A6B76`): "220 sites", "101 assigned to SB", right-aligned "Last sync 08 Aug 2026, 06:12".

---

## View 2 — My Calls
Filtered to the 101 sites assigned to the signed-in rep.

**Progress header** (white, 12px 14px, bottom border `#D9DEE3`): "My Calls" (13px/600 `#1B3A4B`) beside "X / 101 calls completed" (11px `#5A6B76`, tabular). Below it a **progress bar**: 10px tall, `max-width: 620px`, track `#F8F9FA` with `1px solid #E1E5E8`, fill `#7AC143` at `completed/101`. Below that, one 11px `#5A6B76` breakdown line, `line-height: 1.6`:
`Branch: Vancouver 28 · Calgary 22 · Toronto 19 · Montreal 17 · Halifax 15 | Status: Active 74 · At Risk 18 · Dormant 9` (compute from real data).

**Filter bar** (36px, `#F8F9FA`, bottom border `#D9DEE3`, 14px side padding, 14px gaps): "BRANCH" label (11px/600 uppercase) + 24px select (`All branches`, then branches); "ACCOUNT STATUS" + 24px select (`All statuses / Active / At Risk / Dormant`); a checkbox (13px, `accent-color: #7AC143`) labelled "Show already called" — **unchecked by default**, so only pending calls show. Right-aligned count "N of 101 shown".

**Table**: same 30px teal sticky header and 26px alternating rows. Columns: `#` 60, Site Name (flex, min 240), Branch 130, Account Status 110, Contact 150, Phone 120, Annual Rev. 110 (right), Status 90, Last Call 100. Min table width 980px.
Status column is **plain text, not a pill**: `[Pending]` in `#8A5A16`, `[Called]` in `#3E7A15`. Row click opens the panel.

---

## View 3 — Map
Full-bleed MapLibre GL, `style: https://tiles.openfreemap.org/styles/liberty`, `center: [-96, 52]`, `zoom: 3`, `maxPitch: 80`, globe projection via `setProjection({ type: 'globe' })` on `style.load`, `NavigationControl` top-right, attribution control off.

**Markers**: 11px circles, `border: 1.5px solid #fff`, `box-shadow: 0 0 0 1px rgba(16,36,48,.35)`, pointer cursor. Colors: my uncalled `#E8833A`, my called `#7AC143`, other reps `#3B82F6`, unassigned `#94A3B8`. Click → open the detail panel directly (no intermediate popup); `stopPropagation` on the marker click. In the prototype markers are drawn on `style.load` and `once('idle')` because `map.on('load')` did not fire in the preview sandbox — keep a similar belt-and-braces trigger, and re-draw markers when filters change.

**Rep filter** (top-left, 10px inset, white card, `1px solid #C9D1D7`, small shadow): teal 10px uppercase "REP" strip, then a 176px select — `All reps / SB — S. Brooks (me) / JD — … / MK — … / RT — … / Unassigned` — and an 11px `#5A6B76` line "N of 220 sites plotted".

**Legend** (bottom-left, 14px inset, 210px wide, same card treatment): teal "LEGEND" strip, then one 6×8px row per category separated by `1px solid #EAEDEF`: 10px colored dot, label, right-aligned count, checkbox (`accent-color: #7AC143`). Whole row toggles. A disabled category dims to `opacity: .45` and its markers are removed. Row hover `#F8F9FA`.
Labels: "My sites — to call", "My sites — called", "Other reps", "Unassigned".

**Hint chip** bottom-right: `rgba(255,255,255,.94)`, `1px solid #C9D1D7`, 10px `#5A6B76`, "Click a marker to open the site detail panel".

---

## Detail panel (slide-out, right)
Overlay `rgba(16,36,48,.18)` covering the viewport; clicking it closes. Panel: 460px wide (`max-width: 92vw`), full height, white, `border-left: 1px solid #C9D1D7`, `box-shadow: -2px 0 6px rgba(16,36,48,.16)`. Body scrolls; header is fixed. Slide in from the right (~160ms ease-out is appropriate; the prototype has no transition).

**Header**: `#1B3A4B`, 10px 12px. Site name 14px/600 white. Below it 11px `#A9BEC9`: `#{site_id} · {rep or "Unassigned"} · {lob}`. Right-aligned 22×22 close button: transparent fill, `1px solid #3C6478`, white `×`.

**Read-only block**: `#F8F9FA`, bottom border `#D9DEE3`, 10px 12px, 2-column grid, `gap: 9px 14px`. Fields: Address (`address, city, province`), Branch, Account Status, Annual Revenue (`$X,XXX / yr`, tabular). Each has a 10px uppercase `#5A6B76` label and 12px value. Account Status renders as a green badge: `#7AC143` fill, `#12303E` text, 10px/700 uppercase `.05em`, `padding: 2px 6px`, square corners.

**Editable fields** ("SITE DETAILS" eyebrow + hairline rule + right-aligned status text: "All changes saved" `#5A6B76`, or "N unsaved changes" `#8A5A16`). Four rows: **Contact Name, Method of Ordering, LOB, Phone**. Each row: 132px 11px `#5A6B76` label, a 26px input (`1px solid #C9D1D7`, focus `border-color: #7AC143` + `outline: 1px solid #7AC143`), and a **Save** button per field — inert (`#F8F9FA` fill, `#D9DEE3` border, `#9AA7AF` text) until that field is dirty, then green (`#7AC143` fill, `#6BB033` border, `#12303E` 700 text). Save PATCHes just that field.

**Call logging form** — expanded by default. "LOG A CALL" eyebrow with today's date right-aligned (10px `#5A6B76`). Fields in order, 11px labels above each control, all inputs `1px solid #C9D1D7` with the green focus treatment:
1. "Q1 · How was the last order handled?" — 2-row textarea → `q1_last_order_feedback`
2. "Q2 · What is working well?" — 2-row textarea → `q2_working_well`
3. Row: **Rating** — five 28×26 buttons `1 2 3 4 5`, selected = green fill + `#6BB033` border + 700 text → `rating`; and **Duration (min)** — 88px number input → `duration_minutes`
4. "Q4 · What could be improved?" — 2-row textarea → `q4_could_improve`
5. **Notes** — 3-row textarea → `notes`
6. Two-column grid: **Actions Required** and **Data Corrections** — 2-row textareas → `actions_required`, `data_corrections`
7. Reminder callout above the buttons: `#F8F9FA` fill, `1px solid #E1E5E8`, `border-left: 3px solid #7AC143`, 7px 9px, 11px — exact copy: "Is there anything else you'd like to mention?"
8. Buttons row: **Submit Call** (30px, `#7AC143` fill, `#6BB033` border, `#12303E` 12px/700, `padding: 0 16px`, hover `#6BB033`), **Save Draft** (white, `#C9D1D7` border), right-aligned 10px "Logged as SB".

**Call history**: "CALL HISTORY" eyebrow with right-aligned "N logged · M imported". One card per record: `1px solid #E1E5E8`, `border-left: 3px solid #7AC143` (logged in app) or `#C9D1D7` (imported), 7px 9px, 6px gap. Top line: date (11px/600 tabular), rep initials, duration, "Rating n/5", right-aligned source ("Logged in app" / "Imported record"). Notes on a second line, 11px, `line-height: 1.5`. **Imported records are greyed out**: background `#F8F9FA`, text `#8A97A0`.

---

## Interactions & state
- `view`: `'map' | 'grid' | 'calls'` — tab switcher; green underline follows it.
- `selectedSiteId`: opens/closes the detail panel. Set by grid row click, My Calls row click, and marker click. Cleared by the close button and overlay click. Panel content clicks must not bubble to the overlay.
- My Calls filters: `branch`, `accountStatus`, `showCalled` (default false). Applied client-side over the rep's 101 sites; the visible-count label updates live.
- Map: `repFilter` and a `legend` record of four booleans. Both filter the marker set; markers are torn down and redrawn on change; the "N of 220 plotted" label updates.
- Inline edits: per-site, per-field dirty map. Editing marks the field dirty (activating its Save button and the "N unsaved changes" note); Save commits that one field and clears its dirty flag.
- Call form: local state per field plus `rating`; Submit POSTs a `CallRecord` and prepends it to the history list; Save Draft persists locally.
- Grid density is a two-option toggle: compact (26px rows) / comfortable (32px).

## Data mapping
`Site` → grid columns and panel read-only + editable fields (`contact_name`, `method_of_ordering`, `lob`, `phone_number` are the four editable ones). `RevenueSnapshot.f25_revenue` / `annual_revenue` → the two revenue columns and the panel's Annual Revenue. `RepAssignment.rep_initials` → `RS` column, "my sites" filtering, and marker categories. `CallRecord` → My Calls status, Rating, Last Call, Actions Required, call history, and the logging form. `Site.latitude` / `longitude` → markers (skip sites without coordinates, as `SiteMap.jsx` already does). Revenue risk comes from `/analysis/revenue-risk-score/`.

Keep the three views' counts consistent — exactly 101 sites assigned to the current rep, and the map legend must categorize only those as "mine".

## Assets
None. The logo mark is a solid green square placeholder — swap in the real Canteen Canada mark. Icons: one 8×8 inline SVG funnel for column filters. No icon library needed.

## Files
- `Canteen Retention Tracker.dc.html` — the design prototype (all three views + detail panel, single file, opens in a browser).
- `github.md` — repo association and the screen → source-file map.
