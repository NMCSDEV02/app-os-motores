import { toggleTheme } from "../core/theme.js";

export function adminDesktopShell({ title="Painel Administrador", subtitle="Console de configuração do sistema", content="" } = {}){
  document.body.classList.add("desktop-mode");

  return `
    <section class="admin-desktop-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">Projeto Natan</div>
        <div class="admin-brand-sub">Console industrial V3</div>

        <nav class="admin-menu">
          <button class="active" data-admin-page="dashboard">Dashboard</button>
          <button data-admin-page="users">Usuários e permissões</button>
          <button data-admin-page="sectors">Setores e áreas</button>
          <button data-admin-page="flows">Fluxos</button>
          <button data-admin-page="models">Modelos checklist</button>
          <button data-admin-page="approvals">Aprovações</button>
          <button data-admin-page="audit">Auditoria completa</button>
          <button data-admin-page="trash">Lixeira</button>
          <button data-admin-page="settings">Sistema</button>
        </nav>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <div>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="admin-top-actions">
            <button id="btnThemeToggle" class="theme-toggle" type="button">Tema</button>
            <button id="btnAdminLogoutTop" class="btn red compact" type="button">Sair</button>
          </div>
        </header>

        ${content}
      </main>
    </section>
  `;
}

export function bindAdminDesktopShell({ logout, onNavigate } = {}){
  const theme = document.querySelector("#btnThemeToggle");
  if(theme) theme.onclick = () => toggleTheme();

  const out = document.querySelector("#btnAdminLogoutTop");
  if(out && logout) out.onclick = logout;

  document.querySelectorAll("[data-admin-page]").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("[data-admin-page]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if(onNavigate) onNavigate(btn.dataset.adminPage);
    };
  });
}
