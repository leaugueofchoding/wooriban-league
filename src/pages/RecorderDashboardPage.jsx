// src/pages/RecorderDashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, approveMissionsInBatch, rejectMissionSubmission } from '../api/firebase.js';
import { collection, query, where, onSnapshot } from "firebase/firestore";
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
  margin: 0 1rem; /* 양 옆에 간격을 줍니다 */
`;
// ▲▲▲ 여기까지 추가해주세요 ▲▲▲

const SaveButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
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

function MatchRow({ match, isInitiallyOpen, onSave }) {
    const { players, teams, saveScores, currentSeason } = useLeagueStore();

    const teamA = useMemo(() => teams.find(t => t.id === match.teamA_id), [teams, match.teamA_id]);
    const teamB = useMemo(() => teams.find(t => t.id === match.teamB_id), [teams, match.teamB_id]);

    const teamAMembers = useMemo(() => {
        const members = teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
        return members;
    }, [teamA, players]);

    const teamBMembers = useMemo(() => {
        const members = teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
        return members;
    }, [teamB, players]);

    const initialScore = useMemo(() => {
        if (typeof match.teamA_score === 'number' && typeof match.teamB_score === 'number') {
            return { a: match.teamA_score, b: match.teamB_score };
        }
        const maxMembers = Math.max(teamAMembers.length, teamBMembers.length);
        return { a: maxMembers, b: maxMembers };
    }, [match, teamAMembers, teamBMembers]);

    const [scoreA, setScoreA] = useState(initialScore.a);
    const [scoreB, setScoreB] = useState(initialScore.b);
    const [showScorers, setShowScorers] = useState(isInitiallyOpen);
    const [scorers, setScorers] = useState(match.scorers || {});
    const [ownGoals, setOwnGoals] = useState({ A: 0, B: 0 });

    const isSeasonActive = currentSeason?.status === 'active';

    useEffect(() => {
        setShowScorers(isInitiallyOpen);
    }, [isInitiallyOpen]);

    const handleScorerChange = (playerId, amount) => {
        const playerTeam = teamAMembers.some(p => p.id === playerId) ? 'A' : 'B';
        const currentGoals = scorers[playerId] || 0;

        if (amount === -1 && currentGoals === 0) return;
        if (amount === 1) {
            if (playerTeam === 'A' && scoreB === 0) return;
            if (playerTeam === 'B' && scoreA === 0) return;
        }

        setScorers(prev => {
            const newGoals = Math.max(0, currentGoals + amount);
            const newScorers = { ...prev };
            if (newGoals > 0) {
                newScorers[playerId] = newGoals;
            } else {
                delete newScorers[playerId];
            }
            return newScorers;
        });

        if (playerTeam === 'A') {
            setScoreB(s => Math.max(0, s - amount));
        } else {
            setScoreA(s => Math.max(0, s - amount));
        }
    };

    const handleOwnGoalChange = (team, amount) => {
        const currentOwnGoals = ownGoals[team];

        if (amount === -1 && currentOwnGoals === 0) return;

        if (team === 'A') {
            if (amount === 1 && scoreA === 0) return;
            setScoreA(s => Math.max(0, s - amount));
        } else {
            if (amount === 1 && scoreB === 0) return;
            setScoreB(s => Math.max(0, s - amount));
        }

        setOwnGoals(prev => ({
            ...prev,
            [team]: Math.max(0, currentOwnGoals + amount)
        }));
    };

    const handleSave = () => {
        saveScores(match.id, { a: scoreA, b: scoreB }, scorers);
        alert('저장되었습니다!');
        onSave(match.id);
    };

    return (
        <MatchItem>
            <MatchSummary>
                <TeamName>{teamA?.teamName || 'N/A'}</TeamName>
                <ScoreControl>
                    <ScoreButton onClick={() => setScoreA(s => Math.max(0, s - 1))} disabled={!isSeasonActive}>-</ScoreButton>
                    <ScoreDisplay>{scoreA}</ScoreDisplay>
                    <ScoreButton onClick={() => setScoreA(s => s + 1)} disabled={!isSeasonActive}>+</ScoreButton>
                </ScoreControl>
                <VsText>vs</VsText>
                <ScoreControl>
                    <ScoreButton onClick={() => setScoreB(s => Math.max(0, s - 1))} disabled={!isSeasonActive}>-</ScoreButton>
                    <ScoreDisplay>{scoreB}</ScoreDisplay>
                    <ScoreButton onClick={() => setScoreB(s => s + 1)} disabled={!isSeasonActive}>+</ScoreButton>
                </ScoreControl>
                <TeamName>{teamB?.teamName || 'N/A'}</TeamName>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <SaveButton onClick={() => setShowScorers(s => !s)} disabled={!isSeasonActive}>득점</SaveButton>
                    <SaveButton onClick={handleSave} disabled={!isSeasonActive}>저장</SaveButton>
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
                                        <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, -1)}>-</ScoreButton>
                                        <ScoreDisplay style={{ width: '20px', fontSize: '1.2rem' }}>{scorers[player.id] || 0}</ScoreDisplay>
                                        <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, 1)}>+</ScoreButton>
                                        <span>골</span>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                            <ScorerRow>
                                <span style={{ color: 'red' }}>자책:</span>
                                <ScoreControl>
                                    <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleOwnGoalChange('A', -1)}>-</ScoreButton>
                                    <ScoreDisplay style={{ width: '20px', fontSize: '1.2rem' }}>{ownGoals.A}</ScoreDisplay>
                                    <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleOwnGoalChange('A', 1)}>+</ScoreButton>
                                    <span>골</span>
                                </ScoreControl>
                            </ScorerRow>
                        </TeamScorerList>
                        <TeamScorerList>
                            {teamBMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span>{player.name}:</span>
                                    <ScoreControl>
                                        <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, -1)}>-</ScoreButton>
                                        <ScoreDisplay style={{ width: '20px', fontSize: '1.2rem' }}>{scorers[player.id] || 0}</ScoreDisplay>
                                        <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, 1)}>+</ScoreButton>
                                        <span>골</span>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                            <ScorerRow>
                                <span style={{ color: 'red' }}>자책:</span>
                                <ScoreControl>
                                    <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleOwnGoalChange('B', -1)}>-</ScoreButton>
                                    <ScoreDisplay style={{ width: '20px', fontSize: '1.2rem' }}>{ownGoals.B}</ScoreDisplay>
                                    <ScoreButton style={{ width: '28px', height: '28px', fontSize: '1rem' }} onClick={() => handleOwnGoalChange('B', 1)}>+</ScoreButton>
                                    <span>골</span>
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
    const { players, missions, matches } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [activeTab, setActiveTab] = useState('pending');
    const [openedMatchId, setOpenedMatchId] = useState(null);
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    const filteredMatches = useMemo(() => {
        return matches.filter(m => (activeTab === 'pending' ? m.status !== '완료' : m.status === '완료'));
    }, [matches, activeTab]);

    useEffect(() => {
        const pendingMatches = matches.filter(m => m.status !== '완료');
        if (pendingMatches.length > 0) {
            setOpenedMatchId(pendingMatches[0].id);
        } else {
            setOpenedMatchId(null);
        }
    }, [matches]);

    useEffect(() => {
        const submissionsRef = collection(db, "missionSubmissions");
        const q = query(submissionsRef, where("status", "==", "pending"));

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
            alert('학생 또는 미션 정보를 찾을 수 없거나, 사용자 정보가 없습니다.');
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(submission.id);
                return newSet;
            });
            return;
        }

        try {
            if (action === 'approve') {
                await approveMissionsInBatch(mission.id, [student.id], currentUser.uid, mission.reward);
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
            }
        } catch (error) {
            console.error(`미션 ${action} 오류:`, error);
            alert(`${action === 'approve' ? '승인' : '거절'} 처리 중 오류가 발생했습니다.`);
        }
    };

    const handleSaveAndOpenNext = (savedMatchId) => {
        const pendingMatches = matches.filter(m => m.status !== '완료');
        const currentIndex = pendingMatches.findIndex(m => m.id === savedMatchId);

        const nextMatch = pendingMatches[currentIndex + 1];
        setOpenedMatchId(nextMatch ? nextMatch.id : null);
    };

    return (
        <Wrapper>
            <Section>
                <SectionTitle>승인 대기중인 미션 ✅ ({pendingSubmissions.length}건)</SectionTitle>
                {pendingSubmissions.length === 0 ? (
                    <p>현재 승인을 기다리는 미션이 없습니다.</p>
                ) : (
                    <List>
                        {pendingSubmissions.map(sub => {
                            const student = players.find(p => p.id === sub.studentId);
                            const mission = missions.find(m => m.id === sub.missionId);
                            const isProcessing = processingIds.has(sub.id);
                            const isMyOwnSubmission = myPlayerData?.id === sub.studentId;

                            if (!mission) return null;

                            return (
                                <ListItem key={sub.id}>
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {student?.name} - [{mission?.title}]
                                    </span>
                                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>{mission?.reward}P</span>
                                    <StyledButton
                                        onClick={() => handleAction('approve', sub)}
                                        style={{ backgroundColor: '#28a745' }}
                                        disabled={isProcessing || isMyOwnSubmission}
                                        title={isMyOwnSubmission ? "자신의 미션은 승인할 수 없습니다." : ""}
                                    >
                                        {isProcessing ? '처리중...' : '승인'}
                                    </StyledButton>
                                    <StyledButton
                                        onClick={() => handleAction('reject', sub)}
                                        style={{ backgroundColor: '#dc3545' }}
                                        disabled={isProcessing || isMyOwnSubmission}
                                        title={isMyOwnSubmission ? "자신의 미션은 거절할 수 없습니다." : ""}
                                    >
                                        거절
                                    </StyledButton>
                                </ListItem>
                            )
                        })}
                    </List>
                )}
            </Section>

            <Section>
                <SectionTitle>경기 결과 입력 ⚽</SectionTitle>
                <TabContainer>
                    <TabButton $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>입력 대기</TabButton>
                    <TabButton $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>입력 완료</TabButton>
                </TabContainer>
                {filteredMatches.length > 0 ? (
                    filteredMatches.map(match =>
                        <MatchRow
                            key={match.id}
                            match={match}
                            isInitiallyOpen={openedMatchId === match.id}
                            onSave={handleSaveAndOpenNext}
                        />
                    )
                ) : <p>해당 목록에 경기가 없습니다.</p>}
            </Section>

            <StyledButton onClick={() => navigate(-1)} style={{ marginTop: '2rem', alignSelf: 'center' }}>
                돌아가기
            </StyledButton>
        </Wrapper>
    );
}

export default RecorderDashboardPage;