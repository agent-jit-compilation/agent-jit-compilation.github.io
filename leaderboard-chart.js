/* Leaderboard page: a Pareto chart (colored by harness, labeled by model) and a sortable table on the REAL-27 tasks. */
'use strict';
(() => {
  const data = window.LEADERBOARD;
  const figure = document.getElementById('leaderboard-figure');
  if (!data || !figure) return;
  const NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const rows = data.rows;
  const colorOf = harness => data.families[data.harnesses[harness].family].color;
  const isFilled = harness => data.harnesses[harness].tools === 'Synthesized';
  const median = values => { const s = [...values].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const medianLatency = median(rows.map(row => row.latency_s));
  const medianSuccess = median(rows.map(row => row.success_pct));
  const front = rows.filter(row => row.pareto).sort((a, b) => a.latency_s - b.latency_s);
  // Each step adds one mechanism to the same model.
  const steps = [
    ['Browser-Use', 'Browser-Use +cache', 'synthesized tools'],
    ['Browser-Use +cache', 'JIT-Planner', 'compiled planning'],
    ['Browser-Use', 'JIT-Scheduler', 'adaptive scheduling'],
  ];
  const find = (harness, model) => rows.find(row => row.harness === harness && row.model === model);
  const hidden = new Set();
  let showLines = false, lockedRow = null, nodes = [], geometry = null, renderedWidth = 0;

  const mount = document.getElementById('leaderboard-chart');
  mount.innerHTML = `
    <div class="lb-legend">
      <span class="lb-key"><span class="lb-quadrant-swatch" aria-hidden="true"></span>Most attractive quadrant</span>
      <span class="lb-key"><svg viewBox="0 0 28 10" aria-hidden="true"><line x1="3" y1="5" x2="25" y2="5" class="lb-pareto"></line></svg>Pareto line</span>
      <span class="lb-key lb-note">Filled: synthesized tools</span>
      <button type="button" class="lb-switch" aria-pressed="false">Connect same model</button>
    </div>
    <div class="lb-legend lb-harnesses" role="group" aria-label="Harnesses shown in leaderboard plot"></div>
    <div class="svg-chart-wrap"><svg id="leaderboard-svg" class="leaderboard-svg" role="group" aria-label="Interactive success versus latency plot"></svg><div id="leaderboard-tooltip" class="chart-tooltip" role="tooltip" hidden></div></div>
    <p id="leaderboard-selection" class="chart-selection" aria-live="polite"></p>`;
  const svg = document.getElementById('leaderboard-svg');
  const tooltip = document.getElementById('leaderboard-tooltip');
  const selection = document.getElementById('leaderboard-selection');

  function glyph(harness, size = 12) {
    const icon = svgNode('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': 'true' });
    const color = colorOf(harness);
    icon.append(svgNode('circle', isFilled(harness)
      ? { cx: 8, cy: 8, r: 6, fill: color }
      : { cx: 8, cy: 8, r: 5, fill: '#fff', stroke: color, 'stroke-width': 2.5 }));
    return icon;
  }
  Object.keys(data.harnesses).forEach(harness => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'lb-harness'; button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', `Show ${harness} in leaderboard plot`);
    button.append(glyph(harness), document.createTextNode(harness + (data.harnesses[harness].family === 'JIT' ? ' (ours)' : '')));
    button.addEventListener('click', () => {
      if (hidden.has(harness)) hidden.delete(harness); else hidden.add(harness);
      button.setAttribute('aria-pressed', String(!hidden.has(harness)));
      lockedRow = null; render();
      selection.textContent = `${rows.filter(row => !hidden.has(row.harness)).length} of ${rows.length} entries shown.`;
    });
    mount.querySelector('.lb-harnesses').append(button);
  });
  const lineSwitch = mount.querySelector('.lb-switch');
  lineSwitch.addEventListener('click', () => {
    showLines = !showLines; lineSwitch.setAttribute('aria-pressed', String(showLines)); render();
  });

  function render() {
    renderedWidth = svg.getBoundingClientRect().width || 860;
    // Text keeps a readable on-screen size; narrow screens get a taller plot and fewer labels.
    const narrow = renderedWidth < 600;
    const W = 900, H = narrow ? 820 : 480, scale = W / renderedWidth, font = 12.5 * scale;
    const left = 14 + font * 4, right = W - 12, top = 10, bottom = H - font * 3.4;
    const minLatency = 6, maxLatency = 320, minSuccess = 50;
    const x = value => left + Math.log(value / minLatency) / Math.log(maxLatency / minLatency) * (right - left);
    const y = value => bottom - (value - minSuccess) / (100 - minSuccess) * (bottom - top);
    geometry = { W, H, x, y, scale };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const defs = svgNode('defs'); svg.append(defs);
    const marker = svgNode('marker', { id: 'lb-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' });
    marker.append(svgNode('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#898781' })); defs.append(marker);

    svg.append(svgNode('rect', { x: left, y: top, width: x(medianLatency) - left, height: y(medianSuccess) - top, class: 'lb-quadrant-good' }));
    svg.append(svgNode('rect', { x: x(medianLatency), y: y(medianSuccess), width: right - x(medianLatency), height: bottom - y(medianSuccess), class: 'lb-quadrant-bad' }));
    for (let success = minSuccess; success <= 100; success += 10) {
      svg.append(svgNode('line', { x1: left, x2: right, y1: y(success), y2: y(success), class: success === minSuccess ? 'lb-axis' : 'lb-grid' }));
      svg.append(svgNode('text', { x: left - font * 0.6, y: y(success) + font * 0.35, 'text-anchor': 'end', 'font-size': font, class: 'lb-tick' }, `${success}%`));
    }
    [10, 20, 50, 100, 200].forEach(latency => {
      svg.append(svgNode('text', { x: x(latency), y: bottom + font * 1.5, 'text-anchor': 'middle', 'font-size': font, class: 'lb-tick' }, latency));
    });
    svg.append(svgNode('text', { x: (left + right) / 2, y: H - font * 0.4, 'text-anchor': 'middle', 'font-size': font, class: 'lb-axis-title' }, 'Mean latency per task (s, log scale)'));
    svg.append(svgNode('text', { transform: `translate(${font * 1.1} ${(top + bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle', 'font-size': font, class: 'lb-axis-title' }, 'Success rate'));

    // Dotted frontier, extended to the left edge as on Artificial Analysis.
    const frontPoints = front.map(row => [x(row.latency_s), y(row.success_pct)]);
    svg.append(svgNode('path', { d: `M${left},${frontPoints[0][1]} ` + frontPoints.map(([px, py]) => `L${px},${py}`).join(' '), class: 'lb-pareto' }));

    const visible = rows.filter(row => !hidden.has(row.harness));
    const r = 6.5 * scale;
    if (showLines) {
      const lines = svgNode('g'); svg.append(lines);
      visible.forEach(row => steps.filter(([, to]) => to === row.harness).forEach(([from]) => {
        const a = find(from, row.model);
        if (!a || hidden.has(from)) return;
        const x1 = x(a.latency_s), y1 = y(a.success_pct), x2 = x(row.latency_s), y2 = y(row.success_pct);
        const length = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / length, uy = (y2 - y1) / length;
        lines.append(svgNode('line', { x1: x1 + ux * (r + 3), y1: y1 + uy * (r + 3), x2: x2 - ux * (r + 4), y2: y2 - uy * (r + 4), class: 'lb-model-line', 'data-model': row.model, 'marker-end': 'url(#lb-arrow)' }));
      }));
    }

    // Greedy label placement: frontier, then ours, then the rest; a label that fits nowhere is left to the tooltip and table.
    const obstacles = visible.map(row => [x(row.latency_s) - r - 2, y(row.success_pct) - r - 2, x(row.latency_s) + r + 2, y(row.success_pct) + r + 2]);
    const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const order = [...visible].sort((a, b) => (b.pareto ? 2 : b.ours ? 1 : 0) - (a.pareto ? 2 : a.ours ? 1 : 0) || a.latency_s - b.latency_s);
    const labels = svgNode('g'); svg.append(labels);
    // Candidate offsets [dx, dy, anchor, leader] in viewBox units; dy is the text baseline.
    const near = r + 5, far = r + 24 * scale, rise = font * 0.35, drop = font * 0.8;
    const candidates = [
      [near, rise, 'start'], [-near, rise, 'end'], [0, -near, 'middle'], [0, near + drop, 'middle'],
      [-r, near + drop, 'start'], [r, near + drop, 'end'], [-r, -near, 'start'], [r, -near, 'end'],
      [near, -near * 0.7, 'start'], [near, near * 0.7 + drop, 'start'], [-near, -near * 0.7, 'end'], [-near, near * 0.7 + drop, 'end'],
      [far, -far * 0.6, 'start', true], [far, far * 0.6 + drop, 'start', true], [-far, -far * 0.6, 'end', true], [-far, far * 0.6 + drop, 'end', true],
      [0, -far, 'middle', true], [0, far + drop, 'middle', true],
      [-r, -far, 'start', true], [r, -far, 'end', true], [-r, far + drop, 'start', true], [r, far + drop, 'end', true],
    ];
    const placed = [];
    const distance = (box, px, py) => Math.hypot(Math.max(box[0] - px, 0, px - box[2]), Math.max(box[1] - py, 0, py - box[3]));
    order.forEach(row => {
      const px = x(row.latency_s), py = y(row.success_pct), width = row.model.length * font * 0.56;
      for (const [dx, dy, anchor, leader] of candidates) {
        const tx = px + dx, ty = py + dy;
        const x0 = anchor === 'start' ? tx : anchor === 'end' ? tx - width : tx - width / 2;
        const box = [x0 - 2, ty - font * 0.8, x0 + width + 2, ty + font * 0.25];
        if (box[0] < left + 2 || box[2] > right - 2 || box[1] < top + 2 || box[3] > bottom - 2) continue;
        if (obstacles.some(other => overlaps(box, other))) continue;
        // A label must sit nearest its own point; a leader may not cross another label.
        const own = distance(box, px, py);
        if (!leader && visible.some(other => other !== row && distance(box, x(other.latency_s), y(other.success_pct)) <= own + r)) continue;
        const end = [anchor === 'middle' ? tx : tx - Math.sign(dx) * 3, dy < 0 ? ty + font * 0.15 : ty - font * 0.8];
        if (leader && placed.some(other => [0.2, 0.4, 0.6, 0.8].some(t => distance(other, px + (end[0] - px) * t, py + (end[1] - py) * t) === 0))) continue;
        obstacles.push(box); placed.push(box);
        if (leader) labels.append(svgNode('line', { x1: px, y1: py, x2: end[0], y2: end[1], class: 'lb-leader' }));
        labels.append(svgNode('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-size': font, class: `lb-label${row.pareto ? ' is-pareto' : ''}` }, row.model));
        break;
      }
    });

    const points = svgNode('g'); svg.append(points);
    nodes = visible.map(row => {
      const px = x(row.latency_s), py = y(row.success_pct), color = colorOf(row.harness);
      const label = `${row.harness}, ${row.model}: ${row.latency_s.toFixed(1)} seconds, ${row.success_pct.toFixed(1)}% success`;
      const g = svgNode('g', { tabindex: 0, role: 'button', 'aria-label': label, class: `chart-point${row.pareto ? ' is-pareto' : ''}`, 'data-harness': row.harness });
      g.append(svgNode('circle', { cx: px, cy: py, r: 14 * scale, fill: 'transparent', class: 'point-target' }));
      g.append(svgNode('circle', isFilled(row.harness)
        ? { cx: px, cy: py, r, fill: color, class: 'lb-dot' }
        : { cx: px, cy: py, r: r - 1.2 * scale, fill: '#fff', style: `stroke: ${color}; stroke-width: ${2.6 * scale}px`, class: 'lb-dot is-hollow' }));
      g.append(svgNode('title', {}, label));
      points.append(g);
      const inspect = () => showPoint(row, g);
      g.addEventListener('focus', inspect);
      g.addEventListener('blur', restorePoint);
      const pin = () => { lockedRow = row; inspect(); };
      g.addEventListener('click', pin);
      g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pin(); } });
      return { row, node: g };
    });
    tooltip.hidden = true;
  }

  const overview = 'Select a point for details.';
  function describe(row) {
    let text = `${row.harness} · ${row.model}: ${row.latency_s.toFixed(1)} s, ${row.success_pct.toFixed(1)}%.`;
    const step = steps.find(([, to]) => to === row.harness);
    const parent = step && find(step[0], row.model);
    if (parent) {
      const ratio = parent.latency_s / row.latency_s, delta = row.success_pct - parent.success_pct;
      text += ` vs. ${parent.harness}: ${ratio >= 1 ? `${ratio.toFixed(1)}× faster` : `${(1 / ratio).toFixed(1)}× slower`}, ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts.`;
    }
    if (row.pareto) text += ' Pareto optimal.';
    if (row.cost_usd) text += ` $${row.cost_usd.toFixed(2)} per run, as reported by ${row.harness}.`;
    return text;
  }
  function showPoint(row, node) {
    const { W, H, x, y } = geometry;
    svg.querySelectorAll('.chart-point').forEach(g => g.classList.toggle('point-active', g === node));
    svg.querySelectorAll('.lb-model-line').forEach(line => line.classList.toggle('is-dim', line.dataset.model !== row.model));
    // Values lead the tooltip; the harness and model follow.
    const value = document.createElement('strong'); value.textContent = `${row.success_pct.toFixed(1)}% · ${row.latency_s.toFixed(1)} s`;
    const name = document.createElement('span'); name.textContent = `${row.harness} · ${row.model}${row.cost_usd ? ` · $${row.cost_usd.toFixed(2)}/run` : ''}`;
    tooltip.replaceChildren(value, name); tooltip.hidden = false;
    const yPercent = y(row.success_pct) / H * 100;
    tooltip.style.left = `${Math.min(68, Math.max(2, x(row.latency_s) / W * 100 + 1.5))}%`;
    tooltip.style.top = `${yPercent < 25 ? yPercent + 4 : yPercent - 16}%`;
    selection.textContent = describe(row);
  }
  function hideTooltip() {
    tooltip.hidden = true;
    svg.querySelectorAll('.chart-point').forEach(g => g.classList.remove('point-active'));
    svg.querySelectorAll('.lb-model-line').forEach(line => line.classList.remove('is-dim'));
  }
  function restorePoint() {
    const pinned = nodes.find(({ row }) => row === lockedRow);
    if (pinned) showPoint(pinned.row, pinned.node); else hideTooltip();
  }
  // Resolve overlapping hit areas by distance, so every nearby marker can be inspected.
  function nearestPoint(event) {
    const { W, H, x, y } = geometry, bounds = svg.getBoundingClientRect();
    let nearest = null, distance = 22;
    nodes.forEach(entry => {
      const next = Math.hypot(event.clientX - bounds.left - x(entry.row.latency_s) / W * bounds.width,
        event.clientY - bounds.top - y(entry.row.success_pct) / H * bounds.height);
      if (next < distance) { nearest = entry; distance = next; }
    });
    return nearest;
  }
  svg.addEventListener('pointermove', event => {
    const nearest = nearestPoint(event);
    if (nearest) showPoint(nearest.row, nearest.node); else restorePoint();
  });
  svg.addEventListener('pointerleave', restorePoint);
  svg.addEventListener('click', event => {
    const nearest = nearestPoint(event);
    if (nearest) { lockedRow = nearest.row; showPoint(nearest.row, nearest.node); }
  });
  figure.addEventListener('keydown', event => { if (event.key === 'Escape') { lockedRow = null; hideTooltip(); selection.textContent = overview; } });

  // Sortable table: Latency and Success rank best-first on the first click and reverse on the next.
  const table = document.getElementById('leaderboard-results');
  const body = table.tBodies[0], headers = [...table.tHead.rows[0].cells];
  const columns = { 3: ['latency', 'ascending', 'slowest'], 4: ['success', 'descending', 'lowest'] };
  let sortColumn = 3, sortDirection = 'ascending';
  const cellValue = (tr, column) => parseFloat(tr.cells[column].textContent);
  function sortTable() {
    const other = sortColumn === 3 ? 4 : 3, sign = sortDirection === 'ascending' ? 1 : -1;
    const otherSign = columns[other][1] === 'ascending' ? 1 : -1;
    [...body.rows]
      .sort((a, b) => sign * (cellValue(a, sortColumn) - cellValue(b, sortColumn)) || otherSign * (cellValue(a, other) - cellValue(b, other)))
      .forEach((tr, i) => { tr.cells[0].textContent = i + 1; body.append(tr); });
    Object.keys(columns).forEach(key => {
      const th = headers[key], active = Number(key) === sortColumn;
      th.setAttribute('aria-sort', active ? sortDirection : 'none');
      th.querySelector('.sort-indicator').textContent = active ? (sortDirection === 'ascending' ? '↑' : '↓') : '↕';
    });
    const [name, best, worst] = columns[sortColumn];
    table.caption.textContent = `Ranked by ${name}${sortDirection === best ? '' : `, ${worst} first`}.`;
  }
  Object.entries(columns).forEach(([key, [, best]]) => {
    const column = Number(key), th = headers[column];
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sort-button';
    const indicator = document.createElement('span'); indicator.className = 'sort-indicator'; indicator.setAttribute('aria-hidden', 'true');
    button.append(document.createTextNode(`${th.textContent.replace(/[↑↓]/g, '').trim()} `), indicator);
    th.replaceChildren(button);
    button.addEventListener('click', () => {
      sortDirection = column !== sortColumn ? best : sortDirection === 'ascending' ? 'descending' : 'ascending';
      sortColumn = column; sortTable();
    });
  });
  sortTable();
  figure.hidden = false;
  selection.textContent = overview;
  render();
  new ResizeObserver(() => {
    const width = svg.getBoundingClientRect().width;
    if (width && Math.abs(width - renderedWidth) > 24) render();
  }).observe(mount);
})();
