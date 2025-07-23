import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, buyAvatarPart } from '../api/firebase';

// --- Styled Components ---
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
  min-height: 500px; /* 페이지 변경 시 레이아웃 깨짐 방지 */
`;

const ItemCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  text-align: center;
  overflow: hidden;
`;

const SaleBadge = styled.div`
  position: absolute;
  top: 10px;
  right: -25px;
  background-color: #dc3545;
  color: white;
  padding: 2px 25px;
  font-size: 0.9rem;
  font-weight: bold;
  transform: rotate(45deg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

const PriceContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 40px;
  justify-content: center;
  gap: 2px;
`;

const OriginalPrice = styled.span`
  font-size: 0.9rem;
  color: #6c757d;
  text-decoration: line-through;
`;

const FinalPrice = styled.span`
  font-size: 1.1rem;
  font-weight: bold;
  color: ${props => (props.$onSale ? '#dc3545' : '#007bff')};
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

const BuyButton = styled.button`
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background-color: #28a745;
  color: white;
  font-weight: bold;
  cursor: pointer;
  margin-top: auto; /* 카드가 길어져도 버튼을 항상 아래에 위치시킴 */
  transition: background-color 0.2s;
  &:hover { background-color: #218838; }
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
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

const ItemName = styled.h4`
  margin: 0;
  font-size: 1rem;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  height: 24px;
`;

const SaleDayInfo = styled.div`
  font-size: 0.8rem;
  font-weight: bold;
  color: #17a2b8;
  background-color: #e8f7fa;
  padding: 2px 8px;
  border-radius: 10px;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2.5rem;
`;

const PageButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: ${props => props.$isActive ? '#007bff' : 'white'};
  color: ${props => props.$isActive ? 'white' : 'black'};
  font-weight: bold;
  cursor: pointer;
  &:hover {
    background-color: #f1f3f5;
  }
  &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
  }
`;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const ITEMS_PER_PAGE = 8;

function ShopPage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const myPlayerData = useMemo(() => {
    return players.find(p => p.authUid === currentUser?.uid);
  }, [players, currentUser]);

  const partCategories = useMemo(() => {
    const today = new Date().getDay();
    const categories = avatarParts.reduce((acc, part) => {
      if (part.price > 0 && part.status !== 'hidden') {
        if (!part.saleDays || part.saleDays.length === 0 || part.saleDays.includes(today)) {
          acc.add(part.category);
        }
      }
      return acc;
    }, new Set());
    return ['all', ...Array.from(categories).sort()];
  }, [avatarParts]);

  const itemsForSale = useMemo(() => {
    const today = new Date().getDay();
    let items = avatarParts.filter(part => {
      if (part.status === 'hidden') return false;
      if (part.saleDays && part.saleDays.length > 0) {
        return part.saleDays.includes(today);
      }
      return true;
    });
    items = items.filter(part => part.price > 0);
    if (activeTab !== 'all') {
      items = items.filter(part => part.category === activeTab);
    }
    return items;
  }, [avatarParts, activeTab]);

  const totalPages = Math.ceil(itemsForSale.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return itemsForSale.slice(startIndex, endIndex);
  }, [itemsForSale, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleBuy = async (part) => {
    if (!myPlayerData) return alert('플레이어 정보를 불러오는 중입니다.');
    if (!window.confirm(`'${part.displayName || part.id}' 아이템을 구매하시겠습니까?`)) return;
    try {
      await buyAvatarPart(myPlayerData.id, part);
      alert('구매에 성공했습니다!');
      await fetchInitialData();
    } catch (error) {
      alert(`구매 실패: ${error.message}`);
    }
  };

  const myItems = myPlayerData?.ownedParts || [];

  return (
    <ShopWrapper>
      <Title>✨ 아이템 상점 ✨</Title>
      {!currentUser ? (
        <LoginPrompt>아이템을 구매하려면 로그인이 필요합니다.</LoginPrompt>
      ) : (
        <>
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>
            내 포인트: <strong>💰 {myPlayerData?.points === undefined ? '로딩 중...' : `${myPlayerData.points} P`}</strong>
          </p>
          <TabContainer>
            {partCategories.map(category => (
              <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                {category === 'all' ? '전체' : category}
              </TabButton>
            ))}
          </TabContainer>
          <ItemGrid>
            {paginatedItems.map(part => {
              const isButtonDisabled = !myPlayerData || myItems.includes(part.id);
              const buttonText = myItems.includes(part.id) ? '소유함' : '구매하기';
              const now = new Date();
              const isCurrentlyOnSale = part.isSale && part.saleStartDate?.toDate() < now && now < part.saleEndDate?.toDate();
              const saleDaysText = part.saleDays && part.saleDays.length > 0 ? `[${part.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 한정` : null;

              return (
                <ItemCard key={part.id}>
                  {isCurrentlyOnSale && <SaleBadge>SALE</SaleBadge>}
                  <ItemName>{part.displayName || part.id}</ItemName>
                  <ItemImage src={part.src} $category={part.category} />
                  {saleDaysText && <SaleDayInfo>{saleDaysText}</SaleDayInfo>}
                  <PriceContainer>
                    {isCurrentlyOnSale ? (
                      <>
                        <OriginalPrice>{part.originalPrice} P</OriginalPrice>
                        <FinalPrice $onSale={true}>💰 {part.salePrice} P</FinalPrice>
                      </>
                    ) : (
                      <FinalPrice $onSale={false}>💰 {part.price} P</FinalPrice>
                    )}
                  </PriceContainer>
                  <BuyButton onClick={() => handleBuy(part)} disabled={isButtonDisabled}>
                    {buttonText}
                  </BuyButton>
                </ItemCard>
              );
            })}
          </ItemGrid>
          <PaginationContainer>
            <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
              이전
            </PageButton>
            {Array.from({ length: totalPages }, (_, index) => (
              <PageButton
                key={index + 1}
                $isActive={currentPage === index + 1}
                onClick={() => setCurrentPage(index + 1)}
              >
                {index + 1}
              </PageButton>
            ))}
            <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
              다음
            </PageButton>
          </PaginationContainer>
        </>
      )}
    </ShopWrapper>
  );
}

export default ShopPage;