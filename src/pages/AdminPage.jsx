import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';

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
        players, teams, matches, addNewPlayer, removePlayer,
        addNewTeam, removeTeam, assignPlayerToTeam, unassignPlayerFromTeam,
        autoAssignTeams, generateSchedule, batchCreateTeams,
        leagueType, setLeagueType,
        currentSeason, startSeason, endSeason
    } = useLeagueStore();

    // 디버깅용 로그: 렌더링될 때마다 현재 시즌 상태를 확인
    useEffect(() => {
        if (currentSeason) {
            console.log("AdminPage 현재 시즌 상태:", currentSeason.status);
        }
    }, [currentSeason]);

    // '준비중' 상태가 아닐 때 true가 되어 버튼들을 비활성화 시킴
    const isNotPreparing = currentSeason?.status !== 'preparing';

    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerGender, setNewPlayerGender] = useState('남');
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
        if (activeTab === 'pending') {
            return matches.filter(m => m.status !== '완료');
        }
        return matches.filter(m => m.status === '완료');
    }, [matches, activeTab]);

    const getPlayerName = (playerId) => players.find(p => p.id === playerId)?.name || '선수 정보 없음';

    const handlePlayerSelect = (teamId, playerId) => {
        setSelectedPlayer(prev => ({ ...prev, [teamId]: playerId }));
    };

    const handleAssignPlayer = (teamId) => {
        const playerId = selectedPlayer[teamId];
        assignPlayerToTeam(teamId, playerId);
    };

    const handleAddPlayer = () => {
        addNewPlayer(newPlayerName, newPlayerGender);
        setNewPlayerName('');
    };

    const handleAddTeam = () => {
        addNewTeam(newTeamName);
        setNewTeamName('');
    };

    const handleBatchCreateTeams = () => {
        const maleCount = Number(maleTeamCount);
        const femaleCount = Number(femaleTeamCount);
        batchCreateTeams(maleCount, femaleCount);
    };

    const handleAutoAssign = () => {
        autoAssignTeams();
    };

    const handleGenerateSchedule = () => {
        generateSchedule();
    };

    return (
        <AdminWrapper>
            <h1>관리자 페이지</h1>

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
                            {currentSeason.status === 'preparing' && (
                                <SaveButton onClick={startSeason}>시즌 시작</SaveButton>
                            )}
                            {currentSeason.status === 'active' && (
                                <SaveButton onClick={endSeason} style={{ backgroundColor: '#dc3545' }}>시즌 종료</SaveButton>
                            )}
                            {currentSeason.status === 'completed' && (
                                <p><strong>이 시즌은 종료되었습니다.</strong></p>
                            )}
                        </div>
                    </div>
                ) : (
                    <p>시즌 정보를 불러오는 중입니다...</p>
                )}
            </Section>

            <Section>
                <Title>리그 방식 설정</Title>
                <TabContainer>
                    <TabButton $active={leagueType === 'mixed'} onClick={() => setLeagueType('mixed')} disabled={isNotPreparing}>
                        통합 리그
                    </TabButton>
                    <TabButton $active={leagueType === 'separated'} onClick={() => setLeagueType('separated')} disabled={isNotPreparing}>
                        남녀 분리 리그
                    </TabButton>
                </TabContainer>
            </Section>

            <Section>
                <Title>선수 관리</Title>
                <InputGroup>
                    <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="새 선수 이름" disabled={isNotPreparing} />
                    <div>
                        <label><input type="radio" value="남" checked={newPlayerGender === '남'} onChange={(e) => setNewPlayerGender(e.target.value)} disabled={isNotPreparing} /> 남</label>
                        <label><input type="radio" value="여" checked={newPlayerGender === '여'} onChange={(e) => setNewPlayerGender(e.target.value)} disabled={isNotPreparing} /> 여</label>
                    </div>
                    <StyledButton onClick={handleAddPlayer} disabled={isNotPreparing}>선수 추가</StyledButton>
                </InputGroup>
                <List>
                    {players.map(player => (
                        <ListItem key={player.id}>
                            <span>{player.name} <strong>({player.gender || '미지정'})</strong></span>
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
                    <StyledButton onClick={handleAutoAssign} style={{ marginLeft: 'auto' }} disabled={isNotPreparing}>팀원 자동 배정</StyledButton>
                </InputGroup>

                <List>
                    {teams.map(team => (
                        <ListItem key={team.id}>
                            <div style={{ flex: 1, marginRight: '1rem' }}>
                                <strong>{team.teamName}</strong>
                                <MemberList>
                                    {team.members?.length > 0 ? team.members.map(memberId => (
                                        <MemberListItem key={memberId}>
                                            <span>{getPlayerName(memberId)}</span>
                                            <StyledButton onClick={() => unassignPlayerFromTeam(team.id, memberId)} disabled={isNotPreparing}>제외</StyledButton>
                                        </MemberListItem>
                                    )) : <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#888' }}>팀원이 없습니다.</p>}
                                </MemberList>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                <select onChange={(e) => handlePlayerSelect(team.id, e.target.value)} disabled={isNotPreparing} style={{ width: '100px' }}>
                                    <option value="">선수 선택</option>
                                    {unassignedPlayers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
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
                <StyledButton onClick={handleGenerateSchedule} disabled={isNotPreparing}>경기 일정 자동 생성</StyledButton>
                <p style={{ fontSize: '0.8rem', color: '#666' }}>
                    현재 설정된 리그 방식과 구성된 팀을 기준으로 대진표를 생성합니다.
                </p>
            </Section>

            <Section>
                <Title>경기 결과 입력</Title>
                <TabContainer>
                    <TabButton $active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                        입력 대기
                    </TabButton>
                    <TabButton $active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
                        입력 완료
                    </TabButton>
                </TabContainer>
                {filteredMatches.length > 0 ? (
                    filteredMatches.map(match => <MatchRow key={match.id} match={match} />)
                ) : (
                    <p>해당 목록에 경기가 없습니다.</p>
                )}
            </Section>
        </AdminWrapper>
    );
}

export default AdminPage;