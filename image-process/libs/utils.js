export function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const msg   = document.getElementById('toastMsg');
  msg.textContent = message;
  const colors  = { success: '#22c55e', error: '#ef4444', info: '#e2e8f0' };
  const borders = { success: '#22c55e', error: '#ef4444', info: '#334155' };
  toast.style.borderColor = borders[type] || borders.info;
  msg.style.color         = colors[type]  || colors.info;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
