import { apiGet } from "./api.js";
import { currentUser } from "./auth.js";
import { screen, setHeader, setBottomNav, toast } from "./ui.js";
import { openOS, renderHome } from "./operator.js";
import { renderManager } from "./manager.js";
import { renderAdmin } from "./admin.js";

let stream = null;
let timer = null;
let origem = "home";

export function openQrScreen(from = "auto"){
  const u = currentUser();
  origem = from || "auto";
  setHeader(u, false);
  setBottomNav(u, false);

  screen().innerHTML = `<div class="qr-screen qr-screen-native">
    <div class="qr-title-block">
      <h1>Lendo QR Code</h1>
      <p>Aponte para o QR Code da OS, subtarefa, kit ou setor.</p>
    </div>
    <button id="btnStartQR" class="qr-camera-btn" type="button">Ativar câmera</button>
    <div class="qr-view" id="qrView"><span>Câmera aguardando ativação</span></div>
    <p class="qr-hint">A leitura fecha automaticamente em 30 segundos.</p>
    <button id="btnCloseQR" class="qr-close-bottom" aria-label="Fechar leitor">×</button>
  </div>`;

  document.querySelector("#btnCloseQR").onclick = () => closeQR(true);
  document.querySelector("#btnStartQR").onclick = startQR;
  timer = setTimeout(() => closeQR(true), 30000);
}

async function startQR(){
  const view = document.querySelector("#qrView");
  try{
    if(!navigator.mediaDevices?.getUserMedia){
      return toast("Leitor indisponível neste navegador.");
    }
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    const video = document.createElement("video");
    video.setAttribute("playsinline", true);
    video.srcObject = stream;
    await video.play();
    view.innerHTML = "";
    view.appendChild(video);
    scanLoop(video);
  }catch(e){
    toast("Câmera indisponível. Use HTTPS, localhost ou autorize a câmera.");
  }
}

function scanLoop(video){
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const loop = async ()=>{
    if(!stream) return;
    if(video.readyState === video.HAVE_ENOUGH_DATA){
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const image = ctx.getImageData(0,0,canvas.width,canvas.height);
      const code = window.jsQR ? window.jsQR(image.data, image.width, image.height) : null;
      if(code && code.data){ await handleQR(code.data); return; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function handleQR(data){
  try{
    const u = currentUser();
    const res = await apiGet("resolverQR", {valor:data, setor:u?.setor || ""});
    closeQR(false);
    if(res.tipo === "OS" || res.tipo === "Subtarefa") openOS(res.os);
    else toast(res.mensagem || "QR lido");
  }catch(e){
    toast("QR não reconhecido");
  }
}

export function closeQR(goBack=true){
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream=null;
  }
  if(timer) clearTimeout(timer);
  timer = null;
  if(goBack) voltarParaOrigem();
}

function voltarParaOrigem(){
  const u = currentUser();
  const perfil = String(u?.perfil || "Operador").toLowerCase();
  if(perfil === "admin") return renderAdmin("inicio");
  if(perfil === "gestao" || perfil === "gestor") return renderManager();
  return renderHome();
}
