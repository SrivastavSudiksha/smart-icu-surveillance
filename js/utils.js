function randNear(b, r) { return b + (Math.random() - 0.5) * r * 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function getTimestamp() { return new Date().toLocaleTimeString('en-IN', { hour12: false }); }
function getFullTimestamp() { const d = new Date(); return d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour12: false }); }
function pad2(n) { return String(n).padStart(2, '0'); }

function drawSparkline(id, data, color) {
  const svg = document.getElementById(id);
  if (!svg || data.length < 2) return;
  const W = 200, H = 28;
  const lo = Math.min(...data), hi = Math.max(...data), rng = hi - lo || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - 2 - ((v - lo) / rng) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const ly = H - 2 - ((data[data.length-1] - lo) / rng) * (H - 6);
  const gid = id + 'g';
  svg.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.12"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#${gid})" points="0,${H} ${pts} ${W},${H}"/><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/><circle cx="${W}" cy="${ly}" r="2.5" fill="${color}"/>`;
}

function showToast(msg, type = 'info') {
  const shelf = document.getElementById('toastShelf');
  const icons = { critical: '⚠', warning: '!', info: '✓' };
  const t = document.createElement('div');
  t.className = `toast t-${type}`;
  t.innerHTML = `<span>${icons[type] || '·'}</span><span>${msg}</span>`;
  shelf.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideout 0.25s forwards'; setTimeout(() => t.remove(), 250); }, 3200);
}

function startClock() {
  function tick() {
    const now = new Date();
    const el = document.getElementById('railTime');
    if (el) el.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    const sl = document.getElementById('shiftLabel');
    if (sl) {
      const h = now.getHours();
      sl.textContent = h >= 7 && h < 15 ? 'Day Shift' : h >= 15 && h < 23 ? 'Evening Shift' : 'Night Shift';
    }
  }
  tick(); setInterval(tick, 1000);
}

function exportLog() {
  const rows = (window.alertLog || []).map(a => `"${a.ts}","${a.type}","${a.msg}"`).join('\n');
  const blob = new Blob(['Timestamp,Type,Message\n' + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'icu-log-' + Date.now() + '.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Log exported successfully', 'info');
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.rlink').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
}

function triggerDrill() {
  addAlert('DRILL: Simulated PPE violation — verify all ICU entry protocols', 'critical');
  if (window.SMS) SMS.playAlarm('critical');
  showCritical('Drill Alert', 'This is a system drill.\nVerify all ICU entry protocols and PPE equipment.', ['Drill — No real missing items']);
}