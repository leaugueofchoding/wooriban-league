// src/pages/RecorderDashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, approveMissionsInBatch, rejectMissionSubmission, updateMatchStatus } from '../api/firebase.js';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Section = styled.div`
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  flex-grow: 1;
`;

const ListItem = styled.li`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  &:last-child {
    border-bottom: none;
  }
`;

const StyledButton = styled.button`
  padding: 0.6em 1.2em;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  background-color: #1a1a1a;
  color: white;
  transition: background-color 0.2s;

  &:hover {
    background-color: #333;
  }

  &:disabled {
    background-color: #e9ecef;
    color: #6c757d;
    cursor: not-allowed;
    border-color: #dee2e6;
  }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
`;

const TabButton = styled.button`
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
`;

const MatchItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const MatchSummary = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
`;

const TeamName = styled.span`
  font-weight: bold;
  min-width: 100px;
  text-align: center;
`;

const VsText = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: #343a40;
  margin: 0 1rem;
`;

const ScorerSection = styled.div`
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
`;

const ScorerGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
`;

const TeamScorerList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const ScorerRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
`;

const ScoreControl = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ScoreButton = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #ced4da;
  font-size: 1.5rem;
  font-weight: bold;
  color: #495057;
  cursor: pointer;
  background-color: #f8f9fa;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  border-radius: 6px;

  &:hover {
    background-color: #e9ecef;
  }
  &:disabled {
    background-color: #e9ecef;
    color: #adb5bd;
    cursor: not-allowed;
  }
`;

const ScoreDisplay = styled.span`
  font-size: 2rem;
  font-weight: bold;
  width: 40px;
  text-align: center;
`;

const SubmissionDetails = styled.div`
    padding: ${props => props.$isOpen ? '1rem' : '0 1rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    border-top: ${props => props.$isOpen ? '1px solid #f0f0f0' : 'none'};
    margin-top: ${props => props.$isOpen ? '1rem' : '0'};

    p {
        background-color: #e9ecef;
        padding: 1rem;
        border-radius: 4px;
        white-space: pre-wrap;
        margin-top: 0;
    }

    img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin-top: 0.5rem;
    }
`;

const RemoteButton = styled.button`
    padding: 0.5rem 1rem;
    border: none;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
    
    &.start { background-color: #28a745; }
    &.end { background-color: #dc3545; }
    &.next { background-color: #007bff; }
`;


function MatchRow({ match, isInitiallyOpen, onStatusChange, onNext, isNextMatchAvailable }) {
    const { players, teams, saveScores } = useLeagueStore();
    const [showScorers, setShowScorers] = useState(isInitiallyOpen);

    const teamA = useMemo(() => teams.find(t => t.id === match.teamA_id), [teams, match.teamA_id]);
    const teamB = useMemo(() => teams.find(t => t.id === match.teamB_id), [teams, match.teamB_id]);

    const teamAMembers = useMemo(() => teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamA, players]);
    const teamBMembers = useMemo(() => teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamB, players]);

    const initialScore = useMemo(() => {
        if (match.status !== '예정') {
            return { a: match.teamA_score ?? 0, b: match.teamB_score ?? 0 };
        }
        const maxMembers = Math.max(teamAMembers.length, teamBMembers.length);
        return { a: match.teamA_score ?? maxMembers, b: match.teamB_score ?? maxMembers };
    }, [match, teamAMembers, teamBMembers]);

    const scoreA = initialScore.a;
    const scoreB = initialScore.b;
    const scorers = match.scorers || {};

    useEffect(() => {
        setShowScorers(isInitiallyOpen);
    }, [isInitiallyOpen]);

    const handleScoreChange = async (team, amount) => {
        const newScoreA = team === 'A' ? Math.max(0, scoreA + amount) : scoreA;
        const newScoreB = team === 'B' ? Math.max(0, scoreB + amount) : scoreB;

        await updateDoc(doc(db, 'matches', match.id), {
            teamA_score: newScoreA,
            teamB_score: newScoreB,
        });
    };

    // ▼▼▼ [핵심 수정] 득점 시 상대팀 점수 차감 및 예외처리 로직 강화 ▼▼▼
    const handleScorerChange = async (playerId, amount) => {
        const playerTeam = teamAMembers.some(p => p.id === playerId) ? 'A' : 'B';
        const currentGoals = scorers[playerId] || 0;

        // [-] 버튼 클릭 시: 득점이 0이면 아무것도 하지 않음
        if (amount === -1 && currentGoals === 0) {
            return;
        }

        // [+] 버튼 클릭 시: 상대팀 점수가 0이면 득점 불가
        if (amount === 1) {
            if (playerTeam === 'A' && scoreB === 0) {
                alert("상대팀의 점수가 0점이므로 더 이상 득점할 수 없습니다.");
                return;
            }
            if (playerTeam === 'B' && scoreA === 0) {
                alert("상대팀의 점수가 0점이므로 더 이상 득점할 수 없습니다.");
                return;
            }
        }

        const newScorers = { ...scorers };
        const newGoals = Math.max(0, currentGoals + amount);
        if (newGoals > 0) {
            newScorers[playerId] = newGoals;
        } else {
            delete newScorers[playerId];
        }

        const newScoreA = playerTeam === 'B' ? Math.max(0, scoreA - amount) : scoreA;
        const newScoreB = playerTeam === 'A' ? Math.max(0, scoreB - amount) : scoreB;

        await updateDoc(doc(db, 'matches', match.id), {
            scorers: newScorers,
            teamA_score: newScoreA,
            teamB_score: newScoreB
        });
    };

    const handleOwnGoalChange = async (team) => {
        const newScoreA = team === 'A' ? Math.max(0, scoreA - 1) : scoreA;
        const newScoreB = team === 'B' ? Math.max(0, scoreB - 1) : scoreB;

        await updateDoc(doc(db, 'matches', match.id), {
            teamA_score: newScoreA,
            teamB_score: newScoreB
        });
    };
    // ▲▲▲ 여기까지 수정 ▲▲▲

    const handleEndGame = () => {
        saveScores(match.id, { a: scoreA, b: scoreB }, scorers);
        onStatusChange(match.id, '완료');
    };

    return (
        <MatchItem>
            <MatchSummary>
                <TeamName>{teamA?.teamName || 'N/A'}</TeamName>
                <ScoreControl>
                    <ScoreButton onClick={() => handleScoreChange('A', -1)} disabled={match.status === '완료'}>-</ScoreButton>
                    <ScoreDisplay>{scoreA}</ScoreDisplay>
                    <ScoreButton onClick={() => handleScoreChange('A', 1)} disabled={match.status === '완료'}>+</ScoreButton>
                </ScoreControl>
                <VsText>vs</VsText>
                <ScoreControl>
                    <ScoreButton onClick={() => handleScoreChange('B', -1)} disabled={match.status === '완료'}>-</ScoreButton>
                    <ScoreDisplay>{scoreB}</ScoreDisplay>
                    <ScoreButton onClick={() => handleScoreChange('B', 1)} disabled={match.status === '완료'}>+</ScoreButton>
                </ScoreControl>
                <TeamName>{teamB?.teamName || 'N/A'}</TeamName>

                <div style={{ display: 'flex', gap: '0.5rem', width: '220px', justifyContent: 'flex-end' }}>
                    <StyledButton onClick={() => setShowScorers(s => !s)} disabled={match.status === '완료'}>득점</StyledButton>
                    {match.status === '예정' && (
                        <RemoteButton className="start" onClick={() => onStatusChange(match.id, '진행중')}>경기 시작</RemoteButton>
                    )}
                    {match.status === '진행중' && (
                        <RemoteButton className="end" onClick={handleEndGame}>경기 종료</RemoteButton>
                    )}
                    {match.status === '완료' && isNextMatchAvailable && (
                        <RemoteButton className="next" onClick={onNext}>다음 경기로</RemoteButton>
                    )}
                </div>
            </MatchSummary>
            {showScorers && (
                <ScorerSection>
                    <ScorerGrid>
                        <TeamScorerList>
                            {teamAMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span>{player.name}:</span>
                                    <ScoreControl>
                                        <ScoreButton onClick={() => handleScorerChange(player.id, -1)} disabled={match.status === '완료'}>-</ScoreButton>
                                        <ScoreDisplay style={{ fontSize: '1.2rem' }}>{scorers[player.id] || 0}</ScoreDisplay>
                                        <ScoreButton onClick={() => handleScorerChange(player.id, 1)} disabled={match.status === '완료'}>+</ScoreButton>
                                        <span>골</span>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                            <ScorerRow>
                                <span style={{ color: 'red' }}>자책:</span>
                                <ScoreControl>
                                    <ScoreButton onClick={() => handleOwnGoalChange('A')} disabled={match.status === '완료'}>+</ScoreButton>
                                </ScoreControl>
                            </ScorerRow>
                        </TeamScorerList>
                        <TeamScorerList>
                            {teamBMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span>{player.name}:</span>
                                    <ScoreControl>
                                        <ScoreButton onClick={() => handleScorerChange(player.id, -1)} disabled={match.status === '완료'}>-</ScoreButton>
                                        <ScoreDisplay style={{ fontSize: '1.2rem' }}>{scorers[player.id] || 0}</ScoreDisplay>
                                        <ScoreButton onClick={() => handleScorerChange(player.id, 1)} disabled={match.status === '완료'}>+</ScoreButton>
                                        <span>골</span>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                            <ScorerRow>
                                <span style={{ color: 'red' }}>자책:</span>
                                <ScoreControl>
                                    <ScoreButton onClick={() => handleOwnGoalChange('B')} disabled={match.status === '완료'}>+</ScoreButton>
                                </ScoreControl>
                            </ScorerRow>
                        </TeamScorerList>
                    </ScorerGrid>
                </ScorerSection>
            )}
        </MatchItem>
    );
}

function RecorderDashboardPage() {
    const { players, missions, matches, saveScores } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [mainTab, setMainTab] = useState('league');
    const [activeMatchTab, setActiveMatchTab] = useState('pending');
    const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    const sortedMatches = useMemo(() => {
        return [...matches].sort((a, b) => {
            const statusOrder = { '진행중': 1, '예정': 2, '완료': 3 };
            return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        });
    }, [matches]);

    const filteredMatches = useMemo(() => {
        return sortedMatches.filter(m => (activeMatchTab === 'pending' ? m.status !== '완료' : m.status === '완료'));
    }, [sortedMatches, activeMatchTab]);

    const nextUpcomingMatch = useMemo(() => {
        return sortedMatches.find(m => m.status === '예정');
    }, [sortedMatches]);

    const isNextMatchAvailable = useMemo(() => {
        const completedMatches = sortedMatches.filter(m => m.status === '완료');
        const lastCompleted = completedMatches[completedMatches.length - 1];
        return lastCompleted && nextUpcomingMatch;
    }, [sortedMatches, nextUpcomingMatch]);

    const currentOrNextMatchId = useMemo(() => {
        const inProgress = sortedMatches.find(m => m.status === '진행중');
        if (inProgress) return inProgress.id;
        return nextUpcomingMatch?.id || null;
    }, [sortedMatches, nextUpcomingMatch]);


    useEffect(() => {
        const submissionsRef = collection(db, "missionSubmissions");
        const q = query(submissionsRef, where("status", "==", "pending"), orderBy("requestedAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const submissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const validSubmissions = submissions.filter(sub =>
                missions.some(m => m.id === sub.missionId)
            );
            setPendingSubmissions(validSubmissions);
        });
        return () => unsubscribe();
    }, [missions]);

    const handleAction = async (action, submission) => {
        setProcessingIds(prev => new Set(prev).add(submission.id));
        const student = players.find(p => p.id === submission.studentId);
        const mission = missions.find(m => m.id === submission.missionId);
        if (!student || !mission || !currentUser) {
            alert('정보를 찾을 수 없습니다.');
            return;
        }
        try {
            if (action === 'approve') {
                await approveMissionsInBatch(mission.id, [student.id], currentUser.uid, mission.reward);
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
            }
        } catch (error) {
            console.error(`미션 처리 오류:`, error);
        }
    };

    const handleMatchStatusChange = async (matchId, newStatus) => {
        await updateMatchStatus(matchId, newStatus);
    };

    const handleNextMatch = () => {
        // This function is just to trigger UI update.
        // The actual next match is shown automatically by onSnapshot.
    };

    return (
        <Wrapper>
            <TabContainer>
                <TabButton $active={mainTab === 'mission'} onClick={() => setMainTab('mission')}>미션 승인</TabButton>
                <TabButton $active={mainTab === 'league'} onClick={() => setMainTab('league')}>경기 관리</TabButton>
            </TabContainer>

            {mainTab === 'mission' && (
                <Section>
                    <SectionTitle>승인 대기중인 미션 ✅ ({pendingSubmissions.length}건)</SectionTitle>
                    {pendingSubmissions.length > 0 ? (
                        <List>
                            {pendingSubmissions.map(sub => {
                                const student = players.find(p => p.id === sub.studentId);
                                const mission = missions.find(m => m.id === sub.missionId);
                                const isProcessing = processingIds.has(sub.id);
                                const isMyOwnSubmission = myPlayerData?.id === sub.studentId;
                                const isOpen = expandedSubmissionId === sub.id;

                                if (!mission) return null;

                                const hasContent = sub.text || sub.photoUrl;

                                return (
                                    <ListItem key={sub.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: hasContent ? 'pointer' : 'default' }} onClick={() => hasContent && setExpandedSubmissionId(prev => prev === sub.id ? null : sub.id)}>
                                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {student?.name} - [{mission?.title}]
                                                {sub.text && <span style={{ color: '#28a745', fontWeight: 'bold', marginLeft: '0.5rem' }}>[글]</span>}
                                                {sub.photoUrl && <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>[사진]</span>}
                                            </span>
                                            <span style={{ fontWeight: 'bold', color: '#007bff', margin: '0 1rem' }}>{mission?.reward}P</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <StyledButton
                                                    onClick={(e) => { e.stopPropagation(); handleAction('approve', sub); }}
                                                    style={{ backgroundColor: '#28a745' }}
                                                    disabled={isProcessing || isMyOwnSubmission}
                                                    title={isMyOwnSubmission ? "자신의 미션은 승인할 수 없습니다." : ""}
                                                >
                                                    {isProcessing ? '처리중...' : '승인'}
                                                </StyledButton>
                                                <StyledButton
                                                    onClick={(e) => { e.stopPropagation(); handleAction('reject', sub); }}
                                                    style={{ backgroundColor: '#dc3545' }}
                                                    disabled={isProcessing || isMyOwnSubmission}
                                                    title={isMyOwnSubmission ? "자신의 미션은 거절할 수 없습니다." : ""}
                                                >
                                                    거절
                                                </StyledButton>
                                            </div>
                                        </div>
                                        <SubmissionDetails $isOpen={isOpen}>
                                            {sub.text && <p>{sub.text}</p>}
                                            {sub.photoUrl && <img src={sub.photoUrl} alt="제출된 사진" />}
                                        </SubmissionDetails>
                                    </ListItem>
                                )
                            })}
                        </List>
                    ) : <p>현재 승인을 기다리는 미션이 없습니다.</p>}
                </Section>
            )}

            {mainTab === 'league' && (
                <Section>
                    <SectionTitle>경기 결과 입력 ⚽</SectionTitle>
                    <TabContainer>
                        <TabButton $active={activeMatchTab === 'pending'} onClick={() => setActiveMatchTab('pending')}>대기/진행중 경기</TabButton>
                        <TabButton $active={activeMatchTab === 'completed'} onClick={() => setActiveMatchTab('completed')}>완료된 경기</TabButton>
                    </TabContainer>
                    {filteredMatches.length > 0 ? (
                        filteredMatches.map(match =>
                            <MatchRow
                                key={match.id}
                                match={match}
                                isInitiallyOpen={match.id === currentOrNextMatchId}
                                onStatusChange={handleMatchStatusChange}
                                onNext={handleNextMatch}
                                isNextMatchAvailable={isNextMatchAvailable}
                            />
                        )
                    ) : <p>해당 목록에 경기가 없습니다.</p>}
                </Section>
            )}

            <StyledButton onClick={() => navigate(-1)} style={{ marginTop: '2rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
                돌아가기
            </StyledButton>
        </Wrapper>
    );
}

export default RecorderDashboardPage;