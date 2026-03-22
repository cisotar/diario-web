// GLOBALS.JS — Variáveis globais, constantes, registry de alunos, utilitários puros
// Dependências: nenhuma (carrega antes de tudo)

// APP-CORE.JS — Boot, autenticação, Firebase, salvar/carregar, sidebar, cronograma
// Dependências: bimestres.js, turmas_global.js, turmas.js, conteudos.js, periodos.js, estado.js

// ============================================================
//  APP.JS — Controle de Aulas v6 · Perfis admin/coordenador/professor
// ============================================================

let turmaAtiva    = null;
let bimestreAtivo = null;
let visaoDetalhada = false;
let RT_ALUNOS = {};  // { "1A": [{num,nome,matricula,situacao},...], ... }

// Registry de alunos: os arquivos alunos_*.js registram aqui via _registrarAlunos()
const _ALUNOS_REGISTRY = {};
function _registrarAlunos(turmaKey, lista) {
  _ALUNOS_REGISTRY[turmaKey.toUpperCase()] = lista;
}
function _seedAlunos(turmaKey) {
  const k = turmaKey.replace(/[^A-Z0-9]/gi,"").toUpperCase();
  // Tenta registry primeiro, depois window como fallback
  if (_ALUNOS_REGISTRY[k]) return _ALUNOS_REGISTRY[k];
  const nome = "ALUNOS_" + k;
  return (typeof window !== "undefined" && window[nome]) ? window[nome] : [];
}

// Carrega alunos de uma turma: Firestore > seed
async function _carregarAlunos(turmaKey) {
  if (RT_ALUNOS[turmaKey]) return RT_ALUNOS[turmaKey];
  // DEV mode: usa só o seed
  if (!_DEV) {
    try {
      const snap = await firebase.firestore().collection("alunos").doc(turmaKey).get();
      if (snap.exists && Array.isArray(snap.data().lista)) {
        RT_ALUNOS[turmaKey] = snap.data().lista;
        return RT_ALUNOS[turmaKey];
      }
    } catch(e) { console.warn("Erro ao carregar alunos:", e); }
  }
  // Fallback para seed
  RT_ALUNOS[turmaKey] = JSON.parse(JSON.stringify(_seedAlunos(turmaKey)));
  return RT_ALUNOS[turmaKey];
}

// Salva alunos de uma turma no Firestore
async function _salvarAlunos(turmaKey) {
  if (_DEV) { console.log("[DEV] _salvarAlunos — apenas memória"); return; }
  try {
    await firebase.firestore().collection("alunos").doc(turmaKey)
      .set({ lista: RT_ALUNOS[turmaKey], _atualizado: new Date().toISOString() });
  } catch(e) { console.warn("Erro ao salvar alunos:", e); }
} // false = padrão, true = detalhada
let estadoAulas = {};
let ordemConteudos = {};
let linhasEventuais = {};
let dragSrcSlots  = [];
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
  if (!Array.isArray(RT_TURMAS)) return [];
  // Admin em modo escola vê tudo; admin em modo professor vê só as suas
  if (_isAdmin(_userAtual?.email) && !_modoProf) return RT_TURMAS;
  const uid = _userAtual?.uid;
  return RT_TURMAS.filter(t => t.profUid === uid);
}


// ── Verificação de conflito de horário ───────────────────────
// Verifica se diaSemana+aula já está ocupado por OUTRA turma/professor
// Retorna null se livre, ou { turma, disciplina, profNome } se ocupado
async function _verificarConflitoHorario(serie, turma, diaSemana, aula, turmaIdIgnorar) {
  // 1. Verifica em RT_TURMAS (turmas carregadas localmente — admin vê tudo)
  for (const t of (RT_TURMAS || [])) {
    if (t.id === turmaIdIgnorar) continue;
    // Mesmo dia+aula em qualquer turma da mesma série+turma = conflito
    if (t.serie === serie && t.turma === turma) {
      for (const h of (t.horarios || [])) {
        if (h.diaSemana === diaSemana && h.aula === aula) {
          return {
            turma:     `${t.serie}ª ${t.turma}`,
            disciplina: t.disciplina || "—",
            profNome:  "este diário",
          };
        }
      }
    }
  }

  // 2. Para professores comuns, consulta Firestore para verificar outros diários
  if (_DEV || _isAdmin(_userAtual?.email)) return null;
  try {
    const db    = firebase.firestore();
    const profs = await db.collection("professores").where("status","==","aprovado").get();
    for (const doc of profs.docs) {
      const uid = doc.id;
      if (uid === _userAtual?.uid) continue;
      const diarioSnap = await db.collection("diario").doc(uid).get();
      if (!diarioSnap.exists) continue;
      const d = diarioSnap.data();
      if (!d.RT_TURMAS) continue;
      const turmasProf = JSON.parse(d.RT_TURMAS);
      for (const t of turmasProf) {
        if (t.serie !== serie || t.turma !== turma) continue;
        for (const h of (t.horarios || [])) {
          if (h.diaSemana === diaSemana && h.aula === aula) {
            const perfil = doc.data();
            return {
              turma:      `${t.serie}ª ${t.turma}`,
              disciplina:  t.disciplina || "—",
              profNome:    perfil.nome || perfil.email || uid,
            };
          }
        }
      }
    }
    // 3. Verifica também o diário global (admin)
    const globalSnap = await db.collection("diario").doc("global").get();
    if (globalSnap.exists) {
      const d = globalSnap.data();
      if (d.RT_TURMAS) {
        const turmasGlobal = JSON.parse(d.RT_TURMAS);
        for (const t of turmasGlobal) {
          if (t.serie !== serie || t.turma !== turma) continue;
          if (t.id === turmaIdIgnorar) continue;
          for (const h of (t.horarios || [])) {
            if (h.diaSemana === diaSemana && h.aula === aula) {
              return {
                turma:      `${t.serie}ª ${t.turma}`,
                disciplina:  t.disciplina || "—",
                profNome:   "Administrador",
              };
            }
          }
        }
      }
    }
  } catch(e) { console.warn("Erro ao verificar conflito:", e); }
  return null;
}

function _mostrarModalConflito(conflito) {
  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  let el = document.getElementById("modal-conflito-horario");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-conflito-horario";
    el.className = "modal-overlay";
    el.style.cssText = "display:flex;z-index:99999";
    el.innerHTML = `
      <div class="modal-box" style="max-width:400px;text-align:center">
        <div style="font-size:2rem;margin-bottom:8px">⚠️</div>
        <h3 class="modal-titulo" style="color:#f87171">Horário já ocupado</h3>
        <p id="modal-conflito-msg" style="margin:12px 0;color:var(--text-mid);font-size:.9rem"></p>
        <div class="modal-actions">
          <button type="button" class="btn-modal-ok"
            onclick="document.getElementById('modal-conflito-horario').remove()">Entendi</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  document.getElementById("modal-conflito-msg").innerHTML =
    `A turma <strong>${conflito.turma}</strong> já tem <strong>${conflito.disciplina}</strong> neste horário,<br>
     registrado por: <strong>${conflito.profNome}</strong>.`;
  el.style.display = "flex";
}
