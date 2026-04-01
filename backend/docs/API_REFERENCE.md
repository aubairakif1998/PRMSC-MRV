# PRMSC MRV — HTTP API reference

This document matches the Flask app in `app/__init__.py` and route modules under `app/routes/`. Every endpoint below includes a **curl** example.

## Conventions

```bash
# Replace with your API origin (no trailing slash)
export BASE=http://127.0.0.1:5000

# After login, set from JSON:  export TOKEN='<paste token>'
export TOKEN=
```

JSON requests use `-H "Content-Type: application/json"`. Authenticated requests use `-H "Authorization: Bearer $TOKEN"`.

Replace placeholders: `WATER_SYSTEM_ID`, `SOLAR_SYSTEM_ID`, `WATER_RECORD_ID`, `SOLAR_RECORD_ID`, `SUBMISSION_ID`, `NOTIFICATION_ID`, and sample `tehsil` / `village` values with real data from your environment.

---

## Postman

- `backend/docs/postman/PRMSC-MRV.postman_collection.json`
- `backend/docs/postman/PRMSC-MRV.postman_environment.json`

---

## Role codes (`user.role` / JWT `role`)

| Code | Rank | Typical use |
|------|------|-------------|
| `USER` | 1 | Tubewell operator — water logs on **assigned water systems**; tehsils **derived** from systems. |
| `ADMIN` | 2 | Tehsil manager — facilities, solar logs, **verification**, onboarding (tehsil-scoped). |
| `SUPER_ADMIN` | 3 | Program-wide **read**; no MRV mutations (`for_write`). |
| `SYSTEM_ADMIN` | 4 | Same read-only mutations posture as `SUPER_ADMIN`; `org.read_all` in permissions. |

`min_role_required("X")` means rank ≥ rank(X). Facility and verification writes still require **ADMIN** tehsil scope (not SUPER/SYSTEM).

---

## 1. Auth — `/api/auth`

### `POST /api/auth/login` — no auth

```bash
curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","password":"your-password"}'
```

**200:** `token`, `user`. **401:** invalid credentials.

---

### `GET /api/auth/profile` — Bearer

```bash
curl -sS "$BASE/api/auth/profile" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api/auth/change-password` — Bearer

```bash
curl -sS -X POST "$BASE/api/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"old","new_password":"new"}'
```

---

### `POST /api/auth/forgot-password` — no auth

```bash
curl -sS -X POST "$BASE/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

---

### `POST /api/auth/reset-password` — no auth

```bash
curl -sS -X POST "$BASE/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"RESET_TOKEN_FROM_EMAIL","new_password":"new-secret"}'
```

Public registration is **not** exposed.

---

## 2. Users — `/api/users`

### `GET /api/users/` — Bearer, min `SUPER_ADMIN`

```bash
curl -sS "$BASE/api/users/" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api/users/onboard-operator` — Bearer, min `ADMIN`

```bash
curl -sS -X POST "$BASE/api/users/onboard-operator" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"New Operator",
    "email":"new.op@example.com",
    "password":"Temporary123!",
    "water_system_ids":["WATER_SYSTEM_ID"]
  }'
```

---

## 3. Dashboard — `/api/dashboard` — no JWT (public GETs)

### `GET /api/dashboard/program-summary`

```bash
curl -sS "$BASE/api/dashboard/program-summary?tehsil=All%20Tehsils&village=All%20Villages"
```

---

### `GET /api/dashboard/water-supplied`

```bash
curl -sS "$BASE/api/dashboard/water-supplied?tehsil=All%20Tehsils&year=2025"
```

Optional: `village`, `month`, `year`.

---

### `GET /api/dashboard/pump-hours`

```bash
curl -sS "$BASE/api/dashboard/pump-hours?tehsil=All%20Tehsils&year=2025"
```

Optional: `village`, `month`, `year`.

---

### `GET /api/dashboard/solar-generation`

```bash
curl -sS "$BASE/api/dashboard/solar-generation?tehsil=All%20Tehsils&year=2025"
```

Optional: `village`, `month`, `year`.

---

### `GET /api/dashboard/grid-import`

```bash
curl -sS "$BASE/api/dashboard/grid-import?tehsil=All%20Tehsils&year=2025"
```

Optional: `village`, `month`, `year`.

---

## 4. Health & debug — no auth

### `GET /`

```bash
curl -sS "$BASE/"
```

---

### `GET /api/hello`

```bash
curl -sS "$BASE/api/hello"
```

---

### `GET /api/debug/cors-test`

```bash
curl -sS "$BASE/api/debug/cors-test"
```

---

## 5. Static uploads

### `GET /api/uploads/<path:filename>` — no auth

```bash
curl -sS -o downloaded.bin "$BASE/api/uploads/water-images/example.png"
```

---

## 6. Operator — `/api/operator`

Use `Authorization: Bearer $TOKEN` on all calls below unless noted.

### 6.1 Notifications (shared)

#### `GET /api/operator/notifications`

```bash
curl -sS "$BASE/api/operator/notifications" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/operator/notifications/<notification_id>/read`

```bash
curl -sS -X POST "$BASE/api/operator/notifications/NOTIFICATION_ID/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

#### `POST /api/operator/notifications/read-all`

```bash
curl -sS -X POST "$BASE/api/operator/notifications/read-all" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 6.2 Tubewell operator (USER) flows

#### `POST /api/operator/submit` — `USER` only

```bash
curl -sS -X POST "$BASE/api/operator/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"record_id":"WATER_RECORD_ID"}'
```

---

#### `GET /api/operator/my-submissions`

```bash
curl -sS "$BASE/api/operator/my-submissions" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/tubewell/submission/<submission_id>`

```bash
curl -sS "$BASE/api/operator/tubewell/submission/SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/operator/upload` — `multipart/form-data`

Water (tubewell `USER`):

```bash
curl -sS -X POST "$BASE/api/operator/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./meter.jpg" \
  -F "record_id=WATER_RECORD_ID" \
  -F "record_type=water"
```

Solar evidence (tehsil manager `ADMIN`):

```bash
curl -sS -X POST "$BASE/api/operator/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./bill.pdf" \
  -F "record_id=SOLAR_RECORD_ID" \
  -F "record_type=solar"
```

---

#### `GET /api/operator/water-systems` — min `USER`

```bash
curl -sS "$BASE/api/operator/water-systems" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/water-system-config`

```bash
curl -sS "$BASE/api/operator/water-system-config?tehsil=TAUNSA&village=VillageA" \
  -H "Authorization: Bearer $TOKEN"
```

Optional query: `settlement`.

---

#### `GET /api/operator/water-data/drafts`

```bash
curl -sS "$BASE/api/operator/water-data/drafts" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/water-data/draft/<record_id>`

```bash
curl -sS "$BASE/api/operator/water-data/draft/WATER_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `PUT /api/operator/water-data/draft/<record_id>`

```bash
curl -sS -X PUT "$BASE/api/operator/water-data/draft/WATER_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year":2025,
    "month":3,
    "pump_start_time":"08:00",
    "pump_end_time":"17:00",
    "pump_operating_hours":9,
    "total_water_pumped":120.5
  }'
```

---

#### `POST /api/operator/water-data/draft/<record_id>/submit`

```bash
curl -sS -X POST "$BASE/api/operator/water-data/draft/WATER_RECORD_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

#### `DELETE /api/operator/water-data/draft/<record_id>`

```bash
curl -sS -X DELETE "$BASE/api/operator/water-data/draft/WATER_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/water-supply-data`

```bash
curl -sS "$BASE/api/operator/water-supply-data?tehsil=TAUNSA&village=VillageA&year=2025" \
  -H "Authorization: Bearer $TOKEN"
```

Optional: `settlement`.

---

#### `POST /api/operator/water-supply-data`

```bash
curl -sS -X POST "$BASE/api/operator/water-supply-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year":2025,
    "status":"drafted",
    "image_url":null,
    "data":[
      {
        "tehsil":"TAUNSA",
        "village":"VillageA",
        "settlement":"",
        "monthlyData":[
          {"month":1,"pump_start_time":"07:00","pump_end_time":"15:00","pump_operating_hours":8,"total_water_pumped":50}
        ]
      }
    ]
  }'
```

---

### 6.3 Tehsil manager (ADMIN) — facilities & solar

#### `GET /api/operator/tehsil-manager/submission/<submission_id>` — min `ADMIN`

```bash
curl -sS "$BASE/api/operator/tehsil-manager/submission/SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/operator/water-system` — upsert

```bash
curl -sS -X POST "$BASE/api/operator/water-system" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tehsil":"TAUNSA",
    "village":"VillageA",
    "settlement":"",
    "pump_model":"ModelX",
    "pump_serial_number":"SN-1",
    "meter_model":"M-1",
    "meter_serial_number":"MS-1"
  }'
```

---

#### `PUT /api/operator/water-system/<system_id>`

```bash
curl -sS -X PUT "$BASE/api/operator/water-system/WATER_SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pump_model":"UpdatedModel"}'
```

---

#### `DELETE /api/operator/water-system/<system_id>`

```bash
curl -sS -X DELETE "$BASE/api/operator/water-system/WATER_SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/operator/solar-system` — upsert

```bash
curl -sS -X POST "$BASE/api/operator/solar-system" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tehsil":"TAUNSA",
    "village":"VillageA",
    "settlement":"",
    "solar_panel_capacity":50,
    "inverter_capacity":50
  }'
```

---

#### `POST /api/operator/solar-data`

```bash
curl -sS -X POST "$BASE/api/operator/solar-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "solar_system_id":"SOLAR_SYSTEM_ID",
    "year":2025,
    "month":1,
    "energy_consumed_from_grid":100,
    "energy_exported_to_grid":50
  }'
```

---

#### `GET /api/operator/solar-systems`

```bash
curl -sS "$BASE/api/operator/solar-systems" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/solar-system/<system_id>`

```bash
curl -sS "$BASE/api/operator/solar-system/SOLAR_SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `PUT /api/operator/solar-system/<system_id>`

```bash
curl -sS -X PUT "$BASE/api/operator/solar-system/SOLAR_SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Updated"}'
```

---

#### `DELETE /api/operator/solar-system/<system_id>`

```bash
curl -sS -X DELETE "$BASE/api/operator/solar-system/SOLAR_SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/operator/solar-system-config`

```bash
curl -sS "$BASE/api/operator/solar-system-config?tehsil=TAUNSA&village=VillageA" \
  -H "Authorization: Bearer $TOKEN"
```

Optional: `settlement`.

---

#### `GET /api/operator/solar-supply-data`

```bash
curl -sS "$BASE/api/operator/solar-supply-data?tehsil=TAUNSA&village=VillageA&year=2025" \
  -H "Authorization: Bearer $TOKEN"
```

Optional: `settlement`.

---

#### `POST /api/operator/solar-supply-data`

```bash
curl -sS -X POST "$BASE/api/operator/solar-supply-data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"year":2025,"data":[]}'
```

---

#### `GET /api/operator/solar-supply-data/record/<record_id>`

```bash
curl -sS "$BASE/api/operator/solar-supply-data/record/SOLAR_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `PUT /api/operator/solar-supply-data/record/<record_id>`

```bash
curl -sS -X PUT "$BASE/api/operator/solar-supply-data/record/SOLAR_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"energy_consumed_from_grid":10,"energy_exported_to_grid":5}'
```

---

#### `DELETE /api/operator/solar-supply-data/record/<record_id>`

```bash
curl -sS -X DELETE "$BASE/api/operator/solar-supply-data/record/SOLAR_RECORD_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 6.4 Verification — water submissions

#### `GET /api/operator/verification/pending`

```bash
curl -sS "$BASE/api/operator/verification/pending" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/operator/verification/<submission_id>/verify` — tehsil `ADMIN` (not SUPER/SYSTEM write)

```bash
curl -sS -X POST "$BASE/api/operator/verification/SUBMISSION_ID/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Accepted"}'
```

---

#### `POST /api/operator/verification/<submission_id>/reject` — `remarks` required

```bash
curl -sS -X POST "$BASE/api/operator/verification/SUBMISSION_ID/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Reason for rejection"}'
```

---

#### `POST /api/operator/verification/<submission_id>/revert`

```bash
curl -sS -X POST "$BASE/api/operator/verification/SUBMISSION_ID/revert" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Please correct volumes"}'
```

---

#### `GET /api/operator/verification/audit-logs`

```bash
curl -sS "$BASE/api/operator/verification/audit-logs?submission_id=SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Optional query: `action_type`, `user_id` (without `submission_id` returns recent logs; behavior is role-scoped in the handler).

---

#### `GET /api/operator/verification/stats`

```bash
curl -sS "$BASE/api/operator/verification/stats" \
  -H "Authorization: Bearer $TOKEN"
```

---

## One-liner: obtain token with jq

```bash
export BASE=http://127.0.0.1:5000
export TOKEN=$(curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' | jq -r '.token // empty')
echo "$TOKEN"
```

---

## Removed / not in this codebase

- `POST /api/auth/register`
- Legacy `/api/verification/...` outside `/api/operator`
- `POST /api/operator/water-data` (single) / bulk variants not registered
- `GET /api/operator/water-report-pdf/...`
- Emissions / analyst route groups

---

## Source of truth

- Blueprint registration: `app/__init__.py` → `_register_blueprints`
- Routes: `app/routes/auth.py`, `users.py`, `dashboard.py`, `main.py`, `tehsil_manager.py`, `tubewell_operator.py`
- RBAC: `app/rbac.py`, `app/services/tehsil_access.py`, `app/constants/permissions.py`
