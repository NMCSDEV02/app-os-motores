import { apiGet, apiPost } from "./api.js";
import { currentUser, logout } from "./auth.js";
import { screen, setHeader, setBottomNav, toast, modal, closeModal, escapeHtml, fmtDate, progress } from "./ui.js";
import { openQrScreen } from "./qr.js";

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

export async function renderAdmin(area = "inicio"){
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
  if(area === "usuarios") return renderUsers();
  if(area === "os") return renderAdminOS();
  if(area === "subtarefas") return renderSubtarefasPendentes();
  if(area === "modelos") return renderAdminModelos();
  if(area === "lixeira") return renderTrash();
  if(area === "historico") return renderHistoricoAdmin();
}


function renderAdminDrawerMenu(){
  const admin = ehAdmin();
  return `<aside id="adminDrawer" class="admin-drawer hidden" aria-label="Menu administrativo">
    <div class="drawer-title">Menu</div>
    <button data-admin-menu="inicio"><span>01</span><b>Início</b><small>Visão geral e indicadores do dia</small></button>
    <button data-admin-menu="os"><span>02</span><b>Gerenciar OS</b><small>Criar, buscar, visualizar e republicar</small></button>
    <button data-admin-menu="subtarefas"><span>03</span><b>Subtarefas</b><small>Pendências, setores e checklist</small></button>
    ${admin ? `<button data-admin-menu="usuarios"><span>04</span><b>Usuários e permissões</b><small>Acessos, perfis e bloqueios</small></button>` : ""}
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
  const pct = Number(os.percentual_total || 0);
  const aberto = minutesSince(os.data_abertura || os.criado_em);
  const restante = estimarRestanteMinProf(os);
  const atrasada = osEstaAtrasada(os);
  const operadorAtual = inferirOperadorAtual(os, cachedLogs);
  return `<div class="os-card admin-os-card ${atrasada ? "late" : ""}">
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
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="progress-meta"><span>${os.total_concluidos || 0}/${os.total_itens || 0} itens • restam ~${fmtDuracao(restante)}</span><span>${pct}%</span></div>
  </div>`;
}

async function renderAdminOSViewer(os){
  adminViewingOS = os;
  if(adminViewerTimer) clearInterval(adminViewerTimer);
  const area = document.querySelector("#adminArea");
  const logs = await apiGet("adminLogs", {}).catch(()=>[]);
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
