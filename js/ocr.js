const OCR = {
  isReady: false,
  isScanning: false,
  scanLoop: null,
  lastDetected: null,

  init() {
    if (typeof jsQR === 'undefined') {
      setOCRStatus('err', 'jsQR library failed to load — check internet connection');
      return;
    }
    this.isReady = true;
    setOCRStatus('ready', 'QR Scanner ready — present staff ID card to camera');
  },

  startAutoScan() {
    if (this.scanLoop) return;
    this.scanLoop = setInterval(() => {
      if (Camera.isOn && this.isReady) this._scanFrame();
    }, 500);
  },

  stopAutoScan() { clearInterval(this.scanLoop); this.scanLoop = null; },

  _scanFrame() {
    const video = document.getElementById('videoEl');
    if (!video || video.readyState < 2) return;
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    const c = document.createElement('canvas');
    c.width = vw; c.height = vh;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);
    const imgData = ctx.getImageData(0, 0, vw, vh);
    const code = jsQR(imgData.data, vw, vh, { inversionAttempts: 'dontInvert' });
    if (code && code.data) this._onQRFound(code.data);
  },

  _onQRFound(data) {
    let staffId = null;
    try { const parsed = JSON.parse(data); staffId = parsed.id; } catch(e) { staffId = data.trim(); }
    const staff = Staff.list.find(s => s.id === staffId);
    if (!staff) {
      setOCRStatus('err', 'QR detected but no matching staff record found');
      showToast('Unknown QR code', 'warning');
      return;
    }
    if (this.lastDetected && this.lastDetected.staff.id === staff.id) return;
    this.lastDetected = { staff, ts: getTimestamp() };
    this._showMatch(staff);
  },

  _showMatch(staff) {
    const panel = document.getElementById('ocrResult');
    if (panel) {
      panel.className = 'ocr-result hit';
      panel.innerHTML =
        '<div class="ocr-match-head">' +
          '<div class="ocr-avatar">' + staff.name.charAt(0).toUpperCase() + '</div>' +
          '<div>' +
            '<div class="ocr-name">' + staff.name + '</div>' +
            '<div class="ocr-role">' + staff.role + ' &nbsp;·&nbsp; ' + staff.phone + '</div>' +
          '</div>' +
          '<div class="ocr-tick">✓</div>' +
        '</div>' +
        '<div class="ocr-raw">QR scanned at ' + getTimestamp() + '</div>';
    }
    setOCRStatus('ready', 'Identified: ' + staff.name);
    showToast('QR matched: ' + staff.name, 'info');
    addAlert('ID scanned: ' + staff.name + ' (' + staff.role + ')', 'info');
    Protocol.setCurrentPerson(staff);
    SMS.playAlarm('warning');
  },

  manualSelect(staffId) {
    const staff = Staff.list.find(s => s.id === staffId);
    if (!staff) return;
    this.lastDetected = { staff, ts: getTimestamp() };
    Protocol.setCurrentPerson(staff);
    const panel = document.getElementById('ocrResult');
    if (panel) {
      panel.className = 'ocr-result hit';
      panel.innerHTML =
        '<div class="ocr-match-head">' +
          '<div class="ocr-avatar">' + staff.name.charAt(0).toUpperCase() + '</div>' +
          '<div>' +
            '<div class="ocr-name">' + staff.name + '</div>' +
            '<div class="ocr-role">' + staff.role + ' &nbsp;·&nbsp; ' + staff.phone + '</div>' +
          '</div>' +
          '<div class="ocr-tick">✓</div>' +
        '</div>' +
        '<div class="ocr-raw">Manually selected</div>';
    }
    setOCRStatus('ready', 'Selected: ' + staff.name);
    showToast('Selected: ' + staff.name, 'info');
    addAlert('Staff manually selected: ' + staff.name, 'info');
  },

  clear() {
    this.lastDetected = null;
    Protocol.setCurrentPerson(null);
    const panel = document.getElementById('ocrResult');
    if (panel) {
      panel.className = 'ocr-result';
      panel.innerHTML = '<div class="ocr-idle">Position staff ID card in front of camera — QR will scan automatically</div>';
    }
    setOCRStatus('ready', 'QR Scanner ready');
  }
};

function setOCRStatus(state, msg) {
  const bar  = document.getElementById('ocrBar');
  const dot  = document.getElementById('ocrDot');
  const text = document.getElementById('ocrBarText');
  if (text) text.textContent = msg;
  if (!bar || !dot) return;
  if (state === 'ready')    { bar.className = 'model-bar ready';    dot.textContent = '●'; }
  else if (state === 'err') { bar.className = 'model-bar err';      dot.textContent = '✗'; }
  else                      { bar.className = 'model-bar scanning'; dot.textContent = '⟳'; }
}

function renderManualSelect() {
  const el = document.getElementById('manualSelectList');
  if (!el) return;
  if (!Staff.list.length) {
    el.innerHTML = '<div class="nil">No staff records — add members in Settings</div>';
    return;
  }
  el.innerHTML = Staff.list.map(s =>
    '<div class="manual-row" onclick="OCR.manualSelect(\'' + s.id + '\')">' +
      '<div class="staff-avatar sm">' + s.name.charAt(0) + '</div>' +
      '<div class="staff-info">' +
        '<div class="staff-name">' + s.name + '</div>' +
        '<div class="staff-meta">' + s.role + '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}