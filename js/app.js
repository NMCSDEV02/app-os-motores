import { initMobileThemeButton } from "./core/mobileThemeButton.js";
import { initSidebarForce } from "./core/sidebarForce.js";
import { updateGlobalSyncBadge } from "./core/syncPanel.js";
import { applyTheme } from "./core/theme.js";
import { initFactoryThemeGuard } from "./core/factoryThemeGuard.js";
import { routeByProfile } from "./auth.js";
import { renderHome, renderHistory, renderSettings } from "./operator.js";
import { openQrScreen } from "./qr.js";
import { syncOutbox } from "./api.js";

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

window.addEventListener("online", async()=>{ await syncOutbox(); updateGlobalSyncBadge(); });
window.addEventListener("offline", updateGlobalSyncBadge);

document.addEventListener("click", (e)=>{
  const nav = e.target.closest("[data-nav]");
  if(!nav) return;
  const target = nav.dataset.nav;
  if(target==="home") renderHome();
  if(target==="history") renderHistory();
  if(target==="settings") renderSettings();
});

document.addEventListener("DOMContentLoaded", ()=>{
  applyTheme(localStorage.getItem("natan_theme") || "light");
  initSidebarForce();
  initMobileThemeButton();
  initFactoryThemeGuard();
  updateGlobalSyncBadge();
  const qrBtn = document.querySelector("#btnQrTop");
  const searchBtn = document.querySelector("#btnSearch");
  if(qrBtn) qrBtn.onclick = openQrScreen;
  if(searchBtn) searchBtn.onclick = () => document.querySelector("#searchOS")?.focus();
  routeByProfile();
});
