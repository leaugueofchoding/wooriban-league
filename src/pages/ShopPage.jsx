import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, buyAvatarPart } from '../api/firebase';
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
  grid-template-columns: repeat(3, 1fr); /* 3열 고정 그리드 */
  gap: 1.5rem;
  min-height: 450px; /* 페이지 변경 시 레이아웃 흔들림 방지 */
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
  
  /* 미리보기 중인 아이템에 테두리 표시 */
  &.previewing {
    border-color: #007bff;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  }

  &:hover {
    transform: translateY(-5px);
  }
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

const FinalPrice = styled.span`
  font-size: 1.1rem;
  font-weight: bold;
  color: #007bff;
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

const ITEMS_PER_PAGE = 6; // 3x2 그리드에 맞춰 6개로 수정

function ShopPage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewConfig, setPreviewConfig] = useState(null);

  const myPlayerData = useMemo(() => {
    return players.find(p => p.authUid === currentUser?.uid);
  }, [players, currentUser]);

  useEffect(() => {
    if (myPlayerData?.avatarConfig) {
      setPreviewConfig(myPlayerData.avatarConfig);
    }
  }, [myPlayerData]);

  const partCategories = useMemo(() => {
    const categories = avatarParts.reduce((acc, part) => {
      if (part.price > 0 && part.status !== 'hidden') acc.add(part.category);
      return acc;
    }, new Set());
    return ['all', ...Array.from(categories).sort()];
  }, [avatarParts]);

  const itemsForSale = useMemo(() => {
    let items = avatarParts.filter(part => part.price > 0 && part.status !== 'hidden');
    if (activeTab !== 'all') {
      items = items.filter(part => part.category === activeTab);
    }
    return items;
  }, [avatarParts, activeTab]);

  const totalPages = Math.ceil(itemsForSale.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return itemsForSale.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [itemsForSale, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const handleBuy = async (part) => {
    if (!myPlayerData) return alert('플레이어 정보를 불러오는 중입니다.');
    if (!window.confirm(`'${part.displayName || part.id}' 아이템을 ${part.price}P에 구매하시겠습니까?`)) return;
    try {
      await buyAvatarPart(myPlayerData.id, part);
      alert('구매에 성공했습니다!');
      await fetchInitialData();
    } catch (error) {
      alert(`구매 실패: ${error.message}`);
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

  const handleResetPreview = () => {
    setPreviewConfig(myPlayerData.avatarConfig);
  };

  const previewPartUrls = useMemo(() => {
    if (!previewConfig || !avatarParts.length) return [];
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

  return (
    <ShopWrapper>
      <Title>✨ 아이템 상점 ✨</Title>
      {!currentUser ? (
        <LoginPrompt>아이템을 구매하려면 로그인이 필요합니다.</LoginPrompt>
      ) : (
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
                  const isOwned = myPlayerData?.ownedParts?.includes(part.id);
                  const isPreviewing = previewConfig && previewConfig[part.category] === part.id;
                  return (
                    <ItemCard key={part.id} onClick={() => handlePreview(part)} className={isPreviewing ? 'previewing' : ''}>
                      <ItemName>{part.displayName || part.id}</ItemName>
                      <ItemImage src={part.src} $category={part.category} />
                      <FinalPrice>💰 {part.price} P</FinalPrice>
                      {isOwned && <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#6c757d' }}>소유함</span>}
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
              <BuyButton onClick={() => alert('현재 미리보기 중인 아이템들로 구매하는 기능은 다음 단계에서 구현됩니다!')}>
                이 모습으로 구매하기
              </BuyButton>
              <button
                onClick={handleResetPreview}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
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