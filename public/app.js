const APP_VERSION="0.3.4";
let state={data:null,me:null,view:"home",taskMode:"list",brandFilter:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const api=async(url,opt={})=>{const r=await fetch(url,{cache:"no-store",headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});if(r.status===401){showLogin();throw new Error("unauthorized")}if(r.status===204)return null;const text=await r.text();const j=text?JSON.parse(text):{};if(!r.ok)throw new Error(j.error||"Hiba");return j};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const users=()=>state.data?.users||[];
const me=()=>state.me||{};
const isAdmin=()=>me().role==="admin";
const uname=id=>users().find(u=>u.id===id)?.name||id||"—";
const fmt=d=>d?new Intl.DateTimeFormat("hu-HU",{month:"short",day:"numeric"}).format(new Date(d+"T12:00:00")):"—";
const statusClass=s=>s==="Kész"||s==="Publikálva"?"done":s==="Folyamatban"?"progress":s==="Várakozik"?"wait":"";
const priorityClass=p=>p==="Sürgős"?"urgent":p==="Fontos"?"important":"";
const brandSites={LAAVA:"https://laava.hu",MATÉZZ:"https://matezz.hu",Matchai:"https://matchai.hu",Közös:""};
const brandIcon=brand=>{const site=brandSites[brand]||"";if(!site)return `<span class="brand-generic">◆</span>`;const domain=site.replace("https://","").replace("http://","");return `<img class="brand-favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="">`};
const tag=(text,cls="")=>`<span class="tag ${cls}">${esc(text)}</span>`;
const preview=(text,max=88)=>{const s=String(text||"").replace(/\s+/g," ").trim();return s.length>max?s.slice(0,max-1).trimEnd()+"…":s};

async function boot(){
  const auth=await fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json());
  if(!auth.user)return showLogin();
  await load();
  $("#app").classList.remove("hidden");
  $("#login").classList.add("hidden");
  bind();
  render();
}
async function load(){state.data=await api("/api/data");state.me=state.data.me;renderMe();renderBrandNav()}
function showLogin(){
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#loginError").textContent="";
  fetch("/api/auth/users",{cache:"no-store"})
    .then(r=>r.json())
    .then(list=>{
      $("#loginProfiles").innerHTML=list.map(u=>`<button class="profile-tile" type="button" data-login-user="${u.id}"><span class="profile-avatar">${esc(u.avatar||u.name?.[0]||"?")}</span><span class="profile-name">${esc(u.name)}</span></button>`).join("");
      $$("[data-login-user]").forEach(btn=>btn.onclick=async()=>{
        $("#loginError").textContent="";
        $$(".profile-tile").forEach(x=>x.disabled=true);
        try{
          await api("/api/auth/login",{method:"POST",body:JSON.stringify({userId:btn.dataset.loginUser})});
          await boot();
        }catch(err){
          $("#loginError").textContent="Sikertelen belépés";
          $$(".profile-tile").forEach(x=>x.disabled=false);
        }
      });
    })
    .catch(()=>{$("#loginError").textContent="A profilok nem tölthetők be.";});
}
function renderMe(){if(!state.me)return;$("#meBox").innerHTML=`<div class="avatar">${esc(state.me.avatar)}</div><span><b>${esc(state.me.name)}</b><small>${isAdmin()?"Admin":"Felhasználó"} · v${APP_VERSION}</small></span><button class="logout" id="logoutBtn">Kilépés</button>`;$("#logoutBtn").onclick=async()=>{await api("/api/auth/logout",{method:"POST"});location.reload()}}
function renderBrandNav(){
  $$(".filter-brand").forEach(b=>{const brand=b.dataset.brand;const icon=b.querySelector(".brand-nav-icon");if(icon)icon.innerHTML=brandIcon(brand)})
}
function bind(){
  $$(".nav-item[data-view]").forEach(b=>b.onclick=()=>go(b.dataset.view));
  $(".filter-brand").forEach(b=>b.onclick=()=>{state.brandFilter=b.dataset.brand;go("tasks")});
  $("#collapseBtn").onclick=()=>{const shell=$("#app");shell.classList.toggle("sidebar-collapsed");localStorage.setItem("dotion-sidebar-collapsed",shell.classList.contains("sidebar-collapsed")?"1":"0")};
  $("#mobileSidebarClose").onclick=()=>$("#sidebar").classList.remove("open");
  $("#mobileSidebarBackdrop").onclick=()=>$("#sidebar").classList.remove("open");
  if(localStorage.getItem("dotion-sidebar-collapsed")==="1")$("#app").classList.add("sidebar-collapsed");
  $("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#searchBtn").onclick=()=>go("search");
  $("#quickFab").onclick=toggleQuick;$("#quickTop").onclick=toggleQuick;
  $("#drawerBackdrop").onclick=closeDrawer;
  $("#modalBackdrop").onclick=e=>{if(e.target===e.currentTarget)closeModal()};
  $("#quickMenu").addEventListener("click",e=>{const b=e.target.closest("button");if(b){toggleQuick(false);openCreate(b.dataset.kind)}});
  document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();go("search");setTimeout(()=>$("#globalSearch")?.focus(),20)}if(e.key==="Escape"){closeDrawer();closeModal();toggleQuick(false)}})
}
function go(v){state.view=v;state.brandFilter=v==="tasks"?state.brandFilter:null;$("#sidebar").classList.remove("open");$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===v));$("#breadcrumb").textContent=({home:"Kezdőlap",tasks:"Feladatok",content:"Tartalom",products:"Termékek",inbox:"Inbox",notes:"Jegyzetek",search:"Keresés"})[v]||v;render()}
function render(){
  const fn={home:renderHome,tasks:renderTasks,content:renderContent,products:renderProducts,inbox:renderInbox,notes:renderNotes,search:renderSearch}[state.view]||renderHome;
  try{fn()}catch(error){
    console.error("Dotion render error",error);
    const root=$("#contentRoot");
    if(root)root.innerHTML='<div class="render-error"><strong>A nézet betöltése közben hiba történt.</strong><span>'+esc(error?.message||String(error))+'</span><button class="secondary" onclick="location.reload()">Újratöltés</button></div>';
  }
}
function pageHead(title,sub=""){return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="date-label">${new Intl.DateTimeFormat("hu-HU",{year:"numeric",month:"long",day:"numeric"}).format(new Date())}</div></div>`}
function visibleTasks(){return Array.isArray(state.data?.tasks)?state.data.tasks:[]}
function collection(name){return Array.isArray(state.data?.[name])?state.data[name]:[]}
function renderHome(){
  const d=state.data||{},tasks=visibleTasks().filter(Boolean),open=tasks.filter(t=>t.status!=="Kész"),mine=open.filter(t=>t.assignee===state.me?.id),social=open.filter(t=>t.area==="Social Media"),urgent=open.filter(t=>t.priority==="Sürgős");
  const stats=isAdmin()?`<div class="stats"><div class="stat"><span>Nyitott feladat</span><strong>${open.length}</strong></div><div class="stat"><span>Social media</span><strong>${social.length}</strong></div><div class="stat"><span>Saját feladat</span><strong>${mine.length}</strong></div><div class="stat"><span>Sürgős</span><strong>${urgent.length}</strong></div></div>`:`<div class="stats member-stats"><div class="stat"><span>Nyitott feladatom</span><strong>${open.length}</strong></div><div class="stat"><span>Folyamatban</span><strong>${open.filter(t=>t.status==="Folyamatban").length}</strong></div><div class="stat"><span>Határidős</span><strong>${open.filter(t=>t.due).length}</strong></div><div class="stat"><span>Sürgős</span><strong>${urgent.length}</strong></div></div>`;
  $("#contentRoot").innerHTML=pageHead("Ma",isAdmin()?"Saját és csapatfeladatok egy helyen.":"A saját feladataid, sallang nélkül.")+stats+
  `<div class="section"><div class="section-title"><h2>Saját feladataim</h2><button class="text-btn" onclick="go('tasks')">Összes →</button></div>${taskList(mine,false)}</div>`+
  (isAdmin()?teamOverview(tasks):"")+
  `<div class="section"><div class="section-title"><h2>Közelgő tartalom</h2><button class="text-btn" onclick="go('content')">Tartalom →</button></div>${contentList(collection("content").filter(Boolean).slice().sort((a,b)=>(a?.date||"").localeCompare(b?.date||"")).slice(0,5))}</div>`;
  bindInlineEditors();
  bindContentEditors();
}
function teamOverview(tasks){
  const people=[...users(),{id:null,name:"Nincs felelős",avatar:"—"}];
  const cards=people.map(u=>{const all=(tasks||[]).filter(Boolean).filter(t=>u.id?t.assignee===u.id:!t.assignee),open=all.filter(t=>t.status!=="Kész"),done=all.filter(t=>t.status==="Kész"),progress=all.filter(t=>t.status==="Folyamatban");return `<div class="team-card"><div class="team-card-head"><div class="avatar">${esc(u.avatar)}</div><div><strong>${esc(u.name)}</strong><span>${open.length} nyitott · ${done.length} kész</span></div></div><div class="team-progress"><i style="width:${all.length?Math.round(done.length/all.length*100):0}%"></i></div><div class="team-status"><span>${tag(progress.length+" folyamatban","progress")}</span><span>${tag(open.filter(t=>t.priority==="Sürgős").length+" sürgős","urgent")}</span></div><div class="team-mini-list">${open.slice(0,4).map(t=>`<button class="mini-task" data-open-task="${t.id}"><span>${esc(preview(t.title,72))}</span>${tag(t.status,statusClass(t.status))}</button>`).join("")||'<span class="muted small">Nincs nyitott feladat.</span>'}</div></div>`}).join("");
  return `<div class="section"><div class="section-title"><h2>Csapat feladatai</h2><span class="small muted">Kiosztás és aktuális állapot</span></div><div class="team-grid">${cards}</div></div>`;
}
function taskList(tasks,header=true){
  const head=header?`<div class="task-grid row-head"><div>Feladat</div><div>Márka</div><div>Felelős</div><div>Státusz</div><div>Határidő</div><div></div></div>`:"";
  const rows=(tasks||[]).filter(Boolean).map(t=>`<div class="task-grid task-row" data-id="${t.id}"><div class="task-title-cell"><button class="check ${t.status==="Kész"?"done":""}" data-check="${t.id}">${t.status==="Kész"?"✓":""}</button><input class="inline-title" data-inline="title" data-id="${t.id}" value="${esc(t.title)}" aria-label="Feladat neve"></div><div><select class="inline-select brand-select" data-inline="brand" data-id="${t.id}">${["LAAVA","MATÉZZ","Matchai","Közös"].map(x=>`<option ${x===t.brand?"selected":""}>${x}</option>`).join("")}</select></div><div>${isAdmin()?`<select class="inline-select" data-inline="assignee" data-id="${t.id}">${`<option value="" ${!t.assignee?"selected":""}>Nincs felelős</option>`+users().map(u=>`<option value="${u.id}" ${u.id===t.assignee?"selected":""}>${esc(u.name)}</option>`).join("")}</select>`:`<span class="inline-static">${esc(uname(t.assignee))}</span>`}</div><div><select class="inline-select status-select ${statusClass(t.status)}" data-inline="status" data-id="${t.id}">${["Teendő","Folyamatban","Várakozik","Kész"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`).join("")}</select></div><div><input class="inline-date" type="date" data-inline="due" data-id="${t.id}" value="${esc(t.due||"")}"></div><div><button class="row-open" data-open-task="${t.id}" title="Megnyitás">›</button></div></div>`).join("");
  return `<div class="task-table">${head}${rows||'<div class="empty-row">Nincs feladat.</div>'}<button class="add-row" data-add-task>+ Új feladat</button></div>`;
}
function bindInlineEditors(){
  $$('[data-inline]').forEach(el=>{const save=async()=>{const id=el.dataset.id,key=el.dataset.inline;let value=el.value;if(key==="title")value=value.trim();if(!value&&key==="title")return;await patch("tasks",id,{[key]:value});if(key==="status"){el.className="inline-select status-select "+statusClass(value)} };el.onchange=save;if(el.dataset.inline==="title"){el.onblur=save;el.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();el.blur()}}}});
  $$('[data-check]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const t=visibleTasks().find(x=>x.id===b.dataset.check);await patch("tasks",t.id,{status:t.status==="Kész"?"Teendő":"Kész"});render()});
  $$('[data-open-task]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTask(b.dataset.openTask)});
  $$('[data-add-task]').forEach(b=>b.onclick=()=>openCreate("task"));
}
function renderTasks(){
  let list=visibleTasks().slice();if(state.brandFilter)list=list.filter(t=>t.brand===state.brandFilter);
  $("#contentRoot").innerHTML=pageHead(state.brandFilter?state.brandFilter+" feladatok":"Feladatok",isAdmin()?"Kattints és szerkessz közvetlenül a listában.":"Csak a saját feladataid láthatók.")+`<div class="view-tabs"><button class="${state.taskMode==="list"?"active":""}" id="listTab">Lista</button><button class="${state.taskMode==="kanban"?"active":""}" id="kanbanTab">Kanban</button>${isAdmin()?'<button id="mineTab">Saját feladataim</button>':""}${state.brandFilter?'<button id="clearBrand">Szűrés törlése ×</button>':""}</div><div id="taskView">${state.taskMode==="list"?taskList(list):kanban(list)}</div>`;
  $("#listTab").onclick=()=>{state.taskMode="list";renderTasks()};$("#kanbanTab").onclick=()=>{state.taskMode="kanban";renderTasks()};
  if($("#mineTab"))$("#mineTab").onclick=()=>{$("#taskView").innerHTML=taskList(list.filter(t=>t.assignee===state.me.id));bindInlineEditors()};
  if($("#clearBrand"))$("#clearBrand").onclick=()=>{state.brandFilter=null;renderTasks()};bindInlineEditors()
}
function kanban(tasks){const sts=["Teendő","Folyamatban","Várakozik","Kész"];return `<div class="kanban">${sts.map(s=>`<div class="kanban-col"><div class="kanban-head"><span>${s.toUpperCase()}</span><span>${tasks.filter(t=>t.status===s).length}</span></div>${tasks.filter(t=>t.status===s).map(t=>`<div class="card task-card" data-open-task="${t.id}"><div class="card-title" title="${esc(t.title)}">${esc(preview(t.title,90))}</div><div class="card-meta"><span class="brand-chip">${brandIcon(t.brand)}${esc(t.brand||"—")}</span>${t.priority!=="Normál"?tag(t.priority,priorityClass(t.priority)):""}<span class="small muted">${esc(fmt(t.due))}</span></div></div>`).join("")}<button class="kanban-add" data-add-task>+ Új</button></div>`).join("")}</div>`}
function contentList(items){items=Array.isArray(items)?items.filter(Boolean):[];return `<div class="content-table"><div class="content-grid row-head"><div>Tartalom</div><div>Márka</div><div>Felelős</div><div>Státusz</div><div>Dátum</div></div>${items.map(x=>`<div class="content-grid"><div><input class="inline-title" data-content-id="${x.id}" data-content-key="title" value="${esc(x.title)}"></div><div><select class="inline-select" data-content-id="${x.id}" data-content-key="brand">${["LAAVA","MATÉZZ","Matchai","Közös"].map(v=>`<option ${v===x.brand?"selected":""}>${v}</option>`).join("")}</select></div><div><select class="inline-select" data-content-id="${x.id}" data-content-key="assignee">${users().map(u=>`<option value="${u.id}" ${u.id===x.assignee?"selected":""}>${esc(u.name)}</option>`).join("")}</select></div><div><select class="inline-select" data-content-id="${x.id}" data-content-key="status">${["Ötlet","Előkészítés","Fotózás / videózás","Szerkesztés","Jóváhagyás","Ütemezve","Publikálva"].map(v=>`<option ${v===x.status?"selected":""}>${v}</option>`).join("")}</select></div><div><input class="inline-date" type="date" data-content-id="${x.id}" data-content-key="date" value="${esc(x.date||"")}"></div></div>`).join("")}<button class="add-row" data-add-content>+ Új tartalom</button></div>`}
function bindContentEditors(){$$('[data-content-id]').forEach(el=>{const save=async()=>{const id=el.dataset.contentId,key=el.dataset.contentKey;await patch("content",id,{[key]:el.value})};el.onchange=save;if(el.dataset.contentKey==="title")el.onblur=save});$$('[data-add-content]').forEach(b=>b.onclick=()=>openCreate("content"))}
function renderContent(){$("#contentRoot").innerHTML=pageHead("Tartalom","Social media központ és publikálási terv.")+`<div class="view-tabs"><button class="active" id="contentListTab">Lista</button><button id="calendarTab">Naptár</button></div><div id="contentView">${contentList(collection("content"))}</div>`;bindContentEditors();$("#contentListTab").onclick=()=>{$("#contentView").innerHTML=contentList(collection("content"));bindContentEditors()};$("#calendarTab").onclick=()=>{$("#contentView").innerHTML=calendarView(collection("content"))}}
function calendarView(items){const start=new Date();start.setDate(start.getDate()-start.getDay()+1);return `<div class="calendar">${Array.from({length:21},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const iso=d.toISOString().slice(0,10);return `<div class="cal-cell"><div class="cal-day">${new Intl.DateTimeFormat("hu-HU",{weekday:"short",month:"short",day:"numeric"}).format(d)}</div>${items.filter(x=>x.date===iso).map(x=>`<div class="cal-item"><b>${esc(x.brand)}</b><br>${esc(x.title)}</div>`).join("")}</div>`}).join("")}</div>`}
function renderProducts(){
 $("#contentRoot").innerHTML=pageHead("Termékek","Kattintással módosítható feltöltési checklist.")+`<div class="grid-cards">${collection("products").map(p=>{const vals=Object.values(p.checklist||{}),done=vals.filter(Boolean).length,pc=vals.length?Math.round(done/vals.length*100):0;return `<div class="product-card" data-product="${p.id}"><div class="product-brand">${brandIcon(p.brand)}${esc(p.brand)}</div><input class="product-title" data-product-id="${p.id}" data-product-key="name" value="${esc(p.name)}"><div class="product-controls"><select class="inline-select" data-product-id="${p.id}" data-product-key="status">${["Új termék","Adatokra vár","Fotózás","Feltöltés alatt","Ellenőrzés","Publikálva"].map(v=>`<option ${v===p.status?"selected":""}>${v}</option>`).join("")}</select><select class="inline-select" data-product-id="${p.id}" data-product-key="assignee">${users().map(u=>`<option value="${u.id}" ${u.id===p.assignee?"selected":""}>${esc(u.name)}</option>`).join("")}</select></div><div class="progressbar"><i style="width:${pc}%"></i></div><div class="small muted">${done}/${vals.length} lépés kész</div><div class="checklist-mini">${Object.entries(p.checklist||{}).map(([k,v])=>`<button class="mini-check ${v?"checked":""}" data-product-check="${p.id}" data-check-key="${k}">${v?"✓":"□"} ${({photo:"Fotó",description:"Leírás",price:"Ár",category:"Kategória",attributes:"Attribútumok",seo:"SEO",stock:"Készlet",published:"Publikálva"})[k]||k}</button>`).join("")}</div></div>`}).join("")}</div>`;
 $$('[data-product-id]').forEach(el=>{const save=async()=>patch("products",el.dataset.productId,{[el.dataset.productKey]:el.value});el.onchange=save;if(el.dataset.productKey==="name")el.onblur=save});
 $$('[data-product-check]').forEach(b=>b.onclick=async()=>{const p=collection("products").find(x=>x.id===b.dataset.productCheck);const checklist={...p.checklist,[b.dataset.checkKey]:!p.checklist[b.dataset.checkKey]};await patch("products",p.id,{checklist});renderProducts()})
}
function renderInbox(){$("#contentRoot").innerHTML=pageHead("Inbox","Gyors gyűjtőhely a még nem kategorizált dolgoknak.")+`<div class="list">${collection("inbox").map(i=>`<div class="inbox-item"><span>•</span><input class="inline-title inbox-edit" data-inbox-id="${i.id}" value="${esc(i.text)}"><button class="text-btn inbox-task" data-id="${i.id}">Feladattá</button><button class="text-btn inbox-del" data-id="${i.id}">×</button></div>`).join("")}<button class="add-row" id="addInbox">+ Gyors bejegyzés</button></div>`;$$('[data-inbox-id]').forEach(el=>el.onblur=async()=>patch("inbox",el.dataset.inboxId,{text:el.value.trim()}));$$('.inbox-task').forEach(b=>b.onclick=async()=>{const it=collection("inbox").find(x=>x.id===b.dataset.id);await api("/api/tasks",{method:"POST",body:JSON.stringify({title:it.text,brand:"MATÉZZ",area:"Egyéb",assignee:state.me.id,status:"Teendő",priority:"Normál",due:"",platform:[],notes:"",checklist:[],comments:[]})});await del("inbox",it.id);await load();go("tasks")});$$('.inbox-del').forEach(b=>b.onclick=async()=>{await del("inbox",b.dataset.id);render()});$("#addInbox").onclick=async()=>{await api("/api/inbox",{method:"POST",body:JSON.stringify({text:"Új bejegyzés"})});await load();renderInbox()}}
function renderNotes(){$("#contentRoot").innerHTML=pageHead("Jegyzetek","Egyszerű, azonnal szerkeszthető belső oldalak.")+`<div class="grid-cards notes-grid">${collection("notes").map(n=>`<div class="note-card"><input class="note-title" data-note-id="${n.id}" data-note-key="title" value="${esc(n.title)}"><textarea class="note-body" data-note-id="${n.id}" data-note-key="body">${esc(n.body)}</textarea></div>`).join("")}<button class="new-note-card" id="newNote">+ Új jegyzet</button></div>`;$$('[data-note-id]').forEach(el=>el.onblur=async()=>patch("notes",el.dataset.noteId,{[el.dataset.noteKey]:el.value}));$("#newNote").onclick=()=>openCreate("note")}
function renderSearch(){$("#contentRoot").innerHTML=pageHead("Keresés","Feladatok, tartalmak, termékek és jegyzetek.")+`<input id="globalSearch" class="search-box" placeholder="Keresés…"><div id="searchResults" class="search-results"></div>`;$("#globalSearch").oninput=e=>doSearch(e.target.value)}
function doSearch(q){q=q.trim().toLowerCase();if(!q)return $("#searchResults").innerHTML="";const sets=[["Feladatok",visibleTasks(),"title"],["Tartalom",collection("content"),"title"],["Termékek",collection("products"),"name"],["Jegyzetek",collection("notes"),"title"]];$("#searchResults").innerHTML=sets.map(([name,list,key])=>{const hits=list.filter(x=>JSON.stringify(x).toLowerCase().includes(q));return hits.length?`<div class="search-group"><div class="section-title"><h2>${name}</h2></div>${hits.map(x=>`<div class="search-hit" title="${esc(x[key])}">${esc(preview(x[key],100))}<div class="small muted">${esc(x.brand||"")}</div></div>`).join("")}</div>`:""}).join("")||`<div class="muted">Nincs találat.</div>`}
function openTask(id){
 const t=visibleTasks().find(x=>x.id===id);if(!t)return;
 $("#drawerBackdrop").classList.remove("hidden");$("#drawer").classList.remove("hidden");
 $("#drawer").innerHTML=`<button class="icon-btn drawer-close" id="drawerClose">×</button><input class="drawer-title" id="taskTitle" value="${esc(t.title)}"><div class="props"><label>Márka</label><select class="field" id="taskBrand">${["LAAVA","MATÉZZ","Matchai","Közös"].map(x=>`<option ${x===t.brand?"selected":""}>${x}</option>`).join("")}</select><label>Státusz</label><select class="field" id="taskStatus">${["Teendő","Folyamatban","Várakozik","Kész"].map(x=>`<option ${x===t.status?"selected":""}>${x}</option>`).join("")}</select><label>Prioritás</label><select class="field" id="taskPriority">${["Normál","Fontos","Sürgős"].map(x=>`<option ${x===t.priority?"selected":""}>${x}</option>`).join("")}</select><label>Határidő</label><input class="field" id="taskDue" type="date" value="${esc(t.due||"")}"><label>Felelős</label>${isAdmin()?`<select class="field" id="taskAssignee">${`<option value="" ${!t.assignee?"selected":""}>Nincs felelős</option>`+users().map(u=>`<option value="${u.id}" ${u.id===t.assignee?"selected":""}>${esc(u.name)}</option>`).join("")}</select>`:`<div class="field readonly">${esc(uname(t.assignee))}</div>`}<label>Terület</label><input class="field" id="taskArea" value="${esc(t.area||"")}"></div><div class="drawer-section"><h3>MEGJEGYZÉS</h3><textarea class="field" id="taskNotes">${esc(t.notes||"")}</textarea></div><div class="drawer-section"><h3>NOTION METAADATOK</h3><div class="notion-meta">
  ${t.project?`<div><span>Projekt</span><strong>${esc(t.project)}</strong></div>`:""}
  ${(t.tags||[]).length?`<div><span>Címkék</span><strong>${(t.tags||[]).map(x=>esc(x)).join(", ")}</strong></div>`:""}
  ${t.completedOn?`<div><span>Elkészült</span><strong>${esc(fmt(t.completedOn))}</strong></div>`:""}
  ${t.notionSource?`<div><span>Forrás</span><strong>${esc(t.notionSource)}</strong></div>`:""}
  ${t.notionAssignee && !t.assignee?`<div><span>Eredeti felelős</span><strong>${esc(t.notionAssignee)}</strong></div>`:""}
</div></div><div class="drawer-section"><h3>CHECKLIST</h3><div id="drawerChecklist">${(t.checklist||[]).map(c=>`<label class="drawer-check"><input type="checkbox" data-cid="${c.id}" ${c.done?"checked":""}><span>${esc(c.text)}</span></label>`).join("")||'<div class="muted small">Nincs checklist.</div>'}</div><button class="text-btn" id="addChecklist">+ Checklist elem</button></div><div class="drawer-section"><h3>KOMMENTEK</h3><div id="comments">${(t.comments||[]).map(c=>`<div class="comment"><strong>${esc(uname(c.userId))}</strong><p>${esc(c.text)}</p></div>`).join("")}</div><form id="commentForm" class="comment-form"><input class="field" id="commentText" placeholder="Komment…"><button class="primary compact">Küldés</button></form></div>`;
 $("#drawerClose").onclick=closeDrawer;
 ["taskBrand","taskStatus","taskPriority","taskDue","taskArea","taskNotes"].forEach(key=>$("#"+key).onchange=saveTaskDrawer);if($("#taskAssignee"))$("#taskAssignee").onchange=saveTaskDrawer;$("#taskTitle").onblur=saveTaskDrawer;
 $$('[data-cid]').forEach(c=>c.onchange=async()=>{const fresh=visibleTasks().find(x=>x.id===id);const cl=fresh.checklist.map(x=>x.id===c.dataset.cid?{...x,done:c.checked}:x);await patch("tasks",id,{checklist:cl})});
 $("#addChecklist").onclick=async()=>{const text=prompt("Checklist elem neve");if(!text)return;const fresh=visibleTasks().find(x=>x.id===id);await patch("tasks",id,{checklist:[...(fresh.checklist||[]),{id:"c"+Date.now(),text,done:false}]});openTask(id)};
 $("#commentForm").onsubmit=async e=>{e.preventDefault();const text=$("#commentText").value.trim();if(!text)return;await api(`/api/tasks/${id}/comments`,{method:"POST",body:JSON.stringify({text})});await load();openTask(id)};
 async function saveTaskDrawer(){const body={title:$("#taskTitle").value.trim(),brand:$("#taskBrand").value,status:$("#taskStatus").value,priority:$("#taskPriority").value,due:$("#taskDue").value,area:$("#taskArea").value,notes:$("#taskNotes").value};if($("#taskAssignee"))body.assignee=$("#taskAssignee").value||null;await patch("tasks",id,body);render()}
}
function closeDrawer(){$("#drawer").classList.add("hidden");$("#drawerBackdrop").classList.add("hidden")}
function toggleQuick(force){const q=$("#quickMenu");const show=force===undefined?q.classList.contains("hidden"):force;q.classList.toggle("hidden",!show)}
function openCreate(kind){
 const titles={task:"Új feladat",content:"Új tartalom",idea:"Új tartalomötlet",note:"Új jegyzet"};$("#modalBackdrop").classList.remove("hidden");
 const commonBrands=`<select id="mBrand"><option>LAAVA</option><option>MATÉZZ</option><option>Matchai</option></select>`;
 if(kind==="note")$("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="Cím" required><textarea id="mBody" placeholder="Jegyzet"></textarea><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 else if(kind==="content"||kind==="idea")$("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="${kind==="idea"?"Ötlet":"Tartalom neve"}" required>${commonBrands}<input id="mPlatform" placeholder="Platform (pl. Instagram, TikTok)"><input id="mDate" type="date"><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 else $("#modal").innerHTML=`<h2>${titles[kind]}</h2><form id="createForm" class="form-grid"><input id="mTitle" placeholder="Feladat neve" required>${commonBrands}<select id="mArea"><option>Social Media</option><option>Termékfeltöltés</option><option>Webshop</option><option>Hírlevél</option><option>Kampány</option><option>Beszerzés</option><option>Ügyfélszolgálat</option><option>Admin</option><option>Fotó / videó</option><option>Egyéb</option></select>${isAdmin()?`<select id="mAssignee">${`<option value="">Nincs felelős</option>`+users().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>`:""}<select id="mPriority"><option>Normál</option><option>Fontos</option><option>Sürgős</option></select><input id="mDue" type="date"><div class="form-actions"><button type="button" class="secondary" id="cancelModal">Mégse</button><button class="primary">Létrehozás</button></div></form>`;
 $("#cancelModal").onclick=closeModal;$("#createForm").onsubmit=async e=>{e.preventDefault();if(kind==="note")await api("/api/notes",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,body:$("#mBody").value})});else if(kind==="content"||kind==="idea")await api("/api/content",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,brand:$("#mBrand").value,platform:$("#mPlatform").value.split(",").map(x=>x.trim()).filter(Boolean),status:kind==="idea"?"Ötlet":"Előkészítés",date:$("#mDate").value,assignee:state.me.id})});else await api("/api/tasks",{method:"POST",body:JSON.stringify({title:$("#mTitle").value,brand:$("#mBrand").value,area:$("#mArea").value,assignee:isAdmin()?($("#mAssignee")?.value||null):state.me.id,status:"Teendő",priority:$("#mPriority").value,due:$("#mDue").value,platform:[],notes:"",checklist:[],comments:[]})});closeModal();await load();go(kind==="note"?"notes":kind==="task"?"tasks":"content")}
}
function closeModal(){$("#modalBackdrop").classList.add("hidden")}
async function patch(col,id,body){const item=await api(`/api/${col}/${id}`,{method:"PATCH",body:JSON.stringify(body)});const i=state.data[col].findIndex(x=>x.id===id);if(i>-1)state.data[col][i]=item;return item}
async function del(col,id){await api(`/api/${col}/${id}`,{method:"DELETE"});state.data[col]=state.data[col].filter(x=>x.id!==id)}
document.addEventListener("click",e=>{const c=e.target.closest(".task-card");if(c)openTask(c.dataset.openTask)});
boot();
