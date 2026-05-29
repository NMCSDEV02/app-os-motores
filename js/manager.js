import { apiGet, apiPost, apiGetFast } from "./api.js";
import { currentUser, logout } from "./auth.js";
import { screen, setHeader, setBottomNav, toast, modal, closeModal, escapeHtml } from "./ui.js";
import { managerMobileShell } from "./manager/managerMobileShell.js";
import { openQrScreen } from "./qr.js";
import { applyTheme } from "./core/theme.js";
import { renderDataAccelerationPanel, bindDataAccelerationPanel } from "./core/dataAcceleration.js";

import { managerCan, syncManagerPermissionsFromApi } from "./core/managerPermissions.js";

/* =========================
   HOTFIX V3.35.1 — Aliases e ações estáveis da Gestão
   ========================= */

function encodeManagerPayloadSafeV351(value){
  try{
    return encodeURIComponent(JSON.stringify(value || {}));
  }catch(e){
    console.warn("Falha ao codificar payload Gestão", e);
    return encodeURIComponent("{}");
  }
}

function decodeManagerPayloadSafeV351(raw){
  try{
    return JSON.parse(decodeURIComponent(raw || "%7B%7D"));
  }catch(e){
    console.warn("Falha ao decodificar payload Gestão", e);
    return {};
  }
}

// Aliases globais internos para impedir erro de função ausente.
const encodeManagerPayload = typeof window !== "undefined" && window.encodeManagerPayload
  ? window.encodeManagerPayload
  : encodeManagerPayloadSafeV351;

const decodeManagerPayload = typeof window !== "undefined" && window.decodeManagerPayload
  ? window.decodeManagerPayload
  : decodeManagerPayloadSafeV351;

const encodeManagerSubtaskPayload = encodeManagerPayloadSafeV351;
const decodeManagerSubtaskPayload = decodeManagerPayloadSafeV351;

function managerToastSafeV351(msg){
  try{ toast(msg); }catch(e){ console.warn(msg); }
}

function managerCanSafeV351(permission){
  try{
    return typeof managerCan === "function" ? managerCan(permission) : true;
  }catch{
    return true;
  }
}

function managerBlockedSafeV351(){
  managerToastSafeV351("Ação não liberada pelo Administrador");
}

function managerOpenOSDirectV351(os){
  if(!managerCanSafeV351("os_visualizar")) return managerBlockedSafeV351();

  if(typeof renderManagerOSDetail === "function") return renderManagerOSDetail(os);
  if(typeof renderManagerOSDetalhe === "function") return renderManagerOSDetalhe(os);
  if(typeof openManagerOSDetail === "function") return openManagerOSDetail(os);
  if(typeof openManagerOSDetalhe === "function") return openManagerOSDetalhe(os);

  const id = os?.id_os || os?.codigo_os;
  if(id){
    localStorage.setItem("natan_manager_selected_os", JSON.stringify(os));
    managerToastSafeV351("OS selecionada");
  }else{
    managerToastSafeV351("Não foi possível abrir a OS");
  }
}

function managerEditOSDirectV351(os){
  if(!managerCanSafeV351("os_editar")) return managerBlockedSafeV351();
  if(typeof openManagerEditOS === "function") return openManagerEditOS(os);
  if(typeof editarOSGestao === "function") return editarOSGestao(os);
  managerToastSafeV351("Edição indisponível nesta tela");
}

function managerChecklistOSDirectV351(os){
  if(!managerCanSafeV351("os_checklist")) return managerBlockedSafeV351();
  if(typeof openManagerChecklistOS === "function") return openManagerChecklistOS(os);
  if(typeof aplicarChecklistGestao === "function") return aplicarChecklistGestao(os);
  managerToastSafeV351("Checklist indisponível nesta tela");
}

function managerDeleteOSDirectV351(os){
  if(!managerCanSafeV351("os_excluir")) return managerBlockedSafeV351();
  if(typeof openManagerDeleteOS === "function") return openManagerDeleteOS(os);

  modal({
    title:"Excluir OS",
    text:`Enviar ${os?.codigo_os || "esta OS"} para a lixeira?`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Excluir", className:"red", close:false, onClick:async()=>{
        await apiPost({
          acao:"excluirOS",
          id_os:os?.id_os,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        managerToastSafeV351("OS enviada para lixeira");
        renderManagerOS();
      }}
    ]
  });
}

function managerRepublishOSDirectV351(os){
  if(!managerCanSafeV351("os_republicar")) return managerBlockedSafeV351();
  if(typeof openManagerRepublishOS === "function") return openManagerRepublishOS(os);

  modal({
    title:"Republicar OS",
    text:`Republicar ${os?.codigo_os || "esta OS"} criando uma nova OS com checklist limpo?`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Republicar", className:"blue", close:false, onClick:async()=>{
        const res = await apiPost({
          acao:"republicarOS",
          id_os:os?.id_os,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        managerToastSafeV351(res?.codigo_os ? `Nova OS criada: ${res.codigo_os}` : "OS republicada");
        renderManagerOS();
      }}
    ]
  });
}



/* =========================
   HOTFIX V3.35.2 — Fallback visual direto para OS da Gestão
   ========================= */

async function managerLoadOSDetailSafeV352(os){
  const id = os?.id_os || os?.codigo_os || "";
  try{
    if(id){
      const res = await apiGet("gestorOSDetalhe", {id_os:id, __force:true});
      return {
        os: res?.os || os,
        checklist: Array.isArray(res?.checklist) ? res.checklist : [],
        subtarefas: Array.isArray(res?.subtarefas) ? res.subtarefas : [],
        historico: Array.isArray(res?.historico) ? res.historico : []
      };
    }
  }catch(e){
    console.warn("Falha ao carregar detalhe da OS; usando dados do card", e);
  }
  return {os, checklist:[], subtarefas:[], historico:[]};
}

async function managerOpenOSFallbackV352(os){
  if(!managerCanSafeV351("os_visualizar")) return managerBlockedSafeV351();

  setupManagerShell("operations");
  renderWithManagerHeader(`<div class="fast-loading"><div class="cache-status">Carregando OS...</div><div class="skeleton-card"></div></div>`);

  const detail = await managerLoadOSDetailSafeV352(os);
  const o = detail.os || os || {};
  const checklist = detail.checklist || [];
  const subtarefas = detail.subtarefas || [];

  renderWithManagerHeader(`
    <section class="manager-subpage fade-in">
      <div>
        <h1 class="manager-page-title">${escapeHtml(o.codigo_os || "OS")}</h1>
        <p class="manager-page-subtitle">${escapeHtml(o.motor || "Motor não informado")} • ${escapeHtml(o.setor_atual || "-")} • ${escapeHtml(o.status || "-")}</p>
      </div>

      <div class="manager-os-compact-actions">
        ${managerAllowed("os_editar", `<button data-manager-detail-edit><span class="material-symbols-outlined">edit</span>Editar</button>`)}
        ${managerAllowed("os_checklist", `<button data-manager-detail-checklist><span class="material-symbols-outlined">playlist_add</span>Checklist</button>`)}
        ${managerAllowed("os_republicar", `<button class="warning" data-manager-detail-republish><span class="material-symbols-outlined">replay</span>Republicar</button>`)}
        ${managerAllowed("os_excluir", `<button class="danger" data-manager-detail-delete><span class="material-symbols-outlined">delete</span>Excluir</button>`)}
        <button data-manager-back-os><span class="material-symbols-outlined">arrow_back</span>Voltar</button>
      </div>

      <section class="manager-section-compact">
        <div class="manager-section-compact-header">
          <div>
            <h2>Resumo operacional</h2>
            <p>Visão de Gestão da ordem selecionada.</p>
          </div>
        </div>
        <div class="manager-operations-head">
          <div class="manager-mini-kpi"><small>Status</small><b style="font-size:16px">${escapeHtml(o.status || "-")}</b></div>
          <div class="manager-mini-kpi"><small>Etapa</small><b style="font-size:16px">${escapeHtml(o.etapa_atual || "-")}</b></div>
          <div class="manager-mini-kpi"><small>Setor</small><b style="font-size:16px">${escapeHtml(o.setor_atual || "-")}</b></div>
        </div>
      </section>

      <section class="manager-section-compact">
        <div class="manager-section-compact-header">
          <div>
            <h2>Checklist</h2>
            <p>Itens vinculados à OS.</p>
          </div>
          <span class="manager-compact-count">${checklist.length}</span>
        </div>
        <div class="manager-os-compact-list">
          ${checklist.length ? checklist.map(item=>`
            <article class="manager-os-compact-card">
              <div class="manager-os-compact-top">
                <div>
                  <h3>${escapeHtml(item.descricao || "Item")}</h3>
                  <p>${escapeHtml(item.etapa || "-")} • ${String(item.concluido).toLowerCase()==="true" ? "Concluído" : "Pendente"}</p>
                </div>
                <span class="manager-chip ${String(item.concluido).toLowerCase()==="true" ? "green" : "yellow"}">${String(item.concluido).toLowerCase()==="true" ? "OK" : "Pendente"}</span>
              </div>
            </article>
          `).join("") : `<div class="empty">Nenhum item de checklist retornado pela API.</div>`}
        </div>
      </section>

      <section class="manager-section-compact">
        <div class="manager-section-compact-header">
          <div>
            <h2>Subtarefas vinculadas</h2>
            <p>Pendências e atividades intersetoriais desta OS.</p>
          </div>
          <span class="manager-compact-count">${subtarefas.length}</span>
        </div>
        <div class="manager-os-compact-list">
          ${subtarefas.length ? subtarefas.map(s=>`
            <article class="manager-subtask-card">
              <div class="manager-os-compact-top">
                <div>
                  <h3>${escapeHtml(s.descricao || "Subtarefa")}</h3>
                  <p>${escapeHtml(s.status || "Pendente")}</p>
                </div>
                <span class="manager-sector-tag">${escapeHtml(s.setor_destino || "Sem setor")}</span>
              </div>
            </article>
          `).join("") : `<div class="empty">Nenhuma subtarefa vinculada retornada pela API.</div>`}
        </div>
      </section>
    </section>
  `);

  document.querySelector("[data-manager-detail-edit]")?.addEventListener("click", ()=>managerEditOSFallbackV352(o));
  document.querySelector("[data-manager-detail-checklist]")?.addEventListener("click", ()=>managerChecklistOSFallbackV352(o));
  document.querySelector("[data-manager-detail-republish]")?.addEventListener("click", ()=>managerRepublishOSDirectV351(o));
  document.querySelector("[data-manager-detail-delete]")?.addEventListener("click", ()=>managerDeleteOSDirectV351(o));
  document.querySelectorAll("[data-manager-back-os]").forEach(btn=>btn.onclick = ()=>renderManagerOS());
}

function managerEditOSFallbackV352(os){
  if(!managerCanSafeV351("os_editar")) return managerBlockedSafeV351();

  modal({
    title:"Editar OS",
    text:`
      <div class="manager-form-grid">
        <label>Motor
          <input id="editOsMotorV352" value="${escapeHtml(os?.motor || "")}">
        </label>
        <label>Status
          <select id="editOsStatusV352">
            <option value="Em processo" ${String(os?.status)==="Em processo" ? "selected" : ""}>Em processo</option>
            <option value="Concluído" ${String(os?.status)==="Concluído" ? "selected" : ""}>Concluído</option>
          </select>
        </label>
        <label>Etapa atual
          <select id="editOsEtapaV352">
            <option value="Desmontagem" ${String(os?.etapa_atual)==="Desmontagem" ? "selected" : ""}>Desmontagem</option>
            <option value="Montagem" ${String(os?.etapa_atual)==="Montagem" ? "selected" : ""}>Montagem</option>
            <option value="Elétrica" ${String(os?.etapa_atual)==="Elétrica" ? "selected" : ""}>Elétrica</option>
            <option value="Usinagem" ${String(os?.etapa_atual)==="Usinagem" ? "selected" : ""}>Usinagem</option>
          </select>
        </label>
        <label>Setor atual
          <select id="editOsSetorV352">
            <option value="Desmontagem" ${String(os?.setor_atual)==="Desmontagem" ? "selected" : ""}>Desmontagem</option>
            <option value="Montagem" ${String(os?.setor_atual)==="Montagem" ? "selected" : ""}>Montagem</option>
            <option value="Elétrica" ${String(os?.setor_atual)==="Elétrica" ? "selected" : ""}>Elétrica</option>
            <option value="Usinagem" ${String(os?.setor_atual)==="Usinagem" ? "selected" : ""}>Usinagem</option>
          </select>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Salvar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorEditarOS",
          id_os:os?.id_os,
          motor:document.querySelector("#editOsMotorV352")?.value?.trim(),
          status:document.querySelector("#editOsStatusV352")?.value,
          etapa_atual:document.querySelector("#editOsEtapaV352")?.value,
          setor_atual:document.querySelector("#editOsSetorV352")?.value,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        managerToastSafeV351("OS atualizada");
        renderManagerOS();
      }}
    ]
  });
}

function managerChecklistOSFallbackV352(os){
  if(!managerCanSafeV351("os_checklist")) return managerBlockedSafeV351();

  modal({
    title:"Aplicar checklist",
    text:`
      <div class="manager-form-grid">
        <label>Modelo
          <select id="checklistModelV352">
            <option value="desmontagem">Checklist Desmontagem</option>
            <option value="montagem">Checklist Montagem</option>
            <option value="eletrica">Checklist Elétrica</option>
            <option value="usinagem">Checklist Usinagem</option>
          </select>
        </label>
        <label>Observação
          <textarea id="checklistObsV352" rows="3" placeholder="Opcional"></textarea>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Aplicar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorAplicarChecklistOS",
          id_os:os?.id_os,
          modelo:document.querySelector("#checklistModelV352")?.value,
          observacao:document.querySelector("#checklistObsV352")?.value?.trim(),
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        managerToastSafeV351("Checklist aplicado");
        renderManagerOS();
      }}
    ]
  });
}

// Sobrescreve as ações diretas anteriores para garantir funcionamento.




function bindManagerOSActions(){
  document.querySelectorAll("[data-manager-open-os]").forEach(btn=>{
    btn.onclick = ()=>managerOpenOSFallbackV352(decodeManagerPayloadSafeV351(btn.dataset.managerOpenOs));
  });

  document.querySelectorAll("[data-manager-edit-os]").forEach(btn=>{
    btn.onclick = ()=>managerEditOSFallbackV352(decodeManagerPayloadSafeV351(btn.dataset.managerEditOs));
  });

  document.querySelectorAll("[data-manager-checklist-os]").forEach(btn=>{
    btn.onclick = ()=>managerChecklistOSFallbackV352(decodeManagerPayloadSafeV351(btn.dataset.managerChecklistOs));
  });

  document.querySelectorAll("[data-manager-delete-os]").forEach(btn=>{
    btn.onclick = ()=>managerDeleteOSDirectV351(decodeManagerPayloadSafeV351(btn.dataset.managerDeleteOs));
  });

  document.querySelectorAll("[data-manager-republish-os]").forEach(btn=>{
    btn.onclick = ()=>managerRepublishOSDirectV351(decodeManagerPayloadSafeV351(btn.dataset.managerRepublishOs));
  });

  document.querySelectorAll("[data-manager-back-os]").forEach(btn=>{
    btn.onclick = ()=>renderManagerOS();
  });
}


let managerCache = { resumo:null, produtividade:null, dashboard:null };




function getFactoryVariant(){
  return localStorage.getItem("natan_factory_variant") || "green";
}

function setFactoryVariant(variant){
  localStorage.setItem("natan_factory_variant", variant || "green");
  applyTheme(localStorage.getItem("natan_theme") || getManagerThemeMode());
}

function factoryVariantLabel(value = getFactoryVariant()){
  const map = {
    green:"Verde industrial",
    amber:"Âmbar manutenção",
    steel:"Aço azul"
  };
  return map[value] || "Verde industrial";
}

function getManagerThemeMode(){
  return localStorage.getItem("natan_manager_theme_mode") || localStorage.getItem("natan_theme") || "dark";
}

function applyManagerThemeMode(mode){
  const finalMode = mode === "auto"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;

  localStorage.setItem("natan_manager_theme_mode", mode);
  localStorage.setItem("natan_theme", finalMode);
  applyTheme(finalMode);
}

function getManagerPrefs(){
  try{
    return JSON.parse(localStorage.getItem("natan_manager_prefs") || "{}");
  }catch(e){
    return {};
  }
}

function setManagerPref(key, value){
  const prefs = getManagerPrefs();
  prefs[key] = value;
  localStorage.setItem("natan_manager_prefs", JSON.stringify(prefs));
  applyManagerPrefs();
}

function applyManagerPrefs(){
  const prefs = getManagerPrefs();
  const layout = getManagerLayout();
  const factoryVariant = getFactoryVariant();

  document.body.classList.remove(
    "manager-layout-standard",
    "manager-layout-dense",
    "manager-layout-executive",
    "manager-layout-kpi"
  );

  document.body.classList.add(`manager-layout-${layout || "standard"}`);

  document.body.classList.toggle("manager-compact-mode", !!prefs.compactMode);
  document.body.classList.toggle("manager-hide-alerts", !!prefs.hideAlerts);
  document.body.classList.toggle("manager-prioritize-bottlenecks", prefs.prioritizeBottlenecks !== false);
  document.body.classList.toggle("manager-hide-kpi-events", !!prefs.hideKpiEvents);
  document.body.classList.toggle("manager-hide-kpi-rate", !!prefs.hideKpiRate);
  document.body.classList.toggle("manager-hide-kpi-subtasks", !!prefs.hideKpiSubtasks);
}


function getManagerLayout(){
  return localStorage.getItem("natan_manager_layout") || "standard";
}

function setManagerLayout(layout){
  localStorage.setItem("natan_manager_layout", layout || "standard");
  applyManagerPrefs();
  window.dispatchEvent(new Event("natan-manager-layout-change"));
}

function getManagerParams(){
  try{
    return JSON.parse(localStorage.getItem("natan_manager_params") || "{}");
  }catch(e){
    return {};
  }
}

function setManagerParams(params){
  localStorage.setItem("natan_manager_params", JSON.stringify(params || {}));
}

function managerLayoutLabel(layout = getManagerLayout()){
  const map = {
    standard:"Padrão",
    dense:"Compacto",
    executive:"Executivo",
    kpi:"Foco em KPIs"
  };
  return map[layout] || "Padrão";
}

function managerThemeLabel(mode = getManagerThemeMode()){
  const map = {dark:"Escuro", light:"Claro", factory:"Chão de fábrica", auto:"Automático"};
  return map[mode] || "Escuro";
}

function getManagerQrMode(){
  return localStorage.getItem("natan_manager_qr_mode") || "auto";
}

function setManagerQrMode(mode){
  localStorage.setItem("natan_manager_qr_mode", mode || "auto");
}

function managerQrLabel(mode = getManagerQrMode()){
  const map = {
    auto:"AUTO",
    os:"OS",
    subtarefa:"SUB",
    kit:"KIT"
  };
  return map[mode] || "AUTO";
}

function managerHeader(){
  const u = currentUser();
  const initials = String(u.nome || "G").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "G";
  const mode = getManagerQrMode();

  return `
    <header class="manager-op-header">
      <div class="manager-op-user">
        <div class="manager-op-avatar">${initials}</div>
        <div class="manager-op-title">
          <b>Olá, ${u.nome || "Gestão"}</b>
          <span><i class="manager-status-dot"></i>${u.setor || "Gestão"} • Online</span>
        </div>
      </div>
      <div class="manager-op-actions">
        <button class="manager-header-btn" type="button" id="managerSearchBtn" title="Buscar">
          <span class="material-symbols-outlined">search</span>
        </button>
        <button class="manager-header-btn primary" type="button" id="managerQrBtn" title="Ler QR">
          <span class="material-symbols-outlined">qr_code_scanner</span>
          <span class="manager-qr-mode-pill">${managerQrLabel(mode)}</span>
        </button>
      </div>
    </header>
  `;
}

function bindManagerHeader(){
  document.querySelector("#managerQrBtn")?.addEventListener("click", ()=>{
    localStorage.setItem("natan_qr_context", "gestao");
    localStorage.setItem("natan_qr_mode", getManagerQrMode());
    openQrScreen();
  });

  document.querySelector("#managerSearchBtn")?.addEventListener("click", ()=>{
    toast("Busca operacional será refinada na próxima etapa.");
  });
}

function renderWithManagerHeader(html){
  screen().innerHTML = managerHeader() + html;
  bindManagerHeader();
}


function managerNav(active = "home"){
  const tabs = [
    ["home","home","Início"],
    ["operations","precision_manufacturing","Operação"],
    ...(managerCan("configuracoes_gestao") ? [["config","settings","Config."]] : []),
    ["menu","menu","Menu"]
  ];

  document.querySelector("#managerBottomNav")?.remove();

  const nav = document.createElement("nav");
  nav.id = "managerBottomNav";
  nav.className = "manager-bottom-nav";
  nav.innerHTML = tabs.map(([key,icon,label])=>`
    <button type="button" class="${active===key ? "active" : ""}" data-manager-tab="${key}">
      <span class="material-symbols-outlined">${icon}</span>
      <span>${label}</span>
    </button>
  `).join("");

  document.body.appendChild(nav);

  nav.querySelectorAll("[data-manager-tab]").forEach(btn=>{
    btn.onclick = ()=>{
      const tab = btn.dataset.managerTab;
      if(tab === "home") return renderManager();
      if(tab === "operations") return renderManagerOS();
      if(tab === "config") return renderManagerConfig();
      if(tab === "menu") return openManagerSideMenu();
    };
  });
}


function closeManagerSideMenu(){
  document.querySelector("#managerSideDrawerBackdrop")?.remove();
}

function openManagerSideMenu(){
  document.querySelector("#managerSideDrawerBackdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "managerSideDrawerBackdrop";
  backdrop.className = "manager-drawer-backdrop";
  backdrop.innerHTML = `
    <aside class="manager-side-drawer" role="dialog" aria-label="Menu da Gestão">
      <div class="manager-drawer-top">
        <div>
          <h2>Menu da Gestão</h2>
          <p>Funções avançadas e consultas operacionais.</p>
        </div>
        <button class="manager-drawer-close" type="button" data-manager-drawer-close>×</button>
      </div>

      <div class="manager-drawer-group">
        <div class="manager-drawer-group-title">Operação</div>
        <button class="manager-drawer-item" type="button" data-manager-drawer-action="operations">
          <span class="material-symbols-outlined">precision_manufacturing</span>
          <span><b>Operação unificada</b><small>OS abertas e subtarefas no mesmo painel.</small></span>
        </button>
        ${managerCan("subtarefas_visualizar") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="subtasks">
          <span class="material-symbols-outlined">alt_route</span>
          <span><b>Subtarefas detalhadas</b><small>Gargalos e pendências por setor.</small></span>
        </button>` : ""}
        ${managerCan("qr_ler") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="qr">
          <span class="material-symbols-outlined">qr_code_scanner</span>
          <span><b>Ler QR Code</b><small>Abrir OS, subtarefa ou carrinho kit.</small></span>
        </button>` : ""}
      </div>

      <div class="manager-drawer-group">
        <div class="manager-drawer-group-title">Gestão</div>
        ${managerCan("equipe_visualizar") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="team">
          <span class="material-symbols-outlined">groups</span>
          <span><b>Equipe</b><small>Operadores, ações e produtividade.</small></span>
        </button>` : ""}
        ${managerCan("solicitacoes_admin") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="requests">
          <span class="material-symbols-outlined">send</span>
          <span><b>Solicitações ao Admin</b><small>Pedidos e aprovações estruturais.</small></span>
        </button>` : ""}
      </div>

      <div class="manager-drawer-group">
        <div class="manager-drawer-group-title">Sistema</div>
        ${managerCan("lixeira_acessar") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="trash">
          <span class="material-symbols-outlined">delete</span>
          <span><b>Lixeira</b><small>Recuperar OS e subtarefas excluídas.</small></span>
        </button>` : ""}
        ${managerCan("configuracoes_gestao") ? `<button class="manager-drawer-item" type="button" data-manager-drawer-action="config">
          <span class="material-symbols-outlined">settings</span>
          <span><b>Configurações</b><small>Tema, QR, KPIs e desempenho.</small></span>
        </button>` : ""}
      </div>
    </aside>
  `;

  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", e=>{
    if(e.target === backdrop || e.target.closest("[data-manager-drawer-close]")){
      closeManagerSideMenu();
    }
  });

  backdrop.querySelectorAll("[data-manager-drawer-action]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const action = btn.dataset.managerDrawerAction;
      closeManagerSideMenu();

      if(action === "operations") return renderManagerOS();
      if(action === "subtasks") return renderManagerSubtasks();
      if(action === "team") return renderManagerTeam();
      if(action === "requests") return renderManagerRequests();
      if(action === "trash") return renderManagerTrash();
      if(action === "config") return renderManagerConfig();
      if(action === "qr"){
        if(!managerCan("qr_ler")) return managerBlockedMessage();
        localStorage.setItem("natan_qr_context", "gestao");
        localStorage.setItem("natan_qr_mode", getManagerQrMode());
        return openQrScreen();
      }
    });
  });
}


async function loadManagerData(force = false){
  const u = currentUser();
  const [resumo, produtividade, dashboard, inteligencia] = await Promise.all([
    apiGetFast("gestorResumo", {matricula:u.matricula, __force:force}).catch(()=>({})),
    apiGetFast("produtividadeResumo", {matricula:u.matricula, __force:force}).catch(()=>({})),
    apiGetFast("kpiDashboardAvancado", {matricula:u.matricula, __force:force}).catch(()=>({})),
    apiGetFast("kpiInteligenteV4", {matricula:u.matricula, __force:force}).catch(()=>({}))
  ]);

  managerCache = {resumo, produtividade, dashboard, inteligencia};
  return managerCache;
}

function setupManagerShell(active){
  const u = currentUser();
  document.body.classList.remove("desktop-mode");
  document.body.classList.add("manager-mode");
  setBottomNav(u,true,"home");
  managerNav(active === "os" || active === "subtasks" ? "operations" : active);
  screen().classList.add("manager-screen");
}

export async function renderManager(){
  await syncManagerPermissionsFromApi();
  setupManagerShell("home");
  const u = currentUser();

  screen().innerHTML = `<div class="fast-loading"><div class="cache-status">Carregando gestão...</div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;

  try{
    const {resumo, produtividade, dashboard, inteligencia} = await loadManagerData(false);

    const kpi = resumo.kpi || {};
    const smart = inteligencia.kpis || {};
    const osAbertas = Number(kpi.os_abertas ?? kpi.abertas ?? 0);
    const subtarefasPendentes = Number(kpi.subtarefas_pendentes ?? 0);
    const taxaConclusao = Number(kpi.taxa_conclusao ?? produtividade.taxa_conclusao ?? 0);
    const eventosHoje = Number(kpi.eventos_hoje ?? dashboard.eventos_hoje ?? 0);
    const setores = Array.isArray(dashboard.setores) ? dashboard.setores : [];
    const alertas = Array.isArray(dashboard.alertas) ? dashboard.alertas : [];
    const smartAlertas = Array.isArray(inteligencia.alertas) ? inteligencia.alertas : [];
    const smartRecomendacoes = Array.isArray(inteligencia.recomendacoes) ? inteligencia.recomendacoes : [];
    const hasSmartKpi = Object.keys(smart).length > 0;
    const slaHoras = Number(smart.sla_configurado_horas || 24);
    const score = Math.max(0, Math.min(100, taxaConclusao || 0));

    renderWithManagerHeader(`
      <section class="manager-exec-home fade-in">
        <div class="manager-exec-hero">
          <div class="manager-exec-hero-top">
            <div>
              <h1>Painel da Gestão</h1>
              <p>${escapeHtml(u.setor || "Gestão")} • visão rápida para decisão operacional.</p>
            </div>
            <div class="manager-exec-score">
              <div>
                <b>${score}%</b>
                <small>fluxo</small>
              </div>
            </div>
          </div>
        </div>

        <div class="manager-exec-kpis">
          <div class="manager-exec-kpi">
            <small>OS abertas</small>
            <b>${osAbertas}</b>
            <span>em andamento</span>
          </div>
          <div class="manager-exec-kpi">
            <small>Subtarefas</small>
            <b>${subtarefasPendentes}</b>
            <span>pendentes</span>
          </div>
          <div class="manager-exec-kpi">
            <small>Eventos</small>
            <b>${eventosHoje}</b>
            <span>hoje</span>
          </div>
        </div>

        ${alertas.length ? `<div class="manager-exec-alert">${escapeHtml(String(alertas[0]))}</div>` : ""}

        ${hasSmartKpi ? `
          <section class="manager-v4-intel-panel">
            <div class="manager-v4-intel-head">
              <div>
                <small>Inteligencia operacional</small>
                <h2>${Number(smart.score_inteligente || 0)}%</h2>
              </div>
              <span>${escapeHtml(smart.gargalo_principal || "Sem gargalo")}</span>
            </div>
            <div class="manager-v4-intel-grid">
              <div><small>OS em risco</small><b>${Number(smart.os_em_risco || 0)}</b></div>
              <div><small>SLA ${slaHoras}h</small><b>${Number(smart.sla_configurado ?? smart.sla_24h ?? 0)}%</b></div>
              <div><small>Lead time</small><b>${Number(smart.lead_time_medio_horas || 0)}h</b></div>
              <div><small>Dados</small><b>${Number(smart.score_qualidade_dados ?? 100)}%</b></div>
            </div>
            ${(smartAlertas[0] || smartRecomendacoes[0]) ? `
              <div class="manager-v4-intel-callout">
                ${escapeHtml(smartAlertas[0] || smartRecomendacoes[0])}
              </div>
            ` : ""}
          </section>
        ` : ""}

        <div class="manager-exec-actions">
          <button class="manager-exec-action primary" data-manager-action="operations">
            <span class="material-symbols-outlined">precision_manufacturing</span>
            Operação
          </button>
          ${managerCan("qr_ler") ? `<button class="manager-exec-action" data-manager-action="qr">
            <span class="material-symbols-outlined">qr_code_scanner</span>
            QR Code
          </button>` : ""}
          ${managerCan("equipe_visualizar") ? `<button class="manager-exec-action" data-manager-action="team">
            <span class="material-symbols-outlined">groups</span>
            Equipe
          </button>` : ""}
          <button class="manager-exec-action" data-manager-action="menu">
            <span class="material-symbols-outlined">menu</span>
            Menu
          </button>
        </div>

        ${setores.length ? `
          <section class="manager-exec-strip">
            <div class="manager-exec-strip-top">
              <h2>Setores críticos</h2>
              <button type="button" data-manager-action="operations">Abrir</button>
            </div>
            ${setores.slice(0,3).map((s,i)=>`
              <div class="manager-exec-sector-row">
                <div>
                  <b>${escapeHtml(s.setor || "Setor")}</b>
                  <small>${i+1}º maior volume de pendências</small>
                </div>
                <span>${Number(s.total || 0)}</span>
              </div>
            `).join("")}
          </section>
        ` : ""}
      </section>
    `);

    applyManagerPrefs();

    document.querySelectorAll("[data-manager-action]").forEach(btn=>{
      btn.onclick = () => {
        const action = btn.dataset.managerAction;
        if(action === "operations") return renderManagerOS();
        if(action === "qr"){
          localStorage.setItem("natan_qr_context", "gestao");
          localStorage.setItem("natan_qr_mode", getManagerQrMode());
          return openQrScreen();
        }
        if(action === "team") return renderManagerTeam();
        if(action === "menu") return openManagerSideMenu();
      };
    });
  }catch(e){
    screen().innerHTML = `<div class="empty">Erro ao carregar o Painel de Gestão.</div>`;
  }
}



function managerAllowed(permission, html){
  return managerCan(permission) ? html : "";
}

function managerBlockedMessage(){
  toast("Ação não liberada pelo Administrador");
}









export async function renderManagerOS(){
  await syncManagerPermissionsFromApi();
  setupManagerShell("operations");
  screen().innerHTML = `<div class="fast-loading"><div class="cache-status">Carregando operação...</div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;

  try{
    const pack = await loadManagerData(false).catch(err=>{
      console.warn("Falha loadManagerData operação", err);
      return {};
    });

    const resumo = pack?.resumo || {};
    const dashboard = pack?.dashboard || {};
    const kpi = resumo?.kpi || {};

    const rowsRaw = Array.isArray(resumo.os) ? resumo.os : [];
    const rows = rowsRaw.filter(o=>String(o?.excluida || o?.excluido || "").toLowerCase() !== "true");

    const setores = Array.isArray(dashboard.setores)
      ? dashboard.setores
      : Array.isArray(resumo.setores)
        ? resumo.setores
        : [];

    const alertas = Array.isArray(dashboard.alertas)
      ? dashboard.alertas
      : Array.isArray(resumo.alertas)
        ? resumo.alertas
        : [];

    const abertas = rows.length || Number(kpi.os_abertas || kpi.abertas || 0);
    const subtarefas = Number(kpi.subtarefas_pendentes ?? kpi.subtarefas ?? setores.reduce((acc,s)=>acc + Number(s.total || s.quantidade || 0),0));
    const atrasadas = Number(kpi.os_atrasadas ?? kpi.atrasadas ?? rows.filter(o=>Number(o.atrasada || 0) > 0 || String(o.atrasada).toLowerCase()==="true").length);

    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div>
          <h1 class="manager-page-title">Operação</h1>
          <p class="manager-page-subtitle">OS abertas e subtarefas em uma visão única. Use o menu para funções avançadas.</p>
        </div>

        <div class="manager-operations-head">
          <div class="manager-mini-kpi"><small>OS abertas</small><b>${abertas}</b></div>
          <div class="manager-mini-kpi"><small>Subtarefas</small><b>${subtarefas}</b></div>
          <div class="manager-mini-kpi"><small>Atrasadas</small><b>${atrasadas}</b></div>
        </div>

        ${alertas.length ? `
          <section class="manager-section-compact">
            <div class="manager-section-compact-header">
              <div><h2>Alertas</h2><p>Prioridades recentes da fila.</p></div>
              <span class="manager-compact-count">${alertas.length}</span>
            </div>
            ${alertas.slice(0,2).map(a=>`<div class="gestao-op-alert">${escapeHtml(String(a))}</div>`).join("")}
          </section>
        ` : ""}

        <div class="manager-operations-grid">
          <section class="manager-section-compact">
            <div class="manager-section-compact-header">
              <div>
                <h2>Ordens abertas</h2>
                <p>Entrar, editar, checklist, republicar ou excluir.</p>
              </div>
              <span class="manager-compact-count">${rows.length}</span>
            </div>

            <div class="manager-os-compact-list">
              ${rows.length ? rows.slice(0,8).map(o=>`
                <article class="manager-os-compact-card">
                  <div class="manager-os-compact-top">
                    <div>
                      <h3>${escapeHtml(o.codigo_os || "OS")}</h3>
                      <p>${escapeHtml(o.motor || "Motor não informado")} • ${escapeHtml(o.setor_atual || "-")} • ${escapeHtml(o.status || "-")}</p>
                    </div>
                    <span class="manager-chip">${Number(o.percentual_total || o.progresso || 0)}%</span>
                  </div>
                  <div class="manager-list-meta">
                    <span class="manager-chip">${escapeHtml(o.etapa_atual || "Etapa")}</span>
                    <span class="manager-chip ${String(o.status || "").toLowerCase().includes("concl") ? "green" : "yellow"}">${escapeHtml(o.status || "Em processo")}</span>
                  </div>
                  <div class="manager-os-compact-actions">
                    ${managerAllowed("os_visualizar", `<button class="primary" data-manager-open-os='${encodeManagerPayload(o)}'><span class="material-symbols-outlined">open_in_new</span>Entrar</button>`)}
                    ${managerAllowed("os_editar", `<button data-manager-edit-os='${encodeManagerPayload(o)}'><span class="material-symbols-outlined">edit</span>Editar</button>`)}
                    ${managerAllowed("os_checklist", `<button data-manager-checklist-os='${encodeManagerPayload(o)}'><span class="material-symbols-outlined">playlist_add</span>Checklist</button>`)}
                    ${managerAllowed("os_republicar", `<button class="warning" data-manager-republish-os='${encodeManagerPayload(o)}'><span class="material-symbols-outlined">replay</span>Republicar</button>`)}
                    ${managerAllowed("os_excluir", `<button class="danger" data-manager-delete-os='${encodeManagerPayload(o)}'><span class="material-symbols-outlined">delete</span>Excluir</button>`)}
                    <button data-manager-open-menu><span class="material-symbols-outlined">more_horiz</span>Mais</button>
                  </div>
                </article>
              `).join("") : `<div class="empty">Nenhuma OS aberta encontrada.</div>`}
            </div>
          </section>

          <section class="manager-section-compact">
            <div class="manager-section-compact-header">
              <div>
                <h2>Subtarefas por setor</h2>
                <p>Gargalos resumidos sem trocar de aba.</p>
              </div>
              <span class="manager-compact-count">${setores.length}</span>
            </div>

            <div class="manager-sector-compact-list">
              ${setores.length ? setores.slice(0,6).map((s,i)=>`
                <article class="manager-sector-compact-card">
                  <b>${escapeHtml(s.setor || s.setor_destino || "Setor")}</b>
                  <small>${i+1}º no ranking de pendências</small>
                  <strong>${Number(s.total || s.quantidade || 0)}</strong>
                </article>
              `).join("") : `<div class="empty">Nenhuma subtarefa pendente agora.</div>`}
            </div>

            <button class="manager-more-link" type="button" data-manager-subtasks-detail>
              Abrir subtarefas detalhadas
            </button>
          </section>
        </div>
      </section>
    `);

    bindManagerOSActions();
    document.querySelectorAll("[data-manager-open-menu]").forEach(btn=>btn.onclick = openManagerSideMenu);
    document.querySelector("[data-manager-subtasks-detail]")?.addEventListener("click", ()=>renderManagerSubtasks());
  }catch(e){
    console.error("Erro ao carregar Operação", e);
    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div class="empty">
          <b>Erro ao carregar operação.</b><br>
          <small>${escapeHtml(e?.message || "Falha inesperada na tela Operação.")}</small>
        </div>
        <button class="btn blue full" type="button" id="btnRetryOperation">Tentar novamente</button>
      </section>
    `);
    document.querySelector("#btnRetryOperation")?.addEventListener("click", ()=>renderManagerOS());
  }
}


function openManagerCreateSubtask(){
  modal({
    title:"Criar subtarefa",
    text:`
      <div class="manager-form-grid">
        <label>OS vinculada
          <input id="managerSubOs" placeholder="Ex.: OS-2026-0001 ou id_os">
        </label>
        <label>Setor destino
          <select id="managerSubSetor">${renderManagerSectorOptions()}</select>
        </label>
        <label>Descrição
          <textarea id="managerSubDesc" rows="4" placeholder="Descreva a pendência ou atividade intersetorial"></textarea>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Criar", className:"blue", close:false, onClick:async()=>{
        const idOs = document.querySelector("#managerSubOs")?.value?.trim();
        const setor = document.querySelector("#managerSubSetor")?.value;
        const desc = document.querySelector("#managerSubDesc")?.value?.trim();
        if(!desc) return toast("Informe a descrição");
        await apiPost({
          acao:"gestorCriarSubtarefa",
          id_os:idOs,
          setor_destino:setor,
          descricao:desc,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Subtarefa criada");
        renderManagerSubtasks();
      }}
    ]
  });
}

function openManagerEditSubtask(sub){
  modal({
    title:"Editar subtarefa",
    text:`
      <div class="manager-form-grid">
        <label>Setor destino
          <select id="managerEditSubSetor">${renderManagerSectorOptions(sub.setor_destino)}</select>
        </label>
        <label>Status
          <select id="managerEditSubStatus">${renderManagerSubtaskStatusOptions(sub.status || "Pendente")}</select>
        </label>
        <label>Descrição
          <textarea id="managerEditSubDesc" rows="4">${escapeHtml(sub.descricao || "")}</textarea>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Salvar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorEditarSubtarefa",
          id_subtarefa:sub.id_subtarefa,
          setor_destino:document.querySelector("#managerEditSubSetor")?.value,
          status:document.querySelector("#managerEditSubStatus")?.value,
          descricao:document.querySelector("#managerEditSubDesc")?.value?.trim(),
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Subtarefa atualizada");
        renderManagerSubtasks();
      }}
    ]
  });
}

function openManagerDeleteSubtask(sub){
  modal({
    title:"Excluir subtarefa",
    text:`Excluir a subtarefa "${sub.descricao || sub.id_subtarefa}"? Ela irá para a lixeira e poderá ser recuperada.`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Excluir", className:"red", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorExcluirSubtarefa",
          id_subtarefa:sub.id_subtarefa,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Subtarefa enviada para lixeira");
        renderManagerSubtasks();
      }}
    ]
  });
}

function openManagerSequenceSubtasks(){
  modal({
    title:"Criar sequência",
    text:`
      <div class="manager-form-grid">
        <label>OS vinculada
          <input id="managerSeqOs" placeholder="Ex.: OS-2026-0001 ou id_os">
        </label>
        <label>Sequência de setores
          <input id="managerSeqSetores" placeholder="Ex.: Elétrica, Usinagem, Qualidade">
        </label>
        <label>Descrição base
          <textarea id="managerSeqDesc" rows="4" placeholder="Ex.: Inspecionar, corrigir e validar componente"></textarea>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Criar sequência", className:"blue", close:false, onClick:async()=>{
        const setores = document.querySelector("#managerSeqSetores")?.value || "";
        const desc = document.querySelector("#managerSeqDesc")?.value || "";
        const idOs = document.querySelector("#managerSeqOs")?.value || "";
        if(!setores.trim() || !desc.trim()) return toast("Informe setores e descrição");
        await apiPost({
          acao:"gestorCriarSequenciaSubtarefas",
          id_os:idOs.trim(),
          setores:setores,
          descricao:desc.trim(),
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Sequência criada");
        renderManagerSubtasks();
      }}
    ]
  });
}

function openManagerApplySubtaskModel(sub = {}){
  modal({
    title:"Usar modelo de subtarefa",
    text:`
      <div class="manager-form-grid">
        <label>OS vinculada
          <input id="managerModelSubOs" value="${escapeHtml(sub.id_os || "")}" placeholder="Ex.: OS-2026-0001 ou id_os">
        </label>
        <label>Modelo
          <select id="managerSubModel">
            <option value="eletrica">Inspeção elétrica</option>
            <option value="usinagem">Correção usinagem</option>
            <option value="qualidade">Validação qualidade</option>
            <option value="montagem">Apoio montagem</option>
          </select>
        </label>
        <label>Setor destino
          <select id="managerModelSetor">${renderManagerSectorOptions(sub.setor_destino || "Elétrica")}</select>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Aplicar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorAplicarModeloSubtarefa",
          id_subtarefa:sub.id_subtarefa || "",
          id_os:document.querySelector("#managerModelSubOs")?.value?.trim(),
          modelo:document.querySelector("#managerSubModel")?.value,
          setor_destino:document.querySelector("#managerModelSetor")?.value,
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Modelo aplicado");
        renderManagerSubtasks();
      }}
    ]
  });
}

function managerChangeSubtaskStatus(sub, status){
  modal({
    title: status === "Concluída" ? "Concluir subtarefa" : "Reabrir subtarefa",
    text:`Confirmar alteração da subtarefa para "${status}"?`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Confirmar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorEditarSubtarefa",
          id_subtarefa:sub.id_subtarefa,
          status,
          descricao:sub.descricao || "",
          setor_destino:sub.setor_destino || "",
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Status atualizado");
        renderManagerSubtasks();
      }}
    ]
  });
}


function openManagerViewSubtask(sub){
  modal({
    title:"Visualizar subtarefa",
    text:`
      <div class="manager-subtask-view">
        <div><b>Descrição</b><span>${escapeHtml(sub.descricao || "Sem descrição")}</span></div>
        <div><b>Setor destino</b><span class="manager-sector-tag">${escapeHtml(sub.setor_destino || "Sem setor")}</span></div>
        <div><b>Status</b><span>${escapeHtml(sub.status || "Pendente")}</span></div>
        <div><b>OS vinculada</b><span>${escapeHtml(sub.codigo_os || sub.id_os || "-")}</span></div>
        <div><b>ID</b><span>${escapeHtml(sub.id_subtarefa || "-")}</span></div>
        <div><b>Criado em</b><span>${escapeHtml(sub.criado_em || sub.data_criacao || "-")}</span></div>
      </div>
    `,
    html:true,
    actions:[
      {label:"Fechar", className:"light"}
    ]
  });
}

function openManagerRepeatSubtask(sub){
  modal({
    title:"Repetir subtarefa",
    text:`
      <div class="manager-form-grid">
        <label>OS vinculada
          <input id="managerRepeatSubOs" value="${escapeHtml(sub.id_os || "")}" placeholder="Ex.: OS-2026-0001 ou id_os">
        </label>
        <label>Setor destino
          <select id="managerRepeatSubSetor">${renderManagerSectorOptions(sub.setor_destino || "")}</select>
        </label>
        <label>Descrição
          <textarea id="managerRepeatSubDesc" rows="4">${escapeHtml(sub.descricao || "")}</textarea>
        </label>
      </div>
    `,
    html:true,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Repetir", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao:"gestorRepetirSubtarefa",
          id_subtarefa:sub.id_subtarefa || "",
          id_os:document.querySelector("#managerRepeatSubOs")?.value?.trim(),
          setor_destino:document.querySelector("#managerRepeatSubSetor")?.value,
          descricao:document.querySelector("#managerRepeatSubDesc")?.value?.trim(),
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast("Subtarefa repetida");
        renderManagerSubtasks();
      }}
    ]
  });
}

function bindManagerSubtaskActions(){
  document.querySelector("#btnManagerCreateSubtask")?.addEventListener("click", ()=>managerCan("subtarefas_criar") ? openManagerCreateSubtask() : managerBlockedMessage());
  document.querySelector("#btnManagerSequenceSubtasks")?.addEventListener("click", ()=>managerCan("subtarefas_criar") ? openManagerSequenceSubtasks() : managerBlockedMessage());
  document.querySelector("#btnManagerApplySubtaskModel")?.addEventListener("click", ()=>managerCan("subtarefas_modelo") ? openManagerApplySubtaskModel({}) : managerBlockedMessage());

  document.querySelectorAll("[data-manager-edit-sub]").forEach(btn=>{
    btn.onclick = ()=>openManagerEditSubtask(decodeManagerSubtaskPayload(btn.dataset.managerEditSub));
  });

  document.querySelectorAll("[data-manager-delete-sub]").forEach(btn=>{
    btn.onclick = ()=>openManagerDeleteSubtask(decodeManagerSubtaskPayload(btn.dataset.managerDeleteSub));
  });

  document.querySelectorAll("[data-manager-model-sub]").forEach(btn=>{
    btn.onclick = ()=>openManagerApplySubtaskModel(decodeManagerSubtaskPayload(btn.dataset.managerModelSub));
  });

  document.querySelectorAll("[data-manager-complete-sub]").forEach(btn=>{
    btn.onclick = ()=>managerChangeSubtaskStatus(decodeManagerSubtaskPayload(btn.dataset.managerCompleteSub), "Concluída");
  });

  document.querySelectorAll("[data-manager-reopen-sub]").forEach(btn=>{
    btn.onclick = ()=>managerChangeSubtaskStatus(decodeManagerSubtaskPayload(btn.dataset.managerReopenSub), "Pendente");
  });
  document.querySelectorAll("[data-manager-view-sub]").forEach(btn=>{
    btn.onclick = ()=>openManagerViewSubtask(decodeManagerSubtaskPayload(btn.dataset.managerViewSub));
  });

  document.querySelectorAll("[data-manager-repeat-sub]").forEach(btn=>{
    btn.onclick = ()=>openManagerRepeatSubtask(decodeManagerSubtaskPayload(btn.dataset.managerRepeatSub));
  });

}


export async function renderManagerSubtasks(){
  await syncManagerPermissionsFromApi();
  if(!managerCan("subtarefas_visualizar")) return managerBlockedMessage();
  setupManagerShell("operations");
  renderWithManagerHeader(`<div class="fast-loading"><div class="cache-status">Carregando todas as subtarefas...</div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`);

  try{
    let subtarefas = [];

    const apiAll = await apiGet("gestorTodasSubtarefas", {__force:true}).catch(()=>null);
    if(Array.isArray(apiAll?.subtarefas)){
      subtarefas = apiAll.subtarefas;
    }else{
      const pack = await loadManagerData(false).catch(()=>({resumo:{},dashboard:{}}));
      const resumo = pack?.resumo || {};
      const dashboard = pack?.dashboard || {};
      subtarefas = Array.isArray(resumo.subtarefas)
        ? resumo.subtarefas
        : Array.isArray(dashboard.subtarefas)
          ? dashboard.subtarefas
          : [];
    }

    subtarefas = subtarefas.filter(s=>String(s.excluida || s.excluido || "").toLowerCase() !== "true");

    const pendentes = subtarefas.filter(s=>!String(s.status || "").toLowerCase().includes("concl"));
    const concluidas = subtarefas.filter(s=>String(s.status || "").toLowerCase().includes("concl"));

    const setoresMap = subtarefas.reduce((acc,s)=>{
      const setor = s.setor_destino || "Sem setor";
      acc[setor] = (acc[setor] || 0) + 1;
      return acc;
    },{});
    const setores = Object.entries(setoresMap).sort((a,b)=>b[1]-a[1]);

    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div>
          <h1 class="manager-page-title">Todas as subtarefas</h1>
          <p class="manager-page-subtitle">A Gestão visualiza, edita, exclui e repete subtarefas de todos os setores.</p>
        </div>

        <div class="manager-operations-head">
          <div class="manager-mini-kpi"><small>Total</small><b>${subtarefas.length}</b></div>
          <div class="manager-mini-kpi"><small>Pendentes</small><b>${pendentes.length}</b></div>
          <div class="manager-mini-kpi"><small>Concluídas</small><b>${concluidas.length}</b></div>
        </div>

        <section class="manager-section-compact">
          <div class="manager-section-compact-header">
            <div>
              <h2>Ações rápidas</h2>
              <p>Criar, sequenciar ou aplicar modelos liberados pelo Admin.</p>
            </div>
          </div>

          <div class="manager-subtask-action-grid">
            ${managerCan("subtarefas_criar") ? `<button id="btnManagerCreateSubtask" class="manager-subtask-action primary" type="button">
              <span class="material-symbols-outlined">add_task</span>
              Criar
            </button>` : ""}
            ${managerCan("subtarefas_criar") ? `<button id="btnManagerSequenceSubtasks" class="manager-subtask-action" type="button">
              <span class="material-symbols-outlined">account_tree</span>
              Sequência
            </button>` : ""}
            ${managerCan("subtarefas_modelo") ? `<button id="btnManagerApplySubtaskModel" class="manager-subtask-action" type="button">
              <span class="material-symbols-outlined">library_add_check</span>
              Usar modelo
            </button>` : ""}
          </div>
        </section>

        ${setores.length ? `
          <section class="manager-section-compact">
            <div class="manager-section-compact-header">
              <div>
                <h2>Subtarefas por setor</h2>
                <p>Todas as subtarefas agrupadas por destino.</p>
              </div>
              <span class="manager-compact-count">${setores.length}</span>
            </div>
            <div class="manager-sector-compact-list">
              ${setores.slice(0,8).map(([setor,total],i)=>`
                <article class="manager-sector-compact-card">
                  <b>${escapeHtml(setor)}</b>
                  <small>${i+1}º maior volume</small>
                  <strong>${Number(total)}</strong>
                </article>
              `).join("")}
            </div>
          </section>
        ` : ""}

        <section class="manager-section-compact">
          <div class="manager-section-compact-header">
            <div>
              <h2>Lista geral</h2>
              <p>Sem filtro por setor. Cada subtarefa possui tag de setor.</p>
            </div>
            <span class="manager-compact-count">${subtarefas.length}</span>
          </div>

          <div class="manager-os-compact-list">
            ${subtarefas.length ? subtarefas.map(s=>`
              <article class="manager-subtask-card">
                <div class="manager-os-compact-top">
                  <div>
                    <h3>${escapeHtml(s.descricao || "Subtarefa")}</h3>
                    <p>OS: ${escapeHtml(s.codigo_os || s.id_os || "-")} • ID: ${escapeHtml(s.id_subtarefa || "-")}</p>
                  </div>
                  <span class="manager-sector-tag">${escapeHtml(s.setor_destino || "Sem setor")}</span>
                </div>

                <div class="manager-list-meta">
                  <span class="manager-chip ${String(s.status || "").toLowerCase().includes("concl") ? "green" : "yellow"}">${escapeHtml(s.status || "Pendente")}</span>
                  <span class="manager-chip">${escapeHtml(s.criado_em || s.data_criacao || "-")}</span>
                </div>

                <div class="manager-subtask-actions expanded">
                  <button data-manager-view-sub='${encodeManagerSubtaskPayload(s)}'>
                    <span class="material-symbols-outlined">visibility</span>Ver
                  </button>
                  ${managerAllowed("subtarefas_editar", `<button data-manager-edit-sub='${encodeManagerSubtaskPayload(s)}'>
                    <span class="material-symbols-outlined">edit</span>Editar
                  </button>`)}
                  ${managerAllowed("subtarefas_repetir", `<button data-manager-repeat-sub='${encodeManagerSubtaskPayload(s)}'>
                    <span class="material-symbols-outlined">content_copy</span>Repetir
                  </button>`)}
                  ${managerAllowed("subtarefas_modelo", `<button data-manager-model-sub='${encodeManagerSubtaskPayload(s)}'>
                    <span class="material-symbols-outlined">library_add_check</span>Modelo
                  </button>`)}
                  ${managerCan("subtarefas_concluir") ? (String(s.status || "").toLowerCase().includes("concl") ? `
                    <button data-manager-reopen-sub='${encodeManagerSubtaskPayload(s)}'>
                      <span class="material-symbols-outlined">replay</span>Reabrir
                    </button>
                  ` : `
                    <button class="primary" data-manager-complete-sub='${encodeManagerSubtaskPayload(s)}'>
                      <span class="material-symbols-outlined">done</span>Concluir
                    </button>
                  `) : ""}
                  ${managerAllowed("subtarefas_excluir", `<button class="danger" data-manager-delete-sub='${encodeManagerSubtaskPayload(s)}'>
                    <span class="material-symbols-outlined">delete</span>Excluir
                  </button>`)}
                </div>
              </article>
            `).join("") : `<div class="empty">Nenhuma subtarefa encontrada.</div>`}
          </div>
        </section>
      </section>
    `);

    bindManagerSubtaskActions();
  }catch(e){
    console.error("Erro ao carregar subtarefas", e);
    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div class="empty">
          <b>Erro ao carregar subtarefas.</b><br>
          <small>${escapeHtml(e?.message || "Falha inesperada.")}</small>
        </div>
        <button class="btn blue full" type="button" id="btnRetryManagerSubtasks">Tentar novamente</button>
      </section>
    `);
    document.querySelector("#btnRetryManagerSubtasks")?.addEventListener("click", ()=>renderManagerSubtasks());
  }
}


async function loadManagerTrash(){
  const normalizeTrashV354 = (res)=>{
    if(!res || typeof res !== "object") return {os:[], subtarefas:[]};
    return {
      os:Array.isArray(res.os) ? res.os : Array.isArray(res.ordens) ? res.ordens : [],
      subtarefas:Array.isArray(res.subtarefas) ? res.subtarefas : Array.isArray(res.subs) ? res.subs : []
    };
  };

  try{
    const res = await apiGet("gestorLixeira", {__force:true});
    return normalizeTrashV354(res);
  }catch(e){
    console.warn("gestorLixeira falhou; tentando fallback", e);

    try{
      const pack = await loadManagerData(false).catch(()=>({resumo:{}}));
      const resumo = pack?.resumo || {};
      const osBase = Array.isArray(resumo.os) ? resumo.os : [];
      const subBase = Array.isArray(resumo.subtarefas) ? resumo.subtarefas : [];

      return {
        os:osBase.filter(o=>String(o.excluida || o.excluido || "").toLowerCase()==="true"),
        subtarefas:subBase.filter(s=>String(s.excluida || s.excluido || "").toLowerCase()==="true")
      };
    }catch{
      return {os:[], subtarefas:[]};
    }
  }
}


async function renderManagerTrash(){
  if(!managerCan("lixeira_acessar")) return managerBlockedMessage();
  setupManagerShell("menu");
  renderWithManagerHeader(`<div class="fast-loading"><div class="cache-status">Carregando lixeira...</div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`);

  try{
    const trash = await loadManagerTrash();
    const osRows = trash.os || [];
    const subRows = trash.subtarefas || [];

    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div>
          <h1 class="manager-page-title">Lixeira</h1>
          <p class="manager-page-subtitle">Recuperação controlada de OS e subtarefas excluídas.</p>
        </div>

        <div class="manager-operations-head">
          <div class="manager-mini-kpi"><small>OS excluídas</small><b>${osRows.length}</b></div>
          <div class="manager-mini-kpi"><small>Subtarefas</small><b>${subRows.length}</b></div>
          <div class="manager-mini-kpi"><small>Rastreável</small><b>100%</b></div>
        </div>

        <section class="manager-section-compact">
          <div class="manager-section-compact-header">
            <div>
              <h2>Ordens de serviço</h2>
              <p>OS excluídas que podem ser recuperadas.</p>
            </div>
            <span class="manager-compact-count">${osRows.length}</span>
          </div>

          <div class="manager-os-compact-list">
            ${osRows.length ? osRows.map(o=>`
              <article class="manager-os-compact-card">
                <div class="manager-os-compact-top">
                  <div>
                    <h3>${escapeHtml(o.codigo_os || "OS")}</h3>
                    <p>${escapeHtml(o.motor || "Motor não informado")} • Excluída por ${escapeHtml(o.excluido_por || o.excluida_por || "-")}</p>
                  </div>
                  <span class="manager-chip red">OS</span>
                </div>
                <div class="manager-list-meta">
                  <span class="manager-chip">${escapeHtml(o.setor_atual || "-")}</span>
                  <span class="manager-chip">${escapeHtml(o.excluido_em || o.excluida_em || "-")}</span>
                </div>
                <div class="manager-os-compact-actions">
                  <button class="primary" data-restore-os="${escapeHtml(o.id_os)}"><span class="material-symbols-outlined">restore</span>Recuperar</button>
                </div>
              </article>
            `).join("") : `<div class="empty">Nenhuma OS excluída.</div>`}
          </div>
        </section>

        <section class="manager-section-compact">
          <div class="manager-section-compact-header">
            <div>
              <h2>Subtarefas</h2>
              <p>Subtarefas excluídas que podem voltar para a fila.</p>
            </div>
            <span class="manager-compact-count">${subRows.length}</span>
          </div>

          <div class="manager-os-compact-list">
            ${subRows.length ? subRows.map(s=>`
              <article class="manager-os-compact-card">
                <div class="manager-os-compact-top">
                  <div>
                    <h3>${escapeHtml(s.descricao || "Subtarefa")}</h3>
                    <p>Destino: ${escapeHtml(s.setor_destino || "-")} • Status: ${escapeHtml(s.status || "-")}</p>
                  </div>
                  <span class="manager-chip red">Sub</span>
                </div>
                <div class="manager-list-meta">
                  <span class="manager-chip">${escapeHtml(s.id_subtarefa || "-")}</span>
                  <span class="manager-chip">${escapeHtml(s.excluido_em || s.excluida_em || "-")}</span>
                </div>
                <div class="manager-os-compact-actions">
                  <button class="primary" data-restore-sub="${escapeHtml(s.id_subtarefa)}"><span class="material-symbols-outlined">restore</span>Recuperar</button>
                </div>
              </article>
            `).join("") : `<div class="empty">Nenhuma subtarefa excluída.</div>`}
          </div>
        </section>
      </section>
    `);

    document.querySelectorAll("[data-restore-os]").forEach(btn=>{
      btn.onclick = ()=>restoreManagerTrashItem("os", btn.dataset.restoreOs);
    });
    document.querySelectorAll("[data-restore-sub]").forEach(btn=>{
      btn.onclick = ()=>restoreManagerTrashItem("subtarefa", btn.dataset.restoreSub);
    });
  }catch(e){
    renderWithManagerHeader(`
      <section class="manager-subpage fade-in">
        <div class="empty">
          <b>Erro ao carregar lixeira.</b><br>
          <small>${escapeHtml(e?.message || "Falha inesperada.")}</small>
        </div>
        <button class="btn blue full" type="button" id="btnRetryTrash">Tentar novamente</button>
      </section>
    `);
    document.querySelector("#btnRetryTrash")?.addEventListener("click", ()=>renderManagerTrash());
  }
}

function restoreManagerTrashItem(tipo, id){
  const label = tipo === "os" ? "OS" : "subtarefa";
  modal({
    title:`Recuperar ${label}`,
    text:`Confirmar recuperação desta ${label}?`,
    actions:[
      {label:"Cancelar", className:"light"},
      {label:"Recuperar", className:"blue", close:false, onClick:async()=>{
        await apiPost({
          acao: tipo === "os" ? "recuperarOS" : "recuperarSubtarefa",
          id_os: tipo === "os" ? id : "",
          id_subtarefa: tipo === "subtarefa" ? id : "",
          operador_nome:currentUser().nome,
          matricula:currentUser().matricula,
          perfil:"Gestão"
        });
        closeModal();
        toast(`${label} recuperada`);
        renderManagerTrash();
      }}
    ]
  });
}


export async function renderManagerConfig(){
  if(!managerCan("configuracoes_gestao")) return managerBlockedMessage();
  setupManagerShell("config");

  const qrMode = getManagerQrMode();
  const themeMode = getManagerThemeMode();
  const prefs = getManagerPrefs();
  const params = getManagerParams();
  const layout = getManagerLayout();
  const factoryVariant = getFactoryVariant();

  renderWithManagerHeader(`
    <section class="manager-subpage fade-in">
      <div>
        <h1 class="manager-page-title">Configurações</h1>
        <p class="manager-page-subtitle">Ajustes do perfil de Gestão, aparência, dados, QR e operação.</p>
      </div>

      <div class="manager-config-summary">
        Tema: ${managerThemeLabel(themeMode)} • Fábrica: ${factoryVariantLabel(factoryVariant)} • Layout: ${managerLayoutLabel(layout)} • QR: ${managerQrLabel(qrMode)}
      </div>

      <div class="manager-config-stack">
        <div class="manager-config-group">
          <div class="manager-config-group-title">
            <h2>Desempenho</h2>
            <span>Dados e cache</span>
          </div>
          ${renderDataAccelerationPanel()}
        </div>

        <div class="manager-config-group">
          <div class="manager-config-group-title">
            <h2>Aparência</h2>
            <span>Tema e layout</span>
          </div>

          <section class="manager-setting-block">
            <h2>Tema</h2>
            <p>Escolha o tema visual usado no painel da Gestão.</p>
            <div class="manager-setting-options">
              ${[
                ["dark","dark_mode","Escuro","Menor brilho e bom contraste."],
                ["light","light_mode","Claro","Melhor para ambientes muito iluminados."],
                ["factory","precision_manufacturing","Chão de fábrica","Tema único industrial, alto contraste e foco operacional."],
                ["auto","contrast","Automático","Segue a preferência do dispositivo."]
              ].map(([value,icon,title,desc])=>`
                <label class="manager-setting-option">
                  <input type="radio" name="managerThemeMode" value="${value}" ${themeMode===value ? "checked" : ""}>
                  <span><b><span class="material-symbols-outlined">${icon}</span> ${title}</b><small>${desc}</small></span>
                </label>
              `).join("")}
            </div>
          </section>


          <section class="manager-setting-block">
            <h2>Variação do tema Chão de fábrica</h2>
            <p>Escolha a cor operacional principal do tema fábrica. A mudança afeta login, cards, botões, chips e indicadores.</p>
            <div class="factory-variant-options">
              ${[
                ["green","green","Verde industrial","Padrão operacional, foco em status e liberação."],
                ["amber","amber","Âmbar manutenção","Foco em atenção, manutenção e prioridade."],
                ["steel","steel","Aço azul","Visual técnico, limpo e mais frio."]
              ].map(([value,dot,title,desc])=>`
                <button type="button" class="factory-variant-card ${factoryVariant===value ? "active" : ""}" data-factory-variant="${value}">
                  <span class="factory-variant-dot ${dot}"></span>
                  <b>${title}</b>
                  <small>${desc}</small>
                </button>
              `).join("")}
            </div>
          </section>

          <section class="manager-setting-block">
            <h2>Layout do painel</h2>
            <p>Escolha como os cards e indicadores devem ser organizados.</p>
            <div class="manager-layout-options">
              ${[
                ["standard","Padrão","Equilíbrio entre leitura e quantidade de dados."],
                ["dense","Compacto","Mostra mais informações com menos espaçamento."],
                ["executive","Executivo","Visual mais limpo para acompanhamento rápido."],
                ["kpi","Foco em KPIs","Dá prioridade aos indicadores principais."]
              ].map(([value,title,desc])=>`
                <button type="button" class="manager-layout-card ${layout===value ? "active" : ""}" data-layout="${value}">
                  <b>${title}</b><small>${desc}</small>
                </button>
              `).join("")}
            </div>
          </section>
        </div>

        <div class="manager-config-group">
          <div class="manager-config-group-title">
            <h2>Operação</h2>
            <span>KPIs e parâmetros</span>
          </div>

          <section class="manager-setting-block">
            <h2>KPIs visíveis</h2>
            <p>Defina quais indicadores aparecem no painel inicial.</p>
            <div class="manager-setting-options">
              <label class="manager-kpi-option-row">
                <span><b>Mostrar subtarefas pendentes</b><small>Exibe gargalos por pendência intersetorial.</small></span>
                <span class="manager-switch"><input id="prefShowKpiSubtasks" type="checkbox" ${!prefs.hideKpiSubtasks ? "checked" : ""}><span></span></span>
              </label>
              <label class="manager-kpi-option-row">
                <span><b>Mostrar taxa de conclusão</b><small>Exibe percentual de avanço dos checklists.</small></span>
                <span class="manager-switch"><input id="prefShowKpiRate" type="checkbox" ${!prefs.hideKpiRate ? "checked" : ""}><span></span></span>
              </label>
              <label class="manager-kpi-option-row">
                <span><b>Mostrar eventos do dia</b><small>Exibe movimentações registradas no dia.</small></span>
                <span class="manager-switch"><input id="prefShowKpiEvents" type="checkbox" ${!prefs.hideKpiEvents ? "checked" : ""}><span></span></span>
              </label>
            </div>
          </section>

          <section class="manager-setting-block">
            <h2>Parâmetros operacionais</h2>
            <p>Ajustes locais para interpretação visual de alerta e prioridade.</p>
            <div class="manager-param-grid">
              <div class="manager-param-input">
                <label>Limite de atraso da OS em horas</label>
                <input id="paramDelayHours" type="number" min="1" value="${params.delayHours || 24}">
              </div>
              <div class="manager-param-input">
                <label>Meta mínima de conclusão (%)</label>
                <input id="paramTargetRate" type="number" min="0" max="100" value="${params.targetRate || 80}">
              </div>
              <div class="manager-param-input">
                <label>Máx. subtarefas por setor</label>
                <input id="paramMaxSubtasks" type="number" min="1" value="${params.maxSubtasks || 5}">
              </div>
              <div class="manager-param-input">
                <label>Atualização rápida</label>
                <select id="paramRefreshMode">
                  <option value="manual" ${params.refreshMode==="manual" ? "selected" : ""}>Manual</option>
                  <option value="balanced" ${params.refreshMode==="balanced" || !params.refreshMode ? "selected" : ""}>Equilibrada</option>
                  <option value="fast" ${params.refreshMode==="fast" ? "selected" : ""}>Rápida</option>
                </select>
              </div>
            </div>
            <div class="manager-config-actions" style="margin-top:12px">
              <button id="btnSaveManagerParams" class="btn blue full" type="button">Salvar parâmetros</button>
            </div>
          </section>

          <section class="manager-setting-block">
            <h2>Preferências do painel</h2>
            <p>Controle como a Gestão visualiza informações operacionais.</p>
            <div class="manager-setting-options">
              <label class="manager-toggle-row">
                <span><b>Visão compacta</b><small>Reduz espaçamentos para mostrar mais dados na tela.</small></span>
                <span class="manager-switch"><input id="prefCompactMode" type="checkbox" ${prefs.compactMode ? "checked" : ""}><span></span></span>
              </label>
              <label class="manager-toggle-row">
                <span><b>Ocultar alertas</b><small>Esconde alertas operacionais do dashboard.</small></span>
                <span class="manager-switch"><input id="prefHideAlerts" type="checkbox" ${prefs.hideAlerts ? "checked" : ""}><span></span></span>
              </label>
              <label class="manager-toggle-row">
                <span><b>Priorizar gargalos</b><small>Dá destaque visual para setores críticos.</small></span>
                <span class="manager-switch"><input id="prefPrioritizeBottlenecks" type="checkbox" ${prefs.prioritizeBottlenecks !== false ? "checked" : ""}><span></span></span>
              </label>
            </div>
          </section>
        </div>

        <div class="manager-config-group">
          <div class="manager-config-group-title">
            <h2>QR Code</h2>
            <span>Leitura operacional</span>
          </div>

          <section class="manager-setting-block">
            <h2>Modo de leitura QR</h2>
            <p>Defina como a Gestão deve interpretar o QR Code.</p>
            <div class="manager-setting-options">
              ${[
                ["auto","auto_mode","Automático","Detecta OS, subtarefa ou carrinho kit conforme o conteúdo."],
                ["os","assignment","Abrir OS","Prioriza leitura como ordem de serviço."],
                ["subtarefa","alt_route","Abrir subtarefa","Prioriza QR de subtarefas."],
                ["kit","qr_code_2","Carrinho Kit","Prioriza carrinho/kit vinculado à OS."]
              ].map(([value,icon,title,desc])=>`
                <label class="manager-setting-option">
                  <input type="radio" name="managerQrMode" value="${value}" ${qrMode===value ? "checked" : ""}>
                  <span><b><span class="material-symbols-outlined">${icon}</span> ${title}</b><small>${desc}</small></span>
                </label>
              `).join("")}
            </div>
            <div class="manager-config-actions" style="margin-top:12px">
              <button id="btnTestManagerQr" class="btn blue full" type="button">Testar leitura QR</button>
            </div>
          </section>
        </div>

        <div class="manager-config-group">
          <div class="manager-config-group-title">
            <h2>Sessão</h2>
            <span>Conta</span>
          </div>

          <section class="manager-danger-zone">
            <h2>Sair da conta</h2>
            <p>Encerra a sessão atual e retorna para a tela de login.</p>
            <button id="btnManagerLogout" class="manager-logout-btn" type="button">
              <span class="material-symbols-outlined">logout</span>
              Sair da conta
            </button>
          </section>
        </div>
      </div>
    </section>
  `);

  bindDataAccelerationPanel(renderManagerConfig);

  document.querySelectorAll('input[name="managerThemeMode"]').forEach(input=>{
    input.addEventListener("change", ()=>{
      applyManagerThemeMode(input.value);
      toast("Tema atualizado");
      renderManagerConfig();
    });
  });

  document.querySelectorAll("[data-factory-variant]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setFactoryVariant(btn.dataset.factoryVariant);
      toast("Variação do tema atualizada");
      renderManagerConfig();
    });
  });

  document.querySelectorAll("[data-layout]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setManagerLayout(btn.dataset.layout);
      toast("Layout atualizado");
      renderManagerConfig();
    });
  });

  document.querySelectorAll('input[name="managerQrMode"]').forEach(input=>{
    input.addEventListener("change", ()=>{
      setManagerQrMode(input.value);
      toast("Modo QR atualizado");
      renderManagerConfig();
    });
  });

  document.querySelector("#prefShowKpiSubtasks")?.addEventListener("change", e=>setManagerPref("hideKpiSubtasks", !e.target.checked));
  document.querySelector("#prefShowKpiRate")?.addEventListener("change", e=>setManagerPref("hideKpiRate", !e.target.checked));
  document.querySelector("#prefShowKpiEvents")?.addEventListener("change", e=>setManagerPref("hideKpiEvents", !e.target.checked));
  document.querySelector("#prefCompactMode")?.addEventListener("change", e=>setManagerPref("compactMode", e.target.checked));
  document.querySelector("#prefHideAlerts")?.addEventListener("change", e=>setManagerPref("hideAlerts", e.target.checked));
  document.querySelector("#prefPrioritizeBottlenecks")?.addEventListener("change", e=>setManagerPref("prioritizeBottlenecks", e.target.checked));

  document.querySelector("#btnSaveManagerParams")?.addEventListener("click", ()=>{
    setManagerParams({
      delayHours:Number(document.querySelector("#paramDelayHours")?.value || 24),
      targetRate:Number(document.querySelector("#paramTargetRate")?.value || 80),
      maxSubtasks:Number(document.querySelector("#paramMaxSubtasks")?.value || 5),
      refreshMode:document.querySelector("#paramRefreshMode")?.value || "balanced"
    });
    toast("Parâmetros salvos");
    renderManagerConfig();
  });

  document.querySelector("#btnTestManagerQr")?.addEventListener("click", ()=>{
    localStorage.setItem("natan_qr_context", "gestao");
    localStorage.setItem("natan_qr_mode", getManagerQrMode());
    openQrScreen();
  });

  document.querySelector("#btnManagerLogout")?.addEventListener("click", ()=>{
    logout();
  });
}

async function loadManagerRequests(){
  const u = currentUser();
  const list = document.querySelector("#managerRequestList");
  try{
    const rows = await apiGet("listarMinhasSolicitacoes", {matricula:u.matricula, __force:true});
    list.innerHTML = rows.length ? rows.map(r=>`
      <article class="manager-request-item">
        <b>${r.titulo}</b>
        <small>${r.tipo} • ${r.status} • ${r.criado_em || ""}<br>${r.descricao || ""}</small>
      </article>
    `).join("") : `<div class="empty">Nenhuma solicitação enviada ainda.</div>`;
  }catch(e){
    list.innerHTML = `<div class="empty">Erro ao carregar solicitações.</div>`;
  }
}
