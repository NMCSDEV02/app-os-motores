import { apiGet, apiPost } from "./api.js";
import { Store, KEYS } from "./storage.js";
import { screen, setHeader, setBottomNav, toast } from "./ui.js";
import { renderHome } from "./operator.js";
import { renderManager } from "./manager.js";
import { renderAdmin } from "./admin.js";

export function currentUser(){ return Store.get(KEYS.operator, null); }
export function logout(){ Store.del(KEYS.operator); location.reload(); }

export function renderLogin(){
  setHeader(null,false); setBottomNav(null,false);
  screen().innerHTML = `
    <div class="login-box">
      <div class="login-card">
        <div class="login-brand">OS Motores</div>
        <p class="page-subtitle">Acesse com sua matrícula para carregar seu perfil de trabalho.</p>
        <input id="loginMatricula" class="input" placeholder="Matrícula" autocomplete="off" />
        <button id="btnLogin" class="btn blue full" style="margin-top:10px">Entrar</button>
        <button id="btnCadastro" class="btn light full" style="margin-top:8px">Primeiro acesso</button>
      </div>
    </div>`;
  document.querySelector("#btnLogin").onclick = login;
  document.querySelector("#btnCadastro").onclick = renderCadastro;
}

async function login(){
  const matricula = document.querySelector("#loginMatricula").value.trim();
  if(!matricula) return toast("Informe a matrícula");
  try{
    const user = await apiGet("login", {matricula});
    if(!user || user.erro) return toast("Matrícula não encontrada");
    if(String(user.ativo).toLowerCase()==="false") return toast("Usuário bloqueado");
    Store.set(KEYS.operator, user);
    routeByProfile();
  }catch(e){ toast("Erro no login. Verifique a API."); }
}

function renderCadastro(){
  screen().innerHTML = `
    <div class="login-box">
      <div class="login-card">
        <div class="login-brand">Cadastro</div>
        <p class="page-subtitle">Crie um acesso de operador. Gestão/Admin são liberados pelo administrador.</p>
        <input id="cadNome" class="input" placeholder="Nome completo" />
        <select id="cadSetor" class="select" style="margin-top:8px">
          <option>Desmontagem</option><option>Montagem</option><option>Elétrica</option><option>Usinagem</option><option>Produção</option><option>Almoxarifado</option>
        </select>
        <button id="btnSalvarCad" class="btn blue full" style="margin-top:10px">Salvar cadastro</button>
        <button id="btnVoltarLogin" class="btn light full" style="margin-top:8px">Voltar</button>
      </div>
    </div>`;
  document.querySelector("#btnVoltarLogin").onclick = renderLogin;
  document.querySelector("#btnSalvarCad").onclick = async ()=>{
    const nome = document.querySelector("#cadNome").value.trim();
    const setor = document.querySelector("#cadSetor").value;
    if(!nome) return toast("Informe o nome");
    try{
      const r = await apiPost({acao:"cadastrarOperador", nome, setor});
      toast(`Matrícula criada: ${r.matricula}`);
      Store.set(KEYS.operator, {nome, matricula:r.matricula, setor, perfil:"Operador", ativo:true});
      routeByProfile();
    }catch(e){ toast(e.message); }
  };
}

export function routeByProfile(){
  const u = currentUser();
  if(!u) return renderLogin();
  const p = String(u.perfil||"Operador").toLowerCase();
  if(p === "admin") return renderAdmin();
  if(p === "gestao" || p === "gestor") return renderManager();
  return renderHome();
}
