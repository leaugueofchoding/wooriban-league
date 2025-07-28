// src/pages/ProfilePage.jsx

import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, updatePlayerName } from '../api/firebase.js';
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
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  min-height: 38px;
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


function ProfilePage() {
  const { players, avatarParts, fetchInitialData } = useLeagueStore();
  const currentUser = auth.currentUser;
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // ▼▼▼ [수정] 현재 로그인한 유저의 플레이어 데이터를 가져옴 ▼▼▼
  const loggedInPlayerData = useMemo(() => {
    return players.find(p => p.authUid === currentUser?.uid);
  }, [players, currentUser]);

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  useEffect(() => {
    if (playerData) {
      setNewName(playerData.name);
    }
  }, [playerData]);

  const selectedPartUrls = useMemo(() => {
    if (!playerData || !playerData.avatarConfig || !avatarParts.length) {
      return [];
    }
    const partCategories = avatarParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];
    const urls = [];
    Object.entries(playerData.avatarConfig).forEach(([category, partId]) => {
      const part = partCategories[category]?.find(p => p.id === partId);
      if (part) urls.push(part.src);
    });
    // RENDER_ORDER에 따라 정렬하여 반환
    return urls.sort((a, b) => {
      const partA = avatarParts.find(p => p.src === a);
      const partB = avatarParts.find(p => p.src === b);
      return RENDER_ORDER.indexOf(partA?.category) - RENDER_ORDER.indexOf(partB?.category);
    });
  }, [playerData, avatarParts]);

  const fetchPointHistory = async () => {
    if (!playerData || !playerData.authUid) {
      console.error("플레이어 정보를 찾을 수 없거나 authUid가 없습니다.");
      return;
    }
    try {
      const historyQuery = query(
        collection(db, 'point_history'),
        where('playerId', '==', playerData.authUid),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(historyQuery);
      const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPointHistory(history);
    } catch (error) {
      console.error("포인트 내역 로딩 실패:", error);
    }
  };

  const handleOpenModal = () => {
    fetchPointHistory();
    setIsHistoryModalOpen(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      return alert('이름을 입력해주세요.');
    }
    try {
      await updatePlayerName(playerData.id, newName);
      alert('이름이 변경되었습니다.');
      setIsEditingName(false);
      fetchInitialData();
    } catch (error) {
      alert(`이름 변경 실패: ${error.message}`);
    }
  };

  if (!playerData) {
    return (
      <ProfileWrapper>
        <h2>선수 정보를 찾을 수 없습니다.</h2>
        <p>리그에 참가 신청을 했거나, 올바른 프로필 주소인지 확인해주세요.</p>
        <ButtonGroup>
          <StyledLink to="/">홈으로 돌아가기</StyledLink>
        </ButtonGroup>
      </ProfileWrapper>
    );
  }

  const isMyProfile = playerData.authUid === currentUser?.uid;
  // ▼▼▼ [추가] 관리자 여부 확인 ▼▼▼
  const isAdmin = loggedInPlayerData?.role === 'admin';


  return (
    <ProfileWrapper>
      <AvatarDisplay>
        <PartImage src={baseAvatar} alt="기본 아바타" />
        {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
      </AvatarDisplay>

      <UserNameContainer>
        {isEditingName ? (
          <>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', width: '200px', padding: '0.25rem' }}
            />
            <Button onClick={handleSaveName} style={{ backgroundColor: '#28a745', color: 'white' }}>저장</Button>
            <Button onClick={() => setIsEditingName(false)} style={{ backgroundColor: '#6c757d', color: 'white' }}>취소</Button>
          </>
        ) : (
          <>
            <UserName>{playerData.name}</UserName>
            {isMyProfile && (
              <Button onClick={() => setIsEditingName(true)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>✏️</Button>
            )}
          </>
        )}
      </UserNameContainer>

      {playerData.role && <UserRole>{playerData.role}</UserRole>}
      <PointDisplay>💰 {playerData.points?.toLocaleString() || 0} P</PointDisplay>

      <ButtonGroup>
        {/* ▼▼▼ [수정] isMyProfile 또는 isAdmin일 때 버튼 표시 ▼▼▼ */}
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