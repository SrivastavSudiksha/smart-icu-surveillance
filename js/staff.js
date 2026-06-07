const Staff = {
  list: [],

  load() {
    try {
      const saved = localStorage.getItem('cam-icu_staff');
      if (saved) this.list = JSON.parse(saved);
    } catch(e) { this.list = []; }
    if (this.list.length === 0) {
      this.list = [
        { id: 's1', name: 'Dr. R. Mehta',     phone: '+919876543210', role: 'Doctor' },
        { id: 's2', name: 'Nurse Priya Singh', phone: '+919812345678', role: 'Nurse' },
      ];
      this.save();
    }
  },

  save() {
    localStorage.setItem('cam-icu_staff', JSON.stringify(this.list));
  },

  add(name, phone, role) {
    const entry = { id: 's' + Date.now(), name: name.trim(), phone: phone.trim(), role: role || 'Staff' };
    this.list.push(entry);
    this.save();
    return entry;
  },

  remove(id) {
    this.list = this.list.filter(s => s.id !== id);
    this.save();
  },

  update(id, name, phone, role) {
    const s = this.list.find(x => x.id === id);
    if (!s) return;
    s.name = name.trim(); s.phone = phone.trim(); s.role = role || s.role;
    this.save();
  },

  renderTable() {
    const el = document.getElementById('staffTable');
    if (!el) return;
    if (!this.list.length) {
      el.innerHTML = '<div class="nil">Koi staff nahi — neeche add karo</div>';
      return;
    }
    el.innerHTML = this.list.map(s =>
      '<div class="staff-row" id="sr-' + s.id + '">' +
        '<div class="staff-avatar">' + s.name.charAt(0).toUpperCase() + '</div>' +
        '<div class="staff-info">' +
          '<div class="staff-name">' + s.name + '</div>' +
          '<div class="staff-meta">' + s.role + ' &nbsp;·&nbsp; ' + s.phone + '</div>' +
        '</div>' +
        '<div class="staff-actions">' +
          '<button class="btn btn-xs qr-btn" onclick="showQR(\'' + s.id + '\')">QR Print</button>' +
          '<button class="btn btn-xs" onclick="Staff.editRow(\'' + s.id + '\')">Edit</button>' +
          '<button class="btn btn-xs btn-warn" onclick="Staff.removeRow(\'' + s.id + '\')">✕</button>' +
        '</div>' +
      '</div>'
    ).join('');
  },

  editRow(id) {
    const s = this.list.find(x => x.id === id);
    if (!s) return;
    document.getElementById('staffName').value   = s.name;
    document.getElementById('staffPhone').value  = s.phone;
    document.getElementById('staffRole').value   = s.role;
    document.getElementById('staffEditId').value = id;
    document.getElementById('addStaffBtn').textContent = 'Update';
    document.getElementById('staffName').focus();
  },

  removeRow(id) {
    if (!confirm('Delete karein?')) return;
    this.remove(id);
    this.renderTable();
    showToast('Staff removed', 'info');
  }
};

function addStaffMember() {
  const name   = document.getElementById('staffName')?.value?.trim();
  const phone  = document.getElementById('staffPhone')?.value?.trim();
  const role   = document.getElementById('staffRole')?.value?.trim();
  const editId = document.getElementById('staffEditId')?.value;
  if (!name || !phone) { showToast('Naam aur phone zaroori hai', 'warning'); return; }
  if (editId) {
    Staff.update(editId, name, phone, role);
    document.getElementById('staffEditId').value = '';
    document.getElementById('addStaffBtn').textContent = '+ Add Staff';
    showToast('Updated: ' + name, 'info');
  } else {
    Staff.add(name, phone, role);
    showToast('Added: ' + name, 'info');
  }
  ['staffName','staffPhone','staffRole'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  Staff.renderTable();
}

function showQR(staffId) {
  const staff = Staff.list.find(s => s.id === staffId);
  if (!staff) return;
  const modal = document.getElementById('qrModal');
  const title = document.getElementById('qrName');
  const canvas = document.getElementById('qrCanvas');
  if (!modal || !canvas) return;
  title.textContent = staff.name + ' — ' + staff.role;
  modal.classList.add('show');
  generateQR(canvas, staff.id, staff.name);
}

function closeQR() {
  document.getElementById('qrModal')?.classList.remove('show');
}

function printQR() {
  const canvas = document.getElementById('qrCanvas');
  const name   = document.getElementById('qrName')?.textContent || '';
  const win = window.open('');
  win.document.write(
    '<html><body style="text-align:center;font-family:sans-serif;padding:20px">' +
    '<h2 style="font-size:16px;margin-bottom:8px">CAM-ICU</h2>' +
    '<img src="' + canvas.toDataURL() + '" style="width:200px;height:200px"/>' +
    '<p style="margin-top:10px;font-size:13px">' + name + '</p>' +
    '<p style="font-size:10px;color:#999">ID card pe chipkayen</p>' +
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

function generateQR(canvas, id, name) {
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  if (typeof QRCode !== 'undefined') {
    canvas.width = 0; canvas.height = 0;
    new QRCode(canvas, {
      text: id,
      width: size,
      height: size,
      colorDark: '#000',
      colorLight: '#fff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR library', size/2, size/2 - 10);
    ctx.fillText('load nahi hua', size/2, size/2 + 10);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#555';
    ctx.fillText('Internet check karo', size/2, size/2 + 30);
  }
}