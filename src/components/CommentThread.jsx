// src/components/CommentThread.jsx

import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, addMissionReply, updateMissionComment, deleteMissionComment, toggleCommentLike, toggleReplyLike } from '../api/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// Styled Components
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
    white-space: pre-wrap;
`;
const CommentActions = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
    button {
        background: none;
        border: 1px solid #bce0fd;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.8rem;
        cursor: pointer;
        &:hover { background: #d0eaff; }
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
const LikeButton = styled.button`
    background: none; border: none; cursor: pointer;
    font-size: 1.2rem; display: flex; align-items: center; gap: 0.25rem;
    color: ${props => props.$isLiked ? '#dc3545' : '#6c757d'};
    &:hover { transform: scale(1.1); }
`;

function ReplyItem({ submissionId, commentId, reply, permissions }) {
    const { players } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(reply.text);

    const handleLike = () => {
        if (!myPlayerData || !permissions.canLike) return;
        toggleReplyLike(submissionId, commentId, reply.id, myPlayerData.id);
    };

    const handleUpdate = () => {
        if (!editedText.trim()) return;
        updateMissionComment(submissionId, commentId, editedText.trim(), reply.id)
            .then(() => setIsEditing(false))
            .catch(e => alert("답글 수정 실패: " + e.message));
    };

    const handleDelete = () => {
        if (window.confirm("이 답글을 삭제하시겠습니까?")) {
            deleteMissionComment(submissionId, commentId, reply.id)
                .catch(e => alert("답글 삭제 실패: " + e.message));
        }
    };

    return (
        <CommentCard style={{ backgroundColor: '#d0eaff' }}>
            <CommentHeader>
                <CommentAuthor>{reply.replierName}</CommentAuthor>
                <CommentActions>
                    {permissions.canLike && (
                        <LikeButton onClick={handleLike} $isLiked={reply.likes?.includes(myPlayerData?.id)}>
                            ♡<span>{reply.likes?.length || 0}</span>
                        </LikeButton>
                    )}
                    {permissions.canEdit && isEditing && (<>
                        <button onClick={handleUpdate}>저장</button>
                        <button onClick={() => setIsEditing(false)}>취소</button>
                    </>)}
                    {permissions.canEdit && !isEditing && (<>
                        <button onClick={() => setIsEditing(true)}>수정</button>
                        <button onClick={handleDelete}>삭제</button>
                    </>)}
                </CommentActions>
            </CommentHeader>
            {isEditing ? (<CommentTextarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows="2" />) : (<CommentText>{reply.text}</CommentText>)}
        </CommentCard>
    );
}

function CommentThread({ submissionId, comment, missionTitle, permissions }) {
    const { players } = useLeagueStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const [replies, setReplies] = useState([]);
    const [isReplying, setIsReplying] = useState(false);
    const [replyContent, setReplyContent] = useState('');
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

    const handleLike = () => {
        if (!myPlayerData || !permissions.canLike) return;
        toggleCommentLike(submissionId, comment.id, myPlayerData.id);
    };

    const handleUpdateComment = () => {
        if (!editedText.trim()) return;
        updateMissionComment(submissionId, comment.id, editedText.trim())
            .then(() => setIsEditing(false))
            .catch(e => alert("댓글 수정 실패: " + e.message));
    };

    const handleDeleteComment = () => {
        if (window.confirm("이 댓글과 모든 답글을 삭제하시겠습니까?")) {
            deleteMissionComment(submissionId, comment.id)
                .catch(e => alert("댓글 삭제 실패: " + e.message));
        }
    };

    const handleReplySubmit = () => {
        if (!replyContent.trim() || !myPlayerData) return;
        const originalCommenter = players.find(p => p.id === comment.commenterId);
        addMissionReply(
            submissionId,
            comment.id,
            { replierId: myPlayerData.id, replierName: myPlayerData.name, text: replyContent, likes: [] },
            { missionTitle, commenterAuthUid: originalCommenter?.authUid }
        ).then(() => {
            setReplyContent('');
            setIsReplying(false);
        }).catch(e => alert("답글 등록 실패: " + e.message));
    };

    return (
        <div>
            <CommentCard>
                <CommentHeader>
                    <CommentAuthor>{comment.commenterName}</CommentAuthor>
                    <CommentActions>
                        {permissions.canLike && (
                            <LikeButton onClick={handleLike} $isLiked={comment.likes?.includes(myPlayerData?.id)}>
                                ♡<span>{comment.likes?.length || 0}</span>
                            </LikeButton>
                        )}
                        {permissions.canEdit && isEditing && (<>
                            <button onClick={handleUpdateComment}>저장</button>
                            <button onClick={() => { setIsEditing(false); setEditedText(comment.text); }}>취소</button>
                        </>)}
                        {permissions.canEdit && !isEditing && (<>
                            <button onClick={() => setIsEditing(true)}>수정</button>
                            <button onClick={handleDeleteComment}>삭제</button>
                        </>)}
                    </CommentActions>
                </CommentHeader>
                {isEditing ? (<CommentTextarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows="3" />) : (<CommentText>{comment.text}</CommentText>)}
            </CommentCard>

            {replies.length > 0 && (
                <ReplyList>
                    {replies.map(reply => (
                        <ReplyItem key={reply.id} submissionId={submissionId} commentId={comment.id} reply={reply} permissions={permissions} />
                    ))}
                </ReplyList>
            )}

            {permissions.canReply && (
                <>
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
                </>
            )}
        </div>
    );
}

export default CommentThread;