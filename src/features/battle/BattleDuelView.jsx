// src/features/battle/BattleDuelView.jsx
// BATTLE_DUEL_VIEW_EXTRACTED_FROM_BATTLE_PAGE
// 기존 BattlePage.jsx의 렌더링 구조를 그대로 분리한 공통 뷰입니다.
// 새 UI를 만들지 않고, BattlePage의 styled-components를 components prop으로 주입받아 같은 화면을 유지합니다.

import React from 'react';
import BattleSkillEffect from './BattleSkillEffect';
import BattlePetSlot from './BattlePetSlot';
import BattleTeamMiniBar from './BattleTeamMiniBar';
import BattlePlayerPanel from './BattlePlayerPanel';
import BattleActionMenu from './BattleActionMenu';

export default function BattleDuelView({
    battleState,
    myPlayerData,
    bgmEnabled,
    handleToggleBattleFullscreen,
    handleToggleBgm,
    showTimer,
    timeLeft,
    switchMessage,
    floatingNumbers,
    reactionFlash,
    currentEffect,
    opponentInfo,
    myInfo,
    renderHpBar,
    renderSpBar,
    getPetImageSrc,
    hitState,
    animState,
    ultimateSecretHide,
    introActive,
    switchIntro,
    dotEffect,
    formatBattleLogForDisplay,
    pendingSwitchForMe,
    pendingSwitchPets,
    handleFaintedPetSwitch,
    isProcessing,
    isQuizBlockedByCc,
    isFrozen,
    isStaggered,
    hasSubmitted,
    isOX,
    hasOptions,
    shuffledOptions,
    handleOptionClick,
    handleQuizSubmit,
    answer,
    setAnswer,
    isStunned,
    isBound,
    showActionMenu,
    showDefenseMenu,
    actionSubMenu,
    setActionSubMenu,
    myEquippedSkills,
    usableItems,
    getSkillCost,
    handleActionSelect,
    handleUseItem,
    switchablePets,
    handleManualSwitch,
    availableDefenseActions,
    components,
}) {
    const {
        BattleUtilityBar,
        UtilityButton,
        Arena,
        WaitingText,
        BattleContentGrid,
        BattleField,
        Timer,
        FloatingDamageNumber,
        ReactionFlashOverlay,
        OpponentProfileWrapper,
        MyProfileWrapper,
        AvatarBox,
        OpponentInfoBox,
        MyInfoBox,
        OpponentPetContainerWrapper,
        MyPetContainerWrapper,
        PetContainer,
        PetImage,
        ChatBubble,
        QuizArea,
        LogText,
        RightTaskCard,
        BattlePrompt,
        RightActionPanel,
        OXGrid,
        OXButton,
        OptionGrid,
        OptionButton,
        AnswerInput,
        ActionMenu,
        MenuItem,
    } = components;

    return (
        <>
            <BattleUtilityBar>
                <UtilityButton
                    type="button"
                    onClick={handleToggleBattleFullscreen}
                    title="전체화면"
                    aria-label="전체화면"
                >
                    ⛶ 전체화면
                </UtilityButton>
                <UtilityButton
                    type="button"
                    onClick={handleToggleBgm}
                    title={bgmEnabled ? '배틀 배경음악 끄기' : '배틀 배경음악 켜기'}
                    aria-label={bgmEnabled ? '배틀 배경음악 끄기' : '배틀 배경음악 켜기'}
                    $active={bgmEnabled}
                >
                    {bgmEnabled ? '🎵 BGM ON' : '🎵 BGM OFF'}
                </UtilityButton>
            </BattleUtilityBar>
            <Arena>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <BattleContentGrid>
                        <BattleField $theme={battleState.battleTheme || 'forest'}>
                            {showTimer && <Timer $variant={battleState.status === 'pending_switch' ? 'switch' : undefined}>{timeLeft}</Timer>}
                            {switchMessage && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, calc(-50% + 78px))',
                                        zIndex: 30,
                                        padding: '0.65rem 1.1rem',
                                        borderRadius: '999px',
                                        background: 'rgba(33, 37, 41, 0.88)',
                                        color: 'white',
                                        fontWeight: 900,
                                        fontSize: '1rem',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                                        pointerEvents: 'none',
                                        textAlign: 'center',
                                        maxWidth: '80%',
                                    }}
                                >
                                    ✨ {switchMessage}
                                </div>
                            )}
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

                            {/* M1_BATTLE_EFFECT_DISPLAY_STABILIZE_PATCH: 실제 배틀 이펙트는 currentEffect -> BattleSkillEffect 단일 경로로 호출합니다. */}
                            {currentEffect && (
                                <BattleSkillEffect
                                    key={`${currentEffect.type}-${currentEffect.isMine ? 'mine' : 'opponent'}-${battleState?.turnStartTime ?? 'static'}`}
                                    type={currentEffect.type}
                                    isMine={currentEffect.isMine}
                                />
                            )}

                            {/* --- 상대 정보 표시 --- */}
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

                            {/* --- 나의 정보 표시 --- */}
                            <BattlePlayerPanel
                                isMine={true}
                                info={myInfo}
                                avatarSourceInfo={myPlayerData}
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
                                introActive={(typeof introActive !== 'undefined' ? introActive : false) || switchIntro.opponent}
                                dotEffect={dotEffect}
                                chatEntry={battleState.chat?.[opponentInfo.id]}
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
                                introActive={(typeof introActive !== 'undefined' ? introActive : false) || switchIntro.my}
                                dotEffect={dotEffect}
                                chatEntry={battleState.chat?.[myInfo.id]}
                                WrapperComponent={MyPetContainerWrapper}
                                PetContainerComponent={PetContainer}
                                PetImageComponent={PetImage}
                                ChatBubbleComponent={ChatBubble}
                            />
                        </BattleField>

                        <QuizArea>
                            <div>
                                <LogText>{formatBattleLogForDisplay(battleState.log)}</LogText>
                                {battleState.status === 'switching' && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        borderRadius: '16px',
                                        background: '#fff9db',
                                        border: '2px solid #ffd43b',
                                        color: '#5f3dc4',
                                        fontWeight: 900,
                                        textAlign: 'center',
                                        lineHeight: 1.6,
                                    }}>
                                        <div style={{ fontSize: '1.25rem' }}>🔁 펫 교체 중!</div>
                                        <div>새 펫이 등장했습니다. 잠시 후 다음 문제가 시작됩니다.</div>
                                    </div>
                                )}
                                {battleState.status === 'pending_switch' && (
                                    <RightTaskCard style={{
                                        marginTop: '1rem',
                                        background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                        borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                        color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                                    }}>
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
                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <BattlePrompt>Q. {battleState.question.question}</BattlePrompt>
                                        {isQuizBlockedByCc ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: '#e03131', background: '#fff5f5', borderColor: '#ffc9c9' }}>
                                                <div style={{ fontSize: '1.15rem' }}>{isFrozen ? '❄️ 빙결 상태!' : isStaggered ? '⚡ 경직 상태!' : '💫 기절 상태!'}</div>
                                                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>문제는 보이지만 이번 턴에는 정답을 제출할 수 없습니다.</div>
                                            </RightTaskCard>
                                        ) : hasSubmitted && (isOX || hasOptions) ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#2b8a3e' : '#c92a2a', background: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#ebfbee' : '#fff5f5', borderColor: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#b2f2bb' : '#ffc9c9' }}>
                                                {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                    ? "정답입니다! 오른쪽 영역에서 다음 행동을 기다려주세요."
                                                    : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                            </RightTaskCard>
                                        ) : (
                                            null
                                        )}
                                    </>
                                )}
                            </div>
                            <RightActionPanel>
                                {battleState.status === 'pending_switch' && (
                                    <RightTaskCard style={{
                                        background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                        borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                        color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                                    }}>
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
                                                            onClick={() => handleFaintedPetSwitch(pet.id)}
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

                                {battleState.status === 'quiz' && battleState.question && !isQuizBlockedByCc && (
                                    <RightTaskCard style={{ background: '#ffffff', borderColor: '#339af0' }}>
                                        <div style={{ fontSize: '1.05rem', marginBottom: '0.6rem', color: '#1864ab' }}>✏️ 정답 선택</div>
                                        {(() => {
                                            if (isOX) {
                                                return (
                                                    <OXGrid>
                                                        {['O', 'X'].map(ox => (
                                                            <OXButton
                                                                key={ox}
                                                                $ox={ox}
                                                                onClick={() => handleOptionClick(ox)}
                                                                disabled={isProcessing || hasSubmitted}
                                                            >
                                                                {ox === 'O' ? '⭕' : '❌'}
                                                            </OXButton>
                                                        ))}
                                                    </OXGrid>
                                                );
                                            }

                                            if (battleState.question.options && battleState.question.options.length > 0) {
                                                return (
                                                    <OptionGrid>
                                                        {shuffledOptions.map((opt, idx) => (
                                                            <OptionButton
                                                                key={idx}
                                                                onClick={() => handleOptionClick(opt)}
                                                                disabled={isProcessing || hasSubmitted}
                                                                style={{ opacity: hasSubmitted ? 0.5 : 1, cursor: hasSubmitted ? 'not-allowed' : 'pointer' }}
                                                            >
                                                                {opt}
                                                            </OptionButton>
                                                        ))}
                                                    </OptionGrid>
                                                );
                                            }

                                            return (
                                                <form onSubmit={handleQuizSubmit}>
                                                    <AnswerInput
                                                        name="answer"
                                                        value={answer}
                                                        onChange={(e) => setAnswer(e.target.value)}
                                                        placeholder="정답을 입력하세요"

                                                        disabled={isProcessing || (hasSubmitted && battleState.chat?.[myPlayerData.id]?.isCorrect)}
                                                    />
                                                </form>
                                            );
                                        })()}
                                        {hasSubmitted && (isOX || hasOptions) && (
                                            <div style={{ textAlign: 'center', marginTop: '12px', color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                    ? "정답입니다! 처리 중..."
                                                    : "오답입니다... 대기 중"}
                                            </div>
                                        )}
                                    </RightTaskCard>
                                )}

                                <BattleActionMenu
                                    isStunned={isStunned}
                                    isStaggered={isStaggered}
                                    isFrozen={isFrozen}
                                    isBound={isBound}
                                    showActionMenu={showActionMenu}
                                    showDefenseMenu={showDefenseMenu}
                                    actionSubMenu={actionSubMenu}
                                    setActionSubMenu={setActionSubMenu}
                                    myEquippedSkills={myEquippedSkills}
                                    myInfo={myInfo}
                                    usableItems={usableItems}
                                    getSkillCost={getSkillCost}
                                    handleActionSelect={handleActionSelect}
                                    handleUseItem={handleUseItem}
                                    switchablePets={showActionMenu && !myInfo?.pet?.status?.bound ? switchablePets : []}
                                    handleManualSwitch={handleManualSwitch}
                                    DEFENSE_ACTIONS={availableDefenseActions}
                                    ActionMenuComponent={ActionMenu}
                                    MenuItemComponent={MenuItem}
                                />
                            </RightActionPanel>
                        </QuizArea>
                    </BattleContentGrid>
                )}
            </Arena>
        </>
    );
}
