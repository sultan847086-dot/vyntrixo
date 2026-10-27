import os
import re
import sqlite3
import secrets
import uuid
from functools import wraps

from flask import Flask, g, jsonify, request, session, send_from_directory, abort
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "instance", "app.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
SECRET_FILE = os.path.join(BASE_DIR, "instance", "secret.key")
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_UPLOAD_MB = 8

os.makedirs(os.path.join(BASE_DIR, "instance"), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def load_secret():
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(SECRET_FILE, "w") as f:
        f.write(key)
    return key


app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["SECRET_KEY"] = load_secret()
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


# ---------- database ----------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            caption TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS likes (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, photo_id)
        );
        """
    )
    db.commit()
    db.close()


init_db()


# ---------- helpers ----------

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return get_db().execute(
        "SELECT id, username, email FROM users WHERE id = ?", (uid,)
    ).fetchone()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Pehle login karo."}), 401
        return fn(*args, **kwargs)
    return wrapper


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


def photo_to_dict(row, me_id):
    return {
        "id": row["id"],
        "filename": row["filename"],
        "url": f"/static/uploads/{row['filename']}",
        "caption": row["caption"],
        "created_at": row["created_at"],
        "username": row["username"],
        "like_count": row["like_count"],
        "liked_by_me": bool(row["liked_by_me"]),
    }


# ---------- pages ----------

@app.route("/")
def index():
    return send_from_directory(os.path.join(BASE_DIR, "static"), "index.html")


# ---------- auth ----------

@app.post("/api/signup")
def signup():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not USERNAME_RE.match(username):
        return jsonify({"error": "Username 3-20 characters, sirf letters, numbers aur _."}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Sahi email daalo."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password kam se kam 6 characters ka ho."}), 400

    db = get_db()
    exists = db.execute(
        "SELECT id FROM users WHERE username = ? OR email = ?", (username, email)
    ).fetchone()
    if exists:
        return jsonify({"error": "Ye username ya email pehle se use ho raha hai."}), 409

    cur = db.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, generate_password_hash(password)),
    )
    db.commit()
    session.clear()
    session["user_id"] = cur.lastrowid
    return jsonify({"ok": True, "user": {"id": cur.lastrowid, "username": username, "email": email}}), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = get_db().execute(
        "SELECT * FROM users WHERE email = ?", (email,)
    ).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Email ya password galat hai."}), 401

    session.clear()
    session["user_id"] = user["id"]
    return jsonify({"ok": True, "user": {"id": user["id"], "username": user["username"], "email": user["email"]}})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"user": None})
    return jsonify({"user": {"id": user["id"], "username": user["username"], "email": user["email"]}})


# ---------- photos ----------

@app.post("/api/photos")
@login_required
def upload_photo():
    file = request.files.get("photo")
    caption = (request.form.get("caption") or "").strip()[:300]
    if not file or file.filename == "":
        return jsonify({"error": "Photo select karo."}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Sirf png, jpg, jpeg, gif ya webp allowed hai."}), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    safe = secure_filename(file.filename.rsplit(".", 1)[0])[:40] or "photo"
    filename = f"{uuid.uuid4().hex[:12]}_{safe}.{ext}"
    file.save(os.path.join(UPLOAD_DIR, filename))

    user = current_user()
    db = get_db()
    cur = db.execute(
        "INSERT INTO photos (user_id, filename, caption) VALUES (?, ?, ?)",
        (user["id"], filename, caption),
    )
    db.commit()
    return jsonify({"ok": True, "photo_id": cur.lastrowid}), 201


@app.errorhandler(413)
def too_big(_e):
    return jsonify({"error": f"Photo {MAX_UPLOAD_MB}MB se chhoti honi chahiye."}), 413


@app.get("/api/feed")
def feed():
    user = current_user()
    me_id = user["id"] if user else -1
    rows = get_db().execute(
        """
        SELECT p.id, p.filename, p.caption, p.created_at, u.username,
               (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id) AS like_count,
               (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id AND l.user_id = ?) AS liked_by_me
        FROM photos p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.id DESC
        LIMIT 100
        """,
        (me_id,),
    ).fetchall()
    return jsonify({"photos": [photo_to_dict(r, me_id) for r in rows]})


@app.post("/api/photos/<int:photo_id>/like")
@login_required
def toggle_like(photo_id):
    user = current_user()
    db = get_db()
    exists = db.execute("SELECT id FROM photos WHERE id = ?", (photo_id,)).fetchone()
    if not exists:
        return jsonify({"error": "Photo nahi mili."}), 404

    already = db.execute(
        "SELECT 1 FROM likes WHERE user_id = ? AND photo_id = ?", (user["id"], photo_id)
    ).fetchone()
    if already:
        db.execute("DELETE FROM likes WHERE user_id = ? AND photo_id = ?", (user["id"], photo_id))
        liked = False
    else:
        db.execute("INSERT INTO likes (user_id, photo_id) VALUES (?, ?)", (user["id"], photo_id))
        liked = True
    db.commit()
    count = db.execute("SELECT COUNT(*) FROM likes WHERE photo_id = ?", (photo_id,)).fetchone()[0]
    return jsonify({"liked": liked, "like_count": count})


@app.delete("/api/photos/<int:photo_id>")
@login_required
def delete_photo(photo_id):
    user = current_user()
    db = get_db()
    row = db.execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
    if not row:
        return jsonify({"error": "Photo nahi mili."}), 404
    if row["user_id"] != user["id"]:
        return jsonify({"error": "Ye photo tumhari nahi hai."}), 403
    path = os.path.join(UPLOAD_DIR, row["filename"])
    db.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    db.commit()
    if os.path.exists(path):
        os.remove(path)
    return jsonify({"ok": True})


@app.get("/api/my-photos")
@login_required
def my_photos():
    user = current_user()
    rows = get_db().execute(
        """
        SELECT p.id, p.filename, p.caption, p.created_at, u.username,
               (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id) AS like_count,
               (SELECT COUNT(*) FROM likes l WHERE l.photo_id = p.id AND l.user_id = ?) AS liked_by_me
        FROM photos p JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ? ORDER BY p.id DESC
        """,
        (user["id"], user["id"]),
    ).fetchall()
    return jsonify({"photos": [photo_to_dict(r, user["id"]) for r in rows]})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
