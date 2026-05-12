export function initSidebarForce(){
  let ticking = false;

  const icons = {
    inicio:"dashboard",
    dashboard:"dashboard",
    usuarios:"groups",
    setores:"lan",
    fluxos:"account_tree",
    modelos:"checklist",
    models:"checklist",
    kits:"qr_code_2",
    notificacoes:"notifications",
      aprovacoes:"approval",
    historico:"history",
    lixeira:"delete",
    sistema:"settings",
    settings:"settings"
  };

  function getKey(btn){
    return btn.dataset.adminDesktop || btn.dataset.adminPage || "";
  }

  function ensureButton(){
    const sidebar = document.querySelector(".admin-sidebar");
    if(!sidebar) return;

    let head = sidebar.querySelector(".admin-sidebar-head");
    if(!head){
      head = document.createElement("div");
      head.className = "admin-sidebar-head";
      sidebar.insertBefore(head, sidebar.firstChild);
    }

    let btn = sidebar.querySelector("#btnSidebarToggle");
    if(!btn){
      btn = document.createElement("button");
      btn.id = "btnSidebarToggle";
      btn.className = "admin-sidebar-toggle";
      btn.type = "button";
      btn.title = "Minimizar menu";
      btn.innerHTML = `<span class="material-symbols-outlined">menu_open</span>`;
      head.appendChild(btn);
    }

    const icon = btn.querySelector(".material-symbols-outlined");
    if(icon){
      icon.textContent = document.body.classList.contains("sidebar-collapsed") ? "menu" : "menu_open";
    }
  }

  function ensureIcons(){
    const buttons = document.querySelectorAll(".admin-menu button");

    buttons.forEach(btn=>{
      const key = getKey(btn);
      const icon = icons[key] || "radio_button_unchecked";
      const label = btn.dataset.label || btn.textContent.trim() || btn.title || "Menu";

      btn.dataset.icon = icon;
      btn.dataset.label = label;
      if(!btn.title) btn.title = label;

      const currentIcon = btn.querySelector(".nav-icon");
      const currentLabel = btn.querySelector(".nav-label");

      // Idempotente: se já existe e está correto, não reescreve o DOM.
      if(currentIcon && currentLabel && currentIcon.textContent === icon && currentLabel.textContent === label){
        return;
      }

      btn.replaceChildren();

      const iconSpan = document.createElement("span");
      iconSpan.className = "material-symbols-outlined nav-icon";
      iconSpan.textContent = icon;

      const labelSpan = document.createElement("span");
      labelSpan.className = "nav-label";
      labelSpan.textContent = label;

      btn.appendChild(iconSpan);
      btn.appendChild(labelSpan);
    });
  }

  function apply(){
    if(!document.body.classList.contains("desktop-mode")){
      document.body.classList.remove("sidebar-collapsed");
      return;
    }

    const collapsed = localStorage.getItem("natan_admin_sidebar") === "collapsed";
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    ensureButton();
  }

  function setup(){
    if(ticking) return;
    ticking = true;

    requestAnimationFrame(()=>{
      ticking = false;

      if(!document.body.classList.contains("desktop-mode")) return;
      ensureButton();
      ensureIcons();
      apply();
    });
  }

  function toggle(){
    const collapsed = document.body.classList.contains("sidebar-collapsed");
    localStorage.setItem("natan_admin_sidebar", collapsed ? "expanded" : "collapsed");
    document.body.classList.toggle("sidebar-collapsed", !collapsed);
    ensureButton();
  }

  document.addEventListener("click", (event)=>{
    const btn = event.target.closest("#btnSidebarToggle,.admin-sidebar-toggle");
    if(!btn) return;

    event.preventDefault();
    event.stopPropagation();
    toggle();
  }, true);

  const obs = new MutationObserver(()=>{
    setup();
  });

  obs.observe(document.body, {childList:true, subtree:true});

  window.addEventListener("storage", apply);
  window.addEventListener("resize", setup);

  setup();
}
