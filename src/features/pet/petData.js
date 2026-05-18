// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
};

// src/features/pet/petData.js (기존 calculateDamage부터 SKILLS 객체 끝까지 덮어쓰기)

// [헬퍼 함수] 데미지 계산 및 칭호 버프 공통 로직
const calculateDamage = (basePower, attackerPlayer, defenderPlayer) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;

    let damage = basePower + (attacker.atk * 1.5);
    let multiplier = 1.0;

    // 1. 공격자 기 모으기 상태
    if (attacker.status?.focusCharge) multiplier *= 2.0;

    // 2. 방어자 단단해지기 상태
    if (defender.status?.defenseUp) multiplier *= 0.7;

    // 3. [칭호 버프] 득점 기계 (공격 데미지 5% 증가)
    if (attackerPlayer.equippedTitle === 'goal_machine') multiplier *= 1.05;

    // 4. [칭호 버프] 성실의 아이콘 & 칭찬의 주인공 (피격 데미지 감소)
    if (defenderPlayer.equippedTitle === 'icon_of_diligence') multiplier *= 0.95;
    if (defenderPlayer.equippedTitle === 'star_of_compliments') multiplier *= 0.97;

    return damage * multiplier;
};

// [헬퍼 함수] 실명(도발) 체크 로직
const checkBlindMiss = (attacker) => {
    if (attacker.status?.blind) {
        attacker.status.blind = false;
        if (Math.random() < 0.5) return true;
    }
    return false;
};

export const SKILLS = {
    TACKLE: {
        id: 'tackle', name: '몸통박치기', cost: 0, type: 'basic',
        description: '기본적인 몸통박치기로 피해를 줍니다.', basePower: 20,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 빗나갔습니다! 💨`;

            let damage = calculateDamage(SKILLS.TACKLE.basePower, attackerPlayer, defenderPlayer);
            let log = `'${attacker.name}'의 몸통박치기!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력한 한방!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 웅크려 피해를 줄였다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.5 : 0.3;
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
        id: 'harden', name: '단단해지기', cost: 15, type: 'common',
        description: '전투 동안 방어력을 높여 받는 피해를 줄입니다.',
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet; if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            return `'${attacker.name}'의 피부가 단단해졌습니다!`;
        },
    },

    HEALING_PRAYER: {
        id: 'healing_prayer', name: '회복의 기도', cost: 25, type: 'common',
        description: '자신의 HP를 최대 체력의 30%만큼 회복합니다.',
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 체력을 ${healAmount} 회복했습니다! ✨`;
        },
    },

    TAUNT: {
        id: 'taunt', name: '도발', cost: 15, type: 'common',
        description: '상대를 흥분시켜 다음 공격이 50% 확률로 빗나가게 합니다.',
        effect: (attackerPlayer, defenderPlayer) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            defender.status.blind = true;
            return `'${attacker.name}'의 도발! ${defender.name}은(는) 흥분해서 앞이 잘 보이지 않습니다!`;
        },
    },

    FIERY_BREATH: {
        id: 'fiery_breath', name: '용의 숨결', cost: 30, type: 'signature', basePower: 55,
        description: '강력한 화염 피해를 입히지만, 사용 후 잠시 동안 행동할 수 없습니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 뿜었습니다! 💨`;

            let damage = calculateDamage(SKILLS.FIERY_BREATH.basePower, attackerPlayer, defenderPlayer) * 1.2;
            let log = `'${attacker.name}'의 용의 숨결! 🔥`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 초고열의 불꽃!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 막아냈다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.5 : 0.3;
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
        id: 'quick_disturbance', name: '재빠른 교란', cost: 15, type: 'signature', basePower: 20,
        description: '빠르게 공격하여 50% 확률로 상대를 혼란(스턴)에 빠뜨립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 재빠른 교란! ...스텝이 꼬였습니다! 💨`;

            let damage = calculateDamage(SKILLS.QUICK_DISTURBANCE.basePower, attackerPlayer, defenderPlayer);
            let log = `'${attacker.name}'의 재빠른 교란! 💨`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 보이지 않는 속도!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 방어했다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.5 : 0.3;
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
        id: 'leech_seed', name: '씨뿌리기', cost: 20, type: 'signature', basePower: 30,
        description: '상대의 체력을 흡수하여 자신의 체력을 회복합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 씨뿌리기! ...엉뚱한 곳에 뿌렸습니다! 💨`;

            let damage = calculateDamage(SKILLS.LEECH_SEED.basePower, attackerPlayer, defenderPlayer);
            let log = `'${attacker.name}'의 씨뿌리기! 🌱`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력하게 빨아들인다!`;
            if (attackerPlayer.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
                damage *= 1.5; log = `💥 [치명타!] ` + log;
            }

            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; log += ` (상대는 피해를 줄였다!)`; break;
                case 'EVADE':
                    const evadeChance = defenderPlayer.equippedTitle === 'class_dj' ? 0.5 : 0.3;
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
};

export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다.",
        baseStats: { maxHp: 100, maxSp: 50, atk: 15 },
        growth: { hp: 20, sp: 5, atk: 5 },
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id],
        evolution: {
            lv10: { appearanceId: 'dragon_lv2', name: '은하룡', statBoost: { hp: 1.2, sp: 1.1, atk: 1.3 } },
            lv20: { appearanceId: 'dragon_lv3', name: '스텔라곤', statBoost: { hp: 1.25, sp: 1.15, atk: 1.35 } },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        description: "장난기 많은 바람의 정령들이 데이터 조각에 깃들어 태어난 존재입니다.",
        baseStats: { maxHp: 90, maxSp: 60, atk: 10 },
        growth: { hp: 15, sp: 8, atk: 4 },
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE.id],
        evolution: {
            lv10: { appearanceId: 'rabbit_lv2', name: '버닉스', statBoost: { hp: 1.15, sp: 1.3, atk: 1.1 } },
            lv20: { appearanceId: 'rabbit_lv3', name: '하이버닉스', statBoost: { hp: 1.2, sp: 1.35, atk: 1.15 } },
        }
    },
    [PET_SPECIES.TURTLE]: {
        name: '새싹치',
        description: "고요한 숲, 생명의 나무 꼭대기에서 이슬을 머금고 태어난 숲의 수호자입니다.",
        baseStats: { maxHp: 120, maxSp: 40, atk: 8 },
        growth: { hp: 25, sp: 4, atk: 3 },
        skill: SKILLS.LEECH_SEED,
        initialSkills: [SKILLS.LEECH_SEED.id],
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.3, sp: 1.1, atk: 1.1 } },
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 1.35, sp: 1.15, atk: 1.15 } },
        }
    },
};