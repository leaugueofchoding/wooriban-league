// src/components/MissionHistoryModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore'; // useClassStore import
import { auth, db, toggleSubmissionImageRotation, cancelMissionApproval } from '../api/firebase';
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
        cursor: pointer;
    }
`;

const ImageContainer = styled.div`
  position: relative;
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

const getSafeKeyFromUrl = (url) => {
    try {
        return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch (e) {
        return url.replace(/[^a-zA-Z0-9]/g, '');
    }
};

function HistoryItem({ item, student, missionTitle, missions, onImageClick, onRefresh }) {
    const { players, missions: storeMissions } = useLeagueStore();
    const { classId } = useClassStore();
    const [comments, setComments] = useState([]);
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const [rotations, setRotations] = useState(item.rotations || {});
    const [isCancelling, setIsCancelling] = useState(false);

    const canRotate = myPlayerData?.role === 'admin' || myPlayerData?.id === student.id;
    const isAdmin = myPlayerData?.role === 'admin';

    // 이 제출에 해당하는 미션 정보 (차등 보상 여부 확인용)
    const relatedMission = useMemo(() =>
        storeMissions.find(m => m.id === item.missionId),
        [storeMissions, item.missionId]
    );
    const isTieredReward = relatedMission?.rewards && relatedMission.rewards.length > 1;
    const originalReward = item.approvedReward || relatedMission?.reward || 0;

    useEffect(() => {
        setRotations(item.rotations || {});
        if (!classId) return;

        const commentsRef = collection(db, "classes", classId, "missionSubmissions", item.id, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [item, classId]);

    const handleRotate = async (url) => {
        if (!canRotate || !classId) return;
        try {
            await toggleSubmissionImageRotation(classId, item.id, url);
            const imageKey = getSafeKeyFromUrl(url);
            setRotations(prev => ({ ...prev, [imageKey]: ((prev[imageKey] || 0) + 90) % 360 }));
        } catch (error) {
            console.error("Rotation update failed:", error);
        }
    };

    // [이슈 8] 승인 취소 핸들러
    const handleCancelApproval = async () => {
        if (!classId || !isAdmin) return;
        if (!window.confirm(`'${missionTitle}' 미션 승인을 취소하고 ${originalReward}P를 회수하시겠습니까?`)) return;
        setIsCancelling(true);
        try {
            await cancelMissionApproval(classId, item.id, originalReward, null);
            alert('승인이 취소되었습니다. 포인트가 회수되었습니다.');
            if (onRefresh) onRefresh();
        } catch (e) {
            alert(`취소 실패: ${e.message}`);
        } finally {
            setIsCancelling(false);
        }
    };

    // [이슈 8] 차등 보상 정정 핸들러
    const handleCorrectReward = async (newReward) => {
        if (!classId || !isAdmin) return;
        if (newReward === originalReward) return alert('현재 보상과 동일한 금액입니다.');
        const diff = newReward - originalReward;
        const diffText = diff > 0 ? `+${diff}P 추가 지급` : `${diff}P 회수`;
        if (!window.confirm(`보상을 ${originalReward}P → ${newReward}P로 정정합니다.\n(${diffText})`)) return;
        setIsCancelling(true);
        try {
            await cancelMissionApproval(classId, item.id, originalReward, newReward);
            alert(`보상이 ${newReward}P로 정정되었습니다.`);
            if (onRefresh) onRefresh();
        } catch (e) {
            alert(`정정 실패: ${e.message}`);
        } finally {
            setIsCancelling(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '날짜 정보 없음';
        return timestamp.toDate().toLocaleString('ko-KR');
    };

    const handleImageClick = (imageData) => {
        if (onImageClick) onImageClick(imageData);
    };

    return (
        <HistoryItemWrapper>
            <HistoryHeader>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>
                        {formatDate(item.approvedAt || item.requestedAt)} 제출
                        {item.status === 'approved' && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: '#d3f9d8', color: '#2f9e44', padding: '2px 7px', borderRadius: '6px', fontWeight: 700 }}>
                                승인완료 ({originalReward}P)
                            </span>
                        )}
                    </span>
                    {/* [이슈 8] 관리자 전용 승인 취소 / 보상 정정 버튼 */}
                    {isAdmin && item.status === 'approved' && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {isTieredReward ? (
                                <>
                                    <span style={{ fontSize: '0.8rem', color: '#868e96', alignSelf: 'center' }}>보상 정정:</span>
                                    {relatedMission.rewards.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => handleCorrectReward(r)}
                                            disabled={isCancelling}
                                            style={{ padding: '3px 8px', fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${r === originalReward ? '#adb5bd' : '#339af0'}`, borderRadius: '6px', background: r === originalReward ? '#f1f3f5' : '#e7f5ff', color: r === originalReward ? '#adb5bd' : '#1c7ed6', cursor: r === originalReward ? 'not-allowed' : 'pointer' }}
                                        >
                                            {r}P
                                        </button>
                                    ))}
                                    <span style={{ color: '#dee2e6' }}>|</span>
                                </>
                            ) : null}
                            <button
                                onClick={handleCancelApproval}
                                disabled={isCancelling}
                                style={{ padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, border: '1px solid #fa5252', borderRadius: '6px', background: '#fff5f5', color: '#fa5252', cursor: 'pointer' }}
                            >
                                {isCancelling ? '처리중...' : '↩️ 승인 취소'}
                            </button>
                        </div>
                    )}
                </div>
            </HistoryHeader>
            <SubmissionDetails>
                {item.text && <p>{item.text}</p>}
                {item.photoUrls && item.photoUrls.map((url, index) => {
                    const imageKey = getSafeKeyFromUrl(url);
                    const rotation = rotations[imageKey] || 0;
                    return (
                        <ImageContainer key={index}>
                            <img
                                src={url}
                                alt={`제출 이미지 ${index + 1}`}
                                style={{ transform: `rotate(${rotation}deg)` }}
                                onClick={() => handleImageClick({ src: url, rotation, canRotate: canRotate, submissionId: item.id })}
                            />
                            {canRotate && <RotateButton onClick={(e) => { e.stopPropagation(); handleRotate(url); }}>↻</RotateButton>}
                        </ImageContainer>
                    )
                })}
            </SubmissionDetails>

            <CommentSection>
                <CommentList>
                    {comments.map(comment => (
                        <CommentThread
                            key={comment.id}
                            classId={classId}
                            submissionId={item.id}
                            comment={comment}
                            missionTitle={missionTitle}
                            permissions={{ canLike: true, canReply: true, canEdit: myPlayerData?.role === 'admin' || myPlayerData?.id === comment.commenterId }}
                        />
                    ))}
                </CommentList>
            </CommentSection>
        </HistoryItemWrapper>
    );
}

const MissionHistoryModal = ({ isOpen, onClose, missionTitle, history, student, onImageClick, onRefresh }) => {
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
                                onImageClick={onImageClick}
                                onRefresh={onRefresh}
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