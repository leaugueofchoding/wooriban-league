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
                multiplier: 1.15,
                flatDamageRatio: 0.04,
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
                multiplier: 1.0,
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
                multiplier: 1.25,
                flatDamageRatio: 0,
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
                multiplier: 1.1,
                flatDamageRatio: 0.05,
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
                multiplier: 1.2,
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
                multiplier: 1.0,
                flatDamageRatio: 0.04,
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
