import React, { useMemo, useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import {
  auth, db, updatePlayerProfile, equipTitle,
  createBattleChallenge, rejectBattleChallenge
} from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import {
  collection, query, where, orderBy, getDocs, onSnapshot, updateDoc, doc, deleteDoc
} from 'firebase/firestore';
import PointHistoryModal from '../components/PointHistoryModal';
import { petImageMap } from '@/utils/petImageMap';

// --- Styled Components ---

const AvatarWrapper = styled.div`
  position: relative;
  width: 150px;
  height: 150px;
  margin: 2rem auto 1rem;
`;

const AvatarDisplay = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  margin-top: 5px;
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
const ProfileWrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  text-align: center;
`;
const UserNameContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  min-height: 38px;
`;
const NameEditor = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
`;
const UserName = styled.h2`
  margin: 0;
`;
const UserRole = styled.span`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background-color: #007bff;
  color: white;
  border-radius: 12px;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;
const PointDisplay = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 1.5rem;
  color: #28a745;
`;

const LikeDisplay = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 0.5rem;
  color: #dc3545;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
`;

const ButtonGroup = styled.div`
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const StyledLink = styled(Link)`
  padding: 0.6em 1.2em;
  border: 1px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  color: #333;
  background-color: white;
  &:hover { background-color: #f0f0f0; }
`;
const Button = styled.button`
  padding: 0.6em 1.2em;
  border: 1px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  color: #333;
  background-color: white;
  font-family: inherit;
  font-size: inherit;
  &:hover { background-color: #f0f0f0; }
`;

const ExitButton = styled.button`
  display: block;
  margin: 3rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
  background-color: #6c757d;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover { background-color: #5a6268; }
`;

const GenderSelector = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const GenderLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 1.1rem;
  
  input[type="radio"] {
    display: none;
  }

  input[type="radio"] + span {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: 2px solid #dee2e6;
    transition: all 0.2s ease-in-out;
  }

  input[type="radio"]:checked + span {
    color: white;
    border-color: transparent;
  }
  input[type="radio"][value="남"]:checked + span {
    background-color: #007bff;
  }
  input[type="radio"][value="여"]:checked + span {
    background-color: #dc3545;
  }
`;

const shake = keyframes` 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } `;

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;

const ModalContent = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  padding: 2rem;
  background-color: #fff;
  border-radius: 12px;
  
  &.white-modal {
    flex-direction: column;
    gap: 1rem;
    max-width: 400px;
    width: 90%;
  }

  &.battle-request-modal {
    padding: 1.5rem;
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
`;

const ModalAvatar = styled.div`
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background-color: #e9ecef;
  position: relative;
  overflow: hidden;
  
  @media (max-width: 768px) {
    width: 200px;
    height: 200px;
  }
`;

const ItemList = styled.div`
  text-align: left;
  h3 {
    margin-top: 0;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    margin-bottom: 0.5rem;
  }
`;

const AccordionSection = styled.div`
  width: 100%;
  margin-top: 1rem;
  transition: all 0.3s ease-in-out;
`;

const AccordionContent = styled.div`
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    padding-top: ${props => props.$isOpen ? '1rem' : '0'};
    border-top: ${props => props.$isOpen ? '1px solid #eee' : 'none'};
`;

const EquippedTitle = styled.div`
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1.3rem;
  white-space: nowrap;
  color: ${props => props.color || '#343a40'};
  background-color: #f8f9fa;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const TitleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
`;

const TitleCard = styled.div`
  padding: 1rem;
  border: 2px solid ${props => props.$isSelected ? '#007bff' : '#ddd'};
  border-radius: 8px;
  text-align: center;
  cursor: ${props => props.$isOwned ? 'pointer' : 'default'};
  transition: all 0.2s;
  opacity: ${props => props.$isOwned ? 1 : 0.5};

  &:hover {
    box-shadow: ${props => props.$isOwned ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'};
    transform: ${props => props.$isOwned ? 'translateY(-3px)' : 'none'};
  }

  strong {
    font-size: 1.3rem;
  }
  p {
    font-size: 0.85rem;
    color: #6c757d;
    margin: 0.5rem 0 0;
  }
`;

const Subtitle = styled.h4`
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  text-align: left;
  &:first-child {
    margin-top: 0;
  }
`;

const SaveTitlesButton = styled(Button)`
    background-color: #28a745;
    color: white;
    font-weight: bold;
    margin-top: 1.5rem;
`;

// --- [추가] 펫 페이지의 카드 디자인 스타일 (수락창용) ---
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
  width: 100%;
  
  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    margin-bottom: 0.8rem;
    width: 100%;
    
    img {
      width: 80px; height: 80px;
      border-radius: 50%;
      border: 3px solid #f8f9fa;
      object-fit: cover;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    strong { font-size: 1.1rem; color: #333; margin-top: 5px; display: block; word-break: keep-all;}
    span { font-size: 0.9rem; color: #888; background-color: #f1f3f5; padding: 2px 8px; border-radius: 10px; margin-top: 4px;}
  }
`;

const ChallengeButton = styled.button`
  width: 100%;
  background-color: #ff6b6b;
  color: white;
  border: none;
  padding: 10px 0;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 0 #fa5252;
  
  &:hover { background-color: #fa5252; }
  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #ccc; cursor: not-allowed; box-shadow: none; }
`;

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

  // --- ★ [추가] 대전 수신용 State ---
  const [incomingChallenge, setIncomingChallenge] = useState(null);

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);
  const isMyProfile = myPlayerData?.id === playerData?.id;

  useEffect(() => {
    if (playerData) {
      setNewName(playerData.name);
      setSelectedGender(playerData.gender || '');
      setSelectedTitleId(playerData.equippedTitle || null);
    }
  }, [playerData]);

  // --- ★ [추가] 실시간 대전 신청 감지 리스너 ---
  useEffect(() => {
    if (!currentUser || !db || !classId || !myPlayerData) return;

    const q = query(
      collection(db, "classes", classId, "battles"),
      where("opponent.id", "==", myPlayerData.id),
      where("status", "==", "pending")
    );

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

  // --- ★ [추가] 수락/거절 핸들러 ---
  const handleAcceptChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      await updateDoc(doc(db, "classes", classId, "battles", incomingChallenge.id), {
        status: "accepted"
      });
      alert("도전을 수락했습니다! 경기장으로 이동합니다.");
      navigate(`/battle/${incomingChallenge.challenger.id}`);
    } catch (error) {
      console.error(error);
      alert("수락 중 오류 발생");
    }
  };

  const handleRejectChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      if (confirm("대전을 거절하시겠습니까?")) {
        await rejectBattleChallenge(classId, incomingChallenge.id);
        setIncomingChallenge(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBattleRequest = async () => {
    if (!classId || !myPlayerData || !playerData) return;

    try {
      await createBattleChallenge(classId, myPlayerData, playerData);
      navigate(`/battle/${playerData.id}`);
    } catch (error) {
      alert(`대결 신청 실패: ${error.message}`);
    }
  };

  const equippedTitle = useMemo(() => {
    if (!playerData?.equippedTitle || !titles.length) return null;
    return titles.find(t => t.id === playerData.equippedTitle);
  }, [playerData, titles]);

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
    } catch (error) {
      alert('칭호 저장에 실패했습니다.');
    }
  };

  const myTeam = useMemo(() => {
    if (!playerData || !currentSeason) return null;
    return teams.find(team => team.seasonId === currentSeason.id && team.members.includes(playerData.id));
  }, [teams, playerData, currentSeason]);

  const { selectedPartUrls, equippedItems } = useMemo(() => {
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    if (!playerData?.avatarConfig || !avatarParts.length) {
      return { selectedPartUrls: [baseAvatar], equippedItems: [] };
    }
    const urls = [baseAvatar];
    const items = [];
    const config = playerData.avatarConfig;
    RENDER_ORDER.forEach(category => {
      const partId = config[category];
      if (partId) {
        const part = avatarParts.find(p => p.id === partId);
        if (part) {
          urls.push(part.src);
          items.push(part);
        }
      }
    });
    if (config.accessories) {
      Object.values(config.accessories).forEach(partId => {
        const part = avatarParts.find(p => p.id === partId);
        if (part) {
          urls.push(part.src);
          items.push(part);
        }
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

  const handleOpenModal = () => {
    fetchPointHistory();
    setIsHistoryModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!classId || !playerData) return;
    if (!newName.trim()) return alert('이름을 입력해주세요.');
    if (!selectedGender) return alert('성별을 선택해주세요.');

    try {
      await updatePlayerProfile(classId, playerData.id, {
        name: newName.trim(),
        gender: selectedGender,
      });
      alert('프로필이 저장되었습니다.');
      setIsEditing(false);
      await fetchInitialData();
    } catch (error) {
      alert(`프로필 저장 실패: ${error.message}`);
    }
  };

  if (!playerData) {
    return (
      <ProfileWrapper>
        <h2>선수 정보를 찾을 수 없습니다.</h2>
        <ButtonGroup>
          <StyledLink to="/">홈으로 돌아가기</StyledLink>
        </ButtonGroup>
      </ProfileWrapper>
    );
  }

  const loggedInPlayer = useLeagueStore(state => state.players.find(p => p.authUid === currentUser?.uid));
  const isAdmin = loggedInPlayer?.role === 'admin';

  return (
    <>
      <ProfileWrapper>
        <AvatarWrapper>
          {equippedTitle && (
            <EquippedTitle color={equippedTitle.color}>
              {equippedTitle.icon} {equippedTitle.name}
            </EquippedTitle>
          )}
          <AvatarDisplay onClick={() => setIsAvatarModalOpen(true)}>
            {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
          </AvatarDisplay>
        </AvatarWrapper>
        <UserNameContainer>
          {isEditing ? (
            <>
              <NameEditor>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', width: '200px', padding: '0.25rem' }}
                />
              </NameEditor>
              <GenderSelector>
                <GenderLabel>
                  <input type="radio" name="gender" value="남" checked={selectedGender === '남'} onChange={(e) => setSelectedGender(e.target.value)} />
                  <span>남자</span>
                </GenderLabel>
                <GenderLabel>
                  <input type="radio" name="gender" value="여" checked={selectedGender === '여'} onChange={(e) => setSelectedGender(e.target.value)} />
                  <span>여자</span>
                </GenderLabel>
              </GenderSelector>
              <div>
                <Button onClick={handleSaveProfile} style={{ backgroundColor: '#28a745', color: 'white' }}>저장</Button>
                <Button onClick={() => setIsEditing(false)} style={{ backgroundColor: '#6c757d', color: 'white', marginLeft: '0.5rem' }}>취소</Button>
              </div>
            </>
          ) : (
            <NameEditor>
              <UserName>{playerData.name}</UserName>
              {(isMyProfile || isAdmin) && (
                <Button onClick={() => setIsEditing(true)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>✏️</Button>
              )}
            </NameEditor>
          )}
        </UserNameContainer>

        {playerData.role && <UserRole>{playerData.role}</UserRole>}
        <PointDisplay>💰 {playerData.points?.toLocaleString() || 0} P</PointDisplay>
        <LikeDisplay>❤️ {playerData.totalLikes?.toLocaleString() || 0}</LikeDisplay>

        <ButtonGroup>
          <ButtonRow>
            {(isMyProfile || isAdmin) && (<Button onClick={handleOpenModal}>포인트 내역</Button>)}
            {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
            {isMyProfile && <StyledLink to="/shop" style={{ backgroundColor: '#20c997', color: 'white' }}>상점 가기</StyledLink>}

            {!isMyProfile && loggedInPlayer && loggedInPlayer.pets?.length > 0 && playerData.pets?.length > 0 && (
              <Button
                onClick={handleBattleRequest}
                style={{ backgroundColor: '#dc3545', color: 'white' }}
                disabled={!myPlayerData?.partnerPetId || !playerData?.partnerPetId}
                title={!myPlayerData?.partnerPetId || !playerData?.partnerPetId ? "양쪽 모두 파트너 펫을 선택해야 합니다." : ""}
              >
                퀴즈 대결 신청
              </Button>
            )}
          </ButtonRow>
          <ButtonRow>
            {myTeam && <StyledLink to={`/league/teams/${myTeam.id}`}>소속팀 정보</StyledLink>}
            <StyledLink to={`/profile/${playerData.id}/stats`}>리그 기록</StyledLink>
            {isMyProfile && <Button onClick={() => setIsTitleAccordionOpen(prev => !prev)}>칭호 관리</Button>}
            {isMyProfile && (
              <StyledLink
                to={(playerData.pets && playerData.pets.length > 0) || playerData.pet ? "/pet" : "/pet/select"}
                style={{ backgroundColor: '#6f42c1', color: 'white' }}
              >
                펫 관리
              </StyledLink>
            )}
            <StyledLink to={`/my-room/${playerData.id}`} style={{ backgroundColor: '#fd7e14', color: 'white' }}>마이룸 가기</StyledLink>
          </ButtonRow>
        </ButtonGroup>

        {isMyProfile && (
          <AccordionSection>
            <AccordionContent $isOpen={isTitleAccordionOpen}>
              <Subtitle>획득한 칭호 ✨</Subtitle>
              <TitleGrid>
                {ownedTitles.length > 0 ? ownedTitles.map(title => (
                  <TitleCard
                    key={title.id}
                    $isSelected={selectedTitleId === title.id}
                    onClick={() => setSelectedTitleId(prev => prev === title.id ? null : title.id)}
                    $isOwned={true}
                    title="클릭하여 장착/해제"
                  >
                    <strong style={{ color: title.color }}>{title.icon} {title.name}</strong>
                    <p>{title.description}</p>
                  </TitleCard>
                )) : <p>아직 획득한 칭호가 없습니다.</p>}
              </TitleGrid>
              <SaveTitlesButton onClick={handleSaveEquippedTitle}>
                선택한 칭호로 저장하기
              </SaveTitlesButton>
              <Subtitle>미획득 칭호 🔒</Subtitle>
              <TitleGrid>
                {unownedTitles.map(title => (
                  <TitleCard
                    key={title.id}
                    $isOwned={false}
                    title={title.description}
                  >
                    <strong style={{ color: title.color }}>{title.icon} {title.name}</strong>
                    <p>{title.description}</p>
                  </TitleCard>
                ))}
              </TitleGrid>
            </AccordionContent>
          </AccordionSection>
        )}

        <PointHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          history={pointHistory}
        />

        <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
      </ProfileWrapper>

      {isAvatarModalOpen && (
        <ModalBackground onClick={() => setIsAvatarModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalAvatar>
              {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
            </ModalAvatar>
            <ItemList>
              <h3>착용 중인 아이템</h3>
              <ul>
                {equippedItems.map(item => (
                  <li key={item.id}>{item.displayName || item.id}</li>
                ))}
              </ul>
            </ItemList>
          </ModalContent>
        </ModalBackground>
      )}

      {/* ★ [수정됨] 대결 수락 팝업 (PetPage와 동일한 카드 디자인 적용) ★ */}
      {incomingChallenge && (
        <ModalBackground>
          <ModalContent className="white-modal battle-request-modal">
            <h3 style={{ marginBottom: '1rem', color: '#333' }}>⚔️ 대결 신청이 왔습니다!</h3>

            {/* 펫 페이지와 동일한 카드 디자인 (OpponentItem) 사용 */}
            <OpponentItem style={{ marginBottom: '1rem', boxShadow: 'none', border: '1px solid #ddd' }}>
              <div className="user-info">
                <img
                  src={petImageMap[`${incomingChallenge.challenger?.pet?.appearanceId}_idle`] || petImageMap['slime_lv1_idle']}
                  alt="도전자 펫"
                />
                <div>
                  <strong>{incomingChallenge.challenger?.name}</strong>
                  <span>{incomingChallenge.challenger?.pet?.name} (Lv.{incomingChallenge.challenger?.pet?.level})</span>
                </div>
              </div>
            </OpponentItem>

            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <ChallengeButton
                onClick={handleAcceptChallenge}
                style={{ backgroundColor: '#20c997', flex: 1 }}
              >
                수락
              </ChallengeButton>
              <ChallengeButton
                onClick={handleRejectChallenge}
                style={{ backgroundColor: '#adb5bd', flex: 1 }}
              >
                거절
              </ChallengeButton>
            </div>
          </ModalContent>
        </ModalBackground>
      )}
    </>
  );
}

export default ProfilePage;