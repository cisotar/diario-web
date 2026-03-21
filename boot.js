// BOOT.JS — Configuração de períodos, carregamento inicial, migração, DOMContentLoaded
// Dependências: todos os outros módulos (deve ser o último script carregado)

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
    const toStr = (mins) => {
      const hh = String(Math.floor(mins / 60)).padStart(2,"0");
      const mm = String(mins % 60).padStart(2,"0");
      return `${hh}:${mm}`;
    };
    let cur = toMin(h, m);
    const prefixo = turno === "manha" ? "m" : "t";
    for (let i = 1; i <= (c.qtd || 5); i++) {
      const fim = cur + (c.duracao || 50);
      res.push({ aula: `${prefixo}${i}`, label: `${i}ª aula (${turno==="manha"?"manhã":"tarde"})`, inicio: toStr(cur), fim: toStr(fim), turno });
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
  RT_BIMESTRES = JSON.parse(JSON.stringify(BIMESTRES));
  // Professor começa com lista vazia — só vê as turmas que ele mesmo criou (no Firestore)
  // Admin herda TURMAS do turmas.js como ponto de partida
  RT_TURMAS    = _isAdmin(_userAtual?.email)
    ? JSON.parse(JSON.stringify(TURMAS))
    : [];
  RT_CONTEUDOS = JSON.parse(JSON.stringify(CONTEUDOS));
  // Períodos: tenta usar PERIODOS do periodos.js, senão usa config de RT_CONFIG, senão padrão
  RT_PERIODOS = (typeof PERIODOS !== "undefined" && Array.isArray(PERIODOS) && PERIODOS.length)
    ? JSON.parse(JSON.stringify(PERIODOS))
    : RT_CONFIG?.configPeriodos
      ? _gerarPeriodosDeConfig(RT_CONFIG.configPeriodos)
      : JSON.parse(JSON.stringify(PERIODOS_PADRAO));

  // DEV: pula todas as leituras do Firestore
  if (_DEV) {
    // Inicializa RT_CONFIG com valores padrão para testes locais
    RT_CONFIG = {
      nomeEscola:          "Escola (DEV)",
      disciplinasPorSerie: {},
      areasConhecimento:   JSON.parse(JSON.stringify(AREAS_CONHECIMENTO)),
      turmasBase:          JSON.parse(JSON.stringify((TURMAS_BASE||[]).map(t=>({nivel:t.nivel||"medio",...t})))),
      configPeriodos:      null,
    };
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
      RT_CONFIG = { nomeEscola: "", disciplinasPorSerie: {}, turmasBase: null, configPeriodos: null, ...d };
      // Migra turmasBase sem nivel (legado)
      if (Array.isArray(RT_CONFIG.turmasBase)) RT_CONFIG.turmasBase = RT_CONFIG.turmasBase.map(t => ({ nivel: t.nivel||"medio", ...t }));
      if (typeof RT_CONFIG.disciplinasPorSerie === "string") {
        try { RT_CONFIG.disciplinasPorSerie = JSON.parse(RT_CONFIG.disciplinasPorSerie); } catch { RT_CONFIG.disciplinasPorSerie = {}; }
      }
      // Regenera períodos se há config personalizada no Firestore
      if (RT_CONFIG.configPeriodos) {
        RT_PERIODOS = _gerarPeriodosDeConfig(RT_CONFIG.configPeriodos);
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

  // Migração automática de RT_TURMAS: corrige periodo e horários legados
  _migrarTurmas();

  // Coordenador: pré-carrega diários dos professores associados (somente leitura)
  if (_ehCoordenador() && Array.isArray(_perfilProf?.professoresAssociados)) {
    await _carregarDiariosAssociados(_perfilProf.professoresAssociados);
  }
  _ativarListenerFirestore();
}

// ── Migração automática de RT_TURMAS ─────────────────────────
// Corrige: periodo baseado em turmas_global.js + horários a1-a7 → t1-t7
function _migrarTurmas() {
  if (!Array.isArray(RT_TURMAS) || !RT_TURMAS.length) return;

  // Mapa de periodo correto por serie+turma (vindo de TURMAS_BASE)
  const periodoCorreto = {};
  for (const tb of (typeof TURMAS_BASE !== "undefined" ? TURMAS_BASE : [])) {
    periodoCorreto[tb.serie + tb.turma] = tb.periodo || "tarde";
  }

  let alterou = false;
  for (const t of RT_TURMAS) {
    const chave = t.serie + t.turma;

    // 1. Corrige periodo se diferente do turmas_global.js
    if (periodoCorreto[chave] && t.periodo !== periodoCorreto[chave]) {
      console.log(`[migração] ${t.id}: periodo ${t.periodo} → ${periodoCorreto[chave]}`);
      t.periodo = periodoCorreto[chave];
      alterou = true;
    }

    // 2. Migra horários com turno errado ou formato legado
    const turnoCorreto = (t.periodo || "tarde") === "manha" ? "m" : "t";
    const turnoErrado  = turnoCorreto === "m" ? "t" : "m";
    if (Array.isArray(t.horarios)) {
      for (const h of t.horarios) {
        // Formato legado: a1–a7 → tN ou mN conforme periodo
        if (/^a\d+$/.test(h.aula)) {
          const num = h.aula.replace("a", "");
          console.log(`[migração] ${t.id}: ${h.aula} → ${turnoCorreto}${num}`);
          h.aula = turnoCorreto + num;
          alterou = true;
        }
        // Turno errado: mX em turma tarde, ou tX em turma manhã
        else if (new RegExp(`^${turnoErrado}\\d+$`).test(h.aula)) {
          const num = h.aula.replace(/^[mt]/, "");
          console.log(`[migração] ${t.id}: ${h.aula} → ${turnoCorreto}${num} (turno corrigido)`);
          h.aula = turnoCorreto + num;
          alterou = true;
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
  _initPrevenirSelecaoShift();
  if (window.innerWidth <= 860) {
    renderizarHomeMobile();
  } else {
    abrirCalendario();
  }
});
