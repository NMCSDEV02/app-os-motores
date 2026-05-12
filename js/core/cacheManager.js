const DEFAULT_TTL = 20000;

const TTL_BY_ACTION = {
  bootstrapApp: 12000,
  dashboardLean: 12000,
  kpiDashboardAvancado: 18000,
  gestorResumo: 12000,
  produtividadeResumo: 15000,
  adminLogs: 12000,
  adminListarOperadores: 30000,
  listarSetores: 60000,
  listarFluxos: 60000,
  listarModelosAtivos: 60000,
  listarKitsQR: 20000,
  listarNotificacoes: 10000,
  auditoriaFiltrada: 15000,
  listarConfigSistema: 30000,
  listarPermissoes: 30000,
  adminDesktopResumo: 15000,
  adminPermissoesGestao: 30000,
  gestorLixeira: 12000,
  gestorTodasSubtarefas: 12000
};

const mem = new Map();

function keyOf(acao, params = {}){
  return `${acao}:${JSON.stringify(params || {})}`;
}

function getStore(){
  try{return JSON.parse(localStorage.getItem("natan_api_cache_v3") || "{}")}
  catch{return {}}
}

function pruneStore(cache){
  const entries = Object.entries(cache || {});
  if(entries.length <= 80) return cache;
  return Object.fromEntries(
    entries
      .sort((a,b)=>(b[1]?.time || 0) - (a[1]?.time || 0))
      .slice(0,80)
  );
}

function setStore(cache){
  try{localStorage.setItem("natan_api_cache_v3", JSON.stringify(pruneStore(cache)))}
  catch{}
}

function perfMultiplier(){
  const mode = localStorage.getItem("natan_data_accel_mode") || "balanced";
  if(mode === "fast") return 3;
  if(mode === "max") return 6;
  return 1;
}

export function getTTL(acao){
  return (TTL_BY_ACTION[acao] ?? DEFAULT_TTL) * perfMultiplier();
}

export function getCacheProfile(){
  const mode = localStorage.getItem("natan_data_accel_mode") || "balanced";
  const map = {
    balanced:"Equilibrado",
    fast:"Rápido",
    max:"Máximo"
  };
  return map[mode] || "Equilibrado";
}

export function getCached(acao, params = {}){
  const key = keyOf(acao, params);
  const now = Date.now();

  const hit = mem.get(key);
  if(hit){
    return {...hit, key, stale:(now - hit.time) > getTTL(acao)};
  }

  const store = getStore();
  const saved = store[key];
  if(saved){
    mem.set(key, saved);
    return {...saved, key, stale:(now - saved.time) > getTTL(acao)};
  }

  return null;
}

export function setCached(acao, params = {}, data){
  const key = keyOf(acao, params);
  const entry = {
    data,
    time:Date.now(),
    cached_at:new Date().toISOString()
  };
  mem.set(key, entry);

  const store = getStore();
  store[key] = entry;
  setStore(store);
  return entry;
}

export function clearApiCache(prefix = ""){
  mem.clear();
  if(!prefix){
    localStorage.removeItem("natan_api_cache_v3");
    return;
  }

  const store = getStore();
  Object.keys(store).forEach(k=>{
    if(k.startsWith(prefix)) delete store[k];
  });
  setStore(store);
}

export function cacheAgeText(entry){
  if(!entry?.time) return "";
  const sec = Math.round((Date.now() - entry.time) / 1000);
  if(sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  return `${min}min`;
}
