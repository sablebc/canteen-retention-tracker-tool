repo: sablebc/canteen-retention-tracker-tool
branch: main
path: frontend/src, backend/retention

## Last sync
date: 2026-08-10T21:32:12Z

### Updated in this project
- Built branded UI for all three views (Grid, My Calls, Map) plus the slide-out detail panel.
- Field names and types taken from the Django `retention` models and DRF serializers.
- Map mirrors the repo's MapLibre globe setup (OpenFreeMap "liberty" style, globe projection, marker click opens detail).

## Screen map
| Screen | Built from |
| --- | --- |
| Header + tabs | frontend/src/App.jsx |
| Grid view (20 cols, 3 pinned) | backend/retention/models.py (Site, RevenueSnapshot, RepAssignment) |
| My Calls view | backend/retention/models.py (CallRecord), frontend/src/api/client.js |
| Map view | frontend/src/components/Map/SiteMap.jsx |
| Detail panel | backend/retention/models.py (Site, CallRecord), backend/retention/serializers.py |
