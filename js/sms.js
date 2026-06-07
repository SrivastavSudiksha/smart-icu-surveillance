const SMS = {
  config: {
    endpoint: '',
    fast2smsKey: '',
    ward: 'CAM-ICU',
    soundEnabled: true,
    smsOnViol: true,
    smsOnCompliant: false,
  },

  load() {
    try {
      const saved = localStorage.getItem('cam-icu_sms_v2');
      if (saved) Object.assign(this.config, JSON.parse(saved));
    } catch(e) {}
  },

  save(cfg) {
    Object.assign(this.config, cfg);
    localStorage.setItem('cam-icu_sms_v2', JSON.stringify(this.config));
  },

  async sendToStaff(staff, message) {
    if (!staff || !staff.phone) {
      showToast('Staff phone number not configured', 'warning');
      return false;
    }
    return await this._send(staff.phone, staff.name, message);
  },

  async _send(phone, recipientName, message) {
    const body = '[CAM-ICU ' + this.config.ward + ']\n' + message + '\nTime: ' + getFullTimestamp();
    if (this.config.endpoint) {
      try {
        const res = await fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: phone, body, recipient: recipientName })
        });
        if (res.ok) {
          showToast('SMS sent to ' + recipientName, 'info');
          addAlert('SMS sent to ' + recipientName + ' (' + phone + ')', 'info');
          return true;
        }
      } catch(e) {}
    }
    if (this.config.fast2smsKey) {
      try {
        const num = phone.replace(/\D/g,'').slice(-10);
        const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': this.config.fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ route: 'q', message: body, language: 'english', flash: 0, numbers: num })
        });
        const data = await res.json();
        if (data.return === true) {
          showToast('SMS sent to ' + recipientName, 'info');
          addAlert('SMS sent to ' + recipientName + ' (' + num + ')', 'info');
          return true;
        }
      } catch(e) {}
    }
    showToast('SMS simulated → ' + recipientName + ': ' + message.slice(0,30), 'warning');
    addAlert('SMS simulated → ' + recipientName + ': ' + message, 'info');
    return false;
  },

  playAlarm(type) {
    if (!this.config.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beeps = type === 'critical'
        ? [880,0, 660,0.2, 880,0.4, 660,0.6, 880,0.8]
        : [660,0, 440,0.3];
      for (let i = 0; i < beeps.length; i += 2) {
        const freq = beeps[i], start = beeps[i+1];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + 0.15);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.2);
      }
    } catch(e) {}
  }
};

function saveSettings() {
  SMS.save({
    endpoint:       document.getElementById('settingsEndpoint')?.value?.trim() || '',
    fast2smsKey:    document.getElementById('settingsF2S')?.value?.trim() || '',
    ward:           document.getElementById('settingsWard')?.value?.trim() || 'CAM-ICU',
    soundEnabled:   document.getElementById('soundEnabled')?.checked ?? true,
    smsOnViol:      document.getElementById('smsOnViol')?.checked ?? true,
    smsOnCompliant: document.getElementById('smsOnCompliant')?.checked ?? false,
  });
  showToast('Settings saved successfully', 'info');
}

function testSMS() {
  const person = Protocol?.currentPerson;
  SMS.playAlarm('critical');
  if (person) {
    SMS.sendToStaff(person, 'TEST — CAM-ICU system test alert.');
  } else {
    showToast('Select a staff member before running SMS test', 'warning');
  }
}

function saveSoundPref() {
  SMS.config.soundEnabled   = document.getElementById('soundEnabled')?.checked ?? true;
  SMS.config.smsOnViol      = document.getElementById('smsOnViol')?.checked ?? true;
  SMS.config.smsOnCompliant = document.getElementById('smsOnCompliant')?.checked ?? false;
  localStorage.setItem('cam-icu_sms_v2', JSON.stringify(SMS.config));
}

function populateSettingsForm() {
  const c = SMS.config;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('settingsEndpoint', c.endpoint);
  set('settingsF2S', c.fast2smsKey);
  set('settingsWard', c.ward);
  const checks = { soundEnabled: c.soundEnabled !== false, smsOnViol: c.smsOnViol !== false, smsOnCompliant: !!c.smsOnCompliant };
  Object.entries(checks).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.checked = val; });
}