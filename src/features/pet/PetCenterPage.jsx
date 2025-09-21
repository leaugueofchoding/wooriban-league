// src/features/pet/PetCenterPage.jsx

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '@/store/leagueStore';
import { auth } from '@/api/firebase';
import { useNavigate } from 'react-router-dom';
import { PET_ITEMS } from '@/features/pet/petItems';
import { petImageMap } from '@/utils/petImageMap';

const PageWrapper = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
`;

const TabButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  background-color: ${props => props.$active ? '#17a2b8' : '#f8f9fa'};
  color: ${props => props.$active ? 'white' : '#343a40'};
  border-radius: 8px;
  cursor: pointer;
  margin: 0 0.5rem;
`;

const ContentBox = styled.div`
  padding: 2rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  min-height: 400px;
`;

// 상점 (Item) 관련 스타일
const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
`;

const ItemCard = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const ItemImage = styled.img`
    width: 100px;
    height: 100px;
    margin: 0 auto 1rem;
    object-fit: contain;
`;

const ItemName = styled.h3`
  margin: 0 0 0.5rem 0;
`;

const ItemDescription = styled.p`
  font-size: 0.9rem;
  color: #6c757d;
  flex-grow: 1;
`;

const ItemPrice = styled.p`
  font-size: 1.2rem;
  font-weight: bold;
  color: #007bff;
  margin: 1rem 0;
`;

const BuyButton = styled.button`
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  background-color: #28a745;
  color: white;
  cursor: pointer;
  &:hover { background-color: #218838; }
  &:disabled { background-color: #6c757d; }
`;

// ▼▼▼ [신규] 수량 조절 UI 스타일 ▼▼▼
const QuantityControl = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin: 1rem 0;
`;

const QuantityButton = styled.button`
    width: 30px;
    height: 30px;
    border: 1px solid #ccc;
    border-radius: 50%;
    background-color: #f0f0f0;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
`;

const QuantityInput = styled.input`
    width: 50px;
    text-align: center;
    font-size: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
`;

// 치료소 (Heal/Pet) 관련 스타일
const HealAllButton = styled.button`
    width: 100%;
    padding: 1rem;
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    background-color: #e83e8c;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 2rem;

    &:hover:not(:disabled) { background-color: #c2185b; }
    &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;

const PetGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5rem;
`;

const PetCard = styled.div`
    background-color: #fff;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
`;

const PetImage = styled.img`
    width: 100px;
    height: 100px;
    margin: 0 auto 1rem;
    object-fit: contain;
    filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
`;

const PetName = styled.h3`
  margin: 0 0 0.5rem 0;
`;

const PetStatus = styled.p`
    font-size: 0.9rem;
    color: ${props => props.$isHealthy ? '#28a745' : '#dc3545'};
    font-weight: bold;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: pre-wrap;
`;

const HealButton = styled.button`
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  background-color: #17a2b8;
  color: white;
  cursor: pointer;
  &:hover:not(:disabled) { background-color: #117a8b; }
  &:disabled { background-color: #6c757d; }
`;

function PetCenterPage() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [itemQuantities, setItemQuantities] = useState({}); // 아이템 수량 state 추가
  const { players, buyPetItem, healPet, healAllPets } = useLeagueStore();
  const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);
  const navigate = useNavigate();

  const handleQuantityChange = (itemId, value) => {
    const quantity = Math.max(1, Number(value));
    setItemQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleBuyItem = async (item) => {
    const quantity = itemQuantities[item.id] || 1;
    const totalCost = item.price * quantity;

    if (myPlayerData.points < totalCost) {
      alert("포인트가 부족합니다.");
      return;
    }
    if (window.confirm(`'${item.name}' ${quantity}개를 ${totalCost.toLocaleString()}P에 구매하시겠습니까?`)) {
      try {
        await buyPetItem(item, quantity); // quantity 인자 전달
        alert("구매를 완료했습니다!");
      } catch (error) {
        alert(`구매 실패: ${error.message}`);
      }
    }
  };

  const isAllPetsHealthy = useMemo(() => {
    if (!myPlayerData || !myPlayerData.pets) return true;
    return myPlayerData.pets.every(p => p.hp === p.maxHp && p.sp === p.maxSp);
  }, [myPlayerData]);

  const handleHeal = async (petId) => {
    if (!window.confirm("선택한 펫을 치료하시겠습니까? (500P 소모)")) return;
    try {
      await healPet(petId);
      alert("치료가 완료되었습니다!");
    } catch (error) {
      alert(`치료 실패: ${error.message}`);
    }
  };

  const handleHealAll = async () => {
    if (!window.confirm("모든 펫을 치료하시겠습니까? (800P 소모)")) return;
    try {
      await healAllPets();
      alert("모든 펫의 치료가 완료되었습니다!");
    } catch (error) {
      alert(`치료 실패: ${error.message}`);
    }
  };

  if (!myPlayerData) {
    return <PageWrapper><h2>플레이어 정보를 불러오는 중...</h2></PageWrapper>;
  }

  return (
    <PageWrapper>
      <Title>🏥 펫 센터</Title>
      <TabContainer>
        <TabButton $active={activeTab === 'clinic'} onClick={() => setActiveTab('clinic')}>💉 치료소</TabButton>
        <TabButton $active={activeTab === 'shop'} onClick={() => setActiveTab('shop')}>🛍️ 상점</TabButton>
      </TabContainer>

      <ContentBox>
        {activeTab === 'shop' && (
          <>
            <h2>펫 아이템 상점</h2>
            <p>현재 보유 포인트: 💰 {myPlayerData?.points.toLocaleString() || 0} P</p>
            <ItemGrid>
              {Object.values(PET_ITEMS).map(item => {
                const quantity = itemQuantities[item.id] || 1;
                const totalCost = item.price * quantity;
                return (
                  <ItemCard key={item.id}>
                    <div>
                      <ItemImage src={item.image} alt={item.name} />
                      <ItemName>{item.name}</ItemName>
                      <ItemDescription>{item.description}</ItemDescription>
                    </div>
                    <div>
                      <ItemPrice>💰 {item.price.toLocaleString()} P</ItemPrice>
                      <QuantityControl>
                        <QuantityButton onClick={() => handleQuantityChange(item.id, quantity - 1)}>-</QuantityButton>
                        <QuantityInput
                          type="number"
                          value={quantity}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          min="1"
                        />
                        <QuantityButton onClick={() => handleQuantityChange(item.id, quantity + 1)}>+</QuantityButton>
                      </QuantityControl>
                      <BuyButton onClick={() => handleBuyItem(item)} disabled={!myPlayerData || myPlayerData.points < totalCost}>
                        {quantity}개 구매 ({totalCost.toLocaleString()}P)
                      </BuyButton>
                    </div>
                  </ItemCard>
                )
              })}
            </ItemGrid>
          </>
        )}
        {activeTab === 'clinic' && (
          <>
            <h2>펫 치료소</h2>
            <p>이곳에서 펫의 HP와 SP를 회복하거나 전투 불능 상태를 치료할 수 있습니다.</p>
            <HealAllButton onClick={handleHealAll} disabled={isAllPetsHealthy}>
              {isAllPetsHealthy ? "모든 펫이 건강합니다." : "모든 펫 치료하기 (800P)"}
            </HealAllButton>
            <PetGrid>
              {myPlayerData?.pets?.map(pet => {
                const isHealthy = pet.hp === pet.maxHp && pet.sp === pet.maxSp;
                return (
                  <PetCard key={pet.id}>
                    <div>
                      <PetImage
                        src={petImageMap[`${pet.appearanceId}_idle`]}
                        alt={pet.name}
                        $isFainted={pet.hp <= 0}
                      />
                      <PetName>{pet.name}</PetName>
                      <PetStatus $isHealthy={isHealthy}>
                        {pet.hp <= 0 ? "전투 불능" : `HP: ${pet.hp}/${pet.maxHp}\nSP: ${pet.sp}/${pet.maxSp}`}
                      </PetStatus>
                    </div>
                    <HealButton onClick={() => handleHeal(pet.id)} disabled={isHealthy}>
                      {isHealthy ? "이 펫은 건강합니다." : "치료하기 (500P)"}
                    </HealButton>
                  </PetCard>
                );
              })}
            </PetGrid>
          </>
        )}
      </ContentBox>
      <button onClick={() => navigate(-1)} style={{ marginTop: '2rem' }}>돌아가기</button>
    </PageWrapper>
  );
}

export default PetCenterPage;