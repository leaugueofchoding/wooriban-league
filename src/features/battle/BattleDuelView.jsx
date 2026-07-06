// src/features/battle/BattleDuelView.jsx
// 기존 1:1 BattlePage의 전투 화면을 1:1/팀대전이 함께 쓰기 위한 렌더링 전담 컴포넌트입니다.

import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import { petImageMap } from '../../utils/petImageMap';
import BattleSkillEffect from './BattleSkillEffect';
import { BattleHpBar, BattleSpBar } from './BattleStatBars';
import BattlePetSlot from './BattlePetSlot';
import BattleTeamMiniBar from './BattleTeamMiniBar';
import BattlePlayerPanel from './BattlePlayerPanel';
import BattleActionMenu from './BattleActionMenu';

const noop = () => {};

const formatDefaultBattleLog = (log) => {
    if (Array.isArray(log)) return log.join('\n');
    return log || '';
};

const defaultRenderHpBar = (hp, maxHp) => <BattleHpBar hp={hp} maxHp={maxHp} />;
const defaultRenderSpBar = (sp, maxSp) => <BattleSpBar sp={sp} maxSp={maxSp} />;

const defaultGetPetImageSrc = (info, isMine) => {
    if (!info?.pet) return null;

    const appearanceId = info.pet.appearanceId || info.pet.species || '';
    if (!appearanceId) return null;

    return isMine
        ? (petImageMap[`${appearanceId}_battle`] || petImageMap[`${appearanceId}_back`] || petImageMap[appearanceId])
        : (petImageMap[`${appearanceId}_idle`] || petImageMap[appearanceId]);
};

const floatDamage = keyframes`
    0% { opacity: 0; transform: translate(-50%, 12px) scale(0.82); }
    15% { opacity: 1; transform: translate(-50%, 0) scale(1.08); }
    100% { opacity: 0; transform: translate(-50%, -54px) scale(1); }
`;

const petHit = keyframes`
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-10px); }
    40% { transform: translateX(9px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(4px); }
`;

const petIntro = keyframes`
    0% { opacity: 0; transform: translateY(18px) scale(0.86); filter: brightness(1.25); }
    65% { opacity: 1; transform: translateY(-5px) scale(1.05); }
    100% { opacity: 1; transform: translateY(0) scale(1); filter: none; }
`;

const reactionPulse = keyframes`
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.82); }
    18% { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
    72% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
`;

const BattleContentGrid = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;

    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        grid-template-columns: minmax(620px, 1fr) minmax(320px, 420px);
        align-items: stretch;
    }
`;

const BattleField = styled.div`
    position: relative;
    min-height: 560px;
    border-radius: 28px;
    overflow: hidden;
    border: 5px solid #2f3e46;
    background: linear-gradient(180deg, #a5d8ff 0%, #d8f5a2 52%, #8ce99a 53%, #69db7c 100%);
    box-shadow: inset 0 -18px 0 rgba(47, 62, 70, 0.16), 0 16px 38px rgba(0, 0, 0, 0.16);

    ${props => props.$theme === 'night' && css`
        background: linear-gradient(180deg, #172554 0%, #364fc7 48%, #2b8a3e 49%, #1b4332 100%);
    `}

    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        min-height: calc(100vh - 96px);
    }
`;

const Timer = styled.div`
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 22;
    min-width: 62px;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    background: ${props => props.$variant === 'switch' ? '#7950f2' : '#212529'};
    color: white;
    font-size: 1.35rem;
    font-weight: 1000;
    text-align: center;
    box-shadow: 0 8px 22px rgba(0,0,0,0.22);
`;

const SwitchMessage = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 30;
    transform: translate(-50%, calc(-50% + 78px));
    max-width: 80%;
    padding: 0.65rem 1.1rem;
    border-radius: 999px;
    background: rgba(33, 37, 41, 0.88);
    color: white;
    font-weight: 900;
    font-size: 1rem;
    text-align: center;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.22);
`;

const FloatingDamageNumber = styled.div`
    position: absolute;
    z-index: 34;
    left: ${props => props.$side === 'my' ? '34%' : '66%'};
    top: ${props => props.$lane ? `${34 + Number(props.$lane) * 7}%` : '39%'};
    color: ${props => props.$color || '#ff6b6b'};
    text-shadow: ${props => props.$stroke || '0 2px 0 rgba(0,0,0,0.35)'};
    font-weight: 1000;
    font-size: ${props => props.$kind === 'heal' ? '1.35rem' : '1.55rem'};
    animation: ${floatDamage} 1.1s ease-out forwards;
    animation-delay: ${props => Number(props.$delay || 0)}ms;
    pointer-events: none;

    .damageLabel {
        display: block;
        font-size: 0.68rem;
        line-height: 1;
        text-align: center;
    }

    .damageAmount {
        display: block;
        line-height: 1;
    }
`;

const ReactionFlashOverlay = styled.div`
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 36;
    transform: translate(-50%, -50%);
    min-width: 180px;
    padding: 1rem 1.25rem;
    border-radius: 24px;
    background: linear-gradient(135deg, ${props => props.$toneA || '#ffd43b'}, ${props => props.$toneB || '#74c0fc'});
    color: white;
    font-weight: 1000;
    text-align: center;
    box-shadow: 0 18px 42px rgba(0,0,0,0.24);
    animation: ${reactionPulse} 1.15s ease-out forwards;
    pointer-events: none;

    .reactionIcon {
        display: block;
        font-size: 2.1rem;
        line-height: 1;
    }

    .reactionLabel {
        display: block;
        margin-top: 0.25rem;
        font-size: 1.1rem;
    }
`;

const ProfileWrapper = styled.div`
    position: absolute;
    z-index: 12;
    display: flex;
    align-items: center;
    gap: 0.65rem;
`;

const MyProfileWrapper = styled(ProfileWrapper)`
    left: 18px;
    top: 18px;
`;

const OpponentProfileWrapper = styled(ProfileWrapper)`
    right: 18px;
    bottom: 18px;
    flex-direction: row-reverse;
`;

const AvatarBox = styled.div`
    display: grid;
    justify-items: center;
    gap: 0.25rem;

    .avatar-img-frame {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        overflow: hidden;
        background: white;
        border: 3px solid rgba(255,255,255,0.95);
        box-shadow: 0 6px 16px rgba(0,0,0,0.18);
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .name-badge {
        padding: 0.18rem 0.45rem;
        border-radius: 999px;
        color: white;
        font-size: 0.72rem;
        font-weight: 1000;
        box-shadow: 0 3px 8px rgba(0,0,0,0.16);
    }

    .name-badge.mine { background: #1c7ed6; }
    .name-badge.opponent { background: #e03131; }
`;

const InfoBox = styled.div`
    min-width: 180px;
    padding: 0.62rem 0.75rem;
    border-radius: 16px;
    background: rgba(255,255,255,0.9);
    border: 2px solid rgba(255,255,255,0.96);
    box-shadow: 0 8px 20px rgba(0,0,0,0.14);

    span {
        display: block;
        margin-bottom: 0.34rem;
        color: #343a40;
        font-size: 0.88rem;
        font-weight: 1000;
    }
`;

const MyInfoBox = styled(InfoBox)``;
const OpponentInfoBox = styled(InfoBox)``;

const PetContainerWrapper = styled.div`
    position: absolute;
    z-index: 10;
`;

const MyPetContainerWrapper = styled(PetContainerWrapper)`
    left: 18%;
    bottom: 64px;
`;

const OpponentPetContainerWrapper = styled(PetContainerWrapper)`
    right: 17%;
    top: 118px;
`;

const PetContainer = styled.div`
    position: relative;
    width: ${props => props.$isMine ? '220px' : '190px'};
    height: ${props => props.$isMine ? '220px' : '190px'};
    display: grid;
    place-items: center;

    ${props => props.$isHit && css`
        animation: ${petHit} 0.42s ease-in-out;
    `}

    ${props => props.$intro && css`
        animation: ${petIntro} 0.72s ease-out;
    `}

    ${props => props.$animType === 'attack' && css`
        transform: translateX(${props.$isMine ? '34px' : '-34px'});
        transition: transform 0.18s ease-out;
    `}
`;

const PetImage = styled.img`
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    image-rendering: auto;
    opacity: ${props => props.$forceHidden ? 0 : props.$isFainted ? 0.45 : 1};
    filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
    transform: ${props => props.$isFainted ? 'rotate(-8deg) translateY(12px)' : 'none'};
    transition: opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease;
`;

const ChatBubble = styled.div`
    position: absolute;
    left: 50%;
    top: -16px;
    z-index: 20;
    transform: translateX(-50%);
    max-width: 160px;
    padding: 0.38rem 0.55rem;
    border-radius: 12px;
    background: ${props => props.$isCorrect ? '#ebfbee' : '#fff5f5'};
    color: ${props => props.$isCorrect ? '#2b8a3e' : '#c92a2a'};
    border: 2px solid ${props => props.$isCorrect ? '#b2f2bb' : '#ffc9c9'};
    font-weight: 900;
    font-size: 0.78rem;
    text-align: center;
    box-shadow: 0 6px 14px rgba(0,0,0,0.15);
`;

const QuizArea = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;

    @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
        align-self: stretch;
        grid-template-rows: minmax(0, 1fr) auto;
    }
`;

const LogText = styled.div`
    padding: 0.9rem 1rem;
    border-radius: 16px;
    background: #f8f9fa;
    color: #343a40;
    border: 2px solid #e9ecef;
    font-weight: 850;
    line-height: 1.55;
    white-space: pre-line;
`;

const BattlePrompt = styled.div`
    margin-top: 0.85rem;
    padding: 1rem;
    border-radius: 18px;
    background: #fff;
    border: 3px solid #339af0;
    color: #1864ab;
    font-size: 1.08rem;
    font-weight: 1000;
    line-height: 1.45;
`;

const RightActionPanel = styled.div`
    display: grid;
    gap: 0.75rem;
    align-content: start;
`;

const RightTaskCard = styled.div`
    padding: 0.85rem;
    border-radius: 16px;
    background: white;
    border: 2px solid #dee2e6;
    color: #343a40;
    font-weight: 900;
    line-height: 1.45;
`;

const OXGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
`;

const OXButton = styled.button`
    border: 3px solid ${props => props.$ox === 'O' ? '#339af0' : '#fa5252'};
    border-radius: 18px;
    padding: 0.9rem;
    background: white;
    font-size: 1.7rem;
    font-weight: 1000;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const OptionGrid = styled.div`
    display: grid;
    gap: 0.55rem;
`;

const OptionButton = styled.button`
    border: 2px solid #339af0;
    border-radius: 14px;
    padding: 0.72rem 0.8rem;
    background: #f8f9fa;
    color: #1864ab;
    font-weight: 900;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const AnswerInput = styled.input`
    width: 100%;
    box-sizing: border-box;
    border: 2px solid #339af0;
    border-radius: 14px;
    padding: 0.78rem 0.85rem;
    font-size: 1rem;
    font-weight: 850;
`;

const ActionMenu = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
`;

const MenuItem = styled.button`
    min-height: 48px;
    border: 2px solid #364fc7;
    border-radius: 14px;
    padding: 0.65rem 0.7rem;
    background: #edf2ff;
    color: #364fc7;
    font-weight: 1000;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

function BattleDuelView({
    battleState,
    myPlayerData,
    myInfo,
    opponentInfo,
    viewerRole,
    timeLeft,
    showTimer,
    switchMessage,
    floatingNumbers = [],
    reactionFlash,
    currentEffect,
    dotEffect,
    hitState = {},
    animState = {},
    ultimateSecretHide = {},
    introActive = false,
    switchIntro = {},
    getPetImageSrc = defaultGetPetImageSrc,
    renderHpBar = defaultRenderHpBar,
    renderSpBar = defaultRenderSpBar,
    formatBattleLogForDisplay = formatDefaultBattleLog,
    isQuizBlockedByCc = false,
    isFrozen = false,
    isStaggered = false,
    hasSubmitted = false,
    isOX = false,
    hasOptions = false,
    shuffledOptions = [],
    answer = '',
    setAnswer = noop,
    isProcessing = false,
    canAnswerQuiz = true,
    onQuizSubmit = noop,
    onOptionClick = noop,
    pendingSwitchForMe = false,
    pendingSwitchPets = [],
    onFaintedPetSwitch = noop,
    showActionMenu = false,
    showDefenseMenu = false,
    actionSubMenu = null,
    setActionSubMenu = noop,
    myEquippedSkills = [],
    usableItems = [],
    getSkillCost = (skill) => Number(skill?.cost || 0),
    onActionSelect = noop,
    onUseItem = noop,
    switchablePets = [],
    onManualSwitch = noop,
    defenseActions = {},
}) {
    const status = battleState?.status;
    const viewerId = myPlayerData?.id || myInfo?.id;
    const question = battleState?.question;
    const chat = battleState?.chat || {};
    const viewerChatEntry = viewerId ? chat[viewerId] : null;
    const displayedLog = formatBattleLogForDisplay(battleState?.log);
    const canUseQuizControls = Boolean(canAnswerQuiz && !isQuizBlockedByCc);
    const lockedByRole = viewerRole === 'spectator' || canAnswerQuiz === false;

    return (
        <BattleContentGrid>
            <BattleField $theme={battleState?.battleTheme || 'forest'}>
                {showTimer && <Timer $variant={status === 'pending_switch' ? 'switch' : undefined}>{timeLeft}</Timer>}

                {switchMessage && <SwitchMessage>✨ {switchMessage}</SwitchMessage>}

                {floatingNumbers.map(item => (
                    <FloatingDamageNumber
                        key={item.id}
                        $side={item.side}
                        $kind={item.kind}
                        $color={item.color}
                        $stroke={item.stroke}
                        $glow={item.glow}
                        $delay={item.delay}
                        $lane={item.lane}
                    >
                        {item.label && <span className="damageLabel">{item.label}</span>}
                        <span className="damageAmount">{item.amount}</span>
                    </FloatingDamageNumber>
                ))}

                {reactionFlash && (
                    <ReactionFlashOverlay
                        key={reactionFlash.id}
                        $toneA={reactionFlash.toneA}
                        $toneB={reactionFlash.toneB}
                        $text={reactionFlash.text}
                    >
                        <span className="reactionIcon">{reactionFlash.icon}</span>
                        <span className="reactionLabel">{reactionFlash.label}</span>
                    </ReactionFlashOverlay>
                )}

                {currentEffect && (
                    <BattleSkillEffect
                        key={`${currentEffect.type}-${currentEffect.isMine ? 'mine' : 'opponent'}-${battleState?.turnStartTime ?? 'static'}`}
                        type={currentEffect.type}
                        isMine={currentEffect.isMine}
                    />
                )}

                <BattlePlayerPanel
                    isMine={false}
                    info={opponentInfo}
                    avatarSourceInfo={opponentInfo}
                    WrapperComponent={OpponentProfileWrapper}
                    AvatarBoxComponent={AvatarBox}
                    InfoBoxComponent={OpponentInfoBox}
                    renderHpBar={renderHpBar}
                    renderSpBar={renderSpBar}
                />
                <BattleTeamMiniBar
                    isMine={false}
                    info={opponentInfo}
                    getPetImageSrc={getPetImageSrc}
                />

                <BattlePlayerPanel
                    isMine={true}
                    info={myInfo}
                    avatarSourceInfo={myPlayerData || myInfo}
                    WrapperComponent={MyProfileWrapper}
                    AvatarBoxComponent={AvatarBox}
                    InfoBoxComponent={MyInfoBox}
                    renderHpBar={renderHpBar}
                    renderSpBar={renderSpBar}
                />
                <BattleTeamMiniBar
                    isMine={true}
                    info={myInfo}
                    getPetImageSrc={getPetImageSrc}
                />

                <BattlePetSlot
                    isMine={false}
                    info={opponentInfo}
                    imageSrc={getPetImageSrc(opponentInfo, false)}
                    hitState={hitState.opponent}
                    animType={animState.opponent}
                    forceHidden={ultimateSecretHide.opponent}
                    introActive={introActive || switchIntro.opponent}
                    dotEffect={dotEffect}
                    chatEntry={opponentInfo?.id ? chat[opponentInfo.id] : null}
                    WrapperComponent={OpponentPetContainerWrapper}
                    PetContainerComponent={PetContainer}
                    PetImageComponent={PetImage}
                    ChatBubbleComponent={ChatBubble}
                />
                <BattlePetSlot
                    isMine={true}
                    info={myInfo}
                    imageSrc={getPetImageSrc(myInfo, true)}
                    hitState={hitState.my}
                    animType={animState.my}
                    forceHidden={ultimateSecretHide.my}
                    introActive={introActive || switchIntro.my}
                    dotEffect={dotEffect}
                    chatEntry={myInfo?.id ? chat[myInfo.id] : null}
                    WrapperComponent={MyPetContainerWrapper}
                    PetContainerComponent={PetContainer}
                    PetImageComponent={PetImage}
                    ChatBubbleComponent={ChatBubble}
                />
            </BattleField>

            <QuizArea>
                <div>
                    <LogText>{displayedLog}</LogText>

                    {status === 'switching' && (
                        <RightTaskCard style={{ marginTop: '1rem', background: '#fff9db', borderColor: '#ffd43b', color: '#5f3dc4', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.25rem' }}>🔁 펫 교체 중!</div>
                            <div>새 펫이 등장했습니다. 잠시 후 다음 문제가 시작됩니다.</div>
                        </RightTaskCard>
                    )}

                    {status === 'pending_switch' && (
                        <RightTaskCard
                            style={{
                                marginTop: '1rem',
                                background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                            }}
                        >
                            {pendingSwitchForMe ? (
                                <>
                                    <div style={{ fontSize: '1.18rem', marginBottom: '0.25rem' }}>💫 다음 펫 선택</div>
                                    <div style={{ fontSize: '0.9rem' }}>오른쪽 영역에서 다음 펫을 고르세요.</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '1.18rem' }}>⏳ 상대 선택 대기 중</div>
                                    <div style={{ fontSize: '0.9rem' }}>상대가 다음 펫을 고르는 중입니다.</div>
                                </>
                            )}
                        </RightTaskCard>
                    )}

                    {status === 'quiz' && question && (
                        <>
                            <BattlePrompt>Q. {question.question}</BattlePrompt>
                            {isQuizBlockedByCc ? (
                                <RightTaskCard style={{ marginTop: '1rem', color: '#e03131', background: '#fff5f5', borderColor: '#ffc9c9' }}>
                                    <div style={{ fontSize: '1.15rem' }}>{isFrozen ? '❄️ 빙결 상태!' : isStaggered ? '⚡ 경직 상태!' : '💫 기절 상태!'}</div>
                                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>문제는 보이지만 이번 턴에는 정답을 제출할 수 없습니다.</div>
                                </RightTaskCard>
                            ) : lockedByRole ? (
                                <RightTaskCard style={{ marginTop: '1rem', color: '#495057', background: '#f8f9fa', borderColor: '#dee2e6' }}>
                                    <div style={{ fontSize: '1.1rem' }}>👀 관전 중</div>
                                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>현재 출전한 학생만 정답을 선택할 수 있습니다.</div>
                                </RightTaskCard>
                            ) : hasSubmitted && (isOX || hasOptions) ? (
                                <RightTaskCard
                                    style={{
                                        marginTop: '1rem',
                                        color: viewerChatEntry?.isCorrect ? '#2b8a3e' : '#c92a2a',
                                        background: viewerChatEntry?.isCorrect ? '#ebfbee' : '#fff5f5',
                                        borderColor: viewerChatEntry?.isCorrect ? '#b2f2bb' : '#ffc9c9',
                                    }}
                                >
                                    {viewerChatEntry?.isCorrect
                                        ? '정답입니다! 오른쪽 영역에서 다음 행동을 기다려주세요.'
                                        : '오답입니다... 상대방의 결과를 기다리고 있습니다.'}
                                </RightTaskCard>
                            ) : null}
                        </>
                    )}
                </div>

                <RightActionPanel>
                    {status === 'pending_switch' && (
                        <RightTaskCard
                            style={{
                                background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                            }}
                        >
                            {pendingSwitchForMe ? (
                                <>
                                    <div style={{ fontSize: '1.12rem', marginBottom: '0.45rem' }}>💫 출전할 펫 선택</div>
                                    <div style={{ fontSize: '0.84rem', marginBottom: '0.65rem', opacity: 0.85 }}>
                                        10초 안에 고르세요. 시간이 지나면 자동 선택됩니다.
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.55rem' }}>
                                        {pendingSwitchPets.map(pet => (
                                            <MenuItem
                                                key={pet.id}
                                                onClick={() => onFaintedPetSwitch(pet.id)}
                                                disabled={isProcessing}
                                                style={{
                                                    backgroundColor: 'white',
                                                    borderColor: '#7950f2',
                                                    color: '#5f3dc4',
                                                    flexDirection: 'column',
                                                    gap: '0.15rem',
                                                }}
                                            >
                                                <span>{pet.name}</span>
                                                <small>Lv.{pet.level || 1} · HP {Math.max(0, Number(pet.hp ?? 0))}/{pet.maxHp ?? '?'}</small>
                                            </MenuItem>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontSize: '1.12rem' }}>⏳ 상대 선택 대기</div>
                                    <div style={{ fontSize: '0.86rem', marginTop: '0.35rem', opacity: 0.85 }}>
                                        상대가 선택하거나 시간이 지나면 다음 문제가 시작됩니다.
                                    </div>
                                </>
                            )}
                        </RightTaskCard>
                    )}

                    {status === 'quiz' && question && !isQuizBlockedByCc && canAnswerQuiz && (
                        <RightTaskCard style={{ background: '#ffffff', borderColor: '#339af0' }}>
                            <div style={{ fontSize: '1.05rem', marginBottom: '0.6rem', color: '#1864ab' }}>✏️ 정답 선택</div>
                            {isOX ? (
                                <OXGrid>
                                    {['O', 'X'].map(ox => (
                                        <OXButton
                                            key={ox}
                                            $ox={ox}
                                            onClick={() => onOptionClick(ox)}
                                            disabled={isProcessing || hasSubmitted || !canUseQuizControls}
                                        >
                                            {ox === 'O' ? '⭕' : '❌'}
                                        </OXButton>
                                    ))}
                                </OXGrid>
                            ) : question.options && question.options.length > 0 ? (
                                <OptionGrid>
                                    {shuffledOptions.map((opt, idx) => (
                                        <OptionButton
                                            key={`${opt}-${idx}`}
                                            onClick={() => onOptionClick(opt)}
                                            disabled={isProcessing || hasSubmitted || !canUseQuizControls}
                                        >
                                            {opt}
                                        </OptionButton>
                                    ))}
                                </OptionGrid>
                            ) : (
                                <form onSubmit={onQuizSubmit}>
                                    <AnswerInput
                                        name="answer"
                                        value={answer}
                                        onChange={(event) => setAnswer(event.target.value)}
                                        placeholder="정답을 입력하세요"
                                        disabled={isProcessing || !canUseQuizControls || (hasSubmitted && viewerChatEntry?.isCorrect)}
                                    />
                                </form>
                            )}
                            {hasSubmitted && (isOX || hasOptions) && (
                                <div style={{ textAlign: 'center', marginTop: '12px', color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    {viewerChatEntry?.isCorrect ? '정답입니다! 처리 중...' : '오답입니다... 대기 중'}
                                </div>
                            )}
                        </RightTaskCard>
                    )}

                    <BattleActionMenu
                        isStunned={isFrozen || isStaggered ? false : false}
                        isStaggered={isStaggered}
                        isFrozen={isFrozen}
                        isBound={Boolean(myInfo?.pet?.status?.bound)}
                        showActionMenu={showActionMenu}
                        showDefenseMenu={showDefenseMenu}
                        actionSubMenu={actionSubMenu}
                        setActionSubMenu={setActionSubMenu}
                        myEquippedSkills={myEquippedSkills}
                        myInfo={myInfo}
                        usableItems={usableItems}
                        getSkillCost={getSkillCost}
                        handleActionSelect={onActionSelect}
                        handleUseItem={onUseItem}
                        switchablePets={showActionMenu && !myInfo?.pet?.status?.bound ? switchablePets : []}
                        handleManualSwitch={onManualSwitch}
                        DEFENSE_ACTIONS={defenseActions}
                        ActionMenuComponent={ActionMenu}
                        MenuItemComponent={MenuItem}
                    />
                </RightActionPanel>
            </QuizArea>
        </BattleContentGrid>
    );
}

export default BattleDuelView;
