// src/pages/ShopPage.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, updatePlayerAvatar } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';
import { useNavigate } from 'react-router-dom';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---
const ShopWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem 6rem 1rem;
  font-family: 'Pretendard', sans-serif;
  min-height: 100vh;
  background-color: #f8f9fa;
`;

const HeaderSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
  animation: ${fadeIn} 0.5s ease-out;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 900;
  color: #343a40;
  margin-bottom: 0.5rem;
  
  span { color: #339af0; }
`;

const PointsBadge = styled.div`
  background: white;
  padding: 0.8rem 1.5rem;
  border-radius: 30px;
  font-size: 1.2rem;
  font-weight: 800;
  color: #495057;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid #e9ecef;

  strong { color: #fcc419; font-size: 1.4rem; }
`;

const MainTabContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const MainTabButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1.1rem;
  font-weight: 800;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$active ? css`
    background-color: #339af0;
    color: white;
    box-shadow: 0 4px 12px rgba(51, 154, 240, 0.3);
    transform: translateY(-2px);
  ` : css`
    background-color: white;
    color: #868e96;
    border: 1px solid #dee2e6;
    &:hover { background-color: #f1f3f5; }
  `}
`;

const ContentLayout = styled.div`
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  
  @media (max-width: 992px) {
    flex-direction: column-reverse;
  }
`;

const ItemSection = styled.div`
  flex: 3;
  width: 100%;
`;

const CategoryScroll = styled.div`
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0.2rem 1rem 0.2rem;
  margin-bottom: 1rem;
  
  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 3px; }
`;

const CategoryButton = styled.button`
  flex-shrink: 0;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  border: 1px solid ${props => props.$active ? '#339af0' : '#dee2e6'};
  background: ${props => props.$active ? '#e7f5ff' : 'white'};
  color: ${props => props.$active ? '#1864ab' : '#495057'};
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$active ? '#d0ebff' : '#f8f9fa'};
  }
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  min-height: 400px;
`;

const ItemCard = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1rem;
  position: relative;
  border: 2px solid ${props => props.$isPreviewing ? '#339af0' : 'transparent'};
  box-shadow: ${props => props.$isPreviewing ? '0 0 0 4px rgba(51, 154, 240, 0.1)' : '0 2px 8px rgba(0,0,0,0.05)'};
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
  }

  ${props => props.$isOwned && css`
    opacity: 0.7;
    background: #f8f9fa;
  `}
`;

const SaleBadge = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  background: #fa5252;
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 4px 8px;
  border-bottom-right-radius: 12px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
`;

const OwnedBadge = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  background: #868e96;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-bottom-left-radius: 12px;
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
  width: 120px;
  height: 120px;
  border-radius: 12px;
  background-color: #f1f3f5;
  background-image: url(${props => props.src});
  background-size: ${props => ['하우스', '배경', '바닥', '벽지', '가구', '소품', 'accessory'].includes(props.$category) ? 'contain' : '200%'};
  background-repeat: no-repeat;
  background-position: ${props => getBackgroundPosition(props.$category)};
  margin-bottom: 0.8rem;
  transition: background-size 0.2s;

  ${ItemCard}:hover & {
    background-size: ${props => ['하우스', '배경', '바닥', '벽지', '가구', '소품', 'accessory'].includes(props.$category) ? 'contain' : '220%'};
  }
`;

const ItemName = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #343a40;
  margin-bottom: 0.3rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
`;

const PriceTag = styled.div`
  font-size: 1rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 4px;
  
  ${props => props.$sale ? css`color: #fa5252;` : css`color: #339af0;`}
  
  .original {
    text-decoration: line-through;
    color: #adb5bd;
    font-size: 0.8rem;
    font-weight: 500;
  }
`;

// 피팅룸 (우측 패널)
const FittingRoom = styled.div`
  flex: 1.2;
  min-width: 300px;
  background: white;
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  position: sticky;
  top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  @media (max-width: 992px) {
    position: static;
    width: 100%;
  }
`;

const FittingTitle = styled.h3`
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  color: #343a40;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AvatarPreview = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: #f8f9fa;
  border: 4px solid #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
  margin-bottom: 1.5rem;
`;

const PartLayer = styled.img`
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: contain;
`;

const CartSummary = styled.div`
  width: 100%;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const CartList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 150px;
  overflow-y: auto;
  
  li {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #495057;
    padding: 4px 0;
    border-bottom: 1px dashed #dee2e6;
    
    &:last-child { border-bottom: none; }
    span.price { font-weight: 700; color: #339af0; }
  }
`;

const TotalPrice = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  font-weight: 800;
  color: #343a40;
  border-top: 2px solid #dee2e6;
  padding-top: 0.8rem;
  
  span.cost { color: #fa5252; font-size: 1.3rem; }
`;

const ActionButton = styled.button`
  width: 100%;
  padding: 1rem;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.1s;
  margin-bottom: 0.5rem;
  
  ${props => props.$primary ? css`
    background: #20c997;
    color: white;
    box-shadow: 0 4px 0 #12b886;
    &:hover { transform: translateY(-2px); }
    &:active { transform: translateY(2px); box-shadow: none; }
  ` : css`
    background: #f1f3f5;
    color: #495057;
    &:hover { background: #e9ecef; }
  `}

  &:disabled {
    background: #adb5bd;
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 2rem;
  
  button {
    width: 32px; height: 32px;
    border-radius: 8px;
    border: 1px solid #dee2e6;
    background: white;
    font-weight: 700;
    cursor: pointer;
    
    &.active { background: #339af0; color: white; border-color: #339af0; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
`;

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const ITEMS_PER_PAGE = 8; // 그리드에 맞춰 조정

const translateCategory = (category) => {
  const categoryMap = {
    'all': '전체', 'hair': '헤어', 'top': '상의', 'bottom': '하의', 'shoes': '신발',
    'face': '얼굴', 'eyes': '눈', 'nose': '코', 'mouth': '입', 'accessory': '액세서리',
    '하우스': '하우스', '가구': '가구', '가전': '가전', '소품': '소품', '배경': '배경'
  };
  return categoryMap[category] || category;
};

function ShopPage() {
  const { classId } = useClassStore();
  const { players, avatarParts, myRoomItems, buyMyRoomItem, buyMultipleAvatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  const [mainTab, setMainTab] = useState('avatar');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewConfig, setPreviewConfig] = useState(null);
  const [justPurchased, setJustPurchased] = useState(false);
  const isInitialLoad = useRef(true);

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

  useEffect(() => {
    if (myPlayerData?.avatarConfig && isInitialLoad.current) {
      setPreviewConfig(myPlayerData.avatarConfig);
      isInitialLoad.current = false;
    }
  }, [myPlayerData]);

  const myItems = useMemo(() => myPlayerData?.ownedParts || [], [myPlayerData]);

  const partCategories = useMemo(() => {
    if (mainTab === 'myroom') return ['하우스', '배경', '가구', '가전', '소품'];
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
        if (part.saleDays && part.saleDays.length > 0) return part.saleDays.includes(today);
        return true;
      }).filter(part => part.price > 0);

      if (activeTab !== 'all') items = items.filter(part => part.category === activeTab);
    } else {
      items = myRoomItems.filter(item => item.price > 0 && item.status !== 'hidden');
      if (activeTab) items = items.filter(item => item.category === activeTab);
    }
    return items;
  }, [avatarParts, myRoomItems, mainTab, activeTab]);

  const totalPages = Math.ceil(itemsForSale.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return itemsForSale.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [itemsForSale, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setJustPurchased(false);
    if (mainTab === 'avatar') setActiveTab('all');
    else setActiveTab('하우스');
  }, [mainTab]);

  const { newItemsToBuy, totalCost } = useMemo(() => {
    if (!previewConfig || !myItems) return { newItemsToBuy: [], totalCost: 0 };
    const newPartIds = new Set();
    const config = previewConfig || {};
    Object.values(config).forEach(value => { if (typeof value === 'string') newPartIds.add(value); });
    if (config.accessories) Object.values(config.accessories).forEach(partId => newPartIds.add(partId));

    const newItems = [];
    const now = new Date();
    newPartIds.forEach(partId => {
      if (partId && !myItems.includes(partId)) {
        const partInfo = avatarParts.find(p => p.id === partId);
        if (partInfo) {
          const isSale = partInfo.isSale && partInfo.saleStartDate?.toDate() < now && now < partInfo.saleEndDate?.toDate();
          newItems.push({ ...partInfo, price: isSale ? partInfo.salePrice : partInfo.price });
        }
      }
    });
    return { newItemsToBuy: newItems, totalCost: newItems.reduce((sum, part) => sum + part.price, 0) };
  }, [previewConfig, myItems, avatarParts]);

  const previewPartUrls = useMemo(() => {
    if (!previewConfig) return [baseAvatar];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];
    RENDER_ORDER.forEach(cat => {
      const pid = previewConfig[cat];
      if (pid) {
        const part = avatarParts.find(p => p.id === pid);
        if (part) urls.push(part.src);
      }
    });
    if (previewConfig.accessories) {
      Object.values(previewConfig.accessories).forEach(pid => {
        const part = avatarParts.find(p => p.id === pid);
        if (part) urls.push(part.src);
      });
    }
    return Array.from(new Set(urls));
  }, [previewConfig, avatarParts]);

  const handlePreview = (item) => {
    if (mainTab === 'myroom') {
      handleMyRoomItemClick(item);
      return;
    }
    setJustPurchased(false);
    setPreviewConfig(prev => {
      const newConfig = JSON.parse(JSON.stringify(prev));
      const { category, id, slot } = item;
      if (category !== 'accessory') {
        newConfig[category] = newConfig[category] === id ? undefined : id;
      } else {
        if (!newConfig.accessories) newConfig.accessories = {};
        newConfig.accessories[slot] = newConfig.accessories[slot] === id ? undefined : id;
      }
      return newConfig;
    });
  };

  const handleMyRoomItemClick = async (item) => {
    const isOwned = myPlayerData?.ownedMyRoomItems?.includes(item.id);
    if (isOwned) return alert("이미 소유하고 있는 아이템입니다.");

    const now = new Date();
    const isSale = item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate();
    const price = isSale ? item.salePrice : item.price;

    if (myPlayerData.points < price) return alert("포인트가 부족합니다.");
    if (window.confirm(`'${item.displayName || item.id}'을(를) ${price}P에 구매하시겠습니까?`)) {
      try {
        await buyMyRoomItem(item);
        alert('구매 완료!');
        await fetchInitialData();
      } catch (e) { alert(e.message); }
    }
  };

  const handlePurchase = async () => {
    if (newItemsToBuy.length === 0) return alert('구매할 새 아이템이 없습니다.');
    if (myPlayerData.points < totalCost) return alert('포인트가 부족합니다.');
    if (window.confirm(`총 ${totalCost}P를 사용하여 ${newItemsToBuy.length}개의 아이템을 구매하시겠습니까?`)) {
      try {
        await buyMultipleAvatarParts(newItemsToBuy);
        alert('구매 완료!');
        setJustPurchased(true);
        await fetchInitialData();
      } catch (e) { alert(e.message); }
    }
  };

  const handleWear = async () => {
    if (!classId || !myPlayerData) return;
    try {
      await updatePlayerAvatar(classId, myPlayerData.id, previewConfig);
      alert('아바타가 저장되었습니다!');
      navigate(`/profile/${myPlayerData.id}`);
    } catch (e) { alert(e.message); }
  };

  const handleReset = () => setPreviewConfig(myPlayerData.avatarConfig);

  return (
    <ShopWrapper>
      <HeaderSection>
        <Title>🛍️ <span>아이템 상점</span></Title>
        <PointsBadge>
          <span>내 포인트:</span>
          <strong>{myPlayerData?.points?.toLocaleString() ?? 0} P</strong>
        </PointsBadge>
      </HeaderSection>

      <MainTabContainer>
        <MainTabButton $active={mainTab === 'avatar'} onClick={() => setMainTab('avatar')}>👗 아바타 꾸미기</MainTabButton>
        <MainTabButton $active={mainTab === 'myroom'} onClick={() => setMainTab('myroom')}>🏠 마이룸 꾸미기</MainTabButton>
      </MainTabContainer>

      <ContentLayout>
        <ItemSection>
          <CategoryScroll>
            {partCategories.map(cat => (
              <CategoryButton key={cat} $active={activeTab === cat} onClick={() => setActiveTab(cat)}>
                {translateCategory(cat)}
              </CategoryButton>
            ))}
          </CategoryScroll>

          <ItemGrid>
            {paginatedItems.map(item => {
              const isOwned = mainTab === 'avatar'
                ? myPlayerData?.ownedParts?.includes(item.id)
                : myPlayerData?.ownedMyRoomItems?.includes(item.id);

              let isPreviewing = false;
              if (mainTab === 'avatar' && previewConfig) {
                if (item.category !== 'accessory') isPreviewing = previewConfig[item.category] === item.id;
                else isPreviewing = previewConfig.accessories?.[item.slot] === item.id;
              }

              const now = new Date();
              const isSale = item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate();

              return (
                <ItemCard key={item.id} $isPreviewing={isPreviewing} $isOwned={isOwned} onClick={() => handlePreview(item)}>
                  {isSale && <SaleBadge>SALE</SaleBadge>}
                  {isOwned && <OwnedBadge>보유중</OwnedBadge>}
                  <ItemName>{item.displayName || item.id}</ItemName>
                  <ItemImage src={item.src} $category={item.category} />
                  <PriceTag $sale={isSale}>
                    {isSale && <span className="original">{item.originalPrice}P</span>}
                    <span>{isSale ? item.salePrice : item.price} P</span>
                  </PriceTag>
                </ItemCard>
              );
            })}
          </ItemGrid>

          {totalPages > 1 && (
            <Pagination>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>&lt;</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} className={currentPage === i + 1 ? 'active' : ''} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>&gt;</button>
            </Pagination>
          )}
        </ItemSection>

        {mainTab === 'avatar' && (
          <FittingRoom>
            <FittingTitle>👕 피팅룸</FittingTitle>
            <AvatarPreview>
              {previewPartUrls.map(src => <PartLayer key={src} src={src} />)}
            </AvatarPreview>

            {newItemsToBuy.length > 0 && (
              <CartSummary>
                <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: '#343a40' }}>구매 예정 목록 ({newItemsToBuy.length})</div>
                <CartList>
                  {newItemsToBuy.map(item => (
                    <li key={item.id}>
                      <span>{item.displayName || item.id}</span>
                      <span className="price">{item.price} P</span>
                    </li>
                  ))}
                </CartList>
                <TotalPrice>
                  <span>총 합계</span>
                  <span className="cost">{totalCost.toLocaleString()} P</span>
                </TotalPrice>
              </CartSummary>
            )}

            <ActionButton $primary onClick={handlePurchase} disabled={newItemsToBuy.length === 0}>
              {newItemsToBuy.length > 0 ? '구매하기' : '선택된 새 아이템 없음'}
            </ActionButton>

            {justPurchased ? (
              <ActionButton onClick={handleWear} style={{ background: '#ffc107', color: 'black' }}>✨ 바로 착용하고 저장</ActionButton>
            ) : (
              <ActionButton onClick={handleReset}>초기화</ActionButton>
            )}
            <ActionButton onClick={() => navigate(-1)}>나가기</ActionButton>
          </FittingRoom>
        )}
      </ContentLayout>
    </ShopWrapper>
  );
}

export default ShopPage;