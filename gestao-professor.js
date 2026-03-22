// GESTAO-PROFESSOR.JS — Painel do Professor: minhas turmas, conteúdos
// Dependências: app-core.js


function _disciplinasDaSerie(serie) {
  const areas = RT_CONFIG.disciplinasPorSerie?.[serie] || {};
  const set = new Set();
  for (const lista of Object.values(areas)) {
    for (const d of lista) if (d) set.add(d);
  }
  // Fallback: disciplinas de qualquer série se essa estiver vazia
  if (!set.size) {
    const todas = RT_CONFIG.disciplinasPorSerie || {};
    for (const s of Object.values(todas))
      for (const lista of Object.values(s))
        for (const d of lista) if (d) set.add(d);
  }
  return [...set].sort();
}

// Cache de horários de todos os professores (chave: "diaSemana_aula" → {disciplina, sigla, serie, turma})
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
          if (!cache[chave]) {
            cache[chave] = { disciplina: t.disciplina, sigla: t.sigla, serie: t.serie, turma: t.turma, profUid: uid };
          }
        }
      }
    }
  } catch(e) { console.warn("Erro ao carregar horários globais:", e); }
  _horariosGlobaisCache = cache;
  return cache;
}

// Invalida o cache quando o professor salva um novo horário
function _invalidarHorariosCache() { _horariosGlobaisCache = null; }

async function htmlProfTurmas() {
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const DIAS    = [
    { idx:1, label:"Segunda" },
    { idx:2, label:"Terça"   },
    { idx:3, label:"Quarta"  },
    { idx:4, label:"Quinta"  },
    { idx:5, label:"Sexta"   },
  ];

  // Carrega horários de TODOS os professores do Firestore
  const horariosGlobais = await _carregarHorariosGlobais();

  // Turmas-base para os filtros
  const base = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const niveis = [...new Set(base.map(t => t.nivel))].sort();

  // Gera opções de nível
  const nivelOpts = `<option value="">— selecione —</option>` +
    niveis.map(n => `<option value="${n}">${n === "medio" ? "Ensino Médio" : "Ensino Fundamental"}</option>`).join("");

  // Grade da turma selecionada (se houver)
  const gradeHtml = _gradeTurmaSel
    ? _renderGradeTurma(_gradeTurmaSel, uid, profUid, DIAS, horariosGlobais)
    : `<p class="gestao-hint" style="margin-top:20px">Selecione uma turma para ver e editar os horários.</p>`;

  return `
    <div style="max-width:900px">
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:20px">
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Nível
          <select class="gi" id="filtro-nivel" onchange="profFiltrarSeries()" style="display:block;margin-top:4px;min-width:160px">
            ${nivelOpts}
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)" id="filtro-serie-wrap">
          <span id="filtro-serie-label">Série / Ano</span>
          <select class="gi" id="filtro-serie" onchange="profFiltrarTurmasOpts()" style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Turma
          <select class="gi" id="filtro-turma" onchange="profSelecionarTurma()" style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
      </div>
      <div id="grade-turma-container">
        ${gradeHtml}
      </div>
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

// Turma selecionada nos filtros: { serie, turma, subtitulo, periodo, nivel }
let _gradeTurmaSel  = null;
let _gradeModalDia  = null;
let _gradeModalAula = null;

function _renderGradeTurma(tb, uid, profUid, DIAS, horariosGlobais) {
  const turno    = tb.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
  if (!periodos.length) return `<p class="gestao-hint">Nenhum período configurado para este turno.</p>`;

  // Horários de TODOS nesta série+turma
  const todos = {};
  // 1. Dos horários globais (Firestore de outros profs)
  for (const [chave, dados] of Object.entries(horariosGlobais)) {
    if (dados.serie === tb.serie && dados.turma === tb.turma) {
      const isPropia = dados.profUid === uid || dados.profUid === profUid;
      todos[chave] = { ...dados, isPropia };
    }
  }
  // 2. Das turmas locais do prof (RT_TURMAS)
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
    `<p class="gestao-hint" style="margin-top:16px">Selecione a série e a turma.</p>`;
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
    `<p class="gestao-hint" style="margin-top:16px">Selecione a turma.</p>`;
}

async function profSelecionarTurma() {
  const serie    = document.getElementById("filtro-serie")?.value;
  const parts    = (document.getElementById("filtro-turma")?.value||"").split("|");
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
  const DIAS = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  _gradeModalDia  = diaSemana;
  _gradeModalAula = aula;

  const periodo = RT_PERIODOS.find(p => p.aula === aula);
  const sub = document.getElementById("modal-grade-subtitulo");
  if (sub) sub.textContent = `${DIAS[diaSemana]} · Aula ${aula.replace(/[mt]/,"")} (${periodo?.inicio||""}) — ${serie}ª ${turma}${subtitulo?" "+subtitulo:""}`;

  // Disciplinas que o professor leciona nesta turma (já cadastradas)
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const discNaTurma = RT_TURMAS.filter(t =>
    t.serie===serie && t.turma===turma && (t.profUid===uid||t.profUid===profUid)
  );

  // Todas as disciplinas disponíveis para esta série
  const todasDiscs = _disciplinasDaSerie(serie);

  const discSel = document.getElementById("modal-grade-disc");
  if (!discSel) return;

  // Guarda info da turma no modal
  discSel.dataset.serie     = serie;
  discSel.dataset.turma     = turma;
  discSel.dataset.subtitulo = subtitulo||"";
  discSel.dataset.turno     = turno;

  // Opções: disciplinas já nesta turma primeiro, depois as demais
  const idsJa = new Set(discNaTurma.map(t => t.id));
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
    // Nova disciplina nesta turma
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

  // Verifica conflito
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

  // Recarrega a grade da turma selecionada
  profSelecionarTurma();
}

// Alias de compatibilidade
async function profConfirmarAula() { return profConfirmarHorario(); }

function profRemoverHorario(turmaId, aula, diaSemana) {
  if (!confirm("Remover este horário?")) return;
  const ti = RT_TURMAS.findIndex(t => t.id === turmaId);
  if (ti < 0) return;
  RT_TURMAS[ti].horarios = RT_TURMAS[ti].horarios.filter(
    h => !(h.aula === aula && h.diaSemana === diaSemana)
  );
  if (!RT_TURMAS[ti].horarios.length) {
    const temEstado = Object.keys(estadoAulas).some(k => k.startsWith(turmaId));
    if (!temEstado) RT_TURMAS.splice(ti, 1);
  }
  salvarTudo();
  _invalidarHorariosCache();
  renderizarSidebar();
  profSelecionarTurma();
}

// Adiciona nova disciplina inline (sem prompt)
function _autoSigla(ti, disciplina) {
  // Sugere sigla a partir das 3 primeiras letras consoantes ou iniciais
  const t = RT_TURMAS[ti];
  if (!t || t.sigla) return; // não sobrescreve se já tem
  const sigla = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").substring(0,3).toUpperCase()
    || disciplina.substring(0,3).toUpperCase();
  t.sigla = sigla;
  const el = document.getElementById("sigla-"+t.id);
  if (el) el.value = sigla;
  salvarTudo();
}

function addDiscNaTurma(serie, turma, subtitulo, periodo) {
  const uid    = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  // Gera id temporário único — usuário edita o nome depois
  const seq  = RT_TURMAS.filter(t => t.serie===serie && t.turma===turma && t.profUid===profUid).length + 1;
  const sigla = "D"+seq;
  const id    = `${serie}${turma}_${sigla}_${profUid.substring(0,4)}`;
  if (RT_TURMAS.find(t => t.id === id)) return; // evita duplicata rápida
  RT_TURMAS.push({ id, serie, turma, subtitulo, disciplina:"", sigla, horarios:[], profUid, periodo });
  salvarTudo(); renderizarSidebar();
  document.getElementById("g-minhas-turmas").innerHTML = htmlProfTurmas();
}


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


// ── Edição de turmas e horários ──────────────────────────────
function editTurmaField(i, campo, val) {
  RT_TURMAS[i][campo] = val;
  salvarTudo();
}
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
  if (el) el.innerHTML = htmlProfTurmas();
}
function delHorario(ti, hi) {
  RT_TURMAS[ti].horarios.splice(hi, 1);
  salvarTudo();
  const el = document.getElementById("g-minhas-turmas");
  if (el) el.innerHTML = htmlProfTurmas();
}
function delTurma(i) {
  const t = RT_TURMAS[i];
  if (!confirm("Excluir " + (t.disciplina||"esta disciplina") + " da turma " + t.serie + "ª " + t.turma + "?")) return;
  RT_TURMAS.splice(i, 1);
  salvarTudo();
  renderizarSidebar();
  const el = document.getElementById("g-minhas-turmas");
  if (el) el.innerHTML = htmlProfTurmas();
}

// ── Helpers de conteúdo ──────────────────────────────────────
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

  // Botões de disciplina
  const discBtns = bases.map(b => `
    <button type="button" class="gtab-cont ${b===baseAtiva?"ativo":""}" onclick="selecionarBaseGCont('${b}')">${b}</button>`
  ).join("");

  // Abas de bimestre
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

// Mantida para compatibilidade com código legado
function selecionarChaveCont(k) {
  gContChave = k; gContModo = "lista";
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}

function salvarBloco(chave) {
  const texto  = document.getElementById("bloco-textarea").value;
  const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  RT_CONTEUDOS[chave] = linhas;
  gContModo = "lista";
  // Limpa ordem e conteúdos editados do bimestre correspondente
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
  const disc  = prompt("Disciplina (ex: Geografia):", ""); if (!disc) return;
  const base  = `${serie}_${disc}`;
  const chaveBim = _gContChaveCompleta(base, gContBim);
  if (RT_CONTEUDOS[chaveBim]) { alert("Já existe."); return; }
  RT_CONTEUDOS[chaveBim] = [];
  gContChave = chaveBim; gContModo = "bloco"; salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}


// ════════════════════════════════════════════════════════════
//  PAINEL: MEU PERFIL
// ════════════════════════════════════════════════════════════
// ── Helper: UI de seleção de matérias (checkboxes + campo Outro) ──────────
// Renderiza seletor área + disciplinas + turmas para professor/cadastro