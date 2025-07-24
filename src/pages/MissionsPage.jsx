import React from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useNavigate } from 'react-router-dom'; // 1. useNavigate import 추가

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

// 👇 [추가] 나가기 버튼 스타일
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
  const { missions } = useLeagueStore();
  const navigate = useNavigate(); // 2. navigate 함수 선언

  return (
    <MissionsWrapper>
      <Title>오늘의 미션</Title>
      <MissionList>
        {missions.length > 0 ? (
          missions.map(mission => (
            <MissionCard key={mission.id}>
              <MissionTitle>{mission.title}</MissionTitle>
              <MissionReward>💰 {mission.reward} P</MissionReward>
            </MissionCard>
          ))
        ) : (
          <p style={{ textAlign: 'center' }}>현재 진행 중인 미션이 없습니다.</p>
        )}
      </MissionList>

      {/* 3. 나가기 버튼 추가 */}
      <ExitButton onClick={() => navigate(-1)}>
        나가기
      </ExitButton>
    </MissionsWrapper>
  );
}

export default MissionsPage;