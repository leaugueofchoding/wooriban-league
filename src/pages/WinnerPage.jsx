// src/pages/WinnerPage.jsx

import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import confetti from 'canvas-confetti';
import { useLeagueStore } from '../store/leagueStore';
import baseAvatar from '../assets/base-avatar.png';
import { bounce } from '../styles/GlobalStyle';
import { emblemMap } from '../utils/emblemMap';
import defaultEmblem from '../assets/default-emblem.png';

const WinnerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  background-color: #f8f9fa;
  text-align: center;
  padding: 2rem;
  box-sizing: border-box;
`;

const Title = styled.h1`
  font-size: 3rem;
  color: #ffc107;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  margin-bottom: 1rem;
`;

const TeamInfoContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const TeamEmblem = styled.img`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: 5px solid gold;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.6);
`;

const TeamName = styled.h2`
  font-size: 2.5rem;
  margin-top: 0;
`;

const AvatarContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start; /* 아이템 정렬 기준 변경 */
  gap: 2rem;
  margin-top: 3rem;
  flex-wrap: wrap;
`;

// ▼▼▼ [추가] 아바타와 이름을 묶는 컨테이너 ▼▼▼
const PlayerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem; /* 아바타와 이름 사이 간격 */
`;

const AnimatedAvatar = styled.div`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background-color: #e9ecef;
  position: relative;
  border: 4px solid gold;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.6);
  overflow: hidden;
  animation: ${bounce} 1.5s infinite;
  animation-delay: ${props => props.delay || 0}s;
`;

const PartImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

// ▼▼▼ [추가] 이름 스타일 ▼▼▼
const PlayerName = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
`;

const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth', 'accessory'];

// ▼▼▼ [수정] PlayerAvatar 컴포넌트 구조 변경 ▼▼▼
function PlayerAvatar({ player, delay }) {
    const { avatarParts } = useLeagueStore();

    const sortedPartUrls = useMemo(() => {
        if (!player?.avatarConfig || !avatarParts.length) return [baseAvatar];

        const urls = [baseAvatar];
        const config = player.avatarConfig;

        RENDER_ORDER.forEach(category => {
            const partId = config[category];
            if (partId) {
                const part = avatarParts.find(p => p.id === partId);
                if (part) urls.push(part.src);
            }
        });

        if (config.accessories) {
            Object.values(config.accessories).forEach(partId => {
                const part = avatarParts.find(p => p.id === partId);
                if (part) urls.push(part.src);
            });
        }

        return Array.from(new Set(urls));
    }, [player, avatarParts]);

    return (
        <PlayerWrapper>
            <AnimatedAvatar delay={delay}>
                {sortedPartUrls.map(src => <PartImage key={src} src={src} />)}
            </AnimatedAvatar>
            <PlayerName>{player.name}</PlayerName>
        </PlayerWrapper>
    );
}


function WinnerPage() {
    const { players, teams, standingsData } = useLeagueStore();

    const winningTeamData = useMemo(() => {
        const standings = standingsData();
        if (!standings || standings.length === 0) return null;
        return standings[0];
    }, [standingsData]);

    const winningPlayers = useMemo(() => {
        if (!winningTeamData) return [];
        const winningTeam = teams.find(t => t.id === winningTeamData.id);
        if (!winningTeam) return [];
        return winningTeam.members.map(memberId => players.find(p => p.id === memberId)).filter(Boolean);
    }, [winningTeamData, teams, players]);

    useEffect(() => {
        const fireConfetti = () => {
            confetti({
                particleCount: 200,
                spread: 120,
                origin: { y: 0.6 },
            });
        };

        fireConfetti();
        const interval = setInterval(fireConfetti, 3000);
        return () => clearInterval(interval);
    }, []);


    if (!winningTeamData) {
        return <WinnerWrapper><h2>우승팀 정보를 불러오는 중입니다...</h2></WinnerWrapper>;
    }

    return (
        <WinnerWrapper>
            <Title>🎉 시즌 우승을 축하합니다! 🎉</Title>
            <TeamInfoContainer>
                <TeamEmblem src={emblemMap[winningTeamData.emblemId] || winningTeamData.emblemUrl || defaultEmblem} alt="우승팀 엠블럼" />
                <TeamName>{winningTeamData.teamName}</TeamName>
            </TeamInfoContainer>

            <AvatarContainer>
                {winningPlayers.map((player, index) => <PlayerAvatar key={player.id} player={player} delay={index * 0.15} />)}
            </AvatarContainer>
        </WinnerWrapper>
    );
}

export default WinnerPage;