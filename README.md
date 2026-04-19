# llm-frontend-python

This is a Flask frontend gateway for CareerPilot.

- Serves the UI page at `/`
- Proxies `POST /api/careerpilot/run`, `POST /api/careerpilot/run_partial`, and `GET /api/careerpilot/result/<run_id>` to the backend
- Results include **How We Analyzed This** from the API `explainability.pipeline_trace` (and `full_state` as fallback). `fallback_events` and `limitations` are not shown in the UI.
- Keeps frontend and backend fully separated (no direct Python import from backend code)

## Config

Set values in environment variables or `config.py`:

- `BACKEND_URL` (default: `http://localhost:8080`)
- `FLASK_PORT` (default: `5000`)
- `FLASK_DEBUG` (default: `true`)

## Run

1. Start backend service (CareerPilot API).
2. Start frontend:

```sh
cd CareerPilotAI-frontend
python app.py
```

3. Open [http://localhost:5000](http://localhost:5000)

## Test

```sh
cd CareerPilotAI-frontend
pip install pytest
pytest
```
