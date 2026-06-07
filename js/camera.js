const Camera = {
  stream: null,
  isOn: false,
  startTime: 0,
  timerH: null,
  fpsH: null,
  frames: 0,
  canvas: null,
  ctx: null,
  video: null,
  externalBoxes: [],
  init() {
    this.canvas = document.getElementById('overlayCanvas');
    this.video  = document.getElementById('videoEl');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    const vp = document.getElementById('camViewport');
    if (!vp || !this.canvas) return;
    this.canvas.width  = vp.offsetWidth;
    this.canvas.height = vp.offsetHeight;
  },
  async toggle() {
    this.isOn ? this.stop() : await this.start();
  },
  async start() {
    const btn     = document.getElementById('camBtn');
    const offline = document.getElementById('camOffline');
    const hud     = document.getElementById('camHUD');
    if (btn) { btn.textContent = 'Starting…'; btn.disabled = true; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      this.video.srcObject = this.stream;
      this.video.style.display = 'block';
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = resolve;
        this.video.onerror = reject;
      });
      await this.video.play();
      if (offline) offline.classList.add('hidden');
      if (hud)     hud.classList.add('on');
      if (btn)     { btn.textContent = '■ Stop'; btn.disabled = false; }
      this.isOn      = true;
      this.startTime = Date.now();
      this.startTimer();
      this.startFPS();
      this.startLoop();
      this.resize();
      addAlert('Camera started — detection ready', 'info');
      OCR.startAutoScan();
      showToast('Camera active', 'info');
      setTimeout(() => {
        if (this.isOn && OnnxDetector.loaded) OnnxDetector.start(this.video);
      }, 1500);
    } catch (err) {
      if (btn) { btn.textContent = 'Start Camera'; btn.disabled = false; }
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      this.video.style.display = 'none';
      let msg = 'Camera error: ' + (err.message || err.name);
      if (err.name === 'NotAllowedError')  msg = 'Camera permission denied — click the camera icon in address bar and allow';
      if (err.name === 'NotFoundError')    msg = 'No camera found on this device';
      if (err.name === 'NotReadableError') msg = 'Camera is being used by another app — close it and try again';
      addAlert(msg, 'warning');
      showToast(msg, 'warning');
    }
  },
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.video.pause();
    this.video.srcObject = null;
    this.video.style.display = 'none';
    const offline = document.getElementById('camOffline');
    const hud     = document.getElementById('camHUD');
    const btn     = document.getElementById('camBtn');
    if (offline) offline.classList.remove('hidden');
    if (hud)     hud.classList.remove('on');
    if (btn)     btn.textContent = 'Start Camera';
    this.isOn = false;
    clearInterval(this.timerH);
    clearInterval(this.fpsH);
    cancelAnimationFrame(this._raf);
    OnnxDetector.stop();
    if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    OCR.stopAutoScan();
    addAlert('Camera stopped', 'info');
  },
  startTimer() {
    clearInterval(this.timerH);
    this.timerH = setInterval(() => {
      if (!this.isOn) return;
      const e  = Math.floor((Date.now() - this.startTime) / 1000);
      const el = document.getElementById('camTimer');
      if (el)  el.textContent = pad2(Math.floor(e / 60)) + ':' + pad2(e % 60);
    }, 1000);
  },
  startFPS() {
    this.frames = 0;
    clearInterval(this.fpsH);
    this.fpsH = setInterval(() => {
      const el = document.getElementById('fpsBadge');
      if (el)  el.textContent = this.frames + ' fps';
      this.frames = 0;
    }, 1000);
  },
  startLoop() {
    const draw = () => {
      if (!this.isOn) return;
      this._raf = requestAnimationFrame(draw);
      this.frames++;
      this.render();
    };
    draw();
  },
  render() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
    this.drawBrackets(W, H);
    (this.externalBoxes || []).forEach(b => {
      b.progress = Math.min(1, (b.progress || 0) + 0.06);
      const a = b.progress;
      this.ctx.globalAlpha = a;
      this.ctx.strokeStyle = b.color;
      this.ctx.lineWidth   = 1.5;
      this.ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
      this.ctx.fillStyle   = b.color;
      this.ctx.globalAlpha = a * 0.82;
      this.ctx.fillRect(b.x * W, b.y * H - 17, b.label.length * 6.2 + 10, 17);
      this.ctx.fillStyle   = '#fff';
      this.ctx.globalAlpha = a;
      this.ctx.font        = '9px monospace';
      this.ctx.fillText(b.label, b.x * W + 5, b.y * H - 5);
      this.ctx.globalAlpha = 1;
    });
    if (OnnxDetector.running) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
      this.ctx.fillRect(W - 170, H - 24, 165, 18);
      this.ctx.fillStyle = '#22c55e';
      this.ctx.font      = '9px monospace';
      this.ctx.fillText('DETECTION ACTIVE', W - 164, H - 10);
    }
  },
  drawBrackets(W, H) {
    const sz = 16, p = 9;
    this.ctx.strokeStyle = 'rgba(34,197,94,0.4)';
    this.ctx.lineWidth   = 1.5;
    [[p,p,1,1],[W-p,p,-1,1],[p,H-p,1,-1],[W-p,H-p,-1,-1]].forEach(([x,y,dx,dy]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(x + dx * sz, y);
      this.ctx.lineTo(x, y);
      this.ctx.lineTo(x, y + dy * sz);
      this.ctx.stroke();
    });
  },
  snapshot() {
    if (!this.isOn) { showToast('Start camera first', 'warning'); return; }
    const c   = document.createElement('canvas');
    c.width   = this.video.videoWidth  || 640;
    c.height  = this.video.videoHeight || 480;
    const ctx = c.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, c.height - 24, c.width, 24);
    ctx.fillStyle = '#22c55e';
    ctx.font      = '12px monospace';
    ctx.fillText('CAM-ICU — ' + getFullTimestamp(), 10, c.height - 7);
    const a      = document.createElement('a');
    a.href       = c.toDataURL('image/png');
    a.download   = 'cam-icu-' + Date.now() + '.png';
    a.click();
    showToast('Snapshot saved', 'info');
  }
};