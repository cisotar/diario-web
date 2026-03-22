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

  // Esconde completamente para professores comuns
  if (papel === "professor") {
    btnEl.style.display = "none";
    return;
  }

  btnEl.style.display = "";
  if (isAdmin) {
    btnEl.innerHTML = "⚙ Painel de Gestão ADM";
    btnEl.onclick   = _abrirPainelEscola;
    if (!document.getElementById("btn-meu-diario")) {
      const btn2 = document.createElement("button");
      btn2.className = "btn-gestao-sidebar";
      btn2.id        = "btn-meu-diario";
      btn2.textContent = "👨‍🏫 Painel Professor";
      btn2.onclick   = _abrirPainelProfessor;
      btnEl.parentNode.insertBefore(btn2, btnEl.nextSibling);
    }
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
    { id:"alunos",      label:"👤 Alunos",           fn: htmlEscolaAlunos, async: true },
    { id:"disciplinas", label:"📚 Disciplinas",     fn: htmlEscolaDisciplinas },
    { id:"periodos",    label:"🕐 Períodos",         fn: htmlEscolaPeriodos    },
    { id:"bimestres",   label:"📅 Bimestres",        fn: htmlGestaoBimestres   },
    { id:"usuarios",    label:"👥 Usuários",          fn: htmlGestaoUsuarios, async: true },
    { id:"diarios",     label:"📋 Diários",           fn: htmlGestaoDiarios, async: true },
    { id:"migracao",    label:"🔄 Migração",          fn: htmlGestaoMigracao, async: true },
  ];
  _renderizarPainel("⚙ Painel de Gestão ADM", tabs, aba,
    `<button class="btn-exportar-js" onclick="exportarJS()" style="font-size:.8rem">⬇ aulas.js</button>`);
}

// ════════════════════════════════════════════════════════════════
// PAINEL PROFESSOR (professor e admin-como-professor)
// Abas: Minhas Turmas · Conteúdos · Meu Perfil
// ════════════════════════════════════════════════════════════════
// Ativa modo professor para o admin — carrega diário pessoal (diario/{uid})
function _abrirPainelProfessor(abaInicial) {
  const aba  = abaInicial || "minhas-turmas";
  const tabs = [
    { id:"minhas-turmas", label:"🗓 Minhas Turmas",  fn: htmlProfTurmas      },
    { id:"conteudos",     label:"📝 Conteúdos",       fn: htmlGestaoConteudos },
    { id:"perfil",        label:"👤 Meu Perfil",       fn: htmlGestaoPerfil    },
  ];
  _renderizarPainel("👨‍🏫 Painel Professor", tabs, aba);
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
    case "alunos":       htmlEscolaAlunos().then(h => sec.innerHTML = h); break;
    case "disciplinas":  sec.innerHTML = htmlEscolaDisciplinas();  break;
    case "periodos":     sec.innerHTML = htmlEscolaPeriodos();     break;
    case "bimestres":    sec.innerHTML = htmlGestaoBimestres();    break;
    case "perfil":       sec.innerHTML = htmlGestaoPerfil();       break;
    case "conteudos":    sec.innerHTML = htmlGestaoConteudos();    break;
    case "minhas-turmas": sec.innerHTML = htmlProfTurmas();        break;
    case "usuarios":     sec.innerHTML = htmlGestaoUsuarios(); _carregarUsuarios();  break;
    case "diarios":      sec.innerHTML = htmlGestaoDiarios();  _carregarDiariosCoord(); break;
    case "migracao":     htmlGestaoMigracao().then(h => sec.innerHTML = h); break;
  }
}

// Alias para compatibilidade com código legado
function abrirGTab(btn, secId) {
  const abaId = secId.replace("g-", "");
  _trocarAba(btn, secId, abaId);
}

// Abre o cronograma de um professor específico em modo leitura (somente admin)
function abrirDiarioProf(uid, turmaId) {
  const dados = _diariosAssociados[uid];
  if (!dados) { alert("Diário não carregado. Reabra a aba Diários."); return; }

  // Salva contexto atual do admin para restaurar depois
  const _rtTurmasAntes    = RT_TURMAS;
  const _rtConteudosAntes = RT_CONTEUDOS;
  const _estadoAntes      = estadoAulas;
  const _ordemAntes       = ordemConteudos;

  // Carrega dados do professor temporariamente
  RT_TURMAS      = dados.RT_TURMAS;
  RT_CONTEUDOS   = dados.RT_CONTEUDOS;
  estadoAulas    = dados.estadoAulas;
  ordemConteudos = dados.ordemConteudos;

  const t = RT_TURMAS.find(x => x.id === turmaId);
  if (!t) { alert("Turma não encontrada no diário."); return; }

  turmaAtiva     = t;
  bimestreAtivo  = RT_BIMESTRES[0]?.bimestre || 1;

  // Renderiza o cronograma em modo leitura
  renderizarConteudo();

  // Adiciona banner de modo leitura e botão voltar
  const main = document.getElementById("conteudo-principal");
  const banner = document.createElement("div");
  banner.style.cssText = "background:var(--amber-light,#f0a84a);color:#7a4a00;padding:8px 16px;font-size:.82rem;display:flex;align-items:center;gap:12px;";
  banner.innerHTML = `
    <span>👁 Modo leitura — diário de <strong>${dados.perfil.nome||uid}</strong></span>
    <button type="button" onclick="restaurarContextoAdmin()"
      style="margin-left:auto;background:#fff;border:1px solid #c97d20;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:.8rem;">
      ← Voltar aos Diários
    </button>`;
  main.insertBefore(banner, main.firstChild);

  // Guarda função de restauração
  window._restaurarCtx = () => {
    RT_TURMAS      = _rtTurmasAntes;
    RT_CONTEUDOS   = _rtConteudosAntes;
    estadoAulas    = _estadoAntes;
    ordemConteudos = _ordemAntes;
    turmaAtiva     = null;
    window._restaurarCtx = null;
    _abrirPainelEscola("diarios");
  };
}

function restaurarContextoAdmin() {
  if (window._restaurarCtx) window._restaurarCtx();
  else voltarPrincipal();
}

function voltarPrincipal() {
  renderizarSidebar();
  if (turmaAtiva) renderizarConteudo(); else renderizarBemVindo();
}

// ════════════════════════════════════════════════════════════════
// ABA: TURMAS DA ESCOLA (admin — turmas-base sem disciplina)
// ════════════════════════════════════════════════════════════════
function _turmasBaseInit() {
  if (!RT_CONFIG) RT_CONFIG = {};
  if (!RT_CONFIG.turmasBase) {
    const seed = (typeof TURMAS_BASE !== "undefined" ? TURMAS_BASE : []);
    RT_CONFIG.turmasBase = JSON.parse(JSON.stringify(seed));
  }
  // Garante que todas as entradas têm nivel (migração legado)
  RT_CONFIG.turmasBase = RT_CONFIG.turmasBase.map(t => ({ nivel: t.nivel || "medio", ...t }));
  return RT_CONFIG.turmasBase;
}

function _recarregarTurmas() {
  const el = document.getElementById("g-turmas");
  if (el) el.innerHTML = htmlEscolaTurmas();
}

// ── htmlEscolaTurmas ─────────────────────────────────────────
// Dois blocos: Ensino Médio (1ª–3ª série) e Ensino Fundamental (5º–9º ano)
// Cada bloco lista as séries/anos; cada série lista suas turmas inline.
function htmlEscolaTurmas() {
  const base = _turmasBaseInit();
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const blocoNivel = (nivel, labelNivel, labelSerie) => {
    // Agrupa por série
    const series = [...new Set(base.filter(t=>t.nivel===nivel).map(t=>t.serie))].sort((a,b)=>+a-+b);

    const seriesHtml = series.map(serie => {
      const turmas = base.filter(t => t.nivel===nivel && t.serie===serie);
      const sufixo = nivel==="medio" ? "ª Série" : "º Ano";

      const turmasHtml = turmas.map(tb => {
        const i = base.indexOf(tb);
        const perOpts = ["manha","tarde"].map(p =>
          `<option value="${p}" ${(tb.periodo||"manha")===p?"selected":""}>${p==="manha"?"Manhã":"Tarde"}</option>`
        ).join("");
        return `
          <div class="turma-inline-linha">
            <span class="turma-inline-label">Turma</span>
            <input class="gi gi-xs" value="${tb.turma}" style="width:44px"
              onchange="editTurmaBase(${i},'turma',this.value)" placeholder="A"/>
            <input class="gi gi-sm" value="${tb.subtitulo||''}" placeholder="subtítulo opcional"
              onchange="editTurmaBase(${i},'subtitulo',this.value)"/>
            <select class="gi gi-sm" onchange="editTurmaBase(${i},'periodo',this.value)">${perOpts}</select>
            <button type="button" class="btn-icon-del" onclick="delTurmaBase(${i})">×</button>
          </div>`;
      }).join("");

      return `
        <div class="serie-bloco">
          <div class="serie-bloco-header">
            <strong>${serie}${sufixo}</strong>
            <button type="button" class="btn-add-small"
              onclick="addTurmaNoSerie('${nivel}','${serie}')">+ Turma</button>
            <button type="button" class="btn-icon-del"
              onclick="delSerie('${nivel}','${serie}')">🗑 série</button>
          </div>
          <div class="serie-turmas-wrap">${turmasHtml}</div>
        </div>`;
    }).join("");

    return `
      <div class="gestao-bloco" style="margin-bottom:16px">
        <div class="gestao-bloco-header">
          <h3>${labelNivel}</h3>
          <button type="button" class="btn-add" onclick="addSerie('${nivel}')">+ ${labelSerie}</button>
        </div>
        <p class="gestao-hint">Adicione as séries e as turmas de cada uma.</p>
        ${seriesHtml || '<p class="gestao-hint" style="margin:0">Nenhuma série cadastrada.</p>'}
      </div>`;
  };

  return blocoNivel("medio","📘 Ensino Médio","Série") +
         blocoNivel("fundamental","📗 Ensino Fundamental","Ano") +
         `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-exportar-js" onclick="baixarTurmasGlobal()">⬇ turmas_global.js</button>
            <button type="button" class="btn-exportar-js" onclick="baixarTurmas()">⬇ turmas.js</button>
          </div>`;
}

async function editTurmaBase(i, campo, val) {
  const base = _turmasBaseInit();
  if (!base[i]) return;
  base[i][campo] = val;
  await _salvarConfigEscola();

  // Propaga subtítulo e período para as entradas do diário correspondentes
  if (campo === "subtitulo" || campo === "periodo") {
    const tb = base[i];
    let alterou = false;
    for (const t of RT_TURMAS) {
      if (t.serie === tb.serie && t.turma === tb.turma) {
        if (campo === "subtitulo" && t.subtitulo !== val) {
          t.subtitulo = val;
          alterou = true;
        }
        if (campo === "periodo" && t.periodo !== val) {
          t.periodo = val;
          alterou = true;
        }
      }
    }
    if (alterou) {
      salvarTudo();
      // Propaga também para diários de outros professores no Firestore
      _propagarCampoTurmaFirestore(tb.serie, tb.turma, campo, val);
      _mostrarIndicadorSync(`✓ ${campo === "subtitulo" ? "Subtítulo" : "Período"} propagado para todos os diários`);
    }
  }
}

// Atualiza campo em todas as entradas RT_TURMAS de todos os professores no Firestore
async function _propagarCampoTurmaFirestore(serie, turma, campo, val) {
  try {
    const db = firebase.firestore();
    const profs = await db.collection("professores").where("status","==","aprovado").get();
    for (const doc of profs.docs) {
      if (_isAdmin(doc.data().email)) continue;
      const uid = doc.id;
      const diarioRef = db.collection("diario").doc(uid);
      const diarioSnap = await diarioRef.get();
      if (!diarioSnap.exists) continue;
      const d = diarioSnap.data();
      if (!d.RT_TURMAS) continue;
      const turmas = JSON.parse(d.RT_TURMAS);
      let alterou = false;
      for (const t of turmas) {
        if (t.serie === serie && t.turma === turma && t[campo] !== val) {
          t[campo] = val;
          alterou = true;
        }
      }
      if (alterou) {
        await diarioRef.update({ RT_TURMAS: JSON.stringify(turmas) });
        console.log(`[propagação] ${campo}="${val}" aplicado em diario/${uid}`);
      }
    }
  } catch(e) { console.warn("Erro ao propagar campo:", e); }
}

function delTurmaBase(i) {
  const base = _turmasBaseInit();
  if (!confirm("Excluir esta turma?")) return;
  base.splice(i, 1);
  _salvarConfigEscola();
  _recarregarTurmas();
}

function delSerie(nivel, serie) {
  const base = _turmasBaseInit();
  const label = nivel==="medio" ? serie+"ª Série" : serie+"º Ano";
  if (!confirm("Excluir "+label+" e todas as suas turmas?")) return;
  RT_CONFIG.turmasBase = base.filter(t => !(t.nivel===nivel && t.serie===serie));
  _salvarConfigEscola();
  _recarregarTurmas();
}

async function addSerie(nivel) {
  try {
    const base = _turmasBaseInit();
    // Descobre o próximo número de série/ano
    const seriesExist = base.filter(t=>t.nivel===nivel).map(t=>+t.serie);
    const proximaSerie = seriesExist.length
      ? String(Math.max(...seriesExist) + 1)
      : (nivel==="medio" ? "1" : "5");
    // Já cria com turma A
    base.push({ nivel, serie: proximaSerie, turma:"A", subtitulo:"", periodo:"manha" });
    await _salvarConfigEscola();
    _recarregarTurmas();
  } catch(e) { console.error("addSerie:", e); alert("Erro: "+e.message); }
}

async function addTurmaNoSerie(nivel, serie) {
  try {
    const base = _turmasBaseInit();
    // Próxima letra de turma
    const turmasExist = base.filter(t=>t.nivel===nivel && t.serie===serie).map(t=>t.turma);
    const proxLetra = turmasExist.length
      ? String.fromCharCode(Math.max(...turmasExist.map(t=>t.charCodeAt(0))) + 1)
      : "A";
    base.push({ nivel, serie, turma: proxLetra, subtitulo:"", periodo:"manha" });
    await _salvarConfigEscola();
    _recarregarTurmas();
  } catch(e) { console.error("addTurmaNoSerie:", e); alert("Erro: "+e.message); }
}

// Mantém compatibilidade com chamadas antigas
async function addTurmaBase() { await addSerie("medio"); }


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
      <td><button type="button" class="btn-icon-del" onclick="delArea(${ai})">🗑</button></td>
    </tr>`).join("");

  return `
    <div class="gestao-bloco" style="margin-bottom:20px">
      <div class="gestao-bloco-header">
        <h3>Áreas do conhecimento</h3>
        <button type="button" class="btn-add" onclick="addArea()">+ Nova área</button>
      </div>
      <p class="gestao-hint">Defina as áreas antes de cadastrar as disciplinas. São globais — valem para todas as séries.</p>
      <div class="tabela-wrapper">
        <table class="tabela-gestao" style="min-width:0">
          <thead><tr><th>ID (sem espaços)</th><th>Nome exibido</th><th></th></tr></thead>
          <tbody>${areasRows}</tbody>
        </table>
      </div>
    </div>
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Disciplinas por série e área</h3>
      </div>
      <p class="gestao-hint">Informe quais disciplinas existem em cada série, agrupadas por área do conhecimento.</p>
      ${blocoAreas}
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
async function addArea() {
  try {
    if (!RT_CONFIG) RT_CONFIG = {};
    if (!RT_CONFIG.areasConhecimento) RT_CONFIG.areasConhecimento = JSON.parse(JSON.stringify(typeof AREAS_CONHECIMENTO !== "undefined" ? AREAS_CONHECIMENTO : []));
    RT_CONFIG.areasConhecimento.push({ id:"nova-area", label:"Nova área" });
    await _salvarConfigEscola();
    const el = document.getElementById("g-disciplinas");
    if (el) el.innerHTML = htmlEscolaDisciplinas();
    else _abrirPainelEscola("disciplinas");
  } catch(e) { console.error("addArea erro:", e); alert("Erro: " + e.message); }
}

// ════════════════════════════════════════════════════════════════
// ABA: PERÍODOS (admin)
// ════════════════════════════════════════════════════════════════

function _cfgPeriodosDefault() {
  return {
    manha: { inicio:"07:00", duracao:50, qtd:5, intervalos:[{apos:3,duracao:20}] },
    tarde: { inicio:"14:30", duracao:50, qtd:5, intervalos:[{apos:3,duracao:20}] },
  };
}
function _garantirCfgPeriodos() {
  if (!RT_CONFIG.configPeriodos) RT_CONFIG.configPeriodos = _cfgPeriodosDefault();
  return RT_CONFIG.configPeriodos;
}

function htmlEscolaPeriodos() {
  const cfg = RT_CONFIG.configPeriodos || _cfgPeriodosDefault();

  const blocoTurno = (turno, label) => {
    const c = cfg[turno] || {};
    const ivs = c.intervalos || [];
    const intervalosHtml = ivs.map((iv, ii) => `
      <div class="intervalo-linha" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <span style="font-size:.78rem;color:var(--text-muted)">após aula nº</span>
        <input class="gi gi-xs" type="number" min="1" max="20" value="${iv.apos||1}" style="width:52px"
          onchange="editCfgIntervalo('${turno}',${ii},'apos',+this.value)"/>
        <span style="font-size:.78rem;color:var(--text-muted)">início</span>
        <input class="gi gi-xs" type="time" value="${iv.inicio||''}" style="width:90px"
          placeholder="auto"
          onchange="editCfgIntervalo('${turno}',${ii},'inicio',this.value)"
          title="Deixe em branco para calcular automaticamente"/>
        <span style="font-size:.78rem;color:var(--text-muted)">duração (min)</span>
        <input class="gi gi-xs" type="number" min="0" max="120" value="${iv.duracao||10}" style="width:52px"
          onchange="editCfgIntervalo('${turno}',${ii},'duracao',+this.value)"/>
        <button type="button" class="btn-icon-del" onclick="delCfgIntervalo('${turno}',${ii})">×</button>
      </div>`).join("");

    const _periodos = _gerarPeriodosDeConfig({ [turno]: c });
    const _ivs = c.intervalos || [];
    const _previewItems = [];
    _periodos.forEach((p, pi) => {
      _previewItems.push(`<div class="periodo-preview-item"><strong>${p.label}</strong> ${p.inicio}–${p.fim}</div>`);
      _ivs.forEach(iv => {
        if (iv.apos === pi + 1) {
          const iIni = iv.inicio || p.fim;
          const iMins = iIni.split(":").reduce((a,v,i)=>i===0?+v*60:a+ +v,0) + (iv.duracao||0);
          const iFim = String(Math.floor(iMins/60)).padStart(2,"0")+":"+String(iMins%60).padStart(2,"0");
          _previewItems.push(`<div class="periodo-preview-item periodo-preview-intervalo">☕ Intervalo ${iIni}–${iFim} (${iv.duracao||0}min)</div>`);
        }
      });
    });
    const preview = _previewItems.join("");

    return `
      <div class="gestao-bloco" style="margin-bottom:16px">
        <h4 style="margin-bottom:12px">${label}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:14px">
          <label class="disc-area-label">Início
            <input class="gi" type="time" value="${c.inicio||"07:00"}"
              onchange="editCfgPeriodo('${turno}','inicio',this.value)"/>
          </label>
          <label class="disc-area-label">Duração da aula (min)
            <input class="gi" type="number" min="30" max="120" value="${c.duracao||50}"
              onchange="editCfgPeriodo('${turno}','duracao',+this.value)"/>
          </label>
          <label class="disc-area-label">Nº de aulas
            <input class="gi" type="number" min="1" max="20" value="${c.qtd||5}"
              onchange="editCfgPeriodo('${turno}','qtd',+this.value)"/>
          </label>
        </div>
        <div style="margin-bottom:8px">
          <div style="font-size:.8rem;font-weight:600;margin-bottom:6px">Intervalos</div>
          <div id="ivs-${turno}">${intervalosHtml || '<p class="gestao-hint" style="margin:0">Nenhum intervalo.</p>'}</div>
          <button type="button" class="btn-add-small" onclick="addCfgIntervalo('${turno}')">+ Intervalo</button>
        </div>
        <div class="periodo-preview" id="preview-${turno}">${preview}</div>
      </div>`;
  };

  return `
    <div style="max-width:760px">
      <p class="gestao-hint">Configure os turnos. As aulas são calculadas automaticamente. Intervalos são inseridos após a aula indicada.</p>
      ${blocoTurno("manha","🌅 Manhã")}
      ${blocoTurno("tarde","🌇 Tarde")}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn-modal-ok" onclick="_salvarConfigPeriodos()">Salvar e aplicar</button>
        <button type="button" class="btn-exportar-js" onclick="baixarPeriodos()">⬇ periodos.js</button>
      </div>
    </div>`;
}

function editCfgPeriodo(turno, campo, val) {
  const cfg = _garantirCfgPeriodos();
  cfg[turno][campo] = val;
  _atualizarPreviewPeriodo(turno);
}
function editCfgIntervalo(turno, idx, campo, val) {
  const cfg = _garantirCfgPeriodos();
  if (!cfg[turno].intervalos) cfg[turno].intervalos = [];
  if (!cfg[turno].intervalos[idx]) cfg[turno].intervalos[idx] = {};
  cfg[turno].intervalos[idx][campo] = val;
  _atualizarPreviewPeriodo(turno);
}
function addCfgIntervalo(turno) {
  const cfg = _garantirCfgPeriodos();
  if (!cfg[turno].intervalos) cfg[turno].intervalos = [];
  const qtd = cfg[turno].qtd || 5;
  const ultimo = cfg[turno].intervalos.slice(-1)[0];
  cfg[turno].intervalos.push({ apos: ultimo ? Math.min(ultimo.apos+1, qtd) : 3, duracao: 20 });
  document.getElementById("g-periodos").innerHTML = htmlEscolaPeriodos();
}
function delCfgIntervalo(turno, idx) {
  const cfg = _garantirCfgPeriodos();
  cfg[turno].intervalos.splice(idx, 1);
  document.getElementById("g-periodos").innerHTML = htmlEscolaPeriodos();
}
function _atualizarPreviewPeriodo(turno) {
  const el = document.getElementById("preview-"+turno);
  if (!el || !RT_CONFIG.configPeriodos) return;
  const c = RT_CONFIG.configPeriodos[turno];
  const periodos = _gerarPeriodosDeConfig({ [turno]: c });
  const ivs = c.intervalos || [];
  const items = [];
  periodos.forEach((p, pi) => {
    items.push(`<div class="periodo-preview-item"><strong>${p.label}</strong> ${p.inicio}–${p.fim}</div>`);
    ivs.forEach(iv => {
      if (iv.apos === pi + 1) {
        const iIni = iv.inicio || p.fim;
        const iMins = iIni.split(":").reduce((a,v,i)=>i===0?+v*60:a+ +v,0) + (iv.duracao||0);
        const iFim = String(Math.floor(iMins/60)).padStart(2,"0")+":"+String(iMins%60).padStart(2,"0");
        items.push(`<div class="periodo-preview-item periodo-preview-intervalo">☕ Intervalo ${iIni}–${iFim} (${iv.duracao||0}min)</div>`);
      }
    });
  });
  el.innerHTML = items.join("");
}
async function _salvarConfigPeriodos() {
  const cfg = _garantirCfgPeriodos();
  RT_PERIODOS = _gerarPeriodosDeConfig(cfg);
  await _salvarConfigEscola();
  _mostrarIndicadorSync("✓ Períodos salvos e aplicados");
}

// ════════════════════════════════════════════════════════════════
// ABA: MINHAS TURMAS (professor)
// Página com lista de turmas-base; professor associa disciplina,
// sigla e horários inline — sem janela de diálogo.
// ════════════════════════════════════════════════════════════════
// Retorna lista flat de disciplinas cadastradas pelo admin para uma série

// ════════════════════════════════════════════════════════════════
// ABA: ALUNOS (admin) — gerenciar alunos por turma
// ════════════════════════════════════════════════════════════════

let _alunosTurmaAtiva = null;  // chave da turma exibida na aba alunos

async function htmlEscolaAlunos() {
  const base = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const turmas = [...base].sort((a,b) => (+a.serie - +b.serie) || a.turma.localeCompare(b.turma));

  if (!_alunosTurmaAtiva && turmas.length) {
    _alunosTurmaAtiva = turmas[0].serie + turmas[0].turma;
  }

  const tabsTurmas = turmas.map(tb => {
    const key = tb.serie + tb.turma;
    return `<button type="button" class="tab-bim ${key === _alunosTurmaAtiva ? "ativo" : ""}"
      onclick="_alunosTurmaAtiva='${key}';_recarregarAbaAlunos()">${tb.serie}ª ${tb.turma}</button>`;
  }).join("");

  let corpoAlunos = "";
  if (_alunosTurmaAtiva) {
    const lista = await _carregarAlunos(_alunosTurmaAtiva);
    const SITUACOES = ["","AB","NC","TR","RM","RC","EE"];
    const SITUACAO_LABEL = { "":"Matriculado","AB":"Abandonou","NC":"Não compareceu","TR":"Transferido","RM":"Remanejado","RC":"Reclassificado","EE":"Educação Especial" };

    const rows = lista.map((a, idx) => {
      const sitOpts = SITUACOES.map(s =>
        `<option value="${s}" ${(a.situacao||"") === s ? "selected" : ""}>${s||"—"} ${SITUACAO_LABEL[s]||""}</option>`
      ).join("");
      return `<tr class="${a.situacao ? "aluno-inativo" : ""}">
        <td class="td-numero">${a.num}</td>
        <td><input class="gi" value="${(a.nome||"").replace(/"/g,'&quot;')}"
          onchange="gestaoEditarAluno('${_alunosTurmaAtiva}',${idx},'nome',this.value)" /></td>
        <td><input class="gi gi-sm" value="${(a.matricula||"").replace(/"/g,'&quot;')}"
          onchange="gestaoEditarAluno('${_alunosTurmaAtiva}',${idx},'matricula',this.value)" /></td>
        <td>
          <select class="gi gi-sm" onchange="gestaoEditarAluno('${_alunosTurmaAtiva}',${idx},'situacao',this.value)">
            ${sitOpts}
          </select>
        </td>
        <td><input type="date" class="gi gi-sm" value="${a.situacaoData||''}"
          onchange="gestaoEditarAluno('${_alunosTurmaAtiva}',${idx},'situacaoData',this.value)" /></td>
        <td><button type="button" class="btn-icon-del"
          onclick="gestaoRemoverAluno('${_alunosTurmaAtiva}',${idx})">×</button></td>
      </tr>`;
    }).join("");

    corpoAlunos = `
      <div class="gestao-bloco">
        <div class="gestao-bloco-header">
          <h3>Turma ${_alunosTurmaAtiva} — ${lista.length} aluno(s)</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn-add" onclick="gestaoAdicionarAluno('${_alunosTurmaAtiva}')">+ Aluno</button>
            <button type="button" class="btn-exportar-js" onclick="baixarTala('${_alunosTurmaAtiva}')">⬇ talas${_alunosTurmaAtiva.toLowerCase()}.js</button>
          </div>
        </div>
        <div class="tabela-wrapper">
          <table class="tabela-gestao">
            <thead><tr>
              <th style="width:36px">Nº</th>
              <th>Nome</th>
              <th style="width:130px">Matrícula</th>
              <th style="width:160px">Situação</th>
              <th style="width:120px">Data</th>
              <th style="width:32px"></th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="6" class="td-vazio">Nenhum aluno cadastrado.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  }

  return `
    <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px">
      ${tabsTurmas}
    </div>
    ${corpoAlunos}`;
}

async function _recarregarAbaAlunos() {
  const sec = document.getElementById("g-alunos");
  if (!sec) return;
  sec.innerHTML = await htmlEscolaAlunos();
}

async function gestaoEditarAluno(turmaKey, idx, campo, valor) {
  const lista = await _carregarAlunos(turmaKey);
  if (!lista[idx]) return;
  lista[idx][campo] = valor;
  if (campo === "situacao") lista[idx].situacaoData = valor ? hoje() : null;
  await _salvarAlunos(turmaKey);
  _mostrarIndicadorSync("✓ Aluno atualizado");
}

async function gestaoRemoverAluno(turmaKey, idx) {
  const lista = await _carregarAlunos(turmaKey);
  if (!lista[idx]) return;
  if (!confirm(`Remover "${lista[idx].nome || "este aluno"}"?`)) return;
  lista.splice(idx, 1);
  lista.forEach((a, i) => a.num = i + 1);
  await _salvarAlunos(turmaKey);
  _recarregarAbaAlunos();
}

async function gestaoAdicionarAluno(turmaKey) {
  const lista = await _carregarAlunos(turmaKey);
  const num   = lista.length ? Math.max(...lista.map(a => a.num || 0)) + 1 : 1;
  lista.push({ num, nome: "", matricula: "", situacao: "" });
  await _salvarAlunos(turmaKey);
  _recarregarAbaAlunos();
}

// Baixa o arquivo talas*.js para a turma selecionada
function baixarTala(turmaKey) {
  const lista = RT_ALUNOS[turmaKey] || [];
  const ts    = new Date().toLocaleString("pt-BR");
  const linhas = lista.map(a =>
    `  { num: ${String(a.num).padStart(2)}, nome: "${(a.nome||"").replace(/"/g,'\\"')}", matricula: "${a.matricula||""}", situacao: "${a.situacao||""}"${a.situacaoData ? `, situacaoData: "${a.situacaoData}"` : ""} },`
  ).join("\n");
  const conteudo = `// talas/talas${turmaKey.toLowerCase()}.js — Lista de alunos da turma ${turmaKey}\n// Exportado em ${ts}\n// Situação: "" = matriculado | AB = Abandonou | NC = Não compareceu | TR = Transferido | RM = Remanejado | RC = Reclassificado\n\n_registrarAlunos("${turmaKey}", [\n${linhas}\n]);\n`;
  baixarArquivo(new Blob([conteudo], { type: "application/javascript;charset=utf-8;" }), `talas${turmaKey.toLowerCase()}.js`);
}

// ── Migração: copia turmas do admin de diario/global para diario/{uid} ──────
// Executar uma única vez pelo admin no console: migrarTurmasAdminParaProfessor()
async function migrarTurmasAdminParaProfessor() {
  if (!_isAdmin(_userAtual?.email)) { alert("Apenas admin."); return; }
  const uid = _userAtual.uid;
  const db  = firebase.firestore();

  // Lê o diário global
  const globalSnap = await db.collection("diario").doc("global").get();
  if (!globalSnap.exists) { alert("Diário global não encontrado."); return; }
  const globalData = globalSnap.data();
  const todasTurmas = globalData.RT_TURMAS ? JSON.parse(globalData.RT_TURMAS) : [];

  // Separa turmas do professor (profUid === uid) das do global
  const turmasProf   = todasTurmas.filter(t => t.profUid === uid);
  const turmasGlobal = todasTurmas.filter(t => t.profUid !== uid);

  if (!turmasProf.length) {
    alert("Nenhuma turma com seu uid encontrada no diário global.");
    return;
  }

  // Lê o diário pessoal (pode estar vazio)
  const profSnap  = await db.collection("diario").doc(uid).get();
  const profData  = profSnap.exists ? profSnap.data() : {};
  const turmasJa  = profData.RT_TURMAS ? JSON.parse(profData.RT_TURMAS) : [];

  // Merge: evita duplicatas
  const ids = new Set(turmasJa.map(t => t.id));
  const novas = turmasProf.filter(t => !ids.has(t.id));
  const turmasMerged = [...turmasJa, ...novas];

  // Salva no diário pessoal
  await db.collection("diario").doc(uid).set({
    ...profData,
    RT_TURMAS: JSON.stringify(turmasMerged),
    _atualizado: new Date().toISOString(),
  }, { merge: true });

  // Remove as turmas do professor do diário global (mantém só as globais)
  await db.collection("diario").doc("global").update({
    RT_TURMAS: JSON.stringify(turmasGlobal),
    _atualizado: new Date().toISOString(),
  });

  alert(`✓ ${novas.length} turma(s) migrada(s) para seu diário pessoal.\nRecarregue a página.`);
}

// ════════════════════════════════════════════════════════════════
// ABA: MIGRAÇÃO DE TURMAS (admin)
// ════════════════════════════════════════════════════════════════

async function htmlGestaoMigracao() {
  // Carrega professores aprovados
  const db    = firebase.firestore();
  const profs = await db.collection("professores").where("status","==","aprovado").get();

  const opcoesProf = profs.docs
    .filter(d => !_isAdmin(d.data().email))
    .map(d => {
      const p = d.data();
      return `<option value="${d.id}">${p.nome || p.email} (${p.email})</option>`;
    }).join("");

  // Carrega turmas do diário global
  const globalSnap = await db.collection("diario").doc("global").get();
  const turmasGlobal = globalSnap.exists
    ? JSON.parse(globalSnap.data().RT_TURMAS || "[]")
    : [];

  const resumo = turmasGlobal.length
    ? `<p class="gestao-hint">${turmasGlobal.length} turma(s) encontrada(s) no diário global:</p>
       <ul style="font-size:.82rem;color:var(--text-mid);margin:8px 0 16px;padding-left:20px">
         ${turmasGlobal.map(t =>
           `<li>${t.serie}ª ${t.turma} — ${t.disciplina || "sem disciplina"}
            <span style="color:var(--text-muted);font-size:.72rem">(profUid: ${t.profUid || "undefined"})</span></li>`
         ).join("")}
       </ul>`
    : `<p class="gestao-hint" style="color:#4ade80">✓ Diário global não tem turmas para migrar.</p>`;

  return `
    <div class="gestao-bloco" style="max-width:640px">
      <div class="gestao-bloco-header">
        <h3>🔄 Migração de Turmas</h3>
      </div>
      <p class="gestao-hint">
        Transfere turmas do diário global (admin) para o diário pessoal de um professor.
        Use quando turmas foram criadas antes do isolamento por login.
      </p>
      ${resumo}
      <div class="modal-form" style="max-width:400px">
        <label>Professor de destino
          <select class="gi" id="mig-prof-sel" style="margin-top:4px">
            <option value="">— selecione —</option>
            ${opcoesProf}
          </select>
        </label>
        <label style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:.85rem">
          <input type="checkbox" id="mig-remover-global" checked />
          Remover do diário global após migrar
        </label>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
        <button type="button" class="btn-modal-ok"
          onclick="executarMigracao()">Migrar turmas</button>
        <span id="mig-status" style="font-size:.82rem;color:var(--text-muted)"></span>
      </div>
    </div>`;
}

async function executarMigracao() {
  const profUidDest = document.getElementById("mig-prof-sel")?.value;
  const remover     = document.getElementById("mig-remover-global")?.checked;
  const status      = document.getElementById("mig-status");

  if (!profUidDest) { if (status) status.textContent = "⚠ Selecione um professor."; return; }
  if (status) status.textContent = "⏳ Migrando…";

  try {
    const db         = firebase.firestore();
    const globalSnap = await db.collection("diario").doc("global").get();
    if (!globalSnap.exists) { if (status) status.textContent = "⚠ Diário global não encontrado."; return; }

    const globalData   = globalSnap.data();
    const turmasGlobal = JSON.parse(globalData.RT_TURMAS || "[]");
    if (!turmasGlobal.length) { if (status) status.textContent = "Nenhuma turma para migrar."; return; }

    // Marca todas as turmas com o uid do professor de destino
    const turmasMigradas = turmasGlobal.map(t => ({ ...t, profUid: profUidDest }));

    // Carrega diário do professor de destino
    const profSnap  = await db.collection("diario").doc(profUidDest).get();
    const profData  = profSnap.exists ? profSnap.data() : {};
    const turmasJa  = JSON.parse(profData.RT_TURMAS || "[]");

    // Merge sem duplicatas
    const ids       = new Set(turmasJa.map(t => t.id));
    const novas     = turmasMigradas.filter(t => !ids.has(t.id));
    const merged    = [...turmasJa, ...novas];

    // Salva no diário do professor
    await db.collection("diario").doc(profUidDest).set({
      ...profData,
      RT_TURMAS: JSON.stringify(merged),
      _atualizado: new Date().toISOString(),
    }, { merge: true });

    // Remove do global se solicitado
    if (remover) {
      await db.collection("diario").doc("global").update({
        RT_TURMAS: JSON.stringify([]),
        _atualizado: new Date().toISOString(),
      });
    }

    if (status) status.textContent = `✓ ${novas.length} turma(s) migrada(s) com sucesso.`;

    // Recarrega a aba
    setTimeout(() => {
      const sec = document.getElementById("g-migracao");
      if (sec) htmlGestaoMigracao().then(h => sec.innerHTML = h);
    }, 1500);

  } catch(e) {
    console.error("Erro na migração:", e);
    if (status) status.textContent = "❌ Erro: " + e.message;
  }
}
