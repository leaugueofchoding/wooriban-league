import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import PlayerProfile from '../components/PlayerProfile.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { uploadAvatarPart, updateAvatarPartPrice, batchUpdateAvatarPartPrices, createMission, updateAvatarPartStatus } from '../api/firebase.js';

// --- Styled Components (디자인 부분) ---
const AdminWrapper = styled.div`
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: sans-serif;
`;

const Section = styled.section`
  margin-bottom: 2.5rem;
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const Title = styled.h2`
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
`;

const ListItem = styled.li`
  display: flex;
  justify-content: space-between;
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
  display: flex;
  flex-direction: column;
  align-items: center;
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
        case 'hair': case 'top': case 'eyes': case 'nose': case 'mouth': return 'center 25%';
        default: return 'center 55%';
    }
};

const ItemImage = styled.div`
  width: 100px;
  height: 100px;
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

// --- Components ---

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
            <Title>미션 관리</Title>
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
                            <ListItem key={mission.id}>
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
    const { avatarParts, fetchInitialData, updateLocalAvatarPartStatus } = useLeagueStore();
    const [files, setFiles] = useState([]);
    const [uploadCategory, setUploadCategory] = useState('hair');
    const [isUploading, setIsUploading] = useState(false);
    const [prices, setPrices] = useState({});

    const partCategories = useMemo(() => {
        return avatarParts.reduce((acc, part) => {
            const category = part.category;
            if (!acc[category]) acc[category] = [];
            acc[category].push(part);
            return acc;
        }, {});
    }, [avatarParts]);

    const sortedCategories = Object.keys(partCategories).sort();
    const [activeTab, setActiveTab] = useState(sortedCategories[0] || '');

    useEffect(() => {
        if (!activeTab && sortedCategories.length > 0) {
            setActiveTab(sortedCategories[0]);
        }
    }, [sortedCategories, activeTab]);

    useEffect(() => {
        const initialPrices = avatarParts.reduce((acc, part) => {
            acc[part.id] = part.price || 0;
            return acc;
        }, {});
        setPrices(initialPrices);
    }, [avatarParts]);

    const handlePriceChange = (partId, value) => {
        setPrices(prev => ({ ...prev, [partId]: value }));
    };

    const handleSaveAllPrices = async () => {
        if (!window.confirm("현재 탭의 모든 아이템 가격을 저장하시겠습니까?")) return;
        try {
            const updates = Object.entries(prices)
                .filter(([id, price]) => partCategories[activeTab]?.some(part => part.id === id))
                .map(([id, price]) => ({ id, price: Number(price) }));
            await batchUpdateAvatarPartPrices(updates);
            alert('가격이 성공적으로 저장되었습니다.');
            await fetchInitialData();
        } catch (error) {
            console.error("전체 가격 저장 오류:", error);
            alert('가격 저장 중 오류가 발생했습니다.');
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !uploadCategory) {
            return alert('파일과 카테고리를 모두 선택해주세요.');
        }
        setIsUploading(true);
        try {
            await Promise.all(
                files.map(file => uploadAvatarPart(file, uploadCategory))
            );
            alert(`${files.length}개의 아이템이 성공적으로 업로드되었습니다!`);
            setFiles([]);
            document.getElementById('avatar-file-input').value = "";
            await fetchInitialData();
        } catch (error) {
            console.error("아이템 업로드 오류:", error);
            alert('아이템 업로드 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleStatus = async (part) => {
        // 👇 [수정] '숨김' 상태가 아니면 무조건 '숨김'으로, '숨김' 상태면 '공개'로 변경합니다.
        const newStatus = part.status === 'hidden' ? 'visible' : 'hidden';

        try {
            // DB 상태는 비동기적으로 업데이트
            await updateAvatarPartStatus(part.id, newStatus);
            // UI는 스토어 액션을 통해 즉시 업데이트
            updateLocalAvatarPartStatus(part.id, newStatus);
        } catch (error) {
            alert(`오류: ${error.message}`);
            // 오류 발생 시, 원래 상태로 되돌리기 위해 데이터를 다시 불러옵니다.
            fetchInitialData();
        }
    };

    return (
        <Section>
            <Title>아바타 아이템 관리</Title>
            <InputGroup style={{ borderBottom: '2px solid #eee', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <input type="file" id="avatar-file-input" onChange={handleFileChange} accept="image/png" multiple />
                <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                    <option value="face">얼굴</option>
                    <option value="eyes">눈</option>
                    <option value="nose">코</option>
                    <option value="mouth">입</option>
                    <option value="hair">머리</option>
                    <option value="top">상의</option>
                    <option value="bottom">하의</option>
                    <option value="shoes">신발</option>
                    <option value="accessory">액세서리</option>
                </select>
                <SaveButton onClick={handleUpload} disabled={isUploading || files.length === 0}>
                    {isUploading ? '업로드 중...' : `${files.length}개 아이템 추가`}
                </SaveButton>
            </InputGroup>
            <TabContainer>
                {sortedCategories.map(category => (
                    <TabButton key={category} $active={activeTab === category} onClick={() => setActiveTab(category)}>
                        {category} ({partCategories[category]?.length || 0})
                    </TabButton>
                ))}
            </TabContainer>
            <ItemGrid>
                {partCategories[activeTab]?.map(part => (
                    <ItemCard key={part.id} style={{ opacity: part.status === 'hidden' ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                        <ItemImage src={part.src} $category={activeTab} />
                        <InputGroup style={{ marginBottom: '0', justifyContent: 'center' }}>
                            <ScoreInput
                                type="number"
                                value={prices[part.id] || ''}
                                onChange={(e) => handlePriceChange(part.id, e.target.value)}
                                placeholder="가격"
                                style={{ width: '80px', margin: '0' }}
                            />
                        </InputGroup>
                        <button
                            onClick={() => handleToggleStatus(part)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                marginTop: '8px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                color: 'white',
                                // 👇 [수정] '숨김' 상태일 때만 회색, 아니면 모두 초록색으로 변경
                                backgroundColor: part.status === 'hidden' ? '#6c757d' : '#28a745'
                            }}
                        >
                            {/* 👇 [수정] '숨김' 상태일 때만 '숨김 상태', 아니면 모두 '진열 중'으로 변경 */}
                            {part.status === 'hidden' ? '숨김 상태' : '진열 중'}
                        </button>
                    </ItemCard>
                ))}
            </ItemGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <SaveButton onClick={handleSaveAllPrices}>
                    {activeTab} 탭 전체 가격 저장
                </SaveButton>
            </div>
        </Section>
    );
}

function RoleManager() {
    const { users, players, linkPlayer } = useLeagueStore();
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [selectedRole, setSelectedRole] = useState('player');
    const unlinkedUsers = useMemo(() => {
        const linkedPlayerUids = players.map(p => p.authUid).filter(Boolean);
        return users.filter(u => !linkedPlayerUids.includes(u.uid));
    }, [users, players]);
    const unlinkedPlayers = useMemo(() => {
        return players.filter(p => !p.authUid);
    }, [players]);
    const handleLink = () => {
        if (!selectedUser || !selectedPlayer) return alert('사용자와 선수를 모두 선택해주세요.');
        linkPlayer(selectedPlayer, selectedUser, selectedRole);
    };
    return (
        <Section>
            <Title>사용자 역할 관리</Title>
            <InputGroup>
                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                    <option value="">로그인한 사용자 선택</option>
                    {unlinkedUsers.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                </select>
                <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}>
                    <option value="">연결할 선수 선택</option>
                    {unlinkedPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                    <option value="player">일반 참가자</option>
                    <option value="captain">팀장</option>
                    <option value="recorder">기록원</option>
                    <option value="referee">학생 심판</option>
                </select>
                <SaveButton onClick={handleLink}>연결</SaveButton>
            </InputGroup>
            <h4>연결된 선수 목록</h4>
            <List>
                {players.filter(p => p.authUid).map(p => (
                    <ListItem key={p.id}>
                        <PlayerProfile player={p} />
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <strong>{p.role}</strong>
                            <Link to={`/profile/${p.id}`}>
                                <StyledButton style={{ backgroundColor: '#17a2b8' }}>프로필</StyledButton>
                            </Link>
                        </div>
                    </ListItem>
                ))}
            </List>
        </Section>
    );
}

// PointManager 컴포넌트 추가
function PointManager() {
    const { players, adjustPoints } = useLeagueStore();
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');

    const handleSubmit = () => {
        adjustPoints(selectedPlayerId, Number(amount), reason.trim());
        setSelectedPlayerId('');
        setAmount(0);
        setReason('');
    };

    return (
        <Section>
            <Title>포인트 수동 조정</Title>
            <p style={{ margin: '-0.5rem 0 1rem', fontSize: '0.9rem', color: '#666' }}>
                부정행위 페널티 부여 또는 특별 보상 지급 시 사용합니다. (차감 시 음수 입력)
            </p>
            <InputGroup>
                <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
                    <option value="">-- 플레이어 선택 --</option>
                    {players
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(player => (
                            <option key={player.id} value={player.id}>
                                {player.name} (현재: {player.points || 0}P)
                            </option>
                        ))
                    }
                </select>
            </InputGroup>
            <InputGroup>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="변경할 포인트"
                    style={{ width: '150px', padding: '0.5rem' }}
                />
                <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="조정 사유 (예: 부정행위 페널티)"
                    style={{ flex: 1, padding: '0.5rem' }}
                />
            </InputGroup>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SaveButton
                    onClick={handleSubmit}
                    disabled={!selectedPlayerId || Number(amount) === 0 || !reason.trim()}
                    style={{ backgroundColor: '#dc3545' }}
                >
                    포인트 조정 실행
                </SaveButton>
            </div>
        </Section>
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

function AdminPage() {
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
        return matches.filter(m => (activeTab === 'pending' ? m.status !== '완료' : m.status === '완료'));
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
        <AdminWrapper>
            <h1>관리자 페이지</h1>
            {/* 모든 관리자 섹션 컴포넌트 호출 */}
            <MissionManager />
            <AvatarPartManager />
            <RoleManager />
            <PointManager /> {/* 포인트 관리자 컴포넌트 추가 */}
            <Section>
                <Title>시즌 관리</Title>
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
            <Section>
                <Title>리그 방식 설정</Title>
                <TabContainer>
                    <TabButton $active={leagueType === 'mixed'} onClick={() => setLeagueType('mixed')} disabled={isNotPreparing}>통합 리그</TabButton>
                    <TabButton $active={leagueType === 'separated'} onClick={() => setLeagueType('separated')} disabled={isNotPreparing}>남녀 분리 리그</TabButton>
                </TabContainer>
            </Section>
            <Section>
                <Title>선수 관리</Title>
                <List>
                    {players.map(player => (
                        <ListItem key={player.id}>
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
            <Section>
                <Title>팀 관리</Title>
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
                        <ListItem key={team.id}>
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
            <Section>
                <Title>경기 일정 관리</Title>
                <StyledButton onClick={generateSchedule} disabled={isNotPreparing}>경기 일정 자동 생성</StyledButton>
            </Section>
            <Section>
                <Title>경기 결과 입력</Title>
                <TabContainer>
                    <TabButton $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>입력 대기</TabButton>
                    <TabButton $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>입력 완료</TabButton>
                </TabContainer>
                {filteredMatches.length > 0 ? (
                    filteredMatches.map(match => <MatchRow key={match.id} match={match} />)
                ) : <p>해당 목록에 경기가 없습니다.</p>}
            </Section>
        </AdminWrapper>
    );
}

export default AdminPage;