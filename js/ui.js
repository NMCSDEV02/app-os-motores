export const $ = (sel) => document.querySelector(sel);
export const screen = () => $("#screen");

export function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 2200);
}

export function setHeader(operator, visible=true){
  const h = $("#appHeader");
  if(!visible){ h.classList.add("hidden"); return; }
  h.classList.remove("hidden");
  const perfil = String(operator?.perfil || "").toLowerCase();
  const isAdmin = perfil === "admin";
  $("#headerGreeting").textContent = operator ? `Olá, ${String(operator.nome||"Operador").split(" ")[0]}` : "Olá";
  $("#headerContext").textContent = operator ? `${operator.perfil || operator.setor} • ${navigator.onLine ? "Online" : "Offline"}` : "";
  const search = $("#btnSearch");
  const qr = $("#btnQrTop");
  // No perfil Admin, o QR fica dentro do painel administrativo.
  // Isso evita que o fechamento do leitor mande o Admin para a tela operacional.
  if(search) search.classList.toggle("hidden", isAdmin);
  if(qr){
    qr.textContent = "QR";
    qr.title = "Ler QR Code";
    qr.classList.toggle("hidden", isAdmin);
  }
}

export function setBottomNav(operator, visible=true, active="home"){
  const nav = $("#bottomNav");
  if(!visible){ nav.classList.add("hidden"); return; }
  nav.classList.remove("hidden");
  nav.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.nav === active));
}

export function modal({title, text="", html="", actions=[]}){
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal"><h3>${title}</h3>${text?`<p>${text}</p>`:""}${html}<div class="modal-actions"></div></div></div>`;
  const actionsEl = root.querySelector(".modal-actions");
  actions.forEach(a=>{
    const b=document.createElement("button");
    b.className = `btn ${a.className||"light"}`;
    b.textContent = a.label;
    b.onclick = () => { if(a.onClick) a.onClick(); if(a.close !== false) closeModal(); };
    actionsEl.appendChild(b);
  });
}
export function closeModal(){ $("#modalRoot").innerHTML = ""; }

export function percent(done,total){ return total>0 ? Math.round((Number(done||0)/Number(total||0))*100) : 0; }
export function progress(label, done, total, color=""){
  const p = percent(done,total);
  return `<div class="progress ${color}"><span style="width:${p}%"></span></div><div class="progress-meta"><span>${label}</span><span>${done||0}/${total||0} • ${p}%</span></div>`;
}
export function fmtDate(v){
  if(!v) return "";
  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}
export function escapeHtml(v){ return String(v??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
