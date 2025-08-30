// src/pages/RecorderPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, approveMissionsInBatch, getMissionHistory } from '../api/firebase';
import MissionHistoryModal from '../components/MissionHistoryModal';
import { useParams, useNavigate } from 'react-router-dom';

const RecorderWrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 12px;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  color: #343a40;
`;

const MissionSelect = styled.select`
  width: 100%;
  padding: 0.75rem;
  font-size: 1.1rem;
  margin-bottom: 1rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  background-color: #fff;
`;

const StudentList = styled.ul`
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const StudentListItem = styled.li`
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
  transition: all 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
  border-left: 5px solid transparent;

  &.pending {
    border-left-color: #ffc107;
  }
  
  &.approved {
    border-left-color: #28a745;
    background-color: #f8f9fa;
  }
`;

const StudentSummary = styled.div`
    display: flex;
    align-items: center;
    padding: 1rem;
    gap: 1rem;
`;

const CheckboxLabel = styled.label`
    display: flex;
    align-items: center;
    cursor: pointer;

    input[type="checkbox"] {
        width: 20px;
        height: 20px;
    }
`;

const StudentInfo = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
`;

const StudentName = styled.span`
    font-weight: bold;
    font-size: 1.1rem;
`;

const StatusBadge = styled.span`
    font-size: 0.8rem;
    font-weight: bold;
    padding: 4px 8px;
    border-radius: 12px;
    color: white;
    align-self: flex-start; /* Make badge fit content */

    &.pending { background-color: #ffc107; color: black; }
    &.approved { background-color: #28a745; }
`;


const SubmissionDetails = styled.div`
    padding: ${props => props.$isOpen ? '0 1rem 1rem 1rem' : '0 1rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    border-top: ${props => props.$isOpen ? '1px solid #f0f0f0' : 'none'};
    margin-top: ${props => props.$isOpen ? '0.5rem' : '0'};

    p {
        background-color: #f8f9fa;
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


const SubmitButton = styled.button`
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  font-weight: bold;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 2rem;
  transition: background-color 0.2s;

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const ExitButton = styled.button`
  display: block;
  width: 100%;
  margin-top: 1rem;
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

const StyledButton = styled.button`
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: bold;
    border: 1px solid #ced4da;
    border-radius: 8px;
    cursor: pointer;
    background-color: #fff;
    transition: all 0.2s ease-in-out;
    white-space: nowrap;

    &:hover {
        background-color: #e9ecef;
    }
`;

const TopControls = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
`;


function RecorderPage({ isAdminView = false, initialMissionId = null }) {
    const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();
    const { missionId } = useParams();
    const navigate = useNavigate();

    // [수정] props로 받은 initialMissionId를 초기값으로 사용
    const [selectedMissionId, setSelectedMissionId] = useState(initialMissionId || missionId || '');
    const [checkedStudents, setCheckedStudents] = useState(new Set());
    const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
    const currentUser = auth.currentUser;

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [missionHistory, setMissionHistory] = useState([]);
    const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);

    // [신규] AdminPage에서 탭 전환 시, 선택된 미션을 업데이트하기 위한 useEffect
    useEffect(() => {
        if (initialMissionId) {
            setSelectedMissionId(initialMissionId);
        }
    }, [initialMissionId]);

    useEffect(() => {
        if (missionId) {
            setSelectedMissionId(missionId);
        }
    }, [missionId]);

    const selectedMission = useMemo(() => {
        return missions.find(m => m.id === selectedMissionId);
    }, [missions, selectedMissionId]);


    const studentSubmissionStatus = useMemo(() => {
        const statusMap = new Map();
        missionSubmissions
            .filter(sub => sub.missionId === selectedMissionId)
            .forEach(sub => {
                statusMap.set(sub.studentId, sub);
            });
        return statusMap;
    }, [missionSubmissions, selectedMissionId]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            const statusA = studentSubmissionStatus.get(a.id)?.status;
            const statusB = studentSubmissionStatus.get(b.id)?.status;
            if (statusA === 'pending' && statusB !== 'pending') return -1;
            if (statusA !== 'pending' && statusB === 'pending') return 1;
            return a.name.localeCompare(b.name);
        });
    }, [players, studentSubmissionStatus]);

    const handleMissionSelect = (e) => {
        const newMissionId = e.target.value;
        setSelectedMissionId(newMissionId);
        setCheckedStudents(new Set());
        setExpandedSubmissionId(null);
        if (!isAdminView) {
            navigate(`/recorder/${newMissionId}`);
        }
    };

    const handleStudentCheck = (studentId, status) => {
        if (status === 'approved') return;
        setCheckedStudents(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };

    const handleRowClick = (studentId) => {
        const submission = studentSubmissionStatus.get(studentId);
        if (submission && (submission.text || submission.photoUrl)) {
            setExpandedSubmissionId(prev => (prev === studentId ? null : studentId));
        }
    };

    const handleHistoryView = async (e, student) => {
        e.stopPropagation();
        if (!selectedMissionId) return;
        const history = await getMissionHistory(student.id, selectedMissionId);
        setMissionHistory(history);
        setSelectedStudentForHistory(student);
        setIsHistoryModalOpen(true);
    };

    const handleSelectAll = () => {
        const eligiblePlayerIds = sortedPlayers
            .filter(player => studentSubmissionStatus.get(player.id)?.status !== 'approved')
            .map(player => player.id);
        const allSelected = eligiblePlayerIds.length > 0 && eligiblePlayerIds.every(id => checkedStudents.has(id));

        if (allSelected) {
            setCheckedStudents(new Set());
        } else {
            setCheckedStudents(new Set(eligiblePlayerIds));
        }
    };


    const handleSubmit = async () => {
        const mission = missions.find(m => m.id === selectedMissionId);
        if (!mission || checkedStudents.size === 0) {
            return alert('미션을 선택하고, 승인할 학생을 한 명 이상 체크해주세요.');
        }
        if (!currentUser) return alert('기록원 정보가 없습니다.');

        const studentNames = Array.from(checkedStudents).map(id => players.find(p => p.id === id)?.name).join(', ');
        if (window.confirm(`${studentNames} 학생들의 미션 완료를 승인하고 포인트를 지급하시겠습니까?`)) {
            try {
                await approveMissionsInBatch(selectedMissionId, Array.from(checkedStudents), currentUser.uid, mission.reward);
                alert('포인트 지급이 완료되었습니다.');
                setCheckedStudents(new Set());
                await fetchInitialData();
            } catch (error) {
                alert(`오류: ${error.message}`);
            }
        }
    };

    return (
        <RecorderWrapper>
            {!isAdminView && <Title>기록 확인</Title>}
            <MissionSelect value={selectedMissionId} onChange={handleMissionSelect}>
                <option value="">-- 미션 선택 --</option>
                {missions.map(mission => (
                    <option key={mission.id} value={mission.id}>
                        {mission.title} (보상: {mission.reward}P)
                    </option>
                ))}
            </MissionSelect>

            {selectedMissionId && (
                <>
                    <TopControls>
                        <StyledButton onClick={handleSelectAll}>전체 선택/해제</StyledButton>
                    </TopControls>
                    <StudentList>
                        {sortedPlayers.map(player => {
                            const submission = studentSubmissionStatus.get(player.id);
                            const status = submission?.status;
                            const approver = players.find(p => p.authUid === submission?.checkedBy);
                            const isOpen = expandedSubmissionId === player.id;

                            return (
                                <StudentListItem key={player.id} className={status}>
                                    <StudentSummary onClick={() => handleRowClick(player.id)}>
                                        <CheckboxLabel>
                                            <input
                                                type="checkbox"
                                                checked={checkedStudents.has(player.id)}
                                                onChange={() => handleStudentCheck(player.id, status)}
                                                disabled={status === 'approved'}
                                            />
                                        </CheckboxLabel>
                                        <StudentInfo>
                                            <StudentName>{player.name}</StudentName>
                                            {status === 'pending' && <StatusBadge className="pending">승인 대기중</StatusBadge>}
                                            {status === 'approved' && (
                                                <StatusBadge className="approved">
                                                    완료 {approver ? `(승인: ${approver.name})` : ''}
                                                </StatusBadge>
                                            )}
                                        </StudentInfo>
                                        {selectedMission?.isFixed && (
                                            <StyledButton onClick={(e) => handleHistoryView(e, player)}>
                                                기록 보기
                                            </StyledButton>
                                        )}
                                    </StudentSummary>
                                    {submission && (
                                        <SubmissionDetails $isOpen={isOpen}>
                                            {submission.text && <p>{submission.text}</p>}
                                            {/* [수정] 이미지 클릭 시 경고창을 띄우도록 수정합니다. */}
                                            {submission.photoUrls && submission.photoUrls.map((url, index) => (
                                                <img key={index} src={url} alt={`제출된 사진 ${index + 1}`} onClick={() => alert('이미지 크게보기는 관리자 페이지에서만 가능합니다.')} style={{ marginBottom: '0.5rem', cursor: 'pointer' }} />
                                            ))}
                                        </SubmissionDetails>
                                    )}
                                </StudentListItem>
                            );
                        })}
                    </StudentList>

                    <SubmitButton onClick={handleSubmit} disabled={checkedStudents.size === 0}>
                        {checkedStudents.size}명 포인트 지급 승인하기
                    </SubmitButton>

                    {!isAdminView && <ExitButton onClick={() => navigate('/')}>대시보드로 이동</ExitButton>}
                </>
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
        </RecorderWrapper>
    );
}

export default RecorderPage;