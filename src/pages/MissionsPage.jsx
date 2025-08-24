// src/pages/MissionsPage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, getMissionHistory, db } from '../api/firebase';
import { doc, getDoc } from 'firebase/firestore';
import MissionHistoryModal from '../components/MissionHistoryModal';
import { useNavigate, useLocation } from 'react-router-dom';

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
  gap: 1.5rem;
`;

const MissionCard = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-left: 5px solid ${props => props.$status === 'rejected' ? '#ffc107' : 'transparent'};
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
    background-color: ${props => props.disabled ? '#e9ecef' : '#fff'};
`;

const FileInputLabel = styled.label`
    padding: 0.75rem 1.2rem;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    font-weight: 500;
    
    ${props => props.disabled && `
      background-color: #e9ecef;
      cursor: not-allowed;
      opacity: 0.7;
    `}

    &:hover {
        background-color: ${props => props.disabled ? '#e9ecef' : '#dee2e6'};
    }
`;

const FileName = styled.div`
    font-size: 0.9rem;
    color: #6c757d;
    margin-top: 0.5rem;
    padding-left: 1rem;
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
    margin-left: 1rem;

    background-color: ${props => {
    if (props.$status === 'approved') return '#007bff';
    if (props.$status === 'pending') return '#6c757d';
    if (props.$status === 'rejected') return '#ffc107';
    return '#dc3545';
  }};

    color: ${props => (props.$status === 'rejected' ? 'black' : 'white')};


    &:hover:not(:disabled) {
        background-color: ${props => {
    if (props.$status === 'approved') return '#0056b3';
    if (props.$status === 'pending') return '#5a6268';
    if (props.$status === 'rejected') return '#e0a800';
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

const FilterContainer = styled.div`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 1rem;
`;

const ToggleButton = styled.button`
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    border: 1px solid #ced4da;
    border-radius: 8px;
    cursor: pointer;
    background-color: ${props => props.$active ? '#6c757d' : '#fff'};
    color: ${props => props.$active ? '#fff' : '#495057'};
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: #e9ecef;
    }
`;

// =================================================================
// ▼▼▼ [핵심] 헬퍼 함수: 날짜가 오늘인지 정확하게 확인합니다. ▼▼▼
// =================================================================
const isDateToday = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return false;

  const date = timestamp.toDate();
  const today = new Date();

  // 시, 분, 초를 무시하고 년, 월, 일만 비교합니다.
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
};


function SubmissionDetailsView({ submission, isOpen }) {
  // [수정] photoUrl을 photoUrls 배열로 변경하여 처리합니다.
  if (!submission || (!submission.text && !submission.photoUrls)) {
    return null;
  }

  return (
    <SubmissionDetails $isOpen={isOpen}>
      {submission.text && <p>{submission.text}</p>}
      {/* [수정] photoUrls 배열을 순회하며 모든 이미지를 보여줍니다. */}
      {submission.photoUrls && submission.photoUrls.map((url, index) => (
        <img key={index} src={url} alt={`제출된 사진 ${index + 1}`} style={{ marginBottom: '0.5rem' }} />
      ))}
    </SubmissionDetails>
  );
}

function MissionItem({ mission, myPlayerData, mySubmissions, canSubmitMission }) {
  const { submitMissionForApproval } = useLeagueStore();
  // [수정] photo를 photos 배열로 변경하여 여러 파일을 관리합니다.
  const [submissionContent, setSubmissionContent] = useState({ text: '', photos: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const submission = mySubmissions[mission.id];

  const missionStatus = useMemo(() => {
    if (!submission) return 'NOT_SUBMITTED';

    if (mission.isFixed) {
      if (submission.status === 'approved' && isDateToday(submission.approvedAt)) return 'APPROVED_TODAY';
      if (submission.status === 'pending' && isDateToday(submission.requestedAt)) return 'PENDING_TODAY';
      if (submission.status === 'rejected' && isDateToday(submission.requestedAt)) return 'REJECTED_TODAY';
      return 'SUBMITTABLE'; // 어제 완료했거나 오늘 아직 안 한 상태
    }

    return submission.status; // 일반 미션
  }, [submission, mission.isFixed]);

  useEffect(() => {
    // [수정] photos를 빈 배열로 초기화하도록 변경합니다.
    if (submission?.status === 'rejected') {
      setSubmissionContent({ text: submission.text || '', photos: [] });
    } else if (mission.placeholderText) {
      setSubmissionContent({ text: mission.placeholderText + '\n\n', photos: [] });
    } else {
      setSubmissionContent({ text: '', photos: [] });
    }
  }, [submission, mission.placeholderText]);

  const submissionType = mission.submissionType || ['simple'];
  const isSubmissionRequired = !submissionType.includes('simple');

  const isPrerequisiteSubmitted = useMemo(() => {
    if (!mission.prerequisiteMissionId) return true;
    const prerequisiteSubmission = mySubmissions[mission.prerequisiteMissionId];
    return prerequisiteSubmission?.status === 'approved';
  }, [mission.prerequisiteMissionId, mySubmissions]);


  const handleFileChange = (e) => {
    // [수정] 여러 파일을 배열로 받아 처리합니다.
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSubmissionContent(prev => ({ ...prev, photos: files }));
    }
  };

  const handleSubmit = async () => {
    const isDoneOrPending = ['APPROVED_TODAY', 'PENDING_TODAY', 'approved', 'pending'].includes(missionStatus);
    if (isSubmitting || isDoneOrPending || !isPrerequisiteSubmitted) return;

    if (isSubmissionRequired) {
      const requiresText = submissionType.includes('text');
      const requiresPhoto = submissionType.includes('photo');
      const hasText = submissionContent.text.trim() !== '';
      const hasPhotos = submissionContent.photos.length > 0;

      // 둘 다 요구하는데, 둘 다 없는 경우에만 막기
      if (requiresText && requiresPhoto && !hasText && !hasPhotos) {
        return alert('글을 작성하거나 사진을 한 장 이상 첨부해주세요.');
      }
      // 글만 요구하는데 글이 없는 경우
      if (requiresText && !requiresPhoto && !hasText) {
        return alert('글 내용을 입력해주세요.');
      }
      // 사진만 요구하는데 사진이 없는 경우
      if (!requiresText && requiresPhoto && !hasPhotos) {
        return alert('사진 파일을 한 장 이상 첨부해주세요.');
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

  const renderButtons = () => {
    if (!canSubmitMission) return null;

    const isDoneOrPending = ['APPROVED_TODAY', 'PENDING_TODAY', 'approved', 'pending'].includes(missionStatus);
    const isButtonDisabled = isSubmitting || !isPrerequisiteSubmitted || isDoneOrPending;

    let buttonText;
    let buttonStatusStyle;

    if (isSubmitting) {
      buttonText = '요청 중...';
      buttonStatusStyle = 'pending';
    } else {
      switch (missionStatus) {
        case 'APPROVED_TODAY': buttonText = '오늘 완료!'; buttonStatusStyle = 'approved'; break;
        case 'PENDING_TODAY': buttonText = '승인 대기중'; buttonStatusStyle = 'pending'; break;
        case 'REJECTED_TODAY': buttonText = '다시 제출하기'; buttonStatusStyle = 'rejected'; break;
        case 'approved': buttonText = '기록 및 댓글 보기'; buttonStatusStyle = 'approved'; break;
        case 'pending': buttonText = '승인 대기중'; buttonStatusStyle = 'pending'; break;
        case 'rejected': buttonText = '다시 제출하기'; buttonStatusStyle = 'rejected'; break;
        default: buttonText = '다 했어요!'; buttonStatusStyle = 'default'; break;
      }
    }

    const handleClick = missionStatus === 'approved' ? () => onHistoryView(mission) : handleSubmit;

    if (mission.isFixed) {
      return (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <RequestButton $status="approved" onClick={() => onHistoryView(mission)}>기록 보기</RequestButton>
          <RequestButton onClick={handleSubmit} disabled={isButtonDisabled} $status={buttonStatusStyle}>
            {buttonText}
          </RequestButton>
        </div>
      );
    }

    return (
      <RequestButton onClick={handleClick} disabled={isButtonDisabled} $status={buttonStatusStyle}>
        {buttonText}
      </RequestButton>
    );
  };

  const rewardText = useMemo(() => {
    if (!mission.rewards || mission.rewards.length <= 1) {
      return `💰 ${mission.reward} P`;
    }
    const minReward = Math.min(...mission.rewards);
    const maxReward = Math.max(...mission.rewards);
    return `💰 ${minReward} ~ ${maxReward} P`;
  }, [mission.rewards, mission.reward]);

  const showSubmissionArea = isSubmissionRequired && !['APPROVED_TODAY', 'approved'].includes(missionStatus);
  const isInputDisabled = !isPrerequisiteSubmitted || isSubmitting || ['PENDING_TODAY', 'pending'].includes(missionStatus);
  const textAreaValue = isInputDisabled ? (submission?.text || "") : submissionContent.text;

  return (
    <MissionCard $status={submission?.status}>
      <MissionHeader>
        <MissionInfo>
          <MissionTitle>
            {mission.title}
            {mission.isFixed && <span title="고정 미션"> 🔄</span>}
            {mission.submissionType?.includes('text') && <span title="글 제출"> 📝</span>}
            {mission.submissionType?.includes('photo') && <span title="사진 제출"> 📸</span>}
          </MissionTitle>
          <MissionReward>{rewardText}</MissionReward>
        </MissionInfo>
        <div style={{ display: 'flex' }}>
          {renderButtons()}
        </div>
      </MissionHeader>

      {showSubmissionArea && (
        <SubmissionArea>
          {submissionType.includes('text') && (
            <TextArea
              value={textAreaValue}
              onChange={(e) => setSubmissionContent(prev => ({ ...prev, text: e.target.value }))}
              disabled={isInputDisabled}
            />
          )}
          {submissionType.includes('photo') && (
            <div>
              <FileInputLabel htmlFor={`file-${mission.id}`} disabled={isInputDisabled}>
                📷 사진 첨부하기 (여러 장 가능)
                <input
                  id={`file-${mission.id}`}
                  type="file"
                  accept="image/*"
                  multiple // [추가] multiple 속성을 추가하여 여러 파일 선택을 활성화합니다.
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  disabled={isInputDisabled}
                />
              </FileInputLabel>
              {/* [수정] 선택된 파일 목록을 보여줍니다. */}
              {submissionContent.photos.length > 0 && (
                <FileName>
                  {submissionContent.photos.map(f => f.name).join(', ')}
                </FileName>
              )}
            </div>
          )}
        </SubmissionArea>
      )}

      <SubmissionDetailsView submission={submission} isOpen={isDetailsOpen} />
    </MissionCard>
  );
}


function MissionsPage() {
  const { players, missions, missionSubmissions } = useLeagueStore();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = auth.currentUser;
  const [hideCompleted, setHideCompleted] = useState(true);
  const [historyModalState, setHistoryModalState] = useState({ isOpen: false, missionTitle: '', history: [], student: null });

  const myPlayerData = useMemo(() => {
    if (!currentUser) return null;
    return players.find(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  useEffect(() => {
    const openModalFromLink = async () => {
      const params = new URLSearchParams(location.search);
      const submissionId = params.get('openHistoryForSubmission');
      if (submissionId && myPlayerData) {
        try {
          const submissionDoc = await getDoc(doc(db, 'missionSubmissions', submissionId));
          if (submissionDoc.exists()) {
            const submissionData = submissionDoc.data();
            const mission = missions.find(m => m.id === submissionData.missionId);
            if (mission && submissionData.studentId === myPlayerData.id) {
              const history = await getMissionHistory(myPlayerData.id, mission.id);
              setHistoryModalState({
                isOpen: true,
                missionTitle: mission.title,
                history: history,
                student: myPlayerData
              });
              // URL에서 파라미터 제거
              navigate(location.pathname, { replace: true });
            }
          }
        } catch (error) {
          console.error("Error opening history modal from link:", error);
        }
      }
    };
    if (myPlayerData && missions.length > 0) {
      openModalFromLink();
    }
  }, [location, navigate, myPlayerData, missions]);


  const mySubmissionsMap = useMemo(() => {
    if (!myPlayerData) return {};
    const submissionsMap = {};
    const sortedSubmissions = [...missionSubmissions].sort((a, b) => (b.requestedAt?.toMillis() || 0) - (a.requestedAt?.toMillis() || 0));

    sortedSubmissions.forEach(sub => {
      if (sub.studentId === myPlayerData.id) {
        if (!submissionsMap[sub.missionId]) {
          submissionsMap[sub.missionId] = sub;
        }
      }
    });
    return submissionsMap;
  }, [missionSubmissions, myPlayerData]);

  const filteredMissions = useMemo(() => {
    if (!hideCompleted) {
      return missions;
    }

    return missions.filter(mission => {
      const submission = mySubmissionsMap[mission.id];
      if (!submission) return true;

      if (mission.isFixed) {
        if (submission.status === 'approved' && isDateToday(submission.approvedAt)) {
          return false; // 오늘 완료한 고정 미션은 숨김
        }
      } else {
        if (submission.status === 'approved') {
          return false; // 완료한 일반 미션은 숨김
        }
      }

      return true;
    });
  }, [missions, mySubmissionsMap, hideCompleted]);

  const handleHistoryView = async (mission) => {
    if (!myPlayerData) return;
    const history = await getMissionHistory(myPlayerData.id, mission.id);
    setHistoryModalState({ isOpen: true, missionTitle: mission.title, history, student: myPlayerData });
  };

  const canSubmitMission = myPlayerData && ['player', 'recorder', 'admin'].includes(myPlayerData.role);

  return (
    <>
      <MissionsWrapper>
        <Title>오늘의 미션</Title>

        <FilterContainer>
          <ToggleButton onClick={() => setHideCompleted(prev => !prev)} $active={!hideCompleted}>
            {hideCompleted ? '완료 미션 보이기' : '완료 미션 숨기기'}
          </ToggleButton>
        </FilterContainer>

        <MissionList>
          {filteredMissions.length > 0 ? (
            filteredMissions.map(mission => (
              <MissionItem
                key={mission.id}
                mission={mission}
                myPlayerData={myPlayerData}
                mySubmissions={mySubmissionsMap}
                canSubmitMission={canSubmitMission}
                onHistoryView={handleHistoryView}
              />
            ))
          ) : (
            <p style={{ textAlign: 'center' }}>{hideCompleted ? "남아있는 미션이 없습니다! 👍" : "현재 진행 중인 미션이 없습니다."}</p>
          )}
        </MissionList>

        <ExitButton onClick={() => navigate(-1)}>
          나가기
        </ExitButton>
      </MissionsWrapper>
      <MissionHistoryModal
        isOpen={historyModalState.isOpen}
        onClose={() => setHistoryModalState({ isOpen: false, missionTitle: '', history: [], student: null })}
        missionTitle={historyModalState.missionTitle}
        history={historyModalState.history}
        student={historyModalState.student}
      />
    </>
  );
}

export default MissionsPage;