import * as UI from './ui.js';
import { OperationsMap } from './map.js';
const { $, $$, escape: E, icon: I, money, duration, toast, openModal, closeModal } = UI;
let state = null,
  selectedId = null,
  map = null,
  filter = 'all',
  view = location.hash.slice(1) || 'dispatch',
  offset = 0,
  loading = false,
  pending = false;
let pollTimer;
const serverNow = () => Date.now() + offset;
if (!UI.HEADINGS[view]) view = 'dispatch';
function connection(text, good = true) {
  $('#connection').textContent = text;
  $('#connection').classList.toggle('offline', !good);
}
async function api(
  path,
  data,
  { key = crypto.randomUUID().replaceAll('-', ''), retry = true } = {}
) {
  const options = {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  };
  if (data !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Idempotency-Key'] = key;
    if (state?.csrf) options.headers['X-CSRF-Token'] = state.csrf;
    options.body = JSON.stringify(data);
  }
  let response;
  try {
    response = await fetch('/api/' + path, options);
  } catch (error) {
    // A response can be lost after commit. One transport retry reuses the same key.
    if (retry && data !== undefined && !['session', 'logout', 'account'].includes(path)) {
      await new Promise((r) => setTimeout(r, 600));
      return api(path, data, { key, retry: false });
    }
    connection('Offline · reconnecting', false);
    throw new Error('Connection lost. Your last confirmed state is shown. Reconnect and refresh.');
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server did not return a valid game response.');
  }
  if (!response.ok) {
    const error = new Error(result.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  connection('Radio connected');
  return result;
}
function accept(next) {
  state = next;
  offset = next.serverTime - Date.now();
  render();
}
function selectedIncident() {
  return (
    state?.incidents.find((i) => i.id === selectedId) ||
    state?.history.find((p) => p.incident.id === selectedId && p.status === 'responding')?.incident
  );
}
function incidentList() {
  const list = state.incidents.filter(
    (i) =>
      filter === 'all' ||
      (filter === 'available' && state.catalog.progression.level >= i.minLevel) ||
      (filter === 'urgent' && i.severity === 3)
  );
  $('#incident-list').innerHTML = list.length
    ? list.map((i) => UI.incidentCard(i, state, serverNow(), i.id === selectedId)).join('')
    : UI.empty('No calls in this filter.', 'Try All calls or wait for the next radio update.');
}
function render(full = false) {
  if (!state) return;
  const t = serverNow();
  UI.renderMetrics(state, t);
  $('#sidebar-department').textContent = state.organization.name;
  $('#sidebar-rank').textContent =
    `LEVEL ${state.catalog.progression.level} · ${state.catalog.progression.title}`;
  $('#call-count').textContent = state.incidents.length;
  const heading = UI.HEADINGS[view];
  $('#page-eyebrow').textContent = heading[0];
  $('#page-title').textContent = heading[1];
  $('#page-subtitle').textContent = heading[2];
  $('#breadcrumb').textContent = view === 'dispatch' ? 'LIVE DISPATCH' : view.toUpperCase();
  $$('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === view);
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (view === 'dispatch') {
    if (!$('#operations-map') || full) {
      map?.destroy();
      $('#view').innerHTML = UI.dispatchLayout(state, t, selectedId);
      map = new OperationsMap($('#operations-map'), selectIncident);
      $('#map-plus').onclick = () => map.zoomBy(1.25);
      $('#map-minus').onclick = () => map.zoomBy(0.8);
      $('#map-reset').onclick = () => map.reset();
    }
    if (selectedId && !selectedIncident()) selectedId = null;
    incidentList();
    $('#incident-detail').innerHTML = UI.detailPanel(selectedIncident(), state, t);
    $('#active-responses').innerHTML = UI.activeResponses(state, t);
    $$('.filter').forEach((b) => {
      b.classList.toggle('active', b.dataset.filter === filter);
      b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
    });
    $('.incident-feed .count').textContent = state.incidents.length;
    $('.active-response-section .count').textContent = state.history.filter(
      (p) => p.status === 'responding'
    ).length;
    map.update(state, selectedId);
  } else {
    map?.destroy();
    map = null;
    const builders = {
      department: UI.departmentView,
      volunteers: UI.volunteersView,
      fleet: UI.fleetView,
      finances: UI.financesView,
      history: UI.historyView
    };
    $('#view').innerHTML = builders[view](state, t);
  }
}
function selectIncident(id) {
  selectedId = id;
  render();
}
async function refresh(manual = false) {
  if (loading || pending) return;
  loading = true;
  try {
    accept(await api('state'));
    if (manual) toast('Radio updated. Department state synchronized.');
  } catch (error) {
    if (error.status === 401) {
      connection('Session required', false);
      if (!$('#modal').open) welcome();
    } else {
      connection('Connection interrupted', false);
      if (manual) toast(error.message, true);
    }
  } finally {
    loading = false;
  }
}
async function action(path, data, message) {
  if (pending) return;
  pending = true;
  const enabledButtons = $$('#modal button').filter((b) => !b.disabled);
  enabledButtons.forEach((b) => (b.disabled = true));
  try {
    const next = await api(path, data);
    closeModal();
    accept(next);
    toast(message);
    return true;
  } catch (error) {
    enabledButtons.forEach((b) => (b.disabled = false));
    toast(error.message, true);
    if (error.status === 401) welcome();
    else if (error.status === 409) {
      closeModal();
      pending = false;
      await refresh();
    } else {
      const submit = $('#modal button[type="submit"]');
      if (submit) submit.disabled = false;
      const close = $('#modal [data-close]');
      if (close) close.disabled = false;
    }
    return false;
  } finally {
    pending = false;
    if (!$('#modal').open) render();
  }
}
const PIN_ATTRS =
  'name="pin" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required';
function authFields(mode) {
  const user =
    '<label>Username<input name="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>';
  const pass = (label, auto, name = 'password') =>
    `<label>${label}<input type="password" name="${name}" minlength="8" maxlength="128" autocomplete="${auto}" required></label>`;
  if (mode === 'login') return user + pass('Password', 'current-password');
  if (mode === 'pin')
    return `${user}<label>6-digit recovery PIN<input ${PIN_ATTRS}></label>${pass('New password', 'new-password')}<p class="muted">Your PIN proves it is you and lets you set a new password. It signs out your previous session.</p>`;
  return `<label>Your chief’s name<input name="name" minlength="2" maxlength="40" autocomplete="nickname" value="Chief Reyes" required></label><label>Department name<input name="department" minlength="2" maxlength="40" value="Pasig River Volunteer Fire Brigade" required></label>${user}${pass('Password (8+ characters)', 'new-password')}<label>6-digit recovery PIN<input ${PIN_ATTRS}></label><p class="muted">Remember your PIN: it is the only way back in if you forget your password. 6 volunteers · 1 engine · ${money(12500)} founding grant.</p>`;
}
const AUTH_LABEL = {
  login: 'Sign in',
  new: 'Take command',
  pin: 'Reset password'
};
function welcome() {
  openModal(
    'Welcome to the watch.',
    `<div class="onboarding-intro"><img src="/public/assets/images/department.svg" alt="Fireline insignia"><p>Build a volunteer department. Answer the calls that matter. Bring everyone home.</p></div><div class="tabs"><button class="filter active" data-account-tab="login" type="button">Sign in</button><button class="filter" data-account-tab="new" type="button">New department</button><button class="filter" data-account-tab="pin" type="button">Forgot password</button></div><form id="session-form" class="form-stack"><div id="account-fields">${authFields('login')}</div><p class="form-error" id="session-error" role="alert"></p><button class="button primary full" type="submit" id="session-submit">Sign in</button><p class="fine-print">Progress is saved server-side. No email or payment required. This is a fictional management game, not firefighting training.</p></form>`
  );
  $('#modal').dataset.required = 'true';
  $('[data-close]', $('#modal')).hidden = true;
  let mode = 'login';
  const setMode = (next) => {
    mode = next;
    $$('[data-account-tab]').forEach((x) =>
      x.classList.toggle('active', x.dataset.accountTab === mode)
    );
    $('#account-fields').innerHTML = authFields(mode);
    $('#session-submit').innerHTML =
      mode === 'new' ? AUTH_LABEL.new + ' ' + I('arrow') : AUTH_LABEL[mode];
    $('#session-error').textContent = '';
  };
  $$('[data-account-tab]').forEach((b) => (b.onclick = () => setMode(b.dataset.accountTab)));
  $('#session-form').onsubmit = async (e) => {
    e.preventDefault();
    const submit = $('#session-submit');
    submit.disabled = true;
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      data =
        mode === 'login'
          ? { action: 'login', username: f.username, password: f.password }
          : mode === 'pin'
            ? { action: 'recover', username: f.username, pin: f.pin, password: f.password }
            : {
                  action: 'register',
                  name: f.name,
                  department: f.department,
                  username: f.username,
                  password: f.password,
                  pin: f.pin
                };
    try {
      const next = await api('session', data, { retry: false });
      delete $('#modal').dataset.required;
      closeModal();
      accept(next);
      toast(
        mode === 'new'
          ? 'Department founded. Keep your PIN somewhere safe.'
          : mode === 'pin'
            ? 'Password reset. Welcome back, Chief.'
            : 'Welcome back, Chief. Your department is ready.'
      );
    } catch (error) {
      $('#session-error').textContent = error.message;
      submit.disabled = false;
    }
  };
}
function guide() {
  openModal(
    'The chief’s field guide',
    `<div class="modal-body guide"><p class="lede">The best department is the one that shows up prepared.</p><section><h3>01 / Read the district</h3><p>New calls appear every two minutes and remain available for six minutes. Select a marker or a feed card. Ignoring a call has no cost, attendance penalty, or permanent incident record.</p></section><section><h3>02 / Commit a crew</h3><p>Plan a response, select a suitable apparatus and the required available volunteers, then confirm the operating cost. That confirmation creates your response and attendance record. One vehicle responds to each call.</p></section><section><h3>03 / Bring the unit home</h3><p>Responses last roughly one to three minutes, including accelerated travel time. Crews and apparatus return automatically. Successful service earns the full grant and XP. A contained result earns 60% of the grant and 70% XP, with a small trust reduction. Higher crew skills improve success probability.</p></section><section><h3>04 / Build the department</h3><p>Recruit for ${money(650)}, train skills over 60 seconds, acquire apparatus, and expand your station. Training adds a skill point but takes the volunteer off duty for its full duration. Chief levels unlock new incidents, units, and expansion. Capital spending must leave ₱400 available as a response reserve; actual responses can use it.</p></section><section><h3>05 / Protect your progress</h3><p>Remember your username, password and recovery PIN. Your session is stored in a secure HttpOnly cookie and lasts up to 180 days. Leaving the game causes no passive expenses. Due responses settle the next time you connect.</p></section><p class="fine-print">The map uses real coordinates with a generalized Metro Manila outline, schematic rivers, and generalized road corridors. Dispatch travel is straight-line distance at 12× simulation speed, not road navigation. All operational events are fictional.</p></div>`,
    true
  );
}
function settings() {
  if (!state) return welcome();
  const pwd = (label, name, auto) =>
    `<label>${label}<input type="password" name="${name}" minlength="8" maxlength="128" autocomplete="${auto}" required></label>`;
  openModal(
    'Account & recovery',
    `<div class="modal-body form-stack"><h3>${E(state.player.name)}</h3><p class="muted">${E(state.organization.name)}<br>Signed in as @${E(state.player.username)}<br>Department ID: ${E(state.player.id)}</p><div class="divider"></div><form id="password-form" class="form-stack">${pwd('Current password', 'currentPassword', 'current-password')}${pwd('New password', 'password', 'new-password')}<button class="button secondary" type="submit">Change password</button></form><form id="pin-form" class="form-stack">${pwd('Current password', 'currentPassword', 'current-password')}<label>New 6-digit recovery PIN<input ${PIN_ATTRS}></label><button class="button secondary" type="submit">Change recovery PIN</button></form><p class="form-error" id="account-error" role="alert"></p><div class="divider"></div><button class="button secondary" id="account-guide">Read the chief’s field guide</button><div class="divider"></div><button class="button danger full" id="logout">Sign out of command</button></div>`
  );
  $('#account-guide').onclick = guide;
  const bind = (id, action, done) => {
    const form = $(id);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      $('#account-error').textContent = '';
      try {
        accept(
          await api('account', { action, ...Object.fromEntries(new FormData(form)) }, { retry: false })
        );
        toast(done);
        closeModal();
      } catch (error) {
        $('#account-error').textContent = error.message;
        button.disabled = false;
      }
    };
  };
  bind('#password-form', 'change-password', 'Password changed.');
  bind('#pin-form', 'change-pin', 'Recovery PIN changed.');
  $('#logout').onclick = () => {
    openModal(
      'Before you leave the station',
      `<div class="modal-body"><p class="notice">Sign back in with your username and password. If you forget the password, use your 6-digit PIN. Signing out revokes this browser’s session.</p><div class="button-row"><button class="button secondary" id="cancel-logout">Stay signed in</button><button class="button danger" id="confirm-logout">Sign out</button></div></div>`
    );
    $('#cancel-logout').onclick = closeModal;
    $('#confirm-logout').onclick = async () => {
      try {
        await api('logout', {});
        state = null;
        map?.destroy();
        map = null;
        $('#view').innerHTML = UI.empty(
          'Off duty.',
          'Sign in or create a new department to return to command.'
        );
        welcome();
      } catch (error) {
        toast(error.message, true);
      }
    };
  };
}
function estimate(incident, vehicle, crew) {
  const spec = state.catalog.vehicles[vehicle.type],
    rad = (x) => (x * Math.PI) / 180,
    org = state.organization;
  const h =
      Math.sin(rad(incident.lat - org.lat) / 2) ** 2 +
      Math.cos(rad(org.lat)) *
        Math.cos(rad(incident.lat)) *
        Math.sin(rad(incident.lon - org.lon) / 2) ** 2,
    km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const skill = crew.length ? crew.reduce((a, v) => a + v.skill, 0) / crew.length : 0;
  return {
    cost: spec.cost + incident.severity * 25 + Math.ceil(km * 4),
    duration: incident.duration + Math.round(((km / spec.speed) * 3600000) / 12),
    chance: Math.round(
      Math.min(
        0.98,
        0.74 +
          skill * 0.045 -
          (incident.severity - 1) * 0.045 +
          (spec.fit?.[incident.key] ?? 0) +
          (incident.water ? Math.min(0.12, spec.liters / 100000) : 0)
      ) * 100
    )
  };
}
function planDispatch(id) {
  const incident = state.incidents.find((i) => i.id === id);
  if (!incident) return toast('This incident has already cleared.', true);
  const ready = state.vehicles.filter(
      (v) =>
        incident.types.includes(state.catalog.vehicles[v.type]?.kind) && v.busy_until <= serverNow()
    ),
    crew = state.volunteers.filter((v) => v.busy_until <= serverNow());
  openModal(
    'Commit to the call',
    `<form id="dispatch-form" class="modal-body form-stack"><div class="dispatch-call"><span class="incident-tag category-${incident.category.toLowerCase()}">${E(incident.category)}</span><h3>${E(incident.name)}</h3><p class="muted">${E(incident.location)}</p></div><label>Responding apparatus<select name="vehicleId" id="dispatch-vehicle" ${ready.length ? '' : 'disabled'}>${ready.length ? ready.map((v) => `<option value="${v.id}">${E(v.name)} · ${E(state.catalog.vehicles[v.type].name)} · ${state.catalog.vehicles[v.type].crew} seats</option>`).join('') : '<option>No suitable apparatus available</option>'}</select></label><fieldset><legend>Select your crew <span>(${incident.crew} required)</span></legend><div class="crew-picker">${
      crew
        .map(
          (v, index) =>
            `<label class="crew-option"><input type="checkbox" name="crewIds" value="${v.id}" ${index < incident.crew ? 'checked' : ''}><span class="small-avatar">${E(
              v.name
                .split(' ')
                .map((p) => p[0])
                .join('')
            )}</span><span><strong>${E(v.name)}</strong><small>${E(v.role)} · Skill ${v.skill}</small></span></label>`
        )
        .join('') || '<p class="muted">All volunteers are currently responding or training.</p>'
    }</div></fieldset><div class="dispatch-estimate" id="dispatch-estimate"></div><p class="notice">Confirming records this attendance and charges only this response. The server validates crew availability, suitability, costs, and rewards.</p><p class="form-error" id="dispatch-error" role="alert"></p><button type="submit" class="button primary full" id="dispatch-submit">Dispatch crew</button></form>`
  );
  const form = $('#dispatch-form');
  function update() {
    const ids = $$('input[name="crewIds"]:checked', form).map((i) => i.value),
      vehicle = ready.find((v) => v.id === $('#dispatch-vehicle').value),
      selected = crew.filter((v) => ids.includes(v.id)),
      preview = vehicle ? estimate(incident, vehicle, selected) : null;
    const valid =
      vehicle &&
      ids.length >= incident.crew &&
      ids.length <= state.catalog.vehicles[vehicle.type].crew &&
      preview.cost <= state.player.balance &&
      incident.expiresAt > serverNow();
    $('#dispatch-submit').disabled = !valid;
    $('#dispatch-estimate').innerHTML = preview
      ? `<div><small>OPERATING COST</small><strong>${money(preview.cost)}</strong></div><div><small>EST. RESPONSE</small><strong>${duration(preview.duration)}</strong></div><div><small>SUCCESS CHANCE</small><strong>${preview.chance}%</strong></div>`
      : '<p>No compatible available apparatus.</p>';
    $('#dispatch-submit').innerHTML = preview
      ? `Dispatch crew · ${money(preview.cost)} ${I('arrow')}`
      : 'No available unit';
    $('#dispatch-error').textContent = !vehicle
      ? 'Wait for a compatible apparatus to return.'
      : ids.length < incident.crew
        ? `Select at least ${incident.crew} volunteers.`
        : ids.length > state.catalog.vehicles[vehicle.type].crew
          ? 'The selected crew exceeds vehicle capacity.'
          : preview.cost > state.player.balance
            ? 'Insufficient operating funds.'
            : incident.expiresAt <= serverNow()
              ? 'This incident has cleared. Close this dialog and refresh.'
              : '';
  }
  form.onchange = update;
  update();
  form.onsubmit = (e) => {
    e.preventDefault();
    if ($('#dispatch-submit').disabled) return;
    const data = new FormData(form);
    action(
      'dispatch',
      {
        incidentId: incident.id,
        vehicleId: data.get('vehicleId'),
        crewIds: data.getAll('crewIds')
      },
      'Crew dispatched. Attendance recorded. Stay safe out there.'
    );
  };
}
function confirmOrg(data, title, description, label) {
  openModal(
    title,
    `<div class="modal-body"><p class="muted">${E(description)}</p><p class="fine-print">This one-time game-currency transaction must leave a ₱400 response reserve. All costs are validated on the server.</p><button class="button primary full" id="confirm-org">${E(label)}</button></div>`
  );
  $('#confirm-org').onclick = () => action('organization', data, 'Department updated.');
}
$('#view').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled || !state || pending) return;
  if (b.dataset.incident) selectIncident(b.dataset.incident);
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    render();
  }
  if (b.dataset.dispatch) planDispatch(b.dataset.dispatch);
  if (b.dataset.orgAction === 'recruit')
    confirmOrg(
      { action: 'recruit' },
      'Welcome another volunteer',
      `Recruit an available skill-1 firefighter for ${money(state.catalog.recruitCost)}. A roster position is required.`,
      `Recruit · ${money(state.catalog.recruitCost)}`
    );
  if (b.dataset.orgAction === 'upgrade')
    confirmOrg(
      { action: 'upgrade' },
      'Make room to respond',
      `Expand to station tier ${state.organization.station_level + 1} for ${money(state.catalog.stationUpgradeCost)}. Gain one apparatus bay and two roster positions.`,
      `Expand station · ${money(state.catalog.stationUpgradeCost)}`
    );
  if (b.dataset.purchase) {
    const v = state.catalog.vehicles[b.dataset.purchase];
    confirmOrg(
      { action: 'purchase', type: b.dataset.purchase },
      'Acquire new apparatus',
      `Purchase a ${v.name} for ${money(v.price)}. It is immediately available and occupies one apparatus bay.`,
      `Acquire · ${money(v.price)}`
    );
  }
  if (b.dataset.train) {
    const v = state.volunteers.find((v) => v.id === b.dataset.train);
    confirmOrg(
      { action: 'train', volunteerId: v.id },
      `Invest in ${v.name.split(' ')[0]}`,
      `Add one skill point for ${money(350 * v.skill)}. This volunteer will be unavailable for 60 seconds.`,
      `Begin training · ${money(350 * v.skill)}`
    );
  }
  if (b.hasAttribute('data-rename')) {
    openModal(
      'A name worth serving',
      `<form id="rename-form" class="modal-body form-stack"><label>Department name<input name="name" minlength="2" maxlength="40" value="${E(state.organization.name)}" required></label><button type="submit" class="button primary full">Save department name</button></form>`
    );
    $('#rename-form').onsubmit = (e) => {
      e.preventDefault();
      action(
        'organization',
        { action: 'rename', name: new FormData(e.currentTarget).get('name') },
        'Department name updated.'
      );
    };
  }
});
window.addEventListener('hashchange', () => {
  view = UI.HEADINGS[location.hash.slice(1)] ? location.hash.slice(1) : 'dispatch';
  render(true);
});
$('#guide-button').onclick = guide;
$('#settings-button').onclick = settings;
$('#account-shortcut').onclick = settings;
$('#refresh-button').onclick = () => refresh(true);
$('#modal').addEventListener('cancel', (e) => {
  if ($('#modal').dataset.required || pending) e.preventDefault();
});
function tick() {
  const t = serverNow();
  $('#clock').textContent = new Date(t).toLocaleTimeString('en-US', { hour12: false });
  $$('[data-due]').forEach((e) => (e.textContent = duration(Number(e.dataset.due) - t)));
  $$('[data-expires]').forEach((e) => (e.textContent = duration(Number(e.dataset.expires) - t)));
}
setInterval(tick, 1000);
tick();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state) refresh();
});
window.addEventListener('online', () => {
  if (state) refresh();
});
async function start() {
  try {
    accept(await api('state'));
  } catch (error) {
    if (error.status === 401) welcome();
    else {
      connection('Station unavailable', false);
      $('#view').innerHTML =
        `<div class="panel padded">${UI.empty('The station is not connected.', error.message, 'alert')}<button class="button secondary" id="retry-connect">Reconnect</button></div>`;
      $('#retry-connect').onclick = start;
    }
  }
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (state && !document.hidden && !$('#modal').open) refresh();
  }, 8000);
}
start();
