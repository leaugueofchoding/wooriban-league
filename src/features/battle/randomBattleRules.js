// src/features/battle/randomBattleRules.js
// 랜덤대전 M1~M5, M8~M9에서 공통으로 쓰는 순수 규칙 헬퍼입니다.

export const RANDOM_BATTLE_CONFIG = Object.freeze({
  DAILY_BATTLE_LIMIT: 2,
  TEAM_SIZE_1V1: 3,
  TEAM_SIZE_2V2: 2,
  VITAMIN_JELLY_ITEM_ID: 'vitamin_jelly',
  SAME_OPPONENT_RELAX_MS: 90 * 1000,
  REMATCH_COOLDOWN_MS: 60 * 1000,
  ENTRANCE_TIMEOUT_MS: 20 * 1000,
});

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getTodayString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getDailyBattleCount = (pet, today = getTodayString()) => (
  pet?.lastBattleDate === today ? Math.max(0, num(pet.dailyBattleCount, 0)) : 0
);

export const getPetBattleFatigueLabel = (pet, today = getTodayString()) => {
  const count = Math.min(getDailyBattleCount(pet, today), RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT);
  return `오늘 대전: ${count}/${RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT}`;
};

export const isPetAlive = (pet) => num(pet?.hp, 0) > 0;

export const isPetBattleLocked = (pet, lockedPetIds = []) => Boolean(
  pet?.id && (
    lockedPetIds.includes(pet.id) ||
    pet.activeBattleId ||
    pet.currentBattleId ||
    pet.battleLockId ||
    pet.lockedBattleId ||
    pet.randomBattleQueueId
  )
);

export const canPetBattleToday = (pet, today = getTodayString()) => (
  getDailyBattleCount(pet, today) < RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT
);

export const canUseVitaminJellyToday = (pet, today = getTodayString()) => (
  Boolean(pet?.id) && pet.vitaminJellyUsedDate !== today
);

export const isPetEligibleForRandomBattle = ({ pet, today = getTodayString(), lockedPetIds = [] } = {}) => (
  Boolean(pet?.id) &&
  isPetAlive(pet) &&
  canPetBattleToday(pet, today) &&
  !isPetBattleLocked(pet, lockedPetIds)
);

export const normalizeBattlePresetPetIds = (battlePresetPetIds = {}) => ({
  leadPetId: battlePresetPetIds?.leadPetId || null,
  benchPetId: battlePresetPetIds?.benchPetId || null,
  thirdPetId: battlePresetPetIds?.thirdPetId || null,
});

export const getPresetPetIdsInOrder = (player = {}) => {
  const preset = normalizeBattlePresetPetIds(player.battlePresetPetIds);
  return [preset.leadPetId, preset.benchPetId, preset.thirdPetId].filter(Boolean);
};

const stableOrder = (pet, index) => num(pet?.createdOrder ?? pet?.sortOrder ?? pet?.createdAtMs, index);

export const sortFallbackPetsForRandomBattle = (pets = [], today = getTodayString(), lockedPetIds = []) => pets
  .map((pet, index) => ({ pet, index }))
  .filter(({ pet }) => isPetEligibleForRandomBattle({ pet, today, lockedPetIds }))
  .sort((a, b) => (
    num(b.pet.level, 1) - num(a.pet.level, 1) ||
    num(b.pet.hp, 0) - num(a.pet.hp, 0) ||
    stableOrder(a.pet, a.index) - stableOrder(b.pet, b.index)
  ))
  .map(({ pet }) => pet);

export const resolveRandomBattleTeam = ({
  player,
  today = getTodayString(),
  lockedPetIds = [],
  teamSize = RANDOM_BATTLE_CONFIG.TEAM_SIZE_1V1,
} = {}) => {
  const pets = Array.isArray(player?.pets) ? player.pets : [];
  const petById = new Map(pets.map((pet) => [pet?.id, pet]).filter(([id]) => Boolean(id)));
  const selected = [];
  const selectedIds = new Set();

  getPresetPetIdsInOrder(player).forEach((petId) => {
    if (selected.length >= teamSize || selectedIds.has(petId)) return;
    const pet = petById.get(petId);
    if (isPetEligibleForRandomBattle({ pet, today, lockedPetIds })) {
      selected.push(pet);
      selectedIds.add(petId);
    }
  });

  sortFallbackPetsForRandomBattle(pets, today, lockedPetIds).forEach((pet) => {
    if (selected.length >= teamSize || selectedIds.has(pet.id)) return;
    selected.push(pet);
    selectedIds.add(pet.id);
  });

  const average = selected.length
    ? selected.reduce((sum, pet) => sum + num(pet.level, 1), 0) / selected.length
    : 0;

  return {
    team: selected,
    petIds: selected.map((pet) => pet.id),
    matchLevel: Math.round(average * 10) / 10,
    isComplete: selected.length === teamSize,
    missingCount: Math.max(0, teamSize - selected.length),
  };
};

export const snapshotPetForRandomQueue = (pet) => ({
  id: pet.id,
  name: pet.name,
  species: pet.species || null,
  appearanceId: pet.appearanceId || null,
  element: pet.element || null,
  level: num(pet.level, 1),
  hp: num(pet.hp, 0),
  maxHp: num(pet.maxHp, 0),
  sp: num(pet.sp, 0),
  maxSp: num(pet.maxSp, 0),
  atk: num(pet.atk, 0),
  equippedSkills: Array.isArray(pet.equippedSkills) ? [...pet.equippedSkills] : [],
  skills: Array.isArray(pet.skills) ? [...pet.skills] : [],
});

export const applyBattleFatigueToPets = ({ pets = [], petIds = [], today = getTodayString() } = {}) => {
  const targets = new Set(petIds.filter(Boolean));
  return pets.map((pet) => {
    if (!pet?.id || !targets.has(pet.id)) return pet;
    const count = getDailyBattleCount(pet, today);
    if (count >= RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT) {
      throw new Error(`${pet.name || '이 펫'}은 오늘 충분히 싸워서 쉬어야 해요.`);
    }
    return { ...pet, dailyBattleCount: count + 1, lastBattleDate: today };
  });
};

export const resetPetBattleFatigueByVitaminJelly = ({ pets = [], petId, today = getTodayString() } = {}) => {
  let found = false;
  const nextPets = pets.map((pet) => {
    if (pet?.id !== petId) return pet;
    if (!canUseVitaminJellyToday(pet, today)) throw new Error('이 펫은 오늘 이미 비타민젤리를 먹었어요.');
    found = true;
    return { ...pet, dailyBattleCount: 0, lastBattleDate: today, vitaminJellyUsedDate: today };
  });
  if (!found) throw new Error('비타민젤리를 먹일 펫을 찾을 수 없습니다.');
  return nextPets;
};

const levelBand = (waitMs) => {
  if (waitMs < 30 * 1000) return 2;
  if (waitMs < 60 * 1000) return 5;
  if (waitMs < 90 * 1000) return 7;
  return 99;
};

export const scoreRandom1v1Candidate = ({ me, candidate, todayOpponentIds = [], recentOpponentCounts = {}, nowMs = Date.now() } = {}) => {
  if (!me || !candidate || me.playerId === candidate.playerId) return Number.POSITIVE_INFINITY;
  const waitMs = Math.max(0, nowMs - num(me.queueStartedAtMs, nowMs));
  const diff = Math.abs(num(me.matchLevel, 1) - num(candidate.matchLevel, 1));
  const metToday = todayOpponentIds.includes(candidate.playerId);
  if (metToday && waitMs < RANDOM_BATTLE_CONFIG.SAME_OPPONENT_RELAX_MS) return Number.POSITIVE_INFINITY;
  const levelPenalty = diff <= levelBand(waitMs) ? diff * 10 : 1000 + diff * 20;
  const todayPenalty = metToday ? 100 : 0;
  const recentPenalty = num(recentOpponentCounts[candidate.playerId], 0) * 25;
  const waitBonus = Math.min(30, Math.floor(waitMs / 1000) * 0.5);
  return levelPenalty + todayPenalty + recentPenalty - waitBonus;
};

export const chooseRandom1v1Candidate = ({ me, queueEntries = [], todayOpponentIds = [], recentOpponentCounts = {}, nowMs = Date.now() } = {}) => queueEntries
  .filter((entry) => entry?.status === 'waiting' && entry.playerId !== me?.playerId)
  .map((candidate) => ({ candidate, score: scoreRandom1v1Candidate({ me, candidate, todayOpponentIds, recentOpponentCounts, nowMs }) }))
  .filter(({ score }) => Number.isFinite(score))
  .sort((a, b) => a.score - b.score)[0]?.candidate || null;

const pairKey = (a, b) => [a, b].filter(Boolean).sort().join('__');
const combinations = (items, size) => {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
};

export const scoreTeamSplit = ({ teamA = [], teamB = [], sameTeamPairCounts = {}, opponentPairCounts = {}, nowMs = Date.now() } = {}) => {
  const avg = (team) => team.length ? team.reduce((sum, entry) => sum + num(entry.matchLevel ?? entry.petLevel, 1), 0) / team.length : 0;
  let sameTeamPenalty = 0;
  [teamA, teamB].forEach((team) => {
    for (let i = 0; i < team.length; i += 1) {
      for (let j = i + 1; j < team.length; j += 1) {
        sameTeamPenalty += num(sameTeamPairCounts[pairKey(team[i].playerId, team[j].playerId)], 0) * 40;
      }
    }
  });
  const opponentPenalty = teamA.reduce((sum, a) => sum + teamB.reduce((inner, b) => inner + num(opponentPairCounts[pairKey(a.playerId, b.playerId)], 0) * 15, 0), 0);
  const oldestWaitMs = Math.max(0, ...[...teamA, ...teamB].map((entry) => nowMs - num(entry.queueStartedAtMs, nowMs)));
  return Math.abs(avg(teamA) - avg(teamB)) * 15 + sameTeamPenalty + opponentPenalty - Math.min(50, Math.floor(oldestWaitMs / 1000) * 0.4);
};

export const chooseBalancedTeamSplit = ({ queueEntries = [], teamSize = RANDOM_BATTLE_CONFIG.TEAM_SIZE_2V2, sameTeamPairCounts = {}, opponentPairCounts = {}, nowMs = Date.now() } = {}) => {
  const needed = teamSize * 2;
  const pool = queueEntries.filter((entry) => entry?.status === 'waiting').sort((a, b) => num(a.queueStartedAtMs, nowMs) - num(b.queueStartedAtMs, nowMs)).slice(0, needed);
  if (pool.length < needed) return null;
  const [first, ...rest] = pool;
  return combinations(rest, teamSize - 1)
    .map((partialA) => {
      const teamA = [first, ...partialA];
      const ids = new Set(teamA.map((entry) => entry.playerId));
      const teamB = pool.filter((entry) => !ids.has(entry.playerId));
      return { teamA, teamB, score: scoreTeamSplit({ teamA, teamB, sameTeamPairCounts, opponentPairCounts, nowMs }) };
    })
    .sort((a, b) => a.score - b.score)[0] || null;
};
