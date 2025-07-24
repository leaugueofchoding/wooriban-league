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
    flex-grow: 1; // [추가] 텍스트 영역이 남는 공간을 모두 차지하도록
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

// [수정] 버튼 상태에 따라 다른 스타일을 적용하도록 수정
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

    /* 상태에 따른 배경색상 변경 */
    background-color: ${props => {
    if (props.status === 'approved') return '#007bff'; // 완료: 파랑
    if (props.status === 'pending') return '#6c757d'; // 대기중: 회색
    return '#dc3545'; // 요청 전: 빨강
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

  // [수정] 현재 로그인한 사용자의 플레이어 정보를 가져옵니다.
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

                {/* [수정] 일반 참가자(player)에게만 버튼이 보이도록 렌더링 조건 추가 */}
                {myPlayerData && myPlayerData.role === 'player' && (
                  <RequestButton
                    onClick={() => submitMissionForApproval(mission.id)}
                    disabled={!!submissionStatus}
                    status={submissionStatus} // [추가] 버튼에 현재 상태 전달
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