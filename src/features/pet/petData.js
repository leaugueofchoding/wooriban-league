// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
    ELECTRIC_MONKEY: 'monkey',
    FOX: 'fox',
    FROG: 'frog',
    MANTA: 'manta',
};

export const ELEMENTS = {
    FIRE: '불',
    WIND: '바람',
    GRASS: '풀',
    WATER: '물',
    ELECTRIC: '번개',
    EARTH: '흙'
};

// M7_PET_ROLE_SEPARATION
// 펫별 전투 정체성을 데이터로 고정합니다.
// 현재는 표시/기획 메타데이터이며, 실제 전투 수치에는 직접 관여하지 않습니다.
export const PET_BATTLE_ROLES = {
    DAMAGE_DEALER: 'damage_dealer',
    TRACE_SUPPORT: 'trace_support',
    CONTROL_DAMAGE: 'control_damage',
    HEAL_SUPPORT: 'heal_support',
    DISRUPTION_SUPPORT: 'disruption_support',
    REACTION_TRIGGER: 'reaction_trigger',
    CONTROL_SUPPORT: 'control_support',
};

// M9_REMOVE_LEGACY_TYPE_CHART
// 기존 불/물/풀/바람/번개/흙 단순 상성 배율은 삭제합니다.
// 앞으로 강한 결과는 원소 흔적/원소반응에서 발생합니다.
const calculateDamage = (basePower, attackerPlayer, defenderPlayer, _skillElement = null, skillMult = 1.0, atkMult = 0.7) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;

    let damage = (basePower * skillMult) + (attacker.atk * atkMult);
    let multiplier = 1.0;
    let isEffective = false;
    let isCritical = false;

    const critChance = (attackerPlayer.equippedTitle === 'ruler_of_the_league') ? 0.15 : 0.10;
    if (Math.random() < critChance) {
        multiplier *= 1.5;
        isCritical = true;
    }

    if (attacker.status?.focusCharge) multiplier *= 2.0;

    // 💢 욱신욱신: 공격력 30% 감소
    if (attacker.status?.aching) multiplier *= 0.7;

    if (defender.status?.defenseUp) multiplier *= 0.7;

    // 💢 욱신욱신: 방어력 30% 감소 = 받는 피해 30% 증가
    if (defender.status?.aching) multiplier *= 1.3;
    if (attackerPlayer.equippedTitle === 'goal_machine') multiplier *= 1.05;
    if (defenderPlayer.equippedTitle === 'icon_of_diligence') multiplier *= 0.95;
    if (defenderPlayer.equippedTitle === 'star_of_compliments') multiplier *= 0.97;

    return { damage: damage * multiplier, isEffective, isCritical };
};

const checkBlindMiss = (attacker) => {
    if (attacker.status?.blind) {
        attacker.status.blind = false;
        if (Math.random() < 0.5) return true;
    }
    return false;
};


const markHealPulse = (pet, kind = 'heal') => {
    if (!pet) return;
    if (!pet.status) pet.status = {};
    pet.status.healPulse = true;
    pet.status.healPulseKind = kind;
    pet.status.healPulseTurns = 1;
};
// M6_SOLO_DAMAGE_CC_NERF
// 단독 스킬 폭딜/하드 CC를 1차 약화하고, 강한 결과는 원소반응 쪽으로 이동할 준비를 합니다.
// M8_MANTA_SUPPORT_ROLE
// 가오리 계열은 한 방 폭딜보다 물결표식/물 흔적을 쌓는 서포터 역할로 정리합니다.
const WAVE_MARK_MAX = 3;
const WAVE_MARK_STUN_COUNTS = [3];
const ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK = [1.0, 1.25, 2.2, 3.8];

const getWaveMarkCount = (targetPet) => {
    const rawCount = Number(targetPet?.status?.waveMark ?? 0);
    if (!Number.isFinite(rawCount)) return 0;
    return Math.max(0, Math.min(WAVE_MARK_MAX, Math.floor(rawCount)));
};

const setWaveMarkCount = (targetPet, count) => {
    if (!targetPet.status) targetPet.status = {};

    const nextCount = Math.max(0, Math.min(WAVE_MARK_MAX, Math.floor(Number(count) || 0)));

    if (nextCount <= 0) {
        delete targetPet.status.waveMark;
        delete targetPet.status.waveMarkMax;
        return 0;
    }

    targetPet.status.waveMark = nextCount;
    targetPet.status.waveMarkMax = WAVE_MARK_MAX;
    return nextCount;
};

const addWaveMark = (targetPet) => {
    const beforeMark = getWaveMarkCount(targetPet);
    const afterMark = setWaveMarkCount(targetPet, beforeMark + 1);
    const stunTriggered = beforeMark !== afterMark && WAVE_MARK_STUN_COUNTS.includes(afterMark);

    return {
        beforeMark,
        afterMark,
        isMax: afterMark >= WAVE_MARK_MAX,
        stunTriggered,
    };
};

export const clearWaveMarks = (targetPet) => {
    const markCount = getWaveMarkCount(targetPet);
    setWaveMarkCount(targetPet, 0);
    return markCount;
};

const getAraBloomDamageMultiplier = (markCount) => {
    const safeMarkCount = Math.max(0, Math.min(WAVE_MARK_MAX, Math.floor(Number(markCount) || 0)));
    return ARA_BLOOM_DAMAGE_MULTIPLIER_BY_MARK[safeMarkCount] || 1.0;
};
export const PREVIEW_STATUS = {
    DEFENSE_UP: {
        caster: [
            {
                kind: 'buff',
                icon: '🛡️',
                label: '방어 상승',
                detail: '받는 피해 감소',
                tone: '#845ef7',
            },
        ],
    },

    SOLAR_BLIND: {
        target: [
            {
                kind: 'blind',
                icon: '☀️',
                label: '눈부심',
                detail: '25% 확률 · 다음 공격 빗나감',
                tone: '#f59f00',
            },
        ],
    },

    ACHING: {
        target: [
            {
                kind: 'aching',
                icon: '💢',
                label: '욱신욱신',
                detail: '2턴간 공격/방어 30% 감소',
                tone: '#e03131',
            },
        ],
    },

    HEAL: {
        caster: [
            {
                kind: 'heal',
                icon: '💖',
                label: '회복',
                detail: '체력 회복',
                tone: '#e64980',
            },
        ],
    },

    FOCUS: {
        caster: [
            {
                kind: 'focus',
                icon: '⚡',
                label: '기 모으기',
                detail: '다음 공격 강화',
                tone: '#f08c00',
            },
        ],
    },

    TAUNT: {
        target: [
            {
                kind: 'blind',
                icon: '😤',
                label: '도발',
                detail: '다음 공격 50% 확률로 빗나감',
                tone: '#868e96',
            },
        ],
    },

    ENERGY_SIPHON: {
        target: [
            {
                kind: 'drain',
                icon: '🌀',
                label: 'SP 흡수',
                detail: '상대 SP 감소',
                tone: '#9c36b5',
            },
        ],
        caster: [
            {
                kind: 'drain',
                icon: '✨',
                label: 'SP 회복',
                detail: '자신 SP 회복',
                tone: '#9c36b5',
            },
        ],
    },

    SAND_THROW: {
        target: [
            {
                kind: 'blind',
                icon: '🙈',
                label: '실명',
                detail: '70% 확률 · 다음 공격 50% 빗나감',
                tone: '#868e96',
            },
        ],
    },

    POISON_STING: {
        target: [
            {
                kind: 'poison',
                icon: '☠️',
                label: '중독',
                detail: '40% 확률 · 3턴 도트 피해',
                tone: '#37b24d',
            },
        ],
    },

    STATIC_SHOCK: {
        target: [
            {
                kind: 'stun',
                icon: '💫',
                label: '기절',
                detail: '15% 확률 · 1턴 행동 불가',
                tone: '#f08c00',
            },
        ],
    },

    RECHARGE: {
        caster: [
            {
                kind: 'recharge',
                icon: '💨',
                label: '반동',
                detail: '다음 턴 숨 고르기',
                tone: '#ff6b35',
            },
        ],
    },

    STELLAR_BURN: {
        target: [
            {
                kind: 'burn',
                icon: '🔥',
                label: '화상',
                detail: '30% 확률 · 매 턴 피해',
                tone: '#f03e3e',
            },
        ],
    },

    QUICK_DISTURBANCE: {
        target: [
            {
                kind: 'stun',
                icon: '💫',
                label: '혼란',
                detail: '45% 확률 · 1턴 행동 불가',
                tone: '#339af0',
            },
        ],
    },

    TORNADO_STUN: {
        target: [
            {
                kind: 'stun',
                icon: '💫',
                label: '기절',
                detail: '30% 확률 · 1턴 행동 불가',
                tone: '#339af0',
            },
        ],
    },

    LEECH_SEED: {
        target: [
            {
                kind: 'drain',
                icon: '🌱',
                label: '흡수',
                detail: '피해 후 체력 회복',
                tone: '#2f9e44',
            },
        ],
        caster: [
            {
                kind: 'heal',
                icon: '💚',
                label: '체력 흡수',
                detail: '준 피해 일부 회복',
                tone: '#2f9e44',
            },
        ],
    },

    SHOCK_SCRATCH: {
        target: [
            {
                kind: 'stun',
                icon: '⚡',
                label: '마비',
                detail: '15% 확률 · 1턴 행동 불가',
                tone: '#f08c00',
            },
        ],
    },

    THUNDERSTORM_STUN: {
        target: [
            {
                kind: 'stun',
                icon: '⛈️',
                label: '기절',
                detail: '25% 확률 · 1턴 행동 불가',
                tone: '#f08c00',
            },
        ],
    },

    REM_FIRE: {
        target: [
            {
                kind: 'burn',
                icon: '🔥',
                label: '잔불 점화',
                detail: '22% 확률 · 추가 피해 + 화상 도트',
                tone: '#f03e3e',
            },
        ],
    },

    COUNTER_STANCE: {
        caster: [
            {
                kind: 'counter',
                icon: '⚔️',
                label: '반격 준비',
                detail: '다음 공격 일부 반사',
                tone: '#f08c00',
            },
        ],
    },

    REED_BOW: {
        target: [
            {
                kind: 'bound',
                icon: '🌿',
                label: '속박',
                detail: '1턴간 방어/도망 봉쇄',
                tone: '#2f9e44',
            },
        ],
    },
    WAVE_MARK: {
        target: [
            {
                kind: 'waveMark',
                icon: '💧',
                label: '물결표식',
                detail: '최대 3개 · 3개 도달 시 기절',
                tone: '#4dabf7',
            },
        ],
    },

    BLOSSOM_CURRENT: {
        caster: [
            {
                kind: 'heal',
                icon: '🌸',
                label: '표식 회복',
                detail: '표식 +1 · 체력 회복',
                tone: '#f783ac',
            },
        ],
        target: [
            {
                kind: 'waveMark',
                icon: '💧',
                label: '물결표식 참조',
                detail: '표식 +1 · 유지',
                tone: '#4dabf7',
            },
        ],
    },

    ARA_BLOOM: {
        target: [
            {
                kind: 'waveMark',
                icon: '🌊',
                label: '표식 폭발',
                detail: '표식 수에 비례해 피해 증가',
                tone: '#228be6',
            },
        ],
    },
};

export const SKILLS = {
    TACKLE: {
        id: 'tackle',
        name: '몸통박치기',
        cost: 0,
        type: 'basic',
        element: null,
        basePower: 20,
        description: '가장 기본적인 몸통박치기로 적에게 물리적인 피해를 줍니다. 상대에게 물결표식이 있으면 아군 누구의 기본공격도 표식 수에 따라 조금 강해집니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 빗나갔습니다! 💨`;

            let { damage, isCritical } = calculateDamage(SKILLS.TACKLE.basePower, attackerPlayer, defenderPlayer, SKILLS.TACKLE.element);
            let log = `'${attacker.name}'의 몸통박치기!`;
            if (isCritical) log = `💥 [치명타!] ` + log;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력한 한방!`;

            switch (defenderAction) {
                case 'BRACE':
                    damage *= 0.7;
                    log += ` (상대는 웅크려 피해를 줄였다!)`;
                    break;
                case 'EVADE': {
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
                    if (Math.random() < evadeChance) {
                        damage = 0;
                        log += ` (상대방이 날렵하게 회피했다!)`;
                    } else {
                        damage *= 1.5;
                        log += ` (회피 실패! 치명적인 피해!)`;
                    }
                    break;
                }
                case 'FOCUS':
                    defender.status.focusCharge = 1;
                    if (defenderPlayer.equippedTitle === 'idea_bank') {
                        const spGain = Math.floor(defender.maxSp * 0.2);
                        defender.sp = Math.min(defender.maxSp, defender.sp + spGain);
                        log += ` (💡 [아이디어 뱅크] 기를 모으며 SP를 ${spGain} 회복했다!)`;
                    } else {
                        log += ` (상대는 다음 공격을 위해 집중하며 기를 모았다!)`;
                    }
                    break;
                case 'FLEE_FAILED':
                    log += ` (도망에 실패해 무방비하다!)`;
                    break;
                case 'STUNNED':
                    log += ` (상대는 혼란 상태라 방어하지 못했다!)`;
                    break;
                case 'BOUND':
                    log += ` (상대는 속박 상태라 방어하지 못했다!)`;
                    break;
                default:
                    break;
            }

            const waveMarkCount = getWaveMarkCount(defender);
            const waveMarkBasicMultipliers = [1, 1.2, 1.45, 1.75];
            const safeWaveMarkCount = Math.min(3, Math.max(0, waveMarkCount));
            const waveMarkBasicMultiplier = waveMarkBasicMultipliers[safeWaveMarkCount] ?? 1;

            if (damage > 0 && waveMarkBasicMultiplier > 1) {
                damage *= waveMarkBasicMultiplier;
                log += ` 🌊 물결표식 ${safeWaveMarkCount}개의 물살이 약점을 드러냈다! 기본공격이 강해졌다!`;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${damage}의 피해!`;
            }

            return log;
        },
    },

    HARDEN: {
        id: 'harden',
        name: '단단해지기',
        cost: 15,
        type: 'common',
        element: null,
        description: '2턴간 자신의 방어력을 높여 받는 피해를 30% 줄입니다.',
        basePower: 0,
        previewStatus: PREVIEW_STATUS.DEFENSE_UP,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            attacker.status.defenseUpTurns = 2;
            return `'${attacker.name}'의 피부가 단단해졌습니다! 🛡️ (2턴간 방어력 강화)`;
        },
    },

    HEALING_PRAYER: {
        id: 'healing_prayer',
        name: '회복의 기도',
        cost: 35,
        type: 'common',
        element: null,
        description: '따뜻한 빛의 기운으로 자신의 최대 체력의 30%를 즉시 회복합니다.',
        basePower: 0,
        previewStatus: PREVIEW_STATUS.HEAL,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                        // MANTA_HEAL_AND_ARA_SUPPORT_PATCH_V6: 회복의 기도 사용 시 실제 회복량이 0이어도 회복 카드/테두리를 1턴 표시
            if (!attacker.status) attacker.status = {};
            attacker.status.recentHeal = true;
            attacker.status.recentHealTurns = 1;
            attacker.status.recentHealKind = 'healingPrayer';

return `'${attacker.name}'이(가) 체력을 ${healAmount} 회복했습니다! ✨`;
        },
    },

    TAUNT: {
        id: 'taunt',
        name: '도발',
        cost: 15,
        type: 'common',
        element: null,
        description: '우람한 소리를 내어 상대를 흥분시킵니다. 다음 공격이 50% 확률로 빗나갑니다.',
        basePower: 0,
        previewStatus: PREVIEW_STATUS.TAUNT,
        effect: (attackerPlayer, defenderPlayer) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            defender.status.blind = true;
            return `'${attacker.name}'의 도발! ${defender.name}은(는) 흥분해서 앞이 잘 보이지 않습니다! 🙈`;
        },
    },

    MIND_FOCUS: {
        id: 'mind_focus',
        name: '정신집중',
        cost: 15,
        type: 'common',
        element: null,
        description: '기를 모아 다음 턴의 모든 공격(기본기 및 스킬 포함) 데미지를 2배로 강화합니다.',
        basePower: 0,
        previewStatus: PREVIEW_STATUS.FOCUS,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            if (!attacker.status) attacker.status = {};
            attacker.status.focusCharge = 1;
            return `'${attacker.name}'이(가) 정신을 집중합니다! 다음 턴 모든 공격이 2배로 강해집니다! ⚡️`;
        }
    },

    SHIELD_BASH: {
        id: 'shield_bash',
        name: '방패치기',
        cost: 20,
        type: 'common',
        element: null,
        description: '방어력을 2턴간 높임과 동시에 상대를 가볍게 밀쳐내어 피해를 줍니다.',
        basePower: 15,
        previewStatus: PREVIEW_STATUS.DEFENSE_UP,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            attacker.status.defenseUpTurns = 2;

            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null, 1.0, 0.5);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            return `'${attacker.name}'의 방패치기! 단단한 방어 태세를 갖추며 적에게 ${damage}의 피해를 주었습니다! 🛡️`;
        }
    },

    ENERGY_SIPHON: {
        id: 'energy_siphon',
        name: '에너지 사이펀',
        cost: 20,
        type: 'common',
        element: null,
        description: '적에게 약간의 피해를 입히고, 상대 최대 SP의 20%를 흡수하여 내 SP를 채웁니다.',
        basePower: 10,
        previewStatus: PREVIEW_STATUS.ENERGY_SIPHON,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage } = calculateDamage(10, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);

            const spDrain = Math.floor(defender.maxSp * 0.2);
            defender.sp = Math.max(0, defender.sp - spDrain);
            attacker.sp = Math.min(attacker.maxSp, attacker.sp + spDrain);

            return `'${attacker.name}'의 에너지 사이펀! 적에게 ${damage}의 피해를 입히고 마력을 빨아들였습니다! (상대 SP -${spDrain} / 자신 SP +${spDrain}) 🌀`;
        }
    },

    SAND_THROW: {
        id: 'sand_throw',
        name: '모래 뿌리기',
        cost: 10,
        type: 'common',
        element: null,
        description: '약한 피해를 주고, 70% 확률로 흙먼지를 일으켜 상대를 다음 공격이 50% 빗나가는 실명 상태로 만듭니다.',
        basePower: 15,
        previewStatus: PREVIEW_STATUS.SAND_THROW,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!defender.status) defender.status = {};

            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `'${attacker.name}'의 모래 뿌리기! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.7) {
                defender.status.blind = true;
                log += ` 🙈 모래가 눈에 들어가 상대의 시야가 가려졌습니다! 다음 공격이 50% 확률로 빗나갑니다!`;
            } else {
                log += ` 하지만 상대가 가까스로 눈을 피했습니다.`;
            }

            return log;
        }
    },

    POISON_STING: {
        id: 'poison_sting',
        name: '독침',
        cost: 15,
        type: 'common',
        element: null,
        description: '40% 확률로 상대를 중독시켜 3턴간 매 턴 최대 체력의 6%씩 도트 피해를 줍니다.',
        basePower: 10,
        previewStatus: PREVIEW_STATUS.POISON_STING,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage } = calculateDamage(10, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            let log = `'${attacker.name}'의 독침! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.4) {
                if (!defender.status) defender.status = {};
                defender.status.poisoned = true;
                defender.status.poisonTurns = 3;
                log += ` ☠️ 독이 퍼져 상대가 중독 상태가 되었습니다! (3턴간 도트 피해)`;
            }

            return log;
        }
    },

    STATIC_SHOCK: {
        id: 'static_shock',
        name: '정전기 방출',
        cost: 15,
        type: 'common',
        element: null,
        description: '약한 전기 충격을 주며, 15% 확률로 적을 1턴간 행동 불가 상태로 만듭니다.',
        basePower: 15,
        previewStatus: PREVIEW_STATUS.STATIC_SHOCK,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            let log = `'${attacker.name}'의 정전기 방출! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.15) {
                if (!defender.status) defender.status = {};
                defender.status.stunned = true;
                log += ` 💫 약한 전류에 감전되어 상대가 기절했습니다!`;
            }

            return log;
        }
    },

    FIERY_BREATH: {
        id: 'fiery_breath',
        name: '용의 숨결',
        cost: 40,
        type: 'signature',
        element: '불',
        basePower: 55,
        description: '맹렬한 화염을 뿜어 강한 피해를 주지만, 반동으로 다음 턴 지침 상태가 됩니다.',
        previewStatus: PREVIEW_STATUS.RECHARGE,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            // DRAGON_BREATH_MID_BUFF_V1
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 뿜었습니다! 💨`;

            const dragonBreathLevel = Number(attacker.level ?? 1);

            // Lv.1 구간 폭증을 막고, Lv.30 전후에서는 반동 스킬답게 체감 화력을 올립니다.
            // Lv.1: scale 1.00
            // Lv.30: scale 약 1.21, 상한 1.22
            const dragonBreathLevelScale = Math.min(
                1.22,
                1 + Math.max(0, dragonBreathLevel - 1) * 0.0075
            );

            let { damage, isEffective, isCritical: breathCrit } = calculateDamage(
                SKILLS.FIERY_BREATH.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.FIERY_BREATH.element,
                1.45 * dragonBreathLevelScale,
                0.85 * dragonBreathLevelScale
            );

            let log = `'${attacker.name}'의 용의 숨결! 🔥`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;

            switch (defenderAction) {
                case 'BRACE':
                    damage *= 0.7;
                    break;
                case 'EVADE':
                    if (Math.random() < 0.3) damage = 0;
                    break;
                default:
                    break;
            }

            damage = Math.round(damage);
            if (breathCrit) log = `💥 [치명타!] ` + log;
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${damage}의 피해!`;
            }

            attacker.status.recharging = true;
            return log;
        },
    },

    DRAGON_CLAW: {
        id: 'dragon_claw',
        name: '용의 발톱',
        cost: 25,
        type: 'signature',
        element: '불',
        basePower: 35,
        description: '불꽃을 두른 예리한 발톱으로 할퀴어 상대의 방어를 일부 무시합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: clawCrit } = calculateDamage(35, attackerPlayer, defenderPlayer, '불', 2.25, 1.25);
            if (defenderAction === 'BRACE') damage *= 0.60;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${clawCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 용의 발톱! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 피해!`;
        }
    },

    STELLAR_BLAST: {
        id: 'stellar_blast',
        name: '스텔라 블라스트',
        cost: 65,
        type: 'signature',
        element: '불',
        basePower: 60,
        description: '초고열의 항성 에너지를 폭발시킵니다. 30% 확률로 상대를 매 턴 최대 체력의 8%씩 화상 도트 피해 상태로 만듭니다.',
        previewStatus: PREVIEW_STATUS.STELLAR_BURN,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: stelCrit } = calculateDamage(60, attackerPlayer, defenderPlayer, '불', 5.4, 1.05);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${stelCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 스텔라 블라스트! 🌟 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 엄청난 피해!`;

            if (Math.random() < 0.22) {
                if (!defender.status) defender.status = {};
                defender.status.burned = true;
                log += ` 🔥 폭발의 열기로 상대가 화상을 입었습니다! (매 턴 최대 HP의 8% 도트)`;
            }

            return log;
        }
    },

    QUICK_DISTURBANCE: {
        id: 'quick_disturbance',
        name: '재빠른 교란',
        cost: 18,
        type: 'signature',
        element: '바람',
        basePower: 20,
        description: '눈에 보이지 않는 빠른 속도로 맴돌아 상대를 45% 확률로 1턴 혼란시킵니다.',
        previewStatus: PREVIEW_STATUS.QUICK_DISTURBANCE,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};

            let { damage, isEffective, isCritical: qdCrit } = calculateDamage(
                SKILLS.QUICK_DISTURBANCE.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.QUICK_DISTURBANCE.element,
                0.95,
                0.5
            );

            if (defenderAction === 'BRACE') damage *= 0.7;

            let log = `'${attacker.name}'의 재빠른 교란! 💨`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (Math.random() < 0.45) {
                defender.status.stunned = true;
                log += ` 💫 상대가 혼란에 빠졌다!`;
            }

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            if (qdCrit) log = `💥 [치명타!] ` + log;
            log += ` ${damage}의 피해!`;

            return log;
        },
    },

    WIND_BLADE: {
        id: 'wind_blade',
        name: '바람의 칼날',
        cost: 28,
        type: 'signature',
        element: '바람',
        basePower: 30,
        description: '날카롭게 압축된 바람을 날립니다. 30% 확률로 치명타가 터져 피해가 1.5배가 됩니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: wbCrit } = calculateDamage(30, attackerPlayer, defenderPlayer, '바람', 2.8, 0.55);

            let log = `'${attacker.name}'의 바람의 칼날! 🌪️`;
            if (Math.random() < 0.22) {
                damage *= 1.5;
                log += ` 💥 [급소 강타!]`;
            }

            if (wbCrit) log = `💥 [치명타!] ` + log;
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${log} ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 예리한 피해!`;
        }
    },

    TORNADO_SWEEP: {
        id: 'tornado_sweep',
        name: '토네이도 휩쓸기',
        cost: 70,
        type: 'signature',
        element: '바람',
        basePower: 60,
        description: '거대한 회오리바람을 일으켜 전장을 휩씁니다. 30% 확률로 적을 1턴 스턴시킵니다.',
        previewStatus: PREVIEW_STATUS.TORNADO_STUN,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: tornadoCrit } = calculateDamage(60, attackerPlayer, defenderPlayer, '바람', 4.0, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${tornadoCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 토네이도 휩쓸기! 🌪️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 광역 피해!`;

            if (Math.random() < 0.30) {
                if (!defender.status) defender.status = {};
                defender.status.stunned = true;
                log += ` 💫 강풍에 휩쓸려 상대가 기절했습니다!`;
            }

            return log;
        }
    },

    LEECH_SEED: {
        id: 'leech_seed',
        name: '씨뿌리기',
        cost: 20,
        type: 'signature',
        element: '풀',
        basePower: 30,
        description: '상대의 몸에 씨앗을 뿌려 준 피해의 60%만큼 자신의 체력을 회복합니다.',
        previewStatus: PREVIEW_STATUS.LEECH_SEED,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: seedCrit } = calculateDamage(
                SKILLS.LEECH_SEED.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.LEECH_SEED.element,
                1.35,
                0.5
            );

            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            const heal = Math.round(damage * 0.5);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);

            // M1_LEECH_SEED_HEAL_PULSE_PATCH
            // 회복 스킬 사용 자체가 피드백 대상입니다.
            // 풀피라 실제 HP 증가량이 0이어도 회복 카드/테두리를 1턴 표시합니다.
            markHealPulse(attacker, 'seed');

            return `${seedCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 씨뿌리기! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}적에게 ${damage}의 피해를 주고 ${heal}만큼 체력을 흡수했다! 🌱`;
        },
    },

    VINE_WHIP: {
        id: 'vine_whip',
        name: '덩굴 채찍',
        cost: 28,
        type: 'signature',
        element: '풀',
        basePower: 35,
        description: '질기고 억센 덩굴을 휘둘러 상대에게 강력한 찰과상을 입힙니다. 2턴간 상대를 욱신욱신 상태로 만들어 공격력과 방어력을 30% 낮춥니다.',
        previewStatus: PREVIEW_STATUS.ACHING,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!defender.status) defender.status = {};

            let { damage, isEffective, isCritical: vineCrit } = calculateDamage(35, attackerPlayer, defenderPlayer, '풀', 2.65, 0.5);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            defender.status.aching = true;
            defender.status.achingTurns = 1;

            return `${vineCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 덩굴 채찍! 🌿 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 찰진 피해! 💢 상대의 몸이 욱신욱신합니다! (1턴간 공격/방어 30% 감소)`;
        }
    },

    SOLAR_BEAM: {
        id: 'solar_beam',
        name: '솔라 빔',
        cost: 65,
        type: 'signature',
        element: '풀',
        basePower: 75,
        description: '태양의 에너지를 압축하여 강한 빛의 광선을 발사합니다. 25% 확률로 상대를 눈부심 상태로 만들어 다음 공격을 반드시 빗나가게 합니다.',
        previewStatus: PREVIEW_STATUS.SOLAR_BLIND,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!defender.status) defender.status = {};

            let { damage, isEffective, isCritical: solarCrit } = calculateDamage(75, attackerPlayer, defenderPlayer, '풀', 4.7, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${solarCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 솔라 빔! ☀️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 엄청난 빛의 일격!`;

            if (Math.random() < 0.25) {
                defender.status.dazzled = true;
                log += ` ☀️ 강렬한 빛에 눈이 부셔 다음 공격이 반드시 빗나갑니다!`;
            }

            return log;
        }
    },

    SHOCK_SCRATCH: {
        id: 'shock_scratch',
        name: '따끔할퀴기',
        cost: 10,
        type: 'signature',
        element: '번개',
        basePower: 25,
        description: '번개를 두른 손톱으로 할큅니다. 15% 확률로 상대를 1턴 스턴시킵니다.',
        previewStatus: PREVIEW_STATUS.SHOCK_SCRATCH,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};

            let { damage, isCritical } = calculateDamage(25, attackerPlayer, defenderPlayer, '번개', 1.15, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.15) defender.status.stunned = true;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 따끔할퀴기! ${damage}의 피해! ${defender.status?.stunned ? '💫 마비되었다!' : ''}`;
        }
    },

    THUNDER_PUNCH: {
        id: 'thunder_punch',
        name: '찌릿펀치',
        cost: 30,
        type: 'signature',
        element: '번개',
        basePower: 40,
        description: '주먹에 고압 전류를 모아 묵직한 번개 타격을 날립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isCritical: punchCrit } = calculateDamage(40, attackerPlayer, defenderPlayer, '번개', 3.0, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${punchCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 찌릿펀치! ⚡ ${damage}의 피해!`;
        }
    },

    THUNDERSTORM: {
        id: 'thunderstorm',
        name: '뇌우',
        cost: 70,
        type: 'signature',
        element: '번개',
        basePower: 65,
        description: '천둥구름을 불러내 거대한 번개를 내리칩니다. 25% 확률로 1턴 기절시킵니다.',
        previewStatus: PREVIEW_STATUS.THUNDERSTORM_STUN,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};

            let { damage, isCritical: stormCrit } = calculateDamage(65, attackerPlayer, defenderPlayer, '번개', 4.0, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.25) defender.status.stunned = true;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${stormCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 뇌우! ⚡🌩️ ${damage}의 피해! ${defender.status?.stunned ? '💫 기절했습니다!' : ''}`;
        }
    },

    REM_FIRE: {
        id: 'rem_fire',
        name: '잔불',
        cost: 15,
        type: 'signature',
        element: '불',
        basePower: 20,
        description: '22% 확률로 상대 최대 체력의 4% 즉발 추가 피해 + 화상 도트(최대 HP 8%/턴) 상태로 만듭니다.',
        previewStatus: PREVIEW_STATUS.REM_FIRE,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 잔불! ...불씨가 흐려져 꺼졌습니다! 💨`;

            let { damage, isCritical: remCrit } = calculateDamage(
                SKILLS.REM_FIRE.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.REM_FIRE.element,
                1.0,
                0.5
            );

            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${remCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 잔불 습격! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.22) {
                const burnDamage = Math.round(defender.maxHp * 0.04);
                defender.hp = Math.max(0, defender.hp - burnDamage);
                defender.status.burned = true;
                log += ` 💥 [잔불 점화!] 추가 ${burnDamage}의 화상 피해 + 화상 도트 상태!`;
            }

            return log;
        }
    },

    FLAME_DASH: {
        id: 'flame_dash',
        name: '불꽃 질주',
        cost: 25,
        type: 'signature',
        element: '불',
        basePower: 45,
        description: '불비비가 재빨리 달려들어 상대를 제압합니다. 상대의 회피와 방어를 완전히 무시합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 불꽃 질주! ...타이밍을 놓쳤습니다! 💨`;

            let { damage, isCritical: dashCrit } = calculateDamage(SKILLS.FLAME_DASH.basePower, attackerPlayer, defenderPlayer, '불', 2.25, 0.55);

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${dashCrit ? '💥 [치명타!] ' : ''}🔥 '${attacker.name}'의 불꽃 질주! 적에게 ${damage}의 피해!`;
            if (defenderAction === 'BRACE' || defenderAction === 'EVADE') {
                log += ` (상대의 방어 및 회피 전술을 완벽히 무시하고 직격했습니다!)`;
            }

            return log;
        }
    },

    UPHWA: {
        id: 'uphwa',
        name: '업화',
        cost: 70,
        type: 'signature',
        element: '불',
        basePower: 65,
        description: '체력 20% 이하 시 위력 2배 + 치명타 70% 확률. 화상 상태 적에게 추가 1.35배 피해를 주고 화상을 소거합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 업화! ...불꽃이 흩어졌습니다! 💨`;

            let { damage, isEffective, isCritical: uphwaCrit } = calculateDamage(SKILLS.UPHWA.basePower, attackerPlayer, defenderPlayer, SKILLS.UPHWA.element, 4.0, 0.55);
            let log = `${uphwaCrit ? '💥 [치명타!] ' : ''}🌋 '${attacker.name}'의 업화! 궁지에서 더욱 거세게 타오른다!`;

            if (attacker.hp <= attacker.maxHp * 0.2) {
                damage *= 1.6;
                if (Math.random() < 0.45) {
                    damage *= 1.5;
                    log = `💥 [역전의 치명타 폭발!!] ` + log;
                }
            }

            if (defenderAction === 'BRACE') damage *= 0.7;

            if (defender.status?.burned) {
                damage *= 1.2;
                log += ` (🔥 적의 몸에 깃든 잔불이 업화와 공명하여 폭발합니다!)`;
                defender.status.burned = false;
            }

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);
            log += ` 적에게 ${damage}의 파괴적인 피해! ${isEffective ? '🎯 [효과가 굉장했다!]' : ''}`;

            return log;
        }
    },

    WATER_BALL: {
        id: 'water_ball',
        name: '물공 던지기',
        cost: 15,
        type: 'signature',
        element: '물',
        basePower: 25,
        description: '응축된 물의 기운을 둥글게 뭉쳐 적에게 던져 물 속성 피해를 줍니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical } = calculateDamage(25, attackerPlayer, defenderPlayer, '물', 1.25, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 물공 던지기! 💧 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 피해!`;
        }
    },

    COUNTER_STANCE: {
        id: 'counter_stance',
        name: '반격태세',
        cost: 25,
        type: 'signature',
        element: '물',
        basePower: 30,
        description: '부들을 휘둘러 피해를 주고, 다음 턴 상대방 공격의 30%를 되돌려주는 반격 자세를 취합니다.',
        previewStatus: PREVIEW_STATUS.COUNTER_STANCE,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};

            let { damage, isCritical } = calculateDamage(30, attackerPlayer, defenderPlayer, '물', 1.45, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            attacker.status.counterReady = 0.25;

            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 반격태세! 적에게 ${damage}의 피해를 주고 ⚔️ 매서운 눈빛으로 적을 노려봅니다! (반격 준비)`;
        }
    },

    ULTIMATE_SECRET: {
        id: 'ultimate_secret',
        name: '오의필살',
        cost: 90,
        type: 'signature',
        element: null,
        basePower: 70,
        description: '갓을 깊게 눌러쓰고 눈에 보이지 않는 속도로 적의 사각을 베어 가릅니다. 묵직한 검기가 전장을 갈라버리는 무속성의 치명적인 일격입니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            let { damage, isCritical } = calculateDamage(70, attackerPlayer, defenderPlayer, null, 6.5, 0.7);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${isCritical ? '💥 [오의 폭발!!] ' : ''}'${attacker.name}'의 오의필살! ⚔️✨ 전장을 가르는 섬광이 적을 꿰뚫어 ${damage}의 엄청난 피해를 입혔습니다!`;
        }
    },

    REED_BOW: {
        id: 'reed_bow',
        name: '부들화살',
        cost: 35,
        type: 'signature',
        element: '물',
        basePower: 15,
        description: '부들 화살을 쏴 약간의 피해를 주고, 상대를 1턴간 속박하여 방어 행동과 도망치기를 봉쇄합니다.',
        previewStatus: PREVIEW_STATUS.REED_BOW,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};

            let { damage, isCritical } = calculateDamage(15, attackerPlayer, defenderPlayer, '물', 0.9, 0.45);
            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            defender.status.bound = true;
            defender.status.boundTurns = 1;

            return `${isCritical ? '💥 [급소 강타!] ' : ''}'${attacker.name}'의 부들활! 🏹 ${damage}의 피해! 질긴 덩굴이 상대를 꽁꽁 묶어버렸습니다! (1턴간 방어/도망 불가)`;
        }
    }
,
    WAVE_MARK: {
        id: 'wave_mark',
        name: '물방울 낙인',
        cost: 8,
        type: 'signature',
        element: '물',
        basePower: 8,
        description: '작은 물방울을 따라붙게 해 아주 약한 물속성 피해를 주고 물결표식을 1개 남깁니다. 이 공격은 회피할 수 없으며, 표식이 3개가 되는 순간 상대를 1턴 기절시킵니다. 물결표식은 최대 3개까지 쌓입니다.',
        previewStatus: PREVIEW_STATUS.WAVE_MARK,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 물방울 낙인! ...하지만 물방울이 엉뚱한 곳에서 터졌습니다! 💨`;
            }

            let { damage, isEffective, isCritical } = calculateDamage(
                SKILLS.WAVE_MARK.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.WAVE_MARK.element,
                0.55,
                0.18
            );

            let log = `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 물방울 낙인! 💧`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;

            if (defenderAction === 'BRACE') {
                damage *= 0.7;
                log += ` (상대는 웅크려 피해를 줄였다!)`;
            } else if (defenderAction === 'EVADE') {
                log += ` (물방울이 상대의 회피를 따라붙었다!)`;
            }

            damage = Math.max(1, Math.round(damage));
            defender.hp = Math.max(0, defender.hp - damage);

            const markResult = addWaveMark(defender);

            log += ` ${damage}의 피해! 물결표식이 새겨졌습니다. (${markResult.afterMark}/${WAVE_MARK_MAX})`;

            if (markResult.stunTriggered) {
                defender.status.stunned = true;
                defender.status.stunnedTurns = 1;
                log += ` 💫 물결표식이 3개까지 차오르며 물결이 발목을 묶었습니다! 상대는 1턴간 행동할 수 없습니다!`;
            } else if (markResult.isMax) {
                log += ` 🌊 물결표식이 최대치입니다!`;
            }

            return log;
        }
    },

    BLOSSOM_CURRENT: {
        id: 'blossom_current',
        name: '벚꽃해류',
        cost: 30,
        type: 'signature',
        element: '물',
        basePower: 24,
        description: '벚꽃잎이 섞인 해류로 상대를 감싸 약한 피해를 주고 물결표식을 1개 남깁니다. 현재는 표식 수 1개당 자신의 최대 HP 5%를 회복합니다. 팀 전체 지속 회복은 별도 단계에서 다룹니다.',
        previewStatus: PREVIEW_STATUS.BLOSSOM_CURRENT,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 벚꽃해류! ...하지만 해류가 흩어졌습니다! 💨`;
            }

            let { damage, isEffective, isCritical } = calculateDamage(
                SKILLS.BLOSSOM_CURRENT.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.BLOSSOM_CURRENT.element,
                0.95,
                0.35
            );

            if (defenderAction === 'BRACE') damage *= 0.7;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            const markResult = addWaveMark(defender);
            const markCount = markResult.afterMark;
            const heal = markCount > 0
                ? Math.max(1, Math.round(Number(attacker.maxHp ?? 0) * 0.05 * markCount))
                : 0;

            if (heal > 0) {
                attacker.hp = Math.min(attacker.maxHp, Number(attacker.hp ?? 0) + heal);

                // M1_BLOSSOM_CURRENT_HEAL_PULSE_PATCH
                // 벚꽃해류도 풀피에서 사용하면 실제 회복량은 0일 수 있지만,
                // 사용 피드백과 회복 계열 카드/테두리는 보여야 합니다.
                markHealPulse(attacker, 'blossom');
            }

            if (markResult.stunTriggered) {
                defender.status.stunned = true;
                defender.status.stunnedTurns = 1;
            }

            let log = `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 벚꽃해류! 🌸🌊`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            log += ` ${damage}의 피해! 물결표식이 하나 더 새겨졌습니다. (${markCount}/${WAVE_MARK_MAX})`;
            log += ` 표식의 물살을 타고 ${heal}의 체력을 회복했습니다!`;

            if (markResult.stunTriggered) {
                log += ` 💫 물결표식이 3개까지 차오르며 상대는 1턴간 행동할 수 없습니다!`;
            } else if (markResult.isMax) {
                log += ` 🌊 물결표식이 최대치입니다!`;
            }

            return log;
        }
    },

    ARA_BLOOM: {
        id: 'ara_bloom',
        name: '아라만개',
        cost: 65,
        type: 'signature',
        element: '물',
        basePower: 36,
        description: '바다 깊은 곳의 꽃물살을 만개시켜 표식을 회수합니다. 상대의 물결표식이 1/2/3개일 때 피해가 각각 1.25배/2.2배/3.8배로 증가하며, 명중하면 표식은 모두 사라집니다.',
        previewStatus: PREVIEW_STATUS.ARA_BLOOM,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet;
            const defender = defenderPlayer.pet;

            if (!attacker.status) attacker.status = {};
            if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 아라만개! ...하지만 꽃물살의 방향을 놓쳤습니다! 💨`;
            }

            const markCount = getWaveMarkCount(defender);
            const markMultiplier = getAraBloomDamageMultiplier(markCount);

            let { damage, isEffective, isCritical } = calculateDamage(
                SKILLS.ARA_BLOOM.basePower,
                attackerPlayer,
                defenderPlayer,
                SKILLS.ARA_BLOOM.element,
                0.95,
                0.30
            );

            let log = `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 아라만개! 🌸🌊`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;

            if (defenderAction === 'EVADE' && Math.random() < 0.3) {
                log += ` 상대가 꽃물살의 중심을 가까스로 피했습니다! 피해는 없고 물결표식은 유지됩니다. (${markCount}/${WAVE_MARK_MAX})`;
                return log;
            }

            if (markCount > 0) {
                damage *= markMultiplier;
                log += ` 물결표식 ${markCount}개가 꽃물살로 만개합니다! (피해 x${markMultiplier.toFixed(1)})`;
            } else {
                log += ` 표식 없이 사용되어 위력이 온전히 피어나지 못했습니다.`;
            }

            if (defenderAction === 'BRACE') {
                damage *= 0.7;
                log += ` (상대는 웅크려 피해를 줄였다!)`;
            }

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            if (markCount > 0) {
                clearWaveMarks(defender);
                log += ` ${damage}의 피해! 꽃물살이 표식을 모두 회수했습니다.`;
            } else {
                log += ` ${damage}의 피해!`;
            }

            return log;
        }
    }
};

export const PET_DATA = {
    ['dragon']: {
        name: '스타룡',
        element: '불',
        compatibleElements: ['불'],
        battleRole: PET_BATTLE_ROLES.DAMAGE_DEALER,
        battleRoleLabel: '불 단독 딜러',
        battleRoleTags: ['불', '폭딜', '마무리'],
        battleRoleNote: '높은 단독 피해와 마무리 능력을 담당합니다. 흔적/CC 지원보다 순수 화력 정체성을 유지합니다.',
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다. 아직은 작지만 뜨거운 불씨를 품고 있습니다. (🔥불 속성)",
        baseStats: { maxHp: 100, maxSp: 50, atk: 15 },
        growth: { hp: 20, sp: 5, atk: 5 },
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id],
        evolution: {
            lv10: {
                appearanceId: 'dragon_lv2',
                name: '은하룡',
                statBoost: { hp: 1.5, sp: 1.3, atk: 1.5 },
                newSkill: SKILLS.DRAGON_CLAW,
                description: "별빛의 은하 마력을 다듬어 한층 더 강력한 화염을 내뿜는 은하룡입니다. (🔥불 속성)"
            },
            lv20: {
                appearanceId: 'dragon_lv3',
                name: '스텔라곤',
                statBoost: { hp: 2.2, sp: 1.6, atk: 2.2 },
                newSkill: SKILLS.STELLAR_BLAST,
                description: "우주의 모든 항성 에너지를 지배하는 위엄 넘치는 고대 용의 황제 스텔라곤입니다. (🔥불 속성)"
            },
        }
    },

    ['rabbit']: {
        name: '버니니',
        element: '바람',
        compatibleElements: ['바람'],
        battleRole: PET_BATTLE_ROLES.DISRUPTION_SUPPORT,
        battleRoleLabel: '확산·교란 서포터',
        battleRoleTags: ['바람', '교란', '확산'],
        battleRoleNote: '직접 폭딜보다 상대 행동을 흔들고, 이후 풀+바람/감전확산 같은 반응을 돕는 역할입니다.',
        description: "장난기 많은 바람의 정령들이 뭉쳐 태어난 버니니입니다. 눈에 보이지 않을 만큼 빠릅니다. (💨바람 속성)",
        baseStats: { maxHp: 90, maxSp: 60, atk: 10 },
        growth: { hp: 15, sp: 8, atk: 4 },
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE.id],
        evolution: {
            lv10: {
                appearanceId: 'rabbit_lv2',
                name: '버닉스',
                statBoost: { hp: 1.4, sp: 1.6, atk: 1.4 },
                newSkill: SKILLS.WIND_BLADE,
                description: "압축된 바람을 날카로운 칼날처럼 자유자재로 다루는 날렵한 투사 버닉스입니다. (💨바람 속성)"
            },
            lv20: {
                appearanceId: 'rabbit_lv3',
                name: '하이버닉스',
                statBoost: { hp: 1.9, sp: 2.2, atk: 1.8 },
                newSkill: SKILLS.TORNADO_SWEEP,
                description: "거대한 토네이도를 일으켜 전장을 휩쓰는 폭풍의 지배자 하이버닉스입니다. (💨바람 속성)"
            },
        }
    },

    ['turtle']: {
        name: '새싹치',
        element: '풀',
        compatibleElements: ['풀'],
        battleRole: PET_BATTLE_ROLES.HEAL_SUPPORT,
        battleRoleLabel: '회복·개화 서포터',
        battleRoleTags: ['풀', '회복', '개화'],
        battleRoleNote: '흡수/회복/상태 지원을 중심으로 팀 생존력을 담당합니다. 강한 결과는 이후 풀 반응과 연계합니다.',
        description: "생명의 나무 꼭대기에서 이슬을 머금고 태어난 숲의 수호자 새싹치입니다. (🌿풀 속성)",
        baseStats: { maxHp: 120, maxSp: 40, atk: 8 },
        growth: { hp: 25, sp: 5, atk: 4 },
        skill: SKILLS.LEECH_SEED,
        initialSkills: [SKILLS.LEECH_SEED.id],
        evolution: {
            lv10: {
                appearanceId: 'bird_lv2',
                name: '꽃잎치',
                statBoost: { hp: 1.6, sp: 1.2, atk: 1.35 },
                newSkill: SKILLS.VINE_WHIP,
                description: "향기로운 꽃이 만개하여 넘치는 생명력으로 무장한 꽃잎치입니다. (🌿풀 속성)"
            },
            lv20: {
                appearanceId: 'bird_lv3',
                name: '열매치',
                statBoost: { hp: 2.45, sp: 1.75, atk: 2.35 },
                newSkill: SKILLS.SOLAR_BEAM,
                description: "태양의 에너지를 가득 머금은 생명의 결실을 품고 파괴적인 빛을 쏘는 열매치입니다. 강렬한 빛으로 상대를 눈부심 상태에 빠뜨립니다. (🌿풀 속성)"
            },
        }
    },

    ['monkey']: {
        name: '찌릿숭이',
        element: '번개',
        compatibleElements: ['번개'],
        battleRole: PET_BATTLE_ROLES.REACTION_TRIGGER,
        battleRoleLabel: '번개 반응 트리거 딜러',
        battleRoleTags: ['번개', '트리거', '연계딜'],
        battleRoleNote: '물/불 흔적에 번개를 꽂아 감전·과부하를 터뜨리는 반응 기폭제 역할입니다.',
        description: "약한 전기를 다루는 재주가 많은 원숭이입니다. 호기심이 많고 활발합니다. (⚡번개 속성)",
        baseStats: { maxHp: 85, maxSp: 70, atk: 12 },
        growth: { hp: 18, sp: 10, atk: 4 },
        skill: SKILLS.SHOCK_SCRATCH,
        initialSkills: [SKILLS.SHOCK_SCRATCH.id],
        evolution: {
            lv10: {
                appearanceId: 'monkey_lv2',
                name: '지직숭',
                statBoost: { hp: 1.5, sp: 1.5, atk: 1.5 },
                newSkill: SKILLS.THUNDER_PUNCH,
                description: "고압 전류를 양 주먹에 감고 강력한 전격 타격을 연마한 격투가 지직숭입니다. (⚡번개 속성)"
            },
            lv20: {
                appearanceId: 'monkey_lv3',
                name: '콰릉숭',
                statBoost: { hp: 2.0, sp: 2.1, atk: 1.9 },
                newSkill: SKILLS.THUNDERSTORM,
                description: "하늘에서 거대한 천둥과 뇌우를 떨어뜨려 전장을 초토화시키는 콰릉숭입니다. (⚡번개 속성)"
            },
        }
    },

    ['fox']: {
        name: '모롱이',
        element: '불',
        compatibleElements: ['불'],
        battleRole: PET_BATTLE_ROLES.TRACE_SUPPORT,
        battleRoleLabel: '불 흔적·화상 서포터',
        battleRoleTags: ['불', '흔적', '화상'],
        battleRoleNote: '드래곤처럼 순수 폭딜을 담당하기보다 불 흔적, 잔불, 화상, 연소 준비를 지원합니다.',
        description: "사람이 좋아서 풀숲에서 튀어나온 따뜻한 모닥불여우 모롱이입니다. (🔥불 속성)",
        baseStats: { maxHp: 110, maxSp: 50, atk: 11 },
        growth: { hp: 23, sp: 5, atk: 4 },
        skill: SKILLS.REM_FIRE,
        initialSkills: [SKILLS.REM_FIRE.id],
        evolution: {
            lv10: {
                appearanceId: 'fox_lv2',
                name: '불비비',
                statBoost: { hp: 1.5, sp: 1.4, atk: 1.5 },
                newSkill: SKILLS.FLAME_DASH,
                description: "꼬리의 불꽃이 거세게 타오르며 적의 방어를 꿰뚫고 맹렬히 질주하는 불비비입니다. (🔥불 속성)"
            },
            lv20: {
                appearanceId: 'fox_lv3',
                name: '인페르노',
                statBoost: { hp: 2.2, sp: 1.8, atk: 2.1 },
                newSkill: SKILLS.UPHWA,
                description: "귀엽나요? 역전의 지옥 화염을 다루며 모든 것을 태워버리는 불멸의 파괴신 인페르노입니다. (🔥불 속성)"
            },
        }
    },

    ['frog']: {
        name: '미소구리',
        element: '물',
        compatibleElements: ['물'],
        battleRole: PET_BATTLE_ROLES.CONTROL_DAMAGE,
        battleRoleLabel: '반격·컨트롤 딜러',
        battleRoleTags: ['물', '반격', '컨트롤'],
        battleRoleNote: '정면 폭딜보다는 반격, 속박, 무속성 마무리로 흐름을 가져가는 물 컨트롤 딜러입니다.',
        description: "무과 급제를 위해 수련하는 해맑은 아기 개구리입니다. (💧물 속성)",
        baseStats: { maxHp: 105, maxSp: 55, atk: 10 },
        growth: { hp: 20, sp: 7, atk: 4 },
        skill: SKILLS.WATER_BALL,
        initialSkills: [SKILLS.WATER_BALL.id],
        evolution: {
            lv10: {
                appearanceId: 'frog_lv2',
                name: '부들구리',
                statBoost: { hp: 1.5, sp: 1.5, atk: 1.4 },
                newSkill: SKILLS.COUNTER_STANCE,
                description: "질긴 부들을 장검 삼아 물 흐르듯 유연한 반격 태세를 구축하는 수련 무사 부들구리입니다. (💧물/일반 속성)"
            },
            lv20: {
                appearanceId: 'frog_lv3',
                name: '별감구리',
                statBoost: { hp: 2.1, sp: 2.0, atk: 2.0 },
                newSkills: [SKILLS.ULTIMATE_SECRET.id, SKILLS.REED_BOW.id],
                description: "마침내 무과에 당당히 급제하여 전장을 가르며 섬광을 내뿜는 호위무사 별감구리입니다. (💧물/일반 속성)"
            },
        }
    }
,
    ['manta']: {
        name: '포롱이',
        element: '물',
        compatibleElements: ['물'],
        battleRole: PET_BATTLE_ROLES.TRACE_SUPPORT,
        battleRoleLabel: '물 흔적·표식 서포터',
        battleRoleTags: ['물', '표식', '반응증폭'],
        battleRoleNote: '물결표식과 물 흔적을 쌓아 아군의 감전·빙결·증발 반응을 준비하는 서포터입니다.',
        description: "맑은 물방울 속에서 작은 꽃잎과 함께 태어난 포롱이입니다. 몸속 물결이 흔들릴 때마다 방울 소리를 내며 상대에게 조용히 표식을 새깁니다. (💧물 속성)",
        baseStats: { maxHp: 100, maxSp: 65, atk: 9 },
        growth: { hp: 18, sp: 9, atk: 3 },
        skill: SKILLS.WAVE_MARK,
        initialSkills: [SKILLS.WAVE_MARK.id],
        evolution: {
            lv10: {
                appearanceId: 'manta_lv2',
                name: '살랑가오',
                statBoost: { hp: 1.35, sp: 1.25, atk: 1.35 },
                newSkill: SKILLS.BLOSSOM_CURRENT,
                description: "꽃잎 무늬 지느러미로 물결 위를 살랑이며 미끄러지는 가오리입니다. 새겨 둔 물결표식을 따라 해류를 되돌려 체력을 회복합니다. (💧물 속성)"
            },
            lv20: {
                appearanceId: 'manta_lv3',
                name: '아라오리',
                statBoost: { hp: 2.0, sp: 1.55, atk: 1.75 },
                newSkill: SKILLS.ARA_BLOOM,
                description: "깊은 바다의 꽃물살을 다스리는 우아한 수호 가오리입니다. 오래 쌓인 물결표식을 한순간에 만개시켜 전장을 뒤덮습니다. (💧물 속성)"
            },
        }
    }
};

const getSkillId = (skill) => {
    if (!skill) return null;
    if (typeof skill === 'string') return skill;
    return skill.id || null;
};

const evolutionHasSkill = (evolutionData, skillId) => {
    if (!evolutionData || !skillId) return false;

    const singleSkillId = getSkillId(evolutionData.newSkill);
    if (singleSkillId === skillId) return true;

    const multiSkillIds = (evolutionData.newSkills || []).map(getSkillId);
    return multiSkillIds.includes(skillId);
};

export const canLearnSkill = (pet, skill) => {
    const petData = PET_DATA[pet.species];

    if (skill.element !== null && petData && !petData.compatibleElements.includes(skill.element)) {
        return { canLearn: false, reason: `이 펫은 [${skill.element}] 속성 스킬을 배울 수 없습니다!` };
    }

    if (skill.type === 'basic' || skill.type === 'common') {
        return { canLearn: true, reason: '' };
    }

    const currentStage = parseInt(pet.appearanceId.match(/_lv(\d)/)?.[1] || '1', 10);

    let requiredStage = 1;

    if (petData?.evolution) {
        if (evolutionHasSkill(petData.evolution.lv10, skill.id)) requiredStage = 2;
        if (evolutionHasSkill(petData.evolution.lv20, skill.id)) requiredStage = 3;
    }

    if (currentStage < requiredStage) {
        const stageName = requiredStage === 2 ? '1차 진화' : '최종 진화';
        return { canLearn: false, reason: `잠겨있는 스킬입니다! 최소 [${stageName}] 단계 이상으로 진화해야 비법노트로 배울 수 있습니다.` };
    }

    return { canLearn: true, reason: '' };
};