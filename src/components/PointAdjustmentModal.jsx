// src/components/PointAdjustmentModal.jsx

import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import confetti from 'canvas-confetti';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalContainer = styled.div`
  width: 90%;
  max-width: 400px;
  background-color: white;
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
  color: #333;
  animation: ${slideUp} 0.4s ease-out;
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.8rem;
  color: ${props => (props.$isPositive ? '#007bff' : '#dc3545')};
`;

const ModalText = styled.p`
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  line-height: 1.6;
`;

const PointChange = styled.p`
    font-size: 2.5rem;
    font-weight: bold;
    margin: 1.5rem 0;
    color: ${props => (props.$isPositive ? '#28a745' : '#dc3545')};
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

const PointAdjustmentModal = () => {
    const { pointAdjustmentNotification, clearPointAdjustmentNotification } = useLeagueStore();

    useEffect(() => {
        if (pointAdjustmentNotification?.data?.amount > 0) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }, [pointAdjustmentNotification]);

    if (!pointAdjustmentNotification) {
        return null;
    }

    const { title, data } = pointAdjustmentNotification;
    const { amount, reason } = data;
    const isPositive = amount > 0;

    return (
        <ModalBackground onClick={clearPointAdjustmentNotification}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle $isPositive={isPositive}>{title}</ModalTitle>
                <ModalText>사유: <strong>{reason}</strong></ModalText>
                <PointChange $isPositive={isPositive}>
                    {isPositive ? `+${amount.toLocaleString()}` : amount.toLocaleString()} P
                </PointChange>
                <CloseButton onClick={clearPointAdjustmentNotification}>확인</CloseButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default PointAdjustmentModal;