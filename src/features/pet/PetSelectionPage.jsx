import React, { useState } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../../store/leagueStore';
import { useNavigate } from 'react-router-dom';

// 임시 이미지 URL - 나중에 생성된 이미지로 교체합니다.
const PET_IMAGES = {
    dragon: 'https://via.placeholder.com/150/f08080/000000?Text=용',
    rabbit: 'https://via.placeholder.com/150/ffffff/000000?Text=토끼',
    turtle: 'https://via.placeholder.com/150/98fb98/000000?Text=거북이',
};

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
  margin-top: 3rem;
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

const PET_DATA = {
    dragon: { name: '아기용', description: '강력한 한 방을 가진 공격형 펫입니다.' },
    rabbit: { name: '아기토끼', description: '배틀을 유리하게 이끄는 지원형 펫입니다.' },
    turtle: { name: '아기거북', description: '어떤 공격도 버텨내는 방어형 펫입니다.' },
};

function PetSelectionPage() {
    const [selectedPet, setSelectedPet] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const { selectInitialPet } = useLeagueStore();
    const navigate = useNavigate();

    const handleSelect = async () => {
        if (!selectedPet) return;
        setIsLoading(true);
        try {
            await selectInitialPet(selectedPet, PET_DATA[selectedPet].name);
            alert(`${PET_DATA[selectedPet].name}와(과) 함께하게 된 것을 축하합니다!`);
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
                {Object.keys(PET_DATA).map(petKey => (
                    <PetCard
                        key={petKey}
                        $isSelected={selectedPet === petKey}
                        onClick={() => setSelectedPet(petKey)}
                    >
                        <PetImage src={PET_IMAGES[petKey]} alt={PET_DATA[petKey].name} />
                        <PetName>{PET_DATA[petKey].name}</PetName>
                        <PetDescription>{PET_DATA[petKey].description}</PetDescription>
                    </PetCard>
                ))}
            </PetSelectionContainer>
            <ConfirmButton onClick={handleSelect} disabled={!selectedPet || isLoading}>
                {isLoading ? '선택 중...' : '이 펫으로 결정할래요!'}
            </ConfirmButton>
        </Wrapper>
    );
}

export default PetSelectionPage;