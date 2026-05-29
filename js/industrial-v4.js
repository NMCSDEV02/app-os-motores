// Industrial V4 - profile and screen markers for the redesign layer.

const industrialV4State = {
  lastProfile: "",
  lastView: ""
};

function industrialV4ApplyRoot(){
  document.documentElement.classList.add("industrial-v4");
  document.body.classList.add("industrial-v4");
}

function industrialV4DetectProfile(){
  if(document.querySelector(".login-box")) return "auth";
  if(document.body.classList.contains("desktop-mode") || document.querySelector(".admin-desktop-shell")) return "admin";
  if(document.body.classList.contains("manager-mode") || document.querySelector(".manager-op-header")) return "manager";
  return "operator";
}

function industrialV4DetectView(){
  if(document.querySelector(".login-box")) return "login";
  if(document.querySelector(".os-focus-top")) return "operator-os";
  if(document.querySelector("#osList")) return "operator-home";
  if(document.querySelector(".operator-history-list")) return "operator-history";
  if(document.querySelector(".operator-config-stack")) return "operator-config";
  if(document.querySelector(".manager-exec-home")) return "manager-home";
  if(document.querySelector(".manager-operations-grid")) return "manager-operations";
  if(document.querySelector(".admin-desktop-shell")) return "admin-desktop";
  if(document.querySelector(".admin-shell")) return "admin-mobile";
  return "screen";
}

function industrialV4MarkScreen(){
  const profile = industrialV4DetectProfile();
  const view = industrialV4DetectView();
  const screen = document.querySelector("#screen");

  document.body.dataset.industrialProfile = profile;
  document.body.dataset.industrialView = view;
  if(screen){
    screen.dataset.industrialProfile = profile;
    screen.dataset.industrialView = view;
  }

  if(profile !== industrialV4State.lastProfile || view !== industrialV4State.lastView){
    industrialV4State.lastProfile = profile;
    industrialV4State.lastView = view;
  }
}

function industrialV4EnhanceButtons(root = document){
  root.querySelectorAll("button[title]").forEach(button => {
    if(!button.getAttribute("aria-label")){
      button.setAttribute("aria-label", button.getAttribute("title"));
    }
  });
}

function industrialV4EnhanceInputs(root = document){
  root.querySelectorAll("input, select, textarea").forEach(input => {
    input.setAttribute("autocomplete", input.getAttribute("autocomplete") || "off");
  });
}

function industrialV4Enhance(root = document){
  industrialV4ApplyRoot();
  industrialV4MarkScreen();
  industrialV4EnhanceButtons(root);
  industrialV4EnhanceInputs(root);
}

const industrialV4Observer = new MutationObserver(records => {
  industrialV4MarkScreen();
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType === Node.ELEMENT_NODE) industrialV4Enhance(node);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  industrialV4Enhance();
  industrialV4Observer.observe(document.body, {childList:true, subtree:true});
});

industrialV4Enhance();
