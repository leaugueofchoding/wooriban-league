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

  // isLoading 상태일 때는 App 컴포넌트가 전체 로딩 화면을 보여주므로,
  // 여기서는 로딩이 끝난 후의 접근 권한만 확인합니다.
  if (!isLoading && (!currentUser || !isPlayerRegistered)) {
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  const { isLoading, fetchInitialData, subscribeToNotifications, unsubscribeFromNotifications } = useLeagueStore();
  const [authChecked, setAuthChecked] = useState(false); // Firebase 인증 확인 여부만 관리

  useEffect(() => {
    // 앱 시작 시 딱 한 번만 실행되어 Firebase 인증 상태 리스너를 설정
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 사용자가 로그인 되어 있으면 데이터 로딩 시작
        fetchInitialData();
        subscribeToNotifications(user.uid);
      } else {
        // 로그아웃 상태이면 데이터 로딩 없이 로딩 상태 종료
        useLeagueStore.setState({ isLoading: false });
        unsubscribeFromNotifications();
      }
      setAuthChecked(true); // 인증 상태 확인 완료
    });
    return () => unsubscribe(); // 클린업
  }, [fetchInitialData, subscribeToNotifications, unsubscribeFromNotifications]);


  // 인증 확인이 안됐거나, 데이터 로딩이 끝나지 않았으면 로딩 화면 표시
  if (!authChecked || isLoading) {
    const message = !authChecked ? "인증 정보 확인 중..." : "데이터 로딩 중...";
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{message}</div>;
  }

  return (
    <BrowserRouter>
      <Auth user={auth.currentUser} />
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