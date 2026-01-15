// src/pages/JoinPage.jsx

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../store/leagueStore';
import { getClassInfoByInviteCode } from '../api/firebase'; // [추가]

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
  padding: 2rem;
  /* 배경색은 App.jsx의 GlobalBackground에서 처리 */
`;

const Card = styled.div`
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 3rem 2.5rem;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  max-width: 450px;
  width: 100%;
  animation: ${fadeIn} 0.6s ease-out;
  border: 1px solid rgba(255,255,255,0.8);
`;

const EmojiHeader = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: ${fadeIn} 0.8s ease-out;
`;

const Title = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  color: #343a40;
  margin-bottom: 1rem;
  word-break: keep-all;
`;

const ClassNameHighlight = styled.div`
  background-color: #e7f5ff;
  color: #1c7ed6;
  font-size: 1.3rem;
  font-weight: 900;
  padding: 1rem;
  border-radius: 12px;
  margin: 1.5rem 0;
  border: 2px solid #a5d8ff;
`;

const InfoText = styled.p`
  font-size: 1.1rem;
  color: #868e96;
  margin-bottom: 2.5rem;
  line-height: 1.6;
  word-break: keep-all;
`;

const JoinButton = styled.button`
  width: 100%;
  padding: 1.2rem;
  font-size: 1.2rem;
  font-weight: 800;
  color: white;
  background-color: #20c997;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 4px 15px rgba(32, 201, 151, 0.3);

  &:hover {
    background-color: #12b886;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(32, 201, 151, 0.4);
  }
  
  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 10px rgba(32, 201, 151, 0.3);
  }
  
  &:disabled {
    background-color: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.p`
  color: #fa5252;
  font-weight: bold;
  background-color: #fff5f5;
  padding: 0.8rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
`;

function JoinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { joinClassWithInviteCode } = useLeagueStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [className, setClassName] = useState(null); // 학급 이름 상태 추가

  const inviteCode = new URLSearchParams(location.search).get('inviteCode');

  useEffect(() => {
    if (!inviteCode) {
      navigate('/');
      return;
    }

    // [추가] 학급 정보 미리 가져오기
    const fetchClassInfo = async () => {
      const name = await getClassInfoByInviteCode(inviteCode);
      if (name) {
        setClassName(name);
      } else {
        setError("유효하지 않은 초대 코드입니다.");
      }
    };
    fetchClassInfo();
  }, [inviteCode, navigate]);

  const handleJoin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await joinClassWithInviteCode(inviteCode);
      alert(`🎉 '${className}'에 오신 것을 환영합니다!`);
      sessionStorage.removeItem('inviteCode');
      navigate('/');
    } catch (error) {
      console.error("가입 에러:", error);
      setError("가입 중 오류가 발생했습니다. 이미 가입된 계정인지 확인해주세요.");
      setIsLoading(false);
    }
  };

  return (
    <Wrapper>
      <Card>
        <EmojiHeader>🏫 👋</EmojiHeader>

        {className ? (
          <>
            <Title>우리 반이 맞나요?</Title>
            <ClassNameHighlight>{className}</ClassNameHighlight>
            <InfoText>
              맞다면 아래 버튼을 눌러<br />
              바로 입장해 주세요!
            </InfoText>
          </>
        ) : (
          <>
            <Title>학급 정보를 찾는 중...</Title>
            <InfoText>잠시만 기다려 주세요 돋보기 🔎</InfoText>
          </>
        )}

        {error && <ErrorMessage>⚠️ {error}</ErrorMessage>}

        <JoinButton onClick={handleJoin} disabled={isLoading || !className}>
          {isLoading ? '등록 중...' : '네, 우리 반 맞아요! 🚀'}
        </JoinButton>
      </Card>
    </Wrapper>
  );
}

export default JoinPage;