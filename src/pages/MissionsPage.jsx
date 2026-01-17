// src/pages/MissionsPage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components'; // css 추가
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, getMissionHistory, db } from '../api/firebase';
import { doc, getDoc } from 'firebase/firestore';
import MissionHistoryModal from '../components/MissionHistoryModal';
import { useNavigate, useLocation } from 'react-router-dom';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const MissionsWrapper = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
  animation: ${fadeIn} 0.5s ease-out;
  padding-bottom: 5rem;
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 800;
  color: #343a40;
  margin-bottom: 0.5rem;
`;

const SubTitle = styled.p`
  color: #868e96;
  font-size: 1rem;
  font-weight: 500;
`;

const MissionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const MissionCard = styled.div`
  background-color: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  position: relative;
  overflow: hidden;
  border: 1px solid #f1f3f5;
  transition: transform 0.2s;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 6px;
    background-color: ${props => {
    if (props.$status === 'approved' || props.$status === 'APPROVED_TODAY') return '#20c997'; // 초록
    if (props.$status === 'pending' || props.$status === 'PENDING_TODAY') return '#adb5bd'; // 회색
    if (props.$status === 'rejected' || props.$status === 'REJECTED_TODAY') return '#fa5252'; // 빨강
    return '#339af0'; // 기본 파랑 (작성 가능)
  }};
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
  }
`;

const MissionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
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
  font-size: 1.3rem;
  font-weight: 700;
  color: #343a40;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background-color: ${props => props.$bg || '#f1f3f5'};
  color: ${props => props.$color || '#495057'};
  font-weight: 700;
`;

const MissionReward = styled.div`
  font-size: 1rem;
  font-weight: 800;
  color: #fcc419;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  text-shadow: 0 1px 1px rgba(0,0,0,0.1);
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 600px) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const VisibilityToggleButton = styled.button`
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  background-color: ${props => props.$isPublic ? '#e7f5ff' : '#fff5f5'};
  color: ${props => props.$isPublic ? '#1c7ed6' : '#e03131'};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:disabled {
    background-color: #f1f3f5;
    color: #adb5bd;
    cursor: not-allowed;
  }
`;

const SubmissionArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 1.2rem;
  background-color: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #f1f3f5;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  background-color: ${props => props.disabled ? '#e9ecef' : '#fff'};
  transition: border-color 0.2s;
  outline: none;
  
  &:focus {
    border-color: #339af0;
    box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1);
  }
`;

const FileInputLabel = styled.label`
  padding: 0.8rem;
  background-color: #fff;
  border: 1px dashed #adb5bd;
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
  font-weight: 600;
  color: #495057;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  ${props => props.disabled && `
    background-color: #e9ecef;
    cursor: not-allowed;
    opacity: 0.7;
    border-style: solid;
    border-color: #dee2e6;
  `}

  &:hover:not([disabled]) {
    background-color: #f1f3f5;
    border-color: #495057;
  }
`;

const FileName = styled.div`
  font-size: 0.9rem;
  color: #495057;
  background: #fff;
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  
  strong { display: block; margin-bottom: 0.4rem; font-size: 0.85rem; color: #868e96; }
  ul { margin: 0; padding-left: 1.2rem; }
  li { margin-bottom: 0.2rem; }
`;

const ClearButton = styled.button`
  background: none;
  border: none;
  color: #fa5252;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  margin-left: 0.5rem;
  &:hover { text-decoration: underline; }
`;

const RequestButton = styled.button`
  padding: 0.7rem 1.2rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);

  background-color: ${props => {
    if (props.$status === 'approved') return '#20c997';
    if (props.$status === 'pending') return '#868e96';
    if (props.$status === 'rejected') return '#fab005';
    return '#339af0';
  }};

  color: ${props => (props.$status === 'rejected' ? '#fff' : 'white')};

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    filter: brightness(0.95);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
    box-shadow: none;
  }
`;

const SubmissionDetails = styled.div`
  padding: ${props => props.$isOpen ? '1rem' : '0 1rem'};
  max-height: ${props => props.$isOpen ? '1000px' : '0'};
  opacity: ${props => props.$isOpen ? 1 : 0};
  overflow: hidden;
  transition: all 0.4s ease-in-out;
  border-top: ${props => props.$isOpen ? '1px solid #f1f3f5' : 'none'};
  margin-top: ${props => props.$isOpen ? '1rem' : '0'};
  background-color: #fcfcfc;

  p {
    background-color: #fff;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid #f1f3f5;
    white-space: pre-wrap;
    margin-top: 0;
    color: #495057;
    line-height: 1.6;
  }
  
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin-top: 0.5rem;
    border: 1px solid #dee2e6;
  }
`;

const FilterContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ToggleButton = styled.button`
  padding: 0.6rem 1.2rem;
  font-size: 0.9rem;
  font-weight: 700;
  border: 2px solid ${props => props.$active ? '#339af0' : '#dee2e6'};
  border-radius: 20px;
  cursor: pointer;
  background-color: ${props => props.$active ? '#e7f5ff' : '#fff'};
  color: ${props => props.$active ? '#1c7ed6' : '#868e96'};
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => props.$active ? '#d0ebff' : '#f8f9fa'};
  }
`;

// [추가] 통일된 스타일의 버튼 컨테이너 및 버튼
const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
`;

const ActionButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: 800;
  color: ${props => props.$primary ? 'white' : '#495057'};
  background: ${props => props.$primary ? '#339af0' : '#f1f3f5'};
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
    filter: brightness(0.95);
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

function MissionItem({ mission, myPlayerData, mySubmissions, canSubmitMission, onHistoryView }) {
  const { classId } = useClassStore();
  const { submitMissionForApproval } = useLeagueStore();
  const [submissionContent, setSubmissionContent] = useState({ text: '', photos: [], isPublic: !mission.defaultPrivate });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
      alert('미션 완료를 성공적으로 요청했습니다! 🎉');
      setSubmissionContent({ text: mission.placeholderText ? mission.placeholderText + '\n\n' : '', photos: [], isPublic: !mission.defaultPrivate });
    } catch (error) {
      alert(`요청 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
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
        default: actionButtonText = '미션 제출'; actionButtonStyle = 'default'; break;
      }
    }

    return (
      <ActionGroup>
        {hasSubmission && (
          <RequestButton $status="pending" onClick={() => onHistoryView(mission)} style={{ backgroundColor: '#fff', color: '#868e96', border: '1px solid #dee2e6' }}>
            📋 기록 보기
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
                {submissionContent.isPublic ? '🌐 갤러리 공개' : '🔒 비공개 제출'}
              </VisibilityToggleButton>
            )}
            <RequestButton onClick={isActionable ? handleSubmit : null} disabled={isButtonDisabled} $status={actionButtonStyle}>
              {actionButtonText}
            </RequestButton>
          </>
        )}
      </ActionGroup>
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
      <MissionCard $status={missionStatus}>
        <MissionHeader>
          <MissionInfo>
            <MissionTitle>
              {mission.title}
              {mission.isFixed && <Tag $bg="#e7f5ff" $color="#1c7ed6">🔄 매일</Tag>}
              {submissionType?.includes('text') && <Tag $bg="#fff0f6" $color="#c2255c">📝 글</Tag>}
              {submissionType?.includes('photo') && <Tag $bg="#e6fcf5" $color="#0ca678">📸 사진</Tag>}
            </MissionTitle>
            <MissionReward>{rewardText}</MissionReward>
          </MissionInfo>
          {renderButtons()}
        </MissionHeader>

        {showSubmissionArea && (
          <SubmissionArea>
            {submissionType.includes('text') && (
              <TextArea
                value={textAreaValue}
                onChange={(e) => setSubmissionContent(prev => ({ ...prev, text: e.target.value }))}
                disabled={isInputDisabled}
                placeholder="여기에 미션 내용을 작성해주세요!"
              />
            )}
            {submissionType.includes('photo') && (
              <div>
                <FileInputLabel htmlFor={`file-${mission.id}`} disabled={isInputDisabled}>
                  <span style={{ fontSize: '1.5rem' }}>📸</span>
                  <span>사진 추가하기 {submissionContent.photos.length > 0 ? `(${submissionContent.photos.length}장)` : ''}</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>첨부된 파일:</strong>
                      <ClearButton onClick={handleClearPhotos}>[전체 삭제]</ClearButton>
                    </div>
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
    </>
  );
}


function MissionsPage() {
  const { classId } = useClassStore();
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
      if (!classId) return;
      const params = new URLSearchParams(location.search);
      const submissionId = params.get('openHistoryForSubmission');
      if (submissionId && myPlayerData) {
        try {
          const submissionDoc = await getDoc(doc(db, 'classes', classId, 'missionSubmissions', submissionId));
          if (submissionDoc.exists()) {
            const submissionData = submissionDoc.data();
            const mission = missions.find(m => m.id === submissionData.missionId);
            if (mission && submissionData.studentId === myPlayerData.id) {
              const history = await getMissionHistory(classId, myPlayerData.id, mission.id);
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
  }, [location, navigate, myPlayerData, missions, classId]);


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
    if (!classId || !myPlayerData) return;
    const history = await getMissionHistory(classId, myPlayerData.id, mission.id);
    setHistoryModalState({ isOpen: true, missionTitle: mission.title, history, student: myPlayerData });
  };

  const canSubmitMission = myPlayerData && ['player', 'recorder', 'admin'].includes(myPlayerData.role);

  return (
    <>
      <MissionsWrapper>
        <HeaderSection>
          <Title>🚀 오늘의 미션</Title>
          <SubTitle>오늘 수행해야 할 미션을 확인하고 완료해주세요!</SubTitle>
        </HeaderSection>

        <FilterContainer>
          <ToggleButton onClick={() => setHideCompleted(prev => !prev)} $active={!hideCompleted}>
            {hideCompleted ? '모든 미션 보기' : '할 일만 보기'}
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
            <div style={{ textAlign: 'center', padding: '3rem', color: '#868e96', background: '#f8f9fa', borderRadius: '16px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3>와우! 모든 미션을 완료했어요!</h3>
              <p>정말 대단해요! 내일도 파이팅!</p>
            </div>
          )}
        </MissionList>

        {/* [수정] 통일된 스타일의 하단 버튼 */}
        <ButtonGroup>
          <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
          <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
        </ButtonGroup>
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