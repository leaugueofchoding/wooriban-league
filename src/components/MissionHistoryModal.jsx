// src/components/MissionHistoryModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, addMissionComment, addMissionReply, updateMissionComment, deleteMissionComment, updateMissionReply, deleteMissionReply, toggleAdminFeedbackLike } from '../api/firebase';
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

const FeedbackSection = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background-color: #e7f5ff;
  border-radius: 8px;
  border-left: 5px solid #007bff;
`;

const FeedbackHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
`;

const LikeButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.5rem;
    transition: transform 0.2s;
    &:hover { transform: scale(1.2); }
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

// [수정] CommentCard 스타일을 FeedbackSection과 유사하게 변경
const CommentCard = styled.div`
    background-color: #e7f5ff;
    padding: 1rem;
    border-radius: 8px;
    border-left: 5px solid #007bff;
`;

const CommentHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
`;

const CommentAuthor = styled.strong`
    font-size: 0.9rem;
`;

const CommentText = styled.p`
    margin: 0.25rem 0;
`;

const CommentActions = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
    
    button {
        background: none;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.8rem;
        cursor: pointer;
        &:hover {
            background: #e0eaff;
        }
    }
`;

const ReplyList = styled.div`
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 1.5rem;
    border-left: 3px solid #bce0fd;
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

// [수정] ReplyItem 컴포넌트 구조 변경
function ReplyItem({ submissionId, commentId, reply, missionTitle }) {
    const { players } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const isAdmin = myPlayerData?.role === 'admin';

    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(reply.text);

    const handleUpdate = async () => {
        if (editedText.trim() === reply.text || !editedText.trim()) {
            setIsEditing(false);
            return;
        }
        try {
            await updateMissionReply(submissionId, commentId, reply.id, editedText.trim());
            setIsEditing(false);
        } catch (error) {
            alert("답글 수정에 실패했습니다.");
        }
    };

    const handleDelete = async () => {
        if (window.confirm("정말로 이 답글을 삭제하시겠습니까?")) {
            try {
                await deleteMissionReply(submissionId, commentId, reply.id);
            } catch (error) {
                alert("답글 삭제에 실패했습니다.");
            }
        }
    };

    return (
        <CommentCard style={{ backgroundColor: '#d0eaff' }}>
            <CommentHeader>
                <CommentAuthor>{reply.replierName}</CommentAuthor>
                {isAdmin && (
                    <CommentActions>
                        {isEditing ? (
                            <>
                                <button onClick={handleUpdate}>저장</button>
                                <button onClick={() => setIsEditing(false)}>취소</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)}>수정</button>
                                <button onClick={handleDelete}>삭제</button>
                            </>
                        )}
                    </CommentActions>
                )}
            </CommentHeader>
            {isEditing ? (
                <CommentTextarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows="2" />
            ) : (
                <CommentText>{reply.text}</CommentText>
            )}
        </CommentCard>
    );
}

// [수정] Comment 컴포넌트 구조 변경
function Comment({ submissionId, comment, studentAuthUid, missionTitle }) {
    const { players } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const isAdmin = myPlayerData?.role === 'admin';

    const [replyContent, setReplyContent] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [replies, setReplies] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(comment.text);

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
                { replierId: myPlayerData.id, replierName: myPlayerData.name, text: replyContent, },
                { missionTitle, commenterAuthUid: originalCommenter?.authUid }
            );
            setReplyContent('');
            setIsReplying(false);
        } catch (error) {
            console.error("Reply submission failed:", error);
            alert(`답글 등록 실패: ${error.message}`);
        }
    };

    const handleUpdateComment = async () => {
        if (editedText.trim() === comment.text || !editedText.trim()) {
            setIsEditing(false);
            return;
        }
        try {
            await updateMissionComment(submissionId, comment.id, editedText.trim());
            setIsEditing(false);
        } catch (error) {
            alert("댓글 수정에 실패했습니다.");
        }
    };

    const handleDeleteComment = async () => {
        if (window.confirm("정말로 이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            try {
                await deleteMissionComment(submissionId, comment.id);
            } catch (error) {
                alert("댓글 삭제에 실패했습니다.");
            }
        }
    };

    return (
        <div>
            <CommentCard>
                <CommentHeader>
                    <CommentAuthor>{comment.commenterName}</CommentAuthor>
                    {isAdmin && (
                        <CommentActions>
                            {isEditing ? (
                                <>
                                    <button onClick={handleUpdateComment}>저장</button>
                                    <button onClick={() => { setIsEditing(false); setEditedText(comment.text); }}>취소</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setIsEditing(true)}>수정</button>
                                    <button onClick={handleDeleteComment}>삭제</button>
                                </>
                            )}
                        </CommentActions>
                    )}
                </CommentHeader>
                {isEditing ? (
                    <CommentTextarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows="3" />
                ) : (
                    <CommentText>{comment.text}</CommentText>
                )}
            </CommentCard>

            {replies.length > 0 && (
                <ReplyList>
                    {replies.map(reply => (
                        <ReplyItem key={reply.id} submissionId={submissionId} commentId={comment.id} reply={reply} missionTitle={missionTitle} />
                    ))}
                </ReplyList>
            )}

            <CommentActions style={{ marginTop: '0.75rem' }}>
                <button onClick={() => setIsReplying(prev => !prev)}>
                    {isReplying ? '답글 취소' : '답글 달기'}
                </button>
            </CommentActions>

            {isReplying && (
                <CommentInputContainer>
                    <CommentTextarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows="2" placeholder="답글을 입력하세요..." />
                    <CommentSubmitButton onClick={handleReplySubmit}>등록</CommentSubmitButton>
                </CommentInputContainer>
            )}
        </div>
    );
}

// HistoryItem, MissionHistoryModal 컴포넌트는 기존과 동일하게 유지됩니다...
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

    const handleLikeFeedback = async () => {
        if (!student) return;
        try {
            await toggleAdminFeedbackLike(item.id, student.id);
        } catch (error) {
            console.error("Failed to like feedback:", error);
            alert("좋아요 처리에 실패했습니다.");
        }
    };

    return (
        <HistoryItemWrapper>
            <HistoryHeader>{formatDate(item.approvedAt || item.requestedAt)} 제출</HistoryHeader>
            <SubmissionDetails>
                {item.text && <p>{item.text}</p>}
                {item.photoUrl && <img src={item.photoUrl} alt="제출 이미지" />}
            </SubmissionDetails>

            {item.adminFeedback && (
                <FeedbackSection>
                    <FeedbackHeader>
                        <span>💬 선생님의 댓글</span>
                        <LikeButton onClick={handleLikeFeedback} title="좋아요!">
                            {item.adminFeedbackLikes?.includes(student?.id) ? '❤️' : '🤍'}
                        </LikeButton>
                    </FeedbackHeader>
                    <p style={{ margin: '0.5rem 0 0' }}>{item.adminFeedback}</p>
                </FeedbackSection>
            )}

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