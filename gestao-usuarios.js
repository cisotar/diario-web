// GESTAO-USUARIOS.JS — Perfil, cadastro, usuários, diários, aprovação
// Dependências: app-core.js

function _htmlCheckboxMaterias(selecionadas, areaAtual, turmasSelecionadas) {
  const lista = selecionadas ? selecionadas.split(";").map(s => s.trim()).filter(Boolean) : [];
  const turmasIds = Array.isArray(turmasSelecionadas) ? turmasSelecionadas : [];

  // Turmas-base disponíveis (do Firestore via RT_CONFIG, ou seed do aulas.js)
  const turmasBase = RT_CONFIG.turmasBase || TURMAS_BASE;

  // Se há turmas-base cadastradas, usa o novo fluxo: professor escolhe disciplina+turma
  if (turmasBase && turmasBase.length) {
    const rows = turmasBase.map((tb, idx) => {
      const tbKey = `${tb.serie}${tb.turma}`;
      // Verifica se já tem disciplina escolhida para esta turma
      const entrada = turmasIds.find ? turmasIds.find(t => t.turmaKey === tbKey) : null;
      const disc  = entrada?.disciplina || "";
      const sigla = entrada?.sigla || "";
      const sel   = entrada ? "checked" : "";
      return `
        <tr class="tb-linha" id="tb-linha-${idx}">
          <td>
            <label class="mat-check-label" style="margin:0">
              <input type="checkbox" class="mat-turma-sel" data-idx="${idx}"
                data-serie="${tb.serie}" data-turma="${tb.turma}" data-sub="${tb.subtitulo||""}"
                data-per="${tb.periodo||"manha"}" ${sel}
                onchange="_toggleTurmaLinha(${idx})">
              <span>${tb.serie}ª ${tb.turma}${tb.subtitulo?" "+tb.subtitulo:""} <small style="color:var(--text-muted)">(${tb.periodo==="tarde"?"tarde":"manhã"})</small></span>
            </label>
          </td>
          <td>
            <input class="gi gi-sm mat-turma-disc" data-idx="${idx}"
              placeholder="Disciplina" value="${disc.replace(/"/g,'&quot;')}"
              style="visibility:${sel?"visible":"hidden"}"
              oninput="_sincDiscSigla(${idx})" />
          </td>
          <td>
            <input class="gi gi-xs mat-turma-sigla" data-idx="${idx}"
              placeholder="Sigla" maxlength="6" value="${sigla.replace(/"/g,'&quot;')}"
              style="visibility:${sel?"visible":"hidden"}" />
          </td>
        </tr>`;
    }).join("");

    return `
      <label class="mat-group-label" style="margin-top:4px">Turmas em que leciona e disciplina</label>
      <p style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">Marque as turmas, informe a disciplina e a sigla.</p>
      <div class="tabela-wrapper" style="margin-bottom:8px">
        <table class="tabela-gestao" style="min-width:0">
          <thead><tr><th>Turma</th><th>Disciplina</th><th>Sigla</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Fallback sem turmas cadastradas
  const temDiscs = Object.keys(RT_CONFIG.disciplinasPorSerie || {}).length > 0;
  if (!temDiscs) {
    return `<label>Disciplina(s) <span style="font-size:.72rem;color:var(--text-muted)">(separe por ;)</span>
      <input class="gi" id="perf-disc-outro" value="${lista.join("; ").replace(/"/g,'&quot;')}"
        placeholder="Geografia; Sociologia…" />
    </label>`;
  }

  const areaOpts = AREAS_CONHECIMENTO.map(a =>
    `<option value="${a.id}" ${areaAtual===a.id?"selected":""}>${a.label}</option>`
  ).join("");

  const discsDaArea = areaAtual ? _disciplinasDaArea(areaAtual) : [];
  const todasConhecidas = _todasDisciplinas();
  const extras = lista.filter(m => !todasConhecidas.includes(m));

  const checks = discsDaArea.map(m => {
    const checked = lista.includes(m) ? "checked" : "";
    return `<label class="mat-check-label">
      <input type="checkbox" class="mat-chk" value="${m.replace(/"/g,'&quot;')}"
        ${checked} onchange="_onDiscChange()">
      <span>${m}</span>
    </label>`;
  }).join("");

  // Turmas disponíveis para as disciplinas já selecionadas
  const turmasDisp = _turmasParaDiscs(lista);
  const turmasHtml = turmasDisp.length ? `
    <label class="mat-group-label" id="mat-turmas-label" style="margin-top:12px">Turmas em que leciona</label>
    <div class="mat-checks" id="mat-turmas-wrap">
      ${turmasDisp.map(t => {
        const checked = turmasIds.includes(t.id) ? "checked" : "";
        return `<label class="mat-check-label">
          <input type="checkbox" class="mat-turma-chk" value="${t.id}" ${checked}>
          <span>${t.serie}ª ${t.turma} — ${t.disciplina}</span>
        </label>`;
      }).join("")}
    </div>` : `<div id="mat-turmas-wrap"></div>`;

  return `
    <label class="mat-group-label">Área do conhecimento
      <select class="gi" id="perf-area" onchange="_onAreaChange(this.value)">
        <option value="">— selecione —</option>
        ${areaOpts}
      </select>
    </label>
    <label class="mat-group-label">Disciplina(s) que leciona</label>
    <div class="mat-checks" id="mat-checks-wrap">
      ${discsDaArea.length ? checks : '<span style="color:var(--text-muted);font-size:.8rem">Selecione uma área para ver as disciplinas</span>'}
    </div>
    <label class="mat-outro-label">Outra(s) não listada(s) <span style="font-size:.72rem;color:var(--text-muted)">(separe por ;)</span>
      <input class="gi" id="perf-disc-outro" value="${extras.join("; ").replace(/"/g,'&quot;')}"
        placeholder="Ex: Filosofia; Arte" onchange="_onDiscChange()" />
    </label>
    ${turmasHtml}`;
}

function _onAreaChange(areaId) {
  const wrap = document.getElementById("mat-checks-wrap");
  if (!wrap) return;
  const discs = areaId ? _disciplinasDaArea(areaId) : [];
  if (!discs.length) {
    wrap.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Nenhuma disciplina cadastrada para esta área</span>`;
    _onDiscChange();
    return;
  }
  wrap.innerHTML = discs.map(m =>
    `<label class="mat-check-label">
      <input type="checkbox" class="mat-chk" value="${m.replace(/"/g,'&quot;')}" onchange="_onDiscChange()">
      <span>${m}</span>
    </label>`
  ).join("");
  _onDiscChange();
}

// Atualiza a lista de turmas quando as disciplinas mudam
function _onDiscChange() {
  const wrapTurmas = document.getElementById("mat-turmas-wrap");
  if (!wrapTurmas) return;
  const discs = _lerDisciplinasSelecionadas().split(";").map(s => s.trim()).filter(Boolean);
  const turmas = _turmasParaDiscs(discs);
  if (!turmas.length) {
    wrapTurmas.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Selecione uma disciplina para ver as turmas disponíveis</span>`;
    // Garantir que o label existe
    let lbl = document.getElementById("mat-turmas-label");
    if (lbl) lbl.style.display = discs.length ? "" : "none";
    return;
  }
  let lbl = document.getElementById("mat-turmas-label");
  if (lbl) lbl.style.display = "";
  wrapTurmas.innerHTML = turmas.map(t =>
    `<label class="mat-check-label">
      <input type="checkbox" class="mat-turma-chk" value="${t.id}">
      <span>${t.serie}ª ${t.turma} — ${t.disciplina}</span>
    </label>`
  ).join("");
}

function _lerDisciplinasSelecionadas() {
  const checks = [...document.querySelectorAll(".mat-chk:checked")].map(c => c.value);
  const outroEl = document.getElementById("perf-disc-outro");
  const outros  = outroEl ? outroEl.value.split(";").map(s => s.trim()).filter(Boolean) : [];
  return [...checks, ...outros].join("; ");
}

// Toggle visibilidade dos campos disciplina/sigla ao marcar/desmarcar turma
function _toggleTurmaLinha(idx) {
  const chk  = document.querySelector(`.mat-turma-sel[data-idx="${idx}"]`);
  const disc = document.querySelector(`.mat-turma-disc[data-idx="${idx}"]`);
  const sig  = document.querySelector(`.mat-turma-sigla[data-idx="${idx}"]`);
  const vis  = chk?.checked ? "visible" : "hidden";
  if (disc) disc.style.visibility = vis;
  if (sig)  sig.style.visibility  = vis;
}

// Sugere sigla automaticamente a partir da disciplina
function _sincDiscSigla(idx) {
  const disc = document.querySelector(`.mat-turma-disc[data-idx="${idx}"]`)?.value || "";
  const sig  = document.querySelector(`.mat-turma-sigla[data-idx="${idx}"]`);
  if (sig && !sig.value) sig.value = disc.substring(0, 4).toUpperCase().replace(/\s/g,"");
}

// Lê as turmas selecionadas no novo formulário (retorna array de objetos)
function _lerTurmasSelecionadas() {
  const sels = [...document.querySelectorAll(".mat-turma-sel:checked")];
  return sels.map(chk => {
    const idx   = chk.dataset.idx;
    const disc  = document.querySelector(`.mat-turma-disc[data-idx="${idx}"]`)?.value.trim() || "";
    const sigla = document.querySelector(`.mat-turma-sigla[data-idx="${idx}"]`)?.value.trim().toUpperCase() || disc.substring(0,3).toUpperCase();
    return {
      turmaKey:  `${chk.dataset.serie}${chk.dataset.turma}`,
      serie:     chk.dataset.serie,
      turma:     chk.dataset.turma,
      subtitulo: chk.dataset.sub || "",
      periodo:   chk.dataset.per || "manha",
      disciplina: disc,
      sigla,
    };
  }).filter(t => t.disciplina);
}

function htmlGestaoPerfil() {
  const p   = _perfilProf || {};
  const adm = _isAdmin(_userAtual?.email) || _ehAdmin();
  const escolaGlobal  = RT_CONFIG?.nomeEscola || p.escola || "";
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Meu Perfil</h3>
      </div>
      <div class="perfil-form">
        <label>Nome completo
          <input class="gi" id="perf-nome" value="${(p.nome||'').replace(/"/g,'&quot;')}"
            placeholder="Prof. Seu Nome" />
        </label>
        <label>${adm ? "Nome da escola" : "Escola"} ${adm ? '<span style="font-size:.72rem;color:var(--text-muted)">(global — visível a todos)</span>' : ""}
          <input class="gi" id="${adm ? 'perf-escola-global' : ''}" value="${escolaGlobal.replace(/"/g,'&quot;')}"
            placeholder="Escola Estadual…" ${adm ? "" : "readonly style='opacity:.6'"} />
        </label>
        ${_htmlCheckboxMaterias(p.disciplinas || "", p.area || "", p.turmasIds || [])}
        <label style="opacity:.6;pointer-events:none;">E-mail (não editável)
          <input class="gi" value="${p.email||''}" readonly />
        </label>
        <div style="margin-top:4px;">
          <button type="button" class="btn-add" onclick="_salvarPerfil()">💾 Salvar perfil</button>
        </div>
      </div>
    </div>`;
}

async function _salvarPerfil() {
  const nome = document.getElementById("perf-nome")?.value.trim();
  if (!nome) { alert("Informe seu nome."); return; }
  if (!_perfilProf) _perfilProf = { uid: _userAtual.uid, email: _userAtual.email, status: "aprovado" };
  _perfilProf.nome        = nome;
  _perfilProf.disciplinas = _lerDisciplinasSelecionadas();
  _perfilProf.area      = document.getElementById("perf-area")?.value || _perfilProf.area || "";
  _perfilProf.turmasIds = _lerTurmasSelecionadas().length
    ? _lerTurmasSelecionadas()
    : (_perfilProf.turmasIds || []);
  // Admin: salva nome da escola
  if (_isAdmin(_userAtual?.email)) {
    const nomeEscola = document.getElementById("perf-escola-global")?.value.trim() || "";
    RT_CONFIG.nomeEscola = nomeEscola;
    try { await _dbConfigEscola().set({ nomeEscola, disciplinasPorSerie: RT_CONFIG.disciplinasPorSerie || {} }); }
    catch(e) { console.warn("Erro ao salvar config escola:", e); }
  }
  await _salvarPerfilFirestore(_perfilProf);
  _atualizarBotaoAuth();
  _atualizarTagline();
  _mostrarIndicadorSync("✓ Perfil salvo");
}

// ════════════════════════════════════════════════════════════
//  PAINEL: USUÁRIOS (apenas admin)
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  PAINEL: DISCIPLINAS POR SÉRIE (apenas admin)
// ════════════════════════════════════════════════════════════


function htmlGestaoUsuarios() {
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Usuários cadastrados</h3>
        <span id="usuarios-count" style="font-size:.8rem;color:var(--text-muted)">Carregando…</span>
      </div>
      <div id="usuarios-lista">
        <div style="padding:30px;text-align:center;color:var(--text-muted)">⏳ Buscando usuários…</div>
      </div>
    </div>`;
}

async function _carregarUsuarios() {
  try {
    const snap = await firebase.firestore().collection("professores").get();
    const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    users.sort((a,b) => {
      const ord = { pendente:0, aprovado:1, rejeitado:2 };
      return (ord[a.status]??3) - (ord[b.status]??3);
    });
    const count = document.getElementById("usuarios-count");
    if (count) count.textContent = `${users.length} usuário(s)`;
    const lista = document.getElementById("usuarios-lista");
    if (!lista) return;
    if (!users.length) {
      lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">Nenhum usuário cadastrado.</div>`;
      return;
    }
    lista.innerHTML = `
      <div class="tabela-wrapper">
        <table class="tabela-gestao">
          <thead><tr>
            <th>Nome</th><th>E-mail</th><th>Escola</th><th>Área</th><th>Disciplinas</th><th>Turmas</th>
            <th>Papel</th><th>Status</th><th>Solicitado em</th><th>Ações</th>
          </tr></thead>
          <tbody>
            ${users.map(u => {
              const isAdminUser = _isAdmin(u.email);
              const statusCls   = u.status==="aprovado" ? "prof-status-ok"
                : u.status==="rejeitado" ? "prof-status-rej" : "prof-status-pend";
              const statusLabel = u.status==="aprovado" ? "✓ Aprovado"
                : u.status==="rejeitado" ? "✗ Rejeitado" : "⏳ Pendente";
              const dt = u.solicitadoEm
                ? new Date(u.solicitadoEm).toLocaleDateString("pt-BR") : "—";
              const papelAtual = u.papel || "professor";
              const papelCell  = isAdminUser
                ? `<span class="badge-papel badge-admin">Admin</span>`
                : `<select class="gi gi-xs" onchange="_alterarPapel('${u.uid}',this.value)">
                    <option value="professor"   ${papelAtual==="professor"  ?"selected":""}>Professor</option>
                    <option value="coordenador" ${papelAtual==="coordenador"?"selected":""}>Coordenador</option>
                   </select>`;
              const acoes = isAdminUser
                ? `<span style="color:#4a5568;font-size:.75rem">—</span>`
                : `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                    ${u.status!=="aprovado"  ? `<button type="button" class="btn-add"    style="padding:4px 10px;font-size:.73rem" onclick="_aprovarUsuario('${u.uid}')">Aprovar</button>` : ""}
                    ${u.status!=="rejeitado" ? `<button class="btn-limpar" style="padding:4px 10px;font-size:.73rem" onclick="_rejeitarUsuario('${u.uid}')">Rejeitar</button>` : ""}
                    <button type="button" class="btn-icon-del" onclick="_excluirUsuario('${u.uid}')" title="Excluir">🗑</button>
                   </div>`;
              return `<tr>
                <td>${u.nome||"—"}</td>
                <td style="font-size:.78rem">${u.email||"—"}</td>
                <td style="font-size:.78rem">${u.escola||"—"}</td>
                <td style="font-size:.78rem">${u.area ? AREAS_CONHECIMENTO.find(a=>a.id===u.area)?.label||u.area : "—"}</td>
                <td style="font-size:.78rem">${u.disciplinas||"—"}</td>
                <td style="font-size:.78rem">${Array.isArray(u.turmasIds) && u.turmasIds.length ? u.turmasIds.join(", ") : "—"}</td>
                <td>${papelCell}</td>
                <td><span class="prof-status ${statusCls}">${statusLabel}</span></td>
                <td style="font-size:.78rem">${dt}</td>
                <td>${acoes}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    const lista = document.getElementById("usuarios-lista");
    if (lista) lista.innerHTML = `<div style="padding:20px;color:var(--red)">Erro ao carregar usuários.</div>`;
  }
}

async function _aprovarUsuario(uid) {
  const papelSel = document.querySelector(`[onchange*="_alterarPapel('${uid}"]`)?.value || "professor";
  try {
    const db = firebase.firestore();
    // Busca perfil para pegar turmasIds
    const profSnap = await db.collection("professores").doc(uid).get();
    const profData = profSnap.data() || {};
    const turmasIds = Array.isArray(profData.turmasIds) ? profData.turmasIds : [];

    // Se há turmas selecionadas, injeta no diário do professor
    if (turmasIds.length) {
      // turmasIds pode ser array de strings (legado) ou array de objetos (novo formato)
      const turmasDoProf = turmasIds.map(t => {
        if (typeof t === "string") {
          // Legado: tenta encontrar em TURMAS
          const found = TURMAS.find(x => x.id === t);
          return found ? { ...found, profUid: uid } : null;
        }
        // Novo formato: objeto {serie, turma, disciplina, sigla, subtitulo, periodo}
        const id = `${t.serie}${t.turma}_${t.sigla}`;
        // Verifica duplicata
        return {
          id,
          serie:      t.serie,
          turma:      t.turma,
          subtitulo:  t.subtitulo || "",
          disciplina: t.disciplina,
          sigla:      t.sigla,
          periodo:    t.periodo || "manha",
          horarios:   [],
          profUid:    uid,
        };
      }).filter(Boolean);
      const diarioRef = db.collection("diario").doc(uid);
      const diarioSnap = await diarioRef.get();
      const diarioAtual = diarioSnap.exists ? diarioSnap.data() : {};
      const turmasAtuais = diarioAtual.RT_TURMAS ? JSON.parse(diarioAtual.RT_TURMAS) : [];
      const idsAtuais = new Set(turmasAtuais.map(t => t.id));
      const novas = turmasDoProf.filter(t => !idsAtuais.has(t.id));
      await diarioRef.set({
        ...diarioAtual,
        RT_TURMAS: JSON.stringify([...turmasAtuais, ...novas])
      }, { merge: true });
    }

    await db.collection("professores").doc(uid)
      .update({ status: "aprovado", papel: papelSel });
    _mostrarIndicadorSync(`✓ Aprovado como ${papelSel}${turmasIds.length ? ` · ${turmasIds.length} turma(s) associada(s)` : ""}`);
    _carregarUsuarios();
  } catch(e) { console.error(e); alert("Erro ao aprovar: " + e.message); }
}

async function _rejeitarUsuario(uid) {
  if (!confirm("Rejeitar o acesso deste usuário?")) return;
  try {
    await firebase.firestore().collection("professores").doc(uid).update({ status: "rejeitado" });
    _mostrarIndicadorSync("✓ Acesso rejeitado");
    _carregarUsuarios();
  } catch(e) { alert("Erro ao rejeitar."); }
}

async function _excluirUsuario(uid) {
  if (!confirm("Excluir este usuário? Os dados do diário dele não serão apagados.")) return;
  try {
    await firebase.firestore().collection("professores").doc(uid).delete();
    _mostrarIndicadorSync("✓ Usuário excluído");
    _carregarUsuarios();
  } catch(e) { alert("Erro ao excluir."); }
}

async function _alterarPapel(uid, papel) {
  try {
    await firebase.firestore().collection("professores").doc(uid).update({ papel });
    _mostrarIndicadorSync(`✓ Papel alterado: ${papel}`);
  } catch(e) { alert("Erro ao alterar papel."); }
}

// ════════════════════════════════════════════════════════════
//  PAINEL: DIÁRIOS (coordenador — somente leitura)
// ════════════════════════════════════════════════════════════
function htmlGestaoDiarios() {
  return `
    <div class="gestao-bloco">
      <div class="gestao-bloco-header">
        <h3>Diários dos professores associados</h3>
        <span id="diarios-count" style="font-size:.8rem;color:var(--text-muted)">Carregando…</span>
      </div>
      <div id="diarios-lista">
        <div style="padding:30px;text-align:center;color:var(--text-muted)">⏳ Carregando…</div>
      </div>
    </div>`;
}

async function _carregarDiariosCoord() {
  const lista = document.getElementById("diarios-lista");
  const count = document.getElementById("diarios-count");
  const uids  = _perfilProf?.professoresAssociados || [];
  if (!uids.length) {
    if (lista) lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">
      Nenhum professor associado a você ainda.<br>
      Peça ao administrador para fazer a associação.</div>`;
    if (count) count.textContent = "0 professor(es)";
    return;
  }
  await _carregarDiariosAssociados(uids);
  const qtd = Object.keys(_diariosAssociados).length;
  if (count) count.textContent = `${qtd} professor(es)`;
  if (!lista) return;
  if (!qtd) {
    lista.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)">Nenhum dado encontrado.</div>`;
    return;
  }
  lista.innerHTML = Object.entries(_diariosAssociados).map(([uid, dados]) => {
    const p      = dados.perfil;
    const turmas = dados.RT_TURMAS || [];
    const tags   = turmas.length
      ? turmas.map(t =>
          `<span style="display:inline-block;background:var(--amber-pale);color:var(--amber);
            border-radius:4px;padding:2px 8px;margin:2px;font-weight:600;font-size:.78rem;">
            ${t.serie}ª ${t.turma}${t.subtitulo?" "+t.subtitulo:""} · ${t.sigla}
          </span>`).join("")
      : `<em style="color:var(--text-muted);font-size:.8rem;">Sem turmas cadastradas</em>`;
    return `
      <div style="margin-bottom:16px;padding:16px 18px;
        background:var(--bg-paper);border:1px solid var(--border);border-radius:var(--radius);">
        <div style="font-family:'DM Serif Display',serif;font-size:1.05rem;margin-bottom:3px;">
          ${p.nome||uid}
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px;">
          ${p.email||""} · ${p.disciplinas||""}
        </div>
        <div>${tags}</div>
      </div>`;
  }).join("");
}
let contDragIdx = null;
function contDragStart(e, i)  { contDragIdx = i; e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",i); }
function contDragEnter(e, i)  { e.target.closest("tr")?.classList.add("cont-drag-over"); }
function contDrop(e, destIdx) {
  e.preventDefault();
  e.target.closest("tr")?.classList.remove("cont-drag-over");
  if (contDragIdx===null || contDragIdx===destIdx) return;
  const chave = gContChave;
  const lista = RT_CONTEUDOS[chave];
  const [item] = lista.splice(contDragIdx, 1);
  lista.splice(destIdx, 0, item);
  contDragIdx = null;
  const m = chave.match(/^(.+)_b(\d+)$/);
  if (m) {
    const base = m[1], bimN = +m[2];
    for (const t of RT_TURMAS) {
      if (`${t.serie}_${t.disciplina}` !== base) continue;
      delete ordemConteudos[chaveOrdem(t.id, bimN)];
    }
  }
  salvarTudo();
  document.getElementById("g-conteudos").innerHTML = htmlGestaoConteudos();
}
