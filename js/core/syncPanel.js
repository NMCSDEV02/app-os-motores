import { Store, KEYS } from "../storage.js";
import { syncOutbox } from "../api.js";

export function getPendingSyncCount(){
  return Store.get(KEYS.outbox, []).length;
}

export function updateGlobalSyncBadge(){
  const badge = document.querySelector("#syncBadge");
  if(!badge) return;

  const pending = getPendingSyncCount();

  if(!navigator.onLine){
    badge.dataset.status = "offline";
    badge.textContent = pending ? `Offline • ${pending} pend.` : "Offline";
    return;
  }

  if(pending > 0){
    badge.dataset.status = "syncing";
    badge.textContent = `${pending} pendente(s)`;
    return;
  }

  badge.dataset.status = "online";
  badge.textContent = "Sincronizado";
}

export function openSyncPanel(){
  closeSyncPanel();

  const pending = getPendingSyncCount();
  const html = `
    <section id="syncPanel" class="sync-panel open">
      <h3>Sincronização</h3>
      <p>Status: <b>${navigator.onLine ? "Online" : "Offline"}</b><br>
      Ações pendentes: <b>${pending}</b></p>
      <div class="sync-panel-actions">
        <button id="btnForceSync" class="btn blue compact">Sincronizar</button>
        <button id="btnCloseSyncPanel" class="btn light compact">Fechar</button>
      </div>
    </section>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  document.querySelector("#btnCloseSyncPanel").onclick = closeSyncPanel;
  document.querySelector("#btnForceSync").onclick = async ()=>{
    await syncOutbox();
    updateGlobalSyncBadge();
    closeSyncPanel();
  };
}

export function closeSyncPanel(){
  document.querySelector("#syncPanel")?.remove();
}
