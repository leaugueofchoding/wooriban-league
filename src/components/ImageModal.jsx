// src/components/ImageModal.jsx

import React from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const ModalBackground = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  animation: ${fadeIn} 0.3s ease-out;
  cursor: pointer;
`;

const ModalContent = styled.div`
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative; // 자식 요소의 position absolute를 위해 추가
`;

const FullSizeImage = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  display: block;
  border-radius: 8px;
  object-fit: contain;
  transform: rotate(${props => props.$rotation || 0}deg);
  transition: transform 0.2s ease-in-out;
`;

// ▼▼▼ [신규] 회전 버튼 스타일 추가 ▼▼▼
const RotateButton = styled.button`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  cursor: pointer;
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }
`;


const ImageModal = ({ src, rotation, onClose, onRotate }) => {
  if (!src) return null;

  const handleRotateClick = (e) => {
    e.stopPropagation(); // 배경 클릭(닫기) 이벤트 방지
    if (onRotate) {
      onRotate();
    }
  };

  return (
    <ModalBackground onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <FullSizeImage src={src} $rotation={rotation} alt="미션 제출 이미지 원본" />
        {/* ▼▼▼ [수정] onRotate prop이 있을 때만 회전 버튼을 보여줍니다. ▼▼▼ */}
        {onRotate && (
          <RotateButton onClick={handleRotateClick}>↻</RotateButton>
        )}
      </ModalContent>
    </ModalBackground>
  );
};

export default ImageModal;