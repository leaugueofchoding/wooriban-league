// src/components/ApprovalModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { approveMissionsInBatch, rejectMissionSubmission, upsertAdminFeedback, deleteAdminFeedback } from '../api/firebase';
import { auth } from '../api/firebase';

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

const StudentInfo = styled.p`
    font-weight: bold;
    font-size: 1.2rem;
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
        margin-top: 0.5rem;
        cursor: pointer;
    }
`;

const CommentSection = styled.div`
    margin-top: 1.5rem;
    h4 { margin-bottom: 0.5rem; }
`;

const CommentTextarea = styled.textarea`
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    resize: vertical;
`;

const FeedbackInputContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
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
    padding: 0.6rem 1rem; /* [수정] 버튼 크기 축소 */
    font-size: 0.9rem;
`;

const ApproveButton = styled(ActionButton)`
    background-color: #28a745;
    color: white;
    padding: 0.6rem 1rem; /* [수정] 버튼 크기 축소 */
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


const ApprovalModal = ({ submission, onClose, onNext, onPrev, currentIndex, totalCount, onAction, onImageClick }) => {
    const { players, missions } = useLeagueStore();
    const [status, setStatus] = useState(submission.status);
    const [feedback, setFeedback] = useState(submission.adminFeedback || '');
    const [isEditingFeedback, setIsEditingFeedback] = useState(!submission.adminFeedback);

    const student = useMemo(() => players.find(p => p.id === submission.studentId), [players, submission]);
    const mission = useMemo(() => missions.find(m => m.id === submission.missionId), [missions, submission]);
    const currentUser = auth.currentUser;

    useEffect(() => {
        setStatus(submission.status);
    }, [submission]);

    const handleAction = async (action, reward) => {
        try {
            if (action === 'approve') {
                await approveMissionsInBatch(mission.id, [student.id], currentUser.uid, reward);
                setStatus('approved');
            } else if (action === 'reject') {
                await rejectMissionSubmission(submission.id, student.authUid, mission.title);
                setStatus('rejected');
            }
            onAction(); // 부모 컴포넌트에 상태 변경 알림
        } catch (error) {
            alert(`처리 중 오류 발생: ${error.message}`);
        }
    };

    const isTieredReward = mission?.rewards && mission.rewards.length > 1;

    const handleSaveFeedback = async () => {
        if (!feedback.trim()) return;
        try {
            await upsertAdminFeedback(submission.id, feedback);
            setIsEditingFeedback(false);
        } catch (error) {
            alert('댓글 저장에 실패했습니다.');
        }
    };

    const handleDeleteFeedback = async () => {
        if (window.confirm("정말로 댓글을 삭제하시겠습니까?")) {
            try {
                await deleteAdminFeedback(submission.id);
                setFeedback('');
                setIsEditingFeedback(true);
            } catch (error) {
                alert('댓글 삭제에 실패했습니다.');
            }
        }
    };

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <CloseButton onClick={onClose}>✕</CloseButton>
                <ModalTitle>미션 승인 요청 확인</ModalTitle>
                <ContentArea>
                    <StudentInfo>{student?.name} - "{mission?.title}"</StudentInfo>
                    <SubmissionDetails>
                        {submission.text && <p>{submission.text}</p>}
                        {submission.photoUrls && submission.photoUrls.map((url, index) => (
                            <img key={index} src={url} alt={`제출사진 ${index + 1}`} onClick={() => onImageClick(url)} />
                        ))}
                    </SubmissionDetails>

                    <CommentSection>
                        <h4>댓글 달기</h4>
                        {isEditingFeedback ? (
                            <FeedbackInputContainer>
                                <CommentTextarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="피드백을 입력하세요..."
                                />
                                <SaveButton onClick={handleSaveFeedback}>저장</SaveButton>
                            </FeedbackInputContainer>
                        ) : (
                            <SubmissionDetails style={{ background: '#e9ecef' }}>
                                <p>{feedback}</p>
                                <div style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setIsEditingFeedback(true)}>수정</button>
                                    <button onClick={handleDeleteFeedback}>삭제</button>
                                </div>
                            </SubmissionDetails>
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