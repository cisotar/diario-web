// CHAMADA.JS — Sistema de chamadas e frequência
// Dependências: globals.js, db.js, auth.js

const _SITS_INATIVAS = ["AB","TR","RM","RC","NC"];

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
  const slots = getSlotsCompletos(turmaId, bim).filter(s => !s.eventual);
  return [...new Set(slots.map(s => s.data))].sort();
}

// Retorna true se o aluno deve receber chamada numa data específica.
function _alunoAtivoNaData(aluno, data) {
  if (!_SITS_INATIVAS.includes(aluno.situacao)) return true;
  if (!aluno.situacaoData) return false;
  return data < aluno.situacaoData;
}

async function renderizarChamadaFrequencia() {
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

  // Todas as datas de aula do bimestre (sem corte por hoje)
  const todasDatas = _diasDeAulaNoBimestre(t.id, _bimestreChamadaSel)
    .filter(d => d >= bimObj.inicio && d <= bimObj.fim);

  const datasPassadas = todasDatas.filter(d => d <= hoje_str);

  if (!_dataChamadaSel || !todasDatas.includes(_dataChamadaSel)) {
    _dataChamadaSel = todasDatas.includes(hoje_str)
      ? hoje_str
      : [...datasPassadas].reverse()[0] || todasDatas[0] || hoje_str;
  }

  // Datas visíveis: filtradas por mês se houver filtro ativo
  const datasVisiveis = _mesChamadaSel
    ? todasDatas.filter(d => d.startsWith(_mesChamadaSel))
    : todasDatas;

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

  // ── Cabeçalho linha 1: meses com colspan — títulos são links de filtro ──
  const gruposMes = [];
  for (const d of datasVisiveis) {
    const [ano, mes] = d.split("-");
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

  // ── Cabeçalho linha 2: número do dia ──
  const thDias = datasVisiveis.map(d => {
    const isSel  = d === _dataChamadaSel;
    const isPast = d <= hoje_str;
    const dia    = d.split("-")[2];
    return `<th class="th-data-chamada${isSel ? " th-data-sel" : ""}"
      style="min-width:34px;font-size:.75rem;padding:2px 3px;text-align:center">
      ${dia}
      ${isPast ? `<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">
        <button type="button" class="btn-lote" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${turmaKey}','${d}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${turmaKey}','${d}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  // ── Linhas de alunos ──
  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado"
  };

  const rows = alunos.map(a => {
    // TF e %F sempre calculados sobre todas as datas passadas do bimestre
    let totalAulas  = 0;
    let totalFaltas = 0;
    for (const d of datasPassadas) {
      if (!_alunoAtivoNaData(a, d)) continue;
      totalAulas++;
      const val = (chamadas[d] || {})[a.num] || "C";
      if (val === "F") totalFaltas++;
    }

    const tds = datasVisiveis.map(d => {
      const isPast = d <= hoje_str;
      const ativo  = _alunoAtivoNaData(a, d);

      if (!ativo) {
        return `<td style="text-align:center;color:var(--text-muted);font-size:.7rem">—</td>`;
      }

      const val = (chamadas[d] || {})[a.num] || (isPast ? "C" : "");
      if (!val) return `<td></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      return `<td style="text-align:center">
        <button type="button" class="btn-cf ${cls}"
          onclick="toggleChamada('${turmaKey}','${d}',${a.num})">${val}</button>
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
      <td style="font-size:.82rem">${a.nome||"—"}</td>
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
        </div>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:8px">${tabsBimChamada}</div>
      ${filtroMeses}
      <div style="overflow-x:auto">
        <table class="tabela-gestao" style="min-width:0">
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
        </table>
      </div>
    </div>`;
}

async function toggleChamada(turmaKey, data, numAluno) {
  const chamadas = await _carregarChamadas(turmaKey);
  if (!chamadas[data]) chamadas[data] = {};
  chamadas[data][numAluno] = (chamadas[data][numAluno] === "F") ? "C" : "F";
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
    if (_alunoAtivoNaData(a, data)) chamadas[data][a.num] = valor;
  }
  await _salvarChamadas(turmaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────
