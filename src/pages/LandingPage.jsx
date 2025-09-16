// src/pages/LandingPage.jsx

import React, { useState } from 'react'; // useState 추가
import styled, { keyframes } from 'styled-components';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, updateUserProfile } from '../api/firebase.js';
import { useNavigate } from 'react-router-dom'; // useNavigate 추가

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
  padding: 2rem;
  background-color: #f0f2f5;
`;

const Logo = styled.h1`
  font-size: 4rem;
  font-weight: 900;
  color: #007bff;
  margin-bottom: 1rem;
  animation: ${bounce} 2s infinite;
  cursor: default;

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.5rem;
  color: #495057;
  margin-bottom: 3rem;

  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const LoginButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 2.5rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: #444;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: all 0.2s ease-in-out;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
  }
`;

const GoogleIcon = styled.svg`
  width: 24px;
  height: 24px;
`;

const InviteSection = styled.div`
  margin-top: 2rem;
  color: #6c757d;
`;

const InviteInput = styled.input`
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  margin-right: 0.5rem;
  width: 200px;
  text-align: center;
`;

const JoinButton = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: bold;
  color: white;
  background-color: #28a745;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover { background-color: #218838; }
`;

function LandingPage() {
  const navigate = useNavigate(); // useNavigate 훅 사용
  const [inviteCode, setInviteCode] = useState(''); // 초대 코드 상태 추가

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        updateUserProfile(result.user);
        // 로그인 성공 후, App.jsx의 로직에 따라 이동
      })
      .catch((error) => console.error("Google 로그인 오류:", error));
  };

  const handleJoinWithCode = () => {
    if (!inviteCode.trim()) {
      alert("초대 코드를 입력해주세요.");
      return;
    }
    // 로그인 후 가입 절차를 진행하도록 유도
    alert("먼저 Google 계정으로 시작하기 버튼을 눌러 로그인해주세요!\n로그인 후 자동으로 가입 페이지로 이동됩니다.");
    // 초대 코드를 세션 스토리지에 임시 저장
    sessionStorage.setItem('inviteCode', inviteCode);
    handleGoogleLogin();
  }

  return (
    <Wrapper>
      <Logo>🚀 우리반 리그</Logo>
      <Subtitle>미션, 경쟁, 보상을 통해 성장하는 우리 반!</Subtitle>

      <LoginButton onClick={handleGoogleLogin}>
        <GoogleIcon viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          <path fill="none" d="M0 0h48v48H0z"></path>
        </GoogleIcon>
        <span>Google 계정으로 시작하기</span>
      </LoginButton>

      <InviteSection>
        <p>선생님께 받은 초대 코드가 있나요?</p>
        <div>
          <InviteInput
            placeholder="초대 코드 입력"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <JoinButton onClick={handleJoinWithCode}>가입하기</JoinButton>
        </div>
      </InviteSection>
    </Wrapper>
  );
}

export default LandingPage;