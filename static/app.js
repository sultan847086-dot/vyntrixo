const app = document.getElementById("app");
const nav = document.getElementById("nav");
let currentUser = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || "Kuch gadbad ho gayi.");
  return data;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function renderNav() {
  if (currentUser) {
    nav.innerHTML = `
      <button id="nav-feed">Feed</button>
      <button id="nav-upload" class="primary">+ Upload</button>
      <button id="nav-mine">Mine</button>
      <button id="nav-logout">Logout</button>`;
    document.getElementById("nav-feed").onclick = () => showFeed();
    document.getElementById("nav-upload").onclick = () => showUpload();
    document.getElementById("nav-mine").onclick = () => showMine();
    document.getElementById("nav-logout").onclick = logout;
  } else {
    nav.innerHTML = `<button id="nav-login">Login</button><button id="nav-signup" class="primary">Sign up</button>`;
    document.getElementById("nav-login").onclick = () => showLogin();
    document.getElementById("nav-signup").onclick = () => showSignup();
  }
}

function showLogin() {
  app.innerHTML = `
    <div class="card">
      <h2>Login karo</h2>
      <form id="login-form">
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password</label>
        <input type="password" name="password" required />
        <button class="btn" type="submit">Login</button>
        <div class="error" id="err"></div>
      </form>
      <div class="switch">Account nahi hai? <a id="go-signup">Sign up karo</a></div>
    </div>`;
  document.getElementById("go-signup").onclick = showSignup;
  document.getElementById("login-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const data = await api("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      currentUser = data.user;
      renderNav();
      showFeed();
    } catch (err) {
      document.getElementById("err").textContent = err.message;
    }
  };
}

function showSignup() {
  app.innerHTML = `
    <div class="card">
      <h2>Account banao</h2>
      <form id="signup-form">
        <label>Username (3-20, letters/numbers/_)</label>
        <input type="text" name="username" required />
        <label>Email</label>
        <input type="email" name="email" required />
        <label>Password (min 6)</label>
        <input type="password" name="password" required minlength="6" />
        <button class="btn" type="submit">Sign up</button>
        <div class="error" id="err"></div>
      </form>
      <div class="switch">Pehle se account hai? <a id="go-login">Login karo</a></div>
    </div>`;
  document.getElementById("go-login").onclick = showLogin;
  document.getElementById("signup-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const data = await api("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: f.get("username"),
          email: f.get("email"),
          password: f.get("password"),
        }),
      });
      currentUser = data.user;
      renderNav();
      showFeed();
    } catch (err) {
      document.getElementById("err").textContent = err.message;
    }
  };
}

function postHTML(p) {
  return `
    <article class="post" data-id="${p.id}">
      <div class="post-head">${esc(p.username)}</div>
      <img src="${esc(p.url)}" alt="photo" loading="lazy" />
      <div class="post-body">
        <button class="like-btn ${p.liked_by_me ? "liked" : ""}" data-like="${p.id}" aria-label="like">${p.liked_by_me ? "♥" : "♡"}</button>
        <span class="likes" data-count="${p.id}">${p.like_count} likes</span>
        ${p.caption ? `<p class="caption"><b>${esc(p.username)}</b> ${esc(p.caption)}</p>` : ""}
        <div class="time">${esc(p.created_at)} UTC</div>
      </div>
    </article>`;
}

function bindLikes(container, onNeedLogin) {
  container.querySelectorAll("[data-like]").forEach((btn) => {
    btn.onclick = async () => {
      if (!currentUser) { onNeedLogin(); return; }
      const id = btn.dataset.like;
      try {
        const data = await api(`/api/photos/${id}/like`, { method: "POST" });
        btn.textContent = data.liked ? "♥" : "♡";
        btn.classList.toggle("liked", data.liked);
        document.querySelector(`[data-count="${id}"]`).textContent = `${data.like_count} likes`;
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

async function showFeed() {
  app.innerHTML = `<div class="muted">Loading feed...</div>`;
  try {
    const data = await api("/api/feed");
    if (!data.photos.length) {
      app.innerHTML = `<div class="empty">Abhi koi photo nahi hai. Pehli photo upload karo!</div>`;
      return;
    }
    app.innerHTML = data.photos.map(postHTML).join("");
    bindLikes(app, () => showLogin());
  } catch (err) {
    app.innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

function showUpload() {
  if (!currentUser) { showLogin(); return; }
  app.innerHTML = `
    <div class="card">
      <h2>Photo upload karo</h2>
      <form id="upload-form">
        <label>Photo (png, jpg, gif, webp - max 8MB)</label>
        <input type="file" name="photo" accept="image/*" required />
        <img id="preview" class="preview" alt="preview" />
        <label>Caption (optional)</label>
        <textarea name="caption" rows="2" maxlength="300"></textarea>
        <button class="btn" type="submit">Upload</button>
        <div class="error" id="err"></div>
      </form>
    </div>`;
  const fileInput = app.querySelector("input[type=file]");
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
      const img = document.getElementById("preview");
      img.src = URL.createObjectURL(file);
      img.style.display = "block";
    }
  };
  document.getElementById("upload-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Uploading...";
    try {
      await api("/api/photos", { method: "POST", body: new FormData(e.target) });
      showFeed();
    } catch (err) {
      document.getElementById("err").textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Upload";
    }
  };
}

async function showMine() {
  if (!currentUser) { showLogin(); return; }
  app.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const data = await api("/api/my-photos");
    if (!data.photos.length) {
      app.innerHTML = `<div class="empty">Tumhari koi photo nahi hai abhi.</div>`;
      return;
    }
    app.innerHTML = data.photos.map((p) => postHTML(p) + `<div style="text-align:right;margin:-12px 0 16px"><button class="del-btn" data-del="${p.id}">Delete</button></div>`).join("");
    bindLikes(app, () => showLogin());
    app.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("Ye photo delete karni hai?")) return;
        try {
          await api(`/api/photos/${btn.dataset.del}`, { method: "DELETE" });
          showMine();
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    app.innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

async function logout() {
  try { await api("/api/logout", { method: "POST" }); } catch (_) {}
  currentUser = null;
  renderNav();
  showFeed();
}

async function init() {
  try {
    const data = await api("/api/me");
    currentUser = data.user;
  } catch (_) {
    currentUser = null;
  }
  renderNav();
  showFeed();
}

init();
