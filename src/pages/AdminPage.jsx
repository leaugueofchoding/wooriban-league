import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import PlayerProfile from '../components/PlayerProfile.jsx';
import { Link } from 'react-router-dom';
import { uploadAvatarPart, updateAvatarPartPrice } from '../api/firebase.js';

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
  flex-wrap: wrap; /* 탭이 많아지면 줄바꿈 */
`;

const TabButton = styled.button`
  padding: 0.75rem;
  font-size: 1rem;
  font-weight: bold;
  border: 1px solid #ccc;
  background-color: ${props => props.$active ? '#007bff' : 'white'};
  color: ${props => props.$active ? 'white' : 'black'};
  cursor: pointer;
  
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

// 1. 이미지를 감싸는 틀(Wrapper)을 만듭니다.
const ItemImageWrapper = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 8px;
  background-color: #e9ecef;
  border: 1px solid #dee2e6;
  overflow: hidden; /* 중요: 틀 밖으로 나가는 이미지를 숨깁니다. */
`;

// 2. 기존 ItemImage에 transform과 transition 속성을 추가합니다.
const ItemImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(2); /* 이미지를 2배 확대합니다. */
  transition: transform 0.2s ease-in-out; /* 부드러운 효과를 위한 transition */

  &:hover {
    transform: scale(2.2); /* 마우스를 올리면 살짝 더 확대됩니다. */
  }
`;

// --- AvatarPartManager Component ---
function AvatarPartManager() {
    const { avatarParts, fetchInitialData } = useLeagueStore();
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

    const handleSavePrice = async (partId) => {
        const price = Number(prices[partId]);
        if (isNaN(price) || price < 0) {
            return alert('유효한 숫자를 입력해주세요.');
        }
        try {
            await updateAvatarPartPrice(partId, price);
            alert('가격이 저장되었습니다.');
            await fetchInitialData();
        } catch (error) {
            console.error("가격 저장 오류:", error);
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
                        {category} ({partCategories[category].length})
                    </TabButton>
                ))}
            </TabContainer>
            <ItemGrid>
                {partCategories[activeTab]?.map(part => (
                    <ItemCard key={part.id}>
                        <ItemImage src={part.src} alt={part.id} />
                        <InputGroup style={{ marginBottom: '0' }}>
                            <ScoreInput
                                type="number"
                                value={prices[part.id] || ''}
                                onChange={(e) => handlePriceChange(part.id, e.target.value)}
                                placeholder="가격"
                                style={{ width: '80px', margin: '0' }}
                            />
                            <SaveButton onClick={() => handleSavePrice(part.id)}>저장</SaveButton>
                        </InputGroup>
                    </ItemCard>
                ))}
            </ItemGrid>
        </Section>
    );
}

// --- RoleManager Component ---
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
        linkPlayer(selectedPlayer, selectedUser, selectedRole);
    };
    return (
        <Section>
            <Title>사용자 역할 관리</Title>
            <p>학생이 리그 참가 신청을 하면 '로그인한 사용자' 목록에 나타납니다. 해당 사용자와 선수를 연결하고 역할을 부여하세요.</p>
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
                <SaveButton onClick={handleLink}>연결 및 역할 부여</SaveButton>
            </InputGroup>
            <h4>연결된 선수 목록</h4>
            <List>
                {players.filter(p => p.authUid).map(p => (
                    <ListItem key={p.id}>
                        <PlayerProfile player={p} />
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <strong>{p.role}</strong>
                            <Link to={`/profile/${p.id}`}>
                                <StyledButton style={{ backgroundColor: '#17a2b8' }}>프로필 보기</StyledButton>
                            </Link>
                        </div>
                    </ListItem>
                ))}
            </List>
        </Section>
    );
}

// --- MatchRow Component ---
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

// --- AdminPage Component ---
function AdminPage() {
    const {
        players, teams, matches, removePlayer,
        addNewTeam, removeTeam, assignPlayerToTeam, unassignPlayerFromTeam,
        autoAssignTeams, generateSchedule, batchCreateTeams,
        leagueType, setLeagueType,
        currentSeason, startSeason, endSeason,
        updateSeason,
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
            <AvatarPartManager />
            <RoleManager />
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