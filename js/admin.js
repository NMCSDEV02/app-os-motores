import { apiGet, apiPost, apiGetFast } from "./api.js";
import { currentUser, logout } from "./auth.js";
import { screen, setHeader, setBottomNav, toast, modal, closeModal, escapeHtml, fmtDate, progress } from "./ui.js";
import { openQrScreen } from "./qr.js";
import { isDesktop } from "./core/device.js";
import { toggleTheme } from "./core/theme.js";
import { openSyncPanel, updateGlobalSyncBadge } from "./core/syncPanel.js";
import { normalizeProgress, progressState, progressHtml } from "./core/progressEngine.js";
import { renderDataAccelerationPanel, bindDataAccelerationPanel } from "./core/dataAcceleration.js";

import { MANAGER_PERMISSION_DEFAULTS, getManagerPermissions, setManagerPermissions, saveManagerPermissions, syncManagerPermissionsFromApi, managerPermissionLabel, managerPermissionGroup } from "./core/managerPermissions.js";
function kpiHealthLabelLocal(score){
  const s = Number(score || 0);
  if(s >= 85) return "Excelente";
  if(s >= 70) return "Estável";
  if(s >= 50) return "Atenção";
  return "Crítico";
}
function fmtKpiPctLocal(v){
  return `${Math.max(0, Math.min(100, Math.round(Number(v || 0))))}%`;
}


let adminArea = "inicio";
let adminViewingOS = null;
let adminViewerTimer = null;
const ADMIN_FLOW = ["inicio", "os", "subtarefas", "usuarios", "modelos", "lixeira", "historico"];
let cachedSolicitacoes = [];
let cachedLogs = [];
let adminNotifyTimer = null;
let lastPendingCount = 0;

function perfilAtual(){ return String(currentUser()?.perfil || "Operador").toLowerCase(); }
function ehAdmin(){ return perfilAtual() === "admin"; }
function ehGestao(){ const p = perfilAtual(); return p === "gestao" || p === "gestor"; }
function podeAcessarAreaAdmin(area){
  if(ehAdmin()) return true;
  return !["usuarios"].includes(area);
}
function tituloPainel(){ return ehAdmin() ? "Painel ADM" : "Painel Gestão"; }
function subtituloPainel(){ return ehAdmin() ? "Controle, auditoria e permissões" : "Gestão operacional, qualidade e metas"; }



function applySidebarState(){
  const collapsed = localStorage.getItem("natan_admin_sidebar") === "collapsed";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
}

function toggleAdminSidebar(){
  const collapsed = localStorage.getItem("natan_admin_sidebar") === "collapsed";
  localStorage.setItem("natan_admin_sidebar", collapsed ? "expanded" : "collapsed");
  applySidebarState();
}


function natanApplySidebarState(){
  if(!document.body.classList.contains("desktop-mode")) return;
  const collapsed = localStorage.getItem("natan_admin_sidebar") === "collapsed";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
}

function natanToggleAdminSidebar(){
  const collapsed = localStorage.getItem("natan_admin_sidebar") === "collapsed";
  localStorage.setItem("natan_admin_sidebar", collapsed ? "expanded" : "collapsed");
  natanApplySidebarState();
}

function natanSetupAdminSidebar(){
  const sidebar = document.querySelector(".admin-sidebar");
  if(!sidebar) return;

  let head = sidebar.querySelector(".admin-sidebar-head");

  if(!head){
    const brand = sidebar.querySelector(".admin-brand");
    const sub = sidebar.querySelector(".admin-brand-sub");

    head = document.createElement("div");
    head.className = "admin-sidebar-head";

    const brandWrap = document.createElement("div");
    brandWrap.className = "admin-sidebar-brand-wrap";

    if(brand) brandWrap.appendChild(brand);
    if(sub) brandWrap.appendChild(sub);

    head.appendChild(brandWrap);
    sidebar.insertBefore(head, sidebar.firstChild);
  }

  let btn = sidebar.querySelector("#btnSidebarToggle");
  if(!btn){
    btn = document.createElement("button");
    btn.id = "btnSidebarToggle";
    btn.className = "admin-sidebar-toggle";
    btn.type = "button";
    btn.title = "Minimizar menu";
    btn.textContent = "☰";
    head.appendChild(btn);
  }

  const icons = {
    inicio:"dashboard",
    dashboard:"dashboard",
    usuarios:"group",
    setores:"lan",
    fluxos:"account_tree",
    modelos:"checklist",
    models:"checklist",
    kits:"qr_code_2",
    aprovacoes:"approval",
    historico:"history",
    lixeira:"delete",
    sistema:"settings",
    settings:"settings"
  };

  sidebar.querySelectorAll(".admin-menu button").forEach(btnMenu=>{
    const key = btnMenu.dataset.adminDesktop || btnMenu.dataset.adminPage || "";
    if(!btnMenu.dataset.icon) btnMenu.dataset.icon = icons[key] || btnMenu.textContent.trim().charAt(0).toUpperCase() || "•";
    if(!btnMenu.title) btnMenu.title = btnMenu.textContent.trim();
  });

  btn.onclick = natanToggleAdminSidebar;
  natanApplySidebarState();
}

function renderAdminDesktop(area = "inicio"){
  document.body.classList.remove("manager-mode");
  document.body.classList.add("desktop-mode");
  const u = currentUser();
  setHeader(u,false);
  setBottomNav(u,false);

  screen().innerHTML = `
    <section class="admin-desktop-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Projeto Natan</div>
        <div class="admin-brand-sub">Console industrial V3</div>
        <nav class="admin-menu">
          <button class="active" data-admin-desktop="inicio" data-icon="dashboard" title="Dashboard">Dashboard</button>
          <button data-admin-desktop="usuarios" data-icon="group" title="Usuários e permissões">Usuários e permissões</button>
          <button data-admin-desktop="setores" data-icon="lan" title="Setores e áreas">Setores e áreas</button>
          <button data-admin-desktop="fluxos" data-icon="account_tree" title="Fluxos">Fluxos</button>
          <button data-admin-desktop="modelos" data-icon="checklist" title="Modelos checklist">Modelos checklist</button>
          <button data-admin-desktop="kits" data-icon="qr_code_2" title="Carrinhos Kit / QR">Carrinhos Kit / QR</button>
          <button data-admin-desktop="notificacoes" data-icon="notifications" title="Notificações">Notificações</button>
          <button data-admin-desktop="aprovacoes" data-icon="approval" title="Aprovações">Aprovações</button>
          <button data-admin-desktop="historico" data-icon="history" title="Auditoria completa">Auditoria completa</button>
          <button data-admin-desktop="lixeira" data-icon="delete" title="Lixeira">Lixeira</button>
          <button data-admin-desktop="sistema" data-icon="settings" title="Sistema">Sistema</button>
        </nav>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <div>
            <h1>Painel Administrador</h1>
            <p>Console desktop para configuração, auditoria e controle total.</p>
          </div>
          <div class="admin-top-actions">
            <button id="syncBadge" class="sync-badge" data-status="${navigator.onLine ? "online" : "offline"}" type="button">${navigator.onLine ? "Sincronizado" : "Offline"}</button>
            <button id="btnThemeToggle" class="theme-toggle" type="button">Tema</button>
            <button id="btnAdminDesktopLogout" class="btn red compact" type="button">Sair</button>
          </div>
        </header>
        <div id="adminDesktopArea"><div class="empty">Carregando console...</div></div>
      </main>
    </section>
  `;

  applySidebarState();
  natanSetupAdminSidebar();
  document.querySelector("#btnThemeToggle").onclick = () => toggleTheme();
  document.querySelector("#btnSidebarToggle")?.addEventListener("click", toggleAdminSidebar);
  document.querySelector("#syncBadge")?.addEventListener("click", openSyncPanel);
  updateGlobalSyncBadge();
  loadAdminNotificationCount();
  document.querySelector("#btnAdminNotifications")?.addEventListener("click", ()=>renderAdminDesktop("notificacoes"));
  document.querySelector("#btnAdminDesktopLogout").onclick = logout;

  document.querySelectorAll("[data-admin-desktop]").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll("[data-admin-desktop]").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const box=document.querySelector("#adminDesktopArea"); if(box) box.innerHTML=`<div class="v36-loading">Carregando...</div>`; setTimeout(()=>renderAdminDesktopArea(btn.dataset.adminDesktop),0);
    };
  });

  renderAdminDesktopArea(area);
}

async function renderAdminDesktopArea(area){
  const box = document.querySelector("#adminDesktopArea");
  if(!box) return;

  if(area === "usuarios") return renderAdminPermissoesDesktop();
  if(area === "manager_permissions") return renderAdminManagerPermissions();
  if(area === "modelos") return renderAdminModelosDesktop();
  if(area === "historico") return renderAdminAuditoriaDesktop();
  if(area === "lixeira") return renderAdminLixeiraDesktop();

  if(area === "setores") return renderAdminSetoresDesktop();
  if(area === "fluxos") return renderAdminFluxosDesktop();
  if(area === "kits") return renderAdminKitsDesktop();
  if(area === "notificacoes") return renderAdminNotificacoesDesktop();
  if(area === "aprovacoes") return renderAdminAprovacoesDesktop();
  if(area === "sistema") return renderAdminSistemaDesktop();

  try{
    const [dash, logs] = await Promise.all([
      apiGet("kpiDashboardAvancado", {matricula: currentUser().matricula}).catch(()=>({kpis:{},setores:[],operadores:[],alertas:[]})),
      apiGetFast("adminLogs", {}).catch(()=>[])
    ]);

    const k = dash.kpis || {};
    const score = Number(k.score_operacional || 0);

    box.innerHTML = `
      <div class="kpi-advanced-grid">
        <div class="kpi-advanced-card green"><small>Saúde operacional</small><strong>${score}/100</strong><span>${kpiHealthLabelLocal(score)}</span></div>
        <div class="kpi-advanced-card"><small>OS abertas</small><strong>${k.os_abertas || 0}</strong><span>${k.os_atrasadas || 0} atrasada(s)</span></div>
        <div class="kpi-advanced-card yellow"><small>Subtarefas pendentes</small><strong>${k.subtarefas_pendentes || 0}</strong><span>Gargalo: ${escapeHtml(k.gargalo_principal || "-")}</span></div>
        <div class="kpi-advanced-card dark"><small>Taxa de conclusão</small><strong>${fmtKpiPctLocal(k.taxa_conclusao || 0)}</strong><span>${k.itens_concluidos || 0}/${k.itens_total || 0} itens</span></div>
      </div>

      <div class="kpi-panel-wide">
        <section class="kpi-insight-panel">
          <h2>Indicador de desempenho</h2>
          <p>Score calculado por progresso, atrasos, subtarefas pendentes, fila aberta e eventos do dia.</p>
          <div class="kpi-health-bar"><span style="width:${score}%"></span></div>

          <div class="kpi-mini-list">
            <div class="kpi-mini-row"><div><b>Operador destaque</b><small>Mais ações registradas</small></div><div class="kpi-mini-value">${escapeHtml(k.operador_destaque || "-")}</div></div>
            <div class="kpi-mini-row"><div><b>Setor com mais pendências</b><small>Subtarefas abertas</small></div><div class="kpi-mini-value">${escapeHtml(k.setor_critico || "-")}</div></div>
            <div class="kpi-mini-row"><div><b>Eventos hoje</b><small>Movimentações registradas</small></div><div class="kpi-mini-value">${k.eventos_hoje || 0}</div></div>
          </div>
        </section>

        <section class="kpi-insight-panel">
          <h2>Ranking de setores</h2>
          <p>Pendências abertas por destino.</p>
          <div class="kpi-mini-list">
            ${(dash.setores || []).slice(0,6).map((s,i)=>`
              <div class="kpi-mini-row">
                <div><b>${escapeHtml(s.setor)}</b><small>${i+1}º no ranking de pendências</small></div>
                <div class="kpi-mini-value">${s.total}</div>
              </div>
            `).join("") || `<div class="v35-empty-state">Sem pendências por setor.</div>`}
          </div>
        </section>
      </div>

      <section class="admin-desktop-section" style="margin-top:18px">
        <h2>Últimos eventos do sistema</h2>
        <table class="admin-desktop-table">
          <thead><tr><th>Ação</th><th>Operador</th><th>OS</th><th>Data</th></tr></thead>
          <tbody>
            ${(logs || []).slice(0,10).map(l=>`
              <tr>
                <td>${escapeHtml(l.acao || "-")}</td>
                <td>${escapeHtml(l.operador_nome || "Sistema")}</td>
                <td>${escapeHtml(l.codigo_os || "-")}</td>
                <td>${fmtDate(l.data_hora)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    `;
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar dashboard desktop.</div>`;
  }
}


export async function renderAdmin(area = "inicio"){
  if(isDesktop()) return renderAdminDesktop(area);
  document.body.classList.remove("manager-mode");
  document.body.classList.remove("desktop-mode");
  document.body.classList.remove("sidebar-collapsed");
  if(adminViewerTimer){ clearInterval(adminViewerTimer); adminViewerTimer = null; }
  adminArea = area;
  if(!podeAcessarAreaAdmin(area)) area = adminArea = "inicio";
  const u = currentUser();
  setHeader(u, true);
  setBottomNav(u, false);
  mountAdminHeaderControls();

  screen().innerHTML = `
    <section class="admin-shell admin-master-shell ${ehGestao()?"gestao-shell":""}">
      <div class="admin-head admin-head-pro admin-head-simple">
        <button id="btnAdminMenu" class="admin-menu-btn" aria-label="Abrir menu administrativo">☰</button>
        <div class="admin-title-block">
          <h1 class="page-title">${tituloPainel()}</h1>
          <p class="page-subtitle">${subtituloPainel()}</p>
        </div>
      </div>

      <div id="adminDrawerBackdrop" class="admin-drawer-backdrop hidden" aria-hidden="true"></div>

      ${renderAdminDrawerMenu()}

      <div id="adminArea" class="admin-area swipe-area">
        <div class="empty">Carregando...</div>
      </div>
    </section>`;

  const drawer = document.querySelector("#adminDrawer");
  const drawerBackdrop = document.querySelector("#adminDrawerBackdrop");
  const openAdminDrawer = () => {
    drawer.classList.remove("hidden");
    drawerBackdrop.classList.remove("hidden");
    document.body.classList.add("drawer-open");
  };
  const closeAdminDrawer = () => {
    drawer.classList.add("hidden");
    drawerBackdrop.classList.add("hidden");
    document.body.classList.remove("drawer-open");
  };

  const logoutTop = document.querySelector("#btnAdminLogoutTop");
  const notifyTop = document.querySelector("#btnAdminNotifyTop");
  if(logoutTop) logoutTop.onclick = logout;
  if(notifyTop) notifyTop.onclick = openNotificationCenter;
  document.querySelector("#btnAdminMenu").onclick = openAdminDrawer;
  drawerBackdrop.onclick = closeAdminDrawer;
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeAdminDrawer();
  }, {once:true});

  document.querySelectorAll("[data-admin-menu]").forEach(btn => btn.onclick = () => {
    closeAdminDrawer();
    renderAdmin(btn.dataset.adminMenu);
  });
  document.querySelector("[data-admin-qr]").onclick = () => {
    closeAdminDrawer();
    openQrScreen("admin");
  };

  bindAdminSwipe(document.querySelector("#adminArea"));
  refreshAdminBell();
  startAdminRealtimeNotifications();

  if(area === "inicio") return renderAdminInicio();
  if(area === "usuarios") return renderAdminPermissoesDesktop();
  if(area === "manager_permissions") return renderAdminManagerPermissions();
  if(area === "os") return renderAdminOS();
  if(area === "subtarefas") return renderSubtarefasPendentes();
  if(area === "modelos") return renderAdminModelosDesktop();
  if(area === "lixeira") return renderAdminLixeiraDesktop();
  if(area === "historico") return renderAdminAuditoriaDesktop();
}


function renderAdminDrawerMenu(){
  const admin = ehAdmin();
  return `<aside id="adminDrawer" class="admin-drawer hidden" aria-label="Menu administrativo">
    <div class="drawer-title">Menu</div>
    <button data-admin-menu="inicio"><span>01</span><b>Início</b><small>Visão geral e indicadores do dia</small></button>
    <button data-admin-menu="os"><span>02</span><b>Gerenciar OS</b><small>Criar, buscar, visualizar e republicar</small></button>
    <button data-admin-menu="subtarefas"><span>03</span><b>Subtarefas</b><small>Pendências, setores e checklist</small></button>
    ${admin ? `<button data-admin-menu="usuarios"><span>04</span><b>Usuários e permissões</b><small>Acessos, perfis e bloqueios</small></button><button data-admin-menu="manager_permissions"><span>05</span><b>Permissões da Gestão</b><small>Controlar ações que aparecem para Gestão</small></button>` : ""}
    <button data-admin-menu="modelos"><span>${admin ? "05" : "04"}</span><b>Modelos de checklist</b><small>Padrões por setor e etapa</small></button>
    <div class="drawer-divider"></div>
    <div class="drawer-title drawer-title-small">Avançado</div>
    <button data-admin-menu="lixeira"><span>${admin ? "06" : "05"}</span><b>Lixeira de OS</b><small>Recuperar ordens e subtarefas</small></button>
    <button data-admin-menu="historico"><span>${admin ? "07" : "06"}</span><b>Histórico / auditoria</b><small>Eventos e rastreabilidade</small></button>
    <button data-admin-qr><span>QR</span><b>Leitor QR Code</b><small>Abrir OS, subtarefa ou carrinho</small></button>
  </aside>`;
}

function mountAdminHeaderControls(){
  const actions = document.querySelector(".header-actions");
  if(!actions) return;
  actions.innerHTML = `
    <button id="btnAdminNotifyTop" class="admin-notify-btn admin-notify-top" aria-label="Notificações administrativas">
      <span class="notify-icon-svg" aria-hidden="true">${bellSvg()}</span><b id="adminNotifyBadge">0</b>
    </button>
    <button id="btnAdminLogoutTop" class="btn red compact admin-logout-top">Sair</button>
  `;
}

function closeAdminNotificationPanel(){
  const panel = document.querySelector("#adminNotifyOverlay");
  if(panel) panel.remove();
  document.body.classList.remove("notify-open");
}

function adminBackBar(title, subtitle=""){
  return `<div class="admin-section-bar">
    <button class="btn light compact" data-admin-home>← Painel</button>
    <div><h2 class="section-title">${escapeHtml(title)}</h2>${subtitle?`<p class="page-subtitle">${escapeHtml(subtitle)}</p>`:""}</div>
  </div>`;
}

function adminBackBarTo(title, subtitle="", target="inicio", label="← Voltar"){
  return `<div class="admin-section-bar">
    <button class="btn light compact" data-admin-back-to="${escapeHtml(target)}">${escapeHtml(label)}</button>
    <div><h2 class="section-title">${escapeHtml(title)}</h2>${subtitle?`<p class="page-subtitle">${escapeHtml(subtitle)}</p>`:""}</div>
  </div>`;
}

function bindAdminHome(area=document){
  area.querySelectorAll("[data-admin-home]").forEach(b=>b.onclick=()=>renderAdmin("inicio"));
  area.querySelectorAll("[data-admin-back-to]").forEach(b=>b.onclick=()=>renderAdmin(b.dataset.adminBackTo || "inicio"));
}

function bindAdminSwipe(el){
  if(!el) return;
  let startX = 0, startY = 0;
  el.addEventListener("touchstart", e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, {passive:true});
  el.addEventListener("touchend", e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if(Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = Math.max(0, ADMIN_FLOW.indexOf(adminArea));
    const next = dx < 0 ? ADMIN_FLOW[Math.min(idx + 1, ADMIN_FLOW.length - 1)] : ADMIN_FLOW[Math.max(idx - 1, 0)];
    if(next && next !== adminArea) renderAdmin(next);
  }, {passive:true});
}

async function refreshAdminBell(){
  try{
    const [solicitacoes, logs] = await Promise.all([
      apiGet("adminSolicitacoesSetor", {}),
      apiGet("adminLogs", {})
    ]);
    cachedSolicitacoes = Array.isArray(solicitacoes) ? solicitacoes : [];
    cachedLogs = Array.isArray(logs) ? logs : [];
    const count = cachedSolicitacoes.filter(s => String(s.status || "Pendente").toLowerCase() === "pendente").length;
    const badge = document.querySelector("#adminNotifyBadge");
    if(badge){
      badge.textContent = count;
      badge.classList.toggle("hidden", count === 0);
    }
    if(count > lastPendingCount && lastPendingCount !== 0){
      toast(`${count} solicitação(ões) aguardando aprovação`);
    }
    lastPendingCount = count;
  }catch{
    const badge = document.querySelector("#adminNotifyBadge");
    if(badge) badge.classList.add("hidden");
  }
}

function startAdminRealtimeNotifications(){
  if(adminNotifyTimer) clearInterval(adminNotifyTimer);
  adminNotifyTimer = setInterval(() => {
    const u = currentUser();
    if(!(["admin","gestao","gestor"].includes(String(u?.perfil || "").toLowerCase()))){
      clearInterval(adminNotifyTimer);
      adminNotifyTimer = null;
      return;
    }
    refreshAdminBell();
  }, 8000);
}

function bellSvg(){
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 22a2.4 2.4 0 0 0 2.35-2h-4.7A2.4 2.4 0 0 0 12 22Zm7-6.1-1.7-1.8V9.7A5.3 5.3 0 0 0 13 4.5V3a1 1 0 1 0-2 0v1.5a5.3 5.3 0 0 0-4.3 5.2v4.4L5 15.9V18h14v-2.1ZM8.7 16v-6.3A3.3 3.3 0 0 1 12 6.4a3.3 3.3 0 0 1 3.3 3.3V16H8.7Z" fill="currentColor"/></svg>`;
}

function openNotificationCenter(){
  closeAdminNotificationPanel();

  const hoje = new Date();
  const hojeKey = hoje.toISOString().slice(0,10);
  const dataLabel = hoje.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" });
  const pendentes = cachedSolicitacoes.filter(s => String(s.status || "Pendente").toLowerCase() === "pendente");
  const logsHoje = (cachedLogs || []).filter(l => {
    const d = new Date(l.data_hora || l.criado_em || l.data || "");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === hojeKey;
  });

  const importantes = logsHoje.filter(l => {
    const acao = String(l.acao || "").toUpperCase();
    return acao.includes("OS_CONCLUIDA") || acao.includes("OS_FINALIZADA") || acao.includes("CHECKLIST") || acao.includes("MODELO") || acao.includes("EXCLUIDA") || acao.includes("RECUPERADA");
  });
  const usuarios = logsHoje.filter(l => {
    const acao = String(l.acao || "").toUpperCase();
    return acao.includes("USUARIO") || acao.includes("OPERADOR") || acao.includes("PERFIL") || acao.includes("TROCA_SETOR") || acao.includes("LOGIN");
  });
  const sistema = logsHoje.filter(l => {
    const acao = String(l.acao || "").toUpperCase();
    return acao.includes("SISTEMA") || acao.includes("OFFLINE") || acao.includes("ONLINE") || acao.includes("SYNC") || acao.includes("QR") || acao.includes("API");
  });

  const html = `
    <div id="adminNotifyOverlay" class="admin-notify-overlay" role="presentation">
      <section class="admin-notify-panel" role="dialog" aria-label="Notificações do administrador">
        <div class="notify-panel-head compact">
          <div>
            <h3>Notificações</h3>
            <p>Mostrando somente eventos de hoje: <b>${dataLabel}</b>. Para consultar dias anteriores, acesse Histórico / auditoria.</p>
          </div>
          <button class="notify-close-mini soft" data-close-notify aria-label="Fechar notificações">×</button>
        </div>

        <div class="notify-tabs" role="tablist" aria-label="Categorias de notificação">
          <button class="notify-tab active" data-notify-tab="importantes">Importantes <b>${pendentes.length + importantes.length}</b></button>
          <button class="notify-tab" data-notify-tab="usuarios">Usuários <b>${usuarios.length}</b></button>
          <button class="notify-tab" data-notify-tab="sistema">Sistema <b>${sistema.length}</b></button>
        </div>

        <div class="notify-list notify-list-panel" id="notifyTab_importantes" data-notify-panel>
          ${pendentes.length ? `<h4 class="modal-subtitle">Aguardando aprovação</h4>${pendentes.map(renderSolicitacaoCard).join("")}` : ""}
          ${importantes.length ? `<h4 class="modal-subtitle">Eventos importantes</h4>${importantes.slice(0,10).map(renderSmallLog).join("")}` : ""}
          ${(!pendentes.length && !importantes.length) ? `<div class="empty small-empty">Sem notificações importantes hoje.</div>` : ""}
        </div>

        <div class="notify-list notify-list-panel hidden" id="notifyTab_usuarios" data-notify-panel>
          ${usuarios.length ? usuarios.slice(0,14).map(renderSmallLog).join("") : `<div class="empty small-empty">Sem eventos de usuários hoje.</div>`}
        </div>

        <div class="notify-list notify-list-panel hidden" id="notifyTab_sistema" data-notify-panel>
          ${sistema.length ? sistema.slice(0,14).map(renderSmallLog).join("") : `<div class="empty small-empty">Sem eventos do sistema hoje.</div>`}
        </div>
      </section>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  document.body.classList.add("notify-open");

  const overlay = document.querySelector("#adminNotifyOverlay");
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) closeAdminNotificationPanel();
  });
  document.querySelectorAll("[data-close-notify]").forEach(btn => btn.onclick = closeAdminNotificationPanel);
  document.querySelectorAll("[data-notify-tab]").forEach(btn => btn.onclick = () => {
    document.querySelectorAll("[data-notify-tab]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("[data-notify-panel]").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    const panel = document.querySelector(`#notifyTab_${btn.dataset.notifyTab}`);
    if(panel) panel.classList.remove("hidden");
  });
  document.querySelectorAll("[data-approve-sector]").forEach(btn => btn.onclick = () => responderTrocaSetor(btn.dataset.approveSector, "Aprovado"));
  document.querySelectorAll("[data-reject-sector]").forEach(btn => btn.onclick = () => responderTrocaSetor(btn.dataset.rejectSector, "Rejeitado"));
}

function renderSolicitacaoCard(s){
  return `<div class="notify-card pending">
    <strong>Troca de setor solicitada</strong>
    <small>${escapeHtml(s.nome || s.matricula)} quer mudar de <b>${escapeHtml(s.setor_atual || "-")}</b> para <b>${escapeHtml(s.setor_novo || "-")}</b></small>
    <small>${fmtDate(s.data_solicitacao)}</small>
    <div class="notify-actions">
      <button class="btn green compact" data-approve-sector="${escapeHtml(s.id_solicitacao)}">Aprovar</button>
      <button class="btn red compact" data-reject-sector="${escapeHtml(s.id_solicitacao)}">Negar</button>
    </div>
  </div>`;
}

function renderSmallLog(l){
  return `<div class="notify-card">
    <strong>${escapeHtml(l.acao || "Evento")}</strong>
    <small>${escapeHtml(l.operador_nome || "Sistema")} • ${escapeHtml(l.codigo_os || "-")} • ${fmtDate(l.data_hora)}</small>
    ${l.detalhes ? `<small>${escapeHtml(l.detalhes)}</small>` : ""}
  </div>`;
}

async function responderTrocaSetor(id, status){
  try{
    await apiPost({acao:"adminResponderTrocaSetor", id_solicitacao:id, status, admin:currentUser().nome});
    toast(status === "Aprovado" ? "Troca aprovada" : "Troca negada");
    closeAdminNotificationPanel();
    await refreshAdminBell();
    if(adminArea === "usuarios" || adminArea === "inicio") renderAdmin(adminArea);
  }catch(e){
    toast(e.message || "Erro ao responder solicitação");
  }
}

async function renderAdminInicio(){
  const area = document.querySelector("#adminArea");
  try{
    const [resumo, usuarios, lixeira, logs, solicitacoes, subsPendentes] = await Promise.all([
      apiGet("gestorResumo", {matricula: currentUser().matricula}),
      apiGet("adminListarOperadores", {}),
      apiGet("adminLixeiraOS", {}),
      apiGet("adminLogs", {}),
      apiGet("adminSolicitacoesSetor", {}),
      apiGet("adminSubtarefasPendentes", {})
    ]);

    cachedLogs = Array.isArray(logs) ? logs : [];
    cachedSolicitacoes = Array.isArray(solicitacoes) ? solicitacoes : [];

    const rowsOS = Array.isArray(resumo.os) ? resumo.os : [];
    const ativos = usuarios.filter(u => String(u.ativo).toLowerCase() !== "false").length;
    const bloqueados = Math.max(usuarios.length - ativos, 0);
    const osAbertas = Number(resumo.kpi?.os_abertas || 0);
    const subPendentes = Number(resumo.kpi?.sub_pendentes || subsPendentes.length || 0);
    const lixo = Number(lixeira.length || 0);
    const pendSetor = cachedSolicitacoes.filter(s => String(s.status || "Pendente").toLowerCase() === "pendente").length;
    const concluidas = rowsOS.filter(o => String(o.status || "").toLowerCase().includes("conclu")).length;
    const atrasadas = rowsOS.filter(osEstaAtrasada).length;
    const tempoMedio = calcularTempoMedioOS(rowsOS);
    const destaque = operadorMaisAtivo(cachedLogs);
    const setorCritico = setorMaisPendente(subsPendentes);

    area.innerHTML = `
      ${pendSetor ? `<button class="admin-alert-strip" id="btnOpenAdminAlerts">${pendSetor} troca de setor aguardando aprovação</button>` : ""}

      <div class="admin-guide-strip">Use o menu lateral para navegar. A visão geral mostra somente os dados mais importantes da operação.</div>

      <section class="admin-overview-v2 card">
        <div class="overview-head">
          <div>
            <h2 class="section-title">Visão geral</h2>
            <p class="page-subtitle">Resumo operacional do sistema.</p>
          </div>
          <button class="btn ghost compact overview-history" id="btnAdminQuickHistory">Histórico</button>
        </div>

        <div class="overview-kpi-grid compact-kpis">
          ${adminMetricCard("OS abertas", osAbertas, "Ver ordens", "os")}
          ${adminMetricCard("Subtarefas", subPendentes, "Pendências", "subtarefas")}
          ${adminMetricCard("Usuários ativos", ativos, "Gerenciar", "usuarios")}
          ${adminMetricCard("Lixeira", lixo, "Recuperar", "lixeira")}
        </div>

        <div class="admin-stats-grid">
          <div class="stat-panel span-2">
            <div class="stat-head"><b>Avanço geral</b><span>${resumo.kpi?.itens_concluidos || 0}/${resumo.kpi?.itens_total || 0}</span></div>
            ${progress("Itens concluídos", resumo.kpi?.itens_concluidos || 0, resumo.kpi?.itens_total || 0, "green")}
            <div class="admin-mini-grid compact">
              <span>OS concluídas: <b>${concluidas}</b></span>
              <span>OS atrasadas: <b>${atrasadas}</b></span>
              <span>Bloqueados: <b>${bloqueados}</b></span>
              <span>Trocas pendentes: <b>${pendSetor}</b></span>
            </div>
          </div>

          <div class="stat-panel">
            <small>Tempo médio por OS</small>
            <strong>${tempoMedio ? fmtDuracao(tempoMedio) : "--"}</strong>
            <span>Baseado nas OS finalizadas.</span>
          </div>

          <div class="stat-panel">
            <small>Operador em destaque</small>
            <strong>${escapeHtml(destaque.nome)}</strong>
            <span>${destaque.total} ação(ões) registradas.</span>
          </div>

          <div class="stat-panel">
            <small>Setor com mais pendências</small>
            <strong>${escapeHtml(setorCritico.setor)}</strong>
            <span>${setorCritico.total} subtarefa(s) abertas.</span>
          </div>

          <div class="stat-panel">
            <small>Previsão operacional</small>
            <strong>${osAbertas ? estimarFila(rowsOS) : "Sem fila"}</strong>
            <span>Estimativa por progresso e tempo aberto.</span>
          </div>
        </div>
      </section>
    `;

    area.querySelectorAll("[data-admin-card]").forEach(btn => btn.onclick = () => renderAdmin(btn.dataset.adminCard));
    const histBtn = document.querySelector("#btnAdminQuickHistory");
    if(histBtn) histBtn.onclick = () => renderAdmin("historico");
    const alertBtn = document.querySelector("#btnOpenAdminAlerts");
    if(alertBtn) alertBtn.onclick = openNotificationCenter;
    await refreshAdminBell();
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar painel administrativo.</div>`;
  }
}

function minutesBetween(a,b){
  const da = new Date(a || "");
  const db = new Date(b || "");
  if(Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
  return Math.max(0, Math.round((db - da) / 60000));
}
function minutesSince(a){
  const da = new Date(a || "");
  if(Number.isNaN(da.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - da.getTime()) / 60000));
}
function calcularTempoMedioOS(rows){
  const vals = rows.map(o => minutesBetween(o.data_abertura || o.criado_em, o.concluida_em)).filter(Boolean);
  if(!vals.length) return 0;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}
function operadorMaisAtivo(logs){
  const map = new Map();
  (logs || []).forEach(l => {
    const nome = nomeOperadorValido(l.operador_nome || l.nome || l.criado_por);
    if(!nome) return;
    map.set(nome, (map.get(nome) || 0) + 1);
  });
  const top = [...map.entries()].sort((a,b)=>b[1]-a[1])[0];
  return top ? {nome:top[0], total:top[1]} : {nome:"Sem operador", total:0};
}
function setorMaisPendente(rows){
  const map = new Map();
  (rows || []).forEach(s => {
    const setor = s.setor_destino || s.setor || "Sem setor";
    map.set(setor, (map.get(setor) || 0) + 1);
  });
  const top = [...map.entries()].sort((a,b)=>b[1]-a[1])[0];
  return top ? {setor:top[0], total:top[1]} : {setor:"Sem pendência", total:0};
}
function estimarFila(rows){
  const abertas = rows.filter(o => !String(o.status || "").toLowerCase().includes("conclu"));
  if(!abertas.length) return "Sem fila";
  const total = abertas.reduce((acc,o)=>acc + estimarRestanteMin(o),0);
  return fmtDuracao(total);
}
function estimarRestanteMin(os){
  const pct = Number(os.percentual_total || 0);
  const aberto = minutesSince(os.data_abertura || os.criado_em);
  const itensRestantes = Math.max(0, Number(os.total_itens || os.total_total || 0) - Number(os.total_concluidos || os.concluidos_total || 0));
  if(pct > 5 && aberto > 0){
    const totalEstimado = Math.round(aberto / (pct / 100));
    return Math.max(0, totalEstimado - aberto);
  }
  return itensRestantes * 6;
}
function osEstaAtrasada(os){
  if(String(os.status || "").toLowerCase().includes("conclu")) return false;
  const aberto = minutesSince(os.data_abertura || os.criado_em);
  const estimadoTotal = Math.max(30, Number(os.total_itens || os.total_total || 1) * 6);
  return aberto > estimadoTotal;
}

function isGestaoOuAdmin(nomeOuPerfil){
  const v = String(nomeOuPerfil || "").toLowerCase();
  return v.includes("admin") || v.includes("administrador") || v.includes("gestor") || v.includes("gestao") || v.includes("gestão") || v.includes("mestre");
}
function nomeOperadorValido(nome){
  const v = String(nome || "").trim();
  if(!v || v === "-" || v.toLowerCase().includes("não informado")) return "";
  if(isGestaoOuAdmin(v)) return "";
  return v;
}
function fmtDuracao(minutos){
  const m = Math.max(0, Math.round(Number(minutos || 0)));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if(d > 0) return `${d}d ${h}h ${mm}min`;
  if(h > 0) return `${h}h ${mm}min`;
  return `${mm}min`;
}
function fmtDuracaoAberto(data){
  const d = new Date(data || "");
  if(Number.isNaN(d.getTime())) return "Sem data";
  const total = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if(dias > 0) return `${dias}d ${horas}h ${mins}min`;
  if(horas > 0) return `${horas}h ${mins}min ${secs}s`;
  if(mins > 0) return `${mins}min ${secs}s`;
  return `${secs}s`;
}
function fatorSetor(setor){
  const s = String(setor || "").toLowerCase();
  if(s.includes("usin")) return 45;
  if(s.includes("elétr") || s.includes("eletr")) return 18;
  if(s.includes("mont")) return 14;
  if(s.includes("desmont")) return 12;
  if(s.includes("almox")) return 10;
  if(s.includes("produ")) return 8;
  return 12;
}
function estimarRestanteMinProf(os){
  const pct = Number(os.percentual_total || 0);
  const aberto = minutesSince(os.data_abertura || os.criado_em);
  const totalItens = Number(os.total_itens || os.total_total || 0);
  const concluidos = Number(os.total_concluidos || os.concluidos_total || 0);
  const pendentes = Math.max(0, totalItens - concluidos);
  const base = fatorSetor(os.setor_atual || os.etapa_atual);
  if(pct > 10 && aberto > 2){
    const totalEstimado = Math.round(aberto / (pct / 100));
    const restantePorRitmo = Math.max(0, totalEstimado - aberto);
    return Math.max(restantePorRitmo, Math.round(pendentes * base * 0.55));
  }
  return Math.round(pendentes * base);
}
function filtrarLogsDaOS(logs, os){
  const cod = String(os?.codigo_os || "").toLowerCase();
  const id = String(os?.id_os || "").toLowerCase();
  return (logs || []).filter(l => {
    const texto = `${l.codigo_os || ""} ${l.id_os || ""} ${l.detalhes || ""} ${l.descricao || ""}`.toLowerCase();
    return (cod && texto.includes(cod)) || (id && (String(l.id_os || "").toLowerCase() === id));
  }).sort((a,b)=> new Date(b.data_hora || b.criado_em || 0) - new Date(a.data_hora || a.criado_em || 0));
}
function inferirOperadorAtual(os, logs=[]){
  const direto = nomeOperadorValido(os.operador_atual_nome || os.responsavel_atual || os.operador_nome);
  if(direto) return direto;
  const logsOS = filtrarLogsDaOS(logs, os);
  for(const l of logsOS){
    const n = nomeOperadorValido(l.operador_nome || l.nome || l.criado_por);
    if(n) return n;
  }
  const criador = nomeOperadorValido(os.criado_por);
  if(criador) return criador;
  return "Sem operador em atividade";
}
function renderTimelineOS(logs, os){
  const rows = filtrarLogsDaOS(logs, os).slice(0,6);
  if(!rows.length) return `<div class="mini-empty">Nenhuma ação registrada para esta OS ainda.</div>`;
  return rows.map(l => `<div class="os-timeline-item">
    <b>${escapeHtml(l.acao || "AÇÃO")}</b>
    <span>${escapeHtml(l.operador_nome || l.nome || "Sistema")} • ${fmtDate(l.data_hora || l.criado_em || l.data)}</span>
    ${l.detalhes || l.descricao ? `<small>${escapeHtml(l.detalhes || l.descricao)}</small>` : ""}
  </div>`).join("");
}

function adminMetricCard(label, value, hint, area){
  return `<button class="kpi kpi-click admin-metric-square" data-admin-card="${area}">
    <small>${escapeHtml(label)}</small><strong>${value}</strong><span>${escapeHtml(hint)}</span>
  </button>`;
}

function renderHomeRequest(s){
  return `<button class="row-card notification-card notification-click" data-open-notifications>
    <strong>Troca de setor pendente</strong>
    <small>${escapeHtml(s.nome || s.matricula)} → ${escapeHtml(s.setor_novo || "-")} • ${fmtDate(s.data_solicitacao)}</small>
  </button>`;
}

async function renderUsers(){
  const area = document.querySelector("#adminArea");
  try{
    const data = await apiGet("adminListarOperadores",{});
    area.innerHTML = `
      ${adminBackBar("Usuários", "Ative, bloqueie e defina o perfil de operação.")}
      <div class="table-list">
        ${data.map(u => renderUserCard(u)).join("") || `<div class="empty">Nenhum usuário cadastrado.</div>`}
      </div>`;

    bindAdminHome(area);
    area.querySelectorAll("[data-toggle]").forEach(b => b.onclick = async () => {
      await apiPost({acao:"adminToggleOperador", matricula:b.dataset.toggle, admin:currentUser().nome});
      toast("Usuário atualizado");
      renderUsers();
    });
    area.querySelectorAll("[data-profile]").forEach(sel => sel.onchange = async () => {
      await apiPost({acao:"adminDefinirPerfil", matricula:sel.dataset.profile, perfil:sel.value, admin:currentUser().nome});
      toast("Perfil atualizado");
      renderUsers();
    });
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar usuários.</div>`;
  }
}

function renderUserCard(u){
  const ativo = String(u.ativo).toLowerCase() !== "false";
  const perfil = String(u.perfil || "Operador");
  const isAdmin = perfil.toLowerCase() === "admin";
  return `<div class="row-card admin-user-card">
    <div class="row-main">
      <strong>${escapeHtml(u.nome)}</strong>
      <small>${escapeHtml(u.matricula)} • ${escapeHtml(u.setor)} • ${ativo ? "Ativo" : "Bloqueado"}</small>
    </div>
    <div class="admin-user-actions">
      <select class="select mini" data-profile="${escapeHtml(u.matricula)}" ${isAdmin ? "disabled" : ""}>
        <option ${perfil==="Operador"?"selected":""}>Operador</option>
        <option ${perfil==="Gestao"?"selected":""}>Gestao</option>
        <option ${perfil==="Admin"?"selected":""}>Admin</option>
      </select>
      <button class="btn ${ativo ? "red" : "green"} compact" data-toggle="${escapeHtml(u.matricula)}" ${isAdmin ? "disabled" : ""}>${ativo ? "Bloquear" : "Ativar"}</button>
    </div>
  </div>`;
}

async function renderAdminOS(){
  const area = document.querySelector("#adminArea");
  try{
    const [data, logs] = await Promise.all([
      apiGet("gestorResumo", {matricula: currentUser().matricula}),
      apiGet("adminLogs", {})
    ]);
    cachedLogs = Array.isArray(logs) ? logs : [];
    const rows = data.os || [];
    area.innerHTML = `
      ${adminBackBar("Gerenciar OS", "Crie, busque, visualize e envie OS para a lixeira lógica.")}
      <div class="admin-os-toolbar">
        <input id="adminSearchOS" class="search-input" placeholder="Buscar: 0001 ou OS-2026-0001" />
        <button id="btnAdminBuscarOS" class="btn light compact">Buscar</button>
        <button id="btnNovaOSAdminList" class="btn blue compact">Nova OS</button>
      </div>
      <div class="admin-os-insights">
        <span>Tempo médio finalizadas: <b>${calcularTempoMedioOS(rows) ? fmtDuracao(calcularTempoMedioOS(rows)) : "--"}</b></span>
        <span>Atrasadas: <b>${rows.filter(osEstaAtrasada).length}</b></span>
        <span>Em andamento: <b>${rows.filter(o=>!String(o.status||"").toLowerCase().includes("conclu")).length}</b></span>
      </div>
      <div class="table-list" id="adminOSList">
        ${rows.map(renderOSAdminCard).join("") || `<div class="empty">Nenhuma OS ativa.</div>`}
      </div>`;

    bindAdminHome(area);
    document.querySelector("#btnNovaOSAdminList").onclick = openNovaOSAdmin;
    document.querySelector("#btnAdminBuscarOS").onclick = () => filtrarAdminOS(rows);
    document.querySelector("#adminSearchOS").addEventListener("keydown", e => { if(e.key === "Enter") filtrarAdminOS(rows); });
    bindAdminOSActions(area, rows);
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar OS.</div>`;
  }
}

function filtrarAdminOS(rows){
  const termo = String(document.querySelector("#adminSearchOS")?.value || "").trim().toLowerCase();
  const list = document.querySelector("#adminOSList");
  const filtradas = !termo ? rows : rows.filter(o => String(o.codigo_os || "").toLowerCase().includes(termo) || String(o.codigo_os || "").slice(-4).includes(termo.padStart(4,"0")) || String(o.motor || "").toLowerCase().includes(termo));
  list.innerHTML = filtradas.map(renderOSAdminCard).join("") || `<div class="empty">Nenhuma OS encontrada.</div>`;
  bindAdminOSActions(document, filtradas);
}

function bindAdminOSActions(area, rows){
  area.querySelectorAll("[data-delete-os]").forEach(btn => btn.onclick = () => confirmarExcluirOS(btn.dataset.deleteOs, btn.dataset.codigo));
  area.querySelectorAll("[data-copy-os]").forEach(btn => btn.onclick = () => confirmarRepublicarOS(btn.dataset.copyOs, btn.dataset.codigo));
  area.querySelectorAll("[data-reset-os]").forEach(btn => btn.onclick = () => confirmarReiniciarOS(btn.dataset.resetOs, btn.dataset.codigo));
  area.querySelectorAll("[data-view-os]").forEach(btn => {
    btn.onclick = () => {
      const os = rows.find(o => String(o.id_os) === String(btn.dataset.viewOs));
      if(os) renderAdminOSViewer(os);
    };
  });
}

function renderOSAdminCard(os){
  const prog = normalizeProgress(os);
  const state = progressState(prog, os.status);
  const aberto = minutesSince(os.data_abertura || os.criado_em);
  const restante = estimarRestanteMinProf(os);
  const atrasada = osEstaAtrasada(os);
  const operadorAtual = inferirOperadorAtual(os, cachedLogs);
  return `<div class="os-card admin-os-card smart-box ${atrasada ? "late" : ""}" data-state="${atrasada ? "atencao" : state}">
    <div class="os-card-top">
      <div>
        <div class="os-code">${escapeHtml(os.codigo_os)}</div>
        <div class="os-motor">${escapeHtml(os.motor)} • ${escapeHtml(os.setor_atual)} • ${escapeHtml(os.status)}</div>
        <div class="os-admin-meta">Criada por: <b>${escapeHtml(os.criado_por || "-")}</b> • ${fmtDate(os.data_abertura)}</div>
        <div class="os-admin-meta">Operador atual: <b>${escapeHtml(operadorAtual)}</b> • aberto há ${fmtDuracao(aberto)}</div>
      </div>
      <div class="admin-card-actions">
        <span class="badge ${atrasada ? "red" : "blue"}">${atrasada ? "Atenção" : escapeHtml(os.etapa_atual)}</span>
        <button class="btn light compact" data-view-os="${escapeHtml(os.id_os)}">Visualizar</button>
        <button class="btn light compact" data-copy-os="${escapeHtml(os.id_os)}" data-codigo="${escapeHtml(os.codigo_os)}">Republicar</button>
        <button class="btn light compact" data-reset-os="${escapeHtml(os.id_os)}" data-codigo="${escapeHtml(os.codigo_os)}">Reiniciar</button>
        <button class="icon-trash-pro" title="Enviar para lixeira" data-delete-os="${escapeHtml(os.id_os)}" data-codigo="${escapeHtml(os.codigo_os)}">${trashSvg()}</button>
      </div>
    </div>
    ${progressHtml("Itens", prog)}
    <div class="progress-meta"><span>restam ~${fmtDuracao(restante)}</span><span>${prog.percentual_total}%</span></div>
  </div>`;
}

async function renderAdminOSViewer(os){
  adminViewingOS = os;
  if(adminViewerTimer) clearInterval(adminViewerTimer);
  const area = document.querySelector("#adminArea");
  const logs = await apiGetFast("adminLogs", {}).catch(()=>[]);
  const operadorAtual = inferirOperadorAtual(os, logs);
  const abertoMin = minutesSince(os.data_abertura || os.criado_em);
  const restanteMin = estimarRestanteMinProf(os);
  const totalItens = Number(os.total_itens || os.total_total || 0);
  const concluidos = Number(os.total_concluidos || os.concluidos_total || 0);
  const pendentes = Math.max(0, totalItens - concluidos);
  const fator = fatorSetor(os.setor_atual || os.etapa_atual);

  area.innerHTML = `
    ${adminBackBarTo(`Visualizando ${os.codigo_os}`, "Modo administrador: rastreie a execução sem virar operador atual.", "os", "← Gerenciar OS")}
    <section class="admin-os-view card os-view-pro">
      <div class="viewer-head">
        <div>
          <h2>${escapeHtml(os.codigo_os)}</h2>
          <p>${escapeHtml(os.motor)} • ${escapeHtml(os.setor_atual)} • ${escapeHtml(os.status)}</p>
        </div>
        <span class="badge blue">Admin</span>
      </div>

      <div class="viewer-grid pro">
        <span>Operador em execução: <b>${escapeHtml(operadorAtual)}</b></span>
        <span>Setor atual: <b>${escapeHtml(os.setor_atual || "-")}</b></span>
        <span>Tempo aberto da OS: <b>${fmtDuracaoAberto(os.data_abertura || os.criado_em)}</b></span>
        <span>Estimativa restante: <b>${fmtDuracao(restanteMin)}</b></span>
        <span>Itens concluídos: <b>${concluidos}/${totalItens}</b></span>
        <span>Pendências: <b>${pendentes}</b></span>
        <span>Constante do setor: <b>${fmtDuracao(fator)} por item</b></span>
        <span>Última atualização: <b>${new Date().toLocaleTimeString("pt-BR")}</b></span>
      </div>
      ${progress("Progresso total", concluidos, totalItens, "green")}
      <div class="admin-mini-note">A estimativa considera progresso atual, tempo aberto e peso do setor. Usinagem recebe peso maior por normalmente exigir mais tempo.</div>
      <div class="viewer-actions"><button id="btnAdminSubFromViewer" class="btn light compact">Criar subtarefa</button></div>
    </section>

    <section class="card os-trace-card">
      <div class="section-head compact-headline"><h3>Rastreabilidade recente</h3><small>Últimas ações registradas nesta OS</small></div>
      <div class="os-timeline">${renderTimelineOS(logs, os)}</div>
    </section>

    <div id="adminViewerChecklist" class="item-list"><div class="empty">Carregando checklist...</div></div>`;
  bindAdminHome(area);
  document.querySelector("#btnAdminSubFromViewer").onclick = () => openSubtaskAdminModal(os);
  await loadAdminViewerChecklist(os);

  adminViewerTimer = setInterval(async()=>{
    if(adminArea !== "os" && !document.querySelector("#adminViewerChecklist")) return clearInterval(adminViewerTimer);
    await loadAdminViewerChecklist(os, true);
  }, 10000);
}

async function loadAdminViewerChecklist(os, silent=false){
  const box = document.querySelector("#adminViewerChecklist");
  try{
    const itens = await apiGet("listarChecklistUnificado", {id_os:os.id_os, etapa:os.etapa_atual});
    if(!Array.isArray(itens) || !itens.length){
      box.innerHTML = `<div class="empty">Checklist sem pendências nesta etapa.</div>`;
      return;
    }
    box.innerHTML = itens.map(item => `<button class="check-item admin-view-check ${item.tipo === "Subtarefa" ? "sub" : ""}" data-admin-item='${encodeURIComponent(JSON.stringify(item))}'>
      <div class="badges"><span class="badge ${item.tipo === "Subtarefa" ? "yellow" : "blue"}">${item.tipo === "Subtarefa" ? "Subtarefa" : "Principal"}</span></div>
      <div class="check-title">${escapeHtml(item.descricao)}</div>
      <div class="check-hint">Admin pode visualizar ou concluir este item</div>
    </button>`).join("");
    box.querySelectorAll("[data-admin-item]").forEach(btn => btn.onclick = () => confirmarItemAdmin(JSON.parse(decodeURIComponent(btn.dataset.adminItem))));
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar checklist da OS.</div>`;
  }
}

function confirmarItemAdmin(item){
  modal({
    title:"Concluir item como Admin?",
    text:`Confirme somente se você realmente quer registrar a conclusão de: ${item.descricao}`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Concluir", className:"green", close:false, onClick:async()=>{
        await apiPost({acao:"concluirItem", id_item:item.id_item, tipo:item.tipo, operador_nome:currentUser().nome, matricula:currentUser().matricula, perfil:currentUser().perfil});
        closeModal();
        toast("Item concluído pelo Admin");
        await loadAdminViewerChecklist(adminViewingOS);
      }}
    ]
  });
}

function openSubtaskAdminModal(os){
  modal({
    title:"Nova subtarefa",
    text:"Crie uma pendência para outro setor dentro desta OS.",
    html:`<textarea id="adminSubDesc" placeholder="Descrição da pendência"></textarea>
      <select id="adminSubSetor" class="select" style="margin-top:8px">
        <option>Elétrica</option><option>Usinagem</option><option>Montagem</option><option>Desmontagem</option><option>Produção</option><option>Almoxarifado</option>
      </select>`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Criar", className:"green", close:false, onClick:async()=>{
        const descricao = document.querySelector("#adminSubDesc").value.trim();
        if(!descricao) return toast("Descreva a pendência");
        await apiPost({acao:"criarSubtarefa", id_os:os.id_os, descricao, setor_destino:document.querySelector("#adminSubSetor").value, operador_nome:currentUser().nome});
        closeModal();
        toast("Subtarefa criada");
        await loadAdminViewerChecklist(os);
      }}
    ]
  });
}

function trashSvg(){
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2l1 11h4l1-11h2l-1.2 13H8.2L7 9Z" fill="currentColor"/></svg>`;
}

async function renderSubtarefasPendentes(){
  const area = document.querySelector("#adminArea");
  try{
    const rows = await apiGet("adminSubtarefasPendentes", {});
    area.innerHTML = `
      ${adminBackBar("Subtarefas pendentes", "Pendências abertas por setor, OS e responsável.")}
      <div class="table-list">
        ${rows.length ? rows.map(renderSubCard).join("") : `<div class="empty">Nenhuma subtarefa pendente.</div>`}
      </div>`;
    bindAdminHome(area);
    area.querySelectorAll("[data-edit-sub]").forEach(btn => btn.onclick = () => {
      const sub = rows.find(s => String(s.id_subtarefa) === String(btn.dataset.editSub));
      if(sub) abrirEditarSubtarefaAdmin(sub);
    });
    area.querySelectorAll("[data-delete-sub]").forEach(btn => btn.onclick = () => confirmarExcluirSubtarefa(btn.dataset.deleteSub));
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar subtarefas pendentes.</div>`;
  }
}

function renderSubCard(s){
  return `<div class="row-card sub-admin-card">
    <div class="row-main">
      <strong>${escapeHtml(s.descricao || "Subtarefa")}</strong>
      <small>${escapeHtml(s.codigo_os || "-")} • destino: ${escapeHtml(s.setor_destino || "-")} • origem: ${escapeHtml(s.setor_origem || "-")}</small>
      <small>Criada por ${escapeHtml(s.criado_por || "-")} em ${fmtDate(s.criado_em)}</small>
    </div>
    <div class="admin-card-actions sub-actions">
      <span class="badge yellow">Pendente</span>
      <button class="btn light compact" data-edit-sub="${escapeHtml(s.id_subtarefa)}">Editar</button>
      <button class="icon-trash-pro" title="Excluir subtarefa" data-delete-sub="${escapeHtml(s.id_subtarefa)}">${trashSvg()}</button>
    </div>
  </div>`;
}

function abrirEditarSubtarefaAdmin(s){
  modal({
    title:"Editar subtarefa",
    text:`Ajuste a pendência vinculada à ${s.codigo_os || "OS"}.`,
    html:`<textarea id="editSubDesc" placeholder="Descrição da pendência">${escapeHtml(s.descricao || "")}</textarea>
      <select id="editSubOrigem" class="select" style="margin-top:8px">
        ${["Desmontagem","Montagem","Elétrica","Usinagem","Produção","Almoxarifado"].map(x=>`<option ${String(s.setor_origem)===x?"selected":""}>${x}</option>`).join("")}
      </select>
      <select id="editSubDestino" class="select" style="margin-top:8px">
        ${["Desmontagem","Montagem","Elétrica","Usinagem","Produção","Almoxarifado"].map(x=>`<option ${String(s.setor_destino)===x?"selected":""}>${x}</option>`).join("")}
      </select>`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Salvar", className:"green", close:false, onClick:async()=>{
        const descricao = document.querySelector("#editSubDesc").value.trim();
        if(!descricao) return toast("Informe a descrição");
        await apiPost({acao:"editarSubtarefa", id_subtarefa:s.id_subtarefa, descricao, setor_origem:document.querySelector("#editSubOrigem").value, setor_destino:document.querySelector("#editSubDestino").value, operador_nome:currentUser().nome});
        closeModal();
        toast("Subtarefa atualizada");
        renderSubtarefasPendentes();
      }}
    ]
  });
}

function confirmarExcluirSubtarefa(id){
  modal({
    title:"Excluir subtarefa?",
    text:"A subtarefa será marcada como excluída e deixará de aparecer como pendente.",
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Excluir", className:"red", close:false, onClick:async()=>{
        await apiPost({acao:"excluirSubtarefa", id_subtarefa:id, operador_nome:currentUser().nome});
        closeModal();
        toast("Subtarefa excluída");
        renderSubtarefasPendentes();
      }}
    ]
  });
}

function confirmarExcluirOS(id, codigo){
  modal({
    title:"Enviar OS para lixeira?",
    text:`A OS ${codigo} ficará recuperável pela administração.`,
    html:`<input id="motivoExclusao" class="input" placeholder="Motivo da exclusão (opcional)" />`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Enviar", className:"red", close:false, onClick:async()=>{
        await apiPost({acao:"excluirOS", id_os:id, operador_nome:currentUser().nome, motivo:document.querySelector("#motivoExclusao").value});
        closeModal();
        toast("OS enviada para lixeira");
        renderAdminOS();
      }}
    ]
  });
}


function confirmarRepublicarOS(id, codigo){
  modal({
    title:"Republicar OS?",
    text:`Será criada uma nova OS com base na estrutura da ${codigo}. O código original não será duplicado.`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Republicar", className:"blue", close:false, onClick:async()=>{
        await apiPost({acao:"republicarOS", id_os:id, operador_nome:currentUser().nome, matricula:currentUser().matricula, perfil:currentUser().perfil});
        closeModal();
        toast("OS republicada como nova ordem");
        renderAdminOS();
      }}
    ]
  });
}

function confirmarReiniciarOS(id, codigo){
  modal({
    title:"Reiniciar OS?",
    text:`A ${codigo} será zerada: todos os itens voltarão para pendente e a OS seguirá como Em processo.`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Reiniciar", className:"red", close:false, onClick:async()=>{
        await apiPost({acao:"reiniciarOS", id_os:id, operador_nome:currentUser().nome, matricula:currentUser().matricula, perfil:currentUser().perfil});
        closeModal();
        toast("OS reiniciada");
        renderAdminOS();
      }}
    ]
  });
}

async function renderTrash(){
  const area = document.querySelector("#adminArea");
  try{
    const [osRows, subRows] = await Promise.all([
      apiGet("adminLixeiraOS",{}),
      apiGet("adminLixeiraSubtarefas",{}).catch(()=>[])
    ]);
    area.innerHTML = `
      ${adminBackBar("Lixeira", "Recupere OS e subtarefas excluídas logicamente.")}
      <div class="section-head compact-headline"><h3>OS excluídas</h3><small>Ao recuperar uma OS, suas subtarefas voltam junto quando existirem.</small></div>
      <div class="table-list">
        ${osRows.length ? osRows.map(os => `<div class="row-card trash-card">
          <strong>${escapeHtml(os.codigo_os)}</strong>
          <small>${escapeHtml(os.motor)} • ${escapeHtml(os.setor_atual)} • ${escapeHtml(os.status)}</small>
          <button class="btn green full" data-restore="${escapeHtml(os.id_os)}" style="margin-top:8px">Recuperar OS</button>
        </div>`).join("") : `<div class="empty">Nenhuma OS na lixeira.</div>`}
      </div>

      <div class="section-head compact-headline" style="margin-top:18px"><h3>Subtarefas excluídas</h3><small>Use quando uma pendência foi removida por engano.</small></div>
      <div class="table-list">
        ${subRows.length ? subRows.map(s => `<div class="row-card trash-card">
          <strong>${escapeHtml(s.codigo_os || "OS")}</strong>
          <small>${escapeHtml(s.descricao)} • ${escapeHtml(s.setor_origem || "-")} → ${escapeHtml(s.setor_destino || "-")}</small>
          <button class="btn green full" data-restore-sub="${escapeHtml(s.id_subtarefa)}" style="margin-top:8px">Recuperar subtarefa</button>
        </div>`).join("") : `<div class="empty">Nenhuma subtarefa na lixeira.</div>`}
      </div>`;
    bindAdminHome(area);
    area.querySelectorAll("[data-restore]").forEach(b => b.onclick = async () => {
      await apiPost({acao:"recuperarOS", id_os:b.dataset.restore, operador_nome:currentUser().nome});
      toast("OS recuperada");
      renderTrash();
    });
    area.querySelectorAll("[data-restore-sub]").forEach(b => b.onclick = async () => {
      await apiPost({acao:"recuperarSubtarefa", id_subtarefa:b.dataset.restoreSub, operador_nome:currentUser().nome});
      toast("Subtarefa recuperada");
      renderTrash();
    });
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar lixeira.</div>`;
  }
}

async function renderHistoricoAdmin(){
  const area = document.querySelector("#adminArea");
  try{
    const [hist, logs] = await Promise.all([
      apiGet("listarHistorico", {matricula: currentUser().matricula, perfil:"Admin"}),
      apiGet("adminLogs", {})
    ]);
    const historico = (hist || []).map(h => ({...h, origem:"Histórico"}));
    const auditoria = (logs || []).map(l => ({
      data_hora:l.data_hora,
      acao:l.acao,
      operador_nome:l.operador_nome,
      codigo_os:l.codigo_os,
      setor:"Sistema",
      detalhes:l.detalhes,
      origem:"Log"
    }));
    const rows = historico.concat(auditoria).sort((a,b)=>new Date(b.data_hora)-new Date(a.data_hora)).slice(0,120);
    area.innerHTML = `
      ${adminBackBar("Histórico e auditoria", "Registro detalhado de ações, operadores, OS, setor e horários.")}
      <div class="timeline-list">
        ${rows.length ? rows.map(renderHistoryAdminCard).join("") : `<div class="empty">Sem histórico ainda.</div>`}
      </div>`;
    bindAdminHome(area);
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar histórico.</div>`;
  }
}

function renderHistoryAdminCard(r){
  return `<div class="timeline-card">
    <div class="timeline-top">
      <strong>${escapeHtml(r.acao || "Ação")}</strong>
      <span class="badge ${r.origem === "Log" ? "yellow" : "blue"}">${escapeHtml(r.origem || "Histórico")}</span>
    </div>
    <div class="timeline-details">
      <span><b>Quem:</b> ${escapeHtml(r.operador_nome || "Sistema")}</span>
      <span><b>OS:</b> ${escapeHtml(r.codigo_os || "-")}</span>
      <span><b>Setor:</b> ${escapeHtml(r.setor || "-")}</span>
      <span><b>Quando:</b> ${fmtDate(r.data_hora)}</span>
    </div>
    ${r.detalhes ? `<p>${escapeHtml(r.detalhes)}</p>` : ""}
  </div>`;
}

function renderLogCard(l){
  return `<div class="row-card notification-card">
    <strong>${escapeHtml(l.acao || "Notificação")}</strong>
    <small>${escapeHtml(l.operador_nome || "Sistema")} • ${escapeHtml(l.codigo_os || "-")} • ${fmtDate(l.data_hora)}</small>
    ${l.detalhes ? `<small>${escapeHtml(l.detalhes)}</small>` : ""}
  </div>`;
}

async function renderAdminModelos(){
  const area = document.querySelector("#adminArea");
  try{
    const data = await apiGet("listarModelosAtivos", {});
    area.innerHTML = `
      ${adminBackBar("Modelos de checklist", "Crie padrões por setor para novas OS e subtarefas.")}
      <button id="btnAdminNovoModelo" class="btn blue full">Novo item de modelo</button>
      <div class="table-list" style="margin-top:12px">
        ${data.length ? data.map(m => `<div class="row-card"><strong>${escapeHtml(m.nome_modelo)}</strong><small>${escapeHtml(m.tipo)} • ${escapeHtml(m.setor)} • Ordem ${m.ordem}</small><small>${escapeHtml(m.descricao)}</small></div>`).join("") : `<div class="empty">Sem modelos ativos.</div>`}
      </div>`;
    bindAdminHome(area);
    document.querySelector("#btnAdminNovoModelo").onclick = openNovoModeloAdmin;
  }catch(e){
    area.innerHTML = `<div class="empty">Erro ao carregar modelos.</div>`;
  }
}

async function openNovaOSAdmin(){
  try{
    const modelos = await apiGet("listarModelosAtivos", {});
    const principais = modelos.filter(m => String(m.tipo || "").toLowerCase() === "principal");
    const gruposMap = new Map();
    principais.forEach(m=>{
      const key = `${m.nome_modelo || m.setor}|${m.setor}`;
      if(!gruposMap.has(key)) gruposMap.set(key, m);
    });
    const grupos = [...gruposMap.values()];
    const setores = [...new Set(grupos.map(m => m.setor).filter(Boolean))];

    modal({
      title:"Criar nova OS",
      text:"O administrador cria a OS e direciona o setor inicial.",
      html:`<input id="novoMotorAdmin" class="input" placeholder="Motor / conjunto / equipamento" />
        <select id="novoSetorAdmin" class="select" style="margin-top:8px">${setores.map(s=>`<option>${escapeHtml(s)}</option>`).join("")}</select>
        <select id="novoModeloAdmin" class="select" style="margin-top:8px">${grupos.map(m=>`<option value="${escapeHtml(m.id_modelo)}">${escapeHtml(m.nome_modelo)} • ${escapeHtml(m.setor)}</option>`).join("")}</select>`,
      actions:[
        {label:"Cancelar", className:"light"},
        {label:"Criar", className:"blue", close:false, onClick:async()=>{
          const motor = document.querySelector("#novoMotorAdmin").value.trim();
          if(!motor) return toast("Informe o motor");
          await apiPost({acao:"criarOS", motor, setor_inicial:document.querySelector("#novoSetorAdmin").value, id_modelo:document.querySelector("#novoModeloAdmin").value, criado_por:currentUser().nome, criado_por_matricula:currentUser().matricula});
          closeModal();
          toast("OS criada");
          renderAdmin("os");
        }}
      ]
    });
  }catch(e){
    toast("Erro ao abrir criação de OS");
  }
}

function openNovoModeloAdmin(){
  modal({
    title:"Novo item de modelo",
    text:"Crie um item padrão para um setor.",
    html:`<input id="modNomeAdmin" class="input" placeholder="Nome do modelo" />
      <select id="modTipoAdmin" class="select" style="margin-top:8px"><option>Principal</option><option>Subtarefa</option></select>
      <select id="modSetorAdmin" class="select" style="margin-top:8px"><option>Desmontagem</option><option>Montagem</option><option>Elétrica</option><option>Usinagem</option><option>Produção</option><option>Almoxarifado</option></select>
      <textarea id="modDescAdmin" placeholder="Descrição do item"></textarea>`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Salvar", className:"green", close:false, onClick:async()=>{
        const descricao = document.querySelector("#modDescAdmin").value.trim();
        if(!descricao) return toast("Informe a descrição do item");
        await apiPost({acao:"criarModeloChecklist", nome_modelo:document.querySelector("#modNomeAdmin").value, tipo:document.querySelector("#modTipoAdmin").value, setor:document.querySelector("#modSetorAdmin").value, descricao, criado_por:currentUser().nome});
        closeModal();
        toast("Modelo criado");
        renderAdmin("modelos");
      }}
    ]
  });
}


async function renderAdminSetoresDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const setores = await apiGet("listarSetores", {}).catch(()=>[]);
    box.innerHTML = `
      <section class="admin-desktop-section">
        <h2>Setores e áreas</h2>
        <p class="page-subtitle">Crie setores operacionais que serão usados em OS, subtarefas, permissões e fluxos.</p>

        <div class="admin-config-layout" style="margin-top:18px">
          <form id="formNovoSetor" class="admin-config-form">
            <input id="setorNome" placeholder="Nome do setor. Ex: Qualidade" />
            <input id="setorCodigo" placeholder="Código. Ex: QUA" />
            <select id="setorTipo">
              <option>Operacional</option>
              <option>Gestão</option>
              <option>Administrativo</option>
              <option>Suporte</option>
            </select>
            <textarea id="setorDescricao" placeholder="Descrição do setor"></textarea>
            <button class="btn blue full" type="submit">Criar setor</button>
          </form>

          <div class="admin-config-list">
            ${(setores || []).length ? setores.map(s=>`
              <div class="admin-config-list-item">
                <div>
                  <b>${escapeHtml(s.nome_setor || s.nome || "-")}</b>
                  <small>${escapeHtml(s.codigo_setor || s.codigo || "-")} • ${escapeHtml(s.descricao || "Sem descrição")}</small>
                </div>
                <span class="admin-config-badge">${escapeHtml(s.tipo || "Operacional")}</span>
              </div>
            `).join("") : `<div class="empty">Nenhum setor configurável criado ainda.</div>`}
          </div>
        </div>
      </section>
    `;

    document.querySelector("#formNovoSetor").onsubmit = async (e)=>{
      e.preventDefault();
      const nome = document.querySelector("#setorNome").value.trim();
      if(!nome) return toast("Informe o nome do setor");
      await apiPost({
        acao:"criarSetor",
        nome_setor:nome,
        codigo_setor:document.querySelector("#setorCodigo").value.trim(),
        tipo:document.querySelector("#setorTipo").value,
        descricao:document.querySelector("#setorDescricao").value.trim(),
        criado_por:currentUser().nome,
        matricula:currentUser().matricula
      });
      toast("Setor criado");
      renderAdminSetoresDesktop();
    };
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar setores.</div>`;
  }
}

async function renderAdminFluxosDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const [fluxos, setores] = await Promise.all([
      apiGet("listarFluxos", {}).catch(()=>[]),
      apiGet("listarSetores", {}).catch(()=>[])
    ]);
    const setorOptions = (setores || []).map(s=>`<option>${escapeHtml(s.nome_setor || s.nome || "")}</option>`).join("") || `<option>Desmontagem</option><option>Montagem</option><option>Elétrica</option><option>Usinagem</option><option>Qualidade</option>`;

    box.innerHTML = `
      <section class="admin-desktop-section">
        <h2>Fluxos operacionais</h2>
        <p class="page-subtitle">Configure a sequência de etapas. Isso prepara o sistema para deixar de ser fixo em Desmontagem → Montagem.</p>

        <div class="admin-config-layout" style="margin-top:18px">
          <form id="formNovoFluxo" class="admin-config-form">
            <input id="fluxoNome" placeholder="Nome do fluxo. Ex: Manutenção de motor" />
            <select id="fluxoEtapa">${setorOptions}</select>
            <input id="fluxoOrdem" placeholder="Ordem. Ex: 1" type="number" />
            <textarea id="fluxoRegra" placeholder="Regra de liberação. Ex: liberar somente após checklist e subtarefas"></textarea>
            <button class="btn blue full" type="submit">Adicionar etapa</button>
          </form>

          <div class="admin-config-list">
            ${(fluxos || []).length ? fluxos.map(f=>`
              <div class="admin-config-list-item">
                <div>
                  <b>${escapeHtml(f.nome_fluxo || "Fluxo")}</b>
                  <small>Etapa: ${escapeHtml(f.etapa || "-")} • Ordem ${escapeHtml(f.ordem || "-")}<br>${escapeHtml(f.regra || "Sem regra")}</small>
                </div>
                <span class="admin-config-badge">${escapeHtml(f.ativo || "Ativo")}</span>
              </div>
            `).join("") : `<div class="empty">Nenhum fluxo configurável criado ainda.</div>`}
          </div>
        </div>
      </section>
    `;

    document.querySelector("#formNovoFluxo").onsubmit = async (e)=>{
      e.preventDefault();
      const nome = document.querySelector("#fluxoNome").value.trim();
      if(!nome) return toast("Informe o nome do fluxo");
      await apiPost({
        acao:"criarFluxo",
        nome_fluxo:nome,
        etapa:document.querySelector("#fluxoEtapa").value,
        ordem:document.querySelector("#fluxoOrdem").value || "1",
        regra:document.querySelector("#fluxoRegra").value.trim(),
        criado_por:currentUser().nome,
        matricula:currentUser().matricula
      });
      toast("Etapa adicionada ao fluxo");
      renderAdminFluxosDesktop();
    };
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar fluxos.</div>`;
  }
}

async function renderAdminAprovacoesDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  if(!box) return;
  box.innerHTML = `<div class="v36-loading">Carregando aprovações...</div>`;

  try{
    const [trocas, genericas] = await Promise.all([
      apiGet("adminSolicitacoesSetor", {}).catch(()=>[]),
      apiGet("listarSolicitacoesAdmin", {}).catch(()=>[])
    ]);

    const trocaCards = (trocas || []).map(s=>({
      tipo:"troca_setor",
      id:s.id_solicitacao,
      titulo:`Troca de setor — ${s.nome || s.matricula}`,
      desc:`${s.setor_atual || "-"} → ${s.setor_novo || "-"} • ${fmtDate(s.data_solicitacao)}`,
      status:s.status || "Pendente"
    }));

    const genericCards = (genericas || []).map(s=>({
      tipo:"generica",
      id:s.id_solicitacao,
      titulo:`${s.tipo || "Solicitação"} — ${s.criado_por || "Gestão"}`,
      desc:`${s.titulo || "-"} • ${fmtDate(s.criado_em)} • ${s.descricao || ""}`,
      status:s.status || "Pendente"
    }));

    const all = [...genericCards, ...trocaCards];

    box.innerHTML = `
      <section class="admin-desktop-section">
        <div class="v35-toolbar">
          <div>
            <h2>Aprovações</h2>
            <p class="page-subtitle">Central para aprovar solicitações vindas da operação e da gestão.</p>
          </div>
          <span class="v35-status-pill orange">${all.filter(x=>String(x.status).toLowerCase()==="pendente").length} pendente(s)</span>
        </div>

        <div class="approval-list">
          ${all.length ? all.map(s=>`
            <article class="approval-card">
              <div>
                <h3>${escapeHtml(s.titulo)}</h3>
                <p>${escapeHtml(s.desc)}</p>
              </div>
              <div class="approval-actions">
                <span class="approval-status ${String(s.status).toLowerCase()==="pendente"?"pending":String(s.status).toLowerCase()==="aprovado"?"approved":"rejected"}">${escapeHtml(s.status)}</span>
                ${String(s.status).toLowerCase()==="pendente" ? `
                  <button class="btn green compact" data-approve-type="${s.tipo}" data-approve-id="${s.id}">Aprovar</button>
                  <button class="btn red compact" data-reject-type="${s.tipo}" data-reject-id="${s.id}">Rejeitar</button>
                ` : ""}
              </div>
            </article>
          `).join("") : `<div class="v35-empty-state">Nenhuma aprovação no momento.</div>`}
        </div>
      </section>
    `;

    document.querySelectorAll("[data-approve-id]").forEach(btn=>{
      btn.onclick = async()=>{
        await responderAprovacao(btn.dataset.approveType, btn.dataset.approveId, "Aprovado");
      };
    });

    document.querySelectorAll("[data-reject-id]").forEach(btn=>{
      btn.onclick = async()=>{
        await responderAprovacao(btn.dataset.rejectType, btn.dataset.rejectId, "Rejeitado");
      };
    });
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar aprovações.</div>`;
  }
}

async function responderAprovacao(tipo, id, status){
  try{
    if(tipo === "troca_setor"){
      await apiPost({
        acao:"adminResponderTrocaSetor",
        id_solicitacao:id,
        status,
        admin:currentUser().nome
      });
    }else{
      await apiPost({
        acao:"responderSolicitacaoAdmin",
        id_solicitacao:id,
        status,
        respondido_por:currentUser().nome,
        matricula:currentUser().matricula
      });
    }
    toast(`Solicitação ${status.toLowerCase()}`);
    renderAdminAprovacoesDesktop();
  }catch(e){
    toast(e.message || "Erro ao responder solicitação");
  }
}

async function renderAdminSistemaDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const cfg = await apiGet("listarConfigSistema", {}).catch(()=>({}));
    box.innerHTML = `
      <section class="admin-desktop-section">
        <h2>Configurações do sistema</h2>
        <p class="page-subtitle">Transforme o app em uma plataforma maleável: nome, modo de uso e regras visuais.</p>

        ${renderDataAccelerationPanel()}

        <div class="admin-config-layout" style="margin-top:18px">
          <form id="formSistema" class="admin-config-form">
            <input id="cfgNomeSistema" placeholder="Nome do sistema" value="${escapeHtml(cfg.nome_sistema || "Projeto Natan V3")}" />
            <select id="cfgModoSistema">
              <option ${cfg.modo_sistema==="OS Motores"?"selected":""}>OS Motores</option>
              <option ${cfg.modo_sistema==="Fluxo Personalizado"?"selected":""}>Fluxo Personalizado</option>
              <option ${cfg.modo_sistema==="Checklist Industrial"?"selected":""}>Checklist Industrial</option>
            </select>
            <select id="cfgTemaPadrao">
              <option ${cfg.tema_padrao==="light"?"selected":""} value="light">Claro</option>
              <option ${cfg.tema_padrao==="dark"?"selected":""} value="dark">Escuro</option>
            </select>
            <textarea id="cfgDescricao" placeholder="Descrição do sistema">${escapeHtml(cfg.descricao || "")}</textarea>
            <button class="btn blue full" type="submit">Salvar configurações</button>
          </form>

          <div class="admin-permission-grid">
            <div class="admin-permission-card">
              <h3>Admin</h3>
              <div class="admin-permission-row"><span>Usuários</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Permissões</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Setores</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Auditoria completa</span><b>Sim</b></div>
            </div>
            <div class="admin-permission-card">
              <h3>Gestão</h3>
              <div class="admin-permission-row"><span>Ver métricas</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Criar subtarefa</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Editar usuários</span><b>Não</b></div>
              <div class="admin-permission-row"><span>Solicitar mudança</span><b>Sim</b></div>
            </div>
            <div class="admin-permission-card">
              <h3>Operador</h3>
              <div class="admin-permission-row"><span>Executar checklist</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Ler QR</span><b>Sim</b></div>
              <div class="admin-permission-row"><span>Configurar sistema</span><b>Não</b></div>
              <div class="admin-permission-row"><span>Auditoria</span><b>Não</b></div>
            </div>
          </div>
        </div>
      </section>
    `;

    bindDataAccelerationPanel(renderAdminSistemaDesktop);

    document.querySelector("#formSistema").onsubmit = async (e)=>{
      e.preventDefault();
      await apiPost({
        acao:"salvarConfigSistema",
        nome_sistema:document.querySelector("#cfgNomeSistema").value.trim(),
        modo_sistema:document.querySelector("#cfgModoSistema").value,
        tema_padrao:document.querySelector("#cfgTemaPadrao").value,
        descricao:document.querySelector("#cfgDescricao").value.trim(),
        operador_nome:currentUser().nome,
        matricula:currentUser().matricula
      });
      toast("Configurações salvas");
      renderAdminSistemaDesktop();
    };
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar configurações.</div>`;
  }
}


const PERMISSION_CATALOG = [
  ["ver_dashboard", "Ver dashboard", "Acessar indicadores e visão geral."],
  ["gerenciar_os", "Gerenciar OS", "Criar, visualizar, reiniciar ou republicar ordens."],
  ["criar_subtarefa", "Criar subtarefa", "Abrir pendências para outros setores."],
  ["editar_modelos", "Editar modelos", "Criar e alterar modelos de checklist."],
  ["solicitar_alteracao", "Solicitar alteração", "Enviar alterações para aprovação do Admin."],
  ["aprovar_alteracao", "Aprovar alterações", "Aprovar mudanças solicitadas pela gestão."],
  ["gerenciar_usuarios", "Gerenciar usuários", "Ativar, bloquear e alterar perfis."],
  ["gerenciar_setores", "Gerenciar setores", "Criar e editar setores/áreas."],
  ["gerenciar_fluxos", "Gerenciar fluxos", "Criar fluxos operacionais."],
  ["ver_auditoria_completa", "Auditoria completa", "Ver logs e rastreabilidade total."],
  ["usar_lixeira", "Usar lixeira", "Recuperar OS e subtarefas excluídas."],
  ["configurar_sistema", "Configurar sistema", "Alterar nome, modo, tema e regras gerais."]
];

function defaultPermissao(perfil, chave){
  const p = String(perfil || "").toLowerCase();
  if(p === "admin") return true;
  if(p === "gestao" || p === "gestor"){
    return ["ver_dashboard","gerenciar_os","criar_subtarefa","editar_modelos","solicitar_alteracao"].includes(chave);
  }
  return ["ver_dashboard","criar_subtarefa"].includes(chave);
}

async function renderAdminPermissoesDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const [usuarios, permissoes] = await Promise.all([
      apiGet("adminListarOperadores", {}),
      apiGet("listarPermissoes", {}).catch(()=>[])
    ]);

    const perfis = ["Admin","Gestao","Operador"];
    const perfilInicial = "Gestao";

    box.innerHTML = `
      <section class="admin-desktop-section">
        <h2>Usuários e permissões</h2>
        <p class="page-subtitle">Defina o que cada perfil pode acessar. O Admin controla o sistema; Gestão opera e solicita; Operador executa.</p>

        <div class="permission-layout" style="margin-top:18px">
          <div class="permission-profile-card">
            <h2>Matriz de permissões</h2>
            <p>Selecione um perfil e libere apenas os módulos necessários.</p>
            <select id="permissionPerfil" class="permission-select">
              ${perfis.map(p=>`<option ${p===perfilInicial?"selected":""}>${p}</option>`).join("")}
            </select>
            <button id="btnSalvarPermissoes" class="btn blue full" style="margin-top:12px">Salvar permissões</button>
          </div>

          <div>
            <div id="permissionGrid" class="permission-grid"></div>
          </div>
        </div>
      </section>

      <section class="admin-desktop-section" style="margin-top:18px">
        <h2>Usuários cadastrados</h2>
        <p class="page-subtitle">Controle perfil e bloqueio de acesso.</p>
        <div class="permission-user-list" style="margin-top:14px">
          ${(usuarios || []).map(u=>`
            <div class="permission-user-row">
              <div>
                <b>${escapeHtml(u.nome || "-")}</b>
                <small>${escapeHtml(u.matricula || "-")} • ${escapeHtml(u.setor || "-")} • ${String(u.ativo).toLowerCase()==="false" ? "Bloqueado" : "Ativo"}</small>
              </div>
              <select class="permission-select" data-profile="${escapeHtml(u.matricula)}" ${String(u.perfil).toLowerCase()==="admin" ? "disabled" : ""}>
                <option ${u.perfil==="Operador"?"selected":""}>Operador</option>
                <option ${u.perfil==="Gestao"?"selected":""}>Gestao</option>
                <option ${u.perfil==="Admin"?"selected":""}>Admin</option>
              </select>
              <button class="btn ${String(u.ativo).toLowerCase()==="false" ? "green" : "red"} compact" data-toggle="${escapeHtml(u.matricula)}" ${String(u.perfil).toLowerCase()==="admin" ? "disabled" : ""}>
                ${String(u.ativo).toLowerCase()==="false" ? "Ativar" : "Bloquear"}
              </button>
            </div>
          `).join("") || `<div class="empty">Nenhum usuário cadastrado.</div>`}
        </div>
      </section>
    `;

    const getPermsByPerfil = (perfil)=>{
      const rows = (permissoes || []).filter(p=>String(p.perfil) === String(perfil));
      const map = {};
      rows.forEach(r=>map[r.chave] = String(r.valor).toLowerCase() !== "false");
      return map;
    };

    function drawPermissionGrid(){
      const perfil = document.querySelector("#permissionPerfil").value;
      const saved = getPermsByPerfil(perfil);
      const grid = document.querySelector("#permissionGrid");
      grid.innerHTML = PERMISSION_CATALOG.map(([chave,titulo,desc])=>{
        const active = Object.prototype.hasOwnProperty.call(saved,chave) ? saved[chave] : defaultPermissao(perfil,chave);
        return `
          <button type="button" class="permission-toggle ${active ? "active" : ""}" data-permission="${chave}">
            <div>
              <b>${titulo}</b>
              <small>${desc}</small>
            </div>
            <span class="permission-switch"></span>
          </button>
        `;
      }).join("");

      grid.querySelectorAll("[data-permission]").forEach(btn=>{
        btn.onclick = ()=>btn.classList.toggle("active");
      });
    }

    document.querySelector("#permissionPerfil").onchange = drawPermissionGrid;
    drawPermissionGrid();

    document.querySelector("#btnSalvarPermissoes").onclick = async ()=>{
      const perfil = document.querySelector("#permissionPerfil").value;
      const payload = {};
      document.querySelectorAll("[data-permission]").forEach(btn=>{
        payload[btn.dataset.permission] = btn.classList.contains("active");
      });
      await apiPost({
        acao:"salvarPermissoes",
        perfil,
        permissoes:payload,
        operador_nome:currentUser().nome,
        matricula:currentUser().matricula
      });
      toast("Permissões salvas");
      renderAdminPermissoesDesktop();
    };

    document.querySelectorAll("[data-toggle]").forEach(b=>b.onclick = async()=>{
      await apiPost({acao:"adminToggleOperador", matricula:b.dataset.toggle, admin:currentUser().nome});
      toast("Usuário atualizado");
      renderAdminPermissoesDesktop();
    });

    document.querySelectorAll("[data-profile]").forEach(sel=>sel.onchange = async()=>{
      await apiPost({acao:"adminDefinirPerfil", matricula:sel.dataset.profile, perfil:sel.value, admin:currentUser().nome});
      toast("Perfil atualizado");
      renderAdminPermissoesDesktop();
    });
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar permissões.</div>`;
  }
}


async function renderAdminAuditoriaDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const rows = await apiGet("auditoriaFiltrada", {}).catch(()=>[]);
    box.innerHTML = `
      <section class="admin-desktop-section">
        <div class="v35-toolbar">
          <div>
            <h2>Auditoria completa</h2>
            <p class="page-subtitle">Filtre logs, histórico, operador, OS, ação e período.</p>
          </div>
          <button id="btnAuditRefresh" class="btn light compact">Atualizar</button>
        </div>

        <div class="v35-filter-grid">
          <input id="auditAcao" class="v35-input" placeholder="Ação" />
          <input id="auditOperador" class="v35-input" placeholder="Operador" />
          <input id="auditOS" class="v35-input" placeholder="OS" />
          <input id="auditSetor" class="v35-input" placeholder="Setor" />
        </div>

        <div id="auditResults" class="v35-table-wrap"></div>
      </section>
    `;

    const renderRows = (data)=>{
      const result = document.querySelector("#auditResults");
      result.innerHTML = `
        <table class="admin-desktop-table">
          <thead>
            <tr><th>Origem</th><th>Ação</th><th>Operador</th><th>OS</th><th>Setor</th><th>Data</th><th>Detalhes</th></tr>
          </thead>
          <tbody>
            ${data.slice(0,160).map(r=>`
              <tr>
                <td>${escapeHtml(r.origem || "-")}</td>
                <td>${escapeHtml(r.acao || "-")}</td>
                <td>${escapeHtml(r.operador_nome || "Sistema")}</td>
                <td>${escapeHtml(r.codigo_os || "-")}</td>
                <td>${escapeHtml(r.setor || "-")}</td>
                <td>${fmtDate(r.data_hora)}</td>
                <td>${escapeHtml(r.detalhes || "-")}</td>
              </tr>
            `).join("") || `<tr><td colspan="7">Nenhum registro encontrado.</td></tr>`}
          </tbody>
        </table>
      `;
    };

    const applyFilter = ()=>{
      const acao = document.querySelector("#auditAcao").value.toLowerCase();
      const operador = document.querySelector("#auditOperador").value.toLowerCase();
      const os = document.querySelector("#auditOS").value.toLowerCase();
      const setor = document.querySelector("#auditSetor").value.toLowerCase();

      const filtered = rows.filter(r=>{
        return (!acao || String(r.acao||"").toLowerCase().includes(acao))
          && (!operador || String(r.operador_nome||"").toLowerCase().includes(operador))
          && (!os || String(r.codigo_os||"").toLowerCase().includes(os))
          && (!setor || String(r.setor||"").toLowerCase().includes(setor));
      });

      renderRows(filtered);
    };

    ["#auditAcao","#auditOperador","#auditOS","#auditSetor"].forEach(sel=>{
      document.querySelector(sel).addEventListener("input", applyFilter);
    });
    document.querySelector("#btnAuditRefresh").onclick = () => renderAdminAuditoriaDesktop();

    renderRows(rows);
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar auditoria.</div>`;
  }
}

async function renderAdminLixeiraDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  try{
    const [osRows, subRows] = await Promise.all([
      apiGet("adminLixeiraOS", {}),
      apiGet("adminLixeiraSubtarefas", {}).catch(()=>[])
    ]);
    box.innerHTML = `
      <section class="admin-desktop-section">
        <h2>Lixeira e recuperação</h2>
        <p class="page-subtitle">Recupere OS e subtarefas excluídas logicamente.</p>
        <div class="v35-module-grid" style="margin-top:18px">
          <div class="v35-module-card">
            <b>OS excluídas</b>
            <small>${osRows.length} registro(s) recuperável(is).</small>
            <button class="btn green compact" type="button">Abrir lista</button>
          </div>
          <div class="v35-module-card">
            <b>Subtarefas excluídas</b>
            <small>${subRows.length} registro(s) recuperável(is).</small>
            <button class="btn green compact" type="button">Abrir lista</button>
          </div>
          <div class="v35-module-card">
            <b>Rastreabilidade</b>
            <small>Exclusões permanecem registradas nos logs e histórico.</small>
            <button class="btn light compact" type="button">Ver auditoria</button>
          </div>
        </div>
      </section>
    `;
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar lixeira.</div>`;
  }
}


async function renderAdminModelosDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  if(!box) return;
  box.innerHTML = `<div class="v36-loading">Carregando modelos de checklist...</div>`;

  try{
    const [modelos, setores] = await Promise.all([
      apiGet("listarModelosAtivos", {}),
      apiGet("listarSetores", {}).catch(()=>[])
    ]);

    const setoresList = (setores || []).map(s => s.nome_setor || s.nome || s.setor).filter(Boolean);
    const setoresOptions = setoresList.length
      ? setoresList.map(s=>`<option>${escapeHtml(s)}</option>`).join("")
      : `<option>Desmontagem</option><option>Montagem</option><option>Elétrica</option><option>Usinagem</option><option>Produção</option><option>Almoxarifado</option><option>Qualidade</option>`;

    box.innerHTML = `
      <section class="admin-desktop-section">
        <div class="v35-toolbar">
          <div>
            <h2>Modelos de checklist</h2>
            <p class="page-subtitle">Crie padrões de checklist para OS principal e subtarefas. Estes modelos alimentam a operação.</p>
          </div>
          <span class="v35-status-pill green">${(modelos || []).length} ativo(s)</span>
        </div>

        <div class="v36-model-grid">
          <form id="formNovoModeloDesktop" class="v36-model-form">
            <input id="modNomeDesktop" placeholder="Nome do modelo. Ex: Desmontagem padrão" />
            <select id="modTipoDesktop">
              <option>Principal</option>
              <option>Subtarefa</option>
            </select>
            <select id="modSetorDesktop">${setoresOptions}</select>
            <textarea id="modDescDesktop" placeholder="Descrição do item de checklist"></textarea>
            <button class="btn blue full" type="submit">Criar item de modelo</button>
          </form>

          <div class="v36-model-list">
            ${(modelos || []).length ? modelos.map(m=>`
              <article class="v36-model-card">
                <b>${escapeHtml(m.nome_modelo || "Modelo")}</b>
                <small>${escapeHtml(m.descricao || "-")}</small>
                <div class="v36-model-meta">
                  <span class="v36-chip">${escapeHtml(m.tipo || "-")}</span>
                  <span class="v36-chip yellow">${escapeHtml(m.setor || "-")}</span>
                  <span class="v36-chip green">Ordem ${escapeHtml(m.ordem || "-")}</span>
                </div>
              </article>
            `).join("") : `<div class="empty">Nenhum modelo ativo cadastrado.</div>`}
          </div>
        </div>
      </section>
    `;

    document.querySelector("#formNovoModeloDesktop").onsubmit = async (e)=>{
      e.preventDefault();
      const descricao = document.querySelector("#modDescDesktop").value.trim();
      if(!descricao) return toast("Informe a descrição do item");

      await apiPost({
        acao:"criarModeloChecklist",
        nome_modelo:document.querySelector("#modNomeDesktop").value.trim() || `${document.querySelector("#modSetorDesktop").value} padrão`,
        tipo:document.querySelector("#modTipoDesktop").value,
        setor:document.querySelector("#modSetorDesktop").value,
        descricao,
        criado_por:currentUser().nome
      });

      toast("Modelo criado");
      renderAdminModelosDesktop();
    };
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar modelos de checklist.</div>`;
  }
}


async function renderAdminKitsDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  if(!box) return;
  box.innerHTML = `<div class="v36-loading">Carregando carrinhos kit...</div>`;

  try{
    const [kits, resumo] = await Promise.all([
      apiGet("listarKitsQR", {}).catch(()=>[]),
      apiGet("gestorResumo", {matricula:currentUser().matricula}).catch(()=>({os:[]}))
    ]);

    const osOptions = (resumo.os || [])
      .filter(o => String(o.status || "").toLowerCase() !== "concluído")
      .map(o=>`<option value="${escapeHtml(o.id_os)}">${escapeHtml(o.codigo_os)} • ${escapeHtml(o.motor || "-")}</option>`)
      .join("");

    box.innerHTML = `
      <section class="admin-desktop-section">
        <div class="v35-toolbar">
          <div>
            <h2>Carrinhos Kit / QR</h2>
            <p class="page-subtitle">Vincule um carrinho/kit a uma OS para rastrear peças e evitar mistura de componentes.</p>
          </div>
          <span class="v35-status-pill green">${kits.length} kit(s)</span>
        </div>

        <div class="kit-layout">
          <form id="formKitQR" class="kit-form">
            <input id="kitCodigo" placeholder="Código do kit. Ex: KIT-001" />
            <input id="kitDescricao" placeholder="Descrição. Ex: Carrinho azul 01" />
            <select id="kitStatus">
              <option>Livre</option>
              <option>Em uso</option>
              <option>Bloqueado</option>
            </select>
            <select id="kitOS">
              <option value="">Sem OS vinculada</option>
              ${osOptions}
            </select>
            <textarea id="kitObs" placeholder="Observações do kit/carrinho"></textarea>
            <button class="btn blue full" type="submit">Salvar kit</button>
          </form>

          <div class="kit-grid">
            ${kits.length ? kits.map(k=>`
              <article class="kit-card">
                <div class="kit-card-top">
                  <div>
                    <div class="kit-code">${escapeHtml(k.codigo_qr || k.codigo_kit || "-")}</div>
                    <small>${escapeHtml(k.descricao || "-")}</small>
                  </div>
                  <span class="kit-status ${String(k.status).toLowerCase().includes("uso") ? "usado" : String(k.status).toLowerCase().includes("bloq") ? "bloqueado" : ""}">${escapeHtml(k.status || "Livre")}</span>
                </div>
                <div class="kit-qr-box">QR: KIT:${escapeHtml(k.codigo_qr || k.codigo_kit || "")}</div>
                ${k.codigo_os ? `<div class="kit-linked-panel">Vinculado à ${escapeHtml(k.codigo_os)}<br>${escapeHtml(k.motor || "")}</div>` : ""}
                <div class="kit-action-row">
                  <button class="btn light compact" data-kit-copy="KIT:${escapeHtml(k.codigo_qr || k.codigo_kit || "")}">Copiar QR</button>
                  ${k.id_os_atual ? `<button class="btn red compact" data-kit-unlink="${escapeHtml(k.id_kit)}">Desvincular</button>` : ""}
                </div>
              </article>
            `).join("") : `<div class="v35-empty-state">Nenhum carrinho kit cadastrado.</div>`}
          </div>
        </div>
      </section>
    `;

    document.querySelector("#formKitQR").onsubmit = async(e)=>{
      e.preventDefault();
      const codigo = document.querySelector("#kitCodigo").value.trim();
      if(!codigo) return toast("Informe o código do kit");
      await apiPost({
        acao:"salvarKitQR",
        codigo_qr:codigo,
        descricao:document.querySelector("#kitDescricao").value.trim(),
        status:document.querySelector("#kitStatus").value,
        id_os_atual:document.querySelector("#kitOS").value,
        observacao:document.querySelector("#kitObs").value.trim(),
        operador_nome:currentUser().nome,
        matricula:currentUser().matricula
      });
      toast("Kit salvo");
      renderAdminKitsDesktop();
    };

    document.querySelectorAll("[data-kit-copy]").forEach(btn=>{
      btn.onclick = async()=>{
        await navigator.clipboard?.writeText(btn.dataset.kitCopy);
        toast("Código QR copiado");
      };
    });

    document.querySelectorAll("[data-kit-unlink]").forEach(btn=>{
      btn.onclick = async()=>{
        await apiPost({acao:"desvincularKitQR", id_kit:btn.dataset.kitUnlink, operador_nome:currentUser().nome, matricula:currentUser().matricula});
        toast("Kit desvinculado");
        renderAdminKitsDesktop();
      };
    });
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar carrinhos kit.</div>`;
  }
}



function showFastLoading(label="Carregando dados salvos..."){
  return `
    <div class="fast-loading">
      <div class="cache-status">Carregamento ágil</div>
      <div class="skeleton-card"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line" style="width:70%"></div>
    </div>
  `;
}

function notificationIcon(origem){
  const o = String(origem || "").toLowerCase();
  if(o.includes("gest")) return "supervisor_account";
  if(o.includes("oper")) return "engineering";
  if(o.includes("sist")) return "settings";
  return "notifications";
}

async function loadAdminNotificationCount(){
  try{
    const rows = await apiGet("listarNotificacoes", {destino:"Admin", somente_nao_lidas:"true"}).catch(()=>[]);
    const count = Array.isArray(rows) ? rows.length : 0;
    const btn = document.querySelector("#btnAdminNotifications");
    const el = document.querySelector("#adminNotificationCount");
    if(el) el.textContent = count > 99 ? "99+" : String(count);
    if(btn) btn.classList.toggle("has-unread", count > 0);
  }catch(e){}
}

async function renderAdminNotificacoesDesktop(){
  const box = document.querySelector("#adminDesktopArea");
  if(!box) return;
  box.innerHTML = `<div class="v36-loading">Carregando notificações...</div>`;

  try{
    const rows = await apiGet("listarNotificacoes", {destino:"Admin"}).catch(()=>[]);

    box.innerHTML = `
      <section class="admin-desktop-section">
        <div class="v35-toolbar">
          <div>
            <h2>Central de Notificações</h2>
            <p class="page-subtitle">Receba avisos da Gestão, Operadores e Sistema.</p>
          </div>
          <span class="v35-status-pill orange">${rows.filter(n=>String(n.lida).toLowerCase() !== "true").length} não lida(s)</span>
        </div>

        <div class="notifications-layout">
          <aside class="notifications-filter-card">
            <h3>Filtros</h3>
            <p>Use para localizar notificações por origem ou status.</p>
            <select id="notificationOriginFilter">
              <option value="">Todas as origens</option>
              <option>Gestão</option>
              <option>Operador</option>
              <option>Sistema</option>
            </select>
            <select id="notificationStatusFilter">
              <option value="">Todos os status</option>
              <option value="nao_lidas">Não lidas</option>
              <option value="lidas">Lidas</option>
            </select>
            <input id="notificationSearch" placeholder="Buscar por título, mensagem ou OS" />
            <button id="btnRefreshNotifications" class="btn light full" type="button">Atualizar</button>
          </aside>

          <div id="notificationsList" class="notifications-list"></div>
        </div>
      </section>
    `;

    const renderList = ()=>{
      const origem = document.querySelector("#notificationOriginFilter").value.toLowerCase();
      const status = document.querySelector("#notificationStatusFilter").value;
      const q = document.querySelector("#notificationSearch").value.toLowerCase();

      const filtered = rows.filter(n=>{
        const lida = String(n.lida).toLowerCase() === "true";
        return (!origem || String(n.origem || "").toLowerCase().includes(origem))
          && (!status || (status === "nao_lidas" ? !lida : lida))
          && (!q || `${n.titulo || ""} ${n.mensagem || ""} ${n.codigo_os || ""} ${n.criado_por || ""}`.toLowerCase().includes(q));
      });

      const list = document.querySelector("#notificationsList");
      list.innerHTML = filtered.length ? filtered.map(n=>{
        const lida = String(n.lida).toLowerCase() === "true";
        const origemClass = String(n.origem || "").toLowerCase().includes("gest") ? "gestao" : String(n.origem || "").toLowerCase().includes("oper") ? "operador" : "sistema";

        return `
          <article class="notification-card ${lida ? "" : "unread"}">
            <div class="notification-icon"><span class="material-symbols-outlined">${notificationIcon(n.origem)}</span></div>
            <div class="notification-body">
              <h3>${escapeHtml(n.titulo || "Notificação")}</h3>
              <p>${escapeHtml(n.mensagem || "-")}</p>
              <div class="notification-meta">
                <span class="notification-chip ${origemClass}">${escapeHtml(n.origem || "Sistema")}</span>
                <span class="notification-chip">${escapeHtml(n.criado_por || "Sistema")}</span>
                ${n.codigo_os ? `<span class="notification-chip">${escapeHtml(n.codigo_os)}</span>` : ""}
                <span class="notification-chip">${fmtDate(n.criado_em)}</span>
              </div>
            </div>
            <div class="notification-actions">
              ${!lida ? `<button class="btn blue compact" data-read-notification="${escapeHtml(n.id_notificacao)}">Marcar lida</button>` : `<span class="v35-status-pill green">Lida</span>`}
            </div>
          </article>
        `;
      }).join("") : `<div class="v35-empty-state">Nenhuma notificação encontrada.</div>`;

      document.querySelectorAll("[data-read-notification]").forEach(btn=>{
        btn.onclick = async()=>{
          await apiPost({
            acao:"marcarNotificacaoLida",
            id_notificacao:btn.dataset.readNotification,
            operador_nome:currentUser().nome,
            matricula:currentUser().matricula
          });
          toast("Notificação marcada como lida");
          loadAdminNotificationCount();
          renderAdminNotificacoesDesktop();
        };
      });
    };

    ["#notificationOriginFilter","#notificationStatusFilter","#notificationSearch"].forEach(sel=>{
      document.querySelector(sel).addEventListener("input", renderList);
      document.querySelector(sel).addEventListener("change", renderList);
    });

    document.querySelector("#btnRefreshNotifications").onclick = renderAdminNotificacoesDesktop;

    renderList();
    loadAdminNotificationCount();
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar notificações.</div>`;
  }
}

async function renderAdminManagerPermissions(){
  await syncManagerPermissionsFromApi(true);
  const perms = getManagerPermissions();
  const keys = Object.keys(MANAGER_PERMISSION_DEFAULTS);
  const groups = keys.reduce((acc,key)=>{
    const group = managerPermissionGroup(key);
    if(!acc[group]) acc[group] = [];
    acc[group].push(key);
    return acc;
  },{});

  adminMain().innerHTML = `
    <div class="admin-page-head">
      <div>
        <h1>Permissões da Gestão</h1>
        <p>Controle quais ações aparecem para o perfil Gestão. Se desativar, a ação some da interface da Gestão.</p>
      </div>
    </div>

    <section class="admin-permissions-panel">
      <div class="admin-permissions-summary">
        <b>${keys.filter(k=>perms[k] !== false).length}/${keys.length}</b>
        <span>ações liberadas para Gestão</span>
      </div>

      ${Object.entries(groups).map(([group,items])=>`
        <div class="admin-permission-group">
          <h2>${group}</h2>
          <div class="admin-permission-list">
            ${items.map(key=>`
              <label class="admin-permission-row">
                <span>
                  <b>${managerPermissionLabel(key)}</b>
                  <small>${key}</small>
                </span>
                <input type="checkbox" data-manager-permission="${key}" ${perms[key] !== false ? "checked" : ""}>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}

      <div class="admin-permission-actions">
        <button class="btn blue" id="btnSaveManagerPermissions">Salvar permissões</button>
        <button class="btn" id="btnResetManagerPermissions">Restaurar padrão</button>
      </div>
    </section>
  `;

  document.querySelector("#btnSaveManagerPermissions")?.addEventListener("click", async ()=>{
    const next = {};
    document.querySelectorAll("[data-manager-permission]").forEach(input=>{
      next[input.dataset.managerPermission] = input.checked;
    });
    await saveManagerPermissions(next, currentUser());
    toast("Permissões da Gestão atualizadas");
    renderAdminManagerPermissions();
  });

  document.querySelector("#btnResetManagerPermissions")?.addEventListener("click", async ()=>{
    await saveManagerPermissions({...MANAGER_PERMISSION_DEFAULTS}, currentUser());
    toast("Permissões restauradas");
    renderAdminManagerPermissions();
  });
}



/* fallback manager_permissions */

document.addEventListener("click", (e)=>{
  const btn = e.target.closest('[data-admin-desktop="manager_permissions"], [data-admin-tab="manager_permissions"], [data-admin-page="manager_permissions"]');
  if(btn){
    e.preventDefault();
    renderAdminManagerPermissions();
  }
});

