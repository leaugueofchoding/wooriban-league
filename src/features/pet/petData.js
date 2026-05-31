// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
    ELECTRIC_MONKEY: 'monkey'
};

// 6원소 속성(Element) 시스템
export const ELEMENTS = {
    FIRE: '불',
    WIND: '바람',
    GRASS: '풀',
    WATER: '물',
    ELECTRIC: '번개',
    EARTH: '흙'
};

// 속성별 상성 관계도 (누가 누구에게 1.2배 강한지 정의)
const ELEMENT_CHART = {
    [ELEMENTS.FIRE]: { strongAgainst: [ELEMENTS.GRASS, ELEMENTS.WIND] },
    [ELEMENTS.WIND]: { strongAgainst: [ELEMENTS.GRASS, ELEMENTS.EARTH] },
    [ELEMENTS.GRASS]: { strongAgainst: [ELEMENTS.WATER, ELEMENTS.ELECTRIC] },
    [ELEMENTS.WATER]: { strongAgainst: [ELEMENTS.FIRE, ELEMENTS.EARTH] },
    [ELEMENTS.ELECTRIC]: { strongAgainst: [ELEMENTS.WATER, ELEMENTS.WIND] },
    [ELEMENTS.EARTH]: { strongAgainst: [ELEMENTS.ELECTRIC, ELEMENTS.FIRE] }
};

// DB에 속성값이 없는 기존 펫들을 위한 자동 판별 헬퍼 함수
const getPetElement = (appearanceId = '') => {
    if (appearanceId.includes('dragon')) return ELEMENTS.FIRE;
    if (appearanceId.includes('rabbit')) return ELEMENTS.WIND;
    if (appearanceId.includes('bird') || appearanceId.includes('turtle')) return ELEMENTS.GRASS;
    if (appearanceId.includes('monkey')) return ELEMENTS.ELECTRIC; // 찌릿숭이 판별 추가
    return null;
};

// 스킬 속성(skillElement)을 인자로 받아 상성 계산을 처리
const calculateDamage = (basePower, attackerPlayer, defenderPlayer, skillElement = null) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;

    let damage = basePower + (attacker.atk * 1.5);
    let multiplier = 1.0;
    let isEffective = false; // 상성 우위 여부

    // 스킬에 속성이 존재할 때만 상성 계산 (기본공격, 무속성 스킬은 제외)
    if (skillElement) {
        const defenderElement = defender.element || getPetElement(defender.appearanceId);

        if (defenderElement && ELEMENT_CHART[skillElement]?.strongAgainst.includes(defenderElement)) {
            multiplier *= 1.2; // 상성에 유리하면 최종 데미지 20% 증가!
            isEffective = true;
        }
    }

    if (attacker.status?.focusCharge) multiplier *= 2.0;
    if (defender.status?.defenseUp) multiplier *= 0.7;
    if (attackerPlayer.equippedTitle === 'goal_machine') multiplier *= 1.05;
    if (defenderPlayer.equippedTitle === 'icon_of_diligence') multiplier *= 0.95;
    if (defenderPlayer.equippedTitle === 'star_of_compliments') multiplier *= 0.97;

    return { damage: damage * multiplier, isEffective };
};

const checkBlindMiss = (attacker) => {
    if (attacker.status?.blind) {
        attacker.status.blind = false;
        if (Math.random() < 0.5) return true;
    }
    return false;
};

export const SKILLS = {
    TACKLE: {
        id: 'tackle', name: '몸통박치기', cost: 0, type: 'basic', element: null, // 무속성
        description: '기본적인 몸통박치기로 피해를 줍니다.', basePower: 20,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 빗나갔습니다! 💨`;

            // 기본 공격이므로 skillElement에 null을 전달 (상성 미적용)
            let { damage } = calculateDamage(SKILLS.TACKLE.basePower, attackerPlayer, defenderPlayer, SKILLS.TACKLE.element);
            let log = `'${attacker.name}'의 몸통박치기!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력한 한방!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 웅크려 피해를 줄였다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
                    if (Math.random() < evadeChance) { damage = 0; log += ` (상대방이 날렵하게 회피했다!)`; }
                    else { damage *= 1.5; log += ` (회피 실패! 치명적인 피해!)`; }
                    break;
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
                case 'FLEE_FAILED': log += ` (도망에 실패해 무방비하다!)`; break;
                case 'STUNNED': log += ` (상대는 혼란 상태라 방어하지 못했다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) { defender.hp = Math.max(0, defender.hp - damage); log += ` ${damage}의 피해!`; }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    HARDEN: {
        id: 'harden', name: '단단해지기', cost: 15, type: 'common', element: null,
        description: '전투 동안 방어력을 높여 받는 피해를 줄입니다.',
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet; if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            return `'${attacker.name}'의 피부가 단단해졌습니다!`;
        },
    },

    HEALING_PRAYER: {
        id: 'healing_prayer', name: '회복의 기도', cost: 25, type: 'common', element: null,
        description: '자신의 HP를 최대 체력의 30%만큼 회복합니다.',
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 체력을 ${healAmount} 회복했습니다! ✨`;
        },
    },

    TAUNT: {
        id: 'taunt', name: '도발', cost: 15, type: 'common', element: null,
        description: '상대를 흥분시켜 다음 공격이 50% 확률로 빗나가게 합니다.',
        effect: (attackerPlayer, defenderPlayer) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            defender.status.blind = true;
            return `'${attacker.name}'의 도발! ${defender.name}은(는) 흥분해서 앞이 잘 보이지 않습니다!`;
        },
    },

    FIERY_BREATH: {
        id: 'fiery_breath', name: '용의 숨결', cost: 30, type: 'signature', element: ELEMENTS.FIRE, basePower: 55,
        description: '강력한 화염 피해를 입히지만, 사용 후 잠시 동안 행동할 수 없습니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 뿜었습니다! 💨`;

            let { damage, isEffective } = calculateDamage(SKILLS.FIERY_BREATH.basePower, attackerPlayer, defenderPlayer, SKILLS.FIERY_BREATH.element);
            damage *= 1.2; // 용의 숨결 고유 데미지 보너스

            let log = `'${attacker.name}'의 용의 숨결! 🔥`;

            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (attacker.status?.focusCharge) log += ` ⚡️ 초고열의 불꽃!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 막아냈다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
                    if (Math.random() < evadeChance) { damage = 0; log += ` (상대가 피했다!)`; }
                    else { damage *= 1.5; log += ` (피하지 못하고 직격!)`; }
                    break;
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
                case 'FLEE_FAILED': log += ` (도망치지 못했다!)`; break;
                case 'STUNNED': log += ` (상대는 무방비하다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) { defender.hp = Math.max(0, defender.hp - damage); log += ` ${damage}의 엄청난 피해!`; }
            attacker.status.recharging = true; log += ` (반동으로 인해 잠시 움직일 수 없다!)`;
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    QUICK_DISTURBANCE: {
        id: 'quick_disturbance', name: '재빠른 교란', cost: 15, type: 'signature', element: ELEMENTS.WIND, basePower: 20,
        description: '빠르게 공격하여 50% 확률로 상대를 혼란(스턴)에 빠뜨립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 재빠른 교란! ...스텝이 꼬였습니다! 💨`;

            let { damage, isEffective } = calculateDamage(SKILLS.QUICK_DISTURBANCE.basePower, attackerPlayer, defenderPlayer, SKILLS.QUICK_DISTURBANCE.element);
            let log = `'${attacker.name}'의 재빠른 교란! 💨`;

            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (attacker.status?.focusCharge) log += ` ⚡️ 보이지 않는 속도!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 방어했다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
                    if (Math.random() < evadeChance) { damage = 0; log += ` (상대도 피했다!)`; }
                    else { damage *= 1.5; log += ` (너무 빨라 치명상!)`; }
                    break;
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
                case 'FLEE_FAILED': log += ` (도망갈 틈이 없다!)`; break;
                case 'STUNNED': log += ` (상대는 무방비하다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) { defender.hp = Math.max(0, defender.hp - damage); log += ` ${damage}의 피해!`; }
            if (Math.random() < 0.5) { defender.status.stunned = true; log += ` 💫 ${defender.name}은(는) 어지러움을 느꼈다!`; }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    LEECH_SEED: {
        id: 'leech_seed', name: '씨뿌리기', cost: 20, type: 'signature', element: ELEMENTS.GRASS, basePower: 30,
        description: '상대의 체력을 흡수하여 자신의 체력을 회복합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 씨뿌리기! ...엉뚱한 곳에 뿌렸습니다! 💨`;

            let { damage, isEffective } = calculateDamage(SKILLS.LEECH_SEED.basePower, attackerPlayer, defenderPlayer, SKILLS.LEECH_SEED.element);
            let log = `'${attacker.name}'의 씨뿌리기! 🌱`;

            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (attacker.status?.focusCharge) log += ` ⚡️ 강력하게 빨아들인다!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 피해를 줄였다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.4 : 0.3;
                    if (Math.random() < evadeChance) { damage = 0; log += ` (상대가 피했다!)`; }
                    else { damage *= 1.5; log += ` (씨앗이 몸에 깊게 붙었다!)`; }
                    break;
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
                case 'FLEE_FAILED': log += ` (도망치지 못했다!)`; break;
                case 'STUNNED': log += ` (상대는 무방비하다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                const healAmount = Math.round(damage * 0.6);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                log += ` ${damage}의 피해를 주고, 체력을 ${healAmount} 회복했다!`;
            }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    SHOCK_SCRATCH: {
        id: 'shock_scratch', name: '따끔할퀴기', cost: 10, type: 'signature', element: ELEMENTS.ELECTRIC, basePower: 25,
        description: '작은 번개를 두른 손톱으로 할큅니다. 20% 확률로 마비(스턴)를 겁니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(25, attackerPlayer, defenderPlayer, ELEMENTS.ELECTRIC);
            if (Math.random() < 0.2) {
                if (!defender.status) defender.status = {};
                defender.status.stunned = true;
            }
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 따끔할퀴기! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 상대가 마비되었습니다!' : ''}`;
        }
    },
    THUNDER_PUNCH: {
        id: 'thunder_punch', name: '찌릿펀치', cost: 20, type: 'signature', element: ELEMENTS.ELECTRIC, basePower: 40,
        description: '강력한 전기 펀치를 날립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(40, attackerPlayer, defenderPlayer, ELEMENTS.ELECTRIC);
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 찌릿펀치! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 피해!`;
        }
    },
    THUNDERSTORM: {
        id: 'thunderstorm', name: '뇌우', cost: 40, type: 'signature', element: ELEMENTS.ELECTRIC, basePower: 65,
        description: '하늘에서 번개를 불러옵니다. 40% 확률로 스턴을 겁니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(65, attackerPlayer, defenderPlayer, ELEMENTS.ELECTRIC);
            if (Math.random() < 0.4) {
                if (!defender.status) defender.status = {};
                defender.status.stunned = true;
            }
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 뇌우! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 상대가 뇌우에 맞고 기절했습니다!' : ''}`;
        }
    }
};

export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        element: ELEMENTS.FIRE,
        compatibleElements: [ELEMENTS.FIRE], // 🔥 불 속성 스킬만 사용 가능
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다. (🔥불 속성)",
        baseStats: { maxHp: 100, maxSp: 50, atk: 15 },
        growth: { hp: 20, sp: 5, atk: 5 },
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id],
        evolution: {
            lv10: { appearanceId: 'dragon_lv2', name: '은하룡', statBoost: { hp: 1.5, sp: 1.3, atk: 1.5 }, newSkill: SKILLS.FIERY_BREATH },
            lv20: { appearanceId: 'dragon_lv3', name: '스텔라곤', statBoost: { hp: 2.2, sp: 1.6, atk: 2.2 }, newSkill: SKILLS.FIERY_BREATH },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        element: ELEMENTS.WIND,
        compatibleElements: [ELEMENTS.WIND], // 💨 바람 속성 스킬만 사용 가능
        description: "장난기 많은 바람의 정령들이 데이터 조각에 깃들어 태어난 존재입니다. (💨바람 속성)",
        baseStats: { maxHp: 90, maxSp: 60, atk: 10 },
        growth: { hp: 15, sp: 8, atk: 4 },
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE.id],
        evolution: {
            lv10: { appearanceId: 'rabbit_lv2', name: '버닉스', statBoost: { hp: 1.4, sp: 1.6, atk: 1.4 }, newSkill: SKILLS.QUICK_DISTURBANCE },
            lv20: { appearanceId: 'rabbit_lv3', name: '하이버닉스', statBoost: { hp: 1.9, sp: 2.2, atk: 1.8 }, newSkill: SKILLS.QUICK_DISTURBANCE },
        }
    },
    [PET_SPECIES.TURTLE]: {
        name: '새싹치',
        element: ELEMENTS.GRASS,
        compatibleElements: [ELEMENTS.GRASS], // 🌿 풀 속성 스킬만 사용 가능
        description: "고요한 숲, 생명의 나무 꼭대기에서 이슬을 머금고 태어난 숲의 수호자입니다. (🌿풀 속성)",
        baseStats: { maxHp: 120, maxSp: 40, atk: 8 },
        growth: { hp: 25, sp: 4, atk: 3 },
        skill: SKILLS.LEECH_SEED,
        initialSkills: [SKILLS.LEECH_SEED.id],
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.6, sp: 1.2, atk: 1.3 }, newSkill: SKILLS.LEECH_SEED },
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 2.3, sp: 1.5, atk: 1.7 }, newSkill: SKILLS.LEECH_SEED },
        }
    },
    [PET_SPECIES.ELECTRIC_MONKEY]: {
        name: '찌릿숭이',
        element: ELEMENTS.ELECTRIC,
        compatibleElements: [ELEMENTS.ELECTRIC], // ⚡ 번개 속성 스킬만 사용 가능
        description: "전기를 다루는 재주가 많은 원숭이입니다. (⚡번개 속성)",
        baseStats: { maxHp: 85, maxSp: 70, atk: 12 },
        growth: { hp: 18, sp: 10, atk: 6 },
        skill: SKILLS.SHOCK_SCRATCH,
        initialSkills: [SKILLS.SHOCK_SCRATCH.id],
        evolution: {
            lv10: {
                appearanceId: 'monkey_lv2', name: '지직숭',
                statBoost: { hp: 1.5, sp: 1.5, atk: 1.6 },
                newSkill: SKILLS.THUNDER_PUNCH
            },
            lv20: {
                appearanceId: 'monkey_lv3', name: '콰릉숭',
                statBoost: { hp: 2.0, sp: 2.1, atk: 2.3 },
                newSkill: SKILLS.THUNDERSTORM
            },
        }
    },
};

/**
 * 펫이 해당 스킬을 배울 수 있는 조건인지 검증하는 헬퍼 함수
 */
export const canLearnSkill = (pet, skill) => {
    // 1. 속성 제한 체크
    const petData = PET_DATA[pet.species];
    if (skill.element !== null && petData && !petData.compatibleElements.includes(skill.element)) {
        return { canLearn: false, reason: `이 펫은 [${skill.element}] 속성 스킬을 배울 수 없습니다!` };
    }

    // 기본 공격이나 공용 스킬은 진화 단계 제한 없이 통과
    if (skill.type === 'basic' || skill.type === 'common') {
        return { canLearn: true, reason: '' };
    }

    // 2. 진화 단계별 시그니처 스킬 제한 체크
    const currentStage = parseInt(pet.appearanceId.match(/_lv(\d)/)?.[1] || '1');

    let requiredStage = 1;
    if (petData && petData.evolution) {
        if (petData.evolution.lv10?.newSkill?.id === skill.id) requiredStage = 2;
        if (petData.evolution.lv20?.newSkill?.id === skill.id) requiredStage = 3;
    }

    if (currentStage < requiredStage) {
        let stageName = requiredStage === 2 ? '1차 진화' : '최종 진화';
        return {
            canLearn: false,
            reason: `잠겨있는 스킬입니다! 최소 [${stageName}] 단계 이상으로 진화해야 비법노트로 배울 수 있습니다.`
        };
    }

    return { canLearn: true, reason: '' };
};