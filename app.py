from __future__ import annotations

import requests
from flask import Flask, jsonify, render_template, request

from config import BACKEND_URL, DEBUG, FLASK_PORT

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


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

    try:
        resp = requests.post(target_url, files=files, data=data, timeout=180)
        try:
            return jsonify(resp.json()), resp.status_code
        except ValueError:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "Backend returned non-JSON response",
                        "raw_response": resp.text[:1000],
                    }
                ),
                502,
            )
    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Cannot connect to backend service"}), 502
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "Backend service timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=FLASK_PORT, debug=DEBUG)
