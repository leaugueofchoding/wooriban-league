// src/pages/admin/tabs/LeagueTab.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { Link } from 'react-router-dom';
import PlayerProfile from '../../../components/PlayerProfile';
import { FullWidthSection, Section, SectionTitle, InputGroup, StyledButton, List, ListItem, SaveButton } from '../Admin.style';

// --- 리그 탭 전용 스타일 ---
const TabContainer = styled.div`
  display: flex; margin-bottom: 1.5rem; flex-wrap: wrap;
`;
const TabButton = styled.button`
  padding: 0.75rem 1.25rem; font-size: 1rem; font-weight: bold; border: 1px solid #ccc; background-color: ${props => props.$active ? '#007bff' : 'white'}; color: ${props => props.$active ? 'white' : 'black'}; cursor: pointer; transition: background-color 0.2s, color 0.2s;
  &:not(:last-child) { border-right: none; }
  &:first-child { border-radius: 8px 0 0 8px; }
  &:last-child { border-radius: 0 8px 8px 0; }
  &:hover { background-color: ${props => props.$active ? '#0056b3' : '#f8f9fa'}; }
  &:disabled { background-color: #e9ecef; color: #6c757d; cursor: not-allowed; }
`;
const MatchItem = styled.div`
  display: flex; flex-direction: column; padding: 1rem; margin-bottom: 1rem; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;
const MatchSummary = styled.div`
    display: flex; justify-content: space-between; align-items: center; width: 100%;
`;
const ScorerSection = styled.div`
    margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;
`;
const ScorerGrid = styled.div`
    display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;
`;
const TeamScorerList = styled.div`
    display: flex; flex-direction: column; gap: 0.5rem;
`;
const ScorerRow = styled.div`
    display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;
`;
const ScoreInput = styled.input`
  width: 60px; text-align: center; margin: 0 0.5rem; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;
`;
const ScoreControl = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
`;
const ScoreButton = styled.button`
  width: 32px; height: 32px; border: 1px solid #ced4da; font-size: 1.5rem; font-weight: bold; color: #495057; cursor: pointer; background-color: #f8f9fa; display: flex; justify-content: center; align-items: center; padding: 0; border-radius: 6px;
  &:hover { background-color: #e9ecef; }
  &:disabled { background-color: #e9ecef; color: #adb5bd; cursor: not-allowed; }
`;
const ScoreDisplay = styled.span`
  font-size: 2rem; font-weight: bold; width: 40px; text-align: center;
`;
const TeamName = styled.span`
  font-weight: bold; min-width: 100px; text-align: center;
`;
const VsText = styled.span`
  font-size: 1.5rem; font-weight: 700; color: #343a40; margin: 0 1rem;
`;
const MemberList = styled.div`
  margin-top: 0.5rem; margin-left: 1rem; padding-left: 1rem; border-left: 2px solid #ddd;
`;
const MemberListItem = styled.div`
  display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.9rem;
`;
const CaptainButton = styled.button`
    background: none; border: none; cursor: pointer; font-size: 1.2rem; font-weight: bold; padding: 0.2rem; line-height: 1; opacity: ${props => (props.disabled ? 0.5 : 1)}; color: ${props => (props.$isCaptain ? '#007bff' : '#ced4da')};
    &:hover:not(:disabled) { transform: scale(1.2); color: #0056b3; }
`;

// --- 컴포넌트 ---
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

    useEffect(() => { setShowScorers(isInitiallyOpen); }, [isInitiallyOpen]);

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

function LeagueManager() {
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
    const [scoringMode, setScoringMode] = useState('striker');

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
            setScoringMode(currentSeason.scoringMode || 'striker');
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
            } catch (error) { alert(`시즌 생성 실패: ${error.message}`); }
        }
    };

    const handleSaveSeasonSettings = async () => {
        try {
            await updateSeasonDetails(currentSeason.id, {
                winningPrize: prizes.first, secondPlacePrize: prizes.second,
                thirdPlacePrize: prizes.third, topScorerPrize: prizes.topScorer, scoringMode: scoringMode
            });
            alert('시즌 설정(보상 및 방식)이 저장되었습니다!');
        } catch (error) { alert('저장 중 오류가 발생했습니다.'); }
    };

    const handlePrizesChange = (rank, value) => setPrizes(prev => ({ ...prev, [rank]: Number(value) || 0 }));
    const handlePlayerSelect = (teamId, playerId) => setSelectedPlayer(prev => ({ ...prev, [teamId]: playerId }));
    const handleAssignPlayer = (teamId) => assignPlayerToTeam(teamId, selectedPlayer[teamId]);
    const handleAddTeam = () => { addNewTeam(newTeamName); setNewTeamName(''); };
    const handleBatchCreateTeams = () => batchCreateTeams(Number(maleTeamCount), Number(femaleTeamCount));

    return (
        <>
            <FullWidthSection>
                <Section>
                    <SectionTitle>
                        리그 운영 설정 ⚙️
                        {currentSeason && (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: currentSeason.status === 'active' ? '#28a745' : '#868e96' }}>
                                    {currentSeason.status === 'preparing' ? '준비 중' : (currentSeason.status === 'active' ? '진행 중 🔥' : '종료됨')}
                                </span>
                                {currentSeason.status === 'preparing' && <SaveButton onClick={startSeason} style={{ backgroundColor: '#20c997' }}>▶ 시즌 시작</SaveButton>}
                                {currentSeason.status === 'active' && <SaveButton onClick={endSeason} style={{ backgroundColor: '#fa5252' }}>⏹ 시즌 종료</SaveButton>}
                            </div>
                        )}
                    </SectionTitle>

                    {currentSeason ? (
                        <>
                            <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{currentSeason.seasonName} 설정</h3>
                                <InputGroup>
                                    <label>🏆 경기 방식:</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <label><input type="radio" value="striker" checked={scoringMode === 'striker'} onChange={(e) => setScoringMode(e.target.value)} disabled={isNotPreparing} style={{ marginRight: '5px' }} /> ⚽ 일반 방식 (축구형)</label>
                                        <label><input type="radio" value="survivor" checked={scoringMode === 'survivor'} onChange={(e) => setScoringMode(e.target.value)} disabled={isNotPreparing} style={{ marginRight: '5px' }} /> 🛡️ 서바이벌 방식 (피구형)</label>
                                    </div>
                                </InputGroup>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                    <div><label>1위 보상</label><ScoreInput type="number" value={prizes.first} onChange={e => handlePrizesChange('first', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>2위 보상</label><ScoreInput type="number" value={prizes.second} onChange={e => handlePrizesChange('second', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>3위 보상</label><ScoreInput type="number" value={prizes.third} onChange={e => handlePrizesChange('third', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>MVP 보상</label><ScoreInput type="number" value={prizes.topScorer} onChange={e => handlePrizesChange('topScorer', e.target.value)} style={{ width: '100%' }} /></div>
                                </div>
                                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                    <SaveButton onClick={handleSaveSeasonSettings}>설정 저장</SaveButton>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#343a40', borderRadius: '12px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <strong>📺 경기 중계 화면 송출</strong>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#adb5bd' }}>{currentSeason.status === 'active' ? "실시간 점수판 활용" : "시즌이 시작되어야 합니다."}</p>
                                </div>
                                {currentSeason.status === 'active' ? (
                                    <Link to="/broadcast" target="_blank" style={{ textDecoration: 'none' }}><StyledButton style={{ backgroundColor: '#fa5252', fontSize: '1rem' }}>방송 열기 ↗</StyledButton></Link>
                                ) : <StyledButton disabled style={{ backgroundColor: '#495057', fontSize: '1rem' }}>방송 대기 중</StyledButton>}
                            </div>

                            {currentSeason.status === 'completed' && (
                                <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#e7f5ff', borderRadius: '12px' }}>
                                    <h4>새 시즌 시작하기</h4>
                                    <InputGroup>
                                        <input type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)} placeholder="새 시즌 이름 입력" style={{ flex: 1, padding: '0.5rem' }} />
                                        <SaveButton onClick={handleCreateSeason} style={{ backgroundColor: '#28a745' }}>생성</SaveButton>
                                    </InputGroup>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p>진행 중인 시즌이 없습니다.</p>
                            <InputGroup style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <input type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)} placeholder="첫 시즌 이름" style={{ flex: 1, padding: '0.8rem' }} />
                                <SaveButton onClick={handleCreateSeason} style={{ backgroundColor: '#28a745' }}>시즌 생성</SaveButton>
                            </InputGroup>
                        </div>
                    )}
                </Section>
            </FullWidthSection>

            {currentSeason && (
                <>
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
                                    <label>남 팀 수: <input type="number" min="0" value={maleTeamCount} onChange={e => setMaleTeamCount(e.target.value)} disabled={isNotPreparing} /></label>
                                    <label>여 팀 수: <input type="number" min="0" value={femaleTeamCount} onChange={e => setFemaleTeamCount(e.target.value)} disabled={isNotPreparing} /></label>
                                    <StyledButton onClick={handleBatchCreateTeams} disabled={isNotPreparing}>일괄 생성</StyledButton>
                                </InputGroup>
                            ) : (
                                <InputGroup>
                                    <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="새 팀 이름" disabled={isNotPreparing} />
                                    <StyledButton onClick={handleAddTeam} disabled={isNotPreparing}>추가</StyledButton>
                                </InputGroup>
                            )}
                            <InputGroup><StyledButton onClick={autoAssignTeams} style={{ marginLeft: 'auto' }} disabled={isNotPreparing}>팀원 자동 배정</StyledButton></InputGroup>
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
                                                                <CaptainButton onClick={() => setTeamCaptain(team.id, memberId)} disabled={isNotPreparing || isCaptain} $isCaptain={isCaptain}>Ⓒ</CaptainButton>
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
                                            <StyledButton onClick={() => removeTeam(team.id)} disabled={isNotPreparing} style={{ width: '100px' }}>삭제</StyledButton>
                                        </div>
                                    </ListItem>
                                ))}
                            </List>
                        </Section>
                    </FullWidthSection>
                    <FullWidthSection>
                        <Section>
                            <SectionTitle>경기 일정 관리</SectionTitle>
                            <StyledButton onClick={generateSchedule} disabled={isNotPreparing}>일정 자동 생성</StyledButton>
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
                                    <MatchRow key={match.id} match={match} isInitiallyOpen={openedMatchId === match.id} onSave={handleSaveAndOpenNext} />
                                ))
                            ) : <p>해당 목록에 경기가 없습니다.</p>}
                        </Section>
                    </FullWidthSection>
                </>
            )}
        </>
    )
}

function LeagueTab({ activeSubMenu }) {
    // 플레이어 관리는 학생 탭으로 넘어갔으므로 리그 관리만 렌더링
    return <LeagueManager />;
}

export default LeagueTab;