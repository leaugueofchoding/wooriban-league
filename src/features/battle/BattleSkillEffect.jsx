// src/features/battle/BattleSkillEffect.jsx

import React from 'react';
import styled, { keyframes, css } from 'styled-components';

// ==========================================
// 1. 기본 이동 애니메이션
// ==========================================

const flyToOpponent = keyframes`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.4) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.3) rotate(0deg); }
  80%  { left: 72%; bottom: 72%; opacity: 1; transform: scale(1) rotate(360deg); }
  100% { left: 78%; bottom: 78%; opacity: 0; transform: scale(2.2) rotate(720deg); }
`;
const flyToMe = keyframes`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.4) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.3) rotate(0deg); }
  80%  { right: 72%; top: 72%; opacity: 1; transform: scale(1) rotate(-360deg); }
  100% { right: 78%; top: 78%; opacity: 0; transform: scale(2.2) rotate(-720deg); }
`;

const zigzagToOpponent = keyframes`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.3); filter: brightness(1); }
  12%  { opacity: 1; transform: translate(5%, -15%) scale(1.4); filter: brightness(1.8) drop-shadow(0 0 10px #74c0fc); }
  28%  { transform: translate(22%, 10%) scale(0.9); filter: brightness(2.2); }
  44%  { transform: translate(40%, -18%) scale(1.3); filter: brightness(2.8) drop-shadow(0 0 16px #74c0fc); }
  60%  { left: 60%; bottom: 62%; transform: translate(0,0) scale(1.0); filter: brightness(2); }
  78%  { left: 70%; bottom: 70%; transform: scale(2.2); filter: brightness(3.5) drop-shadow(0 0 22px #339af0); }
  100% { left: 76%; bottom: 76%; opacity: 0; transform: scale(3.5); filter: brightness(1); }
`;
const zigzagToMe = keyframes`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.3); filter: brightness(1); }
  12%  { opacity: 1; transform: translate(-5%, 15%) scale(1.4); filter: brightness(1.8) drop-shadow(0 0 10px #74c0fc); }
  28%  { transform: translate(-22%, -10%) scale(0.9); filter: brightness(2.2); }
  44%  { transform: translate(-40%, 18%) scale(1.3); filter: brightness(2.8) drop-shadow(0 0 16px #74c0fc); }
  60%  { right: 60%; top: 62%; transform: translate(0,0) scale(1.0); filter: brightness(2); }
  78%  { right: 70%; top: 70%; transform: scale(2.2); filter: brightness(3.5) drop-shadow(0 0 22px #339af0); }
  100% { right: 76%; top: 76%; opacity: 0; transform: scale(3.5); filter: brightness(1); }
`;

const dropOnOpponent = keyframes`
  0%   { left: 72%; top: -15%; opacity: 0; transform: scale(0.5); }
  25%  { opacity: 1; transform: scale(1.6); }
  75%  { left: 72%; top: 18%; opacity: 1; transform: scale(1); }
  88%  { transform: scale(3); filter: brightness(2.5); }
  100% { left: 72%; top: 22%; opacity: 0; transform: scale(0.4); }
`;
const dropOnMe = keyframes`
  0%   { left: 25%; top: -15%; opacity: 0; transform: scale(0.5); }
  25%  { opacity: 1; transform: scale(1.6); }
  75%  { left: 25%; top: 58%; opacity: 1; transform: scale(1); }
  88%  { transform: scale(3); filter: brightness(2.5); }
  100% { left: 25%; top: 62%; opacity: 0; transform: scale(0.4); }
`;

const buffSelf = (isMine) => keyframes`
  0%   { ${isMine ? 'left:18%;bottom:18%;' : 'right:18%;top:18%;'} opacity:0; transform:scale(0.5); }
  40%  { opacity:1; transform:scale(1.6) translateY(-18px); }
  100% { ${isMine ? 'left:18%;bottom:24%;' : 'right:18%;top:12%;'} opacity:0; transform:scale(2.2); }
`;

// ==========================================
// 2. 특수 이펙트 애니메이션
// ==========================================

// 독침: 초록 독구슬이 퍼진 후 해골이 나타남
const poisonFly = keyframes`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.3) rotate(0deg); }
  20%  { opacity: 1; transform: scale(1.4) rotate(-20deg); }
  70%  { left: 68%; bottom: 70%; opacity: 1; transform: scale(1.1) rotate(10deg); }
  85%  { transform: scale(2.5) rotate(0deg); filter: drop-shadow(0 0 12px #69db7c); }
  100% { left: 74%; bottom: 76%; opacity: 0; transform: scale(0.6); }
`;
const poisonFlyToMe = keyframes`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.3) rotate(0deg); }
  20%  { opacity: 1; transform: scale(1.4) rotate(20deg); }
  70%  { right: 68%; top: 70%; opacity: 1; transform: scale(1.1) rotate(-10deg); }
  85%  { transform: scale(2.5) rotate(0deg); filter: drop-shadow(0 0 12px #69db7c); }
  100% { right: 74%; top: 76%; opacity: 0; transform: scale(0.6); }
`;

// 잔불: 불꽃이 위로 솟구치며 날아감
const remFireFly = keyframes`
  0%   { left: 18%; bottom: 18%; opacity: 0; transform: scale(0.4) translateY(0); }
  10%  { opacity: 1; transform: scale(1.2) translateY(-8px); filter: brightness(1.5); }
  40%  { left: 45%; bottom: 48%; transform: scale(1.5) translateY(-20px); filter: brightness(2); }
  75%  { left: 68%; bottom: 68%; opacity: 1; transform: scale(1.1) translateY(0); }
  90%  { transform: scale(3); filter: brightness(3) drop-shadow(0 0 16px #ff6b35); }
  100% { left: 74%; bottom: 74%; opacity: 0; transform: scale(0.5); }
`;
const remFireFlyToMe = keyframes`
  0%   { right: 18%; top: 18%; opacity: 0; transform: scale(0.4) translateY(0); }
  10%  { opacity: 1; transform: scale(1.2) translateY(8px); filter: brightness(1.5); }
  40%  { right: 45%; top: 48%; transform: scale(1.5) translateY(20px); filter: brightness(2); }
  75%  { right: 68%; top: 68%; opacity: 1; transform: scale(1.1) translateY(0); }
  90%  { transform: scale(3); filter: brightness(3) drop-shadow(0 0 16px #ff6b35); }
  100% { right: 74%; top: 74%; opacity: 0; transform: scale(0.5); }
`;

// 업화: 화염폭풍 — 아래서 위로 거대하게 폭발
const uphwaExplode = keyframes`
  0%   { left: 50%; bottom: 0%; opacity: 0; transform: scale(0.2) translateX(-50%); }
  15%  { opacity: 1; transform: scale(1.8) translateX(-50%) translateY(-10px); filter: brightness(2); }
  40%  { left: 50%; bottom: 30%; transform: scale(3) translateX(-50%) translateY(-30px); filter: brightness(3) drop-shadow(0 0 30px #ff4500); }
  70%  { left: 50%; bottom: 55%; transform: scale(4) translateX(-50%); filter: brightness(4); }
  100% { left: 50%; bottom: 65%; opacity: 0; transform: scale(5) translateX(-50%); }
`;
const uphwaExplodeToMe = keyframes`
  0%   { left: 50%; top: 100%; opacity: 0; transform: scale(0.2) translateX(-50%); }
  15%  { opacity: 1; transform: scale(1.8) translateX(-50%) translateY(10px); filter: brightness(2); }
  40%  { left: 50%; top: 55%; transform: scale(3) translateX(-50%) translateY(30px); filter: brightness(3) drop-shadow(0 0 30px #ff4500); }
  70%  { left: 50%; top: 30%; transform: scale(4) translateX(-50%); filter: brightness(4); }
  100% { left: 50%; top: 15%; opacity: 0; transform: scale(5) translateX(-50%); }
`;

// 스텔라 블라스트: 하늘에서 별폭발
const stellarExplode = keyframes`
  0%   { left: 72%; top: -20%; opacity: 0; transform: scale(0.3) rotate(0deg); }
  20%  { opacity: 1; transform: scale(2) rotate(180deg); filter: brightness(3) drop-shadow(0 0 20px #fff176); }
  60%  { left: 72%; top: 10%; transform: scale(3.5) rotate(360deg); filter: brightness(5) drop-shadow(0 0 40px #ffd43b); }
  85%  { transform: scale(5); filter: brightness(6); }
  100% { left: 72%; top: 20%; opacity: 0; transform: scale(1.5) rotate(540deg); }
`;
const stellarExplodeToMe = keyframes`
  0%   { left: 25%; top: -20%; opacity: 0; transform: scale(0.3) rotate(0deg); }
  20%  { opacity: 1; transform: scale(2) rotate(180deg); filter: brightness(3) drop-shadow(0 0 20px #fff176); }
  60%  { left: 25%; top: 55%; transform: scale(3.5) rotate(360deg); filter: brightness(5) drop-shadow(0 0 40px #ffd43b); }
  85%  { transform: scale(5); filter: brightness(6); }
  100% { left: 25%; top: 65%; opacity: 0; transform: scale(1.5) rotate(540deg); }
`;

// 용의 숨결: 입에서 화염이 뿜어져 나오며 퍼짐
const breathSweep = keyframes`
  0%   { left: 20%; bottom: 40%; opacity: 0; transform: scale(0.4) scaleX(0.5); }
  20%  { opacity: 1; transform: scale(1.2) scaleX(1.5); filter: brightness(2); }
  55%  { left: 55%; bottom: 55%; transform: scale(2) scaleX(2.5); filter: brightness(3) drop-shadow(0 0 20px #ff4500); }
  85%  { left: 75%; bottom: 65%; transform: scale(3) scaleX(3); filter: brightness(4); }
  100% { left: 80%; bottom: 70%; opacity: 0; transform: scale(4); }
`;
const breathSweepToMe = keyframes`
  0%   { right: 20%; top: 40%; opacity: 0; transform: scale(0.4) scaleX(0.5); }
  20%  { opacity: 1; transform: scale(1.2) scaleX(1.5); filter: brightness(2); }
  55%  { right: 55%; top: 55%; transform: scale(2) scaleX(2.5); filter: brightness(3) drop-shadow(0 0 20px #ff4500); }
  85%  { right: 75%; top: 65%; transform: scale(3) scaleX(3); filter: brightness(4); }
  100% { right: 80%; top: 70%; opacity: 0; transform: scale(4); }
`;

// 토네이도: 회오리가 아래서 올라감 (강화)
const tornadoRise = keyframes`
  0%   { left: 60%; bottom: 0%; opacity: 0; transform: scale(0.2) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.2) rotate(270deg); filter: drop-shadow(0 0 10px #74c0fc); }
  35%  { left: 64%; bottom: 25%; transform: scale(2.0) rotate(540deg); filter: brightness(1.8) drop-shadow(0 0 20px #339af0); }
  55%  { left: 67%; bottom: 48%; transform: scale(3.0) rotate(810deg); filter: brightness(2.5) drop-shadow(0 0 30px #74c0fc); }
  75%  { left: 69%; bottom: 65%; transform: scale(4.0) rotate(1080deg); filter: brightness(3.5) drop-shadow(0 0 40px #339af0); }
  90%  { transform: scale(5.0) rotate(1260deg); filter: brightness(5); }
  100% { left: 71%; bottom: 72%; opacity: 0; transform: scale(3.0) rotate(1440deg); }
`;
const tornadoRiseToMe = keyframes`
  0%   { left: 28%; top: 100%; opacity: 0; transform: scale(0.2) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.2) rotate(-270deg); filter: drop-shadow(0 0 10px #74c0fc); }
  35%  { left: 27%; top: 70%; transform: scale(2.0) rotate(-540deg); filter: brightness(1.8) drop-shadow(0 0 20px #339af0); }
  55%  { left: 26%; top: 48%; transform: scale(3.0) rotate(-810deg); filter: brightness(2.5) drop-shadow(0 0 30px #74c0fc); }
  75%  { left: 25%; top: 28%; transform: scale(4.0) rotate(-1080deg); filter: brightness(3.5) drop-shadow(0 0 40px #339af0); }
  90%  { transform: scale(5.0) rotate(-1260deg); filter: brightness(5); }
  100% { left: 24%; top: 20%; opacity: 0; transform: scale(3.0) rotate(-1440deg); }
`;

// 뇌우: 위에서 쾅
const thunderBolt = keyframes`
  0%   { left: 72%; top: -10%; opacity: 0; transform: scale(0.6); }
  15%  { opacity: 1; transform: scale(2); filter: brightness(3); }
  45%  { left: 72%; top: 15%; transform: scale(1.5); filter: brightness(4) drop-shadow(0 0 20px #ffd43b); }
  70%  { transform: scale(3.5); filter: brightness(6); }
  100% { left: 72%; top: 20%; opacity: 0; transform: scale(0.8); }
`;
const thunderBoltToMe = keyframes`
  0%   { left: 25%; top: -10%; opacity: 0; transform: scale(0.6); }
  15%  { opacity: 1; transform: scale(2); filter: brightness(3); }
  45%  { left: 25%; top: 60%; transform: scale(1.5); filter: brightness(4) drop-shadow(0 0 20px #ffd43b); }
  70%  { transform: scale(3.5); filter: brightness(6); }
  100% { left: 25%; top: 65%; opacity: 0; transform: scale(0.8); }
`;

// 솔라 빔: 빛줄기가 모였다 발사
const solarCharge = keyframes`
  0%   { left: 18%; bottom: 35%; opacity: 0; transform: scale(0.3); }
  20%  { opacity: 1; transform: scale(2.5); filter: brightness(4) drop-shadow(0 0 30px #fff176); }
  40%  { transform: scale(1); }
  70%  { left: 72%; bottom: 60%; opacity: 1; transform: scale(1.5) scaleX(4); filter: brightness(5) drop-shadow(0 0 25px #ffd43b); }
  100% { left: 76%; bottom: 64%; opacity: 0; transform: scale(3); }
`;
const solarChargeToMe = keyframes`
  0%   { right: 18%; top: 35%; opacity: 0; transform: scale(0.3); }
  20%  { opacity: 1; transform: scale(2.5); filter: brightness(4) drop-shadow(0 0 30px #fff176); }
  40%  { transform: scale(1); }
  70%  { right: 72%; top: 60%; opacity: 1; transform: scale(1.5) scaleX(4); filter: brightness(5) drop-shadow(0 0 25px #ffd43b); }
  100% { right: 76%; top: 64%; opacity: 0; transform: scale(3); }
`;

// 씨뿌리기: 씨앗이 날아가 초록 파동이 퍼짐
const seedFly = keyframes`
  0%   { left: 18%; bottom: 20%; opacity: 0; transform: scale(0.5) rotate(0deg); }
  25%  { opacity: 1; transform: scale(1.2) rotate(180deg); }
  70%  { left: 68%; bottom: 65%; opacity: 1; transform: scale(1) rotate(360deg); }
  85%  { transform: scale(2.8); filter: drop-shadow(0 0 15px #69db7c) brightness(1.5); }
  100% { left: 72%; bottom: 70%; opacity: 0; transform: scale(4); }
`;
const seedFlyToMe = keyframes`
  0%   { right: 18%; top: 20%; opacity: 0; transform: scale(0.5) rotate(0deg); }
  25%  { opacity: 1; transform: scale(1.2) rotate(-180deg); }
  70%  { right: 68%; top: 65%; opacity: 1; transform: scale(1) rotate(-360deg); }
  85%  { transform: scale(2.8); filter: drop-shadow(0 0 15px #69db7c) brightness(1.5); }
  100% { right: 72%; top: 70%; opacity: 0; transform: scale(4); }
`;

// 덩굴 채찍: 덩굴이 가로질러 휘어짐
const vineWhip = keyframes`
  0%   { left: 18%; bottom: 30%; opacity: 0; transform: scale(0.4) rotate(-30deg); }
  20%  { opacity: 1; transform: scale(1.5) rotate(0deg); filter: drop-shadow(0 0 8px #40c057); }
  60%  { left: 65%; bottom: 60%; transform: scale(2) rotate(15deg) scaleX(2.5); filter: brightness(2) drop-shadow(0 0 12px #40c057); }
  85%  { transform: scale(2.5) scaleX(1.5); }
  100% { left: 70%; bottom: 65%; opacity: 0; transform: scale(3); }
`;
const vineWhipToMe = keyframes`
  0%   { right: 18%; top: 30%; opacity: 0; transform: scale(0.4) rotate(30deg); }
  20%  { opacity: 1; transform: scale(1.5) rotate(0deg); filter: drop-shadow(0 0 8px #40c057); }
  60%  { right: 65%; top: 60%; transform: scale(2) rotate(-15deg) scaleX(2.5); filter: brightness(2) drop-shadow(0 0 12px #40c057); }
  85%  { transform: scale(2.5) scaleX(1.5); }
  100% { right: 70%; top: 65%; opacity: 0; transform: scale(3); }
`;

// 에너지 사이펀: 흡수 소용돌이
const siphonPull = keyframes`
  0%   { left: 65%; bottom: 60%; opacity: 0; transform: scale(3) rotate(0deg); }
  30%  { opacity: 1; transform: scale(1.8) rotate(-180deg); filter: drop-shadow(0 0 15px #cc5de8); }
  70%  { left: 25%; bottom: 30%; transform: scale(1) rotate(-360deg); filter: brightness(2); }
  100% { left: 20%; bottom: 25%; opacity: 0; transform: scale(0.5) rotate(-540deg); }
`;
const siphonPullToMe = keyframes`
  0%   { right: 65%; top: 60%; opacity: 0; transform: scale(3) rotate(0deg); }
  30%  { opacity: 1; transform: scale(1.8) rotate(180deg); filter: drop-shadow(0 0 15px #cc5de8); }
  70%  { right: 25%; top: 30%; transform: scale(1) rotate(360deg); filter: brightness(2); }
  100% { right: 20%; top: 25%; opacity: 0; transform: scale(0.5) rotate(540deg); }
`;

// 불꽃 질주: 빠르게 가로지름
const flameDash = keyframes`
  0%   { left: 10%; bottom: 20%; opacity: 0; transform: scale(0.3) scaleX(0.5); }
  10%  { opacity: 1; transform: scale(1.5) scaleX(3); filter: brightness(3) drop-shadow(0 0 20px #ff6b35); }
  50%  { left: 45%; bottom: 50%; transform: scale(1.8) scaleX(4); filter: brightness(4); }
  80%  { left: 72%; bottom: 68%; transform: scale(2) scaleX(2); }
  100% { left: 76%; bottom: 72%; opacity: 0; transform: scale(3) scaleX(1); }
`;
const flameDashToMe = keyframes`
  0%   { right: 10%; top: 20%; opacity: 0; transform: scale(0.3) scaleX(0.5); }
  10%  { opacity: 1; transform: scale(1.5) scaleX(3); filter: brightness(3) drop-shadow(0 0 20px #ff6b35); }
  50%  { right: 45%; top: 50%; transform: scale(1.8) scaleX(4); filter: brightness(4); }
  80%  { right: 72%; top: 68%; transform: scale(2) scaleX(2); }
  100% { right: 76%; top: 72%; opacity: 0; transform: scale(3) scaleX(1); }
`;

// 찌릿 할퀴기: 전기 발톱 3회 연타
const scratchStrike = keyframes`
  0%   { left: 60%; bottom: 55%; opacity: 0; transform: scale(0.5) rotate(-45deg); }
  20%  { opacity: 1; transform: scale(1.5) rotate(0deg); filter: brightness(2); }
  40%  { transform: scale(2) rotate(15deg); filter: brightness(3) drop-shadow(0 0 10px #ffd43b); }
  60%  { transform: scale(1.2) rotate(-10deg); }
  80%  { transform: scale(2.5) rotate(5deg); filter: brightness(3.5); }
  100% { left: 65%; bottom: 60%; opacity: 0; transform: scale(0.8); }
`;
const scratchStrikeToMe = keyframes`
  0%   { right: 60%; top: 55%; opacity: 0; transform: scale(0.5) rotate(45deg); }
  20%  { opacity: 1; transform: scale(1.5) rotate(0deg); filter: brightness(2); }
  40%  { transform: scale(2) rotate(-15deg); filter: brightness(3) drop-shadow(0 0 10px #ffd43b); }
  60%  { transform: scale(1.2) rotate(10deg); }
  80%  { transform: scale(2.5) rotate(-5deg); filter: brightness(3.5); }
  100% { right: 65%; top: 60%; opacity: 0; transform: scale(0.8); }
`;

// 도트딜 - 화상 (위로 불꽃 솟구침)
export const burnDotAnim = keyframes`
  0%   { opacity: 0; transform: translateY(0) scale(0.6); }
  20%  { opacity: 1; transform: translateY(-12px) scale(1.2); filter: brightness(2); }
  60%  { opacity: 1; transform: translateY(-35px) scale(1); filter: brightness(1.5); }
  100% { opacity: 0; transform: translateY(-60px) scale(0.4); filter: brightness(1); }
`;

// 도트딜 - 중독 (독구슬 퍼짐)
export const poisonDotAnim = keyframes`
  0%   { opacity: 0; transform: scale(0.4); }
  30%  { opacity: 1; transform: scale(1.3); filter: drop-shadow(0 0 8px #69db7c); }
  65%  { opacity: 0.7; transform: scale(1.8); filter: drop-shadow(0 0 15px #40c057); }
  100% { opacity: 0; transform: scale(2.8); }
`;

// 찌릿펀치: 주먹 아이콘 직선 돌진
const punchFlyToOpponent = keyframes`
  0%   { left: 20%; bottom: 20%; opacity: 0; transform: scale(0.5) rotate(-10deg); }
  12%  { opacity: 1; transform: scale(1.4) rotate(0deg); filter: brightness(2) drop-shadow(0 0 12px #ffd43b); }
  55%  { left: 65%; bottom: 65%; opacity: 1; transform: scale(1.1) rotate(5deg); filter: brightness(1.8); }
  80%  { left: 72%; bottom: 72%; transform: scale(2.5); filter: brightness(3) drop-shadow(0 0 25px #ffd43b); }
  100% { left: 76%; bottom: 76%; opacity: 0; transform: scale(0.8); }
`;
const punchFlyToMe = keyframes`
  0%   { right: 20%; top: 20%; opacity: 0; transform: scale(0.5) rotate(10deg); }
  12%  { opacity: 1; transform: scale(1.4) rotate(0deg); filter: brightness(2) drop-shadow(0 0 12px #ffd43b); }
  55%  { right: 65%; top: 65%; opacity: 1; transform: scale(1.1) rotate(-5deg); filter: brightness(1.8); }
  80%  { right: 72%; top: 72%; transform: scale(2.5); filter: brightness(3) drop-shadow(0 0 25px #ffd43b); }
  100% { right: 76%; top: 76%; opacity: 0; transform: scale(0.8); }
`;
// 찌릿펀치: 번개 보조 아이콘 (약간 뒤따라감)
const lightningTrailToOpponent = keyframes`
  0%   { left: 15%; bottom: 15%; opacity: 0; transform: scale(0.3); }
  20%  { opacity: 0.9; transform: scale(1.1); filter: brightness(3) drop-shadow(0 0 15px #ffd43b); }
  65%  { left: 68%; bottom: 68%; opacity: 0.8; transform: scale(0.9); }
  100% { left: 74%; bottom: 74%; opacity: 0; transform: scale(2); filter: brightness(4); }
`;
const lightningTrailToMe = keyframes`
  0%   { right: 15%; top: 15%; opacity: 0; transform: scale(0.3); }
  20%  { opacity: 0.9; transform: scale(1.1); filter: brightness(3) drop-shadow(0 0 15px #ffd43b); }
  65%  { right: 68%; top: 68%; opacity: 0.8; transform: scale(0.9); }
  100% { right: 74%; top: 74%; opacity: 0; transform: scale(2); filter: brightness(4); }
`;

// 뇌우 전체화면: 번개 세 줄기가 각기 다른 위치에 순차 낙하
const thunderBolt1 = keyframes`
  0%   { left: 70%; top: -5%; opacity: 0; transform: scale(0.5); }
  10%  { opacity: 1; transform: scale(1.8); filter: brightness(4) drop-shadow(0 0 20px #ffd43b); }
  40%  { left: 70%; top: 12%; transform: scale(2.5); filter: brightness(6); }
  65%  { transform: scale(4); filter: brightness(7) drop-shadow(0 0 45px #fff176); }
  100% { left: 70%; top: 18%; opacity: 0; transform: scale(1); }
`;
const thunderBolt2 = keyframes`
  0%   { left: 55%; top: -5%; opacity: 0; transform: scale(0.4); }
  20%  { opacity: 1; transform: scale(1.6); filter: brightness(3.5) drop-shadow(0 0 18px #ffd43b); }
  50%  { left: 55%; top: 20%; transform: scale(2.8); filter: brightness(5.5); }
  75%  { transform: scale(3.5); filter: brightness(6); }
  100% { left: 55%; top: 26%; opacity: 0; transform: scale(0.8); }
`;
const thunderBolt3 = keyframes`
  0%   { left: 40%; top: -8%; opacity: 0; transform: scale(0.3); }
  30%  { opacity: 1; transform: scale(1.4); filter: brightness(3) drop-shadow(0 0 15px #ffd43b); }
  60%  { left: 40%; top: 28%; transform: scale(2); filter: brightness(5); }
  85%  { transform: scale(3); filter: brightness(5.5); }
  100% { left: 40%; top: 34%; opacity: 0; transform: scale(0.6); }
`;
const thunderBolt1ToMe = keyframes`
  0%   { left: 25%; top: -5%; opacity: 0; transform: scale(0.5); }
  10%  { opacity: 1; transform: scale(1.8); filter: brightness(4) drop-shadow(0 0 20px #ffd43b); }
  40%  { left: 25%; top: 50%; transform: scale(2.5); filter: brightness(6); }
  65%  { transform: scale(4); filter: brightness(7) drop-shadow(0 0 45px #fff176); }
  100% { left: 25%; top: 58%; opacity: 0; transform: scale(1); }
`;
const thunderBolt2ToMe = keyframes`
  0%   { left: 38%; top: -5%; opacity: 0; transform: scale(0.4); }
  20%  { opacity: 1; transform: scale(1.6); filter: brightness(3.5); }
  50%  { left: 38%; top: 58%; transform: scale(2.8); filter: brightness(5.5); }
  100% { left: 38%; top: 66%; opacity: 0; transform: scale(0.8); }
`;
const thunderBolt3ToMe = keyframes`
  0%   { left: 50%; top: -8%; opacity: 0; transform: scale(0.3); }
  30%  { opacity: 1; transform: scale(1.4); filter: brightness(3); }
  60%  { left: 50%; top: 66%; transform: scale(2); filter: brightness(5); }
  100% { left: 50%; top: 74%; opacity: 0; transform: scale(0.6); }
`;

// 업화 멀티: 화염 파편이 사방에서 솟구침
const fireSparkL = keyframes`
  0%   { left: 30%; bottom: 0%; opacity: 0; transform: scale(0.4) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.5) rotate(-20deg); filter: brightness(2.5) drop-shadow(0 0 15px #ff4500); }
  45%  { left: 20%; bottom: 45%; transform: scale(2) rotate(-40deg); filter: brightness(3.5); }
  70%  { left: 15%; bottom: 65%; transform: scale(2.8) rotate(-55deg); filter: brightness(4.5); }
  100% { left: 10%; bottom: 80%; opacity: 0; transform: scale(1); }
`;
const fireSparkR = keyframes`
  0%   { left: 55%; bottom: 0%; opacity: 0; transform: scale(0.4) rotate(0deg); }
  15%  { opacity: 1; transform: scale(1.5) rotate(20deg); filter: brightness(2.5) drop-shadow(0 0 15px #ff4500); }
  45%  { left: 65%; bottom: 45%; transform: scale(2) rotate(40deg); filter: brightness(3.5); }
  70%  { left: 72%; bottom: 65%; transform: scale(2.8) rotate(55deg); filter: brightness(4.5); }
  100% { left: 78%; bottom: 80%; opacity: 0; transform: scale(1); }
`;
const fireCenter = keyframes`
  0%   { left: 42%; bottom: -5%; opacity: 0; transform: scale(0.3) translateX(-50%); }
  10%  { opacity: 1; transform: scale(2) translateX(-50%); filter: brightness(3) drop-shadow(0 0 25px #ff6b35); }
  35%  { left: 42%; bottom: 30%; transform: scale(3.5) translateX(-50%); filter: brightness(5) drop-shadow(0 0 45px #ff4500); }
  60%  { left: 42%; bottom: 55%; transform: scale(5) translateX(-50%); filter: brightness(6); }
  100% { left: 42%; bottom: 68%; opacity: 0; transform: scale(6) translateX(-50%); }
`;
const fireSparkLToMe = keyframes`
  0%   { left: 30%; top: 100%; opacity: 0; transform: scale(0.4); }
  15%  { opacity: 1; transform: scale(1.5); filter: brightness(2.5) drop-shadow(0 0 15px #ff4500); }
  50%  { left: 20%; top: 50%; transform: scale(2.2); filter: brightness(3.5); }
  100% { left: 12%; top: 18%; opacity: 0; transform: scale(1); }
`;
const fireSparkRToMe = keyframes`
  0%   { left: 55%; top: 100%; opacity: 0; transform: scale(0.4); }
  15%  { opacity: 1; transform: scale(1.5); filter: brightness(2.5) drop-shadow(0 0 15px #ff4500); }
  50%  { left: 65%; top: 50%; transform: scale(2.2); filter: brightness(3.5); }
  100% { left: 74%; top: 18%; opacity: 0; transform: scale(1); }
`;
const fireCenterToMe = keyframes`
  0%   { left: 42%; top: 105%; opacity: 0; transform: scale(0.3) translateX(-50%); }
  10%  { opacity: 1; transform: scale(2) translateX(-50%); filter: brightness(3) drop-shadow(0 0 25px #ff6b35); }
  35%  { left: 42%; top: 65%; transform: scale(3.5) translateX(-50%); filter: brightness(5); }
  60%  { left: 42%; top: 38%; transform: scale(5) translateX(-50%); filter: brightness(6); }
  100% { left: 42%; top: 22%; opacity: 0; transform: scale(6) translateX(-50%); }
`;

// 화면 전체 흔들기 (뇌우·업화 전용)
const screenShake = keyframes`
  0%   { transform: translate(0, 0) rotate(0deg); }
  10%  { transform: translate(-5px, -3px) rotate(-0.5deg); }
  20%  { transform: translate(5px, 3px) rotate(0.5deg); }
  30%  { transform: translate(-4px, 2px) rotate(-0.3deg); }
  40%  { transform: translate(4px, -2px) rotate(0.3deg); }
  50%  { transform: translate(-3px, 3px) rotate(-0.2deg); }
  60%  { transform: translate(3px, -3px) rotate(0.2deg); }
  70%  { transform: translate(-2px, 1px); }
  80%  { transform: translate(2px, -1px); }
  100% { transform: translate(0, 0) rotate(0deg); }
`;

const ScreenShakeOverlay = styled.div`
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 49;
  animation: ${props => props.$active ? css`${screenShake} ${props.$duration || '0.6s'} ease-in-out` : 'none'};
`;

// 멀티 이펙트 아이콘 (절대위치 CSS 직접제어)
const MultiIcon = styled.div`
  position: absolute;
  font-size: ${props => props.$size || '4rem'};
  pointer-events: none;
  z-index: 51;
  filter: drop-shadow(0 0 10px ${props => props.$glow || 'rgba(255,255,255,0.8)'});
  animation: ${props => props.$anim} ${props => props.$duration} ease-in-out forwards;
  ${props => props.$delay ? `animation-delay: ${props.$delay};` : ''}
`;

// ─── 바람의 칼날: 날카로운 바람 슬래시 3연타
const windBladeSlash1ToOpp = keyframes`
  0%   { left: 18%; bottom: 25%; opacity: 0; transform: scale(0.4) rotate(-45deg) scaleX(0.5); }
  15%  { opacity: 1; transform: scale(1.6) rotate(-25deg) scaleX(2.5); filter: brightness(2.5) drop-shadow(0 0 14px #74c0fc); }
  50%  { left: 62%; bottom: 58%; transform: scale(1.3) rotate(-10deg) scaleX(3.0); filter: brightness(3.5) drop-shadow(0 0 20px #339af0); }
  80%  { left: 70%; bottom: 65%; transform: scale(2.5) rotate(0deg); filter: brightness(4); }
  100% { left: 74%; bottom: 68%; opacity: 0; transform: scale(1.0); }
`;
const windBladeSlash2ToOpp = keyframes`
  0%   { left: 15%; bottom: 20%; opacity: 0; transform: scale(0.3) rotate(-60deg); }
  25%  { opacity: 0.9; transform: scale(1.4) rotate(-35deg) scaleX(2.2); filter: brightness(2.2) drop-shadow(0 0 12px #74c0fc); }
  60%  { left: 65%; bottom: 62%; transform: scale(1.1) rotate(-15deg) scaleX(2.8); filter: brightness(3); }
  90%  { left: 72%; bottom: 67%; opacity: 0; transform: scale(2.0); }
  100% { opacity: 0; }
`;
const windBladeSlash3ToOpp = keyframes`
  0%   { left: 20%; bottom: 30%; opacity: 0; transform: scale(0.3) rotate(-30deg); }
  35%  { opacity: 0.8; transform: scale(1.2) rotate(-20deg) scaleX(2.0); filter: brightness(2) drop-shadow(0 0 10px #74c0fc); }
  70%  { left: 67%; bottom: 64%; transform: scale(0.9) rotate(-5deg) scaleX(2.5); filter: brightness(2.8); }
  95%  { left: 73%; bottom: 68%; opacity: 0; transform: scale(1.8); }
  100% { opacity: 0; }
`;
const windBladeSlash1ToMe = keyframes`
  0%   { right: 18%; top: 25%; opacity: 0; transform: scale(0.4) rotate(45deg) scaleX(0.5); }
  15%  { opacity: 1; transform: scale(1.6) rotate(25deg) scaleX(2.5); filter: brightness(2.5) drop-shadow(0 0 14px #74c0fc); }
  50%  { right: 62%; top: 58%; transform: scale(1.3) rotate(10deg) scaleX(3.0); filter: brightness(3.5) drop-shadow(0 0 20px #339af0); }
  80%  { right: 70%; top: 65%; transform: scale(2.5) rotate(0deg); filter: brightness(4); }
  100% { right: 74%; top: 68%; opacity: 0; transform: scale(1.0); }
`;
const windBladeSlash2ToMe = keyframes`
  0%   { right: 15%; top: 20%; opacity: 0; transform: scale(0.3) rotate(60deg); }
  25%  { opacity: 0.9; transform: scale(1.4) rotate(35deg) scaleX(2.2); filter: brightness(2.2) drop-shadow(0 0 12px #74c0fc); }
  60%  { right: 65%; top: 62%; transform: scale(1.1) rotate(15deg) scaleX(2.8); filter: brightness(3); }
  90%  { right: 72%; top: 67%; opacity: 0; transform: scale(2.0); }
  100% { opacity: 0; }
`;
const windBladeSlash3ToMe = keyframes`
  0%   { right: 20%; top: 30%; opacity: 0; transform: scale(0.3) rotate(30deg); }
  35%  { opacity: 0.8; transform: scale(1.2) rotate(20deg) scaleX(2.0); filter: brightness(2) drop-shadow(0 0 10px #74c0fc); }
  70%  { right: 67%; top: 64%; transform: scale(0.9) rotate(5deg) scaleX(2.5); filter: brightness(2.8); }
  95%  { right: 73%; top: 68%; opacity: 0; transform: scale(1.8); }
  100% { opacity: 0; }
`;

// ─── 토네이도 멀티: 큰 회오리 + 주변 작은 소용돌이 2개 + 화면 흔들기
const tornadoSub1 = keyframes`
  0%   { left: 50%; bottom: -5%; opacity: 0; transform: scale(0.2) rotate(0deg); }
  20%  { opacity: 0.85; transform: scale(1.3) rotate(360deg); filter: drop-shadow(0 0 12px #74c0fc); }
  55%  { left: 58%; bottom: 40%; transform: scale(2.2) rotate(720deg); filter: brightness(2.5) drop-shadow(0 0 22px #339af0); }
  80%  { left: 60%; bottom: 60%; transform: scale(3.2) rotate(1080deg); filter: brightness(3.5); }
  100% { left: 62%; bottom: 70%; opacity: 0; transform: scale(2.0) rotate(1260deg); }
`;
const tornadoSub2 = keyframes`
  0%   { left: 70%; bottom: -5%; opacity: 0; transform: scale(0.15) rotate(0deg); }
  30%  { opacity: 0.75; transform: scale(1.1) rotate(-360deg); filter: drop-shadow(0 0 10px #74c0fc); }
  65%  { left: 74%; bottom: 45%; transform: scale(1.8) rotate(-720deg); filter: brightness(2); }
  100% { left: 76%; bottom: 68%; opacity: 0; transform: scale(2.8) rotate(-1080deg); }
`;
const tornadoSub1ToMe = keyframes`
  0%   { left: 40%; top: 105%; opacity: 0; transform: scale(0.2) rotate(0deg); }
  20%  { opacity: 0.85; transform: scale(1.3) rotate(-360deg); filter: drop-shadow(0 0 12px #74c0fc); }
  55%  { left: 35%; top: 55%; transform: scale(2.2) rotate(-720deg); filter: brightness(2.5) drop-shadow(0 0 22px #339af0); }
  80%  { left: 33%; top: 32%; transform: scale(3.2) rotate(-1080deg); filter: brightness(3.5); }
  100% { left: 32%; top: 22%; opacity: 0; transform: scale(2.0) rotate(-1260deg); }
`;
const tornadoSub2ToMe = keyframes`
  0%   { left: 22%; top: 105%; opacity: 0; transform: scale(0.15) rotate(0deg); }
  30%  { opacity: 0.75; transform: scale(1.1) rotate(360deg); filter: drop-shadow(0 0 10px #74c0fc); }
  65%  { left: 20%; top: 50%; transform: scale(1.8) rotate(720deg); filter: brightness(2); }
  100% { left: 18%; top: 25%; opacity: 0; transform: scale(2.8) rotate(1080deg); }
`;

// ─── 재빠른 교란 강화: 잔상 이펙트 추가
const disturbAfterimage1ToOpp = keyframes`
  0%   { left: 18%; bottom: 18%; opacity: 0.7; transform: scale(1.0); filter: brightness(1.5) drop-shadow(0 0 8px #74c0fc); }
  100% { left: 72%; bottom: 72%; opacity: 0; transform: scale(0.6); }
`;
const disturbAfterimage2ToOpp = keyframes`
  0%   { left: 25%; bottom: 22%; opacity: 0.5; transform: scale(0.9); filter: brightness(1.3) drop-shadow(0 0 6px #74c0fc); }
  100% { left: 68%; bottom: 68%; opacity: 0; transform: scale(0.5); }
`;
const disturbAfterimage1ToMe = keyframes`
  0%   { right: 18%; top: 18%; opacity: 0.7; transform: scale(1.0); filter: brightness(1.5) drop-shadow(0 0 8px #74c0fc); }
  100% { right: 72%; top: 72%; opacity: 0; transform: scale(0.6); }
`;
const disturbAfterimage2ToMe = keyframes`
  0%   { right: 25%; top: 22%; opacity: 0.5; transform: scale(0.9); filter: brightness(1.3) drop-shadow(0 0 6px #74c0fc); }
  100% { right: 68%; top: 68%; opacity: 0; transform: scale(0.5); }
`;

// ==========================================
// 3. 스킬 → 아이콘/타입/지속시간 매핑
// ==========================================
const SKILL_CONFIG = {
  // 불 계열
  FIERY_BREATH: { icon: '🔥', duration: '1.4s', type: 'BREATH' },
  DRAGON_CLAW: { icon: '🐲', duration: '0.9s', type: 'PROJECTILE' },
  STELLAR_BLAST: { icon: '⭐', duration: '1.5s', type: 'STELLAR' },
  REM_FIRE: { icon: '🔥', duration: '1.3s', type: 'REM_FIRE' },
  FLAME_DASH: { icon: '🔥', duration: '0.8s', type: 'FLAME_DASH' },
  UPHWA: { icon: '🌋', duration: '2.0s', type: 'UPHWA_FULL' },

  // 바람 계열
  QUICK_DISTURBANCE: { icon: '💨', duration: '1.0s', type: 'DISTURBANCE_MULTI' },
  WIND_BLADE: { icon: '🌬️', duration: '1.1s', type: 'WIND_BLADE_MULTI' },
  TORNADO_SWEEP: { icon: '🌪️', duration: '2.0s', type: 'TORNADO_FULL' },

  // 풀 계열
  LEECH_SEED: { icon: '🌱', duration: '1.3s', type: 'SEED' },
  VINE_WHIP: { icon: '🌿', duration: '1.0s', type: 'VINE' },
  SOLAR_BEAM: { icon: '☀️', duration: '1.5s', type: 'SOLAR' },

  // 번개 계열
  SHOCK_SCRATCH: { icon: '⚡', duration: '0.9s', type: 'SCRATCH' },
  THUNDER_PUNCH: { icon: '👊', duration: '0.7s', type: 'THUNDER_PUNCH_MULTI' },
  THUNDERSTORM: { icon: '⛈️', duration: '1.8s', type: 'THUNDER_FULL' },

  // 독/공용
  POISON_STING: { icon: '☠️', duration: '1.3s', type: 'POISON' },
  STATIC_SHOCK: { icon: '⚡', duration: '0.8s', type: 'PROJECTILE' },
  SAND_THROW: { icon: '🟤', duration: '0.9s', type: 'PROJECTILE' },
  SHIELD_BASH: { icon: '🛡️', duration: '0.8s', type: 'PROJECTILE' },
  ENERGY_SIPHON: { icon: '🌀', duration: '1.4s', type: 'SIPHON' },
  HARDEN: { icon: '🛡️', duration: '1.0s', type: 'BUFF' },
  HEALING_PRAYER: { icon: '💖', duration: '1.2s', type: 'BUFF' },
  MIND_FOCUS: { icon: '⚡', duration: '1.0s', type: 'BUFF' },
  TAUNT: { icon: '😤', duration: '1.0s', type: 'BUFF' },

  // 기본
  TACKLE: { icon: '💥', duration: '0.6s', type: 'PROJECTILE' },
};

// ==========================================
// 4. 타입 → 애니메이션 선택
// ==========================================
const getAnimation = (type, isMine) => {
  switch (type) {
    case 'ZIGZAG': return isMine ? zigzagToOpponent : zigzagToMe;
    case 'DROP':
    case 'THUNDER': return isMine ? thunderBolt : thunderBoltToMe;
    case 'BUFF': return buffSelf(isMine);
    case 'POISON': return isMine ? poisonFly : poisonFlyToMe;
    case 'REM_FIRE': return isMine ? remFireFly : remFireFlyToMe;
    case 'UPHWA': return isMine ? uphwaExplode : uphwaExplodeToMe;
    case 'STELLAR': return isMine ? stellarExplode : stellarExplodeToMe;
    case 'BREATH': return isMine ? breathSweep : breathSweepToMe;
    case 'TORNADO': return isMine ? tornadoRise : tornadoRiseToMe;
    case 'SOLAR': return isMine ? solarCharge : solarChargeToMe;
    case 'SEED': return isMine ? seedFly : seedFlyToMe;
    case 'VINE': return isMine ? vineWhip : vineWhipToMe;
    case 'SIPHON': return isMine ? siphonPull : siphonPullToMe;
    case 'FLAME_DASH': return isMine ? flameDash : flameDashToMe;
    case 'SCRATCH': return isMine ? scratchStrike : scratchStrikeToMe;
    case 'PROJECTILE':
    default: return isMine ? flyToOpponent : flyToMe;
  }
};

// ==========================================
// 5. 스타일 컴포넌트
// ==========================================
const EffectContainer = styled.div`
  position: absolute;
  width: 100%; height: 100%;
  top: 0; left: 0;
  pointer-events: none;
  z-index: 50;
  overflow: visible;

  &::after {
    content: '${props => props.$icon}';
    position: absolute;
    font-size: ${props => props.$large ? '5rem' : '4rem'};
    filter: drop-shadow(0 0 10px rgba(255,255,255,0.8))
            drop-shadow(0 0 22px ${props => props.$glowColor || (props.$isMine ? '#339af0' : '#fa5252')});
    animation: ${props => getAnimation(props.$animType, props.$isMine)} ${props => props.$duration} ease-in-out forwards;
  }
`;

// 도트딜 이펙트 (화상/중독 펫 위에 표시)
export const DotDamageEffect = styled.div`
  position: absolute;
  top: ${props => props.$top || '10%'};
  left: ${props => props.$left || '50%'};
  transform: translateX(-50%);
  font-size: 2rem;
  pointer-events: none;
  z-index: 60;
  animation: ${props => props.$type === 'burn' ? burnDotAnim : poisonDotAnim} 0.9s ease-out forwards;
`;

// ==========================================
// 6. 컴포넌트
// ==========================================
const BattleSkillEffect = ({ type, isMine }) => {
  const config = SKILL_CONFIG[type] || { icon: '✨', duration: '1s', type: 'PROJECTILE' };

  const glowMap = {
    POISON: '#69db7c', SEED: '#69db7c', VINE: '#40c057', SOLAR: '#ffd43b',
    REM_FIRE: '#ff6b35', UPHWA: '#ff4500', UPHWA_FULL: '#ff4500', BREATH: '#ff4500', FLAME_DASH: '#ff6b35',
    THUNDER: '#ffd43b', THUNDER_FULL: '#ffd43b', THUNDER_PUNCH_MULTI: '#ffd43b',
    STELLAR: '#ffd43b', SCRATCH: '#ffd43b',
    TORNADO: '#74c0fc', TORNADO_FULL: '#74c0fc', ZIGZAG: '#74c0fc', DISTURBANCE_MULTI: '#74c0fc', WIND_BLADE_MULTI: '#339af0',
    SIPHON: '#cc5de8',
  };

  // ── 재빠른 교란: 메인 이펙트 + 잔상 2개
  if (config.type === 'DISTURBANCE_MULTI') {
    return (
      <EffectContainer $icon="" $duration="1.0s" $animType="ZIGZAG" $isMine={isMine} $glowColor="#74c0fc">
        <MultiIcon $anim={isMine ? zigzagToOpponent : zigzagToMe} $duration="1.0s" $glow="#74c0fc" $size="3.5rem">💨</MultiIcon>
        <MultiIcon $anim={isMine ? disturbAfterimage1ToOpp : disturbAfterimage1ToMe} $duration="0.8s" $glow="#74c0fc" $size="2.8rem" $delay="0.08s">💨</MultiIcon>
        <MultiIcon $anim={isMine ? disturbAfterimage2ToOpp : disturbAfterimage2ToMe} $duration="0.8s" $glow="#339af0" $size="2.2rem" $delay="0.15s">💨</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 바람의 칼날: 날카로운 바람 슬래시 3연타
  if (config.type === 'WIND_BLADE_MULTI') {
    return (
      <EffectContainer $icon="" $duration="1.1s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#339af0">
        <MultiIcon $anim={isMine ? windBladeSlash1ToOpp : windBladeSlash1ToMe} $duration="1.0s" $glow="#339af0" $size="3.5rem">🌬️</MultiIcon>
        <MultiIcon $anim={isMine ? windBladeSlash2ToOpp : windBladeSlash2ToMe} $duration="1.0s" $glow="#74c0fc" $size="3.0rem" $delay="0.1s">🌬️</MultiIcon>
        <MultiIcon $anim={isMine ? windBladeSlash3ToOpp : windBladeSlash3ToMe} $duration="1.0s" $glow="#74c0fc" $size="2.5rem" $delay="0.2s">🌬️</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 토네이도: 메인 회오리 + 소용돌이 2개 + 화면 흔들기
  if (config.type === 'TORNADO_FULL') {
    return (
      <EffectContainer $icon="" $duration="2.0s" $animType="TORNADO" $isMine={isMine} $glowColor="#74c0fc">
        <ScreenShakeOverlay $active $duration="0.7s" />
        <MultiIcon $anim={isMine ? tornadoRise : tornadoRiseToMe} $duration="2.0s" $glow="#74c0fc" $size="6rem">🌪️</MultiIcon>
        <MultiIcon $anim={isMine ? tornadoSub1 : tornadoSub1ToMe} $duration="1.8s" $glow="#339af0" $size="4rem" $delay="0.15s">🌀</MultiIcon>
        <MultiIcon $anim={isMine ? tornadoSub2 : tornadoSub2ToMe} $duration="1.6s" $glow="#74c0fc" $size="3rem" $delay="0.3s">🌪️</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 찌릿펀치: 주먹 + 번개 동시 발사
  if (config.type === 'THUNDER_PUNCH_MULTI') {
    return (
      <EffectContainer $icon="" $duration="0.7s" $animType="PROJECTILE" $isMine={isMine} $glowColor="#ffd43b">
        <MultiIcon $anim={isMine ? punchFlyToOpponent : punchFlyToMe} $duration="0.7s" $glow="#ffd43b" $size="3.8rem">👊</MultiIcon>
        <MultiIcon $anim={isMine ? lightningTrailToOpponent : lightningTrailToMe} $duration="0.7s" $glow="#ffd43b" $size="3rem" $delay="0.05s">⚡</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 뇌우: 화면 전체 번개 3줄기 + 흔들기
  if (config.type === 'THUNDER_FULL') {
    return (
      <EffectContainer $icon="" $duration="1.8s" $animType="THUNDER" $isMine={isMine} $glowColor="#ffd43b">
        <ScreenShakeOverlay $active $duration="0.7s" />
        <MultiIcon $anim={isMine ? thunderBolt1 : thunderBolt1ToMe} $duration="1.2s" $glow="#fff176" $size="5rem">⚡</MultiIcon>
        <MultiIcon $anim={isMine ? thunderBolt2 : thunderBolt2ToMe} $duration="1.1s" $glow="#ffd43b" $size="4rem" $delay="0.2s">🌩️</MultiIcon>
        <MultiIcon $anim={isMine ? thunderBolt3 : thunderBolt3ToMe} $duration="1.0s" $glow="#ffd43b" $size="3.5rem" $delay="0.4s">⚡</MultiIcon>
      </EffectContainer>
    );
  }

  // ── 업화: 중앙 화산 + 좌우 불꽃 파편 + 흔들기
  if (config.type === 'UPHWA_FULL') {
    return (
      <EffectContainer $icon="" $duration="2.0s" $animType="UPHWA" $isMine={isMine} $glowColor="#ff4500">
        <ScreenShakeOverlay $active $duration="0.8s" />
        <MultiIcon $anim={isMine ? fireCenter : fireCenterToMe} $duration="2.0s" $glow="#ff4500" $size="5rem">🌋</MultiIcon>
        <MultiIcon $anim={isMine ? fireSparkL : fireSparkLToMe} $duration="1.6s" $glow="#ff6b35" $size="3rem" $delay="0.1s">🔥</MultiIcon>
        <MultiIcon $anim={isMine ? fireSparkR : fireSparkRToMe} $duration="1.6s" $glow="#ff6b35" $size="3rem" $delay="0.2s">🔥</MultiIcon>
      </EffectContainer>
    );
  }

  return (
    <EffectContainer
      $icon={config.icon}
      $duration={config.duration}
      $animType={config.type}
      $isMine={isMine}
      $glowColor={glowMap[config.type]}
      $large={['UPHWA_FULL', 'STELLAR', 'TORNADO', 'TORNADO_FULL', 'SOLAR', 'BREATH'].includes(config.type)}
    />
  );
};

export default BattleSkillEffect;
