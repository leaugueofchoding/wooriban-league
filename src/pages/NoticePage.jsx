// src/pages/NoticePage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import {
  listenNotices, createNotice, deleteNotice, uploadNoticeImage,
  markNoticeRead, listenNoticeReaders,
  addNoticeComment, deleteNoticeComment, listenNoticeComments,
  toggleNoticeHeart, listenNoticeHearts,
  listenNoticeVotes, toggleNoticeVote, finalizeNoticeVote // ✅ 추가됨
} from '../api/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import { filterProfanity } from '../utils/profanityFilter';

const DEFAULT_TABS = ['주간학습 안내', '공지사항', '식단표'];
const DEFAULT_TAB_CONFIG = { comment: true, heart: true };

const fadeIn = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const fadeInFull = keyframes`from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}`;

/* ─── 레이아웃 ──────────────────────────────────────────── */
const PageWrapper = styled.div`min-height:100vh;background:#f0f4ff;font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;padding-bottom:5rem;`;
const TopBar = styled.div`position:sticky;top:0;z-index:200;background:rgba(255,255,255,0.96);backdrop-filter:blur(14px);border-bottom:1px solid #e9ecef;box-shadow:0 1px 8px rgba(0,0,0,0.06);`;
const TopRow = styled.div`display:flex;align-items:center;gap:1rem;padding:0.85rem 1.6rem;`;
const BackBtn = styled.button`background:none;border:none;cursor:pointer;font-size:1.3rem;color:#495057;padding:0.2rem 0.5rem;border-radius:8px;&:hover{background:#f1f3f5;color:#228be6;}`;
const TopTitle = styled.h1`margin:0;font-size:1.2rem;font-weight:900;color:#1c1c1e;flex:1;display:flex;align-items:center;gap:0.5rem;`;
const WriteBtn = styled.button`background:linear-gradient(135deg,#4dabf7,#1971c2);color:white;border:none;border-radius:10px;padding:0.55rem 1.2rem;font-size:0.92rem;font-weight:800;cursor:pointer;transition:all 0.2s;&:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(25,113,194,.35);}`;
const ManageTabsBtn = styled.button`background:#f1f3f5;color:#495057;border:none;border-radius:10px;padding:0.5rem 0.9rem;font-size:0.88rem;font-weight:700;cursor:pointer;&:hover{background:#dee2e6;}`;
const TabRow = styled.div`display:flex;gap:0;overflow-x:auto;padding:0 1.6rem;border-top:1px solid #f1f3f5;scrollbar-width:none;&::-webkit-scrollbar{display:none;}`;
const TabBtn = styled.button`padding:0.75rem 1.2rem;font-size:0.92rem;font-weight:700;background:none;border:none;cursor:pointer;white-space:nowrap;color:${p => p.$active ? '#1971c2' : '#868e96'};border-bottom:3px solid ${p => p.$active ? '#1971c2' : 'transparent'};transition:all 0.15s;&:hover{color:#339af0;}`;
const Container = styled.div`max-width:820px;margin:0 auto;padding:1.5rem 1rem;`;
const EmptyState = styled.div`text-align:center;padding:6rem 0;color:#adb5bd;font-size:1.05rem;`;

/* ─── 카드 ──────────────────────────────────────────────── */
const NoticeCard = styled.div`background:white;border-radius:16px;box-shadow:0 2px 14px rgba(0,0,0,0.06);margin-bottom:0.75rem;overflow:hidden;animation:${fadeIn} 0.25s ease;border:1px solid #f1f3f5;transition:all 0.15s;&:hover{box-shadow:0 4px 20px rgba(0,0,0,0.11);}`;
const CardRow = styled.div`display:flex;align-items:center;gap:0.8rem;padding:1rem 1.2rem;cursor:pointer;&:hover{background:#fafafa;}`;
const ExpandIcon = styled.span`font-size:0.8rem;color:#adb5bd;flex-shrink:0;transition:transform 0.2s;transform:${p => p.$open ? 'rotate(90deg)' : 'rotate(0deg)'};display:inline-block;`;
const CardTitleText = styled.span`font-size:1rem;font-weight:800;color:#1c1c1e;flex:1;`;
const MetaRow = styled.div`font-size:0.78rem;color:#adb5bd;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-top:0.2rem;`;
const MetaTag = styled.span`background:#f1f3f5;border-radius:5px;padding:0.1rem 0.45rem;font-weight:700;color:#868e96;`;
const ActionRow = styled.div`display:flex;gap:0.4rem;align-items:center;flex-shrink:0;`;
const IconBtn = styled.button`background:none;border:none;cursor:pointer;color:#adb5bd;padding:0.3rem 0.4rem;border-radius:7px;font-size:0.95rem;&:hover{background:${p => p.$danger ? '#fff5f5' : '#f1f3f5'};color:${p => p.$danger ? '#fa5252' : '#339af0'};}`;

/* ─── 펼침 본문 ─────────────────────────────────────────── */
const CardBody = styled.div`border-top:1px solid #f1f3f5;padding:1rem 1.4rem 0.6rem;animation:${fadeIn} 0.2s ease;`;
const ContentText = styled.p`margin:0 0 0.8rem;font-size:0.96rem;color:#343a40;line-height:1.75;white-space:pre-wrap;word-break:break-word;`;
const ImgGrid = styled.div`display:grid;grid-template-columns:${p => p.$count === 1 ? '1fr' : 'repeat(auto-fill,minmax(260px,1fr))'};gap:0.7rem;margin-bottom:0.8rem;`;
const NoticeImg = styled.img`width:100%;max-height:${p => p.$single ? '640px' : '380px'};object-fit:contain;border-radius:10px;background:#f8f9fa;cursor:zoom-in;`;

/* ─── 하단 액션 바 (좋아요·읽음·댓글) ──────────────────── */
const ActionBar = styled.div`display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0 0.8rem;border-top:1px solid #f8f9fa;flex-wrap:wrap;`;
const HeartBtn = styled.button`display:flex;align-items:center;gap:0.3rem;background:none;border:none;cursor:pointer;font-size:0.88rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;color:${p => p.$active ? '#fa5252' : '#adb5bd'};background:${p => p.$active ? '#fff5f5' : 'transparent'};&:hover{background:#fff5f5;color:#fa5252;}`;
const ReadBadge = styled.button`display:flex;align-items:center;gap:0.3rem;background:none;border:none;cursor:pointer;font-size:0.82rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;color:#868e96;&:hover{background:#f1f3f5;color:#495057;}`;
const CommentToggleBtn = styled.button`display:flex;align-items:center;gap:0.3rem;background:none;border:none;cursor:pointer;font-size:0.82rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;color:#868e96;&:hover{background:#f1f3f5;color:#495057;}margin-left:auto;`;

/* ─── 댓글 영역 ─────────────────────────────────────────── */
const CommentsArea = styled.div`border-top:1px solid #f1f3f5;padding:0.8rem 1.4rem 1rem;animation:${fadeIn} 0.15s ease;`;
const CommentItem = styled.div`display:flex;gap:0.6rem;padding:0.45rem 0;`;
const CommentAuthor = styled.span`font-size:0.82rem;font-weight:800;color:#495057;white-space:nowrap;`;
const CommentText = styled.span`font-size:0.85rem;color:#343a40;line-height:1.5;flex:1;word-break:break-word;`;
const CommentInputRow = styled.div`display:flex;gap:0.5rem;margin-top:0.5rem;`;
const CommentInput = styled.input`flex:1;padding:0.55rem 0.9rem;border:1.5px solid #dee2e6;border-radius:10px;font-size:0.9rem;&:focus{border-color:#339af0;outline:none;}`;
const CommentSendBtn = styled.button`background:#1971c2;color:white;border:none;border-radius:10px;padding:0.55rem 1rem;font-size:0.88rem;font-weight:800;cursor:pointer;white-space:nowrap;&:hover{background:#1864ab;}`;

/* ─── 투표(Poll) UI 컴포넌트 ────────────────────────────── */
const PollContainer = styled.div`margin: 1rem 0; padding: 1.2rem; background: #f8f9fa; border-radius: 12px; border: 1px solid #e9ecef;`;
const PollTitle = styled.h4`margin: 0 0 0.8rem; font-size: 1.05rem; color: #1c1c1e; display: flex; align-items: center; justify-content: space-between;`;
const PollMeta = styled.span`font-size: 0.75rem; color: #868e96; font-weight: 700; background: #e9ecef; padding: 0.2rem 0.5rem; border-radius: 6px;`;
const PollOptionList = styled.div`display: flex; flex-direction: column; gap: 0.5rem;`;
const PollOptionBtn = styled.div`
  position: relative; width: 100%; text-align: left; background: white; border: 2px solid ${p => p.$selected ? '#339af0' : '#dee2e6'}; 
  border-radius: 8px; padding: 0.7rem 0.8rem; cursor: ${p => p.$disabled ? 'default' : 'pointer'}; transition: all 0.2s; overflow: hidden;
  &:hover { border-color: ${p => (p.$selected ? '#228be6' : (p.$disabled ? '#dee2e6' : '#adb5bd'))}; }
  opacity: ${p => (p.$disabled && !p.$selected) ? 0.7 : 1};
`;
const PollProgressBar = styled.div`position: absolute; top: 0; left: 0; bottom: 0; width: ${p => p.$percent}%; background: ${p => p.$selected ? '#e7f5ff' : '#f1f3f5'}; z-index: 1; transition: width 0.4s ease-out;`;
const PollOptionContent = styled.div`position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: #343a40; font-weight: ${p => p.$selected ? '800' : '500'};`;
const PollCheck = styled.span`color: #339af0; margin-right: 0.4rem; font-weight: bold;`;

/* ─── 모달 ────────────────────────────────────────────── */
const ModalOverlay = styled.div`position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:9500;padding:1rem;`;
const ModalCard = styled.div`background:white;border-radius:18px;padding:1.6rem;width:100%;max-width:440px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:${fadeIn} 0.2s ease;`;
const ModalTitle2 = styled.h3`margin:0 0 1rem;font-size:1.05rem;font-weight:900;`;

/* ─── 전체화면 뷰어 ─────────────────────────────────────── */
const FullscreenOverlay = styled.div`position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9800;display:flex;flex-direction:column;animation:${fadeInFull} 0.2s ease;`;
const FullscreenHeader = styled.div`display:flex;align-items:center;gap:1rem;padding:1rem 1.5rem;background:rgba(255,255,255,0.06);flex-shrink:0;`;
const FullscreenTitle = styled.h2`margin:0;font-size:1.15rem;font-weight:900;color:white;flex:1;`;
const CloseBtn2 = styled.button`background:rgba(255,255,255,0.12);border:none;color:white;border-radius:10px;padding:0.4rem 0.9rem;font-size:1rem;cursor:pointer;&:hover{background:rgba(255,255,255,0.22);}`;
const FullscreenBody = styled.div`flex:1;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:1rem;`;
const FullscreenImg = styled.img`max-width:min(820px,96vw);width:100%;border-radius:10px;object-fit:contain;cursor:zoom-in;box-shadow:0 4px 24px rgba(0,0,0,0.4);`;

const LightboxOverlay = styled.div`position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:1rem;`;
const LightboxImg = styled.img`max-width:98vw;max-height:96vh;object-fit:contain;border-radius:6px;`;
const LightboxClose = styled.button`position:fixed;top:1rem;right:1.2rem;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;font-size:1.4rem;cursor:pointer;border-radius:10px;padding:0.2rem 0.7rem;z-index:10000;`;

/* ─── 작성·수정·탭관리 모달 ─────────────────────────────── */
const WriteModal = styled.div`background:white;border-radius:20px;padding:1.8rem;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:${fadeIn} 0.2s ease;`;
const ModalTitleH2 = styled.h2`margin:0 0 1.2rem;font-size:1.15rem;font-weight:900;`;
const Label = styled.label`display:block;font-size:0.84rem;font-weight:800;color:#495057;margin:0.9rem 0 0.3rem;`;
const Input = styled.input`width:100%;padding:0.72rem 1rem;border:2px solid #dee2e6;border-radius:10px;font-size:1rem;box-sizing:border-box;&:focus{border-color:#339af0;outline:none;}`;
const Textarea = styled.textarea`width:100%;padding:0.72rem 1rem;border:2px solid #dee2e6;border-radius:10px;font-size:0.96rem;resize:vertical;min-height:100px;box-sizing:border-box;line-height:1.6;&:focus{border-color:#339af0;outline:none;}`;
const UploadZone = styled.label`display:flex;flex-direction:column;align-items:center;gap:0.4rem;border:2px dashed #ced4da;border-radius:12px;padding:1rem;margin-top:0.4rem;cursor:pointer;color:#868e96;font-size:0.87rem;transition:all 0.2s;&:hover{border-color:#339af0;color:#339af0;background:#f0f8ff;}`;
const PreviewGrid = styled.div`display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.7rem;`;
const Thumb = styled.div`position:relative;width:74px;height:74px;`;
const ThumbImg = styled.img`width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid #dee2e6;`;
const ThumbRemove = styled.button`position:absolute;top:-7px;right:-7px;background:#fa5252;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:0.68rem;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
const BtnRow = styled.div`display:flex;gap:0.7rem;margin-top:1.5rem;`;
const SubmitBtn = styled.button`flex:1;padding:0.82rem;border:none;border-radius:10px;background:linear-gradient(135deg,#4dabf7,#1971c2);color:white;font-size:0.97rem;font-weight:800;cursor:pointer;&:disabled{background:#adb5bd;cursor:not-allowed;}`;
const CancelBtn = styled.button`flex:1;padding:0.82rem;border:none;border-radius:10px;background:#f1f3f5;color:#495057;font-size:0.97rem;font-weight:700;cursor:pointer;&:hover{background:#e9ecef;}`;
const TabItem = styled.div`display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0.8rem;background:#f8f9fa;border-radius:8px;margin-bottom:0.5rem;`;
const TabNameInput = styled.input`flex:1;padding:0.4rem 0.7rem;border:1.5px solid #dee2e6;border-radius:7px;font-size:0.92rem;font-weight:700;&:focus{border-color:#339af0;outline:none;}`;
const ToggleSwitch = styled.button`padding:0.25rem 0.55rem;font-size:0.75rem;font-weight:800;border-radius:6px;border:none;cursor:pointer;background:${p => p.$on ? '#d3f9d8' : '#ffe3e3'};color:${p => p.$on ? '#2b8a3e' : '#c92a2a'};`;
const PollSetupCard = styled.div`background:#f8f9fa;border:1px solid #dee2e6;border-radius:12px;padding:1rem;margin-top:0.5rem;`;
const OptionInputRow = styled.div`display:flex;gap:0.4rem;margin-bottom:0.4rem;`;

/* ─── 인라인 소셜/투표 서브컴포넌트 ──────────────────────────── */
function NoticeInlineFeatures({ classId, notice, myPlayerData, tabConfig, isTeacher, players }) {
  const [hearts, setHearts] = useState([]);
  const [comments, setComments] = useState([]);
  const [readers, setReaders] = useState([]);
  const [votes, setVotes] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReaders, setShowReaders] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [showVotersOptionIdx, setShowVotersOptionIdx] = useState(null);

  const heartOn = tabConfig?.heart !== false;
  const commentOn = tabConfig?.comment !== false;
  const myId = myPlayerData?.id;

  // 기한 초과 여부 확인 (현재 시간과 비교)
  const isTimeOver = notice.poll?.deadline ? new Date() > new Date(notice.poll.deadline) : false;
  const isPollClosed = notice.poll?.isClosed || isTimeOver;

  // 내가 낸 표 찾기
  const myVote = votes.find(v => v.playerId === myId);
  const isVoterFinalized = myVote?.isFinalized || false;

  useEffect(() => {
    if (!heartOn) return;
    return listenNoticeHearts(classId, notice.id, setHearts);
  }, [classId, notice.id, heartOn]);

  useEffect(() => {
    if (!commentOn) return;
    return listenNoticeComments(classId, notice.id, setComments);
  }, [classId, notice.id, commentOn]);

  useEffect(() => {
    return listenNoticeReaders(classId, notice.id, setReaders);
  }, [classId, notice.id]);

  useEffect(() => {
    if (!notice.poll) return;
    return listenNoticeVotes(classId, notice.id, setVotes);
  }, [classId, notice.id, notice.poll]);

  const handleHeart = async (e) => {
    e.stopPropagation();
    await toggleNoticeHeart(classId, notice.id, myId);
  };

  const handleSendComment = async (e) => {
    e.stopPropagation();
    if (!commentInput.trim() || isSendingComment) return;
    const filtered = filterProfanity(commentInput.trim());
    if (filtered.includes('*')) return alert('부적절한 단어가 포함된 댓글은 등록할 수 없습니다.');
    setIsSendingComment(true);
    try {
      await addNoticeComment(classId, notice.id, myId, myPlayerData.name, filtered);
      setCommentInput('');
    } finally { setIsSendingComment(false); }
  };

  const handleVote = async (optionIdx, e) => {
    e.stopPropagation();
    if (isPollClosed) return alert('이미 마감된 투표입니다.');
    if (isVoterFinalized) return alert('이미 투표 제출을 완료하셨습니다.');
    try {
      await toggleNoticeVote(classId, notice.id, myId, optionIdx, notice.poll.multiple);
    } catch (err) { alert('투표 처리 중 오류가 발생했습니다.'); }
  };

  const handleFinalizeVote = async (e) => {
    e.stopPropagation();
    if (!window.confirm('선택하신 항목으로 투표를 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.')) return;
    try {
      await finalizeNoticeVote(classId, notice.id, myId);
    } catch (err) { alert('제출 중 오류가 발생했습니다.'); }
  };

  const formatDeadlineText = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}시 ${String(d.getMinutes()).padStart(2, '0')}분`;
  };

  const iHearted = hearts.includes(myId);

  // 투표 집계 로직
  const totalVotes = votes.length;
  const voteCounts = {};
  if (notice.poll) {
    notice.poll.options.forEach((_, i) => voteCounts[i] = 0);
    votes.forEach(v => {
      if (Array.isArray(v.options)) {
        v.options.forEach(opt => { if (voteCounts[opt] !== undefined) voteCounts[opt]++; });
      }
    });
  }

  const getMySelectedOptions = () => {
    return myVote ? myVote.options : [];
  };

  return (
    <>
      {notice.poll && (
        <PollContainer onClick={e => e.stopPropagation()}>
          <PollTitle>
            <span>📊 투표: {notice.poll.title}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {notice.poll.anonymous && <PollMeta>익명</PollMeta>}
              {notice.poll.multiple && <PollMeta>복수선택</PollMeta>}

              {isPollClosed ? (
                <PollMeta style={{ background: '#ffe3e3', color: '#fa5252', marginLeft: '0.5rem' }}>마감됨</PollMeta>
              ) : (
                isTeacher && (
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm('정말로 이 투표를 마감 처리하시겠습니까?')) return;
                    await updateDoc(doc(db, 'classes', classId, 'notices', notice.id), { 'poll.isClosed': true });
                  }}
                    style={{ marginLeft: '0.5rem', background: '#495057', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    마감하기
                  </button>
                )
              )}
            </div>
          </PollTitle>

          {notice.poll.deadline && (
            <p style={{ fontSize: '0.8rem', color: isTimeOver ? '#fa5252' : '#868e96', margin: '-0.4rem 0 0.8rem 0', fontWeight: 600 }}>
              🕐 마감 기한: {formatDeadlineText(notice.poll.deadline)} {isTimeOver && '(시간 초과)'}
            </p>
          )}

          <PollOptionList>
            {notice.poll.options.map((opt, idx) => {
              const mySelections = getMySelectedOptions();
              const isSelected = mySelections.includes(idx);
              const count = voteCounts[idx] || 0;
              const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
              const isDisabled = isPollClosed || isVoterFinalized;

              return (
                <PollOptionBtn key={idx} $selected={isSelected} $disabled={isDisabled} onClick={(e) => handleVote(idx, e)}>
                  <PollProgressBar $percent={percent} $selected={isSelected} />
                  <PollOptionContent $selected={isSelected}>
                    <div>
                      {isSelected && <PollCheck>✓</PollCheck>}
                      <span>{opt}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{percent}%</span>
                      {count > 0 && !notice.poll.anonymous ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowVotersOptionIdx(idx); }}
                          style={{ background: 'none', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.7rem', padding: '0.1rem 0.3rem', cursor: 'pointer', zIndex: 10 }}
                        >{count}명 👤</button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({count}명)</span>
                      )}
                    </div>
                  </PollOptionContent>
                </PollOptionBtn>
              );
            })}
          </PollOptionList>

          {/* 학생 투표 완료 처리 영역 */}
          {!isTeacher && !isPollClosed && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              {isVoterFinalized ? (
                <span style={{ color: '#2b8a3e', fontSize: '0.9rem', fontWeight: 800, background: '#d3f9d8', padding: '0.4rem 1rem', borderRadius: '20px' }}>
                  ✅ 투표를 완료했습니다
                </span>
              ) : (
                <button
                  onClick={handleFinalizeVote}
                  disabled={getMySelectedOptions().length === 0}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 800, border: 'none',
                    background: getMySelectedOptions().length > 0 ? '#339af0' : '#e9ecef',
                    color: getMySelectedOptions().length > 0 ? 'white' : '#adb5bd',
                    cursor: getMySelectedOptions().length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  ✅ 투표 최종 제출 (이후 수정 불가)
                </button>
              )}
            </div>
          )}
        </PollContainer>
      )}

      <ActionBar onClick={e => e.stopPropagation()}>
        {heartOn && (
          <>
            <HeartBtn $active={iHearted} onClick={handleHeart}>
              {iHearted ? '❤️' : '🤍'} {hearts.length > 0 ? hearts.length : ''}
            </HeartBtn>
            {hearts.length > 0 && isTeacher && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  const names = hearts.map(id => players?.find(p => p.id === id)?.name || id).join('\n');
                  alert(`❤️ 하트를 눌러준 친구들 (${hearts.length}명):\n\n${names}`);
                }}
                style={{ background: 'none', border: '1px solid #ffc9c9', borderRadius: '7px', padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: '#fa5252', cursor: 'pointer', fontWeight: 700 }}
              >👁️</button>
            )}
          </>
        )}
        <ReadBadge onClick={() => setShowReaders(true)}>
          👁️ {readers.length}명 읽음
        </ReadBadge>
        {commentOn && (
          <CommentToggleBtn onClick={() => setShowComments(v => !v)}>
            💬 댓글 {comments.length > 0 ? comments.length : ''} {showComments ? '▲' : '▼'}
          </CommentToggleBtn>
        )}
      </ActionBar>

      {commentOn && showComments && (
        <CommentsArea onClick={e => e.stopPropagation()}>
          {comments.length === 0 && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#adb5bd', textAlign: 'center' }}>첫 댓글을 남겨보세요!</p>
          )}
          {comments.map(c => (
            <CommentItem key={c.id}>
              <CommentAuthor>{c.playerName}</CommentAuthor>
              <CommentText>{c.text}</CommentText>
              {(isTeacher || c.playerId === myId) && (
                <button onClick={() => deleteNoticeComment(classId, notice.id, c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#adb5bd', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
              )}
            </CommentItem>
          ))}
          <CommentInputRow>
            <CommentInput
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendComment(e)}
              placeholder="댓글 입력 후 Enter"
              maxLength={100}
            />
            <CommentSendBtn onClick={handleSendComment} disabled={isSendingComment}>전송</CommentSendBtn>
          </CommentInputRow>
        </CommentsArea>
      )}

      {/* 읽은 사람 명단 모달 */}
      {showReaders && (
        <ModalOverlay onClick={() => setShowReaders(false)}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <ModalTitle2>👁️ 읽은 사람 ({readers.length}명)</ModalTitle2>
            {readers.length === 0 ? (
              <p style={{ color: '#adb5bd', fontSize: '0.9rem' }}>아직 아무도 읽지 않았습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {readers.map(r => (
                  <span key={r.playerId} style={{ background: '#f1f3f5', borderRadius: '8px', padding: '0.3rem 0.7rem', fontSize: '0.85rem', fontWeight: 700, color: '#495057' }}>
                    {r.playerName}
                  </span>
                ))}
              </div>
            )}
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <CancelBtn style={{ maxWidth: '120px' }} onClick={() => setShowReaders(false)}>닫기</CancelBtn>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* 투표자 명단 모달 */}
      {showVotersOptionIdx !== null && notice.poll && (
        <ModalOverlay onClick={() => setShowVotersOptionIdx(null)}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <ModalTitle2>🗳️ "{notice.poll.options[showVotersOptionIdx]}" 투표자</ModalTitle2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {votes.filter(v => Array.isArray(v.options) && v.options.includes(showVotersOptionIdx)).map(v => {
                const voterName = players?.find(p => p.id === v.playerId)?.name || '알 수 없음';
                return (
                  <span key={v.playerId} style={{ background: '#e7f5ff', color: '#1971c2', borderRadius: '8px', padding: '0.3rem 0.7rem', fontSize: '0.85rem', fontWeight: 700 }}>
                    {voterName}
                  </span>
                );
              })}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <CancelBtn style={{ maxWidth: '120px' }} onClick={() => setShowVotersOptionIdx(null)}>닫기</CancelBtn>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}
    </>
  );
}

/* ─── 메인 컴포넌트 ─────────────────────────────────────── */
function NoticePage() {
  const navigate = useNavigate();
  const { classId } = useClassStore();
  const { currentUser, players } = useLeagueStore();
  const myPlayerData = players.find(p => p.authUid === currentUser?.uid);
  const isTeacher = myPlayerData?.role === 'admin';

  const [notices, setNotices] = useState([]);
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [tabConfigs, setTabConfigs] = useState({});
  const [activeTab, setActiveTab] = useState('전체');
  const [expandedId, setExpandedId] = useState(null);
  const [fullscreenNotice, setFullscreenNotice] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const [modalMode, setModalMode] = useState(null);
  const [editingNotice, setEditingNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', tab: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingUrls, setExistingUrls] = useState([]);

  // 투표 폼 상태
  const [includePoll, setIncludePoll] = useState(false);
  const [pollForm, setPollForm] = useState({ title: '', options: ['', ''], multiple: false, anonymous: false, deadline: '', isClosed: false });

  const [editingTabs, setEditingTabs] = useState([]);
  const [editingTabConfigs, setEditingTabConfigs] = useState({});
  const fileRef = useRef();

  // 탭 + 설정 로드
  useEffect(() => {
    if (!classId) return;
    getDoc(doc(db, 'classes', classId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.noticeTabs) setTabs(data.noticeTabs);
        if (data.noticeTabConfigs) setTabConfigs(data.noticeTabConfigs);
      }
    });
  }, [classId]);

  // 공지 구독
  useEffect(() => {
    if (!classId) return;
    return listenNotices(classId, setNotices);
  }, [classId]);

  // 탭 변경 시 최신 글 자동 펼침
  useEffect(() => {
    const list = activeTab === '전체' ? notices : notices.filter(n => n.tab === activeTab);
    setExpandedId(list.length > 0 ? list[0].id : null);
  }, [activeTab, notices]);

  // 펼칠 때 읽음 처리
  useEffect(() => {
    if (!expandedId || !myPlayerData?.id) return;
    markNoticeRead(classId, expandedId, myPlayerData.id, myPlayerData.name);
  }, [expandedId, classId, myPlayerData?.id]);

  const filteredNotices = activeTab === '전체' ? notices : notices.filter(n => n.tab === activeTab);
  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const openCreate = () => {
    const defaultTab = activeTab === '전체' ? (tabs[0] || '') : activeTab;
    setForm({ title: '', content: '', tab: defaultTab });
    setSelectedFiles([]); setPreviews([]); setExistingUrls([]);
    setIncludePoll(false);
    setPollForm({ title: '', options: ['', ''], multiple: false, anonymous: false, deadline: '', isClosed: false });
    setEditingNotice(null); setModalMode('create');
  };

  const openEdit = (notice, e) => {
    e.stopPropagation();
    setForm({ title: notice.title, content: notice.content || '', tab: notice.tab || tabs[0] || '' });
    setExistingUrls(notice.imageUrls || []);
    setSelectedFiles([]); setPreviews([]);
    if (notice.poll) {
      setIncludePoll(true);
      setPollForm({ ...notice.poll });
    } else {
      setIncludePoll(false);
      setPollForm({ title: '', options: ['', ''], multiple: false, anonymous: false, deadline: '', isClosed: false });
    }
    setEditingNotice(notice); setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditingNotice(null); };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedFiles(p => [...p, ...files]);
    files.forEach(f => { const r = new FileReader(); r.onload = ev => setPreviews(p => [...p, ev.target.result]); r.readAsDataURL(f); });
    e.target.value = '';
  };

  const handlePollOptionChange = (idx, val) => {
    const newOpts = [...pollForm.options];
    newOpts[idx] = val;
    setPollForm({ ...pollForm, options: newOpts });
  };

  const addPollOption = () => {
    if (pollForm.options.length >= 10) return alert('항목은 최대 10개까지만 추가할 수 있습니다.');
    setPollForm({ ...pollForm, options: [...pollForm.options, ''] });
  };

  const removePollOption = (idx) => {
    if (pollForm.options.length <= 2) return alert('항목은 최소 2개가 필요합니다.');
    const newOpts = pollForm.options.filter((_, i) => i !== idx);
    setPollForm({ ...pollForm, options: newOpts });
  };

  const handleSubmit = async () => {
    if (!form.content.trim() && selectedFiles.length === 0 && existingUrls.length === 0 && !includePoll) return alert('내용, 이미지 또는 투표를 추가해주세요.');
    const finalTitle = form.title.trim() || '제목없음';

    let finalPoll = null;
    if (includePoll) {
      const validOptions = pollForm.options.filter(o => o.trim() !== '');
      if (!pollForm.title.trim()) return alert('투표 제목을 입력해주세요.');
      if (validOptions.length < 2) return alert('유효한 투표 항목을 2개 이상 입력해주세요.');
      finalPoll = { ...pollForm, title: pollForm.title.trim(), options: validOptions, deadline: pollForm.deadline || null };
    }

    setIsSubmitting(true);
    try {
      const newUrls = [];
      for (const file of selectedFiles) newUrls.push(await uploadNoticeImage(classId, file));
      const finalUrls = [...existingUrls, ...newUrls];

      if (modalMode === 'create') {
        await createNotice(classId, myPlayerData.name, finalTitle, form.content.trim(), finalUrls, form.tab, finalPoll);
      } else {
        await updateDoc(doc(db, 'classes', classId, 'notices', editingNotice.id), {
          title: finalTitle, content: form.content.trim(), imageUrls: finalUrls, tab: form.tab, poll: finalPoll, updatedAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (e) { alert('저장 실패: ' + e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (notice, e) => {
    e.stopPropagation();
    if (!window.confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) return;
    try { await deleteNotice(classId, notice.id); } catch (e) { alert('삭제 실패: ' + e.message); }
  };

  const handleCardClick = (notice) => {
    if (expandedId === notice.id) setFullscreenNotice(notice);
    else setExpandedId(notice.id);
  };

  const openTabManager = () => {
    setEditingTabs([...tabs]);
    setEditingTabConfigs({ ...tabConfigs });
    setModalMode('tabs');
  };

  const handleSaveTabs = async () => {
    const cleaned = editingTabs.map(t => t.trim()).filter(Boolean);
    if (!cleaned.length) return alert('탭은 최소 1개 이상이어야 합니다.');
    setTabs(cleaned);
    setTabConfigs(editingTabConfigs);
    await updateDoc(doc(db, 'classes', classId), { noticeTabs: cleaned, noticeTabConfigs: editingTabConfigs });
    setModalMode(null);
  };

  const getTabCfg = (tabName) => tabConfigs[tabName] || DEFAULT_TAB_CONFIG;

  return (
    <PageWrapper>
      <TopBar>
        <TopRow>
          <BackBtn onClick={() => navigate(-1)}>←</BackBtn>
          <TopTitle>📢 공지사항</TopTitle>
          {isTeacher && <ManageTabsBtn onClick={openTabManager}>탭 관리 ⚙️</ManageTabsBtn>}
          {isTeacher && <WriteBtn onClick={openCreate}>+ 새 공지 작성</WriteBtn>}
        </TopRow>
        <TabRow>
          {['전체', ...tabs].map(tab => (
            <TabBtn key={tab} $active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab}
              {tab !== '전체' && (
                <span style={{ marginLeft: '0.3rem', fontSize: '0.72rem', background: activeTab === tab ? '#d0ebff' : '#f1f3f5', color: activeTab === tab ? '#1971c2' : '#adb5bd', borderRadius: '10px', padding: '0.05rem 0.4rem', fontWeight: 800 }}>
                  {notices.filter(n => n.tab === tab).length}
                </span>
              )}
            </TabBtn>
          ))}
        </TabRow>
      </TopBar>

      <Container>
        {filteredNotices.length === 0 ? (
          <EmptyState><div style={{ fontSize: '2.6rem', marginBottom: '0.8rem' }}>📭</div><div>아직 공지사항이 없습니다.</div></EmptyState>
        ) : filteredNotices.map(notice => {
          const isExpanded = expandedId === notice.id;
          const cfg = getTabCfg(notice.tab);
          return (
            <NoticeCard key={notice.id}>
              <CardRow onClick={() => handleCardClick(notice)}>
                <ExpandIcon $open={isExpanded}>▶</ExpandIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CardTitleText>{notice.title}</CardTitleText>
                  <MetaRow>
                    {notice.tab && <MetaTag style={{ background: '#e7f5ff', color: '#1971c2' }}>{notice.tab}</MetaTag>}
                    <span>{notice.authorName}</span>
                    <span>·</span>
                    <span>{formatDate(notice.createdAt)}</span>
                    {(notice.imageUrls || []).length > 0 && <MetaTag>📎 {notice.imageUrls.length}장</MetaTag>}
                    {notice.poll && <MetaTag style={{ background: '#fff9db', color: '#f08c00' }}>📊 투표</MetaTag>}
                    {isExpanded && <MetaTag style={{ background: '#f3f0ff', color: '#7048e8', cursor: 'pointer' }}>🔍 전체화면</MetaTag>}
                  </MetaRow>
                </div>
                {isTeacher && (
                  <ActionRow onClick={e => e.stopPropagation()}>
                    <IconBtn onClick={e => openEdit(notice, e)}>✏️</IconBtn>
                    <IconBtn $danger onClick={e => handleDelete(notice, e)}>🗑️</IconBtn>
                  </ActionRow>
                )}
              </CardRow>

              {isExpanded && (
                <CardBody>
                  {notice.content && <ContentText>{notice.content}</ContentText>}
                  {(notice.imageUrls || []).length > 0 && (
                    <ImgGrid $count={notice.imageUrls.length}>
                      {notice.imageUrls.map((url, i) => (
                        <NoticeImg key={i} src={url} alt={`이미지${i + 1}`} $single={notice.imageUrls.length === 1}
                          onClick={e => { e.stopPropagation(); setLightboxSrc(url); }} />
                      ))}
                    </ImgGrid>
                  )}

                  <NoticeInlineFeatures
                    classId={classId} notice={notice} myPlayerData={myPlayerData}
                    tabConfig={cfg} isTeacher={isTeacher} players={players}
                  />
                </CardBody>
              )}
            </NoticeCard>
          );
        })}
      </Container>

      {/* 전체화면 뷰어 */}
      {fullscreenNotice && (
        <FullscreenOverlay>
          <FullscreenHeader>
            <CloseBtn2 onClick={() => setFullscreenNotice(null)}>← 닫기</CloseBtn2>
            <div style={{ flex: 1 }}>
              <FullscreenTitle>{fullscreenNotice.title}</FullscreenTitle>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{fullscreenNotice.tab && `[${fullscreenNotice.tab}] · `}{fullscreenNotice.authorName} · {formatDate(fullscreenNotice.createdAt)}</span>
            </div>
          </FullscreenHeader>
          <FullscreenBody>
            {fullscreenNotice.content && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '820px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1rem 1.2rem', margin: 0 }}>{fullscreenNotice.content}</p>}
            {(fullscreenNotice.imageUrls || []).map((url, i) => (
              <FullscreenImg key={i} src={url} onClick={e => { e.stopPropagation(); setLightboxSrc(url); }} />
            ))}
          </FullscreenBody>
        </FullscreenOverlay>
      )}

      {lightboxSrc && (
        <LightboxOverlay onClick={() => setLightboxSrc(null)}>
          <LightboxClose onClick={() => setLightboxSrc(null)}>✕</LightboxClose>
          <LightboxImg src={lightboxSrc} onClick={e => e.stopPropagation()} />
        </LightboxOverlay>
      )}

      {/* 작성/수정 모달 */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <ModalOverlay onClick={closeModal}>
          <WriteModal onClick={e => e.stopPropagation()}>
            <ModalTitleH2>{modalMode === 'create' ? '📢 새 공지 작성' : '✏️ 공지 수정'}</ModalTitleH2>
            <Label>탭 선택</Label>
            <select value={form.tab} onChange={e => setForm(f => ({ ...f, tab: e.target.value }))}
              style={{ width: '100%', padding: '0.72rem 1rem', border: '2px solid #dee2e6', borderRadius: '10px', fontSize: '0.97rem', boxSizing: 'border-box', fontWeight: 700 }}>
              {tabs.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Label>제목</Label>
            <Input placeholder="제목 (비워두면 '제목없음'으로 저장)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Label>내용</Label>
            <Textarea placeholder="공지 내용 (선택)" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />

            {/* 투표 설정 영역 */}
            <div style={{ marginTop: '1.2rem', borderTop: '1px dashed #dee2e6', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Label style={{ margin: 0 }}>📊 투표 첨부</Label>
                <ToggleSwitch $on={includePoll} onClick={() => setIncludePoll(!includePoll)}>
                  {includePoll ? '사용 ON' : '사용 OFF'}
                </ToggleSwitch>
              </div>

              {includePoll && (
                <PollSetupCard>
                  <Input placeholder="투표 제목 (예: 회장 선거, 체육대회 종목)" value={pollForm.title} onChange={e => setPollForm({ ...pollForm, title: e.target.value })} style={{ marginBottom: '0.8rem', padding: '0.6rem', fontSize: '0.9rem' }} />

                  {/* 기한 설정 (날짜/시간 선택) */}
                  <Input type="datetime-local" value={pollForm.deadline || ''} onChange={e => setPollForm({ ...pollForm, deadline: e.target.value })} style={{ marginBottom: '0.8rem', padding: '0.6rem', fontSize: '0.9rem', color: pollForm.deadline ? '#1c1c1e' : '#adb5bd' }} />

                  {pollForm.options.map((opt, i) => (
                    <OptionInputRow key={i}>
                      <Input placeholder={`항목 ${i + 1}`} value={opt} onChange={e => handlePollOptionChange(i, e.target.value)} style={{ padding: '0.5rem', fontSize: '0.9rem' }} />
                      <button onClick={() => removePollOption(i)} style={{ background: '#ffe3e3', color: '#c92a2a', border: 'none', borderRadius: '8px', padding: '0 0.6rem', cursor: 'pointer' }}>✕</button>
                    </OptionInputRow>
                  ))}
                  <button onClick={addPollOption} style={{ width: '100%', padding: '0.5rem', background: 'white', border: '1px dashed #adb5bd', borderRadius: '8px', color: '#495057', cursor: 'pointer', marginTop: '0.2rem' }}>+ 항목 추가</button>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pollForm.multiple} onChange={e => setPollForm({ ...pollForm, multiple: e.target.checked })} /> 복수 선택 허용
                    </label>
                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pollForm.anonymous} onChange={e => setPollForm({ ...pollForm, anonymous: e.target.checked })} /> 익명 투표 (누가 했는지 비공개)
                    </label>
                  </div>
                </PollSetupCard>
              )}
            </div>

            <Label style={{ marginTop: '1.2rem' }}>이미지 첨부</Label>
            {existingUrls.length > 0 && <PreviewGrid>{existingUrls.map((url, i) => <Thumb key={`e${i}`}><ThumbImg src={url} /><ThumbRemove onClick={() => setExistingUrls(p => p.filter((_, idx) => idx !== i))}>✕</ThumbRemove></Thumb>)}</PreviewGrid>}
            {previews.length > 0 && <PreviewGrid style={{ marginTop: existingUrls.length ? '0.5rem' : '0.7rem' }}>{previews.map((src, i) => <Thumb key={`n${i}`}><ThumbImg src={src} /><ThumbRemove onClick={() => { setSelectedFiles(p => p.filter((_, idx) => idx !== i)); setPreviews(p => p.filter((_, idx) => idx !== i)); }}>✕</ThumbRemove></Thumb>)}</PreviewGrid>}
            <UploadZone htmlFor="notice-img" style={{ marginTop: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
              <span>이미지 추가 (여러 장 가능)</span>
            </UploadZone>
            <input id="notice-img" ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            <BtnRow><CancelBtn onClick={closeModal}>취소</CancelBtn><SubmitBtn onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? '저장 중...' : modalMode === 'create' ? '공지 등록' : '수정 완료'}</SubmitBtn></BtnRow>
          </WriteModal>
        </ModalOverlay>
      )}

      {/* 탭 관리 모달 */}
      {modalMode === 'tabs' && (
        <ModalOverlay onClick={() => setModalMode(null)}>
          <WriteModal onClick={e => e.stopPropagation()}>
            <ModalTitleH2>⚙️ 탭 관리</ModalTitleH2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#868e96' }}>탭별 댓글·하트 기능을 ON/OFF할 수 있습니다.</p>
            {editingTabs.map((tab, i) => {
              const cfg = editingTabConfigs[tab] || DEFAULT_TAB_CONFIG;
              return (
                <TabItem key={i}>
                  <span style={{ color: '#adb5bd', fontSize: '0.8rem', fontWeight: 800, minWidth: '1.2rem' }}>#{i + 1}</span>
                  <TabNameInput value={tab} onChange={e => {
                    const newName = e.target.value;
                    const oldCfg = editingTabConfigs[tab];
                    const newTabs = [...editingTabs]; newTabs[i] = newName;
                    setEditingTabs(newTabs);
                    if (oldCfg) {
                      const newCfgs = { ...editingTabConfigs }; delete newCfgs[tab]; newCfgs[newName] = oldCfg;
                      setEditingTabConfigs(newCfgs);
                    }
                  }} />
                  <ToggleSwitch $on={cfg.comment !== false} onClick={() => setEditingTabConfigs(c => ({ ...c, [tab]: { ...cfg, comment: cfg.comment === false } }))}>
                    💬{cfg.comment !== false ? 'ON' : 'OFF'}
                  </ToggleSwitch>
                  <ToggleSwitch $on={cfg.heart !== false} onClick={() => setEditingTabConfigs(c => ({ ...c, [tab]: { ...cfg, heart: cfg.heart === false } }))}>
                    ❤️{cfg.heart !== false ? 'ON' : 'OFF'}
                  </ToggleSwitch>
                  <button onClick={() => { setEditingTabs(p => p.filter((_, idx) => idx !== i)); const nc = { ...editingTabConfigs }; delete nc[tab]; setEditingTabConfigs(nc); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fa5252', fontSize: '1rem', padding: '0.2rem' }}>🗑️</button>
                </TabItem>
              );
            })}
            <button onClick={() => { const newTab = '새 탭'; setEditingTabs(p => [...p, newTab]); setEditingTabConfigs(c => ({ ...c, [newTab]: DEFAULT_TAB_CONFIG })); }}
              style={{ width: '100%', padding: '0.6rem', background: '#f1f3f5', border: '2px dashed #dee2e6', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, color: '#495057', marginTop: '0.3rem' }}>
              + 탭 추가
            </button>
            <BtnRow><CancelBtn onClick={() => setModalMode(null)}>취소</CancelBtn><SubmitBtn onClick={handleSaveTabs}>저장</SubmitBtn></BtnRow>
          </WriteModal>
        </ModalOverlay>
      )}
    </PageWrapper>
  );
}

export default NoticePage;