// src/pages/MissionGalleryPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { getApprovedSubmissions } from '../api/firebase';
import { Link, useNavigate } from 'react-router-dom';
import CommentThread from '../components/CommentThread'; // 공통 댓글 컴포넌트 import
import ImageModal from '../components/ImageModal'; // 이미지 확대 모달 import

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

const CardImage = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
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

// --- Modal Styled Components ---
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


function MissionGalleryPage() {
    const { players, missions } = useLeagueStore();
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMission, setSelectedMission] = useState('all');
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);

    useEffect(() => {
        const fetchSubmissions = async () => {
            setIsLoading(true);
            const approvedSubmissions = await getApprovedSubmissions();
            setSubmissions(approvedSubmissions);
            setIsLoading(false);
        };
        fetchSubmissions();
    }, []);

    const filteredSubmissions = useMemo(() => {
        if (selectedMission === 'all') {
            return submissions;
        }
        return submissions.filter(sub => sub.missionId === selectedMission);
    }, [submissions, selectedMission]);

    // 주간 인기 게시물 (임시 데이터)
    const hotSubmissions = useMemo(() => {
        return [...submissions]
            .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
            .slice(0, 3);
    }, [submissions]);

    const getPlayerName = (studentId) => players.find(p => p.id === studentId)?.name || '알 수 없음';
    const getMissionTitle = (missionId) => missions.find(m => m.id === missionId)?.title || '알 수 없음';

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
                            {sub.photoUrls && sub.photoUrls.length > 0 && <CardImage src={sub.photoUrls[0]} alt="미션 제출 이미지" />}
                            <CardContent>
                                <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                <CardAuthor>by {getPlayerName(sub.studentId)} ❤️ {sub.likes?.length || 0}</CardAuthor>
                            </CardContent>
                        </SubmissionCard>
                    ))}
                </GalleryGrid>

                <SectionTitle>✨ 전체 결과물</SectionTitle>
                <FilterContainer>
                    <MissionSelect value={selectedMission} onChange={(e) => setSelectedMission(e.target.value)}>
                        <option value="all">모든 미션 보기</option>
                        {missions.map(mission => (
                            <option key={mission.id} value={mission.id}>{mission.title}</option>
                        ))}
                    </MissionSelect>
                </FilterContainer>

                <GalleryGrid>
                    {filteredSubmissions.map(sub => (
                        <SubmissionCard key={sub.id} onClick={() => setSelectedSubmission(sub)}>
                            {sub.photoUrls && sub.photoUrls.length > 0 && <CardImage src={sub.photoUrls[0]} alt="미션 제출 이미지" />}
                            <CardContent>
                                <CardTitle>{getMissionTitle(sub.missionId)}</CardTitle>
                                <CardAuthor>by {getPlayerName(sub.studentId)}</CardAuthor>
                            </CardContent>
                        </SubmissionCard>
                    ))}
                </GalleryGrid>
                <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                    <Link to="/">홈으로 돌아가기</Link>
                </div>
            </Wrapper>

            {selectedSubmission && (
                <ModalBackground onClick={() => setSelectedSubmission(null)}>
                    <ModalContainer onClick={e => e.stopPropagation()}>
                        <ModalHeader>
                            <h2>{getMissionTitle(selectedSubmission.missionId)}</h2>
                            <p style={{ margin: 0, color: '#6c757d' }}>by {getPlayerName(selectedSubmission.studentId)}</p>
                        </ModalHeader>
                        <ModalContent>
                            <ModalSubmissionDetails>
                                {selectedSubmission.text && <p>{selectedSubmission.text}</p>}
                                {selectedSubmission.photoUrls && selectedSubmission.photoUrls.map((url, index) => (
                                    <img key={index} src={url} alt={`제출 이미지 ${index + 1}`} onClick={() => setModalImageSrc(url)} />
                                ))}
                            </ModalSubmissionDetails>
                            <div>
                                {selectedSubmission.comments?.map(comment => (
                                    <CommentThread
                                        key={comment.id}
                                        submissionId={selectedSubmission.id}
                                        comment={comment}
                                        missionTitle={getMissionTitle(selectedSubmission.missionId)}
                                        permissions={{ canLike: true, canReply: true, canEdit: false }}
                                    />
                                ))}
                            </div>
                        </ModalContent>
                    </ModalContainer>
                </ModalBackground>
            )}

            <ImageModal src={modalImageSrc} onClose={() => setModalImageSrc(null)} />
        </>
    );
}

export default MissionGalleryPage;