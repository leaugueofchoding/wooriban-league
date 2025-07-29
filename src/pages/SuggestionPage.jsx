// src/pages/SuggestionPage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, submitSuggestion } from '../api/firebase';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

// --- Styled Components ---

const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
`;

const ChatContainer = styled.div`
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 60vh;
`;

const MessageArea = styled.div`
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const MessageBubble = styled.div`
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 18px;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);

  &.student {
    background-color: #007bff;
    color: white;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }

  &.admin {
    background-color: #fff;
    color: #343a40;
    align-self: flex-start;
    border: 1px solid #e9ecef;
    border-bottom-left-radius: 4px;
  }
`;

const Timestamp = styled.span`
  font-size: 0.75rem;
  color: #a9a9a9;
  display: block;
  margin-top: 0.5rem;
  text-align: ${props => props.$align || 'left'};
`;


const InputArea = styled.div`
  display: flex;
  padding: 1rem;
  border-top: 1px solid #dee2e6;
  background-color: #fff;
`;

const TextArea = styled.textarea`
  flex-grow: 1;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  resize: none;
  font-family: inherit;
  height: 48px;
`;

const SubmitButton = styled.button`
  padding: 0 1.5rem;
  margin-left: 1rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;

  &:disabled {
    background-color: #6c757d;
  }
`;


function SuggestionPage() {
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
        if (!myPlayerData) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const q = query(
            collection(db, "suggestions"),
            where("studentId", "==", myPlayerData.id),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(suggestions);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [myPlayerData]);

    useEffect(() => {
        if (messageAreaRef.current) {
            messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
        }
    }, [history]);


    const handleSuggestionSubmit = async () => {
        if (!myPlayerData) return alert('선수 정보가 없습니다.');
        if (!content.trim()) return alert('내용을 입력해주세요.');

        try {
            await submitSuggestion({
                studentId: myPlayerData.id,
                studentName: myPlayerData.name,
                message: content,
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
            hour: '2-digit', minute: '2-digit',
        });
    };

    const flattenedConversation = useMemo(() => {
        return history.flatMap(item => {
            if (item.conversation) {
                return item.conversation;
            }
            const oldConversation = [];
            if (item.message) {
                oldConversation.push({
                    sender: 'student',
                    content: item.message,
                    createdAt: item.createdAt
                });
            }
            if (item.reply) {
                oldConversation.push({
                    sender: 'admin',
                    content: item.reply,
                    createdAt: item.repliedAt
                });
            }
            return oldConversation;
        });
    }, [history]);

    return (
        <Wrapper>
            <Title>💌 선생님과 1:1 대화하기</Title>
            <ChatContainer>
                <MessageArea ref={messageAreaRef}>
                    {isLoading ? <p>메시지를 불러오는 중...</p> : (
                        flattenedConversation.length === 0 ? <p style={{ textAlign: 'center', color: '#6c757d' }}>아직 나눈 대화가 없습니다.</p> : (
                            flattenedConversation.map((message, index) => (
                                <MessageBubble key={index} className={message.sender}>
                                    {message.content}
                                    <Timestamp $align={message.sender === 'student' ? 'right' : 'left'}>
                                        {formatDate(message.createdAt)}
                                    </Timestamp>
                                </MessageBubble>
                            ))
                        )
                    )}
                </MessageArea>
                <InputArea>
                    <TextArea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="선생님께 메시지를 보내보세요..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSuggestionSubmit();
                            }
                        }}
                    />
                    <SubmitButton onClick={handleSuggestionSubmit} disabled={!content.trim()}>전송</SubmitButton>
                </InputArea>
            </ChatContainer>
            <button onClick={() => navigate(-1)} style={{ display: 'block', margin: '2rem auto' }}>돌아가기</button>
        </Wrapper>
    );
}

export default SuggestionPage;
