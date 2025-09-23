// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/store/leagueStore';
import { auth } from '@/api/firebase';
import allQuizzesData from '@/assets/missions.json';
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA, SKILLS } from '@/features/pet/petData';

// --- Styled Components ---
const Arena = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f0f8ff;
  border-radius: 12px;
  border: 5px solid #add8e6;
  overflow: hidden;
`;
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
`;
const BattleField = styled.div`
  height: 550px;
  position: relative;
  margin-bottom: 2rem;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
`;
const PetContainer = styled.div`
  position: absolute;
  animation: ${props => props.$isHit ? shake : 'none'} 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
`;
const MyPetContainer = styled(PetContainer)`
    bottom: 10px;
    left: 10px;
`;
const OpponentPetContainer = styled(PetContainer)`
    top: 10px;
    right: 10px;
`;
const PetImage = styled.img`
  width: 400px;
  height: 400px;
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
  transition: filter 0.3s;
`;
const InfoBox = styled.div`
  position: absolute;
  width: 300px;
  padding: 1rem;
  border: 3px solid #333;
  border-radius: 8px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 5;
`;
const MyInfoBox = styled(InfoBox)`
    right: 10px;
    bottom: 10px;
`;
const OpponentInfoBox = styled(InfoBox)`
    left: 10px;
    top: 10px;
`;
const StatBar = styled.div`
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
`;
const BarFill = styled.div`
  width: ${props => props.$percent}%;
  height: 100%;
  background-color: ${props => props.color};
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
`;
const QuizArea = styled.div`
  padding: 1.5rem;
  background-color: #fff;
  border: 3px solid #333;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 2rem;
  min-height: 200px;
`;
const LogText = styled.p`
  font-size: 1.2rem;
  font-weight: bold;
  min-height: 50px;
  margin: 0;
`;
const AnswerInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  font-size: 1.1rem;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 8px;
  margin-top: 1rem;
`;
const ActionMenu = styled.div`
  border-left: 2px solid #eee;
  padding-left: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;
const MenuItem = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  padding: 0.75rem;
  border-radius: 8px;
  background-color: ${props => props.$isSelected ? '#ddd' : '#f8f9fa'};
  border: 1px solid #dee2e6;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;
  
  &:active {
    background-color: #ccc;
  }
`;
const Timer = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 3rem;
    font-weight: bold;
    color: #dc3545;
    background-color: rgba(255, 255, 255, 0.8);
    padding: 0.5rem 2rem;
    border-radius: 20px;
    border: 3px solid #dc3545;
    z-index: 10;
`;
const ResultModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
`;
const ResultModalContent = styled.div`
  padding: 2rem 3rem;
  background: white;
  border-radius: 12px;
  text-align: center;
  h2 { font-size: 2.5rem; margin-bottom: 1rem; color: ${props => props.$isWinner ? '#007bff' : '#dc3545'}; }
  p { font-size: 1.2rem; margin: 0.5rem 0; }
  button { margin-top: 2rem; padding: 0.8rem 2rem; }
`;

const allQuizzes = Object.values(allQuizzesData).flat();
const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기' };

function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players, processBattleResults } = useLeagueStore();

    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const opponentPlayerData = useMemo(() => players.find(p => p.id === opponentId), [players, opponentId]);

    const [myPet, setMyPet] = useState(null);
    const [opponentPet, setOpponentPet] = useState(null);
    const [gameState, setGameState] = useState('PREPARING');
    const [turn, setTurn] = useState(null);
    const [log, setLog] = useState("");
    const [question, setQuestion] = useState(null);
    const [answer, setAnswer] = useState("");
    const [actionMenu, setActionMenu] = useState({ view: 'main', selectedIndex: null });
    const [petStatus, setPetStatus] = useState({ my: {}, opponent: {} });
    const [timeLeft, setTimeLeft] = useState(10);
    const [battleResult, setBattleResult] = useState(null);
    const timerRef = useRef(null);
    const turnTimeoutRef = useRef(null);

    const myEquippedSkills = useMemo(() => {
        if (!myPet?.equippedSkills) return [];
        return myPet.equippedSkills.map(id => SKILLS[id.toUpperCase()]).filter(Boolean);
    }, [myPet]);

    const opponentEquippedSkills = useMemo(() => {
        if (!opponentPet?.equippedSkills) return [];
        return opponentPet.equippedSkills.map(id => SKILLS[id.toUpperCase()]).filter(Boolean);
    }, [opponentPet]);

    const mainMenuItems = ['기본 공격', '특수 공격'];
    const defenseMenuItems = Object.values(DEFENSE_ACTIONS);

    const handleKeyDown = useCallback((e) => {
        if (gameState !== 'ACTION' && gameState !== 'DEFENSE') return;
        const currentMenu = actionMenu.view === 'main' ? mainMenuItems : (actionMenu.view === 'skills' ? myEquippedSkills : defenseMenuItems);
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.max(0, (prev.selectedIndex ?? 1) - 1) }));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.min(currentMenu.length - 1, (prev.selectedIndex ?? -1) + 1) }));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (actionMenu.selectedIndex !== null) {
                handleMenuSelect(actionMenu.selectedIndex);
            }
        } else if (e.key === 'Backspace' && actionMenu.view === 'skills') {
            e.preventDefault();
            setActionMenu({ view: 'main', selectedIndex: null });
        }
    }, [gameState, actionMenu, mainMenuItems, myEquippedSkills, defenseMenuItems]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (gameState === 'QUIZ' || gameState === 'DEFENSE') {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
                        turnTimeoutRef.current = setTimeout(() => {
                            setLog("시간 초과! 턴이 넘어갑니다.");
                            switchTurn();
                        }, 1500);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => {
            clearInterval(timerRef.current);
            clearTimeout(turnTimeoutRef.current);
        };
    }, [gameState]);


    useEffect(() => {
        if (gameState !== 'PREPARING') return;
        if (!myPlayerData || !opponentPlayerData || !myPlayerData.partnerPetId || !opponentPlayerData.partnerPetId) {
            alert("양쪽 플레이어 모두 파트너 펫을 선택해야 배틀을 시작할 수 있습니다.");
            navigate('/league');
            return;
        }
        setMyPet({ ...myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId), isHit: false, ownerId: myPlayerData.id });
        setOpponentPet({ ...opponentPlayerData.pets.find(p => p.id === opponentPlayerData.partnerPetId), isHit: false, ownerId: opponentPlayerData.id });
        setLog(`${opponentPlayerData.name}에게 대결을 신청합니다!`);
        const firstTurn = Math.random() < 0.5 ? 'my' : 'opponent';
        setTurn(firstTurn);
        turnTimeoutRef.current = setTimeout(() => startTurn(firstTurn), 2000);
    }, [myPlayerData, opponentPlayerData, navigate, gameState]);

    const startTurn = (currentTurn) => {
        setTimeLeft(10);
        setActionMenu({ view: 'main', selectedIndex: null });
        setGameState('TURN_START');

        const activePet = currentTurn === 'my' ? myPet : opponentPet;
        const activeStatusKey = currentTurn === 'my' ? 'my' : 'opponent';

        if (petStatus[activeStatusKey]?.stunned) {
            setLog(`${activePet.name}(이)가 혼란스러워 움직이지 못합니다!`);
            setPetStatus(prev => ({ ...prev, [activeStatusKey]: { ...prev[activeStatusKey], stunned: false } }));

            turnTimeoutRef.current = setTimeout(() => {
                setLog("상대가 행동불능 상태라 턴을 한번 더 가져옵니다!");
                startTurn('my'); // 무조건 나의 턴으로
            }, 2000);
            return;
        }

        if (currentTurn === 'my') {
            setLog("나의 턴! 문제를 풀어주세요.");
            fetchNewQuestion();
            setGameState('QUIZ');
        } else {
            setLog("상대방의 턴! 방어 태세를 선택하세요.");
            setGameState('DEFENSE');
            setActionMenu({ view: 'defense', selectedIndex: null });
        }
    };

    const fetchNewQuestion = () => {
        const randomIndex = Math.floor(Math.random() * allQuizzes.length);
        setQuestion(allQuizzes[randomIndex]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (gameState !== 'QUIZ' || !question) return;
        clearTimeout(turnTimeoutRef.current);
        clearInterval(timerRef.current);
        const isCorrect = answer.trim().toLowerCase() === question.answer.toLowerCase();
        if (isCorrect) {
            setLog("정답! 행동을 선택하세요!");
            setGameState('ACTION');
            setActionMenu({ view: 'main', selectedIndex: null });
        } else {
            setLog("오답입니다! 상대방의 턴!");
            turnTimeoutRef.current = setTimeout(() => switchTurn(), 2000);
        }
        setAnswer("");
    };

    const handleMenuSelect = (index) => {
        if (gameState === 'ACTION' || gameState === 'DEFENSE') {
            clearTimeout(turnTimeoutRef.current);
            clearInterval(timerRef.current);
            setActionMenu(prev => ({ ...prev, selectedIndex: index }));

            if (gameState === 'ACTION') {
                if (actionMenu.view === 'main') {
                    if (index === 0) handleAttack('tackle');
                    else setActionMenu({ view: 'skills', selectedIndex: null });
                } else if (actionMenu.view === 'skills') {
                    const skill = myEquippedSkills[index];
                    if (myPet.sp < skill.cost) {
                        setLog("SP가 부족하여 스킬을 사용할 수 없습니다!");
                        turnTimeoutRef.current = setTimeout(() => startTurn(turn), 2000);
                        return;
                    }
                    handleAttack(skill.id);
                }
            } else if (gameState === 'DEFENSE') {
                const defenseChoice = defenseMenuItems[index];
                setLog(`'${defenseChoice}' 태세를 취합니다. 상대의 공격...`);
                turnTimeoutRef.current = setTimeout(() => {
                    const randomSkill = opponentEquippedSkills[Math.floor(Math.random() * opponentEquippedSkills.length)];
                    const randomAttack = Math.random() < 0.5 ? 'tackle' : (randomSkill?.id || 'tackle');
                    handleResolution(randomAttack, defenseChoice);
                }, 2000);
            }
        }
    };

    const handleAttack = (attackId) => {
        const skillName = SKILLS[attackId.toUpperCase()].name;
        setLog(`'${skillName}' 공격!`);

        const isOpponentStunned = petStatus.opponent.stunned;
        const opponentDefenseChoice = isOpponentStunned ? null : defenseMenuItems[Math.floor(Math.random() * defenseMenuItems.length)];

        if (isOpponentStunned) {
            setLog(prev => prev + ' 상대는 혼란스러워 방어하지 못합니다!');
        } else {
            setLog(prev => prev + ' 상대방이 방어 태세를 취합니다...');
        }

        turnTimeoutRef.current = setTimeout(() => handleResolution(attackId, opponentDefenseChoice), 2000);
    };

    const handleResolution = (attackId, defenseAction) => {
        const isMyTurn = turn === 'my';
        let attacker = isMyTurn ? { ...myPet, status: { ...petStatus.my } } : { ...opponentPet, status: { ...petStatus.opponent } };
        let defender = isMyTurn ? { ...opponentPet, status: { ...petStatus.opponent } } : { ...myPet, status: { ...petStatus.my } };

        if (attacker.status.defenseBuffTurns > 0) attacker.status.defenseBuffTurns--;
        if (defender.status.defenseBuffTurns > 0) defender.status.defenseBuffTurns--;

        const skill = SKILLS[attackId.toUpperCase()];
        let logMessage = skill.effect(attacker, defender);
        if (skill.cost > 0) attacker.sp -= skill.cost;

        const finalAttackerState = { ...attacker, isHit: false };
        const finalDefenderState = { ...defender, isHit: true };
        delete finalAttackerState.status;
        delete finalDefenderState.status;

        if (isMyTurn) {
            setMyPet(finalAttackerState);
            setOpponentPet(finalDefenderState);
        } else {
            setOpponentPet(finalAttackerState);
            setMyPet(finalDefenderState);
        }
        setPetStatus({ my: isMyTurn ? attacker.status : defender.status, opponent: isMyTurn ? defender.status : attacker.status });
        setLog(logMessage);

        turnTimeoutRef.current = setTimeout(() => {
            if (isMyTurn) setOpponentPet(prev => ({ ...prev, isHit: false }));
            else setMyPet(prev => ({ ...prev, isHit: false }));
            switchTurn(finalAttackerState, finalDefenderState);
        }, 2000);
    };

    const switchTurn = async (attacker, defender) => {
        if (gameState === 'FINISHED') return;

        const currentAttacker = attacker || (turn === 'my' ? myPet : opponentPet);
        const currentDefender = defender || (turn === 'my' ? opponentPet : myPet);

        if (currentDefender.hp <= 0) {
            setGameState('FINISHED');
            const winner = players.find(p => p.id === currentAttacker.ownerId);
            const loser = players.find(p => p.id === currentDefender.ownerId);
            setLog(`${winner.name}의 승리!`);
            await processBattleResults(winner.id, loser.id);
            setBattleResult({ isWinner: winner.id === myPlayerData.id, points: winner.id === myPlayerData.id ? 150 : -50, exp: winner.id === myPlayerData.id ? 100 : 30 });
            return;
        }

        const nextTurn = turn === 'my' ? 'opponent' : 'my';
        setTurn(nextTurn);
        startTurn(nextTurn);
    };

    if (!myPet || !opponentPet) {
        return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    }

    return (
        <>
            <Arena>
                <BattleField>
                    {(gameState === 'QUIZ' || gameState === 'DEFENSE') && <Timer>{timeLeft}</Timer>}
                    <MyInfoBox>
                        <span>{myPet.name} (Lv.{myPet.level})</span>
                        <StatBar><BarFill $percent={Math.max(0, (myPet.hp / myPet.maxHp) * 100)} color="#28a745">HP: {myPet.hp}/{myPet.maxHp}</BarFill></StatBar>
                        <StatBar><BarFill $percent={Math.max(0, (myPet.sp / myPet.maxSp) * 100)} color="#007bff">SP: {myPet.sp}/{myPet.maxSp}</BarFill></StatBar>
                    </MyInfoBox>
                    <OpponentInfoBox>
                        <span>{opponentPet.name} (Lv.{opponentPet.level})</span>
                        <StatBar><BarFill $percent={Math.max(0, (opponentPet.hp / opponentPet.maxHp) * 100)} color="#28a745">HP: {opponentPet.hp}/{opponentPet.maxHp}</BarFill></StatBar>
                        <StatBar><BarFill $percent={Math.max(0, (opponentPet.sp / opponentPet.maxSp) * 100)} color="#007bff">SP: {opponentPet.sp}/{opponentPet.maxSp}</BarFill></StatBar>
                    </OpponentInfoBox>

                    <OpponentPetContainer $isHit={opponentPet.isHit}>
                        <PetImage src={petImageMap[`${opponentPet.appearanceId}_idle`]} alt="상대 펫" $isFainted={opponentPet.hp <= 0} className="opponent" />
                    </OpponentPetContainer>

                    <MyPetContainer $isHit={myPet.isHit}>
                        <PetImage src={petImageMap[`${myPet.appearanceId}_battle`]} alt="나의 펫" $isFainted={myPet.hp <= 0} />
                    </MyPetContainer>
                </BattleField>
                <QuizArea>
                    <div>
                        <LogText>{log}</LogText>
                        {gameState === 'QUIZ' && question && (
                            <>
                                <h3>Q. {question.question}</h3>
                                <form onSubmit={handleSubmit}>
                                    <AnswerInput type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="정답을 입력하세요" autoFocus />
                                </form>
                            </>
                        )}
                    </div>
                    <ActionMenu>
                        {gameState === 'ACTION' && actionMenu.view === 'main' && mainMenuItems.map((item, index) => (
                            <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => handleMenuSelect(index)}>
                                {actionMenu.selectedIndex === index && '>'} {item}
                            </MenuItem>
                        ))}
                        {gameState === 'ACTION' && actionMenu.view === 'skills' && myEquippedSkills.map((skill, index) => {
                            const isDisabled = myPet.sp < skill.cost;
                            return (
                                <MenuItem key={skill.id} $isSelected={actionMenu.selectedIndex === index} $disabled={isDisabled} onClick={() => !isDisabled && handleMenuSelect(index)}>
                                    {actionMenu.selectedIndex === index && '>'} {skill.name} ({skill.cost} SP)
                                </MenuItem>
                            )
                        })}
                        {gameState === 'DEFENSE' && defenseMenuItems.map((item, index) => (
                            <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => handleMenuSelect(index)}>
                                {actionMenu.selectedIndex === index && '>'} {item}
                            </MenuItem>
                        ))}
                    </ActionMenu>
                </QuizArea>
            </Arena>
            {battleResult && (
                <ResultModalBackground>
                    <ResultModalContent $isWinner={battleResult.isWinner}>
                        <h2>{battleResult.isWinner ? "승리!" : "패배..."}</h2>
                        <p>포인트: <span style={{ color: battleResult.isWinner ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>{battleResult.points > 0 ? `+${battleResult.points}` : battleResult.points}P</span></p>
                        <p>펫 경험치: <span style={{ color: '#ffc107', fontWeight: 'bold' }}>+{battleResult.exp} EXP</span></p>
                        <button onClick={() => navigate('/league')}>확인</button>
                    </ResultModalContent>
                </ResultModalBackground>
            )}
        </>
    );
}

export default BattlePage;