// src/features/pet/PetPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, db, createBattleChallenge } from '../../api/firebase';
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { petImageMap } from '../../utils/petImageMap';
import { PET_DATA, SKILLS } from './petData';
import { PET_ITEMS } from './petItems';
import confetti from 'canvas-confetti';
import { filterProfanity } from '../../utils/profanityFilter';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes` 
  0% { transform: translate(1px, 1px) rotate(0deg); } 
  10% { transform: translate(-1px, -2px) rotate(-1deg); } 
  20% { transform: translate(-3px, 0px) rotate(1deg); } 
  30% { transform: translate(3px, 2px) rotate(0deg); } 
  40% { transform: translate(1px, -1px) rotate(1deg); } 
  50% { transform: translate(-1px, 2px) rotate(-1deg); } 
  60% { transform: translate(-3px, 1px) rotate(0deg); } 
  70% { transform: translate(3px, 1px) rotate(-1deg); } 
  80% { transform: translate(-1px, -1px) rotate(1deg); } 
  90% { transform: translate(1px, 2px) rotate(0deg); } 
  100% { transform: translate(1px, -2px) rotate(-1deg); } 
`;

// --- Styled Components ---

const PageWrapper = styled.div`
  max-width: 1100px;
  margin: 2rem auto;
  padding: 1rem;
  font-family: 'Pretendard', sans-serif;
  animation: ${fadeIn} 0.5s ease-out;
  padding-bottom: 6rem;
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 2rem;
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const PetDashboard = styled.div`
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  background-color: white;
  padding: 2.5rem;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }
`;

const PetListPanel = styled.div`
  background-color: white;
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  height: fit-content;
  
  h4 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #343a40;
    font-weight: 800;
  }
`;

const PetListWrapper = styled.div`
  overflow-y: auto;
  max-height: 400px; 
  padding-right: 0.5rem;
  
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 3px; }
`;

const PetListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem;
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid ${props => props.$isSelected ? '#339af0' : 'transparent'};
  background-color: ${props => props.$isSelected ? '#e7f5ff' : '#f8f9fa'};
  margin-bottom: 0.8rem;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${props => props.$isSelected ? '#e7f5ff' : '#f1f3f5'};
    transform: translateY(-2px);
  }

  img { 
    width: 50px; height: 50px; 
    border-radius: 50%; object-fit: cover; 
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  
  strong { font-size: 0.95rem; color: #343a40; display: block; }
  p { margin: 0; font-size: 0.8rem; color: #868e96; font-weight: 600; }
`;

const PetProfile = styled.div`
  display: flex; flex-direction: column; align-items: center; text-align: center;
`;

const PetImage = styled.img`
  width: 220px; height: 220px; 
  border-radius: 50%; 
  background: radial-gradient(circle, #fff 30%, #f1f3f5 70%);
  margin-bottom: 1.5rem; 
  border: 6px solid #fff;
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'none'};
  transition: transform 0.3s;
  
  &:hover { transform: scale(1.05); }
`;

const PetNameContainer = styled.div`
  display: flex; align-items: center; gap: 0.5rem; min-height: 48px; margin-bottom: 0.5rem;
`;

const PetName = styled.h1` 
  margin: 0; font-size: 1.8rem; font-weight: 900; color: #343a40; 
`;

const PetNameInput = styled.input`
  font-size: 1.8rem; font-weight: 900; border: none;
  border-bottom: 2px solid #ccc; background: transparent;
  text-align: center; width: 180px; color: #343a40;
  &:focus { outline: none; border-bottom-color: #339af0; }
`;

const PetLevel = styled.h3` 
  margin: 0 0 1.5rem 0; color: #868e96; font-size: 1rem; font-weight: 700;
  background: #f8f9fa; padding: 0.4rem 1rem; border-radius: 20px;
`;

const PetInfo = styled.div`
  width: 100%; display: flex; flex-direction: column; gap: 1.2rem;
`;

const StatBarContainer = styled.div`
  width: 100%; height: 28px; background-color: #e9ecef;
  border-radius: 14px; position: relative; overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
`;

const StatBar = styled.div`
  width: ${props => props.$percent}%; height: 100%;
  background: ${props => props.$barColor}; border-radius: 14px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
`;

const StatText = styled.span`
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); color: #343a40;
  font-weight: 800; font-size: 0.85rem; text-shadow: 0 0 4px rgba(255,255,255,0.8);
  white-space: nowrap; z-index: 2;
`;

const InfoCard = styled.div`
  padding: 1.2rem; background-color: #f8f9fa; border-radius: 16px;
  border: 1px solid #f1f3f5;
  
  h4 { margin: 0 0 0.8rem 0; font-size: 1rem; font-weight: 800; color: #495057; }
  p { margin: 0; font-size: 0.95rem; color: #495057; line-height: 1.5; }
`;

const InventoryItem = styled.p`
  display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem;
  font-weight: 600; font-size: 0.9rem;
  img { width: 24px; height: 24px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); }
`;

const ActionButtonGroup = styled.div`
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1rem; margin-top: auto;
`;

const StyledButton = styled.button`
  padding: 0.9rem; font-size: 1rem; font-weight: 800;
  border: none; border-radius: 12px; cursor: pointer;
  transition: all 0.2s; color: white;
  box-shadow: 0 4px 0 rgba(0,0,0,0.1);
  
  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #adb5bd; cursor: not-allowed; box-shadow: none; transform: none; }
`;

const EvolveButton = styled(StyledButton)` background-color: #fcc419; color: #343a40; width: 100%; &:hover:not(:disabled) { background-color: #fab005; } `;
const FeedButton = styled(StyledButton)` background-color: #ff6b6b; &:hover:not(:disabled) { background-color: #fa5252; } `;
const PetCenterButton = styled(StyledButton)` background-color: #22b8cf; grid-column: 1 / -1; &:hover:not(:disabled) { background-color: #15aabf; } `;
const BattleRequestButton = styled(StyledButton)` background-color: #fa5252; grid-column: 1 / -1; box-shadow: 0 4px 0 #c92a2a; &:hover:not(:disabled) { background-color: #e03131; } `;

// --- 대전 상대 목록 (세로형 디자인) ---
const OpponentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 500px;
  overflow-y: auto;
  padding: 5px 10px;
  
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 3px; }
`;

const OpponentItem = styled.div`
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  background-color: #fff; 
  padding: 0.8rem 1.2rem; 
  border-radius: 16px; 
  border: 1px solid #f1f3f5;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
  transition: all 0.2s;
  
  &:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
    border-color: #ff8787; 
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    
    img { 
      width: 50px; height: 50px; 
      border-radius: 50%; 
      border: 2px solid #f8f9fa; 
      object-fit: cover; 
      background-color: #fff; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    
    .info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      
      strong { font-size: 1rem; font-weight: 800; color: #343a40; margin-bottom: 2px; }
      span { font-size: 0.85rem; font-weight: 600; color: #868e96; }
    }
  }
`;

const ChallengeButton = styled.button`
  background-color: #ff6b6b; color: white; border: none; padding: 0.5rem 1rem;
  border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 0 #fa5252;
  font-size: 0.9rem;
  
  &:hover { background-color: #fa5252; transform: translateY(-1px); }
  &:active { transform: translateY(1px); box-shadow: none; }
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  text-align: center; position: relative; color: white; min-width: 350px;
  
  &.white-modal {
    background-color: #fff; color: #333; padding: 2rem; border-radius: 24px;
    max-width: 500px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  h3 { margin-top: 0; font-weight: 800; color: #343a40; }
  img.egg { animation: ${props => props.$isShaking ? shake : 'none'} 0.5s infinite; filter: drop-shadow(0 0 20px rgba(255,255,255,0.5)); }
  img.pet { max-width: 250px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3)); }
`;

const AccordionContainer = styled.div`
  width: 100%; margin-top: 1rem;
`;

const AccordionButtonRow = styled.div`
  display: flex; gap: 0.8rem; margin-bottom: 0.5rem;
`;

const AccordionButton = styled(StyledButton)`
  background-color: ${props => props.$isActive ? '#1864ab' : '#339af0'};
  flex: 1; padding: 0.7rem; font-size: 0.9rem; box-shadow: none;
  &:hover { background-color: #1c7ed6; }
`;

const AccordionContent = styled.div`
  background-color: #f8f9fa; border-radius: 12px; padding: 1.5rem;
  border: 1px solid #e9ecef; animation: ${fadeIn} 0.3s ease-out;
`;

const SkillGrid = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;
`;

const SkillSlot = styled.div`
  border: 2px dashed ${props => props.$isSelected ? '#fa5252' : '#dee2e6'};
  border-radius: 12px; padding: 0.8rem;
  background-color: ${props => props.$isSignature ? '#fff9db' : '#fff'};
  cursor: ${props => props.$isSignature ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  
  &:hover { border-color: ${props => !props.$isSignature && '#339af0'}; transform: ${props => !props.$isSignature && 'translateY(-2px)'}; }
  
  p { font-weight: 800; margin: 0 0 0.4rem 0; font-size: 0.95rem; }
  small { font-size: 0.8rem; color: #868e96; font-weight: 600; }
`;

const SkillList = styled.div`
  margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed #dee2e6;
  h5 { margin: 0 0 0.8rem 0; color: #495057; font-weight: 800; }
`;

const NotebookButton = styled(StyledButton)`
  background-color: #845ef7; width: 100%; margin-bottom: 1rem;
  &:hover:not(:disabled) { background-color: #7048e8; }
`;

const StatGrid = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 1rem; text-align: left;
`;

const StatItem = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  p:first-child { color: #868e96; margin: 0; font-weight: 600; }
  p:last-child { font-weight: 800; font-size: 1.2rem; margin: 0; color: #343a40; }
`;

const ExchangeContainer = styled.div`
  display: flex; gap: 0.5rem; grid-column: 1 / -1; margin-top: 0.5rem;
`;

const ExchangeInput = styled.input`
  width: 100%; padding: 0.8rem; border: 2px solid #e9ecef;
  border-radius: 12px; text-align: center; font-size: 1rem; font-weight: 700;
  &:focus { outline: none; border-color: #339af0; }
`;

const TooltipWrapper = styled.div`
  position: relative; display: block; width: 100%;
  &:hover::after {
    content: attr(data-tooltip); position: absolute; bottom: 105%; left: 50%;
    transform: translateX(-50%); background-color: rgba(0, 0, 0, 0.8); color: white;
    padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 100; font-weight: 600;
    display: ${props => props['data-tooltip'] ? 'block' : 'none'};
  }
  &:hover::after { opacity: 1; }
`;

// [추가] 통일된 하단 버튼 스타일
const ButtonGroup = styled.div`
  display: flex; justify-content: center; gap: 1rem; margin-top: 3rem;
`;

const ActionButton = styled.button`
  padding: 0.8rem 2rem; font-size: 1rem; font-weight: 800;
  color: ${props => props.$primary ? 'white' : '#495057'};
  background: ${props => props.$primary ? '#339af0' : '#f1f3f5'};
  border: none; border-radius: 16px; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); filter: brightness(0.95); }
`;

function PetPage() {
  const navigate = useNavigate();
  const { players, usePetItem, evolvePet, hatchPetEgg, setPartnerPet, updatePetName, convertLikesToExp, updatePetSkills, updatePlayerProfile } = useLeagueStore();
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
  const [isOpponentModalOpen, setIsOpponentModalOpen] = useState(false);

  useEffect(() => {
    if (myPlayerData?.id || !classId) return;
    const unsubscribe = onSnapshot(doc(db, 'classes', classId, 'players', myPlayerData.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPlayer = { id: docSnap.id, ...docSnap.data() };
        useLeagueStore.setState((state) => ({
          players: state.players.map((p) => p.id === updatedPlayer.id ? updatedPlayer : p)
        }));
      }
    });
    return () => unsubscribe();
  }, [myPlayerData?.id, classId]);

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
    return players.filter(p => p.authUid !== auth.currentUser.uid && p.pets && p.pets.length > 0);
  }, [players]);

  const handleSaveName = async () => {
    const filteredName = filterProfanity(newName);
    if (filteredName.includes('*')) return alert("부적절한 단어가 포함되어 있어 사용할 수 없습니다.");
    try {
      const updatedPets = [...myPlayerData.pets];
      const petIndex = updatedPets.findIndex(p => p.id === selectedPet.id);
      if (petIndex !== -1) {
        updatedPets[petIndex] = { ...updatedPets[petIndex], name: filteredName };
        await updatePlayerProfile(classId, myPlayerData.id, { pets: updatedPets });
        setIsEditingName(false);
        setNewName(filteredName);
        alert(`이름이 '${filteredName}'(으)로 변경되었습니다!`);
      }
    } catch (error) { alert("이름 저장 중 오류가 발생했습니다."); }
  };

  const handleUseItem = async (itemId) => {
    try {
      await usePetItem(itemId, selectedPet.id);
      if (itemId === 'secret_notebook') alert("펫이 새로운 스킬을 배웠습니다! 스킬 관리에서 확인해보세요.");
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
    if (!amount || amount <= 0) return alert("교환할 하트 수량을 올바르게 입력해주세요.");
    if (myPlayerData.totalLikes < amount) return alert("보유한 하트가 부족합니다.");
    if (!selectedPet) return alert("경험치를 받을 펫을 선택해주세요.");
    try {
      const { expGained } = await convertLikesToExp(amount, selectedPet.id);
      alert(`하트 ${amount}개를 경험치 ${expGained}로 교환했습니다!`);
      setExchangeAmount(1);
    } catch (error) { alert(error.message); }
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

  const getEvolutionConditionText = (evolutionStoneCount) => {
    if (!selectedPet) return "";
    const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    if (currentStage >= 3) return "최종 진화 상태입니다.";
    const requiredLevel = currentStage === 1 ? 10 : 20;
    const conditions = [];
    if (selectedPet.level < requiredLevel) conditions.push(`Lv.${requiredLevel} 달성`);
    if (evolutionStoneCount <= 0) conditions.push("진화석 필요");
    if (conditions.length === 0) return "";
    return `[조건] ${conditions.join(" 및 ")}`;
  };

  const handleSkillSlotClick = (index) => {
    const signatureSkillId = PET_DATA[selectedPet.species].skill.id;
    if (equippedSkills[index] === signatureSkillId) return alert("고유 스킬은 교체할 수 없습니다.");
    setSelectedSkillSlot(index);
  };

  const handleLearnedSkillClick = (skillId) => {
    if (selectedSkillSlot === null) return;
    if (equippedSkills.includes(skillId)) return alert("이미 장착된 스킬입니다.");
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
    } catch (error) { alert(`스킬 저장 실패: ${error.message}`); }
  };

  const handleOpenOpponentModal = () => {
    if (selectedPet.hp <= 0) return alert("기절한 펫은 대전을 신청할 수 없습니다. 먼저 치료해주세요!");
    setIsOpponentModalOpen(true);
  };

  const handleBattleRequest = async (opponent) => {
    if (!classId || !myPlayerData || !opponent) return alert("데이터가 로딩되지 않았습니다.");
    try {
      await createBattleChallenge(classId, myPlayerData, opponent);
      navigate(`/battle/${opponent.id}`);
    } catch (error) { alert(`대결 신청 실패: ${error.message}`); }
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
  const evolutionConditionText = getEvolutionConditionText(evolutionStoneCount);
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
                <button onClick={handleSaveName} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✔</button>
                <button onClick={() => { setIsEditingName(false); setNewName(selectedPet.name) }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
              </>) : (<>
                <PetName>{selectedPet.name}</PetName>
                <button onClick={() => setIsEditingName(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✏️</button>
              </>)}
            </PetNameContainer>
            <PetLevel>Lv. {selectedPet.level} {PET_DATA[selectedPet.species].name}</PetLevel>
            {isFainted && <p style={{ color: '#fa5252', fontWeight: '800', margin: 0 }}>⚠️ 전투 불능!</p>}

            <AccordionContainer>
              <AccordionButtonRow>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'stats' ? null : 'stats')} $isActive={activeAccordion === 'stats'}>상세 정보</AccordionButton>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'skills' ? null : 'skills')} $isActive={activeAccordion === 'skills'}>스킬 관리</AccordionButton>
              </AccordionButtonRow>

              {activeAccordion && (
                <AccordionContent>
                  {activeAccordion === 'stats' && (
                    <StatGrid>
                      <InfoCard style={{ padding: '0.8rem', border: 'none', background: '#fff' }}>
                        <p>{PET_DATA[selectedPet.species].description}</p>
                      </InfoCard>
                      <StatItem><p>공격력</p><p>{selectedPet.atk || 0}</p></StatItem>
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
                              {skill ? (<><p>{skill.name}</p><small>SP {skill.cost}</small></>) : <p style={{ color: '#adb5bd' }}>비어있음</p>}
                            </SkillSlot>
                          );
                        })}
                      </SkillGrid>
                      <SkillList>
                        <NotebookButton onClick={() => handleUseItem('secret_notebook')} disabled={secretNotebookCount <= 0}>
                          📖 비법 노트 사용 ({secretNotebookCount}개)
                        </NotebookButton>
                        <h5>보유 스킬 (클릭하여 교체)</h5>
                        <SkillGrid>
                          {unequippedSkills.map(skillId => {
                            const skill = SKILLS[skillId.toUpperCase()];
                            if (!skill) return null;
                            return (
                              <SkillSlot key={skillId} onClick={() => handleLearnedSkillClick(skillId)}>
                                <p>{skill.name}</p><small>SP {skill.cost}</small>
                              </SkillSlot>
                            );
                          })}
                        </SkillGrid>
                      </SkillList>
                      <StyledButton onClick={handleSaveSkills} style={{ backgroundColor: '#20c997', width: '100%', marginTop: '1rem' }}>저장하기</StyledButton>
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
              <h4>🎒 인벤토리</h4>
              {Object.values(PET_ITEMS).map(item => (
                <InventoryItem key={item.id}><img src={item.icon} alt={item.name} />{item.name}: {petInventory?.[item.id] || 0}개</InventoryItem>
              ))}
            </InfoCard>

            <ActionButtonGroup>
              <TooltipWrapper
                data-tooltip={!isEvolvable ? evolutionConditionText : ""}
                onClick={() => { if (!isEvolvable && evolutionConditionText) alert(evolutionConditionText); }}
              >
                <EvolveButton onClick={handleEvolve} disabled={!isEvolvable}>
                  {currentStage >= 3 ? "최종 진화 완료" : `진화 (${evolutionStoneCount}개)`}
                </EvolveButton>
              </TooltipWrapper>

              <FeedButton onClick={() => handleUseItem('brain_snack')} disabled={isFainted}>간식 주기 ({petInventory?.brain_snack || 0}개)</FeedButton>

              <ExchangeContainer>
                <ExchangeInput type="number" value={exchangeAmount} onChange={(e) => setExchangeAmount(e.target.value)} min="1" max={totalLikes || 1} />
                <StyledButton onClick={handleHeartExchange} disabled={!totalLikes || totalLikes < Number(exchangeAmount) || Number(exchangeAmount) <= 0} style={{ backgroundColor: '#fd7e14', width: '120px' }}>
                  ♥ 교환
                </StyledButton>
              </ExchangeContainer>

              <PetCenterButton onClick={() => navigate('/pet-center')}>🏥 펫 센터 (상점/치료소)</PetCenterButton>
              <BattleRequestButton onClick={handleOpenOpponentModal} disabled={isFainted}>⚔️ 대결 신청 (친구 목록)</BattleRequestButton>
            </ActionButtonGroup>
          </PetInfo>
        </PetDashboard>

        <PetListPanel>
          <h4>🐾 보유 펫 목록</h4>
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
            <StyledButton onClick={() => setPartnerPet(selectedPetId)} disabled={selectedPetId === partnerPetId} style={{ width: '100%', backgroundColor: '#7048e8' }}>
              파트너로 지정
            </StyledButton>
            <StyledButton onClick={handleHatch} disabled={!petInventory?.pet_egg} style={{ width: '100%', marginTop: '0.8rem', backgroundColor: '#20c997' }}>
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
                <button onClick={() => setIsHatching(false)} style={{ padding: '0.8rem 2rem', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>확인</button>
              </div>
            )}
          </ModalContent>
        </ModalBackground>
      )}

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
                      <div className="left-section">
                        <img src={petImageMap[`${oppPet.appearanceId}_idle`]} alt={oppPet.name} />
                        <div className="info">
                          <strong>{opp.name}</strong>
                          <span>{oppPet.name} (Lv.{oppPet.level})</span>
                        </div>
                      </div>
                      <ChallengeButton onClick={() => handleBattleRequest(opp)}>신청하기</ChallengeButton>
                    </OpponentItem>
                  );
                })
              )}
            </OpponentList>
          </ModalContent>
        </ModalBackground>
      )}

      {/* [수정] 통일된 스타일의 하단 버튼 */}
      <ButtonGroup>
        <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
        <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
      </ButtonGroup>
    </PageWrapper>
  );
}

export default PetPage;