const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3004);
const DATA_DIR = path.join(__dirname, ".data");
const DATA_FILE = path.join(DATA_DIR, "dotion.json");
const SESSION_COOKIE = "dotion_session";
const sessions = new Map();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

const users = [
  { id: "gabor", name: "Gábor", avatar: "G" },
  { id: "dorka", name: "Dorka", avatar: "D" },
  { id: "anna", name: "Anna", avatar: "A" }
];

const seed = {
  tasks: [
    { id: "t1", title: "Instagram Reel publikálása", brand: "MATÉZZ", area: "Social Media", assignee: "dorka", status: "Folyamatban", priority: "Fontos", due: "2026-10-08", platform: ["Instagram","TikTok"], notes: "Tereré videó, rövid edukációs szöveggel.", checklist: [{id:"c1",text:"videó felvéve",done:true},{id:"c2",text:"felirat",done:false},{id:"c3",text:"cover",done:false},{id:"c4",text:"publikálás",done:false}], comments: [] },
    { id: "t2", title: "Új yerba termék feltöltése", brand: "MATÉZZ", area: "Termékfeltöltés", assignee: "anna", status: "Teendő", priority: "Normál", due: "2026-10-09", platform: [], notes: "", checklist: [], comments: [] },
    { id: "t3", title: "Hétvégi newsletter előkészítése", brand: "LAAVA", area: "Hírlevél", assignee: "dorka", status: "Teendő", priority: "Fontos", due: "2026-10-10", platform: [], notes: "", checklist: [], comments: [] },
    { id: "t4", title: "Canarias készletet ellenőrizni", brand: "MATÉZZ", area: "Webshop", assignee: "gabor", status: "Várakozik", priority: "Sürgős", due: "2026-10-07", platform: [], notes: "", checklist: [], comments: [] }
  ],
  content: [
    { id:"ct1", title:"Tereré Reel", brand:"MATÉZZ", platform:["Instagram","TikTok"], status:"Szerkesztés", date:"2026-10-08", assignee:"dorka" },
    { id:"ct2", title:"Új karkötő fotó", brand:"LAAVA", platform:["Instagram"], status:"Jóváhagyás", date:"2026-10-09", assignee:"dorka" },
    { id:"ct3", title:"Matcha recept", brand:"Matchai", platform:["Instagram"], status:"Ötlet", date:"2026-10-11", assignee:"anna" }
  ],
  products: [
    { id:"p1", name:"Canarias Serena", brand:"MATÉZZ", sku:"", assignee:"anna", status:"Feltöltés alatt", checklist:{photo:true,description:true,price:true,category:true,attributes:false,seo:false,stock:true,published:false} },
    { id:"p2", name:"Ametiszt karkötő", brand:"LAAVA", sku:"", assignee:"dorka", status:"Fotózás", checklist:{photo:false,description:true,price:true,category:true,attributes:true,seo:false,stock:true,published:false} },
    { id:"p3", name:"Ceremonial Matcha", brand:"Matchai", sku:"", assignee:"gabor", status:"Publikálva", checklist:{photo:true,description:true,price:true,category:true,attributes:true,seo:true,stock:true,published:true} }
  ],
  inbox: [
    { id:"i1", text:"Új MATÉZZ TikTok ötlet", createdAt:new Date().toISOString() },
    { id:"i2", text:"LAAVA gyűrűfotókat újra kell fotózni", createdAt:new Date().toISOString() }
  ],
  notes: [
    { id:"n1", title:"Heti fókusz", body:"- Social media backlog csökkentése\n- Új termékek publikálása\n- Newsletter előkészítése", updatedAt:new Date().toISOString() }
  ]
};

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}
function readData() {
  ensureData();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach(part => {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}
function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const uid = token && sessions.get(token);
  return users.find(u => u.id === uid) || null;
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

app.get("/health", (req,res) => res.json({ ok:true, app:"dotion", version:"0.1.0", port:PORT }));
app.get("/api/auth/users", (req,res) => res.json(users));
app.get("/api/auth/me", (req,res) => res.json({ user:currentUser(req) }));
app.post("/api/auth/login", (req,res) => {
  const user = users.find(u => u.id === req.body.userId);
  const password = String(req.body.password || "");
  const expected = process.env.APP_PASSWORD || "dotion";
  if (!user || password !== expected) return res.status(401).json({ error:"Hibás belépés" });
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, user.id);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  res.json({ user });
});
app.post("/api/auth/logout", (req,res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok:true });
});

app.get("/api/data", requireAuth, (req,res) => res.json({ ...readData(), users, me:req.user }));

const collections = { tasks:"t", content:"ct", products:"p", inbox:"i", notes:"n" };
for (const [name,prefix] of Object.entries(collections)) {
  app.post(`/api/${name}`, requireAuth, (req,res) => {
    const data = readData();
    const item = { id:id(prefix), ...req.body };
    if (name === "inbox") item.createdAt = new Date().toISOString();
    if (name === "notes") item.updatedAt = new Date().toISOString();
    if (name === "tasks") {
      item.comments ||= [];
      item.checklist ||= [];
      item.platform ||= [];
      item.status ||= "Teendő";
      item.priority ||= "Normál";
    }
    data[name].unshift(item);
    writeData(data);
    res.status(201).json(item);
  });
  app.patch(`/api/${name}/:id`, requireAuth, (req,res) => {
    const data = readData();
    const i = data[name].findIndex(x => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error:"not_found" });
    data[name][i] = { ...data[name][i], ...req.body };
    if (name === "notes") data[name][i].updatedAt = new Date().toISOString();
    writeData(data);
    res.json(data[name][i]);
  });
  app.delete(`/api/${name}/:id`, requireAuth, (req,res) => {
    const data = readData();
    data[name] = data[name].filter(x => x.id !== req.params.id);
    writeData(data);
    res.json({ ok:true });
  });
}

app.post("/api/tasks/:id/comments", requireAuth, (req,res) => {
  const data = readData();
  const task = data.tasks.find(x => x.id === req.params.id);
  if (!task) return res.status(404).json({ error:"not_found" });
  const comment = { id:id("cm"), userId:req.user.id, text:String(req.body.text || "").trim(), createdAt:new Date().toISOString() };
  if (!comment.text) return res.status(400).json({ error:"empty_comment" });
  task.comments ||= [];
  task.comments.push(comment);
  writeData(data);
  res.status(201).json(comment);
});

app.use(express.static(path.join(__dirname, "public")));
app.use((req,res) => res.sendFile(path.join(__dirname, "public", "index.html")));

ensureData();
app.listen(PORT, "0.0.0.0", () => console.log(`Dotion listening on :${PORT}`));
