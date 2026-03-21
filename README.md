# llm-frontend-python

This is a Flask frontend gateway for CareerPilot.

- Serves the UI page at `/`
- Proxies `POST /api/careerpilot/run` to `${BACKEND_URL}/api/careerpilot/run`
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
cd llm-frontend-python
python app.py
```

3. Open [http://localhost:5000](http://localhost:5000)