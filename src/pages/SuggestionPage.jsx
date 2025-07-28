// src/pages/SuggestionPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
// [수정] onSnapshot을 사용하기 위해 db를 직접 import
import { auth, db, submitSuggestion } from '../api/firebase';
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

// ... (Styled Components는 기존과 동일) ...
const Wrapper = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
`;

const Title = styled.h1`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const Section = styled.section`
  padding: 1.5rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  margin-top: 0;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
`;

const CardContainer = styled.div`
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const MessageCard = styled.div`
  padding: 1.5rem;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
  min-width: 200px;
  text-align: center;

  &:hover {
    transform: scale(1.05);
  }

  &.thanks { background-color: #28a745; }
  &.fun { background-color: #007bff; }
  &.love { background-color: #dc3545; }
`;

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 120px;
  padding: 1rem;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 1rem;
  resize: vertical;
  font-family: inherit;
`;

const SubmitButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  align-self: flex-end; /* 버튼을 오른쪽으로 정렬 */

  &:disabled {
    background-color: #6c757d;
  }
`;

const HistoryItem = styled.div`
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 1rem;
  background-color: #fff;
`;

const MyMessage = styled.div`
  margin-bottom: 1rem;
`;

const AdminReply = styled.div`
  background-color: #f1f3f5;
  padding: 1rem;
  border-radius: 8px;
  border-top: 2px solid #007bff;
`;

const Timestamp = styled.span`
  font-size: 0.8rem;
  color: #6c757d;
  display: block;
  margin-top: 0.5rem;
  text-align: right;
`;

const MessageContent = styled.p`
    margin: 0;
    white-space: pre-wrap; /* 줄바꿈을 그대로 보여줌 */
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
  margin-left: 0.5rem;
  background-color: ${props => props.$status === 'replied' ? '#28a745' : '#ffc107'};
  color: ${props => props.$status === 'replied' ? 'white' : 'black'};
`;


function SuggestionPage() {
    const { players } = useLeagueStore();
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const [content, setContent] = useState('');
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const myPlayerData = useMemo(() => {
        if (!currentUser) return null;
        return players.find(p => p.authUid === currentUser.uid);
    }, [players, currentUser]);

    // ▼▼▼ [수정] getDocs를 onSnapshot으로 변경하여 실시간 업데이트 구현 ▼▼▼
    useEffect(() => {
        if (!myPlayerData) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const q = query(
            collection(db, "suggestions"),
            where("studentId", "==", myPlayerData.id),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const suggestions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistory(suggestions);
            setIsLoading(false);
        });

        // 컴포넌트가 사라질 때 실시간 리스너를 정리
        return () => unsubscribe();
    }, [myPlayerData]);

    const handleCardClick = async (message) => {
        if (!myPlayerData) return alert('선수 정보가 없습니다.');
        if (!confirm(`"${message}" 메시지를 보내시겠습니까?`)) return;

        try {
            await submitSuggestion({
                studentId: myPlayerData.id,
                studentName: myPlayerData.name,
                isCard: true,
                message: message,
            });
            alert('메시지를 성공적으로 보냈습니다!');
            // 실시간으로 반영되므로 더 이상 fetchHistory() 호출 필요 없음
        } catch (error) {
            alert(`전송 실패: ${error.message}`);
        }
    };

    const handleSuggestionSubmit = async () => {
        if (!myPlayerData) return alert('선수 정보가 없습니다.');
        if (!content.trim()) return alert('내용을 입력해주세요.');

        try {
            await submitSuggestion({
                studentId: myPlayerData.id,
                studentName: myPlayerData.name,
                isCard: false,
                message: content,
            });
            alert('건의사항을 성공적으로 보냈습니다!');
            setContent('');
            // 실시간으로 반영되므로 더 이상 fetchHistory() 호출 필요 없음
        } catch (error) {
            alert(`전송 실패: ${error.message}`);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '';
        const date = timestamp.toDate();
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Wrapper>
            <Title>💌 선생님께 메시지 보내기</Title>

            <Section>
                <SectionTitle>감사 카드 보내기</SectionTitle>
                <CardContainer>
                    <MessageCard className="thanks" onClick={() => handleCardClick("감사합니다!")}>감사합니다!</MessageCard>
                    <MessageCard className="fun" onClick={() => handleCardClick("우리반 리그 재미있어요!")}>재미있어요!</MessageCard>
                    <MessageCard className="love" onClick={() => handleCardClick("선생님 사랑합니다!")}>사랑합니다!</MessageCard>
                </CardContainer>
            </Section>

            <Section>
                <SectionTitle>건의사항 및 개선사항</SectionTitle>
                <FormContainer>
                    <TextArea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="하고 싶은 말이나, 우리반 리그가 더 재미있어질 아이디어를 자유롭게 적어주세요."
                    />
                    <SubmitButton onClick={handleSuggestionSubmit} disabled={!content.trim()}>보내기</SubmitButton>
                </FormContainer>
            </Section>

            <Section>
                <SectionTitle>내가 보낸 메시지 확인</SectionTitle>
                {isLoading ? <p>불러오는 중...</p> : (
                    history.length === 0 ? <p>아직 보낸 메시지가 없습니다.</p> : (
                        history.map(item => (
                            <HistoryItem key={item.id}>
                                <MyMessage>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0 }}>{item.isCard ? '💌 카드 메시지' : '✏️ 내가 쓴 글'}</h4>
                                        <StatusBadge $status={item.status}>
                                            {item.status === 'replied' ? '답변완료' : '확인중'}
                                        </StatusBadge>
                                    </div>
                                    <MessageContent>{item.message}</MessageContent>
                                    <Timestamp>{formatDate(item.createdAt)}</Timestamp>
                                </MyMessage>
                                {item.reply && (
                                    <AdminReply>
                                        <h5 style={{ margin: 0, marginBottom: '0.5rem' }}>👑 선생님의 답변</h5>
                                        <MessageContent>{item.reply}</MessageContent>
                                        <Timestamp>{formatDate(item.repliedAt)}</Timestamp>
                                    </AdminReply>
                                )}
                            </HistoryItem>
                        ))
                    )
                )}
            </Section>

            <button onClick={() => navigate(-1)} style={{ display: 'block', margin: '2rem auto' }}>돌아가기</button>
        </Wrapper>
    );
}

export default SuggestionPage;