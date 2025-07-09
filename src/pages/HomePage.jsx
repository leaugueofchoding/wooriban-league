import React from 'react';
import { useLeagueStore } from '../store/leagueStore';

function HomePage() {
  const { matches, teams, players } = useLeagueStore();
  
  return (
    <div>
      <h1>우리반 리그 홈페이지</h1>
      <p>데이터 로딩 완료!</p>
      <ul>
        <li>로드된 선수 수: {players.length}</li>
        <li>로드된 팀 수: {teams.length}</li>
        <li>로드된 경기 수: {matches.length}</li>
      </ul>
    </div>
  );
}

export default HomePage;