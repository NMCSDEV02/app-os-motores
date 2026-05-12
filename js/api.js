import { getCached, setCached, clearApiCache as clearSmartCache } from "./core/cacheManager.js";
import { Store, KEYS } from "./storage.js";
import { toast } from "./ui.js";

const INFLIGHT_GET = new Map();
const API_TIMEOUT_MS = 22000;

export const API_URL = "https://script.google.com/macros/s/AKfycbyJejT7lpm86dz6zdzlU8d34I71nkD0oyy7CcXixbb-0JaKAp_q_gs6GD4DQ9yfAyfWzQ/exec";

function stableParams(params = {}){
  const clean = {};
  Object.keys(params || {}).sort().forEach(k=>{
    if(k.startsWith("__")) return;
    const v = params[k];
    if(v !== undefined && v !== null) clean[k] = v;
  });
  return clean;
}

function requestKey(acao, params = {}){
  return `${acao}:${JSON.stringify(stableParams(params))}`;
}

async function rawFetch(url, options = {}){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), options.timeout || API_TIMEOUT_MS);

  try{
    const res = await fetch(url, {
      ...options,
      signal:controller.signal,
      headers:{
        "Content-Type":"text/plain;charset=utf-8",
        ...(options.headers || {})
      }
    });

    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const txt = await res.text();
    let data;
    try{ data = txt ? JSON.parse(txt) : null; }
    catch(e){ throw new Error("Resposta inválida da API"); }

    if(data && data.sucesso === false) throw new Error(data.erro || "Ação não concluída");
    if(data && data.erro) throw new Error(data.erro);

    return data;
  }finally{
    clearTimeout(timer);
  }
}

function invalidateByPost(payload = {}){
  const a = String(payload.acao || "");

  if(
    /OS|Subtarefa|Checklist|Item|Modelo|Setor|Fluxo|Permissoes|permissoes|Kit|Notificacao|Solicitacao/i.test(a)
  ){
    clearSmartCache();
    window.dispatchEvent(new Event("natan-cache-invalidated"));
    return;
  }

  clearSmartCache();
}

export async function apiGet(acao, params = {}){
  const force = params && params.__force === true;
  const cleanParams = stableParams(params);
  const key = requestKey(acao, cleanParams);
  const qs = new URLSearchParams({acao, ...cleanParams});
  const cached = !force ? getCached(acao, cleanParams) : null;

  if(cached && !cached.stale){
    return cached.data;
  }

  if(!force && INFLIGHT_GET.has(key)){
    return INFLIGHT_GET.get(key);
  }

  const promise = rawFetch(`${API_URL}?${qs.toString()}`)
    .then(data=>{
      setCached(acao, cleanParams, data);
      return data;
    })
    .catch(err=>{
      if(cached){
        console.warn("API falhou; usando cache", acao, err);
        return cached.data;
      }
      throw err;
    })
    .finally(()=>INFLIGHT_GET.delete(key));

  INFLIGHT_GET.set(key, promise);
  return promise;
}

export async function apiPost(payload){
  try{
    const data = await rawFetch(API_URL, {
      method:"POST",
      body:JSON.stringify(payload || {})
    });
    invalidateByPost(payload);
    return data;
  }catch(err){
    if(!navigator.onLine){
      Store.push(KEYS.outbox, {...payload, offline_em:new Date().toISOString()});
      window.dispatchEvent(new Event("natan-sync-change"));
      toast("Sem conexão: ação salva para sincronizar");
      return {sucesso:true, offline:true};
    }
    throw err;
  }
}

export async function cacheGet(acao, params = {}){
  const data = await apiGet(acao, params);
  const cache = Store.get(KEYS.cache, {});
  const key = requestKey(acao, params);
  cache[key] = data;
  Store.set(KEYS.cache, cache);
  return data;
}

export async function syncOutbox(){
  const outbox = Store.get(KEYS.outbox, []);
  if(!navigator.onLine || outbox.length === 0) return;

  const pending = [];
  for(const item of outbox){
    try{
      await rawFetch(API_URL, {method:"POST", body:JSON.stringify(item)});
    }catch{
      pending.push(item);
    }
  }

  Store.set(KEYS.outbox, pending);
  window.dispatchEvent(new Event("natan-sync-change"));
  if(outbox.length !== pending.length){
    clearSmartCache();
    toast("Ações offline sincronizadas");
  }
}

export function clearApiCache(){
  INFLIGHT_GET.clear();
  clearSmartCache();
}

export async function apiGetFast(acao, params = {}, onFresh = null){
  const cleanParams = stableParams(params);
  const cached = getCached(acao, cleanParams);

  if(cached){
    if((cached.stale || params.__force) && navigator.onLine){
      apiGet(acao, {...cleanParams, __force:true})
        .then(fresh=>{
          if(typeof onFresh === "function") onFresh(fresh);
        })
        .catch(()=>{});
    }
    return cached.data;
  }

  const fresh = await apiGet(acao, cleanParams);
  if(typeof onFresh === "function") onFresh(fresh);
  return fresh;
}

export function clearApiSmartCache(){
  clearApiCache();
}
