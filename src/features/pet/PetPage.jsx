// src/features/pet/PetPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore } from '@/store/leagueStore';
import { auth } from '@/api/firebase';
import { useNavigate } from 'react-router-dom';
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA } from '@/features/pet/petData';
import { PET_ITEMS } from './petItems';
import confetti from 'canvas-confetti';
// '깨진 알' 이미지를 import 합니다. 실제 파일이 assets/items 폴더에 있어야 합니다.
import petEggCrackedImg from '@/assets/items/item_pet_egg_cracked.png';

// --- (Styled Components는 이전과 동일) ---
const PageWrapper = styled.div`
  max-width: 1100px;
  margin: 2rem auto;
  padding: 1rem;
`;
const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 2rem;
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;
const PetDashboard = styled.div`
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
  background-color: #f8f9fa;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;
const PetListPanel = styled.div`
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 70vh;
  overflow-y: auto;
`;
const PetListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid ${props => props.$isSelected ? '#007bff' : 'transparent'};
  background-color: ${props => props.$isSelected ? '#e7f5ff' : '#fff'};
  margin-bottom: 1rem;
  img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
  p { margin: 0; }
`;
const PetProfile = styled.div`
  display: flex; flex-direction: column; align-items: center; text-align: center;
`;
const PetImage = styled.img`
  width: 200px; height: 200px; border-radius: 50%; background-color: #e9ecef;
  margin-bottom: 1rem; border: 5px solid #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
`;
const PetNameContainer = styled.div`
  display: flex; align-items: center; gap: 0.5rem; min-height: 48px;
`;
const PetName = styled.h1` margin: 0; `;
const PetNameInput = styled.input`
  font-size: 2.2rem; font-weight: bold; border: none;
  border-bottom: 2px solid #ccc; background: transparent;
  text-align: center; width: 200px;
  &:focus { outline: none; border-bottom-color: #007bff; }
`;
const PetLevel = styled.h3` margin: 0 0 1rem 0; color: #6c757d; `;
const PetInfo = styled.div`
  width: 100%; display: flex; flex-direction: column; gap: 1rem;
`;
const StatBarContainer = styled.div`
  width: 100%; height: 25px; background-color: #e9ecef;
  border-radius: 12.5px; position: relative;
`;
const StatBar = styled.div`
  width: ${props => props.percent}%; height: 100%;
  background: ${props => props.barColor}; border-radius: 12.5px;
  transition: width 0.5s ease-in-out;
`;
const StatText = styled.span`
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); color: #343a40;
  font-weight: bold; font-size: 0.9rem; text-shadow: 0 0 2px white;
`;
const InfoCard = styled.div`
  padding: 1rem; background-color: #fff; border-radius: 8px;
  h4 { margin: 0 0 0.5rem 0; }
  p { margin: 0; font-size: 0.9rem; color: #495057; }
`;
const InventoryItem = styled.p`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  img { width: 20px; height: 20px; }
`;
const ButtonGroup = styled.div`
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1rem; margin-top: auto;
`;
const StyledButton = styled.button`
  padding: 0.8rem; font-size: 1rem; font-weight: bold;
  border: none; border-radius: 8px; cursor: pointer;
  transition: background-color 0.2s; color: white;
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;
const EvolveButton = styled(StyledButton)` background-color: #ffc107; color: #343a40; &:hover:not(:disabled) { background-color: #e0a800; } `;
const FeedButton = styled(StyledButton)` background-color: #e83e8c; &:hover:not(:disabled) { background-color: #c2185b; } `;
const PetCenterButton = styled(StyledButton)` background-color: #17a2b8; grid-column: 1 / -1; &:hover:not(:disabled) { background-color: #117a8b; } `;
const HeartExchangeButton = styled(StyledButton)` background-color: #fd7e14; grid-column: 1 / -1; &:hover:not(:disabled) { background-color: #e66a00; } `;
const shake = keyframes` 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); }`;
const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
`;
const ModalContent = styled.div`
  text-align: center; position: relative; color: white;
  img.egg { animation: ${props => props.$isShaking ? shake : 'none'} 0.5s infinite; }
  img.pet { max-width: 250px; }
`;

function PetPage() {
  const navigate = useNavigate();
  const { players, usePetItem, evolvePet, hatchPetEgg, setPartnerPet, updatePetName, convertLikesToExp } = useLeagueStore();
  const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isHatching, setIsHatching] = useState(false);
  const [hatchState, setHatchState] = useState({ step: 'start', hatchedPet: null });

  useEffect(() => {
    if (myPlayerData && (!myPlayerData.pets || myPlayerData.pets.length === 0)) {
      navigate('/pet/select');
    }
    if (myPlayerData && myPlayerData.pets && myPlayerData.pets.length > 0) {
      if (!selectedPetId || !myPlayerData.pets.some(p => p.id === selectedPetId)) {
        setSelectedPetId(myPlayerData.partnerPetId || myPlayerData.pets[0].id);
      }
    }
  }, [myPlayerData, selectedPetId, navigate]);

  const selectedPet = myPlayerData?.pets?.find(p => p.id === selectedPetId);

  useEffect(() => {
    if (selectedPet) {
      setNewName(selectedPet.name);
    }
  }, [selectedPet]);

  const handleSaveName = async () => {
    try {
      await updatePetName(newName, selectedPet.id);
      setIsEditingName(false);
    } catch (error) { alert(error.message); }
  };

  const handleUseItem = async (itemId) => {
    try {
      await usePetItem(itemId, selectedPet.id);
    } catch (error) { alert(error.message); }
  };

  const handleEvolve = async () => {
    if (!canEvolve) return;
    try {
      await evolvePet(selectedPet.id, 'evolution_stone');
      alert("펫이 진화했습니다!");
    } catch (error) { alert(error.message); }
  };

  const handleHatch = async () => {
    try {
      setIsHatching(true);
      setHatchState({ step: 'shaking', hatchedPet: null });

      setTimeout(async () => {
        const { hatchedPet } = await hatchPetEgg();
        setHatchState({ step: 'cracked', hatchedPet });
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
      }, 2000);
    } catch (error) {
      alert(error.message);
      setIsHatching(false);
    }
  };

  const handleHeartExchange = async () => {
    const { totalLikes } = myPlayerData;
    if (!totalLikes || totalLikes === 0) {
      alert("교환할 하트가 없습니다.");
      return;
    }
    try {
      await convertLikesToExp();
      alert(`하트 ${totalLikes}개를 경험치 ${totalLikes * 2}로 교환했습니다!`);
    } catch (error) {
      alert(error.message);
    }
  }

  if (!myPlayerData || !myPlayerData.pets || myPlayerData.pets.length === 0 || !selectedPet) {
    return <PageWrapper><h2>펫 정보를 불러오는 중...</h2></PageWrapper>;
  }

  const { petInventory, totalLikes, partnerPetId } = myPlayerData;
  const petSkill = PET_DATA[selectedPet.species]?.skill;

  const expPercent = (selectedPet.exp / selectedPet.maxExp) * 100;
  const hpPercent = (selectedPet.hp / selectedPet.maxHp) * 100;
  const isFainted = selectedPet.hp <= 0;
  const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
  const evolutionLevel = currentStage === 1 ? 10 : 20;
  const canEvolve = PET_DATA[selectedPet.species]?.evolution && (currentStage < 3) && (selectedPet.level >= evolutionLevel) && (petInventory?.evolution_stone > 0);

  return (
    <PageWrapper>
      <MainLayout>
        <PetDashboard>
          <PetProfile>
            <PetImage src={petImageMap[`${selectedPet.appearanceId}_idle`]} alt={selectedPet.name} $isFainted={isFainted} />
            <PetNameContainer>
              {isEditingName ? (<>
                <PetNameInput value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={10} />
                <button onClick={handleSaveName}>✔</button>
                <button onClick={() => { setIsEditingName(false); setNewName(selectedPet.name) }}>✖</button>
              </>) : (<>
                <PetName>{selectedPet.name}</PetName>
                <button onClick={() => setIsEditingName(true)}>✏️</button>
              </>)}
            </PetNameContainer>
            <PetLevel>Lv. {selectedPet.level} {PET_DATA[selectedPet.species].name}</PetLevel>
            {isFainted && <p style={{ color: 'red', fontWeight: 'bold' }}>전투 불능!</p>}
          </PetProfile>
          <PetInfo>
            <StatBarContainer><StatBar percent={hpPercent} barColor="linear-gradient(90deg, #90ee90, #28a745)" /><StatText>HP: {selectedPet.hp} / {selectedPet.maxHp}</StatText></StatBarContainer>
            <StatBarContainer><StatBar percent={selectedPet.sp / selectedPet.maxSp * 100} barColor="linear-gradient(90deg, #87cefa, #007bff)" /><StatText>SP: {selectedPet.sp} / {selectedPet.maxSp}</StatText></StatBarContainer>
            <StatBarContainer><StatBar percent={expPercent} barColor="linear-gradient(90deg, #ffc107, #ff9800)" /><StatText>EXP: {selectedPet.exp} / {selectedPet.maxExp}</StatText></StatBarContainer>
            {petSkill && (<InfoCard><h4>고유 스킬: {petSkill.name}</h4><p>{petSkill.description}</p></InfoCard>)}
            <InfoCard>
              <h4>인벤토리</h4>
              {Object.values(PET_ITEMS).map(item => (
                <InventoryItem key={item.id}><img src={item.icon} alt={item.name} />{item.name}: {petInventory?.[item.id] || 0}개</InventoryItem>
              ))}
            </InfoCard>
            <ButtonGroup>
              <EvolveButton onClick={handleEvolve} disabled={!canEvolve}>진화 ({petInventory?.evolution_stone || 0}개)</EvolveButton>
              <FeedButton onClick={() => handleUseItem('brain_snack')} disabled={isFainted}>간식 주기 ({petInventory?.brain_snack || 0}개)</FeedButton>
              <HeartExchangeButton onClick={handleHeartExchange} disabled={!totalLikes || totalLikes === 0}>❤️ {totalLikes || 0}개 경험치로 교환</HeartExchangeButton>
              <PetCenterButton onClick={() => navigate('/pet-center')}>🏥 펫 센터 (상점/치료소)</PetCenterButton>
            </ButtonGroup>
          </PetInfo>
        </PetDashboard>
        <PetListPanel>
          <h4>보유 펫 목록</h4>
          {myPlayerData.pets.map(pet => (
            <PetListItem key={pet.id} onClick={() => setSelectedPetId(pet.id)} $isSelected={pet.id === selectedPetId}>
              <img src={petImageMap[`${pet.appearanceId}_idle`]} alt={pet.name} />
              <div>
                <strong>{pet.name}</strong>
                <p>Lv.{pet.level} {pet.id === partnerPetId && '⭐'}</p>
              </div>
            </PetListItem>
          ))}
          <StyledButton onClick={() => setPartnerPet(selectedPetId)} disabled={selectedPetId === partnerPetId} style={{ width: '100%', marginTop: '1rem', backgroundColor: '#6f42c1' }}>
            파트너로 지정
          </StyledButton>
          <StyledButton onClick={handleHatch} disabled={!petInventory?.pet_egg} style={{ width: '100%', marginTop: '1rem', backgroundColor: '#20c997' }}>
            알 부화시키기 ({petInventory?.pet_egg || 0}개)
          </StyledButton>
        </PetListPanel>
      </MainLayout>
      {isHatching && (
        <ModalBackground>
          <ModalContent $isShaking={hatchState.step === 'shaking'}>
            {hatchState.step !== 'cracked' ? (<>
              <h2 style={{ color: 'white' }}>알이 부화하려고 합니다...</h2>
              <img src={PET_ITEMS.pet_egg.image} alt="펫 알" className="egg" style={{ width: '200px' }} />
            </>) : (
              <div>
                <h2 style={{ color: 'white' }}>와!</h2>
                <img src={petImageMap[`${hatchState.hatchedPet.appearanceId}_idle`]} alt="부화한 펫" className="pet" />
                <h3 style={{ color: 'white' }}>{hatchState.hatchedPet.name}이(가) 태어났습니다!</h3>
                <button onClick={() => setIsHatching(false)}>확인</button>
              </div>
            )}
          </ModalContent>
        </ModalBackground>
      )}
    </PageWrapper>
  );
}

export default PetPage;