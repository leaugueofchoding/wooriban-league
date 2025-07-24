// src/App.jsx

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './api/firebase';

// Page Components
import DashboardPage from './pages/DashboardPage'; // 👈 [추가]
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import AvatarEditPage from './pages/AvatarEditPage.jsx';
import ShopPage from './pages/ShopPage';
import MissionsPage from './pages/MissionsPage';
import RecorderPage from './pages/RecorderPage';
import WinnerPage from './pages/WinnerPage';

// Common Components
import Auth from './components/Auth';

function App() {
  const { fetchInitialData, isLoading } = useLeagueStore();
  const [authUser, setAuthUser] = useState(null);

  // Firebase 인증 상태 리스너
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
        console.log("로그인된 사용자:", user);
      } else {
        setAuthUser(null);
      }
    });
    // 컴포넌트가 언마운트될 때 리스너 정리
    return () => unsubscribe();
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 데이터 로딩 중일 때 로딩 화면 표시
  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>데이터 로딩 중...</div>;
  }

  return (
    <BrowserRouter>
      {/* Auth 컴포넌트는 모든 페이지 상단에 위치하여 로그인 및 사용자 정보를 처리합니다. */}
      <Auth user={authUser} />

      <div className="main-content">
        {/* Routes 컴포넌트는 URL 경로에 따라 렌더링할 컴포넌트를 결정합니다. */}
        <Routes>
          {/* 기본 경로 */}
          <Route path="/" element={<DashboardPage />} />

          {/* 주요 기능 페이지 경로 */}
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/winner" element={<WinnerPage />} />

          {/* 프로필 관련 경로는 구체적인 경로를 상단에 배치해야 합니다. */}
          <Route path="/profile/edit" element={<AvatarEditPage />} />
          <Route path="/profile/:playerId" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* ▼▼▼▼▼ 에러가 발생한 RecorderPage 경로 수정 ▼▼▼▼▼ */}
          {/* 이 경로는 /recorder/문자열 형태의 URL을 정확히 처리합니다. */}
          {/* 예: /recorder/3vwRlHzfpfJ1uopTbAUG */}
          <Route path="/recorder/:missionId" element={<RecorderPage />} />

          {/* 이 경로는 /recorder 라는 URL을 처리합니다. (missionId가 없는 경우) */}
          <Route path="/recorder" element={<RecorderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
