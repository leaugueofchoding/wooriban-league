// src/features/battle/RandomBattlePage.jsx
// 랜덤 1:1 대전 화면 1차 뼈대입니다.

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import { petImageMap } from '../../utils/petImageMap';
import {
  RANDOM_BATTLE_CONFIG,
  getPetBattleFatigueLabel,
  getTodayString,
  resolveRandomBattleTeam,
} from './randomBattleRules';
import {
  cancelRandomBattleQueueEntry,
  confirmRandomBattleEntrance,
  createRandomBattleQueueEntry,
} from './randomBattleApi';

const Page = styled.div`
  min-height: 100vh;
  padding: 1rem 0.75rem 4rem;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  color: #1f2937;
  font-family: 'Pretendard', sans-serif;
`;

const Shell = styled.div`
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
`;

const Card = styled.section`
  border: 4px solid #2f6fdb;
  border-radius: 22px;
  background:
    linear-gradient(90deg, rgba(47,111,219,0.10) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,111,219,0.08) 1px, transparent 1px),
    #fff;
  background-size: 24px 24px;
  box-shadow: 0 14px 34px rgba(0,0,0,0.10);
  padding: 1.2rem;
`;

const Title = styled.h1`
  margin: 0 0 0.35rem;
  font-size: clamp(1.55rem, 4vw, 2.2rem);
  font-weight: 1000;
  color: #143d8f;
`;

const HelpText = styled.p`
  margin: 0;
  color: #4b5563;
  font-weight: 750;
  line-height: 1.55;
  word-break: keep-all;
`;

const TeamGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const PetCard = styled.div`
  border: 3px solid ${props => props.$available ? '#2f6fdb' : '#adb5bd'};
  border-radius: 18px;
  padding: 0.85rem;
  background: ${props => props.$available ? '#fff' : '#f1f3f5'};
  display: grid;
  gap: 0.45rem;
  text-align: center;
  min-height: 205px;
  align-content: start;
`;

const PetImage = styled.img`
  width: 96px;
  height: 96px;
  object-fit: contain;
  justify-self: center;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 6px rgba(0,0,0,0.16));
`;

const PetName = styled.div`
  font-size: 1rem;
  font-weight: 1000;
`;

const PetMeta = styled.div`
  font-size: 0.82rem;
  color: #4b5563;
  font-weight: 850;
`;

const StatusCard = styled.div`
  margin-top: 1rem;
  padding: 0.9rem;
  border-radius: 16px;
  background: #edf2ff;
  border: 3px solid #91a7ff;
  display: grid;
  gap: 0.35rem;
`;

const StatusLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-weight: 1000;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
`;

const Button = styled.button`
  border: none;
  border-radius: 14px;
  padding: 0.85rem 1.05rem;
  font-family: inherit;
  font-weight: 1000;
  cursor: pointer;
  color: white;
  background: ${props => props.$variant === 'secondary' ? '#868e96' : '#2f6fdb'};
  box-shadow: 0 4px 0 ${props => props.$variant === 'secondary' ? '#495057' : '#143d8f'};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }
`;

const NoticeBox = styled.div`
  border: 3px dashed #748ffc;
  border-radius: 18px;
  background: #f8f9ff;
  padding: 1rem;
  color: #364fc7;
  font-weight: 850;
  line-height: 1.6;
  word-break: keep-all;
`;

const ErrorBox = styled(NoticeBox)`
  border-color: #ff8787;
  background: #fff5f5;
  color: #c92a2a;
`;

const EmptyPetSlot = ({ index }) => (
  <PetCard $available={false}>
    <div style={{ fontSize: '2rem' }}>❔</div>
    <PetName>{index}번 슬롯</PetName>
    <PetMeta>출전 가능한 펫이 부족해요.</PetMeta>
  </PetCard>
);

function RandomBattlePage() {
  const { classId } = useClassStore();
  const { players } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [queueEntry, setQueueEntry] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const myPlayerData = useMemo(() => (
    players.find((player) => player.authUid === currentUser?.uid || player.id === currentUser?.uid)
  ), [players, currentUser]);

  const today = getTodayString();
  const resolvedTeam = useMemo(() => resolveRandomBattleTeam({
    player: myPlayerData,
    today,
    teamSize: RANDOM_BATTLE_CONFIG.TEAM_SIZE_1V1,
  }), [myPlayerData, today]);

  useEffect(() => {
    if (!classId || !myPlayerData?.id) return undefined;
    const queueRef = doc(db, 'classes', classId, 'randomBattleQueue', myPlayerData.id);
    return onSnapshot(queueRef, (snap) => {
      setQueueEntry(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [classId, myPlayerData?.id]);

  const activeQueue = ['waiting', 'matched', 'entering'].includes(queueEntry?.status);
  const isMatched = queueEntry?.status === 'matched';

  const handleJoinQueue = async () => {
    if (!classId || !myPlayerData?.id) return;
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      await createRandomBattleQueueEntry(classId, myPlayerData.id, {
        mode: 'random-1v1',
        teamSize: RANDOM_BATTLE_CONFIG.TEAM_SIZE_1V1,
      });
      setMessage('상대를 찾는 중입니다. 비슷한 레벨의 상대를 찾고 있어요. 상대는 입장 전까지 공개되지 않습니다.');
    } catch (e) {
      setError(e?.message || '랜덤 대전 신청에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelQueue = async (reason = 'cancelled_by_player') => {
    if (!classId || !myPlayerData?.id) return;
    setIsSubmitting(true);
    setError('');
    try {
      await cancelRandomBattleQueueEntry(classId, myPlayerData.id, reason);
      setMessage(reason === 'skip_matched_battle'
        ? '이번 매칭은 쉬기로 했어요. 잠시 뒤 다시 신청할 수 있습니다.'
        : '랜덤 대전 대기를 취소했습니다.');
    } catch (e) {
      setError(e?.message || '대기 취소에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnterBattle = async () => {
    if (!classId || !myPlayerData?.id) return;
    setIsSubmitting(true);
    setError('');
    try {
      await confirmRandomBattleEntrance(classId, myPlayerData.id);
      setMessage('입장 확인을 기록했습니다. 양쪽 입장이 완료되면 배틀방으로 이동하도록 다음 단계에서 연결합니다.');
    } catch (e) {
      setError(e?.message || '입장 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!myPlayerData) {
    return (
      <Page>
        <Shell><ErrorBox>플레이어 정보를 불러오는 중입니다.</ErrorBox></Shell>
      </Page>
    );
  }

  return (
    <Page>
      <Shell>
        <Card>
          <Title>🎲 랜덤 대전</Title>
          <HelpText>
            친구를 직접 고르지 않고, 실제 출전 가능한 3마리의 평균 레벨로 상대를 찾습니다.
            매칭 후에도 상대는 숨겨지고, 입장해야 공개됩니다.
          </HelpText>

          <TeamGrid>
            {[0, 1, 2].map((index) => {
              const pet = resolvedTeam.team[index];
              if (!pet) return <EmptyPetSlot key={`empty-${index}`} index={index + 1} />;
              const imageKey = pet.appearanceId || pet.species;
              return (
                <PetCard key={pet.id} $available>
                  {petImageMap[imageKey] && <PetImage src={petImageMap[imageKey]} alt={pet.name} />}
                  <PetName>{index === 0 ? '1번 선발 · ' : `${index + 1}번 대기 · `}{pet.name}</PetName>
                  <PetMeta>Lv. {pet.level || 1}</PetMeta>
                  <PetMeta>HP {Math.max(0, Number(pet.hp || 0))}/{pet.maxHp || 0}</PetMeta>
                  <PetMeta>{getPetBattleFatigueLabel(pet, today)}</PetMeta>
                </PetCard>
              );
            })}
          </TeamGrid>

          <StatusCard>
            <StatusLine>
              <span>평균 Lv. {resolvedTeam.matchLevel || '-'}</span>
              <span>{resolvedTeam.isComplete ? '출전 가능' : `출전 불가 · ${resolvedTeam.missingCount}마리 부족`}</span>
            </StatusLine>
            {queueEntry?.status === 'waiting' && <HelpText>상대를 찾는 중입니다... 비슷한 레벨의 상대를 찾고 있어요.</HelpText>}
            {isMatched && <HelpText>🎲 랜덤 대전이 매칭되었습니다! 상대는 아직 공개되지 않습니다. 입장하면 상대와 펫이 공개됩니다.</HelpText>}
          </StatusCard>

          <ActionRow>
            {!activeQueue && (
              <Button onClick={handleJoinQueue} disabled={isSubmitting || !resolvedTeam.isComplete}>랜덤 대전 신청</Button>
            )}
            {queueEntry?.status === 'waiting' && (
              <Button $variant="secondary" onClick={() => handleCancelQueue('cancelled_by_player')} disabled={isSubmitting}>대기 취소</Button>
            )}
            {isMatched && (
              <>
                <Button onClick={handleEnterBattle} disabled={isSubmitting}>입장하기</Button>
                <Button $variant="secondary" onClick={() => handleCancelQueue('skip_matched_battle')} disabled={isSubmitting}>이번엔 쉬기</Button>
              </>
            )}
          </ActionRow>
        </Card>

        {message && <NoticeBox>{message}</NoticeBox>}
        {error && <ErrorBox>{error}</ErrorBox>}
        <NoticeBox>
          이 화면은 M4 랜덤 1:1 큐의 학생 UX 뼈대입니다. 다음 단계에서 매칭 실행 함수와 방 생성 로직을 연결합니다.
        </NoticeBox>
      </Shell>
    </Page>
  );
}

export default RandomBattlePage;
