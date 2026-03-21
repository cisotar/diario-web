// NOTAS.JS — Digitação de notas por bimestre + Conceito Final
// Dependências: globals.js, db.js, auth.js, chamada.js

// ── Estrutura de dados ────────────────────────────────────────
// RT_NOTAS[turmaKey] = {
//   colunas: [ { id, sigla, tipo } ],
//   pesos:   { [colId]: number },
//   notas:   { [bimestre]: { [numAluno]: { [colId]: value, rec: value } } }
// }

let RT_NOTAS = {};

const _COLUNAS_PADRAO = [
  { id: "AM", sigla: "AM", editavel: true,  tipo: "fixo" },
  { id: "TP", sigla: "TP", editavel: true,  tipo: "fixo" },
  { id: "PP", sigla: "PP", editavel: true,  tipo: "fixo" },
  { id: "RC", sigla: "RC", editavel: true,  tipo: "fixo" },
];

const _MEDIA_MINIMA  = 5.0;
const _MEDIA_MAX_REC = 5.0;
const _MAX_FALTAS_PCT = 25.0;

// ── Firestore ─────────────────────────────────────────────────

async function _carregarNotas(turmaKey) {
  if (RT_NOTAS[turmaKey]) return RT_NOTAS[turmaKey];
  if (!_DEV) {
    try {
      const snap = await firebase.firestore()
        .collection("notas").doc(turmaKey).get();
      if (snap.exists) {
        RT_NOTAS[turmaKey] = snap.data();
        RT_NOTAS[turmaKey].colunas = RT_NOTAS[turmaKey].colunas || JSON.parse(JSON.stringify(_COLUNAS_PADRAO));
        RT_NOTAS[turmaKey].pesos   = RT_NOTAS[turmaKey].pesos   || {};
        RT_NOTAS[turmaKey].notas   = RT_NOTAS[turmaKey].notas   || {};
        return RT_NOTAS[turmaKey];
      }
    } catch(e) { console.warn("Erro ao carregar notas:", e); }
  }
  RT_NOTAS[turmaKey] = {
    colunas: JSON.parse(JSON.stringify(_COLUNAS_PADRAO)),
    pesos:   {},
    notas:   {},
  };
  return RT_NOTAS[turmaKey];
}

async function _salvarNotas(turmaKey) {
  if (_DEV) { console.log("[DEV] _salvarNotas — apenas memória"); return; }
  try {
    await firebase.firestore().collection("notas").doc(turmaKey)
      .set({ ...RT_NOTAS[turmaKey], _atualizado: new Date().toISOString() },
           { merge: true });
    _mostrarIndicadorSync("✓ Notas salvas");
  } catch(e) {
    console.warn("Erro ao salvar notas:", e);
    _mostrarIndicadorSync("⚠ Erro ao salvar notas");
  }
}

// ── Cálculos ──────────────────────────────────────────────────

// MT = Média Temporária (média ponderada das colunas do bimestre)
function _calcularMT(notasAluno, colunas, pesos) {
  let somaNotas = 0, somaPesos = 0, temAlguma = false;
  for (const col of colunas) {
    const val = parseFloat(notasAluno?.[col.id]);
    if (isNaN(val)) continue;
    temAlguma = true;
    const peso = parseFloat(pesos?.[col.id]) || 1;
    somaNotas += val * peso;
    somaPesos += peso;
  }
  if (!temAlguma || somaPesos === 0) return null;
  return somaNotas / somaPesos;
}

// MB = Média Bimestral (após recuperação)
// MT >= 5 → MB = MT
// MT < 5 e rec digitada → MB = max(MT, rec) ≤ 5
function _calcularMB(mt, rec) {
  if (mt === null) return null;
  if (mt >= _MEDIA_MINIMA) return mt;
  const recVal = parseFloat(rec);
  if (isNaN(recVal)) return mt;
  return Math.min(Math.max(mt, recVal), _MEDIA_MAX_REC);
}

// MF = Média Final (média aritmética das MB dos 4 bimestres)
function _calcularMF(mbs) {
  const validas = mbs.filter(v => v !== null);
  if (!validas.length) return null;
  return validas.reduce((a, b) => a + b, 0) / validas.length;
}

// Total de faltas de um aluno num bimestre
function _totalFaltasBimestre(chamadas, numAluno, datas) {
  let faltas = 0;
  for (const d of datas) {
    const val = (chamadas[d] || {})[numAluno];
    if (val === "F") faltas++;
  }
  return faltas;
}

function _fmtNota(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toFixed(1).replace(".", ",");
}

// ── Estado ────────────────────────────────────────────────────

let _bimestreNotasSel = null;  // 1|2|3|4|"conceito"

// ── Renderização principal ────────────────────────────────────

async function renderizarNotas() {
  const t     = turmaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-notas");
  if (!secao) return;
  secao.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>';

  if (!_bimestreNotasSel) _bimestreNotasSel = bimestreAtivo;

  const turmaKey = t.serie + t.turma;
  const [alunos, dadosNotas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarNotas(turmaKey),
  ]);

  // Abas de bimestre + Conceito Final
  const tabsBim = [
    ...RT_BIMESTRES.map(b =>
      `<button type="button" class="tab-bim ${b.bimestre === _bimestreNotasSel ? "ativo" : ""}"
        onclick="_bimestreNotasSel=${b.bimestre};renderizarNotas()">${b.label}</button>`
    ),
    `<button type="button" class="tab-bim ${_bimestreNotasSel === "conceito" ? "ativo" : ""}"
      onclick="_bimestreNotasSel='conceito';renderizarNotas()">🏁 Conceito Final</button>`,
  ].join("");

  if (_bimestreNotasSel === "conceito") {
    await _renderizarConceitoFinal(secao, t, turmaKey, alunos, dadosNotas, tabsBim);
  } else {
    _renderizarBimestre(secao, t, turmaKey, alunos, dadosNotas, tabsBim);
  }
}

// ── Tabela por bimestre ───────────────────────────────────────

function _renderizarBimestre(secao, t, turmaKey, alunos, dadosNotas, tabsBim) {
  const bimStr  = String(_bimestreNotasSel);
  const colunas = dadosNotas.colunas;
  const pesos   = dadosNotas.pesos;
  const notas   = dadosNotas.notas[bimStr] || {};

  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado"
  };

  // Cabeçalho de colunas (sem descrição)
  const thColunas = colunas.map((col, ci) => `
    <th class="th-nota">
      ${col.sigla}
      ${col.tipo === "custom"
        ? `<button type="button" class="btn-del-col" title="Remover coluna"
             onclick="removerColunaNotas('${turmaKey}',${ci})">×</button>`
        : ""}
    </th>`).join("");

  // Linha de pesos
  const tdPesos = colunas.map(col => `
    <td class="td-peso">
      <input type="number" class="input-peso" min="0" max="100" step="0.5"
        placeholder="peso"
        value="${pesos[col.id] !== undefined ? pesos[col.id] : ""}"
        onchange="salvarPesoNota('${turmaKey}','${col.id}',this.value)"
        title="Peso desta coluna na média (vazio = igual para todas)" />
    </td>`).join("");

  // Linhas de alunos
  const rows = alunos.map(a => {
    const notasAluno = notas[a.num] || {};
    const mt = _calcularMT(notasAluno, colunas, pesos);
    const mb = _calcularMB(mt, notasAluno.rec);
    const emRec     = mt !== null && mt < _MEDIA_MINIMA;
    const reprovado = mb !== null && mb < _MEDIA_MINIMA;

    const sitLabel = a.situacao ? a.situacao : "✓";
    const sitClass = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";

    const tdNotas = colunas.map(col => {
      const val = notasAluno[col.id] ?? "";
      return `<td class="td-nota">
        <input type="number" class="input-nota" min="0" max="10" step="0.1"
          value="${val}"
          ${!col.editavel ? "readonly" : ""}
          onchange="salvarNotaAluno('${turmaKey}','${bimStr}',${a.num},'${col.id}',this.value)"
          placeholder="—" />
      </td>`;
    }).join("");

    const tdMT = `<td class="td-nota td-mt ${emRec ? "nota-em-rec" : (mt !== null && mt >= _MEDIA_MINIMA ? "nota-ok" : "")}">
      ${_fmtNota(mt)}
    </td>`;

    const tdRec = emRec
      ? `<td class="td-nota td-rec">
          <input type="number" class="input-nota input-rec" min="0" max="10" step="0.1"
            value="${notasAluno.rec ?? ""}"
            onchange="salvarNotaAluno('${turmaKey}','${bimStr}',${a.num},'rec',this.value)"
            placeholder="—" />
        </td>`
      : `<td class="td-nota td-rec nota-vazia">—</td>`;

    const tdMB = `<td class="td-nota td-mb ${reprovado ? "nota-reprovado" : (mb !== null ? "nota-ok" : "")}">
      ${_fmtNota(mb)}
    </td>`;

    return `<tr class="${reprovado ? "row-reprovado" : (emRec ? "row-em-rec" : "")}">
      <td class="td-numero">${a.num}</td>
      <td class="td-nome">${a.nome||"—"}</td>
      <td class="td-nota" style="text-align:center">
        <span class="badge-situacao ${sitClass}" title="${SITUACAO_LABEL[a.situacao||""]||""}">${sitLabel}</span>
      </td>
      ${tdNotas}
      ${tdMT}
      ${tdRec}
      ${tdMB}
    </tr>`;
  }).join("");

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header" style="flex-wrap:wrap;gap:8px">
        <h3>Notas — ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""} · ${t.disciplina}</h3>
        <button type="button" class="btn-add" onclick="adicionarColunaNotas('${turmaKey}')">+ Coluna</button>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:8px">${tabsBim}</div>
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-notas">
          <thead>
            <tr>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              <th class="th-nota" rowspan="2">Sit.</th>
              ${thColunas}
              <th class="th-nota th-mt" rowspan="2" title="Média Temporária">MT${_bimestreNotasSel}</th>
              <th class="th-nota th-rec" rowspan="2" title="Recuperação Contínua">REC</th>
              <th class="th-nota th-mb" rowspan="2" title="Média Bimestral">MB${_bimestreNotasSel}</th>
            </tr>
            <tr class="tr-pesos">${tdPesos}</tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Tabela Conceito Final ─────────────────────────────────────

async function _renderizarConceitoFinal(secao, t, turmaKey, alunos, dadosNotas, tabsBim) {
  const chamadas = await _carregarChamadas(turmaKey);
  const colunas  = dadosNotas.colunas;
  const pesos    = dadosNotas.pesos;

  // Para cada bimestre: datas de aula e notas
  const bimDados = await Promise.all(RT_BIMESTRES.map(async b => {
    const bimStr  = String(b.bimestre);
    const notas   = dadosNotas.notas[bimStr] || {};
    const datas   = _diasDeAulaNoBimestre(t.id, b.bimestre)
      .filter(d => d >= b.inicio && d <= b.fim && d <= hoje());
    return { bim: b, bimStr, notas, datas };
  }));

  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado"
  };

  // Cabeçalho: Nº | Nome | Sit. | MB1 | TF1 | MB2 | TF2 | MB3 | TF3 | MB4 | TF4 | TF | %F | MF
  const thBims = bimDados.map(({ bim }) => `
    <th class="th-nota th-mb" title="Média Bimestral ${bim.bimestre}">MB${bim.bimestre}</th>
    <th class="th-nota th-tf" title="Total de Faltas — ${bim.label}">TF${bim.bimestre}</th>
  `).join("");

  const rows = alunos.map(a => {
    const mbs   = [];
    const faltas = [];

    const tdBims = bimDados.map(({ bim, bimStr, notas, datas }) => {
      const notasAluno = notas[a.num] || {};
      const mt  = _calcularMT(notasAluno, colunas, pesos);
      const mb  = _calcularMB(mt, notasAluno.rec);
      const tf  = _totalFaltasBimestre(chamadas, a.num, datas);
      mbs.push(mb);
      faltas.push({ tf, totalAulas: datas.length });

      const mbClass = mb === null ? "" : mb < _MEDIA_MINIMA ? "nota-reprovado" : "nota-ok";
      return `
        <td class="td-nota td-mb ${mbClass}">${_fmtNota(mb)}</td>
        <td class="td-nota td-tf">${tf}</td>`;
    }).join("");

    const mf = _calcularMF(mbs);
    const totalFaltas = faltas.reduce((s, f) => s + f.tf, 0);
    const totalAulas  = faltas.reduce((s, f) => s + f.totalAulas, 0);
    const pctFaltas   = totalAulas > 0 ? (totalFaltas / totalAulas) * 100 : 0;
    const altaFalta   = pctFaltas > _MAX_FALTAS_PCT;
    const reprovadoFreq = altaFalta;
    const reprovadoNota = mf !== null && mf < _MEDIA_MINIMA;
    const reprovado = reprovadoFreq || reprovadoNota;

    const sitLabel = a.situacao ? a.situacao : "✓";
    const sitClass = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";

    const mfClass = mf === null ? "" : reprovadoNota ? "nota-reprovado" : "nota-ok";
    const pctClass = altaFalta ? "freq-critica" : "nota-ok";

    return `<tr class="${reprovado ? "row-reprovado" : ""}">
      <td class="td-numero">${a.num}</td>
      <td class="td-nome">${a.nome||"—"}</td>
      <td class="td-nota" style="text-align:center">
        <span class="badge-situacao ${sitClass}" title="${SITUACAO_LABEL[a.situacao||""]||""}">${sitLabel}</span>
      </td>
      ${tdBims}
      <td class="td-nota td-tf-total ${altaFalta ? "freq-critica" : ""}" title="${totalFaltas} falta(s) em ${totalAulas} aula(s)">${totalFaltas}</td>
      <td class="td-nota td-pct-faltas ${pctClass}">${totalAulas > 0 ? pctFaltas.toFixed(0)+"%" : "—"}</td>
      <td class="td-nota td-mf ${mfClass}">${_fmtNota(mf)}</td>
    </tr>`;
  }).join("");

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Conceito Final — ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""} · ${t.disciplina}</h3>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:8px">${tabsBim}</div>
      <div class="notas-legenda">
        <span><strong>MB</strong> Média Bimestral</span>
        <span><strong>TF</strong> Total de Faltas</span>
        <span><strong>%F</strong> % Faltas (máx. ${_MAX_FALTAS_PCT}%)</span>
        <span><strong>MF</strong> Média Final (média aritmética das MB)</span>
      </div>
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-notas tabela-conceito">
          <thead>
            <tr>
              <th rowspan="2" style="width:36px">Nº</th>
              <th rowspan="2">Nome</th>
              <th class="th-nota" rowspan="2">Sit.</th>
              ${bimDados.map(({bim}) =>
                `<th colspan="2" class="th-bim-grupo">${bim.label}</th>`
              ).join("")}
              <th class="th-nota th-tf" rowspan="2" title="Total geral de faltas">TF</th>
              <th class="th-nota th-pct" rowspan="2" title="% de faltas (máx. ${_MAX_FALTAS_PCT}%)">%F</th>
              <th class="th-nota th-mf" rowspan="2" title="Média Final">MF</th>
            </tr>
            <tr>${thBims}</tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="15" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Ações ─────────────────────────────────────────────────────

async function salvarNotaAluno(turmaKey, bimStr, numAluno, colId, valor) {
  const dados = await _carregarNotas(turmaKey);
  if (!dados.notas[bimStr]) dados.notas[bimStr] = {};
  if (!dados.notas[bimStr][numAluno]) dados.notas[bimStr][numAluno] = {};
  if (valor.trim() === "") {
    delete dados.notas[bimStr][numAluno][colId];
  } else {
    const val = parseFloat(valor);
    dados.notas[bimStr][numAluno][colId] = isNaN(val) ? "" : Math.min(10, Math.max(0, val));
  }
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

async function salvarPesoNota(turmaKey, colId, valor) {
  const dados = await _carregarNotas(turmaKey);
  if (valor.trim() === "") {
    delete dados.pesos[colId];
  } else {
    const val = parseFloat(valor);
    dados.pesos[colId] = isNaN(val) ? 1 : Math.max(0, val);
  }
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

async function adicionarColunaNotas(turmaKey) {
  const sigla = prompt("Sigla da nova coluna (ex: AT):")?.trim().toUpperCase();
  if (!sigla) return;
  const label = prompt(`Nome completo da coluna "${sigla}":`)?.trim();
  if (!label) return;
  const dados = await _carregarNotas(turmaKey);
  if (dados.colunas.find(c => c.id === sigla)) {
    alert(`Já existe uma coluna com a sigla "${sigla}".`); return;
  }
  dados.colunas.push({ id: sigla, sigla, editavel: true, tipo: "custom" });
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

async function removerColunaNotas(turmaKey, colIdx) {
  const dados = await _carregarNotas(turmaKey);
  const col   = dados.colunas[colIdx];
  if (!col || col.tipo === "fixo") return;
  if (!confirm(`Remover a coluna "${col.sigla}"? As notas salvas nela serão perdidas.`)) return;
  dados.colunas.splice(colIdx, 1);
  delete dados.pesos[col.id];
  for (const bim of Object.values(dados.notas))
    for (const aluno of Object.values(bim))
      delete aluno[col.id];
  await _salvarNotas(turmaKey);
  renderizarNotas();
}
