// src/pages/admin/tabs/SocialTab.jsx

import React, { useState, useEffect } from 'react';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import {
    auth, db, adminInitiateConversation, sendBulkMessageToAllStudents,
    getAllMyRoomComments, deleteMyRoomComment, deleteMyRoomReply,
    getAllMissionComments, deleteMissionComment
} from '../../../api/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import PlayerProfile from '../../../components/PlayerProfile';

// 공통 스타일
import {
    FullWidthSection, Section, SectionTitle, InputGroup,
    StyledButton, List, ListItem, SaveButton, GridContainer, TabContainer, TabButton
} from '../Admin.style';

// -----------------------------------------------------------------------------
// 1. 메시지 관리 (MessageManager)
// -----------------------------------------------------------------------------
function MessageManager({ preselectedStudentId, onStudentSelect }) {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [bulkMessage, setBulkMessage] = useState('');
    const currentUser = auth.currentUser;

    // 외부에서 학생을 선택해서 들어온 경우 (예: 학생 목록에서 '쪽지' 클릭)
    useEffect(() => {
        if (preselectedStudentId) {
            const student = players.find(p => p.id === preselectedStudentId);
            if (student) setSelectedStudent(student);
        }
    }, [preselectedStudentId, players]);

    // 선택된 학생과의 대화 내역 불러오기
    useEffect(() => {
        if (!classId || !selectedStudent || !currentUser) return;

        // 1. 대화방 찾기 또는 생성 (adminInitiateConversation 활용)
        const fetchConversation = async () => {
            try {
                // 관리자가 대화를 시작하면 conversation ID를 얻거나 생성됨
                const conversationId = await adminInitiateConversation(classId, selectedStudent.id, currentUser.uid);

                // 2. 해당 대화방의 메시지 구독
                const q = query(
                    collection(db, "classes", classId, "conversations", conversationId, "messages"),
                    orderBy("createdAt", "asc")
                );
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setMessages(msgs);
                });
                return unsubscribe;
            } catch (error) {
                console.error("대화 불러오기 실패:", error);
            }
        };

        const unsubscribePromise = fetchConversation();
        return () => {
            unsubscribePromise.then(unsub => unsub && unsub());
        };
    }, [classId, selectedStudent, currentUser]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedStudent) return;
        try {
            const conversationId = await adminInitiateConversation(classId, selectedStudent.id, currentUser.uid);
            await addDoc(collection(db, "classes", classId, "conversations", conversationId, "messages"), {
                text: newMessage,
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
                read: false
            });
            setNewMessage('');
        } catch (error) {
            console.error(error);
            alert("전송 실패");
        }
    };

    const handleBulkSend = async () => {
        if (!bulkMessage.trim()) return alert('내용을 입력해주세요.');
        if (window.confirm(`전체 학생(${players.length}명)에게 메시지를 보내시겠습니까?`)) {
            try {
                await sendBulkMessageToAllStudents(classId, players, currentUser.uid, bulkMessage);
                alert('전체 메시지 전송 완료!');
                setBulkMessage('');
            } catch (error) {
                alert('전송 실패: ' + error.message);
            }
        }
    };

    return (
        <GridContainer style={{ gridTemplateColumns: '300px 1fr' }}>
            {/* 좌측: 학생 목록 & 전체 메시지 */}
            <FullWidthSection style={{ marginBottom: 0 }}>
                <Section>
                    <SectionTitle style={{ fontSize: '1.1rem' }}>학생 목록 🧑‍🎓</SectionTitle>
                    <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', marginBottom: '1rem' }}>
                        {players.map(player => (
                            <div
                                key={player.id}
                                onClick={() => { setSelectedStudent(player); onStudentSelect(player.id); }}
                                style={{
                                    padding: '0.8rem',
                                    borderBottom: '1px solid #f1f3f5',
                                    cursor: 'pointer',
                                    backgroundColor: selectedStudent?.id === player.id ? '#e7f5ff' : 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                <PlayerProfile player={player} size="30px" />
                                <span>{player.name}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ borderTop: '2px solid #f1f3f5', paddingTop: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>📢 전체 공지 보내기</h4>
                        <textarea
                            value={bulkMessage}
                            onChange={(e) => setBulkMessage(e.target.value)}
                            placeholder="모든 학생에게 보낼 메시지..."
                            style={{ width: '100%', height: '60px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #dee2e6', marginBottom: '0.5rem' }}
                        />
                        <StyledButton onClick={handleBulkSend} style={{ width: '100%', backgroundColor: '#fd7e14' }}>전체 발송</StyledButton>
                    </div>
                </Section>
            </FullWidthSection>

            {/* 우측: 대화창 */}
            <FullWidthSection style={{ marginBottom: 0 }}>
                <Section style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {selectedStudent ? (
                        <>
                            <SectionTitle>{selectedStudent.name} 학생과 대화 💬</SectionTitle>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {messages.map(msg => {
                                    const isMe = msg.senderId === currentUser.uid;
                                    return (
                                        <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                                            <div style={{
                                                padding: '0.6rem 1rem',
                                                borderRadius: '12px',
                                                backgroundColor: isMe ? '#339af0' : 'white',
                                                color: isMe ? 'white' : 'black',
                                                border: isMe ? 'none' : '1px solid #dee2e6',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}>
                                                {msg.text}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#adb5bd', marginTop: '2px', textAlign: isMe ? 'right' : 'left' }}>
                                                {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="메시지를 입력하세요..."
                                    style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid #dee2e6' }}
                                />
                                <StyledButton onClick={handleSendMessage} style={{ backgroundColor: '#20c997' }}>전송</StyledButton>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adb5bd' }}>
                            좌측 목록에서 학생을 선택해주세요.
                        </div>
                    )}
                </Section>
            </FullWidthSection>
        </GridContainer>
    );
}

// -----------------------------------------------------------------------------
// 2. 마이룸 댓글 모니터링 (MyRoomCommentMonitor)
// -----------------------------------------------------------------------------
function MyRoomCommentMonitor() {
    const { classId } = useClassStore();
    const [comments, setComments] = useState([]);

    const fetchComments = async () => {
        if (!classId) return;
        try {
            const data = await getAllMyRoomComments(classId); // 최근 50개 정도만 가져오도록 API 구현 권장
            setComments(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [classId]);

    const handleDelete = async (targetId, commentId, isReply, replyId) => {
        if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
        try {
            if (isReply) {
                await deleteMyRoomReply(classId, targetId, commentId, replyId);
            } else {
                await deleteMyRoomComment(classId, targetId, commentId);
            }
            fetchComments();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>
                    마이룸 댓글 모니터링 👀
                    <StyledButton onClick={fetchComments} style={{ fontSize: '0.8rem' }}>새로고침</StyledButton>
                </SectionTitle>
                <List>
                    {comments.map((item, idx) => (
                        <ListItem key={`${item.id}-${idx}`} style={{ display: 'block' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>
                                    <strong>{item.authorName}</strong>
                                    <span style={{ color: '#868e96', fontSize: '0.9rem' }}> → {item.ownerName}님의 마이룸</span>
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#adb5bd' }}>
                                    {item.createdAt?.toDate().toLocaleString()}
                                </span>
                            </div>
                            <div style={{ padding: '0.8rem', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '0.5rem' }}>
                                {item.text}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <StyledButton
                                    onClick={() => handleDelete(item.targetId, item.id, false)}
                                    style={{ backgroundColor: '#ff6b6b', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                >
                                    삭제
                                </StyledButton>
                            </div>
                        </ListItem>
                    ))}
                    {comments.length === 0 && <p style={{ textAlign: 'center', color: '#adb5bd' }}>최근 댓글이 없습니다.</p>}
                </List>
            </Section>
        </FullWidthSection>
    );
}

// -----------------------------------------------------------------------------
// 3. 미션(갤러리) 댓글 모니터링 (MissionCommentMonitor)
// -----------------------------------------------------------------------------
function MissionCommentMonitor() {
    const { classId } = useClassStore();
    const [comments, setComments] = useState([]);

    const fetchComments = async () => {
        if (!classId) return;
        try {
            const data = await getAllMissionComments(classId);
            setComments(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [classId]);

    const handleDelete = async (missionId, submissionId, commentId) => {
        if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;
        try {
            await deleteMissionComment(classId, missionId, submissionId, commentId);
            fetchComments();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>
                    갤러리 댓글 모니터링 🖼️
                    <StyledButton onClick={fetchComments} style={{ fontSize: '0.8rem' }}>새로고침</StyledButton>
                </SectionTitle>
                <List>
                    {comments.map((item, idx) => (
                        <ListItem key={`${item.id}-${idx}`} style={{ display: 'block' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span>
                                    <strong>{item.authorName}</strong>
                                    <span style={{ color: '#868e96', fontSize: '0.9rem' }}> → {item.missionTitle} (작성자: {item.submissionAuthorName})</span>
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#adb5bd' }}>
                                    {item.createdAt?.toDate().toLocaleString()}
                                </span>
                            </div>
                            <div style={{ padding: '0.8rem', backgroundColor: '#fff0f6', borderRadius: '8px', marginBottom: '0.5rem' }}>
                                {item.text}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <StyledButton
                                    onClick={() => handleDelete(item.missionId, item.submissionId, item.id)}
                                    style={{ backgroundColor: '#ff6b6b', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                >
                                    삭제
                                </StyledButton>
                            </div>
                        </ListItem>
                    ))}
                    {comments.length === 0 && <p style={{ textAlign: 'center', color: '#adb5bd' }}>최근 댓글이 없습니다.</p>}
                </List>
            </Section>
        </FullWidthSection>
    );
}

// -----------------------------------------------------------------------------
// [메인] SocialTab
// -----------------------------------------------------------------------------
function SocialTab({ activeSubMenu, setActiveSubMenu }) {
    // 탭 전환 버튼 (상단)
    const renderTabs = () => (
        <TabContainer>
            <TabButton $active={activeSubMenu === 'messages'} onClick={() => setActiveSubMenu('messages')}>1:1 메시지</TabButton>
            <TabButton $active={activeSubMenu === 'myroom_comments'} onClick={() => setActiveSubMenu('myroom_comments')}>마이룸 댓글</TabButton>
            <TabButton $active={activeSubMenu === 'mission_comments'} onClick={() => setActiveSubMenu('mission_comments')}>갤러리 댓글</TabButton>
        </TabContainer>
    );

    if (activeSubMenu === 'myroom_comments') {
        return (
            <>
                {renderTabs()}
                <MyRoomCommentMonitor />
            </>
        );
    }

    if (activeSubMenu === 'mission_comments') {
        return (
            <>
                {renderTabs()}
                <MissionCommentMonitor />
            </>
        );
    }

    // 기본값: 메시지 관리
    return (
        <>
            {renderTabs()}
            {/* preselectedStudentId 등의 prop은 상위 AdminPage에서 상태관리가 필요하면 전달, 여기선 자체 관리 혹은 context 사용 */}
            <MessageManager
                preselectedStudentId={null}
                onStudentSelect={() => { }}
            />
        </>
    );
}

export default SocialTab;