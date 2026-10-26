/* =========================================================================
 * 运营数据看板 · 交互脚本（原生 JS，零依赖）
 * -------------------------------------------------------------------------
 * 作业要点落实：
 *   1. 6 张卡片 × 每张 6 条指标，全部由 JS 数组遍历渲染，
 *      页面里没有一段手写重复的指标 HTML。
 *   2. 三个断点由 CSS 媒体查询实现（<768 单列 / 768–1199 两列 / ≥1200 四列 + 侧栏），
 *      脚本用 matchMedia 实时提示当前处于哪一档。
 *   3. 主题（浅色 / 深色）由 CSS 变量管理，localStorage 记忆选择。
 * ========================================================================= */
(function () {
  'use strict';

  /* ===================== 1. 图标：内联 SVG + currentColor ================= */
  function icon(paths, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }

  var ICONS = {
    cart: icon('<circle cx="9.2" cy="20" r="1.4"/><circle cx="17.6" cy="20" r="1.4"/>' +
      '<path d="M3 4h2.2l2.3 10.1a1.6 1.6 0 0 0 1.6 1.3h7.7a1.6 1.6 0 0 0 1.6-1.2L20.6 8H6.1"/>'),
    eye: icon('<path d="M2.6 12S6.2 5.9 12 5.9 21.4 12 21.4 12 17.8 18.1 12 18.1 2.6 12 2.6 12Z"/>' +
      '<circle cx="12" cy="12" r="3.2"/>'),
    users: icon('<path d="M15.4 20v-1.6a3.6 3.6 0 0 0-3.6-3.6H7.6A3.6 3.6 0 0 0 4 18.4V20"/>' +
      '<circle cx="9.7" cy="8.2" r="3.6"/><path d="M19.8 20v-1.6a3.6 3.6 0 0 0-2.7-3.5"/>' +
      '<path d="M14.6 4.9a3.6 3.6 0 0 1 0 6.6"/>'),
    box: icon('<path d="M20.6 8.4 12 3.6 3.4 8.4v7.2L12 20.4l8.6-4.8V8.4Z"/>' +
      '<path d="M3.4 8.4 12 13.2l8.6-4.8"/><path d="M12 13.2v7.2"/>'),
    speaker: icon('<path d="M4 9.8v4.4a1.2 1.2 0 0 0 1.2 1.2H8l6.2 3.9V4.7L8 8.6H5.2A1.2 1.2 0 0 0 4 9.8Z"/>' +
      '<path d="M18 9.2a4 4 0 0 1 0 5.6"/><path d="M20.6 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
    server: icon('<rect x="3" y="4" width="18" height="7" rx="2.2"/>' +
      '<rect x="3" y="13" width="18" height="7" rx="2.2"/><path d="M7 7.5h.01M7 16.5h.01"/>'),
    sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2.4v2.2M12 19.4v2.2M4.6 4.6l1.6 1.6' +
      'M17.8 17.8l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>', 16),
    moon: icon('<path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3Z"/>', 16)
  };

  /* ===================== 2. 数据源：数组驱动渲染 ========================= */

  // 时间范围系数：'sum' 类指标（总量）随范围放大，'avg' 类指标（均值）基本不变
  var RANGE_FACTOR = { 7: 1, 30: 3.86, 90: 11.4 };
  var RANGE_LABEL = { 7: '近 7 天', 30: '近 30 天', 90: '近 90 天' };

  // 每张卡片恰好 6 条指标：{ label 名称, value 基准值, format 格式, unit 单位, delta 环比, agg 聚合, good 上升是否为好 }
  var CARDS = [
    {
      id: 'sales', accent: 'a1', title: '销售概览', icon: 'cart',
      stats: [
        { label: '销售额', value: 1284500, format: 'int', unit: '元', delta: 12.4, good: 'up' },
        { label: '订单量', value: 8642, format: 'int', unit: '笔', delta: 8.1, good: 'up' },
        { label: '客单价', value: 148.62, format: 'dec2', unit: '元', delta: 3.2, good: 'up', agg: 'avg' },
        { label: '退款率', value: 1.82, format: 'dec2', unit: '%', delta: -0.42, good: 'down', agg: 'avg' },
        { label: '支付转化率', value: 3.42, format: 'dec2', unit: '%', delta: 0.63, good: 'up', agg: 'avg' },
        { label: '新增客户', value: 326, format: 'int', unit: '人', delta: 5.7, good: 'up' }
      ]
    },
    {
      id: 'traffic', accent: 'a2', title: '流量来源', icon: 'eye',
      stats: [
        { label: '浏览量', value: 1286400, format: 'int', unit: 'PV', delta: 9.6, good: 'up' },
        { label: '访客数', value: 328900, format: 'int', unit: 'UV', delta: 6.3, good: 'up' },
        { label: '人均停留', value: 222, format: 'dur', unit: '', delta: 4.1, good: 'up', agg: 'avg' },
        { label: '跳出率', value: 41.2, format: 'dec1', unit: '%', delta: -1.35, good: 'down', agg: 'avg' },
        { label: '新访客占比', value: 63.5, format: 'dec1', unit: '%', delta: 2.4, good: 'up', agg: 'avg' },
        { label: '直接访问', value: 96300, format: 'int', unit: '次', delta: 3.8, good: 'up' }
      ]
    },
    {
      id: 'users', accent: 'a3', title: '用户增长', icon: 'users',
      stats: [
        { label: '新增用户', value: 2845, format: 'int', unit: '人', delta: 11.2, good: 'up' },
        { label: '日活 DAU', value: 42180, format: 'int', unit: '人', delta: 4.9, good: 'up', agg: 'avg' },
        { label: '月活 MAU', value: 386500, format: 'int', unit: '人', delta: 6.8, good: 'up', agg: 'avg' },
        { label: '次日留存', value: 38.6, format: 'dec1', unit: '%', delta: 0.9, good: 'up', agg: 'avg' },
        { label: '7 日留存', value: 21.4, format: 'dec1', unit: '%', delta: -0.6, good: 'up', agg: 'avg' },
        { label: '流失用户', value: 1207, format: 'int', unit: '人', delta: -4.3, good: 'down' }
      ]
    },
    {
      id: 'goods', accent: 'a4', title: '商品运营', icon: 'box',
      stats: [
        { label: '在售商品', value: 3268, format: 'int', unit: '件', delta: 2.1, good: 'up', agg: 'avg' },
        { label: '动销率', value: 72.4, format: 'dec1', unit: '%', delta: 1.8, good: 'up', agg: 'avg' },
        { label: '周转天数', value: 28.6, format: 'dec1', unit: '天', delta: -2.4, good: 'down', agg: 'avg' },
        { label: '缺货商品', value: 47, format: 'int', unit: '件', delta: -12.5, good: 'down', agg: 'avg' },
        { label: '好评率', value: 96.8, format: 'dec1', unit: '%', delta: 0.4, good: 'up', agg: 'avg' },
        { label: '平均评分', value: 4.72, format: 'dec2', unit: '分', delta: 0.12, good: 'up', agg: 'avg' }
      ]
    },
    {
      id: 'campaign', accent: 'a5', title: '营销活动', icon: 'speaker',
      stats: [
        { label: '活动曝光', value: 4862000, format: 'int', unit: '次', delta: 18.6, good: 'up' },
        { label: '点击量', value: 386400, format: 'int', unit: '次', delta: 14.2, good: 'up' },
        { label: '点击率', value: 7.94, format: 'dec2', unit: '%', delta: 0.86, good: 'up', agg: 'avg' },
        { label: '领券张数', value: 52800, format: 'int', unit: '张', delta: 9.4, good: 'up' },
        { label: '核销率', value: 46.3, format: 'dec1', unit: '%', delta: 2.7, good: 'up', agg: 'avg' },
        { label: '获客成本', value: 32.5, format: 'dec1', unit: '元', delta: -3.6, good: 'down', agg: 'avg' }
      ]
    },
    {
      id: 'health', accent: 'a6', title: '服务健康度', icon: 'server',
      stats: [
        { label: '平均响应', value: 186, format: 'int', unit: 'ms', delta: -6.2, good: 'down', agg: 'avg' },
        { label: 'P95 响应', value: 420, format: 'int', unit: 'ms', delta: -4.8, good: 'down', agg: 'avg' },
        { label: '可用性', value: 99.98, format: 'dec2', unit: '%', delta: 0.02, good: 'up', agg: 'avg' },
        { label: '错误率', value: 0.12, format: 'dec2', unit: '%', delta: -0.05, good: 'down', agg: 'avg' },
        { label: '峰值 QPS', value: 3240, format: 'int', unit: '次/秒', delta: 8.9, good: 'up', agg: 'avg' },
        { label: '在线设备', value: 18600, format: 'int', unit: '台', delta: 3.1, good: 'up', agg: 'avg' }
      ]
    }
  ];

  // 渠道占比：同样由数组渲染
  var CHANNELS = [
    { name: '自然搜索', value: 32.6, accent: 'a1' },
    { name: '付费广告', value: 24.1, accent: 'a2' },
    { name: '社交媒体', value: 18.7, accent: 'a3' },
    { name: '直接访问', value: 15.2, accent: 'a4' },
    { name: '其他渠道', value: 9.4, accent: 'a5' }
  ];

  /* ===================== 3. 工具函数 ===================================== */
  var nfInt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  var nfDec1 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nfDec2 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32：确定性伪随机，保证「同一范围 + 同一次刷新」结果稳定
  function random(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatValue(stat, value) {
    switch (stat.format) {
      case 'dec1': return nfDec1.format(value);
      case 'dec2': return nfDec2.format(value);
      case 'dur': return Math.floor(value / 60) + ':' + String(Math.round(value % 60)).padStart(2, '0');
      default: return nfInt.format(Math.round(value));
    }
  }

  // 生成某条指标在当前范围 / 当前刷新批次下的展示值
  function statValue(card, stat, range, tick) {
    var rnd = random(hashSeed(card.id + '|' + stat.label + '|' + range + '|' + tick));
    var noise = (rnd() - 0.5) * 0.04;               // ±2% 抖动，模拟实时数据
    if (stat.agg === 'avg') return stat.value * (1 + noise);
    var drift = 1 + (stat.delta / 100) * 0.55;      // 总量随周期趋势累积
    return stat.value * RANGE_FACTOR[range] * drift * (1 + noise);
  }

  // 趋势折线：把一组数值映射成 0–100 × 0–32 的 SVG 路径
  function sparkPaths(values) {
    var W = 100, H = 32, PAD = 4;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var step = W / (values.length - 1);
    var pts = values.map(function (v, i) {
      return [
        +(i * step).toFixed(2),
        +(PAD + (1 - (v - min) / span) * (H - PAD * 2)).toFixed(2)
      ];
    });
    var line = 'M' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' L');
    return { line: line, area: line + ' L' + W + ',' + H + ' L0,' + H + ' Z' };
  }

  function makeTrend(card, range, tick) {
    var rnd = random(hashSeed(card.id + '|trend|' + range + '|' + tick));
    var dir = card.stats[0].delta >= 0 ? 1 : -1;
    var v = 42 + rnd() * 18;
    var out = [];
    for (var i = 0; i < 14; i++) {
      v += dir * (1.1 + rnd() * 2.3) + (rnd() - 0.5) * 6.5;
      v = Math.max(6, Math.min(94, v));
      out.push(v);
    }
    return out;
  }

  /* ===================== 4. 渲染 ========================================= */

  function statTemplate(card, stat, range, tick) {
    var value = statValue(card, stat, range, tick);
    var rnd = random(hashSeed(card.id + '|delta|' + stat.label + '|' + range + '|' + tick));
    var delta = stat.delta + (rnd() - 0.5) * 0.6;
    var isUp = delta >= 0;
    var isGood = stat.good === 'down' ? !isUp : isUp;      // 退款率/错误率下降才是好事
    var tone = isGood ? 'is-pos' : 'is-neg';

    return '' +
      '<div class="stat">' +
        '<dt class="stat__label">' + stat.label + '</dt>' +
        '<dd class="stat__value">' +
          '<span class="stat__num">' + formatValue(stat, value) + '</span>' +
          (stat.unit ? '<span class="stat__unit">' + stat.unit + '</span>' : '') +
        '</dd>' +
        '<dd class="stat__delta ' + tone + '">' +
          '<span aria-hidden="true">' + (isUp ? '▲' : '▼') + '</span>' +
          '<span class="visually-hidden">较上一周期' + (isUp ? '上升' : '下降') + '</span>' +
          Math.abs(delta).toFixed(1) + '%' +
        '</dd>' +
      '</div>';
  }

  function cardTemplate(card, range, tick) {
    // 卡片整体涨跌：取 6 条指标环比的均值，并按「上升是否为好」修正方向
    // （退款率、错误率、获客成本这类指标下降才算变好）
    var total = card.stats.reduce(function (sum, s) {
      return sum + (s.good === 'down' ? -s.delta : s.delta);
    }, 0);
    var avg = total / card.stats.length + (random(hashSeed(card.id + tick))() - 0.5);
    var isUp = avg >= 0;

    var trend = makeTrend(card, range, tick);
    var path = sparkPaths(trend);
    var gid = 'spark-' + card.id;

    var statsHtml = card.stats.map(function (stat) {
      return statTemplate(card, stat, range, tick);
    }).join('');

    return '' +
      '<article class="card ' + card.accent + '">' +
        '<header class="card__head">' +
          '<span class="card__icon">' + ICONS[card.icon] + '</span>' +
          '<h3 class="card__title">' + card.title + '</h3>' +
          '<span class="card__tag ' + (isUp ? 'is-pos' : 'is-neg') + '" ' +
            'title="6 条指标的综合环比（已按各指标好坏方向修正）">' +
            '<span aria-hidden="true">' + (isUp ? '▲' : '▼') + '</span>' + Math.abs(avg).toFixed(1) + '%' +
          '</span>' +
        '</header>' +
        '<svg class="card__spark" width="100%" height="52" viewBox="0 0 100 32" ' +
          'preserveAspectRatio="none" role="img" ' +
          'aria-label="' + card.title + RANGE_LABEL[range] + '趋势图">' +
          '<defs>' +
            '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0%" stop-color="currentColor" stop-opacity=".30"/>' +
              '<stop offset="100%" stop-color="currentColor" stop-opacity="0"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<path d="' + path.area + '" fill="url(#' + gid + ')"/>' +
          '<path d="' + path.line + '" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
        '</svg>' +
        /* 6 条指标统一由 <dl> 承载 */
        '<dl class="card__stats">' + statsHtml + '</dl>' +
      '</article>';
  }

  function channelsTemplate(range, tick) {
    return CHANNELS.map(function (ch) {
      var rnd = random(hashSeed(ch.name + '|' + range + '|' + tick));
      var value = Math.max(3, Math.min(60, ch.value + (rnd() - 0.5) * 1.6));
      return '' +
        '<li class="channel ' + ch.accent + '">' +
          '<div class="channel__top">' +
            '<span class="channel__name">' + ch.name + '</span>' +
            '<span class="channel__value">' + value.toFixed(1) + '%</span>' +
          '</div>' +
          '<svg class="channel__bar" width="100%" height="8" viewBox="0 0 100 8" ' +
            'preserveAspectRatio="none" role="img" aria-label="' + ch.name + ' 占比 ' + value.toFixed(1) + '%">' +
            '<rect x="0" y="0" width="100" height="8" fill="currentColor" opacity=".14"/>' +
            '<rect x="0" y="0" width="' + value.toFixed(2) + '" height="8" fill="currentColor"/>' +
          '</svg>' +
        '</li>';
    }).join('');
  }

  /* ===================== 5. 状态与事件 =================================== */

  var el = {
    cards: document.getElementById('cards'),
    channels: document.getElementById('channels'),
    rangeGroup: document.getElementById('range-group'),
    themeGroup: document.getElementById('theme-group'),
    rangeLabel: document.getElementById('range-label'),
    updatedAt: document.getElementById('updated-at'),
    refreshBtn: document.getElementById('refresh-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    themeToggleLabel: document.getElementById('theme-toggle-label'),
    themeToggleIcon: document.getElementById('theme-toggle-icon'),
    bpBadge: document.getElementById('bp-badge')
  };

  var state = { range: 7, tick: 0 };
  var THEME_KEY = 'dashboard.theme';

  function storeTheme(value) {
    try { localStorage.setItem(THEME_KEY, value); } catch (e) { /* 隐私模式下忽略 */ }
  }
  function readTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  // 一次性渲染整块看板
  function render() {
    el.cards.innerHTML = CARDS.map(function (card) {
      return cardTemplate(card, state.range, state.tick);
    }).join('');

    el.channels.innerHTML = channelsTemplate(state.range, state.tick);
    el.rangeLabel.textContent = RANGE_LABEL[state.range];
    el.updatedAt.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    el.updatedAt.classList.add('time');
  }

  /* ---- 时间范围 ---- */
  el.rangeGroup.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-range]');
    if (!btn) return;
    state.range = Number(btn.dataset.range);
    Array.prototype.forEach.call(el.rangeGroup.querySelectorAll('.seg'), function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    render();
  });

  /* ---- 刷新 ---- */
  el.refreshBtn.addEventListener('click', function () {
    state.tick += 1;
    render();
  });

  /* ---- 主题：CSS 变量驱动，双入口（顶栏按钮 + 侧栏分段按钮） ---- */
  function applyTheme(theme) {
    var isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-pressed', String(isDark));
    el.themeToggleLabel.textContent = isDark ? '浅色模式' : '深色模式';
    el.themeToggleIcon.innerHTML = isDark ? ICONS.sun : ICONS.moon;
    Array.prototype.forEach.call(el.themeGroup.querySelectorAll('.seg'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeValue === theme));
    });
  }

  el.themeToggle.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storeTheme(next);
  });

  el.themeGroup.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-theme-value]');
    if (!btn) return;
    applyTheme(btn.dataset.themeValue);
    storeTheme(btn.dataset.themeValue);
  });

  /* ---- 断点提示：与 CSS 中的三档断点保持一致 ---- */
  var BREAKPOINTS = [
    { query: window.matchMedia('(min-width: 1200px)'), label: '桌面 ≥1200px · 四列 + 侧栏' },
    { query: window.matchMedia('(min-width: 768px)'), label: '平板 768–1199px · 两列' },
    { query: window.matchMedia('(max-width: 767px)'), label: '手机 <768px · 单列' }
  ];

  function updateBreakpointBadge() {
    for (var i = 0; i < BREAKPOINTS.length; i++) {
      if (BREAKPOINTS[i].query.matches) {
        el.bpBadge.textContent = BREAKPOINTS[i].label;
        return;
      }
    }
  }

  BREAKPOINTS.forEach(function (bp) {
    if (typeof bp.query.addEventListener === 'function') {
      bp.query.addEventListener('change', updateBreakpointBadge);
    } else if (typeof bp.query.addListener === 'function') {
      bp.query.addListener(updateBreakpointBadge);   // 兼容旧版浏览器
    }
  });

  /* ---- 开发期自检：每张卡片必须是 6 条数据 ---- */
  CARDS.forEach(function (card) {
    if (card.stats.length !== 6) {
      console.warn('[看板] 卡片「' + card.title + '」应有 6 条数据，当前 ' + card.stats.length + ' 条');
    }
  });

  /* ---- 初始化：优先 URL 参数（?theme=dark），其次本地记忆，最后跟随系统 ---- */
  var forced = null;
  try { forced = new URLSearchParams(location.search).get('theme'); } catch (e) { forced = null; }
  var saved = (forced === 'dark' || forced === 'light') ? forced : readTheme();
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  updateBreakpointBadge();
  render();
})();