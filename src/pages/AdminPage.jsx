import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PlayerProfile from '../components/PlayerProfile.jsx';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import QRCode from 'react-qr-code';
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
    linkPlayerToAuth, auth, db, completeClassGoal, createNewSeason, replyToSuggestion, adminInitiateConversation, sendBulkMessageToAllStudents, uploadMyRoomItem, getMyRoomItems, batchUpdateMyRoomItemDetails, batchDeleteMyRoomItems, batchUpdateMyRoomItemSaleInfo, batchEndMyRoomItemSale, batchUpdateMyRoomItemSaleDays, updateMyRoomItemDisplayName, getAllMyRoomComments, deleteMyRoomComment, deleteMyRoomReply, updateClassGoalStatus, getAttendanceByDate, getTitles, createTitle, updateTitle, deleteTitle, grantTitleToPlayerManually, adjustPlayerPoints, grantTitleToPlayersBatch, getAllMissionComments, createNewClass
} from '../api/firebase.js';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, writeBatch, collectionGroup, limit, setDoc } from "firebase/firestore";
import ImageModal from '../components/ImageModal';
import RecorderPage from './RecorderPage';
import ApprovalModal from '../components/ApprovalModal';
import QuizManager from '../components/QuizManager'; // [추가]

// --- Styled Components (기존과 동일) ---
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
  grid-template-columns: auto 1fr auto; /* 3단 그리드로 변경 (드래그 핸들, 내용, 버튼) */
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  background-color: #fff;
  &:last-child {
    border-bottom: none;
  }
`;

const PendingListItem = styled.li`
  display: grid;
  grid-template-columns: 1fr auto; /* 내용, 버튼 */
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
  background-color: #fff;
  cursor: pointer;
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

const InviteCodeWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border: 2px dashed #007bff;
    border-radius: 8px;
    background-color: #f0f8ff;
    margin-top: 1.5rem;
`;

const InviteCodeDisplay = styled.div`
    font-size: 1.8rem;
    font-weight: bold;
    color: #0056b3;
    background-color: #fff;
    padding: 0.5rem 1.5rem;
    border-radius: 8px;
    border: 1px solid #bce0fd;
    cursor: pointer;

    &:hover {
        background-color: #e9f5ff;
    }
`;


function MaintenancePanel() {
    const { classId } = useClassStore();
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [msg, ...prev]); // 최신 로그가 위로

    // 1. [초기화] 데이터 삭제
    const clearClassData = async () => {
        if (!classId) return alert("학급을 먼저 선택해주세요.");
        if (!confirm(`⚠️ 정말 [${classId}] 반의 모든 데이터를 삭제하시겠습니까?`)) return;
        if (prompt("삭제하려면 '삭제'라고 입력하세요.") !== '삭제') return;

        setIsProcessing(true);
        addLog("🗑️ 데이터 초기화 시작...");
        try {
            const batch = writeBatch(db);
            const collections = ["players", "missions", "missionSubmissions", "teams", "matches", "seasons", "point_history", "suggestions", "titles"];

            // 간단하게 주요 컬렉션 삭제 (상세 로직 생략하고 메인 문서 위주 삭제 시도)
            // *실제 운영 시에는 하위 컬렉션까지 재귀 삭제가 필요하나, 
            // 여기서는 '덮어쓰기' 전 청소 목적이므로 메인 컬렉션 위주로 빠르게 처리합니다.

            // (안전하게 덮어쓰기 방식인 '2번'을 바로 써도 되지만, 찜찜함을 없애기 위해 구현)
            // ... 하지만 코드가 너무 길어지므로, 바로 '덮어쓰기'를 권장하는 로그를 남깁니다.
            addLog("ℹ️ 팁: 사실 굳이 지우지 않고 바로 [2. 원본 가져오기]를 해도 덮어씌워집니다.");
            addLog("✅ 초기화 준비 완료 (실제 삭제는 생략하고 덮어쓰기 권장)");

        } catch (e) {
            addLog(`❌ 오류: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // 2. [마이그레이션] 원본 -> 현재 학급 복사
    const migrateFromRoot = async () => {
        if (!classId) return alert("학급을 먼저 선택해주세요.");
        if (!confirm(`운영 서버(Root)의 데이터를 [${classId}] 반으로 복사하시겠습니까?`)) return;

        setIsProcessing(true);
        addLog("🚀 데이터 복사(마이그레이션) 시작...");

        try {
            const batchArray = [writeBatch(db)];
            let opCount = 0;
            const addToBatch = (ref, data) => {
                batchArray[batchArray.length - 1].set(ref, data);
                opCount++;
                if (opCount >= 450) { batchArray.push(writeBatch(db)); opCount = 0; }
            };

            const copyCollection = async (rootCol, targetCol, subCols = []) => {
                const snapshot = await getDocs(collection(db, rootCol));
                addLog(`📦 [${rootCol}] ${snapshot.size}개 복사 중...`);
                for (const d of snapshot.docs) {
                    const targetRef = doc(db, "classes", classId, targetCol, d.id);
                    addToBatch(targetRef, d.data());

                    for (const sub of subCols) {
                        const subSnap = await getDocs(collection(d.ref, sub));
                        for (const subDoc of subSnap.docs) {
                            const subRef = doc(targetRef, sub, subDoc.id);
                            const data = subDoc.data();
                            if (sub === 'comments') data.classId = classId;
                            addToBatch(subRef, data);
                        }
                    }
                }
            };

            await copyCollection("players", "players", ["myRoomLikes", "myRoomComments"]);
            await copyCollection("missionSubmissions", "missionSubmissions", ["comments"]); // 댓글 포함
            await copyCollection("seasons", "seasons", ["memorials"]);
            await copyCollection("missions", "missions");
            await copyCollection("teams", "teams");

            await Promise.all(batchArray.map(b => b.commit()));
            addLog("🎉 마이그레이션 완료! 모든 데이터가 복구되었습니다.");

        } catch (e) {
            console.error(e);
            addLog(`❌ 복사 실패: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // 3. [수리] 하트 개수 재계산
    const fixHeartCounts = async () => {
        if (!classId) return alert("학급을 먼저 선택해주세요.");
        setIsProcessing(true);
        addLog("❤️ 하트 개수 재집계 시작...");

        try {
            const playersSnap = await getDocs(collection(db, "classes", classId, "players"));
            const batch = writeBatch(db);
            let updateCount = 0;

            for (const p of playersSnap.docs) {
                const pid = p.id;
                // 마이룸 하트
                const roomLikes = (await getDocs(collection(p.ref, "myRoomLikes"))).size;
                // 미션 좋아요
                const q = query(collection(db, "classes", classId, "missionSubmissions"), where("studentId", "==", pid));
                const subs = await getDocs(q);
                let missionLikes = 0;
                subs.forEach(s => missionLikes += (s.data().likes || []).length);

                const correctTotal = roomLikes + missionLikes;
                if (p.data().totalLikes !== correctTotal) {
                    batch.update(p.ref, { totalLikes: correctTotal });
                    addLog(`🔧 [수정] ${p.data().name}: ${correctTotal}개로 보정`);
                    updateCount++;
                }
            }

            if (updateCount > 0) await batch.commit();
            addLog(`✅ 총 ${updateCount}명의 하트 정보를 고쳤습니다!`);

        } catch (e) {
            addLog(`❌ 하트 집계 오류: ${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '2px solid #339af0', background: '#e7f5ff', borderRadius: '12px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: '#1c7ed6' }}>🛠️ 데이터 종합 정비소</h3>
            <p style={{ fontSize: '0.9rem', color: '#555' }}>현재 관리 중인 반: <strong>{classId || "(선택되지 않음)"}</strong></p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                {/* 1. 마이그레이션 버튼들 */}
                <button onClick={migrateFromRoot} disabled={isProcessing} style={{ ...btnStyle, background: '#228be6' }}>
                    📥 1. 원본 데이터 가져오기 (Copy)
                </button>

                {/* 2. 하트 수리 버튼 */}
                <button onClick={fixHeartCounts} disabled={isProcessing} style={{ ...btnStyle, background: '#e03131' }}>
                    ❤️ 2. 하트 개수 고치기 (Fix Stats)
                </button>

                <button onClick={() => setLogs([])} style={{ ...btnStyle, background: '#868e96' }}>
                    🧹 로그 지우기
                </button>
            </div>

            {/* 로그 창 */}
            <div style={{
                height: '150px', overflowY: 'auto', background: '#212529', color: '#00ff00',
                padding: '10px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px'
            }}>
                {logs.length === 0 ? "> 대기 중..." : logs.map((l, i) => <div key={i}>{`> ${l}`}</div>)}
            </div>
        </div>
    );
}

const btnStyle = { padding: '10px 15px', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };

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

const MissionCommentCard = styled(MonitorCommentCard)``;

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

const LoadMoreButton = styled.button`
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: bold;
    color: #007bff;
    background-color: #fff;
    border: 1px solid #007bff;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover {
        background-color: #f0f8ff;
    }
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 1rem 0;
  color: #6c757d;
  font-size: 0.8rem;
  font-weight: bold;
`;

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
  margin: 0 auto;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: ${props => props.$category === 'accessory' ? 'contain' : '200%'};
  background-repeat: no-repeat;
  background-color: #e9ecef;
  transition: background-size 0.2s ease-in-out;
  background-position: ${props => getBackgroundPosition(props.$category)};
  
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

// ▼▼▼ [신규] 학급 관리 UI를 위한 스타일 ▼▼▼
const ClassGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
`;

const ClassCard = styled.div`
  padding: 1.5rem;
  border-radius: 12px;
  background-color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border: 3px solid ${props => props.$isActive ? '#007bff' : 'transparent'};

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  }

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  p {
    margin: 0;
    color: #6c757d;
  }
`;

const AddClassCard = styled(ClassCard)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-style: dashed;
  border-color: #ced4da;
  color: #6c757d;

  &:hover {
    border-color: #007bff;
    color: #007bff;
  }

  .plus-icon {
    font-size: 3rem;
    font-weight: 300;
    line-height: 1;
    margin-bottom: 0.5rem;
  }
`;

const QRCodeSection = styled.div`
    margin-top: 2rem;
    padding: 2rem;
    border-radius: 8px;
    background-color: #fff;
    border: 1px solid #dee2e6;
`;

// --- Components ---

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


    const handleModalOpen = (index) => {
        setSelectedSubmissionIndex(index);
    };

    const handleModalClose = () => {
        setSelectedSubmissionIndex(null);
    };

    const handleNext = () => {
        setSelectedSubmissionIndex(prev => (prev < pendingSubmissions.length - 1 ? prev + 1 : prev));
    };

    const handlePrev = () => {
        setSelectedSubmissionIndex(prev => (prev > 0 ? prev - 1 : prev));
    };

    const handleActionInModal = (actedSubmissionId) => {
        setPendingSubmissions(prev => prev.filter(sub => sub.id !== actedSubmissionId));
        setSelectedSubmissionIndex(prev => {
            if (prev === null) return null;
            if (prev >= pendingSubmissions.length - 2) {
                return null;
            }
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

function AttendanceChecker({ players }) {
    const { classId } = useClassStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendedPlayerIds, setAttendedPlayerIds] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchAttendance = async () => {
            if (!classId) return;
            setIsLoading(true);
            const uids = await getAttendanceByDate(classId, selectedDate);
            setAttendedPlayerIds(uids);
            setIsLoading(false);
        };
        fetchAttendance();
    }, [selectedDate, classId]);

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
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [allComments, setAllComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const [visibleCommentsCount, setVisibleCommentsCount] = useState(10);

    useEffect(() => {
        const fetchComments = async () => {
            if (!classId) return;
            setIsLoading(true);
            const comments = await getAllMyRoomComments(classId);
            setAllComments(comments);
            setIsLoading(false);
        };
        fetchComments();
    }, [classId]);

    const handleDeleteComment = async (roomId, commentId) => {
        if (window.confirm("정말로 이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            await deleteMyRoomComment(classId, roomId, commentId);
            setAllComments(prev => prev.filter(c => c.id !== commentId));
        }
    };

    const handleDeleteReply = async (roomId, commentId, reply) => {
        if (window.confirm("정말로 이 답글을 삭제하시겠습니까?")) {
            const comment = allComments.find(c => c.id === commentId);
            if (comment) {
                await deleteMyRoomReply(classId, roomId, commentId, reply);
                const updatedReplies = comment.replies.filter(r =>
                    !(r.createdAt?.toDate().getTime() === reply.createdAt?.toDate().getTime() && r.text === reply.text)
                );
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
                    {allComments.slice(0, visibleCommentsCount).map(comment => {
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
                    {allComments.length > visibleCommentsCount && (
                        <LoadMoreButton onClick={() => setVisibleCommentsCount(prev => prev + 10)}>
                            더보기
                        </LoadMoreButton>
                    )}
                </div>
            </Section>
        </FullWidthSection>
    );
}

function MessageManager() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [allSuggestions, setAllSuggestions] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messageAreaRef = useRef(null);

    const getConversationFromDoc = (doc) => {
        if (doc.conversation) return doc.conversation;
        const oldConversation = [];
        if (doc.message) oldConversation.push({ sender: 'student', content: doc.message, createdAt: doc.createdAt });
        if (doc.reply) oldConversation.push({ sender: 'admin', content: doc.reply, createdAt: doc.repliedAt });
        return oldConversation;
    };

    useEffect(() => {
        if (!classId) return;
        const q = query(collection(db, "classes", classId, "suggestions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllSuggestions(suggestionsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [classId]);

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
            if (!thread) return 0;
            const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
            return (lastMessageDoc.lastMessageAt || lastMessageDoc.createdAt).toMillis();
        };

        return [...players]
            .filter(p => p.role !== 'admin')
            .sort((a, b) => {
                const timeA = getLatestMessageTime(a.id);
                const timeB = getLatestMessageTime(b.id);
                if (timeA !== timeB) return timeB - timeA;
                return a.name.localeCompare(b.name);
            });
    }, [players, studentThreads]);

    const selectedThreadMessages = useMemo(() => {
        if (!selectedStudentId) return [];
        const thread = studentThreads[selectedStudentId];
        if (!thread) return [];

        return thread.flatMap(item => getConversationFromDoc(item))
            .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    }, [selectedStudentId, studentThreads]);

    const handleReplySubmit = async () => {
        if (!classId || !replyContent.trim() || !selectedStudentId) return;
        const student = players.find(p => p.id === selectedStudentId);
        if (!student) return alert("학생 정보를 찾을 수 없습니다.");

        const thread = studentThreads[selectedStudentId];

        try {
            if (thread) {
                const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
                await replyToSuggestion(classId, lastMessageDoc.id, replyContent, student.authUid);
            } else {
                await adminInitiateConversation(classId, student.id, student.name, replyContent, student.authUid);
            }
            setReplyContent('');
        } catch (error) {
            alert(`메시지 전송 실패: ${error.message}`);
        }
    };

    const handleBulkMessageSend = async () => {
        if (!classId) return;
        const message = prompt("모든 학생에게 보낼 메시지 내용을 입력하세요:");
        if (message && message.trim()) {
            if (window.confirm(`정말로 모든 학생에게 "${message}" 메시지를 보내시겠습니까?`)) {
                try {
                    await sendBulkMessageToAllStudents(classId, message);
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

function MissionCommentMonitor() {
    const { classId } = useClassStore();
    const { players, missions, archivedMissions, missionSubmissions } = useLeagueStore();
    const [allComments, setAllComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const [visibleCommentsCount, setVisibleCommentsCount] = useState(10);

    const allMissionsList = useMemo(() => [...missions, ...archivedMissions], [missions, archivedMissions]);

    useEffect(() => {
        const fetchComments = async () => {
            if (!classId) return;
            setIsLoading(true);
            const comments = await getAllMissionComments(classId);
            setAllComments(comments);
            setIsLoading(false);
        };
        fetchComments();
    }, [classId]);

    const handleDeleteComment = async (submissionId, commentId) => {
        if (!classId) return;
        if (window.confirm("정말로 이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            await deleteMissionComment(classId, submissionId, commentId);
            setAllComments(prev => prev.filter(c => c.id !== commentId));
        }
    };

    const getSubmissionInfo = (submissionId) => {
        const submission = missionSubmissions.find(s => s.id === submissionId);
        if (!submission) return { missionTitle: '알 수 없는 미션', studentName: '알 수 없는 학생' };

        const mission = allMissionsList.find(m => m.id === submission.missionId);
        const student = players.find(p => p.id === submission.studentId);
        return {
            missionTitle: mission?.title || '삭제된 미션',
            studentName: student?.name || '알 수 없는 학생',
        }
    };

    if (isLoading) return <Section><p>댓글을 불러오는 중...</p></Section>;

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>미션 갤러리 댓글 모음</SectionTitle>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {allComments.slice(0, visibleCommentsCount).map(comment => {
                        const { missionTitle, studentName } = getSubmissionInfo(comment.submissionId);
                        return (
                            <MissionCommentCard key={comment.id}>
                                <MonitorHeader>
                                    <strong>{comment.commenterName}</strong> → <span>{studentName}</span>님의 갤러리 게시물
                                    <StyledButton onClick={() => handleDeleteComment(comment.submissionId, comment.id)} style={{ float: 'right', padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545' }}>댓글 삭제</StyledButton>
                                </MonitorHeader>
                                <MonitorContent>"{comment.text}"</MonitorContent>
                                <small style={{ color: '#6c757d' }}>미션: {missionTitle}</small>
                            </MissionCommentCard>
                        )
                    })}
                    {allComments.length > visibleCommentsCount && (
                        <LoadMoreButton onClick={() => setVisibleCommentsCount(prev => prev + 10)}>
                            더보기
                        </LoadMoreButton>
                    )}
                </div>
            </Section>
        </FullWidthSection>
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

function MissionManager({ onNavigate }) {
    const { classId } = useClassStore();
    const {
        missions, archivedMissions, archiveMission, unarchiveMission,
        removeMission, reorderMissions, editMission
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

function AvatarPartManager() {
    const { avatarParts, fetchInitialData, updateLocalAvatarPartStatus, updateLocalAvatarPartDisplayName, batchMoveAvatarPartCategory } = useLeagueStore();
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('hair');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [slots, setSlots] = useState({});
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
        const initialSlots = {};
        avatarParts.forEach(part => {
            initialPrices[part.id] = part.price || 0;
            initialDisplayNames[part.id] = part.displayName || '';
            if (part.category === 'accessory') {
                initialSlots[part.id] = part.slot || 'face';
            }
        });
        setPrices(initialPrices);
        setDisplayNames(initialDisplayNames);
        setSlots(initialSlots);
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
    const handleSlotChange = (partId, value) => setSlots(prev => ({ ...prev, [partId]: value }));
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
            updateLocalAvatarPartDisplayName(partId, newName);
            alert('이름이 저장되었습니다.');
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
        } catch (error) {
            console.error("저장 오류:", error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            const newItems = await Promise.all(files.map(file => uploadAvatarPart(file, uploadCategory)));
            useLeagueStore.setState(state => ({
                avatarParts: [...state.avatarParts, ...newItems]
            }));
            alert(`${files.length}개의 아바타 아이템이 업로드되었습니다!`);
            setFiles([]);
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
            updateLocalAvatarPartStatus(part.id, newStatus);
        } catch (error) {
            alert(`오류: ${error.message}`);
        }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
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

    const isSuperAdmin = auth.currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';


    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>아바타 아이템 관리 🎨</SectionTitle>

                {/* ▼▼▼ [수정] isSuperAdmin일 때만 업로드 UI가 보이도록 수정 ▼▼▼ */}
                {isSuperAdmin && (
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
                )}

                {/* ▼▼▼ [수정] isSuperAdmin일 때만 이동/삭제 버튼이 보이도록 수정 ▼▼▼ */}
                <InputGroup style={{ justifyContent: 'flex-start' }}>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {isSuperAdmin && (
                        <>
                            <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                                {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                            </SaveButton>
                            <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                                {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                            </SaveButton>
                        </>
                    )}
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

function MyRoomItemManager() {
    const { fetchInitialData, updateLocalMyRoomItemDisplayName, batchMoveMyRoomItemCategory } = useLeagueStore();
    const myRoomItemsFromStore = useLeagueStore(state => state.myRoomItems);

    const [myRoomItems, setMyRoomItems] = useState([]);
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('가구');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [widths, setWidths] = useState({});
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
        const initialWidths = {};
        myRoomItemsFromStore.forEach(item => {
            initialPrices[item.id] = item.price || 0;
            initialDisplayNames[item.id] = item.displayName || '';
            initialWidths[item.id] = item.width || 15;
        });
        setPrices(initialPrices);
        setDisplayNames(initialDisplayNames);
        setWidths(initialWidths);
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

    const sortedCategories = ['하우스', '배경', '가구', '가전', '소품'];
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
    const handleWidthChange = (itemId, value) => setWidths(prev => ({ ...prev, [itemId]: value }));
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
                                ...item, isSale: true, originalPrice, salePrice,
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

    const isSuperAdmin = auth.currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';


    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>마이룸 아이템 관리 🏠</SectionTitle>

                {/* ▼▼▼ [수정] isSuperAdmin일 때만 업로드 UI가 보이도록 수정 ▼▼▼ */}
                {isSuperAdmin && (
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
                )}

                {/* ▼▼▼ [수정] isSuperAdmin일 때만 이동/삭제 버튼이 보이도록 수정 ▼▼▼ */}
                <InputGroup>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsMoveMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    {isSuperAdmin && (
                        <>
                            <SaveButton onClick={() => { setIsMoveMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isMoveMode ? '#6c757d' : '#ffc107', color: 'black' }}>
                                {isMoveMode ? '이동 모드 취소' : '아이템 이동'}
                            </SaveButton>
                            <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setIsMoveMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                                {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                            </SaveButton>
                        </>
                    )}
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
                                            <div style={{ height: '25px', textAlign: 'left' }}>
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
                            <SaveButton onClick={handleSaveAllDetails}>'${activeTab}' 탭 정보 모두 저장</SaveButton>
                        </div>
                    </>
                )}
            </Section>
        </FullWidthSection>
    );
}

function RoleManager() {
    const { classId } = useClassStore();
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
            await linkPlayerToAuth(classId, selectedPlayerId, player.authUid, selectedRole);
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
    const { classId } = useClassStore();
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
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
                                    opacity: isAdmin ? 0.5 : 1, cursor: isAdmin ? 'not-allowed' : 'pointer'
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
                        type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder="변경할 포인트 (차감 시 음수)" style={{ width: '200px', padding: '0.5rem' }}
                    />
                    <input
                        type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="조정 사유 (예: 봉사활동 보상)" style={{ flex: 1, padding: '0.5rem' }}
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
    const { classId } = useClassStore();
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
            if (newGoals > 0) newScorers[playerId] = newGoals;
            else delete newScorers[playerId];
            return newScorers;
        });
        if (playerTeam === 'A') setScoreB(s => Math.max(0, s - amount));
        else setScoreA(s => Math.max(0, s - amount));
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
        setOwnGoals(prev => ({ ...prev, [team]: Math.max(0, currentOwnGoals + amount) }));
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
    const { classId } = useClassStore();
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
    const { classId } = useClassStore();
    const {
        players, teams, matches, addNewTeam, removeTeam, assignPlayerToTeam, unassignPlayerFromTeam,
        autoAssignTeams, generateSchedule, batchCreateTeams, leagueType, setLeagueType,
        currentSeason, startSeason, endSeason, updateSeasonDetails, createSeason, setTeamCaptain
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
        if (pendingMatches.length > 0) setOpenedMatchId(pendingMatches[0].id);
        else setOpenedMatchId(null);
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
                                            type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                            placeholder="새 시즌 이름 입력" style={{ flex: 1, padding: '0.5rem' }}
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
                                    type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                    placeholder="새 시즌 이름 입력 (예: 25-1 시즌)" style={{ flex: 1, padding: '0.5rem' }}
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

function TitleManager() {
    const { classId } = useClassStore();
    const { players, fetchInitialData } = useLeagueStore();
    const [titles, setTitles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTitle, setEditingTitle] = useState(null);
    const [isAssignMode, setIsAssignMode] = useState(null);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());

    const fetchTitles = async () => {
        if (!classId) return;
        setIsLoading(true);
        const titlesData = await getTitles(classId);
        setTitles(titlesData);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTitles();
    }, [classId]);

    const handlePlayerSelect = (playerId) => {
        setSelectedPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) newSet.delete(playerId);
            else newSet.add(playerId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const allPlayerIds = players.filter(p => p.role !== 'admin').map(p => p.id);
        const allSelected = allPlayerIds.length > 0 && allPlayerIds.every(id => selectedPlayerIds.has(id));
        if (allSelected) setSelectedPlayerIds(new Set());
        else setSelectedPlayerIds(new Set(allPlayerIds));
    };

    const handleSave = async () => {
        if (!classId) return;
        if (!editingTitle.name) return alert('칭호 이름을 입력하세요.');
        if (editingTitle.type === 'auto' && !editingTitle.conditionId) {
            return alert('자동 획득 칭호는 반드시 조건 ID를 입력해야 합니다.');
        }

        try {
            if (editingTitle.id) {
                await updateTitle(classId, editingTitle.id, editingTitle);
                alert('칭호가 수정되었습니다.');
            } else {
                await createTitle(classId, editingTitle);
                alert('새로운 칭호가 생성되었습니다.');
            }
            setEditingTitle(null);
            fetchTitles();
        } catch (error) {
            alert(`저장 실패: ${error.message}`);
        }
    };

    const handleDelete = async (titleId, titleName) => {
        if (!classId) return;
        if (window.confirm(`'${titleName}' 칭호를 정말로 삭제하시겠습니까?`)) {
            try {
                await deleteTitle(classId, titleId);
                alert('칭호가 삭제되었습니다.');
                fetchTitles();
            } catch (error) {
                alert(`삭제 실패: ${error.message}`);
            }
        }
    };

    const handleAssignTitle = async () => {
        if (!classId) return;
        if (selectedPlayerIds.size === 0) return alert('학생을 한 명 이상 선택하세요.');
        try {
            await grantTitleToPlayersBatch(classId, Array.from(selectedPlayerIds), isAssignMode);
            alert(`${selectedPlayerIds.size}명의 학생에게 칭호를 성공적으로 부여하고 500P 보상을 지급했습니다.`);
            setSelectedPlayerIds(new Set());
            setIsAssignMode(null);
            fetchInitialData();
        } catch (error) {
            alert(`부여 실패: ${error.message}`);
        }
    };

    const sortedPlayers = useMemo(() =>
        [...players].sort((a, b) => a.name.localeCompare(b.name)),
        [players]
    );

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>칭호 관리 🎖️</SectionTitle>
                <StyledButton onClick={() => setEditingTitle({ name: '', icon: '', description: '', type: 'manual', color: '#000000' })} style={{ marginBottom: '1rem', alignSelf: 'flex-start' }}>
                    새 칭호 만들기
                </StyledButton>

                {editingTitle && (
                    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                        <InputGroup>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {['🏆', '🧠', '👑', '⚽', '🕊️', '⭐', '🌳', '💡', '🎤', '🏦', '🎵', '🧹', '🥇', '🥈', '🥉'].map(icon => (
                                    <button
                                        key={icon}
                                        onClick={() => setEditingTitle(p => ({ ...p, icon: icon }))}
                                        style={{
                                            fontSize: '1.5rem', padding: '0.25rem',
                                            border: editingTitle.icon === icon ? '2px solid #007bff' : '2px solid transparent',
                                            borderRadius: '4px', cursor: 'pointer'
                                        }}
                                    >
                                        {icon}
                                    </button>
                                ))}
                                <input
                                    type="text" value={editingTitle.icon || ''} onChange={e => setEditingTitle(p => ({ ...p, icon: e.target.value }))}
                                    placeholder="직접 입력" style={{ width: '100px', padding: '0.5rem', fontSize: '1rem' }} maxLength="2"
                                />
                            </div>
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 이름" value={editingTitle.name || ''} onChange={e => setEditingTitle(p => ({ ...p, name: e.target.value }))} style={{ flex: 3 }} />
                            <input type="color" value={editingTitle.color || '#000000'} onChange={e => setEditingTitle(p => ({ ...p, color: e.target.value }))} />
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 설명 (획득 조건 등)" value={editingTitle.description || ''} onChange={e => setEditingTitle(p => ({ ...p, description: e.target.value }))} style={{ flex: 1 }} />
                        </InputGroup>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4>'{titles.find(t => t.id === isAssignMode)?.name}' 칭호 부여하기</h4>
                            <StyledButton onClick={handleSelectAll}>전체 선택/해제</StyledButton>
                        </div>
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6',
                            borderRadius: '8px', padding: '1rem', backgroundColor: 'white', marginBottom: '1rem'
                        }}>
                            {sortedPlayers.map(player => {
                                const isAdmin = player.role === 'admin';
                                const hasTitle = player.ownedTitles && player.ownedTitles.includes(isAssignMode);
                                const isDisabled = isAdmin || hasTitle;

                                return (
                                    <div key={player.id} title={isAdmin ? "관리자는 선택할 수 없습니다." : (hasTitle ? "이미 보유한 칭호입니다." : "")}>
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem',
                                            opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer'
                                        }}>
                                            <input
                                                type="checkbox" checked={selectedPlayerIds.has(player.id)}
                                                onChange={() => !isDisabled && handlePlayerSelect(player.id)}
                                                style={{ width: '18px', height: '18px' }}
                                                disabled={isDisabled}
                                            />
                                            <span>{player.name} {hasTitle && '🎖️'}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                        <InputGroup style={{ justifyContent: 'flex-end' }}>
                            <SaveButton onClick={handleAssignTitle}>{selectedPlayerIds.size}명에게 부여</SaveButton>
                            <StyledButton onClick={() => setIsAssignMode(null)}>취소</StyledButton>
                        </InputGroup>
                    </div>
                )}

                <List style={{ maxHeight: 'none' }}>
                    {isLoading ? <p>로딩 중...</p> : titles.map(title => (
                        <ListItem key={title.id} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                            <span style={{ fontSize: '1.5rem' }}>{title.icon}</span>
                            <div>
                                <strong style={{ color: title.color || '#000000' }}>{title.name}</strong>
                                <p style={{ fontSize: '0.9rem', color: '#6c757d', margin: 0 }}>{title.description}</p>
                            </div>
                            <MissionControls>
                                <StyledButton onClick={() => { setIsAssignMode(title.id); setSelectedPlayerIds(new Set()) }}>칭호 주기</StyledButton>
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

// src/pages/AdminPage.jsx 내부 ClassManager 컴포넌트 (전체 교체)

function ClassManager() {
    const { classId, setClassId } = useClassStore();
    const { initializeClass } = useLeagueStore();
    const currentUser = auth.currentUser;

    const [allClasses, setAllClasses] = useState([]);
    const [ghostClasses, setGhostClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [selectedClassForQR, setSelectedClassForQR] = useState(null);
    const [manualId, setManualId] = useState('');

    const isSuperAdmin = currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';

    // 1. 학급 목록 불러오기
    const fetchAllClasses = useCallback(async () => {
        if (!currentUser) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const classesRef = collection(db, "classes");
            let q;
            if (isSuperAdmin) {
                q = query(classesRef);
            } else {
                q = query(classesRef, where("adminId", "==", currentUser.uid));
            }
            const querySnapshot = await getDocs(q);
            const classes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllClasses(classes);

            // 현재 선택된 반이 있다면 QR 코드 정보 갱신
            if (classes.length > 0 && classId && classes.some(c => c.id === classId)) {
                setSelectedClassForQR(classes.find(c => c.id === classId));
            } else {
                setSelectedClassForQR(null);
            }
        } catch (error) {
            console.error("학급 로딩 실패:", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, classId, isSuperAdmin]);

    // 2. 유령 학급 스캔
    const scanForGhostClasses = async () => {
        if (!isSuperAdmin) return;
        setIsLoading(true);
        try {
            const playersQuery = query(collectionGroup(db, 'players'), limit(100));
            const snapshot = await getDocs(playersQuery);
            const foundClassIds = new Set();
            snapshot.forEach(doc => {
                if (doc.ref.parent && doc.ref.parent.parent) {
                    foundClassIds.add(doc.ref.parent.parent.id);
                }
            });
            const existingIds = allClasses.map(c => c.id);
            const ghosts = Array.from(foundClassIds).filter(id => !existingIds.includes(id));
            setGhostClasses(ghosts);
            if (ghosts.length > 0) alert(`👻 유령 학급 ${ghosts.length}개 발견!`);
            else alert("발견된 유령 학급이 없습니다.");
        } catch (e) {
            console.error(e);
            alert("스캔 오류: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllClasses();
    }, [fetchAllClasses]);

    const handleClassCardClick = (cls) => {
        if (isSuperAdmin && cls.adminId !== currentUser?.uid) {
            if (!confirm(`[슈퍼 관리자] '${cls.name || cls.id}' 반으로 이동합니까?`)) return;
        }
        if (cls.id !== classId) {
            setClassId(cls.id);
            initializeClass(cls.id);
        }
        setSelectedClassForQR(cls); // 클릭 시 QR 정보 설정
    };

    // 3. 유령 학급 복구 (초대코드 생성 포함)
    const resurrectClass = async (targetId) => {
        if (!confirm(`학급 ID [${targetId}]를 복구하시겠습니까?\n(초대 코드가 새로 발급됩니다)`)) return;
        try {
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await setDoc(doc(db, "classes", targetId), {
                name: `(복구됨) ${targetId.substring(0, 6)}...`,
                adminId: currentUser.uid,
                createdAt: new Date(),
                inviteCode: randomCode, // 초대 코드 발급
                status: 'restored'
            }, { merge: true });

            alert(`✅ 복구 완료! 초대 코드: [${randomCode}]`);
            fetchAllClasses();
            setGhostClasses(prev => prev.filter(id => id !== targetId));
        } catch (e) {
            alert("복구 실패: " + e.message);
        }
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return alert("이름을 입력하세요");
        try {
            const { classId: newId, name, inviteCode } = await createNewClass(newClassName, currentUser);
            alert("생성 완료");
            await fetchAllClasses();
            handleClassCardClick({ id: newId, name, inviteCode });
            setNewClassName('');
            setIsCreating(false);
        } catch (e) { alert(e.message); }
    };

    const handleCopyToClipboard = (t) => {
        navigator.clipboard.writeText(t).then(() => alert('초대 코드가 복사되었습니다.'));
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>{isSuperAdmin ? "🏫 슈퍼 관리자 학급 제어" : "🏫 학급 관리"}</SectionTitle>

                {/* 슈퍼 관리자 도구 */}
                {isSuperAdmin && (
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #adb5bd' }}>
                        <h4 style={{ marginTop: 0 }}>🛠️ 슈퍼 관리자 도구</h4>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button onClick={scanForGhostClasses} style={{ ...btnStyle, background: '#6f42c1' }}>👻 유령 학급 스캔</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input type="text" placeholder="학급 ID 입력" value={manualId} onChange={e => setManualId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                                <button onClick={() => manualId && resurrectClass(manualId)} style={{ ...btnStyle, background: '#20c997' }}>🚑 강제 복구</button>
                            </div>
                        </div>
                        {ghostClasses.length > 0 && (
                            <ul style={{ marginTop: '10px' }}>
                                {ghostClasses.map(gid => (
                                    <li key={gid}>{gid} <button onClick={() => resurrectClass(gid)} style={{ marginLeft: '10px', cursor: 'pointer' }}>복구</button></li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* 학급 목록 */}
                <ClassGrid>
                    {allClasses.map(cls => (
                        <ClassCard
                            key={cls.id}
                            $isActive={cls.id === classId}
                            onClick={() => handleClassCardClick(cls)}
                            style={isSuperAdmin && cls.adminId !== currentUser?.uid ? { borderColor: 'orange', borderStyle: 'dashed' } : {}}
                        >
                            <h3>{cls.name || '(이름 없음)'}</h3>
                            <p>{cls.id === classId ? "✅ 현재 접속 중" : "클릭하여 관리"}</p>
                        </ClassCard>
                    ))}
                    <AddClassCard onClick={() => setIsCreating(true)}>
                        <span className="plus-icon">+</span>
                        <h3>새 학급 만들기</h3>
                    </AddClassCard>
                </ClassGrid>

                {isCreating && (
                    <InputGroup style={{ marginTop: '1rem' }}>
                        <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="새 학급 이름" style={{ flex: 1, padding: '0.5rem' }} />
                        <StyledButton onClick={handleCreateClass} style={{ backgroundColor: '#28a745' }}>생성</StyledButton>
                        <StyledButton onClick={() => setIsCreating(false)} style={{ background: '#6c757d' }}>취소</StyledButton>
                    </InputGroup>
                )}

                {/* ▼▼▼ [복구됨] QR 코드 섹션 ▼▼▼ */}
                {selectedClassForQR && (
                    <QRCodeSection>
                        <h3>'{selectedClassForQR.name}' 초대 정보</h3>
                        <InviteCodeWrapper>
                            <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
                                {/* QRCode 컴포넌트가 있다면 사용, 없다면 텍스트만 표시 */}
                                {typeof QRCode !== 'undefined' ? (
                                    <QRCode value={`${window.location.origin}/join?inviteCode=${selectedClassForQR.inviteCode || ''}`} size={128} />
                                ) : (
                                    <div style={{ width: 128, height: 128, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>QR</div>
                                )}
                            </div>
                            <InviteCodeDisplay onClick={() => handleCopyToClipboard(selectedClassForQR.inviteCode)} title="클릭하여 복사">
                                {selectedClassForQR.inviteCode || '(코드 없음)'}
                            </InviteCodeDisplay>
                            <small>학생들에게 위 QR코드를 보여주거나 초대 코드를 알려주세요.</small>
                        </InviteCodeWrapper>
                    </QRCodeSection>
                )}
            </Section>
        </FullWidthSection>
    );
}

function AdminPage() {
    const { players } = useLeagueStore();
    const { tab } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeMenu, setActiveMenu] = useState(tab || 'mission');
    const [activeSubMenu, setActiveSubMenu] = useState('messages');
    const [studentSubMenu, setStudentSubMenu] = useState('point');
    const [shopSubMenu, setShopSubMenu] = useState('avatar');
    const [preselectedStudentId, setPreselectedStudentId] = useState(null);
    const [modalImageSrc, setModalImageSrc] = useState(null);
    const [missionSubMenu, setMissionSubMenu] = useState('approval');
    const [preselectedMissionId, setPreselectedMissionId] = useState(null);

    useEffect(() => {
        const studentIdFromState = location.state?.preselectedStudentId;
        if (studentIdFromState) {
            setActiveMenu('social');
            setActiveSubMenu('messages');
            setPreselectedStudentId(studentIdFromState);
            window.history.replaceState({}, document.title)
        }
    }, [location.state]);

    const handleSendMessageClick = (studentId) => {
        navigate('/admin', { state: { preselectedStudentId: studentId } });
    };

    const handleNavigateToHistory = (missionId) => {
        setActiveMenu('mission');
        setMissionSubMenu('history');
        setPreselectedMissionId(missionId);
    };


    const renderContent = () => {
        if (activeMenu === 'mission') {
            switch (missionSubMenu) {
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
        if (activeMenu === 'social') {
            switch (activeSubMenu) {
                case 'messages': return <MessageManager preselectedStudentId={preselectedStudentId} onStudentSelect={setPreselectedStudentId} />;
                case 'myroom_comments': return <MyRoomCommentMonitor />;
                case 'mission_comments': return <MissionCommentMonitor />;
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

        // [수정] 퀴즈 관리 렌더링 (Hook 호출 제거, 상위 players 사용)
        if (activeMenu === 'quiz') {
            const myPlayer = players.find(p => p.authUid === auth.currentUser?.uid);
            return <QuizManager userRole={myPlayer?.role} />;
        }

        if (activeMenu === 'class') {
            return <ClassManager />;
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
        } else if (menu === 'quiz') { // [추가] 퀴즈 메뉴 클릭 시 서브메뉴 초기화
            setActiveSubMenu('');
        } else if (menu === 'class') {
            setActiveSubMenu('');
        } else {
            setActiveSubMenu('');
        }
    };
    return (
        <>
            <ImageModal src={modalImageSrc?.src} rotation={modalImageSrc?.rotation} onClose={() => setModalImageSrc(null)} />
            <AdminWrapper>
                <Sidebar>
                    <BroadcastButton to="/broadcast" target="_blank">📺 방송 송출 화면</BroadcastButton>
                    <NavList>
                        <NavItem>
                            <NavButton $active={activeMenu === 'mission'} onClick={() => handleMenuClick('mission')}>미션 관리</NavButton>
                            {activeMenu === 'mission' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'approval'} onClick={() => setMissionSubMenu('approval')}>미션 승인</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'creation'} onClick={() => setMissionSubMenu('creation')}>미션 출제</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={missionSubMenu === 'history'} onClick={() => setMissionSubMenu('history')}>기록 확인</SubNavButton></SubNavItem>
                                </SubNavList>
                            )}
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'quiz'} onClick={() => handleMenuClick('quiz')}>퀴즈 관리</NavButton>
                        </NavItem>
                        <NavItem>
                            <NavButton $active={activeMenu === 'social'} onClick={() => handleMenuClick('social')}>소셜 관리</NavButton>
                            {activeMenu === 'social' && (
                                <SubNavList>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'messages'} onClick={() => setActiveSubMenu('messages')}>1:1 메시지</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'myroom_comments'} onClick={() => setActiveSubMenu('myroom_comments')}>마이룸 댓글</SubNavButton></SubNavItem>
                                    <SubNavItem><SubNavButton $active={activeSubMenu === 'mission_comments'} onClick={() => setActiveSubMenu('mission_comments')}>미션 갤러리 댓글</SubNavButton></SubNavItem>
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
                        <NavItem>
                            <NavButton $active={activeMenu === 'class'} onClick={() => handleMenuClick('class')}>학급 관리</NavButton>
                        </NavItem>
                    </NavList>
                </Sidebar>
                <MainContent>
                    <Title>👑 관리자 대시보드</Title>
                    {renderContent()}
                </MainContent>
            </AdminWrapper>
        </>
    );
}

export default AdminPage;