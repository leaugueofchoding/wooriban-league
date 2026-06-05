// src/pages/RecorderDashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import {
    auth,
    db,
    approveMissionsInBatch,
    rejectMissionSubmission,
    updateMatchStatus,
    updateMatchStartTime,
    updateMatchScores,
    updateMatchScoresWithPointAdjust,
    updateSeason
} from '../api/firebase.js';
import { updateDoc, doc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import BroadcastPage from './BroadcastPage';

// Confetti 효과 (CDN 로드)
const loadConfetti = () => {
    if (!window.confetti) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        script.async = true;
        document.body.appendChild(script);
    }
};

// --- Animations ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(51, 154, 240, 0.7); transform: scale(1); }
  70% { box-shadow: 0 0 0 10px rgba(51, 154, 240, 0); transform: scale(1.02); }
  100% { box-shadow: 0 0 0 0 rgba(51, 154, 240, 0); transform: scale(1); }
`;

// --- Styled Components ---

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem 1rem 4rem 1rem;
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
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.6);
  animation: ${fadeIn} 0.5s ease-out;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;

  h1 {
    font-size: 2rem;
    font-weight: 900;
    color: #343a40;
    margin-bottom: 0.5rem;
  }
  .mode-badge {
    display: inline-block;
    background: #e7f5ff;
    color: #1971c2;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 700;
    margin-top: 0.5rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const TabButton = styled.button`
  padding: 0.8rem 2rem;
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
    &:hover { background-color: #e9ecef; }
  `}
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.03);
  border: 1px solid #f1f3f5;
  transition: all 0.2s;
`;

const MatchCard = styled(Card)`
  display: flex;
  flex-direction: column;
  border: ${props => props.$isActive ? '2px solid #339af0' : '1px solid #f1f3f5'};
  opacity: ${props => props.$isDimmed ? 0.6 : 1};
  transform: ${props => props.$isActive ? 'scale(1.02)' : 'scale(1)'};
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`;

const MatchHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  .teams {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.2rem;
    font-weight: 800;
    color: #343a40;
  }
`;

const ScoreBoard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
`;

const TeamScoreDisplay = styled.div`
  font-size: 2.5rem;
  font-weight: 900;
  color: #343a40;
  width: 80px;
  text-align: center;
  background: white;
  border-radius: 12px;
  padding: 0.5rem 0;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
`;

const ScorerArea = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f3f5;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const ScorerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  
  h4 { margin: 0 0 0.5rem 0; font-size: 0.95rem; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 0.3rem; }
`;

const ScorerRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 700;
  background: #fff;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid #f1f3f5;
  
  .name-group { display: flex; align-items: center; gap: 0.5rem; }
  .goals { background: #339af0; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; }
  
  .controls { display: flex; align-items: center; gap: 0.5rem; }
`;

const ScoreBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.1s;
  
  &.add { 
    background: #dbe4ff; color: #364fc7; 
    &:hover { background: #bac8ff; }
    &:active { background: #364fc7; color: white; } 
  }
  &.cancel { 
    background: #fff5f5; color: #fa5252; 
    font-size: 0.8rem; padding: 0.5rem 0.8rem;
    &:hover { background: #ffe3e3; }
    &:active { background: #fa5252; color: white; } 
  }
  
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const ControlBar = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
`;

// 경기 시작 버튼 색상 선명하게 변경
const GameButton = styled.button`
  padding: 0.8rem 1.5rem;
  border-radius: 12px;
  font-weight: 800;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &.start { 
    background: #28a745; 
    color: white; 
    box-shadow: 0 4px 0 #1e7e34; 
    &:hover { transform: translateY(-2px); filter: brightness(1.1); }
    &:active { transform: translateY(4px); box-shadow: none; } 
  }
  &.end { 
    background: #ff4444; 
    color: white; 
    box-shadow: 0 4px 0 #cc0000; 
    &:hover { transform: translateY(-2px); filter: brightness(1.1); }
    &:active { transform: translateY(4px); box-shadow: none; } 
  }
  &.next { 
    background: #339af0; color: white; 
    box-shadow: 0 4px 0 #1c7ed6; 
    animation: ${pulse} 2s infinite; 
    &:hover { transform: translateY(-2px); }
    &:active { transform: translateY(4px); box-shadow: none; animation: none; } 
  }
  &.disabled { 
    background: #e9ecef; color: #adb5bd; 
    cursor: not-allowed; box-shadow: none; 
    transform: none !important;
  }
`;

const BroadcastFrame = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 4px solid #f8f9fa;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
  height: 400px;
`;

const MissionItem = styled(Card)`
  display: flex; flex-direction: column; gap: 1rem; cursor: pointer;
`;
const MissionHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;
  .info { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: #343a40; }
  .badge { font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; font-weight: 800; 
    &.text { background: #e7f5ff; color: #1c7ed6; } &.photo { background: #e6fcf5; color: #0ca678; } }
`;
const SubmissionContent = styled.div`
  background: #f8f9fa; padding: 1rem; border-radius: 12px; font-size: 0.95rem; line-height: 1.5; color: #495057;
  img { max-width: 100%; border-radius: 8px; margin-top: 0.5rem; border: 1px solid #dee2e6; }
`;

// --- Components ---

function MatchRow({ match, isOpen, onStart, onComplete, onNext, scoringMethod = 'survival', isAnyMatchInProgress, lastCompletedId, onCardClick, isAdmin, onEditMatch }) {
    const { classId } = useClassStore();
    const { players, teams } = useLeagueStore();

    const scoreA = match.teamA_score ?? 0;
    const scoreB = match.teamB_score ?? 0;
    const scorers = match.scorers || {};

    const teamA = useMemo(() => teams.find(t => t.id === match.teamA_id), [teams, match.teamA_id]);
    const teamB = useMemo(() => teams.find(t => t.id === match.teamB_id), [teams, match.teamB_id]);

    const teamAMembers = useMemo(() => teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamA, players]);
    const teamBMembers = useMemo(() => teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamB, players]);

    // 완료 여부 체크
    const isCompleted = match.status === 'completed' || match.status === '완료';
    const isHeldAtTop = lastCompletedId === match.id;

    useEffect(() => {
        if (!classId) return;
        if (match.status === '예정' && (match.teamA_score == null || match.teamB_score == null)) {
            let initA = 0;
            let initB = 0;

            if (scoringMethod === 'survival') {
                const maxPlayers = Math.max(teamAMembers.length, teamBMembers.length);
                initA = maxPlayers;
                initB = maxPlayers;
            }

            updateDoc(doc(db, 'classes', classId, 'matches', match.id), {
                teamA_score: initA,
                teamB_score: initB,
            });
        }
    }, [match.id, match.status, classId, scoringMethod, teamAMembers.length, teamBMembers.length]);

    const handleGoal = async (playerId, teamType, isCancel = false) => {
        if (!classId || match.status !== '진행중') return;

        const currentGoals = scorers[playerId] || 0;
        if (isCancel && currentGoals <= 0) return;

        if (!isCancel && scoringMethod === 'survival') {
            const targetScore = teamType === 'A' ? scoreB : scoreA;
            if (targetScore <= 0) {
                alert("상대 팀 점수가 0점이므로 더 이상 득점할 수 없습니다.");
                return;
            }
        }

        const newScorers = { ...scorers };
        const newGoals = isCancel ? currentGoals - 1 : currentGoals + 1;

        if (newGoals > 0) newScorers[playerId] = newGoals;
        else delete newScorers[playerId];

        let newScoreA = scoreA;
        let newScoreB = scoreB;
        const isTeamA = teamType === 'A';

        if (scoringMethod === 'survival') {
            if (isTeamA) {
                newScoreB = isCancel ? scoreB + 1 : scoreB - 1;
            } else {
                newScoreA = isCancel ? scoreA + 1 : scoreA - 1;
            }
        } else {
            if (isTeamA) {
                newScoreA = isCancel ? scoreA - 1 : scoreA + 1;
            } else {
                newScoreB = isCancel ? scoreB - 1 : scoreB + 1;
            }
        }

        newScoreA = Math.max(0, newScoreA);
        newScoreB = Math.max(0, newScoreB);

        await updateDoc(doc(db, 'classes', classId, 'matches', match.id), {
            scorers: newScorers,
            teamA_score: newScoreA,
            teamB_score: newScoreB
        });
    };

    const handleOwnGoal = async (teamType, isCancel = false) => {
        if (!classId || match.status !== '진행중') return;

        if (!isCancel && scoringMethod === 'survival') {
            const myScore = teamType === 'A' ? scoreA : scoreB;
            if (myScore <= 0) {
                alert("우리 팀 점수가 0점이므로 자책골을 기록할 수 없습니다.");
                return;
            }
        }

        let newScoreA = scoreA;
        let newScoreB = scoreB;
        const isTeamA = teamType === 'A';

        if (scoringMethod === 'survival') {
            if (isTeamA) {
                newScoreA = isCancel ? scoreA + 1 : scoreA - 1;
            } else {
                newScoreB = isCancel ? scoreB + 1 : scoreB - 1;
            }
        } else {
            if (isTeamA) {
                newScoreB = isCancel ? scoreB - 1 : scoreB + 1;
            } else {
                newScoreA = isCancel ? scoreA - 1 : scoreA + 1;
            }
        }

        newScoreA = Math.max(0, newScoreA);
        newScoreB = Math.max(0, newScoreB);

        await updateDoc(doc(db, 'classes', classId, 'matches', match.id), {
            teamA_score: newScoreA,
            teamB_score: newScoreB
        });
    };

    // 다른 경기가 진행중이면 '예정' 경기의 시작 버튼 비활성화
    const isStartDisabled = isAnyMatchInProgress && match.status === '예정';

    return (
        <MatchCard $isActive={isOpen} $isDimmed={!isOpen && match.status !== '진행중' && !isHeldAtTop}>
            {/* [추가] 카드 헤더 클릭으로 확장/축소 (원하는 경기 선택 가능) */}
            <MatchHeader style={{ cursor: 'pointer' }} onClick={() => onCardClick && onCardClick(match.id)}>
                <div className="teams">
                    <span>{teamA?.teamName || 'Team A'}</span>
                    <span className="vs">VS</span>
                    <span>{teamB?.teamName || 'Team B'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {match.matchOrder != null && <span style={{ fontSize: '0.8rem', color: '#adb5bd', fontWeight: 600 }}>#{match.matchOrder + 1}</span>}
                    {match.status === '예정' && <span style={{ color: '#adb5bd', fontWeight: 'bold' }}>경기 전</span>}
                    {match.status === '진행중' && <span style={{ color: '#fa5252', fontWeight: 'bold' }}>LIVE 🔴</span>}
                    {isCompleted && <span style={{ color: '#339af0', fontWeight: 'bold' }}>종료됨</span>}
                    {/* [추가] 관리자 수정 버튼 */}
                    {isCompleted && isAdmin && (
                        <button
                            onClick={e => { e.stopPropagation(); onEditMatch && onEditMatch(match); }}
                            style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ced4da', background: '#fff', cursor: 'pointer', color: '#868e96', fontWeight: 700 }}
                        >🛠 수정</button>
                    )}
                </div>
            </MatchHeader>

            <ScoreBoard>
                <TeamScoreDisplay>{scoreA}</TeamScoreDisplay>
                <span style={{ color: '#dee2e6', fontWeight: 'bold' }}>SCORE</span>
                <TeamScoreDisplay>{scoreB}</TeamScoreDisplay>
            </ScoreBoard>

            {isOpen && match.status === '진행중' && (
                <ScorerArea>
                    <ScorerList>
                        <h4>{teamA?.teamName} 선수 명단</h4>
                        {teamAMembers.map(p => (
                            <ScorerRow key={p.id}>
                                <div className="name-group">
                                    <span>{p.name}</span>
                                    {scorers[p.id] > 0 && <span className="goals">⚽ {scorers[p.id]}</span>}
                                </div>
                                <div className="controls">
                                    <ScoreBtn className="add" onClick={() => handleGoal(p.id, 'A')}>득점</ScoreBtn>
                                    <ScoreBtn className="cancel" onClick={() => handleGoal(p.id, 'A', true)}>취소</ScoreBtn>
                                </div>
                            </ScorerRow>
                        ))}
                        <ScorerRow style={{ background: '#fff0f6', borderColor: '#ffc9c9' }}>
                            <span style={{ color: '#c2255c' }}>자책골(실점)</span>
                            <div className="controls">
                                <ScoreBtn className="add" onClick={() => handleOwnGoal('A')}>자책</ScoreBtn>
                                <ScoreBtn className="cancel" onClick={() => handleOwnGoal('A', true)}>취소</ScoreBtn>
                            </div>
                        </ScorerRow>
                    </ScorerList>

                    <ScorerList>
                        <h4>{teamB?.teamName} 선수 명단</h4>
                        {teamBMembers.map(p => (
                            <ScorerRow key={p.id}>
                                <div className="name-group">
                                    <span>{p.name}</span>
                                    {scorers[p.id] > 0 && <span className="goals">⚽ {scorers[p.id]}</span>}
                                </div>
                                <div className="controls">
                                    <ScoreBtn className="add" onClick={() => handleGoal(p.id, 'B')}>득점</ScoreBtn>
                                    <ScoreBtn className="cancel" onClick={() => handleGoal(p.id, 'B', true)}>취소</ScoreBtn>
                                </div>
                            </ScorerRow>
                        ))}
                        <ScorerRow style={{ background: '#fff0f6', borderColor: '#ffc9c9' }}>
                            <span style={{ color: '#c2255c' }}>자책골(실점)</span>
                            <div className="controls">
                                <ScoreBtn className="add" onClick={() => handleOwnGoal('B')}>자책</ScoreBtn>
                                <ScoreBtn className="cancel" onClick={() => handleOwnGoal('B', true)}>취소</ScoreBtn>
                            </div>
                        </ScorerRow>
                    </ScorerList>
                </ScorerArea>
            )}

            <ControlBar>
                {match.status === '예정' ? (
                    <>
                        <GameButton
                            className={isStartDisabled ? "disabled" : "start"}
                            onClick={() => onStart(match.id)}
                            disabled={isStartDisabled}
                        >
                            {isStartDisabled ? "대기 중" : "📢 경기 시작"}
                        </GameButton>
                        <GameButton className="disabled" disabled>경기 종료</GameButton>
                        <GameButton className="disabled" disabled>다음 경기로</GameButton>
                    </>
                ) : match.status === '진행중' ? (
                    <>
                        <GameButton className="disabled" disabled>진행 중...</GameButton>
                        <GameButton className="end" onClick={() => onComplete(match.id, { a: scoreA, b: scoreB }, scorers)}>🏁 경기 종료</GameButton>
                        <GameButton className="disabled" disabled>다음 경기로</GameButton>
                    </>
                ) : isHeldAtTop ? (
                    <>
                        <GameButton className="disabled" disabled>종료됨</GameButton>
                        <GameButton className="disabled" disabled>종료됨</GameButton>
                        <GameButton className="next" onClick={onNext}>다음 경기로 ➡️</GameButton>
                    </>
                ) : (
                    <GameButton className="disabled" disabled>완료된 경기</GameButton>
                )}
            </ControlBar>
        </MatchCard>
    );
}

function RecorderDashboardPage() {
    const { classId } = useClassStore();
    const { players, missions, matches, missionSubmissions, seasons, teams } = useLeagueStore();
    const [processingIds, setProcessingIds] = useState(new Set());
    const [mainTab, setMainTab] = useState('league');
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const [activeMatchId, setActiveMatchId] = useState(null);
    const [lastCompletedMatchId, setLastCompletedMatchId] = useState(null);

    // [추가] 관리자 결과 수정 상태
    const [editingMatch, setEditingMatch] = useState(null); // { id, teamA_score, teamB_score, scorers }
    const [editScoreA, setEditScoreA] = useState(0);
    const [editScoreB, setEditScoreB] = useState(0);
    const [editScorers, setEditScorers] = useState({}); // { playerId: goals }

    useEffect(() => {
        loadConfetti();
    }, []);

    if (!players || !missions || !matches) {
        return <PageContainer><GlassWrapper>데이터 로딩 중...</GlassWrapper></PageContainer>;
    }

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    const isAdmin = myPlayerData?.role === 'admin';

    // [추가] 관리자 결과 수정 핸들러
    const handleOpenEdit = (match) => {
        setEditingMatch(match);
        setEditScoreA(match.teamA_score ?? 0);
        setEditScoreB(match.teamB_score ?? 0);
        setEditScorers({ ...(match.scorers || {}) });
    };

    const handleSaveEdit = async (withPointAdjust) => {
        if (!editingMatch || !classId) return;
        const confirmMsg = withPointAdjust
            ? `점수를 ${editScoreA} : ${editScoreB} 로 수정하고 포인트를 재정산하시겠습니까?\n\n기존 승/패 수당이 회수되고, 새 결과에 따라 재지급됩니다.`
            : `점수를 ${editScoreA} : ${editScoreB} 로 수정하시겠습니까? (포인트 변동 없음)`;
        if (!window.confirm(confirmMsg)) return;
        try {
            if (withPointAdjust) {
                await updateMatchScoresWithPointAdjust(
                    classId,
                    editingMatch.id,
                    { a: Number(editScoreA), b: Number(editScoreB) },
                    editScorers
                );
            } else {
                await updateMatchScores(
                    classId,
                    editingMatch.id,
                    { a: Number(editScoreA), b: Number(editScoreB) },
                    editScorers,
                    null // recorder incentive 없음
                );
            }
            setEditingMatch(null);
            alert('결과가 수정되었습니다.');
        } catch (e) {
            alert(`수정 오류: ${e.message}`);
        }
    };

    // [추가] 기록원이 원하는 경기부터 시작 — 경기 점프 핸들러
    const handleJumpToMatch = async (matchId) => {
        setActiveMatchId(matchId);
        setLastCompletedMatchId(null);

        // 방송 화면 동기화
        const target = matches.find(m => m.id === matchId);
        if (classId && target?.seasonId) {
            try {
                await updateSeason(classId, target.seasonId, { broadcastMatchId: matchId });
            } catch (e) {
                console.warn('broadcastMatchId 저장 실패:', e);
            }
        }

        setTimeout(() => {
            document.getElementById(`match-card-${matchId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    // 정렬 로직: 진행중(0) -> 완료후 대기중(1) -> 예정(2, matchOrder 순) -> 완료(3, matchOrder 순)
    const sortedMatches = useMemo(() => {
        return [...matches].sort((a, b) => {
            const getPriority = (m) => {
                if (m.status === '진행중') return 0;
                if (m.id === lastCompletedMatchId) return 1;
                if (m.status === '예정') return 2;
                return 3;
            };

            const pA = getPriority(a);
            const pB = getPriority(b);

            if (pA !== pB) return pA - pB;
            // [수정] round → matchOrder: 실제 저장된 필드명으로 보조 정렬
            return (a.matchOrder ?? 9999) - (b.matchOrder ?? 9999);
        });
    }, [matches, lastCompletedMatchId]);

    const isAnyMatchInProgress = useMemo(() => {
        return matches.some(m => m.status === '진행중');
    }, [matches]);

    // 자동 포커스: 처음 로드 시 또는 activeMatchId가 없을 때 최상단 경기 선택 + 방송화면 동기화
    useEffect(() => {
        if (sortedMatches.length > 0 && !activeMatchId) {
            const topMatch = sortedMatches[0];
            setActiveMatchId(topMatch.id);
            // 방송화면도 즉시 동기화
            if (classId && topMatch.seasonId) {
                updateSeason(classId, topMatch.seasonId, { broadcastMatchId: topMatch.id })
                    .catch(e => console.warn('broadcastMatchId 초기화 실패:', e));
            }
        }
    }, [sortedMatches, activeMatchId]);

    const activeMatch = useMemo(() => matches.find(m => m.id === activeMatchId), [matches, activeMatchId]);
    const activeSeason = useMemo(() => seasons?.find(s => s.id === activeMatch?.seasonId), [seasons, activeMatch]);
    const scoringMethod = activeSeason?.ruleType || 'survival';

    const handleMatchStart = async (matchId) => {
        if (isAnyMatchInProgress) {
            alert("이미 진행 중인 경기가 있습니다.");
            return;
        }
        if (window.confirm("경기를 시작하시겠습니까?")) {
            setLastCompletedMatchId(null);
            await updateMatchStartTime(classId, matchId);
            await updateMatchStatus(classId, matchId, '진행중');
            // 경기 시작 시에도 방송 화면 동기화
            const target = matches.find(m => m.id === matchId);
            if (classId && target?.seasonId) {
                try { await updateSeason(classId, target.seasonId, { broadcastMatchId: matchId }); }
                catch (e) { console.warn('broadcastMatchId 저장 실패:', e); }
            }
        }
    };

    const handleMatchComplete = async (matchId, scores, scorers) => {
        if (window.confirm("정말 경기를 종료하시겠습니까? (결과가 저장됩니다)")) {
            try {
                await updateMatchScores(
                    classId,
                    matchId,
                    scores,
                    scorers,
                    currentUser?.uid
                );

                setLastCompletedMatchId(matchId); // 상단 고정 설정

                // 소리 없음, 폭죽만
                if (window.confetti) {
                    window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                }
            } catch (error) {
                console.error(error);
                alert("오류 발생");
            }
        }
    };

    const handleNextMatch = async () => {
        // 현재 완료된 경기의 matchOrder 다음 경기를 찾아 자동 활성화
        const completedMatch = matches.find(m => m.id === lastCompletedMatchId);
        const completedOrder = completedMatch?.matchOrder ?? -1;
        const seasonId = completedMatch?.seasonId || activeMatch?.seasonId;

        // matchOrder 기준으로 완료된 경기 다음 "예정" 경기 탐색
        const nextMatch = [...matches]
            .filter(m => m.status === '예정')
            .sort((a, b) => (a.matchOrder ?? 9999) - (b.matchOrder ?? 9999))
            .find(m => (m.matchOrder ?? 9999) > completedOrder);

        const targetMatch = nextMatch || [...matches]
            .filter(m => m.status === '예정')
            .sort((a, b) => (a.matchOrder ?? 9999) - (b.matchOrder ?? 9999))[0];

        setLastCompletedMatchId(null); // 완료 고정 해제

        if (targetMatch) {
            setActiveMatchId(targetMatch.id); // 자동 활성화 (파란 테두리)

            // Firestore season.broadcastMatchId 저장 → 방송 화면 즉시 동기화
            if (classId && (targetMatch.seasonId || seasonId)) {
                try {
                    await updateSeason(classId, targetMatch.seasonId || seasonId, { broadcastMatchId: targetMatch.id });
                } catch (e) {
                    console.warn('broadcastMatchId 저장 실패:', e);
                }
            }

            // 해당 카드로 스크롤
            setTimeout(() => {
                document.getElementById(`match-card-${targetMatch.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const pendingSubmissions = useMemo(() => {
        const myRole = myPlayerData?.role;
        return missionSubmissions.filter(sub => {
            if (sub.status !== 'pending') return false;
            const mission = missions.find(m => m.id === sub.missionId);
            if (!mission) return false;
            if (mission.adminOnly && myRole !== 'admin') return false;
            return true;
        });
    }, [missionSubmissions, missions, myPlayerData]);

    const handleMissionAction = async (action, submission, reward) => {
        if (!classId) return;
        setProcessingIds(prev => new Set(prev).add(submission.id));
        const student = players.find(p => p.id === submission.studentId);
        const mission = missions.find(m => m.id === submission.missionId);

        if (!student || !mission || !currentUser) {
            alert('정보 오류'); return;
        }

        try {
            if (action === 'approve') await approveMissionsInBatch(classId, mission.id, [student.id], currentUser.uid, reward);
            else if (action === 'reject') await rejectMissionSubmission(classId, submission.id, student.authUid, mission.title);
        } catch (e) { console.error(e); }
    };

    return (
        <PageContainer>
            <GlassWrapper>
                <Header>
                    <h1>기록관 대시보드 📝</h1>
                    {activeSeason && (
                        <span className="mode-badge">
                            {scoringMethod === 'survival' ? '⚔️ 서바이벌(피구) 모드' : '⚽ 일반 득점 모드'} 적용 중
                        </span>
                    )}
                </Header>

                <TabContainer>
                    <TabButton $active={mainTab === 'league'} onClick={() => setMainTab('league')}>경기 기록</TabButton>
                    <TabButton $active={mainTab === 'mission'} onClick={() => setMainTab('mission')}>미션 승인</TabButton>
                </TabContainer>

                {mainTab === 'league' && (
                    <div>
                        <BroadcastFrame>
                            <BroadcastPage isMiniMode={true} />
                        </BroadcastFrame>

                        {/* [추가] 원하는 경기로 바로 이동하는 선택기 */}
                        <div style={{ background: '#e7f5ff', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#1971c2', whiteSpace: 'nowrap' }}>⚡ 경기 바로가기</span>
                            <select
                                value={activeMatchId || ''}
                                onChange={e => handleJumpToMatch(e.target.value)}
                                style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid #a5d8ff', fontSize: '0.95rem', fontWeight: 600, color: '#1c4a7e', background: 'white', cursor: 'pointer' }}
                            >
                                <option value="">-- 경기 선택 --</option>
                                {[...matches]
                                    .sort((a, b) => (a.matchOrder ?? 9999) - (b.matchOrder ?? 9999))
                                    .map(m => {
                                        const tA = teams.find(t => t.id === m.teamA_id);
                                        const tB = teams.find(t => t.id === m.teamB_id);
                                        const statusLabel = m.status === '진행중' ? '🔴 진행중' : m.status === '예정' ? '⏳ 예정' : '✅ 완료';
                                        const orderLabel = m.matchOrder != null ? `#${m.matchOrder + 1}` : '';
                                        return (
                                            <option key={m.id} value={m.id}>
                                                {orderLabel} {tA?.teamName ?? '?'} vs {tB?.teamName ?? '?'} [{statusLabel}]
                                            </option>
                                        );
                                    })}
                            </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: '#495057' }}>경기 리스트</h3>
                            <span style={{ fontSize: '0.9rem', color: '#868e96' }}>
                                {activeMatch ?
                                    `현재 선택됨: ${teams.find(t => t.id === activeMatch.teamA_id)?.teamName ?? '?'} vs ${teams.find(t => t.id === activeMatch.teamB_id)?.teamName ?? '?'}`
                                    : '선택된 경기 없음'
                                }
                            </span>
                        </div>

                        {sortedMatches.length > 0 ? (
                            sortedMatches.map(match => (
                                <div id={`match-card-${match.id}`} key={match.id}>
                                    <MatchRow
                                        match={match}
                                        isOpen={match.id === activeMatchId}
                                        onStart={handleMatchStart}
                                        onComplete={handleMatchComplete}
                                        onNext={handleNextMatch}
                                        scoringMethod={scoringMethod}
                                        isAnyMatchInProgress={isAnyMatchInProgress}
                                        lastCompletedId={lastCompletedMatchId}
                                        onCardClick={(matchId) => handleJumpToMatch(matchId)}
                                        isAdmin={isAdmin}
                                        onEditMatch={handleOpenEdit}
                                    />
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#adb5bd' }}>경기 일정이 없습니다.</div>
                        )}

                        {/* [추가] 관리자 경기 결과 수정 모달 */}
                        {editingMatch && isAdmin && (() => {
                            const eTeamA = teams.find(t => t.id === editingMatch.teamA_id);
                            const eTeamB = teams.find(t => t.id === editingMatch.teamB_id);
                            const eTeamAMembers = eTeamA?.members?.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
                            const eTeamBMembers = eTeamB?.members?.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
                            return (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                                    <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', width: '90%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                                        <h3 style={{ margin: '0 0 1.5rem 0', textAlign: 'center', color: '#343a40' }}>🛠 경기 결과 수정 (관리자)</h3>

                                        {/* 스코어 입력 */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#495057', fontSize: '0.9rem' }}>{eTeamA?.teamName ?? 'Team A'}</div>
                                                <input type="number" min="0" value={editScoreA} onChange={e => setEditScoreA(e.target.value)}
                                                    style={{ width: '100%', textAlign: 'center', fontSize: '2rem', fontWeight: 900, padding: '0.5rem', border: '2px solid #dee2e6', borderRadius: '12px' }} />
                                            </div>
                                            <span style={{ fontWeight: 900, color: '#adb5bd', fontSize: '1.5rem' }}>:</span>
                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#495057', fontSize: '0.9rem' }}>{eTeamB?.teamName ?? 'Team B'}</div>
                                                <input type="number" min="0" value={editScoreB} onChange={e => setEditScoreB(e.target.value)}
                                                    style={{ width: '100%', textAlign: 'center', fontSize: '2rem', fontWeight: 900, padding: '0.5rem', border: '2px solid #dee2e6', borderRadius: '12px' }} />
                                            </div>
                                        </div>

                                        {/* 득점자 편집 */}
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <div style={{ fontWeight: 700, color: '#495057', marginBottom: '0.8rem', fontSize: '0.95rem', borderBottom: '2px solid #e9ecef', paddingBottom: '0.4rem' }}>⚽ 득점자 수정</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#868e96', marginBottom: '0.5rem' }}>{eTeamA?.teamName}</div>
                                                    {eTeamAMembers.map(p => (
                                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '0.4rem' }}>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{p.name}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <button onClick={() => setEditScorers(prev => { const v = Math.max(0, (prev[p.id] || 0) - 1); const n = { ...prev }; if (v === 0) delete n[p.id]; else n[p.id] = v; return n; })}
                                                                    style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', lineHeight: 1 }}>-</button>
                                                                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{editScorers[p.id] || 0}</span>
                                                                <button onClick={() => setEditScorers(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                                                                    style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #dee2e6', background: '#dbe4ff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', lineHeight: 1, color: '#364fc7' }}>+</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#868e96', marginBottom: '0.5rem' }}>{eTeamB?.teamName}</div>
                                                    {eTeamBMembers.map(p => (
                                                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '0.4rem' }}>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{p.name}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <button onClick={() => setEditScorers(prev => { const v = Math.max(0, (prev[p.id] || 0) - 1); const n = { ...prev }; if (v === 0) delete n[p.id]; else n[p.id] = v; return n; })}
                                                                    style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #dee2e6', background: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', lineHeight: 1 }}>-</button>
                                                                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{editScorers[p.id] || 0}</span>
                                                                <button onClick={() => setEditScorers(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                                                                    style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid #dee2e6', background: '#dbe4ff', cursor: 'pointer', fontWeight: 900, fontSize: '1rem', lineHeight: 1, color: '#364fc7' }}>+</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', gap: '0.8rem' }}>
                                                <button onClick={() => setEditingMatch(null)} style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1px solid #dee2e6', background: '#f8f9fa', cursor: 'pointer', fontWeight: 700, color: '#495057' }}>취소</button>
                                                <button onClick={() => handleSaveEdit(false)} style={{ flex: 2, padding: '0.8rem', borderRadius: '10px', border: 'none', background: '#868e96', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}>💾 저장 (포인트 유지)</button>
                                            </div>
                                            <button onClick={() => handleSaveEdit(true)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: 'none', background: '#339af0', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}>
                                                💰 저장 + 포인트 재정산
                                            </button>
                                            <p style={{ fontSize: '0.8rem', color: '#868e96', textAlign: 'center', margin: 0 }}>
                                                포인트 재정산: 기존 승/패 수당을 회수하고 새 결과로 재지급합니다.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {mainTab === 'mission' && (
                    <div>
                        <h3 style={{ marginBottom: '1rem', color: '#495057' }}>승인 대기 ({pendingSubmissions.length})</h3>
                        {pendingSubmissions.map(sub => {
                            const student = players.find(p => p.id === sub.studentId);
                            const mission = missions.find(m => m.id === sub.missionId);
                            if (!mission) return null;
                            const isProcessing = processingIds.has(sub.id);

                            return (
                                <MissionItem key={sub.id}>
                                    <MissionHeader>
                                        <div className="info">
                                            <span>{student?.name}</span>
                                            <span style={{ color: '#adb5bd' }}>|</span>
                                            <span>{mission?.title}</span>
                                            {sub.text && <span className="badge text">글</span>}
                                            {(sub.photoUrl || (sub.photoUrls && sub.photoUrls.length > 0)) && <span className="badge photo">사진</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                            <ScoreBtn className="add" disabled={isProcessing} onClick={() => handleMissionAction('approve', sub, mission.reward)}>승인</ScoreBtn>
                                            <ScoreBtn className="cancel" disabled={isProcessing} onClick={() => handleMissionAction('reject', sub)}>거절</ScoreBtn>
                                        </div>
                                    </MissionHeader>
                                    <SubmissionContent>
                                        {sub.text && <p>{sub.text}</p>}
                                        {sub.photoUrls?.map((url, idx) => (
                                            <img key={idx} src={url} alt="submission" />
                                        ))}
                                        {sub.photoUrl && <img src={sub.photoUrl} alt="submission" />}
                                    </SubmissionContent>
                                </MissionItem>
                            )
                        })}
                        {pendingSubmissions.length === 0 && <div style={{ textAlign: 'center', color: '#adb5bd', padding: '2rem' }}>대기 중인 미션이 없습니다.</div>}
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <ScoreBtn style={{ background: '#f1f3f5', color: '#495057', padding: '0.8rem 2rem' }} onClick={() => navigate('/')}>홈으로</ScoreBtn>
                </div>
            </GlassWrapper>
        </PageContainer>
    );
}

export default RecorderDashboardPage;