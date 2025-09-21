// src/features/pet/petData.js

/**
 * 펫의 종류, 스킬, 진화 정보 등 모든 데이터를 관리하는 파일입니다.
 * 새로운 펫을 추가하거나 밸런스를 조정할 때 이 파일을 수정합니다.
 */

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle', // ◀◀◀ bird에서 다시 turtle로 변경 (DB 스키마와 일치)
};

export const SKILLS = {
    TACKLE: {
        id: 'tackle',
        name: '몸통박치기',
        cost: 10,
        type: 'common', // 스킬 타입 추가
        description: '기본적인 몸통박치기로 20의 피해를 줍니다.',
        effect: (attacker, defender) => {
            const damage = 20;
            defender.hp -= damage;
            return `'${attacker.name}'의 몸통박치기! ${defender.name}에게 ${damage}의 피해!`;
        },
    },
    // 용 스킬
    FIERY_BREATH: {
        id: 'fiery_breath',
        name: '용의 숨결',
        cost: 30,
        type: 'signature',
        description: '강력한 화염 피해를 입히지만, 사용 후 다음 턴에 행동할 수 없습니다.',
        effect: (attacker, defender) => {
            const damage = 50 * (1 + (attacker.status.focusCharge || 0) * 0.5);
            attacker.status.recharging = true; // 다음 턴 행동 불가
            defender.hp -= Math.round(damage);
            return `'${attacker.name}'의 강력한 용의 숨결! ${defender.name}에게 ${Math.round(damage)}의 피해!`;
        },
    },
    // 토끼 스킬
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
    // 새(거북이) 스킬
    FEATHER_SHIELD: {
        id: 'feather_shield',
        name: '깃털 방패',
        cost: 25,
        type: 'signature',
        description: '2턴 동안 받는 모든 피해를 70% 감소시킵니다.',
        effect: (attacker) => {
            attacker.status.defenseBuffTurns = 2; // 2턴 동안 방어 버프
            return `'${attacker.name}'가 깃털 방패로 몸을 감쌉니다!`;
        },
    }
};

export const PET_DATA = {
    [PET_SPECIES.DRAGON]: {
        name: '스타룡',
        description: '강력한 한 방을 가진 공격형 펫입니다.',
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id, SKILLS.TACKLE.id],
        evolution: {
            lv20: { appearanceId: 'dragon_lv2', name: '은하룡' },
            lv40: { appearanceId: 'dragon_lv3', name: '스텔라곤' },
        }
    },
    [PET_SPECIES.RABBIT]: {
        name: '버니니',
        description: '배틀을 유리하게 이끄는 지원형 펫입니다.',
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE, SKILLS.TACKLE.id],
        evolution: {
            lv20: { appearanceId: 'rabbit_lv2', name: '버닉스' },
            lv40: { appearanceId: 'rabbit_lv3', name: '하이버닉스' },
        }
    },
    [PET_SPECIES.TURTLE]: {
        name: '새싹치',
        description: '어떤 공격도 버텨내는 방어형 펫입니다.',
        skill: SKILLS.FEATHER_SHIELD,
        initialSkills: [SKILLS.FEATHER_SHIELD, SKILLS.TACKLE.id],
        evolution: {
            lv20: { appearanceId: 'bird_lv2', name: '꽃잎치' },
            lv40: { appearanceId: 'bird_lv3', name: '열매치' },
        }
    },
};