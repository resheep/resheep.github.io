/**
 * 创作热力图 —— 浏览器端渲染（GitHub 贡献图风格）
 * ------------------------------------------------------------------
 * 数据来自构建期生成的 window.__BLOG_HEATMAP__（见 scripts/auto-heatmap.js），
 * 这里只负责画图：纯 SVG、零依赖、自动适配明暗主题与容器宽度。
 * 每次构建数据都会刷新，因此热力图始终跟着文章自动更新。
 */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var STEP_X = 15;      // 列间距 = 格子宽 12 + 间隙 3
  var STEP_Y = 15;
  var CELL = 12;
  var GUTTER = 26;      // 左侧星期标签宽度
  var TOP = 20;         // 顶部月份标签高度
  var MIN_W = 560;      // 容器窄于此值时改为横向滚动，避免格子被压成一条线

  var ROW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  var COLORS = ['var(--hm-lv0)', 'var(--hm-lv1)', 'var(--hm-lv2)', 'var(--hm-lv3)', 'var(--hm-lv4)'];

  /* ---------------- 样式（一次性注入） ---------------- */
  function injectStyle() {
    if (document.getElementById('auto-heatmap-css')) return;
    var css = [
      'div.github-heatmap{display:block;width:100%;max-width:100%;box-sizing:border-box;grid-column:1/-1!important;margin:16px 0 8px;padding:14px 16px 10px;',
      'border-radius:12px;border:1px solid var(--hm-border);background:var(--hm-bg);',
      '--hm-border:#e5e7eb;--hm-bg:#ffffff;--hm-title:#1e293b;--hm-sub:#94a3b8;--hm-empty:#ebedf0;',
      '--hm-lv1:#9be9a8;--hm-lv2:#40c463;--hm-lv3:#30a14e;--hm-lv4:#216e39;}',
      'html[data-theme="dark"] div.github-heatmap{--hm-border:rgba(255,255,255,.10);--hm-bg:rgba(255,255,255,.04);',
      '--hm-title:#e5eaf3;--hm-sub:#8c99ab;--hm-empty:#2b3340;--hm-lv1:#0e4429;--hm-lv2:#006d32;--hm-lv3:#26a641;--hm-lv4:#39d353;}',
      '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) div.github-heatmap{--hm-border:rgba(255,255,255,.10);',
      '--hm-bg:rgba(255,255,255,.04);--hm-title:#e5eaf3;--hm-sub:#8c99ab;--hm-empty:#2b3340;',
      '--hm-lv1:#0e4429;--hm-lv2:#006d32;--hm-lv3:#26a641;--hm-lv4:#39d353;}}',
      '.hm-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;}',
      '.hm-scroll::-webkit-scrollbar{height:6px;}',
      '.hm-scroll::-webkit-scrollbar-thumb{background:var(--hm-border);border-radius:3px;}',
      '.hm-svg{display:block;width:100%;height:auto;}',
      '#recent-posts>div.github-heatmap{display:block;width:100%;max-width:100%;}',
      '.hm-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin:0 0 8px;}',
      '.hm-head strong{font-size:14px;font-weight:700;color:var(--hm-title);}',
      '.hm-head span{font-size:12px;color:var(--hm-sub);}'
    ].join('');
    var style = document.createElement('style');
    style.id = 'auto-heatmap-css';
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------------- 小工具 ---------------- */
  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function levelOf(count, thresholds) {
    if (!count) return 0;
    var lv = 0;
    thresholds.forEach(function (t, i) { if (count >= t) lv = i + 1; });
    return Math.min(lv, 4);
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** 容器宽度 → SVG 逻辑宽度（viewBox 与 width 一致，1 单位 = 1 像素，字号稳定） */
  function measure(container) {
    var w = container.clientWidth - 32; // 去掉左右 padding
    if (!w || w < 200) w = (window.innerWidth || 1024) - 72;
    return Math.max(Math.min(w, 883), MIN_W);
  }

  /* ---------------- 绘制 ---------------- */
  function render(container, data) {
    var counts = (data && data.counts) || {};
    var thresholds = (data && data.thresholds) || [1, 2, 3, 4];
    var weekStart = (data && data.weekStart) || 0;
    var rowLabels = (data && data.rowLabels) || ROW_LABELS;
    var weeks = data && data.weeks ? data.weeks : 53;

    var end = data && data.end ? new Date(data.end + 'T00:00:00') : new Date();
    end.setHours(0, 0, 0, 0);

    // 以「今天所在周的周首日」为最后一列，向前铺满 weeks 列
    var offset = (end.getDay() - weekStart + 7) % 7;
    var start = new Date(end);
    start.setDate(start.getDate() - offset - (weeks - 1) * 7);

    // 组装每一列（每周 7 天），越界的日子留空
    var cols = [];
    var cursor = new Date(start);
    while (cursor <= end) {
      var col = [];
      for (var i = 0; i < 7; i++) {
        var valid = cursor >= start && cursor <= end;
        var key = ymd(cursor);
        col.push({ date: new Date(cursor), key: key, count: valid ? (counts[key] || 0) : 0, valid: valid });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }

    var gridW = cols.length * STEP_X - (STEP_X - CELL);
    var svgW = measure(container);
    var svgH = TOP + 7 * STEP_Y - (STEP_Y - CELL) + 26;
    var svg = el('svg', {
      viewBox: '0 0 ' + svgW + ' ' + svgH,
      width: svgW,
      height: svgH,
      'class': 'hm-svg',
      role: 'img',
      'aria-label': '创作热力图：过去一年每日发文数量'
    });

    // 月份标签：每列取该列首日，月份变化时打一个标签
    var lastMonth = -1;
    cols.forEach(function (col, wi) {
      var firstOfMonth = null;
      for (var i = 0; i < col.length; i++) if (col[i].valid) { firstOfMonth = col[i]; break; }
      if (!firstOfMonth) return;
      var m = firstOfMonth.date.getMonth();
      if (wi > 0 && m === lastMonth) return;
      lastMonth = m;
      svg.appendChild(el('text', {
        x: GUTTER + wi * STEP_X,
        y: TOP - 7,
        'font-size': 9,
        fill: 'var(--hm-sub)'
      }, (m + 1) + '月'));
    });

    // 星期标签（只标 一 / 三 / 五，和 GitHub 一致）
    ['一', '三', '五'].forEach(function (label) {
      var idx = rowLabels.indexOf(label);
      if (idx < 0) return;
      svg.appendChild(el('text', {
        x: 0,
        y: TOP + idx * STEP_Y + CELL - 2,
        'font-size': 9,
        fill: 'var(--hm-sub)'
      }, label));
    });

    // 日期格子
    cols.forEach(function (col, wi) {
      col.forEach(function (cell, ri) {
        if (!cell.valid) return;
        var rect = el('rect', {
          x: GUTTER + wi * STEP_X,
          y: TOP + ri * STEP_Y,
          width: CELL,
          height: CELL,
          rx: 2.5,
          fill: COLORS[levelOf(cell.count, thresholds)]
        });
        rect.appendChild(el('title', null,
          cell.count ? cell.key + ' · ' + cell.count + ' 篇' : cell.key + ' · 没有发文'));
        svg.appendChild(rect);
      });
    });

    // 图例：少 ▢▢▢▢▢ 多
    var legendY = TOP + 7 * STEP_Y - (STEP_Y - CELL) + 12;
    var legend = el('g', { transform: 'translate(' + (svgW - GUTTER - 4 * STEP_X - 34) + ',' + legendY + ')' });
    legend.appendChild(el('text', { x: -14, y: 0, 'font-size': 9, fill: 'var(--hm-sub)' }, '少'));
    for (var i = 0; i <= 4; i++) {
      legend.appendChild(el('rect', {
        x: i * STEP_X, y: -9, width: 11, height: 11, rx: 2.5, fill: COLORS[i]
      }));
    }
    legend.appendChild(el('text', { x: 5 * STEP_X + 3, y: 0, 'font-size': 9, fill: 'var(--hm-sub)' }, '多'));
    svg.appendChild(legend);

    // 窗口范围（悬停显示本次构建时间，方便确认数据是不是新的）
    var range = el('text', { x: 0, y: legendY, 'font-size': 9, fill: 'var(--hm-sub)' });
    range.appendChild(el('title', null,
      '数据生成于 ' + (data && data.generatedAt ? data.generatedAt : '未知')));
    range.textContent = (data && data.start ? data.start.replace(/-/g, '.') : '') +
      ' – ' + (data && data.end ? data.end.replace(/-/g, '.') : '');
    svg.appendChild(range);

    // 标题栏：累计口径与图内「近一年」区分开
    var inWindow = data && typeof data.inWindow === 'number' ? data.inWindow : 0;
    var activeDays = data && typeof data.activeDays === 'number' ? data.activeDays : 0;
    var html = '<div class="hm-head"><strong>📊 创作热力图</strong><span>共 ' +
      (data && data.total ? data.total : 0) + ' 篇文章 · 近一年 ' + inWindow + ' 篇 · ' +
      activeDays + ' 天有更新</span></div>';

    var scroll = document.createElement('div');
    scroll.className = 'hm-scroll';
    scroll.appendChild(svg);

    container.innerHTML = html;
    container.appendChild(scroll);
    container.setAttribute('data-hm-rendered', '1');
    // 窄屏下默认看向最近的时间（右侧）
    scroll.scrollLeft = scroll.scrollWidth;
  }

  /* ---------------- 引导：找容器、取数据、渲染 ---------------- */
  /**
   * 拿到「唯一」的热力图容器。
   *
   * 本脚本是 defer 的，会在页内搬运脚本之前执行，所以此时插件注入的容器
   * 可能还留在 </body> 前。若直接 querySelector('#recent-posts') 找不到就新建，
   * 插件那个容器就会被永久遗弃在页面底部，塌成一条白条。
   * 因此这里统一处理：优先复用页面上的容器并搬进来，多余的一律清掉，
   * 并把旧实现留在它上面的 inline 样式（白底 / 圆角 / overflow）抹掉。
   */
  function ensureContainer(host) {
    var existing = host.querySelector('div.github-heatmap');
    if (existing) {
      existing.removeAttribute('style');
      return existing;
    }
    // 页面底部（或任何别处）遗留的容器：搬到卡片区顶部复用
    var stray = document.querySelector('div.github-heatmap');
    if (stray) {
      stray.removeAttribute('style');
      host.insertAdjacentElement('afterbegin', stray);
      return stray;
    }
    var fresh = document.createElement('div');
    fresh.className = 'github-heatmap';
    host.insertAdjacentElement('afterbegin', fresh);
    return fresh;
  }

  function boot() {
    var host = document.getElementById('recent-posts');
    if (!host) return;
    var container = ensureContainer(host);
    if (container.getAttribute('data-hm-rendered') === '1') {
      purgeStrays(container);
      return;
    }

    injectStyle();

    var data = window.__BLOG_HEATMAP__;
    if (data && data.counts) { render(container, data); purgeStrays(container); return; }

    // 兜底：数据缺失（例如直接双击打开 public/index.html）时尝试拉取同源 JSON
    container.innerHTML = '<div class="hm-head"><strong>📊 创作热力图</strong><span>数据加载中…</span></div>';
    fetch('/js/heatmap-data.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) { json && json.counts ? render(container, json) : fallback(container); })
      .catch(function () { fallback(container); })
      .then(function () { purgeStrays(container); });
  }

  /** 清掉重复/遗留在别处的热力图容器（旧的静态图容器也在这里被替换掉） */
  function purgeStrays(keep) {
    var all = document.querySelectorAll('div.github-heatmap');
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== keep) all[i].parentNode.removeChild(all[i]);
    }
  }

  function fallback(container) {
    container.innerHTML = '<div class="hm-head"><strong>📊 创作热力图</strong>' +
      '<span>数据不可用，请重新构建站点（hexo generate）</span></div>';
  }

  function start() {
    boot();
    // 兼容 pjax / 前进后退缓存等场景，DOM 被替换后再次渲染
    document.addEventListener('pjax:complete', boot);
    document.addEventListener('pjax:success', boot);
    window.addEventListener('pageshow', boot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
