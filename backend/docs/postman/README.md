# Postman — PRMSC MRV API

## Files

| File | Purpose |
|------|---------|
| `PRMSC-MRV.postman_collection.json` | Collection v2.1 — all main requests, Bearer auth on the collection |
| `PRMSC-MRV.postman_environment.json` | Example environment (`baseUrl`, `token`, IDs) |

Narrative API documentation (status codes, roles, field notes): [`../API_REFERENCE.md`](../API_REFERENCE.md).

## Import (Postman desktop or web)

1. **Import collection:** *File → Import* (or *Import* in workspace) → choose `PRMSC-MRV.postman_collection.json`.
2. **Import environment:** Import `PRMSC-MRV.postman_environment.json`.
3. Select the **PRMSC MRV — Local** environment in the top-right environment dropdown.
4. Edit environment variables:
   - `baseUrl` — e.g. `http://127.0.0.1:5000` or your deployed API origin (no trailing slash).
   - `user_id` — filled by Login Tests when present.
   - `water_system_id`, `solar_system_id`, `water_record_id`, `solar_record_id`, `submission_id`, `notification_id` — paste UUIDs from API responses as you work.

## Token workflow

1. Open **Auth → Login**, set email/password in the body, **Send**.
2. The **Tests** script on Login saves `token` (and `user_id` when present) into the **active** environment.
3. All other folders inherit **Bearer Token** `{{token}}` from the collection.

If the token is not saved automatically, copy `token` from the login JSON response and paste it into the environment variable `token`.

## Roles

Many requests require specific JWT roles (e.g. `ADMIN` for onboarding operators, `USER` with assigned water systems for tubewell routes). Use a login account that matches the scenario; see `API_REFERENCE.md` → Role codes.

## Multipart upload

**Operator — tubewell (USER) → Upload meter image:** in the **Body** tab choose **form-data**, set `file` type to **File** and pick a local image/PDF; optional `record_id`, `record_type` (`water` or `solar` — solar uploads require **ADMIN** in the API).

## Regenerating the collection

Maintain `PRMSC-MRV.postman_collection.json` in Postman (export) or align it with `app/routes/*.py` and `../API_REFERENCE.md`.
