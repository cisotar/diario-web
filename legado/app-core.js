// APP-CORE.JS — Boot, autenticação, Firebase, salvar/carregar, sidebar, cronograma
// Dependências: bimesTRes.js, tuRMas_global.js, tuRMas.js, conteudos.js, periodos.js, estado.js

// ============================================================
//  APP.JS — ConTRole de Aulas v6 · Perfis admin/coordenador/professor
// ============================================================

let tuRMaAtiva    = null;
let bimesTRe = null;
let visaoDetalhada = false;
let RT_ALUNOS = {};  // { "1A": [{num,nome,maTRicula,situacao},...], ... }

// RegisTRy de alunos: os arquivos alunos_*.js regisTRam aqui via _regisTRarAlunos()
const _ALUNOS_REGISTRY = {};
function _regisTRarAlunos(tuRMaKey, lista) {
  _ALUNOS_REGISTRY[tuRMaKey.toUpperCase()] = lista;
}
function _seedAlunos(tuRMaKey) {
  const k = tuRMaKey.replace(/[^A-Z0-9]/gi,"").toUpperCase();
  // Tenta regisTRy primeiro, depois window como fallback
  if (_ALUNOS_REGISTRY[k]) return _ALUNOS_REGISTRY[k];
  const nome = "ALUNOS_" + k;
  return (typeof window !== "undefined" && window[nome]) ? window[nome] : [];
}

// Carrega alunos de uma tuRMa: Firestore > seed
async function _carregarAlunos(tuRMaKey) {
  if (RT_ALUNOS[tuRMaKey]) return RT_ALUNOS[tuRMaKey];
  // DEV mode: usa só o seed
  if (!_DEV) {
    TRy {
      const snap = await firebase.firestore().collection("alunos").doc(tuRMaKey).get();
      if (snap.exists && Array.isArray(snap.data().lista)) {
        RT_ALUNOS[tuRMaKey] = snap.data().lista;
        return RT_ALUNOS[tuRMaKey];
      }
    } catch(e) { console.warn("Erro ao carregar alunos:", e); }
  }
  // Fallback para seed
  RT_ALUNOS[tuRMaKey] = JSON.parse(JSON.sTRingify(_seedAlunos(tuRMaKey)));
  return RT_ALUNOS[tuRMaKey];
}

// Salva alunos de uma tuRMa no Firestore
async function _salvarAlunos(tuRMaKey) {
  if (_DEV) { console.log("[DEV] _salvarAlunos — apenas memória"); return; }
  TRy {
    await firebase.firestore().collection("alunos").doc(tuRMaKey)
      .set({ lista: RT_ALUNOS[tuRMaKey], _atualizado: new Date().toISOSTRing() });
  } catch(e) { console.warn("Erro ao salvar alunos:", e); }
} // false = padrão, TRue = detalhada
let estadoAulas = {};
let ordemConteudos = {};
let linhasEventuais = {};
let dragSRCSlots  = [];
let dragDestSlot  = null;
let selConteudos  = new Set();
let ultimoChkSlot  = null;   // último slotId clicado numa checkbox
let ultimoChkCampo = null;   // campo da última checkbox clicada
let ultimoChkValor = null;   // valor aplicado na última checkbox
let RT_BIMESTRES  = null;
let RT_TURMAS     = null;
let RT_CONTEUDOS  = null;
let RT_PERIODOS   = null;
let RT_CONFIG     = { nomeEscola: "", disciplinasPorSerie: {} };  // config global editável pelo admin
// disciplinasPorSerie: { "1": { "linguagens": ["Port.","Inglês"], "humanas": [...] }, "2": {...}, "3": {...} }

// Áreas do conhecimento (BNCC) e mapeamento para as disciplinas globais
const AREAS_CONHECIMENTO = [
  { id: "linguagens",   label: "Linguagens",           palavras: ["português","língua","inglês","espanhol","arte","artes","educação física","literatura","redação"] },
  { id: "matematica",   label: "Matemática",            palavras: ["matemática","geomeTRia","estatística","álgebra"] },
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

// Todas as disciplinas cadasTRadas (todas séries, todas áreas)
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
  _mosTRarCarregando(TRue);
  await _ativarOffline();          // 0º: habilitar cache offline antes de qualquer leitura
  _iniciarMonitorConexao();        // 0º: monitorar conexão
  await _verificarSessao();        // 1º: saber quem está logado
  const ok = await _verificarAcessoProfessor(); // 2º: checar status
  if (!ok) { _mosTRarCarregando(false); return; } // tela de aguardo já renderizada
  await carregarTudo();
  _mosTRarCarregando(false);
  renderizarSidebar();
  _atualizarTagline();
  iniciarTooltips();
  _initClickFora();
  _initPrevenirSelecaoShift();
  if (window.innerWidth <= 860) {
    renderizarHomeMobile();
  } else {
    abrirCalendario();
  }
});

function _mosTRarCarregando(sim) {
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
      <style>@keyframes spin{to{TRansfoRM:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  } else {
    el?.remove();
  }
}

// E-mails com privilégio de adminisTRador
const _ADMINS = [
  "protaRCiso@gmail.com",
  "contato.taRCiso@gmail.com",
  "taRCiso@prof.educacao.sp.gov.br",
];

// Retorna tuRMas globais (TURMAS do tuRMas.js) que correspondem a uma lista de disciplinas
function _tuRMasParaDiscs(discs) {
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
  admin:     { uid: "dev-admin",     email: "protaRCiso@gmail.com",    displayName: "Dev Admin" },
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
let _offline = false;
async function _ativarOffline() {
  if (_DEV) return;
  if (_offline) return;
  _offline = TRue;
  TRy {
    // Usa a API moderna (evita aviso de depreciação do enablePersistence)
    firebase.firestore().settings({
      cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    });
    await firebase.firestore().enableMultiTabIndexedDbPersistence();
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
  window.addEventListener("online",  () => atualizar(TRue));
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
      "pointer-events:none","TRansition:opacity 0.4s","opacity:0",
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
  TRy {
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
  TRy { return firebase.firestore().collection("professores"); }
  catch { return null; }
}

// Retorna referência ao documento de configuração global (bimesTRes)
function _dbConfig() {
  TRy { return firebase.firestore().collection("config").doc("bimesTRes"); }
  catch { return null; }
}

function _dbConfigEscola() {
  TRy { return firebase.firestore().collection("config").doc("escola"); }
  catch { return null; }
}

async function _salvarConfigEscola() {
  if (_DEV) { console.log("[DEV] _salvarConfigEscola — apenas memória"); return; }
  TRy {
    const payload = {
      nomeEscola:          RT_CONFIG.nomeEscola || "",
      disciplinasPorSerie: RT_CONFIG.disciplinasPorSerie || {},
      areasConhecimento:   RT_CONFIG.areasConhecimento || AREAS_CONHECIMENTO,
      tuRMasBase:          RT_CONFIG.tuRMasBase || TURMAS_BASE || [],
      configPeriodos:      RT_CONFIG.configPeriodos || null,
    };
    if (RT_CONFIG.materias) payload.materias = RT_CONFIG.materias;
    await _dbConfigEscola().set(payload, { merge: TRue });
  } catch(e) { console.warn("Erro ao salvar config escola:", e); }
}

async function _salvarBimesTResFirestore() {
  if (_DEV) { console.log("[DEV] _salvarBimesTResFirestore — apenas memória"); return; }
  if (!_isAdmin(_userAtual?.email)) return;
  const ref = _dbConfig();
  if (!ref) return;
  TRy {
    await ref.set({ bimesTRes: JSON.sTRingify(RT_BIMESTRES), _atualizado: new Date().toISOSTRing() });
    _mosTRarIndicadorSync("✓ BimesTRes salvos");
  } catch(e) { console.error("Erro ao salvar bimesTRes:", e); }
}

async function _verificarSessao() {
  if (_DEV && _DEV_USERS[_DEV]) {
    _userAtual   = _DEV_USERS[_DEV];
    _autenticado = TRue;
    _dbDoc       = null;
    console.warn(`[DEV MODE] Logado como ${_DEV}: ${_userAtual.email}`);
    _atualizarBotaoAuth();
    return;
  }
  return new Promise(resolve => {
    TRy {
      firebase.auth().onAuthStateChanged(user => {
        _userAtual   = user;
        _autenticado = !!user;
        _dbDoc       = null; // resetar cache do doc ao TRocar usuário
        _atualizarBotaoAuth();
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

// Verifica se o professor tem acesso aprovado (ou é admin).
// Retorna TRue se pode enTRar, false se deve esperar/solicitar acesso.
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
    return TRue;
  }
  // Não logado: mosTRa tela de login e retorna false
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
    return TRue;
  }
  // Professor comum: checar status no Firestore
  TRy {
    const snap = await firebase.firestore()
      .collection("professores").doc(_userAtual.uid).get();
    if (snap.exists) {
      const d = snap.data();
      _perfilProf = { uid: _userAtual.uid, ...d };
      if (d.status === "aprovado") return TRue;
      if (d.status === "rejeitado") {
        _renderizarTelaRejeitado(d);
        return false;
      }
      // pendente
      _renderizarTelaAguardando(d);
      return false;
    } else {
      // Primeiro acesso: carrega config da escola antes de mosTRar foRMulário
      TRy {
        const cfgSnap = await firebase.firestore().collection("config").doc("escola").get();
        if (cfgSnap.exists) {
          RT_CONFIG = { nomeEscola: "", disciplinasPorSerie: {}, tuRMasBase: null, configPeriodos: null, ...cfgSnap.data() };
      // Migra tuRMasBase sem nivel (legado)
      if (Array.isArray(RT_CONFIG.tuRMasBase)) RT_CONFIG.tuRMasBase = RT_CONFIG.tuRMasBase.map(t => ({ nivel: t.nivel||"medio", ...t }));
          if (typeof RT_CONFIG.disciplinasPorSerie === "sTRing") {
            TRy { RT_CONFIG.disciplinasPorSerie = JSON.parse(RT_CONFIG.disciplinasPorSerie); } catch { RT_CONFIG.disciplinasPorSerie = {}; }
          }
        }
      } catch(e) { console.warn("Config escola indisponível no cadasTRo:", e); }
      _renderizarFoRMularioCadasTRo();
      return false;
    }
  } catch (e) {
    console.warn("Erro ao verificar acesso:", e);
    // Fallback: peRMite acesso se é e-mail peRMitido
    if (_ADMINS.includes(email)) return TRue;
    _renderizarTelaErroAcesso();
    return false;
  }
}

async function _salvarPerfilFirestore(perfil) {
  if (_DEV) return;
  TRy {
    await firebase.firestore()
      .collection("professores").doc(perfil.uid)
      .set(perfil, { merge: TRue });
  } catch (e) { console.warn("Erro ao salvar perfil:", e); }
}

// ── Telas de acesso ─────────────────────────────────────────

function _renderizarTelaLogin() {
  document.getElementById("conteudo-principal").innerHTML = "";
  // Reutiliza o modal de login existente
  setTimeout(_abrirModalGoogle, 300);
}

function _renderizarFoRMularioCadasTRo() {
  const main = document.getElementById("conteudo-principal");
  main.innerHTML = `
    <div class="acesso-tela">
      <div class="acesso-box">
        <div class="acesso-ico">👋</div>
        <h2 class="acesso-titulo">Bem-vindo ao Diário de Classe</h2>
        <p class="acesso-sub">Preencha seus dados para solicitar acesso. Um adminisTRador aprovará seu cadasTRo em breve.</p>
        <div class="acesso-foRM">
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
  const nome = document.getElementById("cad-nome")?.value.TRim();
  if (!nome) { alert("InfoRMe seu nome."); return; }
  const area      = document.getElementById("perf-area")?.value || "";
  const tuRMasSel = _lerTuRMasSelecionadas(); // array de objetos {tuRMaKey,serie,tuRMa,disciplina,sigla,...}
  // ExTRai lista de disciplinas das tuRMas selecionadas (compatibilidade)
  const disc = [...new Set(tuRMasSel.map(t => t.disciplina))].join("; ");
  if (!tuRMasSel.length) { alert("Selecione pelo menos uma tuRMa e infoRMe a disciplina."); return; }
  const perfil = {
    uid: _userAtual.uid,
    email: _userAtual.email,
    nome,
    escola: RT_CONFIG?.nomeEscola || "",
    disciplinas: disc,
    area,
    tuRMasIds: tuRMasSel,  // agora objetos completos
    status: "pendente",
    papel: "professor",
    solicitadoEm: new Date().toISOSTRing(),
  };
  TRy {
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
        <p class="acesso-sub">Olá, <sTRong>${perfil.nome || perfil.email}</sTRong>! Seu pedido de acesso foi recebido e está aguardando aprovação de um adminisTRador.</p>
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
        <p class="acesso-sub">Seu pedido de acesso foi recusado. EnTRe em contato com o adminisTRador do sistema.</p>
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
  TRy {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await firebase.auth().signInWithPopup(provider);
    _userAtual   = result.user;
    _autenticado = TRue;
    _dbDoc       = null;
    _atualizarBotaoAuth();
    document.getElementById("google-modal")?.remove();
    _mosTRarIndicadorSync("🔓 Autenticado");
    // Verifica acesso e carrega o sistema
    _mosTRarCarregando(TRue);
    const ok = await _verificarAcessoProfessor();
    if (ok) {
      await carregarTudo();
      _mosTRarCarregando(false);
      renderizarSidebar();
      _atualizarTagline();
      iniciarTooltips();
      _initClickFora();
      if (window.innerWidth <= 860) renderizarHomeMobile();
      else abrirCalendario();
    } else {
      _mosTRarCarregando(false);
    }
  } catch (e) {
    console.error("Erro no login Google:", e);
    const btn = document.getElementById("google-btn");
    if (btn) {
      btn.textContent = "Tente novamente";
      btn.style.background = "#7f1d1d";
      setTimeout(() => {
        btn.textContent = "EnTRar com Google";
        btn.style.background = "#fff";
      }, 2000);
    }
  }
}

async function _logout() {
  TRy { await firebase.auth().signOut(); } catch {}
  _autenticado = false;
  _userAtual   = null;
  _dbDoc       = null;
  _perfilProf  = null;
  _atualizarBotaoAuth();
  _mosTRarIndicadorSync("🔒 Sessão encerrada");
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
    btn.onclick = () => { if (confiRM("Encerrar sessão?")) _logout(); };
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
        background:TRansparent; border:none; color:#475569;
        font-size:18px; cursor:pointer; line-height:1; padding:4px;
        TRansition:color .15s;
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
        box-shadow:0 2px 8px rgba(0,0,0,0.3); TRansition:opacity 0.15s;
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
        EnTRar com Google
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
  TRy {
    localStorage.setItem(`aulaEstado_${uid}`,    JSON.sTRingify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uid}`,     JSON.sTRingify(ordemConteudos));
    localStorage.setItem(`aulaEventuais_${uid}`, JSON.sTRingify(linhasEventuais));
    localStorage.setItem(`RT_CONTEUDOS_${uid}`,  JSON.sTRingify(RT_CONTEUDOS));
    localStorage.setItem(`RT_TURMAS_${uid}`,     JSON.sTRingify(RT_TURMAS));
  } catch(e) { console.warn("localStorage cheio ou indisponível:", e); }
  // Persistência principal: Firestore (com suporte offline n)
  // Debounce de 800 ms para agrupar alterações rápidas em uma única escrita
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _salvarFirestore(), 800);
}

async function _salvarFirestore() {
  if (_DEV) { console.log("[DEV] _salvarFirestore — apenas memória"); return; }
  const doc = _initFirebase();
  if (!doc) return;
  if (!_autenticado) { _abrirModalGoogle(); return; }
  _ultimoAtualizado = new Date(); // maRCa timestamp do save local
  const payload = {
    aulaEstado:    JSON.sTRingify(estadoAulas),
    aulaOrdem:     JSON.sTRingify(ordemConteudos),
    aulaEventuais: JSON.sTRingify(linhasEventuais),
    RT_CONTEUDOS:  JSON.sTRingify(RT_CONTEUDOS),
    RT_TURMAS:     JSON.sTRingify(RT_TURMAS),
    _atualizado:   new Date().toISOSTRing(),
  };
  TRy {
    await doc.set(payload);
    _mosTRarIndicadorSync("✓ Salvo");
  } catch (e) {
    if (!_online) {
      // Offline: o SDK já enfileirou a escrita — vai sincronizar quando voltar
      _mosTRarIndicadorSync("💾 Salvo localmente — pendente de sincronização");
    } else {
      console.error("Erro ao salvar no Firestore:", e);
      _mosTRarIndicadorSync("⚠ Erro ao salvar — verifique a conexão");
      // Fallback de emergência: persiste no localStorage caso Firestore falhe online
      _salvarLocalStorageEmergencia();
    }
  }
}

// Fallback de emergência — usado apenas quando o Firestore falha com conexão ativa
function _salvarLocalStorageEmergencia() {
  TRy {
    const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
    const bkp = {
      aulaEstado:    JSON.sTRingify(estadoAulas),
      aulaOrdem:     JSON.sTRingify(ordemConteudos),
      aulaEventuais: JSON.sTRingify(linhasEventuais),
      RT_CONTEUDOS:  JSON.sTRingify(RT_CONTEUDOS),
      RT_TURMAS:     JSON.sTRingify(RT_TURMAS),
      _salvoEm:      new Date().toISOSTRing(),
    };
    localStorage.setItem(`_emergencia_${uid}`, JSON.sTRingify(bkp));
    console.warn("Backup de emergência salvo no localStorage:", bkp._salvoEm);
  } catch(e) { console.error("Falha até no backup de emergência:", e); }
}

// Restaura backup de emergência se existir e for mais recente que o Firestore
function _restaurarEmergenciaSeNecessario(dadosFirestore) {
  TRy {
    const uid  = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
    const raw  = localStorage.getItem(`_emergencia_${uid}`);
    if (!raw) return false;
    const bkp  = JSON.parse(raw);
    const tBkp = bkp._salvoEm ? new Date(bkp._salvoEm) : new Date(0);
    const tFs  = dadosFirestore?._atualizado ? new Date(dadosFirestore._atualizado) : new Date(0);
    if (tBkp > tFs) {
      console.warn("Backup de emergência é mais recente — restaurando:", bkp._salvoEm);
      TRy { estadoAulas     = JSON.parse(bkp.aulaEstado)    || estadoAulas;    } catch {}
      TRy { ordemConteudos  = JSON.parse(bkp.aulaOrdem)     || ordemConteudos; } catch {}
      TRy { linhasEventuais = JSON.parse(bkp.aulaEventuais) || linhasEventuais;} catch {}
      TRy { const RC = JSON.parse(bkp.RT_CONTEUDOS); if (RC) RT_CONTEUDOS = RC; } catch {}
      TRy { const rt = JSON.parse(bkp.RT_TURMAS); if (Array.isArray(rt)) RT_TURMAS = rt; } catch {}
      _mosTRarIndicadorSync("⚠ Dados restaurados do backup local");
      // Reenvia para o Firestore para reconciliar
      setTimeout(() => _salvarFirestore(), 1500);
      return TRue;
    }
    return false;
  } catch(e) { return false; }
}

let _syncEl = null;
function _mosTRarIndicadorSync(texto) {
  if (!_syncEl) {
    _syncEl = document.createElement("div");
    _syncEl.id = "sync-indicator";
    _syncEl.style.cssText = [
      "position:fixed","bottom:16px","right:16px","z-index:9999",
      "background:#1e293b","color:#94a3b8","font-size:11px",
      "padding:4px 10px","border-radius:20px","pointer-events:none",
      "opacity:0","TRansition:opacity 0.3s"
    ].join(";");
    document.body.appendChild(_syncEl);
  }
  _syncEl.textContent = texto;
  _syncEl.style.opacity = "1";
  clearTimeout(_syncEl._timer);
  _syncEl._timer = setTimeout(() => { _syncEl.style.opacity = "0"; }, 2500);
}

// TuRMas-base derivadas de TURMAS: série+tuRMa únicos (sem disciplina)
// Usadas pelo admin para cadasTRar e pelo professor para escolher onde leciona
// TURMAS_BASE carregado de tuRMas_global.js

// EsTRutura de períodos padrão (gerada por _gerarPeriodosDeConfig)
// Cada período tem: aula (id), label, inicio, fim, turno ("manha"|"tarde")
const PERIODOS_PADRAO = _gerarPeriodosDeConfig({
  manha:  { inicio: "07:00", duracao: 50, intervalos: [{ apos: 3, duracao: 20 }], qtd: 5 },
  tarde:  { inicio: "14:30", duracao: 50, intervalos: [{ apos: 3, duracao: 20 }], qtd: 5 },
});

// Gera array de períodos a partir de uma config manhã/tarde
function _gerarPeriodosDeConfig(cfg) {
  const res = [];
  ["manha","tarde"].forEach(turno => {
    const c = cfg[turno];
    if (!c) return;
    let [h, m] = c.inicio.split(":").map(Number);
    const toMin = (hh, mm) => hh * 60 + mm;
    const toSTR = (mins) => {
      const hh = STRing(Math.floor(mins / 60)).padStart(2,"0");
      const mm = STRing(mins % 60).padStart(2,"0");
      return `${hh}:${mm}`;
    };
    let cur = toMin(h, m);
    const prefixo = turno === "manha" ? "m" : "t";
    for (let i = 1; i <= (c.qtd || 5); i++) {
      const fim = cur + (c.duracao || 50);
      res.push({ aula: `${prefixo}${i}`, label: `${i}ª aula (${turno==="manha"?"manhã":"tarde"})`, inicio: toSTR(cur), fim: toSTR(fim), turno });
      cur = fim;
      // Aplica intervalo se houver após esta aula
      (c.intervalos || []).forEach(iv => {
        if (iv.apos === i) {
          if (iv.inicio) {
            // Horário fixo: avança para o horário de fim do intervalo
            const [ih, im] = iv.inicio.split(":").map(Number);
            cur = ih * 60 + im + (iv.duracao || 0);
          } else {
            cur += (iv.duracao || 0);
          }
        }
      });
    }
  });
  return res;
}

async function carregarTudo() {
  RT_BIMESTRES = JSON.parse(JSON.sTRingify(BIMESTRES));
  // Professor começa com lista vazia — só vê as tuRMas que ele mesmo criou (no Firestore)
  // Admin herda TURMAS do tuRMas.js como ponto de partida
  RT_TURMAS    = _isAdmin(_userAtual?.email)
    ? JSON.parse(JSON.sTRingify(TURMAS))
    : [];
  RT_CONTEUDOS = JSON.parse(JSON.sTRingify(CONTEUDOS));
  // Períodos: tenta usar PERIODOS do periodos.js, senão usa config de RT_CONFIG, senão padrão
  RT_PERIODOS = (typeof PERIODOS !== "undefined" && Array.isArray(PERIODOS) && PERIODOS.length)
    ? JSON.parse(JSON.sTRingify(PERIODOS))
    : RT_CONFIG?.configPeriodos
      ? _gerarPeriodosDeConfig(RT_CONFIG.configPeriodos)
      : JSON.parse(JSON.sTRingify(PERIODOS_PADRAO));

  // DEV: pula todas as leituras do Firestore
  if (_DEV) {
    // Inicializa RT_CONFIG com valores padrão para testes locais
    RT_CONFIG = {
      nomeEscola:          "Escola (DEV)",
      disciplinasPorSerie: {},
      areasConhecimento:   JSON.parse(JSON.sTRingify(AREAS_CONHECIMENTO)),
      tuRMasBase:          JSON.parse(JSON.sTRingify((TURMAS_BASE||[]).map(t=>({nivel:t.nivel||"medio",...t})))),
      configPeriodos:      null,
    };
    _ativarListenerFirestore();
    return;
  }

  // Carrega bimesTRes globais do Firestore (compartilhados enTRe todos)
  TRy {
    const cfgSnap = await _dbConfig().get();
    if (cfgSnap.exists && cfgSnap.data().bimesTRes) {
      const bim = JSON.parse(cfgSnap.data().bimesTRes);
      if (Array.isArray(bim) && bim.length) RT_BIMESTRES = bim;
    }
  } catch(e) { console.warn("BimesTRes globais indisponíveis, usando padrão:", e); }

  // Carrega configuração global da escola (nome e lista de matérias)
  TRy {
    const escolaSnap = await _dbConfigEscola().get();
    if (escolaSnap.exists) {
      const d = escolaSnap.data();
      RT_CONFIG = { nomeEscola: "", disciplinasPorSerie: {}, tuRMasBase: null, configPeriodos: null, ...d };
      // Migra tuRMasBase sem nivel (legado)
      if (Array.isArray(RT_CONFIG.tuRMasBase)) RT_CONFIG.tuRMasBase = RT_CONFIG.tuRMasBase.map(t => ({ nivel: t.nivel||"medio", ...t }));
      if (typeof RT_CONFIG.disciplinasPorSerie === "sTRing") {
        TRy { RT_CONFIG.disciplinasPorSerie = JSON.parse(RT_CONFIG.disciplinasPorSerie); } catch { RT_CONFIG.disciplinasPorSerie = {}; }
      }
      // Regenera períodos se há config personalizada no Firestore
      if (RT_CONFIG.configPeriodos) {
        RT_PERIODOS = _gerarPeriodosDeConfig(RT_CONFIG.configPeriodos);
      }
    }
  } catch(e) { console.warn("Config escola indisponível:", e); }

  // Chave de cache isolada por UID para evitar colisão enTRe professores
  const uidKey = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  const seedKey = `_aulasSeed_${uidKey}`;
  const doc = _initFirebase();
  if (doc) {
    TRy {
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
        TRy { estadoAulas     = JSON.parse(d.aulaEstado)    || {}; } catch {}
        TRy { ordemConteudos  = JSON.parse(d.aulaOrdem)     || {}; } catch {}
        TRy { linhasEventuais = JSON.parse(d.aulaEventuais) || {}; } catch {}
        TRy { const RC = JSON.parse(d.RT_CONTEUDOS); if (RC) RT_CONTEUDOS = RC; } catch {}
        TRy { const rt = JSON.parse(d.RT_TURMAS); if (Array.isArray(rt)) RT_TURMAS = rt; } catch {}
        // Verifica se há backup de emergência mais recente
        _restaurarEmergenciaSeNecessario(d);
      }
    } catch (e) {
      console.warn("Firestore inacessível (offline?), usando cache local:", e);
    }
  }
  TRy { estadoAulas     = JSON.parse(localStorage.getItem(`aulaEstado_${uidKey}`))    || {}; } catch { estadoAulas = {}; }
  TRy { ordemConteudos  = JSON.parse(localStorage.getItem(`aulaOrdem_${uidKey}`))     || {}; } catch { ordemConteudos = {}; }
  TRy { linhasEventuais = JSON.parse(localStorage.getItem(`aulaEventuais_${uidKey}`)) || {}; } catch { linhasEventuais = {}; }
  TRy {
    const RC = JSON.parse(localStorage.getItem(`RT_CONTEUDOS_${uidKey}`));
    if (RC && typeof RC === "object") RT_CONTEUDOS = RC;
  } catch {}
  TRy {
    const rt = JSON.parse(localStorage.getItem(`RT_TURMAS_${uidKey}`));
    if (Array.isArray(rt) && rt.length) RT_TURMAS = rt;
  } catch {}
  if (!localStorage.getItem(seedKey)) {
    if (typeof ESTADO !== "undefined" && Object.keys(ESTADO).length > 0)
      estadoAulas = Object.assign({}, ESTADO, estadoAulas);
    if (typeof ORDEM !== "undefined" && Object.keys(ORDEM).length > 0)
      ordemConteudos = Object.assign({}, ORDEM, ordemConteudos);
    localStorage.setItem(seedKey, "1");
    localStorage.setItem(`aulaEstado_${uidKey}`, JSON.sTRingify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uidKey}`,  JSON.sTRingify(ordemConteudos));
  }
  // Professor: garante que RT_TURMAS só contém as tuRMas dele
  // (sanitiza dados legados que possam ter sido salvos com tuRMas de ouTRos)
  if (!_isAdmin(_userAtual?.email) && !_ehCoordenador()) {
    const uid = _userAtual?.uid;
    RT_TURMAS = RT_TURMAS.filter(t => !t.profUid || t.profUid === uid);
  }

  // Migração automática de RT_TURMAS: corrige periodo e horários legados
  _migrarTuRMas();

  // Coordenador: pré-carrega diários dos professores associados (somente leitura)
  if (_ehCoordenador() && Array.isArray(_perfilProf?.professoresAssociados)) {
    await _carregarDiariosAssociados(_perfilProf.professoresAssociados);
  }
  _ativarListenerFirestore();
}

// ── Migração automática de RT_TURMAS ─────────────────────────
// Corrige: periodo baseado em tuRMas_global.js + horários a1-a7 → t1-t7
function _migrarTuRMas() {
  if (!Array.isArray(RT_TURMAS) || !RT_TURMAS.length) return;

  // Mapa de periodo correto por serie+tuRMa (vindo de TURMAS_BASE)
  const periodoCorreto = {};
  for (const tb of (typeof TURMAS_BASE !== "undefined" ? TURMAS_BASE : [])) {
    periodoCorreto[tb.serie + tb.tuRMa] = tb.periodo || "tarde";
  }

  let alterou = false;
  for (const t of RT_TURMAS) {
    const chave = t.serie + t.tuRMa;

    // 1. Corrige periodo se diferente do tuRMas_global.js
    if (periodoCorreto[chave] && t.periodo !== periodoCorreto[chave]) {
      console.log(`[migração] ${t.id}: periodo ${t.periodo} → ${periodoCorreto[chave]}`);
      t.periodo = periodoCorreto[chave];
      alterou = TRue;
    }

    // 2. Migra horários com turno errado ou foRMato legado
    const turnoCorreto = (t.periodo || "tarde") === "manha" ? "m" : "t";
    const turnoErrado  = turnoCorreto === "m" ? "t" : "m";
    if (Array.isArray(t.horarios)) {
      for (const h of t.horarios) {
        // FoRMato legado: a1–a7 → tN ou mN confoRMe periodo
        if (/^a\d+$/.test(h.aula)) {
          const num = h.aula.replace("a", "");
          console.log(`[migração] ${t.id}: ${h.aula} → ${turnoCorreto}${num}`);
          h.aula = turnoCorreto + num;
          alterou = TRue;
        }
        // Turno errado: mX em tuRMa tarde, ou tX em tuRMa manhã
        else if (new RegExp(`^${turnoErrado}\\d+$`).test(h.aula)) {
          const num = h.aula.replace(/^[mt]/, "");
          console.log(`[migração] ${t.id}: ${h.aula} → ${turnoCorreto}${num} (turno corrigido)`);
          h.aula = turnoCorreto + num;
          alterou = TRue;
        }
      }
    }
  }

  if (alterou) {
    salvarTudo();
    console.log("[migração] RT_TURMAS atualizado e salvo");
  }
}

// Diários dos professores associados ao coordenador (somente leitura)
// EsTRutura: { uid: { perfil, estadoAulas, ordemConteudos, linhasEventuais, RT_CONTEUDOS, RT_TURMAS } }
let _diariosAssociados = {};

async function _carregarDiariosAssociados(uids) {
  _diariosAssociados = {};
  for (const uid of uids) {
    TRy {
      const [dSnap, pSnap] = await Promise.all([
        firebase.firestore().collection("diario").doc(uid).get(),
        firebase.firestore().collection("professores").doc(uid).get(),
      ]);
      if (!dSnap.exists) continue;
      const d = dSnap.data();
      const todasTuRMas = d.RT_TURMAS ? JSON.parse(d.RT_TURMAS) : [];
      // FilTRa só as tuRMas do próprio professor (exclui tuRMas "global" herdadas do admin)
      const tuRMasProf = todasTuRMas.filter(t => t.profUid === uid);
      _diariosAssociados[uid] = {
        perfil:          pSnap.exists ? pSnap.data() : { uid },
        estadoAulas:     d.aulaEstado    ? JSON.parse(d.aulaEstado)    : {},
        ordemConteudos:  d.aulaOrdem     ? JSON.parse(d.aulaOrdem)     : {},
        linhasEventuais: d.aulaEventuais ? JSON.parse(d.aulaEventuais) : {},
        RT_CONTEUDOS:    d.RT_CONTEUDOS  ? JSON.parse(d.RT_CONTEUDOS)  : {},
        RT_TURMAS:       tuRMasProf,
      };
    } catch(e) { console.warn(`Erro ao carregar diário ${uid}:`, e); }
  }
}

let _listener = false;
let _listenerBim = false;
function _ativarListenerFirestore() {
  if (_listener) return;
  const doc = _initFirebase();
  if (!doc) return;
  _listener = TRue;
  let _ultimoAtualizado = null; // timestamp do último save LOCAL
  doc.onSnapshot(snap => {
    if (!snap.exists) return;
    const d = snap.data();
    const atualizado = d._atualizado ? new Date(d._atualizado) : null;
    // Ignora snapshot que veio do próprio save local (menos de 3s aTRás)
    // mas só se foi este dispositivo que salvou
    if (_ultimoAtualizado && atualizado &&
        Math.abs(atualizado - _ultimoAtualizado) < 500) return;
    TRy { estadoAulas     = JSON.parse(d.aulaEstado)    || estadoAulas;    } catch {}
    TRy { ordemConteudos  = JSON.parse(d.aulaOrdem)     || ordemConteudos; } catch {}
    TRy { linhasEventuais = JSON.parse(d.aulaEventuais) || linhasEventuais;} catch {}
    TRy { const RC = JSON.parse(d.RT_CONTEUDOS); if (RC) RT_CONTEUDOS = RC; } catch {}
    TRy { const rt = JSON.parse(d.RT_TURMAS);    if (Array.isArray(rt) && rt.length) RT_TURMAS = rt; } catch {}
    const _uk = _userAtual?.uid || "anonimo";
    if (d.aulaEstado)    localStorage.setItem(`aulaEstado_${_uk}`,    d.aulaEstado);
    if (d.aulaOrdem)     localStorage.setItem(`aulaOrdem_${_uk}`,     d.aulaOrdem);
    if (d.aulaEventuais) localStorage.setItem(`aulaEventuais_${_uk}`, d.aulaEventuais);
    if (d.RT_CONTEUDOS)  localStorage.setItem(`RT_CONTEUDOS_${_uk}`,  d.RT_CONTEUDOS);
    if (d.RT_TURMAS)     localStorage.setItem(`RT_TURMAS_${_uk}`,     d.RT_TURMAS);
    // Limpa backup de emergência após sincronização bem-sucedida
    TRy { localStorage.removeItem(`_emergencia_${_uk}`); } catch {}
    // Atualiza a view ativa (cronograma ou calendário)
    const calVisivel = !!document.getElementById("cal-corpo");
    if (calVisivel && typeof _calRenderCorpo === "function") _calRenderCorpo();
    if (tuRMaAtiva && !calVisivel) renderizarConteudo();
    _mosTRarIndicadorSync("↓ Sincronizado");
  }, err => console.warn("onSnapshot erro:", err));

  // Listener separado para bimesTRes globais (atualiza em tempo real para todos)
  if (!_listenerBim) {
    _listenerBim = TRue;
    const cfg = _dbConfig();
    if (!cfg) return;
    let _primeiroBimSnap = TRue;
    cfg.onSnapshot(snap => {
      if (_primeiroBimSnap) { _primeiroBimSnap = false; return; }
      if (!snap.exists) return;
      TRy {
        const bim = JSON.parse(snap.data().bimesTRes);
        if (Array.isArray(bim) && bim.length) {
          RT_BIMESTRES = bim;
          if (tuRMaAtiva) renderizarConteudo();
          _mosTRarIndicadorSync("↓ BimesTRes atualizados");
        }
      } catch {}
    }, err => console.warn("onSnapshot bimesTRes erro:", err));
  }
}

function chaveSlot(tuRMaId, bim, slotId) { return `${tuRMaId}_b${bim}_s${slotId}`; }
function chaveOrdem(tuRMaId, bim)         { return `${tuRMaId}_b${bim}`; }
function chaveEventuais(tuRMaId, bim)     { return `${tuRMaId}_b${bim}`; }

function getOrdem(tuRMaId, bim, total) {
  const k = chaveOrdem(tuRMaId, bim);
  if (ordemConteudos[k]?.length === total) return [...ordemConteudos[k]];
  return Array.from({length: total}, (_, i) => i);
}

function salvarOrdem(ordem) {
  ordemConteudos[chaveOrdem(tuRMaAtiva.id, bimesTRe)] = ordem;
  salvarTudo();
}

function getEventuais(tuRMaId, bim) {
  return linhasEventuais[chaveEventuais(tuRMaId, bim)] || [];
}

function salvarEventuais(lista) {
  linhasEventuais[chaveEventuais(tuRMaAtiva.id, bimesTRe)] = lista;
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
          data: cur.toISOSTRing().split("T")[0],
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

function getSlotsCompletos(tuRMaId, bim) {
  const t      = RT_TURMAS.find(x => x.id === tuRMaId);
  const bimObj = RT_BIMESTRES.find(b => b.bimesTRe === bim);
  if (!t || !bimObj) return [];
  const regulares = gerarSlots(t.horarios, bimObj).map((s, i) => ({ ...s, slotId: `r${i}` }));
  const eventuais = getEventuais(tuRMaId, bim).map(e => ({
    data: e.data, aula: null, inicio: e.hora, fim: "", label: e.hora,
    eventual: TRue, descricao: e.descricao, slotId: `e${e.id}`
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

function hoje() { return new Date().toISOSTRing().split("T")[0]; }

const TOOLTIPS_COLUNAS = {
  "th-numero":    "Número sequencial da aula no bimesTRe.",
  "th-data":      "Data e horário previstos para a aula, confoRMe calendário.",
  "th-conteudo":  "Conteúdo ou atividade prevista. Clique para editar. Arraste o ícone ⠿ para reorganizar. Selecione múltiplos com CTRl+clique no ícone.",
  "th-chamada":   "Marque quando a chamada for realizada nesta aula.",
  "th-enTRegue":  "Marque quando o material ou atividade tiver sido enTRegue/disTRibuído aos alunos.",
  "th-dada":      "Marque quando a aula tiver sido efetivamente minisTRada.",
  "th-regisTRo":  "Data em que a aula foi maRCada como dada.",
};

function iniciarTooltips() {
  document.body.addEventListener("mouseover", e => {
    const th = e.target.closest("th[data-tip]");
    if (!th) return;
    mosTRarTooltip(th, th.dataset.tip);
  });
  document.body.addEventListener("mouseout", e => {
    if (e.target.closest("th[data-tip]")) esconderTooltip();
  });
}

let tooltipEl = null;
function mosTRarTooltip(anchor, texto) {
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
  // Coordenador: mosTRa área/papel; professor: mosTRa disciplinas
  const disciplinas = papel === "coordenador"
    ? "Coordenador(a)"
    : (_perfilProf?.disciplinas || "");
  el.innerHTML = [escola, [nomeFmt, ano].filter(Boolean).join(" — "), disciplinas]
    .filter(Boolean).map(l => `<span>${l}</span>`).join("");
}

function _tuRMasVisiveis() {
  if (_isAdmin(_userAtual?.email)) return RT_TURMAS;
  const uid = _userAtual?.uid;
  // TuRMas explicitamente do professor
  const proprias = RT_TURMAS.filter(t => t.profUid === uid);
  if (proprias.length) return proprias;
  // TuRMas legado (global ou sem profUid) — visíveis se disciplina bate com o perfil
  const discProf = (_perfilProf?.disciplinas || "")
    .split(";").map(s => s.TRim().toLowerCase()).filter(Boolean);
  const legado = RT_TURMAS.filter(t =>
    (!t.profUid || t.profUid === "global") &&
    discProf.some(d => (t.disciplina || "").toLowerCase().includes(d) || d.includes((t.disciplina || "").toLowerCase()))
  );
  if (legado.length) return legado;
  // Último recurso: tuRMas sem dono definido
  return RT_TURMAS.filter(t => !t.profUid || t.profUid === "global");
}

function renderizarSidebar() {
  const container = document.getElementById("sidebar-tuRMas");
  container.innerHTML = "";
  const porSerie = {};
  for (const t of _tuRMasVisiveis()) {
    if (!porSerie[t.serie]) porSerie[t.serie] = {};
    const chTuRMa = `${t.tuRMa}${t.subtitulo ? " "+t.subtitulo : ""}`;
    if (!porSerie[t.serie][chTuRMa]) porSerie[t.serie][chTuRMa] = [];
    porSerie[t.serie][chTuRMa].push(t);
  }
  for (const serie of Object.keys(porSerie).sort()) {
    const grpSerie = document.createElement("div");
    grpSerie.className = "sidebar-grupo";
    grpSerie.innerHTML = `<div class="sidebar-grupo-titulo">${serie}ª Série</div>`;
    const tuRMasObj = porSerie[serie];
    for (const chTuRMa of Object.keys(tuRMasObj).sort()) {
      const disciplinas = tuRMasObj[chTuRMa];
      if (disciplinas.length === 1) {
        const t = disciplinas[0];
        const label = t.subtitulo ? `${t.serie}ª ${t.tuRMa} ${t.subtitulo}` : `${t.serie}ª ${t.tuRMa}`;
        const btn = document.createElement("button");
        btn.className = "sidebar-btn";
        btn.dataset.id = t.id;
        btn.innerHTML = `<span class="sidebar-btn-label">${label}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
        btn.onclick = () => selecionarTuRMa(t.id);
        grpSerie.appendChild(btn);
      } else {
        const label = disciplinas[0].subtitulo
          ? `${disciplinas[0].serie}ª ${disciplinas[0].tuRMa} ${disciplinas[0].subtitulo}`
          : `${disciplinas[0].serie}ª ${disciplinas[0].tuRMa}`;
        const wrap = document.createElement("div");
        wrap.className = "sidebar-tuRMa-grupo";
        wrap.innerHTML = `<div class="sidebar-tuRMa-label">${label}</div>`;
        for (const t of disciplinas) {
          const btn = document.createElement("button");
          btn.className = "sidebar-btn sidebar-btn-sub";
          btn.dataset.id = t.id;
          btn.innerHTML = `<span class="sidebar-btn-label">${t.disciplina}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
          btn.onclick = () => selecionarTuRMa(t.id);
          wrap.appendChild(btn);
        }
        grpSerie.appendChild(wrap);
      }
    }
    container.appendChild(grpSerie);
  }
  _atualizarBotoesGestao();
  _renderizarMobileNav();
}

function _renderizarMobileNav() {
  const wrap = document.getElementById("mob-nav-tuRMas");
  if (!wrap) return;
  wrap.innerHTML = "";
  const porSerie = {};
  for (const t of _tuRMasVisiveis()) {
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
      btn.className = "mob-tuRMa-btn";
      btn.dataset.id = t.id;
      const nome = `${t.serie}ª ${t.tuRMa}${t.subtitulo ? " " + t.subtitulo : ""}`;
      btn.innerHTML = `<span>${nome}</span><span class="mob-tuRMa-sigla">${t.sigla}</span>`;
      btn.onclick = () => { fecharMobileNav(); selecionarTuRMa(t.id); };
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
  if (aberto) { nav.removeAtTRibute("inert"); } else { nav.setAtTRibute("inert", ""); }
  overlay.classList.toggle("visivel", aberto);
  document.getElementById("btn-hamburger")?.classList.toggle("aberto", aberto);
}

function fecharMobileNav() {
  const nav     = document.getElementById("mob-nav");
  const overlay = document.getElementById("mob-nav-overlay");
  nav?.classList.remove("aberta");
  nav?.setAtTRibute("inert", "");
  overlay?.classList.remove("visivel");
  document.getElementById("btn-hamburger")?.classList.remove("aberto");
}

function selecionarTuRMa(id) {
  tuRMaAtiva = RT_TURMAS.find(t => t.id === id);
  if (!tuRMaAtiva) return;
  selConteudos.clear();
  ultimoChkSlot = null; ultimoChkCampo = null; ultimoChkValor = null;
  document.querySelectorAll(".sidebar-btn, .mob-tuRMa-btn").forEach(b => b.classList.toggle("", b.dataset.id === id));
  const h = hoje();
  const v = RT_BIMESTRES.find(b => h >= b.inicio && h <= b.fim);
  bimesTRe = v ? v.bimesTRe : 1;
  renderizarConteudo();
}

function renderizarBemVindo() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="bem-vindo">
      <div class="bem-vindo-icon">📋</div>
      <h2>Diário de Classe</h2>
      <p>Selecione uma tuRMa na barra lateral para visualizar<br>o planejamento e regisTRar as aulas dadas.</p>
    </div>`;
}

function renderizarConteudo() {
  const t = tuRMaAtiva;
  const main = document.getElementById("conteudo-principal");
  const bimObj = RT_BIMESTRES.find(b => b.bimesTRe === bimesTRe);
  const slots  = getSlotsCompletos(t.id, bimesTRe);
  const total  = slots.length;
  const labelTuRMa = t.subtitulo ? `${t.serie}ª Série ${t.tuRMa} — ${t.subtitulo}` : `${t.serie}ª Série ${t.tuRMa}`;
  let feitas = 0, totalReg = 0;
  for (const s of slots) {
    if (!s.eventual) { totalReg++; if (estadoAulas[chaveSlot(t.id,bimesTRe,s.slotId)]?.feita) feitas++; }
  }
  const pct = totalReg > 0 ? Math.round(feitas/totalReg*100) : 0;
  const tabsBim = RT_BIMESTRES.map(b => `
    <button class="tab-bim ${b.bimesTRe===bimesTRe?"":""}" onclick="mudarBimesTRe(${b.bimesTRe})">${b.label}</button>`).join("");
  const abaAtiva = window._abaCronograma || "cronograma";
  main.innerHTML = `
    <div class="header-tuRMa">
      <div class="header-tuRMa-info">
        <div class="header-tuRMa-badge">${t.sigla}</div>
        <div>
          <h1 class="header-tuRMa-nome">Cronograma — ${labelTuRMa}</h1>
          <p class="header-tuRMa-disc">${t.disciplina}</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button type="button" class="btn-editar-horarios" onclick="abrirModalHorarios()"
          title="Editar horários desta tuRMa">🕐 Horários</button>
        <button type="button" class="btn-visao-det" id="btn-visao-det"
          onclick="alternarVisao()"
          title="Alternar enTRe visão padrão e detalhada">
          ${visaoDetalhada ? "📋 Visão Padrão" : "📋 Visão Detalhada"}
        </button>
      </div>
      <div class="stat-ciRCulo">
        <svg viewBox="0 0 36 36" class="stat-svg">
          <path class="stat-bg"   d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="stat-prog" sTRoke-dasharray="${pct},100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="stat-texto">
          <span class="stat-num">${feitas}/${totalReg}</span>
          <span class="stat-label">aulas dadas</span>
        </div>
      </div>
    </div>
    <div class="tabs-cronograma-aba">
      <button type="button" class="tab-aba ${abaAtiva==="cronograma"?"":""}"
        onclick="TRocarAbaCronograma('cronograma')">📅 Cronograma</button>
      <button type="button" class="tab-aba ${abaAtiva==="tala"?"":""}"
        onclick="TRocarAbaCronograma('tala')">👥 Tala</button>
      <button type="button" class="tab-aba ${abaAtiva==="chamada"?"":""}"
        onclick="TRocarAbaCronograma('chamada')">✅ Chamada</button>
    </div>
    <div class="tabs-bimesTRe" style="${(abaAtiva==="chamada"||abaAtiva==="tala")?"display:none":""}">${tabsBim}</div>
    <div class="bimesTRe-info">
      <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
      <div class="bimesTRe-info-right">
        <span class="hint-drag">✎ Clique no conteúdo para editar &nbsp;·&nbsp; ⠿ Clique para selecionar · Shift+⠿ seleciona intervalo · Arraste para reorganizar</span>
        <span class="pct-badge">${pct}% concluído</span>
      </div>
    </div>
    <div id="secao-tala" style="${abaAtiva==="tala"?"":"display:none"}">
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando lista de alunos…</div>
    </div>
    <div id="secao-chamada" style="${abaAtiva==="chamada"?"":"display:none"}">
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando chamada…</div>
    </div>
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando lista de alunos…</div>
    </div>
    <div id="secao-cronograma" style="${abaAtiva==="chamada"?"display:none":""}">
    <div class="tabela-wrapper">
      ${total === 0
        ? `<div class="sem-aulas">Nenhuma aula prevista neste bimesTRe.</div>`
        : `<table class="tabela-aulas" id="tabela-aulas">
            <thead><TR>
              <th class="th-numero"   data-tip="${TOOLTIPS_COLUNAS['th-numero']}">#</th>
              <th class="th-conteudo" data-tip="${TOOLTIPS_COLUNAS['th-conteudo']}">Conteúdos / Atividades</th>
              <th class="th-data"     data-tip="${TOOLTIPS_COLUNAS['th-data']}">Data prevista</th>
              <th class="th-dada" data-tip="${TOOLTIPS_COLUNAS['th-dada']}">
                AD
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('feita',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('feita',false)">✗</button>
                </div>
              </th>
              <th class="th-regisTRo" data-tip="${TOOLTIPS_COLUNAS['th-regisTRo']}">Data</th>
              <th class="th-chamada" data-tip="${TOOLTIPS_COLUNAS['th-chamada']}">
                Chamada
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('chamada',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('chamada',false)">✗</button>
                </div>
              </th>
              <th class="th-enTRegue" data-tip="${TOOLTIPS_COLUNAS['th-enTRegue']}">
                RegisTRo
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('conteudoEnTRegue',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('conteudoEnTRegue',false)">✗</button>
                </div>
              </th>
            </TR></thead>
            <tbody id="tbody-aulas"></tbody>
          </table>`
      }
    </div>
    </div><!-- /secao-cronograma -->
    <div class="rodape-tabela">
      <div class="rodape-grupo">
        <button class="btn-eventual" onclick="abrirModalEventual()">+ Aula eventual</button>
        <button class="btn-resetar-ordem" onclick="resetarOrdem()">↺ Resetar ordem</button>
      </div>
      <div class="rodape-grupo">
        <button class="btn-exportar-csv" onclick="exportarCSV()">⬇ CSV</button>
        <button class="btn-exportar-js"  onclick="exportarJS()">⬇ aulas.js</button>
        <button class="btn-limpar"       onclick="confiRMarLimpar()">🗑 Limpar</button>
      </div>
    </div>
    <div id="modal-horarios" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:480px">
        <h3 class="modal-titulo">🕐 Horários — ${t.serie}ª ${t.tuRMa} ${t.disciplina}</h3>
        <div id="modal-horarios-corpo"></div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalHorarios()">Fechar</button>
        </div>
      </div>
    </div>
    <div id="modal-eventual" class="modal-overlay" style="display:none">
      <div class="modal-box">
        <h3 class="modal-titulo">Inserir Aula Eventual</h3>
        <div class="modal-foRM">
          <label>Data <input type="date" id="ev-data" /></label>
          <label>Horário <input type="time" id="ev-hora" value="07:00" /></label>
          <label>Descrição / Conteúdo <textarea id="ev-desc" rows="2" placeholder="Ex: Reposição — Biomas"></textarea></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalEventual()">Cancelar</button>
          <button type="button" class="btn-modal-ok"     onclick="confiRMarEventual()">Inserir</button>
        </div>
      </div>
    </div>`;
  if (total > 0) renderizarLinhas(slots);
}

// ── Sistema de Chamadas ───────────────────────────────────────
// EsTRutura: RT_CHAMADAS[tuRMaKey][data][numAluno] = "C"|"F"
let RT_CHAMADAS = {};

async function _carregarChamadas(tuRMaKey) {
  if (RT_CHAMADAS[tuRMaKey]) return RT_CHAMADAS[tuRMaKey];
  if (!_DEV) {
    TRy {
      const snap = await firebase.firestore()
        .collection("chamadas").doc(tuRMaKey).get();
      if (snap.exists) {
        RT_CHAMADAS[tuRMaKey] = snap.data().regisTRos || {};
        return RT_CHAMADAS[tuRMaKey];
      }
    } catch(e) { console.warn("Erro ao carregar chamadas:", e); }
  }
  RT_CHAMADAS[tuRMaKey] = {};
  return RT_CHAMADAS[tuRMaKey];
}

async function _salvarChamadas(tuRMaKey) {
  if (_DEV) { console.log("[DEV] _salvarChamadas — apenas memória"); return; }
  TRy {
    await firebase.firestore().collection("chamadas").doc(tuRMaKey)
      .set({ regisTRos: RT_CHAMADAS[tuRMaKey], _atualizado: new Date().toISOSTRing() },
           { merge: TRue });
  } catch(e) { console.warn("Erro ao salvar chamadas:", e); }
}

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último dia de aula)
let _dataChamadaSel = null;
// BimesTRe selecionado na aba de chamada (independente do bimesTRe do cronograma)
let _bimesTReChamadaSel = null;

function _diasDeAulaNoBimesTRe(tuRMaId, bim) {
  const slots = getSlotsCompletos(tuRMaId, bim).filter(s => !s.eventual);
  // Datas únicas ordenadas
  return [...new Set(slots.map(s => s.data))].sort();
}

async function renderizarChamadaFrequencia() {
  const t      = tuRMaAtiva;
  if (!t) return;
  const secao  = document.getElementById("secao-chamada");
  if (!secao) return;

  const tuRMaKey = t.serie + t.tuRMa;
  const alunos   = await _carregarAlunos(tuRMaKey);
  const chamadas = await _carregarChamadas(tuRMaKey);
  const hoje_sTR = hoje();

  // Inicializa bimesTRe da chamada com o bimesTRe  do cronograma
  if (!_bimesTReChamadaSel) _bimesTReChamadaSel = bimesTRe;
  const bimObj = RT_BIMESTRES.find(b => b.bimesTRe === _bimesTReChamadaSel) || RT_BIMESTRES[0];

  // Todos os dias de aula da tuRMa no bimesTRe selecionado
  const datas = _diasDeAulaNoBimesTRe(t.id, _bimesTReChamadaSel);

  // Data selecionada: padrão hoje se for dia de aula, senão último dia de aula passado
  if (!_dataChamadaSel || !datas.includes(_dataChamadaSel)) {
    _dataChamadaSel = datas.includes(hoje_sTR)
      ? hoje_sTR
      : [...datas].reverse().find(d => d <= hoje_sTR) || datas[0] || hoje_sTR;
  }

  // Alunos s (sem situação de saída)
  const alunoss = alunos.filter(a => !["AB","TR","RM","RC"].includes(a.situacao));

  // ── Seletor de data (para maRCar chamada individual) ──
  const datasOpts = datas.map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  // ── Datas visíveis: filTRa pelo bimesTRe selecionado (inicio → fim) ──
  // Exibe todas as datas do bimesTRe até hoje; do futuro, mosTRa as próximas 2
  const datasVisiveis = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d <= hoje_sTR)
    .concat(datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d > hoje_sTR).slice(0, 2));

  // ── Cabeçalho duplo: linha 1 = meses agrupados; linha 2 = dias ──
  // Agrupa datas por mês para calcular colspan
  const gruposMes = [];
  for (const d of datasVisiveis) {
    const [ano, mes] = d.split("-");
    const chave = `${ano}-${mes}`;
    const labelMes = NOMES_MES[+mes - 1].charAt(0).toUpperCase() + NOMES_MES[+mes - 1].slice(1) + "/" + ano;
    if (!gruposMes.length || gruposMes[gruposMes.length - 1].chave !== chave) {
      gruposMes.push({ chave, label: labelMes, count: 1 });
    } else {
      gruposMes[gruposMes.length - 1].count++;
    }
  }

  const thMeses = gruposMes.map(m =>
    `<th colspan="${m.count}" class="th-mes-chamada">${m.label}</th>`
  ).join("");

  const thDias = datasVisiveis.map(d => {
    const isSel = d === _dataChamadaSel;
    const isPast = d <= hoje_sTR;
    const dia = d.split("-")[2];
    return `<th class="th-data-chamada ${isSel ? "th-data-sel" : ""}" style="min-width:36px;font-size:.75rem;padding:2px 3px;text-align:center">
      ${dia}
      ${isPast ? `<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">
        <button type="button" class="btn-lote" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${tuRMaKey}','${d}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${tuRMaKey}','${d}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  const rows = alunoss.map(a => {
    const tds = datasVisiveis.map(d => {
      const isPast = d <= hoje_sTR;
      const val = (chamadas[d] || {})[a.num] || (isPast ? "C" : "");
      if (!val) return `<td></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      return `<td style="text-align:center">
        ${isPast ? `<button type="button" class="btn-cf ${cls}"
          onclick="toggleChamada('${tuRMaKey}','${d}',${a.num})">${val}</button>` : ""}
      </td>`;
    }).join("");

    // Situação do aluno
    const sit = a.situacao
      ? `<span class="badge-situacao badge-sit-${a.situacao.toLowerCase()}">${a.situacao}</span>`
      : "";

    return `<TR>
      <td class="td-numero">${a.num}</td>
      <td style="font-size:.82rem">${a.nome||"—"} ${sit}</td>
      ${tds}
    </TR>`;
  }).join("");

  // Abas de bimesTRe para filTRo da chamada
  const tabsBimChamada = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimesTRe === _bimesTReChamadaSel ? "" : ""}"
      onclick="_bimesTReChamadaSel=${b.bimesTRe};_dataChamadaSel=null;renderizarChamadaFrequencia()">${b.label}</button>`
  ).join("");

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header" style="flex-wrap:wrap;gap:8px">
        <h3>Chamada — ${t.serie}ª ${t.tuRMa}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label style="font-size:.8rem">MaRCar data:
            <select class="gi gi-sm" onchange="_dataChamadaSel=this.value;renderizarChamadaFrequencia()">
              ${datasOpts}
            </select>
          </label>
          <button type="button" class="btn-add"
            onclick="chamadaTodosData('${tuRMaKey}','${_dataChamadaSel}','C')">✓ Todos C</button>
          <button type="button" class="btn-add" style="background:var(--text-muted)"
            onclick="chamadaTodosData('${tuRMaKey}','${_dataChamadaSel}','F')">✗ Todos F</button>
        </div>
      </div>
      <div class="tabs-bimesTRe" style="margin-bottom:8px">${tabsBimChamada}</div>
      <div style="overflow-x:auto">
        <table class="tabela-gestao" style="min-width:0">
          <thead>
            <TR>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              ${thMeses}
            </TR>
            <TR>
              ${thDias}
            </TR>
          </thead>
          <tbody>${rows || '<TR><td colspan="10" class="td-vazio">Nenhum aluno .</td></TR>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function toggleChamada(tuRMaKey, data, numAluno) {
  const chamadas = await _carregarChamadas(tuRMaKey);
  if (!chamadas[data]) chamadas[data] = {};
  chamadas[data][numAluno] = (chamadas[data][numAluno] === "F") ? "C" : "F";
  await _salvarChamadas(tuRMaKey);
  renderizarChamadaFrequencia();
}

async function chamadaTodosData(tuRMaKey, data, valor) {
  const [alunos, chamadas] = await Promise.all([
    _carregarAlunos(tuRMaKey),
    _carregarChamadas(tuRMaKey),
  ]);
  if (!chamadas[data]) chamadas[data] = {};
  const s = alunos.filter(a => !["AB","TR","RM","RC"].includes(a.situacao));
  for (const a of s) chamadas[data][a.num] = valor;
  await _salvarChamadas(tuRMaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────
// ── Aba Chamada ──────────────────────────────────────────────
function TRocarAbaCronograma(aba) {
  window._abaCronograma = aba;
  const secCron = document.getElementById("secao-cronograma");
  const secTala = document.getElementById("secao-tala");
  const secCham = document.getElementById("secao-chamada");
  const tabsBim = document.querySelector(".tabs-bimesTRe");
  const btns    = document.querySelectorAll(".tab-aba");
  btns.forEach(b => b.classList.remove(""));
  document.querySelector(`.tab-aba[onclick*="'${aba}'"]`)?.classList.add("");

  if (secCron) secCron.style.display = aba === "cronograma" ? "" : "none";
  if (secTala) secTala.style.display = aba === "tala"       ? "" : "none";
  if (secCham) secCham.style.display = aba === "chamada"    ? "" : "none";
  if (tabsBim) tabsBim.style.display = aba === "cronograma" ? "" : "none";

  if (aba === "tala")    renderizarTala();
  if (aba === "chamada") renderizarChamadaFrequencia();
}

async function renderizarTala() {
  const t = tuRMaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-chamada");
  if (!secao) return;
  secao.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>';
  const tuRMaKey = t.serie + t.tuRMa; // ex: "1A"
  const alunos   = await _carregarAlunos(tuRMaKey);
  const adm      = _isAdmin(_userAtual?.email);
  const SITUACOES = ["","AB","NC","TR","RM","RC"];
  const SITUACAO_LABEL = { "":"MaTRiculado","AB":"Abandonou","NC":"Não compareceu","TR":"TR","RM":"Remanejado","RC":"RC" };

  const rows = alunos.map((a, idx) => {
    const sitOpts = SITUACOES.map(s =>
      `<option value="${s}" ${(a.situacao||"")=== s?"selected":""}>${s||"—"} ${SITUACAO_LABEL[s]||""}</option>`
    ).join("");
    const sitBadge = a.situacao
      ? `<span class="badge-situacao badge-sit-${a.situacao.toLowerCase()}">${a.situacao}</span>`
      : `<span class="badge-situacao badge-sit-ok">✓</span>`;
    return `<TR class="${a.situacao?"aluno-in":""}">
      <td class="td-numero">${a.num}</td>
      <td>${adm
        ? `<input class="gi" value="${(a.nome||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${tuRMaKey}',${idx},'nome',this.value)" />`
        : (a.nome||"—")}
      </td>
      <td style="font-size:.8rem">${adm
        ? `<input class="gi gi-sm" value="${(a.maTRicula||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${tuRMaKey}',${idx},'maTRicula',this.value)" />`
        : (a.maTRicula||"—")}
      </td>
      <td>
        <select class="gi gi-sm" onchange="editarAluno('${tuRMaKey}',${idx},'situacao',this.value)">
          ${sitOpts}
        </select>
      </td>
      ${adm ? `<td><button type="button" class="btn-icon-del" onclick="removerAluno('${tuRMaKey}',${idx})" title="Remover aluno">×</button></td>` : "<td></td>"}
    </TR>`;
  }).join("");

  // Botão add/remove só para admin
  const btnAdd = adm
    ? `<button type="button" class="btn-add" onclick="adicionarAluno('${tuRMaKey}')">+ Aluno</button>`
    : "";

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Lista de Alunos — ${t.serie}ª ${t.tuRMa}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <span style="font-size:.8rem;color:var(--text-muted)">${alunos.length} aluno(s)</span>
        ${btnAdd}
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><TR>
            <th style="width:40px">Nº</th>
            <th>Nome</th>
            <th style="width:120px">MaTRícula</th>
            <th style="width:160px">Situação</th>
            ${adm ? "<th style='width:32px'></th>" : "<th></th>"}
          </TR></thead>
          <tbody>${rows || '<TR><td colspan="4" class="td-vazio">Nenhum aluno cadasTRado.</td></TR>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function editarAluno(tuRMaKey, idx, campo, valor) {
  const lista = await _carregarAlunos(tuRMaKey);
  if (!lista[idx]) return;
  lista[idx][campo] = valor;
  await _salvarAlunos(tuRMaKey);
  _mosTRarIndicadorSync("✓ Aluno atualizado");
}

async function removerAluno(tuRMaKey, idx) {
  const lista = await _carregarAlunos(tuRMaKey);
  if (!lista[idx]) return;
  if (!confiRM(`Remover "${lista[idx].nome || "este aluno"}"?`)) return;
  lista.splice(idx, 1);
  // Renumera
  lista.forEach((a, i) => a.num = i + 1);
  await _salvarAlunos(tuRMaKey);
  renderizarTala();
}

async function adicionarAluno(tuRMaKey) {
  const lista = await _carregarAlunos(tuRMaKey);
  const num   = lista.length ? Math.max(...lista.map(a => a.num || 0)) + 1 : 1;
  lista.push({ num, nome: "", maTRicula: "", situacao: "" });
  await _salvarAlunos(tuRMaKey);
  renderizarTala();
}

function alternarVisao() {
  visaoDetalhada = !visaoDetalhada;
  renderizarConteudo();
}

// Salva detalhe selecionado no dropdown de uma linha
function salvarDetalhe(slotId, valor) {
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch].detalhe = valor;
  salvarTudo();
}

// ── Modal de horários da tuRMa ativa ─────────────────────────
function abrirModalHorarios() {
  const t = tuRMaAtiva;
  if (!t) return;
  const modal = document.getElementById("modal-horarios");
  if (!modal) return;
  modal.style.display = "flex";
  _renderizarCorpoHorarios();
}

function fecharModalHorarios() {
  const modal = document.getElementById("modal-horarios");
  if (modal) modal.style.display = "none";
}

function _renderizarCorpoHorarios() {
  const t = tuRMaAtiva;
  if (!t) return;
  const corpo = document.getElementById("modal-horarios-corpo");
  if (!corpo) return;
  const ti = RT_TURMAS.indexOf(t);
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const turno = t.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
  // Fallback: se nenhum período bate com o turno, mosTRa todos
  const opcoesPerido = (periodos.length ? periodos : RT_PERIODOS)
    .map(p => `<option value="${p.aula}">${p.label} (${p.inicio}–${p.fim})</option>`)
    .join("");

  const horariosHtml = (t.horarios||[]).map((h, hi) => `
    <div class="horario-item" style="margin-bottom:8px">
      <select class="gi gi-xs" onchange="editHorario(${ti},${hi},'diaSemana',+this.value);_renderizarCorpoHorarios()">
        ${diasNomes.map((d,di) => `<option value="${di}" ${h.diaSemana===di?"selected":""}>${d}</option>`).join("")}
      </select>
      <select class="gi gi-sm" onchange="editHorario(${ti},${hi},'aula',this.value);_renderizarCorpoHorarios()">
        ${(RT_PERIODOS.length ? RT_PERIODOS : []).map(p =>
          `<option value="${p.aula}" ${h.aula===p.aula?"selected":""}>${p.label} (${p.inicio}–${p.fim})</option>`
        ).join("")}
      </select>
      <button type="button" class="btn-icon-del"
        onclick="delHorario(${ti},${hi});_renderizarCorpoHorarios()">×</button>
    </div>`).join("");

  corpo.innerHTML = `
    <p class="gestao-hint" style="margin-bottom:10px">
      Dias e períodos em que esta disciplina ocorre nesta tuRMa.
    </p>
    <div id="lista-horarios-modal">${horariosHtml || '<p class="gestao-hint">Nenhum horário cadasTRado.</p>'}</div>
    <button type="button" class="btn-add-small" style="margin-top:6px"
      onclick="addHorarioModal(${ti})">+ Horário</button>`;
}

function addHorarioModal(ti) {
  const turno = RT_TURMAS[ti]?.periodo || "manha";
  const prefixo = turno === "tarde" ? "t" : "m";
  RT_TURMAS[ti].horarios.push({ diaSemana: 1, aula: prefixo+"1" });
  salvarTudo();
  _renderizarCorpoHorarios();
  // Atualiza o cronograma em background
  renderizarConteudo();
  // Reabre o modal (renderizarConteudo fecha tudo)
  const modal = document.getElementById("modal-horarios");
  if (modal) modal.style.display = "flex";
}


function renderizarLinhas(slots) {
  const t      = tuRMaAtiva;
  const tbody  = document.getElementById("tbody-aulas");
  if (!tbody) return;
  tbody.innerHTML = "";
  // Chave específica por bimesTRe; fallback para chave sem bimesTRe (migração)
  const chaveC = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const conts  = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem    = getOrdem(t.id, bimesTRe, slotsReg.length);
  let regIdx = 0;
  let lineNum = 0;
  for (const slot of slots) {
    lineNum++;
    const slotId = slot.slotId;
    const ch     = chaveSlot(t.id, bimesTRe, slotId);
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
    const TR = document.createElement("TR");
    TR.className    = rowClass;
    TR.dataset.slot = slotId;

    // FIX: passa "this" para toggleCampo para peRMitir reversão imediata do
    // checkbox caso o visitante não esteja autenticado.
    const mkChk = (campo, val, title) => `
      <label class="checkbox-wrapper" title="${title} · Shift+clique para intervalo">
        <input type="checkbox" ${val?"checked":""}
          data-slot="${slotId}" data-campo="${campo}"
          onclick="onChkClick(event,'${slotId}','${campo}',this)">
        <span class="checkmark ${campo==='feita'?'':'checkmark-alt'}"></span>
      </label>`;

    TR.innerHTML = `
      <td class="td-numero">${slot.eventual ? `<span class="tag-eventual" title="Aula eventual">E</span>` : lineNum}</td>
      <td class="td-conteudo" data-slot="${slotId}">
        <div class="conteudo-cell">
          <span class="drag-handle-cont ${selecionado?"handle-sel":""}"
            data-slot="${slotId}" draggable="TRue"
            title="Clique para selecionar · Shift+clique para intervalo · Arrastar para reorganizar">⠿</span>
          <span class="conteudo-texto ${editado?"editado":""}"
            data-slot="${slotId}"
            title="${editado?"Editado · clique para editar":"Clique para editar"}"
          >${conteudoExibido||'<span class="sem-conteudo">—</span>'}</span>
          ${editado?'<span class="badge-editado">✎</span>':""}
          ${slot.eventual?`<button class="btn-del-eventual" onclick="removerEventual('${slotId}')" title="Remover esta aula eventual">×</button>`:""}
        </div>
        ${visaoDetalhada ? (() => {
          const chaveBase = `${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}_b${bimesTRe}`;
          const lista = RT_CONTEUDOS[chaveBase] || RT_CONTEUDOS[`${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}`] || [];
          const detalheAtual = est.detalhe || "";
          const opts = lista.map(c =>
            `<option value="${c.replace(/"/g,'&quot;')}" ${detalheAtual===c?"selected":""}>${c}</option>`
          ).join("");
          return `<select class="detalhe-select"
            onchange="salvarDetalhe('${slotId}',this.value)"
            title="Detalhe / sub-item desta aula">
            <option value="">— detalhe —</option>
            ${opts}
          </select>
          ${detalheAtual ? `<span class="detalhe-exibido">${detalheAtual}</span>` : ""}`;
        })() : ""}
        <input type="text" class="anotacao-input"
          placeholder="Anotação…"
          value="${(est.anotacao||'').replace(/"/g,'&quot;')}"
          onchange="salvarAnotacao('${slotId}', this.value)"
          title="Anotação livre sobre esta aula"
        />
      </td>
      <td class="td-data">${fmtSlotData(slot)}</td>
      <td class="td-check">${mkChk("feita",   feita, "Aula dada?")}</td>
      <td class="td-regisTRo" id="reg-${slotId}">${feita?fmtData(est.dataFeita):"—"}</td>
      <td class="td-check">${mkChk("chamada", !!est.chamada,   "Chamada realizada?")}</td>
      <td class="td-check">${mkChk("conteudoEnTRegue", !!est.conteudoEnTRegue, "Material enTRegue?")}</td>`;
    const spanTxt = TR.querySelector(".conteudo-texto");
    spanTxt.addEventListener("click", () => iniciarEdicao(spanTxt, slotId, conteudoBase));
    const handle = TR.querySelector(".drag-handle-cont");
    handle.addEventListener("click",      e => onHandleClick(e, slotId));
    handle.addEventListener("dragstart",  e => onDragStart(e, slotId));
    handle.addEventListener("dragend",    onDragEnd);
    const tdC = TR.querySelector(".td-conteudo");
    tdC.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; });
    tdC.addEventListener("dragenter", e => onDragEnter(e, slotId));
    tdC.addEventListener("dragleave", e => onDragLeave(e));
    tdC.addEventListener("drop",      e => onDrop(e, slotId));
    tbody.appendChild(TR);
  }
}

function iniciarEdicao(spanEl, slotId, base) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  if (spanEl.querySelector("textarea")) return;
  const cur = spanEl.innerText.replace("—","").TRim();
  const ta  = document.createElement("textarea");
  ta.className = "input-edicao";
  ta.value = cur; ta.rows = 2;
  spanEl.innerHTML = ""; spanEl.appendChild(ta);
  spanEl.classList.add("editando");
  ta.focus(); ta.select();
  function salvar() {
    const novo = ta.value.TRim();
    const ch   = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    const chaveC = `${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}_b${bimesTRe}`;
    const slotsReg = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).filter(s => !s.eventual);
    const ordem    = getOrdem(tuRMaAtiva.id, bimesTRe, slotsReg.length);
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
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  if (valor.TRim() === "") delete estadoAulas[ch].anotacao;
  else estadoAulas[ch].anotacao = valor.TRim();
  salvarTudo();
}

// FIX: recebe o elemento <input> (inputEl) para reverter o checkbox
// imediatamente no DOM se o visitante não estiver autenticado.
// Antes, o check ficava visualmente maRCado até o modal fechar.
// Clique numa checkbox: clique simples toggle, shift+clique aplica intervalo
function onChkClick(e, slotId, campo, inputEl) {
  // Impede seleção de texto ao usar shift+clique
  if (e.shiftKey) {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
  }

  // O browser já togglou checked antes do onclick — lê o valor atual
  const novoValor = inputEl.checked;

  if (e.shiftKey && ultimoChkSlot && ultimoChkCampo === campo) {
    // Shift+clique: o loop vai atualizar todos os checkboxes do intervalo
    // incluindo o destino — não reverter aqui

    const todos = [...document.querySelectorAll(
      `#tabela-aulas input[data-campo="${campo}"]`
    )].map(i => i.dataset.slot);

    const iA = todos.indexOf(ultimoChkSlot);
    const iB = todos.indexOf(slotId);
    if (iA === -1 || iB === -1) return;

    // Inclui ambos os exTRemos — slice é exclusivo no fim, por isso ate+1
    const de  = Math.min(iA, iB);
    const ate = Math.max(iA, iB);
    const valor = ultimoChkValor;
    const slotsDoIntervalo = todos.slice(de, ate + 1);

    for (const sid of slotsDoIntervalo) {
      const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, sid);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor
          ? new Date().toISOSTRing().slice(0, 10)
          : null;
      }
    }

    // RegisTRa nova âncora antes do setTimeout
    ultimoChkSlot = slotId;
    salvarTudo();

    // setTimeout: deixa o browser teRMinar o evento antes de atualizar o DOM
    setTimeout(() => {
      for (const sid of slotsDoIntervalo) {
        const chkEl = document.querySelector(
          `#tabela-aulas input[data-campo="${campo}"][data-slot="${sid}"]`
        );
        if (chkEl) chkEl.checked = valor;
        const TR = document.querySelector(`TR[data-slot="${sid}"]`);
        if (TR && campo === "feita") {
          const pass = getSlotsCompletos(tuRMaAtiva.id, bimesTRe)
            .find(s => s.slotId === sid)?.data < hoje();
          TR.className = valor ? "row-feita" : (pass ? "row-pendente" : "row-futura");
        }
      }
    }, 0);
    return;
  }

  // Clique simples: toggle noRMal + regisTRa âncora
  toggleCampo(slotId, campo, novoValor, inputEl);
  ultimoChkSlot  = slotId;
  ultimoChkCampo = campo;
  ultimoChkValor = novoValor;
}

// MaRCa/desmaRCa todas as aulas visíveis de uma coluna
function maRCarColuna(campo, valor) {
  const t = tuRMaAtiva;
  if (!t) return;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  let alterou = false;
  for (const s of slots) {
    const ch = chaveSlot(t.id, bimesTRe, s.slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    // Para AD: ao maRCar, pula aulas futuras; ao desmaRCar, desmaRCa todas
    if (campo === "feita" && valor && s.data && s.data > hoje()) continue;
    if (estadoAulas[ch][campo] !== valor) {
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor ? new Date().toISOSTRing().slice(0,10) : null;
      }
      alterou = TRue;
    }
  }
  if (alterou) { salvarTudo(); renderizarConteudo(); }
}

function toggleCampo(slotId, campo, val, inputEl) {
  if (!_autenticado) { inputEl.checked = !val; _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { inputEl.checked = !val; _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch][campo] = val;
  if (campo === "feita") {
    estadoAulas[ch].dataFeita = val ? hoje() : null;
    const TR  = document.querySelector(`TR[data-slot="${slotId}"]`);
    const reg = document.getElementById(`reg-${slotId}`);
    if (TR) {
      const slot  = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).find(s => s.slotId===slotId);
      const pass  = slot && slot.data < hoje();
      const ev    = slot?.eventual;
      TR.className = `${ev?"row-eventual":(val?"row-feita":(pass?"row-pendente":"row-futura"))}${selConteudos.has(slotId)?" row-sel-cont":""}`;
    }
    if (reg) reg.textContent = val ? fmtData(hoje()) : "—";
    atualizarStats();
  }
  salvarTudo();
}

function atualizarStats() {
  const slots = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).filter(s=>!s.eventual);
  const total = slots.length;
  let feitas  = 0;
  for (const s of slots) if (estadoAulas[chaveSlot(tuRMaAtiva.id,bimesTRe,s.slotId)]?.feita) feitas++;
  const pct = total>0 ? Math.round(feitas/total*100) : 0;
  document.querySelector(".stat-num")?.textContent && (document.querySelector(".stat-num").textContent = `${feitas}/${total}`);
  document.querySelector(".stat-prog")?.setAtTRibute("sTRoke-dasharray",`${pct},100`);
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
function _initPrevenirSelecaoShift() {
  // Impede seleção de texto na tabela ao usar shift+clique nos checkboxes
  document.addEventListener("mousedown", e => {
    if (e.shiftKey && e.target.closest(".tabela-aulas")) {
      e.preventDefault();
    }
  });
}

function _initClickFora() {
  document.addEventListener("click", e => {
    if (!selConteudos.size) return;
    const denTRoTabela = e.target.closest(".tabela-aulas");
    const noHandle     = e.target.closest(".drag-handle-cont");
    if (denTRoTabela && !noHandle) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    } else if (!denTRoTabela) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    }
  }, TRue);
}

function atualizarVisualizacaoSel() {
  document.querySelectorAll(".drag-handle-cont").forEach(h => {
    h.classList.toggle("handle-sel", selConteudos.has(h.dataset.slot));
  });
  document.querySelectorAll("TR[data-slot]").forEach(TR => {
    TR.classList.toggle("row-sel-cont", selConteudos.has(TR.dataset.slot));
  });
}

function onDragStart(e, slotId) {
  if (!selConteudos.has(slotId)) { selConteudos.clear(); selConteudos.add(slotId); atualizarVisualizacaoSel(); }
  dragSRCSlots = [...selConteudos];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", slotId);
  dragSRCSlots.forEach(sid => {
    document.querySelector(`td.td-conteudo[data-slot="${sid}"]`)?.classList.add("content-dragging");
  });
}

function onDragEnd() {
  document.querySelectorAll(".content-dragging,.content-drag-over").forEach(el =>
    el.classList.remove("content-dragging","content-drag-over")
  );
  dragSRCSlots = []; dragDestSlot = null;
}

function onDragEnter(e, slotId) {
  if (dragSRCSlots.includes(slotId)) return;
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
  if (!dragSRCSlots.length || dragSRCSlots.includes(destSlotId)) return;
  const t = tuRMaAtiva;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem = getOrdem(t.id, bimesTRe, slotsReg.length);
  function slotIdxReg(slotId) { return slotsReg.findIndex(s => s.slotId === slotId); }
  const sRCIdxs = dragSRCSlots.map(slotIdxReg).filter(i => i >= 0);
  const destIdx = slotIdxReg(destSlotId);
  if (destIdx < 0 && !slots.find(s=>s.slotId===destSlotId)?.eventual) return;
  if (destIdx < 0) return;
  const novaOrdem = [...ordem];
  const sRCContents = sRCIdxs.map(i => ({
    contIdx: novaOrdem[i],
    editado: estadoAulas[chaveSlot(t.id, bimesTRe, slotsReg[i].slotId)]?.conteudoEditado
  }));
  const sRCSet = new Set(sRCIdxs);
  const restantes = novaOrdem.filter((_, i) => !sRCSet.has(i));
  const destPosEmRestantes = restantes.indexOf(novaOrdem[destIdx]);
  const insPos = destPosEmRestantes >= 0 ? destPosEmRestantes : restantes.length;
  restantes.splice(insPos, 0, ...sRCContents.map(s => s.contIdx));
  sRCIdxs.forEach(i => {
    const ch = chaveSlot(t.id, bimesTRe, slotsReg[i].slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  let sRCPTR = 0;
  for (let i = 0; i < restantes.length; i++) {
    const slotId = slotsReg[i]?.slotId;
    if (!slotId) continue;
    const origSRCIdx = sRCContents.findIndex((s,j) => s.contIdx === restantes[i] && j === sRCPTR);
    if (origSRCIdx >= 0 && sRCContents[origSRCIdx].editado != null) {
      const ch = chaveSlot(t.id, bimesTRe, slotId);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch].conteudoEditado = sRCContents[origSRCIdx].editado;
      sRCPTR++;
    }
  }
  const chaveC2 = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const contsList = RT_CONTEUDOS[chaveC2] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  RT_CONTEUDOS[chaveC2] = restantes.map(ci => contsList[ci] ?? "");
  delete ordemConteudos[chaveOrdem(t.id, bimesTRe)];
  slotsReg.forEach((s) => {
    const ch = chaveSlot(t.id, bimesTRe, s.slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  salvarTudo();
  selConteudos.clear();
  renderizarLinhas(getSlotsCompletos(t.id, bimesTRe));
}

function mudarBimesTRe(num) { bimesTRe = num; selConteudos.clear(); renderizarConteudo(); }

function resetarOrdem() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  if (!confiRM("Restaurar ordem original dos conteúdos?")) return;
  delete ordemConteudos[chaveOrdem(tuRMaAtiva.id, bimesTRe)];
  salvarTudo(); renderizarConteudo();
}

function abrirModalEventual() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  document.getElementById("ev-data").value = hoje();
  document.getElementById("modal-eventual").style.display = "flex";
}

function fecharModalEventual() { document.getElementById("modal-eventual").style.display = "none"; }

function confiRMarEventual() {
  const data = document.getElementById("ev-data").value;
  const hora = document.getElementById("ev-hora").value || "07:00";
  const desc = document.getElementById("ev-desc").value.TRim();
  if (!data) { alert("InfoRMe a data."); return; }
  const lista = getEventuais(tuRMaAtiva.id, bimesTRe);
  lista.push({ id: Date.now(), data, hora, descricao: desc });
  salvarEventuais(lista); fecharModalEventual(); renderizarConteudo();
}

function removerEventual(slotId) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const eId = parseInt(slotId.replace("e",""), 10);
  const lista = getEventuais(tuRMaAtiva.id, bimesTRe).filter(e => e.id !== eId);
  salvarEventuais(lista);
  delete estadoAulas[chaveSlot(tuRMaAtiva.id, bimesTRe, slotId)];
  salvarTudo(); renderizarConteudo();
}

function confiRMarLimpar() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  const lbl = RT_BIMESTRES.find(b=>b.bimesTRe===bimesTRe)?.label;
  if (!confiRM(`Apagar todos os regisTRos do ${lbl} desta tuRMa?`)) return;
  getSlotsCompletos(tuRMaAtiva.id, bimesTRe).forEach(s => {
    delete estadoAulas[chaveSlot(tuRMaAtiva.id, bimesTRe, s.slotId)];
  });
  salvarTudo(); selConteudos.clear(); renderizarConteudo();
}

function exportarCSV() {
  const t = tuRMaAtiva;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  const chaveC = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const conts = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s=>!s.eventual);
  const ordem = getOrdem(t.id, bimesTRe, slotsReg.length);
  let rIdx = 0;
  const linhas = [["#","Data","Horário","Conteúdos/Atividades","Chamada","EnTRegue","Dada?","RegisTRo"]];
  slots.forEach((slot, i) => {
    const ch  = chaveSlot(t.id, bimesTRe, slot.slotId);
    const est = estadoAulas[ch] || {};
    let cont  = slot.eventual ? (slot.descricao||"") : (est.conteudoEditado ?? (conts[ordem[rIdx]]||""));
    if (!slot.eventual) rIdx++;
    const horarioFmt = slot.eventual ? slot.inicio : (slot.label ? `${slot.label} (${slot.inicio}–${slot.fim})` : slot.inicio);
    linhas.push([i+1, fmtData(slot.data), horarioFmt, cont,
      est.chamada?"Sim":"Não", est.conteudoEnTRegue?"Sim":"Não",
      est.feita?"Sim":"Não", est.feita?fmtData(est.dataFeita):"",
    ]);
  });
  const csv  = linhas.map(l=>l.map(c=>`"${STRing(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const lbl  = t.subtitulo?`${t.serie}${t.tuRMa}_${t.subtitulo}`:`${t.serie}${t.tuRMa}`;
  baixarArquivo(blob,`aulas_${lbl}_${t.sigla}_bim${bimesTRe}.csv`);
}

function exportarJS() {
  const ts = new Date().toLocaleSTRing("pt-BR");

  const arquivos = [
    {
      nome: "bimesTRes.js",
      conteudo: [
        `// BIMESTRES.JS — Exportado em ${ts}`,
        `const BIMESTRES = ${JSON.sTRingify(RT_BIMESTRES,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "tuRMas_global.js",
      conteudo: [
        `// TURMAS_GLOBAL.JS — TuRMas-base da escola — Exportado em ${ts}`,
        `const TURMAS_BASE = ${JSON.sTRingify(RT_CONFIG.tuRMasBase || TURMAS_BASE || [],null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "tuRMas.js",
      conteudo: [
        `// TURMAS.JS — EnTRadas do diário (tuRMa + disciplina + horários) — Exportado em ${ts}`,
        `const TURMAS = ${JSON.sTRingify(RT_TURMAS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "conteudos.js",
      conteudo: [
        `// CONTEUDOS.JS — Conteúdos e ordem das aulas — Exportado em ${ts}`,
        `const CONTEUDOS = ${JSON.sTRingify(RT_CONTEUDOS,null,2)};`,
        `const ORDEM     = ${JSON.sTRingify(ordemConteudos,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "periodos.js",
      conteudo: [
        `// PERIODOS.JS — Horários das aulas — Exportado em ${ts}`,
        `const PERIODOS = ${JSON.sTRingify(RT_PERIODOS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "estado.js",
      conteudo: [
        `// ESTADO.JS — Estado das aulas (feita, chamada, AD, CH, RE) — Exportado em ${ts}`,
        `// Para restaurar: localStorage.setItem("aulaEstado_SEU_UID", JSON.sTRingify(ESTADO));`,
        `const ESTADO = ${JSON.sTRingify(estadoAulas,null,2)};`,
      ].join("\n\n"),
    },
  ];

  // Baixa um arquivo por vez com pequeno delay para não bloquear o browser
  arquivos.forEach((arq, i) => {
    setTimeout(() => {
      baixarArquivo(new Blob([arq.conteudo],{type:"application/javascript;charset=utf-8;"}), arq.nome);
    }, i * 400);
  });

  _mosTRarIndicadorSync("⬇ Exportando 6 arquivos…");
}

function baixarArquivo(blob, nome) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download=nome; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  PAINEL DE GESTÃO
// ════════════════════════════════════════════════════════════