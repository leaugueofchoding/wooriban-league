// src/pages/BroadcastPage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { db } from '../api/firebase';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import defaultEmblem from '../assets/default-emblem.png';
import confetti from 'canvas-confetti';
import whistleSound from '../assets/whistle.mp3';
import { emblemMap } from '../utils/emblemMap';
// ▼▼▼ [추가] WinnerPage 컴포넌트 import ▼▼▼
import WinnerPage from './WinnerPage';

// --- Styled Components ---

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

const BroadcastWrapper = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: ${props => props.$isMiniMode ? '1fr' : '1fr 350px'};
  grid-template-rows: auto 1fr;
  font-family: 'Pretendard', sans-serif;
  font-weight: 700;
  overflow: hidden;
  background-color: #1a1a1a;
`;

const Header = styled.header`
  grid-column: 1 / ${props => props.$isMiniMode ? '2' : '2'};
  grid-row: 1 / 2;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${props => props.$isMiniMode ? '0.5rem' : '1rem'};
  color: #fff;
  position: relative;
`;

const MatchStatus = styled.div`
  background-color: rgba(255,255,255,0.1);
  padding: ${props => props.$isMiniMode ? '0.4rem 1rem' : '0.8rem 2rem'};
  border-radius: 50px;
  font-size: ${props => props.$isMiniMode ? '1.5rem' : '2.5rem'};
  font-weight: bold;
  font-variant-numeric: tabular-nums;
`;

const MainContent = styled.main`
  grid-column: 1 / ${props => props.$isMiniMode ? '2' : '2'};
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
  padding: ${props => props.$isMiniMode ? '1rem' : '3rem 2rem'};
  color: #000;
  gap: ${props => props.$isMiniMode ? '1rem' : '2.5rem'};
  
  ${props => props.$side === 'left' && css`
    background-color: #ccff00;
  `}

  ${props => props.$side === 'right' && css`
    background-color: #ff9933;
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
    gap: ${props => props.$isMiniMode ? '0.5rem' : '1.5rem'};
`;

const TeamEmblem = styled.img`
  width: ${props => props.$isMiniMode ? '80px' : '250px'};
  height: ${props => props.$isMiniMode ? '80px' : '250px'};
  border-radius: 50%;
  object-fit: cover;
  border: ${props => props.$isMiniMode ? '3px solid #000' : '5px solid #000'};
  background-color: #fff;
`;

const TeamName = styled.h1`
  font-size: ${props => props.$isMiniMode ? '1.8rem' : '4rem'};
  font-weight: 900;
  margin: 0;
`;

const Score = styled.div`
  font-size: ${props => props.$isMiniMode ? '5rem' : '15rem'};
  font-weight: 900;
  line-height: 1;
`;

const Separator = styled.hr`
  width: 100%;
  border: none;
  height: ${props => props.$isMiniMode ? '5px' : '20px'};
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
  gap: ${props => props.$isMiniMode ? '0.5rem 1rem' : '1.5rem 2rem'};
  font-size: ${props => props.$isMiniMode ? '1rem' : '2.8rem'};
  font-weight: 700;
`;

const PlayerListItem = styled.li`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
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

function PlayerNameplate({ player, isCaptain, goals, isHighlight }) {
  return (
    <PlayerListItem $isHighlight={isHighlight}>
      <span>{player.name}</span>
      {isCaptain && <CaptainBadge>(C)</CaptainBadge>}
      {goals > 0 && <span>{'⚽'.repeat(goals)}</span>}
    </PlayerListItem>
  );
}

function BroadcastPage({ isMiniMode = false }) {
  const { players, teams, currentSeason } = useLeagueStore();
  const [matchForDisplay, setMatchForDisplay] = useState(null);
  const [allMatches, setAllMatches] = useState([]);
  const [lastScorerId, setLastScorerId] = useState(null);
  const prevScorersRef = useRef({});
  const [timeLeft, setTimeLeft] = useState(150);
  const timerIntervalRef = useRef(null);
  const audioRef = useRef(new Audio(whistleSound));
  const confettiCanvasRef = useRef(null);
  const prevMatchesRef = useRef([]);
  const [showWinnerPage, setShowWinnerPage] = useState(false); // [추가] 우승 페이지 표시 상태

  const playWhistle = () => {
    audioRef.current.play().catch(error => console.error("오디오 재생 오류:", error));
  };

  useEffect(() => {
    // [추가] 시즌이 종료되면 우승 페이지를 표시
    if (currentSeason?.status === 'completed') {
      setShowWinnerPage(true);
    } else {
      setShowWinnerPage(false);
    }
  }, [currentSeason]);

  useEffect(() => {
    if (!currentSeason) return;
    const matchesRef = collection(db, 'matches');
    const q = query(matchesRef, where("seasonId", "==", currentSeason.id));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const prevMatches = prevMatchesRef.current;

      const justCompletedMatch = matchesData.find(match => {
        const prevMatch = prevMatches.find(p => p.id === match.id);
        return prevMatch && prevMatch.status !== '완료' && match.status === '완료';
      });

      if (justCompletedMatch) {
        setMatchForDisplay(justCompletedMatch);
        playWhistle();
        const { teamA_score, teamB_score } = justCompletedMatch;
        if (teamA_score !== teamB_score) {
          if (!confettiCanvasRef.current) {
            const canvas = document.createElement('canvas');
            canvas.style.position = 'fixed';
            canvas.style.top = 0; canvas.style.left = 0;
            canvas.style.width = '100vw'; canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none'; canvas.style.zIndex = 9999;
            document.body.appendChild(canvas);
            confettiCanvasRef.current = canvas;
          }
          const myConfetti = confetti.create(confettiCanvasRef.current, { resize: true, useWorker: true });
          const winningSide = teamA_score > teamB_score ? 'left' : 'right';
          const fire = (particleRatio, opts) => myConfetti({ ...opts, origin: { x: winningSide === 'left' ? 0.25 : 0.75, y: 0.6 }, particleCount: Math.floor(200 * particleRatio) });
          fire(0.25, { spread: 26, startVelocity: 55 }); fire(0.2, { spread: 60 }); fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 }); fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 }); fire(0.1, { spread: 120, startVelocity: 45 });

          setTimeout(() => {
            if (confettiCanvasRef.current) {
              document.body.removeChild(confettiCanvasRef.current);
              confettiCanvasRef.current = null;
            }
          }, 4000);
        }

        setTimeout(() => {
          const inProgress = matchesData.find(m => m.status === '진행중');
          const upcoming = matchesData.find(m => m.status === '예정');
          setMatchForDisplay(inProgress || upcoming || { id: 'end', status: '종료' });
        }, 5000);

      } else {
        const inProgress = matchesData.find(m => m.status === '진행중');
        const upcoming = matchesData.find(m => m.status === '예정');
        setMatchForDisplay(inProgress || upcoming || { id: 'end', status: '종료' });
      }

      matchesData.sort((a, b) => {
        const statusOrder = { '진행중': 1, '예정': 2, '완료': 3 };
        return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      });
      setAllMatches(matchesData);
      prevMatchesRef.current = matchesData;
    });
    return () => unsubscribe();
  }, [currentSeason]);

  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (matchForDisplay?.status === '진행중' && matchForDisplay.startTime) {
      const startTime = matchForDisplay.startTime.toMillis();
      const gameDuration = 150 * 1000;

      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const remaining = Math.max(0, gameDuration - elapsed);
        setTimeLeft(Math.round(remaining / 1000));

        if (remaining === 0) {
          clearInterval(timerIntervalRef.current);
          playWhistle();
        }
      }, 1000);
    } else if (matchForDisplay?.status === '예정') {
      setTimeLeft(150);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [matchForDisplay]);

  useEffect(() => {
    if (matchForDisplay && matchForDisplay.scorers) {
      const currentScorers = matchForDisplay.scorers;
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
        setTimeout(() => setLastScorerId(null), 500);
      }
      prevScorersRef.current = currentScorers;
    }
  }, [matchForDisplay]);

  const teamA = useMemo(() => teams.find(t => t.id === matchForDisplay?.teamA_id), [teams, matchForDisplay]);
  const teamB = useMemo(() => teams.find(t => t.id === matchForDisplay?.teamB_id), [teams, matchForDisplay]);
  const teamAMembers = useMemo(() => teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamA, players]);
  const teamBMembers = useMemo(() => teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamB, players]);
  const scorers = useMemo(() => matchForDisplay?.scorers || {}, [matchForDisplay]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const matchStatusText = useMemo(() => {
    if (!matchForDisplay) return "로딩 중...";
    if (timeLeft === 0 && matchForDisplay.status !== '완료') return "경기 종료";

    switch (matchForDisplay.status) {
      case '진행중':
        return formatTime(timeLeft);
      case '예정': return "경기 준비중";
      case '완료': return "경기 종료";
      case '종료': return "모든 경기 종료";
      default: return "대기 중";
    }
  }, [matchForDisplay, timeLeft]);

  // ▼▼▼ [수정] showWinnerPage가 true이면 WinnerPage를 렌더링 ▼▼▼
  if (showWinnerPage) {
    return <WinnerPage />;
  }

  if (!currentSeason && !isMiniMode) return <BroadcastWrapper style={{ fontSize: '3rem', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>시즌 정보를 불러오는 중입니다...</BroadcastWrapper>;
  if (!matchForDisplay) return <BroadcastWrapper style={{ fontSize: '3rem', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>경기를 불러오는 중...</BroadcastWrapper>;

  return (
    <BroadcastWrapper $isMiniMode={isMiniMode}>
      <Header $isMiniMode={isMiniMode}>
        <MatchStatus $isMiniMode={isMiniMode}>{matchStatusText}</MatchStatus>
      </Header>

      <MainContent>
        {matchForDisplay.status !== '종료' ? (
          <>
            <TeamSection $side="left" $isMiniMode={isMiniMode}>
              <Scoreboard>
                <TeamInfoContainer $isMiniMode={isMiniMode}>
                  <TeamEmblem src={emblemMap[teamA?.emblemId] || teamA?.emblemUrl || defaultEmblem} $isMiniMode={isMiniMode} />
                  <TeamName $isMiniMode={isMiniMode}>{teamA?.teamName}</TeamName>
                </TeamInfoContainer>
                <Score $isMiniMode={isMiniMode}>{matchForDisplay.teamA_score ?? '...'}</Score>
              </Scoreboard>
              <Separator $isMiniMode={isMiniMode} />
              <LineupGrid $isMiniMode={isMiniMode}>
                {teamAMembers.map(p => <PlayerNameplate key={p.id} player={p} isCaptain={teamA?.captainId === p.id} goals={scorers[p.id] || 0} isHighlight={lastScorerId === p.id} />)}
              </LineupGrid>
            </TeamSection>
            <TeamSection $side="right" $isMiniMode={isMiniMode}>
              <Scoreboard>
                <Score $isMiniMode={isMiniMode}>{matchForDisplay.teamB_score ?? '...'}</Score>
                <TeamInfoContainer $isMiniMode={isMiniMode}>
                  <TeamEmblem src={emblemMap[teamB?.emblemId] || teamB?.emblemUrl || defaultEmblem} $isMiniMode={isMiniMode} />
                  <TeamName $isMiniMode={isMiniMode}>{teamB?.teamName}</TeamName>
                </TeamInfoContainer>
              </Scoreboard>
              <Separator $isMiniMode={isMiniMode} />
              <LineupGrid $isMiniMode={isMiniMode}>
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

      {!isMiniMode && (
        <MatchListSection>
          <MatchListTitle>오늘의 경기</MatchListTitle>
          {allMatches.map(match => {
            const teamAInfo = teams.find(t => t.id === match.teamA_id);
            const teamBInfo = teams.find(t => t.id === match.teamB_id);
            if (!teamAInfo || !teamBInfo) return null;
            return (
              <MatchListItem key={match.id} className={match.id === matchForDisplay.id ? 'current' : ''}>
                <span>{teamAInfo.teamName}</span>
                <strong>{match.status === '완료' ? `${match.teamA_score} : ${match.teamB_score}` : 'VS'}</strong>
                <span>{teamBInfo.teamName}</span>
              </MatchListItem>
            )
          })}
        </MatchListSection>
      )}
    </BroadcastWrapper>
  );
}

export default BroadcastPage;