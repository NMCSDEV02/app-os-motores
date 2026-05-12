export function resolveLayout(profile){
  if(profile === "Admin"){
    return "desktop";
  }

  return "mobile";
}