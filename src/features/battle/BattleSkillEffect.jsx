// src/features/battle/BattleSkillEffect.jsx

import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// ==========================================
// 1. 애니메이션 정의
// ==========================================

// [기본] 직선으로 날아가기 (파이어볼, 씨뿌리기 등)
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

// [NEW] 지그재그로 빠르게 이동 (재빠른 교란용)
const zigzagToOpponent = keyframes`
  0% { left: 100px; bottom: 100px; opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: translate(-30px, 30px) scale(1.2); } /* 왼쪽으로 휙 */
  40% { transform: translate(30px, -30px) scale(0.8); } /* 오른쪽으로 휙 */
  60% { transform: translate(-30px, 30px) scale(1.2); } /* 다시 왼쪽 */
  80% { left: 80%; bottom: 80%; opacity: 1; transform: translate(0, 0) scale(1); }
  100% { left: 85%; bottom: 85%; opacity: 0; transform: scale(2); } /* 타격! */
`;

const zigzagToMe = keyframes`
  0% { right: 100px; top: 100px; opacity: 0; transform: rotate(180deg) scale(0.5); }
  20% { opacity: 1; transform: rotate(180deg) translate(-30px, 30px) scale(1.2); }
  40% { transform: rotate(180deg) translate(30px, -30px) scale(0.8); }
  60% { transform: rotate(180deg) translate(-30px, 30px) scale(1.2); }
  80% { right: 80%; top: 80%; opacity: 1; transform: rotate(180deg) translate(0, 0) scale(1); }
  100% { right: 85%; top: 85%; opacity: 0; transform: rotate(180deg) scale(2); }
`;


// ==========================================
// 2. 스킬별 설정 (애니메이션 타입 추가)
// ==========================================
const SKILL_CONFIG = {
    // [공격 스킬]
    FIERY_BREATH: { icon: '🔥', duration: '1.5s', anim: 'normal' },

    // [디버프/보조 스킬]
    // anim: 'zigzag'로 설정하여 정신없이 움직이게 함
    QUICK_DISTURBANCE: { icon: '💨', duration: '0.6s', anim: 'zigzag' },

    LEECH_SEED: { icon: '🌱', duration: '1.2s', anim: 'normal' },

    // [기타]
    // THUNDER: { icon: '⚡', duration: '0.3s', anim: 'zigzag' }, // 번개도 지그재그가 어울림
};


// ==========================================
// 3. 스타일 컴포넌트
// ==========================================
const EffectContainer = styled.div`
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 50;

  &::after {
    content: '${props => props.$icon}';
    position: absolute;
    font-size: 5rem;
    filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.5));
    
    /* 애니메이션 선택 로직 */
    animation: ${props => {
        if (props.$animType === 'zigzag') {
            return props.$isMine ? zigzagToOpponent : zigzagToMe;
        }
        return props.$isMine ? flyToOpponent : flyToMe;
    }} ${props => props.$duration} ease-in-out forwards;
  }
`;

const BattleSkillEffect = ({ type, isMine }) => {
    // 설정 가져오기 (없으면 기본값)
    const config = SKILL_CONFIG[type] || { icon: '✨', duration: '1s', anim: 'normal' };

    return (
        <EffectContainer
            $icon={config.icon}
            $duration={config.duration}
            $animType={config.anim} // 애니메이션 타입 전달
            $isMine={isMine}
        />
    );
};

export default BattleSkillEffect;