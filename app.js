// ============================================================
//  APP.JS — Controle de Aulas v4
//  Novas features:
//  · Drag multi-seleção de células de conteúdo
//  · Colunas: Chamada (checkbox) e Conteúdo Entregue (checkbox)
//  · Renomeada coluna para "Conteúdos/Atividades"
//  · Tooltips explicativos nas colunas (mouseover)
//  · Inserção de linhas eventuais (data avulsa)
//  · Painel de Gestão (séries/turmas, horários, bimestres, conteúdos)
// ============================================================

// ── Estado global ──────────────────────────────────────────
let turmaAtiva    = null;
let bimestreAtivo = null;

// estadoAulas["turmaId_bim_slotId"] = {
//   feita, dataFeita,
//   chamada,           // bool — chamada realizada?
//   conteudoEntregue,  // bool — material entregue?
//   conteudoEditado,   // string | null
//   eventual           // bool — linha eventual (não gerada por horário)
// }
let estadoAulas = {};

// ordemConteudos["turmaId_bim"] = [idxConteudo, ...]  (por slot)
let ordemConteudos = {};

// linhasEventuais["turmaId_bim"] = [ { id, data, hora, descricao } ]
let linhasEventuais = {};

// ── Drag multi-seleção ─────────────────────────────────────
let dragSrcSlots  = [];   // array de slotIds selecionados
let dragDestSlot  = null;
let selConteudos  = new Set(); // slotIds selecionados para drag

// ── Runtime mutável (editável pelo painel) ─────────────────
// Inicia como cópia dos dados do aulas.js; mudanças ficam no localStorage
let RT_BIMESTRES  = null;
let RT_TURMAS     = null;
let RT_CONTEUDOS  = null;
let RT_PERIODOS   = null;   // tabela de períodos de aula

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  carregarTudo();
  renderizarSidebar();
  renderizarBemVindo();
  iniciarTooltips();
});

// ── Persistência ───────────────────────────────────────────
function salvarTudo() {
  // Progresso salvo normalmente
  localStorage.setItem("aulaEstado",    JSON.stringify(estadoAulas));
  localStorage.setItem("aulaOrdem",     JSON.stringify(ordemConteudos));
  localStorage.setItem("aulaEventuais", JSON.stringify(linhasEventuais));
  // RT_CONTEUDOS pode ser editado pelo painel de gestão → persiste
  localStorage.setItem("RT_CONTEUDOS",  JSON.stringify(RT_CONTEUDOS));
  // RT_TURMAS, RT_BIMESTRES, RT_PERIODOS: vêm sempre do aulas.js → não persiste
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

function carregarTudo() {
  // ── Estrutura: SEMPRE do aulas.js (nunca do localStorage) ────────
  RT_BIMESTRES = JSON.parse(JSON.stringify(BIMESTRES));
  RT_TURMAS    = JSON.parse(JSON.stringify(TURMAS));
  RT_CONTEUDOS = JSON.parse(JSON.stringify(CONTEUDOS));
  RT_PERIODOS  = JSON.parse(JSON.stringify(
    typeof PERIODOS !== "undefined" ? PERIODOS : PERIODOS_PADRAO
  ));

  // ── Progresso: carrega do localStorage ───────────────────────────
  try { estadoAulas    = JSON.parse(localStorage.getItem("aulaEstado"))    || {}; } catch { estadoAulas = {}; }
  try { ordemConteudos = JSON.parse(localStorage.getItem("aulaOrdem"))     || {}; } catch { ordemConteudos = {}; }
  try { linhasEventuais= JSON.parse(localStorage.getItem("aulaEventuais")) || {}; } catch { linhasEventuais = {}; }

  // ── Semente: se aulas.js tiver ESTADO/ORDEM exportados,
  //    aplica UMA VEZ quando o localStorage ainda está vazio ─────────
  if (!localStorage.getItem("_aulasSeed")) {
    if (typeof ESTADO !== "undefined" && Object.keys(ESTADO).length > 0) {
      estadoAulas = Object.assign({}, ESTADO, estadoAulas);
    }
    if (typeof ORDEM !== "undefined" && Object.keys(ORDEM).length > 0) {
      ordemConteudos = Object.assign({}, ORDEM, ordemConteudos);
    }
    localStorage.setItem("_aulasSeed", "1");
    localStorage.setItem("aulaEstado", JSON.stringify(estadoAulas));
    localStorage.setItem("aulaOrdem",  JSON.stringify(ordemConteudos));
  }
}

// ── Chaves ─────────────────────────────────────────────────
function chaveSlot(turmaId, bim, slotId) { return `${turmaId}_b${bim}_s${slotId}`; }
function chaveOrdem(turmaId, bim)         { return `${turmaId}_b${bim}`; }
function chaveEventuais(turmaId, bim)     { return `${turmaId}_b${bim}`; }

// ── Ordem de conteúdos ─────────────────────────────────────
function getOrdem(turmaId, bim, total) {
  const k = chaveOrdem(turmaId, bim);
  if (ordemConteudos[k]?.length === total) return [...ordemConteudos[k]];
  return Array.from({length: total}, (_, i) => i);
}

function salvarOrdem(ordem) {
  ordemConteudos[chaveOrdem(turmaAtiva.id, bimestreAtivo)] = ordem;
  salvarTudo();
}

// ── Linhas eventuais ───────────────────────────────────────
function getEventuais(turmaId, bim) {
  return linhasEventuais[chaveEventuais(turmaId, bim)] || [];
}

function salvarEventuais(lista) {
  linhasEventuais[chaveEventuais(turmaAtiva.id, bimestreAtivo)] = lista;
  salvarTudo();
}

// ── Resolução de período ───────────────────────────────────
// Dado uma chave de aula (ex: "a6"), retorna o objeto período completo
function resolverPeriodo(aulaKey) {
  const p = RT_PERIODOS.find(p => p.aula === aulaKey);
  if (p && p.inicio) return p;
  return { aula: aulaKey, label: aulaKey, inicio: "00:00", fim: "00:00" };
}

// Texto completo para exibição: "6ª aula · 19:50–20:40"
function fmtPeriodo(aulaKey) {
  const p = resolverPeriodo(aulaKey);
  return p.fim ? `${p.label} · ${p.inicio}–${p.fim}` : p.inicio;
}

// ── Geração de datas ───────────────────────────────────────
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

// Combina slots regulares + eventuais, retorna lista com campo slotId único
function getSlotsCompletos(turmaId, bim) {
  const t      = RT_TURMAS.find(x => x.id === turmaId);
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bim);
  if (!t || !bimObj) return [];

  const regulares = gerarSlots(t.horarios, bimObj)
    .map((s, i) => ({ ...s, slotId: `r${i}` }));

  const eventuais = getEventuais(turmaId, bim)
    .map(e => ({
      data: e.data, aula: null, inicio: e.hora, fim: "", label: e.hora,
      eventual: true, descricao: e.descricao, slotId: `e${e.id}`
    }));

  return [...regulares, ...eventuais]
    .sort((a,b) => (a.data||"").localeCompare(b.data||"") || (a.inicio||"").localeCompare(b.inicio||""));
}

// ── Formato de data ────────────────────────────────────────
const NOMES_MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const DIAS_SEM  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function fmtData(iso) {
  if (!iso) return "—";
  const [a,m,d] = iso.split("-");
  return `${d}/${NOMES_MES[+m-1]}/${a}`;
}

// Formata a célula de data completa: "Seg, 02/fev/2026 · 6ª aula · 19:50–20:40"
function fmtSlotData(slot) {
  if (!slot.data) return "—";
  const dt  = new Date(slot.data + "T00:00:00");
  const dia = `${DIAS_SEM[dt.getDay()]}, ${fmtData(slot.data)}`;
  if (slot.eventual) return `${dia} · ${slot.inicio}`;
  return `${dia} · ${slot.label} · ${slot.inicio}–${slot.fim}`;
}

function hoje() { return new Date().toISOString().split("T")[0]; }

// ── Tooltips ───────────────────────────────────────────────
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

// ── Sidebar ────────────────────────────────────────────────
function renderizarSidebar() {
  const container = document.getElementById("sidebar-turmas");
  container.innerHTML = "";

  // Agrupa: serie → turma → [turmas]
  const porSerie = {};
  for (const t of RT_TURMAS) {
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
        // Só uma disciplina: botão simples
        const t = disciplinas[0];
        const label = t.subtitulo ? `${t.serie}ª ${t.turma} ${t.subtitulo}` : `${t.serie}ª ${t.turma}`;
        const btn = document.createElement("button");
        btn.className = "sidebar-btn";
        btn.dataset.id = t.id;
        btn.innerHTML = `<span class="sidebar-btn-label">${label}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
        btn.onclick = () => selecionarTurma(t.id);
        grpSerie.appendChild(btn);
      } else {
        // Várias disciplinas na mesma turma: agrupa com sub-itens
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

  // Botão Gestão
  const btnGestao = document.getElementById("btn-gestao");
  if (btnGestao) btnGestao.onclick = abrirPainelGestao;
}

function selecionarTurma(id) {
  turmaAtiva = RT_TURMAS.find(t => t.id === id);
  if (!turmaAtiva) return;
  selConteudos.clear();
  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.toggle("ativo", b.dataset.id === id));
  const h = hoje();
  const v = RT_BIMESTRES.find(b => h >= b.inicio && h <= b.fim);
  bimestreAtivo = v ? v.bimestre : 1;
  renderizarConteudo();
}

// ── Boas-vindas ────────────────────────────────────────────
function renderizarBemVindo() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="bem-vindo">
      <div class="bem-vindo-icon">📋</div>
      <h2>Controle de Aulas</h2>
      <p>Selecione uma turma na barra lateral para visualizar<br>o planejamento e registrar as aulas dadas.</p>
    </div>`;
}

// ── View principal ─────────────────────────────────────────
function renderizarConteudo() {
  const t = turmaAtiva;
  const main = document.getElementById("conteudo-principal");
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bimestreAtivo);
  const slots  = getSlotsCompletos(t.id, bimestreAtivo);
  const total  = slots.length;
  const labelTurma = t.subtitulo ? `${t.serie}ª Série ${t.turma} — ${t.subtitulo}` : `${t.serie}ª Série ${t.turma}`;

  // Estatísticas: conta só slots regulares com "feita"
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
          <h1 class="header-turma-nome">${labelTurma}</h1>
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
        <span class="hint-drag">✎ Clique no conteúdo para editar &nbsp;·&nbsp; ⠿ Arraste (Ctrl+⠿ seleciona múltiplos)</span>
        <span class="pct-badge">${pct}% concluído</span>
      </div>
    </div>

    <div class="tabela-wrapper">
      ${total === 0
        ? `<div class="sem-aulas">Nenhuma aula prevista neste bimestre.</div>`
        : `<table class="tabela-aulas" id="tabela-aulas">
            <thead><tr>
              <th class="th-numero"   data-tip="${TOOLTIPS_COLUNAS['th-numero']}">#</th>
              <th class="th-data"     data-tip="${TOOLTIPS_COLUNAS['th-data']}">Data prevista</th>
              <th class="th-conteudo" data-tip="${TOOLTIPS_COLUNAS['th-conteudo']}">Conteúdos / Atividades</th>
              <th class="th-chamada"  data-tip="${TOOLTIPS_COLUNAS['th-chamada']}">Chamada</th>
              <th class="th-entregue" data-tip="${TOOLTIPS_COLUNAS['th-entregue']}">Entregue</th>
              <th class="th-dada"     data-tip="${TOOLTIPS_COLUNAS['th-dada']}">Dada?</th>
              <th class="th-registro" data-tip="${TOOLTIPS_COLUNAS['th-registro']}">Registro</th>
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

    <!-- Modal: aula eventual -->
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

// ── Renderiza tbody ────────────────────────────────────────
function renderizarLinhas(slots) {
  const t      = turmaAtiva;
  const tbody  = document.getElementById("tbody-aulas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const chaveC = `${t.serie}_${t.disciplina}`;
  const conts  = RT_CONTEUDOS[chaveC] || [];

  // Monta ordem só para slots regulares
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem    = getOrdem(t.id, bimestreAtivo, slotsReg.length);

  // Índice para slots regulares
  let regIdx = 0;
  let lineNum = 0;

  for (const slot of slots) {
    lineNum++;
    const slotId = slot.slotId;
    const ch     = chaveSlot(t.id, bimestreAtivo, slotId);
    const est    = estadoAulas[ch] || {};
    const feita  = !!est.feita;

    let conteudoBase = "";
    let conteudoExibido = "";
    let editado = false;

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

    // Checkboxes
    const mkChk = (campo, val, title) => `
      <label class="checkbox-wrapper" title="${title}">
        <input type="checkbox" ${val?"checked":""} onchange="toggleCampo('${slotId}','${campo}',this.checked)">
        <span class="checkmark ${campo==='feita'?'':'checkmark-alt'}"></span>
      </label>`;

    tr.innerHTML = `
      <td class="td-numero">${slot.eventual ? `<span class="tag-eventual" title="Aula eventual">E</span>` : lineNum}</td>
      <td class="td-data">${fmtSlotData(slot)}</td>
      <td class="td-conteudo" data-slot="${slotId}">
        <div class="conteudo-cell">
          <span class="drag-handle-cont ${selecionado?"handle-sel":""}"
            data-slot="${slotId}" draggable="true"
            title="Arrastar · Ctrl+clique para selecionar múltiplos">⠿</span>
          <span class="conteudo-texto ${editado?"editado":""}"
            data-slot="${slotId}"
            title="${editado?"Editado · clique para editar":"Clique para editar"}"
          >${conteudoExibido||'<span class="sem-conteudo">—</span>'}</span>
          ${editado?'<span class="badge-editado">✎</span>':""}
          ${slot.eventual?`<button class="btn-del-eventual" onclick="removerEventual('${slotId}')" title="Remover esta aula eventual">×</button>`:""}
        </div>
      </td>
      <td class="td-check">${mkChk("chamada", !!est.chamada,   "Chamada realizada?")}</td>
      <td class="td-check">${mkChk("conteudoEntregue", !!est.conteudoEntregue, "Material entregue?")}</td>
      <td class="td-check">${mkChk("feita",   feita, "Aula dada?")}</td>
      <td class="td-registro" id="reg-${slotId}">${feita?fmtData(est.dataFeita):"—"}</td>`;

    // Edição inline
    const spanTxt = tr.querySelector(".conteudo-texto");
    spanTxt.addEventListener("click", () => iniciarEdicao(spanTxt, slotId, conteudoBase));

    // Drag handles
    const handle = tr.querySelector(".drag-handle-cont");
    handle.addEventListener("click",      e => onHandleClick(e, slotId));
    handle.addEventListener("dragstart",  e => onDragStart(e, slotId));
    handle.addEventListener("dragend",    onDragEnd);

    // Drop zone
    const tdC = tr.querySelector(".td-conteudo");
    tdC.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; });
    tdC.addEventListener("dragenter", e => onDragEnter(e, slotId));
    tdC.addEventListener("dragleave", e => onDragLeave(e));
    tdC.addEventListener("drop",      e => onDrop(e, slotId));

    tbody.appendChild(tr);
  }
}

// ── Edição inline ──────────────────────────────────────────
function iniciarEdicao(spanEl, slotId, base) {
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
    if (novo === base || novo === "") delete estadoAulas[ch].conteudoEditado;
    else estadoAulas[ch].conteudoEditado = novo;
    salvarTudo();

    const editado = estadoAulas[ch]?.conteudoEditado != null;
    const exibido = editado ? estadoAulas[ch].conteudoEditado : (base || "");
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

// ── Toggle campos ──────────────────────────────────────────
function toggleCampo(slotId, campo, val) {
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

// ── Drag-and-drop MULTI (só coluna conteúdo) ──────────────
// Ctrl+clique no ⠿ = toggle individual
// Alt+clique  no ⠿ = seleciona intervalo desde o último selecionado
// Drag sem seleção = move só aquela célula
// Drag com seleção = move o bloco todo

let ultimoSelecionado = null; // slotId do último Ctrl+clique (para Alt-range)

function onHandleClick(e, slotId) {
  if (e.altKey) {
    // Alt+clique: seleciona intervalo entre ultimoSelecionado e este
    e.preventDefault();
    const todos = [...document.querySelectorAll(".drag-handle-cont[data-slot]")]
      .map(h => h.dataset.slot);
    if (ultimoSelecionado && todos.includes(ultimoSelecionado)) {
      const iA = todos.indexOf(ultimoSelecionado);
      const iB = todos.indexOf(slotId);
      const [de, ate] = iA < iB ? [iA, iB] : [iB, iA];
      for (let i = de; i <= ate; i++) selConteudos.add(todos[i]);
    } else {
      selConteudos.add(slotId);
    }
    ultimoSelecionado = slotId;
    atualizarVisualizacaoSel();
  } else if (e.ctrlKey || e.metaKey) {
    // Ctrl+clique: toggle individual
    e.preventDefault();
    if (selConteudos.has(slotId)) selConteudos.delete(slotId);
    else selConteudos.add(slotId);
    ultimoSelecionado = slotId;
    atualizarVisualizacaoSel();
  }
  // Clique simples sem modificador: não faz nada (drag inicia pelo dragstart)
}

function atualizarVisualizacaoSel() {
  document.querySelectorAll(".drag-handle-cont").forEach(h => {
    const sid = h.dataset.slot;
    h.classList.toggle("handle-sel", selConteudos.has(sid));
  });
  document.querySelectorAll("tr[data-slot]").forEach(tr => {
    tr.classList.toggle("row-sel-cont", selConteudos.has(tr.dataset.slot));
  });
}

function onDragStart(e, slotId) {
  // Se o slot arrastado não está na seleção, cria seleção só com ele
  if (!selConteudos.has(slotId)) {
    selConteudos.clear();
    selConteudos.add(slotId);
    atualizarVisualizacaoSel();
  }
  dragSrcSlots = [...selConteudos];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", slotId);
  // Marca origem visualmente
  dragSrcSlots.forEach(sid => {
    document.querySelector(`td.td-conteudo[data-slot="${sid}"]`)?.classList.add("content-dragging");
  });
}

function onDragEnd() {
  document.querySelectorAll(".content-dragging,.content-drag-over").forEach(el =>
    el.classList.remove("content-dragging","content-drag-over")
  );
  dragSrcSlots  = [];
  dragDestSlot  = null;
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

  const t      = turmaAtiva;
  const slots  = getSlotsCompletos(t.id, bimestreAtivo);
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem  = getOrdem(t.id, bimestreAtivo, slotsReg.length);

  // Converte slotIds para índices no array slotsReg
  function slotIdxReg(slotId) { return slotsReg.findIndex(s => s.slotId === slotId); }

  const srcIdxs  = dragSrcSlots.map(slotIdxReg).filter(i => i >= 0);
  const destIdx  = slotIdxReg(destSlotId);

  if (destIdx < 0 && !slots.find(s=>s.slotId===destSlotId)?.eventual) return;

  // Se destino é eventual, não reorganiza ordem (sem índice regular), só troca edições
  if (destIdx < 0) return; // drag para eventual não faz sentido na ordem

  // Reorganiza: remove srcs e insere antes do dest
  const novaOrdem = [...ordem];
  const srcContents = srcIdxs.map(i => ({
    contIdx: novaOrdem[i],
    editado: estadoAulas[chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId)]?.conteudoEditado
  }));

  // Remove do array de destino
  const srcSet = new Set(srcIdxs);
  const restantes = novaOrdem.filter((_, i) => !srcSet.has(i));
  const destPosEmRestantes = restantes.indexOf(novaOrdem[destIdx]);

  const insPos = destPosEmRestantes >= 0 ? destPosEmRestantes : restantes.length;
  restantes.splice(insPos, 0, ...srcContents.map(s => s.contIdx));

  // Rebuild conteudoEditado: zera os slots src, redistribui
  srcIdxs.forEach(i => {
    const ch = chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });

  // Encontra quais slots ficaram com os conteúdos movidos
  let srcPtr = 0;
  for (let i = 0; i < restantes.length; i++) {
    const slotId = slotsReg[i]?.slotId;
    if (!slotId) continue;
    // Se o conteúdo em restantes[i] veio de srcContents, replica editado
    const origSrcIdx = srcContents.findIndex((s,j) => s.contIdx === restantes[i] && j === srcPtr);
    if (origSrcIdx >= 0 && srcContents[origSrcIdx].editado != null) {
      const ch = chaveSlot(t.id, bimestreAtivo, slotId);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch].conteudoEditado = srcContents[origSrcIdx].editado;
      srcPtr++;
    }
  }

  salvarOrdem(restantes);
  salvarTudo();
  selConteudos.clear();
  renderizarLinhas(slots);
}

// ── Mudar bimestre ─────────────────────────────────────────
function mudarBimestre(num) {
  bimestreAtivo = num;
  selConteudos.clear();
  renderizarConteudo();
}

// ── Resetar ordem ──────────────────────────────────────────
function resetarOrdem() {
  if (!confirm("Restaurar ordem original dos conteúdos?")) return;
  delete ordemConteudos[chaveOrdem(turmaAtiva.id, bimestreAtivo)];
  salvarTudo();
  renderizarConteudo();
}

// ── Aulas eventuais ────────────────────────────────────────
function abrirModalEventual() {
  document.getElementById("ev-data").value = hoje();
  document.getElementById("modal-eventual").style.display = "flex";
}

function fecharModalEventual() {
  document.getElementById("modal-eventual").style.display = "none";
}

function confirmarEventual() {
  const data = document.getElementById("ev-data").value;
  const hora = document.getElementById("ev-hora").value || "07:00";
  const desc = document.getElementById("ev-desc").value.trim();
  if (!data) { alert("Informe a data."); return; }

  const lista = getEventuais(turmaAtiva.id, bimestreAtivo);
  const id    = Date.now();
  lista.push({ id, data, hora, descricao: desc });
  salvarEventuais(lista);
  fecharModalEventual();
  renderizarConteudo();
}

function removerEventual(slotId) {
  const eId = parseInt(slotId.replace("e",""), 10);
  const lista = getEventuais(turmaAtiva.id, bimestreAtivo).filter(e => e.id !== eId);
  salvarEventuais(lista);
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  delete estadoAulas[ch];
  salvarTudo();
  renderizarConteudo();
}

// ── Limpar ─────────────────────────────────────────────────
function confirmarLimpar() {
  const lbl = RT_BIMESTRES.find(b=>b.bimestre===bimestreAtivo)?.label;
  if (!confirm(`Apagar todos os registros do ${lbl} desta turma?`)) return;
  getSlotsCompletos(turmaAtiva.id, bimestreAtivo).forEach(s => {
    delete estadoAulas[chaveSlot(turmaAtiva.id, bimestreAtivo, s.slotId)];
  });
  salvarTudo();
  selConteudos.clear();
  renderizarConteudo();
}

// ── Exportar CSV ───────────────────────────────────────────
function exportarCSV() {
  const t      = turmaAtiva;
  const slots  = getSlotsCompletos(t.id, bimestreAtivo);
  const chaveC = `${t.serie}_${t.disciplina}`;
  const conts  = RT_CONTEUDOS[chaveC] || [];
  const slotsReg = slots.filter(s=>!s.eventual);
  const ordem  = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  let rIdx = 0;

  const linhas = [["#","Data","Horário","Conteúdos/Atividades","Chamada","Entregue","Dada?","Registro"]];
  slots.forEach((slot, i) => {
    const ch  = chaveSlot(t.id, bimestreAtivo, slot.slotId);
    const est = estadoAulas[ch] || {};
    let cont  = slot.eventual ? (slot.descricao||"") : (est.conteudoEditado ?? (conts[ordem[rIdx]]||""));
    if (!slot.eventual) rIdx++;
    const horarioFmt = slot.eventual ? slot.inicio : (slot.label ? `${slot.label} (${slot.inicio}–${slot.fim})` : slot.inicio);
    linhas.push([
      i+1, fmtData(slot.data), horarioFmt, cont,
      est.chamada?"Sim":"Não",
      est.conteudoEntregue?"Sim":"Não",
      est.feita?"Sim":"Não",
      est.feita?fmtData(est.dataFeita):"",
    ]);
  });

  const csv  = linhas.map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const lbl  = t.subtitulo?`${t.serie}${t.turma}_${t.subtitulo}`:`${t.serie}${t.turma}`;
  baixarArquivo(blob,`aulas_${lbl}_${t.sigla}_bim${bimestreAtivo}.csv`);
}

// ── Exportar aulas.js ──────────────────────────────────────
function exportarJS() {
  const contUpd = {};
  for (const [k,lista] of Object.entries(RT_CONTEUDOS)) {
    contUpd[k] = lista.map((txt,idx) => {
      let final = txt;
      for (const t of RT_TURMAS) {
        if (`${t.serie}_${t.disciplina}` !== k) continue;
        for (const bim of RT_BIMESTRES) {
          const ord = ordemConteudos[chaveOrdem(t.id,bim.bimestre)];
          if (!ord) continue;
          const slots = getSlotsCompletos(t.id,bim.bimestre).filter(s=>!s.eventual);
          for (let i=0;i<ord.length;i++) {
            if (ord[i]===idx) { const est=estadoAulas[chaveSlot(t.id,bim.bimestre,slots[i]?.slotId)]; if(est?.conteudoEditado) final=est.conteudoEditado; }
          }
        }
      }
      return final;
    });
  }

  const out = [
    `// AULAS.JS — Exportado em ${new Date().toLocaleString("pt-BR")}`,
    `const BIMESTRES = ${JSON.stringify(RT_BIMESTRES,null,2)};`,
    `const TURMAS    = ${JSON.stringify(RT_TURMAS,null,2)};`,
    `const CONTEUDOS = ${JSON.stringify(contUpd,null,2)};`,
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
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="gestao-painel">
      <div class="gestao-header">
        <h1 class="gestao-titulo">⚙ Painel de Gestão</h1>
        <button class="btn-voltar" onclick="voltarPrincipal()">← Voltar</button>
      </div>

      <div class="gestao-tabs">
        <button class="gtab ativo" onclick="abrirGTab(this,'g-turmas')">Séries / Turmas</button>
        <button class="gtab" onclick="abrirGTab(this,'g-bimestres')">Bimestres</button>
        <button class="gtab" onclick="abrirGTab(this,'g-conteudos')">Conteúdos</button>
      </div>

      <div id="g-turmas" class="gestao-secao ativa">${htmlGestaoTurmas()}</div>
      <div id="g-bimestres" class="gestao-secao">${htmlGestaoBimestres()}</div>
      <div id="g-conteudos" class="gestao-secao">${htmlGestaoConteudos()}</div>
    </div>`;
}

function abrirGTab(btn, secId) {
  document.querySelectorAll(".gtab").forEach(b=>b.classList.remove("ativo"));
  document.querySelectorAll(".gestao-secao").forEach(s=>s.classList.remove("ativa"));
  btn.classList.add("ativo");
  document.getElementById(secId).classList.add("ativa");
  // Re-renderiza a seção
  if (secId==="g-turmas")    document.getElementById(secId).innerHTML = htmlGestaoTurmas();
  if (secId==="g-bimestres") document.getElementById(secId).innerHTML = htmlGestaoBimestres();
  if (secId==="g-conteudos") document.getElementById(secId).innerHTML = htmlGestaoConteudos();
}

function voltarPrincipal() {
  renderizarSidebar();
  if (turmaAtiva) renderizarConteudo(); else renderizarBemVindo();
}

// ── Gestão: Turmas ─────────────────────────────────────────
function htmlGestaoTurmas() {
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const rows = RT_TURMAS.map((t,i) => `
    <tr>
      <td>${t.serie}ª</td>
      <td><input class="gi gi-xs" value="${t.turma}" onchange="editTurmaField(${i},'turma',this.value)" /></td>
      <td><input class="gi gi-sm" value="${t.subtitulo}" onchange="editTurmaField(${i},'subtitulo',this.value)" /></td>
      <td><input class="gi" value="${t.disciplina}" onchange="editTurmaField(${i},'disciplina',this.value)" /></td>
      <td><input class="gi gi-xs" value="${t.sigla}" onchange="editTurmaField(${i},'sigla',this.value)" /></td>
      <td>
        <div class="horarios-lista">
          ${t.horarios.map((h,hi) => `
            <div class="horario-item">
              <select class="gi gi-xs" onchange="editHorario(${i},${hi},'diaSemana',+this.value)">
                ${diasNomes.map((d,di)=>`<option value="${di}" ${h.diaSemana===di?"selected":""}>${d}</option>`).join("")}
              </select>
              <select class="gi gi-sm" onchange="editHorario(${i},${hi},'aula',this.value)">
                ${RT_PERIODOS.map(p=>`<option value="${p.aula}" ${h.aula===p.aula?"selected":""}>${p.label} (${p.inicio}–${p.fim})</option>`).join("")}
              </select>
              <button class="btn-icon-del" onclick="delHorario(${i},${hi})" title="Remover">×</button>
            </div>`).join("")}
          <button class="btn-add-small" onclick="addHorario(${i})">+ Horário</button>
        </div>
      </td>
      <td><button class="btn-icon-del" onclick="delTurma(${i})" title="Excluir turma">🗑</button></td>
    </tr>`).join("");

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
            <th>Disciplina</th><th>Sigla</th><th>Horários (dia + período)</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function editTurmaField(i, campo, val) {
  RT_TURMAS[i][campo] = val;
  salvarTudo();
}

function editHorario(ti, hi, campo, val) {
  RT_TURMAS[ti].horarios[hi][campo] = campo==="diaSemana" ? +val : val;
  salvarTudo();
}

function addHorario(ti) {
  RT_TURMAS[ti].horarios.push({ diaSemana: 1, aula: "a1" });
  salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}

function delHorario(ti, hi) {
  RT_TURMAS[ti].horarios.splice(hi, 1);
  salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}

function delTurma(i) {
  if (!confirm(`Excluir a turma ${RT_TURMAS[i].id}?`)) return;
  RT_TURMAS.splice(i, 1);
  salvarTudo();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}

function addTurma() {
  const serie = prompt("Série (1, 2 ou 3):", "1"); if (!serie) return;
  const turma = prompt("Turma (A–E):", "A");        if (!turma) return;
  const disc  = prompt("Disciplina:", "Geografia"); if (!disc)  return;
  const sigla = prompt("Sigla:", "GEO");            if (!sigla) return;
  const id    = `${serie}${turma}_${sigla.toUpperCase()}`;
  if (RT_TURMAS.find(t=>t.id===id)) { alert("Turma com este ID já existe."); return; }
  RT_TURMAS.push({ id, serie, turma, subtitulo:"", disciplina:disc, sigla:sigla.toUpperCase(), horarios:[] });
  salvarTudo();
  renderizarSidebar();
  document.getElementById("g-turmas").innerHTML = htmlGestaoTurmas();
}

// ── Gestão: Bimestres ──────────────────────────────────────
function htmlGestaoBimestres() {
  const rows = RT_BIMESTRES.map((b,i) => `
    <tr>
      <td><input class="gi gi-sm" value="${b.label}" onchange="editBimField(${i},'label',this.value)" /></td>
      <td><input class="gi" type="date" value="${b.inicio}" onchange="editBimField(${i},'inicio',this.value)" /></td>
      <td><input class="gi" type="date" value="${b.fim}"    onchange="editBimField(${i},'fim',this.value)" /></td>
      <td><button class="btn-icon-del" onclick="delBim(${i})">🗑</button></td>
    </tr>`).join("");

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Bimestres / Períodos</h3>
        <button class="btn-add" onclick="addBim()">+ Novo período</button>
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr><th>Rótulo</th><th>Início</th><th>Fim</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function editBimField(i, campo, val) {
  RT_BIMESTRES[i][campo] = campo==="bimestre" ? +val : val;
  salvarTudo();
}

function delBim(i) {
  if (!confirm("Excluir este período?")) return;
  RT_BIMESTRES.splice(i,1);
  salvarTudo();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}

function addBim() {
  const num = RT_BIMESTRES.length + 1;
  RT_BIMESTRES.push({ bimestre: num, label: `${num}º Bimestre`, inicio: "", fim: "" });
  salvarTudo();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}

// ── Gestão: Conteúdos ──────────────────────────────────────
let gContChave = null;
let gContModo  = "lista"; // "lista" | "bloco"

function htmlGestaoConteudos() {
  const chaves = Object.keys(RT_CONTEUDOS);
  const chave  = gContChave || chaves[0] || null;
  if (chave && !RT_CONTEUDOS[chave]) gContChave = chaves[0];
  const chaveAtiva = gContChave || chave;

  const selectorBtns = chaves.map(k => `
    <button class="gtab-cont ${k===chaveAtiva?"ativo":""}" onclick="selecionarChaveCont('${k}')">${k}</button>`).join("");

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
        <h3>Conteúdos por disciplina / série</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn-add btn-outline" onclick="gContModo='bloco'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">✎ Editar em bloco</button>
          <button class="btn-add" onclick="addChaveCont()">+ Nova chave</button>
        </div>
      </div>
      <div class="gtab-cont-bar">${selectorBtns}</div>
      ${chaveAtiva ? conteudoEditor : `<p style="padding:20px;color:#aaa">Nenhuma disciplina cadastrada.</p>`}
    </div>`;
}

function salvarBloco(chave) {
  const texto = document.getElementById("bloco-textarea").value;
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  RT_CONTEUDOS[chave] = linhas;
  gContModo = "lista";
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function selecionarChaveCont(k) {
  gContChave = k;
  gContModo  = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function editConteudo(chave, i, val) {
  RT_CONTEUDOS[chave][i] = val;
  salvarTudo();
}

function delConteudo(chave, i) {
  if (!confirm("Remover esta aula da lista?")) return;
  RT_CONTEUDOS[chave].splice(i,1);
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function addConteudo(chave) {
  RT_CONTEUDOS[chave].push("");
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
  // Foca no último input
  setTimeout(() => {
    const inputs = document.querySelectorAll("#tabela-conteudos .gi-full");
    inputs[inputs.length-1]?.focus();
  }, 50);
}

function addChaveCont() {
  const k = prompt("Chave no formato 'serie_Disciplina' (ex: 1_Historia):");
  if (!k) return;
  if (RT_CONTEUDOS[k]) { alert("Já existe."); return; }
  RT_CONTEUDOS[k] = [];
  gContChave = k;
  gContModo  = "bloco";
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

// Drag dentro da lista de conteúdos
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
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}
