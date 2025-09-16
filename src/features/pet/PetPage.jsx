import React from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import { useNavigate } from 'react-router-dom';

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  text-align: center;
`;

const Title = styled.h1`
  margin-bottom: 2rem;
`;

const ExitButton = styled.button`
  margin-top: 2rem;
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background-color: #5a6268;
  }
`;

function PetPage() {
    const navigate = useNavigate();
    const { players } = useLeagueStore();
    const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);

    if (!myPlayerData || !myPlayerData.pet) {
        return (
            <Wrapper>
                <h2>펫 정보를 불러오는 중...</h2>
                <ExitButton onClick={() => navigate('/profile')}>프로필로 돌아가기</ExitButton>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Title>{myPlayerData.pet.name} (Lv. {myPlayerData.pet.level})</Title>
            <p>펫의 상세 정보와 관리 기능은 여기에 표시될 예정입니다.</p>
            {/* 펫 이미지, 경험치 바, 스킬 정보 등이 여기에 추가됩니다. */}
            <ExitButton onClick={() => navigate('/profile')}>프로필로 돌아가기</ExitButton>
        </Wrapper>
    );
}

export default PetPage;