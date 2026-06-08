// src/components/QuestSection.jsx
// 미션 페이지 상단에 삽입되는 퀘스트 섹션 (선착순 수락 방식)

import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useClassStore, useLeagueStore } from '../store/leagueStore';
import { auth, listenQuests, acceptQuest, cancelQuestAcceptance } from '../api/firebase';

// ─────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const popIn = keyframes`
  from { transform: scale(0.88); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
`;

// ─────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────
const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

const QuestBadge = styled.span`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: #e67700;
  background: #fff3bf;
  border: 1px solid #ffe066;
  border-radius: 6px;
  padding: 3px 9px;
  white-space: nowrap;
`;

const SectionLine = styled.div`
  flex: 1;
  height: 1px;
  background: #ffe066;
  opacity: 0.55;
`;

const SectionCount = styled.span`
  font-size: 0.78rem;
  color: #adb5bd;
  font-weight: 500;
  white-space: nowrap;
`;

// ─────────────────────────────────────────────
// Quest card (MissionCard 스타일 계승)
// ─────────────────────────────────────────────
const QuestCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 1.2rem 1.4rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border: 1px solid #f1f3f5;
  position: relative;
  overflow: hidden;
  margin-bottom: 12px;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  transition: transform 0.18s, box-shadow 0.18s;
  animation: ${fadeUp} 0.3s ease-out both;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 6px;
    background: ${p =>
    p.$accepted ? '#20c997' :
      p.$full ? '#adb5bd' :
        '#fcc419'};
    transition: background 0.3s;
  }

  &:hover {
    transform: ${p => p.$clickable ? 'translateY(-2px)' : 'none'};
    box-shadow: ${p => p.$clickable ? '0 8px 25px rgba(0,0,0,0.09)' : '0 4px 20px rgba(0,0,0,0.05)'};
  }
`;

const CardInner = styled.div`
  padding-left: 6px;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const TitleRow = styled.h3`
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #343a40;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 700;
  background: ${p => p.$bg || '#f1f3f5'};
  color: ${p => p.$color || '#495057'};
`;

const Reward = styled.div`
  font-size: 1rem;
  font-weight: 800;
  color: #fcc419;
  white-space: nowrap;
  margin-top: 2px;
  text-shadow: 0 1px 1px rgba(0,0,0,0.08);
`;

const Desc = styled.p`
  margin: 8px 0 10px;
  font-size: 0.88rem;
  color: #868e96;
  line-height: 1.55;
  background: #f8f9fa;
  padding: 8px 10px;
  border-radius: 8px;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const MetaChip = styled.span`
  font-size: 0.76rem;
  color: #adb5bd;
  display: flex;
  align-items: center;
  gap: 3px;
`;

const SlotPips = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const Pip = styled.span`
  display: inline-block;
  width: 11px; height: 11px;
  border-radius: 3px;
  border: 1.5px solid ${p => p.$taken ? '#f59f00' : '#dee2e6'};
  background: ${p => p.$taken ? '#fcc419' : '#fff'};
  transition: background 0.25s, border-color 0.25s;
`;

const AcceptBtn = styled.button`
  margin-left: auto;
  padding: 7px 18px;
  font-size: 0.82rem;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  cursor: ${p => (p.$full || p.$accepted || p.$loading) ? 'not-allowed' : 'pointer'};
  transition: filter 0.15s, transform 0.15s;
  background: ${p =>
    p.$accepted ? '#d3f9d8' :
      p.$full ? '#f1f3f5' :
        '#fcc419'};
  color: ${p =>
    p.$accepted ? '#2f9e44' :
      p.$full ? '#adb5bd' :
        '#7a4d00'};
  box-shadow: ${p => (!p.$full && !p.$accepted) ? '0 2px 6px rgba(252,196,25,0.3)' : 'none'};

  &:hover:not(:disabled) {
    filter: brightness(0.95);
    transform: ${p => (!p.$full && !p.$accepted) ? 'translateY(-1px)' : 'none'};
  }

  &:disabled { opacity: 0.8; }
`;

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────
const ModalOverlay = styled.div`
  display: ${p => p.$open ? 'flex' : 'none'};
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px 20px;
  max-width: 380px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  animation: ${popIn} 0.2s ease-out;
`;

const ModalBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #fff3bf;
  border: 1px solid #ffe066;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 800;
  color: #e67700;
  letter-spacing: 1px;
  margin-bottom: 12px;
`;

const ModalTitle = styled.h2`
  font-size: 1.2rem;
  font-weight: 800;
  color: #343a40;
  margin: 0 0 10px;
  line-height: 1.35;
`;

const ModalDesc = styled.p`
  font-size: 0.9rem;
  color: #495057;
  line-height: 1.65;
  background: #f8f9fa;
  border-radius: 10px;
  padding: 12px;
  margin: 0 0 16px;
  white-space: pre-wrap;
`;

const ModalRewardBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffbf0;
  border: 1px solid #ffe8a1;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 10px;
`;

const ModalRewardLabel = styled.span`
  font-size: 0.82rem;
  color: #adb5bd;
  font-weight: 500;
`;

const ModalRewardValue = styled.span`
  font-size: 1.25rem;
  font-weight: 800;
  color: #f59f00;
`;

const ModalSlots = styled.p`
  font-size: 0.82rem;
  color: #adb5bd;
  margin: 0 0 18px;

  strong { color: #1c7ed6; }
`;

const ModalAcceptBtn = styled.button`
  display: block;
  width: 100%;
  padding: 13px;
  background: #fcc419;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 800;
  color: #7a4d00;
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  transition: filter 0.15s;
  margin-bottom: 8px;
  opacity: ${p => p.disabled ? 0.6 : 1};

  &:hover:not(:disabled) { filter: brightness(0.95); }
`;

const ModalCancelBtn = styled.button`
  display: block;
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #adb5bd;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: #f8f9fa; }
`;

// 수락됨 상태 취소 버튼
const CancelAcceptBtn = styled.button`
  display: block;
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px solid #ffe3e3;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fa5252;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 8px;

  &:hover { background: #fff5f5; }
`;

// ─────────────────────────────────────────────
// Wrapper
// ─────────────────────────────────────────────
const Wrapper = styled.div`
  margin-bottom: 2rem;
`;

const EmptyQuest = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: #adb5bd;
  font-size: 0.9rem;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 12px;
`;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getSubmissionLabel(type) {
  if (!type) return '단순 완료';
  const map = { simple: '단순 완료', text: '📝 글 제출', photo: '📸 사진 제출' };
  if (Array.isArray(type)) return type.map(t => map[t] || t).join(' + ');
  return map[type] || type;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function QuestSection() {
  const { classId } = useClassStore();
  const { players } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [quests, setQuests] = useState([]);
  const [modalQuest, setModalQuest] = useState(null);
  const [loading, setLoading] = useState(false);

  const myPlayer = useMemo(() => {
    if (!currentUser) return null;
    return players.find(p => p.authUid === currentUser.uid) || null;
  }, [players, currentUser]);

  // 실시간 퀘스트 구독
  useEffect(() => {
    if (!classId) return;
    const unsub = listenQuests(classId, (data) => {
      // open 상태인 퀘스트만 표시
      setQuests(data.filter(q => q.status === 'open'));
    });
    return unsub;
  }, [classId]);

  const getMyAcceptor = (quest) => {
    if (!myPlayer) return null;
    return (quest.acceptors || []).find(a => a.playerId === myPlayer.id) || null;
  };

  const isFull = (quest) =>
    (quest.acceptors || []).length >= (quest.maxAcceptors || 1);

  // 수락 가능한 퀘스트 수 (알림 카운트용)
  const availableCount = quests.filter(q => !isFull(q) && !getMyAcceptor(q)).length;

  const handleAccept = async () => {
    if (!modalQuest || !myPlayer || loading) return;
    setLoading(true);
    try {
      const result = await acceptQuest(classId, modalQuest.id, myPlayer);
      if (result === 'accepted') {
        setModalQuest(null);
      } else if (result === 'full') {
        alert('아쉽게도 이미 다른 학생이 선착순을 채웠어요. 다음 기회에 도전해보세요!');
        setModalQuest(null);
      } else if (result === 'already') {
        alert('이미 수락한 퀘스트예요.');
        setModalQuest(null);
      }
    } catch (e) {
      alert(`수락 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (questId) => {
    if (!myPlayer) return;
    if (!window.confirm('퀘스트 수락을 취소할까요?')) return;
    try {
      await cancelQuestAcceptance(classId, questId, myPlayer.id);
      setModalQuest(null);
    } catch (e) {
      alert(`취소 중 오류가 발생했습니다: ${e.message}`);
    }
  };

  // 학생이 아니거나 퀘스트가 없으면 렌더하지 않음 (admin은 MissionTab에서 관리)
  const canSee = myPlayer && ['player', 'recorder'].includes(myPlayer.role);
  if (!canSee && quests.length === 0) return null;

  return (
    <Wrapper>
      <SectionHeader>
        <QuestBadge>⚔ Quest</QuestBadge>
        <SectionLine />
        <SectionCount>
          {availableCount > 0 ? `${availableCount}개 수락 가능` : '진행 중인 퀘스트 없음'}
        </SectionCount>
      </SectionHeader>

      {quests.length === 0 ? (
        <EmptyQuest>지금은 공개된 퀘스트가 없어요. 선생님이 새 퀘스트를 올리면 알려드릴게요!</EmptyQuest>
      ) : (
        quests.map((quest, i) => {
          const myAcceptor = getMyAcceptor(quest);
          const full = isFull(quest);
          const accepted = !!myAcceptor;
          const clickable = !full && !accepted;
          const takenCount = (quest.acceptors || []).length;
          const maxSlots = quest.maxAcceptors || 1;

          return (
            <QuestCard
              key={quest.id}
              $accepted={accepted}
              $full={full && !accepted}
              $clickable={clickable}
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => clickable && setModalQuest(quest)}
            >
              <CardInner>
                <TopRow>
                  <div>
                    <TitleRow>
                      <span>⚔</span>
                      {quest.title}
                      {!full && !accepted && (
                        <Tag $bg="#fff0f6" $color="#c2255c">NEW</Tag>
                      )}
                      {full && !accepted && (
                        <Tag $bg="#f1f3f5" $color="#adb5bd">마감</Tag>
                      )}
                      <Tag $bg="#e7f5ff" $color="#1c7ed6">
                        {maxSlots - takenCount}/{maxSlots} 자리
                      </Tag>
                    </TitleRow>
                  </div>
                  <Reward>💰 {quest.reward}P</Reward>
                </TopRow>

                {quest.description && (
                  <Desc>{quest.description}</Desc>
                )}

                <MetaRow>
                  <MetaChip>
                    📋 {getSubmissionLabel(quest.submissionType)}
                  </MetaChip>
                  {quest.deadline && (
                    <MetaChip>🕐 {quest.deadline}</MetaChip>
                  )}
                  <SlotPips>
                    {Array.from({ length: maxSlots }).map((_, idx) => (
                      <Pip key={idx} $taken={idx < takenCount} />
                    ))}
                  </SlotPips>
                  <AcceptBtn
                    $accepted={accepted}
                    $full={full && !accepted}
                    $loading={loading}
                    disabled={full && !accepted}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (accepted) setModalQuest(quest);
                      else if (clickable) setModalQuest(quest);
                    }}
                  >
                    {accepted ? '✓ 수락됨' : full ? '마감됨' : '수락하기'}
                  </AcceptBtn>
                </MetaRow>
              </CardInner>
            </QuestCard>
          );
        })
      )}

      {/* 수락 모달 */}
      <ModalOverlay $open={!!modalQuest} onClick={(e) => { if (e.target === e.currentTarget) setModalQuest(null); }}>
        {modalQuest && (() => {
          const myAcceptor = getMyAcceptor(modalQuest);
          const accepted = !!myAcceptor;
          const full = isFull(modalQuest);
          const takenCount = (modalQuest.acceptors || []).length;
          const maxSlots = modalQuest.maxAcceptors || 1;
          return (
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalBadge>⚔ 공공 퀘스트</ModalBadge>
              <ModalTitle>{modalQuest.title}</ModalTitle>
              {modalQuest.description && (
                <ModalDesc>{modalQuest.description}</ModalDesc>
              )}
              <ModalRewardBox>
                <ModalRewardLabel>🪙 완료 보상 (완료 후 지급)</ModalRewardLabel>
                <ModalRewardValue>{modalQuest.reward}P</ModalRewardValue>
              </ModalRewardBox>
              <ModalSlots>
                남은 자리 <strong>{maxSlots - takenCount}/{maxSlots}</strong>
                {modalQuest.submissionType && (
                  <> · {getSubmissionLabel(modalQuest.submissionType)}</>
                )}
                {modalQuest.deadline && (
                  <> · 🕐 {modalQuest.deadline}</>
                )}
              </ModalSlots>

              {accepted ? (
                <>
                  <ModalAcceptBtn disabled style={{ background: '#d3f9d8', color: '#2f9e44' }}>
                    ✓ 이미 수락한 퀘스트예요
                  </ModalAcceptBtn>
                  <CancelAcceptBtn onClick={() => handleCancel(modalQuest.id)}>
                    수락 취소하기
                  </CancelAcceptBtn>
                  <ModalCancelBtn onClick={() => setModalQuest(null)}>닫기</ModalCancelBtn>
                </>
              ) : (
                <>
                  <ModalAcceptBtn onClick={handleAccept} disabled={loading || full}>
                    {loading ? '처리 중...' : full ? '이미 마감된 퀘스트예요' : '⚔ 퀘스트 수락하기'}
                  </ModalAcceptBtn>
                  <ModalCancelBtn onClick={() => setModalQuest(null)}>나중에 하기</ModalCancelBtn>
                </>
              )}
            </Modal>
          );
        })()}
      </ModalOverlay>
    </Wrapper>
  );
}
