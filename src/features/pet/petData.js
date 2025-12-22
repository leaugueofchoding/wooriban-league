// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
};

// [헬퍼 함수] 데미지 계산 공통 로직
const calculateDamage = (basePower, attacker, defender) => {
    // 1. 기초 데미지 (공격력 계수)
    let damage = basePower + (attacker.atk * 1.5);

    // 2. 공격자 상태 확인 (기 모으기)
    let multiplier = 1.0;
    if (attacker.status?.focusCharge) multiplier *= 2.0; // 기 모으기: 2배
    // (도발 효과 변경으로 attackDown 로직 제거)

    // 3. 방어자 상태 확인 (방어력 상승)
    if (defender.status?.defenseUp) multiplier *= 0.7;   // 단단해지기: 30% 감소

    return damage * multiplier;
};

// [헬퍼 함수] 실명(도발) 체크 로직
const checkBlindMiss = (attacker) => {
    if (attacker.status?.blind) {
        // 효과 소모 (이번 턴에 적용되고 사라짐)
        attacker.status.blind = false;

        // 50% 확률로 빗나감
        if (Math.random() < 0.5) {
            return true; // 빗나감 발생
        }
    }
    return false; // 정상 공격
};

export const SKILLS = {
    // [기본] 몸통박치기
    TACKLE: {
        id: 'tackle',
        name: '몸통박치기',
        cost: 0,
        type: 'basic',
        description: '기본적인 몸통박치기로 피해를 줍니다.',
        basePower: 20,
        effect: (attacker, defender, defenderAction) => {
            // 1. 도발(실명) 체크
            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 허공을 가랐습니다! (공격 빗나감 💨)`;
            }

            let damage = calculateDamage(SKILLS.TACKLE.basePower, attacker, defender);
            let log = `'${attacker.name}'의 몸통박치기!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력한 한방!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` (상대방은 웅크려서 버텼다!)`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` (상대방이 날렵하게 회피했다!)`; }
                    else { log += ` (상대방의 회피 실패!)`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` (상대방은 맞으면서 기를 모았다!)`; break;
                case 'FLEE_FAILED': log += ` (도망에 실패해 무방비하다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${damage}의 피해!`;
            }
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    // [방어] 단단해지기
    HARDEN: {
        id: 'harden',
        name: '단단해지기',
        cost: 15,
        type: 'common',
        description: '전투 동안 방어력을 높여 받는 피해를 줄입니다.',
        effect: (attacker) => {
            attacker.status.defenseUp = true;
            return `'${attacker.name}'의 피부가 강철처럼 단단해졌습니다! (받는 피해 감소)`;
        },
    },

    // [회복] 회복의 기도
    HEALING_PRAYER: {
        id: 'healing_prayer',
        name: '회복의 기도',
        cost: 25,
        type: 'common',
        description: '자신의 HP를 최대 체력의 30%만큼 회복합니다.',
        effect: (attacker) => {
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 기도를 올려 체력을 ${healAmount} 회복했습니다! ✨`;
        },
    },

    // [디버프] 도발 (효과 변경: 공격력 감소 -> 50% 빗나감)
    TAUNT: {
        id: 'taunt',
        name: '도발',
        cost: 15,
        type: 'common',
        description: '상대를 흥분시켜 다음 공격이 50% 확률로 빗나가게 합니다.',
        effect: (attacker, defender) => {
            defender.status.blind = true; // 상대에게 실명(blind) 상태 부여
            return `'${attacker.name}'의 도발! ${defender.name}은(는) 흥분해서 앞이 잘 보이지 않습니다! (다음 공격 명중률 하락)`;
        },
    },

    // --- 시그니처 스킬 ---

    // [공격] 용의 숨결
    FIERY_BREATH: {
        id: 'fiery_breath',
        name: '용의 숨결',
        cost: 30,
        type: 'signature',
        basePower: 55,
        description: '강력한 화염 피해를 입히지만, 사용 후 잠시 동안 행동할 수 없습니다.',
        effect: (attacker, defender, defenderAction) => {
            // 1. 도발(실명) 체크
            if (checkBlindMiss(attacker)) {
                // 반동(재충전)은 적용되지 않게 하거나, 빗나가도 적용되게 할 수 있음.
                // 여기서는 빗나가면 반동 없이 턴만 날리는 것으로 처리 (유저 친화적)
                return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 불을 뿜었습니다! (공격 빗나감 💨)`;
            }

            let damage = calculateDamage(SKILLS.FIERY_BREATH.basePower, attacker, defender);
            damage *= 1.2; // 시그니처 보정

            let log = `'${attacker.name}'의 용의 숨결! 🔥`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 초고열의 불꽃!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` (상대는 필사적으로 막아냈다!)`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` (상대가 불길을 피했다!)`; }
                    else { log += ` (범위가 너무 넓어 피하지 못했다!)`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` (상대는 불길 속에서 기를 모았다!)`; break;
                case 'FLEE_FAILED': log += ` (도망치지 못하고 직격!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${damage}의 엄청난 피해!`;
            }

            // 반동
            attacker.status.recharging = true;
            log += ` (반동으로 인해 잠시 움직일 수 없다!)`;

            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    // [공격] 재빠른 교란
    QUICK_DISTURBANCE: {
        id: 'quick_disturbance',
        name: '재빠른 교란',
        cost: 15,
        type: 'signature',
        basePower: 20,
        description: '빠르게 공격하여 50% 확률로 상대를 혼란(스턴)에 빠뜨립니다.',
        effect: (attacker, defender, defenderAction) => {
            // 1. 도발(실명) 체크
            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 재빠른 교란! ...하지만 도발 때문에 스텝이 꼬였습니다! (공격 빗나감 💨)`;
            }

            let damage = calculateDamage(SKILLS.QUICK_DISTURBANCE.basePower, attacker, defender);
            let log = `'${attacker.name}'의 재빠른 교란! 💨`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 보이지 않는 속도!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` (상대는 침착하게 방어했다!)`; break;
                case 'EVADE':
                    if (Math.random() < 0.3) { damage = 0; log += ` (상대도 같이 움직여 피했다!)`; }
                    else { log += ` (너무 빨라 피할 수 없었다!)`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` (상대는 공격을 무시하고 집중했다!)`; break;
                case 'FLEE_FAILED': log += ` (도망갈 틈이 없다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);
                log += ` ${damage}의 피해!`;
            }

            // 스턴 효과
            if (Math.random() < 0.5) {
                defender.status.stunned = true;
                log += ` 💫 ${defender.name}은(는) 어지러움을 느꼈다! (다음 턴 행동 불가)`;
            }

            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },

    // [공격/흡혈] 씨뿌리기
    LEECH_SEED: {
        id: 'leech_seed',
        name: '씨뿌리기',
        cost: 20,
        type: 'signature',
        basePower: 30,
        description: '상대의 체력을 흡수하여 자신의 체력을 회복합니다.',
        effect: (attacker, defender, defenderAction) => {
            // 1. 도발(실명) 체크
            if (checkBlindMiss(attacker)) {
                return `'${attacker.name}'의 씨뿌리기! ...하지만 엉뚱한 곳에 씨앗을 뿌렸습니다! (공격 빗나감 💨)`;
            }

            let damage = calculateDamage(SKILLS.LEECH_SEED.basePower, attacker, defender);
            let log = `'${attacker.name}'의 씨뿌리기! 🌱`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 생명력을 강하게 빨아들인다!`;

            switch (defenderAction) {
                case 'BRACE': damage *= 0.5; log += ` (상대는 웅크려 피해를 줄였다!)`; break;
                case 'EVADE':
                    if (Math.random() < 0.5) { damage = 0; log += ` (상대가 씨앗을 피했다!)`; }
                    else { log += ` (회피 실패! 씨앗이 몸에 붙었다!)`; }
                    break;
                case 'FOCUS': defender.status.focusCharge = 1; log += ` (상대는 고통을 참으며 기를 모았다!)`; break;
                case 'FLEE_FAILED': log += ` (도망치지 못했다!)`; break;
            }

            damage = Math.round(damage);
            if (damage > 0) {
                defender.hp = Math.max(0, defender.hp - damage);

                // 흡혈
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