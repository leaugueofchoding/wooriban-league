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

const ScoreInput = styled.input`
  width: 60px;
  text-align: center;
  margin: 0 0.5rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
`;

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

function MatchRow({ match }) {
    const { players, teams, saveScores, currentSeason } = useLeagueStore();
    const [scoreA, setScoreA] = useState(match.teamA_score ?? '');
    const [scoreB, setScoreB] = useState(match.teamB_score ?? '');
    const [showScorers, setShowScorers] = useState(false);
    const [scorers, setScorers] = useState(match.scorers || {});

    const isSeasonActive = currentSeason?.status === 'active';
    const teamA = teams.find(t => t.id === match.teamA_id);
    const teamB = teams.find(t => t.id === match.teamB_id);
    const teamAMembers = teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];
    const teamBMembers = teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [];

    const handleScorerChange = (playerId, goals) => {
        const goalCount = Number(goals);
        setScorers(prev => {
            const newScorers = { ...prev };
            if (goalCount > 0) newScorers[playerId] = goalCount;
            else delete newScorers[playerId];
            return newScorers;
        });
    };

    const handleSave = () => {
        const scores = { a: Number(scoreA), b: Number(scoreB) };
        if (isNaN(scores.a) || isNaN(scores.b)) {
            return alert('점수를 숫자로 입력해주세요.');
        }
        saveScores(match.id, scores, scorers);
        alert('저장되었습니다!');
    };

    return (
        <MatchItem>
            <MatchSummary>
                <TeamName>{teamA?.teamName || 'N/A'}</TeamName>
                <ScoreInput type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={!isSeasonActive} />
                <span>vs</span>
                <ScoreInput type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={!isSeasonActive} />
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
                            <strong>{teamA?.teamName}</strong>
                            {teamAMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span>{player.name}:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={scorers[player.id] || ''}
                                        onChange={(e) => handleScorerChange(player.id, e.target.value)}
                                        style={{ width: '60px' }}
                                    />
                                    <span>골</span>
                                </ScorerRow>
                            ))}
                        </TeamScorerList>
                        <TeamScorerList>
                            <strong>{teamB?.teamName}</strong>
                            {teamBMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span>{player.name}:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={scorers[player.id] || ''}
                                        onChange={(e) => handleScorerChange(player.id, e.target.value)}
                                        style={{ width: '60px' }}
                                    />
                                    <span>골</span>
                                </ScorerRow>
                            ))}
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
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    const filteredMatches = useMemo(() => {
        return matches.filter(m => (activeTab === 'pending' ? m.status !== '완료' : m.status === 'completed'));
    }, [matches, activeTab]);

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
                    filteredMatches.map(match => <MatchRow key={match.id} match={match} />)
                ) : <p>해당 목록에 경기가 없습니다.</p>}
            </Section>

            <StyledButton onClick={() => navigate(-1)} style={{ marginTop: '2rem', alignSelf: 'center' }}>
                돌아가기
            </StyledButton>
        </Wrapper>
    );
}

export default RecorderDashboardPage;