// NOTAS.JS — Digitação de notas por bimestre
// Dependências: globals.js, db.js, auth.js

// ── Estrutura de dados ────────────────────────────────────────
// RT_NOTAS[turmaKey] = {
//   colunas: [ { id, sigla, label, editavel, tipo } ],  // tipo: "fixo"|"custom"
//   pesos:   { [colId]: number },                        // pesos por coluna
//   notas:   { [bimestre]: { [numAluno]: { [colId]: value, rec: value } } }
// }

let RT_NOTAS = {};

const _COLUNAS_PADRAO = [
  { id: "AM", sigla: "AM", label: "Avaliação Mensal",     editavel: true,  tipo: "fixo" },
  { id: "TP", sigla: "TP", label: "Tarefas Paulista",     editavel: true,  tipo: "fixo" },
  { id: "PP", sigla: "PP", label: "Prova Paulista",       editavel: true,  tipo: "fixo" },
  { id: "RC", sigla: "RC", label: "Recuperação Contínua", editavel: true,  tipo: "fixo" },
];

const _MEDIA_MINIMA   = 5.0;
const _MEDIA_MAX_REC  = 5.0;

// ── Firestore ─────────────────────────────────────────────────

async function _carregarNotas(turmaKey) {
  if (RT_NOTAS[turmaKey]) return RT_NOTAS[turmaKey];
  if (!_DEV) {
    try {
      const snap = await firebase.firestore()
        .collection("notas").doc(turmaKey).get();
      if (snap.exists) {
        RT_NOTAS[turmaKey] = snap.data();
        // Garante estrutura mínima
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

// ── Cálculo de média ──────────────────────────────────────────

function _calcularMB(notasAluno, colunas, pesos) {
  let somaNotas  = 0;
  let somaPesos  = 0;
  let temAlguma  = false;

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

function _calcularMF(mb, rec) {
  if (mb === null) return null;
  if (mb >= _MEDIA_MINIMA) return mb;               // aprovado sem rec
  const recVal = parseFloat(rec);
  if (isNaN(recVal)) return mb;                      // rec não digitada
  return Math.min(Math.max(mb, recVal), _MEDIA_MAX_REC);
}

function _fmtNota(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toFixed(1).replace(".", ",");
}

// ── Renderização ──────────────────────────────────────────────

let _bimestreNotasSel = null;

async function renderizarNotas() {
  const t     = turmaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-notas");
  if (!secao) return;
  secao.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>';

  const turmaKey = t.serie + t.turma;
  const [alunos, dadosNotas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarNotas(turmaKey),
  ]);

  if (!_bimestreNotasSel) _bimestreNotasSel = bimestreAtivo;
  const bimStr = String(_bimestreNotasSel);

  const colunas = dadosNotas.colunas;
  const pesos   = dadosNotas.pesos;
  const notas   = dadosNotas.notas[bimStr] || {};

  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado"
  };

  // ── Abas de bimestre ──
  const tabsBim = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimestre === _bimestreNotasSel ? "ativo" : ""}"
      onclick="_bimestreNotasSel=${b.bimestre};renderizarNotas()">${b.label}</button>`
  ).join("");

  // ── Cabeçalho de colunas ──
  const thColunas = colunas.map((col, ci) => `
    <th class="th-nota" title="${col.label}">
      <div class="th-nota-sigla">${col.sigla}</div>
      <div class="th-nota-label">${col.label}</div>
      ${col.tipo === "custom"
        ? `<button type="button" class="btn-del-col" title="Remover coluna"
             onclick="removerColunaNotas('${turmaKey}',${ci})">×</button>`
        : ""}
    </th>`).join("");

  // ── Linha de pesos ──
  const tdPesos = colunas.map(col => `
    <td class="td-peso">
      <input type="number" class="input-peso" min="0" max="100" step="0.5"
        placeholder="peso"
        value="${pesos[col.id] !== undefined ? pesos[col.id] : ""}"
        onchange="salvarPesoNota('${turmaKey}','${col.id}',this.value)"
        title="Peso desta coluna na média (vazio = igual para todas)" />
    </td>`).join("");

  // ── Linhas de alunos ──
  const rows = alunos.map(a => {
    const notasAluno = notas[a.num] || {};
    const mb  = _calcularMB(notasAluno, colunas, pesos);
    const mf  = _calcularMF(mb, notasAluno.rec);
    const emRec     = mb !== null && mb < _MEDIA_MINIMA;
    const reprovado = mf !== null && mf < _MEDIA_MINIMA;

    const sitLabel = a.situacao ? a.situacao : "✓";
    const sitClass = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";
    const sitTitle = SITUACAO_LABEL[a.situacao || ""] || "";

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

    const tdMB = `<td class="td-nota td-mb ${emRec ? "nota-em-rec" : (mb !== null && mb >= _MEDIA_MINIMA ? "nota-ok" : "")}">
      ${_fmtNota(mb)}
    </td>`;

    const tdRec = emRec
      ? `<td class="td-nota td-rec">
          <input type="number" class="input-nota input-rec" min="0" max="10" step="0.1"
            value="${notasAluno.rec ?? ""}"
            onchange="salvarNotaAluno('${turmaKey}','${bimStr}',${a.num},'rec',this.value)"
            placeholder="—" />
        </td>`
      : `<td class="td-nota td-rec" style="color:var(--text-muted);text-align:center">—</td>`;

    const tdMF = `<td class="td-nota td-mf ${reprovado ? "nota-reprovado" : (mf !== null ? "nota-ok" : "")}">
      ${_fmtNota(mf)}
    </td>`;

    return `<tr class="${reprovado ? "row-reprovado" : (emRec ? "row-em-rec" : "")}">
      <td class="td-numero">${a.num}</td>
      <td class="td-nome">${a.nome||"—"}</td>
      <td style="text-align:center">
        <span class="badge-situacao ${sitClass}" title="${sitTitle}">${sitLabel}</span>
      </td>
      ${tdNotas}
      ${tdMB}
      ${tdRec}
      ${tdMF}
    </tr>`;
  }).join("");

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header" style="flex-wrap:wrap;gap:8px">
        <h3>Notas — ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""} · ${t.disciplina}</h3>
        <button type="button" class="btn-add" onclick="adicionarColunaNotas('${turmaKey}')">
          + Coluna
        </button>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:8px">${tabsBim}</div>
      <div class="notas-legenda">
        ${colunas.map(c => `<span><strong>${c.sigla}</strong> ${c.label}</span>`).join(" · ")}
        · <span><strong>MB${_bimestreNotasSel}</strong> Média Bimestral</span>
        · <span><strong>REC</strong> Recuperação (MB &lt; ${_MEDIA_MINIMA.toFixed(1)})</span>
        · <span><strong>MF${_bimestreNotasSel}</strong> Média Final</span>
      </div>
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-notas" style="min-width:0">
          <thead>
            <tr>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              <th rowspan="2" style="width:48px;text-align:center">Sit.</th>
              ${thColunas}
              <th class="th-nota th-mb" rowspan="2">MB${_bimestreNotasSel}</th>
              <th class="th-nota th-rec" rowspan="2">REC</th>
              <th class="th-nota th-mf" rowspan="2">MF${_bimestreNotasSel}</th>
              <th style="width:32px" rowspan="2"></th>
            </tr>
            <tr class="tr-pesos">
              ${tdPesos}
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="10" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Ações ─────────────────────────────────────────────────────

async function salvarNotaAluno(turmaKey, bimStr, numAluno, colId, valor) {
  const dados = await _carregarNotas(turmaKey);
  if (!dados.notas[bimStr]) dados.notas[bimStr] = {};
  if (!dados.notas[bimStr][numAluno]) dados.notas[bimStr][numAluno] = {};
  const val = valor.trim() === "" ? "" : parseFloat(valor);
  if (valor.trim() === "") {
    delete dados.notas[bimStr][numAluno][colId];
  } else {
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
  dados.colunas.push({ id: sigla, sigla, label, editavel: true, tipo: "custom" });
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

async function removerColunaNotas(turmaKey, colIdx) {
  const dados = await _carregarNotas(turmaKey);
  const col   = dados.colunas[colIdx];
  if (!col || col.tipo === "fixo") return;
  if (!confirm(`Remover a coluna "${col.label}"? As notas salvas nela serão perdidas.`)) return;
  dados.colunas.splice(colIdx, 1);
  delete dados.pesos[col.id];
  // Remove os valores da coluna de todos os bimestres
  for (const bim of Object.values(dados.notas)) {
    for (const aluno of Object.values(bim)) {
      delete aluno[col.id];
    }
  }
  await _salvarNotas(turmaKey);
  renderizarNotas();
}
