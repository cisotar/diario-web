// CRONOGRAMA.JS — Cronograma, edição, drag&drop, checkboxes, modais, exportação
// Dependências: globals.js, db.js, auth.js

// ── Salvar com debounce longo — evita re-renders do onSnapshot ───────────────
// Cada alteração grava no localStorage imediatamente (via salvarTudo interno)
// e agenda o Firestore para 30 s. O onSnapshot só dispara após esse envio,
// portanto a página não re-renderiza durante a edição.
let _cronSaveTimer = null;

function _salvarCron() {
  // 1. localStorage imediato (cache local)
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  try {
    localStorage.setItem(`aulaEstado_${uid}`,    JSON.stringify(estadoAulas));
    localStorage.setItem(`aulaOrdem_${uid}`,     JSON.stringify(ordemConteudos));
    localStorage.setItem(`aulaEventuais_${uid}`, JSON.stringify(linhasEventuais));
    localStorage.setItem(`RT_CONTEUDOS_${uid}`,  JSON.stringify(RT_CONTEUDOS));
    localStorage.setItem(`RT_TURMAS_${uid}`,     JSON.stringify(RT_TURMAS));
  } catch(e) { console.warn("localStorage cheio:", e); }
  // 2. Firestore com debounce de 30 s
  clearTimeout(_cronSaveTimer);
  _cronSaveTimer = setTimeout(() => _salvarFirestore(), 30000);
  _mostrarIndicadorSync("💾 Gravado localmente");
}

// Flush imediato ao fechar/navegar
window.addEventListener("beforeunload", () => {
  if (_cronSaveTimer) { clearTimeout(_cronSaveTimer); _salvarFirestore(); }
});

function renderizarBemVindo() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="bem-vindo">
      <div class="bem-vindo-icon">📋</div>
      <h2>Diário de Classe</h2>
      <p>Selecione uma turma na barra lateral para visualizar<br>o planejamento e registrar as aulas dadas.</p>
    </div>`;
}

function renderizarConteudo() {
  const t = turmaAtiva;
  const main = document.getElementById("conteudo-principal");
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bimestreAtivo);
  const slots  = getSlotsCompletos(t.id, bimestreAtivo);
  const total  = slots.length;
  const labelTurma = t.subtitulo ? `${t.serie}ª Série ${t.turma} — ${t.subtitulo}` : `${t.serie}ª Série ${t.turma}`;

  // ── Contagem do bimestre ativo (para pct-badge) ──
  let feitas = 0, totalReg = 0;
  for (const s of slots) {
    if (!s.eventual) { totalReg++; if (estadoAulas[chaveSlot(t.id,bimestreAtivo,s.slotId)]?.feita) feitas++; }
  }
  const pct = totalReg > 0 ? Math.round(feitas/totalReg*100) : 0;

  // ── Contagem TOTAL (todos os bimestres) para o círculo do header ──
  let totalFeitasGeral = 0, totalRegGeral = 0;
  for (const b of RT_BIMESTRES) {
    const slotsB = getSlotsCompletos(t.id, b.bimestre);
    for (const s of slotsB) {
      if (!s.eventual) {
        totalRegGeral++;
        if (estadoAulas[chaveSlot(t.id, b.bimestre, s.slotId)]?.feita) totalFeitasGeral++;
      }
    }
  }
  const pctGeral = totalRegGeral > 0 ? Math.round(totalFeitasGeral/totalRegGeral*100) : 0;

  const abaAtiva = window._abaCronograma || (window.innerWidth <= 860 ? "chamada_mobile" : "chamada");

  // Helper: gera barra de progresso do bimestre ativo
  const _bimProgBar = (f, r, label, inicio, fim) => {
    const p   = r > 0 ? Math.round(f/r*100) : 0;
    const cor = p === 100 ? "#4ade80" : p > 50 ? "var(--amber)" : "var(--teal,#0d9488)";
    return `
    <div class="bim-prog-wrap" id="bim-prog-wrap">
      <div class="bim-prog-info">
        <span>📅 ${label}: ${fmtData(inicio)} → ${fmtData(fim)}</span>
        <span class="bim-prog-frac">${f}/${r} aulas · ${p}%</span>
      </div>
      <div class="bim-prog-bar-bg">
        <div class="bim-prog-bar-fill" style="width:${p}%;background:${cor}"></div>
      </div>
    </div>`;
  };

  // Tabs de bimestre simples (sem mini SVG)
  const tabsBimSimples = RT_BIMESTRES.map(b =>
    `<button class="tab-bim ${b.bimestre===bimestreAtivo?"ativo":""}"
      onclick="mudarBimestre(${b.bimestre})">${b.label}</button>`
  ).join("");

  // Barra de info completa do cronograma (com hint-drag e pct)
  const bimInfoCronograma = `
    <div class="bimestre-info" id="bimestre-info-cron">
      <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
      <div class="bimestre-info-right">
        <span class="hint-drag">✎ Clique no conteúdo para editar &nbsp;·&nbsp; ⠿ Clique para selecionar · Shift+⠿ seleciona intervalo · Arraste para reorganizar</span>
        <span class="pct-badge">${pct}% concluído</span>
      </div>
    </div>`;

  main.innerHTML = `
    <div class="header-turma">
      <div class="header-turma-info">
        <div class="header-turma-badge">${t.sigla}</div>
        <div>
          <h1 class="header-turma-nome">Diário de Classe — ${t.serie}ª ${t.turma}</h1>
          <p class="header-turma-disc">${t.disciplina}</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button type="button" class="btn-editar-horarios" onclick="abrirModalHorarios()"
          title="Editar horários desta turma">🕐 Horários</button>
        <button type="button" class="btn-visao-det" id="btn-visao-det"
          onclick="alternarVisao()"
          title="Alternar entre visão padrão e detalhada">
          ${visaoDetalhada ? "📋 Visão Padrão" : "📋 Visão Detalhada"}
        </button>
      </div>
      <div class="stat-circulo" title="Total do ano: ${totalFeitasGeral}/${totalRegGeral} aulas dadas (${pctGeral}%)">
        <svg viewBox="0 0 36 36" class="stat-svg">
          <path class="stat-bg"   d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="stat-prog" stroke-dasharray="${pctGeral},100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="stat-texto">
          <span class="stat-num">${totalFeitasGeral}/${totalRegGeral}</span>
          <span class="stat-label">total ano</span>
        </div>
      </div>
    </div>
    <div class="tabs-cronograma-aba">
      <button type="button" class="tab-aba ${abaAtiva==="tala"?"ativo":""}"
        onclick="trocarAbaCronograma('tala')">👥 Tala</button>
      <button type="button" class="tab-aba ${(abaAtiva==="chamada"||abaAtiva==="chamada_mobile")?"ativo":""}"
        onclick="trocarAbaCronograma(window.innerWidth<=860?'chamada_mobile':'chamada')">✅ Chamada</button>
      <button type="button" class="tab-aba ${abaAtiva==="cronograma"?"ativo":""}"
        onclick="trocarAbaCronograma('cronograma')">📅 Cronograma</button>
      <button type="button" class="tab-aba ${abaAtiva==="notas"?"ativo":""}"
        onclick="trocarAbaCronograma('notas')">🎯 Notas</button>
    </div>
    <div id="secao-tala" style="${abaAtiva==="tala"?"":"display:none"}"></div>
    <div id="secao-chamada" style="${(abaAtiva==="chamada"||abaAtiva==="chamada_mobile")?"":"display:none"}"></div>
    <div id="secao-notas" style="${abaAtiva==="notas"?"":"display:none"}"></div>
    <div id="secao-cronograma" style="${abaAtiva!=="cronograma"?"display:none":""}">
    <div class="tabs-bimestre" style="margin-bottom:4px">${tabsBimSimples}</div>
    ${bimInfoCronograma}
    <div class="tabela-wrapper">
      ${total === 0
        ? `<div class="sem-aulas">Nenhuma aula prevista neste bimestre.</div>`
        : `<table class="tabela-aulas" id="tabela-aulas">
            <thead><tr>
              <th class="th-numero"   data-tip="${TOOLTIPS_COLUNAS['th-numero']}">#</th>
              <th class="th-conteudo" data-tip="${TOOLTIPS_COLUNAS['th-conteudo']}">Conteúdos / Atividades</th>
              <th class="th-data"     data-tip="${TOOLTIPS_COLUNAS['th-data']}">Data prevista</th>
              <th class="th-dada" data-tip="${TOOLTIPS_COLUNAS['th-dada']}">
                AD
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="Marcar todas" onclick="marcarColuna('feita',true)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="Desmarcar todas" onclick="marcarColuna('feita',false)">✗</button>
                </div>
              </th>
              <th class="th-registro" data-tip="${TOOLTIPS_COLUNAS['th-registro']}">Data</th>
              <th class="th-chamada" data-tip="${TOOLTIPS_COLUNAS['th-chamada']}">
                Chamada
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="Marcar todas" onclick="marcarColuna('chamada',true)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="Desmarcar todas" onclick="marcarColuna('chamada',false)">✗</button>
                </div>
              </th>
              <th class="th-entregue" data-tip="${TOOLTIPS_COLUNAS['th-entregue']}">
                Registro
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="Marcar todas" onclick="marcarColuna('conteudoEntregue',true)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="Desmarcar todas" onclick="marcarColuna('conteudoEntregue',false)">✗</button>
                </div>
              </th>
            </tr></thead>
            <tbody id="tbody-aulas"></tbody>
          </table>`
      }
    </div>
    </div><!-- /secao-cronograma -->
    <div class="rodape-tabela">
      <div class="rodape-grupo">
        <button class="btn-eventual" onclick="abrirModalEventual()">+ Aula eventual</button>
        <button class="btn-resetar-ordem" onclick="resetarOrdem()">↺ Resetar ordem</button>
      </div>
      <div class="rodape-grupo">
        <button class="btn-exportar-csv" onclick="exportarCSV()">⬇ CSV</button>
        <button class="btn-exportar-js"  onclick="exportarJS()">⬇ aulas.js</button>
        <button class="btn-limpar"       onclick="confirmarLimpar()">🗑 Limpar</button>
      </div>
    </div>
    <div id="modal-horarios" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:480px">
        <h3 class="modal-titulo">🕐 Horários — ${t.serie}ª ${t.turma} ${t.disciplina}</h3>
        <div id="modal-horarios-corpo"></div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalHorarios()">Fechar</button>
        </div>
      </div>
    </div>
    <div id="modal-eventual" class="modal-overlay" style="display:none">
      <div class="modal-box">
        <h3 class="modal-titulo">Inserir Aula Eventual</h3>
        <div class="modal-form">
          <label>Data <input type="date" id="ev-data" /></label>
          <label>Horário <input type="time" id="ev-hora" value="07:00" /></label>
          <label>Descrição / Conteúdo <textarea id="ev-desc" rows="2" placeholder="Ex: Reposição — Biomas"></textarea></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalEventual()">Cancelar</button>
          <button type="button" class="btn-modal-ok"     onclick="confirmarEventual()">Inserir</button>
        </div>
      </div>
    </div>`;
  if (abaAtiva === "tala")    renderizarTala();
  if (abaAtiva === "chamada") renderizarChamadaFrequencia();
  if (abaAtiva === "notas")   renderizarNotas();
  if (abaAtiva === "cronograma" && total > 0) renderizarLinhas(slots);
}

// ── Sistema de Chamadas ───────────────────────────────────────
// Estrutura: RT_CHAMADAS[turmaKey][data][numAluno] = "C"|"F"

function trocarAbaCronograma(aba) {
  window._abaCronograma = aba;
  const secCron  = document.getElementById("secao-cronograma");
  const secTala  = document.getElementById("secao-tala");
  const secCham  = document.getElementById("secao-chamada");
  const secNotas = document.getElementById("secao-notas");
  const btns     = document.querySelectorAll(".tab-aba");
  btns.forEach(b => b.classList.remove("ativo"));

  const isChamada = aba === "chamada" || aba === "chamada_mobile";
  document.querySelector(`.tab-aba[onclick*="'cronograma'"]`)?.classList.toggle("ativo", aba === "cronograma");
  document.querySelector(`.tab-aba[onclick*="'tala'"]`)?.classList.toggle("ativo", aba === "tala");
  document.querySelector(`.tab-aba[onclick*="'notas'"]`)?.classList.toggle("ativo", aba === "notas");
  if (isChamada) document.querySelectorAll(".tab-aba").forEach(b => { if (b.textContent.includes("Chamada")) b.classList.add("ativo"); });

  if (secCron)  secCron.style.display  = aba === "cronograma" ? "" : "none";
  if (secTala)  secTala.style.display  = aba === "tala"       ? "" : "none";
  if (secCham)  secCham.style.display  = isChamada            ? "" : "none";
  if (secNotas) secNotas.style.display = aba === "notas"      ? "" : "none";

  // Barra de progresso: visível em chamada e notas (dentro das seções — gerenciada por cada uma)
  const progWrap = document.getElementById("bim-prog-wrap");
  if (progWrap) progWrap.style.display = (aba === "tala" || aba === "cronograma") ? "none" : "";

  if (aba === "tala")          renderizarTala();
  if (isChamada)               renderizarChamadaFrequencia();
  if (aba === "notas")         renderizarNotas();
  if (aba === "cronograma") {
    const slots = getSlotsCompletos(turmaAtiva.id, bimestreAtivo);
    if (slots.length > 0) renderizarLinhas(slots);
  }
}

// Atualiza a barra de progresso do bimestre ativo (chamada quando muda o bimestre)
function _atualizarBimProgBar() {
  const wrap = document.getElementById("bim-prog-wrap");
  if (!wrap) return;
  const t      = turmaAtiva;
  if (!t) return;
  const bimObj = RT_BIMESTRES.find(b => b.bimestre === bimestreAtivo) || RT_BIMESTRES[0];
  let feitas = 0, totalReg = 0;
  for (const s of getSlotsCompletos(t.id, bimestreAtivo)) {
    if (!s.eventual) { totalReg++; if (estadoAulas[chaveSlot(t.id,bimestreAtivo,s.slotId)]?.feita) feitas++; }
  }
  const p   = totalReg > 0 ? Math.round(feitas/totalReg*100) : 0;
  const cor = p === 100 ? "#4ade80" : p > 50 ? "var(--amber)" : "var(--teal,#0d9488)";
  wrap.innerHTML = `
    <div class="bim-prog-info">
      <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
      <span class="bim-prog-frac">${feitas}/${totalReg} aulas · ${p}%</span>
    </div>
    <div class="bim-prog-bar-bg">
      <div class="bim-prog-bar-fill" style="width:${p}%;background:${cor}"></div>
    </div>`;
}


function alternarVisao() {
  visaoDetalhada = !visaoDetalhada;
  renderizarConteudo();
}

// Salva detalhe — detalhes agora é um array (suporta múltiplos)
function salvarDetalhe(slotId, idx, valor) {
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  // Migração: string → array
  if (!Array.isArray(estadoAulas[ch].detalhes)) {
    const old = estadoAulas[ch].detalhe || "";
    estadoAulas[ch].detalhes = old ? [old] : [""];
    delete estadoAulas[ch].detalhe;
  }
  estadoAulas[ch].detalhes[idx] = valor;
  _salvarCron();
}

function adicionarDetalhe(slotId) {
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  if (!Array.isArray(estadoAulas[ch].detalhes)) {
    const old = estadoAulas[ch].detalhe || "";
    estadoAulas[ch].detalhes = old ? [old] : [""];
    delete estadoAulas[ch].detalhe;
  }
  estadoAulas[ch].detalhes.push("");
  _salvarCron();
  // Re-render only this cell
  const tdC = document.querySelector(`td.td-conteudo[data-slot="${slotId}"]`);
  if (tdC) _renderizarBlocoAD(slotId, tdC, estadoAulas[ch].detalhes);
}

function _renderizarBlocoAD(slotId, tdC, detalhes) {
  const chaveBase = `${turmaAtiva.serie}_${turmaAtiva.disciplina}_b${bimestreAtivo}`;
  const lista = RT_CONTEUDOS[chaveBase] || RT_CONTEUDOS[`${turmaAtiva.serie}_${turmaAtiva.disciplina}`] || [];
  const wrap = tdC.querySelector(".ad-blocos-wrap");
  if (!wrap) return;
  wrap.innerHTML = detalhes.map((val, idx) => _mkADRow(slotId, lista, val, idx)).join("");
}

function _mkADRow(slotId, lista, val, idx) {
  const opts = lista.map(c =>
    `<option value="${c.replace(/"/g,'&quot;')}" ${val===c?"selected":""}>${c}</option>`
  ).join("");
  return `<div class="conteudo-ad-row">
    <span class="cont-label-ad">AD</span>
    <datalist id="dl-${slotId}-${idx}">
      ${lista.map(c=>`<option value="${c.replace(/"/g,'&quot;')}">`).join("")}
    </datalist>
    <input type="text" class="detalhe-input gi"
      list="dl-${slotId}-${idx}"
      value="${(val||'').replace(/"/g,'&quot;')}"
      placeholder="— aula desenvolvida —"
      onchange="salvarDetalhe('${slotId}',${idx},this.value)"
      title="Aula desenvolvida — selecione ou digite" />
    <button type="button" class="btn-add-detalhe" title="Adicionar outra linha AD"
      onclick="adicionarDetalhe('${slotId}')">+</button>
  </div>`;
}

// ── Modal de horários da turma ativa ─────────────────────────
function abrirModalHorarios() {
  const t = turmaAtiva;
  if (!t) return;
  const modal = document.getElementById("modal-horarios");
  if (!modal) return;
  modal.style.display = "flex";
  _renderizarCorpoHorarios();
}

function fecharModalHorarios() {
  const modal = document.getElementById("modal-horarios");
  if (modal) modal.style.display = "none";
}

function _renderizarCorpoHorarios() {
  const t = turmaAtiva;
  if (!t) return;
  const corpo = document.getElementById("modal-horarios-corpo");
  if (!corpo) return;
  const ti = RT_TURMAS.indexOf(t);
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const turno = t.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
  // Fallback: se nenhum período bate com o turno, mostra todos
  const opcoesPerido = (periodos.length ? periodos : RT_PERIODOS)
    .map(p => `<option value="${p.aula}">${p.label} (${p.inicio}–${p.fim})</option>`)
    .join("");

  const horariosHtml = (t.horarios||[]).map((h, hi) => `
    <div class="horario-item" style="margin-bottom:8px">
      <select class="gi gi-xs" onchange="editHorario(${ti},${hi},'diaSemana',+this.value);_renderizarCorpoHorarios()">
        ${diasNomes.map((d,di) => `<option value="${di}" ${h.diaSemana===di?"selected":""}>${d}</option>`).join("")}
      </select>
      <select class="gi gi-sm" onchange="editHorario(${ti},${hi},'aula',this.value);_renderizarCorpoHorarios()">
        ${(RT_PERIODOS.length ? RT_PERIODOS : []).map(p =>
          `<option value="${p.aula}" ${h.aula===p.aula?"selected":""}>${p.label} (${p.inicio}–${p.fim})</option>`
        ).join("")}
      </select>
      <button type="button" class="btn-icon-del"
        onclick="delHorario(${ti},${hi});_renderizarCorpoHorarios()">×</button>
    </div>`).join("");

  corpo.innerHTML = `
    <p class="gestao-hint" style="margin-bottom:10px">
      Dias e períodos em que esta disciplina ocorre nesta turma.
    </p>
    <div id="lista-horarios-modal">${horariosHtml || '<p class="gestao-hint">Nenhum horário cadastrado.</p>'}</div>
    <button type="button" class="btn-add-small" style="margin-top:6px"
      onclick="addHorarioModal(${ti})">+ Horário</button>`;
}

function addHorarioModal(ti) {
  const t       = RT_TURMAS[ti];
  const turno   = t?.periodo || "manha";
  const prefixo = turno === "tarde" ? "t" : "m";
  const diaSemana = 1, aula = prefixo + "1";
  _verificarConflitoHorario(t.serie, t.turma, diaSemana, aula, t.id).then(conflito => {
    if (conflito) { _mostrarModalConflito(conflito); return; }
    RT_TURMAS[ti].horarios.push({ diaSemana, aula });
    salvarTudo();
    _renderizarCorpoHorarios();
    renderizarConteudo();
    const modal = document.getElementById("modal-horarios");
    if (modal) modal.style.display = "flex";
  });
}


function renderizarLinhas(slots) {
  const t      = turmaAtiva;
  const tbody  = document.getElementById("tbody-aulas");
  if (!tbody) return;
  tbody.innerHTML = "";
  // Chave específica por bimestre; fallback para chave sem bimestre (migração)
  const chaveC = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const conts  = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem    = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  let regIdx = 0;
  let lineNum = 0;
  for (const slot of slots) {
    lineNum++;
    const slotId = slot.slotId;
    const ch     = chaveSlot(t.id, bimestreAtivo, slotId);
    const est    = estadoAulas[ch] || {};
    const feita  = !!est.feita;
    let conteudoBase = "", conteudoExibido = "", editado = false;
    if (!slot.eventual) {
      const contIdx   = ordem[regIdx];
      conteudoBase    = (contIdx != null && conts[contIdx] != null) ? conts[contIdx] : "";
      conteudoExibido = est.conteudoEditado ?? conteudoBase;
      editado         = est.conteudoEditado != null && est.conteudoEditado !== conteudoBase;
      regIdx++;
    } else {
      conteudoBase    = slot.descricao || "";
      conteudoExibido = est.conteudoEditado ?? conteudoBase;
      editado         = est.conteudoEditado != null && est.conteudoEditado !== conteudoBase;
    }
    const selecionado = selConteudos.has(slotId);
    const passada     = slot.data < hoje();
    const rowBase     = slot.eventual ? "row-eventual" : (feita ? "row-feita" : (passada ? "row-pendente" : "row-futura"));
    const rowClass    = `${rowBase}${selecionado ? " row-sel-cont" : ""}`;
    const tr = document.createElement("tr");
    tr.className    = rowClass;
    tr.dataset.slot = slotId;

    // FIX: passa "this" para toggleCampo para permitir reversão imediata do
    // checkbox caso o visitante não esteja autenticado.
    const mkChk = (campo, val, title) => `
      <label class="checkbox-wrapper" title="${title} · Shift+clique para intervalo">
        <input type="checkbox" ${val?"checked":""}
          data-slot="${slotId}" data-campo="${campo}"
          onclick="onChkClick(event,'${slotId}','${campo}',this)">
        <span class="checkmark ${campo==='feita'?'':'checkmark-alt'}"></span>
      </label>`;

    // Migração: detalhe (string) → detalhes (array)
    const detalhes = Array.isArray(est.detalhes)
      ? est.detalhes
      : (est.detalhe ? [est.detalhe] : [""]);

    const chaveBaseAD = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
    const listaAD = RT_CONTEUDOS[chaveBaseAD] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];

    const blocoAD = visaoDetalhada
      ? `<div class="ad-blocos-wrap">
          ${detalhes.map((val, idx) => _mkADRow(slotId, listaAD, val, idx)).join("")}
        </div>`
      : "";

    tr.innerHTML = `
      <td class="td-numero">${slot.eventual ? `<span class="tag-eventual" title="Aula eventual">E</span>` : lineNum}</td>
      <td class="td-conteudo" data-slot="${slotId}">
        <div class="conteudo-cell">
          <span class="drag-handle-cont ${selecionado?"handle-sel":""}"
            data-slot="${slotId}" draggable="true"
            title="Clique para selecionar · Shift+clique para intervalo · Arrastar para reorganizar">⠿</span>
          <span class="cont-label-ap">AP</span>
          <span class="conteudo-texto ${editado?"editado":""}"
            data-slot="${slotId}"
            title="${editado?"Editado · clique para editar":"Clique para editar"}"
          >${conteudoExibido||'<span class="sem-conteudo">—</span>'}</span>
          ${editado?'<span class="badge-editado">✎</span>':""}
          ${slot.eventual?`<button class="btn-del-eventual" onclick="removerEventual('${slotId}')" title="Remover esta aula eventual">×</button>`:""}
        </div>
        ${blocoAD}
        <input type="text" class="anotacao-input"
          placeholder="Anotação…"
          value="${(est.anotacao||'').replace(/"/g,'&quot;')}"
          onchange="salvarAnotacao('${slotId}', this.value)"
          title="Anotação livre sobre esta aula"
        />
      </td>
      <td class="td-data">${fmtSlotData(slot)}</td>
      <td class="td-check">${mkChk("feita",   feita, "Aula dada?")}</td>
      <td class="td-registro" id="reg-${slotId}">${feita?fmtData(est.dataFeita):"—"}</td>
      <td class="td-check">${mkChk("chamada", !!est.chamada,   "Chamada realizada?")}</td>
      <td class="td-check">${mkChk("conteudoEntregue", !!est.conteudoEntregue, "Material entregue?")}</td>`;
    const spanTxt = tr.querySelector(".conteudo-texto");
    spanTxt.addEventListener("click", () => iniciarEdicao(spanTxt, slotId, conteudoBase));
    const handle = tr.querySelector(".drag-handle-cont");
    handle.addEventListener("click",      e => onHandleClick(e, slotId));
    handle.addEventListener("dragstart",  e => onDragStart(e, slotId));
    handle.addEventListener("dragend",    onDragEnd);
    const tdC = tr.querySelector(".td-conteudo");
    tdC.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; });
    tdC.addEventListener("dragenter", e => onDragEnter(e, slotId));
    tdC.addEventListener("dragleave", e => onDragLeave(e));
    tdC.addEventListener("drop",      e => onDrop(e, slotId));
    tbody.appendChild(tr);
  }
}

function iniciarEdicao(spanEl, slotId, base) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  if (spanEl.querySelector("textarea")) return;
  const cur = spanEl.innerText.replace("—","").trim();
  const ta  = document.createElement("textarea");
  ta.className = "input-edicao";
  ta.value = cur; ta.rows = 2;
  spanEl.innerHTML = ""; spanEl.appendChild(ta);
  spanEl.classList.add("editando");
  ta.focus(); ta.select();
  function salvar() {
    const novo = ta.value.trim();
    const ch   = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    const chaveC = `${turmaAtiva.serie}_${turmaAtiva.disciplina}_b${bimestreAtivo}`;
    const slotsReg = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).filter(s => !s.eventual);
    const ordem    = getOrdem(turmaAtiva.id, bimestreAtivo, slotsReg.length);
    const regIdx   = slotsReg.findIndex(s => s.slotId === slotId);
    if (regIdx >= 0 && ordem[regIdx] != null) {
      if (!RT_CONTEUDOS[chaveC]) RT_CONTEUDOS[chaveC] = [];
      RT_CONTEUDOS[chaveC][ordem[regIdx]] = novo || base;
    }
    delete estadoAulas[ch].conteudoEditado;
    _salvarCron();
    const editado = false;
    const exibido = novo || base || "";
    spanEl.classList.remove("editando");
    spanEl.classList.toggle("editado", editado);
    spanEl.innerHTML = exibido || '<span class="sem-conteudo">—</span>';
    spanEl.title = editado ? "Editado · clique para editar" : "Clique para editar";
    const td = spanEl.closest("td");
    let badge = td.querySelector(".badge-editado");
    if (editado && !badge) { badge = document.createElement("span"); badge.className="badge-editado"; badge.textContent="✎"; td.querySelector(".conteudo-cell").appendChild(badge); }
    else if (!editado && badge) badge.remove();
    spanEl.addEventListener("click", () => iniciarEdicao(spanEl, slotId, base));
  }
  ta.addEventListener("blur", salvar);
  ta.addEventListener("keydown", e => {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); ta.blur(); }
    if (e.key==="Escape") { ta.value=cur; ta.blur(); }
  });
}

function salvarAnotacao(slotId, valor) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { return; }
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  if (valor.trim() === "") delete estadoAulas[ch].anotacao;
  else estadoAulas[ch].anotacao = valor.trim();
  _salvarCron();
}

// FIX: recebe o elemento <input> (inputEl) para reverter o checkbox
// imediatamente no DOM se o visitante não estiver autenticado.
// Antes, o check ficava visualmente marcado até o modal fechar.
// Clique numa checkbox: clique simples toggle, shift+clique aplica intervalo
function onChkClick(e, slotId, campo, inputEl) {
  // Impede seleção de texto ao usar shift+clique
  if (e.shiftKey) {
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
  }

  // O browser já togglou checked antes do onclick — lê o valor atual
  const novoValor = inputEl.checked;

  if (e.shiftKey && ultimoChkSlot && ultimoChkCampo === campo) {
    // Shift+clique: o loop vai atualizar todos os checkboxes do intervalo
    // incluindo o destino — não reverter aqui

    const todos = [...document.querySelectorAll(
      `#tabela-aulas input[data-campo="${campo}"]`
    )].map(i => i.dataset.slot);

    const iA = todos.indexOf(ultimoChkSlot);
    const iB = todos.indexOf(slotId);
    if (iA === -1 || iB === -1) return;

    // Inclui ambos os extremos — slice é exclusivo no fim, por isso ate+1
    const de  = Math.min(iA, iB);
    const ate = Math.max(iA, iB);
    const valor = ultimoChkValor;
    const slotsDoIntervalo = todos.slice(de, ate + 1);

    for (const sid of slotsDoIntervalo) {
      const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, sid);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor
          ? new Date().toISOString().slice(0, 10)
          : null;
      }
    }

    // Registra nova âncora antes do setTimeout
    ultimoChkSlot = slotId;
    _salvarCron();

    // setTimeout: deixa o browser terminar o evento antes de atualizar o DOM
    setTimeout(() => {
      for (const sid of slotsDoIntervalo) {
        const chkEl = document.querySelector(
          `#tabela-aulas input[data-campo="${campo}"][data-slot="${sid}"]`
        );
        if (chkEl) chkEl.checked = valor;
        const tr = document.querySelector(`tr[data-slot="${sid}"]`);
        if (tr && campo === "feita") {
          const pass = getSlotsCompletos(turmaAtiva.id, bimestreAtivo)
            .find(s => s.slotId === sid)?.data < hoje();
          tr.className = valor ? "row-feita" : (pass ? "row-pendente" : "row-futura");
        }
      }
    }, 0);
    return;
  }

  // Clique simples: toggle normal + registra âncora
  toggleCampo(slotId, campo, novoValor, inputEl);
  ultimoChkSlot  = slotId;
  ultimoChkCampo = campo;
  ultimoChkValor = novoValor;
}

// Marca/desmarca todas as aulas visíveis de uma coluna
function marcarColuna(campo, valor) {
  const t = turmaAtiva;
  if (!t) return;
  const slots = getSlotsCompletos(t.id, bimestreAtivo);
  let alterou = false;
  for (const s of slots) {
    const ch = chaveSlot(t.id, bimestreAtivo, s.slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    // Para AD: ao marcar, pula aulas futuras; ao desmarcar, desmarca todas
    if (campo === "feita" && valor && s.data && s.data > hoje()) continue;
    if (estadoAulas[ch][campo] !== valor) {
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor ? new Date().toISOString().slice(0,10) : null;
      }
      alterou = true;
    }
  }
  if (alterou) { salvarTudo(); renderizarConteudo(); }
}

function toggleCampo(slotId, campo, val, inputEl) {
  if (!_autenticado) { inputEl.checked = !val; _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { inputEl.checked = !val; _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  const ch = chaveSlot(turmaAtiva.id, bimestreAtivo, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch][campo] = val;
  if (campo === "feita") {
    estadoAulas[ch].dataFeita = val ? hoje() : null;
    const tr  = document.querySelector(`tr[data-slot="${slotId}"]`);
    const reg = document.getElementById(`reg-${slotId}`);
    if (tr) {
      const slot  = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).find(s => s.slotId===slotId);
      const pass  = slot && slot.data < hoje();
      const ev    = slot?.eventual;
      const ehHoje = slot && slot.data === hoje();
      tr.className = `${ev?"row-eventual":(val?"row-feita":(pass?"row-pendente":"row-futura"))}${selConteudos.has(slotId)?" row-sel-cont":""}${ehHoje?" row-hoje":""}`;
    }
    if (reg) reg.textContent = val ? fmtData(hoje()) : "—";
    atualizarStats();
  }
  _salvarCron();
}

function atualizarStats() {
  const slots = getSlotsCompletos(turmaAtiva.id, bimestreAtivo).filter(s=>!s.eventual);
  const total = slots.length;
  let feitas  = 0;
  for (const s of slots) if (estadoAulas[chaveSlot(turmaAtiva.id,bimestreAtivo,s.slotId)]?.feita) feitas++;
  const pct = total>0 ? Math.round(feitas/total*100) : 0;
  document.querySelector(".stat-num")?.textContent && (document.querySelector(".stat-num").textContent = `${feitas}/${total}`);
  document.querySelector(".stat-prog")?.setAttribute("stroke-dasharray",`${pct},100`);
  if (document.querySelector(".pct-badge")) document.querySelector(".pct-badge").textContent = `${pct}% concluído`;
}

let ultimoSelecionado = null;

function onHandleClick(e, slotId) {
  e.preventDefault();
  e.stopPropagation();
  const todos = [...document.querySelectorAll(".drag-handle-cont[data-slot]")].map(h => h.dataset.slot);
  if (e.shiftKey && ultimoSelecionado && todos.includes(ultimoSelecionado)) {
    // Shift+clique: seleciona intervalo
    const iA = todos.indexOf(ultimoSelecionado);
    const iB = todos.indexOf(slotId);
    const [de, ate] = iA < iB ? [iA, iB] : [iB, iA];
    for (let i = de; i <= ate; i++) selConteudos.add(todos[i]);
  } else {
    // Clique simples: toggle da linha
    if (selConteudos.has(slotId)) {
      selConteudos.delete(slotId);
    } else {
      selConteudos.add(slotId);
    }
  }
  ultimoSelecionado = slotId;
  atualizarVisualizacaoSel();
}

// Clique fora da tabela ou em linha (não no handle) limpa a seleção
function _initPrevenirSelecaoShift() {
  // Impede seleção de texto na tabela ao usar shift+clique nos checkboxes
  document.addEventListener("mousedown", e => {
    if (e.shiftKey && e.target.closest(".tabela-aulas")) {
      e.preventDefault();
    }
  });
}

function _initClickFora() {
  document.addEventListener("click", e => {
    if (!selConteudos.size) return;
    const dentroTabela = e.target.closest(".tabela-aulas");
    const noHandle     = e.target.closest(".drag-handle-cont");
    if (dentroTabela && !noHandle) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    } else if (!dentroTabela) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    }
  }, true);
}

function atualizarVisualizacaoSel() {
  document.querySelectorAll(".drag-handle-cont").forEach(h => {
    h.classList.toggle("handle-sel", selConteudos.has(h.dataset.slot));
  });
  document.querySelectorAll("tr[data-slot]").forEach(tr => {
    tr.classList.toggle("row-sel-cont", selConteudos.has(tr.dataset.slot));
  });
}

function onDragStart(e, slotId) {
  if (!selConteudos.has(slotId)) { selConteudos.clear(); selConteudos.add(slotId); atualizarVisualizacaoSel(); }
  dragSrcSlots = [...selConteudos];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", slotId);
  dragSrcSlots.forEach(sid => {
    document.querySelector(`td.td-conteudo[data-slot="${sid}"]`)?.classList.add("content-dragging");
  });
}

function onDragEnd() {
  document.querySelectorAll(".content-dragging,.content-drag-over").forEach(el =>
    el.classList.remove("content-dragging","content-drag-over")
  );
  dragSrcSlots = []; dragDestSlot = null;
}

function onDragEnter(e, slotId) {
  if (dragSrcSlots.includes(slotId)) return;
  dragDestSlot = slotId;
  document.querySelector(`td.td-conteudo[data-slot="${slotId}"]`)?.classList.add("content-drag-over");
}

function onDragLeave(e) {
  const td = e.currentTarget;
  if (!td.contains(e.relatedTarget)) td.classList.remove("content-drag-over");
}

function onDrop(e, destSlotId) {
  e.preventDefault(); e.stopPropagation();
  document.querySelector(`td.td-conteudo[data-slot="${destSlotId}"]`)?.classList.remove("content-drag-over");
  if (!dragSrcSlots.length || dragSrcSlots.includes(destSlotId)) return;
  const t = turmaAtiva;
  const slots = getSlotsCompletos(t.id, bimestreAtivo);
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  function slotIdxReg(slotId) { return slotsReg.findIndex(s => s.slotId === slotId); }
  const srcIdxs = dragSrcSlots.map(slotIdxReg).filter(i => i >= 0);
  const destIdx = slotIdxReg(destSlotId);
  if (destIdx < 0 && !slots.find(s=>s.slotId===destSlotId)?.eventual) return;
  if (destIdx < 0) return;
  const novaOrdem = [...ordem];
  const srcContents = srcIdxs.map(i => ({
    contIdx: novaOrdem[i],
    editado: estadoAulas[chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId)]?.conteudoEditado
  }));
  const srcSet = new Set(srcIdxs);
  const restantes = novaOrdem.filter((_, i) => !srcSet.has(i));
  const destPosEmRestantes = restantes.indexOf(novaOrdem[destIdx]);
  const insPos = destPosEmRestantes >= 0 ? destPosEmRestantes : restantes.length;
  restantes.splice(insPos, 0, ...srcContents.map(s => s.contIdx));
  srcIdxs.forEach(i => {
    const ch = chaveSlot(t.id, bimestreAtivo, slotsReg[i].slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  let srcPtr = 0;
  for (let i = 0; i < restantes.length; i++) {
    const slotId = slotsReg[i]?.slotId;
    if (!slotId) continue;
    const origSrcIdx = srcContents.findIndex((s,j) => s.contIdx === restantes[i] && j === srcPtr);
    if (origSrcIdx >= 0 && srcContents[origSrcIdx].editado != null) {
      const ch = chaveSlot(t.id, bimestreAtivo, slotId);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch].conteudoEditado = srcContents[origSrcIdx].editado;
      srcPtr++;
    }
  }
  const chaveC2 = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const contsList = RT_CONTEUDOS[chaveC2] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  RT_CONTEUDOS[chaveC2] = restantes.map(ci => contsList[ci] ?? "");
  delete ordemConteudos[chaveOrdem(t.id, bimestreAtivo)];
  slotsReg.forEach((s) => {
    const ch = chaveSlot(t.id, bimestreAtivo, s.slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  _salvarCron();
  selConteudos.clear();
  renderizarLinhas(getSlotsCompletos(t.id, bimestreAtivo));
}

function mudarBimestre(num) {
  bimestreAtivo = num;
  selConteudos.clear();
  // Atualiza tabs de bimestre ativos
  document.querySelectorAll(".tab-bim").forEach(b => {
    b.classList.toggle("ativo", b.getAttribute("onclick")?.includes(`(${num})`));
  });
  // Re-renderiza a aba ativa (cada seção reconstrói sua própria barra de progresso)
  const aba = window._abaCronograma || "chamada";
  if (aba === "cronograma") {
    const slots = getSlotsCompletos(turmaAtiva.id, bimestreAtivo);
    renderizarLinhas(slots);
  } else if (aba === "chamada" || aba === "chamada_mobile") {
    _bimestreChamadaSel = num;
    renderizarChamadaFrequencia();
  } else if (aba === "notas") {
    _bimestreNotasSel = num;
    renderizarNotas();
  }
}

function resetarOrdem() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  if (!confirm("Restaurar ordem original dos conteúdos?")) return;
  delete ordemConteudos[chaveOrdem(turmaAtiva.id, bimestreAtivo)];
  salvarTudo(); renderizarConteudo();
}

function abrirModalEventual() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  document.getElementById("ev-data").value = hoje();
  document.getElementById("modal-eventual").style.display = "flex";
}

function fecharModalEventual() { document.getElementById("modal-eventual").style.display = "none"; }

function confirmarEventual() {
  const data = document.getElementById("ev-data").value;
  const hora = document.getElementById("ev-hora").value || "07:00";
  const desc = document.getElementById("ev-desc").value.trim();
  if (!data) { alert("Informe a data."); return; }
  const lista = getEventuais(turmaAtiva.id, bimestreAtivo);
  lista.push({ id: Date.now(), data, hora, descricao: desc });
  salvarEventuais(lista); fecharModalEventual(); renderizarConteudo();
}

function removerEventual(slotId) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const eId = parseInt(slotId.replace("e",""), 10);
  const lista = getEventuais(turmaAtiva.id, bimestreAtivo).filter(e => e.id !== eId);
  salvarEventuais(lista);
  delete estadoAulas[chaveSlot(turmaAtiva.id, bimestreAtivo, slotId)];
  salvarTudo(); renderizarConteudo();
}

function confirmarLimpar() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mostrarIndicadorSync("⛔ Somente leitura"); return; }
  const lbl = RT_BIMESTRES.find(b=>b.bimestre===bimestreAtivo)?.label;
  if (!confirm(`Apagar todos os registros do ${lbl} desta turma?`)) return;
  getSlotsCompletos(turmaAtiva.id, bimestreAtivo).forEach(s => {
    delete estadoAulas[chaveSlot(turmaAtiva.id, bimestreAtivo, s.slotId)];
  });
  salvarTudo(); selConteudos.clear(); renderizarConteudo();
}

function exportarCSV() {
  const t = turmaAtiva;
  const slots = getSlotsCompletos(t.id, bimestreAtivo);
  const chaveC = `${t.serie}_${t.disciplina}_b${bimestreAtivo}`;
  const conts = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s=>!s.eventual);
  const ordem = getOrdem(t.id, bimestreAtivo, slotsReg.length);
  let rIdx = 0;
  const linhas = [["#","Data","Horário","Conteúdos/Atividades","Chamada","Entregue","Dada?","Registro"]];
  slots.forEach((slot, i) => {
    const ch  = chaveSlot(t.id, bimestreAtivo, slot.slotId);
    const est = estadoAulas[ch] || {};
    let cont  = slot.eventual ? (slot.descricao||"") : (est.conteudoEditado ?? (conts[ordem[rIdx]]||""));
    if (!slot.eventual) rIdx++;
    const horarioFmt = slot.eventual ? slot.inicio : (slot.label ? `${slot.label} (${slot.inicio}–${slot.fim})` : slot.inicio);
    linhas.push([i+1, fmtData(slot.data), horarioFmt, cont,
      est.chamada?"Sim":"Não", est.conteudoEntregue?"Sim":"Não",
      est.feita?"Sim":"Não", est.feita?fmtData(est.dataFeita):"",
    ]);
  });
  const csv  = linhas.map(l=>l.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const lbl  = t.subtitulo?`${t.serie}${t.turma}_${t.subtitulo}`:`${t.serie}${t.turma}`;
  baixarArquivo(blob,`aulas_${lbl}_${t.sigla}_bim${bimestreAtivo}.csv`);
}

function exportarJS() {
  const ts = new Date().toLocaleString("pt-BR");

  const arquivos = [
    {
      nome: "bimestres.js",
      conteudo: [
        `// BIMESTRES.JS — Exportado em ${ts}`,
        `const BIMESTRES = ${JSON.stringify(RT_BIMESTRES,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "turmas_global.js",
      conteudo: [
        `// TURMAS_GLOBAL.JS — Turmas-base da escola — Exportado em ${ts}`,
        `const TURMAS_BASE = ${JSON.stringify(RT_CONFIG.turmasBase || TURMAS_BASE || [],null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "turmas.js",
      conteudo: [
        `// TURMAS.JS — Entradas do diário (turma + disciplina + horários) — Exportado em ${ts}`,
        `const TURMAS = ${JSON.stringify(RT_TURMAS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "conteudos.js",
      conteudo: [
        `// CONTEUDOS.JS — Conteúdos e ordem das aulas — Exportado em ${ts}`,
        `const CONTEUDOS = ${JSON.stringify(RT_CONTEUDOS,null,2)};`,
        `const ORDEM     = ${JSON.stringify(ordemConteudos,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "periodos.js",
      conteudo: [
        `// PERIODOS.JS — Horários das aulas — Exportado em ${ts}`,
        `const PERIODOS = ${JSON.stringify(RT_PERIODOS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "estado.js",
      conteudo: [
        `// ESTADO.JS — Estado das aulas (feita, chamada, AD, CH, RE) — Exportado em ${ts}`,
        `// Para restaurar: localStorage.setItem("aulaEstado_SEU_UID", JSON.stringify(ESTADO));`,
        `const ESTADO = ${JSON.stringify(estadoAulas,null,2)};`,
      ].join("\n\n"),
    },
  ];

  // Baixa um arquivo por vez com pequeno delay para não bloquear o browser
  arquivos.forEach((arq, i) => {
    setTimeout(() => {
      baixarArquivo(new Blob([arq.conteudo],{type:"application/javascript;charset=utf-8;"}), arq.nome);
    }, i * 400);
  });

  _mostrarIndicadorSync("⬇ Exportando 6 arquivos…");
}

function baixarArquivo(blob, nome) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download=nome; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  PAINEL DE GESTÃO
