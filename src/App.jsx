// src/App.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
// ▼▼▼ [수정] useClassStore를 함께 import 합니다. ▼▼▼
import { useLeagueStore, useClassStore } from './store/leagueStore';
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
import SuggestionPage from './pages/SuggestionPage';
import MyRoomPage from './pages/MyRoomPage';
import BroadcastPage from './pages/BroadcastPage';
import MissionGalleryPage from './pages/MissionGalleryPage';

// Common Components
import Auth from './components/Auth';
import AttendanceModal from './components/AttendanceModal';
import PointAdjustmentModal from './components/PointAdjustmentModal';
import Footer from './components/Footer';
import PatchNoteModal from './components/PatchNoteModal';

const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex-grow: 1;
`;

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
      <p>이 페이지에 접근할 수 있는 권한이 없거나, 로그인이 필요합니다.</p>
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

const AdminRoute = ({ children }) => {
  const { players, isLoading } = useLeagueStore();
  const currentUser = auth.currentUser;
  const location = useLocation();

  const myPlayerData = useMemo(() => {
    if (!currentUser || players.length === 0) return null;
    return players.find(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  if (isLoading) {
    return null;
  }

  if (!currentUser || !myPlayerData || myPlayerData.role !== 'admin') {
    return <Navigate to="/access-denied" state={{ from: location }} replace />;
  }

  return children;
};


function App() {
  // ▼▼▼ [수정] leagueStore와 classStore에서 필요한 상태와 함수를 가져옵니다. ▼▼▼
  const {
    isLoading, setLoading, initializeClass, cleanupListeners,
    checkAttendance, pointAdjustmentNotification
  } = useLeagueStore();
  const { classId, setClassId } = useClassStore();
  // ▲▲▲ 여기까지 수정 ▲▲▲

  const [authChecked, setAuthChecked] = useState(false);
  const [isPatchNoteModalOpen, setIsPatchNoteModalOpen] = useState(false);

  useEffect(() => {
    // ▼▼▼ [수정] 앱 시작 시 기본 classId를 설정하고, leagueStore를 초기화합니다. ▼▼▼
    // TODO: 향후 이 부분은 학급 선택 UI나 초대 코드 로직으로 대체되어야 합니다.
    const defaultClassId = "6-1"; // 임시 기본 학급 ID
    setClassId(defaultClassId);
    initializeClass(defaultClassId);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // 이미 initializeClass에서 fetchInitialData를 호출하므로 중복 호출 제거
        checkAttendance();
      } else {
        cleanupListeners();
        // 로그아웃 시에도 데이터를 다시 불러와 비로그인 상태 UI를 올바르게 표시
        initializeClass(defaultClassId);
      }
      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsubscribe();
    // initializeClass를 의존성 배열에 추가하여 classId 변경 시에도 데이터 리로드
  }, [initializeClass, cleanupListeners, checkAttendance, setLoading, setClassId]);


  if (!authChecked || isLoading) {
    const message = !authChecked ? "인증 정보 확인 중..." : (classId ? "데이터 로딩 중..." : "학급 정보를 설정하는 중...");
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{message}</div>;
  }

  return (
    <BrowserRouter>
      <AppWrapper>
        <Auth user={auth.currentUser} />
        <AttendanceModal />
        {pointAdjustmentNotification && <PointAdjustmentModal />}
        <PatchNoteModal isOpen={isPatchNoteModalOpen} onClose={() => setIsPatchNoteModalOpen(false)} />
        <MainContent>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/broadcast" element={<BroadcastPage />} />

            <Route path="/league" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/league/teams/:teamId" element={<ProtectedRoute><TeamDetailPage /></ProtectedRoute>} />

            <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="/admin/:tab" element={<AdminRoute><AdminPage /></AdminRoute>} />

            <Route path="/winner" element={<ProtectedRoute><WinnerPage /></ProtectedRoute>} />

            <Route path="/profile/edit" element={<ProtectedRoute><AvatarEditPage /></ProtectedRoute>} />
            <Route path="/profile/:playerId/stats" element={<ProtectedRoute><PlayerStatsPage /></ProtectedRoute>} />
            <Route path="/profile/:playerId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

            <Route path="/recorder-dashboard" element={<ProtectedRoute><RecorderDashboardPage /></ProtectedRoute>} />
            <Route path="/recorder/:missionId" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
            <Route path="/recorder" element={<ProtectedRoute><RecorderPage /></ProtectedRoute>} />
            <Route path="/suggestions" element={<ProtectedRoute><SuggestionPage /></ProtectedRoute>} />

            <Route path="/my-room/:playerId" element={<ProtectedRoute><MyRoomPage /></ProtectedRoute>} />
            <Route path="/mission-gallery" element={<ProtectedRoute><MissionGalleryPage /></ProtectedRoute>} />
          </Routes>
        </MainContent>
        <Footer onVersionClick={() => setIsPatchNoteModalOpen(true)} />
      </AppWrapper>
    </BrowserRouter>
  );
}

export default App;