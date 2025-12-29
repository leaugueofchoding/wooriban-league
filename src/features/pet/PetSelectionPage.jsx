// src/features/pet/PetSelectionPage.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '@/store/leagueStore';
import { useNavigate } from 'react-router-dom';
import { auth } from '@/api/firebase'; // auth 추가
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA } from '@/features/pet/petData';

// --- Styled Components ---
const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  text-align: center;
`;
const Title = styled.h1`
  margin-bottom: 1rem;
`;
const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #6c757d;
  margin-bottom: 3rem;
`;
const PetSelectionContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
`;
const PetCard = styled.div`
  width: 200px;
  padding: 1.5rem;
  border: 3px solid ${props => props.$isSelected ? '#007bff' : '#eee'};
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  box-shadow: ${props => props.$isSelected ? '0 6px 15px rgba(0, 123, 255, 0.3)' : '0 4px 6px rgba(0,0,0,0.1)'};
  transform: ${props => props.$isSelected ? 'translateY(-10px)' : 'none'};
  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 6px 15px rgba(0,0,0,0.2);
  }
`;
const PetImage = styled.img`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #f0f0f0;
  margin-bottom: 1rem;
`;
const PetName = styled.h3`
  margin: 0.5rem 0;
  font-size: 1.5rem;
`;
const PetDescription = styled.p`
  font-size: 0.9rem;
  color: #666;
  min-height: 50px;
`;
const ConfirmButton = styled.button`
  margin-top: 1.5rem;
  padding: 1rem 3rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  background-color: #28a745;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:disabled {
    background-color: #6c757d;
  }
  &:hover:not(:disabled) {
    background-color: #218838;
  }
`;
const NicknameInput = styled.input`
  margin-top: 2rem;
  padding: 0.75rem;
  font-size: 1.1rem;
  text-align: center;
  border: 2px solid #ced4da;
  border-radius: 8px;
  width: 100%;
  max-width: 300px;
  
  &:focus {
    border-color: #007bff;
    outline: none;
  }
`;

function PetSelectionPage() {
  const [selectedPet, setSelectedPet] = useState(null);
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { selectInitialPet, players } = useLeagueStore(); // players 가져오기
  const navigate = useNavigate();
  const currentUser = auth.currentUser; // 현재 유저 확인용

  const PET_SELECTION_DATA = {
    dragon: { ...PET_DATA.dragon, image: petImageMap.dragon_lv1_idle },
    rabbit: { ...PET_DATA.rabbit, image: petImageMap.rabbit_lv1_idle },
    turtle: { ...PET_DATA.turtle, image: petImageMap.turtle_lv1_idle },
  };

  // ▼▼▼ [추가] 진입 시 펫 보유 여부 체크 및 차단 로직 ▼▼▼
  useEffect(() => {
    if (currentUser && players.length > 0) {
      const myData = players.find(p => p.authUid === currentUser.uid);

      // 이미 펫이 있거나(pets 배열), 파트너 펫이 설정된 경우
      if (myData && (myData.partnerPetId || (myData.pets && myData.pets.length > 0))) {
        alert("이미 파트너 펫이 있습니다! 마이펫 페이지로 이동합니다.");
        navigate('/pet'); // 펫 페이지로 강제 이동
      }
    }
  }, [currentUser, players, navigate]);
  // ▲▲▲ --------------------------------------------- ▲▲▲

  const handleSelect = async () => {
    if (!selectedPet) return;
    setIsLoading(true);
    const finalName = nickname.trim() || PET_SELECTION_DATA[selectedPet].name;
    try {
      await selectInitialPet(selectedPet, finalName);
      alert(`${finalName}와(과) 함께하게 된 것을 축하합니다!`);
      navigate('/pet');
    } catch (error) {
      alert(`펫 선택 중 오류 발생: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <Wrapper>
      <Title>첫 파트너를 선택하세요!</Title>
      <Subtitle>한 번 선택한 펫은 바꿀 수 없으니 신중하게 골라주세요.</Subtitle>
      <PetSelectionContainer>
        {Object.entries(PET_SELECTION_DATA).map(([petKey, petInfo]) => (
          <PetCard
            key={petKey}
            $isSelected={selectedPet === petKey}
            onClick={() => setSelectedPet(petKey)}
          >
            <PetImage src={petInfo.image} alt={petInfo.name} />
            <PetName>{petInfo.name}</PetName>
            <PetDescription>{petInfo.description}</PetDescription>
          </PetCard>
        ))}
      </PetSelectionContainer>

      {selectedPet && (
        <NicknameInput
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={`${PET_SELECTION_DATA[selectedPet].name}의 이름을 지어주세요 (선택)`}
          maxLength={10}
        />
      )}

      <ConfirmButton onClick={handleSelect} disabled={!selectedPet || isLoading}>
        {isLoading ? '선택 중...' : '이 펫으로 결정할래요!'}
      </ConfirmButton>
    </Wrapper>
  );
}

export default PetSelectionPage;