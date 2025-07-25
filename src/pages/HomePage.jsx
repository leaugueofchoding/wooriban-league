// src/pages/HomePage.jsx

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import LeagueTable from '../components/LeagueTable.jsx';
import defaultEmblem from '../assets/default-emblem.png';
import { useNavigate } from 'react-router-dom'; // [추가]

const HomePageWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`;

// [추가] 나가기 버튼 스타일
const ExitButton = styled.button`
  display: block;
  margin: 2rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
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

function HomePage() {
  const { matches, teams } = useLeagueStore();
  const navigate = useNavigate(); // [추가]

  const standingsData = useMemo(() => {
    const completedMatches = matches.filter(m => m.status === '완료');

    let stats = teams.map(team => ({
      id: team.id,
      teamName: team.teamName,
      emblemUrl: team.emblemUrl || defaultEmblem,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    }));

    completedMatches.forEach(match => {
      const teamA = stats.find(t => t.id === match.teamA_id);
      const teamB = stats.find(t => t.id === match.teamB_id);

      if (!teamA || !teamB) return;

      teamA.played++;
      teamB.played++;
      teamA.goalsFor += match.teamA_score;
      teamA.goalsAgainst += match.teamB_score;
      teamB.goalsFor += match.teamB_score;
      teamB.goalsAgainst += match.teamA_score;

      if (match.teamA_score > match.teamB_score) {
        teamA.wins++;
        teamA.points += 3;
        teamB.losses++;
      } else if (match.teamB_score > match.teamA_score) {
        teamB.wins++;
        teamB.points += 3;
        teamA.losses++;
      } else {
        teamA.draws++;
        teamB.draws++;
        teamA.points += 1;
        teamB.points += 1;
      }
    });

    stats.forEach(team => {
      team.goalDifference = team.goalsFor - team.goalsAgainst;
    });

    stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    return stats;
  }, [matches, teams]);

  return (
    <HomePageWrapper>
      <h1 style={{ textAlign: 'center' }}>우리반 리그 전체 순위</h1>
      <LeagueTable standings={standingsData} />
      {/* [추가] 나가기 버튼 */}
      <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
    </HomePageWrapper>
  );
}

export default HomePage;