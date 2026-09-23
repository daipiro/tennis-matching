import { appendMatch, changeCount, newSession, setMaxStreak, toggleForcedRest, undoLatest } from './state.js?v=52';
import { generateMatch } from './matchGenerator.js?v=52';
import { loadState, saveState } from './storage.js?v=52';
import { render } from './ui.js?v=52';

let state = loadState(), nextMatch, selected = null;
function createNextMatch() {
  const selection = generateMatch(state);
  const playing = [...selection.teamA, ...selection.teamB];
  return {
    ...selection,
    matchNumber: state.history.length + 1,
    resting: Array.from({ length: state.participantCount }, (_, index) => index + 1).filter(id => !playing.includes(id)),
    streakSnapshot: Object.fromEntries(playing.map(id => [id, state.players[id].playStreak + 1])),
    restStreakSnapshot: Object.fromEntries(Array.from({ length: state.participantCount }, (_, index) => index + 1).filter(id => !playing.includes(id)).map(id => [id, state.players[id].restStreak + 1]))
  };
}
const refresh = ({ regenerateNext = true } = {}) => {
  if (regenerateNext || !nextMatch) nextMatch = createNextMatch();
  render(state, { nextMatch, selected });
  if (selected !== null) document.querySelector(`#next-match-preview [data-swap-id="${selected}"]`)?.focus();
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
  commit(appendMatch(state, nextMatch));
  requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
}));
document.querySelector('#undo-match').addEventListener('click', () => commit(undoLatest(state)));
document.querySelector('#new-session').addEventListener('click', () => {
  if (window.confirm('履歴と統計を消して新しいセッションを開始しますか？')) commit(newSession(state));
});
document.querySelector('#next-match-preview').addEventListener('click', event => {
  const chip = event.target.closest('[data-swap-id]');
  if (!chip) return;
  const id = Number(chip.dataset.swapId);
  if (selected === null) {
    selected = id;
    refresh({ regenerateNext: false });
  } else if (selected === id) {
    selected = null;
    refresh({ regenerateNext: false });
  } else {
    const swap = players => players.map(player => player === selected ? id : player === id ? selected : player);
    const teamA = swap(nextMatch.teamA), teamB = swap(nextMatch.teamB), resting = swap(nextMatch.resting);
    const playing = [...teamA, ...teamB];
    nextMatch = {
      ...nextMatch,
      teamA,
      teamB,
      resting,
      streakSnapshot: Object.fromEntries(playing.map(player => [player, state.players[player].playStreak + 1])),
      restStreakSnapshot: Object.fromEntries(resting.map(player => [player, state.players[player].restStreak + 1]))
    };
    selected = null;
    refresh({ regenerateNext: false });
  }
});
document.querySelector('#settings').addEventListener('click', event => {
  const button = event.target.closest('[data-force-id]');
  if (button) attempt(() => commit(toggleForcedRest(state, Number(button.dataset.forceId))));
  const limit = event.target.closest('[data-max-id]');
  if (limit) attempt(() => commit(setMaxStreak(state, Number(limit.dataset.maxId), limit.dataset.maxValue === '' ? null : Number(limit.dataset.maxValue))));
});
document.querySelector('#settings').addEventListener('change', event => {
  if (event.target.id === 'participant-count') attempt(() => commit(changeCount(state, Number(event.target.value))));
});
window.addEventListener('hashchange', showScreen);
showScreen();
refresh();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
