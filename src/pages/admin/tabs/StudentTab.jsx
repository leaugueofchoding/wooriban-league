// src/pages/admin/tabs/StudentTab.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { auth, db, linkPlayerToAuth, getAttendanceByDate } from '../../../api/firebase';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PlayerProfile from '../../../components/PlayerProfile';
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, SaveButton
} from '../Admin.style';

function PointManager() {
    const { classId } = useClassStore();
    const { players, batchAdjustPoints } = useLeagueStore();
    const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');

    const handlePlayerSelect = (playerId) => {
        setSelectedPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) newSet.delete(playerId);
            else newSet.add(playerId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const nonAdminPlayerIds = players.filter(p => p.role !== 'admin').map(p => p.id);
        const allSelected = nonAdminPlayerIds.length > 0 && nonAdminPlayerIds.every(id => selectedPlayerIds.has(id));
        if (allSelected) setSelectedPlayerIds(new Set());
        else setSelectedPlayerIds(new Set(nonAdminPlayerIds));
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
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6',
                    borderRadius: '8px', padding: '1rem', backgroundColor: 'white', marginBottom: '1rem'
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
                                        type="checkbox" checked={selectedPlayerIds.has(player.id)}
                                        onChange={() => !isAdmin && handlePlayerSelect(player.id)}
                                        style={{ width: '18px', height: '18px' }} disabled={isAdmin}
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

function RoleManager() {
    const { classId } = useClassStore();
    const { players, fetchInitialData } = useLeagueStore();
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [selectedRole, setSelectedRole] = useState('player');

    useEffect(() => {
        if (selectedPlayerId) {
            const player = players.find(p => p.id === selectedPlayerId);
            if (player) setSelectedRole(player.role || 'player');
        }
    }, [selectedPlayerId, players]);

    const handleSaveRole = async () => {
        const player = players.find(p => p.id === selectedPlayerId);
        if (!player) return alert('선수를 선택해주세요.');
        if (!player.authUid) return alert('역할을 저장하려면 먼저 계정이 연결된 선수여야 합니다.');

        try {
            await linkPlayerToAuth(classId, selectedPlayerId, player.authUid, selectedRole);
            alert(`${player.name}님의 역할이 ${selectedRole}(으)로 변경되었습니다.`);
            await fetchInitialData();
        } catch (error) {
            alert(`역할 변경 실패: ${error.message}`);
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>사용자 역할 관리 🧑‍⚖️</SectionTitle>
                <InputGroup>
                    <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} style={{ flex: 1, padding: '0.5rem' }}>
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
        </FullWidthSection>
    );
}

function PlayerManager({ onSendMessage }) {
    const { players, currentSeason, togglePlayerStatus } = useLeagueStore();
    const [showInactive, setShowInactive] = useState(false);

    const isNotPreparing = currentSeason && currentSeason.status !== 'preparing';

    const sortedPlayers = useMemo(() => {
        const filteredPlayers = players.filter(p => showInactive || p.status !== 'inactive');
        return filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
    }, [players, showInactive]);

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학생 목록</SectionTitle>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#dc3545', fontWeight: 'bold' }}>
                        ※ 리그 비활성화: 가가볼 리그 팀 자동 배정에서 제외되며, 리그 활동이 일시 정지됩니다.
                    </p>
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
                                        title={isNotPreparing && !isInactive ? "시즌 중 리그 비활성화 불가" : "리그 제외"}
                                        style={{ backgroundColor: isInactive ? '#28a745' : '#dc3545' }}
                                    >
                                        {isInactive ? '리그 활성화' : '리그 비활성화'}
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
        return players.filter(p => attendedPlayerIds.includes(p.authUid)).sort((a, b) => a.name.localeCompare(b.name));
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
                    <DatePicker selected={selectedDate} onChange={(date) => setSelectedDate(date)} dateFormat="yyyy/MM/dd" popperPlacement="bottom-start" />
                </InputGroup>
                <h4>{formatDate(selectedDate)} 출석: {attendedPlayers.length}명</h4>
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
                        ) : <p>해당 날짜에 출석한 학생이 없습니다.</p>}
                    </List>
                )}
            </Section>
        </FullWidthSection>
    );
}

function StudentTab({ studentSubMenu, onSendMessage }) {
    const { players } = useLeagueStore();

    if (studentSubMenu === 'list') return <PlayerManager onSendMessage={onSendMessage} />;
    if (studentSubMenu === 'attendance') return <AttendanceChecker players={players} />;

    // 원래 GridContainer로 묶여 있었으나, 세로 배치를 원하시므로 Fragment(<>)를 사용하여 위아래로 쌓이게 수정했습니다.
    return (
        <>
            <PointManager />
            <RoleManager />
        </>
    );
}

export default StudentTab;