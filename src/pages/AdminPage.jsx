// src/pages/AdminPage.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PlayerProfile from '../components/PlayerProfile.jsx';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
    uploadAvatarPart,
    batchUpdateAvatarPartDetails,
    createMission,
    updateAvatarPartStatus,
    batchUpdateSaleInfo,
    batchEndSale,
    updateAvatarPartDisplayName,
    batchUpdateSaleDays,
    createClassGoal,
    getActiveGoals,
    batchDeleteAvatarParts,
    deleteClassGoal,
    approveMissionsInBatch,
    rejectMissionSubmission,
    linkPlayerToAuth,
    auth,
    db,
    completeClassGoal,
    createNewSeason,
    replyToSuggestion,
    adminInitiateConversation,
    sendBulkMessageToAllStudents,
    uploadMyRoomItem,
    getMyRoomItems,
    batchUpdateMyRoomItemDetails,
    batchDeleteMyRoomItems,
    batchUpdateMyRoomItemSaleInfo,
    batchEndMyRoomItemSale,
    batchUpdateMyRoomItemSaleDays,
    updateMyRoomItemDisplayName,
    getAllMyRoomComments, // 댓글 모니터링 함수 import
    deleteMyRoomComment,  // 댓글 삭제 함수 import
    deleteMyRoomReply,    // 답글 삭제 함수 import
    updateClassGoalStatus, // [추가] 목표 상태 업데이트 함수 import
    getAttendanceByDate,
    getTitles,
    createTitle,
    updateTitle,
    deleteTitle,
    grantTitleToPlayerManually,
    adjustPlayerPoints
} from '../api/firebase.js';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";


// --- Styled Components ---
const AdminWrapper = styled.div`
  display: flex;
  gap: 2rem;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  font-family: sans-serif;
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
    padding: 1rem;
    gap: 1.5rem;
  }
`;

const Sidebar = styled.nav`
  width: 220px;
  flex-shrink: 0;
  background-color: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  position: sticky;
  top: 2rem;

  @media (max-width: 768px) {
    width: 100%;
    position: static;
    top: auto;
  }
`;

const MainContent = styled.main`
  flex-grow: 1;
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NavItem = styled.li`
  margin-bottom: 0.5rem;
`;

const NavButton = styled.button`
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: ${props => props.$active ? '#007bff' : 'transparent'};
  color: ${props => props.$active ? 'white' : 'black'};
  border: none;
  border-radius: 6px;
  text-align: left;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    background-color: ${props => props.$active ? '#0056b3' : '#e9ecef'};
  }
`;

const SubNavList = styled.ul`
    list-style: none;
    padding-left: 1rem;
    margin-top: 0.5rem;
`;

const SubNavItem = styled.li`
    margin-bottom: 0.25rem;
`;

const SubNavButton = styled.button`
    width: 100%;
    padding: 0.5rem 1rem;
    background-color: ${props => props.$active ? '#6c757d' : 'transparent'};
    color: ${props => props.$active ? 'white' : '#343a40'};
    border: none;
    border-radius: 4px;
    text-align: left;
    font-size: 0.9rem;
    cursor: pointer;

    &:hover {
        background-color: #e9ecef;
    }
`;


const Title = styled.h1`
  margin-top: 0;
  margin-bottom: 2rem;
  text-align: center;
`;

const GridContainer = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    margin-bottom: 2.5rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
`;


const FullWidthSection = styled.section`
  margin-bottom: 2.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  grid-column: 1 / -1;

  padding: 0; 
  & > div {
      padding: 1.5rem;
  }
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

const InputGroup = styled.div`
 display: flex;
 gap: 0.5rem;
 margin-bottom: 1rem;
 align-items: center;
 flex-wrap: wrap;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  flex-grow: 1;
  max-height: 400px; /* 스크롤 적용 */
  overflow-y: auto; /* 스크롤 적용 */
`;

const ListItem = styled.li`
  display: grid;
  /* ▼▼▼ [수정] 드래그 핸들을 위한 칼럼 추가 ▼▼▼ */
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  background-color: #fff; /* 배경색 추가하여 dnd-kit 배경과 구분 */
  &:last-child {
    border-bottom: none;
  }
`;

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  cursor: grab;
  color: #a9a9a9;
  font-size: 1.5rem;
  line-height: 1;

  &:active {
    cursor: grabbing;
  }
`;

function SortableListItem({ id, mission, navigate, unarchiveMission, archiveMission, removeMission }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: 'none',
    };

    // ▼▼▼ [수정] ListItem의 렌더링 방식과 이벤트 적용 위치 변경 ▼▼▼
    return (
        <ListItem ref={setNodeRef} style={style} {...attributes}>
            <DragHandle {...listeners}>⋮⋮</DragHandle>
            <div style={{ flex: 1, marginRight: '1rem' }}>
                <strong>{mission.title}</strong>
                <span style={{ marginLeft: '1rem', color: '#6c757d' }}>(보상: {mission.reward}P)</span>
            </div>
            <MissionControls>
                {/* e.stopPropagation() 더 이상 필요 없으므로 제거 */}
                <StyledButton onClick={() => navigate(`/recorder/${mission.id}`)} style={{ backgroundColor: '#17a2b8' }}>상태 확인</StyledButton>
                {mission.status === 'archived' ? (
                    <StyledButton onClick={() => unarchiveMission(mission.id)} style={{ backgroundColor: '#28a745' }}>활성화</StyledButton>
                ) : (
                    <StyledButton onClick={() => archiveMission(mission.id)} style={{ backgroundColor: '#ffc107', color: 'black' }}>숨김</StyledButton>
                )}
                <StyledButton onClick={() => removeMission(mission.id)} style={{ backgroundColor: '#dc3545' }}>삭제</StyledButton>
            </MissionControls>
        </ListItem>
    );
}

const BroadcastButton = styled(Link)`
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background-color: #dc3545;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  text-align: center;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c82333;
  }
`;

const ChatLayout = styled.div`
  display: flex;
  height: 70vh;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const MonitorCommentCard = styled.div`
    background-color: #fff;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
`;

const MonitorHeader = styled.div`
    font-size: 0.9rem;
    color: #6c757d;
    margin-bottom: 0.5rem;
    & > strong { color: #007bff; }
    & > span { cursor: pointer; text-decoration: underline; }
`;

const MonitorContent = styled.p`
    margin: 0 0 0.5rem;
`;

const MonitorReply = styled.div`
    border-left: 3px solid #ced4da;
    padding-left: 1rem;
    margin-left: 1rem;
    font-size: 0.95rem;
`;

// [추가] 날짜 표시줄 스타일
const DateSeparator = styled.div`
  text-align: center;
  margin: 1rem 0;
  color: #6c757d;
  font-size: 0.8rem;
  font-weight: bold;
`;

// [추가] 전체 메시지 발송 버튼 스타일
const BulkMessageButton = styled.button`
  width: calc(100% - 2rem);
  margin: 0 1rem 1rem 1rem;
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    background-color: #218838;
  }
`;

const StudentListPanel = styled.div`
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid #dee2e6;
  overflow-y: auto;
`;

const StudentListItem = styled.div`
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f1f3f5;
  background-color: ${props => props.$active ? '#e9ecef' : 'transparent'};
  
  &:hover {
    background-color: #f8f9fa;
  }

  p {
    margin: 0;
    font-weight: bold;
  }

  small {
    color: #6c757d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }
`;

const ChatPanel = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const ChatHeader = styled.div`
  padding: 1rem;
  font-weight: bold;
  font-size: 1.2rem;
  border-bottom: 1px solid #dee2e6;
  text-align: center;
`;

const MessageArea = styled.div`
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div`
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);

  &.student {
    background-color: #fff;
    color: #343a40;
    align-self: flex-start;
    border: 1px solid #e9ecef;
    border-bottom-left-radius: 4px;
  }

  &.admin {
    background-color: #007bff;
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
`;

const Timestamp = styled.span`
  font-size: 0.75rem;
  color: #a9a9a9;
  display: block;
  margin-top: 0.5rem;
  text-align: ${props => props.$align || 'left'};
`;

const InputArea = styled.div`
  display: flex;
  padding: 1rem;
  border-top: 1px solid #dee2e6;
  background-color: #f8f9fa;
`;

const TextArea = styled.textarea`
  flex-grow: 1;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  resize: none;
  font-family: inherit;
  height: 48px;
`;

const SubmitButton = styled.button`
  padding: 0 1.5rem;
  margin-left: 1rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;

  &:disabled {
    background-color: #6c757d;
  }
`;

const MemberList = styled.div`
  margin-top: 0.5rem;
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid #ddd;
`;

const MemberListItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.9rem;
`;

const CaptainButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0.2rem;
    line-height: 1;
    opacity: ${props => (props.disabled ? 0.5 : 1)};
    color: ${props => (props.$isCaptain ? '#007bff' : '#ced4da')};

    &:hover:not(:disabled) {
        transform: scale(1.2);
        color: #0056b3;
    }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const TabButton = styled.button`
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  
  &:not(:last-child) {
    border-right: none;
  }

  &:first-child {
    border-radius: 8px 0 0 8px;
  }

  &:last-child {
    border-radius: 0 8px 8px 0;
  }

  &:hover {
    background-color: ${props => props.$active ? '#0056b3' : '#f8f9fa'};
  }

  &:disabled {
    background-color: #e9ecef;
    color: #6c757d;
    cursor: not-allowed;
  }
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

const ScoreInput = styled.input`
  width: 60px;
  text-align: center;
  margin: 0 0.5rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
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

const SaveButton = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1.5rem;
`;

const ItemCard = styled.div`
 position: relative;
 display: flex;
 flex-direction: column;
 gap: 0.75rem;
 padding: 1rem;
 border-radius: 8px;
 background-color: #fff;
 box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;

const getBackgroundPosition = (category) => {
    switch (category) {
        case 'bottom': return 'center 75%';
        case 'shoes': return 'center 100%';
        case 'eyes': case 'nose': case 'mouth': return 'center 25%';
        case 'hair': return 'center 0%';
        case 'top':
        default: return 'center 55%';
    }
};

const ItemImage = styled.div`
  width: 120px;
  height: 120px;
  margin: 0 auto; /* 가운데 정렬 추가 */
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  /* [수정] 액세서리는 기본 확대 없이 원래 크기로 표시 */
  background-size: ${props => props.$category === 'accessory' ? 'contain' : '200%'};
  background-repeat: no-repeat;
  background-color: #e9ecef;
  transition: background-size 0.2s ease-in-out;
  background-position: ${props => getBackgroundPosition(props.$category)};
  
  /* [수정] 액세서리는 hover 시에도 확대되지 않음 */
  &:hover {
    background-size: ${props => props.$category === 'accessory' ? 'contain' : '220%'};
  }
`;

const MissionControls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const ToggleButton = styled(StyledButton)`
  background-color: #6c757d;
  margin-bottom: 1rem;
  &:hover {
    background-color: #5a6268;
  }
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2.5rem;
`;

const PageButton = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: ${props => props.$isActive ? '#007bff' : 'white'};
  color: ${props => props.$isActive ? 'white' : 'black'};
  font-weight: bold;
  cursor: pointer;
  &:hover {
    background-color: #f1f3f5;
  }
  &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
  }
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

const SaleBadge = styled.div`
  position: absolute;
  top: 10px;
  right: -25px;
  background-color: #dc3545;
  color: white;
  padding: 2px 25px;
  font-size: 0.9rem;
  font-weight: bold;
  transform: rotate(45deg);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 2;
`;


// --- Components ---

function PendingMissionWidget() {
    const { players, missions } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
    const currentUser = auth.currentUser;

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

    const handleAction = async (action, submission, reward) => { // reward 파라미터 추가
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
                // 전달받은 reward 값을 사용
                await approveMissionsInBatch(mission.id, [student.id], currentUser.uid, reward);
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
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
                    {pendingSubmissions.map(sub => {
                        const student = players.find(p => p.id === sub.studentId);
                        const mission = missions.find(m => m.id === sub.missionId);
                        const isProcessing = processingIds.has(sub.id);
                        const isOpen = expandedSubmissionId === sub.id;
                        const hasContent = sub.text || sub.photoUrl;
                        const isTieredReward = mission?.rewards && mission.rewards.length > 1; // 이 줄을 추가했습니다.

                        if (!mission) return null;

                        return (
                            <ListItem key={sub.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: hasContent ? 'pointer' : 'default' }} onClick={() => hasContent && setExpandedSubmissionId(prev => prev === sub.id ? null : sub.id)}>
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {student?.name} - [{mission?.title}]
                                        {sub.text && <span style={{ color: '#28a745', fontWeight: 'bold', marginLeft: '0.5rem' }}>[글]</span>}
                                        {sub.photoUrl && <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>[사진]</span>}
                                    </span>
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
                                </div>
                                <SubmissionDetails $isOpen={isOpen}>
                                    {sub.text && <p>{sub.text}</p>}
                                    {sub.photoUrl && <img src={sub.photoUrl} alt="제출된 사진" />}
                                </SubmissionDetails>
                            </ListItem>
                        )
                    })}
                </List>
            )}
        </Section>
    );
}

function AttendanceChecker({ players }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendedPlayerIds, setAttendedPlayerIds] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchAttendance = async () => {
            setIsLoading(true);
            const uids = await getAttendanceByDate(selectedDate);
            setAttendedPlayerIds(uids);
            setIsLoading(false);
        };
        fetchAttendance();
    }, [selectedDate]);

    const attendedPlayers = useMemo(() => {
        return players
            .filter(p => attendedPlayerIds.includes(p.authUid))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [players, attendedPlayerIds]);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>출석 확인</SectionTitle>
                <InputGroup>
                    <label>날짜 선택:</label>
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => setSelectedDate(date)}
                        dateFormat="yyyy/MM/dd"
                        popperPlacement="bottom-start"
                    />
                </InputGroup>
                <h4>
                    {formatDate(selectedDate)} 출석: {attendedPlayers.length}명
                </h4>
                {isLoading ? <p>출석 기록을 불러오는 중...</p> : (
                    <List>
                        {attendedPlayers.length > 0 ? (
                            attendedPlayers.map(player => (
                                <ListItem key={player.id} style={{ gridTemplateColumns: '1fr' }}>
                                    <Link to={`/profile/${player.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <PlayerProfile player={player} />
                                    </Link>
                                </ListItem>
                            ))
                        ) : (
                            <p>해당 날짜에 출석한 학생이 없습니다.</p>
                        )}
                    </List>
                )}
            </Section>
        </FullWidthSection>
    );
}

function MyRoomCommentMonitor() {
    const { players } = useLeagueStore();
    const [allComments, setAllComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchComments = async () => {
            setIsLoading(true);
            const comments = await getAllMyRoomComments();
            setAllComments(comments);
            setIsLoading(false);
        };
        fetchComments();
    }, []);

    const handleDeleteComment = async (roomId, commentId) => {
        if (window.confirm("정말로 이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            await deleteMyRoomComment(roomId, commentId);
            setAllComments(prev => prev.filter(c => c.id !== commentId));
        }
    };

    const handleDeleteReply = async (roomId, commentId, reply) => {
        if (window.confirm("정말로 이 답글을 삭제하시겠습니까?")) {
            const comment = allComments.find(c => c.id === commentId);
            if (comment) {
                // Firestore 타임스탬프 객체 비교를 위해 toDate().getTime() 사용
                const updatedReplies = comment.replies.filter(r =>
                    !(r.createdAt?.toDate().getTime() === reply.createdAt?.toDate().getTime() && r.text === reply.text)
                );
                await deleteMyRoomReply(roomId, commentId, reply);
                setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, replies: updatedReplies } : c));
            }
        }
    };

    if (isLoading) return <Section><p>댓글을 불러오는 중...</p></Section>;

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>마이룸 댓글 모음</SectionTitle>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {allComments.map(comment => {
                        const roomOwner = players.find(p => p.id === comment.roomId);
                        return (
                            <MonitorCommentCard key={comment.id}>
                                <MonitorHeader>
                                    <strong>{comment.commenterName}</strong> → <span onClick={() => navigate(`/my-room/${roomOwner?.id}`)}><strong>{roomOwner?.name || '??'}</strong>님의 마이룸</span>
                                    <StyledButton onClick={() => handleDeleteComment(comment.roomId, comment.id)} style={{ float: 'right', padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545' }}>댓글 삭제</StyledButton>
                                </MonitorHeader>
                                <MonitorContent>{comment.text}</MonitorContent>
                                {comment.replies?.map((reply, index) => (
                                    <MonitorReply key={index}>
                                        <MonitorHeader>
                                            <strong>{reply.replierName}</strong>(방주인)
                                            <StyledButton onClick={() => handleDeleteReply(comment.roomId, comment.id, reply)} style={{ float: 'right', padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#6c757d' }}>답글 삭제</StyledButton>
                                        </MonitorHeader>
                                        <MonitorContent>{reply.text}</MonitorContent>
                                    </MonitorReply>
                                ))}
                            </MonitorCommentCard>
                        )
                    })}
                </div>
            </Section>
        </FullWidthSection>
    );
}

function MessageManager() {
    const { players } = useLeagueStore();
    const [allSuggestions, setAllSuggestions] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messageAreaRef = useRef(null);

    // [추가] 데이터 구조 차이를 해결하기 위한 헬퍼 함수
    const getConversationFromDoc = (doc) => {
        if (doc.conversation) {
            return doc.conversation;
        }
        // 옛날 데이터 구조를 위한 하위 호환성 코드
        const oldConversation = [];
        if (doc.message) {
            oldConversation.push({ sender: 'student', content: doc.message, createdAt: doc.createdAt });
        }
        if (doc.reply) {
            oldConversation.push({ sender: 'admin', content: doc.reply, createdAt: doc.repliedAt });
        }
        return oldConversation;
    };

    useEffect(() => {
        const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllSuggestions(suggestionsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (messageAreaRef.current) {
            messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
        }
    }, [selectedStudentId, allSuggestions]);

    const studentThreads = useMemo(() => {
        return allSuggestions.reduce((acc, msg) => {
            if (!acc[msg.studentId]) acc[msg.studentId] = [];
            acc[msg.studentId].push(msg);
            return acc;
        }, {});
    }, [allSuggestions]);

    const sortedPlayers = useMemo(() => {
        const getLatestMessageTime = (playerId) => {
            const thread = studentThreads[playerId];
            if (!thread) return 0; // 대화 없으면 0
            const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
            return (lastMessageDoc.lastMessageAt || lastMessageDoc.createdAt).toMillis();
        };

        return [...players]
            .filter(p => p.role !== 'admin')
            .sort((a, b) => {
                const timeA = getLatestMessageTime(a.id);
                const timeB = getLatestMessageTime(b.id);
                if (timeA !== timeB) return timeB - timeA; // 1. 최신 메시지 순
                return a.name.localeCompare(b.name);      // 2. 이름 가나다 순
            });
    }, [players, studentThreads]);

    const selectedThreadMessages = useMemo(() => {
        if (!selectedStudentId) return [];
        const thread = studentThreads[selectedStudentId];
        if (!thread) return [];

        // [수정] 헬퍼 함수를 사용하여 모든 대화 기록을 가져옵니다.
        return thread.flatMap(item => getConversationFromDoc(item))
            .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    }, [selectedStudentId, studentThreads]);

    const handleReplySubmit = async () => {
        if (!replyContent.trim() || !selectedStudentId) return;
        const student = players.find(p => p.id === selectedStudentId);
        if (!student) return alert("학생 정보를 찾을 수 없습니다.");

        const thread = studentThreads[selectedStudentId];

        try {
            if (thread) {
                const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
                await replyToSuggestion(lastMessageDoc.id, replyContent, student.authUid);
            } else {
                await adminInitiateConversation(student.id, student.name, replyContent, student.authUid);
            }
            setReplyContent('');
        } catch (error) {
            alert(`메시지 전송 실패: ${error.message}`);
        }
    };

    const handleBulkMessageSend = async () => {
        const message = prompt("모든 학생에게 보낼 메시지 내용을 입력하세요:");
        if (message && message.trim()) {
            if (window.confirm(`정말로 모든 학생에게 "${message}" 메시지를 보내시겠습니까?`)) {
                try {
                    await sendBulkMessageToAllStudents(message);
                    alert("전체 메시지를 성공적으로 보냈습니다.");
                } catch (error) {
                    alert(`전송 실패: ${error.message}`);
                }
            }
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp || typeof timestamp.toDate !== 'function') return '';
        const date = timestamp.toDate();
        return date.toLocaleString('ko-KR', { month: 'long', day: 'numeric' });
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학생 메시지 확인 및 답변</SectionTitle>
                <ChatLayout>
                    <StudentListPanel>
                        <BulkMessageButton onClick={handleBulkMessageSend}>📢 전체 메시지 발송</BulkMessageButton>
                        {isLoading ? <p style={{ padding: '1rem' }}>로딩 중...</p> :
                            sortedPlayers.map(player => {
                                const thread = studentThreads[player.id];
                                // [수정] 헬퍼 함수를 사용하여 마지막 메시지를 찾습니다.
                                const lastMessage = thread ? (thread.flatMap(item => getConversationFromDoc(item)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]) : null;

                                return (
                                    <StudentListItem
                                        key={player.id}
                                        $active={selectedStudentId === player.id}
                                        onClick={() => setSelectedStudentId(player.id)}
                                    >
                                        <p>{player.name}</p>
                                        {lastMessage && <small>{lastMessage.content}</small>}
                                    </StudentListItem>
                                );
                            })
                        }
                    </StudentListPanel>
                    <ChatPanel>
                        {selectedStudentId ? (
                            <>
                                <ChatHeader>{players.find(p => p.id === selectedStudentId)?.name} 학생과의 대화</ChatHeader>
                                <MessageArea ref={messageAreaRef}>
                                    {selectedThreadMessages.length > 0 ? (
                                        selectedThreadMessages.map((message, index) => {
                                            const currentMessageDate = formatDate(message.createdAt);
                                            const prevMessageDate = index > 0 ? formatDate(selectedThreadMessages[index - 1].createdAt) : null;
                                            const showDateSeparator = currentMessageDate !== prevMessageDate;

                                            return (
                                                <React.Fragment key={index}>
                                                    {showDateSeparator && <DateSeparator>{currentMessageDate}</DateSeparator>}
                                                    <MessageBubble className={message.sender}>
                                                        {message.content}
                                                        <Timestamp $align={message.sender === 'student' ? 'right' : 'left'}>
                                                            {message.createdAt?.toDate().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </Timestamp>
                                                    </MessageBubble>
                                                </React.Fragment>
                                            );
                                        })
                                    ) : (
                                        <p style={{ textAlign: 'center', color: '#6c757d' }}>아직 나눈 대화가 없습니다.<br />메시지를 보내 대화를 시작해보세요.</p>
                                    )}
                                </MessageArea>
                                <InputArea>
                                    <TextArea
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="답변을 입력하세요..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleReplySubmit();
                                            }
                                        }}
                                    />
                                    <SubmitButton onClick={handleReplySubmit} disabled={!replyContent.trim()}>전송</SubmitButton>
                                </InputArea>
                            </>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6c757d' }}>
                                <p>왼쪽에서 학생을 선택하여 대화를 시작하세요.</p>
                            </div>
                        )}
                    </ChatPanel>
                </ChatLayout>
            </Section>
        </FullWidthSection>
    );
}

function GoalManager() {
    const [title, setTitle] = useState('');
    const [targetPoints, setTargetPoints] = useState(10000);
    const [activeGoals, setActiveGoals] = useState([]);

    const fetchGoals = async () => {
        const goals = await getActiveGoals();
        setActiveGoals(goals);
    };

    useEffect(() => {
        fetchGoals();
    }, []);

    const handleCreateGoal = async () => {
        if (!title.trim() || targetPoints <= 0) {
            return alert('목표 이름과 올바른 목표 포인트를 입력해주세요.');
        }
        try {
            await createClassGoal({ title, targetPoints: Number(targetPoints) });
            alert('새로운 학급 목표가 설정되었습니다!');
            setTitle('');
            setTargetPoints(10000);
            fetchGoals();
        } catch (error) {
            alert(`목표 생성 실패: ${error.message}`);
        }
    };

    const handleGoalStatusToggle = async (goal) => {
        const newStatus = goal.status === 'paused' ? 'active' : 'paused';
        const actionText = newStatus === 'paused' ? '일시중단' : '다시시작';
        if (window.confirm(`'${goal.title}' 목표를 '${actionText}' 상태로 변경하시겠습니까?`)) {
            try {
                await updateClassGoalStatus(goal.id, newStatus);
                alert(`목표가 ${actionText} 처리되었습니다.`);
                fetchGoals();
            } catch (error) {
                alert(`상태 변경 실패: ${error.message}`);
            }
        }
    };

    const handleGoalDelete = async (goalId) => {
        if (window.confirm("정말로 이 목표를 삭제하시겠습니까? 기부 내역도 함께 사라집니다.")) {
            try {
                await deleteClassGoal(goalId);
                alert('목표가 삭제되었습니다.');
                fetchGoals();
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    const handleGoalComplete = async (goalId) => {
        if (window.confirm("이 목표를 '완료' 처리하여 대시보드에서 숨기시겠습니까?")) {
            try {
                await completeClassGoal(goalId);
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

function MissionManager() {
    const {
        missions,
        archivedMissions,
        archiveMission,
        unarchiveMission,
        removeMission,
        fetchInitialData,
        reorderMissions
    } = useLeagueStore();
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor)); // 드래그 센서 추가

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            const listKey = showArchived ? 'archivedMissions' : 'missions';
            const oldIndex = missionsToDisplay.findIndex(m => m.id === active.id);
            const newIndex = missionsToDisplay.findIndex(m => m.id === over.id);
            const newList = arrayMove(missionsToDisplay, oldIndex, newIndex);

            reorderMissions(newList, listKey);
        }
    };

    // ▼▼▼ [수정] 미션 생성을 위한 state 확장 ▼▼▼
    const [title, setTitle] = useState('');
    const [placeholderText, setPlaceholderText] = useState(''); // [추가] 문제 텍스트 상태
    const [rewards, setRewards] = useState(['100', '', '']); // 차등 보상
    const [submissionTypes, setSubmissionTypes] = useState({ text: false, photo: false });
    const [isFixed, setIsFixed] = useState(false); // 고정 미션
    const [adminOnly, setAdminOnly] = useState(false); // 관리자 전용
    const [prerequisiteMissionId, setPrerequisiteMissionId] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState({
        rewards: false,
        prerequisite: false,
    });
    // ▲▲▲ 여기까지 수정 ▲▲▲
    const handleSubmissionTypeChange = (type) => {
        setSubmissionTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const handleCreateMission = async () => {
        // ▼▼▼ [수정] 새로운 UI state를 기반으로 데이터 처리 ▼▼▼
        if (!title.trim() || !rewards[0]) {
            return alert('미션 이름과 기본 보상 포인트를 모두 입력해주세요.');
        }

        const selectedTypes = Object.entries(submissionTypes)
            .filter(([, isSelected]) => isSelected)
            .map(([type]) => type);
        const typeToSend = selectedTypes.length > 0 ? selectedTypes : ['simple'];

        // 차등 보상 배열 정리 (숫자 변환 및 빈 값 제거)
        const finalRewards = rewards
            .map(r => Number(r))
            .filter(r => r > 0);

        try {
            await createMission({
                title,
                rewards: finalRewards, // reward -> rewards 배열로 변경
                submissionType: typeToSend,
                isFixed: isFixed, // 고정 미션 여부
                adminOnly: adminOnly, // 관리자 전용 여부D
                prerequisiteMissionId: prerequisiteMissionId || null,
                placeholderText: placeholderText.trim(), // [추가] 문제 텍스트 추가
            });
            alert('새로운 미션이 등록되었습니다!');
            // 모든 state 초기화
            setTitle('');
            setPlaceholderText(''); // [추가] 문제 텍스트 상태 초기화
            setRewards(['100', '', '']);
            setSubmissionTypes({ text: false, photo: false });
            setIsFixed(false);
            setAdminOnly(false);
            setPrerequisiteMissionId('');
            setShowAdvanced({ rewards: false, prerequisite: false });
            await fetchInitialData();
        } catch (error) {
            console.error("미션 생성 오류:", error);
            alert('미션 생성 중 오류가 발생했습니다.');
        }
    };

    const missionsToDisplay = showArchived ? archivedMissions : missions;

    return (
        <Section>
            <SectionTitle>미션 관리 📜</SectionTitle>
            {/* ▼▼▼ [재수정] 미션 출제 UI 레이아웃 변경 ▼▼▼ */}
            <div style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                {/* 1줄: 기본 정보 */}
                <InputGroup>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="미션 이름"
                        style={{ flex: 1, minWidth: '200px', padding: '0.5rem' }}
                    />
                    <ScoreInput
                        type="number"
                        value={rewards[0]}
                        onChange={(e) => setRewards(prev => [e.target.value, prev[1], prev[2]])}
                        style={{ width: '80px' }}
                        placeholder="기본 보상"
                    />
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label title="글 제출 필요"><input type="checkbox" checked={submissionTypes.text} onChange={() => handleSubmissionTypeChange('text')} /> 글</label>
                        <label title="사진 제출 필요"><input type="checkbox" checked={submissionTypes.photo} onChange={() => handleSubmissionTypeChange('photo')} /> 사진</label>
                    </div>
                </InputGroup>

                {/* [수정] '글' 체크박스가 선택된 경우에만 문제 내용 입력란 표시 */}
                {submissionTypes.text && (
                    <InputGroup>
                        <TextArea
                            value={placeholderText}
                            onChange={(e) => setPlaceholderText(e.target.value)}
                            placeholder="학생들에게 보여줄 문제나 안내사항을 여기에 입력하세요. (예: 책 이름, 줄거리, 느낀 점 10줄 이상 작성)"
                            style={{ minHeight: '60px' }}
                        />
                    </InputGroup>
                )}

                {/* 2줄: 추가 설정 영역 (토글) */}
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

                {/* 3줄: 액션 버튼 */}
                <InputGroup style={{ justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, rewards: !p.rewards }))} style={{ backgroundColor: showAdvanced.rewards ? '#e0a800' : '#ffc107', color: 'black' }}>차등 보상</StyledButton>
                    <StyledButton onClick={() => setShowAdvanced(p => ({ ...p, prerequisite: !p.prerequisite }))} style={{ backgroundColor: showAdvanced.prerequisite ? '#5a6268' : '#6c757d' }}>연계 미션</StyledButton>
                    <StyledButton onClick={() => setIsFixed(p => !p)} style={{ backgroundColor: isFixed ? '#17a2b8' : '#6c757d' }}>{isFixed ? '반복(활성)' : '반복 미션'}</StyledButton>
                    <StyledButton onClick={() => setAdminOnly(p => !p)} style={{ backgroundColor: adminOnly ? '#dc3545' : '#6c757d' }}>{adminOnly ? ' 관리(활성)' : '관리자만'}</StyledButton>
                    <SaveButton onClick={handleCreateMission}>미션 출제</SaveButton>
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
                                missionsToDisplay.map((mission) => ( // [수정] index prop 제거
                                    <SortableListItem
                                        key={mission.id}
                                        id={mission.id}
                                        mission={mission}
                                        navigate={navigate}
                                        unarchiveMission={unarchiveMission}
                                        archiveMission={archiveMission}
                                        removeMission={removeMission}
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

function AvatarPartManager() {
    const { avatarParts, fetchInitialData, updateLocalAvatarPartStatus, updateLocalAvatarPartDisplayName, batchMoveAvatarPartCategory } = useLeagueStore();
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('hair');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [slots, setSlots] = useState({}); // <-- 이 부분을 추가해주세요.
    const [isSaleMode, setIsSaleMode] = useState(false);
    const [isSaleDayMode, setIsSaleDayMode] = useState(false);
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [salePercent, setSalePercent] = useState(0);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveTargetCategory, setMoveTargetCategory] = useState('');

    const handleBatchMove = async () => {
        if (checkedItems.size === 0) return alert('이동할 아이템을 하나 이상 선택해주세요.');
        if (!moveTargetCategory) return alert('이동할 카테고리를 선택해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개의 아이템을 '${moveTargetCategory}' 카테고리로 이동하시겠습니까?`)) {
            try {
                await batchMoveAvatarPartCategory(Array.from(checkedItems), moveTargetCategory);
                alert('아이템이 이동되었습니다.');
                setCheckedItems(new Set());
                setIsMoveMode(false);
                setMoveTargetCategory('');
            } catch (error) {
                alert(`아이템 이동 실패: ${error.message}`);
            }
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;
    const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

    const partCategories = useMemo(() => {
        return avatarParts.reduce((acc, part) => {
            if (!acc[part.category]) acc[part.category] = [];
            acc[part.category].push(part);
            return acc;
        }, {});
    }, [avatarParts]);

    const sortedCategories = Object.keys(partCategories).sort();
    const [activeTab, setActiveTab] = useState(sortedCategories[0] || '');

    useEffect(() => {
        if (!activeTab && sortedCategories.length > 0) setActiveTab(sortedCategories[0]);
    }, [sortedCategories, activeTab]);

    useEffect(() => {
        const initialPrices = {};
        const initialDisplayNames = {};
        const initialSlots = {}; // slots 초기화 로직 추가
        avatarParts.forEach(part => {
            initialPrices[part.id] = part.price || 0;
            initialDisplayNames[part.id] = part.displayName || '';
            if (part.category === 'accessory') {
                initialSlots[part.id] = part.slot || 'face'; // 기본값을 'face'로 설정
            }
        });
        setPrices(initialPrices);
        setDisplayNames(initialDisplayNames);
        setSlots(initialSlots); // slots state 업데이트
    }, [avatarParts]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const currentTabItems = useMemo(() => partCategories[activeTab] || [], [partCategories, activeTab]);
    const totalPages = Math.ceil(currentTabItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return currentTabItems.slice(startIndex, endIndex);
    }, [currentTabItems, currentPage]);

    const handlePriceChange = (partId, value) => setPrices(prev => ({ ...prev, [partId]: value }));
    const handleFileChange = (e) => setFiles(Array.from(e.target.files));
    const handleSlotChange = (partId, value) => setSlots(prev => ({ ...prev, [partId]: value })); // <-- 이 부분을 추가해주세요.
    const handleCheckboxChange = (partId) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(partId)) newSet.delete(partId);
            else newSet.add(partId);
            return newSet;
        });
    };
    const handleSelectAll = () => {
        const currentTabItems = partCategories[activeTab]?.map(part => part.id) || [];
        const allSelected = currentTabItems.length > 0 && currentTabItems.every(id => checkedItems.has(id));
        if (allSelected) { setCheckedItems(new Set()); }
        else { setCheckedItems(new Set(currentTabItems)); }
    };
    const handleDisplayNameChange = (partId, value) => setDisplayNames(prev => ({ ...prev, [partId]: value }));

    const handleSaveDisplayName = async (partId) => {
        const newName = displayNames[partId].trim();
        try {
            await updateAvatarPartDisplayName(partId, newName);
            updateLocalAvatarPartDisplayName(partId, newName); // 로컬 상태만 업데이트
            alert('이름이 저장되었습니다.'); // 사용자에게 피드백
        } catch (error) {
            alert(`이름 저장 실패: ${error.message}`);
        }
    };

    const handleSaveAllChanges = async () => {
        const confirmMessage = activeTab === 'accessory'
            ? "현재 탭의 모든 아이템 가격과 착용 부위를 저장하시겠습니까?"
            : "현재 탭의 모든 아이템 가격을 저장하시겠습니까?";

        if (!window.confirm(confirmMessage)) return;

        try {
            const priceUpdates = Object.entries(prices)
                .filter(([id]) => partCategories[activeTab]?.some(part => part.id === id))
                .map(([id, price]) => ({ id, price: Number(price) }));

            const slotUpdates = activeTab === 'accessory'
                ? Object.entries(slots)
                    .filter(([id]) => partCategories[activeTab]?.some(part => part.id === id))
                    .map(([id, slot]) => ({ id, slot }))
                : [];

            await batchUpdateAvatarPartDetails(priceUpdates, slotUpdates);

            alert('변경사항이 성공적으로 저장되었습니다.');
            // await fetchInitialData(); // 전체 데이터 새로고침 제거
        } catch (error) {
            console.error("저장 오류:", error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            // [수정] 올바른 아바타 파츠 업로드 함수를 호출합니다.
            const newItems = await Promise.all(files.map(file => uploadAvatarPart(file, uploadCategory)));
            // [수정] 스토어의 avatarParts 상태를 업데이트합니다.
            useLeagueStore.setState(state => ({
                avatarParts: [...state.avatarParts, ...newItems]
            }));
            alert(`${files.length}개의 아바타 아이템이 업로드되었습니다!`);
            setFiles([]);
            // [수정] 올바른 파일 입력창 ID를 참조하여 초기화합니다.
            document.getElementById('avatar-file-input').value = "";
        } catch (error) {
            console.error("아바타 아이템 업로드 오류:", error);
            alert('아바타 아이템 업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleStatus = async (part) => {
        const newStatus = part.status === 'hidden' ? 'visible' : 'hidden';
        try {
            await updateAvatarPartStatus(part.id, newStatus);
            updateLocalAvatarPartStatus(part.id, newStatus); // 로컬 상태만 업데이트
        } catch (error) {
            alert(`오류: ${error.message}`);
            // fetchInitialData(); // 전체 데이터 새로고침 제거
        }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
                // ▼▼▼ [핵심 수정] 로컬 상태 업데이트 시, JS Date 객체를 Firestore Timestamp처럼 보이게 만듭니다. ▼▼▼
                useLeagueStore.setState(state => {
                    const updatedAvatarParts = state.avatarParts.map(part => {
                        if (checkedItems.has(part.id)) {
                            const originalPrice = part.price;
                            const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));
                            return {
                                ...part,
                                isSale: true,
                                originalPrice,
                                salePrice,
                                // .toDate() 메서드를 가진 객체로 감싸서 데이터 형식을 맞춥니다.
                                saleStartDate: { toDate: () => startDate },
                                saleEndDate: { toDate: () => endDate }
                            };
                        }
                        return part;
                    });
                    return { avatarParts: updatedAvatarParts };
                });
                setCheckedItems(new Set());
                setIsSaleMode(false);
                alert('세일이 적용되었습니다.');
            } catch (error) { alert(`세일 적용 실패: ${error.message}`); }
        }
    };

    const handleEndSale = async (partId) => {
        if (window.confirm(`'${partId}' 아이템의 세일을 즉시 종료하시겠습니까?`)) {
            try {
                await batchEndSale([partId]);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    avatarParts: state.avatarParts.map(part =>
                        part.id === partId ? { ...part, isSale: false, salePrice: null, originalPrice: null, saleStartDate: null, saleEndDate: null } : part
                    )
                }));
                alert('세일이 종료되었습니다.');
            } catch (error) { alert(`세일 종료 실패: ${error.message}`); }
        }
    };

    const handleDayToggle = (dayIndex) => {
        setSelectedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayIndex)) newSet.delete(dayIndex);
            else newSet.add(dayIndex);
            return newSet;
        });
    };

    const handleSaveSaleDays = async () => {
        if (checkedItems.size === 0) return alert('요일을 설정할 아이템을 하나 이상 선택해주세요.');
        const dayArray = Array.from(selectedDays).sort();
        const dayNames = dayArray.map(d => DAYS_OF_WEEK[d]).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템을 [${dayNames}] 요일에만 판매하도록 설정하시겠습니까?\n(선택한 요일이 없으면 상시 판매로 변경됩니다.)`)) {
            try {
                await batchUpdateSaleDays(Array.from(checkedItems), dayArray);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    avatarParts: state.avatarParts.map(part =>
                        checkedItems.has(part.id) ? { ...part, saleDays: dayArray } : part
                    )
                }));
                setCheckedItems(new Set());
                setIsSaleDayMode(false);
                alert('판매 요일이 설정되었습니다.');
            } catch (error) { alert(`요일 설정 실패: ${error.message}`); }
        }
    };

    const handleBatchDelete = async () => {
        if (checkedItems.size === 0) return alert('삭제할 아이템을 하나 이상 선택해주세요.');

        const itemsToDelete = Array.from(checkedItems).map(id => avatarParts.find(p => p.id === id)).filter(Boolean);
        const itemNames = itemsToDelete.map(p => p.displayName || p.id).join(', ');

        if (window.confirm(`선택한 ${checkedItems.size}개 아이템(${itemNames})을 영구적으로 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`)) {
            try {
                await batchDeleteAvatarParts(itemsToDelete);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    avatarParts: state.avatarParts.filter(part => !checkedItems.has(part.id))
                }));
                setCheckedItems(new Set());
                setIsDeleteMode(false);
                alert('선택한 아이템이 삭제되었습니다.');
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>아바타 아이템 관리 🎨</SectionTitle>

                <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                    <input type="file" id="avatar-file-input" onChange={handleFileChange} accept="image/png, image/gif" multiple />
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                        <option value="hair">머리</option><option value="top">상의</option><option value="bottom">하의</option><option value="shoes">신발</option>
                        <option value="face">얼굴</option><option value="eyes">눈</option><option value="nose">코</option><option value="mouth">입</option>
                        <option value="accessory">액세서리</option>
                    </select>
                    <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
                        {isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}
                    </SaveButton>
                </InputGroup>

                <InputGroup style={{ justifyContent: 'flex-start' }}>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {/* ▼▼▼ [수정] 아이템 이동 버튼 추가 ▼▼▼ */}
                    <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                        {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                        {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                    </SaveButton>
                </InputGroup>

                {/* ▼▼▼ [추가] 아이템 이동 패널 ▼▼▼ */}
                {isMoveMode && (<div style={{ border: '2px solid #ffc107', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff9e6' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchMove} disabled={checkedItems.size === 0 || !moveTargetCategory} style={{ backgroundColor: '#ffc107', color: 'black' }}>
                            {checkedItems.size}개 이동 실행
                        </SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>이동할 카테고리:</span>
                        <select
                            value={moveTargetCategory}
                            onChange={(e) => setMoveTargetCategory(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem' }}
                        >
                            <option value="">-- 카테고리 선택 --</option>
                            {sortedCategories.filter(c => c !== activeTab).map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </InputGroup>
                </div>)}

                {isSaleMode && (<div style={{ border: '2px solid #007bff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0f8ff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleApplySale} disabled={checkedItems.size === 0}>{checkedItems.size}개 세일 적용</SaveButton>
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>할인율(%):</span><ScoreInput type="number" value={salePercent} onChange={e => setSalePercent(Number(e.target.value))} style={{ width: '100px' }} />
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>시작일:</span><DatePicker selected={startDate} onChange={date => setStartDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>종료일:</span><DatePicker selected={endDate} onChange={date => setEndDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                </div>)}

                {isSaleDayMode && (<div style={{ border: '2px solid #17a2b8', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0faff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleSaveSaleDays} disabled={checkedItems.size === 0}>{checkedItems.size}개 요일 설정</SaveButton>
                    </InputGroup>
                    <InputGroup style={{ justifyContent: 'flex-start' }}>
                        <span>판매 요일:</span>
                        {DAYS_OF_WEEK.map((day, index) => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" checked={selectedDays.has(index)} onChange={() => handleDayToggle(index)} /> {day}
                            </label>
                        ))}
                    </InputGroup>
                </div>)}

                {isDeleteMode && (<div style={{ border: '2px solid #dc3545', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff0f1' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: 0 }}>
                        <SaveButton onClick={handleSelectAll}>전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchDelete} disabled={checkedItems.size === 0} style={{ backgroundColor: '#dc3545' }}>
                            {checkedItems.size}개 영구 삭제
                        </SaveButton>
                    </InputGroup>
                </div>)}

                <TabContainer>
                    {sortedCategories.map(category => (
                        <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                            {category} ({partCategories[category]?.length || 0})
                        </TabButton>
                    ))}
                </TabContainer>

                <ItemGrid>

                    {paginatedItems.map(part => {
                        const isCurrentlyOnSale = part.isSale && part.saleStartDate?.toDate() < new Date() && new Date() < part.saleEndDate?.toDate();
                        const saleDaysText = part.saleDays && part.saleDays.length > 0 ? `[${part.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 판매` : null;

                        return (
                            <ItemCard key={part.id}>
                                {(isSaleMode || isSaleDayMode || isMoveMode || isDeleteMode) && (
                                    <div style={{ height: '25px' }}>
                                        <input type="checkbox" checked={checkedItems.has(part.id)} onChange={() => handleCheckboxChange(part.id)} style={{ width: '20px', height: '20px' }} />
                                    </div>)}

                                <div style={{ display: 'flex', width: '100%', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={displayNames[part.id] || ''}
                                        onChange={(e) => handleDisplayNameChange(part.id, e.target.value)}
                                        placeholder={part.id}
                                        style={{ width: '100%', textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                    />
                                    <SaveButton onClick={() => handleSaveDisplayName(part.id)} style={{ padding: '0.5rem' }}>✓</SaveButton>
                                </div>

                                <ItemImage src={part.src} $category={activeTab} />
                                {saleDaysText && (
                                    <div style={{ fontSize: '0.8em', color: '#17a2b8', fontWeight: 'bold' }}>
                                        {saleDaysText}
                                    </div>
                                )}
                                <ScoreInput type="number" value={prices[part.id] || ''} onChange={(e) => handlePriceChange(part.id, e.target.value)} placeholder="가격" style={{ width: '100%', margin: 0 }} />

                                {/* ▼▼▼ 액세서리 탭일 때만 착용 부위 선택 UI를 보여줍니다. ▼▼▼ */}
                                {activeTab === 'accessory' && (
                                    <select
                                        value={slots[part.id] || 'face'}
                                        onChange={(e) => handleSlotChange(part.id, e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                    >
                                        <option value="face">얼굴</option>
                                        <option value="hand">손</option>
                                        <option value="waist">허리</option>
                                        <option value="back">등</option>
                                        <option value="etc">기타</option>
                                    </select>
                                )}

                                {isCurrentlyOnSale && (<div style={{ width: '100%', textAlign: 'center', backgroundColor: 'rgba(255,0,0,0.1)', padding: '5px', borderRadius: '4px', fontSize: '0.8em', color: 'red' }}>
                                    <p style={{ margin: 0, fontWeight: 'bold' }}>{part.salePrice}P ({part.originalPrice ? Math.round(100 - (part.salePrice / part.originalPrice * 100)) : ''}%)</p>
                                    <p style={{ margin: 0 }}>~{part.saleEndDate.toDate().toLocaleDateString()}</p>
                                    <button onClick={() => handleEndSale(part.id)}>즉시 종료</button>
                                </div>
                                )}

                                <button onClick={() => handleToggleStatus(part)} style={{ padding: '8px 16px', marginTop: 'auto', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', color: 'white', backgroundColor: part.status === 'hidden' ? '#6c757d' : '#28a745' }}>
                                    {part.status === 'hidden' ? '숨김 상태' : '진열 중'}
                                </button>
                            </ItemCard>
                        );
                    })}
                </ItemGrid>
                <PaginationContainer>
                    <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                        이전
                    </PageButton>
                    {Array.from({ length: totalPages }, (_, index) => (
                        <PageButton
                            key={index + 1}
                            $isActive={currentPage === index + 1}
                            onClick={() => setCurrentPage(index + 1)}
                        >
                            {index + 1}
                        </PageButton>
                    ))}
                    <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                        다음
                    </PageButton>
                </PaginationContainer>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <SaveButton onClick={handleSaveAllChanges}>
                        {activeTab === 'accessory' ? `${activeTab} 탭 전체 변경사항 저장` : `${activeTab} 탭 전체 가격 저장`}
                    </SaveButton>
                </div>
            </Section>
        </FullWidthSection>
    );
}

// src/pages/AdminPage.jsx

// =================================================================
// ▼▼▼ [수정 완료] 마이룸 아이템 관리 컴포넌트 ▼▼▼
// =================================================================
function MyRoomItemManager() {
    const { fetchInitialData, updateLocalMyRoomItemDisplayName, batchMoveMyRoomItemCategory } = useLeagueStore();
    const myRoomItemsFromStore = useLeagueStore(state => state.myRoomItems);

    const [myRoomItems, setMyRoomItems] = useState([]);
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('가구');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [widths, setWidths] = useState({}); // [신규] 아이템 너비 상태
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaleMode, setIsSaleMode] = useState(false);
    const [isSaleDayMode, setIsSaleDayMode] = useState(false);
    const [salePercent, setSalePercent] = useState(0);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveTargetCategory, setMoveTargetCategory] = useState('');

    const handleBatchMove = async () => {
        if (checkedItems.size === 0) return alert('이동할 아이템을 하나 이상 선택해주세요.');
        if (!moveTargetCategory) return alert('이동할 카테고리를 선택해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개의 아이템을 '${moveTargetCategory}' 카테고리로 이동하시겠습니까?`)) {
            try {
                await batchMoveMyRoomItemCategory(Array.from(checkedItems), moveTargetCategory);
                alert('아이템이 이동되었습니다.');
                setCheckedItems(new Set());
                setIsMoveMode(false);
                setMoveTargetCategory('');
            } catch (error) {
                alert(`아이템 이동 실패: ${error.message}`);
            }
        }
    };
    const ITEMS_PER_PAGE = 8;
    const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

    const refreshItems = async () => {
        setIsLoading(true);
        await fetchInitialData();
        setIsLoading(false);
    };

    useEffect(() => {
        setMyRoomItems(myRoomItemsFromStore);
        const initialPrices = {};
        const initialDisplayNames = {};
        const initialWidths = {}; // [신규]
        myRoomItemsFromStore.forEach(item => {
            initialPrices[item.id] = item.price || 0;
            initialDisplayNames[item.id] = item.displayName || '';
            initialWidths[item.id] = item.width || 15; // [신규] 기본값 15%
        });
        setPrices(initialPrices);
        setDisplayNames(initialDisplayNames);
        setWidths(initialWidths); // [신규]
        if (myRoomItemsFromStore.length > 0 || !useLeagueStore.getState().isLoading) {
            setIsLoading(false);
        }
    }, [myRoomItemsFromStore]);

    const itemCategories = useMemo(() => {
        return myRoomItems.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});
    }, [myRoomItems]);

    const sortedCategories = ['하우스', '배경', '가구', '가전', '소품']; // 카테고리 목록 수정
    const [activeTab, setActiveTab] = useState('가구');

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const currentTabItems = useMemo(() => itemCategories[activeTab] || [], [itemCategories, activeTab]);
    const totalPages = Math.ceil(currentTabItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return currentTabItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentTabItems, currentPage]);

    const handleFileChange = (e) => setFiles(Array.from(e.target.files));
    const handlePriceChange = (itemId, value) => setPrices(prev => ({ ...prev, [itemId]: value }));
    const handleDisplayNameChange = (itemId, value) => setDisplayNames(prev => ({ ...prev, [itemId]: value }));
    const handleWidthChange = (itemId, value) => setWidths(prev => ({ ...prev, [itemId]: value })); // [신규]
    const handleCheckboxChange = (itemId) => {
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId);
            else newSet.add(itemId);
            return newSet;
        });
    };
    const handleSelectAll = () => {
        const currentItemsOnPage = paginatedItems.map(item => item.id);
        const allSelectedOnPage = currentItemsOnPage.length > 0 && currentItemsOnPage.every(id => checkedItems.has(id));
        setCheckedItems(prev => {
            const newSet = new Set(prev);
            if (allSelectedOnPage) {
                currentItemsOnPage.forEach(id => newSet.delete(id));
            } else {
                currentItemsOnPage.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const handleSaveDisplayName = async (itemId) => {
        const newName = displayNames[itemId].trim();
        try {
            await updateMyRoomItemDisplayName(itemId, newName);
            updateLocalMyRoomItemDisplayName(itemId, newName);
        } catch (error) {
            alert(`이름 저장 실패: ${error.message}`);
            refreshItems();
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            await Promise.all(files.map(file => uploadMyRoomItem(file, uploadCategory)));
            alert(`${files.length}개의 아이템이 업로드되었습니다!`);
            setFiles([]);
            document.getElementById('myroom-file-input').value = "";
            refreshItems();
        } catch (error) {
            alert('아이템 업로드 중 오류가 발생했습니다.');
        } finally { setIsUploading(false); }
    };

    const handleSaveAllDetails = async () => {
        if (!window.confirm(`'${activeTab}' 탭의 모든 아이템 가격과 크기를 저장하시겠습니까?`)) return;
        try {
            const currentTabItemIds = new Set(itemCategories[activeTab]?.map(item => item.id) || []);

            const updates = Array.from(currentTabItemIds).map(id => ({
                id,
                price: Number(prices[id] || 0),
                width: Number(widths[id] || 15)
            }));

            await batchUpdateMyRoomItemDetails(updates);

            // ▼▼▼ [신규] 로컬 상태(zustand store) 직접 업데이트 ▼▼▼
            useLeagueStore.setState(state => {
                const updatedMyRoomItems = state.myRoomItems.map(item => {
                    const update = updates.find(u => u.id === item.id);
                    return update ? { ...item, ...update } : item;
                });
                return { myRoomItems: updatedMyRoomItems };
            });

            alert('아이템 정보가 성공적으로 저장되었습니다.');
        } catch (error) {
            alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    const handleBatchDelete = async () => {
        if (checkedItems.size === 0) return alert('삭제할 아이템을 하나 이상 선택해주세요.');
        const itemsToDelete = Array.from(checkedItems).map(id => myRoomItems.find(p => p.id === id)).filter(Boolean);
        const itemNames = itemsToDelete.map(p => p.displayName || p.id).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템(${itemNames})을 영구적으로 삭제합니다.\n이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?`)) {
            try {
                await batchDeleteMyRoomItems(itemsToDelete);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    myRoomItems: state.myRoomItems.filter(item => !checkedItems.has(item.id))
                }));
                setCheckedItems(new Set());
                setIsDeleteMode(false);
                alert('선택한 아이템이 삭제되었습니다.');
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateMyRoomItemSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
                useLeagueStore.setState(state => {
                    const updatedMyRoomItems = state.myRoomItems.map(item => {
                        if (checkedItems.has(item.id)) {
                            const originalPrice = item.price;
                            const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));
                            return {
                                ...item,
                                isSale: true,
                                originalPrice,
                                salePrice,
                                saleStartDate: { toDate: () => startDate },
                                saleEndDate: { toDate: () => endDate }
                            };
                        }
                        return item;
                    });
                    return { myRoomItems: updatedMyRoomItems };
                });
                setCheckedItems(new Set());
                setIsSaleMode(false);
                alert('세일이 적용되었습니다.');
            } catch (error) { alert(`세일 적용 실패: ${error.message}`); }
        }
    };

    const handleEndSale = async (itemId) => {
        if (window.confirm(`'${itemId}' 아이템의 세일을 즉시 종료하시겠습니까?`)) {
            try {
                await batchEndMyRoomItemSale([itemId]);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    myRoomItems: state.myRoomItems.map(item =>
                        item.id === itemId ? { ...item, isSale: false, salePrice: null, originalPrice: null, saleStartDate: null, saleEndDate: null } : item
                    )
                }));
                alert('세일이 종료되었습니다.');
            } catch (error) { alert(`세일 종료 실패: ${error.message}`); }
        }
    };

    const handleDayToggle = (dayIndex) => {
        setSelectedDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dayIndex)) newSet.delete(dayIndex);
            else newSet.add(dayIndex);
            return newSet;
        });
    };

    const handleSaveSaleDays = async () => {
        if (checkedItems.size === 0) return alert('요일을 설정할 아이템을 하나 이상 선택해주세요.');
        const dayArray = Array.from(selectedDays).sort();
        const dayNames = dayArray.map(d => DAYS_OF_WEEK[d]).join(', ');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템을 [${dayNames}] 요일에만 판매하도록 설정하시겠습니까?\n(선택한 요일이 없으면 상시 판매로 변경됩니다.)`)) {
            try {
                await batchUpdateMyRoomItemSaleDays(Array.from(checkedItems), dayArray);
                // ▼▼▼ [수정] 로컬 상태 직접 업데이트 ▼▼▼
                useLeagueStore.setState(state => ({
                    myRoomItems: state.myRoomItems.map(item =>
                        checkedItems.has(item.id) ? { ...item, saleDays: dayArray } : item
                    )
                }));
                setCheckedItems(new Set());
                setIsSaleDayMode(false);
                alert('판매 요일이 설정되었습니다.');
            } catch (error) { alert(`요일 설정 실패: ${error.message}`); }
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>마이룸 아이템 관리 🏠</SectionTitle>
                <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <input type="file" id="myroom-file-input" onChange={handleFileChange} accept="image/png, image/jpeg, image/gif" multiple />
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                        <option value="배경">배경</option>
                        <option value="하우스">하우스</option>
                        <option value="가구">가구</option>
                        <option value="가전">가전</option>
                        <option value="소품">소품</option>

                    </select>
                    <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
                        {isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}
                    </SaveButton>
                </InputGroup>

                <InputGroup>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {/* ▼▼▼ [수정] 아이템 이동 버튼 추가 ▼▼▼ */}
                    <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                        {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                        {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                    </SaveButton>
                </InputGroup>

                {isMoveMode && (<div style={{ border: '2px solid #ffc107', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff9e6' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchMove} disabled={checkedItems.size === 0 || !moveTargetCategory} style={{ backgroundColor: '#ffc107', color: 'black' }}>
                            {checkedItems.size}개 이동 실행
                        </SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>이동할 카테고리:</span>
                        <select
                            value={moveTargetCategory}
                            onChange={(e) => setMoveTargetCategory(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem' }}
                        >
                            <option value="">-- 카테고리 선택 --</option>
                            {sortedCategories.filter(c => c !== activeTab).map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </InputGroup>
                </div>)}

                {isSaleMode && (<div style={{ border: '2px solid #007bff', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0f8ff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleApplySale} disabled={checkedItems.size === 0}>{checkedItems.size}개 세일 적용</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>할인율(%):</span><ScoreInput type="number" value={salePercent} onChange={e => setSalePercent(Number(e.target.value))} style={{ width: '100px' }} />
                        <span>시작일:</span><DatePicker selected={startDate} onChange={date => setStartDate(date)} dateFormat="yyyy/MM/dd" />
                        <span>종료일:</span><DatePicker selected={endDate} onChange={date => setEndDate(date)} dateFormat="yyyy/MM/dd" />
                    </InputGroup>
                </div>)}

                {isSaleDayMode && (<div style={{ border: '2px solid #17a2b8', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#f0faff' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleSaveSaleDays} disabled={checkedItems.size === 0}>{checkedItems.size}개 요일 설정</SaveButton>
                    </InputGroup>
                    <InputGroup>
                        <span>판매 요일:</span>
                        {DAYS_OF_WEEK.map((day, index) => (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" checked={selectedDays.has(index)} onChange={() => handleDayToggle(index)} /> {day}
                            </label>
                        ))}
                    </InputGroup>
                </div>)}

                {isDeleteMode && (<div style={{ border: '2px solid #dc3545', borderRadius: '8px', padding: '1.5rem', marginBottom: '1rem', backgroundColor: '#fff0f1' }}>
                    <InputGroup style={{ justifyContent: 'space-between', marginBottom: 0 }}>
                        <SaveButton onClick={handleSelectAll}>현재 페이지 전체 선택/해제</SaveButton>
                        <SaveButton onClick={handleBatchDelete} disabled={checkedItems.size === 0} style={{ backgroundColor: '#dc3545' }}>
                            {checkedItems.size}개 영구 삭제
                        </SaveButton>
                    </InputGroup>
                </div>)}

                <TabContainer>
                    {sortedCategories.map(category => (
                        <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                            {category} ({itemCategories[category]?.length || 0})
                        </TabButton>
                    ))}
                </TabContainer>

                {isLoading ? <p>아이템 목록을 불러오는 중...</p> : (
                    <>
                        <ItemGrid>
                            {paginatedItems.map(item => {
                                const isCurrentlyOnSale = item.isSale && item.saleStartDate?.toDate() < new Date() && new Date() < item.saleEndDate?.toDate();
                                const saleDaysText = item.saleDays && item.saleDays.length > 0 ? `[${item.saleDays.map(d => DAYS_OF_WEEK[d]).join(',')}] 판매` : null;

                                return (
                                    <ItemCard key={item.id}>
                                        {(isSaleMode || isSaleDayMode || isMoveMode || isDeleteMode) && (
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1 }}>
                                                <input type="checkbox" checked={checkedItems.has(item.id)} onChange={() => handleCheckboxChange(item.id)} style={{ width: '20px', height: '20px' }} />
                                            </div>
                                        )}
                                        {isCurrentlyOnSale && <SaleBadge>SALE</SaleBadge>}

                                        <div style={{ display: 'flex', width: '100%', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                            <input
                                                type="text"
                                                value={displayNames[item.id] || ''}
                                                onChange={(e) => handleDisplayNameChange(item.id, e.target.value)}
                                                placeholder={item.id}
                                                style={{ width: '100%', textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                            />
                                            <SaveButton onClick={() => handleSaveDisplayName(item.id)} style={{ padding: '0.5rem' }}>✓</SaveButton>
                                        </div>

                                        <ItemImage
                                            src={item.src}
                                            $category={item.category}
                                            style={{ backgroundSize: 'contain', backgroundPosition: 'center' }}
                                        />

                                        {saleDaysText && (
                                            <div style={{ fontSize: '0.8em', color: '#17a2b8', fontWeight: 'bold' }}>{saleDaysText}</div>
                                        )}
                                        <ScoreInput type="number" value={prices[item.id] || ''} onChange={(e) => handlePriceChange(item.id, e.target.value)} placeholder="가격" style={{ width: '100%', margin: '0.5rem 0' }} />
                                        {/* ▼▼▼ [신규] 너비 조절 입력 필드 추가 ▼▼▼ */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <label htmlFor={`width-${item.id}`} style={{ fontSize: '0.8rem' }}>크기(%):</label>
                                            <ScoreInput id={`width-${item.id}`} type="number" value={widths[item.id] || ''} onChange={(e) => handleWidthChange(item.id, e.target.value)} style={{ width: '100%', margin: 0 }} />
                                        </div>
                                        {isCurrentlyOnSale && (
                                            <div style={{ fontSize: '0.8em', color: 'red', marginTop: '0.5rem' }}>
                                                <p style={{ margin: 0 }}>{item.salePrice}P ({Math.round(100 - (item.salePrice / item.originalPrice * 100))}%)</p>
                                                <button onClick={() => handleEndSale(item.id)} style={{ fontSize: '0.7em' }}>세일 종료</button>
                                            </div>
                                        )}
                                    </ItemCard>
                                );
                            })}
                        </ItemGrid>
                        <PaginationContainer>
                            <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>이전</PageButton>
                            {Array.from({ length: totalPages }, (_, i) => (
                                <PageButton key={i + 1} $isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>{i + 1}</PageButton>
                            ))}
                            <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>다음</PageButton>
                        </PaginationContainer>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <SaveButton onClick={handleSaveAllDetails}>'{activeTab}' 탭 정보 모두 저장</SaveButton>
                        </div>
                    </>
                )}
            </Section>
        </FullWidthSection>
    );
}

function RoleManager() {
    const { players, fetchInitialData } = useLeagueStore();
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [selectedRole, setSelectedRole] = useState('player');

    useEffect(() => {
        if (selectedPlayerId) {
            const player = players.find(p => p.id === selectedPlayerId);
            if (player) {
                setSelectedRole(player.role || 'player');
            }
        }
    }, [selectedPlayerId, players]);

    const handleSaveRole = async () => {
        const player = players.find(p => p.id === selectedPlayerId);
        if (!player) return alert('선수를 선택해주세요.');
        if (!player.authUid) {
            return alert('역할을 저장하려면 먼저 계정이 연결된 선수여야 합니다. (미연결 선수는 역할 변경 불가)');
        }

        try {
            await linkPlayerToAuth(selectedPlayerId, player.authUid, selectedRole);
            alert(`${player.name}님의 역할이 ${selectedRole}(으)로 변경되었습니다.`);
            await fetchInitialData();
        } catch (error) {
            alert(`역할 변경 실패: ${error.message}`);
        }
    };

    return (
        <Section>
            <SectionTitle>사용자 역할 관리 🧑‍⚖️</SectionTitle>
            <InputGroup>
                <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem' }}
                >
                    <option value="">-- 선수 선택 --</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.authUid ? '연결됨' : '미연결'})</option>)}
                </select>
            </InputGroup>
            {selectedPlayerId && (
                <InputGroup>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                        <option value="player">일반 참가자</option>
                        <option value="captain">팀장</option>
                        <option value="recorder">기록원</option>
                        <option value="referee">학생 심판</option>
                        <option value="admin">관리자</option>
                    </select>
                    <SaveButton onClick={handleSaveRole}>역할 저장</SaveButton>
                </InputGroup>
            )}
        </Section>
    );
}


function PointManager() {
    const { players, batchAdjustPoints } = useLeagueStore();
    const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');

    const handlePlayerSelect = (playerId) => {
        setSelectedPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                newSet.add(playerId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const nonAdminPlayerIds = players.filter(p => p.role !== 'admin').map(p => p.id);
        const allSelected = nonAdminPlayerIds.length > 0 && nonAdminPlayerIds.every(id => selectedPlayerIds.has(id));

        if (allSelected) {
            setSelectedPlayerIds(new Set());
        } else {
            setSelectedPlayerIds(new Set(nonAdminPlayerIds));
        }
    };

    const handleSubmit = () => {
        batchAdjustPoints(Array.from(selectedPlayerIds), Number(amount), reason.trim());
        setSelectedPlayerIds(new Set());
        setAmount(0);
        setReason('');
    };

    const sortedPlayers = useMemo(() =>
        [...players].sort((a, b) => a.name.localeCompare(b.name)),
        [players]
    );

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>포인트 수동 조정 💰</SectionTitle>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                        부정행위 페널티 부여 또는 특별 보상 지급 시 사용합니다.
                    </p>
                    <StyledButton onClick={handleSelectAll}>전체 선택/해제</StyledButton>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: 'white',
                    marginBottom: '1rem'
                }}>
                    {sortedPlayers.map(player => {
                        const isAdmin = player.role === 'admin';
                        return (
                            <div key={player.id} title={isAdmin ? "관리자는 선택할 수 없습니다." : ""}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem',
                                    opacity: isAdmin ? 0.5 : 1,
                                    cursor: isAdmin ? 'not-allowed' : 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedPlayerIds.has(player.id)}
                                        onChange={() => !isAdmin && handlePlayerSelect(player.id)}
                                        style={{ width: '18px', height: '18px' }}
                                        disabled={isAdmin}
                                    />
                                    <span>{player.name} (현재: {player.points || 0}P)</span>
                                </label>
                            </div>
                        );
                    })}
                </div>

                <InputGroup>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="변경할 포인트 (차감 시 음수)"
                        style={{ width: '200px', padding: '0.5rem' }}
                    />
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="조정 사유 (예: 봉사활동 보상)"
                        style={{ flex: 1, padding: '0.5rem' }}
                    />
                </InputGroup>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <SaveButton
                        onClick={handleSubmit}
                        disabled={selectedPlayerIds.size === 0 || Number(amount) === 0 || !reason.trim()}
                        style={{ backgroundColor: '#dc3545' }}
                    >
                        {selectedPlayerIds.size}명에게 포인트 조정 실행
                    </SaveButton>
                </div>
            </Section>
        </FullWidthSection>
    );
}

function MatchRow({ match, isInitiallyOpen, onSave }) {
    const { players, teams, saveScores, currentSeason } = useLeagueStore();

    const teamA = useMemo(() => teams.find(t => t.id === match.teamA_id), [teams, match.teamA_id]);
    const teamB = useMemo(() => teams.find(t => t.id === match.teamB_id), [teams, match.teamB_id]);

    const teamAMembers = useMemo(() => teamA?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamA, players]);
    const teamBMembers = useMemo(() => teamB?.members.map(id => players.find(p => p.id === id)).filter(Boolean) || [], [teamB, players]);

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
                    <SaveButton onClick={() => setShowScorers(s => !s)} disabled={!isSeasonActive}>명단</SaveButton>
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

function PlayerManager({ onSendMessage }) {
    const { players, currentSeason, togglePlayerStatus } = useLeagueStore();
    const [showInactive, setShowInactive] = useState(false);
    const isNotPreparing = currentSeason?.status !== 'preparing';

    const sortedPlayers = useMemo(() => {
        const filteredPlayers = players.filter(p => showInactive || p.status !== 'inactive');
        return filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
    }, [players, showInactive]);

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학생 목록</SectionTitle>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <StyledButton onClick={() => setShowInactive(prev => !prev)}>
                        {showInactive ? '활성 학생만 보기' : '비활성 학생 보기'}
                    </StyledButton>
                </div>
                <List>
                    {sortedPlayers.map(player => {
                        const isInactive = player.status === 'inactive';
                        return (
                            <ListItem key={player.id} style={{ gridTemplateColumns: '1fr auto', backgroundColor: isInactive ? '#f1f3f5' : 'transparent' }}>
                                <PlayerProfile player={player} />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <StyledButton onClick={() => onSendMessage(player.id)} style={{ backgroundColor: '#007bff' }}>메시지</StyledButton>
                                    <Link to={`/profile/${player.id}`}>
                                        <StyledButton style={{ backgroundColor: '#17a2b8' }}>프로필</StyledButton>
                                    </Link>
                                    <StyledButton
                                        onClick={() => togglePlayerStatus(player.id, player.status)}
                                        disabled={isNotPreparing && !isInactive}
                                        title={isNotPreparing && !isInactive ? "시즌 중에는 학생을 비활성화할 수 없습니다." : ""}
                                        style={{ backgroundColor: isInactive ? '#28a745' : '#dc3545' }}
                                    >
                                        {isInactive ? '활성화' : '비활성화'}
                                    </StyledButton>
                                </div>
                            </ListItem>
                        );
                    })}
                </List>
            </Section>
        </FullWidthSection>
    );
}


function LeagueManager() {
    const {
        players, teams, matches,
        addNewTeam, removeTeam, assignPlayerToTeam, unassignPlayerFromTeam,
        autoAssignTeams, generateSchedule, batchCreateTeams,
        leagueType, setLeagueType,
        currentSeason, startSeason, endSeason, updateSeasonDetails,
        createSeason, setTeamCaptain
    } = useLeagueStore();

    const isNotPreparing = currentSeason?.status !== 'preparing';
    const [newTeamName, setNewTeamName] = useState('');
    const [maleTeamCount, setMaleTeamCount] = useState(2);
    const [femaleTeamCount, setFemaleTeamCount] = useState(2);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedPlayer, setSelectedPlayer] = useState({});
    const [prizes, setPrizes] = useState({ first: 0, second: 0, third: 0, topScorer: 0 });
    const [newSeasonNameForCreate, setNewSeasonNameForCreate] = useState('');

    const [openedMatchId, setOpenedMatchId] = useState(null);

    const unassignedPlayers = useMemo(() => {
        const assignedPlayerIds = teams.flatMap(team => team.members);
        return players.filter(player => !assignedPlayerIds.includes(player.id));
    }, [players, teams]);

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
        if (currentSeason) {
            setPrizes({
                first: currentSeason.winningPrize || 0,
                second: currentSeason.secondPlacePrize || 0,
                third: currentSeason.thirdPlacePrize || 0,
                topScorer: currentSeason.topScorerPrize || 0,
            });
        }
    }, [currentSeason]);

    const handleSaveAndOpenNext = (savedMatchId) => {
        const pendingMatches = matches.filter(m => m.status !== '완료');
        const currentIndex = pendingMatches.findIndex(m => m.id === savedMatchId);

        const nextMatch = pendingMatches[currentIndex + 1];
        setOpenedMatchId(nextMatch ? nextMatch.id : null);
    };

    const handleCreateSeason = async () => {
        if (!newSeasonNameForCreate.trim()) return alert("새 시즌의 이름을 입력해주세요.");
        if (window.confirm(`'${newSeasonNameForCreate}' 시즌을 새로 시작하시겠습니까?`)) {
            try {
                await createSeason(newSeasonNameForCreate);
                setNewSeasonNameForCreate('');
                alert('새로운 시즌이 생성되었습니다!');
            } catch (error) {
                alert(`시즌 생성에 실패했습니다: ${error.message}`);
            }
        }
    };

    const handlePrizesChange = (rank, value) => {
        setPrizes(prev => ({ ...prev, [rank]: Number(value) || 0 }));
    };

    const handleSavePrizes = async () => {
        try {
            await updateSeasonDetails(currentSeason.id, {
                winningPrize: prizes.first,
                secondPlacePrize: prizes.second,
                thirdPlacePrize: prizes.third,
                topScorerPrize: prizes.topScorer,
            });
            alert('순위별 보상이 저장되었습니다!');
        } catch (error) {
            alert('보상 저장 중 오류가 발생했습니다.');
        }
    };

    const handlePlayerSelect = (teamId, playerId) => {
        setSelectedPlayer(prev => ({ ...prev, [teamId]: playerId }));
    };

    const handleAssignPlayer = (teamId) => {
        assignPlayerToTeam(teamId, selectedPlayer[teamId]);
    };

    const handleAddTeam = () => {
        addNewTeam(newTeamName);
        setNewTeamName('');
    };

    const handleBatchCreateTeams = () => {
        batchCreateTeams(Number(maleTeamCount), Number(femaleTeamCount));
    };


    return (
        <>
            <FullWidthSection>
                <Section>
                    <SectionTitle>시즌 관리 🗓️</SectionTitle>
                    {currentSeason ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3>{currentSeason.seasonName}</h3>
                                    <p style={{ margin: 0 }}>
                                        현재 상태: <strong style={{ color: currentSeason.status === 'preparing' ? 'blue' : (currentSeason.status === 'active' ? 'green' : 'red') }}>{currentSeason.status}</strong>
                                    </p>
                                </div>
                                <div>
                                    {currentSeason.status === 'preparing' && <SaveButton onClick={startSeason}>시즌 시작</SaveButton>}
                                    {currentSeason.status === 'active' && <SaveButton onClick={endSeason} style={{ backgroundColor: '#dc3545' }}>시즌 종료</SaveButton>}
                                </div>
                            </div>
                            {currentSeason.status === 'completed' && (
                                <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                    <InputGroup>
                                        <input
                                            type="text"
                                            value={newSeasonNameForCreate}
                                            onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                            placeholder="새 시즌 이름 입력"
                                            style={{ flex: 1, padding: '0.5rem' }}
                                        />
                                        <SaveButton onClick={handleCreateSeason} style={{ backgroundColor: '#28a745' }}>새 시즌 준비하기</SaveButton>
                                    </InputGroup>
                                </div>
                            )}
                            <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                <InputGroup style={{ justifyContent: 'space-between' }}>
                                    <div>
                                        <label>1위: <ScoreInput type="number" value={prizes.first} onChange={e => handlePrizesChange('first', e.target.value)} /></label>
                                        <label>2위: <ScoreInput type="number" value={prizes.second} onChange={e => handlePrizesChange('second', e.target.value)} /></label>
                                        <label>3위: <ScoreInput type="number" value={prizes.third} onChange={e => handlePrizesChange('third', e.target.value)} /></label>
                                        <label style={{ marginLeft: '1rem' }}>득점왕: <ScoreInput type="number" value={prizes.topScorer} onChange={e => handlePrizesChange('topScorer', e.target.value)} /></label>
                                    </div>
                                    <SaveButton onClick={handleSavePrizes}>보상 저장</SaveButton>
                                </InputGroup>
                            </div>
                        </>
                    ) : (
                        <div>
                            <p>현재 진행중인 시즌이 없습니다. 새 시즌을 시작해주세요.</p>
                            <InputGroup>
                                <input
                                    type="text"
                                    value={newSeasonNameForCreate}
                                    onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                    placeholder="새 시즌 이름 입력 (예: 25-1 시즌)"
                                    style={{ flex: 1, padding: '0.5rem' }}
                                />
                                <SaveButton onClick={handleCreateSeason} style={{ backgroundColor: '#28a745' }}>새 시즌 준비하기</SaveButton>
                            </InputGroup>
                        </div>
                    )}
                </Section>
            </FullWidthSection>
            <FullWidthSection>
                <Section>
                    <SectionTitle>리그 방식 설정</SectionTitle>
                    <TabContainer>
                        <TabButton $active={leagueType === 'mixed'} onClick={() => setLeagueType('mixed')} disabled={isNotPreparing}>통합 리그</TabButton>
                        <TabButton $active={leagueType === 'separated'} onClick={() => setLeagueType('separated')} disabled={isNotPreparing}>남녀 분리 리그</TabButton>
                    </TabContainer>
                </Section>
            </FullWidthSection>
            <FullWidthSection>
                <Section>
                    <SectionTitle>팀 관리</SectionTitle>
                    {leagueType === 'separated' ? (
                        <InputGroup>
                            <label>남자 팀 수: <input type="number" min="0" value={maleTeamCount} onChange={e => setMaleTeamCount(e.target.value)} disabled={isNotPreparing} /></label>
                            <label>여자 팀 수: <input type="number" min="0" value={femaleTeamCount} onChange={e => setFemaleTeamCount(e.target.value)} disabled={isNotPreparing} /></label>
                            <StyledButton onClick={handleBatchCreateTeams} disabled={isNotPreparing}>팀 일괄 생성</StyledButton>
                        </InputGroup>
                    ) : (
                        <InputGroup>
                            <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="새 팀 이름" disabled={isNotPreparing} />
                            <StyledButton onClick={handleAddTeam} disabled={isNotPreparing}>팀 추가</StyledButton>
                        </InputGroup>
                    )}
                    <InputGroup>
                        <StyledButton onClick={autoAssignTeams} style={{ marginLeft: 'auto' }} disabled={isNotPreparing}>팀원 자동 배정</StyledButton>
                    </InputGroup>
                    <List>
                        {teams.map(team => (
                            <ListItem key={team.id} style={{ gridTemplateColumns: '1fr auto' }}>
                                <div style={{ flex: 1, marginRight: '1rem' }}>
                                    <strong>{team.teamName}</strong>
                                    <MemberList>
                                        {team.members?.length > 0 ? team.members.map(memberId => {
                                            const member = players.find(p => p.id === memberId);
                                            if (!member) return null;
                                            const isCaptain = team.captainId === memberId;
                                            return (
                                                <MemberListItem key={memberId}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <CaptainButton
                                                            onClick={() => setTeamCaptain(team.id, memberId)}
                                                            disabled={isNotPreparing || isCaptain}
                                                            $isCaptain={isCaptain}
                                                            title={isNotPreparing ? "시즌 중에는 주장을 변경할 수 없습니다." : (isCaptain ? "현재 주장" : "주장으로 임명")}
                                                        >
                                                            Ⓒ
                                                        </CaptainButton>
                                                        <PlayerProfile player={member} />
                                                    </div>
                                                    <StyledButton onClick={() => unassignPlayerFromTeam(team.id, memberId)} disabled={isNotPreparing}>제외</StyledButton>
                                                </MemberListItem>
                                            )
                                        }) : <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#888' }}>팀원이 없습니다.</p>}
                                    </MemberList>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                    <select onChange={(e) => handlePlayerSelect(team.id, e.target.value)} disabled={isNotPreparing} style={{ width: '100px' }}>
                                        <option value="">선수 선택</option>
                                        {unassignedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <StyledButton onClick={() => handleAssignPlayer(team.id)} disabled={isNotPreparing || !selectedPlayer[team.id]} style={{ width: '100px' }}>추가</StyledButton>
                                    <StyledButton onClick={() => removeTeam(team.id)} disabled={isNotPreparing} style={{ width: '100px' }}>팀 삭제</StyledButton>
                                </div>
                            </ListItem>
                        ))}
                    </List>
                </Section>
            </FullWidthSection>
            <FullWidthSection>
                <Section>
                    <SectionTitle>경기 일정 관리</SectionTitle>
                    <StyledButton onClick={generateSchedule} disabled={isNotPreparing}>경기 일정 자동 생성</StyledButton>
                </Section>
            </FullWidthSection>
            <FullWidthSection>
                <Section>
                    <SectionTitle>경기 결과 입력</SectionTitle>
                    <TabContainer>
                        <TabButton $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>입력 대기</TabButton>
                        <TabButton $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>입력 완료</TabButton>
                    </TabContainer>
                    {filteredMatches.length > 0 ? (
                        filteredMatches.map(match => (
                            <MatchRow
                                key={match.id}
                                match={match}
                                isInitiallyOpen={openedMatchId === match.id}
                                onSave={handleSaveAndOpenNext}
                            />
                        ))
                    ) : <p>해당 목록에 경기가 없습니다.</p>}
                </Section>
            </FullWidthSection>
        </>
    )
}

// =================================================================
// ▼▼▼ [신규] 칭호 관리 컴포넌트 ▼▼▼
// =================================================================
function TitleManager() {
    const { players } = useLeagueStore();
    const [titles, setTitles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTitle, setEditingTitle] = useState(null); // 생성 또는 수정 중인 칭호 데이터
    const [isAssignMode, setIsAssignMode] = useState(null); // 칭호 부여 모드인 칭호 ID
    const [selectedPlayerId, setSelectedPlayerId] = useState('');

    const fetchTitles = async () => {
        setIsLoading(true);
        const titlesData = await getTitles();
        setTitles(titlesData);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTitles();
    }, []);

    const handleCreateNew = () => {
        setEditingTitle({ name: '', icon: '', description: '', type: 'manual' });
        setIsAssignMode(null);
    };

    const handleSave = async () => {
        if (!editingTitle.name) return alert('칭호 이름을 입력하세요.');

        // [추가] 자동 획득 칭호일 경우, 조건 ID 입력을 강제합니다.
        if (editingTitle.type === 'auto' && !editingTitle.conditionId) {
            return alert('자동 획득 칭호는 반드시 조건 ID를 입력해야 합니다.');
        }

        try {
            if (editingTitle.id) { // 수정
                await updateTitle(editingTitle.id, editingTitle); // [수정] editingTitle 객체 전체를 전달
                alert('칭호가 수정되었습니다.');
            } else { // 생성
                await createTitle(editingTitle);
                alert('새로운 칭호가 생성되었습니다.');
            }
            setEditingTitle(null);
            fetchTitles();
        } catch (error) {
            alert(`저장 실패: ${error.message}`);
        }
    };

    const handleDelete = async (titleId, titleName) => {
        if (window.confirm(`'${titleName}' 칭호를 정말로 삭제하시겠습니까?`)) {
            try {
                await deleteTitle(titleId);
                alert('칭호가 삭제되었습니다.');
                fetchTitles();
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    const handleAssignTitle = async () => {
        if (!selectedPlayerId) return alert('학생을 선택하세요.');
        try {
            await grantTitleToPlayerManually(selectedPlayerId, isAssignMode);
            alert('칭호를 성공적으로 부여하고 500P 보상을 지급했습니다.');
            setSelectedPlayerId('');
            setIsAssignMode(null);
            fetchInitialData(); // 학생 데이터를 새로고침하여 포인트 변경사항을 반영
        } catch (error) {
            alert(`부여 실패: ${error.message}`);
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>칭호 관리 🎖️</SectionTitle>
                <StyledButton onClick={handleCreateNew} style={{ marginBottom: '1rem', alignSelf: 'flex-start' }}>
                    새 칭호 만들기
                </StyledButton>

                {editingTitle && (
                    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                        {/* ▼▼▼ [수정] 아이콘 프리셋 선택 UI ▼▼▼ */}
                        <InputGroup>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {['🏆', '🧠', '👑', '⚽', '🕊️', '⭐', '🌳', '💡', '🎤', '🏦', '🎵', '🧹', '🥇', '🥈', '🥉'].map(icon => (
                                    <button
                                        key={icon}
                                        onClick={() => setEditingTitle(p => ({ ...p, icon: icon }))}
                                        style={{
                                            fontSize: '1.5rem',
                                            padding: '0.25rem',
                                            border: editingTitle.icon === icon ? '2px solid #007bff' : '2px solid transparent',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 이름" value={editingTitle.name || ''} onChange={e => setEditingTitle(p => ({ ...p, name: e.target.value }))} style={{ flex: 3 }} />
                            <input type="color" value={editingTitle.color || '#000000'} onChange={e => setEditingTitle(p => ({ ...p, color: e.target.value }))} />
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 설명 (획득 조건 등)" value={editingTitle.description || ''} onChange={e => setEditingTitle(p => ({ ...p, description: e.target.value }))} style={{ flex: 1 }} />
                        </InputGroup>
                        {/* ▼▼▼ [수정] 자동 획득 선택 시 '조건 ID' 입력란이 나타나도록 수정 ▼▼▼ */}
                        {editingTitle.type === 'auto' && (
                            <InputGroup>
                                <input type="text" placeholder="조건 ID (예: mission_30_completed)" value={editingTitle.conditionId || ''} onChange={e => setEditingTitle(p => ({ ...p, conditionId: e.target.value }))} style={{ flex: 1, backgroundColor: '#fffde7' }} />
                            </InputGroup>
                        )}
                        <InputGroup>
                            <select value={editingTitle.type || 'manual'} onChange={e => setEditingTitle(p => ({ ...p, type: e.target.value }))}>
                                <option value="manual">수동 획득</option>
                                <option value="auto">자동 획득</option>
                            </select>
                            <SaveButton onClick={handleSave}>저장</SaveButton>
                            <StyledButton onClick={() => setEditingTitle(null)}>취소</StyledButton>
                        </InputGroup>
                    </div>
                )}

                {isAssignMode && (
                    <div style={{ border: '1px solid #007bff', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                        <h4>'{titles.find(t => t.id === isAssignMode)?.name}' 칭호 부여하기</h4>
                        <InputGroup>
                            <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} style={{ flex: 1 }}>
                                <option value="">-- 학생 선택 --</option>
                                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <SaveButton onClick={handleAssignTitle}>부여</SaveButton>
                            <StyledButton onClick={() => setIsAssignMode(null)}>취소</StyledButton>
                        </InputGroup>
                    </div>
                )}

                <List style={{ maxHeight: 'none' }}>
                    {isLoading ? <p>로딩 중...</p> : titles.map(title => (
                        <ListItem key={title.id} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                            <span style={{ fontSize: '1.5rem' }}>{title.icon}</span>
                            <div>
                                {/* ▼▼▼ [수정] 칭호 이름에 color 스타일 적용 ▼▼▼ */}
                                <strong style={{ color: title.color || '#000000' }}>{title.name}</strong>
                                <p style={{ fontSize: '0.9rem', color: '#6c757d', margin: 0 }}>{title.description}</p>
                            </div>
                            <MissionControls>
                                <StyledButton onClick={() => setIsAssignMode(title.id)}>칭호 주기</StyledButton>
                                <StyledButton onClick={() => setEditingTitle(title)} style={{ backgroundColor: '#ffc107', color: 'black' }}>수정</StyledButton>
                                <StyledButton onClick={() => handleDelete(title.id, title.name)} style={{ backgroundColor: '#dc3545' }}>삭제</StyledButton>
                            </MissionControls>
                        </ListItem>
                    ))}
                </List>
            </Section>
        </FullWidthSection>
    );
}

function AdminPage() {
    const { players } = useLeagueStore();
    const { tab } = useParams();
    const location = useLocation();
    const navigate = useNavigate(); // [수정] navigate 훅 사용
    const [activeMenu, setActiveMenu] = useState(tab || 'mission');
    const [activeSubMenu, setActiveSubMenu] = useState('messages');
    const [studentSubMenu, setStudentSubMenu] = useState('point');
    const [shopSubMenu, setShopSubMenu] = useState('avatar');
    const [preselectedStudentId, setPreselectedStudentId] = useState(null);

    useEffect(() => {
        const studentIdFromState = location.state?.preselectedStudentId;
        if (studentIdFromState) {
            setActiveMenu('social');
            setActiveSubMenu('messages');
            setPreselectedStudentId(studentIdFromState);
            // 상태 사용 후에는 history에서 제거하여 새로고침 시 유지되지 않도록 함
            window.history.replaceState({}, document.title)
        }
    }, [location.state]);

    // [수정] navigate 함수를 사용하여 상태와 함께 이동하도록 핸들러 수정
    const handleSendMessageClick = (studentId) => {
        navigate('/admin', { state: { preselectedStudentId: studentId } });
    };

    const renderContent = () => {
        if (activeMenu === 'mission') {
            return (
                <>
                    <GridContainer>
                        <PendingMissionWidget />
                        <MissionManager />
                    </GridContainer>
                    <GoalManager />
                </>
            );
        }
        if (activeMenu === 'social') {
            switch (activeSubMenu) {
                case 'messages': return <MessageManager preselectedStudentId={preselectedStudentId} onStudentSelect={setPreselectedStudentId} />;
                case 'comments': return <MyRoomCommentMonitor />;
                default: return <MessageManager />;
            }
        }
        if (activeMenu === 'student') {
            switch (studentSubMenu) {
                case 'list': return <PlayerManager onSendMessage={handleSendMessageClick} />;
                case 'point': return <GridContainer><PointManager /><RoleManager /></GridContainer>;
                case 'attendance': return <AttendanceChecker players={players} />;
                default: return <PointManager />;
            }
        }
        if (activeMenu === 'shop') {
            switch (shopSubMenu) {
                case 'avatar': return <AvatarPartManager />;
                case 'myroom': return <MyRoomItemManager />;
                default: return <AvatarPartManager />;
            }
        }
        if (activeMenu === 'league') {
            switch (activeSubMenu) {
                case 'league_manage': return <LeagueManager />;
                case 'player_manage': return <PlayerManager onSendMessage={handleSendMessageClick} />;
                default: return <LeagueManager />;
            }
        }
        if (activeMenu === 'title') {
            return <TitleManager />;
        }
        return <PendingMissionWidget />;
    };

    const handleMenuClick = (menu) => {
        setActiveMenu(menu);
        if (menu === 'social') {
            if (activeMenu !== 'social') setActiveSubMenu('messages');
        } else if (menu === 'student') {
            if (activeMenu !== 'student') setStudentSubMenu('point');
        } else if (menu === 'league') {
            if (activeMenu !== 'league') setActiveSubMenu('league_manage');
        } else {
            setActiveSubMenu('');
        }
    };

    return (
        <AdminWrapper>
            <Sidebar>
                <BroadcastButton to="/broadcast" target="_blank">📺 방송 송출 화면</BroadcastButton>
                <NavList>
                    <NavItem>
                        <NavButton $active={activeMenu === 'mission'} onClick={() => handleMenuClick('mission')}>미션 관리</NavButton>
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'social'} onClick={() => handleMenuClick('social')}>소셜 관리</NavButton>
                        {activeMenu === 'social' && (
                            <SubNavList>
                                <SubNavItem><SubNavButton $active={activeSubMenu === 'messages'} onClick={() => setActiveSubMenu('messages')}>1:1 메시지</SubNavButton></SubNavItem>
                                <SubNavItem><SubNavButton $active={activeSubMenu === 'comments'} onClick={() => setActiveSubMenu('comments')}>마이룸 댓글 모음</SubNavButton></SubNavItem>
                            </SubNavList>
                        )}
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'student'} onClick={() => handleMenuClick('student')}>학생 관리</NavButton>
                        {activeMenu === 'student' && (
                            <SubNavList>
                                <SubNavItem><SubNavButton $active={studentSubMenu === 'point'} onClick={() => setStudentSubMenu('point')}>포인트/역할</SubNavButton></SubNavItem>
                                <SubNavItem><SubNavButton $active={studentSubMenu === 'list'} onClick={() => setStudentSubMenu('list')}>학생 목록</SubNavButton></SubNavItem>
                                <SubNavItem><SubNavButton $active={studentSubMenu === 'attendance'} onClick={() => setStudentSubMenu('attendance')}>출석 확인</SubNavButton></SubNavItem>
                            </SubNavList>
                        )}
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'shop'} onClick={() => handleMenuClick('shop')}>상점 관리</NavButton>
                        {activeMenu === 'shop' && (
                            <SubNavList>
                                <SubNavItem><SubNavButton $active={shopSubMenu === 'avatar'} onClick={() => setShopSubMenu('avatar')}>아바타 아이템</SubNavButton></SubNavItem>
                                <SubNavItem><SubNavButton $active={shopSubMenu === 'myroom'} onClick={() => setShopSubMenu('myroom')}>마이룸 아이템</SubNavButton></SubNavItem>
                            </SubNavList>
                        )}
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'league'} onClick={() => handleMenuClick('league')}>가가볼 리그 관리</NavButton>
                        {activeMenu === 'league' && (
                            <SubNavList>
                                <SubNavItem><SubNavButton $active={activeSubMenu === 'league_manage'} onClick={() => setActiveSubMenu('league_manage')}>시즌/팀/경기 관리</SubNavButton></SubNavItem>
                            </SubNavList>
                        )}
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'title'} onClick={() => handleMenuClick('title')}>칭호 관리</NavButton>
                    </NavItem>
                </NavList>
            </Sidebar>
            <MainContent>
                <Title>👑 관리자 대시보드</Title>
                {renderContent()}
            </MainContent>
        </AdminWrapper>
    );
}

export default AdminPage;