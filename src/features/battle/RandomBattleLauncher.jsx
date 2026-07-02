// src/features/battle/RandomBattleLauncher.jsx
// 랜덤 1:1 대전을 별도 페이지가 아니라 전역 모달로 여는 런처입니다.

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const LauncherButton = styled.button`
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 2800;
  border: none;
  border-radius: 999px;
  padding: 0.8rem 1.1rem;
  background: ${props => props.$active ? '#364fc7' : '#2f6fdb'};
  color: white;
  font-family: 'Pretendard', sans-serif;
  font-weight: 1000;
  font-size: 0.98rem;
  cursor: pointer;
  box-shadow: 0 7px 0 ${props => props.$active ? '#1c2f91' : '#143d8f'}, 0 12px 26px rgba(0,0,0,0.18);
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;

  &:active {
    transform: translateY(4px);
    box-shadow: 0 3px 0 ${props => props.$active ? '#1c2f91' : '#143d8f'}, 0 8px 18px rgba(0,0,0,0.18);
  }

  @media (max-width: 640px) {
    right: 0.75rem;
    bottom: 0.75rem;
    padding: 0.68rem 0.9rem;
    font-size: 0.9rem;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: max(18px, env(safe-area-inset-top)) 12px max(24px, env(safe-area-inset-bottom));
  box-sizing: border-box;
`;

const Modal = styled.section`
  width: min(920px, 100%);
  margin: auto 0;
  border: 4px solid #2f6fdb;
  border-radius: 22px;
  background:
    linear-gradient(90deg, rgba(47,111,219,0.10) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,111,219,0.08) 1px, transparent 1px),
    #fff;
  background-size: 24px 24px;
  box-shadow: 0 20px 52px rgba(0,0,0,0.28);
  padding: 1.2rem;
  color: #1f2937;
  font-family: 'Pretendard', sans-serif;
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  box-sizing: border-box;

  @media (max-width: 680px) {
    padding: 0.9rem;
    border-radius: 18px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const Title = styled.h2`
  margin: 0 0 0.35rem;
  font-size: clamp(1.45rem, 4vw, 2.05rem);
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

const CloseButton = styled.button`
  border: none;
  border-radius: 999px;
  background: #f1f3f5;
  color: #495057;
  width: 36px;
  height: 36px;
  font-size: 1.15rem;
  font-weight: 1000;
  cursor: pointer;
  flex-shrink: 0;
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
  gap: 0.35rem;
  text-align: center;
  min-height: 190px;
  align-content: start;
`;

const PetImage = styled.img`
  width: 86px;
  height: 86px;
  object-fit: contain;
  justify-self: center;
  image-rendering: pixelated;
  filter: drop-shadow(0 6px 6px rgba(0,0,0,0.16));
`;

const PetName = styled.div`
  font-size: 1rem;
  font-weight: 1000;
  word-break: keep-all;
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
  margin-top: 0.9rem;
  border: 3px dashed #748ffc;
  border-radius: 18px;
  background: #f8f9ff;
  padding: 0.85rem 1rem;
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

function RandomBattleLauncher() {
  const location = useLocation();
  const { classId } = useClassStore();
  const { players } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [isOpen, setIsOpen] = useState(false);
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

  if (!currentUser || !myPlayerData || location.pathname.startsWith('/battle/')) {
    return null;
  }

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
      setMessage('입장 확인을 기록했습니다. 양쪽 입장이 완료되면 배틀방으로 이동합니다.');
    } catch (e) {
      setError(e?.message || '입장 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <LauncherButton
          type="button"
          onClick={() => setIsOpen(true)}
          $active={activeQueue}
          title="랜덤 대전"
        >
          <span>🎲</span>
          <span>{activeQueue ? '랜덤 대전 대기 중' : '랜덤 대전'}</span>
        </LauncherButton>
      )}

      {isOpen && (
        <Overlay onClick={() => setIsOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <Header>
              <div>
                <Title>🎲 랜덤 대전</Title>
                <HelpText>
                  친구를 직접 고르지 않고, 실제 출전 가능한 3마리의 평균 레벨로 상대를 찾습니다.
                  매칭 후에도 상대는 숨겨지고, 입장해야 공개됩니다.
                </HelpText>
              </div>
              <CloseButton type="button" onClick={() => setIsOpen(false)} aria-label="닫기">×</CloseButton>
            </Header>

            <TeamGrid>
              {[0, 1, 2].map((index) => {
                const pet = resolvedTeam.team[index];
                if (!pet) return <EmptyPetSlot key={`empty-${index}`} index={index + 1} />;
                const imageKey = `${pet.appearanceId}_idle`;
                const fallbackKey = pet.appearanceId || pet.species || 'slime_lv1_idle';
                return (
                  <PetCard key={pet.id} $available>
                    {(petImageMap[imageKey] || petImageMap[fallbackKey]) && (
                      <PetImage src={petImageMap[imageKey] || petImageMap[fallbackKey]} alt={pet.name} />
                    )}
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
              {!activeQueue && !resolvedTeam.isComplete && <HelpText>출전 가능한 펫 3마리가 필요합니다. 기절했거나 오늘 대전 횟수를 모두 쓴 펫은 제외됩니다.</HelpText>}
            </StatusCard>

            <ActionRow>
              {!activeQueue && (
                <Button type="button" onClick={handleJoinQueue} disabled={isSubmitting || !resolvedTeam.isComplete}>랜덤 대전 신청</Button>
              )}
              {queueEntry?.status === 'waiting' && (
                <Button type="button" $variant="secondary" onClick={() => handleCancelQueue('cancelled_by_player')} disabled={isSubmitting}>대기 취소</Button>
              )}
              {isMatched && (
                <>
                  <Button type="button" onClick={handleEnterBattle} disabled={isSubmitting}>입장하기</Button>
                  <Button type="button" $variant="secondary" onClick={() => handleCancelQueue('skip_matched_battle')} disabled={isSubmitting}>이번엔 쉬기</Button>
                </>
              )}
            </ActionRow>

            {message && <NoticeBox>{message}</NoticeBox>}
            {error && <ErrorBox>{error}</ErrorBox>}
          </Modal>
        </Overlay>
      )}
    </>
  );
}

export default RandomBattleLauncher;
