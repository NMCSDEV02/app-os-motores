import { toggleTheme } from "./theme.js";

export function initMobileThemeButton(){
  function ensure(){
    const isDesktop = document.body.classList.contains("desktop-mode");
    let btn = document.querySelector("#mobileThemeFloating");

    if(isDesktop){
      if(btn) btn.remove();
      return;
    }

    const userLogged = !!localStorage.getItem("operador_matricula");
    if(!userLogged){
      if(btn) btn.remove();
      return;
    }

    if(!btn){
      btn = document.createElement("button");
      btn.id = "mobileThemeFloating";
      btn.className = "mobile-theme-floating";
      btn.type = "button";
      btn.title = "Alternar tema";
      btn.innerHTML = `<span class="material-symbols-outlined">contrast</span>`;
      document.body.appendChild(btn);
    }
  }

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("#mobileThemeFloating");
    if(!btn) return;
    e.preventDefault();
    toggleTheme();
  }, true);

  const obs = new MutationObserver(ensure);
  obs.observe(document.body, {childList:true, subtree:true});

  window.addEventListener("resize", ensure);
  setTimeout(ensure, 50);
  setTimeout(ensure, 400);
}
