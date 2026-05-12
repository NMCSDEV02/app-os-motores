import { apiGet, clearApiSmartCache } from "../api.js";
import { currentUser } from "../auth.js";
import { toast } from "../ui.js";

export function getAccelMode(){
  return localStorage.getItem("natan_data_accel_mode") || "balanced";
}

export function setAccelMode(mode){
  localStorage.setItem("natan_data_accel_mode", mode || "balanced");
}

export function getAccelStatus(){
  try{
    return JSON.parse(localStorage.getItem("natan_data_accel_status") || "{}");
  }catch(e){
    return {};
  }
}

function setAccelStatus(status){
  localStorage.setItem("natan_data_accel_status", JSON.stringify(status || {}));
}

function perfilKey(user){
  const p = String(user?.perfil || "Operador").toLowerCase();
  if(p === "admin") return "admin";
  if(p === "gestao" || p === "gestor") return "gestao";
  return "operador";
}

function warmupPlan(user){
  const perfil = perfilKey(user);
  const matricula = user?.matricula || "";
  const setor = user?.setor || "";

  if(perfil === "admin"){
    return [
      ["dashboardLean", {matricula}],
      ["kpiDashboardAvancado", {matricula}],
      ["adminLogs", {}],
      ["adminListarOperadores", {}],
      ["listarNotificacoes", {destino:"Admin"}],
      ["listarKitsQR", {}]
    ];
  }

  if(perfil === "gestao"){
    return [
      ["gestorResumo", {matricula}],
      ["produtividadeResumo", {matricula}],
      ["kpiDashboardAvancado", {matricula}],
      ["listarMinhasSolicitacoes", {matricula}],
      ["listarNotificacoes", {destino:"Gestão"}]
    ];
  }

  return [
    ["listarOS", {setor, matricula}],
    ["listarHistorico", {matricula, perfil:user?.perfil || "Operador"}],
    ["gestorResumo", {matricula}]
  ];
}

export async function optimizeDataReceiving(){
  const user = currentUser();
  const perfil = perfilKey(user);
  const mode = getAccelMode();

  clearApiSmartCache();

  const plan = warmupPlan(user);
  const started = Date.now();
  let ok = 0;
  let fail = 0;

  for(const [acao, params] of plan){
    try{
      await apiGet(acao, {...params, __force:true});
      ok++;
    }catch(e){
      fail++;
    }
  }

  const status = {
    perfil,
    mode,
    ok,
    fail,
    total:plan.length,
    duration_ms:Date.now() - started,
    updated_at:new Date().toISOString()
  };

  setAccelStatus(status);
  window.dispatchEvent(new Event("natan-data-accel-change"));

  toast(`Dados otimizados: ${ok}/${plan.length}`);
  return status;
}

export function clearDataAcceleration(){
  clearApiSmartCache();
  setAccelStatus({
    perfil:perfilKey(currentUser()),
    mode:getAccelMode(),
    ok:0,
    fail:0,
    total:0,
    duration_ms:0,
    updated_at:new Date().toISOString(),
    cleared:true
  });
  window.dispatchEvent(new Event("natan-data-accel-change"));
  toast("Cache limpo");
}

export function renderDataAccelerationPanel({compact=false} = {}){
  const status = getAccelStatus();
  const mode = getAccelMode();
  const last = status.updated_at ? new Date(status.updated_at).toLocaleString("pt-BR") : "Ainda não otimizado";
  const result = status.total ? `${status.ok || 0}/${status.total || 0} fontes carregadas` : "Sem pré-carregamento recente";

  return `
    <section class="data-accel-card">
      <div class="data-accel-badge">
        <span class="material-symbols-outlined">bolt</span>
        Aceleração de dados
      </div>

      <h2>Otimizar recebimento dos dados</h2>
      <p>Pré-carrega os dados principais do seu perfil e ajusta o cache para abrir telas mais rápido sem sobrecarregar a planilha.</p>

      <div class="data-accel-status">
        <b>Status: ${result}</b>
        <small>Última otimização: ${last}</small>
      </div>

      <div class="data-accel-options">
        ${[
          ["balanced","Equilibrado","Mais seguro para uso diário."],
          ["fast","Rápido","Mais cache e menos chamadas."],
          ["max","Máximo","Carregamento mais agressivo."]
        ].map(([value,title,desc])=>`
          <label class="data-accel-option ${mode===value ? "active" : ""}">
            <input type="radio" name="dataAccelMode" value="${value}" ${mode===value ? "checked" : ""}>
            <b>${title}</b>
            <small>${desc}</small>
          </label>
        `).join("")}
      </div>

      <div class="data-accel-actions">
        <button id="btnOptimizeDataReceiving" class="btn blue full" type="button">Otimizar agora</button>
        <button id="btnClearDataCache" class="btn light full" type="button">Limpar cache</button>
      </div>
    </section>
  `;
}

export function bindDataAccelerationPanel(afterChange=null){
  document.querySelectorAll('input[name="dataAccelMode"]').forEach(input=>{
    input.addEventListener("change", ()=>{
      setAccelMode(input.value);
      toast("Modo de aceleração atualizado");
      if(typeof afterChange === "function") afterChange();
    });
  });

  document.querySelector("#btnOptimizeDataReceiving")?.addEventListener("click", async()=>{
    const btn = document.querySelector("#btnOptimizeDataReceiving");
    if(btn){
      btn.disabled = true;
      btn.textContent = "Otimizando...";
    }

    try{
      await optimizeDataReceiving();
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = "Otimizar agora";
      }
      if(typeof afterChange === "function") afterChange();
    }
  });

  document.querySelector("#btnClearDataCache")?.addEventListener("click", ()=>{
    clearDataAcceleration();
    if(typeof afterChange === "function") afterChange();
  });
}
