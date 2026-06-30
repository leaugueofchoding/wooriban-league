// src/features/pet/SkillPreview.jsx

import React from 'react';
import BattleSkillEffect from '../battle/BattleSkillEffect';
import BattleStatusEffect from '../battle/BattleStatusEffect';

function getSkillType(skill) {
    return String(skill?.id || '').toUpperCase();
}

function getSkillDescription(skill) {
    return skill?.description
        || skill?.tooltip
        || skill?.effectDescription
        || skill?.summary
        || '실제 대전 이펙트로 미리 보는 스킬입니다.';
}

function getStatusPreview(skill) {
    if (skill?.previewStatus) {
        return {
            target: skill.previewStatus.target || [],
            caster: skill.previewStatus.caster || [],
        };
    }

    return { target: [], caster: [] };
}

function getHitDelay(skillType) {
    const delayMap = {
        TACKLE: 220,
        WATER_BALL: 520,
        COUNTER_STANCE: 650,
        REED_BOW: 620,
        ULTIMATE_SECRET: 1650,

        WIND_BLADE: 500,
        TORNADO_SWEEP: 850,
        QUICK_DISTURBANCE: 620,
        FLAME_DASH: 520,
        THUNDER_PUNCH: 420,
        THUNDERSTORM: 650,
        UPHWA: 750,
        SOLAR_BEAM: 780,
        STELLAR_BLAST: 780,
        DRAGON_CLAW: 540,

        FIERY_BREATH: 650,
        REM_FIRE: 650,
        LEECH_SEED: 650,
        VINE_WHIP: 620,
        SHOCK_SCRATCH: 520,
        POISON_STING: 620,
        STATIC_SHOCK: 520,
        SAND_THROW: 520,
        SHIELD_BASH: 520,
        ENERGY_SIPHON: 620,
    };

    return delayMap[skillType] ?? 600;
}

function isBuffSkill(skillType) {
    return [
        'HARDEN',
        'HEALING_PRAYER',
        'MIND_FOCUS',
        'TAUNT',
    ].includes(skillType);
}

function StatusBadge({ status, side }) {
    return (
        <div
            className={`dexStatusBadge dexStatusBadge--${side}`}
            style={{
                borderColor: status.tone,
                boxShadow: `0 8px 20px ${status.tone}55`,
            }}
        >
            <div style={{
                fontSize: '1rem',
                lineHeight: 1,
            }}>
                {status.icon}
            </div>

            <div>
                <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 1000,
                    color: status.tone,
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                }}>
                    {status.label}
                </div>

                <div style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    color: '#495057',
                    marginTop: '0.1rem',
                    whiteSpace: 'nowrap',
                }}>
                    {status.detail}
                </div>
            </div>
        </div>
    );
}

function StatusAura({ status }) {
    return (
        <div className={`dexStatusAura dexStatusAura--${status.kind}`}>
            <span>{status.icon}</span>
        </div>
    );
}

function SkillPreview({
    skill,
    casterImageSrc,
    targetImageSrc,
    replayKey,
    onClose,
    displayMode = 'fixed',
}) {
    const skillType = getSkillType(skill);
    const statusPreview = getStatusPreview(skill);
    const targetStatuses = statusPreview.target || [];
    const casterStatuses = statusPreview.caster || [];

    const [isTargetHit, setIsTargetHit] = React.useState(false);
    const [showStatuses, setShowStatuses] = React.useState(false);

    React.useEffect(() => {
        setIsTargetHit(false);
        setShowStatuses(false);

        const timers = [];
        const hitDelay = getHitDelay(skillType);

        if (skillType && !isBuffSkill(skillType)) {
            timers.push(window.setTimeout(() => {
                setIsTargetHit(true);
            }, hitDelay));

            timers.push(window.setTimeout(() => {
                setIsTargetHit(false);
            }, hitDelay + 420));
        }

        if (targetStatuses.length > 0 || casterStatuses.length > 0) {
            const statusDelay = isBuffSkill(skillType)
                ? 360
                : hitDelay + 260;

            timers.push(window.setTimeout(() => {
                setShowStatuses(true);
            }, statusDelay));
        }

        return () => {
            timers.forEach(timer => window.clearTimeout(timer));
        };
    }, [skillType, replayKey, targetStatuses.length, casterStatuses.length]);

    if (!skill) return null;

    const isCardOverlay = displayMode === 'cardOverlay';

    const skillName = skill.name || '스킬';
    const skillElement = skill.element || '무';
    const skillPower = skill.basePower || 0;

    return (
        <div
            // M15_CARD_OVERLAY_BLANK_CLICK_CLOSE
            // 카드 오버레이 모드에서는 내부 요소가 아닌 빈 배경을 클릭하면 닫습니다.
            onMouseDown={(event) => {
                if (!isCardOverlay) return;
                if (event.target !== event.currentTarget) return;
                onClose?.();
            }}
            style={{
                position: isCardOverlay ? 'absolute' : 'fixed',
                left: isCardOverlay ? '0.65rem' : 'auto',
                right: isCardOverlay ? '0.65rem' : '22px',
                top: isCardOverlay ? '0.65rem' : 'auto',
                bottom: isCardOverlay ? '0.65rem' : '22px',
                width: isCardOverlay ? 'auto' : 'min(460px, calc(100vw - 32px))',
                maxHeight: isCardOverlay ? 'calc(100% - 1.3rem)' : 'none',
                overflowY: isCardOverlay ? 'auto' : 'visible',
                background: 'rgba(17, 24, 39, 0.96)',
                color: 'white',
                borderRadius: '20px',
                padding: isCardOverlay ? '0.85rem' : '1rem',
                boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
                zIndex: isCardOverlay ? 40 : 100000,
                border: '1px solid rgba(255,255,255,0.12)',
                fontFamily: "'Pretendard', sans-serif",
            }}
        >
            <style>
                {`
          @keyframes dexPreviewCasterPulse {
            0% { transform: translate(0, 0) scale(1); filter: drop-shadow(0 10px 10px rgba(0,0,0,0.16)); }
            18% { transform: translate(-8px, 8px) scale(0.96); }
            46% { transform: translate(18px, -18px) scale(1.08); filter: brightness(1.25) drop-shadow(0 0 18px rgba(51,154,240,0.55)); }
            72% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(0, 0) scale(1); filter: drop-shadow(0 10px 10px rgba(0,0,0,0.16)); }
          }

          @keyframes dexPreviewTargetHit {
            0% { transform: translate(0, 0) rotate(0deg); filter: drop-shadow(0 10px 10px rgba(0,0,0,0.16)); }
            20% { transform: translate(7px, -4px) rotate(3deg); filter: brightness(1.5) drop-shadow(0 0 14px rgba(250,82,82,0.55)); }
            40% { transform: translate(-6px, 5px) rotate(-3deg); filter: brightness(1.25) drop-shadow(0 0 12px rgba(250,82,82,0.45)); }
            65% { transform: translate(4px, -2px) rotate(1deg); }
            100% { transform: translate(0, 0) rotate(0deg); filter: drop-shadow(0 10px 10px rgba(0,0,0,0.16)); }
          }
           .dexStatusAura--aching {
            background:
              radial-gradient(circle, rgba(255,107,107,0.42) 0%, rgba(224,49,49,0.18) 42%, rgba(224,49,49,0.03) 72%),
              repeating-radial-gradient(circle, rgba(224,49,49,0.32) 0 2px, transparent 2px 8px);
            border: 4px dashed rgba(224,49,49,0.95);
            box-shadow:
              0 0 24px rgba(224,49,49,0.55),
              inset 0 0 22px rgba(255,107,107,0.35);
            overflow: visible;
            animation:
              dexAuraPulse 0.45s ease-out forwards,
              dexAcheThrob 0.34s ease-in-out infinite;
          }

          .dexStatusAura--aching::before,
          .dexStatusAura--aching::after {
            content: '';
            position: absolute;
            left: 50%;
            top: 50%;
            width: 128px;
            height: 128px;
            border-radius: 44% 56% 48% 52%;
            border: 3px solid rgba(224,49,49,0.62);
            transform: translate(-50%, -50%) scale(0.75);
            opacity: 0;
            pointer-events: none;
          }

          .dexStatusAura--aching::before {
            animation: dexAcheRipple 0.75s ease-out infinite;
          }

          .dexStatusAura--aching::after {
            animation: dexAcheRipple 0.75s ease-out infinite;
            animation-delay: 0.22s;
            border-color: rgba(255,135,135,0.58);
          }

          .dexStatusAura--aching span {
            animation: dexAcheIconShake 0.26s ease-in-out infinite;
            filter:
              drop-shadow(0 0 8px rgba(255,255,255,0.9))
              drop-shadow(0 0 10px rgba(224,49,49,0.9));
          }

          @keyframes dexAcheThrob {
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

          @keyframes dexAcheRipple {
            0% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.55) rotate(-8deg);
            }
            22% {
              opacity: 0.85;
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.32) rotate(10deg);
            }
          }

          @keyframes dexAcheIconShake {
            0%, 100% {
              transform: translate(0, 0) rotate(0deg) scale(1);
            }
            25% {
              transform: translate(-2px, 1px) rotate(-8deg) scale(1.08);
            }
            50% {
              transform: translate(2px, -1px) rotate(7deg) scale(1.16);
            }
            75% {
              transform: translate(-1px, -2px) rotate(-5deg) scale(1.08);
            }
          }

          @keyframes dexStatusPop {
            0% { opacity: 0; transform: translate(-50%, 10px) scale(0.65); }
            22% { opacity: 1; transform: translate(-50%, -8px) scale(1.08); }
            45% { transform: translate(-50%, 0) scale(1); }
            100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }

          @keyframes dexAuraPulse {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.55); }
            35% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
            100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); }
          }

          @keyframes dexStunSpin {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }

          @keyframes dexBurnFlicker {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.75; }
            50% { transform: translate(-50%, -58%) scale(1.12); opacity: 1; }
          }

          @keyframes dexBoundWiggle {
            0%, 100% { transform: translate(-50%, -50%) rotate(-6deg) scale(1); }
            50% { transform: translate(-50%, -50%) rotate(6deg) scale(1.06); }
          }

          .dexPreviewCaster {
            animation: dexPreviewCasterPulse 1.35s ease-in-out;
          }

          .dexPreviewTargetHit {
            animation: dexPreviewTargetHit 0.42s ease-in-out;
          }

          .dexStatusBadge {
            position: absolute;
            left: 50%;
            top: -12px;
            transform: translateX(-50%);
            z-index: 35;
            display: flex;
            align-items: center;
            gap: 0.35rem;
            background: rgba(255,255,255,0.96);
            border: 2px solid;
            border-radius: 999px;
            padding: 0.34rem 0.55rem;
            animation: dexStatusPop 0.42s ease-out forwards;
            pointer-events: none;
          }

          .dexStatusBadge--caster {
            top: -10px;
          }

          .dexStatusAura {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 118px;
            height: 118px;
            border-radius: 999px;
            transform: translate(-50%, -50%);
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            animation: dexAuraPulse 0.45s ease-out forwards;
          }

          .dexStatusAura span {
            font-size: 2.8rem;
            filter: drop-shadow(0 0 10px rgba(255,255,255,0.8));
          }

          .dexStatusAura--bound {
            border: 5px solid rgba(47,158,68,0.85);
            box-shadow: inset 0 0 22px rgba(64,192,87,0.35), 0 0 20px rgba(64,192,87,0.45);
            animation: dexAuraPulse 0.45s ease-out forwards, dexBoundWiggle 0.65s ease-in-out infinite;
          }

          .dexStatusAura--stun {
            border: 4px dashed rgba(240,140,0,0.9);
            box-shadow: 0 0 22px rgba(255,212,59,0.55);
            animation: dexAuraPulse 0.45s ease-out forwards, dexStunSpin 1.5s linear infinite;
          }

          .dexStatusAura--poison {
            background: radial-gradient(circle, rgba(55,178,77,0.35), rgba(116,192,252,0) 70%);
            border: 4px dotted rgba(55,178,77,0.95);
            box-shadow: 0 0 22px rgba(55,178,77,0.45);
          }

          .dexStatusAura--burn {
            background: radial-gradient(circle, rgba(255,107,53,0.45), rgba(255,107,53,0) 72%);
            border: 4px solid rgba(240,62,62,0.75);
            box-shadow: 0 0 26px rgba(240,62,62,0.52);
            animation: dexAuraPulse 0.45s ease-out forwards, dexBurnFlicker 0.55s ease-in-out infinite;
          }

          .dexStatusAura--blind {
            background: radial-gradient(circle, rgba(73,80,87,0.5), rgba(73,80,87,0.05) 70%);
            border: 4px dashed rgba(134,142,150,0.95);
            box-shadow: 0 0 20px rgba(73,80,87,0.35);
          }

          .dexStatusAura--counter {
            border: 5px solid rgba(240,140,0,0.9);
            box-shadow: inset 0 0 24px rgba(255,212,59,0.35), 0 0 24px rgba(255,212,59,0.55);
          }

          .dexStatusAura--recharge {
            background: radial-gradient(circle, rgba(255,107,53,0.25), rgba(255,107,53,0) 70%);
            border: 4px dashed rgba(255,107,53,0.9);
          }

          .dexStatusAura--buff,
          .dexStatusAura--focus {
            border: 4px solid rgba(132,94,247,0.85);
            box-shadow: inset 0 0 22px rgba(132,94,247,0.25), 0 0 20px rgba(132,94,247,0.45);
          }

          .dexStatusAura--heal {
            background: radial-gradient(circle, rgba(230,73,128,0.32), rgba(230,73,128,0) 70%);
            border: 4px solid rgba(230,73,128,0.75);
            box-shadow: 0 0 22px rgba(230,73,128,0.45);
          }

          .dexStatusAura--drain {
            background: radial-gradient(circle, rgba(156,54,181,0.32), rgba(156,54,181,0) 70%);
            border: 4px solid rgba(156,54,181,0.75);
            box-shadow: 0 0 22px rgba(156,54,181,0.45);
          }
        `}
            </style>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                alignItems: 'flex-start',
                marginBottom: '0.75rem',
            }}>
                <div>
                    <div style={{
                        fontSize: '0.72rem',
                        color: '#adb5bd',
                        fontWeight: 900,
                        marginBottom: '0.18rem',
                    }}>
                        실제 대전 스킬 프리뷰
                    </div>

                    <div style={{
                        fontSize: '1.05rem',
                        fontWeight: 1000,
                        color: 'white',
                    }}>
                        {skillName}
                    </div>

                    <div style={{
                        fontSize: '0.76rem',
                        color: '#ced4da',
                        fontWeight: 800,
                        marginTop: '0.18rem',
                    }}>
                        {skillElement} · 위력 {skillPower}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        border: 'none',
                        background: 'rgba(255,255,255,0.12)',
                        color: 'white',
                        borderRadius: '999px',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontWeight: 1000,
                    }}
                >
                    ×
                </button>
            </div>

            <div
                key={replayKey}
                style={{
                    position: 'relative',
                    height: '230px',
                    overflow: 'hidden',
                    borderRadius: '16px',
                    background: 'radial-gradient(circle, #ffffff 0%, #e7f5ff 100%)',
                    border: '2px solid #d0ebff',
                }}
            >
                <div style={{
                    position: 'absolute',
                    left: '4%',
                    bottom: '4%',
                    width: '160px',
                    height: '160px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {showStatuses && (
                        <BattleStatusEffect
                            statuses={casterStatuses}
                            showAura
                            showBadges
                        />
                    )}
                    {casterImageSrc ? (
                        <img
                            className="dexPreviewCaster"
                            src={casterImageSrc}
                            alt="스킬 사용하는 펫"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                position: 'relative',
                                zIndex: 12,
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '110px',
                            height: '110px',
                            borderRadius: '999px',
                            background: '#adb5bd',
                            position: 'relative',
                            zIndex: 12,
                        }} />
                    )}
                </div>

                <div style={{
                    position: 'absolute',
                    right: '4%',
                    top: '4%',
                    width: '160px',
                    height: '160px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {showStatuses && (
                        <BattleStatusEffect
                            statuses={targetStatuses}
                            showAura
                            showBadges
                        />
                    )}
                    {targetImageSrc ? (
                        <img
                            className={isTargetHit ? 'dexPreviewTargetHit' : ''}
                            src={targetImageSrc}
                            alt="피격 펫"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.16))',
                                position: 'relative',
                                zIndex: 12,
                            }}
                        />
                    ) : (
                        <div
                            className={isTargetHit ? 'dexPreviewTargetHit' : ''}
                            style={{
                                width: '110px',
                                height: '110px',
                                borderRadius: '999px',
                                background: '#ced4da',
                                position: 'relative',
                                zIndex: 12,
                            }}
                        />
                    )}
                </div>

                <BattleSkillEffect
                    key={`${skillType}-${replayKey}`}
                    type={skillType}
                    isMine
                />
            </div>

            <div style={{
                marginTop: '0.7rem',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '0.65rem 0.75rem',
                color: '#e9ecef',
                fontSize: '0.78rem',
                lineHeight: 1.45,
                fontWeight: 750,
            }}>
                {getSkillDescription(skill)}
            </div>
        </div>
    );
}

export default SkillPreview;