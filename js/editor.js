(function () {
  'use strict';

  var previewCanvas = document.getElementById('preview');
  var tooltip = document.getElementById('tooltip');
  var treeRoot = document.getElementById('tree-root');
  var chart = new MultiLevelDonutChart(previewCanvas, {
    onHover: onHover
  });

  var currentData = {
    title: '未命名图表',
    categories: []
  };

  var currentConfig = {};

  chart.loadData(currentData);

  function onHover(node, x, y, e) {
    if (!node || node.isEmpty) {
      tooltip.style.display = 'none';
      return;
    }
    var pct = chart._getPercentage(node);
    tooltip.innerHTML =
      '<div class="tip-name"><span class="tip-color" style="background:' + node.color + '"></span>' + node.node.name + '</div>' +
      '<div class="tip-row">数值: ' + node.node.value.toLocaleString() + '</div>' +
      '<div class="tip-row">同级占比: ' + pct.toFixed(1) + '%</div>';
    if (e) {
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top = (e.clientY + 16) + 'px';
      tooltip.style.display = 'block';
    }
  }

  document.addEventListener('mousemove', function (e) {
    if (!tooltip.style.display || tooltip.style.display === 'none') return;
    var dist = 0;
    var px = parseInt(tooltip.style.left) || 0;
    var py = parseInt(tooltip.style.top) || 0;
    dist = Math.sqrt(Math.pow(e.clientX + 16 - px, 2) + Math.pow(e.clientY + 16 - py, 2));
    if (dist > 30) tooltip.style.display = 'none';
  });

  // ── Build Tree ──

  function buildTree() {
    treeRoot.innerHTML = '';
    for (var i = 0; i < currentData.categories.length; i++) {
      treeRoot.appendChild(buildNode(currentData.categories[i], i, 'categories', null));
    }
  }

  function buildNode(node, index, parentPath, parentNode) {
    var container = document.createElement('div');
    container.className = 'tree-node';

    var row = document.createElement('div');
    row.className = 'tree-row';

    var depth = getDepth(parentPath);
    var indent = document.createElement('span');
    indent.className = 'indent';
    indent.textContent = depth > 0 ? ' '.repeat(depth * 2) + '└' : '';
    row.appendChild(indent);

    var expand = document.createElement('span');
    expand.className = 'expand';
    if (node.children && node.children.length > 0) {
      expand.textContent = 'v';
      var childrenContainer;
      (function () {
        expand.addEventListener('click', function () {
          if (childrenContainer.classList.contains('collapsed')) {
            childrenContainer.classList.remove('collapsed');
            expand.textContent = 'v';
          } else {
            childrenContainer.classList.add('collapsed');
            expand.textContent = '>';
          }
        });
      })();
    }
    row.appendChild(expand);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'name';
    nameInput.value = node.name;
    nameInput.placeholder = '名称';
    nameInput.addEventListener('input', function () {
      node.name = nameInput.value;
      refresh();
    });
    row.appendChild(nameInput);

    var valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'val';
    valInput.value = String(node.value);
    valInput.placeholder = '数值';
    valInput.addEventListener('input', function () {
      var v = parseFloat(valInput.value);
      node.value = isNaN(v) ? 0 : v;
      refresh();
    });
    row.appendChild(valInput);

    var colorInput = document.createElement('input');
    colorInput.type = 'text';
    colorInput.className = 'color';
    colorInput.value = node.color || '';
    colorInput.placeholder = '#色值';
    colorInput.addEventListener('input', function () {
      node.color = colorInput.value || undefined;
      refresh();
    });
    row.appendChild(colorInput);

    var addBtn = document.createElement('button');
    addBtn.className = 'btn-sm add';
    addBtn.textContent = '+子';
    addBtn.title = '添加子分类';
    (function () {
      addBtn.addEventListener('click', function () {
        if (!node.children) node.children = [];
        node.children.push({ name: '新分类', value: 100 });
        refresh();
        buildTree();
      });
    })();
    row.appendChild(addBtn);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-sm del';
    delBtn.textContent = 'x';
    delBtn.title = '删除此分类';
    (function () {
      delBtn.addEventListener('click', function () {
        if (confirm('确定删除 "' + node.name + '"？')) {
          removeNode(node, parentPath, index);
          refresh();
          buildTree();
        }
      });
    })();
    row.appendChild(delBtn);

    container.appendChild(row);

    if (node.children && node.children.length > 0) {
      var childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      for (var i = 0; i < node.children.length; i++) {
        var childPath = parentPath + '.children[' + index + '].children';
        childrenContainer.appendChild(buildNode(node.children[i], i, childPath, node));
      }
      container.appendChild(childrenContainer);
      // Store reference for collapse toggle
      container._childrenEl = childrenContainer;
    } else {
      container._childrenEl = null;
    }

    container._rowEl = row;
    container._childrenContainer = container.querySelector('.tree-children');

    return container;
  }

  function getDepth(path) {
    if (!path) return 0;
    return (path.match(/\.children/g) || []).length;
  }

  function removeNode(node, parentPath, index) {
    if (parentPath === 'categories') {
      currentData.categories.splice(index, 1);
    } else {
      // Navigate to parent and remove
      var parts = parentPath.split('.');
      var target = currentData;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part === 'categories') continue;
        var m = part.match(/(\w+)\[(\d+)\]/);
        if (m) {
          if (!target[m[1]]) return;
          target = target[m[1]][parseInt(m[2])];
        }
      }
      if (target.children) {
        target.children.splice(index, 1);
      }
    }
  }

  document.getElementById('btn-add-root').addEventListener('click', function () {
    currentData.categories.push({ name: '新分类', value: 100 });
    refresh();
    buildTree();
  });

  // ── Config Panel ──

  var configInputs = {
    centerRadius: { el: 'cfg-centerRadius', val: 'val-centerRadius', prop: 'centerRadius', default: 60 },
    ringWidth: { el: 'cfg-ringWidth', val: 'val-ringWidth', prop: 'ringWidth', default: 36 },
    gapWidth: { el: 'cfg-gapWidth', val: 'val-gapWidth', prop: 'gapWidth', default: 6 },
    segmentGap: { el: 'cfg-segmentGap', val: 'val-segmentGap', prop: 'segmentGap', default: 1.5 },
    labelMinAngle: { el: 'cfg-labelMinAngle', val: 'val-labelMinAngle', prop: 'labelMinAngle', default: 15 }
  };

  for (var key in configInputs) {
    (function (k, info) {
      var slider = document.getElementById(info.el);
      var display = document.getElementById(info.val);
      if (slider) {
        slider.addEventListener('input', function () {
          var val = parseFloat(slider.value);
          currentConfig[info.prop] = val;
          if (display) {
            display.textContent = info.prop === 'labelMinAngle' ? val + '°' : val;
          }
          chart.updateConfig(currentConfig);
        });
      }
    })(key, configInputs[key]);
  }

  document.getElementById('cfg-labelShow').addEventListener('change', function () {
    currentConfig.labelShow = this.checked;
    chart.updateConfig(currentConfig);
  });

  document.getElementById('cfg-labelFontSize').addEventListener('input', function () {
    var val = parseInt(this.value);
    document.getElementById('val-labelFontSize').textContent = val;
    currentConfig.labelFont = val + 'px "Microsoft YaHei", "PingFang SC", sans-serif';
    chart.updateConfig(currentConfig);
  });

  // ── Toolbar ──

  document.getElementById('btn-export').addEventListener('click', function () {
    var data = JSON.parse(JSON.stringify(currentData));
    if (Object.keys(currentConfig).length > 0) {
      data.config = data.config || {};
      for (var k in currentConfig) {
        if (currentConfig.hasOwnProperty(k)) {
          data.config[k] = currentConfig[k];
        }
      }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-import').addEventListener('click', function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          currentData = data;
          currentConfig = data.config || {};
          updateConfigUI();
          buildTree();
          refresh();
        } catch (err) {
          alert('JSON 解析失败: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  document.getElementById('sample-select').addEventListener('change', function () {
    var val = this.value;
    if (!val) return;
    this.value = '';

    function useData(data) {
      currentData = JSON.parse(JSON.stringify(data));
      currentConfig = data.config || {};
      updateConfigUI();
      buildTree();
      refresh();
    }

    fetch('data/' + val + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        useData(data);
      })
      .catch(function (err) {
        console.warn('Fetch failed, using embedded sample:', err.message);
        if (window.SAMPLE_DATA && window.SAMPLE_DATA[val]) {
          useData(window.SAMPLE_DATA[val]);
        }
      });
  });

  document.getElementById('btn-clear').addEventListener('click', function () {
    if (confirm('确定清空所有数据？')) {
      currentData = { title: '未命名图表', categories: [] };
      currentConfig = {};
      updateConfigUI();
      buildTree();
      refresh();
    }
  });

  // ── Tabs ──

  document.getElementById('tab-bar').addEventListener('click', function (e) {
    if (e.target.classList.contains('tab-btn')) {
      var tab = e.target.getAttribute('data-tab');
      var buttons = document.querySelectorAll('#tab-bar .tab-btn');
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
      e.target.classList.add('active');

      var panels = document.querySelectorAll('#tab-content .tab-panel');
      for (var j = 0; j < panels.length; j++) panels[j].classList.remove('active');
      document.getElementById('panel-' + tab).classList.add('active');
    }
  });

  function updateConfigUI() {
    for (var key in configInputs) {
      var info = configInputs[key];
      var slider = document.getElementById(info.el);
      var display = document.getElementById(info.val);
      if (slider && currentConfig[info.prop] !== undefined) {
        slider.value = currentConfig[info.prop];
        if (display) {
          display.textContent = info.prop === 'labelMinAngle' ? currentConfig[info.prop] + '°' : currentConfig[info.prop];
        }
      }
    }
    var cbShow = document.getElementById('cfg-labelShow');
    if (cbShow && currentConfig.labelShow !== undefined) {
      cbShow.checked = currentConfig.labelShow;
    }
  }

  // ── Refresh ──

  var refreshTimer;
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      chart.loadData(currentData);
      if (Object.keys(currentConfig).length > 0) {
        chart.updateConfig(currentConfig);
      }
      requestAnimationFrame(function () {
        chart.refresh();
      });
    }, 200);
  }

  window.addEventListener('resize', function () {
    chart.refresh();
  });

  // Initial
  buildTree();
  requestAnimationFrame(function () {
    chart.refresh();
    // Retry once more if canvas not sized
    setTimeout(function () {
      chart.refresh();
    }, 300);
  });

})();
