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
`;

const VersionInfo = styled.p`
  margin: 0;
`;

function Footer() {
    const version = "v4.1"; // 현재 앱 버전
    const lastUpdate = "2024-07-26"; // 마지막 업데이트 날짜

    return (
        <FooterWrapper>
            <VersionInfo>
                Wooriban League {version} | Last Updated: {lastUpdate}
            </VersionInfo>
        </FooterWrapper>
    );
}

export default Footer;