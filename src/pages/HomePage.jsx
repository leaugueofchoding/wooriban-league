// src/pages/HomePage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore'; // [수정]
import { useNavigate, useLocation, Link } from 'react-router-dom';
import LeagueTable from '../components/LeagueTable.jsx';
import defaultEmblem from '../assets/default-emblem.png';
import { auth } from '../api/firebase';
import { emblemMap } from '../utils/emblemMap';

// --- Styled Components ---
const Wrapper = styled.div`
  max-width: 1400px;
  margin: 2rem auto;
  padding: 1rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const TabContainer = styled.nav`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  background-color: ${props => (props.$active ? '#007bff' : '#fff')};
  color: ${props => (props.$active ? 'white' : '#343a40')};
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => (props.$active ? '#0056b3' : '#e9ecef')};
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    padding: 0.6rem 1rem;
    font-size: 1rem;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: flex-start;

  @media (max-width: 992px) {
    grid-template-columns: 1fr;
  }
`;

const Section = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const MatchItem = styled.div`
  background-color: #fff;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  cursor: pointer;
  overflow: hidden;
`;

const MatchSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  padding: 1rem;
`;

const Team = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: bold;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TeamEmblem = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #fff;
  flex-shrink: 0;
`;

const Score = styled.span`
  font-weight: bold;
  font-size: 1.2rem;
  color: #007bff;
  padding: 0 1rem;
`;

const VsText = styled.span`
  color: #6c757d;
  font-weight: bold;
  padding: 0 1rem;
`;

const LineupDetail = styled.div`
  padding: ${props => (props.$isOpen ? '1.5rem' : '0 1.5rem')};
  background-color: #f1f3f5;
  border-top: ${props => (props.$isOpen ? '1px solid #e9ecef' : 'none')};
  max-height: ${props => (props.$isOpen ? '1000px' : '0')};
  opacity: ${props => (props.$isOpen ? '1' : '0')};
  overflow: hidden;
  transition: all 0.4s ease-in-out;
`;

const LineupGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const TeamLineup = styled.div`
  text-align: center;
`;

const PlayerList = styled.ul`
  list-style: none;
  padding: 0;
  margin-top: 1rem;
`;

const PlayerItem = styled.li`
  margin-bottom: 0.5rem;
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

const TeamGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const TeamCard = styled.div`
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 2px solid transparent;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    border-color: #007bff;
  }
`;

const TeamCardEmblem = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  background-color: #e9ecef;
  margin: 0 auto 1rem;
  border: 3px solid #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const TeamNameContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const TeamCardName = styled.h2`
  margin: 0;
  font-size: 1.5rem;
`;

const MyTeamLabel = styled.span`
  color: #007bff;
  font-size: 1rem;
  font-weight: bold;
`;

const TeamRecord = styled.p`
  margin: 0;
  font-size: 1.1rem;
  color: #495057;
  font-weight: 500;
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
            <h4>{teamA?.teamName} 라인업</h4>
            <PlayerList>
              {teamAMembers.map(p => <PlayerItem key={p.id}>{p.name}</PlayerItem>)}
            </PlayerList>
          </TeamLineup>
          <TeamLineup>
            <h4>{teamB?.teamName} 라인업</h4>
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
        <SectionTitle>경기 일정</SectionTitle>
        <MatchList>
          {sortedMatches.map(match => (
            <ScheduleItem key={match.id} match={match} isInitiallyOpen={match.id === nextMatchId} />
          ))}
        </MatchList>
      </Section>
      <Section>
        <SectionTitle>실시간 리그 순위</SectionTitle>
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
      <SectionTitle>팀 정보</SectionTitle>
      <TeamGrid>
        {teamStats.map(team => (
          <TeamCard key={team.id} onClick={() => handleCardClick(team.id)}>
            <TeamCardEmblem src={emblemMap[team.emblemId] || team.emblemUrl || defaultEmblem} alt={`${team.teamName} 엠블럼`} />
            <TeamNameContainer>
              <TeamCardName>{team.teamName}</TeamCardName>
              {team.id === myTeamId && <MyTeamLabel>(나의팀)</MyTeamLabel>}
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
      <Title>가가볼 리그 센터</Title>
      <TabContainer>
        <TabButton $active={activeTab === 'leagueInfo'} onClick={() => setActiveTab('leagueInfo')}>
          {currentSeason?.seasonName || '리그 정보'}
        </TabButton>
        <TabButton $active={activeTab === 'teamInfo'} onClick={() => setActiveTab('teamInfo')}>
          팀 정보 보기
        </TabButton>
        {myPlayerData && (
          <TabButton onClick={() => navigate(`/profile/${myPlayerData.id}/stats`)}>
            선수 기록
          </TabButton>
        )}
      </TabContainer>

      {renderContent()}

      <ExitButton onClick={() => navigate('/')}>홈 화면으로</ExitButton>
    </Wrapper>
  );
}

export default HomePage;