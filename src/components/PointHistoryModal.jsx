// src/components/PointHistoryModal.jsx

import React from 'react';
import styled from 'styled-components';

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  width: 90%;
  max-width: 500px;
  background-color: white;
  border-radius: 10px;
  padding: 2rem;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  color: #333;
`;

const ModalTitle = styled.h2`
  text-align: center;
  margin-top: 0;
  margin-bottom: 1.5rem;
`;

const HistoryList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 40vh;
  overflow-y: scroll;
`;

const HistoryItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 8px;
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
`;

const PointChange = styled.span`
  font-weight: bold;
  min-width: 60px;
  text-align: right;
  /* 👇 [수정됨] isPositive -> $isPositive 로 변경 */
  color: ${props => (props.$isPositive ? '#007bff' : '#dc3545')};
`;

const Reason = styled.span`
  flex-grow: 1;
  margin: 0 1rem;
  text-align: left;
`;

const Timestamp = styled.span`
  font-size: 0.9em;
  color: #6c757d;
  min-width: 80px;
`;

const CloseButton = styled.button`
    margin-top: 1.5rem;
    width: 100%;
    padding: 0.8rem;
    border: none;
    border-radius: 8px;
    background-color: #007bff;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    &:hover {
        background-color: #0056b3;
    }
`;


const PointHistoryModal = ({ isOpen, onClose, history }) => {
    if (!isOpen) return null;

    const formatDate = (timestamp) => {
        if (!timestamp?.seconds) return '날짜 없음';
        const date = timestamp.toDate();
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle>포인트 변동 내역 🪙</ModalTitle>
                <HistoryList>
                    {history.length > 0 ? (
                        history.map(item => (
                            <HistoryItem key={item.id}>
                                <Timestamp>{formatDate(item.timestamp)}</Timestamp>
                                <Reason>{item.reason}</Reason>
                                {/* 👇 [수정됨] isPositive -> $isPositive 로 변경 */}
                                <PointChange $isPositive={item.changeAmount > 0}>
                                    {item.changeAmount > 0 ? `+${item.changeAmount}` : item.changeAmount} P
                                </PointChange>
                            </HistoryItem>
                        ))
                    ) : (
                        <p style={{ textAlign: 'center', padding: '2rem 0' }}>포인트 변동 내역이 없습니다.</p>
                    )}
                </HistoryList>
                <CloseButton onClick={onClose}>닫기</CloseButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default PointHistoryModal;