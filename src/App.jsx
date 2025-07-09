import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';

// --- 페이지 파일들을 불러옵니다 ---
import HomePage from './pages/HomePage'; // HomePage도 별도 파일로 분리하는 것이 좋습니다.
import AdminPage from './pages/AdminPage'; // 우리가 만든 AdminPage.jsx를 여기서 불러옵니다.

function App() {
  const { fetchInitialData, isLoading } = useLeagueStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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