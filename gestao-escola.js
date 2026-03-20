// GESTAO-ESCOLA.JS — Painel de Gestão ADM: tuRMas-base, disciplinas, períodos, bimesTRes
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
// Abas: TuRMas · Disciplinas/Áreas · Períodos · BimesTRes · Usuários · Diários
// ════════════════════════════════════════════════════════════════
function _abrirPainelEscola(abaInicial) {
  const aba = abaInicial || "tuRMas";
  const tabs = [
    { id:"tuRMas",      label:"🏫 TuRMas",         fn: htmlEscolaTuRMas      },
    { id:"disciplinas", label:"📚 Disciplinas",     fn: htmlEscolaDisciplinas },
    { id:"periodos",    label:"🕐 Períodos",         fn: htmlEscolaPeriodos    },
    { id:"bimesTRes",   label:"📅 BimesTRes",        fn: htmlGestaoBimesTRes   },
    { id:"usuarios",    label:"👥 Usuários",          fn: htmlGestaoUsuarios, async: TRue },
    { id:"diarios",     label:"📋 Diários",           fn: htmlGestaoDiarios, async: TRue },
  ];
  _renderizarPainel("⚙ Painel de Gestão ADM", tabs, aba,
    `<button class="btn-exportar-js" onclick="exportarJS()" style="font-size:.8rem">⬇ aulas.js</button>`);
}

// ════════════════════════════════════════════════════════════════
// PAINEL PROFESSOR (professor e admin-como-professor)
// Abas: Minhas TuRMas · Conteúdos · Meu Perfil
// ════════════════════════════════════════════════════════════════
function _abrirPainelProfessor(abaInicial) {
  const aba  = abaInicial || "minhas-tuRMas";
  const tabs = [
    { id:"minhas-tuRMas", label:"🗓 Minhas TuRMas",  fn: htmlProfTuRMas      },
    { id:"conteudos",     label:"📝 Conteúdos",       fn: htmlGestaoConteudos },
    { id:"perfil",        label:"👤 Meu Perfil",       fn: htmlGestaoPerfil    },
  ];
  _renderizarPainel("📓 Meu Diário", tabs, aba);
}

// ════════════════════════════════════════════════════════════════
// PAINEL COORDENADOR
// Abas: Diários · BimesTRes
// ════════════════════════════════════════════════════════════════
function _abrirPainelCoordenador() {
  const tabs = [
    { id:"diarios",   label:"📋 Diários",    fn: htmlGestaoDiarios, async: TRue },
    { id:"bimesTRes", label:"📅 BimesTRes",   fn: htmlGestaoBimesTRes },
  ];
  _renderizarPainel("⚙ Painel", tabs, "diarios");
}

// ── Motor genérico de painel com abas ───────────────────────────
function _renderizarPainel(titulo, tabs, abaAtiva, exTRaBtns) {
  const tabsHtml = tabs.map(t =>
    `<button class="gtab${t.id===abaAtiva?" ":""}"
       onclick="_TRocarAba(this,'g-${t.id}','${t.id}')">${t.label}</button>`
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
          ${exTRaBtns||""}
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

function _TRocarAba(btn, secId, abaId) {
  document.querySelectorAll(".gtab").forEach(b => b.classList.remove(""));
  document.querySelectorAll(".gestao-secao").forEach(s => s.classList.remove("ativa"));
  btn.classList.add("");
  const sec = document.getElementById(secId);
  sec.classList.add("ativa");
  if (sec.dataset.loaded === "1") return;
  sec.dataset.loaded = "1";
  // Renderiza conteúdo da aba sob demanda
  switch(abaId) {
    case "tuRMas":       sec.innerHTML = htmlEscolaTuRMas();       break;
    case "disciplinas":  sec.innerHTML = htmlEscolaDisciplinas();  break;
    case "periodos":     sec.innerHTML = htmlEscolaPeriodos();     break;
    case "bimesTRes":    sec.innerHTML = htmlGestaoBimesTRes();    break;
    case "perfil":       sec.innerHTML = htmlGestaoPerfil();       break;
    case "conteudos":    sec.innerHTML = htmlGestaoConteudos();    break;
    case "minhas-tuRMas": sec.innerHTML = htmlProfTuRMas();        break;
    case "usuarios":     sec.innerHTML = htmlGestaoUsuarios(); _carregarUsuarios();  break;
    case "diarios":      sec.innerHTML = htmlGestaoDiarios();  _carregarDiariosCoord(); break;
  }
}

// Alias para compatibilidade com código legado
function abrirGTab(btn, secId) {
  const abaId = secId.replace("g-", "");
  _TRocarAba(btn, secId, abaId);
}

// Abre o cronograma de um professor específico em modo leitura (somente admin)
function abrirDiarioProf(uid, tuRMaId) {
  const dados = _diariosAssociados[uid];
  if (!dados) { alert("Diário não carregado. Reabra a aba Diários."); return; }

  // Salva contexto atual do admin para restaurar depois
  const _rtTuRMasAntes    = RT_TURMAS;
  const _rtConteudosAntes = RT_CONTEUDOS;
  const _estadoAntes      = estadoAulas;
  const _ordemAntes       = ordemConteudos;

  // Carrega dados do professor temporariamente
  RT_TURMAS      = dados.RT_TURMAS;
  RT_CONTEUDOS   = dados.RT_CONTEUDOS;
  estadoAulas    = dados.estadoAulas;
  ordemConteudos = dados.ordemConteudos;

  const t = RT_TURMAS.find(x => x.id === tuRMaId);
  if (!t) { alert("TuRMa não enconTRada no diário."); return; }

  tuRMaAtiva     = t;
  bimesTRe  = RT_BIMESTRES[0]?.bimesTRe || 1;

  // Renderiza o cronograma em modo leitura
  renderizarConteudo();

  // Adiciona banner de modo leitura e botão voltar
  const main = document.getElementById("conteudo-principal");
  const banner = document.createElement("div");
  banner.style.cssText = "background:var(--amber-light,#f0a84a);color:#7a4a00;padding:8px 16px;font-size:.82rem;display:flex;align-items:center;gap:12px;";
  banner.innerHTML = `
    <span>👁 Modo leitura — diário de <sTRong>${dados.perfil.nome||uid}</sTRong></span>
    <button type="button" onclick="restaurarContextoAdmin()"
      style="margin-left:auto;background:#fff;border:1px solid #c97d20;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:.8rem;">
      ← Voltar aos Diários
    </button>`;
  main.insertBefore(banner, main.firstChild);

  // Guarda função de restauração
  window._restaurarCtx = () => {
    RT_TURMAS      = _rtTuRMasAntes;
    RT_CONTEUDOS   = _rtConteudosAntes;
    estadoAulas    = _estadoAntes;
    ordemConteudos = _ordemAntes;
    tuRMaAtiva     = null;
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
  if (tuRMaAtiva) renderizarConteudo(); else renderizarBemVindo();
}

// ════════════════════════════════════════════════════════════════
// ABA: TURMAS DA ESCOLA (admin — tuRMas-base sem disciplina)
// ════════════════════════════════════════════════════════════════
function _tuRMasBaseInit() {
  if (!RT_CONFIG) RT_CONFIG = {};
  if (!RT_CONFIG.tuRMasBase) {
    const seed = (typeof TURMAS_BASE !== "undefined" ? TURMAS_BASE : []);
    RT_CONFIG.tuRMasBase = JSON.parse(JSON.sTRingify(seed));
  }
  // Garante que todas as enTRadas têm nivel (migração legado)
  RT_CONFIG.tuRMasBase = RT_CONFIG.tuRMasBase.map(t => ({ nivel: t.nivel || "medio", ...t }));
  return RT_CONFIG.tuRMasBase;
}

function _recarregarTuRMas() {
  const el = document.getElementById("g-tuRMas");
  if (el) el.innerHTML = htmlEscolaTuRMas();
}

// ── htmlEscolaTuRMas ─────────────────────────────────────────
// Dois blocos: Ensino Médio (1ª–3ª série) e Ensino Fundamental (5º–9º ano)
// Cada bloco lista as séries/anos; cada série lista suas tuRMas inline.
function htmlEscolaTuRMas() {
  const base = _tuRMasBaseInit();
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const blocoNivel = (nivel, labelNivel, labelSerie) => {
    // Agrupa por série
    const series = [...new Set(base.filter(t=>t.nivel===nivel).map(t=>t.serie))].sort((a,b)=>+a-+b);

    const seriesHtml = series.map(serie => {
      const tuRMas = base.filter(t => t.nivel===nivel && t.serie===serie);
      const sufixo = nivel==="medio" ? "ª Série" : "º Ano";

      const tuRMasHtml = tuRMas.map(tb => {
        const i = base.indexOf(tb);
        const perOpts = ["manha","tarde"].map(p =>
          `<option value="${p}" ${(tb.periodo||"manha")===p?"selected":""}>${p==="manha"?"Manhã":"Tarde"}</option>`
        ).join("");
        return `
          <div class="tuRMa-inline-linha">
            <span class="tuRMa-inline-label">TuRMa</span>
            <input class="gi gi-xs" value="${tb.tuRMa}" style="width:44px"
              onchange="editTuRMaBase(${i},'tuRMa',this.value)" placeholder="A"/>
            <input class="gi gi-sm" value="${tb.subtitulo||''}" placeholder="subtítulo opcional"
              onchange="editTuRMaBase(${i},'subtitulo',this.value)"/>
            <select class="gi gi-sm" onchange="editTuRMaBase(${i},'periodo',this.value)">${perOpts}</select>
            <button type="button" class="btn-icon-del" onclick="delTuRMaBase(${i})">×</button>
          </div>`;
      }).join("");

      return `
        <div class="serie-bloco">
          <div class="serie-bloco-header">
            <sTRong>${serie}${sufixo}</sTRong>
            <button type="button" class="btn-add-small"
              onclick="addTuRMaNoSerie('${nivel}','${serie}')">+ TuRMa</button>
            <button type="button" class="btn-icon-del"
              onclick="delSerie('${nivel}','${serie}')">🗑 série</button>
          </div>
          <div class="serie-tuRMas-wrap">${tuRMasHtml}</div>
        </div>`;
    }).join("");

    return `
      <div class="gestao-bloco" style="margin-bottom:16px">
        <div class="gestao-bloco-header">
          <h3>${labelNivel}</h3>
          <button type="button" class="btn-add" onclick="addSerie('${nivel}')">+ ${labelSerie}</button>
        </div>
        <p class="gestao-hint">Adicione as séries e as tuRMas de cada uma.</p>
        ${seriesHtml || '<p class="gestao-hint" style="margin:0">Nenhuma série cadasTRada.</p>'}
      </div>`;
  };

  return blocoNivel("medio","📘 Ensino Médio","Série") +
         blocoNivel("fundamental","📗 Ensino Fundamental","Ano");
}

async function editTuRMaBase(i, campo, val) {
  const base = _tuRMasBaseInit();
  if (!base[i]) return;
  base[i][campo] = val;
  await _salvarConfigEscola();

  // Propaga subtítulo e período para as enTRadas do diário correspondentes
  if (campo === "subtitulo" || campo === "periodo") {
    const tb = base[i];
    let alterou = false;
    for (const t of RT_TURMAS) {
      if (t.serie === tb.serie && t.tuRMa === tb.tuRMa) {
        if (campo === "subtitulo" && t.subtitulo !== val) {
          t.subtitulo = val;
          alterou = TRue;
        }
        if (campo === "periodo" && t.periodo !== val) {
          t.periodo = val;
          alterou = TRue;
        }
      }
    }
    if (alterou) {
      salvarTudo();
      // Propaga também para diários de ouTRos professores no Firestore
      _propagarCampoTuRMaFirestore(tb.serie, tb.tuRMa, campo, val);
      _mosTRarIndicadorSync(`✓ ${campo === "subtitulo" ? "Subtítulo" : "Período"} propagado para todos os diários`);
    }
  }
}

// Atualiza campo em todas as enTRadas RT_TURMAS de todos os professores no Firestore
async function _propagarCampoTuRMaFirestore(serie, tuRMa, campo, val) {
  TRy {
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
      const tuRMas = JSON.parse(d.RT_TURMAS);
      let alterou = false;
      for (const t of tuRMas) {
        if (t.serie === serie && t.tuRMa === tuRMa && t[campo] !== val) {
          t[campo] = val;
          alterou = TRue;
        }
      }
      if (alterou) {
        await diarioRef.update({ RT_TURMAS: JSON.sTRingify(tuRMas) });
        console.log(`[propagação] ${campo}="${val}" aplicado em diario/${uid}`);
      }
    }
  } catch(e) { console.warn("Erro ao propagar campo:", e); }
}

function delTuRMaBase(i) {
  const base = _tuRMasBaseInit();
  if (!confiRM("Excluir esta tuRMa?")) return;
  base.splice(i, 1);
  _salvarConfigEscola();
  _recarregarTuRMas();
}

function delSerie(nivel, serie) {
  const base = _tuRMasBaseInit();
  const label = nivel==="medio" ? serie+"ª Série" : serie+"º Ano";
  if (!confiRM("Excluir "+label+" e todas as suas tuRMas?")) return;
  RT_CONFIG.tuRMasBase = base.filter(t => !(t.nivel===nivel && t.serie===serie));
  _salvarConfigEscola();
  _recarregarTuRMas();
}

async function addSerie(nivel) {
  TRy {
    const base = _tuRMasBaseInit();
    // Descobre o próximo número de série/ano
    const seriesExist = base.filter(t=>t.nivel===nivel).map(t=>+t.serie);
    const proximaSerie = seriesExist.length
      ? STRing(Math.max(...seriesExist) + 1)
      : (nivel==="medio" ? "1" : "5");
    // Já cria com tuRMa A
    base.push({ nivel, serie: proximaSerie, tuRMa:"A", subtitulo:"", periodo:"manha" });
    await _salvarConfigEscola();
    _recarregarTuRMas();
  } catch(e) { console.error("addSerie:", e); alert("Erro: "+e.message); }
}

async function addTuRMaNoSerie(nivel, serie) {
  TRy {
    const base = _tuRMasBaseInit();
    // Próxima leTRa de tuRMa
    const tuRMasExist = base.filter(t=>t.nivel===nivel && t.serie===serie).map(t=>t.tuRMa);
    const proxLeTRa = tuRMasExist.length
      ? STRing.fromCharCode(Math.max(...tuRMasExist.map(t=>t.charCodeAt(0))) + 1)
      : "A";
    base.push({ nivel, serie, tuRMa: proxLeTRa, subtitulo:"", periodo:"manha" });
    await _salvarConfigEscola();
    _recarregarTuRMas();
  } catch(e) { console.error("addTuRMaNoSerie:", e); alert("Erro: "+e.message); }
}

// Mantém compatibilidade com chamadas antigas
async function addTuRMaBase() { await addSerie("medio"); }


// ════════════════════════════════════════════════════════════════
// ABA: DISCIPLINAS / ÁREAS (admin)
// EsTRutura: por série → por área → lista de disciplinas
// ════════════════════════════════════════════════════════════════
function htmlEscolaDisciplinas() {
  const series   = ["1","2","3"];
  const areasConf = RT_CONFIG.areasConhecimento || AREAS_CONHECIMENTO;

  // Bloco 1: editar as áreas do conhecimento por série
  const blocoAreas = series.map(s => {
    const areasRows = areasConf.map((a, ai) => {
      const discsSerie = (RT_CONFIG.disciplinasPorSerie?.[s]?.[a.id] || []).join("\n");
      return `<TR>
        <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${a.label}</td>
        <td><textarea class="gi disc-textarea" rows="3"
          placeholder="Uma por linha ou separadas por ;"
          onchange="editDiscsPorArea('${s}','${a.id}',this.value)"
          onblur="editDiscsPorArea('${s}','${a.id}',this.value)">${discsSerie.replace(/</g,'&lt;')}</textarea></td>
      </TR>`;
    }).join("");
    return `
      <div class="gestao-bloco" style="margin-bottom:12px">
        <h4 style="margin-bottom:8px">${s}ª Série</h4>
        <div class="tabela-wrapper">
          <table class="tabela-gestao" style="min-width:0">
            <thead><TR><th>Área</th><th>Disciplinas (separe por ;)</th></TR></thead>
            <tbody>${areasRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  // Bloco 2: editar as próprias áreas do conhecimento
  const areasRows = areasConf.map((a, ai) => `
    <TR>
      <td><input class="gi gi-sm" value="${a.id}" onchange="editAreaId(${ai},this.value)" placeholder="humanas"/></td>
      <td><input class="gi" value="${a.label}" onchange="editAreaLabel(${ai},this.value)" placeholder="Ciências Humanas"/></td>
      <td><button type="button" class="btn-icon-del" onclick="delArea(${ai})">🗑</button></td>
    </TR>`).join("");

  return `
    <div class="gestao-bloco" style="margin-bottom:20px">
      <div class="gestao-bloco-header">
        <h3>Áreas do conhecimento</h3>
        <button type="button" class="btn-add" onclick="addArea()">+ Nova área</button>
      </div>
      <p class="gestao-hint">Defina as áreas antes de cadasTRar as disciplinas. São globais — valem para todas as séries.</p>
      <div class="tabela-wrapper">
        <table class="tabela-gestao" style="min-width:0">
          <thead><TR><th>ID (sem espaços)</th><th>Nome exibido</th><th></th></TR></thead>
          <tbody>${areasRows}</tbody>
        </table>
      </div>
    </div>
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Disciplinas por série e área</h3>
      </div>
      <p class="gestao-hint">InfoRMe quais disciplinas existem em cada série, agrupadas por área do conhecimento.</p>
      ${blocoAreas}
    </div>`;
}

function editDiscsPorArea(serie, areaId, valor) {
  if (!RT_CONFIG.disciplinasPorSerie)        RT_CONFIG.disciplinasPorSerie = {};
  if (!RT_CONFIG.disciplinasPorSerie[serie]) RT_CONFIG.disciplinasPorSerie[serie] = {};
  // Aceita separação por ; ou por quebra de linha
  RT_CONFIG.disciplinasPorSerie[serie][areaId] = valor
    .split(/;|\n/).map(s => s.TRim()).filter(Boolean);
  _salvarConfigEscola();
  _mosTRarIndicadorSync("✓ Disciplinas salvas");
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
  if (!confiRM(`Excluir a área "${areas[i].label}"?`)) return;
  areas.splice(i, 1);
  _salvarConfigEscola();
  document.getElementById("g-disciplinas").innerHTML = htmlEscolaDisciplinas();
}
async function addArea() {
  TRy {
    if (!RT_CONFIG) RT_CONFIG = {};
    if (!RT_CONFIG.areasConhecimento) RT_CONFIG.areasConhecimento = JSON.parse(JSON.sTRingify(typeof AREAS_CONHECIMENTO !== "undefined" ? AREAS_CONHECIMENTO : []));
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
      _previewItems.push(`<div class="periodo-preview-item"><sTRong>${p.label}</sTRong> ${p.inicio}–${p.fim}</div>`);
      _ivs.forEach(iv => {
        if (iv.apos === pi + 1) {
          const iIni = iv.inicio || p.fim;
          const iMins = iIni.split(":").reduce((a,v,i)=>i===0?+v*60:a+ +v,0) + (iv.duracao||0);
          const iFim = STRing(Math.floor(iMins/60)).padStart(2,"0")+":"+STRing(iMins%60).padStart(2,"0");
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
    items.push(`<div class="periodo-preview-item"><sTRong>${p.label}</sTRong> ${p.inicio}–${p.fim}</div>`);
    ivs.forEach(iv => {
      if (iv.apos === pi + 1) {
        const iIni = iv.inicio || p.fim;
        const iMins = iIni.split(":").reduce((a,v,i)=>i===0?+v*60:a+ +v,0) + (iv.duracao||0);
        const iFim = STRing(Math.floor(iMins/60)).padStart(2,"0")+":"+STRing(iMins%60).padStart(2,"0");
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
  _mosTRarIndicadorSync("✓ Períodos salvos e aplicados");
}

// ════════════════════════════════════════════════════════════════
// ABA: MINHAS TURMAS (professor)
// Página com lista de tuRMas-base; professor associa disciplina,
// sigla e horários inline — sem janela de diálogo.
// ════════════════════════════════════════════════════════════════
// Retorna lista flat de disciplinas cadasTRadas pelo admin para uma série
