// src/features/pet/petData.js

/**
 * 펫의 종류, 스킬, 진화 정보 등 모든 데이터를 관리하는 파일입니다.
 * 새로운 펫을 추가하거나 밸런스를 조정할 때 이 파일을 수정합니다.
 */

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
            let damage = (SKILLS.TACKLE.basePower + attacker.atk) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
            let log = `'${attacker.name}'의 몸통박치기!`;

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
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0; // 기 모으기 초기화
            return log;
        },
    },
    HARDEN: {
        id: 'harden',
        name: '단단해지기',
        cost: 20,
        type: 'common',
        description: '2턴 동안 자신의 방어력을 높여 받는 피해를 30% 감소시킵니다.',
        effect: (attacker) => { // 방어 스킬은 defenderAction이 필요 없음
            attacker.status.defenseBuffTurns = (attacker.status.defenseBuffTurns || 0) + 2;
            return `'${attacker.name}'이(가) 몸을 단단하게 만들었습니다! 방어력이 상승합니다.`;
        },
    },
    HEALING_PRAYER: {
        id: 'healing_prayer',
        name: '회복의 기도',
        cost: 25,
        type: 'common',
        description: '자신의 HP를 최대 HP의 25%만큼 회복합니다.',
        effect: (attacker) => { // 회복 스킬
            const healAmount = Math.round(attacker.maxHp * 0.25);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 회복의 기도로 HP를 ${healAmount}만큼 회복했습니다!`;
        },
    },
    TAUNT: {
        id: 'taunt',
        name: '도발',
        cost: 15,
        type: 'common',
        description: '상대를 도발하여 2턴 동안 방어력을 20% 감소시킵니다.',
        effect: (attacker, defender, defenderAction) => { // 디버프 스킬
            // 방어 행동에 의해 영향을 받지 않음
            defender.status.defenseDebuffTurns = (defender.status.defenseDebuffTurns || 0) + 2;
            return `'${attacker.name}'의 도발! ${defender.name}의 방어력이 하락합니다.`;
        },
    },
    // --- 시그니처 스킬 ---
    FIERY_BREATH: {
        id: 'fiery_breath',
        name: '용의 숨결',
        cost: 30,
        type: 'signature',
        basePower: 40,
        description: '강력한 화염 피해를 입히지만, 사용 후 다음 턴에 행동할 수 없습니다.',
        effect: (attacker, defender, defenderAction) => {
            let damage = (SKILLS.FIERY_BREATH.basePower + attacker.atk) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
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

            attacker.status.recharging = true; // 재충전 상태
            log += ` ${attacker.name}은(는) 반동으로 다음 턴을 쉬어야 한다.`;
            if (attacker.status?.focusCharge) attacker.status.focusCharge = 0;
            return log;
        },
    },
    QUICK_DISTURBANCE: {
        id: 'quick_disturbance',
        name: '재빠른 교란',
        cost: 15,
        type: 'signature',
        basePower: 10,
        description: '낮은 피해를 주고 50% 확률로 상대를 행동 불능으로 만듭니다.',
        effect: (attacker, defender, defenderAction) => {
            let damage = (SKILLS.QUICK_DISTURBANCE.basePower + attacker.atk) * (1 + (attacker.status?.focusCharge || 0) * 0.5);
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

            if (Math.random() < 0.5) { // 50% 스턴
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
        description: '2턴 동안 받는 모든 피해를 70% 감소시킵니다.',
        effect: (attacker) => { // 방어 스킬
            attacker.status.defenseBuffTurns = 2; // 2턴 지속
            // 이 스킬은 데미지를 0으로 만드는 게 아니라, BRACE와 중첩 가능한 버프를 겁니다.
            // 실제 데미지 감소 로직은 TACKLE 등 공격 스킬의 effect 내에서 처리해야 합니다.
            // -> BattlePage.jsx의 handleResolution에서 'BRACE' 대신 이 버프를 확인해야 함.

            // [수정] 혼동을 피하기 위해, 이 스킬은 'BRACE'와 동일하게 50% 데미지 감소로 즉시 적용되도록 변경
            attacker.status.isBracing = true; // 즉시 1턴 방어
            return `'${attacker.name}'가 깃털 방패로 몸을 감쌉니다! 피해를 줄입니다.`;
        },
    }
};

export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다. 몸에 새겨진 별자리는 밤하늘의 신비를, 반짝이는 날개는 은하수의 흐름을 닮았다고 합니다. 강력한 한 방을 위해 오랫동안 힘을 모으는 것을 좋아합니다.",
        baseStats: { maxHp: 100, maxSp: 50, atk: 12 },
        growth: { hp: 10, sp: 3, atk: 2 },
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id], // 몸통박치기 제거
        evolution: {
            lv10: { appearanceId: 'dragon_lv2', name: '은하룡', statBoost: { hp: 1.2, sp: 1.1, atk: 1.3 } },
            lv20: { appearanceId: 'dragon_lv3', name: '스텔라곤', statBoost: { hp: 1.25, sp: 1.15, atk: 1.35 } },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        description: "장난기 많은 바람의 정령들이 데이터 조각에 깃들어 태어난 존재입니다. 전광석화 같은 움직임으로 상대의 허를 찌르는 전략적인 전투를 즐기며, 전투의 흐름을 바꾸는 것을 가장 좋아합니다.",
        baseStats: { maxHp: 90, maxSp: 60, atk: 8 },
        growth: { hp: 8, sp: 5, atk: 1 },
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE.id], // 몸통박치기 제거
        evolution: {
            lv10: { appearanceId: 'rabbit_lv2', name: '버닉스', statBoost: { hp: 1.15, sp: 1.3, atk: 1.1 } },
            lv20: { appearanceId: 'rabbit_lv3', name: '하이버닉스', statBoost: { hp: 1.2, sp: 1.35, atk: 1.15 } },
        }
    },
    [PET_SPECIES.TURTLE]: {
        name: '새싹치',
        description: "고요한 숲, 생명의 나무 꼭대기에서 이슬을 머금고 태어난 숲의 수호자입니다. 두터운 깃털 방패는 어떤 공격도 막아낼 만큼 견고하며, 동료를 지키기 위해서라면 결코 물러서지 않는 끈기를 지녔습니다.",
        baseStats: { maxHp: 120, maxSp: 40, atk: 6 },
        growth: { hp: 15, sp: 2, atk: 1 },
        skill: SKILLS.FEATHER_SHIELD,
        initialSkills: [SKILLS.FEATHER_SHIELD.id], // 몸통박치기 제거
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.3, sp: 1.1, atk: 1.1 } },
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 1.35, sp: 1.15, atk: 1.15 } },
        }
    },
};