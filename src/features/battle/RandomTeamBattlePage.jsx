// src/features/battle/RandomTeamBattlePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import { petImageMap } from '../../utils/petImageMap';
import { BattleHpBar, BattleSpBar } from './BattleStatBars';
import { enterRandomTeamBattle } from './randomBattleApi';
import BattleDuelView from './BattleDuelView';
import { battleDuelLayoutComponents } from './BattleDuelLayoutComponents';

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

const getFirstAliveMember = (members) => {
  if (!Array.isArray(members) || members.length === 0) return null;

  return members.find((member) => {
    const pet = getMemberPet(member);
    return Number(pet.hp ?? pet.maxHp ?? 1) > 0;
  }) || members[0];
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
  const allReady = room?.status === 'starting' || readyCount >= neededCount;

  const teamA = Array.isArray(room?.teamA) ? room.teamA : [];
  const teamB = Array.isArray(room?.teamB) ? room.teamB : [];
  const activeA = getFirstAliveMember(teamA);
  const activeB = getFirstAliveMember(teamB);

  const myTeamRole = teamA.some(member => member?.playerId === myPlayerData?.id)
    ? 'A'
    : teamB.some(member => member?.playerId === myPlayerData?.id)
      ? 'B'
      : null;

  const myInfo = buildDuelParticipant(myTeamRole === 'B' ? activeB : activeA, myTeamRole === 'B' ? teamB : teamA);
  const opponentInfo = buildDuelParticipant(myTeamRole === 'B' ? activeA : activeB, myTeamRole === 'B' ? teamA : teamB);

  const previewBattleState = {
    id: room?.id || matchId,
    battleMode: 'random-team',
    teamBattle: true,
    status: 'team_preview',
    battleTheme: room?.battleTheme || 'forest',
    question: null,
    chat: {},
    log: room?.log || 'Team battle ready. The existing duel view is connected.',
  };

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
      alert('Team battle enter failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

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
          <strong>{member.playerName || 'Player'}</strong>
          <span>{isMemberReady ? 'Ready' : 'Waiting'}</span>
        </div>
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
        <div>
          <strong>{isActive ? 'ACTIVE ' : ''}{member.playerName || 'Player'}</strong>
          <span>{member.petName || pet.name || 'pet'} · Lv.{member.petLevel || pet.level || 1}</span>
        </div>
      </Member>
    );
  };

  if (room && allReady && !wasCancelledByOther && myInfo && opponentInfo) {
    return (
      <Page style={{ maxWidth: '1180px' }}>
        <BattleDuelView
          battleState={previewBattleState}
          myPlayerData={myPlayerData}
          bgmEnabled={false}
          handleToggleBattleFullscreen={noop}
          handleToggleBgm={noop}
          showTimer={false}
          timeLeft={0}
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
          isQuizBlockedByCc={false}
          isFrozen={false}
          isStaggered={false}
          hasSubmitted={false}
          isOX={false}
          hasOptions={false}
          shuffledOptions={[]}
          handleOptionClick={noop}
          handleQuizSubmit={(event) => event.preventDefault()}
          answer={answer}
          setAnswer={setAnswer}
          isStunned={false}
          isBound={false}
          showActionMenu={false}
          showDefenseMenu={false}
          actionSubMenu={actionSubMenu}
          setActionSubMenu={setActionSubMenu}
          myEquippedSkills={[]}
          usableItems={[]}
          getSkillCost={() => 0}
          handleActionSelect={noop}
          handleUseItem={noop}
          switchablePets={[]}
          handleManualSwitch={noop}
          availableDefenseActions={{}}
          components={battleDuelLayoutComponents}
        />

        <TeamGrid style={{ marginTop: '1rem' }}>
          <TeamBox $side="A">
            <h3>A Team</h3>
            {teamA.map(renderMember)}
          </TeamBox>

          <TeamBox $side="B">
            <h3>B Team</h3>
            {teamB.map(renderMember)}
          </TeamBox>
        </TeamGrid>

        <ButtonRow>
          <Button type="button" $muted onClick={() => navigate('/pet')}>
            Pet Page
          </Button>
        </ButtonRow>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <Header>
          <div>
            <h2>2v2 Team Battle Beta</h2>
            <p>Teams are revealed after all 4 players enter.</p>
          </div>
          <ReadyBadge $ready={allReady}>
            {readyCount}/{neededCount} Ready
          </ReadyBadge>
        </Header>

        {!room ? (
          <LogBox>Loading team battle room...</LogBox>
        ) : (
          <>
            {wasCancelledByOther ? (
              <LogBox style={{ background: '#fff5f5', color: '#c92a2a' }}>
                A player forfeited. Returning to queue.
              </LogBox>
            ) : (
              <>
                {!allReady ? (
                  <>
                    <LogBox>
                      Team battle matched. Team and pet info will be revealed after all 4 players enter.
                    </LogBox>

                    <TeamBox $side="A" style={{ marginTop: '1rem' }}>
                      <h3>Entry Check</h3>
                      {[...(room.teamA || []), ...(room.teamB || [])].map(renderBlindMember)}
                    </TeamBox>
                  </>
                ) : (
                  <>
                    <TeamGrid>
                      <TeamBox $side="A">
                        <h3>A Team</h3>
                        {(room.teamA || []).map(renderMember)}
                      </TeamBox>

                      <TeamBox $side="B">
                        <h3>B Team</h3>
                        {(room.teamB || []).map(renderMember)}
                      </TeamBox>
                    </TeamGrid>

                    <LogBox>
                      Team battle ready. The shared duel view will be connected.
                    </LogBox>
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
                {isReady ? 'Ready' : isProcessing ? 'Processing...' : 'Enter'}
              </Button>
              <Button type="button" $muted onClick={() => navigate('/pet')}>
                Pet Page
              </Button>
            </ButtonRow>
          </>
        )}
      </Card>
    </Page>
  );
}

export default RandomTeamBattlePage;
