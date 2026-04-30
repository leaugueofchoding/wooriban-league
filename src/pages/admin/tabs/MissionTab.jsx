// src/pages/admin/tabs/MissionTab.jsx

import React, { useState, useEffect } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    auth, db, createMission, createClassGoal, getActiveGoals,
    deleteClassGoal, completeClassGoal, updateClassGoalStatus,
    approveMissionsInBatch, rejectMissionSubmission, editMission
} from '../../../api/firebase';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import RecorderPage from '../../RecorderPage';
import ApprovalModal from '../../../components/ApprovalModal';

// 분리된 스타일 파일에서 가져오기 (기존 스타일 속성 유지)
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, PendingListItem, SaveButton,
    GridContainer, DragHandle, MissionControls, ToggleButton,
    ScoreInput, TextArea
} from '../Admin.style';

// =============================================================================
// [원본 유지] 미션 승인 위젯 (PendingMissionWidget)
// =============================================================================
function PendingMissionWidget({ setModalImageSrc }) {
    const { classId } = useClassStore();
    const { players, missions } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!classId) return;

        const submissionsRef = collection(db, "classes", classId, "missionSubmissions");
        const q = query(submissionsRef, where("status", "==", "pending"), orderBy("requestedAt", "desc"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const submissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const validSubmissions = submissions.filter(sub =>
                missions.some(m => m.id === sub.missionId)
            );
            setPendingSubmissions(validSubmissions);
        });

        return () => unsubscribe();
    }, [classId, missions]);

    const handleModalOpen = (index) => { setSelectedSubmissionIndex(index); };
    const handleModalClose = () => { setSelectedSubmissionIndex(null); };
    const handleNext = () => { setSelectedSubmissionIndex(prev => (prev < pendingSubmissions.length - 1 ? prev + 1 : prev)); };
    const handlePrev = () => { setSelectedSubmissionIndex(prev => (prev > 0 ? prev - 1 : prev)); };

    const handleActionInModal = (actedSubmissionId) => {
        setPendingSubmissions(prev => prev.filter(sub => sub.id !== actedSubmissionId));
        setSelectedSubmissionIndex(prev => {
            if (prev === null) return null;
            if (prev >= pendingSubmissions.length - 2) return null;
            return prev;
        });
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

    const submissionToShow = selectedSubmissionIndex !== null ? pendingSubmissions[selectedSubmissionIndex] : null;

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
                            <PendingListItem key={sub.id} onClick={() => handleModalOpen(index)}>
                                <div>
                                    {student?.name} - [{mission?.title}]
                                    {sub.text && <span style={{ color: '#28a745', fontWeight: 'bold', marginLeft: '0.5rem' }}>[글]</span>}
                                    {sub.photoUrls && sub.photoUrls.length > 0 && <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>[사진]</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {isTieredReward ? (
                                        mission.rewards.map(reward => (
                                            <StyledButton
                                                key={reward}
                                                onClick={(e) => { e.stopPropagation(); handleAction('approve', sub, reward); }}
                                                style={{ backgroundColor: '#28a745' }}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? '...' : `${reward}P`}
                                            </StyledButton>
                                        ))
                                    ) : (
                                        <StyledButton
                                            onClick={(e) => { e.stopPropagation(); handleAction('approve', sub, mission.reward); }}
                                            style={{ backgroundColor: '#28a745' }}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? '처리중...' : `${mission.reward}P`}
                                        </StyledButton>
                                    )}
                                    <StyledButton
                                        onClick={(e) => { e.stopPropagation(); handleAction('reject', sub); }}
                                        style={{ backgroundColor: '#dc3545' }}
                                        disabled={isProcessing}
                                    >
                                        거절
                                    </StyledButton>
                                </div>
                            </PendingListItem>
                        )
                    })}
                </List>
            )}
            {submissionToShow && (
                <ApprovalModal
                    submission={submissionToShow}
                    onClose={handleModalClose}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    currentIndex={selectedSubmissionIndex}
                    totalCount={pendingSubmissions.length}
                    onAction={() => handleActionInModal(submissionToShow.id)}
                    onImageClick={(imageData) => setModalImageSrc(imageData)}
                />
            )}
        </Section>
    );
}

// =============================================================================
// [원본 유지] 학급 목표 관리 (GoalManager)
// =============================================================================
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

    useEffect(() => {
        fetchGoals();
    }, [classId]);

    const handleCreateGoal = async () => {
        if (!classId) return;
        if (!title.trim() || targetPoints <= 0) {
            return alert('목표 이름과 올바른 목표 포인트를 입력해주세요.');
        }
        try {
            await createClassGoal(classId, { title, targetPoints: Number(targetPoints) });
            alert('새로운 학급 목표가 설정되었습니다!');
            setTitle('');
            setTargetPoints(10000);
            fetchGoals();
        } catch (error) {
            alert(`목표 생성 실패: ${error.message}`);
        }
    };

    const handleGoalStatusToggle = async (goal) => {
        if (!classId) return;
        const newStatus = goal.status === 'paused' ? 'active' : 'paused';
        const actionText = newStatus === 'paused' ? '일시중단' : '다시시작';
        if (window.confirm(`'${goal.title}' 목표를 '${actionText}' 상태로 변경하시겠습니까?`)) {
            try {
                await updateClassGoalStatus(classId, goal.id, newStatus);
                alert(`목표가 ${actionText} 처리되었습니다.`);
                fetchGoals();
            } catch (error) {
                alert(`상태 변경 실패: ${error.message}`);
            }
        }
    };

    const handleGoalDelete = async (goalId) => {
        if (!classId) return;
        if (window.confirm("정말로 이 목표를 삭제하시겠습니까? 기부 내역도 함께 사라집니다.")) {
            try {
                await deleteClassGoal(classId, goalId);
                alert('목표가 삭제되었습니다.');
                fetchGoals();
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    const handleGoalComplete = async (goalId) => {
        if (!classId) return;
        if (window.confirm("이 목표를 '완료' 처리하여 대시보드에서 숨기시겠습니까?")) {
            try {
                await completeClassGoal(classId, goalId);
                alert('목표가 완료 처리되었습니다.');
                fetchGoals();
            } catch (error) {
                alert(`완료 처리 실패: ${error.message}`);
            }
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학급 목표 관리 🎯</SectionTitle>
                <InputGroup>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="목표 이름 (예: 2단계-영화 보는 날)"
                        style={{ flex: 1, minWidth: '200px', padding: '0.5rem' }}
                    />
                    <ScoreInput
                        type="number"
                        value={targetPoints}
                        onChange={(e) => setTargetPoints(e.target.value)}
                        style={{ width: '120px' }}
                    />
                    <SaveButton onClick={handleCreateGoal}>새 목표 설정</SaveButton>
                </InputGroup>

                <div style={{ marginTop: '2rem' }}>
                    <h4>진행 중인 목표 목록</h4>
                    <List>
                        {activeGoals.length > 0 ? (
                            activeGoals.map(goal => (
                                <ListItem key={goal.id} style={{ gridTemplateColumns: '1fr auto' }}>
                                    <div>
                                        <span>{goal.title}</span>
                                        {goal.status === 'paused' && <span style={{ marginLeft: '1rem', color: '#ffc107', fontWeight: 'bold' }}>[일시중단됨]</span>}
                                        <span style={{ marginLeft: '1rem', color: '#6c757d' }}>
                                            ({goal.currentPoints.toLocaleString()} / {goal.targetPoints.toLocaleString()} P)
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <SaveButton
                                            onClick={() => handleGoalStatusToggle(goal)}
                                            style={{ backgroundColor: goal.status === 'paused' ? '#17a2b8' : '#ffc107', color: goal.status === 'paused' ? 'white' : 'black' }}
                                        >
                                            {goal.status === 'paused' ? '다시시작' : '일시중단'}
                                        </SaveButton>
                                        <SaveButton
                                            onClick={() => handleGoalComplete(goal.id)}
                                            style={{ backgroundColor: '#28a745' }}
                                            disabled={goal.currentPoints < goal.targetPoints}
                                            title={goal.currentPoints < goal.targetPoints ? "아직 달성되지 않은 목표입니다." : ""}
                                        >
                                            완료 처리
                                        </SaveButton>
                                        <SaveButton
                                            onClick={() => handleGoalDelete(goal.id)}
                                            style={{ backgroundColor: '#dc3545' }}>
                                            삭제
                                        </SaveButton>
                                    </div>
                                </ListItem>
                            ))
                        ) : (
                            <p>현재 진행 중인 학급 목표가 없습니다.</p>
                        )}
                    </List>
                </div>
            </Section>
        </FullWidthSection>
    );
}

// =============================================================================
// [원본 유지] 미션 목록 아이템 (SortableListItem)
// =============================================================================
function SortableListItem(props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const { mission, classId, handleEditClick, archiveMission, unarchiveMission, removeMission, onNavigate } = props;

    const handleDelete = () => {
        if (window.confirm("정말로 이 미션을 삭제하시겠습니까? 제출된 기록도 모두 삭제됩니다.")) {
            removeMission(classId, mission.id);
        }
    };

    const handleArchive = () => {
        if (mission.status === 'active') {
            archiveMission(classId, mission.id);
        } else {
            unarchiveMission(classId, mission.id);
        }
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
                <StyledButton onClick={handleArchive} style={{ backgroundColor: '#6c757d' }}>
                    {mission.status === 'active' ? '숨김' : '복구'}
                </StyledButton>
                <StyledButton onClick={handleDelete} style={{ backgroundColor: '#dc3545' }}>삭제</StyledButton>
            </MissionControls>
        </ListItem>
    );
}

// =============================================================================
// [원본 유지] 미션 출제 및 관리 (MissionManager)
// =============================================================================
function MissionManager({ onNavigate }) {
    const { classId } = useClassStore();
    const {
        missions, archivedMissions, archiveMission, unarchiveMission,
        removeMission, reorderMissions
    } = useLeagueStore();
    const navigate = useNavigate();
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
        setEditMode(mission);
        setTitle(mission.title);
        setPlaceholderText(mission.placeholderText || '');
        const missionRewards = Array.isArray(mission.rewards) ? mission.rewards : [mission.reward || ''];
        setRewards([
            missionRewards[0]?.toString() || '',
            missionRewards[1]?.toString() || '',
            missionRewards[2]?.toString() || ''
        ]);
        setSubmissionTypes({
            text: mission.submissionType?.includes('text') || false,
            photo: mission.submissionType?.includes('photo') || false,
        });
        setIsFixed(mission.isFixed || false);
        setAdminOnly(mission.adminOnly || false);
        setPrerequisiteMissionId(mission.prerequisiteMissionId || '');
        setDefaultPrivate(mission.defaultPrivate || false);
        window.scrollTo(0, 0);
    };

    const handleCancel = () => {
        setEditMode(null);
        setTitle('');
        setPlaceholderText('');
        setRewards(['100', '', '']);
        setSubmissionTypes({ text: false, photo: false });
        setIsFixed(false);
        setAdminOnly(false);
        setPrerequisiteMissionId('');
        setDefaultPrivate(false);
        setShowAdvanced({ rewards: false, prerequisite: false });
    };

    const handleSaveMission = async () => {
        if (!classId) return;
        if (!title.trim() || !rewards[0]) {
            return alert('미션 이름과 기본 보상 포인트를 모두 입력해주세요.');
        }

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
                await createMission(classId, missionData);
                alert('새로운 미션이 등록되었습니다!');
            }
            handleCancel();
        } catch (error) {
            console.error("미션 저장 오류:", error);
            alert('미션 저장 중 오류가 발생했습니다.');
        }
    };

    const missionsToDisplay = showArchived ? archivedMissions : missions;

    return (
        <Section>
            <SectionTitle>{editMode ? `미션 수정: ${editMode.title}` : '미션 관리 📜'}</SectionTitle>
            <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <InputGroup>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="미션 이름" style={{ flex: 1, minWidth: '200px', padding: '0.5rem' }} />
                    <ScoreInput type="number" value={rewards[0]} onChange={(e) => setRewards(prev => [e.target.value, prev[1], prev[2]])} style={{ width: '80px' }} placeholder="기본 보상" />
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label title="글 제출 필요"><input type="checkbox" checked={submissionTypes.text} onChange={() => handleSubmissionTypeChange('text')} /> 글</label>
                        <label title="사진 제출 필요"><input type="checkbox" checked={submissionTypes.photo} onChange={() => handleSubmissionTypeChange('photo')} /> 사진</label>
                    </div>
                </InputGroup>

                {submissionTypes.text && (
                    <InputGroup>
                        <TextArea value={placeholderText} onChange={(e) => setPlaceholderText(e.target.value)} placeholder="학생들에게 보여줄 문제나 안내사항을 여기에 입력하세요." style={{ minHeight: '60px' }} />
                    </InputGroup>
                )}

                {showAdvanced.rewards && (
                    <InputGroup>
                        <label>차등 보상:</label>
                        <ScoreInput type="number" value={rewards[1]} onChange={e => setRewards(p => [p[0], e.target.value, p[2]])} style={{ width: '80px' }} placeholder="2단계" />
                        <ScoreInput type="number" value={rewards[2]} onChange={e => setRewards(p => [p[0], p[1], e.target.value])} style={{ width: '80px' }} placeholder="3단계" />
                    </InputGroup>
                )}
                {showAdvanced.prerequisite && (
                    <InputGroup>
                        <label htmlFor="prerequisite">연계 미션:</label>
                        <select id="prerequisite" value={prerequisiteMissionId} onChange={(e) => setPrerequisiteMissionId(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                            <option value="">-- 없음 --</option>
                            {missions.map(mission => (<option key={mission.id} value={mission.id}>{mission.title}</option>))}
                        </select>
                    </InputGroup>
                )}

                <InputGroup style={{ justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, rewards: !p.rewards }))} style={{ backgroundColor: showAdvanced.rewards ? '#e0a800' : '#ffc107', color: 'black' }} title="미션 완료 시 보상을 등급별(최대 3개)로 다르게 설정합니다.">차등 보상</StyledButton>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, prerequisite: !p.prerequisite }))} style={{ backgroundColor: showAdvanced.prerequisite ? '#5a6268' : '#6c757d' }} title="특정 미션을 완료해야만 이 미션을 수행할 수 있도록 설정합니다.">연계 미션</StyledButton>
                    <StyledButton onClick={() => setIsFixed(p => !p)} style={{ backgroundColor: isFixed ? '#17a2b8' : '#6c757d' }} title="매일 반복해서 수행할 수 있는 고정 미션으로 설정합니다. (예: 일기 쓰기)">{isFixed ? '반복(활성)' : '반복 미션'}</StyledButton>
                    <StyledButton onClick={() => setDefaultPrivate(p => !p)} style={{ backgroundColor: defaultPrivate ? '#dc3545' : '#007bff' }} title="미션 갤러리 공개 여부의 기본값을 설정합니다. (학생이 최종 변경 가능)" >{defaultPrivate ? '비공개' : '공개'}</StyledButton>
                    <StyledButton onClick={() => setAdminOnly(p => !p)} style={{ backgroundColor: adminOnly ? '#dc3545' : '#6c757d' }} title="이 미션을 기록원에게는 보이지 않고, 관리자만 승인할 수 있도록 설정합니다.">{adminOnly ? ' 관리자만(활성)' : '관리자만'}</StyledButton>
                    <SaveButton onClick={handleSaveMission}>{editMode ? '수정 완료' : '미션 출제'}</SaveButton>
                    {editMode && <StyledButton onClick={handleCancel} style={{ backgroundColor: '#6c757d' }}>취소</StyledButton>}
                </InputGroup>
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
                                        key={mission.id}
                                        id={mission.id}
                                        classId={classId}
                                        mission={mission}
                                        unarchiveMission={unarchiveMission}
                                        archiveMission={archiveMission}
                                        removeMission={removeMission}
                                        handleEditClick={handleEditClick}
                                        onNavigate={onNavigate}
                                    />
                                ))
                            ) : (
                                <p>{showArchived ? '숨겨진 미션이 없습니다.' : '현재 출제된 미션이 없습니다.'}</p>
                            )}
                        </List>
                    </SortableContext>
                </DndContext>
            </div>
        </Section>
    );
}

// =============================================================================
// [메인 컴포넌트] MissionTab (탭 전환 관리)
// =============================================================================
function MissionTab({ activeSubMenu, setModalImageSrc, setPreselectedMissionId, preselectedMissionId }) {

    // 기록 탭으로 이동하는 핸들러 (props로 받은 setter 사용)
    const handleNavigateToHistory = (missionId) => {
        // 이 부분은 상위 컴포넌트(AdminPage.jsx)에서 상태를 관리해야 하므로,
        // 여기서는 상위에서 전달받은 함수가 있다고 가정하고 호출해야 하지만,
        // 현재 구조상 AdminPage에서 missionSubMenu를 setMissionSubMenu로 바꿔줘야 함.
        // 하지만 MissionTab의 props로는 activeSubMenu(값)만 들어오고 있음.
        // 따라서 AdminPage.jsx 수정 시 setMissionSubMenu를 넘겨주도록 변경해야 함.
        // (일단 여기서는 preselectedMissionId 설정만 하고, 탭 변경은 AdminPage 로직을 따름)
        if (setPreselectedMissionId) setPreselectedMissionId(missionId);
    };

    switch (activeSubMenu) {
        case 'approval':
            return (
                <GridContainer style={{ gridTemplateColumns: '1fr' }}>
                    <PendingMissionWidget setModalImageSrc={setModalImageSrc} />
                </GridContainer>
            );
        case 'creation':
            return (
                <>
                    <GridContainer style={{ gridTemplateColumns: '1fr' }}>
                        {/* handleNavigateToHistory 대신 missionId를 저장하는 함수 전달 */}
                        <MissionManager onNavigate={handleNavigateToHistory} />
                    </GridContainer>
                    <GoalManager />
                </>
            );
        case 'history':
            return <RecorderPage isAdminView={true} initialMissionId={preselectedMissionId} />;
        default:
            return null;
    }
}

export default MissionTab;