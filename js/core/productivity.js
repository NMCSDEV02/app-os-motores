export function calcProductivityScore(data = {}){
  const k = data.kpi || {};
  const total = Number(k.itens_total || 0);
  const done = Number(k.itens_concluidos || 0);
  const osAbertas = Number(k.os_abertas || 0);
  const subs = Number(k.sub_pendentes || 0);

  const progresso = total > 0 ? (done / total) * 100 : 0;
  const penalidadeFila = Math.min(24, osAbertas * 3);
  const penalidadeSub = Math.min(18, subs * 4);

  return Math.max(0, Math.min(100, Math.round(progresso + 20 - penalidadeFila - penalidadeSub)));
}

export function productivityLevel(score){
  if(score >= 85) return "Excelente";
  if(score >= 70) return "Boa";
  if(score >= 50) return "Atenção";
  return "Crítica";
}

export function formatDurationMin(min){
  const m = Math.max(0, Math.round(Number(min || 0)));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if(h > 0) return `${h}h ${mm}min`;
  return `${mm}min`;
}

export function safeArray(v){
  return Array.isArray(v) ? v : [];
}
