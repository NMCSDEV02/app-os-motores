function safeArray(v){ return Array.isArray(v) ? v : []; }

function healthLabel(score){
  const s = Number(score || 0);
  if(s >= 85) return "Excelente";
  if(s >= 70) return "Estável";
  if(s >= 50) return "Atenção";
  return "Crítico";
}

function rowItem(row, idx, label="pendências"){
  return `
    <div class="gestao-op-row">
      <div class="gestao-op-row-index">${idx + 1}</div>
      <div>
        <b>${row.nome || row.setor || "Sem dados"}</b>
        <small>${row.setor || row.acao || label}</small>
      </div>
      <div class="gestao-op-row-value">${row.total || 0}</div>
    </div>
  `;
}

export function managerMobileShell({ nome="Gestão", setor="Operação", kpi={}, produtividade={}, dashboard={} } = {}){
  const adv = dashboard.kpis || {};
  const score = Number(adv.score_operacional ?? produtividade.score ?? 0);
  const setores = safeArray(dashboard.setores || produtividade.gargalos_setor).slice(0,5);
  const operadores = safeArray(dashboard.operadores || produtividade.ranking_operadores).slice(0,5);
  const alertas = safeArray(dashboard.alertas || produtividade.alertas).slice(0,3);

  const osAbertas = adv.os_abertas ?? kpi.os_abertas ?? 0;
  const atrasadas = adv.os_atrasadas ?? 0;
  const subtarefas = adv.subtarefas_pendentes ?? kpi.sub_pendentes ?? 0;
  const taxa = Math.round(adv.taxa_conclusao ?? 0);
  const eventos = adv.eventos_hoje ?? 0;
  const gargalo = adv.gargalo_principal || adv.setor_critico || "-";

  return `
    <section class="manager-mobile-shell fade-in">
      <div class="gestao-op-hero">
        <div class="gestao-op-hero-top">
          <div>
            <small>${setor}</small>
            <h1>Painel de Gestão</h1>
            <p>Controle rápido da fila, gargalos, subtarefas e prioridades do chão de fábrica.</p>
          </div>
          <div class="gestao-op-score">
            <div>
              <b>${score}</b>
              <small>${healthLabel(score)}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="gestao-op-actions">
        <button class="gestao-op-action" data-manager-action="os">
          <span class="material-symbols-outlined">assignment</span>
          <b>Ver OS abertas</b>
        </button>
        <button class="gestao-op-action" data-manager-action="subtasks">
          <span class="material-symbols-outlined">alt_route</span>
          <b>Subtarefas</b>
        </button>
        <button class="gestao-op-action" data-manager-action="operators">
          <span class="material-symbols-outlined">groups</span>
          <b>Operadores</b>
        </button>
        <button class="gestao-op-action" data-manager-action="requests">
          <span class="material-symbols-outlined">send</span>
          <b>Solicitar ao Admin</b>
        </button>
      </div>

      <div class="gestao-op-kpi-grid">
        <div class="gestao-op-kpi" data-kpi="os">
          <small>OS abertas</small>
          <strong>${osAbertas}</strong>
          <span>${atrasadas} atrasada(s)</span>
        </div>
        <div class="gestao-op-kpi" data-kpi="subtasks">
          <small>Subtarefas pendentes</small>
          <strong>${subtarefas}</strong>
          <span>Gargalo: ${gargalo}</span>
        </div>
        <div class="gestao-op-kpi" data-kpi="rate">
          <small>Taxa de conclusão</small>
          <strong>${taxa}%</strong>
          <span>${adv.itens_concluidos ?? 0}/${adv.itens_total ?? 0} itens</span>
        </div>
        <div class="gestao-op-kpi" data-kpi="events">
          <small>Eventos hoje</small>
          <strong>${eventos}</strong>
          <span>Movimentações registradas</span>
        </div>
      </div>

      ${alertas.length ? alertas.map(a=>`<div class="gestao-op-alert">${a}</div>`).join("") : ""}

      <section class="gestao-op-section">
        <div class="gestao-op-section-head">
          <div>
            <h2>Prioridade operacional</h2>
            <small>Setores com maior acúmulo de pendências</small>
          </div>
          <span class="gestao-op-mini-status">${gargalo}</span>
        </div>
        <div class="gestao-op-priority">
          ${setores.length ? setores.map((s,i)=>rowItem({nome:s.setor,setor:"Pendências abertas",total:s.total},i)).join("") : `<div class="empty small-empty">Nenhum gargalo crítico agora.</div>`}
        </div>
      </section>

      <section class="gestao-op-section">
        <div class="gestao-op-section-head">
          <div>
            <h2>Operadores em destaque</h2>
            <small>Mais ações registradas no histórico</small>
          </div>
        </div>
        <div class="gestao-op-priority">
          ${operadores.length ? operadores.map((o,i)=>rowItem({nome:o.nome,setor:o.setor || "Operação",total:o.total},i,"ações")).join("") : `<div class="empty small-empty">Sem dados suficientes para ranking.</div>`}
        </div>
      </section>

      <section class="gestao-op-section">
        <div class="gestao-op-section-head">
          <div>
            <h2>Fluxo operacional</h2>
            <small>Resumo da fila em execução</small>
          </div>
        </div>
        <div class="manager-flow-card">
          <b>Fila atual</b>
          <small>${osAbertas} OS aberta(s), ${subtarefas} subtarefa(s), ${atrasadas} atraso(s).</small>
          <div class="manager-flow-line"><span style="width:${Math.min(100, Math.max(8, score))}%"></span></div>
        </div>
      </section>
    </section>
  `;
}
