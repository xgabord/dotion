let state={data:null,me:null,view:"home",taskMode:"list",brandFilter:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const api=async(url,opt={})=>{const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(r.status===401){showLogin();throw new Error("unauthorized")}const j=await r.json();if(!r.ok)throw new Error(j.error||"Hiba");return j};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const users=()=>state.data?.users||[];
const uname=id=>users().find(u=>u.id===id)?.name||id||"—";
const fmt=d=>d?new Intl.DateTimeFormat("hu-HU",{month:"short",day:"numeric"}).format(new Date(d+"T12:00:00")):"—";
const today=()=>new Date().toISOString().slice(0,10);
const tag=(text,cls="")=>`<span class="tag ${cls}">${esc(text)}</span>`;
const statusClass=s=>s==="Kész"||s==="Publikálva"?"done":s==="Folyamatban"?"progress":s==="Várakozik"?"wait":"";
const priorityClass=p=>p==="Sürgős"?"urgent":p==="Fontos"?"important":"";

async function boot(){
  const auth=await fetch("/api/auth/me").then(r=>r.json());
  if(!auth.user)return showLogin();
  await load();
  $("#app").classList.remove("hidden");
  $("#login").classList.add("hidden");
  bind();
  render();
}
async function load(){state.data=await api("/api/data");state.me=state.data.me;renderMe()}
function showLogin(){
  $("#app").classList.add("hidden");$("#login").classList.remove("hidden");
  fetch("/api/auth/users").then(r=>r.json()).then(list=>{$("#loginUser").innerHTML=list.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")});
}
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginError").textContent="";try{await api("/api/auth/login",{method:"POST",body:JSON.stringify({userId:$("#loginUser").value,password:$("#loginPassword").value})});await boot()}catch(err){$("#loginError").textContent="Hibás felhasználó vagy jelszó"}});
function renderMe(){if(!state.me)return;$("#meBox").innerHTML=`<div class="avatar">${esc(state.me.avatar)}</div><span>${esc(state.me.name)}</span><button class="logout" id="logoutBtn">Kilépés</button>`;$("#logoutBtn").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()}}
function bind(){
  $$(".nav-item[data-view]").forEach(b=>b.onclick=()=>go(b.dataset.view));
  $$(".filter-brand").forEach(b=>b.onclick=()=>{state.brandFilter=b.dataset.brand;go("tasks")});
  $("#collapseBtn").onclick=()=>$("#sidebar").classList.toggle("collapsed");
  $("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#searchBtn").onclick=()=>go("search");
  $("#quickFab").onclick=toggleQuick;$("#quickTop").onclick=toggleQuick;
  $("#drawerBackdrop").onclick=closeDrawer;
  $("#modalBackdrop").onclick=e=>{if(e.target===e.currentTarget)closeModal()};
  $("#quickMenu").addEventListener("click",e=>{const b=e.target.closest("button");if(b){toggleQuick(false);openCreate(b.dataset.kind)}});
  document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();go("search");setTimeout(()=>$("#globalSearch")?.focus(),20)}if(e.key==="Escape"){closeDrawer();closeModal();toggleQuick(false)}})
}
function go(v){state.view=v;state.brandFilter=v==="tasks"?state.brandFilter:null;$("#sidebar").classList.remove("open");$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("#breadcrumb").textContent=({home:"Kezdőlap",tasks:"Feladatok",content:"Tartalom",products:"Termékek",inbox:"Inbox",notes:"Jegyzetek",search:"Keresés"})[v]||v;render()}
function render(){const fn={home:renderHome,tasks:renderTasks,content:renderContent,products:renderProducts,inbox:renderInbox,notes:renderNotes,search:renderSearch}[state.view]||renderHome;fn()}
function pageHead(title,sub=""){return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="date-label">${new Intl.DateTimeFormat("hu-HU",{year:"numeric",month:"long",day:"numeric"}).format(new Date())}</div></div>`}
function renderHome(){
  const d=state.data,tasks=d.tasks,open=tasks.filter(t=>t.status!=="Kész"),mine=open.filter(t=>t.assignee===state.me.id),social=open.filter(t=>t.area==="Social Media"),urgent=open.filter(t=>t.priority==="Sürgős");
  $("#contentRoot").innerHTML=pageHead("Ma","Ami most számít.")+`
  <div class="stats"><div class="stat"><span>Nyitott feladat</span><strong>${open.length}</strong></div><div class="stat"><span>Social media</span><strong>${social.length}</strong></div><div class="stat"><span>Saját feladat</span><strong>${mine.length}</strong></div><div class="stat"><span>Sürgős</span><strong>${urgent.length}</strong></div></div>
  <div class="section"><div class="section-title"><h2>Saját feladataim</h2><button class="text-btn" onclick="go('tasks')">Összes →</button></div>${taskList(mine.slice(0,6),false)}</div>
  <div class="section"><div class="section-title"><h2>Közelgő tartalom</h2><button class="text-btn" onclick="go('content')">Tartalom →</button></div>${contentList(d.content.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5))}</div>`;
  bindTaskRows();
}
function taskList(tasks,header=true){
  return `<div class="list">${header?`<div class="row row-head"><div>Feladat</div><div>Márka</div><div>Felelős</div><div>Státusz</div><div>Határidő</div></div>`:""}${tasks.map(t=>`<div class="row task-row" data-id="${t.id}"><div class="task-title"><button class="check ${t.status==="Kész"?"done":""}" data-check="${t.id}">${t.status==="Kész"?"✓":""}</button><span class="task-name">${esc(t.title)}</span></div><div>${tag(t.brand||"—")}</div><div class="small muted">${esc(uname(t.assignee))}</div><div>${tag(t.status,statusClass(t.status))}</div><div class="small ${t.priority==="Sürgős"?"":"muted"}">${esc(fmt(t.due))}</div></div>`).join("")||`<div class="muted" style="padding:18px 4px">Nincs feladat.</div>`}</div>`
}
function bindTaskRows(){
  $$(".task-row").forEach(r=>r.onclick=e=>{if(e.target.closest("[data-check]"))return;openTask(r.dataset.id)});
  $$("[data-check]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const t=state.data.tasks.find(x=>x.id===b.dataset.check);await patch("tasks",t.id,{status:t.status==="Kész"?"Teendő":"Kész"});render()})
}
function renderTasks(){
  let list=state.data.tasks.slice();if(state.brandFilter)list=list.filter(t=>t.brand===state.brandFilter);
  $("#contentRoot").innerHTML=pageHead(state.brandFilter?state.brandFilter+" feladatok":"Feladatok","Megnyitom → megcsinálom → kész.")+`
  <div class="view-tabs"><button class="${state.taskMode==="list"?"active":""}" id="listTab">Lista</button><button class="${state.taskMode==="kanban"?"active":""}" id="kanbanTab">Kanban</button><button id="mineTab">Saját feladataim</button>${state.brandFilter?`<button id="clearBrand">Szűrés törlése ×</button>`:""}</div>
  <div id="taskView">${state.taskMode==="list"?taskList(list):kanban(list)}</div>`;
  $("#listTab").onclick=()=>{state.taskMode="list";renderTasks()};$("#kanbanTab").onclick=()=>{state.taskMode="kanban";renderTasks()};
  $("#mineTab").onclick=()=>{$("#taskView").innerHTML=taskList(list.filter(t=>t.assignee===state.me.id));bindTaskRows()};
  if($("#clearBrand"))$("#clearBrand").onclick=()=>{state.brandFilter=null;renderTasks()};bindTaskRows()
}
function kanban(tasks){const sts=["Teendő","Folyamatban","Várakozik","Kész"];return `<div class="kanban">${sts.map(s=>`<div class="kanban-col"><div class="kanban-head"><span>${s.toUpperCase()}</span><span>${tasks.filter(t=>t.status===s).length}</span></div>${tasks.filter(t=>t.status===s).map(t=>`<div class="card task-card" data-id="${t.id}"><div class="card-title">${esc(t.title)}</div><div class="card-meta">${tag(t.brand||"—")}${t.priority!=="Normál"?tag(t.priority,priorityClass(t.priority)):""}<span class="small muted">${esc(fmt(t.due))}</span></div></div>`).join("")}</div>`).join("")}</div>`}
function contentList(items){return `<div class="list"><div class="row row-head"><div>Tartalom</div><div>Márka</div><div>Felelős</div><div>Státusz</div><div>Dátum</div></div>${items.map(x=>`<div class="row"><div class="task-name">${esc(x.title)}</div><div>${tag(x.brand)}</div><div class="small muted">${esc(uname(x.assignee))}</div><div>${tag(x.status,statusClass(x.status))}</div><div class="small muted">${esc(fmt(x.date))}</div></div>`).join("")}</div>`}
function renderContent(){
  $("#contentRoot").innerHTML=pageHead("Tartalom","Social media központ és publikálási terv.")+`<div class="view-tabs"><button class="active" id="contentListTab">Lista</button><button id="calendarTab">Naptár</button></div><div id="contentView">${contentList(state.data.content)}</div>`;
  $("#contentListTab").onclick=()=>{$("#contentView").innerHTML=contentList(state.data.content)};
  $("#calendarTab").onclick=()=>{$("#contentView").innerHTML=calendarView(state.data.content)}
}
function calendarView(items){const start=new Date();start.setDate(start.getDate()-start.getDay()+1);return `<div class="calendar">${Array.from({length:21},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.toISOString().slice(0,10);return `<div class="cal-cell"><div class="cal-day">${new Intl.DateTimeFormat("hu-HU",{weekday:"short",month:"short",day:"numeric"}).format(d)}</div>${items.filter(x=>x.date===iso).map(x=>`<div class="cal-item"><b>${esc(x.brand)}</b><br>${esc(x.title)}</div>`).join("")}</div>`}).join("")}</div>`}
function renderProducts(){
 $("#contentRoot").innerHTML=pageHead("Termékek","Termékfeltöltések és publikálási állapot.")+`<div class="grid-cards">${state.data.products.map(p=>{const vals=Object.values(p.checklist||{}),done=vals.filter(Boolean).length,pc=vals.length?Math.round(done/vals.length*100):0;return `<div class="product-card"><div class="small muted">${esc(p.brand)}</div><h3>${esc(p.name)}</h3><div>${tag(p.status,statusClass(p.status))}</div><div class="progressbar"><i style="width:${pc}%"></i></div><div class="small muted">${done}/${vals.length} lépés kész · ${esc(uname(p.assignee))}</div><div class="checklist-mini">${Object.entries(p.checklist||{}).map(([k,v])=>`<span>${v?"✓":"□"} ${({photo:"Fotó",description:"Leírás",price:"Ár",category:"Kategória",attributes:"Attribútumok",seo:"SEO",stock:"Készlet",published:"Publikálva"})[k]||k}</span>`).join("")}</div></div>`}).join("")}</div>`
}
function renderInbox(){
 $("#contentRoot").innerHTML=pageHead("Inbox","Gyors gyűjtőhely a még nem kategorizált dolgoknak.")+`<div class="list">${state.data.inbox.map(i=>`<div class="inbox-item"><span>•</span><span class="text">${esc(i.text)}</span><button class="text-btn inbox-task" data-id="${i.id}">Feladattá</button><button class="text-btn inbox-del" data-id="${i.id}">×</button></div>`).join("")}</div>`;
 $$(".inbox-task").forEach(b=>b.onclick=async()=>{const it=state.data.inbox.find(x=>x.id===b.dataset.id);await api("/api/tasks",{method:"POST",body:JSON.stringify({title:it.text,brand:"MATÉZZ",area:"Egyéb",assignee:state.me.id,status:"Teendő",priority:"Normál",due:"",platform:[],notes:"",checklist:[],comments:[]})});await del("inbox",it.id);await load();go("tasks")});
 $$(".inbox-del").forEach(b=>b.onclick=async()=>{await del("inbox",b.dataset.id);render()})
}
function renderNotes(){
 $("#contentRoot").innerHTML=pageHead("Jegyzetek","Egyszerű belső dokumentumoldalak.")+`<div class="grid-cards">${state.data.notes.map(n=>`<div class="note-card"><h3>${esc(n.title)}</h3><div class="muted small" style="white-space:pre-wrap">${esc(n.body)}</div></div>`).join("")}</div>`
}
function renderSearch(){
 $("#contentRoot").innerHTML=pageHead("Keresés","Feladatok, tartalmak, termékek és jegyzetek.")+`<input id="globalSearch" class="search-box" placeholder="Keresés…"><div id="searchResults" class="search-results"></div>`;
 $("#globalSearch").oninput=e=>doSearch(e.target.value)
}
function doSearch(q){q=q.trim().toLowerCase();if(!q)return $("#searchResults").innerHTML="";const sets=[["Feladatok",state.data.tasks,"title"],["Tartalom",state.data.content,"title"],["Termékek",state.data.products,"name"],["Jegyzetek",state.data.notes,"title"]];$("#searchResults").innerHTML=sets.map(([name,list,key])=>{const hits=list.filter(x=>JSON.stringify(x).toLowerCase().includes(q));return hits.length?`<div class="search-group"><div class="section-title"><h2>${name}</h2></div>${hits.map(x=>`<div class="search-hit">${esc(x[key])}<div class="small muted">${esc(x.brand||"")}</div></div>`).join("")}</div>`:""}).join("")||`<div class="muted">Nincs találat.</div>`}
function openTask(id){
 const t=state.data.tasks.find(x=>x.id===id);if(!t)return;
 $("#drawerBackdrop").classList.remove("hidden");$("#drawer").classList.remove("hidden");
 $("#drawer").innerHTML=`<button class="icon-btn drawer-close" id="drawerClose">×</button><h2 contenteditable="true" id="taskTitle">${esc(t.title)}</h2>
 <div class="props"><label>Márka</label><select class="field" id="taskBrand">${["LAAVA","MATÉZZ","Matchai"].map(x=>`<option ${x===t.brand?"selected":""}>${x}</option>`).join("")}</select>
 <label>Státusz</label><select class="field" id="taskStatus">${["Teendő","Folyamatban","Várakozik","Kész"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`).join("")}</select>
 <label>Prioritás</label><select class="field" id="taskPriority">${["Normál","Fontos","Sürgős"].map(x=>`<option ${x===t.priority?"selected":""}>${x}</option>`).join("")}</select>
 <label>Határidő</label><input class="field" id="taskDue" type="date" value="${esc(t.due||"")}">
 <label>Felelős</label><select class="field" id="taskAssignee">${users().map(u=>`<option value="${u.id}" ${u.id===t.assignee?"selected":""}>${esc(u.name)}</option>`).join("")}</select>
 <label>Terület</label><input class="field" id="taskArea" value="${esc(t.area||"")}"></div>
 <div class="drawer-section"><h3>MEGJEGYZÉS</h3><textarea class="field" id="taskNotes">${esc(t.notes||"")}</textarea></div>
 <div class="drawer-section"><h3>CHECKLIST</h3><div id="drawerChecklist">${(t.checklist||[]).map(c=>`<label class="drawer-check"><input type="checkbox" data-cid="${c.id}" ${c.done?"checked":""}><span>${esc(c.text)}</span></label>`).join("")||'<div class="muted small">Nincs checklist.</div>'}</div></div>
 <div class="drawer-section"><h3>KOMMENTEK</h3><div id="comments">${(t.comments||[]).map(c=>`<div class="comment"><strong>${esc(uname(c.userId))}</strong><p>${esc(c.text)}</p></div>`).join("")}</div><form id="commentForm" class="comment-form"><input class="field" id="commentText" placeholder="Komment…"><button class="primary compact">Küldés</button></form></div>`;
 $("#drawerClose").onclick=closeDrawer;
 ["taskBrand","taskStatus","taskPriority","taskDue","taskAssignee","taskArea","taskNotes"].forEach(key=>$("#"+key).onchange=saveTaskDrawer);
 $("#taskTitle").onblur=saveTaskDrawer;
 $$("[data-cid]").forEach(c=>c.onchange=async()=>{const fresh=state.data.tasks.find(x=>x.id===id);const cl=fresh.checklist.map(x=>x.id===c.dataset.cid?{...x,done:c.checked}:x);await patch("tasks",id,{checklist:cl})});
 $("#commentForm").onsubmit=async e=>{e.preventDefault();const text=$("#commentText").value.trim();if(!text)return;await api(`/api/tasks/${id}/comments`,{method:"POST",body:JSON.stringify({text})});await load();openTask(id)};
 async function saveTaskDrawer(){await patch("tasks",id,{title:$("#taskTitle").textContent.trim(),brand:$("#taskBrand").value,status:$("#taskStatus").value,priority:$("#taskPriority").value,due:$("#taskDue").value,assignee:$("#taskAssignee").value,area:$("#taskArea").value,notes:$("#taskNotes").value});render()}
}
function closeDrawer(){$("#drawer").classList.add("hidden");$("#drawerBackdrop").classList.add("hidden")}
function toggleQuick(force){const q=$("#quickMenu");const show=force===undefined?q.classList.contains("hidden"):force;q.classList.toggle("hidden",!show)}
function openCreate(kind){
 const titles={task:"Új feladat",content:"Új tartalom",idea:"Új tartalomötlet",note:"Új jegyzet"};$("#modalBackdrop").classList.remove("hidden");
 const commonBrands=`<select id="mBrand"><option>LAAVA</option><option>MATÉZZ</option><option>Matchai</option></select>`;
 if(kind==="note")$("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="Cím" required><textarea id="mBody" placeholder="Jegyzet"></textarea><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 else if(kind==="content"||kind==="idea")$("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="${kind==="idea"?"Ötlet":"Tartalom neve"}" required>${commonBrands}<input id="mPlatform" placeholder="Platform (pl. Instagram, TikTok)"><input id="mDate" type="date"><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 else $("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="Feladat neve" required>${commonBrands}<select id="mArea"><option>Social Media</option><option>Termékfeltöltés</option><option>Webshop</option><option>Hírlevél</option><option>Kampány</option><option>Beszerzés</option><option>Ügyfélszolgálat</option><option>Admin</option><option>Fotó / videó</option><option>Egyéb</option></select><select id="mAssignee">${users().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select><select id="mPriority"><option>Normál</option><option>Fontos</option><option>Sürgős</option></select><input id="mDue" type="date"><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 $("#cancelModal").onclick=closeModal;$("#createForm").onsubmit=async e=>{e.preventDefault();
   if(kind==="note")await api("/api/notes",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,body:$("#mBody").value})});
   else if(kind==="content"||kind==="idea")await api("/api/content",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,brand:$("#mBrand").value,platform:$("#mPlatform").value.split(",").map(x=>x.trim()).filter(Boolean),status:kind==="idea"?"Ötlet":"Előkészítés",date:$("#mDate").value,assignee:state.me.id})});
   else await api("/api/tasks",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,brand:$("#mBrand").value,area:$("#mArea").value,assignee:$("#mAssignee").value,status:"Teendő",priority:$("#mPriority").value,due:$("#mDue").value,platform:[],notes:"",checklist:[],comments:[]})});
   closeModal();await load();go(kind==="note"?"notes":kind==="task"?"tasks":"content")
 }}
function closeModal(){$("#modalBackdrop").classList.add("hidden")}
async function patch(col,id,body){const item=await api(`/api/${col}/${id}`,{method:"PATCH",body:JSON.stringify(body)});const i=state.data[col].findIndex(x=>x.id===id);if(i>-1)state.data[col][i]=item;return item}
async function del(col,id){await api(`/api/${col}/${id}`,{method:"DELETE"});state.data[col]=state.data[col].filter(x=>x.id!==id)}
document.addEventListener("click",e=>{const c=e.target.closest(".task-card");if(c)openTask(c.dataset.id)});
boot();
