// src/pages/BroadcastPage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components'; // keyframes 추가
import { useLeagueStore } from '../store/leagueStore';
import { db } from '../api/firebase';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import defaultEmblem from '../assets/default-emblem.png';

// --- Styled Components ---

// ▼▼▼ [신규] 득점자 하이라이트 애니메이션 ▼▼▼
const highlight = keyframes`
  0%, 100% {
    transform: scale(1);
    color: #000;
  }
  50% {
    transform: scale(1.1);
    color: #fff;
    text-shadow: 0 0 10px #ffc107;
  }
`;
// ▲▲▲ 여기까지 추가 ▲▲▲

const BroadcastWrapper = styled.div`
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr 350px; /* Main Content | Sidebar */
  grid-template-rows: auto 1fr; /* Header | Content */
  font-family: 'Pretendard', sans-serif;
  font-weight: 700;
  overflow: hidden;
  background-color: #1a1a1a;
`;

const Header = styled.header`
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  color: #fff;
  position: relative;
`;

const MatchStatus = styled.div`
  background-color: rgba(255,255,255,0.1);
  padding: 0.8rem 2rem;
  border-radius: 50px;
  font-size: 2rem;
  font-weight: bold;
`;

const MainContent = styled.main`
  grid-column: 1 / 2;
  grid-row: 2 / 2;
  display: flex;
  width: 100%;
  height: 100%;
`;

const TeamSection = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 3rem 2rem;
  color: #000;
  gap: 2.5rem;
  
  ${props => props.side === 'left' && css`
    background-color: #ccff00; /* Fluorescent Green */
  `}

  ${props => props.side === 'right' && css`
    background-color: #ff9933; /* Fluorescent Orange */
  `}
`;

const Scoreboard = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-around;
  align-items: center;
`;

const TeamInfoContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
`;

const TeamEmblem = styled.img`
  width: 250px;
  height: 250px;
  border-radius: 50%;
  object-fit: cover;
  border: 5px solid #000;
  background-color: #fff;
`;

const TeamName = styled.h1`
  font-size: 4rem;
  font-weight: 900;
`;

const Score = styled.div`
  font-size: 15rem;
  font-weight: 900;
  line-height: 1;
`;

const Separator = styled.hr`
  width: 100%;
  border: none;
  height: 20px;
  background-color: #a0a0a0;
`;

const LineupGrid = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  max-width: 800px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem 2rem;
  font-size: 2.8rem;
  font-weight: 700;
`;

const PlayerListItem = styled.li`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  /* ▼▼▼ [수정] isHighlight props에 따라 애니메이션 적용 ▼▼▼ */
  animation: ${props => props.$isHighlight ? css`${highlight} 0.5s ease-in-out` : 'none'};
`;

const CaptainBadge = styled.span`
  font-weight: 900;
  color: #d00000;
`;

const MatchListSection = styled.aside`
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  background-color: #1a1a1a;
  color: #fff;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  border-left: 3px solid #444;
`;

const MatchListTitle = styled.h2`
  margin-top: 0;
  text-align: center;
  font-size: 2rem;
`;

const MatchListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #444;
  font-size: 1.2rem;

  &.current {
    background-color: rgba(255, 255, 255, 0.1);
    font-weight: bold;
  }
`;

// ▼▼▼ [수정] PlayerNameplate 컴포넌트 수정 ▼▼▼
function PlayerNameplate({ player, isCaptain, goals, isHighlight }) {
  return (
    <PlayerListItem $isHighlight={isHighlight}>
      <span>{player.name}</span>
      {isCaptain && <CaptainBadge>(C)</CaptainBadge>}
      {/* 득점 수만큼 축구공 아이콘 표시 */}
      {goals > 0 && <span>{'⚽'.repeat(goals)}</span>}
    </PlayerListItem>
  );
}

function BroadcastPage() {
  const { players, teams, currentSeason } = useLeagueStore();
  const [currentMatch, setCurrentMatch] = useState(null);
  const [allMatches, setAllMatches] = useState([]);
  const [lastScorerId, setLastScorerId] = useState(null);
  const prevScorersRef = useRef({});

  useEffect(() => {
    if (!currentSeason) return;
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, where("seasonId", "==", currentSeason.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const inProgressMatch = matchesData.find(m => m.status === '진행중');
      const upcomingMatch = matchesData.find(m => m.status === '예정');

      let matchToShow = { id: 'end', status: '종료' };
      if (inProgressMatch) {
        matchToShow = inProgressMatch;
      } else if (upcomingMatch) {
        matchToShow = upcomingMatch;
      }
      setCurrentMatch(matchToShow);

      matchesData.sort((a, b) => {
        const statusOrder = { '진행중': 1, '예정': 2, '완료': 3 };
        return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      });
      setAllMatches(matchesData);
    });
    return () => unsubscribe();
  }, [currentSeason]);

  // ▼▼▼ [신규] 마지막 득점자 감지 로직 ▼▼▼
  useEffect(() => {
    if (currentMatch && currentMatch.scorers) {
      const currentScorers = currentMatch.scorers;
      const prevScorers = prevScorersRef.current;

      let scorerId = null;
      for (const id in currentScorers) {
        if (currentScorers[id] > (prevScorers[id] || 0)) {
          scorerId = id;
          break;
        }
      }
      if (scorerId) {
        setLastScorerId(scorerId);
        setTimeout(() => setLastScorerId(null), 500); // 0.5초 후 하이라이트 제거
      }
      prevScorersRef.current = currentScorers;
    }
  }, [currentMatch]);
  // ▲▲▲ 여기까지 추가 ▲▲▲

  const teamA = useMemo(() => teams.find(t => t.id === currentMatch?.teamA_id), [teams, currentMatch]);
  const teamB = useMemo(() => teams.find(t => t.id === currentMatch?.teamB_id), [teams, currentMatch]);
  const teamAMembers = useMemo(() => teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamA, players]);
  const teamBMembers = useMemo(() => teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamB, players]);
  const scorers = useMemo(() => currentMatch?.scorers || {}, [currentMatch]);

  const matchStatusText = useMemo(() => {
    if (!currentMatch) return "로딩 중...";
    switch (currentMatch.status) {
      case '진행중': return "경기 중";
      case '예정': return "경기 준비중";
      case '종료': return "모든 경기 종료";
      default: return "대기 중";
    }
  }, [currentMatch]);

  if (!currentSeason) return <BroadcastWrapper style={{ fontSize: '3rem', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>시즌 정보를 불러오는 중입니다...</BroadcastWrapper>;
  if (!currentMatch) return <BroadcastWrapper style={{ fontSize: '3rem', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>경기를 불러오는 중...</BroadcastWrapper>;

  return (
    <BroadcastWrapper>
      <Header>
        <MatchStatus>{matchStatusText}</MatchStatus>
      </Header>

      <MainContent>
        {currentMatch.status !== '종료' ? (
          <>
            <TeamSection side="left">
              <Scoreboard>
                <TeamInfoContainer>
                  <TeamEmblem src={teamA?.emblemUrl || defaultEmblem} />
                  <TeamName>{teamA?.teamName}</TeamName>
                </TeamInfoContainer>
                <Score>{currentMatch.teamA_score ?? 0}</Score>
              </Scoreboard>
              <Separator />
              <LineupGrid>
                {teamAMembers.map(p => <PlayerNameplate key={p.id} player={p} isCaptain={teamA?.captainId === p.id} goals={scorers[p.id] || 0} isHighlight={lastScorerId === p.id} />)}
              </LineupGrid>
            </TeamSection>
            <TeamSection side="right">
              <Scoreboard>
                <Score>{currentMatch.teamB_score ?? 0}</Score>
                <TeamInfoContainer>
                  <TeamEmblem src={teamB?.emblemUrl || defaultEmblem} />
                  <TeamName>{teamB?.teamName}</TeamName>
                </TeamInfoContainer>
              </Scoreboard>
              <Separator />
              <LineupGrid>
                {teamBMembers.map(p => <PlayerNameplate key={p.id} player={p} isCaptain={teamB?.captainId === p.id} goals={scorers[p.id] || 0} isHighlight={lastScorerId === p.id} />)}
              </LineupGrid>
            </TeamSection>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '4rem', color: '#fff' }}>
            모든 경기가 종료되었습니다!
          </div>
        )}
      </MainContent>

      <MatchListSection>
        <MatchListTitle>오늘의 경기</MatchListTitle>
        {allMatches.map(match => {
          const teamAInfo = teams.find(t => t.id === match.teamA_id);
          const teamBInfo = teams.find(t => t.id === match.teamB_id);
          if (!teamAInfo || !teamBInfo) return null;
          return (
            <MatchListItem key={match.id} className={match.id === currentMatch.id ? 'current' : ''}>
              <span>{teamAInfo.teamName}</span>
              <strong>{match.status === '완료' ? `${match.teamA_score} : ${match.teamB_score}` : 'VS'}</strong>
              <span>{teamBInfo.teamName}</span>
            </MatchListItem>
          )
        })}
      </MatchListSection>
    </BroadcastWrapper>
  );
}

export default BroadcastPage;