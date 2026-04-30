import React, { useState, useEffect } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import {
    auth, db, updatePlayerPoint, updatePlayerRole,
    deletePlayer, getAttendanceByDate
} from '../../../api/firebase';
import { doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PlayerProfile from '../../../components/PlayerProfile';
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, SaveButton, GridContainer
} from '../Admin.style';

// [1] 포인트 관리
function PointManager() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [pointAmount, setPointAmount] = useState(0);
    const [reason, setReason] = useState('');

    const handleUpdatePoint = async (isAdd) => {
        if (!classId) return;
        if (!selectedPlayerId) return alert('학생을 선택해주세요.');
        if (pointAmount <= 0) return alert('올바른 포인트 값을 입력해주세요.');
        if (!reason.trim()) return alert('사유를 입력해주세요.');

        try {
            const finalAmount = isAdd ? Number(pointAmount) : -Number(pointAmount);
            await updatePlayerPoint(classId, selectedPlayerId, finalAmount, reason, auth.currentUser.uid);
            alert('포인트가 반영되었습니다.');
            setPointAmount(0);
            setReason('');
        } catch (error) {
            console.error(error);
            alert('포인트 업데이트 실패');
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>포인트 관리 💰</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <InputGroup>
                        <label>학생 선택:</label>
                        <select
                            value={selectedPlayerId}
                            onChange={(e) => setSelectedPlayerId(e.target.value)}
                            style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #dee2e6', flex: 1 }}
                        >
                            <option value="">학생을 선택하세요</option>
                            {players.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                            ))}
                        </select>
                    </InputGroup>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <InputGroup style={{ flex: 1 }}>
                            <label>점수:</label>
                            <input
                                type="number"
                                value={pointAmount}
                                onChange={(e) => setPointAmount(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #dee2e6' }}
                            />
                        </InputGroup>
                        <InputGroup style={{ flex: 2 }}>
                            <label>사유:</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="예: 발표 우수, 지각"
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #dee2e6' }}
                            />
                        </InputGroup>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <SaveButton onClick={() => handleUpdatePoint(true)} style={{ flex: 1, backgroundColor: '#20c997' }}>+ 지급</SaveButton>
                        <SaveButton onClick={() => handleUpdatePoint(false)} style={{ flex: 1, backgroundColor: '#fa5252' }}>- 차감</SaveButton>
                    </div>
                </div>
            </Section>
        </FullWidthSection>
    );
}

// [2] 역할 관리
function RoleManager() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [targetPlayerId, setTargetPlayerId] = useState('');
    const [newRole, setNewRole] = useState('player');

    const handleChangeRole = async () => {
        if (!targetPlayerId) return alert('학생을 선택해주세요.');
        if (window.confirm('정말 역할을 변경하시겠습니까? (관리자 권한 부여 시 주의)')) {
            try {
                await updatePlayerRole(classId, targetPlayerId, newRole);
                alert('역할이 변경되었습니다.');
            } catch (error) {
                alert('변경 실패');
            }
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>역할(권한) 변경 👮</SectionTitle>
                <InputGroup>
                    <select
                        value={targetPlayerId}
                        onChange={(e) => setTargetPlayerId(e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #dee2e6', marginRight: '0.5rem' }}
                    >
                        <option value="">학생 선택</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.name} (현재: {p.role})</option>)}
                    </select>
                    <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #dee2e6', marginRight: '0.5rem' }}
                    >
                        <option value="player">학생 (Player)</option>
                        <option value="recorder">기록원 (Recorder)</option>
                        <option value="admin">관리자 (Admin)</option>
                    </select>
                    <StyledButton onClick={handleChangeRole}>변경</StyledButton>
                </InputGroup>
                <p style={{ fontSize: '0.85rem', color: '#868e96', marginTop: '1rem' }}>
                    * <strong>기록원:</strong> 경기 점수 입력 및 미션 승인 가능<br />
                    * <strong>관리자:</strong> 모든 설정 접근 가능 (선생님)
                </p>
            </Section>
        </FullWidthSection>
    );
}

// [3] 학생 목록 관리
function PlayerManager({ onSendMessage }) {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [editingPlayer, setEditingPlayer] = useState(null);
    const [editName, setEditName] = useState('');

    const handleDeletePlayer = async (playerId, playerName) => {
        if (window.confirm(`'${playerName}' 학생을 정말 삭제하시겠습니까? (되돌릴 수 없습니다)`)) {
            try {
                await deletePlayer(classId, playerId);
            } catch (error) {
                alert('삭제 실패: ' + error.message);
            }
        }
    };

    const startEdit = (player) => {
        setEditingPlayer(player.id);
        setEditName(player.name);
    };

    const saveEdit = async () => {
        if (!editName.trim()) return;
        try {
            await updateDoc(doc(db, "classes", classId, "players", editingPlayer), { name: editName });
            setEditingPlayer(null);
        } catch (error) {
            alert("수정 실패");
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학생 목록 관리 📋 ({players.length}명)</SectionTitle>
                <List>
                    {players.map(player => (
                        <ListItem key={player.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <PlayerProfile player={player} size="40px" />
                                {editingPlayer === player.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        style={{ padding: '0.4rem' }}
                                    />
                                ) : (
                                    <div>
                                        <strong>{player.name}</strong>
                                        <span style={{ fontSize: '0.8rem', color: '#868e96', marginLeft: '0.5rem' }}>
                                            {player.email ? `(${player.email})` : '(계정 미연동)'}
                                        </span>
                                        <div style={{ fontSize: '0.8rem', color: '#adb5bd' }}>
                                            {player.role} | {player.point} P
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {editingPlayer === player.id ? (
                                    <StyledButton onClick={saveEdit} style={{ backgroundColor: '#20c997' }}>저장</StyledButton>
                                ) : (
                                    <StyledButton onClick={() => startEdit(player)} style={{ backgroundColor: '#adb5bd' }}>수정</StyledButton>
                                )}
                                <StyledButton
                                    onClick={() => onSendMessage && onSendMessage(player.id)}
                                    style={{ backgroundColor: '#4dabf7' }}
                                >
                                    쪽지
                                </StyledButton>
                                <StyledButton
                                    onClick={() => handleDeletePlayer(player.id, player.name)}
                                    style={{ backgroundColor: '#fa5252' }}
                                >
                                    삭제
                                </StyledButton>
                            </div>
                        </ListItem>
                    ))}
                </List>
            </Section>
        </FullWidthSection>
    );
}

// [4] 출석 체크
function AttendanceChecker({ players }) {
    const { classId } = useClassStore();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendanceList, setAttendanceList] = useState([]);

    useEffect(() => {
        if (classId && selectedDate) {
            const fetchAttendance = async () => {
                const data = await getAttendanceByDate(classId, selectedDate);
                setAttendanceList(data);
            };
            fetchAttendance();
        }
    }, [classId, selectedDate]);

    const handleToggleAttendance = async (playerId, currentStatus) => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const docRef = doc(db, "classes", classId, "attendance", `${dateStr}_${playerId}`);

        try {
            if (currentStatus) {
                await deleteDoc(docRef);
            } else {
                await setDoc(docRef, {
                    studentId: playerId, date: dateStr, status: 'present', timestamp: new Date()
                });
            }
            const data = await getAttendanceByDate(classId, selectedDate);
            setAttendanceList(data);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>
                    출석부 📅
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => setSelectedDate(date)}
                        dateFormat="yyyy-MM-dd"
                        style={{ border: '1px solid #dee2e6', padding: '0.5rem', borderRadius: '4px' }}
                    />
                </SectionTitle>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                    {players.map(player => {
                        const record = attendanceList.find(a => a.studentId === player.id);
                        const isPresent = record?.status === 'present';

                        return (
                            <div
                                key={player.id}
                                onClick={() => handleToggleAttendance(player.id, isPresent)}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    backgroundColor: isPresent ? '#e6fcf5' : '#fff5f5',
                                    border: `2px solid ${isPresent ? '#20c997' : '#ffc9c9'}`,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                                    {isPresent ? '🔵' : '❌'}
                                </div>
                                <strong>{player.name}</strong>
                            </div>
                        );
                    })}
                </div>
            </Section>
        </FullWidthSection>
    );
}

// [메인] StudentTab
function StudentTab({ activeSubMenu, onSendMessage }) {
    if (activeSubMenu === 'list') return <PlayerManager onSendMessage={onSendMessage} />;
    if (activeSubMenu === 'attendance') {
        const { players } = useLeagueStore();
        return <AttendanceChecker players={players} />;
    }
    return (
        <GridContainer>
            <PointManager />
            <RoleManager />
        </GridContainer>
    );
}

export default StudentTab;