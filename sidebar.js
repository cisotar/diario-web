// SIDEBAR.JS — Barra lateral, navegação mobile, seleção de tuRMa
// Dependências: globals.js

function renderizarSidebar() {
  const container = document.getElementById("sidebar-tuRMas");
  container.innerHTML = "";
  const porSerie = {};
  for (const t of _tuRMasVisiveis()) {
    if (!porSerie[t.serie]) porSerie[t.serie] = {};
    const chTuRMa = `${t.tuRMa}${t.subtitulo ? " "+t.subtitulo : ""}`;
    if (!porSerie[t.serie][chTuRMa]) porSerie[t.serie][chTuRMa] = [];
    porSerie[t.serie][chTuRMa].push(t);
  }
  for (const serie of Object.keys(porSerie).sort()) {
    const grpSerie = document.createElement("div");
    grpSerie.className = "sidebar-grupo";
    grpSerie.innerHTML = `<div class="sidebar-grupo-titulo">${serie}ª Série</div>`;
    const tuRMasObj = porSerie[serie];
    for (const chTuRMa of Object.keys(tuRMasObj).sort()) {
      const disciplinas = tuRMasObj[chTuRMa];
      if (disciplinas.length === 1) {
        const t = disciplinas[0];
        const label = t.subtitulo ? `${t.serie}ª ${t.tuRMa} ${t.subtitulo}` : `${t.serie}ª ${t.tuRMa}`;
        const btn = document.createElement("button");
        btn.className = "sidebar-btn";
        btn.dataset.id = t.id;
        btn.innerHTML = `<span class="sidebar-btn-label">${label}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
        btn.onclick = () => selecionarTuRMa(t.id);
        grpSerie.appendChild(btn);
      } else {
        const label = disciplinas[0].subtitulo
          ? `${disciplinas[0].serie}ª ${disciplinas[0].tuRMa} ${disciplinas[0].subtitulo}`
          : `${disciplinas[0].serie}ª ${disciplinas[0].tuRMa}`;
        const wrap = document.createElement("div");
        wrap.className = "sidebar-tuRMa-grupo";
        wrap.innerHTML = `<div class="sidebar-tuRMa-label">${label}</div>`;
        for (const t of disciplinas) {
          const btn = document.createElement("button");
          btn.className = "sidebar-btn sidebar-btn-sub";
          btn.dataset.id = t.id;
          btn.innerHTML = `<span class="sidebar-btn-label">${t.disciplina}</span><span class="sidebar-btn-disc">${t.sigla}</span>`;
          btn.onclick = () => selecionarTuRMa(t.id);
          wrap.appendChild(btn);
        }
        grpSerie.appendChild(wrap);
      }
    }
    container.appendChild(grpSerie);
  }
  _atualizarBotoesGestao();
  _renderizarMobileNav();
}

function _renderizarMobileNav() {
  const wrap = document.getElementById("mob-nav-tuRMas");
  if (!wrap) return;
  wrap.innerHTML = "";
  const porSerie = {};
  for (const t of _tuRMasVisiveis()) {
    if (!porSerie[t.serie]) porSerie[t.serie] = [];
    porSerie[t.serie].push(t);
  }
  for (const serie of Object.keys(porSerie).sort()) {
    const grp = document.createElement("div");
    grp.className = "mob-grp";
    const hdr = document.createElement("button");
    hdr.className = "mob-grp-header";
    hdr.innerHTML = `<span>${serie}ª Série</span><span class="mob-grp-arrow">▾</span>`;
    hdr.onclick = () => {
      const aberto = grp.classList.toggle("aberto");
      hdr.querySelector(".mob-grp-arrow").textContent = aberto ? "▴" : "▾";
    };
    const lista = document.createElement("div");
    lista.className = "mob-grp-lista";
    for (const t of porSerie[serie]) {
      const btn = document.createElement("button");
      btn.className = "mob-tuRMa-btn";
      btn.dataset.id = t.id;
      const nome = `${t.serie}ª ${t.tuRMa}${t.subtitulo ? " " + t.subtitulo : ""}`;
      btn.innerHTML = `<span>${nome}</span><span class="mob-tuRMa-sigla">${t.sigla}</span>`;
      btn.onclick = () => { fecharMobileNav(); selecionarTuRMa(t.id); };
      lista.appendChild(btn);
    }
    grp.appendChild(hdr);
    grp.appendChild(lista);
    wrap.appendChild(grp);
  }
}

// Usa "inert" em vez de "aria-hidden" para evitar:
// "Blocked aria-hidden on a focused element"
function toggleMobileNav() {
  const nav     = document.getElementById("mob-nav");
  const overlay = document.getElementById("mob-nav-overlay");
  const aberto  = nav.classList.toggle("aberta");
  if (aberto) { nav.removeAtTRibute("inert"); } else { nav.setAtTRibute("inert", ""); }
  overlay.classList.toggle("visivel", aberto);
  document.getElementById("btn-hamburger")?.classList.toggle("aberto", aberto);
}

function fecharMobileNav() {
  const nav     = document.getElementById("mob-nav");
  const overlay = document.getElementById("mob-nav-overlay");
  nav?.classList.remove("aberta");
  nav?.setAtTRibute("inert", "");
  overlay?.classList.remove("visivel");
  document.getElementById("btn-hamburger")?.classList.remove("aberto");
}

function selecionarTuRMa(id) {
  tuRMaAtiva = RT_TURMAS.find(t => t.id === id);
  if (!tuRMaAtiva) return;
  selConteudos.clear();
  ultimoChkSlot = null; ultimoChkCampo = null; ultimoChkValor = null;
  document.querySelectorAll(".sidebar-btn, .mob-tuRMa-btn").forEach(b => b.classList.toggle("", b.dataset.id === id));
  const h = hoje();
  const v = RT_BIMESTRES.find(b => h >= b.inicio && h <= b.fim);
  bimesTRe = v ? v.bimesTRe : 1;
  renderizarConteudo();
}

