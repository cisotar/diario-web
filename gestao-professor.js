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
  const uid  = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const DIAS = [
    { idx:1, label:"Seg" },
    { idx:2, label:"Ter" },
    { idx:3, label:"Qua" },
    { idx:4, label:"Qui" },
    { idx:5, label:"Sex" },
  ];

  // Carrega horários de TODOS os professores do Firestore
  const horariosGlobais = await _carregarHorariosGlobais();

  // Turmas do próprio professor agrupadas por série+turma+disciplina
  const minhasTurmas = RT_TURMAS.filter(t => t.profUid === uid || t.profUid === profUid);

  // Agrupa por série+turma para criar uma grade por turma
  const porTurma = {};
  for (const t of minhasTurmas) {
    const key = `${t.serie}|${t.turma}|${t.subtitulo||""}`;
    if (!porTurma[key]) porTurma[key] = { serie: t.serie, turma: t.turma, subtitulo: t.subtitulo||"", periodo: t.periodo||"manha", disciplinas: [] };
    porTurma[key].disciplinas.push(t);
  }

  const renderGrade = (turmaKey, tb) => {
    const turno    = tb.periodo || "manha";
    const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);
    if (!periodos.length) return "";

    // Mapa de horários desta turma: dia_aula → {disciplina, sigla, turmaId}
    const ocupadoProf = {};
    for (const t of tb.disciplinas) {
      for (const h of (t.horarios||[])) {
        const chave = `${h.diaSemana}_${h.aula}`;
        ocupadoProf[chave] = { turmaId: t.id, disciplina: t.disciplina, sigla: t.sigla };
      }
    }

    // Horários de outros professores NESTA série+turma
    const ocupadoOutros = {};
    for (const [chave, dados] of Object.entries(horariosGlobais)) {
      if (dados.profUid !== uid && dados.serie === tb.serie && dados.turma === tb.turma) {
        if (!ocupadoProf[chave]) ocupadoOutros[chave] = dados;
      }
    }

    const linhas = periodos.map(p => {
      const isIntervalo = p.label?.toLowerCase().includes("interval");
      const cells = DIAS.map(dia => {
        const chave = `${dia.idx}_${p.aula}`;
        const oc    = ocupadoProf[chave];
        const outro = ocupadoOutros[chave];
        if (oc) {
          return `<td class="grade-cell grade-ocupada" title="${oc.disciplina} — clique × para remover">
            <div class="grade-disc">${oc.sigla||oc.disciplina||"—"}</div>
            <button type="button" class="grade-del-btn"
              onclick="profRemoverHorario('${oc.turmaId}','${p.aula}',${dia.idx})"
              title="Remover">×</button>
          </td>`;
        }
        if (outro) {
          return `<td class="grade-cell grade-ocupada-outro" title="${outro.disciplina} — ${outro.serie}ª ${outro.turma} — outro professor">
            <div class="grade-disc">${outro.sigla||outro.disciplina||"—"}</div>
          </td>`;
        }
        return `<td class="grade-cell grade-vazia"
          onclick="profAbrirModalHorario('${turmaKey}','${p.aula}',${dia.idx})"
          title="Clique para registrar horário nesta turma">
          <span class="grade-vazio-txt">—</span>
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
    const label = `${tb.serie}ª ${tb.turma}${tb.subtitulo?" "+tb.subtitulo:""}`;
    const disciplinasLabel = tb.disciplinas.map(t =>
      `<span style="background:rgba(201,125,32,.15);color:var(--amber);border-radius:4px;padding:1px 7px;font-size:.75rem;font-weight:600">${t.sigla||t.disciplina}</span>`
    ).join(" ");

    return `
      <div class="grade-wrap" style="margin-bottom:28px">
        <div class="grade-titulo">
          🏫 ${label} — ${labelTurno}
          <span style="margin-left:6px;display:flex;gap:4px;flex-wrap:wrap">${disciplinasLabel}</span>
          <button type="button" class="grade-del-btn" style="display:inline-block;position:static;margin-left:auto;font-size:.75rem;opacity:.6"
            onclick="profRemoverTurma('${turmaKey}')" title="Remover esta turma do meu diário">🗑</button>
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
  };

  const grades = Object.entries(porTurma)
    .sort(([ka],[kb]) => ka.localeCompare(kb))
    .map(([key, tb]) => renderGrade(key, tb))
    .join("");

  return `
    <div style="max-width:900px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <button type="button" class="btn-add" onclick="profAbrirModalAdicionarTurma()">+ Adicionar turma</button>
        <span class="gestao-hint" style="margin:0">
          Células <strong style="color:var(--amber)">âmbar</strong> = suas aulas &nbsp;·&nbsp;
          <strong style="color:#64748b">cinza</strong> = outro professor &nbsp;·&nbsp;
          células vazias = clique para adicionar horário
        </span>
      </div>
      ${grades || '<p class="gestao-hint">Nenhuma turma adicionada ainda. Clique em "+ Adicionar turma" para começar.</p>'}
    </div>

    <!-- Modal: adicionar turma -->
    <div id="modal-add-turma" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:440px">
        <h3 class="modal-titulo">🏫 Adicionar Turma</h3>
        <div class="modal-form">
          <label>Nível de ensino
            <select class="gi" id="add-turma-nivel" onchange="profFiltrarSeries()" style="margin-top:4px">
              <option value="">— selecione —</option>
              <option value="medio">Ensino Médio</option>
              <option value="fundamental">Ensino Fundamental</option>
            </select>
          </label>
          <label style="margin-top:10px" id="add-turma-serie-label">
            Série / Ano
            <select class="gi" id="add-turma-serie" onchange="profFiltrarTurmas()" style="margin-top:4px"></select>
          </label>
          <label style="margin-top:10px">
            Turma
            <select class="gi" id="add-turma-turma" onchange="profFiltrarDiscs()" style="margin-top:4px"></select>
          </label>
          <label style="margin-top:10px">
            Disciplina
            <select class="gi" id="add-turma-disc" style="margin-top:4px"></select>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel"
            onclick="document.getElementById('modal-add-turma').style.display='none'">Cancelar</button>
          <button type="button" class="btn-modal-ok" onclick="profConfirmarAdicionarTurma()">Adicionar</button>
        </div>
      </div>
    </div>

    <!-- Modal: registrar horário numa turma -->
    <div id="modal-grade-aula" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:380px">
        <h3 class="modal-titulo">🕐 Registrar horário</h3>
        <p id="modal-grade-subtitulo" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px"></p>
        <div class="modal-form">
          <label>Disciplina
            <select class="gi" id="modal-grade-disc" style="margin-top:4px"></select>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel"
            onclick="document.getElementById('modal-grade-aula').style.display='none'">Cancelar</button>
          <button type="button" class="btn-modal-ok" onclick="profConfirmarHorario()">Registrar</button>
        </div>
      </div>
    </div>`;
}

// ── Variáveis do modal de horário ──
let _gradeModalDia = null, _gradeModalAula = null, _gradeModalTurmaKey = null;

function profAbrirModalAdicionarTurma() {
  const modal = document.getElementById("modal-add-turma");
  if (!modal) return;
  document.getElementById("add-turma-nivel").value  = "";
  document.getElementById("add-turma-serie").innerHTML = "";
  document.getElementById("add-turma-turma").innerHTML = "";
  document.getElementById("add-turma-disc").innerHTML  = "";
  modal.style.display = "flex";
}

function profFiltrarSeries() {
  const nivel = document.getElementById("add-turma-nivel")?.value;
  const base  = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const series = [...new Set(
    base.filter(t => t.nivel === nivel).map(t => t.serie)
  )].sort((a,b) => +a - +b);
  const labelSerie = nivel === "medio" ? "Série" : "Ano";
  const serSel = document.getElementById("add-turma-serie");
  serSel.innerHTML = `<option value="">— selecione o ${labelSerie} —</option>` +
    series.map(s => `<option value="${s}">${s}${nivel==="medio"?"ª Série":"º Ano"}</option>`).join("");
  document.getElementById("add-turma-turma").innerHTML = "";
  document.getElementById("add-turma-disc").innerHTML  = "";
}

function profFiltrarTurmas() {
  const nivel = document.getElementById("add-turma-nivel")?.value;
  const serie = document.getElementById("add-turma-serie")?.value;
  if (!serie) return;
  const base  = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const turmas = base.filter(t => t.nivel === nivel && t.serie === serie)
    .sort((a,b) => a.turma.localeCompare(b.turma));
  const turmaSel = document.getElementById("add-turma-turma");
  turmaSel.innerHTML = `<option value="">— selecione a turma —</option>` +
    turmas.map(t => `<option value="${t.turma}|${t.subtitulo||""}|${t.periodo||"manha"}">
      Turma ${t.turma}${t.subtitulo?" "+t.subtitulo:""}
    </option>`).join("");
  profFiltrarDiscs();
}

function profFiltrarDiscs() {
  const serie = document.getElementById("add-turma-serie")?.value;
  if (!serie) return;
  const discs = _disciplinasDaSerie(serie);
  const discSel = document.getElementById("add-turma-disc");
  discSel.innerHTML = `<option value="">— selecione a disciplina —</option>` +
    discs.map(d => `<option value="${d.replace(/"/g,'&quot;')}">${d}</option>`).join("");
}

async function profConfirmarAdicionarTurma() {
  const nivel      = document.getElementById("add-turma-nivel")?.value;
  const serie      = document.getElementById("add-turma-serie")?.value;
  const turmaParts = (document.getElementById("add-turma-turma")?.value || "").split("|");
  const disciplina = document.getElementById("add-turma-disc")?.value;

  if (!nivel || !serie || !turmaParts[0] || !disciplina) {
    alert("Preencha todos os campos."); return;
  }

  const turma     = turmaParts[0];
  const subtitulo = turmaParts[1] || "";
  const periodo   = turmaParts[2] || "manha";

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const sigla   = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").substring(0,3).toUpperCase()
    || disciplina.substring(0,3).toUpperCase();

  // Verifica se já tem essa turma+disciplina
  const jaExiste = RT_TURMAS.find(t =>
    t.serie===serie && t.turma===turma && t.disciplina===disciplina && t.profUid===profUid
  );
  if (jaExiste) {
    alert("Você já tem esta disciplina nesta turma."); return;
  }

  const id = `${serie}${turma}_${sigla}_${profUid.substring(0,6)}_${Date.now()}`;
  RT_TURMAS.push({ id, serie, turma, subtitulo, disciplina, sigla, horarios:[], profUid, periodo, nivel });
  salvarTudo();
  renderizarSidebar();
  document.getElementById("modal-add-turma").style.display = "none";
  const sec = document.getElementById("g-minhas-turmas");
  if (sec) htmlProfTurmas().then(h => sec.innerHTML = h);
}

function profAbrirModalHorario(turmaKey, aula, diaSemana) {
  const DIAS = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  _gradeModalTurmaKey = turmaKey;
  _gradeModalAula     = aula;
  _gradeModalDia      = diaSemana;

  const [serie, turma] = turmaKey.split("|");
  const periodo = RT_PERIODOS.find(p => p.aula === aula);
  const sub = document.getElementById("modal-grade-subtitulo");
  if (sub) sub.textContent = `${DIAS[diaSemana]} · ${periodo?.label||aula} (${periodo?.inicio||""}) — ${serie}ª ${turma}`;

  // Mostra só as disciplinas do professor nesta turma
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const discNaTurma = RT_TURMAS.filter(t =>
    t.serie===serie && t.turma===turma && (t.profUid===uid||t.profUid===profUid)
  );
  const discSel = document.getElementById("modal-grade-disc");
  if (!discSel) return;
  discSel.innerHTML = discNaTurma.map(t =>
    `<option value="${t.id}">${t.disciplina} (${t.sigla})</option>`
  ).join("") || `<option value="">— adicione uma disciplina primeiro —</option>`;

  document.getElementById("modal-grade-aula").style.display = "flex";
}

async function profConfirmarHorario() {
  const turmaId = document.getElementById("modal-grade-disc")?.value;
  if (!turmaId) { alert("Selecione uma disciplina."); return; }

  const t = RT_TURMAS.find(x => x.id === turmaId);
  if (!t) return;

  const conflito = await _verificarConflitoHorario(t.serie, t.turma, _gradeModalDia, _gradeModalAula, turmaId);
  if (conflito) {
    document.getElementById("modal-grade-aula").style.display = "none";
    _mostrarModalConflito(conflito);
    return;
  }

  if (!t.horarios.find(h => h.diaSemana===_gradeModalDia && h.aula===_gradeModalAula)) {
    t.horarios.push({ diaSemana: _gradeModalDia, aula: _gradeModalAula });
  }
  salvarTudo();
  _invalidarHorariosCache();
  renderizarSidebar();
  document.getElementById("modal-grade-aula").style.display = "none";
  const sec = document.getElementById("g-minhas-turmas");
  if (sec) htmlProfTurmas().then(h => sec.innerHTML = h);
}

// profConfirmarAula mantido como alias de compatibilidade
async function profConfirmarAula() { return profConfirmarHorario(); }

function profRemoverTurma(turmaKey) {
  const [serie, turma] = turmaKey.split("|");
  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid||"anonimo");
  const minhas  = RT_TURMAS.filter(t => t.serie===serie && t.turma===turma && (t.profUid===uid||t.profUid===profUid));
  if (!minhas.length) return;
  if (!confirm(`Remover todas as disciplinas da ${serie}ª ${turma} do seu diário? Os registros de aulas serão mantidos.`)) return;
  for (const t of minhas) {
    const i = RT_TURMAS.indexOf(t);
    if (i >= 0) RT_TURMAS.splice(i, 1);
  }
  salvarTudo();
  renderizarSidebar();
  const sec = document.getElementById("g-minhas-turmas");
  if (sec) htmlProfTurmas().then(h => sec.innerHTML = h);
}

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
  const sec = document.getElementById("g-minhas-turmas");
  if (sec) htmlProfTurmas().then(h => sec.innerHTML = h);
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