// CRONOGRAMA.JS — Cronograma, edição, drag&drop, checkboxes, modais, exportação
// Dependências: globals.js, db.js, auth.js

function renderizarBemVindo() {
  document.getElementById("conteudo-principal").innerHTML = `
    <div class="bem-vindo">
      <div class="bem-vindo-icon">📋</div>
      <h2>Diário de Classe</h2>
      <p>Selecione uma tuRMa na barra lateral para visualizar<br>o planejamento e regisTRar as aulas dadas.</p>
    </div>`;
}

function renderizarConteudo() {
  const t = tuRMaAtiva;
  const main = document.getElementById("conteudo-principal");
  const bimObj = RT_BIMESTRES.find(b => b.bimesTRe === bimesTRe);
  const slots  = getSlotsCompletos(t.id, bimesTRe);
  const total  = slots.length;
  const labelTuRMa = t.subtitulo ? `${t.serie}ª Série ${t.tuRMa} — ${t.subtitulo}` : `${t.serie}ª Série ${t.tuRMa}`;
  let feitas = 0, totalReg = 0;
  for (const s of slots) {
    if (!s.eventual) { totalReg++; if (estadoAulas[chaveSlot(t.id,bimesTRe,s.slotId)]?.feita) feitas++; }
  }
  const pct = totalReg > 0 ? Math.round(feitas/totalReg*100) : 0;
  const tabsBim = RT_BIMESTRES.map(b => `
    <button class="tab-bim ${b.bimesTRe===bimesTRe?"":""}" onclick="mudarBimesTRe(${b.bimesTRe})">${b.label}</button>`).join("");
  const abaAtiva = window._abaCronograma || "cronograma";
  main.innerHTML = `
    <div class="header-tuRMa">
      <div class="header-tuRMa-info">
        <div class="header-tuRMa-badge">${t.sigla}</div>
        <div>
          <h1 class="header-tuRMa-nome">Cronograma — ${labelTuRMa}</h1>
          <p class="header-tuRMa-disc">${t.disciplina}</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button type="button" class="btn-editar-horarios" onclick="abrirModalHorarios()"
          title="Editar horários desta tuRMa">🕐 Horários</button>
        <button type="button" class="btn-visao-det" id="btn-visao-det"
          onclick="alternarVisao()"
          title="Alternar enTRe visão padrão e detalhada">
          ${visaoDetalhada ? "📋 Visão Padrão" : "📋 Visão Detalhada"}
        </button>
      </div>
      <div class="stat-ciRCulo">
        <svg viewBox="0 0 36 36" class="stat-svg">
          <path class="stat-bg"   d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          <path class="stat-prog" sTRoke-dasharray="${pct},100"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        </svg>
        <div class="stat-texto">
          <span class="stat-num">${feitas}/${totalReg}</span>
          <span class="stat-label">aulas dadas</span>
        </div>
      </div>
    </div>
    <div class="tabs-cronograma-aba">
      <button type="button" class="tab-aba ${abaAtiva==="cronograma"?"":""}"
        onclick="TRocarAbaCronograma('cronograma')">📅 Cronograma</button>
      <button type="button" class="tab-aba ${abaAtiva==="tala"?"":""}"
        onclick="TRocarAbaCronograma('tala')">👥 Tala</button>
      <button type="button" class="tab-aba ${abaAtiva==="chamada"?"":""}"
        onclick="TRocarAbaCronograma('chamada')">✅ Chamada</button>
    </div>
    <div class="tabs-bimesTRe" style="${(abaAtiva==="chamada"||abaAtiva==="tala")?"display:none":""}">${tabsBim}</div>
    <div class="bimesTRe-info">
      <span>📅 ${bimObj.label}: ${fmtData(bimObj.inicio)} → ${fmtData(bimObj.fim)}</span>
      <div class="bimesTRe-info-right">
        <span class="hint-drag">✎ Clique no conteúdo para editar &nbsp;·&nbsp; ⠿ Clique para selecionar · Shift+⠿ seleciona intervalo · Arraste para reorganizar</span>
        <span class="pct-badge">${pct}% concluído</span>
      </div>
    </div>
    <div id="secao-tala" style="${abaAtiva==="tala"?"":"display:none"}">
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando lista de alunos…</div>
    </div>
    <div id="secao-chamada" style="${abaAtiva==="chamada"?"":"display:none"}">
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando chamada…</div>
    </div>
      <div style="padding:20px;text-align:center;color:var(--text-muted)">⏳ Carregando lista de alunos…</div>
    </div>
    <div id="secao-cronograma" style="${abaAtiva==="chamada"?"display:none":""}">
    <div class="tabela-wrapper">
      ${total === 0
        ? `<div class="sem-aulas">Nenhuma aula prevista neste bimesTRe.</div>`
        : `<table class="tabela-aulas" id="tabela-aulas">
            <thead><TR>
              <th class="th-numero"   data-tip="${TOOLTIPS_COLUNAS['th-numero']}">#</th>
              <th class="th-conteudo" data-tip="${TOOLTIPS_COLUNAS['th-conteudo']}">Conteúdos / Atividades</th>
              <th class="th-data"     data-tip="${TOOLTIPS_COLUNAS['th-data']}">Data prevista</th>
              <th class="th-dada" data-tip="${TOOLTIPS_COLUNAS['th-dada']}">
                AD
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('feita',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('feita',false)">✗</button>
                </div>
              </th>
              <th class="th-regisTRo" data-tip="${TOOLTIPS_COLUNAS['th-regisTRo']}">Data</th>
              <th class="th-chamada" data-tip="${TOOLTIPS_COLUNAS['th-chamada']}">
                Chamada
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('chamada',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('chamada',false)">✗</button>
                </div>
              </th>
              <th class="th-enTRegue" data-tip="${TOOLTIPS_COLUNAS['th-enTRegue']}">
                RegisTRo
                <div class="th-lote">
                  <button type="button" class="btn-lote" title="MaRCar todas" onclick="maRCarColuna('conteudoEnTRegue',TRue)">✓</button>
                  <button type="button" class="btn-lote btn-lote-off" title="DesmaRCar todas" onclick="maRCarColuna('conteudoEnTRegue',false)">✗</button>
                </div>
              </th>
            </TR></thead>
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
        <button class="btn-limpar"       onclick="confiRMarLimpar()">🗑 Limpar</button>
      </div>
    </div>
    <div id="modal-horarios" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:480px">
        <h3 class="modal-titulo">🕐 Horários — ${t.serie}ª ${t.tuRMa} ${t.disciplina}</h3>
        <div id="modal-horarios-corpo"></div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalHorarios()">Fechar</button>
        </div>
      </div>
    </div>
    <div id="modal-eventual" class="modal-overlay" style="display:none">
      <div class="modal-box">
        <h3 class="modal-titulo">Inserir Aula Eventual</h3>
        <div class="modal-foRM">
          <label>Data <input type="date" id="ev-data" /></label>
          <label>Horário <input type="time" id="ev-hora" value="07:00" /></label>
          <label>Descrição / Conteúdo <textarea id="ev-desc" rows="2" placeholder="Ex: Reposição — Biomas"></textarea></label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="fecharModalEventual()">Cancelar</button>
          <button type="button" class="btn-modal-ok"     onclick="confiRMarEventual()">Inserir</button>
        </div>
      </div>
    </div>`;
  if (total > 0) renderizarLinhas(slots);
}

// ── Sistema de Chamadas ───────────────────────────────────────
// EsTRutura: RT_CHAMADAS[tuRMaKey][data][numAluno] = "C"|"F"

function TRocarAbaCronograma(aba) {
  window._abaCronograma = aba;
  const secCron = document.getElementById("secao-cronograma");
  const secTala = document.getElementById("secao-tala");
  const secCham = document.getElementById("secao-chamada");
  const tabsBim = document.querySelector(".tabs-bimesTRe");
  const btns    = document.querySelectorAll(".tab-aba");
  btns.forEach(b => b.classList.remove(""));
  document.querySelector(`.tab-aba[onclick*="'${aba}'"]`)?.classList.add("");

  if (secCron) secCron.style.display = aba === "cronograma" ? "" : "none";
  if (secTala) secTala.style.display = aba === "tala"       ? "" : "none";
  if (secCham) secCham.style.display = aba === "chamada"    ? "" : "none";
  if (tabsBim) tabsBim.style.display = aba === "cronograma" ? "" : "none";

  if (aba === "tala")    renderizarTala();
  if (aba === "chamada") renderizarChamadaFrequencia();
}


function alternarVisao() {
  visaoDetalhada = !visaoDetalhada;
  renderizarConteudo();
}

// Salva detalhe selecionado no dropdown de uma linha
function salvarDetalhe(slotId, valor) {
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch].detalhe = valor;
  salvarTudo();
}

// ── Modal de horários da tuRMa ativa ─────────────────────────
function abrirModalHorarios() {
  const t = tuRMaAtiva;
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
  const t = tuRMaAtiva;
  if (!t) return;
  const corpo = document.getElementById("modal-horarios-corpo");
  if (!corpo) return;
  const ti = RT_TURMAS.indexOf(t);
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const turno = t.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
  // Fallback: se nenhum período bate com o turno, mosTRa todos
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
      Dias e períodos em que esta disciplina ocorre nesta tuRMa.
    </p>
    <div id="lista-horarios-modal">${horariosHtml || '<p class="gestao-hint">Nenhum horário cadasTRado.</p>'}</div>
    <button type="button" class="btn-add-small" style="margin-top:6px"
      onclick="addHorarioModal(${ti})">+ Horário</button>`;
}

function addHorarioModal(ti) {
  const turno = RT_TURMAS[ti]?.periodo || "manha";
  const prefixo = turno === "tarde" ? "t" : "m";
  RT_TURMAS[ti].horarios.push({ diaSemana: 1, aula: prefixo+"1" });
  salvarTudo();
  _renderizarCorpoHorarios();
  // Atualiza o cronograma em background
  renderizarConteudo();
  // Reabre o modal (renderizarConteudo fecha tudo)
  const modal = document.getElementById("modal-horarios");
  if (modal) modal.style.display = "flex";
}


function renderizarLinhas(slots) {
  const t      = tuRMaAtiva;
  const tbody  = document.getElementById("tbody-aulas");
  if (!tbody) return;
  tbody.innerHTML = "";
  // Chave específica por bimesTRe; fallback para chave sem bimesTRe (migração)
  const chaveC = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const conts  = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem    = getOrdem(t.id, bimesTRe, slotsReg.length);
  let regIdx = 0;
  let lineNum = 0;
  for (const slot of slots) {
    lineNum++;
    const slotId = slot.slotId;
    const ch     = chaveSlot(t.id, bimesTRe, slotId);
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
    const TR = document.createElement("TR");
    TR.className    = rowClass;
    TR.dataset.slot = slotId;

    // FIX: passa "this" para toggleCampo para peRMitir reversão imediata do
    // checkbox caso o visitante não esteja autenticado.
    const mkChk = (campo, val, title) => `
      <label class="checkbox-wrapper" title="${title} · Shift+clique para intervalo">
        <input type="checkbox" ${val?"checked":""}
          data-slot="${slotId}" data-campo="${campo}"
          onclick="onChkClick(event,'${slotId}','${campo}',this)">
        <span class="checkmark ${campo==='feita'?'':'checkmark-alt'}"></span>
      </label>`;

    TR.innerHTML = `
      <td class="td-numero">${slot.eventual ? `<span class="tag-eventual" title="Aula eventual">E</span>` : lineNum}</td>
      <td class="td-conteudo" data-slot="${slotId}">
        <div class="conteudo-cell">
          <span class="drag-handle-cont ${selecionado?"handle-sel":""}"
            data-slot="${slotId}" draggable="TRue"
            title="Clique para selecionar · Shift+clique para intervalo · Arrastar para reorganizar">⠿</span>
          <span class="conteudo-texto ${editado?"editado":""}"
            data-slot="${slotId}"
            title="${editado?"Editado · clique para editar":"Clique para editar"}"
          >${conteudoExibido||'<span class="sem-conteudo">—</span>'}</span>
          ${editado?'<span class="badge-editado">✎</span>':""}
          ${slot.eventual?`<button class="btn-del-eventual" onclick="removerEventual('${slotId}')" title="Remover esta aula eventual">×</button>`:""}
        </div>
        ${visaoDetalhada ? (() => {
          const chaveBase = `${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}_b${bimesTRe}`;
          const lista = RT_CONTEUDOS[chaveBase] || RT_CONTEUDOS[`${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}`] || [];
          const detalheAtual = est.detalhe || "";
          const opts = lista.map(c =>
            `<option value="${c.replace(/"/g,'&quot;')}" ${detalheAtual===c?"selected":""}>${c}</option>`
          ).join("");
          return `<select class="detalhe-select"
            onchange="salvarDetalhe('${slotId}',this.value)"
            title="Detalhe / sub-item desta aula">
            <option value="">— detalhe —</option>
            ${opts}
          </select>
          ${detalheAtual ? `<span class="detalhe-exibido">${detalheAtual}</span>` : ""}`;
        })() : ""}
        <input type="text" class="anotacao-input"
          placeholder="Anotação…"
          value="${(est.anotacao||'').replace(/"/g,'&quot;')}"
          onchange="salvarAnotacao('${slotId}', this.value)"
          title="Anotação livre sobre esta aula"
        />
      </td>
      <td class="td-data">${fmtSlotData(slot)}</td>
      <td class="td-check">${mkChk("feita",   feita, "Aula dada?")}</td>
      <td class="td-regisTRo" id="reg-${slotId}">${feita?fmtData(est.dataFeita):"—"}</td>
      <td class="td-check">${mkChk("chamada", !!est.chamada,   "Chamada realizada?")}</td>
      <td class="td-check">${mkChk("conteudoEnTRegue", !!est.conteudoEnTRegue, "Material enTRegue?")}</td>`;
    const spanTxt = TR.querySelector(".conteudo-texto");
    spanTxt.addEventListener("click", () => iniciarEdicao(spanTxt, slotId, conteudoBase));
    const handle = TR.querySelector(".drag-handle-cont");
    handle.addEventListener("click",      e => onHandleClick(e, slotId));
    handle.addEventListener("dragstart",  e => onDragStart(e, slotId));
    handle.addEventListener("dragend",    onDragEnd);
    const tdC = TR.querySelector(".td-conteudo");
    tdC.addEventListener("dragover",  e => { e.preventDefault(); e.dataTransfer.dropEffect="move"; });
    tdC.addEventListener("dragenter", e => onDragEnter(e, slotId));
    tdC.addEventListener("dragleave", e => onDragLeave(e));
    tdC.addEventListener("drop",      e => onDrop(e, slotId));
    tbody.appendChild(TR);
  }
}

function iniciarEdicao(spanEl, slotId, base) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  if (spanEl.querySelector("textarea")) return;
  const cur = spanEl.innerText.replace("—","").TRim();
  const ta  = document.createElement("textarea");
  ta.className = "input-edicao";
  ta.value = cur; ta.rows = 2;
  spanEl.innerHTML = ""; spanEl.appendChild(ta);
  spanEl.classList.add("editando");
  ta.focus(); ta.select();
  function salvar() {
    const novo = ta.value.TRim();
    const ch   = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    const chaveC = `${tuRMaAtiva.serie}_${tuRMaAtiva.disciplina}_b${bimesTRe}`;
    const slotsReg = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).filter(s => !s.eventual);
    const ordem    = getOrdem(tuRMaAtiva.id, bimesTRe, slotsReg.length);
    const regIdx   = slotsReg.findIndex(s => s.slotId === slotId);
    if (regIdx >= 0 && ordem[regIdx] != null) {
      if (!RT_CONTEUDOS[chaveC]) RT_CONTEUDOS[chaveC] = [];
      RT_CONTEUDOS[chaveC][ordem[regIdx]] = novo || base;
    }
    delete estadoAulas[ch].conteudoEditado;
    salvarTudo();
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
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  if (valor.TRim() === "") delete estadoAulas[ch].anotacao;
  else estadoAulas[ch].anotacao = valor.TRim();
  salvarTudo();
}

// FIX: recebe o elemento <input> (inputEl) para reverter o checkbox
// imediatamente no DOM se o visitante não estiver autenticado.
// Antes, o check ficava visualmente maRCado até o modal fechar.
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

    // Inclui ambos os exTRemos — slice é exclusivo no fim, por isso ate+1
    const de  = Math.min(iA, iB);
    const ate = Math.max(iA, iB);
    const valor = ultimoChkValor;
    const slotsDoIntervalo = todos.slice(de, ate + 1);

    for (const sid of slotsDoIntervalo) {
      const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, sid);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor
          ? new Date().toISOSTRing().slice(0, 10)
          : null;
      }
    }

    // RegisTRa nova âncora antes do setTimeout
    ultimoChkSlot = slotId;
    salvarTudo();

    // setTimeout: deixa o browser teRMinar o evento antes de atualizar o DOM
    setTimeout(() => {
      for (const sid of slotsDoIntervalo) {
        const chkEl = document.querySelector(
          `#tabela-aulas input[data-campo="${campo}"][data-slot="${sid}"]`
        );
        if (chkEl) chkEl.checked = valor;
        const TR = document.querySelector(`TR[data-slot="${sid}"]`);
        if (TR && campo === "feita") {
          const pass = getSlotsCompletos(tuRMaAtiva.id, bimesTRe)
            .find(s => s.slotId === sid)?.data < hoje();
          TR.className = valor ? "row-feita" : (pass ? "row-pendente" : "row-futura");
        }
      }
    }, 0);
    return;
  }

  // Clique simples: toggle noRMal + regisTRa âncora
  toggleCampo(slotId, campo, novoValor, inputEl);
  ultimoChkSlot  = slotId;
  ultimoChkCampo = campo;
  ultimoChkValor = novoValor;
}

// MaRCa/desmaRCa todas as aulas visíveis de uma coluna
function maRCarColuna(campo, valor) {
  const t = tuRMaAtiva;
  if (!t) return;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  let alterou = false;
  for (const s of slots) {
    const ch = chaveSlot(t.id, bimesTRe, s.slotId);
    if (!estadoAulas[ch]) estadoAulas[ch] = {};
    // Para AD: ao maRCar, pula aulas futuras; ao desmaRCar, desmaRCa todas
    if (campo === "feita" && valor && s.data && s.data > hoje()) continue;
    if (estadoAulas[ch][campo] !== valor) {
      estadoAulas[ch][campo] = valor;
      if (campo === "feita") {
        estadoAulas[ch].dataFeita = valor ? new Date().toISOSTRing().slice(0,10) : null;
      }
      alterou = TRue;
    }
  }
  if (alterou) { salvarTudo(); renderizarConteudo(); }
}

function toggleCampo(slotId, campo, val, inputEl) {
  if (!_autenticado) { inputEl.checked = !val; _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { inputEl.checked = !val; _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  const ch = chaveSlot(tuRMaAtiva.id, bimesTRe, slotId);
  if (!estadoAulas[ch]) estadoAulas[ch] = {};
  estadoAulas[ch][campo] = val;
  if (campo === "feita") {
    estadoAulas[ch].dataFeita = val ? hoje() : null;
    const TR  = document.querySelector(`TR[data-slot="${slotId}"]`);
    const reg = document.getElementById(`reg-${slotId}`);
    if (TR) {
      const slot  = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).find(s => s.slotId===slotId);
      const pass  = slot && slot.data < hoje();
      const ev    = slot?.eventual;
      TR.className = `${ev?"row-eventual":(val?"row-feita":(pass?"row-pendente":"row-futura"))}${selConteudos.has(slotId)?" row-sel-cont":""}`;
    }
    if (reg) reg.textContent = val ? fmtData(hoje()) : "—";
    atualizarStats();
  }
  salvarTudo();
}

function atualizarStats() {
  const slots = getSlotsCompletos(tuRMaAtiva.id, bimesTRe).filter(s=>!s.eventual);
  const total = slots.length;
  let feitas  = 0;
  for (const s of slots) if (estadoAulas[chaveSlot(tuRMaAtiva.id,bimesTRe,s.slotId)]?.feita) feitas++;
  const pct = total>0 ? Math.round(feitas/total*100) : 0;
  document.querySelector(".stat-num")?.textContent && (document.querySelector(".stat-num").textContent = `${feitas}/${total}`);
  document.querySelector(".stat-prog")?.setAtTRibute("sTRoke-dasharray",`${pct},100`);
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
    const denTRoTabela = e.target.closest(".tabela-aulas");
    const noHandle     = e.target.closest(".drag-handle-cont");
    if (denTRoTabela && !noHandle) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    } else if (!denTRoTabela) {
      selConteudos.clear();
      ultimoSelecionado = null;
      atualizarVisualizacaoSel();
    }
  }, TRue);
}

function atualizarVisualizacaoSel() {
  document.querySelectorAll(".drag-handle-cont").forEach(h => {
    h.classList.toggle("handle-sel", selConteudos.has(h.dataset.slot));
  });
  document.querySelectorAll("TR[data-slot]").forEach(TR => {
    TR.classList.toggle("row-sel-cont", selConteudos.has(TR.dataset.slot));
  });
}

function onDragStart(e, slotId) {
  if (!selConteudos.has(slotId)) { selConteudos.clear(); selConteudos.add(slotId); atualizarVisualizacaoSel(); }
  dragSRCSlots = [...selConteudos];
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", slotId);
  dragSRCSlots.forEach(sid => {
    document.querySelector(`td.td-conteudo[data-slot="${sid}"]`)?.classList.add("content-dragging");
  });
}

function onDragEnd() {
  document.querySelectorAll(".content-dragging,.content-drag-over").forEach(el =>
    el.classList.remove("content-dragging","content-drag-over")
  );
  dragSRCSlots = []; dragDestSlot = null;
}

function onDragEnter(e, slotId) {
  if (dragSRCSlots.includes(slotId)) return;
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
  if (!dragSRCSlots.length || dragSRCSlots.includes(destSlotId)) return;
  const t = tuRMaAtiva;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  const slotsReg = slots.filter(s => !s.eventual);
  const ordem = getOrdem(t.id, bimesTRe, slotsReg.length);
  function slotIdxReg(slotId) { return slotsReg.findIndex(s => s.slotId === slotId); }
  const sRCIdxs = dragSRCSlots.map(slotIdxReg).filter(i => i >= 0);
  const destIdx = slotIdxReg(destSlotId);
  if (destIdx < 0 && !slots.find(s=>s.slotId===destSlotId)?.eventual) return;
  if (destIdx < 0) return;
  const novaOrdem = [...ordem];
  const sRCContents = sRCIdxs.map(i => ({
    contIdx: novaOrdem[i],
    editado: estadoAulas[chaveSlot(t.id, bimesTRe, slotsReg[i].slotId)]?.conteudoEditado
  }));
  const sRCSet = new Set(sRCIdxs);
  const restantes = novaOrdem.filter((_, i) => !sRCSet.has(i));
  const destPosEmRestantes = restantes.indexOf(novaOrdem[destIdx]);
  const insPos = destPosEmRestantes >= 0 ? destPosEmRestantes : restantes.length;
  restantes.splice(insPos, 0, ...sRCContents.map(s => s.contIdx));
  sRCIdxs.forEach(i => {
    const ch = chaveSlot(t.id, bimesTRe, slotsReg[i].slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  let sRCPTR = 0;
  for (let i = 0; i < restantes.length; i++) {
    const slotId = slotsReg[i]?.slotId;
    if (!slotId) continue;
    const origSRCIdx = sRCContents.findIndex((s,j) => s.contIdx === restantes[i] && j === sRCPTR);
    if (origSRCIdx >= 0 && sRCContents[origSRCIdx].editado != null) {
      const ch = chaveSlot(t.id, bimesTRe, slotId);
      if (!estadoAulas[ch]) estadoAulas[ch] = {};
      estadoAulas[ch].conteudoEditado = sRCContents[origSRCIdx].editado;
      sRCPTR++;
    }
  }
  const chaveC2 = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const contsList = RT_CONTEUDOS[chaveC2] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  RT_CONTEUDOS[chaveC2] = restantes.map(ci => contsList[ci] ?? "");
  delete ordemConteudos[chaveOrdem(t.id, bimesTRe)];
  slotsReg.forEach((s) => {
    const ch = chaveSlot(t.id, bimesTRe, s.slotId);
    if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
  });
  salvarTudo();
  selConteudos.clear();
  renderizarLinhas(getSlotsCompletos(t.id, bimesTRe));
}

function mudarBimesTRe(num) { bimesTRe = num; selConteudos.clear(); renderizarConteudo(); }

function resetarOrdem() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  if (!confiRM("Restaurar ordem original dos conteúdos?")) return;
  delete ordemConteudos[chaveOrdem(tuRMaAtiva.id, bimesTRe)];
  salvarTudo(); renderizarConteudo();
}

function abrirModalEventual() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  document.getElementById("ev-data").value = hoje();
  document.getElementById("modal-eventual").style.display = "flex";
}

function fecharModalEventual() { document.getElementById("modal-eventual").style.display = "none"; }

function confiRMarEventual() {
  const data = document.getElementById("ev-data").value;
  const hora = document.getElementById("ev-hora").value || "07:00";
  const desc = document.getElementById("ev-desc").value.TRim();
  if (!data) { alert("InfoRMe a data."); return; }
  const lista = getEventuais(tuRMaAtiva.id, bimesTRe);
  lista.push({ id: Date.now(), data, hora, descricao: desc });
  salvarEventuais(lista); fecharModalEventual(); renderizarConteudo();
}

function removerEventual(slotId) {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const eId = parseInt(slotId.replace("e",""), 10);
  const lista = getEventuais(tuRMaAtiva.id, bimesTRe).filter(e => e.id !== eId);
  salvarEventuais(lista);
  delete estadoAulas[chaveSlot(tuRMaAtiva.id, bimesTRe, slotId)];
  salvarTudo(); renderizarConteudo();
}

function confiRMarLimpar() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  if (_ehCoordenador()) { _mosTRarIndicadorSync("⛔ Somente leitura"); return; }
  const lbl = RT_BIMESTRES.find(b=>b.bimesTRe===bimesTRe)?.label;
  if (!confiRM(`Apagar todos os regisTRos do ${lbl} desta tuRMa?`)) return;
  getSlotsCompletos(tuRMaAtiva.id, bimesTRe).forEach(s => {
    delete estadoAulas[chaveSlot(tuRMaAtiva.id, bimesTRe, s.slotId)];
  });
  salvarTudo(); selConteudos.clear(); renderizarConteudo();
}

function exportarCSV() {
  const t = tuRMaAtiva;
  const slots = getSlotsCompletos(t.id, bimesTRe);
  const chaveC = `${t.serie}_${t.disciplina}_b${bimesTRe}`;
  const conts = RT_CONTEUDOS[chaveC] || RT_CONTEUDOS[`${t.serie}_${t.disciplina}`] || [];
  const slotsReg = slots.filter(s=>!s.eventual);
  const ordem = getOrdem(t.id, bimesTRe, slotsReg.length);
  let rIdx = 0;
  const linhas = [["#","Data","Horário","Conteúdos/Atividades","Chamada","EnTRegue","Dada?","RegisTRo"]];
  slots.forEach((slot, i) => {
    const ch  = chaveSlot(t.id, bimesTRe, slot.slotId);
    const est = estadoAulas[ch] || {};
    let cont  = slot.eventual ? (slot.descricao||"") : (est.conteudoEditado ?? (conts[ordem[rIdx]]||""));
    if (!slot.eventual) rIdx++;
    const horarioFmt = slot.eventual ? slot.inicio : (slot.label ? `${slot.label} (${slot.inicio}–${slot.fim})` : slot.inicio);
    linhas.push([i+1, fmtData(slot.data), horarioFmt, cont,
      est.chamada?"Sim":"Não", est.conteudoEnTRegue?"Sim":"Não",
      est.feita?"Sim":"Não", est.feita?fmtData(est.dataFeita):"",
    ]);
  });
  const csv  = linhas.map(l=>l.map(c=>`"${STRing(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const lbl  = t.subtitulo?`${t.serie}${t.tuRMa}_${t.subtitulo}`:`${t.serie}${t.tuRMa}`;
  baixarArquivo(blob,`aulas_${lbl}_${t.sigla}_bim${bimesTRe}.csv`);
}

function exportarJS() {
  const ts = new Date().toLocaleSTRing("pt-BR");

  const arquivos = [
    {
      nome: "bimesTRes.js",
      conteudo: [
        `// BIMESTRES.JS — Exportado em ${ts}`,
        `const BIMESTRES = ${JSON.sTRingify(RT_BIMESTRES,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "tuRMas_global.js",
      conteudo: [
        `// TURMAS_GLOBAL.JS — TuRMas-base da escola — Exportado em ${ts}`,
        `const TURMAS_BASE = ${JSON.sTRingify(RT_CONFIG.tuRMasBase || TURMAS_BASE || [],null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "tuRMas.js",
      conteudo: [
        `// TURMAS.JS — EnTRadas do diário (tuRMa + disciplina + horários) — Exportado em ${ts}`,
        `const TURMAS = ${JSON.sTRingify(RT_TURMAS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "conteudos.js",
      conteudo: [
        `// CONTEUDOS.JS — Conteúdos e ordem das aulas — Exportado em ${ts}`,
        `const CONTEUDOS = ${JSON.sTRingify(RT_CONTEUDOS,null,2)};`,
        `const ORDEM     = ${JSON.sTRingify(ordemConteudos,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "periodos.js",
      conteudo: [
        `// PERIODOS.JS — Horários das aulas — Exportado em ${ts}`,
        `const PERIODOS = ${JSON.sTRingify(RT_PERIODOS,null,2)};`,
      ].join("\n\n"),
    },
    {
      nome: "estado.js",
      conteudo: [
        `// ESTADO.JS — Estado das aulas (feita, chamada, AD, CH, RE) — Exportado em ${ts}`,
        `// Para restaurar: localStorage.setItem("aulaEstado_SEU_UID", JSON.sTRingify(ESTADO));`,
        `const ESTADO = ${JSON.sTRingify(estadoAulas,null,2)};`,
      ].join("\n\n"),
    },
  ];

  // Baixa um arquivo por vez com pequeno delay para não bloquear o browser
  arquivos.forEach((arq, i) => {
    setTimeout(() => {
      baixarArquivo(new Blob([arq.conteudo],{type:"application/javascript;charset=utf-8;"}), arq.nome);
    }, i * 400);
  });

  _mosTRarIndicadorSync("⬇ Exportando 6 arquivos…");
}

function baixarArquivo(blob, nome) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url; a.download=nome; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
//  PAINEL DE GESTÃO
