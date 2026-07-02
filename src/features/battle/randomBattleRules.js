// src/features/battle/randomBattleRules.js
// 랜덤 1:1 / 팀대전 큐에서 공통으로 쓰는 순수 규칙 헬퍼입니다.

export const RANDOM_BATTLE_CONFIG = Object.freeze({
  RANDOM_DAILY_BATTLE_LIMIT: 2,
  RANDOM_1V1_MIN_PETS: 1,
  RANDOM_1V1_MAX_PETS: 3,
  TEAM_BATTLE_SELECTED_PETS: 1,
  TEAM_BATTLE_BETA_SIZE: 2,
  TEAM_BATTLE_FINAL_SIZE: 3,
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
  return y + '-' + m + '-' + d;
};

export const getRandomBattleCount = (pet, today = getTodayString()) => (
  pet?.randomBattleDate === today ? Math.max(0, num(pet.randomBattleCount, 0)) : 0
);

export const getRandomBattleFatigueLabel = (pet, today = getTodayString()) => {
  const count = Math.min(getRandomBattleCount(pet, today), RANDOM_BATTLE_CONFIG.RANDOM_DAILY_BATTLE_LIMIT);
  return '오늘 랜덤대전: ' + count + '/' + RANDOM_BATTLE_CONFIG.RANDOM_DAILY_BATTLE_LIMIT;
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

export const canPetRandomBattleToday = (pet, today = getTodayString()) => (
  getRandomBattleCount(pet, today) < RANDOM_BATTLE_CONFIG.RANDOM_DAILY_BATTLE_LIMIT
);

export const canUseRandomBattleVitaminJellyToday = (pet, today = getTodayString()) => (
  Boolean(pet?.id) && pet.randomBattleVitaminJellyUsedDate !== today
);

export const isPetEligibleForRandomBattle = ({ pet, today = getTodayString(), lockedPetIds = [] } = {}) => (
  Boolean(pet?.id) &&
  isPetAlive(pet) &&
  canPetRandomBattleToday(pet, today) &&
  !isPetBattleLocked(pet, lockedPetIds)
);

export const sortRecommendedRandomBattlePets = (pets = [], today = getTodayString(), lockedPetIds = []) => pets
  .map((pet, index) => ({ pet, index }))
  .filter(({ pet }) => isPetEligibleForRandomBattle({ pet, today, lockedPetIds }))
  .sort((a, b) => (
    num(b.pet.level, 1) - num(a.pet.level, 1) ||
    num(b.pet.hp, 0) - num(a.pet.hp, 0) ||
    a.index - b.index
  ))
  .map(({ pet }) => pet);

export const getAveragePetLevel = (pets = []) => {
  const validPets = pets.filter(Boolean);
  if (!validPets.length) return 0;
  const average = validPets.reduce((sum, pet) => sum + num(pet.level, 1), 0) / validPets.length;
  return Math.round(average * 10) / 10;
};

export const resolveRandom1v1Team = ({
  player,
  selectedPetIds = [],
  today = getTodayString(),
  lockedPetIds = [],
} = {}) => {
  const pets = Array.isArray(player?.pets) ? player.pets : [];
  const petById = new Map(pets.map((pet) => [pet?.id, pet]).filter(([id]) => Boolean(id)));
  const selected = [];
  const selectedIds = new Set();

  selectedPetIds
    .filter(Boolean)
    .slice(0, RANDOM_BATTLE_CONFIG.RANDOM_1V1_MAX_PETS)
    .forEach((petId) => {
      if (selectedIds.has(petId)) return;
      const pet = petById.get(petId);
      if (isPetEligibleForRandomBattle({ pet, today, lockedPetIds })) {
        selected.push(pet);
        selectedIds.add(petId);
      }
    });

  if (!selected.length) {
    sortRecommendedRandomBattlePets(pets, today, lockedPetIds)
      .slice(0, RANDOM_BATTLE_CONFIG.RANDOM_1V1_MAX_PETS)
      .forEach((pet) => {
        selected.push(pet);
        selectedIds.add(pet.id);
      });
  }

  const selectedPetCount = selected.length;

  return {
    team: selected,
    petIds: selected.map((pet) => pet.id),
    selectedPetCount,
    matchLevel: getAveragePetLevel(selected),
    isComplete: selectedPetCount >= RANDOM_BATTLE_CONFIG.RANDOM_1V1_MIN_PETS,
    recommendedPetIds: sortRecommendedRandomBattlePets(pets, today, lockedPetIds)
      .slice(0, RANDOM_BATTLE_CONFIG.RANDOM_1V1_MAX_PETS)
      .map((pet) => pet.id),
  };
};

export const resolveRandomTeamBattlePet = ({
  player,
  selectedPetId,
  today = getTodayString(),
  lockedPetIds = [],
} = {}) => {
  const pets = Array.isArray(player?.pets) ? player.pets : [];
  const petById = new Map(pets.map((pet) => [pet?.id, pet]).filter(([id]) => Boolean(id)));
  const selectedPet = selectedPetId ? petById.get(selectedPetId) : null;
  const fallbackPet = sortRecommendedRandomBattlePets(pets, today, lockedPetIds)[0] || null;
  const pet = isPetEligibleForRandomBattle({ pet: selectedPet, today, lockedPetIds })
    ? selectedPet
    : fallbackPet;

  return {
    pet,
    petId: pet?.id || null,
    petLevel: pet ? num(pet.level, 1) : 0,
    isComplete: Boolean(pet),
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

export const applyRandomBattleFatigueToPets = ({ pets = [], petIds = [], today = getTodayString() } = {}) => {
  const targets = new Set(petIds.filter(Boolean));
  return pets.map((pet) => {
    if (!pet?.id || !targets.has(pet.id)) return pet;
    const count = getRandomBattleCount(pet, today);
    if (count >= RANDOM_BATTLE_CONFIG.RANDOM_DAILY_BATTLE_LIMIT) {
      throw new Error((pet.name || '이 펫') + '은 오늘 랜덤대전을 모두 사용했어요.');
    }
    return { ...pet, randomBattleCount: count + 1, randomBattleDate: today };
  });
};

export const resetRandomBattleFatigueByVitaminJelly = ({ pets = [], petId, today = getTodayString() } = {}) => {
  let found = false;
  const nextPets = pets.map((pet) => {
    if (pet?.id !== petId) return pet;
    if (!canUseRandomBattleVitaminJellyToday(pet, today)) {
      throw new Error('이 펫은 오늘 이미 비타민젤리를 먹었어요.');
    }
    found = true;
    return {
      ...pet,
      randomBattleCount: 0,
      randomBattleDate: today,
      randomBattleVitaminJellyUsedDate: today,
    };
  });
  if (!found) throw new Error('비타민젤리를 먹일 펫을 찾을 수 없습니다.');
  return nextPets;
};

const getLevelBand = (waitMs) => {
  if (waitMs < 30 * 1000) return 2;
  if (waitMs < 60 * 1000) return 5;
  if (waitMs < 90 * 1000) return 7;
  return 99;
};

const getPetCountDiffPenalty = (diff, waitMs) => {
  if (diff <= 0) return 0;
  if (diff === 1) return waitMs < 30 * 1000 ? 45 : 25;
  return waitMs < 60 * 1000 ? 90 : 55;
};

export const scoreRandom1v1Candidate = ({
  me,
  candidate,
  todayOpponentIds = [],
  recentOpponentCounts = {},
  nowMs = Date.now(),
} = {}) => {
  if (!me || !candidate || me.playerId === candidate.playerId) return Number.POSITIVE_INFINITY;

  const waitMs = Math.max(0, nowMs - num(me.queueStartedAtMs, nowMs));
  const levelDiff = Math.abs(num(me.matchLevel, 1) - num(candidate.matchLevel, 1));
  const petCountDiff = Math.abs(num(me.selectedPetCount, 1) - num(candidate.selectedPetCount, 1));
  const metToday = todayOpponentIds.includes(candidate.playerId);

  if (metToday && waitMs < RANDOM_BATTLE_CONFIG.SAME_OPPONENT_RELAX_MS) {
    return Number.POSITIVE_INFINITY;
  }

  const levelPenalty = levelDiff <= getLevelBand(waitMs)
    ? levelDiff * 10
    : 1000 + levelDiff * 20;
  const petCountPenalty = getPetCountDiffPenalty(petCountDiff, waitMs);
  const todayPenalty = metToday ? 100 : 0;
  const recentPenalty = num(recentOpponentCounts[candidate.playerId], 0) * 25;
  const waitBonus = Math.min(30, Math.floor(waitMs / 1000) * 0.5);

  return levelPenalty + petCountPenalty + todayPenalty + recentPenalty - waitBonus;
};

export const chooseRandom1v1Candidate = ({
  me,
  queueEntries = [],
  todayOpponentIds = [],
  recentOpponentCounts = {},
  nowMs = Date.now(),
} = {}) => queueEntries
  .filter((entry) => entry?.status === 'waiting' && entry.mode === 'random-1v1' && entry.playerId !== me?.playerId)
  .map((candidate) => ({
    candidate,
    score: scoreRandom1v1Candidate({ me, candidate, todayOpponentIds, recentOpponentCounts, nowMs }),
  }))
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

export const scoreTeamSplit = ({
  teamA = [],
  teamB = [],
  sameTeamPairCounts = {},
  opponentPairCounts = {},
  nowMs = Date.now(),
} = {}) => {
  const avg = (team) => team.length
    ? team.reduce((sum, entry) => sum + num(entry.petLevel ?? entry.matchLevel, 1), 0) / team.length
    : 0;

  let sameTeamPenalty = 0;
  [teamA, teamB].forEach((team) => {
    for (let i = 0; i < team.length; i += 1) {
      for (let j = i + 1; j < team.length; j += 1) {
        sameTeamPenalty += num(sameTeamPairCounts[pairKey(team[i].playerId, team[j].playerId)], 0) * 40;
      }
    }
  });

  const opponentPenalty = teamA.reduce((sum, a) => (
    sum + teamB.reduce((inner, b) => (
      inner + num(opponentPairCounts[pairKey(a.playerId, b.playerId)], 0) * 15
    ), 0)
  ), 0);

  const oldestWaitMs = Math.max(0, ...[...teamA, ...teamB].map((entry) => nowMs - num(entry.queueStartedAtMs, nowMs)));

  return Math.abs(avg(teamA) - avg(teamB)) * 15 +
    sameTeamPenalty +
    opponentPenalty -
    Math.min(50, Math.floor(oldestWaitMs / 1000) * 0.4);
};

export const chooseBalancedTeamSplit = ({
  queueEntries = [],
  teamSize = RANDOM_BATTLE_CONFIG.TEAM_BATTLE_BETA_SIZE,
  sameTeamPairCounts = {},
  opponentPairCounts = {},
  nowMs = Date.now(),
} = {}) => {
  const needed = teamSize * 2;
  const pool = queueEntries
    .filter((entry) => entry?.status === 'waiting' && entry.mode === 'random-team')
    .sort((a, b) => num(a.queueStartedAtMs, nowMs) - num(b.queueStartedAtMs, nowMs))
    .slice(0, needed);

  if (pool.length < needed) return null;

  const [first, ...rest] = pool;
  return combinations(rest, teamSize - 1)
    .map((partialA) => {
      const teamA = [first, ...partialA];
      const ids = new Set(teamA.map((entry) => entry.playerId));
      const teamB = pool.filter((entry) => !ids.has(entry.playerId));
      return {
        teamA,
        teamB,
        score: scoreTeamSplit({ teamA, teamB, sameTeamPairCounts, opponentPairCounts, nowMs }),
      };
    })
    .sort((a, b) => a.score - b.score)[0] || null;
};
