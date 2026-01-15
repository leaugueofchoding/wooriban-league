// src/pages/MissionGalleryPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, db, getApprovedSubmissions, addMissionComment, toggleSubmissionAdminVisibility, toggleSubmissionLike, toggleSubmissionImageRotation } from '../api/firebase';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Link } from 'react-router-dom';
import CommentThread from '../components/CommentThread';
import ImageModal from '../components/ImageModal';
import { filterProfanity } from '../utils/profanityFilter';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  animation: ${fadeIn} 0.5s ease-out;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 2.2rem;
  font-weight: 800;
  color: #343a40;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const SubTitle = styled.p`
  color: #868e96;
  font-size: 1rem;
  font-weight: 500;
`;

const FilterWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
`;

const FilterContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  max-width: 900px;
  
  /* 펼쳐지지 않았을 때 높이 제한을 주는 방식 대신, 렌더링 개수를 조절하는 방식 사용 */
`;

const FilterButton = styled.button`
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  border: 1px solid ${props => props.$active ? '#007bff' : '#dee2e6'};
  background-color: ${props => props.$active ? '#007bff' : '#fff'};
  color: ${props => props.$active ? '#fff' : '#495057'};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: ${props => props.$active ? '0 4px 10px rgba(0,123,255,0.2)' : '0 2px 5px rgba(0,0,0,0.05)'};

  &:hover {
    transform: translateY(-2px);
    background-color: ${props => props.$active ? '#0069d9' : '#f8f9fa'};
  }
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  color: #868e96;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem;
  
  &:hover { color: #495057; }
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
  font-weight: 800;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    width: 6px;
    height: 24px;
    background-color: #20c997;
    border-radius: 3px;
  }
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const SubmissionCard = styled.div`
  background-color: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 1px solid #f1f3f5;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 25px rgba(0,0,0,0.12);
    border-color: #74c0fc;
  }
`;

const CardImageWrapper = styled.div`
  width: 100%;
  height: 220px;
  overflow: hidden;
  position: relative;
  background-color: ${props => props.$hasImage ? '#f8f9fa' : '#fff9db'}; /* 텍스트만 있으면 노란 포스트잇 느낌 */
`;

const CardImage = styled.div`
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  transition: transform 0.5s ease;

  ${SubmissionCard}:hover & {
    transform: scale(1.05);
  }
`;

// [추가] 텍스트 미리보기 스타일
const CardTextPreview = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  text-align: center;
  color: #495057;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.5;
  word-break: keep-all;
  white-space: pre-wrap;
  
  /* 긴 텍스트 말줄임 처리 */
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  
  ${SubmissionCard}:hover & {
    color: #212529;
  }
`;

const LikeBadge = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255,255,255,0.9);
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 800;
  color: #fa5252;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 0.2rem;
  z-index: 1;
`;

const CardContent = styled.div`
  padding: 1.2rem;
`;

const CardTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #343a40;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardAuthor = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #868e96;
  font-weight: 500;
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.85); /* 배경 조금 더 어둡게 */
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;
  animation: ${fadeIn} 0.2s ease-out;
`;

const ModalContainer = styled.div`
  width: 90%; max-width: 1000px; /* 더 넓게 */
  background-color: #fff; 
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  display: flex; 
  flex-direction: column;
  height: 85vh; /* 높이 고정 */
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f1f3f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  z-index: 10;
  
  h2 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #343a40; }
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: row;
  overflow: hidden;
  flex: 1;
  
  @media (max-width: 768px) {
    flex-direction: column;
    overflow-y: auto;
  }
`;

const ModalImageSection = styled.div`
  flex: 1.8; /* 이미지 영역을 더 넓게 */
  background-color: #212529;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  overflow-y: auto;
  position: relative;
`;

const TextOnlyDisplay = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff;
  font-size: 1.8rem; /* 아주 큰 글씨 */
  font-weight: 700;
  line-height: 1.6;
  white-space: pre-wrap;
  padding: 2rem;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: rgba(255,255,255,0.3);
    border-radius: 4px;
  }
`;

const ModalInfoSection = styled.div`
  flex: 1;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #f1f3f5;
  min-width: 350px;
  
  @media (max-width: 768px) {
    border-left: none;
    border-top: 1px solid #f1f3f5;
    min-width: auto;
    height: 50%;
  }
`;

const CommentList = styled.div`
  flex-grow: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: #fff;
`;

const CommentInputContainer = styled.div`
  padding: 1rem;
  border-top: 1px solid #f1f3f5;
  display: flex;
  gap: 0.5rem;
  background-color: #f8f9fa;
`;

const CommentTextarea = styled.textarea`
  flex-grow: 1;
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  resize: none;
  font-family: inherit;
  font-size: 0.95rem;
  outline: none;
  background-color: #fff;
  &:focus { border-color: #339af0; }
`;

const CommentSubmitButton = styled.button`
  padding: 0 1.2rem;
  border: none;
  background-color: #339af0;
  color: white;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover { background-color: #228be6; }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: 1rem;
  &:last-child { margin-bottom: 0; }
  
  img {
    width: 100%;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    cursor: pointer;
  }
`;

const RotateButton = styled.button`
  position: absolute;
  bottom: 15px;
  right: 15px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  &:hover { background-color: rgba(0, 0, 0, 0.8); }
`;

const SubmissionText = styled.div`
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #f1f3f5;
  font-size: 1rem;
  line-height: 1.6;
  color: #495057;
  white-space: pre-wrap;
  font-weight: 500;
`;

const ExitButton = styled(Link)`
  display: inline-block;
  margin-top: 2rem;
  padding: 0.8rem 2.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: #495057;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 30px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);

  &:hover { 
    background-color: #f8f9fa; 
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  }
`;

const AdminButton = styled.button`
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid ${props => props.$isHidden ? '#20c997' : '#fa5252'};
  background-color: ${props => props.$isHidden ? '#e6fcf5' : '#fff5f5'};
  color: ${props => props.$isHidden ? '#0ca678' : '#e03131'};
  font-weight: 700;
`;

const LikeButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem;
  border-radius: 8px;
  &:hover { transform: scale(1.1); background-color: #f8f9fa; }
  
  span {
    font-size: 1rem;
    font-weight: 800;
    color: #495057;
  }
`;

const LoadMoreButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  border: 2px solid #e9ecef;
  color: #868e96;
  background-color: #fff;
  border-radius: 30px;
  transition: all 0.2s;
  
  &:hover {
    border-color: #ced4da;
    color: #495057;
    background-color: #f8f9fa;
  }
`;

const getSafeKeyFromUrl = (url) => {
    try {
        return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        return url.replace(/[^a-zA-Z0-9]/g, '');
    }
};

function MissionGalleryPage() {
    const { classId } = useClassStore();
    const { players, missions, archivedMissions } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

    const [allSubmissions, setAllSubmissions] = useState([]);
    const [visibleCount, setVisibleCount] = useState(9);
    const ITEMS_PER_PAGE = 9;

    const [isLoading, setIsLoading] = useState(true);
    const [selectedMission, setSelectedMission] = useState('all');
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [rotations, setRotations] = useState({});
    const [isFilterExpanded, setIsFilterExpanded] = useState(false); // [추가] 필터 확장 상태

    const allMissionsList = useMemo(() => [...missions, ...archivedMissions], [missions, archivedMissions]);

    useEffect(() => {
        const fetchAllApprovedSubmissions = async () => {
            if (!classId || allMissionsList.length === 0) return;
            setIsLoading(true);
            const approvedSubmissions = await getApprovedSubmissions(classId);
            setAllSubmissions(approvedSubmissions);
            setIsLoading(false);
        };
        fetchAllApprovedSubmissions();
    }, [allMissionsList, classId]);

    useEffect(() => {
        if (selectedSubmission && classId) {
            setRotations(selectedSubmission.rotations || {});
            const commentsRef = collection(db, "classes", classId, "missionSubmissions", selectedSubmission.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "asc"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsubscribe();
        }
    }, [selectedSubmission, classId]);

    const publiclyVisibleSubmissions = useMemo(() => {
        if (allMissionsList.length === 0) return [];

        return allSubmissions.filter(sub => {
            const mission = allMissionsList.find(m => m.id === sub.missionId);
            if (!mission) return false;
            if (sub.adminHidden) return false;
            if (sub.isPublic === false) return false;
            if (sub.isPublic === true) return true;
            if (sub.isPublic === undefined) {
                return !mission.defaultPrivate;
            }
            return false;
        });
    }, [allSubmissions, allMissionsList]);

    const allSelectableMissions = useMemo(() => {
        if (publiclyVisibleSubmissions.length === 0) return [];
        const publicMissionIds = new Set(publiclyVisibleSubmissions.map(sub => sub.missionId));
        return allMissionsList
            .filter(mission => publicMissionIds.has(mission.id))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [allMissionsList, publiclyVisibleSubmissions]);

    // [수정] 필터 표시 개수 제한 로직
    const visibleFilters = useMemo(() => {
        if (isFilterExpanded) return allSelectableMissions;
        return allSelectableMissions.slice(0, 8); // 기본 8개만 표시
    }, [allSelectableMissions, isFilterExpanded]);

    const hotSubmissions = useMemo(() => {
        return [...publiclyVisibleSubmissions]
            .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
            .slice(0, 3);
    }, [publiclyVisibleSubmissions]);

    const filteredSubmissions = useMemo(() => {
        if (selectedMission === 'all') return publiclyVisibleSubmissions;
        return publiclyVisibleSubmissions.filter(sub => sub.missionId === selectedMission);
    }, [publiclyVisibleSubmissions, selectedMission]);

    const displayedSubmissions = useMemo(() => {
        return filteredSubmissions.slice(0, visibleCount);
    }, [filteredSubmissions, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prevCount => prevCount + ITEMS_PER_PAGE);
    };

    const handleAdminToggleVisibility = async (submission) => {
        if (!classId) return;
        const action = submission.adminHidden ? "표시" : "숨김";
        if (window.confirm(`이 게시물을 갤러리에서 ${action} 처리하시겠습니까?`)) {
            await toggleSubmissionAdminVisibility(classId, submission.id);
            const updatedSubmission = { ...submission, adminHidden: !submission.adminHidden };
            setAllSubmissions(prev => prev.map(s => s.id === submission.id ? updatedSubmission : s));
            setSelectedSubmission(updatedSubmission);
        }
    };

    const handleCommentSubmit = async () => {
        if (!classId || !newComment.trim() || !myPlayerData) return;

        const filteredText = filterProfanity(newComment);

        const student = players.find(p => p.id === selectedSubmission.studentId);
        await addMissionComment(
            classId,
            selectedSubmission.id,
            { commenterId: myPlayerData.id, commenterName: myPlayerData.name, commenterRole: myPlayerData.role, text: filteredText },
            student?.authUid,
            getMissionTitle(selectedSubmission.missionId)
        );
        setNewComment("");
    };

    const handleLikeSubmission = async (e) => {
        e.stopPropagation();
        if (!classId || !myPlayerData) return;
        await toggleSubmissionLike(classId, selectedSubmission.id, myPlayerData.id);
        const newLikes = selectedSubmission.likes?.includes(myPlayerData.id)
            ? selectedSubmission.likes.filter(id => id !== myPlayerData.id)
            : [...(selectedSubmission.likes || []), myPlayerData.id];
        const updatedSubmission = { ...selectedSubmission, likes: newLikes };
        setAllSubmissions(prev => prev.map(s => s.id === selectedSubmission.id ? updatedSubmission : s));
        setSelectedSubmission(updatedSubmission);
    };

    const handleRotate = async (url) => {
        if (!classId) return;
        try {
            await toggleSubmissionImageRotation(classId, selectedSubmission.id, url);
            const imageKey = getSafeKeyFromUrl(url);
            const newRotation = ((rotations[imageKey] || 0) + 90) % 360;

            const updatedRotations = { ...rotations, [imageKey]: newRotation };
            setRotations(updatedRotations);

            const updatedSubmission = { ...selectedSubmission, rotations: updatedRotations };
            setSelectedSubmission(updatedSubmission);
            setAllSubmissions(prev => prev.map(s => s.id === selectedSubmission.id ? updatedSubmission : s));

        } catch (error) {
            console.error("Rotation update failed: ", error);
            alert("이미지 회전 정보 저장에 실패했습니다.");
        }
    };

    const getPlayerName = (studentId) => players.find(p => p.id === studentId)?.name || '알 수 없음';
    const getMissionTitle = (missionId) => allMissionsList.find(m => m.id === missionId)?.title || '알 수 없음';

    // [수정] 카드 이미지 or 텍스트 판별 함수
    const getCardImage = (sub) => {
        if (sub.photoUrls && sub.photoUrls.length > 0) return sub.photoUrls[0];
        if (sub.photoUrl) return sub.photoUrl;
        return null;
    };

    if (isLoading) {
        return <Wrapper style={{ textAlign: 'center', marginTop: '3rem', color: '#adb5bd' }}>갤러리를 불러오는 중입니다... 🎨</Wrapper>;
    }

    const canRotateSelected = myPlayerData?.role === 'admin' || myPlayerData?.id === selectedSubmission?.studentId;
    const hasPhotos = selectedSubmission?.photoUrls && selectedSubmission.photoUrls.length > 0;

    return (
        <>
            <Wrapper>
                <Header>
                    <Title>🖼️ 미션 갤러리</Title>
                    <SubTitle>친구들의 멋진 활동을 감상하고 하트를 눌러주세요!</SubTitle>
                </Header>

                {hotSubmissions.length > 0 && (
                    <>
                        <SectionTitle>🔥 주간 인기 포토</SectionTitle>
                        <GalleryGrid>
                            {hotSubmissions.map(sub => (
                                <SubmissionCard key={sub.id} onClick={() => setSelectedSubmission(sub)}>
                                    <CardImageWrapper $hasImage={!!getCardImage(sub)}>
                                        {getCardImage(sub) ? (
                                            <CardImage style={{ backgroundImage: `url(${getCardImage(sub)})` }} />
                                        ) : (
                                            <CardTextPreview>{sub.text}</CardTextPreview>
                                        )}
                                        <LikeBadge>❤️ {sub.likes?.length || 0}</LikeBadge>
                                    </CardImageWrapper>
                                    <CardContent>
                                        <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                        <CardAuthor>
                                            <span>{getPlayerName(sub.studentId)}</span>
                                        </CardAuthor>
                                    </CardContent>
                                </SubmissionCard>
                            ))}
                        </GalleryGrid>
                    </>
                )}

                <SectionTitle>✨ 전체 갤러리</SectionTitle>
                <FilterWrapper>
                    <FilterContainer>
                        <FilterButton
                            $active={selectedMission === 'all'}
                            onClick={() => { setSelectedMission('all'); setVisibleCount(9); }}
                        >
                            전체 보기
                        </FilterButton>
                        {visibleFilters.map(mission => (
                            <FilterButton
                                key={mission.id}
                                $active={selectedMission === mission.id}
                                onClick={() => { setSelectedMission(mission.id); setVisibleCount(9); }}
                            >
                                {mission.title}
                            </FilterButton>
                        ))}
                    </FilterContainer>
                    {allSelectableMissions.length > 8 && (
                        <ExpandButton onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                            {isFilterExpanded ? '접기 ▲' : '더 많은 미션 보기 ▼'}
                        </ExpandButton>
                    )}
                </FilterWrapper>

                <GalleryGrid>
                    {displayedSubmissions.length > 0 ? displayedSubmissions.map(sub => (
                        <SubmissionCard key={sub.id} onClick={() => setSelectedSubmission(sub)}>
                            <CardImageWrapper $hasImage={!!getCardImage(sub)}>
                                {getCardImage(sub) ? (
                                    <CardImage style={{ backgroundImage: `url(${getCardImage(sub)})` }} />
                                ) : (
                                    // [수정] 텍스트 미리보기 (회색박스 제거)
                                    <CardTextPreview>{sub.text}</CardTextPreview>
                                )}
                                {(sub.likes?.length || 0) > 0 && <LikeBadge>❤️ {sub.likes?.length}</LikeBadge>}
                            </CardImageWrapper>
                            <CardContent>
                                <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                <CardAuthor>
                                    <span>{getPlayerName(sub.studentId)}</span>
                                </CardAuthor>
                            </CardContent>
                        </SubmissionCard>
                    )) : <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#adb5bd' }}>등록된 게시물이 없습니다.</div>}
                </GalleryGrid>

                {filteredSubmissions.length > visibleCount && (
                    <div style={{ textAlign: 'center' }}>
                        <LoadMoreButton onClick={handleLoadMore}>더 보기</LoadMoreButton>
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
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#868e96' }}>by {getPlayerName(selectedSubmission.studentId)}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <LikeButton onClick={handleLikeSubmission}>
                                    {selectedSubmission.likes?.includes(myPlayerData?.id) ? '❤️' : '🤍'}
                                    <span>{selectedSubmission.likes?.length || 0}</span>
                                </LikeButton>
                                {myPlayerData?.role === 'admin' && (
                                    <AdminButton onClick={() => handleAdminToggleVisibility(selectedSubmission)} $isHidden={selectedSubmission.adminHidden}>
                                        {selectedSubmission.adminHidden ? '표시하기' : '숨기기'}
                                    </AdminButton>
                                )}
                                <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                            </div>
                        </ModalHeader>

                        <ModalBody>
                            {/* 왼쪽: 이미지 영역 OR 대왕 텍스트 영역 */}
                            <ModalImageSection>
                                {hasPhotos ? (
                                    selectedSubmission.photoUrls.map((url, index) => {
                                        const imageKey = getSafeKeyFromUrl(url);
                                        const rotation = rotations[imageKey] || 0;
                                        return (
                                            <ImageContainer key={index}>
                                                <img
                                                    src={url}
                                                    alt={`제출 이미지 ${index + 1}`}
                                                    style={{ transform: `rotate(${rotation}deg)` }}
                                                    onClick={() => setModalImageSrc({
                                                        src: url,
                                                        rotation: rotation,
                                                        onRotate: canRotateSelected ? () => handleRotate(url) : null
                                                    })}
                                                />
                                                {canRotateSelected && <RotateButton onClick={(e) => { e.stopPropagation(); handleRotate(url); }}>↻</RotateButton>}
                                            </ImageContainer>
                                        );
                                    })
                                ) : (
                                    // [수정] 텍스트만 있는 경우 왼쪽 화면에 크게 표시
                                    <TextOnlyDisplay>
                                        {selectedSubmission.text}
                                    </TextOnlyDisplay>
                                )}
                            </ModalImageSection>

                            {/* 오른쪽: 정보 및 댓글 영역 */}
                            <ModalInfoSection>
                                {/* 사진이 있을 때만 본문 텍스트를 오른쪽에 작게 표시 (없으면 왼쪽 대왕 텍스트로 대체됨) */}
                                {hasPhotos && selectedSubmission.text && <SubmissionText>{selectedSubmission.text}</SubmissionText>}

                                <CommentList>
                                    {comments.length > 0 ? comments.map(comment => (
                                        <CommentThread
                                            key={comment.id}
                                            classId={classId}
                                            submissionId={selectedSubmission.id}
                                            comment={comment}
                                            missionTitle={getMissionTitle(selectedSubmission.missionId)}
                                            permissions={{ canLike: true, canReply: true, canEdit: myPlayerData?.role === 'admin' || myPlayerData?.id === comment.commenterId }}
                                        />
                                    )) : <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '2rem' }}>첫 댓글을 남겨보세요!</div>}
                                </CommentList>

                                {myPlayerData && (
                                    <CommentInputContainer>
                                        <CommentTextarea
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder="칭찬과 응원의 한마디! (엔터로 줄바꿈)"
                                            rows="2"
                                        />
                                        <CommentSubmitButton onClick={handleCommentSubmit}>등록</CommentSubmitButton>
                                    </CommentInputContainer>
                                )}
                            </ModalInfoSection>
                        </ModalBody>
                    </ModalContainer>
                </ModalBackground>
            )}

            <ImageModal
                src={modalImageSrc?.src}
                rotation={modalImageSrc?.rotation}
                onClose={() => setModalImageSrc(null)}
                onRotate={modalImageSrc?.onRotate}
            />
        </>
    );
}

export default MissionGalleryPage;