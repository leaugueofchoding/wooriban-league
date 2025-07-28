// src/pages/ProfilePage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, updatePlayerProfile } from '../api/firebase.js'; // [수정] updatePlayerProfile import
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
  flex-direction: column; // [수정] 세로 정렬
  justify-content: center;
  align-items: center;
  gap: 1rem; // [수정] 간격 조정
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

function ProfilePage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false); // [수정] isEditingName -> isEditing
  const [newName, setNewName] = useState('');
  const [selectedGender, setSelectedGender] = useState('');

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  useEffect(() => {
    if (playerData) {
      setNewName(playerData.name);
      setSelectedGender(playerData.gender || '');
    }
  }, [playerData]);

  const selectedPartUrls = useMemo(() => {
    if (!playerData || !playerData.avatarConfig || !avatarParts.length) return [];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];
    const partsByCategory = avatarParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
    const urls = [baseAvatar];
    RENDER_ORDER.forEach(category => {
      const partId = playerData.avatarConfig[category];
      if (partId) {
        const part = partsByCategory[category]?.find(p => p.id === partId);
        if (part) urls.push(part.src);
      }
    });
    return urls;
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

  // ▼▼▼ [수정] 이름과 성별을 함께 저장하는 핸들러 ▼▼▼
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
    <ProfileWrapper>
      <AvatarDisplay>
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
        {(isMyProfile || isAdmin) && (<Button onClick={handleOpenModal}>포인트 내역</Button>)}
        {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
        <StyledLink to="/shop">상점 가기</StyledLink>
        <StyledLink to={`/profile/${playerData.id}/stats`}>리그 기록</StyledLink>
      </ButtonGroup>

      <PointHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={pointHistory}
      />

      <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
    </ProfileWrapper>
  );
}

export default ProfilePage;