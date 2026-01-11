// src/features/pet/PetSelectionPage.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '@/store/leagueStore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '@/api/firebase'; // db 추가
import { doc, getDoc } from 'firebase/firestore'; // firestore 함수 추가
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

// 로딩 중 UI (간단하게 구현)
const LoadingMessage = styled.div`
  margin-top: 4rem;
  font-size: 1.2rem;
  color: #666;
`;

function PetSelectionPage() {
  const [selectedPet, setSelectedPet] = useState(null);
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true); // DB 확인 로딩 상태

  const { selectInitialPet, classId } = useLeagueStore(); // classId 가져오기
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const PET_SELECTION_DATA = {
    dragon: { ...PET_DATA.dragon, image: petImageMap.dragon_lv1_idle },
    rabbit: { ...PET_DATA.rabbit, image: petImageMap.rabbit_lv1_idle },
    turtle: { ...PET_DATA.turtle, image: petImageMap.turtle_lv1_idle },
  };

  // ▼▼▼ [수정] DB 직접 조회 로직으로 변경 ▼▼▼
  useEffect(() => {
    const checkPetStatus = async () => {
      // 로그아웃 상태면 인증 처리될 때까지 대기
      if (!currentUser) return;

      // classId가 아직 로드되지 않았으면 대기 (App.jsx에서 로드됨)
      if (!classId) return;

      try {
        // Store 데이터가 아닌 Firestore 최신 데이터 조회
        // (플레이어 ID는 보통 authUid와 동일하게 생성되므로 currentUser.uid 사용)
        const playerRef = doc(db, 'classes', classId, 'players', currentUser.uid);
        const playerSnap = await getDoc(playerRef);

        if (playerSnap.exists()) {
          const playerData = playerSnap.data();

          // [핵심] partnerPetId가 있더라도 실제 pets 배열이 비어있으면 펫이 없는 것으로 간주합니다.
          // DB에서 pets 필드를 삭제해도 찌꺼기 partnerPetId가 남아 무한 루프가 도는 것을 방지합니다.
          const hasRealPet = playerData.pets && Array.isArray(playerData.pets) && playerData.pets.length > 0;

          if (hasRealPet) {
            alert("이미 파트너 펫이 있습니다! 마이펫 페이지로 이동합니다.");
            navigate('/pet', { replace: true });
            return;
          }
        }
        // 펫이 없으면 선택 페이지 유지
        setIsCheckingStatus(false);

      } catch (error) {
        console.error("펫 상태 확인 중 오류:", error);
        // 에러 발생 시 일단 선택 페이지를 보여주되 알림
        // alert("정보를 불러오는 중 오류가 발생했습니다.");
        setIsCheckingStatus(false);
      }
    };

    checkPetStatus();
  }, [currentUser, classId, navigate]);
  // ▲▲▲ --------------------------------------------- ▲▲▲

  const handleSelect = async () => {
    if (!selectedPet) return;
    setIsLoading(true);
    const finalName = nickname.trim() || PET_SELECTION_DATA[selectedPet].name;
    try {
      await selectInitialPet(selectedPet, finalName);
      alert(`${finalName}와(과) 함께하게 된 것을 축하합니다!`);
      navigate('/pet', { replace: true });
    } catch (error) {
      alert(`펫 선택 중 오류 발생: ${error.message}`);
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <Wrapper>
        <LoadingMessage>정보를 확인하는 중입니다...</LoadingMessage>
      </Wrapper>
    );
  }

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