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
        case 'hair': case 'eyes': case 'nose': case 'mouth': return 'center 25%';
        case 'top':
        default: return 'center 55%';
    }
};

const ItemImage = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: 200%;
  background-repeat: no-repeat;
  background-color: #e9ecef;
  transition: background-size 0.2s ease-in-out;
  background-position: ${props => getBackgroundPosition(props.category)};
  &:hover {
    background-size: 220%;
  }
`;

const LoginPrompt = styled.div`
  text-align: center;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-top: 2rem;
  font-size: 1.1rem;
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

function ShopPage() {
    const { players, avatarParts, fetchInitialData } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [activeTab, setActiveTab] = useState('all');
    const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

    const partCategories = useMemo(() => {
        const categories = avatarParts.reduce((acc, part) => {
            if (part.price > 0) acc.add(part.category);
            return acc;
        }, new Set());
        return ['all', ...Array.from(categories).sort()];
    }, [avatarParts]);

    const itemsForSale = useMemo(() => {
        let items = avatarParts.filter(part => part.price > 0);
        if (activeTab !== 'all') {
            items = items.filter(part => part.category === activeTab);
        }
        return items;
    }, [avatarParts, activeTab]);

    const handleBuy = async (part) => { /* ... 이전과 동일 ... */ };
    const myItems = myPlayerData?.ownedParts || [];
    const isAdmin = myPlayerData?.role === 'admin'; // 관리자인지 확인


    // ▼▼▼▼▼ 로그인 상태에 따라 다른 UI를 보여주도록 수정 ▼▼▼▼▼
    return (
        <ShopWrapper>
            <Title>✨ 아이템 상점 ✨</Title>
            {!currentUser ? (
                <LoginPrompt>아이템을 구매하려면 로그인이 필요합니다.</LoginPrompt>
            ) : (
                <>
                    <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>
                        내 포인트: <strong>💰 {myPlayerData?.points || 0} P</strong>
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
                            // 관리자이거나, 이미 소유한 아이템인지 확인
                            const isOwnedOrAdmin = isAdmin || myItems.includes(part.id);
                            return (
                                <ItemCard key={part.id}>
                                    <ItemImage src={part.src} $category={part.category} />
                                    <ItemPrice>💰 {part.price} P</ItemPrice>
                                    <BuyButton onClick={() => handleBuy(part)} disabled={isOwnedOrAdmin}>
                                        {isOwnedOrAdmin ? '소유함' : '구매하기'}
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