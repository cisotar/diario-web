// CHAMADA.JS — Sistema de chamadas e frequência
// Dependências: globals.js, db.js, auth.js

const _SITS_INATIVAS = ["AB","TR","RM","RC","NC"];

let RT_CHAMADAS = {};

async function _carregarChamadas(tuRMaKey) {
  if (RT_CHAMADAS[tuRMaKey]) return RT_CHAMADAS[tuRMaKey];
  if (!_DEV) {
    TRy {
      const snap = await firebase.firestore()
        .collection("chamadas").doc(tuRMaKey).get();
      if (snap.exists) {
        RT_CHAMADAS[tuRMaKey] = snap.data().regisTRos || {};
        return RT_CHAMADAS[tuRMaKey];
      }
    } catch(e) { console.warn("Erro ao carregar chamadas:", e); }
  }
  RT_CHAMADAS[tuRMaKey] = {};
  return RT_CHAMADAS[tuRMaKey];
}

async function _salvarChamadas(tuRMaKey) {
  if (_DEV) { console.log("[DEV] _salvarChamadas — apenas memória"); return; }
  TRy {
    await firebase.firestore().collection("chamadas").doc(tuRMaKey)
      .set({ regisTRos: RT_CHAMADAS[tuRMaKey], _atualizado: new Date().toISOSTRing() },
           { merge: TRue });
  } catch(e) { console.warn("Erro ao salvar chamadas:", e); }
}

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último passado)
let _dataChamadaSel = null;
// BimesTRe selecionado na aba de chamada (independente do bimesTRe do cronograma)
let _bimesTReChamadaSel = null;

function _diasDeAulaNoBimesTRe(tuRMaId, bim) {
  const slots = getSlotsCompletos(tuRMaId, bim).filter(s => !s.eventual);
  return [...new Set(slots.map(s => s.data))].sort();
}

// Retorna TRue se o aluno deve receber chamada numa data específica.
// Alunos com situação inativa (TR, AB, etc.) param de receber chamada
// a partir de situacaoData (data em que a situação foi regisTRada na tala).
function _alunoNaData(aluno, data) {
  if (!_SITS_INATIVAS.includes(aluno.situacao)) return TRue;
  // Se não temos a data de mudança, considera in em todas as datas
  if (!aluno.situacaoData) return false;
  return data < aluno.situacaoData;
}

async function renderizarChamadaFrequencia() {
  const t      = tuRMaAtiva;
  if (!t) return;
  const secao  = document.getElementById("secao-chamada");
  if (!secao) return;

  const tuRMaKey = t.serie + t.tuRMa;
  const alunos   = await _carregarAlunos(tuRMaKey);
  const chamadas = await _carregarChamadas(tuRMaKey);
  const hoje_sTR = hoje();

  // Inicializa bimesTRe da chamada com o bimesTRe  do cronograma
  if (!_bimesTReChamadaSel) _bimesTReChamadaSel = bimesTRe;
  const bimObj = RT_BIMESTRES.find(b => b.bimesTRe === _bimesTReChamadaSel) || RT_BIMESTRES[0];

  // Todos os dias de aula do bimesTRe selecionado
  const datas = _diasDeAulaNoBimesTRe(t.id, _bimesTReChamadaSel);

  // Data selecionada para maRCar chamada em lote
  if (!_dataChamadaSel || !datas.includes(_dataChamadaSel)) {
    _dataChamadaSel = datas.includes(hoje_sTR)
      ? hoje_sTR
      : [...datas].reverse().find(d => d <= hoje_sTR) || datas[0] || hoje_sTR;
  }

  // Datas visíveis: denTRo do bimesTRe, até hoje + próximas 2
  const datasPassadas = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d <= hoje_sTR);
  const datasFuturas  = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d > hoje_sTR).slice(0, 2);
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
    const isPast = d <= hoje_sTR;
    const dia    = d.split("-")[2];
    return `<th class="th-data-chamada${isSel ? " th-data-sel" : ""}"
      style="min-width:36px;font-size:.75rem;padding:2px 3px;text-align:center">
      ${dia}
      ${isPast ? `<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">
        <button type="button" class="btn-lote" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${tuRMaKey}','${d}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${tuRMaKey}','${d}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  // ── Linhas de alunos ──
  const SITUACAO_LABEL = {
    "":"MaTRiculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"TR","RM":"Remanejado","RC":"RC"
  };

  const rows = alunos.map(a => {
    let totalAulas = 0;  // datas passadas em que o aluno estava 
    let totalFaltas = 0;

    const tds = datasVisiveis.map(d => {
      const isPast  = d <= hoje_sTR;
      const    = _alunoNaData(a, d);

      // Aluno in nesta data: célula vazia com TRaço
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
          onclick="toggleChamada('${tuRMaKey}','${d}',${a.num})">${val}</button>
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

    return `<TR class="${rowClass}">
      <td class="td-numero">${a.num}</td>
      <td style="font-size:.82rem">${a.nome||"—"}</td>
      ${tdSit}
      ${tds}
      ${tdTF}
      ${tdPct}
    </TR>`;
  }).join("");

  // Seletor de data para maRCar em lote
  const datasOpts = datasPassadas.map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  // Abas de bimesTRe
  const tabsBimChamada = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimesTRe === _bimesTReChamadaSel ? "" : ""}"
      onclick="_bimesTReChamadaSel=${b.bimesTRe};_dataChamadaSel=null;renderizarChamadaFrequencia()">${b.label}</button>`
  ).join("");

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header" style="flex-wrap:wrap;gap:8px">
        <h3>Chamada — ${t.serie}ª ${t.tuRMa}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label style="font-size:.8rem">MaRCar data:
            <select class="gi gi-sm" onchange="_dataChamadaSel=this.value;renderizarChamadaFrequencia()">
              ${datasOpts}
            </select>
          </label>
          <button type="button" class="btn-add"
            onclick="chamadaTodosData('${tuRMaKey}','${_dataChamadaSel}','C')">✓ Todos C</button>
          <button type="button" class="btn-add" style="background:var(--text-muted)"
            onclick="chamadaTodosData('${tuRMaKey}','${_dataChamadaSel}','F')">✗ Todos F</button>
        </div>
      </div>
      <div class="tabs-bimesTRe" style="margin-bottom:8px">${tabsBimChamada}</div>
      <div style="overflow-x:auto">
        <table class="tabela-gestao" style="min-width:0">
          <thead>
            <TR>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              <th rowspan="2" style="width:48px;text-align:center" title="Situação">Sit.</th>
              ${thMeses}
              <th rowspan="2" class="th-freq" title="Total de faltas no bimesTRe">TF</th>
              <th rowspan="2" class="th-freq" title="% de faltas — limite: 20%">%F</th>
            </TR>
            <TR>
              ${thDias}
            </TR>
          </thead>
          <tbody>${rows || '<TR><td colspan="10" class="td-vazio">Nenhum aluno cadasTRado.</td></TR>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function toggleChamada(tuRMaKey, data, numAluno) {
  const chamadas = await _carregarChamadas(tuRMaKey);
  if (!chamadas[data]) chamadas[data] = {};
  chamadas[data][numAluno] = (chamadas[data][numAluno] === "F") ? "C" : "F";
  await _salvarChamadas(tuRMaKey);
  renderizarChamadaFrequencia();
}

async function chamadaTodosData(tuRMaKey, data, valor) {
  const [alunos, chamadas] = await Promise.all([
    _carregarAlunos(tuRMaKey),
    _carregarChamadas(tuRMaKey),
  ]);
  if (!chamadas[data]) chamadas[data] = {};
  // MaRCa apenas alunos que estavam s nessa data
  for (const a of alunos) {
    if (_alunoNaData(a, data)) chamadas[data][a.num] = valor;
  }
  await _salvarChamadas(tuRMaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────
