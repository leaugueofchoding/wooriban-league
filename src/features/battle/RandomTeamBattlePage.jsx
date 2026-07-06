// src/features/battle/RandomTeamBattlePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import { petImageMap } from '../../utils/petImageMap';
import { enterRandomTeamBattle } from './randomBattleApi';
import BattleDuelView from './BattleDuelView';

const TEAM_BATTLE_FALLBACK_QUESTION = Object.freeze({
  id: 'team-battle-ready-ox',
  question: '팀대전 시작! 준비가 되었으면 O를 고르세요.',
  answer: 'O',
  type: 'ox',
  options: ['O', 'X'],
});

const Page = styled.div`
  max-width: 1180px;
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

const DuelSection = styled.div`
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
`;

const TeamSummary = styled.div`
  margin-top: 1rem;
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

const normalizeAnswer = (value) => String(value ?? '').trim().toLowerCase();

const isCorrectAnswer = (question, value) => {
  const expected = question?.answer ?? question?.correctAnswer;
  return normalizeAnswer(value) === normalizeAnswer(expected);
};

const getMemberPet = (member) => member?.pet || member?.lockedPet || member?.lockedTeam?.[0] || {};

const getMemberPetImage = (member, suffix = 'idle') => {
  const pet = getMemberPet(member);
  const appearanceId = pet.appearanceId || member?.appearanceId || '';
  return petImageMap[`${appearanceId}_${suffix}`] || petImageMap[`${appearanceId}_idle`] || petImageMap[appearanceId] || '';
};

const getActiveMember = (members, activePlayerId, activePetId, activeIndex) => {
  if (!Array.isArray(members) || members.length === 0) return null;

  const byPlayerId = activePlayerId
    ? members.find(member => member?.playerId === activePlayerId)
    : null;
  if (byPlayerId) return byPlayerId;

  const byPetId = activePetId
    ? members.find(member => getMemberPet(member)?.id === activePetId)
    : null;
  if (byPetId) return byPetId;

  const index = Number(activeIndex ?? 0);
  const safeIndex = Number.isInteger(index)
    ? Math.min(Math.max(index, 0), members.length - 1)
    : 0;

  return members[safeIndex] || members[0];
};

const getActiveDuelMembers = (roomData = {}) => {
  const teamA = Array.isArray(roomData.teamA) ? roomData.teamA : [];
  const teamB = Array.isArray(roomData.teamB) ? roomData.teamB : [];
  const activeDuel = roomData.activeDuel || {};

  const activeA = getActiveMember(
    teamA,
    activeDuel.teamAPlayerId || activeDuel.aPlayerId || roomData.activeAPlayerId,
    activeDuel.teamAPetId || activeDuel.aPetId || roomData.activeAPetId,
    activeDuel.teamAIndex ?? activeDuel.aIndex ?? roomData.activeAIndex
  );

  const activeB = getActiveMember(
    teamB,
    activeDuel.teamBPlayerId || activeDuel.bPlayerId || roomData.activeBPlayerId,
    activeDuel.teamBPetId || activeDuel.bPetId || roomData.activeBPetId,
    activeDuel.teamBIndex ?? activeDuel.bIndex ?? roomData.activeBIndex
  );

  return { activeA, activeB };
};

const buildActiveDuelPatch = (activeA, activeB, previousActiveDuel = {}) => ({
  ...previousActiveDuel,
  teamAPlayerId: activeA?.playerId || previousActiveDuel.teamAPlayerId || null,
  teamBPlayerId: activeB?.playerId || previousActiveDuel.teamBPlayerId || null,
  teamAPetId: getMemberPet(activeA)?.id || previousActiveDuel.teamAPetId || null,
  teamBPetId: getMemberPet(activeB)?.id || previousActiveDuel.teamBPetId || null,
  teamAIndex: Number(previousActiveDuel.teamAIndex ?? 0),
  teamBIndex: Number(previousActiveDuel.teamBIndex ?? 0),
});

const buildDuelParticipant = (activeMember, teamMembers = []) => {
  if (!activeMember) return null;

  const team = teamMembers
    .map((member) => {
      const pet = getMemberPet(member);
      if (!pet?.id && !pet?.appearanceId) return null;
      return {
        ...pet,
        id: pet.id || member.playerId,
        name: member.petName || pet.name || '펫',
        level: member.petLevel || pet.level || 1,
        hp: Number(pet.hp ?? pet.maxHp ?? 1),
        maxHp: Number(pet.maxHp ?? pet.hp ?? 1),
        sp: Number(pet.sp ?? 0),
        maxSp: Number(pet.maxSp ?? 0),
        status: { ...(pet.status || {}) },
      };
    })
    .filter(Boolean);

  const activePet = {
    ...getMemberPet(activeMember),
    id: getMemberPet(activeMember).id || activeMember.playerId,
    name: activeMember.petName || getMemberPet(activeMember).name || '펫',
    level: activeMember.petLevel || getMemberPet(activeMember).level || 1,
    hp: Number(getMemberPet(activeMember).hp ?? getMemberPet(activeMember).maxHp ?? 1),
    maxHp: Number(getMemberPet(activeMember).maxHp ?? getMemberPet(activeMember).hp ?? 1),
    sp: Number(getMemberPet(activeMember).sp ?? 0),
    maxSp: Number(getMemberPet(activeMember).maxSp ?? 0),
    status: { ...(getMemberPet(activeMember).status || {}) },
  };

  const activeIndex = Math.max(0, team.findIndex(pet => pet.id === activePet.id));
  const syncedTeam = team.length > 0
    ? team.map((pet, index) => index === activeIndex ? activePet : pet)
    : [activePet];

  return {
    id: activeMember.playerId,
    name: activeMember.playerName || '플레이어',
    pet: activePet,
    team: syncedTeam,
    activePetIndex: activeIndex >= 0 ? activeIndex : 0,
    activePetId: activePet.id,
    participatedPetIds: [activePet.id].filter(Boolean),
    avatarSnapshotUrl: activeMember.avatarSnapshotUrl || null,
    photoURL: activeMember.photoURL || null,
  };
};

const getViewerRole = ({ room, myPlayerId, activeA, activeB }) => {
  const explicitRole = room?.viewerRoles?.[myPlayerId] || room?.viewerRoleMap?.[myPlayerId];
  if (explicitRole) return explicitRole;

  if (!myPlayerId) return 'spectator';

  if (room?.status === 'quiz' && [activeA?.playerId, activeB?.playerId].includes(myPlayerId)) {
    return 'quiz-responder';
  }

  if (room?.status === 'action' && room?.attackerPlayerId === myPlayerId) return 'attacker';
  if (room?.status === 'action' && room?.defenderPlayerId === myPlayerId) return 'defender';

  return 'spectator';
};

function RandomTeamBattlePage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { players } = useLeagueStore();
  const { classId } = useClassStore();
  const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

  const [room, setRoom] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSubMenu, setActionSubMenu] = useState(null);
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    if (!classId || !matchId) return;

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);
    const unsubscribe = onSnapshot(roomRef, (snap) => {
      setRoom(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return () => unsubscribe();
  }, [classId, matchId]);

  const readyPlayerIds = Array.isArray(room?.readyPlayerIds) ? room.readyPlayerIds : [];
  const neededCount = Number(room?.neededCount || 4);
  const readyCount = Number(room?.readyCount || readyPlayerIds.length || 0);
  const isReady = Boolean(myPlayerData?.id && readyPlayerIds.includes(myPlayerData.id));
  const allReady = ['starting', 'quiz', 'action', 'switching', 'pending_switch', 'finished'].includes(room?.status) || readyCount >= neededCount;

  const teamA = Array.isArray(room?.teamA) ? room.teamA : [];
  const teamB = Array.isArray(room?.teamB) ? room.teamB : [];
  const { activeA, activeB } = getActiveDuelMembers(room || {});

  const myTeamRole = teamA.some(member => member?.playerId === myPlayerData?.id)
    ? 'A'
    : teamB.some(member => member?.playerId === myPlayerData?.id)
      ? 'B'
      : null;

  const myInfo = buildDuelParticipant(myTeamRole === 'B' ? activeB : activeA, myTeamRole === 'B' ? teamB : teamA);
  const opponentInfo = buildDuelParticipant(myTeamRole === 'B' ? activeA : activeB, myTeamRole === 'B' ? teamA : teamB);
  const viewerRole = getViewerRole({ room, myPlayerId: myPlayerData?.id, activeA, activeB });
  const currentQuestion = room?.question || room?.currentQuestion || null;
  const canAnswerQuiz = viewerRole === 'quiz-responder' && !room?.chat?.[myPlayerData?.id];
  const showActionMenu = viewerRole === 'attacker' && room?.status === 'action' && !room?.attackerAction;
  const showDefenseMenu = viewerRole === 'defender' && room?.status === 'action' && !room?.defenderAction;

  const duelBattleState = {
    status: room?.status === 'action'
      ? 'action'
      : currentQuestion
        ? 'quiz'
        : room?.status || 'starting',
    question: currentQuestion,
    chat: room?.chat || {},
    log: room?.log || '👥 2:2 팀대전 준비 완료! 현재 출전 펫을 확인하세요.',
    battleTheme: room?.battleTheme || 'forest',
    turnStartTime: room?.turnStartTime || room?.questionStartedAtMs || null,
  };

  useEffect(() => {
    if (!classId || !matchId || !room || room.status !== 'starting') return;
    if (!teamA.length || !teamB.length) return;

    const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);

    runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) return;

      const freshRoom = { id: roomSnap.id, ...roomSnap.data() };
      if (freshRoom.status !== 'starting') return;

      const { activeA: freshActiveA, activeB: freshActiveB } = getActiveDuelMembers(freshRoom);
      if (!freshActiveA?.playerId || !freshActiveB?.playerId) return;

      const activeDuelPatch = buildActiveDuelPatch(freshActiveA, freshActiveB, freshRoom.activeDuel || {});

      transaction.set(roomRef, {
        status: 'quiz',
        activeDuel: activeDuelPatch,
        question: {
          ...TEAM_BATTLE_FALLBACK_QUESTION,
          round: Number(freshRoom.questionRound || 0) + 1,
        },
        questionRound: Number(freshRoom.questionRound || 0) + 1,
        chat: {},
        attackerPlayerId: null,
        defenderPlayerId: null,
        attackerAction: null,
        defenderAction: null,
        viewerRoles: {
          [freshActiveA.playerId]: 'quiz-responder',
          [freshActiveB.playerId]: 'quiz-responder',
        },
        log: '❓ 팀대전 퀴즈 턴! 출전 중인 두 학생만 정답을 고를 수 있습니다.',
        questionStartedAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }).catch((error) => {
      console.error('팀대전 퀴즈 시작 실패:', error);
    });
  }, [classId, matchId, room, teamA.length, teamB.length]);

  // RANDOM_TEAM_FORFEIT_PENALTY_PATCH
  const wasCancelledByOther = Boolean(
    room?.status === 'cancelled' &&
    room?.cancelReason === 'team_member_forfeited' &&
    room?.cancelledBy &&
    room.cancelledBy !== myPlayerData?.id
  );

  useEffect(() => {
    if (!wasCancelledByOther) return;

    const timer = window.setTimeout(() => {
      navigate('/pet', { replace: true });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [wasCancelledByOther, navigate]);

  const handleReady = async () => {
    if (!classId || !myPlayerData?.id) return;

    try {
      setIsProcessing(true);
      const result = await enterRandomTeamBattle(classId, myPlayerData.id);
      if (result?.matchId && result.matchId !== matchId) {
        navigate('/battle/team/' + encodeURIComponent(result.matchId), { replace: true });
      }
    } catch (error) {
      alert('팀대전 입장 실패: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTeamQuizAnswer = async (selectedAnswer) => {
    if (!classId || !matchId || !myPlayerData?.id || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'classes', classId, 'randomTeamBattleRooms', matchId);

      await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef);
        if (!roomSnap.exists()) throw new Error('팀대전 방을 찾을 수 없습니다.');

        const freshRoom = { id: roomSnap.id, ...roomSnap.data() };
        const question = freshRoom.question || freshRoom.currentQuestion;
        if (freshRoom.status !== 'quiz' || !question) {
          throw new Error('현재는 퀴즈 응답 시간이 아닙니다.');
        }

        const { activeA: freshActiveA, activeB: freshActiveB } = getActiveDuelMembers(freshRoom);
        const activeIds = [freshActiveA?.playerId, freshActiveB?.playerId].filter(Boolean);
        if (!activeIds.includes(myPlayerData.id)) {
          throw new Error('현재 출전 중인 학생만 정답을 고를 수 있습니다.');
        }

        const currentChat = freshRoom.chat || {};
        if (currentChat[myPlayerData.id]) return;

        const nowMs = Date.now();
        const selectedText = String(selectedAnswer ?? '').trim();
        const nextChat = {
          ...currentChat,
          [myPlayerData.id]: {
            text: selectedText,
            isCorrect: isCorrectAnswer(question, selectedText),
            answeredAtMs: nowMs,
          },
        };

        const allAnswered = activeIds.every((id) => nextChat[id]);
        if (!allAnswered) {
          transaction.set(roomRef, {
            chat: nextChat,
            log: '✍️ 한 명이 답을 골랐습니다. 상대 출전 학생의 선택을 기다립니다.',
            updatedAt: serverTimestamp(),
          }, { merge: true });
          return;
        }

        const correctEntries = activeIds
          .map((id) => ({ id, ...nextChat[id] }))
          .filter((entry) => entry.isCorrect)
          .sort((a, b) => Number(a.answeredAtMs || 0) - Number(b.answeredAtMs || 0));

        if (correctEntries.length === 0) {
          const nextRound = Number(freshRoom.questionRound || 0) + 1;
          transaction.set(roomRef, {
            status: 'quiz',
            question: {
              ...TEAM_BATTLE_FALLBACK_QUESTION,
              round: nextRound,
            },
            questionRound: nextRound,
            chat: {},
            attackerPlayerId: null,
            defenderPlayerId: null,
            attackerAction: null,
            defenderAction: null,
            viewerRoles: {
              [activeIds[0]]: 'quiz-responder',
              [activeIds[1]]: 'quiz-responder',
            },
            log: '😵 두 학생 모두 오답! 같은 출전 펫으로 다시 퀴즈를 풉니다.',
            questionStartedAtMs: Date.now(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
          return;
        }

        const attackerPlayerId = correctEntries[0].id;
        const defenderPlayerId = activeIds.find((id) => id !== attackerPlayerId) || activeIds[0];
        const attackerName = attackerPlayerId === freshActiveA?.playerId
          ? freshActiveA?.playerName || 'A팀 출전 학생'
          : freshActiveB?.playerName || 'B팀 출전 학생';

        transaction.set(roomRef, {
          status: 'action',
          chat: nextChat,
          attackerPlayerId,
          defenderPlayerId,
          attackerAction: null,
          defenderAction: null,
          viewerRoles: {
            [attackerPlayerId]: 'attacker',
            [defenderPlayerId]: 'defender',
          },
          turn: {
            attackerPlayerId,
            defenderPlayerId,
            decidedBy: 'quiz',
            decidedAtMs: nowMs,
          },
          log: `✅ ${attackerName} 정답! 공격 행동을 고를 차례입니다.`,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
    } catch (error) {
      alert('팀대전 퀴즈 처리 실패: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTeamDuelPendingAction = () => {
    alert('팀대전 공격/방어 조작은 다음 단계에서 연결합니다. 현재는 퀴즈 권한과 공격/방어 역할 확인 단계입니다.');
  };

  // RANDOM_TEAM_FORFEIT_PENALTY_PATCH
  const renderBlindMember = (member) => {
    const isMemberReady = readyPlayerIds.includes(member.playerId);

    return (
      <Member key={'blind-' + member.playerId}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: isMemberReady ? '#2f9e44' : '#ced4da',
            boxShadow: isMemberReady ? '0 0 0 4px #ebfbee' : 'none',
            flex: '0 0 auto',
          }}
        />
        <div>
          <strong>{member.playerName || '플레이어'}</strong>
          <span>{isMemberReady ? '입장 완료' : '입장 대기중'}</span>
        </div>
      </Member>
    );
  };

  const renderMember = (member) => {
    const pet = getMemberPet(member);
    const imageSrc = getMemberPetImage(member, 'idle');
    const isActive = member?.playerId === activeA?.playerId || member?.playerId === activeB?.playerId;

    return (
      <Member key={member.playerId} style={{ background: isActive ? '#fff9db' : 'white' }}>
        <img src={imageSrc} alt={member.petName || pet.name || '펫'} />
        <div>
          <strong>{isActive ? '⚔️ ' : ''}{member.playerName || '플레이어'}</strong>
          <span>{member.petName || pet.name || '펫'} · Lv.{member.petLevel || pet.level || 1}</span>
        </div>
      </Member>
    );
  };

  return (
    <Page>
      <Card>
        <Header>
          <div>
            <h2>👥 2:2 팀대전 베타</h2>
            <p>4명이 모두 입장하면 팀대전 준비가 완료됩니다.</p>
          </div>
          <ReadyBadge $ready={allReady}>
            {readyCount}/{neededCount} 입장
          </ReadyBadge>
        </Header>

        {!room ? (
          <LogBox>팀대전 입장방을 불러오는 중...</LogBox>
        ) : (
          <>
            {wasCancelledByOther ? (
              <LogBox style={{ background: '#fff5f5', color: '#c92a2a' }}>
                한 명이 팀대전을 포기해서 다시 매칭 대기열로 돌아갑니다.
              </LogBox>
            ) : (
              <>
                {!allReady ? (
                  <>
                    <LogBox>
                      팀대전 매칭 완료! 4명이 모두 입장하면 팀과 펫 정보가 공개됩니다.
                    </LogBox>

                    <TeamBox $side="A" style={{ marginTop: '1rem' }}>
                      <h3>입장 확인</h3>
                      {[...(room.teamA || []), ...(room.teamB || [])].map(renderBlindMember)}
                    </TeamBox>
                  </>
                ) : (
                  <>
                    {myInfo && opponentInfo ? (
                      <DuelSection>
                        <BattleDuelView
                          battleState={duelBattleState}
                          myPlayerData={myPlayerData}
                          myInfo={myInfo}
                          opponentInfo={opponentInfo}
                          viewerRole={viewerRole}
                          timeLeft={Number(room?.timeLeft ?? 0)}
                          showTimer={Boolean(currentQuestion) && room?.status === 'quiz'}
                          canAnswerQuiz={canAnswerQuiz}
                          hasSubmitted={Boolean(room?.chat?.[myPlayerData?.id])}
                          isOX={String(currentQuestion?.type || '').toLowerCase() === 'ox'}
                          hasOptions={Array.isArray(currentQuestion?.options) && currentQuestion?.options?.length > 0}
                          shuffledOptions={currentQuestion?.options || []}
                          answer={answer}
                          setAnswer={setAnswer}
                          isProcessing={isProcessing}
                          onOptionClick={handleTeamQuizAnswer}
                          onQuizSubmit={(event) => {
                            event.preventDefault();
                            handleTeamQuizAnswer(answer);
                          }}
                          showActionMenu={showActionMenu}
                          showDefenseMenu={showDefenseMenu}
                          actionSubMenu={actionSubMenu}
                          setActionSubMenu={setActionSubMenu}
                          myEquippedSkills={[]}
                          usableItems={[]}
                          onActionSelect={handleTeamDuelPendingAction}
                          onUseItem={handleTeamDuelPendingAction}
                          onManualSwitch={handleTeamDuelPendingAction}
                          defenseActions={{ BRACE: '웅크리기', DODGE: '피하기' }}
                        />
                      </DuelSection>
                    ) : (
                      <LogBox style={{ background: '#fff5f5', color: '#c92a2a' }}>
                        팀대전 출전 정보를 불러오는 중입니다.
                      </LogBox>
                    )}

                    <TeamSummary>
                      <TeamGrid>
                        <TeamBox $side="A">
                          <h3>🔵 A팀</h3>
                          {teamA.map(renderMember)}
                        </TeamBox>

                        <TeamBox $side="B">
                          <h3>🔴 B팀</h3>
                          {teamB.map(renderMember)}
                        </TeamBox>
                      </TeamGrid>
                    </TeamSummary>
                  </>
                )}
              </>
            )}

            <ButtonRow>
              <Button
                type="button"
                onClick={handleReady}
                disabled={isProcessing || isReady || allReady}
              >
                {isReady ? '입장 완료' : isProcessing ? '처리 중...' : '입장 확인'}
              </Button>
              <Button type="button" $muted onClick={() => navigate('/pet')}>
                펫 페이지
              </Button>
            </ButtonRow>
          </>
        )}
      </Card>
    </Page>
  );
}

export default RandomTeamBattlePage;
