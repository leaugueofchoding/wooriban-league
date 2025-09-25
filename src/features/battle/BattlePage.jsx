// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '@/store/leagueStore';
import { auth, db } from '@/api/firebase';
import { doc, onSnapshot, updateDoc, runTransaction } from "firebase/firestore";
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
  grid-template-columns: 1fr 280px;
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.75rem;
`;
const MenuItem = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  padding: 0.75rem;
  border-radius: 8px;
  background-color: ${props => props.$isSelected ? '#ddd' : '#f8f9fa'};
  border: 1px solid #dee2e6;
  opacity: ${props => props.$disabled ? 0.5 : 1};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  
  &:hover:not([disabled]) {
    background-color: #e9ecef;
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
const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
`;
const ModalContent = styled.div`
  padding: 2rem 3rem;
  background: white;
  border-radius: 12px;
  text-align: center;
  h2 { font-size: 2.5rem; margin-bottom: 1rem; color: ${props => props.$color || '#333'}; }
  p { font-size: 1.2rem; margin: 0.5rem 0; }
  button { margin-top: 1rem; margin-left: 0.5rem; margin-right: 0.5rem; padding: 0.8rem 2rem; }
`;
const WaitingText = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-size: 1.5rem;
    color: #495057;
`;

const allQuizzes = Object.values(allQuizzesData).flat();
const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기', FLEE: '도망치기' };


function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players, processBattleResults } = useLeagueStore();
    const { classId } = useClassStore();

    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const battleId = useMemo(() => [myPlayerData?.id, opponentId].sort().join('_'), [myPlayerData, opponentId]);

    const [battleState, setBattleState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(20);
    const [answer, setAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const timerRef = useRef(null);
    const actionTimeoutRef = useRef(null);
    const resolutionTimeoutRef = useRef(null);

    // Battle state listener
    useEffect(() => {
        if (!myPlayerData || !classId) return;
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setBattleState(data);
                if (data.status === 'rejected') {
                    alert("상대방이 대결을 거절했습니다.");
                    navigate('/league');
                }
            } else {
                setBattleState(null);
            }
        });
        return () => unsubscribe();
    }, [myPlayerData, battleId, classId, navigate]);

    // Game state progression & Timer
    useEffect(() => {
        if (!battleState) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger.id;

        clearTimeout(actionTimeoutRef.current);
        clearTimeout(resolutionTimeoutRef.current);

        if (battleState.log.includes('선공입니다!')) {
            actionTimeoutRef.current = setTimeout(() => {
                updateDoc(battleRef, { status: 'action' });
            }, 2000);
        }

        clearInterval(timerRef.current);
        if ((battleState.status === 'first_quiz') && battleState.turnStartTime) {
            timerRef.current = setInterval(() => {
                const elapsed = (Date.now() - battleState.turnStartTime) / 1000;
                const newTimeLeft = Math.floor(Math.max(0, 20 - elapsed));
                setTimeLeft(newTimeLeft);

                if (newTimeLeft === 0 && iAmChallenger) {
                    clearInterval(timerRef.current);
                    updateDoc(battleRef, {
                        log: '시간 초과! 다음 문제로 넘어갑니다.',
                        question: allQuizzes[Math.floor(Math.random() * allQuizzes.length)],
                        turnStartTime: Date.now()
                    });
                }
            }, 1000);
        }

        // 양쪽 모두 행동 선택을 완료하면 결과 처리
        if (battleState.attackerAction && battleState.defenderAction) {
            resolutionTimeoutRef.current = setTimeout(() => handleResolution(), 1000);
        }

        return () => {
            clearInterval(timerRef.current);
            clearTimeout(actionTimeoutRef.current);
            clearTimeout(resolutionTimeoutRef.current);
        };
    }, [battleState, battleId, classId, myPlayerData]);


    const handleQuizSubmit = async (e) => {
        e.preventDefault();
        if (!battleState.question || !answer.trim() || isProcessing) return;

        setIsProcessing(true);
        const isCorrect = answer.trim().toLowerCase() === battleState.question.answer.toLowerCase();
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);

        if (battleState.status === 'first_quiz') {
            if (isCorrect) {
                try {
                    await runTransaction(db, async (transaction) => {
                        const battleDoc = await transaction.get(battleRef);
                        if (!battleDoc.exists() || battleDoc.data().status !== 'first_quiz') { return; }

                        const attackerRole = myPlayerData.id === battleState.challenger.id ? 'challenger' : 'opponent';

                        transaction.update(battleRef, {
                            turn: attackerRole,
                            log: `정답! ${myPlayerData.name}님의 선공입니다!`,
                            question: null,
                        });
                    });
                } catch (error) { console.error("선공 퀴즈 처리 오류:", error); }
            } else {
                alert('오답입니다!');
            }
        }
        setAnswer('');
        setIsProcessing(false);
    };

    const handleActionSelect = async (actionId) => {
        if (isProcessing) return;
        setIsProcessing(true);

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmAttacker = battleState.turn === (myPlayerData.id === battleState.challenger.id ? 'challenger' : 'opponent');

        if (iAmAttacker) {
            await updateDoc(battleRef, { attackerAction: actionId, log: `${myPlayerData.name}이(가) 공격 준비를 마쳤습니다! 상대의 방어를 기다립니다...` });
        } else {
            await updateDoc(battleRef, { defenderAction: actionId, log: `${myPlayerData.name}이(가) 방어 준비를 마쳤습니다!` });
        }
        setIsProcessing(false);
    };

    const handleResolution = async () => {
        // ... (결과 처리 로직: 다음 단계에서 구현)
        alert('결과 처리 로직 실행!');
    };


    if (!myPlayerData) return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    if (!battleState) return <Arena><WaitingText>상대방의 수락을 기다리는 중...</WaitingText></Arena>;

    const IamChallenger = myPlayerData.id === battleState.challenger.id;
    const myInfo = IamChallenger ? battleState.challenger : battleState.opponent;
    const opponentInfo = IamChallenger ? battleState.opponent : battleState.challenger;
    const isAttacker = battleState.turn === (IamChallenger ? 'challenger' : 'opponent');
    const myRole = IamChallenger ? 'challenger' : 'opponent';

    const mainMenuItems = ['기본 공격', '특수 공격'];
    const myEquippedSkills = myInfo.pet.equippedSkills.map(id => SKILLS[id.toUpperCase()]).filter(Boolean);

    return (
        <>
            <Arena>
                {battleState.status === 'pending' ? (
                    <WaitingText>상대방의 수락을 기다리는 중...</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {(battleState.status === 'first_quiz') && <Timer>{timeLeft}</Timer>}
                            <MyInfoBox>
                                <span>{myInfo.pet.name} (Lv.{myInfo.pet.level})</span>
                                <StatBar><BarFill $percent={Math.max(0, (myInfo.pet.hp / myInfo.pet.maxHp) * 100)} color="#28a745">HP: {myInfo.pet.hp}/{myInfo.pet.maxHp}</BarFill></StatBar>
                                <StatBar><BarFill $percent={Math.max(0, (myInfo.pet.sp / myInfo.pet.maxSp) * 100)} color="#007bff">SP: {myInfo.pet.sp}/{myInfo.pet.maxSp}</BarFill></StatBar>
                            </MyInfoBox>
                            <OpponentInfoBox>
                                <span>{opponentInfo.pet.name} (Lv.{opponentInfo.pet.level})</span>
                                <StatBar><BarFill $percent={Math.max(0, (opponentInfo.pet.hp / opponentInfo.pet.maxHp) * 100)} color="#28a745">HP: {opponentInfo.pet.hp}/{opponentInfo.pet.maxHp}</BarFill></StatBar>
                                <StatBar><BarFill $percent={Math.max(0, (opponentInfo.pet.sp / opponentInfo.pet.maxSp) * 100)} color="#007bff">SP: {opponentInfo.pet.sp}/{opponentInfo.pet.maxSp}</BarFill></StatBar>
                            </OpponentInfoBox>

                            <OpponentPetContainer $isHit={false}>
                                <PetImage src={petImageMap[`${opponentInfo.pet.appearanceId}_idle`]} alt="상대 펫" $isFainted={opponentInfo.pet.hp <= 0} />
                            </OpponentPetContainer>

                            <MyPetContainer $isHit={false}>
                                <PetImage src={petImageMap[`${myInfo.pet.appearanceId}_battle`]} alt="나의 펫" $isFainted={myInfo.pet.hp <= 0} />
                            </MyPetContainer>
                        </BattleField>
                        <QuizArea>
                            <div>
                                <LogText>{battleState.log}</LogText>
                                {battleState.status === 'first_quiz' && battleState.question && (
                                    <>
                                        <h3>Q. {battleState.question.question}</h3>
                                        <form onSubmit={handleQuizSubmit}>
                                            <AnswerInput
                                                name="answer"
                                                value={answer}
                                                onChange={(e) => setAnswer(e.target.value)}
                                                placeholder="정답을 입력하세요"
                                                autoFocus
                                                disabled={isProcessing}
                                            />
                                        </form>
                                    </>
                                )}
                            </div>
                            <ActionMenu>
                                {battleState.status === 'action' && isAttacker && !battleState.attackerAction && (
                                    <>
                                        <MenuItem onClick={() => handleActionSelect('TACKLE')}>기본 공격</MenuItem>
                                        {myEquippedSkills.map(skill => (
                                            <MenuItem key={skill.id} onClick={() => handleActionSelect(skill.id)} disabled={myInfo.pet.sp < skill.cost}>{skill.name} ({skill.cost}SP)</MenuItem>
                                        ))}
                                    </>
                                )}
                                {battleState.status === 'action' && !isAttacker && !battleState.defenderAction && (
                                    Object.entries(DEFENSE_ACTIONS).map(([key, name]) => (
                                        <MenuItem key={key} onClick={() => handleActionSelect(key)}>{name}</MenuItem>
                                    ))
                                )}
                            </ActionMenu>
                        </QuizArea>
                    </>
                )}
            </Arena>
        </>
    );
}

export default BattlePage;