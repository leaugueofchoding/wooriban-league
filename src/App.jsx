// src/App.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useLeagueStore, useClassStore } from './store/leagueStore';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './api/firebase';
import styled, { createGlobalStyle } from 'styled-components'; // createGlobalStyle 추가

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
import LandingPage from './pages/LandingPage.jsx';
import JoinPage from './pages/JoinPage.jsx';
import PetPage from './features/pet/PetPage.jsx';
import PetSelectionPage from './features/pet/PetSelectionPage.jsx';
import PetCenterPage from './features/pet/PetCenterPage.jsx';

// Common Components
import Auth from './components/Auth';
import AttendanceModal from './components/AttendanceModal';
import PointAdjustmentModal from './components/PointAdjustmentModal';
import Footer from './components/Footer';
import PatchNoteModal from './components/PatchNoteModal';
import BattlePage from './features/battle/BattlePage.jsx';
import TermsPage from './pages/TermsPage';

// [추가] 전역 배경색 스타일 컴포넌트
const GlobalBackground = createGlobalStyle`
  body {
    background-color: ${props => props.$themeColor};
    transition: background-color 0.3s ease;
    margin: 0;
    padding: 0;
    min-height: 100vh;
  }
`;

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

  const inviteCode = sessionStorage.getItem('inviteCode');
  if (currentUser && inviteCode) {
    return <Navigate to={`/join?inviteCode=${inviteCode}`} state={{ from: location }} replace />;
  }

  if (!currentUser || !isPlayerRegistered) {
    return <Navigate to="/" state={{ from: location }} replace />;
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
  const {
    isLoading, setLoading, initializeClass, cleanupListeners,
    checkAttendance, pointAdjustmentNotification, themeColor // [추가] themeColor 가져오기
  } = useLeagueStore();
  const { classId, setClassId } = useClassStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [isPatchNoteModalOpen, setIsPatchNoteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const defaultClassId = "25-hwachang-6-2";
    if (!classId) {
      setClassId(defaultClassId);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        const inviteCode = sessionStorage.getItem('inviteCode');
        if (inviteCode) {
          // JoinPage will handle the logic
        } else {
          await initializeClass(classId || defaultClassId);
          checkAttendance();
        }
      } else {
        cleanupListeners();
        await initializeClass(classId || defaultClassId);
      }

      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [initializeClass, cleanupListeners, checkAttendance, setLoading, classId, setClassId]);


  if (!authChecked || isLoading) {
    const message = !authChecked ? "인증 정보 확인 중..." : (classId ? "데이터 로딩 중..." : "학급 정보를 설정하는 중...");
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{message}</div>;
  }

  return (
    <BrowserRouter>
      {/* [추가] 전역 배경색 적용 */}
      <GlobalBackground $themeColor={themeColor} />

      <AppWrapper>
        {currentUser && <Auth user={currentUser} />}
        <AttendanceModal />
        {pointAdjustmentNotification && <PointAdjustmentModal />}
        <PatchNoteModal isOpen={isPatchNoteModalOpen} onClose={() => setIsPatchNoteModalOpen(false)} />
        <MainContent>
          <Routes>
            <Route path="/" element={currentUser ? <DashboardPage /> : <LandingPage />} />
            <Route path="/join" element={currentUser ? <JoinPage /> : <Navigate to="/" />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/broadcast" element={<BroadcastPage />} />

            <Route path="/league" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/league/teams/:teamId" element={<ProtectedRoute><TeamDetailPage /></ProtectedRoute>} />
            <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
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

            <Route path="/pet" element={<ProtectedRoute><PetPage /></ProtectedRoute>} />
            <Route path="/pet/select" element={<ProtectedRoute><PetSelectionPage /></ProtectedRoute>} />
            <Route path="/pet-center" element={<ProtectedRoute><PetCenterPage /></ProtectedRoute>} />
            <Route path="/battle/:opponentId" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="/admin/:tab" element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </MainContent>
        <Footer onVersionClick={() => setIsPatchNoteModalOpen(true)} />
      </AppWrapper>
    </BrowserRouter>
  );
}

export default App;