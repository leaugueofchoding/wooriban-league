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

function RecorderDashboardPage() {
    const { players, missions } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

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
            <StyledButton onClick={() => navigate(-1)} style={{ marginTop: '2rem', alignSelf: 'center' }}>
                돌아가기
            </StyledButton>
        </Wrapper>
    );
}

export default RecorderDashboardPage;