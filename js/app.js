import { routeByProfile } from "./auth.js";
import { renderHome, renderHistory, renderSettings } from "./operator.js";
import { openQrScreen } from "./qr.js";
import { syncOutbox } from "./api.js";

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

window.addEventListener("online", syncOutbox);

document.addEventListener("click", (e)=>{
  const nav = e.target.closest("[data-nav]");
  if(!nav) return;
  const target = nav.dataset.nav;
  if(target==="home") renderHome();
  if(target==="history") renderHistory();
  if(target==="settings") renderSettings();
});

document.addEventListener("DOMContentLoaded", ()=>{
  const qrBtn = document.querySelector("#btnQrTop");
  const searchBtn = document.querySelector("#btnSearch");
  if(qrBtn) qrBtn.onclick = openQrScreen;
  if(searchBtn) searchBtn.onclick = () => document.querySelector("#searchOS")?.focus();
  routeByProfile();
});
