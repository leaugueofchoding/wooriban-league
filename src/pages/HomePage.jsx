// src/pages/HomePage.jsx

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useNavigate } from 'react-router-dom';
import LeagueTable from '../components/LeagueTable.jsx';
import defaultEmblem from '../assets/default-emblem.png';

const Wrapper = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: flex-start;
`;

const Section = styled.div`
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const MatchItem = styled.div`
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
  overflow: hidden; /* 아코디언 효과를 위해 추가 */
`;

const MatchSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  padding: 1rem;
`;

const Team = styled.span`
  font-weight: bold;
`;

const Score = styled.span`
  font-weight: bold;
  color: #007bff;
`;

const VsText = styled.span`
  color: #6c757d;
`;

const LineupDetail = styled.div`
  padding: 1rem;
  background-color: #f8f9fa;
  border-top: 1px solid #eee;
  text-align: center;
  /* 애니메이션 효과 */
  max-height: ${props => (props.$isOpen ? '500px' : '0')};
  opacity: ${props => (props.$isOpen ? '1' : '0')};
  transition: max-height 0.4s ease-in-out, opacity 0.4s ease-in-out, padding 0.4s ease-in-out;
  padding-top: ${props => (props.$isOpen ? '1rem' : '0')};
  padding-bottom: ${props => (props.$isOpen ? '1rem' : '0')};
`;

const ExitButton = styled.button`
  display: block;
  margin: 3rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover { background-color: #5a6268; }
`;


function ScheduleItem({ match }) {
  const { teams } = useLeagueStore();
  const [isOpen, setIsOpen] = useState(false);

  const teamA = teams.find(t => t.id === match.teamA_id);
  const teamB = teams.find(t => t.id === match.teamB_id);

  return (
    <MatchItem onClick={() => setIsOpen(!isOpen)}>
      <MatchSummary>
        <Team>{teamA?.teamName || 'N/A'}</Team>
        {match.status === '완료' ? (
          <Score>{match.teamA_score} : {match.teamB_score}</Score>
        ) : (
          <VsText>vs</VsText>
        )}
        <Team>{teamB?.teamName || 'N/A'}</Team>
      </MatchSummary>
      <LineupDetail $isOpen={isOpen}>
        <p>라인업 정보가 없습니다.</p>
        {/* 추후 이곳에 양 팀 선수 명단이 표시됩니다. */}
      </LineupDetail>
    </MatchItem>
  );
}


function HomePage() {
  const { matches, teams } = useLeagueStore();
  const navigate = useNavigate();

  const standingsData = useMemo(() => {
    const completedMatches = matches.filter(m => m.status === '완료');
    let stats = teams.map(team => ({
      id: team.id, teamName: team.teamName, emblemUrl: team.emblemUrl || defaultEmblem,
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    }));
    completedMatches.forEach(match => {
      const teamA = stats.find(t => t.id === match.teamA_id);
      const teamB = stats.find(t => t.id === match.teamB_id);
      if (!teamA || !teamB) return;
      teamA.played++; teamB.played++;
      teamA.goalsFor += match.teamA_score; teamA.goalsAgainst += match.teamB_score;
      teamB.goalsFor += match.teamB_score; teamB.goalsAgainst += match.teamA_score;
      if (match.teamA_score > match.teamB_score) {
        teamA.wins++; teamA.points += 3; teamB.losses++;
      } else if (match.teamB_score > match.teamA_score) {
        teamB.wins++; teamB.points += 3; teamA.losses++;
      } else {
        teamA.draws++; teamB.draws++; teamA.points += 1; teamB.points += 1;
      }
    });
    stats.forEach(team => { team.goalDifference = team.goalsFor - team.goalsAgainst; });
    stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
    return stats;
  }, [matches, teams]);

  return (
    <Wrapper>
      <Title>가가볼 리그 센터</Title>
      <MainGrid>
        <Section>
          <SectionTitle>경기 일정</SectionTitle>
          <MatchList>
            {matches.map(match => (
              <ScheduleItem key={match.id} match={match} />
            ))}
          </MatchList>
        </Section>
        <Section>
          <SectionTitle>실시간 리그 순위</SectionTitle>
          <LeagueTable standings={standingsData} />
        </Section>
      </MainGrid>
      {/* 추후 팀 정보, 선수 랭킹 카드 추가될 위치 */}
      <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
    </Wrapper>
  );
}

export default HomePage;