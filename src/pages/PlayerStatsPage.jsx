// src/pages/PlayerStatsPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
    height: 22px; 
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
`;

const ExitButton = styled.button`
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

const TabContainer = styled.div`
  display: flex;
  margin-top: 3rem;
  border-bottom: 2px solid #dee2e6;
`;

const TabButton = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  background: none;
  cursor: pointer;
  color: ${props => props.$active ? '#007bff' : '#6c757d'};
  border-bottom: ${props => props.$active ? '3px solid #007bff' : '3px solid transparent'};
  margin-bottom: -2px;
`;

const PlayerRankingSection = styled.div`
    margin-top: 1.5rem;
`;

const PlayerRankItem = styled(Link)`
    display: grid;
    grid-template-columns: 40px 1fr 80px 80px 80px;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
    text-decoration: none;
    color: inherit;
    transition: background-color 0.2s;

    &:hover {
        background-color: #f8f9fa;
    }
`;

const RankHeader = styled.div`
    display: grid;
    grid-template-columns: 40px 1fr 80px 80px 80px;
    padding: 0.5rem 0.75rem;
    font-weight: bold;
    color: #495057;
    border-top: 2px solid #343a40;
    border-bottom: 1px solid #dee2e6;
`;

const HeaderCell = styled.div`
    text-align: center;
    cursor: pointer;
    user-select: none;
    &:first-child { text-align: left; }
`;


function SeasonStatsCard({ seasonData }) {
    const { players, avatarParts } = useLeagueStore();
    const { playerId } = useParams();
    const [isOpen, setIsOpen] = useState(false);

    // ▼▼▼ [수정] 액세서리 중복 착용을 지원하는 렌더링 로직으로 교체 ▼▼▼
    const teammateAvatars = useMemo(() => {
        if (!seasonData.team || !seasonData.team.members) return [];
        return seasonData.team.members.map(memberId => {
            const memberData = players.find(p => p.id === memberId);
            if (!memberData) return null;

            const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
            const urls = [baseAvatar];
            const config = memberData.avatarConfig || {};

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

            return { id: memberId, name: memberData.name, urls: Array.from(new Set(urls)) };
        }).filter(Boolean);
    }, [seasonData.team, players, avatarParts]);
    // ▲▲▲ 여기까지 수정 ▲▲▲

    const seasonPoints = useMemo(() => {
        const VICTORY_REWARD = 50;
        const PARTICIPATION_REWARD = 15;
        return (seasonData.stats.wins * VICTORY_REWARD) + ((seasonData.stats.draws + seasonData.stats.losses) * PARTICIPATION_REWARD);
    }, [seasonData.stats]);

    const rankText = seasonData.season.status === 'completed' ? '최종' : '현재';

    return (
        <SeasonCard>
            <SeasonHeader onClick={() => setIsOpen(!isOpen)}>
                <span>{seasonData.season.seasonName} ({rankText} {seasonData.rank}위)</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </SeasonHeader>
            <SeasonContent $isOpen={isOpen}>
                <SeasonStatsSummary>
                    <SummaryItem><h4>{rankText} 순위</h4><p>{seasonData.rank}위</p></SummaryItem>
                    <SummaryItem><h4>시즌 성적 / 득점</h4><p>{seasonData.stats.wins}승 {seasonData.stats.draws}무 {seasonData.stats.losses}패 / {seasonData.stats.goals}골</p></SummaryItem>
                    <SummaryItem><h4>획득 포인트</h4><p>{seasonPoints} P</p></SummaryItem>
                </SeasonStatsSummary>
                <TeamInfo>
                    <h4>{seasonData.team.teamName} 팀원</h4>
                    <TeammateGrid>
                        {teammateAvatars.map(mate => (
                            <TeammateCard key={mate.id}>
                                <AvatarDisplay>
                                    {mate.urls.map((url, index) => <PartImage key={`${url}-${index}`} src={url} />)}
                                </AvatarDisplay>
                                <span>{mate.name}</span>
                                <BadgeContainer>
                                    {seasonData.team.captainId === mate.id && <span title="주장">Ⓒ </span>}
                                    {seasonData.isTopScorer && playerId === mate.id && <span title="득점왕">⚽</span>}
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
    const [allPlayerTotals, setAllPlayerTotals] = useState([]);
    const [activeTab, setActiveTab] = useState('seasons');
    const [sortConfig, setSortConfig] = useState({ key: 'championships', direction: 'desc' });

    const playerData = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

    useEffect(() => {
        const fetchAllStats = async () => {
            setLoading(true);
            const allPlayerStatsPromises = players.map(p => getPlayerSeasonStats(p.id));
            const allStatsResults = await Promise.all(allPlayerStatsPromises);

            const totals = allStatsResults.map((playerSeasons, index) => {
                const player = players[index];
                const playerTotals = { championships: 0, wins: 0, played: 0, goals: 0 };
                playerSeasons.forEach(seasonData => {
                    playerTotals.wins += seasonData.stats.wins;
                    playerTotals.played += seasonData.stats.played;
                    playerTotals.goals += seasonData.stats.goals;
                    if (seasonData.rank === 1) playerTotals.championships++;
                });
                return { ...player, ...playerTotals };
            });

            setAllPlayerTotals(totals);
            const myStats = allStatsResults[players.findIndex(p => p.id === playerId)] || [];
            setAllSeasonStats(myStats);
            setLoading(false);
        };
        if (players.length > 0) fetchAllStats();
    }, [players, playerId]);

    const sortedPlayers = useMemo(() => {
        return [...allPlayerTotals].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;

            if (b.championships !== a.championships) return b.championships - a.championships;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.goals - a.goals;
        });
    }, [allPlayerTotals, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const myTotalStats = useMemo(() => {
        return allPlayerTotals.find(p => p.id === playerId) || { championships: 0, wins: 0, played: 0, goals: 0 };
    }, [allPlayerTotals, playerId]);

    if (loading) return <Wrapper><Title>선수 기록을 불러오는 중...</Title></Wrapper>;
    if (!playerData) return <Wrapper><Title>선수 정보를 찾을 수 없습니다.</Title></Wrapper>;

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
    };

    return (
        <Wrapper>
            <Title>{playerData.name} 선수의 리그 기록</Title>
            <TotalStatsGrid>
                <StatCard><StatValue color="#ffc107">🏆 {myTotalStats.championships}</StatValue><StatLabel>통산 우승</StatLabel></StatCard>
                <StatCard><StatValue color="#007bff">🏅 {myTotalStats.wins}</StatValue><StatLabel>통산 승리</StatLabel></StatCard>
                <StatCard><StatValue>⚔️ {myTotalStats.played}</StatValue><StatLabel>통산 출전</StatLabel></StatCard>
                <StatCard><StatValue color="#28a745">⚽ {myTotalStats.goals}</StatValue><StatLabel>통산 득점</StatLabel></StatCard>
            </TotalStatsGrid>

            <TabContainer>
                <TabButton $active={activeTab === 'seasons'} onClick={() => setActiveTab('seasons')}>시즌별 기록</TabButton>
                <TabButton $active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')}>전체 선수 랭킹</TabButton>
            </TabContainer>

            {activeTab === 'ranking' && (
                <PlayerRankingSection>
                    <RankHeader>
                        <HeaderCell>순위</HeaderCell>
                        <HeaderCell style={{ textAlign: 'left' }}>선수</HeaderCell>
                        <HeaderCell onClick={() => handleSort('championships')}>우승{getSortIndicator('championships')}</HeaderCell>
                        <HeaderCell onClick={() => handleSort('wins')}>승리{getSortIndicator('wins')}</HeaderCell>
                        <HeaderCell onClick={() => handleSort('goals')}>득점{getSortIndicator('goals')}</HeaderCell>
                    </RankHeader>
                    {sortedPlayers.map((p, index) => (
                        <PlayerRankItem key={p.id} to={`/profile/${p.id}`}>
                            <span>{index + 1}</span>
                            <span>{p.name}</span>
                            <span style={{ textAlign: 'center' }}>{p.championships}</span>
                            <span style={{ textAlign: 'center' }}>{p.wins}</span>
                            <span style={{ textAlign: 'center' }}>{p.goals}</span>
                        </PlayerRankItem>
                    ))}
                </PlayerRankingSection>
            )}

            {activeTab === 'seasons' && (
                <SeasonList style={{ marginTop: '1.5rem' }}>
                    {allSeasonStats.length > 0 ? (
                        allSeasonStats.map((seasonData) => (
                            <SeasonStatsCard key={seasonData.season.id} seasonData={seasonData} />
                        ))
                    ) : (
                        <p>참가한 시즌 기록이 없습니다.</p>
                    )}
                </SeasonList>
            )}

            <ButtonContainer>
                <ExitButton onClick={() => navigate('/')}>홈 화면으로</ExitButton>
                <ExitButton onClick={() => navigate(-1)}>나가기</ExitButton>
            </ButtonContainer>
        </Wrapper>
    );
}

export default PlayerStatsPage;