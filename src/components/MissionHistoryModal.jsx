// src/components/MissionHistoryModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, addMissionComment, addMissionReply } from '../api/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
`;

const ModalContainer = styled.div`
  width: 90%;
  max-width: 600px;
  background-color: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  text-align: left;
  color: #333;
  display: flex;
  flex-direction: column;
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const HistoryList = styled.div`
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 1rem;
`;

const HistoryItemWrapper = styled.div`
  border-bottom: 1px solid #eee;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
`;

const HistoryHeader = styled.div`
  padding-bottom: 0.5rem;
  font-weight: 500;
`;

const SubmissionDetails = styled.div`
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 8px;

    p {
        white-space: pre-wrap;
        margin-top: 0;
    }
    
    img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        margin-top: 0.5rem;
    }
`;

const CommentSection = styled.div`
    margin-top: 1.5rem;
`;

const CommentInputContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
`;

const CommentTextarea = styled.textarea`
    flex-grow: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
`;

const CommentSubmitButton = styled.button`
    padding: 0.5rem 1rem;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    &:hover { background-color: #0056b3; }
`;

const CommentList = styled.div`
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const CommentCard = styled.div`
    background-color: #f1f3f5;
    padding: 0.75rem;
    border-radius: 8px;
`;

const CommentAuthor = styled.strong`
    font-size: 0.9rem;
`;

const CommentText = styled.p`
    margin: 0.25rem 0;
`;

const ReplyList = styled.div`
    margin-left: 1.5rem;
    margin-top: 0.5rem;
    border-left: 2px solid #dee2e6;
    padding-left: 1rem;
`;

const CloseButton = styled.button`
    margin-top: 2rem;
    width: 100%;
    padding: 0.8rem;
    border: none;
    border-radius: 8px;
    background-color: #6c757d;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    &:hover {
        background-color: #5a6268;
    }
`;

function Comment({ submissionId, comment, studentAuthUid, missionTitle }) {
    const { players } = useLeagueStore();
    const [replyContent, setReplyContent] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [replies, setReplies] = useState([]);

    const currentUser = auth.currentUser;
    const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

    useEffect(() => {
        const repliesRef = collection(db, "missionSubmissions", submissionId, "comments", comment.id, "replies");
        const q = query(repliesRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [submissionId, comment.id]);


    const handleReplySubmit = async () => {
        if (!replyContent.trim() || !myPlayerData) return;
        try {
            const originalCommenter = players.find(p => p.id === comment.commenterId);
            await addMissionReply(
                submissionId,
                comment.id,
                {
                    replierId: myPlayerData.id,
                    replierName: myPlayerData.name,
                    text: replyContent,
                },
                {
                    missionTitle,
                    commenterAuthUid: originalCommenter?.authUid
                }
            );
            setReplyContent('');
            setIsReplying(false);
        } catch (error) {
            console.error("Reply submission failed:", error);
            alert(`답글 등록 실패: ${error.message}`);
        }
    };

    return (
        <CommentCard>
            <CommentAuthor>{comment.commenterName}</CommentAuthor>
            <CommentText>{comment.text}</CommentText>

            <ReplyList>
                {replies.map(reply => (
                    <CommentCard key={reply.id} style={{ backgroundColor: '#e9ecef', marginTop: '0.5rem' }}>
                        <CommentAuthor>{reply.replierName}</CommentAuthor>
                        <CommentText>{reply.text}</CommentText>
                    </CommentCard>
                ))}
            </ReplyList>

            <button onClick={() => setIsReplying(prev => !prev)}>
                {isReplying ? '취소' : '답글'}
            </button>

            {isReplying && (
                <CommentInputContainer>
                    <CommentTextarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows="2" placeholder="답글을 입력하세요..." />
                    <CommentSubmitButton onClick={handleReplySubmit}>등록</CommentSubmitButton>
                </CommentInputContainer>
            )}
        </CommentCard>
    );
}

function HistoryItem({ item, student, missionTitle }) {
    const { players } = useLeagueStore();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    const currentUser = auth.currentUser;
    const myPlayerData = useMemo(() => players.find(p => p.authUid === currentUser?.uid), [players, currentUser]);

    useEffect(() => {
        const commentsRef = collection(db, "missionSubmissions", item.id, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [item.id]);

    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !myPlayerData) return;
        try {
            await addMissionComment(
                item.id,
                {
                    commenterId: myPlayerData.id,
                    commenterName: myPlayerData.name,
                    commenterRole: myPlayerData.role,
                    text: newComment,
                },
                student?.authUid,
                missionTitle
            );
            setNewComment('');
        } catch (error) {
            console.error("Comment submission failed:", error);
            alert(`댓글 등록 실패: ${error.message}`);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '날짜 정보 없음';
        return timestamp.toDate().toLocaleString('ko-KR');
    };

    return (
        <HistoryItemWrapper>
            <HistoryHeader>{formatDate(item.approvedAt || item.requestedAt)} 제출</HistoryHeader>
            <SubmissionDetails>
                {item.text && <p>{item.text}</p>}
                {item.photoUrl && <img src={item.photoUrl} alt="제출 이미지" />}
            </SubmissionDetails>

            <CommentSection>
                <CommentList>
                    {comments.map(comment => (
                        <Comment
                            key={comment.id}
                            submissionId={item.id}
                            comment={comment}
                            studentAuthUid={student?.authUid}
                            missionTitle={missionTitle}
                        />
                    ))}
                </CommentList>
                <CommentInputContainer>
                    <CommentTextarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="댓글을 입력하세요..." rows="2" />
                    <CommentSubmitButton onClick={handleCommentSubmit}>등록</CommentSubmitButton>
                </CommentInputContainer>
            </CommentSection>
        </HistoryItemWrapper>
    );
}


const MissionHistoryModal = ({ isOpen, onClose, missionTitle, history, student }) => {
    if (!isOpen) return null;

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle>'{missionTitle}' 기록 보기</ModalTitle>
                <HistoryList>
                    {history.length > 0 ? (
                        history.map(item => (
                            <HistoryItem
                                key={item.id}
                                item={item}
                                student={student}
                                missionTitle={missionTitle}
                            />
                        ))
                    ) : (
                        <p style={{ textAlign: 'center', padding: '2rem' }}>아직 완료된 기록이 없습니다.</p>
                    )}
                </HistoryList>
                <CloseButton onClick={onClose}>닫기</CloseButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default MissionHistoryModal;