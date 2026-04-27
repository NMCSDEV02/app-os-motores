// app.js reorganizado
/*********************************
 * 1. CONFIGURAÇÕES GERAIS
 *********************************/
const API_URL = "https://script.google.com/macros/s/AKfycbwdaLtm46YWzWEKF2V6fn7T0jNGrCKOQlSDkkv1_-nGdOl9KQCDxxGczPxPsc8KXB6bgg/exec";
const OPERADOR_KEY = "operador_logado";
const SETORES = ["Desmontagem", "Montagem", "Usinagem", "Produção", "Elétrica"];

let progressoGestaoCache = [];
let osSelecionada = null;
let intervaloAutoAtualizacao = null;
let telaAtual = "home";
let osAtualId = null;

/*********************************
// * 2. UTILITÁRIOS
 *********************************/
function operadorEhGestao() {
  const operador = obterOperador();
  return operador && String(operador.perfil || "").toLowerCase() === "gestao";
}
function formatarTempoDecorrido(dataString) {
  if (!dataString) return "Criada agora";

  const data = new Date(dataString);
  const agora = new Date();

  if (Number.isNaN(data.getTime())) return "Criada recentemente";

  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMin < 1) return "Criada agora";
  if (diffMin < 60) return `Criada há ${diffMin} min`;
  if (diffHoras < 24) return `Criada há ${diffHoras}h`;
  return `Criada há ${diffDias} dia(s)`;
}

function gerarOptionsSetores(setorAtual = "", incluirAtual = false) {
  return SETORES
    .filter((setor) => incluirAtual || setor !== setorAtual)
    .map((setor) => `<option value="${setor}">${setor}</option>`)
    .join("");
}
let selectModalCallback = null;
let selectModalValorAtual = "";

function abrirSelectModal({ titulo, opcoes, valorAtual, onSelect }) {
  const modal = document.getElementById("select-modal");
  const tituloEl = document.getElementById("select-modal-titulo");
  const opcoesEl = document.getElementById("select-modal-opcoes");

  if (!modal || !tituloEl || !opcoesEl) return;

  tituloEl.textContent = titulo || "Selecionar";
  opcoesEl.innerHTML = "";
  selectModalCallback = onSelect;
  selectModalValorAtual = valorAtual || "";

  opcoes.forEach((opcao) => {
    const btn = document.createElement("button");
    btn.className = "select-opcao" + (opcao === valorAtual ? " ativo" : "");
    btn.textContent = opcao;
    btn.onclick = () => {
      if (selectModalCallback) {
        selectModalCallback(opcao);
      }
      fecharSelectModal();
    };
    opcoesEl.appendChild(btn);
  });

  modal.classList.remove("oculto");
}

function fecharSelectModal() {
  const modal = document.getElementById("select-modal");
  if (modal) modal.classList.add("oculto");
}
function ativarSelectCustomizado({
  hiddenId,
  buttonId,
  titulo,
  opcoes,
  valorInicial,
}) {
  const hidden = getById(hiddenId);
  const button = getById(buttonId);

  if (!hidden || !button) return;

  const valorValido = opcoes.includes(valorInicial) ? valorInicial : (opcoes[0] || "");
  hidden.value = valorValido;
  button.textContent = valorValido || "Selecionar";

  button.onclick = () => {
    abrirSelectModal({
      titulo,
      opcoes,
      valorAtual: hidden.value,
      onSelect: (valor) => {
        hidden.value = valor;
        button.textContent = valor;
      },
    });
  };
}
function getById(id) {
  return document.getElementById(id);
}

function getMain() {
  return document.querySelector("main");
}

//*********************************
// * 3. SESSÃO E OPERADOR
// *********************************/
function obterOperador() {
  const operador = localStorage.getItem(OPERADOR_KEY);
  return operador ? JSON.parse(operador) : null;
}

function salvarOperador(operador) {
  localStorage.setItem(OPERADOR_KEY, JSON.stringify(operador));
}

function limparOperador() {
  localStorage.removeItem(OPERADOR_KEY);
}

function fazerLogout() {
  const operador = obterOperador();

  if (operador?.matricula) {
    salvarOperador({ matricula: operador.matricula });
  } else {
    limparOperador();
  }

  pararAutoAtualizacao();
  location.reload();
}

///**********************************
// * 4. CONTROLE VISUAL GLOBAL
//***********************************

function mostrarHeaderHome() {
  const header = getById("header-home");
  if (header) header.style.display = "block";
}

function esconderHeaderHome() {
  const header = getById("header-home");
  if (header) header.style.display = "none";
}

function mostrarBotaoNovaOS() {
  const btn = getById("btn-nova-os");
  if (!btn) return;

  if (operadorEhGestao() && telaAtual === "home") {
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
}

function esconderBotaoNovaOS() {
  const btn = getById("btn-nova-os");
  if (!btn) return;
  btn.style.display = "none";
}

function abrirTabDetalhe(tab) {
  const tabChecklist = getById("tab-checklist");
  const tabSubtarefas = getById("tab-subtarefas");
  const btnChecklist = getById("tab-checklist-btn");
  const btnSubtarefas = getById("tab-subtarefas-btn");

  if (!tabChecklist || !tabSubtarefas || !btnChecklist || !btnSubtarefas) return;

  if (tab === "checklist") {
    tabChecklist.style.display = "block";
    tabSubtarefas.style.display = "none";
    btnChecklist.classList.add("ativo");
    btnSubtarefas.classList.remove("ativo");
  } else {
    tabChecklist.style.display = "none";
    tabSubtarefas.style.display = "block";
    btnChecklist.classList.remove("ativo");
    btnSubtarefas.classList.add("ativo");
  }
}

function abrirTabGestao(tab) {
  const tabs = {
    relatorios: getById("tab-relatorios"),
    insights: getById("tab-insights"),
    progresso: getById("tab-progresso"),
  };

  const botoes = {
    relatorios: getById("btn-tab-relatorios"),
    insights: getById("btn-tab-insights"),
    progresso: getById("btn-tab-progresso"),
  };

  Object.values(tabs).forEach((el) => {
    if (el) el.style.display = "none";
  });

  Object.values(botoes).forEach((el) => {
    if (el) el.classList.remove("ativo");
  });

  if (tabs[tab]) tabs[tab].style.display = "block";
  if (botoes[tab]) botoes[tab].classList.add("ativo");
}

//**********************************
//** * 5. AUTOATUALIZAÇÃO
//** *********************************/
function pararAutoAtualizacao() {
  if (intervaloAutoAtualizacao) {
    clearInterval(intervaloAutoAtualizacao);
    intervaloAutoAtualizacao = null;
  }
}

function iniciarAutoAtualizacao() {
  pararAutoAtualizacao();

  intervaloAutoAtualizacao = setInterval(async () => {
    try {
      if (telaAtual === "home") {
        await renderizarOS(false);
      }

      if (telaAtual === "detalhe-os" && osAtualId) {
        await recarregarDetalheOSSilencioso();
      }

      if (telaAtual === "gestao") {
        await carregarResumoGestao(false);
        await carregarListaOSGestao(false);
        await carregarOSExcluidas(false);
        await carregarProgressoGestao(false);
      }
    } catch (erro) {
      console.error("Erro auto atualização:", erro);
    }
  }, 5000);
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    if (telaAtual === "home") renderizarOS(false);
    if (telaAtual === "detalhe-os" && osAtualId) recarregarDetalheOSSilencioso();
    if (telaAtual === "gestao") {
      carregarResumoGestao(false);
      carregarListaOSGestao(false);
      carregarOSExcluidas(false);
      carregarProgressoGestao(false);
    }
  }
});

async function recarregarDetalheOSSilencioso() {
  if (!osAtualId) return;

  try {
    const res = await fetch(`${API_URL}?acao=listarOSPorId&id_os=${osAtualId}`);
    const osAtualizada = await res.json();

    if (!osAtualizada) return;

    osSelecionada = {
      ...osAtualizada,
      modo_subtarefa: osSelecionada?.modo_subtarefa || false,
      tem_subtarefa_setor: osSelecionada?.tem_subtarefa_setor || false,
    };

    await Promise.all([
      carregarChecklist(false),
      carregarSubtarefas(false),
      atualizarBarraProgresso(),
    ]);
  } catch (erro) {
    console.error("Erro ao recarregar detalhe da OS:", erro);
  }
}

//*********************************
// * 6. FLUXO INICIAL
// *********************************/
function renderizarHome() {
  telaAtual = "home";
  osAtualId = null;

  mostrarHeaderHome();
  renderizarOperador();
  renderizarOS(true);
  mostrarBotaoNovaOS();
}

function voltarHome() {
  telaAtual = "home";
  osAtualId = null;
  osSelecionada = null;

  mostrarHeaderHome();

  getMain().innerHTML = `
    <section class="bloco conteudo">
      <p id="setor-aviso" class="setor-aviso"></p>
      <div id="lista-os"></div>
    </section>
  `;

  mostrarBotaoNovaOS();
  renderizarOS(true);
  iniciarAutoAtualizacao();
}

function abrirBoot() {
  const operador = obterOperador();

  if (!operador) {
    abrirCadastroOperador();
    return;
  }

  if (operador.matricula && !operador.nome) {
    abrirLoginMatricula();
    return;
  }

  if (String(operador.perfil || "").trim().toLowerCase() === "gestao") {
    abrirPainelGestao();
    return;
  }

  renderizarHome();
  iniciarAutoAtualizacao();
}

//***********************************
// * 7. CADASTRO E LOGIN
//** *********************************/
function abrirCadastroOperador() {
  esconderBotaoNovaOS();
  esconderHeaderHome();
  pararAutoAtualizacao();

  getMain().innerHTML = `
    <section class="bloco conteudo">
      <h2>Cadastro do operador</h2>

      <div class="form-card">
        <div class="campo">
          <label>Nome</label>
          <input id="cad-nome" type="text" placeholder="Digite seu nome">
        </div>

        <div class="campo">
          <label>Setor</label>
          <input type="hidden" id="cad-setor" value="${SETORES[0]}">
          <button type="button" id="cad-setor-btn" class="campo-select-falso">
            ${SETORES[0]}
          </button>
        </div>

        <p class="setor-aviso">A matrícula será gerada automaticamente ao salvar o cadastro.</p>

        <button onclick="salvarCadastroOperador()" class="btn-principal">Salvar cadastro</button>
      </div>
    </section>
  `;

  ativarSelectCustomizado({
    hiddenId: "cad-setor",
    buttonId: "cad-setor-btn",
    titulo: "Selecionar setor",
    opcoes: SETORES,
    valorInicial: SETORES[0],
  });
}

async function salvarCadastroOperador() {
  const nome = getById("cad-nome")?.value.trim();
  const setor = getById("cad-setor")?.value;

  if (!nome) {
    alert("Preencha o nome.");
    return;
  }

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "cadastrarOperador",
        nome,
        setor,
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao cadastrar operador.");
      return;
    }

    const matricula = resultado.matricula;

    salvarOperador({
      nome,
      matricula,
      setor,
      perfil: "Operador",
    });

    alert(
      `Cadastro realizado com sucesso!\n\nSua matrícula é: ${matricula}\n\nGuarde essa matrícula.\nCaso o login automático não aconteça, use ela para acessar o app.`
    );

    location.reload();
  } catch (erro) {
    console.error("Erro ao cadastrar operador:", erro);
    alert("Erro ao cadastrar operador.");
  }
}

function abrirLoginMatricula() {
  esconderBotaoNovaOS();
  esconderHeaderHome();
  pararAutoAtualizacao();

  getMain().innerHTML = `
    <section class="bloco conteudo">
      <h2>Login por matrícula</h2>

      <div class="form-card">
        <div class="campo">
          <label>Matrícula</label>
          <input id="login-matricula" type="text" placeholder="Digite sua matrícula">
        </div>

        <button onclick="fazerLoginMatricula()" class="btn-principal">Entrar</button>
      </div>
    </section>
  `;
}

async function fazerLoginMatricula() {
  const matricula = getById("login-matricula")?.value.trim();

  if (!matricula) {
    alert("Digite a matrícula.");
    return;
  }

  try {
    const resposta = await fetch(`${API_URL}?acao=buscarOperador&matricula=${encodeURIComponent(matricula)}`);
    const operador = await resposta.json();

    if (!operador) {
      alert("Matrícula não encontrada.");
      return;
    }

    salvarOperador({
      nome: operador.nome,
      matricula: operador.matricula,
      setor: operador.setor,
      perfil: operador.perfil || "Operador",
      ativo: operador.ativo || "",
    });

    location.reload();
  } catch (erro) {
    console.error("Erro no login:", erro);
    alert("Erro ao fazer login.");
  }
}

//*********************************
// * 8. HOME
// *********************************/
function renderizarOperador() {
  const operador = obterOperador();
  const info = document.getElementById("operador-info");
  const setorAviso = document.getElementById("setor-aviso");
  const btnStatus = document.getElementById("btn-status-app");

  if (!info) return;

  const primeiroNome = operador?.nome?.split(" ")[0] || "Operador";
  info.textContent = `Olá, ${primeiroNome}`;

  if (setorAviso && operador?.setor) {
    setorAviso.textContent = `Exibindo todas as ordens do setor ${operador.setor}.`;
  }

  if (btnStatus) {
    const online = navigator.onLine;
    btnStatus.classList.remove("online", "offline");
    btnStatus.classList.add(online ? "online" : "offline");
    btnStatus.title = online ? "Sistema online" : "Sistema offline";
    btnStatus.innerHTML = `
      <span class="material-symbols-outlined">
        ${online ? "wifi" : "wifi_off"}
      </span>
    `;
  }
}
function copiarMatricula(valor) {
  if (!valor) return;

  navigator.clipboard.writeText(valor)
    .then(() => mostrarToast("Matrícula copiada"))
    .catch(() => mostrarToast("Não foi possível copiar"));
}
function abrirConfiguracoesPlaceholder() {
  mostrarToast("Configurações em breve");
}
function mostrarToast(texto) {
  let toast = document.getElementById("app-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = texto;
  toast.classList.add("show");

  clearTimeout(window.__appToastTimer);
  window.__appToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}
async function carregarOSDaAPI(setor) {
  try {
    const resposta = await fetch(`${API_URL}?acao=listarOS&setor=${encodeURIComponent(setor)}`);
    return await resposta.json();
  } catch (erro) {
    console.error("Erro ao buscar OS:", erro);
    return [];
  }
}

async function renderizarOS(mostrarLoading = true) {
  const operador = obterOperador();
  const lista = getById("lista-os");
  const avisoSetor = getById("setor-aviso");

  if (!lista) return;

  if (!operador) {
    lista.innerHTML = `<div class="vazio">Operador não identificado.</div>`;
    return;
  }

  if (mostrarLoading && !lista.dataset.carregado) {
    lista.innerHTML = `<div class="vazio">Carregando OS...</div>`;
  }

  const listaOS = await carregarOSDaAPI(operador.setor);

  const osDoSetor = listaOS.filter((os) => {
    return (os.setor_atual === operador.setor || os.tem_subtarefa_setor) && os.status !== "Concluído";
  });

  if (avisoSetor) {
    avisoSetor.textContent = `Exibindo todas as ordens do setor ${operador.setor}.`;
  }

  if (osDoSetor.length === 0) {
    lista.innerHTML = `<div class="vazio">Nenhuma OS encontrada para o setor ${operador.setor}.</div>`;
    lista.dataset.carregado = "true";
    return;
  }

  lista.innerHTML = "";
  lista.dataset.carregado = "true";

  osDoSetor.forEach((os) => {
    const card = document.createElement("div");
    card.className = "os-card";

    const statusClasse =
      String(os.status).toLowerCase() === "concluído" ? "badge-concluido" : "os-status";
    const criadoHa = formatarTempoDecorrido(os.data_abertura);

    card.innerHTML = `
      <div class="os-card-topo">
        <div class="os-card-esquerda">
          <div class="os-codigo">${os.codigo_os}</div>
          <div class="os-motor">${os.motor}</div>
        </div>

        <div class="os-card-direita">
          <div class="os-meta-topo">${criadoHa}</div>
          <div class="os-badges">
            <div class="${statusClasse}">${os.status}</div>
            <div class="os-tag-subtarefa">${os.setor_atual}</div>
            ${os.tem_subtarefa_setor ? `<div class="os-tag-subtarefa">Subtarefa</div>` : ""}
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      abrirDetalheOS(os);
    });

    lista.appendChild(card);
  });
}

//*********************************
// * 9. NOVA OS
// *********************************/
function abrirTelaNovaOS() {
  const operador = obterOperador();

  if (!operadorEhGestao()) {
    alert("A criação de OS está disponível apenas para a gestão.");
    return;
  }

  esconderBotaoNovaOS();
  esconderHeaderHome();
  pararAutoAtualizacao();
  telaAtual = "nova-os";

  const setoresIniciais = SETORES;

  getMain().innerHTML = `
    <section class="bloco conteudo">
      <button onclick="voltarHome()" class="btn-voltar">⬅ Voltar</button>

      <h2>Nova OS</h2>

      <div class="form-card">
        <div class="campo">
          <label>Motor</label>
          <input id="input-motor" type="text" placeholder="Digite o motor">
        </div>

        <div class="campo">
          <label>Setor inicial</label>
          <input type="hidden" id="select-setor" value="${setoresIniciais[0]}">
          <button type="button" id="select-setor-btn" class="campo-select-falso">
            ${setoresIniciais[0]}
          </button>
        </div>

        <button onclick="salvarNovaOS()" class="btn-principal">Salvar OS</button>
      </div>
    </section>
  `;

  ativarSelectCustomizado({
    hiddenId: "select-setor",
    buttonId: "select-setor-btn",
    titulo: "Selecionar setor inicial",
    opcoes: setoresIniciais,
    valorInicial: setoresIniciais[0],
  });
}

async function salvarNovaOS() {
  const operador = obterOperador();
  const motor = getById("input-motor")?.value.trim();
  const setorInicial = getById("select-setor")?.value;

  if (!motor) {
    alert("Digite o nome do motor.");
    return;
  }

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "criarOS",
        motor,
        setor_inicial: setorInicial,
        operador_nome: operador.nome,
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao criar OS.");
      return;
    }

    const novaOS = {
      id_os: resultado.id_os,
      codigo_os: resultado.codigo_os,
      motor,
      etapa_atual: setorInicial,
      status: "Em processo",
      operador_atual_nome: operador.nome,
      setor_atual: setorInicial,
    };

    if (setorInicial === operador.setor) {
      await abrirDetalheOS(novaOS);
    } else {
      alert(`OS criada com sucesso e enviada para o setor ${setorInicial}.`);
      voltarHome();
    }
  } catch (erro) {
    console.error("Erro ao criar OS:", erro);
    alert("Erro ao criar OS.");
  }
}

//*********************************
// * 10. DETALHE DA OS
// *********************************/
async function abrirDetalheOS(os) {
  esconderBotaoNovaOS();
  esconderHeaderHome();

  telaAtual = "detalhe-os";
  osAtualId = os.id_os;
  osSelecionada = os;

  const operador = obterOperador();
  const emModoSubtarefa = !!os.modo_subtarefa;
  const container = getMain();

  pararAutoAtualizacao();

  if (emModoSubtarefa) {
    container.innerHTML = `
      <section class="bloco conteudo tela-foco">
        <div class="foco-header os-topo-limpo">
          <div class="foco-header-texto">
            <div class="foco-codigo">${os.codigo_os}</div>
            <div class="foco-subtitulo">${os.motor || "-"} • ${operador?.setor || "-"}</div>
          </div>
          <button class="btn-header-detalhes" type="button" onclick="alternarDetalhesOS()" aria-label="Ver detalhes da OS">
            <span class="material-symbols-outlined">tune</span>
            <span>Detalhes</span>
          </button>
        </div>

        <div class="progress-mini-topo progress-os-topo">
          <div class="progress-mini-label" id="progress-os-top-label">OS total</div>
          <div class="progress-bar progress-bar-fina">
            <div id="progress-os-top-fill" class="progress-fill"></div>
          </div>
        </div>

        <div id="painel-detalhes-os" class="painel-detalhes-os oculto">
          <div class="info-grid">
            <div class="info-label">Motor</div>
            <div class="info-value">${os.motor || "-"}</div>

            <div class="info-label">Modo</div>
            <div class="info-value">Subtarefa ativa</div>

            <div class="info-label">Setor</div>
            <div class="info-value">${operador?.setor || "-"}</div>
          </div>
        </div>

        <p class="dica-operacao">Toque em uma subtarefa para abrir o checklist dela.</p>
        <div id="lista-subtarefas" class="subtarefas-lista"></div>
      </section>
    `;

    await Promise.all([carregarSubtarefas(true), atualizarBarrasDetalhadas()]);
    iniciarAutoAtualizacao();
    return;
  }

  container.innerHTML = `
    <section class="bloco conteudo tela-foco">
      <div class="foco-header os-topo-limpo">
        <div class="foco-header-texto">
          <div class="foco-codigo">${os.codigo_os}</div>
          <div class="foco-subtitulo">${os.motor || "-"} • ${os.etapa_atual || "-"}</div>
        </div>
        <button class="btn-header-detalhes" type="button" onclick="alternarDetalhesOS()" aria-label="Ver detalhes da OS">
          <span class="material-symbols-outlined">tune</span>
          <span>Detalhes</span>
        </button>
      </div>

      <div class="progress-mini-topo progress-os-topo">
        <div class="progress-mini-label" id="progress-os-top-label">OS total</div>
        <div class="progress-bar progress-bar-fina">
          <div id="progress-os-top-fill" class="progress-fill"></div>
        </div>
      </div>

      <div id="painel-detalhes-os" class="painel-detalhes-os oculto">
        <div class="info-grid">
          <div class="info-label">Motor</div>
          <div class="info-value">${os.motor || "-"}</div>

          <div class="info-label">Etapa</div>
          <div class="info-value">${os.etapa_atual || "-"}</div>

          <div class="info-label">Status</div>
          <div class="info-value">${os.status || "-"}</div>
        </div>

        <div class="progress-wrapper detalhe-progress">
          <div class="progress-texto" id="progress-os-label">OS total</div>
          <div class="progress-bar">
            <div id="progress-os-fill" class="progress-fill"></div>
          </div>
        </div>

        <div class="progress-wrapper detalhe-progress">
          <div class="progress-texto" id="progress-checklist-label-detalhe">Checklist atual</div>
          <div class="progress-bar">
            <div id="progress-checklist-fill-detalhe" class="progress-fill"></div>
          </div>
        </div>

        <div class="progress-wrapper detalhe-progress" id="progress-subtarefas-wrapper">
          <div class="progress-texto" id="progress-subtarefas-label">Subtarefas</div>
          <div class="progress-bar">
            <div id="progress-subtarefas-fill" class="progress-fill"></div>
          </div>
        </div>
      </div>

      <p class="dica-operacao">Toque no item, confirme e siga para o próximo. Use o botão + para criar subtarefa.</p>

      <div id="checklist" class="checklist-lista">
        <div class="vazio">Carregando checklist...</div>
      </div>

      <button id="btn-criar-subtarefa-foco" class="fab-subtarefa" type="button" onclick="abrirModalSubtarefa()" aria-label="Criar subtarefa">
        +
      </button>

      <div id="lista-subtarefas" class="subtarefas-lista oculto"></div>
    </section>
  `;

  await Promise.all([
    carregarChecklist(true),
    carregarSubtarefas(false),
    atualizarBarrasDetalhadas(),
  ]);

  iniciarAutoAtualizacao();
}

function alternarDetalhesOS() {
  const painel = getById("painel-detalhes-os");
  const botao = document.querySelector(".btn-header-detalhes");
  if (!painel) return;
  painel.classList.toggle("oculto");
  if (botao) botao.classList.toggle("ativo", !painel.classList.contains("oculto"));
}

function abrirModalSubtarefa() {
  const operador = obterOperador();
  if (!osSelecionada || !operador) return;

  garantirModalSubtarefa();

  const modal = getById("modal-subtarefa");
  const selectBtn = getById("modal-sub-setor-btn");
  const hiddenSetor = getById("modal-sub-setor");
  const input = getById("modal-sub-descricao");

  if (input) input.value = "";
  if (hiddenSetor) hiddenSetor.value = SETORES[0] || "";
  if (selectBtn) selectBtn.textContent = SETORES[0] || "Selecionar setor";

  ativarSelectCustomizado({
    hiddenId: "modal-sub-setor",
    buttonId: "modal-sub-setor-btn",
    titulo: "Selecionar setor destino",
    opcoes: SETORES,
    valorInicial: SETORES[0],
  });

  modal.classList.remove("oculto");
}

function fecharModalSubtarefa() {
  const modal = getById("modal-subtarefa");
  if (modal) modal.classList.add("oculto");
}

function abrirModalMensagem({ titulo, texto, detalhe }) {
  garantirModalMensagem();

  const modal = getById("modal-mensagem");
  const tituloEl = getById("modal-mensagem-titulo");
  const textoEl = getById("modal-mensagem-texto");
  const detalheEl = getById("modal-mensagem-detalhe");

  if (tituloEl) tituloEl.textContent = titulo || "Tudo certo";
  if (textoEl) textoEl.textContent = texto || "";
  if (detalheEl) detalheEl.textContent = detalhe || "";

  modal.classList.remove("oculto");
}

function fecharModalMensagem() {
  const modal = getById("modal-mensagem");
  if (modal) modal.classList.add("oculto");
}

function garantirModalSubtarefa() {
  if (getById("modal-subtarefa")) return;

  const div = document.createElement("div");
  div.id = "modal-subtarefa";
  div.className = "app-modal oculto";
  div.innerHTML = `
    <div class="app-modal-backdrop" onclick="fecharModalSubtarefa()"></div>
    <div class="app-modal-card modal-subtarefa-card">
      <div class="app-modal-topo">
        <div>
          <h3>Nova subtarefa</h3>
          <p class="modal-subtitulo">Envie uma pendência para outro setor sem sair do checklist.</p>
        </div>
        <button type="button" class="modal-close" onclick="fecharModalSubtarefa()">Fechar</button>
      </div>

      <div class="campo">
        <label>Descrição da pendência</label>
        <input id="modal-sub-descricao" type="text" placeholder="Ex: Conferir eixo, rebobinar, medir folga">
      </div>

      <div class="campo">
        <label>Setor destino</label>
        <input type="hidden" id="modal-sub-setor" value="${SETORES[0] || ""}">
        <button type="button" id="modal-sub-setor-btn" class="campo-select-falso campo-select-modal">${SETORES[0] || "Selecionar setor"}</button>
      </div>

      <div class="modal-info-box">
        A subtarefa ficará visível somente para o setor destino. Continue concluindo o checklist atual normalmente.
      </div>

      <button type="button" class="btn-principal btn-modal-criar" onclick="salvarSubtarefa()">Criar e enviar subtarefa</button>
    </div>
  `;

  document.body.appendChild(div);
}

function garantirModalMensagem() {
  if (getById("modal-mensagem")) return;

  const div = document.createElement("div");
  div.id = "modal-mensagem";
  div.className = "app-modal oculto";
  div.innerHTML = `
    <div class="app-modal-backdrop" onclick="fecharModalMensagem()"></div>
    <div class="app-modal-card modal-sucesso-card">
      <div class="modal-sucesso-icon">✓</div>
      <h3 id="modal-mensagem-titulo">Tudo certo</h3>
      <p id="modal-mensagem-texto"></p>
      <small id="modal-mensagem-detalhe"></small>
      <button type="button" class="btn-principal" onclick="fecharModalMensagem()">Continuar</button>
    </div>
  `;

  document.body.appendChild(div);
}

//*********************************
// * 11. CHECKLIST PRINCIPAL
// *********************************/
async function carregarChecklist(mostrarLoading = true) {
  const container = getById("checklist");
  if (!container || !osSelecionada) return;

  if (mostrarLoading && !container.dataset.carregado) {
    container.innerHTML = `<div class="vazio">Carregando checklist...</div>`;
  }

  try {
    const resposta = await fetch(
      `${API_URL}?acao=listarChecklist&id_os=${osSelecionada.id_os}&etapa=${encodeURIComponent(osSelecionada.etapa_atual)}`
    );

    const dados = await resposta.json();

    if (!dados || dados.length === 0) {
      await tratarChecklistPrincipalZerado(container);
      return;
    }

    container.innerHTML = "";
    container.dataset.carregado = "true";

    dados
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      .forEach((item) => {
        const div = document.createElement("div");
        div.className = "item-card item-card-foco";
        div.innerHTML = `
          <div class="item-titulo">Item ${item.ordem}</div>
          <div class="item-descricao">${item.descricao}</div>
          <div class="item-meta">Toque para confirmar conclusão</div>
        `;

        div.addEventListener("click", () => {
          confirmarConclusaoItemPrincipal(item);
        });

        container.appendChild(div);
      });
  } catch (erro) {
    console.error("Erro ao carregar checklist:", erro);

    if (mostrarLoading) {
      container.innerHTML = `<div class="vazio">Erro ao carregar checklist.</div>`;
    }
  }
}

async function tratarChecklistPrincipalZerado(container) {
  let progresso = null;

  try {
    progresso = await buscarProgressoDetalhadoOS();
  } catch (erro) {
    console.warn("Não foi possível confirmar progresso detalhado:", erro);
  }

  const subtarefasPendentes = Number(progresso?.subtarefas?.pendentes || 0);
  const checklistTotal = Number(progresso?.checklist_atual?.total || 0);

  if (subtarefasPendentes > 0) {
    container.innerHTML = `
      <div class="vazio">
        ✔ Checklist da etapa concluído.<br>
        Aguardando ${subtarefasPendentes} subtarefa(s) para liberar a próxima etapa.
      </div>
    `;
    container.dataset.carregado = "true";
    await atualizarBarrasDetalhadas();
    return;
  }

  if (checklistTotal === 0 && String(osSelecionada.etapa_atual || "").trim() === "Montagem") {
    container.innerHTML = `
      <div class="vazio">Montagem bloqueada ou sem checklist disponível.</div>
    `;
    container.dataset.carregado = "true";
    await atualizarBarrasDetalhadas();
    return;
  }

  container.innerHTML = `
    <div class="vazio">✔ Etapa concluída. Sincronizando dados...</div>
  `;
  container.dataset.carregado = "true";

  setTimeout(async () => {
    await concluirEtapa(true);
  }, 900);
}

function confirmarConclusaoItemPrincipal(item) {
  const texto = `Confirmar conclusão do item ${item.ordem}?`;

  const confirmar = confirm(texto);
  if (!confirmar) return;

  concluirItem(item.id_item);
}

async function concluirItem(id) {
  const operador = obterOperador();

  if (!operador) {
    alert("Operador não encontrado.");
    return;
  }

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "concluirItemChecklist",
        id_item: id,
        operador_nome: operador.nome,
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao concluir item.");
      return;
    }

    mostrarToast("Item concluído");
    await Promise.all([carregarChecklist(false), atualizarBarrasDetalhadas()]);
  } catch (erro) {
    console.error("Erro ao concluir item:", erro);
    alert("Erro ao concluir item.");
  }
}

async function concluirEtapa(silencioso = false) {
  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "atualizarEtapaOS",
        id_os: osSelecionada.id_os,
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      const erro = resultado.erro || "A etapa ainda não pode avançar.";
      if (!silencioso) alert(erro);
      else mostrarToast(erro);

      await atualizarBarrasDetalhadas();

      setTimeout(() => {
        voltarHome();
      }, 1200);
      return;
    }

    mostrarToast("Etapa finalizada");
    setTimeout(() => {
      voltarHome();
    }, 900);
  } catch (erro) {
    console.error("Erro ao concluir etapa:", erro);
    alert("Erro ao concluir etapa");
  }
}

//*********************************
// * 12. SUBTAREFAS
// *********************************/
async function salvarSubtarefa() {
  const descricao =
    getById("modal-sub-descricao")?.value.trim() ||
    getById("sub-descricao")?.value.trim();

  const setorDestino =
    getById("modal-sub-setor")?.value ||
    getById("sub-setor")?.value;

  const operador = obterOperador();

  if (!descricao) {
    alert("Digite a descrição da subtarefa.");
    return;
  }

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "criarSubtarefa",
        id_os: osSelecionada.id_os,
        descricao,
        setor_destino: setorDestino,
        operador_nome: operador?.nome || "",
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao criar subtarefa.");
      return;
    }

    const inputModal = getById("modal-sub-descricao");
    const inputAntigo = getById("sub-descricao");
    if (inputModal) inputModal.value = "";
    if (inputAntigo) inputAntigo.value = "";

    fecharModalSubtarefa();

    if (resultado.tipo === "checklist") {
      abrirModalMensagem({
        titulo: "Item adicionado",
        texto: "A atividade foi adicionada ao checklist desta etapa.",
        detalhe: "Continue concluindo os itens normalmente.",
      });
      await Promise.all([carregarChecklist(false), atualizarBarrasDetalhadas()]);
      return;
    }

    if (resultado.tipo === "subtarefa") {
      abrirModalMensagem({
        titulo: "Subtarefa enviada",
        texto: `A subtarefa foi enviada para o setor ${setorDestino}.`,
        detalhe: "Continue seu checklist normalmente. A próxima etapa só será liberada quando todas as pendências forem concluídas.",
      });

      await Promise.all([carregarSubtarefas(false), atualizarBarrasDetalhadas()]);
    }
  } catch (erro) {
    console.error("Erro ao criar subtarefa:", erro);
    alert("Erro ao criar subtarefa.");
  }
}

async function carregarSubtarefas(mostrarLoading = true) {
  const operador = obterOperador();
  const container = getById("lista-subtarefas");

  if (!container || !operador || !osSelecionada) return;

  if (mostrarLoading && !container.dataset.carregado) {
    container.innerHTML = `<div class="vazio">Carregando subtarefas...</div>`;
  }

  try {
    const url = osSelecionada.modo_subtarefa
      ? `${API_URL}?acao=listarSubtarefas&id_os=${osSelecionada.id_os}&setor=${encodeURIComponent(operador.setor)}`
      : `${API_URL}?acao=listarSubtarefasOS&id_os=${osSelecionada.id_os}`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    if (!dados || dados.length === 0) {
      container.innerHTML = osSelecionada.modo_subtarefa
        ? `<div class="vazio">Nenhuma subtarefa para o setor ${operador.setor}.</div>`
        : `<div class="vazio">Nenhuma subtarefa criada para esta OS.</div>`;
      container.dataset.carregado = "true";
      return;
    }

    container.innerHTML = "";
    container.dataset.carregado = "true";

    dados.forEach((sub) => {
      const statusConcluido = String(sub.status).toLowerCase() === "concluído";
      const textoStatus = statusConcluido
        ? `Concluída por ${sub.concluido_por || "-"}`
        : `Setor: ${sub.setor_destino}`;

      const classeStatus = statusConcluido ? "badge-concluido" : "os-status";

      const div = document.createElement("div");
      div.className = "os-card subtarefa-card";
      div.innerHTML = `
        <div class="os-card-topo">
          <div class="os-card-esquerda">
            <div class="os-codigo">Subtarefa</div>
            <div class="os-motor">${sub.descricao}</div>
            <div class="os-responsavel">${textoStatus}</div>
          </div>

          <div class="os-card-direita">
            <div class="os-badges">
              <div class="${classeStatus}">${sub.status}</div>
            </div>
          </div>
        </div>
      `;

      if (osSelecionada.modo_subtarefa && !statusConcluido) {
        div.addEventListener("click", () => {
          abrirDetalheSubtarefa(sub);
        });
      }

      container.appendChild(div);
    });
  } catch (erro) {
    console.error("Erro ao carregar subtarefas:", erro);

    if (mostrarLoading) {
      container.innerHTML = `<div class="vazio">Erro ao carregar subtarefas.</div>`;
    }
  }
}

async function abrirDetalheSubtarefa(subtarefa) {
  telaAtual = "detalhe-subtarefa";

  const container = getMain();

  container.innerHTML = `
    <section class="bloco conteudo tela-foco">
      <div class="foco-header">
        <div class="foco-header-texto">
          <div class="foco-codigo">Subtarefa</div>
          <div class="foco-subtitulo">${subtarefa.descricao || "-"} • ${subtarefa.setor_destino || "-"}</div>
        </div>
        <button class="btn-header-detalhes" type="button" onclick="voltarHome()">Home</button>
      </div>

      <div class="progress-mini-topo">
        <div class="progress-mini-label" id="progress-subtarefa-label">Checklist da subtarefa</div>
        <div class="progress-bar progress-bar-fina">
          <div id="progress-subtarefa-fill" class="progress-fill"></div>
        </div>
      </div>

      <p class="dica-operacao">Toque no item da subtarefa e confirme a conclusão.</p>

      <div id="checklist-subtarefa" class="checklist-lista">
        <div class="vazio">Carregando checklist da subtarefa...</div>
      </div>
    </section>
  `;

  osSelecionada.subtarefa_atual = subtarefa;
  await Promise.all([
    carregarChecklistSubtarefa(subtarefa),
    atualizarBarraSubtarefa(subtarefa.id_subtarefa),
  ]);
}

async function carregarChecklistSubtarefa(subtarefa) {
  const container = getById("checklist-subtarefa");
  if (!container) return;

  try {
    const resposta = await fetch(`${API_URL}?acao=listarChecklistSubtarefa&id_subtarefa=${subtarefa.id_subtarefa}`);
    const dados = await resposta.json();

    if (!dados || dados.length === 0) {
      container.innerHTML = `
        <div class="vazio">✔ Subtarefa concluída. Voltando para a Home...</div>
      `;

      setTimeout(() => {
        voltarHome();
      }, 1000);
      return;
    }

    container.innerHTML = "";

    dados.forEach((item) => {
      const div = document.createElement("div");
      div.className = "item-card item-card-foco";
      div.innerHTML = `
        <div class="item-titulo">Item ${item.ordem}</div>
        <div class="item-descricao">${item.descricao}</div>
        <div class="item-meta">Toque para confirmar conclusão</div>
      `;

      div.addEventListener("click", () => {
        const confirmar = confirm(`Confirmar conclusão do item ${item.ordem}?`);
        if (!confirmar) return;
        concluirItemChecklistSubtarefa(item, subtarefa);
      });

      container.appendChild(div);
    });
  } catch (erro) {
    console.error("Erro ao carregar checklist da subtarefa:", erro);
    container.innerHTML = `<div class="vazio">Erro ao carregar checklist da subtarefa.</div>`;
  }
}

async function concluirItemChecklistSubtarefa(item, subtarefa) {
  const operador = obterOperador();

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "concluirItemChecklistSubtarefa",
        id_item: item.id_item,
        id_subtarefa: subtarefa.id_subtarefa,
        operador_nome: operador?.nome || "",
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao concluir item da subtarefa.");
      return;
    }

    mostrarToast("Item da subtarefa concluído");

    await Promise.all([
      carregarChecklistSubtarefa(subtarefa),
      atualizarBarraSubtarefa(subtarefa.id_subtarefa),
    ]);
  } catch (erro) {
    console.error("Erro ao concluir item da subtarefa:", erro);
    alert("Erro ao concluir item da subtarefa.");
  }
}

async function concluirSubtarefa(idSubtarefa) {
  const operador = obterOperador();

  if (!operador) {
    alert("Operador não encontrado.");
    return;
  }

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "concluirSubtarefa",
        id_subtarefa: idSubtarefa,
        operador_nome: operador.nome,
      }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao concluir subtarefa.");
      return;
    }

    await Promise.all([carregarSubtarefas(false), atualizarBarrasDetalhadas(), carregarChecklist(false)]);
  } catch (erro) {
    console.error("Erro ao concluir subtarefa:", erro);
    alert("Erro ao concluir subtarefa.");
  }
}

//*********************************
// * 13. PROGRESSO
//*********************************/
async function buscarProgressoDetalhadoOS() {
  if (!osSelecionada) return null;

  try {
    const resposta = await fetch(
      `${API_URL}?acao=obterProgressoDetalhadoOS&id_os=${osSelecionada.id_os}&etapa=${encodeURIComponent(osSelecionada.etapa_atual)}`
    );

    const dados = await resposta.json();

    if (dados && !dados.erro) return dados;
  } catch (erro) {
    console.warn("Endpoint detalhado indisponível, usando progresso simples:", erro);
  }

  const respostaFallback = await fetch(
    `${API_URL}?acao=obterProgressoOS&id_os=${osSelecionada.id_os}&etapa=${encodeURIComponent(osSelecionada.etapa_atual)}`
  );

  const simples = await respostaFallback.json();

  return {
    os_total: {
      total: Number(simples.total || 0),
      concluidos: Number(simples.concluidos || 0),
      percentual: Number(simples.percentual || 0),
    },
    checklist_atual: {
      total: Number(simples.total || 0),
      concluidos: Number(simples.concluidos || 0),
      percentual: Number(simples.percentual || 0),
    },
    subtarefas: {
      total: 0,
      concluidas: 0,
      pendentes: 0,
      percentual: 0,
    },
  };
}

async function atualizarBarrasDetalhadas() {
  if (!osSelecionada) return;

  try {
    const dados = await buscarProgressoDetalhadoOS();
    if (!dados) return;

    const osTotal = dados.os_total || {};
    const checklist = dados.checklist_atual || {};
    const subtarefas = dados.subtarefas || {};

    const checklistPercentual = Number(checklist.percentual || 0);
    const osPercentual = Number(osTotal.percentual || 0);
    const subtarefasPercentual = Number(subtarefas.percentual || 0);

    const osTopFill = getById("progress-os-top-fill") || getById("progress-fill");
    const osTopLabel = getById("progress-os-top-label") || getById("progress-checklist-label");

    if (osTopFill) osTopFill.style.width = `${osPercentual}%`;
    if (osTopLabel) {
      osTopLabel.textContent = `OS total: ${osTotal.concluidos || 0}/${osTotal.total || 0} • ${osPercentual}%`;
    }

    const checklistFillDetalhe = getById("progress-checklist-fill-detalhe");
    const checklistLabelDetalhe = getById("progress-checklist-label-detalhe");

    if (checklistFillDetalhe) checklistFillDetalhe.style.width = `${checklistPercentual}%`;
    if (checklistLabelDetalhe) {
      checklistLabelDetalhe.textContent = `Checklist atual: ${checklist.concluidos || 0}/${checklist.total || 0} • ${checklistPercentual}%`;
    }

    const osFill = getById("progress-os-fill");
    const osLabel = getById("progress-os-label");

    if (osFill) osFill.style.width = `${osPercentual}%`;
    if (osLabel) {
      osLabel.textContent = `OS total: ${osTotal.concluidos || 0}/${osTotal.total || 0} • ${osPercentual}%`;
    }

    const subWrapper = getById("progress-subtarefas-wrapper");
    const subFill = getById("progress-subtarefas-fill");
    const subLabel = getById("progress-subtarefas-label");

    const totalSubtarefas = Number(subtarefas.total || 0);

    if (subWrapper) {
      subWrapper.style.display = totalSubtarefas > 0 ? "block" : "none";
    }

    if (subFill) subFill.style.width = `${subtarefasPercentual}%`;
    if (subLabel) {
      subLabel.textContent = `Subtarefas: ${subtarefas.concluidas || 0}/${totalSubtarefas} • ${subtarefasPercentual}%`;
    }
  } catch (erro) {
    console.error("Erro ao atualizar barras detalhadas:", erro);
  }
}

async function atualizarBarraProgresso() {
  await atualizarBarrasDetalhadas();
}

async function atualizarBarraSubtarefa(idSubtarefa) {
  try {
    const resposta = await fetch(`${API_URL}?acao=obterProgressoSubtarefa&id_subtarefa=${idSubtarefa}`);
    const dados = await resposta.json();

    const percentual = Number(dados.percentual || 0);
    const fill = getById("progress-subtarefa-fill");
    const label = getById("progress-subtarefa-label");

    if (fill) fill.style.width = `${percentual}%`;
    if (label) label.textContent = `Checklist da subtarefa: ${dados.concluidos || 0}/${dados.total || 0} • ${percentual}%`;
  } catch (erro) {
    console.error("Erro ao atualizar progresso da subtarefa:", erro);
  }
}

function renderizarListaProgresso(lista, container, tipo) {
  container.innerHTML = "";

  if (!lista || lista.length === 0) {
    container.innerHTML = `<div class="vazio">Nenhuma OS nesta categoria.</div>`;
    return;
  }

  lista.forEach((os) => {
    const div = document.createElement("div");

    let classe = "progresso-linha-item";
    let statusTexto = "Em andamento";

    if (tipo === "finalizada") {
      classe += " finalizada";
      statusTexto = "Pronta";
    } else if (tipo === "atrasada") {
      classe += " atrasada";
      statusTexto = "Atrasada";
    }

    div.className = classe;
    div.innerHTML = `
      <div class="progresso-col principal">
        <div class="progresso-codigo">${os.codigo_os}</div>
        <div class="progresso-motor">${os.motor}</div>
      </div>

      <div class="progresso-col centro">
        <div class="progresso-etapa">${os.etapa_atual || "-"}</div>
        <div class="progresso-restantes">${os.restantes || 0} restantes</div>
      </div>

      <div class="progresso-col direita">
        <div class="progresso-percentual">${os.percentual || 0}%</div>
        <div class="progresso-badge">${statusTexto}</div>
      </div>
    `;

    container.appendChild(div);
  });
}

function aplicarFiltrosProgressoGestao() {
  const listaAndamento = getById("lista-progresso-andamento");
  const listaFinalizadas = getById("lista-progresso-finalizadas");
  const listaAtrasadas = getById("lista-progresso-atrasadas");

  const countAndamento = getById("count-progresso-andamento");
  const countFinalizadas = getById("count-progresso-finalizadas");
  const countAtrasadas = getById("count-progresso-atrasadas");

  if (!listaAndamento || !listaFinalizadas || !listaAtrasadas) return;

  const busca = (getById("filtro-progresso-busca")?.value || "").trim().toLowerCase();
  const etapa = getById("filtro-progresso-etapa")?.value || "";
  const status = getById("filtro-progresso-status")?.value || "";

  let listaFiltrada = [...progressoGestaoCache];

  if (busca) {
    listaFiltrada = listaFiltrada.filter((os) => {
      return (
        String(os.codigo_os || "").toLowerCase().includes(busca) ||
        String(os.motor || "").toLowerCase().includes(busca)
      );
    });
  }

  if (etapa) {
    listaFiltrada = listaFiltrada.filter((os) => String(os.etapa_atual || "").trim() === etapa);
  }

  if (status) {
    listaFiltrada = listaFiltrada.filter((os) => String(os.grupo || "").trim() === status);
  }

  const andamento = listaFiltrada.filter((item) => item.grupo === "em_andamento");
  const finalizadas = listaFiltrada.filter((item) => item.grupo === "finalizadas");
  const atrasadas = listaFiltrada.filter((item) => item.grupo === "atrasadas");

  if (countAndamento) countAndamento.textContent = andamento.length;
  if (countFinalizadas) countFinalizadas.textContent = finalizadas.length;
  if (countAtrasadas) countAtrasadas.textContent = atrasadas.length;

  renderizarListaProgresso(andamento, listaAndamento, "andamento");
  renderizarListaProgresso(finalizadas, listaFinalizadas, "finalizada");
  renderizarListaProgresso(atrasadas, listaAtrasadas, "atrasada");
}

//*********************************
// * 14. GESTÃO
// *********************************/
function abrirPainelGestao() {
  esconderBotaoNovaOS();
  mostrarHeaderHome();
  pararAutoAtualizacao();
  telaAtual = "gestao";
  osAtualId = null;

  const operador = obterOperador();
  const container = getMain();

  container.innerHTML = `
    <section class="bloco conteudo">
      <h2>Painel de Gestão</h2>
      <p class="setor-aviso">Visão técnica e gerencial das ordens de serviço.</p>

      <div class="tabs-bar">
        <button class="tab-btn ativo" id="btn-tab-relatorios" onclick="abrirTabGestao('relatorios')">Relatórios</button>
        <button class="tab-btn" id="btn-tab-insights" onclick="abrirTabGestao('insights')">Insights</button>
        <button class="tab-btn" id="btn-tab-progresso" onclick="abrirTabGestao('progresso')">Progresso</button>
      </div>

      <div id="tab-relatorios">
        <div class="gestao-grid">
          <div class="gestao-card"><div class="gestao-label">OS em andamento</div><div class="gestao-valor" id="g-os-andamento">--</div></div>
          <div class="gestao-card"><div class="gestao-label">OS concluídas</div><div class="gestao-valor" id="g-os-concluidas">--</div></div>
          <div class="gestao-card"><div class="gestao-label">Subtarefas pendentes</div><div class="gestao-valor" id="g-subtarefas-pendentes">--</div></div>
          <div class="gestao-card"><div class="gestao-label">Operadores cadastrados</div><div class="gestao-valor" id="g-operadores">--</div></div>
        </div>

        <div class="os-card">
          <strong>Indicadores técnicos</strong>
          <div class="gestao-linha"><span>Total de itens de checklist</span><span id="g-itens-checklist">--</span></div>
          <div class="gestao-linha"><span>Itens concluídos</span><span id="g-itens-concluidos">--</span></div>
          <div class="gestao-linha"><span>Operador mais ativo</span><span id="g-operador-ativo">--</span></div>
          <div class="gestao-linha"><span>Setor mais demandado</span><span id="g-setor-demandado">--</span></div>
        </div>

        <div class="progresso-bloco">
          <h3 class="progresso-titulo">Ordens de serviço</h3>
          <div id="gestao-lista-os" class="checklist-lista"></div>
        </div>

        <div class="progresso-bloco">
          <h3 class="progresso-titulo">OS excluídas</h3>
          <div id="lista-os-excluidas" class="checklist-lista"></div>
        </div>
      </div>

      <div id="tab-insights" style="display:none;">
        <div class="os-card">
          <strong>Insights de produção</strong>

          <div style="margin-top:16px;">
            <div class="gestao-linha"><span>OS em andamento</span><span id="i-os-andamento">--</span></div>
            <div class="progress-bar"><div id="i-bar-os-andamento" class="progress-fill"></div></div>
          </div>

          <div style="margin-top:16px;">
            <div class="gestao-linha"><span>OS concluídas</span><span id="i-os-concluidas">--</span></div>
            <div class="progress-bar"><div id="i-bar-os-concluidas" class="progress-fill"></div></div>
          </div>

          <div style="margin-top:16px;">
            <div class="gestao-linha"><span>Itens concluídos</span><span id="i-itens-concluidos">--</span></div>
            <div class="progress-bar"><div id="i-bar-itens-concluidos" class="progress-fill"></div></div>
          </div>

          <div style="margin-top:16px;">
            <div class="gestao-linha"><span>Subtarefas pendentes</span><span id="i-subtarefas-pendentes">--</span></div>
            <div class="progress-bar"><div id="i-bar-subtarefas-pendentes" class="progress-fill"></div></div>
          </div>
        </div>

        <div class="os-card" style="margin-top:16px;">
          <strong>Leitura técnica</strong>
          <div class="gestao-linha"><span>Operador mais ativo</span><span id="i-operador-ativo">--</span></div>
          <div class="gestao-linha"><span>Setor mais demandado</span><span id="i-setor-demandado">--</span></div>
        </div>
      </div>

      <div id="tab-progresso" style="display:none;">
        <div class="os-card">
          <strong>Progresso das ordens</strong>
          <p class="setor-aviso" style="margin-top:8px;">Lista separada por status geral da OS.</p>

          <div class="filtros-gestao">
            <input type="text" id="filtro-progresso-busca" placeholder="Buscar por código ou motor" oninput="aplicarFiltrosProgressoGestao()">

            <input type="hidden" id="filtro-progresso-etapa" value="">
            <button type="button" id="filtro-progresso-etapa-btn" class="campo-select-falso">Todas as etapas</button>

            <input type="hidden" id="filtro-progresso-status" value="">
            <button type="button" id="filtro-progresso-status-btn" class="campo-select-falso">Todos os grupos</button>
          </div>
        </div>

        <div class="progresso-bloco">
          <h3 class="progresso-titulo">Criadas / Em andamento <span id="count-progresso-andamento" class="count-badge">0</span></h3>
          <div id="lista-progresso-andamento"></div>
        </div>

        <div class="progresso-bloco">
          <h3 class="progresso-titulo">Finalizadas <span id="count-progresso-finalizadas" class="count-badge">0</span></h3>
          <div id="lista-progresso-finalizadas"></div>
        </div>

        <div class="progresso-bloco">
          <h3 class="progresso-titulo">Atrasadas <span id="count-progresso-atrasadas" class="count-badge">0</span></h3>
          <div id="lista-progresso-atrasadas"></div>
        </div>
      </div>
    </section>
  `;

  const info = getById("operador-info");
  const matriculaInfo = getById("matricula-info");

  if (info && operador) info.textContent = `Gestão: ${operador.nome}`;
  if (matriculaInfo && operador) matriculaInfo.textContent = operador.matricula || "----";

  ativarSelectCustomizado({
    hiddenId: "filtro-progresso-etapa",
    buttonId: "filtro-progresso-etapa-btn",
    titulo: "Filtrar por etapa",
    opcoes: ["", "Desmontagem", "Montagem", "Usinagem", "Produção", "Elétrica", "Finalizado"],
    valorInicial: "",
  });

  const btnEtapa = getById("filtro-progresso-etapa-btn");
  if (btnEtapa) {
    btnEtapa.textContent = "Todas as etapas";
    btnEtapa.onclick = () => {
      abrirSelectModal({
        titulo: "Filtrar por etapa",
        opcoes: ["", "Desmontagem", "Montagem", "Usinagem", "Produção", "Elétrica", "Finalizado"],
        valorAtual: getById("filtro-progresso-etapa")?.value || "",
        onSelect: (valor) => {
          getById("filtro-progresso-etapa").value = valor;
          btnEtapa.textContent = valor || "Todas as etapas";
          aplicarFiltrosProgressoGestao();
        },
      });
    };
  }

  ativarSelectCustomizado({
    hiddenId: "filtro-progresso-status",
    buttonId: "filtro-progresso-status-btn",
    titulo: "Filtrar por grupo",
    opcoes: ["", "em_andamento", "finalizadas", "atrasadas"],
    valorInicial: "",
  });

  const btnStatus = getById("filtro-progresso-status-btn");
  if (btnStatus) {
    btnStatus.textContent = "Todos os grupos";
    btnStatus.onclick = () => {
      abrirSelectModal({
        titulo: "Filtrar por grupo",
        opcoes: ["", "em_andamento", "finalizadas", "atrasadas"],
        valorAtual: getById("filtro-progresso-status")?.value || "",
        onSelect: (valor) => {
          getById("filtro-progresso-status").value = valor;
          const mapa = {
            "": "Todos os grupos",
            em_andamento: "Em andamento",
            finalizadas: "Finalizadas",
            atrasadas: "Atrasadas",
          };
          btnStatus.textContent = mapa[valor] || "Todos os grupos";
          aplicarFiltrosProgressoGestao();
        },
      });
    };
  }

  carregarResumoGestao(true);
  carregarListaOSGestao(true);
  carregarOSExcluidas(true);
  carregarProgressoGestao(true);
}

async function carregarResumoGestao(mostrarLoading = true) {
  try {
    const resposta = await fetch(`${API_URL}?acao=obterResumoGestao`);
    const dados = await resposta.json();

    const totalOSAndamento = Number(dados.total_os_andamento || 0);
    const totalOSConcluidas = Number(dados.total_os_concluidas || 0);
    const totalSubPendentes = Number(dados.total_subtarefas_pendentes || 0);
    const totalOperadores = Number(dados.total_operadores || 0);
    const totalItensChecklist = Number(dados.total_itens_checklist || 0);
    const totalItensConcluidos = Number(dados.total_itens_concluidos || 0);

    const totalOSBase = Math.max(totalOSAndamento + totalOSConcluidas, 1);
    const totalItensBase = Math.max(totalItensChecklist, 1);

    if (getById("g-os-andamento")) getById("g-os-andamento").textContent = totalOSAndamento;
    if (getById("g-os-concluidas")) getById("g-os-concluidas").textContent = totalOSConcluidas;
    if (getById("g-subtarefas-pendentes")) getById("g-subtarefas-pendentes").textContent = totalSubPendentes;
    if (getById("g-operadores")) getById("g-operadores").textContent = totalOperadores;
    if (getById("g-itens-checklist")) getById("g-itens-checklist").textContent = totalItensChecklist;
    if (getById("g-itens-concluidos")) getById("g-itens-concluidos").textContent = totalItensConcluidos;
    if (getById("g-operador-ativo")) getById("g-operador-ativo").textContent = `${dados.operador_mais_ativo || "-"} (${dados.qtd_operador_mais_ativo || 0})`;
    if (getById("g-setor-demandado")) getById("g-setor-demandado").textContent = `${dados.setor_mais_demandado || "-"} (${dados.qtd_setor_mais_demandado || 0})`;

    if (getById("i-os-andamento")) getById("i-os-andamento").textContent = totalOSAndamento;
    if (getById("i-os-concluidas")) getById("i-os-concluidas").textContent = totalOSConcluidas;
    if (getById("i-itens-concluidos")) getById("i-itens-concluidos").textContent = `${totalItensConcluidos}/${totalItensChecklist}`;
    if (getById("i-subtarefas-pendentes")) getById("i-subtarefas-pendentes").textContent = totalSubPendentes;
    if (getById("i-operador-ativo")) getById("i-operador-ativo").textContent = `${dados.operador_mais_ativo || "-"} (${dados.qtd_operador_mais_ativo || 0})`;
    if (getById("i-setor-demandado")) getById("i-setor-demandado").textContent = `${dados.setor_mais_demandado || "-"} (${dados.qtd_setor_mais_demandado || 0})`;

    if (getById("i-bar-os-andamento")) getById("i-bar-os-andamento").style.width = `${Math.round((totalOSAndamento / totalOSBase) * 100)}%`;
    if (getById("i-bar-os-concluidas")) getById("i-bar-os-concluidas").style.width = `${Math.round((totalOSConcluidas / totalOSBase) * 100)}%`;
    if (getById("i-bar-itens-concluidos")) getById("i-bar-itens-concluidos").style.width = `${Math.round((totalItensConcluidos / totalItensBase) * 100)}%`;
    if (getById("i-bar-subtarefas-pendentes")) getById("i-bar-subtarefas-pendentes").style.width = `${totalSubPendentes > 0 ? 100 : 0}%`;
  } catch (erro) {
    console.error("Erro ao carregar resumo da gestão:", erro);
  }
}

async function carregarListaOSGestao(mostrarLoading = true) {
  const container = getById("gestao-lista-os");
  if (!container) return;

  if (mostrarLoading && !container.dataset.carregado) {
    container.innerHTML = `<div class="vazio">Carregando ordens...</div>`;
  }

  try {
    const resposta = await fetch(`${API_URL}?acao=listarOSTodasGestao`);
    const dados = await resposta.json();

    if (!dados || dados.length === 0) {
      container.innerHTML = `<div class="vazio">Nenhuma OS encontrada.</div>`;
      container.dataset.carregado = "true";
      return;
    }

    container.innerHTML = "";
    container.dataset.carregado = "true";

    dados.forEach((os) => {
      const div = document.createElement("div");
      div.className = "os-card";
      div.innerHTML = `
        <div class="os-card-topo">
          <div class="os-card-esquerda">
            <div class="os-codigo">${os.codigo_os}</div>
            <div class="os-motor">${os.motor}</div>
            <div class="os-responsavel">Etapa: ${os.etapa_atual || "-"} • Setor: ${os.setor_atual || "-"}</div>
            <div class="os-responsavel">Criado por: ${os.criado_por || os.operador_atual_nome || "-"}</div>
          </div>

          <div class="os-card-direita">
            <div class="os-badges">
              <div class="os-status">${os.status || "-"}</div>
            </div>
          </div>
        </div>

        <div class="gestao-acoes">
          <button class="btn-gestao-secundario" onclick="abrirDetalheOSGestao('${os.id_os}')">Abrir</button>
          <button class="btn-gestao-danger" onclick="excluirOSGestao('${os.id_os}', '${os.codigo_os}')">Excluir</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (erro) {
    console.error("Erro ao carregar lista da gestão:", erro);

    if (mostrarLoading) {
      container.innerHTML = `<div class="vazio">Erro ao carregar ordens.</div>`;
    }
  }
}

async function excluirOSGestao(idOS, codigoOS) {
  const confirmar = confirm(`Deseja excluir a ${codigoOS}?`);
  if (!confirmar) return;

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ acao: "excluirOS", id_os: idOS }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao excluir OS.");
      return;
    }

    carregarResumoGestao();
    carregarListaOSGestao();
    carregarOSExcluidas();
  } catch (erro) {
    console.error("Erro ao excluir OS:", erro);
    alert("Erro ao excluir OS.");
  }
}

async function carregarOSExcluidas(mostrarLoading = true) {
  const container = getById("lista-os-excluidas");
  if (!container) return;

  if (mostrarLoading && !container.dataset.carregado) {
    container.innerHTML = `<div class="vazio">Carregando OS excluídas...</div>`;
  }

  try {
    const res = await fetch(`${API_URL}?acao=listarOSExcluidas`);
    const data = await res.json();

    container.innerHTML = "";
    container.dataset.carregado = "true";

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="vazio">Nenhuma OS excluída.</div>`;
      return;
    }

    data.forEach((os) => {
      const div = document.createElement("div");
      div.className = "os-card";
      div.innerHTML = `
        <div class="os-card-topo">
          <div class="os-card-esquerda">
            <div class="os-codigo">${os.codigo_os}</div>
            <div class="os-motor">${os.motor}</div>
            <div class="os-responsavel">Etapa: ${os.etapa_atual || "-"} • Setor: ${os.setor_atual || "-"}</div>
            <div class="os-responsavel">Criado por: ${os.criado_por || os.operador_atual_nome || "-"}</div>
          </div>

          <div class="os-card-direita">
            <div class="os-badges">
              <div class="badge-atrasado">Excluída</div>
            </div>
          </div>
        </div>

        <div class="gestao-acoes">
          <button class="btn-gestao-secundario" onclick="recuperarOSGestao('${os.id_os}')">Recuperar</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (erro) {
    console.error("Erro ao carregar OS excluídas:", erro);

    if (mostrarLoading) {
      container.innerHTML = `<div class="vazio">Erro ao carregar OS excluídas.</div>`;
    }
  }
}

async function recuperarOSGestao(idOS) {
  const confirmar = confirm("Deseja recuperar esta OS?");
  if (!confirmar) return;

  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ acao: "recuperarOS", id_os: idOS }),
    });

    const resultado = await resposta.json();

    if (!resultado.sucesso) {
      alert("Erro ao recuperar OS.");
      return;
    }

    carregarResumoGestao();
    carregarListaOSGestao();
    carregarOSExcluidas();
  } catch (erro) {
    console.error("Erro ao recuperar OS:", erro);
    alert("Erro ao recuperar OS.");
  }
}

async function abrirDetalheOSGestao(idOS) {
  try {
    const resposta = await fetch(`${API_URL}?acao=listarOSTodasGestao`);
    const dados = await resposta.json();
    const os = dados.find((item) => String(item.id_os) === String(idOS));

    if (!os) {
      alert("OS não encontrada.");
      return;
    }

    await abrirDetalheOS(os);
  } catch (erro) {
    console.error("Erro ao abrir detalhe da OS:", erro);
    alert("Erro ao abrir OS.");
  }
}

async function carregarProgressoGestao(mostrarLoading = true) {
  const listaAndamento = getById("lista-progresso-andamento");
  const listaFinalizadas = getById("lista-progresso-finalizadas");
  const listaAtrasadas = getById("lista-progresso-atrasadas");

  if (!listaAndamento || !listaFinalizadas || !listaAtrasadas) return;

  if (mostrarLoading && !listaAndamento.dataset.carregado) {
    listaAndamento.innerHTML = `<div class="vazio">Carregando...</div>`;
    listaFinalizadas.innerHTML = "";
    listaAtrasadas.innerHTML = "";
  }

  try {
    const resposta = await fetch(`${API_URL}?acao=listarProgressoGestao`);
    const dados = await resposta.json();

    progressoGestaoCache = Array.isArray(dados) ? dados : [];
    listaAndamento.dataset.carregado = "true";
    aplicarFiltrosProgressoGestao();
  } catch (erro) {
    console.error("Erro ao carregar progresso da gestão:", erro);

    if (mostrarLoading) {
      listaAndamento.innerHTML = `<div class="vazio">Erro ao carregar progresso.</div>`;
    }
  }
}

//*********************************
// * 15. INICIALIZAÇÃO
// *********************************/
function iniciarApp() {
  
  const btnNovaOS = getById("btn-nova-os");
  const btnLogout = getById("btn-logout");

  if (btnNovaOS) {
    btnNovaOS.addEventListener("click", () => {
      abrirTelaNovaOS();
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      fazerLogout();
    });
  }
  iniciarBottomNav();
  iniciarFAB();
  abrirBoot();
}



function iniciarFAB() {
  const fab = getById("btn-fab-qr");
  if (!fab) return;

  fab.addEventListener("click", () => {
    alert("📷 Aqui vamos abrir o leitor de QR Code (próximo passo)");
  });
}


document.addEventListener("DOMContentLoaded", iniciarApp);

function iniciarBottomNav() {
  const home = getById("btn-nav-home");
  const ordens = getById("btn-nav-ordens");
  const perfil = getById("btn-nav-perfil");
  const mais = getById("btn-nav-mais");

  if (home) {
    home.onclick = () => voltarHome();
  }

  if (ordens) {
    ordens.onclick = () => renderizarHome();
  }

  if (perfil) {
    perfil.onclick = () => abrirPerfilOperador();
  }

  if (mais) {
    mais.onclick = () => mostrarToast("Histórico do operador será a próxima etapa");
  }
}

function abrirPerfilOperador() {
  const operador = obterOperador();
  esconderBotaoNovaOS();
  esconderHeaderHome();
  pararAutoAtualizacao();
  telaAtual = "perfil";

  getMain().innerHTML = `
    <section class="bloco conteudo">
      <div class="os-resumo">
        <h2>Perfil</h2>
        <div class="info-grid">
          <div class="info-label">Nome</div>
          <div class="info-value">${operador?.nome || "-"}</div>
          <div class="info-label">Matrícula</div>
          <div class="info-value">${operador?.matricula || "-"}</div>
          <div class="info-label">Setor</div>
          <div class="info-value">${operador?.setor || "-"}</div>
          <div class="info-label">Perfil</div>
          <div class="info-value">${operador?.perfil || "Operador"}</div>
        </div>
      </div>
    </section>
  `;
}