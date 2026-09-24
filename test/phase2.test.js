import test from 'node:test';
import assert from 'node:assert/strict';
import { appendMatch, createInitialState, setMaxStreak, toggleForcedRest } from '../js/state.js';
import { generateMatch } from '../js/matchGenerator.js';
import { STORAGE_KEY, STORAGE_VERSION, loadState, saveState } from '../js/storage.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('バージョン1保存データを履歴・設定を保持してバージョン2へ移行する', () => {
  const storage = memoryStorage();
  let source = createInitialState(5);
  source = setMaxStreak(source, 2, 3);
  source = appendMatch(source, generateMatch(source, () => 0), 123);
  source = toggleForcedRest(source, 1);
  const legacyMatch = { ...source.events[0].match };
  delete legacyMatch.restStreakSnapshot;
  storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    initialCount: 5,
    events: [{ type: 'match', match: legacyMatch }],
    maxStreaks: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 1, source.maxStreaks[index + 1]])),
    forcedRest: [1]
  }));

  const migrated = loadState(storage);
  assert.equal(migrated.history.length, 1);
  assert.equal(migrated.history[0].timestamp, 123);
  assert.equal(migrated.maxStreaks[2], 3);
  assert.equal(migrated.maxStreaks[8], null);
  assert.deepEqual(migrated.forcedRest, [1]);
  assert.deepEqual(Object.keys(migrated.history[0].restStreakSnapshot).map(Number), migrated.history[0].resting);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, STORAGE_VERSION);
});

test('4人・8人の新形式を保存復元し、不正な8人データを安全に拒否する', () => {
  const storage = memoryStorage();
  let state = createInitialState(8);
  state = toggleForcedRest(state, 5);
  state = toggleForcedRest(state, 6);
  state = toggleForcedRest(state, 7);
  state = toggleForcedRest(state, 8);
  saveState(state, storage);
  const restored = loadState(storage);
  assert.equal(restored.participantCount, 8);
  assert.deepEqual(restored.forcedRest, [5, 6, 7, 8]);

  const invalid = JSON.parse(storage.getItem(STORAGE_KEY));
  invalid.forcedRest = [1, 2, 3, 4, 5];
  storage.setItem(STORAGE_KEY, JSON.stringify(invalid));
  assert.match(loadState(storage).notice, /読み込めなかった/);
});
