// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
};

export const SKILLS = {
    TACKLE: {
        id: 'tackle',
        name: '몸통박치기',
        cost: 0,
        type: 'common',
        description: '기본적인 몸통박치기로 피해를 줍니다.',
        basePower: 20,
        effect: (attacker, defender, defenderAction) => {
            // [상향] 공격력 효율 2배
            let damage = (SKILLS.TACKLE.basePower + (attacker.atk * 2)) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
            let log = `'${attacker.name}'의 몸통박치기!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 기를 모은 강력한 한방!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` ${defender.name}은(는) 웅크려 피해를 줄였다!`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` 하지만 ${defender.name}은(는) 공격을 회피했다!`; }
                    else { log += ` ${defender.name}의 회피가 실패했다!`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` ${defender.name}은(는) 공격을 받아내며 기를 모은다!`; break;
                case 'FLEE_FAILED': log += ` ${defender.name}은(는) 도망에 실패해 무방비 상태!`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${defender.name}에게 ${damage}의 피해!`;
            }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },
    HARDEN: {
        id: 'harden',
        name: '단단해지기',
        cost: 20,
        type: 'common',
        description: '일시적으로 방어 태세를 갖춰 받는 피해를 줄입니다.',
        effect: (attacker) => {
            return `'${attacker.name}'이(가) 몸을 단단하게 만들었습니다!`;
        },
    },
    HEALING_PRAYER: {
        id: 'healing_prayer',
        name: '회복의 기도',
        cost: 25,
        type: 'common',
        description: '자신의 HP를 최대 HP의 30%만큼 회복합니다.',
        effect: (attacker) => {
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 회복의 기도로 HP를 ${healAmount}만큼 회복했습니다!`;
        },
    },
    TAUNT: {
        id: 'taunt',
        name: '도발',
        cost: 15,
        type: 'common',
        description: '상대를 도발합니다.',
        effect: (attacker, defender) => {
            return `'${attacker.name}'의 도발! ${defender.name}의 기분이 나빠졌습니다.`;
        },
    },
    // --- 시그니처 스킬 ---
    FIERY_BREATH: {
        id: 'fiery_breath',
        name: '용의 숨결',
        cost: 30,
        type: 'signature',
        basePower: 50,
        description: '강력한 화염 피해를 입히지만, 사용 후 잠시 동안 행동할 수 없습니다.',
        effect: (attacker, defender, defenderAction) => {
            // [상향] 공격력 효율 2.5배
            let damage = (SKILLS.FIERY_BREATH.basePower + (attacker.atk * 2.5)) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
            let log = `'${attacker.name}'의 강력한 용의 숨결!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 기를 모은 공격!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` ${defender.name}은(는) 웅크려 피해를 줄였다!`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` 하지만 ${defender.name}은(는) 공격을 회피했다!`; }
                    else { log += ` ${defender.name}의 회피가 실패했다!`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` ${defender.name}은(는) 공격을 받아내며 기를 모은다!`; break;
                case 'FLEE_FAILED': log += ` ${defender.name}은(는) 도망에 실패해 무방비 상태!`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${defender.name}에게 ${damage}의 피해!`;
            }

            // [핵심] 재충전 상태 부여 -> 다음 턴 행동 제약
            attacker.status.recharging = true;
            log += ` (반동으로 움직일 수 없다!)`;

            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },
    QUICK_DISTURBANCE: {
        id: 'quick_disturbance',
        name: '재빠른 교란',
        cost: 15,
        type: 'signature',
        basePower: 15,
        description: '피해를 주고 50% 확률로 상대를 혼란(스턴)에 빠뜨립니다.',
        effect: (attacker, defender, defenderAction) => {
            // [상향] 공격력 효율 1.5배
            let damage = (SKILLS.QUICK_DISTURBANCE.basePower + (attacker.atk * 1.5)) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
            let log = `'${attacker.name}'의 재빠른 교란!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 기를 모은 공격!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` ${defender.name}은(는) 웅크려 피해를 줄였다!`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` 하지만 ${defender.name}은(는) 공격을 회피했다!`; }
                    else { log += ` ${defender.name}의 회피가 실패했다!`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` ${defender.name}은(는) 공격을 받아내며 기를 모은다!`; break;
                case 'FLEE_FAILED': log += ` ${defender.name}은(는) 도망에 실패해 무방비 상태!`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${defender.name}에게 ${damage}의 피해!`;
            }

            // [핵심] 스턴 부여 -> 상대방 퀴즈 불가
            if (Math.random() < 0.5) {
                defender.status.stunned = true;
                log += ` ${defender.name}은(는) 혼란에 빠졌다!`;
            }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },
    FEATHER_SHIELD: {
        id: 'feather_shield',
        name: '깃털 방패',
        cost: 25,
        type: 'signature',
        description: '이번 턴 받는 피해를 대폭 줄입니다.',
        effect: (attacker) => {
            return `'${attacker.name}'가 깃털 방패를 펼쳤습니다!`;
        },
    }
};

// [수정] 성장 수치 대폭 상향 (레벨업 체감 증대)
export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다.",
        baseStats: { maxHp: 100, maxSp: 50, atk: 15 },
        growth: { hp: 20, sp: 5, atk: 5 }, // atk 5 증가
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id], // 몸통박치기 제외
        evolution: {
            lv10: { appearanceId: 'dragon_lv2', name: '은하룡', statBoost: { hp: 1.2, sp: 1.1, atk: 1.3 } },
            lv20: { appearanceId: 'dragon_lv3', name: '스텔라곤', statBoost: { hp: 1.25, sp: 1.15, atk: 1.35 } },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        description: "장난기 많은 바람의 정령들이 데이터 조각에 깃들어 태어난 존재입니다.",
        baseStats: { maxHp: 90, maxSp: 60, atk: 10 },
        growth: { hp: 15, sp: 8, atk: 4 }, // atk 4 증가
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
        growth: { hp: 25, sp: 4, atk: 3 }, // 체력 위주
        skill: SKILLS.FEATHER_SHIELD,
        initialSkills: [SKILLS.FEATHER_SHIELD.id],
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.3, sp: 1.1, atk: 1.1 } },
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 1.35, sp: 1.15, atk: 1.15 } },
        }
    },
};