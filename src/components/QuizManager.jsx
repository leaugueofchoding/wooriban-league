// src/components/QuizManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { createQuizSet, getQuizSets, deleteQuizSet, setClassActiveQuizSets, getActiveQuizSets, auth } from '../api/firebase';
import { useClassStore } from '../store/leagueStore';
import allQuizzesJson from '../assets/missions.json';  // [추가] JSON 기반 문제집 이관용

// --- 스타일 컴포넌트 ---
const Wrapper = styled.div`
  padding: 1rem; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
`;
const Section = styled.div`
  background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; border: 1px solid #e9ecef;
`;
const TitleInput = styled.input`
  width: 100%; padding: 0.8rem; font-size: 1.2rem; font-weight: bold; border: 2px solid #007bff; border-radius: 8px; margin-bottom: 1rem;
`;
const InputGroup = styled.div`
  margin-bottom: 1rem;
  label { display: block; font-weight: bold; margin-bottom: 0.5rem; color: #495057; }
  input, select, textarea { width: 100%; padding: 0.6rem; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.95rem; }
`;
const Button = styled.button`
  padding: 0.6rem 1.2rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; color: white;
  background-color: ${props => props.color || '#007bff'};
  transition: all 0.2s;
  &:hover:not(:disabled) { filter: brightness(0.9); }
  &:disabled { background-color: #ccc; cursor: not-allowed; }
`;
const QuizList = styled.div` display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; `;
const QuizCard = styled.div`
  border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; background: ${props => props.$isEditing ? '#fff9e6' : 'white'}; position: relative;
  border-left: 5px solid ${props => props.type === 'ox' ? '#ff6b6b' : (props.type === 'multiple' ? '#51cf66' : '#339af0')};
  transition: background-color 0.2s;
`;
const Tag = styled.span`
  background: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; color: #495057; margin-right: 0.5rem; display: inline-block; margin-bottom: 0.3rem;
`;
const SearchBar = styled.div`
  display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;
  select, input { padding: 0.5rem; border: 1px solid #ced4da; border-radius: 6px; }
  input { flex-grow: 1; }
`;

const ModalOverlay = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px;
`;
const ModalContent = styled.div`
  background: white; width: 100%; max-width: 700px; max-height: 85vh; border-radius: 16px; 
  display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;
const ModalHeader = styled.div`
  padding: 1.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: flex-start;
  h2 { margin: 0; font-size: 1.4rem; color: #343a40; line-height: 1.3; }
`;
const ModalBody = styled.div`
  padding: 1.5rem; overflow-y: auto; flex: 1; background: #fdfdfd;
`;
const ModalFooter = styled.div`
  padding: 1rem 1.5rem; border-top: 1px solid #eee; display: flex; gap: 0.5rem; justify-content: flex-end; background: white;
`;
const PreviewItem = styled.div`
  margin-bottom: 1.2rem; padding: 1rem; background: white; border: 1px solid #e9ecef; border-radius: 10px;
  .q-header { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; font-weight: bold; color: #495057; }
  .q-answer { color: #dc3545; font-weight: bold; margin-top: 0.5rem; font-size: 0.95rem; padding-top: 0.5rem; border-top: 1px dashed #eee; }
`;
const PaginationContainer = styled.div`
  display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 2.5rem; width: 100%; grid-column: 1 / -1;
`;
const PageButton = styled.button`
  padding: 0.5rem 1rem; border: 1px solid #dee2e6; border-radius: 4px;
  background-color: ${props => props.$isActive ? '#007bff' : 'white'};
  color: ${props => props.$isActive ? 'white' : 'black'};
  font-weight: bold; cursor: pointer; transition: all 0.2s;
  &:hover:not(:disabled) { background-color: ${props => props.$isActive ? '#0056b3' : '#f1f3f5'}; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;

const DATA_MATH = [];
const DATA_COMMON = [];
const DATA_SCIENCE = [];
const DATA_HISTORY = [];
const DATA_NONSENSE = [];
const DATA_PROVERB = [];
const DATA_KPOP = [];
const DATA_KOREAN = [];
const DATA_SPORTS = [];

function QuizManager({ userRole }) {
    const { classId } = useClassStore();
    const currentUser = auth.currentUser;

    const [mode, setMode] = useState('list');
    const [quizSets, setQuizSets] = useState([]);
    const [activeSetIds, setActiveSetIds] = useState([]);
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [selectedSet, setSelectedSet] = useState(null);

    const [filterGrade, setFilterGrade] = useState('all');
    const [filterSubject, setFilterSubject] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 9;

    const [newSetInfo, setNewSetInfo] = useState({ title: '', grade: 'common', semester: 'common', subject: 'general', isPublic: true });
    const [questions, setQuestions] = useState([]);

    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [qType, setQType] = useState('multiple');
    const [qText, setQText] = useState('');
    const [qOptions, setQOptions] = useState(['', '', '', '']);
    const [qAnswer, setQAnswer] = useState('');
    const [qScore, setQScore] = useState(10);

    const currentIndex = editingQuestionId ? questions.findIndex(q => q.id === editingQuestionId) : -1;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterGrade, filterSubject]);

    useEffect(() => {
        fetchQuizSets();
        fetchCurrentClassQuizzes();
    }, [currentUser, classId]);

    const fetchQuizSets = async () => {
        if (!currentUser) return;
        const data = await getQuizSets(currentUser.uid, userRole === 'admin');
        setQuizSets(data);
    };

    const fetchCurrentClassQuizzes = async () => {
        if (!classId) return;
        const activeSets = await getActiveQuizSets(classId);
        setActiveSetIds(activeSets.map(s => s.id));
    };

    const handleEditQuestionClick = (q) => {
        setEditingQuestionId(q.id);
        setQType(q.type);
        setQText(q.question);
        setQAnswer(q.answer);
        setQOptions(q.options || ['', '', '', '']);
        setQScore(q.score || 10);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    // ▼▼▼ [수정] 문제 추가/수정 후 입력창 유지 ▼▼▼
    const handleAddQuestion = () => {
        if (!qText) return alert("문제를 입력하세요.");
        if (!qAnswer) return alert("정답을 입력하세요.");
        if (qType === 'multiple' && qOptions.some(opt => !opt.trim())) return alert("객관식 보기를 모두 입력해주세요.");

        const newId = editingQuestionId || Date.now();
        const newQuestion = {
            id: newId,
            type: qType,
            question: qText,
            answer: qAnswer,
            score: Number(qScore),
            options: qType === 'multiple' ? qOptions : null
        };

        if (editingQuestionId) {
            // 수정 모드
            setQuestions(questions.map(q => q.id === editingQuestionId ? newQuestion : q));
            // 수정 후에도 계속 해당 문제를 가리키게 하여 이전/다음 버튼을 쓸 수 있게 함
        } else {
            // 새 문제 추가 모드
            setQuestions([...questions, newQuestion]);
            setEditingQuestionId(newId); // 방금 만든 문제를 '수정 중'인 상태로 만들어 줌
        }

        // 팝업 띄우기 (입력창은 안 비움)
        alert('문제가 리스트에 반영되었습니다.');
    };

    // ▼▼▼ [신규] 아예 빈 칸으로 만들고 새 문제 작성하기 ▼▼▼
    const handlePrepareNewQuestion = () => {
        setEditingQuestionId(null);
        setQText('');
        setQAnswer('');
        setQOptions(['', '', '', '']);
        setQScore(10);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const handleNavigate = (direction) => {
        if (currentIndex === -1) return;

        const targetIndex = currentIndex + direction;
        if (targetIndex < 0 || targetIndex >= questions.length) return;

        if (!qText) return alert("문제를 입력하세요.");
        if (!qAnswer) return alert("정답을 입력하세요.");
        if (qType === 'multiple' && qOptions.some(opt => !opt.trim())) return alert("객관식 보기를 모두 입력해주세요.");

        const updatedQuestion = {
            id: editingQuestionId,
            type: qType,
            question: qText,
            answer: qAnswer,
            score: Number(qScore),
            options: qType === 'multiple' ? qOptions : null
        };

        const newQuestions = questions.map(q => q.id === editingQuestionId ? updatedQuestion : q);
        setQuestions(newQuestions);

        const targetQ = newQuestions[targetIndex];
        setEditingQuestionId(targetQ.id);
        setQType(targetQ.type);
        setQText(targetQ.question);
        setQAnswer(targetQ.answer);
        setQOptions(targetQ.options || ['', '', '', '']);
        setQScore(targetQ.score || 10);
    };

    const handleCancelEdit = () => {
        setEditingQuestionId(null);
        setQText(''); setQAnswer(''); setQOptions(['', '', '', '']); setQScore(10);
    };

    const handleRemoveQuestion = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
        if (editingQuestionId === id) handleCancelEdit();
    };

    const handleSaveQuizSet = async () => {
        if (!newSetInfo.title) return alert("제목을 입력하세요.");
        if (questions.length === 0) return alert("문제를 추가해주세요.");
        if (!window.confirm(`총 ${questions.length}문제로 저장하시겠습니까?`)) return;

        try {
            await createQuizSet({
                ...newSetInfo,
                questions: questions,
                creatorId: currentUser.uid,
                creatorName: currentUser.displayName || '선생님'
            });
            alert("저장 완료!");
            setMode('list');
            fetchQuizSets();
            setNewSetInfo({ title: '', grade: 'common', semester: 'common', subject: 'general', isPublic: true });
            setQuestions([]);
        } catch (e) { alert(e.message); }
    };

    const handleCloneAndEdit = (set) => {
        setNewSetInfo({
            title: set.title + " (복사본)",
            grade: set.grade,
            semester: set.semester,
            subject: set.subject,
            isPublic: false
        });
        const clonedQuestions = set.questions.map((q, idx) => ({
            ...q,
            id: Date.now() + idx + Math.random()
        }));
        setQuestions(clonedQuestions);
        setEditingQuestionId(null);
        setMode('create');
        setSelectedSet(null);
    };

    const handleMigrateLegacy = async () => {
        if (!window.confirm("하드코딩된 퀴즈들을 주제별 문제집으로 분리하여 DB에 저장하시겠습니까?")) return;
        try {
            const createLegacySet = async (data, title, subject, grade = 'common') => {
                if (data.length === 0) return;
                await createQuizSet({
                    title, grade, semester: 'common', subject, isPublic: true,
                    creatorId: "system", creatorName: "운영자",
                    questions: data.map((q, idx) => ({ ...q, id: Date.now() + idx + Math.random() }))
                });
            };
            await createLegacySet(DATA_MATH, "🧮 [6-2] 수학 퀴즈 모음", "math", "6");
            await createLegacySet(DATA_COMMON, "📢 [상식] 알쓸신잡 기본상식", "general");
            await createLegacySet(DATA_SCIENCE, "🔬 [과학] 알쏭달쏭 과학상식", "science");
            await createLegacySet(DATA_HISTORY, "📜 [역사] 한국사 인물 퀴즈", "history");
            await createLegacySet(DATA_NONSENSE, "🤣 [재미] 넌센스 퀴즈", "general");
            await createLegacySet(DATA_PROVERB, "💬 [속담] 속담 빈칸 채우기", "korean");
            await createLegacySet(DATA_KPOP, "🎵 [K-POP] 아이돌 퀴즈", "other");
            await createLegacySet(DATA_KOREAN, "🇰🇷 [우리말] 맞춤법 퀴즈", "korean");
            await createLegacySet(DATA_SPORTS, "⚽ [스포츠] 열혈 스포츠 퀴즈", "other");
            alert("모든 주제별 퀴즈집 생성이 완료되었습니다!");
            fetchQuizSets();
        } catch (e) { alert("이관 실패: " + e.message); }
    };

    // ▼▼▼ [추가] missions.json 기반 문제집 선택 추가 ▼▼▼
    const [showJsonImporter, setShowJsonImporter] = useState(false);
    const [jsonImportChecked, setJsonImportChecked] = useState({});

    const jsonSetNames = Object.keys(allQuizzesJson);

    const handleJsonImport = async () => {
        const selected = jsonSetNames.filter(name => jsonImportChecked[name]);
        if (selected.length === 0) return alert('추가할 문제집을 하나 이상 선택해주세요.');
        if (!window.confirm(`선택한 ${selected.length}개의 문제집을 DB에 추가하시겠습니까?`)) return;
        try {
            for (const name of selected) {
                const questions = allQuizzesJson[name];
                if (!Array.isArray(questions) || questions.length === 0) continue;
                await createQuizSet({
                    title: name,
                    grade: 'common', semester: 'common', subject: 'general', isPublic: true,
                    creatorId: 'system', creatorName: '운영자',
                    questions: questions.map((q, idx) => ({
                        id: Date.now() + idx + Math.random(),
                        question: q.question,
                        answer: q.answer,
                        options: q.options || [],
                    }))
                });
            }
            alert(`✅ ${selected.length}개 문제집 추가 완료!`);
            setJsonImportChecked({});
            setShowJsonImporter(false);
            fetchQuizSets();
        } catch (e) {
            alert('추가 실패: ' + e.message);
        }
    };
    // ▲▲▲ [추가 끝] ▲▲▲

    const handleCheck = (id) => {
        setCheckedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (checkedIds.size === filteredQuizSets.length) setCheckedIds(new Set());
        else setCheckedIds(new Set(filteredQuizSets.map(s => s.id)));
    };

    const handleBatchPublish = async (isAddMode) => {
        if (!classId) return alert("학급을 먼저 선택해주세요.");
        if (checkedIds.size === 0) return alert("선택된 문제집이 없습니다.");
        const selectedList = Array.from(checkedIds);
        let newActiveIds = isAddMode ? Array.from(new Set([...activeSetIds, ...selectedList])) : selectedList;
        if (!window.confirm(`선택한 ${selectedList.length}개의 문제집을 ${isAddMode ? '추가' : '설정'}하시겠습니까?`)) return;
        try {
            await setClassActiveQuizSets(classId, newActiveIds);
            setActiveSetIds(newActiveIds);
            setCheckedIds(new Set());
            alert("출제 설정이 완료되었습니다!");
        } catch (e) { alert(e.message); }
    };

    const handleBatchDelete = async () => {
        if (checkedIds.size === 0) return alert("삭제할 문제집을 선택해주세요.");
        const targets = quizSets.filter(s => checkedIds.has(s.id));
        const deletableTargets = targets.filter(s => s.creatorId === currentUser?.uid || (userRole === 'admin' && s.creatorId === 'system'));
        if (deletableTargets.length === 0) return alert("삭제 권한이 있는 내 문제집이 없습니다.");
        if (!window.confirm(`선택한 ${deletableTargets.length}개의 문제집을 영구 삭제하시겠습니까?`)) return;
        try {
            await Promise.all(deletableTargets.map(s => deleteQuizSet(s.id)));
            alert(`${deletableTargets.length}개의 문제집이 삭제되었습니다.`);
            fetchQuizSets(); fetchCurrentClassQuizzes(); setCheckedIds(new Set());
        } catch (e) { alert("삭제 중 오류 발생: " + e.message); }
    };

    const handleToggleSingle = async (id, title) => {
        if (!classId) return;
        const isActive = activeSetIds.includes(id);
        let newIds = isActive ? activeSetIds.filter(sid => sid !== id) : [...activeSetIds, id];
        if (!confirm(`'${title}' ${isActive ? '출제를 취소' : '출제 목록에 추가'}하시겠습니까?`)) return;
        try {
            await setClassActiveQuizSets(classId, newIds);
            setActiveSetIds(newIds);
        } catch (e) { alert(e.message); }
    };

    const filteredQuizSets = useMemo(() => {
        return quizSets.filter(set => {
            const matchGrade = filterGrade === 'all' || set.grade.toString() === filterGrade;
            const matchSubject = filterSubject === 'all' || set.subject === filterSubject;
            const matchSearch = set.title.toLowerCase().includes(searchTerm.toLowerCase()) || set.creatorName.includes(searchTerm);
            return matchGrade && matchSubject && matchSearch;
        });
    }, [quizSets, filterGrade, filterSubject, searchTerm]);

    const totalPages = Math.ceil(filteredQuizSets.length / ITEMS_PER_PAGE);
    const paginatedQuizSets = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredQuizSets.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredQuizSets, currentPage]);


    if (mode === 'create') {
        return (
            <Wrapper>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h2>📝 문제집 만들기/수정</h2>
                    <Button color="#6c757d" onClick={() => { setMode('list'); setEditingQuestionId(null); }}>목록으로</Button>
                </div>
                <Section>
                    <h3>1. 문제집 정보</h3>
                    <TitleInput placeholder="제목 입력" value={newSetInfo.title} onChange={e => setNewSetInfo({ ...newSetInfo, title: e.target.value })} />
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <InputGroup style={{ flex: 1, minWidth: '150px' }}>
                            <label>학년</label>
                            <select value={newSetInfo.grade} onChange={e => setNewSetInfo({ ...newSetInfo, grade: e.target.value })}>
                                <option value="common">공통</option>
                                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                            </select>
                        </InputGroup>
                        <InputGroup style={{ flex: 1, minWidth: '150px' }}>
                            <label>과목</label>
                            <select value={newSetInfo.subject} onChange={e => setNewSetInfo({ ...newSetInfo, subject: e.target.value })}>
                                <option value="general">상식/넌센스</option><option value="korean">국어</option>
                                <option value="math">수학</option><option value="social">사회</option>
                                <option value="science">과학</option><option value="english">영어</option>
                                <option value="history">역사</option><option value="other">기타</option>
                            </select>
                        </InputGroup>
                        <InputGroup style={{ flex: 1, minWidth: '150px' }}>
                            <label>공개 설정</label>
                            <select value={newSetInfo.isPublic} onChange={e => setNewSetInfo({ ...newSetInfo, isPublic: e.target.value === 'true' })}>
                                <option value="true">공개 (다른 반 선생님도 사용 가능)</option>
                                <option value="false">비공개 (우리 반에서만 사용)</option>
                            </select>
                        </InputGroup>
                    </div>
                </Section>
                <Section style={{ border: editingQuestionId ? '2px solid #ffc107' : '1px solid #e9ecef', backgroundColor: editingQuestionId ? '#fffdf5' : '#f8f9fa' }}>
                    <h3 style={{ color: editingQuestionId ? '#d39e00' : 'black' }}>
                        {editingQuestionId ? `✏️ ${currentIndex + 1}번 문제 수정 중...` : '2. 문제 추가'}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <Button color={qType === 'multiple' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'multiple' ? 'white' : 'black' }} onClick={() => { setQType('multiple'); setQAnswer(''); }}>객관식</Button>
                        <Button color={qType === 'ox' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'ox' ? 'white' : 'black' }} onClick={() => { setQType('ox'); setQAnswer('O'); }}>O / X</Button>
                        <Button color={qType === 'subjective' ? '#007bff' : '#e9ecef'} style={{ color: qType === 'subjective' ? 'white' : 'black' }} onClick={() => { setQType('subjective'); setQAnswer(''); }}>주관식</Button>
                    </div>
                    <InputGroup><input type="text" placeholder="질문 입력" value={qText} onChange={e => setQText(e.target.value)} /></InputGroup>
                    {qType === 'multiple' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                            {qOptions.map((opt, idx) => (
                                <input key={idx} type="text" placeholder={`보기 ${idx + 1}`} value={opt} onChange={e => {
                                    const newOpts = [...qOptions]; newOpts[idx] = e.target.value; setQOptions(newOpts);
                                }} />
                            ))}
                        </div>
                    )}
                    <InputGroup>
                        <label>정답 지정</label>
                        {qType === 'ox' ? (
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <label><input type="radio" checked={qAnswer === 'O'} onChange={() => setQAnswer('O')} /> O</label>
                                <label><input type="radio" checked={qAnswer === 'X'} onChange={() => setQAnswer('X')} /> X</label>
                            </div>
                        ) : (
                            qType === 'multiple' ? (
                                <select value={qAnswer} onChange={e => setQAnswer(e.target.value)}>
                                    <option value="">-- 정답 선택 --</option>
                                    {qOptions.map((opt, idx) => <option key={idx} value={opt}>{opt || `보기 ${idx + 1}`}</option>)}
                                </select>
                            ) : (
                                <input type="text" placeholder="정답 텍스트" value={qAnswer} onChange={e => setQAnswer(e.target.value)} />
                            )
                        )}
                    </InputGroup>

                    {/* ▼▼▼ [수정] 이전/다음 및 새 문제 버튼 그룹 ▼▼▼ */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                        <Button
                            onClick={handleAddQuestion}
                            style={{ flex: 1, padding: '1rem', fontSize: '1.1rem', backgroundColor: '#28a745', color: 'white', minWidth: '150px' }}
                            title="현재 입력된 내용을 저장합니다 (입력창은 유지됨)"
                        >
                            {editingQuestionId ? '✔️ 수정내용 저장' : '✔️ 이 문제 추가하기'}
                        </Button>

                        {editingQuestionId && (
                            <>
                                <Button
                                    onClick={() => handleNavigate(-1)}
                                    disabled={currentIndex <= 0}
                                    style={{ padding: '1rem', backgroundColor: '#17a2b8' }}
                                    title="저장하고 이전 문제로 이동"
                                >
                                    ◀ 이전 문제
                                </Button>
                                <Button
                                    onClick={() => handleNavigate(1)}
                                    disabled={currentIndex === -1 || currentIndex >= questions.length - 1}
                                    style={{ padding: '1rem', backgroundColor: '#17a2b8' }}
                                    title="저장하고 다음 문제로 이동"
                                >
                                    다음 문제 ▶
                                </Button>
                            </>
                        )}

                        <Button
                            onClick={handlePrepareNewQuestion}
                            style={{ padding: '1rem', backgroundColor: '#007bff' }}
                            title="입력창을 비우고 새로운 문제를 작성합니다."
                        >
                            + 새 문제
                        </Button>
                    </div>
                </Section>
                <Section>
                    <h3>3. 추가된 문제 목록 ({questions.length}개)</h3>
                    {questions.length === 0 ? <p style={{ color: '#666' }}>아직 추가된 문제가 없습니다.</p> : (
                        <QuizList>
                            {questions.map((q, idx) => (
                                <QuizCard key={q.id} type={q.type} $isEditing={editingQuestionId === q.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <strong>Q{idx + 1}. {q.question}</strong>
                                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                                            <button onClick={() => handleEditQuestionClick(q)} style={{ color: '#007bff', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>수정</button>
                                            <button onClick={() => handleRemoveQuestion(q.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>삭제</button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.95rem', color: '#dc3545', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                        정답: {q.answer}
                                    </div>
                                </QuizCard>
                            ))}
                        </QuizList>
                    )}
                    <Button
                        onClick={handleSaveQuizSet}
                        color="#28a745"
                        disabled={questions.length === 0}
                        style={{ width: '100%', marginTop: '2rem', padding: '1rem', fontSize: '1.2rem' }}
                    >
                        최종 저장하기 (총 {questions.length}문제)
                    </Button>
                </Section>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0 }}>📚 퀴즈 문제은행</h2>
                    <p style={{ color: '#666', margin: '0.5rem 0' }}>제목을 클릭하여 문제를 확인하고 출제해보세요.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {userRole === 'admin' && <Button color="#17a2b8" onClick={handleMigrateLegacy}>기존 퀴즈 이관 (Admin)</Button>}
                    {userRole === 'admin' && (
                        <Button color="#7950f2" onClick={() => setShowJsonImporter(v => !v)}>
                            📂 JSON 문제집 추가
                        </Button>
                    )}
                    <Button onClick={() => setMode('create')}>+ 새 문제집 만들기</Button>
                </div>
            </div>

            {/* ▼▼▼ [추가] JSON 문제집 선택 패널 ▼▼▼ */}
            {showJsonImporter && (
                <div style={{ background: '#f3f0ff', border: '2px solid #9775fa', borderRadius: '12px', padding: '1.2rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.8rem', color: '#5f3dc4' }}>📂 missions.json에서 문제집 선택 추가</h4>
                    <p style={{ margin: '0 0 1rem', color: '#666', fontSize: '0.9rem' }}>
                        <code>src/assets/missions.json</code>에 새 문제집을 추가한 뒤 아래에서 선택하여 DB에 등록하세요.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        {jsonSetNames.map(name => (
                            <label key={name} style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                                background: jsonImportChecked[name] ? '#7950f2' : 'white',
                                color: jsonImportChecked[name] ? 'white' : '#495057',
                                border: '1px solid #9775fa', fontWeight: 700, fontSize: '0.88rem',
                                userSelect: 'none',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={!!jsonImportChecked[name]}
                                    onChange={e => setJsonImportChecked(prev => ({ ...prev, [name]: e.target.checked }))}
                                    style={{ display: 'none' }}
                                />
                                {jsonImportChecked[name] ? '✅' : '☐'} {name} ({allQuizzesJson[name]?.length || 0}문항)
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <Button color="#7950f2" onClick={handleJsonImport}>선택한 문제집 DB에 추가</Button>
                        <Button color="#868e96" onClick={() => { setShowJsonImporter(false); setJsonImportChecked({}); }}>닫기</Button>
                    </div>
                </div>
            )}
            {/* ▲▲▲ [추가 끝] ▲▲▲ */}

            <SearchBar>
                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ width: '100px' }}>
                    <option value="all">전학년</option><option value="common">공통</option>
                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: '120px' }}>
                    <option value="all">전과목</option><option value="general">상식</option><option value="korean">국어</option>
                    <option value="math">수학</option><option value="social">사회</option><option value="science">과학</option>
                    <option value="english">영어</option><option value="history">역사</option><option value="other">기타</option>
                </select>
                <input type="text" placeholder="제목이나 출제자 이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </SearchBar>

            <div style={{ background: '#f1f3f5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={filteredQuizSets.length > 0 && checkedIds.size === filteredQuizSets.length} onChange={handleSelectAll} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                    <span style={{ fontWeight: 'bold' }}>전체 선택 ({checkedIds.size}개)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button color="#fd7e14" onClick={() => handleBatchPublish(true)}>+ 문제집 추가</Button>
                    <Button color="#20c997" onClick={() => handleBatchPublish(false)}>🔄 문제집 교체</Button>
                    <Button color="#fa5252" onClick={handleBatchDelete}>🗑️ 선택 삭제</Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {paginatedQuizSets.length > 0 ? paginatedQuizSets.map(set => {
                    const isActive = activeSetIds.includes(set.id);
                    const isChecked = checkedIds.has(set.id);
                    const canDelete = set.creatorId === currentUser?.uid || (userRole === 'admin' && set.creatorId === 'system');

                    return (
                        <div key={set.id} style={{
                            border: isActive ? '2px solid #20c997' : '1px solid #ddd',
                            borderRadius: '12px', padding: '1.2rem',
                            background: isActive ? '#e6fcf5' : 'white',
                            position: 'relative', boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                                <input type="checkbox" checked={isChecked} onChange={() => handleCheck(set.id)} style={{ width: '22px', height: '22px', cursor: 'pointer' }} />
                            </div>
                            <div style={{ marginBottom: '0.5rem', paddingRight: '2.5rem' }}>
                                {isActive && <Tag style={{ background: '#20c997', color: 'white', fontWeight: 'bold' }}>출제중</Tag>}
                                <Tag>{set.grade === 'common' ? '전학년' : `${set.grade}학년`}</Tag>
                                <Tag>{set.subject === 'math' ? '수학' : (set.subject === 'general' ? '상식' : set.subject)}</Tag>
                                {set.isPublic ? <Tag style={{ background: '#dbe4ff', color: '#4263eb' }}>공용</Tag> : <Tag style={{ background: '#f1f3f5' }}>개인</Tag>}
                            </div>
                            <h3
                                style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', cursor: 'pointer', color: '#007bff', textDecoration: 'underline' }}
                                onClick={() => setSelectedSet(set)}
                            >
                                {set.title}
                            </h3>
                            <p style={{ color: '#868e96', fontSize: '0.9rem', margin: 0 }}>문항: {set.questions?.length || 0}개 | 출제자: {set.creatorName}</p>
                            <div style={{ marginTop: 'auto', paddingTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                                <Button color={isActive ? '#ff6b6b' : '#20c997'} style={{ flex: 1 }} onClick={() => handleToggleSingle(set.id, set.title)}>
                                    {isActive ? '출제 취소' : '출제하기'}
                                </Button>
                                {canDelete && (
                                    <Button color="#fa5252" onClick={() => { if (confirm("삭제하시겠습니까?")) deleteQuizSet(set.id).then(fetchQuizSets); }}>삭제</Button>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed #dee2e6' }}>
                        <h3 style={{ color: '#868e96', marginBottom: '0.5rem' }}>검색 결과가 없습니다.</h3>
                        <p style={{ color: '#adb5bd' }}>조건을 변경하거나 새로운 퀴즈를 직접 만들어보세요!</p>
                    </div>
                )}

                {totalPages > 0 && (
                    <PaginationContainer>
                        <PageButton onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="첫 페이지로">
                            &laquo; 처음
                        </PageButton>
                        <PageButton onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                            &lt; 이전
                        </PageButton>

                        {Array.from({ length: totalPages }, (_, i) => (
                            <PageButton
                                key={i + 1}
                                $isActive={currentPage === i + 1}
                                onClick={() => setCurrentPage(i + 1)}
                            >
                                {i + 1}
                            </PageButton>
                        ))}

                        <PageButton onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                            다음 &gt;
                        </PageButton>
                        <PageButton onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="마지막 페이지로">
                            마지막 &raquo;
                        </PageButton>
                    </PaginationContainer>
                )}
            </div>

            {selectedSet && (
                <ModalOverlay onClick={() => setSelectedSet(null)}>
                    <ModalContent onClick={e => e.stopPropagation()}>
                        <ModalHeader>
                            <div>
                                <Tag>{selectedSet.subject}</Tag>
                                <h2>{selectedSet.title}</h2>
                                <div style={{ fontSize: '0.9rem', color: '#868e96', marginTop: '5px' }}>출제자: {selectedSet.creatorName} | 문항 수: {selectedSet.questions.length}개</div>
                            </div>
                            <Button color="#f1f3f5" style={{ color: '#495057', padding: '0.5rem' }} onClick={() => setSelectedSet(null)}>닫기 ✖</Button>
                        </ModalHeader>
                        <ModalBody>
                            {selectedSet.questions.map((q, i) => (
                                <PreviewItem key={i}>
                                    <div className="q-header">
                                        <span>Q{i + 1}.</span>
                                        <span>{q.type === 'ox' ? '[O/X]' : q.type === 'multiple' ? '[객관식]' : '[주관식]'}</span>
                                        <span>{q.question}</span>
                                    </div>
                                    {q.options && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginLeft: '2rem', marginBottom: '10px', fontSize: '0.9rem', color: '#666' }}>
                                            {q.options.map((opt, idx) => <div key={idx}>- {opt}</div>)}
                                        </div>
                                    )}
                                    <div className="q-answer">정답: {q.answer}</div>
                                </PreviewItem>
                            ))}
                        </ModalBody>
                        <ModalFooter>
                            <Button color="#ffc107" style={{ color: 'black', flex: 1 }} onClick={() => handleCloneAndEdit(selectedSet)}>
                                📝 이 문제집 복제하여 내 것으로 수정하기
                            </Button>
                            <Button color="#6c757d" onClick={() => setSelectedSet(null)}>닫기</Button>
                        </ModalFooter>
                    </ModalContent>
                </ModalOverlay>
            )}
        </Wrapper>
    );
}

export default QuizManager;