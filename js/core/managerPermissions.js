import { apiGet, apiPost } from "../api.js";

export const MANAGER_PERMISSION_DEFAULTS = {
  os_visualizar: true,
  os_editar: true,
  os_excluir: true,
  os_republicar: true,
  os_checklist: true,

  subtarefas_visualizar: true,
  subtarefas_criar: true,
  subtarefas_editar: true,
  subtarefas_excluir: true,
  subtarefas_repetir: true,
  subtarefas_modelo: true,
  subtarefas_concluir: true,

  qr_ler: true,
  equipe_visualizar: true,
  solicitacoes_admin: true,
  lixeira_acessar: true,
  configuracoes_gestao: true,
  modelos_usar: true
};

const STORAGE_KEY = "natan_manager_permissions_v1";
let lastSync = 0;

export function getManagerPermissions(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {...MANAGER_PERMISSION_DEFAULTS, ...parsed};
  }catch{
    return {...MANAGER_PERMISSION_DEFAULTS};
  }
}

export function setManagerPermissions(perms){
  const current = getManagerPermissions();
  const next = {...current, ...(perms || {})};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("natan-manager-permissions-updated", {detail:next}));
  return next;
}

export async function syncManagerPermissionsFromApi(force = false){
  if(!force && Date.now() - lastSync < 30000) return getManagerPermissions();
  lastSync = Date.now();

  try{
    const res = await apiGet("adminPermissoesGestao", {__force:force});
    if(res && res.permissoes && typeof res.permissoes === "object"){
      return setManagerPermissions(res.permissoes);
    }
  }catch(e){
    console.warn("Permissões da Gestão: usando cache local", e);
  }

  return getManagerPermissions();
}

export async function saveManagerPermissions(perms, user = {}){
  const next = setManagerPermissions(perms);
  try{
    await apiPost({
      acao:"adminSalvarPermissoesGestao",
      permissoes:next,
      operador_nome:user.nome || "Admin",
      matricula:user.matricula || ""
    });
  }catch(e){
    console.warn("Permissões salvas localmente; API não confirmou", e);
  }
  return next;
}

export function managerCan(permission){
  const perms = getManagerPermissions();
  return perms[permission] !== false;
}

export function managerPermissionLabel(key){
  const labels = {
    os_visualizar:"Visualizar OS",
    os_editar:"Editar OS",
    os_excluir:"Excluir OS",
    os_republicar:"Republicar OS",
    os_checklist:"Aplicar checklist em OS",

    subtarefas_visualizar:"Visualizar subtarefas",
    subtarefas_criar:"Criar subtarefas",
    subtarefas_editar:"Editar subtarefas",
    subtarefas_excluir:"Excluir subtarefas",
    subtarefas_repetir:"Repetir subtarefa",
    subtarefas_modelo:"Usar modelo em subtarefa",
    subtarefas_concluir:"Concluir/Reabrir subtarefa",

    qr_ler:"Ler QR Code",
    equipe_visualizar:"Visualizar equipe",
    solicitacoes_admin:"Solicitar ao Admin",
    lixeira_acessar:"Acessar lixeira",
    configuracoes_gestao:"Configurações da Gestão",
    modelos_usar:"Usar modelos liberados"
  };
  return labels[key] || key;
}

export function managerPermissionGroup(key){
  if(key.startsWith("os_")) return "Ordens de Serviço";
  if(key.startsWith("subtarefas_")) return "Subtarefas";
  if(["qr_ler","equipe_visualizar","solicitacoes_admin","lixeira_acessar","configuracoes_gestao","modelos_usar"].includes(key)) return "Sistema da Gestão";
  return "Outros";
}
