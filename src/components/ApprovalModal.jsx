// src/components/ApprovalModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { approveMissionsInBatch, rejectMissionSubmission, addMissionComment, toggleSubmissionLike, toggleSubmissionImageRotation } from '../api/firebase';
import { auth, db } from '../api/firebase';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import CommentThread from './CommentThread';

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
  color: #333;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const ModalTitle = styled.h2`
  text-align: center;
  margin-top: 0;
  margin-bottom: 1.5rem;
`;

const CloseButton = styled.button`
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
`;

const NavButton = styled.button`
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background-color: rgba(0,0,0,0.5);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
    cursor: pointer;
    &:hover {
        background-color: rgba(0,0,0,0.8);
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
`;

const PrevButton = styled(NavButton)`
    left: -60px;
`;

const NextButton = styled(NavButton)`
    right: -60px;
`;


const ContentArea = styled.div`
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 1rem;
`;

const StudentInfo = styled.div`
    font-weight: bold;
    font-size: 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const LikeButton = styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: 2rem;
    transition: transform 0.2s;
    &:hover { transform: scale(1.2); }
`;


const SubmissionDetails = styled.div`
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 1rem;

    p {
        white-space: pre-wrap;
        margin-top: 0;
    }
    
    img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
    }
`;

const ImageContainer = styled.div`
  position: relative;
  margin-top: 0.5rem;
`;

const RotateButton = styled.button`
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
`;

const CommentSection = styled.div`
    margin-top: 1.5rem;
    h4 { margin-bottom: 0.5rem; }
`;

const CommentInputContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
`;

const CommentTextarea = styled.textarea`
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    resize: vertical;
`;

const SaveButton = styled.button`
    padding: 0.75rem 1rem;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    &:hover { background-color: #0056b3; }
`;


const ButtonGroup = styled.div`
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
`;

const ActionButton = styled.button`
    padding: 0.8rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    min-width: 120px;
    
    &:disabled {
        background-color: #6c757d;
        cursor: not-allowed;
    }
`;

const RejectButton = styled(ActionButton)`
    background-color: #ffc107;
    color: black;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
`;

const ApproveButton = styled(ActionButton)`
    background-color: #28a745;
    color: white;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
`;

const StatusMessage = styled.div`
    text-align: center;
    font-weight: bold;
    font-size: 1.2rem;
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    background-color: ${props => props.status === 'approved' ? '#eaf7f0' : '#fbe9eb'};
    color: ${props => props.status === 'approved' ? '#28a745' : '#dc3545'};
`;

const CommentList = styled.div`
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const getSafeKeyFromUrl = (url) => {
    try {
        return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        return url.replace(/[^a-zA-Z0-9]/g, '');
    }
};

const ApprovalModal = ({ submission, onClose, onNext, onPrev, currentIndex, totalCount, onAction, onImageClick }) => {
    const { players, missions } = useLeagueStore();
    const [status, setStatus] = useState(submission.status);
    const [newComment, setNewComment] = useState('');
    const [comments, setComments] = useState([]);
    const [likes, setLikes] = useState(submission.likes || []);
    const [rotations, setRotations] = useState(submission.rotations || {});

    const student = useMemo(() => players.find(p => p.id === submission.studentId), [players, submission]);
    const mission = useMemo(() => missions.find(m => m.id === submission.missionId), [missions, submission]);
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);

    useEffect(() => {
        setStatus(submission.status);
        setLikes(submission.likes || []);
        setRotations(submission.rotations || {});

        const commentsRef = collection(db, "missionSubmissions", submission.id, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();

    }, [submission]);

    const handleAction = async (action, reward) => {
        try {
            if (action === 'approve') {
                await approveMissionsInBatch(mission.id, [student.id], myPlayerData.id, reward);
                setStatus('approved');
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
                setStatus('rejected');
            }
            onAction();
        } catch (error) {
            alert(`처리 중 오류 발생: ${error.message}`);
        }
    };

    const isTieredReward = mission?.rewards && mission.rewards.length > 1;

    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !myPlayerData) return;
        try {
            await addMissionComment(
                submission.id,
                {
                    commenterId: myPlayerData.id,
                    commenterName: myPlayerData.name,
                    commenterRole: myPlayerData.role,
                    text: newComment,
                },
                student.authUid,
                mission.title
            );
            setNewComment('');
        } catch (error) {
            alert('댓글 저장에 실패했습니다.');
        }
    };

    const handleLike = async () => {
        if (!myPlayerData) return alert("사용자 정보를 찾을 수 없습니다.");
        try {
            await toggleSubmissionLike(submission.id, myPlayerData.id);
        } catch (error) {
            alert("좋아요 처리에 실패했습니다.");
        }
    };

    const handleRotate = async (url) => {
        try {
            await toggleSubmissionImageRotation(submission.id, url);
            const imageKey = getSafeKeyFromUrl(url);
            setRotations(prev => ({
                ...prev,
                [imageKey]: ((prev[imageKey] || 0) + 90) % 360
            }));
        } catch (error) {
            console.error("Rotation update failed: ", error);
            alert("이미지 회전 정보 저장에 실패했습니다.");
        }
    };

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <CloseButton onClick={onClose}>✕</CloseButton>
                <ModalTitle>미션 승인 요청 확인</ModalTitle>
                <ContentArea>
                    <StudentInfo>
                        <span>{student?.name} - "{mission?.title}"</span>
                        <LikeButton onClick={handleLike}>
                            {likes.includes(myPlayerData?.id) ? '❤️' : '🤍'}
                            <span style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>{likes.length}</span>
                        </LikeButton>
                    </StudentInfo>
                    <SubmissionDetails>
                        {submission.text && <p>{submission.text}</p>}
                        {submission.photoUrls && submission.photoUrls.map((url, index) => {
                            const imageKey = getSafeKeyFromUrl(url);
                            const rotation = rotations[imageKey] || 0;
                            return (
                                <ImageContainer key={index}>
                                    <img
                                        src={url}
                                        alt={`제출사진 ${index + 1}`}
                                        onClick={() => onImageClick({ src: url, rotation })}
                                        style={{ transform: `rotate(${rotation}deg)` }}
                                    />
                                    <RotateButton onClick={(e) => { e.stopPropagation(); handleRotate(url); }}>↻</RotateButton>
                                </ImageContainer>
                            );
                        })}
                    </SubmissionDetails>

                    <CommentSection>
                        <h4>▼ 댓글</h4>
                        <CommentList>
                            {comments.map(comment => (
                                <CommentThread
                                    key={comment.id}
                                    submissionId={submission.id}
                                    comment={comment}
                                    missionTitle={mission.title}
                                    permissions={{ canLike: true, canReply: true, canEdit: myPlayerData?.role === 'admin' }}
                                />
                            ))}
                        </CommentList>
                        {status === 'pending' && (
                            <CommentInputContainer>
                                <CommentTextarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="피드백 댓글을 입력하세요..."
                                />
                                <SaveButton onClick={handleCommentSubmit}>댓글 저장</SaveButton>
                            </CommentInputContainer>
                        )}
                    </CommentSection>

                    {status === 'pending' ? (
                        <ButtonGroup>
                            <RejectButton onClick={() => handleAction('reject')}>반려하기</RejectButton>
                            {isTieredReward ? (
                                mission.rewards.map(reward => (
                                    <ApproveButton key={reward} onClick={() => handleAction('approve', reward)}>
                                        {reward}P 승인
                                    </ApproveButton>
                                ))
                            ) : (
                                <ApproveButton onClick={() => handleAction('approve', mission.reward)}>승인하기</ApproveButton>
                            )}
                        </ButtonGroup>
                    ) : (
                        <StatusMessage status={status}>
                            {status === 'approved' ? '✅ 승인 처리되었습니다.' : '↩️ 반려 처리되었습니다.'}
                        </StatusMessage>
                    )}
                </ContentArea>
                <PrevButton onClick={onPrev} disabled={currentIndex === 0}>◀</PrevButton>
                <NextButton onClick={onNext} disabled={currentIndex === totalCount - 1}>▶</NextButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default ApprovalModal;