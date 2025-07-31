// src/pages/MissionsPage.jsx

import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase';
import { useNavigate } from 'react-router-dom';

const MissionsWrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
`;

const MissionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* 카드 간 간격 조정 */
`;

const MissionCard = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column; /* 세로 정렬로 변경 */
  gap: 1rem;
`;

const MissionHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
`;

const MissionInfo = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    flex-grow: 1;
`;

const MissionTitle = styled.h3`
  margin: 0;
  font-size: 1.2rem;
`;

const MissionReward = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  color: #28a745;
  margin-top: 0.25rem;
`;

const SubmissionArea = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f0f0f0;
`;

const TextArea = styled.textarea`
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    font-size: 1rem;
    resize: vertical;
`;

const FileInputLabel = styled.label`
    padding: 0.75rem 1.2rem;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    font-weight: 500;
    &:hover {
        background-color: #e9ecef;
    }
`;

const FileName = styled.span`
    font-size: 0.9rem;
    color: #6c757d;
    margin-left: 1rem;
`;


const RequestButton = styled.button`
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
    font-weight: bold;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
    margin-left: 1rem; /* MissionInfo와의 간격 */

    background-color: ${props => {
    if (props.$status === 'approved') return '#007bff';
    if (props.$status === 'pending') return '#6c757d';
    return '#dc3545';
  }};


    &:hover:not(:disabled) {
        background-color: ${props => {
    if (props.$status === 'approved') return '#0056b3';
    if (props.$status === 'pending') return '#5a6268';
    return '#c82333';
  }};
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.8;
    }
`;

const ExitButton = styled.button`
  display: block;
  margin: 2rem auto 0;
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #5a6268;
  }
`;

// ▼▼▼ [추가] 제출물 상세 보기 UI 컴포넌트 ▼▼▼
const SubmissionDetails = styled.div`
    padding: ${props => props.$isOpen ? '1rem' : '0 1rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    border-top: ${props => props.$isOpen ? '1px solid #f0f0f0' : 'none'};
    margin-top: ${props => props.$isOpen ? '1rem' : '0'};

    p {
        background-color: #e9ecef;
        padding: 1rem;
        border-radius: 4px;
        white-space: pre-wrap;
        margin-top: 0;
    }
    
    img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin-top: 0.5rem;
    }
`;

function SubmissionDetailsView({ submission, isOpen }) {
  if (!submission || (!submission.text && !submission.photoUrl)) {
    return null;
  }

  return (
    <SubmissionDetails $isOpen={isOpen}>
      {submission.text && <p>{submission.text}</p>}
      {submission.photoUrl && <img src={submission.photoUrl} alt="제출된 사진" />}
    </SubmissionDetails>
  );
}
// ▲▲▲ 여기까지 추가 ▲▲▲

function MissionItem({ mission, myPlayerData, submission, canSubmitMission }) {
  const { submitMissionForApproval } = useLeagueStore();
  const [submissionContent, setSubmissionContent] = useState({ text: '', photo: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false); // [추가] 제출물 보기 상태

  const submissionStatus = submission?.status;
  const submissionType = mission.submissionType || ['simple'];
  const isSubmissionRequired = !submissionType.includes('simple');
  const hasViewableContent = submission && (submission.text || submission.photoUrl);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSubmissionContent(prev => ({ ...prev, photo: file }));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !!submissionStatus) return;

    if (isSubmissionRequired) {
      const isTextRequired = submissionType.includes('text');
      const isPhotoRequired = submissionType.includes('photo');

      if ((isTextRequired && isPhotoRequired) && !submissionContent.text.trim() && !submissionContent.photo) {
        return alert('글 또는 사진을 제출해야 합니다.');
      }
      if (isTextRequired && !isPhotoRequired && !submissionContent.text.trim()) {
        return alert('글 내용을 입력해주세요.');
      }
      if (isPhotoRequired && !isTextRequired && !submissionContent.photo) {
        return alert('사진 파일을 첨부해주세요.');
      }
    }

    setIsSubmitting(true);
    try {
      await submitMissionForApproval(mission.id, submissionContent);
      alert('미션 완료를 성공적으로 요청했습니다!');
    } catch (error) {
      alert(`요청 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderButton = () => {
    if (!canSubmitMission) return null;

    if (submissionStatus === 'approved') {
      if (hasViewableContent) {
        return (
          <RequestButton $status="approved" onClick={() => setIsDetailsOpen(prev => !prev)}>
            {isDetailsOpen ? '숨기기' : '제출물 보기'}
          </RequestButton>
        );
      }
      return <RequestButton $status="approved" disabled>승인 완료!</RequestButton>;
    }

    if (submissionStatus === 'pending') {
      return <RequestButton $status="pending" disabled>승인 대기중</RequestButton>;
    }

    const isButtonDisabled = isSubmitting || (isSubmissionRequired && !submissionContent.text.trim() && !submissionContent.photo);
    return (
      <RequestButton onClick={handleSubmit} disabled={isButtonDisabled}>
        {isSubmitting ? '요청 중...' : '다 했어요!'}
      </RequestButton>
    );
  };

  return (
    <MissionCard>
      <MissionHeader>
        <MissionInfo>
          <MissionTitle>{mission.title}</MissionTitle>
          <MissionReward>💰 {mission.reward} P</MissionReward>
        </MissionInfo>
        {renderButton()}
      </MissionHeader>

      {canSubmitMission && isSubmissionRequired && !submissionStatus && (
        <SubmissionArea>
          {submissionType.includes('text') && (
            <TextArea
              value={submissionContent.text}
              onChange={(e) => setSubmissionContent(prev => ({ ...prev, text: e.target.value }))}
              placeholder="미션 내용을 여기에 입력하세요..."
            />
          )}
          {submissionType.includes('photo') && (
            <div>
              <FileInputLabel htmlFor={`file-${mission.id}`}>
                📷 사진 첨부하기
                <input
                  id={`file-${mission.id}`}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </FileInputLabel>
              {submissionContent.photo && <FileName>{submissionContent.photo.name}</FileName>}
            </div>
          )}
        </SubmissionArea>
      )}

      {/* ▼▼▼ [추가] 승인 완료된 제출물 보기 ▼▼▼ */}
      <SubmissionDetailsView submission={submission} isOpen={isDetailsOpen} />
    </MissionCard>
  );
}


function MissionsPage() {
  const { players, missions, missionSubmissions } = useLeagueStore();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const myPlayerData = useMemo(() => {
    if (!currentUser) return null;
    return players.find(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  const mySubmissionsMap = useMemo(() => {
    if (!myPlayerData) return {};
    return missionSubmissions
      .filter(sub => sub.studentId === myPlayerData.id)
      .reduce((acc, sub) => {
        acc[sub.missionId] = sub;
        return acc;
      }, {});
  }, [missionSubmissions, myPlayerData]);

  const canSubmitMission = myPlayerData && ['player', 'recorder'].includes(myPlayerData.role);

  return (
    <MissionsWrapper>
      <Title>오늘의 미션</Title>
      <MissionList>
        {missions.length > 0 ? (
          missions.map(mission => (
            <MissionItem
              key={mission.id}
              mission={mission}
              myPlayerData={myPlayerData}
              submission={mySubmissionsMap[mission.id]}
              canSubmitMission={canSubmitMission}
            />
          ))
        ) : (
          <p style={{ textAlign: 'center' }}>현재 진행 중인 미션이 없습니다.</p>
        )}
      </MissionList>

      <ExitButton onClick={() => navigate(-1)}>
        나가기
      </ExitButton>
    </MissionsWrapper>
  );
}

export default MissionsPage;