from __future__ import annotations

import os
import requests
from flask import Flask, jsonify, render_template, request

from config import BACKEND_URL, DEBUG, FLASK_PORT

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


def _forward_json(resp: requests.Response):
    try:
        return jsonify(resp.json()), resp.status_code
    except ValueError:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "Backend returned non-JSON response",
                    "raw_response": (resp.text or "")[:1000],
                }
            ),
            502,
        )


def _auth_headers() -> dict[str, str]:
    auth = (request.headers.get("Authorization") or "").strip()
    return {"Authorization": auth} if auth else {}


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    target_url = f"{BACKEND_URL.rstrip('/')}/api/auth/register"
    try:
        resp = requests.post(target_url, json=request.get_json(silent=True) or {}, timeout=60)
        return _forward_json(resp)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    target_url = f"{BACKEND_URL.rstrip('/')}/api/auth/login"
    try:
        resp = requests.post(target_url, json=request.get_json(silent=True) or {}, timeout=60)
        return _forward_json(resp)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    target_url = f"{BACKEND_URL.rstrip('/')}/api/auth/me"
    try:
        resp = requests.get(target_url, headers=_auth_headers(), timeout=60)
        return _forward_json(resp)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/run", methods=["POST"])
def run_careerpilot():
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/run"
    resume_file = request.files.get("resume_file")
    if not resume_file:
        return jsonify({"ok": False, "error": "Missing resume_file"}), 400

    files = {
        "resume_file": (
            resume_file.filename or "resume.pdf",
            resume_file.stream,
            resume_file.mimetype or "application/pdf",
        )
    }
    data = {"target_roles": (request.form.get("target_roles") or "").strip()}
    client_id = (request.form.get("client_id") or "").strip()
    if client_id:
        data["client_id"] = client_id

    try:
        resp = requests.post(target_url, files=files, data=data, headers=_auth_headers(), timeout=180)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/run_partial", methods=["POST"])
def run_careerpilot_partial():
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/run_partial"
    resume_file = request.files.get("resume_file")
    if not resume_file:
        return jsonify({"ok": False, "error": "Missing resume_file"}), 400

    files = {
        "resume_file": (
            resume_file.filename or "resume.pdf",
            resume_file.stream,
            resume_file.mimetype or "application/pdf",
        )
    }
    data = {"target_roles": (request.form.get("target_roles") or "").strip()}
    client_id = (request.form.get("client_id") or "").strip()
    if client_id:
        data["client_id"] = client_id

    try:
        resp = requests.post(target_url, files=files, data=data, headers=_auth_headers(), timeout=180)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/result/<run_id>", methods=["GET"])
def careerpilot_result(run_id: str):
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/result/{run_id}"
    try:
        resp = requests.get(target_url, timeout=60)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/session/<run_id>/reject_job", methods=["POST"])
def careerpilot_reject_job(run_id: str):
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/session/{run_id}/reject_job"
    payload = request.get_json(silent=True) or {}
    try:
        resp = requests.post(target_url, json=payload, timeout=120)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/users/<user_id>/memory", methods=["GET", "PATCH"])
def careerpilot_user_memory(user_id: str):
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/users/{user_id}/memory"
    try:
        if request.method == "GET":
            resp = requests.get(target_url, timeout=60)
        else:
            resp = requests.patch(target_url, json=request.get_json(silent=True) or {}, timeout=60)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/session/<run_id>/application_pack", methods=["GET"])
def careerpilot_application_pack(run_id: str):
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/session/{run_id}/application_pack"
    params = {}
    job_id = (request.args.get("job_id") or "").strip()
    fmt = (request.args.get("format") or "json").strip()
    if job_id:
        params["job_id"] = job_id
    if fmt:
        params["format"] = fmt
    try:
        resp = requests.get(target_url, params=params, timeout=120)
        if fmt in ("zip", "markdown"):
            return (
                resp.content,
                resp.status_code,
                {
                    "Content-Type": resp.headers.get("Content-Type", "application/octet-stream"),
                    "Content-Disposition": resp.headers.get("Content-Disposition", ""),
                },
            )
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/careerpilot/session/<run_id>/select_job", methods=["POST"])
def careerpilot_select_job(run_id: str):
    target_url = f"{BACKEND_URL.rstrip('/')}/api/careerpilot/session/{run_id}/select_job"
    payload = request.get_json(silent=True) or {}
    try:
        resp = requests.post(target_url, json=payload, timeout=120)
        return _forward_json(resp)
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", FLASK_PORT))
    app.run(host='0.0.0.0', port=port, debug=DEBUG)
