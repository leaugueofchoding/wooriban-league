// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import allQuizzesData from '../../assets/missions.json';
import { petImageMap } from '../../utils/petImageMap';

// --- Styled Components ---
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
  cursor: pointer;
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

const allQuizzes = Object.values(allQuizzesData).flat();

const DEFENSE_ACTIONS = {
    BRACE: '웅크리기',
    EVADE: '회피하기',
    FOCUS: '기 모으기',
};

const SKILLS = {
    dragon: { id: 'fiery_breath', name: '용의 숨결', cost: 20, description: '강력한 피해를 주지만, 다음 턴에 행동할 수 없다.' },
    rabbit: { id: 'quick_disturbance', name: '재빠른 교란', cost: 15, description: '낮은 피해를 주고, 50% 확률로 상대를 행동 불능으로 만든다.' },
    turtle: { id: 'feather_shield', name: '깃털 방패', cost: 25, description: '이번 턴에 받는 모든 피해를 70% 감소시킨다.' }
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
    const [petStatus, setPetStatus] = useState({ my: {}, opponent: {} }); // For buffs, debuffs
    const [petAnimation, setPetAnimation] = useState({ my: 'idle', opponent: 'idle' });
    const [timeLeft, setTimeLeft] = useState(10);
    const timerRef = React.useRef(null);

    const mySkill = useMemo(() => myPet ? SKILLS[myPet.species] : null, [myPet]);
    const opponentSkill = useMemo(() => opponentPet ? SKILLS[opponentPet.species] : null, [opponentPet]);

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
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
            setTimeLeft(10);
        }
        return () => clearInterval(timerRef.current);
    }, [gameState]);

    useEffect(() => {
        if (timeLeft <= 0) {
            clearInterval(timerRef.current);
            setLog("시간 초과! 턴이 넘어갑니다.");
            setTimeout(() => switchTurn(), 2000);
        }
    }, [timeLeft]);

    // Battle setup
    useEffect(() => {
        if (!myPlayerData || !opponentPlayerData) {
            navigate('/league');
            return;
        }

        const myPetData = { ...(myPlayerData.pet || { name: '나의 임시펫', level: 1, hp: 100, maxHp: 100, sp: 50, maxSp: 50 }), isHit: false };
        const opponentPetData = { ...(opponentPlayerData.pet || { name: '상대 임시펫', level: 1, hp: 100, maxHp: 100, sp: 50, maxSp: 50 }), isHit: false };
        setMyPet(myPetData);
        setOpponentPet(opponentPetData);
        setLog(`${opponentPlayerData.name}에게 대결을 신청합니다!`);

        const firstTurn = Math.random() < 0.5 ? 'my' : 'opponent';
        setTurn(firstTurn);

        setTimeout(() => startTurn(firstTurn), 2000);
    }, [myPlayerData, opponentPlayerData]);

    // Core Game Logic
    const startTurn = (currentTurn) => {
        setPetAnimation({ my: 'idle', opponent: 'idle' });
        const currentPetStatus = currentTurn === 'my' ? petStatus.my : petStatus.opponent;

        if (currentPetStatus.recharging) {
            setLog(`${currentTurn === 'my' ? '나' : '상대'}의 펫이 숨을 고르고 있습니다...`);
            setPetStatus(prev => ({ ...prev, [currentTurn]: { ...prev[currentTurn], recharging: false } }));
            setTimeout(() => switchTurn(), 2000);
            return;
        }
        if (currentPetStatus.stunned) {
            setLog(`${currentTurn === 'my' ? '나' : '상대'}의 펫이 혼란스러워 움직이지 못합니다!`);
            setPetStatus(prev => ({ ...prev, [currentTurn]: { ...prev[currentTurn], stunned: false } }));
            setTimeout(() => switchTurn(), 2000);
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
        const isCorrect = answer.trim().toLowerCase() === question.answer.toLowerCase();

        if (isCorrect) {
            setLog("정답! 행동을 선택하세요!");
            setGameState('ACTION');
            setActionMenu({ view: 'main', selectedIndex: 0 });
        } else {
            setLog("오답입니다! 상대방의 턴!");
            setTimeout(() => switchTurn(), 2000);
        }
        setAnswer("");
    };

    const handleMenuSelect = (index) => {
        if (gameState === 'ACTION') {
            const selectedAction = mainMenuItems[index];
            if (selectedAction === '기본 공격') {
                handleAttack('basic');
            } else { // 특수 공격
                if (myPet.sp < mySkill.cost) {
                    setLog("SP가 부족하여 스킬을 사용할 수 없습니다!");
                    return;
                }
                handleAttack(mySkill.id);
            }
        } else if (gameState === 'DEFENSE') {
            const defenseChoice = defenseMenuItems[index];
            setPetAnimation(prev => ({ ...prev, my: 'brace' }));
            setLog(`'${defenseChoice}' 태세를 취합니다. 상대의 공격...`);

            // 시뮬레이션을 위해 상대방의 공격을 랜덤으로 가정
            setTimeout(() => {
                const randomAttack = Math.random() < 0.7 ? 'basic' : (opponentSkill?.id || 'basic');
                handleResolution(randomAttack, defenseChoice);
            }, 2000);
        }
    };

    const handleAttack = (attackType) => {
        setLog(`'${attackType === 'basic' ? '기본 공격' : SKILLS[myPet.species].name}' 공격! 상대방이 방어 태세를 취합니다...`);
        const randomDefenseIndex = Math.floor(Math.random() * defenseMenuItems.length);
        const opponentDefenseChoice = defenseMenuItems[randomDefenseIndex];

        setPetAnimation(prev => ({ ...prev, opponent: 'brace' }));

        setTimeout(() => handleResolution(attackType, opponentDefenseChoice), 2000);
    };

    const handleResolution = (attackId, defenseAction) => {
        const isMyTurn = turn === 'my';
        const attacker = isMyTurn ? myPet : opponentPet;
        const defender = isMyTurn ? opponentPet : myPet;
        const attackerStatusKey = isMyTurn ? 'my' : 'opponent';
        const defenderStatusKey = isMyTurn ? 'opponent' : 'my';

        let baseDamage = 20;
        let logMessage = "";
        const tempPetStatus = { my: { ...petStatus.my }, opponent: { ...petStatus.opponent } };

        // 1. 공격 처리
        if (attackId === 'basic') {
            baseDamage = 20;
        } else { // 특수 공격
            const skill = SKILLS[attacker.species];
            baseDamage = 40; // 특수 공격 기본 데미지

            if (skill.id === 'fiery_breath') {
                tempPetStatus[attackerStatusKey].recharging = true;
            } else if (skill.id === 'quick_disturbance') {
                if (Math.random() < 0.5) {
                    tempPetStatus[defenderStatusKey].stunned = true;
                    logMessage += `${defender.name}이(가) 혼란에 빠졌다! `;
                }
            }
            if (isMyTurn) setMyPet(p => ({ ...p, sp: p.sp - skill.cost }));
            else setOpponentPet(p => ({ ...p, sp: p.sp - skill.cost }));
        }

        const focusMultiplier = tempPetStatus[attackerStatusKey].focusCharge ? 1 + tempPetStatus[attackerStatusKey].focusCharge * 0.5 : 1;
        let finalDamage = baseDamage * focusMultiplier;
        tempPetStatus[attackerStatusKey].focusCharge = 0; // 공격 후 기 초기화

        // 2. 방어 처리
        if (tempPetStatus[defenderStatusKey].defenseBuffTurns > 0) {
            finalDamage *= 0.3; // 깃털 방패 효과
            logMessage += `${defender.name}의 깃털 방패가 피해를 크게 줄였다! `;
        }

        switch (defenseAction) {
            case DEFENSE_ACTIONS.BRACE:
                finalDamage *= (attackId === 'basic' ? 0.5 : 1.1);
                break;
            case DEFENSE_ACTIONS.EVADE:
                if (attackId !== 'basic' && Math.random() < 0.3) finalDamage = 0;
                break;
            case DEFENSE_ACTIONS.FOCUS:
                tempPetStatus[defenderStatusKey].focusCharge = (tempPetStatus[defenderStatusKey].focusCharge || 0) + 1;
                break;
        }

        const damage = Math.round(finalDamage);

        // 3. 피해 적용 및 상태 업데이트
        if (isMyTurn) {
            setOpponentPet(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage), isHit: true }));
            setTimeout(() => setOpponentPet(prev => ({ ...prev, isHit: false })), 300);
        } else {
            setMyPet(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage), isHit: true }));
            setTimeout(() => setMyPet(prev => ({ ...prev, isHit: false })), 300);
        }

        setLog(logMessage + `${damage}의 피해!`);
        setPetStatus(tempPetStatus);

        setTimeout(() => switchTurn(), 2000);
    };

    const switchTurn = () => {
        if ((myPet && myPet.hp <= 0) || (opponentPet && opponentPet.hp <= 0)) {
            setGameState('FINISHED');
            const winner = myPet.hp > 0 ? myPlayerData.name : opponentPlayerData.name;
            setLog(`${winner}의 승리!`);
            return;
        }
        const nextTurn = turn === 'my' ? 'opponent' : 'my';
        setTurn(nextTurn);
        startTurn(nextTurn);
    };

    if (!myPet || !opponentPet) return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;

    const getPetImageSrc = (pet, owner, animationState) => {
        if (!pet.appearanceId) return owner === 'my' ? myPetImg : opponentPetImg;
        let pose = owner === 'my' ? 'battle' : 'idle';
        if (animationState === 'brace') {
            pose = owner === 'my' ? 'brace_back' : 'brace';
        }
        return petImageMap[`${pet.appearanceId}_${pose}`] || (owner === 'my' ? myPetImg : opponentPetImg);
    };

    return (
        <Arena>
            <BattleField>
                {(gameState === 'QUIZ' || gameState === 'DEFENSE') && <Timer>{timeLeft}</Timer>}
                <PetContainer $isHit={opponentPet.isHit}>
                    <InfoBox>
                        <span>{opponentPet.name} (Lv.{opponentPet.level})</span>
                        <StatBar><BarFill percent={(opponentPet.hp / opponentPet.maxHp) * 100} color="#28a745">HP</BarFill></StatBar>
                        <StatBar><BarFill percent={(opponentPet.sp / opponentPet.maxSp) * 100} color="#007bff">SP</BarFill></StatBar>
                    </InfoBox>
                    <PetImage src={getPetImageSrc(opponentPet, 'opponent', petAnimation.opponent)} alt="상대 펫" isFainted={opponentPet.hp <= 0} />
                </PetContainer>
                <PetContainer $isHit={myPet.isHit}>
                    <PetImage src={getPetImageSrc(myPet, 'my', petAnimation.my)} alt="나의 펫" isFainted={myPet.hp <= 0} />
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
                        const isDisabled = isSkill && myPet.sp < mySkill.cost;
                        return (
                            <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} $disabled={isDisabled} onClick={() => !isDisabled && setActionMenu(prev => ({ ...prev, selectedIndex: index }))}>
                                {actionMenu.selectedIndex === index && '▶ '} {item}
                            </MenuItem>
                        );
                    })}
                    {gameState === 'DEFENSE' && defenseMenuItems.map((item, index) => (
                        <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => setActionMenu(prev => ({ ...prev, selectedIndex: index }))}>
                            {actionMenu.selectedIndex === index && '▶ '} {item}
                        </MenuItem>
                    ))}
                </ActionMenu>
            </QuizArea>
            {gameState === 'FINISHED' && <button onClick={() => navigate('/league')}>돌아가기</button>}
        </Arena>
    );
}

export default BattlePage;