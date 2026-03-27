// GESTAO-PROFESSOR.JS — Painel do Professor: minhas turmas, conteúdos
// Dependências: app-core.js

function _disciplinasDaSerie(serie) {
  const areas = RT_CONFIG.disciplinasPorSerie?.[serie] || {};
  const set = new Set();
  for (const lista of Object.values(areas)) {
    for (const d of lista) if (d) set.add(d);
  }
  if (!set.size) {
    const todas = RT_CONFIG.disciplinasPorSerie || {};
    for (const s of Object.values(todas))
      for (const lista of Object.values(s))
        for (const d of lista) if (d) set.add(d);
  }
  return [...set].sort();
}

// Cache de horários globais
let _horariosGlobaisCache = null;

async function _carregarHorariosGlobais() {
  if (_horariosGlobaisCache) return _horariosGlobaisCache;
  const cache = {};
  try {
    const db   = firebase.firestore();
    const snap = await db.collection("professores").where("status","==","aprovado").get();
    for (const doc of snap.docs) {
      if (_isAdmin(doc.data().email)) continue;
      const uid = doc.id;
      const diarioSnap = await db.collection("diario").doc(uid).get();
      if (!diarioSnap.exists) continue;
      const d = diarioSnap.data();
      if (!d.RT_TURMAS) continue;
      const turmas = JSON.parse(d.RT_TURMAS);
      for (const t of turmas) {
        for (const h of (t.horarios || [])) {
          const chave = `${h.diaSemana}_${h.aula}`;
          if (!cache[chave]) cache[chave] = [];
          cache[chave].push({ disciplina: t.disciplina, sigla: t.sigla, serie: t.serie, turma: t.turma, profUid: uid });
        }
      }
    }
  } catch(e) { console.warn("Erro ao carregar horários globais:", e); }
  _horariosGlobaisCache = cache;
  return cache;
}

function _invalidarHorariosCache() { _horariosGlobaisCache = null; }

// ════════════════════════════════════════════════════════════════
// ABA: MINHAS TURMAS
// Sub-aba 1 — "Associar nova turma" (grade de horários)
// Sub-aba 2 — "Ver minhas turmas"   (lista com checkboxes e remoção)
// ════════════════════════════════════════════════════════════════

let _profSelAssoc    = new Set();  // Set de turmaId selecionados
let _gradeTurmaSel   = null;       // Turma selecionada nos filtros
let _gradeModalDia   = null;
let _gradeModalAula  = null;
let _profSubAba      = "ver";      // "associar" | "ver"

async function htmlProfTurmas() {
  _injetarCSSAssoc();

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const minhasTurmas = RT_TURMAS.filter(t => t.profUid === uid || t.profUid === profUid);

  // Sub-abas
  const subTabs = `
    <div class="prof-sub-tabs">
      <button type="button"
        class="prof-sub-tab ${_profSubAba === "associar" ? "ativo" : ""}"
        onclick="_profMudarSubAba('associar')">
        ➕ Associar nova turma
      </button>
      <button type="button"
        class="prof-sub-tab ${_profSubAba === "ver" ? "ativo" : ""}"
        onclick="_profMudarSubAba('ver')">
        📋 Ver minhas turmas
        ${minhasTurmas.length > 0
          ? `<span class="prof-sub-badge">${minhasTurmas.length}</span>`
          : ""}
      </button>
    </div>`;

  const conteudo = _profSubAba === "associar"
    ? await _htmlSubAbaAssociar(uid, profUid)
    : _htmlSubAbaVer(minhasTurmas, profUid, uid);

  return `
    ${subTabs}
    <div id="prof-subaba-conteudo">
      ${conteudo}
    </div>

    <!-- Modal: registrar disciplina num horário vazio -->
    <div id="modal-grade-aula" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:380px">
        <h3 class="modal-titulo">🕐 Adicionar aula</h3>
        <p id="modal-grade-subtitulo" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px"></p>
        <div class="modal-form">
          <label>Disciplina que você ministra nesta turma
            <select class="gi" id="modal-grade-disc" style="margin-top:4px"></select>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel"
            onclick="document.getElementById('modal-grade-aula').style.display='none'">Cancelar</button>
          <button type="button" class="btn-modal-ok" onclick="profConfirmarHorario()">Adicionar</button>
        </div>
      </div>
    </div>`;
}

// ── Troca de sub-aba sem re-render total ──────────────────────
async function _profMudarSubAba(aba) {
  _profSubAba = aba;

  // Atualiza visual das abas
  document.querySelectorAll(".prof-sub-tab").forEach(b =>
    b.classList.toggle("ativo", b.textContent.includes(aba === "associar" ? "Associar" : "Ver"))
  );

  const cont = document.getElementById("prof-subaba-conteudo");
  if (!cont) return;

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");

  cont.innerHTML = `<div style="padding:20px;color:var(--text-muted)">⏳ Carregando…</div>`;

  if (aba === "associar") {
    cont.innerHTML = await _htmlSubAbaAssociar(uid, profUid);
  } else {
    const minhasTurmas = RT_TURMAS.filter(t => t.profUid === uid || t.profUid === profUid);
    cont.innerHTML = _htmlSubAbaVer(minhasTurmas, profUid, uid);
  }
}

// ── Sub-aba 1: Associar nova turma ────────────────────────────
async function _htmlSubAbaAssociar(uid, profUid) {
  const horariosGlobais = await _carregarHorariosGlobais();

  const base   = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const niveis = [...new Set(base.map(t => t.nivel))].sort();

  const nivelOpts = `<option value="">— selecione —</option>` +
    niveis.map(n =>
      `<option value="${n}">${n === "medio" ? "Ensino Médio" : "Ensino Fundamental"}</option>`
    ).join("");

  const DIAS = [
    { idx:1, label:"Segunda" },
    { idx:2, label:"Terça"   },
    { idx:3, label:"Quarta"  },
    { idx:4, label:"Quinta"  },
    { idx:5, label:"Sexta"   },
  ];

  const gradeHtml = _gradeTurmaSel
    ? _renderGradeTurma(_gradeTurmaSel, uid, profUid, DIAS, horariosGlobais)
    : `<div class="assoc-vazio" style="min-height:110px">
        <span style="font-size:1.5rem">👆</span>
        <p>Selecione nível, série e turma para ver os horários disponíveis.<br>
           Clique numa célula <strong style="color:#0d9488">+</strong> para registrar sua disciplina.</p>
       </div>`;

  return `
    <div class="gestao-bloco">
      <p class="gestao-hint" style="margin-bottom:16px">
        Escolha a turma nos filtros abaixo. Células <strong>âmbar</strong> já têm aulas suas,
        <span style="color:#64748b;font-weight:600">cinza</span> são de outro professor,
        e <strong style="color:#0d9488">+</strong> estão livres para você.
      </p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:20px">
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Nível
          <select class="gi" id="filtro-nivel" onchange="profFiltrarSeries()"
            style="display:block;margin-top:4px;min-width:160px">
            ${nivelOpts}
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)" id="filtro-serie-wrap">
          <span id="filtro-serie-label">Série / Ano</span>
          <select class="gi" id="filtro-serie" onchange="profFiltrarTurmasOpts()"
            style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Turma
          <select class="gi" id="filtro-turma" onchange="profSelecionarTurma()"
            style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
      </div>
      <div id="grade-turma-container">${gradeHtml}</div>
    </div>`;
}

// ── Sub-aba 2: Ver minhas turmas ──────────────────────────────
function _htmlSubAbaVer(minhasTurmas, profUid, uid) {
  const DIAS_FULL = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  return `
    <div class="gestao-bloco">
      <div id="assoc-prof-container">
        ${_buildAssocHtml(minhasTurmas, profUid, uid, DIAS_FULL)}
      </div>
    </div>`;
}

// ── Builder do HTML de associações ───────────────────────────

function _buildAssocHtml(minhasTurmas, profUid, uid, DIAS_FULL) {
  if (!DIAS_FULL) DIAS_FULL = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

  const _aulaLabel = (aula) => {
    const p = RT_PERIODOS.find(x => x.aula === aula);
    return p ? `${aula.replace(/[mt]/,"")}ª (${p.inicio})` : aula;
  };
  const _periodoLabel = (p) => p === "tarde" ? "🌇 Tarde" : "🌅 Manhã";

  if (minhasTurmas.length === 0) {
    return `<div class="assoc-vazio">
      <span style="font-size:2rem">📭</span>
      <p>Você ainda não tem nenhuma disciplina associada a turmas.<br>
         Use a seção abaixo para adicionar horários.</p>
    </div>`;
  }

  // Agrupa por série+turma
  const grupos = {};
  for (const t of minhasTurmas) {
    const key = `${t.serie}|${t.turma}|${t.subtitulo||""}`;
    if (!grupos[key]) grupos[key] = { serie: t.serie, turma: t.turma, subtitulo: t.subtitulo||"", periodo: t.periodo||"manha", discs: [] };
    grupos[key].discs.push(t);
  }

  const rows = Object.values(grupos)
    .sort((a,b) => (+a.serie - +b.serie) || a.turma.localeCompare(b.turma))
    .map(grp => {
      const serieLabel = `${grp.serie}ª ${grp.turma}${grp.subtitulo ? " "+grp.subtitulo : ""}`;
      const discRows = grp.discs.map(t => {
        const horLista = (t.horarios||[]).map(h =>
          `<span class="assoc-hor-tag">${(DIAS_FULL[h.diaSemana]||"?")} · ${_aulaLabel(h.aula)}</span>`
        ).join("");
        const checked = _profSelAssoc.has(t.id) ? "checked" : "";
        const sel     = _profSelAssoc.has(t.id) ? "assoc-disc-sel" : "";
        return `
          <div class="assoc-disc-row ${sel}" data-tid="${t.id}">
            <label class="assoc-chk-wrap" title="Selecionar para remoção">
              <input type="checkbox" class="assoc-prof-chk" data-tid="${t.id}"
                ${checked}
                onchange="_profToggleSel('${t.id}',this.checked)">
              <span class="assoc-chk-box"></span>
            </label>
            <span class="assoc-sigla-badge">${t.sigla}</span>
            <div class="assoc-disc-info">
              <span class="assoc-disc-nome">${t.disciplina}</span>
              <span class="assoc-disc-hors">${horLista || '<em style="color:var(--text-muted);font-size:.72rem">Sem horários</em>'}</span>
            </div>
            <button type="button" class="assoc-del-btn"
              onclick="_profRemoverUm('${t.id}')"
              title="Remover ${t.disciplina} da ${serieLabel}">
              🗑
            </button>
          </div>`;
      }).join("");

      return `
        <div class="assoc-grupo-turma">
          <div class="assoc-grupo-header">
            <span class="assoc-grupo-label">${serieLabel}</span>
            <span class="assoc-grupo-periodo">${_periodoLabel(grp.periodo)}</span>
            <button type="button" class="assoc-sel-grupo-btn"
              onclick="_profSelecionarGrupo('${grp.serie}','${grp.turma}','${grp.subtitulo||""}')"
              title="Sel./dessel. todas desta turma">Sel. turma</button>
          </div>
          <div class="assoc-grupo-body">${discRows}</div>
        </div>`;
    }).join("");

  const totalSel = _profSelAssoc.size;
  const barraLote = totalSel > 0
    ? `<div class="assoc-lote-bar">
        <span class="assoc-lote-count">
          <strong>${totalSel}</strong> associação${totalSel > 1 ? "ões" : ""} selecionada${totalSel > 1 ? "s" : ""}
        </span>
        <button type="button" class="btn-add"
          style="background:var(--red,#c0392b);padding:6px 16px;font-size:.8rem"
          onclick="_profRemoverLote()">🗑 Remover selecionadas</button>
        <button type="button" class="btn-modal-cancel" style="padding:6px 14px"
          onclick="_profLimparSel()">Cancelar</button>
      </div>`
    : "";

  const tudo = _profSelAssoc.size === minhasTurmas.length;
  const btnSelTudo = `
    <button type="button" class="btn-add"
      style="background:transparent;border:1.5px solid var(--border);color:var(--text-mid);padding:5px 12px;font-size:.78rem"
      onclick="_profSelecionarTudo()">
      ${tudo ? "✕ Desmarcar todas" : "☐ Selecionar todas"}
    </button>`;

  return `
    ${barraLote}
    <div class="assoc-toolbar">
      <span style="font-size:.82rem;color:var(--text-muted)">
        ${minhasTurmas.length} associação${minhasTurmas.length !== 1 ? "ões" : ""}
      </span>
      ${btnSelTudo}
    </div>
    <div class="assoc-lista-prof">${rows}</div>`;
}

// ── Helpers de seleção ────────────────────────────────────────

function _profToggleSel(turmaId, checked) {
  if (checked) _profSelAssoc.add(turmaId);
  else         _profSelAssoc.delete(turmaId);
  _profAtualizarAssocContainer();
}

function _profSelecionarGrupo(serie, turma, subtitulo) {
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const ids = RT_TURMAS
    .filter(t => t.serie === serie && t.turma === turma &&
                 (t.subtitulo||"") === subtitulo &&
                 (t.profUid === uid || t.profUid === profUid))
    .map(t => t.id);
  const allSel = ids.every(id => _profSelAssoc.has(id));
  ids.forEach(id => allSel ? _profSelAssoc.delete(id) : _profSelAssoc.add(id));
  _profAtualizarAssocContainer();
}

function _profSelecionarTudo() {
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const minhas  = RT_TURMAS.filter(t => t.profUid === uid || t.profUid === profUid);
  if (_profSelAssoc.size === minhas.length) {
    _profSelAssoc.clear();
  } else {
    minhas.forEach(t => _profSelAssoc.add(t.id));
  }
  _profAtualizarAssocContainer();
}

function _profLimparSel() {
  _profSelAssoc.clear();
  _profAtualizarAssocContainer();
}

function _profAtualizarAssocContainer() {
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const minhas  = RT_TURMAS.filter(t => t.profUid === uid || t.profUid === profUid);

  // Atualiza container de associações (somente se sub-aba "ver" estiver visível)
  const cont = document.getElementById("assoc-prof-container");
  if (cont) {
    cont.innerHTML = _buildAssocHtml(minhas, profUid, uid,
      ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]);
  }

  // Atualiza badge de contagem na tab "Ver"
  const verBtn = [...document.querySelectorAll(".prof-sub-tab")]
    .find(b => b.textContent.includes("Ver"));
  if (verBtn) {
    let badge = verBtn.querySelector(".prof-sub-badge");
    if (minhas.length > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "prof-sub-badge";
        verBtn.appendChild(badge);
      }
      badge.textContent = minhas.length;
    } else if (badge) {
      badge.remove();
    }
  }
}

// ── Remoção ───────────────────────────────────────────────────

async function _profRemoverUm(turmaId) {
  const t = RT_TURMAS.find(x => x.id === turmaId);
  if (!t) return;
  const label = `${t.disciplina} — ${t.serie}ª ${t.turma}${t.subtitulo ? " "+t.subtitulo : ""}`;
  if (!confirm(`Remover "${label}"?\nOs horários e chamadas desta disciplina serão apagados.`)) return;
  await _profExecutarRemocao([turmaId]);
}

async function _profRemoverLote() {
  const ids = [..._profSelAssoc];
  if (!ids.length) return;
  const nomes = ids.map(id => {
    const t = RT_TURMAS.find(x => x.id === id);
    return t ? `${t.disciplina} (${t.serie}ª ${t.turma})` : id;
  }).join("\n• ");
  if (!confirm(`Remover ${ids.length} associação${ids.length > 1 ? "ões" : ""}?\n\n• ${nomes}`)) return;
  await _profExecutarRemocao(ids);
}

async function _profExecutarRemocao(turmaIds) {
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";

  for (const id of turmaIds) {
    const t = RT_TURMAS.find(x => x.id === id);
    if (!t) continue;
    const turmaKey = t.serie + t.turma;
    const docId    = `${turmaKey}_${uid}`;
    try {
      if (!_DEV) await firebase.firestore().collection("chamadas").doc(docId).delete();
    } catch(e) { console.warn("Erro ao deletar chamada:", e); }
  }

  RT_TURMAS = RT_TURMAS.filter(t => !turmaIds.includes(t.id));
  turmaIds.forEach(id => _profSelAssoc.delete(id));

  salvarTudo();
  _invalidarHorariosCache();
  renderizarSidebar();
  _mostrarIndicadorSync(`✓ ${turmaIds.length} associação${turmaIds.length > 1 ? "ões" : ""} removida${turmaIds.length > 1 ? "s" : ""}`);

  // Permanece na sub-aba "ver" e atualiza o container
  _profSubAba = "ver";
  _profAtualizarAssocContainer();

  // Atualiza a marcação visual das sub-abas
  document.querySelectorAll(".prof-sub-tab").forEach(b => {
    b.classList.toggle("ativo", b.textContent.includes("Ver"));
  });

  // Re-renderiza o conteúdo da sub-aba "ver" (substitui grade ou aviso anterior)
  const subCont = document.getElementById("prof-subaba-conteudo");
  if (subCont) {
    const uid2     = _userAtual?.uid;
    const profUid2 = _isAdmin(_userAtual?.email) ? "global" : (uid2 || "anonimo");
    const minhas2  = RT_TURMAS.filter(t => t.profUid === uid2 || t.profUid === profUid2);
    subCont.innerHTML = _htmlSubAbaVer(minhas2, profUid2, uid2);
  }
}

// ── Grade de horários (para adicionar) ───────────────────────

function _renderGradeTurma(tb, uid, profUid, DIAS, horariosGlobais) {
  const turno    = tb.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
  if (!periodos.length) return `<p class="gestao-hint">Nenhum período configurado para este turno.</p>`;

  const todos = {};
  for (const [chave, lista] of Object.entries(horariosGlobais)) {
    for (const dados of lista) {
      if (dados.serie === tb.serie && dados.turma === tb.turma) {
        const isPropia = dados.profUid === uid || dados.profUid === profUid;
        if (isPropia || !todos[chave]) {
          todos[chave] = { ...dados, isPropia };
        }
      }
    }
  }
  for (const t of RT_TURMAS) {
    if (t.serie !== tb.serie || t.turma !== tb.turma) continue;
    const isPropia = t.profUid === uid || t.profUid === profUid;
    for (const h of (t.horarios||[])) {
      const chave = `${h.diaSemana}_${h.aula}`;
      todos[chave] = { turmaId: t.id, disciplina: t.disciplina, sigla: t.sigla, serie: t.serie, turma: t.turma, profUid: t.profUid, isPropia };
    }
  }

  const linhas = periodos.map(p => {
    const isIntervalo = p.label?.toLowerCase().includes("interval");
    const cells = DIAS.map(dia => {
      const chave = `${dia.idx}_${p.aula}`;
      const oc    = todos[chave];
      if (oc) {
        if (oc.isPropia) {
          return `<td class="grade-cell grade-ocupada" title="${oc.disciplina||"—"} — sua aula">
            <div class="grade-disc">${oc.sigla||oc.disciplina||"—"}</div>
            <button type="button" class="grade-del-btn"
              onclick="profRemoverHorario('${oc.turmaId}','${p.aula}',${dia.idx})"
              title="Remover">×</button>
          </td>`;
        }
        return `<td class="grade-cell grade-ocupada-outro"
          title="${oc.disciplina||"—"} — ocupado por outro professor">
          <div class="grade-disc">${oc.sigla||oc.disciplina||"—"}</div>
          <div class="grade-turma" style="font-size:.65rem">outro prof.</div>
        </td>`;
      }
      return `<td class="grade-cell grade-vazia"
        onclick="profAbrirModalHorario('${tb.serie}','${tb.turma}','${tb.subtitulo||""}','${p.aula}',${dia.idx},'${turno}')"
        title="Clique para adicionar aula">
        <span class="grade-vazio-txt">+</span>
      </td>`;
    }).join("");

    return `<tr class="${isIntervalo ? "grade-intervalo" : ""}">
      <td class="grade-periodo">
        <div class="grade-aula-num">${p.aula.replace(/[mt]/,"")}</div>
        <div class="grade-aula-hr">${p.inicio}</div>
      </td>
      ${cells}
    </tr>`;
  }).join("");

  const labelTurno = turno === "tarde" ? "🌇 Tarde" : "🌅 Manhã";
  const label = `${tb.serie}ª ${tb.turma}${tb.subtitulo ? " "+tb.subtitulo : ""}`;

  return `
    <div class="grade-wrap">
      <div class="grade-titulo">${labelTurno} · ${label}</div>
      <div class="grade-hint">
        Células <strong>âmbar</strong> = suas aulas &nbsp;·&nbsp;
        <span class="cinza">cinza</span> = outro professor &nbsp;·&nbsp;
        <strong style="color:#0d9488">+</strong> = clique para adicionar
      </div>
      <div style="overflow-x:auto">
        <table class="grade-tabela">
          <thead><tr>
            <th class="grade-th-hora">Aula</th>
            ${DIAS.map(d => `<th>${d.label}</th>`).join("")}
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Filtros da grade ──────────────────────────────────────────

function profFiltrarSeries() {
  const nivel  = document.getElementById("filtro-nivel")?.value;
  const base   = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const series = [...new Set(base.filter(t => t.nivel===nivel).map(t=>t.serie))].sort((a,b)=>+a-+b);
  const labelSerie = nivel === "medio" ? "Série" : "Ano";
  document.getElementById("filtro-serie-label").textContent = labelSerie;
  const serSel = document.getElementById("filtro-serie");
  serSel.innerHTML = `<option value="">— selecione —</option>` +
    series.map(s => `<option value="${s}">${s}${nivel==="medio"?"ª Série":"º Ano"}</option>`).join("");
  document.getElementById("filtro-turma").innerHTML = `<option value="">—</option>`;
  _gradeTurmaSel = null;
  document.getElementById("grade-turma-container").innerHTML =
    `<div class="assoc-vazio" style="min-height:100px"><p>Selecione a série e a turma.</p></div>`;
}

function profFiltrarTurmasOpts() {
  const nivel  = document.getElementById("filtro-nivel")?.value;
  const serie  = document.getElementById("filtro-serie")?.value;
  if (!serie) return;
  const base   = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const turmas = base.filter(t => t.nivel===nivel && t.serie===serie)
    .sort((a,b) => a.turma.localeCompare(b.turma));
  const turmaSel = document.getElementById("filtro-turma");
  turmaSel.innerHTML = `<option value="">— selecione a turma —</option>` +
    turmas.map(t => `<option value="${t.turma}|${t.subtitulo||""}|${t.periodo||"manha"}|${t.nivel||"medio"}">
      Turma ${t.turma}${t.subtitulo?" "+t.subtitulo:""}
    </option>`).join("");
  _gradeTurmaSel = null;
  document.getElementById("grade-turma-container").innerHTML =
    `<div class="assoc-vazio" style="min-height:100px"><p>Selecione a turma.</p></div>`;
}

async function profSelecionarTurma() {
  const serie  = document.getElementById("filtro-serie")?.value;
  const parts  = (document.getElementById("filtro-turma")?.value||"").split("|");
  if (!serie || !parts[0]) return;
  const tb = { serie, turma: parts[0], subtitulo: parts[1]||"", periodo: parts[2]||"manha", nivel: parts[3]||"medio" };
  _gradeTurmaSel = tb;

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const container = document.getElementById("grade-turma-container");
  if (container) {
    container.innerHTML = `<p class="gestao-hint">⏳ Carregando horários…</p>`;
    const horariosGlobais = await _carregarHorariosGlobais();
    const DIAS = [{idx:1,label:"Segunda"},{idx:2,label:"Terça"},{idx:3,label:"Quarta"},{idx:4,label:"Quinta"},{idx:5,label:"Sexta"}];
    container.innerHTML = _renderGradeTurma(tb, uid, profUid, DIAS, horariosGlobais);
  }
}

function profAbrirModalHorario(serie, turma, subtitulo, aula, diaSemana, turno) {
  const DIAS_FULL = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  _gradeModalDia  = diaSemana;
  _gradeModalAula = aula;

  const periodo = RT_PERIODOS.find(p => p.aula === aula);
  const sub = document.getElementById("modal-grade-subtitulo");
  if (sub) sub.textContent = `${DIAS_FULL[diaSemana]} · Aula ${aula.replace(/[mt]/,"")} (${periodo?.inicio||""}) — ${serie}ª ${turma}${subtitulo?" "+subtitulo:""}`;

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const discNaTurma = RT_TURMAS.filter(t =>
    t.serie===serie && t.turma===turma && (t.profUid===uid||t.profUid===profUid)
  );

  const todasDiscs = _disciplinasDaSerie(serie);

  const discSel = document.getElementById("modal-grade-disc");
  if (!discSel) return;

  discSel.dataset.serie     = serie;
  discSel.dataset.turma     = turma;
  discSel.dataset.subtitulo = subtitulo||"";
  discSel.dataset.turno     = turno;

  const optsJa = discNaTurma.map(t =>
    `<option value="existing:${t.id}">${t.disciplina} (${t.sigla}) — já cadastrada</option>`
  );
  const optsNovas = todasDiscs
    .filter(d => !discNaTurma.find(t => t.disciplina===d))
    .map(d => `<option value="new:${d.replace(/"/g,'&quot;')}">${d}</option>`);

  discSel.innerHTML = `<option value="">— selecione —</option>` +
    (optsJa.length ? `<optgroup label="Suas disciplinas nesta turma">${optsJa.join("")}</optgroup>` : "") +
    (optsNovas.length ? `<optgroup label="Adicionar nova disciplina">${optsNovas.join("")}</optgroup>` : "");

  document.getElementById("modal-grade-aula").style.display = "flex";
}

async function profConfirmarHorario() {
  const discSel = document.getElementById("modal-grade-disc");
  if (!discSel?.value) { alert("Selecione uma disciplina."); return; }

  const serie     = discSel.dataset.serie;
  const turma     = discSel.dataset.turma;
  const subtitulo = discSel.dataset.subtitulo||"";
  const periodo   = discSel.dataset.turno||"manha";
  const uid       = _userAtual?.uid;
  const profUid   = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");

  let turmaEntry;
  const val = discSel.value;

  if (val.startsWith("existing:")) {
    turmaEntry = RT_TURMAS.find(t => t.id === val.replace("existing:",""));
  } else {
    const disciplina = val.replace("new:","");
    const conflito = await _verificarConflitoHorario(serie, turma, _gradeModalDia, _gradeModalAula, null);
    if (conflito) {
      document.getElementById("modal-grade-aula").style.display = "none";
      _mostrarModalConflito(conflito);
      return;
    }
    const sigla = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").substring(0,3).toUpperCase()
      || disciplina.substring(0,3).toUpperCase();
    const id = `${serie}${turma}_${sigla}_${profUid.substring(0,6)}_${Date.now()}`;
    turmaEntry = { id, serie, turma, subtitulo, disciplina, sigla, horarios:[], profUid, periodo };
    RT_TURMAS.push(turmaEntry);
  }

  if (!turmaEntry) return;

  const conflito = await _verificarConflitoHorario(serie, turma, _gradeModalDia, _gradeModalAula, turmaEntry.id);
  if (conflito) {
    document.getElementById("modal-grade-aula").style.display = "none";
    _mostrarModalConflito(conflito);
    return;
  }

  if (!turmaEntry.horarios.find(h => h.diaSemana===_gradeModalDia && h.aula===_gradeModalAula)) {
    turmaEntry.horarios.push({ diaSemana: _gradeModalDia, aula: _gradeModalAula });
  }

  salvarTudo();
  _invalidarHorariosCache();
  renderizarSidebar();
  document.getElementById("modal-grade-aula").style.display = "none";

  // Atualiza a seção de associações e a grade
  _profAtualizarAssocContainer();
  profSelecionarTurma();
}

// Remove um horário avulso da grade (botão × na célula âmbar)
function profRemoverHorario(turmaId, aula, diaSemana) {
  if (!confirm("Remover este horário?")) return;
  const ti = RT_TURMAS.findIndex(t => t.id === turmaId);
  if (ti < 0) return;
  RT_TURMAS[ti].horarios = RT_TURMAS[ti].horarios.filter(
    h => !(h.aula === aula && h.diaSemana === diaSemana)
  );
  // Se a turma ficou sem horários e sem estado, remove a entrada toda
  if (!RT_TURMAS[ti].horarios.length) {
    const temEstado = Object.keys(estadoAulas).some(k => k.startsWith(turmaId));
    if (!temEstado) RT_TURMAS.splice(ti, 1);
  }
  salvarTudo();
  _invalidarHorariosCache();
  renderizarSidebar();
  _profAtualizarAssocContainer();
  profSelecionarTurma();
}

async function profConfirmarAula() { return profConfirmarHorario(); }

// ════════════════════════════════════════════════════════════
//  PAINEL: CONTEÚDOS
// ════════════════════════════════════════════════════════════

let gContChave = null;
let gContModo  = "lista";
let gContBim   = 1;

function _gContChavesBase() {
  const set = new Set();
  for (const t of _turmasVisiveis()) {
    if (t.disciplina) set.add(t.serie + "_" + t.disciplina);
  }
  for (const k of Object.keys(RT_CONTEUDOS)) {
    const base = k.replace(/_b\d+$/, "");
    if (set.has(base)) set.add(base);
  }
  return [...set].sort();
}
function _gContChaveCompleta(base, bim) { return base + "_b" + bim; }
function _gContEnsureChave(base, bim) {
  const chaveBim = _gContChaveCompleta(base, bim);
  if (!RT_CONTEUDOS[chaveBim]) {
    RT_CONTEUDOS[chaveBim] = RT_CONTEUDOS[base] ? [...RT_CONTEUDOS[base]] : [];
  }
  return chaveBim;
}

function htmlGestaoConteudos() {
  const bases    = _gContChavesBase();
  const baseAtiva = (() => {
    if (gContChave) {
      const m = gContChave.match(/^(.+)_b\d+$/);
      const b = m ? m[1] : gContChave;
      if (bases.includes(b)) return b;
    }
    return bases[0] || null;
  })();
  const bim        = gContBim;
  const chaveAtiva = baseAtiva ? _gContEnsureChave(baseAtiva, bim) : null;
  gContChave       = chaveAtiva;

  const discBtns = bases.map(b => `
    <button type="button" class="gtab-cont ${b===baseAtiva?"ativo":""}" onclick="selecionarBaseGCont('${b}')">${b}</button>`
  ).join("");

  const bimBtns = (RT_BIMESTRES || []).map(b => `
    <button type="button" class="gtab-cont gtab-bim ${b.bimestre===bim?"ativo":""}" onclick="selecionarBimGCont(${b.bimestre})">${b.label}</button>`
  ).join("");

  const lista = chaveAtiva ? RT_CONTEUDOS[chaveAtiva] : [];

  const conteudoEditor = gContModo === "bloco" ? `
    <div class="bloco-editor">
      <p class="bloco-instrucao">Cole ou digite todas as aulas — <strong>uma por linha</strong>. As linhas existentes serão substituídas ao salvar.</p>
      <textarea id="bloco-textarea" class="bloco-textarea" rows="18" spellcheck="false">${lista.join("\n")}</textarea>
      <div class="bloco-actions">
        <button type="button" class="btn-modal-cancel" onclick="gContModo='lista'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">Cancelar</button>
        <button type="button" class="btn-modal-ok" onclick="salvarBloco('${chaveAtiva}')">Salvar bloco</button>
      </div>
    </div>` : `
    <div class="tabela-wrapper" style="margin-top:12px">
      <table class="tabela-gestao" id="tabela-conteudos">
        <thead><tr><th>#</th><th>Texto da aula</th><th></th></tr></thead>
        <tbody>
          ${lista.map((txt,i) => `
            <tr data-ci="${i}">
              <td class="td-numero">${i+1}</td>
              <td>
                <div class="conteudo-cell">
                  <span class="drag-handle-cont" draggable="true"
                    ondragstart="contDragStart(event,${i})"
                    ondragover="event.preventDefault()"
                    ondragenter="contDragEnter(event,${i})"
                    ondragleave="event.target.closest('tr')?.classList.remove('cont-drag-over')"
                    ondrop="contDrop(event,${i})">⠿</span>
                  <input class="gi gi-full" value="${txt.replace(/"/g,'&quot;')}"
                    onchange="editConteudo('${chaveAtiva}',${i},this.value)" />
                </div>
              </td>
              <td><button type="button" class="btn-icon-del" onclick="delConteudo('${chaveAtiva}',${i})">×</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button type="button" class="btn-add" onclick="addConteudo('${chaveAtiva}')">+ Adicionar linha</button>
    </div>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Conteúdos por disciplina / série / bimestre</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn-add btn-outline" onclick="gContModo='bloco'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">✎ Editar em bloco</button>
          <button type="button" class="btn-add" onclick="addChaveCont()">+ Nova disciplina</button>
        </div>
      </div>
      <div class="gtab-cont-bar" style="margin-bottom:4px">${discBtns}</div>
      <div class="gtab-cont-bar" style="margin-bottom:12px;opacity:.85">${bimBtns}</div>
      ${chaveAtiva ? conteudoEditor : `<p style="padding:20px;color:#aaa">Nenhuma disciplina cadastrada.</p>`}
    </div>`;
}

function selecionarBaseGCont(base) {
  gContChave = _gContChaveCompleta(base, gContBim);
  gContModo  = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function selecionarBimGCont(bim) {
  gContBim   = bim;
  gContModo  = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function selecionarChaveCont(k) {
  gContChave = k; gContModo = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function salvarBloco(chave) {
  const texto  = document.getElementById("bloco-textarea").value;
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  RT_CONTEUDOS[chave] = linhas;
  gContModo = "lista";
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      delete ordemConteudos[chaveOrdem(t.id, bimN)];
      const slots = getSlotsCompletos(t.id, bimN).filter(s => !s.eventual);
      slots.forEach(s => {
        const ch = chaveSlot(t.id, bimN, s.slotId);
        if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
      });
    }
  }
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function editConteudo(chave, i, val) {
  RT_CONTEUDOS[chave][i] = val;
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      const slots = getSlotsCompletos(t.id, bimN).filter(s => !s.eventual);
      const ordem = getOrdem(t.id, bimN, slots.length);
      slots.forEach((s, ri) => {
        if (ordem[ri] === i) {
          const ch = chaveSlot(t.id, bimN, s.slotId);
          if (estadoAulas[ch]) delete estadoAulas[ch].conteudoEditado;
        }
      });
    }
  }
  salvarTudo();
}

function delConteudo(chave, i) {
  if (!confirm("Remover esta aula da lista?")) return;
  RT_CONTEUDOS[chave].splice(i,1); salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function addConteudo(chave) {
  RT_CONTEUDOS[chave].push(""); salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
  setTimeout(() => {
    const inputs = document.querySelectorAll("#tabela-conteudos .gi-full");
    inputs[inputs.length-1]?.focus();
  }, 50);
}

function addChaveCont() {
  const serie = prompt("Série (ex: 1, 2, 3):", "1"); if (!serie) return;
  const disc  = prompt(`Disciplina (ex: Geografia):`, ""); if (!disc) return;
  const base  = `${serie}_${disc}`;
  const chaveBim = _gContChaveCompleta(base, gContBim);
  if (RT_CONTEUDOS[chaveBim]) { alert("Já existe."); return; }
  RT_CONTEUDOS[chaveBim] = [];
  gContChave = chaveBim; gContModo = "bloco"; salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

// ════════════════════════════════════════════════════════════
//  BIMESTRES (professor — somente leitura; admin — edita)
// ════════════════════════════════════════════════════════════

function htmlGestaoBimestres() {
  const admin = _isAdmin(_userAtual?.email);
  const rows = RT_BIMESTRES.map((b,i) => {
    if (admin) {
      return `
        <tr>
          <td><input class="gi gi-sm" value="${b.label}" onchange="editBimField(${i},'label',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.inicio}" onchange="editBimField(${i},'inicio',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.fim}"    onchange="editBimField(${i},'fim',this.value)" /></td>
          <td><button type="button" class="btn-icon-del" onclick="delBim(${i})">🗑</button></td>
        </tr>`;
    } else {
      return `
        <tr>
          <td><span class="bim-label-ro">${b.label}</span></td>
          <td><span class="bim-data-ro">${b.inicio ? _fmtDataSimples(b.inicio) : '—'}</span></td>
          <td><span class="bim-data-ro">${b.fim    ? _fmtDataSimples(b.fim)    : '—'}</span></td>
          <td></td>
        </tr>`;
    }
  }).join("");

  const headerAcao = admin
    ? `<button type="button" class="btn-add" onclick="addBim()">+ Novo período</button>`
    : `<span class="bim-ro-aviso">📋 Definido pelo administrador</span>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Bimestres / Períodos letivos</h3>
        ${headerAcao}
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr><th>Rótulo</th><th>Início</th><th>Fim</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _fmtDataSimples(iso) {
  if (!iso) return "—";
  const [a,m,d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function editBimField(i, campo, val) {
  if (!_isAdmin(_userAtual?.email)) return;
  RT_BIMESTRES[i][campo] = campo === "bimestre" ? +val : val;
  _salvarBimestresFirestore();
}
function delBim(i) {
  if (!_isAdmin(_userAtual?.email)) return;
  if (!confirm("Excluir este período?")) return;
  RT_BIMESTRES.splice(i, 1);
  _salvarBimestresFirestore();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}
function addBim() {
  if (!_isAdmin(_userAtual?.email)) return;
  const num = RT_BIMESTRES.length + 1;
  RT_BIMESTRES.push({ bimestre: num, label: `${num}º Bimestre`, inicio: "", fim: "" });
  _salvarBimestresFirestore();
  document.getElementById("g-bimestres").innerHTML = htmlGestaoBimestres();
}

// ── Edição de turmas e horários (legado/compatibilidade) ──────
function editTurmaField(i, campo, val) { RT_TURMAS[i][campo] = val; salvarTudo(); }
function editHorario(ti, hi, campo, val) {
  RT_TURMAS[ti].horarios[hi][campo] = campo === "diaSemana" ? +val : val;
  salvarTudo();
}
function addHorario(ti) {
  const turno = RT_TURMAS[ti].periodo || "manha";
  const prefixo = turno === "tarde" ? "t" : "m";
  RT_TURMAS[ti].horarios.push({ diaSemana: 1, aula: prefixo + "1" });
  salvarTudo();
  const el = document.getElementById("g-minhas-turmas");
  if (el) { htmlProfTurmas().then(h => { el.innerHTML = h; }); }
}
function delHorario(ti, hi) {
  RT_TURMAS[ti].horarios.splice(hi, 1);
  salvarTudo();
  const el = document.getElementById("g-minhas-turmas");
  if (el) { htmlProfTurmas().then(h => { el.innerHTML = h; }); }
}
async function delTurma(i) {
  const t = RT_TURMAS[i];
  if (!confirm("Excluir " + (t.disciplina||"esta disciplina") + " da turma " + t.serie + "ª " + t.turma + "?\nAs chamadas desta turma também serão removidas.")) return;
  const turmaKey = t.serie + t.turma;
  const uid = _userAtual ? (_isAdmin(_userAtual.email) ? "global" : _userAtual.uid) : "anonimo";
  const docId = `${turmaKey}_${uid}`;
  try { await firebase.firestore().collection("chamadas").doc(docId).delete(); }
  catch(e) { console.warn("Erro ao deletar chamada:", e); }
  RT_TURMAS.splice(i, 1);
  salvarTudo();
  renderizarSidebar();
  const el = document.getElementById("g-minhas-turmas");
  if (el) { const h = await htmlProfTurmas(); el.innerHTML = h; }
}

// ── CSS das associações ───────────────────────────────────────

function _injetarCSSAssoc() {
  if (document.getElementById("css-assoc-prof")) return;
  const s = document.createElement("style");
  s.id = "css-assoc-prof";
  s.textContent = `
.assoc-lista-prof{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.assoc-grupo-turma{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-paper)}
.assoc-grupo-header{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#1e2530;color:#e2e8f0}
.assoc-grupo-label{font-family:'DM Serif Display',serif;font-size:1rem;flex:1}
.assoc-grupo-periodo{font-size:.72rem;color:#94a3b8}
.assoc-sel-grupo-btn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:5px;color:#cbd5e1;font-size:.72rem;padding:3px 9px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .13s}
.assoc-sel-grupo-btn:hover{background:var(--amber);color:#fff;border-color:var(--amber)}
.assoc-grupo-body{display:flex;flex-direction:column}
.assoc-disc-row{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);transition:background .12s}
.assoc-disc-row:last-child{border-bottom:none}
.assoc-disc-row:hover{background:var(--blue-pale)}
.assoc-disc-sel{background:var(--amber-pale)!important}
.assoc-chk-wrap{display:flex;align-items:center;cursor:pointer;flex-shrink:0}
.assoc-chk-wrap input[type="checkbox"]{position:absolute;opacity:0;width:0;height:0}
.assoc-chk-box{width:20px;height:20px;border:2px solid var(--border);border-radius:5px;background:#fff;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0}
.assoc-chk-box::after{content:'';width:5px;height:9px;border:2px solid transparent;border-top:none;border-left:none;transform:rotate(45deg) translateY(-1px);transition:border-color .12s}
.assoc-chk-wrap input:checked+.assoc-chk-box{background:var(--amber);border-color:var(--amber)}
.assoc-chk-wrap input:checked+.assoc-chk-box::after{border-color:#fff}
.assoc-chk-wrap:hover .assoc-chk-box{border-color:var(--amber)}
.assoc-sigla-badge{font-size:.62rem;font-weight:700;padding:3px 8px;border-radius:4px;color:#fff;background:var(--amber);flex-shrink:0;letter-spacing:.04em;text-transform:uppercase}
.assoc-disc-info{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.assoc-disc-nome{font-size:.88rem;font-weight:600;color:var(--text)}
.assoc-disc-hors{display:flex;flex-wrap:wrap;gap:4px}
.assoc-hor-tag{font-size:.7rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:2px 7px;color:var(--text-mid);white-space:nowrap}
.assoc-del-btn{flex-shrink:0;background:transparent;border:1.5px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:1rem;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .13s}
.assoc-del-btn:hover{background:#fef2f2;border-color:var(--red);color:var(--red)}
.assoc-lote-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:var(--amber-pale);border:1.5px solid var(--amber);border-radius:8px;margin-bottom:12px;animation:fadeUp .15s ease}
.assoc-lote-count{flex:1;font-size:.83rem;color:var(--amber)}
.assoc-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px}
.assoc-vazio{display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 20px;text-align:center;color:var(--text-muted);font-size:.88rem;border:1.5px dashed var(--border);border-radius:10px;background:var(--bg)}

/* ── Sub-abas Minhas Turmas ── */
.prof-sub-tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border)}
.prof-sub-tab{
  display:inline-flex;align-items:center;gap:7px;
  padding:9px 20px;
  background:transparent;border:none;
  border-bottom:2px solid transparent;
  margin-bottom:-2px;
  font-family:'DM Sans',sans-serif;font-size:.88rem;font-weight:500;
  color:var(--text-muted);cursor:pointer;
  transition:color .13s,border-color .13s;
  white-space:nowrap;
}
.prof-sub-tab:hover{color:var(--text);border-bottom-color:var(--border)}
.prof-sub-tab.ativo{color:var(--amber);border-bottom-color:var(--amber);font-weight:700}
.prof-sub-badge{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:20px;height:20px;padding:0 5px;
  background:var(--amber);color:#fff;
  font-size:.65rem;font-weight:700;border-radius:10px;
}
.prof-sub-tab.ativo .prof-sub-badge{background:#fff;color:var(--amber)}

@media(max-width:860px){
  .assoc-disc-row{padding:10px;gap:8px}
  .assoc-hor-tag{font-size:.66rem}
  .assoc-del-btn{width:38px;height:38px;font-size:1.15rem}
  .prof-sub-tab{padding:8px 14px;font-size:.82rem}
}
  `;
  document.head.appendChild(s);
}

// Nota: contDragIdx, contDragStart, contDragEnter e contDrop
// estão definidos em gestao-usuarios.js — não redeclarar aqui.
