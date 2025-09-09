// src/pages/MissionsPage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore'; // [수정]
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

const VisibilityToggleButton = styled.button`
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    background-color: ${props => props.$isPublic ? '#007bff' : '#dc3545'};
    color: white;
    transition: background-color 0.2s;

    &:disabled {
        background-color: #6c757d;
        opacity: 0.7;
    }
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
    min-height: 150px;
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

const ClearButton = styled.button`
    background: none;
    border: none;
    color: #dc3545;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    margin-left: 0.5rem;
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

const isDateToday = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return false;
  const date = timestamp.toDate();
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
};


function SubmissionDetailsView({ submission, isOpen }) {
  if (!submission || (!submission.text && !submission.photoUrls)) {
    return null;
  }

  return (
    <SubmissionDetails $isOpen={isOpen}>
      {submission.text && <p>{submission.text}</p>}
      {submission.photoUrls && submission.photoUrls.map((url, index) => (
        <img key={index} src={url} alt={`제출된 사진 ${index + 1}`} style={{ marginBottom: '0.5rem' }} />
      ))}
    </SubmissionDetails>
  );
}

function MissionItem({ mission, myPlayerData, mySubmissions, canSubmitMission }) {
  const { classId } = useClassStore(); // [추가]
  const { submitMissionForApproval } = useLeagueStore();
  const [submissionContent, setSubmissionContent] = useState({ text: '', photos: [], isPublic: !mission.defaultPrivate });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [missionHistory, setMissionHistory] = useState([]);

  const submission = mySubmissions[mission.id];

  const missionStatus = useMemo(() => {
    if (!submission) return 'NOT_SUBMITTED';
    if (mission.isFixed) {
      if (submission.status === 'approved' && isDateToday(submission.approvedAt)) return 'APPROVED_TODAY';
      if (submission.status === 'pending' && isDateToday(submission.requestedAt)) return 'PENDING_TODAY';
      if (submission.status === 'rejected' && isDateToday(submission.requestedAt)) return 'REJECTED_TODAY';
      return 'SUBMITTABLE';
    }
    return submission.status;
  }, [submission, mission.isFixed]);

  useEffect(() => {
    const initialIsPublic = submission?.isPublic !== undefined ? submission.isPublic : !mission.defaultPrivate;
    if (submission?.status === 'rejected') {
      setSubmissionContent({ text: submission.text || '', photos: [], isPublic: initialIsPublic });
    } else if (mission.placeholderText) {
      setSubmissionContent({ text: mission.placeholderText + '\n\n', photos: [], isPublic: initialIsPublic });
    } else {
      setSubmissionContent({ text: '', photos: [], isPublic: initialIsPublic });
    }
  }, [submission, mission.placeholderText, mission.id, mission.defaultPrivate]);


  const submissionType = mission.submissionType || ['simple'];
  const isSubmissionRequired = !submissionType.includes('simple');

  const isPrerequisiteSubmitted = useMemo(() => {
    if (!mission.prerequisiteMissionId) return true;
    const prerequisiteSubmission = mySubmissions[mission.prerequisiteMissionId];
    return prerequisiteSubmission?.status === 'approved';
  }, [mission.prerequisiteMissionId, mySubmissions]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSubmissionContent(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
      e.target.value = null;
    }
  };

  const handleClearPhotos = () => {
    setSubmissionContent(prev => ({ ...prev, photos: [] }));
  };

  const handleSubmit = async () => {
    const isDoneOrPending = ['APPROVED_TODAY', 'PENDING_TODAY', 'approved', 'pending'].includes(missionStatus);
    if (isSubmitting || isDoneOrPending || !isPrerequisiteSubmitted) return;

    const { text: currentText, photos: currentPhotos, isPublic } = submissionContent;

    if (isSubmissionRequired) {
      const requiresText = submissionType.includes('text');
      const requiresPhoto = submissionType.includes('photo');
      const hasRealText = currentText.trim() !== '' && currentText.trim() !== mission.placeholderText?.trim();
      const hasPhotos = currentPhotos.length > 0;

      if (requiresText && !requiresPhoto && !hasRealText) {
        return alert('글 내용을 입력해주세요.');
      }
      if (requiresPhoto && !requiresText && !hasPhotos) {
        return alert('사진 파일을 한 장 이상 첨부해주세요.');
      }
      if (requiresText && requiresPhoto && !hasRealText && !hasPhotos) {
        return alert('글을 작성하거나 사진을 한 장 이상 첨부해주세요.');
      }
    }

    setIsSubmitting(true);
    try {
      await submitMissionForApproval(mission.id, { text: currentText, photos: currentPhotos, isPublic });
      alert('미션 완료를 성공적으로 요청했습니다!');
      setSubmissionContent({ text: mission.placeholderText ? mission.placeholderText + '\n\n' : '', photos: [], isPublic: !mission.defaultPrivate });
    } catch (error) {
      alert(`요청 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHistoryView = async (e) => {
    e.stopPropagation();
    if (!classId || !myPlayerData) return; // [추가]
    const history = await getMissionHistory(classId, myPlayerData.id, mission.id); // [수정]
    setMissionHistory(history);
    setIsHistoryModalOpen(true);
  };

  const renderButtons = () => {
    if (!canSubmitMission) return null;

    const hasSubmission = !!submission;
    const isActionable = ['NOT_SUBMITTED', 'REJECTED_TODAY', 'rejected', 'SUBMITTABLE'].includes(missionStatus);
    const isDoneOrPending = ['APPROVED_TODAY', 'PENDING_TODAY', 'approved', 'pending'].includes(missionStatus);
    const isButtonDisabled = isSubmitting || !isPrerequisiteSubmitted || isDoneOrPending;

    let actionButtonText;
    let actionButtonStyle;

    if (isSubmitting) {
      actionButtonText = '요청 중...';
      actionButtonStyle = 'pending';
    } else {
      switch (missionStatus) {
        case 'APPROVED_TODAY': actionButtonText = '오늘 완료!'; actionButtonStyle = 'approved'; break;
        case 'PENDING_TODAY': actionButtonText = '승인 대기중'; actionButtonStyle = 'pending'; break;
        case 'REJECTED_TODAY': actionButtonText = '다시 제출하기'; actionButtonStyle = 'rejected'; break;
        case 'approved': actionButtonText = '승인 완료!'; actionButtonStyle = 'approved'; break;
        case 'pending': actionButtonText = '승인 대기중'; actionButtonStyle = 'pending'; break;
        case 'rejected': actionButtonText = '다시 제출하기'; actionButtonStyle = 'rejected'; break;
        default: actionButtonText = '다 했어요!'; actionButtonStyle = 'default'; break;
      }
    }

    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {hasSubmission && (
          <RequestButton $status="approved" onClick={handleHistoryView}>
            기록 보기
          </RequestButton>
        )}
        {(isActionable || isDoneOrPending) && (
          <>
            {isSubmissionRequired && isActionable && (
              <VisibilityToggleButton
                $isPublic={submissionContent.isPublic}
                onClick={(e) => {
                  e.stopPropagation();
                  setSubmissionContent(prev => ({ ...prev, isPublic: !prev.isPublic }));
                }}
                disabled={isButtonDisabled}
                title={mission.defaultPrivate ? "이 미션은 기본적으로 비공개 제출됩니다." : "이 미션은 기본적으로 갤러리에 공개됩니다."}
              >
                {submissionContent.isPublic ? '갤러리 공개' : '비공개 제출'}
              </VisibilityToggleButton>
            )}
            <RequestButton onClick={isActionable ? handleSubmit : null} disabled={isButtonDisabled} $status={actionButtonStyle}>
              {actionButtonText}
            </RequestButton>
          </>
        )}
      </div>
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
    <>
      <MissionCard $status={submission?.status}>
        <MissionHeader>
          <MissionInfo>
            <MissionTitle>
              {mission.title}
              {mission.isFixed && <span title="고정 미션"> 🔄</span>}
              {submissionType?.includes('text') && <span title="글 제출"> 📝</span>}
              {submissionType?.includes('photo') && <span title="사진 제출"> 📸</span>}
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
                  📷 사진 추가하기
                  <input
                    id={`file-${mission.id}`}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={isInputDisabled}
                  />
                </FileInputLabel>
                {submissionContent.photos.length > 0 && (
                  <FileName>
                    <strong>첨부된 파일 ({submissionContent.photos.length}개):</strong>
                    <ClearButton onClick={handleClearPhotos}>[전체 삭제]</ClearButton>
                    <ul>
                      {submissionContent.photos.map((f, i) => <li key={i}>{f.name}</li>)}
                    </ul>
                  </FileName>
                )}
              </div>
            )}
          </SubmissionArea>
        )}

        <SubmissionDetailsView submission={submission} isOpen={isDetailsOpen} />
      </MissionCard>
      <MissionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        missionTitle={mission.title}
        history={missionHistory}
      />
    </>
  );
}


function MissionsPage() {
  const { classId } = useClassStore(); // [추가]
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
      if (!classId) return; // [추가]
      const params = new URLSearchParams(location.search);
      const submissionId = params.get('openHistoryForSubmission');
      if (submissionId && myPlayerData) {
        try {
          const submissionDoc = await getDoc(doc(db, 'classes', classId, 'missionSubmissions', submissionId)); // [수정]
          if (submissionDoc.exists()) {
            const submissionData = submissionDoc.data();
            const mission = missions.find(m => m.id === submissionData.missionId);
            if (mission && submissionData.studentId === myPlayerData.id) {
              const history = await getMissionHistory(classId, myPlayerData.id, mission.id); // [수정]
              setHistoryModalState({
                isOpen: true,
                missionTitle: mission.title,
                history: history,
                student: myPlayerData
              });
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
  }, [location, navigate, myPlayerData, missions, classId]); // [수정]


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
          return false;
        }
      } else {
        if (submission.status === 'approved') {
          return false;
        }
      }

      return true;
    });
  }, [missions, mySubmissionsMap, hideCompleted]);

  const handleHistoryView = async (mission) => {
    if (!classId || !myPlayerData) return; // [추가]
    const history = await getMissionHistory(classId, myPlayerData.id, mission.id); // [수정]
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
