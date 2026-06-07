const Protocol = {
  steps: [
    { id: 'hand_wash',  name: 'Hand Sanitization',   desc: 'Wash for ≥20 seconds',         icon: '🧴', done: false, time: null, missed: false },
    { id: 'mask',       name: 'N95 / Surgical Mask',  desc: 'Covers nose and mouth fully',  icon: '😷', done: false, time: null, missed: false },
    { id: 'gloves',     name: 'Sterile Gloves',        desc: 'Both hands covered',           icon: '🧤', done: false, time: null, missed: false },
    { id: 'gown',       name: 'Protective Gown',       desc: 'Full PPE gown before entry',   icon: '🥼', done: false, time: null, missed: false },
    { id: 'shoe_cover', name: 'Shoe Covers',           desc: 'Sterile covers required',      icon: '👟', done: false, time: null, missed: false },
    { id: 'hair_cap',   name: 'Hair Cap',              desc: 'Full head coverage required',  icon: '🎩', done: false, time: null, missed: false },
    { id: 'badge',      name: 'ID Badge Scan',         desc: 'Scan badge at entry gate',     icon: '🪪', done: false, time: null, missed: false },
  ],
  totalEntries: 0,
  currentPerson: null,

  init() { this.renderChecklist(); this.renderDetItems(); this.updateStats(); },

  setCurrentPerson(staff) {
    this.currentPerson = staff;
    const el = document.getElementById('currentPersonBar');
    if (!el) return;
    if (staff) {
      el.className = 'person-bar active';
      el.innerHTML = `
        <div class="person-avatar">${staff.name.charAt(0).toUpperCase()}</div>
        <div class="person-info">
          <div class="person-name">${staff.name}</div>
          <div class="person-sub">${staff.role} &nbsp;·&nbsp; ${staff.phone}</div>
        </div>
        <button class="btn btn-xs" onclick="OCR.clear()">✕ Clear</button>`;
    } else {
      el.className = 'person-bar';
      el.innerHTML = `<div class="person-idle">Scan staff ID to identify personnel</div>`;
    }
  },

  renderChecklist() {
    const el = document.getElementById('checklist');
    if (!el) return;
    el.innerHTML = this.steps.map(s => `
      <div class="chk ${s.done ? 'done' : s.missed ? 'missed' : ''}" onclick="Protocol.toggle('${s.id}')">
        <div class="chk-box">${s.done ? '✓' : s.missed ? '✗' : ''}</div>
        <div>
          <div class="chk-name">${s.icon} ${s.name}</div>
          <div class="chk-desc">${s.desc}</div>
        </div>
        <div class="chk-time">${s.time || '—'}</div>
      </div>`).join('');
    this.updateProtoTag();
  },

  renderDetItems() {
    const el = document.getElementById('detectionItems');
    if (!el) return;
    const ppeKeys = OnnxDetector.loaded ? Object.keys(OnnxDetector.ppeMap) : null;
    const items = ppeKeys ? this.steps.filter(s => ppeKeys.includes(s.id)) : this.steps;
    el.innerHTML = `
      <div class="det-list">
        ${items.map(s => `
          <div class="det-row" id="det-${s.id}">
            <span class="det-ico">${s.icon}</span>
            <div class="det-info">
              <div class="det-name">${s.name}</div>
              <div class="det-note" id="dn-${s.id}">${OnnxDetector.loaded ? 'Awaiting detection...' : 'Load ONNX model to enable'}</div>
            </div>
            <div class="det-pip"></div>
          </div>`).join('')}
      </div>
      <div id="det-summary" class="det-summary" style="display:none"></div>`;
  },

  toggle(id) {
    const s = this.steps.find(x => x.id === id);
    if (!s) return;
    s.done = !s.done; s.missed = false; s.time = s.done ? getTimestamp() : null;
    this.renderChecklist(); this.updateStats();
    if (s.done) { this.markDetected(id); addAlert('Step verified: ' + s.name, 'info'); }
    else this.markUndetected(id);
  },

  markDetected(id) {
    const s = this.steps.find(x => x.id === id);
    if (!s) return;
    s.done = true; s.missed = false; s.time = getTimestamp();
    setDetRow(id, 'hit', 'Detected at ' + s.time);
    this.renderChecklist(); this.updateStats();
  },

  markUndetected(id) { setDetRow(id, '', 'Awaiting detection...'); },

  evaluateEntry() {
    this.totalEntries++;
    const missed = this.steps.filter(s => s.missed || !s.done);
    if (missed.length === 0) {
      this.logEntry(true);
      addAlert('Entry compliant — all steps verified' + (this.currentPerson ? ' [' + this.currentPerson.name + ']' : ''), 'info');
      showToast('✓ Entry approved', 'info');
      if (this.currentPerson) {
        SMS.sendToStaff(this.currentPerson, '✓ ICU Entry approved — all PPE steps verified. ' + getTimestamp());
      }
    } else {
      const names = missed.map(s => s.name);
      this.logEntry(false);
      addAlert('VIOLATION — Missing: ' + names.join(', ') + (this.currentPerson ? ' [' + this.currentPerson.name + ']' : ''), 'critical');
      showCritical('Protocol Violation', 'The following steps were not completed:\n\n' + names.map(n => '  ✗ ' + n).join('\n') + '\n\nEntry must be denied until all PPE requirements are met.', names, this.currentPerson);
    }
    this.updateStats();
  },

  logEntry(ok) {
    const el = document.getElementById('entryLog');
    if (!el) return;
    el.querySelector('.nil')?.remove();
    const row = document.createElement('div');
    row.className = 'entry-row';
    const person = this.currentPerson ? this.currentPerson.name : 'Unknown';
    row.innerHTML = `<span class="e-time">${getTimestamp()}</span><span class="e-person">${person}</span><span class="e-tag ${ok ? 'ok' : 'err'}">${ok ? '✓ OK' : '✗ Fail'}</span>`;
    el.insertBefore(row, el.firstChild);
  },

  updateStats() {
    const done   = this.steps.filter(s => s.done).length;
    const missed = this.steps.filter(s => s.missed).length;
    const pct    = Math.round((done / this.steps.length) * 100);
    const g = id => document.getElementById(id);
    if (g('statCompliant'))     g('statCompliant').textContent = done;
    if (g('statMissed'))        g('statMissed').textContent    = missed;
    if (g('statScore'))         g('statScore').textContent     = pct + '%';
    if (g('complianceBarFill')) g('complianceBarFill').style.width = pct + '%';
  },

  updateProtoTag() {
    const el = document.getElementById('protoStatusBadge');
    if (!el) return;
    const done   = this.steps.filter(s => s.done).length;
    const missed = this.steps.filter(s => s.missed).length;
    if (missed > 0)                      { el.textContent = 'violation'; el.className = 'status-tag err'; }
    else if (done === this.steps.length) { el.textContent = 'compliant'; el.className = 'status-tag ok'; }
    else                                 { el.textContent = 'pending';   el.className = 'status-tag'; }
  },

  resetProtocol() {
    this.steps.forEach(s => { s.done = false; s.missed = false; s.time = null; });
    this.currentPerson = null;
    this.renderChecklist(); this.renderDetItems(); this.updateStats();
    this.setCurrentPerson(null);
    showToast('Checklist reset', 'info');
  },

  markAllCompliant() {
    this.steps.forEach(s => { s.done = true; s.missed = false; s.time = getTimestamp(); this.markDetected(s.id); });
    this.renderChecklist(); this.updateStats();
    addAlert('All steps manually marked compliant', 'info');
  }
};

function resetProtocol()    { Protocol.resetProtocol(); }
function markAllCompliant() { Protocol.markAllCompliant(); }