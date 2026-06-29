// src/features/battle/BattleStatusEffect.jsx

import React from 'react';


const ELEMENT_TRACE_STATUS_META = {
    fire: {
        icon: '🔥',
        label: '불 흔적',
        tone: '#f03e3e',
    },
    water: {
        icon: '💧',
        label: '물 흔적',
        tone: '#228be6',
    },
    grass: {
        icon: '🌿',
        label: '풀 흔적',
        tone: '#2f9e44',
    },
    wind: {
        icon: '🌪️',
        label: '바람 흔적',
        tone: '#15aabf',
    },
    lightning: {
        icon: '⚡',
        label: '번개 흔적',
        tone: '#f08c00',
    },
    ice: {
        icon: '❄️',
        label: '얼음 흔적',
        tone: '#4dabf7',
    },
};

export function getElementTraceStatusList(petStatus = {}) {
    const traces = petStatus?.elementTraces;
    if (!traces || typeof traces !== 'object') return [];

    return Object.entries(traces)
        .map(([element, rawTurns]) => {
            const meta = ELEMENT_TRACE_STATUS_META[element];
            if (!meta) return null;

            const turns = typeof rawTurns === 'object'
                ? Number(rawTurns.turns ?? 1)
                : Number(rawTurns);

            const safeTurns = Number.isFinite(turns) && turns > 0
                ? Math.ceil(turns)
                : 1;

            return {
                kind: 'elementTrace-' + element,
                icon: meta.icon,
                label: meta.label,
                detail: safeTurns + '턴 원소 흔적',
                tone: meta.tone,
                isElementTrace: true,
            };
        })
        .filter(Boolean);
}

export function getBattleStatusList(petStatus = {}) {
    const statuses = [];

    // 대표 카드 우선순위:
    // 즉시 행동/선택에 영향을 주는 CC를 먼저 크게 보여주고,
    // 도트/버프류는 작은 아이콘 트레이로 밀리게 합니다.

    if (petStatus.stunned) {
        statuses.push({
            kind: 'stun',
            icon: '💫',
            label: '행동 불가',
            detail: `${petStatus.stunnedTurns ?? 1}턴 행동 불가`,
            tone: '#f08c00',
        });
    }

    if (petStatus.healPulse) {
        const healKind = petStatus.healPulseKind || 'heal';
        const isSeedHeal = healKind === 'seed';
        const isBlossomHeal = healKind === 'blossom';
        statuses.push({
            kind: 'healPulse',
            icon: isSeedHeal ? '💚' : isBlossomHeal ? '🌸' : '💖',
            label: isSeedHeal ? '체력 흡수' : isBlossomHeal ? '표식 회복' : '회복',
            detail: isSeedHeal ? '준 피해 일부 회복' : isBlossomHeal ? '표식 +1 · 체력 회복' : '체력 회복',
            tone: isSeedHeal ? '#2f9e44' : isBlossomHeal ? '#f06595' : '#e64980',
        });
    }

    if (petStatus.recentHeal) {
        const healKind = petStatus.recentHealKind || 'heal';
        const healMeta = healKind === 'leechSeed'
            ? { icon: '💚', label: '체력 흡수', detail: '회복 스킬 사용', tone: '#2f9e44' }
            : healKind === 'blossomCurrent'
                ? { icon: '🌸', label: '표식 회복', detail: '회복 해류 사용', tone: '#e64980' }
                : { icon: '💖', label: '체력 회복', detail: '회복 스킬 사용', tone: '#e64980' };

        statuses.push({
            kind: 'recentHeal',
            ...healMeta,
        });
    }

    const waveMarkCount = Number(petStatus.waveMark ?? 0);
    if (Number.isFinite(waveMarkCount) && waveMarkCount > 0) {
        const safeWaveMarkCount = Math.max(1, Math.min(3, Math.floor(waveMarkCount)));
        statuses.push({
            kind: 'waveMark',
            icon: '💧',
            label: `물결표식 ${safeWaveMarkCount}/3`,
            detail: '표식이 많을수록 폭발 피해 증가',
            tone: safeWaveMarkCount >= 3 ? '#e64980' : safeWaveMarkCount >= 2 ? '#7950f2' : '#228be6',
        });
    }
    if (petStatus.dazzled) {
        statuses.push({
            kind: 'blind',
            icon: '☀️',
            label: '눈부심',
            detail: `${petStatus.dazzledTurns ?? 1}턴/1회 눈부심`,
            tone: '#f59f00',
        });
    }

    if (petStatus.recharging) {
        statuses.push({
            kind: 'recharge',
            icon: '💨',
            label: '반동',
            detail: '숨 고르는 중',
            tone: '#ff6b35',
        });
    }

    if (petStatus.bound) {
        statuses.push({
            kind: 'bound',
            icon: '🌿',
            label: '속박',
            detail: `${petStatus.boundTurns ?? 2}턴 방어/도망 봉쇄`,
            tone: '#2f9e44',
        });
    }

    if (petStatus.blind) {
        statuses.push({
            kind: 'blind',
            icon: '🙈',
            label: '실명',
            detail: `${petStatus.blindTurns ?? 1}턴/1회 실명`,
            tone: '#868e96',
        });
    }

    if (petStatus.aching) {
        statuses.push({
            kind: 'aching',
            icon: '💢',
            label: '욱신욱신',
            detail: `${petStatus.achingTurns ?? 2}턴 공격/방어 감소`,
            tone: '#e03131',
        });
    }

    if (petStatus.counterReady) {
        statuses.push({
            kind: 'counter',
            icon: '⚔️',
            label: '반격 준비',
            detail: '다음 공격 일부 반사',
            tone: '#f08c00',
        });
    }

    if (petStatus.focusCharge) {
        statuses.push({
            kind: 'focus',
            icon: '⚡',
            label: '기 모으기',
            detail: '다음 공격 강화',
            tone: '#f08c00',
        });
    }

    if (petStatus.defenseUp) {
        statuses.push({
            kind: 'buff',
            icon: '🛡️',
            label: '방어 상승',
            detail: `${petStatus.defenseUpTurns ?? 2}턴 유지`,
            tone: '#845ef7',
        });
    }

    if (petStatus.burned) {
        statuses.push({
            kind: 'burn',
            icon: '🔥',
            label: '화상',
            detail: `${petStatus.burnedTurns ?? 3}턴 화상 피해`,
            tone: '#f03e3e',
        });
    }

    if (petStatus.poisoned) {
        statuses.push({
            kind: 'poison',
            icon: '☠️',
            label: '중독',
            detail: `${petStatus.poisonTurns ?? 3}턴 도트 피해`,
            tone: '#37b24d',
        });
    }

    // M5_ELEMENT_TRACE_STATUS_LIST
    // 원소 흔적은 큰 상태 카드가 아니라 작은 트레이 전용 상태로 분리합니다.
    statuses.push(...getElementTraceStatusList(petStatus));

    return statuses;
}

function getUniqueStatuses(statuses = []) {
    return statuses.filter((status, index, arr) => (
        arr.findIndex(item => item.kind === status.kind && item.label === status.label) === index
    ));
}

function StatusBadge({
    status,
    index = 0,
    badgeScale = 1,
    badgeOffsetY = -14,
    badgeGap = 42,
    badgeIconSize = 1,
    badgeLabelSize = 0.72,
    badgeDetailSize = 0.58,
    badgePadding = '0.34rem 0.55rem',
    badgeBorderWidth = 2,
}) {
    return (
        <div
            className="battleStatusBadge"
            style={{
                '--badge-scale': badgeScale,
                '--status-tone': status.tone,
                borderColor: status.tone,
                borderWidth: `${badgeBorderWidth}px`,
                boxShadow: `0 8px 20px ${status.tone}55`,
                top: `${badgeOffsetY + index * badgeGap}px`,
                transform: 'translateX(-50%) scale(var(--badge-scale))',
                transformOrigin: 'top center',
                padding: badgePadding,
            }}
        >
            <div style={{ fontSize: `${badgeIconSize}rem`, lineHeight: 1 }}>
                {status.icon}
            </div>

            <div>
                <div
                    style={{
                        fontSize: `${badgeLabelSize}rem`,
                        fontWeight: 1000,
                        color: status.tone,
                        lineHeight: 1.15,
                        whiteSpace: 'nowrap',
                    }}
                >
                    {status.label}
                </div>

                <div
                    style={{
                        fontSize: `${badgeDetailSize}rem`,
                        fontWeight: 800,
                        color: '#495057',
                        marginTop: '0.1rem',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {status.detail}
                </div>
            </div>
        </div>
    );
}

function MiniStatusIcon({ status, index = 0 }) {
    return (
        <div
            className="battleMiniStatus"
            style={{
                '--status-tone': status.tone,
                borderColor: status.tone,
                boxShadow: `0 7px 18px ${status.tone}44`,
                animationDelay: `${index * 0.04}s`,
            }}
            title={`${status.label} - ${status.detail}`}
        >
            <span className="battleMiniStatusIcon">{status.icon}</span>
            <span className="battleMiniStatusLabel">{status.label}</span>
        </div>
    );
}

function MiniStatusTray({ statuses = [] }) {
    if (!statuses.length) return null;

    return (
        <div className="battleMiniStatusTray">
            {statuses.slice(0, 5).map((status, index) => (
                <MiniStatusIcon
                    key={`mini-status-${status.kind}-${status.label}-${index}`}
                    status={status}
                    index={index}
                />
            ))}

            {statuses.length > 5 && (
                <div className="battleMiniStatus battleMiniStatus--more">
                    +{statuses.length - 5}
                </div>
            )}
        </div>
    );
}

function StatusAura({
    status,
    auraSize = 118,
    iconSize = 2.8,
    ringThickness = 5,
    dashDegrees = 8,
    gapDegrees = 5,
}) {
    return (
        <div
            className={`battleStatusAura battleStatusAura--${status.kind}`}
            style={{
                width: `${auraSize}px`,
                height: `${auraSize}px`,
                '--status-tone': status.tone,
                '--ring-thickness': `${ringThickness}px`,
                '--dash-deg': `${dashDegrees}deg`,
                '--gap-deg': `${gapDegrees}deg`,
            }}
        >
            <div className="battleStatusRing" />

            {status.kind === 'aching' && (
                <>
                    <div className="battleAcheRipple battleAcheRipple--one" />
                    <div className="battleAcheRipple battleAcheRipple--two" />
                </>
            )}

            <span style={{ fontSize: `${iconSize}rem` }}>
                {status.icon}
            </span>
        </div>
    );
}

function BattleStatusEffect({
    petStatus,
    statuses,
    showBadges = true,
    showAura = true,
    sizeScale,
    variant = 'preview',
}) {
    const rawStatusList = statuses || getBattleStatusList(petStatus);
    const statusList = getUniqueStatuses(rawStatusList);
    const battleStatusList = statusList.filter(status => !status.isElementTrace);
    const elementTraceStatuses = statusList.filter(status => status.isElementTrace);

    if (!statusList || statusList.length === 0) return null;

    const isBattle = variant === 'battle';
    const visualScale = Number(sizeScale) || (isBattle ? 3.4 : 1);

    const auraSize = Math.round(118 * visualScale);
    const iconSize = 2.8 * Math.min(visualScale, isBattle ? 1.65 : visualScale);

    // 점선 개수는 dashDegrees/gapDegrees로 고정하고, 크기와 굵기만 scale에 맞춰 키웁니다.
    const ringThickness = Math.max(5, Math.round(5 * visualScale));
    const dashDegrees = 8;
    const gapDegrees = 5;

    const badgeScale = isBattle
        ? 1.28
        : Math.max(1, visualScale * 0.95);

    const badgeOffsetY = isBattle
        ? -44
        : Math.round(-14 * visualScale);

    const badgeGap = isBattle
        ? 70
        : Math.round(42 * visualScale);

    const badgeIconSize = isBattle ? 1.28 : 1;
    const badgeLabelSize = isBattle ? 0.88 : 0.72;
    const badgeDetailSize = isBattle ? 0.66 : 0.58;
    const badgePadding = isBattle ? '0.48rem 0.78rem' : '0.34rem 0.55rem';
    const badgeBorderWidth = isBattle ? 3 : 2;

    // 배틀 화면:
    // 1순위 전투 상태 = 큰 카드 + 큰 오라
    // 나머지 전투 상태 + 원소 흔적 = 작은 아이콘 트레이
    // 원소 흔적만 있을 때는 큰 카드/오라 없이 작은 트레이만 보여줍니다.
    const primaryStatus = battleStatusList[0] || null;
    const secondaryStatuses = isBattle
        ? [...battleStatusList.slice(1), ...elementTraceStatuses]
        : elementTraceStatuses;

    const visibleAuras = isBattle
        ? (primaryStatus ? [primaryStatus] : [])
        : battleStatusList;

    const visibleBadges = isBattle
        ? (primaryStatus ? [primaryStatus] : [])
        : battleStatusList.slice(0, 4);

    return (
        <div className={`battleStatusLayer battleStatusLayer--${variant}`}>
            <style>
                {`
          @keyframes battleStatusPop {
            0% { opacity: 0; translate: 0 10px; scale: 0.72; }
            22% { opacity: 1; translate: 0 -8px; scale: 1.08; }
            45% { translate: 0 0; scale: 1; }
            100% { opacity: 1; translate: 0 0; scale: 1; }
          }

          @keyframes battleMiniPop {
            0% { opacity: 0; translate: 0 -4px; scale: 0.75; }
            100% { opacity: 1; translate: 0 0; scale: 1; }
          }

          @keyframes battleMiniPulse {
            0%, 100% { transform: translateY(0); filter: brightness(1); }
            50% { transform: translateY(-2px); filter: brightness(1.16); }
          }


          @keyframes battleHealPulseFloat {
            0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
            45% { transform: translateY(-5px) scale(1.16); filter: brightness(1.35); }
          }

          @keyframes battleHealPulseGlow {
            0%, 100% { box-shadow: 0 0 22px color-mix(in srgb, var(--status-tone) 42%, transparent), inset 0 0 18px color-mix(in srgb, var(--status-tone) 22%, transparent); }
            50% { box-shadow: 0 0 34px color-mix(in srgb, var(--status-tone) 66%, transparent), inset 0 0 26px color-mix(in srgb, var(--status-tone) 36%, transparent); }
          }

          @keyframes battleWaveMarkBubble {
            0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
            45% { transform: translateY(-6px) scale(1.16); filter: brightness(1.38); }
          }

          @keyframes battleWaveMarkGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(77,171,247,0.36), inset 0 0 18px rgba(77,171,247,0.22); }
            50% { box-shadow: 0 0 32px rgba(102,217,232,0.62), inset 0 0 26px rgba(116,192,252,0.36); }
          }
          @keyframes battleRecentHealPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); filter: brightness(1); }
            45% { transform: translate(-50%, -53%) scale(1.08); filter: brightness(1.35); }
          }

          @keyframes battleAuraPulse {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
            35% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
            100% { opacity: 0.72; transform: translate(-50%, -50%) scale(1); }
          }

          @keyframes battleRingSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes battleBurnFlicker {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.75; }
            50% { transform: translate(-50%, -58%) scale(1.12); opacity: 1; }
          }

          @keyframes battleBoundWiggle {
            0%, 100% { transform: translate(-50%, -50%) rotate(-6deg) scale(1); }
            50% { transform: translate(-50%, -50%) rotate(6deg) scale(1.06); }
          }

          @keyframes battleAcheThrob {
            0% {
              transform: translate(-50%, -50%) scale(0.94) rotate(-4deg);
              filter: brightness(1);
              border-radius: 54% 46% 52% 48%;
            }
            35% {
              transform: translate(-50%, -50%) scale(1.12) rotate(3deg);
              filter: brightness(1.45);
              border-radius: 42% 58% 45% 55%;
            }
            70% {
              transform: translate(-50%, -50%) scale(0.98) rotate(-2deg);
              filter: brightness(1.12);
              border-radius: 58% 42% 55% 45%;
            }
            100% {
              transform: translate(-50%, -50%) scale(0.94) rotate(-4deg);
              filter: brightness(1);
              border-radius: 54% 46% 52% 48%;
            }
          }

          @keyframes battleAcheRipple {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.55) rotate(-8deg);
            }
            22% { opacity: 0.85; }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.26) rotate(10deg);
            }
          }

          @keyframes battleAcheIconShake {
            0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
            25% { transform: translate(-2px, 1px) rotate(-8deg) scale(1.08); }
            50% { transform: translate(2px, -1px) rotate(7deg) scale(1.16); }
            75% { transform: translate(-1px, -2px) rotate(-5deg) scale(1.08); }
          }

          .battleStatusLayer {
            position: absolute;
            inset: 0;
            z-index: 30;
            pointer-events: none;
          }

          .battleStatusBadge {
            position: absolute;
            left: 50%;
            z-index: 38;
            display: flex;
            align-items: center;
            gap: 0.35rem;
            background: rgba(255,255,255,0.96);
            border: 2px solid;
            border-radius: 999px;
            padding: 0.34rem 0.55rem;
            animation: battleStatusPop 0.42s ease-out forwards;
            pointer-events: none;
          }

          .battleStatusLayer--battle .battleStatusBadge {
            padding: 0.36rem 0.62rem;
            border-width: 2px;
          }

          .battleMiniStatusTray {
            position: absolute;
            left: 50%;
            top: 34px;
            transform: translateX(-50%);
            z-index: 39;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.28rem;
            max-width: 320px;
            padding: 0.18rem 0.28rem;
            border-radius: 999px;
            background: rgba(255,255,255,0.72);
            backdrop-filter: blur(3px);
            box-shadow: 0 5px 16px rgba(0,0,0,0.10);
          }

          .battleMiniStatus {
            min-width: 32px;
            height: 32px;
            padding: 0 0.36rem;
            border-radius: 999px;
            border: 2px solid;
            background: rgba(255,255,255,0.96);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.16rem;
            color: var(--status-tone);
            font-weight: 1000;
            animation:
              battleMiniPop 0.22s ease-out both,
              battleMiniPulse 1.2s ease-in-out infinite;
          }

          .battleMiniStatusIcon {
            font-size: 1.05rem;
            line-height: 1;
            filter: drop-shadow(0 0 4px rgba(255,255,255,0.85));
          }

          .battleMiniStatusLabel {
            font-size: 0.58rem;
            line-height: 1;
            white-space: nowrap;
            color: #343a40;
          }

          .battleMiniStatus--more {
            color: #495057;
            border-color: #adb5bd;
            font-size: 0.78rem;
          }

          .battleStatusAura {
            position: absolute;
            left: 50%;
            top: 50%;
            border-radius: 999px;
            transform: translate(-50%, -50%);
            z-index: 31;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            animation: battleAuraPulse 0.45s ease-out forwards;
          }

          .battleStatusAura span {
            position: relative;
            z-index: 35;
            filter: drop-shadow(0 0 10px rgba(255,255,255,0.8));
          }

          .battleStatusRing {
            position: absolute;
            inset: 0;
            border-radius: 999px;
            z-index: 32;
            pointer-events: none;
            background:
              repeating-conic-gradient(
                from 0deg,
                var(--status-tone) 0deg var(--dash-deg),
                transparent var(--dash-deg) calc(var(--dash-deg) + var(--gap-deg))
              );
            -webkit-mask:
              radial-gradient(
                farthest-side,
                transparent calc(100% - var(--ring-thickness)),
                #000 calc(100% - var(--ring-thickness))
              );
            mask:
              radial-gradient(
                farthest-side,
                transparent calc(100% - var(--ring-thickness)),
                #000 calc(100% - var(--ring-thickness))
              );
            opacity: 0.95;
            filter: drop-shadow(0 0 14px color-mix(in srgb, var(--status-tone) 65%, transparent));
          }


          .battleStatusAura--healPulse {
            background:
              radial-gradient(circle, color-mix(in srgb, var(--status-tone) 30%, transparent) 0%, color-mix(in srgb, var(--status-tone) 14%, transparent) 45%, transparent 74%);
            box-shadow:
              0 0 24px color-mix(in srgb, var(--status-tone) 48%, transparent),
              inset 0 0 22px color-mix(in srgb, var(--status-tone) 28%, transparent);
            animation:
              battleAuraPulse 0.45s ease-out forwards,
              battleHealPulseGlow 1.05s ease-in-out infinite;
          }

          .battleStatusAura--healPulse .battleStatusRing {
            animation: battleRingSpin 4.2s linear infinite;
          }

          .battleStatusAura--healPulse span {
            animation: battleHealPulseFloat 0.95s ease-in-out infinite;
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.95))
              drop-shadow(0 0 12px color-mix(in srgb, var(--status-tone) 82%, transparent));
          }

          .battleStatusAura--waveMark {
            background:
              radial-gradient(circle, rgba(77,171,247,0.32) 0%, rgba(102,217,232,0.16) 45%, rgba(34,139,230,0.03) 74%);
            box-shadow:
              0 0 24px rgba(77,171,247,0.46),
              inset 0 0 22px rgba(102,217,232,0.26);
            animation:
              battleAuraPulse 0.45s ease-out forwards,
              battleWaveMarkGlow 1.15s ease-in-out infinite;
          }

          .battleStatusAura--waveMark .battleStatusRing {
            animation: battleRingSpin 5.2s linear infinite;
          }

          .battleStatusAura--waveMark span {
            animation: battleWaveMarkBubble 1.05s ease-in-out infinite;
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.95))
              drop-shadow(0 0 12px rgba(77,171,247,0.85));
          }
          .battleStatusAura--stun .battleStatusRing {
            animation: battleRingSpin 4.8s linear infinite;
          }

          .battleStatusAura--bound {
            background: radial-gradient(circle, rgba(47,158,68,0.20), rgba(47,158,68,0.03) 70%);
            box-shadow: inset 0 0 22px rgba(64,192,87,0.24), 0 0 20px rgba(64,192,87,0.34);
            animation: battleAuraPulse 0.45s ease-out forwards, battleBoundWiggle 0.65s ease-in-out infinite;
          }

          .battleStatusAura--stun {
            background: radial-gradient(circle, rgba(255,212,59,0.22), rgba(255,212,59,0.03) 70%);
            box-shadow: 0 0 22px rgba(255,212,59,0.45);
            animation: battleAuraPulse 0.45s ease-out forwards;
          }

          .battleStatusAura--poison {
            background: radial-gradient(circle, rgba(55,178,77,0.35), rgba(116,192,252,0) 70%);
            box-shadow: 0 0 22px rgba(55,178,77,0.45);
          }

          .battleStatusAura--burn {
            background: radial-gradient(circle, rgba(255,107,53,0.45), rgba(255,107,53,0) 72%);
            box-shadow: 0 0 26px rgba(240,62,62,0.52);
            animation: battleAuraPulse 0.45s ease-out forwards, battleBurnFlicker 0.55s ease-in-out infinite;
          }

          .battleStatusAura--blind {
            background: radial-gradient(circle, rgba(255,212,59,0.42), rgba(73,80,87,0.05) 70%);
            box-shadow: 0 0 22px rgba(245,159,0,0.45);
          }

          .battleStatusAura--counter {
            background: radial-gradient(circle, rgba(255,212,59,0.25), rgba(255,212,59,0.03) 70%);
            box-shadow: inset 0 0 24px rgba(255,212,59,0.25), 0 0 24px rgba(255,212,59,0.45);
          }

          .battleStatusAura--recharge {
            background: radial-gradient(circle, rgba(255,107,53,0.25), rgba(255,107,53,0) 70%);
          }

          .battleStatusAura--buff,
          .battleStatusAura--focus {
            background: radial-gradient(circle, rgba(132,94,247,0.24), rgba(132,94,247,0.03) 70%);
            box-shadow: inset 0 0 22px rgba(132,94,247,0.20), 0 0 20px rgba(132,94,247,0.36);
          }

          .battleStatusAura--recentHeal {
            background:
              radial-gradient(circle, rgba(255, 222, 235, 0.48) 0%, rgba(240, 101, 149, 0.18) 45%, rgba(230,73,128,0.03) 74%);
            box-shadow:
              0 0 26px rgba(240,101,149,0.48),
              inset 0 0 24px rgba(255,222,235,0.38);
            animation:
              battleAuraPulse 0.45s ease-out forwards,
              battleRecentHealPulse 0.8s ease-in-out infinite;
          }

          .battleStatusAura--recentHeal .battleStatusRing {
            animation: battleRingSpin 4.6s linear infinite;
          }

          .battleStatusAura--recentHeal span {
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.95))
              drop-shadow(0 0 14px rgba(240,101,149,0.72));
          }

          .battleStatusAura--heal {
            background: radial-gradient(circle, rgba(230,73,128,0.32), rgba(230,73,128,0) 70%);
            box-shadow: 0 0 22px rgba(230,73,128,0.45);
          }

          .battleStatusAura--drain {
            background: radial-gradient(circle, rgba(156,54,181,0.32), rgba(156,54,181,0) 70%);
            box-shadow: 0 0 22px rgba(156,54,181,0.45);
          }

          .battleStatusAura--aching {
            background:
              radial-gradient(circle, rgba(255,107,107,0.42) 0%, rgba(224,49,49,0.18) 42%, rgba(224,49,49,0.03) 72%),
              radial-gradient(circle, rgba(224,49,49,0.12) 0%, transparent 68%);
            box-shadow:
              0 0 24px rgba(224,49,49,0.55),
              inset 0 0 22px rgba(255,107,107,0.35);
            overflow: visible;
            animation:
              battleAuraPulse 0.45s ease-out forwards,
              battleAcheThrob 0.34s ease-in-out infinite;
          }

          .battleAcheRipple {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 100%;
            height: 100%;
            border-radius: 44% 56% 48% 52%;
            border: max(3px, calc(var(--ring-thickness) * 0.38)) solid rgba(224,49,49,0.62);
            transform: translate(-50%, -50%) scale(0.75);
            opacity: 0;
            pointer-events: none;
            z-index: 33;
          }

          .battleAcheRipple--one {
            animation: battleAcheRipple 0.75s ease-out infinite;
          }

          .battleAcheRipple--two {
            animation: battleAcheRipple 0.75s ease-out infinite;
            animation-delay: 0.22s;
            border-color: rgba(255,135,135,0.58);
          }

          .battleStatusAura--aching span {
            animation: battleAcheIconShake 0.26s ease-in-out infinite;
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.9))
              drop-shadow(0 0 10px rgba(224,49,49,0.9));
          }
        `}
            </style>

            {showAura && visibleAuras.map((status, index) => (
                <StatusAura
                    key={`aura-${status.kind}-${index}`}
                    status={status}
                    auraSize={auraSize}
                    iconSize={iconSize}
                    ringThickness={ringThickness}
                    dashDegrees={dashDegrees}
                    gapDegrees={gapDegrees}
                />
            ))}

            {showBadges && visibleBadges.map((status, index) => (
                <StatusBadge
                    key={`badge-${status.kind}-${index}`}
                    status={status}
                    index={index}
                    badgeScale={badgeScale}
                    badgeOffsetY={badgeOffsetY}
                    badgeGap={badgeGap}
                    badgeIconSize={badgeIconSize}
                    badgeLabelSize={badgeLabelSize}
                    badgeDetailSize={badgeDetailSize}
                    badgePadding={badgePadding}
                    badgeBorderWidth={badgeBorderWidth}
                />
            ))}

            {isBattle && showBadges && (
                <MiniStatusTray statuses={secondaryStatuses} />
            )}
        </div>
    );
}

export default BattleStatusEffect;
