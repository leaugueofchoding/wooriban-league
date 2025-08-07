// src/components/MissionHistoryModal.jsx

import React, { useState } from 'react';
import styled from 'styled-components';

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
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const HistoryList = styled.div`
  max-height: 60vh;
  overflow-y: auto;
`;

const HistoryItem = styled.div`
  border-bottom: 1px solid #eee;
  &:last-child {
    border-bottom: none;
  }
`;

const HistoryHeader = styled.div`
  padding: 1rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
`;

const SubmissionDetails = styled.div`
    padding: ${props => props.$isOpen ? '1rem' : '0 1rem'};
    max-height: ${props => props.$isOpen ? '1000px' : '0'};
    opacity: ${props => props.$isOpen ? 1 : 0};
    overflow: hidden;
    transition: all 0.4s ease-in-out;
    background-color: #f8f9fa;

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

const MissionHistoryModal = ({ isOpen, onClose, missionTitle, history }) => {
    const [openItemId, setOpenItemId] = useState(null);

    if (!isOpen) return null;

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '날짜 정보 없음';
        return timestamp.toDate().toLocaleDateString('ko-KR');
    };

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle>'{missionTitle}' 지난 기록 보기</ModalTitle>
                <HistoryList>
                    {history.length > 0 ? (
                        history.map(item => (
                            <HistoryItem key={item.id}>
                                <HistoryHeader onClick={() => setOpenItemId(openItemId === item.id ? null : item.id)}>
                                    <span>{formatDate(item.approvedAt || item.requestedAt)} 제출</span>
                                    <span>{openItemId === item.id ? '▲' : '▼'}</span>
                                </HistoryHeader>
                                <SubmissionDetails $isOpen={openItemId === item.id}>
                                    {item.text && <p>{item.text}</p>}
                                    {item.photoUrl && <img src={item.photoUrl} alt="제출 이미지" />}
                                </SubmissionDetails>
                            </HistoryItem>
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