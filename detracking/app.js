/* ------------------------------------------------------------------
   Shared behaviour: language toggle and charts.
   No storage APIs — language travels in the URL (?lang=en).
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- language ---------- */
  var LANGS = { 'zh-Hant': 'ENGLISH', 'en': '中文' };

  function currentLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en') return 'en';
    if (q === 'zh') return 'zh-Hant';
    return document.documentElement.getAttribute('lang') || 'zh-Hant';
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);
    $$('.btn-lang').forEach(function (b) { b.textContent = LANGS[lang]; });
    // keep internal links carrying the language
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || h.charAt(0) === '#' || /^(https?:|mailto:)/.test(h)) return;
      var base = h.split('?')[0].split('#')[0];
      var hash = h.indexOf('#') > -1 ? h.slice(h.indexOf('#')) : '';
      a.setAttribute('href', base + (lang === 'en' ? '?lang=en' : '') + hash);
    });
    document.title = (lang === 'en'
      ? document.body.getAttribute('data-title-en')
      : document.body.getAttribute('data-title-zh')) || document.title;
    redraw();
  }

  /* ---------- svg helpers ---------- */
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function el(t, a) {
    var e = document.createElementNS(NS, t);
    for (var k in (a || {})) e.setAttribute(k, a[k]);
    return e;
  }
  function txt(t, a, s) { var e = el('text', a); e.textContent = s; return e; }

  var tip = null;
  function ensureTip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(ev, html) {
    var t = ensureTip(); t.innerHTML = html; t.style.opacity = 1; moveTip(ev);
  }
  function moveTip(ev) {
    var t = ensureTip(), r = t.getBoundingClientRect();
    var x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.opacity = 0; }
  document.addEventListener('scroll', hideTip, { passive: true });

  function hover(node, html) {
    node.style.cursor = 'pointer';
    node.addEventListener('mouseenter', function (e) { showTip(e, html); });
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', hideTip);
  }

  function T(zh, en) { return document.documentElement.getAttribute('lang') === 'en' ? en : zh; }

  function fresh(id) {
    var svg = $('#' + id);
    if (!svg) return null;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var g = el('g'); svg.appendChild(g); return g;
  }

  /* =================================================================
     CHART 1 — what the reform changed: weight of test scores
     ================================================================= */
  function cWeight() {
    var g = fresh('cWeight'); if (!g) return;
    var L = 128, R = 800, rowH = 66, top = 22;
    var rows = [
      { lab: T('2014 年以前', 'Before 2014'), sub: T('基本學力測驗', 'Basic Competence Test'), v: 100, c: '--s2' },
      { lab: T('2014 年以後', 'After 2014'), sub: T('國中教育會考', 'CAP, rank-based'), v: 33.3, c: '--s1' }
    ];
    for (var p = 0; p <= 100; p += 25) {
      var x = L + (p / 100) * (R - L);
      g.appendChild(el('line', { x1: x, x2: x, y1: top - 6, y2: top + rowH * 2 - 18, stroke: css('--grid'), 'stroke-width': 1 }));
      g.appendChild(txt(null, { x: x, y: top + rowH * 2 + 2, 'text-anchor': 'middle', class: 'axl' }, p + '%'));
    }
    rows.forEach(function (r, i) {
      var y = top + i * rowH, h = 30;
      g.appendChild(txt(null, { x: L - 16, y: y + 15, 'text-anchor': 'end', class: 'axt' }, r.lab));
      g.appendChild(txt(null, { x: L - 16, y: y + 31, 'text-anchor': 'end', class: 'axl' }, r.sub));
      var w = (r.v / 100) * (R - L);
      var bar = el('rect', { x: L, y: y, width: w, height: h, rx: 4, fill: css(r.c) });
      hover(bar, '<b>' + r.lab + '</b><span>' + T('考試成績占入學積分', 'Test score share of admission points') + '：' + (r.v === 100 ? '100%' : '1/3') + '</span>');
      g.appendChild(bar);
      g.appendChild(txt(null, { x: L + w + 12, y: y + 20, class: 'val' }, r.v === 100 ? '100%' : T('上限 1/3', 'capped at 1/3')));
      if (r.v < 100) {
        g.appendChild(el('rect', { x: L + w + 2, y: y, width: (R - L) - w - 2, height: h, rx: 4, fill: css('--grid') }));
        g.appendChild(txt(null, { x: L + w + (R - L - w) / 2 + 40, y: y + 20, 'text-anchor': 'middle', class: 'axl' },
          T('多元學習表現、志願序等', 'multi-literacy, preference order, etc.')));
      }
    });
  }

  /* =================================================================
     CHART 2 — how homogeneous is a school? within-school SD
     ================================================================= */
  function cSD() {
    var g = fresh('cSD'); if (!g) return;
    var L = 150, R = 780, top = 30, rowH = 62, MAX = 280;
    var rows = [
      { lab: T('國中（住家學區分發）', 'Middle school (catchment)'), v: 236, nat: 263, c: '--s2',
        note: T('全國標準差的 90%', '90% of national SD') },
      { lab: T('高中・改革前', 'High school, pre-reform'), v: 173, nat: 276, c: '--s1',
        note: T('全國標準差的 63%', '63% of national SD') },
      { lab: T('高中・改革後', 'High school, post-reform'), v: 210, nat: 276, c: '--s1',
        note: T('全國標準差的 76%', '76% of national SD') }
    ];
    for (var v = 0; v <= MAX; v += 70) {
      var x = L + (v / MAX) * (R - L);
      g.appendChild(el('line', { x1: x, x2: x, y1: top - 8, y2: top + rowH * 3 - 22, stroke: css('--grid'), 'stroke-width': 1 }));
      g.appendChild(txt(null, { x: x, y: top + rowH * 3 - 4, 'text-anchor': 'middle', class: 'axl' }, v));
    }
    g.appendChild(txt(null, { x: (L + R) / 2, y: top + rowH * 3 + 16, 'text-anchor': 'middle', class: 'axl' },
      T('校內學生成績的標準差（PISA 三科總分）', 'Within-school SD of student scores (PISA 3-subject total)')));

    rows.forEach(function (r, i) {
      var y = top + i * rowH, h = 26;
      g.appendChild(txt(null, { x: L - 16, y: y + 13, 'text-anchor': 'end', class: 'axt' }, r.lab));
      g.appendChild(txt(null, { x: L - 16, y: y + 29, 'text-anchor': 'end', class: 'axl' }, r.note));
      var w = (r.v / MAX) * (R - L);
      var bar = el('rect', { x: L, y: y, width: w, height: h, rx: 4, fill: css(r.c) });
      hover(bar, '<b>' + r.lab + '</b><span>' + T('校內標準差', 'Within-school SD') + '：' + r.v +
        '</span><span>' + T('全國標準差', 'National SD') + '：' + r.nat + '</span>');
      g.appendChild(bar);
      g.appendChild(txt(null, { x: L + w + 10, y: y + 19, class: 'val' }, r.v));
      var nx = L + (r.nat / MAX) * (R - L);
      g.appendChild(el('line', { x1: nx, x2: nx, y1: y - 5, y2: y + h + 5, stroke: css('--axis'), 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
    });
    g.appendChild(txt(null, { x: R, y: top - 14, 'text-anchor': 'end', class: 'axl' },
      T('虛線＝該學制全體學生的落差（不分流的基準）', 'dashed = national spread for that level (the no-sorting benchmark)')));
  }

  /* =================================================================
     CHART 3 — the DiD 2x2 schematic
     ================================================================= */
  function cDiD() {
    var g = fresh('cDiD'); if (!g) return;
    var L = 130, R = 790, T0 = 40, B = 210;
    var xPre = L + 130, xPost = R - 110;
    g.appendChild(el('line', { x1: L, x2: R, y1: B, y2: B, stroke: css('--axis'), 'stroke-width': 1 }));
    [[xPre, T('改革前', 'Pre-reform'), '2006 · 2009 · 2012'],
     [xPost, T('改革後', 'Post-reform'), '2015 · 2018 · 2022']].forEach(function (d) {
      g.appendChild(txt(null, { x: d[0], y: B + 22, 'text-anchor': 'middle', class: 'axt' }, d[1]));
      g.appendChild(txt(null, { x: d[0], y: B + 39, 'text-anchor': 'middle', class: 'axl' }, d[2]));
    });
    var mid = (xPre + xPost) / 2;
    g.appendChild(el('line', { x1: mid, x2: mid, y1: T0 - 18, y2: B, stroke: css('--s4'), 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
    g.appendChild(txt(null, { x: mid, y: T0 - 24, 'text-anchor': 'middle', class: 'axl', fill: css('--s4') },
      T('2014 改革上路', '2014 reform')));

    // control (middle school) — flat-ish rise
    var cy1 = 150, cy2 = 118;
    g.appendChild(el('path', { d: 'M' + xPre + ' ' + cy1 + 'L' + xPost + ' ' + cy2, stroke: css('--s2'), 'stroke-width': 2.4, fill: 'none' }));
    // treated actual
    var ty1 = 92, ty2 = 100;
    g.appendChild(el('path', { d: 'M' + xPre + ' ' + ty1 + 'L' + xPost + ' ' + ty2, stroke: css('--s1'), 'stroke-width': 2.4, fill: 'none' }));
    // counterfactual
    var cf = ty1 - (cy1 - cy2);
    g.appendChild(el('path', { d: 'M' + xPre + ' ' + ty1 + 'L' + xPost + ' ' + cf, stroke: css('--s1'), 'stroke-width': 1.8, fill: 'none', 'stroke-dasharray': '5 4', opacity: .65 }));

    [[xPre, cy1], [xPost, cy2]].forEach(function (p) {
      g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 5.5, fill: css('--s2'), stroke: css('--surface-1'), 'stroke-width': 2 }));
    });
    [[xPre, ty1], [xPost, ty2]].forEach(function (p) {
      g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 5.5, fill: css('--s1'), stroke: css('--surface-1'), 'stroke-width': 2 }));
    });
    g.appendChild(el('circle', { cx: xPost, cy: cf, r: 4.5, fill: css('--surface-1'), stroke: css('--s1'), 'stroke-width': 2 }));

    // the gap bracket
    var bx = xPost + 26;
    g.appendChild(el('path', { d: 'M' + bx + ' ' + cf + 'L' + (bx + 9) + ' ' + cf + 'L' + (bx + 9) + ' ' + ty2 + 'L' + bx + ' ' + ty2, stroke: css('--ink'), 'stroke-width': 1.4, fill: 'none' }));
    g.appendChild(txt(null, { x: bx + 16, y: (cf + ty2) / 2 - 4, class: 'hd' }, T('政策效果', 'policy effect')));
    g.appendChild(txt(null, { x: bx + 16, y: (cf + ty2) / 2 + 13, class: 'axl' }, T('= 兩條線的差', '= difference of differences')));

    g.appendChild(txt(null, { x: xPre - 14, y: ty1 + 4, 'text-anchor': 'end', class: 'axt', fill: css('--s1') }, T('高中生（受影響）', 'Grade 10 (treated)')));
    g.appendChild(txt(null, { x: xPre - 14, y: cy1 + 4, 'text-anchor': 'end', class: 'axt', fill: css('--s2') }, T('國中生（未受影響）', 'Grade 9 (control)')));
    g.appendChild(txt(null, { x: L, y: T0 - 4, class: 'axl' }, T('成績（示意，非實際數值）', 'Outcome (schematic, not actual values)')));
    g.appendChild(txt(null, { x: xPost + 12, y: cf - 10, class: 'axl', fill: css('--s1') }, T('沒有改革的話', 'counterfactual')));
  }

  /* =================================================================
     CHART 4 — quantile treatment effects
     ================================================================= */
  function cQuant() {
    var g = fresh('cQuant'); if (!g) return;
    var D = [
      { q: 'p10', b: -57.00, se: 20.22, lab: T('最低 10%', 'bottom 10%') },
      { q: 'p25', b: -55.05, se: 16.74, lab: T('後段 25%', '25th pct') },
      { q: 'p50', b: -52.97, se: 14.50, lab: T('中位數', 'median') },
      { q: 'p75', b: -51.17, se: 14.34, lab: T('前段 25%', '75th pct') },
      { q: 'p90', b: -49.76, se: 15.42, lab: T('最高 10%', 'top 10%') }
    ];
    var L = 92, R = 800, T0 = 34, B = 216, LO = -110, HI = 20;
    function y(v) { return B - ((v - LO) / (HI - LO)) * (B - T0); }
    for (var v = -100; v <= 20; v += 20) {
      g.appendChild(el('line', { x1: L, x2: R, y1: y(v), y2: y(v), stroke: css('--grid'), 'stroke-width': 1 }));
      g.appendChild(txt(null, { x: L - 12, y: y(v) + 4, 'text-anchor': 'end', class: 'axl' }, v));
    }
    g.appendChild(el('line', { x1: L, x2: R, y1: y(0), y2: y(0), stroke: css('--axis'), 'stroke-width': 1.5 }));
    g.appendChild(txt(null, { x: R, y: y(0) - 8, 'text-anchor': 'end', class: 'axl' }, T('← 這條線上方＝沒有影響', '← above this line = no effect')));
    var step = (R - L) / D.length;
    D.forEach(function (d, i) {
      var x = L + step * (i + 0.5);
      var lo = d.b - 1.96 * d.se, hi = d.b + 1.96 * d.se;
      g.appendChild(el('line', { x1: x, x2: x, y1: y(lo), y2: y(hi), stroke: css('--s1'), 'stroke-width': 2, opacity: .45 }));
      [lo, hi].forEach(function (e) {
        g.appendChild(el('line', { x1: x - 6, x2: x + 6, y1: y(e), y2: y(e), stroke: css('--s1'), 'stroke-width': 2, opacity: .45 }));
      });
      var dot = el('circle', { cx: x, cy: y(d.b), r: 6, fill: css('--s1'), stroke: css('--surface-1'), 'stroke-width': 2 });
      hover(dot, '<b>' + d.lab + '</b><span>' + T('效果', 'effect') + '：' + d.b.toFixed(1) + ' ' + T('分', 'points') +
        '</span><span>95% CI：' + lo.toFixed(0) + ' ~ ' + hi.toFixed(0) + '</span>');
      g.appendChild(dot);
      g.appendChild(txt(null, { x: x, y: y(d.b) - 14, 'text-anchor': 'middle', class: 'val' }, d.b.toFixed(0)));
      g.appendChild(txt(null, { x: x, y: B + 20, 'text-anchor': 'middle', class: 'axt' }, d.q));
      g.appendChild(txt(null, { x: x, y: B + 36, 'text-anchor': 'middle', class: 'axl' }, d.lab));
    });
    g.appendChild(txt(null, { x: L - 12, y: T0 - 12, class: 'axl' }, T('對總分的影響（分）', 'Effect on total score (points)')));
  }

  /* =================================================================
     CHART 5 — resource reallocation by achievement quartile
     ================================================================= */
  function cResource() {
    var g = fresh('cResource'); if (!g) return;
    var panels = [
      { title: T('同儕的平均成績', "Peers' average score"),
        unit: T('分', 'points'), max: 110,
        D: [{ q: 'Q1', v: 75.97 }, { q: 'Q2', v: 54.01 }, { q: 'Q3', v: 16.14 }, { q: 'Q4', v: -92.31 }] },
      { title: T('學校教師具學士以上比例', 'Share of teachers with a degree'),
        unit: T('百分點', 'pp'), max: 20,
        D: [{ q: 'Q1', v: 11.64 }, { q: 'Q2', v: 4.49 }, { q: 'Q3', v: 1.02 }, { q: 'Q4', v: -16.05 }] }
    ];
    var PW = 336, GAP = 62, L0 = 100, T0 = 46, B = 200;
    panels.forEach(function (p, pi) {
      var L = L0 + pi * (PW + GAP), R = L + PW;
      var zero = L + (p.max / (p.max * 2)) * (R - L);
      g.appendChild(txt(null, { x: L, y: T0 - 22, class: 'hd' }, p.title));
      g.appendChild(txt(null, { x: L, y: T0 - 6, class: 'axl' }, T('相對於改革前的變化（', 'change relative to pre-reform (') + p.unit + '）'));
      var rowH = (B - T0) / 4;
      p.D.forEach(function (d, i) {
        var y = T0 + i * rowH + 6, h = rowH - 16;
        var w = (Math.abs(d.v) / (p.max * 2)) * (R - L);
        var x = d.v >= 0 ? zero + 1 : zero - w - 1;
        var bar = el('rect', { x: x, y: y, width: Math.max(w, 1), height: h, rx: 3, fill: css(d.v >= 0 ? '--s3' : '--s2') });
        hover(bar, '<b>' + d.q + '　' + (d.q === 'Q1' ? T('成績最低的四分之一', 'lowest quartile') : d.q === 'Q4' ? T('成績最高的四分之一', 'top quartile') : T('中間', 'middle')) +
          '</b><span>' + (d.v > 0 ? '+' : '') + d.v.toFixed(1) + ' ' + p.unit + '</span>');
        g.appendChild(bar);
        g.appendChild(txt(null, { x: d.v >= 0 ? x + w + 8 : x - 8, y: y + h / 2 + 4, 'text-anchor': d.v >= 0 ? 'start' : 'end', class: 'val' },
          (d.v > 0 ? '+' : '') + d.v.toFixed(1)));
        if (pi === 0) {
          g.appendChild(txt(null, { x: L0 - 16, y: y + h / 2 + 4, 'text-anchor': 'end', class: 'axt' },
            d.q + '　' + (d.q === 'Q1' ? T('成績最低', 'lowest') : d.q === 'Q4' ? T('成績最高', 'highest') : '')));
        }
      });
      g.appendChild(el('line', { x1: zero, x2: zero, y1: T0, y2: B, stroke: css('--axis'), 'stroke-width': 1.2 }));
    });
  }

  /* =================================================================
     CHART 6 — two equity gains and one cost, side by side
     ================================================================= */
  function cTradeoff() {
    var g = fresh('cTradeoff'); if (!g) return;
    var items = [
      { x: 16, c: '--s3', k: T('公平面 ①　均質化', 'Equity ①　Levelling'), big: '+30',
        sub: T('校內學生程度差距（分）', 'within-school spread (points)'),
        note: T('學校之間的分層鬆開約一半，明星學校不再只收同一種學生', 'about half the sorting gap closed; top schools no longer take only one kind of student') },
      { x: 314, c: '--s3', k: T('公平面 ②　機會均等', 'Equity ②　Access'), big: '+76',
        sub: T('後段學生的同儕平均成績（分）', "bottom quartile's peer average (points)"),
        note: T('同一批學生的學校教師學歷比例也上升 11.6 個百分點', 'their schools also had 11.6pp more teachers with a degree') },
      { x: 612, c: '--s2', k: T('代　價', 'The cost'), big: '−50',
        sub: T('平均總分（分）＝ −0.18 個標準差', 'average total score (points) = −0.18 SD'),
        note: T('高分低分的學生一起掉，沒有哪一群人因此受惠', 'the decline is uniform; no group came out ahead') }
    ];
    var W = 272, H = 196;
    items.forEach(function (it) {
      g.appendChild(el('rect', { x: it.x, y: 20, width: W, height: H, rx: 6, fill: 'none', stroke: css('--hair'), 'stroke-width': 1 }));
      g.appendChild(el('rect', { x: it.x, y: 20, width: 4, height: H, rx: 2, fill: css(it.c) }));
      g.appendChild(txt(null, { x: it.x + 20, y: 48, class: 'axl', fill: css(it.c) }, it.k));
      var b = txt(null, { x: it.x + 20, y: 108, class: 'val' }, it.big);
      b.setAttribute('style', 'font-size:46px;font-weight:700;fill:' + css(it.c));
      g.appendChild(b);
      wrapText(g, it.sub, it.x + 20, 134, W - 38, 17, 'axt');
      wrapText(g, it.note, it.x + 20, 172, W - 38, 17, 'axl');
    });
  }

  function wrapText(g, s, x, y, maxw, lh, cls) {
    // crude CJK/latin wrapper: fits by estimated advance width
    var lang = document.documentElement.getAttribute('lang');
    var out = [], line = '';
    var adv = lang === 'en' ? 6.6 : 12.6;
    var units = lang === 'en' ? s.split(' ') : s.split('');
    units.forEach(function (u) {
      var cand = line + (lang === 'en' && line ? ' ' : '') + u;
      if (cand.length * adv > maxw) { out.push(line); line = u; } else { line = cand; }
    });
    if (line) out.push(line);
    out.slice(0, 3).forEach(function (l, i) { g.appendChild(txt(null, { x: x, y: y + i * lh, class: cls }, l)); });
  }

  /* =================================================================
     CHART 7 — pairwise text overlap between five versions (story page)
     ================================================================= */
  function cOverlap() {
    var g = fresh('cOverlap'); if (!g) return;
    var L = [
      { k: 'seg', zh: '隔離報告', en: 'Segregation', y: '2020' },
      { k: 'trk', zh: '分流報告', en: 'Tracking', y: '2021' },
      { k: 'pa',  zh: '研討會',  en: 'Conference', y: '2022' },
      { k: 'sub', zh: '投稿版',  en: 'Submitted', y: '2025' },
      { k: 'fin', zh: '刊出版',  en: 'Published', y: '2026' }
    ];
    var M = {
      'seg-trk': 1.8, 'seg-pa': 2.4, 'seg-sub': 0.6, 'seg-fin': 1.0,
      'trk-pa': 11.6, 'trk-sub': 25.5, 'trk-fin': 16.6,
      'pa-sub': 5.8, 'pa-fin': 4.7,
      'sub-fin': 51.1
    };
    var X0 = 208, Y0 = 62, CW = 128, CH = 60, MAXV = 55;
    // column headers (versions 1..4 are columns; last is not needed as a column start)
    L.forEach(function (c, ci) {
      if (ci === 4) return;
      var x = X0 + ci * CW;
      g.appendChild(txt(null, { x: x + CW / 2, y: Y0 - 24, 'text-anchor': 'middle', class: 'axt' }, T(c.zh, c.en)));
      g.appendChild(txt(null, { x: x + CW / 2, y: Y0 - 9, 'text-anchor': 'middle', class: 'axl' }, c.y));
    });
    L.forEach(function (r, ri) {
      if (ri === 0) return;
      var y = Y0 + (ri - 1) * CH;
      g.appendChild(txt(null, { x: X0 - 18, y: y + CH / 2 - 2, 'text-anchor': 'end', class: 'axt' }, T(r.zh, r.en)));
      g.appendChild(txt(null, { x: X0 - 18, y: y + CH / 2 + 14, 'text-anchor': 'end', class: 'axl' }, r.y));
      L.forEach(function (c, ci) {
        if (ci >= ri) return;
        var v = M[c.k + '-' + r.k];
        if (v === undefined) return;
        var x = X0 + ci * CW;
        var op = 0.10 + 0.90 * Math.pow(v / MAXV, 0.72);
        var cell = el('rect', { x: x + 2, y: y + 2, width: CW - 4, height: CH - 4, rx: 4,
          fill: css('--s1'), 'fill-opacity': op.toFixed(3) });
        hover(cell, '<b>' + T(c.zh, c.en) + ' ' + c.y + '　↔　' + T(r.zh, r.en) + ' ' + r.y +
          '</b><span>' + T('兩篇共有的八字連續片語，佔較短那篇的', 'shared 8-word strings, as a share of the shorter paper') +
          '：<b style="display:inline">' + v.toFixed(1) + '%</b></span>');
        g.appendChild(cell);
        var t = txt(null, { x: x + CW / 2, y: y + CH / 2 + 5, 'text-anchor': 'middle', class: 'val' }, v.toFixed(1) + '%');
        // inline style beats the stylesheet's fill rule
        t.style.fill = op > 0.52 ? css('--surface-1') : css('--ink');
        g.appendChild(t);
      });
    });
    // scale strip
    var SX = X0, SY = Y0 + 4 * CH + 40, SW = 200, SH = 12;
    for (var i = 0; i < 40; i++) {
      var frac = i / 39;
      g.appendChild(el('rect', { x: SX + frac * SW, y: SY, width: SW / 39 + 0.6, height: SH,
        fill: css('--s1'), 'fill-opacity': (0.10 + 0.90 * Math.pow(frac, 0.72)).toFixed(3) }));
    }
    g.appendChild(txt(null, { x: SX - 10, y: SY + 10, 'text-anchor': 'end', class: 'axl' }, '0%'));
    g.appendChild(txt(null, { x: SX + SW + 10, y: SY + 10, class: 'axl' }, '55%'));
    g.appendChild(txt(null, { x: SX, y: SY - 10, class: 'axl' },
      T('文字重疊率（八字連續片語，佔較短那篇的比例）', 'Text overlap (8-word strings, as a share of the shorter paper)')));
  }

  /* =================================================================
     CHART 8 — data scale (story + index)
     ================================================================= */
  function cWaves() {
    var g = fresh('cWaves'); if (!g) return;
    var W = [2006, 2009, 2012, 2015, 2018, 2022];
    var L = 70, R = 830, y = 84;
    g.appendChild(el('line', { x1: L, x2: R, y1: y, y2: y, stroke: css('--hair-2'), 'stroke-width': 2 }));
    var rx = L + ((2014 - 2006) / (2022 - 2006)) * (R - L);
    g.appendChild(el('line', { x1: rx, x2: rx, y1: 26, y2: 128, stroke: css('--s4'), 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
    g.appendChild(txt(null, { x: rx, y: 20, 'text-anchor': 'middle', class: 'axt', fill: css('--s4') }, T('2014 改革上路', '2014 reform')));
    W.forEach(function (w) {
      var x = L + ((w - 2006) / (2022 - 2006)) * (R - L);
      var pre = w < 2014;
      var c = css(pre ? '--s2' : '--s1');
      var dot = el('circle', { cx: x, cy: y, r: 11, fill: c, stroke: css('--surface-1'), 'stroke-width': 2.5 });
      hover(dot, '<b>PISA ' + w + '</b><span>' + (pre ? T('改革前', 'pre-reform') : T('改革後', 'post-reform')) + '</span>');
      g.appendChild(dot);
      g.appendChild(txt(null, { x: x, y: y + 34, 'text-anchor': 'middle', class: 'axt' }, w));
    });
    g.appendChild(txt(null, { x: L - 6, y: 52, class: 'axl', fill: css('--s2') }, T('改革前三次', 'three pre-reform waves')));
    g.appendChild(txt(null, { x: R + 6, y: 52, 'text-anchor': 'end', class: 'axl', fill: css('--s1') }, T('改革後三次', 'three post-reform waves')));
  }

  /* ---------- redraw all ---------- */
  function redraw() {
    [cWeight, cSD, cDiD, cQuant, cResource, cTradeoff, cOverlap, cWaves].forEach(function (f) {
      try { f(); } catch (e) { /* a missing chart on this page is fine */ }
    });
  }

  /* ---------- section nav: scrollspy ---------- */
  function setupSpy() {
    var nav = $('#secnav'); if (!nav) return;
    var links = $$('a[href^="#"]', nav);
    var targets = links.map(function (a) {
      return { a: a, el: document.getElementById(a.getAttribute('href').slice(1)) };
    }).filter(function (t) { return t.el; });
    if (!targets.length) return;

    function barHeight() {
      var b = $('.topbar');
      return b ? b.getBoundingClientRect().height : 0;
    }
    function mark() {
      var off = barHeight() + 24, cur = targets[0];
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top <= off) cur = t;
      });
      // at the very bottom of the page, highlight the last section
      var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (innerHeight + Math.ceil(scrollY) >= docH - 2) cur = targets[targets.length - 1];
      // above the first heading, highlight nothing
      var above = targets[0].el.getBoundingClientRect().top > off;
      links.forEach(function (a) { a.classList.remove('active'); });
      if (!above) {
        cur.a.classList.add('active');
        // keep the active chip visible inside the scrollable strip
        var nr = nav.getBoundingClientRect(), ar = cur.a.getBoundingClientRect();
        if (ar.left < nr.left + 8) nav.scrollLeft += ar.left - nr.left - 8;
        else if (ar.right > nr.right - 8) nav.scrollLeft += ar.right - nr.right + 8;
      }
    }
    var ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { mark(); ticking = false; });
    }, { passive: true });
    addEventListener('resize', mark);
    mark();
  }

  /* ---------- story timeline: collapsible ---------- */
  function setItem(item, open) {
    item.classList.toggle('open', open);
    var btn = $('.tl-toggle', item);
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function setupTimeline() {
    var tl = $('.tl'); if (!tl || tl.getAttribute('data-ready')) return;
    $$('.tl-item', tl).forEach(function (item) {
      var body = $('.tl-body', item); if (!body) return;
      var head = document.createElement('button');
      head.type = 'button'; head.className = 'tl-toggle';
      head.setAttribute('aria-expanded', 'false');
      var detail = document.createElement('div');
      detail.className = 'tl-detail';
      Array.prototype.slice.call(body.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && (n.classList.contains('tl-tag') || n.classList.contains('tl-h'))) head.appendChild(n);
        else detail.appendChild(n);
      });
      body.appendChild(head); body.appendChild(detail);
      head.addEventListener('click', function () { setItem(item, !item.classList.contains('open')); });
    });
    tl.classList.add('is-collapsible');
    tl.setAttribute('data-ready', '1');
    var all = $('.tl-all'), none = $('.tl-none');
    if (all) all.addEventListener('click', function () {
      $$('.tl-item', tl).forEach(function (i) { setItem(i, true); });
    });
    if (none) none.addEventListener('click', function () {
      $$('.tl-item', tl).forEach(function (i) { setItem(i, false); });
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    setupTimeline();
    applyLang(currentLang());
    setupSpy();
    $$('.btn-lang').forEach(function (b) {
      b.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('lang') === 'en' ? 'zh-Hant' : 'en';
        var u = new URL(location.href);
        if (next === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang');
        history.replaceState(null, '', u);
        applyLang(next);
      });
    });
    addEventListener('resize', function () { clearTimeout(window.__rz); window.__rz = setTimeout(redraw, 180); });
  });
})();
