// src/features/battle/BattleSkillEffect.jsx

import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// 1. 애니메이션 정의 (좌→우, 우→좌)
const flyToOpponent = keyframes`
  0% { left: 100px; bottom: 100px; opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: scale(1); }
  90% { left: 80%; bottom: 80%; opacity: 1; transform: scale(1); }
  100% { left: 85%; bottom: 85%; opacity: 0; transform: scale(2); }
`;

const flyToMe = keyframes`
  0% { right: 100px; top: 100px; opacity: 0; transform: rotate(180deg) scale(0.5); }
  20% { opacity: 1; transform: rotate(180deg) scale(1); }
  90% { right: 80%; top: 80%; opacity: 1; transform: rotate(180deg) scale(1); }
  100% { right: 85%; top: 85%; opacity: 0; transform: rotate(180deg) scale(2); }
`;

// 2. 스킬별 설정 (여기에 계속 추가하면 됩니다!)
const SKILL_CONFIG = {
    FIERY_BREATH: { icon: '🔥', duration: '1.5s' },
    QUICK_DISTURBANCE: { icon: '💨', duration: '0.8s' },
    TACKLE: { icon: '💥', duration: '0.5s' }, // 예시
    LEECH_SEED: { icon: '🌱', duration: '1.2s' }, // 예시
    // 나중에 스킬이 추가되면 여기에 한 줄씩만 넣으면 끝!
};

// 3. 스타일 컴포넌트
const EffectContainer = styled.div`
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 50;

  &::after {
    content: '${props => props.$icon}';
    position: absolute;
    font-size: 4rem;
    
    /* 내 공격이면 flyToOpponent, 상대 공격이면 flyToMe */
    animation: ${props => props.$isMine ? flyToOpponent : flyToMe} 
               ${props => props.$duration} ease-in forwards;
  }
`;

const BattleSkillEffect = ({ type, isMine }) => {
    // 스킬 정보 가져오기 (없으면 기본값)
    const config = SKILL_CONFIG[type] || { icon: '✨', duration: '1s' };

    return (
        <EffectContainer
            $icon={config.icon}
            $duration={config.duration}
            $isMine={isMine}
        />
    );
};

export default BattleSkillEffect;