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
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
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
  &:hover {
    transform: ${p => p.$clickable ? 'translateY(-2px)' : 'none'};
    box-shadow: ${p => p.$clickable ? '0 8px 25px rgba(0,0,0,0.09)' : '0 4px 20px rgba(0,0,0,0.05)'};
  }
`;

const QuestList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* 미션 섹션과 동일한 간격 */
`;

const CardInner = styled.div` padding-left: 6px; `;
const TopRow = styled.div`
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
`;
const TitleRow = styled.h3`
  margin: 0 0 4px; font-size: 1.15rem; /* 1.05rem -> 1.15rem 폰트 약간 키움 */
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
  margin: 8px 0 12px; font-size: 0.95rem; color: #868e96; /* 0.88rem -> 0.95rem */
  line-height: 1.55; background: #f8f9fa;
  padding: 10px 12px; border-radius: 8px;
`;
const MetaRow = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
`;
const MetaChip = styled.span`
  font-size: 0.8rem; color: #adb5bd; /* 0.76rem -> 0.8rem */
  display: flex; align-items: center; gap: 3px; font-weight: 600;
`;
const SlotPips = styled.div` display: flex; gap: 4px; align-items: center; `;
const Pip = styled.span`
  display: inline-block; width: 11px; height: 11px; border-radius: 3px;
  border: 1.5px solid ${p => p.$taken ? '#f59f00' : '#dee2e6'};
  background: ${p => p.$taken ? '#fcc419' : '#fff'};
  transition: background 0.25s, border-color 0.25s;
`;

// 수락자 아바타 목록 (카드 하단 인라인)
const AcceptorRow = styled.div`
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid #f1f3f5; flex-wrap: wrap;
`;
const AcceptorChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.8rem; font-weight: 700; /* 0.75rem -> 0.8rem */
  padding: 4px 10px; border-radius: 20px;
  background: ${p =>
    p.$status === 'completed' ? '#d3f9d8' :
      p.$status === 'pending' ? '#e7f5ff' :
        p.$status === 'rejected' ? '#ffe3e3' :
          '#fff9db'};
  color: ${p =>
    p.$status === 'completed' ? '#2f9e44' :
      p.$status === 'pending' ? '#1c7ed6' :
        p.$status === 'rejected' ? '#fa5252' :
          '#e67700'};
  border: 1px solid ${p =>
    p.$status === 'completed' ? '#b2f2bb' :
      p.$status === 'pending' ? '#a5d8ff' :
        p.$status === 'rejected' ? '#ffc9c9' :
          '#ffe066'};
`;

const ActionBtn = styled.button`
  margin-left: auto;
  padding: 8px 18px; font-size: 0.85rem; font-weight: 800;
  border: none; border-radius: 10px; cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
  background: ${p =>
    p.$completed ? '#d3f9d8' :
      p.$pending ? '#e7f5ff' :
        p.$rejected ? '#ffe3e3' :
          p.$accepted ? '#fff9db' :
            p.$full ? '#f1f3f5' :
              '#fcc419'};
  color: ${p =>
    p.$completed ? '#2f9e44' :
      p.$pending ? '#1c7ed6' :
        p.$rejected ? '#fa5252' :
          p.$accepted ? '#e67700' :
            p.$full ? '#adb5bd' :
              '#7a4d00'};
  &:hover:not(:disabled) { filter: brightness(0.95); transform: translateY(-1px); }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
`;

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────
const ModalOverlay = styled.div`
  display: ${p => p.$open ? 'flex' : 'none'};
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  z-index: 200; align-items: center; justify-content: center; padding: 1rem;
`;
const Modal = styled.div`
  background: #fff; border-radius: 20px; padding: 28px 24px 20px;
  max-width: 400px; width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  animation: ${popIn} 0.2s ease-out;
`;
const ModalBadge = styled.div`
  display: inline-flex; align-items: center; gap: 5px;
  background: #fff3bf; border: 1px solid #ffe066; border-radius: 8px;
  padding: 4px 10px; font-size: 0.72rem; font-weight: 800;
  color: #e67700; letter-spacing: 1px; margin-bottom: 12px;
`;
const ModalTitle = styled.h2`
  font-size: 1.2rem; font-weight: 800; color: #343a40;
  margin: 0 0 10px; line-height: 1.35;
`;
const ModalDesc = styled.p`
  font-size: 0.9rem; color: #495057; line-height: 1.65;
  background: #f8f9fa; border-radius: 10px;
  padding: 12px; margin: 0 0 14px; white-space: pre-wrap;
`;
const ModalRewardBox = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  background: #fffbf0; border: 1px solid #ffe8a1;
  border-radius: 10px; padding: 10px 14px; margin-bottom: 10px;
`;
const ModalRewardLabel = styled.span` font-size: 0.82rem; color: #adb5bd; font-weight: 500; `;
const ModalRewardValue = styled.span` font-size: 1.25rem; font-weight: 800; color: #f59f00; `;
const ModalSlots = styled.p`
  font-size: 0.82rem; color: #adb5bd; margin: 0 0 14px;
  strong { color: #1c7ed6; }
`;

// 수락자 목록 (모달 내)
const AcceptorList = styled.div`
  border: 1px solid #f1f3f5; border-radius: 10px;
  overflow: hidden; margin-bottom: 16px;
`;
const AcceptorListHeader = styled.div`
  background: #f8f9fa; padding: 8px 12px;
  font-size: 0.78rem; font-weight: 700; color: #868e96;
`;
const AcceptorItem = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-top: 1px solid #f1f3f5;
  font-size: 0.88rem; gap: 8px;
`;
const StatusDot = styled.span`
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  background: ${p =>
    p.$status === 'completed' ? '#2f9e44' :
      p.$status === 'pending' ? '#1c7ed6' :
        p.$status === 'rejected' ? '#fa5252' :
          '#fcc419'};
`;

const ModalBtn = styled.button`
  display: block; width: 100%; padding: 12px;
  border: none; border-radius: 12px;
  font-size: 0.95rem; font-weight: 800; cursor: pointer;
  transition: filter 0.15s; margin-bottom: 8px;
  background: ${p => p.$variant === 'cancel' ? 'none' : p.$variant === 'danger' ? 'none' : p.$variant === 'complete' ? '#e7f5ff' : '#fcc419'};
  color: ${p => p.$variant === 'cancel' ? '#adb5bd' : p.$variant === 'danger' ? '#fa5252' : p.$variant === 'complete' ? '#1c7ed6' : '#7a4d00'};
  border: ${p => (p.$variant === 'cancel' || p.$variant === 'danger') ? '1px solid #dee2e6' : 'none'};
  opacity: ${p => p.disabled ? 0.6 : 1};
  cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
  &:hover:not(:disabled) { filter: brightness(0.96); }
`;

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────
const Wrapper = styled.div` margin-bottom: 2rem; `;

const QuestFilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.5rem; /* 미션 섹션과 간격 통일 */
  min-height: 38px;      /* 버튼이 사라져도 레이아웃 유지 */
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
  const [modalQuest, setModalQuest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAllQuests, setShowAllQuests] = useState(false);
  const [questSubmission, setQuestSubmission] = useState({ text: '', photos: [] });

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
      // 모달이 열려 있으면 최신 데이터로 동기화
      setModalQuest(prev => {
        if (!prev) return null;
        return data.find(q => q.id === prev.id) || null;
      });
    });
  }, [classId]);

  // 부모에 퀘스트 수 전달 — ref로 콜백을 저장해 무한 루프 방지
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

  // 내가 완료한 퀘스트
  const myCompletedQuests = quests.filter(q => {
    const myAcceptor = getMyAcceptor(q);
    return myAcceptor?.completionStatus === 'completed';
  });

  // 모든 수락자가 completed인 퀘스트 (전원 완료 — 기본 목록에서 숨김)
  const allAcceptorsCompletedQuests = quests.filter(q => {
    const acceptors = q.acceptors || [];
    if (acceptors.length === 0) return false;
    const maxSlots = q.maxAcceptors || 1;
    // 슬롯이 꽉 찼고, 모든 수락자가 completed 상태인 경우
    return acceptors.length >= maxSlots && acceptors.every(a => a.completionStatus === 'completed');
  });

  const hiddenCount = allAcceptorsCompletedQuests.length;

  const visibleQuests = showAllQuests
    ? quests
    : quests.filter(q => {
      // 내가 완료한 퀘스트도 숨김
      const myAcceptor = getMyAcceptor(q);
      if (myAcceptor?.completionStatus === 'completed') return false;
      // 전원 완료된 퀘스트도 숨김
      const acceptors = q.acceptors || [];
      const maxSlots = q.maxAcceptors || 1;
      if (acceptors.length >= maxSlots && acceptors.every(a => a.completionStatus === 'completed')) return false;
      return true;
    });

  // ── 수락 ──
  const handleAccept = async () => {
    if (!modalQuest || !myPlayer || loading) return;
    setLoading(true);
    try {
      const result = await acceptQuest(classId, modalQuest.id, myPlayer);
      if (result === 'full') alert('아쉽게도 이미 마감됐어요. 다음 기회에 도전해보세요!');
      else if (result === 'already') alert('이미 수락한 퀘스트예요.');
      // 성공이면 onSnapshot이 모달 상태를 자동 갱신
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
            const status = myAcceptor?.completionStatus; // 'accepted' | 'pending' | 'completed' | 'rejected'
            const clickable = !full && !accepted;
            const takenCount = (quest.acceptors || []).length;
            const maxSlots = quest.maxAcceptors || 1;

            return (
              <QuestCard
                key={quest.id}
                $accepted={accepted && status === 'accepted'}
                $pending={status === 'pending'}
                $completed={status === 'completed'}
                $rejected={status === 'rejected'}
                $full={full && !accepted}
                $clickable={clickable}
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => { setModalQuest(quest); setQuestSubmission({ text: '', photos: [] }); }}
              >
                <CardInner>
                  <TopRow>
                    <div>
                      <TitleRow>
                        <span>⚔</span>
                        {quest.title}
                        {!full && !accepted && <Tag $bg="#fff0f6" $color="#c2255c">NEW</Tag>}
                        {full && !accepted && <Tag $bg="#f1f3f5" $color="#adb5bd">마감</Tag>}
                        {status === 'pending' && <Tag $bg="#e7f5ff" $color="#1c7ed6">승인 대기</Tag>}
                        {status === 'completed' && <Tag $bg="#d3f9d8" $color="#2f9e44">완료</Tag>}
                        {status === 'rejected' && <Tag $bg="#ffe3e3" $color="#fa5252">반려됨</Tag>}
                        <Tag $bg="#e7f5ff" $color="#1c7ed6">{maxSlots - takenCount}/{maxSlots} 자리</Tag>
                      </TitleRow>
                    </div>
                    <Reward>
                      💰 {quest.reward}P{quest.heartReward > 0 ? ` · ❤️ ${quest.heartReward}` : ''}
                    </Reward>
                  </TopRow>

                  {quest.description && <Desc>{quest.description}</Desc>}

                  <MetaRow>
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
                      onClick={(e) => { e.stopPropagation(); setModalQuest(quest); }}
                    >
                      {status === 'completed' ? '✓ 완료됨' :
                        status === 'pending' ? '⏳ 승인 대기' :
                          status === 'rejected' ? '↩ 재제출하기' :
                            accepted ? '완료 요청' :
                              full ? '마감됨' : '수락하기'}
                    </ActionBtn>
                  </MetaRow>

                  {/* 수락자 인라인 표시 */}
                  {takenCount > 0 && (
                    <AcceptorRow>
                      <MetaChip style={{ marginRight: 2 }}>수락:</MetaChip>
                      {(quest.acceptors || []).map(a => (
                        <AcceptorChip
                          key={a.playerId}
                          $status={a.completionStatus}
                          style={{
                            cursor: isAdmin && a.completionStatus !== 'completed' ? 'pointer' : 'default',
                            transition: 'filter 0.15s',
                          }}
                          title={isAdmin && a.completionStatus !== 'completed' ? '클릭하여 즉시 완료 처리' : undefined}
                          onClick={isAdmin && a.completionStatus !== 'completed'
                            ? (e) => { e.stopPropagation(); handleForceComplete(quest, a); }
                            : undefined
                          }
                          onMouseOver={e => { if (isAdmin && a.completionStatus !== 'completed') e.currentTarget.style.filter = 'brightness(0.88)'; }}
                          onMouseOut={e => { e.currentTarget.style.filter = 'none'; }}
                        >
                          <StatusDot $status={a.completionStatus} />
                          {a.playerName}
                          {isAdmin && a.completionStatus !== 'completed' && <span style={{ fontSize: '0.68rem', opacity: 0.7 }}> ✓</span>}
                        </AcceptorChip>
                      ))}
                    </AcceptorRow>
                  )}
                </CardInner>
              </QuestCard>
            );
          })}
        </QuestList>
      )}

      {/* ── 모달 ── */}
      <ModalOverlay $open={!!modalQuest} onClick={(e) => { if (e.target === e.currentTarget) setModalQuest(null); }}>
        {modalQuest && (() => {
          const myAcceptor = getMyAcceptor(modalQuest);
          const accepted = !!myAcceptor;
          const status = myAcceptor?.completionStatus;
          const full = isFull(modalQuest);
          const takenCount = (modalQuest.acceptors || []).length;
          const maxSlots = modalQuest.maxAcceptors || 1;
          const acceptors = modalQuest.acceptors || [];
          return (
            <Modal onClick={(e) => e.stopPropagation()}>
              <ModalBadge>⚔ 공공 퀘스트</ModalBadge>
              <ModalTitle>{modalQuest.title}</ModalTitle>
              {modalQuest.description && <ModalDesc>{modalQuest.description}</ModalDesc>}

              <ModalRewardBox>
                <ModalRewardLabel>🪙 완료 보상 (완료 후 지급)</ModalRewardLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ModalRewardValue>{modalQuest.reward}P</ModalRewardValue>
                  {modalQuest.heartReward > 0 && (
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fa5252' }}>
                      + ❤️ {modalQuest.heartReward}
                    </span>
                  )}
                </div>
              </ModalRewardBox>

              <ModalSlots>
                남은 자리 <strong>{maxSlots - takenCount}/{maxSlots}</strong>
                {modalQuest.submissionType && <> · {getSubmissionLabel(modalQuest.submissionType)}</>}
                {modalQuest.deadline && <> · 🕐 {modalQuest.deadline}</>}
              </ModalSlots>

              {/* 수락자 목록 */}
              {acceptors.length > 0 && (
                <AcceptorList>
                  <AcceptorListHeader>수락한 학생</AcceptorListHeader>
                  {acceptors.map(a => (
                    <AcceptorItem key={a.playerId}>
                      <StatusDot $status={a.completionStatus} />
                      <span style={{ fontWeight: 600 }}>{a.playerName}</span>
                      <span style={{
                        marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700,
                        color: a.completionStatus === 'completed' ? '#2f9e44' :
                          a.completionStatus === 'pending' ? '#1c7ed6' : '#e67700'
                      }}>
                        {statusLabel(a.completionStatus)}
                      </span>
                    </AcceptorItem>
                  ))}
                </AcceptorList>
              )}

              {/* 버튼 — 내 상태에 따라 분기 */}
              {!accepted && !full && (
                <ModalBtn onClick={handleAccept} disabled={loading}>
                  {loading ? '처리 중...' : '⚔ 퀘스트 수락하기'}
                </ModalBtn>
              )}
              {!accepted && full && (
                <ModalBtn disabled>이미 마감된 퀘스트예요</ModalBtn>
              )}
              {accepted && status === 'accepted' && (() => {
                const submissionType = modalQuest.submissionType || ['simple'];
                const requiresText = Array.isArray(submissionType) ? submissionType.includes('text') : submissionType === 'text';
                const requiresPhoto = Array.isArray(submissionType) ? submissionType.includes('photo') : submissionType === 'photo';
                const isSubmissionRequired = requiresText || requiresPhoto;
                return (
                  <>
                    {isSubmissionRequired && (
                      <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            <label htmlFor="quest-photo-upload" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', background: '#fff', border: '1px dashed #adb5bd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#495057', fontWeight: 600 }}>
                              <span>📸</span>
                              <span>사진 추가하기 {questSubmission.photos.length > 0 ? `(${questSubmission.photos.length}장)` : ''}</span>
                              <input id="quest-photo-upload" type="file" accept="image/*" multiple style={{ display: 'none' }}
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
                    <ModalBtn $variant="complete" onClick={() => handleRequestComplete(modalQuest.id)} disabled={loading}>
                      ✅ 완료 요청하기 (선생님 승인 후 포인트 지급)
                    </ModalBtn>
                    <ModalBtn $variant="danger" onClick={() => handleCancelAccept(modalQuest.id)}>
                      수락 취소하기
                    </ModalBtn>
                  </>
                );
              })()}
              {accepted && status === 'rejected' && (() => {
                const submissionType = modalQuest.submissionType || ['simple'];
                const requiresText = Array.isArray(submissionType) ? submissionType.includes('text') : submissionType === 'text';
                const requiresPhoto = Array.isArray(submissionType) ? submissionType.includes('photo') : submissionType === 'photo';
                const isSubmissionRequired = requiresText || requiresPhoto;
                return (
                  <>
                    {/* 반려 사유 표시 */}
                    <div style={{ background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '0.78rem', fontWeight: 700, color: '#fa5252' }}>✗ 완료 요청이 반려됐어요</p>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#495057' }}>
                        {myAcceptor?.rejectedReason ? `사유: ${myAcceptor.rejectedReason}` : '선생님이 반려 사유를 남기지 않았어요.'}
                      </p>
                    </div>
                    {isSubmissionRequired && (
                      <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            <label htmlFor="quest-photo-upload-retry" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', background: '#fff', border: '1px dashed #adb5bd', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#495057', fontWeight: 600 }}>
                              <span>📸</span>
                              <span>사진 추가하기 {questSubmission.photos.length > 0 ? `(${questSubmission.photos.length}장)` : ''}</span>
                              <input id="quest-photo-upload-retry" type="file" accept="image/*" multiple style={{ display: 'none' }}
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
                    <ModalBtn $variant="complete" onClick={() => handleRequestComplete(modalQuest.id)} disabled={loading}>
                      ↩ 다시 완료 요청하기
                    </ModalBtn>
                    <ModalBtn $variant="danger" onClick={() => handleCancelAccept(modalQuest.id)}>
                      퀘스트 포기하기
                    </ModalBtn>
                  </>
                );
              })()}
              {accepted && status === 'pending' && (
                <ModalBtn disabled $variant="complete">
                  ⏳ 선생님의 승인을 기다리는 중이에요
                </ModalBtn>
              )}
              {accepted && status === 'completed' && (
                <ModalBtn disabled style={{ background: '#d3f9d8', color: '#2f9e44' }}>
                  ✓ 완료! 포인트가 지급됐어요
                </ModalBtn>
              )}
              <ModalBtn $variant="cancel" onClick={() => setModalQuest(null)}>닫기</ModalBtn>
            </Modal>
          );
        })()}
      </ModalOverlay>
    </Wrapper>
  );
}