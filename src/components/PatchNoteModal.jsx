// src/components/PatchNoteModal.jsx

import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const ModalBackground = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ModalContainer = styled.div`
  width: 90%;
  max-width: 600px;
  background-color: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  text-align: left;
  color: #333;
  animation: ${slideUp} 0.4s ease-out;
`;

const ModalTitle = styled.h2`
  margin-top: 0;
  text-align: center;
  margin-bottom: 1.5rem;
`;

const ContentArea = styled.div`
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 1rem;
`;

const VersionHeader = styled.h3`
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
`;

const ChangeList = styled.ul`
  list-style: none;
  padding-left: 0;
  li {
    margin-bottom: 0.5rem;
    line-height: 1.6;
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


const PatchNoteModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <ModalBackground onClick={onClose}>
            <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle>🚀 우리반 리그 패치 노트</ModalTitle>
                <ContentArea>
                    {/* ▼▼▼ [추가] 최신 업데이트 내역 ▼▼▼ */}
                    <VersionHeader>v4.1 (2025-07-30)</VersionHeader>
                    <ChangeList>
                        <li>🚀 **[기능개선]** 리그 홈 실시간 업데이트: 경기 결과 저장 시, 순위표와 경기 일정이 애니메이션과 함께 즉시 갱신됩니다.</li>
                        <li>🚀 **[기능개선]** 알림창 UX 개선: 알림창 외부를 클릭해도 창이 닫히도록 수정되었습니다.</li>
                        <li>✅ **[버그수정]** 아바타 렌더링 오류 수정: 선수 기록 페이지 등에서 여러 개의 액세서리를 착용한 아바타가 정상적으로 표시되도록 수정했습니다.</li>
                    </ChangeList>
                    {/* ▲▲▲ 여기까지 추가 ▲▲▲ */}

                    <VersionHeader>v4.final (2024-07-26)</VersionHeader>
                    <ChangeList>
                        <li>✅ **[버그수정]** 선수 비활성화 기능 추가 (데이터 보존)</li>
                        <li>✅ **[버그수정]** 퀴즈 문제 고정 (localStorage 활용)</li>
                        <li>✅ **[버그수정]** 경기 결과 저장 오류 해결</li>
                        <li>🚀 **[기능개선]** 기록원 UX 대폭 개선 (+, - 버튼, 자책골, 자동 점수 차감)</li>
                        <li>🚀 **[기능개선]** 모바일 화면 최적화 (대시보드, 리그홈, 상점)</li>
                        <li>🚀 **[기능개선]** 프로필 편집 UX 개선 (이름/성별 동시 수정)</li>
                        <li>✨ **[신규기능]** 건의사항 시스템 (1:1 소통, 관리자 답변 및 알림)</li>
                        <li>✨ **[신규기능]** 포인트 변동 실시간 알림 모달 기능</li>
                        <li>✨ **[신규기능]** 득점왕 보상 시스템 추가</li>
                        <li>✨ **[신규기능]** 선수 기록 페이지 강화 (시즌/랭킹 탭 분리, 정렬 기능)</li>
                        <li>✨ **[신규기능]** 프로필 성별 등록 및 팀 자동 배정 로직 개선</li>
                    </ChangeList>
                </ContentArea>
                <CloseButton onClick={onClose}>닫기</CloseButton>
            </ModalContainer>
        </ModalBackground>
    );
};

export default PatchNoteModal;