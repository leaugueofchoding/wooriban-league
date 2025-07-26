// src/pages/PlayerStatsPage.jsx

import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useParams, useNavigate } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const SeasonList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
`;

const SeasonCard = styled.div`
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    overflow: hidden;
`;

const SeasonHeader = styled.div`
    padding: 1.5rem;
    cursor: pointer;
    background-color: #e9ecef;
    font-weight: bold;
    font-size: 1.3rem;
    display: flex;
    justify-content: space-between;
`;

const SeasonContent = styled.div`
    padding: ${props => props.$isOpen ? '1.5rem' : '0 1.5rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
    background-color: #fff;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
`;

const StatValue = styled.p`
    font-size: 2rem;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    color: ${props => props.color || '#343a40'};
`;

const StatLabel = styled.p`
    margin: 0;
    font-size: 0.9rem;
    color: #6c757d;
`;

const TeamInfo = styled.div`
    margin-top: 1rem;
`;

const TeamName = styled.h3`
    margin-bottom: 1rem;
`;

const TeammateGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 1rem;
`;

const TeammateCard = styled.div`
    text-align: center;
`;

const AvatarDisplay = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #e9ecef;
  margin: 0 auto 0.5rem;
  position: relative;
  overflow: hidden;
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; object-fit: contain;
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

function SeasonStatsCard({ season, playerStats }) {
    const [isOpen, setIsOpen] = useState(true);
    const { players, avatarParts } = useLeagueStore();

    const team = playerStats.team;
    const stats = playerStats.stats;

    const teammateAvatars = useMemo(() => {
        if (!team || !team.members) return [];
        return team.members.map(memberId => {
            const memberData = players.find(p => p.id === memberId);
            if (!memberData) return { id: memberId, name: '알수없음', urls: [baseAvatar] };

            const urls = [baseAvatar];
            if (memberData.avatarConfig) {
                Object.values(memberData.avatarConfig).forEach(partId => {
                    const part = avatarParts.find(p => p.id === partId);
                    if (part) urls.push(part.src);
                });
            }
            return { id: memberId, name: memberData.name, urls };
        });
    }, [team, players, avatarParts]);

    return (
        <SeasonCard>
            <SeasonHeader onClick={() => setIsOpen(!isOpen)}>
                <span>{season.seasonName}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </SeasonHeader>
            <SeasonContent $isOpen={isOpen}>
                <StatsGrid>
                    <StatCard>
                        <StatValue>{stats.played}</StatValue>
                        <StatLabel>총 출전</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatValue color="blue">{stats.wins}</StatValue>
                        <StatLabel>팀 승리</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatValue color="gray">{stats.draws}</StatValue>
                        <StatLabel>팀 무승부</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatValue color="red">{stats.losses}</StatValue>
                        <StatLabel>팀 패배</StatLabel>
                    </StatCard>
                </StatsGrid>
                <TeamInfo>
                    <TeamName>소속팀: {team ? team.teamName : '없음'}</TeamName>
                    <TeammateGrid>
                        {teammateAvatars.map(mate => (
                            <TeammateCard key={mate.id}>
                                <AvatarDisplay>
                                    {mate.urls.map(url => <PartImage key={url} src={url} />)}
                                </AvatarDisplay>
                                <span>{mate.name}</span>
                            </TeammateCard>
                        ))}
                    </TeammateGrid>
                </TeamInfo>
            </SeasonContent>
        </SeasonCard>
    );
}


function PlayerStatsPage() {
    const { players, matches, teams, seasons } = useLeagueStore();
    const { playerId } = useParams();
    const navigate = useNavigate();

    const playerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

    const allSeasonStats = useMemo(() => {
        // [수정] seasons 배열이 비어있을 경우를 대비한 방어 코드
        if (!playerData || !seasons || seasons.length === 0) return [];

        return seasons.map(season => {
            const myTeam = teams.find(team => team.seasonId === season.id && team.members.includes(playerData.id));
            if (!myTeam) return null;

            const seasonMatches = matches.filter(match =>
                match.seasonId === season.id &&
                match.status === '완료' &&
                (match.teamA_id === myTeam.id || match.teamB_id === myTeam.id)
            );

            let wins = 0, draws = 0, losses = 0;
            seasonMatches.forEach(match => {
                const isTeamA = match.teamA_id === myTeam.id;
                const myScore = isTeamA ? match.teamA_score : match.teamB_score;
                const opponentScore = isTeamA ? match.teamB_score : match.teamA_score;
                if (myScore > opponentScore) wins++;
                else if (myScore < opponentScore) losses++;
                else draws++;
            });

            return {
                season,
                playerStats: {
                    team: myTeam,
                    stats: { played: seasonMatches.length, wins, draws, losses }
                }
            };
        }).filter(Boolean);

    }, [playerData, seasons, teams, matches]);

    if (!playerData) {
        return <Wrapper><Title>선수 정보를 찾을 수 없습니다.</Title></Wrapper>;
    }

    return (
        <Wrapper>
            <Title>{playerData.name} 선수의 리그 기록</Title>
            <SeasonList>
                {allSeasonStats.length > 0 ? (
                    allSeasonStats.map(({ season, playerStats }) => (
                        <SeasonStatsCard key={season.id} season={season} playerStats={playerStats} />
                    ))
                ) : (
                    <p>참가한 시즌 기록이 없습니다.</p>
                )}
            </SeasonList>
            <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
        </Wrapper>
    );
}

export default PlayerStatsPage;