import os
from api.index import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5999))
    host = os.environ.get('HOST', '127.0.0.1')
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1')
    print(f"Asteria-Excel server started at http://{host}:{port} (debug={debug_mode})")
    app.run(host=host, port=port, debug=debug_mode)
