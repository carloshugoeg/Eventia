const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const categories = ['Tecnología', 'Arte y cultura', 'Comunidad', 'Bienestar', 'Música'];
const artStyles = ['technology', 'culture', 'community', 'wellness', 'music'];
const date = value => new Intl.DateTimeFormat('es-GT', { day:'numeric', month:'short', year:'numeric', timeZone:'America/Guatemala' }).format(new Date(value));
const time = value => new Intl.DateTimeFormat('es-GT', { hour:'numeric', minute:'2-digit', timeZone:'America/Guatemala' }).format(new Date(value));
const state = { user:null, events:[], total:0, registrations:[], notifications:[], query:'', category:'', view:'eventos', pendingEvent:null, request:0 };
let toastTimer;

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers:{ 'Content-Type':'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'No pudimos completar la solicitud.'), { code:data.code, status:response.status });
  return data;
}
const post = (path, data = {}) => api(path, { method:'POST', body:JSON.stringify(data) });

function toast(message, variant = 'success') {
  clearTimeout(toastTimer);
  $('#toast').textContent = message; $('#toast').dataset.variant = variant; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500);
}

function art(category) {
  const index = Math.max(0, categories.indexOf(category));
  const shapes = [
    '<rect x="82" y="28" width="103" height="103" rx="20" fill="currentColor" opacity=".16" transform="rotate(-12 132 79)"/><path d="M99 58L76 80l23 22m65-44l23 22-23 22m-19-53l-27 62" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="207" cy="37" r="7" fill="currentColor" opacity=".5"/>',
    '<path d="M74 126V61a58 58 0 01116 0v65z" fill="currentColor" opacity=".18"/><path d="M99 126V67a33 33 0 0166 0v59" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="133" cy="85" r="15" fill="currentColor" opacity=".6"/><path d="M47 114h27m116-56h30" stroke="currentColor" stroke-width="2"/>',
    '<circle cx="101" cy="69" r="35" fill="currentColor" opacity=".22"/><circle cx="159" cy="69" r="35" fill="currentColor" opacity=".45"/><circle cx="130" cy="117" r="35" fill="currentColor" opacity=".7"/><path d="M126 45h10m-5-5v10M207 115h16m-8-8v16" stroke="currentColor" stroke-width="2"/>',
    '<path d="M132 128C61 102 54 46 71 32c44 5 62 52 61 96z" fill="currentColor" opacity=".3"/><path d="M132 128c70-26 77-82 60-96-43 5-61 52-60 96z" fill="currentColor" opacity=".55"/><path d="M132 128c-35-41-32-87 0-107 32 20 35 66 0 107z" fill="currentColor" opacity=".8"/><path d="M56 133h151" stroke="currentColor" stroke-width="1"/>',
    '<circle cx="132" cy="80" r="59" fill="currentColor" opacity=".15"/><circle cx="132" cy="80" r="42" fill="none" stroke="currentColor" stroke-width="1"/><path d="M121 106V57l36-9v49M121 57v12l36-9" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><ellipse cx="110" cy="108" rx="13" ry="9" fill="currentColor"/><ellipse cx="146" cy="100" rx="13" ry="9" fill="currentColor"/>'
  ];
  return { style:`art-${artStyles[index]}`, svg:`<svg viewBox="0 0 264 165" aria-hidden="true">${shapes[index]}</svg>` };
}

function card(event, registration = null) {
  const illustration = art(event.category);
  const enrolled = state.registrations.some(item => item.event_id === event.id);
  const full = event.available === 0;
  return `<article class="event-card"><div class="card-art ${illustration.style}">${illustration.svg}<span class="availability-badge ${full ? 'full' : ''}">${enrolled ? '✓ TU LUGAR ESTÁ CONFIRMADO' : full ? 'CUPOS AGOTADOS' : event.available === 1 ? 'QUEDA 1 LUGAR' : 'INSCRIPCIONES ABIERTAS'}</span></div><div class="card-body"><div class="card-eyebrow"><span>${escape(event.category)}</span><span>QUETZALTENANGO</span></div><h3>${escape(event.title)}</h3><p class="event-meta"><span class="meta-symbol" aria-hidden="true">◷</span>${escape(date(event.starts_at))} · ${escape(time(event.starts_at))}</p><p class="event-meta"><span class="meta-symbol" aria-hidden="true">⌖</span>${escape(event.location)}</p><div class="card-bottom"><span class="${enrolled ? 'registered-tag' : ''}">${registration ? `Inscrito el ${escape(date(registration.created_at))}` : enrolled ? '✓ Inscripción confirmada' : `${event.available} de ${event.capacity} ${event.capacity === 1 ? 'lugar' : 'lugares'}`}</span><button class="text-button" data-action="detail" data-id="${escape(event.id)}" aria-label="Ver detalles de ${escape(event.title)}">Ver detalles ↗</button></div></div></article>`;
}

function empty(title, description, action = '') {
  return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">✳</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${action}</div>`;
}

function renderAccount() {
  const user = state.user;
  $('#account-actions').innerHTML = user
    ? `${user.role === 'organizer' ? '<button class="button button-primary" data-action="publish">Publicar evento +</button>' : ''}<span class="account-name">${escape(user.name.split(' ')[0])}</span><button class="button button-subtle" data-action="logout">Salir</button>`
    : '<button class="button button-outline" data-action="login">Iniciar sesión</button><button class="button button-primary" data-action="register">Crear cuenta ↗</button>';
  const unread = state.notifications.filter(item => !item.read_at).length;
  $('#notification-count').textContent = unread; $('#notification-count').hidden = !unread;
}

function renderFilters() {
  $('#category-filters').innerHTML = ['', ...categories].map(category => `<button class="chip ${category === state.category ? 'active' : ''}" aria-pressed="${category === state.category}" data-action="filter" data-category="${escape(category)}">${escape(category || 'Todos los planes')}</button>`).join('');
}

async function refreshPersonal() {
  if (!state.user) { state.registrations = []; state.notifications = []; return; }
  const [registrations, notifications] = await Promise.all([api('/registrations'), api('/notifications')]);
  state.registrations = registrations.registrations; state.notifications = notifications.notifications;
}

async function renderView(append = false) {
  const request = ++state.request;
  const view = state.view;
  document.querySelectorAll('[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
    if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  $('#hero').hidden = view !== 'eventos'; $('#discovery-controls').hidden = view !== 'eventos'; $('#load-more-wrap').hidden = true;
  $('#results-count').textContent = '';
  const headings = { eventos:['UN BUEN PLAN ESTÁ CERCA', 'Descubre lo que viene'], inscripciones:['LOS PLANES QUE YA SON TUYOS', 'Mis inscripciones'], notificaciones:['NO TE PIERDAS NADA', 'Tus notificaciones'] };
  $('#view-eyebrow').textContent = headings[view][0]; $('#view-title').textContent = headings[view][1];
  if (!append) $('#content').innerHTML = '<div class="event-grid" aria-label="Cargando"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    if (view === 'eventos') {
      renderFilters();
      const params = new URLSearchParams({ q:state.query, category:state.category, offset:append ? state.events.length : 0 });
      const data = await api(`/events?${params}`);
      if (request !== state.request) return;
      state.events = append ? [...state.events, ...data.events] : data.events; state.total = data.total;
      $('#results-count').textContent = `${data.total} ${data.total === 1 ? 'evento' : 'eventos'}`;
      $('#content').innerHTML = state.events.length ? `<div class="event-grid">${state.events.map(event => card(event)).join('')}</div>` : empty('El próximo plan está por llegar', 'No encontramos eventos con esta búsqueda. Prueba otra palabra o categoría.', '<button class="button button-outline" data-action="clear">Ver todos los eventos</button>');
      $('#load-more-wrap').hidden = state.events.length >= state.total;
    } else if (!state.user) {
      $('#content').innerHTML = empty('Tus próximos planes te esperan', 'Inicia sesión para ver tus inscripciones y confirmaciones.', '<button class="button button-primary" data-action="login">Iniciar sesión</button>');
    } else {
      await refreshPersonal();
      if (request !== state.request) return;
      renderAccount();
      if (view === 'inscripciones') {
        $('#results-count').textContent = `${state.registrations.length} ${state.registrations.length === 1 ? 'inscripción' : 'inscripciones'}`;
        $('#content').innerHTML = state.registrations.length ? `<div class="event-grid">${state.registrations.map(item => card(item.event, item)).join('')}</div>` : empty('Tu primera historia empieza aquí', 'Explora los eventos y reserva tu lugar en el que más te guste.', '<a class="button button-primary" href="#eventos">Explorar eventos ↗</a>');
      } else {
        $('#content').innerHTML = state.notifications.length ? `<div class="notification-list">${state.notifications.map(item => `<article class="notification-item ${item.read_at ? '' : 'unread'}"><div><h3>${escape(item.message)}</h3><p>${escape(date(item.created_at))} · ${escape(time(item.created_at))}${item.read_at ? ' · Leída' : ' · Nueva'}</p></div>${item.read_at ? '' : `<button class="button button-outline" data-action="read" data-id="${escape(item.id)}">Marcar como leída ✓</button>`}</article>`).join('')}</div>` : empty('Todo al día', 'Las confirmaciones de tus inscripciones aparecerán aquí.');
      }
    }
  } catch (error) {
    if (request !== state.request) return;
    $('#content').innerHTML = empty('No pudimos cargar tus planes', error.message, '<button class="button button-outline" data-action="retry">Intentar de nuevo</button>');
  }
}

function showModal(title, content, eyebrow = '') {
  $('#modal-content').innerHTML = `<div class="modal-header"><div>${eyebrow ? `<p class="eyebrow">${escape(eyebrow)}</p>` : ''}<h2 id="modal-title">${escape(title)}</h2></div><button class="modal-close" data-action="close" aria-label="Cerrar ventana">×</button></div><div class="modal-body">${content}</div>`;
  if (!$('#modal').open) $('#modal').showModal();
}

function authModal(register = false) {
  showModal(register ? 'Encuentra tu lugar' : 'Qué bueno verte', `<p class="modal-intro">${register ? 'Crea tu cuenta y empieza a conectar con lo que pasa cerca de ti.' : 'Tus próximos planes están a un paso.'}</p><form id="auth-form" class="form-stack" data-mode="${register ? 'register' : 'login'}">${register ? '<label class="field">Tu nombre<input name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="¿Cómo te llamas?"></label>' : ''}<label class="field">Correo electrónico<input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="tu@correo.com"></label><label class="field">Contraseña<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required ${register ? 'minlength="8"' : ''} maxlength="128" placeholder="${register ? 'Al menos 8 caracteres' : 'Tu contraseña'}"></label>${register ? '<label class="field">Quiero usar Eventia para<select name="role"><option value="participant">Descubrir eventos e inscribirme</option><option value="organizer">Publicar eventos y participar</option></select></label>' : ''}<p class="form-error" id="form-error" role="alert" hidden></p><button class="button button-primary" type="submit">${register ? 'Crear mi cuenta ↗' : 'Iniciar sesión ↗'}</button></form><p class="form-switch">${register ? '¿Ya tienes cuenta?' : '¿Tu primera vez aquí?'} <button data-action="${register ? 'login' : 'register'}">${register ? 'Inicia sesión' : 'Crea una cuenta'}</button></p>`);
}

async function detailModal(id) {
  const { event } = await api(`/events/${encodeURIComponent(id)}`);
  const illustration = art(event.category);
  const enrolled = state.registrations.some(item => item.event_id === id);
  const closed = new Date(event.starts_at) <= new Date();
  showModal(event.title, `<div class="card-art detail-art ${illustration.style}">${illustration.svg}</div><dl class="detail-facts"><div><dt>CUÁNDO</dt><dd>${escape(date(event.starts_at))}<br>${escape(time(event.starts_at))} · Hora de Guatemala</dd></div><div><dt>DÓNDE</dt><dd>${escape(event.location)}</dd></div><div><dt>ORGANIZA</dt><dd>${escape(event.organizer_name)}</dd></div><div><dt>CATEGORÍA</dt><dd>${escape(event.category)}</dd></div></dl><p class="detail-description">${escape(event.description)}</p><div class="capacity-row"><span>${event.available} ${event.available === 1 ? 'lugar disponible' : 'lugares disponibles'}</span><span>${event.occupied} / ${event.capacity} inscritos</span></div><div class="capacity-track"><progress value="${event.occupied}" max="${event.capacity}" aria-label="Cupos ocupados"></progress></div><button class="button button-primary detail-button" data-action="enroll" data-id="${escape(event.id)}" ${enrolled || closed || !event.available ? 'disabled' : ''}>${enrolled ? '✓ Tu inscripción está confirmada' : closed ? 'Inscripciones cerradas' : !event.available ? 'Cupos agotados' : state.user ? 'Reservar mi lugar ↗' : 'Inicia sesión para inscribirte ↗'}</button><p class="detail-note">${enrolled ? 'Puedes consultar tu confirmación en Mis inscripciones.' : 'Un lugar por persona. La disponibilidad se confirma al inscribirte.'}</p>`, event.category.toUpperCase());
}

function publishModal() {
  showModal('Dale vida a un encuentro', `<p class="modal-intro">Comparte tu propuesta con la comunidad. Todos los eventos del MVP son gratuitos.</p><form id="publish-form" class="form-stack"><label class="field">Nombre del evento<input name="title" required minlength="4" maxlength="100" placeholder="Un nombre que invite a salir"></label><label class="field">Cuéntanos de qué se trata<textarea name="description" required minlength="20" maxlength="2000" placeholder="Qué haremos, para quién es y qué debemos llevar…"></textarea></label><label class="field">Lugar<input name="location" required minlength="3" maxlength="160" placeholder="Nombre del espacio y dirección"></label><div class="form-row"><label class="field">Fecha y hora<input name="starts_at" type="datetime-local" required><span class="field-hint">Hora de Guatemala (UTC-6)</span></label><label class="field">Cupos disponibles<input name="capacity" type="number" required min="1" max="10000" step="1" placeholder="30"></label></div><label class="field">Categoría<select name="category">${categories.map(category => `<option>${escape(category)}</option>`).join('')}</select></label><p class="form-error" id="form-error" role="alert" hidden></p><button class="button button-primary" type="submit">Publicar evento ↗</button></form>`);
  const local = new Date(Date.now() + 3600000 - 6 * 3600000).toISOString().slice(0,16);
  $('[name="starts_at"]').min = local;
}

async function busy(button, action) {
  if (button?.disabled) return;
  const label = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = 'Un momento…'; }
  try { await action(); }
  finally { if (button?.isConnected) { button.disabled = false; button.innerHTML = label; } }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  try {
    if (action === 'login' || action === 'register') return authModal(action === 'register');
    if (action === 'close') { $('#modal').close(); state.pendingEvent = null; return; }
    if (action === 'publish') return publishModal();
    if (action === 'filter') { state.category = button.dataset.category; return renderView(); }
    if (action === 'clear') { state.query = ''; state.category = ''; $('#search').value = ''; return renderView(); }
    if (action === 'retry') return renderView();
    if (action === 'more') return busy(button, () => renderView(true));
    if (action === 'detail') return await busy(button, () => detailModal(button.dataset.id));
    if (action === 'logout') return await busy(button, async () => { await post('/auth/logout'); state.user = null; await refreshPersonal(); renderAccount(); await renderView(); toast('Sesión cerrada. ¡Hasta pronto!'); });
    if (action === 'read') return await busy(button, async () => { await api(`/notifications/${button.dataset.id}/read`, { method:'PATCH', body:'{}' }); await renderView(); });
    if (action === 'enroll') {
      const id = button.dataset.id;
      if (!state.user) { state.pendingEvent = id; return authModal(); }
      return await busy(button, async () => {
        try {
          await post(`/events/${id}/registrations`);
          await refreshPersonal(); renderAccount();
          await renderView(); await detailModal(id);
          toast('¡Tu lugar está confirmado! Te enviamos una notificación en Eventia.');
        } catch (error) {
          if (['EVENT_FULL', 'ALREADY_REGISTERED', 'EVENT_CLOSED'].includes(error.code)) {
            await refreshPersonal(); renderAccount(); await renderView(); await detailModal(id);
          }
          throw error;
        }
      });
    }
  } catch (error) { toast(error.message, 'error'); }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['search-form','auth-form','publish-form'].includes(form.id)) return;
  event.preventDefault();
  if (form.id === 'search-form') { state.query = $('#search').value.trim(); return renderView(); }
  const data = Object.fromEntries(new FormData(form));
  await busy(form.querySelector('[type="submit"]'), async () => {
    $('#form-error').hidden = true;
    try {
      if (form.id === 'auth-form') {
        const result = await post(`/auth/${form.dataset.mode}`, data);
        state.user = result.user; await refreshPersonal(); renderAccount();
        $('#modal').close(); await renderView();
        toast(`¡Hola, ${state.user.name.split(' ')[0]}!`);
        if (state.pendingEvent) { const id = state.pendingEvent; state.pendingEvent = null; await detailModal(id); }
      } else {
        data.capacity = Number(data.capacity);
        // El formulario declara explícitamente la zona horaria de Guatemala.
        data.starts_at = new Date(`${data.starts_at}:00-06:00`).toISOString();
        const { event: published } = await post('/events', data);
        $('#modal').close(); state.query = ''; state.category = ''; $('#search').value = '';
        state.view = 'eventos';
        if (location.hash !== '#eventos') location.hash = '#eventos';
        await renderView(); await detailModal(published.id); toast('Tu evento ya está publicado. ¡Que empiece el encuentro!');
      }
    } catch (error) {
      const output = $('#form-error');
      if (output) { output.textContent = error.message; output.hidden = false; } else toast(error.message, 'error');
    }
  });
});

$('#modal').addEventListener('cancel', () => { state.pendingEvent = null; });
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const rect = $('#modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { $('#modal').close(); state.pendingEvent = null; } } });
let searchTimer;
$('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = $('#search').value.trim(); renderView(); }, 350); });
function changeView() {
  const value = location.hash.slice(1);
  if (!['eventos','inscripciones','notificaciones'].includes(value)) return;
  state.view = value; renderView();
}
window.addEventListener('hashchange', changeView);
try {
  const { user } = await api('/auth/me'); state.user = user; await refreshPersonal();
} catch (error) { toast(error.message, 'error'); }
renderAccount();
state.view = ['eventos','inscripciones','notificaciones'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'eventos';
await renderView();
