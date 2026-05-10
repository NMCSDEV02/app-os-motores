export const Store = {
  get(key, fallback=null){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } },
  set(key, value){ localStorage.setItem(key, JSON.stringify(value)) },
  del(key){ localStorage.removeItem(key) },
  push(key, value){ const arr = this.get(key, []); arr.push(value); this.set(key, arr) }
};
export const KEYS = { operator:"os_operador_v5", cache:"os_cache_v5", outbox:"os_outbox_v5" };
