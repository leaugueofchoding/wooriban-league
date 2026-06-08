// src/pages/admin/tabs/ClassTab.jsx

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import { auth, db, createNewClass, getBattleEnabled, setBattleEnabled, saveClassSchedules, getClassSchedules } from '../../../api/firebase';
import { collection, query, where, getDocs, collectionGroup, limit, doc, setDoc } from "firebase/firestore";
import QRCode from 'react-qr-code';
import { FullWidthSection, Section, SectionTitle, InputGroup, StyledButton } from '../Admin.style';

// --- 학급 탭 전용 스타일 ---
const ClassGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;
`;
const ClassCard = styled.div`
  padding: 1.5rem; border-radius: 12px; background-color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: pointer; transition: all 0.2s ease-in-out; border: 3px solid ${props => props.$isActive ? '#007bff' : 'transparent'};
  &:hover { transform: translateY(-5px); box-shadow: 0 6px 16px rgba(0,0,0,0.12); }
  h3 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
  p { margin: 0; color: #6c757d; }
`;
const AddClassCard = styled(ClassCard)`
  display: flex; flex-direction: column; justify-content: center; align-items: center; border-style: dashed; border-color: #ced4da; color: #6c757d;
  &:hover { border-color: #007bff; color: #007bff; }
  .plus-icon { font-size: 3rem; font-weight: 300; line-height: 1; margin-bottom: 0.5rem; }
`;
const QRCodeSection = styled.div`
    margin-top: 2rem; padding: 2rem; border-radius: 8px; background-color: #fff; border: 1px solid #dee2e6;
`;
const InviteCodeWrapper = styled.div`
    display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1.5rem; border: 2px dashed #007bff; border-radius: 8px; background-color: #f0f8ff; margin-top: 1.5rem;
`;
const InviteCodeDisplay = styled.div`
    font-size: 1.8rem; font-weight: bold; color: #0056b3; background-color: #fff; padding: 0.5rem 1.5rem; border-radius: 8px; border: 1px solid #bce0fd; cursor: pointer;
    &:hover { background-color: #e9f5ff; }
`;

function ClassManager() {
    const { classId, setClassId } = useClassStore();
    const { initializeClass } = useLeagueStore();
    const currentUser = auth.currentUser;

    const [allClasses, setAllClasses] = useState([]);
    const [ghostClasses, setGhostClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [selectedClassForQR, setSelectedClassForQR] = useState(null);
    const [manualId, setManualId] = useState('');
    const [battleEnabled, setBattleEnabledState] = useState(true);
    const [battleToggleLoading, setBattleToggleLoading] = useState(false);
    // 수업 시간표
    const [schedules, setSchedules] = useState([]); // [{label, start, end}]
    const [schedSaving, setSchedSaving] = useState(false);

    // 배틀 ON/OFF 상태 로드
    useEffect(() => {
        if (!classId) return;
        getBattleEnabled(classId).then(v => setBattleEnabledState(v));
    }, [classId]);

    // 수업 시간표 로드
    useEffect(() => {
        if (!classId) return;
        getClassSchedules(classId).then(s => setSchedules(s.length ? s : [{ label: '1교시', start: '09:00', end: '09:40' }]));
    }, [classId]);

    const addScheduleRow = () => setSchedules(prev => [...prev, { label: '', start: '', end: '' }]);
    const removeScheduleRow = (i) => setSchedules(prev => prev.filter((_, idx) => idx !== i));
    const updateScheduleRow = (i, field, val) => setSchedules(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
    const handleSaveSchedules = async () => {
        setSchedSaving(true);
        try {
            await saveClassSchedules(classId, schedules);
            alert('시간표가 저장되었습니다. 학생들이 접속하면 수업 1분 전 알림을 받습니다.');
        } catch (e) { alert('저장 실패: ' + e.message); }
        setSchedSaving(false);
    };

    const handleToggleBattle = async () => {
        if (!classId) return alert('학급을 먼저 선택해주세요.');
        setBattleToggleLoading(true);
        try {
            const next = !battleEnabled;
            await setBattleEnabled(classId, next);
            setBattleEnabledState(next);
        } catch (e) {
            alert('배틀 설정 변경 실패: ' + e.message);
        } finally {
            setBattleToggleLoading(false);
        }
    };

    const isSuperAdmin = currentUser?.uid === 'Zz6fKdtg00Yb3ju5dibOgkJkWS52';

    const fetchAllClasses = useCallback(async () => {
        if (!currentUser) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const classesRef = collection(db, "classes");
            let q;
            if (isSuperAdmin) { q = query(classesRef); }
            else { q = query(classesRef, where("adminId", "==", currentUser.uid)); }
            const querySnapshot = await getDocs(q);
            const classes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllClasses(classes);

            if (classes.length > 0 && classId && classes.some(c => c.id === classId)) {
                setSelectedClassForQR(classes.find(c => c.id === classId));
            } else { setSelectedClassForQR(null); }
        } catch (error) { console.error("학급 로딩 실패:", error); }
        finally { setIsLoading(false); }
    }, [currentUser, classId, isSuperAdmin]);

    const scanForGhostClasses = async () => {
        if (!isSuperAdmin) return;
        setIsLoading(true);
        try {
            const playersQuery = query(collectionGroup(db, 'players'), limit(100));
            const snapshot = await getDocs(playersQuery);
            const foundClassIds = new Set();
            snapshot.forEach(doc => { if (doc.ref.parent && doc.ref.parent.parent) { foundClassIds.add(doc.ref.parent.parent.id); } });
            const existingIds = allClasses.map(c => c.id);
            const ghosts = Array.from(foundClassIds).filter(id => !existingIds.includes(id));
            setGhostClasses(ghosts);
            if (ghosts.length > 0) alert(`👻 유령 학급 ${ghosts.length}개 발견!`);
            else alert("발견된 유령 학급이 없습니다.");
        } catch (e) { alert("스캔 오류: " + e.message); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchAllClasses(); }, [fetchAllClasses]);

    const handleClassCardClick = (cls) => {
        if (isSuperAdmin && cls.adminId !== currentUser?.uid) {
            if (!window.confirm(`[슈퍼 관리자] '${cls.name || cls.id}' 반으로 이동합니까?`)) return;
        }
        if (cls.id !== classId) { setClassId(cls.id); initializeClass(cls.id); }
        setSelectedClassForQR(cls);
    };

    const resurrectClass = async (targetId) => {
        if (!window.confirm(`학급 ID [${targetId}]를 복구하시겠습니까?\n(초대 코드가 새로 발급됩니다)`)) return;
        try {
            const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            await setDoc(doc(db, "classes", targetId), {
                name: `(복구됨) ${targetId.substring(0, 6)}...`,
                adminId: currentUser.uid,
                createdAt: new Date(),
                inviteCode: randomCode,
                status: 'restored'
            }, { merge: true });

            alert(`✅ 복구 완료! 초대 코드: [${randomCode}]`);
            fetchAllClasses();
            setGhostClasses(prev => prev.filter(id => id !== targetId));
        } catch (e) { alert("복구 실패: " + e.message); }
    };

    const handleCreateClass = async () => {
        if (!newClassName.trim()) return alert("이름을 입력하세요");
        try {
            const { classId: newId, name, inviteCode } = await createNewClass(newClassName, currentUser);
            alert("생성 완료");
            await fetchAllClasses();
            handleClassCardClick({ id: newId, name, inviteCode });
            setNewClassName(''); setIsCreating(false);
        } catch (e) { alert(e.message); }
    };

    const handleCopyToClipboard = (t) => {
        navigator.clipboard.writeText(t).then(() => alert('초대 코드가 복사되었습니다.'));
    };

    const btnStyle = { padding: '10px 15px', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>{isSuperAdmin ? "🏫 슈퍼 관리자 학급 제어" : "🏫 학급 관리"}</SectionTitle>

                {isSuperAdmin && (
                    <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #adb5bd' }}>
                        <h4 style={{ marginTop: 0 }}>🛠️ 슈퍼 관리자 도구</h4>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button onClick={scanForGhostClasses} style={{ ...btnStyle, background: '#6f42c1' }}>👻 유령 학급 스캔</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input type="text" placeholder="학급 ID 입력" value={manualId} onChange={e => setManualId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                                <button onClick={() => manualId && resurrectClass(manualId)} style={{ ...btnStyle, background: '#20c997' }}>🚑 강제 복구</button>
                            </div>
                        </div>
                        {ghostClasses.length > 0 && (
                            <ul style={{ marginTop: '10px' }}>
                                {ghostClasses.map(gid => (
                                    <li key={gid}>{gid} <button onClick={() => resurrectClass(gid)} style={{ marginLeft: '10px', cursor: 'pointer' }}>복구</button></li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <ClassGrid>
                    {allClasses.map(cls => (
                        <ClassCard key={cls.id} $isActive={cls.id === classId} onClick={() => handleClassCardClick(cls)} style={isSuperAdmin && cls.adminId !== currentUser?.uid ? { borderColor: 'orange', borderStyle: 'dashed' } : {}}>
                            <h3>{cls.name || '(이름 없음)'}</h3>
                            <p>{cls.id === classId ? "✅ 현재 접속 중" : "클릭하여 관리"}</p>
                        </ClassCard>
                    ))}
                    <AddClassCard onClick={() => setIsCreating(true)}>
                        <span className="plus-icon">+</span>
                        <h3>새 학급 만들기</h3>
                    </AddClassCard>
                </ClassGrid>

                {isCreating && (
                    <InputGroup style={{ marginTop: '1rem' }}>
                        <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="새 학급 이름" style={{ flex: 1, padding: '0.5rem' }} />
                        <StyledButton onClick={handleCreateClass} style={{ backgroundColor: '#28a745' }}>생성</StyledButton>
                        <StyledButton onClick={() => setIsCreating(false)} style={{ background: '#6c757d' }}>취소</StyledButton>
                    </InputGroup>
                )}

                {selectedClassForQR && (
                    <QRCodeSection>
                        <h3>'{selectedClassForQR.name}' 초대 정보</h3>
                        <InviteCodeWrapper>
                            <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
                                {typeof QRCode !== 'undefined' ? (
                                    <QRCode value={`${window.location.origin}/join?inviteCode=${selectedClassForQR.inviteCode || ''}`} size={128} />
                                ) : <div style={{ width: 128, height: 128, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>QR</div>}
                            </div>
                            <InviteCodeDisplay onClick={() => handleCopyToClipboard(selectedClassForQR.inviteCode)} title="클릭하여 복사">
                                {selectedClassForQR.inviteCode || '(코드 없음)'}
                            </InviteCodeDisplay>
                            <small>학생들에게 위 QR코드를 보여주거나 초대 코드를 알려주세요.</small>
                        </InviteCodeWrapper>
                    </QRCodeSection>
                )}

                {/* ▼▼▼ [추가] 배틀 기능 ON/OFF 토글 ▼▼▼ */}
                {classId && (
                    <div style={{ marginTop: '1.5rem', padding: '1.2rem 1.5rem', background: 'white', borderRadius: '12px', border: '1px solid #dee2e6', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            ⚔️ 펫 배틀 기능 관리
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                padding: '0.6rem 1rem', borderRadius: '10px',
                                background: battleEnabled ? '#ebfbee' : '#fff5f5',
                                border: `1px solid ${battleEnabled ? '#51cf66' : '#ffc9c9'}`,
                            }}>
                                <span style={{ fontSize: '1.3rem' }}>{battleEnabled ? '🟢' : '🔴'}</span>
                                <span style={{ fontWeight: 800, color: battleEnabled ? '#2f9e44' : '#c92a2a', fontSize: '0.95rem' }}>
                                    배틀 {battleEnabled ? '활성화됨' : '비활성화됨'}
                                </span>
                            </div>
                            <button
                                onClick={handleToggleBattle}
                                disabled={battleToggleLoading}
                                style={{
                                    padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none',
                                    background: battleEnabled ? '#fa5252' : '#20c997',
                                    color: 'white', fontWeight: 800, fontSize: '0.95rem',
                                    cursor: battleToggleLoading ? 'not-allowed' : 'pointer',
                                    opacity: battleToggleLoading ? 0.7 : 1,
                                }}
                            >
                                {battleToggleLoading ? '처리 중...' : battleEnabled ? '⛔ 배틀 중지' : '✅ 배틀 재개'}
                            </button>
                            <small style={{ color: '#868e96' }}>
                                {battleEnabled
                                    ? '현재 학생들이 배틀 가능 | 주말에는 자동으로 차단됩니다.'
                                    : '학생들이 배틀을 신청할 수 없습니다.'}
                            </small>
                        </div>
                    </div>
                )}
                {/* ▲▲▲ [추가 끝] ▲▲▲ */}

                {/* ─── 수업 시간표 설정 ─── */}
                {classId && (
                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #dee2e6' }}>
                        <h4 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: 800, color: '#212529' }}>🕐 수업 시간표 설정</h4>
                        <small style={{ color: '#868e96', display: 'block', marginBottom: '1rem' }}>
                            수업 시작 1분 전에 접속 중인 학생들에게 자동 팝업 알림을 보냅니다.
                        </small>
                        {schedules.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                    type="text" placeholder="이름(예:1교시)" value={s.label}
                                    onChange={e => updateScheduleRow(i, 'label', e.target.value)}
                                    style={{ width: '90px', padding: '0.4rem 0.6rem', border: '1px solid #ced4da', borderRadius: '8px', fontSize: '0.88rem' }}
                                />
                                <input
                                    type="time" value={s.start}
                                    onChange={e => updateScheduleRow(i, 'start', e.target.value)}
                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #ced4da', borderRadius: '8px', fontSize: '0.88rem' }}
                                />
                                <span style={{ color: '#868e96', fontSize: '0.85rem' }}>~</span>
                                <input
                                    type="time" value={s.end}
                                    onChange={e => updateScheduleRow(i, 'end', e.target.value)}
                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #ced4da', borderRadius: '8px', fontSize: '0.88rem' }}
                                />
                                <button onClick={() => removeScheduleRow(i)}
                                    style={{ background: '#fff5f5', border: '1px solid #ffc9c9', color: '#fa5252', borderRadius: '8px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    ✕
                                </button>
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                            <button onClick={addScheduleRow}
                                style={{ padding: '0.5rem 1rem', background: '#e7f5ff', border: '1px solid #74c0fc', color: '#1c7ed6', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700 }}>
                                + 교시 추가
                            </button>
                            <button onClick={handleSaveSchedules} disabled={schedSaving}
                                style={{ padding: '0.5rem 1.2rem', background: schedSaving ? '#dee2e6' : '#339af0', border: 'none', color: '#fff', borderRadius: '8px', cursor: schedSaving ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: 800 }}>
                                {schedSaving ? '저장 중...' : '💾 저장'}
                            </button>
                        </div>
                    </div>
                )}
            </Section>
        </FullWidthSection>
    );
}

function ClassTab() {
    return <ClassManager />;
}

export default ClassTab;