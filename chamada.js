// CHAMADA.JS — Sistema de chamadas e frequência
// Dependências: globals.js, db.js, auth.js

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

// Data selecionada para chamada (padrão: hoje se for dia de aula, senão último dia de aula)
let _dataChamadaSel = null;
// Bimestre selecionado na aba de chamada (independente do bimestreAtivo do cronograma)
let _bimestreChamadaSel = null;

function _diasDeAulaNoBimestre(turmaId, bim) {
  const slots = getSlotsCompletos(turmaId, bim).filter(s => !s.eventual);
  // Datas únicas ordenadas
  return [...new Set(slots.map(s => s.data))].sort();
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

  // Inicializa bimestre da chamada com o bimestre ativo do cronograma
  if (!_bimestreChamadaSel) _bimestreChamadaSel = bimestreAtivo;
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === _bimestreChamadaSel) || RT_BIMESTRES[0];

  // Todos os dias de aula da turma no bimestre selecionado
  const datas = _diasDeAulaNoBimestre(t.id, _bimestreChamadaSel);

  // Data selecionada: padrão hoje se for dia de aula, senão último dia de aula passado
  if (!_dataChamadaSel || !datas.includes(_dataChamadaSel)) {
    _dataChamadaSel = datas.includes(hoje_str)
      ? hoje_str
      : [...datas].reverse().find(d => d <= hoje_str) || datas[0] || hoje_str;
  }

  // Alunos ativos (sem situação de saída)
  const alunosAtivos = alunos.filter(a => !["AB","TR","RM","RC"].includes(a.situacao));

  // ── Seletor de data (para marcar chamada individual) ──
  const datasOpts = datas.map(d =>
    `<option value="${d}" ${d===_dataChamadaSel?"selected":""}>${fmtData(d)}</option>`
  ).join("");

  // ── Datas visíveis: filtra pelo bimestre selecionado (inicio → fim) ──
  // Exibe todas as datas do bimestre até hoje; do futuro, mostra as próximas 2
  const datasVisiveis = datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d <= hoje_str)
    .concat(datas.filter(d => d >= bimObj.inicio && d <= bimObj.fim && d > hoje_str).slice(0, 2));

  // ── Cabeçalho duplo: linha 1 = meses agrupados; linha 2 = dias ──
  // Agrupa datas por mês para calcular colspan
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

  const thDias = datasVisiveis.map(d => {
    const isSel = d === _dataChamadaSel;
    const isPast = d <= hoje_str;
    const dia = d.split("-")[2];
    return `<th class="th-data-chamada ${isSel ? "th-data-sel" : ""}" style="min-width:36px;font-size:.75rem;padding:2px 3px;text-align:center">
      ${dia}
      ${isPast ? `<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">
        <button type="button" class="btn-lote" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${turmaKey}','${d}','C')">C</button>
        <button type="button" class="btn-lote btn-lote-off" style="font-size:.55rem;padding:1px 2px"
          onclick="chamadaTodosData('${turmaKey}','${d}','F')">F</button>
      </div>` : ""}
    </th>`;
  }).join("");

  const rows = alunosAtivos.map(a => {
    const tds = datasVisiveis.map(d => {
      const isPast = d <= hoje_str;
      const val = (chamadas[d] || {})[a.num] || (isPast ? "C" : "");
      if (!val) return `<td></td>`;
      const cls = val === "F" ? "chk-falta" : "chk-comp";
      return `<td style="text-align:center">
        ${isPast ? `<button type="button" class="btn-cf ${cls}"
          onclick="toggleChamada('${turmaKey}','${d}',${a.num})">${val}</button>` : ""}
      </td>`;
    }).join("");

    // Situação do aluno
    const sit = a.situacao
      ? `<span class="badge-situacao badge-sit-${a.situacao.toLowerCase()}">${a.situacao}</span>`
      : "";

    return `<tr>
      <td class="td-numero">${a.num}</td>
      <td style="font-size:.82rem">${a.nome||"—"} ${sit}</td>
      ${tds}
    </tr>`;
  }).join("");

  // Abas de bimestre para filtro da chamada
  const tabsBimChamada = RT_BIMESTRES.map(b =>
    `<button type="button" class="tab-bim ${b.bimestre === _bimestreChamadaSel ? "ativo" : ""}"
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
              ${thMeses}
            </tr>
            <tr>
              ${thDias}
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="td-vazio">Nenhum aluno ativo.</td></tr>'}</tbody>
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
  const ativos = alunos.filter(a => !["AB","TR","RM","RC"].includes(a.situacao));
  for (const a of ativos) chamadas[data][a.num] = valor;
  await _salvarChamadas(turmaKey);
  renderizarChamadaFrequencia();
}


// ── Visão detalhada ──────────────────────────────────────────
