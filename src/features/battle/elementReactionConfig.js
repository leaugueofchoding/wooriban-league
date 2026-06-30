// src/features/battle/elementReactionConfig.js
// M4_REACTION_BALANCE_CONFIG
// 원소반응의 배율/고정 피해/CC/흔적 소모 규칙을 한 곳에서 관리합니다.
// 실제 전투 연결은 아직 하지 않습니다.

export const ELEMENT_REACTION_BALANCE_CONFIG = Object.freeze({
    version: 1,

    traces: Object.freeze({
        defaultTurns: 2,
        refreshOnApply: true,
        consumeMatchedTraceOnReaction: true,
    }),

    reactions: Object.freeze({
        electroCharged: Object.freeze({
            elements: ['water', 'lightning'],
            label: '감전',
            damage: Object.freeze({
                multiplier: 1.35,
                flatDamageRatio: 0.06,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_ELECTRO_CHARGED',
            log: '💧⚡ 물 기운에 전류가 퍼져 감전 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'bonus_damage',
                tuningGroup: 'water_lightning',
                notes: '감전은 M10 1차에서는 하드 CC보다 추가 피해 중심으로 둔다.',
            }),
        }),

        frozen: Object.freeze({
            elements: ['water', 'ice'],
            label: '빙결',
            damage: Object.freeze({
                multiplier: 1,
                flatDamageRatio: 0,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'frozen', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_FROZEN',
            log: '💧❄️ 물 기운이 얼어붙어 빙결 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'hard_cc_candidate',
                tuningGroup: 'water_ice',
                notes: 'M11 하드 CC 규칙 정리 전까지 실제 적용은 보수적으로 다룬다.',
            }),
        }),

        vaporize: Object.freeze({
            elements: ['water', 'fire'],
            label: '증발',
            damage: Object.freeze({
                multiplier: 1.55,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_VAPORIZE',
            log: '💧🔥 뜨거운 열기가 물 기운을 증발시켜 피해가 증폭됩니다!',
            adminMeta: Object.freeze({
                role: 'damage_multiplier',
                tuningGroup: 'water_fire',
                notes: '증발은 단순 피해 증폭 반응으로 시작한다.',
            }),
        }),

        combustion: Object.freeze({
            elements: ['fire', 'grass'],
            label: '연소',
            damage: Object.freeze({
                multiplier: 1.25,
                flatDamageRatio: 0.08,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'combustion', turns: 2 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_COMBUSTION',
            log: '🔥🌿 풀 기운에 불이 옮겨붙어 연소 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'dot_candidate',
                tuningGroup: 'fire_grass',
                notes: '기존 burned와 분리된 반응 전용 연소 키를 쓴다.',
            }),
        }),

        overload: Object.freeze({
            elements: ['fire', 'lightning'],
            label: '과부하',
            damage: Object.freeze({
                multiplier: 1.45,
                flatDamageRatio: 0.06,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_OVERLOAD',
            log: '🔥⚡ 불꽃과 전류가 충돌해 과부하 폭발이 일어났습니다!',
            adminMeta: Object.freeze({
                role: 'burst_damage',
                tuningGroup: 'fire_lightning',
                notes: '폭발 반응이지만 M10 1차에서는 강제 행동불가를 넣지 않는다.',
            }),
        }),

        pollenSpread: Object.freeze({
            elements: ['grass', 'wind'],
            label: '꽃가루 확산',
            damage: Object.freeze({
                multiplier: 1.25,
                flatDamageRatio: 0.05,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_POLLEN_SPREAD',
            log: '🌿🌪️ 바람을 타고 꽃가루가 퍼져 확산 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'support_spread',
                tuningGroup: 'grass_wind',
                notes: '바람 계열 확산 반응의 1차 형태.',
            }),
        }),

        bloom: Object.freeze({
            elements: ['water', 'grass'],
            label: '만개',
            damage: Object.freeze({
                multiplier: 1.1,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'bound', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_BLOOM',
            log: '💧🌿 물과 풀 기운이 폭발적으로 피어나 만개 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'bind_cc',
                tuningGroup: 'water_grass',
                notes: '만개는 속박 CC를 주는 물+풀 반응이다.',
            }),
        }),

        whirlpool: Object.freeze({
            elements: ['water', 'wind'],
            label: '소용돌이',
            damage: Object.freeze({
                multiplier: 1.05,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'confused', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_WHIRLPOOL',
            log: '💧🌪️ 물살과 바람이 뒤엉켜 소용돌이 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'confusion_cc',
                tuningGroup: 'water_wind',
                notes: '소용돌이는 혼란을 유발하는 물+바람 반응이다.',
            }),
        }),

        storm: Object.freeze({
            elements: ['lightning', 'wind'],
            label: '폭풍',
            damage: Object.freeze({
                multiplier: 1.1,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'staggered', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_STORM',
            log: '⚡🌪️ 전류를 품은 돌풍이 몰아쳐 폭풍 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'stagger_cc',
                tuningGroup: 'lightning_wind',
                notes: '폭풍은 기절보다 약한 경직 CC로 둔다.',
            }),
        }),

        superconduct: Object.freeze({
            elements: ['lightning', 'ice'],
            label: '초전도',
            damage: Object.freeze({
                multiplier: 1.15,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'aching', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_SUPERCONDUCT',
            log: '⚡❄️ 얼음 결정 사이로 전류가 흘러 초전도 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'defense_weaken',
                tuningGroup: 'lightning_ice',
                notes: '현실 물리보다는 게임 관습형 반응. 하드 CC 대신 약화로 둔다.',
            }),
        }),

        overgrowth: Object.freeze({
            elements: ['lightning', 'grass'],
            label: '과성장',
            damage: Object.freeze({
                multiplier: 1.05,
                flatDamageRatio: 0.02,
            }),
            crowdControl: Object.freeze({
                enabled: false,
                statusEffects: Object.freeze([]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_OVERGROWTH',
            log: '⚡🌿 전기 자극으로 생명력이 솟아 과성장 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'attacker_heal',
                tuningGroup: 'lightning_grass',
                notes: '과성장은 방어자 CC가 아니라 공격자 소량 회복으로 처리한다.',
            }),
        }),

        frostWither: Object.freeze({
            elements: ['grass', 'ice'],
            label: '서리덩굴',
            damage: Object.freeze({
                multiplier: 1.15,
                flatDamageRatio: 0.03,
            }),
            crowdControl: Object.freeze({
                enabled: true,
                statusEffects: Object.freeze([
                    Object.freeze({ key: 'aching', turns: 1 }),
                ]),
            }),
            traceRules: Object.freeze({
                consumeMatchedTrace: true,
                applyTriggerTraceAfterReaction: false,
            }),
            visualEffectType: 'REACTION_FROST_WITHER',
            log: '🌿❄️ 차가운 서리가 풀 기운을 시들게 해 서리덩굴 반응이 발생했습니다!',
            adminMeta: Object.freeze({
                role: 'weaken_debuff',
                tuningGroup: 'grass_ice',
                notes: '풀+얼음은 서리덩굴 약화 디버프로 둔다.',
            }),
        }),
    }),

    adminSchema: Object.freeze({
        damageMultiplier: Object.freeze({
            min: 0.5,
            max: 3.0,
            step: 0.05,
        }),
        flatDamageRatio: Object.freeze({
            min: 0,
            max: 0.25,
            step: 0.01,
        }),
        statusTurns: Object.freeze({
            min: 0,
            max: 5,
            step: 1,
        }),
        traceTurns: Object.freeze({
            min: 1,
            max: 5,
            step: 1,
        }),
    }),
});

export function getReactionConfig(reactionKey, config = ELEMENT_REACTION_BALANCE_CONFIG) {
    return config?.reactions?.[reactionKey] || null;
}

export function getReactionEntries(config = ELEMENT_REACTION_BALANCE_CONFIG) {
    return Object.entries(config?.reactions || {});
}

export function getTraceConfig(config = ELEMENT_REACTION_BALANCE_CONFIG) {
    return config?.traces || ELEMENT_REACTION_BALANCE_CONFIG.traces;
}
