// src/features/pet/iceBearPatch.js
// ICE_BEAR_PATCH_V1
// 신규 얼음곰 펫 라인과 전용 스킬을 런타임에 주입합니다.
// 큰 petData.js를 직접 갈아엎지 않고, 앱 시작 시 PET_SPECIES / ELEMENTS / SKILLS / PET_DATA 객체를 확장합니다.

import {
  PET_SPECIES,
  ELEMENTS,
  PET_BATTLE_ROLES,
  PREVIEW_STATUS,
  SKILLS,
  PET_DATA,
  clearWaveMarks,
} from './petData';
import { getElementTracesFromPet } from '../battle/elementReactionEngine';

const ICE_BEAR_SPECIES = 'ice_bear';
const ICE_ELEMENT = '얼음';
const WATER_TRACE_KEY = 'water';
const WARM_SNOW_BREATH_HP_COST_RATIO = 0.2;
const WARM_SNOW_BREATH_SP_RECOVERY_RATIO = 0.2;
const WINTER_SLEEP_HEAL_RATIO = 0.45;
const ABSOLUTE_ZERO_WATER_TRACE_MULTIPLIER = 2.2;

PET_SPECIES.ICE_BEAR = ICE_BEAR_SPECIES;
ELEMENTS.ICE = ICE_ELEMENT;

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const ensureStatus = (pet) => {
  if (!pet.status) pet.status = {};
  return pet.status;
};

const checkBlindMiss = (attacker) => {
  const status = ensureStatus(attacker);
  if (!status.blind) return false;

  status.blind = false;
  return Math.random() < 0.5;
};

const calculateIceBearDamage = (
  basePower,
  attackerPlayer,
  defenderPlayer,
  skillMult = 1,
  atkMult = 0.45
) => {
  const attacker = attackerPlayer.pet;
  const defender = defenderPlayer.pet;

  let damage = (basePower * skillMult) + (toNumber(attacker.atk) * atkMult);
  let multiplier = 1;
  let isCritical = false;

  const critChance = attackerPlayer.equippedTitle === 'ruler_of_the_league' ? 0.15 : 0.10;
  if (Math.random() < critChance) {
    multiplier *= 1.5;
    isCritical = true;
  }

  if (attacker.status?.focusCharge) multiplier *= 2;
  if (attacker.status?.aching) multiplier *= 0.7;
  if (defender.status?.defenseUp) multiplier *= 0.7;
  if (defender.status?.aching) multiplier *= 1.3;
  if (attackerPlayer.equippedTitle === 'goal_machine') multiplier *= 1.05;
  if (defenderPlayer.equippedTitle === 'icon_of_diligence') multiplier *= 0.95;
  if (defenderPlayer.equippedTitle === 'star_of_compliments') multiplier *= 0.97;

  return {
    damage: damage * multiplier,
    isCritical,
  };
};

const applyDefenderActionToDamage = (damage, log, defenderPlayer, defenderAction) => {
  const defender = defenderPlayer.pet;
  ensureStatus(defender);

  switch (defenderAction) {
    case 'BRACE':
      return {
        damage: damage * 0.7,
        log: `${log} (상대는 웅크려 피해를 줄였다!)`,
      };

    case 'EVADE': {
      const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
      if (Math.random() < evadeChance) {
        return {
          damage: 0,
          log: `${log} (상대방이 날렵하게 회피했다!)`,
        };
      }
      return {
        damage: damage * 1.5,
        log: `${log} (회피 실패! 치명적인 피해!)`,
      };
    }

    case 'FOCUS': {
      defender.status.focusCharge = 1;
      if (defenderPlayer.equippedTitle === 'idea_bank') {
        const spGain = Math.floor(toNumber(defender.maxSp) * 0.2);
        defender.sp = Math.min(toNumber(defender.maxSp), toNumber(defender.sp) + spGain);
        return {
          damage,
          log: `${log} (💡 [아이디어 뱅크] 기를 모으며 SP를 ${spGain} 회복했다!)`,
        };
      }
      return {
        damage,
        log: `${log} (상대는 다음 공격을 위해 집중하며 기를 모았다!)`,
      };
    }

    case 'FLEE_FAILED':
      return { damage, log: `${log} (도망에 실패해 무방비하다!)` };
    case 'STUNNED':
      return { damage, log: `${log} (상대는 기절 상태라 방어하지 못했다!)` };
    case 'FROZEN':
      return { damage, log: `${log} (상대는 얼어붙어 방어하지 못했다!)` };
    case 'BOUND':
      return { damage, log: `${log} (상대는 속박 상태라 방어하지 못했다!)` };
    default:
      return { damage, log };
  }
};

const applyBenchSpRecovery = (participant, ratio) => {
  const activePet = participant.pet || null;
  const rawTeam = Array.isArray(participant.team) && participant.team.length > 0
    ? participant.team
    : activePet
      ? [activePet]
      : [];

  if (!activePet || rawTeam.length <= 1) {
    return { recoveredTotal: 0, recoveredNames: [] };
  }

  const activePetId = participant.activePetId || activePet.id || null;
  const activeIndexById = activePetId
    ? rawTeam.findIndex(pet => pet?.id === activePetId)
    : -1;
  const activeIndex = activeIndexById >= 0
    ? activeIndexById
    : Math.min(Math.max(toNumber(participant.activePetIndex), 0), rawTeam.length - 1);

  const recoveredNames = [];
  let recoveredTotal = 0;

  const nextTeam = rawTeam.map((pet, index) => {
    if (!pet) return pet;

    const sourcePet = index === activeIndex ? activePet : pet;
    const currentSp = toNumber(sourcePet.sp);
    const maxSp = toNumber(sourcePet.maxSp);

    if (index === activeIndex || maxSp <= 0 || toNumber(sourcePet.hp) <= 0) {
      return {
        ...sourcePet,
        status: { ...(sourcePet.status || {}) },
      };
    }

    const amount = Math.max(1, Math.round(maxSp * ratio));
    const nextSp = Math.min(maxSp, currentSp + amount);
    const recovered = Math.max(0, nextSp - currentSp);

    if (recovered <= 0) {
      return {
        ...sourcePet,
        status: { ...(sourcePet.status || {}) },
      };
    }

    recoveredTotal += recovered;
    recoveredNames.push(sourcePet.name || '대기 펫');

    return {
      ...sourcePet,
      sp: nextSp,
      status: {
        ...(sourcePet.status || {}),
        spPulse: true,
        spPulseKind: 'warmSnowBreath',
        spPulseTurns: 1,
      },
    };
  });

  participant.team = nextTeam;
  participant.activePetIndex = activeIndex;
  participant.activePetId = nextTeam[activeIndex]?.id || activePet.id || null;
  participant.pet = nextTeam[activeIndex] || activePet;

  return { recoveredTotal, recoveredNames };
};

PREVIEW_STATUS.SNOWBALL_THROW = {
  target: [
    {
      kind: 'ice',
      icon: '❄️',
      label: '얼음 흔적',
      detail: '얼음 피해 · 물 흔적과 만나면 빙결 반응',
      tone: '#4dabf7',
    },
  ],
};

PREVIEW_STATUS.WARM_SNOW_BREATH = {
  caster: [
    {
      kind: 'support',
      icon: '🌨️',
      label: '대기 SP 회복',
      detail: '자기 HP 소모 · 대기 팀원 SP 회복',
      tone: '#74c0fc',
    },
  ],
};

PREVIEW_STATUS.WINTER_SLEEP = {
  caster: [
    {
      kind: 'heal',
      icon: '💤',
      label: '겨울잠',
      detail: '전투당 1회 · HP 대량 회복',
      tone: '#91a7ff',
    },
  ],
};

PREVIEW_STATUS.ABSOLUTE_ZERO = {
  target: [
    {
      kind: 'ice',
      icon: '🧊',
      label: '절대영도',
      detail: '물 흔적이 있으면 피해 극대화 + 빙결 반응',
      tone: '#228be6',
    },
  ],
};

SKILLS.SNOWBALL_THROW = {
  id: 'snowball_throw',
  name: '눈송이 던지기',
  cost: 18,
  type: 'signature',
  element: ICE_ELEMENT,
  basePower: 22,
  description: '차가운 눈송이를 던져 적에게 얼음 피해를 줍니다. 원소반응이 켜져 있으면 얼음 흔적을 남기거나 물 흔적과 만나 빙결을 일으킵니다.',
  previewStatus: PREVIEW_STATUS.SNOWBALL_THROW,
  effect: (attackerPlayer, defenderPlayer, defenderAction) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;
    ensureStatus(attacker);
    ensureStatus(defender);

    if (checkBlindMiss(attacker)) {
      return `'${attacker.name}'의 눈송이 던지기! ...하지만 눈송이가 빗나갔습니다! 💨`;
    }

    let { damage, isCritical } = calculateIceBearDamage(
      SKILLS.SNOWBALL_THROW.basePower,
      attackerPlayer,
      defenderPlayer,
      0.95,
      0.35
    );

    let log = `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 눈송이 던지기! ❄️`;
    const defended = applyDefenderActionToDamage(damage, log, defenderPlayer, defenderAction);
    damage = Math.round(defended.damage);
    log = defended.log;

    if (damage > 0) {
      defender.hp = Math.max(0, toNumber(defender.hp) - damage);
      log += ` ${damage}의 피해!`;
    } else {
      log += ` 피해를 주지 못했습니다!`;
    }

    return log;
  },
};

SKILLS.WARM_SNOW_BREATH = {
  id: 'warm_snow_breath',
  name: '포근한 눈숨결',
  cost: 0,
  type: 'signature',
  element: null,
  basePower: 0,
  description: '자신의 최대 HP 20%를 소모해 대기 중인 생존 아군 펫들의 SP를 각자 최대 SP의 20%만큼 회복합니다. 자기 자신은 SP 회복 대상에서 제외됩니다.',
  previewStatus: PREVIEW_STATUS.WARM_SNOW_BREATH,
  effect: (attackerPlayer) => {
    const attacker = attackerPlayer.pet;
    ensureStatus(attacker);

    const maxHp = toNumber(attacker.maxHp);
    const currentHp = toNumber(attacker.hp);
    const hpCost = Math.max(1, Math.round(maxHp * WARM_SNOW_BREATH_HP_COST_RATIO));
    const nextHp = Math.max(1, currentHp - hpCost);
    const paidHp = Math.max(0, currentHp - nextHp);

    attacker.hp = nextHp;

    const spResult = applyBenchSpRecovery(attackerPlayer, WARM_SNOW_BREATH_SP_RECOVERY_RATIO);
    if (attackerPlayer.pet) {
      Object.assign(attacker, attackerPlayer.pet);
    }

    const shownNames = spResult.recoveredNames.slice(0, 2).join(', ');
    const moreCount = Math.max(0, spResult.recoveredNames.length - 2);
    const moreText = moreCount > 0 ? ` 외 ${moreCount}마리` : '';

    let log = `'${attacker.name}'의 포근한 눈숨결! 🌨️ 자신의 체력 ${paidHp}을 나누어`;
    if (spResult.recoveredTotal > 0) {
      log += ` 대기 펫 ${shownNames}${moreText}의 SP를 합계 ${spResult.recoveredTotal} 회복시켰습니다!`;
    } else {
      log += ` 친구들을 감쌌지만 회복할 SP가 없었습니다.`;
    }

    return log;
  },
};

SKILLS.WINTER_SLEEP = {
  id: 'winter_sleep',
  name: '겨울잠',
  cost: 0,
  type: 'signature',
  element: null,
  basePower: 0,
  description: '전투 중 한 번만 사용할 수 있습니다. 포근한 눈더미 속에서 잠시 겨울잠을 자 자신의 최대 HP 45%를 회복합니다.',
  previewStatus: PREVIEW_STATUS.WINTER_SLEEP,
  effect: (attackerPlayer) => {
    const attacker = attackerPlayer.pet;
    const status = ensureStatus(attacker);

    if (status.winterSleepUsed) {
      return `'${attacker.name}'은(는) 이미 이번 전투에서 겨울잠을 잤습니다!`;
    }

    const maxHp = toNumber(attacker.maxHp);
    const currentHp = toNumber(attacker.hp);
    const healAmount = Math.max(1, Math.round(maxHp * WINTER_SLEEP_HEAL_RATIO));
    const nextHp = Math.min(maxHp, currentHp + healAmount);
    const healed = Math.max(0, nextHp - currentHp);

    attacker.hp = nextHp;
    status.winterSleepUsed = true;
    status.healPulse = true;
    status.healPulseKind = 'winterSleep';
    status.healPulseTurns = 1;

    return `💤 '${attacker.name}'의 겨울잠! 포근한 눈더미 속에서 잠시 잠들어 체력을 ${healed} 회복했습니다!`;
  },
};

SKILLS.ABSOLUTE_ZERO = {
  id: 'absolute_zero',
  name: '절대영도',
  cost: 65,
  type: 'signature',
  element: ICE_ELEMENT,
  basePower: 40,
  description: '극한의 냉기로 적을 얼립니다. 상대에게 물 흔적이 있으면 피해가 크게 증가하며, 물+얼음 반응으로 빙결까지 노릴 수 있습니다.',
  previewStatus: PREVIEW_STATUS.ABSOLUTE_ZERO,
  effect: (attackerPlayer, defenderPlayer, defenderAction) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;
    ensureStatus(attacker);
    ensureStatus(defender);

    if (checkBlindMiss(attacker)) {
      return `'${attacker.name}'의 절대영도! ...하지만 냉기가 흩어졌습니다! 💨`;
    }

    const traces = getElementTracesFromPet(defender) || {};
    const hasWaterTrace = toNumber(traces[WATER_TRACE_KEY]) > 0;

    let { damage, isCritical } = calculateIceBearDamage(
      SKILLS.ABSOLUTE_ZERO.basePower,
      attackerPlayer,
      defenderPlayer,
      1,
      0.35
    );

    let log = `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 절대영도! 🧊`;

    if (hasWaterTrace) {
      damage *= ABSOLUTE_ZERO_WATER_TRACE_MULTIPLIER;
      log += ` 물 기운이 순식간에 얼어붙어 위력이 폭발했습니다! (피해 x${ABSOLUTE_ZERO_WATER_TRACE_MULTIPLIER.toFixed(1)})`;
    } else {
      log += ` 주변 온도가 한순간에 떨어졌습니다.`;
    }

    const defended = applyDefenderActionToDamage(damage, log, defenderPlayer, defenderAction);
    damage = Math.round(defended.damage);
    log = defended.log;

    if (damage > 0) {
      defender.hp = Math.max(0, toNumber(defender.hp) - damage);
      log += ` ${damage}의 피해!`;
    } else {
      log += ` 피해를 주지 못했습니다!`;
    }

    if (hasWaterTrace && damage > 0) {
      // 실제 빙결 CC와 물 흔적 소모는 BattlePage의 원소반응 후처리가 담당합니다.
      // 여기서는 딜링기 정체성을 위해 피해만 증폭합니다.
    }

    return log;
  },
};

PET_DATA[ICE_BEAR_SPECIES] = {
  name: '눈곰이',
  element: ICE_ELEMENT,
  compatibleElements: [ICE_ELEMENT],
  battleRole: PET_BATTLE_ROLES.CONTROL_SUPPORT,
  battleRoleLabel: '빙결·동면 서포터',
  battleRoleTags: ['얼음', '회복', '대기 SP'],
  battleRoleNote: '자신의 체력을 활용해 대기 팀원의 SP를 보조하고, 겨울잠으로 버티며, 물 흔적이 쌓인 상대에게 절대영도로 강한 빙결 딜을 넣는 탱커형 서포터입니다.',
  description: '눈이 소복이 쌓인 운동장 구석에서 태어난 아기 얼음곰 눈곰이입니다. 느긋하지만 친구를 지킬 때는 차가운 눈송이를 던집니다. (❄️얼음 속성)',
  baseStats: { maxHp: 115, maxSp: 60, atk: 8 },
  growth: { hp: 22, sp: 8, atk: 3 },
  skill: SKILLS.SNOWBALL_THROW,
  initialSkills: [SKILLS.SNOWBALL_THROW.id],
  evolution: {
    lv10: {
      appearanceId: 'ice_bear_lv2',
      name: '설곰이',
      statBoost: { hp: 1.45, sp: 1.35, atk: 1.25 },
      newSkills: [SKILLS.WARM_SNOW_BREATH, SKILLS.WINTER_SLEEP],
      description: '눈더미처럼 포근한 몸집으로 친구들을 감싸는 설곰이입니다. 자신의 체력을 나누어 대기 중인 팀원의 SP를 북돋고, 위기에는 겨울잠으로 크게 회복합니다. (❄️얼음 속성)',
    },
    lv20: {
      appearanceId: 'ice_bear_lv3',
      name: '영하곰',
      statBoost: { hp: 2.15, sp: 1.75, atk: 1.55 },
      newSkill: SKILLS.ABSOLUTE_ZERO,
      description: '거대한 눈산처럼 느긋하게 서 있는 얼음곰의 최종 진화체 영하곰입니다. 물 기운을 품은 상대를 절대영도로 얼려 전장의 흐름을 멈춥니다. (❄️얼음 속성)',
    },
  },
};
