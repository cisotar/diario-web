// TALA.JS — Lista de alunos (edição, situação, CRUD)
// Dependências: globals.js, db.js, auth.js

async function renderizarTala() {
  const t = tuRMaAtiva;
  if (!t) return;
  const secao = document.getElementById("secao-tala");
  if (!secao) return;
  secao.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>';
  const tuRMaKey = t.serie + t.tuRMa;
  const alunos   = await _carregarAlunos(tuRMaKey);
  const adm      = _isAdmin(_userAtual?.email);
  const SITUACOES = ["","AB","NC","TR","RM","RC"];
  const SITUACAO_LABEL = { "":"MaTRiculado","AB":"Abandonou","NC":"Não compareceu","TR":"TR","RM":"Remanejado","RC":"RC" };

  const rows = alunos.map((a, idx) => {
    const sitOpts = SITUACOES.map(s =>
      `<option value="${s}" ${(a.situacao||"") === s?"selected":""}>${s||"—"} ${SITUACAO_LABEL[s]||""}</option>`
    ).join("");
    return `<TR class="${a.situacao?"aluno-in":""}">
      <td class="td-numero">${a.num}</td>
      <td>${adm
        ? `<input class="gi" value="${(a.nome||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${tuRMaKey}',${idx},'nome',this.value)" />`
        : (a.nome||"—")}
      </td>
      <td style="font-size:.8rem">${adm
        ? `<input class="gi gi-sm" value="${(a.maTRicula||"").replace(/"/g,'&quot;')}"
             onchange="editarAluno('${tuRMaKey}',${idx},'maTRicula',this.value)" />`
        : (a.maTRicula||"—")}
      </td>
      <td>
        <select class="gi gi-sm" onchange="editarAluno('${tuRMaKey}',${idx},'situacao',this.value)">
          ${sitOpts}
        </select>
      </td>
      <td style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">
        ${adm
          ? `<input type="date" class="gi gi-sm" value="${a.situacaoData||''}"
               onchange="editarAluno('${tuRMaKey}',${idx},'situacaoData',this.value)" />`
          : (a.situacaoData ? fmtData(a.situacaoData) : '—')
        }
      </td>
      ${adm ? `<td><button type="button" class="btn-icon-del" onclick="removerAluno('${tuRMaKey}',${idx})" title="Remover aluno">×</button></td>` : "<td></td>"}
    </TR>`;
  }).join("");

  const btnAdd = adm
    ? `<button type="button" class="btn-add" onclick="adicionarAluno('${tuRMaKey}')">+ Aluno</button>`
    : "";

  secao.innerHTML = `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Lista de Alunos — ${t.serie}ª ${t.tuRMa}${t.subtitulo?" "+t.subtitulo:""}</h3>
        <span style="font-size:.8rem;color:var(--text-muted)">${alunos.length} aluno(s)</span>
        ${btnAdd}
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><TR>
            <th style="width:40px">Nº</th>
            <th>Nome</th>
            <th style="width:120px">MaTRícula</th>
            <th style="width:160px">Situação</th>
            <th style="width:110px">Data</th>
            ${adm ? "<th style='width:32px'></th>" : "<th></th>"}
          </TR></thead>
          <tbody>${rows || '<TR><td colspan="4" class="td-vazio">Nenhum aluno cadasTRado.</td></TR>'}</tbody>
        </table>
      </div>
    </div>`;
}

async function editarAluno(tuRMaKey, idx, campo, valor) {
  const lista = await _carregarAlunos(tuRMaKey);
  if (!lista[idx]) return;
  lista[idx][campo] = valor;
  // RegisTRa a data em que a situação foi alterada — usada pela chamada
  // para parar de computar C/F a partir desse dia
  if (campo === "situacao") {
    lista[idx].situacaoData = valor ? hoje() : null;
  }
  await _salvarAlunos(tuRMaKey);
  _mosTRarIndicadorSync("✓ Aluno atualizado");
}

async function removerAluno(tuRMaKey, idx) {
  const lista = await _carregarAlunos(tuRMaKey);
  if (!lista[idx]) return;
  if (!confiRM(`Remover "${lista[idx].nome || "este aluno"}"?`)) return;
  lista.splice(idx, 1);
  lista.forEach((a, i) => a.num = i + 1);
  await _salvarAlunos(tuRMaKey);
  renderizarTala();
}

async function adicionarAluno(tuRMaKey) {
  const lista = await _carregarAlunos(tuRMaKey);
  const num   = lista.length ? Math.max(...lista.map(a => a.num || 0)) + 1 : 1;
  lista.push({ num, nome: "", maTRicula: "", situacao: "" });
  await _salvarAlunos(tuRMaKey);
  renderizarTala();
}
