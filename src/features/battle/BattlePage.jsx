// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, db, cancelBattleChallenge, getActiveQuizSets, getScaledSkillCost } from '../../api/firebase';
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { petImageMap } from '../../utils/petImageMap';
import { SKILLS } from '../pet/petData';
import { filterProfanity } from '../../utils/profanityFilter';
import BattleSkillEffect, { DotDamageEffect } from './BattleSkillEffect';

// --- Styled Components & Keyframes ---

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const shakeDamage = keyframes`
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px) rotate(-6deg); }
  50% { transform: translateX(6px) rotate(6deg); }
  75% { transform: translateX(-6px) rotate(-6deg); }
  100% { transform: translateX(0); }
`;

const tackleRight = keyframes`
  0%   { transform: translateX(0) scale(1); }
  15%  { transform: translateX(-25px) scale(0.9); }
  50%  { transform: translateX(180px) scale(1.15); }
  65%  { transform: translateX(160px) scale(1.3) rotate(5deg); }
  100% { transform: translateX(0) scale(1) rotate(0deg); }
`;

const tackleLeft = keyframes`
  0%   { transform: translateX(0) scale(1); }
  15%  { transform: translateX(25px) scale(0.9); }
  50%  { transform: translateX(-180px) scale(1.15); }
  65%  { transform: translateX(-160px) scale(1.3) rotate(-5deg); }
  100% { transform: translateX(0) scale(1) rotate(0deg); }
`;

// 재빠른 교란: 토끼가 상대에게 달려가 이리저리 부딪히고 돌아옴
const zigzagRight = keyframes`
  0%   { transform: translate(0, 0) scale(1); filter: brightness(1); }
  10%  { transform: translate(-20px, 0) scale(0.85); }
  22%  { transform: translate(100px, -55px) scale(1.2); filter: brightness(1.4) drop-shadow(0 0 8px #74c0fc); }
  32%  { transform: translate(155px, 20px) scale(1.1) rotate(12deg); filter: brightness(1.6) drop-shadow(0 0 12px #74c0fc); }
  44%  { transform: translate(115px, -40px) scale(1.25) rotate(-8deg); filter: brightness(1.8) drop-shadow(0 0 15px #339af0); }
  56%  { transform: translate(170px, 10px) scale(1.15) rotate(6deg); filter: brightness(1.5); }
  68%  { transform: translate(140px, -25px) scale(1.3); filter: brightness(2); }
  80%  { transform: translate(60px, 0) scale(1.1); filter: brightness(1.3); }
  100% { transform: translate(0, 0) scale(1); filter: brightness(1); }
`;

const zigzagLeft = keyframes`
  0%   { transform: translate(0, 0) scale(1); filter: brightness(1); }
  10%  { transform: translate(20px, 0) scale(0.85); }
  22%  { transform: translate(-100px, -55px) scale(1.2); filter: brightness(1.4) drop-shadow(0 0 8px #74c0fc); }
  32%  { transform: translate(-155px, 20px) scale(1.1) rotate(-12deg); filter: brightness(1.6) drop-shadow(0 0 12px #74c0fc); }
  44%  { transform: translate(-115px, -40px) scale(1.25) rotate(8deg); filter: brightness(1.8) drop-shadow(0 0 15px #339af0); }
  56%  { transform: translate(-170px, 10px) scale(1.15) rotate(-6deg); filter: brightness(1.5); }
  68%  { transform: translate(-140px, -25px) scale(1.3); filter: brightness(2); }
  80%  { transform: translate(-60px, 0) scale(1.1); filter: brightness(1.3); }
  100% { transform: translate(0, 0) scale(1); filter: brightness(1); }
`;

// 불꽃 질주: 불비비가 빛을 내며 상대에게 직선 돌진
const flameDashRight = keyframes`
  0%   { transform: translateX(0) scaleX(1) scaleY(1); filter: brightness(1); }
  8%   { transform: translateX(-30px) scaleX(0.7) scaleY(1.1); filter: brightness(1.2); }
  20%  { transform: translateX(80px) scaleX(1.4) scaleY(0.85); filter: brightness(2) drop-shadow(0 0 12px #ff6b35); }
  38%  { transform: translateX(190px) scaleX(1.6) scaleY(0.75); filter: brightness(3) drop-shadow(0 0 22px #ff4500); }
  52%  { transform: translateX(210px) scaleX(1.3) scaleY(0.9); filter: brightness(4) drop-shadow(0 0 30px #ff6b35); }
  65%  { transform: translateX(185px) scaleX(1.0) scaleY(1.2); filter: brightness(3) drop-shadow(0 0 18px #ffa94d); }
  82%  { transform: translateX(50px) scaleX(1) scaleY(1); filter: brightness(1.5); }
  100% { transform: translateX(0) scaleX(1) scaleY(1); filter: brightness(1); }
`;

// ⚡ 찌릿펀치: 전방으로 빠르게 돌진 후 복귀
const thunderPunchRight = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  10%  { transform: translateX(-18px) scale(0.92); }
  35%  { transform: translateX(170px) scale(1.18); filter: brightness(2.2) drop-shadow(0 0 18px #ffd43b); }
  55%  { transform: translateX(190px) scale(1.1) rotate(8deg); filter: brightness(2.8) drop-shadow(0 0 25px #ffd43b); }
  75%  { transform: translateX(80px) scale(1.05); filter: brightness(1.4); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
const thunderPunchLeft = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  10%  { transform: translateX(18px) scale(0.92); }
  35%  { transform: translateX(-170px) scale(1.18); filter: brightness(2.2) drop-shadow(0 0 18px #ffd43b); }
  55%  { transform: translateX(-190px) scale(1.1) rotate(-8deg); filter: brightness(2.8) drop-shadow(0 0 25px #ffd43b); }
  75%  { transform: translateX(-80px) scale(1.05); filter: brightness(1.4); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
// 🌩️ 뇌우: 전기를 모아 돌진 + 화면 진동
const thunderstormRight = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  8%   { transform: translateX(-22px) scale(0.88); }
  25%  { transform: translateX(80px) scale(1.12); filter: brightness(2) drop-shadow(0 0 20px #ffd43b); }
  42%  { transform: translateX(160px) scale(1.2); filter: brightness(3.5) drop-shadow(0 0 35px #ffd43b); }
  55%  { transform: translateX(175px) scale(1.25) rotate(5deg); filter: brightness(5) drop-shadow(0 0 50px #fff176); }
  70%  { transform: translateX(90px) scale(1.1); filter: brightness(2.5); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
const thunderstormLeft = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  8%   { transform: translateX(22px) scale(0.88); }
  25%  { transform: translateX(-80px) scale(1.12); filter: brightness(2) drop-shadow(0 0 20px #ffd43b); }
  42%  { transform: translateX(-160px) scale(1.2); filter: brightness(3.5) drop-shadow(0 0 35px #ffd43b); }
  55%  { transform: translateX(-175px) scale(1.25) rotate(-5deg); filter: brightness(5) drop-shadow(0 0 50px #fff176); }
  70%  { transform: translateX(-90px) scale(1.1); filter: brightness(2.5); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
// 🌋 업화: 아래서 솟구치며 돌진
const uphwaChargeRight = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
  15%  { transform: translateX(-20px) translateY(10px) scale(0.9); filter: brightness(1.2); }
  30%  { transform: translateX(60px) translateY(-20px) scale(1.15); filter: brightness(2.5) drop-shadow(0 0 20px #ff4500); }
  50%  { transform: translateX(150px) translateY(-40px) scale(1.3); filter: brightness(4) drop-shadow(0 0 40px #ff4500); }
  65%  { transform: translateX(170px) translateY(-15px) scale(1.35) rotate(8deg); filter: brightness(5) drop-shadow(0 0 55px #ff6b35); }
  80%  { transform: translateX(70px) translateY(0) scale(1.1); filter: brightness(2.5); }
  100% { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
const uphwaChargeLeft = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
  15%  { transform: translateX(20px) translateY(10px) scale(0.9); filter: brightness(1.2); }
  30%  { transform: translateX(-60px) translateY(-20px) scale(1.15); filter: brightness(2.5) drop-shadow(0 0 20px #ff4500); }
  50%  { transform: translateX(-150px) translateY(-40px) scale(1.3); filter: brightness(4) drop-shadow(0 0 40px #ff4500); }
  65%  { transform: translateX(-170px) translateY(-15px) scale(1.35) rotate(-8deg); filter: brightness(5) drop-shadow(0 0 55px #ff6b35); }
  80%  { transform: translateX(-70px) translateY(0) scale(1.1); filter: brightness(2.5); }
  100% { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
// ☀️ 솔라빔: 빛을 모아 전진
const solarBeamRight = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  20%  { transform: translateX(-15px) scale(0.9); filter: brightness(1.5) drop-shadow(0 0 12px #fff176); }
  40%  { transform: translateX(50px) scale(1.1); filter: brightness(3) drop-shadow(0 0 25px #ffd43b); }
  60%  { transform: translateX(120px) scale(1.15); filter: brightness(4.5) drop-shadow(0 0 45px #fff176); }
  75%  { transform: translateX(110px) scale(1.2); filter: brightness(6) drop-shadow(0 0 60px #fff176); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
const solarBeamLeft = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  20%  { transform: translateX(15px) scale(0.9); filter: brightness(1.5) drop-shadow(0 0 12px #fff176); }
  40%  { transform: translateX(-50px) scale(1.1); filter: brightness(3) drop-shadow(0 0 25px #ffd43b); }
  60%  { transform: translateX(-120px) scale(1.15); filter: brightness(4.5) drop-shadow(0 0 45px #fff176); }
  75%  { transform: translateX(-110px) scale(1.2); filter: brightness(6) drop-shadow(0 0 60px #fff176); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
// 🌟 스텔라 블라스트: 솟구치며 별폭발
const stellarBlastRight = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
  15%  { transform: translateX(-15px) translateY(5px) scale(0.9); }
  35%  { transform: translateX(70px) translateY(-30px) scale(1.2); filter: brightness(2.5) drop-shadow(0 0 20px #ffd43b); }
  55%  { transform: translateX(145px) translateY(-50px) scale(1.3); filter: brightness(4.5) drop-shadow(0 0 45px #fff176); }
  70%  { transform: translateX(160px) translateY(-35px) scale(1.35); filter: brightness(6) drop-shadow(0 0 65px #fff176); }
  85%  { transform: translateX(60px) translateY(-10px) scale(1.1); filter: brightness(3); }
  100% { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
`;
const stellarBlastLeft = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
  15%  { transform: translateX(15px) translateY(5px) scale(0.9); }
  35%  { transform: translateX(-70px) translateY(-30px) scale(1.2); filter: brightness(2.5) drop-shadow(0 0 20px #ffd43b); }
  55%  { transform: translateX(-145px) translateY(-50px) scale(1.3); filter: brightness(4.5) drop-shadow(0 0 45px #fff176); }
  70%  { transform: translateX(-160px) translateY(-35px) scale(1.35); filter: brightness(6) drop-shadow(0 0 65px #fff176); }
  85%  { transform: translateX(-60px) translateY(-10px) scale(1.1); filter: brightness(3); }
  100% { transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
`;
// 💨 바람의 칼날: 짧게 세 번 빠르게 슬쩍 전진
const windBladeRight = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  12%  { transform: translateX(60px) scale(1.08); filter: brightness(1.5) drop-shadow(0 0 8px #74c0fc); }
  22%  { transform: translateX(20px) scale(0.96); }
  34%  { transform: translateX(90px) scale(1.12); filter: brightness(2) drop-shadow(0 0 14px #74c0fc); }
  44%  { transform: translateX(30px) scale(0.98); }
  56%  { transform: translateX(110px) scale(1.15); filter: brightness(2.5) drop-shadow(0 0 18px #339af0); }
  70%  { transform: translateX(50px) scale(1.05); filter: brightness(1.5); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
const windBladeLeft = keyframes`
  0%   { transform: translateX(0) scale(1); filter: brightness(1); }
  12%  { transform: translateX(-60px) scale(1.08); filter: brightness(1.5) drop-shadow(0 0 8px #74c0fc); }
  22%  { transform: translateX(-20px) scale(0.96); }
  34%  { transform: translateX(-90px) scale(1.12); filter: brightness(2) drop-shadow(0 0 14px #74c0fc); }
  44%  { transform: translateX(-30px) scale(0.98); }
  56%  { transform: translateX(-110px) scale(1.15); filter: brightness(2.5) drop-shadow(0 0 18px #339af0); }
  70%  { transform: translateX(-50px) scale(1.05); filter: brightness(1.5); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
// 🌪️ 토네이도: 작게 웅크렸다가 회전하며 전방으로 크게 솟구침
const tornadoSweepRight = keyframes`
  0%   { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
  10%  { transform: translateX(-15px) scale(0.85) rotate(-10deg); }
  25%  { transform: translateX(40px) scale(1.1) rotate(60deg); filter: brightness(1.5) drop-shadow(0 0 12px #74c0fc); }
  40%  { transform: translateX(110px) scale(1.25) rotate(180deg); filter: brightness(2.5) drop-shadow(0 0 22px #74c0fc); }
  58%  { transform: translateX(155px) scale(1.3) rotate(330deg); filter: brightness(3.5) drop-shadow(0 0 35px #339af0); }
  72%  { transform: translateX(130px) scale(1.2) rotate(420deg); filter: brightness(2.5); }
  88%  { transform: translateX(40px) scale(1.05) rotate(460deg); filter: brightness(1.3); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
const tornadoSweepLeft = keyframes`
  0%   { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
  10%  { transform: translateX(15px) scale(0.85) rotate(10deg); }
  25%  { transform: translateX(-40px) scale(1.1) rotate(-60deg); filter: brightness(1.5) drop-shadow(0 0 12px #74c0fc); }
  40%  { transform: translateX(-110px) scale(1.25) rotate(-180deg); filter: brightness(2.5) drop-shadow(0 0 22px #74c0fc); }
  58%  { transform: translateX(-155px) scale(1.3) rotate(-330deg); filter: brightness(3.5) drop-shadow(0 0 35px #339af0); }
  72%  { transform: translateX(-130px) scale(1.2) rotate(-420deg); filter: brightness(2.5); }
  88%  { transform: translateX(-40px) scale(1.05) rotate(-460deg); filter: brightness(1.3); }
  100% { transform: translateX(0) scale(1) rotate(0deg); filter: brightness(1); }
`;

const flameDashLeft = keyframes`
  0%   { transform: translateX(0) scaleX(1) scaleY(1); filter: brightness(1); }
  8%   { transform: translateX(30px) scaleX(0.7) scaleY(1.1); filter: brightness(1.2); }
  20%  { transform: translateX(-80px) scaleX(1.4) scaleY(0.85); filter: brightness(2) drop-shadow(0 0 12px #ff6b35); }
  38%  { transform: translateX(-190px) scaleX(1.6) scaleY(0.75); filter: brightness(3) drop-shadow(0 0 22px #ff4500); }
  52%  { transform: translateX(-210px) scaleX(1.3) scaleY(0.9); filter: brightness(4) drop-shadow(0 0 30px #ff6b35); }
  65%  { transform: translateX(-185px) scaleX(1.0) scaleY(1.2); filter: brightness(3) drop-shadow(0 0 18px #ffa94d); }
  82%  { transform: translateX(-50px) scaleX(1) scaleY(1); filter: brightness(1.5); }
  100% { transform: translateX(0) scaleX(1) scaleY(1); filter: brightness(1); }
`;

// 🐲 용의 발톱: 불꽃을 두른 발톱으로 빠르게 뛰어들어 할퀴고 복귀
const dragonClawRight = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
  10%  { transform: translateX(-20px) translateY(8px) scale(0.88); filter: brightness(1.3); }
  28%  { transform: translateX(110px) translateY(-30px) scale(1.2) rotate(-12deg); filter: brightness(2.5) drop-shadow(0 0 18px #ff4500); }
  45%  { transform: translateX(175px) translateY(-15px) scale(1.28) rotate(-6deg); filter: brightness(3.5) drop-shadow(0 0 28px #ff6b35); }
  58%  { transform: translateX(185px) translateY(5px) scale(1.15) rotate(4deg); filter: brightness(4) drop-shadow(0 0 35px #ff4500); }
  72%  { transform: translateX(80px) translateY(0) scale(1.05) rotate(1deg); filter: brightness(2); }
  100% { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
`;
const dragonClawLeft = keyframes`
  0%   { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
  10%  { transform: translateX(20px) translateY(8px) scale(0.88); filter: brightness(1.3); }
  28%  { transform: translateX(-110px) translateY(-30px) scale(1.2) rotate(12deg); filter: brightness(2.5) drop-shadow(0 0 18px #ff4500); }
  45%  { transform: translateX(-175px) translateY(-15px) scale(1.28) rotate(6deg); filter: brightness(3.5) drop-shadow(0 0 28px #ff6b35); }
  58%  { transform: translateX(-185px) translateY(5px) scale(1.15) rotate(-4deg); filter: brightness(4) drop-shadow(0 0 35px #ff4500); }
  72%  { transform: translateX(-80px) translateY(0) scale(1.05) rotate(-1deg); filter: brightness(2); }
  100% { transform: translateX(0) translateY(0) scale(1) rotate(0deg); filter: brightness(1); }
`;

const StunEffect = styled.div`
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 3rem;
  animation: ${rotate} 2s linear infinite;
  z-index: 20;
  
  &::after { content: '💫'; display: block; }
`;

const RechargeEffect = styled.div`
  position: absolute;
  bottom: 10px;
  width: 100%;
  text-align: center;
  color: #ff4500;
  font-weight: bold;
  font-size: 1.2rem;
  animation: ${float} 1s ease-in-out infinite;
  text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
  z-index: 20;
  pointer-events: none;
`;

const Arena = styled.div`
  max-width: 1200px; margin: 2rem auto; padding: 2rem; background-color: #f0f8ff;
  border-radius: 24px; border: 5px solid #a5d8ff; overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  transform-origin: top center;
  transform: scale(${props => props.$scale || 1});
  transition: transform 0.2s ease;
  /* scale 후 부모가 잘리지 않도록 마진 보정 */
  margin-bottom: ${props => props.$scale ? `calc(2rem - (1 - ${props.$scale}) * 800px)` : '2rem'};
`;

const ScaleControlBar = styled.div`
  max-width: 1200px; margin: 0 auto 0.5rem; padding: 0.5rem 1.5rem;
  display: flex; align-items: center; gap: 1rem;
  background: rgba(255,255,255,0.8); border-radius: 12px;
  border: 1px solid #d0ebff; font-size: 0.85rem; font-weight: 700; color: #495057;
`;

const ScaleSlider = styled.input`
  flex: 1; accent-color: #339af0; cursor: pointer;
`;

const BattleField = styled.div`
  height: 550px; position: relative; margin-bottom: 2rem; 
  background: radial-gradient(circle, #ffffff 0%, #e7f5ff 100%);
  border-radius: 20px;
  border: 2px solid #d0ebff;
`;

const PetContainerWrapper = styled.div`
  position: absolute; width: 400px; height: 400px;
  @media (max-width: 768px) { width: 300px; height: 300px; }
`;
const MyPetContainerWrapper = styled(PetContainerWrapper)` bottom: 10px; left: 10px; `;
const OpponentPetContainerWrapper = styled(PetContainerWrapper)` top: 10px; right: 10px; `;

const PetContainer = styled.div`
  position: relative; width: 100%; height: 100%;
  animation: ${props =>
        props.$isHit ? css`${shakeDamage} 0.5s` :
            props.$animType === 'TACKLE' ? css`${props.$isMine ? tackleRight : tackleLeft}       0.5s ease-in-out` :
                props.$animType === 'ZIGZAG' ? css`${props.$isMine ? zigzagRight : zigzagLeft}       1.4s ease-in-out` :
                    props.$animType === 'FLAME_DASH' ? css`${props.$isMine ? flameDashRight : flameDashLeft}    1.1s ease-in-out` :
                        props.$animType === 'THUNDER_PUNCH' ? css`${props.$isMine ? thunderPunchRight : thunderPunchLeft} 0.7s ease-in-out` :
                            props.$animType === 'THUNDERSTORM' ? css`${props.$isMine ? thunderstormRight : thunderstormLeft} 1.4s ease-in-out` :
                                props.$animType === 'UPHWA' ? css`${props.$isMine ? uphwaChargeRight : uphwaChargeLeft}  1.5s ease-in-out` :
                                    props.$animType === 'SOLAR_BEAM' ? css`${props.$isMine ? solarBeamRight : solarBeamLeft}    1.5s ease-in-out` :
                                        props.$animType === 'STELLAR_BLAST' ? css`${props.$isMine ? stellarBlastRight : stellarBlastLeft}  1.6s ease-in-out` :
                                            props.$animType === 'WIND_BLADE' ? css`${props.$isMine ? windBladeRight : windBladeLeft}     1.1s ease-in-out` :
                                                props.$animType === 'TORNADO_SWEEP' ? css`${props.$isMine ? tornadoSweepRight : tornadoSweepLeft}  2.0s ease-in-out` :
                                                    props.$animType === 'DRAGON_CLAW' ? css`${props.$isMine ? dragonClawRight : dragonClawLeft} 1.0s ease-in-out` :
                                                        'none'};
  display: flex; flex-direction: column; align-items: center;
`;

const PetImage = styled.img`
  width: 100%; height: 100%; object-fit: contain;
  filter: ${props => props.$isFainted ? 'grayscale(100%)' : 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))'}; 
  transition: filter 0.3s;
`;

const InfoBox = styled.div`
  position: absolute; width: 280px; padding: 1rem; border: 2px solid #339af0;
  border-radius: 16px; background-color: rgba(255,255,255,0.9); backdrop-filter: blur(5px);
  display: flex; flex-direction: column; gap: 0.5rem; z-index: 5;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  
  span { font-weight: 800; color: #343a40; font-size: 1.1rem; }
  @media (max-width: 768px) { width: 200px; padding: 0.8rem; span { font-size: 0.9rem; } }
`;
const MyInfoBox = styled(InfoBox)` right: 20px; bottom: 20px; `;
const OpponentInfoBox = styled(InfoBox)` left: 20px; top: 20px; `;

const StatBar = styled.div`
  width: 100%; height: 18px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; position: relative;
  display: flex;
`;
const BarFill = styled.div`
  width: ${props => props.$percent}%; height: 100%; background-color: ${props => props.color}; transition: width 0.5s ease;
`;

// ▼▼▼ [수정완료] 보호막을 영롱한 보라색과 입체감 있는 그림자로 업데이트 완료했습니다! ▼▼▼
const ShieldFill = styled.div`
  width: ${props => props.$percent}%; height: 100%; 
  background-color: #845ef7; 
  transition: width 0.5s ease;
  border-left: 1px solid rgba(255,255,255,0.6);
  box-shadow: inset 0 0 10px rgba(255,255,255,0.4);
`;

const SpOverflowFill = styled.div`
  width: ${props => props.$percent}%; height: 100%; 
  background-color: #fcc419; /* 인기스타 전용 황금색 오버차지 효과 */
  transition: width 0.5s ease;
  border-left: 1px solid rgba(255,255,255,0.6);
  box-shadow: inset 0 0 10px rgba(255,255,255,0.6);
`;

const BarText = styled.div`
  position: absolute; width: 100%; height: 100%; top: 0; left: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; color: #fff; font-weight: 800; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  pointer-events: none;
`;

const QuizArea = styled.div`
  padding: 1.5rem; background-color: #fff; border: 2px solid #339af0;
  border-radius: 20px; display: grid; grid-template-columns: 1fr 320px;
  gap: 2rem; min-height: 220px; box-shadow: 0 4px 15px rgba(51, 154, 240, 0.1);
  
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const LogText = styled.p` 
  font-size: 1.3rem; font-weight: 700; min-height: 60px; margin: 0 0 1rem 0; color: #343a40;
  display: flex; align-items: center;
`;

const AnswerInput = styled.input`
  width: 100%; padding: 1rem; font-size: 1.2rem; text-align: center;
  border: 2px solid #dee2e6; border-radius: 12px; margin-top: 1rem;
  font-weight: 700;
  &:focus { outline: none; border-color: #339af0; box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1); }
`;

const ActionMenu = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;
`;

const MenuItem = styled.button`
  font-size: 1.1rem; font-weight: 800; padding: 1rem; border-radius: 12px;
  background-color: #f8f9fa; border: 2px solid #dee2e6; color: #495057;
  opacity: ${props => props.disabled ? 0.5 : 1}; cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s; display: flex; justify-content: center;
  align-items: center; text-align: center; width: 100%;
  
  &:hover:not(:disabled) { 
    background-color: #e7f5ff; 
    border-color: #339af0; 
    color: #1864ab; 
    transform: translateY(-2px); 
  }
`;

const Timer = styled.div`
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 3.5rem; font-weight: 900; color: #ff6b6b; background-color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem 2rem; border-radius: 30px; border: 4px solid #ff6b6b; z-index: 10;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  padding: 2rem 3rem; background: white; border-radius: 24px; text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  h2 { font-size: 2.5rem; margin-bottom: 1rem; color: ${props => props.$color || '#333'}; font-weight: 900; }
  p { font-size: 1.2rem; margin: 0.5rem 0; color: #495057; }
  button { 
    margin-top: 1.5rem; padding: 0.8rem 2.5rem; 
    font-size: 1.1rem; font-weight: 800; 
    background: #339af0; color: white; border: none; border-radius: 12px; cursor: pointer;
    &:hover { background: #228be6; }
  }
`;

const WaitingText = styled.div`
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    height: 300px; font-size: 1.5rem; color: #495057; gap: 1.5rem; font-weight: 700;
`;

const CancelButton = styled.button`
    padding: 0.8rem 2rem; font-size: 1.1rem; background-color: #ff6b6b; color: white;
    border: none; border-radius: 12px; cursor: pointer; font-weight: 800;
    &:hover { background-color: #fa5252; }
`;

const ChatBubble = styled.div`
    position: absolute;
    background: white;
    padding: 0.8rem 1.2rem;
    border-radius: 20px;
    border: 3px solid #333;
    max-width: 250px;
    word-wrap: break-word;
    z-index: 10;
    color: ${props => props.$isCorrect === false ? '#fa5252' : (props.$isCorrect === true ? '#20c997' : '#343a40')};
    font-weight: 800;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    font-size: 1.1rem;
    
    ${props => props.$isMine ? 'top: -80px; left: 50%;' : 'bottom: -80px; left: 50%;'}
    transform: translateX(-50%);

    &::after {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
        ${props => props.$isMine ? `
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 10px 10px 0 10px;
            border-color: #333 transparent transparent transparent;
        ` : `
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 0 10px 10px 10px;
            border-color: #333 transparent transparent transparent;
        `}
    }
`;

const OptionGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 1rem;
`;

const OXGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 1rem;
`;

const OXButton = styled.button`
    padding: 1.4rem;
    font-size: 3rem;
    font-weight: 900;
    border: 3px solid ${props => props.$ox === 'O' ? '#ff6b6b' : '#339af0'};
    border-radius: 16px;
    background: ${props => props.$ox === 'O' ? '#fff5f5' : '#e7f5ff'};
    color: ${props => props.$ox === 'O' ? '#e03131' : '#1864ab'};
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1;

    &:hover:not(:disabled) {
        background: ${props => props.$ox === 'O' ? '#ffe3e3' : '#d0ebff'};
        transform: translateY(-3px) scale(1.05);
        box-shadow: 0 6px 20px ${props => props.$ox === 'O' ? 'rgba(224,49,49,0.3)' : 'rgba(24,100,171,0.3)'};
    }
    &:active:not(:disabled) { transform: translateY(0) scale(0.97); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const OptionButton = styled.button`
    padding: 1.2rem;
    font-size: 1.1rem;
    font-weight: 800;
    border: 2px solid #dee2e6;
    border-radius: 12px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s;
    color: #495057;

    &:hover:not(:disabled) {
        background-color: #e7f5ff;
        border-color: #339af0;
        color: #1864ab;
        transform: translateY(-2px);
    }
    
    &:active:not(:disabled) {
        transform: translateY(0);
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const DEFENSE_ACTIONS = { BRACE: '웅크리기', EVADE: '회피하기', FOCUS: '기 모으기', FLEE: '도망치기' };

const getHpColor = (current, max) => {
    const percentage = (current / max) * 100;
    if (percentage <= 25) return '#fa5252';
    if (percentage <= 50) return '#fab005';
    return '#20c997';
};

function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players, processBattleResults, processBattleDraw } = useLeagueStore();
    const { classId } = useClassStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const battleId = useMemo(() => [myPlayerData?.id, opponentId].sort().join('_'), [myPlayerData, opponentId]);

    const [battleState, setBattleState] = useState(null);
    const [timeLeft, setTimeLeft] = useState(20);
    const [answer, setAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const [hitState, setHitState] = useState({ my: false, opponent: false });
    const [animState, setAnimState] = useState({ my: null, opponent: null });
    const [currentEffect, setCurrentEffect] = useState(null);
    const [dotEffect, setDotEffect] = useState(null); // { target: 'my'|'opponent', type: 'burn'|'poison' }

    // 선택지 셔플 — 문제가 바뀔 때마다 새로 섞음
    const [shuffledOptions, setShuffledOptions] = useState([]);
    // 화면 크기 조절 (태블릿 대응) — localStorage로 기기별 저장
    const [battleScale, setBattleScale] = useState(() => {
        const saved = typeof window !== 'undefined' && localStorage.getItem('battleScale');
        return saved ? parseFloat(saved) : 1.0;
    });
    useEffect(() => {
        const opts = battleState?.question?.options;
        if (!opts || opts.length === 0) { setShuffledOptions([]); return; }
        // OX 퀴즈는 순서 고정 (O 먼저)
        const isOX = opts.length === 2 && opts.every(o => o === 'O' || o === 'X' || o === '○' || o === '×');
        if (isOX) {
            setShuffledOptions(['O', 'X']);
        } else {
            setShuffledOptions([...opts].sort(() => Math.random() - 0.5));
        }
    }, [battleState?.question?.question]); // 문제 텍스트 기준으로 재셔플

    const [actionSubMenu, setActionSubMenu] = useState(null);
    const [quizPool, setQuizPool] = useState([]);

    const timerRef = useRef(null);
    const timeoutRef = useRef(null);
    const prevHpRef = useRef({ my: null, opponent: null });
    const processedTurnRef = useRef(null);

    const usableItems = Object.entries(myPlayerData?.petInventory || {})
        .filter(([itemId, qty]) => qty > 0 && itemId === 'brain_snack');

    useEffect(() => {
        const loadQuizzes = async () => {
            if (!classId) return;
            const activeSets = await getActiveQuizSets(classId);
            let allQuestions = [];

            if (activeSets.length > 0) {
                activeSets.forEach(set => {
                    if (Array.isArray(set.questions)) {
                        allQuestions = [...allQuestions, ...set.questions];
                    }
                });
            } else {
                allQuestions = [{ question: "선생님이 출제한 퀴즈가 없습니다.", answer: "0", type: "subjective" }];
            }
            setQuizPool(allQuestions);
        };
        loadQuizzes();
    }, [classId]);

    const getPetImageSrc = (info, isMine) => {
        if (!info || !info.pet) return null;
        const { appearanceId, status } = info.pet;

        const isDefenderTurn = (battleState?.status === 'action' || battleState?.status === 'resolution')
            && battleState?.turn !== info.id;

        if (isDefenderTurn) {
            return isMine
                ? (petImageMap[`${appearanceId}_brace_back`] || petImageMap[`${appearanceId}_battle`])
                : (petImageMap[`${appearanceId}_brace`] || petImageMap[`${appearanceId}_idle`]);
        }

        if (status?.recharging) {
            return isMine
                ? (petImageMap[`${appearanceId}_brace_back`] || petImageMap[`${appearanceId}_battle`])
                : (petImageMap[`${appearanceId}_brace`] || petImageMap[`${appearanceId}_idle`]);
        }

        return isMine ? petImageMap[`${appearanceId}_battle`] : petImageMap[`${appearanceId}_idle`];
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/pet');
        }
    };

    useEffect(() => {
        if (!myPlayerData || !classId) return;
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBattleState(data);
                if (data.status === 'rejected') {
                    alert("상대방이 대전을 거절했습니다.");
                    goBack();
                }
                if (data.status === 'cancelled') {
                    goBack();
                }
            } else {
                setBattleState(null);
            }
        });
        return () => unsubscribe();
    }, [myPlayerData, battleId, classId, navigate]);

    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger.id;

        clearTimeout(timeoutRef.current);
        clearInterval(timerRef.current);

        if (iAmChallenger && battleState.status === 'starting') {
            timeoutRef.current = setTimeout(() => {
                startNewTurn(battleRef, "대결 시작! 퀴즈를 풀어 선공을 차지하세요!");
            }, 1500);
            return;
        }

        if (battleState.status === 'finished') {
            return;
        }

        if (battleState.status === 'quiz' || battleState.status === 'action') {
            const updateTimer = () => {
                const now = Date.now();
                const limitSeconds = battleState.status === 'quiz' ? 15 : 10;
                const elapsed = now - (battleState.turnStartTime || now);
                const remaining = Math.max(0, Math.ceil(limitSeconds - (elapsed / 1000)));

                setTimeLeft(remaining);

                if (isProcessing) return;

                if (elapsed > limitSeconds * 1000) {
                    clearInterval(timerRef.current);
                    if (battleState.status === 'quiz') handleTimeout(battleRef);
                    else handleActionTimeout(battleRef);
                }
            };

            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        }

        if (battleState.status === 'action' && battleState.attackerAction && battleState.defenderAction) {

            const turnUniqueId = `${battleState.turnStartTime}_${battleState.turn}`;

            if (!isProcessing && processedTurnRef.current !== turnUniqueId) {

                setIsProcessing(true);
                processedTurnRef.current = turnUniqueId;

                const isAttackerMe = battleState.turn === myPlayerData.id;
                const actionType = battleState.attackerAction ? battleState.attackerAction.toUpperCase() : '';

                if (actionType === 'TACKLE') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'TACKLE' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'TACKLE' }));

                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 200);

                    setTimeout(() => {
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 600);

                } else if (actionType === 'WIND_BLADE') {
                    // 바람의 칼날: 펫 3연 슬래시 전진 + 슬래시 이펙트 3연타
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'WIND_BLADE' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'WIND_BLADE' }));
                    setCurrentEffect({ type: 'WIND_BLADE', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 350);
                    setTimeout(() => { setHitState({ my: false, opponent: false }); }, 500);
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 600);
                    setTimeout(() => { setHitState({ my: false, opponent: false }); }, 750);
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 850);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1400);

                } else if (actionType === 'TORNADO_SWEEP') {
                    // 토네이도: 펫 회전 돌진 + 회오리 멀티 이펙트 + 화면 흔들기
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'TORNADO_SWEEP' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'TORNADO_SWEEP' }));
                    setCurrentEffect({ type: 'TORNADO_SWEEP', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 600);
                    setTimeout(() => { setHitState({ my: false, opponent: false }); }, 800);
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 1100);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 2200);

                } else if (actionType === 'QUICK_DISTURBANCE') {
                    // 토끼가 직접 지그재그 질주 — 이펙트 + 펫 이동 동시
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'ZIGZAG' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'ZIGZAG' }));
                    setCurrentEffect({ type: 'QUICK_DISTURBANCE', isMine: isAttackerMe });

                    // 충돌 히트: 지그재그 중반부(500ms)에 맞춤
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 500);
                    setTimeout(() => {
                        setHitState({ my: false, opponent: false });
                    }, 700);
                    // 두 번째 충돌(800ms)
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 800);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1600);

                } else if (actionType === 'FLAME_DASH') {
                    // 불비비가 빛을 내며 직선 돌진 — 이펙트 + 펫 이동
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'FLAME_DASH' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'FLAME_DASH' }));
                    setCurrentEffect({ type: 'FLAME_DASH', isMine: isAttackerMe });

                    // 돌진 최고속도 시점에 히트
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 420);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1300);

                } else if (actionType === 'THUNDER_PUNCH') {
                    // 찌릿펀치: 펫이 전방 돌진 + 주먹+번개 아이콘 동시 발사
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'THUNDER_PUNCH' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'THUNDER_PUNCH' }));
                    setCurrentEffect({ type: 'THUNDER_PUNCH', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 350);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 900);

                } else if (actionType === 'THUNDERSTORM') {
                    // 뇌우: 펫 돌진 + 화면 전체 번개 이펙트
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'THUNDERSTORM' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'THUNDERSTORM' }));
                    setCurrentEffect({ type: 'THUNDERSTORM', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 500);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1800);

                } else if (actionType === 'UPHWA') {
                    // 업화: 펫이 솟구치며 돌진 + 화염 이펙트
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'UPHWA' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'UPHWA' }));
                    setCurrentEffect({ type: 'UPHWA', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 600);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1900);

                } else if (actionType === 'SOLAR_BEAM') {
                    // 솔라빔: 펫이 빛을 모아 전진
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'SOLAR_BEAM' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'SOLAR_BEAM' }));
                    setCurrentEffect({ type: 'SOLAR_BEAM', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 650);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1900);

                } else if (actionType === 'STELLAR_BLAST') {
                    // 스텔라 블라스트: 별폭발 + 펫 솟구침
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'STELLAR_BLAST' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'STELLAR_BLAST' }));
                    setCurrentEffect({ type: 'STELLAR_BLAST', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 600);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 2000);

                } else if (actionType === 'DRAGON_CLAW') {
                    // 🐲 용의 발톱: 불꽃을 두르며 뛰어들어 2연 할퀴기 후 복귀
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'DRAGON_CLAW' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'DRAGON_CLAW' }));
                    setCurrentEffect({ type: 'DRAGON_CLAW', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 280);
                    setTimeout(() => { setHitState({ my: false, opponent: false }); }, 430);
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 530);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 1200);

                } else {
                    setCurrentEffect({
                        type: actionType,
                        isMine: isAttackerMe
                    });
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setIsProcessing(false);
                        handleResolution(battleRef);
                    }, 2000);
                }
            }
        }

        return () => {
            clearInterval(timerRef.current);
            clearTimeout(timeoutRef.current);
        };
    }, [battleState, myPlayerData, isProcessing, classId, battleId]);

    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const iAmChallenger = myPlayerData.id === battleState.challenger.id;
        const myRole = iAmChallenger ? 'challenger' : 'opponent';
        const opponentRole = iAmChallenger ? 'opponent' : 'challenger';

        const currentMyHp = battleState[myRole].pet.hp;
        const currentOpponentHp = battleState[opponentRole].pet.hp;

        if (prevHpRef.current.my !== null && prevHpRef.current.opponent !== null) {
            if (currentMyHp < prevHpRef.current.my && !hitState.my) {
                setHitState(prev => ({ ...prev, my: true }));
                setTimeout(() => setHitState(prev => ({ ...prev, my: false })), 500);
            }
            if (currentOpponentHp < prevHpRef.current.opponent && !hitState.opponent) {
                setHitState(prev => ({ ...prev, opponent: true }));
                setTimeout(() => setHitState(prev => ({ ...prev, opponent: false })), 500);
            }
        }
        prevHpRef.current = { my: currentMyHp, opponent: currentOpponentHp };

    }, [battleState, myPlayerData]);

    const handleCancel = async () => {
        if (!classId || !battleId) return;
        if (window.confirm("대결 신청을 취소하시겠습니까?")) {
            await cancelBattleChallenge(classId, battleId);
            goBack();
        }
    };

    const startNewTurn = async (battleRef, log) => {
        const randomQuiz = (quizPool && quizPool.length > 0)
            ? quizPool[Math.floor(Math.random() * quizPool.length)]
            : { question: "퀴즈 로딩 중...", answer: "1" };

        await updateDoc(battleRef, {
            status: 'quiz',
            log: log,
            question: randomQuiz,
            turnStartTime: Date.now(),
            turn: null,
            attackerAction: null,
            defenderAction: null,
            chat: {}
        });
    };

    const handleActionTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'action') return;
                const data = battleDoc.data();
                if (Date.now() - data.turnStartTime < 9500) return;

                const updates = {};
                if (!data.attackerAction) updates.attackerAction = 'TACKLE';
                if (!data.defenderAction) updates.defenderAction = 'BRACE';

                if (Object.keys(updates).length > 0) transaction.update(battleRef, updates);
            });
        } catch (error) {
            console.error("Action timeout error:", error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    // ▼▼▼ [수정완료] 일타강사 칭호 효과 연동 (시간 초과 오답 페널티 폭증) ▼▼▼
    const handleTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status === 'finished' || data.status !== 'quiz') return null;
                if (Date.now() - data.turnStartTime < 14500) return null;

                let { challenger, opponent } = data;

                let damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                if (opponent.equippedTitle === 'daily_helper') damageChallenger *= 2; // 일타강사 저격 패시브

                let damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));
                if (challenger.equippedTitle === 'daily_helper') damageOpponent *= 2; // 일타강사 저격 패시브

                challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                if (challenger.pet.status?.stunned) delete challenger.pet.status.stunned;
                if (opponent.pet.status?.stunned) delete opponent.pet.status.stunned;

                const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                let winnerId = null;

                if (isFinished) {
                    if (challenger.pet.hp > 0) winnerId = challenger.id;
                    else if (opponent.pet.hp > 0) winnerId = opponent.id;
                }

                const nextQuiz = (quizPool && quizPool.length > 0)
                    ? quizPool[Math.floor(Math.random() * quizPool.length)]
                    : { question: "퀴즈 로딩 중...", answer: "1" };

                const updateData = {
                    challenger,
                    opponent,
                    log: isFinished ? `시간 초과! 펫이 지쳐 쓰러졌습니다!` : `시간 초과! 서로 눈치만 보다가 체력이 감소했습니다!`,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    attackerAction: null,
                    defenderAction: null,
                    turn: null,
                    ...(!isFinished && {
                        turnStartTime: Date.now(),
                        question: nextQuiz,
                        chat: {}
                    })
                };
                transaction.update(battleRef, updateData);
                return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }
        } catch (error) {
            console.error("Timeout handling error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // ▼▼▼ [수정완료] 일타강사 칭호 효과 연동 (퀴즈 오답 시 실전 페널티 폭증) ▼▼▼
    // ▼▼▼ [수정완료] 일타강사 칭호 효과 연동 (퀴즈 오답 시 즉발 데미지 처벌) ▼▼▼
    const processQuizAnswer = async (submittedAnswer) => {
        if (!battleState.question || !submittedAnswer || isProcessing) return;

        const isObjective = (battleState.question.options && battleState.question.options.length > 0) || battleState.question.type === 'ox';

        // OX 정규화: ○→O, ×→X
        const normalizeOX = (s) => s.replace('○', 'O').replace('×', 'X').trim().toLowerCase();
        const isCorrect = normalizeOX(submittedAnswer) === normalizeOX(battleState.question.answer);

        if (isObjective && battleState.chat?.[myPlayerData.id]) return;

        setIsProcessing(true);
        const filteredAnswer = filterProfanity(submittedAnswer);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleRef = doc(db, 'classes', classId, 'battles', battleId);
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return null;

                const data = battleDoc.data();
                const myId = myPlayerData.id;
                const isQuestionObjective = data.question.options && data.question.options.length > 0;

                if (isQuestionObjective && data.chat && data.chat[myId]) return null;

                const isChallenger = myId === data.challenger.id;
                const myRole = isChallenger ? 'challenger' : 'opponent';
                const opponentRole = isChallenger ? 'opponent' : 'challenger';
                const opponentId = data[opponentRole].id;
                const opponentChat = data.chat?.[opponentId];
                const opponentIsStunned = data[opponentRole].pet.status?.stunned;

                const myPet = data[myRole].pet;
                // OX 정규화 재적용 (트랜잭션 내부)
                const normalizeAns = (s) => (s || '').replace('○', 'O').replace('×', 'X').trim().toLowerCase();
                const txIsCorrect = normalizeAns(filteredAnswer) === normalizeAns(data.question.answer);
                const myChatEntry = { text: filteredAnswer, isCorrect: txIsCorrect, timestamp: Date.now() };
                const updatedChat = { ...(data.chat || {}), [myId]: myChatEntry };

                if (txIsCorrect) {
                    const winnerId = myPlayerData.id;
                    let newStatus = { ...myPet.status };

                    if (newStatus.recharging) {
                        delete newStatus.recharging;
                        const nextQuiz = (quizPool && quizPool.length > 0)
                            ? quizPool[Math.floor(Math.random() * quizPool.length)]
                            : { question: "퀴즈 로딩 중...", answer: "1" };

                        transaction.update(battleRef, {
                            status: 'quiz',
                            turn: null,
                            [`${myRole}.pet.status`]: newStatus,
                            log: `정답! ${myPet.name}은(는) 숨을 고르며 반동을 회복했습니다.`,
                            question: nextQuiz,
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    } else {
                        transaction.update(battleRef, {
                            status: 'action',
                            turn: winnerId,
                            log: `정답! ${myPet.name}의 행동 선택!`,
                            question: null,
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    }
                    return null;
                } else {
                    let shouldEndTurn = false;

                    if (isQuestionObjective) {
                        if ((opponentChat && opponentChat.isCorrect === false) || opponentIsStunned) {
                            shouldEndTurn = true;
                        }
                    }

                    if (shouldEndTurn) {
                        let { challenger, opponent } = data;

                        let damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                        if (opponent.equippedTitle === 'daily_helper') damageChallenger *= 2;

                        let damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));
                        if (challenger.equippedTitle === 'daily_helper') damageOpponent *= 2;

                        challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                        opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                        if (challenger.pet.status?.stunned) delete challenger.pet.status.stunned;
                        if (opponent.pet.status?.stunned) delete opponent.pet.status.stunned;

                        const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                        let winnerId = null;

                        if (isFinished) {
                            if (challenger.pet.hp > 0) winnerId = challenger.id;
                            else if (opponent.pet.hp > 0) winnerId = opponent.id;
                        }

                        const nextQuiz = (quizPool && quizPool.length > 0)
                            ? quizPool[Math.floor(Math.random() * quizPool.length)]
                            : { question: "퀴즈 로딩 중...", answer: "1" };

                        let logMessage = `둘 다 오답! 서로 틀려서 데미지를 입었습니다. 다음 문제!`;
                        if (opponent.equippedTitle === 'daily_helper' || challenger.equippedTitle === 'daily_helper') {
                            logMessage = `💥 [일타강사 패시브] 일타강사의 날카로운 압박으로 오답 페널티가 2배로 증폭되었습니다! (-10%)`;
                        }

                        const updateData = {
                            challenger,
                            opponent,
                            log: logMessage,
                            status: isFinished ? 'finished' : 'quiz',
                            winner: winnerId,
                            turn: null,
                            ...(!isFinished && {
                                turnStartTime: Date.now(),
                                question: nextQuiz,
                                chat: {}
                            })
                        };
                        transaction.update(battleRef, updateData);

                        if (isFinished) {
                            return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
                        }
                    } else {
                        // ▼▼▼ [신규] 즉각 처벌 로직: 혼자 오답을 냈을 때 상대가 일타강사인지 확인 ▼▼▼
                        const opponentTitle = data[opponentRole].equippedTitle;

                        if (opponentTitle === 'daily_helper') {
                            let damage = Math.max(1, Math.floor(myPet.maxHp * 0.05));
                            myPet.hp = Math.max(0, myPet.hp - damage);
                            const isFinished = myPet.hp <= 0;

                            if (isFinished) {
                                // 오답 데미지 누적으로 사망한 경우
                                let { challenger, opponent } = data;
                                challenger.pet = myRole === 'challenger' ? myPet : data.challenger.pet;
                                opponent.pet = myRole === 'opponent' ? myPet : data.opponent.pet;

                                transaction.update(battleRef, {
                                    challenger,
                                    opponent,
                                    chat: updatedChat,
                                    log: `💥 팩트 폭력! ${myPlayerData.name}님이 일타강사의 지적을 버티지 못하고 쓰러졌습니다!`,
                                    status: 'finished',
                                    winner: opponentId,
                                    turn: null
                                });
                                return { isFinished: true, winnerId: opponentId, finalChallenger: challenger, finalOpponent: opponent };
                            } else {
                                // 생존 시 즉발 데미지만 입고 기회 유지
                                transaction.update(battleRef, {
                                    chat: updatedChat,
                                    [`${myRole}.pet.hp`]: myPet.hp,
                                    log: `💥 [일타강사 압박] 틀렸습니다! 날카로운 지적에 데미지를 입었습니다! (-5%)`
                                });
                            }
                        } else {
                            // 일반적인 오답
                            transaction.update(battleRef, {
                                chat: updatedChat,
                                log: `${myPlayerData.name} 오답! (다시 시도하세요)`
                            });
                        }
                        // ▲▲▲ [신규 로직 끝] ▲▲▲
                    }
                    return null;
                }
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }

        } catch (error) {
            console.error("퀴즈 처리 오류:", error);
        } finally {
            setAnswer('');
            setIsProcessing(false);
        }
    };

    const handleQuizSubmit = (e) => {
        e.preventDefault();
        processQuizAnswer(answer.trim());
    };

    const handleOptionClick = (option) => {
        processQuizAnswer(option);
    };

    const handleUseItem = async (itemId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleId);
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return;
                const data = battleDoc.data();

                const playerRef = doc(db, 'classes', classId, 'players', myPlayerData.id);
                const playerDoc = await transaction.get(playerRef);
                const playerData = playerDoc.data();

                const currentQty = playerData.petInventory?.[itemId] || 0;
                if (currentQty <= 0) return;

                const newInventory = { ...playerData.petInventory };
                newInventory[itemId] -= 1;
                transaction.update(playerRef, { petInventory: newInventory });

                const myRole = myPlayerData.id === data.challenger.id ? 'challenger' : 'opponent';
                const myPet = { ...data[myRole].pet };

                const healHp = Math.floor(myPet.maxHp * 0.30);
                const healSp = Math.floor(myPet.maxSp * 0.30);

                myPet.hp = Math.min(myPet.maxHp, myPet.hp + healHp);
                myPet.sp = Math.min(myPet.maxSp, myPet.sp + healSp);

                const nextQuiz = (quizPool && quizPool.length > 0)
                    ? quizPool[Math.floor(Math.random() * quizPool.length)]
                    : { question: "퀴즈 로딩 중...", answer: "1" };

                transaction.update(battleRef, {
                    [myRole]: { ...data[myRole], pet: myPet },
                    log: `${playerData.name}의 펫이 두뇌 간식을 먹었습니다! (HP/SP +30% 회복)`,
                    status: 'quiz',
                    turn: null,
                    attackerAction: null,
                    defenderAction: null,
                    question: nextQuiz,
                    turnStartTime: Date.now(),
                    chat: {}
                });
            });
        } catch (error) {
            console.error("아이템 사용 오류:", error);
            alert("아이템 사용 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(false);
            setActionSubMenu(null);
        }
    };

    const handleActionSelect = async (actionId) => {
        if (isProcessing) return;
        setIsProcessing(true);
        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const isMyTurn = battleState.turn === myPlayerData.id;

        try {
            if (isMyTurn) {
                const myRole = myPlayerData.id === battleState.challenger.id ? 'challenger' : 'opponent';
                const opponentRole = myRole === 'challenger' ? 'opponent' : 'challenger';
                const myPet = battleState[myRole].pet;

                // recharging(용의 숨결 반동) 중이면 자동으로 TACKLE 강제 (휴식 턴)
                let resolvedActionId = actionId;
                if (myPet.status?.recharging) {
                    resolvedActionId = 'TACKLE'; // 실질적으로 아무것도 못 함
                    delete myPet.status.recharging;
                }

                const updates = { attackerAction: resolvedActionId };
                const opponentIsStunned = battleState[opponentRole].pet.status?.stunned;

                if (opponentIsStunned) {
                    updates.defenderAction = 'STUNNED';
                    updates.log = `${myPet.name}의 공격! (상대방은 혼란 상태라 방어 불가!)`;
                }

                // recharging이었다면 log에 휴식 표시
                if (myPet.status?.recharging === false && resolvedActionId === 'TACKLE') {
                    updates.log = `💤 ${myPet.name}은(는) 반동으로 지쳐 쉬었습니다!`;
                    updates.defenderAction = updates.defenderAction || 'BRACE';
                }

                await updateDoc(battleRef, updates);
            } else {
                if (actionId === 'FLEE') {
                    if (Math.random() < 0.3) {
                        const opponentId = battleState.turn;
                        const myId = myPlayerData.id;

                        const isChallengerMe = myPlayerData.id === battleState.challenger.id;
                        const myPet = isChallengerMe ? battleState.challenger.pet : battleState.opponent.pet;
                        const opponentPet = isChallengerMe ? battleState.opponent.pet : battleState.challenger.pet;

                        await updateDoc(battleRef, {
                            status: 'finished',
                            winner: null,
                            defenderAction: 'FLEE_SUCCESS',
                            log: `${myPet.name}이(가) 도망쳤습니다!`
                        });

                        await processBattleDraw(classId, myId, opponentId, myPet, opponentPet);
                        setTimeout(() => goBack(), 2000);
                    } else {
                        await updateDoc(battleRef, { defenderAction: 'FLEE_FAILED', log: '도망치기에 실패했다!' });
                    }
                } else {
                    await updateDoc(battleRef, { defenderAction: actionId });
                }
            }
            setActionSubMenu(null);
        } catch (error) {
            console.error("Action select error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // ▼▼▼ [수정완료] 우리반 지식인(스킬코스트 감면) 및 성실한 나무(턴 종료시 5% 힐) 연동 완료 ▼▼▼
    const handleResolution = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status === 'finished') return null;

                let { challenger, opponent, turn, attackerAction, defenderAction } = data;
                if (!attackerAction || !defenderAction) return null;

                const isChallengerAttacker = turn === challenger.id;
                let attacker = isChallengerAttacker ? { ...challenger } : { ...opponent };
                let defender = isChallengerAttacker ? { ...opponent } : { ...challenger };

                if (defender.pet.status?.stunned) {
                    delete defender.pet.status.stunned;
                }

                let skillId = attackerAction.toUpperCase();
                let skill = SKILLS[skillId];
                let isSpInsufficient = false;
                const originalSkillName = skill?.name;

                // [지식인 칭호 효과 버프] 스킬 코스트 계산 전 20% 할인
                // [밸런스] 레벨에 따른 SP 코스트 스케일링 적용
                let actualCost = skill ? getScaledSkillCost(skill.cost, attacker.pet.level) : 0;
                if (skill && attacker.equippedTitle === 'classroom_intellectual') {
                    actualCost = Math.floor(actualCost * 0.8);
                }

                if (skill && actualCost > attacker.pet.sp) {
                    skillId = 'TACKLE';
                    skill = SKILLS.TACKLE;
                    isSpInsufficient = true;
                    actualCost = 0;
                }

                let log = "";
                if (skill && skill.effect) {
                    // petData에 플레이어 전체 정보를 넘겨 칭호를 판별합니다.
                    log = skill.effect(attacker, defender, defenderAction);
                    if (isSpInsufficient) {
                        log = `(SP 부족!) ${originalSkillName} 실패.. 대신 ${log}`;
                    }
                } else {
                    let damage = 20 + attacker.pet.atk * 2;
                    if (defenderAction === 'BRACE') damage *= 0.7; // 밸런싱 수정치 적용
                    damage = Math.round(damage);
                    defender.pet.hp = Math.max(0, defender.pet.hp - damage);
                    log += `${attacker.pet.name}의 공격! ${damage}의 피해!`;
                }

                if (skill) {
                    attacker.pet.sp = Math.max(0, attacker.pet.sp - actualCost);
                }

                // ─────────────────────────────────────────────────────────
                // 📌 상태이상 도트딜 & 턴 종료 처리 (스킬 발동 후, 승패 판정 전)
                // ─────────────────────────────────────────────────────────

                // 1. focusCharge 일괄 소비 (스킬별 개별 처리 제거 → 여기서 통일)
                //    calculateDamage 내부에서 이미 2배 적용됨. 이 턴에 소비.
                if (attacker.pet.status?.focusCharge) {
                    attacker.pet.status.focusCharge = 0;
                }

                // 2. 화상(burned) 도트딜 — 방어자에게 적용
                //    최대 체력의 8%. UPHWA 소비 후 이미 burned가 false로 바뀌었으면 스킵.
                if (defender.pet.status?.burned) {
                    const burnDmg = Math.round(defender.pet.maxHp * 0.08);
                    defender.pet.hp = Math.max(0, defender.pet.hp - burnDmg);
                    log += ` 🔥 [화상 도트] ${burnDmg}의 화상 피해!`;
                    // UI 이펙트 트리거 (배틀 결과 수신 후)
                    const defenderIsMe = isChallengerAttacker
                        ? (myPlayerData?.id === (isChallengerAttacker ? data.opponent?.id : data.challenger?.id))
                        : true;
                    setTimeout(() => {
                        setDotEffect({ target: isChallengerAttacker ? 'opponent' : 'my', type: 'burn' });
                        setTimeout(() => setDotEffect(null), 900);
                    }, 300);
                }

                // 3. 중독(poisoned) 도트딜 — 방어자에게 적용
                //    최대 체력의 6%. 3턴 후 자동 만료.
                if (defender.pet.status?.poisoned) {
                    const poisonDmg = Math.round(defender.pet.maxHp * 0.06);
                    defender.pet.hp = Math.max(0, defender.pet.hp - poisonDmg);
                    log += ` ☠️ [중독 도트] ${poisonDmg}의 독 피해!`;
                    setTimeout(() => {
                        setDotEffect({ target: isChallengerAttacker ? 'opponent' : 'my', type: 'poison' });
                        setTimeout(() => setDotEffect(null), 900);
                    }, 600);

                    // 중독 지속 턴 관리
                    defender.pet.status.poisonTurns = (defender.pet.status.poisonTurns ?? 3) - 1;
                    if (defender.pet.status.poisonTurns <= 0) {
                        delete defender.pet.status.poisoned;
                        delete defender.pet.status.poisonTurns;
                        log += ` (중독이 풀렸습니다.)`;
                    }
                }

                // 4. defenseUp 지속 턴 관리 — 공격자(행동한 쪽) 기준 소모
                //    2턴 지속. 매 자신의 행동 턴마다 1씩 감소.
                if (attacker.pet.status?.defenseUp) {
                    attacker.pet.status.defenseUpTurns = (attacker.pet.status.defenseUpTurns ?? 2) - 1;
                    if (attacker.pet.status.defenseUpTurns <= 0) {
                        delete attacker.pet.status.defenseUp;
                        delete attacker.pet.status.defenseUpTurns;
                        log += ` (${attacker.pet.name}의 방어력 강화가 풀렸습니다.)`;
                    }
                }

                // [성실한 나무 칭호 효과 버프] 턴 종료 시 행동한 펫 최대체력의 5% 자가 회복 발동
                if (attacker.equippedTitle === 'diligent_tree') {
                    const heal = Math.floor(attacker.pet.maxHp * 0.05);
                    attacker.pet.hp = Math.min(attacker.pet.maxHp, attacker.pet.hp + heal);
                    log += ` 🌳 [성실한 나무 효과로 HP +${heal} 회복]`;
                }

                // ─────────────────────────────────────────────────────────
                // 승패 판정 (도트딜 포함 최종 HP 기준)
                // ─────────────────────────────────────────────────────────
                const isFinished = defender.pet.hp <= 0;
                let winnerId = null;
                if (isFinished) {
                    winnerId = attacker.id;
                    log += ` ${defender.pet.name}은(는) 쓰러졌다! ${attacker.name}의 승리!`;
                }

                const nextQuiz = (quizPool && quizPool.length > 0)
                    ? quizPool[Math.floor(Math.random() * quizPool.length)]
                    : { question: "퀴즈 데이터 없음", answer: "1" };

                const updateData = {
                    log,
                    challenger: isChallengerAttacker ? attacker : defender,
                    opponent: isChallengerAttacker ? defender : attacker,
                    status: isFinished ? 'finished' : 'quiz',
                    winner: winnerId,
                    ...(!isFinished && {
                        question: nextQuiz,
                        turnStartTime: Date.now(),
                        turn: null,
                        attackerAction: null,
                        defenderAction: null,
                        chat: {}
                    })
                };

                transaction.update(battleRef, updateData);
                return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
            });

            if (result && result.isFinished) {
                const winnerPet = result.winnerId === result.finalChallenger.id ? result.finalChallenger.pet : result.finalOpponent.pet;
                const loserPet = result.winnerId === result.finalChallenger.id ? result.finalOpponent.pet : result.finalChallenger.pet;
                const loserId = result.winnerId === result.finalChallenger.id ? result.finalOpponent.id : result.finalChallenger.id;

                await processBattleResults(classId, result.winnerId, loserId, false, winnerPet, loserPet);
            }
        } catch (error) {
            console.error("Battle resolution error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    // ▼▼▼ [수정완료] 지식인 버프 + 레벨 SP 스케일링 연동 헬퍼 함수 (메뉴 UI 표시용) ▼▼▼
    const getSkillCost = (skill) => {
        const scaled = getScaledSkillCost(skill.cost, myInfo?.pet?.level);
        return myInfo.equippedTitle === 'classroom_intellectual' ? Math.floor(scaled * 0.8) : scaled;
    };

    const renderHpBar = (hp, maxHp) => {
        const interstateShield = hp > maxHp;
        const displayMax = interstateShield ? hp : maxHp;
        const baseHpPercent = interstateShield ? (maxHp / displayMax) * 100 : (hp / maxHp) * 100;
        const shieldPercent = interstateShield ? ((hp - maxHp) / displayMax) * 100 : 0;

        return (
            <StatBar>
                <BarFill $percent={Math.max(0, baseHpPercent)} color={getHpColor(Math.min(hp, maxHp), maxHp)} />
                {interstateShield && <ShieldFill $percent={shieldPercent} />}
                <BarText>HP: {hp} / {maxHp}</BarText>
            </StatBar>
        );
    };

    const renderSpBar = (sp, maxSp) => {
        const hasOverflow = sp > maxSp;
        const displayMax = hasOverflow ? sp : maxSp;
        const baseSpPercent = hasOverflow ? (maxSp / displayMax) * 100 : (sp / maxSp) * 100;
        const overflowPercent = hasOverflow ? ((sp - maxSp) / displayMax) * 100 : 0;

        return (
            <StatBar>
                <BarFill $percent={Math.max(0, baseSpPercent)} color="#007bff" />
                {hasOverflow && <SpOverflowFill $percent={overflowPercent} />}
                <BarText>SP: {sp} / {maxSp}</BarText>
            </StatBar>
        );
    };

    if (!myPlayerData) return <Arena><p>플레이어 정보를 불러오는 중...</p></Arena>;
    if (!battleState) return <Arena><WaitingText>상대방의 수락을 기다리는 중...</WaitingText></Arena>;

    if (battleState.status === 'pending' && myPlayerData.id === battleState.challenger.id) {
        return (
            <Arena>
                <WaitingText>
                    <p>{battleState.log}</p>
                    <CancelButton onClick={handleCancel}>신청 취소</CancelButton>
                </WaitingText>
            </Arena>
        );
    }

    const IamChallenger = myPlayerData.id === battleState.challenger.id;
    const myRole = IamChallenger ? 'challenger' : 'opponent';
    const myInfo = battleState[myRole];
    const opponentInfo = battleState[IamChallenger ? 'opponent' : 'challenger'];

    const isAttacker = battleState.turn === myPlayerData.id;
    const showActionMenu = battleState.status === 'action' && isAttacker && !battleState.attackerAction;
    const showDefenseMenu = battleState.status === 'action' && !isAttacker && !battleState.defenderAction;

    const myEquippedSkills = myInfo.pet.equippedSkills
        .filter(id => id.toLowerCase() !== 'tackle')
        .map(id => {
            const skill = SKILLS[id.toUpperCase()];
            return skill ? { ...skill, id: id.toUpperCase() } : null;
        })
        .filter(Boolean);

    const showTimer = (battleState.status === 'quiz' || battleState.status === 'action');
    const isStunned = myInfo.pet.status?.stunned;
    const hasSubmitted = battleState.chat?.[myPlayerData?.id] !== undefined;

    return (
        <>
            <ScaleControlBar>
                <span>🔍 화면 크기</span>
                <ScaleSlider
                    type="range" min="0.5" max="1.0" step="0.05"
                    value={battleScale}
                    onChange={e => {
                        const v = parseFloat(e.target.value);
                        setBattleScale(v);
                        localStorage.setItem('battleScale', v);
                    }}
                />
                <span style={{ minWidth: 40 }}>{Math.round(battleScale * 100)}%</span>
                <button
                    onClick={() => { setBattleScale(1.0); localStorage.removeItem('battleScale'); }}
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #dee2e6', background: '#f8f9fa', cursor: 'pointer' }}
                >초기화</button>
            </ScaleControlBar>
            <Arena $scale={battleScale}>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {showTimer && <Timer>{timeLeft}</Timer>}
                            {currentEffect && (
                                <BattleSkillEffect
                                    type={currentEffect.type}
                                    isMine={currentEffect.isMine}
                                />
                            )}

                            <MyInfoBox>
                                <span>{myInfo.pet.name} (Lv.{myInfo.pet.level})</span>
                                {renderHpBar(myInfo.pet.hp, myInfo.pet.maxHp)}
                                {renderSpBar(myInfo.pet.sp, myInfo.pet.maxSp)}
                            </MyInfoBox>

                            <OpponentInfoBox>
                                <span>{opponentInfo.pet.name} (Lv.{opponentInfo.pet.level})</span>
                                {renderHpBar(opponentInfo.pet.hp, opponentInfo.pet.maxHp)}
                                {renderSpBar(opponentInfo.pet.sp, opponentInfo.pet.maxSp)}
                            </OpponentInfoBox>

                            <OpponentPetContainerWrapper>
                                <PetContainer $isHit={hitState.opponent} $animType={animState.opponent} $isMine={false}>
                                    {opponentInfo.pet.status?.stunned && <StunEffect />}
                                    {opponentInfo.pet.status?.recharging && <RechargeEffect>💤 지침...</RechargeEffect>}
                                    {opponentInfo.pet.status?.burned && <RechargeEffect style={{ color: '#ff6b35' }}>🔥 화상</RechargeEffect>}
                                    {opponentInfo.pet.status?.poisoned && <RechargeEffect style={{ color: '#9775fa', top: 'auto', bottom: '36px' }}>☠️ 중독</RechargeEffect>}
                                    {opponentInfo.pet.status?.defenseUp && <RechargeEffect style={{ color: '#339af0', top: 'auto', bottom: '60px' }}>🛡️ 방어↑</RechargeEffect>}
                                    {opponentInfo.pet.status?.blind && <RechargeEffect style={{ color: '#868e96', top: 'auto', bottom: '84px' }}>🙈 실명</RechargeEffect>}
                                    {dotEffect?.target === 'opponent' && (
                                        <DotDamageEffect $type={dotEffect.type} $top="15%" $left="55%">
                                            {dotEffect.type === 'burn' ? '🔥' : '☠️'}
                                        </DotDamageEffect>
                                    )}
                                    {battleState.chat?.[opponentInfo.id] && <ChatBubble $isMine={false} $isCorrect={battleState.chat[opponentInfo.id].isCorrect}>{battleState.chat[opponentInfo.id].text}</ChatBubble>}
                                    <PetImage src={getPetImageSrc(opponentInfo, false)} alt="상대 펫" $isFainted={opponentInfo.pet.hp <= 0} />
                                </PetContainer>
                            </OpponentPetContainerWrapper>

                            <MyPetContainerWrapper>
                                <PetContainer $isHit={hitState.my} $animType={animState.my} $isMine={true}>
                                    {myInfo.pet.status?.stunned && <StunEffect />}
                                    {myInfo.pet.status?.recharging && <RechargeEffect>💤 지침...</RechargeEffect>}
                                    {myInfo.pet.status?.burned && <RechargeEffect style={{ color: '#ff6b35' }}>🔥 화상</RechargeEffect>}
                                    {myInfo.pet.status?.poisoned && <RechargeEffect style={{ color: '#9775fa', top: 'auto', bottom: '36px' }}>☠️ 중독</RechargeEffect>}
                                    {myInfo.pet.status?.defenseUp && <RechargeEffect style={{ color: '#339af0', top: 'auto', bottom: '60px' }}>🛡️ 방어↑</RechargeEffect>}
                                    {myInfo.pet.status?.blind && <RechargeEffect style={{ color: '#868e96', top: 'auto', bottom: '84px' }}>🙈 실명</RechargeEffect>}
                                    {dotEffect?.target === 'my' && (
                                        <DotDamageEffect $type={dotEffect.type} $top="15%" $left="45%">
                                            {dotEffect.type === 'burn' ? '🔥' : '☠️'}
                                        </DotDamageEffect>
                                    )}
                                    {battleState.chat?.[myInfo.id] && <ChatBubble $isMine={true} $isCorrect={battleState.chat[myInfo.id].isCorrect}>{battleState.chat[myInfo.id].text}</ChatBubble>}
                                    <PetImage src={getPetImageSrc(myInfo, true)} alt="나의 펫" $isFainted={myInfo.pet.hp <= 0} />
                                </PetContainer>
                            </MyPetContainerWrapper>
                        </BattleField>

                        <QuizArea>
                            <div>
                                <LogText>{battleState.log}</LogText>
                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <h3>Q. {battleState.question.question}</h3>
                                        {isStunned ? (
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <p style={{ color: 'red', fontWeight: 'bold', fontSize: '1.2rem' }}>😵 혼란 상태! 아무것도 할 수 없습니다.</p>
                                                <p>(상대방의 행동을 기다리는 중...)</p>
                                            </div>
                                        ) : (
                                            <>
                                                {(() => {
                                                    // OX 타입: options 유무 관계없이 버튼 표시
                                                    const isOXType = battleState.question.type === 'ox';
                                                    const isOXOptions = shuffledOptions.length === 2 &&
                                                        shuffledOptions.every(o => o === 'O' || o === 'X' || o === '○' || o === '×');
                                                    const isOX = isOXType || isOXOptions;

                                                    if (isOX) {
                                                        return (
                                                            <OXGrid>
                                                                {['O', 'X'].map(ox => (
                                                                    <OXButton
                                                                        key={ox}
                                                                        $ox={ox}
                                                                        onClick={() => handleOptionClick(ox)}
                                                                        disabled={isProcessing || hasSubmitted}
                                                                    >
                                                                        {ox === 'O' ? '⭕' : '❌'}
                                                                    </OXButton>
                                                                ))}
                                                            </OXGrid>
                                                        );
                                                    }

                                                    if (battleState.question.options && battleState.question.options.length > 0) {
                                                        return (
                                                            <OptionGrid>
                                                                {shuffledOptions.map((opt, idx) => (
                                                                    <OptionButton
                                                                        key={idx}
                                                                        onClick={() => handleOptionClick(opt)}
                                                                        disabled={isProcessing || hasSubmitted}
                                                                        style={{ opacity: hasSubmitted ? 0.5 : 1, cursor: hasSubmitted ? 'not-allowed' : 'pointer' }}
                                                                    >
                                                                        {opt}
                                                                    </OptionButton>
                                                                ))}
                                                            </OptionGrid>
                                                        );
                                                    }

                                                    // 주관식
                                                    return (
                                                        <form onSubmit={handleQuizSubmit}>
                                                            <AnswerInput
                                                                name="answer"
                                                                value={answer}
                                                                onChange={(e) => setAnswer(e.target.value)}
                                                                placeholder="정답을 입력하세요"
                                                                autoFocus
                                                                disabled={isProcessing || (hasSubmitted && battleState.chat?.[myPlayerData.id]?.isCorrect)}
                                                            />
                                                        </form>
                                                    );
                                                })()}
                                                {hasSubmitted && battleState.question.options && (
                                                    <div style={{ textAlign: 'center', marginTop: '15px', color: '#666', fontWeight: 'bold' }}>
                                                        {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                            ? "정답입니다! (처리 중...)"
                                                            : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            <ActionMenu>
                                {!isStunned && (
                                    <>
                                        {showActionMenu && (
                                            !actionSubMenu ?
                                                <>
                                                    <MenuItem onClick={() => handleActionSelect('TACKLE')}>기본 공격</MenuItem>
                                                    <MenuItem onClick={() => setActionSubMenu('skills')}>특수 공격</MenuItem>
                                                    <MenuItem
                                                        onClick={() => setActionSubMenu('items')}
                                                        style={{ backgroundColor: '#e2f0d9', borderColor: '#51cf66', color: '#2b8a3e' }}
                                                    >
                                                        🎒 간식 가방
                                                    </MenuItem>
                                                </> :
                                                actionSubMenu === 'skills' ?
                                                    <>
                                                        {myEquippedSkills.map(skill => (
                                                            // ▼ [수정완료] 스킬 렌더링 시 감면된 지식인 SP 소모 비용 표시 연동 완료
                                                            <MenuItem key={skill.id} onClick={() => handleActionSelect(skill.id)} disabled={myInfo.pet.sp < getSkillCost(skill)}>
                                                                {skill.name} ({getSkillCost(skill)}SP)
                                                            </MenuItem>
                                                        ))}
                                                        <MenuItem onClick={() => setActionSubMenu(null)}>뒤로가기</MenuItem>
                                                    </> :
                                                    actionSubMenu === 'items' ?
                                                        <>
                                                            {usableItems.length > 0 ? (
                                                                usableItems.map(([id, qty]) => (
                                                                    <MenuItem
                                                                        key={id}
                                                                        onClick={() => handleUseItem(id)}
                                                                        style={{ backgroundColor: '#fff3bf', borderColor: '#fcc419', color: '#e67700' }}
                                                                    >
                                                                        두뇌 간식 먹기 ({qty}개)
                                                                    </MenuItem>
                                                                ))
                                                            ) : (
                                                                <MenuItem disabled>쓸 수 있는 간식이 없습니다.</MenuItem>
                                                            )}
                                                            <MenuItem onClick={() => setActionSubMenu(null)}>뒤로가기</MenuItem>
                                                        </> : null
                                        )}
                                        {showDefenseMenu && (
                                            Object.entries(DEFENSE_ACTIONS).map(([key, name]) => (
                                                <MenuItem key={key} onClick={() => handleActionSelect(key)}>{name}</MenuItem>
                                            ))
                                        )}
                                    </>
                                )}
                            </ActionMenu>
                        </QuizArea>
                    </>
                )}
            </Arena>
            {battleState?.status === 'finished' && (() => {
                const isWin = battleState.winner === myPlayerData?.id;
                const isDraw = !battleState.winner;
                const myPet = myPlayerData?.pets?.find(p => p.id === myPlayerData?.partnerPetId) || myPlayerData?.pets?.[0];
                const color = isDraw ? '#6c757d' : isWin ? '#007bff' : '#dc3545';
                return (
                    <ModalBackground>
                        <ModalContent $color={color}>
                            <h2>
                                {isDraw ? '무승부' : isWin ? '🏆 승리!' : '💀 패배...'}
                            </h2>
                            <p>{battleState.log}</p>
                            {/* ▼ [추가] 전적 요약 */}
                            {myPet && (
                                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.7rem 1rem', margin: '0.5rem 0 1rem', fontSize: '0.88rem' }}>
                                    <div style={{ fontWeight: 800, marginBottom: '0.3rem', opacity: 0.85 }}>
                                        {myPet.name} 누적 전적
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                        <span>🏆 {myPet.battleWins || 0}승</span>
                                        <span>💀 {myPet.battleLosses || 0}패</span>
                                    </div>
                                </div>
                            )}
                            {/* ▲ [추가 끝] */}
                            <button onClick={() => navigate('/pet')}>확인</button>
                        </ModalContent>
                    </ModalBackground>
                );
            })()}
        </>
    );
}

export default BattlePage;