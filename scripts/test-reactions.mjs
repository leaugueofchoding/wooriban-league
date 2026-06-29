// scripts/test-reactions.mjs
// M3_REACTION_ENGINE_CORE 검증 스크립트
// 실행: node .\scripts\test-reactions.mjs

import assert from 'node:assert/strict';
import {
    ELEMENT_KEYS,
    ELEMENT_TRACE_DEFAULT_TURNS,
    findReaction,
    normalizeElement,
    normalizeTraces,
    resolveElementReaction,
} from '../src/features/battle/elementReactionEngine.js';

const ON = {
    ELEMENT_REACTION_ENABLED: true,
    LEGACY_TYPE_CHART_ENABLED: true,
};

const OFF = {
    ELEMENT_REACTION_ENABLED: false,
    LEGACY_TYPE_CHART_ENABLED: true,
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

function run() {
    testDisabledFlagSkipsEverything();
    testElementNormalization();
    testTraceApplicationWhenNoReaction();
    testWaterLightningElectroChargedConsumesWaterTrace();
    testReactionPairsAreDirectionInsensitive();
    testCoreReactionInventory();
    testNormalizeTracesAcceptsKoreanKeys();

    console.log('✅ M3 reaction engine tests passed');
}

run();
