// NOTAS.JS — Digitação de notas por bimestre + Conceito Final
// Dependências: globals.js, db.js, auth.js, chamada.js

// ── Estrutura de dados ────────────────────────────────────────
// RT_NOTAS[turmaKey] = {
//   colunas: [ { id, sigla, tipo } ],
//   pesos:   { [colId]: number },
//   notas:   { [bimestre]: { [numAluno]: { [colId]: value, rec: value } } }
// }

let RT_NOTAS = {};
let _notasOcultarInativos = false;
let _notasFiltroSit = null;

const _COLUNAS_PADRAO = [
  { id: "AM", sigla: "AM", label: "Avaliação Mensal",  editavel: true, tipo: "fixo" },
  { id: "TP", sigla: "TP", label: "Tarefas Paulista",  editavel: true, tipo: "fixo" },
  { id: "PP", sigla: "PP", label: "Prova Paulista",    editavel: true, tipo: "fixo" },
];

// Pesos padrão (% de cada coluna na MT) — PP fixo em 30%
const _PESOS_PADRAO = { PP: 30 };

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
        RT_NOTAS[turmaKey].pesos   = Object.keys(RT_NOTAS[turmaKey].pesos || {}).length
          ? RT_NOTAS[turmaKey].pesos
          : JSON.parse(JSON.stringify(_PESOS_PADRAO));
        RT_NOTAS[turmaKey].notas   = RT_NOTAS[turmaKey].notas   || {};
        return RT_NOTAS[turmaKey];
      }
    } catch(e) { console.warn("Erro ao carregar notas:", e); }
  }
  RT_NOTAS[turmaKey] = {
    colunas: JSON.parse(JSON.stringify(_COLUNAS_PADRAO)),
    pesos:   JSON.parse(JSON.stringify(_PESOS_PADRAO)),
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
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado","EE":"Educação Especial","EV":"Evadido"
  };

  // Cabeçalho de colunas — sigla editável (exceto PP), drag & drop, tooltip com label
  const thColunas = colunas.map((col, ci) => `
    <th class="th-nota th-col-drag" draggable="true"
      ondragstart="notasDragStart(event,${ci})"
      ondragover="notasDragOver(event)"
      ondrop="notasDrop(event,'${turmaKey}',${ci})"
      ondragleave="notasDragLeave(event)"
      title="${col.label || col.sigla}">
      ${col.id === "PP"
        ? `<span class="th-col-sigla-fixed">${col.sigla}</span>`
        : `<input type="text" class="input-col-sigla" maxlength="6"
             value="${col.sigla}"
             onchange="renomearColunaNotas('${turmaKey}',${ci},this.value)"
             onclick="event.stopPropagation()"
             title="${col.label || col.sigla}" />`
      }
      ${col.tipo === "custom"
        ? `<button type="button" class="btn-del-col" title="Remover coluna"
             onclick="removerColunaNotas('${turmaKey}',${ci})">×</button>`
        : ""}
    </th>`).join("");

  // Legenda das colunas (abaixo da tabela)
  const legendaColunas = `
    <div class="notas-legenda" style="margin-top:8px">
      ${colunas.map(c => `<span title="${c.label||c.sigla}"><strong>${c.sigla}</strong> ${c.label||""}</span>`).join(" · ")}
      · <span><strong>MT${_bimestreNotasSel}</strong> Média Temporária</span>
      · <span><strong>REC</strong> Recuperação (MT &lt; ${_MEDIA_MINIMA.toFixed(1)})</span>
      · <span><strong>MB${_bimestreNotasSel}</strong> Média Bimestral</span>
    </div>`;

  // Linha de pesos (em %)
  const tdPesos = colunas.map(col => `
    <td class="td-peso">
      <div style="display:flex;align-items:center;justify-content:center;gap:2px">
        <input type="number" class="input-peso" min="0" max="100" step="1"
          placeholder="—"
          value="${pesos[col.id] !== undefined ? pesos[col.id] : ""}"
          onchange="salvarPesoNota('${turmaKey}','${col.id}',this.value)"
          title="Peso em % desta coluna na MT (vazio = igual para todas)" />
        <span style="font-size:.65rem;color:#94a3b8">%</span>
      </div>
    </td>`).join("");

  const contsSitN = {
    total: alunos.length,
    ativos: alunos.filter(a => !a.situacao).length,
    AB: alunos.filter(a => a.situacao==="AB").length,
    NC: alunos.filter(a => a.situacao==="NC").length,
    TR: alunos.filter(a => a.situacao==="TR").length,
    RM: alunos.filter(a => a.situacao==="RM").length,
    RC: alunos.filter(a => a.situacao==="RC").length,
    EE: alunos.filter(a => a.situacao==="EE").length,
    EV: alunos.filter(a => a.situacao==="EV").length,
  };
  const _mkSitN = (cls, sigla, desc, n) => {
    if (n === 0) return "";
    const ativo = _notasFiltroSit === (sigla || null);
    return `<span class="sit-item${ativo ? " sit-item-ativo" : ""}"
      onclick="_notasFiltroSit=(_notasFiltroSit===${JSON.stringify(sigla||null)}?null:${JSON.stringify(sigla||null)});renderizarNotas()"
      title="${ativo ? "Clique para remover filtro" : "Clique para filtrar"}" style="cursor:pointer">
      <span class="badge-situacao badge-sit-${cls}">${sigla||"✓"}</span>
      <span class="sit-desc">${desc} (${n})</span>
    </span>`;
  };
  const legendaHtmlNotas = `<div class="sit-legenda">
      <span class="sit-legenda-titulo">Situação (${contsSitN.total} alunos):</span>
      ${_mkSitN("ok","","Matriculado",contsSitN.ativos)}
      ${_mkSitN("ab","AB","Abandonou",contsSitN.AB)}
      ${_mkSitN("nc","NC","Não comparecimento",contsSitN.NC)}
      ${_mkSitN("tr","TR","Transferido",contsSitN.TR)}
      ${_mkSitN("rm","RM","Remanejado",contsSitN.RM)}
      ${_mkSitN("rc","RC","Reclassificado",contsSitN.RC)}
      ${_mkSitN("ee","EE","Ed. Especial",contsSitN.EE)}
      ${_mkSitN("ev","EV","Evadido",contsSitN.EV)}
      ${_notasFiltroSit !== null ? `<button type="button" class="btn-toggle-inativos" style="padding:2px 8px;font-size:.7rem" onclick="_notasFiltroSit=null;renderizarNotas()">✕ limpar filtro</button>` : ""}
    </div>`;

  const alunosVisiveis = (() => {
    let lista = _notasOcultarInativos
      ? alunos.filter(a => !["AB","NC","TR","RM","RC","EV"].includes(a.situacao))
      : alunos;
    if (_notasFiltroSit !== null)
      lista = lista.filter(a => (a.situacao||"") === (_notasFiltroSit||""));
    return lista;
  })();

  // Linhas de alunos
  const rows = alunosVisiveis.map(a => {
    const notasAluno = notas[a.num] || {};
    const mt = _calcularMT(notasAluno, colunas, pesos);
    const mb = _calcularMB(mt, notasAluno.rec);
    const emRec     = mt !== null && mt < _MEDIA_MINIMA;
    const reprovado = mb !== null && mb < _MEDIA_MINIMA;

    const sitLabel  = a.situacao ? a.situacao : "✓";
    const sitClass  = a.situacao ? `badge-sit-${a.situacao.toLowerCase()}` : "badge-sit-ok";
    // Alunos inativos têm campos readonly
    const alunoInativo = _SITS_INATIVAS.includes(a.situacao);

    const tdNotas = colunas.map(col => {
      const val = notasAluno[col.id] ?? "";
      const n   = parseFloat(val);
      const corCls = isNaN(n) ? "" : n >= _MEDIA_MINIMA ? "nota-input-ok" : "nota-input-low";
      return `<td class="td-nota">
        <input type="number" class="input-nota ${corCls}${alunoInativo ? " input-nota-inativo" : ""}"
          min="0" max="10" step="0.1"
          value="${val}"
          ${alunoInativo ? "readonly" : ""}
          data-turma="${turmaKey}" data-bim="${bimStr}" data-num="${a.num}" data-col="${col.id}"
          oninput="_notaInput(this)"
          onkeydown="_notaKeydown(event,this)"
          placeholder="—" />
      </td>`;
    }).join("");

    const tdMT = `<td class="td-nota td-mt ${emRec ? "nota-em-rec" : (mt !== null && mt >= _MEDIA_MINIMA ? "nota-ok" : "")}">
      ${_fmtNota(mt)}
    </td>`;

    const tdRec = emRec
      ? `<td class="td-nota td-rec">
          <input type="number" class="input-nota input-rec${alunoInativo ? " input-nota-inativo" : ""}"
            min="0" max="10" step="0.1"
            value="${notasAluno.rec ?? ""}"
            ${alunoInativo ? "readonly" : ""}
            data-turma="${turmaKey}" data-bim="${bimStr}" data-num="${a.num}" data-col="rec"
            oninput="_notaInput(this)"
            onkeydown="_notaKeydown(event,this)"
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
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn-add" onclick="adicionarColunaNotas('${turmaKey}')">+ Coluna</button>
          <button type="button" class="btn-toggle-inativos"
            onclick="_notasOcultarInativos=!_notasOcultarInativos;renderizarNotas()">
            ${_notasOcultarInativos ? "👁 Mostrar inativos" : "🚫 Ocultar inativos"}
          </button>
          <button type="button" class="btn-exportar-js" onclick="baixarNotasCSV('${turmaKey}','${bimStr}')">⬇ notas_${turmaKey.toLowerCase()}_b${bimStr}.csv</button>
        </div>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:4px">${tabsBim}</div>
      ${(() => {
        const bimObj = RT_BIMESTRES.find(b => b.bimestre === _bimestreNotasSel) || RT_BIMESTRES[0];
        let f = 0, r = 0;
        if (turmaAtiva) for (const s of getSlotsCompletos(turmaAtiva.id, _bimestreNotasSel).filter(s=>!s.eventual)) {
          r++; if (estadoAulas[chaveSlot(turmaAtiva.id, _bimestreNotasSel, s.slotId)]?.feita) f++;
        }
        const p   = r > 0 ? Math.round(f/r*100) : 0;
        const cor = p===100 ? "#4ade80" : p>50 ? "var(--amber)" : "var(--teal,#0d9488)";
        return `<div class="bim-prog-wrap" id="bim-prog-wrap" style="margin-bottom:8px">
          <div class="bim-prog-info">
            <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
            <span class="bim-prog-frac">${f}/${r} aulas dadas · ${p}%</span>
          </div>
          <div class="bim-prog-bar-bg"><div class="bim-prog-bar-fill" style="width:${p}%;background:${cor}"></div></div>
        </div>`;
      })()}
      ${legendaHtmlNotas}
      <div style="overflow-x:auto">
        <table class="tabela-gestao tabela-notas">
          <thead>
            <tr>
              <th style="width:36px" rowspan="2">Nº</th>
              <th rowspan="2">Nome</th>
              <th class="th-nota" rowspan="2">Sit.</th>
              ${thColunas}
              <th class="th-nota th-mt" rowspan="2" title="Média Temporária — média ponderada das colunas">MT${_bimestreNotasSel}</th>
              <th class="th-nota th-rec" rowspan="2" title="Recuperação — aparece quando MT < ${_MEDIA_MINIMA}">REC</th>
              <th class="th-nota th-mb" rowspan="2" title="Média Bimestral — nota final após recuperação">MB${_bimestreNotasSel}</th>
            </tr>
            <tr class="tr-pesos">${tdPesos}</tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
      ${legendaColunas}
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
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado","EE":"Educação Especial","EV":"Evadido"
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
        <button type="button" class="btn-exportar-js" onclick="baixarConceitoFinalCSV('${turmaKey}')">⬇ conceito_final_${turmaKey.toLowerCase()}.csv</button>
      </div>
      <div class="tabs-bimestre" style="margin-bottom:8px">${tabsBim}</div>
      ${(() => {
        const cs={total:alunos.length,ativos:alunos.filter(a=>!a.situacao).length,
          AB:alunos.filter(a=>a.situacao==="AB").length,NC:alunos.filter(a=>a.situacao==="NC").length,
          TR:alunos.filter(a=>a.situacao==="TR").length,RM:alunos.filter(a=>a.situacao==="RM").length,
          RC:alunos.filter(a=>a.situacao==="RC").length,EE:alunos.filter(a=>a.situacao==="EE").length,
          EV:alunos.filter(a=>a.situacao==="EV").length};
        const _m=(cls,s,d,n)=>n>0?`<span class="sit-item"><span class="badge-situacao badge-sit-${cls}">${s||"✓"}</span><span class="sit-desc">${d} (${n})</span></span>`:"";
        return `<div class="sit-legenda"><span class="sit-legenda-titulo">Situação (${cs.total} alunos):</span>
          ${_m("ok","","Matriculado",cs.ativos)}${_m("ab","AB","Abandonou",cs.AB)}
          ${_m("nc","NC","Não comparecimento",cs.NC)}${_m("tr","TR","Transferido",cs.TR)}
          ${_m("rm","RM","Remanejado",cs.RM)}${_m("rc","RC","Reclassificado",cs.RC)}
          ${_m("ee","EE","Ed. Especial",cs.EE)}${_m("ev","EV","Evadido",cs.EV)}</div>`;
      })()}
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

// Debounce para salvar no Firestore (evita escrita a cada tecla)
let _notaSaveTimer = null;
function _debounceSalvarNotas(turmaKey) {
  clearTimeout(_notaSaveTimer);
  _notaSaveTimer = setTimeout(() => _salvarNotas(turmaKey), 800);
}

// Chamado a cada input — atualiza memória e DOM sem re-render
function _notaInput(inputEl) {
  const turmaKey = inputEl.dataset.turma;
  const bimStr   = inputEl.dataset.bim;
  const numAluno = inputEl.dataset.num;
  const colId    = inputEl.dataset.col;
  const valor    = inputEl.value;

  // Atualiza RT_NOTAS em memória
  const dados = RT_NOTAS[turmaKey];
  if (!dados) return;
  if (!dados.notas[bimStr]) dados.notas[bimStr] = {};
  if (!dados.notas[bimStr][numAluno]) dados.notas[bimStr][numAluno] = {};

  if (valor.trim() === "") {
    delete dados.notas[bimStr][numAluno][colId];
  } else {
    const val = parseFloat(valor);
    dados.notas[bimStr][numAluno][colId] = isNaN(val) ? "" : Math.min(10, Math.max(0, val));
  }

  // Atualiza cor do input imediatamente
  const n = parseFloat(valor);
  inputEl.classList.toggle("nota-input-ok",  !isNaN(n) && n >= _MEDIA_MINIMA);
  inputEl.classList.toggle("nota-input-low", !isNaN(n) && n <  _MEDIA_MINIMA);
  if (isNaN(n)) inputEl.classList.remove("nota-input-ok", "nota-input-low");

  // Atualiza células calculadas da linha no DOM (sem re-render)
  _atualizarCelulasCalc(turmaKey, bimStr, numAluno, dados);

  // Salva no Firestore com debounce
  _debounceSalvarNotas(turmaKey);
}

// Atualiza MT, REC e MB de uma linha no DOM sem recriar a tabela
function _atualizarCelulasCalc(turmaKey, bimStr, numAluno, dados) {
  const notasAluno = dados.notas[bimStr]?.[numAluno] || {};
  const colunas    = dados.colunas;
  const pesos      = dados.pesos;

  const mt = _calcularMT(notasAluno, colunas, pesos);
  const mb = _calcularMB(mt, notasAluno.rec);
  const emRec     = mt !== null && mt < _MEDIA_MINIMA;
  const reprovado = mb !== null && mb < _MEDIA_MINIMA;

  // Encontra a linha pelo data-num de qualquer input da linha
  const anyInput = document.querySelector(
    `.input-nota[data-turma="${turmaKey}"][data-bim="${bimStr}"][data-num="${numAluno}"]`
  );
  if (!anyInput) return;
  const tr = anyInput.closest("tr");
  if (!tr) return;

  // MT
  const tdMT = tr.querySelector(".td-mt");
  if (tdMT) {
    tdMT.textContent = _fmtNota(mt);
    tdMT.className = `td-nota td-mt ${emRec ? "nota-em-rec" : (mt !== null && mt >= _MEDIA_MINIMA ? "nota-ok" : "")}`;
  }

  // REC — aparece/desaparece conforme MT
  const tdRec = tr.querySelector(".td-rec");
  if (tdRec) {
    if (emRec) {
      const alunoInativo = _SITS_INATIVAS.includes(
        (RT_ALUNOS[turmaKey] || []).find(a => String(a.num) === String(numAluno))?.situacao
      );
      if (!tdRec.querySelector("input")) {
        tdRec.className = "td-nota td-rec";
        tdRec.innerHTML = `<input type="number" class="input-nota input-rec${alunoInativo ? " input-nota-inativo" : ""}"
          min="0" max="10" step="0.1"
          value="${notasAluno.rec ?? ""}"
          ${alunoInativo ? "readonly" : ""}
          data-turma="${turmaKey}" data-bim="${bimStr}" data-num="${numAluno}" data-col="rec"
          oninput="_notaInput(this)"
          onkeydown="_notaKeydown(event,this)"
          placeholder="—" />`;
      } else {
        const recInput = tdRec.querySelector("input");
        if (document.activeElement !== recInput) recInput.value = notasAluno.rec ?? "";
      }
    } else {
      tdRec.className = "td-nota td-rec nota-vazia";
      tdRec.textContent = "—";
    }
  }

  // MB
  const tdMB = tr.querySelector(".td-mb");
  if (tdMB) {
    tdMB.textContent = _fmtNota(mb);
    tdMB.className = `td-nota td-mb ${reprovado ? "nota-reprovado" : (mb !== null ? "nota-ok" : "")}`;
  }

  // Highlight da linha
  tr.className = reprovado ? "row-reprovado" : (emRec ? "row-em-rec" : "");
}

// Navega entre inputs com Tab (próxima linha, mesma coluna)
function _notaKeydown(e, inputEl) {
  if (e.key !== "Tab") return;
  e.preventDefault();
  const turmaKey = inputEl.dataset.turma;
  const bimStr   = inputEl.dataset.bim;
  const colId    = inputEl.dataset.col;

  // Todos os inputs da mesma coluna, em ordem de linha
  const todos = [...document.querySelectorAll(
    `.input-nota[data-turma="${turmaKey}"][data-bim="${bimStr}"][data-col="${colId}"]`
  )];
  const idx  = todos.indexOf(inputEl);
  const prox = e.shiftKey ? todos[idx - 1] : todos[idx + 1];
  if (prox) {
    prox.focus();
    prox.select();
  }
}

async function salvarNotaAluno(turmaKey, bimStr, numAluno, colId, valor) {
  // Mantido para compatibilidade (chamadas legacy), mas agora _notaInput é o caminho principal
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
  if (!confirm(`Remover a coluna "${col.sigla}"? As notas salvas nela serão perdidas.`)) return;
  dados.colunas.splice(colIdx, 1);
  delete dados.pesos[col.id];
  for (const bim of Object.values(dados.notas))
    for (const aluno of Object.values(bim))
      delete aluno[col.id];
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

// ── Drag & Drop de colunas ────────────────────────────────────

let _notasDragSrcIdx = null;

function notasDragStart(e, colIdx) {
  _notasDragSrcIdx = colIdx;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.classList.add("th-col-dragging");
}

function notasDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("th-col-drag-over");
}

function notasDragLeave(e) {
  e.currentTarget.classList.remove("th-col-drag-over");
}

async function notasDrop(e, turmaKey, destIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove("th-col-drag-over");
  if (_notasDragSrcIdx === null || _notasDragSrcIdx === destIdx) return;
  const dados = await _carregarNotas(turmaKey);
  const cols = dados.colunas;
  const [moved] = cols.splice(_notasDragSrcIdx, 1);
  cols.splice(destIdx, 0, moved);
  _notasDragSrcIdx = null;
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

// ── Renomear sigla de coluna ──────────────────────────────────

async function renomearColunaNotas(turmaKey, colIdx, novaSignla) {
  const sigla = novaSignla.trim().toUpperCase();
  if (!sigla) return;
  const dados = await _carregarNotas(turmaKey);
  const col = dados.colunas[colIdx];
  if (!col || col.id === "PP") return;
  // Migra pesos e notas para nova sigla se mudou
  if (col.sigla !== sigla) {
    if (dados.pesos[col.id] !== undefined) {
      dados.pesos[sigla] = dados.pesos[col.id];
      delete dados.pesos[col.id];
    }
    for (const bim of Object.values(dados.notas)) {
      for (const aluno of Object.values(bim)) {
        if (aluno[col.id] !== undefined) {
          aluno[sigla] = aluno[col.id];
          delete aluno[col.id];
        }
      }
    }
    col.id    = sigla;
    col.sigla = sigla;
  }
  await _salvarNotas(turmaKey);
  renderizarNotas();
}

// ── Downloads ─────────────────────────────────────────────────

async function baixarNotasCSV(turmaKey, bimStr) {
  const [alunos, dados] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarNotas(turmaKey),
  ]);
  const colunas = dados.colunas;
  const pesos   = dados.pesos;
  const notas   = dados.notas[bimStr] || {};

  const cabecalho = ["Nº","Nome","Situação",
    ...colunas.map(c => c.sigla),
    `MT${bimStr}`, "REC", `MB${bimStr}`
  ];

  const linhas = alunos.map(a => {
    const notasAluno = notas[a.num] || {};
    const mt = _calcularMT(notasAluno, colunas, pesos);
    const mb = _calcularMB(mt, notasAluno.rec);
    return [
      a.num,
      a.nome || "",
      a.situacao || "Matriculado",
      ...colunas.map(c => notasAluno[c.id] ?? ""),
      mt !== null ? mt.toFixed(1).replace(".",",") : "",
      notasAluno.rec ?? "",
      mb !== null ? mb.toFixed(1).replace(".",",") : "",
    ];
  });

  const csv = [cabecalho, ...linhas]
    .map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";"))
    .join("\n");

  const bimLabel = RT_BIMESTRES.find(b => String(b.bimestre) === String(bimStr))?.label || `B${bimStr}`;
  baixarArquivo(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    `notas_${turmaKey.toLowerCase()}_bim${bimStr}.csv`
  );
}

async function baixarConceitoFinalCSV(turmaKey) {
  const [alunos, dados, chamadas] = await Promise.all([
    _carregarAlunos(turmaKey),
    _carregarNotas(turmaKey),
    _carregarChamadas(turmaKey),
  ]);
  const t = turmaAtiva;
  if (!t) return;
  const colunas = dados.colunas;
  const pesos   = dados.pesos;

  const cabecalho = ["Nº","Nome","Situação",
    ...RT_BIMESTRES.flatMap(b => [`MB${b.bimestre}`, `TF${b.bimestre}`]),
    "TF Total", "%F", "MF"
  ];

  const linhas = alunos.map(a => {
    const mbs = [], faltas = [];
    const bimCols = RT_BIMESTRES.flatMap(b => {
      const notas = dados.notas[String(b.bimestre)] || {};
      const notasAluno = notas[a.num] || {};
      const mt = _calcularMT(notasAluno, colunas, pesos);
      const mb = _calcularMB(mt, notasAluno.rec);
      const datas = _diasDeAulaNoBimestre(t.id, b.bimestre)
        .filter(d => d >= b.inicio && d <= b.fim && d <= hoje());
      const tf = _totalFaltasBimestre(chamadas, a.num, datas);
      mbs.push(mb);
      faltas.push({ tf, total: datas.length });
      return [mb !== null ? mb.toFixed(1).replace(".",",") : "", tf];
    });
    const mf = _calcularMF(mbs);
    const totalFaltas = faltas.reduce((s,f)=>s+f.tf,0);
    const totalAulas  = faltas.reduce((s,f)=>s+f.total,0);
    const pctF = totalAulas > 0 ? (totalFaltas/totalAulas*100).toFixed(0)+"%" : "—";
    return [a.num, a.nome||"", a.situacao||"Matriculado",
      ...bimCols, totalFaltas, pctF,
      mf !== null ? mf.toFixed(1).replace(".",",") : ""
    ];
  });

  const csv = [cabecalho, ...linhas]
    .map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";"))
    .join("\n");
  baixarArquivo(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    `conceito_final_${turmaKey.toLowerCase()}.csv`
  );
}
