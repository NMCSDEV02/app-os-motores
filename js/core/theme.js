function applyFactoryVariant(){
  const variant = localStorage.getItem("natan_factory_variant") || "green";
  document.body.classList.remove("factory-variant-green","factory-variant-amber","factory-variant-steel");
  document.documentElement.classList.remove("factory-variant-green","factory-variant-amber","factory-variant-steel");

  const cls = `factory-variant-${variant}`;
  document.body.classList.add(cls);
  document.documentElement.classList.add(cls);
}

export function applyTheme(theme){
  const saved = localStorage.getItem("natan_theme");
  const selected = ["light","dark","factory"].includes(theme || saved) ? (theme || saved) : "light";

  document.body.classList.remove("theme-light","theme-dark","theme-factory");
  document.documentElement.classList.remove("theme-light","theme-dark","theme-factory");
  document.body.classList.add(`theme-${selected}`);
  document.documentElement.classList.add(`theme-${selected}`);
  document.documentElement.dataset.theme = selected;
  localStorage.setItem("natan_theme", selected);
  applyFactoryVariant();

  updateThemeButtons(selected);
  window.dispatchEvent(new Event("natan-theme-applied"));
}

export function toggleTheme(){
  const current = localStorage.getItem("natan_theme") || "light";
  const next = current === "light" ? "dark" : current === "dark" ? "factory" : "light";
  applyTheme(next);
  return next;
}

export function updateThemeButtons(theme){
  const label = theme === "dark" ? "Fábrica" : theme === "factory" ? "Claro" : "Tema";
  document.querySelectorAll("#btnThemeToggle,.theme-toggle").forEach(btn=>{
    btn.textContent = label;
    btn.title = theme === "dark" ? "Mudar para tema chão de fábrica" : theme === "factory" ? "Mudar para tema claro" : "Mudar tema";
  });
}
