// src/pages/admin/tabs/SocialTab.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { useClassStore, useLeagueStore } from '../../../store/leagueStore';
import {
    auth, db, replyToSuggestion, adminInitiateConversation, sendBulkMessageToAllStudents,
    getAllMyRoomComments, deleteMyRoomComment, deleteMyRoomReply, getAllMissionComments
} from '../../../api/firebase';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { FullWidthSection, Section, SectionTitle, StyledButton } from '../Admin.style';

// --- 소셜 탭 전용 스타일 ---
const ChatLayout = styled.div`
  display: flex; height: 70vh; background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;
`;
const StudentListPanel = styled.div`
  width: 250px; flex-shrink: 0; border-right: 1px solid #dee2e6; overflow-y: auto;
`;
const BulkMessageButton = styled.button`
  width: calc(100% - 2rem); margin: 0 1rem 1rem 1rem; padding: 0.75rem; font-size: 1rem; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer;
  &:hover { background-color: #218838; }
`;
const StudentListItem = styled.div`
  padding: 1rem; cursor: pointer; border-bottom: 1px solid #f1f3f5; background-color: ${props => props.$active ? '#e9ecef' : 'transparent'};
  &:hover { background-color: #f8f9fa; }
  p { margin: 0; font-weight: bold; }
  small { color: #6c757d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
`;
const ChatPanel = styled.div`
  flex-grow: 1; display: flex; flex-direction: column;
`;
const ChatHeader = styled.div`
  padding: 1rem; font-weight: bold; font-size: 1.2rem; border-bottom: 1px solid #dee2e6; text-align: center;
`;
const MessageArea = styled.div`
  flex-grow: 1; padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column;
`;
const MessageBubble = styled.div`
  max-width: 70%; padding: 0.75rem 1rem; border-radius: 18px; margin-bottom: 1rem; white-space: pre-wrap; line-height: 1.5; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  &.student { background-color: #fff; color: #343a40; align-self: flex-start; border: 1px solid #e9ecef; border-bottom-left-radius: 4px; }
  &.admin { background-color: #007bff; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
`;
const Timestamp = styled.span`
  font-size: 0.75rem; color: #a9a9a9; display: block; margin-top: 0.5rem; text-align: ${props => props.$align || 'left'};
`;
const InputArea = styled.div`
  display: flex; padding: 1rem; border-top: 1px solid #dee2e6; background-color: #f8f9fa;
`;
const TextArea = styled.textarea`
  flex-grow: 1; padding: 0.75rem; border: 1px solid #ced4da; border-radius: 8px; font-size: 1rem; resize: none; font-family: inherit; height: 48px;
`;
const SubmitButton = styled.button`
  padding: 0 1.5rem; margin-left: 1rem; border: none; border-radius: 8px; background-color: #007bff; color: white; font-size: 1rem; font-weight: bold; cursor: pointer;
  &:disabled { background-color: #6c757d; }
`;
const DateSeparator = styled.div`
  text-align: center; margin: 1rem 0; color: #6c757d; font-size: 0.8rem; font-weight: bold;
`;
const MonitorCommentCard = styled.div`
    background-color: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;
`;
const MissionCommentCard = styled(MonitorCommentCard)``;
const MonitorHeader = styled.div`
    font-size: 0.9rem; color: #6c757d; margin-bottom: 0.5rem;
    & > strong { color: #007bff; }
    & > span { cursor: pointer; text-decoration: underline; }
`;
const MonitorContent = styled.p`margin: 0 0 0.5rem;`;
const MonitorReply = styled.div`
    border-left: 3px solid #ced4da; padding-left: 1rem; margin-left: 1rem; font-size: 0.95rem;
`;
const LoadMoreButton = styled.button`
    margin-top: 1.5rem; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: bold; color: #007bff; background-color: #fff; border: 1px solid #007bff; border-radius: 8px; cursor: pointer;
    &:hover { background-color: #f0f8ff; }
`;

// --- 컴포넌트 ---
function MessageManager({ preselectedStudentId, onStudentSelect }) {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [allSuggestions, setAllSuggestions] = useState([]);
    const [replyContent, setReplyContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messageAreaRef = useRef(null);

    const getConversationFromDoc = (doc) => {
        if (doc.conversation) return doc.conversation;
        const oldConversation = [];
        if (doc.message) oldConversation.push({ sender: 'student', content: doc.message, createdAt: doc.createdAt });
        if (doc.reply) oldConversation.push({ sender: 'admin', content: doc.reply, createdAt: doc.repliedAt });
        return oldConversation;
    };

    useEffect(() => {
        if (!classId) return;
        const q = query(collection(db, "classes", classId, "suggestions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllSuggestions(suggestionsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [classId]);

    useEffect(() => {
        if (messageAreaRef.current) messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }, [preselectedStudentId, allSuggestions]);

    const studentThreads = useMemo(() => {
        return allSuggestions.reduce((acc, msg) => {
            if (!acc[msg.studentId]) acc[msg.studentId] = [];
            acc[msg.studentId].push(msg);
            return acc;
        }, {});
    }, [allSuggestions]);

    const sortedPlayers = useMemo(() => {
        const getLatestMessageTime = (playerId) => {
            const thread = studentThreads[playerId];
            if (!thread) return 0;
            const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
            return (lastMessageDoc.lastMessageAt || lastMessageDoc.createdAt).toMillis();
        };

        return [...players].filter(p => p.role !== 'admin').sort((a, b) => {
            const timeA = getLatestMessageTime(a.id);
            const timeB = getLatestMessageTime(b.id);
            if (timeA !== timeB) return timeB - timeA;
            return a.name.localeCompare(b.name);
        });
    }, [players, studentThreads]);

    const selectedThreadMessages = useMemo(() => {
        if (!preselectedStudentId) return [];
        const thread = studentThreads[preselectedStudentId];
        if (!thread) return [];
        return thread.flatMap(item => getConversationFromDoc(item)).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    }, [preselectedStudentId, studentThreads]);

    const handleReplySubmit = async () => {
        if (!classId || !replyContent.trim() || !preselectedStudentId) return;
        const student = players.find(p => p.id === preselectedStudentId);
        if (!student) return alert("학생 정보를 찾을 수 없습니다.");

        const thread = studentThreads[preselectedStudentId];
        try {
            if (thread) {
                const lastMessageDoc = thread.sort((a, b) => (b.lastMessageAt || b.createdAt).toMillis() - (a.lastMessageAt || a.createdAt).toMillis())[0];
                await replyToSuggestion(classId, lastMessageDoc.id, replyContent, student.authUid);
            } else {
                await adminInitiateConversation(classId, student.id, student.name, replyContent, student.authUid);
            }
            setReplyContent('');
        } catch (error) { alert(`메시지 전송 실패: ${error.message}`); }
    };

    const handleBulkMessageSend = async () => {
        if (!classId) return;
        const message = prompt("모든 학생에게 보낼 메시지 내용을 입력하세요:");
        if (message && message.trim()) {
            if (window.confirm(`정말로 모든 학생에게 "${message}" 메시지를 보내시겠습니까?`)) {
                try {
                    await sendBulkMessageToAllStudents(classId, message);
                    alert("전체 메시지를 성공적으로 보냈습니다.");
                } catch (error) { alert(`전송 실패: ${error.message}`); }
            }
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp || typeof timestamp.toDate !== 'function') return '';
        return timestamp.toDate().toLocaleString('ko-KR', { month: 'long', day: 'numeric' });
    };

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>학생 메시지 확인 및 답변</SectionTitle>
                <ChatLayout>
                    <StudentListPanel>
                        <BulkMessageButton onClick={handleBulkMessageSend}>📢 전체 메시지 발송</BulkMessageButton>
                        {isLoading ? <p style={{ padding: '1rem' }}>로딩 중...</p> :
                            sortedPlayers.map(player => {
                                const thread = studentThreads[player.id];
                                const lastMessage = thread ? (thread.flatMap(item => getConversationFromDoc(item)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]) : null;
                                return (
                                    <StudentListItem key={player.id} $active={preselectedStudentId === player.id} onClick={() => onStudentSelect(player.id)}>
                                        <p>{player.name}</p>
                                        {lastMessage && <small>{lastMessage.content}</small>}
                                    </StudentListItem>
                                );
                            })
                        }
                    </StudentListPanel>
                    <ChatPanel>
                        {preselectedStudentId ? (
                            <>
                                <ChatHeader>{players.find(p => p.id === preselectedStudentId)?.name} 학생과의 대화</ChatHeader>
                                <MessageArea ref={messageAreaRef}>
                                    {selectedThreadMessages.length > 0 ? (
                                        selectedThreadMessages.map((message, index) => {
                                            const currentMessageDate = formatDate(message.createdAt);
                                            const prevMessageDate = index > 0 ? formatDate(selectedThreadMessages[index - 1].createdAt) : null;
                                            const showDateSeparator = currentMessageDate !== prevMessageDate;
                                            return (
                                                <React.Fragment key={index}>
                                                    {showDateSeparator && <DateSeparator>{currentMessageDate}</DateSeparator>}
                                                    <MessageBubble className={message.sender}>
                                                        {message.content}
                                                        <Timestamp $align={message.sender === 'student' ? 'right' : 'left'}>
                                                            {message.createdAt?.toDate().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </Timestamp>
                                                    </MessageBubble>
                                                </React.Fragment>
                                            );
                                        })
                                    ) : <p style={{ textAlign: 'center', color: '#6c757d' }}>아직 나눈 대화가 없습니다.</p>}
                                </MessageArea>
                                <InputArea>
                                    <TextArea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="답변을 입력하세요..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReplySubmit(); } }} />
                                    <SubmitButton onClick={handleReplySubmit} disabled={!replyContent.trim()}>전송</SubmitButton>
                                </InputArea>
                            </>
                        ) : <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6c757d' }}><p>왼쪽에서 학생을 선택하여 대화를 시작하세요.</p></div>}
                    </ChatPanel>
                </ChatLayout>
            </Section>
        </FullWidthSection>
    );
}

function MyRoomCommentMonitor() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const [allComments, setAllComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const [visibleCommentsCount, setVisibleCommentsCount] = useState(10);

    useEffect(() => {
        const fetchComments = async () => {
            if (!classId) return;
            setIsLoading(true);
            const comments = await getAllMyRoomComments(classId);
            setAllComments(comments);
            setIsLoading(false);
        };
        fetchComments();
    }, [classId]);

    const handleDeleteComment = async (roomId, commentId) => {
        if (window.confirm("정말로 이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            await deleteMyRoomComment(classId, roomId, commentId);
            setAllComments(prev => prev.filter(c => c.id !== commentId));
        }
    };

    const handleDeleteReply = async (roomId, commentId, reply) => {
        if (window.confirm("정말로 이 답글을 삭제하시겠습니까?")) {
            const comment = allComments.find(c => c.id === commentId);
            if (comment) {
                await deleteMyRoomReply(classId, roomId, commentId, reply);
                const updatedReplies = comment.replies.filter(r => !(r.createdAt?.toDate().getTime() === reply.createdAt?.toDate().getTime() && r.text === reply.text));
                setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, replies: updatedReplies } : c));
            }
        }
    };

    if (isLoading) return <Section><p>댓글을 불러오는 중...</p></Section>;

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>마이룸 댓글 모음</SectionTitle>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {allComments.slice(0, visibleCommentsCount).map(comment => {
                        const roomOwner = players.find(p => p.id === comment.roomId);
                        return (
                            <MonitorCommentCard key={comment.id}>
                                <MonitorHeader>
                                    <strong>{comment.commenterName}</strong> → <span onClick={() => navigate(`/my-room/${roomOwner?.id}`)}><strong>{roomOwner?.name || '??'}</strong>님의 마이룸</span>
                                    <StyledButton onClick={() => handleDeleteComment(comment.roomId, comment.id)} style={{ float: 'right', padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#dc3545' }}>댓글 삭제</StyledButton>
                                </MonitorHeader>
                                <MonitorContent>{comment.text}</MonitorContent>
                                {comment.replies?.map((reply, index) => (
                                    <MonitorReply key={index}>
                                        <MonitorHeader>
                                            <strong>{reply.replierName}</strong>(방주인)
                                            <StyledButton onClick={() => handleDeleteReply(comment.roomId, comment.id, reply)} style={{ float: 'right', padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: '#6c757d' }}>답글 삭제</StyledButton>
                                        </MonitorHeader>
                                        <MonitorContent>{reply.text}</MonitorContent>
                                    </MonitorReply>
                                ))}
                            </MonitorCommentCard>
                        )
                    })}
                    {allComments.length > visibleCommentsCount && <LoadMoreButton onClick={() => setVisibleCommentsCount(prev => prev + 10)}>더보기</LoadMoreButton>}
                </div>
            </Section>
        </FullWidthSection>
    );
}

function MissionCommentMonitor() {
    const { classId } = useClassStore();
    const { players, missions, archivedMissions, missionSubmissions } = useLeagueStore();
    const [allComments, setAllComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleCommentsCount, setVisibleCommentsCount] = useState(10);

    const allMissionsList = useMemo(() => [...missions, ...archivedMissions], [missions, archivedMissions]);

    useEffect(() => {
        const fetchComments = async () => {
            if (!classId) return;
            setIsLoading(true);
            // firebase.js에 해당 함수가 있다고 가정 (기존 코드 기반)
            const comments = await getAllMissionComments(classId);
            setAllComments(comments);
            setIsLoading(false);
        };
        fetchComments();
    }, [classId]);

    const getSubmissionInfo = (submissionId) => {
        const submission = missionSubmissions.find(s => s.id === submissionId);
        if (!submission) return { missionTitle: '알 수 없는 미션', studentName: '알 수 없는 학생' };
        const mission = allMissionsList.find(m => m.id === submission.missionId);
        const student = players.find(p => p.id === submission.studentId);
        return { missionTitle: mission?.title || '삭제된 미션', studentName: student?.name || '알 수 없는 학생' }
    };

    if (isLoading) return <Section><p>댓글을 불러오는 중...</p></Section>;

    return (
        <FullWidthSection>
            <Section>
                <SectionTitle>미션 갤러리 댓글 모음</SectionTitle>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {allComments.slice(0, visibleCommentsCount).map(comment => {
                        const { missionTitle, studentName } = getSubmissionInfo(comment.submissionId);
                        return (
                            <MissionCommentCard key={comment.id}>
                                <MonitorHeader>
                                    <strong>{comment.commenterName}</strong> → <span>{studentName}</span>님의 게시물
                                </MonitorHeader>
                                <MonitorContent>"{comment.text}"</MonitorContent>
                                <small style={{ color: '#6c757d' }}>미션: {missionTitle}</small>
                            </MissionCommentCard>
                        )
                    })}
                    {allComments.length > visibleCommentsCount && <LoadMoreButton onClick={() => setVisibleCommentsCount(prev => prev + 10)}>더보기</LoadMoreButton>}
                </div>
            </Section>
        </FullWidthSection>
    );
}

function SocialTab({ activeSubMenu, preselectedStudentId, onStudentSelect }) {
    switch (activeSubMenu) {
        case 'messages': return <MessageManager preselectedStudentId={preselectedStudentId} onStudentSelect={onStudentSelect} />;
        case 'myroom_comments': return <MyRoomCommentMonitor />;
        case 'mission_comments': return <MissionCommentMonitor />;
        default: return <MessageManager />;
    }
}

export default SocialTab;