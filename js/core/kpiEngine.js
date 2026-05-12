export function kpiHealthLabel(score){
  const s = Number(score || 0);
  if(s >= 85) return "Excelente";
  if(s >= 70) return "Estável";
  if(s >= 50) return "Atenção";
  return "Crítico";
}

export function kpiColor(score){
  const s = Number(score || 0);
  if(s >= 85) return "green";
  if(s >= 70) return "blue";
  if(s >= 50) return "yellow";
  return "red";
}

export function fmtKpiPct(v){
  return `${Math.max(0, Math.min(100, Math.round(Number(v || 0))))}%`;
}
