/* Progressive enhancements for the paper figures. Examples play on first viewport entry. */
'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function svgNode(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function activateWithKeyboard(node, action) {
    node.addEventListener('click', action);
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
    });
  }
  function mount(id, markup) {
    const figure = document.getElementById(id);
    figure.querySelector('.interactive-mount').innerHTML = markup;
    return figure;
  }
  function addFigureViews(figure, label, pause, replay, autoplay = false) {
    const controls = document.createElement('div');
    controls.className = 'figure-view-toggle';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `${label} figure view`);
    const panel = figure.querySelector('.interactive-mount');
    panel.id = `${figure.id}-panel`;
    panel.hidden = false;
    figure.classList.add('is-interactive');
    let hasStarted = false;
    ['Original', 'Interactive'].forEach((name, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'figure-view-option';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(index === 1));
      button.setAttribute('aria-controls', panel.id);
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-pressed') === 'true') return;
        pause();
        figure.classList.toggle('is-interactive', index === 1);
        panel.hidden = index === 0;
        [...controls.children].forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        hasStarted = true;
        if (index === 1) replay();
      });
      controls.append(button);
    });
    figure.prepend(controls);
    if (autoplay && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.15 || document.hidden) continue;
          if (!hasStarted && figure.classList.contains('is-interactive')) {
            hasStarted = true;
            if (!reducedMotion.matches) replay();
          }
          observer.disconnect();
        }
      }, { threshold: 0.15 });
      observer.observe(figure);
      // A reader's explicit choice takes precedence over a pending viewport start.
      figure.addEventListener('pointerdown', () => { hasStarted = true; }, { once: true });
      figure.addEventListener('keydown', () => { hasStarted = true; }, { once: true });
    }
  }
  function originalSvg(container, source, label) {
    container.innerHTML = source;
    const svg = container.querySelector('svg');
    svg.classList.add('original-diagram');
    // draw.io exports an inline light/dark scheme; the paper artwork uses light colors.
    svg.style.colorScheme = 'light';
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', label);
    svg.querySelectorAll('foreignObject').forEach(node => node.setAttribute('aria-hidden', 'true'));
    svg.querySelectorAll('a').forEach(node => node.removeAttribute('href'));
    return svg;
  }

  // Figure 3: preserve the source diagram; reveal its reasoning in four steps.
  const planning = mount('planning-interactive', `
    <p class="interaction-help">Select a stage or candidate plan to examine the planning procedure.</p>
    <div class="figure-controls" role="group" aria-label="Planning explanation steps">
      <button class="button is-small" data-stage="0" aria-pressed="false">1. Generation</button>
      <button class="button is-small" data-stage="1" aria-pressed="false">2. Validation</button>
      <button class="button is-small" data-stage="2" aria-pressed="false">3. Cost estimation</button>
      <button class="button is-small" data-stage="3" aria-pressed="true">4. Selection</button>
      <button class="button is-small play-control" id="planning-play">Replay</button>
    </div>
    <div class="diagram-scroll" tabindex="0" role="region" aria-label="Interactive planning diagram; scroll horizontally on a small screen"><div id="planning-art"></div></div>
    <p class="figure-explanation" id="planning-explanation" aria-live="polite"></p>`);
  const planSvg = originalSvg(document.getElementById('planning-art'), window.PAPER_FIGURES.example_planning, 'Candidate plans, validation, cost comparison and selection');
  const cell = number => planSvg.querySelector(`[data-cell-id$="-${number}"]`);
  const validationLabel = [...cell(25).querySelectorAll('font')].find(node => node.textContent === 'PRECONDITION VIOLATION');
  const stages = [
    'Candidate generation: the planner samples programs for the same task, varying tool order and the use of runtime LLM calls.',
    'Protocol validation: Plans 1 and 3 navigate to the restaurant before accessing its menu. Plan 2 omits this transition, violates the precondition of list_items, and is rejected.',
    'Cost estimation: Plan 1 compares prices through ai_eval; Plan 3 uses the deterministic min operation. Both plans are valid, but Plan 3 has lower estimated cost.',
    'Plan selection: the planner selects Plan 3 for execution with cached tools, eliminating a runtime LLM call while preserving the required page-state transitions.'
  ];
  const planNotes = [
    'Plan 1 is valid but has higher estimated cost. goto_restaurant establishes the required page state; ai_eval compares prices using an LLM where a deterministic minimum would suffice.',
    'Plan 2 is invalid. list_restaurants leaves the browser on the restaurant list, whereas list_items requires a restaurant detail page. The missing goto_restaurant call violates this precondition.',
    'Plan 3 is selected. goto_restaurant establishes the required page state, list_items retrieves the menu, and min compares prices without a runtime LLM call.'
  ];
  let stage = 3, pinnedPlan = null, planTimer;
  const planExplanation = document.getElementById('planning-explanation');
  const playPlan = document.getElementById('planning-play');
  const revealAt = { 31: 1, 32: 1, 33: 1, 35: 2, 36: 2, 34: 3, 37: 3, 38: 3, 39: 3, 40: 3, 41: 3, 42: 3, 43: 3, 44: 3, 45: 3, 46: 3 };
  function emphasizePlan(index) {
    [24, 25, 26].forEach((id, i) => {
      cell(id).classList.toggle('plan-emphasis', index === i);
      cell(id).setAttribute('aria-pressed', String(pinnedPlan === i));
    });
    planExplanation.textContent = index === null ? stages[stage] : planNotes[index];
  }
  function setStage(value) {
    stage = value; pinnedPlan = null;
    planning.querySelectorAll('[data-stage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === stage)));
    Object.entries(revealAt).forEach(([id, threshold]) => cell(id)?.classList.toggle('stage-unrevealed', stage < threshold));
    cell(25).classList.toggle('plan-rejected', stage >= 1);
    if (validationLabel) validationLabel.style.visibility = stage >= 1 ? 'visible' : 'hidden';
    cell(26).classList.toggle('plan-selected', stage === 3);
    emphasizePlan(null);
  }
  function stopPlan() { clearTimeout(planTimer); planTimer = null; playPlan.textContent = 'Replay'; }
  planning.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { stopPlan(); setStage(Number(button.dataset.stage)); }));
  [24, 25, 26].forEach((id, index) => {
    const node = cell(id);
    node.classList.add('plan-target'); node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Inspect Plan ${index + 1}`);
    node.addEventListener('pointerenter', () => { if (!planTimer) emphasizePlan(index); });
    node.addEventListener('pointerleave', () => emphasizePlan(pinnedPlan));
    node.addEventListener('focus', () => { stopPlan(); emphasizePlan(index); });
    node.addEventListener('blur', () => emphasizePlan(pinnedPlan));
    activateWithKeyboard(node, () => { stopPlan(); pinnedPlan = pinnedPlan === index ? null : index; emphasizePlan(pinnedPlan); });
  });
  function replayPlan() {
    stopPlan();
    setStage(0);
    playPlan.textContent = 'Pause';
    function next() {
      setStage(stage + 1);
      if (stage < 3) planTimer = setTimeout(next, 2400); else stopPlan();
    }
    planTimer = setTimeout(next, 2400);
  }
  playPlan.addEventListener('click', () => { if (planTimer) stopPlan(); else replayPlan(); });
  setStage(3);
  planning.classList.add('is-enhanced');
  addFigureViews(planning, 'Planning', stopPlan, replayPlan, true);

  // Figure 4: selection on the original diagram + a controllable schematic timeline.
  const scheduling = mount('scheduling-interactive', `
    <p class="interaction-help">Select a scheduling strategy to examine worker execution.</p>
    <div class="schedule-illustration">
      <div id="scheduling-art"></div>
      <div class="schedule-walkthrough">
        <div class="figure-controls"><label for="schedule-choice">Strategy</label><select id="schedule-choice"><option value="serial">Serial</option><option value="parallel">Parallel</option><option value="hedge" selected>Hedge</option></select></div>
        <p id="schedule-note"></p>
        <svg id="schedule-timeline" viewBox="0 0 460 225" role="img" aria-label="Illustrative worker timeline"></svg>
        <div class="timeline-controls"><button class="button is-small" id="schedule-play">Replay</button><label for="schedule-progress">Execution progress</label><input type="range" id="schedule-progress" min="0" max="100" value="100" aria-label="Execution progress"></div>
        <p id="schedule-progress-note" class="timeline-status" aria-live="polite"></p>
      </div>
    </div>`);
  const scheduleSvg = originalSvg(document.getElementById('scheduling-art'), window.PAPER_FIGURES.example_scheduling, 'Choose Serial, Parallel or Hedge in the original scheduling example');
  const scheduleData = {
    serial: {
      note: 'Serial execution assigns dependent operations to a single worker, avoiding the initialization and coordination overhead of additional workers.',
      rows: [[{ start: 0, end: 28, label: 'Navigate' }, { start: 28, end: 56, label: 'Read' }, { start: 56, end: 90, label: 'Compare' }], [], []], end: 90,
      done: 'All operations have completed sequentially on Worker 1. The remaining workers are idle.'
    },
    parallel: {
      note: 'Parallel execution assigns independent subtasks to separate workers. Completion requires all subtask results, so latency is determined by the slowest worker.',
      rows: [[{ start: 0, end: 58, label: 'Vendor A' }], [{ start: 0, end: 85, label: 'Vendor B' }], [{ start: 0, end: 42, label: 'Vendor C' }]], end: 85,
      done: 'All subtasks have completed. The Vendor B subtask determines total execution latency.'
    },
    hedge: {
      note: 'Hedged execution launches concurrent attempts of the same task. The first completed attempt determines latency; the remaining attempts are cancelled.',
      rows: [[{ start: 0, end: 85, label: 'Same task' }], [{ start: 0, end: 52, label: 'Same task' }], [{ start: 0, end: 95, label: 'Same task' }]], end: 52,
      done: 'Worker 2 completes first. The remaining attempts are cancelled; hatching denotes unexecuted work.'
    }
  };
  let strategy = 'hedge', scheduleFrame = null, progress = 100;
  const scheduleChoice = document.getElementById('schedule-choice');
  const slider = document.getElementById('schedule-progress');
  const playSchedule = document.getElementById('schedule-play');
  const timeline = document.getElementById('schedule-timeline');
  const scheduleTargets = [];
  ['serial', 'parallel', 'hedge'].forEach((name, index) => {
    const hit = svgNode('rect', { x: 2 + 120 * index, y: 70, width: 110, height: 60, rx: 9, fill: 'transparent', class: 'schedule-target', tabindex: 0, role: 'button', 'aria-label': `Illustrate ${name} execution` });
    activateWithKeyboard(hit, () => chooseStrategy(name));
    scheduleSvg.append(hit); scheduleTargets.push(hit);
  });
  function stopSchedule() { cancelAnimationFrame(scheduleFrame); scheduleFrame = null; playSchedule.textContent = 'Replay'; }
  function chooseStrategy(name) {
    stopSchedule(); strategy = name; progress = 100; slider.value = '100'; scheduleChoice.value = name;
    scheduleTargets.forEach((hit, index) => hit.setAttribute('aria-pressed', String(['serial', 'parallel', 'hedge'][index] === name)));
    document.getElementById('schedule-note').textContent = scheduleData[name].note;
    drawTimeline();
  }
  function drawTimeline() {
    const data = scheduleData[strategy];
    timeline.replaceChildren();
    const defs = svgNode('defs');
    const pattern = svgNode('pattern', { id: 'stopped-hatch', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' });
    pattern.append(svgNode('rect', { width: 6, height: 6, fill: '#f5f5f5' }), svgNode('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#888', 'stroke-width': 1 })); defs.append(pattern); timeline.append(defs);
    const x = value => 85 + value * 3.45;
    data.rows.forEach((blocks, index) => {
      const y = 25 + index * 48;
      timeline.append(svgNode('text', { x: 0, y: y + 20, class: 'timeline-label' }, `Worker ${index + 1}`));
      if (!blocks.length) { timeline.append(svgNode('text', { x: 90, y: y + 20, class: 'timeline-label' }, 'Idle')); return; }
      blocks.forEach(block => {
        const isStopped = strategy === 'hedge' && index !== 1;
        const end = isStopped ? data.end : block.end;
        timeline.append(svgNode('rect', { x: x(block.start), y, width: (block.end - block.start) * 3.45, height: 30, fill: '#fffdf6', stroke: '#d6b656' }));
        const elapsed = Math.max(0, Math.min(progress, end) - block.start);
        if (elapsed > 0) timeline.append(svgNode('rect', { x: x(block.start), y, width: elapsed * 3.45, height: 30, fill: '#fff2cc', stroke: '#d6b656' }));
        if (isStopped && progress >= data.end) timeline.append(svgNode('rect', { x: x(end), y, width: (block.end - end) * 3.45, height: 30, fill: 'url(#stopped-hatch)', stroke: '#aaa' }));
        timeline.append(svgNode('text', { x: x(block.start) + 7, y: y + 20, class: 'timeline-label' }, block.label));
        if (progress >= end && (!isStopped || strategy !== 'hedge')) timeline.append(svgNode('text', { x: x(end) + 5, y: y + 20, class: 'timeline-label' }, '✓'));
      });
    });
    const markerX = x(Math.min(progress, data.end));
    timeline.append(svgNode('line', { x1: markerX, y1: 15, x2: markerX, y2: 168, stroke: '#56517e', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
    timeline.append(svgNode('line', { x1: 85, y1: 181, x2: 430, y2: 181, stroke: '#555' }));
    timeline.append(svgNode('text', { x: 250, y: 207, 'text-anchor': 'middle', class: 'timeline-label' }, 'Execution time (schematic) →'));
    timeline.setAttribute('aria-label', `${strategy} execution. ${progress >= data.end ? data.done : `Progress ${Math.round(progress)}%. Work is still running.`}`);
    const status = document.getElementById('schedule-progress-note');
    const nextText = progress >= data.end ? data.done : 'Execution in progress. Adjust the slider to examine worker completion times.';
    if (status.textContent !== nextText) status.textContent = nextText;
  }
  scheduleChoice.addEventListener('change', () => chooseStrategy(scheduleChoice.value));
  slider.addEventListener('input', () => { stopSchedule(); progress = Number(slider.value); drawTimeline(); });
  function replaySchedule() {
    stopSchedule();
    if (reducedMotion.matches) { progress = 0; slider.value = '0'; drawTimeline(); document.getElementById('schedule-progress-note').textContent = 'Reduced motion is enabled. Adjust execution progress manually using the slider.'; return; }
    progress = 0; slider.value = '0'; drawTimeline(); playSchedule.textContent = 'Pause';
    const started = performance.now();
    function frame(now) {
      progress = Math.min(100, (now - started) / 45); slider.value = String(Math.round(progress)); drawTimeline();
      if (progress < 100) scheduleFrame = requestAnimationFrame(frame); else stopSchedule();
    }
    scheduleFrame = requestAnimationFrame(frame);
  }
  playSchedule.addEventListener('click', () => { if (scheduleFrame !== null) stopSchedule(); else replaySchedule(); });
  chooseStrategy('hedge'); scheduling.classList.add('is-enhanced');
  addFigureViews(scheduling, 'Scheduling', stopSchedule, replaySchedule, true);

  // Figure 10: render the exact source data as SVG, preserving color and shape encodings.
  const data = window.SCHEDULER_RESULTS;
  const scheduler = mount('scheduler-interactive', `
    <div class="chart-legend" role="group" aria-label="Models shown in scheduler plot"></div>
    <div class="svg-chart-wrap"><svg id="scheduler-chart" viewBox="0 0 900 480" role="group" aria-label="Interactive accuracy versus latency plot"></svg><div id="chart-tooltip" role="tooltip" hidden></div></div>
    <div class="shape-legend" aria-label="Strategy marker legend"></div>
    <p id="chart-selection" class="chart-selection" aria-live="polite">Select a point to inspect its model, strategy, latency, and accuracy.</p>`);
  const chart = document.getElementById('scheduler-chart');
  const tooltip = document.getElementById('chart-tooltip');
  const selection = document.getElementById('chart-selection');
  const hiddenModels = new Set();
  const modelNames = Object.keys(data.colors);
  const pointNodes = [];
  let lockedPoint = null;
  const W = 900, H = 480, left = 75, right = 865, top = 22, bottom = 415;
  const x = value => left + (value - 58) / (268 - 58) * (right - left);
  const y = value => bottom - (value - 40) / 60 * (bottom - top);
  const shapeNames = ['Serial', 'Parallel', 'Hedge', 'JIT-Scheduler', 'Oracle-Scheduler'];
  function symbol(strategy, cx, cy, color, size = 7) {
    const attrs = { fill: color, stroke: '#222', 'stroke-width': 1.1 };
    if (strategy === 'Hedge') return svgNode('circle', { ...attrs, cx, cy, r: size });
    if (strategy === 'Parallel') return svgNode('rect', { ...attrs, x: cx - size, y: cy - size, width: size * 2, height: size * 2 });
    let points;
    if (strategy === 'Serial') points = `${cx},${cy - size - 1} ${cx - size},${cy + size} ${cx + size},${cy + size}`;
    if (strategy === 'JIT-Scheduler') points = `${cx},${cy - size - 2} ${cx + size + 2},${cy} ${cx},${cy + size + 2} ${cx - size - 2},${cy}`;
    if (strategy === 'Oracle-Scheduler') points = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? size * .48 : size * 1.4; return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`; }).join(' ');
    return svgNode('polygon', { ...attrs, points });
  }
  // Fixed axes allow direct comparisons while models are hidden.
  for (let accuracy = 40; accuracy <= 100; accuracy += 10) {
    chart.append(svgNode('line', { x1: left, x2: right, y1: y(accuracy), y2: y(accuracy), class: 'chart-grid' }));
    chart.append(svgNode('text', { x: left - 14, y: y(accuracy) + 5, 'text-anchor': 'end', class: 'chart-tick' }, `${accuracy}%`));
  }
  for (let latency = 75; latency <= 250; latency += 25) {
    chart.append(svgNode('line', { x1: x(latency), x2: x(latency), y1: top, y2: bottom, class: 'chart-grid' }));
    chart.append(svgNode('text', { x: x(latency), y: bottom + 27, 'text-anchor': 'middle', class: 'chart-tick' }, latency));
  }
  chart.append(svgNode('rect', { x: left, y: top, width: right - left, height: bottom - top, fill: 'none', stroke: '#333' }));
  chart.append(svgNode('text', { x: (left + right) / 2, y: H - 7, 'text-anchor': 'middle', class: 'chart-axis' }, 'Latency (s)'));
  chart.append(svgNode('text', { transform: `translate(20 ${(top + bottom) / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'chart-axis' }, 'Accuracy'));
  const series = svgNode('g'); chart.append(series);
  modelNames.forEach(model => {
    const group = svgNode('g', { 'data-model': model }); series.append(group);
    const points = data.points.filter(point => point.model === model);
    const eligible = points.filter(point => point.strategy !== 'Oracle-Scheduler' && modelNames.indexOf(model) < 3);
    const front = eligible.filter(a => !eligible.some(b => b.latency <= a.latency && b.accuracy >= a.accuracy && (b.latency < a.latency || b.accuracy > a.accuracy))).sort((a, b) => a.latency - b.latency);
    if (front.length > 1) group.append(svgNode('polyline', { points: front.map(p => `${x(p.latency)},${y(p.accuracy)}`).join(' '), fill: 'none', stroke: data.colors[model], 'stroke-opacity': .5, 'stroke-width': 1.5 }));
    points.forEach(point => {
      const label = `${point.model}, ${point.strategy}: ${point.latency.toFixed(1)} seconds, ${point.accuracy.toFixed(1)}% accuracy`;
      const g = svgNode('g', { tabindex: 0, role: 'button', 'aria-label': label, class: 'chart-point' });
      g.append(svgNode('circle', { cx: x(point.latency), cy: y(point.accuracy), r: 15, fill: 'transparent', class: 'point-target' }), symbol(point.strategy, x(point.latency), y(point.accuracy), data.colors[model]));
      g.append(svgNode('title', {}, label)); group.append(g);
      pointNodes.push({ point, node: g });
      const inspect = () => showPoint(point, g);
      g.addEventListener('focus', inspect);
      g.addEventListener('blur', restorePoint);
      activateWithKeyboard(g, () => { lockedPoint = point; inspect(); });
    });
  });
  function showPoint(point, node) {
    chart.querySelectorAll('.chart-point').forEach(g => g.classList.toggle('point-active', g === node));
    tooltip.replaceChildren();
    const title = document.createElement('strong'); title.textContent = point.model;
    const description = document.createElement('span'); description.textContent = `${point.strategy} · ${point.latency.toFixed(1)} s · ${point.accuracy.toFixed(1)}%`;
    tooltip.append(title, description); tooltip.hidden = false;
    tooltip.style.left = `${Math.min(72, Math.max(4, x(point.latency) / W * 100))}%`;
    tooltip.style.top = `${Math.max(0, (y(point.accuracy) / H * 100) - 18)}%`;
    selection.textContent = `${point.model} — ${point.strategy}: ${point.latency.toFixed(1)} s, ${point.accuracy.toFixed(1)}% accuracy.${point.overhead ? ` Includes ${point.overhead.toFixed(1)} s scheduler overhead.` : ''}${point.strategy === 'Oracle-Scheduler' ? ' Oracle is a reference with true latency knowledge, excluded from the frontier.' : ''}`;
  }
  function hideTooltip() { tooltip.hidden = true; chart.querySelectorAll('.chart-point').forEach(g => g.classList.remove('point-active')); }
  function restorePoint() {
    const pinned = pointNodes.find(({ point }) => point === lockedPoint);
    if (pinned) showPoint(pinned.point, pinned.node); else hideTooltip();
  }
  // Resolve overlapping hit areas by distance, so every nearby marker can be inspected.
  function nearestPoint(event) {
    const bounds = chart.getBoundingClientRect();
    let nearest = null, distance = 22;
    pointNodes.forEach(entry => {
      if (hiddenModels.has(entry.point.model)) return;
      const dx = event.clientX - bounds.left - x(entry.point.latency) / W * bounds.width;
      const dy = event.clientY - bounds.top - y(entry.point.accuracy) / H * bounds.height;
      const next = Math.hypot(dx, dy);
      if (next < distance) { nearest = entry; distance = next; }
    });
    return nearest;
  }
  chart.addEventListener('pointermove', event => {
    const nearest = nearestPoint(event);
    if (nearest) showPoint(nearest.point, nearest.node); else restorePoint();
  });
  chart.addEventListener('pointerleave', restorePoint);
  chart.addEventListener('click', event => {
    const nearest = nearestPoint(event);
    if (nearest) { lockedPoint = nearest.point; showPoint(nearest.point, nearest.node); }
  });
  scheduler.addEventListener('keydown', event => { if (event.key === 'Escape') { lockedPoint = null; hideTooltip(); } });
  modelNames.forEach(model => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'legend-toggle'; button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-label', `Show ${model}`);
    const swatch = document.createElement('span'); swatch.className = 'legend-swatch'; swatch.style.background = data.colors[model]; swatch.setAttribute('aria-hidden', 'true');
    button.append(swatch, document.createTextNode(model)); scheduler.querySelector('.chart-legend').append(button);
    button.addEventListener('click', () => {
      if (hiddenModels.has(model)) hiddenModels.delete(model); else hiddenModels.add(model);
      button.setAttribute('aria-pressed', String(!hiddenModels.has(model)));
      const group = [...series.children].find(g => g.dataset.model === model);
      group.style.display = hiddenModels.has(model) ? 'none' : '';
      lockedPoint = null; hideTooltip(); selection.textContent = `${modelNames.length - hiddenModels.size} of ${modelNames.length} model series shown. Axes remain fixed for comparison.`;
    });
  });
  shapeNames.forEach(name => {
    const entry = document.createElement('span'); const icon = svgNode('svg', { viewBox: '0 0 26 26', 'aria-hidden': 'true' }); icon.append(symbol(name, 13, 13, 'white', 6));
    entry.append(icon, document.createTextNode(name)); scheduler.querySelector('.shape-legend').append(entry);
  });
  scheduler.classList.add('is-enhanced');
  addFigureViews(scheduler, 'Scheduler results', hideTooltip, restorePoint);
  window.mountPlannerCharts({svgNode, activateWithKeyboard, addFigureViews});
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPlan(); stopSchedule(); } });
})();
