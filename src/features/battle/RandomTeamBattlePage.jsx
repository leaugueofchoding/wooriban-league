// src/features/battle/RandomTeamBattlePage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db, getActiveQuizSets } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import { petImageMap } from '../../utils/petImageMap';
import { BattleHpBar, BattleSpBar } from './BattleStatBars';
import { enterRandomTeamBattle } from './randomBattleApi';
import BattleDuelView from './BattleDuelView';
import { battleDuelLayoutComponents } from './BattleDuelLayoutComponents';

const QUIZ_LIMIT_MS = 15000;

const Page = styled.div`
  max-width: 920px;
  margin: 0 auto;
  padding: 1rem 0.75rem 3rem;
  font-family: 'Pretendard', sans-serif;
`;

const Card = styled.div`
  background: #ffffff;
  border: 4px solid #364fc7;
  border-radius: 20px;
  padding: 1rem;
  box-shadow: 0 14px 36px rgba(0,0,0,0.12);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.9rem;

  h2 {
    margin: 0;
    color: #343a40;
    font-size: 1.35rem;
    font-weight: 1000;
  }

  p {
    margin: 0.25rem 0 0;
    color: #868e96;
    font-size: 0.86rem;
    font-weight: 800;
  }
`;

const ReadyBadge = styled.div`
  padding: 0.55rem 0.75rem;
  border-radius: 999px;
  background: ${props => props.$ready ? '#ebfbee' : '#fff3bf'};
  color: ${props => props.$ready ? '#2f9e44' : '#7c4a03'};
  font-weight: 1000;
  white-space: nowrap;
`;

const TeamGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const TeamBox = styled.div`
  border: 3px solid ${props => props.$side === 'A' ? '#339af0' : '#fa5252'};
  border-radius: 18px;
  overflow: hidden;
  background: #f8f9fa;

  h3 {
    margin: 0;
    padding: 0.7rem 0.85rem;
    background: ${props => props.$side === 'A' ? '#e7f5ff' : '#fff5f5'};
    color: ${props => props.$side === 'A' ? '#1864ab' : '#c92a2a'};
    font-size: 1rem;
    font-weight: 1000;
    border-bottom: 2px solid ${props => props.$side === 'A' ? '#339af0' : '#fa5252'};
  }
`;

const Member = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  background: white;
  border-bottom: 1px solid #e9ecef;

  &:last-child {
    border-bottom: none;
  }

  img {
    width: 58px;
    height: 58px;
    object-fit: contain;
    border-radius: 50%;
    background: #f1f3f5;
  }

  strong {
    display: block;
    color: #343a40;
    font-size: 0.94rem;
    font-weight: 1000;
  }

  span {
    display: block;
    color: #868e96;
    font-size: 0.78rem;
    font-weight: 850;
  }
`;

const LogBox = styled.div`
  margin-top: 1rem;
  padding: 0.85rem;
  border-radius: 14px;
  background: #edf2ff;
  color: #364fc7;
  font-weight: 900;
  line-height: 1.45;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
  flex-wrap: wrap;
`;

const Button = styled.button`
  flex: 1;
  min-width: 140px;
  border: none;
  border-radius: 12px;
  padding: 0.78rem 1rem;
  color: white;
  font-weight: 1000;
  cursor: pointer;
  background: ${props => props.$muted ? '#868e96' : props.$danger ? '#fa5252' : '#5f3dc4'};
  box-shadow: 0 4px 0 rgba(0,0,0,0.14);

  &:disabled {
    background: #adb5bd;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const noop = () => {};
const renderHpBar = (hp, maxHp) => <BattleHpBar hp={hp} maxHp={maxHp} />;
const renderSpBar = (sp, maxSp) => <BattleSpBar sp={sp} maxSp={maxSp} />;
const formatBattleLogForDisplay = (log) => Array.isArray(log) ? log.join('\n') : (log || '');

const normalizeAnswer = (value) => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace('○', 'O')
  .replace('×', 'X');

const isCorrectAnswer = (question, value) => {
  const expected = question?.answer ?? question?.correctAnswer;
  return normalizeAnswer(value) === normalizeAnswer(expected);
};

const isBattleFriendlyQuestion = (questionObj) => {
  if (!questionObj) return false;

  const type = String(questionObj.type || '').toLowerCase().replace(/\s/g, '');
  const answer = normalizeAnswer(questionObj.answer || '');
  const options = Array.isArray(questionObj.options) ? questionObj.options.filter(Boolean) : [];

  const isOxType = ['ox', 'o/x', 'truefalse', 'true/false'].includes(type);
  const isOxAnswer = ['O', 'X'].includes(answer);
  const hasMultipleChoices = options.length >= 2;

  return isOxType || isOxAnswer || hasMultipleChoices;
};

const getMemberPet = (member) => member?.pet || member?.lockedPet || member?.lockedTeam?.[0] || {};

const normalizeBattlePet = (member) => {
  const pet = getMemberPet(member);

  return {
    ...pet,
    id: pet.id || member?.petId || member?.playerId || 'pet',
    name: member?.petName || pet.name || 'pet',
    level: Number(member?.petLevel || pet.level || 1),
    hp: Number(pet.hp ?? pet.maxHp ?? 1),
    maxHp: Number(pet.maxHp ?? pet.hp ?? 1),
    sp: Number(pet.sp ?? 0),
    maxSp: Number(pet.maxSp ?? 0),
    status: { ...(pet.status || {}) },
  };
};

const getActiveMember = (members = [], activePlayerId, activePetId, activeIndex = 0) => {
  if (!Array.isArray(members) || members.length === 0) return null;

  if (activePlayerId) {
    const byPlayer = members.find(member => member?.playerId === activePlayerId);
    if (byPlayer) return byPlayer;
  }

  if (activePetId) {
    const byPet = members.find(member => {
      const pet = getMemberPet(member);
      return pet?.id === activePetId || member?.petId === activePetId;
    });
    if (byPet) return byPet;
  }

  const alive = members.find((member) => {
    const pet = getMemberPet(member);
    return Number(pet.hp ?? pet.maxHp ?? 1) > 0;
  });

  return alive || members[Math.max(0, Number(activeIndex || 0))] || members[0];
};

const buildDuelParticipant = (activeMember, teamMembers = []) => {
  if (!activeMember) return null;

  const team = teamMembers
    .map(normalizeBattlePet)
    .filter((pet) => pet?.id);

  const activePet = normalizeBattlePet(activeMember);
  const activeIndex = Math.max(0, team.findIndex((pet) => pet.id === activePet.id));
  const syncedTeam = team.length > 0
    ? team.map((pet, index) => index === activeIndex ? activePet : pet)
    : [activePet];

  return {
    id: activeMember.playerId,
    name: activeMember.playerName || 'Player',
    pet: activePet,
    team: syncedTeam,
    activePetIndex: activeIndex >= 0 ? activeIndex : 0,
    activePetId: activePet.id,
    participatedPetIds: [activePet.id].filter(Boolean),
    avatarSnapshotUrl: activeMember.avatarSnapshotUrl || null,
    photoURL: activeMember.photoURL || null,
    equippedTitle: activeMember.equippedTitle || null,
  };
};

const getPetImageSrc = (info, isMine) => {
  const appearanceId = info?.pet?.appearanceId || info?.pet?.species || '';
  if (!appearanceId) return '';

  const suffixes = isMine
    ? ['_battle', '_idle', '']
    : ['_idle', ''];

  for (const suffix of suffixes) {
    const src = petImageMap[`${appearanceId}${suffix}`];
    if (src) return src;
  }

  return petImageMap[appearanceId] || '';
};

const getMemberPetImage = (member) => {
  const pet = getMemberPet(member);
  const appearanceId = pet.appearanceId || member?.appearanceId || '';
  return petImageMap[`${appearanceId}_idle`] || petImageMap[appearanceId] || '';
};

const buildActiveDuelPatch = (activeA, activeB, previous = {}) => ({
  ...previous,
  teamAPlayerId: activeA?.playerId || previous.teamAPlayerId || null,
  teamBPlayerId: activeB?.playerId || previous.teamBPlayerId || null,
  teamAPetId: getMemberPet(activeA)?.id || previous.teamAPetId || null,
  teamBPetId: getMemberPet(activeB)?.id || previous.teamBPetId || null,
  teamAIndex: Number(previous.teamAIndex ?? 0),
  teamBIndex: Number(previous.teamBIndex ?? 0),
});

const applyActiveHpDelta = (members, activePlayerId, deltaHp) => (
  (Array.isArray(members) ? members : []).map(member => {
    if (member?.playerId !== activePlayerId) return member;

    const pet = getMemberPet(member);
    const maxHp = Number(pet.maxHp ?? pet.hp ?? 1);
    const currentHp = Number(pet.hp ?? maxHp);
    const nextHp = Math.max(0, currentHp + deltaHp);

    return {
      ...member,
      pet: {
        ...pet,
        hp: nextHp,
        maxHp,
        status: { ...(pet.status || {}) },
      },
    };
  })
);

function RandomTeamBattlePage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { players } = useLeagueStore();
  const { classId } = useClassStore();
  const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

  const [room, setRoom] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionSubMenu, setActionSubMenu] = useState(null);
  const [quizPool, setQuizPool] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!classId || !matchId) return;

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
    const unsubscribe = onSnapshot(roomRef, (snap) => {
      setRoom(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return () => unsubscribe();
  }, [classId, matchId]);

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
      }

      const battleFriendlyQuestions = allQuestions.filter(isBattleFriendlyQuestion);

      setQuizPool(
        battleFriendlyQuestions.length > 0
          ? battleFriendlyQuestions
          : [{
              question: '배틀용 문제(OX/객관식)가 없습니다. 선생님에게 알려주세요.',
              answer: 'O',
              type: 'ox',
            }]
      );
    };

    loadQuizzes().catch(error => {
      console.error('Team battle quiz load failed:', error);
      setQuizPool([{
        question: '배틀용 문제를 불러오지 못했습니다.',
        answer: 'O',
        type: 'ox',
      }]);
    });
  }, [classId]);

  const readyPlayerIds = Array.isArray(room?.readyPlayerIds) ? room.readyPlayerIds : [];
  const neededCount = Number(room?.neededCount || 4);
  const readyCount = Number(room?.readyCount || readyPlayerIds.length || 0);
  const isReady = Boolean(myPlayerData?.id && readyPlayerIds.includes(myPlayerData.id));
  const allReady = ['starting', 'quiz', 'action', 'switching', 'pending_switch', 'finished'].includes(room?.status) || readyCount >= neededCount;

  const teamA = Array.isArray(room?.teamA) ? room.teamA : [];
  const teamB = Array.isArray(room?.teamB) ? room.teamB : [];
  const activeDuel = room?.activeDuel || {};
  const activeA = getActiveMember(teamA, activeDuel.teamAPlayerId || room?.activeAPlayerId, activeDuel.teamAPetId || room?.activeAPetId, activeDuel.teamAIndex ?? room?.activeAIndex);
  const activeB = getActiveMember(teamB, activeDuel.teamBPlayerId || room?.activeBPlayerId, activeDuel.teamBPetId || room?.activeBPetId, activeDuel.teamBIndex ?? room?.activeBIndex);

  const myTeamRole = teamA.some(member => member?.playerId === myPlayerData?.id)
    ? 'A'
    : teamB.some(member => member?.playerId === myPlayerData?.id)
      ? 'B'
      : null;

  const myInfo = buildDuelParticipant(myTeamRole === 'B' ? activeB : activeA, myTeamRole === 'B' ? teamB : teamA);
  const opponentInfo = buildDuelParticipant(myTeamRole === 'B' ? activeA : activeB, myTeamRole === 'B' ? teamA : teamB);
  const controllerPlayerId = teamA[0]?.playerId || activeA?.playerId || null;
  const activeIds = [activeA?.playerId, activeB?.playerId].filter(Boolean);
  const canAnswerQuiz = room?.status === 'quiz' && activeIds.includes(myPlayerData?.id) && !room?.chat?.[myPlayerData?.id];
  const hasSubmitted = Boolean(room?.chat?.[myPlayerData?.id]);

  const currentQuestion = room?.question || room?.currentQuestion || null;
  const qType = currentQuestion?.type ? String(currentQuestion.type).toLowerCase() : '';
  const qAns = normalizeAnswer(currentQuestion?.answer || '');
  const hasOptions = Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0;
  const isOXAnswer = (qAns === 'O' || qAns === 'X') && !hasOptions;
  const isOXOptions = shuffledOptions.length === 2 && shuffledOptions.every(o => normalizeAnswer(o) === 'O' || normalizeAnswer(o) === 'X');
  const isOX = qType === 'ox' || isOXAnswer || isOXOptions;

  const getNextQuizObj = (usedQuestions = []) => {
    const used = Array.isArray(usedQuestions) ? usedQuestions : [];
    const available = quizPool.filter(q => !used.includes(q.question));
    const pool = available.length > 0 ? available : quizPool;

    if (!pool.length) {
      return { question: '배틀용 문제(OX/객관식)가 없습니다. 선생님에게 알려주세요.', answer: 'O', type: 'ox' };
    }

    return pool[Math.floor(Math.random() * pool.length)];
  };

  useEffect(() => {
    const opts = currentQuestion?.options;
    if (!opts || opts.length === 0) {
      setShuffledOptions([]);
      return;
    }

    const isOXOpt = opts.length === 2 && opts.every(o => ['O', 'X', '○', '×'].includes(String(o).trim().toUpperCase()));
    if (isOXOpt) setShuffledOptions(['O', 'X']);
    else setShuffledOptions([...opts].sort(() => Math.random() - 0.5));
  }, [currentQuestion?.question]);

  const startNextQuizTransaction = (transaction, roomRef, freshRoom, log) => {
    const freshTeamA = Array.isArray(freshRoom.teamA) ? freshRoom.teamA : [];
    const freshTeamB = Array.isArray(freshRoom.teamB) ? freshRoom.teamB : [];
    const freshActiveDuel = freshRoom.activeDuel || {};
    const freshActiveA = getActiveMember(freshTeamA, freshActiveDuel.teamAPlayerId, freshActiveDuel.teamAPetId, freshActiveDuel.teamAIndex);
    const freshActiveB = getActiveMember(freshTeamB, freshActiveDuel.teamBPlayerId, freshActiveDuel.teamBPetId, freshActiveDuel.teamBIndex);
    if (!freshActiveA?.playerId || !freshActiveB?.playerId) return;

    const nextQuiz = getNextQuizObj(freshRoom.usedQuestions || []);
    const nextUsedQuestions = [...new Set([...(freshRoom.usedQuestions || []), nextQuiz.question].filter(Boolean))];

    transaction.set(roomRef, {
      status: 'quiz',
      activeDuel: buildActiveDuelPatch(freshActiveA, freshActiveB, freshActiveDuel),
      question: nextQuiz,
      usedQuestions: nextUsedQuestions,
      turnStartTime: Date.now(),
      attackerPlayerId: null,
      defenderPlayerId: null,
      attackerAction: null,
      defenderAction: null,
      chat: {},
      log,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  useEffect(() => {
    if (!classId || !matchId || !room || room.status !== 'starting') return;
    if (!controllerPlayerId || controllerPlayerId !== myPlayerData?.id) return;
    if (!teamA.length || !teamB.length || !quizPool.length) return;

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
    runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const freshRoom = { id: snap.id, ...snap.data() };
      if (freshRoom.status !== 'starting') return;
      startNextQuizTransaction(transaction, roomRef, freshRoom, '팀대전 시작! 15초 안에 먼저 정답을 맞히면 공격권을 얻습니다.');
    }).catch(error => console.error('Team battle quiz start failed:', error));
  }, [classId, matchId, room?.status, controllerPlayerId, myPlayerData?.id, teamA.length, teamB.length, quizPool.length]);

  const applyBothMissPenaltyAndNextQuiz = (transaction, roomRef, freshRoom, reasonLog) => {
    const freshTeamA = Array.isArray(freshRoom.teamA) ? freshRoom.teamA : [];
    const freshTeamB = Array.isArray(freshRoom.teamB) ? freshRoom.teamB : [];
    const freshActiveDuel = freshRoom.activeDuel || {};
    const freshActiveA = getActiveMember(freshTeamA, freshActiveDuel.teamAPlayerId, freshActiveDuel.teamAPetId, freshActiveDuel.teamAIndex);
    const freshActiveB = getActiveMember(freshTeamB, freshActiveDuel.teamBPlayerId, freshActiveDuel.teamBPetId, freshActiveDuel.teamBIndex);
    if (!freshActiveA?.playerId || !freshActiveB?.playerId) return;

    const petA = getMemberPet(freshActiveA);
    const petB = getMemberPet(freshActiveB);
    const damageA = Math.max(1, Math.floor(Number(petA.maxHp ?? petA.hp ?? 1) * 0.05));
    const damageB = Math.max(1, Math.floor(Number(petB.maxHp ?? petB.hp ?? 1) * 0.05));
    const nextTeamA = applyActiveHpDelta(freshTeamA, freshActiveA.playerId, -damageA);
    const nextTeamB = applyActiveHpDelta(freshTeamB, freshActiveB.playerId, -damageB);
    const nextQuiz = getNextQuizObj(freshRoom.usedQuestions || []);
    const nextUsedQuestions = [...new Set([...(freshRoom.usedQuestions || []), nextQuiz.question].filter(Boolean))];

    transaction.set(roomRef, {
      teamA: nextTeamA,
      teamB: nextTeamB,
      status: 'quiz',
      question: nextQuiz,
      usedQuestions: nextUsedQuestions,
      turnStartTime: Date.now(),
      attackerPlayerId: null,
      defenderPlayerId: null,
      attackerAction: null,
      defenderAction: null,
      chat: {},
      log: `${reasonLog} 양쪽 active 펫이 최대 체력의 5% 피해를 입었습니다.`,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const handleTeamQuizAnswer = async (selectedAnswer) => {
    if (!classId || !matchId || !myPlayerData?.id || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(roomRef);
        if (!snap.exists()) throw new Error('Team battle room not found.');
        const freshRoom = { id: snap.id, ...snap.data() };
        if (freshRoom.status !== 'quiz' || !freshRoom.question) return;

        const freshTeamA = Array.isArray(freshRoom.teamA) ? freshRoom.teamA : [];
        const freshTeamB = Array.isArray(freshRoom.teamB) ? freshRoom.teamB : [];
        const freshActiveDuel = freshRoom.activeDuel || {};
        const freshActiveA = getActiveMember(freshTeamA, freshActiveDuel.teamAPlayerId, freshActiveDuel.teamAPetId, freshActiveDuel.teamAIndex);
        const freshActiveB = getActiveMember(freshTeamB, freshActiveDuel.teamBPlayerId, freshActiveDuel.teamBPetId, freshActiveDuel.teamBIndex);
        const freshActiveIds = [freshActiveA?.playerId, freshActiveB?.playerId].filter(Boolean);
        if (!freshActiveIds.includes(myPlayerData.id)) return;

        const currentChat = freshRoom.chat || {};
        if (currentChat[myPlayerData.id]) return;

        const nowMs = Date.now();
        const elapsed = nowMs - Number(freshRoom.turnStartTime || nowMs);
        if (elapsed > QUIZ_LIMIT_MS + 800) return;

        const selectedText = String(selectedAnswer ?? '').trim();
        const isCorrect = isCorrectAnswer(freshRoom.question, selectedText);
        const nextChat = {
          ...currentChat,
          [myPlayerData.id]: { text: selectedText, isCorrect, answeredAtMs: nowMs },
        };

        if (isCorrect) {
          const attackerPlayerId = myPlayerData.id;
          const defenderPlayerId = freshActiveIds.find(id => id !== attackerPlayerId) || null;
          const attackerName = attackerPlayerId === freshActiveA?.playerId ? freshActiveA?.playerName || 'A Team player' : freshActiveB?.playerName || 'B Team player';
          transaction.set(roomRef, {
            status: 'action',
            chat: nextChat,
            attackerPlayerId,
            defenderPlayerId,
            turn: attackerPlayerId,
            attackerAction: null,
            defenderAction: null,
            turnStartTime: Date.now(),
            log: `${attackerName} answered first. Choose attack/defense within 10 seconds.`,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          return;
        }

        const bothAnswered = freshActiveIds.every(id => nextChat[id]);
        const bothWrong = bothAnswered && freshActiveIds.every(id => !nextChat[id]?.isCorrect);
        if (bothWrong) {
          applyBothMissPenaltyAndNextQuiz(transaction, roomRef, { ...freshRoom, chat: nextChat }, 'Both active players were wrong.');
          return;
        }

        transaction.set(roomRef, { chat: nextChat, log: 'Wrong answer. Waiting for the other active player or timeout.', updatedAt: serverTimestamp() }, { merge: true });
      });
    } catch (error) {
      console.error('Team battle quiz answer failed:', error);
      alert('Team battle quiz answer failed: ' + error.message);
    } finally {
      setIsProcessing(false);
      setAnswer('');
    }
  };

  const handleTeamQuizTimeout = async () => {
    if (!classId || !matchId || !myPlayerData?.id) return;
    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
    runTransaction(db, async (transaction) => {
      const snap = await transaction.get(roomRef);
      if (!snap.exists()) return;
      const freshRoom = { id: snap.id, ...snap.data() };
      if (freshRoom.status !== 'quiz') return;
      const elapsed = Date.now() - Number(freshRoom.turnStartTime || Date.now());
      if (elapsed <= QUIZ_LIMIT_MS + 700) return;
      applyBothMissPenaltyAndNextQuiz(transaction, roomRef, freshRoom, 'Time out.');
    }).catch(error => console.error('Team battle quiz timeout failed:', error));
  };

  useEffect(() => {
    clearInterval(timerRef.current);
    if (room?.status !== 'quiz') {
      setTimeLeft(0);
      return () => clearInterval(timerRef.current);
    }
    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - Number(room.turnStartTime || now);
      const remaining = Math.max(0, Math.ceil((QUIZ_LIMIT_MS - elapsed) / 1000));
      setTimeLeft(remaining);
      if (elapsed > QUIZ_LIMIT_MS + 800) {
        clearInterval(timerRef.current);
        handleTeamQuizTimeout();
      }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 250);
    return () => clearInterval(timerRef.current);
  }, [room?.status, room?.turnStartTime, controllerPlayerId, myPlayerData?.id, classId, matchId]);

  const handleQuizSubmit = (event) => {
    event.preventDefault();
    if (!answer.trim()) return;
    handleTeamQuizAnswer(answer);
  };

  const handleTeamActionPlaceholder = () => alert('Attack/defense resolution will be connected in the next step.');

  const previewBattleState = {
    id: room?.id || matchId,
    battleMode: 'random-team',
    teamBattle: true,
    status: room?.status === 'quiz' || room?.status === 'action' ? room.status : 'team_preview',
    battleTheme: room?.battleTheme || 'forest',
    question: currentQuestion,
    chat: room?.chat || {},
    log: room?.log || 'Team battle ready. The existing duel view is connected.',
    turnStartTime: room?.turnStartTime || null,
  };

  const wasCancelledByOther = Boolean(room?.status === 'cancelled' && room?.cancelReason === 'team_member_forfeited' && room?.cancelledBy && room.cancelledBy !== myPlayerData?.id);

  useEffect(() => {
    if (!wasCancelledByOther) return;
    const timer = window.setTimeout(() => navigate('/pet', { replace: true }), 2500);
    return () => window.clearTimeout(timer);
  }, [wasCancelledByOther, navigate]);

  const handleReady = async () => {
    if (!classId || !myPlayerData?.id) return;
    try {
      setIsProcessing(true);
      const result = await enterRandomTeamBattle(classId, myPlayerData.id);
      if (result?.matchId && result.matchId !== matchId) navigate('/battle/team/' + encodeURIComponent(result.matchId), { replace: true });
    } catch (error) {
      alert('Team battle enter failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderBlindMember = (member) => {
    const isMemberReady = readyPlayerIds.includes(member.playerId);
    return (
      <Member key={'blind-' + member.playerId}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: isMemberReady ? '#2f9e44' : '#ced4da', boxShadow: isMemberReady ? '0 0 0 4px #ebfbee' : 'none', flex: '0 0 auto' }} />
        <div><strong>{member.playerName || 'Player'}</strong><span>{isMemberReady ? 'Ready' : 'Waiting'}</span></div>
      </Member>
    );
  };

  const renderMember = (member) => {
    const pet = getMemberPet(member);
    const imageSrc = getMemberPetImage(member);
    const isActive = member?.playerId === activeA?.playerId || member?.playerId === activeB?.playerId;
    return (
      <Member key={member.playerId} style={{ background: isActive ? '#fff9db' : 'white' }}>
        <img src={imageSrc} alt={member.petName || pet.name || 'pet'} />
        <div><strong>{isActive ? 'ACTIVE ' : ''}{member.playerName || 'Player'}</strong><span>{member.petName || pet.name || 'pet'} · Lv.{member.petLevel || pet.level || 1}</span></div>
      </Member>
    );
  };

  if (room && allReady && !wasCancelledByOther && myInfo && opponentInfo) {
    const isAttacker = room?.attackerPlayerId === myPlayerData?.id || room?.turn === myPlayerData?.id;
    const isDefender = room?.defenderPlayerId === myPlayerData?.id;
    const showActionMenu = room?.status === 'action' && isAttacker && !room?.attackerAction;
    const showDefenseMenu = room?.status === 'action' && isDefender && !room?.defenderAction;

    return (
      <Page style={{ maxWidth: '1180px' }}>
        <BattleDuelView
          battleState={previewBattleState}
          myPlayerData={myPlayerData}
          bgmEnabled={false}
          handleToggleBattleFullscreen={noop}
          handleToggleBgm={noop}
          showTimer={room?.status === 'quiz' || room?.status === 'action'}
          timeLeft={timeLeft}
          switchMessage=""
          floatingNumbers={[]}
          reactionFlash={null}
          currentEffect={null}
          opponentInfo={opponentInfo}
          myInfo={myInfo}
          renderHpBar={renderHpBar}
          renderSpBar={renderSpBar}
          getPetImageSrc={getPetImageSrc}
          hitState={{ my: false, opponent: false }}
          animState={{ my: null, opponent: null }}
          ultimateSecretHide={{ my: false, opponent: false }}
          introActive={false}
          switchIntro={{ my: false, opponent: false }}
          dotEffect={null}
          formatBattleLogForDisplay={formatBattleLogForDisplay}
          pendingSwitchForMe={false}
          pendingSwitchPets={[]}
          handleFaintedPetSwitch={noop}
          isProcessing={isProcessing}
          canAnswerQuiz={canAnswerQuiz}
          isQuizBlockedByCc={false}
          isFrozen={false}
          isStaggered={false}
          hasSubmitted={hasSubmitted}
          isOX={isOX}
          hasOptions={hasOptions}
          shuffledOptions={shuffledOptions}
          handleOptionClick={handleTeamQuizAnswer}
          handleQuizSubmit={handleQuizSubmit}
          answer={answer}
          setAnswer={setAnswer}
          isStunned={false}
          isBound={false}
          showActionMenu={showActionMenu}
          showDefenseMenu={showDefenseMenu}
          actionSubMenu={actionSubMenu}
          setActionSubMenu={setActionSubMenu}
          myEquippedSkills={[]}
          usableItems={[]}
          getSkillCost={() => 0}
          handleActionSelect={handleTeamActionPlaceholder}
          handleUseItem={handleTeamActionPlaceholder}
          switchablePets={[]}
          handleManualSwitch={handleTeamActionPlaceholder}
          availableDefenseActions={{ BRACE: '방어', DODGE: '회피' }}
          components={battleDuelLayoutComponents}
        />

        <TeamGrid style={{ marginTop: '1rem' }}>
          <TeamBox $side="A"><h3>A Team</h3>{teamA.map(renderMember)}</TeamBox>
          <TeamBox $side="B"><h3>B Team</h3>{teamB.map(renderMember)}</TeamBox>
        </TeamGrid>
        <ButtonRow><Button type="button" $muted onClick={() => navigate('/pet')}>Pet Page</Button></ButtonRow>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <Header><div><h2>2v2 Team Battle Beta</h2><p>Teams are revealed after all 4 players enter.</p></div><ReadyBadge $ready={allReady}>{readyCount}/{neededCount} Ready</ReadyBadge></Header>
        {!room ? <LogBox>Loading team battle room...</LogBox> : (
          <>
            {wasCancelledByOther ? <LogBox style={{ background: '#fff5f5', color: '#c92a2a' }}>A player forfeited. Returning to queue.</LogBox> : (
              <>
                {!allReady ? (
                  <><LogBox>Team battle matched. Team and pet info will be revealed after all 4 players enter.</LogBox><TeamBox $side="A" style={{ marginTop: '1rem' }}><h3>Entry Check</h3>{[...(room.teamA || []), ...(room.teamB || [])].map(renderBlindMember)}</TeamBox></>
                ) : (
                  <><TeamGrid><TeamBox $side="A"><h3>A Team</h3>{(room.teamA || []).map(renderMember)}</TeamBox><TeamBox $side="B"><h3>B Team</h3>{(room.teamB || []).map(renderMember)}</TeamBox></TeamGrid><LogBox>Team battle ready. The shared duel view will be connected.</LogBox></>
                )}
              </>
            )}
            <ButtonRow><Button type="button" onClick={handleReady} disabled={isProcessing || isReady || allReady}>{isReady ? 'Ready' : isProcessing ? 'Processing...' : 'Enter'}</Button><Button type="button" $muted onClick={() => navigate('/pet')}>Pet Page</Button></ButtonRow>
          </>
        )}
      </Card>
    </Page>
  );
}

export default RandomTeamBattlePage;
