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

function MissionItem({ mission, myPlayerData, mySubmissions, canSubmitMission }) {
  const { submitMissionForApproval } = useLeagueStore();
  const [submissionContent, setSubmissionContent] = useState({ text: '', photo: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submissionStatus = mySubmissions[mission.id];
  const submissionType = mission.submissionType || ['simple'];
  const isSubmissionRequired = !submissionType.includes('simple');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSubmissionContent(prev => ({ ...prev, photo: file }));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || !!submissionStatus) return;

    // 글 또는 사진 중 하나라도 제출했는지 확인
    if (isSubmissionRequired) {
      const isTextRequired = submissionType.includes('text');
      const isPhotoRequired = submissionType.includes('photo');

      // 둘 다 제출 방식인데 아무것도 안했을 때
      if ((isTextRequired && isPhotoRequired) && !submissionContent.text.trim() && !submissionContent.photo) {
        return alert('글 또는 사진을 제출해야 합니다.');
      }
      // 글만 제출 방식인데 글 안 썼을 때
      if (isTextRequired && !isPhotoRequired && !submissionContent.text.trim()) {
        return alert('글 내용을 입력해주세요.');
      }
      // 사진만 제출 방식인데 사진 첨부 안했을 때
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

  // 버튼 활성화 조건: 이미 제출했거나, 제출 중이면 비활성화. 제출이 필요한 미션인데 내용이 없으면 비활성화
  const isButtonDisabled = !!submissionStatus || isSubmitting || (isSubmissionRequired && !submissionContent.text.trim() && !submissionContent.photo);

  return (
    <MissionCard>
      <MissionHeader>
        <MissionInfo>
          <MissionTitle>{mission.title}</MissionTitle>
          <MissionReward>💰 {mission.reward} P</MissionReward>
        </MissionInfo>
        {canSubmitMission && (
          <RequestButton
            onClick={handleSubmit}
            disabled={isButtonDisabled}
            $status={submissionStatus}
          >
            {isSubmitting && '요청 중...'}
            {!isSubmitting && submissionStatus === 'pending' && '승인 대기중'}
            {!isSubmitting && submissionStatus === 'approved' && '승인 완료!'}
            {!isSubmitting && !submissionStatus && '다 했어요!'}
          </RequestButton>
        )}
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

  const mySubmissions = useMemo(() => {
    if (!myPlayerData) return {};

    const submissionsMap = {};
    missionSubmissions
      .filter(sub => sub.studentId === myPlayerData.id)
      .forEach(sub => {
        submissionsMap[sub.missionId] = sub.status;
      });
    return submissionsMap;
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
              mySubmissions={mySubmissions}
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