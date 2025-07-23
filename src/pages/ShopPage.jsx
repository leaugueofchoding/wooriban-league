import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, buyAvatarPart } from '../api/firebase';

const ShopWrapper = styled.div`
  max-width: 1000px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2.5rem;
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1.5rem;
`;

const ItemCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: center;
`;

const getBackgroundPosition = (category) => {
  switch (category) {
    case 'bottom': return 'center 75%';
    case 'shoes': return 'center 100%';
    case 'hair': case 'top': case 'eyes': case 'nose': case 'mouth': return 'center 25%';
    default: return 'center 55%';
  }
};

const ItemImage = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: 200%;
  background-repeat: no-repeat;
  background-color: #e9ecef;
  transition: background-size 0.2s ease-in-out;
  background-position: ${props => getBackgroundPosition(props.$category)};
  &:hover {
    background-size: 220%;
  }
`;

const ItemPrice = styled.div`
  font-size: 1.1rem;
  font-weight: bold;
  color: #007bff;
`;

const BuyButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background-color: #28a745;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background-color: #218838;
  }
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
`;

const LoginPrompt = styled.div`
  text-align: center;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-top: 2rem;
  font-size: 1.1rem;
`;

function ShopPage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('all');

  const myPlayerData = useMemo(() => {
    return players.find(p => p.authUid === currentUser?.uid);
  }, [players, currentUser]);

  const partCategories = useMemo(() => {
    const categories = avatarParts.reduce((acc, part) => {
      if (part.price > 0) acc.add(part.category);
      return acc;
    }, new Set());
    return ['all', ...Array.from(categories).sort()];
  }, [avatarParts]);

  const itemsForSale = useMemo(() => {
    // 👇 [수정] '숨김(hidden)' 상태가 아닌 아이템만 필터링하도록 수정합니다.
    let items = avatarParts.filter(part => part.price > 0 && part.status !== 'hidden');

    if (activeTab !== 'all') {
      items = items.filter(part => part.category === activeTab);
    }
    return items;
  }, [avatarParts, activeTab]);


  const handleBuy = async (part) => {
    // 이중 안전장치: myPlayerData가 확실히 있을 때만 구매 로직 실행
    if (!myPlayerData) {
      alert('플레이어 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!window.confirm(`'${part.id}' 아이템을 ${part.price}P에 구매하시겠습니까?`)) return;
    try {
      const successMessage = await buyAvatarPart(myPlayerData.id, part);
      alert(successMessage);
      await fetchInitialData();
    } catch (error) {
      alert(`구매 실패: ${error}`);
    }
  };

  const myItems = myPlayerData?.ownedParts || [];
  const isAdmin = myPlayerData?.role === 'admin';

  return (
    <ShopWrapper>
      <Title>✨ 아이템 상점 ✨</Title>
      {!currentUser ? (
        <LoginPrompt>아이템을 구매하려면 로그인이 필요합니다.</LoginPrompt>
      ) : (
        <>
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>
            내 포인트: <strong>💰 {myPlayerData?.points === undefined ? '불러오는 중...' : `${myPlayerData.points} P`}</strong>
          </p>
          <TabContainer>
            {partCategories.map(category => (
              <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                {category === 'all' ? `전체` : category}
              </TabButton>
            ))}
          </TabContainer>
          <ItemGrid>
            {itemsForSale.map(part => {
              // 플레이어 데이터가 없거나, 관리자이거나, 이미 소유했다면 버튼 비활성화
              const isButtonDisabled = !myPlayerData || isAdmin || myItems.includes(part.id);

              let buttonText = '구매하기';
              if (!myPlayerData) buttonText = '정보 확인 중...';
              else if (isAdmin) buttonText = '관리자';
              else if (myItems.includes(part.id)) buttonText = '소유함';

              return (
                <ItemCard key={part.id}>
                  <ItemImage src={part.src} $category={part.category} />
                  <ItemPrice>💰 {part.price} P</ItemPrice>
                  <BuyButton onClick={() => handleBuy(part)} disabled={isButtonDisabled}>
                    {buttonText}
                  </BuyButton>
                </ItemCard>
              );
            })}
          </ItemGrid>
        </>
      )}
    </ShopWrapper>
  );
}

export default ShopPage;