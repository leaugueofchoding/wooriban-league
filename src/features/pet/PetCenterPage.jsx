// src/features/pet/PetCenterPage.jsx

import React, { useState, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, releasePet } from '../../api/firebase';
import { useNavigate } from 'react-router-dom';
import { PET_ITEMS } from './petItems';
import { SKILLS } from './petData'; // 스킬 데이터를 불러옵니다.
import { petImageMap } from '../../utils/petImageMap';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---

const PageWrapper = styled.div`
  max-width: 1040px;
  margin: 0 auto;
  padding: 0.8rem 0.65rem 3.5rem;
  font-family: 'Pretendard', sans-serif;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  color: #1f2937;
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 0.65rem;
  animation: ${fadeIn} 0.5s ease-out;
`;

const Title = styled.h1`
  font-size: 1.6rem;
  font-weight: 1000;
  color: #1f2937;
  margin: 0;
  span { color: #20c997; }

  @media (max-width: 768px) {
    font-size: 1.42rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.45rem;
  margin-bottom: 0.7rem;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.46rem 0.95rem;
  font-size: 0.86rem;
  font-weight: 1000;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.$active ? css`
    background-color: #2f6fdb;
    color: white;
    box-shadow: 0 4px 12px rgba(47, 111, 219, 0.28);
    transform: translateY(-2px);
  ` : css`
    background-color: white;
    color: #667085;
    border: 1px solid #dee2e6;
    &:hover { background-color: #f1f3f5; }
  `}
`;

const ContentBox = styled.div`
  background:
    linear-gradient(90deg, rgba(47,111,219,0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,111,219,0.07) 1px, transparent 1px),
    #ffffff;
  background-size: 24px 24px;
  padding: 0.65rem;
  border-radius: 18px;
  border: 4px solid #2f6fdb;
  box-shadow: 0 14px 36px rgba(0,0,0,0.10);
  min-height: 0;
  animation: ${fadeIn} 0.3s ease-out;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 0.55rem;
  }
`;

// 상점 (Item) 관련 스타일
const ShopHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: -0.65rem -0.65rem 0.65rem;
  padding: 0.52rem 0.65rem;
  border-bottom: 3px solid #2f6fdb;
  background: #f1f3f5;
  flex-wrap: wrap;
  gap: 0.5rem;

  h2 { margin: 0; font-size: 1rem; color: #343a40; font-weight: 1000; }
  p { margin: 0; font-size: 0.88rem; font-weight: 900; color: #495057; }
  strong { color: #f08c00; font-size: 1rem; margin-left: 0.35rem; }
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 0.5rem;
  max-height: clamp(430px, calc(100dvh - 205px), 620px);
  overflow-y: auto;
  padding: 0.05rem 0.1rem 0.35rem;
  align-content: start;

  &::-webkit-scrollbar { width: 11px; }
  &::-webkit-scrollbar-track { background: #dbe4ff; border-left: 2px solid #2f6fdb; }
  &::-webkit-scrollbar-thumb { background: #748ffc; border: 2px solid #2f6fdb; border-radius: 999px; }

  @media (max-width: 520px) {
    grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
    max-height: none;
  }
`;

const ItemCard = styled.div`
  background: rgba(248,249,250,0.96);
  border: 2px solid #ced4da;
  border-radius: 12px;
  padding: 0.62rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 218px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.06);
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px rgba(0,0,0,0.10);
    border-color: #20c997;
    background: #e6fcf5;
  }
`;

const ItemImage = styled.img`
  width: 60px;
  height: 60px;
  margin: 0 auto 0.35rem;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgba(0,0,0,0.14));
`;

const ItemName = styled.h3`
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  font-weight: 1000;
  color: #343a40;
`;

const ItemDescription = styled.p`
  font-size: 0.72rem;
  color: #667085;
  flex-grow: 1;
  margin: 0 0 0.42rem;
  line-height: 1.32;
  font-weight: 750;
`;

const ItemPrice = styled.p`
  font-size: 0.92rem;
  font-weight: 1000;
  color: #1971c2;
  margin: 0.35rem 0;
`;

const QuantityControl = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
`;

const QuantityButton = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: white;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #495057;
  transition: all 0.2s;
  
  &:hover { background-color: #f1f3f5; color: #339af0; border-color: #339af0; }
  &:active { transform: scale(0.95); }
`;

const QuantityInput = styled.input`
  width: 50px;
  height: 32px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  &:focus { outline: none; border-color: #339af0; }
`;

const BuyButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  font-size: 0.78rem;
  font-weight: 1000;
  border: none;
  border-radius: 10px;
  background-color: #20c997;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 3px 0 #12b886;

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 0 #12b886; }
  &:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #adb5bd; cursor: not-allowed; box-shadow: none; transform: none; }
`;

// 치료소 (Heal/Pet) 관련 스타일
const ClinicHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
  margin: -0.65rem -0.65rem 0.65rem;
  padding: 0.52rem 0.65rem;
  border-bottom: 3px solid #2f6fdb;
  background: #f1f3f5;
  flex-wrap: wrap;

  h2 { margin: 0 0 0.15rem; color: #343a40; font-size: 1rem; font-weight: 1000; }
  p { color: #667085; margin: 0; font-size: 0.78rem; font-weight: 800; line-height: 1.35; }
`;

const HealAllButton = styled.button`
  width: 100%;
  display: block;
  margin: 0;
  padding: 0.62rem;
  font-size: 0.86rem;
  font-weight: 1000;
  color: white;
  background-color: #ff6b6b;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 3px 0 #fa5252;
  transition: all 0.2s;

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 0 #fa5252; }
  &:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #adb5bd; cursor: not-allowed; box-shadow: none; transform: none; }
`;

const PetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 0.5rem;
  max-height: clamp(430px, calc(100dvh - 250px), 620px);
  overflow-y: auto;
  padding: 0.05rem 0.1rem 0.35rem;
  align-content: start;

  &::-webkit-scrollbar { width: 11px; }
  &::-webkit-scrollbar-track { background: #dbe4ff; border-left: 2px solid #2f6fdb; }
  &::-webkit-scrollbar-thumb { background: #748ffc; border: 2px solid #2f6fdb; border-radius: 999px; }

  @media (max-width: 520px) {
    grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
    max-height: none;
  }
`;

const PetCard = styled.div`
  background-color: rgba(248,249,250,0.96);
  border: 2px solid #ced4da;
  border-radius: 12px;
  padding: 0.62rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 194px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.06);
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px rgba(0,0,0,0.10);
    border-color: #ff6b6b;
    background: #fff5f5;
  }
`;

const PetImage = styled.img`
  width: 60px;
  height: 60px;
  margin: 0 auto 0.35rem;
  object-fit: contain;
  filter: ${props => props.$isFainted ? "grayscale(100%)" : "drop-shadow(0 8px 10px rgba(0,0,0,0.14))"};
  transition: filter 0.3s;
`;

const PetName = styled.h3`
  margin: 0 0 0.25rem 0;
  color: #343a40;
  font-size: 0.95rem;
  font-weight: 1000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PetStatus = styled.div`
  font-size: 0.72rem;
  font-weight: 900;
  margin-bottom: 0.42rem;
  min-height: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;

  .hp { color: #20c997; }
  .sp { color: #339af0; }
  .fainted { color: #fa5252; font-size: 0.86rem; font-weight: 1000; }
`;

const HealButton = styled.button`
  padding: 0.5rem;
  font-size: 0.78rem;
  font-weight: 1000;
  border: none;
  border-radius: 10px;
  background-color: #339af0;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 3px 0 #228be6;

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 0 #228be6; }
  &:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #e9ecef; color: #adb5bd; cursor: not-allowed; box-shadow: none; transform: none; }
`;

// 스킬 관리 (Skill) 관련 스타일
const SkillCard = styled.div`
  background: ${props => props.$isEquipped ? '#e7f5ff' : 'white'};
  border: 2px solid ${props => props.$isEquipped ? '#339af0' : '#dee2e6'};
  border-radius: 12px;
  padding: 0.72rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &:hover {
    border-color: #339af0;
    transform: translateY(-2px);
  }

  .skill-name { font-weight: 800; color: #343a40; font-size: 1.1rem; }
  .cost { color: #868e96; font-size: 0.9rem; }
  .skill-desc { font-size: 0.85rem; color: #495057; flex-grow: 1; }
  .status { 
    font-size: 0.9rem; font-weight: 700; text-align: right;
    color: ${props => props.$isEquipped ? '#339af0' : '#adb5bd'};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.7rem;
  margin-top: 1.1rem;
`;

const ActionButton = styled.button`
  padding: 0.72rem 1.8rem;
  font-size: 0.92rem;
  font-weight: 900;
  color: ${props => props.$primary ? "white" : "#495057"};
  background: ${props => props.$primary ? "#339af0" : "#f1f3f5"};
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
    filter: brightness(0.95);
  }
`;

function PetCenterPage() {
  const [activeTab, setActiveTab] = useState('clinic');
  const [itemQuantities, setItemQuantities] = useState({});
  const { players, buyPetItem, healPet, healPetHp, healPetSp, healAllPets, healAllPetsHp, updatePetSkills } = useLeagueStore();
  const { classId } = useClassStore();
  const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);
  const navigate = useNavigate();

  // ▼▼▼ [수정] 분양 선택 모드 state
  const [releaseMode, setReleaseMode] = useState(false);
  const [selectedForRelease, setSelectedForRelease] = useState(null);

  const handleStartRelease = () => {
    setReleaseMode(true);
    setSelectedForRelease(null);
  };

  const handleCancelRelease = () => {
    setReleaseMode(false);
    setSelectedForRelease(null);
  };

  const handleConfirmRelease = async () => {
    if (!selectedForRelease) return alert('분양할 펫을 선택해주세요.');
    const petCount = myPlayerData?.pets?.length || 0;
    if (petCount <= 1) return alert('마지막 남은 펫은 분양할 수 없습니다. 🐾');
    if (!window.confirm(`정말로 [${selectedForRelease.name}]을(를) 분양하시겠습니까?\n분양 시 2,500P를 돌려받을 수 있습니다.\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      const result = await releasePet(classId, myPlayerData.id, selectedForRelease.id);
      alert(`${result.releasedPetName}이(가) 좋은 곳으로 떠났습니다. 🌈\n${result.reward.toLocaleString()}P를 돌려받았습니다!`);
      setReleaseMode(false);
      setSelectedForRelease(null);
    } catch (e) { alert('분양 실패: ' + e.message); }
  };
  // ▲▲▲ [수정 끝]

  const handleQuantityChange = (itemId, value) => {
    const quantity = Math.max(1, Number(value));
    setItemQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleBuyItem = async (item) => {
    const quantity = itemQuantities[item.id] || 1;
    const totalCost = item.price * quantity;

    if (myPlayerData.points < totalCost) return alert("포인트가 부족합니다.");

    if (window.confirm(`'${item.name}' ${quantity}개를 ${totalCost.toLocaleString()}P에 구매하시겠습니까?`)) {
      try {
        await buyPetItem(item, quantity);
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
  const isAllHpFull = useMemo(() => {
    if (!myPlayerData || !myPlayerData.pets) return true;
    return myPlayerData.pets.every(p => p.hp === p.maxHp);
  }, [myPlayerData]);

  const handleHealHp = async (petId) => {
    if (!window.confirm("HP를 회복하시겠습니까? (150P 소모)")) return;
    try { await healPetHp(petId); alert("HP 회복 완료!"); }
    catch (error) { alert(`치료 실패: ${error.message}`); }
  };
  const handleHealSp = async (petId) => {
    if (!window.confirm("SP를 회복하시겠습니까? (100P 소모)")) return;
    try { await healPetSp(petId); alert("SP 회복 완료!"); }
    catch (error) { alert(`치료 실패: ${error.message}`); }
  };
  const handleHealFull = async (petId) => {
    if (!window.confirm("HP+SP를 모두 회복하시겠습니까? (250P 소모)")) return;
    try { await healPet(petId); alert("HP+SP 회복 완료!"); }
    catch (error) { alert(`치료 실패: ${error.message}`); }
  };
  const handleHealAllHp = async () => {
    if (!window.confirm("모든 펫의 HP를 회복하시겠습니까? (350P 소모)")) return;
    try { await healAllPetsHp(); alert("모든 펫의 HP 회복 완료!"); }
    catch (error) { alert(`치료 실패: ${error.message}`); }
  };
  const handleHealAll = async () => {
    if (!window.confirm("모든 펫의 HP+SP를 모두 회복하시겠습니까? (600P 소모)")) return;
    try { await healAllPets(); alert("모든 펫의 HP+SP 회복 완료!"); }
    catch (error) { alert(`치료 실패: ${error.message}`); }
  };

  const handleToggleSkill = async (pet, skillId, isEquipped, maxSlots) => {
    let newEquipped = [...(pet.equippedSkills || [])];

    if (isEquipped) {
      newEquipped = newEquipped.filter(id => id !== skillId);
    } else {
      if (newEquipped.length >= maxSlots) {
        return alert(`현재 진화 단계에서는 스킬을 최대 ${maxSlots}개까지만 장착할 수 있습니다!`);
      }
      newEquipped.push(skillId);
    }

    try {
      await updatePetSkills(pet.id, newEquipped);
    } catch (e) {
      alert('스킬 장착/해제 실패: ' + e.message);
    }
  };

  if (!myPlayerData) return <PageWrapper><h2>플레이어 정보를 불러오는 중...</h2></PageWrapper>;

  return (
    <PageWrapper>
      <HeaderSection>
        <Title>🏥 <span>펫 센터</span></Title>
      </HeaderSection>

      <TabContainer>
        <TabButton $active={activeTab === 'clinic'} onClick={() => setActiveTab('clinic')}>💉 치료소</TabButton>
        <TabButton $active={activeTab === 'shop'} onClick={() => setActiveTab('shop')}>🛍️ 상점</TabButton>
        {/* [수정 이슈 8] 스킬 관리 탭 삭제 — 펫 페이지 내 스킬 관리와 중복 */}
      </TabContainer>

      <ContentBox>
        {activeTab === 'shop' && (
          <>
            <ShopHeader>
              <h2>아이템 상점</h2>
              <p>내 포인트: <strong>{myPlayerData?.points.toLocaleString() || 0} P</strong></p>
            </ShopHeader>
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
            <ClinicHeader>
              <div style={{ flex: 1 }}>
                <h2>펫 회복실</h2>
                <p>이곳에서 펫의 HP와 SP를 회복하거나 전투 불능 상태를 치료할 수 있습니다.</p>
              </div>
              {/* ▼▼▼ [수정] 분양 모드 버튼 — 치료 버튼과 완전 분리 ▼▼▼ */}
              {!releaseMode ? (
                (myPlayerData?.pets?.length || 0) > 1 && (
                  <button onClick={handleStartRelease} style={{
                    background: '#fa5252', color: 'white', border: 'none',
                    borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.85rem',
                    fontWeight: 800, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start',
                  }}>🏠 펫 분양하기</button>
                )
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start' }}>
                  <button onClick={handleConfirmRelease} disabled={!selectedForRelease} style={{
                    background: selectedForRelease ? '#fa5252' : '#adb5bd',
                    color: 'white', border: 'none', borderRadius: '10px',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800,
                    cursor: selectedForRelease ? 'pointer' : 'not-allowed',
                  }}>✅ 분양 확정</button>
                  <button onClick={handleCancelRelease} style={{
                    background: '#dee2e6', color: '#495057', border: 'none',
                    borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                  }}>✕ 취소</button>
                </div>
              )}
              {/* ▲▲▲ [수정 끝] ▲▲▲ */}
            </ClinicHeader>

            {releaseMode && (
              <div style={{ background: '#fff5f5', border: '1.5px solid #ffc9c9', borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '0.8rem', fontSize: '0.88rem', color: '#c92a2a', fontWeight: 700 }}>
                🏠 분양할 펫을 클릭하여 선택하세요. 선택 후 "분양 확정" 버튼을 눌러주세요.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
              <HealAllButton
                onClick={handleHealAllHp}
                disabled={isAllHpFull}
                style={{ flex: 1, background: isAllHpFull ? '#adb5bd' : '#f03e3e' }}
              >
                {isAllHpFull ? "모든 HP 가득 참 ✨" : "전체 HP 회복 (350P)"}
              </HealAllButton>
              <HealAllButton
                onClick={handleHealAll}
                disabled={isAllPetsHealthy}
                style={{ flex: 1, background: isAllPetsHealthy ? '#adb5bd' : '#7048e8' }}
              >
                {isAllPetsHealthy ? "모든 펫 건강함 ✨" : "전체 HP+SP (600P)"}
              </HealAllButton>
            </div>
            <PetGrid>
              {myPlayerData?.pets?.map(pet => {
                const isHealthy = pet.hp === pet.maxHp && pet.sp === pet.maxSp;
                const isFainted = pet.hp <= 0;
                const isSelectedForRelease = selectedForRelease?.id === pet.id;
                return (
                  <PetCard key={pet.id}
                    onClick={releaseMode ? () => setSelectedForRelease(pet) : undefined}
                    style={releaseMode ? {
                      cursor: 'pointer',
                      border: isSelectedForRelease ? '2.5px solid #fa5252' : '2px dashed #ffc9c9',
                      background: isSelectedForRelease ? '#fff5f5' : 'white',
                      transform: isSelectedForRelease ? 'scale(1.03)' : 'none',
                      transition: 'all 0.15s',
                    } : undefined}
                  >
                    <div>
                      <PetImage
                        src={petImageMap[`${pet.appearanceId}_idle`]}
                        alt={pet.name}
                        $isFainted={isFainted}
                      />
                      <PetName>{pet.name}</PetName>
                      <PetStatus>
                        {isFainted ? (
                          <span className="fainted">⚠️ 전투 불능</span>
                        ) : (
                          <>
                            <span className="hp">HP: {pet.hp}/{pet.maxHp}</span>
                            <span className="sp">SP: {pet.sp}/{pet.maxSp}</span>
                          </>
                        )}
                      </PetStatus>
                      {((pet.battleWins || 0) + (pet.battleLosses || 0)) > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#868e96', marginTop: '0.3rem', display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <span>🏆{pet.battleWins || 0}</span>
                          <span>💀{pet.battleLosses || 0}</span>
                        </div>
                      )}
                      {releaseMode && isSelectedForRelease && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#fa5252', fontWeight: 800, textAlign: 'center' }}>
                          선택됨 ✓
                        </div>
                      )}
                    </div>
                    {!releaseMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <HealButton
                            onClick={() => handleHealHp(pet.id)}
                            disabled={pet.hp === pet.maxHp}
                            style={{
                              flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.2rem',
                              background: pet.hp === pet.maxHp ? '#adb5bd' : '#f03e3e'
                            }}
                          >
                            {pet.hp === pet.maxHp ? "HP 최대" : "HP 회복 (150P)"}
                          </HealButton>
                          <HealButton
                            onClick={() => handleHealSp(pet.id)}
                            disabled={pet.sp === pet.maxSp}
                            style={{
                              flex: 1, fontSize: '0.75rem', padding: '0.35rem 0.2rem',
                              background: pet.sp === pet.maxSp ? '#adb5bd' : '#1971c2'
                            }}
                          >
                            {pet.sp === pet.maxSp ? "SP 최대" : "SP 회복 (100P)"}
                          </HealButton>
                        </div>
                        <HealButton
                          onClick={() => handleHealFull(pet.id)}
                          disabled={isHealthy}
                          style={{
                            fontSize: '0.75rem', padding: '0.35rem',
                            background: isHealthy ? '#adb5bd' : '#7048e8'
                          }}
                        >
                          {isHealthy ? "건강함 ✨" : "HP+SP 전체 (250P)"}
                        </HealButton>
                      </div>
                    )}
                  </PetCard>
                );
              })}
            </PetGrid>
          </>
        )}

      </ContentBox>

      <ButtonGroup>
        <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
        <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
      </ButtonGroup>
    </PageWrapper>
  );
}

export default PetCenterPage;