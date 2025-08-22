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
`;

const FullSizeImage = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  display: block;
  border-radius: 8px;
  object-fit: contain;
`;

const ImageModal = ({ src, onClose }) => {
    if (!src) return null;

    return (
        <ModalBackground onClick={onClose}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
                <FullSizeImage src={src} alt="미션 제출 이미지 원본" />
            </ModalContent>
        </ModalBackground>
    );
};

export default ImageModal;