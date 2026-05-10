import { Store, KEYS } from "./storage.js";
import { toast } from "./ui.js";

export const API_URL = "https://script.google.com/macros/s/AKfycbyJejT7lpm86dz6zdzlU8d34I71nkD0oyy7CcXixbb-0JaKAp_q_gs6GD4DQ9yfAyfWzQ/exec";

async function rawFetch(url, options={}){
  const res = await fetch(url, options);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function apiGet(acao, params={}){
  const qs = new URLSearchParams({acao, ...params});
  try{
    const data = await rawFetch(`${API_URL}?${qs.toString()}`);
    return data;
  }catch(err){
    const cache = Store.get(KEYS.cache, {});
    const key = `${acao}:${JSON.stringify(params)}`;
    if(cache[key]) return cache[key];
    throw err;
  }
}

export async function apiPost(payload){
  try{
    const data = await rawFetch(API_URL, {method:"POST", body:JSON.stringify(payload)});
    if(data && data.sucesso === false) throw new Error(data.erro || "Ação não concluída");
    return data;
  }catch(err){
    if(!navigator.onLine){
      Store.push(KEYS.outbox, {...payload, offline_em:new Date().toISOString()});
      toast("Sem conexão: ação salva para sincronizar");
      return {sucesso:true, offline:true};
    }
    throw err;
  }
}

export async function cacheGet(acao, params={}){
  const data = await apiGet(acao, params);
  const cache = Store.get(KEYS.cache, {});
  const key = `${acao}:${JSON.stringify(params)}`;
  cache[key] = data;
  Store.set(KEYS.cache, cache);
  return data;
}

export async function syncOutbox(){
  const outbox = Store.get(KEYS.outbox, []);
  if(!navigator.onLine || outbox.length===0) return;
  const pending = [];
  for(const item of outbox){
    try{ await rawFetch(API_URL, {method:"POST", body:JSON.stringify(item)}); }
    catch{ pending.push(item); }
  }
  Store.set(KEYS.outbox, pending);
  if(outbox.length !== pending.length) toast("Ações offline sincronizadas");
}
