// src/features/battle/elementReactionEngine.js
// M3_REACTION_ENGINE_CORE
// 원소반응 공용 엔진의 1차 골격입니다.
// 아직 실제 전투 로직에는 연결하지 않습니다.
// 스킬 effect 함수는 앞으로 "어떤 원소 스킬을 썼는지"만 이 엔진에 전달하는 구조로 전환합니다.

import { FEATURE_FLAGS } from './featureFlags.js';

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

export const ELEMENT_TRACE_DEFAULT_TURNS = 2;

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

export const REACTION_TABLE = Object.freeze({
    electroCharged: {
        elements: [ELEMENT_KEYS.WATER, ELEMENT_KEYS.LIGHTNING],
        label: '감전',
        damageMultiplier: 1.15,
        flatDamageRatio: 0.04,
        visualEffectType: 'REACTION_ELECTRO_CHARGED',
        log: '💧⚡ 물 기운에 전류가 퍼져 감전 반응이 발생했습니다!',
    },
    frozen: {
        elements: [ELEMENT_KEYS.WATER, ELEMENT_KEYS.ICE],
        label: '빙결',
        damageMultiplier: 1.0,
        flatDamageRatio: 0,
        visualEffectType: 'REACTION_FROZEN',
        statusEffects: [{ key: 'frozen', turns: 1 }],
        log: '💧❄️ 물 기운이 얼어붙어 빙결 반응이 발생했습니다!',
    },
    vaporize: {
        elements: [ELEMENT_KEYS.WATER, ELEMENT_KEYS.FIRE],
        label: '증발',
        damageMultiplier: 1.25,
        flatDamageRatio: 0,
        visualEffectType: 'REACTION_VAPORIZE',
        log: '💧🔥 뜨거운 열기가 물 기운을 증발시켜 피해가 증폭됩니다!',
    },
    combustion: {
        elements: [ELEMENT_KEYS.FIRE, ELEMENT_KEYS.GRASS],
        label: '연소',
        damageMultiplier: 1.1,
        flatDamageRatio: 0.05,
        visualEffectType: 'REACTION_COMBUSTION',
        statusEffects: [{ key: 'combustion', turns: 2 }],
        log: '🔥🌿 풀 기운에 불이 옮겨붙어 연소 반응이 발생했습니다!',
    },
    overload: {
        elements: [ELEMENT_KEYS.FIRE, ELEMENT_KEYS.LIGHTNING],
        label: '과부하',
        damageMultiplier: 1.2,
        flatDamageRatio: 0.03,
        visualEffectType: 'REACTION_OVERLOAD',
        log: '🔥⚡ 불꽃과 전류가 충돌해 과부하 폭발이 일어났습니다!',
    },
    pollenSpread: {
        elements: [ELEMENT_KEYS.GRASS, ELEMENT_KEYS.WIND],
        label: '꽃가루 확산',
        damageMultiplier: 1.0,
        flatDamageRatio: 0.04,
        visualEffectType: 'REACTION_POLLEN_SPREAD',
        log: '🌿🌪️ 바람을 타고 꽃가루가 퍼져 확산 반응이 발생했습니다!',
    },
});

const REACTION_LOOKUP = new Map(
    Object.entries(REACTION_TABLE).map(([reactionKey, config]) => [
        makePairKey(config.elements[0], config.elements[1]),
        { reactionKey, ...config },
    ])
);

export function normalizeElement(element) {
    if (element === null || element === undefined || element === '') return null;
    return ELEMENT_ALIASES[String(element).trim()] || null;
}

export function makePairKey(firstElement, secondElement) {
    return [firstElement, secondElement].sort().join('+');
}

export function normalizeTraces(rawTraces = {}) {
    return Object.entries(rawTraces || {}).reduce((acc, [rawElement, rawValue]) => {
        const element = normalizeElement(rawElement);
        if (!element) return acc;

        if (rawValue === false || rawValue === null || rawValue === undefined) return acc;

        const turns = typeof rawValue === 'object'
            ? Number(rawValue.turns ?? ELEMENT_TRACE_DEFAULT_TURNS)
            : Number(rawValue);

        acc[element] = Number.isFinite(turns) && turns > 0
            ? turns
            : ELEMENT_TRACE_DEFAULT_TURNS;

        return acc;
    }, {});
}

export function getElementTracesFromPet(pet) {
    return normalizeTraces(pet?.status?.elementTraces || {});
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

export function findReaction(incomingElement, traces = {}) {
    const normalizedIncoming = normalizeElement(incomingElement);
    if (!normalizedIncoming) return null;

    for (const traceElement of Object.keys(normalizeTraces(traces))) {
        if (traceElement === normalizedIncoming) continue;

        const reaction = REACTION_LOOKUP.get(makePairKey(traceElement, normalizedIncoming));
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

export function resolveElementReaction({
    attacker = null,
    defender = null,
    skill = null,
    skillElement = null,
    baseDamage = 0,
    existingTraces = null,
    flags = FEATURE_FLAGS,
} = {}) {
    const incomingElement = normalizeElement(skillElement ?? skill?.element ?? null);
    const currentTraces = normalizeTraces(existingTraces ?? getElementTracesFromPet(defender));

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

    const reaction = findReaction(incomingElement, currentTraces);

    if (!reaction) {
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
                [incomingElement]: ELEMENT_TRACE_DEFAULT_TURNS,
            },
            statusEffects: [],
            visualEffectType: 'ELEMENT_TRACE_APPLIED',
            logParts: [`${ELEMENT_LABELS[incomingElement]} 원소 흔적이 남았습니다.`],
        };
    }

    const maxHp = Number(defender?.pet?.maxHp ?? defender?.maxHp ?? 0);
    const safeBaseDamage = Math.max(0, Number(baseDamage) || 0);
    const flatDamageFromRatio = reaction.flatDamageRatio && maxHp > 0
        ? Math.max(1, Math.round(maxHp * reaction.flatDamageRatio))
        : 0;

    const nextTraces = { ...currentTraces };
    delete nextTraces[reaction.traceElement];

    return {
        enabled: true,
        skipped: false,
        reason: 'REACTION_TRIGGERED',
        reactionKey: reaction.reactionKey,
        label: reaction.label,
        damageMultiplier: reaction.damageMultiplier ?? 1,
        flatDamage: flatDamageFromRatio,
        estimatedBonusDamage: Math.max(0, Math.round(safeBaseDamage * ((reaction.damageMultiplier ?? 1) - 1))) + flatDamageFromRatio,
        consumeTraces: [reaction.traceElement],
        applyTraces: [],
        nextTraces,
        statusEffects: reaction.statusEffects || [],
        visualEffectType: reaction.visualEffectType || null,
        logParts: [reaction.log],
    };
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
