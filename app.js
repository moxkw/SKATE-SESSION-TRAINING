(function () {
  'use strict';

  /* ---------- Cấu hình ---------- */
  var PHASES = [
    { key: 'warmup', name: 'Khởi động', min: 10, trick: false, hint: 'Lăn ván nhẹ, xoay cổ chân, nhún gối nhẹ.' },
    { key: 'ollie', name: 'Ollie', min: 8, trick: true, hint: 'Mỗi set 2–3 lần, nghỉ giữa các set. Tiếp đất chắc quan trọng hơn độ cao.' },
    { key: 'fakie', name: 'Fakie Ollie', min: 8, trick: true, hint: 'Giữ tốc độ quen thuộc, mỗi set 2–3 lần. Ưu tiên tiếp đất cân bằng.' },
    { key: 'cooldown', name: 'Hạ nhiệt', min: 7, trick: false, hint: 'Đi bộ nhẹ hoặc lăn ván chậm, thả lỏng cơ thể.' }
  ];
  var STATUS = { idle: 'Chưa bắt đầu', running: 'Đang tập', paused: 'Đang nghỉ', done: 'Đã hoàn thành' };
  var KEY_ACTIVE = 'skateSession.active.v1';
  var KEY_HIST = 'skateSession.history.v1';
  var KEY_THEME = 'skateSession.theme.v1';
  var TOTAL_MS = PHASES.reduce(function (a, p) { return a + p.min * 60000; }, 0);

  function $(id) { return document.getElementById(id); }
  function dur(i) { return PHASES[i].min * 60000; }
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function pct(c, t) { return t ? Math.round((c / t) * 100) + '%' : '—'; }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }

  /* ---------- Lưu trữ an toàn ---------- */
  var mem = {};
  var storageOK = true;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); } catch (e) { storageOK = false; }
  function sGet(k) {
    if (storageOK) { try { return localStorage.getItem(k); } catch (e) { storageOK = false; } }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  }
  function sSet(k, v) {
    if (storageOK) { try { localStorage.setItem(k, v); return; } catch (e) { storageOK = false; } }
    mem[k] = v;
  }
  function sDel(k) {
    if (storageOK) { try { localStorage.removeItem(k); } catch (e) { storageOK = false; } }
    delete mem[k];
  }
  function loadJSON(k, fb) {
    try { var r = sGet(k); return r ? JSON.parse(r) : fb; } catch (e) { return fb; }
  }
  function getHistory() {
    var h = loadJSON(KEY_HIST, []);
    return Array.isArray(h) ? h.filter(function (e) { return e && e.id && e.ollie && e.fakie; }) : [];
  }

  /* ---------- Trạng thái buổi tập ---------- */
  function newSession() {
    return {
      id: null, status: 'idle', idx: 0, phaseEnd: 0, remaining: dur(0),
      spent: [0, 0, 0, 0],
      counts: { ollie: { tries: 0, clean: 0 }, fakie: { tries: 0, clean: 0 } },
      undo: { ollie: [], fakie: [] },
      feel: null, startedAt: null, saved: false, tooShort: false
    };
  }
  var S = newSession();
  var pending = null;
  var ticker = null;
  var lastPersist = 0;

  function startTicker() { if (!ticker) ticker = setInterval(tick, 250); }
  function stopTicker() { clearInterval(ticker); ticker = null; }

  function sync(now) {
    var rem = S.phaseEnd - now;
    while (rem <= 0) {
      S.spent[S.idx] = dur(S.idx);
      if (S.idx >= PHASES.length - 1) { S.remaining = 0; finish(); return; }
      S.idx++;
      S.phaseEnd += dur(S.idx);
      rem = S.phaseEnd - now;
    }
    S.remaining = rem;
    S.spent[S.idx] = dur(S.idx) - rem;
  }

  function tick() {
    if (S.status !== 'running') return;
    var before = S.idx;
    sync(Date.now());
    if (S.status === 'running') {
      if (S.idx !== before) toast('Giai đoạn mới: ' + PHASES[S.idx].name);
      persist(false);
    }
    render();
  }

  function startSession() {
    if (S.status !== 'idle') return;
    S = newSession();
    S.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    S.status = 'running';
    S.startedAt = Date.now();
    S.phaseEnd = S.startedAt + dur(0);
    persist(true);
    startTicker();
    render();
  }

  function pauseSession() {
    if (S.status !== 'running') return;
    sync(Date.now());
    if (S.status !== 'running') { render(); return; }
    S.status = 'paused';
    persist(true);
    render();
  }

  function resumeSession() {
    if (S.status !== 'paused') return;
    S.phaseEnd = Date.now() + S.remaining;
    S.status = 'running';
    persist(true);
    startTicker();
    render();
  }

  function skipPhase() {
    if (S.status !== 'running' && S.status !== 'paused') return;
    if (S.status === 'running') {
      sync(Date.now());
      if (S.status !== 'running') { render(); return; }
    }
    if (S.idx >= PHASES.length - 1) { finish(); render(); return; }
    S.idx++;
    S.remaining = dur(S.idx);
    if (S.status === 'running') S.phaseEnd = Date.now() + S.remaining;
    toast('Giai đoạn mới: ' + PHASES[S.idx].name);
    persist(true);
    render();
  }

  function endSession() {
    if (S.status !== 'running' && S.status !== 'paused') return;
    askConfirm('Kết thúc buổi tập?', 'Buổi tập sẽ được lưu vào nhật ký với thời gian bạn đã tập. Bạn có thể dừng bất kỳ lúc nào.', 'Kết thúc').then(function (ok) {
      if (!ok || (S.status !== 'running' && S.status !== 'paused')) return;
      if (S.status === 'running') sync(Date.now());
      finish();
      render();
    });
  }

  function finish() {
    if (S.status === 'done') return;
    S.status = 'done';
    stopTicker();
    sDel(KEY_ACTIVE);
    saveHistory();
  }

  /* ---------- Nhật ký (lưu theo id, không bị trùng) ---------- */
  function saveHistory() {
    var total = Math.round(sum(S.spent) / 1000);
    if (total < 10) { S.tooShort = true; S.saved = false; return; }
    S.tooShort = false;
    var entry = {
      id: S.id,
      date: new Date(S.startedAt).toISOString(),
      durationSec: total,
      ollie: { tries: S.counts.ollie.tries, clean: S.counts.ollie.clean },
      fakie: { tries: S.counts.fakie.tries, clean: S.counts.fakie.clean },
      feel: S.feel
    };
    var h = getHistory();
    var i = h.findIndex(function (x) { return x.id === entry.id; });
    if (i >= 0) h[i] = entry; else h.unshift(entry);
    sSet(KEY_HIST, JSON.stringify(h));
    S.saved = true;
  }

  function persist(force) {
    var now = Date.now();
    if (!force && now - lastPersist < 1000) return;
    lastPersist = now;
    if (S.status === 'running') {
      S.remaining = Math.max(0, S.phaseEnd - now);
      S.spent[S.idx] = dur(S.idx) - S.remaining;
    }
    if (S.status === 'running' || S.status === 'paused') sSet(KEY_ACTIVE, JSON.stringify(S));
  }

  function loadPending() {
    var s = loadJSON(KEY_ACTIVE, null);
    var ok = s && typeof s.idx === 'number' && PHASES[s.idx] && s.counts && s.counts.ollie && s.counts.fakie &&
      Array.isArray(s.spent) && s.spent.length === PHASES.length && s.undo && s.id &&
      (s.status === 'running' || s.status === 'paused');
    pending = ok ? s : null;
  }

  /* ---------- Theo dõi trick ---------- */
  function curKey() {
    var p = PHASES[S.idx];
    return (p.trick && (S.status === 'running' || S.status === 'paused')) ? p.key : null;
  }
  function addAttempt(clean) {
    var k = curKey(); if (!k) return;
    S.counts[k].tries++;
    if (clean) S.counts[k].clean++;
    S.undo[k].push(clean ? 'c' : 'm');
    persist(true); render();
  }
  function undoAttempt() {
    var k = curKey(); if (!k) return;
    var a = S.undo[k].pop(); if (!a) return;
    S.counts[k].tries = Math.max(0, S.counts[k].tries - 1);
    if (a === 'c') S.counts[k].clean = Math.max(0, S.counts[k].clean - 1);
    persist(true); render();
  }
  function resetCounts() {
    var k = curKey(); if (!k) return;
    askConfirm('Đặt lại bộ đếm?', 'Số lần thử và tiếp đất sạch của ' + PHASES[S.idx].name + ' sẽ về 0.', 'Đặt lại').then(function (ok) {
      if (!ok || curKey() !== k) return;
      S.counts[k] = { tries: 0, clean: 0 };
      S.undo[k] = [];
      persist(true); render();
    });
  }

  /* ---------- Hiển thị ---------- */
  var deckBuilt = false;
  function buildDeck() {
    var deck = $('deck');
    PHASES.forEach(function (p, i) {
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.style.flex = String(p.min) + ' 1 0';
      seg.id = 'seg' + i;
      var tr = document.createElement('div'); tr.className = 'track';
      var fill = document.createElement('i'); fill.id = 'fill' + i;
      tr.appendChild(fill);
      var lb = document.createElement('span'); lb.textContent = p.name;
      seg.appendChild(tr); seg.appendChild(lb);
      deck.appendChild(seg);
    });
    deckBuilt = true;
  }

  function render() {
    if (!deckBuilt) buildDeck();
    var st = S.status, p = PHASES[S.idx];
    var rem = st === 'running' ? Math.max(0, S.phaseEnd - Date.now()) : S.remaining;
    function spentOf(i) { return (i === S.idx && st === 'running') ? dur(i) - rem : S.spent[i]; }
    var total = 0;
    PHASES.forEach(function (_, i) {
      var sp = Math.min(dur(i), spentOf(i));
      total += sp;
      $('fill' + i).style.width = (sp / dur(i) * 100).toFixed(1) + '%';
      $('seg' + i).classList.toggle('current', i === S.idx && (st === 'running' || st === 'paused'));
    });
    var percent = Math.min(100, Math.round(total / TOTAL_MS * 100));
    $('deck').setAttribute('aria-valuenow', String(percent));
    $('progressText').textContent = 'Tiến độ ' + percent + '%  —  ' + fmt(total) + ' / ' + fmt(TOTAL_MS);

    $('statusBadge').textContent = STATUS[st];
    $('statusBadge').dataset.state = st;
    $('phaseName').textContent = st === 'done' ? 'Buổi tập đã xong' : p.name;
    $('phaseHint').textContent = st === 'done' ? 'Cảm ơn bạn đã tập vừa sức hôm nay.' : p.hint;
    $('timer').textContent = st === 'done' ? '00:00' : fmt(rem);

    var active = st === 'running' || st === 'paused';
    $('startBtn').hidden = st !== 'idle';
    $('pauseBtn').hidden = st !== 'running';
    $('resumeBtn').hidden = st !== 'paused';
    $('skipBtn').hidden = !active;
    $('endBtn').hidden = !active;
    $('resumeBanner').hidden = !(pending && st === 'idle');

    var k = curKey();
    $('trackPanel').hidden = !k;
    if (k) {
      var c = S.counts[k];
      $('trackTitle').textContent = p.name + ': theo dõi tiếp đất';
      $('trackTries').textContent = c.tries;
      $('trackClean').textContent = c.clean;
      $('trackRate').textContent = pct(c.clean, c.tries);
      $('undoBtn').disabled = S.undo[k].length === 0;
    }
    ['ollie', 'fakie'].forEach(function (key) {
      var cc = S.counts[key];
      $(key + 'Tries').textContent = cc.tries;
      $(key + 'Clean').textContent = cc.clean;
      $(key + 'Rate').textContent = cc.tries ? pct(cc.clean, cc.tries) + ' tiếp đất sạch' : 'Chưa có lần thử';
      $(key === 'ollie' ? 'cardOllie' : 'cardFakie').classList.toggle('active', k === key);
    });

    $('finishCard').hidden = st !== 'done';
    if (st === 'done') {
      $('finishSummary').textContent = 'Thời gian thực tế ' + fmt(sum(S.spent)) + '. Ollie: ' + S.counts.ollie.clean + '/' + S.counts.ollie.tries +
        ' sạch. Fakie Ollie: ' + S.counts.fakie.clean + '/' + S.counts.fakie.tries + ' sạch.';
      $('finishSaved').textContent = S.saved ? 'Đã lưu vào nhật ký trên thiết bị này.' : (S.tooShort ? 'Buổi tập dưới 10 giây nên không lưu.' : 'Chưa lưu được nhật ký.');
      Array.prototype.forEach.call($('feelRow').querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', b.dataset.feel === S.feel ? 'true' : 'false');
      });
    }
    $('storageWarn').hidden = storageOK;
  }

  /* ---------- Toast, modal ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2500);
  }
  function openSheet(id) { $(id).hidden = false; document.body.classList.add('lock'); }
  function closeSheet(id) {
    $(id).hidden = true;
    if (!document.querySelector('.sheet:not([hidden])')) document.body.classList.remove('lock');
  }
  function askConfirm(title, msg, okText) {
    return new Promise(function (resolve) {
      $('confirmTitle').textContent = title;
      $('confirmMsg').textContent = msg;
      $('confirmOk').textContent = okText || 'Đồng ý';
      openSheet('confirmSheet');
      function done(v) {
        $('confirmOk').onclick = null; $('confirmCancel').onclick = null;
        closeSheet('confirmSheet'); resolve(v);
      }
      $('confirmOk').onclick = function () { done(true); };
      $('confirmCancel').onclick = function () { done(false); };
    });
  }

  /* ---------- Lịch sử ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function renderHistory() {
    var list = $('historyList'); list.textContent = '';
    var h = getHistory();
    $('historyEmpty').hidden = h.length > 0;
    h.forEach(function (e) {
      var li = el('li', 'hitem');
      var d = new Date(e.date), ds = e.date;
      try { ds = d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (x) {}
      li.appendChild(el('b', '', ds));
      li.appendChild(el('span', '', 'Thời lượng thực tế: ' + fmt((e.durationSec || 0) * 1000)));
      li.appendChild(el('span', '', 'Ollie: ' + e.ollie.clean + ' sạch / ' + e.ollie.tries + ' thử (' + pct(e.ollie.clean, e.ollie.tries) + ')'));
      li.appendChild(el('span', '', 'Fakie Ollie: ' + e.fakie.clean + ' sạch / ' + e.fakie.tries + ' thử (' + pct(e.fakie.clean, e.fakie.tries) + ')'));
      li.appendChild(el('span', 'muted', 'Cảm giác: ' + (e.feel || 'chưa ghi')));
      list.appendChild(li);
    });
    $('exportBtn').disabled = h.length === 0;
    $('clearHistoryBtn').disabled = h.length === 0;
  }
  function openExport() {
    $('exportText').value = JSON.stringify({ app: 'skate-session', exportedAt: new Date().toISOString(), sessions: getHistory() }, null, 2);
    openSheet('exportSheet');
  }
  function downloadJSON() {
    try {
      var blob = new Blob([$('exportText').value], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'skate-session-nhat-ky.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { toast('Không tải được file. Hãy dùng nút Sao chép.'); }
  }
  function copyJSON() {
    var ta = $('exportText');
    function fallback() {
      try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); toast(document.execCommand('copy') ? 'Đã sao chép' : 'Hãy chạm giữ để sao chép'); }
      catch (e) { toast('Hãy chạm giữ để sao chép'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(function () { toast('Đã sao chép'); }, fallback);
    } else fallback();
  }
  function clearHistory() {
    askConfirm('Xóa toàn bộ lịch sử?', 'Mọi buổi tập đã lưu sẽ bị xóa khỏi thiết bị này. Không thể hoàn tác.', 'Xóa lịch sử').then(function (ok) {
      if (!ok) return;
      sDel(KEY_HIST); renderHistory(); render();
    });
  }
  function resetApp() {
    askConfirm('Đặt lại ứng dụng?', 'Xóa nhật ký, buổi tập đang dở và cài đặt giao diện. Không thể hoàn tác.', 'Đặt lại').then(function (ok) {
      if (!ok) return;
      stopTicker();
      [KEY_HIST, KEY_ACTIVE, KEY_THEME].forEach(sDel);
      S = newSession(); pending = null;
      applyTheme('dark');
      closeSheet('historySheet');
      render();
      toast('Đã đặt lại ứng dụng');
    });
  }

  /* ---------- Giao diện, ngày, icon ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('themeMeta').setAttribute('content', t === 'light' ? '#f2f0ec' : '#101216');
  }
  function toggleTheme() {
    var t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(t); sSet(KEY_THEME, t);
  }
  function renderDate() {
    var s = '';
    try { s = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }); }
    catch (e) { s = new Date().toDateString(); }
    $('dateText').textContent = s;
    $('totalText').textContent = 'Tổng ' + TOTAL_MS / 60000 + ' phút';
  }
  function makeTouchIcon() {
    try {
      var c = document.createElement('canvas'); c.width = 180; c.height = 180;
      var x = c.getContext('2d');
      x.fillStyle = '#101216'; x.fillRect(0, 0, 180, 180);
      x.strokeStyle = '#ff6a1f'; x.lineWidth = 28; x.lineCap = 'round';
      x.beginPath(); x.moveTo(42, 84); x.lineTo(138, 84); x.stroke();
      x.fillStyle = '#f3efe8';
      [[62, 120], [118, 120]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 11, 0, Math.PI * 2); x.fill(); });
      $('touchIcon').setAttribute('href', c.toDataURL('image/png'));
    } catch (e) { /* giữ icon SVG dự phòng */ }
  }

  /* ---------- Service Worker ---------- */
  function setOffline(t) { $('offlineText').textContent = t; }
  function registerSW() {
    if (!('serviceWorker' in navigator)) { setOffline('Trình duyệt này không hỗ trợ chế độ offline.'); return; }
    if (location.protocol === 'file:') { setOffline('Đang mở bằng file://: chưa có cache offline. Hãy mở qua localhost hoặc GitHub Pages (HTTPS).'); return; }
    navigator.serviceWorker.register('sw.js')
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function () { setOffline('Đã cache xong. Có thể dùng khi mất mạng.'); })
      .catch(function () { setOffline('Chưa cài được cache offline (cần HTTPS hoặc localhost).'); });
  }

  /* ---------- Khởi tạo ---------- */
  function bind(id, fn) { $(id).addEventListener('click', fn); }
  function init() {
    applyTheme(sGet(KEY_THEME) === 'light' ? 'light' : 'dark');
    renderDate();
    makeTouchIcon();
    loadPending();
    render();

    bind('startBtn', startSession);
    bind('pauseBtn', pauseSession);
    bind('resumeBtn', resumeSession);
    bind('skipBtn', skipPhase);
    bind('endBtn', endSession);
    bind('cleanBtn', function () { addAttempt(true); });
    bind('missBtn', function () { addAttempt(false); });
    bind('undoBtn', undoAttempt);
    bind('resetCountBtn', resetCounts);
    bind('themeBtn', toggleTheme);
    bind('historyBtn', function () { renderHistory(); openSheet('historySheet'); });
    bind('closeHistory', function () { closeSheet('historySheet'); });
    bind('exportBtn', openExport);
    bind('closeExport', function () { closeSheet('exportSheet'); });
    bind('downloadBtn', downloadJSON);
    bind('copyBtn', copyJSON);
    bind('clearHistoryBtn', clearHistory);
    bind('resetAppBtn', resetApp);
    bind('newBtn', function () { S = newSession(); render(); });
    bind('resumeYes', function () {
      if (!pending) return;
      S = pending; pending = null; S.status = 'paused';
      persist(true); render();
    });
    bind('resumeNo', function () { pending = null; sDel(KEY_ACTIVE); render(); });
    Array.prototype.forEach.call($('feelRow').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        if (S.status !== 'done') return;
        S.feel = b.dataset.feel; saveHistory(); render();
      });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { renderDate(); tick(); render(); }
      else persist(true);
    });
    window.addEventListener('pageshow', function () { renderDate(); tick(); render(); });
    window.addEventListener('pagehide', function () { persist(true); });

    registerSW();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
