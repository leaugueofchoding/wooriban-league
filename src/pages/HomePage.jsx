// src/pages/HomePage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { useNavigate, useLocation } from 'react-router-dom';
import LeagueTable from '../components/LeagueTable.jsx';
import defaultEmblem from '../assets/default-emblem.png';
import { auth } from '../api/firebase';
import { emblemMap } from '../utils/emblemMap';

// --- Styled Components ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Wrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  animation: ${fadeIn} 0.5s ease-out;
`;

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2.2rem;
  font-weight: 900;
  color: #343a40;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 0 rgba(255,255,255,0.5);
  
  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
`;

const SubTitle = styled.p`
  color: #868e96;
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
`;

const TabContainer = styled.nav`
  display: flex;
  gap: 0.8rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  font-weight: 800;
  border: none;
  background-color: ${props => (props.$active ? '#fff' : 'rgba(255,255,255,0.5)')};
  color: ${props => (props.$active ? '#007bff' : '#868e96')};
  border-radius: 20px;
  cursor: pointer;
  box-shadow: ${props => (props.$active ? '0 4px 12px rgba(0,123,255,0.15)' : 'none')};
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background-color: #fff;
    transform: translateY(-2px);
    color: #007bff;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: flex-start;

  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const Section = styled.div`
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border: 1px solid rgba(255,255,255,0.8);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.2rem;
  font-size: 1.3rem;
  font-weight: 800;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    display: block;
    width: 6px;
    height: 24px;
    background-color: #007bff;
    border-radius: 3px;
  }
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const MatchItem = styled.div`
  background-color: #fff;
  border-radius: 16px;
  border: 1px solid #f1f3f5;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    border-color: #74c0fc;
  }
`;

const MatchSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
`;

const Team = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 700;
  flex: 1;
  color: #343a40;
  font-size: 1rem;
  
  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }
`;

const TeamEmblem = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  flex-shrink: 0;
`;

const Score = styled.span`
  font-weight: 900;
  font-size: 1.4rem;
  color: #339af0;
  padding: 0 1rem;
  font-family: 'Pretendard', sans-serif;
`;

const VsText = styled.span`
  color: #adb5bd;
  font-weight: 900;
  font-size: 1rem;
  padding: 0 1rem;
  font-style: italic;
`;

const LineupDetail = styled.div`
  padding: ${props => (props.$isOpen ? '1.5rem' : '0 1.5rem')};
  background-color: #f8f9fa;
  border-top: ${props => (props.$isOpen ? '1px solid #f1f3f5' : 'none')};
  max-height: ${props => (props.$isOpen ? '500px' : '0')};
  opacity: ${props => (props.$isOpen ? '1' : '0')};
  overflow: hidden;
  transition: all 0.3s ease-in-out;
`;

const LineupGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const TeamLineup = styled.div`
  text-align: center;
  h4 {
    margin: 0 0 0.8rem 0;
    font-size: 0.95rem;
    color: #495057;
  }
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const PlayerItem = styled.li`
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
  color: #868e96;
  background: #fff;
  padding: 0.4rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const TeamGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
`;

const TeamCard = styled.div`
  background-color: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 20px rgba(0,0,0,0.1);
    border-color: #4dabf7;
  }
`;

const TeamCardEmblem = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #f1f3f5;
  margin: 0 auto 1rem;
  border: 3px solid #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
`;

const TeamNameContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
`;

const TeamCardName = styled.h3`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #343a40;
`;

const MyTeamLabel = styled.span`
  color: #20c997;
  font-size: 0.75rem;
  font-weight: 800;
  background: #e6fcf5;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
`;

const TeamRecord = styled.p`
  margin: 0;
  font-size: 1rem;
  color: #868e96;
  font-weight: 600;
`;

const ExitButton = styled.button`
  display: block;
  margin: 3rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: #495057;
  background-color: #fff;
  border: 1px solid #dee2e6;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);

  &:hover { 
    background-color: #f8f9fa; 
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  }
`;

function ScheduleItem({ match, isInitiallyOpen }) {
  const { teams, players } = useLeagueStore();
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);

  useEffect(() => {
    setIsOpen(isInitiallyOpen);
  }, [isInitiallyOpen]);

  const teamA = teams.find(t => t.id === match.teamA_id);
  const teamB = teams.find(t => t.id === match.teamB_id);

  const teamAMembers = teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
  const teamBMembers = teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];

  return (
    <MatchItem onClick={() => setIsOpen(!isOpen)}>
      <MatchSummary>
        <Team>
          <TeamEmblem src={emblemMap[teamA?.emblemId] || teamA?.emblemUrl || defaultEmblem} alt={teamA?.teamName} />
          <span>{teamA?.teamName || 'N/A'}</span>
        </Team>
        {match.status === '완료' ? (
          <Score>{match.teamA_score} : {match.teamB_score}</Score>
        ) : (
          <VsText>VS</VsText>
        )}
        <Team style={{ justifyContent: 'flex-end' }}>
          <span>{teamB?.teamName || 'N/A'}</span>
          <TeamEmblem src={emblemMap[teamB?.emblemId] || teamB?.emblemUrl || defaultEmblem} alt={teamB?.teamName} />
        </Team>
      </MatchSummary>
      <LineupDetail $isOpen={isOpen}>
        <LineupGrid>
          <TeamLineup>
            <h4>{teamA?.teamName}</h4>
            <PlayerList>
              {teamAMembers.map(p => <PlayerItem key={p.id}>{p.name}</PlayerItem>)}
            </PlayerList>
          </TeamLineup>
          <TeamLineup>
            <h4>{teamB?.teamName}</h4>
            <PlayerList>
              {teamBMembers.map(p => <PlayerItem key={p.id}>{p.name}</PlayerItem>)}
            </PlayerList>
          </TeamLineup>
        </LineupGrid>
      </LineupDetail>
    </MatchItem>
  );
}

function LeagueInfoContent({ matches, standingsData }) {
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      if (a.status === '예정' && b.status !== '예정') return -1;
      if (a.status !== '예정' && b.status === '예정') return 1;
      return 0;
    });
  }, [matches]);

  const nextMatchId = useMemo(() => {
    const upcomingMatch = sortedMatches.find(m => m.status === '예정');
    return upcomingMatch ? upcomingMatch.id : null;
  }, [sortedMatches]);

  return (
    <ContentGrid>
      <Section>
        <SectionTitle>📅 경기 일정</SectionTitle>
        <MatchList>
          {sortedMatches.length > 0 ? sortedMatches.map(match => (
            <ScheduleItem key={match.id} match={match} isInitiallyOpen={match.id === nextMatchId} />
          )) : <div style={{ textAlign: 'center', padding: '2rem', color: '#adb5bd' }}>등록된 경기가 없습니다.</div>}
        </MatchList>
      </Section>
      <Section>
        <SectionTitle>🏆 실시간 순위</SectionTitle>
        <LeagueTable standings={standingsData} />
      </Section>
    </ContentGrid>
  );
}

function TeamInfoContent({ teams, matches, currentSeason, myTeamId }) {
  const navigate = useNavigate();
  const teamStats = useMemo(() => {
    if (!currentSeason) return [];
    const seasonTeams = teams.filter(team => team.seasonId === currentSeason.id);
    const seasonMatches = matches.filter(match => match.seasonId === currentSeason.id && match.status === '완료');

    return seasonTeams.map(team => {
      const stats = { wins: 0, draws: 0, losses: 0 };
      seasonMatches.forEach(match => {
        if (match.teamA_id === team.id) {
          if (match.teamA_score > match.teamB_score) stats.wins++;
          else if (match.teamA_score < match.teamB_score) stats.losses++;
          else stats.draws++;
        } else if (match.teamB_id === team.id) {
          if (match.teamB_score > match.teamA_score) stats.wins++;
          else if (match.teamB_score < match.teamA_score) stats.losses++;
          else stats.draws++;
        }
      });
      return { ...team, ...stats };
    });
  }, [teams, matches, currentSeason]);

  const handleCardClick = (teamId) => {
    navigate(`/league/teams/${teamId}`);
  };

  return (
    <Section>
      <SectionTitle>🛡️ 팀 정보</SectionTitle>
      <TeamGrid>
        {teamStats.map(team => (
          <TeamCard key={team.id} onClick={() => handleCardClick(team.id)}>
            <TeamCardEmblem src={emblemMap[team.emblemId] || team.emblemUrl || defaultEmblem} alt={`${team.teamName} 엠블럼`} />
            <TeamNameContainer>
              <TeamCardName>{team.teamName}</TeamCardName>
              {team.id === myTeamId && <MyTeamLabel>MY TEAM</MyTeamLabel>}
            </TeamNameContainer>
            <TeamRecord>{team.wins}승 {team.draws}무 {team.losses}패</TeamRecord>
          </TeamCard>
        ))}
      </TeamGrid>
    </Section>
  )
}

function HomePage() {
  const { matches, teams, currentSeason, players, standingsData } = useLeagueStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('leagueInfo');
  const currentUser = auth.currentUser;

  const myPlayerData = useMemo(() => {
    if (!currentUser) return null;
    return players.find(p => p.authUid === currentUser.uid);
  }, [players, currentUser]);

  const myTeam = useMemo(() => {
    if (!myPlayerData || !currentSeason) return null;
    return teams.find(team => team.seasonId === currentSeason.id && team.members.includes(myPlayerData.id));
  }, [teams, myPlayerData, currentSeason]);


  useEffect(() => {
    if (location.state?.defaultTab) {
      setActiveTab(location.state.defaultTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const finalStandingsData = standingsData();

  const renderContent = () => {
    switch (activeTab) {
      case 'leagueInfo':
        return <LeagueInfoContent matches={matches} standingsData={finalStandingsData} />;
      case 'teamInfo':
        return <TeamInfoContent teams={teams} matches={matches} currentSeason={currentSeason} myTeamId={myTeam?.id} />;
      default:
        return null;
    }
  };

  return (
    <Wrapper>
      <HeaderSection>
        <Title>🏆 가가볼 리그 센터</Title>
        <SubTitle>우리 반 리그의 모든 정보를 확인하세요!</SubTitle>
      </HeaderSection>

      <TabContainer>
        <TabButton $active={activeTab === 'leagueInfo'} onClick={() => setActiveTab('leagueInfo')}>
          📊 리그 현황
        </TabButton>
        <TabButton $active={activeTab === 'teamInfo'} onClick={() => setActiveTab('teamInfo')}>
          🛡️ 팀 정보
        </TabButton>
        {myPlayerData && (
          <TabButton onClick={() => navigate(`/profile/${myPlayerData.id}/stats`)}>
            📈 내 기록
          </TabButton>
        )}
      </TabContainer>

      {renderContent()}

      <ExitButton onClick={() => navigate('/')}>🏠 홈으로 돌아가기</ExitButton>
    </Wrapper>
  );
}

export default HomePage;