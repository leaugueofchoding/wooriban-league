// src/components/Badges.jsx

import React from 'react';
import styled from 'styled-components';

const BadgeWrapper = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: ${props => props.bgColor || '#007bff'};
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1rem;
  font-weight: bold;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  border: 2px solid white;
`;

export function CaptainBadge() {
    return (
        <BadgeWrapper bgColor="#007bff" title="주장">
            Ⓒ
        </BadgeWrapper>
    );
}

export function TopScorerBadge() {
    return (
        <BadgeWrapper bgColor="#28a745" title="득점왕">
            ⚽
        </BadgeWrapper>
    );
}
