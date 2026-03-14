// GESTAO-ESCOLA.JS — Painel de Gestão ADM: turmas-base, disciplinas, períodos, bimestres
// Dependências: app-core.js

function abrirPainelGestao() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const papel = _papel();
  if (papel === "admin") {
    _abrirPainelEscola();
  } else if (papel === "professor") {
    _abrirPainelProfessor();
  } else if (papel === "coordenador") {
    _abrirPainelCoordenador();
  }
}

// ── Sidebar: admin tem dois botões ───────────────────────────
function _atualizarBotoesGestao() {
  const papel   = _papel();
  const isAdmin = papel === "admin";
  const btnEl   = document.getElementById("btn-gestao");
  if (!btnEl) return;
  if (isAdmin) {
    btnEl.innerHTML = "⚙ Painel de Gestão ADM";
    btnEl.onclick   = _abrirPainelEscola;
    // Adiciona botão "Meu Diário" se ainda não existe
    if (!document.getElementById("btn-meu-diario")) {
      const btn2 = document.createElement("button");
      btn2.className = "btn-gestao-sidebar";
      btn2.id        = "btn-meu-diario";
      btn2.textContent = "📓 Meu Diário";
      btn2.onclick   = _abrirPainelProfessor;
      btnEl.parentNode.insertBefore(btn2, btnEl.nextSibling);
    }
  } else if (papel === "professor") {
    btnEl.textContent = "⚙ Meu Painel";
    btnEl.onclick     = _abrirPainelProfessor;
  } else if (papel === "coordenador") {
    btnEl.textContent = "⚙ Painel";
    btnEl.onclick     = _abrirPainelCoordenador;
  }
}

// ════════════════════════════════════════════════════════════════
// PAINEL ESCOLA (admin only)
// Abas: Turmas · Disciplinas/Áreas · Períodos · Bimestres · Usuários · Diários
// ════════════════════════════════════════════════════════════════
function _abrirPainelEscola(abaInicial) {
  const aba = abaInicial || "turmas";
  const tabs = [
    { id:"turmas",      label:"🏫 Turmas",         fn: htmlEscolaTurmas      },
    { id:"disciplinas", label:"📚 Disciplinas",     fn: htmlEscolaDisciplinas },
    { id:"periodos",    label:"🕐 Períodos",         fn: htmlEscolaPeriodos    },
    { id:"bimestres",   label:"📅 Bimestres",        fn: htmlGestaoBimestres   },
    { id:"usuarios",    label:"👥 Usuários",          fn: htmlGestaoUsuarios, async: true },
    { id:"diarios",     label:"📋 Diários",           fn: htmlGestaoDiarios, async: true },
  ];
  _renderizarPainel("⚙ Painel de Gestão ADM", tabs, aba,
    `<button class="btn-exportar-js" onclick="exportarJS()" style="font-size:.8rem">⬇ aulas.js</button>`);
}

// ════════════════════════════════════════════════════════════════
// PAINEL PROFESSOR (professor e admin-como-professor)
// Abas: Minhas Turmas · Conteúdos · Meu Perfil
// ════════════════════════════════════════════════════════════════
function _abrirPainelProfessor(abaInicial) {
  const aba  = abaInicial || "minhas-turmas";
  const tabs = [
    { id:"minhas-turmas", label:"🗓 Minhas Turmas",  fn: htmlProfTurmas      },
    { id:"conteudos",     label:"📝 Conteúdos",       fn: htmlGestaoConteudos },
    { id:"perfil",        label:"👤 Meu Perfil",       fn: htmlGestaoPerfil    },
  ];
  _renderizarPainel("📓 Meu Diário", tabs, aba);
}

// ════════════════════════════════════════════════════════════════
// PAINEL COORDENADOR
// Abas: Diários · Bimestres
// ════════════════════════════════════════════════════════════════
function _abrirPainelCoordenador() {
  const tabs = [
    { id:"diarios",   label:"📋 Diários",    fn: htmlGestaoDiarios, async: true },
    { id:"bimestres", label:"📅 Bimestres",   fn: htmlGestaoBimestres },
  ];
  _renderizarPainel("⚙ Painel", tabs, "diarios");
}

// ── Motor genérico de painel com abas ───────────────────────────
function _renderizarPainel(titulo, tabs, abaAtiva, extraBtns) {
  const tabsHtml = tabs.map(t =>
    `<button class="gtab${t.id===abaAtiva?" ativo":""}"
       onclick="_trocarAba(this,'g-${t.id}','${t.id}')">${t.label}</button>`
  ).join("");

  const secoesHtml = tabs.map(t => {
    const conteudo = t.id === abaAtiva ? t.fn() : "";
    return `<div id="g-${t.id}" class="gestao-secao${t.id===abaAtiva?" ativa":""}"
      data-loaded="${t.id===abaAtiva?'1':'0'}">${conteudo}</div>`;
  }).join("");

  document.getElementById("conteudo-principal").innerHTML = `
    <div class="gestao-painel">
      <div class="gestao-header">
        <h1 class="gestao-titulo">${titulo}</h1>
        <div style="display:flex;gap:8px;align-items:center">
          ${extraBtns||""}
          <button class="btn-voltar" onclick="voltarPrincipal()">← Voltar</button>
        </div>
      </div>
      <div class="gestao-tabs">${tabsHtml}</div>
      ${secoesHtml}
    </div>`;

  // Pós-render para abas async (usuários, diários)
  if (abaAtiva === "usuarios")  _carregarUsuarios();
  if (abaAtiva === "diarios")   _carregarDiariosCoord();
}

function _trocarAba(btn, secId, abaId) {
  document.querySelectorAll(".gtab").forEach(b => b.classList.remove("ativo"));
  document.querySelectorAll(".gestao-secao").forEach(s => s.classList.remove("ativa"));
  btn.classList.add("ativo");
  const sec = document.getElementById(secId);
  sec.classList.add("ativa");
  if (sec.dataset.loaded === "1") return;
  sec.dataset.loaded = "1";
  // Renderiza conteúdo da aba sob demanda
  switch(abaId) {
    case "turmas":       sec.innerHTML = htmlEscolaTurmas();       break;
    case "disciplinas":  sec.innerHTML = htmlEscolaDisciplinas();  break;
    case "periodos":     sec.innerHTML = htmlEscolaPeriodos();     break;
    case "bimestres":    sec.innerHTML = htmlGestaoBimestres();    break;
    case "perfil":       sec.innerHTML = htmlGestaoPerfil();       break;
    case "conteudos":    sec.innerHTML = htmlGestaoConteudos();    break;
    case "minhas-turmas": sec.innerHTML = htmlProfTurmas();        break;
    case "usuarios":     sec.innerHTML = htmlGestaoUsuarios(); _carregarUsuarios();  break;
    case "diarios":      sec.innerHTML = htmlGestaoDiarios();  _carregarDiariosCoord(); break;
  }
}

// Alias para compatibilidade com código legado
function abrirGTab(btn, secId) {
  const abaId = secId.replace("g-", "");
  _trocarAba(btn, secId, abaId);
}

function voltarPrincipal() {
  renderizarSidebar();
  if (turmaAtiva) renderizarConteudo(); else renderizarBemVindo();
}

// ════════════════════════════════════════════════════════════════
// ABA: TURMAS DA ESCOLA (admin — turmas-base sem disciplina)
// ════════════════════════════════════════════════════════════════
function htmlEscolaTurmas() {
  const base = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const rows = base.map((tb, i) => {
    const perOpts = ["manha","tarde"].map(p =>
      `<option value="${p}" ${(tb.periodo||"manha")===p?"selected":""}>${p==="manha"?"Manhã":"Tarde"}</option>`
    ).join("");
    return `<tr>
      <td><input class="gi gi-xs" value="${tb.serie}" onchange="editTurmaBase(${i},'serie',this.value)" style="width:44px"/></td>
      <td><input class="gi gi-xs" value="${tb.turma}" onchange="editTurmaBase(${i},'turma',this.value)" style="width:44px"/></td>
      <td><input class="gi gi-sm" value="${tb.subtitulo||''}" placeholder="ADM, HUM…" onchange="editTurmaBase(${i},'subtitulo',this.value)"/></td>
      <td><select class="gi gi-sm" onchange="editTurmaBase(${i},'periodo',this.value)">${perOpts}</select></td>
      <td><button class="btn-icon-del" onclick="delTurmaBase(${i})">🗑</button></td>
    </tr>`;
  }).join("");

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Turmas da escola</h3>
        <button class="btn-add" onclick="addTurmaBase()">+ Nova turma</button>
      </div>
      <p class="gestao-hint">Cadastre aqui as turmas (séries e divisões). Os professores adicionarão suas disciplinas.</p>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr><th>Série</th><th>Turma</th><th>Subtítulo</th><th>Turno</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="td-vazio">Nenhuma turma cadastrada.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function editTurmaBase(i, campo, val) {
  if (!RT_CONFIG.turmasBase) RT_CONFIG.turmasBase = [...(TURMAS_BASE||[])];
  RT_CONFIG.turmasBase[i][campo] = val;
  _salvarConfigEscola();
}
function delTurmaBase(i) {
  if (!RT_CONFIG.turmasBase) RT_CONFIG.turmasBase = [...(TURMAS_BASE||[])];
  const tb = RT_CONFIG.turmasBase[i];
  if (!confirm(`Excluir ${tb.serie}ª ${tb.turma}?`)) return;
  RT_CONFIG.turmasBase.splice(i, 1);
  _salvarConfigEscola();
  document.getElementById("g-turmas").innerHTML = htmlEscolaTurmas();
}
function addTurmaBase() {
  if (!RT_CONFIG.turmasBase) RT_CONFIG.turmasBase = [...(TURMAS_BASE||[])];
  RT_CONFIG.turmasBase.push({ serie:"1", turma:"A", subtitulo:"", periodo:"manha" });
  _salvarConfigEscola();
  document.getElementById("g-turmas").innerHTML = htmlEscolaTurmas();
}

// ════════════════════════════════════════════════════════════════
// ABA: DISCIPLINAS / ÁREAS (admin)
// Estrutura: por série → por área → lista de disciplinas
// ════════════════════════════════════════════════════════════════
function htmlEscolaDisciplinas() {
  const series   = ["1","2","3"];
  const areasConf = RT_CONFIG.areasConhecimento || AREAS_CONHECIMENTO;

  // Bloco 1: editar as áreas do conhecimento por série
  const blocoAreas = series.map(s => {
    const areasRows = areasConf.map((a, ai) => {
      const discsSerie = (RT_CONFIG.disciplinasPorSerie?.[s]?.[a.id] || []).join("\n");
      return `<tr>
        <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${a.label}</td>
        <td><textarea class="gi disc-textarea" rows="3"
          placeholder="Uma por linha ou separadas por ;"
          onchange="editDiscsPorArea('${s}','${a.id}',this.value)"
          onblur="editDiscsPorArea('${s}','${a.id}',this.value)">${discsSerie.replace(/</g,'&lt;')}</textarea></td>
      </tr>`;
    }).join("");
    return `
      <div class="gestao-bloco" style="margin-bottom:12px">
        <h4 style="margin-bottom:8px">${s}ª Série</h4>
        <div class="tabela-wrapper">
          <table class="tabela-gestao" style="min-width:0">
            <thead><tr><th>Área</th><th>Disciplinas (separe por ;)</th></tr></thead>
            <tbody>${areasRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  // Bloco 2: editar as próprias áreas do conhecimento
  const areasRows = areasConf.map((a, ai) => `
    <tr>
      <td><input class="gi gi-sm" value="${a.id}" onchange="editAreaId(${ai},this.value)" placeholder="humanas"/></td>
      <td><input class="gi" value="${a.label}" onchange="editAreaLabel(${ai},this.value)" placeholder="Ciências Humanas"/></td>
      <td><button class="btn-icon-del" onclick="delArea(${ai})">🗑</button></td>
    </tr>`).join("");

  return `
    <div class="gestao-bloco" style="margin-bottom:20px">
      <div class="gestao-bloco-header">
        <h3>Disciplinas por série e área</h3>
      </div>
      <p class="gestao-hint">Informe quais disciplinas existem em cada série, agrupadas por área do conhecimento.</p>
      ${blocoAreas}
    </div>
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Áreas do conhecimento</h3>
        <button class="btn-add" onclick="addArea()">+ Nova área</button>
      </div>
      <p class="gestao-hint">As áreas são globais — valem para todas as séries.</p>
      <div class="tabela-wrapper">
        <table class="tabela-gestao" style="min-width:0">
          <thead><tr><th>ID (sem espaços)</th><th>Nome exibido</th><th></th></tr></thead>
          <tbody>${areasRows}</tbody>
        </table>
      </div>
    </div>`;
}

function editDiscsPorArea(serie, areaId, valor) {
  if (!RT_CONFIG.disciplinasPorSerie)        RT_CONFIG.disciplinasPorSerie = {};
  if (!RT_CONFIG.disciplinasPorSerie[serie]) RT_CONFIG.disciplinasPorSerie[serie] = {};
  // Aceita separação por ; ou por quebra de linha
  RT_CONFIG.disciplinasPorSerie[serie][areaId] = valor
    .split(/;|\n/).map(s => s.trim()).filter(Boolean);
  _salvarConfigEscola();
  _mostrarIndicadorSync("✓ Disciplinas salvas");
}
function editAreaId(i, val) {
  const areas = RT_CONFIG.areasConhecimento || (RT_CONFIG.areasConhecimento = [...AREAS_CONHECIMENTO]);
  areas[i].id = val.replace(/\s/g,"").toLowerCase();
  _salvarConfigEscola();
}
function editAreaLabel(i, val) {
  const areas = RT_CONFIG.areasConhecimento || (RT_CONFIG.areasConhecimento = [...AREAS_CONHECIMENTO]);
  areas[i].label = val;
  _salvarConfigEscola();
}
function delArea(i) {
  const areas = RT_CONFIG.areasConhecimento || (RT_CONFIG.areasConhecimento = [...AREAS_CONHECIMENTO]);
  if (!confirm(`Excluir a área "${areas[i].label}"?`)) return;
  areas.splice(i, 1);
  _salvarConfigEscola();
  document.getElementById("g-disciplinas").innerHTML = htmlEscolaDisciplinas();
}
function addArea() {
  if (!RT_CONFIG.areasConhecimento) RT_CONFIG.areasConhecimento = [...AREAS_CONHECIMENTO];
  RT_CONFIG.areasConhecimento.push({ id:"nova", label:"Nova área" });
  _salvarConfigEscola();
  document.getElementById("g-disciplinas").innerHTML = htmlEscolaDisciplinas();
}

// ════════════════════════════════════════════════════════════════
// ABA: PERÍODOS (admin)
// ════════════════════════════════════════════════════════════════