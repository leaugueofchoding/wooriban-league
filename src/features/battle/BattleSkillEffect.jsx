// src/features/battle/BattleSkillEffect.jsx

import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// ==========================================
// 1. 애니메이션 정의
// ==========================================

/* [Type: PROJECTILE] 발사체 (파이어볼, 씨뿌리기) */
const flyToOpponent = keyframes`
  0% { left: 20%; bottom: 20%; opacity: 0; transform: scale(0.5) rotate(0deg); }
  20% { opacity: 1; transform: scale(1.2) rotate(0deg); }
  80% { left: 75%; bottom: 75%; opacity: 1; transform: scale(1) rotate(360deg); }
  100% { left: 80%; bottom: 80%; opacity: 0; transform: scale(2) rotate(720deg); }
`;

const flyToMe = keyframes`
  0% { right: 20%; top: 20%; opacity: 0; transform: scale(0.5) rotate(0deg); }
  20% { opacity: 1; transform: scale(1.2) rotate(0deg); }
  80% { right: 75%; top: 75%; opacity: 1; transform: scale(1) rotate(-360deg); }
  100% { right: 80%; top: 80%; opacity: 0; transform: scale(2) rotate(-720deg); }
`;

/* [Type: ZIGZAG] 지그재그 이동 (재빠른 교란) */
const zigzagToOpponent = keyframes`
  0% { left: 20%; bottom: 20%; opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: translate(10%, -10%) scale(1.2); }
  40% { transform: translate(20%, 10%) scale(0.9); }
  60% { transform: translate(40%, -10%) scale(1.1); }
  85% { left: 75%; bottom: 75%; opacity: 1; transform: translate(0, 0) scale(1.5); }
  100% { left: 80%; bottom: 80%; opacity: 0; transform: scale(2); }
`;

const zigzagToMe = keyframes`
  0% { right: 20%; top: 20%; opacity: 0; transform: scale(0.5); }
  20% { opacity: 1; transform: translate(-10%, 10%) scale(1.2); }
  40% { transform: translate(-20%, -10%) scale(0.9); }
  60% { transform: translate(-40%, 10%) scale(1.1); }
  85% { right: 75%; top: 75%; opacity: 1; transform: translate(0, 0) scale(1.5); }
  100% { right: 80%; top: 80%; opacity: 0; transform: scale(2); }
`;

/* [Type: DROP] 하늘에서 떨어짐 (번개) */
const dropOnOpponent = keyframes`
  0% { left: 75%; top: -20%; opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.5); }
  80% { left: 75%; top: 20%; opacity: 1; transform: scale(1); } /* 타격 지점 */
  90% { transform: scale(2.5); filter: brightness(2); } /* 번쩍 */
  100% { left: 75%; top: 25%; opacity: 0; transform: scale(0.5); }
`;

const dropOnMe = keyframes`
  0% { left: 25%; top: -20%; opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.5); }
  80% { left: 25%; top: 60%; opacity: 1; transform: scale(1); } /* 타격 지점 */
  90% { transform: scale(2.5); filter: brightness(2); }
  100% { left: 25%; top: 65%; opacity: 0; transform: scale(0.5); }
`;

/* [Type: BUFF] 자신에게 사용 (회복, 버프) */
const buffSelf = (isMine) => keyframes`
  0% { ${isMine ? 'left: 20%; bottom: 20%;' : 'right: 20%; top: 20%;'} opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.5) translateY(-20px); }
  100% { ${isMine ? 'left: 20%; bottom: 25%;' : 'right: 20%; top: 15%;'} opacity: 0; transform: scale(2); }
`;

// ==========================================
// 2. 스킬별 설정
// ==========================================
const SKILL_CONFIG = {
  // [공격: 투사체]
  FIERY_BREATH: { icon: '🔥', duration: '1.2s', type: 'PROJECTILE' },
  LEECH_SEED: { icon: '🌱', duration: '1.5s', type: 'PROJECTILE' },

  // [공격: 교란]
  QUICK_DISTURBANCE: { icon: '💨', duration: '0.8s', type: 'ZIGZAG' },

  // [공격: 낙하]
  THUNDER: { icon: '⚡', duration: '0.8s', type: 'DROP' },

  // [공격: 근접/타격]
  SCRATCH: { icon: '💥', duration: '0.5s', type: 'PROJECTILE' }, // 빠르게 날아가서 타격

  // [보조: 버프/회복]
  HEAL: { icon: '💖', duration: '1.2s', type: 'BUFF' },
  IRON_DEFENSE: { icon: '🛡️', duration: '1.0s', type: 'BUFF' },
};

// ==========================================
// 3. 애니메이션 선택 로직
// ==========================================
const getAnimation = (type, isMine) => {
  switch (type) {
    case 'ZIGZAG':
      return isMine ? zigzagToOpponent : zigzagToMe;
    case 'DROP':
      return isMine ? dropOnOpponent : dropOnMe; // 내가 쓰면 상대 머리 위(Opponent), 상대가 쓰면 내 머리 위(Me)
    case 'BUFF':
      return buffSelf(isMine);
    case 'PROJECTILE':
    default:
      return isMine ? flyToOpponent : flyToMe;
  }
};

// ==========================================
// 4. 스타일 컴포넌트
// ==========================================
const EffectContainer = styled.div`
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 50;
  overflow: hidden; /* 이펙트가 경기장 밖으로 나가는 것 방지 */

  &::after {
    content: '${props => props.$icon}';
    position: absolute;
    font-size: 4rem; /* 아이콘 크기 확대 */
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 20px ${props => props.$isMine ? '#339af0' : '#fa5252'});
    
    /* 애니메이션 적용 */
    animation: ${props => getAnimation(props.$animType, props.$isMine)} ${props => props.$duration} ease-in-out forwards;
  }
`;

const BattleSkillEffect = ({ type, isMine }) => {
  // 설정 가져오기 (없으면 기본값: 반짝임)
  const config = SKILL_CONFIG[type] || { icon: '✨', duration: '1s', type: 'PROJECTILE' };

  return (
    <EffectContainer
      $icon={config.icon}
      $duration={config.duration}
      $animType={config.type}
      $isMine={isMine}
    />
  );
};

export default BattleSkillEffect;