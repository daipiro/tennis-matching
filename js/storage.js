import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, PLAYER_IDS, createInitialState, recompute, validParticipantCount } from './state.js';

export const STORAGE_KEY = 'tennis-randomizer-v1';
export const STORAGE_VERSION = 2;
const LEGACY_VERSION = 1;
const isId = id => Number.isInteger(id) && id >= 1 && id <= MAX_PARTICIPANTS;
const legacyCountOK = count => [5, 6, 7].includes(count);
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);

function validate(raw, { version, countOK, maxId, allowMissingRestSnapshot = false }) {
  if (!raw || raw.version !== version || !countOK(raw.initialCount) || !Array.isArray(raw.events) || !raw.maxStreaks || !Array.isArray(raw.forcedRest)) throw Error('保存形式が無効です');
  for (let id = 1; id <= maxId; id++) {
    const value = raw.maxStreaks[id];
    if (!(value === null || (Number.isInteger(value) && value >= 1 && value <= 99))) throw Error('設定が無効です');
  }
  let count = raw.initialCount, matchNumber = 0;
  for (const event of raw.events) {
    if (event.type === 'roster') {
      if (!countOK(event.count) || event.count === count) throw Error('人数変更が無効です');
      count = event.count;
    } else if (event.type === 'match') {
      const m = event.match;
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      if (!m || m.matchNumber !== ++matchNumber || !Number.isFinite(m.timestamp) || !Array.isArray(m.activePlayers) || !same(m.activePlayers, expected) || !Array.isArray(m.teamA) || m.teamA.length !== 2 || !Array.isArray(m.teamB) || m.teamB.length !== 2 || !Array.isArray(m.resting) || m.resting.length !== count - 4 || !m.streakSnapshot || typeof m.streakSnapshot !== 'object') throw Error('試合データが無効です');
      const all = [...m.teamA, ...m.teamB, ...m.resting];
      if (!all.every(isId) || !same([...all].sort((a, b) => a - b), expected)) throw Error('参加者が無効です');
      const playing = [...m.teamA, ...m.teamB];
      if (!same(Object.keys(m.streakSnapshot).map(Number).sort((a, b) => a - b), [...playing].sort((a, b) => a - b)) || Object.values(m.streakSnapshot).some(value => !Number.isInteger(value) || value < 1)) throw Error('連続出場記録が無効です');
      if (!allowMissingRestSnapshot && (!m.restStreakSnapshot || typeof m.restStreakSnapshot !== 'object' || !same(Object.keys(m.restStreakSnapshot).map(Number).sort((a, b) => a - b), [...m.resting].sort((a, b) => a - b)) || Object.values(m.restStreakSnapshot).some(value => !Number.isInteger(value) || value < 1))) throw Error('連続休息記録が無効です');
    } else throw Error('イベントが無効です');
  }
  if (new Set(raw.forcedRest).size !== raw.forcedRest.length || raw.forcedRest.some(id => !Number.isInteger(id) || id < 1 || id > maxId || id > count) || count - raw.forcedRest.length < MIN_PARTICIPANTS) throw Error('強制休息が無効です');
  const maxStreaks = Object.fromEntries(PLAYER_IDS.map(id => [id, raw.maxStreaks[id] !== null && raw.maxStreaks[id] > 4 ? null : raw.maxStreaks[id] ?? null]));
  const state = recompute({ initialCount: raw.initialCount, participantCount: count, events: raw.events, maxStreaks, forcedRest: raw.forcedRest, notice: '' });
  for (let i = 0; i < state.history.length; i++) {
    const saved = raw.events.filter(event => event.type === 'match')[i].match.streakSnapshot;
    if (JSON.stringify(saved) !== JSON.stringify(state.history[i].streakSnapshot)) throw Error('連続出場記録が一致しません');
  }
  return state;
}

function migrateV1(raw) {
  const legacyState = validate(raw, { version: LEGACY_VERSION, countOK: legacyCountOK, maxId: 7, allowMissingRestSnapshot: true });
  return {
    ...raw,
    version: STORAGE_VERSION,
    events: legacyState.events,
    maxStreaks: legacyState.maxStreaks
  };
}

function loadValidated(raw) {
  const current = raw.version === LEGACY_VERSION ? migrateV1(raw) : raw;
  const state = validate(current, { version: STORAGE_VERSION, countOK: validParticipantCount, maxId: MAX_PARTICIPANTS });
  return { state, migrated: raw.version === LEGACY_VERSION };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (!value) return createInitialState();
    const { state, migrated } = loadValidated(JSON.parse(value));
    if (migrated) saveState(state, storage);
    return state;
  } catch {
    return { ...createInitialState(), notice: '保存データを読み込めなかったため、新しい状態で開始しました。' };
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, initialCount: state.initialCount, events: state.events, maxStreaks: state.maxStreaks, forcedRest: state.forcedRest }));
}
