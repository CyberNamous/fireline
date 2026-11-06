// Dependency-free, locally hosted geographical SVG map. No tile server or API key.
const NS = 'http://www.w3.org/2000/svg';
const BOUNDS = { west: 120.89, east: 121.22, south: 14.42, north: 14.75 };
const W = 1000,
  H = 850;
const project = ([lon, lat]) => [
  ((lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W,
  ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * H
];
const path = (points) =>
  points
    .map(
      (p, i) =>
        (i ? 'L' : 'M') +
        project(p)
          .map((n) => n.toFixed(1))
          .join(',')
    )
    .join(' ');
const roads = [
  {
    name: 'EDSA',
    major: true,
    p: [[120.9835, 14.654], [121.0035, 14.6575], [121.0322, 14.6567], [121.04, 14.635], [121.0527, 14.6205], [121.0567, 14.5877], [121.0457, 14.5672], [121.0285, 14.549], [121.0165, 14.542], [121.0008, 14.5378]]
  },
  {
    name: 'C-5',
    major: true,
    p: [[121.075, 14.66], [121.077, 14.612], [121.078, 14.587], [121.073, 14.562], [121.056, 14.533], [121.05, 14.5], [121.042, 14.46]]
  },
  {
    name: 'SLEX',
    major: true,
    p: [[121.001, 14.538], [121.017, 14.46], [121.03, 14.4]]
  },
  {
    name: 'Commonwealth Ave',
    major: false,
    p: [[121.0509, 14.654], [121.06, 14.67], [121.07, 14.684], [121.0755, 14.711]]
  },
  {
    name: 'Roxas Blvd',
    major: false,
    p: [[120.976, 14.59], [120.9795, 14.583], [120.983, 14.56], [120.987, 14.54], [120.989, 14.53]]
  },
  {
    name: 'Ortigas Ave',
    major: false,
    p: [[121.0567, 14.5877], [121.075, 14.589], [121.1, 14.584], [121.12, 14.578]]
  },
  {
    name: 'Marcos Highway',
    major: false,
    p: [[121.078, 14.63], [121.1, 14.63], [121.13, 14.635]]
  }
];
const towns = [
  ['MANILA', 120.968, 14.607],
  ['QUEZON CITY', 121.02, 14.69],
  ['CALOOCAN', 120.97, 14.665],
  ['VALENZUELA', 120.975, 14.72],
  ['MAKATI', 121.005, 14.553],
  ['MANDALUYONG', 121.017, 14.585],
  ['PASIG', 121.075, 14.575],
  ['MARIKINA', 121.09, 14.655],
  ['TAGUIG', 121.055, 14.52],
  ['PASAY', 120.99, 14.525],
  ['PARAÑAQUE', 120.998, 14.48],
  ['LAS PIÑAS', 120.99, 14.443]
];
let geography;
async function loadGeography() {
  if (!geography) {
    const r = await fetch('/geography/district.geojson');
    if (!r.ok) throw new Error('Geography unavailable');
    geography = await r.json();
  }
  return geography;
}
function el(name, attrs = {}, text) {
  const e = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value);
  if (text) e.textContent = text;
  return e;
}
export class OperationsMap {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.zoom = 1;
    this.x = 0;
    this.y = 0;
    this.abort = new AbortController();
    this.svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      role: 'img',
      'aria-label':
        'Interactive service-area map. Select incident markers or use the incident list.'
    });
    this.world = el('g');
    this.svg.append(this.world);
    container.replaceChildren(this.svg);
    this.base = el('g');
    this.routes = el('g');
    this.pins = el('g');
    this.world.append(this.base, this.routes, this.pins);
    this.drawBase();
    this.bind();
  }
  async drawBase() {
    this.base.append(
      el('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: '#1c2b32' })
    );
    for (let x = 0; x <= W; x += 100)
      this.base.append(el('path', { d: `M${x},0V${H}`, stroke: '#24353b', 'stroke-width': 1 }));
    for (let y = 0; y <= H; y += 100)
      this.base.append(el('path', { d: `M0,${y}H${W}`, stroke: '#24353b', 'stroke-width': 1 }));
    try {
      const geo = await loadGeography();
      if (this.abort.signal.aborted) return;
      for (const f of geo.features) {
        const polygons =
          f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const poly of polygons)
          this.base.append(
            el('path', {
              d: poly.map((r) => path(r) + 'Z').join(' '),
              fill: f.properties.kind === 'context' ? '#1f2f2a' : '#27403a',
              stroke: f.properties.kind === 'context' ? 'none' : '#5a7a62',
              'stroke-width': 1.6,
              'fill-rule': 'evenodd'
            })
          );
      }
    } catch {
      const note = document.createElement('span');
      note.className = 'map-data-note';
      note.textContent = 'Boundary layer unavailable · incident coordinates remain active';
      this.container.append(note);
    }
    // Schematic Laguna de Bay, Pasig and Marikina rivers, and generalized corridors.
    const lagunaDeBay = [[121.068, 14.375], [121.08, 14.43], [121.09, 14.49], [121.1, 14.525], [121.115, 14.535], [121.15, 14.52], [121.2, 14.5], [121.28, 14.45], [121.28, 14.3], [121.05, 14.3], [121.05, 14.35]];
    this.base.append(
      el('path', { d: path(lagunaDeBay) + 'Z', fill: '#24424d', stroke: '#37545d', 'stroke-width': 1.4 })
    );
    for (const river of [[[121.085, 14.538], [121.068, 14.544], [121.056, 14.558], [121.042, 14.565], [121.027, 14.564], [121.013, 14.582], [120.99, 14.592], [120.966, 14.596]], [[121.115, 14.67], [121.105, 14.645], [121.098, 14.63], [121.094, 14.61], [121.09, 14.59], [121.078, 14.57], [121.07, 14.556]]])
      this.base.append(
        el('path', {
          d: path(river),
          fill: 'none',
          stroke: '#37545d',
          'stroke-width': 5,
          'stroke-linecap': 'round'
        })
      );
    for (const road of roads) {
      this.base.append(
        el('path', {
          d: path(road.p),
          fill: 'none',
          stroke: '#111f23',
          'stroke-width': road.major ? 8 : 5,
          'stroke-linejoin': 'round'
        })
      );
      this.base.append(
        el('path', {
          d: path(road.p),
          fill: 'none',
          stroke: road.major ? '#81795d' : '#4a5b53',
          'stroke-width': road.major ? 3 : 2,
          'stroke-linejoin': 'round'
        })
      );
    }
    for (const [name, lon, lat] of towns) {
      const [x, y] = project([lon, lat]);
      this.base.append(
        el(
          'text',
          {
            x,
            y,
            fill: '#a4b2a4',
            'font-size': 11,
            'font-family': 'system-ui',
            'font-weight': 600,
            'letter-spacing': 1.7
          },
          name
        )
      );
    }
    for (const [text, lon, lat, rotate] of [
      ['MANILA BAY', 120.917, 14.56, -80],
      ['LAGUNA DE BAY', 121.16, 14.45, 0]
    ]) {
      const [x, y] = project([lon, lat]);
      this.base.append(
        el(
          'text',
          {
            x,
            y,
            transform: `rotate(${rotate} ${x} ${y})`,
            fill: '#65828b',
            'font-size': 17,
            'letter-spacing': 4,
            'text-anchor': 'middle'
          },
          text
        )
      );
    }
  }
  update(state, selectedId) {
    this.pins.replaceChildren();
    this.routes.replaceChildren();
    const org = state.organization,
      [sx, sy] = project([org.lon, org.lat]);
    const station = el('g', { transform: `translate(${sx} ${sy})` });
    station.append(
      el('circle', { r: 31, fill: '#cfb37d', opacity: '.08' }),
      el('rect', {
        x: -15,
        y: -15,
        width: 30,
        height: 30,
        rx: 7,
        fill: '#d6b67e',
        stroke: '#ebd3a8',
        'stroke-width': 2
      }),
      el('path', {
        d: 'M-8 7V-5L0-10 8-5V7ZM-4 7V0h8v7',
        fill: 'none',
        stroke: '#26302e',
        'stroke-width': 2
      }),
      el(
        'text',
        {
          x: 0,
          y: 47,
          fill: '#e6d6b5',
          'font-size': 10,
          'text-anchor': 'middle',
          'letter-spacing': 1
        },
        'STATION 01'
      )
    );
    station.append(el('title', {}, state.organization.name));
    this.pins.append(station);
    const active = state.history.filter((p) => p.status === 'responding');
    for (const p of active) {
      const [x, y] = project([p.incident.lon, p.incident.lat]);
      this.routes.append(
        el('path', {
          d: `M${sx},${sy} Q${(sx + x) / 2 + 20},${sy} ${x},${y}`,
          fill: 'none',
          stroke: '#d7ba82',
          'stroke-width': 2,
          'stroke-dasharray': '7 7',
          opacity: '.8'
        })
      );
    }
    for (const incident of [
      ...state.incidents,
      ...active.map((p) => ({ ...p.incident, responding: true }))
    ]) {
      const [x, y] = project([incident.lon, incident.lat]);
      const selected = incident.id === selectedId;
      const color = incident.responding
        ? '#82bda5'
        : incident.severity === 3
          ? '#ef6855'
          : incident.category === 'Medical'
            ? '#69b7b2'
            : '#d99254';
      const pin = el('g', {
        transform: `translate(${x} ${y})`,
        class: 'map-pin',
        role: 'button',
        tabindex: 0,
        'aria-label': `${incident.name}, ${incident.location}${incident.responding ? ', unit responding' : ''}`,
        'aria-pressed': selected
      });
      if (selected)
        pin.append(el('circle', { r: 29, fill: color, opacity: '.15', class: 'pin-halo' }));
      pin.append(
        el('circle', {
          r: selected ? 16 : 12,
          fill: '#18262c',
          stroke: color,
          'stroke-width': selected ? 3 : 2
        })
      );
      pin.append(
        el('path', {
          d:
            incident.category === 'Medical'
              ? 'M-5 0H5M0-5V5'
              : incident.responding
                ? 'M-4 0L0 4 6-4'
                : 'M0-6 5 4H-5Z',
          fill: 'none',
          stroke: color,
          'stroke-width': 2,
          'stroke-linecap': 'round'
        })
      );
      const choose = () => this.onSelect(incident.id);
      pin.addEventListener('click', choose, { signal: this.abort.signal });
      pin.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose();
          }
        },
        { signal: this.abort.signal }
      );
      this.pins.append(pin);
    }
  }
  bind() {
    const opts = { signal: this.abort.signal };
    let drag;
    this.svg.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target.closest('.map-pin')) return;
        drag = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y };
        this.svg.setPointerCapture(e.pointerId);
      },
      opts
    );
    this.svg.addEventListener(
      'pointermove',
      (e) => {
        if (!drag) return;
        const rect = this.svg.getBoundingClientRect();
        const unit = Math.max(W / rect.width, H / rect.height);
        this.x = drag.ox + (e.clientX - drag.x) * unit;
        this.y = drag.oy + (e.clientY - drag.y) * unit;
        this.apply();
      },
      opts
    );
    const stop = () => {
      drag = null;
    };
    this.svg.addEventListener('pointerup', stop, opts);
    this.svg.addEventListener('pointercancel', stop, opts);
    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { ...opts, passive: false }
    );
  }
  apply() {
    this.x = Math.min(W * 1.3, Math.max(-W * this.zoom, this.x));
    this.y = Math.min(H * 1.3, Math.max(-H * this.zoom, this.y));
    this.world.setAttribute('transform', `translate(${this.x} ${this.y}) scale(${this.zoom})`);
  }
  zoomBy(factor) {
    const old = this.zoom;
    this.zoom = Math.min(3.5, Math.max(0.8, old * factor));
    this.x = W / 2 - ((W / 2 - this.x) * this.zoom) / old;
    this.y = H / 2 - ((H / 2 - this.y) * this.zoom) / old;
    this.apply();
  }
  reset() {
    this.zoom = 1;
    this.x = 0;
    this.y = 0;
    this.apply();
  }
  destroy() {
    this.abort.abort();
  }
}
