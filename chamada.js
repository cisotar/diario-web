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
  } catch(e) { console.warn("Erro ao salvar chamadas:", e); }
}

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último passado)
let _dataChamadaSel = null;
// Bimestre selecionado na aba de chamada (independente do bimestre do cronograma)
let _bimestreChamadaSel = null;

function _diasDeAulaNoBimestre(turmaId, bim) {
  const slots = getSlotsCompletos(turmaId, bim).filter(s => !s.eventual);
  return [...new Set(slots.map(s => s.data))].sort();
}

// Retorna true se o aluno deve receber chamada numa data específica.
// Alunos com situação inativa (TR, AB, etc.) param de receber chamada
// a partir de situacaoData (data em que a situação foi registrada na tala).
function _alunoNaData(aluno, data) {
  if (!_SITS_INATIVAS.includes(aluno.situacao)) return true;
  // Se não temos a data de mudança, considera in em todas as datas
  if (!aluno.situacaoData) return false;
  return data < aluno.situacaoData;
}

async function renderizarChamadaFrequencia() {
  const t      = turmaAtiva;
  if (!t) return;
  const secao  = document.getElementById("secao-chamada");
  if (!secao) return;

  const turmaKey = t.serie + t.turma;
  const alunos   = await _carregarAlunos(turmaKey);
  const chamadas = await _carregarChamadas(turmaKey);
  const hoje_str = hoje();

  // Inicializa bimestre da chamada com o bimestre  do cronograma
  if (!_bimestreChamadaSel) _bimestreChamadaSel = bimestre;
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === _bimestreChamadaSel) || RT_BIMESTRES[0];

  // Todos os dias de aula do bimestre selecionado
  const datas = _diasDeAulaNoBimestre(t.id, _bimestreChamadaSel);

  // Data selecionada para marcar chamada em lote
  if (!_dataChamadaSel || !datas.includes(_dataChamadaSel)) {
    _dataChamadaSel = datas.includes(hoje_str)
      ? hoje_str
      : [...datas].reverse().find(d => d <= hoje_str) || datas[0] || hoje_str;
  }

  // Datas visíveis: dentro do bimestre, até hoje + próximas 2
  const datasPassadas = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d <= hoje_str);
  const datasFuturas  = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d > hoje_str).slice(0, 2);
  const datasVisiveis = [...datasPassadas, ...datasFuturas];

  // ── Cabeçalho linha 1: meses agrupados com colspan ──
  const gruposMes = [];
  for (const d of datasVisiveis) {
    const [ano, mes] = d.split("-");
    const chave = `${ano}-${mes}`;
    const labelMes = NOMES_MES[+mes - 1].charAt(0).toUpperCase() + NOMES_MES[+mes - 1].slice(1) + "/" + ano;
    if (!gruposMes.length || gruposMes[gruposMes.length - 1].chave !== chave) {
      gruposMes.push({ chave, label: labelMes, count: 1 });
    } else {
      gruposMes[gruposMes.length - 1].count++;
    }
  }

  const thMeses = gruposMes.map(m =>
    `<th colspan="${m.count}" class="th-mes-chamada">${m.label}</th>`
  ).join("");

  // ── Cabeçalho linha 2: número do dia ──
  const thDias = datasVisiveis.map(d => {
    const isSel  = d === _dataChamadaSel;
    const isPast = d <= hoje_str;
    const dia    = d.split("-")[2];
    return `<th class="th-data-chamada${isSel ? " th-data-sel" : ""}"
      style="min-width:36px;font-size:.75rem;padding:2px 3px;text-align:center">
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
    "TR":"tr","RM":"Remanejado","RC":"rc"
  };

  const rows = alunos.map(a => {
    let totalAulas = 0;  // datas passadas em que o aluno estava 
    let totalFaltas = 0;

    const tds = datasVisiveis.map(d => {
      const isPast  = d <= hoje_str;
      const    = _alunoNaData(a, d);

      // Aluno in nesta data: célula vazia com traço
      if (!) {
        return `<td style="text-align:center;color:var(--text-muted);font-size:.7rem">—</td>`;
      }

      const val = (chamadas[d] || {})[a.num] || (isPast ? "C" : "");

      if (isPast) {
        totalAulas++;
        if (val === "F") totalFaltas++;
      }

      if (!val) return `<td></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      return `<td style="text-align:center">
        <button type="button" class="btn-cf ${cls}"
          onclick="toggleChamada('${turmaKey}','${d}',${a.num})">${val}</button>
      </td>`;
    }).join("");

    const pctFaltas = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0;
    const altaFalta = pctFaltas > 20;

    // Coluna Situação
    const sitLabel = a.situacao ? (a.situacao) : "✓";
    const sitClass = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";
    const sitTitle = SITUACAO_LABEL[a.situacao || ""] || "";
    const sitDataHint = (a.situacao && a.situacaoData) ? ` · ${fmtData(a.situacaoData)}` : "";
    const tdSit = `<td style="text-align:center">
      <span class="badge-situacao ${sitClass}" title="${sitTitle}${sitDataHint}">${sitLabel}</span>
    </td>`;

    // Colunas TF e %F
    const tdTF = `<td class="td-freq-total" title="${totalFaltas} falta(s) em ${totalAulas} aula(s)">${totalFaltas}</td>`;
    const tdPct = `<td class="td-freq-pct ${altaFalta ? "freq-critica" : ""}"
      title="${pctFaltas.toFixed(1)}%">${totalAulas > 0 ? pctFaltas.toFixed(0)+"%" : "—"}</td>`;

    const rowClass = altaFalta ? "row-alta-falta" : "";

    return `<tr class="${rowClass}">
      <td class="td-numero">${a.num}</td>
      <td style="font-size:.82rem">${a.nome||"—"}</td>
      ${tdSit}
      ${tds}
      ${tdTF}
      ${tdPct}
    </tr>`;
  }).join("");

  // Seletor de data para marcar em lote
  const datasOpts = datasPassadas.map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  // Abas de bimestre
  const tabsBimChamada = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimestre === _bimestreChamadaSel ? "" : ""}"
      onclick="_bimestreChamadaSel=${b.bimestre};_dataChamadaSel=null;renderizarChamadaFrequencia()">${b.label}</button>`
  ).join("");

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
  // Marca apenas alunos que estavam s nessa data
  for (const a of alunos) {
    if (_alunoNaData(a, data)) chamadas[data][a.num] = valor;
  }
  await _salvarChamadas(turmaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────
