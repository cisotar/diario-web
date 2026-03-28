// CHAMADA.JS — Sistema de chamadas e frequência
// Dependências: globals.js, db.js, auth.js

const _SITS_INATIVAS = ["AB","TR","RM","RC","NC"];
const _SITS_SEMPRE_C  = ["EE"];  // Educação Especial — presença sempre C, nunca F

// ── Oferta de cópia de chamada ────────────────────────────────────────────────
// true  = modal aparece SEMPRE que a chamada for aberta
// false = modal aparece apenas quando a chamada do professor estiver vazia para hoje
const _CHAMADA_OFERTA_SEMPRE = false;

let RT_CHAMADAS = {};

// ── Chamada por professor — doc: chamadas/{turmaKey}_{uid} ────────────────────
function _chamadaDocId(turmaKey) {
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  return `${turmaKey}_${uid}`;
}

async function _carregarChamadas(turmaKey) {
  const docId = _chamadaDocId(turmaKey);
  if (RT_CHAMADAS[docId]) return RT_CHAMADAS[docId];
  if (!_DEV) {
    try {
      const snap = await firebase.firestore()
        .collection("chamadas").doc(docId).get();
      if (snap.exists) {
        RT_CHAMADAS[docId] = snap.data().registros || {};
        return RT_CHAMADAS[docId];
      }
    } catch(e) { console.warn("Erro ao carregar chamadas:", e); }
  }
  RT_CHAMADAS[docId] = {};
  return RT_CHAMADAS[docId];
}

async function _salvarChamadas(turmaKey) {
  const docId = _chamadaDocId(turmaKey);
  if (_DEV) { console.log("[DEV] _salvarChamadas — apenas memória"); return; }
  try {
    const uid  = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
    const nome = _userAtual?.displayName || _userAtual?.email || uid;
    await firebase.firestore().collection("chamadas").doc(docId)
      .set({
        registros: RT_CHAMADAS[docId],
        turmaKey,
        profUid:  uid,
        profNome: nome,
        _atualizado: new Date().toISOString()
      }, { merge: true });
    _mostrarIndicadorSync("✓ Chamada salva");
  } catch(e) {
    console.warn("Erro ao salvar chamadas:", e);
    _mostrarIndicadorSync("⚠ Erro ao salvar chamada");
  }
}

// Carrega chamada de outro professor pelo docId
async function _carregarChamadaDeOutro(docId) {
  try {
    const snap = await firebase.firestore().collection("chamadas").doc(docId).get();
    if (snap.exists) return snap.data().registros || {};
  } catch(e) { console.warn("Erro ao carregar chamada de outro prof:", e); }
  return null;
}

// Busca professores que já fizeram chamada hoje nesta turma (exceto o atual)
// Estratégia: busca todos os professores aprovados, constrói os docIds e lê cada um
async function _buscarChamadasHoje(turmaKey) {
  const hoje_str = hoje();
  const uid_atual = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  const resultado = [];
  try {
    // Busca lista de professores aprovados
    const profsSnap = await firebase.firestore()
      .collection("professores")
      .where("status", "==", "aprovado")
      .get();

    const leituras = profsSnap.docs
      .filter(d => d.id !== uid_atual)
      .map(async d => {
        const docId = `${turmaKey}_${d.id}`;
        try {
          const snap = await firebase.firestore().collection("chamadas").doc(docId).get();
          if (!snap.exists) return null;
          const data = snap.data();
          const temHoje = Object.keys(data.registros || {}).some(
            k => k === hoje_str || k.startsWith(hoje_str + "_")
          );
          if (!temHoje) return null;
          return {
            docId,
            profUid:  d.id,
            profNome: d.data().nome || d.data().email || d.id,
            registros: data.registros
          };
        } catch(e) { return null; }
      });

    const resultados = await Promise.all(leituras);
    resultado.push(...resultados.filter(Boolean));
  } catch(e) { console.warn("Erro ao buscar professores:", e); }
  return resultado;
}

// Copia chamada de outro professor como base para a chamada atual
async function _copiarChamada(turmaKey, registrosOrigem) {
  const chamadaAtual = await _carregarChamadas(turmaKey);
  for (const [chave, vals] of Object.entries(registrosOrigem)) {
    if (!chamadaAtual[chave]) chamadaAtual[chave] = { ...vals };
  }
  await _salvarChamadas(turmaKey);
  _mostrarIndicadorSync("✓ Chamada copiada como base");
}

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último passado)
let _dataChamadaSel     = null;
// Bimestre selecionado na aba de chamada (independente do bimestreAtivo do cronograma)
let _bimestreChamadaSel = null;
// Mês filtrado na chamada ("YYYY-MM" ou null = todos)
let _mesChamadaSel      = null;
// Filtro de situação na chamada: null = ativos, "" = todos, "AB"|"TR"... = específica
let _chamadaFiltroSit   = null;

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
  const hoje_str = hoje();

  // Oferece cópia de chamada de outros professores:
  // _CHAMADA_OFERTA_SEMPRE=true → sempre; false → só quando vazia para hoje
  const chamadaAtualCheck = await _carregarChamadas(turmaKey);
  const temHoje = Object.keys(chamadaAtualCheck).some(
    k => k === hoje_str || k.startsWith(hoje_str + "_")
  );
  if ((_CHAMADA_OFERTA_SEMPRE || !temHoje) && !_DEV) {
    const outrasHoje = await _buscarChamadasHoje(turmaKey);
    if (outrasHoje.length > 0) {
      const copiou = await _mostrarModalCopiarChamada(turmaKey, outrasHoje);
      if (copiou) { renderizarChamadaFrequencia(); return; }
    }
  }

  const alunos   = await _carregarAlunos(turmaKey);
  const chamadas = await _carregarChamadas(turmaKey);

  // ── Barra de filtro de situação ──────────────────────────────────────────
  const _SITS_INAT_CH = ["AB","NC","TR","RM","RC"];
  const _cntsSit = {
    total:  alunos.length,
    ativos: alunos.filter(a => !_SITS_INAT_CH.includes(a.situacao)).length,
    AB: alunos.filter(a => a.situacao==="AB").length,
    NC: alunos.filter(a => a.situacao==="NC").length,
    TR: alunos.filter(a => a.situacao==="TR").length,
    RM: alunos.filter(a => a.situacao==="RM").length,
    RC: alunos.filter(a => a.situacao==="RC").length,
    EE: alunos.filter(a => a.situacao==="EE").length,
    EV: alunos.filter(a => a.situacao==="EV").length,
  };
  const _mkSitC = (cls, sigla, desc, n) => {
    if (n === 0) return "";
    const ativo      = _chamadaFiltroSit === sigla;
    const clearOrSet = sigla === null ? "null" : sigla === "" ? "''" : `'${sigla}'`;
    const toggle     = ativo ? (sigla === null ? "''" : "null") : clearOrSet;
    return `<span class="sit-item${ativo?" sit-item-ativo":""}"
      onclick="_chamadaFiltroSit=${toggle};renderizarChamadaFrequencia()"
      style="cursor:pointer" title="${ativo?"Remover filtro":"Filtrar: "+desc}">
      <span class="badge-situacao badge-sit-${cls}">${sigla??'✓'}</span>
      <span class="sit-desc">${desc} (${n})</span>
    </span>`;
  };
  const _legendaSitChamada = `<div class="sit-legenda">
    <span class="sit-legenda-titulo">Situação:</span>
    ${_mkSitC("ok",null,"Ativos",_cntsSit.ativos)}
    ${_mkSitC("ok","","TODOS",_cntsSit.total)}
    ${_mkSitC("ab","AB","Abandonou",_cntsSit.AB)}
    ${_mkSitC("nc","NC","Não comparecimento",_cntsSit.NC)}
    ${_mkSitC("tr","TR","Transferido",_cntsSit.TR)}
    ${_mkSitC("rm","RM","Remanejado",_cntsSit.RM)}
    ${_mkSitC("rc","RC","Reclassificado",_cntsSit.RC)}
    ${_mkSitC("ee","EE","Ed. Especial",_cntsSit.EE)}
    ${_mkSitC("ev","EV","Evadido",_cntsSit.EV)}
  </div>`;

  // Aplica filtro de situação à lista visível (TF/%F continuam sobre todos)
  const alunosFiltrados = (() => {
    if (_chamadaFiltroSit === null) return alunos.filter(a => !_SITS_INAT_CH.includes(a.situacao));
    if (_chamadaFiltroSit === "")   return alunos;
    return alunos.filter(a => a.situacao === _chamadaFiltroSit);
  })();

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
    const _isHojeCol = s.data === hoje_str;
    return `<th class="th-data-chamada${isSel ? " th-data-sel" : ""}${_isHojeCol ? " th-dia-hoje" : ""}" title="${title}">
      <span class="th-dia-num">${dia}</span>
      ${isPast ? `<div class="th-dia-popover">
        <button type="button" class="btn-lote"
          onclick="chamadaTodosData('${turmaKey}','${s.data}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off"
          onclick="chamadaTodosData('${turmaKey}','${s.data}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  // ── Linhas de alunos ──
  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado",
    "EE":"Educação Especial"
  };

  const rows = alunosFiltrados.map(a => {
    // TF e %F calculados sobre todas as datas passadas do bimestre
    let totalAulas  = 0;
    let totalFaltas = 0;
    const isEE = a.situacao === "EE";
    const isEV = a.situacao === "EV";
    const isInativo = _SITS_INATIVAS.includes(a.situacao);
    for (const s of slotsPassados) {
      if (isInativo) break; // inativo nunca entra no TF
      if (!_alunoAtivoNaData(a, s.data)) continue;
      totalAulas++;
      const sk = _chaveSlotChamada(s.data, s.aula);
      const exp = (chamadas[sk] || {})[a.num] !== undefined
        ? chamadas[sk][a.num] : (chamadas[s.data] || {})[a.num];
      if (isEV) {
        totalFaltas++; // EV: sempre F
      } else if (isEE) {
        // EE: sempre C, nunca conta falta
      } else if (exp !== undefined) {
        if (exp === "F") totalFaltas++;
      }
      // ativo comum sem registro: não conta (vazio)
    }

    const tds = slotsVisiveis.map(s => {
      const d      = s.data;
      const isPast = d <= hoje_str;
      const ativo  = _alunoAtivoNaData(a, d);

      const slotKey = _chaveSlotChamada(d, s.aula);
      const isHoje  = d === hoje_str;

      // Inativo: sempre —
      if (!ativo) return `<td style="text-align:center;color:var(--text-muted);font-size:.7rem"${isHoje?' class="td-chamada-hoje"':""}>—</td>`;

      const explicit = (chamadas[slotKey] || {})[a.num] !== undefined
        ? chamadas[slotKey][a.num]
        : (chamadas[d] || {})[a.num];

      let val;
      if (explicit !== undefined) val = explicit;
      else if (isEE)  val = "C";   // EE: sempre C, todos os dias
      else if (isEV)  val = "F";   // EV: sempre F, todos os dias
      else            val = "";    // Ativo comum: vazio até o prof registrar

      if (!val) return `<td${isHoje ? ' class="td-chamada-hoje"' : ""}></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      const autoHint = isEE ? " title='Ed. Especial (sempre C)'" : isEV ? " title='Evadido (auto F — editável)'" : "";
      return `<td style="text-align:center"${isHoje ? ' class="td-chamada-hoje"' : ""}>
        <button type="button" class="btn-cf ${cls}"${autoHint}
          ${isEE
            ? `disabled style="opacity:.85;cursor:default"`
            : `onclick="toggleChamadaSlot('${turmaKey}','${slotKey}','${d}',${a.num})"`}
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
      onclick="_bimestreChamadaSel=${b.bimestre};_dataChamadaSel=null;_mesChamadaSel=null;_chamadaFiltroSit=null;renderizarChamadaFrequencia()">${b.label}</button>`
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

  // ── Rodapé: TF / TC / %F por coluna de dia ─────────────────────────────
  const _buildTfootRow = (label, cls, vals, tfTotal, pctTotal) => {
    const cellStyle = `background:#1e2530;color:#e2e8f0;text-align:center;font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:6px 4px;border-top:2px solid #334155;`;
    const labelCell = `<td colspan="3" style="${cellStyle}text-align:left;padding-left:10px;">${label}</td>`;
    const dayCells  = vals.map(v => `<td style="${cellStyle}${v===null?'color:#475569':''}">${v===null?'—':v}</td>`).join("");
    const tfCell    = `<td style="${cellStyle}color:#93c5fd;">${tfTotal}</td>`;
    const pctCell   = `<td style="${cellStyle}color:#93c5fd;">${pctTotal}</td>`;
    return `<tr>${labelCell}${dayCells}${tfCell}${pctCell}</tr>`;
  };

  // Conta F e C por slot visível, sobre os alunos filtrados
  const _tfPorSlot = slotsVisiveis.map(s => {
    let f = 0, c = 0;
    for (const a of alunosFiltrados) {
      if (!_alunoAtivoNaData(a, s.data)) continue;
      const sk  = _chaveSlotChamada(s.data, s.aula);
      const val = (chamadas[sk]||{})[a.num] !== undefined
        ? (chamadas[sk]||{})[a.num]
        : (chamadas[s.data]||{})[a.num];
      if (a.situacao==="EE")     c++;
      else if (a.situacao==="EV") f++;
      else if (val==="F")        f++;
      else if (val==="C")        c++;
    }
    return { f, c, total: f+c };
  });

  const _tfTotalGeral = _tfPorSlot.reduce((s,v) => s+v.f, 0);
  const _tcTotalGeral = _tfPorSlot.reduce((s,v) => s+v.c, 0);
  const _totGeral     = _tfTotalGeral + _tcTotalGeral;
  const _pctFGeral    = _totGeral > 0 ? (_tfTotalGeral/_totGeral*100).toFixed(0)+"%" : "—";

  const _tfootChamada = [
    _buildTfootRow("TF — Total Faltas",      "tf",  _tfPorSlot.map(v => v.total>0 ? v.f : null),                            _tfTotalGeral, ""),
    _buildTfootRow("TC — Total Comparec.",   "tc",  _tfPorSlot.map(v => v.total>0 ? v.c : null),                            _tcTotalGeral, ""),
    _buildTfootRow("%F — % Faltas",          "pct", _tfPorSlot.map(v => v.total>0 ? (v.f/v.total*100).toFixed(0)+"%" : null), "",          _pctFGeral),
  ].join("");

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
          <button type="button" class="btn-exportar-js"
            onclick="_abrirRelatorioFrequencia('${turmaKey}',${_bimestreChamadaSel})">📊 Relatório</button>
        </div>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:4px">${tabsBimChamada}</div>
      ${_bimProgBarChamada(_feitasCham, _totalRegCham, bimObj)}
      ${filtroMeses}
      ${_legendaSitChamada}
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-chamada" style="min-width:0">
          <colgroup>
            <col class="col-num">
            <col class="col-nome">
            <col class="col-sit">
            ${slotsVisiveis.map(() => `<col style="width:28px;min-width:28px;max-width:28px">`).join("")}
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
          <tfoot>${_tfootChamada}</tfoot>
        </table>
      </div>
    </div>`;
}

async function toggleChamada(turmaKey, data, numAluno) {
  // Compatibilidade — usa slotKey = data (sem aula)
  return toggleChamadaSlot(turmaKey, data, data, numAluno);
}

async function toggleChamadaSlot(turmaKey, slotKey, data, numAluno) {
  const [chamadas, alunos] = await Promise.all([
    _carregarChamadas(turmaKey),
    _carregarAlunos(turmaKey),
  ]);
  const aluno = alunos.find(a => a.num === numAluno || String(a.num) === String(numAluno));
  if (!aluno) return;
  // Inativos, EE e EV não podem ser alterados manualmente
  if (_SITS_INATIVAS.includes(aluno.situacao)) return;
  if (aluno.situacao === "EE") return;  // EE nunca é alterado
  if (!chamadas[slotKey]) chamadas[slotKey] = {};
  chamadas[slotKey][numAluno] = (chamadas[slotKey][numAluno] === "F") ? "C" : "F";
  await _salvarChamadas(turmaKey);
  renderizarChamadaFrequencia();
}

async function chamadaTodosData(turmaKey, data, valor) {
  const [alunos, chamadas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarChamadas(turmaKey),
  ]);
  if (!chamadas[data]) chamadas[data] = {};
  for (const a of alunos) {
    // Inativos: nunca recebem valor
    if (_SITS_INATIVAS.includes(a.situacao)) continue;
    // EE: sempre C, independente do valor pedido
    if (a.situacao === "EE") { chamadas[data][a.num] = "C"; continue; }
    // EV: sempre F, independente do valor pedido
    if (a.situacao === "EV") { chamadas[data][a.num] = "F"; continue; }
    // Ativo comum: aplica o valor
    if (_alunoAtivoNaData(a, data)) chamadas[data][a.num] = valor;
  }
  await _salvarChamadas(turmaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────

// ── Chamada Mobile — exibe apenas o dia atual ─────────────────

// Modal de oferta de cópia — resolve(true) se copiou, resolve(false) se recusou
async function _mostrarModalCopiarChamada(turmaKey, outrasHoje) {
  return new Promise(resolve => {
    let modal = document.getElementById("modal-copiar-chamada");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "modal-copiar-chamada";
    modal.className = "modal-overlay";
    modal.style.cssText = "display:flex;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);align-items:center;justify-content:center;";

    const lista = outrasHoje.map(p => `
      <button type="button" class="btn-copiar-chamada" data-doc="${p.docId}">
        <span class="btn-copiar-nome">${p.profNome}</span>
        <span class="btn-copiar-hint">Usar como base (editável)</span>
      </button>`).join("");

    modal.innerHTML = `
      <div class="modal-box" style="max-width:460px">
        <h3 class="modal-titulo">📋 Chamada já realizada hoje</h3>
        <p style="font-size:.88rem;color:var(--text-mid);margin-bottom:16px;line-height:1.6">
          Os professores abaixo já fizeram chamada nesta turma hoje.<br>
          Quer usar uma como ponto de partida? Você ainda poderá editá-la livremente.
        </p>
        <div class="modal-copiar-lista">${lista}</div>
        <div class="modal-actions" style="margin-top:16px">
          <button type="button" class="btn-modal-cancel" id="btn-copiar-nao">
            Não, fazer nova chamada
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelector("#btn-copiar-nao").addEventListener("click", () => {
      modal.remove(); resolve(false);
    });
    modal.querySelectorAll(".btn-copiar-chamada").forEach(btn => {
      btn.addEventListener("click", async () => {
        const docId = btn.dataset.doc;
        btn.disabled = true;
        btn.querySelector(".btn-copiar-hint").textContent = "Carregando…";
        const registros = await _carregarChamadaDeOutro(docId);
        if (registros && Object.keys(registros).length > 0) {
          await _copiarChamada(turmaKey, registros);
          modal.remove(); resolve(true);
        } else {
          btn.querySelector(".btn-copiar-hint").textContent = "⚠ Não foi possível carregar (verifique permissões)";
          btn.disabled = false;
        }
      });
    });
  });
}

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
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado",
    "EE":"Educação Especial"
  };

  const rows = alunosAtivos.map(a => {
    const isEE  = a.situacao === "EE";
    const val   = isEE ? "C" : ((chamadas[_dataChamadaSel] || {})[a.num] || "C");
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
          ${isEE ? 'disabled title="Educação Especial — presença automática"' : `onclick="toggleChamadaMobile('${turmaKey}','${_dataChamadaSel}',${a.num},this)"`}>
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
          <button type="button" class="btn-exportar-js"
            onclick="_abrirRelatorioFrequencia('${turmaKey}',${_bimestreChamadaSel})">📊 Relatório</button>
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

// ── Modal de Relatório de Frequência ─────────────────────────────────────────

async function _abrirRelatorioFrequencia(turmaKey, bim) {
  const t       = turmaAtiva;
  if (!t) return;
  const alunos  = await _carregarAlunos(turmaKey);
  const chamadas= await _carregarChamadas(turmaKey);
  const bimObj  = RT_BIMESTRES.find(b => b.bimestre === bim) || RT_BIMESTRES[0];

  const todosSlots = _slotsDeAulaNoBimestre(t.id, bim)
    .filter(s => s.data >= bimObj.inicio && s.data <= bimObj.fim && s.data <= hoje());

  // Agrupa por data (cada dia = uma barra)
  const diasMap = new Map();
  for (const s of todosSlots) {
    if (!diasMap.has(s.data)) diasMap.set(s.data, { f:0, c:0, s:0 });
    const d = diasMap.get(s.data);
    for (const a of alunos) {
      if (!_alunoAtivoNaData(a, s.data)) { d.s++; continue; }
      const sk  = _chaveSlotChamada(s.data, s.aula);
      const val = (chamadas[sk]||{})[a.num] !== undefined
        ? (chamadas[sk]||{})[a.num] : (chamadas[s.data]||{})[a.num];
      if (a.situacao==="EE")     d.c++;
      else if (a.situacao==="EV") d.f++;
      else if (val==="F")        d.f++;
      else if (val==="C")        d.c++;
    }
  }

  const dias = [...diasMap.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  if (!dias.length) { alert("Nenhum dado de chamada para este bimestre."); return; }

  // ── SVG bar chart ──────────────────────────────────────────────────────────
  const W = Math.max(480, dias.length * 38 + 80);
  const H = 220;
  const PAD = { t:48, r:20, b:50, l:44 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const maxVal = Math.max(...dias.map(([,v]) => v.f + v.c), 1);
  const barW   = Math.floor(chartW / dias.length) - 4;
  const xOff   = (chartW / dias.length - barW) / 2;

  // Y gridlines
  const yStep = maxVal <= 10 ? 2 : maxVal <= 20 ? 5 : 10;
  let gridLines = "";
  for (let y = 0; y <= maxVal; y += yStep) {
    const yy = PAD.t + chartH - (y / maxVal) * chartH;
    gridLines += `<line x1="${PAD.l}" y1="${yy}" x2="${PAD.l+chartW}" y2="${yy}"
      stroke="#2d3748" stroke-width="1" stroke-dasharray="3,3"/>
    <text x="${PAD.l-6}" y="${yy+4}" text-anchor="end" font-size="10" fill="#64748b">${y}</text>`;
  }

  // Bars
  let bars = "";
  dias.forEach(([data, v], i) => {
    const x   = PAD.l + i * (chartW / dias.length) + xOff;
    const tot = v.f + v.c;
    const hC  = tot > 0 ? (v.c / maxVal) * chartH : 0;
    const hF  = tot > 0 ? (v.f / maxVal) * chartH : 0;
    const yC  = PAD.t + chartH - hC - hF;
    const yF  = PAD.t + chartH - hF;
    const dia = data.split("-")[2];
    bars += `
      <rect x="${x}" y="${yC}" width="${barW}" height="${hC}" fill="#4ade80" rx="2"/>
      <rect x="${x}" y="${yF}" width="${barW}" height="${hF}" fill="#f87171" rx="2"/>
      <text x="${x+barW/2}" y="${H-PAD.b+14}" text-anchor="middle" font-size="10" fill="#94a3b8">${dia}</text>`;
    if (v.f > 0)
      bars += `<text x="${x+barW/2}" y="${yF-3}" text-anchor="middle" font-size="9" fill="#fca5a5">${v.f}</text>`;
  });

  // Axis
  const axis = `
    <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t+chartH}" stroke="#475569" stroke-width="1"/>
    <line x1="${PAD.l}" y1="${PAD.t+chartH}" x2="${PAD.l+chartW}" y2="${PAD.t+chartH}" stroke="#475569" stroke-width="1"/>`;

  // Header SVG (mesmo estilo da tabela de notas)
  const header = `
    <rect x="0" y="0" width="${W}" height="${PAD.t-4}" fill="#1e2530"/>
    <text x="${PAD.l}" y="18" font-size="11" font-weight="700" fill="#e2e8f0"
      text-transform="uppercase" letter-spacing="1">
      FREQUÊNCIA — ${t.serie}ª ${t.turma} · ${t.disciplina}
    </text>
    <text x="${PAD.l}" y="33" font-size="10" fill="#64748b">${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</text>
    <rect x="${W-120}" y="8" width="10" height="10" fill="#4ade80" rx="2"/>
    <text x="${W-107}" y="18" font-size="10" fill="#94a3b8">Comparecimento</text>
    <rect x="${W-120}" y="24" width="10" height="10" fill="#f87171" rx="2"/>
    <text x="${W-107}" y="34" font-size="10" fill="#94a3b8">Falta</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
    style="background:#0f172a;border-radius:8px;display:block">
    ${header}${gridLines}${bars}${axis}
  </svg>`;

  // ── Modal ──────────────────────────────────────────────────────────────────
  let modal = document.getElementById("modal-relatorio-chamada");
  if (modal) modal.remove();
  modal = document.createElement("div");
  modal.id = "modal-relatorio-chamada";
  modal.style.cssText = [
    "position:fixed","inset:0","z-index:9999",
    "background:rgba(0,0,0,.6)",
    "display:flex","align-items:center","justify-content:center",
    "padding:20px","overflow:auto"
  ].join(";");

  const totalF = dias.reduce((s,[,v])=>s+v.f,0);
  const totalC = dias.reduce((s,[,v])=>s+v.c,0);
  const totAl  = totalF+totalC;
  const pctF   = totAl>0 ? (totalF/totAl*100).toFixed(1)+"%" : "—";

  modal.innerHTML = `
    <div style="background:#1e293b;border-radius:14px;padding:24px;max-width:${W+48}px;width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,.6);position:relative">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;gap:20px;font-size:.82rem;color:#94a3b8">
          <span>✅ <strong style="color:#4ade80">${totalC}</strong> comparecimentos</span>
          <span>❌ <strong style="color:#f87171">${totalF}</strong> faltas</span>
          <span>📊 <strong style="color:#fbbf24">${pctF}</strong> de faltas</span>
        </div>
        <button id="btn-fechar-relatorio" style="
          background:transparent;border:1px solid #334155;border-radius:6px;
          color:#64748b;font-size:1.1rem;width:32px;height:32px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          transition:all .13s;flex-shrink:0" title="Fechar">✕</button>
      </div>
      <div style="overflow-x:auto">${svg}</div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector("#btn-fechar-relatorio").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
}
