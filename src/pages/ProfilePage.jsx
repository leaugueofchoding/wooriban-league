// src/pages/ProfilePage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, updatePlayerProfile } from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import PointHistoryModal from '../components/PointHistoryModal';

// --- Styled Components ---
const AvatarDisplay = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 1rem;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
  cursor: pointer; // [추가] 클릭 가능하도록 커서 변경
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

// ▼▼▼ [추가] 아바타 확대 모달 스타일 ▼▼▼
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
`;

const ModalAvatar = styled.div`
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background-color: #e9ecef;
  position: relative;
  overflow: hidden;
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
// ▲▲▲ 여기까지 추가 ▲▲▲

function ProfilePage() {
  const { players, avatarParts, fetchInitialData, teams, currentSeason } = useLeagueStore();
  const currentUser = auth.currentUser;
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false); // [추가]

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  const myTeam = useMemo(() => {
    if (!playerData || !currentSeason) return null;
    return teams.find(team => team.seasonId === currentSeason.id && team.members.includes(playerData.id));
  }, [teams, playerData, currentSeason]);

  useEffect(() => {
    if (playerData) {
      setNewName(playerData.name);
      setSelectedGender(playerData.gender || '');
    }
  }, [playerData]);

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
    if (!playerData || !playerData.authUid) return;
    const historyQuery = query(collection(db, 'point_history'), where('playerId', '==', playerData.authUid), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(historyQuery);
    setPointHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleOpenModal = () => {
    fetchPointHistory();
    setIsHistoryModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!newName.trim()) return alert('이름을 입력해주세요.');
    if (!selectedGender) return alert('성별을 선택해주세요.');

    try {
      await updatePlayerProfile(playerData.id, {
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

  const isMyProfile = playerData.authUid === currentUser?.uid;
  const loggedInPlayer = useLeagueStore(state => state.players.find(p => p.authUid === currentUser?.uid));
  const isAdmin = loggedInPlayer?.role === 'admin';

  return (
    <>
      <ProfileWrapper>
        {/* [추가] 아바타 클릭 시 모달 열기 */}
        <AvatarDisplay onClick={() => setIsAvatarModalOpen(true)}>
          {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
        </AvatarDisplay>

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
              {isMyProfile && (
                <Button onClick={() => setIsEditing(true)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>✏️</Button>
              )}
            </NameEditor>
          )}
        </UserNameContainer>

        {playerData.role && <UserRole>{playerData.role}</UserRole>}
        <PointDisplay>💰 {playerData.points?.toLocaleString() || 0} P</PointDisplay>

        <ButtonGroup>
          <ButtonRow>
            {(isMyProfile || isAdmin) && (<Button onClick={handleOpenModal}>포인트 내역</Button>)}
            {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
            <StyledLink to="/shop" style={{ backgroundColor: '#20c997', color: 'white' }}>상점 가기</StyledLink>
          </ButtonRow>
          <ButtonRow>
            {myTeam && <StyledLink to={`/league/teams/${myTeam.id}`}>소속팀 정보</StyledLink>}
            <StyledLink to={`/profile/${playerData.id}/stats`}>리그 기록</StyledLink>
          </ButtonRow>
        </ButtonGroup>

        <PointHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          history={pointHistory}
        />

        <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
      </ProfileWrapper>

      {/* ▼▼▼ [추가] 아바타 확대 모달 렌더링 ▼▼▼ */}
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
    </>
  );
}

export default ProfilePage;