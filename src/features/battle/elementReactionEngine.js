// src/features/battle/elementReactionEngine.js
// M4_REACTION_BALANCE_CONFIG
// 원소반응 공용 엔진입니다.
// 반응 배율/고정 피해/CC/흔적 소모 규칙은 elementReactionConfig.js에 둡니다.
// 아직 실제 전투 로직에는 연결하지 않습니다.

import { FEATURE_FLAGS } from './featureFlags.js';
import {
    ELEMENT_REACTION_BALANCE_CONFIG,
    getReactionEntries,
    getTraceConfig,
} from './elementReactionConfig.js';

export const ELEMENT_KEYS = Object.freeze({
    FIRE: 'fire',
    WATER: 'water',
    GRASS: 'grass',
    WIND: 'wind',
    LIGHTNING: 'lightning',
    ICE: 'ice',
});

export const ELEMENT_LABELS = Object.freeze({
    [ELEMENT_KEYS.FIRE]: '불',
    [ELEMENT_KEYS.WATER]: '물',
    [ELEMENT_KEYS.GRASS]: '풀',
    [ELEMENT_KEYS.WIND]: '바람',
    [ELEMENT_KEYS.LIGHTNING]: '번개',
    [ELEMENT_KEYS.ICE]: '얼음',
});

const ELEMENT_ALIASES = Object.freeze({
    fire: ELEMENT_KEYS.FIRE,
    '불': ELEMENT_KEYS.FIRE,
    water: ELEMENT_KEYS.WATER,
    '물': ELEMENT_KEYS.WATER,
    grass: ELEMENT_KEYS.GRASS,
    plant: ELEMENT_KEYS.GRASS,
    '풀': ELEMENT_KEYS.GRASS,
    wind: ELEMENT_KEYS.WIND,
    air: ELEMENT_KEYS.WIND,
    '바람': ELEMENT_KEYS.WIND,
    lightning: ELEMENT_KEYS.LIGHTNING,
    electric: ELEMENT_KEYS.LIGHTNING,
    thunder: ELEMENT_KEYS.LIGHTNING,
    '번개': ELEMENT_KEYS.LIGHTNING,
    ice: ELEMENT_KEYS.ICE,
    '얼음': ELEMENT_KEYS.ICE,
});

export const ELEMENT_TRACE_DEFAULT_TURNS = getTraceConfig().defaultTurns;

// 기존 import 호환성을 위해 이름은 유지하되, 실제 데이터 원본은 config 파일입니다.
export const REACTION_TABLE = ELEMENT_REACTION_BALANCE_CONFIG.reactions;

export function getTraceDefaultTurns(balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG) {
    return Number(getTraceConfig(balanceConfig).defaultTurns) || ELEMENT_TRACE_DEFAULT_TURNS;
}

export function normalizeElement(element) {
    if (element === null || element === undefined || element === '') return null;
    return ELEMENT_ALIASES[String(element).trim()] || null;
}

export function makePairKey(firstElement, secondElement) {
    return [firstElement, secondElement].sort().join('+');
}

export function normalizeReactionConfig(rawConfig = {}) {
    const [firstRaw, secondRaw] = rawConfig.elements || [];
    const firstElement = normalizeElement(firstRaw);
    const secondElement = normalizeElement(secondRaw);

    if (!firstElement || !secondElement) return null;

    return {
        elements: [firstElement, secondElement],
        label: rawConfig.label || null,
        damageMultiplier: Number(rawConfig.damage?.multiplier ?? 1),
        flatDamageRatio: Number(rawConfig.damage?.flatDamageRatio ?? 0),
        statusEffects: Array.isArray(rawConfig.crowdControl?.statusEffects)
            ? rawConfig.crowdControl.statusEffects
            : [],
        consumeMatchedTrace: rawConfig.traceRules?.consumeMatchedTrace ?? true,
        applyTriggerTraceAfterReaction: rawConfig.traceRules?.applyTriggerTraceAfterReaction ?? false,
        visualEffectType: rawConfig.visualEffectType || null,
        log: rawConfig.log || '',
        adminMeta: rawConfig.adminMeta || {},
    };
}

export function buildReactionLookup(balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG) {
    return new Map(
        getReactionEntries(balanceConfig)
            .map(([reactionKey, rawConfig]) => {
                const normalizedConfig = normalizeReactionConfig(rawConfig);
                if (!normalizedConfig) return null;

                return [
                    makePairKey(normalizedConfig.elements[0], normalizedConfig.elements[1]),
                    { reactionKey, ...normalizedConfig },
                ];
            })
            .filter(Boolean)
    );
}

export function normalizeTraces(rawTraces = {}, balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG) {
    const defaultTurns = getTraceDefaultTurns(balanceConfig);

    return Object.entries(rawTraces || {}).reduce((acc, [rawElement, rawValue]) => {
        const element = normalizeElement(rawElement);
        if (!element) return acc;

        if (rawValue === false || rawValue === null || rawValue === undefined) return acc;

        const turns = typeof rawValue === 'object'
            ? Number(rawValue.turns ?? defaultTurns)
            : Number(rawValue);

        acc[element] = Number.isFinite(turns) && turns > 0
            ? turns
            : defaultTurns;

        return acc;
    }, {});
}

export function getElementTracesFromPet(petOrParticipant, balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG) {
    // M10_5_PARTICIPANT_TRACE_READ_FIX
    // 실제 BattlePage에서는 defender가 participant 형태({ pet })로 전달될 수 있습니다.
    // pet/status 양쪽 형태를 모두 허용해 기존 흔적을 안정적으로 읽습니다.
    const status = petOrParticipant?.status || petOrParticipant?.pet?.status || {};
    return normalizeTraces(status.elementTraces || {}, balanceConfig);
}

export function createEmptyReactionResult({ reason = null, nextTraces = {} } = {}) {
    return {
        enabled: false,
        skipped: true,
        reason,
        reactionKey: null,
        label: null,
        damageMultiplier: 1,
        flatDamage: 0,
        consumeTraces: [],
        applyTraces: [],
        nextTraces,
        statusEffects: [],
        visualEffectType: null,
        logParts: [],
    };
}

export function findReaction(
    incomingElement,
    traces = {},
    balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG
) {
    const normalizedIncoming = normalizeElement(incomingElement);
    if (!normalizedIncoming) return null;

    const reactionLookup = buildReactionLookup(balanceConfig);
    const normalizedTraces = normalizeTraces(traces, balanceConfig);

    for (const traceElement of Object.keys(normalizedTraces)) {
        if (traceElement === normalizedIncoming) continue;

        const reaction = reactionLookup.get(makePairKey(traceElement, normalizedIncoming));
        if (reaction) {
            return {
                ...reaction,
                triggerElement: normalizedIncoming,
                traceElement,
            };
        }
    }

    return null;
}

function calculateFlatReactionDamage({ reaction, defender }) {
    const maxHp = Number(defender?.pet?.maxHp ?? defender?.maxHp ?? 0);
    const flatDamageRatio = Number(reaction?.flatDamageRatio ?? 0);

    return flatDamageRatio > 0 && maxHp > 0
        ? Math.max(1, Math.round(maxHp * flatDamageRatio))
        : 0;
}

function makeTraceAppliedResult({ incomingElement, currentTraces, balanceConfig }) {
    const traceConfig = getTraceConfig(balanceConfig);
    const shouldRefresh = traceConfig.refreshOnApply !== false;

    return {
        enabled: true,
        skipped: false,
        reason: 'TRACE_APPLIED',
        reactionKey: null,
        label: null,
        damageMultiplier: 1,
        flatDamage: 0,
        consumeTraces: [],
        applyTraces: [incomingElement],
        nextTraces: {
            ...currentTraces,
            [incomingElement]: shouldRefresh
                ? getTraceDefaultTurns(balanceConfig)
                : (currentTraces[incomingElement] ?? getTraceDefaultTurns(balanceConfig)),
        },
        statusEffects: [],
        visualEffectType: 'ELEMENT_TRACE_APPLIED',
        logParts: [`${ELEMENT_LABELS[incomingElement]} 원소 흔적이 남았습니다.`],
    };
}

function makeReactionTriggeredResult({
    reaction,
    currentTraces,
    defender,
    baseDamage,
}) {
    const safeBaseDamage = Math.max(0, Number(baseDamage) || 0);
    const flatDamage = calculateFlatReactionDamage({ reaction, defender });

    const nextTraces = { ...currentTraces };
    const consumeTraces = reaction.consumeMatchedTrace ? [reaction.traceElement] : [];

    consumeTraces.forEach(traceElement => {
        delete nextTraces[traceElement];
    });

    if (reaction.applyTriggerTraceAfterReaction) {
        nextTraces[reaction.triggerElement] = ELEMENT_TRACE_DEFAULT_TURNS;
    }

    return {
        enabled: true,
        skipped: false,
        reason: 'REACTION_TRIGGERED',
        reactionKey: reaction.reactionKey,
        label: reaction.label,
        damageMultiplier: reaction.damageMultiplier ?? 1,
        flatDamage,
        estimatedBonusDamage: Math.max(
            0,
            Math.round(safeBaseDamage * ((reaction.damageMultiplier ?? 1) - 1))
        ) + flatDamage,
        consumeTraces,
        applyTraces: reaction.applyTriggerTraceAfterReaction ? [reaction.triggerElement] : [],
        nextTraces,
        statusEffects: reaction.statusEffects || [],
        visualEffectType: reaction.visualEffectType || null,
        logParts: reaction.log ? [reaction.log] : [],
    };
}

export function resolveElementReaction({
    attacker = null,
    defender = null,
    skill = null,
    skillElement = null,
    baseDamage = 0,
    existingTraces = null,
    flags = FEATURE_FLAGS,
    balanceConfig = ELEMENT_REACTION_BALANCE_CONFIG,
} = {}) {
    const incomingElement = normalizeElement(skillElement ?? skill?.element ?? null);
    const currentTraces = normalizeTraces(
        existingTraces ?? getElementTracesFromPet(defender, balanceConfig),
        balanceConfig
    );

    if (!flags?.ELEMENT_REACTION_ENABLED) {
        return createEmptyReactionResult({
            reason: 'ELEMENT_REACTION_DISABLED',
            nextTraces: currentTraces,
        });
    }

    if (!incomingElement) {
        return createEmptyReactionResult({
            reason: 'NO_ELEMENT_SKILL',
            nextTraces: currentTraces,
        });
    }

    const reaction = findReaction(incomingElement, currentTraces, balanceConfig);

    if (!reaction) {
        return makeTraceAppliedResult({
            incomingElement,
            currentTraces,
            balanceConfig,
        });
    }

    return makeReactionTriggeredResult({
        reaction,
        currentTraces,
        defender,
        baseDamage,
    });
}

export function applyReactionResultToPet(pet, reactionResult) {
    if (!pet || !reactionResult || !reactionResult.enabled) return pet;

    if (!pet.status) pet.status = {};
    pet.status.elementTraces = { ...(reactionResult.nextTraces || {}) };

    (reactionResult.statusEffects || []).forEach(effect => {
        if (!effect?.key) return;
        pet.status[effect.key] = true;
        if (Number.isFinite(Number(effect.turns))) {
            pet.status[`${effect.key}Turns`] = Number(effect.turns);
        }
    });

    return pet;
}
