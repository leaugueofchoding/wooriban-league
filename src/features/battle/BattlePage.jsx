import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '@/store/leagueStore';
import { auth, db, updateBattleChat } from '@/api/firebase';
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
    display: flex; justify-content: center; align-items: center;
    height: 100%; font-size: 1.5rem; color: #495057;
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


const allQuizzes = Object.values(allQuizzesData).flat();
const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기', FLEE: '도망치기' };
const profanityList = ['바보', '멍청이', 'xx'];

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
    const [hitState, setHitState] = useState({ my: false, opponent: false });
    const [actionSubMenu, setActionSubMenu] = useState(null);
    const timerRef = useRef(null);
    const timeoutRef = useRef(null);

    // [수정 1] 게임 상태 감지 및 결과 처리
    // 문제점 해결: status가 'action'일 때도 감지하도록 수정하여 게임이 멈추지 않게 함
    useEffect(() => {
        if (!battleState) return;

        const { status, attackerAction, defenderAction } = battleState;

        // 양쪽 모두 행동을 선택했다면 결과 처리 실행 (status 체크 완화)
        if ((status === 'quiz' || status === 'action') && attackerAction && defenderAction) {
            if (!isProcessing) {
                const battleRef = doc(db, 'classes', classId, 'battles', battleId);
                handleResolution(battleRef);
            }
        }
    }, [battleState, isProcessing, classId, battleId]);


    // [수정 2] 타이머 및 시간 초과 처리
    // 문제점 해결: turnStartTime이 변경되면 즉시 elapsed가 0이 되어 중복 호출 방지
    useEffect(() => {
        if (!battleState || battleState.status !== 'quiz') return;

        const timerInterval = setInterval(() => {
            if (isProcessing) return;

            const now = Date.now();
            const timeLimit = 15000;
            // DB에 기록된 턴 시작 시간 기준으로 경과 시간 계산
            const elapsed = now - (battleState.turnStartTime || now);

            if (elapsed > timeLimit) {
                const battleRef = doc(db, 'classes', classId, 'battles', battleId);
                handleTimeout(battleRef);
            }
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [battleState, isProcessing, classId, battleId]);

    // [추가] 펫 전멸 시 배틀 진입 차단 로직
    useEffect(() => {
        if (myPlayerData && myPlayerData.pets) {
            const livePets = myPlayerData.pets.filter(p => p.hp > 0);
            if (livePets.length === 0) {
                alert("모든 펫이 기절하여 배틀을 진행할 수 없습니다.\n펫 센터에서 치료해주세요!");
                navigate('/pet');
            }
        }
    }, [myPlayerData, navigate]);

    // Battle state listener
    useEffect(() => {
        if (!myPlayerData || !classId) return;
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (doc) => {
            if (doc.exists()) setBattleState(doc.data());
            else setBattleState(null);
        });
        return () => unsubscribe();
    }, [myPlayerData, battleId, classId]);

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
                }, 2000);
            } else if (battleState.status === 'resolution') {
                timeoutRef.current = setTimeout(() => handleResolution(battleRef), 2000);
            } else if (battleState.status === 'finished') {
                if (battleState.defenderAction === 'FLEE_SUCCESS') {
                    const winnerId = battleState.winner;
                    const loserId = (winnerId === battleState.challenger.id) ? battleState.opponent.id : battleState.challenger.id;
                    const winnerPet = (winnerId === battleState.challenger.id) ? battleState.challenger.pet : battleState.opponent.pet;
                    const loserPet = (loserId === battleState.challenger.id) ? battleState.challenger.pet : battleState.opponent.pet;
                    processBattleResults(classId, winnerId, loserId, true, winnerPet, loserPet)
                        .then(() => setTimeout(() => navigate('/pet'), 5000));
                }
            }
        }

        // Timer logic (Display only)
        if (battleState.status === 'quiz' && battleState.turnStartTime) {
            const updateTimer = () => {
                const elapsed = (Date.now() - battleState.turnStartTime) / 1000;
                const newTimeLeft = Math.floor(Math.max(0, 15 - elapsed)); // 15초 기준
                setTimeLeft(newTimeLeft);
            };
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        }

        return () => {
            clearInterval(timerRef.current);
            clearTimeout(timeoutRef.current);
        };
    }, [battleState, myPlayerData]);

    const startNewTurn = (battleRef, log) => {
        updateDoc(battleRef, {
            status: 'quiz',
            log: log,
            question: allQuizzes[Math.floor(Math.random() * allQuizzes.length)],
            turnStartTime: Date.now(),
            turn: null,
            attackerAction: null,
            defenderAction: null,
            chat: {}
        });
    };

   // [수정] handleTimeout: 5% 데미지 + 문제 교체 로직 적용
    const handleTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return null;

                const data = battleDoc.data();
                
                // 중복 실행 방지 (15초 + 1초 버퍼)
                if (Date.now() - data.turnStartTime < 14000) {
                    return null; 
                }

                let { challenger, opponent } = data;
                
                // [과제 2] 전체 체력의 5%로 데미지 수정 (최소 1 데미지는 들어가도록 설정)
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

                const updateData = {
                    challenger,
                    opponent,
                    log: isFinished ? `시간 초과! 펫이 쓰러졌습니다!` : `시간 초과! 양쪽 모두 체력이 감소했습니다!`,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    // [과제 1] 시간이 초과되었는데 안 끝났으면, 새로운 문제로 교체
                    ...(!isFinished && { 
                        turnStartTime: Date.now(),
                        question: allQuizzes[Math.floor(Math.random() * allQuizzes.length)]
                    })
                };

                transaction.update(battleRef, updateData);

                return {
                    isFinished,
                    winnerId,
                    finalChallenger: updateData.challenger,
                    finalOpponent: updateData.opponent
                };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
                setTimeout(() => navigate('/pet'), 3000);
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
                        status: 'action', // 여기서 status가 action으로 변경됨
                        turn: myRole,
                        log: `정답! ${myPlayerData.name}의 공격! 상대는 방어하세요!`,
                        question: null,
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
                    if (Math.random() < 0.5) {
                        const winnerId = battleState.turn === 'challenger' ? battleState.opponent.id : battleState.challenger.id;
                        const loserId = myPlayerData.id;
                        const winnerPet = battleState.turn === 'challenger' ? battleState.opponent.pet : battleState.challenger.pet;
                        const loserPet = battleState.turn === 'challenger' ? battleState.challenger.pet : battleState.opponent.pet;

                        await updateDoc(battleRef, {
                            status: 'finished',
                            winner: winnerId,
                            log: `${myPlayerData.name}이(가) 도망쳤습니다!`
                        });

                        await processBattleResults(classId, winnerId, loserId, true, winnerPet, loserPet);
                        setTimeout(() => navigate('/pet'), 2000);
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

                const updateData = {
                    log,
                    challenger: attackerRole === 'challenger' ? attacker : defender,
                    opponent: attackerRole === 'opponent' ? attacker : defender,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    ...(!isFinished && {
                        question: allQuizzes[Math.floor(Math.random() * allQuizzes.length)],
                        turnStartTime: Date.now(),
                        turn: null,
                        attackerAction: null,
                        defenderAction: null,
                        chat: {}
                    })
                };

                transaction.update(battleRef, updateData);

                return {
                    isFinished,
                    winnerId,
                    finalChallenger: updateData.challenger,
                    finalOpponent: updateData.opponent
                };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
                setTimeout(() => navigate('/pet'), 3000);
            }

        } catch (error) {
            console.error("Battle resolution error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!myPlayerData) return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    if (!battleState) return <Arena><WaitingText>상대방의 수락을 기다리는 중...</WaitingText></Arena>;

    const IamChallenger = myPlayerData.id === battleState.challenger.id;
    const myRole = IamChallenger ? 'challenger' : 'opponent';
    const myInfo = battleState[myRole];
    const opponentInfo = battleState[IamChallenger ? 'opponent' : 'challenger'];

    const isAttacker = battleState.turn === myRole;

    const showActionMenu = battleState.status === 'action' && isAttacker && !battleState.attackerAction;
    const showDefenseMenu = battleState.status === 'action' && !isAttacker && !battleState.defenderAction;

    const myEquippedSkills = myInfo.pet.equippedSkills.map(id => SKILLS[id.toUpperCase()]).filter(Boolean);

    return (
        <>
            <Arena>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {(battleState.status === 'quiz') && <Timer>{timeLeft}</Timer>}
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
                            </ActionMenu>
                        </QuizArea>
                    </>
                )}
            </Arena>
            {battleState?.status === 'finished' && (
                <ModalBackground>
                    <ModalContent $color={battleState.winner === myPlayerData.id ? '#007bff' : '#dc3545'}>
                        <h2>{battleState.winner === myPlayerData.id ? "승리!" : "패배..."}</h2>
                        <p>{battleState.log}</p>
                        <button onClick={() => navigate('/pet')}>확인</button>
                    </ModalContent>
                </ModalBackground>
            )}
        </>
    );
}

export default BattlePage;