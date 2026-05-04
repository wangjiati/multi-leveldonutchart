(function () {
  'use strict';

  var canvas = document.getElementById('chart');
  var tooltip = document.getElementById('tooltip');
  var breadcrumb = document.getElementById('breadcrumb');
  var legendList = document.getElementById('legend-list');
  var themeBtns = document.getElementById('theme-btns');
  var body = document.body;

  var chart = new MultiLevelDonutChart(canvas, {
    onHover: onHover,
    onClick: onClick,
    onDrillDown: onDrillDown,
    onDrillUp: onDrillUp
  });

  var sample = getParam('sample') || 'supermarket';
  var currentTheme = 'dark';

  function getParam(name) {
    var m = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function loadDefaultData() {
    chart.loadData(DEFAULT_DATA);
    onDataLoaded();
  }

  function loadData(url) {
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        chart.loadData(data);
        onDataLoaded();
      })
      .catch(function (err) {
        console.warn('Fetch failed, using embedded data:', err.message);
        loadDefaultData();
      });
  }

  function onDataLoaded() {
    updateLegend();
    updateBreadcrumb();
    document.querySelector('#toolbar .title').textContent = chart.data.title || '多圈圆环图';
    retryRender();
  }

  function retryRender() {
    var attempts = 0;
    function check() {
      if (chart.displayWidth === 0 || chart.displayHeight === 0) {
        chart.refresh();
        if (++attempts < 10) requestAnimationFrame(check);
      }
    }
    requestAnimationFrame(check);
  }

  requestAnimationFrame(function () {
    chart.refresh();
    loadData('data/' + sample + '.json');
    buildThemeButtons();
    initSettings();
  });

  // ── Theme ──

  function buildThemeButtons() {
    var themes = MultiLevelDonutChart.getThemes();
    themeBtns.innerHTML = '';
    for (var i = 0; i < themes.length; i++) {
      var t = themes[i];
      var btn = document.createElement('button');
      btn.className = 'theme-btn' + (t.id === currentTheme ? ' active' : '');
      btn.textContent = t.name;
      btn.setAttribute('data-theme', t.id);
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-theme');
        currentTheme = id;
        chart.applyTheme(id);
        applyPageTheme(id);
        var btns = themeBtns.querySelectorAll('.theme-btn');
        for (var b = 0; b < btns.length; b++) btns[b].classList.remove('active');
        this.classList.add('active');
        updateSettingsFromConfig();
      });
      themeBtns.appendChild(btn);
    }
  }

  function applyPageTheme(id) {
    var bg = chart.config.backgroundColor;
    body.style.background = bg;
    document.getElementById('toolbar').style.background = bg === '#f5f5f5' ? '#eee' : '#16162a';
    document.getElementById('right-panel').style.background = bg === '#f5f5f5' ? '#eee' : '#16162a';
  }

  // ── Settings ──

  function initSettings() {
    bindRange('cfg-centerRadius', 'val-centerRadius', 'centerRadius', function(v) { chart.updateConfig({ centerRadius: v }); });
    bindRange('cfg-ringWidth', 'val-ringWidth', 'ringWidth', function(v) { chart.updateConfig({ ringWidth: v }); });
    bindRange('cfg-gapWidth', 'val-gapWidth', 'gapWidth', function(v) { chart.updateConfig({ gapWidth: v }); });
    bindRange('cfg-fontSize', 'val-fontSize', null, function(v) {
      chart.updateConfig({ labelFont: v + 'px "Microsoft YaHei", "PingFang SC", sans-serif' });
    });

    var labelColor = document.getElementById('cfg-labelColor');
    labelColor.addEventListener('input', function () {
      chart.updateConfig({ labelColor: this.value });
    });
  }

  function bindRange(sliderId, valId, prop, onChange) {
    var slider = document.getElementById(sliderId);
    var disp = document.getElementById(valId);
    if (!slider) return;
    slider.addEventListener('input', function () {
      var v = parseInt(this.value);
      disp.textContent = v;
      onChange(v);
    });
  }

  function updateSettingsFromConfig() {
    var cfg = chart.config;
    setSlider('cfg-centerRadius', 'val-centerRadius', cfg.centerRadius);
    setSlider('cfg-ringWidth', 'val-ringWidth', cfg.ringWidth);
    setSlider('cfg-gapWidth', 'val-gapWidth', cfg.gapWidth);
    var m = cfg.labelFont.match(/(\d+)px/);
    if (m) setSlider('cfg-fontSize', 'val-fontSize', parseInt(m[1]));
    document.getElementById('cfg-labelColor').value = cfg.labelColor || '#e0e0e0';
  }

  function setSlider(sliderId, valId, value) {
    var s = document.getElementById(sliderId);
    var d = document.getElementById(valId);
    if (s) s.value = value;
    if (d) d.textContent = value;
  }

  // ── Tooltip ──

  function onHover(node, x, y, e) {
    if (!node || node.isEmpty) {
      tooltip.style.display = 'none';
      return;
    }
    var name = node.node.name;
    var value = node.node.value;
    var pct = chart._getPercentage(node);
    var totalLabel = node.depth === 0 ? '总占比' : '占父级比';

    tooltip.innerHTML =
      '<div class="tip-name"><span class="tip-color" style="background:' + node.color + '"></span>' + name + '</div>' +
      '<div class="tip-row">数值: ' + value.toLocaleString() + '</div>' +
      '<div class="tip-row">' + totalLabel + ': ' + pct.toFixed(1) + '%</div>' +
      '<div class="tip-row">层级: 第' + (node.depth + 1) + '层</div>';

    if (e) {
      var tx = e.clientX + 16, ty = e.clientY + 16;
      if (tx + 200 > window.innerWidth) tx = e.clientX - 200;
      if (ty + 100 > window.innerHeight) ty = e.clientY - 100;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    }
    tooltip.style.display = 'block';
  }

  // ── Click / Drill ──

  function onClick(node) {}
  function onDrillDown(node) { updateBreadcrumb(node); updateLegend(); }
  function onDrillUp() { updateBreadcrumb(); updateLegend(); }

  function updateBreadcrumb(node) {
    if (!node) { breadcrumb.innerHTML = ''; return; }
    var parts = [];
    var current = node;
    while (current) {
      parts.unshift({ id: current.id, name: current.node.name });
      if (current.parentId) current = chart._findSegmentById(current.parentId);
      else current = null;
    }
    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) html.push('<span class="arrow">></span>');
      if (i === parts.length - 1) html.push('<span class="current">' + parts[i].name + '</span>');
      else html.push('<span data-id="' + parts[i].id + '">' + parts[i].name + '</span>');
    }
    breadcrumb.innerHTML = html.join('');
    var clicks = breadcrumb.querySelectorAll('span[data-id]');
    for (var j = 0; j < clicks.length; j++) {
      (function (id) {
        clicks[j].addEventListener('click', function () {
          var seg = chart._findSegmentById(id);
          if (seg) chart.drillDown(seg);
        });
      })(clicks[j].getAttribute('data-id'));
    }
  }

  // ── Hierarchical Legend ──

  function updateLegend() {
    if (!chart.data || !chart.data.categories) return;
    var focusId = chart.focusedNode ? chart.focusedNode.id : null;
    legendList.innerHTML = '';

    for (var i = 0; i < chart.data.categories.length; i++) {
      var cat = chart.data.categories[i];
      legendList.appendChild(buildLegendNode(cat, i, 0, focusId));
    }
  }

  function buildLegendNode(node, index, depth, focusId) {
    var nid = chart._nodeId(node);
    var visible = !chart.hiddenIds[nid];
    var color = node.color || chart.config.colors[index % chart.config.colors.length];
    var hasChildren = node.children && node.children.length > 0;

    var div = document.createElement('div');
    div.className = 'legend-item' + (visible ? '' : ' hidden');

    var exp = document.createElement('span');
    exp.className = 'exp';
    exp.textContent = '▸';
    exp.style.visibility = hasChildren ? 'visible' : 'hidden';
    div.appendChild(exp);

    var swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = visible ? color : '#333';
    div.appendChild(swatch);

    var lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = node.name;
    div.appendChild(lbl);

    var val = document.createElement('span');
    val.className = 'lval';
    val.textContent = node.value.toLocaleString();
    div.appendChild(val);

    // Toggle visibility on row click
    div.addEventListener('click', function (e) {
      e.stopPropagation();
      chart.toggleLegend(nid);
      updateLegend();
      updateBreadcrumb();
    });

    // Children - always present, collapsed by default
    if (hasChildren) {
      var childrenDiv = document.createElement('div');
      childrenDiv.className = 'legend-children collapsed';
      for (var i = 0; i < node.children.length; i++) {
        childrenDiv.appendChild(buildLegendNode(node.children[i], i, depth + 1, focusId));
      }
      div.appendChild(childrenDiv);

      // Arrow toggles expand/collapse (without toggling visibility)
      exp.addEventListener('click', function (e) {
        e.stopPropagation();
        if (childrenDiv.classList.contains('collapsed')) {
          childrenDiv.classList.remove('collapsed');
          exp.textContent = '▾';
        } else {
          childrenDiv.classList.add('collapsed');
          exp.textContent = '▸';
        }
      });
    }

    return div;
  }

  // Legend reset
  document.getElementById('legend-reset').addEventListener('click', function () {
    chart.hiddenIds = {};
    chart.focusedNode = null;
    chart.maxDepth = 0;
    if (chart.data && chart.data.categories) {
      chart._computeMaxDepth(chart.data.categories, 0);
    }
    chart._computeLayout();
    chart.render();
    updateLegend();
    updateBreadcrumb();
  });

  // ── Toolbar ──

  document.getElementById('btn-svg').addEventListener('click', function () {
    downloadText(chart.exportSVG(), sample + '.svg', 'image/svg+xml');
  });
  document.getElementById('btn-png').addEventListener('click', function () {
    chart.exportPNG(function (blob) { downloadBlob(blob, sample + '.png'); }, 2);
  });
  document.getElementById('btn-reset').addEventListener('click', function () {
    chart.resetFocus();
    updateBreadcrumb();
    updateLegend();
  });
  document.getElementById('btn-help').addEventListener('click', function () {
    document.getElementById('help-overlay').classList.add('show');
  });
  document.getElementById('help-close').addEventListener('click', function () {
    document.getElementById('help-overlay').classList.remove('show');
  });
  document.getElementById('help-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
  });

  function downloadText(content, filename, mime) {
    downloadBlob(new Blob([content], { type: mime || 'text/plain' }), filename);
  }
  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── Resize ──
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { chart.refresh(); }, 150);
  });

})();
