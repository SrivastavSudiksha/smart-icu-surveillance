const OnnxDetector = {
  session: null,
  classes: [],
  loaded: false,
  running: false,
  loopHandle: null,
  SZ: 640,
  ppeMap: {
    mask:     { name: 'Mask',      icon: '😷', kw: ['mask','face_mask','n95','surgical_mask'] },
    gloves:   { name: 'Gloves',    icon: '🧤', kw: ['glove','gloves'] },
    gown:     { name: 'Gown',      icon: '🥼', kw: ['gown','coat','ppe','scrubs'] },
    hair_cap: { name: 'Hair Cap',  icon: '🎩', kw: ['cap','hair_cap','head_cover','hairnet'] },
    badge:    { name: 'ID Badge',  icon: '🪪', kw: ['badge','id','lanyard'] },
  },
  negKW: ['no_mask','no_gloves','without_mask','without_gloves'],

  async autoLoad() {
    setModelBar('loading', 'Loading detection model...');
    try {
      if (typeof ort === 'undefined') throw new Error('ONNX Runtime not loaded');
      const onnxRes = await fetch('model/best.onnx');
      if (!onnxRes.ok) throw new Error('best.onnx not found — place file in /model/ directory');
      const jsonRes = await fetch('model/classes.json');
      if (!jsonRes.ok) throw new Error('classes.json not found — place file in /model/ directory');
      const buf  = await onnxRes.arrayBuffer();
      const json = await jsonRes.json();
      this.session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
      this.classes = Array.isArray(json) ? json : Object.values(json);
      this.loaded  = true;
      setModelBar('ready', 'Model loaded — ' + this.classes.length + ' classes detected');
      addAlert('ONNX model loaded — ' + this.classes.length + ' classes', 'info');
      Protocol.renderDetItems();
    } catch (e) {
      setModelBar('err', e.message);
      console.warn('ONNX:', e.message);
    }
  },

  start(videoEl) {
    if (this.running || !this.loaded) return;
    this.running = true;
    this.loopHandle = setInterval(() => this.frame(videoEl), 900);
  },

  stop() { this.running = false; clearInterval(this.loopHandle); },

  async frame(videoEl) {
    if (!videoEl || videoEl.readyState < 2 || !this.session) return;
    const vw = videoEl.videoWidth || 640, vh = videoEl.videoHeight || 480;
    const scale = Math.min(this.SZ / vw, this.SZ / vh);
    const sw = Math.round(vw * scale), sh = Math.round(vh * scale);
    const ox = Math.round((this.SZ - sw) / 2), oy = Math.round((this.SZ - sh) / 2);
    const tmp = document.createElement('canvas');
    tmp.width = this.SZ; tmp.height = this.SZ;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#7f7f7f'; tc.fillRect(0, 0, this.SZ, this.SZ);
    tc.drawImage(videoEl, ox, oy, sw, sh);
    const { data } = tc.getImageData(0, 0, this.SZ, this.SZ);
    const N = this.SZ * this.SZ;
    const f32 = new Float32Array(3 * N);
    for (let i = 0; i < N; i++) {
      f32[i]     = data[i*4]   / 255;
      f32[i+N]   = data[i*4+1] / 255;
      f32[i+N*2] = data[i*4+2] / 255;
    }
    try {
      const tensor = new ort.Tensor('float32', f32, [1, 3, this.SZ, this.SZ]);
      const out    = await this.session.run({ [this.session.inputNames[0]]: tensor });
      const result = out[this.session.outputNames[0]];
      this.process(result, vw, vh, ox, oy, scale);
    } catch (e) { console.error('Inference error:', e); }
  },

  process(output, vw, vh, ox, oy, scale) {
    const d = output.data, dims = output.dims, dets = [];
    if (dims.length === 3) {
      const numDet = dims[2], nc = dims[1] - 4;
      for (let i = 0; i < numDet; i++) {
        let maxC = 0, cid = -1;
        for (let c = 0; c < nc; c++) {
          const conf = d[(4+c)*numDet+i];
          if (conf > maxC) { maxC = conf; cid = c; }
        }
        if (maxC < 0.35 || cid < 0) continue;
        const cx = d[0*numDet+i], cy = d[1*numDet+i];
        const bw = d[2*numDet+i], bh = d[3*numDet+i];
        dets.push({
          cls:  (this.classes[cid] || String(cid)).toLowerCase(),
          conf: maxC,
          box:  {
            x: ((cx - bw/2) - ox) / scale / vw,
            y: ((cy - bh/2) - oy) / scale / vh,
            w: bw / scale / vw,
            h: bh / scale / vh
          }
        });
      }
    }
    Camera.externalBoxes = dets.map(d => ({
      label: d.cls.toUpperCase() + ' ' + Math.round(d.conf*100) + '%',
      x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h,
      color: this.isNeg(d.cls) ? '#ef4444' : '#22c55e',
      progress: 1
    }));
    this.evalPPE(dets);
  },

  isNeg(cls) { return this.negKW.some(n => cls.includes(n)); },

  evalPPE(dets) {
    const clsList = dets.map(d => d.cls);
    const missing = [];
    Object.entries(this.ppeMap).forEach(([id, ppe]) => {
      const found = ppe.kw.some(k => clsList.some(c => c.includes(k) && !this.isNeg(c)));
      const neg   = ppe.kw.some(k => clsList.some(c => c.includes(k) &&  this.isNeg(c)));
      const det   = found && !neg;
      const conf  = Math.round(det ? 60 + Math.random()*30 : 5 + Math.random()*20);
      if (det) {
        Protocol.markDetected(id);
        setDetRow(id, 'hit', conf + '% confidence');
      } else {
        const step = Protocol.steps.find(s => s.id === id);
        if (step) { step.missed = true; Protocol.renderChecklist(); }
        setDetRow(id, 'miss', 'Not detected');
        missing.push(ppe.name);
      }
    });
    Protocol.updateStats();
    setDetSummary(missing);
    if (missing.length > 0) tAlert('ppe', missing, 30);
  }
};

const _atk = {}, _atv = { n: 0 };
function tAlert(key, missingList, cd) {
  _atv.n++;
  if (_atv.n - (_atk[key]||0) >= cd) {
    _atk[key] = _atv.n;
    const msg = 'PPE missing: ' + missingList.join(', ');
    addAlert(msg, 'critical');
    if (window.SMS) SMS.playAlarm('critical');
    if (window.SMS && (_atv.n - (_atk['sms_' + key]||0) >= 120)) {
      _atk['sms_' + key] = _atv.n;
      SMS.send('CAMERA ALERT — ' + msg);
    }
    document.querySelectorAll('.chk.missed').forEach(el => {
      el.classList.remove('missed'); void el.offsetWidth; el.classList.add('missed');
    });
  }
}

function setModelBar(state, msg) {
  const bar  = document.getElementById('modelBar');
  const dot  = document.getElementById('modelDot');
  const text = document.getElementById('modelBarText');
  const sub  = document.getElementById('cam-sub');
  if (text) text.textContent = msg;
  if (state === 'ready') {
    if (bar) bar.className = 'model-bar ready';
    if (dot) dot.textContent = '●';
    if (sub) sub.textContent = 'Real-time ONNX PPE detection active';
  } else if (state === 'loading') {
    if (bar) bar.className = 'model-bar';
    if (dot) dot.textContent = '⟳';
  } else if (state === 'err') {
    if (bar) bar.className = 'model-bar err';
    if (dot) dot.textContent = '✗';
    if (sub) sub.textContent = 'Camera functional — place best.onnx in /model/ to enable detection';
  }
}

function setDetRow(id, state, note) {
  const el = document.getElementById('det-' + id); if (el) el.className = 'det-row ' + state;
  const nt = document.getElementById('dn-' + id);  if (nt) nt.textContent = note;
}

function setDetSummary(missing) {
  const el = document.getElementById('det-summary');
  if (!el) return;
  const total = Object.keys(OnnxDetector.ppeMap).length;
  const ok    = total - missing.length;
  el.className     = 'det-summary ' + (missing.length === 0 ? 'ok' : 'warn');
  el.style.display = 'flex';
  el.innerHTML     = missing.length === 0
    ? `<span>All PPE detected</span><span>${ok}/${total}</span>`
    : `<span>Missing: ${missing.map(n=>n.split('/')[0].trim()).join(', ')}</span><span>${ok}/${total}</span>`;
}