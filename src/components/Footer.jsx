// src/components/Footer.jsx

import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom'; // Link import 추가

const FooterWrapper = styled.footer`
  width: 100%;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: #868e96;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  align-items: center;
`;

const Links = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const FooterLink = styled(Link)`
  color: #495057;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;

  &:hover {
    color: #339af0;
    text-decoration: underline;
  }
`;

const Separator = styled.span`
  color: #dee2e6;
  font-size: 0.8rem;
`;

const VersionInfo = styled.p`
  margin: 0;
  cursor: pointer;
  display: inline-block;
  
  &:hover {
    color: #495057;
    text-decoration: underline;
  }
`;

const Copyright = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: #adb5bd;
`;

function Footer({ onVersionClick }) {
  const version = "v4.5"; // [업데이트] 퀴즈 & 마이룸 대규모 업데이트
  const lastUpdate = "2026-01-14"; // [업데이트] 오늘 날짜

  return (
    <FooterWrapper>
      <Links>
        <FooterLink to="/terms?tab=terms">이용약관</FooterLink>
        <Separator>|</Separator>
        <FooterLink to="/terms?tab=privacy">개인정보처리방침</FooterLink>
      </Links>

      <VersionInfo onClick={onVersionClick}>
        Wooriban League {version} | Last Updated: {lastUpdate}
      </VersionInfo>

      <Copyright>
        © 2026 우리반 리그. All rights reserved.
      </Copyright>
    </FooterWrapper>
  );
}

export default Footer;