// GLOBALS.JS — Variáveis globais, constantes, regisTRy de alunos, utilitários puros
// Dependências: nenhuma (carrega antes de tudo)

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

