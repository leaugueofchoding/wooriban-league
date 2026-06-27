// patch-m19-right-action-quiz-panel.cjs
// M19: 정답 입력/다음 펫 선택 UI를 오른쪽 액션 영역으로 이동
//
// 목표:
// - 왼쪽: 전투 로그 + 문제 지문/상태 안내
// - 오른쪽: OX/객관식/주관식 정답 입력 + 쓰러진 뒤 다음 펫 선택 + 기존 공격/방어 메뉴
// - 전투 로직 함수(handleActionSelect, handleResolution 등)는 건드리지 않음
//
// 변경 파일:
// - src/features/battle/BattlePage.jsx
//
// 실행 위치:
//   C:\Users\Zell-yeah\우리반리그
// 실행:
//   node .\patch-m19-right-action-quiz-panel.cjs

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const battlePath = path.join(projectRoot, 'src', 'features', 'battle', 'BattlePage.jsx');

if (!fs.existsSync(battlePath)) {
  console.error('[실패] src/features/battle/BattlePage.jsx를 찾을 수 없습니다.');
  console.error('현재 위치:', projectRoot);
  process.exit(1);
}

const backupDir = path.join(projectRoot, '.patch-backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const original = fs.readFileSync(battlePath, 'utf8');
const originalEol = original.includes('\r\n') ? '\r\n' : '\n';
const backupPath = path.join(backupDir, `BattlePage.before-m19-right-action-quiz-panel.${timestamp}.jsx`);
fs.writeFileSync(backupPath, original, 'utf8');

let text = original.replace(/\r\n/g, '\n');

function restoreAndFail(error) {
  fs.writeFileSync(battlePath, original, 'utf8');
  console.error(error.message || error);
  console.error('[복구] 패치 실패로 원본을 다시 복원했습니다.');
  console.error('백업 파일:', backupPath);
  process.exit(1);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`[패치 실패] ${label} 위치를 찾지 못했습니다.`);
  }
  return source.replace(search, replacement);
}

try {
  if (text.includes('M19_RIGHT_ACTION_QUIZ_PANEL_PATCH')) {
    console.log('[안내] 이미 M19 오른쪽 액션 퀴즈 패치가 적용되어 있습니다.');
    process.exit(0);
  }

  const styleAnchor = `const LogText = styled.p\` 
  font-size: 1.3rem; font-weight: 700; min-height: 60px; margin: 0 0 1rem 0; color: #343a40;
  display: flex; align-items: center; white-space: pre-line;
\`;
`;

  const styleInsert = `const LogText = styled.p\` 
  font-size: 1.3rem; font-weight: 700; min-height: 60px; margin: 0 0 1rem 0; color: #343a40;
  display: flex; align-items: center; white-space: pre-line;
\`;

// M19_RIGHT_ACTION_QUIZ_PANEL_PATCH
const BattlePrompt = styled.h3\`
  margin: 0.75rem 0 0;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  color: #212529;
  font-size: 1.15rem;
  line-height: 1.5;
\`;

const RightActionPanel = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  align-self: stretch;
\`;

const RightTaskCard = styled.div\`
  padding: 0.95rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  color: #343a40;
  font-weight: 900;
  text-align: center;
  line-height: 1.5;
\`;

`;

  text = replaceOnce(text, styleAnchor, styleInsert, 'M19 styled components 추가');

  const oldPendingBlock = `                                {battleState.status === 'pending_switch' && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        borderRadius: '16px',
                                        background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                        border: pendingSwitchForMe ? '2px solid #7950f2' : '2px solid #dee2e6',
                                        color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                                        fontWeight: 900,
                                        textAlign: 'center',
                                        lineHeight: 1.6,
                                    }}>
                                        {pendingSwitchForMe ? (
                                            <>
                                                <div style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>💫 다음 펫을 선택하세요!</div>
                                                <div style={{ marginBottom: '0.8rem' }}>10초 안에 출전할 펫을 고르세요. 시간이 지나면 자동으로 선택됩니다.</div>
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                                    gap: '0.6rem',
                                                }}>
                                                    {pendingSwitchPets.map(pet => (
                                                        <button
                                                            key={pet.id}
                                                            onClick={() => handleFaintedPetSwitch(pet.id)}
                                                            disabled={isProcessing}
                                                            style={{
                                                                padding: '0.75rem',
                                                                borderRadius: '14px',
                                                                border: '2px solid #7950f2',
                                                                background: 'white',
                                                                color: '#5f3dc4',
                                                                fontWeight: 900,
                                                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                                            }}
                                                        >
                                                            <div>{pet.name}</div>
                                                            <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                                                                Lv.{pet.level || 1} · HP {Math.max(0, Number(pet.hp ?? 0))}/{pet.maxHp ?? '?'}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '1.25rem' }}>⏳ 상대가 다음 펫을 고르는 중입니다.</div>
                                                <div>상대가 선택하거나 10초가 지나면 다음 문제가 시작됩니다.</div>
                                            </>
                                        )}
                                    </div>
                                )}`;

  const newPendingBlock = `                                {battleState.status === 'pending_switch' && (
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
                                )}`;

  text = replaceOnce(text, oldPendingBlock, newPendingBlock, '왼쪽 pending_switch 선택 UI 축소');

  const oldQuizBlock = `                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <h3>Q. {battleState.question.question}</h3>
                                        {isStunned ? (
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <p style={{ color: 'red', fontWeight: 'bold', fontSize: '1.2rem' }}>😵 혼란 상태! 아무것도 할 수 없습니다.</p>
                                                <p>(상대방의 행동을 기다리는 중...)</p>
                                            </div>
                                        ) : (
                                            <>
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
                                                                autoFocus
                                                                disabled={isProcessing || (hasSubmitted && battleState.chat?.[myPlayerData.id]?.isCorrect)}
                                                            />
                                                        </form>
                                                    );
                                                })()}
                                                {hasSubmitted && (isOX || hasOptions) && (
                                                    <div style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontWeight: 'bold' }}>
                                                        {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                            ? "정답입니다! (처리 중...)"
                                                            : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}`;

  const newQuizBlock = `                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <BattlePrompt>Q. {battleState.question.question}</BattlePrompt>
                                        {isStunned ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: '#e03131', background: '#fff5f5', borderColor: '#ffc9c9' }}>
                                                <div style={{ fontSize: '1.15rem' }}>😵 혼란 상태!</div>
                                                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>아무것도 할 수 없습니다. 상대방의 행동을 기다립니다.</div>
                                            </RightTaskCard>
                                        ) : hasSubmitted && (isOX || hasOptions) ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#2b8a3e' : '#c92a2a', background: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#ebfbee' : '#fff5f5', borderColor: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#b2f2bb' : '#ffc9c9' }}>
                                                {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                    ? "정답입니다! 오른쪽 영역에서 다음 행동을 기다려주세요."
                                                    : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                            </RightTaskCard>
                                        ) : (
                                            <div style={{ marginTop: '0.75rem', color: '#868e96', fontWeight: 800 }}>
                                                정답 입력과 선택지는 오른쪽 영역에 표시됩니다.
                                            </div>
                                        )}
                                    </>
                                )}`;

  text = replaceOnce(text, oldQuizBlock, newQuizBlock, '왼쪽 quiz 정답 UI 축소');

  const oldRightMenu = `                            <BattleActionMenu
                                isStunned={isStunned}
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
                            />`;

  const newRightMenu = `                            <RightActionPanel>
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

                                {battleState.status === 'quiz' && battleState.question && !isStunned && (
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
                                                        autoFocus
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
                            </RightActionPanel>`;

  text = replaceOnce(text, oldRightMenu, newRightMenu, '오른쪽 액션 패널 재배치');

  fs.writeFileSync(battlePath, text.replace(/\n/g, originalEol), 'utf8');

  console.log('[완료] M19 오른쪽 액션 퀴즈 패널 패치가 적용되었습니다.');
  console.log('수정 파일:', battlePath);
  console.log('백업 파일:', backupPath);
  console.log('');
  console.log('변경 요약:');
  console.log('  - 왼쪽 영역은 로그와 문제 지문 중심으로 축소');
  console.log('  - O/X, 객관식, 주관식 정답 입력을 오른쪽 액션 영역으로 이동');
  console.log('  - 쓰러진 뒤 다음 펫 선택 메뉴를 오른쪽 액션 영역으로 이동');
  console.log('  - 기존 공격/방어/아이템/수동 교체 메뉴는 오른쪽 영역 하단에 유지');
  console.log('');
  console.log('다음 명령어를 실행해 확인하세요:');
  console.log('  npm run dev');
} catch (error) {
  restoreAndFail(error);
}
