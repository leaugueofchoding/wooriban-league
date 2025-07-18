import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import PlayerProfile from '../components/PlayerProfile.jsx';

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
`;

const TabButton = styled.button`
  flex: 1;
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

  &:first-child {
    border-radius: 8px 0 0 8px;
  }
  &:last-child {
    border-radius: 0 8px 8px 0;
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

    // ** 수정 **: authUid가 없는 선수 뿐만 아니라, 아직 참가 신청을 하지 않은
    // 로그인 유저와 연결하기 위해 모든 선수를 보여주는 것이 아니라,
    // 참가 신청을 통해 players에 등록된 선수 중 연결 안 된 선수만 보여줍니다.
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
                        <strong>{p.role}</strong>
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
        currentSeason, startSeason, endSeason
    } = useLeagueStore();

    const isNotPreparing = currentSeason?.status !== 'preparing';

    const [newTeamName, setNewTeamName] = useState('');
    const [maleTeamCount, setMaleTeamCount] = useState(2);
    const [femaleTeamCount, setFemaleTeamCount] = useState(2);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedPlayer, setSelectedPlayer] = useState({});

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

            <RoleManager />

            <Section>
                <Title>시즌 관리</Title>
                {currentSeason ? (
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
                            {currentSeason.status === 'completed' && <p><strong>이 시즌은 종료되었습니다.</strong></p>}
                        </div>
                    </div>
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
                <p>선수 등록은 홈페이지에서 학생이 직접 진행합니다. 관리자는 아래 목록에서 리그 참가 선수를 삭제할 수 있습니다.</p>
                <List>
                    {players.map(player => (
                        <ListItem key={player.id}>
                            <PlayerProfile player={player} />
                            <StyledButton onClick={() => removePlayer(player.id)} disabled={isNotPreparing}>삭제</StyledButton>
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
                <p style={{ fontSize: '0.8rem', color: '#666' }}>현재 설정된 리그 방식과 구성된 팀을 기준으로 대진표를 생성합니다.</p>
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