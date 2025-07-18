// src/App.jsx 파일의 내용을 아래 코드로 전체 교체합니다.

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useLeagueStore } from './store/leagueStore';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './api/firebase';

import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import Auth from './components/Auth'; // 새로 만든 Auth 컴포넌트 import

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
      {/* Auth 컴포넌트를 앱 최상단에 배치 */}
      <Auth user={authUser} />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;