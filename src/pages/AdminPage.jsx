import React, { useState, useMemo } from 'react';
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

const InputGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
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
  background-color: ${props => props.active ? '#007bff' : 'white'};
  color: ${props => props.active ? 'white' : 'black'};
  cursor: pointer;

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
`;

// --- MatchRow Component ---
function MatchRow({ match }) {
    const { teams, saveScores } = useLeagueStore();
    const [scoreA, setScoreA] = useState(match.teamA_score || '');
    const [scoreB, setScoreB] = useState(match.teamB_score || '');

    const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.teamName || 'N/A';

    const handleSave = () => {
        const scores = { a: Number(scoreA), b: Number(scoreB) };
        if (isNaN(scores.a) || isNaN(scores.b)) {
            alert('점수를 숫자로 입력해주세요.');
            return;
        }
        saveScores(match.id, scores);
        alert('저장되었습니다!');
    };

    return (
        <MatchItem>
            <TeamName>{getTeamName(match.teamA_id)}</TeamName>
            <ScoreInput type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
            <span>vs</span>
            <ScoreInput type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
            <TeamName>{getTeamName(match.teamB_id)}</TeamName>
            <SaveButton onClick={handleSave}>저장</SaveButton>
        </MatchItem>
    );
}

// --- AdminPage Component ---
function AdminPage() {
    const {
        players,
        teams,
        matches,
        addNewPlayer,
        removePlayer,
        addNewTeam,
        removeTeam,
        assignPlayerToTeam,
        unassignPlayerFromTeam,
        autoAssignTeams,
        leagueType,
        setLeagueType
    } = useLeagueStore();
    const [newTeamName, setNewTeamName] = useState('');
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerGender, setNewPlayerGender] = useState('남'); // 기본값 '남'
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedPlayer, setSelectedPlayer] = useState({});

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

    const handleAutoAssign = () => {
        autoAssignTeams();
    };

    return (
        <AdminWrapper>
            <h1>관리자 페이지</h1>

            <Section>
                <Title>리그 방식 설정</Title>
                <TabContainer>
                    <TabButton
                        active={leagueType === 'mixed'}
                        onClick={() => setLeagueType('mixed')}
                    >
                        통합 리그
                    </TabButton>
                    <TabButton
                        active={leagueType === 'separated'}
                        onClick={() => setLeagueType('separated')}
                    >
                        남녀 분리 리그
                    </TabButton>
                </TabContainer>
            </Section>

            <Section>
                <Title>선수 관리</Title>
                <InputGroup>
                    <input
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        placeholder="새 선수 이름"
                    />
                    <div>
                        <label><input type="radio" value="남" checked={newPlayerGender === '남'} onChange={(e) => setNewPlayerGender(e.target.value)} /> 남</label>
                        <label><input type="radio" value="여" checked={newPlayerGender === '여'} onChange={(e) => setNewPlayerGender(e.target.value)} /> 여</label>
                    </div>
                    <button onClick={handleAddPlayer}>선수 추가</button>
                </InputGroup>
                <List>
                    {players.map(player => (
                        <ListItem key={player.id}>
                            <span>{player.name} <strong>({player.gender || '미지정'})</strong></span>
                            <button onClick={() => removePlayer(player.id)}>삭제</button>
                        </ListItem>
                    ))}
                </List>
            </Section>

            <Section>
                <Title>팀 관리</Title>
                <InputGroup>
                    <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="새 팀 이름"
                    />
                    <button onClick={handleAddTeam}>팀 추가</button>
                    <button onClick={handleAutoAssign} style={{ marginLeft: 'auto' }}>팀원 자동 배정</button>
                </InputGroup>
                <List>
                    {teams.map(team => (
                        <ListItem key={team.id}>
                            <div style={{ flex: 1 }}>
                                <strong>{team.teamName}</strong>
                                <MemberList>
                                    {team.members && team.members.length > 0 ? (
                                        team.members.map(memberId => (
                                            <MemberListItem key={memberId}>
                                                <span>{getPlayerName(memberId)}</span>
                                                <button onClick={() => unassignPlayerFromTeam(team.id, memberId)}>제외</button>
                                            </MemberListItem>
                                        ))
                                    ) : (
                                        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: '#888' }}>팀원이 없습니다.</p>
                                    )}
                                </MemberList>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select onChange={(e) => handlePlayerSelect(team.id, e.target.value)}>
                                    <option value="">선수 선택</option>
                                    {players.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <button onClick={() => handleAssignPlayer(team.id)}>추가</button>
                                <button onClick={() => removeTeam(team.id)}>팀 삭제</button>
                            </div>
                        </ListItem>
                    ))}
                </List>
            </Section>

            <Section>
                <Title>경기 결과 입력</Title>
                <TabContainer>
                    <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                        입력 대기
                    </TabButton>
                    <TabButton active={activeTab === 'completed'} onClick={() => setActiveTab('completed')}>
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