// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, db, cancelBattleChallenge, getActiveQuizSets } from '../../api/firebase';
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { petImageMap } from '../../utils/petImageMap';
import { SKILLS } from '../pet/petData';
import { filterProfanity } from '../../utils/profanityFilter';
import BattleSkillEffect from './BattleSkillEffect';

// --- Styled Components & Keyframes ---

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const shakeDamage = keyframes`
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px) rotate(-6deg); }
  50% { transform: translateX(6px) rotate(6deg); }
  75% { transform: translateX(-6px) rotate(-6deg); }
  100% { transform: translateX(0); }
`;

// [기본] 몸통박치기 (직선)
const tackleRight = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(-20px); }
  50% { transform: translateX(150px); }
  100% { transform: translateX(0); }
`;

const tackleLeft = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(20px); }
  50% { transform: translateX(-150px); }
  100% { transform: translateX(0); }
`;

// [NEW] 재빠른 교란 (지그재그) - 아군용 (오른쪽으로 공격)
const zigzagRight = keyframes`
  0% { transform: translate(0, 0); }
  15% { transform: translate(30px, -30px); }  /* 위로 휙 */
  30% { transform: translate(60px, 30px); }   /* 아래로 휙 */
  45% { transform: translate(90px, -30px); }  /* 위로 휙 */
  60% { transform: translate(150px, 0) scale(1.1); } /* 타격! */
  100% { transform: translate(0, 0); }
`;

// [NEW] 재빠른 교란 (지그재그) - 적군용 (왼쪽으로 공격)
const zigzagLeft = keyframes`
  0% { transform: translate(0, 0); }
  15% { transform: translate(-30px, -30px); }
  30% { transform: translate(-60px, 30px); }
  45% { transform: translate(-90px, -30px); }
  60% { transform: translate(-150px, 0) scale(1.1); }
  100% { transform: translate(0, 0); }
`;

const StunEffect = styled.div`
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 3rem;
  animation: ${rotate} 2s linear infinite;
  z-index: 20;
  
  &::after {
    content: '💫'; 
    display: block;
  }
`;

const RechargeEffect = styled.div`
  position: absolute;
  bottom: 10px;
  width: 100%;
  text-align: center;
  color: #ff4500;
  font-weight: bold;
  font-size: 1.2rem;
  animation: ${float} 1s ease-in-out infinite;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
  z-index: 20;
  pointer-events: none;
`;

const Arena = styled.div`
  max-width: 1200px; margin: 2rem auto; padding: 2rem; background-color: #f0f8ff;
  border-radius: 24px; border: 5px solid #a5d8ff; overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
`;

const BattleField = styled.div`
  height: 550px; position: relative; margin-bottom: 2rem; 
  background: radial-gradient(circle, #ffffff 0%, #e7f5ff 100%);
  border-radius: 20px;
  border: 2px solid #d0ebff;
`;

const PetContainerWrapper = styled.div`
  position: absolute; width: 400px; height: 400px;
  @media (max-width: 768px) { width: 300px; height: 300px; }
`;
const MyPetContainerWrapper = styled(PetContainerWrapper)` bottom: 10px; left: 10px; `;
const OpponentPetContainerWrapper = styled(PetContainerWrapper)` top: 10px; right: 10px; `;

const PetContainer = styled.div`
  position: relative; width: 100%; height: 100%;
  animation: ${props =>
        props.$isHit ? css`${shakeDamage} 0.5s` :
            props.$animType === 'TACKLE' ? css`${props.$isMine ? tackleRight : tackleLeft} 0.5s ease-in-out` :
                props.$animType === 'ZIGZAG' ? css`${props.$isMine ? zigzagRight : zigzagLeft} 0.6s ease-in-out` :
                    'none'};
  display: flex; flex-direction: column; align-items: center;
`;

const PetImage = styled.img`
  width: 100%; height: 100%; object-fit: contain;
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))'}; 
  transition: filter 0.3s;
`;

const InfoBox = styled.div`
  position: absolute; width: 280px; padding: 1rem; border: 2px solid #339af0;
  border-radius: 16px; background-color: rgba(255,255,255,0.9); backdrop-filter: blur(5px);
  display: flex; flex-direction: column; gap: 0.5rem; z-index: 5;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  
  span { font-weight: 800; color: #343a40; font-size: 1.1rem; }
  @media (max-width: 768px) { width: 200px; padding: 0.8rem; span { font-size: 0.9rem; } }
`;
const MyInfoBox = styled(InfoBox)` right: 20px; bottom: 20px; `;
const OpponentInfoBox = styled(InfoBox)` left: 20px; top: 20px; `;

const StatBar = styled.div`
  width: 100%; height: 18px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; position: relative;
`;
const BarFill = styled.div`
  width: ${props => props.$percent}%; height: 100%; background-color: ${props => props.color}; transition: width 0.5s ease, background-color 0.5s ease;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5); font-weight: 700;
`;

const QuizArea = styled.div`
  padding: 1.5rem; background-color: #fff; border: 2px solid #339af0;
  border-radius: 20px; display: grid; grid-template-columns: 1fr 320px;
  gap: 2rem; min-height: 220px; box-shadow: 0 4px 15px rgba(51, 154, 240, 0.1);
  
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const LogText = styled.p` 
  font-size: 1.3rem; font-weight: 700; min-height: 60px; margin: 0 0 1rem 0; color: #343a40;
  display: flex; align-items: center;
`;

const AnswerInput = styled.input`
  width: 100%; padding: 1rem; font-size: 1.2rem; text-align: center;
  border: 2px solid #dee2e6; border-radius: 12px; margin-top: 1rem;
  font-weight: 700;
  &:focus { outline: none; border-color: #339af0; box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1); }
`;

const ActionMenu = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;
`;

const MenuItem = styled.div`
  font-size: 1.1rem; font-weight: 800; padding: 1rem; border-radius: 12px;
  background-color: #f8f9fa; border: 2px solid #dee2e6; color: #495057;
  opacity: ${props => props.$disabled ? 0.5 : 1}; cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s; display: flex; justify-content: center;
  align-items: center; text-align: center;
  
  &:hover:not([disabled]) { 
    background-color: #e7f5ff; 
    border-color: #339af0; 
    color: #1864ab; 
    transform: translateY(-2px); 
  }
`;

const Timer = styled.div`
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 3.5rem; font-weight: 900; color: #ff6b6b; background-color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem 2rem; border-radius: 30px; border: 4px solid #ff6b6b; z-index: 10;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  padding: 2rem 3rem; background: white; border-radius: 24px; text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  h2 { font-size: 2.5rem; margin-bottom: 1rem; color: ${props => props.$color || '#333'}; font-weight: 900; }
  p { font-size: 1.2rem; margin: 0.5rem 0; color: #495057; }
  button { 
    margin-top: 1.5rem; padding: 0.8rem 2.5rem; 
    font-size: 1.1rem; font-weight: 800; 
    background: #339af0; color: white; border: none; border-radius: 12px; cursor: pointer;
    &:hover { background: #228be6; }
  }
`;

const WaitingText = styled.div`
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    height: 300px; font-size: 1.5rem; color: #495057; gap: 1.5rem; font-weight: 700;
`;

const CancelButton = styled.button`
    padding: 0.8rem 2rem; font-size: 1.1rem; background-color: #ff6b6b; color: white;
    border: none; border-radius: 12px; cursor: pointer; font-weight: 800;
    &:hover { background-color: #fa5252; }
`;

const ChatBubble = styled.div`
    position: absolute;
    background: white;
    padding: 0.8rem 1.2rem;
    border-radius: 20px;
    border: 3px solid #333;
    max-width: 250px;
    word-wrap: break-word;
    z-index: 10;
    color: ${props => props.$isCorrect === false ? '#fa5252' : (props.$isCorrect === true ? '#20c997' : '#343a40')};
    font-weight: 800;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    font-size: 1.1rem;
    
    ${props => props.$isMine ? 'top: -80px; left: 50%;' : 'bottom: -80px; left: 50%;'}
    transform: translateX(-50%);

    &::after {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
        ${props => props.$isMine ? `
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 10px 10px 0 10px;
            border-color: #333 transparent transparent transparent;
        ` : `
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 0 10px 10px 10px;
            border-color: #333 transparent transparent transparent;
        `}
    }
`;

const OptionGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 1rem;
`;

const OptionButton = styled.button`
    padding: 1.2rem;
    font-size: 1.1rem;
    font-weight: 800;
    border: 2px solid #dee2e6;
    border-radius: 12px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s;
    color: #495057;

    &:hover:not(:disabled) {
        background-color: #e7f5ff;
        border-color: #339af0;
        color: #1864ab;
        transform: translateY(-2px);
    }
    
    &:active:not(:disabled) {
        transform: translateY(0);
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기', FLEE: '도망치기' };

const getHpColor = (current, max) => {
    const percentage = (current / max) * 100;
    if (percentage <= 25) return '#fa5252';
    if (percentage <= 50) return '#fab005';
    return '#20c997';
};

function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players, processBattleResults, processBattleDraw } = useLeagueStore();
    const { classId } = useClassStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const battleId = useMemo(() => [myPlayerData?.id, opponentId].sort().join('_'), [myPlayerData, opponentId]);

    const [battleState, setBattleState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(20);
    const [answer, setAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [hitState, setHitState] = useState({ my: false, opponent: false });
    const [animState, setAnimState] = useState({ my: null, opponent: null });
    const [currentEffect, setCurrentEffect] = useState(null);

    const [actionSubMenu, setActionSubMenu] = useState(null);

    // [추가] DB에서 불러온 퀴즈 풀 state
    const [quizPool, setQuizPool] = useState([]);

    const timerRef = useRef(null);
    const timeoutRef = useRef(null);
    const prevHpRef = useRef({ my: null, opponent: null });
    const processedTurnRef = useRef(null);

    // [추가] 퀴즈 데이터 로딩 Effect
    useEffect(() => {
        const loadQuizzes = async () => {
            if (!classId) return;
            const activeSets = await getActiveQuizSets(classId);
            let allQuestions = [];

            if (activeSets.length > 0) {
                activeSets.forEach(set => {
                    if (Array.isArray(set.questions)) {
                        allQuestions = [...allQuestions, ...set.questions];
                    }
                });
            } else {
                // DB에 설정된게 없으면 기본 퀴즈 1개라도 넣어둠 (에러 방지)
                allQuestions = [{ question: "선생님이 출제한 퀴즈가 없습니다.", answer: "0", type: "subjective" }];
            }
            setQuizPool(allQuestions);
        };
        loadQuizzes();
    }, [classId]);

    const getPetImageSrc = (info, isMine) => {
        if (!info || !info.pet) return null;
        const { appearanceId, status } = info.pet;

        const isDefenderTurn = (battleState?.status === 'action' || battleState?.status === 'resolution')
            && battleState?.turn !== info.id;

        if (isDefenderTurn) {
            return isMine
                ? (petImageMap[`${appearanceId}_brace_back`] || petImageMap[`${appearanceId}_battle`])
                : (petImageMap[`${appearanceId}_brace`] || petImageMap[`${appearanceId}_idle`]);
        }

        if (status?.recharging) {
            return isMine
                ? (petImageMap[`${appearanceId}_brace_back`] || petImageMap[`${appearanceId}_battle`])
                : (petImageMap[`${appearanceId}_brace`] || petImageMap[`${appearanceId}_idle`]);
        }

        return isMine ? petImageMap[`${appearanceId}_battle`] : petImageMap[`${appearanceId}_idle`];
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/pet');
        }
    };

    useEffect(() => {
        if (!myPlayerData || !classId) return;
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBattleState(data);
                if (data.status === 'rejected') {
                    alert("상대방이 대전을 거절했습니다.");
                    goBack();
                }
                if (data.status === 'cancelled') {
                    goBack();
                }
            } else {
                setBattleState(null);
            }
        });
        return () => unsubscribe();
    }, [myPlayerData, battleId, classId, navigate]);

    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger.id;

        clearTimeout(timeoutRef.current);
        clearInterval(timerRef.current);

        if (iAmChallenger && battleState.status === 'starting') {
            timeoutRef.current = setTimeout(() => {
                startNewTurn(battleRef, "대결 시작! 퀴즈를 풀어 선공을 차지하세요!");
            }, 1500);
            return;
        }

        if (battleState.status === 'finished') {
            return;
        }

        if (battleState.status === 'quiz' || battleState.status === 'action') {
            const updateTimer = () => {
                const now = Date.now();
                const limitSeconds = battleState.status === 'quiz' ? 15 : 10;
                const elapsed = now - (battleState.turnStartTime || now);
                const remaining = Math.max(0, Math.ceil(limitSeconds - (elapsed / 1000)));

                setTimeLeft(remaining);

                if (isProcessing) return;

                if (elapsed > limitSeconds * 1000) {
                    clearInterval(timerRef.current);
                    if (battleState.status === 'quiz') handleTimeout(battleRef);
                    else handleActionTimeout(battleRef);
                }
            };

            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        }

        if (battleState.status === 'action' && battleState.attackerAction && battleState.defenderAction) {

            const turnUniqueId = `${battleState.turnStartTime}_${battleState.turn}`;

            if (!isProcessing && processedTurnRef.current !== turnUniqueId) {

                setIsProcessing(true);
                processedTurnRef.current = turnUniqueId;

                const isAttackerMe = battleState.turn === myPlayerData.id;

                const actionType = battleState.attackerAction ? battleState.attackerAction.toUpperCase() : '';

                if (actionType === 'TACKLE' || actionType === 'QUICK_DISTURBANCE') {

                    const animType = actionType === 'TACKLE' ? 'TACKLE' : 'ZIGZAG';

                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: animType }));
                    else setAnimState(prev => ({ ...prev, opponent: animType }));

                    const hitTiming = animType === 'TACKLE' ? 200 : 350;

                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, hitTiming);

                    setTimeout(() => {
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 600);

                } else {
                    setCurrentEffect({
                        type: actionType,
                        isMine: isAttackerMe
                    });

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 2000);
                }
            }
        }

        return () => {
            clearInterval(timerRef.current);
            clearTimeout(timeoutRef.current);
        };
    }, [battleState, myPlayerData, isProcessing, classId, battleId]);

    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const iAmChallenger = myPlayerData.id === battleState.challenger.id;
        const myRole = iAmChallenger ? 'challenger' : 'opponent';
        const opponentRole = iAmChallenger ? 'opponent' : 'challenger';

        const currentMyHp = battleState[myRole].pet.hp;
        const currentOpponentHp = battleState[opponentRole].pet.hp;

        if (prevHpRef.current.my !== null && prevHpRef.current.opponent !== null) {
            if (currentMyHp < prevHpRef.current.my && !hitState.my) {
                setHitState(prev => ({ ...prev, my: true }));
                setTimeout(() => setHitState(prev => ({ ...prev, my: false })), 500);
            }
            if (currentOpponentHp < prevHpRef.current.opponent && !hitState.opponent) {
                setHitState(prev => ({ ...prev, opponent: true }));
                setTimeout(() => setHitState(prev => ({ ...prev, opponent: false })), 500);
            }
        }
        prevHpRef.current = { my: currentMyHp, opponent: currentOpponentHp };

    }, [battleState, myPlayerData]);

    const handleCancel = async () => {
        if (!classId || !battleId) return;
        if (window.confirm("대결 신청을 취소하시겠습니까?")) {
            await cancelBattleChallenge(classId, battleId);
            goBack();
        }
    };

    const startNewTurn = async (battleRef, log) => {
        // [수정] quizPool 사용
        const randomQuiz = (quizPool && quizPool.length > 0)
            ? quizPool[Math.floor(Math.random() * quizPool.length)]
            : { question: "퀴즈 로딩 중...", answer: "1" };

        await updateDoc(battleRef, {
            status: 'quiz',
            log: log,
            question: randomQuiz,
            turnStartTime: Date.now(),
            turn: null,
            attackerAction: null,
            defenderAction: null,
            chat: {}
        });
    };

    const handleActionTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'action') return;
                const data = battleDoc.data();
                if (Date.now() - data.turnStartTime < 9500) return;

                const updates = {};
                if (!data.attackerAction) updates.attackerAction = 'TACKLE';
                if (!data.defenderAction) updates.defenderAction = 'BRACE';

                if (Object.keys(updates).length > 0) transaction.update(battleRef, updates);
            });
        } catch (error) {
            console.error("Action timeout error:", error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    const handleTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status === 'finished' || data.status !== 'quiz') return null;
                if (Date.now() - data.turnStartTime < 14500) return null;

                let { challenger, opponent } = data;
                const damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                const damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));

                challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                if (challenger.pet.status?.stunned) delete challenger.pet.status.stunned;
                if (opponent.pet.status?.stunned) delete opponent.pet.status.stunned;

                const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                let winnerId = null;

                if (isFinished) {
                    if (challenger.pet.hp > 0) winnerId = challenger.id;
                    else if (opponent.pet.hp > 0) winnerId = opponent.id;
                    else winnerId = null;
                }

                // [수정] quizPool 사용
                const nextQuiz = (quizPool && quizPool.length > 0)
                    ? quizPool[Math.floor(Math.random() * quizPool.length)]
                    : { question: "퀴즈 로딩 중...", answer: "1" };

                const updateData = {
                    challenger,
                    opponent,
                    log: isFinished ? `시간 초과! 펫이 지쳐 쓰러졌습니다!` : `시간 초과! 서로 눈치만 보다가 체력이 감소했습니다!`,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    attackerAction: null,
                    defenderAction: null,
                    turn: null,
                    ...(!isFinished && {
                        turnStartTime: Date.now(),
                        question: nextQuiz,
                        chat: {}
                    })
                };
                transaction.update(battleRef, updateData);
                return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }
        } catch (error) {
            console.error("Timeout handling error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const processQuizAnswer = async (submittedAnswer) => {
        if (!battleState.question || !submittedAnswer || isProcessing) return;

        const isObjective = battleState.question.options && battleState.question.options.length > 0;
        const isCorrect = submittedAnswer.toLowerCase() === battleState.question.answer.toLowerCase();

        if (isObjective && battleState.chat?.[myPlayerData.id]) return;

        setIsProcessing(true);
        const filteredAnswer = filterProfanity(submittedAnswer);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleRef = doc(db, 'classes', classId, 'battles', battleId);
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return null;

                const data = battleDoc.data();
                const myId = myPlayerData.id;

                const isQuestionObjective = data.question.options && data.question.options.length > 0;

                if (isQuestionObjective && data.chat && data.chat[myId]) return null;

                const isChallenger = myId === data.challenger.id;
                const myRole = isChallenger ? 'challenger' : 'opponent';
                const opponentRole = isChallenger ? 'opponent' : 'challenger';
                const opponentId = data[opponentRole].id;
                const opponentChat = data.chat?.[opponentId];
                const opponentIsStunned = data[opponentRole].pet.status?.stunned;

                const myPet = data[myRole].pet;

                const myChatEntry = { text: filteredAnswer, isCorrect, timestamp: Date.now() };
                const updatedChat = { ...(data.chat || {}), [myId]: myChatEntry };

                if (isCorrect) {
                    const winnerId = myPlayerData.id;
                    let newStatus = { ...myPet.status };

                    if (newStatus.recharging) {
                        delete newStatus.recharging;
                        // [수정] quizPool 사용
                        const nextQuiz = (quizPool && quizPool.length > 0)
                            ? quizPool[Math.floor(Math.random() * quizPool.length)]
                            : { question: "퀴즈 로딩 중...", answer: "1" };

                        transaction.update(battleRef, {
                            status: 'quiz',
                            turn: null,
                            [`${myRole}.pet.status`]: newStatus,
                            log: `정답! ${myPet.name}은(는) 숨을 고르며 반동을 회복했습니다.`,
                            question: nextQuiz,
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    } else {
                        transaction.update(battleRef, {
                            status: 'action',
                            turn: winnerId,
                            log: `정답! ${myPet.name}의 공격! 상대는 방어하세요!`,
                            question: null,
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    }
                    return null;
                } else {
                    let shouldEndTurn = false;

                    if (isQuestionObjective) {
                        if ((opponentChat && opponentChat.isCorrect === false) || opponentIsStunned) {
                            shouldEndTurn = true;
                        }
                    }

                    if (shouldEndTurn) {
                        let { challenger, opponent } = data;

                        const damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                        const damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));

                        challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                        opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                        if (challenger.pet.status?.stunned) delete challenger.pet.status.stunned;
                        if (opponent.pet.status?.stunned) delete opponent.pet.status.stunned;

                        const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                        let winnerId = null;

                        if (isFinished) {
                            if (challenger.pet.hp > 0) winnerId = challenger.id;
                            else if (opponent.pet.hp > 0) winnerId = opponent.id;
                        }

                        // [수정] quizPool 사용
                        const nextQuiz = (quizPool && quizPool.length > 0)
                            ? quizPool[Math.floor(Math.random() * quizPool.length)]
                            : { question: "퀴즈 로딩 중...", answer: "1" };

                        let logMessage = `둘 다 오답! 서로 틀려서 데미지를 입었습니다 (-5%). 다음 문제!`;
                        if (opponentIsStunned) {
                            logMessage = `오답! 상대방은 혼란 상태라 답변할 수 없어, 둘 다 피해를 입었습니다! (-5%) (혼란 해제)`;
                        }

                        const updateData = {
                            challenger,
                            opponent,
                            log: logMessage,
                            status: isFinished ? 'finished' : 'quiz',
                            winner: winnerId,
                            turn: null,
                            ...(!isFinished && {
                                turnStartTime: Date.now(),
                                question: nextQuiz,
                                chat: {}
                            })
                        };
                        transaction.update(battleRef, updateData);

                        if (isFinished) {
                            return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
                        }
                    } else {
                        transaction.update(battleRef, {
                            chat: updatedChat,
                            log: `${myPlayerData.name} 오답! (다시 시도하세요)`
                        });
                    }
                    return null;
                }
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }

        } catch (error) {
            console.error("퀴즈 처리 오류:", error);
        } finally {
            setAnswer('');
            setIsProcessing(false);
        }
    };

    const handleQuizSubmit = (e) => {
        e.preventDefault();
        processQuizAnswer(answer.trim());
    };

    const handleOptionClick = (option) => {
        processQuizAnswer(option);
    };

    const handleActionSelect = async (actionId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);

        const isMyTurn = battleState.turn === myPlayerData.id;

        try {
            if (isMyTurn) {
                const updates = { attackerAction: actionId };
                const myRole = myPlayerData.id === battleState.challenger.id ? 'challenger' : 'opponent';
                const opponentRole = myRole === 'challenger' ? 'opponent' : 'challenger';
                const opponentIsStunned = battleState[opponentRole].pet.status?.stunned;

                const myPet = battleState[myRole].pet;

                if (opponentIsStunned) {
                    updates.defenderAction = 'STUNNED';
                    updates.log = `${myPet.name}의 공격! (상대방은 혼란 상태라 방어 불가!)`;
                }

                await updateDoc(battleRef, updates);
            } else {
                if (actionId === 'FLEE') {
                    if (Math.random() < 0.3) {
                        const opponentId = battleState.turn;
                        const myId = myPlayerData.id;

                        const isChallengerMe = myPlayerData.id === battleState.challenger.id;
                        const myPet = isChallengerMe ? battleState.challenger.pet : battleState.opponent.pet;
                        const opponentPet = isChallengerMe ? battleState.opponent.pet : battleState.challenger.pet;

                        await updateDoc(battleRef, {
                            status: 'finished',
                            winner: null,
                            defenderAction: 'FLEE_SUCCESS',
                            log: `${myPet.name}이(가) 도망쳤습니다!`
                        });

                        await processBattleDraw(classId, myId, opponentId, myPet, opponentPet);
                        setTimeout(() => goBack(), 2000);
                    } else {
                        await updateDoc(battleRef, { defenderAction: 'FLEE_FAILED', log: '도망치기에 실패했다!' });
                    }
                } else {
                    await updateDoc(battleRef, { defenderAction: actionId });
                }
            }
            setActionSubMenu(null);
        } catch (error) {
            console.error("Action select error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResolution = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status === 'finished') return null;

                let { challenger, opponent, turn, attackerAction, defenderAction } = data;
                if (!attackerAction || !defenderAction) return null;

                const isChallengerAttacker = turn === challenger.id;
                let attacker = isChallengerAttacker ? { ...challenger } : { ...opponent };
                let defender = isChallengerAttacker ? { ...opponent } : { ...challenger };

                if (defender.pet.status?.stunned) {
                    delete defender.pet.status.stunned;
                }

                let skillId = attackerAction.toUpperCase();
                let skill = SKILLS[skillId];
                let isSpInsufficient = false;
                const originalSkillName = skill?.name;

                if (skill && skill.cost > attacker.pet.sp) {
                    skillId = 'TACKLE';
                    skill = SKILLS.TACKLE;
                    isSpInsufficient = true;
                }

                let log = "";

                if (skill && skill.effect) {
                    log = skill.effect(attacker.pet, defender.pet, defenderAction);
                    if (isSpInsufficient) {
                        log = `(SP 부족!) ${originalSkillName} 실패.. 대신 ${log}`;
                    }
                    if (defenderAction === 'STUNNED') {
                        log += ` (상대는 혼란 상태라 방어하지 못했다!)`;
                    }
                } else {
                    let damage = 20 + attacker.pet.atk * 2;
                    if (defenderAction === 'BRACE') damage *= 0.5;
                    damage = Math.round(damage);
                    defender.pet.hp = Math.max(0, defender.pet.hp - damage);
                    log += `${attacker.pet.name}의 공격! ${damage}의 피해!`;
                }

                if (skill) {
                    attacker.pet.sp = Math.max(0, attacker.pet.sp - skill.cost);
                }

                const isFinished = defender.pet.hp <= 0;
                let winnerId = null;
                if (isFinished) {
                    winnerId = attacker.id;
                    log += ` ${defender.pet.name}은(는) 쓰러졌다! ${attacker.name}의 승리!`;
                }

                // [수정] quizPool 사용
                const nextQuiz = (quizPool && quizPool.length > 0)
                    ? quizPool[Math.floor(Math.random() * quizPool.length)]
                    : { question: "퀴즈 데이터 없음", answer: "1" };

                const updateData = {
                    log,
                    challenger: isChallengerAttacker ? attacker : defender,
                    opponent: isChallengerAttacker ? defender : attacker,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    ...(!isFinished && {
                        question: nextQuiz,
                        turnStartTime: Date.now(),
                        turn: null,
                        attackerAction: null,
                        defenderAction: null,
                        chat: {}
                    })
                };

                transaction.update(battleRef, updateData);
                return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }
        } catch (error) {
            console.error("Battle resolution error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!myPlayerData) return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    if (!battleState) return <Arena><WaitingText>상대방의 수락을 기다리는 중...</WaitingText></Arena>;

    if (battleState.status === 'pending' && myPlayerData.id === battleState.challenger.id) {
        return (
            <Arena>
                <WaitingText>
                    <p>{battleState.log}</p>
                    <CancelButton onClick={handleCancel}>신청 취소</CancelButton>
                </WaitingText>
            </Arena>
        );
    }

    const IamChallenger = myPlayerData.id === battleState.challenger.id;
    const myRole = IamChallenger ? 'challenger' : 'opponent';
    const myInfo = battleState[myRole];
    const opponentInfo = battleState[IamChallenger ? 'opponent' : 'challenger'];

    const isAttacker = battleState.turn === myPlayerData.id;
    const showActionMenu = battleState.status === 'action' && isAttacker && !battleState.attackerAction;
    const showDefenseMenu = battleState.status === 'action' && !isAttacker && !battleState.defenderAction;

    const myEquippedSkills = myInfo.pet.equippedSkills
        .filter(id => id.toLowerCase() !== 'tackle')
        .map(id => {
            const skill = SKILLS[id.toUpperCase()];
            return skill ? { ...skill, id: id.toUpperCase() } : null;
        })
        .filter(Boolean);

    const showTimer = (battleState.status === 'quiz' || battleState.status === 'action');
    const isStunned = myInfo.pet.status?.stunned;
    const hasSubmitted = battleState.chat?.[myPlayerData?.id] !== undefined;

    return (
        <>
            <Arena>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {showTimer && <Timer>{timeLeft}</Timer>}
                            {currentEffect && (
                                <BattleSkillEffect
                                    type={currentEffect.type}
                                    isMine={currentEffect.isMine}
                                />
                            )}

                            <MyInfoBox>
                                <span>{myInfo.pet.name} (Lv.{myInfo.pet.level})</span>
                                <StatBar>
                                    <BarFill
                                        $percent={Math.max(0, (myInfo.pet.hp / myInfo.pet.maxHp) * 100)}
                                        color={getHpColor(myInfo.pet.hp, myInfo.pet.maxHp)}
                                    >
                                        HP: {myInfo.pet.hp}/{myInfo.pet.maxHp}
                                    </BarFill>
                                </StatBar>
                                <StatBar><BarFill $percent={Math.max(0, (myInfo.pet.sp / myInfo.pet.maxSp) * 100)} color="#007bff">SP: {myInfo.pet.sp}/{myInfo.pet.maxSp}</BarFill></StatBar>
                            </MyInfoBox>
                            <OpponentInfoBox>
                                <span>{opponentInfo.pet.name} (Lv.{opponentInfo.pet.level})</span>
                                <StatBar>
                                    <BarFill
                                        $percent={Math.max(0, (opponentInfo.pet.hp / opponentInfo.pet.maxHp) * 100)}
                                        color={getHpColor(opponentInfo.pet.hp, opponentInfo.pet.maxHp)}
                                    >
                                        HP: {opponentInfo.pet.hp}/{opponentInfo.pet.maxHp}
                                    </BarFill>
                                </StatBar>
                                <StatBar><BarFill $percent={Math.max(0, (opponentInfo.pet.sp / opponentInfo.pet.maxSp) * 100)} color="#007bff">SP: {opponentInfo.pet.sp}/{opponentInfo.pet.maxSp}</BarFill></StatBar>
                            </OpponentInfoBox>

                            <OpponentPetContainerWrapper>
                                <PetContainer
                                    $isHit={hitState.opponent}
                                    $animType={animState.opponent}
                                    $isMine={false}
                                >
                                    {opponentInfo.pet.status?.stunned && <StunEffect />}
                                    {opponentInfo.pet.status?.recharging && <RechargeEffect>💤 지침...</RechargeEffect>}
                                    {battleState.chat?.[opponentInfo.id] && <ChatBubble $isMine={false} $isCorrect={battleState.chat[opponentInfo.id].isCorrect}>{battleState.chat[opponentInfo.id].text}</ChatBubble>}
                                    <PetImage src={getPetImageSrc(opponentInfo, false)} alt="상대 펫" $isFainted={opponentInfo.pet.hp <= 0} />
                                </PetContainer>
                            </OpponentPetContainerWrapper>

                            <MyPetContainerWrapper>
                                <PetContainer
                                    $isHit={hitState.my}
                                    $animType={animState.my}
                                    $isMine={true}
                                >
                                    {myInfo.pet.status?.stunned && <StunEffect />}
                                    {myInfo.pet.status?.recharging && <RechargeEffect>💤 지침...</RechargeEffect>}
                                    {battleState.chat?.[myInfo.id] && <ChatBubble $isMine={true} $isCorrect={battleState.chat[myInfo.id].isCorrect}>{battleState.chat[myInfo.id].text}</ChatBubble>}
                                    <PetImage src={getPetImageSrc(myInfo, true)} alt="나의 펫" $isFainted={myInfo.pet.hp <= 0} />
                                </PetContainer>
                            </MyPetContainerWrapper>
                        </BattleField>
                        <QuizArea>
                            <div>
                                <LogText>{battleState.log}</LogText>
                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <h3>Q. {battleState.question.question}</h3>
                                        {isStunned ? (
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <p style={{ color: 'red', fontWeight: 'bold', fontSize: '1.2rem' }}>😵 혼란 상태! 아무것도 할 수 없습니다.</p>
                                                <p>(상대방의 행동을 기다리는 중...)</p>
                                            </div>
                                        ) : (
                                            <>
                                                {battleState.question.options && battleState.question.options.length > 0 ? (
                                                    <OptionGrid>
                                                        {battleState.question.options.map((opt, idx) => (
                                                            <OptionButton
                                                                key={idx}
                                                                onClick={() => handleOptionClick(opt)}
                                                                disabled={isProcessing || hasSubmitted}
                                                                style={{
                                                                    opacity: hasSubmitted ? 0.5 : 1,
                                                                    cursor: hasSubmitted ? 'not-allowed' : 'pointer'
                                                                }}
                                                            >
                                                                {opt}
                                                            </OptionButton>
                                                        ))}
                                                    </OptionGrid>
                                                ) : (
                                                    <form onSubmit={handleQuizSubmit}>
                                                        <AnswerInput
                                                            name="answer"
                                                            value={answer}
                                                            onChange={(e) => setAnswer(e.target.value)}
                                                            placeholder={"정답을 입력하세요"}
                                                            autoFocus
                                                            disabled={isProcessing || (hasSubmitted && battleState.chat?.[myPlayerData.id]?.isCorrect)}
                                                        />
                                                    </form>
                                                )}

                                                {hasSubmitted && battleState.question.options && (
                                                    <div style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontWeight: 'bold' }}>
                                                        {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                            ? "정답입니다! (처리 중...)"
                                                            : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            <ActionMenu>
                                {!isStunned && (
                                    <>
                                        {showActionMenu && (
                                            !actionSubMenu ?
                                                <>
                                                    <MenuItem onClick={() => handleActionSelect('TACKLE')}>기본 공격</MenuItem>
                                                    <MenuItem onClick={() => setActionSubMenu('skills')}>특수 공격</MenuItem>
                                                </> :
                                                <>
                                                    {myEquippedSkills.map(skill => (
                                                        <MenuItem key={skill.id} onClick={() => handleActionSelect(skill.id)} disabled={myInfo.pet.sp < skill.cost}>{skill.name} ({skill.cost}SP)</MenuItem>
                                                    ))}
                                                    <MenuItem onClick={() => setActionSubMenu(null)}>뒤로가기</MenuItem>
                                                </>
                                        )}
                                        {showDefenseMenu && (
                                            Object.entries(DEFENSE_ACTIONS).map(([key, name]) => (
                                                <MenuItem key={key} onClick={() => handleActionSelect(key)}>{name}</MenuItem>
                                            ))
                                        )}
                                    </>
                                )}
                            </ActionMenu>
                        </QuizArea>
                    </>
                )}
            </Arena>
            {battleState?.status === 'finished' && (
                <ModalBackground>
                    <ModalContent $color={!battleState.winner ? '#6c757d' : (battleState.winner === myPlayerData.id ? '#007bff' : '#dc3545')}>
                        <h2>
                            {!battleState.winner
                                ? "배틀 종료"
                                : (battleState.winner === myPlayerData.id ? "승리!" : "패배...")}
                        </h2>
                        <p>{battleState.log}</p>
                        <button onClick={() => navigate('/pet')}>확인</button>
                    </ModalContent>
                </ModalBackground>
            )}
        </>
    );
}

export default BattlePage;