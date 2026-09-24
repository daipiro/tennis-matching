import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCount, createInitialState, toggleForcedRest } from '../js/state.js';

test('4〜8人の初期状態と人数変更でプレイヤー1〜8を扱う', () => {
  for (const count of [4, 5, 6, 7, 8]) {
    const state = createInitialState(count);
    assert.equal(state.participantCount, count);
    assert.equal(Object.keys(state.players).length, 8);
    assert.equal(state.players[8].maxStreak, null);
    assert.deepEqual(Object.values(state.players).filter(player => player.active).map(player => player.id), Array.from({ length: count }, (_, index) => index + 1));
  }
  assert.throws(() => createInitialState(3), /4〜8人/);
  assert.throws(() => createInitialState(9), /4〜8人/);
});

test('4→8→4と8→4→8で参加状態と強制休息を正規化する', () => {
  let state = createInitialState(4);
  state = changeCount(state, 8);
  state = toggleForcedRest(state, 7);
  state = toggleForcedRest(state, 8);
  assert.deepEqual(state.forcedRest, [7, 8]);
  state = changeCount(state, 4);
  assert.deepEqual(state.forcedRest, []);
  assert.equal(state.players[8].active, false);
  state = changeCount(state, 8);
  assert.equal(state.players[8].active, true);
  assert.equal(state.players[8].playStreak, 0);
  assert.equal(state.players[8].restStreak, 0);
  assert.throws(() => toggleForcedRest(changeCount(createInitialState(8), 4), 1), /4人参加時/);
});
