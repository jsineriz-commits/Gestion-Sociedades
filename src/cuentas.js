// src/cuentas.js — Módulo de Gestión de Cuentas
// Lee comentarios del Sheets y los fusiona con razones sociales de Metabase (Q188)

let ALL_COMMENTS = [];     // [{cuit, fecha, comentario}]
let RAZONES_MAP  = {};     // {cuit: razonSocial}
let CUENTAS_DATA = [];     // array de {cuit, nombre, comentarios[]}
let _initialized = false;

// ─── Inicialización (llamada al entrar a la tab) ───────────────────────────
window.initCuentas = async function() {
  if (_initialized) return;
  _initialized = true;
  renderCuentasLoading();

  try {
    // 1. Traer comentarios del Sheet
    const comments = await fetch('/api/getCuentasComments').then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
    ALL_COMMENTS = comments;

    // 2. Intentar tomar las razones sociales del TERR_DATA global (ya cargado)
    if (window.TERR_DATA && window.TERR_DATA.acSocieties) {
      for (const s of window.TERR_DATA.acSocieties) {
        if (s.cuit && s.nombre) RAZONES_MAP[String(s.cuit).trim()] = s.nombre;
      }
    }

    buildCuentasData();
    renderCuentasList(CUENTAS_DATA);
  } catch (err) {
    document.getElementById('cuentas-list').innerHTML = `
      <div class="cuentas-empty">
        <i data-lucide="alert-triangle" style="width:40px;height:40px;color:#f59e0b;"></i>
        <p style="color:#f59e0b;font-weight:600;margin-bottom:0.5rem;">Error al cargar comentarios</p>
        <p style="font-size:0.8rem;">${err.message}</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
  }
};

// ─── Construir estructura agrupada por CUIT ────────────────────────────────
function buildCuentasData() {
  const map = {};
  for (const c of ALL_COMMENTS) {
    if (!c.cuit) continue;
    if (!map[c.cuit]) map[c.cuit] = { cuit: c.cuit, nombre: RAZONES_MAP[c.cuit] || '', comments: [] };
    map[c.cuit].comments.push({ fecha: c.fecha, comentario: c.comentario });
  }
  // Ordenar comentarios de más reciente a más antiguo dentro de cada cuenta
  for (const key in map) map[key].comments.reverse();
  CUENTAS_DATA = Object.values(map).sort((a, b) => b.comments.length - a.comments.length);
}

// ─── Filtrar por búsqueda ──────────────────────────────────────────────────
window.filterCuentas = function(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return renderCuentasList(CUENTAS_DATA);
  const filtered = CUENTAS_DATA.filter(c =>
    c.cuit.toLowerCase().includes(q) ||
    (c.nombre || '').toLowerCase().includes(q)
  );
  renderCuentasList(filtered);
};

// ─── Render de la lista ────────────────────────────────────────────────────
function renderCuentasLoading() {
  document.getElementById('cuentas-list').innerHTML = `
    <div class="cuentas-empty">
      <div class="spinner" style="margin: 0 auto 1rem;"></div>
      Cargando cuentas...
    </div>`;
}

function renderCuentasList(data) {
  const badge = document.getElementById('cuentas-count-badge');
  if (badge) badge.textContent = `${data.length} ${data.length === 1 ? 'cuenta' : 'cuentas'}`;

  if (!data.length) {
    document.getElementById('cuentas-list').innerHTML = `
      <div class="cuentas-empty">
        <i data-lucide="search" style="width:40px;height:40px;"></i>
        No se encontraron cuentas
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const html = data.map(cuenta => buildCuentaCard(cuenta)).join('');
  document.getElementById('cuentas-list').innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function buildCuentaCard(cuenta) {
  const commentsHtml = cuenta.comments.length
    ? cuenta.comments.map(c => `
        <div class="comment-item">
          <div class="comment-dot"></div>
          <div class="comment-content">
            <div class="comment-text">${escapeHtml(c.comentario)}</div>
            <div class="comment-meta">${escapeHtml(c.fecha)}</div>
          </div>
        </div>`).join('')
    : `<div style="color:var(--text-secondary);font-size:0.85rem;padding:0.5rem 0;">Sin comentarios aún.</div>`;

  const nombreDisplay = cuenta.nombre || `CUIT ${cuenta.cuit}`;
  const cuitDisplay   = cuenta.nombre ? `CUIT: ${cuenta.cuit}` : '';

  return `
  <div class="cuenta-card" id="card-${sanitizeId(cuenta.cuit)}">
    <div class="cuenta-header" onclick="toggleCuenta('${sanitizeId(cuenta.cuit)}')">
      <div class="cuenta-title-group">
        <span class="cuenta-nombre">${escapeHtml(nombreDisplay)}</span>
        ${cuitDisplay ? `<span class="cuenta-cuit">${escapeHtml(cuitDisplay)}</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="cuenta-badge">${cuenta.comments.length} comentario${cuenta.comments.length !== 1 ? 's' : ''}</span>
        <i data-lucide="chevron-down" style="width:16px;height:16px;color:var(--text-secondary);transition:transform 0.25s;" id="chevron-${sanitizeId(cuenta.cuit)}"></i>
      </div>
    </div>
    <div class="cuenta-body" id="body-${sanitizeId(cuenta.cuit)}">
      <div class="comment-timeline">${commentsHtml}</div>
      <div class="add-comment-form">
        <textarea 
          id="textarea-${sanitizeId(cuenta.cuit)}"
          placeholder="Escribí un comentario sobre esta cuenta..."
          rows="2"
        ></textarea>
        <button class="btn-save-comment" onclick="saveComment('${cuenta.cuit}', '${sanitizeId(cuenta.cuit)}')">
          <i data-lucide="send" style="width:14px;height:14px;"></i>
          Guardar
        </button>
      </div>
    </div>
  </div>`;
}

// ─── Toggle expand/collapse ────────────────────────────────────────────────
window.toggleCuenta = function(safeId) {
  const body    = document.getElementById('body-' + safeId);
  const chevron = document.getElementById('chevron-' + safeId);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
};

// ─── Guardar comentario ────────────────────────────────────────────────────
window.saveComment = async function(cuit, safeId) {
  const textarea = document.getElementById('textarea-' + safeId);
  if (!textarea) return;
  const texto = textarea.value.trim();
  if (!texto) { textarea.focus(); return; }

  const btn = textarea.nextElementSibling;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;"></i> Guardando...';
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/addCuentaComment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuit, comentario: texto }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar');

    // Agregar el nuevo comentario localmente al objeto de datos
    const cuenta = CUENTAS_DATA.find(c => c.cuit === cuit);
    if (cuenta) {
      cuenta.comments.unshift({ fecha: data.fecha, comentario: texto });
    } else {
      // Es una cuenta nueva (sin comentarios previos)
      CUENTAS_DATA.unshift({ cuit, nombre: RAZONES_MAP[cuit] || '', comments: [{ fecha: data.fecha, comentario: texto }] });
    }
    ALL_COMMENTS.push({ cuit, fecha: data.fecha, comentario: texto });

    textarea.value = '';
    // Re-render solo esta card
    const card = document.getElementById('card-' + safeId);
    const cuentaData = CUENTAS_DATA.find(c => c.cuit === cuit);
    if (card && cuentaData) {
      const newCardHtml = buildCuentaCard(cuentaData);
      card.outerHTML = newCardHtml;
      // Reabrir el body
      const newBody = document.getElementById('body-' + safeId);
      const newChevron = document.getElementById('chevron-' + safeId);
      if (newBody) newBody.classList.add('open');
      if (newChevron) newChevron.style.transform = 'rotate(180deg)';
      if (window.lucide) lucide.createIcons();
    }

    // Actualizar badge
    const badge = document.getElementById('cuentas-count-badge');
    if (badge) badge.textContent = `${CUENTAS_DATA.length} cuentas`;

  } catch (err) {
    alert('Error al guardar: ' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" style="width:14px;height:14px;"></i> Guardar';
    if (window.lucide) lucide.createIcons();
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sanitizeId(str) {
  return String(str || '').replace(/[^a-zA-Z0-9]/g, '_');
}

// ─── Nueva Cuenta / Comentario desde form superior ─────────────────────────
window.showNewCuentaForm = function() {
  const form = document.getElementById('new-cuenta-form');
  if (form) {
    form.style.display = 'block';
    const inp = document.getElementById('new-cuit-input');
    if (inp) inp.focus();
    if (window.lucide) lucide.createIcons();
  }
};

window.hideNewCuentaForm = function() {
  const form = document.getElementById('new-cuenta-form');
  if (form) form.style.display = 'none';
};

window.saveNewCuentaComment = async function() {
  const cuitInput    = document.getElementById('new-cuit-input');
  const commentInput = document.getElementById('new-comment-input');
  const btn          = document.querySelector('#new-cuenta-form .btn-save-comment');
  if (!cuitInput || !commentInput) return;

  const cuit      = cuitInput.value.trim();
  const comentario = commentInput.value.trim();

  if (!cuit)       { cuitInput.focus();    cuitInput.style.borderColor = 'var(--danger)'; return; }
  if (!comentario) { commentInput.focus(); commentInput.style.borderColor = 'var(--danger)'; return; }

  cuitInput.style.borderColor    = '';
  commentInput.style.borderColor = '';

  if (btn) {
    btn.disabled   = true;
    btn.innerHTML  = '<i data-lucide="loader" style="width:14px;height:14px;"></i> Guardando...';
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res  = await fetch('/api/addCuentaComment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cuit, comentario }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar');

    // Actualizar estado local
    const existing = CUENTAS_DATA.find(c => c.cuit === cuit);
    if (existing) {
      existing.comments.unshift({ fecha: data.fecha, comentario });
    } else {
      CUENTAS_DATA.unshift({
        cuit,
        nombre: RAZONES_MAP[cuit] || '',
        comments: [{ fecha: data.fecha, comentario }]
      });
    }
    ALL_COMMENTS.push({ cuit, fecha: data.fecha, comentario });

    // Limpiar form y cerrar
    cuitInput.value    = '';
    commentInput.value = '';
    window.hideNewCuentaForm();

    // Re-render lista y buscar la cuenta recién guardada
    renderCuentasList(CUENTAS_DATA);

    // Expandir la card de la cuenta que se acaba de comentar
    const safeId = sanitizeId(cuit);
    const body   = document.getElementById('body-' + safeId);
    const chev   = document.getElementById('chevron-' + safeId);
    if (body)  body.classList.add('open');
    if (chev)  chev.style.transform = 'rotate(180deg)';

    // Si estaba filtrando, limpiar el filtro para ver la cuenta
    const searchInput = document.getElementById('cuentas-search-input');
    if (searchInput) searchInput.value = '';

  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '<i data-lucide="send" style="width:14px;height:14px;"></i> Guardar Comentario';
      if (window.lucide) lucide.createIcons();
    }
  }
};
