// src/pages/MissionsPage.jsx

import React, { useMemo } from 'react';
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
  gap: 1rem;
`;

const MissionCard = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
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

    background-color: ${props => {
    if (props.$status === 'approved') return '#007bff';
    if (props.$status === 'pending') return '#6c757d';
    return '#dc3545';
  }};


    &:hover:not(:disabled) {
        background-color: ${props => {
    if (props.status === 'approved') return '#0056b3';
    if (props.status === 'pending') return '#5a6268';
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


function MissionsPage() {
  const { players, missions, missionSubmissions, submitMissionForApproval } = useLeagueStore();
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

  // [수정] 미션 제출 가능 여부를 확인하는 변수
  const canSubmitMission = myPlayerData && ['player', 'recorder'].includes(myPlayerData.role);

  return (
    <MissionsWrapper>
      <Title>오늘의 미션</Title>
      <MissionList>
        {missions.length > 0 ? (
          missions.map(mission => {
            const submissionStatus = mySubmissions[mission.id];

            return (
              <MissionCard key={mission.id}>
                <MissionInfo>
                  <MissionTitle>{mission.title}</MissionTitle>
                  <MissionReward>💰 {mission.reward} P</MissionReward>
                </MissionInfo>

                {/* [수정] 렌더링 조건을 canSubmitMission 변수로 변경 */}
                {canSubmitMission && (
                  <RequestButton
                    onClick={() => submitMissionForApproval(mission.id)}
                    disabled={!!submissionStatus}
                    $status={submissionStatus}
                  >
                    {submissionStatus === 'pending' && '승인 대기중'}
                    {submissionStatus === 'approved' && '승인 완료!'}
                    {!submissionStatus && '다 했어요!'}
                  </RequestButton>
                )}
              </MissionCard>
            )
          })
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