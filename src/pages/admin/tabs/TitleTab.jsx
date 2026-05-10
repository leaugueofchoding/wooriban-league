// src/pages/admin/tabs/TitleTab.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { getTitles, createTitle, updateTitle, deleteTitle, grantTitleToPlayersBatch } from '../../../api/firebase';
import { FullWidthSection, Section, SectionTitle, InputGroup, StyledButton, SaveButton, List, ListItem } from '../Admin.style';
import styled from 'styled-components';

// 칭호 관리 탭에서만 쓰이는 컨트롤러 스타일
const MissionControls = styled.div`
  display: flex; gap: 0.5rem; align-items: center;
`;

function TitleManager() {
    const { classId } = useClassStore();
    const { players, fetchInitialData } = useLeagueStore();
    const [titles, setTitles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTitle, setEditingTitle] = useState(null);
    const [isAssignMode, setIsAssignMode] = useState(null);
    const [selectedPlayerIds, setSelectedPlayerIds] = useState(new Set());

    const fetchTitles = async () => {
        if (!classId) return;
        setIsLoading(true);
        const titlesData = await getTitles(classId);
        setTitles(titlesData);
        setIsLoading(false);
    };

    useEffect(() => { fetchTitles(); }, [classId]);

    const handlePlayerSelect = (playerId) => {
        setSelectedPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) newSet.delete(playerId); else newSet.add(playerId);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        const allPlayerIds = players.filter(p => p.role !== 'admin').map(p => p.id);
        const allSelected = allPlayerIds.length > 0 && allPlayerIds.every(id => selectedPlayerIds.has(id));
        if (allSelected) setSelectedPlayerIds(new Set()); else setSelectedPlayerIds(new Set(allPlayerIds));
    };

    const handleSave = async () => {
        if (!classId) return;
        if (!editingTitle.name) return alert('칭호 이름을 입력하세요.');
        if (editingTitle.type === 'auto' && !editingTitle.conditionId) return alert('자동 획득 칭호는 반드시 조건 ID를 입력해야 합니다.');

        try {
            if (editingTitle.id) {
                await updateTitle(classId, editingTitle.id, editingTitle);
                alert('칭호가 수정되었습니다.');
            } else {
                await createTitle(classId, editingTitle);
                alert('새로운 칭호가 생성되었습니다.');
            }
            setEditingTitle(null); fetchTitles();
        } catch (error) { alert(`저장 실패: ${error.message}`); }
    };

    const handleDelete = async (titleId, titleName) => {
        if (!classId) return;
        if (window.confirm(`'${titleName}' 칭호를 정말로 삭제하시겠습니까?`)) {
            try {
                await deleteTitle(classId, titleId);
                alert('칭호가 삭제되었습니다.'); fetchTitles();
            } catch (error) { alert(`삭제 실패: ${error.message}`); }
        }
    };

    const handleAssignTitle = async () => {
        if (!classId) return;
        if (selectedPlayerIds.size === 0) return alert('학생을 한 명 이상 선택하세요.');
        try {
            await grantTitleToPlayersBatch(classId, Array.from(selectedPlayerIds), isAssignMode);
            alert(`${selectedPlayerIds.size}명의 학생에게 칭호를 성공적으로 부여하고 500P 보상을 지급했습니다.`);
            setSelectedPlayerIds(new Set()); setIsAssignMode(null); fetchInitialData();
        } catch (error) { alert(`부여 실패: ${error.message}`); }
    };

    const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>칭호 관리 🎖️</SectionTitle>
                <StyledButton onClick={() => setEditingTitle({ name: '', icon: '', description: '', type: 'manual', color: '#000000' })} style={{ marginBottom: '1rem', alignSelf: 'flex-start' }}>
                    새 칭호 만들기
                </StyledButton>

                {editingTitle && (
                    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                        <InputGroup>
                            <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {['🏆', '🧠', '👑', '⚽', '🕊️', '⭐', '🌳', '💡', '🎤', '🏦', '🎵', '🧹', '🥇', '🥈', '🥉'].map(icon => (
                                    <button
                                        key={icon} onClick={() => setEditingTitle(p => ({ ...p, icon: icon }))}
                                        style={{ fontSize: '1.5rem', padding: '0.25rem', border: editingTitle.icon === icon ? '2px solid #007bff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer' }}
                                    >{icon}</button>
                                ))}
                                <input type="text" value={editingTitle.icon || ''} onChange={e => setEditingTitle(p => ({ ...p, icon: e.target.value }))} placeholder="직접 입력" style={{ width: '100px', padding: '0.5rem', fontSize: '1rem' }} maxLength="2" />
                            </div>
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 이름" value={editingTitle.name || ''} onChange={e => setEditingTitle(p => ({ ...p, name: e.target.value }))} style={{ flex: 3 }} />
                            <input type="color" value={editingTitle.color || '#000000'} onChange={e => setEditingTitle(p => ({ ...p, color: e.target.value }))} />
                        </InputGroup>
                        <InputGroup>
                            <input type="text" placeholder="칭호 설명 (획득 조건 등)" value={editingTitle.description || ''} onChange={e => setEditingTitle(p => ({ ...p, description: e.target.value }))} style={{ flex: 1 }} />
                        </InputGroup>
                        {editingTitle.type === 'auto' && (
                            <InputGroup>
                                <input type="text" placeholder="조건 ID (예: mission_30_completed)" value={editingTitle.conditionId || ''} onChange={e => setEditingTitle(p => ({ ...p, conditionId: e.target.value }))} style={{ flex: 1, backgroundColor: '#fffde7' }} />
                            </InputGroup>
                        )}
                        <InputGroup>
                            <select value={editingTitle.type || 'manual'} onChange={e => setEditingTitle(p => ({ ...p, type: e.target.value }))}>
                                <option value="manual">수동 획득</option>
                                <option value="auto">자동 획득</option>
                            </select>
                            <SaveButton onClick={handleSave}>저장</SaveButton>
                            <StyledButton onClick={() => setEditingTitle(null)}>취소</StyledButton>
                        </InputGroup>
                    </div>
                )}

                {isAssignMode && (
                    <div style={{ border: '1px solid #007bff', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4>'{titles.find(t => t.id === isAssignMode)?.name}' 칭호 부여하기</h4>
                            <StyledButton onClick={handleSelectAll}>전체 선택/해제</StyledButton>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '8px', padding: '1rem', backgroundColor: 'white', marginBottom: '1rem' }}>
                            {sortedPlayers.map(player => {
                                const isAdmin = player.role === 'admin';
                                const hasTitle = player.ownedTitles && player.ownedTitles.includes(isAssignMode);
                                const isDisabled = isAdmin || hasTitle;
                                return (
                                    <div key={player.id} title={isAdmin ? "관리자는 선택할 수 없습니다." : (hasTitle ? "이미 보유한 칭호입니다." : "")}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
                                            <input type="checkbox" checked={selectedPlayerIds.has(player.id)} onChange={() => !isDisabled && handlePlayerSelect(player.id)} style={{ width: '18px', height: '18px' }} disabled={isDisabled} />
                                            <span>{player.name} {hasTitle && '🎖️'}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                        <InputGroup style={{ justifyContent: 'flex-end' }}>
                            <SaveButton onClick={handleAssignTitle}>{selectedPlayerIds.size}명에게 부여</SaveButton>
                            <StyledButton onClick={() => setIsAssignMode(null)}>취소</StyledButton>
                        </InputGroup>
                    </div>
                )}

                <List style={{ maxHeight: 'none' }}>
                    {isLoading ? <p>로딩 중...</p> : titles.map(title => (
                        <ListItem key={title.id} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                            <span style={{ fontSize: '1.5rem' }}>{title.icon}</span>
                            <div>
                                <strong style={{ color: title.color || '#000000' }}>{title.name}</strong>
                                <p style={{ fontSize: '0.9rem', color: '#6c757d', margin: 0 }}>{title.description}</p>
                            </div>
                            <MissionControls>
                                <StyledButton onClick={() => { setIsAssignMode(title.id); setSelectedPlayerIds(new Set()) }}>칭호 주기</StyledButton>
                                <StyledButton onClick={() => setEditingTitle(title)} style={{ backgroundColor: '#ffc107', color: 'black' }}>수정</StyledButton>
                                <StyledButton onClick={() => handleDelete(title.id, title.name)} style={{ backgroundColor: '#dc3545' }}>삭제</StyledButton>
                            </MissionControls>
                        </ListItem>
                    ))}
                </List>
            </Section>
        </FullWidthSection>
    );
}

function TitleTab() {
    return <TitleManager />;
}

export default TitleTab;