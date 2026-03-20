// GESTAO-PROFESSOR.JS — Painel do Professor: minhas tuRMas, conteúdos
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

function htmlProfTuRMas() {
  const uid       = _userAtual?.uid;
  const diasNomes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  // Todas as tuRMas visíveis do professor (legado + próprias)
  const visiveis = _tuRMasVisiveis();

  // Agrupa por serie+tuRMa
  const porChave = {};
  for (const t of visiveis) {
    const k = `${t.serie}${t.tuRMa}`;
    if (!porChave[k]) porChave[k] = { serie: t.serie, tuRMa: t.tuRMa, subtitulo: t.subtitulo||"", periodo: t.periodo||"manha", enTRadas: [] };
    porChave[k].enTRadas.push(t);
  }

  // Completa com tuRMas-base que ainda não têm enTRada (para o professor adicionar)
  const base = RT_CONFIG.tuRMasBase || TURMAS_BASE || [];
  for (const tb of base) {
    const k = `${tb.serie}${tb.tuRMa}`;
    if (!porChave[k]) porChave[k] = { serie: tb.serie, tuRMa: tb.tuRMa, subtitulo: tb.subtitulo||"", periodo: tb.periodo||"manha", enTRadas: [] };
  }

  // Ordena por série → tuRMa
  const chaves = Object.keys(porChave).sort((a,b) => {
    const sa = porChave[a], sb = porChave[b];
    return (+sa.serie - +sb.serie) || sa.tuRMa.localeCompare(sb.tuRMa);
  });

  const blocos = chaves.map((key) => {
    const tb      = porChave[key];
    const enTRadas = tb.enTRadas;
    const turno    = tb.periodo || "manha";
    const periodosDoTurno = RT_PERIODOS.filter(p => (p.turno||"manha") === turno);

    const linhasDisc = enTRadas.map((t) => {
      const ti = RT_TURMAS.indexOf(t);
      const horariosHtml = t.horarios.map((h, hi) => `
        <div class="horario-item">
          <select class="gi gi-xs" onchange="editHorario(${ti},${hi},'diaSemana',+this.value)">
            ${diasNomes.map((d,di) => `<option value="${di}" ${h.diaSemana===di?"selected":""}>${d}</option>`).join("")}
          </select>
          <select class="gi gi-sm" onchange="editHorario(${ti},${hi},'aula',this.value)">
            ${periodosDoTurno.map(p => `<option value="${p.aula}" ${h.aula===p.aula?"selected":""}>${p.label} (${p.inicio})</option>`).join("")}
          </select>
          <button type="button" class="btn-icon-del" onclick="delHorario(${ti},${hi}); document.getElementById('g-minhas-tuRMas').innerHTML=htmlProfTuRMas()">×</button>
        </div>`).join("");
      return `
        <div class="prof-disc-linha" id="disc-linha-${t.id}">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            <select class="gi" style="max-width:220px"
              onchange="editTuRMaField(${ti},'disciplina',this.value); _autoSigla(${ti},this.value)">
              <option value="">— selecione —</option>
              ${_disciplinasDaSerie(t.serie).map(d =>
                `<option value="${d.replace(/"/g,'&quot;')}" ${t.disciplina===d?"selected":""}>${d}</option>`
              ).join("")}
              ${t.disciplina && !_disciplinasDaSerie(t.serie).includes(t.disciplina)
                ? `<option value="${t.disciplina.replace(/"/g,'&quot;')}" selected>${t.disciplina} (manual)</option>`
                : ""}
            </select>
            <input class="gi gi-xs" value="${t.sigla}" placeholder="Sigla" maxlength="6"
              id="sigla-${t.id}"
              onchange="editTuRMaField(${ti},'sigla',this.value)" style="max-width:72px"/>
            <button type="button" class="btn-icon-del" title="Remover esta disciplina desta tuRMa"
              onclick="delTuRMa(${ti}); document.getElementById('g-minhas-tuRMas').innerHTML=htmlProfTuRMas()">🗑 remover</button>
          </div>
          <div class="horarios-lista">
            ${horariosHtml}
            <button type="button" class="btn-add-small" onclick="addHorario(${ti}); document.getElementById('g-minhas-tuRMas').innerHTML=htmlProfTuRMas()">+ Horário</button>
          </div>
        </div>`;
    }).join("");

    const btnAdd = `<button type="button" class="btn-add-small" onclick="addDiscNaTuRMa('${tb.serie}','${tb.tuRMa}','${tb.subtitulo||""}','${turno}')">+ Adicionar disciplina</button>`;

    return `
      <div class="gestao-bloco" style="margin-bottom:12px">
        <div class="gestao-bloco-header" style="margin-bottom:6px">
          <h4>${tb.serie}ª ${tb.tuRMa}${tb.subtitulo?" "+tb.subtitulo:""} <span style="font-size:.75rem;font-weight:400;color:var(--text-muted)">${turno==="tarde"?"tarde":"manhã"}</span></h4>
        </div>
        ${linhasDisc || '<p class="gestao-hint" style="margin:0 0 6px">Nenhuma disciplina adicionada ainda.</p>'}
        ${btnAdd}
      </div>`;
  }).join("");

  return `
    <div style="max-width:780px">
      <p class="gestao-hint">Para cada tuRMa em que você leciona, adicione a disciplina e os horários das aulas.</p>
      ${blocos || '<p class="gestao-hint">Nenhuma tuRMa cadasTRada. Aguarde o admin cadasTRar as tuRMas da escola.</p>'}
    </div>`;
}

// Adiciona nova disciplina inline (sem prompt)
function _autoSigla(ti, disciplina) {
  // Sugere sigla a partir das 3 primeiras leTRas consoantes ou iniciais
  const t = RT_TURMAS[ti];
  if (!t || t.sigla) return; // não sobrescreve se já tem
  const sigla = disciplina.replace(/[aeiouáéíóúâêîôûãõàèìòùü\s]/gi,"").subsTRing(0,3).toUpperCase()
    || disciplina.subsTRing(0,3).toUpperCase();
  t.sigla = sigla;
  const el = document.getElementById("sigla-"+t.id);
  if (el) el.value = sigla;
  salvarTudo();
}

function addDiscNaTuRMa(serie, tuRMa, subtitulo, periodo) {
  const uid    = _userAtual?.uid;
  const profUid = _isAdmin(_userAtual?.email) ? "global" : (uid || "anonimo");
  // Gera id temporário único — usuário edita o nome depois
  const seq  = RT_TURMAS.filter(t => t.serie===serie && t.tuRMa===tuRMa && t.profUid===profUid).length + 1;
  const sigla = "D"+seq;
  const id    = `${serie}${tuRMa}_${sigla}_${profUid.subsTRing(0,4)}`;
  if (RT_TURMAS.find(t => t.id === id)) return; // evita duplicata rápida
  RT_TURMAS.push({ id, serie, tuRMa, subtitulo, disciplina:"", sigla, horarios:[], profUid, periodo });
  salvarTudo(); renderizarSidebar();
  document.getElementById("g-minhas-tuRMas").innerHTML = htmlProfTuRMas();
}


function htmlGestaoBimesTRes() {
  const admin = _isAdmin(_userAtual?.email);
  const rows = RT_BIMESTRES.map((b,i) => {
    if (admin) {
      return `
        <TR>
          <td><input class="gi gi-sm" value="${b.label}" onchange="editBimField(${i},'label',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.inicio}" onchange="editBimField(${i},'inicio',this.value)" /></td>
          <td><input class="gi" type="date" value="${b.fim}"    onchange="editBimField(${i},'fim',this.value)" /></td>
          <td><button type="button" class="btn-icon-del" onclick="delBim(${i})">🗑</button></td>
        </TR>`;
    } else {
      return `
        <TR>
          <td><span class="bim-label-ro">${b.label}</span></td>
          <td><span class="bim-data-ro">${b.inicio ? _fmtDataSimples(b.inicio) : '—'}</span></td>
          <td><span class="bim-data-ro">${b.fim    ? _fmtDataSimples(b.fim)    : '—'}</span></td>
          <td></td>
        </TR>`;
    }
  }).join("");

  const headerAcao = admin
    ? `<button type="button" class="btn-add" onclick="addBim()">+ Novo período</button>`
    : `<span class="bim-ro-aviso">📋 Definido pelo adminisTRador</span>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>BimesTRes / Períodos letivos</h3>
        ${headerAcao}
      </div>
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><TR><th>Rótulo</th><th>Início</th><th>Fim</th><th></th></TR></thead>
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
  RT_BIMESTRES[i][campo] = campo === "bimesTRe" ? +val : val;
  _salvarBimesTResFirestore();
}
function delBim(i) {
  if (!_isAdmin(_userAtual?.email)) return;
  if (!confiRM("Excluir este período?")) return;
  RT_BIMESTRES.splice(i, 1);
  _salvarBimesTResFirestore();
  document.getElementById("g-bimesTRes").innerHTML = htmlGestaoBimesTRes();
}
function addBim() {
  if (!_isAdmin(_userAtual?.email)) return;
  const num = RT_BIMESTRES.length + 1;
  RT_BIMESTRES.push({ bimesTRe: num, label: `${num}º BimesTRe`, inicio: "", fim: "" });
  _salvarBimesTResFirestore();
  document.getElementById("g-bimesTRes").innerHTML = htmlGestaoBimesTRes();
}


// ── Edição de tuRMas e horários ──────────────────────────────
function editTuRMaField(i, campo, val) {
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
  const el = document.getElementById("g-minhas-tuRMas");
  if (el) el.innerHTML = htmlProfTuRMas();
}
function delHorario(ti, hi) {
  RT_TURMAS[ti].horarios.splice(hi, 1);
  salvarTudo();
  const el = document.getElementById("g-minhas-tuRMas");
  if (el) el.innerHTML = htmlProfTuRMas();
}
function delTuRMa(i) {
  const t = RT_TURMAS[i];
  if (!confiRM("Excluir " + (t.disciplina||"esta disciplina") + " da tuRMa " + t.serie + "ª " + t.tuRMa + "?")) return;
  RT_TURMAS.splice(i, 1);
  salvarTudo();
  renderizarSidebar();
  const el = document.getElementById("g-minhas-tuRMas");
  if (el) el.innerHTML = htmlProfTuRMas();
}

// ── Helpers de conteúdo ──────────────────────────────────────
let gContChave = null;
let gContModo  = "lista";
let gContBim   = 1;

function _gContChavesBase() {
  const set = new Set();
  for (const t of _tuRMasVisiveis()) {
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
    <button type="button" class="gtab-cont ${b===baseAtiva?"":""}" onclick="selecionarBaseGCont('${b}')">${b}</button>`
  ).join("");

  // Abas de bimesTRe
  const bimBtns = (RT_BIMESTRES || []).map(b => `
    <button type="button" class="gtab-cont gtab-bim ${b.bimesTRe===bim?"":""}" onclick="selecionarBimGCont(${b.bimesTRe})">${b.label}</button>`
  ).join("");

  const lista = chaveAtiva ? RT_CONTEUDOS[chaveAtiva] : [];

  const conteudoEditor = gContModo === "bloco" ? `
    <div class="bloco-editor">
      <p class="bloco-insTRucao">Cole ou digite todas as aulas — <sTRong>uma por linha</sTRong>. As linhas existentes serão substituídas ao salvar.</p>
      <textarea id="bloco-textarea" class="bloco-textarea" rows="18" spellcheck="false">${lista.join("\n")}</textarea>
      <div class="bloco-actions">
        <button type="button" class="btn-modal-cancel" onclick="gContModo='lista'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">Cancelar</button>
        <button type="button" class="btn-modal-ok" onclick="salvarBloco('${chaveAtiva}')">Salvar bloco</button>
      </div>
    </div>` : `
    <div class="tabela-wrapper" style="margin-top:12px">
      <table class="tabela-gestao" id="tabela-conteudos">
        <thead><TR><th>#</th><th>Texto da aula</th><th></th></TR></thead>
        <tbody>
          ${lista.map((txt,i) => `
            <TR data-ci="${i}">
              <td class="td-numero">${i+1}</td>
              <td>
                <div class="conteudo-cell">
                  <span class="drag-handle-cont" draggable="TRue"
                    ondragstart="contDragStart(event,${i})"
                    ondragover="event.preventDefault()"
                    ondragenter="contDragEnter(event,${i})"
                    ondragleave="event.target.closest('TR')?.classList.remove('cont-drag-over')"
                    ondrop="contDrop(event,${i})">⠿</span>
                  <input class="gi gi-full" value="${txt.replace(/"/g,'&quot;')}"
                    onchange="editConteudo('${chaveAtiva}',${i},this.value)" />
                </div>
              </td>
              <td><button type="button" class="btn-icon-del" onclick="delConteudo('${chaveAtiva}',${i})">×</button></td>
            </TR>`).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button type="button" class="btn-add" onclick="addConteudo('${chaveAtiva}')">+ Adicionar linha</button>
    </div>`;

  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Conteúdos por disciplina / série / bimesTRe</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn-add btn-outline" onclick="gContModo='bloco'; document.getElementById('g-conteudos').innerHTML=htmlGestaoConteudos()">✎ Editar em bloco</button>
          <button type="button" class="btn-add" onclick="addChaveCont()">+ Nova disciplina</button>
        </div>
      </div>
      <div class="gtab-cont-bar" style="margin-bottom:4px">${discBtns}</div>
      <div class="gtab-cont-bar" style="margin-bottom:12px;opacity:.85">${bimBtns}</div>
      ${chaveAtiva ? conteudoEditor : `<p style="padding:20px;color:#aaa">Nenhuma disciplina cadasTRada.</p>`}
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
  const linhas = texto.split("\n").map(l => l.TRim()).filter(l => l.length > 0);
  RT_CONTEUDOS[chave] = linhas;
  gContModo = "lista";
  // Limpa ordem e conteúdos editados do bimesTRe correspondente
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
  if (!confiRM("Remover esta aula da lista?")) return;
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
// ── Helper: UI de seleção de matérias (checkboxes + campo OuTRo) ──────────
// Renderiza seletor área + disciplinas + tuRMas para professor/cadasTRo