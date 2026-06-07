document.addEventListener('DOMContentLoaded', () => {
  startClock();
  SMS.load();
  Staff.load();
  Protocol.init();
  Camera.init();
  OnnxDetector.autoLoad();
  OCR.init();
  addAlert('CAM-ICU — system ready', 'info');
});
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.rlink').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');
  if (name === 'settings') { populateSettingsForm(); Staff.renderTable(); renderManualSelect(); }
  if (name === 'gate')     { renderManualSelect(); }
}