import os

BACKEND_URL = os.environ.get('BACKEND_URL', 'https://careerpilot-backend-29874594183.asia-southeast1.run.app')
FLASK_PORT = int(os.environ.get('FLASK_PORT', 5000))
DEBUG = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
