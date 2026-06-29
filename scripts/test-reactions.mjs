// scripts/test-reactions.mjs
// M4_REACTION_BALANCE_CONFIG 검증 스크립트
// 실행: node .\scripts\test-reactions.mjs

import assert from 'node:assert/strict';
import { ELEMENT_REACTION_BALANCE_CONFIG } from '../src/features/battle/elementReactionConfig.js';
import {
    ELEMENT_KEYS,
    ELEMENT_TRACE_DEFAULT_TURNS,
    buildReactionLookup,
    findReaction,
    normalizeElement,
    normalizeReactionConfig,
    normalizeTraces,
    resolveElementReaction,
} from '../src/features/battle/elementReactionEngine.js';

const ON = {
    ELEMENT_REACTION_ENABLED: true,
};

const OFF = {
    ELEMENT_REACTION_ENABLED: false,
};

function makeDefender(maxHp = 100) {
    return {
        pet: {
            name: '테스트 펫',
            hp: maxHp,
            maxHp,
            status: {},
        },
    };
}

function testDisabledFlagSkipsEverything() {
    const result = resolveElementReaction({
        defender: makeDefender(),
        skillElement: '번개',
        existingTraces: { water: 2 },
        flags: OFF,
    });

    assert.equal(result.enabled, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'ELEMENT_REACTION_DISABLED');
    assert.equal(result.reactionKey, null);
    assert.deepEqual(result.nextTraces, { water: 2 });
}

function testElementNormalization() {
    assert.equal(normalizeElement('불'), ELEMENT_KEYS.FIRE);
    assert.equal(normalizeElement('fire'), ELEMENT_KEYS.FIRE);
    assert.equal(normalizeElement('물'), ELEMENT_KEYS.WATER);
    assert.equal(normalizeElement('번개'), ELEMENT_KEYS.LIGHTNING);
    assert.equal(normalizeElement(null), null);
    assert.equal(normalizeElement('무속성'), null);
}

function testTraceApplicationWhenNoReaction() {
    const result = resolveElementReaction({
        defender: makeDefender(),
        skillElement: '불',
        existingTraces: {},
        flags: ON,
    });

    assert.equal(result.enabled, true);
    assert.equal(result.reason, 'TRACE_APPLIED');
    assert.equal(result.reactionKey, null);
    assert.deepEqual(result.applyTraces, [ELEMENT_KEYS.FIRE]);
    assert.deepEqual(result.consumeTraces, []);
    assert.equal(result.nextTraces.fire, ELEMENT_TRACE_DEFAULT_TURNS);
}

function testWaterLightningElectroChargedConsumesWaterTrace() {
    const defender = makeDefender(200);
    const result = resolveElementReaction({
        defender,
        skillElement: '번개',
        existingTraces: { water: 2 },
        baseDamage: 40,
        flags: ON,
    });

    assert.equal(result.reason, 'REACTION_TRIGGERED');
    assert.equal(result.reactionKey, 'electroCharged');
    assert.equal(result.label, '감전');
    assert.deepEqual(result.consumeTraces, [ELEMENT_KEYS.WATER]);
    assert.deepEqual(result.applyTraces, []);
    assert.deepEqual(result.nextTraces, {});
    assert.equal(result.flatDamage, 8);
    assert.ok(result.logParts.join(' ').includes('감전'));
}

function testParticipantDefenderShapeReadsExistingTraces() {
    const defender = makeDefender(200);
    defender.pet.status.elementTraces = { water: 2 };

    const result = resolveElementReaction({
        defender,
        skillElement: '번개',
        baseDamage: 40,
        flags: ON,
    });

    assert.equal(result.reason, 'REACTION_TRIGGERED');
    assert.equal(result.reactionKey, 'electroCharged');
    assert.deepEqual(result.consumeTraces, [ELEMENT_KEYS.WATER]);
}

function testReactionPairsAreDirectionInsensitive() {
    const vaporizeA = findReaction('불', { water: 2 });
    const vaporizeB = findReaction('물', { fire: 2 });

    assert.equal(vaporizeA.reactionKey, 'vaporize');
    assert.equal(vaporizeB.reactionKey, 'vaporize');
}

function testCoreReactionInventory() {
    const cases = [
        ['번개', { water: 2 }, 'electroCharged'],
        ['얼음', { water: 2 }, 'frozen'],
        ['불', { water: 2 }, 'vaporize'],
        ['불', { grass: 2 }, 'combustion'],
        ['번개', { fire: 2 }, 'overload'],
        ['바람', { grass: 2 }, 'pollenSpread'],
    ];

    cases.forEach(([skillElement, traces, expectedKey]) => {
        const result = resolveElementReaction({
            defender: makeDefender(120),
            skillElement,
            existingTraces: traces,
            baseDamage: 30,
            flags: ON,
        });

        assert.equal(result.reason, 'REACTION_TRIGGERED');
        assert.equal(result.reactionKey, expectedKey);
        assert.equal(Object.keys(result.nextTraces).length, 0);
        assert.ok(result.visualEffectType);
        assert.ok(result.logParts.length > 0);
    });
}

function testNormalizeTracesAcceptsKoreanKeys() {
    assert.deepEqual(
        normalizeTraces({ '물': 1, '불': { turns: 2 }, unknown: 3 }),
        { water: 1, fire: 2 }
    );
}

function testReactionConfigIsDataDriven() {
    const electroCharged = ELEMENT_REACTION_BALANCE_CONFIG.reactions.electroCharged;

    assert.equal(electroCharged.damage.multiplier, 1.15);
    assert.equal(electroCharged.damage.flatDamageRatio, 0.04);
    assert.equal(electroCharged.traceRules.consumeMatchedTrace, true);
    assert.equal(ELEMENT_REACTION_BALANCE_CONFIG.adminSchema.damageMultiplier.step, 0.05);

    const normalized = normalizeReactionConfig(electroCharged);
    assert.deepEqual(normalized.elements, [ELEMENT_KEYS.WATER, ELEMENT_KEYS.LIGHTNING]);
    assert.equal(normalized.damageMultiplier, 1.15);
    assert.equal(normalized.flatDamageRatio, 0.04);
}

function testCustomBalanceConfigCanChangeNumbersWithoutEngineEdit() {
    const customConfig = {
        ...ELEMENT_REACTION_BALANCE_CONFIG,
        traces: {
            ...ELEMENT_REACTION_BALANCE_CONFIG.traces,
            defaultTurns: 3,
        },
        reactions: {
            ...ELEMENT_REACTION_BALANCE_CONFIG.reactions,
            electroCharged: {
                ...ELEMENT_REACTION_BALANCE_CONFIG.reactions.electroCharged,
                damage: {
                    multiplier: 1.5,
                    flatDamageRatio: 0.1,
                },
            },
        },
    };

    const traceOnly = resolveElementReaction({
        defender: makeDefender(100),
        skillElement: '물',
        existingTraces: {},
        flags: ON,
        balanceConfig: customConfig,
    });

    assert.equal(traceOnly.nextTraces.water, 3);

    const reaction = resolveElementReaction({
        defender: makeDefender(200),
        skillElement: '번개',
        existingTraces: { water: 2 },
        baseDamage: 40,
        flags: ON,
        balanceConfig: customConfig,
    });

    assert.equal(reaction.reactionKey, 'electroCharged');
    assert.equal(reaction.damageMultiplier, 1.5);
    assert.equal(reaction.flatDamage, 20);
}

function testBuildReactionLookupUsesConfig() {
    const lookup = buildReactionLookup(ELEMENT_REACTION_BALANCE_CONFIG);
    const keys = Array.from(lookup.values()).map(item => item.reactionKey).sort();

    assert.deepEqual(
        keys,
        ['combustion', 'electroCharged', 'frozen', 'overload', 'pollenSpread', 'vaporize'].sort()
    );
}

function run() {
    testDisabledFlagSkipsEverything();
    testElementNormalization();
    testTraceApplicationWhenNoReaction();
    testWaterLightningElectroChargedConsumesWaterTrace();
    testParticipantDefenderShapeReadsExistingTraces();
    testReactionPairsAreDirectionInsensitive();
    testCoreReactionInventory();
    testNormalizeTracesAcceptsKoreanKeys();
    testReactionConfigIsDataDriven();
    testCustomBalanceConfigCanChangeNumbersWithoutEngineEdit();
    testBuildReactionLookupUsesConfig();

    console.log('✅ M10.5 element reaction tests passed');
}

run();
