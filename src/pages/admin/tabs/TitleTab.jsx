// src/pages/admin/tabs/TitleTab.jsx

import React, { useState, useEffect } from 'react';
import styled from 'styled-components'; // 내부 스타일링용 (필요시)
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import {
    getTitles, createTitle, updateTitle, deleteTitle, grantTitleToPlayersBatch
} from '../../../api/firebase';

// 분리된 공통 스타일 불러오기
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, SaveButton
} from '../Admin.style';

function TitleTab() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [titles, setTitles] = useState([]);
    const [newTitleName, setNewTitleName] = useState('');
    const [newTitleColor, setNewTitleColor] = useState('#339af0'); // 기본 파란색
    const [selectedTitleId, setSelectedTitleId] = useState('');
    const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
    const [isGranting, setIsGranting] = useState(false);

    // 칭호 목록 불러오기
    const fetchTitles = async () => {
        if (!classId) return;
        try {
            const data = await getTitles(classId);
            setTitles(data);
        } catch (error) {
            console.error("칭호 불러오기 실패:", error);
        }
    };

    useEffect(() => {
        fetchTitles();
    }, [classId]);

    // 칭호 생성 핸들러
    const handleCreateTitle = async () => {
        if (!newTitleName.trim()) return alert('칭호 이름을 입력해주세요.');
        if (!classId) return;

        try {
            await createTitle(classId, { name: newTitleName, color: newTitleColor });
            setNewTitleName('');
            fetchTitles(); // 목록 갱신
            alert('새로운 칭호가 생성되었습니다!');
        } catch (error) {
            console.error(error);
            alert('칭호 생성 실패');
        }
    };

    // 칭호 삭제 핸들러
    const handleDeleteTitle = async (titleId) => {
        if (!window.confirm('정말 이 칭호를 삭제하시겠습니까? (이미 부여받은 학생들의 칭호도 사라질 수 있습니다)')) return;
        try {
            await deleteTitle(classId, titleId);
            fetchTitles();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    // 칭호 수여 핸들러 (다중 선택 가능)
    const handleGrantTitle = async () => {
        if (!selectedTitleId) return alert('수여할 칭호를 선택해주세요.');
        if (selectedPlayerIds.length === 0) return alert('학생을 한 명 이상 선택해주세요.');

        setIsGranting(true);
        try {
            const titleToGrant = titles.find(t => t.id === selectedTitleId);
            if (!titleToGrant) return;

            await grantTitleToPlayersBatch(classId, selectedPlayerIds, titleToGrant);
            alert(`${selectedPlayerIds.length}명의 학생에게 "${titleToGrant.name}" 칭호를 수여했습니다!`);
            setSelectedPlayerIds([]); // 선택 초기화
        } catch (error) {
            console.error(error);
            alert('칭호 수여 중 오류가 발생했습니다.');
        } finally {
            setIsGranting(false);
        }
    };

    // 학생 선택 체크박스 핸들러
    const togglePlayerSelection = (playerId) => {
        setSelectedPlayerIds(prev =>
            prev.includes(playerId)
                ? prev.filter(id => id !== playerId)
                : [...prev, playerId]
        );
    };

    const handleSelectAll = () => {
        if (selectedPlayerIds.length === players.length) {
            setSelectedPlayerIds([]);
        } else {
            setSelectedPlayerIds(players.map(p => p.id));
        }
    };

    return (
        <>
            {/* 1. 칭호 생성 섹션 */}
            <FullWidthSection>
                <Section>
                    <SectionTitle>칭호(Badge) 관리 🎖️</SectionTitle>
                    <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                        <h4 style={{ marginTop: 0 }}>새 칭호 만들기</h4>
                        <InputGroup>
                            <label>이름:</label>
                            <input
                                type="text"
                                value={newTitleName}
                                onChange={(e) => setNewTitleName(e.target.value)}
                                placeholder="예: 가가볼 MVP, 독서왕"
                                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #dee2e6' }}
                            />
                            <label>색상:</label>
                            <input
                                type="color"
                                value={newTitleColor}
                                onChange={(e) => setNewTitleColor(e.target.value)}
                                style={{ height: '38px', cursor: 'pointer' }}
                            />
                            <SaveButton onClick={handleCreateTitle}>생성</SaveButton>
                        </InputGroup>

                        {/* 생성된 칭호 목록 */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            {titles.map(title => (
                                <span key={title.id} style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '20px',
                                    background: title.color || '#eee',
                                    color: '#fff',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    {title.name}
                                    <button
                                        onClick={() => handleDeleteTitle(title.id)}
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            {titles.length === 0 && <span style={{ color: '#adb5bd' }}>생성된 칭호가 없습니다.</span>}
                        </div>
                    </div>

                    {/* 2. 칭호 수여 섹션 */}
                    <div>
                        <SectionTitle style={{ fontSize: '1.1rem', borderBottom: 'none' }}>칭호 수여하기 🎁</SectionTitle>
                        <InputGroup style={{ marginBottom: '1.5rem' }}>
                            <select
                                value={selectedTitleId}
                                onChange={(e) => setSelectedTitleId(e.target.value)}
                                style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #dee2e6', minWidth: '200px' }}
                            >
                                <option value="">수여할 칭호 선택...</option>
                                {titles.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                            <StyledButton
                                onClick={handleGrantTitle}
                                disabled={!selectedTitleId || selectedPlayerIds.length === 0 || isGranting}
                                style={{ backgroundColor: '#fd7e14' }}
                            >
                                {isGranting ? '수여 중...' : '선택한 학생에게 수여'}
                            </StyledButton>
                        </InputGroup>

                        {/* 학생 선택 리스트 */}
                        <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ padding: '0.8rem', background: '#f1f3f5', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>학생 목록 ({selectedPlayerIds.length}명 선택됨)</span>
                                <button
                                    onClick={handleSelectAll}
                                    style={{ background: 'none', border: 'none', color: '#339af0', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {selectedPlayerIds.length === players.length ? '전체 해제' : '전체 선택'}
                                </button>
                            </div>
                            <List style={{ maxHeight: '400px', border: 'none' }}>
                                {players.map(player => (
                                    <ListItem key={player.id} style={{ gridTemplateColumns: 'auto 1fr', gap: '1rem', padding: '0.8rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPlayerIds.includes(player.id)}
                                            onChange={() => togglePlayerSelection(player.id)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <strong>{player.name}</strong>
                                            {/* 학생이 이미 가진 칭호 보여주기 */}
                                            {player.titles && player.titles.map((t, i) => (
                                                <span key={i} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: t.color, color: 'white' }}>
                                                    {t.name}
                                                </span>
                                            ))}
                                        </div>
                                    </ListItem>
                                ))}
                            </List>
                        </div>
                    </div>
                </Section>
            </FullWidthSection>
        </>
    );
}

export default TitleTab;