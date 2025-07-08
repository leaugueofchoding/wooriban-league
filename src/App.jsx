import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';

// 임시 홈페이지: 데이터가 잘 들어오는지 확인하기 위함
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

function AdminPage() {
  return <h1>관리자 페이지</h1>;
}

function App() {
  const { fetchInitialData, isLoading } = useLeagueStore();

  // 앱이 처음 켜질 때 딱 한 번만 실행되는 부분
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Firebase에서 데이터를 불러오는 동안 "로딩 중..." 메시지를 표시
  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;