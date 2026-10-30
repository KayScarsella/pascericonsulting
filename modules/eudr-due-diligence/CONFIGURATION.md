# Tutorial: Configuration for EUDR Due Diligence Map (Earth Engine)

This guide covers everything needed to run the **AOI analysis** (Hansen Global Forest Change via Google Earth Engine) and store results in Supabase.

---

## 1. Google Cloud project and Earth Engine

### 1.1 Create or choose a Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Note the **Project ID** (you will need it for billing/API).

### 1.2 Register the project for Earth Engine

1. Go to **[Earth Engine registration](https://console.cloud.google.com/earth-engine)** (while logged in with the same Google account that owns the project).
2. Complete registration so the **Cloud project is allowed to use Earth Engine**.
3. Enable the **Earth Engine API** for that project:  
   [Earth Engine API – Enable](https://console.cloud.google.com/apis/library/earthengine.googleapis.com)

If the API is not enabled or the project is not registered, server calls will fail with authentication or permission errors.

---

## 2. Service account and private key

The app uses **server-side** authentication with `ee.data.authenticateViaPrivateKey(...)` — the same pattern as the [official Node demo](https://github.com/google/earthengine-api/blob/master/demos/server-auth-nodejs/server.js).

### 2.1 Create a service account

1. In Cloud Console: **IAM & Admin → [Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)**.
2. **Create service account** → name it (e.g. `earthengine-dd`) → create.
3. Grant a role that can use Earth Engine. Google documents roles such as:
   - **Earth Engine Resource Viewer** (and sometimes **Service Usage Consumer**) for REST/compute usage.  
   See [Earth Engine access control](https://developers.google.com/earth-engine/guides/access_control).

### 2.2 Create and download the JSON key

1. Open the service account → **Keys** → **Add key** → **JSON**.
2. Download the file (e.g. `my-project-xxxxx.json`).

**Security:**

- Never commit this file to Git.
- Never expose it in client-side code or public env vars in the browser.
- If leaked, revoke the key in Console and create a new one.

### 2.3 Verify with Python (optional)

From the folder containing the JSON:

```python
import ee
ee.ServiceAccountCredentials('YOUR_SERVICE_ACCOUNT@....gserviceaccount.com', 'key.json')
ee.Initialize(credentials)
print(ee.Image('UMD/HANSEN/GFC2023/v1.11').getInfo())
```

If this runs without error, the project + service account can access Earth Engine.

---

## 3. Environment variables (Next.js server only)

The code reads **only** these server env vars (see `initialize.ts`):

| Variable | Description |
|----------|-------------|
| `EARTH_ENGINE_PRIVATE_KEY_JSON` | Entire content of the downloaded JSON file as a **single-line string** (awkward on Windows because of quotes/newlines). |
| `EARTH_ENGINE_PRIVATE_KEY_JSON_B64` | Same JSON file content **Base64-encoded** (recommended on Windows). |

Only **one** of them is required.

### 3.1 Option A – Base64 (recommended)

**PowerShell** (from the folder where the JSON is):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-service-account.json"))
```

Copy the output (one long line) into `.env.local`:

```env
EARTH_ENGINE_PRIVATE_KEY_JSON_B64=paste_the_base64_string_here
```

### 3.2 Option B – Raw JSON string

- Minify the JSON to one line (no line breaks).
- Escape any double quotes if you wrap the value in double quotes, or use a `.env` loader that supports multiline.

Example (conceptual — real keys are longer):

```env
EARTH_ENGINE_PRIVATE_KEY_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}
```

**Where to put it**

- Local: `.env.local` in the project root (already used by Next — do not commit).
- Production: set the same variable in Vercel/hosting **server** env (not `NEXT_PUBLIC_*`).

Restart the dev server after changing env.

---

## 4. Supabase

### 4.1 Bucket `user-uploads`

The due diligence actions upload to the **`user-uploads`** bucket:

- AOI GeoJSON: `aoi.geojson`
- Run metadata: `run_metadata.json`

Paths look like:

`{userId}/eudr-due-diligence/{sessionId}/{runId}/...`

Ensure:

1. The bucket **exists**.
2. **RLS/policies** allow the authenticated user (or service role used by the server client) to **upload** and **create signed URLs** for paths under their `userId`.

If mitigations uploads already work for EUDR/Timber, the same bucket is reused — align policies with existing `user-uploads` usage.

### 4.2 No extra tables required

Runs are stored as files + JSON metadata in storage. You can later add a `dd_runs` table if you want a DB index of runs.

---

## 5. App access (roles and session)

- **UI:** solo embed in valutazione finale EUDR (`EmbeddedDueDiligenceBlock` dopo rischio paese) — nessuna route dedicata.
- **Role:** Premium or Admin for the EUDR tool (same as valutazione finale).
- **Session:** `session_id` must be an **EUDR** `assessment_sessions` row the user can access (`validateSessionAccess`).

Without `session_id`, the page explains how to open it from the EUDR search/history.

---

## 6. Checklist before first run

| Step | Done? |
|------|--------|
| Cloud project registered for Earth Engine | ☐ |
| Earth Engine API enabled | ☐ |
| Service account created + JSON key downloaded | ☐ |
| IAM roles for EE on the service account | ☐ |
| `EARTH_ENGINE_PRIVATE_KEY_JSON` or `_B64` set in `.env.local` | ☐ |
| Dev server restarted | ☐ |
| Supabase `user-uploads` writable for your user | ☐ |
| Logged in as Premium/Admin with a valid EUDR `session_id` | ☐ |

---

## 7. Hydration and client components

`EARTH_ENGINE_PRIVATE_KEY_JSON` / `_B64` are **server-only** (not `NEXT_PUBLIC_*`).  
If a **client** component calls `isEarthEngineConfigured()` directly, the server sees the env and the client does not, so the first render differs and React reports a **hydration mismatch**.

**Fix (already applied in the app):** the server page calls `isEarthEngineConfigured()` once and passes `earthEngineConfigured={true|false}` as a prop to the client component. Do not branch UI on server env inside client components without that prop.

---

## 8. Troubleshooting

| Symptom | What to check |
|--------|----------------|
| “Earth Engine non configurato” | Env var missing or wrong name; restart server. |
| `invalid_grant` / auth errors | System clock sync; key not revoked; correct JSON. |
| EE initialize fails | Project not registered for EE or API disabled. |
| `reduceRegion` / timeout | AOI too large; reduce polygon or increase `maxPixels` / async job later. |
| Upload error | `user-uploads` policies; path must include user id (enforced in action). |

---

## 9. References

- [Earth Engine – Service accounts](https://developers.google.com/earth-engine/guides/service_account)
- [Earth Engine – Cloud project setup](https://developers.google.com/earth-engine/earthengine_cloud_project_setup)
- [Earth Engine API (enable)](https://console.cloud.google.com/apis/library/earthengine.googleapis.com)
- Internal code: `src/features/eudr-due-diligence/server/earthengine/initialize.ts`
