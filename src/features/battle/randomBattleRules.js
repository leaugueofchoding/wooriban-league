// src/features/battle/randomBattleRules.js
// RANDOM_BATTLE_QUEUE_M1_M3_RULES
// 랜덤대전 프리셋, 펫별 배틀 피로도, 비타민젤리, 매칭 점수 계산에 쓰는 순수 헬퍼입니다.

export const RANDOM_BATTLE_CONFIG = Object.freeze({
  DAILY_BATTLE_LIMIT: 2,
  VITAMIN_JELLY_ITEM_ID: 'vitamin_jelly',
  SAME_OPPONENT_RELAX_MS: 90 * 1000,
  REMATCH_COOLDOWN_MS: 60 * 1000,
  ENTRANCE_TIMEOUT_MS: 20 * 1000,
  DEFAULT_RANDOM_1V1_TEAM_SIZE: 3,
  DEFAULT_TEAM_BATTLE_SIZE: 2,
});

export const getTodayString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getPetStableOrder = (pet, index) => {
  if (Number.isFinite(Number(pet?.createdOrder))) return Number(pet.createdOrder);
  if (Number.isFinite(Number(pet?.sortOrder))) return Number(pet.sortOrder);
  if (Number.isFinite(Number(pet?.createdAtMs))) return Number(pet.createdAtMs);
  return index;
};

export const getDailyBattleCount = (pet, today = getTodayString()) => {
  if (!pet || pet.lastBattleDate !== today) return 0;
  return Math.max(0, toNumber(pet.dailyBattleCount, 0));
};

export const isPetAlive = (pet) => toNumber(pet?.hp, 0) > 0;

export const isPetBattleLocked = (pet, lockedPetIds = []) => {
  if (!pet?.id) return false;
  if (lockedPetIds.includes(pet.id)) return true;
  return Boolean(
    pet.activeBattleId ||
    pet.currentBattleId ||
    pet.battleLockId ||
    pet.lockedBattleId ||
    pet.randomBattleQueueId
  );
};

export const canPetBattleToday = (
  pet,
  today = getTodayString(),
  dailyLimit = RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT
) => getDailyBattleCount(pet, today) < dailyLimit;

export const canUseVitaminJellyToday = (pet, today = getTodayString()) => (
  Boolean(pet?.id) && pet.vitaminJellyUsedDate !== today
);

export const getPetBattleFatigueLabel = (
  pet,
  today = getTodayString(),
  dailyLimit = RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT
) => {
  const count = getDailyBattleCount(pet, today);
  return `오늘 대전: ${Math.min(count, dailyLimit)}/${dailyLimit}`;
};

export const isPetEligibleForRandomBattle = ({
  pet,
  today = getTodayString(),
  lockedPetIds = [],
  dailyLimit = RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT,
} = {}) => (
  Boolean(pet?.id) &&
  isPetAlive(pet) &&
  canPetBattleToday(pet, today, dailyLimit) &&
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

export const sortFallbackPetsForRandomBattle = (
  pets = [],
  today = getTodayString(),
  lockedPetIds = []
) => pets
  .map((pet, index) => ({ pet, index }))
  .filter(({ pet }) => isPetEligibleForRandomBattle({ pet, today, lockedPetIds }))
  .sort((a, b) => {
    const levelDiff = toNumber(b.pet?.level, 1) - toNumber(a.pet?.level, 1);
    if (levelDiff !== 0) return levelDiff;

    const hpDiff = toNumber(b.pet?.hp, 0) - toNumber(a.pet?.hp, 0);
    if (hpDiff !== 0) return hpDiff;

    return getPetStableOrder(a.pet, a.index) - getPetStableOrder(b.pet, b.index);
  })
  .map(({ pet }) => pet);

export const resolveRandomBattleTeam = ({
  player,
  today = getTodayString(),
  lockedPetIds = [],
  teamSize = RANDOM_BATTLE_CONFIG.DEFAULT_RANDOM_1V1_TEAM_SIZE,
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

  const matchLevel = selected.length > 0
    ? selected.reduce((sum, pet) => sum + toNumber(pet?.level, 1), 0) / selected.length
    : 0;

  return {
    team: selected,
    petIds: selected.map((pet) => pet.id),
    matchLevel: Math.round(matchLevel * 10) / 10,
    isComplete: selected.length === teamSize,
    missingCount: Math.max(0, teamSize - selected.length),
  };
};

export const applyBattleFatigueToPets = ({
  pets = [],
  petIds = [],
  today = getTodayString(),
  dailyLimit = RANDOM_BATTLE_CONFIG.DAILY_BATTLE_LIMIT,
} = {}) => {
  const targetIds = new Set(petIds.filter(Boolean));

  return pets.map((pet) => {
    if (!pet?.id || !targetIds.has(pet.id)) return pet;

    const currentCount = getDailyBattleCount(pet, today);
    if (currentCount >= dailyLimit) {
      throw new Error(`${pet.name || '이 펫'}은 오늘 충분히 싸워서 쉬어야 해요.`);
    }

    return {
      ...pet,
      dailyBattleCount: currentCount + 1,
      lastBattleDate: today,
    };
  });
};

export const resetPetBattleFatigueByVitaminJelly = ({
  pets = [],
  petId,
  today = getTodayString(),
} = {}) => {
  let changed = false;
  const nextPets = pets.map((pet) => {
    if (pet?.id !== petId) return pet;

    if (!canUseVitaminJellyToday(pet, today)) {
      throw new Error('이 펫은 오늘 이미 비타민젤리를 먹었어요.');
    }

    changed = true;
    return {
      ...pet,
      dailyBattleCount: 0,
      lastBattleDate: today,
      vitaminJellyUsedDate: today,
    };
  });

  if (!changed) throw new Error('비타민젤리를 먹일 펫을 찾을 수 없습니다.');
  return nextPets;
};

export const getRandom1v1LevelBand = (waitMs = 0) => {
  if (waitMs < 30 * 1000) return 2;
  if (waitMs < 60 * 1000) return 5;
  if (waitMs < 90 * 1000) return 7;
  return 99;
};

export const scoreRandom1v1Candidate = ({
  me,
  candidate,
  todayOpponentIds = [],
  recentOpponentCounts = {},
  nowMs = Date.now(),
} = {}) => {
  if (!me || !candidate || me.playerId === candidate.playerId) return Number.POSITIVE_INFINITY;

  const myWaitMs = Math.max(0, nowMs - toNumber(me.queueStartedAtMs, nowMs));
  const levelDiff = Math.abs(toNumber(me.matchLevel, 1) - toNumber(candidate.matchLevel, 1));
  const levelBand = getRandom1v1LevelBand(myWaitMs);
  const alreadyMetToday = todayOpponentIds.includes(candidate.playerId);

  if (alreadyMetToday && myWaitMs < RANDOM_BATTLE_CONFIG.SAME_OPPONENT_RELAX_MS) {
    return Number.POSITIVE_INFINITY;
  }

  const recentRepeatPenalty = toNumber(recentOpponentCounts[candidate.playerId], 0) * 25;
  const todayRepeatPenalty = alreadyMetToday ? 100 : 0;
  const levelPenalty = levelDiff <= levelBand ? levelDiff * 10 : 1000 + levelDiff * 20;
  const waitBonus = Math.min(30, Math.floor(myWaitMs / 1000) * 0.5);

  return levelPenalty + todayRepeatPenalty + recentRepeatPenalty - waitBonus;
};

export const chooseRandom1v1Candidate = ({
  me,
  queueEntries = [],
  todayOpponentIds = [],
  recentOpponentCounts = {},
  nowMs = Date.now(),
} = {}) => queueEntries
  .filter((entry) => entry?.status === 'waiting' && entry.playerId !== me?.playerId)
  .map((candidate) => ({
    candidate,
    score: scoreRandom1v1Candidate({
      me,
      candidate,
      todayOpponentIds,
      recentOpponentCounts,
      nowMs,
    }),
  }))
  .filter(({ score }) => Number.isFinite(score))
  .sort((a, b) => a.score - b.score)[0]?.candidate || null;

const getPairKey = (a, b) => [a, b].filter(Boolean).sort().join('__');

export const scoreTeamSplit = ({
  teamA = [],
  teamB = [],
  sameTeamPairCounts = {},
  opponentPairCounts = {},
  nowMs = Date.now(),
} = {}) => {
  const avg = (members) => members.length
    ? members.reduce((sum, entry) => sum + toNumber(entry.matchLevel ?? entry.petLevel, 1), 0) / members.length
    : 0;

  const teamLevelDiff = Math.abs(avg(teamA) - avg(teamB));
  const sameTeamPenalty = [teamA, teamB].reduce((sum, team) => {
    for (let i = 0; i < team.length; i += 1) {
      for (let j = i + 1; j < team.length; j += 1) {
        sum += toNumber(sameTeamPairCounts[getPairKey(team[i].playerId, team[j].playerId)], 0) * 40;
      }
    }
    return sum;
  }, 0);

  const opponentPenalty = teamA.reduce((sum, a) => sum + teamB.reduce((inner, b) => (
    inner + toNumber(opponentPairCounts[getPairKey(a.playerId, b.playerId)], 0) * 15
  ), 0), 0);

  const oldestWaitMs = Math.max(
    0,
    ...[...teamA, ...teamB].map((entry) => nowMs - toNumber(entry.queueStartedAtMs, nowMs))
  );
  const waitBonus = Math.min(50, Math.floor(oldestWaitMs / 1000) * 0.4);

  return teamLevelDiff * 15 + sameTeamPenalty + opponentPenalty - waitBonus;
};

const combinations = (items, size) => {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
};

export const chooseBalancedTeamSplit = ({
  queueEntries = [],
  teamSize = RANDOM_BATTLE_CONFIG.DEFAULT_TEAM_BATTLE_SIZE,
  sameTeamPairCounts = {},
  opponentPairCounts = {},
  nowMs = Date.now(),
} = {}) => {
  const needed = teamSize * 2;
  const candidates = queueEntries
    .filter((entry) => entry?.status === 'waiting')
    .sort((a, b) => toNumber(a.queueStartedAtMs, nowMs) - toNumber(b.queueStartedAtMs, nowMs))
    .slice(0, Math.max(needed, teamSize * 3));

  if (candidates.length < needed) return null;

  const pool = candidates.slice(0, needed);
  const first = pool[0];
  const rest = pool.slice(1);

  return combinations(rest, teamSize - 1)
    .map((partialTeamA) => {
      const teamA = [first, ...partialTeamA];
      const teamAIds = new Set(teamA.map((entry) => entry.playerId));
      const teamB = pool.filter((entry) => !teamAIds.has(entry.playerId));
      return {
        teamA,
        teamB,
        score: scoreTeamSplit({
          teamA,
          teamB,
          sameTeamPairCounts,
          opponentPairCounts,
          nowMs,
        }),
      };
    })
    .sort((a, b) => a.score - b.score)[0] || null;
};

export const snapshotPetForRandomQueue = (pet) => ({
  id: pet.id,
  name: pet.name,
  species: pet.species || null,
  appearanceId: pet.appearanceId || null,
  element: pet.element || null,
  level: toNumber(pet.level, 1),
  hp: toNumber(pet.hp, 0),
  maxHp: toNumber(pet.maxHp, 0),
  sp: toNumber(pet.sp, 0),
  maxSp: toNumber(pet.maxSp, 0),
  atk: toNumber(pet.atk, 0),
  equippedSkills: Array.isArray(pet.equippedSkills) ? [...pet.equippedSkills] : [],
  skills: Array.isArray(pet.skills) ? [...pet.skills] : [],
});
