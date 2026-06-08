// src/components/CommentReportModal.jsx
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { reportComment, getCommentReportStatus } from '../api/firebase';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth } from '../api/firebase';

const fadeIn = keyframes`from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); }`;

const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1rem;
`;
const Modal = styled.div`
  background: #fff; border-radius: 16px; padding: 2rem;
  width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${fadeIn} 0.2s ease;
`;
const ModalTitle = styled.h3`
  margin: 0 0 0.5rem; font-size: 1.25rem; color: #212529;
  display: flex; align-items: center; gap: 0.5rem;
`;
const SubTitle = styled.p`margin: 0 0 1.5rem; font-size: 0.85rem; color: #6c757d;`;
const CommentPreview = styled.div`
  background: #f8f9fa; border-left: 4px solid #dee2e6;
  padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1.5rem;
  font-size: 0.9rem; color: #495057; font-style: italic;
  white-space: pre-wrap; word-break: break-all;
`;
const ReasonList = styled.div`display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem;`;
const ReasonItem = styled.label`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; border-radius: 10px; cursor: pointer;
  border: 2px solid ${p => p.$selected ? '#e03131' : '#dee2e6'};
  background: ${p => p.$selected ? '#fff5f5' : '#fff'};
  transition: all 0.15s; font-size: 0.95rem;
  &:hover { border-color: #ffa8a8; background: #fff5f5; }
  input { display: none; }
`;
const ReasonIcon = styled.span`font-size: 1.2rem;`;
const CustomInput = styled.textarea`
  width: 100%; box-sizing: border-box; padding: 0.75rem;
  border: 1px solid #ced4da; border-radius: 8px; font-size: 0.9rem;
  resize: vertical; min-height: 80px; font-family: inherit;
  &:focus { outline: none; border-color: #e03131; box-shadow: 0 0 0 3px rgba(224,49,49,0.15); }
`;
const ButtonRow = styled.div`display: flex; gap: 0.75rem; margin-top: 1.5rem;`;
const CancelBtn = styled.button`
  flex: 1; padding: 0.75rem; border: 1px solid #dee2e6; background: #fff;
  border-radius: 10px; font-size: 0.95rem; cursor: pointer; color: #495057;
  &:hover { background: #f8f9fa; }
`;
const SubmitBtn = styled.button`
  flex: 2; padding: 0.75rem; border: none;
  background: ${p => p.$disabled ? '#ced4da' : '#e03131'};
  color: #fff; border-radius: 10px; font-size: 0.95rem; font-weight: bold;
  cursor: ${p => p.$disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.15s;
  &:hover { background: ${p => p.$disabled ? '#ced4da' : '#c92a2a'}; }
`;

// 이미 신고된 상태 안내 박스
const AlreadyReportedBox = styled.div`
  background: ${p => p.$dismissed ? '#f8f9fa' : '#fff3bf'};
  border: 1.5px solid ${p => p.$dismissed ? '#dee2e6' : '#f59f00'};
  border-radius: 10px; padding: 1.2rem; text-align: center;
  margin-bottom: 1.5rem;
  p { margin: 0.5rem 0 0; font-size: 0.88rem; color: #495057; }
`;
const StatusIcon = styled.div`font-size: 2.5rem; margin-bottom: 0.5rem;`;
const StatusMsg = styled.div`font-weight: 800; font-size: 1rem;
  color: ${p => p.$dismissed ? '#868e96' : p.$resolved ? '#37b24d' : '#e67700'};
`;

const REASONS = [
  { id: 'spam', icon: '📢', label: '도배성 댓글', desc: '같은 내용 반복, 하트 구걸 등' },
  { id: 'abuse', icon: '😡', label: '모욕성 댓글', desc: '욕설, 비하, 혐오 표현 포함' },
  { id: 'other', icon: '✏️', label: '기타', desc: '직접 사유 입력' },
];

function CommentReportModal({ comment, targetType, submissionId, roomId, onClose }) {
  const { players } = useLeagueStore();
  const { classId } = useClassStore();
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // 중복 신고 상태: null(로딩중) | false(신고없음) | { status }
  const [existingReport, setExistingReport] = useState(null);
  const [checkingReport, setCheckingReport] = useState(true);

  const myPlayer = players.find(p => p.authUid === auth.currentUser?.uid);

  // 마운트 시 이미 신고된 댓글인지 확인
  useEffect(() => {
    if (!classId || !comment?.id) { setCheckingReport(false); return; }
    getCommentReportStatus(classId, comment.id)
      .then(result => { setExistingReport(result); })
      .catch(() => { setExistingReport(false); })
      .finally(() => setCheckingReport(false));
  }, [classId, comment?.id]);

  const isValid = reason && (reason !== 'other' || customReason.trim().length > 2);

  const handleSubmit = async () => {
    if (!isValid || isSubmitting || !myPlayer) return;
    setIsSubmitting(true);
    try {
      await reportComment({
        classId,
        reporterId: myPlayer.id,
        reporterName: myPlayer.name,
        targetType,
        commentId: comment.id,
        commentText: comment.text,
        commenterName: comment.commenterName,
        commenterId: comment.commenterId,
        reason,
        customReason,
        submissionId: submissionId || null,
        roomId: roomId || null,
      });
      setDone(true);
    } catch (e) {
      alert('신고 접수 실패: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로딩 중
  if (checkingReport) {
    return (
      <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <Modal>
          <ModalTitle>🔔 댓글 신고</ModalTitle>
          <SubTitle style={{ textAlign: 'center', padding: '1rem 0' }}>신고 상태 확인 중...</SubTitle>
        </Modal>
      </Overlay>
    );
  }

  // 이미 신고된 댓글 (pending 또는 resolved)
  if (existingReport && existingReport.status !== 'dismissed') {
    const isPending = existingReport.status === 'pending';
    const isResolved = existingReport.status === 'resolved';
    return (
      <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <Modal>
          <ModalTitle>🔔 댓글 신고</ModalTitle>
          <CommentPreview>"{comment.text}"</CommentPreview>
          <AlreadyReportedBox>
            <StatusIcon>{isPending ? '⏳' : '✅'}</StatusIcon>
            <StatusMsg $resolved={isResolved}>
              {isPending ? '이미 신고된 댓글입니다' : '검토가 완료된 댓글입니다'}
            </StatusMsg>
            <p>
              {isPending
                ? '교사가 검토 중입니다. 처리 결과를 기다려 주세요.'
                : '교사가 이미 검토를 완료했습니다.'}
            </p>
          </AlreadyReportedBox>
          <ButtonRow>
            <SubmitBtn onClick={onClose}>확인</SubmitBtn>
          </ButtonRow>
        </Modal>
      </Overlay>
    );
  }

  // 무효 판정이 난 경우 → 재신고 허용하되 안내
  const wasDismissed = existingReport?.status === 'dismissed';

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal>
        {done ? (
          <>
            <ModalTitle>✅ 신고가 접수되었습니다</ModalTitle>
            <SubTitle>교사가 검토 후 조치합니다. 신고해 주셔서 감사합니다.</SubTitle>
            <ButtonRow><SubmitBtn onClick={onClose}>확인</SubmitBtn></ButtonRow>
          </>
        ) : (
          <>
            <ModalTitle>🔔 댓글 신고</ModalTitle>
            {wasDismissed ? (
              <AlreadyReportedBox $dismissed>
                <StatusIcon>🔍</StatusIcon>
                <StatusMsg $dismissed>이전 신고가 무효 처리된 댓글입니다</StatusMsg>
                <p>이전 신고가 무효 판정을 받았습니다. 새로운 사유로 재신고할 수 있습니다.</p>
              </AlreadyReportedBox>
            ) : (
              <SubTitle>신고 사유를 선택해 주세요. 허위 신고는 페널티가 부과될 수 있습니다.</SubTitle>
            )}

            <CommentPreview>"{comment.text}"</CommentPreview>

            <ReasonList>
              {REASONS.map(r => (
                <ReasonItem key={r.id} $selected={reason === r.id}>
                  <input type="radio" name="reason" value={r.id} onChange={() => setReason(r.id)} />
                  <ReasonIcon>{r.icon}</ReasonIcon>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{r.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#868e96' }}>{r.desc}</div>
                  </div>
                </ReasonItem>
              ))}
            </ReasonList>

            {reason === 'other' && (
              <CustomInput
                placeholder="신고 사유를 3자 이상 입력해 주세요..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                maxLength={200}
              />
            )}

            <ButtonRow>
              <CancelBtn onClick={onClose}>취소</CancelBtn>
              <SubmitBtn onClick={handleSubmit} $disabled={!isValid || isSubmitting}>
                {isSubmitting ? '접수 중...' : '신고하기'}
              </SubmitBtn>
            </ButtonRow>
          </>
        )}
      </Modal>
    </Overlay>
  );
}

export default CommentReportModal;
