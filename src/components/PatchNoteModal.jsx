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
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  span.date {
    font-size: 0.85rem;
    color: #888;
    font-weight: normal;
  }
`;

const ChangeList = styled.ul`
  list-style: none;
  padding-left: 0;
  li {
    margin-bottom: 0.6rem;
    line-height: 1.6;
    word-break: keep-all;
  }
  li strong {
    color: #2c3e50;
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
    transition: background-color 0.2s;
    &:hover {
        background-color: #5a6268;
    }
`;


const PatchNoteModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <ModalBackground onClick={onClose}>
      <ModalContainer onClick={e => e.stopPropagation()}>
        <ModalTitle>🚀 우리반 리그 업데이트 노트</ModalTitle>
        <ContentArea>
          {/* ▼▼▼ [v4.5] 대규모 업데이트 내역 ▼▼▼ */}
          <VersionHeader>
            v4.5 ✨ 퀴즈 시스템 대혁신
            <span className="date">2026-01-14</span>
          </VersionHeader>
          <ChangeList>
            <li>📚 <strong>[문제은행 개편]</strong> 기존의 단순 퀴즈 방식에서 벗어나, 선생님이 직접 <strong>'문제집(Quiz Set)'</strong> 단위로 퀴즈를 만들고 관리할 수 있는 시스템이 구축되었습니다.</li>
            <li>💾 <strong>[DB 전면 연동]</strong> 파일로 관리되던 하드코딩 퀴즈를 모두 데이터베이스(DB)로 이관하여, <strong>실시간 수정 및 삭제</strong>가 가능해졌습니다.</li>
            <li>🔄 <strong>[다중 출제 시스템]</strong> 수학, 상식, 넌센스 등 <strong>여러 문제집을 동시에 선택</strong>하여 우리 반 퀴즈로 출제할 수 있습니다. (학생들은 선택된 문제집들의 퀴즈를 랜덤으로 풀게 됩니다!)</li>
            <li>⚔️ <strong>[펫 배틀 연동]</strong> 펫 배틀 대전에서도 선생님이 설정한 <strong>실시간 문제집의 퀴즈</strong>가 출제되도록 연동 작업을 완료했습니다.</li>
            <li>🎨 <strong>[UI/UX 개선]</strong> 심플 모드 대시보드의 테마 팔레트 디자인을 개선하고, 화면 하단에 깔끔하게 배치하여 사용성을 높였습니다.</li>
            <li>🗑️ <strong>[최적화]</strong> 레거시 데이터 파일(missions.json)을 제거하고 시스템 구조를 경량화했습니다.</li>
          </ChangeList>

          <VersionHeader>
            v4.3
            <span className="date">2025-08-07</span>
          </VersionHeader>
          <ChangeList>
            <li>✨ <strong>[신규]</strong> TV 송출 화면에 <strong>실시간 경기 타이머</strong> 기능이 추가되었습니다.</li>
            <li>✨ <strong>[신규]</strong> 경기 종료 시, 승리팀 화면에 <strong>축하 콘페티(폭죽) 효과</strong>가 재생됩니다.</li>
            <li>✨ <strong>[신규]</strong> 관리자 대시보드에서 <strong>미션 순서를 드래그</strong>하여 변경할 수 있습니다.</li>
            <li>🚀 <strong>[개선]</strong> 기록원 대시보드에 <strong>TV 송출 화면 미리보기</strong>가 추가되었습니다.</li>
            <li>🚀 <strong>[개선]</strong> 상점 아이템 구매 경험(UX)이 개선되었습니다.</li>
          </ChangeList>

          <VersionHeader>
            v4.2
            <span className="date">2025-08-06</span>
          </VersionHeader>
          <ChangeList>
            <li>✨ <strong>[신규]</strong> 마이룸 편집에 '수정 모드'가 도입되어 오작동을 방지합니다.</li>
            <li>🚀 <strong>[개선]</strong> 마이룸 아이템 중복 배치 및 수량 조절 기능이 강화되었습니다.</li>
            <li>🚀 <strong>[개선]</strong> 미션 관리 기능 강화 (차등 보상, 고정 미션 등)</li>
          </ChangeList>

          <VersionHeader>
            v4.1
            <span className="date">2025-07-30</span>
          </VersionHeader>
          <ChangeList>
            <li>🚀 <strong>[개선]</strong> 미션 제출 방식에 [글쓰기]와 [사진 인증] 옵션이 추가되었습니다.</li>
            <li>🚀 <strong>[개선]</strong> 리그 홈 화면의 순위표와 경기 일정이 실시간으로 자동 갱신됩니다.</li>
          </ChangeList>
        </ContentArea>
        <CloseButton onClick={onClose}>닫기</CloseButton>
      </ModalContainer>
    </ModalBackground>
  );
};

export default PatchNoteModal;