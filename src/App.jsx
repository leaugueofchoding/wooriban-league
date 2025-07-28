// src/App.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './api/firebase';
import styled from 'styled-components';

// Page Components
import DashboardPage from './pages/DashboardPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import AvatarEditPage from './pages/AvatarEditPage.jsx';
import ShopPage from './pages/ShopPage';
import MissionsPage from './pages/MissionsPage';
import RecorderPage from './pages/RecorderPage';
import WinnerPage from './pages/WinnerPage';
import RecorderDashboardPage from './pages/RecorderDashboardPage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import TeamDetailPage from './pages/TeamDetailPage';

// Common Components
import Auth from './components/Auth';
import AttendanceModal from './components/AttendanceModal';
import Footer from './components/Footer'; // [추가] Footer 컴포넌트 import

// ▼▼▼ [추가] 전체 앱 레이아웃을 위한 Wrapper ▼▼▼
const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex-grow: 1;
`;


// AccessDenied, ProtectedRoute 컴포넌트는 기존과 동일
const AccessDeniedWrapper = styled.div`
  max-width: 800px;
  margin: 4rem auto;
  padding: 2rem;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
`;
const AccessDeniedMessage = styled.h2`
  color: #dc3545;
`;
const GoToHomeButton = styled(Link)`
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.8rem 1.5rem;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
`;

function AccessDenied() {
  return (
    <AccessDeniedWrapper>
      <AccessDeniedMessage>🚫 접근 권한이 없습니다.</AccessDeniedMessage>
      <p>로그인 후 리그에 참가해야 이용할 수 있는 페이지입니다.</p>
      <GoToHomeButton to="/">대시보드로 돌아가기</GoToHomeButton>
    </AccessDeniedWrapper>
  );
}

const ProtectedRoute = ({ children }) => {
  const { players, isLoading } = useLeagueStore();
  const currentUser = auth.currentUser;
  const location = useLocation();

  const isPlayerRegistered = useMemo(() => {
    if (!currentUser || players.length === 0) return false;
    return players.some(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  if (isLoading) {
    return null;
  }

  if (!currentUser || !isPlayerRegistered) {
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }

  return children;
};


function App() {
  const { isLoading, setLoading, fetchInitialData, cleanupListeners, checkAttendance } = useLeagueStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        await fetchInitialData();
        checkAttendance();
      } else {
        cleanupListeners();
        await fetchInitialData();
      }
      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchInitialData, cleanupListeners, checkAttendance, setLoading]);


  if (!authChecked || isLoading) {
    const message = !authChecked ? "인증 정보 확인 중..." : "데이터 로딩 중...";
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{message}</div>;
  }

  return (
    <BrowserRouter>
      {/* ▼▼▼ [수정] AppWrapper로 전체 구조 변경 ▼▼▼ */}
      <AppWrapper>
        <Auth user={auth.currentUser} />
        <AttendanceModal />
        <MainContent>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* 가가볼 리그 관련 라우트 */}
            <Route path="/league" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/league/teams/:teamId" element={<ProtectedRoute><TeamDetailPage /></ProtectedRoute>} />


            <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/winner" element={<ProtectedRoute><WinnerPage /></ProtectedRoute>} />

            {/* 프로필 관련 라우트 */}
            <Route path="/profile/edit" element={<ProtectedRoute><AvatarEditPage /></ProtectedRoute>} />
            <Route path="/profile/:playerId/stats" element={<ProtectedRoute><PlayerStatsPage /></ProtectedRoute>} />
            <Route path="/profile/:playerId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            {/* 기록원 관련 라우트 */}
            <Route path="/recorder-dashboard" element={<ProtectedRoute><RecorderDashboardPage /></ProtectedRoute>} />
            <Route path="/recorder/:missionId" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
            <Route path="/recorder" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
          </Routes>
        </MainContent>
        <Footer /> {/* [추가] Footer 컴포넌트 렌더링 */}
      </AppWrapper>
    </BrowserRouter>
  );
}

export default App;