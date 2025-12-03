import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '@/store/leagueStore';
import { auth, db, updateBattleChat, cancelBattleChallenge } from '@/api/firebase';
import { doc, onSnapshot, updateDoc, runTransaction, getDoc } from "firebase/firestore";
import allQuizzesData from '@/assets/missions.json';
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA, SKILLS } from '@/features/pet/petData';

// --- Styled Components ---
const Arena = styled.div`
  max-width: 1200px; margin: 2rem auto; padding: 2rem; background-color: #f0f8ff;
  border-radius: 12px; border: 5px solid #add8e6; overflow: hidden;
`;
const shake = keyframes`
  0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); }
`;
const BattleField = styled.div`
  height: 550px; position: relative; margin-bottom: 2rem; background-color: rgba(255, 255, 255, 0.5); border-radius: 10px;
`;
const PetContainerWrapper = styled.div`
  position: absolute; width: 400px; height: 400px;
`;
const MyPetContainerWrapper = styled(PetContainerWrapper)` bottom: 10px; left: 10px; `;
const OpponentPetContainerWrapper = styled(PetContainerWrapper)` top: 10px; right: 10px; `;
const PetContainer = styled.div`
  position: relative; width: 100%; height: 100%;
  animation: ${props => props.$isHit ? shake : 'none'} 0.3s;
  display: flex; flex-direction: column; align-items: center;
`;
const PetImage = styled.img`
  width: 400px; height: 400px; filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'}; transition: filter 0.3s;
`;
const InfoBox = styled.div`
  position: absolute; width: 300px; padding: 1rem; border: 3px solid #333;
  border-radius: 8px; background-color: #fff; display: flex;
  flex-direction: column; gap: 0.5rem; z-index: 5;
`;
const MyInfoBox = styled(InfoBox)` right: 10px; bottom: 10px; `;
const OpponentInfoBox = styled(InfoBox)` left: 10px; top: 10px; `;
const StatBar = styled.div`
  width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden;
`;
const BarFill = styled.div`
  width: ${props => props.$percent}%; height: 100%; background-color: ${props => props.color}; transition: width 0.5s ease;
  display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: #fff;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
`;
const QuizArea = styled.div`
  padding: 1.5rem; background-color: #fff; border: 3px solid #333;
  border-radius: 8px; display: grid; grid-template-columns: 1fr 280px;
  gap: 2rem; min-height: 200px;
`;
const LogText = styled.p` font-size: 1.2rem; font-weight: bold; min-height: 50px; margin: 0; `;
const AnswerInput = styled.input`
  width: 100%; padding: 0.75rem; font-size: 1.1rem; text-align: center;
  border: 2px solid #ccc; border-radius: 8px; margin-top: 1rem;
`;
const ActionMenu = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 0.75rem;
`;
const MenuItem = styled.div`
  font-size: 1.2rem; font-weight: bold; padding: 0.75rem; border-radius: 8px;
  background-color: #f8f9fa; border: 1px solid #dee2e6;
  opacity: ${props => props.$disabled ? 0.5 : 1}; cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: background-color 0.2s; display: flex; justify-content: center;
  align-items: center; text-align: center;
  &:hover:not([disabled]) { background-color: #e9ecef; }
`;
const Timer = styled.div`
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 3rem; font-weight: bold; color: #dc3545; background-color: rgba(255, 255, 255, 0.8);
    padding: 0.5rem 2rem; border-radius: 20px; border: 3px solid #dc3545; z-index: 10;
`;
const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
`;
const ModalContent = styled.div`
  padding: 2rem 3rem; background: white; border-radius: 12px; text-align: center;
  h2 { font-size: 2.5rem; margin-bottom: 1rem; color: ${props => props.$color || '#333'}; }
  p { font-size: 1.2rem; margin: 0.5rem 0; }
  button { margin-top: 1rem; margin-left: 0.5rem; margin-right: 0.5rem; padding: 0.8rem 2rem; }
`;
const WaitingText = styled.div`
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    height: 100%; font-size: 1.5rem; color: #495057; gap: 1rem;
`;
const CancelButton = styled.button`
    padding: 0.8rem 2rem; font-size: 1.2rem; background-color: #dc3545; color: white;
    border: none; border-radius: 8px; cursor: pointer;
    &:hover { background-color: #c82333; }
`;
const ChatBubble = styled.div`
    position: absolute;
    background: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: 2px solid #333;
    max-width: 200px;
    word-wrap: break-word;
    z-index: 10;
    color: ${props => props.$isCorrect === false ? 'red' : (props.$isCorrect === true ? 'blue' : 'black')};
    font-weight: ${props => props.$isCorrect === true ? 'bold' : 'normal'};
    
    ${props => props.$isMine ? 'top: -60px; left: 50%;' : 'bottom: -60px; left: 50%;'}
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

// 퀴즈 데이터 안전하게 로드
const allQuizzes = Object.values(allQuizzesData || {}).flat();
const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기', FLEE: '도망치기' };
const profanityList = ['바보', '멍청이', 'xx'];

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
    const [actionSubMenu, setActionSubMenu] = useState(null);
    const timerRef = useRef(null);
    const timeoutRef = useRef(null);

    // 뒤로가기 함수
    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/pet');
        }
    };

    // Battle state listener
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

    // Game state progression
    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger.id;

        clearTimeout(timeoutRef.current);
        clearInterval(timerRef.current);

        if (iAmChallenger) {
            if (battleState.status === 'starting') {
                timeoutRef.current = setTimeout(() => {
                    startNewTurn(battleRef, "대결 시작! 퀴즈를 풀어 선공을 차지하세요!");
                }, 1500);
            } else if (battleState.status === 'resolution') {
                timeoutRef.current = setTimeout(() => handleResolution(battleRef), 2000);
            }
        }

        // UI Timer Logic
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

        return () => {
            clearInterval(timerRef.current);
            clearTimeout(timeoutRef.current);
        };
    }, [battleState, myPlayerData, isProcessing]);

    // 신청 취소 (대기 중일 때)
    const handleCancel = async () => {
        if (!classId || !battleId) return;
        if (window.confirm("대결 신청을 취소하시겠습니까?")) {
            await cancelBattleChallenge(classId, battleId);
            goBack();
        }
    };

    // [신규] 기권하기 (게임 중일 때 탈출용)
    const handleForfeit = async () => {
        if (!window.confirm("정말 기권하시겠습니까? 패배로 처리됩니다.")) return;
        if (isProcessing) return;
        setIsProcessing(true);

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);

        // 기권은 '상대방 승리'로 처리하거나, 별도의 'forfeit' 상태로 처리
        // 여기서는 '도망 실패'처럼 패배 처리로 유도 (상대방 승리)
        const opponentId = myPlayerData.id === battleState.challenger.id ? battleState.opponent.id : battleState.challenger.id;
        const myPet = myPlayerData.id === battleState.challenger.id ? battleState.challenger.pet : battleState.opponent.pet;
        const opponentPet = myPlayerData.id === battleState.challenger.id ? battleState.opponent.pet : battleState.challenger.pet;

        try {
            await updateDoc(battleRef, {
                status: 'finished',
                winner: opponentId,
                log: `${myPlayerData.name}님이 기권했습니다.`
            });
            // 패배 처리 (HP/SP 저장)
            await processBattleResults(classId, opponentId, myPlayerData.id, true, opponentPet, myPet);
            setTimeout(() => goBack(), 2000);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const startNewTurn = async (battleRef, log) => {
        if (!allQuizzes || allQuizzes.length === 0) {
            console.error("퀴즈 데이터가 없습니다.");
            const fallbackQuiz = { question: "퀴즈 데이터가 없습니다. 아무거나 입력하세요.", answer: "1" };
            await updateDoc(battleRef, {
                status: 'quiz',
                log: log,
                question: fallbackQuiz,
                turnStartTime: Date.now(),
                turn: null,
                attackerAction: null,
                defenderAction: null,
                chat: {}
            });
            return;
        }
        const randomQuiz = allQuizzes[Math.floor(Math.random() * allQuizzes.length)];

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
                if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return null;
                const data = battleDoc.data();
                if (Date.now() - data.turnStartTime < 14500) return null;

                let { challenger, opponent } = data;
                const damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                const damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));

                challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                let winnerId = null;
                if (isFinished) {
                    if (challenger.pet.hp > 0) winnerId = challenger.id;
                    else if (opponent.pet.hp > 0) winnerId = opponent.id;
                    else winnerId = challenger.id;
                }

                const nextQuiz = (allQuizzes && allQuizzes.length > 0)
                    ? allQuizzes[Math.floor(Math.random() * allQuizzes.length)]
                    : { question: "퀴즈 데이터 없음", answer: "1" };

                const updateData = {
                    challenger,
                    opponent,
                    log: isFinished ? `시간 초과! 펫이 쓰러졌습니다!` : `시간 초과! 양쪽 모두 체력이 감소했습니다!`,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    ...(!isFinished && {
                        turnStartTime: Date.now(),
                        question: nextQuiz
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
                setTimeout(() => goBack(), 3000);
            }
        } catch (error) {
            console.error("Timeout handling error:", error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    const handleQuizSubmit = async (e) => {
        e.preventDefault();
        const submittedAnswer = answer.trim();
        if (!battleState.question || !submittedAnswer || isProcessing) return;

        setIsProcessing(true);
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const isCorrect = submittedAnswer.toLowerCase() === battleState.question.answer.toLowerCase();

        const filteredAnswer = profanityList.reduce((acc, profanity) => acc.replace(new RegExp(profanity, 'gi'), '**'), submittedAnswer);
        await updateBattleChat(classId, battleId, myPlayerData.id, filteredAnswer, isCorrect);

        if (isCorrect) {
            try {
                await runTransaction(db, async (transaction) => {
                    const battleDoc = await transaction.get(battleRef);
                    if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return;
                    const myRole = myPlayerData.id === battleDoc.data().challenger.id ? 'challenger' : 'opponent';
                    transaction.update(battleRef, {
                        status: 'action',
                        turn: myRole,
                        log: `정답! ${myPlayerData.name}의 공격! 상대는 방어하세요!`,
                        question: null,
                        turnStartTime: Date.now()
                    });
                });
            } catch (error) { console.error("퀴즈 처리 오류:", error); }
        }
        setAnswer('');
        setIsProcessing(false);
    };

    const handleActionSelect = async (actionId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const myRole = myPlayerData.id === battleState.challenger.id ? 'challenger' : 'opponent';

        try {
            if (battleState.turn === myRole) {
                await updateDoc(battleRef, { attackerAction: actionId });
            } else {
                if (actionId === 'FLEE') {
                    if (Math.random() < 0.3) {
                        const opponentId = battleState.turn === 'challenger' ? battleState.opponent.id : battleState.challenger.id;
                        const myPet = battleState.turn === 'challenger' ? battleState.opponent.pet : battleState.challenger.pet;
                        const opponentPet = battleState.turn === 'challenger' ? battleState.challenger.pet : battleState.opponent.pet;

                        await updateDoc(battleRef, {
                            status: 'finished',
                            winner: null,
                            defenderAction: 'FLEE_SUCCESS',
                            log: `${myPlayerData.name}이(가) 도망쳤습니다!`
                        });
                        await processBattleDraw(classId, myPlayerData.id, opponentId, myPet, opponentPet);
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
                if (!battleDoc.exists() || !battleDoc.data().attackerAction || !battleDoc.data().defenderAction) return null;
                let { challenger, opponent, turn, attackerAction, defenderAction } = battleDoc.data();

                const attackerRole = turn;
                let attacker = attackerRole === 'challenger' ? { ...challenger } : { ...opponent };
                let defender = attackerRole === 'challenger' ? { ...opponent } : { ...challenger };

                const skill = SKILLS[attackerAction.toUpperCase()];
                let damage = skill.basePower + attacker.pet.atk;
                let log = `${attacker.pet.name}의 ${skill.name}!`;

                switch (defenderAction) {
                    case 'BRACE':
                        damage *= 0.5;
                        log += ` ${defender.pet.name}은(는) 웅크려 피해를 줄였다!`;
                        break;
                    case 'EVADE':
                        if (Math.random() < 0.5) {
                            damage = 0;
                            log += ` 하지만 ${defender.pet.name}은(는) 공격을 회피했다!`;
                        } else {
                            log += ` 하지만 회피에 실패했다!`;
                        }
                        break;
                    case 'FOCUS':
                        attacker.pet.status = { ...(attacker.pet.status || {}), focusCharge: 1 };
                        log += ` ${defender.pet.name}은(는) 공격을 받아내며 기를 모은다!`;
                        break;
                    case 'FLEE_FAILED':
                        log += ` ${defender.pet.name}은(는) 도망에 실패해 무방비 상태!`;
                        break;
                    default:
                        break;
                }

                damage = Math.round(damage);
                defender.pet.hp = Math.max(0, defender.pet.hp - damage);
                log += ` ${defender.pet.name}에게 ${damage}의 피해!`;
                attacker.pet.sp -= skill.cost;

                const isFinished = defender.pet.hp <= 0;
                let winnerId = null;
                if (isFinished) {
                    winnerId = attacker.id;
                    log += ` ${defender.pet.name}은(는) 쓰러졌다! ${attacker.name}의 승리!`;
                }

                const nextQuiz = (allQuizzes && allQuizzes.length > 0)
                    ? allQuizzes[Math.floor(Math.random() * allQuizzes.length)]
                    : { question: "퀴즈 데이터 없음", answer: "1" };

                const updateData = {
                    log,
                    challenger: attackerRole === 'challenger' ? attacker : defender,
                    opponent: attackerRole === 'opponent' ? attacker : defender,
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
                setTimeout(() => goBack(), 3000);
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

    const isAttacker = battleState.turn === myRole;
    const showActionMenu = battleState.status === 'action' && isAttacker && !battleState.attackerAction;
    const showDefenseMenu = battleState.status === 'action' && !isAttacker && !battleState.defenderAction;
    const myEquippedSkills = myInfo.pet.equippedSkills.map(id => SKILLS[id.toUpperCase()]).filter(Boolean);
    const showTimer = (battleState.status === 'quiz' || battleState.status === 'action');

    return (
        <>
            <Arena>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {showTimer && <Timer>{timeLeft}</Timer>}
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

                            <OpponentPetContainerWrapper>
                                <PetContainer $isHit={hitState.opponent}>
                                    {battleState.chat?.[opponentInfo.id] && <ChatBubble $isMine={false} $isCorrect={battleState.chat[opponentInfo.id].isCorrect}>{battleState.chat[opponentInfo.id].text}</ChatBubble>}
                                    <PetImage src={petImageMap[`${opponentInfo.pet.appearanceId}_idle`]} alt="상대 펫" $isFainted={opponentInfo.pet.hp <= 0} />
                                </PetContainer>
                            </OpponentPetContainerWrapper>

                            <MyPetContainerWrapper>
                                <PetContainer $isHit={hitState.my}>
                                    {battleState.chat?.[myInfo.id] && <ChatBubble $isMine={true} $isCorrect={battleState.chat[myInfo.id].isCorrect}>{battleState.chat[myInfo.id].text}</ChatBubble>}
                                    <PetImage src={petImageMap[`${myInfo.pet.appearanceId}_battle`]} alt="나의 펫" $isFainted={myInfo.pet.hp <= 0} />
                                </PetContainer>
                            </MyPetContainerWrapper>
                        </BattleField>
                        <QuizArea>
                            <div>
                                <LogText>{battleState.log}</LogText>
                                {battleState.status === 'quiz' && battleState.question && (
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
                                {/* [신규] 기권하기 버튼 추가 (우측 하단 등에 배치) */}
                                <MenuItem onClick={handleForfeit} style={{ backgroundColor: '#dc3545', color: 'white' }}>기권하기</MenuItem>
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
                        <button onClick={() => goBack()}>확인</button>
                    </ModalContent>
                </ModalBackground>
            )}
        </>
    );
}

export default BattlePage;