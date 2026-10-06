const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.disable("etag");
const PORT = Number(process.env.PORT || 3004);
const DATA_DIR = path.join(__dirname, ".data");
const DATA_FILE = path.join(DATA_DIR, "dotion.json");
const SESSION_COOKIE = "dotion_session";
const sessions = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/api", function(req,res,next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const users = [
  { id: "dorka", name: "Dorka", avatar: "D", role: "admin" },
  { id: "gabi", name: "Gabi", avatar: "G", role: "admin" },
  { id: "vera", name: "Vera", avatar: "V", role: "member" },
  { id: "bianka", name: "Bianka", avatar: "B", role: "member" }
];

const IMPORT_VERSION = "notion-dorka-2026-10-06-v1";
const NOTION_TASK_FILES = [
  "notion-tasks-01.json",
  "notion-tasks-02.json",
  "notion-tasks-03.json",
  "notion-tasks-04.json"
];

function loadImportedTasks() {
  return NOTION_TASK_FILES.flatMap(function(file) {
    const full = path.join(__dirname, "data", file);
    return JSON.parse(fs.readFileSync(full, "utf8"));
  });
}

const seed = {
  _meta: {
    importVersion: IMPORT_VERSION,
    importedAt: "2026-10-06",
    source: "Dorka Notion export"
  },
  tasks: loadImportedTasks(),
  content: [],
  products: [],
  inbox: [],
  notes: []
};

function isAdmin(user) {
  return user && user.role === "admin";
}
function normalizeData(data) {
  const mapUser = (id) => id === "gabor" ? "gabi" : id === "anna" ? "vera" : id;
  ["tasks","content","products"].forEach(function(collection) {
    data[collection] = data[collection] || [];
    data[collection] = data[collection].map(function(item) {
      return Object.assign({}, item, { assignee: mapUser(item.assignee) });
    });
  });
  data.inbox = data.inbox || [];
  data.notes = data.notes || [];
  return data;
}
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let shouldImport = !fs.existsSync(DATA_FILE);
  if (!shouldImport) {
    try {
      const current = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      shouldImport = !current._meta || current._meta.importVersion !== IMPORT_VERSION;
    } catch (error) {
      shouldImport = true;
    }
  }
  if (shouldImport) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}
function readData() {
  ensureData();
  return normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalizeData(data), null, 2));
}
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach(function(part) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}
function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const uid = token && sessions.get(token);
  return users.find(function(u) { return u.id === uid; }) || null;
}
function requireAuth(req,res,next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error:"unauthorized" });
  req.user = user;
  next();
}
function id(prefix) {
  return prefix + crypto.randomBytes(6).toString("hex");
}
function canAccessTask(user, task) {
  return isAdmin(user) || task.assignee === user.id;
}
function publicDataFor(user, data) {
  return Object.assign({}, data, {
    tasks: isAdmin(user) ? data.tasks : data.tasks.filter(function(t) { return t.assignee === user.id; }),
    users: users,
    me: user
  });
}

app.get("/health", function(req,res) {
  res.json({ ok:true, app:"dotion", version:"0.3.6", port:PORT });
});
app.get("/api/auth/users", function(req,res) {
  res.json(users.map(function(u) { return { id:u.id, name:u.name, avatar:u.avatar }; }));
});
app.get("/api/auth/me", function(req,res) {
  res.json({ user:currentUser(req) });
});
app.post("/api/auth/login", function(req,res) {
  const user = users.find(function(u) { return u.id === req.body.userId; });
  if (!user) return res.status(401).json({ error:"Hibás felhasználó" });
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, user.id);
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000");
  res.json({ user:user });
});
app.post("/api/auth/logout", function(req,res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  res.json({ ok:true });
});

app.get("/api/data", requireAuth, function(req,res) {
  res.json(publicDataFor(req.user, readData()));
});

const collections = { content:"ct", products:"p", inbox:"i", notes:"n" };
Object.entries(collections).forEach(function(entry) {
  const name = entry[0];
  const prefix = entry[1];

  app.post("/api/" + name, requireAuth, function(req,res) {
    const data = readData();
    const item = Object.assign({ id:id(prefix) }, req.body);
    if (name === "inbox") item.createdAt = new Date().toISOString();
    if (name === "notes") item.updatedAt = new Date().toISOString();
    data[name].unshift(item);
    writeData(data);
    res.status(201).json(item);
  });

  app.patch("/api/" + name + "/:id", requireAuth, function(req,res) {
    const data = readData();
    const i = data[name].findIndex(function(x) { return x.id === req.params.id; });
    if (i < 0) return res.status(404).json({ error:"not_found" });
    data[name][i] = Object.assign({}, data[name][i], req.body);
    if (name === "notes") data[name][i].updatedAt = new Date().toISOString();
    writeData(data);
    res.json(data[name][i]);
  });

  app.delete("/api/" + name + "/:id", requireAuth, function(req,res) {
    const data = readData();
    data[name] = data[name].filter(function(x) { return x.id !== req.params.id; });
    writeData(data);
    res.json({ ok:true });
  });
});

app.post("/api/tasks", requireAuth, function(req,res) {
  const data = readData();
  const item = Object.assign({
    id:id("t"),
    comments:[],
    checklist:[],
    platform:[],
    status:"Teendő",
    priority:"Normál"
  }, req.body);
  item.assignee = isAdmin(req.user) ? (req.body.assignee || req.user.id) : req.user.id;
  item.comments = Array.isArray(item.comments) ? item.comments : [];
  item.checklist = Array.isArray(item.checklist) ? item.checklist : [];
  item.platform = Array.isArray(item.platform) ? item.platform : [];
  data.tasks.unshift(item);
  writeData(data);
  res.status(201).json(item);
});

app.patch("/api/tasks/:id", requireAuth, function(req,res) {
  const data = readData();
  const i = data.tasks.findIndex(function(x) { return x.id === req.params.id; });
  if (i < 0) return res.status(404).json({ error:"not_found" });
  const task = data.tasks[i];
  if (!canAccessTask(req.user, task)) return res.status(403).json({ error:"forbidden" });
  const patch = Object.assign({}, req.body);
  if (!isAdmin(req.user)) delete patch.assignee;
  data.tasks[i] = Object.assign({}, task, patch);
  writeData(data);
  res.json(data.tasks[i]);
});

app.delete("/api/tasks/:id", requireAuth, function(req,res) {
  const data = readData();
  const task = data.tasks.find(function(x) { return x.id === req.params.id; });
  if (!task) return res.status(404).json({ error:"not_found" });
  if (!canAccessTask(req.user, task)) return res.status(403).json({ error:"forbidden" });
  data.tasks = data.tasks.filter(function(x) { return x.id !== req.params.id; });
  writeData(data);
  res.json({ ok:true });
});

app.post("/api/tasks/:id/comments", requireAuth, function(req,res) {
  const data = readData();
  const task = data.tasks.find(function(x) { return x.id === req.params.id; });
  if (!task) return res.status(404).json({ error:"not_found" });
  if (!canAccessTask(req.user, task)) return res.status(403).json({ error:"forbidden" });
  const comment = { id:id("cm"), userId:req.user.id, text:String(req.body.text || "").trim(), createdAt:new Date().toISOString() };
  if (!comment.text) return res.status(400).json({ error:"empty_comment" });
  task.comments = task.comments || [];
  task.comments.push(comment);
  writeData(data);
  res.status(201).json(comment);
});

app.use(function(req,res,next) {
  if (req.path === "/" || req.path === "/app.js" || req.path === "/styles.css") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
app.use(express.static(path.join(__dirname, "public")));
app.use(function(req,res) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureData();
app.listen(PORT, "0.0.0.0", function() {
  console.log("Dotion listening on :" + PORT);
});
