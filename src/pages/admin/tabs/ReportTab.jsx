// src/pages/admin/tabs/ReportTab.jsx
// 댓글 신고 관리 탭 — 신고 목록 확인, 댓글 삭제, 포인트 조정/페널티

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import {
  listenCommentReports,
  updateCommentReportStatus,
  deleteReportedComment,
  adjustPlayerPoints,
} from '../../../api/firebase';
import { FullWidthSection, Section, SectionTitle, StyledButton } from '../Admin.style';

// ─── 스타일 ───────────────────────────────────────────────
const FilterBar = styled.div`
  display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;
`;
const FilterBtn = styled.button`
  padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
  border: 2px solid ${p => p.$active ? '#e03131' : '#dee2e6'};
  background: ${p => p.$active ? '#fff5f5' : '#fff'};
  color: ${p => p.$active ? '#e03131' : '#495057'};
  transition: all 0.15s;
  &:hover { border-color: #ffa8a8; }
`;
const BadgeCount = styled.span`
  display: inline-flex; align-items: center; justify-content: center;
  background: #e03131; color: #fff; border-radius: 50%; width: 18px; height: 18px;
  font-size: 0.72rem; font-weight: 700; margin-left: 0.35rem;
`;
const ReportCard = styled.div`
  background: #fff; border: 1px solid ${p => p.$status === 'pending' ? '#ffd8d8' : '#dee2e6'};
  border-left: 4px solid ${p =>
    p.$status === 'pending' ? '#e03131' :
    p.$status === 'resolved' ? '#37b24d' : '#868e96'};
  border-radius: 10px; padding: 1.2rem 1.4rem; margin-bottom: 1rem;
  box-shadow: ${p => p.$status === 'pending' ? '0 2px 8px rgba(224,49,49,0.08)' : 'none'};
`;
const ReportMeta = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
  font-size: 0.82rem; color: #868e96; margin-bottom: 0.75rem;
`;
const Tag = styled.span`
  padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.78rem; font-weight: 700;
  background: ${p => p.$color || '#f1f3f5'}; color: ${p => p.$textColor || '#495057'};
`;
const CommentBox = styled.div`
  background: #f8f9fa; border-left: 3px solid #ced4da;
  padding: 0.7rem 1rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.93rem; color: #343a40; font-style: italic;
  white-space: pre-wrap; word-break: break-all;
`;
const ActionRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.75rem;
`;
const Btn = styled.button`
  padding: 0.4rem 0.9rem; border-radius: 8px; font-size: 0.83rem; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
  background: ${p => p.$bg || '#f1f3f5'}; color: ${p => p.$color || '#343a40'};
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const PenaltyInput = styled.input`
  width: 80px; padding: 0.38rem 0.6rem; border: 1px solid #ced4da; border-radius: 8px;
  font-size: 0.83rem; text-align: center;
`;
const NoteInput = styled.input`
  flex: 1; min-width: 160px; padding: 0.38rem 0.7rem;
  border: 1px solid #ced4da; border-radius: 8px; font-size: 0.83rem;
`;
const StatusBadge = styled.span`
  padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700;
  background: ${p =>
    p.$s === 'pending' ? '#fff5f5' :
    p.$s === 'resolved' ? '#ebfbee' : '#f1f3f5'};
  color: ${p =>
    p.$s === 'pending' ? '#e03131' :
    p.$s === 'resolved' ? '#37b24d' : '#868e96'};
`;
const EmptyMsg = styled.p`text-align: center; color: #adb5bd; padding: 3rem 0; font-size: 1rem;`;

const REASON_LABEL = { spam: '📢 도배성', abuse: '😡 모욕성', other: '✏️ 기타' };
const REASON_COLOR = {
  spam:  { bg: '#fff3bf', text: '#e67700' },
  abuse: { bg: '#ffe3e3', text: '#c92a2a' },
  other: { bg: '#f3f0ff', text: '#6741d9' },
};
const TYPE_LABEL = { myroom: '마이룸', mission: '미션갤러리' };
const STATUS_LABEL = { pending: '처리 대기', resolved: '처리 완료', dismissed: '무효 처리' };

// ─── 단일 신고 카드 ───────────────────────────────────────
function ReportItem({ report, players, classId, navigate }) {
  const [note, setNote] = useState(report.adminNote || '');
  const [penalty, setPenalty] = useState(100);
  const [busy, setBusy] = useState(false);

  const commenter = players.find(p => p.id === report.commenterId);
  const reporter  = players.find(p => p.id === report.reporterId);

  const formatDate = (ts) => {
    if (!ts?.toDate) return '-';
    return ts.toDate().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDeleteComment = async () => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await deleteReportedComment(classId, report);
      await updateCommentReportStatus(classId, report.id, 'resolved', note || '댓글 삭제 처리');
    } catch (e) { alert('삭제 실패: ' + e.message); }
    setBusy(false);
  };

  const handleApplyPenalty = async () => {
    if (!commenter) return alert('학생 정보를 찾을 수 없습니다.');
    const amt = Number(penalty);
    if (!amt || amt <= 0) return alert('페널티 포인트를 입력하세요.');
    if (!window.confirm(`${commenter.name}에게 -${amt}P 페널티를 부과하시겠습니까?`)) return;
    setBusy(true);
    try {
      await adjustPlayerPoints(classId, commenter.id, -amt, note || `댓글 신고 페널티 (${REASON_LABEL[report.reason] || '기타'})`);
      await updateCommentReportStatus(classId, report.id, 'resolved', note || `${amt}P 페널티 부과`);
    } catch (e) { alert('페널티 실패: ' + e.message); }
    setBusy(false);
  };

  const handleMarkResolved = async () => {
    setBusy(true);
    try { await updateCommentReportStatus(classId, report.id, 'resolved', note); }
    catch (e) { alert('실패: ' + e.message); }
    setBusy(false);
  };

  const handleDismiss = async () => {
    if (!window.confirm('이 신고를 무효 처리하시겠습니까?')) return;
    setBusy(true);
    try { await updateCommentReportStatus(classId, report.id, 'dismissed', note); }
    catch (e) { alert('실패: ' + e.message); }
    setBusy(false);
  };

  const goToComment = () => {
    if (report.targetType === 'mission' && report.submissionId) {
      navigate(`/gallery?submissionId=${report.submissionId}`);
    } else if (report.targetType === 'myroom' && report.roomId) {
      navigate(`/my-room/${report.roomId}`);
    }
  };

  const rc = REASON_COLOR[report.reason] || {};

  return (
    <ReportCard $status={report.status}>
      <ReportMeta>
        <StatusBadge $s={report.status}>{STATUS_LABEL[report.status] || report.status}</StatusBadge>
        <Tag $color={rc.bg} $textColor={rc.text}>{REASON_LABEL[report.reason] || '기타'}</Tag>
        <Tag $color="#e3fafc" $textColor="#0c8599">{TYPE_LABEL[report.targetType] || report.targetType}</Tag>
        <span>신고자: <strong>{report.reporterName || reporter?.name || '알 수 없음'}</strong></span>
        <span>피신고자: <strong style={{ color: '#e03131' }}>{report.commenterName || commenter?.name || '알 수 없음'}</strong></span>
        <span style={{ marginLeft: 'auto' }}>{formatDate(report.createdAt)}</span>
      </ReportMeta>

      <CommentBox>"{report.commentText}"</CommentBox>

      {report.reason === 'other' && report.customReason && (
        <div style={{ fontSize: '0.83rem', color: '#6741d9', marginBottom: '0.5rem' }}>
          📝 기타 사유: {report.customReason}
        </div>
      )}

      {report.adminNote && report.status !== 'pending' && (
        <div style={{ fontSize: '0.82rem', color: '#37b24d', marginBottom: '0.5rem' }}>
          ✅ 처리 메모: {report.adminNote}
        </div>
      )}

      <ActionRow>
        {/* 원본 댓글 이동 */}
        <Btn $bg="#e3fafc" $color="#0c8599" onClick={goToComment}>🔍 원본 보기</Btn>

        {report.status === 'pending' && (
          <>
            {/* 댓글 삭제 */}
            <Btn $bg="#ffe3e3" $color="#c92a2a" onClick={handleDeleteComment} disabled={busy}>
              🗑️ 댓글 삭제
            </Btn>

            {/* 관리자 메모 */}
            <NoteInput
              placeholder="처리 메모 (선택)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            {/* 페널티 */}
            <PenaltyInput
              type="number"
              min={10}
              step={10}
              value={penalty}
              onChange={e => setPenalty(e.target.value)}
              title="차감 포인트"
            />
            <Btn $bg="#fff5f5" $color="#e03131" onClick={handleApplyPenalty} disabled={busy || !commenter}>
              ⚡ -{penalty}P 페널티
            </Btn>

            {/* 처리 완료(삭제 없이) */}
            <Btn $bg="#ebfbee" $color="#37b24d" onClick={handleMarkResolved} disabled={busy}>
              ✅ 처리 완료
            </Btn>

            {/* 무효 처리 */}
            <Btn $bg="#f1f3f5" $color="#868e96" onClick={handleDismiss} disabled={busy}>
              ✕ 무효
            </Btn>
          </>
        )}
      </ActionRow>
    </ReportCard>
  );
}

// ─── 메인 탭 ──────────────────────────────────────────────
function ReportTab() {
  const { classId } = useClassStore();
  const { players } = useLeagueStore();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'all' | 'pending' | 'resolved' | 'dismissed'

  useEffect(() => {
    if (!classId) return;
    const unsub = listenCommentReports(classId, setReports);
    return () => unsub();
  }, [classId]);

  const pendingCount = useMemo(() => reports.filter(r => r.status === 'pending').length, [reports]);

  const filtered = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter(r => r.status === filter);
  }, [reports, filter]);

  return (
    <FullWidthSection>
      <Section>
        <SectionTitle>
          🚨 댓글 신고 관리
          {pendingCount > 0 && <BadgeCount>{pendingCount}</BadgeCount>}
        </SectionTitle>

        <FilterBar>
          {[
            { key: 'pending',  label: '처리 대기' },
            { key: 'resolved', label: '처리 완료' },
            { key: 'dismissed',label: '무효' },
            { key: 'all',      label: '전체 보기' },
          ].map(f => (
            <FilterBtn key={f.key} $active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key === 'pending' && pendingCount > 0 && <BadgeCount>{pendingCount}</BadgeCount>}
            </FilterBtn>
          ))}
        </FilterBar>

        {filtered.length === 0
          ? <EmptyMsg>
              {filter === 'pending' ? '🎉 처리 대기 중인 신고가 없습니다!' : '신고 내역이 없습니다.'}
            </EmptyMsg>
          : filtered.map(report => (
              <ReportItem
                key={report.id}
                report={report}
                players={players}
                classId={classId}
                navigate={navigate}
              />
            ))
        }
      </Section>
    </FullWidthSection>
  );
}

export default ReportTab;
