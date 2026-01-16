// src/pages/PlayerStatsPage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPlayerSeasonStats } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';

// --- Animations ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 4rem 1rem;
  font-family: 'Pretendard', sans-serif;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const GlassWrapper = styled.div`
  width: 100%;
  max-width: 900px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 2.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.6);
  animation: ${fadeIn} 0.5s ease-out;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;

  h1 {
    font-size: 2rem;
    font-weight: 900;
    color: #343a40;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: #868e96;
    font-size: 1rem;
  }
`;

// 스탯 그리드
const TotalStatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.2rem;
  margin-bottom: 3rem;

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatCard = styled.div`
  background: white;
  padding: 1.5rem 1rem;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.03);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.08);
  }
`;

const StatIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const StatValue = styled.div`
  font-size: 2.2rem;
  font-weight: 800;
  color: ${props => props.color || '#343a40'};
  margin-bottom: 0.2rem;
`;

const StatLabel = styled.div`
  font-size: 0.9rem;
  color: #868e96;
  font-weight: 700;
`;

// 탭 버튼
const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f1f3f5;
`;

const TabButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 30px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.$active ? css`
    background-color: #339af0;
    color: white;
    box-shadow: 0 4px 12px rgba(51, 154, 240, 0.3);
    transform: translateY(-2px);
  ` : css`
    background-color: #f8f9fa;
    color: #adb5bd;
    &:hover {
      background-color: #e9ecef;
      color: #868e96;
    }
  `}
`;

// 시즌 리스트 (아코디언)
const SeasonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SeasonCardContainer = styled.div`
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  border: 1px solid #f1f3f5;
  transition: all 0.3s;
`;

const SeasonHeader = styled.div`
  padding: 1.2rem 1.5rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${props => props.$isOpen ? '#f8f9fa' : 'white'};
  transition: background 0.2s;

  &:hover {
    background: #f8f9fa;
  }

  .title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #343a40;
  }
  
  .rank {
    font-size: 0.9rem;
    font-weight: 700;
    color: #495057;
    background: #e9ecef;
    padding: 4px 10px;
    border-radius: 10px;
  }
`;

const SeasonContent = styled.div`
  max-height: ${props => props.$isOpen ? '800px' : '0'};
  opacity: ${props => props.$isOpen ? 1 : 0};
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-top: ${props => props.$isOpen ? '1px solid #f1f3f5' : 'none'};
  padding: ${props => props.$isOpen ? '1.5rem' : '0 1.5rem'};
`;

const SeasonInfoGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const SummarySection = styled.div`
  flex: 1;
  min-width: 200px;
`;

const SummaryItem = styled.div`
  margin-bottom: 1rem;
  h4 {
    font-size: 0.9rem;
    color: #868e96;
    margin: 0 0 0.3rem 0;
  }
  p {
    font-size: 1.1rem;
    font-weight: 800;
    color: #343a40;
    margin: 0;
  }
`;

const TeamSection = styled.div`
  flex: 2;
`;

const TeammateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 1rem;
  margin-top: 0.8rem;
`;

const TeammateCard = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  
  &:hover .avatar {
    transform: scale(1.05);
    border-color: #339af0;
  }
`;

const AvatarCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f1f3f5;
  border: 2px solid white;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  overflow: hidden;
  position: relative;
  margin-bottom: 0.4rem;
  transition: all 0.2s;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    top: 0; left: 0;
  }
`;

const MateName = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
`;

// 랭킹 리스트
const RankHeader = styled.div`
  display: grid;
  grid-template-columns: 50px 1fr 80px 80px 80px;
  padding: 0.8rem 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  font-weight: 700;
  color: #868e96;
  font-size: 0.9rem;
  margin-bottom: 0.8rem;
  text-align: center;
  
  .left { text-align: left; }
  .sortable { cursor: pointer; &:hover { color: #339af0; } }
`;

const RankItem = styled(Link)`
  display: grid;
  grid-template-columns: 50px 1fr 80px 80px 80px;
  padding: 1rem;
  align-items: center;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid #f1f3f5;
  transition: background 0.2s;
  text-align: center;

  &:hover {
    background-color: #f8f9fa;
    border-radius: 12px;
  }

  .rank { font-weight: 800; color: #339af0; }
  .name-col { display: flex; align-items: center; gap: 0.5rem; text-align: left; }
  .name { font-weight: 700; color: #343a40; }
  .stat { font-weight: 600; color: #495057; }
`;

const TitleBadge = styled.span`
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 6px;
  background: white;
  border: 1px solid #dee2e6;
  color: #868e96;
  white-space: nowrap;
`;

// 하단 버튼
const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
`;

const ActionButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: 800;
  color: ${props => props.$primary ? 'white' : '#495057'};
  background: ${props => props.$primary ? '#339af0' : '#f1f3f5'};
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
    filter: brightness(0.95);
  }
`;

// --- Components ---

function SeasonStatsCard({ seasonData }) {
    const { players, avatarParts } = useLeagueStore();
    const { playerId } = useParams();
    const [isOpen, setIsOpen] = useState(false);

    const teammateAvatars = useMemo(() => {
        if (!seasonData.team || !seasonData.team.members) return [];
        return seasonData.team.members.map(memberId => {
            const memberData = players.find(p => p.id === memberId);
            if (!memberData) return null;

            const memorialConfig = seasonData.memorialsMap?.get(memberId);
            const config = memorialConfig || memberData.avatarConfig || {};

            const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
            const urls = [baseAvatar];

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
    }, [seasonData, players, avatarParts]);

    const seasonPoints = useMemo(() => {
        const VICTORY_REWARD = 50;
        const PARTICIPATION_REWARD = 15;
        return (seasonData.stats.wins * VICTORY_REWARD) + ((seasonData.stats.draws + seasonData.stats.losses) * PARTICIPATION_REWARD);
    }, [seasonData.stats]);

    const rankText = seasonData.season.status === 'completed' ? '최종' : '현재';

    return (
        <SeasonCardContainer>
            <SeasonHeader onClick={() => setIsOpen(!isOpen)} $isOpen={isOpen}>
                <div className="title">{seasonData.season.seasonName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="rank">{rankText} {seasonData.rank}위</span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                </div>
            </SeasonHeader>
            <SeasonContent $isOpen={isOpen}>
                <SeasonInfoGrid>
                    <SummarySection>
                        <SummaryItem><h4>{rankText} 순위</h4><p>{seasonData.rank}위</p></SummaryItem>
                        <SummaryItem><h4>시즌 성적 / 득점</h4><p>{seasonData.stats.wins}승 {seasonData.stats.draws}무 {seasonData.stats.losses}패 / {seasonData.stats.goals}골</p></SummaryItem>
                        <SummaryItem><h4>획득 포인트</h4><p>{seasonPoints} P</p></SummaryItem>
                    </SummarySection>
                    <TeamSection>
                        <h4 style={{ fontSize: '0.9rem', color: '#868e96', margin: '0' }}>함께한 팀원 ({seasonData.team.teamName})</h4>
                        <TeammateGrid>
                            {teammateAvatars.map(mate => (
                                <TeammateCard key={mate.id} to={`/profile/${mate.id}`}>
                                    <AvatarCircle className="avatar">
                                        {mate.urls.map((url, index) => <img key={`${url}-${index}`} src={url} alt="part" />)}
                                    </AvatarCircle>
                                    <MateName>
                                        {mate.name}
                                        {seasonData.team.captainId === mate.id && <span style={{ color: '#fcc419', marginLeft: '2px' }}>👑</span>}
                                        {seasonData.isTopScorer && playerId === mate.id && <span style={{ marginLeft: '2px' }}>⚽</span>}
                                    </MateName>
                                </TeammateCard>
                            ))}
                        </TeammateGrid>
                    </TeamSection>
                </SeasonInfoGrid>
            </SeasonContent>
        </SeasonCardContainer>
    );
}

function PlayerStatsPage() {
    const { classId } = useClassStore();
    const { players, titles } = useLeagueStore();
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
            if (!classId || players.length === 0) return;
            setLoading(true);
            const allPlayerStatsPromises = players.map(p => getPlayerSeasonStats(classId, p.id));
            const allStatsResults = await Promise.all(allPlayerStatsPromises);

            const totals = allStatsResults.map((playerSeasons, index) => {
                const player = players[index];
                const playerTotals = { championships: 0, wins: 0, played: 0, goals: 0 };
                playerSeasons.forEach(seasonData => {
                    playerTotals.wins += seasonData.stats.wins;
                    playerTotals.played += seasonData.stats.played;
                    playerTotals.goals += seasonData.stats.goals;
                    if (seasonData.rank === 1 && seasonData.season.status === 'completed') {
                        playerTotals.championships++;
                    }
                });
                return { ...player, ...playerTotals };
            });

            setAllPlayerTotals(totals);
            const myStats = allStatsResults[players.findIndex(p => p.id === playerId)] || [];
            setAllSeasonStats(myStats);
            setLoading(false);
        };
        fetchAllStats();
    }, [players, playerId, classId]);

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

    if (loading) return <PageContainer><GlassWrapper style={{ textAlign: 'center' }}>데이터를 불러오는 중입니다...</GlassWrapper></PageContainer>;
    if (!playerData) return <PageContainer><GlassWrapper>선수를 찾을 수 없습니다.</GlassWrapper></PageContainer>;

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
    };

    return (
        <PageContainer>
            <GlassWrapper>
                <Header>
                    <h1>{playerData.name}의 기록실</h1>
                    <p>우리반 리그의 전설이 되어보세요!</p>
                </Header>

                <TotalStatsGrid>
                    <StatCard>
                        <StatIcon>🏆</StatIcon>
                        <StatValue color="#ffc107">{myTotalStats.championships}</StatValue>
                        <StatLabel>통산 우승</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatIcon>🏅</StatIcon>
                        <StatValue color="#339af0">{myTotalStats.wins}</StatValue>
                        <StatLabel>통산 승리</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatIcon>⚔️</StatIcon>
                        <StatValue color="#495057">{myTotalStats.played}</StatValue>
                        <StatLabel>통산 출전</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatIcon>⚽</StatIcon>
                        <StatValue color="#40c057">{myTotalStats.goals}</StatValue>
                        <StatLabel>통산 득점</StatLabel>
                    </StatCard>
                </TotalStatsGrid>

                <TabContainer>
                    <TabButton $active={activeTab === 'seasons'} onClick={() => setActiveTab('seasons')}>시즌별 기록</TabButton>
                    <TabButton $active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')}>전체 선수 랭킹</TabButton>
                </TabContainer>

                {activeTab === 'ranking' && (
                    <div>
                        <RankHeader>
                            <div>순위</div>
                            <div className="left">선수</div>
                            <div className="sortable" onClick={() => handleSort('championships')}>우승{getSortIndicator('championships')}</div>
                            <div className="sortable" onClick={() => handleSort('wins')}>승리{getSortIndicator('wins')}</div>
                            <div className="sortable" onClick={() => handleSort('goals')}>득점{getSortIndicator('goals')}</div>
                        </RankHeader>
                        {sortedPlayers.map((p, index) => {
                            const equippedTitle = p.equippedTitle ? titles.find(t => t.id === p.equippedTitle) : null;
                            return (
                                <RankItem key={p.id} to={`/profile/${p.id}`}>
                                    <span className="rank">{index + 1}</span>
                                    <div className="name-col">
                                        <span className="name">{p.name}</span>
                                        {equippedTitle && (
                                            <TitleBadge>{equippedTitle.icon} {equippedTitle.name}</TitleBadge>
                                        )}
                                    </div>
                                    <span className="stat">{p.championships}</span>
                                    <span className="stat">{p.wins}</span>
                                    <span className="stat">{p.goals}</span>
                                </RankItem>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'seasons' && (
                    <SeasonList>
                        {allSeasonStats.length > 0 ? (
                            allSeasonStats.map((seasonData) => (
                                <SeasonStatsCard key={seasonData.season.id} seasonData={seasonData} />
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#adb5bd' }}>아직 참가한 시즌 기록이 없습니다.</div>
                        )}
                    </SeasonList>
                )}

                <ButtonGroup>
                    <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
                    <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
                </ButtonGroup>
            </GlassWrapper>
        </PageContainer>
    );
}

export default PlayerStatsPage;