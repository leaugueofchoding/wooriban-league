// src/pages/admin/tabs/LeagueTab.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { useLeagueStore, useClassStore } from '../../../store/leagueStore';
import PlayerProfile from '../../../components/PlayerProfile';

// 스타일 파일 import (기존 스타일 유지)
import {
    FullWidthSection, Section, SectionTitle, SaveButton, InputGroup,
    ScoreInput, StyledButton, TabContainer, TabButton, List, ListItem,
    MemberList, MemberListItem, CaptainButton,
    MatchItem, MatchSummary, TeamName, ScoreControl, ScoreButton, ScoreDisplay, VsText,
    ScorerSection, ScorerGrid, TeamScorerList, ScorerRow
} from '../Admin.style';

// =============================================================================
// [원본 유지] 경기 결과 입력 한 줄 (MatchRow)
// =============================================================================
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
        return { a: 0, b: 0 };
    }, [match]);

    const [scoreA, setScoreA] = useState(initialScore.a);
    const [scoreB, setScoreB] = useState(initialScore.b);
    const [showScorers, setShowScorers] = useState(isInitiallyOpen);
    const [scorers, setScorers] = useState(match.scorers || {});
    const isSeasonActive = currentSeason?.status === 'active';

    useEffect(() => {
        setShowScorers(isInitiallyOpen);
    }, [isInitiallyOpen]);

    const handleScorerChange = (playerId, amount) => {
        const currentGoals = scorers[playerId] || 0;
        if (amount === -1 && currentGoals === 0) return;

        setScorers(prev => {
            const newGoals = Math.max(0, currentGoals + amount);
            const newScorers = { ...prev };
            if (newGoals > 0) newScorers[playerId] = newGoals;
            else delete newScorers[playerId];
            return newScorers;
        });
    };

    const handleSave = () => {
        // 기존 로직: 점수와 득점자 정보 저장
        saveScores(match.id, { a: scoreA, b: scoreB }, scorers);
        alert('경기 결과가 저장되었습니다!');
        onSave(match.id);
    };

    return (
        <MatchItem>
            <MatchSummary>
                <TeamName>{teamA?.teamName || 'Team A'}</TeamName>
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
                <TeamName>{teamB?.teamName || 'Team B'}</TeamName>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <SaveButton onClick={() => setShowScorers(s => !s)} disabled={!isSeasonActive} style={{ backgroundColor: '#6c757d' }}>기록</SaveButton>
                    <SaveButton onClick={handleSave} disabled={!isSeasonActive}>저장</SaveButton>
                </div>
            </MatchSummary>

            {showScorers && (
                <ScorerSection>
                    <ScorerGrid>
                        {/* Team A 기록 */}
                        <TeamScorerList>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#495057' }}>{teamA?.teamName} 득점자</div>
                            {teamAMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span style={{ width: '60px' }}>{player.name}</span>
                                    <ScoreControl>
                                        <ScoreButton style={{ width: '24px', height: '24px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, -1)}>-</ScoreButton>
                                        <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold' }}>{scorers[player.id] || 0}</span>
                                        <ScoreButton style={{ width: '24px', height: '24px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, 1)}>+</ScoreButton>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                        </TeamScorerList>

                        {/* Team B 기록 */}
                        <TeamScorerList>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#495057' }}>{teamB?.teamName} 득점자</div>
                            {teamBMembers.map(player => (
                                <ScorerRow key={player.id}>
                                    <span style={{ width: '60px' }}>{player.name}</span>
                                    <ScoreControl>
                                        <ScoreButton style={{ width: '24px', height: '24px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, -1)}>-</ScoreButton>
                                        <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold' }}>{scorers[player.id] || 0}</span>
                                        <ScoreButton style={{ width: '24px', height: '24px', fontSize: '1rem' }} onClick={() => handleScorerChange(player.id, 1)}>+</ScoreButton>
                                    </ScoreControl>
                                </ScorerRow>
                            ))}
                        </TeamScorerList>
                    </ScorerGrid>
                </ScorerSection>
            )}
        </MatchItem>
    );
}

// =============================================================================
// [메인 컴포넌트] LeagueTab
// =============================================================================
function LeagueTab() {
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

    const handleSaveSeasonSettings = async () => {
        try {
            await updateSeasonDetails(currentSeason.id, {
                winningPrize: prizes.first,
                secondPlacePrize: prizes.second,
                thirdPlacePrize: prizes.third,
                topScorerPrize: prizes.topScorer,
            });
            alert('시즌 보상 설정이 저장되었습니다!');
        } catch (error) {
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handlePrizesChange = (rank, value) => {
        setPrizes(prev => ({ ...prev, [rank]: Number(value) || 0 }));
    };

    const handlePlayerSelect = (teamId, playerId) => { setSelectedPlayer(prev => ({ ...prev, [teamId]: playerId })); };
    const handleAssignPlayer = (teamId) => { assignPlayerToTeam(teamId, selectedPlayer[teamId]); };
    const handleAddTeam = () => { addNewTeam(newTeamName); setNewTeamName(''); };
    const handleBatchCreateTeams = () => { batchCreateTeams(Number(maleTeamCount), Number(femaleTeamCount)); };

    return (
        <>
            <FullWidthSection>
                <Section>
                    <SectionTitle>
                        시즌 관리 🕹️
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

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                    <div><label>1위 팀 보상</label><ScoreInput type="number" value={prizes.first} onChange={e => handlePrizesChange('first', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>2위 팀 보상</label><ScoreInput type="number" value={prizes.second} onChange={e => handlePrizesChange('second', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>3위 팀 보상</label><ScoreInput type="number" value={prizes.third} onChange={e => handlePrizesChange('third', e.target.value)} style={{ width: '100%' }} /></div>
                                    <div><label>득점왕 보상</label><ScoreInput type="number" value={prizes.topScorer} onChange={e => handlePrizesChange('topScorer', e.target.value)} style={{ width: '100%' }} /></div>
                                </div>

                                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                    <SaveButton onClick={handleSaveSeasonSettings}>설정 저장</SaveButton>
                                </div>
                            </div>

                            {currentSeason.status === 'completed' && (
                                <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#e7f5ff', borderRadius: '12px' }}>
                                    <h4>새 시즌 시작하기</h4>
                                    <InputGroup>
                                        <input
                                            type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                            placeholder="새 시즌 이름 입력" style={{ flex: 1, padding: '0.5rem' }}
                                        />
                                        <SaveButton onClick={handleCreateSeason} style={{ backgroundColor: '#28a745' }}>생성</SaveButton>
                                    </InputGroup>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#adb5bd' }}>진행 중인 시즌이 없습니다.</p>
                            <InputGroup style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <input
                                    type="text" value={newSeasonNameForCreate} onChange={(e) => setNewSeasonNameForCreate(e.target.value)}
                                    placeholder="첫 시즌 이름 (예: 1학기 가가볼)" style={{ flex: 1, padding: '0.8rem' }}
                                />
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
            )}
        </>
    )
}

export default LeagueTab;