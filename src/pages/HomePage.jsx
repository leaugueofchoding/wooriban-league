// src/pages/HomePage.jsx

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import LeagueTable from '../components/LeagueTable.jsx';
import defaultEmblem from '../assets/default-emblem.png';
import { auth, createPlayerFromUser } from '../api/firebase.js';

const HomePageWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
`;

const JoinLeagueButton = styled.button`
  padding: 1rem 2rem;
  font-size: 1.2rem;
  font-weight: bold;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2rem;
  display: block;
  margin-left: auto;
  margin-right: auto;

  &:hover {
    background-color: #0056b3;
  }
`;

function HomePage() {
  const { matches, teams, players, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;

  // 현재 로그인한 사용자가 선수로 등록되어 있는지 확인
  const isPlayerRegistered = useMemo(() => {
    if (!currentUser) return false;
    return players.some(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  const handleJoinLeague = async () => {
    if (!currentUser) return alert('로그인이 필요합니다.');
    if (window.confirm('리그에 선수로 참가하시겠습니까?')) {
      try {
        await createPlayerFromUser(currentUser);
        alert('리그 참가 신청이 완료되었습니다!');
        await fetchInitialData(); // 선수 목록 새로고침
      } catch (error) {
        console.error("리그 참가 오류:", error);
        alert('참가 신청 중 오류가 발생했습니다.');
      }
    }
  };

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
      <h1 style={{ textAlign: 'center' }}>우리반 리그</h1>

      {currentUser && !isPlayerRegistered && (
        <JoinLeagueButton onClick={handleJoinLeague}>
          🏆 리그 참가 신청하기
        </JoinLeagueButton>
      )}

      <LeagueTable standings={standingsData} />
    </HomePageWrapper>
  );
}

export default HomePage;