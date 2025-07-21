// src/pages/WinnerPage.jsx

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import confetti from 'canvas-confetti';
import { useLeagueStore } from '../store/leagueStore';
import baseAvatar from '../assets/base-avatar.png';
import { bounce } from '../styles/GlobalStyle'; // bounce 애니메이션 import

const AnimatedAvatar = styled.div`
  width: 150px; /* 여러 명을 표시하기 위해 크기를 살짝 줄입니다. */
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  position: relative;
  border: 4px solid gold;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.6);
  overflow: hidden;
  animation: ${bounce} 1.5s infinite;
  
  /* 팀원 이름 표시 */
  & > span {
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: bold;
  }
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const WinnerWrapper = styled.div`
  text-align: center;
  padding: 2rem;
`;

const Title = styled.h1`
  font-size: 3rem;
  color: #ffc107;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
`;

const TeamName = styled.h2`
  font-size: 2rem;
  margin-top: 0;
`;

// 여러 아바타를 가로로 정렬하기 위한 컨테이너
const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin-top: 3rem;
  flex-wrap: wrap;
`;

const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];

// 아바타를 렌더링하는 부분을 별도의 컴포넌트로 분리
function PlayerAvatar({ player }) {
    const { avatarParts } = useLeagueStore();

    const sortedPartUrls = useMemo(() => {
        if (!player?.avatarConfig || !avatarParts.length) return [];
        const partCategories = avatarParts.reduce((acc, part) => {
            if (!acc[part.category]) acc[part.category] = [];
            acc[part.category].push(part);
            return acc;
        }, {});
        const urls = [];
        RENDER_ORDER.forEach(category => {
            const partId = player.avatarConfig[category];
            if (partId) {
                const part = partCategories[category]?.find(p => p.id === partId);
                if (part) urls.push(part.src);
            }
        });
        return urls;
    }, [player, avatarParts]);

    return (
        <AnimatedAvatar>
            <PartImage src={baseAvatar} alt="기본 아바타" />
            {sortedPartUrls.map(src => <PartImage key={src} src={src} />)}
            <span>{player.name}</span>
        </AnimatedAvatar>
    );
}


function WinnerPage() {
    const { players, teams } = useLeagueStore();

    // 실제로는 우승팀 ID를 받아와야 합니다.
    // 여기서는 임시로 첫 번째 팀을 우승팀으로 가정합니다.
    const winningTeam = teams[0];
    const winningPlayers = useMemo(() => {
        if (!winningTeam) return [];
        return winningTeam.members.map(memberId => players.find(p => p.id === memberId)).filter(Boolean);
    }, [winningTeam, players]);

    useEffect(() => {
        // 재사용할 수 있도록 꽃가루 발사 로직을 함수로 만듭니다.
        const fireConfetti = () => {
            confetti({
                particleCount: 1000,
                spread: 1500,
                origin: { y: 0.4 },
            });
        };

        // 1. 페이지가 보이자마자 즉시 한 번 발사합니다.
        fireConfetti();

        // 2. 그 후 3초마다 반복해서 발사하도록 설정합니다.
        const interval = setInterval(fireConfetti, 4000);

        // 3. 페이지를 벗어날 때 반복을 멈추도록 정리합니다. (메모리 누수 방지)
        return () => clearInterval(interval);
    }, []);


    if (!winningTeam) {
        return <WinnerWrapper><h2>우승팀 정보를 불러오는 중입니다...</h2></WinnerWrapper>;
    }

    return (
        <WinnerWrapper>
            <Title>🎉 우승을 축하합니다! 🎉</Title>
            <TeamName>{winningTeam.teamName}</TeamName>

            <AvatarContainer>
                {winningPlayers.map(player => <PlayerAvatar key={player.id} player={player} />)}
            </AvatarContainer>
        </WinnerWrapper>
    );
}

export default WinnerPage;