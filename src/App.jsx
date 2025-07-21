// src/App.jsx 파일의 내용을 아래 코드로 전체 교체합니다.

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './api/firebase';

import HomePage from './pages/HomePage';

import AdminPage from './pages/AdminPage';
import Auth from './components/Auth'; // 새로 만든 Auth 컴포넌트 import
import ProfilePage from './pages/ProfilePage'; // 1. 새 페이지 import
import AvatarEditPage from './pages/AvatarEditPage.jsx'; // 1. 새 페이지 import
import WinnerPage from './pages/WinnerPage'; // 테스트를 위해 임시로 WinnerPage를 import 합니다.
import ShopPage from './pages/ShopPage'; // 1. ShopPage를 import 합니다.

function App() {
  const { fetchInitialData, isLoading } = useLeagueStore();
  const [authUser, setAuthUser] = useState(null); // 로그인한 사용자 정보 저장

  // Firebase 인증 상태 리스너
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 사용자가 로그인한 경우
        setAuthUser(user);
        console.log("로그인된 사용자:", user);
      } else {
        // 사용자가 로그아웃한 경우
        setAuthUser(null);
      }
    });

    // 컴포넌트가 언마운트될 때 리스너 정리
    return () => unsubscribe();
  }, []);

  // 리그 데이터 로딩
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) {
    return <div>데이터 로딩 중...</div>;
  }

  return (
    <BrowserRouter>
      <Auth user={authUser} />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} /> {/* 2. /shop 경로를 추가합니다. */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/profile/:playerId" element={<ProfilePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<AvatarEditPage />} /> {/* 2. 새 경로 추가 */}

          {/* 2. 테스트를 위한 임시 경로를 추가합니다. */}
          <Route path="/winner" element={<WinnerPage />} />


        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
