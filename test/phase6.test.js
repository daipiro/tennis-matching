import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, pairKey, setMaxStreak, toggleForcedRest } from '../js/state.js';
import { generateMatch } from '../js/matchGenerator.js';

const playing = match => [...match.teamA, ...match.teamB];
const resting = match => Array.from({ length: 8 }, (_, index) => index + 1).filter(id => !playing(match).includes(id));

const withRestingPlayers = state => ({
  ...state,
  players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, {
    ...player,
    restStreak: Number(id) <= 4 ? 1 : 0
  }]))
});

const pairRepetition = (state, match) => Math.max(
  state.pairCounts[pairKey(...match.teamA)] || 0,
  state.pairCounts[pairKey(...match.teamB)] || 0
);

const opponentRepetition = (state, match) => Math.max(...match.teamA.flatMap(a => match.teamB.map(b => state.opponentCounts[pairKey(a, b)] || 0)));

test('8人時は連続休息回避よりペア重複回避を優先する', () => {
  const base = withRestingPlayers(createInitialState(8));
  const state = {
    ...base,
    pairCounts: Object.fromEntries([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].map(([a, b]) => [pairKey(a, b), 1]))
  };
  const match = generateMatch(state, () => 0);

  assert.equal(pairRepetition(state, match), 0);
  assert.ok(resting(match).some(id => id <= 4));
});

test('8人時は連続休息回避より対戦相手重複回避を優先する', () => {
  const base = withRestingPlayers(createInitialState(8));
  const state = {
    ...base,
    opponentCounts: Object.fromEntries([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].map(([a, b]) => [pairKey(a, b), 1]))
  };
  const match = generateMatch(state, () => 0);

  assert.equal(opponentRepetition(state, match), 0);
  assert.ok(resting(match).some(id => id <= 4));
});

test('8人時も強制休息と最大連続出場上限を優先する', () => {
  let forced = createInitialState(8);
  forced = toggleForcedRest(forced, 1);
  assert.equal(playing(generateMatch(forced, () => 0)).includes(1), false);

  let limited = createInitialState(8);
  limited = setMaxStreak(limited, 1, 1);
  limited = {
    ...limited,
    players: { ...limited.players, 1: { ...limited.players[1], playStreak: 1 } },
    pairCounts: Object.fromEntries([[2, 3], [2, 4], [3, 4]].map(([a, b]) => [pairKey(a, b), 100])),
    opponentCounts: Object.fromEntries([[2, 3], [2, 4], [3, 4]].map(([a, b]) => [pairKey(a, b), 100]))
  };
  assert.equal(playing(generateMatch(limited, () => 0)).includes(1), false);
});

test('8人時も累計均等と連続出場の偏りをペア重複より優先する', () => {
  const repeatedPairs = Object.fromEntries([[5, 6], [5, 7], [5, 8], [6, 7], [6, 8], [7, 8]].map(([a, b]) => [pairKey(a, b), 100]));
  const base = createInitialState(8);
  const imbalanced = {
    ...base,
    players: Object.fromEntries(Object.entries(base.players).map(([id, player]) => [id, {
      ...player,
      matches: Number(id) <= 4 ? 10 : 0
    }])),
    pairCounts: repeatedPairs
  };
  const balancedMatch = generateMatch(imbalanced, () => 0);
  assert.deepEqual(playing(balancedMatch).sort((a, b) => a - b), [5, 6, 7, 8]);
  assert.ok(pairRepetition(imbalanced, balancedMatch) > 0);

  const streakBiased = {
    ...base,
    players: Object.fromEntries(Object.entries(base.players).map(([id, player]) => [id, {
      ...player,
      playStreak: Number(id) <= 4 ? 0 : 5
    }])),
    pairCounts: Object.fromEntries([[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]].map(([a, b]) => [pairKey(a, b), 100]))
  };
  const streakMatch = generateMatch(streakBiased, () => 0);
  assert.deepEqual(playing(streakMatch).sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.ok(pairRepetition(streakBiased, streakMatch) > 0);
});

test('4〜7人時は連続休息回避をペア重複回避より先に評価する', () => {
  const base = createInitialState(7);
  const state = {
    ...base,
    players: Object.fromEntries(Object.entries(base.players).map(([id, player]) => [id, {
      ...player,
      restStreak: Number(id) <= 3 ? 1 : 0
    }])),
    pairCounts: Object.fromEntries([[1, 2], [1, 3], [2, 3]].map(([a, b]) => [pairKey(a, b), 1]))
  };
  const match = generateMatch(state, () => 0);

  assert.equal([1, 2, 3].every(id => playing(match).includes(id)), true);
  assert.ok(pairRepetition(state, match) > 0);
});
