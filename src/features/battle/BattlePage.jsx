// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import allQuizzesData from '../../assets/missions.json';

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
`;

// --- 임시 이미지 및 데이터 ---
const myPetImg = 'https://via.placeholder.com/200/90ee90/000000?Text=My+Pet+(Back)';
const opponentPetImg = 'https://via.placeholder.com/200/f08080/000000?Text=Opponent+Pet';
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

    // --- 상태 관리 ---
    const [gameState, setGameState] = useState('PREPARING');
    const [turn, setTurn] = useState(null);
    const [myPet, setMyPet] = useState(null);
    const [opponentPet, setOpponentPet] = useState(null);
    const [log, setLog] = useState("");
    const [question, setQuestion] = useState(null);
    const [answer, setAnswer] = useState("");
    const [actionMenu, setActionMenu] = useState({ view: 'main', selectedIndex: 0 });
    const [myDefense, setMyDefense] = useState(null);
    const [opponentDefense, setOpponentDefense] = useState(null);
    const [focusCharge, setFocusCharge] = useState({ my: 0, opponent: 0 });

    const mainMenuItems = ['기본 공격', '특수 공격'];
    const defenseMenuItems = Object.values(DEFENSE_ACTIONS);

    const handleKeyDown = useCallback((e) => {
        if (gameState !== 'ACTION' && gameState !== 'DEFENSE') return;

        const currentMenu = gameState === 'ACTION' ? mainMenuItems : defenseMenuItems;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) }));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActionMenu(prev => ({ ...prev, selectedIndex: Math.min(currentMenu.length - 1, prev.selectedIndex + 1) }));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleMenuSelect(actionMenu.selectedIndex);
        }
    }, [gameState, actionMenu.selectedIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

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

        setTimeout(() => {
            startTurn(firstTurn);
        }, 2000);
    }, [myPlayerData, opponentPlayerData]);

    const startTurn = (currentTurn) => {
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
            if (actionMenu.view === 'main') {
                if (index === 0) handleAttack('기본 공격');
                else setActionMenu(prev => ({ ...prev, view: 'skills', selectedIndex: 0 }));
            }
        } else if (gameState === 'DEFENSE') {
            setMyDefense(defenseMenuItems[index]);
            setLog(`'${defenseMenuItems[index]}' 태세를 취합니다. 상대의 공격...`);
            // 시뮬레이션을 위해 상대방의 공격을 랜덤으로 가정
            setTimeout(() => {
                const randomAttack = Math.random() < 0.7 ? '기본 공격' : '특수 공격';
                handleResolution(randomAttack, defenseMenuItems[index]);
            }, 2000);
        }
    };

    const handleAttack = (attackType) => {
        setLog(`'${attackType}' 공격! 상대방이 방어 태세를 취합니다...`);
        // 시뮬레이션을 위해 상대방의 방어를 랜덤으로 가정
        const randomDefenseIndex = Math.floor(Math.random() * defenseMenuItems.length);
        const opponentDefenseChoice = defenseMenuItems[randomDefenseIndex];
        setOpponentDefense(opponentDefenseChoice);

        setTimeout(() => handleResolution(attackType, opponentDefenseChoice), 2000);
    };

    const handleResolution = (attack, defense) => {
        let damage = 0;
        let logMessage = "";

        // 공격자, 방어자 결정
        const attacker = turn === 'my' ? myPet : opponentPet;
        const defender = turn === 'my' ? opponentPet : myPet;

        const baseDamage = attack === '기본 공격' ? 20 : 35;
        const focusMultiplier = turn === 'my' ? 1 + focusCharge.my * 0.5 : 1 + focusCharge.opponent * 0.5;
        let finalDamage = baseDamage * focusMultiplier;

        if (defense === DEFENSE_ACTIONS.BRACE) { // 웅크리기
            if (attack === '기본 공격') {
                finalDamage *= 0.5;
                logMessage = `${defender.name}(이)가 공격을 버텨내 피해를 50% 줄였습니다!`;
            } else {
                finalDamage *= 1.1;
                logMessage = `${defender.name}은(는) 특수 공격에 약합니다! 피해 10% 증가!`;
            }
        } else if (defense === DEFENSE_ACTIONS.EVADE) { // 회피하기
            if (attack === '특수 공격' && Math.random() < 0.3) {
                finalDamage = 0;
                logMessage = `${defender.name}(이)가 특수 공격을 완전히 회피했습니다!`;
            } else {
                logMessage = `${defender.name}의 회피가 실패했습니다!`;
            }
        } else if (defense === DEFENSE_ACTIONS.FOCUS) { // 기 모으기
            logMessage = `${defender.name}은(는) 공격을 그대로 받습니다!`;
            if (turn === 'my') setFocusCharge(prev => ({ ...prev, opponent: prev.opponent + 1 }));
            else setFocusCharge(prev => ({ ...prev, my: prev.my + 1 }));
        }

        damage = Math.round(finalDamage);

        // 피해 적용 및 상태 업데이트
        if (turn === 'my') {
            setOpponentPet(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage), isHit: true }));
            setFocusCharge(prev => ({ ...prev, my: 0 })); // 공격 후 기 초기화
            setTimeout(() => setOpponentPet(prev => ({ ...prev, isHit: false })), 300);
        } else {
            setMyPet(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage), isHit: true }));
            setFocusCharge(prev => ({ ...prev, opponent: 0 }));
            setTimeout(() => setMyPet(prev => ({ ...prev, isHit: false })), 300);
        }

        setLog(`${logMessage} ${damage}의 피해!`);

        setTimeout(() => switchTurn(), 2000);
    };

    const switchTurn = () => {
        if (myPet.hp <= 0 || opponentPet.hp <= 0) {
            setGameState('FINISHED');
            const winner = myPet.hp > 0 ? myPlayerData.name : opponentPlayerData.name;
            setLog(`${winner}의 승리!`);
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
        <Arena>
            <BattleField>
                <PetContainer $isHit={opponentPet.isHit}>
                    <InfoBox>
                        <span>{opponentPet.name} (Lv.{opponentPet.level})</span>
                        <StatBar><BarFill percent={(opponentPet.hp / opponentPet.maxHp) * 100} color="#28a745">HP</BarFill></StatBar>
                        <StatBar><BarFill percent={(opponentPet.sp / opponentPet.maxSp) * 100} color="#007bff">SP</BarFill></StatBar>
                    </InfoBox>
                    <PetImage src={opponentPetImg} alt="상대 펫" isFainted={opponentPet.hp <= 0} />
                </PetContainer>
                <PetContainer $isHit={myPet.isHit}>
                    <PetImage src={myPetImg} alt="나의 펫" isFainted={myPet.hp <= 0} />
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
                    {gameState === 'ACTION' && mainMenuItems.map((item, index) => (
                        <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => handleMenuSelect(index)}>
                            {actionMenu.selectedIndex === index && '▶ '} {item}
                        </MenuItem>
                    ))}
                    {gameState === 'DEFENSE' && defenseMenuItems.map((item, index) => (
                        <MenuItem key={item} $isSelected={actionMenu.selectedIndex === index} onClick={() => handleMenuSelect(index)}>
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