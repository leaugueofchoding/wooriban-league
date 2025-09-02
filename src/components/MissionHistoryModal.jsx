// src/components/MissionHistoryModal.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import { auth, db, toggleSubmissionImageRotation } from '../api/firebase';
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

function HistoryItem({ item, student, missionTitle, onImageClick }) {
    const { players } = useLeagueStore();
    const [comments, setComments] = useState([]);
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const [rotations, setRotations] = useState(item.rotations || {});

    const canRotate = myPlayerData?.role === 'admin' || myPlayerData?.id === student.id;

    useEffect(() => {
        setRotations(item.rotations || {}); // 부모 컴포넌트에서 item이 바뀔 때마다 rotations 상태 업데이트
        const commentsRef = collection(db, "missionSubmissions", item.id, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [item]);

    const handleRotate = async (url) => {
        if (!canRotate) return;
        try {
            await toggleSubmissionImageRotation(item.id, url);
            const imageKey = getSafeKeyFromUrl(url);
            setRotations(prev => ({ ...prev, [imageKey]: ((prev[imageKey] || 0) + 90) % 360 }));
        } catch (error) {
            console.error("Rotation update failed:", error);
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
                {item.photoUrls && item.photoUrls.map((url, index) => {
                    const imageKey = getSafeKeyFromUrl(url);
                    const rotation = rotations[imageKey] || 0;
                    return (
                        <ImageContainer key={index}>
                            <img
                                src={url}
                                alt={`제출 이미지 ${index + 1}`}
                                style={{ transform: `rotate(${rotation}deg)` }}
                                onClick={() => onImageClick({ src: url, rotation, canRotate: canRotate, submissionId: item.id })}
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

const MissionHistoryModal = ({ isOpen, onClose, missionTitle, history, student, onImageClick }) => {
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