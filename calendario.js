// ============================================================
//  CALENDARIO.JS — Visão Calendário do Diário de Aulas v3
//  Depende de app.js:
//  RT_TURMAS, RT_BIMESTRES, RT_PERIODOS, RT_CONTEUDOS,
//  estadoAulas, getSlotsCompletos, getOrdem,
//  chaveSlot, fmtData, hoje, salvarTudo
// ============================================================

let calView    = "semana";
let calDataRef = null;

const _CAL_MESES    = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                       "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const _CAL_MESES_AB = ["Jan","Fev","Mar","Abr","Mai","Jun",
                       "Jul","Ago","Set","Out","Nov","Dez"];
const _CAL_DIAS     = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function calIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function calAulasNoDia(isoDate) {
  const lista = [];
  for (const t of (_turmasVisiveis ? _turmasVisiveis() : (RT_TURMAS || []))) {
    for (const bim of (RT_BIMESTRES || [])) {
      if (isoDate < bim.inicio || isoDate > bim.fim) continue;
      const slots = getSlotsCompletos(t.id, bim.bimestre);
      for (const slot of slots) {
        if (slot.data !== isoDate) continue;
        const ch  = chaveSlot(t.id, bim.bimestre, slot.slotId);
        const est = estadoAulas[ch] || {};
        lista.push({ turma: t, bim: bim.bimestre, slot, ch, est });
      }
    }
  }
  lista.sort((a,b) => (a.slot.inicio||"").localeCompare(b.slot.inicio||""));
  return lista;
}

// ── Toggle — NÃO depende de turmaAtiva/bimestreAtivo ──────────
function calToggle(turmaId, bimestre, slotId, campo, novoVal, inputEl) {
  if (!_autenticado) {
    if (inputEl) inputEl.checked = !novoVal;
    _abrirModalGoogle();
    return;
  }
  if (_ehCoordenador()) {
    if (inputEl) inputEl.checked = !novoVal;
    _mostrarIndicadorSync("⛔ Somente leitura");
    return;
  }
  const ch = chaveSlot(turmaId, bimestre, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch][campo] = novoVal;
  if (campo === "feita") estadoAulas[ch].dataFeita = novoVal ? hoje() : null;
  salvarTudo();
  _calRenderCorpo();
}

// ── Conteúdo textual de uma aula ──────────────────────────────
// Tenta primeiro chave específica por bimestre, depois chave genérica
function _calConteudo(turma, slot, bim) {
  const est = estadoAulas[chaveSlot(turma.id, bim, slot.slotId)] || {};
  if (est.conteudoEditado) return est.conteudoEditado;
  if (slot.eventual) return slot.descricao || "";
  try {
    const slotsReg = getSlotsCompletos(turma.id, bim).filter(s => !s.eventual);
    const ordem    = getOrdem(turma.id, bim, slotsReg.length);
    const ri       = slotsReg.findIndex(s => s.slotId === slot.slotId);
    const ci       = ri >= 0 ? ordem[ri] : null;
    const conts    = RT_CONTEUDOS[`${turma.serie}_${turma.disciplina}_b${bim}`]
                  || RT_CONTEUDOS[`${turma.serie}_${turma.disciplina}`] || [];
    return (ci != null && conts[ci]) ? conts[ci] : "";
  } catch { return ""; }
}

// ── Abre o calendário
// No mobile usa visão "dia"; no desktop usa "semana"
function abrirCalendario() {
  calDataRef = new Date();
  calView    = window.innerWidth <= 860 ? "dia" : "semana";
  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("ativo"));
  document.getElementById("btn-calendario")?.classList.add("ativo");
  _calRender();
}

function fecharCalendario() {
  document.getElementById("btn-calendario")?.classList.remove("ativo");
  if (turmaAtiva) renderizarConteudo();
  else            renderizarBemVindo();
}

function calIrTurma(turmaId) {
  document.getElementById("btn-calendario")?.classList.remove("ativo");
  selecionarTurma(turmaId);
}

// ── Estrutura HTML fixa ───────────────────────────────────────
function _calRender() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="cal-painel">
      <div class="cal-header">
        <div class="cal-header-esq">
          <h1 class="cal-titulo">Calendário de Aulas</h1>
          <div class="cal-legenda">
            <span class="cal-leg-item"><span class="cal-leg cal-leg-ad"></span>AD — Aula dada</span>
            <span class="cal-leg-item"><span class="cal-leg cal-leg-ch"></span>CH — Chamada</span>
            <span class="cal-leg-item"><span class="cal-leg cal-leg-re"></span>RE — Registro</span>
          </div>
        </div>
        <button class="btn-voltar" onclick="fecharCalendario()">← Voltar</button>
      </div>
      <div class="cal-toolbar">
        <div class="cal-nav">
          <button class="cal-btn-nav" onclick="calAnterior()">&#8249;</button>
          <span class="cal-nav-label" id="cal-label"></span>
          <button class="cal-btn-nav" onclick="calProximo()">&#8250;</button>
          <button class="cal-btn-hoje" onclick="calHoje()">Hoje</button>
        </div>
        <div class="cal-views-bar">
          <button class="cal-view-btn" data-view="mes"    onclick="calMudarView('mes')">Mês</button>
          <button class="cal-view-btn" data-view="semana" onclick="calMudarView('semana')">Semana</button>
          <button class="cal-view-btn" data-view="dia"    onclick="calMudarView('dia')">Dia</button>
        </div>
      </div>
      <div id="cal-corpo"></div>
    </div>`;
  _calAtivarViewBtn();
  _calRenderCorpo();
}

function _calAtivarViewBtn() {
  document.querySelectorAll(".cal-view-btn").forEach(b =>
    b.classList.toggle("ativo", b.dataset.view === calView)
  );
}

function _calRenderCorpo() {
  if (calView === "mes")    _calRenderMes();
  if (calView === "semana") _calRenderSemana();
  if (calView === "dia")    _calRenderDia();
}

// ── Navegação ─────────────────────────────────────────────────
function calAnterior() {
  if (calView === "mes")    calDataRef.setMonth(calDataRef.getMonth() - 1);
  if (calView === "semana") calDataRef.setDate(calDataRef.getDate() - 7);
  if (calView === "dia")    calDataRef.setDate(calDataRef.getDate() - 1);
  _calRenderCorpo();
}
function calProximo() {
  if (calView === "mes")    calDataRef.setMonth(calDataRef.getMonth() + 1);
  if (calView === "semana") calDataRef.setDate(calDataRef.getDate() + 7);
  if (calView === "dia")    calDataRef.setDate(calDataRef.getDate() + 1);
  _calRenderCorpo();
}
function calHoje()       { calDataRef = new Date(); _calRenderCorpo(); }
function calMudarView(v) { calView = v; _calAtivarViewBtn(); _calRenderCorpo(); }
function calIrDia(isoDate) {
  const [y,m,d] = isoDate.split("-").map(Number);
  calDataRef = new Date(y, m-1, d);
  calView = "dia";
  _calAtivarViewBtn();
  _calRenderCorpo();
}

// ════════════════════════════════════════════════════════════
//  Botões AD / CH / RE
// ════════════════════════════════════════════════════════════
function _calChecks(item, modo) {
  const { turma, bim, slot, est } = item;
  const ad  = !!est.feita;
  const ch  = !!est.chamada;
  const reg = !!est.conteudoEntregue;
  const tid = turma.id, b = bim, sid = slot.slotId;

  const btn = (campo, val, label, tipo) => {
    const cls   = val ? `cal-chk-on cal-chk-on-${tipo}` : "cal-chk-off";
    const ico   = val ? "✓" : "○";
    const title = `${label}: ${val ? "feito — clique para desmarcar" : "não feito — clique para marcar"}`;
    return `<button class="cal-chk cal-chk-${modo} ${cls}"
      title="${title}"
      onclick="event.stopPropagation(); calToggle('${tid}',${b},'${sid}','${campo}',${!val})"
    ><span class="cal-chk-ico">${ico}</span><span class="cal-chk-lbl">${label}</span></button>`;
  };

  return `<div class="cal-checks-row cal-checks-${modo}">
    ${btn("feita",            ad,  "AD", "ad")}
    ${btn("chamada",          ch,  "CH", "ch")}
    ${btn("conteudoEntregue", reg, "RE", "re")}
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  CHIP COMPACTO — visão mês
// ════════════════════════════════════════════════════════════
function _calChipMes(item) {
  const { turma, slot, est } = item;
  const ad  = !!est.feita, ch = !!est.chamada, reg = !!est.conteudoEntregue;
  const passada = slot.data < hoje();
  const cor = ad ? "chip-cor-ad" : (passada ? "chip-cor-pend" : "chip-cor-fut");
  return `<div class="cal-chip-mes ${cor}"
    title="${turma.serie}ª ${turma.turma}${turma.subtitulo?" "+turma.subtitulo:""} · ${turma.sigla}&#10;${slot.label||slot.aula||""} ${slot.inicio}–${slot.fim}">
    <span class="cpm-turma">${turma.serie}ª${turma.turma}<em>${turma.sigla}</em></span>
    <span class="cpm-hora">${slot.inicio||""}</span>
    <span class="cpm-dots">
      <span class="dot ${ad  ? "dot-ad"  : "dot-off"}" title="AD">●</span>
      <span class="dot ${ch  ? "dot-ch"  : "dot-off"}" title="CH">●</span>
      <span class="dot ${reg ? "dot-reg" : "dot-off"}" title="RE">●</span>
    </span>
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  CARD SEMANA
// ════════════════════════════════════════════════════════════
function _calCardSem(item) {
  const { turma, slot, est } = item;
  const ad  = !!est.feita;
  const passada = slot.data < hoje();
  const cor = ad ? "chip-cor-ad" : (passada ? "chip-cor-pend" : "chip-cor-fut");
  return `<div class="cal-card-sem ${cor}">
    <button class="ccs-topo cal-turma-link" onclick="calIrTurma('${turma.id}')" title="Abrir diário de classe: ${turma.serie}ª ${turma.turma} ${turma.disciplina}">
      <span class="ccs-sigla">${turma.sigla}</span>
      <span class="ccs-nome">${turma.serie}ª${turma.turma}${turma.subtitulo ? " "+turma.subtitulo : ""}</span>
      <span class="ccs-link-ico">↗</span>
    </button>
    ${_calChecks(item, "sm")}
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  CARD DIA
// ════════════════════════════════════════════════════════════
function _calCardDia(item) {
  const { turma, slot, est, bim } = item;
  const ad      = !!est.feita;
  const passada = slot.data < hoje();
  const cor     = ad ? "card-ad" : (passada ? "card-pend" : "card-fut");
  const status  = ad
    ? `✓ Dada${est.dataFeita ? " em " + fmtData(est.dataFeita) : ""}`
    : (passada ? "⚠ Pendente" : "—");
  const conteudo = _calConteudo(turma, slot, bim);

  return `<div class="cal-card-dia ${cor}">
    <div class="ccd-topo">
      <button class="ccd-info cal-turma-link" onclick="calIrTurma('${turma.id}')" title="Abrir diário de classe: ${turma.serie}ª ${turma.turma} ${turma.disciplina}">
        <span class="ccd-sigla-badge">${turma.sigla}</span>
        <div class="ccd-nomes">
          <span class="ccd-nome-turma">${turma.serie}ª Série ${turma.turma}${turma.subtitulo?" — "+turma.subtitulo:""}</span>
          <span class="ccd-disciplina">${turma.disciplina}</span>
        </div>
        <span class="ccd-link-ico">↗</span>
      </button>
      <div class="ccd-status-pill ${ad?"pill-ad":(passada?"pill-pend":"pill-fut")}">${status}</div>
    </div>
    ${conteudo ? `<div class="ccd-conteudo">${conteudo}</div>` : ""}
    ${_calChecks(item, "lg")}
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  VISÃO MÊS
// ════════════════════════════════════════════════════════════
function _calRenderMes() {
  const ano = calDataRef.getFullYear(), mes = calDataRef.getMonth();
  document.getElementById("cal-label").textContent = `${_CAL_MESES[mes]} ${ano}`;

  const dia1 = new Date(ano, mes, 1);
  const cur  = new Date(dia1);
  cur.setDate(1 - dia1.getDay());
  const hojeIso = hoje();

  let html = `<div class="cal-mes">
    <div class="cal-mes-header">${_CAL_DIAS.map(d=>`<div class="cal-mes-dh">${d}</div>`).join("")}</div>
    <div class="cal-mes-grid">`;

  for (let s = 0; s < 6; s++) {
    for (let d = 0; d < 7; d++) {
      const iso    = calIso(cur);
      const doMes  = cur.getMonth() === mes;
      const ehHoje = iso === hojeIso;
      const aulas  = calAulasNoDia(iso);
      const MAX    = 4;

      html += `<div class="cal-dia-cel${doMes?"":" cal-outro-mes"}${ehHoje?" cal-hoje":""}"
               onclick="calIrDia('${iso}')">
        <div class="cal-dia-num-wrap">
          <span class="cal-dia-num${ehHoje?" cal-hoje-num":""}">${cur.getDate()}</span>
          ${aulas.length ? `<span class="cal-dia-count">${aulas.length}</span>` : ""}
        </div>
        <div class="cal-dia-chips">
          ${aulas.slice(0,MAX).map(a=>_calChipMes(a)).join("")}
          ${aulas.length>MAX?`<div class="cal-mais-link">+${aulas.length-MAX} mais</div>`:""}
        </div>
      </div>`;
      cur.setDate(cur.getDate() + 1);
    }
  }
  html += `</div></div>`;
  document.getElementById("cal-corpo").innerHTML = html;
}

// ── Número da semana ISO ──────────────────────────────────────
function _isoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia  = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dia);
  const ano1 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - ano1) / 86400000) + 1) / 7);
}

// ════════════════════════════════════════════════════════════
//  VISÃO SEMANA
// ════════════════════════════════════════════════════════════
function _calRenderSemana() {
  const inicio = new Date(calDataRef);
  inicio.setDate(calDataRef.getDate() - calDataRef.getDay());

  const dias = Array.from({length:7}, (_,i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });

  const m0 = dias[0].getMonth(), m6 = dias[6].getMonth(), y = dias[0].getFullYear();
  const semNum = _isoWeek(dias[1]);
  document.getElementById("cal-label").textContent =
    m0===m6 ? `${_CAL_MESES[m0]} ${y}` : `${_CAL_MESES_AB[m0]} – ${_CAL_MESES_AB[m6]} ${y}`;

  const hojeIso = hoje();

  const periodosSet = new Set();
  dias.forEach(d => calAulasNoDia(calIso(d)).forEach(a => periodosSet.add(a.slot.aula || "eventual")));

  const periodosOrdenados = (RT_PERIODOS || [])
    .filter(p => periodosSet.has(p.aula))
    .sort((a,b) => a.inicio.localeCompare(b.inicio));
  if (periodosSet.has("eventual"))
    periodosOrdenados.push({ aula:"eventual", label:"Eventual", inicio:"", fim:"" });

  let html = `<div class="cal-semana">
    <div class="cal-sem-cabec">
      <div class="cal-sem-col-periodo cal-sem-corner">
        <span class="cal-sem-week-num">sem.<br>${semNum}</span>
      </div>
      ${dias.map(d => {
        const iso = calIso(d), eh = iso === hojeIso;
        return `<div class="cal-sem-col-dia${eh?" cal-col-hoje":""}">
          <span class="cal-sem-dow">${_CAL_DIAS[d.getDay()]}</span>
          <span class="cal-sem-dn${eh?" cal-hoje-num":""}"
                onclick="calIrDia('${iso}')">${d.getDate()}</span>
        </div>`;
      }).join("")}
    </div>`;

  if (periodosOrdenados.length === 0) {
    html += `<div class="cal-sem-vazio">Nenhuma aula prevista nesta semana.</div>`;
  } else {
    html += `<div class="cal-sem-corpo">`;
    for (const per of periodosOrdenados) {
      html += `<div class="cal-sem-linha">
        <div class="cal-sem-col-periodo">
          <span class="cal-sem-per-nome">${per.label}</span>
          ${per.inicio?`<span class="cal-sem-per-hora">${per.inicio}${per.fim?"–"+per.fim:""}</span>`:""}
        </div>`;
      for (const d of dias) {
        const iso   = calIso(d), eh = iso === hojeIso;
        const aulas = calAulasNoDia(iso).filter(a => (a.slot.aula||"eventual") === per.aula);
        const dow = _CAL_DIAS[d.getDay()];
        const dn  = d.getDate();
        html += `<div class="cal-sem-cel${eh?" cal-col-hoje":""}" data-dow="${dow}" data-dn="${dn}">
          ${aulas.map(a => _calCardSem(a)).join("")}
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  document.getElementById("cal-corpo").innerHTML = html;
}

// ════════════════════════════════════════════════════════════
//  VISÃO DIA
// ════════════════════════════════════════════════════════════
function _calRenderDia() {
  const iso     = calIso(calDataRef);
  const [y,m,d] = iso.split("-").map(Number);
  const dt      = new Date(y, m-1, d);
  const ehHoje  = iso === hoje();

  document.getElementById("cal-label").textContent =
    `${_CAL_DIAS[dt.getDay()]}, ${d} de ${_CAL_MESES[m-1]} de ${y}`;

  const aulas = calAulasNoDia(iso);

  if (aulas.length === 0) {
    document.getElementById("cal-corpo").innerHTML = `
      <div class="cal-dia-vazio">
        <span class="cal-dia-vazio-ico">📭</span>
        <p>Nenhuma aula prevista para ${ehHoje?"hoje":"este dia"}.</p>
      </div>`;
    return;
  }

  const grupos = new Map();
  for (const item of aulas) {
    const key = item.slot.aula || "eventual";
    if (!grupos.has(key)) grupos.set(key, {
      label: item.slot.label || key,
      inicio: item.slot.inicio || "",
      fim:    item.slot.fim    || "",
      itens:  []
    });
    grupos.get(key).itens.push(item);
  }

  const nAd  = aulas.filter(a => a.est.feita).length;
  const nCh  = aulas.filter(a => a.est.chamada).length;
  const nReg = aulas.filter(a => a.est.conteudoEntregue).length;

  let html = `<div class="cal-dia${ehHoje?" cal-dia-hoje":""}">
    <div class="cal-dia-resumo">
      <span class="cdr-item"><span class="cdr-num">${aulas.length}</span> aulas no dia</span>
      <span class="cdr-sep">·</span>
      <span class="cdr-item cdr-ad"><span  class="cdr-num">${nAd}</span> AD</span>
      <span class="cdr-sep">·</span>
      <span class="cdr-item cdr-ch"><span  class="cdr-num">${nCh}</span> CH</span>
      <span class="cdr-sep">·</span>
      <span class="cdr-item cdr-reg"><span class="cdr-num">${nReg}</span> RE</span>
    </div>`;

  for (const [, grupo] of grupos) {
    html += `<div class="cal-dia-bloco">
      <div class="cal-dia-bloco-header">
        <span class="cdb-nome">${grupo.label}</span>
        ${grupo.inicio?`<span class="cdb-hora">${grupo.inicio}${grupo.fim?" – "+grupo.fim:""}</span>`:""}
        <span class="cdb-n">${grupo.itens.length} turma${grupo.itens.length>1?"s":""}</span>
      </div>
      <div class="cal-dia-cards">
        ${grupo.itens.map(item => _calCardDia(item)).join("")}
      </div>
    </div>`;
  }
  html += `</div>`;
  document.getElementById("cal-corpo").innerHTML = html;
}

// ── Home mobile: exibe visão dia (tela inicial no celular) ─────
function renderizarHomeMobile() {
  abrirCalendario();
}
