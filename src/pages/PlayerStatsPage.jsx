// src/pages/PlayerStatsPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useParams, useNavigate } from 'react-router-dom';
import { getPlayerSeasonStats } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const TotalStatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 3rem;
`;

const StatCard = styled.div`
    background-color: #fff;
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
`;

const StatValue = styled.p`
    font-size: 2.5rem;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    color: ${props => props.color || '#343a40'};
`;

const StatLabel = styled.p`
    margin: 0;
    font-size: 1rem;
    color: #6c757d;
    font-weight: 500;
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
`;

const SeasonList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const SeasonCard = styled.div`
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    overflow: hidden;
    border: 1px solid #dee2e6;
`;

const SeasonHeader = styled.div`
    padding: 1.25rem 1.5rem;
    cursor: pointer;
    background-color: #fff;
    font-weight: bold;
    font-size: 1.3rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const SeasonContent = styled.div`
    padding: ${props => props.$isOpen ? '1.5rem' : '0 1.5rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    display: flex;
    gap: 2rem;
`;

const SeasonStatsSummary = styled.div`
    flex-basis: 200px;
    flex-shrink: 0;
`;

const SummaryItem = styled.div`
    margin-bottom: 1rem;
    & > h4 {
        margin: 0 0 0.25rem 0;
        font-size: 1rem;
        color: #495057;
    }
    & > p {
        margin: 0;
        font-size: 1.2rem;
        font-weight: bold;
    }
`;

const TeamInfo = styled.div`
    flex-grow: 1;
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
  border: 3px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; object-fit: contain;
`;

const BadgeContainer = styled.div`
    margin-top: 0.25rem;
    font-size: 1.1rem;
    height: 22px; /* 뱃지가 없을 때도 높이 유지 */
`;

const MatchHistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
  border-top: 1px solid #dee2e6;
  padding-top: 1.5rem;
`;

const MatchHistoryItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: #fff;
  border-radius: 6px;
  font-size: 0.9rem;
`;

const MatchResult = styled.span`
    font-weight: bold;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    color: white;
    width: 2.5rem;
    text-align: center;
    background-color: ${props => {
        if (props.result === 'W') return '#28a745';
        if (props.result === 'L') return '#dc3545';
        return '#6c757d';
    }};
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

// --- Components ---

function SeasonStatsCard({ seasonData }) {
    const { season, team, stats, rank, isTopScorer } = seasonData;
    const { players, avatarParts, teams } = useLeagueStore();
    const { playerId } = useParams();
    const [isOpen, setIsOpen] = useState(false);

    const teammateAvatars = useMemo(() => {
        if (!team || !team.members) return [];
        return team.members.map(memberId => {
            const memberData = players.find(p => p.id === memberId);
            if (!memberData) return null;
            const urls = [baseAvatar];
            if (memberData.avatarConfig) {
                Object.values(memberData.avatarConfig).forEach(partId => {
                    const part = avatarParts.find(p => p.id === partId);
                    if (part) urls.push(part.src);
                });
            }
            return { id: memberId, name: memberData.name, urls };
        }).filter(Boolean);
    }, [team, players, avatarParts]);

    const seasonPoints = useMemo(() => {
        const VICTORY_REWARD = 50;
        const PARTICIPATION_REWARD = 15;
        return (stats.wins * VICTORY_REWARD) + ((stats.draws + stats.losses) * PARTICIPATION_REWARD);
    }, [stats]);

    return (
        <SeasonCard>
            <SeasonHeader onClick={() => setIsOpen(!isOpen)}>
                <span>{season.seasonName} (최종 {rank}위)</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </SeasonHeader>
            <SeasonContent $isOpen={isOpen}>
                <SeasonStatsSummary>
                    <SummaryItem>
                        <h4>최종 순위</h4>
                        <p>{rank}위</p>
                    </SummaryItem>
                    <SummaryItem>
                        <h4>시즌 성적 / 득점</h4>
                        <p>{stats.wins}승 {stats.draws}무 {stats.losses}패 / {stats.goals}골</p>
                    </SummaryItem>
                    <SummaryItem>
                        <h4>획득 포인트</h4>
                        <p>{seasonPoints} P</p>
                    </SummaryItem>
                </SeasonStatsSummary>
                <TeamInfo>
                    <h4>{team.teamName} 팀원</h4>
                    <TeammateGrid>
                        {teammateAvatars.map(mate => (
                            <TeammateCard key={mate.id}>
                                <AvatarDisplay>
                                    {mate.urls.map((url, index) => <PartImage key={`${url}-${index}`} src={url} />)}
                                </AvatarDisplay>
                                <span>{mate.name}</span>
                                <BadgeContainer>
                                    {team.captainId === mate.id && <span title="주장">Ⓒ </span>}
                                    {isTopScorer && playerId === mate.id && <span title="득점왕">⚽</span>}
                                </BadgeContainer>
                            </TeammateCard>
                        ))}
                    </TeammateGrid>
                </TeamInfo>
            </SeasonContent>
        </SeasonCard>
    );
}


function PlayerStatsPage() {
    const { players } = useLeagueStore();
    const { playerId } = useParams();
    const navigate = useNavigate();
    const [allSeasonStats, setAllSeasonStats] = useState([]);
    const [loading, setLoading] = useState(true);

    const playerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const stats = await getPlayerSeasonStats(playerId);
            setAllSeasonStats(stats);
            setLoading(false);
        };
        fetchStats();
    }, [playerId]);

    const totalStats = useMemo(() => {
        const totals = { championships: 0, wins: 0, played: 0, goals: 0 };
        allSeasonStats.forEach(seasonData => {
            totals.wins += seasonData.stats.wins;
            totals.played += seasonData.stats.played;
            totals.goals += seasonData.stats.goals;
            if (seasonData.rank === 1) {
                totals.championships++;
            }
        });
        return totals;
    }, [allSeasonStats]);

    if (loading) {
        return <Wrapper><Title>선수 기록을 불러오는 중...</Title></Wrapper>;
    }

    if (!playerData) {
        return <Wrapper><Title>선수 정보를 찾을 수 없습니다.</Title></Wrapper>;
    }

    return (
        <Wrapper>
            <Title>{playerData.name} 선수의 리그 기록</Title>
            <TotalStatsGrid>
                <StatCard>
                    <StatValue color="#ffc107">🏆 {totalStats.championships}</StatValue>
                    <StatLabel>통산 우승</StatLabel>
                </StatCard>
                <StatCard>
                    <StatValue color="#007bff">🏅 {totalStats.wins}</StatValue>
                    <StatLabel>통산 승리</StatLabel>
                </StatCard>
                <StatCard>
                    <StatValue>⚔️ {totalStats.played}</StatValue>
                    <StatLabel>통산 출전</StatLabel>
                </StatCard>
                <StatCard>
                    <StatValue color="#28a745">⚽ {totalStats.goals}</StatValue>
                    <StatLabel>통산 득점</StatLabel>
                </StatCard>
            </TotalStatsGrid>

            <SectionTitle>시즌별 기록</SectionTitle>
            <SeasonList>
                {allSeasonStats.length > 0 ? (
                    allSeasonStats.map((seasonData) => (
                        <SeasonStatsCard key={seasonData.season.id} seasonData={seasonData} />
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