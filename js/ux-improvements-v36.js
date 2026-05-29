// UX V3.6 - melhorias leves de acessibilidade e clareza sem alterar a API.

const uxEnhanced = new WeakSet();

function uxTextOf(el){
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function uxActivateOnKeyboard(el){
  if(uxEnhanced.has(el)) return;
  uxEnhanced.add(el);
  el.addEventListener("keydown", event => {
    if(event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    el.click();
  });
}

function uxEnhanceClickableCards(root = document){
  root.querySelectorAll(".os-card[data-open-os], .check-item[data-item]").forEach(el => {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", uxTextOf(el) || "Abrir item");
    uxActivateOnKeyboard(el);
  });
}

function uxEnhanceDetailsButton(root = document){
  root.querySelectorAll("#btnDetails").forEach(btn => {
    const box = document.querySelector("#detailBox");
    if(!box) return;
    btn.setAttribute("aria-controls", "detailBox");
    btn.setAttribute("aria-expanded", box.classList.contains("open") ? "true" : "false");
    btn.textContent = box.classList.contains("open") ? "Ocultar detalhes" : "Ver detalhes";
    if(uxEnhanced.has(btn)) return;
    uxEnhanced.add(btn);
    btn.addEventListener("click", () => {
      window.requestAnimationFrame(() => {
        const open = box.classList.contains("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "Ocultar detalhes" : "Ver detalhes";
      });
    });
  });
}

function uxEnhanceFloatingSubtask(root = document){
  root.querySelectorAll(".fab-sub").forEach(btn => {
    btn.setAttribute("aria-label", "Criar subtarefa");
    btn.setAttribute("title", "Criar subtarefa");
  });
}

function uxEnhanceToast(){
  const toast = document.querySelector("#toast");
  if(!toast) return;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
}

function uxEnhanceModal(root = document){
  root.querySelectorAll(".modal-card, .dialog-card, .sheet-modal").forEach(modal => {
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    if(uxEnhanced.has(modal)) return;
    uxEnhanced.add(modal);
    window.requestAnimationFrame(() => {
      const first = modal.querySelector("input, select, textarea, button");
      if(first && document.activeElement === document.body) first.focus({preventScroll:true});
    });
  });
}

function uxEnhanceIconButtons(root = document){
  root.querySelectorAll("button").forEach(btn => {
    if(btn.getAttribute("aria-label")) return;
    const title = btn.getAttribute("title");
    if(title) btn.setAttribute("aria-label", title);
  });
}

function uxEnhance(root = document){
  uxEnhanceToast();
  uxEnhanceClickableCards(root);
  uxEnhanceDetailsButton(root);
  uxEnhanceFloatingSubtask(root);
  uxEnhanceModal(root);
  uxEnhanceIconButtons(root);
}

const uxObserver = new MutationObserver(records => {
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType === Node.ELEMENT_NODE) uxEnhance(node);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  uxEnhance();
  uxObserver.observe(document.body, {childList:true, subtree:true});
});

uxEnhance();
