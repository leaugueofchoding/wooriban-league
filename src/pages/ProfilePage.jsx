import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth } from '../api/firebase.js';
import { useParams, Link, useNavigate } from 'react-router-dom';

const ProfileWrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  text-align: center;
`;

const AvatarDisplay = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 1rem;
  border: 4px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
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

function ProfilePage() {
    const { players } = useLeagueStore();
    const currentUser = auth.currentUser;
    const { playerId } = useParams();
    const navigate = useNavigate(); // useNavigate 훅을 사용합니다.

    const myPlayerData = useMemo(() => {
        if (playerId) {
            return players.find(p => p.id === playerId);
        } else {
            return players.find(p => p.authUid === currentUser?.uid);
        }
    }, [players, currentUser, playerId]);

    if (!myPlayerData) {
        return (
            <ProfileWrapper>
                <h2>선수 정보를 찾을 수 없습니다.</h2>
                <p>리그에 참가 신청을 했거나, 올바른 프로필 주소인지 확인해주세요.</p>
                <ButtonGroup>
                    {/* 여기는 에러 페이지이므로 '홈으로'가 적합합니다. */}
                    <StyledLink to="/">홈으로 돌아가기</StyledLink>
                </ButtonGroup>
            </ProfileWrapper>
        );
    }

    const isMyProfile = myPlayerData.authUid === currentUser?.uid;

    return (
        <ProfileWrapper>
            <AvatarDisplay>
                🧑‍💻
            </AvatarDisplay>
            <UserName>{myPlayerData.name}</UserName>
            {myPlayerData.role && <UserRole>{myPlayerData.role}</UserRole>}
            <PointDisplay>💰 {myPlayerData.points || 0} P</PointDisplay>

            <ButtonGroup>
                {isMyProfile && <StyledLink to="/profile/edit">아바타 편집</StyledLink>}
                {/* '나가기' 버튼이 Link가 아닌 일반 button으로 변경되고, onClick 이벤트로 뒤로 가기(-1)를 실행합니다. */}
                <Button onClick={() => navigate(-1)}>나가기</Button>
            </ButtonGroup>
        </ProfileWrapper>
    );
}

export default ProfilePage;