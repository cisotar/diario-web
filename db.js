// DB.JS — Firebase, persistência (Firestore + localStorage), sync, listeners
// Dependências: globals.js

const _DEV = (() => {
  if (!location.hostname.includes("localhost") && !location.hostname.includes("127.0.0.1")) return null;
  return localStorage.getItem("DEV_MODE");
})();
const _DEV_USERS = {
  admin:     { uid: "dev-admin",     email: "protarciso@gmail.com",    displayName: "Dev Admin" },
  professor: { uid: "dev-professor", email: "dev-prof@localhost.test", displayName: "Dev Professor" },
};


let _offlineAtivo = false;
async function _ativarOffline() {
  if (_DEV) return;
  if (_offlineAtivo) return;
  _offlineAtivo = true;
  try {
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
    clearTimeout(el._timer);
  }
}

let _modoProf = false;

function _docKey() {
  if (_isAdmin(_userAtual?.email) && !_modoProf) return "global";
  return _userAtual?.uid || "anonimo";
}

function _initFirebase() {
  if (_DEV) return null;
  if (!_userAtual) return null;
  if (_dbDoc) return _dbDoc;
  try {
    const db = firebase.firestore();
    const docId = _isAdmin(_userAtual.email) ? "global" : _userAtual.uid;
    _dbDoc = db.collection("diario").doc(docId);
    return _dbDoc;
  } catch (e) {
    console.warn("Firebase não disponível, usando localStorage:", e);
    return null;
  }
}

function _dbProfessores() {
  try { return firebase.firestore().collection("professores"); }
  catch { return null; }
}

function _dbConfig() {
  try { return firebase.firestore().collection("config").doc("bimestres"); }
  catch { return null; }
}

function _dbConfigEscola() {
  try { return firebase.firestore().collection("config").doc("escola"); }
  catch { return null; }
}

async function _salvarConfigEscola() {
  if (_DEV) { console.log("[DEV] _salvarConfigEscola — apenas memória"); return; }
  try {
    const payload = {
      nomeEscola:          RT_CONFIG.nomeEscola || "",
      disciplinasPorSerie: RT_CONFIG.disciplinasPorSerie || {},
      areasConhecimento:   RT_CONFIG.areasConhecimento || AREAS_CONHECIMENTO,
      turmasBase:          RT_CONFIG.turmasBase || TURMAS_BASE || [],
      configPeriodos:      RT_CONFIG.configPeriodos || null,
    };
    if (RT_CONFIG.materias) payload.materias = RT_CONFIG.materias;
    await _dbConfigEscola().set(payload, { merge: true });
  } catch(e) { console.warn("Erro ao salvar config escola:", e); }
}

async function _salvarBimestresFirestore() {
  if (_DEV) { console.log("[DEV] _salvarBimestresFirestore — apenas memória"); return; }
  if (!_isAdmin(_userAtual?.email)) return;
  const ref = _dbConfig();
  if (!ref) return;
  try {
    await ref.set({ bimestres: JSON.stringify(RT_BIMESTRES), _atualizado: new Date().toISOString() });
    _mostrarIndicadorSync("✓ Bimestres salvos");
  } catch(e) { console.error("Erro ao salvar bimestres:", e); }
}

let _saveTimer = null;
function salvarTudo() {
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  try {
    localStorage.setItem(`aulaEstado_${uid}`,    JSON.stringify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uid}`,     JSON.stringify(ordemConteudos));
    localStorage.setItem(`aulaEventuais_${uid}`, JSON.stringify(linhasEventuais));
    localStorage.setItem(`RT_CONTEUDOS_${uid}`,  JSON.stringify(RT_CONTEUDOS));
    localStorage.setItem(`RT_TURMAS_${uid}`,     JSON.stringify(RT_TURMAS));
  } catch(e) { console.warn("localStorage cheio ou indisponível:", e); }
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _salvarFirestore(), 800);
}

async function _salvarFirestore() {
  if (_DEV) { console.log("[DEV] _salvarFirestore — apenas memória"); return; }
  const doc = _initFirebase();
  if (!doc) return;
  if (!_autenticado) { _abrirModalGoogle(); return; }
  _ultimoAtualizado = new Date();
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
      _mostrarIndicadorSync("💾 Salvo localmente — pendente de sincronização");
    } else {
      console.error("Erro ao salvar no Firestore:", e);
      _mostrarIndicadorSync("⚠ Erro ao salvar — verifique a conexão");
      _salvarLocalStorageEmergencia();
    }
  }
}

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

function _restaurarEmergenciaSeNecessario(dadosFirestore) {
  try {
    const uid  = _docKey() || "anonimo";
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
      const todasTurmas = d.RT_TURMAS ? JSON.parse(d.RT_TURMAS) : [];
      const turmasProf = todasTurmas.filter(t => t.profUid === uid);
      _diariosAssociados[uid] = {
        perfil:          pSnap.exists ? pSnap.data() : { uid },
        estadoAulas:     d.aulaEstado    ? JSON.parse(d.aulaEstado)    : {},
        ordemConteudos:  d.aulaOrdem     ? JSON.parse(d.aulaOrdem)     : {},
        linhasEventuais: d.aulaEventuais ? JSON.parse(d.aulaEventuais) : {},
        RT_CONTEUDOS:    d.RT_CONTEUDOS  ? JSON.parse(d.RT_CONTEUDOS)  : {},
        RT_TURMAS:       turmasProf,
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
  let _ultimoAtualizado = null;
  doc.onSnapshot(snap => {
    if (!snap.exists) return;
    const d = snap.data();
    const atualizado = d._atualizado ? new Date(d._atualizado) : null;
    if (_ultimoAtualizado && atualizado &&
        Math.abs(atualizado - _ultimoAtualizado) < 500) return;
    try { estadoAulas     = JSON.parse(d.aulaEstado)    || estadoAulas;    } catch {}
    try { ordemConteudos  = JSON.parse(d.aulaOrdem)     || ordemConteudos; } catch {}
    try { linhasEventuais = JSON.parse(d.aulaEventuais) || linhasEventuais;} catch {}
    try { const rc = JSON.parse(d.RT_CONTEUDOS); if (rc) RT_CONTEUDOS = rc; } catch {}
    try {
      const rt = JSON.parse(d.RT_TURMAS);
      if (Array.isArray(rt) && rt.length) {
        // FIX item 5: professores filtram por profUid no snapshot também
        const uid = _userAtual?.uid;
        RT_TURMAS = _isAdmin(_userAtual?.email)
          ? rt
          : rt.filter(t => t.profUid === uid);
      }
    } catch {}
    const _uk = _userAtual?.uid || "anonimo";
    if (d.aulaEstado)    localStorage.setItem(`aulaEstado_${_uk}`,    d.aulaEstado);
    if (d.aulaOrdem)     localStorage.setItem(`aulaOrdem_${_uk}`,     d.aulaOrdem);
    if (d.aulaEventuais) localStorage.setItem(`aulaEventuais_${_uk}`, d.aulaEventuais);
    if (d.RT_CONTEUDOS)  localStorage.setItem(`RT_CONTEUDOS_${_uk}`,  d.RT_CONTEUDOS);
    if (d.RT_TURMAS)     localStorage.setItem(`RT_TURMAS_${_uk}`,     d.RT_TURMAS);
    try { localStorage.removeItem(`_emergencia_${_uk}`); } catch {}
    const calVisivel = !!document.getElementById("cal-corpo");
    if (calVisivel && typeof _calRenderCorpo === "function") _calRenderCorpo();
    if (turmaAtiva && !calVisivel) renderizarConteudo();
    _mostrarIndicadorSync("↓ Sincronizado");
  }, err => console.warn("onSnapshot erro:", err));

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
