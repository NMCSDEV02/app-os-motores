import { apiGet, apiPost, cacheGet, clearApiSmartCache } from "./api.js";
import { currentUser, logout } from "./auth.js";
import { screen, setHeader, setBottomNav, toast, modal, closeModal, progress, escapeHtml, fmtDate } from "./ui.js";
import { openQrScreen } from "./qr.js";
import { normalizeProgress, progressState, progressHtml, markProgressUpdating, unmarkProgressUpdating, pulseProgress } from "./core/progressEngine.js";
import { renderDataAccelerationPanel, bindDataAccelerationPanel } from "./core/dataAcceleration.js";
import { applyTheme } from "./core/theme.js";

let selectedOS = null;


function getOperatorThemeMode(){
  return localStorage.getItem("natan_operator_theme_mode") || localStorage.getItem("natan_theme") || "dark";
}

function applyOperatorThemeMode(mode){
  const finalMode = mode === "auto"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;

  localStorage.setItem("natan_operator_theme_mode", mode);
  localStorage.setItem("natan_theme", finalMode);
  applyTheme(finalMode);
}

function getFactoryVariant(){
  return localStorage.getItem("natan_factory_variant") || "green";
}

function setFactoryVariant(variant){
  localStorage.setItem("natan_factory_variant", variant || "green");
  applyTheme(localStorage.getItem("natan_theme") || getOperatorThemeMode());
}

function operatorThemeLabel(mode = getOperatorThemeMode()){
  const map = {dark:"Escuro", light:"Claro", factory:"Chão de fábrica", auto:"Automático"};
  return map[mode] || "Escuro";
}

function factoryVariantLabel(value = getFactoryVariant()){
  const map = {
    green:"Verde industrial",
    amber:"Âmbar manutenção",
    steel:"Aço azul"
  };
  return map[value] || "Verde industrial";
}

function renderOperatorThemeSettings(){
  const themeMode = getOperatorThemeMode();
  const factoryVariant = getFactoryVariant();

  return `
    <div class="operator-config-summary">
      Tema: ${operatorThemeLabel(themeMode)} • Fábrica: ${factoryVariantLabel(factoryVariant)}
    </div>

    <div class="operator-config-stack">
      <div class="operator-config-group">
        <div class="operator-config-title">
          <h2>Desempenho</h2>
          <span>Dados</span>
        </div>
        ${renderDataAccelerationPanel()}
      </div>

      <div class="operator-config-group">
        <div class="operator-config-title">
          <h2>Aparência</h2>
          <span>Tema</span>
        </div>

        <section class="operator-setting-block">
          <h2>Tema do aplicativo</h2>
          <p>Escolha a aparência usada no perfil Operador.</p>
          <div class="operator-setting-options">
            ${[
              ["dark","dark_mode","Escuro","Menor brilho e bom contraste no chão de fábrica."],
              ["light","light_mode","Claro","Melhor para ambientes muito iluminados."],
              ["factory","precision_manufacturing","Chão de fábrica","Tema industrial com alto contraste e foco operacional."],
              ["auto","contrast","Automático","Segue a preferência do dispositivo."]
            ].map(([value,icon,title,desc])=>`
              <label class="operator-setting-option">
                <input type="radio" name="operatorThemeMode" value="${value}" ${themeMode===value ? "checked" : ""}>
                <span><b><span class="material-symbols-outlined">${icon}</span> ${title}</b><small>${desc}</small></span>
              </label>
            `).join("")}
          </div>
        </section>

        <section class="operator-setting-block">
          <h2>Variação do tema Chão de fábrica</h2>
          <p>Escolha a cor operacional principal do tema fábrica.</p>
          <div class="factory-variant-options">
            ${[
              ["green","green","Verde industrial","Padrão operacional e status de liberação."],
              ["amber","amber","Âmbar manutenção","Foco em atenção, manutenção e prioridade."],
              ["steel","steel","Aço azul","Visual técnico, limpo e mais frio."]
            ].map(([value,dot,title,desc])=>`
              <button type="button" class="factory-variant-card ${factoryVariant===value ? "active" : ""}" data-operator-factory-variant="${value}">
                <span class="factory-variant-dot ${dot}"></span>
                <b>${title}</b><small>${desc}</small>
              </button>
            `).join("")}
          </div>
        </section>
      </div>

      <div class="operator-config-group">
        <div class="operator-config-title">
          <h2>Sessão</h2>
          <span>Conta</span>
        </div>
        <section class="operator-danger-zone">
          <h2>Sair da conta</h2>
          <p>Encerra a sessão atual e retorna para a tela de login.</p>
          <button id="btnLogout" class="operator-logout-btn" type="button">
            <span class="material-symbols-outlined">logout</span>
            Sair da conta
          </button>
        </section>
      </div>
    </div>
  `;
}

function bindOperatorThemeSettings(){
  bindDataAccelerationPanel(renderSettings);

  document.querySelectorAll('input[name="operatorThemeMode"]').forEach(input=>{
    input.addEventListener("change", ()=>{
      applyOperatorThemeMode(input.value);
      toast("Tema atualizado");
      renderSettings();
    });
  });

  document.querySelectorAll("[data-operator-factory-variant]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setFactoryVariant(btn.dataset.operatorFactoryVariant);
      toast("Variação do tema atualizada");
      renderSettings();
    });
  });
}



function sameSetor(a,b){
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function canSeeOSCard(os, user){
  if(!os || !user) return false;

  const isSub = !!os.modo_subtarefa || os.tipo_card === "Subtarefa";
  if(isSub){
    return sameSetor(os.setor_destino || os.setor_atual, user.setor);
  }

  return sameSetor(os.setor_atual, user.setor);
}

function sanitizeChecklistBySetor(items = [], os = selectedOS){
  const u = currentUser();
  const subMode = !!os?.modo_subtarefa || !!os?.id_subtarefa;

  return (Array.isArray(items) ? items : []).filter(item=>{
    const origem = String(item.origem || item.tipo || "").trim().toLowerCase();

    if(subMode){
      const itemSub = String(item.id_subtarefa || "");
      const osSub = String(os?.id_subtarefa || "");
      const setorOk = sameSetor(item.setor || item.etapa || os?.setor_destino || os?.setor_atual, u.setor);
      return origem === "subtarefa" && itemSub === osSub && setorOk;
    }

    // Modo OS principal: operador só executa checklist principal do setor/etapa atual.
    const setorOk = sameSetor(item.setor || item.etapa || os?.setor_atual, u.setor);
    return origem === "principal" && setorOk;
  });
}


function iconSvg(name){
  const icons = {
    bell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.6 2.6 0 0 0 2.45-1.75h-4.9A2.6 2.6 0 0 0 12 22Zm7-5h-1V10a6 6 0 0 0-4.5-5.8V3a1.5 1.5 0 0 0-3 0v1.2A6 6 0 0 0 6 10v7H5a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2ZM8 17v-7a4 4 0 0 1 8 0v7H8Z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V6H5v12h4v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6Zm7.7 4.3 3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 1 1-1.4-1.4l1.3-1.3H10a1 1 0 1 1 0-2h7.6l-1.3-1.3a1 1 0 0 1 1.4-1.4Z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 0 1 5.16 10.45l3.45 3.44a1 1 0 0 1-1.42 1.42l-3.44-3.45A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>`,
    qr: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4V4Zm2 2v3h3V6H6Zm7-2h7v7h-7V4Zm2 2v3h3V6h-3ZM4 13h7v7H4v-7Zm2 2v3h3v-3H6Zm9-2h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-5 3h2v2h-2v-2Zm2 2h2v2h-2v-2Zm3-2h2v4h-2v-4Zm-5 4h2v2h-2v-2Z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>`
  };
  return icons[name] || "";
}

function isSystemLog(l){
  const a = String(l.acao||"").toUpperCase();
  return a.includes("OFFLINE") || a.includes("SYNC") || a.includes("SISTEMA") || a.includes("CONEXAO");
}
function isManagementLog(l){
  const a = String(l.acao||"").toUpperCase();
  return a.includes("GESTAO") || a.includes("OS_CRIADA") || a.includes("SUBTAREFA") || a.includes("TROCA_SETOR") || a.includes("APROVADA") || a.includes("NEGADA");
}
function classifyOperatorLog(l){
  if(isSystemLog(l)) return "sistema";
  if(isManagementLog(l)) return "gestao";
  return "administracao";
}
function prettyAction(acao=""){
  const a = String(acao).toUpperCase();
  const map = {
    ITEM_CONCLUIDO:"Item concluído",
    SOLICITACAO_TROCA_SETOR:"Troca de setor solicitada",
    TROCA_SETOR_APROVADA:"Troca de setor aprovada",
    TROCA_SETOR_NEGADA:"Troca de setor negada",
    OS_CRIADA:"Nova OS disponível",
    SUBTAREFA_CRIADA:"Nova subtarefa disponível",
    OS_CONCLUIDA:"OS concluída",
    OS_FINALIZADA:"OS finalizada"
  };
  return map[a] || String(acao||"Evento").replaceAll("_"," ");
}
function logDescription(l){
  const acao = String(l.acao||"").toUpperCase();
  if(acao === "OS_CRIADA"){
    return `${l.codigo_os || "Nova OS"} foi encaminhada para ${l.setor || "seu setor"}.`;
  }
  if(acao === "SUBTAREFA_CRIADA"){
    const pend = l.detalhes ? `: ${l.detalhes}` : "";
    return `Subtarefa da ${l.codigo_os || "OS"} foi enviada para ${l.setor || "seu setor"}${pend}.`;
  }
  if(acao === "TROCA_SETOR_APROVADA"){
    return `Sua troca de setor foi aprovada. Novo setor: ${l.setor || "atualizado"}.`;
  }
  if(acao === "TROCA_SETOR_NEGADA"){
    return `Sua solicitação de troca de setor foi negada. ${l.detalhes || ""}`.trim();
  }
  const parts = [];
  if(l.codigo_os) parts.push(l.codigo_os);
  if(l.descricao) parts.push(l.descricao);
  if(l.detalhes) parts.push(l.detalhes);
  if(l.setor) parts.push(`Setor: ${l.setor}`);
  return parts.filter(Boolean).join(" • ") || "Registro operacional";
}

function renderOperatorNotificationCard(l){
  const type = classifyOperatorLog(l);
  const acao = String(l.acao||"").toUpperCase();
  const demanda = acao === "OS_CRIADA" || acao === "SUBTAREFA_CRIADA";
  const title = demanda ? "Nova demanda disponível" : prettyAction(l.acao);
  const badge = acao === "OS_CRIADA" ? "OS" : acao === "SUBTAREFA_CRIADA" ? "Subtarefa" : "";
  return `<button class="op-notify-card ${type} ${demanda ? "demand" : ""}" type="button" data-notify-os="${escapeHtml(l.codigo_os||"")}">
    <strong>${escapeHtml(title)}</strong>
    ${badge ? `<em>${escapeHtml(badge)}</em>` : ""}
    <span>${escapeHtml(logDescription(l))}</span>
    <small>${escapeHtml(fmtDate(l.data_hora || l.criado_em || l.concluido_em))}</small>
  </button>`;
}


function mountOperatorHeaderControls(){
  const actions = document.querySelector(".header-actions");
  if(!actions) return;
  actions.innerHTML = `
    <button id="btnOperatorNotify" class="icon-btn svg-icon-btn" title="Notificações" type="button">${iconSvg("bell")}</button>
    <button id="btnOperatorLogout" class="icon-btn danger svg-icon-btn" title="Sair" type="button">${iconSvg("logout")}</button>
  `;
  document.querySelector("#btnOperatorNotify").onclick = openOperatorNotifications;
  document.querySelector("#btnOperatorLogout").onclick = logout;
}

async function openOperatorNotifications(){
  const old = document.querySelector("#operatorNotifyOverlay");
  if(old) old.remove();
  const u = currentUser();
  let logs = [];
  try{ logs = await apiGet("listarNotificacoesOperador", {matricula:u.matricula, setor:u.setor}); }catch{
    try{ logs = await apiGet("listarHistorico", {matricula:u.matricula, perfil:u.perfil}); }catch{}
  }
  logs = Array.isArray(logs) ? logs.slice(0,40) : [];
  const hoje = new Date().toLocaleDateString("pt-BR");
  const groups = {
    administracao: logs.filter(l=>classifyOperatorLog(l)==="administracao"),
    gestao: logs.filter(l=>classifyOperatorLog(l)==="gestao"),
    sistema: logs.filter(l=>classifyOperatorLog(l)==="sistema")
  };
  const html = `
    <div id="operatorNotifyOverlay" class="operator-notify-overlay">
      <div class="operator-notify-backdrop" data-close-operator-notify></div>
      <section class="operator-notify-panel" role="dialog" aria-modal="true">
        <button class="operator-notify-x" data-close-operator-notify type="button" aria-label="Fechar">×</button>
        <div class="operator-notify-head">
          <h2>Notificações</h2>
          <p>Eventos do dia atual (${hoje}). Para consultar dias anteriores, use o Histórico.</p>
        </div>
        <div class="operator-notify-tabs">
          <button class="active" data-op-tab="administracao" type="button">Administração <b>${groups.administracao.length}</b></button>
          <button data-op-tab="gestao" type="button">Gestão <b>${groups.gestao.length}</b></button>
          <button data-op-tab="sistema" type="button">Sistema <b>${groups.sistema.length}</b></button>
        </div>
        <div class="operator-notify-body">
          ${["administracao","gestao","sistema"].map((k,i)=>`<div class="operator-notify-list ${i===0?"active":""}" data-op-list="${k}">${groups[k].length ? groups[k].slice(0,12).map(renderOperatorNotificationCard).join("") : `<div class="empty small-empty">Nenhuma notificação nesta categoria.</div>`}</div>`).join("")}
        </div>
      </section>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
  const root = document.querySelector("#operatorNotifyOverlay");
  root.querySelectorAll("[data-close-operator-notify]").forEach(el=>el.onclick=()=>root.remove());
  root.querySelectorAll("[data-op-tab]").forEach(btn=>{
    btn.onclick = ()=>{
      root.querySelectorAll("[data-op-tab]").forEach(b=>b.classList.remove("active"));
      root.querySelectorAll("[data-op-list]").forEach(l=>l.classList.remove("active"));
      btn.classList.add("active");
      root.querySelector(`[data-op-list="${btn.dataset.opTab}"]`)?.classList.add("active");
    };
  });
  root.querySelectorAll("[data-notify-os]").forEach(btn=>{
    btn.onclick = async ()=>{
      const codigo = btn.dataset.notifyOs;
      if(!codigo) return;
      root.remove();
      await abrirNotificacaoOS(codigo);
    };
  });
}

async function abrirNotificacaoOS(codigo){
  const u = currentUser();
  try{
    const lista = await apiGet("listarOS", {setor:u.setor, matricula:u.matricula});
    const item = Array.isArray(lista) ? lista.find(o=>String(o.codigo_os)===String(codigo)) : null;
    if(item) return openOS(item);
  }catch{}
  try{
    const os = await apiGet("buscarOS", {termo:codigo, setor:u.setor});
    if(os && !os.erro && os.permitido) return openOS(os);
    toast("Demanda localizada, mas está em outro setor ou já foi concluída.");
  }catch{
    toast("Não foi possível abrir a demanda agora.");
  }
}

export async function renderHome(){
  const u = currentUser();
  setHeader(u,true); mountOperatorHeaderControls(); setBottomNav(u,true,"home");
  screen().innerHTML = `
    <h1 class="page-title">Ordens do setor</h1>
    <p class="page-subtitle">Lista operacional de ${escapeHtml(u.setor)}. Execute apenas o que aparece aqui.</p>
    <div class="action-row operator-actions-row">
      <input id="searchOS" class="search-input" placeholder="Buscar OS: 0001 ou OS-2026-0001" />
      <button id="btnDoSearch" class="btn icon-action svg-square dark" title="Buscar OS" aria-label="Buscar OS">${iconSvg("search")}</button>
      <button id="btnQrInline" class="btn icon-action svg-square blue" title="Ler QR Code" aria-label="Ler QR Code">${iconSvg("qr")}</button>
      ${String(u.pode_criar_os).toLowerCase()==="true" ? `<button id="btnCreateOSInline" class="btn icon-action svg-square green" title="Criar nova OS" aria-label="Criar nova OS">${iconSvg("plus")}</button>` : ""}
    </div>
    <div class="setor-guard-note">Visão filtrada: você só vê OS do seu setor e subtarefas destinadas ao seu setor.</div>
    <div id="osList" class="os-list"><div class="empty">Carregando ordens...</div></div>`;
  document.querySelector("#btnQrInline").onclick = openQrScreen;
  document.querySelector("#btnDoSearch").onclick = buscarOSManual;
  const btnCreate = document.querySelector("#btnCreateOSInline");
  if(btnCreate) btnCreate.onclick = openOperadorNovaOSModal;
  document.querySelector("#searchOS").addEventListener("keydown", e=>{ if(e.key==="Enter") buscarOSManual(); });
  await loadOrders();
}

async function loadOrders(){
  const u = currentUser();
  const list = document.querySelector("#osList");
  try{
    const raw = await apiGet("listarOS", {setor:u.setor, matricula:u.matricula, __force:true});
    const data = (Array.isArray(raw) ? raw : []).filter(os => canSeeOSCard(os, u));

    if(data.length===0){
      list.innerHTML = `<div class="empty">Nenhuma OS para o seu setor.</div>`;
      return;
    }

    data.sort((a,b)=> new Date(b.data_abertura || b.criado_em || 0) - new Date(a.data_abertura || a.criado_em || 0));
    list.innerHTML = data.map(renderOSCard).join("");
    list.querySelectorAll("[data-open-os]").forEach(el=>el.onclick = ()=>openOS(JSON.parse(decodeURIComponent(el.dataset.os))));
  }catch(e){
    list.innerHTML = `<div class="empty">Sem conexão ou API indisponível. Tente atualizar.</div>`;
  }
}

function renderOSCard(os){
  const prog = normalizeProgress(os);
  const state = progressState(prog, os.status);
  const isSub = !!os.modo_subtarefa || os.tipo_card === "Subtarefa";
  const tag = isSub ? `<span class="badge yellow">Subtarefa</span>` : `<span class="badge blue">${escapeHtml(os.etapa_atual||os.setor_atual||"OS")}</span>`;
  const pend = os.descricao_subtarefa ? `<div class="os-motor">Pendência: ${escapeHtml(os.descricao_subtarefa)}</div>` : "";
  return `<div class="os-card smart-box" data-state="${state}" data-open-os data-os="${encodeURIComponent(JSON.stringify(os))}">
    <div class="os-card-top">
      <div>
        <div class="os-code">${escapeHtml(os.codigo_os)}</div>
        <div class="os-motor">${escapeHtml(os.motor || "Motor não informado")}</div>
        ${pend}
      </div>
      <div class="badges">${tag}<span class="badge green">${escapeHtml(os.status||"Em processo")}</span></div>
    </div>
    ${progressHtml("Progresso da OS", prog)}
    <div class="smart-status-line">
      <span><i class="smart-status-dot ${state==="concluido"?"green":state==="bloqueado"?"red":state==="atencao"?"yellow":""}"></i>${state==="bloqueado"?"Subtarefa pendente":state==="concluido"?"Concluída":state==="atencao"?"Em atenção":"Em processo"}</span>
      <span>${fmtDate(os.data_abertura || os.criado_em)}</span>
    </div>
  </div>`;
}

async function buscarOSManual(){
  const termo = document.querySelector("#searchOS").value.trim();
  if(!termo) return toast("Digite o código");
  try{
    const os = await apiGet("buscarOS", {termo, setor:currentUser().setor});
    if(!os || os.erro) return toast("OS não encontrada");
    if(!os.permitido) return toast(`OS pertence ao setor ${os.setor_atual}. Acesso bloqueado.`);
    openOS(os);
  }catch(e){ toast("Erro ao buscar OS"); }
}

export async function openOS(os){
  if(!canSeeOSCard(os, currentUser())){
    toast("Esta demanda pertence a outro setor.");
    return renderHome();
  }
  selectedOS = os;
  const u = currentUser();
  // Registra presença operacional para o painel ADM/Gestão saber quem está realmente na OS.
  // Não bloqueia a tela se estiver offline ou se a API demorar.
  if(u && u.perfil === "Operador"){
    apiPost({acao:"registrarAcessoOS", id_os:os.id_os, codigo_os:os.codigo_os, operador_nome:u.nome, matricula:u.matricula, setor:u.setor}).catch(()=>{});
  }
  setHeader(currentUser(),false); setBottomNav(currentUser(),true,"home");
  const subMode = !!os.modo_subtarefa || !!os.id_subtarefa;
  screen().innerHTML = `
    <div class="os-focus-top">
      <div class="focus-row">
        <div>
          <div class="focus-code">${escapeHtml(os.codigo_os)}</div>
          <div class="focus-motor">${escapeHtml(os.motor||"Motor")} • ${subMode ? "Subtarefa" : escapeHtml(os.etapa_atual||"Etapa")}</div>
        </div>
        <button id="btnDetails" class="detail-toggle">Detalhes</button>
      </div>
      <div id="topProgress">${progress("Progresso da OS", os.concluidos_total||0, os.total_total||0)}</div>
      <div id="detailBox" class="detail-box"></div>
    </div>
    <p class="page-subtitle">${subMode ? "Conclua a pendência do seu setor." : "Toque no item para confirmar conclusão. Crie subtarefa apenas quando necessário."}</p>
    <div id="checkItems" class="item-list"><div class="empty">Carregando checklist...</div></div>
    ${subMode ? "" : `<button id="btnNewSub" class="fab-sub" title="Criar subtarefa">+</button>`}`;
  document.querySelector("#btnDetails").onclick = ()=>document.querySelector("#detailBox").classList.toggle("open");
  if(!subMode) document.querySelector("#btnNewSub").onclick = openSubtaskModal;
  await loadChecklist();
}

async function loadChecklist(){
  const box = document.querySelector("#checkItems");
  const isSub = !!selectedOS.modo_subtarefa || !!selectedOS.id_subtarefa;
  const u = currentUser();

  try{
    const raw = isSub
      ? await apiGet("listarChecklistSubtarefa", {
          id_subtarefa:selectedOS.id_subtarefa,
          setor:u.setor,
          matricula:u.matricula,
          __force:true
        })
      : await apiGet("listarChecklistUnificado", {
          id_os:selectedOS.id_os,
          etapa:selectedOS.etapa_atual,
          setor:u.setor,
          matricula:u.matricula,
          __force:true
        });

    const data = sanitizeChecklistBySetor(raw, selectedOS);

    await refreshSelectedOSProgress();
    updateDetails(data);

    if(!Array.isArray(data) || data.length===0){
      box.innerHTML = `<div class="empty">Checklist concluído ou sem itens para o seu setor.</div>`;
      if(isSub) await finalizarSubtarefasSeVazio();
      else await avancarEtapaSeVazio();
      setTimeout(renderHome, 900);
      return;
    }

    box.innerHTML = data.map(item=>`
      <div class="check-item ${item.tipo==="Subtarefa" ? "sub":""}" data-item='${encodeURIComponent(JSON.stringify(item))}'>
        <div class="badges"><span class="badge ${item.tipo==="Subtarefa"?"yellow":"blue"}">${item.tipo==="Subtarefa"?"Subtarefa":"Principal"}</span></div>
        <div class="check-title">${escapeHtml(item.descricao)}</div>
        <div class="check-hint">Toque para confirmar conclusão</div>
      </div>`).join("");

    box.querySelectorAll(".check-item").forEach(el=> el.onclick = ()=>confirmItem(JSON.parse(decodeURIComponent(el.dataset.item))));
  }catch(e){
    box.innerHTML = `<div class="empty">Erro ao carregar checklist deste setor.</div>`;
  }
}

async function refreshSelectedOSProgress(){
  if(!selectedOS?.id_os) return;
  const root = document.querySelector("#screen") || document;
  try{
    markProgressUpdating(root);
    const prog = await apiGet("obterProgressoOS", {id_os:selectedOS.id_os, _t:Date.now()});
    if(prog && !prog.erro){
      const normalized = normalizeProgress(prog);
      selectedOS = {...selectedOS, ...normalized, progresso:normalized};

      const top = document.querySelector("#topProgress");
      if(top){
        top.innerHTML = progressHtml("OS completa", normalized, "green");
        pulseProgress(top);
      }
    }
  }catch(e){
    // Não bloqueia checklist se progresso falhar.
  }finally{
    unmarkProgressUpdating(root);
  }
}

function updateDetails(items=[]){
  const d = normalizeProgress(selectedOS.progresso || selectedOS || {});
  const box = document.querySelector("#detailBox");
  if(!box) return;
  box.innerHTML = `
    <strong>Detalhes da OS</strong>
    ${progressHtml("OS completa", d)}
    ${progressHtml("Checklist atual", {
      total_itens:d.checklist_total,
      total_concluidos:d.checklist_concluidos
    }, "green")}
    ${d.subtarefas_total > 0 ? progressHtml("Subtarefas", {
      total_itens:d.subtarefas_total,
      total_concluidos:d.subtarefas_concluidas
    }, "yellow") : ""}
    <div class="smart-meta-grid">
      <div class="smart-meta"><small>Motor</small><b>${escapeHtml(selectedOS.motor || "-")}</b></div>
      <div class="smart-meta"><small>Setor atual</small><b>${escapeHtml(selectedOS.setor_atual || "-")}</b></div>
      <div class="smart-meta"><small>Status</small><b>${escapeHtml(selectedOS.status || "-")}</b></div>
      <div class="smart-meta"><small>Pendências</small><b>${d.subtarefas_pendentes || 0}</b></div>
      <div class="smart-meta"><small>Carrinho/Kit</small><b>${escapeHtml(selectedOS.kit_qr || selectedOS.codigo_kit || "Não vinculado")}</b></div>
    </div>`;
}

function confirmItem(item){
  modal({
    title:"Confirmar conclusão",
    text:`Você confirma que "${item.descricao}" foi concluído corretamente?`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Concluir", className:"green", onClick:()=>concluirItem(item)}
    ]
  });
}

async function concluirItem(item){
  try{
    const u = currentUser();
    const el = [...document.querySelectorAll("[data-item]")].find(x=>{
      try{return JSON.parse(decodeURIComponent(x.dataset.item)).id_item == item.id_item}catch{return false}
    });
    if(el) el.classList.add("item-completing");

    markProgressUpdating(document);
    await apiPost({acao:"concluirItem", id_item:item.id_item, tipo:item.tipo, operador_nome:u.nome, matricula:u.matricula, perfil:u.perfil, setor:u.setor, id_subtarefa:selectedOS?.id_subtarefa || ""});
    if(typeof clearApiSmartCache === "function") clearApiSmartCache();
    toast("Item concluído");
    await refreshSelectedOSProgress();
    await loadChecklist();
  }catch(e){
    toast(e.message || "Erro ao concluir");
  }finally{
    unmarkProgressUpdating(document);
  }
}

async function avancarEtapaSeVazio(){
  try{ await apiPost({acao:"avancarEtapaSePossivel", id_os:selectedOS.id_os, operador_nome:currentUser().nome, matricula:currentUser().matricula, setor:currentUser().setor}); }catch(e){ toast(e.message); }
}
async function finalizarSubtarefasSeVazio(){
  try{ await apiPost({acao:"finalizarSubtarefaSePossivel", id_subtarefa:selectedOS.id_subtarefa, operador_nome:currentUser().nome, matricula:currentUser().matricula, setor:currentUser().setor}); }catch(e){ toast(e.message); }
}

function openSubtaskModal(){
  modal({
    title:"Nova subtarefa",
    text:"Envie uma pendência para outro setor sem parar seu checklist principal.",
    html:`<textarea id="subDesc" placeholder="Descrição da pendência"></textarea>
      <select id="subSetor" class="select" style="margin-top:8px">
        <option>Elétrica</option><option>Usinagem</option><option>Montagem</option><option>Desmontagem</option><option>Produção</option><option>Almoxarifado</option>
      </select>`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Criar", className:"green", close:false, onClick:criarSubtarefa}
    ]
  });
}
async function criarSubtarefa(){
  const descricao = document.querySelector("#subDesc").value.trim();
  const setor = document.querySelector("#subSetor").value;
  if(!descricao) return toast("Descreva a pendência");
  try{
    await apiPost({acao:"criarSubtarefa", id_os:selectedOS.id_os, descricao, setor_destino:setor, operador_nome:currentUser().nome});
    closeModal();
    modal({title:"Subtarefa enviada", text:`A pendência foi enviada para ${setor}. Continue seu checklist normalmente. A próxima etapa será liberada somente após todos concluírem.`, actions:[{label:"Entendi", className:"blue"}]});
    await loadChecklist();
  }catch(e){ toast(e.message); }
}

async function openOperadorNovaOSModal(){
  const u = currentUser();
  if(String(u.pode_criar_os).toLowerCase() !== "true") return toast("Criação de OS bloqueada para seu perfil");
  try{
    const modelos = await apiGet("listarModelosAtivos", {});
    const setores = [...new Set((modelos||[]).map(m=>m.setor).filter(Boolean))];
    modal({
      title:"Criar nova OS",
      text:"Use somente quando autorizado pela gestão/administração.",
      html:`<input id="opNovoMotor" class="input" placeholder="Motor / equipamento" />
        <select id="opNovoSetor" class="select" style="margin-top:8px">${setores.map(s=>`<option>${escapeHtml(s)}</option>`).join("")}</select>
        <select id="opNovoModelo" class="select" style="margin-top:8px">${(modelos||[]).map(m=>`<option value="${escapeHtml(m.id_modelo)}">${escapeHtml(m.nome_modelo)} • ${escapeHtml(m.setor)}</option>`).join("")}</select>`,
      actions:[
        {label:"Cancelar", className:"light"},
        {label:"Criar", className:"blue", close:false, onClick:async()=>{
          const motor = document.querySelector("#opNovoMotor").value.trim();
          if(!motor) return toast("Informe o motor");
          await apiPost({acao:"criarOS", motor, setor_inicial:document.querySelector("#opNovoSetor").value, id_modelo:document.querySelector("#opNovoModelo").value, criado_por:u.nome, criado_por_matricula:u.matricula});
          closeModal(); toast("OS criada"); await renderHome();
        }}
      ]
    });
  }catch(e){ toast("Erro ao abrir criação de OS"); }
}

export async function renderHistory(){
  const u=currentUser();
  setHeader(u,true); mountOperatorHeaderControls(); setBottomNav(u,true,"history");
  screen().innerHTML = `<h1 class="page-title">Histórico</h1><p class="page-subtitle">Linha do tempo das suas ações no sistema.</p><div id="hist" class="operator-history-list"><div class="empty">Carregando...</div></div>`;
  try{
    const rows = await apiGet("listarHistorico", {matricula:u.matricula, perfil:u.perfil});
    document.querySelector("#hist").innerHTML = Array.isArray(rows) && rows.length ? rows.map(r=>renderOperatorHistoryCard(r)).join("") : `<div class="empty">Sem histórico ainda.</div>`;
  }catch{ document.querySelector("#hist").innerHTML = `<div class="empty">Erro ao carregar histórico.</div>`; }
}

function renderOperatorHistoryCard(r){
  const action = prettyAction(r.acao);
  const a = String(r.acao||"").toUpperCase();
  const icon = a.includes("ITEM") ? "✓" : a.includes("SUBTAREFA") ? "+" : a.includes("TROCA") ? "⇄" : a.includes("OS") ? "OS" : "•";
  const tone = a.includes("SUBTAREFA") ? "yellow" : a.includes("TROCA") ? "blue" : a.includes("ITEM") ? "green" : "neutral";
  const detalhes = logDescription(r);
  return `<article class="operator-history-card ${tone}">
    <div class="hist-icon">${escapeHtml(icon)}</div>
    <div class="hist-content">
      <div class="hist-title">${escapeHtml(action)}</div>
      <div class="hist-desc">${escapeHtml(detalhes)}</div>
      <div class="hist-meta">${escapeHtml(fmtDate(r.data_hora || r.criado_em || r.concluido_em))}</div>
    </div>
  </article>`;
}

export function renderSettings(){
  const u = currentUser();
  setBottomNav(u, true, "settings");
  screen().innerHTML = `
    <div class="page-title">
      <h1>Configurações</h1>
      <p>${u.nome} • ${u.setor} • ${u.matricula}</p>
    </div>
    ${renderOperatorThemeSettings()}
  `;

  bindOperatorThemeSettings();
  document.querySelector("#btnLogout").onclick = logout;
}
