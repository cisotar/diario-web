// ============================================================
//  APP.JS — Controle de Aulas v6 · Perfis admin/coordenador/professor
// ============================================================

let turmaAtiva    = null;
let bimestreAtivo = null;
let estadoAulas = {};
let ordemConteudos = {};
let linhasEventuais = {};
let dragSrcSlots  = [];
let dragDestSlot  = null;
let selConteudos  = new Set();
let RT_BIMESTRES  = null;
let RT_TURMAS     = null;
let RT_CONTEUDOS  = null;
let RT_PERIODOS   = null;
let RT_CONFIG     = { nomeEscola: "", disciplinasPorSerie: {} };  // config global editável pelo admin
// disciplinasPorSerie: { "1": { "linguagens": ["Port.","Inglês"], "humanas": [...] }, "2": {...}, "3": {...} }

// Áreas do conhecimento (BNCC) e mapeamento para as disciplinas globais
const AREAS_CONHECIMENTO = [
  { id: "linguagens",   label: "Linguagens",           palavras: ["português","língua","inglês","espanhol","arte","artes","educação física","literatura","redação"] },
  { id: "matematica",   label: "Matemática",            palavras: ["matemática","geometria","estatística","álgebra"] },
  { id: "humanas",      label: "Ciências Humanas",      palavras: ["história","geografia","filosofia","sociologia","ensino religioso"] },
  { id: "natureza",     label: "Ciências da Natureza",  palavras: ["ciências","biologia","física","química"] },
];

// Retorna disciplinas de uma área em todas as séries (sem duplicatas)
function _disciplinasDaArea(areaId) {
  if (!areaId) return _todasDisciplinas();
  const dps = RT_CONFIG.disciplinasPorSerie || {};
  const todas = new Set();
  for (const serie of ["1","2","3"]) {
    const discs = dps[serie]?.[areaId] || [];
    discs.forEach(d => todas.add(d));
  }
  return [...todas].sort();
}

// Todas as disciplinas cadastradas (todas séries, todas áreas)
function _todasDisciplinas() {
  const dps = RT_CONFIG.disciplinasPorSerie || {};
  const todas = new Set();
  for (const serie of Object.values(dps)) {
    for (const discs of Object.values(serie)) {
      discs.forEach(d => todas.add(d));
    }
  }
  return [...todas].sort();
}

// Perfil do professor logado (carregado do Firestore)
let _perfilProf = null;  // { nome, email, escola, status, uid }

document.addEventListener("DOMContentLoaded", async () => {
  _mostrarCarregando(true);
  await _ativarOffline();          // 0º: habilitar cache offline antes de qualquer leitura
  _iniciarMonitorConexao();        // 0º: monitorar conexão
  await _verificarSessao();        // 1º: saber quem está logado
  const ok = await _verificarAcessoProfessor(); // 2º: checar status
  if (!ok) { _mostrarCarregando(false); return; } // tela de aguardo já renderizada
  await carregarTudo();
  _mostrarCarregando(false);
  renderizarSidebar();
  _atualizarTagline();
  iniciarTooltips();
  _initClickFora();
  if (window.innerWidth <= 860) {
    renderizarHomeMobile();
  } else {
    abrirCalendario();
  }
});

function _mostrarCarregando(sim) {
  let el = document.getElementById("loading-overlay");
  if (sim) {
    if (el) return;
    el = document.createElement("div");
    el.id = "loading-overlay";
    el.style.cssText = [
      "position:fixed","inset:0","z-index:99999",
      "background:#0f172a","display:flex","flex-direction:column",
      "align-items:center","justify-content:center","gap:12px",
      "color:#94a3b8","font-size:14px","font-family:inherit"
    ].join(";");
    el.innerHTML = `
      <div style="width:32px;height:32px;border:3px solid #334155;border-top-color:#0d9488;border-radius:50%;animation:spin 0.7s linear infinite"></div>
      <span>Carregando dados…</span>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  } else {
    el?.remove();
  }
}

// E-mails com privilégio de administrador
const _ADMINS = [
  "protarciso@gmail.com",
  "contato.tarciso@gmail.com",
  "tarciso@prof.educacao.sp.gov.br",
];

// Retorna turmas globais (TURMAS do aulas.js) que correspondem a uma lista de disciplinas
function _turmasParaDiscs(discs) {
  if (!discs || !discs.length) return [];
  const lower = discs.map(d => d.toLowerCase());
  return TURMAS.filter(t =>
    lower.some(d => (t.disciplina || "").toLowerCase().includes(d) || d.includes((t.disciplina||"").toLowerCase()))
  );
}

// ── MODO DEV (apenas localhost) ──────────────────────────────
const _DEV = (() => {
  if (!location.hostname.includes("localhost") && !location.hostname.includes("127.0.0.1")) return null;
  return localStorage.getItem("DEV_MODE");
})();
const _DEV_USERS = {
  admin:     { uid: "dev-admin",     email: "protarciso@gmail.com",    displayName: "Dev Admin" },
  professor: { uid: "dev-professor", email: "dev-prof@localhost.test", displayName: "Dev Professor" },
};

let _autenticado = false;
let _userAtual   = null;   // objeto firebase.User
let _dbDoc = null;

function _isAdmin(email) {
  return _ADMINS.includes(email || "");
}

// Retorna o papel do usuário logado: "admin"|"coordenador"|"professor"|null
function _papel() {
  if (!_perfilProf) return null;
  if (_isAdmin(_userAtual?.email)) return "admin";
  return _perfilProf.papel || "professor";
}
const _ehAdmin       = () => _papel() === "admin";
const _ehCoordenador = () => _papel() === "coordenador";
const _ehProfessor   = () => _papel() === "professor";
const _podeEscrever  = () => _papel() === "admin" || _papel() === "professor";

// Persistência offline inicializada uma única vez
let _offlineAtivo = false;
async function _ativarOffline() {
  if (_DEV) return;
  if (_offlineAtivo) return;
  _offlineAtivo = true;
  try {
    await firebase.firestore().enablePersistence({ synchronizeTabs: true });
    console.info("Firestore: persistência offline ativa");
  } catch(e) {
    if (e.code === "failed-precondition") {
      console.warn("Firestore offline: múltiplas abas — apenas uma sincroniza por vez");
    } else if (e.code === "unimplemented") {
      console.warn("Firestore offline: navegador não suporta persistência");
    }
  }
}

// Monitor de conexão — atualiza indicador e o flag global _online
let _online = navigator.onLine;
function _iniciarMonitorConexao() {
  const atualizar = (online) => {
    _online = online;
    _atualizarIndicadorConexao();
  };
  window.addEventListener("online",  () => atualizar(true));
  window.addEventListener("offline", () => atualizar(false));
}

function _atualizarIndicadorConexao() {
  let el = document.getElementById("conn-indicator");
  if (!el) {
    el = document.createElement("div");
    el.id = "conn-indicator";
    el.style.cssText = [
      "position:fixed","bottom:40px","right:16px","z-index:9998",
      "font-size:11px","padding:3px 10px","border-radius:20px",
      "pointer-events:none","transition:opacity 0.4s","opacity:0",
      "font-family:'DM Sans',sans-serif","font-weight:600"
    ].join(";");
    document.body.appendChild(el);
  }
  if (_online) {
    el.textContent = "🟢 Online";
    el.style.background = "#0f2a1e";
    el.style.color = "#4ade80";
    el.style.opacity = "1";
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = "0"; }, 2500);
  } else {
    el.textContent = "🔴 Offline — alterações salvas localmente";
    el.style.background = "#2a0f0f";
    el.style.color = "#f87171";
    el.style.opacity = "1";
    clearTimeout(el._timer); // mantém visível enquanto offline
  }
}

// Retorna o doc do diário do professor logado
function _initFirebase() {
  if (_DEV) return null;
  if (!_userAtual) return null;
  if (_dbDoc) return _dbDoc;
  try {
    const db = firebase.firestore();
    // Admins compartilham um único documento global; professores usam seu uid
    const docId = _isAdmin(_userAtual.email) ? "global" : _userAtual.uid;
    _dbDoc = db.collection("diario").doc(docId);
    return _dbDoc;
  } catch (e) {
    console.warn("Firebase não disponível, usando localStorage:", e);
    return null;
  }
}

// Retorna referência à coleção de professores
function _dbProfessores() {
  try { return firebase.firestore().collection("professores"); }
  catch { return null; }
}

// Retorna referência ao documento de configuração global (bimestres)
function _dbConfig() {
  try { return firebase.firestore().collection("config").doc("bimestres"); }
  catch { return null; }
}

function _dbConfigEscola() {
  try { return firebase.firestore().collection("config").doc("escola"); }
  catch { return null; }
}

async function _salvarBimestresFirestore() {
  if (!_isAdmin(_userAtual?.email)) return;
  const ref = _dbConfig();
  if (!ref) return;
  try {
    await ref.set({ bimestres: JSON.stringify(RT_BIMESTRES), _atualizado: new Date().toISOString() });
    _mostrarIndicadorSync("✓ Bimestres salvos");
  } catch(e) { console.error("Erro ao salvar bimestres:", e); }
}

async function _verificarSessao() {
  if (_DEV && _DEV_USERS[_DEV]) {
    _userAtual   = _DEV_USERS[_DEV];
    _autenticado = true;
    _dbDoc       = null;
    console.warn(`[DEV MODE] Logado como ${_DEV}: ${_userAtual.email}`);
    _atualizarBotaoAuth();
    return;
  }
  return new Promise(resolve => {
    try {
      firebase.auth().onAuthStateChanged(user => {
        _userAtual   = user;
        _autenticado = !!user;
        _dbDoc       = null; // resetar cache do doc ao trocar usuário
        _atualizarBotaoAuth();
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

// Verifica se o professor tem acesso aprovado (ou é admin).
// Retorna true se pode entrar, false se deve esperar/solicitar acesso.
async function _verificarAcessoProfessor() {
  if (_DEV && _DEV_USERS[_DEV]) {
    _perfilProf = {
      uid:         _userAtual.uid,
      email:       _userAtual.email,
      nome:        _userAtual.displayName,
      status:      "aprovado",
      papel:       _DEV === "admin" ? "admin" : "professor",
      disciplinas: _DEV === "professor" ? "Geografia" : "",
      area:        _DEV === "professor" ? "humanas" : "",
      escola:      "Escola Dev Local",
    };
    return true;
  }
  // Não logado: mostra tela de login e retorna false
  if (!_userAtual) {
    _renderizarTelaLogin();
    return false;
  }
  const email = _userAtual.email;
  // Admin: acesso imediato, cria/atualiza perfil como admin
  if (_isAdmin(email)) {
    _perfilProf = {
      uid: _userAtual.uid, email,
      nome: _userAtual.displayName || email.split("@")[0],
      escola: "Escola Estadual Profª Mathilde Teixeira de Moraes",
      status: "aprovado", papel: "admin",
    };
    await _salvarPerfilFirestore(_perfilProf);
    return true;
  }
  // Professor comum: checar status no Firestore
  try {
    const snap = await firebase.firestore()
      .collection("professores").doc(_userAtual.uid).get();
    if (snap.exists) {
      const d = snap.data();
      _perfilProf = { uid: _userAtual.uid, ...d };
      if (d.status === "aprovado") return true;
      if (d.status === "rejeitado") {
        _renderizarTelaRejeitado(d);
        return false;
      }
      // pendente
      _renderizarTelaAguardando(d);
      return false;
    } else {
      // Primeiro acesso: carrega config da escola antes de mostrar formulário
      try {
        const cfgSnap = await firebase.firestore().collection("config").doc("escola").get();
        if (cfgSnap.exists) {
          RT_CONFIG = { nomeEscola: "", disciplinasPorSerie: {}, ...cfgSnap.data() };
          if (typeof RT_CONFIG.disciplinasPorSerie === "string") {
            try { RT_CONFIG.disciplinasPorSerie = JSON.parse(RT_CONFIG.disciplinasPorSerie); } catch { RT_CONFIG.disciplinasPorSerie = {}; }
          }
        }
      } catch(e) { console.warn("Config escola indisponível no cadastro:", e); }
      _renderizarFormularioCadastro();
      return false;
    }
  } catch (e) {
    console.warn("Erro ao verificar acesso:", e);
    // Fallback: permite acesso se é e-mail permitido
    if (_ADMINS.includes(email)) return true;
    _renderizarTelaErroAcesso();
    return false;
  }
}

async function _salvarPerfilFirestore(perfil) {
  if (_DEV) return;
  try {
    await firebase.firestore()
      .collection("professores").doc(perfil.uid)
      .set(perfil, { merge: true });
  } catch (e) { console.warn("Erro ao salvar perfil:", e); }
}

// ── Telas de acesso ─────────────────────────────────────────

function _renderizarTelaLogin() {
  document.getElementById("conteudo-principal").innerHTML = "";
  // Reutiliza o modal de login existente
  setTimeout(_abrirModalGoogle, 300);
}

function _renderizarFormularioCadastro() {
  const main = document.getElementById("conteudo-principal");
  main.innerHTML = `
    <div class="acesso-tela">
      <div class="acesso-box">
        <div class="acesso-ico">👋</div>
        <h2 class="acesso-titulo">Bem-vindo ao Diário de Classe</h2>
        <p class="acesso-sub">Preencha seus dados para solicitar acesso. Um administrador aprovará seu cadastro em breve.</p>
        <div class="acesso-form">
          <label>Seu nome completo
            <input type="text" id="cad-nome" placeholder="Prof. João Silva"
              value="${_userAtual.displayName || ''}" />
          </label>
          <label style="opacity:.6;pointer-events:none;">Escola
            <input class="gi" value="${RT_CONFIG?.nomeEscola || ''}" readonly />
          </label>
          ${_htmlCheckboxMaterias("", "")}
        </div>
        <div class="acesso-email">📧 ${_userAtual.email}</div>
        <button class="acesso-btn-ok" onclick="_enviarPedidoAcesso()">Solicitar acesso</button>
        <button class="acesso-btn-sair" onclick="_logout()">Sair</button>
      </div>
    </div>`;
}

async function _enviarPedidoAcesso() {
  const nome = document.getElementById("cad-nome")?.value.trim();
  if (!nome) { alert("Informe seu nome."); return; }
  const disc     = _lerDisciplinasSelecionadas();
  const area     = document.getElementById("perf-area")?.value || "";
  const turmasIds = _lerTurmasSelecionadas();
  if (!disc) { alert("Selecione pelo menos uma disciplina."); return; }
  if (!turmasIds.length) { alert("Selecione pelo menos uma turma."); return; }
  const perfil = {
    uid: _userAtual.uid,
    email: _userAtual.email,
    nome,
    escola: RT_CONFIG?.nomeEscola || "",
    disciplinas: disc,
    area,
    turmasIds,
    status: "pendente",
    papel: "professor",
    solicitadoEm: new Date().toISOString(),
  };
  try {
    await firebase.firestore()
      .collection("professores").doc(_userAtual.uid).set(perfil);
    _perfilProf = perfil;
    _renderizarTelaAguardando(perfil);
  } catch (e) {
    alert("Erro ao enviar pedido. Tente novamente.");
    console.error(e);
  }
}

function _renderizarTelaAguardando(perfil) {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="acesso-tela">
      <div class="acesso-box">
        <div class="acesso-ico">⏳</div>
        <h2 class="acesso-titulo">Aguardando aprovação</h2>
        <p class="acesso-sub">Olá, <strong>${perfil.nome || perfil.email}</strong>! Seu pedido de acesso foi recebido e está aguardando aprovação de um administrador.</p>
        <div class="acesso-email">📧 ${perfil.email}</div>
        <button class="acesso-btn-sair" onclick="_logout()">Sair</button>
      </div>
    </div>`;
}

function _renderizarTelaRejeitado(perfil) {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="acesso-tela">
      <div class="acesso-box">
        <div class="acesso-ico">❌</div>
        <h2 class="acesso-titulo">Acesso não autorizado</h2>
        <p class="acesso-sub">Seu pedido de acesso foi recusado. Entre em contato com o administrador do sistema.</p>
        <div class="acesso-email">📧 ${perfil.email}</div>
        <button class="acesso-btn-sair" onclick="_logout()">Sair</button>
      </div>
    </div>`;
}

function _renderizarTelaErroAcesso() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="acesso-tela">
      <div class="acesso-box">
        <div class="acesso-ico">⚠️</div>
        <h2 class="acesso-titulo">Erro de conexão</h2>
        <p class="acesso-sub">Não foi possível verificar seu acesso. Verifique sua conexão e tente novamente.</p>
        <button class="acesso-btn-ok" onclick="location.reload()">Tentar novamente</button>
        <button class="acesso-btn-sair" onclick="_logout()">Sair</button>
      </div>
    </div>`;
}

async function _loginGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await firebase.auth().signInWithPopup(provider);
    _userAtual   = result.user;
    _autenticado = true;
    _dbDoc       = null;
    _atualizarBotaoAuth();
    document.getElementById("google-modal")?.remove();
    _mostrarIndicadorSync("🔓 Autenticado");
    // Verifica acesso e carrega o sistema
    _mostrarCarregando(true);
    const ok = await _verificarAcessoProfessor();
    if (ok) {
      await carregarTudo();
      _mostrarCarregando(false);
      renderizarSidebar();
      _atualizarTagline();
      iniciarTooltips();
      _initClickFora();
      if (window.innerWidth <= 860) renderizarHomeMobile();
      else abrirCalendario();
    } else {
      _mostrarCarregando(false);
    }
  } catch (e) {
    console.error("Erro no login Google:", e);
    const btn = document.getElementById("google-btn");
    if (btn) {
      btn.textContent = "Tente novamente";
      btn.style.background = "#7f1d1d";
      setTimeout(() => {
        btn.textContent = "Entrar com Google";
        btn.style.background = "#fff";
      }, 2000);
    }
  }
}

async function _logout() {
  try { await firebase.auth().signOut(); } catch {}
  _autenticado = false;
  _userAtual   = null;
  _dbDoc       = null;
  _perfilProf  = null;
  _atualizarBotaoAuth();
  _mostrarIndicadorSync("🔒 Sessão encerrada");
  setTimeout(() => location.reload(), 800);
}

function _atualizarBotaoAuth() {
  let btn = document.getElementById("auth-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "auth-btn";
    const header = document.querySelector(".app-header");
    if (header) header.appendChild(btn);
    else document.body.appendChild(btn);
  }
  if (_autenticado && _userAtual) {
    const nome   = _perfilProf?.nome || _userAtual.displayName || _userAtual.email.split("@")[0];
    const papelLabels = { admin:"Admin", coordenador:"Coord.", professor:"Prof." };
    const papelBadge  = papelLabels[_papel()] ? ` [${papelLabels[_papel()]}]` : "";
    btn.textContent = nome + papelBadge + " · Sair";
    btn.classList.add("logado");
    btn.onclick = () => { if (confirm("Encerrar sessão?")) _logout(); };
  } else {
    btn.textContent = "Login";
    btn.classList.remove("logado");
    btn.onclick = _abrirModalGoogle;
  }
}

function _exigirAuth(fn) {
  if (_autenticado) { fn(); } else { _abrirModalGoogle(); }
}

function _abrirModalGoogle() {
  if (document.getElementById("google-modal")) return;
  const overlay = document.createElement("div");
  overlay.id = "google-modal";
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:99998",
    "background:rgba(0,0,0,0.75)","display:flex",
    "align-items:center","justify-content:center"
  ].join(";");
  overlay.innerHTML = `
    <div id="google-modal-box" style="
      background:#1e293b; border-radius:16px; padding:40px 36px;
      display:flex; flex-direction:column; align-items:center; gap:24px;
      box-shadow:0 20px 60px rgba(0,0,0,0.6); min-width:280px; max-width:320px;
      position:relative;
    ">
      <button onclick="document.getElementById('google-modal').remove()" style="
        position:absolute; top:12px; right:14px;
        background:transparent; border:none; color:#475569;
        font-size:18px; cursor:pointer; line-height:1; padding:4px;
        transition:color .15s;
      " onmouseenter="this.style.color='#94a3b8'" onmouseleave="this.style.color='#475569'"
      title="Fechar">✕</button>
      <div style="font-size:36px">📋</div>
      <div style="color:#e2e8f0; font-size:16px; font-weight:600; text-align:center; line-height:1.4;">
        Diário de Classe
      </div>
      <div style="color:#64748b; font-size:13px; text-align:center; line-height:1.6;">
        Faça login para acessar<br>e editar o diário
      </div>
      <button id="google-btn" onclick="_loginGoogle()" style="
        display:flex; align-items:center; gap:12px;
        background:#fff; color:#1e293b; border:none; border-radius:8px;
        padding:12px 20px; font-size:14px; font-weight:600;
        cursor:pointer; width:100%; justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:opacity 0.15s;
        font-family:inherit;
      "
      onmouseenter="this.style.opacity='0.9'"
      onmouseleave="this.style.opacity='1'"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Entrar com Google
      </button>
    </div>
  `;
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

let _saveTimer = null;
function salvarTudo() {
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  // Cache local de inicialização rápida (não é fonte de verdade)
  try {
    localStorage.setItem(`aulaEstado_${uid}`,    JSON.stringify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uid}`,     JSON.stringify(ordemConteudos));
    localStorage.setItem(`aulaEventuais_${uid}`, JSON.stringify(linhasEventuais));
    localStorage.setItem(`RT_CONTEUDOS_${uid}`,  JSON.stringify(RT_CONTEUDOS));
    localStorage.setItem(`RT_TURMAS_${uid}`,     JSON.stringify(RT_TURMAS));
  } catch(e) { console.warn("localStorage cheio ou indisponível:", e); }
  // Persistência principal: Firestore (com suporte offline nativo)
  // Debounce de 800 ms para agrupar alterações rápidas em uma única escrita
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _salvarFirestore(), 800);
}

async function _salvarFirestore() {
  const doc = _initFirebase();
  if (!doc) return;
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const payload = {
    aulaEstado:    JSON.stringify(estadoAulas),
    aulaOrdem:     JSON.stringify(ordemConteudos),
    aulaEventuais: JSON.stringify(linhasEventuais),
    RT_CONTEUDOS:  JSON.stringify(RT_CONTEUDOS),
    RT_TURMAS:     JSON.stringify(RT_TURMAS),
    _atualizado:   new Date().toISOString(),
  };
  try {
    await doc.set(payload);
    _mostrarIndicadorSync("✓ Salvo");
  } catch (e) {
    if (!_online) {
      // Offline: o SDK já enfileirou a escrita — vai sincronizar quando voltar
      _mostrarIndicadorSync("💾 Salvo localmente — pendente de sincronização");
    } else {
      console.error("Erro ao salvar no Firestore:", e);
      _mostrarIndicadorSync("⚠ Erro ao salvar — verifique a conexão");
      // Fallback de emergência: persiste no localStorage caso Firestore falhe online
      _salvarLocalStorageEmergencia();
    }
  }
}

// Fallback de emergência — usado apenas quando o Firestore falha com conexão ativa
function _salvarLocalStorageEmergencia() {
  try {
    const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
    const bkp = {
      aulaEstado:    JSON.stringify(estadoAulas),
      aulaOrdem:     JSON.stringify(ordemConteudos),
      aulaEventuais: JSON.stringify(linhasEventuais),
      RT_CONTEUDOS:  JSON.stringify(RT_CONTEUDOS),
      RT_TURMAS:     JSON.stringify(RT_TURMAS),
      _salvoEm:      new Date().toISOString(),
    };
    localStorage.setItem(`_emergencia_${uid}`, JSON.stringify(bkp));
    console.warn("Backup de emergência salvo no localStorage:", bkp._salvoEm);
  } catch(e) { console.error("Falha até no backup de emergência:", e); }
}

// Restaura backup de emergência se existir e for mais recente que o Firestore
function _restaurarEmergenciaSeNecessario(dadosFirestore) {
  try {
    const uid  = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
    const raw  = localStorage.getItem(`_emergencia_${uid}`);
    if (!raw) return false;
    const bkp  = JSON.parse(raw);
    const tBkp = bkp._salvoEm ? new Date(bkp._salvoEm) : new Date(0);
    const tFs  = dadosFirestore?._atualizado ? new Date(dadosFirestore._atualizado) : new Date(0);
    if (tBkp > tFs) {
      console.warn("Backup de emergência é mais recente — restaurando:", bkp._salvoEm);
      try { estadoAulas     = JSON.parse(bkp.aulaEstado)    || estadoAulas;    } catch {}
      try { ordemConteudos  = JSON.parse(bkp.aulaOrdem)     || ordemConteudos; } catch {}
      try { linhasEventuais = JSON.parse(bkp.aulaEventuais) || linhasEventuais;} catch {}
      try { const rc = JSON.parse(bkp.RT_CONTEUDOS); if (rc) RT_CONTEUDOS = rc; } catch {}
      try { const rt = JSON.parse(bkp.RT_TURMAS); if (Array.isArray(rt)) RT_TURMAS = rt; } catch {}
      _mostrarIndicadorSync("⚠ Dados restaurados do backup local");
      // Reenvia para o Firestore para reconciliar
      setTimeout(() => _salvarFirestore(), 1500);
      return true;
    }
    return false;
  } catch(e) { return false; }
}

let _syncEl = null;
function _mostrarIndicadorSync(texto) {
  if (!_syncEl) {
    _syncEl = document.createElement("div");
    _syncEl.id = "sync-indicator";
    _syncEl.style.cssText = [
      "position:fixed","bottom:16px","right:16px","z-index:9999",
      "background:#1e293b","color:#94a3b8","font-size:11px",
      "padding:4px 10px","border-radius:20px","pointer-events:none",
      "opacity:0","transition:opacity 0.3s"
    ].join(";");
    document.body.appendChild(_syncEl);
  }
  _syncEl.textContent = texto;
  _syncEl.style.opacity = "1";
  clearTimeout(_syncEl._timer);
  _syncEl._timer = setTimeout(() => { _syncEl.style.opacity = "0"; }, 2500);
}

const PERIODOS_PADRAO = [
  { aula:"a1", label:"1ª aula", inicio:"07:00", fim:"07:50" },
  { aula:"a2", label:"2ª aula", inicio:"07:50", fim:"08:40" },
  { aula:"a3", label:"3ª aula", inicio:"08:40", fim:"09:30" },
  { aula:"a4", label:"4ª aula", inicio:"09:50", fim:"10:40" },
  { aula:"a5", label:"5ª aula", inicio:"10:40", fim:"11:30" },
  { aula:"a6", label:"6ª aula", inicio:"19:00", fim:"19:50" },
  { aula:"a7", label:"7ª aula", inicio:"19:50", fim:"20:40" },
  { aula:"a8", label:"8ª aula", inicio:"20:40", fim:"21:30" },
];

async function carregarTudo() {
  RT_BIMESTRES = JSON.parse(JSON.stringify(BIMESTRES));
  // Professor começa com lista vazia — só vê as turmas que ele mesmo criou (no Firestore)
  // Admin herda TURMAS do aulas.js como ponto de partida
  RT_TURMAS    = _isAdmin(_userAtual?.email)
    ? JSON.parse(JSON.stringify(TURMAS))
    : [];
  RT_CONTEUDOS = JSON.parse(JSON.stringify(CONTEUDOS));
  RT_PERIODOS  = JSON.parse(JSON.stringify(
    typeof PERIODOS !== "undefined" ? PERIODOS : PERIODOS_PADRAO
  ));

  // DEV: pula todas as leituras do Firestore
  if (_DEV) {
    _ativarListenerFirestore();
    return;
  }

  // Carrega bimestres globais do Firestore (compartilhados entre todos)
  try {
    const cfgSnap = await _dbConfig().get();
    if (cfgSnap.exists && cfgSnap.data().bimestres) {
      const bim = JSON.parse(cfgSnap.data().bimestres);
      if (Array.isArray(bim) && bim.length) RT_BIMESTRES = bim;
    }
  } catch(e) { console.warn("Bimestres globais indisponíveis, usando padrão:", e); }

  // Carrega configuração global da escola (nome e lista de matérias)
  try {
    const escolaSnap = await _dbConfigEscola().get();
    if (escolaSnap.exists) {
      const d = escolaSnap.data();
      RT_CONFIG = { nomeEscola: "", disciplinasPorSerie: {}, ...d };
      if (typeof RT_CONFIG.disciplinasPorSerie === "string") {
        try { RT_CONFIG.disciplinasPorSerie = JSON.parse(RT_CONFIG.disciplinasPorSerie); } catch { RT_CONFIG.disciplinasPorSerie = {}; }
      }
    }
  } catch(e) { console.warn("Config escola indisponível:", e); }

  // Chave de cache isolada por UID para evitar colisão entre professores
  const uidKey = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  const seedKey = `_aulasSeed_${uidKey}`;
  const doc = _initFirebase();
  if (doc) {
    try {
      const snap = await doc.get();
      if (snap.exists) {
        const d = snap.data();
        // Sincroniza cache local com Firestore
        if (d.aulaEstado)    localStorage.setItem(`aulaEstado_${uidKey}`,    d.aulaEstado);
        if (d.aulaOrdem)     localStorage.setItem(`aulaOrdem_${uidKey}`,     d.aulaOrdem);
        if (d.aulaEventuais) localStorage.setItem(`aulaEventuais_${uidKey}`, d.aulaEventuais);
        if (d.RT_CONTEUDOS)  localStorage.setItem(`RT_CONTEUDOS_${uidKey}`,  d.RT_CONTEUDOS);
        if (d.RT_TURMAS)     localStorage.setItem(`RT_TURMAS_${uidKey}`,     d.RT_TURMAS);
        localStorage.setItem(seedKey, "1");
        // Aplica dados do Firestore nas variáveis em memória antes de checar emergência
        try { estadoAulas     = JSON.parse(d.aulaEstado)    || {}; } catch {}
        try { ordemConteudos  = JSON.parse(d.aulaOrdem)     || {}; } catch {}
        try { linhasEventuais = JSON.parse(d.aulaEventuais) || {}; } catch {}
        try { const rc = JSON.parse(d.RT_CONTEUDOS); if (rc) RT_CONTEUDOS = rc; } catch {}
        try { const rt = JSON.parse(d.RT_TURMAS); if (Array.isArray(rt)) RT_TURMAS = rt; } catch {}
        // Verifica se há backup de emergência mais recente
        _restaurarEmergenciaSeNecessario(d);
      }
    } catch (e) {
      console.warn("Firestore inacessível (offline?), usando cache local:", e);
    }
  }
  try { estadoAulas     = JSON.parse(localStorage.getItem(`aulaEstado_${uidKey}`))    || {}; } catch { estadoAulas = {}; }
  try { ordemConteudos  = JSON.parse(localStorage.getItem(`aulaOrdem_${uidKey}`))     || {}; } catch { ordemConteudos = {}; }
  try { linhasEventuais = JSON.parse(localStorage.getItem(`aulaEventuais_${uidKey}`)) || {}; } catch { linhasEventuais = {}; }
  try {
    const rc = JSON.parse(localStorage.getItem(`RT_CONTEUDOS_${uidKey}`));
    if (rc && typeof rc === "object") RT_CONTEUDOS = rc;
  } catch {}
  try {
    const rt = JSON.parse(localStorage.getItem(`RT_TURMAS_${uidKey}`));
    if (Array.isArray(rt) && rt.length) RT_TURMAS = rt;
  } catch {}
  if (!localStorage.getItem(seedKey)) {
    if (typeof ESTADO !== "undefined" && Object.keys(ESTADO).length > 0)
      estadoAulas = Object.assign({}, ESTADO, estadoAulas);
    if (typeof ORDEM !== "undefined" && Object.keys(ORDEM).length > 0)
      ordemConteudos = Object.assign({}, ORDEM, ordemConteudos);
    localStorage.setItem(seedKey, "1");
    localStorage.setItem(`aulaEstado_${uidKey}`, JSON.stringify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uidKey}`,  JSON.stringify(ordemConteudos));
  }
  // Professor: garante que RT_TURMAS só contém as turmas dele
  // (sanitiza dados legados que possam ter sido salvos com turmas de outros)
  if (!_isAdmin(_userAtual?.email) && !_ehCoordenador()) {
    const uid = _userAtual?.uid;
    RT_TURMAS = RT_TURMAS.filter(t => !t.profUid || t.profUid === uid);
  }

  // Coordenador: pré-carrega diários dos professores associados (somente leitura)
  if (_ehCoordenador() && Array.isArray(_perfilProf?.professoresAssociados)) {
    await _carregarDiariosAssociados(_perfilProf.professoresAssociados);
  }
  _ativarListenerFirestore();
}

// Diários dos professores associados ao coordenador (somente leitura)
// Estrutura: { uid: { perfil, estadoAulas, ordemConteudos, linhasEventuais, RT_CONTEUDOS, RT_TURMAS } }
let _diariosAssociados = {};

async function _carregarDiariosAssociados(uids) {
  _diariosAssociados = {};
  for (const uid of uids) {
    try {
      const [dSnap, pSnap] = await Promise.all([
        firebase.firestore().collection("diario").doc(uid).get(),
        firebase.firestore().collection("professores").doc(uid).get(),
      ]);
      if (!dSnap.exists) continue;
      const d = dSnap.data();
      _diariosAssociados[uid] = {
        perfil:          pSnap.exists ? pSnap.data() : { uid },
        estadoAulas:     d.aulaEstado    ? JSON.parse(d.aulaEstado)    : {},
        ordemConteudos:  d.aulaOrdem     ? JSON.parse(d.aulaOrdem)     : {},
        linhasEventuais: d.aulaEventuais ? JSON.parse(d.aulaEventuais) : {},
        RT_CONTEUDOS:    d.RT_CONTEUDOS  ? JSON.parse(d.RT_CONTEUDOS)  : {},
        RT_TURMAS:       d.RT_TURMAS     ? JSON.parse(d.RT_TURMAS)     : [],
      };
    } catch(e) { console.warn(`Erro ao carregar diário ${uid}:`, e); }
  }
}

let _listenerAtivo = false;
let _listenerBimAtivo = false;
function _ativarListenerFirestore() {
  if (_listenerAtivo) return;
  const doc = _initFirebase();
  if (!doc) return;
  _listenerAtivo = true;
  let _primeiroSnap = true;
  doc.onSnapshot(snap => {
    if (_primeiroSnap) { _primeiroSnap = false; return; }
    if (!snap.exists) return;
    const d = snap.data();
    const atualizado = d._atualizado ? new Date(d._atualizado) : null;
    if (atualizado && (new Date() - atualizado) < 2000) return;
    try { estadoAulas     = JSON.parse(d.aulaEstado)    || estadoAulas;    } catch {}
    try { ordemConteudos  = JSON.parse(d.aulaOrdem)     || ordemConteudos; } catch {}
    try { linhasEventuais = JSON.parse(d.aulaEventuais) || linhasEventuais;} catch {}
    try { const rc = JSON.parse(d.RT_CONTEUDOS); if (rc) RT_CONTEUDOS = rc; } catch {}
    try { const rt = JSON.parse(d.RT_TURMAS);    if (Array.isArray(rt) && rt.length) RT_TURMAS = rt; } catch {}
    const _uk = _userAtual?.uid || "anonimo";
    if (d.aulaEstado)    localStorage.setItem(`aulaEstado_${_uk}`,    d.aulaEstado);
    if (d.aulaOrdem)     localStorage.setItem(`aulaOrdem_${_uk}`,     d.aulaOrdem);
    if (d.aulaEventuais) localStorage.setItem(`aulaEventuais_${_uk}`, d.aulaEventuais);
    if (d.RT_CONTEUDOS)  localStorage.setItem(`RT_CONTEUDOS_${_uk}`,  d.RT_CONTEUDOS);
    if (d.RT_TURMAS)     localStorage.setItem(`RT_TURMAS_${_uk}`,     d.RT_TURMAS);
    // Limpa backup de emergência após sincronização bem-sucedida
    try { localStorage.removeItem(`_emergencia_${_uk}`); } catch {}
    // Atualiza a view ativa (cronograma ou calendário)
    const calVisivel = !!document.getElementById("cal-corpo");
    if (calVisivel && typeof _calRenderCorpo === "function") _calRenderCorpo();
    if (turmaAtiva && !calVisivel) renderizarConteudo();
    _mostrarIndicadorSync("↓ Sincronizado");
  }, err => console.warn("onSnapshot erro:", err));

  // Listener separado para bimestres globais (atualiza em tempo real para todos)
  if (!_listenerBimAtivo) {
    _listenerBimAtivo = true;
    const cfg = _dbConfig();
    if (!cfg) return;
    let _primeiroBimSnap = true;
    cfg.onSnapshot(snap => {
      if (_primeiroBimSnap) { _primeiroBimSnap = false; return; }
      if (!snap.exists) return;
      try {
        const bim = JSON.parse(snap.data().bimestres);
        if (Array.isArray(bim) && bim.length) {
          RT_BIMESTRES = bim;
          if (turmaAtiva) renderizarConteudo();
          _mostrarIndicadorSync("↓ Bimestres atualizados");
        }
      } catch {}
    }, err => console.warn("onSnapshot bimestres erro:", err));
  }
}

function chaveSlot(turmaId, bim, slotId) { return `${turmaId}_b${bim}_s${slotId}`; }
function chaveOrdem(turmaId, bim)         { return `${turmaId}_b${bim}`; }
function chaveEventuais(turmaId, bim)     { return `${turmaId}_b${bim}`; }

function getOrdem(turmaId, bim, total) {
  const k = chaveOrdem(turmaId, bim);
  if (ordemConteudos[k]?.length === total) return [...ordemConteudos[k]];
  return Array.from({length: total}, (_, i) => i);
}

function salvarOrdem(ordem) {
  ordemConteudos[chaveOrdem(turmaAtiva.id, bimestreAtivo)] = ordem;
  salvarTudo();
}

function getEventuais(turmaId, bim) {
  return linhasEventuais[chaveEventuais(turmaId, bim)] || [];
}

function salvarEventuais(lista) {
  linhasEventuais[chaveEventuais(turmaAtiva.id, bimestreAtivo)] = lista;
  salvarTudo();
}

function resolverPeriodo(aulaKey) {
  const p = RT_PERIODOS.find(p => p.aula === aulaKey);
  if (p && p.inicio) return p;
  return { aula: aulaKey, label: aulaKey, inicio: "00:00", fim: "00:00" };
}

function fmtPeriodo(aulaKey) {
  const p = resolverPeriodo(aulaKey);
  return p.fim ? `${p.label} · ${p.inicio}–${p.fim}` : p.inicio;
}

function gerarSlots(horarios, bimObj) {
  const inicio = new Date(bimObj.inicio + "T00:00:00");
  const fim    = new Date(bimObj.fim    + "T00:00:00");
  const slots  = [];
  const cur    = new Date(inicio);
  while (cur <= fim) {
    for (const h of horarios) {
      if (cur.getDay() === h.diaSemana) {
        const periodo = resolverPeriodo(h.aula);
        slots.push({
          data: cur.toISOString().split("T")[0],
          aula: h.aula,
          inicio: periodo.inicio,
          fim: periodo.fim,
          label: periodo.label,
          eventual: false,
        });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  slots.sort((a,b) => (a.data||"").localeCompare(b.data||"") || (a.inicio||"").localeCompare(b.inicio||""));
  return slots;
}

function getSlotsCompletos(turmaId, bim) {
  const t      = RT_TURMAS.find(x => x.id === turmaId);
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bim);
  if (!t || !bimObj) return [];
  const regulares = gerarSlots(t.horarios, bimObj).map((s, i) => ({ ...s, slotId: `r${i}` }));
  const eventuais = getEventuais(turmaId, bim).map(e => ({
    data: e.data, aula: null, inicio: e.hora, fim: "", label: e.hora,
    eventual: true, descricao: e.descricao, slotId: `e${e.id}`
  }));
  return [...regulares, ...eventuais]
    .sort((a,b) => (a.data||"").localeCompare(b.data||"") || (a.inicio||"").localeCompare(b.inicio||""));
}

const NOMES_MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DIAS_SEM  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function fmtData(iso) {
  if (!iso) return "—";
  const [a,m,d] = iso.split("-");
  return `${d}/${NOMES_MES[+m-1]}/${a}`;
}

function fmtSlotData(slot) {
  if (!slot.data) return "—";
  const dt     = new Date(slot.data + "T00:00:00");
  const linha1 = `${DIAS_SEM[dt.getDay()]} · ${fmtData(slot.data)}`;
  if (slot.eventual) {
    return `<span class="data-linha1">${linha1}</span><span class="data-linha2">${slot.inicio}</span>`;
  }
  const linha2 = `${slot.label} · ${slot.inicio}–${slot.fim}`;
  return `<span class="data-linha1">${linha1}</span><span class="data-linha2">${linha2}</span>`;
}

function hoje() { return new Date().toISOString().split("T")[0]; }

const TOOLTIPS_COLUNAS = {
  "th-numero":    "Número sequencial da aula no bimestre.",
  "th-data":      "Data e horário previstos para a aula, conforme calendário.",
  "th-conteudo":  "Conteúdo ou atividade prevista. Clique para editar. Arraste o ícone ⠿ para reorganizar. Selecione múltiplos com Ctrl+clique no ícone.",
  "th-chamada":   "Marque quando a chamada for realizada nesta aula.",
  "th-entregue":  "Marque quando o material ou atividade tiver sido entregue/distribuído aos alunos.",
  "th-dada":      "Marque quando a aula tiver sido efetivamente ministrada.",
  "th-registro":  "Data em que a aula foi marcada como dada.",
};

function iniciarTooltips() {
  document.body.addEventListener("mouseover", e => {
    const th = e.target.closest("th[data-tip]");
    if (!th) return;
    mostrarTooltip(th, th.dataset.tip);
  });
  document.body.addEventListener("mouseout", e => {
    if (e.target.closest("th[data-tip]")) esconderTooltip();
  });
}

let tooltipEl = null;
function mostrarTooltip(anchor, texto) {
  esconderTooltip();
  tooltipEl = document.createElement("div");
  tooltipEl.className = "col-tooltip";
  tooltipEl.textContent = texto;
  document.body.appendChild(tooltipEl);
  const r = anchor.getBoundingClientRect();
  tooltipEl.style.left = `${r.left + window.scrollX}px`;
  tooltipEl.style.top  = `${r.bottom + window.scrollY + 6}px`;
}

function esconderTooltip() {
  tooltipEl?.remove();
  tooltipEl = null;
}

function _atualizarTagline() {
  const el = document.getElementById("header-tagline");
  if (!el) return;
  const escola = RT_CONFIG?.nomeEscola || _perfilProf?.escola || "";
  const nome   = _perfilProf?.nome
    || (_userAtual ? (_userAtual.displayName || _userAtual.email.split("@")[0]) : "");
  const papel  = _papel();
  const prefix = papel === "coordenador" ? "Coord." : "Prof.";
  const nomeFmt  = nome ? `${prefix} ${nome}` : "";
  const ano      = new Date().getFullYear();
  // Coordenador: mostra área/papel; professor: mostra disciplinas
  const disciplinas = papel === "coordenador"
    ? "Coordenador(a)"
    : (_perfilProf?.disciplinas || "");
  el.innerHTML = [escola, [nomeFmt, ano].filter(Boolean).join(" — "), disciplinas]
    .filter(Boolean).map(l => `<span>${l}</span>`).join("");
}

function _turmasVisiveis() {
  if (_isAdmin(_userAtual?.email)) return RT_TURMAS;
  const uid  = _userAtual?.uid;
  // Turmas próprias do professor (criadas por ele)
  const proprias = RT_TURMAS.filter(t => t.profUid === uid);
  if (proprias.length) return proprias;
  // Professor sem turmas próprias: vê as turmas cuja disciplina ele leciona
  const discProf = (_perfilProf?.disciplinas || "")
    .split(";").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!discProf.length) return [];
  return RT_TURMAS.filter(t =>
    discProf.some(d => (t.disciplina || "").toLowerCase().includes(d) || d.includes((t.disciplina || "").toLowerCase()))
  );
}

function renderizarSidebar() {
  const container = document.getElementById("sidebar-turmas");
  container.innerHTML = "";
  const porSerie = {};
  for (const t of _turmasVisiveis()) {
    if (!porSerie[t.serie]) porSerie[t.serie] = {};
    const chTurma = `${t.turma}${t.subtitulo ? " "+t.subtitulo : ""}`;
    if (!porSerie[t.serie][chTurma]) porSerie[t.serie][chTurma] = [];
    porSerie[t.serie][chTurma].push(t);
  }
  for (const serie of Object.keys(porSerie).sort()) {
    const grpSerie = document.createElement("div");
    grpSerie.className = "sidebar-grupo";
    grpSerie.innerHTML = `<div class="sidebar-grupo-titulo">${serie}ª Série</div>`;
    const turmasObj = porSerie[serie];
    for (const chTurma of Object.keys(turmasObj).sort()) {
      const disciplinas = turmasObj[chTurma];
      if (disciplinas.length === 1) {
        const t = disciplinas[0];
        const label = t.subtitulo ? `${t.serie}ª ${t.turma} ${t.subtitulo}` : `${t.serie}ª ${t.turma}`;
        const btn = document.createElement("button");
        btn.className = "sidebar-btn";
        btn.dataset.id = t.id;
        btn.innerHTML = `<span class="sidebar-btn-label">${label}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
        btn.onclick = () => selecionarTurma(t.id);
        grpSerie.appendChild(btn);
      } else {
        const label = disciplinas[0].subtitulo
          ? `${disciplinas[0].serie}ª ${disciplinas[0].turma} ${disciplinas[0].subtitulo}`
          : `${disciplinas[0].serie}ª ${disciplinas[0].turma}`;
        const wrap = document.createElement("div");
        wrap.className = "sidebar-turma-grupo";
        wrap.innerHTML = `<div class="sidebar-turma-label">${label}</div>`;
        for (const t of disciplinas) {
          const btn = document.createElement("button");
          btn.className = "sidebar-btn sidebar-btn-sub";
          btn.dataset.id = t.id;
          btn.innerHTML = `<span class="sidebar-btn-label">${t.disciplina}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
          btn.onclick = () => selecionarTurma(t.id);
          wrap.appendChild(btn);
        }
        grpSerie.appendChild(wrap);
      }
    }
    container.appendChild(grpSerie);
  }
  const btnGestao = document.getElementById("btn-gestao");
  if (btnGestao) btnGestao.onclick = abrirPainelGestao;
  _renderizarMobileNav();
}

function _renderizarMobileNav() {
  const wrap = document.getElementById("mob-nav-turmas");
  if (!wrap) return;
  wrap.innerHTML = "";
  const porSerie = {};
  for (const t of _turmasVisiveis()) {
    if (!porSerie[t.serie]) porSerie[t.serie] = [];
    porSerie[t.serie].push(t);
  }
  for (const serie of Object.keys(porSerie).sort()) {
    const grp = document.createElement("div");
    grp.className = "mob-grp";
    const hdr = document.createElement("button");
    hdr.className = "mob-grp-header";
    hdr.innerHTML = `<span>${serie}ª Série</span><span class="mob-grp-arrow">▾</span>`;
    hdr.onclick = () => {
      const aberto = grp.classList.toggle("aberto");
      hdr.querySelector(".mob-grp-arrow").textContent = aberto ? "▴" : "▾";
    };
    const lista = document.createElement("div");
    lista.className = "mob-grp-lista";
    for (const t of porSerie[serie]) {
      const btn = document.createElement("button");
      btn.className = "mob-turma-btn";
      btn.dataset.id = t.id;
      const nome = `${t.serie}ª ${t.turma}${t.subtitulo ? " " + t.subtitulo : ""}`;
      btn.innerHTML = `<span>${nome}</span><span class="mob-turma-sigla">${t.sigla}</span>`;
      btn.onclick = () => { fecharMobileNav(); selecionarTurma(t.id); };
      lista.appendChild(btn);
    }
    grp.appendChild(hdr);
    grp.appendChild(lista);
    wrap.appendChild(grp);
  }
}

// Usa "inert" em vez de "aria-hidden" para evitar:
// "Blocked aria-hidden on a focused element"
function toggleMobileNav() {
  const nav     = document.getElementById("mob-nav");
  const overlay = document.getElementById("mob-nav-overlay");
  const aberto  = nav.classList.toggle("aberta");
  if (aberto) { nav.removeAttribute("inert"); } else { nav.setAttribute("inert", ""); }
  overlay.classList.toggle("visivel", aberto);
  document.getElementById("btn-hamburger")?.classList.toggle("aberto", aberto);
}

function fecharMobileNav() {
  const nav     = document.getElementById("mob-nav");
  const overlay = document.getElementById("mob-nav-overlay");
  nav?.classList.remove("aberta");
  nav?.setAttribute("inert", "");
  overlay?.classList.remove("visivel");
  document.getElementById("btn-hamburger")?.classList.remove("aberto");
}

function selecionarTurma(id) {
  turmaAtiva = RT_TURMAS.find(t => t.id === id);
  if (!turmaAtiva) return;
  selConteudos.clear();
  document.querySelectorAll(".sidebar-btn, .mob-turma-btn").forEach(b => b.classList.toggle("ativo", b.dataset.id === id));
  const h = hoje();
  const v = RT_BIMESTRES.find(b => h >= b.inicio && h <= b.fim);
  bimestreAtivo = v ? v.bimestre : 1;
  renderizarConteudo();
}

function renderizarBemVindo() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="bem-vindo">
      <div class="bem-vindo-icon">📋</div>
      <h2>Diário de Classe</h2>
      <p>Selecione uma turma na barra lateral para visualizar<br>o planejamento e registrar as aulas dadas.</p>
    </div>`;
}

function renderizarConteudo() {
  const t = turmaAtiva;
  const main = document.getElementById("conteudo-principal");
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bimestreAtivo);
  const slots  = getSlotsCompletos(t.id, bimestreAtivo);
  const total  = slots.length;
  const labelTurma = t.subtitulo ? `${t.serie}ª Série ${t.turma} — ${t.subtitulo}` : `${t.serie}ª Série ${t.turma}`;
  let feitas = 0, totalReg = 0;
  for (const s of slots) {
    if (!s.eventual) { totalReg++; if (estadoAulas[chaveSlot(t.id,bimestreAtivo,s.slotId)]?.feita) feitas++; }
  }
  const pct = totalReg > 0 ? Math.round(feitas/totalReg*100) : 0;
  const tabsBim = RT_BIMESTRES.map(b => `
    <button class="tab-bim ${b.bimestre===bimestreAtivo?"ativo":""}" onclick="mudarBimestre(${b.bimestre})">${b.label}</button>`).join("");
  main.innerHTML = `
    <div class="header-turma">
      <div class="header-turma-info">
        <div class="header-turma-badge">${t.sigla}</div>
        <div>
          <h1 class="header-turma-nome">Cronograma — ${labelTurma}</h1>
          <p class="header-turma-disc">${t.disciplina}</p>
        </div>
      </div>
      <div class="stat-circulo">
        <svg viewBox="0 0 36 36" class="stat-svg">
          <path class="stat-bg"   d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="stat-prog" stroke-dasharray="${pct},100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="stat-texto">
          <span class="stat-num">${feitas}/${totalReg}</span>
          <span class="stat-label">aulas dadas</span>
        </div>
      </div>
    </div>
    <div class="tabs-bimestre">${tabsBim}</div>
    <div class="bimestre-info">
      <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
      <div class="bimestre-info-right">
        <span class="hint-drag">✎ Clique no conteúdo para editar &nbsp;·&nbsp; ⠿ Clique para selecionar · Shift+⠿ seleciona intervalo · Arraste para reorganizar</span>
        <span class="pct-badge">${pct}% concluído</span>
      </div>
    </div>
    <div class="tabela-wrapper">
      ${total === 0
        ? `<div class="sem-aulas">Nenhuma aula prevista neste bimestre.</div>`
        : `<table class="tabela-aulas" id="tabela-aulas">
            <thead><tr>
              <th class="th-numero"   data-tip="${TOOLTIPS_COLUNAS['th-numero']}">#</th>
              <th class="th-conteudo" data-tip="${TOOLTIPS_COLUNAS['th-conteudo']}">Conteúdos / Atividades</th>
              <th class="th-data"     data-tip="${TOOLTIPS_COLUNAS['th-data']}">Data prevista</th>
              <th class="th-dada"     data-tip="${TOOLTIPS_COLUNAS['th-dada']}">AD</th>
              <th class="th-registro" data-tip="${TOOLTIPS_COLUNAS['th-registro']}">Data</th>
              <th class="th-chamada"  data-tip="${TOOLTIPS_COLUNAS['th-chamada']}">Chamada</th>
              <th class="th-entregue" data-tip="${TOOLTIPS_COLUNAS['th-entregue']}">Registro</th>
            </tr></thead>
            <tbody id="tbody-aulas"></tbody>
          </table>`
      }
    </div>
    <div class="rodape-tabela">
      <div class="rodape-grupo">
        <button class="btn-eventual" onclick="abrirModalEventual()">+ Aula eventual</button>
        <button class="btn-resetar-ordem" onclick="resetarOrdem()">↺ Resetar ordem</button>
      </div>
      <div class="rodape-grupo">
        <button class="btn-exportar-csv" onclick="exportarCSV()">⬇ CSV</button>
        <button class="btn-exportar-js"  onclick="exportarJS()">⬇ aulas.js</button>
        <button class="btn-limpar"       onclick="confirmarLimpar()">🗑 Limpar</button>
      </div>
    </div>
    <div id="modal-eventual" class="modal-overlay" style="display:none">
      <div class="modal-box">
        <h3 class="modal-titulo">Inserir Aula Eventual</h3>
        <div class="modal-form">
          <label>Data <input type="date" id="ev-data" /></label>
          <label>Horário <input type="time" id="ev-hora" value="07:00" /></label>
          <label>Descrição / Conteúdo <textarea id="ev-desc" rows="2" placeholder="Ex: Reposição — Biomas"></textarea></label>
        </div>
        <div class="modal-actions">
          <button class="btn-modal-cancel" onclick="fecharModalEventual()">Cancelar</button>
          <button class="btn-modal-ok"     onclick="confirmarEventual()">Inserir</button>
        </div>
      </div>
    </div>`;
  if (total > 0) renderizarLinhas(slots);
}

function renderizarLinhas(slots) {
  const t      = turmaAtiva;
  const tbody  = document.getElementById("tbody-aulas");
  if (!tbody) return;
  tbody.innerHTML = "";
  // Chave específica por bimestre; fallback para chave sem bimestre (migração)
  const chaveC = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const conts  = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem    = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  let regIdx = 0;
  let lineNum = 0;
  for (const slot of slots) {
    lineNum++;
    const slotId = slot.slotId;
    const ch     = chaveSlot(t.id, bimestreAtivo, slotId);
    const est    = estadoAulas[ch] || {};
    const feita  = !!est.feita;
    let conteudoBase = "", conteudoExibido = "", editado = false;
    if (!slot.eventual) {
      const contIdx   = ordem[regIdx];
      conteudoBase    = (contIdx != null && conts[contIdx] != null) ? conts[contIdx] : "";
      conteudoExibido = est.conteudoEditado ?? conteudoBase;
      editado         = est.conteudoEditado != null && est.conteudoEditado !== conteudoBase;
      regIdx++;
    } else {
      conteudoBase    = slot.descricao || "";
      conteudoExibido = est.conteudoEditado ?? conteudoBase;
      editado         = est.conteudoEditado != null && est.conteudoEditado !== conteudoBase;
    }
    const selecionado = selConteudos.has(slotId);
    const passada     = slot.data < hoje();
    const rowBase     = slot.eventual ? "row-eventual" : (feita ? "row-feita" : (passada ? "row-pendente" : "row-futura"));
    const rowClass    = `${rowBase}${selecionado ? " row-sel-cont" : ""}`;
    const tr = document.createElement("tr");
    tr.className    = rowClass;
    tr.dataset.slot = slotId;

    // FIX: passa "this" para toggleCampo para permitir reversão imediata do
    // checkbox caso o visitante não esteja autenticado.
    const mkChk = (campo, val, title) => `
      <label class="checkbox-wrapper" title="${title}">
        <input type="checkbox" ${val?"checked":""}
          onchange="toggleCampo('${slotId}','${campo}',this.checked,this)">
        <span class="checkmark ${campo==='feita'?'':'checkmark-alt'}"></span>
      </label>`;

    tr.innerHTML = `
      <td class="td-numero">${slot.eventual ? `<span class="tag-eventual" title="Aula eventual">E</span>` : lineNum}</td>
      <td class="td-conteudo" data-slot="${slotId}">
        <div class="conteudo-cell">
          <span class="drag-handle-cont ${selecionado?"handle-sel":""}"
            data-slot="${slotId}" draggable="true"
            title="Clique para selecionar · Shift+clique para intervalo · Arrastar para reorganizar">⠿</span>
          <span class="conteudo-texto ${editado?"editado":""}"
            data-slot="${slotId}"
            title="${editado?"Editado · clique para editar":"Clique para editar"}"
          >${conteudoExibido||'<span class="sem-conteudo">—</span>'}</span>
          ${editado?'<span class="badge-editado">✎</span>':""}
          ${slot.eventual?`<button class="btn-del-eventual" onclick="removerEventual('${slotId}')" title="Remover esta aula eventual">×</button>`:""}
        </div>
        <input type="text" class="anotacao-input"
          placeholder="Anotação…"
          value="${(est.anotacao||'').replace(/"/g,'&quot;')}"
          onchange="salvarAnotacao('${slotId}', this.value)"
          title="Anotação livre sobre esta aula"
        />
      </td>
      <td class="td-data">${fmtSlotData(slot)}</td>
      <td class="td-check">${mkChk("feita",   feita, "Aula dada?")}</td>
      <td class="td-registro" id="reg-${slotId}">${feita?fmtData(est.dataFeita):"—"}</td>
      <td class="td-check">${mkChk("chamada", !!est.chamada,   "Chamada realizada?")}</td>
      <td class="td-check">${mkChk("conteudoEntregue", !!est.conteudoEntregue, "Material entregue?")}</td>`;
    const spanTxt = tr.querySelector(".conteudo-texto");
    spanTxt.addEventListener("click", () => iniciarEdicao(spanTxt, slotId, conteudoBase));
    const handle = tr.querySelector(".drag-handle-cont");
    handle.addEventListener("click",      e => onHandleClick(e, slotId));
    handle.addEventListener("dragstart",  e => onDragStart(e, slotId));
    handle.addEventListener("dragend",    onDragEnd);
    const tdC = tr.querySelector(".td-conteudo");
    tdC.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; });
    tdC.addEventListener("dragenter", e => onDragEnter(e, slotId));
    tdC.addEventListener("dragleave", e => onDragLeave(e));
    tdC.addEventListener("drop",      e => onDrop(e, slotId));
    tbody.appendChild(tr);
  }
}

function iniciarEdicao(spanEl, slotId, base) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  if (spanEl.querySelector("textarea")) return;
  const cur = spanEl.innerText.replace("—","").trim();
  const ta  = document.createElement("textarea");
  ta.className = "input-edicao";
  ta.value = cur; ta.rows = 2;
  spanEl.innerHTML = ""; spanEl.appendChild(ta);
  spanEl.classList.add("editando");
  ta.focus(); ta.select();
  function salvar() {
    const novo = ta.value.trim();
    const ch   = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    const chaveC = `${turmaAtiva.serie}_${turmaAtiva.disciplina}_b${bimestreAtivo}`;
    const slotsReg = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).filter(s => !s.eventual);
    const ordem    = getOrdem(turmaAtiva.id, bimestreAtivo, slotsReg.length);
    const regIdx   = slotsReg.findIndex(s => s.slotId === slotId);
    if (regIdx >= 0 && ordem[regIdx] != null) {
      if (!RT_CONTEUDOS[chaveC]) RT_CONTEUDOS[chaveC] = [];
      RT_CONTEUDOS[chaveC][ordem[regIdx]] = novo || base;
    }
    delete estadoAulas[ch].conteudoEditado;
    salvarTudo();
    const editado = false;
    const exibido = novo || base || "";
    spanEl.classList.remove("editando");
    spanEl.classList.toggle("editado", editado);
    spanEl.innerHTML = exibido || '<span class="sem-conteudo">—</span>';
    spanEl.title = editado ? "Editado · clique para editar" : "Clique para editar";
    const td = spanEl.closest("td");
    let badge = td.querySelector(".badge-editado");
    if (editado && !badge) { badge = document.createElement("span"); badge.className="badge-editado"; badge.textContent="✎"; td.querySelector(".conteudo-cell").appendChild(badge); }
    else if (!editado && badge) badge.remove();
    spanEl.addEventListener("click", () => iniciarEdicao(spanEl, slotId, base));
  }
  ta.addEventListener("blur", salvar);
  ta.addEventListener("keydown", e => {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); ta.blur(); }
    if (e.key==="Escape") { ta.value=cur; ta.blur(); }
  });
}

function salvarAnotacao(slotId, valor) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { return; }
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  if (valor.trim() === "") delete estadoAulas[ch].anotacao;
  else estadoAulas[ch].anotacao = valor.trim();
  salvarTudo();
}

// FIX: recebe o elemento <input> (inputEl) para reverter o checkbox
// imediatamente no DOM se o visitante não estiver autenticado.
// Antes, o check ficava visualmente marcado até o modal fechar.
function toggleCampo(slotId, campo, val, inputEl) {
  if (!_autenticado) { inputEl.checked = !val; _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { inputEl.checked = !val; _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch][campo] = val;
  if (campo === "feita") {
    estadoAulas[ch].dataFeita = val ? hoje() : null;
    const tr  = document.querySelector(`tr[data-slot="${slotId}"]`);
    const reg = document.getElementById(`reg-${slotId}`);
    if (tr) {
      const slot  = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).find(s => s.slotId===slotId);
      const pass  = slot && slot.data < hoje();
      const ev    = slot?.eventual;
      tr.className = `${ev?"row-eventual":(val?"row-feita":(pass?"row-pendente":"row-futura"))}${selConteudos.has(slotId)?" row-sel-cont":""}`;
    }
    if (reg) reg.textContent = val ? fmtData(hoje()) : "—";
    atualizarStats();
  }
  salvarTudo();
}

function atualizarStats() {
  const slots = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).filter(s=>!s.eventual);
  const total = slots.length;
  let feitas  = 0;
  for (const s of slots) if (estadoAulas[chaveSlot(turmaAtiva.id,bimestreAtivo,s.slotId)]?.feita) feitas++;
  const pct = total>0 ? Math.round(feitas/total*100) : 0;
  document.querySelector(".stat-num")?.textContent && (document.querySelector(".stat-num").textContent = `${feitas}/${total}`);
  document.querySelector(".stat-prog")?.setAttribute("stroke-dasharray",`${pct},100`);
  if (document.querySelector(".pct-badge")) document.querySelector(".pct-badge").textContent = `${pct}% concluído`;
}

let ultimoSelecionado = null;

function onHandleClick(e, slotId) {
  e.preventDefault();
  e.stopPropagation();
  const todos = [...document.querySelectorAll(".drag-handle-cont[data-slot]")].map(h => h.dataset.slot);
  if (e.shiftKey && ultimoSelecionado && todos.includes(ultimoSelecionado)) {
    // Shift+clique: seleciona intervalo
    const iA = todos.indexOf(ultimoSelecionado);
    const iB = todos.indexOf(slotId);
    const [de, ate] = iA < iB ? [iA, iB] : [iB, iA];
    for (let i = de; i <= ate; i++) selConteudos.add(todos[i]);
  } else {
    // Clique simples: toggle da linha
    if (selConteudos.has(slotId)) {
      selConteudos.delete(slotId);
    } else {
      selConteudos.add(slotId);
    }
  }
  ultimoSelecionado = slotId;
  atualizarVisualizacaoSel();
}

// Clique fora da tabela ou em linha (não no handle) limpa a seleção
function _initClickFora() {
  document.addEventListener("click", e => {
    if (!selConteudos.size) return;
    const dentroTabela = e.target.closest(".tabela-aulas");
    const noHandle     = e.target.closest(".drag-handle-cont");
    if (dentroTabela && !noHandle) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    } else if (!dentroTabela) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    }
  }, true);
}

function atualizarVisualizacaoSel() {
  document.querySelectorAll(".drag-handle-cont").forEach(h => {
    h.classList.toggle("handle-sel", selConteudos.has(h.dataset.slot));
  });
  document.querySelectorAll("tr[data-slot]").forEach(tr => {
    tr.classList.toggle("row-sel-cont", selConteudos.has(tr.dataset.slot));
  });
}

function onDragStart(e, slotId) {
  if (!selConteudos.has(slotId)) { selConteudos.clear(); selConteudos.add(slotId); atualizarVisualizacaoSel(); }
  dragSrcSlots = [...selConteudos];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", slotId);
  dragSrcSlots.forEach(sid => {
    document.querySelector(`td.td-conteudo[data-slot="${sid}"]`)?.classList.add("content-dragging");
  });
}

function onDragEnd() {
  document.querySelectorAll(".content-dragging,.content-drag-over").forEach(el =>
    el.classList.remove("content-dragging","content-drag-over")
  );
  dragSrcSlots = []; dragDestSlot = null;
}

function onDragEnter(e, slotId) {
  if (dragSrcSlots.includes(slotId)) return;
  dragDestSlot = slotId;
  document.querySelector(`td.td-conteudo[data-slot="${slotId}"]`)?.classList.add("content-drag-over");
}

function onDragLeave(e) {
  const td = e.currentTarget;
  if (!td.contains(e.relatedTarget)) td.classList.remove("content-drag-over");
}

function onDrop(e, destSlotId) {
  e.preventDefault(); e.stopPropagation();
  document.querySelector(`td.td-conteudo[data-slot="${destSlotId}"]`)?.classList.remove("content-drag-over");
  if (!dragSrcSlots.length || dragSrcSlots.includes(destSlotId)) return;
  const t = turmaAtiva;
  const slots = getSlotsCompletos(t.id, bimestreAtivo);
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  function slotIdxReg(slotId) { return slotsReg.findIndex(s => s.slotId === slotId); }
  const srcIdxs = dragSrcSlots.map(slotIdxReg).filter(i => i >= 0);
  const destIdx = slotIdxReg(destSlotId);
  if (destIdx < 0 && !slots.find(s=>s.slotId===destSlotId)?.eventual) return;
  if (destIdx < 0) return;
  const novaOrdem = [...ordem];
  const srcContents = srcIdxs.map(i => ({
    contIdx: novaOrdem[i],
    editado: estadoAulas[chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId)]?.conteudoEditado
  }));
  const srcSet = new Set(srcIdxs);
  const restantes = novaOrdem.filter((_, i) => !srcSet.has(i));
  const destPosEmRestantes = restantes.indexOf(novaOrdem[destIdx]);
  const insPos = destPosEmRestantes >= 0 ? destPosEmRestantes : restantes.length;
  restantes.splice(insPos, 0, ...srcContents.map(s => s.contIdx));
  srcIdxs.forEach(i => {
    const ch = chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  let srcPtr = 0;
  for (let i = 0; i < restantes.length; i++) {
    const slotId = slotsReg[i]?.slotId;
    if (!slotId) continue;
    const origSrcIdx = srcContents.findIndex((s,j) => s.contIdx === restantes[i] && j === srcPtr);
    if (origSrcIdx >= 0 && srcContents[origSrcIdx].editado != null) {
      const ch = chaveSlot(t.id, bimestreAtivo, slotId);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch].conteudoEditado = srcContents[origSrcIdx].editado;
      srcPtr++;
    }
  }
  const chaveC2 = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const contsList = RT_CONTEUDOS[chaveC2] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  RT_CONTEUDOS[chaveC2] = restantes.map(ci => contsList[ci] ?? "");
  delete ordemConteudos[chaveOrdem(t.id, bimestreAtivo)];
  slotsReg.forEach((s) => {
    const ch = chaveSlot(t.id, bimestreAtivo, s.slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  salvarTudo();
  selConteudos.clear();
  renderizarLinhas(getSlotsCompletos(t.id, bimestreAtivo));
}

function mudarBimestre(num) { bimestreAtivo = num; selConteudos.clear(); renderizarConteudo(); }

function resetarOrdem() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  if (!confirm("Restaurar ordem original dos conteúdos?")) return;
  delete ordemConteudos[chaveOrdem(turmaAtiva.id, bimestreAtivo)];
  salvarTudo(); renderizarConteudo();
}

function abrirModalEventual() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  document.getElementById("ev-data").value = hoje();
  document.getElementById("modal-eventual").style.display = "flex";
}

function fecharModalEventual() { document.getElementById("modal-eventual").style.display = "none"; }

function confirmarEventual() {
  const data = document.getElementById("ev-data").value;
  const hora = document.getElementById("ev-hora").value || "07:00";
  const desc = document.getElementById("ev-desc").value.trim();
  if (!data) { alert("Informe a data."); return; }
  const lista = getEventuais(turmaAtiva.id, bimestreAtivo);
  lista.push({ id: Date.now(), data, hora, descricao: desc });
  salvarEventuais(lista); fecharModalEventual(); renderizarConteudo();
}

function removerEventual(slotId) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const eId = parseInt(slotId.replace("e",""), 10);
  const lista = getEventuais(turmaAtiva.id, bimestreAtivo).filter(e => e.id !== eId);
  salvarEventuais(lista);
  delete estadoAulas[chaveSlot(turmaAtiva.id, bimestreAtivo, slotId)];
  salvarTudo(); renderizarConteudo();
}

function confirmarLimpar() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  const lbl = RT_BIMESTRES.find(b=>b.bimestre===bimestreAtivo)?.label;
  if (!confirm(`Apagar todos os registros do ${lbl} desta turma?`)) return;
  getSlotsCompletos(turmaAtiva.id, bimestreAtivo).forEach(s => {
    delete estadoAulas[chaveSlot(turmaAtiva.id, bimestreAtivo, s.slotId)];
  });
  salvarTudo(); selConteudos.clear(); renderizarConteudo();
}

function exportarCSV() {
  const t = turmaAtiva;
  const slots = getSlotsCompletos(t.id, bimestreAtivo);
  const chaveC = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const conts = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s=>!s.eventual);
  const ordem = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  let rIdx = 0;
  const linhas = [["#","Data","Horário","Conteúdos/Atividades","Chamada","Entregue","Dada?","Registro"]];
  slots.forEach((slot, i) => {
    const ch  = chaveSlot(t.id, bimestreAtivo, slot.slotId);
    const est = estadoAulas[ch] || {};
    let cont  = slot.eventual ? (slot.descricao||"") : (est.conteudoEditado ?? (conts[ordem[rIdx]]||""));
    if (!slot.eventual) rIdx++;
    const horarioFmt = slot.eventual ? slot.inicio : (slot.label ? `${slot.label} (${slot.inicio}–${slot.fim})` : slot.inicio);
    linhas.push([i+1, fmtData(slot.data), horarioFmt, cont,
      est.chamada?"Sim":"Não", est.conteudoEntregue?"Sim":"Não",
      est.feita?"Sim":"Não", est.feita?fmtData(est.dataFeita):"",
    ]);
  });
  const csv  = linhas.map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const lbl  = t.subtitulo?`${t.serie}${t.turma}_${t.subtitulo}`:`${t.serie}${t.turma}`;
  baixarArquivo(blob,`aulas_${lbl}_${t.sigla}_bim${bimestreAtivo}.csv`);
}

function exportarJS() {
  // Exporta RT_CONTEUDOS com chaves por bimestre (novo formato)
  const out = [
    `// AULAS.JS — Exportado em ${new Date().toLocaleString("pt-BR")}`,
    `const BIMESTRES = ${JSON.stringify(RT_BIMESTRES,null,2)};`,
    `const TURMAS    = ${JSON.stringify(RT_TURMAS,null,2)};`,
    `const CONTEUDOS = ${JSON.stringify(RT_CONTEUDOS,null,2)};`,
    `// Restore: localStorage.setItem("aulaOrdem", JSON.stringify(ORDEM));`,
    `//          localStorage.setItem("aulaEstado", JSON.stringify(ESTADO));`,
    `const ORDEM  = ${JSON.stringify(ordemConteudos,null,2)};`,
    `const ESTADO = ${JSON.stringify(estadoAulas,null,2)};`,
  ].join("\n\n");
  baixarArquivo(new Blob([out],{type:"application/javascript;charset=utf-8;"}),"aulas.js");
}

function baixarArquivo(blob, nome) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download=nome; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  PAINEL DE GESTÃO
// ════════════════════════════════════════════════════════════
function abrirPainelGestao() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const papel   = _papel();
  const isAdmin = papel === "admin";
  const isCoord = papel === "coordenador";
  const isProf  = papel === "professor";

  // Abas e seções variam por papel:
  // Admin:       Conteúdos · Turmas · Bimestres · Meu Perfil · Usuários
  // Professor:   Conteúdos · Turmas · Bimestres · Meu Perfil
  // Coordenador: Bimestres · Meu Perfil · Diários (leitura)
  const tabs = [], sections = [];

  if (isAdmin || isProf) {
    tabs.push(`<button class="gtab ativo" onclick="abrirGTab(this,'g-conteudos')">Conteúdos</button>`);
    sections.push(`<div id="g-conteudos" class="gestao-secao ativa">${htmlGestaoConteudos()}</div>`);
    tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-turmas')">Séries / Turmas</button>`);
    sections.push(`<div id="g-turmas" class="gestao-secao">${htmlGestaoTurmas()}</div>`);
  }

  const bimAtivo = isCoord ? " ativo" : "";
  const bimSecAtivo = isCoord ? " ativa" : "";
  tabs.push(`<button class="gtab${bimAtivo}" onclick="abrirGTab(this,'g-bimestres')">Bimestres</button>`);
  sections.push(`<div id="g-bimestres" class="gestao-secao${bimSecAtivo}">${htmlGestaoBimestres()}</div>`);

  tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-perfil')">Meu Perfil</button>`);
  sections.push(`<div id="g-perfil" class="gestao-secao">${htmlGestaoPerfil()}</div>`);

  if (isAdmin) {
    tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-disciplinas')">📋 Disciplinas</button>`);
    sections.push(`<div id="g-disciplinas" class="gestao-secao">${htmlGestaoDisciplinas()}</div>`);
    tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-usuarios')">👥 Usuários</button>`);
    sections.push(`<div id="g-usuarios" class="gestao-secao">${htmlGestaoUsuarios()}</div>`);
    tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-diarios')">📚 Diários</button>`);
    sections.push(`<div id="g-diarios" class="gestao-secao">${htmlGestaoDiarios()}</div>`);
  }
  if (isCoord) {
    tabs.push(`<button class="gtab" onclick="abrirGTab(this,'g-diarios')">📚 Diários</button>`);
    sections.push(`<div id="g-diarios" class="gestao-secao">${htmlGestaoDiarios()}</div>`);
  }

  const btnExportar = isAdmin
    ? `<button class="btn-exportar-js" onclick="exportarJS()" style="font-size:.8rem">⬇ aulas.js</button>`
    : "";

  document.getElementById("conteudo-principal").innerHTML = `
    <div class="gestao-painel">
      <div class="gestao-header">
        <h1 class="gestao-titulo">⚙ Painel de Gestão</h1>
        <div style="display:flex;gap:8px;align-items:center;">
          ${btnExportar}
          <button class="btn-voltar" onclick="voltarPrincipal()">← Voltar</button>
        </div>
      </div>
      <div class="gestao-tabs">${tabs.join("")}</div>
      ${sections.join("")}
    </div>`;
}

function abrirGTab(btn, secId) {
  document.querySelectorAll(".gtab").forEach(b=>b.classList.remove("ativo"));
  document.querySelectorAll(".gestao-secao").forEach(s=>s.classList.remove("ativa"));
  btn.classList.add("ativo");
  document.getElementById(secId).classList.add("ativa");
  if (secId==="g-disciplinas") document.getElementById(secId).innerHTML = htmlGestaoDisciplinas();
  if (secId==="g-turmas")    document.getElementById(secId).innerHTML = htmlGestaoTurmas();
  if (secId==="g-bimestres") document.getElementById(secId).innerHTML = htmlGestaoBimestres();
  if (secId==="g-conteudos") document.getElementById(secId).innerHTML = htmlGestaoConteudos();
  if (secId==="g-perfil")    document.getElementById(secId).innerHTML = htmlGestaoPerfil();
  if (secId==="g-usuarios")  { document.getElementById(secId).innerHTML = htmlGestaoUsuarios();  _carregarUsuarios(); }
  if (secId==="g-diarios")   { document.getElementById(secId).innerHTML = htmlGestaoDiarios();   _carregarDiariosCoord(); }
}

function voltarPrincipal() {
  renderizarSidebar();
  if (turmaAtiva) renderizarConteudo(); else renderizarBemVindo();
}

function htmlGestaoTurmas() {
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const adm = _isAdmin(_userAtual?.email);
  const uid = _userAtual?.uid;

  const rows = _turmasVisiveis().map((t, vi) => {
    // índice real em RT_TURMAS (necessário para editar/excluir)
    const i = RT_TURMAS.indexOf(t);
    // Só o dono ou admin pode editar
    const minha = adm || t.profUid === uid || t.profUid === "global";
    const ro = minha ? "" : " readonly style='opacity:.55;pointer-events:none'";
    const serieKey = `${t.serie}ª série`;
    const discsDaSerie = (RT_CONFIG.disciplinasPorSerie?.[serieKey] || []).join("; ");
    const discsCell = adm
      ? `<input class="gi gi-sm" value="${discsDaSerie.replace(/"/g,'&quot;')}"
           title="Disciplinas desta série (global)"
           onchange="_editDiscsSerie('${serieKey}',this.value)"
           placeholder="Port.; Mat.; …" />`
      : `<span style="font-size:.78rem;color:var(--text-muted)">${discsDaSerie||"—"}</span>`;

    return `
    <tr>
      <td><input class="gi gi-xs" value="${t.serie}"${ro} onchange="editTurmaField(${i},'serie',this.value)" style="width:48px" /></td>
      <td><input class="gi gi-xs" value="${t.turma}"${ro} onchange="editTurmaField(${i},'turma',this.value)" /></td>
      <td><input class="gi gi-sm" value="${t.subtitulo}"${ro} onchange="editTurmaField(${i},'subtitulo',this.value)" /></td>
      <td><input class="gi" value="${t.disciplina}"${ro} onchange="editTurmaField(${i},'disciplina',this.value)" /></td>
      <td><input class="gi gi-xs" value="${t.sigla}"${ro} onchange="editTurmaField(${i},'sigla',this.value)" /></td>
      <td>${discsCell}</td>
      <td>
        <div class="horarios-lista">
          ${t.horarios.map((h,hi) => `
            <div class="horario-item">
              <select class="gi gi-xs" ${minha?"":"disabled"} onchange="editHorario(${i},${hi},'diaSemana',+this.value)">
                ${diasNomes.map((d,di)=>`<option value="${di}" ${h.diaSemana===di?"selected":""}>${d}</option>`).join("")}
              </select>
              <select class="gi gi-sm" ${minha?"":"disabled"} onchange="editHorario(${i},${hi},'aula',this.value)">
                ${RT_PERIODOS.map(p=>`<option value="${p.aula}" ${h.aula===p.aula?"selected":""}>${p.label} (${p.inicio}–${p.fim})</option>`).join("")}
              </select>
              ${minha ? `<button class="btn-icon-del" onclick="delHorario(${i},${hi})" title="Remover">×</button>` : ""}
            </div>`).join("")}
          ${minha ? `<button class="btn-add-small" onclick="addHorario(${i})">+ Horário</button>` : ""}
        </div>
      </td>
      <td>${minha ? `<button class="btn-icon-del" onclick="delTurma(${i})" title="Excluir turma">🗑</button>` : ""}</td>
    </tr>`;
  }).join("");

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Turmas cadastradas</h3>
        <button class="btn-add" onclick="addTurma()">+ Nova turma</button>
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr>
            <th>Série</th><th>Turma</th><th>Subtítulo</th>
            <th>Disciplina</th><th>Sigla</th>
            <th>${adm ? "Disciplinas da série (global)" : "Disciplinas da série"}</th>
            <th>Horários (dia + período)</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// Edita disciplinas de uma série (apenas admin)
async function _editDiscsSerie(serieKey, valor) {
  if (!_isAdmin(_userAtual?.email)) return;
  const lista = valor.split(";").map(s => s.trim()).filter(Boolean);
  if (!RT_CONFIG.disciplinasPorSerie) RT_CONFIG.disciplinasPorSerie = {};
  RT_CONFIG.disciplinasPorSerie[serieKey] = lista;
  try {
    await _dbConfigEscola().set({
      nomeEscola: RT_CONFIG.nomeEscola,
      materias: RT_CONFIG.materias,
      disciplinasPorSerie: RT_CONFIG.disciplinasPorSerie,
    });
    _mostrarIndicadorSync("✓ Disciplinas da série salvas");
  } catch(e) { console.warn("Erro ao salvar disciplinas da série:", e); }
}

function editTurmaField(i, campo, val) { RT_TURMAS[i][campo] = val; salvarTudo(); }
function editHorario(ti, hi, campo, val) {
  RT_TURMAS[ti].horarios[hi][campo] = campo==="diaSemana" ? +val : val; salvarTudo();
}
function addHorario(ti) {
  RT_TURMAS[ti].horarios.push({ diaSemana: 1, aula: "a1" }); salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}
function delHorario(ti, hi) {
  RT_TURMAS[ti].horarios.splice(hi, 1); salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}
function delTurma(i) {
  if (!confirm(`Excluir a turma ${RT_TURMAS[i].id}?`)) return;
  RT_TURMAS.splice(i, 1); salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}
function addTurma() {
  const serie = prompt("Série (1, 2 ou 3):", "1"); if (!serie) return;
  const turma = prompt("Turma (A–E):", "A");        if (!turma) return;
  const disc  = prompt("Disciplina:", "Geografia"); if (!disc)  return;
  const sigla = prompt("Sigla:", "GEO");            if (!sigla) return;
  const id    = `${serie}${turma}_${sigla.toUpperCase()}`;
  if (RT_TURMAS.find(t=>t.id===id)) { alert("Turma com este ID já existe."); return; }
  // profUid identifica o dono da turma; admin usa "global"
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (_userAtual?.uid || "anonimo");
  RT_TURMAS.push({ id, serie, turma, subtitulo:"", disciplina:disc, sigla:sigla.toUpperCase(), horarios:[], profUid });
  salvarTudo(); renderizarSidebar();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}

function htmlGestaoBimestres() {
  const admin = _isAdmin(_userAtual?.email);
  const rows = RT_BIMESTRES.map((b,i) => {
    if (admin) {
      return `
        <tr>
          <td><input class="gi gi-sm" value="${b.label}" onchange="editBimField(${i},'label',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.inicio}" onchange="editBimField(${i},'inicio',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.fim}"    onchange="editBimField(${i},'fim',this.value)" /></td>
          <td><button class="btn-icon-del" onclick="delBim(${i})">🗑</button></td>
        </tr>`;
    } else {
      // Não-admin: somente leitura nas datas
      return `
        <tr>
          <td><span class="bim-label-ro">${b.label}</span></td>
          <td><span class="bim-data-ro">${b.inicio ? _fmtDataSimples(b.inicio) : '—'}</span></td>
          <td><span class="bim-data-ro">${b.fim    ? _fmtDataSimples(b.fim)    : '—'}</span></td>
          <td></td>
        </tr>`;
    }
  }).join("");

  const headerAcao = admin ? `<button class="btn-add" onclick="addBim()">+ Novo período</button>` :
    `<span class="bim-ro-aviso">📋 Definido pelo administrador</span>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Bimestres / Períodos</h3>
        ${headerAcao}
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr><th>Rótulo</th><th>Início</th><th>Fim</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _fmtDataSimples(iso) {
  if (!iso) return "—";
  const [a,m,d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function editBimField(i, campo, val) {
  if (!_isAdmin(_userAtual?.email)) return;
  RT_BIMESTRES[i][campo] = campo==="bimestre" ? +val : val;
  _salvarBimestresFirestore();
}
function delBim(i) {
  if (!_isAdmin(_userAtual?.email)) return;
  if (!confirm("Excluir este período?")) return;
  RT_BIMESTRES.splice(i,1);
  _salvarBimestresFirestore();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}
function addBim() {
  if (!_isAdmin(_userAtual?.email)) return;
  const num = RT_BIMESTRES.length + 1;
  RT_BIMESTRES.push({ bimestre: num, label: `${num}º Bimestre`, inicio: "", fim: "" });
  _salvarBimestresFirestore();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}

let gContChave = null;   // chave ativa no painel (formato "serie_Disciplina_bN")
let gContModo  = "lista";
let gContBim   = 1;      // bimestre selecionado no painel de conteúdos

// Retorna as chaves base (sem bimestre) únicas para as turmas visíveis do professor.
// Admin vê todas; professor vê só as chaves série_disciplina das suas turmas.
function _gContChavesBase() {
  const set = new Set();
  const turmas = _turmasVisiveis();
  // Chaves derivadas das turmas visíveis (série_disciplina)
  for (const t of turmas) set.add(`${t.serie}_${t.disciplina}`);
  // Inclui chaves já criadas em RT_CONTEUDOS que pertençam às turmas visíveis
  for (const k of Object.keys(RT_CONTEUDOS)) {
    const base = k.replace(/_b\d+$/, "");
    if (set.has(base)) set.add(base); // já está
  }
  return [...set].sort();
}

// Chave completa para o bimestre ativo
function _gContChaveCompleta(base, bim) {
  return `${base}_b${bim}`;
}

// Garante que a chave por bimestre existe, copiando da chave genérica se necessário
function _gContEnsureChave(base, bim) {
  const chaveBim = _gContChaveCompleta(base, bim);
  if (!RT_CONTEUDOS[chaveBim]) {
    // migra da chave sem bimestre se existir, senão array vazio
    RT_CONTEUDOS[chaveBim] = RT_CONTEUDOS[base]
      ? [...RT_CONTEUDOS[base]]
      : [];
  }
  return chaveBim;
}

function htmlGestaoConteudos() {
  const bases    = _gContChavesBase();
  const baseAtiva = (() => {
    if (gContChave) {
      const m = gContChave.match(/^(.+)_b\d+$/);
      const b = m ? m[1] : gContChave;
      if (bases.includes(b)) return b;
    }
    return bases[0] || null;
  })();
  const bim        = gContBim;
  const chaveAtiva = baseAtiva ? _gContEnsureChave(baseAtiva, bim) : null;
  gContChave       = chaveAtiva;

  // Botões de disciplina
  const discBtns = bases.map(b => `
    <button class="gtab-cont ${b===baseAtiva?"ativo":""}" onclick="selecionarBaseGCont('${b}')">${b}</button>`
  ).join("");

  // Abas de bimestre
  const bimBtns = (RT_BIMESTRES || []).map(b => `
    <button class="gtab-cont gtab-bim ${b.bimestre===bim?"ativo":""}" onclick="selecionarBimGCont(${b.bimestre})">${b.label}</button>`
  ).join("");

  const lista = chaveAtiva ? RT_CONTEUDOS[chaveAtiva] : [];

  const conteudoEditor = gContModo === "bloco" ? `
    <div class="bloco-editor">
      <p class="bloco-instrucao">Cole ou digite todas as aulas — <strong>uma por linha</strong>. As linhas existentes serão substituídas ao salvar.</p>
      <textarea id="bloco-textarea" class="bloco-textarea" rows="18" spellcheck="false">${lista.join("\n")}</textarea>
      <div class="bloco-actions">
        <button class="btn-modal-cancel" onclick="gContModo='lista'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">Cancelar</button>
        <button class="btn-modal-ok" onclick="salvarBloco('${chaveAtiva}')">Salvar bloco</button>
      </div>
    </div>` : `
    <div class="tabela-wrapper" style="margin-top:12px">
      <table class="tabela-gestao" id="tabela-conteudos">
        <thead><tr><th>#</th><th>Texto da aula</th><th></th></tr></thead>
        <tbody>
          ${lista.map((txt,i) => `
            <tr data-ci="${i}">
              <td class="td-numero">${i+1}</td>
              <td>
                <div class="conteudo-cell">
                  <span class="drag-handle-cont" draggable="true"
                    ondragstart="contDragStart(event,${i})"
                    ondragover="event.preventDefault()"
                    ondragenter="contDragEnter(event,${i})"
                    ondragleave="event.target.closest('tr')?.classList.remove('cont-drag-over')"
                    ondrop="contDrop(event,${i})">⠿</span>
                  <input class="gi gi-full" value="${txt.replace(/"/g,'&quot;')}"
                    onchange="editConteudo('${chaveAtiva}',${i},this.value)" />
                </div>
              </td>
              <td><button class="btn-icon-del" onclick="delConteudo('${chaveAtiva}',${i})">×</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button class="btn-add" onclick="addConteudo('${chaveAtiva}')">+ Adicionar linha</button>
    </div>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Conteúdos por disciplina / série / bimestre</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn-add btn-outline" onclick="gContModo='bloco'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">✎ Editar em bloco</button>
          <button class="btn-add" onclick="addChaveCont()">+ Nova disciplina</button>
        </div>
      </div>
      <div class="gtab-cont-bar" style="margin-bottom:4px">${discBtns}</div>
      <div class="gtab-cont-bar" style="margin-bottom:12px;opacity:.85">${bimBtns}</div>
      ${chaveAtiva ? conteudoEditor : `<p style="padding:20px;color:#aaa">Nenhuma disciplina cadastrada.</p>`}
    </div>`;
}

function selecionarBaseGCont(base) {
  gContChave = _gContChaveCompleta(base, gContBim);
  gContModo  = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function selecionarBimGCont(bim) {
  gContBim   = bim;
  gContModo  = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

// Mantida para compatibilidade com código legado
function selecionarChaveCont(k) {
  gContChave = k; gContModo = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function salvarBloco(chave) {
  const texto  = document.getElementById("bloco-textarea").value;
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  RT_CONTEUDOS[chave] = linhas;
  gContModo = "lista";
  // Limpa ordem e conteúdos editados do bimestre correspondente
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      delete ordemConteudos[chaveOrdem(t.id, bimN)];
      const slots = getSlotsCompletos(t.id, bimN).filter(s => !s.eventual);
      slots.forEach(s => {
        const ch = chaveSlot(t.id, bimN, s.slotId);
        if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
      });
    }
  }
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function editConteudo(chave, i, val) {
  RT_CONTEUDOS[chave][i] = val;
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      const slots = getSlotsCompletos(t.id, bimN).filter(s => !s.eventual);
      const ordem = getOrdem(t.id, bimN, slots.length);
      slots.forEach((s, ri) => {
        if (ordem[ri] === i) {
          const ch = chaveSlot(t.id, bimN, s.slotId);
          if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
        }
      });
    }
  }
  salvarTudo();
}

function delConteudo(chave, i) {
  if (!confirm("Remover esta aula da lista?")) return;
  RT_CONTEUDOS[chave].splice(i,1); salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function addConteudo(chave) {
  RT_CONTEUDOS[chave].push(""); salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
  setTimeout(() => {
    const inputs = document.querySelectorAll("#tabela-conteudos .gi-full");
    inputs[inputs.length-1]?.focus();
  }, 50);
}

function addChaveCont() {
  const serie = prompt("Série (ex: 1, 2, 3):", "1"); if (!serie) return;
  const disc  = prompt("Disciplina (ex: Geografia):", ""); if (!disc) return;
  const base  = `${serie}_${disc}`;
  const chaveBim = _gContChaveCompleta(base, gContBim);
  if (RT_CONTEUDOS[chaveBim]) { alert("Já existe."); return; }
  RT_CONTEUDOS[chaveBim] = [];
  gContChave = chaveBim; gContModo = "bloco"; salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}


// ════════════════════════════════════════════════════════════
//  PAINEL: MEU PERFIL
// ════════════════════════════════════════════════════════════
// ── Helper: UI de seleção de matérias (checkboxes + campo Outro) ──────────
// Renderiza seletor área + disciplinas + turmas para professor/cadastro
function _htmlCheckboxMaterias(selecionadas, areaAtual, turmasSelecionadas) {
  const lista = selecionadas ? selecionadas.split(";").map(s => s.trim()).filter(Boolean) : [];
  const turmasIds = Array.isArray(turmasSelecionadas) ? turmasSelecionadas : [];
  const temDiscs = Object.keys(RT_CONFIG.disciplinasPorSerie || {}).length > 0;

  // Sem disciplinas cadastradas pelo admin — campo livre
  if (!temDiscs) {
    return `<label>Disciplina(s) <span style="font-size:.72rem;color:var(--text-muted)">(separe por ;)</span>
      <input class="gi" id="perf-disc-outro" value="${lista.join("; ").replace(/"/g,'&quot;')}"
        placeholder="Geografia; Sociologia…" />
    </label>`;
  }

  const areaOpts = AREAS_CONHECIMENTO.map(a =>
    `<option value="${a.id}" ${areaAtual===a.id?"selected":""}>${a.label}</option>`
  ).join("");

  const discsDaArea = areaAtual ? _disciplinasDaArea(areaAtual) : [];
  const todasConhecidas = _todasDisciplinas();
  const extras = lista.filter(m => !todasConhecidas.includes(m));

  const checks = discsDaArea.map(m => {
    const checked = lista.includes(m) ? "checked" : "";
    return `<label class="mat-check-label">
      <input type="checkbox" class="mat-chk" value="${m.replace(/"/g,'&quot;')}"
        ${checked} onchange="_onDiscChange()">
      <span>${m}</span>
    </label>`;
  }).join("");

  // Turmas disponíveis para as disciplinas já selecionadas
  const turmasDisp = _turmasParaDiscs(lista);
  const turmasHtml = turmasDisp.length ? `
    <label class="mat-group-label" id="mat-turmas-label" style="margin-top:12px">Turmas em que leciona</label>
    <div class="mat-checks" id="mat-turmas-wrap">
      ${turmasDisp.map(t => {
        const checked = turmasIds.includes(t.id) ? "checked" : "";
        return `<label class="mat-check-label">
          <input type="checkbox" class="mat-turma-chk" value="${t.id}" ${checked}>
          <span>${t.serie}ª ${t.turma} — ${t.disciplina}</span>
        </label>`;
      }).join("")}
    </div>` : `<div id="mat-turmas-wrap"></div>`;

  return `
    <label class="mat-group-label">Área do conhecimento
      <select class="gi" id="perf-area" onchange="_onAreaChange(this.value)">
        <option value="">— selecione —</option>
        ${areaOpts}
      </select>
    </label>
    <label class="mat-group-label">Disciplina(s) que leciona</label>
    <div class="mat-checks" id="mat-checks-wrap">
      ${discsDaArea.length ? checks : '<span style="color:var(--text-muted);font-size:.8rem">Selecione uma área para ver as disciplinas</span>'}
    </div>
    <label class="mat-outro-label">Outra(s) não listada(s) <span style="font-size:.72rem;color:var(--text-muted)">(separe por ;)</span>
      <input class="gi" id="perf-disc-outro" value="${extras.join("; ").replace(/"/g,'&quot;')}"
        placeholder="Ex: Filosofia; Arte" onchange="_onDiscChange()" />
    </label>
    ${turmasHtml}`;
}

function _onAreaChange(areaId) {
  const wrap = document.getElementById("mat-checks-wrap");
  if (!wrap) return;
  const discs = areaId ? _disciplinasDaArea(areaId) : [];
  if (!discs.length) {
    wrap.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Nenhuma disciplina cadastrada para esta área</span>`;
    _onDiscChange();
    return;
  }
  wrap.innerHTML = discs.map(m =>
    `<label class="mat-check-label">
      <input type="checkbox" class="mat-chk" value="${m.replace(/"/g,'&quot;')}" onchange="_onDiscChange()">
      <span>${m}</span>
    </label>`
  ).join("");
  _onDiscChange();
}

// Atualiza a lista de turmas quando as disciplinas mudam
function _onDiscChange() {
  const wrapTurmas = document.getElementById("mat-turmas-wrap");
  if (!wrapTurmas) return;
  const discs = _lerDisciplinasSelecionadas().split(";").map(s => s.trim()).filter(Boolean);
  const turmas = _turmasParaDiscs(discs);
  if (!turmas.length) {
    wrapTurmas.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Selecione uma disciplina para ver as turmas disponíveis</span>`;
    // Garantir que o label existe
    let lbl = document.getElementById("mat-turmas-label");
    if (lbl) lbl.style.display = discs.length ? "" : "none";
    return;
  }
  let lbl = document.getElementById("mat-turmas-label");
  if (lbl) lbl.style.display = "";
  wrapTurmas.innerHTML = turmas.map(t =>
    `<label class="mat-check-label">
      <input type="checkbox" class="mat-turma-chk" value="${t.id}">
      <span>${t.serie}ª ${t.turma} — ${t.disciplina}</span>
    </label>`
  ).join("");
}

function _lerDisciplinasSelecionadas() {
  const checks = [...document.querySelectorAll(".mat-chk:checked")].map(c => c.value);
  const outroEl = document.getElementById("perf-disc-outro");
  const outros  = outroEl ? outroEl.value.split(";").map(s => s.trim()).filter(Boolean) : [];
  return [...checks, ...outros].join("; ");
}

function _lerTurmasSelecionadas() {
  return [...document.querySelectorAll(".mat-turma-chk:checked")].map(c => c.value);
}

function htmlGestaoPerfil() {
  const p   = _perfilProf || {};
  const adm = _isAdmin(_userAtual?.email) || _ehAdmin();
  const escolaGlobal  = RT_CONFIG?.nomeEscola || p.escola || "";
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Meu Perfil</h3>
      </div>
      <div class="perfil-form">
        <label>Nome completo
          <input class="gi" id="perf-nome" value="${(p.nome||'').replace(/"/g,'&quot;')}"
            placeholder="Prof. Seu Nome" />
        </label>
        <label>${adm ? "Nome da escola" : "Escola"} ${adm ? '<span style="font-size:.72rem;color:var(--text-muted)">(global — visível a todos)</span>' : ""}
          <input class="gi" id="${adm ? 'perf-escola-global' : ''}" value="${escolaGlobal.replace(/"/g,'&quot;')}"
            placeholder="Escola Estadual…" ${adm ? "" : "readonly style='opacity:.6'"} />
        </label>
        ${_htmlCheckboxMaterias(p.disciplinas || "", p.area || "", p.turmasIds || [])}
        <label style="opacity:.6;pointer-events:none;">E-mail (não editável)
          <input class="gi" value="${p.email||''}" readonly />
        </label>
        <div style="margin-top:4px;">
          <button class="btn-add" onclick="_salvarPerfil()">💾 Salvar perfil</button>
        </div>
      </div>
    </div>`;
}

async function _salvarPerfil() {
  const nome = document.getElementById("perf-nome")?.value.trim();
  if (!nome) { alert("Informe seu nome."); return; }
  if (!_perfilProf) _perfilProf = { uid: _userAtual.uid, email: _userAtual.email, status: "aprovado" };
  _perfilProf.nome        = nome;
  _perfilProf.disciplinas = _lerDisciplinasSelecionadas();
  _perfilProf.area      = document.getElementById("perf-area")?.value || _perfilProf.area || "";
  _perfilProf.turmasIds = _lerTurmasSelecionadas().length
    ? _lerTurmasSelecionadas()
    : (_perfilProf.turmasIds || []);
  // Admin: salva nome da escola
  if (_isAdmin(_userAtual?.email)) {
    const nomeEscola = document.getElementById("perf-escola-global")?.value.trim() || "";
    RT_CONFIG.nomeEscola = nomeEscola;
    try { await _dbConfigEscola().set({ nomeEscola, disciplinasPorSerie: RT_CONFIG.disciplinasPorSerie || {} }); }
    catch(e) { console.warn("Erro ao salvar config escola:", e); }
  }
  await _salvarPerfilFirestore(_perfilProf);
  _atualizarBotaoAuth();
  _atualizarTagline();
  _mostrarIndicadorSync("✓ Perfil salvo");
}

// ════════════════════════════════════════════════════════════
//  PAINEL: USUÁRIOS (apenas admin)
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  PAINEL: DISCIPLINAS POR SÉRIE (apenas admin)
// ════════════════════════════════════════════════════════════
function htmlGestaoDisciplinas() {
  const series = ["1","2","3"];
  const dps = RT_CONFIG.disciplinasPorSerie || {};

  const blocos = series.map(s => {
    const labelSerie = `${s}ª série`;
    const areasBlocos = AREAS_CONHECIMENTO.map(area => {
      const discs = (dps[s]?.[area.id] || []).join("\n");
      return `
        <div class="disc-area-bloco">
          <div class="disc-area-label">${area.label}</div>
          <textarea class="gi disc-textarea" rows="4"
            data-serie="${s}" data-area="${area.id}"
            placeholder="Uma disciplina por linha&#10;Ex: Português&#10;Literatura"
            style="resize:vertical;font-size:.82rem;line-height:1.6"
          >${discs}</textarea>
        </div>`;
    }).join("");

    return `
      <div class="gestao-bloco" style="margin-bottom:16px">
        <div class="gestao-bloco-header">
          <h3>${labelSerie}</h3>
        </div>
        <div class="disc-areas-grid">${areasBlocos}</div>
      </div>`;
  }).join("");

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Disciplinas por série</h3>
        <button class="btn-add" onclick="_salvarDisciplinas()">💾 Salvar disciplinas</button>
      </div>
      <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 16px">
        Digite uma disciplina por linha em cada área. Professores verão apenas as disciplinas da área que selecionarem.
      </p>
    </div>
    ${blocos}
    <div style="padding:8px 0 16px">
      <button class="btn-add" onclick="_salvarDisciplinas()">💾 Salvar disciplinas</button>
    </div>`;
}

async function _salvarDisciplinas() {
  const dps = {};
  document.querySelectorAll(".disc-textarea").forEach(el => {
    const s    = el.dataset.serie;
    const area = el.dataset.area;
    const list = el.value.split(/[\n;]/).map(v => v.trim()).filter(Boolean);
    if (!dps[s]) dps[s] = {};
    dps[s][area] = list;
  });
  RT_CONFIG.disciplinasPorSerie = dps;
  try {
    await _dbConfigEscola().set({
      nomeEscola: RT_CONFIG.nomeEscola || "",
      disciplinasPorSerie: dps,
    });
    _mostrarIndicadorSync("✓ Disciplinas salvas");
  } catch(e) {
    console.warn("Erro ao salvar disciplinas:", e);
    _mostrarIndicadorSync("⚠ Salvo localmente (sem conexão)");
  }
}

function htmlGestaoUsuarios() {
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Usuários cadastrados</h3>
        <span id="usuarios-count" style="font-size:.8rem;color:var(--text-muted)">Carregando…</span>
      </div>
      <div id="usuarios-lista">
        <div style="padding:30px;text-align:center;color:var(--text-muted)">⏳ Buscando usuários…</div>
      </div>
    </div>`;
}

async function _carregarUsuarios() {
  try {
    const snap = await firebase.firestore().collection("professores").get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    users.sort((a,b) => {
      const ord = { pendente:0, aprovado:1, rejeitado:2 };
      return (ord[a.status]??3) - (ord[b.status]??3);
    });
    const count = document.getElementById("usuarios-count");
    if (count) count.textContent = `${users.length} usuário(s)`;
    const lista = document.getElementById("usuarios-lista");
    if (!lista) return;
    if (!users.length) {
      lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">Nenhum usuário cadastrado.</div>`;
      return;
    }
    lista.innerHTML = `
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr>
            <th>Nome</th><th>E-mail</th><th>Escola</th><th>Área</th><th>Disciplinas</th><th>Turmas</th>
            <th>Papel</th><th>Status</th><th>Solicitado em</th><th>Ações</th>
          </tr></thead>
          <tbody>
            ${users.map(u => {
              const isAdminUser = _isAdmin(u.email);
              const statusCls   = u.status==="aprovado" ? "prof-status-ok"
                : u.status==="rejeitado" ? "prof-status-rej" : "prof-status-pend";
              const statusLabel = u.status==="aprovado" ? "✓ Aprovado"
                : u.status==="rejeitado" ? "✗ Rejeitado" : "⏳ Pendente";
              const dt = u.solicitadoEm
                ? new Date(u.solicitadoEm).toLocaleDateString("pt-BR") : "—";
              const papelAtual = u.papel || "professor";
              const papelCell  = isAdminUser
                ? `<span class="badge-papel badge-admin">Admin</span>`
                : `<select class="gi gi-xs" onchange="_alterarPapel('${u.uid}',this.value)">
                    <option value="professor"   ${papelAtual==="professor"  ?"selected":""}>Professor</option>
                    <option value="coordenador" ${papelAtual==="coordenador"?"selected":""}>Coordenador</option>
                   </select>`;
              const acoes = isAdminUser
                ? `<span style="color:#4a5568;font-size:.75rem">—</span>`
                : `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                    ${u.status!=="aprovado"  ? `<button class="btn-add"    style="padding:4px 10px;font-size:.73rem" onclick="_aprovarUsuario('${u.uid}')">Aprovar</button>` : ""}
                    ${u.status!=="rejeitado" ? `<button class="btn-limpar" style="padding:4px 10px;font-size:.73rem" onclick="_rejeitarUsuario('${u.uid}')">Rejeitar</button>` : ""}
                    <button class="btn-icon-del" onclick="_excluirUsuario('${u.uid}')" title="Excluir">🗑</button>
                   </div>`;
              return `<tr>
                <td>${u.nome||"—"}</td>
                <td style="font-size:.78rem">${u.email||"—"}</td>
                <td style="font-size:.78rem">${u.escola||"—"}</td>
                <td style="font-size:.78rem">${u.area ? AREAS_CONHECIMENTO.find(a=>a.id===u.area)?.label||u.area : "—"}</td>
                <td style="font-size:.78rem">${u.disciplinas||"—"}</td>
                <td style="font-size:.78rem">${Array.isArray(u.turmasIds) && u.turmasIds.length ? u.turmasIds.join(", ") : "—"}</td>
                <td>${papelCell}</td>
                <td><span class="prof-status ${statusCls}">${statusLabel}</span></td>
                <td style="font-size:.78rem">${dt}</td>
                <td>${acoes}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    const lista = document.getElementById("usuarios-lista");
    if (lista) lista.innerHTML = `<div style="padding:20px;color:var(--red)">Erro ao carregar usuários.</div>`;
  }
}

async function _aprovarUsuario(uid) {
  const papelSel = document.querySelector(`[onchange*="_alterarPapel('${uid}"]`)?.value || "professor";
  try {
    const db = firebase.firestore();
    // Busca perfil para pegar turmasIds
    const profSnap = await db.collection("professores").doc(uid).get();
    const profData = profSnap.data() || {};
    const turmasIds = Array.isArray(profData.turmasIds) ? profData.turmasIds : [];

    // Se há turmas selecionadas, injeta no diário do professor
    if (turmasIds.length) {
      const turmasDoProf = TURMAS
        .filter(t => turmasIds.includes(t.id))
        .map(t => ({ ...t, profUid: uid }));
      const diarioRef = db.collection("diario").doc(uid);
      const diarioSnap = await diarioRef.get();
      const diarioAtual = diarioSnap.exists ? diarioSnap.data() : {};
      const turmasAtuais = diarioAtual.RT_TURMAS ? JSON.parse(diarioAtual.RT_TURMAS) : [];
      const idsAtuais = new Set(turmasAtuais.map(t => t.id));
      const novas = turmasDoProf.filter(t => !idsAtuais.has(t.id));
      await diarioRef.set({
        ...diarioAtual,
        RT_TURMAS: JSON.stringify([...turmasAtuais, ...novas])
      }, { merge: true });
    }

    await db.collection("professores").doc(uid)
      .update({ status: "aprovado", papel: papelSel });
    _mostrarIndicadorSync(`✓ Aprovado como ${papelSel}${turmasIds.length ? ` · ${turmasIds.length} turma(s) associada(s)` : ""}`);
    _carregarUsuarios();
  } catch(e) { console.error(e); alert("Erro ao aprovar: " + e.message); }
}

async function _rejeitarUsuario(uid) {
  if (!confirm("Rejeitar o acesso deste usuário?")) return;
  try {
    await firebase.firestore().collection("professores").doc(uid).update({ status: "rejeitado" });
    _mostrarIndicadorSync("✓ Acesso rejeitado");
    _carregarUsuarios();
  } catch(e) { alert("Erro ao rejeitar."); }
}

async function _excluirUsuario(uid) {
  if (!confirm("Excluir este usuário? Os dados do diário dele não serão apagados.")) return;
  try {
    await firebase.firestore().collection("professores").doc(uid).delete();
    _mostrarIndicadorSync("✓ Usuário excluído");
    _carregarUsuarios();
  } catch(e) { alert("Erro ao excluir."); }
}

async function _alterarPapel(uid, papel) {
  try {
    await firebase.firestore().collection("professores").doc(uid).update({ papel });
    _mostrarIndicadorSync(`✓ Papel alterado: ${papel}`);
  } catch(e) { alert("Erro ao alterar papel."); }
}

// ════════════════════════════════════════════════════════════
//  PAINEL: DIÁRIOS (coordenador — somente leitura)
// ════════════════════════════════════════════════════════════
function htmlGestaoDiarios() {
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Diários dos professores associados</h3>
        <span id="diarios-count" style="font-size:.8rem;color:var(--text-muted)">Carregando…</span>
      </div>
      <div id="diarios-lista">
        <div style="padding:30px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>
      </div>
    </div>`;
}

async function _carregarDiariosCoord() {
  const lista = document.getElementById("diarios-lista");
  const count = document.getElementById("diarios-count");
  const uids  = _perfilProf?.professoresAssociados || [];
  if (!uids.length) {
    if (lista) lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">
      Nenhum professor associado a você ainda.<br>
      Peça ao administrador para fazer a associação.</div>`;
    if (count) count.textContent = "0 professor(es)";
    return;
  }
  await _carregarDiariosAssociados(uids);
  const qtd = Object.keys(_diariosAssociados).length;
  if (count) count.textContent = `${qtd} professor(es)`;
  if (!lista) return;
  if (!qtd) {
    lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">Nenhum dado encontrado.</div>`;
    return;
  }
  lista.innerHTML = Object.entries(_diariosAssociados).map(([uid, dados]) => {
    const p      = dados.perfil;
    const turmas = dados.RT_TURMAS || [];
    const tags   = turmas.length
      ? turmas.map(t =>
          `<span style="display:inline-block;background:var(--amber-pale);color:var(--amber);
            border-radius:4px;padding:2px 8px;margin:2px;font-weight:600;font-size:.78rem;">
            ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""} · ${t.sigla}
          </span>`).join("")
      : `<em style="color:var(--text-muted);font-size:.8rem;">Sem turmas cadastradas</em>`;
    return `
      <div style="margin-bottom:16px;padding:16px 18px;
        background:var(--bg-paper);border:1px solid var(--border);border-radius:var(--radius);">
        <div style="font-family:'DM Serif Display',serif;font-size:1.05rem;margin-bottom:3px;">
          ${p.nome||uid}
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px;">
          ${p.email||""} · ${p.disciplinas||""}
        </div>
        <div>${tags}</div>
      </div>`;
  }).join("");
}
let contDragIdx = null;
function contDragStart(e, i)  { contDragIdx = i; e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",i); }
function contDragEnter(e, i)  { e.target.closest("tr")?.classList.add("cont-drag-over"); }
function contDrop(e, destIdx) {
  e.preventDefault();
  e.target.closest("tr")?.classList.remove("cont-drag-over");
  if (contDragIdx===null || contDragIdx===destIdx) return;
  const chave = gContChave;
  const lista = RT_CONTEUDOS[chave];
  const [item] = lista.splice(contDragIdx, 1);
  lista.splice(destIdx, 0, item);
  contDragIdx = null;
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      delete ordemConteudos[chaveOrdem(t.id, bimN)];
    }
  }
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}
