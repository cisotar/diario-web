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

function htmlProfTurmas() {
  const DIAS = [
    { idx: 1, label: "Segunda" },
    { idx: 2, label: "Terça"   },
    { idx: 3, label: "Quarta"  },
    { idx: 4, label: "Quinta"  },
    { idx: 5, label: "Sexta"   },
  ];

  // Monta mapa com TODOS os horários de TODOS os professores
  // (para visualização de conflitos) — edição só é permitida nos próprios
  const uid = _userAtual?.uid;
  const ocupado = {};
  for (let ti = 0; ti < RT_TURMAS.length; ti++) {
    const t = RT_TURMAS[ti];
    const isPropia = t.profUid === uid;
    for (const h of (t.horarios || [])) {
      const chave = `${h.diaSemana}_${h.aula}`;
      if (!ocupado[chave]) {
        ocupado[chave] = { ti, turmaId: t.id, disciplina: t.disciplina, sigla: t.sigla, serie: t.serie, turma: t.turma, isPropia };
      }
    }
  }

  const renderTabela = (turno, labelTurno) => {
    const periodos = RT_PERIODOS.filter(p => (p.turno || "manha") === turno);
    const linhas = periodos.map(p => {
      const isIntervalo = p.label.toLowerCase().includes("interval");
      const cells = DIAS.map(dia => {
        const chave = `${dia.idx}_${p.aula}`;
        const oc    = ocupado[chave];
        if (oc) {
          const delBtn = oc.isPropia
            ? `<button type="button" class="grade-del-btn"
                onclick="profRemoverHorario('${oc.turmaId}','${p.aula}',${dia.idx})"
                title="Remover esta aula">×</button>`
            : "";
          const cellClass = oc.isPropia ? "grade-cell grade-ocupada" : "grade-cell grade-ocupada grade-ocupada-outro";
          return `<td class="${cellClass}" title="${oc.disciplina} — ${oc.serie}ª ${oc.turma}${oc.isPropia ? "" : " (outro professor)"}">
            <div class="grade-disc">${oc.sigla || oc.disciplina}</div>
            <div class="grade-turma">${oc.serie}ª ${oc.turma}</div>
            ${delBtn}
          </td>`;
        }
        }
        return `<td class="grade-cell grade-vazia"
          onclick="profAbrirModalAula(${dia.idx},'${p.aula}','${turno}')"
          title="Clique para registrar uma aula">
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

    return `
      <div class="grade-wrap">
        <div class="grade-titulo">${labelTurno}</div>
        <div style="overflow-x:auto">
          <table class="grade-tabela">
            <thead>
              <tr>
                <th class="grade-th-hora">Aula</th>
                ${DIAS.map(d => `<th>${d.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>`;
  };

  const tabelaManha = renderTabela("manha", "🌅 Manhã — 7h00");
  const tabelaTarde = renderTabela("tarde", "🌇 Tarde — 14h30");

  return `
    <div style="max-width:900px">
      <p class="gestao-hint">Clique em uma célula vazia para registrar uma aula. Passe o mouse sobre uma aula registrada para removê-la.</p>
      ${tabelaManha}
      <div style="margin-top:20px"></div>
      ${tabelaTarde}
    </div>

    <!-- Modal inserir aula -->
    <div id="modal-grade-aula" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:420px">
        <h3 class="modal-titulo">📅 Registrar aula</h3>
        <p id="modal-grade-subtitulo" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px"></p>
        <div class="modal-form">
          <label>Turma
            <select class="gi" id="modal-grade-turma" onchange="profAtualizarDiscSelect()"></select>
          </label>
          <label>Disciplina
            <select class="gi" id="modal-grade-disc"></select>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="document.getElementById('modal-grade-aula').style.display='none'">Cancelar</button>
          <button type="button" class="btn-modal-ok" onclick="profConfirmarAula()">Registrar</button>
        </div>
      </div>
    </div>`;
}

let _gradeModalDia = null, _gradeModalAula = null, _gradeModalTurno = null;

function profAbrirModalAula(diaSemana, aula, turno) {
  const DIAS = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  _gradeModalDia   = diaSemana;
  _gradeModalAula  = aula;
  _gradeModalTurno = turno;

  const periodo = RT_PERIODOS.find(p => p.aula === aula);
  const sub = document.getElementById("modal-grade-subtitulo");
  if (sub) sub.textContent = `${DIAS[diaSemana]} · ${periodo?.label || aula} (${periodo?.inicio || ""})`;

  // Preenche select de turmas
  const base   = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const turmasSel = document.getElementById("modal-grade-turma");
  if (!turmasSel) return;
  turmasSel.innerHTML = base
    .sort((a,b) => (+a.serie - +b.serie) || a.turma.localeCompare(b.turma))
    .map(tb => `<option value="${tb.serie}|${tb.turma}|${tb.subtitulo||""}|${tb.periodo||"manha"}">${tb.serie}ª ${tb.turma}${tb.subtitulo?" "+tb.subtitulo:""}</option>`)
    .join("");
  profAtualizarDiscSelect();

  document.getElementById("modal-grade-aula").style.display = "flex";
}

function profAtualizarDiscSelect() {
  const turmasSel = document.getElementById("modal-grade-turma");
  const discSel   = document.getElementById("modal-grade-disc");
  if (!turmasSel || !discSel) return;
  const [serie] = (turmasSel.value || "").split("|");
  const discs = _disciplinasDaSerie(serie);
  discSel.innerHTML = discs.map(d => `<option value="${d.replace(/"/g,'&quot;')}">${d}</option>`).join("")
    || `<option value="">— nenhuma disciplina cadastrada —</option>`;
}

async function profConfirmarAula() {
  const turmasSel = document.getElementById("modal-grade-turma");
  const discSel   = document.getElementById("modal-grade-disc");
  if (!turmasSel || !discSel) return;

  const [serie, turma, subtitulo, periodo] = turmasSel.value.split("|");
  const disciplina = discSel.value;
  if (!disciplina) { alert("Selecione uma disciplina."); return; }

  // Verifica conflito
  const conflito = await _verificarConflitoHorario(serie, turma, _gradeModalDia, _gradeModalAula, null);
  if (conflito) {
    document.getElementById("modal-grade-aula").style.display = "none";
    _mostrarModalConflito(conflito);
    return;
  }

  const uid     = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  const sigla   = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").substring(0,3).toUpperCase()
    || disciplina.substring(0,3).toUpperCase();

  // Encontra ou cria entrada de turma+disciplina
  let t = RT_TURMAS.find(x => x.serie===serie && x.turma===turma && x.disciplina===disciplina && x.profUid===profUid);
  if (!t) {
    const id = `${serie}${turma}_${sigla}_${profUid.substring(0,6)}_${Date.now()}`;
    t = { id, serie, turma, subtitulo, disciplina, sigla, horarios: [], profUid, periodo };
    RT_TURMAS.push(t);
  }

  // Adiciona horário
  if (!t.horarios.find(h => h.diaSemana===_gradeModalDia && h.aula===_gradeModalAula)) {
    t.horarios.push({ diaSemana: _gradeModalDia, aula: _gradeModalAula });
  }

  salvarTudo();
  renderizarSidebar();
  document.getElementById("modal-grade-aula").style.display = "none";
  document.getElementById("g-minhas-turmas").innerHTML = htmlProfTurmas();
}

function profRemoverHorario(turmaId, aula, diaSemana) {
  if (!confirm("Remover esta aula do horário?")) return;
  const ti = RT_TURMAS.findIndex(t => t.id === turmaId);
  if (ti < 0) return;
  RT_TURMAS[ti].horarios = RT_TURMAS[ti].horarios.filter(h => !(h.aula===aula && h.diaSemana===diaSemana));
  // Remove a entrada inteira se ficou sem horários e sem estado salvo
  if (RT_TURMAS[ti].horarios.length === 0) {
    const temEstado = Object.keys(estadoAulas).some(k => k.startsWith(turmaId));
    if (!temEstado) RT_TURMAS.splice(ti, 1);
  }
  salvarTudo();
  renderizarSidebar();
  document.getElementById("g-minhas-turmas").innerHTML = htmlProfTurmas();
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
  const t = RT_TURMAS[ti];
  if (!t) return;
  const novoHorario = { ...t.horarios[hi], [campo]: campo === "diaSemana" ? +val : val };
  const diaSemana = novoHorario.diaSemana;
  const aula      = novoHorario.aula;
  // Valida conflito antes de salvar
  _verificarConflitoHorario(t.serie, t.turma, diaSemana, aula, t.id).then(conflito => {
    if (conflito) {
      _mostrarModalConflito(conflito);
      return; // não salva
    }
    RT_TURMAS[ti].horarios[hi][campo] = campo === "diaSemana" ? +val : val;
    salvarTudo();
  });
}
function addHorario(ti) {
  const t      = RT_TURMAS[ti];
  const turno  = t.periodo || "manha";
  const prefixo = turno === "tarde" ? "t" : "m";
  const diaSemana = 1;
  const aula      = prefixo + "1";
  _verificarConflitoHorario(t.serie, t.turma, diaSemana, aula, t.id).then(conflito => {
    if (conflito) { _mostrarModalConflito(conflito); return; }
    RT_TURMAS[ti].horarios.push({ diaSemana, aula });
    salvarTudo();
    const el = document.getElementById("g-minhas-turmas");
    if (el) el.innerHTML = htmlProfTurmas();
  });
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