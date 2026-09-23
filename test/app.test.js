import test from 'node:test';
import assert from 'node:assert/strict';
import { activeIds, appendMatch, changeCount, createInitialState, newSession, pairKey, setMaxStreak, swapLatest, toggleForcedRest, undoLatest } from '../js/state.js';
import { generateMatch } from '../js/matchGenerator.js';
import { loadState, saveState, STORAGE_KEY } from '../js/storage.js';

const next = state => appendMatch(state, generateMatch(state, () => 0), 1000 + state.history.length);
const verifyMatch = match => {
  assert.equal(match.teamA.length, 2); assert.equal(match.teamB.length, 2);
  assert.equal(match.resting.length, match.activePlayers.length - 4);
  assert.deepEqual([...match.teamA, ...match.teamB, ...match.resting].sort((a, b) => a - b), match.activePlayers);
  assert.deepEqual(Object.keys(match.streakSnapshot).map(Number).sort((a, b) => a - b), [...match.teamA, ...match.teamB].sort((a, b) => a - b));
};
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('5・6・7人で全試合の構造と連番が正しい', () => {
  for (const count of [5, 6, 7]) {
    let state = createInitialState(count);
    for (let n = 0; n < 40; n++) state = next(state);
    state.history.forEach((match, i) => { verifyMatch(match); assert.equal(match.matchNumber, i + 1); });
    assert.equal(state.players[1].matches + state.players[1].rests, 40);
  }
});

test('7→5→7で履歴と累計を保持し、退出した連続数は切れる', () => {
  let state = next(createInitialState(7));
  const oldMatch = state.history[0];
  const before = { ...state.players[7] };
  state = changeCount(state, 5);
  assert.equal(state.players[7].playStreak, 0);
  state = next(state);
  assert.deepEqual(state.history[0].activePlayers, oldMatch.activePlayers);
  assert.deepEqual(state.history[1].activePlayers, [1, 2, 3, 4, 5]);
  state = changeCount(state, 7);
  assert.equal(state.players[7].matches, before.matches);
  assert.equal(state.players[7].rests, before.rests);
  assert.equal(state.players[7].playStreak, 0);
  state = next(state);
  verifyMatch(state.history.at(-1));
});

test('複数の強制休息、過剰指定の拒否、確定後の解除', () => {
  let state = createInitialState(6);
  state = toggleForcedRest(state, 5);
  state = toggleForcedRest(state, 6);
  assert.throws(() => toggleForcedRest(state, 1), /4人未満/);
  state = next(state);
  assert.deepEqual(state.history[0].resting, [5, 6]);
  assert.deepEqual(state.forcedRest, []);
});

test('上限を守れる候補を選び、必要時は違反人数を最小化する', () => {
  let state = createInitialState(5);
  state = setMaxStreak(state, 1, 1);
  state = appendMatch(state, { teamA: [1, 2], teamB: [3, 4] }, 1);
  assert.equal(generateMatch(state, () => 0).teamA.concat(generateMatch(state, () => 0).teamB).includes(1), false);
  for (let id = 2; id <= 5; id++) state = setMaxStreak(state, id, 1);
  const selection = generateMatch(state, () => 0);
  assert.equal(selection.relaxed, true);
  const playing = [...selection.teamA, ...selection.teamB];
  assert.equal(playing.filter(id => state.players[id].playStreak + 1 > 1).length, 3);
  assert.equal(createInitialState().players[1].maxStreak, null);
});

test('3種類の交換で履歴・統計・ペア/対戦回数が再計算される', () => {
  const base = appendMatch(createInitialState(6), { teamA: [1, 2], teamB: [3, 4] }, 55);
  for (const [a, b] of [[1, 2], [1, 5], [5, 6]]) {
    const state = swapLatest(base, a, b), match = state.history[0];
    verifyMatch(match);
    assert.equal(match.timestamp, 55);
    assert.equal(match.matchNumber, 1);
    for (const id of activeIds(state)) {
      assert.equal(state.players[id].matches, Number([...match.teamA, ...match.teamB].includes(id)));
      assert.equal(state.players[id].rests, Number(match.resting.includes(id)));
    }
    assert.equal(state.pairCounts[pairKey(...match.teamA)], 1);
    assert.equal(state.pairCounts[pairKey(...match.teamB)], 1);
    assert.equal(Object.values(state.opponentCounts).reduce((sum, n) => sum + n, 0), 4);
  }
});

test('取消は最新のみ削除し、番号を再利用する', () => {
  let state = next(next(createInitialState()));
  state = undoLatest(state);
  assert.equal(state.history.length, 1);
  assert.equal(state.players[1].matches + state.players[1].rests, 1);
  state = next(state);
  assert.equal(state.history.at(-1).matchNumber, 2);
  state = undoLatest(undoLatest(state));
  assert.equal(state.history.length, 0);
  assert.equal(undoLatest(state), state);
});

test('保存復元・破損・未知バージョン・新セッション', () => {
  const storage = memoryStorage();
  let state = createInitialState(7);
  state = setMaxStreak(state, 2, 3);
  state = next(state);
  state = toggleForcedRest(state, 1);
  saveState(state, storage);
  const restored = loadState(storage);
  assert.deepEqual(restored.history, state.history);
  assert.deepEqual(restored.players, state.players);
  assert.deepEqual(restored.forcedRest, [1]);
  const reset = newSession(restored);
  assert.equal(reset.history.length, 0);
  assert.equal(reset.maxStreaks[2], 3);
  assert.equal(reset.participantCount, 7);
  storage.setItem(STORAGE_KEY, '{invalid');
  assert.equal(loadState(storage).history.length, 0);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
  assert.match(loadState(storage).notice, /読み込めなかった/);
});
