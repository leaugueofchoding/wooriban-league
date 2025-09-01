// src/pages/MissionGalleryPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, getApprovedSubmissions, addMissionComment, toggleSubmissionAdminVisibility, toggleSubmissionLike } from '../api/firebase';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Link } from 'react-router-dom';
import CommentThread from '../components/CommentThread';
import ImageModal from '../components/ImageModal';

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const FilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 2rem;
`;

const MissionSelect = styled.select`
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #eee;
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const SubmissionCard = styled.div`
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  }
`;

const CardImage = styled.div`
  width: 100%;
  height: 200px;
  background-size: cover;
  background-position: center;
  background-color: #f0f0f0;
`;

const CardContent = styled.div`
  padding: 1rem;
`;

const CardTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardAuthor = styled.p`
  margin: 0;
  color: #6c757d;
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;
`;

const ModalContainer = styled.div`
  width: 90%; max-width: 800px;
  background-color: white; border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  display: flex; flex-direction: column;
  max-height: 90vh;
`;

const ModalHeader = styled.div`
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  h2 { margin: 0; font-size: 1.2rem; }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ModalSubmissionDetails = styled.div`
    p { white-space: pre-wrap; margin-top: 0; background-color: #f8f9fa; padding: 1rem; border-radius: 8px; }
    img { max-width: 100%; height: auto; border-radius: 8px; margin-top: 0.5rem; cursor: pointer; }
`;

const ExitButton = styled(Link)`
  display: block;
  margin: 3rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  &:hover { background-color: #5a6268; }
`;

const AdminButton = styled.button`
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid ${props => props.$isHidden ? '#28a745' : '#dc3545'};
    background-color: ${props => props.$isHidden ? '#eaf7f0' : '#fbe9eb'};
    color: ${props => props.$isHidden ? '#28a745' : '#dc3545'};
`;

const CommentInputContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
`;
const CommentTextarea = styled.textarea`
    flex-grow: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
`;
const CommentSubmitButton = styled.button`
    padding: 0.5rem 1rem;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    &:hover { background-color: #0056b3; }
`;
const LikeButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 2rem;
    transition: transform 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    &:hover { transform: scale(1.1); }
`;
const LoadMoreButton = styled.button`
    margin-top: 2rem;
    padding: 0.8rem 2rem;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    border: 1px solid #007bff;
    color: #007bff;
    background-color: #fff;
    border-radius: 8px;
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function MissionGalleryPage() {
    const { players, missions, archivedMissions } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

    const [allSubmissions, setAllSubmissions] = useState([]);
    const [visibleCount, setVisibleCount] = useState(9); // 3(인기) + 6(최신)
    const ITEMS_PER_PAGE = 6;

    const [isLoading, setIsLoading] = useState(true);
    const [selectedMission, setSelectedMission] = useState('all');
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");

    useEffect(() => {
        const fetchAllApprovedSubmissions = async () => {
            setIsLoading(true);
            const approvedSubmissions = await getApprovedSubmissions();
            setAllSubmissions(approvedSubmissions);
            setIsLoading(false);
        };
        fetchAllApprovedSubmissions();
    }, []);

    useEffect(() => {
        if (selectedSubmission) {
            const commentsRef = collection(db, "missionSubmissions", selectedSubmission.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "asc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsubscribe();
        }
    }, [selectedSubmission]);

    const allMissionsList = useMemo(() => [...missions, ...archivedMissions], [missions, archivedMissions]);

    const publiclyVisibleSubmissions = useMemo(() => {
        return allSubmissions.filter(sub => {
            const mission = allMissionsList.find(m => m.id === sub.missionId);
            if (sub.adminHidden) return false;
            return sub.isPublic === true || (sub.isPublic === undefined && !mission?.defaultPrivate);
        });
    }, [allSubmissions, allMissionsList]);

    const allSelectableMissions = useMemo(() => {
        const publicMissionIds = new Set(publiclyVisibleSubmissions.map(sub => sub.missionId));
        return allMissionsList
            .filter(mission => publicMissionIds.has(mission.id))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [allMissionsList, publiclyVisibleSubmissions]);

    const hotSubmissions = useMemo(() => {
        return [...publiclyVisibleSubmissions]
            .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
            .slice(0, 3);
    }, [publiclyVisibleSubmissions]);

    const filteredSubmissions = useMemo(() => {
        if (selectedMission === 'all') {
            return publiclyVisibleSubmissions;
        }
        return publiclyVisibleSubmissions.filter(sub => sub.missionId === selectedMission);
    }, [publiclyVisibleSubmissions, selectedMission]);

    const displayedSubmissions = useMemo(() => {
        return filteredSubmissions.slice(0, visibleCount);
    }, [filteredSubmissions, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prevCount => prevCount + ITEMS_PER_PAGE);
    };

    const handleAdminToggleVisibility = async (submission) => {
        const action = submission.adminHidden ? "표시" : "숨김";
        if (window.confirm(`이 게시물을 갤러리에서 ${action} 처리하시겠습니까?`)) {
            await toggleSubmissionAdminVisibility(submission.id);
            const updatedSubmission = { ...submission, adminHidden: !submission.adminHidden };
            setAllSubmissions(prev => prev.map(s => s.id === submission.id ? updatedSubmission : s));
            setSelectedSubmission(updatedSubmission);
        }
    };

    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !myPlayerData) return;
        const student = players.find(p => p.id === selectedSubmission.studentId);
        await addMissionComment(
            selectedSubmission.id,
            { commenterId: myPlayerData.id, commenterName: myPlayerData.name, commenterRole: myPlayerData.role, text: newComment },
            student?.authUid,
            getMissionTitle(selectedSubmission.missionId)
        );
        setNewComment("");
    };

    const handleLikeSubmission = async (e) => {
        e.stopPropagation();
        if (!myPlayerData) return;
        await toggleSubmissionLike(selectedSubmission.id, myPlayerData.id);
        const newLikes = selectedSubmission.likes?.includes(myPlayerData.id)
            ? selectedSubmission.likes.filter(id => id !== myPlayerData.id)
            : [...(selectedSubmission.likes || []), myPlayerData.id];
        const updatedSubmission = { ...selectedSubmission, likes: newLikes };
        setAllSubmissions(prev => prev.map(s => s.id === selectedSubmission.id ? updatedSubmission : s));
        setSelectedSubmission(updatedSubmission);
    };

    const getPlayerName = (studentId) => players.find(p => p.id === studentId)?.name || '알 수 없음';
    const getMissionTitle = (missionId) => allMissionsList.find(m => m.id === missionId)?.title || '알 수 없음';
    const getCardImage = (sub) => {
        if (sub.photoUrls && sub.photoUrls.length > 0) return sub.photoUrls[0];
        if (sub.photoUrl) return sub.photoUrl;
        return null;
    }

    if (isLoading) {
        return <Wrapper><p>갤러리를 불러오는 중입니다...</p></Wrapper>;
    }

    return (
        <>
            <Wrapper>
                <Title>🎨 미션 갤러리</Title>

                <SectionTitle>🏆 주간 하트 TOP</SectionTitle>
                <GalleryGrid style={{ marginBottom: '3rem' }}>
                    {hotSubmissions.map(sub => (
                        <SubmissionCard key={sub.id} onClick={() => setSelectedSubmission(sub)}>
                            {getCardImage(sub) ? <CardImage style={{ backgroundImage: `url(${getCardImage(sub)})` }} /> : <div style={{ height: '200px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>No Image</div>}
                            <CardContent>
                                <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                <CardAuthor>by {getPlayerName(sub.studentId)} ❤️ {sub.likes?.length || 0}</CardAuthor>
                            </CardContent>
                        </SubmissionCard>
                    ))}
                </GalleryGrid>

                <SectionTitle>✨ 전체 결과물</SectionTitle>
                <FilterContainer>
                    <MissionSelect value={selectedMission} onChange={(e) => { setSelectedMission(e.target.value); setVisibleCount(9); }}>
                        <option value="all">모든 미션 보기</option>
                        {allSelectableMissions.map(mission => (<option key={mission.id} value={mission.id}>{mission.title}</option>))}
                    </MissionSelect>
                </FilterContainer>

                <GalleryGrid>
                    {displayedSubmissions.map(sub => (
                        <SubmissionCard key={sub.id} onClick={() => setSelectedSubmission(sub)}>
                            {getCardImage(sub) ? <CardImage style={{ backgroundImage: `url(${getCardImage(sub)})` }} /> : <div style={{ height: '200px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>No Image</div>}
                            <CardContent>
                                <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                <CardAuthor>by {getPlayerName(sub.studentId)}</CardAuthor>
                            </CardContent>
                        </SubmissionCard>
                    ))}
                </GalleryGrid>

                {filteredSubmissions.length > visibleCount && (
                    <div style={{ textAlign: 'center' }}>
                        <LoadMoreButton onClick={handleLoadMore}>더보기</LoadMoreButton>
                    </div>
                )}

                <div style={{ textAlign: 'center' }}>
                    <ExitButton to="/">홈으로 돌아가기</ExitButton>
                </div>
            </Wrapper>

            {selectedSubmission && (
                <ModalBackground onClick={() => setSelectedSubmission(null)}>
                    <ModalContainer onClick={e => e.stopPropagation()}>
                        <ModalHeader>
                            <div>
                                <h2>{getMissionTitle(selectedSubmission.missionId)}</h2>
                                <p style={{ margin: 0, color: '#6c757d' }}>by {getPlayerName(selectedSubmission.studentId)}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <LikeButton onClick={handleLikeSubmission}>
                                    {selectedSubmission.likes?.includes(myPlayerData?.id) ? '❤️' : '🤍'}
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedSubmission.likes?.length || 0}</span>
                                </LikeButton>
                                {myPlayerData?.role === 'admin' && (
                                    <AdminButton onClick={() => handleAdminToggleVisibility(selectedSubmission)} $isHidden={selectedSubmission.adminHidden}>
                                        {selectedSubmission.adminHidden ? '갤러리에 표시' : '갤러리에서 숨기기'}
                                    </AdminButton>
                                )}
                            </div>
                        </ModalHeader>
                        <ModalContent>
                            <ModalSubmissionDetails>
                                {selectedSubmission.text && <p>{selectedSubmission.text}</p>}
                                {selectedSubmission.photoUrls && selectedSubmission.photoUrls.map((url, index) => (
                                    <img key={index} src={url} alt={`제출 이미지 ${index + 1}`} onClick={() => setModalImageSrc({ src: url, rotation: selectedSubmission.rotations?.[url] || 0 })} />
                                ))}
                                {selectedSubmission.photoUrl && !selectedSubmission.photoUrls && (
                                    <img src={selectedSubmission.photoUrl} alt="제출 이미지" onClick={() => setModalImageSrc({ src: selectedSubmission.photoUrl, rotation: 0 })} />
                                )}
                            </ModalSubmissionDetails>
                            <div>
                                {comments.map(comment => (
                                    <CommentThread
                                        key={comment.id}
                                        submissionId={selectedSubmission.id}
                                        comment={comment}
                                        missionTitle={getMissionTitle(selectedSubmission.missionId)}
                                        permissions={{ canLike: true, canReply: true, canEdit: myPlayerData?.role === 'admin' }}
                                    />
                                ))}
                                {myPlayerData &&
                                    <CommentInputContainer>
                                        <CommentTextarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="응원의 댓글을 남겨주세요!" rows="2" />
                                        <CommentSubmitButton onClick={handleCommentSubmit}>등록</CommentSubmitButton>
                                    </CommentInputContainer>
                                }
                            </div>
                        </ModalContent>
                    </ModalContainer>
                </ModalBackground>
            )}

            <ImageModal src={modalImageSrc?.src} rotation={modalImageSrc?.rotation} onClose={() => setModalImageSrc(null)} />
        </>
    );
}

export default MissionGalleryPage;