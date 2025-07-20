// src/pages/ProfilePage.jsx

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png'; // 기본 아바타 import

// 아바타 표시 컴포넌트 스타일 수정
const AvatarDisplay = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 1rem;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: relative; // 겹치기를 위해 position: relative 추가
  overflow: hidden;
`;

// 아바타 파츠 이미지 스타일 (편집 페이지와 동일)
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

  &:hover {
    background-color: #f0f0f0;
  }
`;

const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];


function ProfilePage() {
    const { players, avatarParts } = useLeagueStore(); // avatarParts 추가
    const currentUser = auth.currentUser;
    const { playerId } = useParams();
    const navigate = useNavigate();

    const playerData = useMemo(() => {
        const targetId = playerId || currentUser?.uid;
        // playerId가 있으면 그걸로 찾고, 없으면 현재 로그인한 유저의 authUid로 찾습니다.
        return players.find(p => p.id === targetId || p.authUid === targetId);
    }, [players, currentUser, playerId]);

    // 선택된 파츠의 URL 목록을 계산하는 로직 추가
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
                {/* 이모지 대신 아바타 이미지 레이어를 렌더링 */}
                <PartImage src={baseAvatar} alt="기본 아바타" />
                {selectedPartUrls.map(src => <PartImage key={src} src={src} />)}
            </AvatarDisplay>

            <UserName>{playerData.name}</UserName>
            {playerData.role && <UserRole>{playerData.role}</UserRole>}
            <PointDisplay>💰 {playerData.points || 0} P</PointDisplay>

            <ButtonGroup>
                {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
                <Button onClick={() => navigate(-1)}>나가기</Button>
            </ButtonGroup>
        </ProfileWrapper>
    );
}

export default ProfilePage;