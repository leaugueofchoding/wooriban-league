// src/components/Footer.jsx

import React from 'react';
import styled from 'styled-components';

const FooterWrapper = styled.footer`
  width: 100%;
  padding: 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  margin-top: auto; /* 푸터를 항상 아래에 위치시킴 */
  cursor: pointer; /* 클릭 가능하도록 커서 변경 */

  &:hover {
    background-color: #e9ecef;
  }
`;

const VersionInfo = styled.p`
  margin: 0;
`;

function Footer({ onVersionClick }) {
  const version = "v4.5"; // [업데이트] 퀴즈 & 마이룸 대규모 업데이트
  const lastUpdate = "2026-01-14"; // [업데이트] 오늘 날짜

  return (
    <FooterWrapper onClick={onVersionClick}>
      <VersionInfo>
        Wooriban League {version} | Last Updated: {lastUpdate}
      </VersionInfo>
    </FooterWrapper>
  );
}

export default Footer;