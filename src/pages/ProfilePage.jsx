// src/pages/ProfilePage.jsx

import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db } from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import PointHistoryModal from '../components/PointHistoryModal';

// --- 스타일 컴포넌트 (이전과 동일) ---
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

  &:hover {
    background-color: #f0f0f0;
  }
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

  &:hover {
    background-color: #f0f0f0;
  }
`;
// --- 스타일 컴포넌트 끝 ---

function ProfilePage() {
  const { players, avatarParts } = useLeagueStore();
  const currentUser = auth.currentUser;
  const { playerId } = useParams();
  const navigate = useNavigate();

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState([]);

  const playerData = useMemo(() => {
    const targetId = playerId || currentUser?.uid;
    return players.find(p => p.id === targetId || p.authUid === targetId);
  }, [players, currentUser, playerId]);

  const selectedPartUrls = useMemo(() => {
    if (!playerData?.avatarConfig || !avatarParts.length) return [];
    const partCategories = avatarParts.reduce((acc, part) => {
      if (!acc[part.category]) acc[part.category] = [];
      acc[part.category].push(part);
      return acc;
    }, {});
    return Object.entries(playerData.avatarConfig).map(([category, partId]) => {
      const part = partCategories[category]?.find(p => p.id === partId);
      return part?.src;
    }).filter(Boolean);
  }, [playerData, avatarParts]);

  const fetchPointHistory = async () => {
    // 👇 **[수정됨] playerData와 playerData.authUid가 모두 존재하는지 확인** 👇
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
      console.error("포인트 내역 로딩 실패:", error); // 기존 console.log를 error로 변경
      // Firebase 색인 오류는 콘솔에 이미 링크가 제공되므로 alert는 제거합니다.
    }
  };

  const handleOpenModal = () => {
    fetchPointHistory();
    setIsHistoryModalOpen(true);
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

  return (
    <ProfileWrapper>
      <AvatarDisplay>
        <PartImage src={baseAvatar} alt="기본 아바타" />
        {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
      </AvatarDisplay>

      <UserName>{playerData.name}</UserName>
      {playerData.role && <UserRole>{playerData.role}</UserRole>}
      <PointDisplay>💰 {playerData.points || 0} P</PointDisplay>

      <ButtonGroup>
        {isMyProfile && (
          <Button onClick={handleOpenModal}>포인트 내역</Button>
        )}
        {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
        <Button onClick={() => navigate(-1)}>나가기</Button>
      </ButtonGroup>

      <PointHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={pointHistory}
      />
    </ProfileWrapper>
  );
}

export default ProfilePage;