// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
    ELECTRIC_MONKEY: 'monkey',
    FOX: 'fox'
};

export const ELEMENTS = {
    FIRE: '불',
    WIND: '바람',
    GRASS: '풀',
    WATER: '물',
    ELECTRIC: '번개',
    EARTH: '흙'
};

const ELEMENT_CHART = {
    ['불']: { strongAgainst: ['풀', '바람'] },
    ['바람']: { strongAgainst: ['풀', '흙'] },
    ['풀']: { strongAgainst: ['물', '번개'] },
    ['물']: { strongAgainst: ['불', '흙'] },
    ['번개']: { strongAgainst: ['물', '바람'] },
    ['흙']: { strongAgainst: ['번개', '불'] }
};

const getPetElement = (appearanceId = '') => {
    if (appearanceId.includes('dragon')) return '불';
    if (appearanceId.includes('fox')) return '불';
    if (appearanceId.includes('rabbit')) return '바람';
    if (appearanceId.includes('bird') || appearanceId.includes('turtle')) return '풀';
    if (appearanceId.includes('monkey')) return '번개';
    return null;
};

const calculateDamage = (basePower, attackerPlayer, defenderPlayer, skillElement = null) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;

    let damage = basePower + (attacker.atk * 1.5);
    let multiplier = 1.0;
    let isEffective = false;

    if (skillElement) {
        const defenderElement = defender.element || getPetElement(defender.appearanceId);
        if (defenderElement && ELEMENT_CHART[skillElement]?.strongAgainst.includes(defenderElement)) {
            multiplier *= 1.2;
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
        id: 'tackle', name: '몸통박치기', cost: 0, type: 'basic', element: null, basePower: 20,
        description: '가장 기본적인 몸통박치기로 적에게 물리적인 피해를 줍니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 빗나갔습니다! 💨`;

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
            // focusCharge 소비는 BattlePage handleResolution에서 일괄 처리
            return log;
        },
    },

    // --- 공용 스킬 ---
    HARDEN: {
        id: 'harden', name: '단단해지기', cost: 15, type: 'common', element: null,
        description: '2턴간 자신의 방어력을 높여 받는 피해를 30% 줄입니다.',
        basePower: 0,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet; if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            attacker.status.defenseUpTurns = 2;
            return `'${attacker.name}'의 피부가 단단해졌습니다! 🛡️ (2턴간 방어력 강화)`;
        },
    },

    HEALING_PRAYER: {
        id: 'healing_prayer', name: '회복의 기도', cost: 25, type: 'common', element: null,
        description: '따뜻한 빛의 기운으로 자신의 최대 체력의 30%를 즉시 회복합니다.',
        basePower: 0,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet;
            const healAmount = Math.round(attacker.maxHp * 0.3);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
            return `'${attacker.name}'이(가) 체력을 ${healAmount} 회복했습니다! ✨`;
        },
    },

    TAUNT: {
        id: 'taunt', name: '도발', cost: 15, type: 'common', element: null,
        description: '우람한 소리를 내어 상대를 흥분시킵니다. 다음 공격이 50% 확률로 빗나갑니다.',
        basePower: 0,
        effect: (attackerPlayer, defenderPlayer) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            defender.status.blind = true;
            return `'${attacker.name}'의 도발! ${defender.name}은(는) 흥분해서 앞이 잘 보이지 않습니다! 🙈`;
        },
    },

    MIND_FOCUS: {
        id: 'mind_focus', name: '정신집중', cost: 10, type: 'common', element: null,
        description: '기를 모아 다음 턴의 공격 데미지를 2배로 강화합니다.',
        basePower: 0,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet; if (!attacker.status) attacker.status = {};
            attacker.status.focusCharge = 1;
            return `'${attacker.name}'이(가) 정신을 집중합니다! 다음 공격 강도가 배로 강해집니다! ⚡️`;
        }
    },

    SHIELD_BASH: {
        id: 'shield_bash', name: '방패치기', cost: 20, type: 'common', element: null,
        description: '방어력을 2턴간 높임과 동시에 상대를 가볍게 밀쳐내어 피해를 줍니다.',
        basePower: 15,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};
            attacker.status.defenseUp = true;
            attacker.status.defenseUpTurns = 2;

            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            return `'${attacker.name}'의 방패치기! 단단한 방어 태세를 갖추며 적에게 ${damage}의 피해를 주었습니다! 🛡️`;
        }
    },

    ENERGY_SIPHON: {
        id: 'energy_siphon', name: '에너지 사이펀', cost: 15, type: 'common', element: null,
        description: '적에게 약간의 피해를 입히고, 상대 최대 SP의 20%를 흡수하여 내 SP를 채웁니다.',
        basePower: 10,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
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
        id: 'sand_throw', name: '모래 뿌리기', cost: 10, type: 'common', element: null,
        description: '약한 피해를 주고, 30% 확률로 흙먼지를 일으켜 상대를 다음 공격이 50% 빗나가는 실명 상태로 만듭니다.',
        basePower: 15,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            let log = `'${attacker.name}'의 모래 뿌리기! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.3) {
                if (!defender.status) defender.status = {};
                defender.status.blind = true;
                log += ` 🙈 모래가 눈에 들어가 상대의 시야가 가려졌습니다!`;
            }
            return log;
        }
    },

    POISON_STING: {
        id: 'poison_sting', name: '독침', cost: 15, type: 'common', element: null,
        description: '40% 확률로 상대를 중독시켜 3턴간 매 턴 최대 체력의 6%씩 도트 피해를 줍니다.',
        basePower: 10,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
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
        id: 'static_shock', name: '정전기 방출', cost: 15, type: 'common', element: null,
        description: '약한 전기 충격을 주며, 15% 확률로 적을 1턴간 행동 불가 상태로 만듭니다.',
        basePower: 15,
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
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

    // --- 🐲 드래곤 (불) 스킬 ---
    FIERY_BREATH: {
        id: 'fiery_breath', name: '용의 숨결', cost: 30, type: 'signature', element: '불', basePower: 55,
        description: '맹렬한 화염을 뿜어 엄청난 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 뿜었습니다! 💨`;
            let { damage, isEffective } = calculateDamage(SKILLS.FIERY_BREATH.basePower, attackerPlayer, defenderPlayer, SKILLS.FIERY_BREATH.element);
            damage *= 1.2;
            let log = `'${attacker.name}'의 용의 숨결! 🔥`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; break;
                case 'EVADE': if (Math.random() < 0.3) damage = 0; break;
            }
            damage = Math.round(damage);
            if (damage > 0) { defender.hp = Math.max(0, defender.hp - damage); log += ` ${damage}의 피해!`; }
            attacker.status.recharging = true;
            // focusCharge 소비는 BattlePage에서 일괄 처리
            return log;
        },
    },
    DRAGON_CLAW: {
        id: 'dragon_claw', name: '용의 발톱', cost: 20, type: 'signature', element: '불', basePower: 35,
        description: '불꽃을 두른 예리한 발톱으로 할퀴어 상대의 방어를 일부 무시합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(35, attackerPlayer, defenderPlayer, '불');
            if (defenderAction === 'BRACE') damage *= 0.85;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 용의 발톱! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 피해!`;
        }
    },
    STELLAR_BLAST: {
        id: 'stellar_blast', name: '스텔라 블라스트', cost: 40, type: 'signature', element: '불', basePower: 60,
        description: '초고열의 항성 에너지를 폭발시킵니다. 30% 확률로 상대를 매 턴 최대 체력의 8%씩 화상 도트 피해 상태로 만듭니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(60, attackerPlayer, defenderPlayer, '불');
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            let log = `'${attacker.name}'의 스텔라 블라스트! 🌟 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 엄청난 피해!`;

            if (Math.random() < 0.3) {
                if (!defender.status) defender.status = {};
                defender.status.burned = true;
                log += ` 🔥 폭발의 열기로 상대가 화상을 입었습니다! (매 턴 최대 HP의 8% 도트)`;
            }
            return log;
        }
    },

    // --- 🐰 토끼 (바람) 스킬 ---
    QUICK_DISTURBANCE: {
        id: 'quick_disturbance', name: '재빠른 교란', cost: 15, type: 'signature', element: '바람', basePower: 20,
        description: '눈에 보이지 않는 빠른 속도로 맴돌아 상대를 50% 확률로 1턴 혼란시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage, isEffective } = calculateDamage(SKILLS.QUICK_DISTURBANCE.basePower, attackerPlayer, defenderPlayer, SKILLS.QUICK_DISTURBANCE.element);
            if (defenderAction === 'BRACE') damage *= 0.7;
            let log = `'${attacker.name}'의 재빠른 교란! 💨`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (Math.random() < 0.5) { defender.status.stunned = true; log += ` 💫 상대가 혼란에 빠졌다!`; }
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            log += ` ${Math.round(damage)}의 피해!`;
            return log;
        },
    },
    WIND_BLADE: {
        id: 'wind_blade', name: '바람의 칼날', cost: 20, type: 'signature', element: '바람', basePower: 30,
        description: '날카롭게 압축된 바람을 날립니다. 30% 확률로 치명타가 터져 피해가 1.5배가 됩니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(30, attackerPlayer, defenderPlayer, '바람');
            let log = `'${attacker.name}'의 바람의 칼날! 🌪️`;
            if (Math.random() < 0.3) {
                damage *= 1.5;
                log += ` 💥 [급소 강타!]`;
            }
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${log} ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 예리한 피해!`;
        }
    },
    TORNADO_SWEEP: {
        id: 'tornado_sweep', name: '토네이도 휩쓸기', cost: 40, type: 'signature', element: '바람', basePower: 60,
        description: '거대한 회오리바람을 일으켜 전장을 휩씁니다. 20% 확률로 적을 1턴 스턴시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(60, attackerPlayer, defenderPlayer, '바람');
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            let log = `'${attacker.name}'의 토네이도 휩쓸기! 🌪️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 광역 피해!`;
            if (Math.random() < 0.2) {
                if (!defender.status) defender.status = {};
                defender.status.stunned = true;
                log += ` 💫 강풍에 휩쓸려 상대가 기절했습니다!`;
            }
            return log;
        }
    },

    // --- 🐢 새싹치 (풀) 스킬 ---
    LEECH_SEED: {
        id: 'leech_seed', name: '씨뿌리기', cost: 20, type: 'signature', element: '풀', basePower: 30,
        description: '상대의 몸에 씨앗을 뿌려 준 피해의 60%만큼 자신의 체력을 회복합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(SKILLS.LEECH_SEED.basePower, attackerPlayer, defenderPlayer, SKILLS.LEECH_SEED.element);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            const heal = Math.round(damage * 0.6);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            return `'${attacker.name}'의 씨뿌리기! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}적에게 ${Math.round(damage)}의 피해를 주고 ${heal}만큼 체력을 흡수했다! 🌱`;
        },
    },
    VINE_WHIP: {
        id: 'vine_whip', name: '덩굴 채찍', cost: 20, type: 'signature', element: '풀', basePower: 35,
        description: '질기고 억센 덩굴을 휘둘러 상대에게 강력한 찰과상을 입힙니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(35, attackerPlayer, defenderPlayer, '풀');
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 덩굴 채찍! 🌿 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 찰진 피해!`;
        }
    },
    SOLAR_BEAM: {
        id: 'solar_beam', name: '솔라 빔', cost: 40, type: 'signature', element: '풀', basePower: 65,
        description: '태양의 에너지를 압축하여 파괴적인 빛의 광선을 발사합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective } = calculateDamage(65, attackerPlayer, defenderPlayer, '풀');
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 솔라 빔! ☀️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 엄청난 빛의 일격!`;
        }
    },

    // --- ⚡ 찌릿숭이 (번개) 스킬 ---
    SHOCK_SCRATCH: {
        id: 'shock_scratch', name: '따끔할퀴기', cost: 10, type: 'signature', element: '번개', basePower: 25,
        description: '번개를 두른 손톱으로 할큅니다. 20% 확률로 상대를 1턴 스턴시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage, isEffective } = calculateDamage(25, attackerPlayer, defenderPlayer, '번개');
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.2) defender.status.stunned = true;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 따끔할퀴기! ${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 마비되었다!' : ''}`;
        }
    },
    THUNDER_PUNCH: {
        id: 'thunder_punch', name: '찌릿펀치', cost: 20, type: 'signature', element: '번개', basePower: 40,
        description: '주먹에 고압 전류를 모아 묵직한 번개 타격을 날립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage } = calculateDamage(40, attackerPlayer, defenderPlayer, '번개');
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 찌릿펀치! ${Math.round(damage)}의 피해!`;
        }
    },
    THUNDERSTORM: {
        id: 'thunderstorm', name: '뇌우', cost: 40, type: 'signature', element: '번개', basePower: 65,
        description: '천둥구름을 불러내 거대한 번개를 내리칩니다. 40% 확률로 1턴 기절시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage } = calculateDamage(65, attackerPlayer, defenderPlayer, '번개');
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.4) defender.status.stunned = true;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `'${attacker.name}'의 뇌우! ${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 기절했습니다!' : ''}`;
        }
    },

    // --- 🦊 모롱이 (불) 스킬 ---
    REM_FIRE: {
        id: 'rem_fire', name: '잔불', cost: 15, type: 'signature', element: '불', basePower: 20,
        description: '30% 확률로 상대 최대 체력의 5% 즉발 추가 피해 + 화상 도트(최대 HP 8%/턴) 상태로 만듭니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 잔불! ...불씨가 흐려져 꺼졌습니다! 💨`;

            let { damage, isEffective } = calculateDamage(SKILLS.REM_FIRE.basePower, attackerPlayer, defenderPlayer, SKILLS.REM_FIRE.element);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);
            let log = `'${attacker.name}'의 잔불 습격! 적에게 ${damage}의 피해!`;

            if (Math.random() < 0.3) {
                const burnDamage = Math.round(defender.maxHp * 0.05);
                defender.hp = Math.max(0, defender.hp - burnDamage);
                defender.status.burned = true;
                log += ` 💥 [잔불 점화!] 추가 ${burnDamage}의 화상 피해 + 화상 도트 상태!`;
            }
            // focusCharge 소비는 BattlePage에서 일괄 처리
            return log;
        }
    },

    FLAME_DASH: {
        id: 'flame_dash', name: '불꽃 질주', cost: 25, type: 'signature', element: '불', basePower: 45,
        description: '불비비가 재빨리 달려들어 상대를 제압합니다. 상대의 회피와 방어를 완전히 무시합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 불꽃 질주! ...타이밍을 놓쳤습니다! 💨`;

            let damage = SKILLS.FLAME_DASH.basePower + (attacker.atk * 1.5);
            if (attacker.status?.focusCharge) damage *= 2.0;

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `🔥 "불비비가 재빨리 달려들어 상대를 제압한다!" '${attacker.name}'의 불꽃 질주! 적에게 ${damage}의 피해!`;
            if (defenderAction === 'BRACE' || defenderAction === 'EVADE') {
                log += ` (상대의 방어 및 회피 전술을 완벽히 무시하고 직격했습니다!)`;
            }
            // focusCharge 소비는 BattlePage에서 일괄 처리
            return log;
        }
    },

    UPHWA: {
        id: 'uphwa', name: '업화', cost: 40, type: 'signature', element: '불', basePower: 65,
        description: '체력 20% 이하 시 위력 2배 + 치명타 70% 확률. 화상 상태 적에게 추가 1.35배 피해를 주고 화상을 소거합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 업화! ...불꽃이 흩어졌습니다! 💨`;

            let { damage, isEffective } = calculateDamage(SKILLS.UPHWA.basePower, attackerPlayer, defenderPlayer, SKILLS.UPHWA.element);
            let log = `🌋 "궁지에 몰릴수록 더욱 거세게 타오른다." '${attacker.name}'의 업화 가동!`;

            if (attacker.hp <= attacker.maxHp * 0.2) {
                damage *= 2.0;
                if (Math.random() < 0.70) {
                    damage *= 1.5;
                    log = `💥 [역전의 치명타 폭발!!] ` + log;
                }
            }

            if (defenderAction === 'BRACE') damage *= 0.7;

            if (defender.status?.burned) {
                damage *= 1.35;
                log += ` (🔥 적의 몸에 깃든 잔불이 업화와 공명하여 폭발합니다!)`;
                defender.status.burned = false; // 화상 소거
            }

            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);
            log += ` 적에게 ${damage}의 파괴적인 피해! ${isEffective ? '🎯 [효과가 굉장했다!]' : ''}`;
            // focusCharge 소비는 BattlePage에서 일괄 처리
            return log;
        }
    }
};

export const PET_DATA = {
    ['dragon']: {
        name: '스타룡',
        element: '불',
        compatibleElements: ['불'],
        description: "별의 바다 깊은 곳에서 태어난 고대 용의 후예입니다. (🔥불 속성)",
        baseStats: { maxHp: 100, maxSp: 50, atk: 15 },
        growth: { hp: 20, sp: 5, atk: 5 },
        skill: SKILLS.FIERY_BREATH,
        initialSkills: [SKILLS.FIERY_BREATH.id],
        evolution: {
            lv10: { appearanceId: 'dragon_lv2', name: '은하룡', statBoost: { hp: 1.5, sp: 1.3, atk: 1.5 }, newSkill: SKILLS.DRAGON_CLAW },
            lv20: { appearanceId: 'dragon_lv3', name: '스텔라곤', statBoost: { hp: 2.2, sp: 1.6, atk: 2.2 }, newSkill: SKILLS.STELLAR_BLAST },
        }
    },
    ['rabbit']: {
        name: '버니니',
        element: '바람',
        compatibleElements: ['바람'],
        description: "장난기 많은 바람의 정령들이 데이터 조각에 깃들어 태어난 존재입니다. (💨바람 속성)",
        baseStats: { maxHp: 90, maxSp: 60, atk: 10 },
        growth: { hp: 15, sp: 8, atk: 4 },
        skill: SKILLS.QUICK_DISTURBANCE,
        initialSkills: [SKILLS.QUICK_DISTURBANCE.id],
        evolution: {
            lv10: { appearanceId: 'rabbit_lv2', name: '버닉스', statBoost: { hp: 1.4, sp: 1.6, atk: 1.4 }, newSkill: SKILLS.WIND_BLADE },
            lv20: { appearanceId: 'rabbit_lv3', name: '하이버닉스', statBoost: { hp: 1.9, sp: 2.2, atk: 1.8 }, newSkill: SKILLS.TORNADO_SWEEP },
        }
    },
    ['turtle']: {
        name: '새싹치',
        element: '풀',
        compatibleElements: ['풀'],
        description: "고요한 숲, 생명의 나무 꼭대기에서 이슬을 머금고 태어난 숲의 수호자입니다. (🌿풀 속성)",
        baseStats: { maxHp: 120, maxSp: 40, atk: 8 },
        growth: { hp: 25, sp: 4, atk: 3 },
        skill: SKILLS.LEECH_SEED,
        initialSkills: [SKILLS.LEECH_SEED.id],
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.6, sp: 1.2, atk: 1.3 }, newSkill: SKILLS.VINE_WHIP },
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 2.3, sp: 1.5, atk: 1.7 }, newSkill: SKILLS.SOLAR_BEAM },
        }
    },
    ['monkey']: {
        name: '찌릿숭이',
        element: '번개',
        compatibleElements: ['번개'],
        description: "전기를 다루는 재주가 많은 원숭이입니다. (⚡번개 속성)",
        baseStats: { maxHp: 85, maxSp: 70, atk: 12 },
        growth: { hp: 18, sp: 10, atk: 6 },
        skill: SKILLS.SHOCK_SCRATCH,
        initialSkills: [SKILLS.SHOCK_SCRATCH.id],
        evolution: {
            lv10: { appearanceId: 'monkey_lv2', name: '지직숭', statBoost: { hp: 1.5, sp: 1.5, atk: 1.6 }, newSkill: SKILLS.THUNDER_PUNCH },
            lv20: { appearanceId: 'monkey_lv3', name: '콰릉숭', statBoost: { hp: 2.0, sp: 2.1, atk: 2.3 }, newSkill: SKILLS.THUNDERSTORM },
        }
    },
    ['fox']: {
        name: '모롱이',
        element: '불',
        compatibleElements: ['불'],
        description: "사람이 좋아서 풀숲에서 튀어나온 모닥불여우입니다. (🔥불 속성)",
        baseStats: { maxHp: 110, maxSp: 50, atk: 11 },
        growth: { hp: 23, sp: 5, atk: 4 },
        skill: SKILLS.REM_FIRE,
        initialSkills: [SKILLS.REM_FIRE.id],
        evolution: {
            lv10: { appearanceId: 'fox_lv2', name: '불비비', statBoost: { hp: 1.5, sp: 1.4, atk: 1.5 }, newSkill: SKILLS.FLAME_DASH },
            lv20: { appearanceId: 'fox_lv3', name: '인페르노', statBoost: { hp: 2.2, sp: 1.8, atk: 2.1 }, newSkill: SKILLS.UPHWA },
        }
    },
};

export const canLearnSkill = (pet, skill) => {
    const petData = PET_DATA[pet.species];
    if (skill.element !== null && petData && !petData.compatibleElements.includes(skill.element)) {
        return { canLearn: false, reason: `이 펫은 [${skill.element}] 속성 스킬을 배울 수 없습니다!` };
    }
    if (skill.type === 'basic' || skill.type === 'common') {
        return { canLearn: true, reason: '' };
    }
    const currentStage = parseInt(pet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    let requiredStage = 1;
    if (petData && petData.evolution) {
        if (petData.evolution.lv10?.newSkill?.id === skill.id) requiredStage = 2;
        if (petData.evolution.lv20?.newSkill?.id === skill.id) requiredStage = 3;
    }
    if (currentStage < requiredStage) {
        let stageName = requiredStage === 2 ? '1차 진화' : '최종 진화';
        return { canLearn: false, reason: `잠겨있는 스킬입니다! 최소 [${stageName}] 단계 이상으로 진화해야 비법노트로 배울 수 있습니다.` };
    }
    return { canLearn: true, reason: '' };
};
