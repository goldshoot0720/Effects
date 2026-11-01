/* Shared volume UI for both MV players. Audio stays unlocked on mobile. */
window.MV_VOLUME = function (audio) {
  const host = document.getElementById('tools');
  if (!host) return;
  const group = document.createElement('div');
  group.className = 'volume';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '音量控制');
  group.innerHTML = '<button type="button" class="b" aria-label="靜音">🔊</button>' +
    '<input type="range" min="0" max="100" step="1" aria-label="音量">' +
    '<output aria-live="off"></output>';
  host.prepend(group);
  const [button, slider, output] = group.children;
  let last = .8;
  try {
    const saved = localStorage.getItem('mv.volume');
    const value = Number(saved);
    audio.volume = saved !== null && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .8;
  } catch (_) { audio.volume = .8; }
  function render() {
    const value = Math.round(audio.volume * 100);
    slider.value = value;
    output.textContent = value + '%';
    button.textContent = value ? '🔊' : '🔇';
    button.setAttribute('aria-label', value ? '靜音' : '取消靜音');
    button.setAttribute('aria-pressed', String(!value));
    if (value) last = audio.volume;
  }
  function set(value) {
    audio.volume = value;
    try { localStorage.setItem('mv.volume', String(value)); } catch (_) {}
    render();
  }
  slider.addEventListener('input', () => set(Number(slider.value) / 100));
  button.addEventListener('click', () => set(audio.volume ? 0 : last));
  audio.addEventListener('volumechange', render);
  group.addEventListener('keydown', e => e.stopPropagation());
  render();
};
