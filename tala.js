// TALA.JS — Lista de alunos (edição, situação, CRUD)
// Dependências: globals.js, db.js, auth.js

let _talaOcultarInativos = false;
let _talaFiltroSit = null;

async function renderizarTala() {
  const t = turmaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-tala");
  if (!secao) return;
  secao.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>';
  const turmaKey = t.serie + t.turma;
  const alunos   = await _carregarAlunos(turmaKey);
  const adm      = _isAdmin(_userAtual?.email);
  const SITUACOES = ["","AB","NC","TR","RM","RC","EE","EV"];
  const SITUACAO_LABEL = { "":"Matriculado","AB":"Abandonou","NC":"Não comparecimento","TR":"Transferido","RM":"Remanejado","RC":"Reclassificado","EE":"Educação Especial","EV":"Evadido" };

  const contsSit = {
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
  const _mkSit = (cls, sigla, desc, n) => {
    if (n === 0) return "";
    const ativo = _talaFiltroSit === (sigla || null);
    const nextVal = sigla ? `'${sigla}'` : "null";
    const clearOrSet = ativo ? "null" : nextVal;
    return `<span class="sit-item${ativo ? " sit-item-ativo" : ""}"
      onclick="_talaFiltroSit=${clearOrSet};renderizarTala()"
      style="cursor:pointer" title="${ativo ? "Remover filtro" : "Filtrar por " + desc}">
      <span class="badge-situacao badge-sit-${cls}">${sigla || "✓"}</span>
      <span class="sit-desc">${desc} (${n})</span>
    </span>`;
  };
  const legendaHtml = `<div class="sit-legenda">
      <span class="sit-legenda-titulo">Situação (${contsSit.total} alunos):</span>
      ${_mkSit("ok","","Matriculado",contsSit.ativos)}
      ${_mkSit("ab","AB","Abandonou",contsSit.AB)}
      ${_mkSit("nc","NC","Não comparecimento",contsSit.NC)}
      ${_mkSit("tr","TR","Transferido",contsSit.TR)}
      ${_mkSit("rm","RM","Remanejado",contsSit.RM)}
      ${_mkSit("rc","RC","Reclassificado",contsSit.RC)}
      ${_mkSit("ee","EE","Ed. Especial",contsSit.EE)}
      ${_mkSit("ev","EV","Evadido",contsSit.EV)}
      ${_talaFiltroSit !== null
        ? `<button class="btn-toggle-inativos" style="padding:2px 8px;font-size:.7rem"
            onclick="_talaFiltroSit=null;renderizarTala()">✕ limpar</button>`
        : ""}
    </div>`;

  const alunosVisiveis = (() => {
    let lista = _talaOcultarInativos
      ? alunos.filter(a => !["AB","NC","TR","RM","RC","EV"].includes(a.situacao))
      : alunos;
    if (_talaFiltroSit !== null)
      lista = lista.filter(a => (a.situacao || "") === (_talaFiltroSit || ""));
    return lista;
  })();

  const rows = alunosVisiveis.map((a, idx) => {
    const sitOpts = SITUACOES.map(s =>
      `<option value="${s}" ${(a.situacao||"") === s?"selected":""}>${s||"—"} ${SITUACAO_LABEL[s]||""}</option>`
    ).join("");
    return `<tr class="${a.situacao?"aluno-inativo":""}">
      <td class="td-numero">${a.num}</td>
      <td>${adm
        ? `<input class="gi" value="${(a.nome||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${turmaKey}',${idx},'nome',this.value)" />`
        : (a.nome||"—")}
      </td>
      <td style="font-size:.8rem">${adm
        ? `<input class="gi gi-sm" value="${(a.matricula||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${turmaKey}',${idx},'matricula',this.value)" />`
        : (a.matricula||"—")}
      </td>
      <td>
        <select class="gi gi-sm" onchange="editarAluno('${turmaKey}',${idx},'situacao',this.value)">
          ${sitOpts}
        </select>
      </td>
      <td style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">
        ${adm
          ? `<input type="date" class="gi gi-sm" value="${a.situacaoData||''}"
               onchange="editarAluno('${turmaKey}',${idx},'situacaoData',this.value)" />`
          : (a.situacaoData ? fmtData(a.situacaoData) : '—')
        }
      </td>
      ${adm ? `<td><button type="button" class="btn-icon-del" onclick="removerAluno('${turmaKey}',${idx})" title="Remover aluno">×</button></td>` : "<td></td>"}
    </tr>`;
  }).join("");

  const btnAdd = adm
    ? `<button type="button" class="btn-add" onclick="adicionarAluno('${turmaKey}')">+ Aluno</button>`
    : "";

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Lista de Alunos — ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button type="button" class="btn-toggle-inativos"
            onclick="_talaOcultarInativos=!_talaOcultarInativos;renderizarTala()">
            ${_talaOcultarInativos ? "👁 Mostrar inativos" : "🚫 Ocultar inativos"}
          </button>
          ${btnAdd}
          <button type="button" class="btn-exportar-js" onclick="baixarTalaCSV('${turmaKey}')">⬇ tala_${turmaKey.toLowerCase()}.csv</button>
        </div>
      </div>
      ${legendaHtml}
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr>
            <th style="width:40px">Nº</th>
            <th>Nome</th>
            <th style="width:120px">Matrícula</th>
            <th style="width:160px">Situação</th>
            <th style="width:110px">Data</th>
            ${adm ? "<th style='width:32px'></th>" : "<th></th>"}
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function editarAluno(turmaKey, idx, campo, valor) {
  const lista = await _carregarAlunos(turmaKey);
  if (!lista[idx]) return;
  lista[idx][campo] = valor;
  // Registra a data em que a situação foi alterada — usada pela chamada
  // para parar de computar C/F a partir desse dia
  if (campo === "situacao") {
    lista[idx].situacaoData = valor ? hoje() : null;
  }
  await _salvarAlunos(turmaKey);
  _mostrarIndicadorSync("✓ Aluno atualizado");
}

async function removerAluno(turmaKey, idx) {
  const lista = await _carregarAlunos(turmaKey);
  if (!lista[idx]) return;
  if (!confirm(`Remover "${lista[idx].nome || "este aluno"}"?`)) return;
  lista.splice(idx, 1);
  lista.forEach((a, i) => a.num = i + 1);
  await _salvarAlunos(turmaKey);
  renderizarTala();
}

async function adicionarAluno(turmaKey) {
  const lista = await _carregarAlunos(turmaKey);
  const num   = lista.length ? Math.max(...lista.map(a => a.num || 0)) + 1 : 1;
  lista.push({ num, nome: "", matricula: "", situacao: "" });
  await _salvarAlunos(turmaKey);
  renderizarTala();
}

// ── Download CSV da tala ──────────────────────────────────────

async function baixarTalaCSV(turmaKey) {
  const lista = await _carregarAlunos(turmaKey);
  const SITUACAO_LABEL = {
    "":"Matriculado","AB":"Abandonou","NC":"Não compareceu",
    "TR":"Transferido","RM":"Remanejado","RC":"Reclassificado",
    "EE":"Educação Especial","EV":"Evadido"
  };
  const cab = ["Nº","Nome","Matrícula","Situação","Data Situação"];
  const linhas = lista.map(a => [
    a.num,
    a.nome || "",
    a.matricula || "",
    SITUACAO_LABEL[a.situacao||""] || a.situacao || "Matriculado",
    a.situacaoData ? fmtData(a.situacaoData) : "",
  ]);
  const csv = [cab, ...linhas]
    .map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";"))
    .join("\n");
  baixarArquivo(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    `tala_${turmaKey.toLowerCase()}.csv`
  );
}
