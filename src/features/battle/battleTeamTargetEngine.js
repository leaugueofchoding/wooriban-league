// src/features/battle/battleTeamTargetEngine.js
// M18_TEAM_TARGET_ENGINE
//
// 광역기/팀 회복/대기 펫 피해 보호를 위한 순수 유틸 엔진입니다.
// 이 파일은 Firestore나 React state에 직접 접근하지 않습니다.
// 기존 단일 스킬 처리에는 바로 연결하지 않고, M19 이후 스킬별로 단계 적용합니다.

export const TEAM_TARGET_DEFAULTS = Object.freeze({
  activeDamageMultiplier: 1,
  benchDamageMultiplier: 0.4,
  activeHealMultiplier: 1,
  benchHealMultiplier: 0.4,
  preventBenchKo: true,
  includeFaintedOnHeal: false,
});

const clampFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clonePetForTeamEffect = (pet) => {
  if (!pet) return pet;
  return {
    ...pet,
    hp: clampFiniteNumber(pet.hp, 0),
    maxHp: clampFiniteNumber(pet.maxHp, 0),
    sp: clampFiniteNumber(pet.sp, 0),
    maxSp: clampFiniteNumber(pet.maxSp, 0),
    status: { ...(pet.status || {}) },
  };
};

export const getBattleActivePetIndex = (participant) => {
  if (!participant) return 0;

  const activePet = participant.pet || null;
  const team = Array.isArray(participant.team) && participant.team.length > 0
    ? participant.team
    : activePet
      ? [activePet]
      : [];

  if (team.length === 0) return 0;

  const activeId = participant.activePetId || activePet?.id || null;
  if (activeId) {
    const byId = team.findIndex(pet => pet?.id === activeId);
    if (byId >= 0) return byId;
  }

  const fallback = Math.trunc(clampFiniteNumber(participant.activePetIndex, 0));
  return Math.min(Math.max(fallback, 0), team.length - 1);
};

export const normalizeParticipantTeamForTargeting = (participant) => {
  if (!participant) return participant;

  const activePet = clonePetForTeamEffect(participant.pet);
  const rawTeam = Array.isArray(participant.team) && participant.team.length > 0
    ? participant.team
    : activePet
      ? [activePet]
      : [];

  if (rawTeam.length === 0) {
    return {
      ...participant,
      pet: activePet,
      team: [],
      activePetIndex: 0,
      activePetId: activePet?.id || participant.activePetId || null,
    };
  }

  const activeIndex = getBattleActivePetIndex({
    ...participant,
    pet: activePet || participant.pet,
    team: rawTeam,
  });

  const team = rawTeam.map((pet, index) => {
    const sourcePet = index === activeIndex && activePet
      ? activePet
      : pet;

    return clonePetForTeamEffect(sourcePet);
  });

  const nextActivePet = team[activeIndex] || activePet || null;

  return {
    ...participant,
    pet: nextActivePet,
    team,
    activePetIndex: activeIndex,
    activePetId: nextActivePet?.id || participant.activePetId || null,
  };
};

export const getBattleTeamTargets = (participant, options = {}) => {
  const {
    includeActive = true,
    includeBench = true,
    aliveOnly = true,
  } = options;

  const synced = normalizeParticipantTeamForTargeting(participant);
  const team = Array.isArray(synced?.team) ? synced.team : [];
  const activeIndex = getBattleActivePetIndex(synced);

  return team
    .map((pet, index) => ({
      pet,
      index,
      isActive: index === activeIndex,
      isBench: index !== activeIndex,
      hp: clampFiniteNumber(pet?.hp, 0),
      maxHp: clampFiniteNumber(pet?.maxHp, 0),
    }))
    .filter(target => {
      if (!target.pet?.id && !target.pet?.name) return false;
      if (!includeActive && target.isActive) return false;
      if (!includeBench && target.isBench) return false;
      if (aliveOnly && target.hp <= 0) return false;
      return true;
    });
};

export const buildTeamEffectLog = (entries = [], options = {}) => {
  const {
    type = 'damage',
    activeLabel = '출전',
    benchLabel = '대기',
    emptyLog = '',
  } = options;

  const changed = entries.filter(entry => Number(entry.amount ?? 0) > 0);
  if (changed.length === 0) return emptyLog;

  const activeEntries = changed.filter(entry => entry.isActive);
  const benchEntries = changed.filter(entry => entry.isBench);

  const verb = type === 'heal' ? '회복' : '피해';
  const icon = type === 'heal' ? '💚' : '🌪️';

  const parts = [];

  if (activeEntries.length > 0) {
    const names = activeEntries
      .map(entry => `${entry.petName || '펫'} ${entry.amount}`)
      .join(', ');
    parts.push(`${activeLabel} ${names}`);
  }

  if (benchEntries.length > 0) {
    const total = benchEntries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    const names = benchEntries
      .slice(0, 3)
      .map(entry => entry.petName || '팀원')
      .join(', ');
    const moreCount = Math.max(0, benchEntries.length - 3);
    const moreText = moreCount > 0 ? ` 외 ${moreCount}마리` : '';
    parts.push(`${benchLabel} ${names}${moreText} 합계 ${total}`);
  }

  return `${icon} 팀 ${verb}: ${parts.join(' / ')}`;
};

export const applyTeamDamageToParticipant = (participant, rawDamage, options = {}) => {
  const {
    activeMultiplier = TEAM_TARGET_DEFAULTS.activeDamageMultiplier,
    benchMultiplier = TEAM_TARGET_DEFAULTS.benchDamageMultiplier,
    preventBenchKo = TEAM_TARGET_DEFAULTS.preventBenchKo,
    includeActive = true,
    includeBench = true,
    aliveOnly = true,
    logLabel = null,
  } = options;

  const baseDamage = Math.max(0, Math.round(clampFiniteNumber(rawDamage, 0)));
  const synced = normalizeParticipantTeamForTargeting(participant);
  const team = Array.isArray(synced?.team) ? synced.team : [];
  const targets = getBattleTeamTargets(synced, { includeActive, includeBench, aliveOnly });

  const entries = [];
  const nextTeam = team.map((pet, index) => {
    const target = targets.find(item => item.index === index);
    if (!target || baseDamage <= 0) return pet;

    const multiplier = target.isActive ? activeMultiplier : benchMultiplier;
    const requestedDamage = Math.max(0, Math.round(baseDamage * multiplier));
    const currentHp = clampFiniteNumber(pet.hp, 0);

    if (requestedDamage <= 0 || currentHp <= 0) return pet;

    const minHp = target.isBench && preventBenchKo ? 1 : 0;
    const nextHp = Math.max(minHp, currentHp - requestedDamage);
    const appliedDamage = Math.max(0, currentHp - nextHp);

    if (appliedDamage <= 0) return pet;

    entries.push({
      type: 'damage',
      index,
      isActive: target.isActive,
      isBench: target.isBench,
      petId: pet.id || null,
      petName: pet.name || '펫',
      beforeHp: currentHp,
      afterHp: nextHp,
      amount: appliedDamage,
      requestedAmount: requestedDamage,
      preventedKo: target.isBench && preventBenchKo && nextHp === 1 && currentHp - requestedDamage < 1,
    });

    return {
      ...pet,
      hp: nextHp,
      status: { ...(pet.status || {}) },
    };
  });

  const activeIndex = getBattleActivePetIndex(synced);
  const activePet = nextTeam[activeIndex] || synced.pet || null;
  const nextParticipant = {
    ...synced,
    pet: activePet,
    team: nextTeam,
    activePetIndex: activeIndex,
    activePetId: activePet?.id || synced.activePetId || null,
  };

  const totalDamage = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const log = logLabel || buildTeamEffectLog(entries, { type: 'damage' });

  return {
    participant: nextParticipant,
    entries,
    totalDamage,
    log,
  };
};

export const applyTeamHealToParticipant = (participant, rawHeal, options = {}) => {
  const {
    activeMultiplier = TEAM_TARGET_DEFAULTS.activeHealMultiplier,
    benchMultiplier = TEAM_TARGET_DEFAULTS.benchHealMultiplier,
    includeActive = true,
    includeBench = true,
    includeFainted = TEAM_TARGET_DEFAULTS.includeFaintedOnHeal,
    allowOverheal = false,
    logLabel = null,
  } = options;

  const baseHeal = Math.max(0, Math.round(clampFiniteNumber(rawHeal, 0)));
  const synced = normalizeParticipantTeamForTargeting(participant);
  const team = Array.isArray(synced?.team) ? synced.team : [];
  const targets = getBattleTeamTargets(synced, {
    includeActive,
    includeBench,
    aliveOnly: !includeFainted,
  });

  const entries = [];
  const nextTeam = team.map((pet, index) => {
    const target = targets.find(item => item.index === index);
    if (!target || baseHeal <= 0) return pet;

    const multiplier = target.isActive ? activeMultiplier : benchMultiplier;
    const requestedHeal = Math.max(0, Math.round(baseHeal * multiplier));
    const currentHp = clampFiniteNumber(pet.hp, 0);
    const maxHp = clampFiniteNumber(pet.maxHp, 0);

    if (requestedHeal <= 0) return pet;
    if (!includeFainted && currentHp <= 0) return pet;

    const nextHp = allowOverheal
      ? currentHp + requestedHeal
      : maxHp > 0
        ? Math.min(maxHp, currentHp + requestedHeal)
        : currentHp + requestedHeal;

    const appliedHeal = Math.max(0, nextHp - currentHp);
    if (appliedHeal <= 0) return pet;

    entries.push({
      type: 'heal',
      index,
      isActive: target.isActive,
      isBench: target.isBench,
      petId: pet.id || null,
      petName: pet.name || '펫',
      beforeHp: currentHp,
      afterHp: nextHp,
      amount: appliedHeal,
      requestedAmount: requestedHeal,
    });

    return {
      ...pet,
      hp: nextHp,
      status: { ...(pet.status || {}) },
    };
  });

  const activeIndex = getBattleActivePetIndex(synced);
  const activePet = nextTeam[activeIndex] || synced.pet || null;
  const nextParticipant = {
    ...synced,
    pet: activePet,
    team: nextTeam,
    activePetIndex: activeIndex,
    activePetId: activePet?.id || synced.activePetId || null,
  };

  const totalHeal = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const log = logLabel || buildTeamEffectLog(entries, { type: 'heal' });

  return {
    participant: nextParticipant,
    entries,
    totalHeal,
    log,
  };
};

export const summarizeTeamEffectEntries = (entries = []) => ({
  active: entries.filter(entry => entry.isActive),
  bench: entries.filter(entry => entry.isBench),
  totalAmount: entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
  preventedKoCount: entries.filter(entry => entry.preventedKo).length,
});
