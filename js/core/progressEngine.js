export function normalizeProgress(prog = {}){
  const total = Number(prog.total_itens ?? prog.total_total ?? prog.total ?? 0);
  const done = Number(prog.total_concluidos ?? prog.concluidos_total ?? prog.done ?? 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total_itens: total,
    total_concluidos: done,
    checklist_total: Number(prog.checklist_total ?? 0),
    checklist_concluidos: Number(prog.checklist_concluidos ?? 0),
    subtarefas_total: Number(prog.subtarefas_total ?? 0),
    subtarefas_concluidas: Number(prog.subtarefas_concluidas ?? 0),
    subtarefas_pendentes: Number(prog.subtarefas_pendentes ?? 0),
    percentual_total: Math.max(0, Math.min(100, Number(prog.percentual_total ?? percent)))
  };
}

export function progressState(prog = {}, status = ""){
  const p = normalizeProgress(prog);
  const st = String(status || "").toLowerCase();

  if(st.includes("conclu") || p.percentual_total >= 100) return "concluido";
  if(p.subtarefas_pendentes > 0) return "bloqueado";
  if(p.percentual_total > 0 && p.percentual_total < 50) return "atencao";
  return "em-processo";
}

export function progressHtml(label, prog = {}, color = ""){
  const p = normalizeProgress(prog);
  return `
    <div class="smart-progress ${color}" data-progress="${p.percentual_total}">
      <span style="width:${p.percentual_total}%"></span>
    </div>
    <div class="progress-meta">
      <span>${label}</span>
      <span>${p.total_concluidos}/${p.total_itens} • ${p.percentual_total}%</span>
    </div>
  `;
}

export function markProgressUpdating(root = document){
  root.querySelectorAll(".progress,.smart-progress").forEach(el=>el.classList.add("is-updating"));
}

export function unmarkProgressUpdating(root = document){
  root.querySelectorAll(".progress,.smart-progress").forEach(el=>el.classList.remove("is-updating"));
}

export function pulseProgress(root = document){
  root.querySelectorAll(".progress,.smart-progress").forEach(el=>{
    el.classList.remove("progress-pulse");
    void el.offsetWidth;
    el.classList.add("progress-pulse");
  });
}
