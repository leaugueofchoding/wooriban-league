// src/pages/admin/tabs/MissionTab.jsx
import React, { useState, useEffect } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    auth, db, createClassGoal, getActiveGoals,
    deleteClassGoal, completeClassGoal, updateClassGoalStatus,
    approveMissionsInBatch, rejectMissionSubmission,
    createQuest, listenQuests, updateQuest, deleteQuest, completeQuestForPlayer, rejectQuestCompletion,
} from '../../../api/firebase';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import RecorderPage from '../../RecorderPage';
import ApprovalModal from '../../../components/ApprovalModal';
import {
    Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, PendingListItem, SaveButton,
    DragHandle, MissionControls, ToggleButton,
    ScoreInput, TextArea
} from '../Admin.style';

function PendingMissionWidget({ setModalImageSrc }) {
    const { classId } = useClassStore();
    const { players, missions } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
    const [frozenSubmission, setFrozenSubmission] = useState(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!classId) return;

        const submissionsRef = collection(db, "classes", classId, "missionSubmissions");
        const q = query(submissionsRef, where("status", "==", "pending"), orderBy("requestedAt", "asc"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const submissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const validSubmissions = submissions.filter(sub =>
                missions.some(m => m.id === sub.missionId)
            );
            setPendingSubmissions(validSubmissions);
        });

        return () => unsubscribe();
    }, [classId, missions]);

    const handleModalOpen = (id) => {
        setSelectedSubmissionId(id);
        setFrozenSubmission(null);
    };
    const handleModalClose = () => {
        setSelectedSubmissionId(null);
        setFrozenSubmission(null);
    };

    const activeSubmission = frozenSubmission || pendingSubmissions.find(s => s.id === selectedSubmissionId) || null;
    const currentIndex = activeSubmission ? pendingSubmissions.findIndex(s => s.id === activeSubmission.id) : -1;

    const handleNext = () => {
        if (pendingSubmissions.length === 0) return;
        if (frozenSubmission) {
            const nextSub = pendingSubmissions[0];
            if (nextSub) {
                setSelectedSubmissionId(nextSub.id);
                setFrozenSubmission(null);
            }
        } else {
            const liveIndex = pendingSubmissions.findIndex(s => s.id === selectedSubmissionId);
            const nextIndex = liveIndex >= 0 && liveIndex < pendingSubmissions.length - 1 ? liveIndex + 1 : 0;
            const nextSub = pendingSubmissions[nextIndex];
            if (nextSub) {
                setSelectedSubmissionId(nextSub.id);
                setFrozenSubmission(null);
            }
        }
    };
    const handlePrev = () => {
        const liveIndex = pendingSubmissions.findIndex(s => s.id === selectedSubmissionId);
        const prevIndex = liveIndex > 0 ? liveIndex - 1 : 0;
        const prevSub = pendingSubmissions[prevIndex];
        if (prevSub) {
            setSelectedSubmissionId(prevSub.id);
            setFrozenSubmission(null);
        }
    };

    const handleActionInModal = (actedSubmissionId, actionStatus) => {
        if (actionStatus === 'pending') {
            // 오류 롤백: frozenSubmission 해제하여 목록에서 다시 찾도록 복원
            setFrozenSubmission(null);
            return;
        }
        const sub = pendingSubmissions.find(s => s.id === actedSubmissionId);
        if (sub) {
            setFrozenSubmission({ ...sub, status: actionStatus });
        } else {
            // onSnapshot이 이미 목록에서 제거했을 경우를 대비해 frozenSubmission 유지
            setFrozenSubmission(prev => prev ? { ...prev, status: actionStatus } : null);
        }
    };

    const handleAction = async (action, submission, reward) => {
        if (!classId) return;
        setProcessingIds(prev => new Set(prev.add(submission.id)));
        const student = players.find(p => p.id === submission.studentId);
        const mission = missions.find(m => m.id === submission.missionId);

        if (!student || !mission || !currentUser) {
            alert('학생 또는 미션 정보를 찾을 수 없거나, 관리자 정보가 없습니다.');
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(submission.id);
                return newSet;
            });
            return;
        }

        try {
            if (action === 'approve') {
                await approveMissionsInBatch(classId, mission.id, [student.id], currentUser.uid, reward);
            } else if (action === 'reject') {
                await rejectMissionSubmission(classId, submission.id, student.authUid, mission.title);
            }
        } catch (error) {
            console.error(`미션 ${action} 오류:`, error);
            alert(`${action === 'approve' ? '승인' : '거절'} 처리 중 오류가 발생했습니다.`);
        }
    };

    return (
        <Section>
            <SectionTitle>승인 대기중인 미션 ✅ ({pendingSubmissions.length}건)</SectionTitle>
            {pendingSubmissions.length === 0 ? (
                <p>현재 승인을 기다리는 미션이 없습니다.</p>
            ) : (
                <List>
                    {pendingSubmissions.map((sub, index) => {
                        const student = players.find(p => p.id === sub.studentId);
                        const mission = missions.find(m => m.id === sub.missionId);
                        const isProcessing = processingIds.has(sub.id);
                        const isTieredReward = mission?.rewards && mission.rewards.length > 1;

                        if (!mission) return null;

                        return (
                            <PendingListItem key={sub.id} onClick={() => handleModalOpen(sub.id)}>
                                <div>
                                    {student?.name} - [{mission?.title}]
                                    {sub.text && <span style={{ color: '#28a745', fontWeight: 'bold', marginLeft: '0.5rem' }}>[글]</span>}
                                    {sub.photoUrls && sub.photoUrls.length > 0 && <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>[사진]</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {isTieredReward ? (
                                        mission.rewards.map(reward => (
                                            <StyledButton key={reward} onClick={(e) => { e.stopPropagation(); handleAction('approve', sub, reward); }} style={{ backgroundColor: '#28a745' }} disabled={isProcessing}>
                                                {isProcessing ? '...' : `${reward}P`}
                                            </StyledButton>
                                        ))
                                    ) : (
                                        <StyledButton onClick={(e) => { e.stopPropagation(); handleAction('approve', sub, mission.reward); }} style={{ backgroundColor: '#28a745' }} disabled={isProcessing}>
                                            {isProcessing ? '처리중...' : `${mission.reward}P`}
                                        </StyledButton>
                                    )}
                                    <StyledButton onClick={(e) => { e.stopPropagation(); handleAction('reject', sub); }} style={{ backgroundColor: '#dc3545' }} disabled={isProcessing}>거절</StyledButton>
                                </div>
                            </PendingListItem>
                        )
                    })}
                </List>
            )}
            {activeSubmission && (
                <ApprovalModal
                    submission={activeSubmission}
                    onClose={handleModalClose}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    currentIndex={currentIndex >= 0 ? currentIndex : 0}
                    totalCount={pendingSubmissions.length}
                    onAction={(id, actionStatus) => handleActionInModal(id, actionStatus)}
                    onImageClick={(imageData) => setModalImageSrc(imageData)}
                />
            )}
        </Section>
    );
}

function GoalManager() {
    const { classId } = useClassStore();
    const [title, setTitle] = useState('');
    const [targetPoints, setTargetPoints] = useState(10000);
    const [activeGoals, setActiveGoals] = useState([]);

    const fetchGoals = async () => {
        if (!classId) return;
        const goals = await getActiveGoals(classId);
        setActiveGoals(goals);
    };

    useEffect(() => { fetchGoals(); }, [classId]);

    const handleCreateGoal = async () => {
        if (!classId) return;
        if (!title.trim() || targetPoints <= 0) return alert('목표 이름과 올바른 목표 포인트를 입력해주세요.');
        try {
            await createClassGoal(classId, { title, targetPoints: Number(targetPoints) });
            alert('새로운 학급 목표가 설정되었습니다!');
            setTitle(''); setTargetPoints(10000); fetchGoals();
        } catch (error) { alert(`목표 생성 실패: ${error.message}`); }
    };

    const handleGoalStatusToggle = async (goal) => {
        if (!classId) return;
        const newStatus = goal.status === 'paused' ? 'active' : 'paused';
        const actionText = newStatus === 'paused' ? '일시중단' : '다시시작';
        if (window.confirm(`'${goal.title}' 목표를 '${actionText}' 상태로 변경하시겠습니까?`)) {
            try { await updateClassGoalStatus(classId, goal.id, newStatus); alert(`목표가 ${actionText} 처리되었습니다.`); fetchGoals(); }
            catch (error) { alert(`상태 변경 실패: ${error.message}`); }
        }
    };

    const handleGoalDelete = async (goalId) => {
        if (!classId) return;
        if (window.confirm("정말로 이 목표를 삭제하시겠습니까? 기부 내역도 함께 사라집니다.")) {
            try { await deleteClassGoal(classId, goalId); alert('목표가 삭제되었습니다.'); fetchGoals(); }
            catch (error) { alert(`삭제 실패: ${error.message}`); }
        }
    };

    const handleGoalComplete = async (goalId) => {
        if (!classId) return;
        if (window.confirm("이 목표를 '완료' 처리하여 대시보드에서 숨기시겠습니까?")) {
            try { await completeClassGoal(classId, goalId); alert('목표가 완료 처리되었습니다.'); fetchGoals(); }
            catch (error) { alert(`완료 처리 실패: ${error.message}`); }
        }
    };

    return (
        <div style={{ padding: '0.5rem' }}>
            <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '1.1rem', color: '#495057' }}>🎯 새 학급 목표 설정</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="목표 이름 (예: 2단계-영화 보는 날)" style={{ flex: 1, minWidth: '200px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} />
                    <ScoreInput type="number" value={targetPoints} onChange={(e) => setTargetPoints(e.target.value)} style={{ width: '130px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} placeholder="목표 점수" />
                    <SaveButton onClick={handleCreateGoal} style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>새 목표 설정</SaveButton>
                </div>
            </div>

            <div>
                <h4 style={{ fontSize: '1.1rem', color: '#495057', marginBottom: '1rem' }}>진행 중인 목표 목록</h4>
                <List>
                    {activeGoals.length > 0 ? (
                        activeGoals.map(goal => (
                            <ListItem key={goal.id} style={{ gridTemplateColumns: '1fr auto', borderLeft: '4px solid #fcc419' }}>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{goal.title}</span>
                                    {goal.status === 'paused' && <span style={{ marginLeft: '1rem', color: '#ffc107', fontWeight: 'bold' }}>[일시중단됨]</span>}
                                    <span style={{ marginLeft: '1rem', color: '#6c757d', fontSize: '0.9rem' }}>({goal.currentPoints.toLocaleString()} / {goal.targetPoints.toLocaleString()} P)</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <SaveButton onClick={() => handleGoalStatusToggle(goal)} style={{ backgroundColor: goal.status === 'paused' ? '#17a2b8' : '#ffc107', color: goal.status === 'paused' ? 'white' : 'black', padding: '0.4rem 1rem' }}>
                                        {goal.status === 'paused' ? '다시시작' : '일시중단'}
                                    </SaveButton>
                                    <SaveButton onClick={() => handleGoalComplete(goal.id)} style={{ backgroundColor: '#28a745', padding: '0.4rem 1rem' }} disabled={goal.currentPoints < goal.targetPoints} title={goal.currentPoints < goal.targetPoints ? "아직 달성되지 않은 목표입니다." : ""}>
                                        완료 처리
                                    </SaveButton>
                                    <SaveButton onClick={() => handleGoalDelete(goal.id)} style={{ backgroundColor: '#dc3545', padding: '0.4rem 1rem' }}>삭제</SaveButton>
                                </div>
                            </ListItem>
                        ))
                    ) : <p style={{ color: '#adb5bd' }}>현재 진행 중인 학급 목표가 없습니다.</p>}
                </List>
            </div>
        </div>
    );
}

function SortableListItem(props) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const { mission, handleEditClick, archiveMission, unarchiveMission, removeMission, onNavigate } = props;

    const handleDelete = () => {
        if (window.confirm("정말로 이 미션을 삭제하시겠습니까? 제출된 기록도 모두 삭제됩니다.")) {
            removeMission(mission.id);
        }
    };

    const handleArchive = () => {
        if (mission.status === 'active') archiveMission(mission.id);
        else unarchiveMission(mission.id);
    };

    return (
        <ListItem ref={setNodeRef} style={style} {...attributes}>
            <DragHandle {...listeners}>⋮⋮</DragHandle>
            <div>
                <strong>{mission.title}</strong>
                <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                    ({mission.reward}P)
                    {mission.submissionType?.includes('text') && ' [글]'}
                    {mission.submissionType?.includes('photo') && ' [사진]'}
                </span>
                {mission.adminOnly && <span style={{ marginLeft: '0.5rem', color: 'red', fontSize: '0.8rem' }}>[관리자전용]</span>}
                {mission.isFixed && <span style={{ marginLeft: '0.5rem', color: 'blue', fontSize: '0.8rem' }}>[반복]</span>}
            </div>
            <MissionControls>
                <StyledButton onClick={() => onNavigate(mission.id)} style={{ backgroundColor: '#17a2b8' }}>기록</StyledButton>
                <StyledButton onClick={() => handleEditClick(mission)} style={{ backgroundColor: '#ffc107', color: 'black' }}>수정</StyledButton>
                <StyledButton onClick={handleArchive} style={{ backgroundColor: '#6c757d' }}>{mission.status === 'active' ? '숨김' : '복구'}</StyledButton>
                <StyledButton onClick={handleDelete} style={{ backgroundColor: '#dc3545' }}>삭제</StyledButton>
            </MissionControls>
        </ListItem>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 퀘스트 완료 승인/반려 위젯 (관리자 전용 — 승인 탭)
// ─────────────────────────────────────────────────────────────────────────────
function QuestApprovalWidget() {
    const { classId } = useClassStore();
    const [quests, setQuests] = useState([]);
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (!classId) return;
        return listenQuests(classId, (data) => {
            setQuests(data.filter(q =>
                q.status === 'open' &&
                (q.acceptors || []).some(a => a.completionStatus === 'pending')
            ));
        });
    }, [classId]);

    const handleApprove = async (quest, acceptor) => {
        const heartMsg = quest.heartReward > 0 ? ` + ❤️ ${quest.heartReward}` : '';
        if (!window.confirm(`${acceptor.playerName} 학생의 퀘스트 완료를 승인하고 ${quest.reward}P${heartMsg}를 지급할까요?`)) return;
        try {
            await completeQuestForPlayer(classId, quest.id, acceptor.playerId, acceptor.playerName, quest.reward, quest.heartReward || 0);
        } catch (e) { alert(`완료 처리 실패: ${e.message}`); }
    };

    const openRejectModal = (quest, acceptor) => {
        setRejectModal({ quest, acceptor });
        setRejectReason('');
    };

    const handleReject = async () => {
        if (!rejectModal) return;
        const { quest, acceptor } = rejectModal;
        try {
            await rejectQuestCompletion(classId, quest.id, acceptor.playerId, rejectReason.trim());
            setRejectModal(null);
        } catch (e) { alert(`반려 처리 실패: ${e.message}`); }
    };

    if (quests.length === 0) return null;

    const pendingCount = quests.reduce((s, q) =>
        s + (q.acceptors || []).filter(a => a.completionStatus === 'pending').length, 0);

    return (
        <>
            <Section style={{ marginTop: '2rem', borderTop: '2px dashed #a5d8ff', paddingTop: '1.5rem' }}>
                <SectionTitle>⚔ 퀘스트 완료 승인 대기 ({pendingCount}건)</SectionTitle>
                <List>
                    {quests.map(quest => (
                        <ListItem key={quest.id}>
                            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '0.95rem' }}>
                                ⚔ {quest.title} · 💰 {quest.reward}P{quest.heartReward > 0 && <> · ❤️ {quest.heartReward}</>}
                            </strong>
                            {(quest.acceptors || []).filter(a => a.completionStatus === 'pending').map(a => (
                                <div key={a.playerId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8f9fa', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1c7ed6', flexShrink: 0 }} />
                                        <strong>{a.playerName}</strong>
                                        <span style={{ color: '#1c7ed6', fontSize: '0.75rem', fontWeight: 700 }}>승인 대기 중</span>
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <StyledButton onClick={() => handleApprove(quest, a)} style={{ fontSize: '0.78rem', padding: '4px 12px', background: '#20c997' }}>
                                            ✓ 승인
                                        </StyledButton>
                                        <StyledButton onClick={() => openRejectModal(quest, a)} style={{ fontSize: '0.78rem', padding: '4px 12px', background: '#fa5252' }}>
                                            ✗ 반려
                                        </StyledButton>
                                    </div>
                                </div>
                            ))}
                        </ListItem>
                    ))}
                </List>
            </Section>

            {/* 반려 사유 모달 */}
            {rejectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: '0 0 6px' }}>
                            완료 요청 반려
                        </p>
                        <p style={{ color: '#868e96', fontSize: '0.88rem', margin: '0 0 14px' }}>
                            <strong>{rejectModal.acceptor.playerName}</strong>의 <strong>"{rejectModal.quest.title}"</strong> 완료 요청을 반려합니다.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="반려 사유 (선택) — 학생에게 표시됩니다"
                            style={{ width: '100%', minHeight: '80px', padding: '0.6rem', border: '1px solid #dee2e6', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <SaveButton onClick={handleReject} style={{ flex: 1, background: '#fa5252' }}>반려 확정</SaveButton>
                            <StyledButton onClick={() => setRejectModal(null)} style={{ background: '#6c757d' }}>취소</StyledButton>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 퀘스트 관리 위젯 (퀘스트 생성 및 관리 전용 탭)
// ─────────────────────────────────────────────────────────────────────────────
function SortableQuestItem({ quest, isEditing, editForm, setEditForm, onSave, onCancel, onEdit, onHide, onDelete, takenCount, onForceComplete }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: quest.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const maxSlots = quest.maxAcceptors || 1;
    const fieldStyle = { padding: '0.5rem 0.8rem', border: '1px solid #ffe066', borderRadius: '6px', fontSize: '0.95rem', background: '#fffbf0' };
    const acceptors = quest.acceptors || [];

    return (
        <ListItem ref={setNodeRef} style={style} {...attributes}>
            <DragHandle {...listeners}>⋮⋮</DragHandle>
            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="퀘스트 이름" style={{ ...fieldStyle, flex: 1, minWidth: '160px' }} />
                        <input type="number" value={editForm.reward} onChange={e => setEditForm(p => ({ ...p, reward: e.target.value }))} placeholder="보상 P" style={{ ...fieldStyle, width: '100px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.9rem' }}>❤️</span>
                            <input type="number" min={0} value={editForm.heartReward ?? '0'} onChange={e => setEditForm(p => ({ ...p, heartReward: e.target.value }))} placeholder="하트" style={{ ...fieldStyle, width: '70px', background: '#fff5f5', borderColor: '#ffc9c9' }} />
                        </div>
                    </div>
                    <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="퀘스트 설명" style={{ ...fieldStyle, minHeight: '60px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#7a4d00', fontWeight: 600 }}>
                            수락 인원:
                            <input type="number" min={takenCount || 1} max={10} value={editForm.maxAcceptors} onChange={e => setEditForm(p => ({ ...p, maxAcceptors: e.target.value }))} style={{ ...fieldStyle, width: '70px', padding: '0.4rem 0.6rem' }} />
                            명
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#7a4d00', fontWeight: 600, flex: 1 }}>
                            기한:
                            <input value={editForm.deadline} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} placeholder="예: 오늘 하교 전" style={{ ...fieldStyle, flex: 1, padding: '0.4rem 0.6rem' }} />
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <SaveButton onClick={onSave} style={{ fontSize: '0.9rem', padding: '6px 16px' }}>저장</SaveButton>
                        <StyledButton onClick={onCancel} style={{ background: '#6c757d', fontSize: '0.9rem', padding: '6px 16px' }}>취소</StyledButton>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700 }}>⚔ {quest.title}</span>
                            <span style={{ marginLeft: '8px', fontSize: '0.78rem', background: '#fff3bf', color: '#e67700', padding: '2px 7px', borderRadius: '5px', fontWeight: 700 }}>💰 {quest.reward}P</span>
                            {quest.heartReward > 0 && <span style={{ marginLeft: '4px', fontSize: '0.78rem', background: '#fff5f5', color: '#fa5252', padding: '2px 7px', borderRadius: '5px', fontWeight: 700 }}>❤️ {quest.heartReward}</span>}
                            <span style={{ marginLeft: '6px', fontSize: '0.78rem', background: '#e7f5ff', color: '#1c7ed6', padding: '2px 7px', borderRadius: '5px', fontWeight: 700 }}>{takenCount}/{maxSlots}명 수락</span>
                            {quest.deadline && <span style={{ marginLeft: '6px', color: '#adb5bd', fontSize: '0.78rem' }}>🕐 {quest.deadline}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <StyledButton onClick={onEdit} style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#f59f00' }}>수정</StyledButton>
                            <StyledButton onClick={onHide} style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#6c757d' }}>숨김</StyledButton>
                            <StyledButton onClick={onDelete} style={{ fontSize: '0.78rem', padding: '4px 10px', background: '#fa5252' }}>삭제</StyledButton>
                        </div>
                    </div>
                    {quest.description && <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#868e96', background: '#f8f9fa', padding: '6px 8px', borderRadius: '6px' }}>{quest.description}</p>}
                    {takenCount > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {acceptors.map(a => (
                                <span
                                    key={a.playerId}
                                    onClick={() => {
                                        if (a.completionStatus !== 'completed' && onForceComplete) {
                                            onForceComplete(quest, a);
                                        }
                                    }}
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        background: a.completionStatus === 'completed' ? '#d3f9d8' : a.completionStatus === 'pending' ? '#e7f5ff' : a.completionStatus === 'rejected' ? '#ffe3e3' : '#fff9db',
                                        color: a.completionStatus === 'completed' ? '#2f9e44' : a.completionStatus === 'pending' ? '#1c7ed6' : a.completionStatus === 'rejected' ? '#fa5252' : '#e67700',
                                        border: `1px solid ${a.completionStatus === 'completed' ? '#b2f2bb' : a.completionStatus === 'pending' ? '#a5d8ff' : a.completionStatus === 'rejected' ? '#ffc9c9' : '#ffe066'}`,
                                        cursor: a.completionStatus !== 'completed' ? 'pointer' : 'default',
                                        transition: 'filter 0.2s'
                                    }}
                                    title={a.completionStatus !== 'completed' ? '클릭하여 강제로 완료 처리하기' : ''}
                                    onMouseOver={(e) => { if (a.completionStatus !== 'completed') e.currentTarget.style.filter = 'brightness(0.9)'; }}
                                    onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                                >
                                    {a.playerName} · {a.completionStatus === 'completed' ? '완료' : a.completionStatus === 'pending' ? '승인대기' : a.completionStatus === 'rejected' ? '반려됨' : '수락중'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </ListItem>
    );
}

function QuestManager() {
    const { classId } = useClassStore();
    const [quests, setQuests] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showHidden, setShowHidden] = useState(false);
    const sensors = useSensors(useSensor(PointerSensor));

    // 퀘스트 생성 상태
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [reward, setReward] = useState('100');
    const [heartReward, setHeartReward] = useState('0');
    const [submissionTypes, setSubmissionTypes] = useState({ text: false, photo: false });
    const [questMaxAcceptors, setQuestMaxAcceptors] = useState(1);
    const [questDeadline, setQuestDeadline] = useState('');

    useEffect(() => {
        if (!classId) return;
        return listenQuests(classId, setQuests);
    }, [classId]);

    const handleSubmissionTypeChange = (type) => {
        setSubmissionTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const handleSaveQuest = async () => {
        if (!title.trim() || !reward) return alert('퀘스트 이름과 보상을 입력해주세요.');
        const selectedTypes = Object.entries(submissionTypes).filter(([, isSelected]) => isSelected).map(([type]) => type);
        const typeToSend = selectedTypes.length > 0 ? selectedTypes : ['simple'];

        try {
            await createQuest(classId, {
                title: title.trim(),
                description: description.trim(),
                reward: Number(reward) || 0,
                heartReward: Number(heartReward) || 0,
                maxAcceptors: Number(questMaxAcceptors) || 1,
                submissionType: typeToSend,
                deadline: questDeadline.trim() || null,
            });
            alert('퀘스트가 출제됐습니다! 전체 학생에게 알림이 전송됩니다.');

            setTitle(''); setDescription(''); setReward('100'); setHeartReward('0');
            setSubmissionTypes({ text: false, photo: false });
            setQuestMaxAcceptors(1); setQuestDeadline('');
        } catch (e) { alert(`퀘스트 출제 실패: ${e.message}`); }
    };

    const openEdit = (quest) => {
        setEditingId(quest.id);
        setEditForm({
            title: quest.title || '',
            description: quest.description || '',
            reward: quest.reward?.toString() || '',
            heartReward: quest.heartReward?.toString() || '0',
            maxAcceptors: quest.maxAcceptors?.toString() || '1',
            deadline: quest.deadline || '',
        });
    };

    const handleUpdate = async (questId) => {
        if (!editForm.title.trim() || !editForm.reward) return alert('이름과 보상을 입력해주세요.');
        try {
            await updateQuest(classId, questId, {
                title: editForm.title.trim(),
                description: editForm.description.trim(),
                reward: Number(editForm.reward),
                heartReward: Number(editForm.heartReward) || 0,
                maxAcceptors: Number(editForm.maxAcceptors) || 1,
                deadline: editForm.deadline.trim() || null,
            });
            setEditingId(null);
        } catch (e) { alert(`수정 실패: ${e.message}`); }
    };

    const handleHide = async (quest) => {
        if (!window.confirm(`"${quest.title}" 퀘스트를 숨기시겠습니까? 학생 목록에서 사라집니다.`)) return;
        try { await updateQuest(classId, quest.id, { status: 'hidden' }); }
        catch (e) { alert(`숨김 처리 실패: ${e.message}`); }
    };

    const handleUnhide = async (quest) => {
        try { await updateQuest(classId, quest.id, { status: 'open' }); }
        catch (e) { alert(`복구 실패: ${e.message}`); }
    };

    const handleDelete = async (quest) => {
        const acceptors = quest.acceptors || [];
        const activeCount = acceptors.filter(a => a.completionStatus !== 'completed').length;
        const confirmMsg = activeCount > 0
            ? `"${quest.title}" 퀘스트를 삭제하면 완료되지 않은 수락자 ${activeCount}명의 퀘스트가 실패 처리됩니다.\n\n정말 삭제할까요?`
            : `"${quest.title}" 퀘스트를 삭제할까요?`;
        if (!window.confirm(confirmMsg)) return;
        try { await deleteQuest(classId, quest.id); }
        catch (e) { alert(`삭제 실패: ${e.message}`); }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const openQuests = quests.filter(q => q.status === 'open' || q.status === undefined);
        const oldIndex = openQuests.findIndex(q => q.id === active.id);
        const newIndex = openQuests.findIndex(q => q.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const reordered = arrayMove(openQuests, oldIndex, newIndex);
        try {
            await Promise.all(reordered.map((q, idx) => updateQuest(classId, q.id, { order: idx })));
        } catch (e) { console.error('퀘스트 순서 저장 실패:', e); }
    };

    const handleForceComplete = async (quest, acceptor) => {
        if (acceptor.completionStatus === 'completed') return;
        const heartMsg = quest.heartReward > 0 ? ` + ❤️ ${quest.heartReward}` : '';
        if (!window.confirm(`[관리자 권한] ${acceptor.playerName} 학생의 퀘스트를 즉시 완료 처리하고 ${quest.reward}P${heartMsg}를 지급할까요?`)) return;
        try {
            await completeQuestForPlayer(classId, quest.id, acceptor.playerId, acceptor.playerName, quest.reward, quest.heartReward || 0);
        } catch (e) {
            alert(`완료 처리 실패: ${e.message}`);
        }
    };

    const openQuests = quests
        .filter(q => q.status === 'open' || q.status === undefined || q.status === null)
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    const hiddenQuests = quests.filter(q => q.status === 'hidden');
    const closedQuests = quests.filter(q => q.status === 'closed');

    return (
        <div style={{ padding: '0.5rem' }}>
            <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '1.1rem', color: '#495057' }}>⚔ 새 퀘스트 출제</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="퀘스트 이름 (예: 급식실 쓰레기 수거)" style={{ flex: 1, minWidth: '200px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} />
                    <ScoreInput type="number" value={reward} onChange={(e) => setReward(e.target.value)} style={{ width: '100px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} placeholder="보상 P" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fa5252' }}>❤️</span>
                        <ScoreInput type="number" min={0} value={heartReward} onChange={(e) => setHeartReward(e.target.value)} style={{ width: '70px', padding: '0.7rem 0.8rem', borderRadius: '8px', border: '1px solid #ffc9c9', fontSize: '0.95rem', background: '#fff5f5' }} placeholder="하트" />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0 0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#495057' }}><input type="checkbox" checked={submissionTypes.text} onChange={() => handleSubmissionTypeChange('text')} style={{ width: '16px', height: '16px' }} /> 글</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#495057' }}><input type="checkbox" checked={submissionTypes.photo} onChange={() => handleSubmissionTypeChange('photo')} style={{ width: '16px', height: '16px' }} /> 사진</label>
                    </div>
                </div>

                {/* 항상 표시되도록 변경된 설명 텍스트 영역 */}
                <div style={{ marginBottom: '10px' }}>
                    <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="퀘스트 설명 (해야 할 일, 완료 기준 등)" style={{ minHeight: '80px', width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                </div>

                <div style={{ background: '#fffbf0', border: '1px solid #ffe8a1', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#7a4d00', fontWeight: 700 }}>
                        ⚔ 수락 인원 (선착순):
                        <ScoreInput type="number" min={1} max={10} value={questMaxAcceptors} onChange={e => setQuestMaxAcceptors(e.target.value)} style={{ width: '70px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ffe066' }} /> 명
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#7a4d00', fontWeight: 700, flex: 1 }}>
                        🕐 기한:
                        <input type="text" value={questDeadline} onChange={e => setQuestDeadline(e.target.value)} placeholder="예: 오늘 하교 전, 3교시 쉬는 시간" style={{ flex: 1, padding: '0.5rem 0.8rem', border: '1px solid #ffe066', borderRadius: '6px', fontSize: '0.95rem' }} />
                    </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
                    <SaveButton onClick={handleSaveQuest} style={{ padding: '0.8rem 1.8rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 800 }}>⚔ 퀘스트 출제</SaveButton>
                </div>
            </div>

            {openQuests.length === 0 && quests.length > 0 && <p style={{ color: '#adb5bd', fontSize: '0.95rem' }}>진행 중인 퀘스트가 없습니다.</p>}

            {openQuests.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={openQuests.map(q => q.id)} strategy={verticalListSortingStrategy}>
                        <List>
                            {openQuests.map(quest => (
                                <SortableQuestItem
                                    key={quest.id} quest={quest}
                                    isEditing={editingId === quest.id}
                                    editForm={editForm} setEditForm={setEditForm}
                                    onSave={() => handleUpdate(quest.id)}
                                    onCancel={() => setEditingId(null)}
                                    onEdit={() => openEdit(quest)}
                                    onHide={() => handleHide(quest)}
                                    onDelete={() => handleDelete(quest)}
                                    takenCount={(quest.acceptors || []).length}
                                    onForceComplete={handleForceComplete}
                                />
                            ))}
                        </List>
                    </SortableContext>
                </DndContext>
            )}

            {(hiddenQuests.length > 0 || closedQuests.length > 0) && (
                <>
                    <ToggleButton onClick={() => setShowHidden(p => !p)} style={{ marginTop: '1.5rem' }}>
                        {showHidden ? '숨긴 퀘스트 접기' : `숨긴/마감 퀘스트 보기 (${hiddenQuests.length + closedQuests.length}개)`}
                    </ToggleButton>
                    {showHidden && (
                        <List style={{ marginTop: '0.8rem' }}>
                            {[...hiddenQuests, ...closedQuests].map(quest => (
                                <ListItem key={quest.id} style={{ opacity: 0.6, gridTemplateColumns: '1fr auto' }}>
                                    <div>
                                        <span style={{ fontSize: '0.88rem' }}>⚔ {quest.title}</span>
                                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', background: '#f1f3f5', color: '#adb5bd', padding: '2px 6px', borderRadius: '4px' }}>
                                            {quest.status === 'hidden' ? '숨김' : '마감'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {quest.status === 'hidden' && (
                                            <StyledButton onClick={() => handleUnhide(quest)} style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#20c997' }}>복구</StyledButton>
                                        )}
                                        <StyledButton onClick={() => handleDelete(quest)} style={{ fontSize: '0.75rem', padding: '3px 10px', background: '#adb5bd' }}>삭제</StyledButton>
                                    </div>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </>
            )}
        </div>
    );
}

function MissionManager({ onNavigate }) {
    const { classId } = useClassStore();
    const { missions, archivedMissions, archiveMission, unarchiveMission, removeMission, reorderMissions, editMission, createMission } = useLeagueStore();
    const sensors = useSensors(useSensor(PointerSensor));

    const [editMode, setEditMode] = useState(null);
    const [title, setTitle] = useState('');
    const [placeholderText, setPlaceholderText] = useState('');
    const [rewards, setRewards] = useState(['100', '', '']);
    const [submissionTypes, setSubmissionTypes] = useState({ text: false, photo: false });
    const [isFixed, setIsFixed] = useState(false);
    const [adminOnly, setAdminOnly] = useState(false);
    const [prerequisiteMissionId, setPrerequisiteMissionId] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState({ rewards: false, prerequisite: false });
    const [defaultPrivate, setDefaultPrivate] = useState(false);

    const prevMissionsLength = React.useRef(missions.length);

    useEffect(() => {
        if (missions.length > prevMissionsLength.current) {
            const latestMission = missions[missions.length - 1];
            const newList = [latestMission, ...missions.slice(0, missions.length - 1)];
            reorderMissions(newList, 'missions');
        }
        prevMissionsLength.current = missions.length;
    }, [missions, reorderMissions]);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const listKey = showArchived ? 'archivedMissions' : 'missions';
            const missionsToDisplay = showArchived ? archivedMissions : missions;
            const oldIndex = missionsToDisplay.findIndex(m => m.id === active.id);
            const newIndex = missionsToDisplay.findIndex(m => m.id === over.id);
            const newList = arrayMove(missionsToDisplay, oldIndex, newIndex);
            reorderMissions(newList, listKey);
        }
    };

    const handleSubmissionTypeChange = (type) => {
        setSubmissionTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const handleEditClick = (mission) => {
        setEditMode(mission); setTitle(mission.title); setPlaceholderText(mission.placeholderText || '');
        const missionRewards = Array.isArray(mission.rewards) ? mission.rewards : [mission.reward || ''];
        setRewards([missionRewards[0]?.toString() || '', missionRewards[1]?.toString() || '', missionRewards[2]?.toString() || '']);
        setSubmissionTypes({ text: mission.submissionType?.includes('text') || false, photo: mission.submissionType?.includes('photo') || false });
        setIsFixed(mission.isFixed || false); setAdminOnly(mission.adminOnly || false);
        setPrerequisiteMissionId(mission.prerequisiteMissionId || ''); setDefaultPrivate(mission.defaultPrivate || false);
        window.scrollTo(0, 0);
    };

    const handleCancel = () => {
        setEditMode(null); setTitle(''); setPlaceholderText(''); setRewards(['100', '', '']);
        setSubmissionTypes({ text: false, photo: false }); setIsFixed(false); setAdminOnly(false);
        setPrerequisiteMissionId(''); setDefaultPrivate(false); setShowAdvanced({ rewards: false, prerequisite: false });
    };

    const handleSaveMission = async () => {
        if (!classId) return;
        if (!title.trim() || !rewards[0]) return alert('미션 이름과 기본 보상 포인트를 모두 입력해주세요.');

        const selectedTypes = Object.entries(submissionTypes).filter(([, isSelected]) => isSelected).map(([type]) => type);
        const typeToSend = selectedTypes.length > 0 ? selectedTypes : ['simple'];
        const finalRewards = rewards.map(r => Number(r)).filter(r => r > 0);

        const missionData = {
            title, rewards: finalRewards, reward: finalRewards[0] || 0,
            submissionType: typeToSend, isFixed, adminOnly,
            prerequisiteMissionId: prerequisiteMissionId || null,
            placeholderText: placeholderText.trim(), defaultPrivate,
        };

        try {
            if (editMode) {
                await editMission(editMode.id, missionData);
                alert('미션이 성공적으로 수정되었습니다!');
            } else {
                await createMission(missionData);
                alert('새로운 미션이 출제되었습니다!');
            }
            handleCancel();
        } catch (error) { alert('미션 저장 중 오류가 발생했습니다.'); }
    };

    const missionsToDisplay = showArchived ? archivedMissions : missions;

    return (
        <div style={{ padding: '0.5rem' }}>
            <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem', transition: 'all 0.3s ease' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '1.1rem', color: '#495057' }}>{editMode ? '📝 미션 수정' : '📝 새 미션 출제'}</h3>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="미션 이름" style={{ flex: 1, minWidth: '200px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} />
                    <ScoreInput type="number" value={rewards[0]} onChange={(e) => setRewards(prev => [e.target.value, prev[1], prev[2]])} style={{ width: '100px', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem' }} placeholder="기본 보상" />
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0 0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#495057' }}><input type="checkbox" checked={submissionTypes.text} onChange={() => handleSubmissionTypeChange('text')} style={{ width: '16px', height: '16px' }} /> 글</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#495057' }}><input type="checkbox" checked={submissionTypes.photo} onChange={() => handleSubmissionTypeChange('photo')} style={{ width: '16px', height: '16px' }} /> 사진</label>
                    </div>
                </div>

                {submissionTypes.text && (
                    <div style={{ marginBottom: '10px' }}>
                        <TextArea value={placeholderText} onChange={(e) => setPlaceholderText(e.target.value)} placeholder="학생들에게 보여줄 문제나 안내사항을 여기에 입력하세요." style={{ minHeight: '80px', width: '100%', padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #ced4da', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                    </div>
                )}

                {showAdvanced.rewards && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#fff3cd', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ffeeba' }}>
                        <span style={{ fontWeight: 700, color: '#856404' }}>차등 보상:</span>
                        <ScoreInput type="number" value={rewards[1]} onChange={e => setRewards(p => [p[0], e.target.value, p[2]])} style={{ width: '100px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ffdf7e' }} placeholder="2단계 P" />
                        <ScoreInput type="number" value={rewards[2]} onChange={e => setRewards(p => [p[0], p[1], e.target.value])} style={{ width: '100px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ffdf7e' }} placeholder="3단계 P" />
                    </div>
                )}

                {showAdvanced.prerequisite && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#e2e3e5', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #d6d8db' }}>
                        <span style={{ fontWeight: 700, color: '#383d41' }}>연계 미션:</span>
                        <select value={prerequisiteMissionId} onChange={(e) => setPrerequisiteMissionId(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ced4da' }}>
                            <option value="">-- 없음 --</option>
                            <option value="">-- 없음 --</option>
                            {missions.map(mission => (<option key={mission.id} value={mission.id}>{mission.title}</option>))}
                        </select>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.2rem', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, rewards: !p.rewards }))} style={{ backgroundColor: showAdvanced.rewards ? '#e0a800' : '#ffc107', color: 'black', padding: '0.6rem 1.2rem', borderRadius: '8px' }} title="미션 완료 시 보상을 등급별(최대 3개)로 다르게 설정합니다.">차등 보상</StyledButton>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, prerequisite: !p.prerequisite }))} style={{ backgroundColor: showAdvanced.prerequisite ? '#5a6268' : '#6c757d', padding: '0.6rem 1.2rem', borderRadius: '8px' }} title="특정 미션을 완료해야만 이 미션을 수행할 수 있도록 설정합니다.">연계 미션</StyledButton>
                    <StyledButton onClick={() => setDefaultPrivate(p => !p)} style={{ backgroundColor: defaultPrivate ? '#dc3545' : '#007bff', padding: '0.6rem 1.2rem', borderRadius: '8px' }} title="미션 갤러리 공개 여부의 기본값을 설정합니다. (학생이 최종 변경 가능)">{defaultPrivate ? '비공개' : '공개'}</StyledButton>
                    <StyledButton onClick={() => setAdminOnly(p => !p)} style={{ backgroundColor: adminOnly ? '#dc3545' : '#6c757d', padding: '0.6rem 1.2rem', borderRadius: '8px' }} title="이 미션을 기록원에게는 보이지 않고, 관리자만 승인할 수 있도록 설정합니다.">{adminOnly ? '관리자만(활성)' : '관리자만'}</StyledButton>

                    <SaveButton onClick={handleSaveMission} style={{ padding: '0.6rem 1.8rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 800 }}>
                        {editMode ? '수정 완료' : '미션 출제'}
                    </SaveButton>
                    {editMode && <StyledButton onClick={handleCancel} style={{ backgroundColor: '#6c757d', padding: '0.6rem 1.2rem', borderRadius: '8px' }}>취소</StyledButton>}
                </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <ToggleButton onClick={() => setShowArchived(prev => !prev)}>
                    {showArchived ? '활성 미션 보기' : `숨긴 미션 보기 (${archivedMissions.length}개)`}
                </ToggleButton>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={missionsToDisplay.map(m => m.id)} strategy={verticalListSortingStrategy}>
                        <List>
                            {missionsToDisplay.length > 0 ? (
                                missionsToDisplay.map((mission) => (
                                    <SortableListItem
                                        key={mission.id} id={mission.id} mission={mission}
                                        unarchiveMission={unarchiveMission} archiveMission={archiveMission}
                                        removeMission={removeMission} handleEditClick={handleEditClick} onNavigate={onNavigate}
                                    />
                                ))
                            ) : <p>{showArchived ? '숨겨진 미션이 없습니다.' : '현재 출제된 미션이 없습니다.'}</p>}
                        </List>
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 새롭게 추가된 탭 관리 래퍼 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function CreationTabs({ onNavigateToHistory }) {
    const [activeTab, setActiveTab] = useState('mission'); // 'mission' | 'quest' | 'goal'

    return (
        <Section>
            {/* 탭 네비게이션 헤더 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>
                <ToggleButton
                    onClick={() => setActiveTab('mission')}
                    style={{ backgroundColor: activeTab === 'mission' ? '#339af0' : '#f8f9fa', color: activeTab === 'mission' ? 'white' : '#495057', border: 'none', borderRadius: '8px' }}
                >
                    📝 미션 관리
                </ToggleButton>
                <ToggleButton
                    onClick={() => setActiveTab('quest')}
                    style={{ backgroundColor: activeTab === 'quest' ? '#f59f00' : '#f8f9fa', color: activeTab === 'quest' ? 'white' : '#495057', border: 'none', borderRadius: '8px' }}
                >
                    ⚔ 퀘스트 관리
                </ToggleButton>
                <ToggleButton
                    onClick={() => setActiveTab('goal')}
                    style={{ backgroundColor: activeTab === 'goal' ? '#20c997' : '#f8f9fa', color: activeTab === 'goal' ? 'white' : '#495057', border: 'none', borderRadius: '8px' }}
                >
                    🎯 학급 목표 관리
                </ToggleButton>
            </div>

            {/* 활성화된 탭에 따라 컴포넌트 렌더링 */}
            <div style={{ width: '100%' }}>
                {activeTab === 'mission' && <MissionManager onNavigate={onNavigateToHistory} />}
                {activeTab === 'quest' && <QuestManager />}
                {activeTab === 'goal' && <GoalManager />}
            </div>
        </Section>
    );
}

function MissionTab({ missionSubMenu, setModalImageSrc, onNavigateToHistory, preselectedMissionId }) {
    switch (missionSubMenu) {
        case 'approval':
            return (
                <>
                    <PendingMissionWidget setModalImageSrc={setModalImageSrc} />
                    <QuestApprovalWidget />
                </>
            );
        case 'creation':
            return <CreationTabs onNavigateToHistory={onNavigateToHistory} />;
        case 'history':
            return <RecorderPage isAdminView={true} initialMissionId={preselectedMissionId} />;
        default:
            return null;
    }
}

export default MissionTab;