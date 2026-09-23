import { appendMatch, changeCount, newSession, setMaxStreak, swapLatest, toggleForcedRest, undoLatest } from './state.js';
import { generateMatch } from './matchGenerator.js';
import { loadState, saveState } from './storage.js';
import { render } from './ui.js';

let state = loadState(), visibleCount = 3, selected = null;
const refresh = () => {
  render(state, { visibleCount, selected });
  if (selected !== null) document.querySelector(`#playing [data-swap-id="${selected}"], #resting [data-swap-id="${selected}"]`)?.focus();
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

document.querySelector('#next-match').addEventListener('click', () => attempt(() => commit(appendMatch(state, generateMatch(state)))));
document.querySelector('#undo-match').addEventListener('click', () => commit(undoLatest(state)));
document.querySelector('#more-history').addEventListener('click', () => { visibleCount += 5; refresh(); });
document.querySelector('#new-session').addEventListener('click', () => {
  if (window.confirm('履歴と統計を消して新しいセッションを開始しますか？')) { visibleCount = 3; commit(newSession(state)); }
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
refresh();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
