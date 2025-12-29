import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore, useClassStore } from '@/store/leagueStore';
import { auth, createBattleChallenge } from '@/api/firebase';
import { useNavigate } from 'react-router-dom';
import { petImageMap } from '@/utils/petImageMap';
import { PET_DATA, SKILLS } from '@/features/pet/petData';
import { PET_ITEMS } from './petItems';
import confetti from 'canvas-confetti';

// --- 스타일 정의 ---

const ExchangeContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  grid-column: 1 / -1;
`;

const ExchangeInput = styled.input`
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  text-align: center;
  font-size: 1rem;
`;

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
  display: flex;
  flex-direction: column;
`;

const PetListWrapper = styled.div`
    overflow-y: auto;
    max-height: 270px; 
    padding-right: 0.5rem; 
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
  width: ${props => props.$percent}%; height: 100%;
  background: ${props => props.$barColor}; border-radius: 12.5px;
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

// ★ StyledButton이 먼저 정의되어야 합니다 ★
const StyledButton = styled.button`
  padding: 0.8rem; font-size: 1rem; font-weight: bold;
  border: none; border-radius: 8px; cursor: pointer;
  transition: background-color 0.2s; color: white;
  &:disabled { background-color: #6c757d; cursor: not-allowed; }
`;

const EvolveButton = styled(StyledButton)` background-color: #ffc107; color: #343a40; &:hover:not(:disabled) { background-color: #e0a800; } `;
const FeedButton = styled(StyledButton)` background-color: #e83e8c; &:hover:not(:disabled) { background-color: #c2185b; } `;
const PetCenterButton = styled(StyledButton)` background-color: #17a2b8; grid-column: 1 / -1; &:hover:not(:disabled) { background-color: #117a8b; } `;

// --- 대전 관련 스타일 ---
const BattleRequestButton = styled(StyledButton)`
  background-color: #dc3545; 
  grid-column: 1 / -1; 
  box-shadow: 0 4px 0 #a71d2a;
  &:hover:not(:disabled) { background-color: #c82333; }
  &:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #a71d2a; }
`;

const OpponentList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 4px; }
`;

const OpponentItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #eee;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    border-color: #ff9999;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    margin-bottom: 0.8rem;
    width: 100%;
    
    img {
      width: 60px; height: 60px;
      border-radius: 50%;
      border: 3px solid #f8f9fa;
      object-fit: cover;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    strong { font-size: 1rem; color: #333; margin-top: 5px; display: block; word-break: keep-all;}
    span { font-size: 0.8rem; color: #888; background-color: #f1f3f5; padding: 2px 8px; border-radius: 10px; margin-top: 4px;}
  }
`;

const ChallengeButton = styled.button`
  width: 100%;
  background-color: #ff6b6b;
  color: white;
  border: none;
  padding: 8px 0;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 0 #fa5252;
  
  &:hover { background-color: #fa5252; }
  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #ccc; cursor: not-allowed; box-shadow: none; }
`;

const shake = keyframes` 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } `;
const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
`;
const ModalContent = styled.div`
  text-align: center; position: relative; color: white;
  min-width: 320px;
  
  &.white-modal {
    background-color: #fff;
    color: #333;
    padding: 20px;
    border-radius: 15px;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  h3 { margin-top: 0; }
  img.egg { animation: ${props => props.$isShaking ? shake : 'none'} 0.5s infinite; }
  img.pet { max-width: 250px; }
`;

const AccordionContainer = styled.div`
  width: 100%;
  margin-top: 1rem;
`;
const AccordionButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;
const AccordionButton = styled(StyledButton)`
  background-color: ${props => props.$isActive ? '#0056b3' : '#007bff'};
  flex: 1;
  padding: 0.6rem;
  font-size: 0.9rem;
`;
const AccordionContent = styled.div`
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #dee2e6;
  margin-top: 0.5rem;
`;
const SkillGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
`;
const SkillSlot = styled.div`
  border: 2px dashed ${props => props.$isSelected ? '#dc3545' : '#ccc'};
  border-radius: 8px;
  padding: 0.5rem;
  background-color: ${props => props.$isSignature ? '#fff3cd' : '#f8f9fa'};
  cursor: ${props => props.$isSignature ? 'not-allowed' : 'pointer'};
  p { font-weight: bold; margin: 0 0 0.25rem 0; }
  small { font-size: 0.8rem; color: #6c757d; }
`;
const SkillList = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
  h5 { margin: 0 0 0.5rem 0; }
`;
const NotebookButton = styled(StyledButton)`
  background-color: #6f42c1;
  width: 100%;
  &:hover:not(:disabled) { background-color: #5a32a3; }
`;
const StatGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  text-align: left;
`;
const StatItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  p:first-child { color: #6c757d; margin: 0; }
  p:last-child { font-weight: bold; font-size: 1.2rem; margin: 0; }
`;

function PetPage() {
  const navigate = useNavigate();
  const { players, usePetItem, evolvePet, hatchPetEgg, setPartnerPet, updatePetName, convertLikesToExp, updatePetSkills } = useLeagueStore();
  const { classId } = useClassStore();

  const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

  const [selectedPetId, setSelectedPetId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isHatching, setIsHatching] = useState(false);
  const [hatchState, setHatchState] = useState({ step: 'start', hatchedPet: null });
  const [exchangeAmount, setExchangeAmount] = useState(1);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [equippedSkills, setEquippedSkills] = useState([]);
  const [selectedSkillSlot, setSelectedSkillSlot] = useState(null);

  // --- 대전 관련 State ---
  const [isOpponentModalOpen, setIsOpponentModalOpen] = useState(false);

  useEffect(() => {
    if (myPlayerData && !myPlayerData.pet && (!myPlayerData.pets || myPlayerData.pets.length === 0)) {
      navigate('/pet/select');
      return;
    }
    if (myPlayerData && myPlayerData.pets && myPlayerData.pets.length > 0) {
      const hasSelectedPet = myPlayerData.pets.some(p => p.id === selectedPetId);
      if (!hasSelectedPet) {
        setSelectedPetId(myPlayerData.partnerPetId || myPlayerData.pets[0].id);
      }
    }
  }, [myPlayerData, selectedPetId, navigate]);

  const selectedPet = myPlayerData?.pets?.find(p => p.id === selectedPetId);

  useEffect(() => {
    if (selectedPet) {
      setNewName(selectedPet.name);
      setEquippedSkills(selectedPet.equippedSkills || PET_DATA[selectedPet.species].initialSkills);
      setSelectedSkillSlot(null);
    }
  }, [selectedPet]);

  const opponents = useMemo(() => {
    if (!players || !auth.currentUser) return [];
    return players.filter(p =>
      p.authUid !== auth.currentUser.uid &&
      p.pets && p.pets.length > 0
    );
  }, [players]);

  // ▼▼▼ [교체] 이름 저장 함수 (배열 전체 업데이트 방식) ▼▼▼
  const handleSaveName = async () => {
    const filteredName = filterProfanity(newName);

    if (filteredName.includes('*')) {
      alert("부적절한 단어가 포함되어 있어 사용할 수 없습니다.");
      return;
    }

    try {
      // 1. 기존 펫 목록 복사
      const updatedPets = [...myPlayerData.pets];

      // 2. 현재 선택된 펫 찾아서 이름 변경
      const petIndex = updatedPets.findIndex(p => p.id === selectedPet.id);
      if (petIndex !== -1) {
        updatedPets[petIndex] = { ...updatedPets[petIndex], name: filteredName };

        // 3. 펫 배열 전체를 덮어쓰기 (Firestore 배열 수정 제약 해결)
        await updatePlayerProfile(classId, myPlayerData.id, { pets: updatedPets });

        // 4. 상태 업데이트
        setIsEditingName(false);
        setNewName(filteredName);
        alert(`이름이 '${filteredName}'(으)로 변경되었습니다!`);
      }
    } catch (error) {
      console.error("이름 변경 실패:", error);
      alert("이름 저장 중 오류가 발생했습니다.");
    }
  };

  const handleUseItem = async (itemId) => {
    try {
      await usePetItem(itemId, selectedPet.id);
      if (itemId === 'secret_notebook') {
        alert("펫이 새로운 스킬을 배웠습니다! 스킬 관리에서 확인해보세요.");
      }
    } catch (error) { alert(error.message); }
  };

  const handleEvolve = async () => {
    const evolutionStone = myPlayerData?.petInventory?.evolution_stone || 0;
    if (!canEvolve(evolutionStone)) return;
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
    const amount = Number(exchangeAmount);
    if (!amount || amount <= 0) {
      return alert("교환할 하트 수량을 올바르게 입력해주세요.");
    }
    if (myPlayerData.totalLikes < amount) {
      return alert("보유한 하트가 부족합니다.");
    }
    if (!selectedPet) {
      return alert("경험치를 받을 펫을 선택해주세요.");
    }
    try {
      const { expGained } = await convertLikesToExp(amount, selectedPet.id);
      alert(`하트 ${amount}개를 경험치 ${expGained}로 교환했습니다!`);
      setExchangeAmount(1);
    } catch (error) {
      alert(error.message);
    }
  }

  const canEvolve = (evolutionStoneCount) => {
    if (!selectedPet) return false;
    const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    const evolutionLevel = currentStage === 1 ? 10 : 20;
    return (
      PET_DATA[selectedPet.species]?.evolution &&
      currentStage < 3 &&
      selectedPet.level >= evolutionLevel &&
      evolutionStoneCount > 0
    );
  };

  const handleSkillSlotClick = (index) => {
    const signatureSkillId = PET_DATA[selectedPet.species].skill.id;
    if (equippedSkills[index] === signatureSkillId) {
      alert("고유 스킬은 교체할 수 없습니다.");
      return;
    }
    setSelectedSkillSlot(index);
  };

  const handleLearnedSkillClick = (skillId) => {
    if (selectedSkillSlot === null) return;
    if (equippedSkills.includes(skillId)) {
      alert("이미 장착된 스킬입니다.");
      return;
    }
    const newEquippedSkills = [...equippedSkills];
    newEquippedSkills[selectedSkillSlot] = skillId;
    setEquippedSkills(newEquippedSkills);
    setSelectedSkillSlot(null);
  };

  const handleSaveSkills = async () => {
    try {
      await updatePetSkills(selectedPet.id, equippedSkills);
      alert("스킬 장착이 완료되었습니다.");
      setActiveAccordion(null);
    } catch (error) {
      alert(`스킬 저장 실패: ${error.message}`);
    }
  };

  const handleOpenOpponentModal = () => {
    if (selectedPet.hp <= 0) {
      alert("기절한 펫은 대전을 신청할 수 없습니다. 먼저 치료해주세요!");
      return;
    }
    setIsOpponentModalOpen(true);
  };

  const handleBattleRequest = async (opponent) => {
    if (!classId || !myPlayerData || !opponent) {
      alert("데이터가 로딩되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    try {
      await createBattleChallenge(classId, myPlayerData, opponent);
      navigate(`/battle/${opponent.id}`);
    } catch (error) {
      console.error("대전 신청 실패:", error);
      alert(`대결 신청 실패: ${error.message}`);
    }
  };

  if (!myPlayerData || !myPlayerData.pets || myPlayerData.pets.length === 0 || !selectedPet) {
    return <PageWrapper><h2>펫 정보를 불러오는 중...</h2></PageWrapper>;
  }

  const { petInventory, totalLikes, partnerPetId } = myPlayerData;
  const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
  const skillSlotsCount = currentStage + 1;
  const learnedSkills = selectedPet.skills || PET_DATA[selectedPet.species].initialSkills;
  const unequippedSkills = learnedSkills.filter(id => !(equippedSkills || []).includes(id));

  const hpPercent = Math.min(100, Math.max(0, (selectedPet.hp / selectedPet.maxHp) * 100));
  const spPercent = Math.min(100, Math.max(0, (selectedPet.sp / selectedPet.maxSp) * 100));
  const expPercent = (selectedPet.exp / selectedPet.maxExp) * 100;

  const isFainted = selectedPet.hp <= 0;
  const evolutionStoneCount = petInventory?.evolution_stone || 0;
  const isEvolvable = canEvolve(evolutionStoneCount);
  const signatureSkillId = PET_DATA[selectedPet.species].skill.id;
  const secretNotebookCount = petInventory?.secret_notebook || 0;

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

            <AccordionContainer>
              <AccordionButtonRow>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'stats' ? null : 'stats')} $isActive={activeAccordion === 'stats'}>
                  상세 정보
                </AccordionButton>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'skills' ? null : 'skills')} $isActive={activeAccordion === 'skills'}>
                  스킬 관리
                </AccordionButton>
              </AccordionButtonRow>

              {activeAccordion && (
                <AccordionContent $isOpen={true}>
                  {activeAccordion === 'stats' && (
                    <StatGrid>
                      <InfoCard style={{ padding: '0.5rem 1rem', marginBottom: '1rem', border: 'none', background: 'transparent' }}>
                        <p>{PET_DATA[selectedPet.species].description}</p>
                      </InfoCard>
                      <StatItem>
                        <p>공격력</p>
                        <p>{selectedPet.atk || 0}</p>
                      </StatItem>
                    </StatGrid>
                  )}
                  {activeAccordion === 'skills' && (
                    <>
                      <SkillGrid>
                        {Array.from({ length: skillSlotsCount }).map((_, index) => {
                          const skillId = equippedSkills[index];
                          const skill = skillId ? SKILLS[skillId.toUpperCase()] : null;
                          return (
                            <SkillSlot key={index} $isSignature={skill?.id === signatureSkillId} $isSelected={selectedSkillSlot === index} onClick={() => handleSkillSlotClick(index)}>
                              {skill ? (<><p>{skill.name}</p><small>SP {skill.cost}</small></>) : <p>비어있음</p>}
                            </SkillSlot>
                          );
                        })}
                      </SkillGrid>
                      <SkillList>
                        <NotebookButton onClick={() => handleUseItem('secret_notebook')} disabled={secretNotebookCount <= 0}>
                          비법 노트 사용 ({secretNotebookCount}개)
                        </NotebookButton>
                        <h5 style={{ marginTop: '1rem' }}>보유 스킬 (클릭하여 교체)</h5>
                        <SkillGrid>
                          {unequippedSkills.map(skillId => {
                            const skill = SKILLS[skillId.toUpperCase()];

                            // [수정] 스킬 정보가 없으면 렌더링하지 않고 넘어감 (에러 방지)
                            if (!skill) return null;

                            return (
                              <SkillSlot key={skillId} onClick={() => handleLearnedSkillClick(skillId)}>
                                <p>{skill.name}</p><small>SP {skill.cost}</small>
                              </SkillSlot>
                            );
                          })}
                        </SkillGrid>
                      </SkillList>
                      <StyledButton onClick={handleSaveSkills} style={{ backgroundColor: '#28a745', width: '100%', marginTop: '1rem' }}>
                        스킬 저장
                      </StyledButton>
                    </>
                  )}
                </AccordionContent>
              )}
            </AccordionContainer>
          </PetProfile>
          <PetInfo>
            <StatBarContainer><StatBar $percent={hpPercent} $barColor="linear-gradient(90deg, #90ee90, #28a745)" /><StatText>HP: {selectedPet.hp} / {selectedPet.maxHp}</StatText></StatBarContainer>
            <StatBarContainer><StatBar $percent={spPercent} $barColor="linear-gradient(90deg, #87cefa, #007bff)" /><StatText>SP: {selectedPet.sp} / {selectedPet.maxSp}</StatText></StatBarContainer>
            <StatBarContainer><StatBar $percent={expPercent} $barColor="linear-gradient(90deg, #ffc107, #ff9800)" /><StatText>EXP: {selectedPet.exp} / {selectedPet.maxExp}</StatText></StatBarContainer>

            <InfoCard>
              <h4>인벤토리</h4>
              {Object.values(PET_ITEMS).map(item => (
                <InventoryItem key={item.id}><img src={item.icon} alt={item.name} />{item.name}: {petInventory?.[item.id] || 0}개</InventoryItem>
              ))}
            </InfoCard>
            <ButtonGroup>
              <EvolveButton onClick={handleEvolve} disabled={!isEvolvable}>진화 ({evolutionStoneCount}개)</EvolveButton>
              <FeedButton onClick={() => handleUseItem('brain_snack')} disabled={isFainted}>간식 주기 ({petInventory?.brain_snack || 0}개)</FeedButton>
              <ExchangeContainer>
                <ExchangeInput
                  type="number"
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(e.target.value)}
                  min="1"
                  max={totalLikes || 1}
                />
                <StyledButton
                  onClick={handleHeartExchange}
                  disabled={!totalLikes || totalLikes < Number(exchangeAmount) || Number(exchangeAmount) <= 0}
                  style={{ backgroundColor: '#fd7e14', width: '200px' }}
                >
                  ♥ 교환
                </StyledButton>
              </ExchangeContainer>
              <PetCenterButton onClick={() => navigate('/pet-center')}>🏥 펫 센터 (상점/치료소)</PetCenterButton>

              <BattleRequestButton onClick={handleOpenOpponentModal} disabled={isFainted}>
                ⚔️ 대결 신청 (친구 목록)
              </BattleRequestButton>

            </ButtonGroup>
          </PetInfo>
        </PetDashboard>
        <PetListPanel>
          <h4>보유 펫 목록</h4>
          <PetListWrapper>
            {myPlayerData.pets.map(pet => (
              <PetListItem key={pet.id} onClick={() => setSelectedPetId(pet.id)} $isSelected={pet.id === selectedPetId}>
                <img src={petImageMap[`${pet.appearanceId}_idle`]} alt={pet.name} />
                <div>
                  <strong>{pet.name}</strong>
                  <p>Lv.{pet.level} {pet.id === partnerPetId && '⭐'}</p>
                </div>
              </PetListItem>
            ))}
          </PetListWrapper>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <StyledButton onClick={() => setPartnerPet(selectedPetId)} disabled={selectedPetId === partnerPetId} style={{ width: '100%', backgroundColor: '#6f42c1' }}>
              파트너로 지정
            </StyledButton>
            <StyledButton onClick={handleHatch} disabled={!petInventory?.pet_egg} style={{ width: '100%', marginTop: '1rem', backgroundColor: '#20c997' }}>
              알 부화시키기 ({petInventory?.pet_egg || 0}개)
            </StyledButton>
          </div>
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

      {/* 대결 상대 선택 모달 (친구 목록) */}
      {isOpponentModalOpen && (
        <ModalBackground onClick={() => setIsOpponentModalOpen(false)}>
          <ModalContent className="white-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>⚔️ 대결 상대 선택</h3>
              <button onClick={() => setIsOpponentModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            </div>

            <OpponentList>
              {opponents.length === 0 ? (
                <p style={{ color: '#888', padding: '2rem 0', gridColumn: '1 / -1' }}>대결 가능한 친구가 없습니다.<br />(펫을 보유한 친구만 표시됩니다)</p>
              ) : (
                opponents.map(opp => {
                  const oppPet = opp.pets.find(p => p.id === opp.partnerPetId) || opp.pets[0];
                  return (
                    <OpponentItem key={opp.authUid}>
                      <div className="user-info">
                        <img src={petImageMap[`${oppPet.appearanceId}_idle`]} alt={oppPet.name} />
                        <div>
                          <strong>{opp.name}</strong>
                          <span>{oppPet.name} (Lv.{oppPet.level})</span>
                        </div>
                      </div>
                      <ChallengeButton onClick={() => handleBattleRequest(opp)}>
                        신청하기
                      </ChallengeButton>
                    </OpponentItem>
                  );
                })
              )}
            </OpponentList>
          </ModalContent>
        </ModalBackground>
      )}

    </PageWrapper>
  );
}

export default PetPage;