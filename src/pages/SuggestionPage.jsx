// src/pages/SuggestionPage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, db, submitSuggestion } from '../api/firebase';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { filterProfanity } from '../utils/profanityFilter';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const messagePop = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

// --- Styled Components ---

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 2rem 1rem;
  background-color: #f1f3f5;
  font-family: 'Pretendard', sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ChatWrapper = styled.div`
  width: 100%;
  max-width: 600px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 80vh;
  animation: ${fadeIn} 0.5s ease-out;
  border: 1px solid #dee2e6;
`;

const Header = styled.div`
  padding: 1.5rem;
  background: linear-gradient(135deg, #74c0fc 0%, #339af0 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 10px rgba(51, 154, 240, 0.2);
  z-index: 10;
`;

const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SubTitle = styled.span`
  font-size: 0.85rem;
  opacity: 0.9;
  margin-top: 4px;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const MessageArea = styled.div`
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  background-color: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #ced4da;
    border-radius: 3px;
  }
`;

const DateSeparator = styled.div`
  text-align: center;
  margin: 1rem 0;
  position: relative;
  
  span {
    background-color: #e9ecef;
    color: #868e96;
    padding: 0.3rem 1rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 700;
  }
`;

const MessageGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.$isMine ? 'flex-end' : 'flex-start'};
  animation: ${messagePop} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
`;

const SenderName = styled.span`
  font-size: 0.8rem;
  color: #868e96;
  margin-bottom: 4px;
  margin-left: 8px;
  margin-right: 8px;
`;

const Bubble = styled.div`
  max-width: 80%;
  padding: 0.8rem 1rem;
  border-radius: 18px;
  font-size: 0.95rem;
  line-height: 1.5;
  position: relative;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);

  ${props => props.$isMine ? css`
    background-color: #339af0;
    color: white;
    border-bottom-right-radius: 4px;
  ` : css`
    background-color: white;
    color: #495057;
    border-bottom-left-radius: 4px;
    border: 1px solid #e9ecef;
  `}
`;

const Time = styled.span`
  font-size: 0.7rem;
  color: #adb5bd;
  margin-top: 4px;
  margin-left: 4px;
  margin-right: 4px;
`;

const InputArea = styled.div`
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #f1f3f5;
  display: flex;
  align-items: flex-end;
  gap: 0.8rem;
`;

const StyledTextarea = styled.textarea`
  flex-grow: 1;
  padding: 0.8rem;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  font-size: 0.95rem;
  resize: none;
  font-family: inherit;
  height: 48px;
  max-height: 120px;
  transition: border-color 0.2s;
  outline: none;

  &:focus {
    border-color: #339af0;
  }

  &::placeholder {
    color: #adb5bd;
  }
`;

const SendButton = styled.button`
  padding: 0.8rem 1.2rem;
  background-color: #339af0;
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: #228be6;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    background-color: #e9ecef;
    color: #adb5bd;
    cursor: not-allowed;
    transform: none;
  }
`;

function SuggestionPage() {
    const { classId } = useClassStore();
    const { players } = useLeagueStore();
    const currentUser = auth.currentUser;
    const navigate = useNavigate();
    const messageAreaRef = useRef(null);

    const [content, setContent] = useState('');
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    useEffect(() => {
        if (!myPlayerData || !classId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const q = query(
            collection(db, "classes", classId, "suggestions"),
            where("studentId", "==", myPlayerData.id),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(suggestions);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [myPlayerData, classId]);

    useEffect(() => {
        if (messageAreaRef.current) {
            messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
        }
    }, [history]);

    const handleSuggestionSubmit = async () => {
        if (!classId || !myPlayerData) return alert('선수 정보가 없습니다.');
        if (!content.trim()) return;

        const filteredMessage = filterProfanity(content);

        try {
            await submitSuggestion(classId, {
                studentId: myPlayerData.id,
                studentName: myPlayerData.name,
                message: filteredMessage,
            });
            setContent('');
        } catch (error) {
            alert(`전송 실패: ${error.message}`);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '';
        const date = timestamp.toDate();
        return date.toLocaleString('ko-KR', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    // 날짜별 구분선 로직은 생략하고 단순 나열 (필요시 추가 가능)
    const flattenedConversation = useMemo(() => {
        return history.flatMap(item => {
            const messages = [];
            // 학생 메시지
            if (item.message) {
                messages.push({
                    id: item.id + '_q',
                    sender: 'student',
                    name: '나',
                    content: item.message,
                    createdAt: item.createdAt
                });
            }
            // 선생님 답장 (대화형 필드가 없으므로 reply 필드 사용)
            if (item.reply) {
                messages.push({
                    id: item.id + '_a',
                    sender: 'admin',
                    name: '선생님',
                    content: item.reply,
                    createdAt: item.repliedAt || item.createdAt // repliedAt이 없으면 생성시간 대체
                });
            }
            // conversation 배열 필드가 있다면 (추후 확장용)
            if (item.conversation) {
                return item.conversation.map((msg, idx) => ({
                    id: item.id + '_' + idx,
                    sender: msg.sender, // 'student' or 'admin'
                    name: msg.sender === 'student' ? '나' : '선생님',
                    content: msg.content,
                    createdAt: msg.createdAt
                }));
            }
            return messages;
        }).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    }, [history]);

    return (
        <PageContainer>
            <ChatWrapper>
                <Header>
                    <TitleGroup>
                        <Title>💬 선생님과의 대화</Title>
                        <SubTitle>건의사항이나 하고 싶은 말을 남겨주세요.</SubTitle>
                    </TitleGroup>
                    <CloseButton onClick={() => navigate(-1)}>✕</CloseButton>
                </Header>

                <MessageArea ref={messageAreaRef}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '2rem' }}>불러오는 중...</div>
                    ) : flattenedConversation.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                            아직 나눈 대화가 없습니다.<br />첫 메시지를 보내보세요!
                        </div>
                    ) : (
                        flattenedConversation.map((msg) => (
                            <MessageGroup key={msg.id} $isMine={msg.sender === 'student'}>
                                <SenderName>{msg.name}</SenderName>
                                <Bubble $isMine={msg.sender === 'student'}>
                                    {msg.content}
                                </Bubble>
                                <Time>{formatDate(msg.createdAt)}</Time>
                            </MessageGroup>
                        ))
                    )}
                </MessageArea>

                <InputArea>
                    <StyledTextarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSuggestionSubmit();
                            }
                        }}
                    />
                    <SendButton onClick={handleSuggestionSubmit} disabled={!content.trim()}>
                        전송
                    </SendButton>
                </InputArea>
            </ChatWrapper>
        </PageContainer>
    );
}

export default SuggestionPage;