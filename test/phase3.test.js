import test from 'node:test';
import assert from 'node:assert/strict';
import { appendMatch, createInitialState, newSession, pairKey, setMaxStreak, swapLatest, toggleForcedRest, undoLatest } from '../js/state.js';
import { generateCandidates, generateMatch } from '../js/matchGenerator.js';

const next = state => appendMatch(state, generateMatch(state, () => 0), 1000 + state.history.length);
const playing = match => [...match.teamA, ...match.teamB];

const verifyMatch = match => {
  assert.equal(playing(match).length, 4);
  assert.equal(match.resting.length, match.activePlayers.length - 4);
  assert.deepEqual([...playing(match), ...match.resting].sort((a, b) => a - b), match.activePlayers);
};

test('4〜8人の候補数と連続生成の試合構造が正しい', () => {
  assert.equal(generateCandidates(createInitialState(4)).length, 3);
  assert.equal(generateCandidates(createInitialState(8)).length, 210);
  for (const count of [4, 5, 6, 7, 8]) {
    let state = createInitialState(count);
    for (let index = 0; index < 40; index++) state = next(state);
    state.history.forEach(verifyMatch);
    assert.equal(state.players[1].matches + state.players[1].rests, 40);
  }
});

test('4人時の上限緩和と8人時の強制休息を正しく扱う', () => {
  let four = createInitialState(4);
  for (let id = 1; id <= 4; id++) four = setMaxStreak(four, id, 1);
  four = appendMatch(four, { teamA: [1, 2], teamB: [3, 4] }, 1);
  const forcedRelaxation = generateMatch(four, () => 0);
  assert.equal(forcedRelaxation.relaxed, true);
  assert.deepEqual([...forcedRelaxation.teamA, ...forcedRelaxation.teamB].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.throws(() => toggleForcedRest(four, 1), /4人参加時/);

  let eight = createInitialState(8);
  for (const id of [5, 6, 7, 8]) eight = toggleForcedRest(eight, id);
  assert.throws(() => toggleForcedRest(eight, 1), /4人未満/);
  const selection = generateMatch(eight, () => 0);
  assert.deepEqual([...selection.teamA, ...selection.teamB].sort((a, b) => a - b), [1, 2, 3, 4]);
  eight = appendMatch(eight, selection, 2);
  assert.deepEqual(eight.history[0].resting, [5, 6, 7, 8]);
  assert.deepEqual(eight.forcedRest, []);
});

test('プレイヤー8を含む交換、取消、新しいセッションで統計を再計算する', () => {
  const base = appendMatch(createInitialState(8), { teamA: [1, 8], teamB: [2, 3] }, 55);
  for (const [first, second] of [[1, 8], [1, 4], [4, 5]]) {
    const state = swapLatest(base, first, second);
    const match = state.history[0];
    verifyMatch(match);
    assert.equal(state.players[8].matches + state.players[8].rests, 1);
    assert.equal(state.pairCounts[pairKey(...match.teamA)], 1);
    assert.equal(state.pairCounts[pairKey(...match.teamB)], 1);
  }
  const undone = undoLatest(base);
  assert.equal(undone.history.length, 0);
  let configured = setMaxStreak(base, 8, 3);
  configured = newSession(configured);
  assert.equal(configured.participantCount, 8);
  assert.equal(configured.maxStreaks[8], 3);
  assert.equal(configured.history.length, 0);
});
