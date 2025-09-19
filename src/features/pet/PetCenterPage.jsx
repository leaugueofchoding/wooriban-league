// src/features/pet/PetCenterPage.jsx

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '@/store/leagueStore';
import { auth } from '@/api/firebase';
import { useNavigate } from 'react-router-dom';
import { PET_ITEMS } from '@/features/pet/petItems';

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

function PetCenterPage() {
    const [activeTab, setActiveTab] = useState('shop');
    const { players, buyPetItem } = useLeagueStore();
    const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);
    const navigate = useNavigate();

    const handleBuyItem = async (item) => {
        if (myPlayerData.points < item.price) {
            alert("포인트가 부족합니다.");
            return;
        }
        if (window.confirm(`'${item.name}'을(를) ${item.price}P에 구매하시겠습니까?`)) {
            try {
                await buyPetItem(item);
                alert("구매를 완료했습니다!");
            } catch (error) {
                alert(`구매 실패: ${error.message}`);
            }
        }
    };

    return (
        <PageWrapper>
            <Title>🏥 펫 센터</Title>
            <TabContainer>
                <TabButton $active={activeTab === 'shop'} onClick={() => setActiveTab('shop')}>🛍️ 상점</TabButton>
                <TabButton $active={activeTab === 'clinic'} onClick={() => setActiveTab('clinic')}>💉 치료소</TabButton>
            </TabContainer>

            <ContentBox>
                {activeTab === 'shop' && (
                    <>
                        <h2>펫 아이템 상점</h2>
                        <p>현재 보유 포인트: 💰 {myPlayerData?.points.toLocaleString() || 0} P</p>
                        <ItemGrid>
                            {Object.values(PET_ITEMS).map(item => (
                                <ItemCard key={item.id}>
                                    <div>
                                        <ItemImage src={item.image} alt={item.name} />
                                        <ItemName>{item.name}</ItemName>
                                        <ItemDescription>{item.description}</ItemDescription>
                                    </div>
                                    <div>
                                        <ItemPrice>💰 {item.price.toLocaleString()} P</ItemPrice>
                                        <BuyButton onClick={() => handleBuyItem(item)} disabled={!myPlayerData || myPlayerData.points < item.price}>
                                            구매하기
                                        </BuyButton>
                                    </div>
                                </ItemCard>
                            ))}
                        </ItemGrid>
                    </>
                )}
                {activeTab === 'clinic' && (
                    <>
                        <h2>치료소</h2>
                        <p>이곳에서 전투 불능이 된 펫을 치료하거나 모든 펫의 HP/SP를 회복할 수 있습니다.</p>
                        <p style={{ fontWeight: 'bold', color: '#6c757d' }}>(다음 업데이트에 만나요!)</p>
                    </>
                )}
            </ContentBox>
            <button onClick={() => navigate(-1)} style={{ marginTop: '2rem' }}>돌아가기</button>
        </PageWrapper>
    );
}

export default PetCenterPage;