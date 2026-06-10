// src/features/pet/petData.js

export const PET_SPECIES = {
    DRAGON: 'dragon',
    RABBIT: 'rabbit',
    TURTLE: 'turtle',
    ELECTRIC_MONKEY: 'monkey',
    FOX: 'fox',
    FROG: 'frog',
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

const calculateDamage = (basePower, attackerPlayer, defenderPlayer, skillElement = null, skillMult = 1.0, atkMult = 0.7) => {
    const attacker = attackerPlayer.pet;
    const defender = defenderPlayer.pet;

    // [v14] skillMult: 스킬 고유 배율, atkMult: 컨셉별 ATK 계수
    let damage = (basePower * skillMult) + (attacker.atk * atkMult);
    let multiplier = 1.0;
    let isEffective = false;
    let isCritical = false;

    // 상성 판정 (1.3배, 로그용 플래그 반환)
    if (skillElement) {
        const defenderElement = defender.element || getPetElement(defender.appearanceId);
        if (defenderElement && ELEMENT_CHART[skillElement]?.strongAgainst.includes(defenderElement)) {
            multiplier *= 1.3;
            isEffective = true;
        }
    }

    // 치명타: 기본 10% 확률 × 1.5배 (타이틀 ruler_of_the_league는 +5% 추가)
    const critChance = (attackerPlayer.equippedTitle === 'ruler_of_the_league') ? 0.15 : 0.10;
    if (Math.random() < critChance) {
        multiplier *= 1.5;
        isCritical = true;
    }

    if (attacker.status?.focusCharge) multiplier *= 2.0;
    if (defender.status?.defenseUp) multiplier *= 0.7;
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

export const SKILLS = {
    TACKLE: {
        id: 'tackle', name: '몸통박치기', cost: 0, type: 'basic', element: null, basePower: 20,
        description: '가장 기본적인 몸통박치기로 적에게 물리적인 피해를 줍니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};

            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 몸통박치기! ...하지만 도발에 넘어가 빗나갔습니다! 💨`;

            let { damage, isCritical } = calculateDamage(SKILLS.TACKLE.basePower, attackerPlayer, defenderPlayer, SKILLS.TACKLE.element);
            if (isCritical) log = `💥 [치명타!] ` + log;
            let log = `'${attacker.name}'의 몸통박치기!`;

            if (attacker.status?.focusCharge) log += ` ⚡️ 강력한 한방!`;
            // [v14] 치명타는 calculateDamage 내부에서 처리됨

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
        id: 'healing_prayer', name: '회복의 기도', cost: 35, type: 'common', element: null, // [밸런스] 25→35 (최대HP 30% 회복 고효율)
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
        id: 'mind_focus', name: '정신집중', cost: 15, type: 'common', element: null,
        // [v13] focusCharge(×2) 효과는 BattlePage handleResolution에서 모든 공격(기본기+스킬)에 일괄 적용됨
        description: '기를 모아 다음 턴의 모든 공격(기본기 및 스킬 포함) 데미지를 2배로 강화합니다.',
        basePower: 0,
        effect: (attackerPlayer) => {
            const attacker = attackerPlayer.pet; if (!attacker.status) attacker.status = {};
            attacker.status.focusCharge = 1;
            return `'${attacker.name}'이(가) 정신을 집중합니다! 다음 턴 모든 공격이 2배로 강해집니다! ⚡️`;
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

            let { damage } = calculateDamage(15, attackerPlayer, defenderPlayer, null, 1.0, 0.5);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);

            defender.hp = Math.max(0, defender.hp - damage);
            return `'${attacker.name}'의 방패치기! 단단한 방어 태세를 갖추며 적에게 ${damage}의 피해를 주었습니다! 🛡️`;
        }
    },

    ENERGY_SIPHON: {
        id: 'energy_siphon', name: '에너지 사이펀', cost: 20, type: 'common', element: null, // [밸런스] 15→20 (피해+SP흡수 복합효과)
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
        id: 'fiery_breath', name: '용의 숨결', cost: 40, type: 'signature', element: '불', basePower: 55,
        // [공격형 1차 고유기] skillMult 2.5 — 반동 페널티를 감수한 강타. 다음 턴 행동 불가.
        description: '맹렬한 화염을 뿜어 엄청난 피해를 주지만, 반동으로 다음 턴 행동 불가 상태가 됩니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {}; if (!defender.status) defender.status = {};
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 용의 숨결! ...하지만 엉뚱한 방향으로 뿜었습니다! 💨`;
            let { damage, isEffective, isCritical: breathCrit } = calculateDamage(SKILLS.FIERY_BREATH.basePower, attackerPlayer, defenderPlayer, SKILLS.FIERY_BREATH.element, 5.5, 1.2); // [밸런스] sm 2.5→5.5, am 0.7→1.2 (반동 페널티 보상, 기본공격 상회)
            let log = `'${attacker.name}'의 용의 숨결! 🔥`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            switch (defenderAction) {
                case 'BRACE': damage *= 0.7; break;
                case 'EVADE': if (Math.random() < 0.3) damage = 0; break;
            }
            damage = Math.round(damage);
            if (breathCrit) log = `💥 [치명타!] ` + log;
            if (damage > 0) { defender.hp = Math.max(0, defender.hp - damage); log += ` ${damage}의 피해!`; }
            attacker.status.recharging = true;
            return log;
        },
    },
    DRAGON_CLAW: {
        id: 'dragon_claw', name: '용의 발톱', cost: 25, type: 'signature', element: '불', basePower: 35,
        // [공격형 1차 스킬] skillMult 2.7 — 방어 무시 효과 보정
        description: '불꽃을 두른 예리한 발톱으로 할퀴어 상대의 방어를 일부 무시합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: clawCrit } = calculateDamage(35, attackerPlayer, defenderPlayer, '불', 2.7, 1.5); // [밸런스] am 0.7→1.5 (ATK 활용 극대화, 방어무시 실효 강화)
            if (defenderAction === 'BRACE') damage *= 0.60; // [밸런스] 방어무시 강화 0.85→0.60 (방어 반쯤 꿰뚫는 개념)
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${clawCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 용의 발톱! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 피해!`;
        }
    },
    STELLAR_BLAST: {
        id: 'stellar_blast', name: '스텔라 블라스트', cost: 65, type: 'signature', element: '불', basePower: 60, // [밸런스] sm 5.0→5.5, 공격형 궁극기 위상 강화
        description: '초고열의 항성 에너지를 폭발시킵니다. 30% 확률로 상대를 매 턴 최대 체력의 8%씩 화상 도트 피해 상태로 만듭니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: stelCrit } = calculateDamage(60, attackerPlayer, defenderPlayer, '불', 7.0, 1.2); // [밸런스] sm 5.5→7.0, am 0.7→1.2 (궁극기 위상, 500+ 보장)
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            let log = `${stelCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 스텔라 블라스트! 🌟 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 엄청난 피해!`;

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
        id: 'quick_disturbance', name: '재빠른 교란', cost: 18, type: 'signature', element: '바람', basePower: 20, // [밸런스] CC 강화에 따라 cost 12→18
        description: '눈에 보이지 않는 빠른 속도로 맴돌아 상대를 70% 확률로 1턴 혼란시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage, isEffective, isCritical: qdCrit } = calculateDamage(SKILLS.QUICK_DISTURBANCE.basePower, attackerPlayer, defenderPlayer, SKILLS.QUICK_DISTURBANCE.element, 1.1, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            let log = `'${attacker.name}'의 재빠른 교란! 💨`;
            if (isEffective) log += ` 🎯 [효과가 굉장했다!]`;
            if (Math.random() < 0.7) { defender.status.stunned = true; log += ` 💫 상대가 혼란에 빠졌다!`; }
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            if (qdCrit) log = `💥 [치명타!] ` + log;
            log += ` ${Math.round(damage)}의 피해!`;
            return log;
        },
    },
    WIND_BLADE: {
        id: 'wind_blade', name: '바람의 칼날', cost: 28, type: 'signature', element: '바람', basePower: 30, // [v13] 기교형 중간기 SP28, skillMult 1.6
        description: '날카롭게 압축된 바람을 날립니다. 30% 확률로 치명타가 터져 피해가 1.5배가 됩니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: wbCrit } = calculateDamage(30, attackerPlayer, defenderPlayer, '바람', 3.4, 0.6);
            let log = `'${attacker.name}'의 바람의 칼날! 🌪️`;
            if (Math.random() < 0.3) {
                damage *= 1.5;
                log += ` 💥 [급소 강타!]`;
            }
            if (wbCrit) log = `💥 [치명타!] ` + log;
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${log} ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 예리한 피해!`;
        }
    },
    TORNADO_SWEEP: {
        id: 'tornado_sweep', name: '토네이도 휩쓸기', cost: 70, type: 'signature', element: '바람', basePower: 60, // [밸런스] 스턴 50% 강화, cost 65→70
        description: '거대한 회오리바람을 일으켜 전장을 휩씁니다. 50% 확률로 적을 1턴 스턴시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: tornadoCrit } = calculateDamage(60, attackerPlayer, defenderPlayer, '바람', 5.0, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            let log = `${tornadoCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 토네이도 휩쓸기! 🌪️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 광역 피해!`;
            if (Math.random() < 0.5) {
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
            let { damage, isEffective, isCritical: seedCrit } = calculateDamage(SKILLS.LEECH_SEED.basePower, attackerPlayer, defenderPlayer, SKILLS.LEECH_SEED.element, 1.6, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            const heal = Math.round(damage * 0.6);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            return `${seedCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 씨뿌리기! ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}적에게 ${Math.round(damage)}의 피해를 주고 ${heal}만큼 체력을 흡수했다! 🌱`;
        },
    },
    VINE_WHIP: {
        id: 'vine_whip', name: '덩굴 채찍', cost: 28, type: 'signature', element: '풀', basePower: 35, // [v13] 수비형 중간기 SP28, skillMult 1.8
        description: '질기고 억센 덩굴을 휘둘러 상대에게 강력한 찰과상을 입힙니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: vineCrit } = calculateDamage(35, attackerPlayer, defenderPlayer, '풀', 3.4, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${vineCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 덩굴 채찍! 🌿 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 찰진 피해!`;
        }
    },
    SOLAR_BEAM: {
        id: 'solar_beam', name: '솔라 빔', cost: 65, type: 'signature', element: '풀', basePower: 65, // [v13] 최종기 SP65, skillMult 3.0
        description: '태양의 에너지를 압축하여 파괴적인 빛의 광선을 발사합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical: solarCrit } = calculateDamage(65, attackerPlayer, defenderPlayer, '풀', 5.0, 0.55);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${solarCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 솔라 빔! ☀️ ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${Math.round(damage)}의 엄청난 빛의 일격!`;
        }
    },

    // --- ⚡ 찌릿숭이 (번개) 스킬 ---
    SHOCK_SCRATCH: {
        id: 'shock_scratch', name: '따끔할퀴기', cost: 10, type: 'signature', element: '번개', basePower: 25, // [밸런스] 유지 (CC위주, 낮은 비용 정당)
        description: '번개를 두른 손톱으로 할큅니다. 20% 확률로 상대를 1턴 스턴시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage, isEffective, isCritical } = calculateDamage(25, attackerPlayer, defenderPlayer, '번개', 1.35, 0.7);
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.2) defender.status.stunned = true;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 따끔할퀴기! ${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 마비되었다!' : ''}`;
        }
    },
    THUNDER_PUNCH: {
        id: 'thunder_punch', name: '찌릿펀치', cost: 30, type: 'signature', element: '번개', basePower: 40, // [v13] 공격형 중간기 SP30, skillMult 1.8
        description: '주먹에 고압 전류를 모아 묵직한 번개 타격을 날립니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isCritical: punchCrit } = calculateDamage(40, attackerPlayer, defenderPlayer, '번개', 3.8, 0.7);
            if (defenderAction === 'BRACE') damage *= 0.7;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${punchCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 찌릿펀치! ⚡ ${Math.round(damage)}의 피해!`;
        }
    },
    THUNDERSTORM: {
        id: 'thunderstorm', name: '뇌우', cost: 70, type: 'signature', element: '번개', basePower: 65, // [v13] 공격형 최종기 SP70, skillMult 3.5 (40%스턴 포함)
        description: '천둥구름을 불러내 거대한 번개를 내리칩니다. 40% 확률로 1턴 기절시킵니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};
            let { damage, isCritical: stormCrit } = calculateDamage(65, attackerPlayer, defenderPlayer, '번개', 5.0, 0.7);
            if (defenderAction === 'BRACE') damage *= 0.7;
            if (Math.random() < 0.4) defender.status.stunned = true;
            defender.hp = Math.max(0, defender.hp - Math.round(damage));
            return `${stormCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 뇌우! ⚡🌩️ ${Math.round(damage)}의 피해! ${defender.status?.stunned ? '💫 기절했습니다!' : ''}`;
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

            let { damage, isEffective, isCritical: remCrit } = calculateDamage(SKILLS.REM_FIRE.basePower, attackerPlayer, defenderPlayer, SKILLS.REM_FIRE.element, 1.1, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);
            let log = `${remCrit ? '💥 [치명타!] ' : ''}'${attacker.name}'의 잔불 습격! 적에게 ${damage}의 피해!`;

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

            let { damage, isCritical: dashCrit } = calculateDamage(SKILLS.FLAME_DASH.basePower, attackerPlayer, defenderPlayer, '불', 2.8, 0.6); // [밸런스] sm 3.15→2.8 (방어완전무시 보정 너프)
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            let log = `${dashCrit ? '💥 [치명타!] ' : ''}🔥 '${attacker.name}'의 불꽃 질주! 적에게 ${damage}의 피해!`;
            if (defenderAction === 'BRACE' || defenderAction === 'EVADE') {
                log += ` (상대의 방어 및 회피 전술을 완벽히 무시하고 직격했습니다!)`;
            }
            // focusCharge 소비는 BattlePage에서 일괄 처리
            return log;
        }
    },

    UPHWA: {
        id: 'uphwa', name: '업화', cost: 70, type: 'signature', element: '불', basePower: 65, // [v13] 기교형 최종기 SP70, skillMult 3.2 (조건부 2배)
        description: '체력 20% 이하 시 위력 2배 + 치명타 70% 확률. 화상 상태 적에게 추가 1.35배 피해를 주고 화상을 소거합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (checkBlindMiss(attacker)) return `'${attacker.name}'의 업화! ...불꽃이 흩어졌습니다! 💨`;

            let { damage, isEffective, isCritical: uphwaCrit } = calculateDamage(SKILLS.UPHWA.basePower, attackerPlayer, defenderPlayer, SKILLS.UPHWA.element, 5.0, 0.6);
            let log = `${uphwaCrit ? '💥 [치명타!] ' : ''}🌋 '${attacker.name}'의 업화! 궁지에서 더욱 거세게 타오른다!`;

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
    },
    // --- 🐸 개구리 (물) 스킬 ---
    WATER_BALL: {
        id: 'water_ball', name: '물공 던지기', cost: 15, type: 'signature', element: '물', basePower: 25,
        description: '응축된 물의 기운을 둥글게 뭉쳐 적에게 던져 물 속성 피해를 줍니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            let { damage, isEffective, isCritical } = calculateDamage(25, attackerPlayer, defenderPlayer, '물', 1.5, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);
            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 물공 던지기! 💧 ${isEffective ? '🎯 [효과가 굉장했다!] ' : ''}${damage}의 피해!`;
        }
    },

    COUNTER_STANCE: {
        id: 'counter_stance', name: '반격태세', cost: 25, type: 'signature', element: '물', basePower: 30,
        description: '부들을 휘둘러 피해를 주고, 다음 턴 상대방 공격의 30%를 되돌려주는 반격 자세를 취합니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!attacker.status) attacker.status = {};

            let { damage, isCritical } = calculateDamage(30, attackerPlayer, defenderPlayer, '물', 1.8, 0.6);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            // 반격 버프 부여 (BattlePage에서 공격 받을 때 이 비율만큼 반사하도록 구현)
            attacker.status.counterReady = 0.3;

            return `${isCritical ? '💥 [치명타!] ' : ''}'${attacker.name}'의 반격태세! 적에게 ${damage}의 피해를 주고 ⚔️ 매서운 눈빛으로 적을 노려봅니다! (반격 준비)`;
        }
    },

    ULTIMATE_SECRET: {
        id: 'ultimate_secret', name: '오의필살', cost: 90, type: 'signature', element: null, basePower: 70,  // [밸런스] cost 75→90(SP 대가), bp 65→70, sm 4.8→6.5 (최강 기술 포지션 확정)
        description: '갓을 깊게 눌러쓰고 눈에 보이지 않는 속도로 적의 사각을 베어 가릅니다. 묵직한 검기가 전장을 갈라버리는 무속성의 치명적인 일격입니다.',
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;

            // 무속성(element: null)이므로 상성을 타지 않음. [밸런스] sm 6.5→9.5 — cost 90, 무CC, 무속성 최강기 포지션 확정 (스텔라블라스트 790 상회)
            let { damage, isCritical } = calculateDamage(70, attackerPlayer, defenderPlayer, null, 9.5, 0.8);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            return `${isCritical ? '💥 [오의 폭발!!] ' : ''}'${attacker.name}'의 오의필살! ⚔️✨ 전장을 가르는 섬광이 적을 꿰뚫어 ${damage}의 엄청난 피해를 입혔습니다!`;
        }
    },

    REED_BOW: {
        id: 'reed_bow', name: '부들화살', cost: 35, type: 'signature', element: '물', basePower: 15,
        description: '부들 화살을 쏴 약간의 피해를 주고, 상대를 2턴간 속박하여 방어 행동과 도망치기를 봉쇄합니다.', // [밸런스] 3턴→2턴
        effect: (attackerPlayer, defenderPlayer, defenderAction) => {
            const attacker = attackerPlayer.pet; const defender = defenderPlayer.pet;
            if (!defender.status) defender.status = {};

            let { damage, isCritical } = calculateDamage(15, attackerPlayer, defenderPlayer, '물', 1.0, 0.5);
            if (defenderAction === 'BRACE') damage *= 0.7;
            damage = Math.round(damage);
            defender.hp = Math.max(0, defender.hp - damage);

            // 속박 상태이상 부여 [밸런스] 3턴→2턴
            defender.status.bound = true;
            defender.status.boundTurns = 2;

            return `${isCritical ? '💥 [급소 강타!] ' : ''}'${attacker.name}'의 부들활! 🏹 ${damage}의 피해! 질긴 덩굴이 상대를 꽁꽁 묶어버렸습니다! (2턴간 방어/도망 불가)`;
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
        growth: { hp: 25, sp: 5, atk: 4 },           // [밸런스] atk 성장치 3→4
        skill: SKILLS.LEECH_SEED,
        initialSkills: [SKILLS.LEECH_SEED.id],
        evolution: {
            lv10: { appearanceId: 'bird_lv2', name: '꽃잎치', statBoost: { hp: 1.6, sp: 1.2, atk: 1.35 }, newSkill: SKILLS.VINE_WHIP },  // [밸런스] atk 1.3→1.35
            lv20: { appearanceId: 'bird_lv3', name: '열매치', statBoost: { hp: 2.3, sp: 1.5, atk: 2.0 }, newSkill: SKILLS.SOLAR_BEAM },   // [밸런스] atk 1.7→2.0
        }
    },
    ['monkey']: {
        name: '찌릿숭이',
        element: '번개',
        compatibleElements: ['번개'],
        description: "전기를 다루는 재주가 많은 원숭이입니다. (⚡번개 속성)",
        baseStats: { maxHp: 85, maxSp: 70, atk: 12 },
        growth: { hp: 18, sp: 10, atk: 4 },           // [밸런스] atk 성장치 6→4 (콰릉숭 너프)
        skill: SKILLS.SHOCK_SCRATCH,
        initialSkills: [SKILLS.SHOCK_SCRATCH.id],
        evolution: {
            lv10: { appearanceId: 'monkey_lv2', name: '지직숭', statBoost: { hp: 1.5, sp: 1.5, atk: 1.5 }, newSkill: SKILLS.THUNDER_PUNCH },   // [밸런스] atk 1.6→1.5
            lv20: { appearanceId: 'monkey_lv3', name: '콰릉숭', statBoost: { hp: 2.0, sp: 2.1, atk: 1.9 }, newSkill: SKILLS.THUNDERSTORM },     // [밸런스] atk 2.3→1.9 (너프)
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

    ['frog']: {
        name: '미소구리',
        element: '물',
        compatibleElements: ['물'],
        description: "무과 급제를 위해 수련하는 해맑은 아기 개구리입니다. (💧물 속성)",
        baseStats: { maxHp: 105, maxSp: 55, atk: 10 },  // [밸런스] atk 11→10 (초기 ATK 소폭 너프)
        growth: { hp: 20, sp: 7, atk: 4 },               // [밸런스] atk 성장 5→4, sp 성장 6→7 (공격형→균형형)
        skill: SKILLS.WATER_BALL,
        initialSkills: [SKILLS.WATER_BALL.id],
        evolution: {
            lv10: {
                appearanceId: 'frog_lv2',
                name: '부들구리',
                statBoost: { hp: 1.5, sp: 1.5, atk: 1.4 },  // [밸런스] atk 1.5→1.4, sp 1.4→1.5 (SP 특화)
                newSkill: SKILLS.COUNTER_STANCE
            },
            lv20: {
                appearanceId: 'frog_lv3',
                name: '별감구리',
                statBoost: { hp: 2.1, sp: 2.0, atk: 2.0 },  // [밸런스] atk 2.2→2.0, sp 1.9→2.0
                newSkills: [SKILLS.ULTIMATE_SECRET.id, SKILLS.REED_BOW.id] // 스킬 2개 동시 획득
            },
        }
    }
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
