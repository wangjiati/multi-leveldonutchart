/**
 * MultiLevelDonutChart - 多圈圆环图核心引擎
 * Pure Canvas 2D rendering, zero dependencies
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    ringWidth: 36,
    gapWidth: 6,
    centerRadius: 60,
    startAngle: -Math.PI / 2,
    padding: 20,
    colors: [
      '#4A90D9', '#E67E22', '#2ECC71', '#E74C3C', '#9B59B6',
      '#1ABC9C', '#F1C40F', '#00BCD4', '#E91E63', '#FF9800',
      '#795548', '#607D8B', '#8BC34A', '#FF5722', '#673AB7'
    ],
    labelShow: true,
    labelMinAngle: 15,
    labelFont: '12px "Microsoft YaHei", "PingFang SC", sans-serif',
    labelColor: '#e0e0e0',
    titleFont: 'bold 16px "Microsoft YaHei", "PingFang SC", sans-serif',
    titleColor: '#e0e0e0',
    blankColor: '#1a1a2e',
    blankStroke: '#2a2a4a',
    backgroundColor: '#0f0f23',
    tooltipEnabled: true,
    legendEnabled: true,
    dimOpacity: 0.2,
    segmentGap: 1.5
  };

  var THEMES = {
    dark: {
      backgroundColor: '#0f0f23',
      blankColor: '#1a1a2e',
      blankStroke: '#2a2a4a',
      labelColor: '#e0e0e0',
      titleColor: '#e0e0e0',
      colors: ['#4A90D9', '#E67E22', '#2ECC71', '#E74C3C', '#9B59B6', '#1ABC9C', '#F1C40F', '#00BCD4', '#E91E63', '#FF9800']
    },
    light: {
      backgroundColor: '#f5f5f5',
      blankColor: '#e8e8e8',
      blankStroke: '#d0d0d0',
      labelColor: '#333333',
      titleColor: '#222222',
      colors: ['#3498DB', '#E67E22', '#27AE60', '#C0392B', '#8E44AD', '#16A085', '#F39C12', '#2980B9', '#D81B60', '#E65100']
    },
    blue: {
      backgroundColor: '#0a1628',
      blankColor: '#112240',
      blankStroke: '#1e3a5f',
      labelColor: '#a8d8ff',
      titleColor: '#64b5f6',
      colors: ['#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9', '#0D47A1', '#2979FF', '#448AFF']
    },
    green: {
      backgroundColor: '#0a1f14',
      blankColor: '#0f2d1e',
      blankStroke: '#1a4a30',
      labelColor: '#a8e6cf',
      titleColor: '#69f0ae',
      colors: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#00C853', '#00E676', '#004D40']
    },
    brown: {
      backgroundColor: '#1e1610',
      blankColor: '#2c1f16',
      blankStroke: '#3d2d20',
      labelColor: '#e8c9a0',
      titleColor: '#d4a76a',
      colors: ['#8D6E63', '#A1887F', '#795548', '#6D4C41', '#5D4037', '#4E342E', '#3E2723', '#BF360C', '#D84315', '#E64A19']
    }
  };

  function MultiLevelDonutChart(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks || {};

    this.data = null;
    this.config = {};
    this.layout = null;
    this.maxDepth = 0;

    this.hoveredNode = null;
    this.focusedNode = null;
    this.hiddenIds = {};
    this.zoomLevel = 1;

    this.displayWidth = 0;
    this.displayHeight = 0;

    this._resizePending = true;

    this._bindEvents();
  }

  MultiLevelDonutChart.prototype._bindEvents = function () {
    var self = this;
    function handleMouseMove(e) {
      var rect = self.canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var prev = self.hoveredNode;
      self.hoveredNode = self.hitTest(x, y);
      if (prev !== self.hoveredNode) {
        self.render();
      }
      if (self.callbacks.onHover) {
        self.callbacks.onHover(self.hoveredNode, x, y, e);
      }
    }
    function handleMouseLeave() {
      if (self.hoveredNode) {
        self.hoveredNode = null;
        self.render();
        if (self.callbacks.onHover) {
          self.callbacks.onHover(null, -1, -1, null);
        }
      }
    }
    function handleClick(e) {
      var rect = self.canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var hit = self.hitTest(x, y);
      if (hit && !hit.isEmpty) {
        if (self.focusedNode && self.focusedNode.id === hit.id) {
          self.drillUp();
        } else {
          self.drillDown(hit);
        }
      } else {
        self.drillUp();
      }
      if (self.callbacks.onClick) {
        self.callbacks.onClick(hit);
      }
    }
    function handleWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      var delta = e.deltaY > 0 ? -0.08 : 0.08;
      self.setZoom(self.zoomLevel + delta);
    }
    this._handleMouseMove = handleMouseMove;
    this._handleMouseLeave = handleMouseLeave;
    this._handleClick = handleClick;
    this._handleWheel = handleWheel;
    this.canvas.addEventListener('mousemove', handleMouseMove);
    this.canvas.addEventListener('mouseleave', handleMouseLeave);
    this.canvas.addEventListener('click', handleClick);
    this.canvas.addEventListener('wheel', handleWheel, { passive: false });
  };

  MultiLevelDonutChart.prototype.destroy = function () {
    this.canvas.removeEventListener('mousemove', this._handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this._handleMouseLeave);
    this.canvas.removeEventListener('click', this._handleClick);
    this.canvas.removeEventListener('wheel', this._handleWheel);
  };

  // ────────────────── Data Loading ──────────────────

  MultiLevelDonutChart.prototype.loadData = function (data) {
    if (!data || !Array.isArray(data.categories)) {
      this.data = data || null;
      this.config = this._mergeConfig(data && data.config ? data.config : {});
      this.layout = { levels: [], allNodes: [], radii: [] };
      this.maxDepth = 0;
      this.hiddenIds = {};
      this.focusedNode = null;
      this._resizePending = true;
      this.render();
      return;
    }
    this.data = data;
    this.config = this._mergeConfig(data.config || {});
    this.hiddenIds = {};
    this.focusedNode = null;
    this.maxDepth = 0;
    this._computeMaxDepth(data.categories, 0);
    this._computeLayout();
    this._resizePending = true;
    this.render();
  };

  MultiLevelDonutChart.prototype._mergeConfig = function (user) {
    var cfg = {};
    for (var k in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(k)) {
        cfg[k] = DEFAULTS[k];
      }
    }
    for (var k2 in user) {
      if (user.hasOwnProperty(k2)) {
        cfg[k2] = user[k2];
      }
    }
    return cfg;
  };

  MultiLevelDonutChart.prototype._nodeId = function (node) {
    var id = node.name || '';
    return id.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
  };

  MultiLevelDonutChart.prototype._computeMaxDepth = function (cats, depth) {
    var self = this;
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      if (self.hiddenIds[self._nodeId(c)]) continue;
      if (c.children && c.children.length > 0) {
        self._computeMaxDepth(c.children, depth + 1);
      }
    }
    this.maxDepth = Math.max(this.maxDepth, depth);
  };

  // ────────────────── Layout ──────────────────

  MultiLevelDonutChart.prototype._computeLayout = function () {
    var self = this;
    var cfg = self.config;
    var uid = 0;

    self.layout = { levels: [], allNodes: [], radii: [] };
    self.focusedNode = null;

    var numRings = self.maxDepth + 1;
    var z = self.zoomLevel;
    for (var i = 0; i < numRings; i++) {
      self.layout.radii.push({
        inner: (cfg.centerRadius + i * (cfg.ringWidth + cfg.gapWidth)) * z,
        outer: (cfg.centerRadius + i * (cfg.ringWidth + cfg.gapWidth) + cfg.ringWidth) * z
      });
    }

    var topCats = [];
    for (var t = 0; t < self.data.categories.length; t++) {
      if (!self.hiddenIds[self._nodeId(self.data.categories[t])]) {
        topCats.push(self.data.categories[t]);
      }
    }

    var totalTop = 0;
    for (var s = 0; s < topCats.length; s++) {
      totalTop += Number(topCats[s].value) || 0;
    }
    if (totalTop === 0 || isNaN(totalTop)) return;

    var level0 = [];
    var angle = cfg.startAngle;
    for (var j = 0; j < topCats.length; j++) {
      var cat = topCats[j];
      var sweep = (Number(cat.value) / totalTop) * Math.PI * 2;
      var seg = {
        node: cat,
        startAngle: angle,
        endAngle: angle + sweep,
        innerR: self.layout.radii[0].inner,
        outerR: self.layout.radii[0].outer,
        color: self._assignColor(cat, null, j, 0),
        isEmpty: false,
        id: 's' + (++uid),
        depth: 0,
        parentId: null,
        originalIndex: j
      };
      level0.push(seg);
      self.layout.allNodes.push(seg);
      angle += sweep;
    }
    self.layout.levels.push(level0);

    for (var level = 1; level <= self.maxDepth; level++) {
      var levelSegs = [];
      var prevLevel = self.layout.levels[level - 1];
      for (var p = 0; p < prevLevel.length; p++) {
        var parentSeg = prevLevel[p];
        var parent = parentSeg.node;

        if (parentSeg.isEmpty) {
          levelSegs.push({
            node: parent,
            startAngle: parentSeg.startAngle,
            endAngle: parentSeg.endAngle,
            innerR: self.layout.radii[level].inner,
            outerR: self.layout.radii[level].outer,
            color: null,
            isEmpty: true,
            id: 's' + (++uid),
            depth: level,
            parentId: parentSeg.id
          });
          continue;
        }

        if (!parent.children || parent.children.length === 0) {
          levelSegs.push({
            node: parent,
            startAngle: parentSeg.startAngle,
            endAngle: parentSeg.endAngle,
            innerR: self.layout.radii[level].inner,
            outerR: self.layout.radii[level].outer,
            color: null,
            isEmpty: true,
            id: 's' + (++uid),
            depth: level,
            parentId: parentSeg.id
          });
          continue;
        }

        var childTotal = 0;
        for (var ci = 0; ci < parent.children.length; ci++) {
          if (!self.hiddenIds[self._nodeId(parent.children[ci])]) {
            childTotal += Number(parent.children[ci].value) || 0;
          }
        }
        if (childTotal === 0 || isNaN(childTotal)) {
          levelSegs.push({
            node: parent,
            startAngle: parentSeg.startAngle,
            endAngle: parentSeg.endAngle,
            innerR: self.layout.radii[level].inner,
            outerR: self.layout.radii[level].outer,
            color: null,
            isEmpty: true,
            id: 's' + (++uid),
            depth: level,
            parentId: parentSeg.id
          });
          continue;
        }

        var childAngle = parentSeg.startAngle;
        for (var cj = 0; cj < parent.children.length; cj++) {
          var child = parent.children[cj];
          if (self.hiddenIds[self._nodeId(child)]) continue;
          var childSweep = (Number(child.value) / childTotal) * (parentSeg.endAngle - parentSeg.startAngle);
          var childSeg = {
            node: child,
            startAngle: childAngle,
            endAngle: childAngle + childSweep,
            innerR: self.layout.radii[level].inner,
            outerR: self.layout.radii[level].outer,
            color: self._assignColor(child, parentSeg.color, cj, level),
            isEmpty: false,
            id: 's' + (++uid),
            depth: level,
            parentId: parentSeg.id,
            originalIndex: cj
          };
          levelSegs.push(childSeg);
          self.layout.allNodes.push(childSeg);
          childAngle += childSweep;
        }
      }
      self.layout.levels.push(levelSegs);
    }
  };

  // ────────────────── Color Assignment ──────────────────

  MultiLevelDonutChart.prototype._assignColor = function (node, parentColor, index, depth) {
    if (node.color) return node.color;

    if (!parentColor) {
      var colors = this.config.colors;
      if (!colors || colors.length === 0) colors = DEFAULTS.colors;
      return colors[index % colors.length];
    }

    var hsl = this._hexToHSL(parentColor);
    hsl.l = Math.min(88, hsl.l + 8 + depth * 5);
    hsl.s = Math.max(20, hsl.s - 5 - depth * 3);
    return this._hslToHex(hsl);
  };

  MultiLevelDonutChart.prototype._hexToHSL = function (hex) {
    hex = hex.replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16) / 255;
    var g = parseInt(hex.substring(2, 4), 16) / 255;
    var b = parseInt(hex.substring(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  MultiLevelDonutChart.prototype._hslToHex = function (hsl) {
    var h = hsl.h / 360;
    var s = hsl.s / 100;
    var l = hsl.l / 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    var toHex = function (x) {
      var v = Math.round(x * 255).toString(16);
      return v.length === 1 ? '0' + v : v;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  };

  // ────────────────── Rendering ──────────────────

  MultiLevelDonutChart.prototype.render = function () {
    try {
      if (this._resizePending) {
        this._resize();
      }
      if (this.displayWidth === 0 || this.displayHeight === 0) {
        if (!this._loggedZeroSize) {
          console.warn('MultiLevelDonutChart: render skipped, canvas size is 0x0');
          this._loggedZeroSize = true;
        }
        return;
      }
      this._loggedZeroSize = false;

      var ctx = this.ctx;
      var w = this.displayWidth;
      var h = this.displayHeight;

      ctx.clearRect(0, 0, w, h);
      this._drawBackground();
      this._drawRings();
      this._drawLabels();
      this._drawCenterContent();
      this._drawTitle();
    } catch (e) {
      console.error('MultiLevelDonutChart render error:', e);
    }
  };

  MultiLevelDonutChart.prototype._resize = function () {
    var parent = this.canvas.parentElement;
    if (!parent) {
      this._resizePending = false;
      return;
    }
    var w = parent.clientWidth;
    var h = parent.clientHeight;
    if (w === 0 || h === 0) return;

    var dpr = window.devicePixelRatio || 1;

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = w;
    this.displayHeight = h;
    this._resizePending = false;
    this._loggedZeroSize = false;
  };

  MultiLevelDonutChart.prototype._drawBackground = function () {
    var ctx = this.ctx;
    ctx.fillStyle = this.config.backgroundColor;
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
  };

  MultiLevelDonutChart.prototype._getCenter = function () {
    return {
      x: this.displayWidth / 2,
      y: this.displayHeight / 2
    };
  };

  MultiLevelDonutChart.prototype._drawRings = function () {
    var self = this;
    if (!self.layout || !self.layout.levels || self.layout.levels.length === 0) return;
    var ctx = self.ctx;
    var center = self._getCenter();

    var focusId = self.focusedNode ? self.focusedNode.id : null;

    for (var level = self.layout.levels.length - 1; level >= 0; level--) {
      var segs = self.layout.levels[level];
      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        var opacity = 1;

        if (focusId) {
          var inFocus = self._isInFocusPath(seg, focusId);
          opacity = inFocus ? 1 : self.config.dimOpacity;
        }

        if (seg.isEmpty) {
          self._drawBlankSegment(center, seg, opacity * 0.5);
        } else {
          self._drawSegment(center, seg, opacity);
        }
      }
    }

    if (self.focusedNode) {
      var focusSeg = self._findSegmentById(self.focusedNode.id);
      if (focusSeg && !focusSeg.isEmpty) {
        self._drawSegmentHighlight(center, focusSeg, 3, '#4A90D9');
      }
    }
    if (self.hoveredNode && (!self.focusedNode || self.hoveredNode.id !== self.focusedNode.id)) {
      var hoverSeg = self._findSegmentById(self.hoveredNode.id);
      if (hoverSeg && !hoverSeg.isEmpty) {
        self._drawSegmentHighlight(center, hoverSeg, 2, '#ffffff');
      }
    }
  };

  MultiLevelDonutChart.prototype._isInFocusPath = function (seg, focusId) {
    if (seg.id === focusId) return true;

    var focusSeg = this._findSegmentById(focusId);
    if (!focusSeg) return false;

    var current = focusSeg;
    while (current) {
      if (current.id === seg.id) return true;
      if (current.parentId) {
        current = this._findSegmentById(current.parentId);
      } else {
        break;
      }
    }

    current = seg;
    while (current) {
      if (current.id === focusId) return true;
      if (current.parentId) {
        current = this._findSegmentById(current.parentId);
      } else {
        break;
      }
    }

    return false;
  };

  MultiLevelDonutChart.prototype._findSegmentById = function (id) {
    for (var i = 0; i < this.layout.allNodes.length; i++) {
      if (this.layout.allNodes[i].id === id) return this.layout.allNodes[i];
    }
    return null;
  };

  MultiLevelDonutChart.prototype._drawSegment = function (center, seg, opacity) {
    var ctx = this.ctx;
    var gap = this.config.segmentGap * Math.PI / 180;
    var sa = seg.startAngle + gap / 2;
    var ea = seg.endAngle - gap / 2;

    if (ea - sa <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.beginPath();
    ctx.arc(center.x, center.y, seg.outerR, sa, ea);
    ctx.arc(center.x, center.y, seg.innerR, ea, sa, true);
    ctx.closePath();

    var color = seg.color;
    var grad = ctx.createRadialGradient(center.x, center.y, seg.innerR, center.x, center.y, seg.outerR);
    grad.addColorStop(0, this._lighten(color, 10));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = this._darken(color, 15);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  };

  MultiLevelDonutChart.prototype._drawBlankSegment = function (center, seg, opacity) {
    var ctx = this.ctx;
    var gap = this.config.segmentGap * Math.PI / 180;
    var sa = seg.startAngle + gap / 2;
    var ea = seg.endAngle - gap / 2;

    if (ea - sa <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.beginPath();
    ctx.arc(center.x, center.y, seg.outerR, sa, ea);
    ctx.arc(center.x, center.y, seg.innerR, ea, sa, true);
    ctx.closePath();

    ctx.fillStyle = this.config.blankColor;
    ctx.fill();
    ctx.strokeStyle = this.config.blankStroke;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  };

  MultiLevelDonutChart.prototype._drawSegmentHighlight = function (center, seg, lineWidth, color) {
    var ctx = this.ctx;
    lineWidth = lineWidth || 2;
    color = color || '#ffffff';
    var gap = this.config.segmentGap * Math.PI / 180;
    var sa = seg.startAngle + gap / 2;
    var ea = seg.endAngle - gap / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, seg.outerR + 2, sa, ea);
    ctx.arc(center.x, center.y, seg.innerR - 2, ea, sa, true);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color === '#4A90D9' ? 'rgba(74,144,217,0.7)' : 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  };

  MultiLevelDonutChart.prototype._drawLabels = function () {
    if (!this.config.labelShow) return;

    var ctx = this.ctx;
    var center = this._getCenter();
    ctx.save();
    ctx.font = this.config.labelFont;
    ctx.fillStyle = this.config.labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var minAngle = this.config.labelMinAngle * Math.PI / 180;

    for (var level = 0; level < this.layout.levels.length; level++) {
      var segs = this.layout.levels[level];
      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if (seg.isEmpty) continue;

        var angleSpan = seg.endAngle - seg.startAngle;
        if (angleSpan < minAngle) continue;

        var midAngle = seg.startAngle + angleSpan / 2;
        var midR = (seg.innerR + seg.outerR) / 2;

        var lx = center.x + Math.cos(midAngle) * midR;
        var ly = center.y + Math.sin(midAngle) * midR;

        var pct = this._getPercentage(seg);
        var label = seg.node.name;
        if (pct > 2) {
          label += ' ' + pct.toFixed(1) + '%';
        }

        var maxWidth = angleSpan * midR * 0.8;
        var metrics = ctx.measureText(label);
        if (metrics.width > maxWidth && label.length > 2) {
          label = label.substring(0, Math.floor(label.length * maxWidth / metrics.width) - 1) + '…';
        }

        ctx.fillText(label, lx, ly);
      }
    }

    ctx.restore();
  };

  MultiLevelDonutChart.prototype._getPercentage = function (seg) {
    if (seg.depth === 0) {
      var total = 0;
      for (var i = 0; i < this.layout.levels[0].length; i++) {
        total += this.layout.levels[0][i].node.value;
      }
      return total > 0 ? (seg.node.value / total) * 100 : 0;
    }
    var parent = this._findSegmentById(seg.parentId);
    if (!parent || parent.isEmpty) {
      var levelTotal = 0;
      for (var j = 0; j < this.layout.levels[seg.depth].length; j++) {
        if (!this.layout.levels[seg.depth][j].isEmpty) {
          levelTotal += this.layout.levels[seg.depth][j].node.value;
        }
      }
      return levelTotal > 0 ? (seg.node.value / levelTotal) * 100 : 0;
    }
    var siblingTotal = 0;
    var sibs = parent.node.children;
    if (sibs) {
      for (var k = 0; k < sibs.length; k++) {
        siblingTotal += sibs[k].value;
      }
    }
    return siblingTotal > 0 ? (seg.node.value / siblingTotal) * 100 : 0;
  };

  MultiLevelDonutChart.prototype._drawCenterContent = function () {
    var ctx = this.ctx;
    var center = this._getCenter();
    var r = this.config.centerRadius * 0.7;

    var focus = this.focusedNode;
    if (focus) {
      ctx.save();
      ctx.fillStyle = this.config.backgroundColor;
      ctx.beginPath();
      ctx.arc(center.x, center.y, this.config.centerRadius - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#888';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('点击空白返回', center.x, center.y + 8);

      ctx.fillStyle = this.config.titleColor;
      ctx.font = this.config.titleFont;
      ctx.textBaseline = 'middle';
      ctx.fillText(focus.node.name, center.x, center.y - 14);

      var pct = this._getPercentage(focus);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText(focus.node.value.toLocaleString() + ' (' + pct.toFixed(1) + '%)', center.x, center.y + 26);

      ctx.restore();
      return;
    }

    if (this.data && this.data.title) {
      ctx.save();
      ctx.fillStyle = this.config.backgroundColor;
      ctx.beginPath();
      ctx.arc(center.x, center.y, this.config.centerRadius - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.config.titleColor;
      ctx.font = this.config.titleFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      var title = this.data.title;
      var words = title.length > 6 ? title.match(/.{1,4}/g) : [title];
      if (words.length > 1) {
        for (var w = 0; w < words.length; w++) {
          ctx.fillText(words[w], center.x, center.y + (w - (words.length - 1) / 2) * 22);
        }
      } else {
        ctx.fillText(title, center.x, center.y);
      }
      ctx.restore();
    }
  };

  MultiLevelDonutChart.prototype._drawTitle = function () {
    if (!this.data || !this.data.title) return;
    if (!this.layout || !this.layout.radii || this.layout.radii.length === 0) return;

    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.config.titleColor;
    ctx.font = this.config.titleFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var center = this._getCenter();
    var outerR = this.layout.radii[this.layout.radii.length - 1].outer;
    var y = center.y - outerR - 30;

    if (y > 10) {
      ctx.fillText(this.data.title, center.x, y);
    }
    ctx.restore();
  };

  // ────────────────── Utility Drawing ──────────────────

  MultiLevelDonutChart.prototype._lighten = function (color, amount) {
    if (color[0] === '#') {
      var num = parseInt(color.replace('#', ''), 16);
      var r = Math.min(255, (num >> 16) + amount);
      var g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
      var b = Math.min(255, (num & 0x0000FF) + amount);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return color;
  };

  MultiLevelDonutChart.prototype._darken = function (color, amount) {
    if (color[0] === '#') {
      var num = parseInt(color.replace('#', ''), 16);
      var r = Math.max(0, (num >> 16) - amount);
      var g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
      var b = Math.max(0, (num & 0x0000FF) - amount);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    return color;
  };

  // ────────────────── Hit Testing ──────────────────

  MultiLevelDonutChart.prototype.hitTest = function (x, y) {
    if (!this.layout) return null;
    var center = this._getCenter();
    var dx = x - center.x;
    var dy = y - center.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx);

    for (var level = 0; level < this.layout.levels.length; level++) {
      var segs = this.layout.levels[level];
      if (segs.length === 0) continue;
      var r = segs[0];
      if (dist >= r.innerR && dist <= r.outerR) {
        var start = this.config.startAngle;
        var norm = angle - start;
        if (norm < 0) norm += Math.PI * 2;

        for (var i = 0; i < segs.length; i++) {
          var seg = segs[i];
          var sa = seg.startAngle - start;
          if (sa < 0) sa += Math.PI * 2;
          var ea = seg.endAngle - start;
          if (ea < 0) ea += Math.PI * 2;

          if (sa <= ea) {
            if (norm >= sa && norm <= ea) return seg;
          } else {
            if (norm >= sa || norm <= ea) return seg;
          }
        }
      }
    }
    return null;
  };

  // ────────────────── Interaction ──────────────────

  MultiLevelDonutChart.prototype.drillDown = function (seg) {
    if (!seg || seg.isEmpty) return;
    this.focusedNode = seg;
    this.render();
    if (this.callbacks.onDrillDown) {
      this.callbacks.onDrillDown(seg);
    }
  };

  MultiLevelDonutChart.prototype.drillUp = function () {
    if (!this.focusedNode) return;
    this.focusedNode = null;
    this.render();
    if (this.callbacks.onDrillUp) {
      this.callbacks.onDrillUp();
    }
  };

  MultiLevelDonutChart.prototype.resetFocus = function () {
    this.focusedNode = null;
    this.zoomLevel = 1;
    this._computeLayout();
    this.render();
  };

  // ────────────────── Legend ──────────────────

  MultiLevelDonutChart.prototype.getLegendItems = function () {
    if (!this.layout || !this.layout.levels.length) return [];
    var self = this;
    return this.layout.levels[0].map(function (seg) {
      var nid = self._nodeId(seg.node);
      return {
        id: nid,
        name: seg.node.name,
        color: seg.color,
        value: seg.node.value,
        visible: !self.hiddenIds[nid]
      };
    });
  };

  MultiLevelDonutChart.prototype.toggleLegend = function (nodeId) {
    if (!this.data || !this.data.categories) return;
    if (this.hiddenIds[nodeId]) {
      delete this.hiddenIds[nodeId];
    } else {
      this.hiddenIds[nodeId] = true;
    }
    this.maxDepth = 0;
    this._computeMaxDepth(this.data.categories, 0);
    this._computeLayout();
    this.render();
  };

  MultiLevelDonutChart.prototype.isNodeVisible = function (nodeId) {
    return !this.hiddenIds[nodeId];
  };

  // ────────────────── Export ──────────────────

  MultiLevelDonutChart.prototype.exportSVG = function () {
    var self = this;
    var centerX = this.displayWidth / 2;
    var centerY = this.displayHeight / 2;
    var indent = '  ';

    var svg = [];
    svg.push('<svg xmlns="http://www.w3.org/2000/svg"');
    svg.push('  width="' + this.displayWidth + '" height="' + this.displayHeight + '"');
    svg.push('  viewBox="0 0 ' + this.displayWidth + ' ' + this.displayHeight + '">');

    svg.push(indent + '<rect width="100%" height="100%" fill="' + this.config.backgroundColor + '" />');

    if (this.data && this.data.title) {
      svg.push(indent + '<text x="' + centerX + '" y="30" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="16" fill="' + this.config.titleColor + '">' + this._escapeXml(this.data.title) + '</text>');
    }

    var levels = this.layout.levels;
    for (var level = 0; level < levels.length; level++) {
      for (var i = 0; i < levels[level].length; i++) {
        var seg = levels[level][i];
        var path = this._segmentToSvgPath(seg, centerX, centerY);
        var color = seg.isEmpty ? this.config.blankColor : seg.color;

        svg.push(indent + '<path d="' + path + '" fill="' + color + '" stroke="' + this.config.blankStroke + '" stroke-width="0.5" />');
      }
    }

    svg.push('</svg>');
    return svg.join('\n');
  };

  MultiLevelDonutChart.prototype._segmentToSvgPath = function (seg, cx, cy) {
    var ir = seg.innerR;
    var orr = seg.outerR;
    var sa = seg.startAngle;
    var ea = seg.endAngle;

    var x1 = cx + Math.cos(sa) * orr;
    var y1 = cy + Math.sin(sa) * orr;
    var x2 = cx + Math.cos(ea) * orr;
    var y2 = cy + Math.sin(ea) * orr;
    var x3 = cx + Math.cos(ea) * ir;
    var y3 = cy + Math.sin(ea) * ir;
    var x4 = cx + Math.cos(sa) * ir;
    var y4 = cy + Math.sin(sa) * ir;

    var largeArc = (ea - sa) > Math.PI ? 1 : 0;

    var d = [
      'M ' + x1.toFixed(2) + ' ' + y1.toFixed(2),
      'A ' + orr.toFixed(2) + ' ' + orr.toFixed(2) + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2),
      'L ' + x3.toFixed(2) + ' ' + y3.toFixed(2),
      'A ' + ir.toFixed(2) + ' ' + ir.toFixed(2) + ' 0 ' + largeArc + ' 0 ' + x4.toFixed(2) + ' ' + y4.toFixed(2),
      'Z'
    ].join(' ');

    return d;
  };

  MultiLevelDonutChart.prototype.exportPNG = function (callback, scale) {
    scale = scale || 2;
    var w = this.displayWidth * scale;
    var h = this.displayHeight * scale;

    var offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    var offCtx = offCanvas.getContext('2d');
    offCtx.setTransform(scale, 0, 0, scale, 0, 0);

    var origCanvas = this.canvas;
    var origCtx = this.ctx;
    var origW = this.displayWidth;
    var origH = this.displayHeight;

    this.canvas = offCanvas;
    this.displayWidth = origW;
    this.displayHeight = origH;
    this.ctx = offCtx;
    this.render();

    this.canvas = origCanvas;
    this.displayWidth = origW;
    this.displayHeight = origH;
    this.ctx = origCtx;

    offCanvas.toBlob(function (blob) {
      if (callback) callback(blob);
    }, 'image/png');
  };

  MultiLevelDonutChart.prototype._escapeXml = function (str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // ────────────────── Public API ──────────────────

  MultiLevelDonutChart.prototype.updateConfig = function (config) {
    for (var k in config) {
      if (config.hasOwnProperty(k)) {
        this.config[k] = config[k];
      }
    }
    this._computeLayout();
    this.render();
  };

  MultiLevelDonutChart.prototype.applyTheme = function (name) {
    var theme = THEMES[name];
    if (!theme) return;
    for (var k in theme) {
      if (theme.hasOwnProperty(k)) {
        this.config[k] = theme[k];
      }
    }
    this._computeLayout();
    this.render();
  };

  MultiLevelDonutChart.getThemes = function () {
    return Object.keys(THEMES).map(function (k) {
      return { id: k, name: k === 'dark' ? '暗色' : k === 'light' ? '亮色' : k === 'blue' ? '蓝色' : k === 'green' ? '墨绿' : '暖棕', config: THEMES[k] };
    });
  };

  MultiLevelDonutChart.prototype.setZoom = function (level) {
    level = Math.max(0.3, Math.min(3, level));
    if (Math.abs(this.zoomLevel - level) < 0.001) return;
    this.zoomLevel = level;
    this._computeLayout();
    this.render();
  };

  MultiLevelDonutChart.prototype.refresh = function () {
    this._resizePending = true;
    this.maxDepth = 0;
    if (this.data) {
      this._computeMaxDepth(this.data.categories, 0);
      this._computeLayout();
    }
    this.render();
  };

  global.MultiLevelDonutChart = MultiLevelDonutChart;

})(window);
