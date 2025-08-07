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

// [수정] onClick 핸들러를 props로 받도록 변경
function Footer({ onVersionClick }) {
  const version = "v4.3"; // 현재 앱 버전
  const lastUpdate = "2025-08-07"; // 마지막 업데이트 날짜

  return (
    <FooterWrapper onClick={onVersionClick}>
      <VersionInfo>
        Wooriban League {version} | Last Updated: {lastUpdate}
      </VersionInfo>
    </FooterWrapper>
  );
}

export default Footer;