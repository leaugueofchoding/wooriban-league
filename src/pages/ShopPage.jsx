// src/pages/ShopPage.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, updatePlayerAvatar } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';
import { useNavigate } from 'react-router-dom';

// --- Styled Components ---
const ShopWrapper = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 1rem;
`;
const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2.5rem;
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;
const ContentWrapper = styled.div`
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  @media (max-width: 992px) {
    flex-direction: column;
  }
`;
const ItemContainer = styled.div`
  flex: 3;
  width: 100%;
`;
const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  min-height: 450px;
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
`;
const PreviewPanel = styled.div`
  flex: 2;
  position: sticky;
  top: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background-color: #f8f9fa;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  width: 100%;
  @media (max-width: 992px) {
    position: static;
  }
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
  @media (max-width: 768px) {
    width: 200px;
    height: 200px;
  }
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
    case 'eyes': case 'nose': case 'mouth': return 'center 25%';
    case 'hair': return 'center 0%';
    case 'top':
    default: return 'center 55%';
  }
};
const ItemImage = styled.div`
  width: 160px;
  height: 160px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: ${props => ['하우스', '배경', '바닥', '벽지', '가구', '소품', 'accessory'].includes(props.$category) ? 'contain' : '200%'};
  background-repeat: no-repeat;
  background-color: #e9ecef;
  background-position: ${props => getBackgroundPosition(props.$category)};
  transition: background-size 0.2s ease-in-out;

  &:hover {
    background-size: ${props => ['하우스', '배경', '바닥', '벽지', '가구', '소품', 'accessory'].includes(props.$category) ? 'contain' : '220%'};
  }

  @media (max-width: 768px) {
    width: 100px;
    height: 100px;
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
  margin-top: auto;
  transition: background-color 0.2s;
  &:hover { background-color: #218838; }
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;
const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
`;
const TabButton = styled.button`
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
  @media (max-width: 768px) {
    font-size: 0.9rem;
    padding: 0.6rem 0.8rem;
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
const ActionButtonGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
`;

const ActionButton = styled.button`
    width: 100%;
    padding: 0.75rem;
    border-radius: 8px;
    font-weight: bold;
    color: white;
    background-color: #6c757d;
    cursor: pointer;
    border: none;
    font-size: 1rem;
    transition: background-color 0.2s;
    &:hover { background-color: #5a6268; }
`;

const WearButton = styled(ActionButton)`
    background-color: #ffc107;
    color: black;
    &:hover {
        background-color: #e0a800;
    }
`;

const ExitButton = styled.button`
  display: block;
  margin: 4rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #5a6268;
  }
`;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const ITEMS_PER_PAGE = 6;

const translateCategory = (category) => {
  const categoryMap = {
    'all': '전체', 'hair': '헤어', 'top': '상의', 'bottom': '하의', 'shoes': '신발',
    'face': '얼굴', 'eyes': '눈', 'nose': '코', 'mouth': '입', 'accessory': '액세서리',
    '하우스': '하우스', '가구': '가구', '소품': '소품',
    '미니카페': '미니카페'
  };
  return categoryMap[category] || category;
};

function ShopPage() {
  const { players, avatarParts, myRoomItems, buyMyRoomItem, buyMultipleAvatarParts } = useLeagueStore();
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState('avatar');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewConfig, setPreviewConfig] = useState(null);
  const [justPurchased, setJustPurchased] = useState(false);
  const isInitialLoad = useRef(true);

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

  // ▼▼▼ [수정] useEffect 로직 변경 ▼▼▼
  useEffect(() => {
    if (myPlayerData?.avatarConfig && isInitialLoad.current) {
      setPreviewConfig(myPlayerData.avatarConfig);
      isInitialLoad.current = false;
    }
  }, [myPlayerData]);

  const myItems = useMemo(() => myPlayerData?.ownedParts || [], [myPlayerData]);

  const partCategories = useMemo(() => {
    if (mainTab === 'myroom') {
      return ['하우스', '가구', '소품', '미니카페'];
    }
    const today = new Date().getDay();
    const categories = avatarParts.reduce((acc, part) => {
      if (part.price > 0 && part.status !== 'hidden') {
        if (!part.saleDays || part.saleDays.length === 0 || part.saleDays.includes(today)) {
          acc.add(part.category);
        }
      }
      return acc;
    }, new Set());
    const sorted = Array.from(categories).sort((a, b) => {
      const order = ['hair', 'face', 'eyes', 'nose', 'mouth', 'top', 'bottom', 'shoes', 'accessory'];
      return order.indexOf(a) - order.indexOf(b);
    });
    return ['all', ...sorted];
  }, [avatarParts, mainTab]);

  const itemsForSale = useMemo(() => {
    const today = new Date().getDay();
    let items = [];

    if (mainTab === 'avatar') {
      items = avatarParts.filter(part => {
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
    } else {
      items = myRoomItems.filter(item => item.price > 0 && item.status !== 'hidden');
      if (activeTab && partCategories.includes(activeTab)) {
        items = items.filter(item => item.category === activeTab);
      }
    }
    return items;
  }, [avatarParts, myRoomItems, mainTab, activeTab, partCategories]);

  const totalPages = Math.ceil(itemsForSale.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return itemsForSale.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [itemsForSale, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setJustPurchased(false);
    if (mainTab === 'avatar') {
      setActiveTab('all');
    } else {
      setActiveTab('하우스');
    }
  }, [mainTab]);

  useEffect(() => {
    setCurrentPage(1);
    setJustPurchased(false);
  }, [activeTab]);

  const { newItemsToBuy, totalCost } = useMemo(() => {
    if (!previewConfig || !myItems) return { newItemsToBuy: [], totalCost: 0 };

    const newPartIds = new Set();
    const config = previewConfig || {};

    Object.values(config).forEach(value => {
      if (typeof value === 'string') newPartIds.add(value);
    });

    if (config.accessories) {
      Object.values(config.accessories).forEach(partId => newPartIds.add(partId));
    }

    const newItems = [];
    const now = new Date();

    newPartIds.forEach(partId => {
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
        await buyMultipleAvatarParts(newItemsToBuy);
        alert('구매를 완료했습니다!');
        setJustPurchased(true);
      } catch (error) {
        alert(`구매 실패: ${error.message}`);
      }
    }
  };

  const handlePreview = async (item) => {
    setJustPurchased(false);
    if (mainTab === 'myroom') {
      const isOwned = myPlayerData?.ownedMyRoomItems?.includes(item.id);
      if (isOwned) {
        alert("이미 소유하고 있는 아이템입니다.");
        return;
      }

      const now = new Date();
      const isCurrentlyOnSale = item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate();
      const finalPrice = isCurrentlyOnSale ? item.salePrice : item.price;

      if (myPlayerData.points < finalPrice) {
        alert("포인트가 부족합니다.");
        return;
      }

      if (window.confirm(`'${item.displayName || item.id}' 아이템을 ${finalPrice}P에 구매하시겠습니까?`)) {
        try {
          await buyMyRoomItem(item);
          alert('구매를 완료했습니다!');
        } catch (error) {
          alert(`구매 실패: ${error.message}`);
        }
      }
      return;
    }

    setPreviewConfig(prev => {
      const { category, id, slot } = item;
      const newConfig = JSON.parse(JSON.stringify(prev));

      if (category !== 'accessory') {
        if (prev[category] === id) {
          delete newConfig[category];
        } else {
          newConfig[category] = id;
        }
      } else {
        if (!newConfig.accessories) {
          newConfig.accessories = {};
        }
        const currentPartInSlot = newConfig.accessories[slot];
        if (currentPartInSlot === id) {
          delete newConfig.accessories[slot];
        } else {
          newConfig.accessories[slot] = id;
        }
      }
      return newConfig;
    });
  };

  const handleResetPreview = () => setPreviewConfig(myPlayerData.avatarConfig);

  const handleWearPurchased = async () => {
    if (!myPlayerData) return alert("선수 정보를 찾을 수 없습니다.");
    try {
      await updatePlayerAvatar(myPlayerData.id, previewConfig);
      alert("선택한 아바타가 저장되었습니다!");
      useLeagueStore.getState().fetchInitialData();
      navigate(`/profile/${myPlayerData.id}`);
    } catch (error) {
      console.error("아바타 저장 오류:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const previewPartUrls = useMemo(() => {
    if (!previewConfig) return [baseAvatar];

    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'mouth', 'nose', 'eyes'];
    const urls = [baseAvatar];
    const config = previewConfig;

    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) {
        const part = avatarParts.find(p => p.id === partId);
        if (part) urls.push(part.src);
      }
    });

    if (config.accessories) {
      Object.values(config.accessories).forEach(partId => {
        const part = avatarParts.find(p => p.id === partId);
        if (part) urls.push(part.src);
      });
    }

    return Array.from(new Set(urls));
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
          <TabContainer>
            <TabButton $active={mainTab === 'avatar'} onClick={() => setMainTab('avatar')}>아바타</TabButton>
            <TabButton $active={mainTab === 'myroom'} onClick={() => setMainTab('myroom')}>마이룸</TabButton>
          </TabContainer>
          <ContentWrapper>
            <ItemContainer>
              <TabContainer>
                {partCategories.map(category => (
                  <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                    {translateCategory(category)}
                  </TabButton>
                ))}
              </TabContainer>
              <ItemGrid>
                {paginatedItems.map(part => {
                  const isOwned = mainTab === 'avatar'
                    ? myPlayerData?.ownedParts?.includes(part.id)
                    : myPlayerData?.ownedMyRoomItems?.includes(part.id);

                  let isPreviewing = false;
                  if (previewConfig && mainTab === 'avatar') {
                    if (part.category !== 'accessory') {
                      isPreviewing = previewConfig[part.category] === part.id;
                    } else if (previewConfig.accessories) {
                      isPreviewing = previewConfig.accessories[part.slot] === part.id;
                    }
                  }

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

            {mainTab === 'avatar' && (
              <PreviewPanel>
                <h3 style={{ textAlign: 'center', marginTop: 0 }}>아바타 미리보기</h3>
                <AvatarCanvas>
                  {previewPartUrls.map(src => <PartImage key={src} src={src} />)}
                </AvatarCanvas>
                <BuyButton onClick={handlePurchasePreview} disabled={newItemsToBuy.length === 0 || !canAfford}>
                  {newItemsToBuy.length > 0 ? `새 아이템 ${newItemsToBuy.length}개 구매 (${totalCost}P)` : '구매할 새 아이템 없음'}
                </BuyButton>
                <ActionButton onClick={handleResetPreview}>
                  전체 초기화
                </ActionButton>
                <ActionButtonGroup>
                  {justPurchased && (
                    <WearButton onClick={handleWearPurchased}>
                      ✨ 구입한 옷 착용하기
                    </WearButton>
                  )}
                </ActionButtonGroup>
              </PreviewPanel>
            )}
          </ContentWrapper>
          <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
        </>
      )}
    </ShopWrapper>
  );
}

export default ShopPage;