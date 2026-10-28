const app = document.getElementById("app");
const nav = document.getElementById("nav");
const topActions = document.getElementById("top-actions");
let currentUser = null;
let currentView = "feed";

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  add: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  login: '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
  signup: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 8v6M16 11h6"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.1C1.1 8.7 3.2 5 6.8 5c2 0 3.5 1.1 4.2 2.4C11.7 6.1 13.2 5 15.2 5c3.6 0 5.7 3.7 4.3 6.9C19.5 16.4 12 21 12 21z"/></svg>',
};

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

function initial(name) {
  return esc(String(name || "?").charAt(0));
}

function setActive(id) {
  nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.id === id));
}

function renderNav() {
  if (currentUser) {
    topActions.innerHTML = `<button id="top-upload" class="pill-btn grad" aria-label="upload">Upload</button>`;
    document.getElementById("top-upload").onclick = () => showUpload();
    nav.innerHTML = `
      <button id="nav-feed" aria-label="Home">${ICON.home}</button>
      <button id="nav-search" aria-label="Search">${ICON.search}</button>
      <button id="nav-upload" aria-label="Upload">
        <span class="nav-add">${ICON.add}</span>
      </button>
      <button id="nav-mine" aria-label="Profile">
        <span class="avatar-nav"><span>${initial(currentUser.username)}</span></span>
      </button>`;
    document.getElementById("nav-feed").onclick = () => showFeed();
    document.getElementById("nav-search").onclick = () => showSearch();
    document.getElementById("nav-upload").onclick = () => showUpload();
    document.getElementById("nav-mine").onclick = () => showMine();
  } else {
    topActions.innerHTML = `<button id="top-login" class="pill-btn">Login</button>`;
    document.getElementById("top-login").onclick = () => showLogin();
    nav.innerHTML = `
      <button id="nav-feed" aria-label="Home">${ICON.home}</button>
      <button id="nav-search" aria-label="Search">${ICON.search}</button>
      <button id="nav-login" aria-label="Login">${ICON.login}</button>
      <button id="nav-signup" aria-label="Sign up">${ICON.signup}</button>`;
    document.getElementById("nav-feed").onclick = () => showFeed();
    document.getElementById("nav-search").onclick = () => showSearch();
    document.getElementById("nav-login").onclick = () => showLogin();
    document.getElementById("nav-signup").onclick = () => showSignup();
  }
}

function showLogin() {
  setActive("nav-login");
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
  setActive("nav-signup");
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
      <div class="post-head">
        <span class="post-avatar"><span class="avatar">${initial(p.username)}</span></span>
        <span class="post-username">${esc(p.username)}</span>
      </div>
      <img src="${esc(p.url)}" alt="photo" loading="lazy" />
      <div class="post-body">
        <div class="post-actions">
          <button class="like-btn ${p.liked_by_me ? "liked" : ""}" data-like="${p.id}" aria-label="like">${ICON.heart}</button>
          <span class="likes" data-count="${p.id}">${p.like_count} likes</span>
        </div>
        ${p.caption ? `<p class="caption"><b>${esc(p.username)}</b> ${esc(p.caption)}</p>` : ""}
        <div class="time">${esc(p.created_at)} UTC</div>
      </div>
    </article>`;
}

function storiesHTML(photos) {
  const seen = new Set();
  const names = [];
  if (currentUser) { seen.add(currentUser.username); names.push(currentUser.username); }
  photos.forEach((p) => { if (!seen.has(p.username)) { seen.add(p.username); names.push(p.username); } });
  const items = names.slice(0, 12).map((n) => `
    <div class="story">
      <div class="story-ring"><div class="story-inner"><div class="avatar">${initial(n)}</div></div></div>
      <div class="story-name">${esc(n)}</div>
    </div>`).join("");
  return items ? `<div class="stories">${items}</div>` : "";
}

function bindLikes(container, onNeedLogin) {
  container.querySelectorAll("[data-like]").forEach((btn) => {
    btn.onclick = async () => {
      if (!currentUser) { onNeedLogin(); return; }
      const id = btn.dataset.like;
      try {
        const data = await api(`/api/photos/${id}/like`, { method: "POST" });
        btn.classList.toggle("liked", data.liked);
        document.querySelector(`[data-count="${id}"]`).textContent = `${data.like_count} likes`;
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

async function showFeed() {
  currentView = "feed";
  setActive("nav-feed");
  app.innerHTML = `<div class="muted">Loading feed...</div>`;
  try {
    const data = await api("/api/feed");
    if (!data.photos.length) {
      app.innerHTML = `<div class="empty">Abhi koi photo nahi hai. Pehli photo upload karo!</div>`;
      return;
    }
    app.innerHTML = storiesHTML(data.photos) + data.photos.map(postHTML).join("");
    bindLikes(app, () => showLogin());
  } catch (err) {
    app.innerHTML = `<div class="error">${esc(err.message)}</div>`;
  }
}

function showSearch() {
  setActive("nav-search");
  app.innerHTML = `
    <div class="card">
      <h2>Search</h2>
      <div class="search-box">Search abhi coming soon hai.</div>
    </div>`;
}

function showUpload() {
  if (!currentUser) { showLogin(); return; }
  setActive("nav-upload");
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
  setActive("nav-mine");
  app.innerHTML = `<div class="muted">Loading...</div>`;
  try {
    const data = await api("/api/my-photos");
    const count = data.photos.length;
    const header = `
      <div class="profile-head">
        <div class="profile-ring"><div class="avatar">${initial(currentUser.username)}</div></div>
        <div class="profile-meta">
          <div class="profile-name">${esc(currentUser.username)}</div>
          <div class="profile-sub">${count} post${count === 1 ? "" : "s"}</div>
          <div class="profile-actions"><button id="nav-logout" class="logout-btn">Logout</button></div>
        </div>
      </div>`;
    let body;
    if (!count) {
      body = `<div class="empty">Tumhari koi photo nahi hai abhi.</div>`;
    } else {
      body = `<div class="profile-grid">` + data.photos.map((p) => `
        <div class="grid-cell">
          <img src="${esc(p.url)}" alt="photo" loading="lazy" />
          <span class="grid-likes">${p.like_count} likes</span>
          <button class="del-btn" data-del="${p.id}" style="position:absolute;right:6px;top:6px;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:2px 8px;">Delete</button>
        </div>`).join("") + `</div>`;
    }
    app.innerHTML = header + body;
    document.getElementById("nav-logout").onclick = logout;
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
