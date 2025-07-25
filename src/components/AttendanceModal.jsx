// src/components/AttendanceModal.jsx

import React from 'react';
import styled from 'styled-components';
import { useLeagueStore } from '../store/leagueStore';
import confetti from 'canvas-confetti';

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
  max-width: 400px;
  background-color: white;
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
  color: #333;
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.8rem;
  color: #007bff;
`;

const ModalText = styled.p`
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
`;

const ClaimButton = styled.button`
    width: 100%;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    background-color: #28a745;
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
    &:hover {
        background-color: #218838;
    }
`;

const CloseButton = styled.button`
    margin-top: 0.5rem;
    background: none;
    border: none;
    color: #6c757d;
    cursor: pointer;
    font-size: 0.9rem;
`;

const AttendanceModal = () => {
    const { showAttendanceModal, claimAttendanceReward, closeAttendanceModal } = useLeagueStore();

    if (!showAttendanceModal) {
        return null;
    }

    const handleClaim = () => {
        // 꽃가루 효과!
        confetti({
            particleCount: 200,
            spread: 70,
            origin: { y: 0.6 }
        });
        claimAttendanceReward();
    };

    return (
        <ModalBackground>
            <ModalContainer>
                <ModalTitle>🎉 첫 접속! 출석 체크 🎉</ModalTitle>
                <ModalText>
                    오늘 하루도 우리반 리그에 참여해주셔서 감사합니다!
                    <br />
                    출석 보상으로 <strong>50포인트</strong>를 드려요.
                </ModalText>
                <ClaimButton onClick={handleClaim}>
                    보상 받기
                </ClaimButton>
                <CloseButton onClick={closeAttendanceModal}>다음에 받을게요</CloseButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default AttendanceModal;