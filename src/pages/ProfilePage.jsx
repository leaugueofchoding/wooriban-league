// src/pages/ProfilePage.jsx

import React, { useMemo, useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import {
  auth, db, updatePlayerProfile, equipTitle,
  createBattleChallenge, rejectBattleChallenge, storage
} from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import {
  collection, query, where, orderBy, getDocs, onSnapshot, updateDoc, doc
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import PointHistoryModal from '../components/PointHistoryModal';
import { petImageMap } from '../utils/petImageMap';
import html2canvas from 'html2canvas';

// --- Animations ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 107, 107, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
`;

// --- Styled Components ---

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 4rem 1rem;
  font-family: 'Pretendard', sans-serif;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const GlassCard = styled.div`
  width: 100%;
  max-width: 800px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 3rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.6);
  animation: ${fadeIn} 0.5s ease-out;
  position: relative;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const ProfileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 3rem;
  margin-bottom: 2.5rem;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
  }
`;

const AvatarSection = styled.div`
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;

  &:hover {
    transform: scale(1.02);
  }
`;

const AvatarCircle = styled.div`
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: #f8f9fa;
  border: 5px solid white;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;
`;

const InfoSection = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: flex-start;

  @media (max-width: 768px) {
    align-items: center;
    width: 100%;
  }
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;

  h2 {
    font-size: 2rem;
    font-weight: 900;
    color: #343a40;
    margin: 0;
  }
`;

const EditButton = styled.button`
  background: #f1f3f5;
  border: none;
  border-radius: 50%;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #868e96; transition: all 0.2s;
  &:hover { background: #e9ecef; color: #339af0; }
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const BaseBadge = styled.div`
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex; align-items: center; gap: 0.4rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const TitleBadge = styled(BaseBadge)`
  background: white; border: 1px solid #dee2e6; color: ${props => props.color || '#495057'};
`;

const RoleBadge = styled(BaseBadge)`
  background: #e7f5ff; color: #1c7ed6;
`;

const PetBadge = styled(BaseBadge)`
  background: #f3f0ff; color: #7950f2;
  img { width: 20px; height: 20px; object-fit: contain; }
`;

const StatsRow = styled.div`
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
  padding-top: 1rem;
  border-top: 2px solid #f1f3f5;
  width: 100%;

  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  
  .label { font-size: 0.85rem; color: #868e96; font-weight: 600; }
  .value { font-size: 1.2rem; font-weight: 800; color: #343a40; }
`;

const EditForm = styled.div`
  display: flex; flex-direction: column; align-items: flex-start; gap: 1rem;
  background: #f8f9fa; padding: 1.5rem; border-radius: 16px; width: 100%;
  @media (max-width: 768px) { align-items: center; }
`;

const Input = styled.input`
  padding: 0.8rem; border: 2px solid #dee2e6; border-radius: 12px;
  font-size: 1.1rem; font-weight: bold; width: 100%; max-width: 250px;
  &:focus { outline: none; border-color: #339af0; }
`;

const GenderOptions = styled.div` display: flex; gap: 1rem; `;
const GenderRadio = styled.label`
  cursor: pointer; input { display: none; }
  span {
    display: block; padding: 0.6rem 1.2rem; border-radius: 20px; background: white;
    border: 2px solid #dee2e6; font-weight: 700; color: #868e96; transition: all 0.2s;
  }
  input:checked + span {
    background: ${props => props.color}; border-color: ${props => props.color};
    color: white; box-shadow: 0 4px 10px ${props => props.shadow};
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  width: 100%;
  margin-top: 1rem;
`;

const ActionCard = styled(Link)`
  background: ${props => props.$bg || 'white'};
  padding: 1.2rem 0.5rem;
  border-radius: 16px;
  text-decoration: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: ${props => props.$color || '#495057'};
  cursor: pointer;

  &:hover { transform: translateY(-4px); box-shadow: 0 8px 15px rgba(0,0,0,0.1); filter: brightness(0.98); }
  .icon { font-size: 1.8rem; }
  .text { font-size: 0.95rem; font-weight: 700; }
`;

const ActionButton = styled.button`
  background: ${props => props.$bg || 'white'};
  padding: 1.2rem 0.5rem;
  border-radius: 16px; border: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: ${props => props.$color || '#495057'};
  cursor: pointer; font-family: inherit;

  &:hover { transform: translateY(-4px); box-shadow: 0 8px 15px rgba(0,0,0,0.1); filter: brightness(0.98); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .icon { font-size: 1.8rem; }
  .text { font-size: 0.95rem; font-weight: 700; }
`;

const AccordionWrapper = styled.div` margin-top: 2rem; width: 100%; `;
const AccordionContent = styled.div`
  background: #f8f9fa; border-radius: 16px;
  padding: ${props => props.$isOpen ? '1.5rem' : '0'};
  max-height: ${props => props.$isOpen ? '1000px' : '0'};
  opacity: ${props => props.$isOpen ? 1 : 0};
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: ${props => props.$isOpen ? '1px solid #dee2e6' : 'none'};
`;
const TitleGrid = styled.div` display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.8rem; `;
const TitleCard = styled.div`
  background: white; padding: 1rem; border-radius: 12px;
  border: 2px solid ${props => props.$isSelected ? '#339af0' : 'transparent'};
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  text-align: center; cursor: ${props => props.$isOwned ? 'pointer' : 'default'};
  opacity: ${props => props.$isOwned ? 1 : 0.6}; transition: all 0.2s;
  &:hover { transform: ${props => props.$isOwned ? 'translateY(-2px)' : 'none'}; box-shadow: ${props => props.$isOwned ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'}; }
  .icon { font-size: 1.5rem; margin-bottom: 0.3rem; }
  .name { font-weight: 700; font-size: 0.95rem; color: ${props => props.color || '#343a40'}; }
  .desc { font-size: 0.8rem; color: #868e96; margin-top: 0.3rem; }
`;
const SectionTitle = styled.h4` margin: 1.5rem 0 0.8rem; font-size: 1rem; color: #495057; font-weight: 700; &:first-child { margin-top: 0; } `;
const PrimaryBtn = styled.button`
  width: 100%; padding: 0.8rem; margin-top: 1.5rem; background: #20c997; color: white;
  font-weight: 700; border: none; border-radius: 12px; cursor: pointer; font-size: 1rem; transition: all 0.2s;
  &:hover { background: #12b886; transform: translateY(-2px); }
  &:disabled { background: #adb5bd; cursor: not-allowed; transform: none; }
`;

const ModalOverlay = styled.div` position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 2000; `;
const ModalContent = styled.div` background: white; padding: 2rem; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-width: 400px; width: 90%; position: relative; text-align: center; animation: ${fadeIn} 0.3s ease-out; `;
const BattleRequestCard = styled.div` background: #fff5f5; border: 1px solid #ffc9c9; border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem; animation: ${pulse} 2s infinite; img { width: 80px; height: 80px; object-fit: contain; margin-bottom: 0.5rem; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.1)); } h3 { margin: 0; color: #fa5252; font-size: 1.2rem; } p { margin: 0.5rem 0 0; color: #495057; font-weight: 600; } `;
const ButtonRow = styled.div` display: flex; gap: 0.8rem; button { flex: 1; padding: 0.8rem; border-radius: 12px; border: none; font-weight: 700; cursor: pointer; transition: transform 0.2s; } .accept { background: #339af0; color: white; &:hover { background: #228be6; } } .reject { background: #f1f3f5; color: #868e96; &:hover { background: #e9ecef; } } `;
const ItemList = styled.div` text-align: left; h3 { margin: 0 0 1rem; font-size: 1.1rem; color: #343a40; } ul { list-style: none; padding: 0; } li { padding: 0.5rem; border-bottom: 1px solid #f1f3f5; font-size: 0.95rem; color: #495057; &:last-child { border: none; } } `;

function ProfilePage() {
  const { classId } = useClassStore();
  const { players, avatarParts, fetchInitialData, teams, currentSeason, titles } = useLeagueStore();
  const currentUser = auth.currentUser;
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isTitleAccordionOpen, setIsTitleAccordionOpen] = useState(false);
  const [selectedTitleId, setSelectedTitleId] = useState(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const avatarRef = useRef(null);

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const isMyProfile = myPlayerData?.id === playerData?.id;
  const isAdmin = myPlayerData?.role === 'admin';

  useEffect(() => {
    if (playerData) {
      setNewName(playerData.name);
      setSelectedGender(playerData.gender || '');
      setSelectedTitleId(playerData.equippedTitle || null);
    }
  }, [playerData]);

  // 실시간 대전 신청 감지
  useEffect(() => {
    if (!currentUser || !db || !classId || !myPlayerData) return;
    const q = query(collection(db, "classes", classId, "battles"), where("opponent.id", "==", myPlayerData.id), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        setIncomingChallenge({ id: docData.id, ...docData.data() });
      } else {
        setIncomingChallenge(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser, classId, myPlayerData]);

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      await updateDoc(doc(db, "classes", classId, "battles", incomingChallenge.id), { status: "accepted" });
      alert("도전을 수락했습니다! 경기장으로 이동합니다.");
      navigate(`/battle/${incomingChallenge.challenger.id}`);
    } catch (error) { console.error(error); alert("수락 중 오류 발생"); }
  };

  const handleRejectChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      if (confirm("대전을 거절하시겠습니까?")) {
        await rejectBattleChallenge(classId, incomingChallenge.id);
        setIncomingChallenge(null);
      }
    } catch (error) { console.error(error); }
  };

  const handleBattleRequest = async () => {
    if (!classId || !myPlayerData || !playerData) return;
    try {
      await createBattleChallenge(classId, myPlayerData, playerData);
      navigate(`/battle/${playerData.id}`);
    } catch (error) { alert(`대결 신청 실패: ${error.message}`); }
  };

  const equippedTitle = useMemo(() => {
    if (!playerData?.equippedTitle || !titles.length) return null;
    return titles.find(t => t.id === playerData.equippedTitle);
  }, [playerData, titles]);

  const partnerPet = useMemo(() => {
    if (!playerData || !playerData.pets) return null;
    return playerData.pets.find(p => p.id === playerData.partnerPetId) || playerData.pets[0];
  }, [playerData]);

  const ownedTitles = useMemo(() => {
    if (!playerData?.ownedTitles || !titles.length) return [];
    return playerData.ownedTitles.map(titleId => titles.find(t => t.id === titleId)).filter(Boolean);
  }, [playerData, titles]);

  const unownedTitles = useMemo(() => {
    if (!playerData || !titles.length) return [];
    const ownedIds = new Set(playerData.ownedTitles || []);
    return titles.filter(title => !ownedIds.has(title.id));
  }, [playerData, titles]);

  const handleSaveEquippedTitle = async () => {
    if (!classId || !playerData) return;
    try {
      await equipTitle(classId, playerData.id, selectedTitleId);
      await fetchInitialData();
      alert('칭호가 저장되었습니다!');
      setIsTitleAccordionOpen(false);
    } catch (error) { alert('칭호 저장 실패'); }
  };

  const myTeam = useMemo(() => {
    if (!playerData || !currentSeason) return null;
    return teams.find(team => team.seasonId === currentSeason.id && team.members.includes(playerData.id));
  }, [teams, playerData, currentSeason]);

  const { selectedPartUrls, equippedItems } = useMemo(() => {
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    if (!playerData?.avatarConfig || !avatarParts.length) return { selectedPartUrls: [baseAvatar], equippedItems: [] };
    const urls = [baseAvatar];
    const items = [];
    const config = playerData.avatarConfig;
    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) {
        const part = avatarParts.find(p => p.id === partId);
        if (part) { urls.push(part.src); items.push(part); }
      }
    });
    if (config.accessories) {
      Object.values(config.accessories).forEach(partId => {
        const part = avatarParts.find(p => p.id === partId);
        if (part) { urls.push(part.src); items.push(part); }
      });
    }
    return { selectedPartUrls: Array.from(new Set(urls)), equippedItems: items };
  }, [playerData, avatarParts]);

  const fetchPointHistory = async () => {
    if (!classId || !playerData || !playerData.authUid) return;
    const historyQuery = query(collection(db, 'classes', classId, 'point_history'), where('playerId', '==', playerData.authUid), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(historyQuery);
    setPointHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleOpenModal = () => { fetchPointHistory(); setIsHistoryModalOpen(true); };

  const handleSaveProfile = async () => {
    if (!classId || !playerData) return;
    if (!newName.trim()) return alert('이름을 입력해주세요.');
    if (!selectedGender) return alert('성별을 선택해주세요.');

    setIsSavingProfile(true);
    let avatarSnapshotUrl = playerData.avatarSnapshotUrl;

    try {
      if (avatarRef.current) {
        const canvas = await html2canvas(avatarRef.current, {
          backgroundColor: null,
          scale: 2,
          useCORS: true, // [중요] CORS 문제 해결
        });
        const imageDataUrl = canvas.toDataURL("image/png");
        const storageRef = ref(storage, `classes/${classId}/players/${playerData.id}/avatarSnapshot_${Date.now()}.png`);
        await uploadString(storageRef, imageDataUrl, 'data_url');
        avatarSnapshotUrl = await getDownloadURL(storageRef);
      }

      await updatePlayerProfile(classId, playerData.id, {
        name: newName.trim(),
        gender: selectedGender,
        avatarSnapshotUrl: avatarSnapshotUrl
      });

      alert('프로필이 저장되었습니다.');
      setIsEditing(false);
      await fetchInitialData();
    } catch (error) {
      console.error(error);
      alert(`저장 실패: ${error.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!playerData) return <PageContainer><GlassCard><h2>선수 정보를 찾을 수 없습니다.</h2><ActionCard to="/">홈으로</ActionCard></GlassCard></PageContainer>;

  return (
    <PageContainer>
      <GlassCard>

        <ProfileHeader>
          <AvatarSection onClick={() => setIsAvatarModalOpen(true)}>
            <AvatarCircle ref={avatarRef}>
              {/* 스냅샷이 있고 편집 중이 아닐 때만 스냅샷 표시, 편집 중이거나 스냅샷 없으면 파츠 렌더링 */}
              {playerData.avatarSnapshotUrl && !isEditing ? (
                <img src={playerData.avatarSnapshotUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                selectedPartUrls.map(src => <PartImage key={src} src={src} />)
              )}
            </AvatarCircle>
          </AvatarSection>

          <InfoSection>
            {isEditing ? (
              <EditForm>
                <Input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름 입력" />
                <GenderOptions>
                  <GenderRadio color="#339af0" shadow="rgba(51, 154, 240, 0.3)">
                    <input type="radio" name="gender" value="남" checked={selectedGender === '남'} onChange={(e) => setSelectedGender(e.target.value)} />
                    <span>남자</span>
                  </GenderRadio>
                  <GenderRadio color="#ff6b6b" shadow="rgba(255, 107, 107, 0.3)">
                    <input type="radio" name="gender" value="여" checked={selectedGender === '여'} onChange={(e) => setSelectedGender(e.target.value)} />
                    <span>여자</span>
                  </GenderRadio>
                </GenderOptions>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <PrimaryBtn
                    style={{ marginTop: 0, padding: '0.6rem 1.2rem', width: 'auto' }}
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? '저장 중...' : '저장'}
                  </PrimaryBtn>
                  <PrimaryBtn
                    style={{ marginTop: 0, padding: '0.6rem 1.2rem', width: 'auto', background: '#adb5bd' }}
                    onClick={() => setIsEditing(false)}
                    disabled={isSavingProfile}
                  >
                    취소
                  </PrimaryBtn>
                </div>
              </EditForm>
            ) : (
              <>
                <NameRow>
                  <h2>{playerData.name}</h2>
                  {(isMyProfile || isAdmin) && <EditButton onClick={() => setIsEditing(true)}>✎</EditButton>}
                </NameRow>

                <BadgeRow>
                  {equippedTitle && (
                    <TitleBadge color={equippedTitle.color}>
                      {equippedTitle.icon} {equippedTitle.name}
                    </TitleBadge>
                  )}
                  {partnerPet && (
                    <PetBadge>
                      <img src={petImageMap[`${partnerPet.appearanceId}_idle`] || petImageMap['slime_lv1_idle']} alt="pet" />
                      Lv.{partnerPet.level} {partnerPet.name}
                    </PetBadge>
                  )}
                  {playerData.role && <RoleBadge>{playerData.role}</RoleBadge>}
                </BadgeRow>

                <StatsRow>
                  <StatItem>
                    <span className="label">보유 포인트</span>
                    <span className="value" style={{ color: '#20c997' }}>💰 {playerData.points?.toLocaleString() || 0}</span>
                  </StatItem>
                  <StatItem>
                    <span className="label">받은 좋아요</span>
                    <span className="value" style={{ color: '#fa5252' }}>❤️ {playerData.totalLikes?.toLocaleString() || 0}</span>
                  </StatItem>
                </StatsRow>
              </>
            )}
          </InfoSection>
        </ProfileHeader>

        <ActionGrid>
          {(isMyProfile || isAdmin) && (
            <ActionButton onClick={handleOpenModal} $bg="#f8f9fa">
              <span className="icon">📜</span>
              <span className="text">포인트 내역</span>
            </ActionButton>
          )}

          {isMyProfile && (
            <>
              <ActionCard to="/profile/edit" $bg="#e7f5ff" $color="#1c7ed6">
                <span className="icon">👕</span>
                <span className="text">아바타 꾸미기</span>
              </ActionCard>
              <ActionButton onClick={() => setIsTitleAccordionOpen(prev => !prev)} $bg="#fff9db" $color="#f08c00">
                <span className="icon">👑</span>
                <span className="text">칭호 관리</span>
              </ActionButton>
              <ActionCard to="/shop" $bg="#ebfbee" $color="#2b8a3e">
                <span className="icon">🛍️</span>
                <span className="text">상점 가기</span>
              </ActionCard>
              <ActionCard to={(playerData.pets && playerData.pets.length > 0) || playerData.pet ? "/pet" : "/pet/select"} $bg="#f3f0ff" $color="#7950f2">
                <span className="icon">🐾</span>
                <span className="text">펫 관리</span>
              </ActionCard>
            </>
          )}

          {myTeam && (
            <ActionCard to={`/league/teams/${myTeam.id}`} $bg="#fff0f6" $color="#c2255c">
              <span className="icon">🛡️</span>
              <span className="text">소속팀</span>
            </ActionCard>
          )}

          <ActionCard to={`/profile/${playerData.id}/stats`} $bg="#e3fafc" $color="#0c8599">
            <span className="icon">📊</span>
            <span className="text">리그 기록</span>
          </ActionCard>

          <ActionCard to={`/my-room/${playerData.id}`} $bg="#fff4e6" $color="#e8590c">
            <span className="icon">🏠</span>
            <span className="text">마이룸 방문</span>
          </ActionCard>

          {!isMyProfile && myPlayerData && myPlayerData.pets?.length > 0 && playerData.pets?.length > 0 && (
            <ActionButton
              onClick={handleBattleRequest}
              $bg="#ffc9c9" $color="#e03131"
              disabled={!myPlayerData?.partnerPetId || !playerData?.partnerPetId}
            >
              <span className="icon">⚔️</span>
              <span className="text">대결 신청</span>
            </ActionButton>
          )}
        </ActionGrid>

        {isMyProfile && (
          <AccordionWrapper>
            <AccordionContent $isOpen={isTitleAccordionOpen}>
              <SectionTitle>✨ 획득한 칭호</SectionTitle>
              <TitleGrid>
                {ownedTitles.length > 0 ? ownedTitles.map(title => (
                  <TitleCard
                    key={title.id}
                    $isSelected={selectedTitleId === title.id}
                    $isOwned={true}
                    onClick={() => setSelectedTitleId(prev => prev === title.id ? null : title.id)}
                  >
                    <div className="icon">{title.icon}</div>
                    <div className="name" color={title.color}>{title.name}</div>
                    <div className="desc">{title.description}</div>
                  </TitleCard>
                )) : <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#adb5bd' }}>아직 획득한 칭호가 없습니다.</p>}
              </TitleGrid>

              <PrimaryBtn onClick={handleSaveEquippedTitle}>선택한 칭호 장착하기</PrimaryBtn>

              <SectionTitle>🔒 미획득 칭호</SectionTitle>
              <TitleGrid>
                {unownedTitles.map(title => (
                  <TitleCard key={title.id} $isOwned={false}>
                    <div className="icon">{title.icon}</div>
                    <div className="name" color={title.color}>{title.name}</div>
                    <div className="desc">{title.description}</div>
                  </TitleCard>
                ))}
              </TitleGrid>
            </AccordionContent>
          </AccordionWrapper>
        )}

        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <ActionButton onClick={() => navigate(-1)} style={{ padding: '0.8rem 2rem', background: '#f1f3f5', fontWeight: 'bold', display: 'inline-flex' }}>
            뒤로 가기
          </ActionButton>
        </div>

      </GlassCard>

      {isAvatarModalOpen && (
        <ModalOverlay onClick={() => setIsAvatarModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <AvatarCircle style={{ width: '200px', height: '200px', margin: '0 auto 1.5rem' }}>
              {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
            </AvatarCircle>
            <ItemList>
              <h3>착용 아이템 정보</h3>
              <ul>
                {equippedItems.map(item => (
                  <li key={item.id}>{item.displayName || item.id}</li>
                ))}
              </ul>
            </ItemList>
            <PrimaryBtn onClick={() => setIsAvatarModalOpen(false)} style={{ background: '#adb5bd', marginTop: '1rem' }}>닫기</PrimaryBtn>
          </ModalContent>
        </ModalOverlay>
      )}

      {incomingChallenge && (
        <ModalOverlay>
          <ModalContent>
            <BattleRequestCard>
              <img
                src={petImageMap[`${incomingChallenge.challenger?.pet?.appearanceId}_idle`] || petImageMap['slime_lv1_idle']}
                alt="challenger_pet"
              />
              <h3>⚔️ 대결 신청!</h3>
              <p>{incomingChallenge.challenger?.name}님이 도전장을 보냈습니다.</p>
              <div style={{ fontSize: '0.9rem', color: '#868e96', marginTop: '5px' }}>
                VS {incomingChallenge.challenger?.pet?.name} (Lv.{incomingChallenge.challenger?.pet?.level})
              </div>
            </BattleRequestCard>
            <ButtonRow>
              <button className="accept" onClick={handleAcceptChallenge}>수락하기</button>
              <button className="reject" onClick={handleRejectChallenge}>거절하기</button>
            </ButtonRow>
          </ModalContent>
        </ModalOverlay>
      )}

      <PointHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={pointHistory}
      />

    </PageContainer>
  );
}

export default ProfilePage;