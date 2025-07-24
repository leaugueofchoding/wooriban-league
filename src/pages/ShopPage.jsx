import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, buyMultipleAvatarParts } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';

// --- Styled Components ---
const ShopWrapper = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
`;
const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2.5rem;
`;
const ContentWrapper = styled.div`
  display: flex;
  gap: 2rem;
  align-items: flex-start;
`;
const ItemContainer = styled.div`
  flex: 3;
`;
const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  min-height: 450px;
`;
const PreviewPanel = styled.div`
  flex: 2;
  position: sticky;
  top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background-color: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;
const AvatarCanvas = styled.div`
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 1.5rem;
  position: relative;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
`;
const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
const ItemCard = styled.div`
  cursor: pointer;
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
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
  &.previewing {
    border-color: #007bff;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  }
  &:hover {
    transform: translateY(-5px);
  }
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
    case 'hair': case 'top': case 'eyes': case 'nose': case 'mouth': return 'center 5%';
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
  background-position: ${props => getBackgroundPosition(props.$category)};
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
  margin-top: auto;
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
  &:hover { background-color: #f1f3f5; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const ITEMS_PER_PAGE = 6;

function ShopPage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewConfig, setPreviewConfig] = useState(null);

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const myItems = useMemo(() => myPlayerData?.ownedParts || [], [myPlayerData]);

  useEffect(() => {
    if (myPlayerData?.avatarConfig) {
      setPreviewConfig(myPlayerData.avatarConfig);
    }
  }, [myPlayerData]);

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
      // 1. 숨김 상태 아니고, 가격이 0보다 커야 함
      if (part.status === 'hidden' || !(part.price > 0)) {
        return false;
      }
      // 2. 판매 요일 필터링
      if (part.saleDays && part.saleDays.length > 0) {
        return part.saleDays.includes(today);
      }
      return true;
    });

    // 3. 마지막으로 카테고리 탭 필터링
    if (activeTab !== 'all') {
      items = items.filter(part => part.category === activeTab);
    }
    return items;
  }, [avatarParts, activeTab]); // activeTab을 의존성 배열에 추가

  const totalPages = Math.ceil(itemsForSale.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return itemsForSale.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [itemsForSale, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const { newItemsToBuy, totalCost } = useMemo(() => {
    if (!previewConfig || !myItems) return { newItemsToBuy: [], totalCost: 0 };
    const newItems = [];
    const now = new Date();
    Object.values(previewConfig).forEach(partId => {
      if (partId && !myItems.includes(partId)) {
        const partInfo = avatarParts.find(p => p.id === partId);
        if (partInfo) {
          const isCurrentlyOnSale = partInfo.isSale && partInfo.saleStartDate?.toDate() < now && now < partInfo.saleEndDate?.toDate();
          const price = isCurrentlyOnSale ? partInfo.salePrice : partInfo.price;
          newItems.push({ ...partInfo, price });
        }
      }
    });
    const cost = newItems.reduce((sum, part) => sum + part.price, 0);
    return { newItemsToBuy: newItems, totalCost: cost };
  }, [previewConfig, myItems, avatarParts]);

  const handlePurchasePreview = async () => {
    if (newItemsToBuy.length === 0) return alert('새로 구매할 아이템이 없습니다.');
    if (myPlayerData.points < totalCost) return alert('포인트가 부족합니다.');
    const itemNames = newItemsToBuy.map(p => p.displayName || p.id).join(', ');
    if (window.confirm(`총 ${newItemsToBuy.length}개의 새 아이템(${itemNames})을 ${totalCost}P에 구매하시겠습니까?`)) {
      try {
        await buyMultipleAvatarParts(myPlayerData.id, newItemsToBuy);
        alert('구매를 완료했습니다!');
        await fetchInitialData();
      } catch (error) {
        alert(`구매 실패: ${error.message}`);
      }
    }
  };

  const handlePreview = (part) => {
    setPreviewConfig(prev => {
      if (prev[part.category] === part.id) {
        const newConfig = { ...prev };
        delete newConfig[part.category];
        return newConfig;
      }
      return { ...prev, [part.category]: part.id };
    });
  };

  const handleResetPreview = () => setPreviewConfig(myPlayerData.avatarConfig);

  const previewPartUrls = useMemo(() => {
    if (!previewConfig) return [];
    const partsByCategory = avatarParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];
    const urls = [];
    RENDER_ORDER.forEach(category => {
      const partId = previewConfig[category];
      if (partId) {
        const part = partsByCategory[category]?.find(p => p.id === partId);
        if (part) urls.push(part.src);
      }
    });
    return urls;
  }, [previewConfig, avatarParts]);

  const canAfford = myPlayerData && myPlayerData.points >= totalCost;

  return (
    <ShopWrapper>
      <Title>✨ 아이템 상점 ✨</Title>
      {!currentUser ? (<LoginPrompt>아이템을 구매하려면 로그인이 필요합니다.</LoginPrompt>) : (
        <>
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>
            내 포인트: <strong>💰 {myPlayerData?.points ?? '...'} P</strong>
          </p>
          <ContentWrapper>
            <ItemContainer>
              <TabContainer>
                {partCategories.map(category => (
                  <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                    {category === 'all' ? '전체' : category}
                  </TabButton>
                ))}
              </TabContainer>
              <ItemGrid>
                {paginatedItems.map(part => {
                  const isOwned = myItems.includes(part.id);
                  const isPreviewing = previewConfig && previewConfig[part.category] === part.id;
                  const now = new Date();
                  const isCurrentlyOnSale = part.isSale && part.saleStartDate?.toDate() < now && now < part.saleEndDate?.toDate();
                  const saleDaysText = part.saleDays && part.saleDays.length > 0 ? `[${part.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 한정` : null;

                  return (
                    <ItemCard key={part.id} onClick={() => handlePreview(part)} className={isPreviewing ? 'previewing' : ''}>
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
                      {isOwned && <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6c757d', marginTop: 'auto' }}>소유함</span>}
                    </ItemCard>
                  );
                })}
              </ItemGrid>
              <PaginationContainer>
                <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>이전</PageButton>
                {Array.from({ length: totalPages }, (_, i) => (
                  <PageButton key={i + 1} $isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </PageButton>
                ))}
                <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>다음</PageButton>
              </PaginationContainer>
            </ItemContainer>

            <PreviewPanel>
              <h3 style={{ textAlign: 'center', marginTop: 0 }}>아바타 미리보기</h3>
              <AvatarCanvas>
                <PartImage src={baseAvatar} alt="기본 아바타" />
                {previewPartUrls.map(src => <PartImage key={src} src={src} />)}
              </AvatarCanvas>
              <BuyButton onClick={handlePurchasePreview} disabled={newItemsToBuy.length === 0 || !canAfford}>
                {newItemsToBuy.length > 0 ? `새 아이템 ${newItemsToBuy.length}개 구매 (${totalCost}P)` : '구매할 새 아이템 없음'}
              </BuyButton>
              <button onClick={handleResetPreview} style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                전체 초기화
              </button>
            </PreviewPanel>
          </ContentWrapper>
        </>
      )}
    </ShopWrapper>
  );
}

export default ShopPage;