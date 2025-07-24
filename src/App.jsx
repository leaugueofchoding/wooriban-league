// src/App.jsx

import React, { useEffect, useState, useMemo } from 'react';
// [수정] react-router-dom에서 Link를 추가로 import합니다.
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

// Common Components
import Auth from './components/Auth';

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

// 이 컴포넌트가 Link를 사용하므로 import가 필요합니다.
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
  const { players } = useLeagueStore();
  const currentUser = auth.currentUser;
  const location = useLocation();

  const isPlayerRegistered = useMemo(() => {
    if (!currentUser) return false;
    return players.some(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  if (!currentUser || !isPlayerRegistered) {
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  const { fetchInitialData, isLoading } = useLeagueStore();
  const [authUser, setAuthUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>데이터 로딩 중...</div>;
  }

  return (
    <BrowserRouter>
      <Auth user={authUser} />
      <div className="main-content">
        <Routes>
          {/* --- 누구나 접근 가능한 페이지 --- */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="/league" element={<HomePage />} />


          {/* --- 리그 참가자만 접근 가능한 페이지 --- */}
          <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/winner" element={<ProtectedRoute><WinnerPage /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><AvatarEditPage /></ProtectedRoute>} />
          <Route path="/profile/:playerId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/recorder/:missionId" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
          <Route path="/recorder" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;