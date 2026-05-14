const STAGES = {
  intro:   { variable: null,               title: 'The feedback loop',          subtitle: 'CONUS · CMIP6 · CESM2' },
  warming: { variable: 'tas',              title: 'Temperature',                subtitle: 'Annual mean · °C' },
  drying:  { variable: 'mrsos',            title: 'Surface soil moisture',      subtitle: 'Annual mean · kg/m²' },
  burning: { variable: 'burntFractionAll', title: 'Burnt area',                 subtitle: 'Annual mean · % of land' },
  loop:    { variable: 'loop',             title: 'The loop closes',            subtitle: 'Schematic' },
  end:     { variable: 'all',              title: 'Two futures',                subtitle: 'All variables · normalized' }
};

const MARGINS = { top: 30, right: 70, bottom: 40, left: 56 };
const COLOR = {
  historical: '#b8a895',
  ssp126:     '#87ceeb',
  ssp585:     '#ff7849'
};

let chartW, chartH, svg, gAxis, data, currentStage = 'intro';

async function init() {
  data = await d3.csv('data/feedback_loop.csv', d => ({
    year: +d.year,
    experiment: d.experiment,
    tas: d.tas === '' ? null : +d.tas,
    mrsos: d.mrsos === '' ? null : +d.mrsos,
    burntFractionAll: d.burntFractionAll === '' ? null : +d.burntFractionAll,
    tas_smooth: d.tas_smooth === '' ? null : +d.tas_smooth,
    mrsos_smooth: d.mrsos_smooth === '' ? null : +d.mrsos_smooth,
    burntFractionAll_smooth: d.burntFractionAll_smooth === '' ? null : +d.burntFractionAll_smooth
  }));

  buildLegend();
  buildChart();
  setupObserver();

  window.addEventListener('resize', () => {
    d3.select('#chart svg').remove();
    buildChart();
    renderStage(currentStage);
  });
}

function buildLegend() {
  const legend = d3.select('#legend');
  legend.html('');
  [
    { key: 'historical', label: 'Historical (1995–2014)', cls: 'swatch-hist' },
    { key: 'ssp126',     label: 'SSP1-2.6 · low emissions', cls: 'swatch-126' },
    { key: 'ssp585',     label: 'SSP5-8.5 · high emissions', cls: 'swatch-585' }
  ].forEach(d => {
    const item = legend.append('div').attr('class', `legend-item ${d.key}-legend`);
    item.append('div').attr('class', `legend-swatch ${d.cls}`);
    item.append('span').text(d.label);
  });
}

function buildChart() {
  const container = document.getElementById('chart');
  const rect = container.getBoundingClientRect();
  chartW = rect.width;
  chartH = rect.height;

  svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${chartW} ${chartH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', 'warmGlow')
    .attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#ff7849').attr('stop-opacity', '0.4');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#ff7849').attr('stop-opacity', '0');

  svg.append('g').attr('class', 'axis x-axis');
  svg.append('g').attr('class', 'axis y-axis');
  svg.append('g').attr('class', 'baselines');
  svg.append('g').attr('class', 'areas');
  svg.append('g').attr('class', 'lines-raw');
  svg.append('g').attr('class', 'lines-smooth');
  svg.append('g').attr('class', 'labels');
  svg.append('g').attr('class', 'overlay-loop');
}

function renderStage(stage) {
  currentStage = stage;
  const cfg = STAGES[stage];

  d3.select('#vizTitle').text(cfg.title);
  d3.select('#vizSubtitle').text(cfg.subtitle);

  if (stage === 'loop') {
    renderLoopDiagram();
    return;
  }

  d3.select('.overlay-loop').selectAll('*').remove();

  if (stage === 'intro') {
    renderIntro();
    return;
  }

  if (stage === 'end') {
    renderEndState();
    return;
  }

  renderTimeSeries(cfg.variable);
}

function renderIntro() {
  highlightLegend(['historical', 'ssp126', 'ssp585']);

  const innerW = chartW - MARGINS.left - MARGINS.right;
  const innerH = chartH - MARGINS.top - MARGINS.bottom;

  const x = d3.scaleLinear().domain([1995, 2100]).range([MARGINS.left, chartW - MARGINS.right]);
  const y = d3.scaleLinear().domain([13, 22]).range([chartH - MARGINS.bottom, MARGINS.top]);

  drawAxes(x, y, 'Temperature · °C');

  const line = d3.line()
    .defined(d => d.tas_smooth != null)
    .x(d => x(d.year))
    .y(d => y(d.tas_smooth))
    .curve(d3.curveMonotoneX);

  const grouped = d3.group(data, d => d.experiment);

  const linesSmooth = d3.select('.lines-smooth').selectAll('path').data(['historical', 'ssp126', 'ssp585']);
  linesSmooth.exit().remove();
  linesSmooth.enter().append('path')
    .attr('class', d => `line line-${d}`)
    .attr('d', d => line(grouped.get(d) || []))
    .style('opacity', 0)
    .transition().duration(900).delay((d, i) => i * 200)
    .style('opacity', 0.85);

  linesSmooth
    .attr('d', d => line(grouped.get(d) || []))
    .transition().duration(600).style('opacity', 0.85);

  d3.select('.lines-raw').selectAll('*').remove();
  d3.select('.labels').selectAll('*').remove();
  d3.select('.areas').selectAll('*').remove();
}

function renderTimeSeries(variable) {
  const innerW = chartW - MARGINS.left - MARGINS.right;
  const innerH = chartH - MARGINS.top - MARGINS.bottom;

  const smoothKey = `${variable}_smooth`;
  const allVals = data.map(d => d[variable]).filter(v => v != null);
  let yDomain;
  let yLabel;
  let unit;

  if (variable === 'tas') {
    yDomain = [13, 22.5];
    yLabel = 'Temperature · °C';
    unit = '°C';
  } else if (variable === 'mrsos') {
    yDomain = [25, 30];
    yLabel = 'Soil moisture · kg/m²';
    unit = '';
  } else {
    yDomain = [0, 0.28];
    yLabel = 'Burnt area · %';
    unit = '%';
  }

  const x = d3.scaleLinear().domain([1995, 2100]).range([MARGINS.left, chartW - MARGINS.right]);
  const y = d3.scaleLinear().domain(yDomain).range([chartH - MARGINS.bottom, MARGINS.top]);

  drawAxes(x, y, yLabel);

  const grouped = d3.group(data, d => d.experiment);

  // Baseline (1995-2014 historical mean)
  const baselineVal = d3.mean(grouped.get('historical'), d => d[variable]);

  const baseG = d3.select('.baselines').selectAll('line.baseline').data([baselineVal]);
  baseG.exit().remove();
  baseG.enter().append('line').attr('class', 'baseline')
    .merge(baseG)
    .transition().duration(600)
    .attr('x1', x(1995)).attr('x2', x(2100))
    .attr('y1', y(baselineVal)).attr('y2', y(baselineVal));

  const baseLabel = d3.select('.baselines').selectAll('text.baseline-label').data([baselineVal]);
  baseLabel.exit().remove();
  baseLabel.enter().append('text').attr('class', 'baseline-label')
    .merge(baseLabel)
    .attr('x', x(1995) + 6).attr('y', y(baselineVal) - 4)
    .style('font-family', 'JetBrains Mono, monospace')
    .style('font-size', '9px')
    .style('fill', '#7a6555')
    .style('letter-spacing', '0.05em')
    .text(`1995–2014 baseline`);

  // Raw jagged lines (faint)
  const lineRaw = d3.line()
    .defined(d => d[variable] != null)
    .x(d => x(d.year))
    .y(d => y(d[variable]))
    .curve(d3.curveLinear);

  const rawSel = d3.select('.lines-raw').selectAll('path').data(['historical', 'ssp126', 'ssp585'], d => d);
  rawSel.exit().remove();
  rawSel.enter().append('path').attr('class', d => `line-raw line-${d}`)
    .merge(rawSel)
    .transition().duration(600)
    .attr('d', d => lineRaw(grouped.get(d) || []));

  // Smoothed lines (bold)
  const lineSmooth = d3.line()
    .defined(d => d[smoothKey] != null)
    .x(d => x(d.year))
    .y(d => y(d[smoothKey]))
    .curve(d3.curveMonotoneX);

  const smoothSel = d3.select('.lines-smooth').selectAll('path').data(['historical', 'ssp126', 'ssp585'], d => d);
  smoothSel.exit().remove();
  smoothSel.enter().append('path').attr('class', d => `line line-${d}`)
    .merge(smoothSel)
    .transition().duration(800)
    .attr('d', d => lineSmooth(grouped.get(d) || []))
    .style('opacity', 0.9);

  // End-of-century labels
  const endLabels = [];
  ['ssp126', 'ssp585'].forEach(exp => {
    const series = grouped.get(exp);
    if (!series) return;
    const last = series[series.length - 1];
    const v = last[smoothKey] != null ? last[smoothKey] : last[variable];
    if (v == null) return;
    const delta = ((v - baselineVal) / baselineVal) * 100;
    const sign = delta >= 0 ? '+' : '';
    endLabels.push({
      exp, value: v, year: last.year,
      label: variable === 'burntFractionAll'
        ? `${(v / baselineVal).toFixed(1)}×`
        : `${sign}${(v - baselineVal).toFixed(variable === 'tas' ? 1 : 2)}${unit}`
    });
  });

  const labelSel = d3.select('.labels').selectAll('text.end-label').data(endLabels, d => d.exp);
  labelSel.exit().remove();
  const labelEnter = labelSel.enter().append('text')
    .attr('class', d => `end-label label-${d.exp}`)
    .style('fill', d => COLOR[d.exp]);

  labelEnter.merge(labelSel)
    .attr('x', d => x(d.year) + 8)
    .attr('y', d => y(d.value) + 3)
    .text(d => d.label)
    .style('opacity', 0)
    .transition().delay(700).duration(500)
    .style('opacity', 1);

  // Highlight area for SSP585 if burning stage
  const areaSel = d3.select('.areas').selectAll('path').data([null]);
  areaSel.exit().remove();

  if (variable === 'burntFractionAll') {
    const ssp585 = grouped.get('ssp585') || [];
    const area = d3.area()
      .defined(d => d[smoothKey] != null)
      .x(d => x(d.year))
      .y0(y(baselineVal))
      .y1(d => y(d[smoothKey]))
      .curve(d3.curveMonotoneX);
    const a = areaSel.enter().append('path').attr('class', 'area-fill')
      .attr('fill', 'url(#warmGlow)');
    a.merge(areaSel)
      .attr('d', area(ssp585))
      .transition().duration(700).style('opacity', 0.35);
  } else {
    areaSel.remove();
  }

  // Highlight strategy
  if (variable === 'tas') {
    highlightLegend(['historical', 'ssp126', 'ssp585']);
  } else if (variable === 'mrsos') {
    highlightLegend(['ssp585', 'ssp126']);
  } else if (variable === 'burntFractionAll') {
    highlightLegend(['ssp585']);
  }
}

function renderEndState() {
  highlightLegend(['ssp126', 'ssp585']);

  d3.select('.lines-raw').selectAll('*').remove();
  d3.select('.lines-smooth').selectAll('*').remove();
  d3.select('.labels').selectAll('*').remove();
  d3.select('.areas').selectAll('*').remove();
  d3.select('.baselines').selectAll('*').remove();
  d3.select('.x-axis').selectAll('*').remove();
  d3.select('.y-axis').selectAll('*').remove();

  // Normalized small-multiples view
  const variables = [
    { key: 'tas', label: 'Temperature', unit: '°C' },
    { key: 'mrsos', label: 'Soil moisture', unit: 'kg/m²' },
    { key: 'burntFractionAll', label: 'Burnt area', unit: '%' }
  ];

  const padding = 24;
  const usableH = chartH - 24;
  const sectionH = (usableH - padding * (variables.length - 1)) / variables.length;

  const overlay = d3.select('.overlay-loop');
  overlay.selectAll('*').remove();

  const x = d3.scaleLinear().domain([1995, 2100]).range([MARGINS.left, chartW - MARGINS.right]);
  const grouped = d3.group(data, d => d.experiment);

  variables.forEach((v, i) => {
    const yTop = 12 + i * (sectionH + padding);
    const yBot = yTop + sectionH;
    const smoothKey = `${v.key}_smooth`;

    const allVals = data.map(d => d[v.key]).filter(x => x != null);
    let y;
    if (v.key === 'tas') y = d3.scaleLinear().domain([13, 22.5]).range([yBot, yTop]);
    else if (v.key === 'mrsos') y = d3.scaleLinear().domain([25, 30]).range([yBot, yTop]);
    else y = d3.scaleLinear().domain([0, 0.28]).range([yBot, yTop]);

    const line = d3.line()
      .defined(d => d[smoothKey] != null)
      .x(d => x(d.year))
      .y(d => y(d[smoothKey]))
      .curve(d3.curveMonotoneX);

    overlay.append('text')
      .attr('x', MARGINS.left).attr('y', yTop - 4)
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px')
      .style('letter-spacing', '0.06em')
      .style('text-transform', 'uppercase')
      .style('fill', '#b8a895')
      .text(v.label);

    overlay.append('line')
      .attr('x1', MARGINS.left).attr('x2', chartW - MARGINS.right)
      .attr('y1', yBot).attr('y2', yBot)
      .style('stroke', '#4a2d20').style('stroke-width', 0.5);

    ['historical', 'ssp126', 'ssp585'].forEach(exp => {
      const series = grouped.get(exp);
      if (!series) return;
      overlay.append('path')
        .attr('d', line(series))
        .attr('fill', 'none')
        .attr('stroke', COLOR[exp])
        .attr('stroke-width', 1.4)
        .style('opacity', 0)
        .transition().duration(900).delay(i * 200)
        .style('opacity', 0.92);
    });

    // End value labels
    ['ssp126', 'ssp585'].forEach(exp => {
      const series = grouped.get(exp);
      if (!series) return;
      const last = series[series.length - 1];
      const val = last[smoothKey] != null ? last[smoothKey] : last[v.key];
      if (val == null) return;
      overlay.append('text')
        .attr('x', x(last.year) + 6).attr('y', y(val) + 3)
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '9px')
        .style('fill', COLOR[exp])
        .style('opacity', 0)
        .text(v.key === 'burntFractionAll' ? val.toFixed(2) + '%' : val.toFixed(1) + (v.key === 'tas' ? '°' : ''))
        .transition().duration(500).delay(i * 200 + 800).style('opacity', 1);
    });
  });

  // X axis at bottom
  overlay.append('text')
    .attr('x', MARGINS.left).attr('y', usableH + 14)
    .style('font-family', 'JetBrains Mono, monospace')
    .style('font-size', '9px')
    .style('fill', '#7a6555')
    .text('1995');
  overlay.append('text')
    .attr('x', chartW - MARGINS.right).attr('y', usableH + 14).attr('text-anchor', 'end')
    .style('font-family', 'JetBrains Mono, monospace')
    .style('font-size', '9px')
    .style('fill', '#7a6555')
    .text('2100');
}

function renderLoopDiagram() {
  d3.select('.lines-raw').selectAll('*').remove();
  d3.select('.lines-smooth').selectAll('*').remove();
  d3.select('.labels').selectAll('*').remove();
  d3.select('.areas').selectAll('*').remove();
  d3.select('.baselines').selectAll('*').remove();
  d3.select('.x-axis').selectAll('*').remove();
  d3.select('.y-axis').selectAll('*').remove();

  const overlay = d3.select('.overlay-loop');
  overlay.selectAll('*').remove();

  const cx = chartW / 2, cy = chartH / 2, r = Math.min(chartW, chartH) * 0.32;
  const nodes = [
    { label: 'Warmer air',      angle: -Math.PI / 2, color: '#ff7849' },
    { label: 'Drier soil',      angle: 0,             color: '#f2a623' },
    { label: 'More fire',       angle: Math.PI / 2,   color: '#e8593c' },
    { label: 'More CO₂',        angle: Math.PI,       color: '#fcde5a' }
  ];

  // Arc paths between nodes
  for (let i = 0; i < nodes.length; i++) {
    const start = nodes[i];
    const end = nodes[(i + 1) % nodes.length];
    const x1 = cx + Math.cos(start.angle) * r;
    const y1 = cy + Math.sin(start.angle) * r;
    const x2 = cx + Math.cos(end.angle) * r;
    const y2 = cy + Math.sin(end.angle) * r;

    overlay.append('path')
      .attr('d', `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`)
      .attr('fill', 'none')
      .attr('stroke', start.color)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '600')
      .attr('stroke-dashoffset', '600')
      .attr('opacity', 0.6)
      .transition().delay(i * 200).duration(800)
      .attr('stroke-dashoffset', '0');
  }

  // Nodes
  nodes.forEach((n, i) => {
    const x = cx + Math.cos(n.angle) * r;
    const y = cy + Math.sin(n.angle) * r;

    const g = overlay.append('g')
      .style('opacity', 0)
      .attr('transform', `translate(${x}, ${y})`);

    g.transition().delay(i * 200 + 400).duration(500).style('opacity', 1);

    g.append('circle')
      .attr('r', 38)
      .attr('fill', '#2a1810')
      .attr('stroke', n.color)
      .attr('stroke-width', 1);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('font-family', 'Fraunces, serif')
      .style('font-style', 'italic')
      .style('font-size', '13px')
      .style('fill', n.color)
      .text(n.label);
  });

  // Center label
  overlay.append('text')
    .attr('x', cx).attr('y', cy - 2)
    .attr('text-anchor', 'middle')
    .style('font-family', 'JetBrains Mono, monospace')
    .style('font-size', '9px')
    .style('letter-spacing', '0.12em')
    .style('fill', '#7a6555')
    .style('text-transform', 'uppercase')
    .style('opacity', 0)
    .text('positive feedback')
    .transition().delay(1500).duration(600).style('opacity', 1);

  overlay.append('text')
    .attr('x', cx).attr('y', cy + 14)
    .attr('text-anchor', 'middle')
    .style('font-family', 'Fraunces, serif')
    .style('font-style', 'italic')
    .style('font-size', '20px')
    .style('fill', '#ff7849')
    .style('opacity', 0)
    .text('amplifies')
    .transition().delay(1700).duration(600).style('opacity', 1);

  highlightLegend([]);
}

function drawAxes(x, y, yLabel) {
  const xAxis = d3.select('.x-axis')
    .attr('transform', `translate(0, ${chartH - MARGINS.bottom})`);
  xAxis.transition().duration(500).call(
    d3.axisBottom(x).tickValues([2000, 2025, 2050, 2075, 2100]).tickFormat(d3.format('d'))
  );

  const yAxis = d3.select('.y-axis')
    .attr('transform', `translate(${MARGINS.left}, 0)`);
  yAxis.transition().duration(500).call(
    d3.axisLeft(y).ticks(5)
  );

  let labelText = svg.select('.y-label');
  if (labelText.empty()) {
    labelText = svg.append('text').attr('class', 'y-label axis-label')
      .attr('transform', 'rotate(-90)');
  }
  labelText
    .attr('x', -(chartH / 2))
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .text(yLabel);
}

function highlightLegend(active) {
  d3.selectAll('.legend-item').classed('active', false);
  active.forEach(k => d3.select(`.${k}-legend`).classed('active', true));
}

function setupObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const step = entry.target.getAttribute('data-step');
        d3.selectAll('.step').classed('active', false);
        d3.select(entry.target).classed('active', true);
        renderStage(step);
      }
    });
  }, {
    threshold: 0.5,
    rootMargin: '-20% 0px -30% 0px'
  });

  document.querySelectorAll('.step').forEach(el => observer.observe(el));
}

init();
