// CHAMADA.JS — Sistema de chamadas e frequência
// Dependências: globals.js, db.js, auth.js

const _SITS_INATIVAS = ["AB","TR","RM","RC","NC"];  // EV removido — recebe chamada automática
const _SITS_SEMPRE_C  = ["EE"];
const _SITS_SEMPRE_F  = ["EV"];

// ── Filtro de situação ─────────────────────────────────────────────────────
// null = Ativos (matriculados ativos: exceto TR,AB,NC,RM,EV)
// ""   = TODOS (sem exceção)
// "AB","TR",… = apenas essa situação
let _chamadaFiltroSit   = "";  // "" = TODOS por padrão
let _chamadaOcultarInativos = false; // legado — substituído pelo filtro

// ── Debounce Firestore ─────────────────────────────────────────────────────
// Cada C/F atualiza RT_CHAMADAS em memória e o DOM imediatamente.
// O Firestore recebe um único write depois de 3 s de inatividade.
const _chamadaSaveTimers = {};  // por turmaKey

function _agendarSaveChamadas(turmaKey) {
  clearTimeout(_chamadaSaveTimers[turmaKey]);
  _chamadaSaveTimers[turmaKey] = setTimeout(() => _salvarChamadas(turmaKey), 3000);
  _mostrarIndicadorSync("💾 Chamada gravada localmente");
}

window.addEventListener("beforeunload", () => {
  for (const key of Object.keys(_chamadaSaveTimers)) {
    clearTimeout(_chamadaSaveTimers[key]);
    _salvarChamadas(key);
  }
});

let RT_CHAMADAS = {};

async function _carregarChamadas(turmaKey) {
  if (RT_CHAMADAS[turmaKey]) return RT_CHAMADAS[turmaKey];
  if (!_DEV) {
    try {
      const snap = await firebase.firestore()
        .collection("chamadas").doc(turmaKey).get();
      if (snap.exists) {
        RT_CHAMADAS[turmaKey] = snap.data().registros || {};
        return RT_CHAMADAS[turmaKey];
      }
    } catch(e) { console.warn("Erro ao carregar chamadas:", e); }
  }
  RT_CHAMADAS[turmaKey] = {};
  return RT_CHAMADAS[turmaKey];
}

async function _salvarChamadas(turmaKey) {
  if (_DEV) { console.log("[DEV] _salvarChamadas — apenas memória"); return; }
  try {
    await firebase.firestore().collection("chamadas").doc(turmaKey)
      .set({ registros: RT_CHAMADAS[turmaKey], _atualizado: new Date().toISOString() },
           { merge: true });
    _mostrarIndicadorSync("✓ Chamada salva");
  } catch(e) {
    console.warn("Erro ao salvar chamadas:", e);
    _mostrarIndicadorSync("⚠ Erro ao salvar chamada");
  }
}

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último passado)
let _dataChamadaSel     = null;
// Bimestre selecionado na aba de chamada (independente do bimestreAtivo do cronograma)
let _bimestreChamadaSel = null;
// Mês filtrado na chamada ("YYYY-MM" ou null = todos)
let _mesChamadaSel      = null;

function _diasDeAulaNoBimestre(turmaId, bim) {
  // Retorna datas únicas (para seletor de data e cálculo de TF)
  const slots = getSlotsCompletos(turmaId, bim).filter(s => !s.eventual);
  return [...new Set(slots.map(s => s.data))].sort();
}

function _slotsDeAulaNoBimestre(turmaId, bim) {
  // Retorna todos os slots (um por aula, incluindo dias com 2 aulas)
  return getSlotsCompletos(turmaId, bim)
    .filter(s => !s.eventual)
    .map(s => ({ data: s.data, aula: s.aula, slotId: s.slotId, inicio: s.inicio }));
}

// Chave única por slot (data + aula)
function _chaveSlotChamada(data, aula) { return aula ? `${data}_${aula}` : data; }

// Retorna true se o aluno deve receber chamada numa data específica.
function _alunoAtivoNaData(aluno, data) {
  if (!_SITS_INATIVAS.includes(aluno.situacao)) return true;
  if (!aluno.situacaoData) return false;
  return data < aluno.situacaoData;
}

async function _renderizarChamadaDesktop() {
  const t     = turmaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-chamada");
  if (!secao) return;

  const turmaKey = t.serie + t.turma;
  const alunos   = await _carregarAlunos(turmaKey);
  const chamadas = await _carregarChamadas(turmaKey);
  const hoje_str = hoje();

  if (!_bimestreChamadaSel) _bimestreChamadaSel = bimestreAtivo;
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === _bimestreChamadaSel) || RT_BIMESTRES[0];

  // Todos os slots do bimestre (um por aula — dias com 2 aulas aparecem 2x)
  const todosSlots = _slotsDeAulaNoBimestre(t.id, _bimestreChamadaSel)
    .filter(s => s.data >= bimObj.inicio && s.data <= bimObj.fim);

  // Datas únicas para seletor de lote e cálculo de TF
  const todasDatas = _diasDeAulaNoBimestre(t.id, _bimestreChamadaSel)
    .filter(d => d >= bimObj.inicio && d <= bimObj.fim);

  const datasPassadas = todasDatas.filter(d => d <= hoje_str);
  const slotsPassados  = todosSlots.filter(s => s.data <= hoje_str);

  if (!_dataChamadaSel || !todasDatas.includes(_dataChamadaSel)) {
    _dataChamadaSel = todasDatas.includes(hoje_str)
      ? hoje_str
      : [...datasPassadas].reverse()[0] || todasDatas[0] || hoje_str;
  }

  // Slots visíveis: filtrados por mês se houver filtro ativo
  const slotsVisiveis = _mesChamadaSel
    ? todosSlots.filter(s => s.data.startsWith(_mesChamadaSel))
    : todosSlots;

  // ── Meses únicos do bimestre (para filtro) ──
  const todosMeses = [];
  for (const d of todasDatas) {
    const [ano, mes] = d.split("-");
    const chave = `${ano}-${mes}`;
    if (!todosMeses.find(m => m.chave === chave)) {
      const label = NOMES_MES[+mes - 1].charAt(0).toUpperCase()
        + NOMES_MES[+mes - 1].slice(1) + "/" + ano;
      todosMeses.push({ chave, label });
    }
  }

  // ── Cabeçalho linha 1: meses com colspan (agrupando slots) ──
  const gruposMes = [];
  for (const s of slotsVisiveis) {
    const [ano, mes] = s.data.split("-");
    const chave = `${ano}-${mes}`;
    const label = NOMES_MES[+mes - 1].charAt(0).toUpperCase()
      + NOMES_MES[+mes - 1].slice(1) + "/" + ano;
    if (!gruposMes.length || gruposMes[gruposMes.length - 1].chave !== chave) {
      gruposMes.push({ chave, label, count: 1 });
    } else {
      gruposMes[gruposMes.length - 1].count++;
    }
  }

  const thMeses = gruposMes.map(m => {
    const ativo   = _mesChamadaSel === m.chave;
    const onclick = ativo
      ? `_mesChamadaSel=null;renderizarChamadaFrequencia()`
      : `_mesChamadaSel='${m.chave}';renderizarChamadaFrequencia()`;
    return `<th colspan="${m.count}" class="th-mes-chamada">
      <button type="button" class="btn-mes-chamada${ativo ? " ativo" : ""}"
        onclick="${onclick}"
        title="${ativo ? "Ver todos os meses" : "Filtrar este mês"}">
        ${m.label}${ativo ? " ×" : ""}
      </button>
    </th>`;
  }).join("");

  // ── Cabeçalho linha 2: número do dia por slot (2 aulas no mesmo dia = 2 colunas) ──
  const thDias = slotsVisiveis.map(s => {
    const isSel  = s.data === _dataChamadaSel;
    const isPast = s.data <= hoje_str;
    const dia    = s.data.split("-")[2];
    const title  = s.inicio ? `${dia} · ${s.inicio}` : dia;
    return `<th class="th-data-chamada${isSel ? " th-data-sel" : ""}" title="${title}">
      <span class="th-dia-num">${dia}</span>
      ${isPast ? `<div class="th-dia-popover">
        <button type="button" class="btn-lote"
          onclick="chamadaTodosData('${turmaKey}','${s.data}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off"
          onclick="chamadaTodosData('${turmaKey}','${s.data}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  // ── Contagem e legenda de situações ──
  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não comparecimento",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado",
    "EE":"Educação Especial","EV":"Evadido"
  };

  // Filtro:
  //   null → Ativos (exclui TR, AB, NC, RM, EV)
  //   ""   → TODOS (sem exceção)
  //   "AB", "TR", … → apenas essa situação
  const _SITS_INAT_FILT = ["AB","NC","TR","RM","RC"];  // Ativos: exceto TR,AB,NC,RM,RC
  const contsSit = {
    total:  alunos.length,
    ativos: alunos.filter(a => !_SITS_INAT_FILT.includes(a.situacao)).length,
    AB: alunos.filter(a => a.situacao==="AB").length,
    NC: alunos.filter(a => a.situacao==="NC").length,
    TR: alunos.filter(a => a.situacao==="TR").length,
    RM: alunos.filter(a => a.situacao==="RM").length,
    RC: alunos.filter(a => a.situacao==="RC").length,
    EE: alunos.filter(a => a.situacao==="EE").length,
    EV: alunos.filter(a => a.situacao==="EV").length,
  };

  const _mkSit = (cls, sigla, desc, n, filtroAtual) => {
    if (n === 0) return "";
    const ativo = filtroAtual === sigla;
    const clearOrSet = sigla === null ? "null" : sigla === "" ? "''" : `'${sigla}'`;
    const toggle = ativo ? "null" : clearOrSet;
    return `<span class="sit-item${ativo ? " sit-item-ativo" : ""}"
      onclick="_chamadaFiltroSit=${toggle};renderizarChamadaFrequencia()"
      style="cursor:pointer" title="${ativo ? "Remover filtro" : "Filtrar: " + desc}">
      <span class="badge-situacao badge-sit-${cls}">${sigla ?? "✓"}</span>
      <span class="sit-desc">${desc} (${n})</span>
    </span>`;
  };

  const f = _chamadaFiltroSit;
  const legendaHtmlCham = `<div class="sit-legenda">
      <span class="sit-legenda-titulo">Situação:</span>
      ${_mkSit("ok", null,  "Ativos",          contsSit.ativos, f)}
      ${_mkSit("ok", "",    "TODOS",            contsSit.total,  f)}
      ${_mkSit("ab", "AB",  "Abandonou",        contsSit.AB,     f)}
      ${_mkSit("nc", "NC",  "Não comparecimento",contsSit.NC,    f)}
      ${_mkSit("tr", "TR",  "Transferido",      contsSit.TR,     f)}
      ${_mkSit("rm", "RM",  "Remanejado",       contsSit.RM,     f)}
      ${_mkSit("rc", "RC",  "Reclassificado",   contsSit.RC,     f)}
      ${_mkSit("ee", "EE",  "Ed. Especial",     contsSit.EE,     f)}
      ${_mkSit("ev", "EV",  "Evadido",          contsSit.EV,     f)}
      ${f !== null ? `<button class="btn-toggle-inativos" style="padding:2px 8px;font-size:.7rem"
          onclick="_chamadaFiltroSit=null;renderizarChamadaFrequencia()">✕ limpar</button>` : ""}
    </div>`;

  const alunosFiltrados = (() => {
    if (_chamadaFiltroSit === null)
      return alunos.filter(a => !_SITS_INAT_FILT.includes(a.situacao));
    if (_chamadaFiltroSit === "")
      return alunos;
    return alunos.filter(a => a.situacao === _chamadaFiltroSit);
  })();

  // ── Resumo TF / TC / %F por coluna ──
  const _resumo = slotsVisiveis.map(s => {
    if (s.data > hoje_str) return { tf: null, tc: null };
    const sk = _chaveSlotChamada(s.data, s.aula);
    let tf = 0, tc = 0;
    for (const a of alunosFiltrados) {
      if (!_alunoAtivoNaData(a, s.data)) continue;
      const _ee = a.situacao === "EE", _ev = a.situacao === "EV";
      let v;
      if (_ee) v = "C";
      else if (_ev) v = "F";
      else v = (chamadas[sk]||{})[a.num] ?? (chamadas[s.data]||{})[a.num] ?? "C";
      if (v === "F") tf++; else tc++;
    }
    return { tf, tc };
  });
  const _tdR = (v, cor) => `<td style="text-align:center;font-size:.7rem;font-weight:700;color:${cor};padding:2px 0">${v}</td>`;
  const trTF  = `<tr class="tr-resumo-chamada"><td colspan="3" class="td-resumo-label">TF</td>${_resumo.map(r=>r.tf===null?`<td></td>`:_tdR(r.tf,r.tf>0?"#f87171":"#475569")).join("")}<td colspan="2"></td></tr>`;
  const trTC  = `<tr class="tr-resumo-chamada"><td colspan="3" class="td-resumo-label">TC</td>${_resumo.map(r=>r.tc===null?`<td></td>`:_tdR(r.tc,r.tc>0?"#4ade80":"#475569")).join("")}<td colspan="2"></td></tr>`;
  const trPct = `<tr class="tr-resumo-chamada"><td colspan="3" class="td-resumo-label">%F</td>${_resumo.map(r=>{
    if(r.tf===null)return`<td></td>`;
    const tot=r.tf+r.tc,pct=tot>0?Math.round(r.tf/tot*100):0;
    return _tdR(pct+"%",pct>20?"#f87171":"#475569");
  }).join("")}<td colspan="2"></td></tr>`;

  const rows = alunosFiltrados.map(a => {
    // TF e %F calculados sobre todas as datas passadas do bimestre
    let totalAulas  = 0;
    let totalFaltas = 0;
    const isEE = a.situacao === "EE";
    const isEV = a.situacao === "EV";
    for (const d of datasPassadas) {
      if (!_alunoAtivoNaData(a, d)) continue;
      totalAulas++;
      // Registro explícito prevalece sobre auto-fill
      const explicit = (chamadas[d] || {})[a.num];
      if (explicit !== undefined) {
        if (explicit === "F") totalFaltas++;
      } else {
        // Auto-fill: EV=F, EE=C, demais=C (default)
        if (isEV) totalFaltas++;
      }
    }

    const tds = slotsVisiveis.map(s => {
      const d      = s.data;
      const isPast = d <= hoje_str;
      const ativo  = _alunoAtivoNaData(a, d);

      if (!ativo) {
        return `<td style="text-align:center;color:var(--text-muted);font-size:.7rem">—</td>`;
      }

      const slotKey = _chaveSlotChamada(d, s.aula);
      // Registro explícito prevalece; fallback = auto-fill (EE→C, EV→F, demais→C se passado)
      const explicit = (chamadas[slotKey]||{})[a.num] ?? (chamadas[d]||{})[a.num];
      let val;
      if (explicit !== undefined) val = explicit;
      else if (isEE) val = "C";
      else if (isEV) val = "F";
      else val = isPast ? "C" : "";
      if (!val) return `<td></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      const btnId = `cf-${turmaKey}-${a.num}-${slotKey}`;
      const autoHint = isEE ? " title='Ed. Especial (auto C)'" : isEV ? " title='Evadido (auto F)'" : "";
      return `<td style="text-align:center">
        <button type="button" id="${btnId}" class="btn-cf ${cls}"${autoHint}
          onclick="toggleChamadaSlot('${turmaKey}','${slotKey}','${d}',${a.num},this)"
        >${val}</button>
      </td>`;
    }).join("");

    const pctFaltas = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0;
    const altaFalta = pctFaltas > 20;

    const sitLabel    = a.situacao ? a.situacao : "✓";
    const sitClass    = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";
    const sitTitle    = SITUACAO_LABEL[a.situacao || ""] || "";
    const sitDataHint = (a.situacao && a.situacaoData) ? ` · ${fmtData(a.situacaoData)}` : "";
    const tdSit = `<td style="text-align:center">
      <span class="badge-situacao ${sitClass}" title="${sitTitle}${sitDataHint}">${sitLabel}</span>
    </td>`;

    const tdTF  = `<td class="td-freq-total"
      title="${totalFaltas} falta(s) em ${totalAulas} aula(s)">${totalFaltas}</td>`;
    const tdPct = `<td class="td-freq-pct ${altaFalta ? "freq-critica" : ""}"
      title="${pctFaltas.toFixed(1)}%">${totalAulas > 0 ? pctFaltas.toFixed(0)+"%" : "—"}</td>`;

    return `<tr class="${altaFalta ? "row-alta-falta" : ""}">
      <td class="td-numero">${a.num}</td>
      <td class="td-nome" style="font-size:.82rem;white-space:nowrap">${a.nome||"—"}</td>
      ${tdSit}
      ${tds}
      ${tdTF}
      ${tdPct}
    </tr>`;
  }).join("");

  // Seletor de data para marcar em lote (só datas passadas)
  const datasOpts = datasPassadas.map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  // Contagem de aulas dadas no bimestre (para barra de progresso)
  let _feitasCham = 0, _totalRegCham = 0;
  for (const s of getSlotsCompletos(turmaAtiva.id, _bimestreChamadaSel).filter(s=>!s.eventual)) {
    _totalRegCham++;
    if (estadoAulas[chaveSlot(turmaAtiva.id, _bimestreChamadaSel, s.slotId)]?.feita) _feitasCham++;
  }
  const _pctCham = _totalRegCham > 0 ? Math.round(_feitasCham/_totalRegCham*100) : 0;
  const _corCham = _pctCham===100 ? "#4ade80" : _pctCham>50 ? "var(--amber)" : "var(--teal,#0d9488)";
  const _bimProgBarChamada = (f, r, bimObj) => `
    <div class="bim-prog-wrap" id="bim-prog-wrap" style="margin-bottom:4px">
      <div class="bim-prog-info">
        <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
        <span class="bim-prog-frac">${f}/${r} aulas dadas · ${r>0?Math.round(f/r*100):0}%</span>
      </div>
      <div class="bim-prog-bar-bg">
        <div class="bim-prog-bar-fill" style="width:${r>0?Math.round(f/r*100):0}%;background:${_corCham}"></div>
      </div>
    </div>`;

  // Abas de bimestre (ao trocar, limpa filtro de mês também)
  const tabsBimChamada = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimestre === _bimestreChamadaSel ? "ativo" : ""}"
      onclick="_bimestreChamadaSel=${b.bimestre};_dataChamadaSel=null;_mesChamadaSel=null;renderizarChamadaFrequencia()">${b.label}</button>`
  ).join("");

  // Botões de filtro por mês (só aparece quando o bimestre tem mais de um mês)
  const filtroMeses = todosMeses.length > 1 ? `
    <div class="filtro-meses-chamada">
      <span style="font-size:.75rem;color:var(--text-muted)">Mês:</span>
      ${todosMeses.map(m => `
        <button type="button" class="btn-mes-filtro${_mesChamadaSel===m.chave?" ativo":""}"
          onclick="_mesChamadaSel=${_mesChamadaSel===m.chave?"null":"'"+m.chave+"'"};renderizarChamadaFrequencia()">
          ${m.label}
        </button>`).join("")}
      ${_mesChamadaSel
        ? `<button type="button" class="btn-mes-filtro"
            onclick="_mesChamadaSel=null;renderizarChamadaFrequencia()">✕ Todos</button>`
        : ""}
    </div>` : "";

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header" style="flex-wrap:wrap;gap:8px">
        <h3>Chamada — ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label style="font-size:.8rem">Marcar data:
            <select class="gi gi-sm" onchange="_dataChamadaSel=this.value;renderizarChamadaFrequencia()">
              ${datasOpts}
            </select>
          </label>
          <button type="button" class="btn-add"
            onclick="chamadaTodosData('${turmaKey}','${_dataChamadaSel}','C')">✓ Todos C</button>
          <button type="button" class="btn-add" style="background:var(--text-muted)"
            onclick="chamadaTodosData('${turmaKey}','${_dataChamadaSel}','F')">✗ Todos F</button>
          <button type="button" class="btn-toggle-inativos"
            onclick="_chamadaFiltroSit=_chamadaFiltroSit===null?'':null;renderizarChamadaFrequencia()">
            ${_chamadaFiltroSit === "" ? "👁 Ocultar inativos" : "👁 Ver todos"}
          </button>
        </div>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:4px">${tabsBimChamada}</div>
      ${_bimProgBarChamada(_feitasCham, _totalRegCham, bimObj)}
      ${filtroMeses}
      ${legendaHtmlCham}
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-chamada" style="min-width:0">
          <colgroup>
            <col class="col-num">
            <col class="col-nome" style="width:180px">
            <col class="col-sit">
            ${slotsVisiveis.map(() => `<col style="width:36px">`).join("")}
            <col class="col-freq">
            <col class="col-freq">
          </colgroup>
          <thead>
            <tr>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              <th rowspan="2" style="width:48px;text-align:center" title="Situação">Sit.</th>
              ${thMeses}
              <th rowspan="2" class="th-freq" title="Total de faltas no bimestre">TF</th>
              <th rowspan="2" class="th-freq" title="% de faltas — limite: 20%">%F</th>
            </tr>
            <tr>
              ${thDias}
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
          <tfoot>${trTF}${trTC}${trPct}</tfoot>
        </table>
      </div>
    </div>`;
}

// Atualiza TF e %F de uma linha no DOM sem re-renderizar a tabela
function _atualizarFreqLinha(turmaKey, numAluno, chamadas, alunos) {
  const t = turmaAtiva;
  if (!t) return;
  const bim = _bimestreChamadaSel || bimestreAtivo;
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bim) || RT_BIMESTRES[0];
  const hoje_str = hoje();
  const datasPassadas = _diasDeAulaNoBimestre(t.id, bim)
    .filter(d => d >= bimObj.inicio && d <= bimObj.fim && d <= hoje_str);
  const aluno = alunos.find(a => String(a.num) === String(numAluno));
  if (!aluno) return;
  const isEE = aluno.situacao === "EE";
  const isEV = aluno.situacao === "EV";
  let totalAulas = 0, totalFaltas = 0;
  for (const d of datasPassadas) {
    if (!_alunoAtivoNaData(aluno, d)) continue;
    totalAulas++;
    const explicit = (chamadas[d] || {})[aluno.num];
    if (explicit !== undefined) { if (explicit === "F") totalFaltas++; }
    else if (isEV) totalFaltas++;
  }
  // Find TF and %F cells by searching all tds in the row
  // Rows don't have stable ids; find via the first btn-cf in the row
  const anyBtn = document.querySelector(`[id^="cf-${turmaKey}-${numAluno}-"]`);
  if (!anyBtn) return;
  const row = anyBtn.closest("tr");
  if (!row) return;
  const tds = row.querySelectorAll("td");
  const lastTds = [...tds].slice(-2);
  const pct = totalAulas > 0 ? (totalFaltas / totalAulas * 100) : 0;
  if (lastTds[0]) {
    lastTds[0].textContent = totalFaltas;
    lastTds[0].title = `${totalFaltas} falta(s) em ${totalAulas} aula(s)`;
  }
  if (lastTds[1]) {
    lastTds[1].textContent = totalAulas > 0 ? pct.toFixed(0) + "%" : "—";
    lastTds[1].className = `td-freq-pct${pct > 20 ? " freq-critica" : ""}`;
    lastTds[1].title = pct.toFixed(1) + "%";
  }
  row.className = pct > 20 ? "row-alta-falta" : "";
}

async function toggleChamada(turmaKey, data, numAluno) {
  // Compatibilidade — usa slotKey = data (sem aula)
  return toggleChamadaSlot(turmaKey, data, data, numAluno);
}

async function toggleChamadaSlot(turmaKey, slotKey, data, numAluno, btnEl) {
  const [chamadas, alunos] = await Promise.all([
    _carregarChamadas(turmaKey),
    _carregarAlunos(turmaKey),
  ]);
  const aluno = alunos.find(a => a.num === numAluno || String(a.num) === String(numAluno));
  if (!aluno) return;
  if (!chamadas[slotKey]) chamadas[slotKey] = {};
  const novo = (chamadas[slotKey][numAluno] === "F") ? "C" : "F";
  chamadas[slotKey][numAluno] = novo;
  // Atualiza DOM imediatamente — sem re-render
  if (btnEl) {
    btnEl.textContent = novo;
    btnEl.className = `btn-cf ${novo === "F" ? "chk-falta" : "chk-comp"}`;
  }
  // Atualiza totais TF/%F da linha (se existirem no DOM)
  _atualizarFreqLinha(turmaKey, numAluno, chamadas, alunos);
  // Firestore com debounce 3 s
  _agendarSaveChamadas(turmaKey);
}

async function chamadaTodosData(turmaKey, data, valor) {
  const [alunos, chamadas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarChamadas(turmaKey),
  ]);
  if (!chamadas[data]) chamadas[data] = {};
  for (const a of alunos) {
    if (_alunoAtivoNaData(a, data)) {
      chamadas[data][a.num] = (a.situacao === "EE") ? "C" : (a.situacao === "EV") ? "F" : valor;
    }
  }
  // Re-render uma única vez após aplicar lote
  renderizarChamadaFrequencia();
  _agendarSaveChamadas(turmaKey);
}


// ── Visão detalhada ──────────────────────────────────────────

// ── Chamada Mobile — exibe apenas o dia atual ─────────────────

async function renderizarChamadaFrequencia() {
  // Redireciona para mobile se tela estreita e aba mobile ativa
  if (window.innerWidth <= 860 && window._abaCronograma === "chamada_mobile") {
    return _renderizarChamadaMobile();
  }
  return _renderizarChamadaDesktop();
}

async function _renderizarChamadaMobile() {
  const t = turmaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-chamada");
  if (!secao) return;

  const turmaKey = t.serie + t.turma;
  const [alunos, chamadas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarChamadas(turmaKey),
  ]);

  if (!_bimestreChamadaSel) _bimestreChamadaSel = bimestreAtivo;
  const hoje_str = hoje();

  // Data do dia — se não for dia de aula, mostra aviso
  const datas = _diasDeAulaNoBimestre(t.id, _bimestreChamadaSel);
  const dataAtual = datas.includes(hoje_str) ? hoje_str
    : [...datas].reverse().find(d => d <= hoje_str) || datas[0] || hoje_str;

  if (!_dataChamadaSel) _dataChamadaSel = dataAtual;

  const alunosAtivos = alunos.filter(a => _alunoAtivoNaData(a, _dataChamadaSel));

  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não comparecimento",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado",
    "EE":"Educação Especial","EV":"Evadido"
  };

  const rows = alunosAtivos.map(a => {
    const isEE  = a.situacao === "EE";
    const isEV2 = a.situacao === "EV";
    const explicit = (chamadas[_dataChamadaSel] || {})[a.num];
    const val = explicit !== undefined ? explicit : (isEE ? "C" : isEV2 ? "F" : "C");
    const cls   = val === "F" ? "chk-falta" : "chk-comp";
    const sitLabel = a.situacao ? a.situacao : "";
    const sitClass = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "";
    return `<tr>
      <td class="td-numero">${a.num}</td>
      <td style="font-size:.9rem">${a.nome||"—"}
        ${sitLabel ? `<span class="badge-situacao ${sitClass}" style="margin-left:4px;font-size:.65rem">${sitLabel}</span>` : ""}
      </td>
      <td style="text-align:center;width:64px">
        <button type="button" class="btn-cf-mob ${cls}"
          onclick="toggleChamadaMobile('${turmaKey}','${_dataChamadaSel}',${a.num},this)">
          ${val}
        </button>
      </td>
    </tr>`;
  }).join("");

  const datasOpts = datas.filter(d => d <= hoje_str).reverse().map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  secao.innerHTML = `
    <div class="chamada-mobile-wrap">
      <div class="chamada-mobile-header">
        <label style="font-size:.85rem;font-weight:600">
          📅 Data da chamada:
          <select class="gi gi-sm" style="margin-left:6px"
            onchange="_dataChamadaSel=this.value;_renderizarChamadaMobile()">
            ${datasOpts}
          </select>
        </label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button type="button" class="btn-add"
            onclick="chamadaTodosData('${turmaKey}','${_dataChamadaSel}','C')">✓ Todos C</button>
          <button type="button" class="btn-add" style="background:var(--text-muted)"
            onclick="chamadaTodosData('${turmaKey}','${_dataChamadaSel}','F')">✗ Todos F</button>
          <button type="button" class="btn-toggle-inativos"
            onclick="_chamadaFiltroSit=_chamadaFiltroSit===null?'':null;renderizarChamadaFrequencia()">
            ${_chamadaFiltroSit === "" ? "👁 Ocultar inativos" : "👁 Ver todos"}
          </button>
        </div>
      </div>
      <table class="tabela-gestao chamada-mob-tabela">
        <thead><tr>
          <th style="width:36px">Nº</th>
          <th>Nome</th>
          <th style="width:64px;text-align:center">C / F</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="td-vazio">Nenhum aluno ativo.</td></tr>'}</tbody>
      </table>
    </div>`;
}

async function toggleChamadaMobile(turmaKey, data, numAluno, btnEl) {
  const chamadas = await _carregarChamadas(turmaKey);
  if (!chamadas[data]) chamadas[data] = {};
  const novo = chamadas[data][numAluno] === "F" ? "C" : "F";
  chamadas[data][numAluno] = novo;
  // Atualiza só o botão — sem re-render
  btnEl.textContent = novo;
  btnEl.className = `btn-cf-mob ${novo === "F" ? "chk-falta" : "chk-comp"}`;
  await _salvarChamadas(turmaKey);
}
