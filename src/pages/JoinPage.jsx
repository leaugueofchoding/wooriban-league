// src/pages/JoinPage.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../store/leagueStore'; // useClassStore import

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

const Card = styled.div`
  background-color: #fff;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-width: 400px;
  width: 100%;
`;

const Title = styled.h1`
  font-size: 2rem;
  color: #343a40;
  margin-bottom: 1rem;
`;

const InfoText = styled.p`
  font-size: 1.1rem;
  color: #6c757d;
  margin-bottom: 2rem;
  line-height: 1.6;
`;

const JoinButton = styled.button`
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  background-color: #28a745;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #218838;
  }
  
  &:disabled {
    background-color: #6c757d;
  }
`;

function JoinPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { joinClassWithInviteCode } = useLeagueStore(); // ◀◀◀ [수정]
    const { setClassId } = useClassStore(); // ◀◀◀ [추가]
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const inviteCode = new URLSearchParams(location.search).get('inviteCode');
    const [className, setClassName] = useState('...'); // 학급 이름을 표시할 상태

    useEffect(() => {
        if (!inviteCode) {
            navigate('/');
        }
        // 이 부분은 다음 단계에서 초대 코드로 학급 이름을 가져오는 로직으로 확장됩니다.
    }, [inviteCode, navigate]);

    const handleJoin = async () => {
        setIsLoading(true);
        setError('');
        try {
            await joinClassWithInviteCode(inviteCode);
            alert('우리반 리그에 오신 것을 환영합니다!');
            navigate('/'); // 가입 후 메인 페이지(대시보드)로 이동
        } catch (error) {
            setError(error.message);
            setIsLoading(false);
        }
    };

    return (
        <Wrapper>
            <Card>
                <Title>학급에 참여하기</Title>
                <InfoText>
                    선생님께 공유받은 초대 코드로<br />
                    우리반 리그에 참여하시겠습니까?
                </InfoText>
                {/* 에러 메시지 표시 */}
                {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}

                <JoinButton onClick={handleJoin} disabled={isLoading}>
                    {isLoading ? '등록 중...' : `네, 참여할래요!`}
                </JoinButton>
            </Card>
        </Wrapper>
    );
}

export default JoinPage;