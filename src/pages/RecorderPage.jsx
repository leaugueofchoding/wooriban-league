// src/pages/RecorderPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, approveMissionsInBatch, getMissionHistory } from '../api/firebase';
import MissionHistoryModal from '../components/MissionHistoryModal';
import ImageModal from '../components/ImageModal';
import { useParams, useNavigate } from 'react-router-dom';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

// --- Styled Components ---
const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem 1rem 6rem 1rem;
  background-color: #f1f3f5;
  font-family: 'Pretendard', sans-serif;
`;

const ContentWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  animation: ${fadeIn} 0.4s ease-out;
`;

const HeaderSection = styled.div`
  margin-bottom: 2rem;
  text-align: center;
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
  margin: 0;
`;

const ControlsCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ControlRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end; /* 하단 정렬 */
  flex-wrap: wrap;
  gap: 1rem;
`;

const SelectLabel = styled.label`
  font-weight: 700;
  color: #495057;
  margin-bottom: 0.5rem;
  display: block;
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: 0.8rem 1rem;
  font-size: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  transition: all 0.2s;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #339af0;
    background-color: white;
  }
`;

const StatsBar = styled.div`
  display: flex;
  gap: 1rem;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 12px;
  justify-content: space-around;
  flex: 1;
  min-width: 280px;
  
  div {
    text-align: center;
    span.label { display: block; font-size: 0.8rem; color: #868e96; margin-bottom: 4px; }
    span.value { font-size: 1.2rem; font-weight: 800; color: #343a40; }
  }
`;

// [추가] 체크박스 그룹 컨테이너
const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  min-width: 200px;
`;

const SelectAllLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 700;
  color: #495057;
  user-select: none;
  font-size: 0.95rem;
  
  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #339af0;
  }

  &:hover {
    color: #339af0;
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
`;

const StudentCard = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;

  ${props => props.$status === 'pending' && css`
    border-color: #ffd43b;
    background: #fff9db;
  `}
  
  ${props => props.$status === 'approved' && css`
    background: #f1f3f5;
    opacity: 0.7;
    cursor: default;
  `}

  ${props => props.$checked && css`
    border-color: #339af0;
    box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.2);
    transform: translateY(-2px);
    background: #e7f5ff;
    opacity: 1;
  `}

  &:hover {
    ${props => props.$status !== 'approved' && css`
      transform: translateY(-3px);
      box-shadow: 0 8px 16px rgba(0,0,0,0.1);
    `}
  }
`;

const CardHeader = styled.div`
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: ${props => props.$expanded ? '1px solid rgba(0,0,0,0.05)' : 'none'};
`;

const NameGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
`;

const CheckboxIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid ${props => props.$checked ? '#339af0' : '#adb5bd'};
  background: ${props => props.$checked ? '#339af0' : 'white'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.2s;
  opacity: ${props => props.$disabled ? 0.3 : 1};
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  
  &::after {
    content: '✔';
    font-size: 0.8rem;
    opacity: ${props => props.$checked ? 1 : 0};
  }
`;

const StatusBadge = styled.span`
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 8px;
  font-weight: 800;
  
  ${props => props.$status === 'pending' && css`background: #ffd43b; color: #e67700;`}
  ${props => props.$status === 'approved' && css`background: #20c997; color: white;`}
  ${props => props.$status === 'none' && css`background: #e9ecef; color: #adb5bd;`}
`;

const CardBody = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(255,255,255,0.5);
  animation: ${fadeIn} 0.2s ease-out;
  
  .text-content {
    font-size: 0.9rem;
    color: #495057;
    background: rgba(255,255,255,0.8);
    padding: 0.8rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    border: 1px solid #dee2e6;
    white-space: pre-wrap;
  }

  .image-grid {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 4px;
    
    img {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      object-fit: cover;
      cursor: zoom-in;
      border: 1px solid #dee2e6;
      transition: transform 0.2s;
      &:hover { transform: scale(1.05); }
    }
  }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 0.6rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  color: #495057;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;

  &:hover { background: #f8f9fa; color: #339af0; border-color: #339af0; }
`;

const BottomActionBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
  animation: ${slideUp} 0.3s ease-out;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const SubmitBtn = styled.button`
  background: #20c997;
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 800;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 0 #12b886;
  transition: all 0.2s;
  flex: 1;
  max-width: 400px;

  &:hover { transform: translateY(-2px); }
  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background: #adb5bd; box-shadow: none; cursor: not-allowed; transform: none; }
`;

const SelectionInfo = styled.div`
  font-weight: 700;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 1rem;

  button {
    background: none; border: none; color: #868e96; text-decoration: underline; cursor: pointer; font-size: 0.9rem;
    &:hover { color: #339af0; }
  }
`;

function RecorderPage({ isAdminView = false, initialMissionId = null }) {
    const { classId } = useClassStore();
    const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();
    const { missionId } = useParams();
    const navigate = useNavigate();

    const [selectedMissionId, setSelectedMissionId] = useState(initialMissionId || missionId || '');
    const [checkedStudents, setCheckedStudents] = useState(new Set());
    const [expandedCardId, setExpandedCardId] = useState(null);
    const currentUser = auth.currentUser;

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [missionHistory, setMissionHistory] = useState([]);
    const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);

    useEffect(() => {
        if (initialMissionId) setSelectedMissionId(initialMissionId);
    }, [initialMissionId]);

    useEffect(() => {
        if (missionId) setSelectedMissionId(missionId);
    }, [missionId]);

    const selectedMission = useMemo(() => missions.find(m => m.id === selectedMissionId), [missions, selectedMissionId]);

    const studentSubmissionStatus = useMemo(() => {
        const statusMap = new Map();
        missionSubmissions
            .filter(sub => sub.missionId === selectedMissionId)
            .forEach(sub => { statusMap.set(sub.studentId, sub); });
        return statusMap;
    }, [missionSubmissions, selectedMissionId]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            const statusA = studentSubmissionStatus.get(a.id)?.status;
            const statusB = studentSubmissionStatus.get(b.id)?.status;
            // 1. 승인 대기 우선
            if (statusA === 'pending' && statusB !== 'pending') return -1;
            if (statusA !== 'pending' && statusB === 'pending') return 1;
            // 2. 미제출 차순위
            const isSubmittedA = statusA === 'approved';
            const isSubmittedB = statusB === 'approved';
            if (!isSubmittedA && isSubmittedB) return -1;
            if (isSubmittedA && !isSubmittedB) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [players, studentSubmissionStatus]);

    const stats = useMemo(() => {
        let pending = 0;
        let approved = 0;
        players.forEach(p => {
            const status = studentSubmissionStatus.get(p.id)?.status;
            if (status === 'pending') pending++;
            if (status === 'approved') approved++;
        });
        return { pending, approved, total: players.length };
    }, [players, studentSubmissionStatus]);

    const handleMissionSelect = (e) => {
        const newMissionId = e.target.value;
        setSelectedMissionId(newMissionId);
        setCheckedStudents(new Set());
        setExpandedCardId(null);
        if (!isAdminView) navigate(`/recorder/${newMissionId}`);
    };

    // 체크박스 토글 (미제출도 선택 가능, 승인 완료만 불가)
    const handleCheckboxToggle = (e, studentId, status) => {
        e.stopPropagation();
        if (status === 'approved') return;

        setCheckedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) newSet.delete(studentId);
            else newSet.add(studentId);
            return newSet;
        });
    };

    const handleCardClick = (studentId) => {
        setExpandedCardId(prev => prev === studentId ? null : studentId);
    };

    const handleHistoryView = async (e, student) => {
        e.stopPropagation();
        if (!classId || !selectedMissionId) return;
        const history = await getMissionHistory(classId, student.id, selectedMissionId);
        setMissionHistory(history);
        setSelectedStudentForHistory(student);
        setIsHistoryModalOpen(true);
    };

    // [1] 전체 선택 (승인 완료 제외한 모든 인원)
    const handleSelectTotal = () => {
        const eligiblePlayerIds = sortedPlayers
            .filter(player => studentSubmissionStatus.get(player.id)?.status !== 'approved')
            .map(player => player.id);

        // eligible 인원이 모두 체크되어 있으면 해제, 아니면 전체 선택
        const isAllSelected = eligiblePlayerIds.length > 0 && eligiblePlayerIds.every(id => checkedStudents.has(id));

        if (isAllSelected) {
            setCheckedStudents(new Set());
        } else {
            setCheckedStudents(new Set(eligiblePlayerIds));
        }
    };

    // [2] 승인 요청 인원(Pending)만 선택
    const handleSelectPending = () => {
        const pendingPlayerIds = sortedPlayers
            .filter(player => studentSubmissionStatus.get(player.id)?.status === 'pending')
            .map(player => player.id);

        // pending 인원이 모두 체크되어 있으면 해제, 아니면 pending만 선택
        // (주의: pending만 선택할 때 기존 '미제출' 체크는 풀리는 것이 '필터' 개념에 더 부합)
        const isPendingSelected = pendingPlayerIds.length > 0 &&
            pendingPlayerIds.every(id => checkedStudents.has(id)) &&
            checkedStudents.size === pendingPlayerIds.length;

        if (isPendingSelected) {
            setCheckedStudents(new Set());
        } else {
            setCheckedStudents(new Set(pendingPlayerIds));
        }
    };

    const handleSubmit = async () => {
        if (!classId) return;
        const mission = missions.find(m => m.id === selectedMissionId);
        if (!mission || checkedStudents.size === 0) return alert('미션을 선택하고, 승인할 학생을 한 명 이상 체크해주세요.');
        if (!currentUser) return alert('기록원 정보가 없습니다.');

        const studentNames = Array.from(checkedStudents).map(id => players.find(p => p.id === id)?.name).join(', ');
        if (window.confirm(`${studentNames} 학생들의 미션 완료를 승인하고 포인트를 지급하시겠습니까?`)) {
            try {
                await approveMissionsInBatch(classId, selectedMissionId, Array.from(checkedStudents), currentUser.uid, mission.reward);
                alert('포인트 지급이 완료되었습니다.');
                setCheckedStudents(new Set());
                await fetchInitialData();
            } catch (error) {
                alert(`오류: ${error.message}`);
            }
        }
    };

    // 체크박스 상태 계산
    const allEligibleCount = stats.total - stats.approved;
    const isTotalSelected = allEligibleCount > 0 && checkedStudents.size === allEligibleCount;

    // pending만 정확히 선택되었는지 확인 (개수가 같고, pending 인원 모두 포함)
    const pendingIds = sortedPlayers.filter(p => studentSubmissionStatus.get(p.id)?.status === 'pending').map(p => p.id);
    const isPendingSelected = pendingIds.length > 0 &&
        checkedStudents.size === pendingIds.length &&
        pendingIds.every(id => checkedStudents.has(id));

    return (
        <PageContainer>
            <ContentWrapper>
                <HeaderSection>
                    <Title>📝 미션 기록관</Title>
                    <SubTitle>학생들의 미션 수행 내역을 확인하고 승인해주세요.</SubTitle>
                </HeaderSection>

                <ControlsCard>
                    <SelectLabel>확인할 미션 선택</SelectLabel>
                    <StyledSelect value={selectedMissionId} onChange={handleMissionSelect}>
                        <option value="">-- 미션을 선택해주세요 --</option>
                        {missions.map(mission => (
                            <option key={mission.id} value={mission.id}>
                                {mission.title} (보상: {mission.reward}P)
                            </option>
                        ))}
                    </StyledSelect>

                    {selectedMissionId && (
                        <ControlRow>
                            <StatsBar>
                                <div><span className="label">전체 학생</span><span className="value">{stats.total}명</span></div>
                                <div><span className="label">승인 대기</span><span className="value" style={{ color: '#e67700' }}>{stats.pending}명</span></div>
                                <div><span className="label">승인 완료</span><span className="value" style={{ color: '#20c997' }}>{stats.approved}명</span></div>
                            </StatsBar>

                            {/* 체크박스 그룹 */}
                            <CheckboxGroup>
                                <SelectAllLabel>
                                    <input
                                        type="checkbox"
                                        checked={isTotalSelected}
                                        onChange={handleSelectTotal}
                                        disabled={allEligibleCount === 0}
                                    />
                                    전체 선택 (미제출 포함)
                                </SelectAllLabel>
                                <SelectAllLabel>
                                    <input
                                        type="checkbox"
                                        checked={isPendingSelected}
                                        onChange={handleSelectPending}
                                        disabled={stats.pending === 0}
                                    />
                                    승인요청 인원만 선택
                                </SelectAllLabel>
                            </CheckboxGroup>
                        </ControlRow>
                    )}
                </ControlsCard>

                {selectedMissionId && (
                    <GridContainer>
                        {sortedPlayers.map(player => {
                            const submission = studentSubmissionStatus.get(player.id);
                            const status = submission?.status || 'none';
                            const isChecked = checkedStudents.has(player.id);
                            const isExpanded = expandedCardId === player.id;
                            const isApproved = status === 'approved';

                            return (
                                <StudentCard
                                    key={player.id}
                                    $status={status}
                                    $checked={isChecked}
                                    onClick={() => handleCardClick(player.id)}
                                >
                                    <CardHeader $expanded={isExpanded}>
                                        <NameGroup>
                                            <CheckboxIcon
                                                $checked={isChecked}
                                                $disabled={isApproved}
                                                onClick={(e) => handleCheckboxToggle(e, player.id, status)}
                                            />
                                            <span style={{ fontWeight: 'bold' }}>{player.name}</span>
                                        </NameGroup>
                                        <StatusBadge $status={status}>
                                            {status === 'pending' ? '승인 대기' : (status === 'approved' ? '완료됨' : '미제출')}
                                        </StatusBadge>
                                    </CardHeader>

                                    {isExpanded && submission && (
                                        <CardBody>
                                            {submission.text && <div className="text-content">{submission.text}</div>}
                                            {submission.photoUrls && submission.photoUrls.length > 0 && (
                                                <div className="image-grid" onClick={e => e.stopPropagation()}>
                                                    {submission.photoUrls.map((url, idx) => (
                                                        <img key={idx} src={url} alt="submission" onClick={() => setModalImageSrc(url)} />
                                                    ))}
                                                </div>
                                            )}

                                            {/* [조건부] 반복 미션일 경우에만 기록 보기 버튼 표시 */}
                                            {selectedMission?.isRepeated && (
                                                <ActionButton onClick={(e) => handleHistoryView(e, player)}>
                                                    📜 이전 기록 보기
                                                </ActionButton>
                                            )}
                                        </CardBody>
                                    )}

                                    {isExpanded && !submission && (
                                        <CardBody>
                                            <div style={{ textAlign: 'center', color: '#adb5bd', padding: '1rem' }}>제출 내역이 없습니다.</div>
                                        </CardBody>
                                    )}
                                </StudentCard>
                            );
                        })}
                    </GridContainer>
                )}
            </ContentWrapper>

            {selectedMissionId && (
                <BottomActionBar>
                    <SelectionInfo>
                        <span>{checkedStudents.size}명 선택됨</span>
                        {checkedStudents.size > 0 && (
                            <button onClick={() => setCheckedStudents(new Set())}>선택 해제</button>
                        )}
                    </SelectionInfo>
                    <SubmitBtn onClick={handleSubmit} disabled={checkedStudents.size === 0}>
                        승인 및 포인트 지급
                    </SubmitBtn>
                </BottomActionBar>
            )}

            {selectedStudentForHistory && (
                <MissionHistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    missionTitle={`${selectedStudentForHistory.name} - ${selectedMission?.title}`}
                    history={missionHistory}
                    student={selectedStudentForHistory}
                />
            )}
            <ImageModal src={modalImageSrc} onClose={() => setModalImageSrc(null)} />
        </PageContainer>
    );
}

export default RecorderPage;