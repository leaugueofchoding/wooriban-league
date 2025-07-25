// src/pages/RecorderPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, approveMissionsInBatch } from '../api/firebase';
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
  margin-bottom: 2rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  background-color: #fff;
`;

const StudentList = styled.ul`
  list-style: none;
  padding: 0;
`;

const StudentListItem = styled.li`
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: #fff;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &.pending {
    background-color: #fffbe6;
    border-left: 5px solid #ffc107;
  }
  
  &.approved {
    background-color: #e9ecef;
    opacity: 0.6;
    cursor: not-allowed;
    
    &:hover {
        background-color: #e9ecef;
    }
  }

  &:not(.approved):hover {
    background-color: #f8f9fa;
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-right: 1rem;
    pointer-events: none;
  }

  label {
      flex-grow: 1;
  }

  .status-badge {
    font-size: 0.8rem;
    font-weight: bold;
    padding: 4px 8px;
    border-radius: 12px;
    margin-left: auto;
    color: white;

    &.pending { background-color: #ffc107; color: black; }
    &.approved { background-color: #28a745; }
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

function RecorderPage() {
    const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();
    const { missionId } = useParams();
    const navigate = useNavigate();

    const [selectedMissionId, setSelectedMissionId] = useState(missionId || '');
    const [checkedStudents, setCheckedStudents] = useState(new Set());
    const currentUser = auth.currentUser;

    // --- ▼▼▼ [핵심 수정] ▼▼▼ ---
    // URL의 missionId가 바뀔 때마다 selectedMissionId 상태를 업데이트
    useEffect(() => {
        console.log("현재 URL의 missionId:", missionId); // 👈 진단용 코드 추가
        if (missionId) {
            setSelectedMissionId(missionId);
        }
    }, [missionId]);
    // --- ▲▲▲ [핵심 수정] ▲▲▲ ---

    const handleMissionSelect = (e) => {
        const newMissionId = e.target.value;
        setSelectedMissionId(newMissionId);
        setCheckedStudents(new Set());
        navigate(`/recorder/${newMissionId}`);
    };

    const handleStudentClick = (studentId, status) => {
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

    const studentSubmissionStatus = useMemo(() => {
        const statusMap = new Map();
        missionSubmissions
            .filter(sub => sub.missionId === selectedMissionId)
            .forEach(sub => {
                statusMap.set(sub.studentId, sub.status);
            });
        return statusMap;
    }, [missionSubmissions, selectedMissionId]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => {
            const statusA = studentSubmissionStatus.get(a.id);
            const statusB = studentSubmissionStatus.get(b.id);
            if (statusA === 'pending' && statusB !== 'pending') return -1;
            if (statusA !== 'pending' && statusB === 'pending') return 1;
            return a.name.localeCompare(b.name);
        });
    }, [players, studentSubmissionStatus]);

    return (
        <RecorderWrapper>
            <Title>기록원 미션 확인</Title>
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
                    <StudentList>
                        {sortedPlayers.map(player => {
                            const status = studentSubmissionStatus.get(player.id);

                            return (
                                <StudentListItem
                                    key={player.id}
                                    className={status}
                                    onClick={() => handleStudentClick(player.id, status)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checkedStudents.has(player.id)}
                                        readOnly
                                        disabled={status === 'approved'}
                                    />
                                    <label>{player.name}</label>

                                    {status === 'pending' && <span className="status-badge pending">승인 대기중</span>}
                                    {status === 'approved' && <span className="status-badge approved">완료</span>}
                                </StudentListItem>
                            );
                        })}
                    </StudentList>

                    <SubmitButton onClick={handleSubmit} disabled={checkedStudents.size === 0}>
                        {checkedStudents.size}명 포인트 지급 승인하기
                    </SubmitButton>

                    <ExitButton onClick={() => navigate('/')}>대시보드로 이동</ExitButton>
                </>
            )}
        </RecorderWrapper>
    );
}

export default RecorderPage;