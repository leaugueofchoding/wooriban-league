import React from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import { useNavigate } from 'react-router-dom';

const PET_IMAGES = {
  dragon_lv1: 'https://via.placeholder.com/250/f08080/000000?Text=아기용',
  rabbit_lv1: 'https://via.placeholder.com/250/ffffff/000000?Text=아기토끼',
  turtle_lv1: 'https://via.placeholder.com/250/98fb98/000000?Text=아기거북',
};

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  text-align: center;
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
`;

const Title = styled.h1`
  margin-bottom: 2rem;
`;

const PetImage = styled.img`
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin-bottom: 1.5rem;
  border: 5px solid #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transition: filter 0.3s ease-in-out;
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
`;

const InfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
`;

const StatBarContainer = styled.div`
  width: 100%;
  max-width: 400px;
  height: 30px;
  background-color: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
  position: relative;
`;

const StatBar = styled.div`
  width: ${props => props.percent}%;
  height: 100%;
  background: ${props => props.barColor};
  transition: width 0.5s ease-in-out;
`;

const StatText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #343a40;
  font-weight: bold;
  text-shadow: 0 0 2px white;
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

  const { pet } = myPlayerData;
  const expPercent = (pet.exp / pet.maxExp) * 100;
  const hpPercent = (pet.hp / pet.maxHp) * 100;
  const spPercent = (pet.sp / pet.maxSp) * 100;
  const isFainted = pet.hp <= 0;

  return (
    <Wrapper>
      <Title>{pet.name} (Lv. {pet.level})</Title>

      <InfoContainer>
        <PetImage
          src={PET_IMAGES[pet.appearanceId] || 'https://via.placeholder.com/250'}
          alt={pet.name}
          $isFainted={isFainted}
        />

        {isFainted && <h2 style={{ color: '#dc3545' }}>전투 불능 상태입니다!</h2>}

        <StatBarContainer>
          <StatBar percent={hpPercent} barColor="linear-gradient(90deg, #90ee90, #28a745)" />
          <StatText>HP: {pet.hp} / {pet.maxHp}</StatText>
        </StatBarContainer>

        <StatBarContainer>
          <StatBar percent={spPercent} barColor="linear-gradient(90deg, #87cefa, #007bff)" />
          <StatText>SP: {pet.sp} / {pet.maxSp}</StatText>
        </StatBarContainer>

        <StatBarContainer>
          <StatBar percent={expPercent} barColor="linear-gradient(90deg, #ffc107, #ff9800)" />
          <StatText>EXP: {pet.exp} / {pet.maxExp}</StatText>
        </StatBarContainer>
      </InfoContainer>

      <ExitButton onClick={() => navigate('/profile')}>프로필로 돌아가기</ExitButton>
    </Wrapper>
  );
}

export default PetPage;