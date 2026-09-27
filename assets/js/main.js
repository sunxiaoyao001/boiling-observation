/* 看见沸腾 · 交互脚本
   1) 章节高亮  2) 滚动揭示  3) 加热曲线时间轴
   无框架、无滚动监听，动画只改 transform / opacity。 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 章节高亮 ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = links
    .map(function (a) {
      return document.querySelector(a.getAttribute('href'));
    })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var visible = new Map();
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        });
        var bestId = null;
        var bestRatio = 0;
        visible.forEach(function (ratio, id) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        links.forEach(function (a) {
          a.classList.toggle('is-active', bestId !== null && a.getAttribute('href') === '#' + bestId);
        });
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.15, 0.4, 0.8] }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------- 滚动揭示 ---------- */
  var revealables = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce) {
    revealables.forEach(function (el) {
      el.classList.add('in');
    });
  } else {
    var ro = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            ro.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    revealables.forEach(function (el) {
      ro.observe(el);
    });
  }

  /* ---------- 加热曲线时间轴 ---------- */
  var range = document.getElementById('range');
  var hit = document.getElementById('hit');
  var cursor = document.getElementById('cursor');
  var cursorLine = document.getElementById('cursorLine');
  var rdTime = document.getElementById('rdTime');
  var rdTemp = document.getElementById('rdTemp');
  var rdPhase = document.getElementById('rdPhase');
  var scrubTime = document.getElementById('scrubTime');
  var scene = document.getElementById('scene');

  if (!range || !cursor) return;

  var T = [22.4, 43.1, 60.5, 73.2, 82.6, 88.4, 92.1, 94.6, 96.4, 97.6, 98.3, 98.7, 98.8, 98.8, 98.9, 98.8, 98.8, 98.7, 98.8];
  var STEP = 30;
  var MAX_T = (T.length - 1) * STEP;
  var PHASES = [
    { until: 180, name: '显热升温', note: '此刻现象：壶底开始出现细密小泡，水面几乎看不出变化，没有响声。热量全部用来抬高温度。' },
    { until: 300, name: '升温趋缓', note: '此刻现象：壶底开始沙沙作响，气泡变大并沿壶壁上浮。温度仍在升，但越来越慢，因为散热在增加。' },
    { until: 480, name: '沸腾平台', note: '此刻现象：整个水体剧烈翻滚，壶口冒出白雾。温度几乎不再变化，热量转为汽化潜热。' },
    { until: MAX_T, name: '余汽化', note: '此刻现象：翻滚趋于平稳，壶内蒸汽增多。沸点平台上继续输入的热量仍在被汽化吃掉。' }
  ];

  function x(t) {
    return 70 + (t / MAX_T) * 790;
  }
  function y(v) {
    return 350 - ((v - 20) / 80) * 320;
  }
  function tempAt(t) {
    var i = Math.min(Math.floor(t / STEP), T.length - 2);
    var f = (t - i * STEP) / STEP;
    return T[i] + (T[i + 1] - T[i]) * f;
  }
  function phaseAt(t) {
    for (var i = 0; i < PHASES.length; i++) {
      if (t <= PHASES[i].until) return PHASES[i];
    }
    return PHASES[PHASES.length - 1];
  }

  function drawSeries() {
    var d = '';
    var dots = '';
    for (var i = 0; i < T.length; i++) {
      var px = x(i * STEP).toFixed(1);
      var py = y(T[i]).toFixed(1);
      d += (i ? 'L' : 'M') + px + ' ' + py + ' ';
      dots += '<circle class="chart__dot" cx="' + px + '" cy="' + py + '" r="2.6"/>';
    }
    var curve = document.getElementById('curve');
    var dotGroup = document.getElementById('dots');
    if (curve) curve.setAttribute('d', d.trim());
    if (dotGroup) dotGroup.innerHTML = dots;
    range.max = String(MAX_T);
  }

  function render(t) {
    var v = tempAt(t);
    var p = phaseAt(t);
    var px = x(t).toFixed(1);
    var py = y(v).toFixed(1);
    var m = Math.floor(t / 60);
    var s = Math.round(t % 60);

    cursor.setAttribute('cx', px);
    cursor.setAttribute('cy', py);
    cursorLine.setAttribute('x1', px);
    cursorLine.setAttribute('x2', px);
    rdTime.textContent = m + ':' + (s < 10 ? '0' + s : s);
    rdTemp.textContent = v.toFixed(1) + ' ℃';
    rdPhase.textContent = p.name;
    scrubTime.textContent = 't = ' + Math.round(t) + ' s ｜ ' + v.toFixed(1) + ' ℃';
    scene.textContent = p.note;
  }

  function setT(t) {
    var clamped = Math.max(0, Math.min(MAX_T, t));
    range.value = String(Math.round(clamped));
    render(clamped);
  }

  range.addEventListener('input', function () {
    render(Number(range.value));
  });

  if (hit) {
    var dragging = false;
    function fromEvent(e) {
      var rect = hit.getBoundingClientRect();
      var vx = ((e.clientX - rect.left) / rect.width) * 900;
      return ((vx - 70) / 790) * MAX_T;
    }
    hit.addEventListener('pointerdown', function (e) {
      dragging = true;
      hit.setPointerCapture(e.pointerId);
      setT(fromEvent(e));
    });
    hit.addEventListener('pointermove', function (e) {
      if (dragging) setT(fromEvent(e));
    });
    hit.addEventListener('pointerup', function (e) {
      dragging = false;
      if (hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId);
    });
    hit.addEventListener('pointercancel', function () {
      dragging = false;
    });
  }

  drawSeries();
  render(0);
})();
