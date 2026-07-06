// src/features/battle/RandomTeamBattlePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import { petImageMap } from '../../utils/petImageMap';
import { cancelRandomBattleQueueEntry, enterRandomTeamBattle, forfeitRandomTeamBattleAndRequeue } from './randomBattleApi';

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

function RandomTeamBattlePage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { players } = useLeagueStore();
  const { classId } = useClassStore();
  const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

  const [room, setRoom] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    const pet = member?.pet || {};
    const imageSrc = petImageMap[(pet.appearanceId || '') + '_idle'] || petImageMap[pet.appearanceId] || '';

    return (
      <Member key={member.playerId}>
        <img src={imageSrc} alt={member.petName || pet.name || '펫'} />
        <div>
          <strong>{member.playerName || '플레이어'}</strong>
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
                    <TeamGrid>
                      <TeamBox $side="A">
                        <h3>🔵 A팀</h3>
                        {(room.teamA || []).map(renderMember)}
                      </TeamBox>

                      <TeamBox $side="B">
                        <h3>🔴 B팀</h3>
                        {(room.teamB || []).map(renderMember)}
                      </TeamBox>
                    </TeamGrid>

                    <LogBox>
                      👥 2:2 팀대전 준비 완료! 다음 단계에서 퀴즈 전투 화면을 연결합니다.
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
