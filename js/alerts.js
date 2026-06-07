window.alertLog = [];

function addAlert(msg, type = 'info') {
  window.alertLog.unshift({ msg, type, ts: getTimestamp() });
  if (window.alertLog.length > 80) window.alertLog.pop();
  renderAlerts();
  if (type === 'critical') {
    setSysPip('crit');
    setTimeout(() => setSysPip(''), 10000);
  }
}

function renderAlerts() {
  const feed  = document.getElementById('alertFeed');
  const badge = document.getElementById('alertCountBadge');
  if (!feed) return;
  const crits = window.alertLog.filter(a => a.type === 'critical').length;
  if (badge) badge.textContent = crits > 0 ? crits + ' critical' : window.alertLog.length;
  if (!window.alertLog.length) {
    feed.innerHTML = '<div class="nil">No alerts — system operating normally</div>';
    return;
  }
  feed.innerHTML = window.alertLog.map(a => `
    <div class="alert-row">
      <span class="a-time">${a.ts}</span>
      <span class="a-msg">${a.msg}</span>
      <span class="a-type ${a.type}">${a.type}</span>
    </div>`).join('');
}

function clearAlerts() {
  window.alertLog = [];
  renderAlerts();
  showToast('Alert log cleared', 'info');
}

function setSysPip(state) {
  const pip = document.getElementById('sysPip');
  const lbl = document.getElementById('sysLbl');
  if (!pip || !lbl) return;
  pip.className = 'status-pip' + (state === 'crit' ? ' crit' : '');
  lbl.textContent = state === 'crit' ? 'VIOLATION' : 'Monitoring';
}

function showCritical(title, msg, missingList, person) {
  document.getElementById('criticalTitle').textContent = title;
  document.getElementById('criticalMsg').textContent = msg;
  const personEl = document.getElementById('critPersonLine');
  if (personEl) {
    if (person) {
      personEl.style.display = 'block';
      personEl.innerHTML = `
        <div class="crit-person-row">
          <div class="crit-avatar">${person.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="crit-person-name">${person.name}</div>
            <div class="crit-person-sub">${person.role} &nbsp;·&nbsp; SMS → ${person.phone}</div>
          </div>
        </div>`;
    } else {
      personEl.style.display = 'none';
    }
  }
  document.getElementById('criticalOverlay').classList.add('show');
  if (window.SMS) SMS.playAlarm('critical');
  if (window.SMS && window.SMS.config.smsOnViol && person && missingList?.length > 0) {
    const smsMsg = `⚠ PPE VIOLATION\nMissing: ${missingList.join(', ')}\nEntry denied. Please wear complete PPE before entering ICU.`;
    SMS.sendToStaff(person, smsMsg);
  } else if (window.SMS && missingList?.length > 0 && !person) {
    addAlert('SMS not sent — no staff ID was scanned', 'warning');
  }
}

function dismissCritical() {
  document.getElementById('criticalOverlay').classList.remove('show');
}