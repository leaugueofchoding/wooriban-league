import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 임시로 만들 페이지 컴포넌트
function HomePage() {
  return <h1>우리반 리그 홈페이지</h1>;
}

function AdminPage() {
  return <h1>관리자 페이지</h1>;
}

function App() {
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