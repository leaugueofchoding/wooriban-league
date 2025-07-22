import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, approveMissionsInBatch } from '../api/firebase'; // 함수 교체

const RecorderWrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;
const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
`;
const MissionSelect = styled.select`
  width: 100%;
  padding: 0.75rem;
  font-size: 1.1rem;
  margin-bottom: 2rem;
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
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  
  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-right: 1rem;
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

  &:disabled {
    background-color: #6c757d;
  }
`;

function RecorderPage() {
    const { players, missions, missionSubmissions, fetchInitialData } = useLeagueStore();
    const [selectedMissionId, setSelectedMissionId] = useState('');
    const [checkedStudents, setCheckedStudents] = useState(new Set()); // 체크된 학생 Set
    const currentUser = auth.currentUser;

    // 미션이 변경되면 체크 목록 초기화
    useEffect(() => {
        setCheckedStudents(new Set());
    }, [selectedMissionId]);

    const handleCheck = (studentId) => {
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
            return alert('미션을 선택하고, 한 명 이상의 학생을 체크해주세요.');
        }
        if (!currentUser) return alert('기록원 정보가 없습니다.');

        const studentNames = Array.from(checkedStudents).map(id => players.find(p => p.id === id)?.name).join(', ');
        if (window.confirm(`${studentNames} 학생들의 미션 완료를 승인하고 포인트를 지급하시겠습니까?`)) {
            try {
                await approveMissionsInBatch(selectedMissionId, Array.from(checkedStudents), currentUser.uid, mission.reward);
                alert('포인트 지급이 완료되었습니다.');
                await fetchInitialData();
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
            <MissionSelect value={selectedMissionId} onChange={(e) => setSelectedMissionId(e.target.value)}>
                <option value="">-- 미션 선택 --</option>
                {missions.map(mission => (
                    <option key={mission.id} value={mission.id}>
                        {mission.title} (보상: {mission.reward}P)
                    </option>
                ))}
            </MissionSelect>

            <StudentList>
                {players.map(player => {
                    const isAlreadySubmitted = submittedStudents.has(player.id);
                    return (
                        <StudentListItem key={player.id} style={{ opacity: isAlreadySubmitted ? 0.5 : 1 }}>
                            <input
                                type="checkbox"
                                checked={checkedStudents.has(player.id)}
                                disabled={isAlreadySubmitted}
                                onChange={() => handleCheck(player.id)}
                            />
                            <label>{player.name} {isAlreadySubmitted && '(완료)'}</label>
                        </StudentListItem>
                    );
                })}
            </StudentList>

            <SubmitButton onClick={handleSubmit} disabled={checkedStudents.size === 0}>
                {checkedStudents.size}명 포인트 지급 승인하기
            </SubmitButton>
        </RecorderWrapper>
    );
}
export default RecorderPage;