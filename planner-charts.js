/* Figures 5 and 8: paper data, paired comparisons, and keyboard/touch inspection. */
'use strict';
window.mountPlannerCharts = function ({svgNode, activateWithKeyboard, addFigureViews}) {
  const data = window.PLANNER_PLOTS;
  const protocolName = value => value ? 'With protocol' : 'Without protocol';
  const percent = value => `${(value * 100).toFixed(1)}%`;
  function setup(id, markup, label) {
    const figure = document.getElementById(id);
    figure.querySelector('.interactive-mount').innerHTML = markup;
    figure.classList.add('is-enhanced');
    addFigureViews(figure, label, () => {}, () => {});
    return figure;
  }
  function legend(figure, colors, change) {
    const buttons = [];
    for (const [model, color] of Object.entries(colors)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'legend-toggle';
      button.setAttribute('aria-label', `Highlight ${model}`);
      button.setAttribute('aria-pressed', 'false');
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch'; swatch.style.background = color;
      swatch.style.setProperty('--swatch-color', color);
      swatch.setAttribute('aria-hidden', 'true');
      button.append(swatch, document.createTextNode(model));
      button.addEventListener('click', () => change(model));
      figure.querySelector('.chart-legend').append(button);
      buttons.push({model, button});
    }
    return selected => buttons.forEach(({model, button}) => button.setAttribute('aria-pressed', String(model === selected)));
  }
  function styles(figure) {
    const row = figure.querySelector('.protocol-legend');
    for (const protocol of [true, false]) {
      const item = document.createElement('span');
      const icon = svgNode('svg', {viewBox:'0 0 36 18', 'aria-hidden':'true'});
      icon.append(svgNode('line', {x1:1, x2:35, y1:9, y2:9, stroke:'#777', 'stroke-width':3,
        'stroke-dasharray':protocol ? 'none' : '6 4'}));
      item.append(icon, document.createTextNode(protocolName(protocol))); row.append(item);
    }
  }
  function axes(svg, box, xticks, yticks, xLabel, yLabel, formatY = percent) {
    for (const value of yticks) {
      svg.append(svgNode('line', {x1:box.left, x2:box.right, y1:box.y(value), y2:box.y(value), class:'chart-grid'}));
      svg.append(svgNode('text', {x:box.left-12, y:box.y(value)+5, 'text-anchor':'end', class:'chart-tick'}, formatY(value)));
    }
    for (const value of xticks) {
      svg.append(svgNode('line', {x1:box.x(value), x2:box.x(value), y1:box.top, y2:box.bottom, class:'chart-grid'}));
      svg.append(svgNode('text', {x:box.x(value), y:box.bottom+25, 'text-anchor':'middle', class:'chart-tick'}, value));
    }
    svg.append(svgNode('rect', {x:box.left, y:box.top, width:box.right-box.left, height:box.bottom-box.top, fill:'none', stroke:'#555'}));
    svg.append(svgNode('text', {x:(box.left+box.right)/2, y:box.height-8, 'text-anchor':'middle', class:'chart-axis'}, xLabel));
    svg.append(svgNode('text', {transform:`translate(18 ${(box.top+box.bottom)/2}) rotate(-90)`, 'text-anchor':'middle', class:'chart-axis'}, yLabel));
  }
  function coordinates(svg, event) {
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  function dim(figure, model) {
    figure.querySelectorAll('[data-plot-model]').forEach(node => {
      node.style.opacity = model && node.dataset.plotModel !== model ? '0.16' : '1';
    });
  }

  const protocol = setup('protocol-interactive', `
    <div class="chart-legend paired-model-legend" role="group" aria-label="Highlight a model in the protocol comparison"></div>
    <svg class="planner-chart" id="protocol-chart" viewBox="0 0 720 490" role="group" aria-label="Plan-generation accuracy and latency on REAL tasks"></svg>
    <div class="protocol-legend"></div>
    <p class="paired-readout" id="protocol-readout" aria-live="polite"></p>`, 'Tool protocol');
  const psvg = protocol.querySelector('svg');
  const pb = {left:74, right:698, top:20, bottom:430, height:490};
  pb.x = v => pb.left + v/23*(pb.right-pb.left);
  pb.y = v => pb.bottom - v/1.05*(pb.bottom-pb.top);
  axes(psvg, pb, [0,5,10,15,20], [0,.2,.4,.6,.8,1], 'Planning latency (s)', 'Accuracy');
  // Preserve the paper's separate GPT/Gemini connecting lines and protocol styles.
  const connections = svgNode('g'); psvg.append(connections);
  for (const family of ['GPT', 'Gemini']) for (const flag of [true, false]) {
    const points = data.protocol.points.filter(p => p.model.startsWith(family) && p.protocol === flag).sort((a,b) => a.latency-b.latency);
    connections.append(svgNode('polyline', {points:points.map(p => `${pb.x(p.latency)},${pb.y(p.accuracy)}`).join(' '),
      fill:'none', stroke:'#888', 'stroke-opacity':.7, 'stroke-width':2.5, 'stroke-dasharray':flag ? 'none' : '3 5'}));
  }
  let selectedProtocolModel = null;
  const readout = protocol.querySelector('.paired-readout');
  const setProtocolLegend = legend(protocol, data.protocol.colors, model => {
    selectedProtocolModel = selectedProtocolModel === model ? null : model;
    setProtocolLegend(selectedProtocolModel); inspectProtocol(selectedProtocolModel);
  });
  function inspectProtocol(model) {
    dim(protocol, model); connections.style.opacity = model ? '.2' : '1';
    readout.replaceChildren();
    if (!model) return;
    const title = document.createElement('strong'); title.textContent = model;
    readout.append(title);
    for (const point of data.protocol.points.filter(p => p.model === model)) {
      const line = document.createElement('span');
      line.textContent = `${protocolName(point.protocol)}: ${point.latency.toFixed(2)} s · ${percent(point.accuracy)} (${point.valid}/${point.n} valid plans)`;
      readout.append(line);
    }
  }
  const protocolTargets = [];
  for (const point of data.protocol.points) {
    const node = svgNode('g', {class:'chart-point', tabindex:0, role:'button', 'data-plot-model':point.model,
      'aria-label':`${point.model}, ${protocolName(point.protocol)}: ${point.latency.toFixed(2)} seconds, ${percent(point.accuracy)} accuracy`});
    node.append(svgNode('circle', {cx:pb.x(point.latency), cy:pb.y(point.accuracy), r:13, fill:'transparent', class:'point-target'}),
      svgNode('circle', {cx:pb.x(point.latency), cy:pb.y(point.accuracy), r:7, fill:data.protocol.colors[point.model], stroke:'#222', 'stroke-width':1.5}));
    node.addEventListener('focus', () => inspectProtocol(point.model));
    node.addEventListener('blur', () => inspectProtocol(selectedProtocolModel));
    activateWithKeyboard(node, () => {
      selectedProtocolModel = point.model; setProtocolLegend(point.model); inspectProtocol(point.model);
    });
    psvg.append(node); protocolTargets.push(point);
  }
  function nearestProtocol(event) {
    const p = coordinates(psvg, event);
    const threshold = 22*720/psvg.getBoundingClientRect().width;
    return protocolTargets.map(point => ({point, distance:Math.hypot(p.x-pb.x(point.latency),p.y-pb.y(point.accuracy))}))
      .sort((a,b) => a.distance-b.distance).find(entry => entry.distance < threshold)?.point;
  }
  psvg.addEventListener('pointermove', event => inspectProtocol(nearestProtocol(event)?.model || selectedProtocolModel));
  psvg.addEventListener('pointerleave', () => inspectProtocol(selectedProtocolModel));
  psvg.addEventListener('click', event => {
    const point = nearestProtocol(event);
    if (point) { selectedProtocolModel = point.model; setProtocolLegend(point.model); inspectProtocol(point.model); }
  });
  protocol.addEventListener('keydown', event => {
    if (event.key === 'Escape') { selectedProtocolModel = null; setProtocolLegend(null); inspectProtocol(null); }
  });
  styles(protocol);

  const efficiency = setup('efficiency-interactive', `
    <div class="chart-legend paired-model-legend" role="group" aria-label="Highlight a model across both efficiency panels"></div>
    <div class="efficiency-panels">
      <div><svg class="planner-chart" id="pass-k-chart" viewBox="0 0 480 340" role="slider" tabindex="0" aria-label="Candidate budget k" aria-valuemin="1" aria-valuemax="32" aria-valuenow="3"></svg>
        <p class="paired-readout" id="pass-k-readout" aria-live="polite"></p></div>
      <div><svg class="planner-chart" id="pass-t-chart" viewBox="0 0 480 340" role="slider" tabindex="0" aria-label="Time budget in seconds" aria-valuemin="0" aria-valuemax="48" aria-valuenow="8"></svg>
        <p class="paired-readout" id="pass-t-readout" aria-live="polite"></p></div>
    </div><div class="protocol-legend"></div>`, 'Planning efficiency');
  let selectedEfficiencyModel = null;
  const panels = [];
  const setEfficiencyLegend = legend(efficiency, data.efficiency.colors, model => {
    selectedEfficiencyModel = selectedEfficiencyModel === model ? null : model;
    setEfficiencyLegend(selectedEfficiencyModel); dim(efficiency, selectedEfficiencyModel);
    panels.forEach(panel => panel.inspect(panel.value, selectedEfficiencyModel || model));
    dim(efficiency, selectedEfficiencyModel);
  });
  function probability(series, kind, value) {
    if (kind === 'k') return series.k[value-1][1];
    const f = series.latencies.filter(t => t <= value).length/series.latencies.length;
    return 1-(1-f*series.valid/series.n)**data.efficiency.workers;
  }
  for (const kind of ['k','t']) {
    const svg = efficiency.querySelector(`#pass-${kind}-chart`);
    const output = efficiency.querySelector(`#pass-${kind}-readout`);
    const min = kind === 'k' ? 1 : 0, max = kind === 'k' ? 32 : 48;
    const b = {left:64, right:466, top:18, bottom:280, height:340};
    b.x = v => b.left+(v-min)/(max-min)*(b.right-b.left);
    b.y = v => b.bottom-v/1.03*(b.bottom-b.top);
    axes(svg, b, kind === 'k' ? [1,5,10,15,20,25,30] : [0,10,20,30,40], [0,.2,.4,.6,.8,1],
      kind === 'k' ? 'k (candidates)' : 't (seconds)', `Pass@${kind}`, v => v.toFixed(1));
    for (const series of data.efficiency.series) {
      svg.append(svgNode('polyline', {points:series[kind].map(([x,y]) => `${b.x(x)},${b.y(y)}`).join(' '),
        'data-plot-model':series.model, class:'efficiency-curve', fill:'none', stroke:data.efficiency.colors[series.model],
        'stroke-width':2.8, 'stroke-dasharray':series.protocol ? 'none' : '8 5'}));
    }
    const cursor = svgNode('g', {'aria-hidden':'true', visibility:'hidden'});
    const line = svgNode('line', {y1:b.top, y2:b.bottom, stroke:'#888', 'stroke-dasharray':'3 3'});
    const dots = [true,false].map(flag => svgNode('circle', {r:4.5, fill:'white', 'stroke-width':2, 'stroke-dasharray':flag ? 'none' : '2 2'}));
    cursor.append(line, ...dots); svg.append(cursor);
    const panel = {value:kind === 'k' ? 3 : 8, inspect}; panels.push(panel);
    function inspect(value, model) {
      panel.value = value; cursor.setAttribute('visibility', 'visible');
      dim(efficiency, model);
      line.setAttribute('x1', b.x(value)); line.setAttribute('x2', b.x(value));
      const pair = data.efficiency.series.filter(s => s.model === model);
      output.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = `${model} · ${kind} = ${kind === 'k' ? value : value.toFixed(1)+' s'}`;
      output.append(title);
      pair.forEach((series, index) => {
        const prob = probability(series, kind, value);
        dots[index].setAttribute('cx',b.x(value)); dots[index].setAttribute('cy',b.y(prob));
        dots[index].setAttribute('stroke',data.efficiency.colors[model]);
        const text = document.createElement('span'); text.textContent = `${protocolName(series.protocol)}: ${percent(prob)}`; output.append(text);
      });
      svg.setAttribute('aria-valuenow', String(value));
      svg.setAttribute('aria-valuetext', output.textContent);
    }
    function move(event) {
      const p = coordinates(svg,event);
      if (p.x < b.left || p.x > b.right || p.y < b.top-8 || p.y > b.bottom+8) return;
      const raw = min+(p.x-b.left)/(b.right-b.left)*(max-min);
      const value = kind === 'k' ? Math.round(raw) : Math.round(raw*10)/10;
      const model = selectedEfficiencyModel || [...data.efficiency.series].sort((a,c) =>
        Math.abs(b.y(probability(a,kind,value))-p.y)-Math.abs(b.y(probability(c,kind,value))-p.y))[0].model;
      inspect(value,model);
    }
    svg.addEventListener('pointermove',move); svg.addEventListener('click',move);
    svg.addEventListener('focus', () => inspect(panel.value, selectedEfficiencyModel || 'Gemini-2.5-Pro'));
    svg.addEventListener('pointerleave', () => dim(efficiency,selectedEfficiencyModel));
    svg.addEventListener('keydown', event => {
      let value = panel.value;
      if (['ArrowLeft','ArrowDown'].includes(event.key)) value -= kind === 'k' ? 1 : .5;
      else if (['ArrowRight','ArrowUp'].includes(event.key)) value += kind === 'k' ? 1 : .5;
      else if (event.key === 'Home') value = min;
      else if (event.key === 'End') value = max;
      else return;
      event.preventDefault(); inspect(Math.max(min,Math.min(max,value)), selectedEfficiencyModel || 'Gemini-2.5-Pro');
    });
  }
  efficiency.addEventListener('keydown', event => {
    if (event.key === 'Escape') { selectedEfficiencyModel = null; setEfficiencyLegend(null); dim(efficiency,null); }
  });
  styles(efficiency);
};
