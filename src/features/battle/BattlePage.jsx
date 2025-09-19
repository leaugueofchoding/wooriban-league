// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/store/leagueStore';
import { auth } from '@/api/firebase';
import allQuizzesData from '@/assets/missions.json';
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA, SKILLS } from '@/features/pet/petData';

// --- (Styled Components는 이전과 동일하며 일부 추가) ---
const Arena = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f0f8ff;
  border-radius: 12px;
  border: 5px solid #add8e6;
`;
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
`;
const BattleField = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
  position: relative; /* For Timer */
`;
const PetContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${props => props.$isHit ? shake : 'none'} 0.3s;
`;
const PetImage = styled.img`
  width: 200px;
  height: 200px;
  filter: ${props => props.isFainted ? 'grayscale(100%)' : 'none'};
  transition: filter 0.3s;
`;
const InfoBox = styled.div`
  width: 220px;
  padding: 0.75rem;
  border: 3px solid #333;
  border-radius: 8px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;
const StatBar = styled.div`
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  font-size: 0.8rem;
  line-height: 20px;
  color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
`;
const BarFill = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background-color: ${props => props.color};
  transition: width 0.5s ease;
  text-align: center;
`;
const QuizArea = styled.div`
  padding: 1.5rem;
  background-color: #fff;
  border: 3px solid #333;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 1fr 220px;
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
`;
const MenuItem = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  padding: 0.5rem;
  border-radius: 8px;
  background-color: ${props => props.$isSelected ? '#ddd' : 'transparent'};
  opacity: ${props => props.$disabled ? 0.5 : 1};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
`;
const Timer = styled.div`
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    font-size: 3rem;
    font-weight: bold;
    color: #dc3545;
    background-color: rgba(255, 255, 255, 0.8);
    padding: 0.5rem 2rem;
    border-radius: 20px;
    border: 3px solid #dc3545;
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

const DEFENSE_ACTIONS = {
    BRACE: '웅크리기',
    EVADE: '회피하기',
    FOCUS: '기 모으기',
};

function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players } = useLeagueStore();

    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const opponentPlayerData = useMemo(() => players.find(p => p.id === opponentId), [players, opponentId]);

    // Battle State
    const [gameState, setGameState] = useState('PREPARING');
    const [turn, setTurn] = useState(null);
    const [myPet, setMyPet] = useState(null);
    const [opponentPet, setOpponentPet] = useState(null);
    const [log, setLog] = useState("");
    const [question, setQuestion] = useState(null);
    const [answer, setAnswer] = useState("");
    const [actionMenu, setActionMenu] = useState({ view: 'main', selectedIndex: 0 });
    const [petStatus, setPetStatus] = useState({ my: {}, opponent: {} });
    const [petAnimation, setPetAnimation] = useState({ my: 'idle', opponent: 'idle' });
    const [timeLeft, setTimeLeft] = useState(10);
    const [battleResult, setBattleResult] = useState(null);
    const timerRef = useRef(null);
    const turnTimeoutRef = useRef(null);

    const mySkill = useMemo(() => myPet ? PET_DATA[myPet.species]?.skill : null, [myPet]);
    const opponentSkill = useMemo(() => opponentPet ? PET_DATA[opponentPet.species]?.skill : null, [opponentPet]);

    const mainMenuItems = ['기본 공격', mySkill ? mySkill.name : '특수 공격'];
    const defenseMenuItems = Object.values(DEFENSE_ACTIONS);

    // Keyboard controls
    const handleKeyDown = useCallback((e) => {
        if (gameState !== 'ACTION' && gameState !== 'DEFENSE') return;
        const currentMenu = gameState === 'ACTION' ? mainMenuItems : defenseMenuItems;
        const selectedIndex = actionMenu.selectedIndex;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.max(0, selectedIndex - 1) }));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.min(currentMenu.length - 1, selectedIndex + 1) }));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleMenuSelect(selectedIndex);
        }
    }, [gameState, actionMenu.selectedIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Timer effect
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
                        }, 1000);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
            setTimeLeft(10);
        }
        return () => {
            clearInterval(timerRef.current);
            clearTimeout(turnTimeoutRef.current);
        };
    }, [gameState]);


    // Battle setup
    useEffect(() => {
        if (!myPlayerData || !opponentPlayerData || !myPlayerData.pet || !opponentPlayerData.pet) {
            alert("양쪽 플레이어 모두 펫을 선택해야 배틀을 시작할 수 있습니다.");
            navigate('/league');
            return;
        }
        const myPetData = { ...myPlayerData.pet, isHit: false };
        const opponentPetData = { ...opponentPlayerData.pet, isHit: false };
        setMyPet(myPetData);
        setOpponentPet(opponentPetData);
        setLog(`${opponentPlayerData.name}에게 대결을 신청합니다!`);

        const firstTurn = Math.random() < 0.5 ? 'my' : 'opponent';
        setTurn(firstTurn);

        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
        turnTimeoutRef.current = setTimeout(() => startTurn(firstTurn), 2000);
    }, [myPlayerData, opponentPlayerData]);

    // Core Game Logic
    const startTurn = (currentTurn) => {
        if (gameState === 'FINISHED') return;
        setPetAnimation({ my: 'idle', opponent: 'idle' });
        const currentPet = currentTurn === 'my' ? myPet : opponentPet;
        const currentStatus = currentTurn === 'my' ? petStatus.my : petStatus.opponent;

        if (currentStatus.recharging) {
            setLog(`${currentPet.name}(이)가 숨을 고르고 있습니다...`);
            setPetStatus(prev => ({ ...prev, [currentTurn]: { ...prev[currentTurn], recharging: false } }));
            if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
            turnTimeoutRef.current = setTimeout(() => switchTurn(), 2000);
            return;
        }
        if (currentStatus.stunned) {
            setLog(`${currentPet.name}(이)가 혼란스러워 움직이지 못합니다!`);
            setPetStatus(prev => ({ ...prev, [currentTurn]: { ...prev[currentTurn], stunned: false } }));
            if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
            turnTimeoutRef.current = setTimeout(() => switchTurn(), 2000);
            return;
        }

        if (currentTurn === 'my') {
            setLog("나의 턴! 문제를 풀어주세요.");
            fetchNewQuestion();
            setGameState('QUIZ');
        } else {
            setLog("상대방의 턴! 방어 태세를 선택하세요.");
            setGameState('DEFENSE');
            setActionMenu({ view: 'defense', selectedIndex: 0 });
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
            setActionMenu({ view: 'main', selectedIndex: 0 });
        } else {
            setLog("오답입니다! 상대방의 턴!");
            turnTimeoutRef.current = setTimeout(() => switchTurn(), 2000);
        }
        setAnswer("");
    };

    const handleMenuSelect = (index) => {
        clearTimeout(turnTimeoutRef.current);
        clearInterval(timerRef.current);

        if (gameState === 'ACTION') {
            const selectedAction = mainMenuItems[index];
            if (selectedAction === '기본 공격') {
                handleAttack('basic');
            } else { // 특수 공격
                if (myPet.sp < mySkill.cost) {
                    setLog("SP가 부족하여 스킬을 사용할 수 없습니다!");
                    turnTimeoutRef.current = setTimeout(() => startTurn(turn), 2000);
                    return;
                }
                handleAttack(mySkill.id);
            }
        } else if (gameState === 'DEFENSE') {
            const defenseChoice = defenseMenuItems[index];
            setPetAnimation(prev => ({ ...prev, my: 'brace' }));
            setLog(`'${defenseChoice}' 태세를 취합니다. 상대의 공격...`);

            // 시뮬레이션을 위해 상대방의 공격을 랜덤으로 가정
            turnTimeoutRef.current = setTimeout(() => {
                const randomAttack = Math.random() < 0.7 ? 'basic' : (opponentSkill?.id || 'basic');
                handleResolution(randomAttack, defenseChoice);
            }, 2000);
        }
    };

    const handleAttack = (attackType) => {
        setLog(`'${attackType === 'basic' ? '기본 공격' : PET_DATA[myPet.species].skill.name}' 공격! 상대방이 방어 태세를 취합니다...`);
        const randomDefenseIndex = Math.floor(Math.random() * defenseMenuItems.length);
        const opponentDefenseChoice = defenseMenuItems[randomDefenseIndex];

        setPetAnimation(prev => ({ ...prev, opponent: 'brace' }));

        turnTimeoutRef.current = setTimeout(() => handleResolution(attackType, opponentDefenseChoice), 2000);
    };

    const handleResolution = (attackId, defenseAction) => {
        const isMyTurn = turn === 'my';
        const attacker = isMyTurn ? { ...myPet, status: { ...petStatus.my } } : { ...opponentPet, status: { ...petStatus.opponent } };
        const defender = isMyTurn ? { ...opponentPet, status: { ...petStatus.opponent } } : { ...myPet, status: { ...petStatus.my } };

        let logMessage = "";

        if (attackId !== 'basic') {
            const skill = SKILLS[attacker.species];
            logMessage = skill.effect(attacker, defender);
            if (isMyTurn) setMyPet(p => ({ ...p, sp: p.sp - skill.cost }));
            else setOpponentPet(p => ({ ...p, sp: p.sp - skill.cost }));
        } else {
            const baseDamage = 20;
            const focusMultiplier = 1 + (attacker.status.focusCharge || 0) * 0.5;
            let finalDamage = baseDamage * focusMultiplier;

            if (defender.status.defenseBuffTurns > 0) finalDamage *= 0.3;

            switch (defenseAction) {
                case DEFENSE_ACTIONS.BRACE: finalDamage *= 0.5; break;
                case DEFENSE_ACTIONS.FOCUS: defender.status.focusCharge = (defender.status.focusCharge || 0) + 1; break;
            }

            const damage = Math.round(finalDamage);
            defender.hp -= damage;
            logMessage = `'${attacker.name}'의 기본 공격! ${defender.name}에게 ${damage}의 피해!`;
        }

        attacker.status.focusCharge = 0; // 공격 후 기 초기화

        if (isMyTurn) {
            setOpponentPet(prev => ({ ...prev, hp: Math.max(0, defender.hp), isHit: true }));
            setPetStatus({ my: attacker.status, opponent: defender.status });
            setTimeout(() => setOpponentPet(prev => ({ ...prev, isHit: false })), 300);
        } else {
            setMyPet(prev => ({ ...prev, hp: Math.max(0, defender.hp), isHit: true }));
            setPetStatus({ my: defender.status, opponent: attacker.status });
            setTimeout(() => setMyPet(prev => ({ ...prev, isHit: false })), 300);
        }

        setLog(logMessage);

        turnTimeoutRef.current = setTimeout(() => switchTurn(), 2000);
    };

    const switchTurn = async () => {
        if (gameState === 'FINISHED') return;

        const currentMyPet = myPet;
        const currentOpponentPet = opponentPet;

        if ((currentMyPet && currentMyPet.hp <= 0) || (currentOpponentPet && currentOpponentPet.hp <= 0)) {
            setGameState('FINISHED');
            const winner = currentMyPet.hp > 0 ? myPlayerData : opponentPlayerData;
            const loser = currentMyPet.hp > 0 ? opponentPlayerData : myPlayerData;
            setLog(`${winner.name}의 승리!`);

            // processBattleResults is not defined in the provided code
            // await processBattleResults(winner.id, loser.id);

            setBattleResult({
                isWinner: winner.id === myPlayerData.id,
                points: winner.id === myPlayerData.id ? 150 : -50,
                exp: winner.id === myPlayerData.id ? 100 : 30,
            });
            return;
        }
        const nextTurn = turn === 'my' ? 'opponent' : 'my';
        setTurn(nextTurn);
        startTurn(nextTurn);
    };

    if (!myPet || !opponentPet) {
        return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    }

    const getPetImageSrc = (pet, owner) => {
        if (!pet.appearanceId) return 'https://via.placeholder.com/200';
        const animationState = petAnimation[owner];
        let pose = owner === 'my' ? 'battle' : 'idle';
        if (animationState === 'brace') {
            pose = owner === 'my' ? 'brace_back' : 'brace';
        }
        const speciesKey = pet.species;
        const imageKey = `${pet.appearanceId.replace(speciesKey, '')}_${pose}`;

        return petImageMap[`${speciesKey}${imageKey}`] || 'https://via.placeholder.com/200';
    };

    return (
        <>
            <Arena>
                <BattleField>
                    {(gameState === 'QUIZ' || gameState === 'DEFENSE') && <Timer>{timeLeft}</Timer>}
                    <PetContainer $isHit={opponentPet.isHit}>
                        <InfoBox>
                            <span>{opponentPet.name} (Lv.{opponentPet.level})</span>
                            <StatBar><BarFill percent={(opponentPet.hp / opponentPet.maxHp) * 100} color="#28a745">HP</BarFill></StatBar>
                            <StatBar><BarFill percent={(opponentPet.sp / opponentPet.maxSp) * 100} color="#007bff">SP</BarFill></StatBar>
                        </InfoBox>
                        <PetImage src={getPetImageSrc(opponentPet, 'opponent')} alt="상대 펫" isFainted={opponentPet.hp <= 0} />
                    </PetContainer>
                    <PetContainer $isHit={myPet.isHit}>
                        <PetImage src={getPetImageSrc(myPet, 'my')} alt="나의 펫" isFainted={myPet.hp <= 0} />
                        <InfoBox>
                            <span>{myPet.name} (Lv.{myPet.level})</span>
                            <StatBar><BarFill percent={(myPet.hp / myPet.maxHp) * 100} color="#28a745">HP</BarFill></StatBar>
                            <StatBar><BarFill percent={(myPet.sp / myPet.maxSp) * 100} color="#007bff">SP</BarFill></StatBar>
                        </InfoBox>
                    </PetContainer>
                </BattleField>
                <QuizArea>
                    <div>
                        <LogText>{log}</LogText>
                        {gameState === 'QUIZ' && question && (
                            <>
                                <h3>Q. {question.question}</h3>
                                <form onSubmit={handleSubmit}>
                                    <AnswerInput type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="정답을 입력하세요" />
                                </form>
                            </>
                        )}
                    </div>
                    <ActionMenu>
                        {gameState === 'ACTION' && mainMenuItems.map((item, index) => {
                            const isSkill = index === 1;
                            const isDisabled = isSkill && mySkill && myPet.sp < mySkill.cost;
                            return (
                                <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} $disabled={isDisabled} onClick={() => !isDisabled && setActionMenu(prev => ({ ...prev, selectedIndex: index }))} onTouchStart={() => !isDisabled && setActionMenu(prev => ({ ...prev, selectedIndex: index }))}>
                                    {actionMenu.selectedIndex === index && '▶ '} {item}
                                </MenuItem>
                            );
                        })}
                        {gameState === 'DEFENSE' && defenseMenuItems.map((item, index) => (
                            <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => setActionMenu(prev => ({ ...prev, selectedIndex: index }))} onTouchStart={() => setActionMenu(prev => ({ ...prev, selectedIndex: index }))}>
                                {actionMenu.selectedIndex === index && '▶ '} {item}
                            </MenuItem>
                        ))}
                    </ActionMenu>
                </QuizArea>
            </Arena>
            {battleResult && (
                <ResultModalBackground>
                    <ResultModalContent $isWinner={battleResult.isWinner}>
                        <h2>{battleResult.isWinner ? "🎉 승리! 🎉" : "😥 패배..."}</h2>
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