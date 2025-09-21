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
        cost: 10,
        type: 'common',
        description: '기본적인 몸통박치기로 20의 피해를 줍니다.',
        effect: (attacker, defender) => {
            const damage = 20;
            defender.hp -= damage;
            return `'${attacker.name}'의 몸통박치기! ${defender.name}에게 ${damage}의 피해!`;
        },
    },
    // ▼▼▼ [신규] 공용 스킬 3종 추가 ▼▼▼
    HARDEN: {
        id: 'harden',
        name: '단단해지기',
        cost: 20,
        type: 'common',
        description: '2턴 동안 자신의 방어력을 높여 받는 피해를 30% 감소시킵니다.',
        effect: (attacker) => {
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
        effect: (attacker) => {
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
        effect: (attacker, defender) => {
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
        description: '강력한 화염 피해를 입히지만, 사용 후 다음 턴에 행동할 수 없습니다.',
        effect: (attacker, defender) => {
            const damage = 50 * (1 + (attacker.status.focusCharge || 0) * 0.5);
            attacker.status.recharging = true;
            defender.hp -= Math.round(damage);
            return `'${attacker.name}'의 강력한 용의 숨결! ${defender.name}에게 ${Math.round(damage)}의 피해!`;
        },
    },
    QUICK_DISTURBANCE: {
        id: 'quick_disturbance',
        name: '재빠른 교란',
        cost: 15,
        type: 'signature',
        description: '낮은 피해를 주고 50% 확률로 상대를 행동 불능으로 만듭니다.',
        effect: (attacker, defender) => {
            const damage = 15 * (1 + (attacker.status.focusCharge || 0) * 0.5);
            defender.hp -= Math.round(damage);
            let log = `'${attacker.name}'의 재빠른 교란! ${defender.name}에게 ${Math.round(damage)}의 피해!`;
            if (Math.random() < 0.5) {
                defender.status.stunned = true;
                log += ` ${defender.name}은(는) 혼란에 빠졌다!`;
            }
            return log;
        },
    },
    FEATHER_SHIELD: {
        id: 'feather_shield',
        name: '깃털 방패',
        cost: 25,
        type: 'signature',
        description: '2턴 동안 받는 모든 피해를 70% 감소시킵니다.',
        effect: (attacker) => {
            attacker.status.defenseBuffTurns = 2;
            return `'${attacker.name}'가 깃털 방패로 몸을 감쌉니다!`;
        },
    }
};

export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        description: '강력한 한 방을 가진 공격형 펫입니다.',
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.TACKLE.id, SKILLS.FIERY_BREATH.id], // 기본 스킬 설정
        evolution: {
            lv20: { appearanceId: 'dragon_lv2', name: '은하룡' },
            lv40: { appearanceId: 'dragon_lv3', name: '스텔라곤' },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        description: '배틀을 유리하게 이끄는 지원형 펫입니다.',
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.TACKLE.id, SKILLS.QUICK_DISTURBANCE.id],
        evolution: {
            lv20: { appearanceId: 'rabbit_lv2', name: '버닉스' },
            lv40: { appearanceId: 'rabbit_lv3', name: '하이버닉스' },
        }
    },
    [PET_SPECIES.TURTLE]: {
        name: '새싹치',
        description: '어떤 공격도 버텨내는 방어형 펫입니다.',
        skill: SKILLS.FEATHER_SHIELD,
        initialSkills: [SKILLS.TACKLE.id, SKILLS.FEATHER_SHIELD.id],
        evolution: {
            lv20: { appearanceId: 'bird_lv2', name: '꽃잎치' },
            lv40: { appearanceId: 'bird_lv3', name: '열매치' },
        }
    },
};