// src/pages/HomePage.jsx 파일의 내용을 아래 코드로 전체 교체하세요.

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import LeagueTable from '../components/LeagueTable.jsx'; // 새로 만든 컴포넌트 import

const HomePageWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`;

function HomePage() {
  const { matches, teams } = useLeagueStore();

  const standingsData = useMemo(() => {
    const completedMatches = matches.filter(m => m.status === '완료');

    let stats = teams.map(team => ({
      id: team.id,
      teamName: team.teamName,
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

      if (match.teamA_score > match.teamB_score) { // A팀 승리
        teamA.wins++;
        teamA.points += 3;
        teamB.losses++;
      } else if (match.teamB_score > match.teamA_score) { // B팀 승리
        teamB.wins++;
        teamB.points += 3;
        teamA.losses++;
      } else { // 무승부
        teamA.draws++;
        teamB.draws++;
        teamA.points += 1;
        teamB.points += 1;
      }
    });

    stats.forEach(team => {
      team.goalDifference = team.goalsFor - team.goalsAgainst;
    });

    // 정렬: 1. 승점(내림차순) 2. 득실차(내림차순) 3. 다득점(내림차순)
    stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    return stats;
  }, [matches, teams]);

  return (
    <HomePageWrapper>
      <h1>우리반 리그 순위</h1>
      <LeagueTable standings={standingsData} />
    </HomePageWrapper>
  );
}

export default HomePage;