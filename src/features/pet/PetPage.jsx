// src/features/pet/PetPage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, db, createBattleChallenge, renamePetWithItem, releasePet, getScaledSkillCost } from '../../api/firebase';
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import { petImageMap } from '../../utils/petImageMap';
import { PET_DATA, SKILLS } from './petData';
import { PET_ITEMS } from './petItems';
import {
  cancelRandomBattleQueueEntry,
  createRandom1v1QueueEntry,
  createRandomTeamQueueEntry,
  enterRandom1v1Battle,
  getRandomBattleQueueDocIds,
  tryMatchRandomBattleQueue,
} from '../battle/randomBattleApi';
import {
  getAveragePetLevel,
  getRandomBattleCount,
  isPetEligibleForRandomBattle,
  sortRecommendedRandomBattlePets,
} from '../battle/randomBattleRules';
import confetti from 'canvas-confetti';
import { filterProfanity } from '../../utils/profanityFilter';

const MAX_PET_LEVEL = 30;

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shake = keyframes` 
  0% { transform: translate(1px, 1px) rotate(0deg); } 
  10% { transform: translate(-1px, -2px) rotate(-1deg); } 
  20% { transform: translate(-3px, 0px) rotate(1deg); } 
  30% { transform: translate(3px, 2px) rotate(0deg); } 
  40% { transform: translate(1px, -1px) rotate(1deg); } 
  50% { transform: translate(-1px, 2px) rotate(-1deg); } 
  60% { transform: translate(-3px, 1px) rotate(0deg); } 
  70% { transform: translate(3px, 1px) rotate(-1deg); } 
  80% { transform: translate(-1px, -1px) rotate(1deg); } 
  90% { transform: translate(1px, 2px) rotate(0deg); } 
  100% { transform: translate(1px, -2px) rotate(-1deg); } 
`;

const glowGather = keyframes`
  0% { box-shadow: 0 0 20px rgba(253, 224, 71, 0.2); transform: scale(1); }
  50% { box-shadow: 0 0 60px rgba(253, 224, 71, 0.8); transform: scale(1.05); filter: brightness(1.3); }
  100% { box-shadow: 0 0 100px rgba(253, 224, 71, 1); transform: scale(1.1); filter: brightness(2); }
`;

// 진화의 돌이 회전하면서 펫에게 흡수되는 이펙트 애니메이션
const stoneAbsorb = keyframes`
  0% { transform: translate(-50%, -150px) scale(1) rotate(0deg); opacity: 1; filter: drop-shadow(0 0 10px #fcc419); }
  50% { transform: translate(-50%, -80px) scale(1.2) rotate(180deg); opacity: 1; filter: drop-shadow(0 0 25px #fab005); }
  100% { transform: translate(-50%, -20px) scale(0) rotate(360deg); opacity: 0; filter: drop-shadow(0 0 5px #fff); }
`;

// --- Web Audio API 기반 진화 전용 효과음 기능 ---
const playEvolutionSound = (phase) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if (phase === 'absorb') {
      // 진화의 돌 흡수음 (뾰로로롱 소리)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.8);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } else if (phase === 'charge') {
      // 진화 에너지 모으는 소리 (위잉 올라가는 소리)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 1.5);
      gainNode.gain.setValueAtTime(0.01, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    } else if (phase === 'burst') {
      // 진화 쾅! 터지는 소리
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.log('Audio API Error');
  }
};

// --- Styled Components ---

const PageWrapper = styled.div`
  max-width: 1060px;
  margin: 0 auto;
  padding: 0.8rem 0.65rem 3.5rem;
  font-family: 'Pretendard', sans-serif;
  animation: ${fadeIn} 0.5s ease-out;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  color: #1f2937;

  @media (max-width: 1080px) {
    max-width: 970px;
    padding: 0.55rem 0.5rem 3.5rem;
  }
`;

const MainLayout = styled.div`
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
  justify-content: center;

  @media (min-width: 901px) and (max-width: 1080px) {
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 0.7rem;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const PetDashboard = styled.div`
  grid-column: 2;
  grid-row: 1;
  display: grid;
  grid-template-columns: 235px minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
  min-height: clamp(500px, calc(100dvh - 130px), 640px);
  max-height: clamp(500px, calc(100dvh - 130px), 640px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: 0.72rem;
  border: 4px solid #2f6fdb;
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(47,111,219,0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,111,219,0.07) 1px, transparent 1px),
    #ffffff;
  background-size: 24px 24px;
  box-shadow: 0 14px 36px rgba(0,0,0,0.10);

  &::-webkit-scrollbar { width: 11px; }
  &::-webkit-scrollbar-track { background: #dbe4ff; border-left: 2px solid #2f6fdb; }
  &::-webkit-scrollbar-thumb { background: #748ffc; border: 2px solid #2f6fdb; border-radius: 999px; }

  @media (min-width: 901px) and (max-width: 1080px) {
    grid-template-columns: 215px minmax(0, 1fr);
    gap: 0.62rem;
    padding: 0.62rem;
  }

  @media (max-width: 900px) {
    grid-column: 1;
    grid-row: 2;
    grid-template-columns: 1fr;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }
`;

const PetListPanel = styled.div`
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: clamp(500px, calc(100dvh - 130px), 640px);
  overflow: hidden;
  padding: 0;
  border: 4px solid #2f6fdb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 14px 36px rgba(0,0,0,0.10);

  &::before {
    content: 'PET';
    grid-column: 1;
    grid-row: 1 / span 3;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    background: linear-gradient(180deg, #ff4d5e 0%, #e03131 100%);
    color: white;
    border-right: 4px solid #143d8f;
    font-size: 0.68rem;
    font-weight: 1000;
    letter-spacing: 0.08em;
  }

  h4 {
    grid-column: 2;
    margin: 0;
    padding: 0.5rem 0.62rem;
    font-size: 0.88rem;
    color: #343a40;
    font-weight: 1000;
    background: #f1f3f5;
    border-bottom: 3px solid #2f6fdb;
  }

  > div:last-child {
    grid-column: 2;
    padding: 0.55rem;
    border-top: 3px solid #2f6fdb;
    background: #edf2ff;
  }

  @media (max-width: 900px) {
    grid-column: 1;
    grid-row: 1;
    height: auto;
    min-height: 0;
  }
`;

const PetListWrapper = styled.div`
  grid-column: 2;
  min-height: 0;
  overflow-y: auto;
  padding: 0.55rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 0.38rem;
  align-content: start;
  background:
    linear-gradient(90deg, rgba(47,111,219,0.10) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47,111,219,0.08) 1px, transparent 1px),
    #ffffff;
  background-size: 24px 24px;

  &::-webkit-scrollbar { width: 10px; }
  &::-webkit-scrollbar-track { background: #dbe4ff; border-left: 2px solid #2f6fdb; }
  &::-webkit-scrollbar-thumb { background: #748ffc; border: 2px solid #2f6fdb; border-radius: 999px; }

  @media (max-width: 900px) {
    max-height: 260px;
    grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  }
`;

const PetListItem = styled.div`
  position: relative;
  min-height: 82px;
  padding: 0.3rem;
  border-radius: 10px;
  cursor: pointer;
  border: ${props => props.$isSelected ? "4px solid #ff6b6b" : "2px solid #ced4da"};
  background-color: ${props => props.$isSelected ? "#fff5f5" : "#f1f3f5"};
  margin-bottom: 0;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px rgba(0,0,0,0.10);
  }

  img {
    width: 48px;
    height: 48px;
    border-radius: 0;
    object-fit: contain;
    border: none;
    box-shadow: none;
    filter: drop-shadow(0 7px 9px rgba(0,0,0,0.14));
  }

  strong {
    max-width: 68px;
    margin-top: 0.08rem;
    font-size: 0.6rem;
    font-weight: 1000;
    color: #343a40;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  p {
    margin: 0.08rem 0 0;
    font-size: 0.54rem;
    color: #495057;
    font-weight: 1000;
  }
`;

const PetProfile = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 0;
  padding: 0.7rem;
  border-radius: 16px;
  background: rgba(255,255,255,0.92);
  border: 1px solid #e9ecef;
  box-shadow: 0 8px 22px rgba(0,0,0,0.06);
  box-sizing: border-box;

  @media (max-width: 900px) {
    max-width: 420px;
    margin: 0 auto;
  }
`;

const PetImage = styled.img`
  width: 154px;
  height: 154px;
  border-radius: 16px;
  object-fit: contain;
  background: radial-gradient(circle, #fff 20%, #f1f3f5 72%);
  margin-bottom: 0.62rem;
  border: 2px solid #dee2e6;
  box-shadow: inset 0 0 0 6px white, 0 10px 22px rgba(0,0,0,0.10);
  filter: ${props => props.$isFainted ? "grayscale(100%)" : "drop-shadow(0 10px 14px rgba(0,0,0,0.16))"};
  transition: transform 0.3s;

  &:hover { transform: scale(1.04); }

  @media (min-width: 901px) and (max-width: 1080px) {
    width: 138px;
    height: 138px;
  }
`;

const PetNameContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 36px;
  margin-bottom: 0.22rem;
`;

const PetName = styled.h1`
  margin: 0;
  font-size: 1.18rem;
  font-weight: 1000;
  color: #1f2937;
`;

const PetNameInput = styled.input`
  font-size: 1.12rem;
  font-weight: 1000;
  border: none;
  border-bottom: 2px solid #748ffc;
  background: transparent;
  text-align: center;
  width: 150px;
  color: #343a40;
  &:focus { outline: none; border-bottom-color: #339af0; }
`;

const PetLevel = styled.h3`
  margin: 0;
  font-size: 0.78rem;
  font-weight: 1000;
  color: #1971c2;
  background: #e7f5ff;
  padding: 0.24rem 0.68rem;
  border-radius: 999px;
`;

const PetInfo = styled.div`
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.65rem;
  border-radius: 16px;
  background: rgba(255,255,255,0.92);
  border: 1px solid #e9ecef;
  box-shadow: 0 8px 22px rgba(0,0,0,0.06);
  box-sizing: border-box;
`;

const StatBarContainer = styled.div`
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 14px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
`;

const StatBar = styled.div`
  width: ${props => props.$percent}%; height: 100%;
  background: ${props => props.$barColor}; border-radius: 14px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
`;

const StatText = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #1f2937;
  font-weight: 1000;
  font-size: 0.74rem;
  text-shadow: 0 0 4px rgba(255,255,255,0.9);
  white-space: nowrap;
  z-index: 2;
`;

const InfoCard = styled.div`
  padding: 0.68rem;
  background-color: #f8f9fa;
  border-radius: 13px;
  border: 1px solid #e9ecef;

  h4 { margin: 0 0 0.42rem 0; font-size: 0.84rem; font-weight: 1000; color: #343a40; }
  p { margin: 0; font-size: 0.78rem; color: #495057; line-height: 1.4; font-weight: 750; }
`;

const InventoryItem = styled.p`
  display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem;
  font-weight: 600; font-size: 0.9rem;
  img { width: 24px; height: 24px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); }
`;

const ActionButtonGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.48rem;
  margin-top: 0.25rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const StyledButton = styled.button`
  padding: 0.58rem;
  font-size: 0.82rem;
  font-weight: 1000;
  border: none;
  border-radius: 11px;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  box-shadow: 0 3px 0 rgba(0,0,0,0.12);

  &:active { transform: translateY(2px); box-shadow: none; }
  &:disabled { background-color: #adb5bd; cursor: not-allowed; box-shadow: none; transform: none; }
`;

const EvolveButton = styled(StyledButton)` background-color: #fcc419; color: #343a40; width: 100%; &:hover:not(:disabled) { background-color: #fab005; } `;
const FeedButton = styled(StyledButton)` background-color: #ff6b6b; &:hover:not(:disabled) { background-color: #fa5252; } `;
const PetCenterButton = styled(StyledButton)` background-color: #22b8cf; grid-column: 1 / -1; &:hover:not(:disabled) { background-color: #15aabf; } `;
const BattleRequestButton = styled(StyledButton)` background-color: #fa5252; grid-column: 1 / -1; box-shadow: 0 4px 0 #c92a2a; &:hover:not(:disabled) { background-color: #e03131; } `;

// RANDOM_BATTLE_PETPAGE_ENTRY_PATCH
const BattleEntryPanel = styled.div`
  /* RANDOM_BATTLE_ENTRY_SIMPLIFIED_PATCH */
  grid-column: 1 / -1;
`;

const BattleEntryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.46rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const RandomBattleEntryButton = styled(StyledButton)`
  min-height: 54px;
  padding: 0.62rem 0.45rem;
  background: ${props => props.$variant === "team" ? "linear-gradient(135deg, #845ef7, #5f3dc4)" : "linear-gradient(135deg, #fa5252, #e03131)"};
  box-shadow: ${props => props.$variant === "team" ? "0 4px 0 #4527a0" : "0 4px 0 #c92a2a"};
  line-height: 1.25;

  .main {
    display: block;
    font-size: 0.82rem;
    font-weight: 1000;
  }

  .sub {
    display: block;
    margin-top: 0.12rem;
    font-size: 0.62rem;
    font-weight: 850;
    opacity: 0.88;
  }

  &:hover:not(:disabled) {
    filter: brightness(0.96);
  }
`;

const RandomQueueNotice = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.52rem;
  padding: 0.55rem 0.62rem;
  border-radius: 12px;
  background: #fff3bf;
  border: 1px solid #ffd43b;
  color: #7c4a03;
  font-size: 0.72rem;
  font-weight: 950;
  text-align: left;

  button {
    border: none;
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: #f08c00;
    color: white;
    font-weight: 1000;
    cursor: pointer;
    box-shadow: 0 2px 0 #c46a00;
  }

  button:disabled {
    background: #adb5bd;
    box-shadow: none;
    cursor: not-allowed;
  }
`;


const OpponentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-height: 500px;
  overflow-y: auto;
  padding: 5px 10px;
  
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 3px; }
`;

const OpponentItem = styled.div`
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  background-color: #fff; 
  padding: 0.8rem 1.2rem; 
  border-radius: 16px; 
  border: 1px solid #f1f3f5;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
  transition: all 0.2s;
  
  &:hover { 
    transform: translateY(-2px); 
    box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
    border-color: #ff8787; 
  }

  .left-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    
    img { 
      width: 50px; height: 50px; 
      border-radius: 50%; 
      border: 2px solid #f8f9fa; 
      object-fit: cover; 
      background-color: #fff; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    
    .info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      
      strong { font-size: 1rem; font-weight: 800; color: #343a40; margin-bottom: 2px; }
      span { font-size: 0.85rem; font-weight: 600; color: #868e96; }
    }
  }
`;

const ChallengeButton = styled.button`
  background-color: #ff6b6b; color: white; border: none; padding: 0.5rem 1rem;
  border-radius: 8px; font-weight: 800; cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 0 #fa5252;
  font-size: 0.9rem;
  
  &:hover { background-color: #fa5252; transform: translateY(-1px); }
  &:active { transform: translateY(1px); box-shadow: none; }
`;

const ModalBackground = styled.div`
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7); display: flex;
  justify-content: center; align-items: center; z-index: 3000;
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  text-align: center; position: relative; color: white; min-width: 350px;
  
  &.white-modal {
    background-color: #fff; color: #333; padding: 2rem; border-radius: 24px;
    max-width: 500px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  h3 { margin-top: 0; font-weight: 800; color: #343a40; }
  img.egg { animation: ${props => props.$isShaking ? shake : 'none'} 0.5s infinite; filter: drop-shadow(0 0 20px rgba(255,255,255,0.5)); }
  img.pet { max-width: 250px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3)); }
  
  /* 진화 이펙트 애니메이션 프레임 설정 */
  img.evo-charge {
    max-width: 220px;
    border-radius: 50%;
    animation: ${shake} 0.5s infinite, ${glowGather} 1.5s forwards;
    animation-delay: 0.8s, 0.8s; /* 진화의 돌이 흡수된 후부터 작동 시작 */
  }

  /* 흡수되는 진화의 돌 이미지 컴포넌트 */
  img.evo-stone-asset {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 60px;
    height: 60px;
    z-index: 10;
    animation: ${stoneAbsorb} 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
`;

const AccordionContainer = styled.div`
  width: 100%;
  margin-top: 0.65rem;
`;

const AccordionButtonRow = styled.div`
  display: flex;
  gap: 0.45rem;
  margin-bottom: 0.3rem;
`;

const AccordionButton = styled(StyledButton)`
  background-color: ${props => props.$isActive ? "#1864ab" : "#339af0"};
  flex: 1;
  padding: 0.54rem;
  font-size: 0.78rem;
  box-shadow: none;
  &:hover { background-color: #1c7ed6; }
`;

const AccordionContent = styled.div`
  background-color: #f8f9fa;
  border-radius: 12px;
  padding: 0.68rem;
  border: 1px solid #e9ecef;
  animation: ${fadeIn} 0.3s ease-out;
`;

const SkillMiniGuide = styled.div`
  padding: 0.42rem 0.52rem;
  margin-bottom: 0.48rem;
  border-radius: 10px;
  background: #edf2ff;
  color: #364fc7;
  font-size: 0.68rem;
  font-weight: 850;
  line-height: 1.3;
  text-align: left;
`;

const SkillSectionLabel = styled.h5`
  margin: 0.45rem 0 0.35rem;
  color: #343a40;
  font-size: 0.74rem;
  font-weight: 1000;
  text-align: left;
`;
const SkillGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.42rem;
`;

const SkillSlot = styled.div`
  min-height: 76px;
  border: 2px dashed ${props => props.$isSelected ? "#fa5252" : props.$isEquipped ? "#74c0fc" : "#dee2e6"};
  border-radius: 12px;
  padding: 0.48rem;
  background-color: ${props => props.$isSelected ? "#fff5f5" : props.$isSignature ? "#fff9db" : props.$isEquipped ? "#e7f5ff" : "#fff"};
  cursor: ${props => props.$isSignature ? "not-allowed" : "pointer"};
  transition: all 0.15s;
  position: relative;
  overflow: visible;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.12rem;

  &:hover {
    border-color: ${props => props.$isSignature ? "#ffe066" : "#339af0"};
    transform: ${props => props.$isSignature ? "none" : "translateY(-2px)"};
    box-shadow: ${props => props.$isSignature ? "none" : "0 7px 15px rgba(0,0,0,0.09)"};
  }

  .skill-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.28rem;
    min-width: 0;
  }

  p {
    min-width: 0;
    font-weight: 1000;
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.18;
    color: #343a40;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-title {
    color: #adb5bd;
    text-align: center;
    margin-top: 0.35rem;
  }

  small {
    font-size: 0.66rem;
    color: #868e96;
    font-weight: 900;
  }

  .skill-desc {
    color: #667085;
    font-size: 0.66rem;
    font-weight: 750;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .mini-badge {
    flex: 0 0 auto;
    padding: 0.08rem 0.32rem;
    border-radius: 999px;
    background: #f1f3f5;
    color: #495057;
    font-size: 0.56rem;
    font-weight: 1000;
  }

  .mini-badge.signature {
    background: #fff3bf;
    color: #e67700;
  }

  .skill-status {
    margin-top: auto;
    align-self: flex-end;
    color: #1971c2;
    font-size: 0.62rem;
    font-weight: 1000;
  }

  .skill-status.equipped {
    color: #868e96;
  }

  /* M25C_PET_SKILL_TOOLTIP */
  &[data-skill-tooltip] {
    isolation: isolate;
  }

  &[data-skill-tooltip]:hover,
  &[data-skill-tooltip]:focus-visible {
    z-index: 40;
  }

  &[data-skill-tooltip]:hover::after,
  &[data-skill-tooltip]:focus-visible::after {
    content: attr(data-skill-tooltip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    transform: translateX(-50%);
    width: min(300px, 78vw);
    max-width: 300px;
    padding: 0.58rem 0.66rem;
    border-radius: 12px;
    background: rgba(17, 24, 39, 0.97);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1.42;
    white-space: pre-wrap;
    text-align: left;
    box-shadow: 0 14px 34px rgba(0,0,0,0.24);
    border: 1px solid rgba(255,255,255,0.12);
    pointer-events: none;
  }

  &[data-skill-tooltip]:hover::before,
  &[data-skill-tooltip]:focus-visible::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: calc(100% + 3px);
    transform: translateX(-50%);
    border: 7px solid transparent;
    border-top-color: rgba(17, 24, 39, 0.97);
    pointer-events: none;
  }

  /* M25C_FIXED_SKILL_TOOLTIP_V2 */
  /* 기존 카드 내부 pseudo 툴팁은 부모 overflow에 잘리므로 fixed 레이어로 대체합니다. */
  &[data-skill-tooltip]:hover::after,
  &[data-skill-tooltip]:focus-visible::after,
  &[data-skill-tooltip]:hover::before,
  &[data-skill-tooltip]:focus-visible::before {
    display: none !important;
    content: none !important;
  }
`;

const SkillTooltipPortal = styled.div`
  /* M25C_FIXED_SKILL_TOOLTIP_V2 */
  position: fixed;
  z-index: 999999;
  width: min(340px, calc(100vw - 24px));
  max-height: min(260px, calc(100vh - 28px));
  overflow-y: auto;
  padding: 0.68rem 0.78rem;
  border-radius: 14px;
  background: rgba(17, 24, 39, 0.98);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1.45;
  white-space: pre-wrap;
  text-align: left;
  box-shadow: 0 18px 44px rgba(0,0,0,0.30);
  border: 1px solid rgba(255,255,255,0.14);
  pointer-events: none;
  word-break: keep-all;
`;

const SkillList = styled.div`
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #dee2e6;
  h5 { margin: 0 0 0.4rem 0; color: #495057; font-weight: 800; }
`;

const SkillManagePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.52rem;
`;

const SkillHelpText = styled.div`
  padding: 0.48rem 0.58rem;
  border-radius: 10px;
  background: #edf2ff;
  color: #364fc7;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1.35;
  text-align: left;
`;

const PendingNotice = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.48rem 0.58rem;
  border-radius: 10px;
  background: #fff3bf;
  color: #7c4a03;
  border: 1px solid #ffe066;
  font-size: 0.72rem;
  font-weight: 950;
  text-align: left;
`;

const SkillSectionTitle = styled.h5`
  margin: 0.15rem 0 0;
  color: #343a40;
  font-size: 0.78rem;
  font-weight: 1000;
  text-align: left;
`;

const EquippedSkillGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 0.42rem;
`;

const EquippedSkillSlot = styled.button`
  min-height: 74px;
  padding: 0.48rem;
  border-radius: 12px;
  border: ${props => props.$isSelected ? "3px solid #ff6b6b" : props.$isSignature ? "2px dashed #ffe066" : "2px dashed #ced4da"};
  background: ${props => props.$isSelected ? "#fff5f5" : props.$isSignature ? "#fff9db" : "#ffffff"};
  cursor: ${props => props.$isSignature ? "not-allowed" : "pointer"};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.16rem;
  text-align: center;
  transition: all 0.12s ease;

  &:hover {
    transform: ${props => props.$isSignature ? "none" : "translateY(-2px)"};
    box-shadow: ${props => props.$isSignature ? "none" : "0 7px 15px rgba(0,0,0,0.10)"};
    border-color: ${props => props.$isSignature ? "#ffe066" : "#339af0"};
  }

  .slot-label {
    font-size: 0.58rem;
    font-weight: 1000;
    color: #868e96;
  }

  .slot-name {
    font-size: 0.76rem;
    font-weight: 1000;
    color: #343a40;
    line-height: 1.18;
  }

  .slot-meta {
    font-size: 0.62rem;
    font-weight: 900;
    color: #667085;
  }

  .slot-empty {
    font-size: 0.78rem;
    font-weight: 1000;
    color: #adb5bd;
  }
`;

const SkillListCompact = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.36rem;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 0.12rem;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #e9ecef; border-radius: 999px; }
  &::-webkit-scrollbar-thumb { background: #adb5bd; border-radius: 999px; }
`;

const SkillListRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.48rem 0.52rem;
  border-radius: 12px;
  border: 1px solid ${props => props.$isPending ? "#ffd43b" : props.$isEquipped ? "#74c0fc" : "#e9ecef"};
  background: ${props => props.$isPending ? "#fff9db" : props.$isEquipped ? "#e7f5ff" : "#ffffff"};
  text-align: left;

  .skill-row-main {
    min-width: 0;
  }

  .skill-row-head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .skill-row-name {
    min-width: 0;
    color: #343a40;
    font-size: 0.82rem;
    font-weight: 1000;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .skill-row-badge {
    flex: 0 0 auto;
    padding: 0.12rem 0.34rem;
    border-radius: 999px;
    background: #f1f3f5;
    color: #495057;
    font-size: 0.6rem;
    font-weight: 1000;
  }

  .skill-row-desc {
    margin-top: 0.14rem;
    color: #667085;
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const SkillActionButton = styled.button`
  min-width: 72px;
  padding: 0.42rem 0.48rem;
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.68rem;
  font-weight: 1000;
  cursor: pointer;
  background: ${props => props.$variant === "muted" ? "#adb5bd" : props.$variant === "warning" ? "#f08c00" : "#339af0"};
  box-shadow: 0 3px 0 rgba(0,0,0,0.12);

  &:disabled {
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const SkillManageFooter = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.42rem;
  align-items: center;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const NotebookButton = styled(StyledButton)`
  background-color: #845ef7;
  width: 100%;
  margin: 0 0 0.48rem;
  padding: 0.5rem;
  font-size: 0.76rem;
  &:hover:not(:disabled) { background-color: #7048e8; }
`;

const StatGrid = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 1rem; text-align: left;
`;

const StatItem = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  p:first-child { color: #868e96; margin: 0; font-weight: 600; }
  p:last-child { font-weight: 800; font-size: 1.2rem; margin: 0; color: #343a40; }
`;

const ExchangeContainer = styled.div`
  display: flex; gap: 0.5rem; grid-column: 1 / -1; margin-top: 0.5rem;
`;

const ExchangeInput = styled.input`
  width: 100%; padding: 0.8rem; border: 2px solid #e9ecef;
  border-radius: 12px; text-align: center; font-size: 1rem; font-weight: 700;
  &:focus { outline: none; border-color: #339af0; }
`;

const TooltipWrapper = styled.div`
  position: relative; display: block; width: 100%;
  &:hover::after {
    content: attr(data-tooltip); position: absolute; bottom: 105%; left: 50%;
    transform: translateX(-50%); background-color: rgba(0, 0, 0, 0.8); color: white;
    padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 100; font-weight: 600;
    display: ${props => props['data-tooltip'] ? 'block' : 'none'};
  }
  &:hover::after { opacity: 1; }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.7rem;
  margin-top: 1.1rem;
`;

const ActionButton = styled.button`
  padding: 0.72rem 1.8rem;
  font-size: 0.92rem;
  font-weight: 900;
  color: ${props => props.$primary ? "white" : "#495057"};
  background: ${props => props.$primary ? "#339af0" : "#f1f3f5"};
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); filter: brightness(0.95); }
`;

function PetPage() {
  const navigate = useNavigate();
  const { players, usePetItem, evolvePet, hatchPetEgg, setPartnerPet, updatePetName, convertLikesToExp, updatePetSkills, updatePlayerProfile } = useLeagueStore();
  const { classId } = useClassStore();

  const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
  const isAdmin = myPlayerData?.role === 'admin';

  const [selectedPetId, setSelectedPetId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isHatching, setIsHatching] = useState(false);
  const [hatchState, setHatchState] = useState({ step: 'start', hatchedPet: null });
  const [exchangeAmount, setExchangeAmount] = useState(1);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [equippedSkills, setEquippedSkills] = useState([]);
  const [selectedSkillSlot, setSelectedSkillSlot] = useState(null);
    const [skillTooltip, setSkillTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
const [pendingSkillId, setPendingSkillId] = useState(null);
  const [isOpponentModalOpen, setIsOpponentModalOpen] = useState(false);
  // DUAL_QUEUE_RANDOM_BATTLE_PATCH
  const [randomBattleQueueEntries, setRandomBattleQueueEntries] = useState({});
  const [isRandomBattleCancelling, setIsRandomBattleCancelling] = useState(false);
  const [isRandomBattleEntering, setIsRandomBattleEntering] = useState(false);
  // ENTER_RANDOM_1V1_FIX_PATCH
  const randomBattleAutoEnterRef = useRef(null);
  const [randomBattleDraft, setRandomBattleDraft] = useState({
    show: false,
    mode: null,
    selectedPetIds: [],
    selectedTeamPetId: null,
    isSubmitting: false,
  });
  
  const [battleTeamDraft, setBattleTeamDraft] = useState({
    // M11_ENABLE_3V3_TEAM_SELECTION_PATCH
    show: false,
    opponent: null,
    leadPetId: null,
    benchPetId: null,
    thirdPetId: null,
  });
  const [vitaminJellyPopup, setVitaminJellyPopup] = useState({ show: false, pendingOpponent: null, pendingBattleOptions: null });

  // 진화 애니메이션 관련 모달 상태 관리
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolveState, setEvolveState] = useState({ step: 'start', targetPet: null, nextFormName: '' });

  useEffect(() => {
    if (!myPlayerData?.id || !classId) return;
    const unsubscribe = onSnapshot(doc(db, 'classes', classId, 'players', myPlayerData.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPlayer = { id: docSnap.id, ...docSnap.data() };
        useLeagueStore.setState((state) => ({
          players: state.players.map((p) => p.id === updatedPlayer.id ? updatedPlayer : p)
        }));
      }
    });
    return () => unsubscribe();
  }, [myPlayerData?.id, classId]);


  // RANDOM_BATTLE_PETPAGE_ENTRY_PATCH
  // DUAL_QUEUE_RANDOM_BATTLE_PATCH
  useEffect(() => {
    if (!myPlayerData?.id || !classId) {
      setRandomBattleQueueEntries({});
      return;
    }

    const queueDocIds = getRandomBattleQueueDocIds(myPlayerData.id);
    const subscriptions = [
      ['random-1v1', queueDocIds['random-1v1']],
      ['random-team', queueDocIds['random-team']],
      ['legacy', queueDocIds.legacy],
    ].map(([key, queueDocId]) => onSnapshot(doc(db, 'classes', classId, 'randomBattleQueue', queueDocId), (docSnap) => {
      setRandomBattleQueueEntries(prev => {
        const next = { ...prev };

        if (!docSnap.exists()) {
          delete next[key];
          return next;
        }

        const entry = { id: docSnap.id, queueKey: key, ...docSnap.data() };
        if (['waiting', 'matched', 'entering'].includes(entry.status)) {
          next[key] = entry;
        } else {
          delete next[key];
        }

        return next;
      });
    }));

    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [myPlayerData?.id, classId]);


  // WAITING_AUTO_RETRY_RANDOM_BATTLE_PATCH
  useEffect(() => {
    if (!classId || !myPlayerData?.id) return;

    const waitingModes = [
      randomBattleQueueEntries['random-1v1']?.status === 'waiting' ? 'random-1v1' : null,
      randomBattleQueueEntries['random-team']?.status === 'waiting' ? 'random-team' : null,
    ].filter(Boolean);

    if (waitingModes.length === 0) return;

    let cancelled = false;
    let isTrying = false;

    const tryWaitingMatches = async () => {
      if (cancelled || isTrying) return;
      isTrying = true;

      try {
        for (const mode of waitingModes) {
          if (cancelled) break;
          await tryMatchRandomBattleQueue(classId, myPlayerData.id, mode);
        }
      } catch (error) {
        // 대기 중 자동 재시도는 학생에게 매번 alert를 띄우지 않습니다.
        // 큐가 이미 취소/매칭된 경우도 있을 수 있으므로 콘솔 경고만 남깁니다.
        console.warn('랜덤대전 자동 매칭 재시도 실패:', error);
      } finally {
        isTrying = false;
      }
    };

    tryWaitingMatches();
    const intervalId = window.setInterval(tryWaitingMatches, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    classId,
    myPlayerData?.id,
    randomBattleQueueEntries['random-1v1']?.status,
    randomBattleQueueEntries['random-team']?.status,
  ]);

  useEffect(() => {
    if (myPlayerData && !myPlayerData.pet && (!myPlayerData.pets || myPlayerData.pets.length === 0)) {
      navigate('/pet/select');
      return;
    }
    if (myPlayerData && myPlayerData.pets && myPlayerData.pets.length > 0) {
      const hasSelectedPet = myPlayerData.pets.some(p => p.id === selectedPetId);
      if (!hasSelectedPet) {
        setSelectedPetId(myPlayerData.partnerPetId || myPlayerData.pets[0].id);
      }
    }
  }, [myPlayerData, selectedPetId, navigate]);

  const selectedPet = myPlayerData?.pets?.find(p => p.id === selectedPetId);

  useEffect(() => {
    if (selectedPet) {
      setNewName(selectedPet.name);
      setEquippedSkills(selectedPet.equippedSkills || PET_DATA[selectedPet.species].initialSkills);
      setSelectedSkillSlot(null);
    }
  }, [selectedPet]);

  const opponents = useMemo(() => {
    if (!players || !auth.currentUser) return [];
    return players.filter(p => p.authUid !== auth.currentUser.uid && p.pets && p.pets.length > 0);
  }, [players]);

  const handleSaveName = async () => {
    const filteredName = filterProfanity(newName);
    if (filteredName.includes('*')) return alert("부적절한 단어가 포함되어 있어 사용할 수 없습니다.");
    if (!filteredName.trim()) return alert("이름을 입력해주세요.");
    const renameCount = myPlayerData?.petInventory?.pet_rename || 0;
    if (renameCount <= 0) {
      setIsEditingName(false);
      return alert("이름 변경권이 없습니다. 펫센터 상점에서 구매하세요!");
    }
    try {
      await renamePetWithItem(classId, myPlayerData.id, selectedPet.id, filteredName);
      setIsEditingName(false);
      setNewName(filteredName);
      const remaining = renameCount - 1;
      alert(`이름이 '${filteredName}'(으)로 변경되었습니다!\n(남은 이름 변경권: ${remaining}개)`);
    } catch (error) { alert("이름 저장 중 오류가 발생했습니다: " + error.message); }
  };

  const handleEditNameClick = () => {
    const renameCount = myPlayerData?.petInventory?.pet_rename || 0;
    if (renameCount <= 0) {
      if (window.confirm('이름 변경권이 없습니다.\n펫센터 상점에서 1,000P에 구매할 수 있습니다.\n펫센터로 이동하시겠습니까?')) {
        navigate('/pet-center');
      }
      return;
    }
    setIsEditingName(true);
  };

  const handleUseItem = async (itemId) => {
    try {
      await usePetItem(itemId, selectedPet.id);
      if (itemId === 'secret_notebook') alert("펫이 새로운 스킬을 배웠습니다! 스킬 관리에서 확인해보세요.");
    } catch (error) { alert(error.message); }
  };

  const handleEvolve = async () => {
    const evolutionStone = myPlayerData?.petInventory?.evolution_stone || 0;
    if (!canEvolve(evolutionStone)) return;

    const nextFormName = currentStage === 1
      ? PET_DATA[selectedPet.species].evolution.lv10.name
      : PET_DATA[selectedPet.species].evolution.lv20.name;

    try {
      setIsEvolving(true);
      setEvolveState({ step: 'charging', targetPet: selectedPet, nextFormName });

      // 1단계: 진화의 돌 날아와서 흡수되는 소리
      playEvolutionSound('absorb');

      // 2단계: 흡수가 끝난 0.8초 후부터 기 모으기 연출 및 사운드 시작
      setTimeout(() => {
        playEvolutionSound('charge');
      }, 800);

      // 3단계: 기 모으기가 모두 끝난 2.3초(0.8s + 1.5s) 후 파이어베이스 진화 처리 및 펑!
      setTimeout(async () => {
        await evolvePet(selectedPet.id, 'evolution_stone');
        playEvolutionSound('burst');
        setEvolveState(prev => ({ ...prev, step: 'burst' }));
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.55 } });
      }, 2300);

    } catch (error) {
      alert(error.message);
      setIsEvolving(false);
    }
  };

  const handleHatch = async () => {
    try {
      setIsHatching(true);
      setHatchState({ step: 'shaking', hatchedPet: null });
      setTimeout(async () => {
        const { hatchedPet } = await hatchPetEgg();
        setHatchState({ step: 'cracked', hatchedPet });
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
      }, 2000);
    } catch (error) {
      alert(error.message);
      setIsHatching(false);
    }
  };

  const handleHeartExchange = async () => {
    const amount = Number(exchangeAmount);
    if (!amount || amount <= 0) return alert("교환할 하트 수량을 올바르게 입력해주세요.");
    if (myPlayerData.totalLikes < amount) return alert("보유한 하트가 부족합니다.");
    if (!selectedPet) return alert("경험치를 받을 펫을 선택해주세요.");
    try {
      const { expGained } = await convertLikesToExp(amount, selectedPet.id);
      alert(`하트 ${amount}개를 경험치 ${expGained}로 교환했습니다!`);
      setExchangeAmount(1);
    } catch (error) { alert(error.message); }
  }

  const canEvolve = (evolutionStoneCount) => {
    if (!selectedPet) return false;
    const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    const evolutionLevel = currentStage === 1 ? 10 : 20;
    return (
      PET_DATA[selectedPet.species]?.evolution &&
      currentStage < 3 &&
      selectedPet.level >= evolutionLevel &&
      evolutionStoneCount > 0
    );
  };

  const getEvolutionConditionText = (evolutionStoneCount) => {
    if (!selectedPet) return "";
    const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    if (currentStage >= 3) return "최종 진화 상태입니다.";
    const requiredLevel = currentStage === 1 ? 10 : 20;
    const conditions = [];
    if (selectedPet.level < requiredLevel) conditions.push(`Lv.${requiredLevel} 달성`);
    if (evolutionStoneCount <= 0) conditions.push("진화석 필요");
    if (conditions.length === 0) return "";
    return `[조건] ${conditions.join(" 및 ")}`;
  };

  const handleSkillSlotClick = (index) => {
    const signatureSkillIdForSlot = PET_DATA[selectedPet.species].skill.id;
    if (equippedSkills[index] === signatureSkillIdForSlot) return alert("고유 스킬은 교체할 수 없습니다.");
    setSelectedSkillSlot(prev => prev === index ? null : index);
  };

  const handleLearnedSkillClick = (skillId) => {
    if ((equippedSkills || []).includes(skillId)) return;

    if (selectedSkillSlot !== null) {
      const signatureSkillIdForSlot = PET_DATA[selectedPet.species].skill.id;
      if (equippedSkills[selectedSkillSlot] === signatureSkillIdForSlot) {
        setSelectedSkillSlot(null);
        return alert("고유 스킬은 교체할 수 없습니다.");
      }

      const newEquippedSkills = [...(equippedSkills || [])];
      newEquippedSkills[selectedSkillSlot] = skillId;
      setEquippedSkills(newEquippedSkills);
      setSelectedSkillSlot(null);
      return;
    }

    const firstEmptySlot = Array.from({ length: skillSlotsCount }).findIndex((_, index) => !equippedSkills[index]);
    if (firstEmptySlot >= 0) {
      const newEquippedSkills = [...(equippedSkills || [])];
      newEquippedSkills[firstEmptySlot] = skillId;
      setEquippedSkills(newEquippedSkills);
      return;
    }

    alert("교체할 장착 슬롯을 먼저 선택해주세요.");
  };

  const handleSaveSkills = async () => {
    try {
      await updatePetSkills(selectedPet.id, equippedSkills);
      alert("스킬 장착이 완료되었습니다.");
      setActiveAccordion(null);
    } catch (error) { alert(`스킬 저장 실패: ${error.message}`); }
  };

  const handleOpenOpponentModal = () => {
    if (selectedPet.hp <= 0) return alert("기절한 펫은 대전을 신청할 수 없습니다. 먼저 치료해주세요!");
    setIsOpponentModalOpen(true);
  };

  const getAliveBattlePets = () => {
    return (myPlayerData?.pets || []).filter(pet => Number(pet?.hp ?? 0) > 0);
  };


  // RANDOM_BATTLE_PETPAGE_ENTRY_PATCH
  const isActiveRandomBattleQueue = (entry) => ['waiting', 'matched', 'entering'].includes(entry?.status);

  const getRandomBattleEligiblePets = () => {
    return sortRecommendedRandomBattlePets(myPlayerData?.pets || []);
  };

  const getRandomBattlePetImage = (pet) => {
    if (!pet) return '';
    return petImageMap[(pet.appearanceId || '') + '_idle'] || petImageMap[pet.appearanceId] || '';
  };

  const getDefaultRandom1v1PetIds = () => {
    const eligiblePets = getRandomBattleEligiblePets();
    const eligibleIdSet = new Set(eligiblePets.map(pet => pet.id));
    const preferredIds = [
      selectedPet?.id,
      ...eligiblePets.map(pet => pet.id),
    ].filter(Boolean).filter(id => eligibleIdSet.has(id));

    return [...new Set(preferredIds)].slice(0, 3);
  };

  const openRandom1v1Draft = () => {
    if (isRandomBattleLockedByMatch) {
      alert("이미 매칭된 랜덤대전이 있습니다. 먼저 입장하거나 대기를 취소해주세요.");
      return;
    }

    if (isRandom1v1QueueActive) {
      alert("이미 1:1 대전 매칭을 기다리는 중입니다.");
      return;
    }

    const defaultPetIds = getDefaultRandom1v1PetIds();
    if (defaultPetIds.length === 0) {
      alert("랜덤 1:1 대전에 참가할 수 있는 펫이 없습니다. 기절했거나 오늘 랜덤대전을 모두 사용한 펫은 제외됩니다.");
      return;
    }

    setRandomBattleDraft({
      show: true,
      mode: 'random-1v1',
      selectedPetIds: defaultPetIds,
      selectedTeamPetId: null,
      isSubmitting: false,
    });
  };

  const openRandomTeamBattleDraft = () => {
    if (isRandomBattleLockedByMatch) {
      alert("이미 매칭된 랜덤대전이 있습니다. 먼저 입장하거나 대기를 취소해주세요.");
      return;
    }

    if (isRandomTeamQueueActive) {
      alert("이미 3:3 팀대전 매칭을 기다리는 중입니다.");
      return;
    }

    const eligiblePets = getRandomBattleEligiblePets();
    if (eligiblePets.length === 0) {
      alert("팀대전에 참가할 수 있는 펫이 없습니다. 기절했거나 오늘 랜덤대전을 모두 사용한 펫은 제외됩니다.");
      return;
    }

    const defaultPetId = isPetEligibleForRandomBattle({ pet: selectedPet })
      ? selectedPet.id
      : eligiblePets[0].id;

    setRandomBattleDraft({
      show: true,
      mode: 'random-team',
      selectedPetIds: [],
      selectedTeamPetId: defaultPetId,
      isSubmitting: false,
    });
  };

  const closeRandomBattleDraft = () => {
    if (randomBattleDraft.isSubmitting) return;
    setRandomBattleDraft({
      show: false,
      mode: null,
      selectedPetIds: [],
      selectedTeamPetId: null,
      isSubmitting: false,
    });
  };

  const toggleRandom1v1Pet = (petId) => {
    setRandomBattleDraft(prev => {
      if (prev.mode !== 'random-1v1') return prev;
      const exists = prev.selectedPetIds.includes(petId);
      if (exists) {
        return { ...prev, selectedPetIds: prev.selectedPetIds.filter(id => id !== petId) };
      }

      if (prev.selectedPetIds.length >= 3) {
        alert("1:1 대전에는 최대 3마리까지 선택할 수 있습니다.");
        return prev;
      }

      return { ...prev, selectedPetIds: [...prev.selectedPetIds, petId] };
    });
  };

  const confirmRandomBattleDraft = async () => {
    if (!classId || !myPlayerData?.id) {
      alert("학급 또는 플레이어 정보를 불러오지 못했습니다.");
      return;
    }

    if (randomBattleDraft.mode === 'random-1v1' && randomBattleDraft.selectedPetIds.length === 0) {
      alert("1:1 대전에 참가할 펫을 최소 1마리 선택해주세요.");
      return;
    }

    if (randomBattleDraft.mode === 'random-team' && !randomBattleDraft.selectedTeamPetId) {
      alert("팀대전에 참가할 펫을 1마리 선택해주세요.");
      return;
    }

    try {
      setRandomBattleDraft(prev => ({ ...prev, isSubmitting: true }));

      // STRICT_RANDOM_1V1_WAITING_ROOM_PATCH
      if (randomBattleDraft.mode === 'random-1v1') {
        await createRandom1v1QueueEntry(classId, myPlayerData.id, randomBattleDraft.selectedPetIds);
        await tryMatchRandomBattleQueue(classId, myPlayerData.id, 'random-1v1');
      } else {
        await createRandomTeamQueueEntry(classId, myPlayerData.id, randomBattleDraft.selectedTeamPetId, { teamSize: 2 });
        await tryMatchRandomBattleQueue(classId, myPlayerData.id, 'random-team');
      }

      closeRandomBattleDraft();
    } catch (error) {
      setRandomBattleDraft(prev => ({ ...prev, isSubmitting: false }));
      alert("랜덤대전 참가 실패: " + error.message);
    }
  };

  const cancelActiveRandomBattleQueue = async () => {
    if (!classId || !myPlayerData?.id) return;
    try {
      setIsRandomBattleCancelling(true);
      await cancelRandomBattleQueueEntry(classId, myPlayerData.id);
      setRandomBattleQueueEntries({});
    } catch (error) {
      alert("대기 취소 실패: " + error.message);
    } finally {
      setIsRandomBattleCancelling(false);
    }
  };

  // ENTER_RANDOM_1V1_BATTLE_PATCH
  // ENTER_RANDOM_1V1_FIX_PATCH
  const enterMatchedRandom1v1Battle = async ({ silent = false } = {}) => {
    if (!classId || !myPlayerData?.id) return;

    try {
      setIsRandomBattleEntering(true);
      const result = await enterRandom1v1Battle(classId, myPlayerData.id);

      // STRICT_RANDOM_1V1_WAITING_ROOM_PATCH
      const matchQuery = result?.matchId ? '?randomMatchId=' + encodeURIComponent(result.matchId) : '';
      navigate('/battle/' + result.opponentId + matchQuery);
    } catch (error) {
      randomBattleAutoEnterRef.current = null;
      if (!silent) alert("랜덤대전 입장 실패: " + error.message);
      else console.warn("랜덤대전 자동 입장 실패:", error);
    } finally {
      setIsRandomBattleEntering(false);
    }
  };

  useEffect(() => {
    const entry = randomBattleQueueEntries['random-1v1'];
    if (!entry || entry.status !== 'entering' || entry.battleReady !== true) return;
    if (!entry.matchedOpponentId) return;

    const autoEnterKey = entry.matchId || entry.id || entry.matchedOpponentId;
    if (randomBattleAutoEnterRef.current === autoEnterKey) return;

    randomBattleAutoEnterRef.current = autoEnterKey;
    enterMatchedRandom1v1Battle({ silent: true });
  }, [
    classId,
    myPlayerData?.id,
    randomBattleQueueEntries['random-1v1']?.status,
    randomBattleQueueEntries['random-1v1']?.battleReady,
    randomBattleQueueEntries['random-1v1']?.matchId,
    randomBattleQueueEntries['random-1v1']?.matchedOpponentId,
  ]);

  const openBattleTeamDraft = (opponent) => {
    // M11C_CAP_TEAM_SIZE_BY_OPPONENT_PATCH
    // 신청자는 상대가 실제로 받을 수 있는 규모까지만 팀을 선택할 수 있습니다.
    const alivePets = getAliveBattlePets();
    const opponentAliveCount = (opponent?.pets || []).filter(pet => Number(pet?.hp ?? 0) > 0).length;
    const maxSelectableTeamSize = Math.min(3, alivePets.length, Math.max(1, opponentAliveCount));

    const preferredLeadId = selectedPet?.hp > 0
      ? selectedPet.id
      : alivePets[0]?.id || null;

    if (!preferredLeadId) {
      alert("출전 가능한 펫이 없습니다. 펫 센터에서 치료해주세요.");
      return;
    }

    if (maxSelectableTeamSize <= 1) {
      handleBattleRequest(opponent, { challengerTeamPetIds: [preferredLeadId] });
      return;
    }

    const defaultBenchId = alivePets.find(pet => pet.id !== preferredLeadId)?.id || null;
    const defaultThirdId = null;

    setBattleTeamDraft({
      show: true,
      opponent,
      leadPetId: preferredLeadId,
      benchPetId: defaultBenchId,
      thirdPetId: defaultThirdId,
    });
  };

  const closeBattleTeamDraft = () => {
    setBattleTeamDraft({
      show: false,
      opponent: null,
      leadPetId: null,
      benchPetId: null,
      thirdPetId: null,
    });
  };

  const confirmBattleTeamDraft = () => {
    // M11B_BATTLE_SIZE_CHOICE_PATCH
    const { opponent, leadPetId, benchPetId, thirdPetId } = battleTeamDraft;
    if (!opponent) return;

    if (!leadPetId) {
      alert("선발 펫을 선택해주세요.");
      return;
    }

    const selectedIds = [
      leadPetId,
      benchPetId,
      benchPetId ? thirdPetId : null,
    ].filter(Boolean);
    const uniqueSelectedIds = [...new Set(selectedIds)];

    if (uniqueSelectedIds.length !== selectedIds.length) {
      alert("서로 다른 펫을 선택해주세요.");
      return;
    }

    const challengerTeamPetIds = uniqueSelectedIds.slice(0, 3);
    closeBattleTeamDraft();
    handleBattleRequest(opponent, { challengerTeamPetIds });
  };

  const handleBattleRequest = async (opponent, battleOptions = {}) => {
    if (!classId || !myPlayerData || !opponent) return alert("데이터가 로딩되지 않았습니다.");
    try {
      await createBattleChallenge(classId, myPlayerData, opponent, battleOptions);
      navigate(`/battle/${opponent.id}`);
    } catch (error) {
      if (error.message?.includes('오늘 너무 지쳤어요')) {
        const vitaminCount = myPlayerData?.petInventory?.vitamin_jelly || 0;
        setVitaminJellyPopup({ show: true, pendingOpponent: opponent, pendingBattleOptions: battleOptions, vitaminCount });
      } else {
        alert(`대결 신청 실패: ${error.message}`);
      }
    }
  };

  const handleUseVitaminAndBattle = async () => {
    const { pendingOpponent, pendingBattleOptions } = vitaminJellyPopup;
    setVitaminJellyPopup({ show: false, pendingOpponent: null, pendingBattleOptions: null });
    try {
      await usePetItem('vitamin_jelly', selectedPet.id);
      await new Promise(resolve => setTimeout(resolve, 500));
      await createBattleChallenge(classId, myPlayerData, pendingOpponent, pendingBattleOptions || {});
      navigate(`/battle/${pendingOpponent.id}`);
    } catch (error) {
      alert(`대결 신청 실패: ${error.message}`);
    }
  };

  if (!myPlayerData || !myPlayerData.pets || myPlayerData.pets.length === 0 || !selectedPet) {
    return <PageWrapper><h2>펫 정보를 불러오는 중...</h2></PageWrapper>;
  }

  const { petInventory, totalLikes, partnerPetId } = myPlayerData;
  const currentStage = parseInt(selectedPet.appearanceId.match(/_lv(\d)/)?.[1] || '1');

  const currentPetInfo = currentStage === 3 ? PET_DATA[selectedPet.species]?.evolution?.lv20
    : currentStage === 2 ? PET_DATA[selectedPet.species]?.evolution?.lv10
      : PET_DATA[selectedPet.species];

  const skillSlotsCount = currentStage + 1;
  const learnedSkills = selectedPet.skills || PET_DATA[selectedPet.species].initialSkills;
  const unequippedSkills = learnedSkills.filter(id => !(equippedSkills || []).includes(id));

  

  // M25C_PET_SKILL_TOOLTIP
  // 스킬 카드 안 설명은 작게 말줄임 처리하되, 마우스 호버/키보드 포커스 시 전체 설명을 보여줍니다.
  const getSkillTooltipText = (skill, scaledCost) => {
    if (!skill) return undefined;
    const elementLabel = skill.element || '무';
    const costLabel = `SP ${scaledCost ?? skill.cost ?? 0}`;
    const powerLabel = skill.basePower !== undefined ? `위력 ${skill.basePower}` : '';
    return [
      skill.name,
      [elementLabel, costLabel, powerLabel].filter(Boolean).join(' · '),
      skill.description,
    ].filter(Boolean).join('\n');
  };


  // M25C_FIXED_SKILL_TOOLTIP_V2
  // 부모 overflow에 잘리지 않도록 스킬 툴팁을 fixed 레이어로 표시합니다.
  const showSkillTooltip = (event, text) => {
    if (!text) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top;
    setSkillTooltip({ show: true, text, x, y });
  };

  const moveSkillTooltip = (event) => {
    setSkillTooltip(prev => (
      prev.show
        ? { ...prev, x: event.clientX || prev.x, y: event.clientY || prev.y }
        : prev
    ));
  };

  const hideSkillTooltip = () => {
    setSkillTooltip({ show: false, text: '', x: 0, y: 0 });
  };
const hpPercent = Math.min(100, Math.max(0, (selectedPet.hp / selectedPet.maxHp) * 100));
  const spPercent = Math.min(100, Math.max(0, (selectedPet.sp / selectedPet.maxSp) * 100));
  const isMaxLevel = selectedPet.level >= MAX_PET_LEVEL || selectedPet.isMaxLevel === true;
  const expPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, (selectedPet.exp / selectedPet.maxExp) * 100));

  const evoCapLevel = currentStage === 1 ? 10 : currentStage === 2 ? 20 : Infinity;
  const isLevelCapped =
    !isMaxLevel &&
    currentStage < 3 &&
    selectedPet.level >= evoCapLevel &&
    PET_DATA[selectedPet.species]?.evolution;

  const isFainted = selectedPet.hp <= 0;
  const evolutionStoneCount = petInventory?.evolution_stone || 0;
  const isEvolvable = canEvolve(evolutionStoneCount);
  const evolutionConditionText = getEvolutionConditionText(evolutionStoneCount);
  const signatureSkillId = PET_DATA[selectedPet.species].skill.id;
  const secretNotebookCount = petInventory?.secret_notebook || 0;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
  const skillTooltipLeft = skillTooltip.show
    ? Math.min(Math.max(skillTooltip.x, 170), Math.max(170, viewportWidth - 170))
    : 0;
  const skillTooltipShouldOpenBelow = skillTooltip.show && skillTooltip.y < 170;
  const skillTooltipTop = skillTooltip.show
    ? skillTooltipShouldOpenBelow
      ? Math.min(skillTooltip.y + 18, 180)
      : Math.max(skillTooltip.y - 14, 24)
    : 0;

  // RANDOM_BATTLE_PETPAGE_ENTRY_PATCH
  // DUAL_QUEUE_RANDOM_BATTLE_PATCH
  const random1v1QueueEntry = randomBattleQueueEntries['random-1v1'] || null;
  const randomTeamQueueEntry = randomBattleQueueEntries['random-team'] || null;
  const legacyRandomQueueEntry = randomBattleQueueEntries.legacy || null;
  const isRandom1v1QueueActive = isActiveRandomBattleQueue(random1v1QueueEntry);
  const isRandomTeamQueueActive = isActiveRandomBattleQueue(randomTeamQueueEntry);
  const isLegacyRandomQueueActive = isActiveRandomBattleQueue(legacyRandomQueueEntry);
  const activeRandomBattleQueueEntries = [
    random1v1QueueEntry,
    randomTeamQueueEntry,
    legacyRandomQueueEntry,
  ].filter(isActiveRandomBattleQueue);
  const activeRandomBattleQueue = activeRandomBattleQueueEntries.length > 0;
  const isRandomBattleLockedByMatch = activeRandomBattleQueueEntries.some(entry => ['matched', 'entering'].includes(entry.status));
  // ENTER_RANDOM_1V1_BATTLE_PATCH
  const isRandom1v1WaitingForOpponent = random1v1QueueEntry?.status === 'entering' && random1v1QueueEntry?.battleReady !== true;
  const canEnterRandom1v1Battle = random1v1QueueEntry?.status === 'matched' || (
    random1v1QueueEntry?.status === 'entering' && random1v1QueueEntry?.battleReady === true
  );
  const hasMatchedTeamBattle = ['matched', 'entering'].includes(randomTeamQueueEntry?.status);
  // AUTO_MATCH_RANDOM_BATTLE_PATCH
  const randomBattleQueueLabels = [
    isRandom1v1QueueActive
      ? (isRandom1v1WaitingForOpponent
        ? '1:1 대전 상대 입장 대기중'
        : (canEnterRandom1v1Battle ? '1:1 대전 매칭 완료' : '1:1 대전 매칭중'))
      : null,
    isRandomTeamQueueActive
      ? (['matched', 'entering'].includes(randomTeamQueueEntry?.status) ? '3:3 대전 매칭 완료' : '3:3 대전 매칭중')
      : null,
    isLegacyRandomQueueActive ? '이전 랜덤대전 매칭중' : null,
  ].filter(Boolean);

  return (
    <PageWrapper>
      {skillTooltip.show && (
        <SkillTooltipPortal
          style={{
            left: `${skillTooltipLeft}px`,
            top: `${skillTooltipTop}px`,
            transform: skillTooltipShouldOpenBelow
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
        >
          {skillTooltip.text}
        </SkillTooltipPortal>
      )}
      <MainLayout>
        <PetDashboard>
          <PetProfile>
            <PetImage src={petImageMap[`${selectedPet.appearanceId}_idle`]} alt={selectedPet.name} $isFainted={isFainted} />
            <PetNameContainer>
              {isEditingName ? (<>
                <PetNameInput value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={10} />
                <button onClick={handleSaveName} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✔</button>
                <button onClick={() => { setIsEditingName(false); setNewName(selectedPet.name) }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
              </>) : (<>
                <PetName>{selectedPet.name}</PetName>
                <button onClick={handleEditNameClick} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title={`이름 변경 (변경권 ${myPlayerData?.petInventory?.pet_rename || 0}개)`}>✏️</button>
              </>)}
            </PetNameContainer>

            <PetLevel>
              Lv. {selectedPet.level} {currentPetInfo?.name || PET_DATA[selectedPet.species].name}
              {isMaxLevel ? ' · MAX' : ''}
            </PetLevel>
            {isFainted && <p style={{ color: '#fa5252', fontWeight: '800', margin: 0 }}>⚠️ 전투 불능!</p>}

            <AccordionContainer>
              <AccordionButtonRow>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'stats' ? null : 'stats')} $isActive={activeAccordion === 'stats'}>상세 정보</AccordionButton>
                <AccordionButton onClick={() => setActiveAccordion(prev => prev === 'skills' ? null : 'skills')} $isActive={activeAccordion === 'skills'}>스킬 관리</AccordionButton>
              </AccordionButtonRow>

              {activeAccordion && (
                <AccordionContent>
                  {activeAccordion === 'stats' && (
                    <StatGrid>
                      <InfoCard style={{ padding: '0.8rem', border: 'none', background: '#fff' }}>
                        <p>{currentPetInfo?.description || PET_DATA[selectedPet.species].description}</p>
                      </InfoCard>
                      <StatItem><p>공격력</p><p>{selectedPet.atk || 0}</p></StatItem>
                      <StatItem style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg,#f8f9fa,#e9ecef)', borderRadius: '10px', padding: '0.7rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <p style={{ fontWeight: 800, color: '#495057', marginBottom: '0.2rem' }}>⚔️ 배틀 전적</p>
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ background: '#d0ebff', color: '#1971c2', borderRadius: '8px', padding: '0.25rem 0.7rem', fontWeight: 800, fontSize: '0.88rem' }}>
                            🏆 {selectedPet.battleWins || 0}승
                          </span>
                          <span style={{ background: '#ffe3e3', color: '#c92a2a', borderRadius: '8px', padding: '0.25rem 0.7rem', fontWeight: 800, fontSize: '0.88rem' }}>
                            💀 {selectedPet.battleLosses || 0}패
                          </span>
                        </div>
                        {(() => {
                          const total = (selectedPet.battleWins || 0) + (selectedPet.battleLosses || 0);
                          const rate = total > 0 ? Math.round((selectedPet.battleWins || 0) / total * 100) : null;
                          return total > 0 ? (
                            <p style={{ fontSize: '0.82rem', color: '#868e96', margin: 0 }}>
                              총 {total}전 · 승률 {rate}%
                            </p>
                          ) : (
                            <p style={{ fontSize: '0.82rem', color: '#adb5bd', margin: 0 }}>아직 배틀 기록이 없습니다.</p>
                          );
                        })()}
                      </StatItem>
                    </StatGrid>
                  )}
                  {activeAccordion === 'skills' && (
                    <>
                      <SkillMiniGuide>
                        {selectedSkillSlot === null
                          ? "교체할 슬롯을 먼저 고르거나, 빈 슬롯이 있으면 보유 스킬을 눌러 바로 장착하세요."
                          : `${selectedSkillSlot + 1}번 슬롯에 넣을 스킬을 선택하세요.`}
                      </SkillMiniGuide>

                      <SkillSectionLabel>장착 슬롯</SkillSectionLabel>
                      <SkillGrid>
                        {Array.from({ length: skillSlotsCount }).map((_, index) => {
                          const skillId = equippedSkills[index];
                          const skill = skillId ? SKILLS[skillId.toUpperCase()] : null;
                          const scaledCost = skill ? getScaledSkillCost(skill.cost, selectedPet.level) : 0;
                          const isSignature = skill?.id === signatureSkillId;

                          return (
                            <SkillSlot
                              key={index}
                              $isSignature={isSignature}
                              $isSelected={selectedSkillSlot === index}
                              onClick={() => handleSkillSlotClick(index)}
                            
                                data-skill-tooltip-disabled={getSkillTooltipText(skill, scaledCost)}
                                title={getSkillTooltipText(skill, scaledCost)}
                                tabIndex={0}
                                onMouseEnter={(event) => showSkillTooltip(event, getSkillTooltipText(skill, scaledCost))}
                                onMouseMove={moveSkillTooltip}
                                onMouseLeave={hideSkillTooltip}
                                onFocus={(event) => showSkillTooltip(event, getSkillTooltipText(skill, scaledCost))}
                                onBlur={hideSkillTooltip}
                              >
                              {skill ? (
                                <>
                                  <div className="skill-head">
                                    <p>{skill.name}</p>
                                    {isSignature && <span className="mini-badge signature">고유</span>}
                                  </div>
                                  <small>SP {scaledCost}{skill.cost > 0 && scaledCost !== skill.cost ? ` · 기본 ${skill.cost}` : ""}</small>
                                  <span className="skill-desc">{skill.description}</span>
                                </>
                              ) : (
                                <>
                                  <p className="empty-title">비어있음</p>
                                  <small>보유 스킬을 선택하면 장착</small>
                                </>
                              )}
                            </SkillSlot>
                          );
                        })}
                      </SkillGrid>

                      <SkillList>
                        <NotebookButton onClick={() => handleUseItem("secret_notebook")} disabled={secretNotebookCount <= 0}>
                          📖 비법 노트 사용 ({secretNotebookCount}개)
                        </NotebookButton>
                        <SkillSectionLabel>보유 스킬</SkillSectionLabel>
                        <SkillGrid>
                          {learnedSkills.map(skillId => {
                            const skill = SKILLS[skillId.toUpperCase()];
                            if (!skill) return null;
                            const isEquipped = (equippedSkills || []).includes(skillId);
                            const scaledCostUnequipped = getScaledSkillCost(skill.cost, selectedPet.level);
                            return (
                              <SkillSlot
                                key={skillId}
                                $isSelected={false}
                                $isSignature={false}
                                $isEquipped={isEquipped}
                                onClick={() => handleLearnedSkillClick(skillId)}
                              
                                data-skill-tooltip-disabled={getSkillTooltipText(skill, scaledCostUnequipped)}
                                title={getSkillTooltipText(skill, scaledCostUnequipped)}
                                tabIndex={0}
                                onMouseEnter={(event) => showSkillTooltip(event, getSkillTooltipText(skill, scaledCostUnequipped))}
                                onMouseMove={moveSkillTooltip}
                                onMouseLeave={hideSkillTooltip}
                                onFocus={(event) => showSkillTooltip(event, getSkillTooltipText(skill, scaledCostUnequipped))}
                                onBlur={hideSkillTooltip}
                              >
                                <div className="skill-head">
                                  <p>{skill.name}</p>
                                  <span className="mini-badge">{skill.element ?? "무"}</span>
                                </div>
                                <small>SP {scaledCostUnequipped}{skill.cost > 0 && scaledCostUnequipped !== skill.cost ? ` · 기본 ${skill.cost}` : ""}</small>
                                <span className="skill-desc">{skill.description}</span>
                                <span className={isEquipped ? "skill-status equipped" : "skill-status"}>
                                  {isEquipped ? "장착중" : selectedSkillSlot !== null ? "선택칸에 장착" : "장착"}
                                </span>
                              </SkillSlot>
                            );
                          })}
                        </SkillGrid>
                      </SkillList>

                      <div style={{ display: "grid", gridTemplateColumns: selectedSkillSlot !== null ? "1fr auto" : "1fr", gap: "0.45rem", marginTop: "0.65rem" }}>
                        <StyledButton onClick={handleSaveSkills} style={{ backgroundColor: "#20c997", width: "100%", marginTop: 0 }}>
                          저장하기
                        </StyledButton>
                        {selectedSkillSlot !== null && (
                          <StyledButton
                            type="button"
                            onClick={() => setSelectedSkillSlot(null)}
                            style={{ backgroundColor: "#868e96", minWidth: "78px", marginTop: 0 }}
                          >
                            해제
                          </StyledButton>
                        )}
                      </div>
                    </>
                  )}
                </AccordionContent>
              )}
            </AccordionContainer>
          </PetProfile>
          <PetInfo>
            <StatBarContainer><StatBar $percent={hpPercent} $barColor="linear-gradient(90deg, #90ee90, #28a745)" /><StatText>HP: {selectedPet.hp} / {selectedPet.maxHp}</StatText></StatBarContainer>
            <StatBarContainer><StatBar $percent={spPercent} $barColor="linear-gradient(90deg, #87cefa, #007bff)" /><StatText>SP: {selectedPet.sp} / {selectedPet.maxSp}</StatText></StatBarContainer>
            <StatBarContainer>
              <StatBar
                $percent={expPercent}
                $barColor={isMaxLevel
                  ? "linear-gradient(90deg, #845ef7, #5f3dc4)"
                  : "linear-gradient(90deg, #ffc107, #ff9800)"
                }
              />
              <StatText>
                {isMaxLevel ? "MAX LEVEL" : `EXP: ${selectedPet.exp} / ${selectedPet.maxExp}`}
              </StatText>
            </StatBarContainer>
            {isLevelCapped && (
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#856404', marginTop: '4px' }}>
                ⚠️ <strong>Lv.{evoCapLevel} 상한 도달!</strong> 진화하지 않으면 레벨업할 수 없습니다. 경험치는 누적되고 있으니 진화 후 한꺼번에 반영됩니다.
              </div>
            )}
            {isMaxLevel && (
              <div style={{ background: '#f3f0ff', border: '1px solid #b197fc', borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', color: '#5f3dc4', marginTop: '4px', fontWeight: 700 }}>
                👑 <strong>Lv.{MAX_PET_LEVEL} 만렙 달성!</strong> 이 펫은 최고 레벨에 도달했습니다. 이제 배틀과 수집에서 멋지게 활약시켜 주세요!
              </div>
            )}

            <InfoCard>
              <div
                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', paddingBottom: '4px' }}
              >
                <h4 style={{ margin: 0 }}>🎒 인벤토리</h4>
                <span style={{ fontSize: '0.85rem', color: '#868e96', fontWeight: 'bold' }}>{isInventoryOpen ? '▲ 닫기' : '▼ 열기'}</span>
              </div>

              {isInventoryOpen && (
                <div style={{ marginTop: '1rem', padding: '0.4rem 0 0 0', borderTop: '1px dashed #e9ecef' }}>
                  {Object.values(PET_ITEMS)
                    .filter(item => (petInventory?.[item.id] || 0) > 0)
                    .map(item => (
                      <InventoryItem key={item.id}>
                        <img src={item.icon} alt={item.name} />
                        {item.name}: {petInventory[item.id]}개
                      </InventoryItem>
                    ))}
                  {Object.values(PET_ITEMS).filter(item => (petInventory?.[item.id] || 0) > 0).length === 0 && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#adb5bd', fontWeight: '600' }}>현재 가방에 보유 중인 아이템이 없습니다.</p>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid #e9ecef', margin: '1rem 0 0.6rem 0' }}></div>

              {(() => {
                const todayStr = new Date().toLocaleDateString();
                const dailyCount = selectedPet.lastBattleDate === todayStr ? (selectedPet.dailyBattleCount || 0) : 0;
                const vitaminCount = petInventory?.vitamin_jelly || 0;
                if (isAdmin) return (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.8rem', background: '#ebfbee', borderRadius: '10px', fontSize: '0.85rem', color: '#2f9e44', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚔️ 오늘 배틀: {dailyCount}회 <span style={{ color: '#868e96', fontWeight: 500 }}>(관리자 무제한)</span></span>
                  </div>
                );
                return (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem 0.8rem', background: dailyCount >= 10 ? '#fff5f5' : '#f8f9fa', borderRadius: '10px', fontSize: '0.85rem', color: dailyCount >= 10 ? '#e03131' : '#495057', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚔️ 오늘 배틀: {dailyCount} / 10회</span>
                    {dailyCount >= 10 && vitaminCount > 0 && (
                      <span style={{ color: '#e03131', fontSize: '0.78rem' }}>🍬 젤리로 초기화 가능</span>
                    )}
                  </div>
                );
              })()}
            </InfoCard>

            <ActionButtonGroup>
              <TooltipWrapper
                data-tooltip={!isEvolvable ? evolutionConditionText : ""}
                onClick={() => { if (!isEvolvable && evolutionConditionText) alert(evolutionConditionText); }}
              >
                <EvolveButton onClick={handleEvolve} disabled={!isEvolvable}>
                  {currentStage >= 3 ? "최종 진화 완료" : `진화 (${evolutionStoneCount}개)`}
                </EvolveButton>
              </TooltipWrapper>

              <FeedButton onClick={() => handleUseItem('brain_snack')} disabled={isFainted}>간식 주기 ({petInventory?.brain_snack || 0}개)</FeedButton>

              <ExchangeContainer>
                <ExchangeInput type="number" value={exchangeAmount} onChange={(e) => setExchangeAmount(e.target.value)} min="1" max={totalLikes || 1} />
                <StyledButton onClick={handleHeartExchange} disabled={!totalLikes || totalLikes < Number(exchangeAmount) || Number(exchangeAmount) <= 0} style={{ backgroundColor: '#fd7e14', width: '120px' }}>
                  ♥ 교환
                </StyledButton>
              </ExchangeContainer>

              <PetCenterButton onClick={() => navigate('/pet-center')}>🏥 펫 센터 (상점/치료소)</PetCenterButton>

              {/* RANDOM_BATTLE_PETPAGE_ENTRY_PATCH */}
              <BattleEntryPanel>
                {activeRandomBattleQueue && (
                  <RandomQueueNotice>
                    <div>
                      {randomBattleQueueLabels.map(label => (
                        <div key={label}>{label}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {isRandom1v1WaitingForOpponent && (
                        <button
                          type="button"
                          disabled
                          style={{ background: '#adb5bd', boxShadow: 'none' }}
                        >
                          상대 입장 대기중
                        </button>
                      )}
                      {canEnterRandom1v1Battle && (
                        <button
                          type="button"
                          onClick={enterMatchedRandom1v1Battle}
                          disabled={isRandomBattleEntering}
                          style={{ background: '#2f9e44', boxShadow: '0 2px 0 #1b6b2a' }}
                        >
                          {isRandomBattleEntering ? "입장 중..." : "입장하기"}
                        </button>
                      )}
                      {hasMatchedTeamBattle && !canEnterRandom1v1Battle && (
                        <button
                          type="button"
                          disabled
                          style={{ background: '#adb5bd', boxShadow: 'none' }}
                        >
                          입장 준비중
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={cancelActiveRandomBattleQueue}
                        disabled={isRandomBattleCancelling || isRandomBattleEntering}
                      >
                        {isRandomBattleCancelling ? "취소 중..." : "이번엔 쉬기"}
                      </button>
                    </div>
                  </RandomQueueNotice>
                )}

                <BattleEntryGrid>
                  <RandomBattleEntryButton
                    type="button"
                    onClick={openRandom1v1Draft}
                    disabled={isRandom1v1QueueActive || isRandomBattleLockedByMatch}
                  >
                    <span className="main">1:1 대전 참가</span>
                    <span className="sub">펫 1~3마리 선택</span>
                  </RandomBattleEntryButton>

                  <RandomBattleEntryButton
                    type="button"
                    $variant="team"
                    onClick={openRandomTeamBattleDraft}
                    disabled={isRandomTeamQueueActive || isRandomBattleLockedByMatch}
                  >
                    <span className="main">3:3 팀대전 참가</span>
                    <span className="sub">현재 2:2 베타</span>
                  </RandomBattleEntryButton>
                </BattleEntryGrid>
              </BattleEntryPanel>
            </ActionButtonGroup>
          </PetInfo>
        </PetDashboard>

        <PetListPanel>
          <h4>🐾 보유 펫 목록</h4>
          <PetListWrapper>
            {myPlayerData.pets.map(pet => (
              <PetListItem key={pet.id} onClick={() => setSelectedPetId(pet.id)} $isSelected={pet.id === selectedPetId}>
                <img src={petImageMap[`${pet.appearanceId}_idle`]} alt={pet.name} />
                <div>
                  <strong>{pet.name}</strong>
                  <p>Lv.{pet.level}{pet.level >= MAX_PET_LEVEL || pet.isMaxLevel ? ' MAX' : ''} {pet.id === partnerPetId && '⭐'}</p>
                </div>
              </PetListItem>
            ))}
          </PetListWrapper>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <StyledButton
                onClick={() => setPartnerPet(selectedPetId)}
                disabled={selectedPetId === partnerPetId}
                style={{ width: '100%', backgroundColor: '#7048e8', marginTop: 0 }}
              >
                파트너 지정
              </StyledButton>
              <StyledButton
                onClick={() => navigate('/pet-dex')}
                style={{ width: '100%', backgroundColor: '#845ef7', marginTop: 0 }}
              >
                📖 도감
              </StyledButton>
            </div>
            <StyledButton onClick={handleHatch} disabled={!petInventory?.pet_egg} style={{ width: '100%', marginTop: '0.8rem', backgroundColor: '#20c997' }}>
              알 부화시키기 ({petInventory?.pet_egg || 0}개)
            </StyledButton>
          </div>
        </PetListPanel>
      </MainLayout>

      {/* 펫 진화 전용 이펙트 모달창 */}
      {isEvolving && (
        <ModalBackground>
          <ModalContent>
            {evolveState.step === 'charging' ? (
              <div>
                <h2 style={{ color: '#ffd43b', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>진화 에너지 충전 중...!!</h2>
                <p style={{ color: 'white', fontWeight: 600 }}>진화의 돌을 흡수하여 에너지를 응축합니다!</p>
                <div style={{ margin: '3.5rem 0', position: 'relative', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* [추가] 회전하며 흡수되는 진화의 돌 에셋 */}
                  <img src={PET_ITEMS.evolution_stone.image} alt="진화의 돌" className="evo-stone-asset" />
                  <img src={petImageMap[`${evolveState.targetPet.appearanceId}_idle`]} alt="진화 중" className="evo-charge" />
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ color: '#51cf66', textShadow: '0 0 15px rgba(255,255,255,0.8)' }}>축하합니다! 진화 성공!</h2>
                <div style={{ margin: '2rem 0' }}>
                  <img src={petImageMap[`${myPlayerData?.pets?.find(p => p.id === selectedPetId)?.appearanceId}_idle`]} alt="진화 완료" className="pet" />
                </div>
                <h3 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 900 }}>
                  {evolveState.targetPet.name}이(가) 드디어 <span style={{ color: '#ffd43b' }}>{evolveState.nextFormName}</span>(으)로 성장했습니다! 🎉
                </h3>
                <button onClick={() => setIsEvolving(false)} style={{ padding: '0.8rem 2.5rem', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '1.5rem' }}>확인</button>
              </div>
            )}
          </ModalContent>
        </ModalBackground>
      )}

      {isHatching && (
        <ModalBackground>
          <ModalContent $isShaking={hatchState.step === 'shaking'}>
            {hatchState.step !== 'cracked' ? (<>
              <h2 style={{ color: 'white' }}>알이 부화하려고 합니다...</h2>
              <img src={PET_ITEMS.pet_egg.image} alt="펫 알" className="egg" style={{ width: '200px' }} />
            </>) : (
              <div>
                <h2 style={{ color: 'white' }}>와!</h2>
                <img src={petImageMap[`${hatchState.hatchedPet.appearanceId}_idle`]} alt="부화한 펫" className="pet" />
                <h3 style={{ color: 'white' }}>{hatchState.hatchedPet.name}이(가) 태어났습니다!</h3>
                {(() => {
                  const beforeHatch = myPlayerData?.pets?.filter(p => p.id !== hatchState.hatchedPet.id) || [];
                  const isNew = !beforeHatch.some(p => p.species === hatchState.hatchedPet.species);
                  const allSpecies = Object.keys(PET_DATA);
                  const ownedAfter = new Set([...beforeHatch.map(p => p.species), hatchState.hatchedPet.species]);
                  const isComplete = allSpecies.every(s => ownedAfter.has(s));
                  return (
                    <div style={{ marginBottom: '0.8rem' }}>
                      {isComplete ? (
                        <p style={{ color: '#ffd43b', fontWeight: 800, fontSize: '1.05rem' }}>
                          🎉 모든 종류의 펫을 수집했습니다! 완전 컬렉션 달성!
                        </p>
                      ) : isNew ? (
                        <p style={{ color: '#a9e34b', fontWeight: 700 }}>
                          ✨ 새로운 종류의 펫 발견! ({ownedAfter.size}/{allSpecies.length} 종 수집)
                        </p>
                      ) : (
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                          ({ownedAfter.size}/{allSpecies.length} 종 수집)
                        </p>
                      )}
                    </div>
                  );
                })()}
                <button onClick={() => setIsHatching(false)} style={{ padding: '0.8rem 2rem', fontSize: '1.1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>확인</button>
              </div>
            )}
          </ModalContent>
        </ModalBackground>
      )}

      {randomBattleDraft.show && (
        <ModalBackground onClick={closeRandomBattleDraft}>
          <ModalContent
            className="white-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '720px',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexShrink: 0 }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0 }}>
                  {randomBattleDraft.mode === 'random-team' ? '👥 3:3 팀대전 참가' : '⚔️ 1:1 대전 참가'}
                </h3>
                <p style={{ margin: '0.35rem 0 0', color: '#868e96', fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.45 }}>
                  {randomBattleDraft.mode === 'random-team'
                    ? '현재는 2:2 베타로 운영됩니다. 참가할 펫 1마리를 선택하세요.'
                    : '출전할 펫을 1~3마리 선택하세요. 가능하면 3마리 구성이 유리합니다.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRandomBattleDraft}
                disabled={randomBattleDraft.isSubmitting}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: randomBattleDraft.isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                ✖
              </button>
            </div>

            {(() => {
              const eligiblePets = getRandomBattleEligiblePets();
              const selectedIds = randomBattleDraft.mode === 'random-team'
                ? [randomBattleDraft.selectedTeamPetId].filter(Boolean)
                : randomBattleDraft.selectedPetIds;
              const selectedPets = selectedIds
                .map(id => eligiblePets.find(pet => pet.id === id))
                .filter(Boolean);
              const averageLevel = getAveragePetLevel(selectedPets);
              const hasSelection = selectedPets.length > 0;

              const renderPetCard = (pet, isSelected, onClick) => {
                const todayCount = getRandomBattleCount(pet);
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={onClick}
                    disabled={randomBattleDraft.isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      textAlign: 'left',
                      padding: '0.65rem',
                      borderRadius: '14px',
                      border: isSelected ? '3px solid #fa5252' : '2px solid #e9ecef',
                      background: isSelected ? '#fff5f5' : '#ffffff',
                      cursor: randomBattleDraft.isSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: isSelected ? '0 6px 18px rgba(250,82,82,0.18)' : '0 3px 10px rgba(0,0,0,0.06)',
                    }}
                  >
                    <img
                      src={getRandomBattlePetImage(pet)}
                      alt={pet.name}
                      style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '50%', background: '#f8f9fa' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', color: '#343a40' }}>{pet.name}</strong>
                      <span style={{ display: 'block', color: '#868e96', fontSize: '0.78rem', fontWeight: 800 }}>
                        Lv.{pet.level} · HP {pet.hp}/{pet.maxHp}
                      </span>
                      <span style={{ display: 'block', color: '#495057', fontSize: '0.72rem', fontWeight: 800 }}>
                        랜덤대전 {todayCount}/2회
                      </span>
                    </div>
                  </button>
                );
              };

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: randomBattleDraft.mode === 'random-team' ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '0.9rem', flexShrink: 0 }}>
                    <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '0.72rem', border: '1px solid #e9ecef' }}>
                      <div style={{ color: '#868e96', fontSize: '0.72rem', fontWeight: 900 }}>선택한 펫</div>
                      <div style={{ color: '#343a40', fontSize: '1.15rem', fontWeight: 1000 }}>
                        {selectedPets.length}마리
                      </div>
                    </div>
                    <div style={{ background: '#e7f5ff', borderRadius: '12px', padding: '0.72rem', border: '1px solid #a5d8ff' }}>
                      <div style={{ color: '#1971c2', fontSize: '0.72rem', fontWeight: 900 }}>
                        {randomBattleDraft.mode === 'random-team' ? '참가 펫 Lv.' : '평균 Lv.'}
                      </div>
                      <div style={{ color: '#1864ab', fontSize: '1.15rem', fontWeight: 1000 }}>
                        {hasSelection ? averageLevel : '-'}
                      </div>
                    </div>
                    {randomBattleDraft.mode === 'random-1v1' && (
                      <div style={{ background: selectedPets.length < 3 ? '#fff3bf' : '#ebfbee', borderRadius: '12px', padding: '0.72rem', border: selectedPets.length < 3 ? '1px solid #ffd43b' : '1px solid #b2f2bb' }}>
                        <div style={{ color: selectedPets.length < 3 ? '#7c4a03' : '#2f9e44', fontSize: '0.72rem', fontWeight: 900 }}>권장</div>
                        <div style={{ color: selectedPets.length < 3 ? '#7c4a03' : '#2f9e44', fontSize: '0.92rem', fontWeight: 1000 }}>
                          {selectedPets.length < 3 ? '3마리 권장' : '좋은 구성'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ overflowY: 'auto', paddingRight: '0.35rem', flex: 1 }}>
                    {eligiblePets.length === 0 ? (
                      <p style={{ color: '#868e96', padding: '2rem 0', margin: 0 }}>
                        참가 가능한 펫이 없습니다. 기절했거나 오늘 랜덤대전을 모두 사용한 펫은 제외됩니다.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.7rem' }}>
                        {eligiblePets.map(pet => {
                          const isSelected = randomBattleDraft.mode === 'random-team'
                            ? randomBattleDraft.selectedTeamPetId === pet.id
                            : randomBattleDraft.selectedPetIds.includes(pet.id);

                          return renderPetCard(
                            pet,
                            isSelected,
                            () => {
                              if (randomBattleDraft.mode === 'random-team') {
                                setRandomBattleDraft(prev => ({ ...prev, selectedTeamPetId: pet.id }));
                              } else {
                                toggleRandom1v1Pet(pet.id);
                              }
                            }
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {randomBattleDraft.mode === 'random-1v1' && selectedPets.length > 0 && selectedPets.length < 3 && (
                    <p style={{ margin: '0.8rem 0 0', color: '#f08c00', fontSize: '0.82rem', fontWeight: 900, lineHeight: 1.45, flexShrink: 0 }}>
                      선택한 펫이 적으면 불리할 수 있어요. 다만 매칭은 가능하며, 상대도 가능한 한 비슷한 펫 수로 찾습니다.
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={closeRandomBattleDraft}
                      disabled={randomBattleDraft.isSubmitting}
                      style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #dee2e6', background: '#f8f9fa', color: '#495057', fontWeight: 900, cursor: randomBattleDraft.isSubmitting ? 'not-allowed' : 'pointer' }}
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={confirmRandomBattleDraft}
                      disabled={!hasSelection || randomBattleDraft.isSubmitting}
                      style={{ flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', background: !hasSelection || randomBattleDraft.isSubmitting ? '#adb5bd' : 'linear-gradient(135deg, #fa5252, #e03131)', color: 'white', fontWeight: 1000, cursor: !hasSelection || randomBattleDraft.isSubmitting ? 'not-allowed' : 'pointer', boxShadow: !hasSelection || randomBattleDraft.isSubmitting ? 'none' : '0 4px 0 #c92a2a' }}
                    >
                      {randomBattleDraft.isSubmitting ? '참가 중...' : '대기열 참가'}
                    </button>
                  </div>
                </>
              );
            })()}
          </ModalContent>
        </ModalBackground>
      )}

      {isOpponentModalOpen && (
        <ModalBackground onClick={() => setIsOpponentModalOpen(false)}>
          <ModalContent className="white-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>⚔️ 대결 상대 선택</h3>
              <button onClick={() => setIsOpponentModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            </div>
            <OpponentList>
              {opponents.length === 0 ? (
                <p style={{ color: '#888', padding: '2rem 0', gridColumn: '1 / -1' }}>대결 가능한 친구가 없습니다.<br />(펫을 보유한 친구만 표시됩니다)</p>
              ) : (
                opponents.map(opp => {
                  const oppPet = opp.pets.find(p => p.id === opp.partnerPetId) || opp.pets[0];
                  return (
                    <OpponentItem key={opp.authUid}>
                      <div className="left-section">
                        <img src={petImageMap[`${oppPet.appearanceId}_idle`]} alt={oppPet.name} />
                        <div className="info">
                          <strong>{opp.name}</strong>
                          <span>{oppPet.name} (Lv.{oppPet.level})</span>
                        </div>
                      </div>
                      <ChallengeButton onClick={() => openBattleTeamDraft(opp)}>신청하기</ChallengeButton>
                    </OpponentItem>
                  );
                })
              )}
            </OpponentList>
          </ModalContent>
        </ModalBackground>
      )}
      {battleTeamDraft.show && (
        <ModalBackground onClick={closeBattleTeamDraft}>
          <ModalContent
            className="white-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              // M13_TEAM_MODAL_LAYOUT_FIX_PATCH
              maxWidth: '680px',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0 }}>⚔️ 배틀 팀 선택</h3>
                <p style={{ margin: '0.35rem 0 0', color: '#868e96', fontSize: '0.9rem', fontWeight: 700 }}>
                  선발 펫은 필수입니다. 2번/3번 칸은 선택 안함을 고르면 1 vs 1 또는 2 vs 2로 신청할 수 있습니다.
                </p>
              </div>
              <button onClick={closeBattleTeamDraft} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{


              flex: 1,


              overflowY: 'auto',


              paddingRight: '0.35rem',


              paddingBottom: '0.25rem',


            }}>


            {(() => {


              // M11B_BATTLE_SIZE_CHOICE_PATCH
              const alivePets = getAliveBattlePets();
              const opponentAliveCount = (battleTeamDraft.opponent?.pets || []).filter(pet => Number(pet?.hp ?? 0) > 0).length;
              const maxSelectableTeamSize = Math.min(3, alivePets.length, Math.max(1, opponentAliveCount));
              const leadPet = alivePets.find(pet => pet.id === battleTeamDraft.leadPetId);
              const benchPet = alivePets.find(pet => pet.id === battleTeamDraft.benchPetId);
              const thirdPet = battleTeamDraft.benchPetId
                ? alivePets.find(pet => pet.id === battleTeamDraft.thirdPetId)
                : null;
              const selectedTeamIds = [
                battleTeamDraft.leadPetId,
                battleTeamDraft.benchPetId,
                battleTeamDraft.benchPetId ? battleTeamDraft.thirdPetId : null,
              ].filter(Boolean);
              const selectedTeamSize = new Set(selectedTeamIds).size || 1;
              const isSubmitDisabled =
                !battleTeamDraft.leadPetId ||
                new Set(selectedTeamIds).size !== selectedTeamIds.length;

              const renderNoneButton = (isSelected, onSelect) => (
                <button
                  type="button"
                  onClick={onSelect}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0.65rem',
                    borderRadius: '14px',
                    border: isSelected ? '3px solid #868e96' : '2px dashed #ced4da',
                    background: isSelected ? '#f1f3f5' : 'white',
                    color: '#495057',
                    fontWeight: 900,
                    cursor: 'pointer',
                    minHeight: '66px',
                  }}
                >
                  선택 안함
                </button>
              );

              const renderTeamChoice = (slotLabel, selectedId, onSelect, blockedIds = [], allowNone = false, onNone = null) => (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.55rem', color: '#343a40' }}>{slotLabel}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.7rem' }}>
                    {allowNone && renderNoneButton(!selectedId, onNone)}
                    {alivePets.map(pet => {
                      const isSelected = selectedId === pet.id;
                      const isBlocked = Array.isArray(blockedIds) ? blockedIds.includes(pet.id) : blockedIds === pet.id;
                      return (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => !isBlocked && onSelect(pet.id)}
                          disabled={isBlocked}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            textAlign: 'left',
                            padding: '0.65rem',
                            borderRadius: '14px',
                            border: isSelected ? '3px solid #339af0' : '2px solid #e9ecef',
                            background: isSelected ? '#e7f5ff' : isBlocked ? '#f1f3f5' : 'white',
                            opacity: isBlocked ? 0.45 : 1,
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            boxShadow: isSelected ? '0 6px 18px rgba(51,154,240,0.18)' : '0 3px 10px rgba(0,0,0,0.06)',
                          }}
                        >
                          <img
                            src={petImageMap[`${pet.appearanceId}_idle`]}
                            alt={pet.name}
                            style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: '50%', background: '#f8f9fa' }}
                          />
                          <div>
                            <strong style={{ display: 'block', color: '#343a40' }}>{pet.name}</strong>
                            <span style={{ display: 'block', color: '#868e96', fontSize: '0.78rem', fontWeight: 800 }}>
                              Lv.{pet.level} · HP {pet.hp}/{pet.maxHp}
                            </span>
                            {isBlocked && (
                              <span style={{ display: 'block', color: '#fa5252', fontSize: '0.72rem', fontWeight: 800 }}>
                                이미 다른 칸에 선택됨
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );

              return (
                <>
                  <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '16px', padding: '0.8rem 1rem', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, color: '#495057', fontSize: '0.9rem', fontWeight: 800 }}>
                      신청 상대: {battleTeamDraft.opponent?.name || '상대'} · 상대 생존 펫 {opponentAliveCount}마리 · 최대 {maxSelectableTeamSize} vs {maxSelectableTeamSize}
                    </p>
                  </div>

                  {renderTeamChoice('1번 선발 펫', battleTeamDraft.leadPetId, (petId) => {
                    const nextBenchId = battleTeamDraft.benchPetId === petId ? null : battleTeamDraft.benchPetId;
                    const nextThirdId = battleTeamDraft.thirdPetId === petId ? null : battleTeamDraft.thirdPetId;
                    setBattleTeamDraft(prev => ({
                      ...prev,
                      leadPetId: petId,
                      benchPetId: nextBenchId,
                      thirdPetId: nextBenchId ? nextThirdId : null,
                    }));
                  }, [])}

                  {maxSelectableTeamSize >= 2 && renderTeamChoice(
                    '2번 대기 펫',
                    battleTeamDraft.benchPetId,
                    (petId) => {
                      const nextThirdId = battleTeamDraft.thirdPetId === petId ? null : battleTeamDraft.thirdPetId;
                      setBattleTeamDraft(prev => ({ ...prev, benchPetId: petId, thirdPetId: nextThirdId }));
                    },
                    [battleTeamDraft.leadPetId].filter(Boolean),
                    true,
                    () => setBattleTeamDraft(prev => ({ ...prev, benchPetId: null, thirdPetId: null }))
                  )}

                  {maxSelectableTeamSize >= 3 && battleTeamDraft.benchPetId && renderTeamChoice(
                    '3번 대기 펫',
                    battleTeamDraft.thirdPetId,
                    (petId) => {
                      setBattleTeamDraft(prev => ({ ...prev, thirdPetId: petId }));
                    },
                    [battleTeamDraft.leadPetId, battleTeamDraft.benchPetId].filter(Boolean),
                    true,
                    () => setBattleTeamDraft(prev => ({ ...prev, thirdPetId: null }))
                  )}

                  {maxSelectableTeamSize >= 3 && !battleTeamDraft.benchPetId && (
                    <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', borderRadius: '14px', background: '#f8f9fa', border: '1px dashed #ced4da', color: '#868e96', fontWeight: 800, textAlign: 'center' }}>
                      2번 대기 펫을 선택하면 3번 대기 펫도 선택할 수 있습니다.
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginTop: '1.2rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    position: 'sticky',
                    bottom: 0,
                    background: 'white',
                    padding: '0.85rem 0 0.15rem',
                    borderTop: '1px solid #f1f3f5',
                    zIndex: 2,
                  }}>
                    <div style={{ color: '#495057', fontSize: '0.9rem', fontWeight: 800 }}>
                      선택: {[leadPet?.name, benchPet?.name, thirdPet?.name].filter(Boolean).join(' + ') || '-'} · {selectedTeamSize} vs {selectedTeamSize}
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={closeBattleTeamDraft}
                        style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #dee2e6', background: 'white', color: '#495057', fontWeight: 800, cursor: 'pointer' }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={confirmBattleTeamDraft}
                        disabled={isSubmitDisabled}
                        style={{
                          padding: '0.75rem 1.2rem',
                          borderRadius: '12px',
                          border: 'none',
                          background: isSubmitDisabled
                            ? '#adb5bd'
                            : 'linear-gradient(135deg, #339af0, #1c7ed6)',
                          color: 'white',
                          fontWeight: 900,
                          cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {selectedTeamSize} vs {selectedTeamSize} 신청하기
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

            </div>
          </ModalContent>
        </ModalBackground>
      )}

      {vitaminJellyPopup.show && (
        <ModalBackground onClick={() => setVitaminJellyPopup({ show: false, pendingOpponent: null, pendingBattleOptions: null })}>
          <ModalContent onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '360px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍬</div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#343a40' }}>
              오늘 배틀 횟수({10}회)를 모두 사용했어요!
            </h3>
            <p style={{ color: '#868e96', fontSize: '0.95rem', margin: '0 0 1.2rem', lineHeight: '1.5' }}>
              <strong style={{ color: '#f03e3e' }}>비타민 젤리</strong>를 사용하면<br />
              배틀 횟수가 초기화되어 바로 대결할 수 있어요.
            </p>
            <div style={{ background: '#fff5f5', borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🍬</span>
              <span style={{ fontWeight: '800', color: '#e03131' }}>
                비타민 젤리 보유: {vitaminJellyPopup.vitaminCount ?? (myPlayerData?.petInventory?.vitamin_jelly || 0)}개
              </span>
            </div>
            {(vitaminJellyPopup.vitaminCount ?? myPlayerData?.petInventory?.vitamin_jelly ?? 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  onClick={handleUseVitaminAndBattle}
                  style={{ padding: '0.9rem', background: 'linear-gradient(135deg, #ff6b6b, #f03e3e)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(240,62,62,0.3)' }}
                >
                  🍬 비타민 젤리 사용하고 배틀하기
                </button>
                <button
                  onClick={() => setVitaminJellyPopup({ show: false, pendingOpponent: null, pendingBattleOptions: null })}
                  style={{ padding: '0.7rem', background: 'none', color: '#868e96', border: '1px solid #dee2e6', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <p style={{ color: '#868e96', fontSize: '0.85rem', margin: '0 0 0.4rem' }}>
                  비타민 젤리가 없어요. 펫센터 상점에서 구매하거나 내일 다시 도전해보세요!
                </p>
                <button
                  onClick={() => navigate('/pet-center')}
                  style={{ padding: '0.9rem', background: 'linear-gradient(135deg, #339af0, #1c7ed6)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer' }}
                >
                  🏪 펫센터 상점 가기
                </button>
                <button
                  onClick={() => setVitaminJellyPopup({ show: false, pendingOpponent: null, pendingBattleOptions: null })}
                  style={{ padding: '0.7rem', background: 'none', color: '#868e96', border: '1px solid #dee2e6', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  닫기
                </button>
              </div>
            )}
          </ModalContent>
        </ModalBackground>
      )}

      <ButtonGroup>
        <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
        <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
      </ButtonGroup>
    </PageWrapper>
  );
}

export default PetPage;