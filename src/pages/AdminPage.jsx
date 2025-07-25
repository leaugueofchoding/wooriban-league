import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import PlayerProfile from '../components/PlayerProfile.jsx';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
    uploadAvatarPart,
    batchUpdateAvatarPartPrices,
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
    rejectMissionSubmission, // 거절 함수 import
    linkPlayerToAuth,
    auth,
    db, // onSnapshot을 위해 db import
    completeClassGoal
} from '../api/firebase.js';
import { collection, query, where, onSnapshot } from "firebase/firestore";


// --- Styled Components (디자인 부분) ---
const AdminWrapper = styled.div`
  display: flex;
  gap: 2rem;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  font-family: sans-serif;
  align-items: flex-start;
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
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  margin-bottom: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ScoreInput = styled.input`
  width: 60px;
  text-align: center;
  margin: 0 0.5rem;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
`;

const TeamName = styled.span`
  font-weight: bold;
  min-width: 100px;
  text-align: center;
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
        case 'hair': case 'eyes': case 'nose': case 'mouth': return 'center 5%';
        case 'top':
        default: return 'center 55%';
    }
};

const ItemImage = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  background-image: url(${props => props.src});
  background-size: 200%;
  background-repeat: no-repeat;
  background-color: #e9ecef;
  transition: background-size 0.2s ease-in-out;
  background-position: ${props => getBackgroundPosition(props.$category)};
  &:hover {
    background-size: 220%;
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

// --- Components ---

function PendingMissionWidget() {
    const { players, missions, fetchInitialData } = useLeagueStore();
    const [pendingSubmissions, setPendingSubmissions] = useState([]);
    const [processingIds, setProcessingIds] = useState(new Set());
    const currentUser = auth.currentUser;

    useEffect(() => {
        const submissionsRef = collection(db, "missionSubmissions");
        const q = query(submissionsRef, where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const submissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 삭제된 미션의 제출 기록은 필터링
            const validSubmissions = submissions.filter(sub =>
                missions.some(m => m.id === sub.missionId)
            );
            setPendingSubmissions(validSubmissions);
        });

        return () => unsubscribe();
    }, [missions]);

    const handleAction = async (action, submission) => {
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
                await approveMissionsInBatch(mission.id, [student.id], currentUser.uid, mission.reward);
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
            }
            // onSnapshot이 자동으로 목록을 갱신하므로 fetchInitialData 호출 불필요
        } catch (error) {
            console.error(`미션 ${action} 오류:`, error);
            alert(`${action === 'approve' ? '승인' : '거절'} 처리 중 오류가 발생했습니다.`);
        } finally {
            // onSnapshot으로 인해 목록이 갱신되므로, processingIds에서 수동으로 제거할 필요가 없음
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

                        if (!mission) return null; // 삭제된 미션은 렌더링하지 않음

                        return (
                            <ListItem key={sub.id}>
                                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {student?.name} - [{mission?.title}]
                                </span>
                                <span style={{ fontWeight: 'bold', color: '#007bff' }}>{mission?.reward}P</span>
                                <StyledButton onClick={() => handleAction('approve', sub)} style={{ backgroundColor: '#28a745' }} disabled={isProcessing}>
                                    {isProcessing ? '처리중...' : '승인'}
                                </StyledButton>
                                <StyledButton onClick={() => handleAction('reject', sub)} style={{ backgroundColor: '#dc3545' }} disabled={isProcessing}>
                                    거절
                                </StyledButton>
                            </ListItem>
                        )
                    })}
                </List>
            )}
        </Section>
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

    // [추가] 목표 완료 처리 핸들러
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
                                        <span style={{ marginLeft: '1rem', color: '#6c757d' }}>
                                            ({goal.currentPoints.toLocaleString()} / {goal.targetPoints.toLocaleString()} P)
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {/* [추가] 완료 처리 버튼 */}
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
        fetchInitialData
    } = useLeagueStore();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [reward, setReward] = useState(50);
    const [showArchived, setShowArchived] = useState(false);

    const handleCreateMission = async () => {
        if (!title.trim() || !reward) {
            return alert('미션 이름과 보상 포인트를 모두 입력해주세요.');
        }
        try {
            await createMission({ title, reward: Number(reward) });
            alert('새로운 미션이 등록되었습니다!');
            setTitle('');
            setReward(50);
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
            <InputGroup>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="미션 이름 (예: 수학 익힘책 5쪽)"
                    style={{ flex: 1, minWidth: '200px', padding: '0.5rem' }}
                />
                <ScoreInput
                    type="number"
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    style={{ width: '80px' }}
                />
                <SaveButton onClick={handleCreateMission}>미션 출제</SaveButton>
            </InputGroup>

            <div style={{ marginTop: '2rem' }}>
                <ToggleButton onClick={() => setShowArchived(prev => !prev)}>
                    {showArchived ? '활성 미션 보기' : `숨긴 미션 보기 (${archivedMissions.length}개)`}
                </ToggleButton>

                <List>
                    {missionsToDisplay.length > 0 ? (
                        missionsToDisplay.map(mission => (
                            <ListItem key={mission.id} style={{ gridTemplateColumns: '1fr auto' }}>
                                <div>
                                    <strong>{mission.title}</strong>
                                    <span style={{ marginLeft: '1rem', color: '#6c757d' }}>
                                        (보상: {mission.reward}P)
                                    </span>
                                </div>
                                <MissionControls>
                                    <StyledButton
                                        onClick={() => navigate(`/recorder/${mission.id}`)}
                                        style={{ backgroundColor: '#17a2b8' }}
                                    >
                                        상태 확인
                                    </StyledButton>
                                    {showArchived ? (
                                        <StyledButton onClick={() => unarchiveMission(mission.id)} style={{ backgroundColor: '#28a745' }}>
                                            활성화
                                        </StyledButton>
                                    ) : (
                                        <StyledButton onClick={() => archiveMission(mission.id)} style={{ backgroundColor: '#ffc107', color: 'black' }}>
                                            숨김
                                        </StyledButton>
                                    )}
                                    <StyledButton onClick={() => removeMission(mission.id)} style={{ backgroundColor: '#dc3545' }}>
                                        삭제
                                    </StyledButton>
                                </MissionControls>
                            </ListItem>
                        ))
                    ) : (
                        <p>{showArchived ? '숨겨진 미션이 없습니다.' : '현재 출제된 미션이 없습니다.'}</p>
                    )}
                </List>
            </div>
        </Section>
    );
}

function AvatarPartManager() {
    const { avatarParts, fetchInitialData, updateLocalAvatarPartStatus, updateLocalAvatarPartDisplayName } = useLeagueStore();
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('hair');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});
    const [displayNames, setDisplayNames] = useState({});
    const [isSaleMode, setIsSaleMode] = useState(false);
    const [isSaleDayMode, setIsSaleDayMode] = useState(false);
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [salePercent, setSalePercent] = useState(0);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [selectedDays, setSelectedDays] = useState(new Set());
    const [isDeleteMode, setIsDeleteMode] = useState(false);


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
        avatarParts.forEach(part => {
            initialPrices[part.id] = part.price || 0;
            initialDisplayNames[part.id] = part.displayName || '';
        });
        setPrices(initialPrices);
        setDisplayNames(initialDisplayNames);
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
        } catch (error) {
            alert(`이름 저장 실패: ${error.message}`);
            fetchInitialData();
        }
    };

    const handleSaveAllPrices = async () => {
        if (!window.confirm("현재 탭의 모든 아이템 가격을 저장하시겠습니까?")) return;
        try {
            const updates = Object.entries(prices)
                .filter(([id]) => partCategories[activeTab]?.some(part => part.id === id))
                .map(([id, price]) => ({ id, price: Number(price) }));
            await batchUpdateAvatarPartPrices(updates);
            alert('가격이 성공적으로 저장되었습니다.');
            await fetchInitialData();
        } catch (error) { alert('가격 저장 중 오류가 발생했습니다.'); }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('파일을 선택해주세요.');
        setIsUploading(true);
        try {
            await Promise.all(files.map(file => uploadAvatarPart(file, uploadCategory)));
            alert(`${files.length}개의 아이템이 업로드되었습니다!`);
            setFiles([]);
            document.getElementById('avatar-file-input').value = "";
            await fetchInitialData();
        } catch (error) {
            alert('아이템 업로드 중 오류가 발생했습니다.');
        } finally { setIsUploading(false); }
    };

    const handleToggleStatus = async (part) => {
        const newStatus = part.status === 'hidden' ? 'visible' : 'hidden';
        try {
            await updateAvatarPartStatus(part.id, newStatus);
            updateLocalAvatarPartStatus(part.id, newStatus);
        } catch (error) {
            alert(`오류: ${error.message}`);
            fetchInitialData();
        }
    };

    const handleApplySale = async () => {
        if (checkedItems.size === 0) return alert('세일을 적용할 아이템을 하나 이상 선택해주세요.');
        if (salePercent <= 0 || salePercent >= 100) return alert('할인율은 1% 이상, 100% 미만이어야 합니다.');
        if (!startDate || !endDate || endDate < startDate) return alert('올바른 할인 기간을 설정해주세요.');
        if (window.confirm(`선택한 ${checkedItems.size}개 아이템에 ${salePercent}% 할인을 적용하시겠습니까?`)) {
            try {
                await batchUpdateSaleInfo(Array.from(checkedItems), salePercent, startDate, endDate);
                await fetchInitialData();
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
                await fetchInitialData();
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
                await fetchInitialData();
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
                await fetchInitialData();
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

                {/* 파일 업로드 UI */}
                <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem', justifyContent: 'flex-start' }}>
                    <input type="file" id="avatar-file-input" onChange={handleFileChange} accept="image/png" multiple />
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                        <option value="hair">머리</option><option value="top">상의</option><option value="bottom">하의</option><option value="shoes">신발</option>
                        <option value="face">얼굴</option><option value="eyes">눈</option><option value="nose">코</option><option value="mouth">입</option>
                        <option value="accessory">액세서리</option>
                    </select>
                    <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
                        {isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}
                    </SaveButton>
                </InputGroup>

                {/* 일괄 작업 버튼 UI */}
                <InputGroup style={{ justifyContent: 'flex-start' }}>
                    <SaveButton onClick={() => { setIsSaleMode(p => !p); setIsSaleDayMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleMode ? '#6c757d' : '#007bff' }}>
                        {isSaleMode ? '세일 모드 취소' : '일괄 세일 적용'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsSaleDayMode(p => !p); setIsSaleMode(false); setIsDeleteMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isSaleDayMode ? '#6c757d' : '#17a2b8' }}>
                        {isSaleDayMode ? '요일 설정 취소' : '요일별 판매 설정'}
                    </SaveButton>
                    <SaveButton onClick={() => { setIsDeleteMode(p => !p); setIsSaleMode(false); setIsSaleDayMode(false); setCheckedItems(new Set()); }} style={{ backgroundColor: isDeleteMode ? '#6c757d' : '#dc3545' }}>
                        {isDeleteMode ? '삭제 모드 취소' : '아이템 삭제'}
                    </SaveButton>
                </InputGroup>

                {/* 세일 모드 UI */}
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
                                {(isSaleMode || isSaleDayMode || isDeleteMode) && (
                                    <div style={{ height: '25px' }}>
                                        <input type="checkbox" checked={checkedItems.has(part.id)} onChange={() => handleCheckboxChange(part.id)} style={{ width: '20px', height: '20px' }} />
                                    </div>)}
                                {!(isSaleMode || isSaleDayMode || isDeleteMode) && <div style={{ height: '25px' }}></div>}

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
                    <SaveButton onClick={handleSaveAllPrices}>{activeTab} 탭 전체 가격 저장</SaveButton>
                </div>
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

    // [추가] 전체 선택/해제 핸들러
    const handleSelectAll = () => {
        const nonAdminPlayerIds = players.filter(p => p.role !== 'admin').map(p => p.id);

        // 모든 학생이 이미 선택되었는지 확인
        const allSelected = nonAdminPlayerIds.length > 0 && nonAdminPlayerIds.every(id => selectedPlayerIds.has(id));

        if (allSelected) {
            setSelectedPlayerIds(new Set()); // 전체 해제
        } else {
            setSelectedPlayerIds(new Set(nonAdminPlayerIds)); // 전체 선택 (관리자 제외)
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
                    {/* [추가] 전체 선택 버튼 */}
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
                        // 관리자는 목록에 표시되지만 비활성화 처리
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

function MatchRow({ match }) {
    const { teams, saveScores, currentSeason } = useLeagueStore();
    const [scoreA, setScoreA] = useState(match.teamA_score ?? '');
    const [scoreB, setScoreB] = useState(match.teamB_score ?? '');
    const isSeasonActive = currentSeason?.status === 'active';
    const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.teamName || 'N/A';
    const handleSave = () => {
        const scores = { a: Number(scoreA), b: Number(scoreB) };
        if (isNaN(scores.a) || isNaN(scores.b)) {
            return alert('점수를 숫자로 입력해주세요.');
        }
        saveScores(match.id, scores);
        alert('저장되었습니다!');
    };
    return (
        <MatchItem>
            <TeamName>{getTeamName(match.teamA_id)}</TeamName>
            <ScoreInput type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} disabled={!isSeasonActive} />
            <span>vs</span>
            <ScoreInput type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} disabled={!isSeasonActive} />
            <TeamName>{getTeamName(match.teamB_id)}</TeamName>
            <SaveButton onClick={handleSave} disabled={!isSeasonActive}>저장</SaveButton>
        </MatchItem>
    );
}

function PlayerManager() {
    const { players, removePlayer, currentSeason } = useLeagueStore();
    const isNotPreparing = currentSeason?.status !== 'preparing';

    const sortedPlayers = useMemo(() =>
        [...players].sort((a, b) => a.name.localeCompare(b.name)),
        [players]
    );

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>선수 관리</SectionTitle>
                <List>
                    {sortedPlayers.map(player => (
                        <ListItem key={player.id} style={{ gridTemplateColumns: '1fr auto' }}>
                            <PlayerProfile player={player} />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Link to={`/profile/${player.id}`}>
                                    <StyledButton style={{ backgroundColor: '#17a2b8' }}>프로필 보기</StyledButton>
                                </Link>
                                <StyledButton onClick={() => removePlayer(player.id)} disabled={isNotPreparing}>삭제</StyledButton>
                            </div>
                        </ListItem>
                    ))}
                </List>
            </Section>
        </FullWidthSection>
    );
}


function LeagueManager() {
    const {
        players, teams, matches, removePlayer,
        addNewTeam, removeTeam, assignPlayerToTeam, unassignPlayerFromTeam,
        autoAssignTeams, generateSchedule, batchCreateTeams,
        leagueType, setLeagueType,
        currentSeason, startSeason, endSeason, updateSeason,
    } = useLeagueStore();
    const isNotPreparing = currentSeason?.status !== 'preparing';
    const [newTeamName, setNewTeamName] = useState('');
    const [maleTeamCount, setMaleTeamCount] = useState(2);
    const [femaleTeamCount, setFemaleTeamCount] = useState(2);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedPlayer, setSelectedPlayer] = useState({});
    const [prize, setPrize] = useState(0);

    useEffect(() => {
        if (currentSeason?.winningPrize) {
            setPrize(currentSeason.winningPrize);
        }
    }, [currentSeason]);

    const handleSavePrize = async () => {
        if (isNaN(prize) || prize < 0) {
            return alert('보상 포인트는 숫자로 입력해주세요.');
        }
        try {
            await updateSeason(currentSeason.id, { winningPrize: Number(prize) });
            alert('우승 보상이 저장되었습니다!');
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const unassignedPlayers = useMemo(() => {
        const assignedPlayerIds = teams.flatMap(team => team.members);
        return players.filter(player => !assignedPlayerIds.includes(player.id));
    }, [players, teams]);

    const filteredMatches = useMemo(() => {
        return matches.filter(m => (activeTab === 'pending' ? m.status !== '완료' : m.status === 'completed'));
    }, [matches, activeTab]);

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
                            <InputGroup style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                <label htmlFor="prize">우승팀 보상 포인트:</label>
                                <ScoreInput
                                    id="prize"
                                    type="number"
                                    value={prize}
                                    onChange={(e) => setPrize(e.target.value)}
                                    style={{ width: '100px' }}
                                />
                                <SaveButton onClick={handleSavePrize}>보상 저장</SaveButton>
                            </InputGroup>
                        </>
                    ) : <p>시즌 정보를 불러오는 중입니다...</p>}
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
                                        {team.members?.length > 0 ? team.members.map(memberId => (
                                            <MemberListItem key={memberId}>
                                                <PlayerProfile player={players.find(p => p.id === memberId)} />
                                                <StyledButton onClick={() => unassignPlayerFromTeam(team.id, memberId)} disabled={isNotPreparing}>제외</StyledButton>
                                            </MemberListItem>
                                        )) : <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#888' }}>팀원이 없습니다.</p>}
                                    </MemberList>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                    <select onChange={(e) => handlePlayerSelect(team.id, e.target.value)} disabled={isNotPreparing} style={{ width: '100px' }}>
                                        <option value="">선수 선택</option>
                                        {unassignedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <StyledButton onClick={() => handleAssignPlayer(team.id)} disabled={isNotPreparing} style={{ width: '100px' }}>추가</StyledButton>
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
                        filteredMatches.map(match => <MatchRow key={match.id} match={match} />)
                    ) : <p>해당 목록에 경기가 없습니다.</p>}
                </Section>
            </FullWidthSection>
        </>
    )
}


function AdminPage() {
    const [activeMenu, setActiveMenu] = useState('mission');
    const [activeSubMenu, setActiveSubMenu] = useState('mission_dashboard');

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
        if (activeMenu === 'student') {
            return (
                <>
                    <PointManager />
                    <RoleManager />
                </>
            )
        }
        if (activeMenu === 'shop') {
            return <AvatarPartManager />;
        }
        if (activeMenu === 'league') {
            switch (activeSubMenu) {
                case 'league_manage': return <LeagueManager />;
                case 'player_manage': return <PlayerManager />;
                default: return <PlayerManager />;
            }
        }
        return <PendingMissionWidget />;
    };

    const handleMenuClick = (menu) => {
        setActiveMenu(menu);
        if (menu === 'mission') setActiveSubMenu('mission_dashboard');
        else if (menu === 'student') setActiveSubMenu('role_manage'); // Sub menu for student is now logical parent
        else if (menu === 'shop') setActiveSubMenu('item_manage');
        else if (menu === 'league') setActiveSubMenu('player_manage'); // Default to player management
    };

    return (
        <AdminWrapper>
            <Sidebar>
                <NavList>
                    <NavItem>
                        <NavButton $active={activeMenu === 'mission'} onClick={() => handleMenuClick('mission')}>미션 관리</NavButton>
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'student'} onClick={() => handleMenuClick('student')}>학생 관리</NavButton>
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'shop'} onClick={() => handleMenuClick('shop')}>상점 관리</NavButton>
                    </NavItem>
                    <NavItem>
                        <NavButton $active={activeMenu === 'league'} onClick={() => handleMenuClick('league')}>가가볼 리그 관리</NavButton>
                        {activeMenu === 'league' && (
                            <SubNavList>
                                <SubNavItem><SubNavButton $active={activeSubMenu === 'league_manage'} onClick={() => setActiveSubMenu('league_manage')}>시즌/팀/경기 관리</SubNavButton></SubNavItem>
                                <SubNavItem><SubNavButton $active={activeSubMenu === 'player_manage'} onClick={() => setActiveSubMenu('player_manage')}>선수 관리</SubNavButton></SubNavItem>
                            </SubNavList>
                        )}
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