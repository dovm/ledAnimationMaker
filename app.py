from flask import Flask, send_from_directory, request, jsonify
import os
from pathlib import Path
import traceback
app = Flask(__name__)

PORT = int(os.environ.get('PORT', 3000))
STATIC_DIR = Path(__file__).parent / 'static'

# Ensure static directory exists
if not STATIC_DIR.exists():
    print(f"Warning: Static directory '{STATIC_DIR}' does not exist. Creating it...")
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Created static directory: {STATIC_DIR}")

# Serve static files from the 'static' directory
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(str(STATIC_DIR), filename)

@app.route('/')
def serve_index():
    # Try to serve index.html, or list directory if it doesn't exist
    index_file = STATIC_DIR / 'index.html'
    if index_file.exists():
        return send_from_directory(str(STATIC_DIR), 'index.html')
    else:
        # List files in static directory
        files = [f for f in STATIC_DIR.iterdir() if f.is_file()]
        file_list = '\n'.join([f'<li><a href="/{f.name}">{f.name}</a></li>' for f in files])
        return f'''
        <!DOCTYPE html>
        <html>
        <head><title>Static File Server</title></head>
        <body>
            <h1>Static File Server</h1>
            <p>Serving files from: {STATIC_DIR}</p>
            <ul>{file_list if files else '<li>No files found</li>'}</ul>
        </body>
        </html>
        ''', 200



if __name__ == '__main__':
    print(f"Server running at http://localhost:{PORT}/")
    print(f"Serving static files from: {STATIC_DIR}")
    app.run(host='0.0.0.0', port=PORT, debug=False)

