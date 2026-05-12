window.addEventListener("offline",()=>{
  document.body.classList.add("is-offline");
});

window.addEventListener("online",()=>{
  document.body.classList.remove("is-offline");
});