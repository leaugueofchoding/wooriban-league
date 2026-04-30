// src/pages/admin/tabs/ClassTab.jsx

import React, { useState } from 'react';
import { useClassStore } from '../../../store/leagueStore';
import { createNewClass } from '../../../api/firebase';
import QRCode from 'react-qr-code';

// 분리된 스타일 파일에서 가져오기
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, InviteCodeWrapper, InviteCodeDisplay
} from '../Admin.style';

function ClassTab() {
    const { classId, classData, setClassId, setClassData } = useClassStore();
    const [newClassName, setNewClassName] = useState('');
    const [newClassGrade, setNewClassGrade] = useState('');
    const [isCreatingClass, setIsCreatingClass] = useState(false);

    const handleCreateClass = async () => {
        if (!newClassName.trim() || !newClassGrade.trim()) return alert('학년과 반 이름을 모두 입력해주세요.');
        if (window.confirm(`"${newClassName}" 반을 새로 개설하시겠습니까?`)) {
            setIsCreatingClass(true);
            try {
                const newClassId = await createNewClass(newClassName, newClassGrade);
                alert(`반 개설 완료! 초대 코드를 학생들에게 공유하세요.`);
                // 상태 업데이트는 createNewClass 내부 또는 리스너에서 처리되거나, 여기서 수동으로 store 업데이트
                // (기존 로직상 store 자동 업데이트가 안된다면 새로고침 필요할 수 있음)
                window.location.reload();
            } catch (error) {
                console.error("반 생성 실패:", error);
                alert(`반 생성 실패: ${error.message}`);
            } finally {
                setIsCreatingClass(false);
            }
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학급 관리</SectionTitle>

                {classId && classData ? (
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
                            🏫 {classData.grade}학년 {classData.name}반
                        </h3>
                        <p style={{ color: '#868e96', marginBottom: '2rem' }}>
                            학생들에게 아래 초대 코드 또는 QR코드를 공유하여 가입을 유도하세요.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                            <InviteCodeWrapper>
                                <span style={{ fontWeight: 'bold', color: '#868e96' }}>초대 코드:</span>
                                <InviteCodeDisplay>{classData.inviteCode}</InviteCodeDisplay>
                                <StyledButton onClick={() => {
                                    navigator.clipboard.writeText(classData.inviteCode);
                                    alert('초대 코드가 복사되었습니다!');
                                }}>복사</StyledButton>
                            </InviteCodeWrapper>

                            <div style={{ padding: '1.5rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <QRCode value={classData.inviteCode} size={180} />
                            </div>
                        </div>

                        <div style={{ marginTop: '3rem', padding: '1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #ffc9c9' }}>
                            <h4 style={{ color: '#fa5252', marginTop: 0 }}>⚠️ 위험 구역</h4>
                            <p style={{ fontSize: '0.9rem', color: '#495057' }}>
                                학급을 삭제하거나 초기화하면 모든 데이터(학생, 점수, 펫 등)가 영구적으로 삭제됩니다.
                                (현재 버전에서는 개발자에게 문의해주세요.)
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <h3>개설된 학급이 없습니다.</h3>
                        <p style={{ marginBottom: '2rem', color: '#868e96' }}>새로운 학급을 만들어 시작해보세요!</p>
                        <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <InputGroup style={{ justifyContent: 'center' }}>
                                <label>학년:</label>
                                <input
                                    type="number"
                                    value={newClassGrade}
                                    onChange={(e) => setNewClassGrade(e.target.value)}
                                    placeholder="예: 5"
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #dee2e6' }}
                                />
                            </InputGroup>
                            <InputGroup style={{ justifyContent: 'center' }}>
                                <label>반 이름:</label>
                                <input
                                    type="text"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    placeholder="예: 우리반 (또는 3)"
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #dee2e6' }}
                                />
                            </InputGroup>
                            <StyledButton
                                onClick={handleCreateClass}
                                disabled={isCreatingClass}
                                style={{ backgroundColor: '#20c997', padding: '1rem' }}
                            >
                                {isCreatingClass ? '생성 중...' : '✨ 학급 개설하기'}
                            </StyledButton>
                        </div>
                    </div>
                )}
            </Section>
        </FullWidthSection>
    );
}

export default ClassTab;