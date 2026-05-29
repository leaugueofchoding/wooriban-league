// src/pages/NoticePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { listenNotices, createNotice, deleteNotice, uploadNoticeImage } from '../api/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../api/firebase';

// ─── 애니메이션 ────────────────────────────────────────────
const fadeIn = keyframes`from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); }`;

// ─── 레이아웃 ──────────────────────────────────────────────
const PageWrapper = styled.div`
  min-height: 100vh;
  background: #f0f4ff;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
  padding-bottom: 5rem;
`;

const TopBar = styled.div`
  position: sticky; top: 0; z-index: 200;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid #e9ecef;
  display: flex; align-items: center; gap: 1rem;
  padding: 0.85rem 1.6rem;
  box-shadow: 0 1px 8px rgba(0,0,0,0.06);
`;

const BackBtn = styled.button`
  background: none; border: none; cursor: pointer;
  font-size: 1.3rem; color: #495057; padding: 0.2rem 0.5rem;
  border-radius: 8px;
  &:hover { background: #f1f3f5; color: #228be6; }
`;

const TopTitle = styled.h1`
  margin: 0; font-size: 1.2rem; font-weight: 900; color: #1c1c1e;
  flex: 1; display: flex; align-items: center; gap: 0.5rem;
`;

const WriteBtn = styled.button`
  background: linear-gradient(135deg, #4dabf7, #1971c2);
  color: white; border: none; border-radius: 10px;
  padding: 0.55rem 1.2rem; font-size: 0.92rem; font-weight: 800;
  cursor: pointer; transition: all 0.2s;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(25,113,194,0.35); }
`;

const Container = styled.div`
  max-width: 820px; margin: 0 auto; padding: 1.5rem 1rem;
`;

const EmptyState = styled.div`
  text-align: center; padding: 6rem 0; color: #adb5bd; font-size: 1.05rem;
`;

// ─── 공지 카드 ─────────────────────────────────────────────
const NoticeCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 14px rgba(0,0,0,0.07);
  margin-bottom: 1rem;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease;
  border: 1px solid #f1f3f5;
  transition: box-shadow 0.2s;
  &:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.11); }
`;

const CardHeader = styled.div`
  display: flex; align-items: center; gap: 0.8rem;
  padding: 1rem 1.2rem 0.85rem;
  cursor: pointer;
  &:hover { background: #fafafa; }
`;

const ExpandIcon = styled.span`
  font-size: 0.85rem; color: #868e96;
  transition: transform 0.2s;
  transform: ${p => p.$open ? 'rotate(90deg)' : 'rotate(0deg)'};
  display: inline-block;
`;

const CardTitleText = styled.span`
  font-size: 1.05rem; font-weight: 800; color: #1c1c1e; flex: 1;
`;

const MetaRow = styled.div`
  font-size: 0.8rem; color: #adb5bd;
  display: flex; gap: 0.6rem; align-items: center;
  flex-wrap: wrap;
`;

const MetaTag = styled.span`
  background: #f1f3f5; border-radius: 6px;
  padding: 0.15rem 0.5rem; font-weight: 600; color: #868e96;
`;

const ActionRow = styled.div`
  display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;
`;

const IconBtn = styled.button`
  background: none; border: none; cursor: pointer;
  color: #adb5bd; font-size: 1rem;
  padding: 0.3rem 0.45rem; border-radius: 8px;
  transition: all 0.15s;
  &:hover { background: ${p => p.$danger ? '#fff5f5' : '#f1f3f5'};
            color: ${p => p.$danger ? '#fa5252' : '#339af0'}; }
`;

// ─── 펼쳐진 본문 ───────────────────────────────────────────
const CardBody = styled.div`
  border-top: 1px solid #f1f3f5;
  padding: 1.2rem 1.4rem 1.4rem;
  animation: ${fadeIn} 0.2s ease;
`;

const ContentText = styled.p`
  margin: 0 0 1.2rem; font-size: 0.97rem; color: #343a40;
  line-height: 1.75; white-space: pre-wrap; word-break: break-word;
`;

// ─── 이미지 그리드 (크게) ──────────────────────────────────
const ImgGrid = styled.div`
  display: grid;
  grid-template-columns: ${p => p.$count === 1 ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))'};
  gap: 0.8rem;
`;

const ImgWrapper = styled.div`
  position: relative; border-radius: 12px; overflow: hidden;
  background: #f8f9fa;
  cursor: zoom-in;
  &:hover img { transform: scale(1.015); }
`;

const NoticeImg = styled.img`
  width: 100%; display: block;
  max-height: ${p => p.$single ? '680px' : '400px'};
  object-fit: contain;
  transition: transform 0.25s;
  background: #f8f9fa;
`;

const ZoomHint = styled.div`
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(0,0,0,0.5); color: white;
  font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 6px;
  pointer-events: none;
`;

// ─── 라이트박스 ────────────────────────────────────────────
const LightboxOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.92);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 9999; cursor: zoom-out;
  padding: 1rem;
`;

const LightboxImg = styled.img`
  max-width: 96vw; max-height: 88vh;
  object-fit: contain; border-radius: 6px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
`;

const LightboxNav = styled.div`
  display: flex; gap: 1rem; margin-top: 1rem;
`;

const LightboxBtn = styled.button`
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
  color: white; border-radius: 10px; padding: 0.5rem 1.2rem;
  cursor: pointer; font-size: 0.95rem; font-weight: 700;
  &:hover { background: rgba(255,255,255,0.25); }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const LightboxClose = styled.button`
  position: fixed; top: 1rem; right: 1.2rem;
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
  color: white; font-size: 1.5rem; cursor: pointer;
  border-radius: 10px; padding: 0.2rem 0.7rem; z-index: 10000;
  &:hover { background: rgba(255,255,255,0.25); }
`;

// ─── 작성/수정 모달 ────────────────────────────────────────
const ModalOverlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000; padding: 1rem;
`;

const ModalCard = styled.div`
  background: white; border-radius: 20px;
  padding: 1.8rem; width: 100%; max-width: 580px;
  max-height: 92vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${fadeIn} 0.2s ease;
`;

const ModalTitle = styled.h2`
  margin: 0 0 1.4rem; font-size: 1.2rem; font-weight: 900;
  display: flex; align-items: center; gap: 0.5rem;
`;

const Label = styled.label`
  display: block; font-size: 0.85rem; font-weight: 800;
  color: #495057; margin: 1rem 0 0.35rem;
`;

const Input = styled.input`
  width: 100%; padding: 0.75rem 1rem; border: 2px solid #dee2e6;
  border-radius: 10px; font-size: 1rem;
  &:focus { border-color: #339af0; outline: none; }
  box-sizing: border-box;
`;

const Textarea = styled.textarea`
  width: 100%; padding: 0.75rem 1rem; border: 2px solid #dee2e6;
  border-radius: 10px; font-size: 0.96rem; resize: vertical;
  min-height: 110px; line-height: 1.6;
  &:focus { border-color: #339af0; outline: none; }
  box-sizing: border-box;
`;

const UploadZone = styled.label`
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  border: 2px dashed #ced4da; border-radius: 12px;
  padding: 1rem; margin-top: 0.4rem; cursor: pointer;
  color: #868e96; font-size: 0.88rem; transition: all 0.2s;
  &:hover { border-color: #339af0; color: #339af0; background: #f0f8ff; }
`;

const PreviewGrid = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.7rem;
`;

const Thumb = styled.div`
  position: relative; width: 76px; height: 76px;
`;

const ThumbImg = styled.img`
  width: 100%; height: 100%; object-fit: cover; border-radius: 8px;
  border: 1px solid #dee2e6;
`;

const ThumbRemove = styled.button`
  position: absolute; top: -7px; right: -7px;
  background: #fa5252; color: white; border: none;
  border-radius: 50%; width: 20px; height: 20px;
  font-size: 0.7rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
`;

const BtnRow = styled.div`
  display: flex; gap: 0.7rem; margin-top: 1.6rem;
`;

const SubmitBtn = styled.button`
  flex: 1; padding: 0.82rem; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #4dabf7, #1971c2);
  color: white; font-size: 0.97rem; font-weight: 800; cursor: pointer;
  &:disabled { background: #adb5bd; cursor: not-allowed; }
`;

const CancelBtn = styled.button`
  flex: 1; padding: 0.82rem; border: none; border-radius: 10px;
  background: #f1f3f5; color: #495057; font-size: 0.97rem; font-weight: 700; cursor: pointer;
  &:hover { background: #e9ecef; }
`;

// ─── 컴포넌트 ──────────────────────────────────────────────
function NoticePage() {
  const navigate = useNavigate();
  const { classId } = useClassStore();
  const { currentUser, players } = useLeagueStore();

  const myPlayerData = players.find(p => p.authUid === currentUser?.uid);
  const isTeacher = myPlayerData?.role === 'admin' || myPlayerData?.role === 'recorder';

  const [notices, setNotices] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // 모달
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit'
  const [editingNotice, setEditingNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼
  const [form, setForm] = useState({ title: '', content: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);   // 새로 추가할 파일
  const [previews, setPreviews] = useState([]);             // 새 파일 미리보기
  const [existingUrls, setExistingUrls] = useState([]);     // 수정 시 기존 이미지 URL
  const fileRef = useRef();

  // 라이트박스
  const [lightbox, setLightbox] = useState({ open: false, urls: [], idx: 0 });

  // 실시간 구독
  useEffect(() => {
    if (!classId) return;
    return listenNotices(classId, setNotices);
  }, [classId]);

  // 모달 열기
  const openCreate = () => {
    setForm({ title: '', content: '' });
    setSelectedFiles([]); setPreviews([]); setExistingUrls([]);
    setEditingNotice(null);
    setModalMode('create');
  };

  const openEdit = (notice, e) => {
    e.stopPropagation();
    setForm({ title: notice.title, content: notice.content || '' });
    setExistingUrls(notice.imageUrls || []);
    setSelectedFiles([]); setPreviews([]);
    setEditingNotice(notice);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditingNotice(null); };

  // 파일 선택
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedFiles(p => [...p, ...files]);
    files.forEach(f => {
      const r = new FileReader();
      r.onload = ev => setPreviews(p => [...p, ev.target.result]);
      r.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removeNewFile = (i) => {
    setSelectedFiles(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const removeExistingUrl = (i) => {
    setExistingUrls(p => p.filter((_, idx) => idx !== i));
  };

  // 제출
  const handleSubmit = async () => {
    if (!form.title.trim()) return alert('제목을 입력해주세요.');
    if (!form.content.trim() && selectedFiles.length === 0 && existingUrls.length === 0)
      return alert('내용이나 이미지를 추가해주세요.');
    setIsSubmitting(true);
    try {
      // 새 파일 업로드
      const newUrls = [];
      for (const file of selectedFiles) {
        const url = await uploadNoticeImage(classId, file);
        newUrls.push(url);
      }
      const finalUrls = [...existingUrls, ...newUrls];

      if (modalMode === 'create') {
        await createNotice(classId, myPlayerData.name, form.title.trim(), form.content.trim(), finalUrls);
      } else {
        // 수정
        await updateDoc(doc(db, 'classes', classId, 'notices', editingNotice.id), {
          title: form.title.trim(),
          content: form.content.trim(),
          imageUrls: finalUrls,
          updatedAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (e) {
      alert('저장 실패: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (notice, e) => {
    e.stopPropagation();
    if (!window.confirm(`"${notice.title}" 공지를 삭제하시겠습니까?`)) return;
    try { await deleteNotice(classId, notice.id); }
    catch (e) { alert('삭제 실패: ' + e.message); }
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const openLightbox = (urls, idx, e) => {
    e.stopPropagation();
    setLightbox({ open: true, urls, idx });
  };

  return (
    <PageWrapper>
      <TopBar>
        <BackBtn onClick={() => navigate(-1)}>←</BackBtn>
        <TopTitle>📢 공지사항</TopTitle>
        {isTeacher && <WriteBtn onClick={openCreate}>+ 새 공지 작성</WriteBtn>}
      </TopBar>

      <Container>
        {notices.length === 0 ? (
          <EmptyState>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.8rem' }}>📭</div>
            <div>아직 공지사항이 없습니다.</div>
          </EmptyState>
        ) : notices.map(notice => {
          const isOpen = expandedId === notice.id;
          const imgUrls = notice.imageUrls || [];
          return (
            <NoticeCard key={notice.id}>
              {/* 헤더 */}
              <CardHeader onClick={() => setExpandedId(isOpen ? null : notice.id)}>
                <ExpandIcon $open={isOpen}>▶</ExpandIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CardTitleText>{notice.title}</CardTitleText>
                  <MetaRow style={{ marginTop: '0.3rem' }}>
                    <span>{notice.authorName}</span>
                    <span>·</span>
                    <span>{formatDate(notice.createdAt)}</span>
                    {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                      <MetaTag>수정됨</MetaTag>
                    )}
                    {imgUrls.length > 0 && <MetaTag>📎 이미지 {imgUrls.length}장</MetaTag>}
                  </MetaRow>
                </div>
                {isTeacher && (
                  <ActionRow onClick={e => e.stopPropagation()}>
                    <IconBtn title="수정" onClick={e => openEdit(notice, e)}>✏️</IconBtn>
                    <IconBtn $danger title="삭제" onClick={e => handleDelete(notice, e)}>🗑️</IconBtn>
                  </ActionRow>
                )}
              </CardHeader>

              {/* 본문 */}
              {isOpen && (
                <CardBody>
                  {notice.content ? <ContentText>{notice.content}</ContentText> : null}

                  {imgUrls.length > 0 && (
                    <ImgGrid $count={imgUrls.length}>
                      {imgUrls.map((url, i) => (
                        <ImgWrapper key={i} onClick={e => openLightbox(imgUrls, i, e)}>
                          <NoticeImg
                            src={url}
                            alt={`공지 이미지 ${i + 1}`}
                            $single={imgUrls.length === 1}
                            loading="lazy"
                          />
                          <ZoomHint>🔍 클릭하여 확대</ZoomHint>
                        </ImgWrapper>
                      ))}
                    </ImgGrid>
                  )}
                </CardBody>
              )}
            </NoticeCard>
          );
        })}
      </Container>

      {/* ── 작성/수정 모달 ── */}
      {modalMode && (
        <ModalOverlay onClick={closeModal}>
          <ModalCard onClick={e => e.stopPropagation()}>
            <ModalTitle>
              {modalMode === 'create' ? '📢 새 공지 작성' : '✏️ 공지 수정'}
            </ModalTitle>

            <Label>제목 *</Label>
            <Input
              placeholder="공지 제목을 입력하세요"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />

            <Label>내용</Label>
            <Textarea
              placeholder="공지 내용 (선택 — 이미지만 올려도 됩니다)"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />

            <Label>이미지 첨부</Label>

            {/* 기존 이미지 (수정 모드) */}
            {existingUrls.length > 0 && (
              <PreviewGrid>
                {existingUrls.map((url, i) => (
                  <Thumb key={`exist-${i}`}>
                    <ThumbImg src={url} alt="기존 이미지" />
                    <ThumbRemove onClick={() => removeExistingUrl(i)}>✕</ThumbRemove>
                  </Thumb>
                ))}
              </PreviewGrid>
            )}

            {/* 새 파일 미리보기 */}
            {previews.length > 0 && (
              <PreviewGrid style={{ marginTop: existingUrls.length ? '0.5rem' : '0.7rem' }}>
                {previews.map((src, i) => (
                  <Thumb key={`new-${i}`}>
                    <ThumbImg src={src} alt="새 이미지" />
                    <ThumbRemove onClick={() => removeNewFile(i)}>✕</ThumbRemove>
                  </Thumb>
                ))}
              </PreviewGrid>
            )}

            <UploadZone htmlFor="notice-img-input" style={{ marginTop: '0.6rem' }}>
              <span style={{ fontSize: '1.6rem' }}>🖼️</span>
              <span>클릭하여 이미지 추가 (여러 장 가능)</span>
              <span style={{ fontSize: '0.78rem', color: '#adb5bd' }}>JPG · PNG · GIF · WEBP</span>
            </UploadZone>
            <input
              id="notice-img-input" ref={fileRef} type="file"
              accept="image/*" multiple style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <BtnRow>
              <CancelBtn onClick={closeModal}>취소</CancelBtn>
              <SubmitBtn onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? '저장 중...' : modalMode === 'create' ? '공지 등록' : '수정 완료'}
              </SubmitBtn>
            </BtnRow>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── 라이트박스 ── */}
      {lightbox.open && (
        <LightboxOverlay onClick={() => setLightbox(l => ({ ...l, open: false }))}>
          <LightboxClose onClick={() => setLightbox(l => ({ ...l, open: false }))}>✕</LightboxClose>
          <LightboxImg
            src={lightbox.urls[lightbox.idx]}
            alt="공지 이미지 전체보기"
            onClick={e => e.stopPropagation()}
          />
          {lightbox.urls.length > 1 && (
            <LightboxNav onClick={e => e.stopPropagation()}>
              <LightboxBtn
                disabled={lightbox.idx === 0}
                onClick={() => setLightbox(l => ({ ...l, idx: l.idx - 1 }))}
              >← 이전</LightboxBtn>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', alignSelf: 'center' }}>
                {lightbox.idx + 1} / {lightbox.urls.length}
              </span>
              <LightboxBtn
                disabled={lightbox.idx === lightbox.urls.length - 1}
                onClick={() => setLightbox(l => ({ ...l, idx: l.idx + 1 }))}
              >다음 →</LightboxBtn>
            </LightboxNav>
          )}
        </LightboxOverlay>
      )}
    </PageWrapper>
  );
}

export default NoticePage;
