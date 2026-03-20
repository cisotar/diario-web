// DB.JS — Firebase, persistência (Firestore + localStorage), sync, listeners
// Dependências: globals.js

const _DEV = (() => {
  if (!location.hostname.includes("localhost") && !location.hostname.includes("127.0.0.1")) return null;
  return localStorage.getItem("DEV_MODE");
})();
const _DEV_USERS = {
  admin:     { uid: "dev-admin",     email: "protaRCiso@gmail.com",    displayName: "Dev Admin" },
  professor: { uid: "dev-professor", email: "dev-prof@localhost.test", displayName: "Dev Professor" },
};


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

