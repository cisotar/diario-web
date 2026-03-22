// GESTAO-ESCOLA.JS — Painel de Gestão ADM: turmas-base, disciplinas, períodos, bimestres
// Dependências: app-core.js

function abrirPainelGestao() {
  if (!_autenticado) { _abrirModalGoogle(); return; }
  const papel = _papel();
  if (papel === "admin")        _abrirPainelEscola();
  else if (papel === "coordenador") _abrirPainelCoordenador();
  // professor não tem rota para painel de gestão ADM
}

// ── Sidebar: admin tem dois botões ───────────────────────────
function _atualizarBotoesGestao() {
  const papel = _papel();
  const btnEl = document.getElementById("btn-gestao");
  const mobEl = document.getElementById("btn-mob-gestao");

  // Limpa btn-meu-diario se existir (evita duplicatas entre sessões)
  if (papel !== "admin") {
    document.getElementById("btn-meu-diario")?.remove();
  }

  if (papel === "admin") {
    if (btnEl) {
      btnEl.style.display = "";
      btnEl.innerHTML = "⚙ Painel de Gestão ADM";
      btnEl.onclick   = _abrirPainelEscola;
    }
    if (!document.getElementById("btn-meu-diario")) {
      const btn2 = document.createElement("button");
      btn2.className   = "btn-gestao-sidebar";
      btn2.id          = "btn-meu-diario";
      btn2.textContent = "👨‍🏫 Painel Professor";
      btn2.onclick     = _abrirPainelProfessor;
      btnEl?.parentNode.insertBefore(btn2, btnEl.nextSibling);
    }
    if (mobEl) mobEl.style.display = "";

  } else if (papel === "coordenador") {
    if (btnEl) {
      btnEl.style.display = "";
      btnEl.textContent   = "⚙ Painel";
      btnEl.onclick       = _abrirPainelCoordenador;
    }
    if (mobEl) mobEl.style.display = "";

  } else if (papel === "professor") {
    // Oculta btn-gestao; cria botão próprio do professor se não existir
    if (btnEl) btnEl.style.display = "none";
    if (mobEl) mobEl.style.display = "none";
    if (!document.getElementById("btn-painel-prof")) {
      const btn = document.createElement("button");
      btn.className   = "btn-gestao-sidebar";
      btn.id          = "btn-painel-prof";
      btn.textContent = "⚙ Meu Painel";
      btn.onclick     = _abrirPainelProfessor;
      btnEl?.parentNode.appendChild(btn);
    }
  } else {
    // papel ainda null — oculta tudo
    if (btnEl) btnEl.style.display = "none";
    if (mobEl) mobEl.style.display = "none";
  }
}

// ════════════════════════════════════════════════════════════════
// PAINEL ESCOLA (admin only)
// Abas: Turmas · Disciplinas/Áreas · Períodos · Bimestres · Usuários · Diários
// ════════════════════════════════════════════════════════════════
function _abrirPainelEscola(abaInicial) {
  if (!_isAdmin(_userAtual?.email)) return; // proteção extra
  const aba = abaInicial || "turmas";
  const tabs = [
    { id:"turmas",      label:"🏫 Cadastrar Turmas",  fn: htmlEscolaTurmas      },
    { id:"horarios",    label:"🗓 Ver Horários",        fn: htmlAdmHorarios, async: true },
    { id:"disciplinas", label:"📚 Disciplinas",         fn: htmlEscolaDisciplinas },
    { id:"periodos",    label:"🕐 Períodos",             fn: htmlEscolaPeriodos    },
    { id:"bimestres",   label:"📅 Bimestres",            fn: htmlGestaoBimestres   },
    { id:"usuarios",    label:"👥 Usuários",              fn: htmlGestaoUsuarios, async: true },
    { id:"diarios",     label:"📋 Diários",               fn: htmlGestaoDiarios, async: true },
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
    case "horarios":     htmlAdmHorarios().then(h => sec.innerHTML = h); break;
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
         blocoNivel("fundamental","📗 Ensino Fundamental","Ano");
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
      <button type="button" class="btn-modal-ok" onclick="_salvarConfigPeriodos()">Salvar e aplicar</button>
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
// ABA: VER HORÁRIOS (admin) — grade por turma com todas as aulas
// ════════════════════════════════════════════════════════════════

let _admHorariosTurma = null; // turma selecionada no filtro

async function htmlAdmHorarios() {
  const base = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const niveis = [...new Set(base.map(t => t.nivel))].sort();
  const nivelOpts = `<option value="">— selecione —</option>` +
    niveis.map(n => `<option value="${n}">${n==="medio"?"Ensino Médio":"Ensino Fundamental"}</option>`).join("");

  const gradeHtml = _admHorariosTurma
    ? await _renderAdmGrade(_admHorariosTurma)
    : `<p class="gestao-hint" style="margin-top:20px">Selecione uma turma para ver os horários.</p>`;

  return `
    <div style="max-width:960px">
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:20px">
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Nível
          <select class="gi" id="adm-filtro-nivel" onchange="admFiltrarSeries()" style="display:block;margin-top:4px;min-width:160px">
            ${nivelOpts}
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          <span id="adm-filtro-serie-label">Série / Ano</span>
          <select class="gi" id="adm-filtro-serie" onchange="admFiltrarTurmasOpts()" style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
        <label style="font-size:.82rem;font-weight:600;color:var(--text-mid)">
          Turma
          <select class="gi" id="adm-filtro-turma" onchange="admSelecionarTurma()" style="display:block;margin-top:4px;min-width:130px">
            <option value="">—</option>
          </select>
        </label>
      </div>
      <div id="adm-grade-container">${gradeHtml}</div>
    </div>

    <!-- Modal editar entrada de horário -->
    <div id="modal-adm-horario" class="modal-overlay" style="display:none">
      <div class="modal-box" style="max-width:420px">
        <h3 class="modal-titulo">✏️ Editar horário</h3>
        <p id="modal-adm-horario-sub" style="font-size:.85rem;color:var(--text-muted);margin-bottom:12px"></p>
        <div class="modal-form">
          <label>Professor
            <select class="gi" id="adm-h-prof" onchange="admCarregarDiscsProf()" style="margin-top:4px"></select>
          </label>
          <label style="margin-top:10px">Disciplina
            <select class="gi" id="adm-h-disc" style="margin-top:4px"></select>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" onclick="document.getElementById('modal-adm-horario').style.display='none'">Cancelar</button>
          <button type="button" class="btn-del" style="margin-right:auto" onclick="admRemoverHorario()">🗑 Remover</button>
          <button type="button" class="btn-modal-ok" onclick="admConfirmarHorario()">Salvar</button>
        </div>
      </div>
    </div>`;
}

async function _renderAdmGrade(tb) {
  const DIAS = [{idx:1,label:"Segunda"},{idx:2,label:"Terça"},{idx:3,label:"Quarta"},{idx:4,label:"Quinta"},{idx:5,label:"Sexta"}];
  const turno    = tb.periodo || "manha";
  const periodos = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);

  // Carrega diários de TODOS os professores
  const db   = firebase.firestore();
  const snap = await db.collection("professores").where("status","==","aprovado").get();
  const professores = {}; // uid → {nome, email}
  for (const doc of snap.docs) {
    professores[doc.id] = { nome: doc.data().nome||doc.data().email, email: doc.data().email };
  }

  // Monta mapa de horários desta turma: dia_aula → [{turmaId, disciplina, sigla, profUid, profNome}]
  const todos = {};

  // Turmas locais do admin (diario/global)
  for (const t of RT_TURMAS) {
    if (t.serie !== tb.serie || t.turma !== tb.turma) continue;
    const profNome = t.profUid === "global" ? "Admin" : (professores[t.profUid]?.nome || t.profUid);
    for (const h of (t.horarios||[])) {
      const chave = `${h.diaSemana}_${h.aula}`;
      if (!todos[chave]) todos[chave] = [];
      todos[chave].push({ turmaId: t.id, disciplina: t.disciplina, sigla: t.sigla, profUid: t.profUid||"global", profNome });
    }
  }

  // Diários dos outros professores
  for (const [uid, perf] of Object.entries(professores)) {
    if (_isAdmin(perf.email)) continue;
    try {
      const dSnap = await db.collection("diario").doc(uid).get();
      if (!dSnap.exists) continue;
      const turmas = JSON.parse(dSnap.data().RT_TURMAS || "[]");
      for (const t of turmas) {
        if (t.serie !== tb.serie || t.turma !== tb.turma) continue;
        for (const h of (t.horarios||[])) {
          const chave = `${h.diaSemana}_${h.aula}`;
          if (!todos[chave]) todos[chave] = [];
          todos[chave].push({ turmaId: t.id, disciplina: t.disciplina, sigla: t.sigla, profUid: uid, profNome: perf.nome });
        }
      }
    } catch(e) {}
  }

  const linhas = periodos.map(p => {
    const isIntervalo = p.label?.toLowerCase().includes("interval");
    const cells = DIAS.map(dia => {
      const chave = `${dia.idx}_${p.aula}`;
      const entradas = todos[chave] || [];
      if (entradas.length) {
        const conteudo = entradas.map(e =>
          `<div class="grade-disc">${e.sigla||e.disciplina||"—"}</div>
           <div class="grade-turma">${e.profNome}</div>`
        ).join("<hr style='border-color:var(--border);margin:2px 0'>");
        return `<td class="grade-cell grade-ocupada" style="cursor:pointer"
          onclick="admAbrirModalHorario('${tb.serie}','${tb.turma}','${tb.subtitulo||""}','${p.aula}',${dia.idx},'${turno}')"
          title="Clique para editar">
          ${conteudo}
        </td>`;
      }
      return `<td class="grade-cell grade-vazia"
        onclick="admAbrirModalHorario('${tb.serie}','${tb.turma}','${tb.subtitulo||""}','${p.aula}',${dia.idx},'${turno}')"
        title="Clique para adicionar">
        <span class="grade-vazio-txt">+</span>
      </td>`;
    }).join("");

    return `<tr class="${isIntervalo?"grade-intervalo":""}">
      <td class="grade-periodo">
        <div class="grade-aula-num">${p.aula.replace(/[mt]/,"")}</div>
        <div class="grade-aula-hr">${p.inicio}</div>
      </td>
      ${cells}
    </tr>`;
  }).join("");

  const label = `${tb.serie}ª ${tb.turma}${tb.subtitulo?" "+tb.subtitulo:""}`;
  const labelTurno = turno==="tarde"?"🌇 Tarde":"🌅 Manhã";
  return `
    <div class="grade-wrap">
      <div class="grade-titulo">${labelTurno} · ${label}</div>
      <div class="grade-hint">Clique em qualquer célula para adicionar ou editar aulas. Admin pode editar aulas de qualquer professor.</div>
      <div style="overflow-x:auto">
        <table class="grade-tabela">
          <thead><tr>
            <th class="grade-th-hora">Aula</th>
            ${DIAS.map(d=>`<th>${d.label}</th>`).join("")}
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </div>`;
}

function admFiltrarSeries() {
  const nivel = document.getElementById("adm-filtro-nivel")?.value;
  const base  = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const series = [...new Set(base.filter(t=>t.nivel===nivel).map(t=>t.serie))].sort((a,b)=>+a-+b);
  const label  = nivel==="medio"?"Série":"Ano";
  document.getElementById("adm-filtro-serie-label").textContent = label;
  const sel = document.getElementById("adm-filtro-serie");
  sel.innerHTML = `<option value="">— selecione —</option>` +
    series.map(s=>`<option value="${s}">${s}${nivel==="medio"?"ª Série":"º Ano"}</option>`).join("");
  document.getElementById("adm-filtro-turma").innerHTML = `<option value="">—</option>`;
  document.getElementById("adm-grade-container").innerHTML =
    `<p class="gestao-hint" style="margin-top:16px">Selecione a série e a turma.</p>`;
}

function admFiltrarTurmasOpts() {
  const nivel  = document.getElementById("adm-filtro-nivel")?.value;
  const serie  = document.getElementById("adm-filtro-serie")?.value;
  if (!serie) return;
  const base   = RT_CONFIG.turmasBase || TURMAS_BASE || [];
  const turmas = base.filter(t=>t.nivel===nivel&&t.serie===serie).sort((a,b)=>a.turma.localeCompare(b.turma));
  const sel    = document.getElementById("adm-filtro-turma");
  sel.innerHTML = `<option value="">— selecione —</option>` +
    turmas.map(t=>`<option value="${t.turma}|${t.subtitulo||""}|${t.periodo||"manha"}">${t.turma}${t.subtitulo?" "+t.subtitulo:""}</option>`).join("");
  document.getElementById("adm-grade-container").innerHTML =
    `<p class="gestao-hint" style="margin-top:16px">Selecione a turma.</p>`;
}

async function admSelecionarTurma() {
  const serie  = document.getElementById("adm-filtro-serie")?.value;
  const parts  = (document.getElementById("adm-filtro-turma")?.value||"").split("|");
  if (!serie || !parts[0]) return;
  _admHorariosTurma = { serie, turma: parts[0], subtitulo: parts[1]||"", periodo: parts[2]||"manha" };
  const cont = document.getElementById("adm-grade-container");
  if (!cont) return;
  cont.innerHTML = `<p class="gestao-hint">⏳ Carregando…</p>`;
  cont.innerHTML = await _renderAdmGrade(_admHorariosTurma);
}

// Variáveis do modal de edição do admin
let _admModalSerie="", _admModalTurma="", _admModalSub="", _admModalAula="", _admModalDia=0, _admModalTurno="";

async function admAbrirModalHorario(serie, turma, subtitulo, aula, diaSemana, turno) {
  _admModalSerie = serie; _admModalTurma = turma; _admModalSub = subtitulo;
  _admModalAula  = aula;  _admModalDia   = diaSemana; _admModalTurno = turno;

  const DIAS = ["","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const periodo = RT_PERIODOS.find(p=>p.aula===aula);
  const sub = document.getElementById("modal-adm-horario-sub");
  if (sub) sub.textContent = `${DIAS[diaSemana]} · Aula ${aula.replace(/[mt]/,"")} (${periodo?.inicio||""}) — ${serie}ª ${turma}${subtitulo?" "+subtitulo:""}`;

  // Carrega lista de professores aprovados
  const db   = firebase.firestore();
  const snap = await db.collection("professores").where("status","==","aprovado").get();
  const profSel = document.getElementById("adm-h-prof");
  profSel.innerHTML = `<option value="global">Admin (próprio)</option>` +
    snap.docs.filter(d=>!_isAdmin(d.data().email)).map(d=>
      `<option value="${d.id}">${d.data().nome||d.data().email}</option>`
    ).join("");

  admCarregarDiscsProf();
  document.getElementById("modal-adm-horario").style.display = "flex";
}

async function admCarregarDiscsProf() {
  const profUid = document.getElementById("adm-h-prof")?.value;
  if (!profUid) return;
  const serie = _admModalSerie;

  let turmasList = [];
  if (profUid === "global") {
    turmasList = RT_TURMAS.filter(t=>t.serie===serie);
  } else {
    try {
      const snap = await firebase.firestore().collection("diario").doc(profUid).get();
      if (snap.exists) turmasList = JSON.parse(snap.data().RT_TURMAS||"[]").filter(t=>t.serie===serie);
    } catch(e) {}
  }

  const discs = _disciplinasDaSerie(serie);
  const discSel = document.getElementById("adm-h-disc");
  const jaTemNaTurma = turmasList
    .filter(t=>t.turma===_admModalTurma)
    .map(t=>`<option value="existing:${t.id}">${t.disciplina} (${t.sigla})</option>`);
  const novas = discs
    .filter(d=>!turmasList.find(t=>t.turma===_admModalTurma&&t.disciplina===d))
    .map(d=>`<option value="new:${d.replace(/"/g,'&quot;')}">${d}</option>`);

  discSel.innerHTML = `<option value="">— selecione —</option>` +
    (jaTemNaTurma.length?`<optgroup label="Disciplinas desta turma">${jaTemNaTurma.join("")}</optgroup>`:"") +
    (novas.length?`<optgroup label="Nova disciplina">${novas.join("")}</optgroup>`:"");
}

async function admConfirmarHorario() {
  const profUid    = document.getElementById("adm-h-prof")?.value;
  const discVal    = document.getElementById("adm-h-disc")?.value;
  if (!discVal) { alert("Selecione uma disciplina."); return; }

  const serie = _admModalSerie, turma = _admModalTurma, subtitulo = _admModalSub;
  const aula  = _admModalAula, diaSemana = +_admModalDia, periodo = _admModalTurno;

  let turmaEntry;
  if (discVal.startsWith("existing:")) {
    const turmaId = discVal.replace("existing:","");
    if (profUid === "global") {
      turmaEntry = RT_TURMAS.find(t=>t.id===turmaId);
    } else {
      // Precisa editar o diário do professor no Firestore
      const db   = firebase.firestore();
      const snap = await db.collection("diario").doc(profUid).get();
      if (!snap.exists) { alert("Diário do professor não encontrado."); return; }
      const turmas = JSON.parse(snap.data().RT_TURMAS||"[]");
      const t = turmas.find(t=>t.id===turmaId);
      if (t && !t.horarios.find(h=>h.diaSemana===diaSemana&&h.aula===aula)) {
        t.horarios.push({ diaSemana, aula });
        await db.collection("diario").doc(profUid).update({ RT_TURMAS: JSON.stringify(turmas) });
      }
      _invalidarHorariosCache();
      document.getElementById("modal-adm-horario").style.display = "none";
      admSelecionarTurma(); return;
    }
  } else {
    const disciplina = discVal.replace("new:","");
    const sigla = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").substring(0,3).toUpperCase();
    if (profUid === "global") {
      const id = `${serie}${turma}_${sigla}_global_${Date.now()}`;
      turmaEntry = { id, serie, turma, subtitulo, disciplina, sigla, horarios:[], profUid:"global", periodo };
      RT_TURMAS.push(turmaEntry);
    } else {
      const db   = firebase.firestore();
      const snap = await db.collection("diario").doc(profUid).get();
      const turmas = snap.exists ? JSON.parse(snap.data().RT_TURMAS||"[]") : [];
      const id = `${serie}${turma}_${sigla}_${profUid.substring(0,6)}_${Date.now()}`;
      const novaT = { id, serie, turma, subtitulo, disciplina, sigla, horarios:[{diaSemana, aula}], profUid, periodo };
      turmas.push(novaT);
      await db.collection("diario").doc(profUid).set({ RT_TURMAS: JSON.stringify(turmas) }, { merge:true });
      _invalidarHorariosCache();
      document.getElementById("modal-adm-horario").style.display = "none";
      admSelecionarTurma(); return;
    }
  }

  if (turmaEntry && !turmaEntry.horarios.find(h=>h.diaSemana===diaSemana&&h.aula===aula)) {
    turmaEntry.horarios.push({ diaSemana, aula });
  }
  salvarTudo();
  _invalidarHorariosCache();
  document.getElementById("modal-adm-horario").style.display = "none";
  admSelecionarTurma();
}

async function admRemoverHorario() {
  const profUid = document.getElementById("adm-h-prof")?.value;
  const discVal = document.getElementById("adm-h-disc")?.value;
  if (!discVal?.startsWith("existing:")) { alert("Selecione a entrada a remover."); return; }
  if (!confirm("Remover este horário?")) return;

  const turmaId   = discVal.replace("existing:","");
  const diaSemana = +_admModalDia;
  const aula      = _admModalAula;

  if (profUid === "global") {
    const ti = RT_TURMAS.findIndex(t=>t.id===turmaId);
    if (ti>=0) {
      RT_TURMAS[ti].horarios = RT_TURMAS[ti].horarios.filter(h=>!(h.aula===aula&&h.diaSemana===diaSemana));
      if (!RT_TURMAS[ti].horarios.length) RT_TURMAS.splice(ti,1);
    }
    salvarTudo();
  } else {
    const db   = firebase.firestore();
    const snap = await db.collection("diario").doc(profUid).get();
    if (snap.exists) {
      const turmas = JSON.parse(snap.data().RT_TURMAS||"[]");
      const t = turmas.find(t=>t.id===turmaId);
      if (t) t.horarios = t.horarios.filter(h=>!(h.aula===aula&&h.diaSemana===diaSemana));
      await db.collection("diario").doc(profUid).update({ RT_TURMAS: JSON.stringify(turmas) });
    }
  }
  _invalidarHorariosCache();
  document.getElementById("modal-adm-horario").style.display = "none";
  admSelecionarTurma();
}
