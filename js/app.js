import { appendMatch, changeCount, newSession, setMaxStreak, swapLatest, toggleForcedRest, undoLatest } from './state.js?v=24';
import { generateMatch } from './matchGenerator.js?v=24';
import { loadState, saveState } from './storage.js?v=24';
import { render } from './ui.js?v=24';

let state = loadState(), selected = null;
const refresh = () => {
  render(state, { selected });
  if (selected !== null) document.querySelector(`#history [data-swap-id="${selected}"]`)?.focus();
};
function commit(next) {
  state = next;
  selected = null;
  try { saveState(state); }
  catch { state = { ...state, notice: '保存できませんでした。ブラウザの保存設定を確認してください。' }; }
  refresh();
}
function attempt(action) {
  try { action(); }
  catch (error) { state = { ...state, notice: error.message || '操作を完了できませんでした。' }; refresh(); }
}

function showScreen() {
  const showSettings = location.hash === '#settings' || location.hash === '#stats';
  document.querySelector('#match-screen').hidden = showSettings;
  document.querySelector('#settings-screen').hidden = !showSettings;
  if (location.hash === '#stats') requestAnimationFrame(() => document.querySelector('#stats-title').scrollIntoView({ block: 'start' }));
}

document.querySelector('#next-match').addEventListener('click', () => attempt(() => {
  commit(appendMatch(state, generateMatch(state)));
  requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
}));
document.querySelector('#undo-match').addEventListener('click', () => commit(undoLatest(state)));
document.querySelector('#new-session').addEventListener('click', () => {
  if (window.confirm('履歴と統計を消して新しいセッションを開始しますか？')) commit(newSession(state));
});
document.querySelector('.app-shell').addEventListener('click', event => {
  const chip = event.target.closest('[data-swap-id]');
  if (!chip) return;
  const id = Number(chip.dataset.swapId);
  if (selected === null) { selected = id; refresh(); }
  else if (selected === id) { selected = null; refresh(); }
  else attempt(() => commit(swapLatest(state, selected, id)));
});
document.querySelector('#settings').addEventListener('click', event => {
  const button = event.target.closest('[data-force-id]');
  if (button) attempt(() => commit(toggleForcedRest(state, Number(button.dataset.forceId))));
});
document.querySelector('#settings').addEventListener('change', event => {
  if (event.target.id === 'participant-count') attempt(() => commit(changeCount(state, Number(event.target.value))));
  else if (event.target.matches('[data-max-id]')) attempt(() => commit(setMaxStreak(state, Number(event.target.dataset.maxId), event.target.value === '' ? null : Number(event.target.value))));
});
window.addEventListener('hashchange', showScreen);
showScreen();
refresh();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
