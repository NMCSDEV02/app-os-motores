let observer = null;
let scheduled = false;

function isFactory(){
  return document.body.classList.contains("theme-factory") ||
    document.documentElement.classList.contains("theme-factory");
}

function isLightColor(color){
  if(!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return false;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
  if(!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if(a < 0.65) return false;
  return r > 225 && g > 225 && b > 225;
}

function looksLikeSurface(el){
  if(!(el instanceof HTMLElement)) return false;
  if(el === document.body || el === document.documentElement) return false;

  const tag = el.tagName.toLowerCase();
  if(["svg","path","script","style","link","meta","br"].includes(tag)) return false;

  const cls = el.className ? String(el.className) : "";
  const role = el.getAttribute("role") || "";

  if(/card|item|row|panel|box|modal|dialog|sheet|kpi|metric|history|historico|timeline|activity|event|log|notify|notification|ranking|empty|section|table|sidebar|header|nav|tab|drawer|list/i.test(cls)) return true;
  if(["dialog","listitem","article"].includes(role)) return true;
  if(["article","section","aside","header","nav"].includes(tag)) return true;

  const cs = getComputedStyle(el);
  const radius = parseFloat(cs.borderRadius || "0");
  const border = parseFloat(cs.borderTopWidth || "0") + parseFloat(cs.borderBottomWidth || "0");
  const shadow = cs.boxShadow && cs.boxShadow !== "none";
  const rect = el.getBoundingClientRect();

  return rect.width > 120 && rect.height > 36 && (radius >= 10 || border > 0 || shadow);
}

function shouldSkip(el){
  if(!(el instanceof HTMLElement)) return true;
  if(el.closest("svg")) return true;
  if(el.classList.contains("floor-theme-skip")) return true;
  const tag = el.tagName.toLowerCase();
  return ["input","select","textarea","button"].includes(tag);
}

function forceSurface(el){
  if(shouldSkip(el)) return;
  if(!looksLikeSurface(el)) return;

  const cs = getComputedStyle(el);
  if(!isLightColor(cs.backgroundColor)) return;

  el.classList.add("floor-forced-surface");
  el.style.background = "linear-gradient(180deg,var(--floor-surface-2),var(--floor-surface))";
  el.style.backgroundColor = "var(--floor-surface)";
  el.style.borderColor = "var(--floor-line)";
  el.style.color = "var(--floor-text)";
}

function fixText(el){
  if(!(el instanceof HTMLElement)) return;
  const tag = el.tagName.toLowerCase();
  if(!["h1","h2","h3","h4","h5","h6","b","strong","p","small","span","label"].includes(tag)) return;

  const cs = getComputedStyle(el);
  if(isLightColor(cs.color)){
    el.classList.add(tag === "p" || tag === "small" || tag === "span" || tag === "label" ? "floor-forced-muted" : "floor-forced-text");
  }
}

export function runFactoryThemeGuard(){
  if(!isFactory()) return;

  const roots = [
    document.querySelector("#screen"),
    document.querySelector(".screen"),
    document.querySelector(".admin-main"),
    document.querySelector(".manager-screen"),
    document.querySelector(".modal-card"),
    document.body
  ].filter(Boolean);

  const seen = new Set();

  roots.forEach(root=>{
    if(seen.has(root)) return;
    seen.add(root);

    root.querySelectorAll("*").forEach(el=>{
      forceSurface(el);
      fixText(el);
    });
  });
}

function scheduleGuard(){
  if(scheduled) return;
  scheduled = true;
  requestAnimationFrame(()=>{
    scheduled = false;
    runFactoryThemeGuard();
  });
}

export function initFactoryThemeGuard(){
  if(observer) return;

  runFactoryThemeGuard();

  observer = new MutationObserver(()=>{
    if(isFactory()) scheduleGuard();
  });

  observer.observe(document.body, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class","style"]
  });

  window.addEventListener("natan-theme-applied", scheduleGuard);
  window.addEventListener("resize", scheduleGuard);
  window.addEventListener("load", scheduleGuard);
}
