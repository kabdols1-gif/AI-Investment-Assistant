# AI Investment Assistant

Voice-first investment assistant with a Next.js frontend and FastAPI backend.

## Run

- Frontend: `cd frontend && npm run dev`
- Backend: use the project Python environment and start `backend.main` on port `8010`.

## Core Folders

- `frontend`: mobile/desktop UI
- `backend`: API routes and assistant orchestration
- `core`: trading execution helpers
- `strategy`: built-in strategy implementations
- `strategy_core`: strategy registry, DSL, and execution helpers
- `tools`: local setup utilities

Archived legacy screenshots, samples, examples, and unrelated reference files are stored outside this folder under `_archive_unrelated_20260603`.

## KB OpenAPI Test Project

Lightweight test scaffold for KB Securities Open API (BaaS 2.0), including:

- CLI entrypoint: `scripts/run-ssqm2952.js`
- Browser UI: `public/index.html` (served by `server.js`)
- Spec-driven service templates under `broker-specs/`

Current default service:
- `SSQM2952` (account asset valuation)

### Run from command line

```powershell
npm run run:kb:ssqm2952
```

- Set environment variables directly or via `.env` and update the payload as needed.

```powershell
$env:KB_CLIENT_ID="..."
$env:KB_CLIENT_SECRET="..."
$env:KB_CI_NO="..."
$env:KB_USER_INFO="..."
$env:KB_INFO_TYPE="1"
$env:KB_BASE_URL="https://dbaasapi.kbsec.com:32484"
$env:KB_TIMEOUT_MS="20000"
```

### Run sample UI

```powershell
npm run ui
```

- Open `http://localhost:3000`
- Input `clientId`, `clientSecret`, `ciNo`, `userInfo`
- Optionally load and edit payload
- Click `Run SSQM2952`

Step-wise results are rendered for:
- `baas_auth_issue`
- `baas_token_issue`
- `clause_agree_process`
- service API call

### Multi-broker spec convention

- `broker-specs/<broker-id>/...`
- `SSQM2952.json` / `SSQM2952.payload.example.json`
- Extend this folder when adding additional broker/API specs
