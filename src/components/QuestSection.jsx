// src/components/QuestSection.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useClassStore, useLeagueStore } from '../store/leagueStore';
import {
  auth, listenQuests, acceptQuest,
  cancelQuestAcceptance, requestQuestCompletion, completeQuestForPlayer,
} from '../api/firebase';

// ─────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const slideDown = keyframes`
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 800px; }
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
  font-size: 0.72rem; font-weight: 800; letter-spacing: 1.5px;
  text-transform: uppercase; color: #e67700;
  background: #fff3bf; border: 1px solid #ffe066;
  border-radius: 6px; padding: 3px 9px; white-space: nowrap;
`;
const SectionLine = styled.div`
  flex: 1; height: 1px; background: #ffe066; opacity: 0.55;
`;
const SectionCount = styled.span`
  font-size: 0.78rem; color: #adb5bd; font-weight: 500; white-space: nowrap;
`;

// ─────────────────────────────────────────────
// Quest card
// ─────────────────────────────────────────────
const QuestCard = styled.div`
  background: #fff; border-radius: 16px;
  padding: 1.2rem 1.4rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border: 1px solid #f1f3f5;
  position: relative; overflow: hidden;
  cursor: default;
  transition: transform 0.18s, box-shadow 0.18s;
  animation: ${fadeUp} 0.3s ease-out both;

  &::before {
    content: ''; position: absolute;
    top: 0; left: 0; bottom: 0; width: 6px;
    background: ${p =>
    p.$completed ? '#a9e34b' :
      p.$pending ? '#74c0fc' :
        p.$rejected ? '#ff8787' :
          p.$accepted ? '#20c997' :
            p.$full ? '#adb5bd' :
              '#fcc419'};
    transition: background 0.3s;
  }
`;

const QuestList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const CardInner = styled.div` padding-left: 6px; `;
const TopRow = styled.div`
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
`;
const TitleRow = styled.h3`
  margin: 0 0 4px; font-size: 1.15rem;
  font-weight: 800; color: #343a40;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
`;
const Tag = styled.span`
  font-size: 0.72rem; padding: 3px 8px; border-radius: 5px; font-weight: 700;
  background: ${p => p.$bg || '#f1f3f5'};
  color: ${p => p.$color || '#495057'};
`;
const Reward = styled.div`
  font-size: 1.1rem; font-weight: 800; color: #fcc419;
  white-space: nowrap; margin-top: 2px;
`;
const Desc = styled.p`
  margin: 8px 0 12px; font-size: 0.95rem; color: #868e96;
  line-height: 1.55; background: #f8f9fa;
  padding: 10px 12px; border-radius: 8px;
`;
const MetaRow = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;
const MetaChip = styled.span`
  font-size: 0.8rem; color: #adb5bd;
  display: flex; align-items: center; gap: 3px; font-weight: 600;
`;
const SlotPips = styled.div` display: flex; gap: 4px; align-items: center; `;
const Pip = styled.span`
  display: inline-block; width: 11px; height: 11px; border-radius: 3px;
  border: 1.5px solid ${p => p.$taken ? '#f59f00' : '#dee2e6'};
  background: ${p => p.$taken ? '#fcc419' : '#fff'};
  transition: background 0.25s, border-color 0.25s;
`;

// ─────────────────────────────────────────────
// 수락자 현황 칩 (색상 통일: 노란=수락, 초록=승인요청, 파란=완료)
// ─────────────────────────────────────────────
const AcceptorRow = styled.div`
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid #f1f3f5; flex-wrap: wrap;
`;
const AcceptorChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.8rem; font-weight: 700;
  padding: 4px 10px; border-radius: 20px;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  transition: filter 0.15s;

  /* 색상 체계: 노란=수락(accepted), 초록=승인요청(pending), 파란=퀘스트 승인(completed) */
  background: ${p =>
    p.$status === 'completed' ? '#e7f5ff' :   /* 파란 */
      p.$status === 'pending' ? '#ebfbee' :   /* 초록 */
        p.$status === 'rejected' ? '#ffe3e3' :
          '#fff9db'};                          /* 노란 = accepted */
  color: ${p =>
    p.$status === 'completed' ? '#1971c2' :
      p.$status === 'pending' ? '#2f9e44' :
        p.$status === 'rejected' ? '#fa5252' :
          '#e67700'};
  border: 1px solid ${p =>
    p.$status === 'completed' ? '#a5d8ff' :
      p.$status === 'pending' ? '#b2f2bb' :
        p.$status === 'rejected' ? '#ffc9c9' :
          '#ffe066'};

  &:hover {
    filter: ${p => p.$clickable ? 'brightness(0.92)' : 'none'};
  }
`;
const AcceptorDot = styled.span`
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: ${p =>
    p.$status === 'completed' ? '#339af0' :
      p.$status === 'pending' ? '#40c057' :
        p.$status === 'rejected' ? '#fa5252' :
          '#fcc419'};
`;

const ActionBtn = styled.button`
  margin-left: auto;
  padding: 8px 18px; font-size: 0.85rem; font-weight: 800;
  border: none; border-radius: 10px; cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
  background: ${p =>
    p.$completed ? '#e7f5ff' :     /* 파란 - 완료 */
      p.$pending ? '#ebfbee' :     /* 초록 - 승인 대기 */
        p.$rejected ? '#ffe3e3' :
          p.$accepted ? '#fff9db' : /* 노란 - 수락됨 */
            p.$full ? '#f1f3f5' :
              '#fcc419'};
  color: ${p =>
    p.$completed ? '#1971c2' :
      p.$pending ? '#2f9e44' :
        p.$rejected ? '#fa5252' :
          p.$accepted ? '#e67700' :
            p.$full ? '#adb5bd' :
              '#7a4d00'};
  &:hover:not(:disabled) { filter: brightness(0.95); transform: translateY(-1px); }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
`;

// ─────────────────────────────────────────────
// 인라인 확장 패널 (모달 대신)
// ─────────────────────────────────────────────
const InlinePanel = styled.div`
  margin-top: 14px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #f1f3f5;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: ${slideDown} 0.25s ease-out;
`;

const InlineBtn = styled.button`
  display: block; width: 100%; padding: 10px 14px;
  border: none; border-radius: 10px;
  font-size: 0.9rem; font-weight: 800; cursor: pointer;
  transition: filter 0.15s; margin-bottom: 0;
  background: ${p => p.$variant === 'cancel' ? 'none' : p.$variant === 'danger' ? 'none' : p.$variant === 'complete' ? '#ebfbee' : '#fcc419'};
  color: ${p => p.$variant === 'cancel' ? '#adb5bd' : p.$variant === 'danger' ? '#fa5252' : p.$variant === 'complete' ? '#2f9e44' : '#7a4d00'};
  border: ${p => (p.$variant === 'cancel' || p.$variant === 'danger') ? '1px solid #dee2e6' : 'none'};
  opacity: ${p => p.disabled ? 0.6 : 1};
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  &:hover:not(:disabled) { filter: brightness(0.96); }
`;

const RejectedBox = styled.div`
  background: #fff5f5; border: 1px solid #ffc9c9;
  border-radius: 10px; padding: 10px 12px;
`;

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────
const Wrapper = styled.div` margin-bottom: 2rem; `;

const QuestFilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.5rem;
  min-height: 38px;
`;

const QuestToggleButton = styled.button`
  padding: 0.6rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 700;
  border: 2px solid ${props => props.$active ? '#f59f00' : '#dee2e6'};
  border-radius: 20px;
  cursor: pointer;
  background-color: ${props => props.$active ? '#fff9db' : '#fff'};
  color: ${props => props.$active ? '#e67700' : '#868e96'};
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => props.$active ? '#fff3bf' : '#f8f9fa'};
  }
`;
const EmptyQuest = styled.div`
  text-align: center; padding: 1.5rem; color: #adb5bd;
  font-size: 0.9rem; background: #f8f9fa;
  border-radius: 12px; margin-bottom: 12px;
`;

// ─────────────────────────────────────────────
// 수락자 현황 토글용 헤더 (카드 여백 클릭 영역)
// ─────────────────────────────────────────────
const CardClickArea = styled.div`
  cursor: ${p => p.$hasAcceptors ? 'pointer' : 'default'};
`;

function getSubmissionLabel(type) {
  if (!type) return '단순 완료';
  const map = { simple: '단순 완료', text: '📝 글 제출', photo: '📸 사진 제출' };
  if (Array.isArray(type)) return type.map(t => map[t] || t).join(' + ');
  return map[type] || type;
}

function statusLabel(s) {
  if (s === 'completed') return '✓ 완료';
  if (s === 'pending') return '승인 대기 중';
  if (s === 'rejected') return '✗ 반려됨';
  return '수락됨';
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
export default function QuestSection({ onQuestCountChange }) {
  const { classId } = useClassStore();
  const { players } = useLeagueStore();
  const currentUser = auth.currentUser;

  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [questSubmission, setQuestSubmission] = useState({ text: '', photos: [] });

  // 인라인 확장 상태: questId → 'action' | 'acceptors' | null
  const [expandedPanel, setExpandedPanel] = useState({}); // { [questId]: 'action' | 'acceptors' }

  const myPlayer = useMemo(() => {
    if (!currentUser) return null;
    return players.find(p => p.authUid === currentUser.uid) || null;
  }, [players, currentUser]);

  const isAdmin = useMemo(() => {
    if (!myPlayer) return false;
    return myPlayer.role === 'admin' || myPlayer.role === 'recorder';
  }, [myPlayer]);

  useEffect(() => {
    if (!classId) return;
    return listenQuests(classId, (data) => {
      setQuests(data.filter(q => q.status === 'open'));
    });
  }, [classId]);

  // 부모에 퀘스트 수 전달
  const onQuestCountChangeRef = useRef(onQuestCountChange);
  useEffect(() => { onQuestCountChangeRef.current = onQuestCountChange; });
  useEffect(() => {
    onQuestCountChangeRef.current?.(quests.length);
  }, [quests.length]);

  const getMyAcceptor = (quest) => {
    if (!myPlayer) return null;
    return (quest.acceptors || []).find(a => a.playerId === myPlayer.id) || null;
  };
  const isFull = (quest) => (quest.acceptors || []).length >= (quest.maxAcceptors || 1);

  const availableCount = quests.filter(q => !isFull(q) && !getMyAcceptor(q)).length;

  const myCompletedQuests = quests.filter(q => {
    const myAcceptor = getMyAcceptor(q);
    return myAcceptor?.completionStatus === 'completed';
  });

  const allAcceptorsCompletedQuests = quests.filter(q => {
    const acceptors = q.acceptors || [];
    if (acceptors.length === 0) return false;
    const maxSlots = q.maxAcceptors || 1;
    return acceptors.length >= maxSlots && acceptors.every(a => a.completionStatus === 'completed');
  });

  const hiddenCount = allAcceptorsCompletedQuests.length;

  const visibleQuests = showAllQuests
    ? quests
    : quests.filter(q => {
      const myAcceptor = getMyAcceptor(q);
      if (myAcceptor?.completionStatus === 'completed') return false;
      const acceptors = q.acceptors || [];
      const maxSlots = q.maxAcceptors || 1;
      if (acceptors.length >= maxSlots && acceptors.every(a => a.completionStatus === 'completed')) return false;
      return true;
    });

  // ── 수락 ──
  const handleAccept = async (quest) => {
    if (!myPlayer || loading) return;
    setLoading(true);
    try {
      const result = await acceptQuest(classId, quest.id, myPlayer);
      if (result === 'full') alert('아쉽게도 이미 마감됐어요. 다음 기회에 도전해보세요!');
      else if (result === 'already') alert('이미 수락한 퀘스트예요.');
    } catch (e) {
      alert(`수락 중 오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── 수락 취소 ──
  const handleCancelAccept = async (questId) => {
    if (!myPlayer) return;
    if (!window.confirm('퀘스트 수락을 취소할까요?')) return;
    try {
      await cancelQuestAcceptance(classId, questId, myPlayer.id);
      setExpandedPanel(p => ({ ...p, [questId]: null }));
    } catch (e) { alert(`취소 중 오류: ${e.message}`); }
  };

  // ── 관리자: 수락자 이름 클릭 → 즉시 완료 처리 ──
  const handleForceComplete = async (quest, acceptor) => {
    if (acceptor.completionStatus === 'completed') return;
    const heartMsg = quest.heartReward > 0 ? ` + ❤️ ${quest.heartReward}` : '';
    if (!window.confirm(`[관리자] ${acceptor.playerName} 학생의 퀘스트를 즉시 완료 처리하고 ${quest.reward}P${heartMsg}를 지급할까요?`)) return;
    try {
      await completeQuestForPlayer(classId, quest.id, acceptor.playerId, acceptor.playerName, quest.reward, quest.heartReward || 0);
    } catch (e) {
      alert(`완료 처리 실패: ${e.message}`);
    }
  };

  // ── 완료 요청 (학생) ──
  const handleRequestComplete = async (questId) => {
    if (!myPlayer) return;
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    const submissionType = quest.submissionType || ['simple'];
    const requiresText = Array.isArray(submissionType) ? submissionType.includes('text') : submissionType === 'text';
    const requiresPhoto = Array.isArray(submissionType) ? submissionType.includes('photo') : submissionType === 'photo';
    const isSubmissionRequired = requiresText || requiresPhoto;

    if (isSubmissionRequired) {
      const hasText = questSubmission.text.trim().length > 0;
      const hasPhotos = questSubmission.photos.length > 0;
      if (requiresText && requiresPhoto && !hasText && !hasPhotos) {
        return alert('글을 작성하거나 사진을 한 장 이상 첨부해주세요.');
      }
      if (requiresText && !requiresPhoto && !hasText) {
        return alert('글 내용을 입력해주세요.');
      }
      if (requiresPhoto && !requiresText && !hasPhotos) {
        return alert('사진 파일을 한 장 이상 첨부해주세요.');
      }
    }

    if (!window.confirm('완료를 요청할까요? 선생님이 확인 후 포인트가 지급됩니다.')) return;
    setLoading(true);
    try {
      await requestQuestCompletion(classId, questId, myPlayer.id, questSubmission);
      setQuestSubmission({ text: '', photos: [] });
      setExpandedPanel(p => ({ ...p, [questId]: null }));
    } catch (e) { alert(`완료 요청 중 오류: ${e.message}`); }
    finally { setLoading(false); }
  };

  if (!myPlayer) return null;

  return (
    <Wrapper>
      <SectionHeader>
        <QuestBadge>⚔ Quest</QuestBadge>
        <SectionLine />
        <SectionCount>
          {availableCount > 0 ? `${availableCount}개 수락 가능` : '진행 중인 퀘스트 없음'}
        </SectionCount>
      </SectionHeader>

      <QuestFilterContainer>
        {(myCompletedQuests.length > 0 || hiddenCount > 0) && (
          <QuestToggleButton
            $active={showAllQuests}
            onClick={() => setShowAllQuests(prev => !prev)}
          >
            {showAllQuests ? '할 일만 보기' : `모든 퀘스트 보기 (완료 ${myCompletedQuests.length + hiddenCount}개)`}
          </QuestToggleButton>
        )}
      </QuestFilterContainer>

      {visibleQuests.length === 0 && quests.length === 0 ? (
        <EmptyQuest>선생님이 새 퀘스트를 올리면 알려드릴게요!</EmptyQuest>
      ) : visibleQuests.length === 0 ? (
        <EmptyQuest>🎉 모든 퀘스트를 완료했어요!</EmptyQuest>
      ) : (
        <QuestList>
          {visibleQuests.map((quest, i) => {
            const myAcceptor = getMyAcceptor(quest);
            const full = isFull(quest);
            const accepted = !!myAcceptor;
            const status = myAcceptor?.completionStatus;
            const takenCount = (quest.acceptors || []).length;
            const maxSlots = quest.maxAcceptors || 1;
            const panelMode = expandedPanel[quest.id]; // 'action' | 'acceptors' | undefined

            const submissionType = quest.submissionType || ['simple'];
            const requiresText = Array.isArray(submissionType) ? submissionType.includes('text') : submissionType === 'text';
            const requiresPhoto = Array.isArray(submissionType) ? submissionType.includes('photo') : submissionType === 'photo';
            const isSubmissionRequired = requiresText || requiresPhoto;

            const hasAcceptors = takenCount > 0;

            // 카드 여백 클릭 → 수락자 현황 토글 (acceptors 패널)
            const handleCardClick = () => {
              if (!hasAcceptors) return;
              setExpandedPanel(p => ({
                ...p,
                [quest.id]: p[quest.id] === 'acceptors' ? null : 'acceptors'
              }));
            };

            // 액션 버튼 클릭 → 인라인 액션 패널 토글
            const handleActionBtnClick = (e) => {
              e.stopPropagation();
              if (!accepted && !full) {
                // 수락하기: 바로 처리
                handleAccept(quest);
              } else {
                // 완료요청/재제출: 인라인 패널 토글
                setExpandedPanel(p => ({
                  ...p,
                  [quest.id]: p[quest.id] === 'action' ? null : 'action'
                }));
              }
            };

            return (
              <QuestCard
                key={quest.id}
                $accepted={accepted && status === 'accepted'}
                $pending={status === 'pending'}
                $completed={status === 'completed'}
                $rejected={status === 'rejected'}
                $full={full && !accepted}
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={handleCardClick}
              >
                <CardInner>
                  <TopRow>
                    <div>
                      <TitleRow>
                        <span>⚔</span>
                        {quest.title}
                        {!full && !accepted && <Tag $bg="#fff0f6" $color="#c2255c">NEW</Tag>}
                        {full && !accepted && <Tag $bg="#f1f3f5" $color="#adb5bd">마감</Tag>}
                        {status === 'pending' && <Tag $bg="#ebfbee" $color="#2f9e44">승인 대기</Tag>}
                        {status === 'completed' && <Tag $bg="#e7f5ff" $color="#1971c2">완료</Tag>}
                        {status === 'rejected' && <Tag $bg="#ffe3e3" $color="#fa5252">반려됨</Tag>}
                        <Tag $bg="#e7f5ff" $color="#1c7ed6">{maxSlots - takenCount}/{maxSlots} 자리</Tag>
                      </TitleRow>
                    </div>
                    <Reward>
                      💰 {quest.reward}P{quest.heartReward > 0 && <> · ❤️ {quest.heartReward}</>}
                    </Reward>
                  </TopRow>

                  {quest.description && <Desc>{quest.description}</Desc>}

                  <MetaRow onClick={e => e.stopPropagation()}>
                    <MetaChip>📋 {getSubmissionLabel(quest.submissionType)}</MetaChip>
                    {quest.deadline && <MetaChip>🕐 {quest.deadline}</MetaChip>}
                    <SlotPips>
                      {Array.from({ length: maxSlots }).map((_, idx) => (
                        <Pip key={idx} $taken={idx < takenCount} />
                      ))}
                    </SlotPips>
                    <ActionBtn
                      $accepted={accepted && status === 'accepted'}
                      $pending={status === 'pending'}
                      $completed={status === 'completed'}
                      $rejected={status === 'rejected'}
                      $full={full && !accepted}
                      disabled={(full && !accepted) || status === 'completed' || status === 'pending'}
                      onClick={handleActionBtnClick}
                    >
                      {status === 'completed' ? '✓ 완료됨' :
                        status === 'pending' ? '⏳ 승인 대기' :
                          status === 'rejected' ? '↩ 재제출하기' :
                            accepted ? '완료 요청' :
                              full ? '마감됨' : '수락하기'}
                    </ActionBtn>
                  </MetaRow>

                  {/* 수락자 인라인 표시 - 카드 클릭으로 토글 */}
                  {hasAcceptors && panelMode === 'acceptors' && (
                    <AcceptorRow onClick={e => e.stopPropagation()}>
                      <MetaChip style={{ marginRight: 2 }}>수락:</MetaChip>
                      {(quest.acceptors || []).map(a => (
                        <AcceptorChip
                          key={a.playerId}
                          $status={a.completionStatus}
                          $clickable={isAdmin && a.completionStatus !== 'completed'}
                          title={isAdmin && a.completionStatus !== 'completed' ? '클릭하여 즉시 완료 처리' : undefined}
                          onClick={isAdmin && a.completionStatus !== 'completed'
                            ? () => handleForceComplete(quest, a)
                            : undefined
                          }
                        >
                          <AcceptorDot $status={a.completionStatus} />
                          {a.playerName}
                          {isAdmin && a.completionStatus !== 'completed' && <span style={{ fontSize: '0.68rem', opacity: 0.7 }}> ✓</span>}
                        </AcceptorChip>
                      ))}
                    </AcceptorRow>
                  )}

                  {/* 인라인 액션 패널 (모달 대신) */}
                  {panelMode === 'action' && (
                    <InlinePanel onClick={e => e.stopPropagation()}>
                      {/* 반려됨 안내 */}
                      {status === 'rejected' && (
                        <RejectedBox>
                          <p style={{ margin: '0 0 4px', fontSize: '0.78rem', fontWeight: 700, color: '#fa5252' }}>✗ 완료 요청이 반려됐어요</p>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#495057' }}>
                            {myAcceptor?.rejectedReason ? `사유: ${myAcceptor.rejectedReason}` : '선생님이 반려 사유를 남기지 않았어요.'}
                          </p>
                        </RejectedBox>
                      )}

                      {/* 글/사진 제출 영역 */}
                      {isSubmissionRequired && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {requiresText && (
                            <textarea
                              value={questSubmission.text}
                              onChange={e => setQuestSubmission(prev => ({ ...prev, text: e.target.value }))}
                              placeholder="완료 내용을 작성해주세요."
                              style={{ width: '100%', minHeight: '80px', padding: '0.6rem', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />
                          )}
                          {requiresPhoto && (
                            <div>
                              <label htmlFor={`quest-photo-${quest.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', background: '#fff', border: '1px dashed #adb5bd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#495057', fontWeight: 600 }}>
                                <span>📸</span>
                                <span>사진 추가하기 {questSubmission.photos.length > 0 ? `(${questSubmission.photos.length}장)` : ''}</span>
                                <input id={`quest-photo-${quest.id}`} type="file" accept="image/*" multiple style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const files = Array.from(e.target.files);
                                    if (!files.length) return;
                                    setQuestSubmission(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
                                    e.target.value = null;
                                  }}
                                />
                              </label>
                              {questSubmission.photos.length > 0 && (
                                <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#495057', background: '#f8f9fa', padding: '6px 8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{questSubmission.photos.map(f => f.name).join(', ')}</span>
                                  <button onClick={() => setQuestSubmission(prev => ({ ...prev, photos: [] }))} style={{ background: 'none', border: 'none', color: '#fa5252', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>삭제</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 완료 요청 버튼 */}
                      <InlineBtn $variant="complete" onClick={() => handleRequestComplete(quest.id)} disabled={loading}>
                        {status === 'rejected' ? '↩ 다시 완료 요청하기' : '✅ 완료 요청하기 (선생님 승인 후 포인트 지급)'}
                      </InlineBtn>

                      {/* 수락 취소 / 퀘스트 포기 */}
                      <InlineBtn $variant="danger" onClick={() => handleCancelAccept(quest.id)}>
                        {status === 'rejected' ? '퀘스트 포기하기' : '수락 취소하기'}
                      </InlineBtn>

                      {/* 닫기 */}
                      <InlineBtn $variant="cancel" onClick={() => setExpandedPanel(p => ({ ...p, [quest.id]: null }))}>
                        닫기
                      </InlineBtn>
                    </InlinePanel>
                  )}
                </CardInner>
              </QuestCard>
            );
          })}
        </QuestList>
      )}
    </Wrapper>
  );
}
