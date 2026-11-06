export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export const icon = (name, cls = '') =>
  `<img class="icon ${cls}" src="/public/assets/icons/${name}.svg" alt="">`;
// Procedurally drawn apparatus art: one inline SVG per vehicle, shaped by its kind and size.
const PAINT = {
  engine: ['#e8503f', '#8d2a2f'],
  tanker: ['#df4b39', '#7b2a2d'],
  brush: ['#f0913a', '#a1462a'],
  rescue: ['#d6443a', '#6e2428'],
  ambulance: ['#fdfdf8', '#bcc7cb'],
  aerial: ['#e5423a', '#842630']
};
const GROUND = 140;
const wheel = (cx, r = 17) =>
  `<circle cx="${cx}" cy="${GROUND - r}" r="${r}" fill="#10151a"/><circle cx="${cx}" cy="${GROUND - r}" r="${r - 5}" fill="#2b343c" stroke="#566069" stroke-width="2"/><circle cx="${cx}" cy="${GROUND - r}" r="${Math.round(r / 3)}" fill="#b4bcbd"/>`;
const lights = (x, y, w, a = '#ff4a3d', b = '#3d8bff') =>
  `<ellipse cx="${x + w / 2}" cy="${y + 2}" rx="${w * 0.8}" ry="9" fill="${a}" opacity=".18"/><rect x="${x}" y="${y}" width="${w}" height="6" rx="2.5" fill="#20272d"/><rect x="${x + 2}" y="${y + 1}" width="${w / 2 - 3}" height="4" rx="2" fill="${a}"/><rect x="${x + w / 2 + 1}" y="${y + 1}" width="${w / 2 - 3}" height="4" rx="2" fill="${b}"/>`;
function cab(x, w, top, paint) {
  const f = x + w;
  return `<path d="M${x} 118V${top + 8}Q${x} ${top} ${x + 8} ${top}H${f - 30}L${f - 8} ${top + 30}L${f} ${top + 34}V118Z" fill="${paint}" stroke="#241a1d" stroke-width="2"/><path d="M${x + 8} ${top + 8}H${f - 33}L${f - 14} ${top + 30}H${x + 8}Z" fill="url(#glass)" stroke="#9fb8bb" stroke-width="1.5"/><path d="M${x + w * 0.46} ${top + 8}V118" stroke="#00000055" stroke-width="2"/><rect x="${x + w * 0.5}" y="${top + 42}" width="9" height="3" rx="1.5" fill="#d9d3c3"/><rect x="${f - 7}" y="${top + 40}" width="9" height="11" rx="3" fill="#fff0b8"/><rect x="${f - 4}" y="106" width="9" height="14" rx="2" fill="#aeb7b8"/>`;
}
const shutters = (x, y, w, h, n) =>
  Array.from({ length: n }, (_, i) => {
    const sw = (w - (n + 1) * 5) / n,
      sx = x + 5 + i * (sw + 5);
    return `<rect x="${sx}" y="${y}" width="${sw}" height="${h}" rx="2" fill="#6a757e" stroke="#c4c9c0" stroke-width="1"/>${[1, 2, 3, 4]
      .map((k) => `<path d="M${sx + 2} ${y + (k * h) / 5}H${sx + sw - 2}" stroke="#c4c9c0" stroke-opacity=".6"/>`)
      .join('')}`;
  }).join('');
const ladderRack = (x1, x2, y) =>
  `<path d="M${x1} ${y}H${x2}M${x1} ${y - 6}H${x2}" stroke="#cdd2cb" stroke-width="2"/>${Array.from(
    { length: Math.floor((x2 - x1) / 9) },
    (_, i) => `<path d="M${x1 + 4 + i * 9} ${y - 6}V${y}" stroke="#cdd2cb"/>`
  ).join('')}`;
const num = (n) => Number(n).toLocaleString('en-US');
const BUILD = {
  engine(s, p) {
    const L = s.liters <= 1500 ? 236 : s.liters >= 4500 ? 332 : 300,
      x0 = (360 - L) / 2,
      cx = x0 + L - 76,
      top = s.liters <= 1500 ? 62 : 50,
      n = s.liters <= 1500 ? 2 : s.liters >= 4500 ? 4 : 3,
      rear = x0 + (s.liters <= 1500 ? 46 : s.liters >= 4500 ? 92 : 62) + 18,
      plaque = Math.round((rear + cx + 23) / 2);
    return `<rect x="${x0}" y="${top}" width="${cx - x0 + 6}" height="${118 - top}" rx="5" fill="${p}" stroke="#241a1d" stroke-width="2"/>${shutters(x0 + 4, top + 10, cx - x0 - 4, 88 - top - 16, n)}<rect x="${x0}" y="92" width="${L}" height="7" fill="#f2e5be"/><rect x="${x0}" y="99" width="${L}" height="2" fill="#b98b2e"/>${ladderRack(x0 + 6, cx - 2, top - 5)}<rect x="${plaque - 24}" y="103" width="48" height="13" rx="3" fill="#00000066"/><text x="${plaque}" y="113" fill="#fff1d7" font-family="sans-serif" font-size="9" font-weight="700" text-anchor="middle">${num(s.liters)} L</text>${cab(cx, 76, top + 4 > 56 ? 56 : top + 4, p)}${lights(cx + 20, (top + 4 > 56 ? 56 : top + 4) - 9, 30)}<rect x="${x0 - 4}" y="113" width="${L + 6}" height="9" rx="3" fill="#9aa4a1"/>${s.liters >= 4500 ? wheel(x0 + 52) + wheel(x0 + 92) : wheel(x0 + (s.liters <= 1500 ? 46 : 62))}${wheel(cx + 40)}`;
  },
  tanker(s, p) {
    const L = s.liters <= 4500 ? 276 : s.liters <= 7000 ? 316 : 344,
      x0 = (360 - L) / 2,
      cx = x0 + L - 72;
    return `<rect x="${x0 - 2}" y="110" width="${L + 4}" height="11" rx="3" fill="#586269"/><rect x="${x0 + 4}" y="42" width="${cx - x0 - 2}" height="70" rx="32" fill="${p}" stroke="#241a1d" stroke-width="2"/><rect x="${x0 + 22}" y="48" width="${cx - x0 - 40}" height="9" rx="4.5" fill="#fff" opacity=".28"/>${[0.26, 0.5, 0.74].map((t) => `<path d="M${x0 + 4 + (cx - x0) * t} 44V110" stroke="#00000044" stroke-width="2"/>`).join('')}<rect x="${x0 + 40}" y="35" width="26" height="9" rx="4" fill="#9aa4a1" stroke="#241a1d"/><rect x="${cx - 60}" y="35" width="26" height="9" rx="4" fill="#9aa4a1" stroke="#241a1d"/><rect x="${x0 + 4}" y="86" width="${cx - x0 - 2}" height="6" fill="#f2e5be" opacity=".92"/><text x="${x0 + (cx - x0) / 2 + 2}" y="78" fill="#fff1d7" font-family="sans-serif" font-size="17" font-weight="800" text-anchor="middle">${num(s.liters)} L</text><rect x="${x0 - 6}" y="96" width="10" height="16" rx="2" fill="#aeb7b8"/>${cab(cx, 72, 58, p)}${lights(cx + 18, 49, 28)}${wheel(x0 + 44) + wheel(x0 + 84)}${wheel(cx + 38)}`;
  },
  brush(s, p) {
    const hv = s.liters >= 1500,
      L = hv ? 262 : 214,
      x0 = (360 - L) / 2,
      cw = hv ? 78 : 64,
      cx = x0 + L - cw;
    return `<rect x="${x0}" y="98" width="${cx - x0 + 6}" height="14" rx="3" fill="#39424a"/><rect x="${x0 + 12}" y="${hv ? 60 : 68}" width="${cx - x0 - 46}" height="${hv ? 40 : 32}" rx="14" fill="${p}" stroke="#241a1d" stroke-width="2"/><rect x="${x0 + 22}" y="${hv ? 66 : 73}" width="${cx - x0 - 66}" height="6" rx="3" fill="#fff" opacity=".3"/><circle cx="${cx - 22}" cy="${hv ? 82 : 84}" r="12" fill="none" stroke="#d6c88e" stroke-width="4"/><circle cx="${cx - 22}" cy="${hv ? 82 : 84}" r="5" fill="#d6c88e"/><rect x="${x0 + 4}" y="86" width="14" height="22" rx="3" fill="#6a757e" stroke="#c4c9c0"/><path d="M${cx - 6} 66V${hv ? 52 : 58}H${x0 + 6}" fill="none" stroke="#2b3138" stroke-width="3"/>${cab(cx, cw, hv ? 56 : 64, p)}${lights(cx + 12, (hv ? 56 : 64) - 9, 26)}<path d="M${cx + cw + 2} 98V118" stroke="#2b3138" stroke-width="4"/>${wheel(x0 + 38, 18)}${wheel(cx + cw - 30, 18)}`;
  },
  rescue(s, p) {
    const big = s.crew >= 3,
      L = big ? 312 : 240,
      x0 = (360 - L) / 2,
      cx = x0 + L - 70;
    return `<rect x="${x0}" y="36" width="${cx - x0 + 6}" height="82" rx="6" fill="${p}" stroke="#241a1d" stroke-width="2"/>${shutters(x0 + 30, 46, cx - x0 - 30, 28, big ? 3 : 2)}${shutters(x0 + 30, 78, cx - x0 - 30, 18, big ? 3 : 2)}<rect x="${x0 + 2}" y="38" width="24" height="78" fill="#f2c230"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${x0 + 2} ${46 + i * 13}L${x0 + 26} ${36 + i * 13}" stroke="#7a1f24" stroke-width="5"/>`).join('')}<rect x="${x0}" y="100" width="${L}" height="6" fill="#f2e5be"/>${big ? `<path d="M${x0 + 90} 36V12M${x0 + 80} 12H${x0 + 118}" stroke="#2b3138" stroke-width="3"/><rect x="${x0 + 76}" y="8" width="16" height="7" rx="2" fill="#fff6c8"/><rect x="${x0 + 106}" y="8" width="16" height="7" rx="2" fill="#fff6c8"/><path d="M${cx - 30} 36L${cx - 76} 18L${cx - 90} 20" fill="none" stroke="#cdd2cb" stroke-width="4"/>` : ''}${cab(cx, 70, 58, p)}${lights(cx + 16, 49, 28, '#ffb23d', '#ff4a3d')}<rect x="${x0 - 4}" y="113" width="${L + 6}" height="9" rx="3" fill="#9aa4a1"/>${wheel(x0 + 60)}${wheel(cx + 38)}`;
  },
  ambulance(s, p) {
    const als = s.crew >= 3,
      L = als ? 268 : 248,
      x0 = (360 - L) / 2,
      cx = x0 + L - 72,
      mid = x0 + (cx - x0) / 2;
    return `<rect x="${x0}" y="42" width="${cx - x0 + 6}" height="76" rx="9" fill="${p}" stroke="#2a3238" stroke-width="2"/><rect x="${x0}" y="86" width="${L}" height="9" fill="#e5483a"/><rect x="${x0}" y="95" width="${L}" height="2.5" fill="#f5a623"/><text x="${mid + 6}" y="93.5" fill="#fff" font-family="sans-serif" font-size="7.5" font-weight="800" letter-spacing="2" text-anchor="middle">${als ? 'ALS · PARAMEDIC' : 'AMBULANCE'}</text><rect x="${mid - 3}" y="52" width="6" height="22" fill="#dc3b2e"/><rect x="${mid - 11}" y="60" width="22" height="6" fill="#dc3b2e"/><path d="M${x0 + 34} 44V84" stroke="#9aa6aa" stroke-width="2"/><rect x="${x0 + 8}" y="52" width="18" height="16" rx="3" fill="#2a3d46"/><rect x="${x0 - 3}" y="100" width="7" height="12" rx="2" fill="#dc3b2e"/>${cab(cx, 72, 56, p)}${lights(cx + 12, 47, 34, '#ff3d3d', '#3d8bff')}${als ? lights(x0 + 24, 33, 30, '#ff3d3d', '#3d8bff') : ''}<rect x="${x0 - 4}" y="113" width="${L + 6}" height="8" rx="3" fill="#aab4b8"/>${wheel(x0 + 52)}${wheel(cx + 38)}`;
  },
  aerial(s, p) {
    const plat = s.crew >= 4,
      L = plat ? 336 : 318,
      x0 = (360 - L) / 2,
      cx = x0 + L - 76,
      bx = x0 + 46,
      by = 62;
    const tip = [x0 + L - 6, plat ? 16 : 22];
    let boom;
    if (plat) {
      const mid = [x0 + 168, 26];
      boom = `<path d="M${bx} ${by}L${mid[0]} ${mid[1]}L${tip[0] - 14} ${tip[1] + 4}" fill="none" stroke="#2b3138" stroke-width="9" stroke-linejoin="round"/><path d="M${bx} ${by}L${mid[0]} ${mid[1]}L${tip[0] - 14} ${tip[1] + 4}" fill="none" stroke="#d4d9d6" stroke-width="5" stroke-linejoin="round"/><circle cx="${mid[0]}" cy="${mid[1]}" r="6" fill="#8d979b" stroke="#2b3138" stroke-width="2"/><rect x="${tip[0] - 30}" y="${tip[1] + 2}" width="34" height="16" rx="2" fill="#6a757e" stroke="#241a1d" stroke-width="2"/><path d="M${tip[0] - 30} ${tip[1] + 2}V${tip[1] - 8}H${tip[0] + 4}V${tip[1] + 2}" fill="none" stroke="#cdd2cb" stroke-width="2.5"/>`;
    } else {
      const n = 15,
        rungs = Array.from({ length: n }, (_, i) => {
          const t = (i + 0.5) / n,
            x = bx + (tip[0] - bx) * t,
            y = by + (tip[1] - by) * t;
          return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}V${(y + 7).toFixed(1)}" stroke="#cdd2cb" stroke-width="1.5"/>`;
        }).join('');
      boom = `<path d="M${bx} ${by}L${tip[0]} ${tip[1]}M${bx} ${by + 7}L${tip[0]} ${tip[1] + 7}" stroke="#2b3138" stroke-width="4.5" stroke-linecap="round"/><path d="M${bx} ${by}L${tip[0]} ${tip[1]}M${bx} ${by + 7}L${tip[0]} ${tip[1] + 7}" stroke="#d4d9d6" stroke-width="2.5" stroke-linecap="round"/>${rungs}`;
    }
    return `<path d="M${x0 + 34} 110L${x0 + 12} ${GROUND - 2}M${x0 + 108} 110L${x0 + 128} ${GROUND - 2}" stroke="#4d575e" stroke-width="5"/><rect x="${x0 + 3}" y="${GROUND - 4}" width="20" height="4" rx="1.5" fill="#b4bcbd"/><rect x="${x0 + 118}" y="${GROUND - 4}" width="20" height="4" rx="1.5" fill="#b4bcbd"/><rect x="${x0}" y="70" width="${cx - x0 + 6}" height="48" rx="5" fill="${p}" stroke="#241a1d" stroke-width="2"/>${shutters(x0 + 4, 78, cx - x0 - 4, 24, plat ? 4 : 3)}<rect x="${x0}" y="104" width="${L}" height="6" fill="#f2e5be"/><rect x="${bx - 14}" y="${by}" width="30" height="10" rx="3" fill="#59636a" stroke="#241a1d" stroke-width="1.5"/>${boom}${cab(cx, 76, 52, p)}${lights(cx + 20, 43, 30)}<rect x="${x0 - 4}" y="113" width="${L + 6}" height="9" rx="3" fill="#9aa4a1"/>${wheel(x0 + 58)}${wheel(x0 + 98)}${wheel(cx + 40)}`;
  }
};
const KIND_ORDER = ['ambulance', 'engine', 'brush', 'rescue', 'tanker', 'aerial'],
  KIND_LABEL = {
    ambulance: 'Ambulances (EMS)',
    engine: 'Pumper engines',
    brush: 'Wildland units',
    rescue: 'Rescue units',
    tanker: 'Water tenders',
    aerial: 'Aerial apparatus'
  };
export function apparatusArt(type, spec) {
  const [a, b] = PAINT[spec.kind] || PAINT.engine,
    id = `paint-${type}`,
    body = (BUILD[spec.kind] || BUILD.engine)(spec, `url(#${id})`);
  return `<svg class="apparatus-art" viewBox="0 0 360 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escape(spec.name)}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#15303a"/><stop offset="1" stop-color="#2a4b4e"/></linearGradient><linearGradient id="${id}" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#3b5f6b"/><stop offset="1" stop-color="#16262e"/></linearGradient></defs><rect width="360" height="170" rx="10" fill="url(#sky)"/><path d="M0 140V100h24V84h26v22h18V92h30v48ZM262 140V90h22V70h28v28h20V84h28v56Z" fill="#0f2229" opacity=".75"/><g fill="#f0c96a" opacity=".45"><rect x="8" y="106" width="4" height="5"/><rect x="30" y="92" width="4" height="5"/><rect x="40" y="92" width="4" height="5"/><rect x="274" y="96" width="4" height="5"/><rect x="292" y="78" width="4" height="5"/><rect x="332" y="92" width="4" height="5"/></g><rect y="140" width="360" height="30" fill="#161e24"/><path d="M0 157H360" stroke="#3a4650" stroke-width="2" stroke-dasharray="18 14"/><ellipse cx="180" cy="141" rx="150" ry="5" fill="#000" opacity=".35"/>${body}</svg>`;
}

export const money = (n) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0
  }).format(n);
export const time = (ms) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
export const date = (ms) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const duration = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const empty = (title, detail, ico = 'radio') =>
  `<div class="empty-state">${icon(ico)}<h3>${escape(title)}</h3><p>${escape(detail)}</p></div>`;
export function toast(message, error = false) {
  const e = document.createElement('div');
  e.className = 'toast' + (error ? ' error' : '');
  e.setAttribute('role', error ? 'alert' : 'status');
  e.textContent = message;
  $('#toasts').append(e);
  setTimeout(() => e.remove(), 6500);
}
export function openModal(title, content, wide = false) {
  const modal = $('#modal');
  if (modal.open) modal.close();
  $('#modal-content').innerHTML =
    `<header class="modal-header"><div><p class="eyebrow">FIRELINE COMMAND</p><h2 id="modal-title">${escape(title)}</h2></div><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></header>${content}`;
  modal.classList.toggle('wide', wide);
  modal.showModal();
  $('[data-close]', modal).onclick = () => modal.close();
}
export const closeModal = () => $('#modal').close();
export function renderMetrics(s, t) {
  const prog = s.catalog.progression,
    available = s.volunteers.filter((v) => v.busy_until <= t).length,
    ready = s.vehicles.filter((v) => v.busy_until <= t).length;
  $('#metrics').innerHTML = `
 <div class="metric"><span class="metric-icon">${icon('wallet')}</span><div><span class="metric-label">DEPARTMENT FUNDS</span><strong>${money(s.player.balance)}</strong><small>Operating balance <span class="gold">· game dollars</span></small></div></div>
 <div class="metric"><span class="metric-icon teal">${icon('people')}</span><div><span class="metric-label">VOLUNTEERS AVAILABLE</span><strong>${available}<em>/ ${s.volunteers.length}</em></strong><small>${available >= 3 ? 'A crew is ready to respond' : 'Crew resources are limited'}</small></div></div>
 <div class="metric"><span class="metric-icon orange">${icon('engine')}</span><div><span class="metric-label">APPARATUS READY</span><strong>${ready}<em>/ ${s.vehicles.length}</em></strong><small>${s.history.filter((p) => p.status === 'responding').length} active response${s.history.filter((p) => p.status === 'responding').length === 1 ? '' : 's'}</small></div></div>
 <div class="metric"><span class="metric-icon purple">${icon('shield')}</span><div><span class="metric-label">CHIEF LEVEL ${prog.level}</span><strong class="rank-title">${escape(prog.title)}</strong><small>${s.player.xp.toLocaleString()} XP <span class="gold">· ${prog.next ? `${prog.next - s.player.xp} to next rank` : 'Highest rank'}</span></small></div></div>`;
}
export function incidentCard(i, s, t, selected) {
  const locked = s.catalog.progression.level < i.minLevel;
  return `<button class="incident-card ${selected ? 'selected' : ''} severity-${i.severity}" data-incident="${escape(i.id)}" aria-pressed="${selected}"><div class="incident-top"><span class="incident-tag category-${i.category.toLowerCase()}">${escape(i.category)}</span><span class="incident-reference">${escape(i.reference)}</span></div><h3>${escape(i.name)}</h3><p>${icon('pin')}${escape(i.location)}</p><div class="incident-meta"><span>${locked ? `LEVEL ${i.minLevel} REQUIRED` : `${i.crew} CREW · ${i.severity === 3 ? 'HIGH' : i.severity === 2 ? 'MODERATE' : 'LOW'} PRIORITY`}</span><span data-expires="${i.expiresAt}">${duration(i.expiresAt - t)}</span></div></button>`;
}
export function detailPanel(i, s, t) {
  if (!i)
    return `<div class="detail-empty">${icon('radio')}<h3>Eyes on the district.</h3><p>Select a call on the map or from the incident feed to plan a response.</p></div>`;
  const locked = s.catalog.progression.level < i.minLevel,
    active = s.history.find((p) => p.incident.id === i.id && p.status === 'responding');
  return `<div class="detail-heading"><div class="category-symbol ${i.category.toLowerCase()}">${icon(i.category === 'Medical' ? 'cross' : i.category === 'Rescue' ? 'shield' : 'flame')}</div><div><p class="eyebrow">${escape(i.reference)} · ${escape(i.category)}</p><h3>${escape(i.name)}</h3><p>${escape(i.location)}</p></div><span class="pill ${active ? 'gold-pill' : 'red-pill'}">${active ? 'Responding' : 'Open call'}</span></div><p class="detail-description">${escape(i.description)}</p><div class="detail-stats"><div><small>REQUIRED CREW</small><strong>${i.crew} volunteers</strong></div><div><small>SERVICE GRANT</small><strong>${money(i.baseReward)} <span>max</span></strong></div><div><small>PROGRESSION</small><strong>+${i.xp} XP <span>max</span></strong></div></div><div class="detail-bottom"><span>${icon('shield')} No response, no cost. Your choice.</span>${active ? `<strong class="gold">On scene / en route · <span data-due="${active.dueAt}">${duration(active.dueAt - t)}</span></strong>` : `<button class="button primary" data-dispatch="${escape(i.id)}" ${locked ? 'disabled' : ''}>${locked ? `Unlock at level ${i.minLevel}` : `Plan response ${icon('arrow')}`}</button>`}</div>`;
}
export function dispatchLayout(s, t, selectedId) {
  return `<section class="operations-layout"><div class="map-column"><div class="panel map-panel"><div class="panel-header"><h2>${icon('map')}Service area</h2><span class="subtle">METRO MANILA, PH</span></div><div class="map-wrap"><div id="operations-map"></div><div class="map-live"><i class="tiny-dot"></i> LIVE OPERATIONS <span>01 DISTRICT</span></div><div class="map-controls"><button class="icon-button" id="map-plus" aria-label="Zoom in">+</button><button class="icon-button" id="map-minus" aria-label="Zoom out">−</button><button class="icon-button" id="map-reset" aria-label="Reset map">${icon('expand')}</button></div><div class="map-compass">N<span>↑</span></div><div class="map-key"><span><i class="key-dot open"></i>Open incident</span><span><i class="key-dot station"></i>Your station</span><span><i class="key-dot active"></i>Responding</span></div><span class="map-attribution">Generalized map · not for navigation</span></div></div><section class="panel detail-panel" id="incident-detail">${detailPanel(
    s.incidents.find((i) => i.id === selectedId),
    s,
    t
  )}</section></div><aside class="panel incident-feed"><div class="panel-header"><h2>Incident feed <span class="count">${s.incidents.length}</span></h2><span class="live-label">LIVE</span></div><div class="feed-note">Calls refresh every 2 min. Unattended calls clear at no cost.</div><div class="feed-filters" role="group" aria-label="Incident filters"><button class="filter active" data-filter="all" aria-pressed="true">All calls</button><button class="filter" data-filter="available" aria-pressed="false">My level</button><button class="filter" data-filter="urgent" aria-pressed="false">High priority</button></div><div class="incident-list" id="incident-list">${s.incidents.map((i) => incidentCard(i, s, t, i.id === selectedId)).join('')}</div><div class="feed-footer">${icon('radio')} Dispatch radio · server-verified incidents</div></aside></section><section class="active-response-section"><div class="section-heading"><h2>On the line <span class="count">${s.history.filter((p) => p.status === 'responding').length}</span></h2><span class="subtle">YOUR ACTIVE RESPONSES</span></div><div id="active-responses">${activeResponses(s, t)}</div></section>`;
}
export function activeResponses(s, t) {
  const active = s.history.filter((p) => p.status === 'responding');
  return active.length
    ? `<div class="active-grid">${active.map((p) => `<article class="response-card"><span class="response-pulse"></span><div><strong>${escape(p.incident.name)}</strong><p>${escape(s.vehicles.find((v) => v.id === p.vehicleId)?.name)} · ${p.crew.length} crew · ${escape(p.incident.location)}</p></div><span class="response-time" data-due="${p.dueAt}">${duration(p.dueAt - t)}</span></article>`).join('')}</div>`
    : `<div class="standby-strip">${icon('engine')}<div><strong>Standing by for the next call</strong><span>Your ready units will appear here once dispatched.</span></div><span class="pill teal-pill">All quiet at the station</span></div>`;
}
export function departmentView(s) {
  const org = s.organization,
    cap = s.catalog.capacities,
    p = s.catalog.progression,
    percent = p.next ? Math.round(((s.player.xp - p.floor) / (p.next - p.floor)) * 100) : 100;
  return `
 <section class="department-hero panel"><img class="department-emblem" src="/public/assets/images/department.svg" alt="Department insignia"><div><p class="eyebrow">STATION 01 · ESTABLISHED TO SERVE</p><h2>${escape(org.name)}</h2><p>Led by ${escape(s.player.name)} · Metro Manila, Philippines</p><div class="hero-tags"><span class="pill gold-pill">Tier ${org.station_level} station</span><span class="pill teal-pill">${s.player.reputation}% community trust</span></div></div><button class="button secondary" data-rename>Rename department</button></section>
 <div class="two-column"><section class="panel padded"><div class="section-heading"><h2>The chief’s journey</h2>${icon('shield')}</div><p class="eyebrow">LEVEL ${p.level}</p><h3 class="large-title">${escape(p.title)}</h3><progress max="100" value="${percent}" aria-label="Progress toward next level"></progress><div class="split subtle"><span>${s.player.xp} XP earned</span><span>${p.next ? `${p.next} XP next rank` : 'Highest rank achieved'}</span></div><div class="stat-row"><div><strong>${s.stats.attended}</strong><small>Calls attended</small></div><div><strong>${s.stats.successful}</strong><small>Successful responses</small></div><div><strong>${s.stats.completed ? Math.round((s.stats.successful / s.stats.completed) * 100) : 0}%</strong><small>Success rate</small></div></div><p class="muted">Every attended incident earns experience. Unlock specialized apparatus and larger station capacity as you advance.</p></section>
 <section class="panel padded"><div class="section-heading"><h2>Make room for more</h2>${icon('station')}</div><p class="muted">A stronger station starts with the capacity to show up.</p><div class="capacity-row"><span>Apparatus bays</span><strong>${s.vehicles.length} / ${cap.vehicles}</strong></div><div class="capacity-row"><span>Volunteer roster</span><strong>${s.volunteers.length} / ${cap.volunteers}</strong></div><div class="capacity-row"><span>Next expansion</span><strong>${org.station_level === 4 ? 'Maximum tier' : `${org.station_level + 2} bays · ${6 + (org.station_level + 1) * 2} volunteers`}</strong></div><button class="button primary full" data-org-action="upgrade" ${org.station_level === 4 || p.level < org.station_level + 1 || s.player.balance - s.catalog.responseReserve < s.catalog.stationUpgradeCost ? 'disabled' : ''}>${org.station_level === 4 ? 'Station fully expanded' : p.level < org.station_level + 1 ? `Requires chief level ${org.station_level + 1}` : `Expand station · ${money(s.catalog.stationUpgradeCost)}`}</button><p class="fine-print">One-time cost. Keep a $400 response reserve. No recurring upkeep or unattended incident fees.</p></section></div>
 <section class="panel padded"><h2>Service built on people</h2><p class="muted">Recruit volunteers, invest in their training, and keep enough crew available for the next call. Attendance is counted only when a volunteer is actually dispatched. Community trust rises with successful service and can fall slightly when an incident is contained with limited success.</p></section>`;
}
export function volunteersView(s, t) {
  return `<div class="section-heading"><div><h2>Your people. Your strength.</h2><p class="muted">${s.volunteers.length} / ${s.catalog.capacities.volunteers} roster positions · Training takes 60 seconds.</p></div><button class="button primary" data-org-action="recruit" ${s.volunteers.length >= s.catalog.capacities.volunteers || s.player.balance - s.catalog.responseReserve < s.catalog.recruitCost ? 'disabled' : ''}>${icon('plus')}Recruit · ${money(s.catalog.recruitCost)}</button></div><div class="volunteer-grid">${s.volunteers
    .map((v, i) => {
      const busy = v.busy_until > t,
        training = v.training_until > t;
      return `<article class="panel volunteer-card"><div class="split"><span class="person-avatar avatar-${i % 4}">${escape(
        v.name
          .split(' ')
          .map((n) => n[0])
          .join('')
      )}</span><span class="pill ${busy ? 'gold-pill' : 'teal-pill'}">${training ? 'Training' : busy ? 'Responding' : 'Available'}</span></div><h3>${escape(v.name)}</h3><p class="muted">${escape(v.role)}</p><div class="skill-rating" aria-label="Skill ${v.skill} out of 5">${'★'.repeat(v.skill)}<span>${'★'.repeat(5 - v.skill)}</span><small>SKILL ${v.skill}</small></div><div class="volunteer-stats"><div><strong>${v.attendance_count}</strong><span>Attended</span></div><div><strong>${v.successful_count}</strong><span>Successful</span></div></div><button class="button secondary full" data-train="${v.id}" ${busy || v.skill === 5 || s.player.balance - s.catalog.responseReserve < 350 * v.skill ? 'disabled' : ''}>${busy ? `Available in <span data-due="${v.busy_until}">${duration(v.busy_until - t)}</span>` : v.skill === 5 ? 'Fully qualified' : `Train · ${money(350 * v.skill)}`}</button></article>`;
    })
    .join('')}</div>`;
}
export function fleetView(s, t) {
  const cap = s.catalog.capacities.vehicles;
  return `<div class="section-heading"><div><h2>Ready to roll.</h2><p class="muted">${s.vehicles.length} / ${cap} apparatus bays occupied · All units return automatically.</p></div><span class="pill gold-pill">Tier ${s.organization.station_level} station</span></div><div class="fleet-grid">${s.vehicles.map((v) => `<article class="panel apparatus-card"><div class="split"><p class="eyebrow">${escape(v.name)}</p><span class="pill ${v.busy_until > t ? 'gold-pill' : 'teal-pill'}">${v.busy_until > t ? 'In service' : 'Ready'}</span></div>${apparatusArt(v.type, s.catalog.vehicles[v.type]).replace('class="apparatus-art"', 'class="apparatus-art vehicle-image"')}<h3>${escape(s.catalog.vehicles[v.type].name)}</h3><p class="muted">${escape(s.catalog.vehicles[v.type].description)}</p><div class="capacity-row"><span>Crew seats</span><strong>${s.catalog.vehicles[v.type].crew}</strong></div>${v.busy_until > t ? `<p class="gold">Returning in <span data-due="${v.busy_until}">${duration(v.busy_until - t)}</span></p>` : '<p class="teal-text">Available for compatible incidents</p>'}</article>`).join('')}</div><div class="section-heading shop-heading"><h2>Expand your response</h2><span class="subtle">APPARATUS CATALOG</span></div><div class="shop-groups">${KIND_ORDER.map((kind) => {
    const items = Object.entries(s.catalog.vehicles).filter(([, v]) => v.kind === kind);
    return `<h3 class="shop-group">${KIND_LABEL[kind]}</h3><div class="shop-grid">${items
      .map(([type, v]) => {
        const locked = s.catalog.progression.level < v.minLevel,
          full = s.vehicles.length >= cap;
        return `<article class="panel shop-card">${apparatusArt(type, v)}<div><span class="eyebrow">LEVEL ${v.minLevel} · ${v.crew} CREW${v.liters ? ` · ${v.liters.toLocaleString('en-US')} L` : ''}</span><h3>${escape(v.name)}</h3><p class="muted">${escape(v.description)}</p><button class="button secondary full" data-purchase="${type}" ${locked || full || s.player.balance - s.catalog.responseReserve < v.price ? 'disabled' : ''}>${locked ? `Unlocks at level ${v.minLevel}` : full ? 'Expand station to add a bay' : `Acquire · ${money(v.price)}`}</button></div></article>`;
      })
      .join('')}</div>`;
  }).join('')}</div>`;
}
export function financesView(s) {
  const income = s.ledger.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0),
    spent = s.ledger.filter((e) => e.amount < 0).reduce((a, e) => a - e.amount, 0);
  return `<div class="finance-summary"><section class="panel padded"><p class="eyebrow">OPERATING BALANCE</p><strong class="balance-display">${money(s.player.balance)}</strong><p class="muted">Game dollars only. $400 is protected from capital spending as a response reserve.</p></section><section class="panel padded"><p class="eyebrow">RECENT INFLOWS</p><strong class="balance-display teal-text">+${money(income)}</strong><p class="muted">Service grants and founding support</p></section><section class="panel padded"><p class="eyebrow">RECENT OUTFLOWS</p><strong class="balance-display">−${money(spent)}</strong><p class="muted">Responses, training, and department investment</p></section></div><section class="panel"><div class="panel-header"><h2>Department ledger</h2><span class="subtle">LATEST 100 TRANSACTIONS</span></div><div class="table-wrap"><table><thead><tr><th>Transaction</th><th>Time</th><th>Amount</th><th>Balance after</th></tr></thead><tbody>${s.ledger.map((e) => `<tr><td><strong>${escape(e.description)}</strong><small>${escape(e.kind.replaceAll('_', ' '))}</small></td><td class="nowrap">${date(e.created_at)} · ${time(e.created_at)}</td><td class="money-cell ${e.amount > 0 ? 'positive' : ''}">${e.amount > 0 ? '+' : '−'}${money(Math.abs(e.amount))}</td><td class="money-cell">${money(e.balance_after)}</td></tr>`).join('')}</tbody></table></div></section><p class="fine-print">Summary totals cover the most recent 100 ledger entries, not lifetime activity. Your current balance is authoritative. Ignored calls never appear in this ledger.</p>`;
}
export function historyView(s, t) {
  return `<section class="panel"><div class="panel-header"><h2>Responses that made a difference</h2><span class="subtle">LATEST 100 ATTENDED CALLS</span></div>${s.history.length ? `<div class="table-wrap"><table><thead><tr><th>Incident</th><th>Crew & attendance</th><th>Status</th><th>Cost / grant</th></tr></thead><tbody>${s.history.map((p) => `<tr><td><strong>${escape(p.incident.name)}</strong><small>${escape(p.incident.location)} · ${date(p.startedAt)} ${time(p.startedAt)}</small></td><td>${p.crew.map((c) => escape(c.name)).join(', ')}<small>${escape(s.vehicles.find((v) => v.id === p.vehicleId)?.name)}</small></td><td><span class="pill ${p.status === 'responding' ? 'gold-pill' : p.outcome === 'successful' ? 'teal-pill' : 'neutral-pill'}">${p.status === 'responding' ? 'Responding' : p.outcome === 'successful' ? 'Successful' : 'Contained'}</span>${p.status === 'responding' ? `<small data-due="${p.dueAt}">${duration(p.dueAt - t)}</small>` : `<small>+${p.xp} XP</small>`}</td><td class="money-cell">−${money(p.cost)}<small class="teal-text">${p.status === 'completed' ? `+${money(p.reward)}` : 'Grant pending'}</small></td></tr>`).join('')}</tbody></table></div>` : empty('Your story starts with a response.', 'Only the calls you actually attend are recorded. No ignored calls, no phantom costs.', 'history')}</section>`;
}
export const HEADINGS = {
  dispatch: [
    'READY WHEN IT MATTERS',
    'Every call. A commitment.',
    'Your community is counting on you. Make the next response count.'
  ],
  department: [
    'BUILT TO SERVE',
    'A station with purpose.',
    'Build the department your community deserves.'
  ],
  volunteers: [
    'THE PEOPLE WHO SHOW UP',
    'Ordinary people. Extraordinary service.',
    'Develop your volunteers, track attendance, and prepare the next crew.'
  ],
  fleet: [
    'TOOLS FOR THE MISSION',
    'The right unit. The right response.',
    'Keep your apparatus ready and expand your capabilities.'
  ],
  finances: [
    'EVERY DOLLAR ACCOUNTED FOR',
    'Fund the mission.',
    'A transparent record of the decisions you actually make.'
  ],
  history: [
    'A RECORD OF SERVICE',
    'You answered the call.',
    'Real participation. Named crews. A permanent record of showing up.'
  ]
};
