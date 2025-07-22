import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore'; // 경로는 실제 프로젝트 구조에 맞게 확인해주세요.
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

// --- ▼▼▼ 스타일 및 기능 개선 ▼▼▼ ---
const StudentListItem = styled.li`
  display: flex;
  align-items: center;
  padding: 1rem;
  background-color: #fff;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: background-color 0.2s ease-in-out;
  cursor: pointer; // 클릭 가능한 커서로 변경

  &:hover {
    background-color: #e9ecef;
  }

  // 완료된 항목 스타일
  &.submitted {
    background-color: #e9ecef;
    opacity: 0.6;
    cursor: not-allowed; // 클릭 불가능 커서
    
    &:hover {
        background-color: #e9ecef;
    }
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-right: 1rem;
    pointer-events: none; // 체크박스 직접 클릭 방지 (li가 클릭을 제어)
  }

  label {
      flex-grow: 1; // 이름 영역이 남은 공간을 모두 차지하도록
  }
`;
// --- ▲▲▲ 스타일 및 기능 개선 ▲▲▲ ---

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

function RecorderPage() {
    const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();
    const { missionId } = useParams();
    const navigate = useNavigate();

    const [selectedMissionId, setSelectedMissionId] = useState(missionId || '');
    const [checkedStudents, setCheckedStudents] = useState(new Set());
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (missionId) {
            setSelectedMissionId(missionId);
        }
    }, [missionId]);

    // 미션 선택 시 URL 변경
    const handleMissionSelect = (e) => {
        const newMissionId = e.target.value;
        setSelectedMissionId(newMissionId);
        setCheckedStudents(new Set()); // 미션 변경 시 선택 초기화
        navigate(`/recorder/${newMissionId}`); // URL을 동적으로 변경
    };

    // --- ▼▼▼ 클릭 핸들러 수정 ▼▼▼ ---
    const handleStudentClick = (studentId, isSubmitted) => {
        if (isSubmitted) return; // 이미 완료된 학생은 아무것도 하지 않음

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
    // --- ▲▲▲ 클릭 핸들러 수정 ▲▲▲ ---

    const handleSubmit = async () => {
        const mission = missions.find(m => m.id === selectedMissionId);
        if (!mission || checkedStudents.size === 0) {
            return alert('미션을 선택하고, 한 명 이상의 학생을 체크해주세요.');
        }
        if (!currentUser) return alert('기록원 정보가 없습니다.');

        const studentNames = Array.from(checkedStudents).map(id => players.find(p => p.id === id)?.name).join(', ');
        if (window.confirm(`${studentNames} 학생들의 미션 완료를 승인하고 포인트를 지급하시겠습니까?`)) {
            try {
                await approveMissionsInBatch(selectedMissionId, Array.from(checkedStudents), currentUser.uid, mission.reward);
                alert('포인트 지급이 완료되었습니다.');
                setCheckedStudents(new Set()); // 성공 후 선택 초기화
                await fetchInitialData(); // 데이터 최신화
            } catch (error) {
                alert(`오류: ${error.message}`);
            }
        }
    };

    const submittedStudents = useMemo(() => {
        return new Set(
            missionSubmissions
                .filter(sub => sub.missionId === selectedMissionId)
                .map(sub => sub.studentId)
        );
    }, [missionSubmissions, selectedMissionId]);

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

            {selectedMissionId ? (
                <>
                    <StudentList>
                        {players.map(player => {
                            const isAlreadySubmitted = submittedStudents.has(player.id);

                            // --- ▼▼▼ 렌더링 부분 수정 ▼▼▼ ---
                            return (
                                <StudentListItem
                                    key={player.id}
                                    className={isAlreadySubmitted ? 'submitted' : ''}
                                    onClick={() => handleStudentClick(player.id, isAlreadySubmitted)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checkedStudents.has(player.id)}
                                        readOnly // 클릭 이벤트는 li에서 처리하므로 읽기 전용으로 변경
                                    />
                                    <label>
                                        {player.name} {isAlreadySubmitted && '(완료)'}
                                    </label>
                                </StudentListItem>
                            );
                            // --- ▲▲▲ 렌더링 부분 수정 ▲▲▲ ---
                        })}
                    </StudentList>

                    <SubmitButton onClick={handleSubmit} disabled={checkedStudents.size === 0}>
                        {checkedStudents.size}명 포인트 지급 승인하기
                    </SubmitButton>
                </>
            ) : (
                <p style={{ textAlign: 'center' }}>확인할 미션을 선택해주세요.</p>
            )}
        </RecorderWrapper>
    );
}
export default RecorderPage;