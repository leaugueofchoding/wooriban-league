// src/features/battle/BattlePage.jsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeagueStore, useClassStore } from '../../store/leagueStore';
import { auth, db, cancelBattleChallenge, getActiveQuizSets, getScaledSkillCost , processBattleResults} from '../../api/firebase';
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { petImageMap } from '../../utils/petImageMap';
import { SKILLS } from '../pet/petData';
import { filterProfanity } from '../../utils/profanityFilter';
import BattleSkillEffect from './BattleSkillEffect';
import { playSkillSound, playHitSound, playHealSound, startBattleBgm, stopBattleBgm } from './BattleSoundEngine';
import BattleStatusEffect from './BattleStatusEffect';
import { BattleHpBar, BattleSpBar } from './BattleStatBars';
import BattlePetSlot from './BattlePetSlot';
import BattleTeamMiniBar from './BattleTeamMiniBar';
import BattlePlayerPanel from './BattlePlayerPanel';
import BattleActionMenu from './BattleActionMenu';
import { normalizeBattleParticipantForBattle, replaceActiveBattlePet } from './battlePetUtils';


const syncBattleParticipantActivePet = (participant) => {
    // M3_ACTIVE_PET_SYNC_PATCH
    // 기존 로직은 participant.pet을 갱신합니다.
    // 복수 펫 구조에서는 같은 내용을 team[activePetIndex]에도 반영해야 합니다.
    if (!participant?.pet) return participant;
    return replaceActiveBattlePet(participant, participant.pet);
};


const switchToNextAlivePetIfNeeded = (participant) => {
    // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH
    // active pet이 쓰러졌을 때 team 안의 살아있는 대기 펫으로 자동 교체합니다.
    // 그리고 실제 필드에 나온 펫 id를 participatedPetIds에 누적합니다.
    if (!participant?.pet) {
        return { participant, switched: false, switchedPetName: null };
    }

    const currentPet = {
        ...participant.pet,
        hp: Math.max(0, Number(participant.pet.hp ?? 0)),
        status: { ...(participant.pet.status || {}) },
    };

    const rawTeam = Array.isArray(participant.team) && participant.team.length > 0
        ? participant.team
        : [currentPet];

    const currentIndexById = participant.activePetId
        ? rawTeam.findIndex(pet => pet?.id === participant.activePetId)
        : -1;

    const fallbackIndex = Number(participant.activePetIndex ?? 0);
    const activePetIndex = currentIndexById >= 0
        ? currentIndexById
        : Math.min(Math.max(Number.isFinite(fallbackIndex) ? fallbackIndex : 0, 0), rawTeam.length - 1);

    const existingParticipatedPetIds = Array.isArray(participant.participatedPetIds)
        ? participant.participatedPetIds
        : [];

    const participatedWithCurrent = [
        ...new Set([
            ...existingParticipatedPetIds,
            currentPet.id,
        ].filter(Boolean)),
    ];

    const syncedTeam = rawTeam.map((pet, index) => (
        index === activePetIndex
            ? currentPet
            : { ...pet, status: { ...(pet?.status || {}) } }
    ));

    const syncedParticipant = {
        ...participant,
        pet: currentPet,
        team: syncedTeam,
        activePetIndex,
        activePetId: currentPet.id || participant.activePetId || null,
        participatedPetIds: participatedWithCurrent,
    };

    if (Number(currentPet.hp ?? 0) > 0) {
        return { participant: syncedParticipant, switched: false, switchedPetName: null };
    }

    const nextIndex = syncedTeam.findIndex((pet, index) => (
        index !== activePetIndex && Number(pet?.hp ?? 0) > 0
    ));

    if (nextIndex < 0) {
        return { participant: syncedParticipant, switched: false, switchedPetName: null };
    }

    const nextPet = {
        ...syncedTeam[nextIndex],
        status: { ...(syncedTeam[nextIndex]?.status || {}) },
    };

    const nextTeam = syncedTeam.map((pet, index) => (
        index === nextIndex ? nextPet : pet
    ));

    const participatedWithNext = [
        ...new Set([
            ...participatedWithCurrent,
            nextPet.id,
        ].filter(Boolean)),
    ];

    return {
        participant: {
            ...participant,
            pet: nextPet,
            team: nextTeam,
            activePetIndex: nextIndex,
            activePetId: nextPet.id || null,
            participatedPetIds: participatedWithNext,
        },
        switched: true,
        switchedPetName: nextPet.name || '다음 펫',
    };
};

// M1_BATTLE_BGM_RANDOM_LOUD_PATCH

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



// M1_BATTLE_BG_INTRO_PATCH: 전투 시작 시 펫 등장 연출
const petIntroMine = keyframes`
  0% {
    opacity: 0;
    transform: translate(-90px, 35px) scale(0.72);
    filter: brightness(1.35) drop-shadow(0 0 0 rgba(255,255,255,0));
  }
  55% {
    opacity: 1;
    transform: translate(12px, -8px) scale(1.08);
    filter: brightness(1.18) drop-shadow(0 0 14px rgba(255,255,255,0.9));
  }
  75% {
    transform: translate(-4px, 4px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
    filter: brightness(1) drop-shadow(0 10px 10px rgba(0,0,0,0.1));
  }
`;

const petIntroOpponent = keyframes`
  0% {
    opacity: 0;
    transform: translate(90px, -35px) scale(0.72);
    filter: brightness(1.35) drop-shadow(0 0 0 rgba(255,255,255,0));
  }
  55% {
    opacity: 1;
    transform: translate(-12px, 8px) scale(1.08);
    filter: brightness(1.18) drop-shadow(0 0 14px rgba(255,255,255,0.9));
  }
  75% {
    transform: translate(4px, -4px) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
    filter: brightness(1) drop-shadow(0 10px 10px rgba(0,0,0,0.1));
  }
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

const waterBallRight = keyframes`
  0% { transform: translateX(0) scale(1); }
  20% { transform: translateX(-15px) scale(0.9); }
  50% { transform: translateX(30px) scale(1.1); filter: brightness(1.5) drop-shadow(0 0 15px #4dabf7); }
  100% { transform: translateX(0) scale(1); }
`;
const waterBallLeft = keyframes`
  0% { transform: translateX(0) scale(1); }
  20% { transform: translateX(15px) scale(0.9); }
  50% { transform: translateX(-30px) scale(1.1); filter: brightness(1.5) drop-shadow(0 0 15px #4dabf7); }
  100% { transform: translateX(0) scale(1); }
`;

const counterStanceRight = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); }
  50% { transform: translateX(-5px) scale(1.05); filter: brightness(1.8) drop-shadow(0 0 20px #ffe066); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
const counterStanceLeft = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); }
  50% { transform: translateX(5px) scale(1.05); filter: brightness(1.8) drop-shadow(0 0 20px #ffe066); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;

const ultimateSecretRight = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); opacity: 1; }
  15% { transform: translateX(-20px) scale(0.8); opacity: 0.5; }
  30% { transform: translateX(150px) scale(1.2); opacity: 1; filter: brightness(3) drop-shadow(0 0 30px #f8f9fa); }
  50% { transform: translateX(200px) scale(1.4) rotate(15deg); filter: brightness(4) drop-shadow(0 0 40px #fff); }
  70% { transform: translateX(150px) scale(1.2) rotate(-5deg); filter: brightness(2); }
  100% { transform: translateX(0) scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
`;
const ultimateSecretLeft = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); opacity: 1; }
  15% { transform: translateX(20px) scale(0.8); opacity: 0.5; }
  30% { transform: translateX(-150px) scale(1.2); opacity: 1; filter: brightness(3) drop-shadow(0 0 30px #f8f9fa); }
  50% { transform: translateX(-200px) scale(1.4) rotate(-15deg); filter: brightness(4) drop-shadow(0 0 40px #fff); }
  70% { transform: translateX(-150px) scale(1.2) rotate(5deg); filter: brightness(2); }
  100% { transform: translateX(0) scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
`;

const reedBowRight = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); }
  25% { transform: translateX(-25px) scale(0.95); filter: brightness(1.2); }
  50% { transform: translateX(-25px) scale(1.05); filter: brightness(2) drop-shadow(0 0 20px #8ce99a); }
  75% { transform: translateX(15px) scale(1.1); filter: brightness(1.5); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;
const reedBowLeft = keyframes`
  0% { transform: translateX(0) scale(1); filter: brightness(1); }
  25% { transform: translateX(25px) scale(0.95); filter: brightness(1.2); }
  50% { transform: translateX(25px) scale(1.05); filter: brightness(2) drop-shadow(0 0 20px #8ce99a); }
  75% { transform: translateX(-15px) scale(1.1); filter: brightness(1.5); }
  100% { transform: translateX(0) scale(1); filter: brightness(1); }
`;

const previewStyleSkillRight = keyframes`
  0% { transform: translate(0, 0) scale(1); filter: brightness(1); }
  18% { transform: translate(-28px, 14px) scale(0.9); filter: brightness(1.05); }
  42% { transform: translate(75px, -38px) scale(1.16); filter: brightness(1.9) drop-shadow(0 0 20px #74c0fc); }
  62% { transform: translate(115px, -18px) scale(1.22) rotate(4deg); filter: brightness(2.3) drop-shadow(0 0 24px #4dabf7); }
  78% { transform: translate(45px, -4px) scale(1.08); filter: brightness(1.45); }
  100% { transform: translate(0, 0) scale(1); filter: brightness(1); }
`;

const previewStyleSkillLeft = keyframes`
  0% { transform: translate(0, 0) scale(1); filter: brightness(1); }
  18% { transform: translate(28px, 14px) scale(0.9); filter: brightness(1.05); }
  42% { transform: translate(-75px, -38px) scale(1.16); filter: brightness(1.9) drop-shadow(0 0 20px #74c0fc); }
  62% { transform: translate(-115px, -18px) scale(1.22) rotate(-4deg); filter: brightness(2.3) drop-shadow(0 0 24px #4dabf7); }
  78% { transform: translate(-45px, -4px) scale(1.08); filter: brightness(1.45); }
  100% { transform: translate(0, 0) scale(1); filter: brightness(1); }
`;

// --- UI Components ---
const ProfileWrapper = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 5;
`;

const OpponentProfileWrapper = styled(ProfileWrapper)`
  /* M2_STATUS_PANEL_VERTICAL_SWAP_PATCH: 상대 상태창을 오른쪽 아래로 이동 */
  right: 20px;
  bottom: 20px;
  flex-direction: row-reverse;
  z-index: 12;

  @media (max-width: 768px) {
    right: 10px;
    bottom: 10px;
  }
`;

const MyProfileWrapper = styled(ProfileWrapper)`
  /* M2_STATUS_PANEL_VERTICAL_SWAP_PATCH: 내 상태창을 왼쪽 위로 이동 */
  left: 20px;
  top: 20px;
  flex-direction: row;
  z-index: 12;

  @media (max-width: 768px) {
    left: 10px;
    top: 10px;
  }
`;

const AvatarBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  .avatar-img-frame {
    width: 65px;
    height: 65px;
    border-radius: 16px;
    border: 3px solid white;
    background-color: #f1f3f5;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    overflow: hidden;
    position: relative;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  img.avatar-snapshot {
    object-fit: contain;
    transform: scale(1.5) translateY(10%);
  }

  .name-badge {
    font-size: 0.8rem;
    font-weight: 800;
    color: white;
    padding: 4px 10px;
    border-radius: 12px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    white-space: nowrap;
  }

  .name-badge.mine { background-color: #339af0; }
  .name-badge.opponent { background-color: #fa5252; }

  @media (max-width: 768px) {
    .avatar-img-frame { width: 50px; height: 50px; border-radius: 12px; }
    .name-badge { font-size: 0.7rem; padding: 3px 8px; }
  }
`;

const InfoBox = styled.div`
  width: 240px; 
  padding: 1rem; 
  border: 2px solid;
  border-radius: 16px; 
  background-color: rgba(255,255,255,0.9); 
  backdrop-filter: blur(5px);
  display: flex; 
  flex-direction: column; 
  gap: 0.5rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  
  span { font-weight: 800; color: #343a40; font-size: 1.05rem; margin-bottom: 0.2rem; }
  @media (max-width: 768px) { width: 170px; padding: 0.8rem; span { font-size: 0.9rem; } }
`;
const MyInfoBox = styled(InfoBox)` border-color: #339af0; `;
const OpponentInfoBox = styled(InfoBox)` border-color: #fa5252; `;

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
  height: 550px;
  position: relative;
  margin-bottom: 2rem;
  overflow: visible;
  border-radius: 20px;
  border: 3px solid #8ce99a;
  background:
    linear-gradient(
      to bottom,
      #a5d8ff 0%,
      #d0ebff 38%,
      #b2f2bb 39%,
      #8ce99a 100%
    );
  box-shadow:
    inset 0 0 0 4px rgba(255,255,255,0.45),
    inset 0 -18px 0 rgba(47, 158, 68, 0.18),
    0 8px 20px rgba(0,0,0,0.08);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
        border-radius: 17px;
opacity: 0.45;
    background-image:
      linear-gradient(rgba(255,255,255,0.42) 2px, transparent 2px),
      linear-gradient(90deg, rgba(255,255,255,0.32) 2px, transparent 2px);
    background-size: 24px 24px;
    image-rendering: pixelated;
    z-index: 0;
  }

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 38px;
    width: 78%;
    height: 120px;
    transform: translateX(-50%);
    border-radius: 50%;
    background:
      repeating-linear-gradient(
        0deg,
        rgba(43, 138, 62, 0.22) 0 8px,
        rgba(81, 207, 102, 0.22) 8px 16px
      );
    border: 4px solid rgba(47, 158, 68, 0.35);
    box-shadow:
      inset 0 0 0 6px rgba(255,255,255,0.25),
      0 12px 0 rgba(47, 158, 68, 0.15);
    z-index: 0;
  }

  > * {
    z-index: 1;
  }
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
                                                        props.$animType === 'WATER_BALL' ? css`${props.$isMine ? waterBallRight : waterBallLeft} 1.2s ease-in-out` :
                                                            props.$animType === 'COUNTER_STANCE' ? css`${props.$isMine ? counterStanceRight : counterStanceLeft} 1.0s ease-in-out` :
                                                                props.$animType === 'ULTIMATE_SECRET' ? css`${props.$isMine ? ultimateSecretRight : ultimateSecretLeft} 2.2s ease-in-out` :
                                                                    props.$animType === 'REED_BOW' ? css`${props.$isMine ? reedBowRight : reedBowLeft} 1.5s ease-in-out` :
                                                                        props.$animType ? css`${props.$isMine ? previewStyleSkillRight : previewStyleSkillLeft} 1.15s ease-in-out` :
                                                                            props.$intro ? css`${props.$isMine ? petIntroMine : petIntroOpponent} 1.05s cubic-bezier(.18,.89,.32,1.28)` :
                                                                                    'none'};
  display: flex; flex-direction: column; align-items: center;
`;

const PetImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: ${props => props.$isFainted
        ? 'grayscale(100%) brightness(0.75)'
        : 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))'};
  opacity: ${props => props.$isFainted ? 0.55 : 1};
  transform: ${props => props.$isFainted ? 'translateY(18px) rotate(-4deg) scale(0.92)' : 'none'};
  transition: filter 0.3s, opacity 0.3s, transform 0.35s ease;
`;

const QuizArea = styled.div`
  padding: 1.5rem; background-color: #fff; border: 2px solid #339af0;
  border-radius: 20px; display: grid; grid-template-columns: 1fr 320px;
  gap: 2rem; min-height: 220px; box-shadow: 0 4px 15px rgba(51, 154, 240, 0.1);
  
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const LogText = styled.p` 
  font-size: 1.3rem; font-weight: 700; min-height: 60px; margin: 0 0 1rem 0; color: #343a40;
  display: flex; align-items: center; white-space: pre-line;
`;

// M19_RIGHT_ACTION_QUIZ_PANEL_PATCH
const BattlePrompt = styled.h3`
  margin: 0.75rem 0 0;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  color: #212529;
  font-size: 1.15rem;
  line-height: 1.5;
`;

const RightActionPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  align-self: stretch;
`;

const RightTaskCard = styled.div`
  padding: 0.95rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  color: #343a40;
  font-weight: 900;
  text-align: center;
  line-height: 1.5;
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
    font-size: 3.5rem; font-weight: 900;
    color: ${props => props.$variant === 'switch' ? '#5f3dc4' : '#ff6b6b'};
    background-color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem 2rem; border-radius: 30px;
    border: 4px solid ${props => props.$variant === 'switch' ? '#7950f2' : '#ff6b6b'};
    z-index: 10;
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

const SWITCH_RESUME_DELAY_MS = 2200;
const SWITCH_CHOICE_LIMIT_MS = 10000;

function BattlePage() {
    const { opponentId } = useParams();
    const navigate = useNavigate();
    const { players, processBattleResults, processBattleDraw } = useLeagueStore();
    const { classId } = useClassStore();
    const myPlayerData = useMemo(() => players.find(p => p.authUid === auth.currentUser?.uid), [players]);
    const battleId = useMemo(() => [myPlayerData?.id, opponentId].sort().join('_'), [myPlayerData, opponentId]);

    const [battleState, setBattleState] = useState(null);
    // M18B_RESULT_SUMMARY_LOCAL_FALLBACK_V3_PATCH
    // resultSummary가 Firestore snapshot으로 늦게 들어와도 결과창에 즉시 표시하기 위한 로컬 fallback
    const [localResultSummary, setLocalResultSummary] = useState(null); // M18H_MINIMAL_RESULT_SUMMARY_SAVE_PATCH
    const [timeLeft, setTimeLeft] = useState(20);
    const [answer, setAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

            const [bgmEnabled, setBgmEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('battleBgmEnabled');
        return saved === null ? true : saved === 'true';
    });
const [introActive, setIntroActive] = useState(false);
    const introPlayedRef = useRef(false);
    // M5_SWITCH_INTRO_PATCH
    const [switchIntro, setSwitchIntro] = useState({ my: false, opponent: false });
    const [switchMessage, setSwitchMessage] = useState('');
    const prevActivePetIdsRef = useRef({ my: null, opponent: null });
    const switchIntroTimerRef = useRef(null);
    const switchMessageTimerRef = useRef(null);
const [hitState, setHitState] = useState({ my: false, opponent: false });
    const [animState, setAnimState] = useState({ my: null, opponent: null });
    const [currentEffect, setCurrentEffect] = useState(null);
    const [dotEffect, setDotEffect] = useState(null);

    const [shuffledOptions, setShuffledOptions] = useState([]);
    const [battleScale, setBattleScale] = useState(() => {
        const saved = typeof window !== 'undefined' && localStorage.getItem('battleScale');
        return saved ? parseFloat(saved) : 1.0;
    });

    // 퀴즈 타입에 따른 OX 판별 변수 최상단으로 분리
    const qType = battleState?.question?.type ? String(battleState.question.type).toLowerCase() : '';
    const qAns = battleState?.question?.answer ? String(battleState.question.answer).toUpperCase() : '';
    const hasOptions = battleState?.question?.options && battleState.question.options.length > 0;
    const isOXAnswer = (qAns === 'O' || qAns === 'X' || qAns === '○' || qAns === '×') && !hasOptions;
    const isOXOptions = shuffledOptions.length === 2 && shuffledOptions.every(o => o === 'O' || o === 'X' || o === '○' || o === '×');
    const isOX = qType === 'ox' || isOXAnswer || isOXOptions;

    useEffect(() => {
        const opts = battleState?.question?.options;
        if (!opts || opts.length === 0) { setShuffledOptions([]); return; }
        const isOXOpt = opts.length === 2 && opts.every(o => o === 'O' || o === 'X' || o === '○' || o === '×');
        if (isOXOpt) {
            setShuffledOptions(['O', 'X']);
        } else {
            setShuffledOptions([...opts].sort(() => Math.random() - 0.5));
        }
    }, [battleState?.question?.question]);

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

    // 한 번 낸 문제가 다시 나오지 않도록 퀴즈를 섞어서 뽑는 헬퍼 함수
    const getNextQuizObj = (usedQuestions = []) => {
        if (!quizPool || quizPool.length === 0) return { question: "퀴즈 로딩 중...", answer: "1" };
        let available = quizPool.filter(q => !usedQuestions.includes(q.question));
        if (available.length === 0) {
            // 모든 퀴즈가 소모되었으면 쿨타임 초기화
            available = quizPool;
        }
        return available[Math.floor(Math.random() * available.length)];
    };

    const buildNextQuizUpdate = (data, nextQuiz, now = Date.now()) => ({
        question: nextQuiz,
        usedQuestions: [...(data.usedQuestions || []), nextQuiz.question],
        turnStartTime: now,
        chat: {},
        pendingNextQuestion: null,
        pendingUsedQuestions: null,
        switchResumeAt: null,
        pendingSwitch: null,
    });

    const buildSwitchPauseUpdate = (data, nextQuiz, now = Date.now()) => ({
        // M8_SWITCH_PAUSE_RESUME_PATCH
        // 펫 교체 직후에는 바로 다음 문제를 띄우지 않고, 짧은 교체 안내 시간을 둡니다.
        question: null,
        pendingNextQuestion: nextQuiz,
        pendingUsedQuestions: [...(data.usedQuestions || []), nextQuiz.question],
        turnStartTime: now,
        switchResumeAt: now + SWITCH_RESUME_DELAY_MS,
        pendingSwitch: null,
        chat: {},
    });

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
        if (!battleState) return;

        const isBattleVisible =
            battleState.status !== 'pending' &&
            battleState.status !== 'starting';

        if (!isBattleVisible || introPlayedRef.current) return;

        introPlayedRef.current = true;
        setIntroActive(true);

        const timer = setTimeout(() => {
            setIntroActive(false);
        }, 1150);

        return () => clearTimeout(timer);
    }, [battleState?.status]);


    // M1_BATTLE_BGM_PATCH: 배틀 BGM ON/OFF 및 화면 이탈 시 정지
    useEffect(() => {
        if (!battleState) {
            stopBattleBgm();
            return;
        }

        const shouldPlayBgm =
            bgmEnabled &&
            battleState.status !== 'pending' &&
            battleState.status !== 'starting' &&
            battleState.status !== 'finished' &&
            battleState.status !== 'rejected' &&
            battleState.status !== 'cancelled';

        if (shouldPlayBgm) {
            startBattleBgm('random');
        } else {
            stopBattleBgm();
        }
    }, [bgmEnabled, battleState?.status]);

    useEffect(() => {
        return () => stopBattleBgm();
    }, []);

    const handleToggleBgm = () => {
        const next = !bgmEnabled;
        setBgmEnabled(next);
        localStorage.setItem('battleBgmEnabled', String(next));

        if (next) {
            startBattleBgm('random');
        } else {
            stopBattleBgm();
        }
    };


    useEffect(() => {
        // M5_SWITCH_INTRO_PATCH
        // 자동 교체로 activePetId가 바뀌면 새 펫 등장 애니메이션을 재생합니다.
        if (!battleState || !myPlayerData) return;

        const status = battleState.status;
        const iAmChallenger = myPlayerData.id === battleState.challenger?.id;
        const myRole = iAmChallenger ? 'challenger' : 'opponent';
        const opponentRole = iAmChallenger ? 'opponent' : 'challenger';

        const myParticipant = battleState[myRole];
        const opponentParticipant = battleState[opponentRole];

        const nextIds = {
            my: myParticipant?.activePetId || myParticipant?.pet?.id || null,
            opponent: opponentParticipant?.activePetId || opponentParticipant?.pet?.id || null,
        };

        const prevIds = prevActivePetIdsRef.current || { my: null, opponent: null };

        if (status === 'pending' || status === 'starting' || status === 'finished') {
            prevActivePetIdsRef.current = nextIds;
            return;
        }

        const changedMy = Boolean(prevIds.my && nextIds.my && prevIds.my !== nextIds.my);
        const changedOpponent = Boolean(prevIds.opponent && nextIds.opponent && prevIds.opponent !== nextIds.opponent);

        if (changedMy || changedOpponent) {
            const nextIntro = {
                my: changedMy,
                opponent: changedOpponent,
            };

            setSwitchIntro(nextIntro);

            const messages = [];
            if (changedMy) {
                messages.push(`나의 다음 펫 ${myParticipant?.pet?.name || ''} 등장!`);
            }
            if (changedOpponent) {
                messages.push(`상대의 다음 펫 ${opponentParticipant?.pet?.name || ''} 등장!`);
            }

            setSwitchMessage(messages.join(' '));

            clearTimeout(switchIntroTimerRef.current);
            clearTimeout(switchMessageTimerRef.current);

            switchIntroTimerRef.current = setTimeout(() => {
                setSwitchIntro({ my: false, opponent: false });
            }, 1200);

            switchMessageTimerRef.current = setTimeout(() => {
                setSwitchMessage('');
            }, 1800);
        }

        prevActivePetIdsRef.current = nextIds;
    }, [
        battleState?.status,
        battleState?.challenger?.activePetId,
        battleState?.opponent?.activePetId,
        battleState?.challenger?.pet?.id,
        battleState?.opponent?.pet?.id,
        myPlayerData?.id,
    ]);

    useEffect(() => {
        // M8_SWITCH_PAUSE_RESUME_PATCH
        // status가 switching일 때는 퀴즈 타이머를 멈추고, 교체 안내 시간이 지난 뒤 다음 문제를 시작합니다.
        if (!battleState || !myPlayerData || !classId) return;
        if (battleState.status !== 'switching') return;

        const iAmChallenger = myPlayerData.id === battleState.challenger?.id;
        if (!iAmChallenger) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const resumeAt = Number(battleState.switchResumeAt || Date.now() + SWITCH_RESUME_DELAY_MS);
        const delayMs = Math.max(0, resumeAt - Date.now());

        const timer = setTimeout(async () => {
            try {
                await runTransaction(db, async (transaction) => {
                    const battleDoc = await transaction.get(battleRef);
                    if (!battleDoc.exists()) return;

                    const data = battleDoc.data();
                    if (data.status !== 'switching') return;

                    const nextQuiz = data.pendingNextQuestion || getNextQuizObj(data.usedQuestions || []);
                    const usedQuestions = Array.isArray(data.pendingUsedQuestions)
                        ? data.pendingUsedQuestions
                        : [...(data.usedQuestions || []), nextQuiz.question];

                    transaction.update(battleRef, {
                        status: 'quiz',
                        question: nextQuiz,
                        usedQuestions,
                        turnStartTime: Date.now(),
                        turn: null,
                        attackerAction: null,
                        attackerActionPayload: null,
                        defenderAction: null,
                        pendingNextQuestion: null,
                        pendingUsedQuestions: null,
                        switchResumeAt: null,
                        pendingSwitch: null,
                        chat: {},
                    });
                });
            } catch (error) {
                console.error('Switch pause resume error:', error);
            }
        }, delayMs);

        return () => clearTimeout(timer);
    }, [
        battleState?.status,
        battleState?.switchResumeAt,
        battleState?.pendingNextQuestion?.question,
        battleState?.challenger?.id,
        myPlayerData?.id,
        classId,
        battleId,
    ]);

    useEffect(() => {
        // M10_FAINTED_SWITCH_CHOICE_PATCH
        // 쓰러진 뒤 다음 펫 선택 상태에서는 퀴즈/행동 타이머와 다른 보라색 10초 타이머를 사용합니다.
        if (!battleState || !myPlayerData || !classId) return;
        if (battleState.status !== 'pending_switch') return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger?.id;
        const expiresAt = Number(
            battleState.pendingSwitch?.expiresAt ||
            ((battleState.pendingSwitch?.createdAt || battleState.turnStartTime || Date.now()) + SWITCH_CHOICE_LIMIT_MS)
        );

        const updateSwitchTimer = () => {
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            setTimeLeft(remaining);
            return remaining;
        };

        updateSwitchTimer();

        const interval = setInterval(() => {
            const remaining = updateSwitchTimer();

            if (remaining > 0) return;
            clearInterval(interval);

            // 자동 선택 처리는 방장(challenger) 브라우저 하나만 담당합니다.
            if (!iAmChallenger) return;

            runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return;

                const data = battleDoc.data();
                if (data.status !== 'pending_switch') return;

                const roles = Array.isArray(data.pendingSwitch?.roles)
                    ? data.pendingSwitch.roles
                    : [];

                if (roles.length === 0) return;

                const nextQuiz = data.pendingNextQuestion || getNextQuizObj(data.usedQuestions || []);
                const pendingUsedQuestions = Array.isArray(data.pendingUsedQuestions)
                    ? data.pendingUsedQuestions
                    : [...(data.usedQuestions || []), nextQuiz.question];

                const updateData = {};
                const autoLogs = [];

                roles.forEach(role => {
                    const selected = applyPendingSwitchSelection(data[role]);
                    if (!selected?.participant) return;

                    updateData[role] = selected.participant;
                    autoLogs.push(`⏰ 시간 초과! ${selected.participant.name}의 ${selected.selectedPetName}이(가) 자동으로 등장!`);
                });

                transaction.update(battleRef, {
                    ...updateData,
                    status: 'switching',
                    question: null,
                    pendingNextQuestion: nextQuiz,
                    pendingUsedQuestions,
                    switchResumeAt: Date.now() + SWITCH_RESUME_DELAY_MS,
                    pendingSwitch: null,
                    turnStartTime: Date.now(),
                    turn: null,
                    attackerAction: null,
                    attackerActionPayload: null,
                    defenderAction: null,
                    chat: {},
                    log: [data.log, ...autoLogs].filter(Boolean).join(' '),
                });
            }).catch(error => {
                console.error('Pending switch timeout error:', error);
            });
        }, 250);

        return () => clearInterval(interval);
    }, [
        battleState?.status,
        battleState?.pendingSwitch?.expiresAt,
        battleState?.pendingSwitch?.roles?.join('|'),
        battleState?.turnStartTime,
        battleState?.challenger?.id,
        myPlayerData?.id,
        classId,
        battleId,
    ]);

    // --- 속성별 타격음 리스너 (불/전기/바람/베기 등 actionType에 맞는 임팩트음) ---
    useEffect(() => {
        const actionType = animState.my || animState.opponent || currentEffect?.type || null;
        if (hitState.my || hitState.opponent) {
            playHitSound(actionType);
        }
    }, [hitState.my, hitState.opponent]);

    // --- 속성별 스킬 발동음 리스너 (애니메이션이 시작되는 시점) ---
    useEffect(() => {
        const actionType = animState.my || animState.opponent;
        if (actionType) {
            playSkillSound(actionType);
        }
    }, [animState.my, animState.opponent]);

    // --- 방어/버프류 스킬(애니메이션 state 없이 currentEffect만 설정되는 액션)의 발동음 ---
    useEffect(() => {
        if (currentEffect?.type && !animState.my && !animState.opponent) {
            playSkillSound(currentEffect.type);
        }
    }, [currentEffect]);

    useEffect(() => {
        if (!battleState || !myPlayerData) return;

        const battleRef = doc(db, 'classes', classId, 'battles', battleId);
        const iAmChallenger = myPlayerData.id === battleState.challenger.id;

        clearTimeout(timeoutRef.current);
        clearInterval(timerRef.current);

        if (iAmChallenger && battleState.status === 'starting') {
            timeoutRef.current = setTimeout(() => {
                const randomQuiz = getNextQuizObj([]);
                updateDoc(battleRef, {
                    status: 'quiz',
                    log: "대결 시작! 퀴즈를 풀어 선공을 차지하세요!",
                    question: randomQuiz,
                    usedQuestions: [randomQuiz.question],
                    turnStartTime: Date.now(),
                    turn: null,
                    attackerAction: null,
                    defenderAction: null,
                    chat: {}
                });
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

                const limitMs = limitSeconds * 1000;
                const timeoutBufferMs = 800;

                // 턴 자동 진행은 방장(challenger) 브라우저 하나만 담당합니다.
                // 양쪽 브라우저가 동시에 시간초과를 처리하면 공격/방어 선택 전에 턴이 넘어가는 레이스가 생길 수 있습니다.
                if (elapsed > limitMs + timeoutBufferMs) {
                    clearInterval(timerRef.current);

                    if (!iAmChallenger) return;

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

                if (actionType === 'SWITCH_PET') {
                    const switchName = battleState.turn === myPlayerData.id
                        ? myInfo?.pet?.name
                        : opponentInfo?.pet?.name;

                    setSwitchMessage(`🔁 ${switchName || '다음 펫'} 등장!`);
                    setSwitchIntro(prev => ({
                        ...prev,
                        [isAttackerMe ? 'my' : 'opponent']: true,
                    }));

                    clearTimeout(switchIntroTimerRef.current);
                    clearTimeout(switchMessageTimerRef.current);

                    switchIntroTimerRef.current = setTimeout(() => {
                        setSwitchIntro({ my: false, opponent: false });
                    }, 1200);

                    switchMessageTimerRef.current = setTimeout(() => {
                        setSwitchMessage('');
                    }, 1800);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 900);

                } else if (actionType === 'TACKLE') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 600);

                } else if (actionType === 'WIND_BLADE') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1400);

                } else if (actionType === 'TORNADO_SWEEP') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 2200);

                } else if (actionType === 'QUICK_DISTURBANCE') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'ZIGZAG' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'ZIGZAG' }));
                    setCurrentEffect({ type: 'QUICK_DISTURBANCE', isMine: isAttackerMe });

                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 500);
                    setTimeout(() => {
                        setHitState({ my: false, opponent: false });
                    }, 700);
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 800);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1600);

                } else if (actionType === 'FLAME_DASH') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'FLAME_DASH' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'FLAME_DASH' }));
                    setCurrentEffect({ type: 'FLAME_DASH', isMine: isAttackerMe });

                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 420);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1300);

                } else if (actionType === 'THUNDER_PUNCH') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 900);

                } else if (actionType === 'THUNDERSTORM') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1800);

                } else if (actionType === 'UPHWA') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1900);

                } else if (actionType === 'SOLAR_BEAM') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1900);

                } else if (actionType === 'STELLAR_BLAST') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 2000);

                } else if (actionType === 'DRAGON_CLAW') {
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
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1200);

                } else if (actionType === 'WATER_BALL') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'WATER_BALL' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'WATER_BALL' }));
                    setCurrentEffect({ type: 'WATER_BALL', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 400);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1200);

                } else if (actionType === 'COUNTER_STANCE') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'COUNTER_STANCE' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'COUNTER_STANCE' }));
                    setCurrentEffect({ type: 'COUNTER_STANCE', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 500);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1000);

                } else if (actionType === 'ULTIMATE_SECRET') {
                    // M2_ULTIMATE_PREVIEW_SYNC_PATCH
                    // BattleSkillEffect의 오의필살 이펙트는 2.2초짜리입니다.
                    // 기존 1.6초 종료는 마지막 폭발/충격파를 잘라 먹어서 프리뷰보다 약하게 보였습니다.
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'ULTIMATE_SECRET' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'ULTIMATE_SECRET' }));

                    setCurrentEffect({ type: 'ULTIMATE_SECRET', isMine: isAttackerMe });

                    const triggerUltimateHit = () => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    };

                    const clearUltimateHit = () => {
                        setHitState({ my: false, opponent: false });
                    };

                    // 고속 참격 구간
                    setTimeout(triggerUltimateHit, 760);
                    setTimeout(clearUltimateHit, 900);

                    setTimeout(triggerUltimateHit, 1120);
                    setTimeout(clearUltimateHit, 1260);

                    // 거대 폭발/충격파 구간
                    setTimeout(triggerUltimateHit, 1640);
                    setTimeout(clearUltimateHit, 1900);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 2350);

                } else if (actionType === 'REED_BOW') {
                    if (isAttackerMe) setAnimState(prev => ({ ...prev, my: 'REED_BOW' }));
                    else setAnimState(prev => ({ ...prev, opponent: 'REED_BOW' }));
                    setCurrentEffect({ type: 'REED_BOW', isMine: isAttackerMe });
                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 750);
                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1500);

                } else {
                    if (isAttackerMe) {
                        setAnimState(prev => ({ ...prev, my: actionType }));
                    } else {
                        setAnimState(prev => ({ ...prev, opponent: actionType }));
                    }

                    setCurrentEffect({
                        type: actionType,
                        isMine: isAttackerMe
                    });

                    setTimeout(() => {
                        if (isAttackerMe) setHitState(prev => ({ ...prev, opponent: true }));
                        else setHitState(prev => ({ ...prev, my: true }));
                    }, 520);

                    setTimeout(() => {
                        setHitState({ my: false, opponent: false });
                    }, 820);

                    setTimeout(() => {
                        setCurrentEffect(null);
                        setAnimState({ my: null, opponent: null });
                        setHitState({ my: false, opponent: false });
                        setIsProcessing(false);
                        if (iAmChallenger) handleResolution(battleRef);
                    }, 1450);
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

    
    useEffect(() => {
        // M5_MANUAL_SWITCH_RESET_SUBMENU_V3
        // 행동 선택 상태를 벗어나면 교체/스킬/아이템 하위 메뉴를 닫습니다.
        if (!battleState || !myPlayerData) return;
        const isMyActionTurn =
            battleState.status === 'action' &&
            battleState.turn === myPlayerData.id &&
            !battleState.attackerAction;

        if (!isMyActionTurn && actionSubMenu) {
            setActionSubMenu(null);
        }
    }, [battleState?.status, battleState?.turn, battleState?.attackerAction, myPlayerData?.id]);

const handleCancel = async () => {
        if (!classId || !battleId) return;
        if (window.confirm("대결 신청을 취소하시겠습니까?")) {
            await cancelBattleChallenge(classId, battleId);
            goBack();
        }
    };

    const handleActionTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'action') return;
                const data = battleDoc.data();
                if (Date.now() - data.turnStartTime < 10800) return;

                const updates = {};
                if (!data.attackerAction) updates.attackerAction = 'TACKLE';

                const isChallengerTurn = data.turn === data.challenger.id;
                const defenderPet = isChallengerTurn ? data.opponent.pet : data.challenger.pet;

                if (!data.defenderAction) {
                    if (defenderPet.status?.bound) {
                        updates.defenderAction = 'BOUND';
                    } else if (defenderPet.status?.stunned) {
                        updates.defenderAction = 'STUNNED';
                    } else {
                        updates.defenderAction = 'BRACE';
                    }
                }

                if (Object.keys(updates).length > 0) transaction.update(battleRef, updates);
            });
        } catch (error) {
            console.error("Action timeout error:", error);
        } finally {
            setTimeout(() => setIsProcessing(false), 500);
        }
    };

    const handleTimeout = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status === 'finished' || data.status !== 'quiz') return null;
                if (Date.now() - data.turnStartTime < 15800) return null;

                let { challenger, opponent } = data;

                let damageChallenger = Math.max(1, Math.floor(challenger.pet.maxHp * 0.05));
                if (opponent.equippedTitle === 'daily_helper') damageChallenger *= 2;

                let damageOpponent = Math.max(1, Math.floor(opponent.pet.maxHp * 0.05));
                if (challenger.equippedTitle === 'daily_helper') damageOpponent *= 2;

                challenger.pet.hp = Math.max(0, challenger.pet.hp - damageChallenger);
                opponent.pet.hp = Math.max(0, opponent.pet.hp - damageOpponent);

                if (challenger.pet.status?.stunned) delete challenger.pet.status.stunned;
                if (opponent.pet.status?.stunned) delete opponent.pet.status.stunned;

                let switchMessages = [];

                const challengerSwitch = switchToNextAlivePetIfNeeded(challenger);
                challenger = challengerSwitch.participant;
                if (challengerSwitch.switched) {
                    switchMessages.push(`${challenger.name}의 다음 펫 ${challengerSwitch.switchedPetName}이(가) 등장!`);
                }

                const opponentSwitch = switchToNextAlivePetIfNeeded(opponent);
                opponent = opponentSwitch.participant;
                if (opponentSwitch.switched) {
                    switchMessages.push(`${opponent.name}의 다음 펫 ${opponentSwitch.switchedPetName}이(가) 등장!`);
                }

                const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                let winnerId = null;

                if (isFinished) {
                    if (challenger.pet.hp > 0) winnerId = challenger.id;
                    else if (opponent.pet.hp > 0) winnerId = opponent.id;
                }

                const nextQuiz = getNextQuizObj(data.usedQuestions);
                const hasSwitchPause = !isFinished && switchMessages.length > 0;
                const nextTurnUpdate = hasSwitchPause
                    ? buildSwitchPauseUpdate(data, nextQuiz)
                    : buildNextQuizUpdate(data, nextQuiz);

                const baseLog = isFinished
                    ? `⏳ 시간 초과! 펫이 지쳐 쓰러졌습니다! (정답: ${data.question.answer})`
                    : `⏳ 시간 초과! 서로 눈치만 보다가 체력이 감소했습니다! (정답: ${data.question.answer})`;

                const updateData = {
                    challenger: syncBattleParticipantActivePet(challenger),
                    opponent: syncBattleParticipantActivePet(opponent),
                    log: switchMessages.length > 0
                        ? `${baseLog} ${switchMessages.join(' ')}`
                        : baseLog,
                    status: isFinished ? 'finished' : hasSwitchPause ? 'switching' : 'quiz',
                    winner: winnerId,
                    attackerAction: null,
                    defenderAction: null,
                    turn: null,
                    ...(!isFinished && nextTurnUpdate)
                };
                transaction.update(battleRef, updateData);
                return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
            });

                        if (result && result.isFinished) {
                // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH
                // team 전체 HP/SP는 저장하되, 경험치/전적은 실제 출전 펫에게만 적용합니다.
                const winnerParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalChallenger
                    : result.finalOpponent;
            
                const loserParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent
                    : result.finalChallenger;
            
                const winnerPet = winnerParticipant.pet;
                const loserPet = loserParticipant.pet;
                const loserId = loserParticipant.id;
            
                const resultSummary = await processBattleResults(
                    classId,
                    result.winnerId,
                    loserId,
                    false,
                    winnerPet,
                    loserPet,
                    winnerParticipant.team || [winnerPet],
                    loserParticipant.team || [loserPet],
                    winnerParticipant.participatedPetIds || null,
                    loserParticipant.participatedPetIds || null
                );

                if (resultSummary) {
                    setLocalResultSummary(resultSummary);
                    await updateDoc(battleRef, { resultSummary });
                }
            }
        } catch (error) {
            console.error("Timeout handling error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const processQuizAnswer = async (submittedAnswer) => {
        if (!battleState.question || !submittedAnswer || isProcessing) return;

        // 제출된 답과 무관하게 데이터의 속성을 기준으로 판별
        const qType = battleState.question.type ? String(battleState.question.type).toLowerCase() : '';
        const qAns = battleState.question.answer ? String(battleState.question.answer).toUpperCase() : '';
        const hasOpts = battleState.question.options && battleState.question.options.length > 0;
        const isOXAns = (qAns === 'O' || qAns === 'X' || qAns === '○' || qAns === '×') && !hasOpts;
        const isQuestionObjective = hasOpts || qType === 'ox' || isOXAns;

        if (isQuestionObjective && battleState.chat?.[myPlayerData.id]) return;

        setIsProcessing(true);
        const filteredAnswer = filterProfanity(submittedAnswer);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleRef = doc(db, 'classes', classId, 'battles', battleId);
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists() || battleDoc.data().status !== 'quiz') return null;

                const data = battleDoc.data();
                const myId = myPlayerData.id;

                // 트랜잭션 내에서 최신 데이터로 객관식 여부 재판별
                const txQType = data.question.type ? String(data.question.type).toLowerCase() : '';
                const txQAns = data.question.answer ? String(data.question.answer).toUpperCase() : '';
                const txHasOpts = data.question.options && data.question.options.length > 0;
                const txIsOXAns = (txQAns === 'O' || txQAns === 'X' || txQAns === '○' || txQAns === '×') && !txHasOpts;
                const txIsQuestionObjective = txHasOpts || txQType === 'ox' || txIsOXAns;

                if (txIsQuestionObjective && data.chat && data.chat[myId]) return null;

                const isChallenger = myId === data.challenger.id;
                const myRole = isChallenger ? 'challenger' : 'opponent';
                const opponentRole = isChallenger ? 'opponent' : 'challenger';
                const opponentId = data[opponentRole].id;
                const opponentChat = data.chat?.[opponentId];
                const opponentIsStunned = data[opponentRole].pet.status?.stunned;

                const myPet = data[myRole].pet;
                const normalizeAns = (s) => (s || '').replace('○', 'O').replace('×', 'X').trim().toLowerCase();
                const txIsCorrect = normalizeAns(filteredAnswer) === normalizeAns(data.question.answer);
                const myChatEntry = { text: filteredAnswer, isCorrect: txIsCorrect, timestamp: Date.now() };
                const updatedChat = { ...(data.chat || {}), [myId]: myChatEntry };

                if (txIsCorrect) {
                    const winnerId = myPlayerData.id;
                    let newStatus = { ...myPet.status };

                    if (newStatus.recharging) {
                        delete newStatus.recharging;
                        const nextQuiz = getNextQuizObj(data.usedQuestions);

                        transaction.update(battleRef, {
                            status: 'quiz',
                            turn: null,
                            [myRole]: syncBattleParticipantActivePet({ ...data[myRole], pet: { ...data[myRole].pet, status: newStatus } }),
                            log: `🎉 정답! ${myPet.name}은(는) 숨을 고르며 반동을 회복했습니다. (정답: ${data.question.answer})`,
                            question: nextQuiz,
                            usedQuestions: [...(data.usedQuestions || []), nextQuiz.question],
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    } else {
                        transaction.update(battleRef, {
                            status: 'action',
                            turn: winnerId,
                            log: `🎉 정답! ${myPet.name}의 행동 선택! (정답: ${data.question.answer})`,
                            question: null,
                            turnStartTime: Date.now(),
                            chat: {}
                        });
                    }
                    return null;
                } else {
                    let shouldEndTurn = false;

                    if (txIsQuestionObjective) {
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

                        let switchMessages = [];

                const challengerSwitch = switchToNextAlivePetIfNeeded(challenger);
                challenger = challengerSwitch.participant;
                if (challengerSwitch.switched) {
                    switchMessages.push(`${challenger.name}의 다음 펫 ${challengerSwitch.switchedPetName}이(가) 등장!`);
                }

                const opponentSwitch = switchToNextAlivePetIfNeeded(opponent);
                opponent = opponentSwitch.participant;
                if (opponentSwitch.switched) {
                    switchMessages.push(`${opponent.name}의 다음 펫 ${opponentSwitch.switchedPetName}이(가) 등장!`);
                }

                const isFinished = challenger.pet.hp <= 0 || opponent.pet.hp <= 0;
                let winnerId = null;

                if (isFinished) {
                    if (challenger.pet.hp > 0) winnerId = challenger.id;
                    else if (opponent.pet.hp > 0) winnerId = opponent.id;
                }

                const nextQuiz = getNextQuizObj(data.usedQuestions);
                const hasSwitchPause = !isFinished && switchMessages.length > 0;
                const nextTurnUpdate = hasSwitchPause
                    ? buildSwitchPauseUpdate(data, nextQuiz)
                    : buildNextQuizUpdate(data, nextQuiz);

                        let logMessage = `❌ 둘 다 오답! 서로 틀려서 데미지를 입었습니다. (정답: ${data.question.answer})`;
                        if (opponent.equippedTitle === 'daily_helper' || challenger.equippedTitle === 'daily_helper') {
                            logMessage = `💥 [일타강사 패시브] 오답 페널티가 2배로 증폭되었습니다! (정답: ${data.question.answer})`;
                        }
                        if (typeof switchMessages !== 'undefined' && switchMessages.length > 0) {
                            logMessage += ` ${switchMessages.join(' ')}`;
                        }

                        const updateData = {
                            challenger: syncBattleParticipantActivePet(challenger),
                            opponent: syncBattleParticipantActivePet(opponent),
                            log: logMessage,
                            status: isFinished ? 'finished' : hasSwitchPause ? 'switching' : 'quiz',
                            winner: winnerId,
                            turn: null,
                            ...(!isFinished && nextTurnUpdate)
                        };
                        transaction.update(battleRef, updateData);

                        if (isFinished) {
                            return { isFinished, winnerId, finalChallenger: updateData.challenger, finalOpponent: updateData.opponent };
                        }
                    } else {
                        const opponentTitle = data[opponentRole].equippedTitle;

                        if (opponentTitle === 'daily_helper') {
                            let damage = Math.max(1, Math.floor(myPet.maxHp * 0.05));
                            myPet.hp = Math.max(0, myPet.hp - damage);
                            const isFinished = myPet.hp <= 0;

                            if (isFinished) {
                                let { challenger, opponent } = data;
                                challenger.pet = myRole === 'challenger' ? myPet : data.challenger.pet;
                                opponent.pet = myRole === 'opponent' ? myPet : data.opponent.pet;

                                transaction.update(battleRef, {
                                    challenger: syncBattleParticipantActivePet(challenger),
                                    opponent: syncBattleParticipantActivePet(opponent),
                                    chat: updatedChat,
                                    log: `💥 팩트 폭력! ${myPlayerData.name}님이 일타강사의 지적을 버티지 못하고 쓰러졌습니다! (정답: ${data.question.answer})`,
                                    status: 'finished',
                                    winner: opponentId,
                                    turn: null
                                });
                                return { isFinished: true, winnerId: opponentId, finalChallenger: challenger, finalOpponent: opponent };
                            } else {
                                transaction.update(battleRef, {
                                    chat: updatedChat,
                                    [myRole]: syncBattleParticipantActivePet({ ...data[myRole], pet: myPet }),
                                    log: `💥 [일타강사 압박] 틀렸습니다! 날카로운 지적에 데미지를 입었습니다! (-5%)`
                                });
                            }
                        } else {
                            transaction.update(battleRef, {
                                chat: updatedChat,
                                log: `${myPlayerData.name} 오답! (다시 시도하세요)`
                            });
                        }
                    }
                    return null;
                }
            });

                        if (result && result.isFinished) {
                // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH
                // team 전체 HP/SP는 저장하되, 경험치/전적은 실제 출전 펫에게만 적용합니다.
                const winnerParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalChallenger
                    : result.finalOpponent;
            
                const loserParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent
                    : result.finalChallenger;
            
                const winnerPet = winnerParticipant.pet;
                const loserPet = loserParticipant.pet;
                const loserId = loserParticipant.id;
            
                                const resultSummary = await processBattleResults(
                    classId,
                    result.winnerId,
                    loserId,
                    false,
                    winnerPet,
                    loserPet,
                    winnerParticipant.team || [winnerPet],
                    loserParticipant.team || [loserPet],
                    winnerParticipant.participatedPetIds || null,
                    loserParticipant.participatedPetIds || null
                );
                if (resultSummary) {
                    setLocalResultSummary(resultSummary);
                    await updateDoc(battleRef, { resultSummary });
                }
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

    
    // M5_CC_FIXED_TURNS_ITEM_SWITCH_DOT_PATCH
    const BATTLE_STATUS_TURN_DEFAULTS = {
        burned: 3,
        poisoned: 3,
        bound: 2,
        stunned: 1,
        blind: 1,
        dazzled: 1,
        aching: 2,
    };

    const BATTLE_STATUS_TURN_FIELDS = {
        burned: 'burnedTurns',
        poisoned: 'poisonTurns',
        bound: 'boundTurns',
        stunned: 'stunnedTurns',
        blind: 'blindTurns',
        dazzled: 'dazzledTurns',
        aching: 'achingTurns',
    };

    const BATTLE_STATUS_END_MESSAGES = {
        burned: petName => `🔥 ${petName}의 몸에 붙은 불씨가 모두 사그라들었습니다!`,
        poisoned: petName => `☠️ ${petName}의 독 기운이 빠져나갔습니다!`,
        bound: petName => `🌿 ${petName}이(가) 속박을 완전히 풀었습니다!`,
        stunned: petName => `💫 ${petName}이(가) 정신을 차렸습니다!`,
        blind: petName => `🙈 ${petName}의 시야가 다시 또렷해졌습니다!`,
        dazzled: petName => `☀️ ${petName}이(가) 눈부심에 적응했습니다!`,
        aching: petName => `💢 ${petName}의 욱신거림이 가라앉았습니다!`,
    };

    const getActiveStatusKeys = (status = {}) => new Set(
        Object.keys(BATTLE_STATUS_TURN_DEFAULTS).filter(key => !!status?.[key])
    );

    const clearBattleStatus = (pet, key) => {
        if (!pet?.status) return;

        delete pet.status[key];

        const turnField = BATTLE_STATUS_TURN_FIELDS[key];
        if (turnField) {
            delete pet.status[turnField];
        }
    };

    const ensureBattleStatusTurns = (pet, key) => {
        if (!pet?.status?.[key]) return 0;

        const turnField = BATTLE_STATUS_TURN_FIELDS[key];
        const defaultTurns = BATTLE_STATUS_TURN_DEFAULTS[key] ?? 1;

        if (!turnField) return defaultTurns;

        const currentTurns = Number(pet.status[turnField]);

        if (!Number.isFinite(currentTurns) || currentTurns <= 0) {
            pet.status[turnField] = defaultTurns;
            return defaultTurns;
        }

        return currentTurns;
    };

    const tickBattleStatusTurn = (pet, key, messages) => {
        if (!pet?.status?.[key]) return;

        const turnField = BATTLE_STATUS_TURN_FIELDS[key];
        if (!turnField) return;

        const currentTurns = ensureBattleStatusTurns(pet, key);
        const nextTurns = currentTurns - 1;

        if (nextTurns <= 0) {
            clearBattleStatus(pet, key);
            const makeMessage = BATTLE_STATUS_END_MESSAGES[key];
            if (makeMessage) {
                messages.push(makeMessage(pet.name || '펫'));
            }
        } else {
            pet.status[turnField] = nextTurns;
        }
    };

    const applyEndOfTurnDotAndStatus = (participant, options = {}) => {
        // M5_NEW_CC_CARD_TURNS_FIX_V2
        const pet = participant?.pet;
        if (!pet || !pet.status || Number(pet.hp ?? 0) <= 0) return '';

        const eligibleStatusKeys = options.eligibleStatusKeys || null;
        const hasEligibilityGate = eligibleStatusKeys instanceof Set;

        const messages = [];

        const isEligible = key => {
            // eligibleStatusKeys가 전달된 경우, 그 목록에 있던 상태만 이번 턴 종료 처리 대상입니다.
            // 즉, 이번 공격으로 새로 생긴 상태는 여기서 false가 됩니다.
            if (!hasEligibilityGate) return true;
            return eligibleStatusKeys.has(key);
        };

        const ensureDefaultTurnsOnly = (key) => {
            if (!pet.status?.[key]) return;

            const turnField = BATTLE_STATUS_TURN_FIELDS[key];
            if (!turnField) return;

            const currentTurns = Number(pet.status[turnField]);
            if (!Number.isFinite(currentTurns) || currentTurns <= 0) {
                pet.status[turnField] = BATTLE_STATUS_TURN_DEFAULTS[key] ?? 1;
            }
        };

        const canTickStatus = (key) => {
            if (!pet.status?.[key]) return false;

            if (!isEligible(key)) {
                // 새로 걸린 상태는 기본 턴 수만 세팅하고,
                // 같은 턴에는 DOT/턴수 감소를 절대 하지 않습니다.
                ensureDefaultTurnsOnly(key);
                return false;
            }

            ensureDefaultTurnsOnly(key);
            return true;
        };

        if (canTickStatus('burned')) {
            const burnDamage = Math.max(1, Math.floor(Number(pet.maxHp ?? 0) * 0.08));
            pet.hp = Math.max(0, Number(pet.hp ?? 0) - burnDamage);
            messages.push(`🔥 ${pet.name}은(는) 화상으로 ${burnDamage}의 피해를 입었습니다!`);
        }

        if (canTickStatus('poisoned') && Number(pet.hp ?? 0) > 0) {
            const poisonDamage = Math.max(1, Math.floor(Number(pet.maxHp ?? 0) * 0.06));
            pet.hp = Math.max(0, Number(pet.hp ?? 0) - poisonDamage);
            messages.push(`☠️ ${pet.name}은(는) 중독으로 ${poisonDamage}의 피해를 입었습니다!`);
        }

        ['burned', 'poisoned', 'bound', 'stunned', 'blind', 'dazzled', 'aching'].forEach(key => {
            if (canTickStatus(key)) {
                tickBattleStatusTurn(pet, key, messages);
            }
        });

        return messages.join(' ');
    };

    const syncBattleParticipantActivePetToTeam = (participant) => {
        if (!participant?.pet) return participant;

        const team = Array.isArray(participant.team) && participant.team.length > 0
            ? participant.team
            : [participant.pet];

        const activeIndexById = participant.activePetId
            ? team.findIndex(pet => pet?.id === participant.activePetId)
            : -1;

        const activeIndex = activeIndexById >= 0
            ? activeIndexById
            : Math.max(0, Number(participant.activePetIndex ?? 0));

        const nextTeam = team.map((pet, index) => (
            index === activeIndex
                ? {
                    ...participant.pet,
                    status: { ...(participant.pet.status || {}) },
                }
                : {
                    ...pet,
                    status: { ...(pet?.status || {}) },
                }
        ));

        return {
            ...participant,
            team: nextTeam,
            activePetIndex: activeIndex,
            activePetId: participant.pet.id || participant.activePetId || null,
        };
    };

    const getPendingSwitchChoices = (participant) => {
        const synced = syncBattleParticipantActivePetToTeam(participant);
        const activePet = synced?.pet;

        if (!activePet) {
            return {
                participant: synced,
                activePet: null,
                team: [],
                activeIndex: 0,
                choices: [],
            };
        }

        const team = Array.isArray(synced.team) && synced.team.length > 0
            ? synced.team
            : [activePet];

        const activeIndexById = synced.activePetId
            ? team.findIndex(pet => pet?.id === synced.activePetId)
            : -1;

        const activeIndex = activeIndexById >= 0
            ? activeIndexById
            : Math.max(0, Number(synced.activePetIndex ?? 0));

        const syncedTeam = team.map((pet, index) => (
            index === activeIndex
                ? { ...activePet, status: { ...(activePet.status || {}) } }
                : { ...pet, status: { ...(pet?.status || {}) } }
        ));

        const choices = syncedTeam
            .map((pet, index) => ({ pet, index }))
            .filter(({ pet, index }) => (
                index !== activeIndex &&
                pet?.id &&
                Number(pet.hp ?? 0) > 0
            ));

        return {
            participant: {
                ...synced,
                team: syncedTeam,
                activePetIndex: activeIndex,
                activePetId: activePet.id || synced.activePetId || null,
            },
            activePet,
            team: syncedTeam,
            activeIndex,
            choices,
        };
    };

    const applyPendingSwitchSelection = (participant, nextPetId = null) => {
        // M10_FAINTED_SWITCH_CHOICE_PATCH
        const state = getPendingSwitchChoices(participant);
        if (!state.participant || state.choices.length === 0) return null;

        const selectedChoice = nextPetId
            ? state.choices.find(({ pet }) => pet?.id === nextPetId)
            : state.choices[0];

        if (!selectedChoice?.pet) return null;

        const nextPet = {
            ...selectedChoice.pet,
            status: { ...(selectedChoice.pet.status || {}) },
        };

        const nextTeam = state.team.map((pet, index) => (
            index === selectedChoice.index ? nextPet : pet
        ));

        const participatedPetIds = [
            ...new Set([
                ...(Array.isArray(state.participant.participatedPetIds) ? state.participant.participatedPetIds : []),
                state.activePet?.id,
                nextPet.id,
            ].filter(Boolean)),
        ];

        return {
            participant: {
                ...state.participant,
                pet: nextPet,
                team: nextTeam,
                activePetIndex: selectedChoice.index,
                activePetId: nextPet.id || null,
                participatedPetIds,
            },
            selectedPetName: nextPet.name || '다음 펫',
        };
    };

    const getFaintedSwitchState = (participant) => {
        // M10_FAINTED_SWITCH_CHOICE_PATCH
        // active 펫이 쓰러졌을 때:
        // - 대기 0마리: 팀 패배
        // - 대기 1마리: 자동교체
        // - 대기 2마리 이상: 직접 선택
        const state = getPendingSwitchChoices(participant);
        const activePet = state.activePet;

        if (!activePet) {
            return {
                participant: state.participant,
                teamDefeated: true,
                needsChoice: false,
                autoSwitched: false,
                log: '',
            };
        }

        if (Number(activePet.hp ?? 0) > 0) {
            return {
                participant: state.participant,
                teamDefeated: false,
                needsChoice: false,
                autoSwitched: false,
                log: '',
            };
        }

        if (state.choices.length === 0) {
            return {
                participant: state.participant,
                teamDefeated: true,
                needsChoice: false,
                autoSwitched: false,
                log: `${state.participant.name}의 ${activePet.name || '펫'}이(가) 쓰러졌습니다!`,
            };
        }

        if (state.choices.length === 1) {
            const selected = applyPendingSwitchSelection(state.participant, state.choices[0].pet.id);
            return {
                participant: selected.participant,
                teamDefeated: false,
                needsChoice: false,
                autoSwitched: true,
                switchedPetName: selected.selectedPetName,
                log: `${activePet.name || '펫'}이(가) 쓰러져 ${selected.selectedPetName}이(가) 대신 나섭니다!`,
            };
        }

        return {
            participant: state.participant,
            teamDefeated: false,
            needsChoice: true,
            autoSwitched: false,
            log: `${state.participant.name}의 ${activePet.name || '펫'}이(가) 쓰러졌습니다. 다음 펫을 고르는 중입니다!`,
        };
    };

    const buildPendingSwitchUpdate = (data, nextQuiz, roles, now = Date.now()) => ({
        // M10_FAINTED_SWITCH_CHOICE_PATCH
        status: 'pending_switch',
        question: null,
        pendingNextQuestion: nextQuiz,
        pendingUsedQuestions: [...(data.usedQuestions || []), nextQuiz.question],
        switchResumeAt: null,
        pendingSwitch: {
            roles,
            createdAt: now,
            expiresAt: now + SWITCH_CHOICE_LIMIT_MS,
        },
        turnStartTime: now,
        chat: {},
    });

    const resolveFaintedActiveParticipant = (participant) => {
        // M5_ITEM_SWITCH_DOT_BOTH_SIDES_PATCH
        const synced = syncBattleParticipantActivePetToTeam(participant);
        const activePet = synced?.pet;

        if (!activePet) {
            return {
                participant: synced,
                teamDefeated: true,
                switched: false,
                log: '',
            };
        }

        if (Number(activePet.hp ?? 0) > 0) {
            return {
                participant: synced,
                teamDefeated: false,
                switched: false,
                log: '',
            };
        }

        const team = Array.isArray(synced.team) && synced.team.length > 0
            ? synced.team
            : [activePet];

        const activeIndexById = synced.activePetId
            ? team.findIndex(pet => pet?.id === synced.activePetId)
            : -1;

        const activeIndex = activeIndexById >= 0
            ? activeIndexById
            : Math.max(0, Number(synced.activePetIndex ?? 0));

        const nextIndex = team.findIndex((pet, index) => (
            index !== activeIndex &&
            pet?.id &&
            Number(pet.hp ?? 0) > 0
        ));

        if (nextIndex < 0) {
            return {
                participant: synced,
                teamDefeated: true,
                switched: false,
                log: `${synced.name}의 ${activePet.name || '펫'}이(가) 쓰러졌습니다!`,
            };
        }

        const nextPet = {
            ...team[nextIndex],
            status: { ...(team[nextIndex]?.status || {}) },
        };

        const participatedPetIds = [
            ...new Set([
                ...(Array.isArray(synced.participatedPetIds) ? synced.participatedPetIds : []),
                nextPet.id,
            ].filter(Boolean)),
        ];

        const nextParticipant = {
            ...synced,
            pet: nextPet,
            activePetIndex: nextIndex,
            activePetId: nextPet.id || null,
            participatedPetIds,
        };

        return {
            participant: nextParticipant,
            teamDefeated: false,
            switched: true,
            log: `${activePet.name || '펫'}이(가) 쓰러져 ${nextPet.name}이(가) 대신 나섭니다!`,
        };
    };


const handleUseItem = async (itemId) => {
        // M5_ITEM_SWITCH_DOT_BOTH_SIDES_PATCH
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleId);

            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();

                const canUseItem =
                    data.status === 'action' &&
                    data.turn === myPlayerData.id &&
                    !data.attackerAction;

                if (!canUseItem) return null;

                const playerRef = doc(db, 'classes', classId, 'players', myPlayerData.id);
                const playerDoc = await transaction.get(playerRef);
                if (!playerDoc.exists()) return null;

                const playerData = playerDoc.data();
                const currentQty = playerData.petInventory?.[itemId] || 0;
                if (currentQty <= 0) return null;

                playHealSound();

                const newInventory = { ...(playerData.petInventory || {}) };
                newInventory[itemId] = currentQty - 1;
                transaction.update(playerRef, { petInventory: newInventory });

                const myRole = myPlayerData.id === data.challenger.id ? 'challenger' : 'opponent';
                const opponentRole = myRole === 'challenger' ? 'opponent' : 'challenger';

                const myParticipant = data[myRole];
                const opponentParticipant = data[opponentRole];

                const myPet = {
                    ...(myParticipant.pet || {}),
                    status: { ...(myParticipant.pet?.status || {}) },
                };

                const opponentPet = {
                    ...(opponentParticipant.pet || {}),
                    status: { ...(opponentParticipant.pet?.status || {}) },
                };

                const healHp = Math.floor(Number(myPet.maxHp ?? 0) * 0.30);
                const healSp = Math.floor(Number(myPet.maxSp ?? 0) * 0.30);

                myPet.hp = Math.min(Number(myPet.maxHp ?? myPet.hp ?? 0), Number(myPet.hp ?? 0) + healHp);
                myPet.sp = Math.min(Number(myPet.maxSp ?? myPet.sp ?? 0), Number(myPet.sp ?? 0) + healSp);

                const nextMyParticipantBase = {
                    ...myParticipant,
                    pet: myPet,
                };

                const nextOpponentParticipantBase = {
                    ...opponentParticipant,
                    pet: opponentPet,
                };

                // 두뇌간식도 한 턴 종료로 간주합니다.
                // 따라서 행동한 쪽뿐 아니라 양쪽 active pet 모두 DOT/턴수 감소를 받습니다.
                const myStatusLog = applyEndOfTurnDotAndStatus(nextMyParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextMyParticipantBase.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(nextOpponentParticipantBase, { eligibleStatusKeys: getActiveStatusKeys(nextOpponentParticipantBase.pet?.status) });

                const myResolved = resolveFaintedActiveParticipant(nextMyParticipantBase);
                const opponentResolved = resolveFaintedActiveParticipant(nextOpponentParticipantBase);

                const nextMyParticipant = myResolved.participant;
                const nextOpponentParticipant = opponentResolved.participant;

                const myTeamDefeated = myResolved.teamDefeated;
                const opponentTeamDefeated = opponentResolved.teamDefeated;
                const isFinished = myTeamDefeated || opponentTeamDefeated;

                const winnerId = isFinished
                    ? myTeamDefeated && opponentTeamDefeated
                        ? null
                        : myTeamDefeated
                            ? nextOpponentParticipant.id
                            : nextMyParticipant.id
                    : null;

                const nextQuiz = getNextQuizObj(data.usedQuestions);
                const hasSwitchPause = !isFinished && (myResolved.switched || opponentResolved.switched);
                const nextTurnUpdate = hasSwitchPause
                    ? buildSwitchPauseUpdate(data, nextQuiz)
                    : buildNextQuizUpdate(data, nextQuiz);

                const baseLog = `${playerData.name}의 펫이 두뇌 간식을 먹었습니다! (HP/SP +30% 회복)`;

                const log = [
                    baseLog,
                    myStatusLog,
                    opponentStatusLog,
                    myResolved.log,
                    opponentResolved.log,
                    isFinished
                        ? winnerId
                            ? '전투가 종료되었습니다!'
                            : '양쪽 펫이 동시에 쓰러져 무승부가 되었습니다!'
                        : null,
                ].filter(Boolean).join(' ');

                const updateData = {
                    [myRole]: nextMyParticipant,
                    [opponentRole]: nextOpponentParticipant,
                    log,
                    status: isFinished ? 'finished' : hasSwitchPause ? 'switching' : 'quiz',
                    winner: winnerId,
                    turn: null,
                    attackerAction: null,
                    attackerActionPayload: null,
                    defenderAction: null,
                    ...(isFinished ? {} : nextTurnUpdate)
                };

                transaction.update(battleRef, updateData);

                return {
                    isFinished,
                    isDraw: isFinished && !winnerId,
                    winnerId,
                    finalChallenger: myRole === 'challenger' ? nextMyParticipant : nextOpponentParticipant,
                    finalOpponent: myRole === 'opponent' ? nextMyParticipant : nextOpponentParticipant,
                };
            });

            if (result && result.isFinished) {
                if (result.isDraw) {
                    await processBattleDraw(
                        classId,
                        result.finalChallenger.id,
                        result.finalOpponent.id,
                        result.finalChallenger.pet,
                        result.finalOpponent.pet,
                        result.finalChallenger.team || [result.finalChallenger.pet],
                        result.finalOpponent.team || [result.finalOpponent.pet]
                    );
                } else {
                    const winnerPet = result.winnerId === result.finalChallenger.id
                        ? result.finalChallenger.pet
                        : result.finalOpponent.pet;

                    const loserPet = result.winnerId === result.finalChallenger.id
                        ? result.finalOpponent.pet
                        : result.finalChallenger.pet;

                    const loserId = result.winnerId === result.finalChallenger.id
                        ? result.finalOpponent.id
                        : result.finalChallenger.id;

                    const winnerParticipant = result.winnerId === result.finalChallenger.id
                        ? result.finalChallenger
                        : result.finalOpponent;

                    const loserParticipant = result.winnerId === result.finalChallenger.id
                        ? result.finalOpponent
                        : result.finalChallenger;

                                        const resultSummary = await processBattleResults(
                        classId,
                        result.winnerId,
                        loserId,
                        false,
                        winnerPet,
                        loserPet,
                        winnerParticipant.team || [winnerPet],
                        loserParticipant.team || [loserPet],
                        winnerParticipant.participatedPetIds || null,
                        loserParticipant.participatedPetIds || null
                    );
                    if (resultSummary) {
                        setLocalResultSummary(resultSummary);
                        await updateDoc(battleRef, { resultSummary });
                    }
                }
            }
        } catch (error) {
            console.error("아이템 사용 오류:", error);
            alert("아이템 사용 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(false);
            setActionSubMenu(null);
        }
    };



    
    const handleFaintedPetSwitch = async (nextPetId) => {
        // M10_FAINTED_SWITCH_CHOICE_PATCH
        if (!battleState || !myPlayerData || isProcessing) return;
        if (battleState.status !== 'pending_switch') return;

        setIsProcessing(true);

        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleId);

            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status !== 'pending_switch') return null;

                const iAmChallenger = myPlayerData.id === data.challenger.id;
                const myRole = iAmChallenger ? 'challenger' : 'opponent';
                const roles = Array.isArray(data.pendingSwitch?.roles)
                    ? data.pendingSwitch.roles
                    : [];

                if (!roles.includes(myRole)) return null;

                const selected = applyPendingSwitchSelection(data[myRole], nextPetId);
                if (!selected?.participant) return null;

                const remainingRoles = roles.filter(role => role !== myRole);
                const nextQuiz = data.pendingNextQuestion || getNextQuizObj(data.usedQuestions || []);
                const pendingUsedQuestions = Array.isArray(data.pendingUsedQuestions)
                    ? data.pendingUsedQuestions
                    : [...(data.usedQuestions || []), nextQuiz.question];

                const switchLog = `🔁 ${selected.participant.name}의 ${selected.selectedPetName}이(가) 등장!`;
                const baseLog = data.log || '';
                const nextLog = [baseLog, switchLog].filter(Boolean).join(' ');

                const updateData = {
                    [myRole]: selected.participant,
                    log: remainingRoles.length > 0
                        ? `${nextLog} 상대가 다음 펫을 고르는 중입니다.`
                        : nextLog,
                };

                if (remainingRoles.length > 0) {
                    updateData.pendingSwitch = {
                        ...(data.pendingSwitch || {}),
                        roles: remainingRoles,
                    };
                } else {
                    updateData.status = 'switching';
                    updateData.question = null;
                    updateData.pendingNextQuestion = nextQuiz;
                    updateData.pendingUsedQuestions = pendingUsedQuestions;
                    updateData.switchResumeAt = Date.now() + SWITCH_RESUME_DELAY_MS;
                    updateData.pendingSwitch = null;
                    updateData.turnStartTime = Date.now();
                    updateData.turn = null;
                    updateData.attackerAction = null;
                    updateData.attackerActionPayload = null;
                    updateData.defenderAction = null;
                    updateData.chat = {};
                }

                transaction.update(battleRef, updateData);

                return {
                    switchedPetName: selected.selectedPetName,
                };
            });

            if (result?.switchedPetName) {
                setSwitchMessage(`🔁 ${result.switchedPetName} 등장!`);
                setSwitchIntro(prev => ({ ...prev, my: true }));

                clearTimeout(switchIntroTimerRef.current);
                clearTimeout(switchMessageTimerRef.current);

                switchIntroTimerRef.current = setTimeout(() => {
                    setSwitchIntro({ my: false, opponent: false });
                }, 1200);

                switchMessageTimerRef.current = setTimeout(() => {
                    setSwitchMessage('');
                }, 1800);
            }
        } catch (error) {
            console.error('Fainted pet switch error:', error);
            alert('다음 펫 선택 중 오류가 발생했습니다.');
        } finally {
            setTimeout(() => setIsProcessing(false), 300);
        }
    };

    const handleManualSwitch = async (nextPetId) => {
        // M5_ITEM_SWITCH_DOT_BOTH_SIDES_PATCH
        if (!battleState || !myPlayerData || isProcessing) return;

        const canAct =
            battleState.status === 'action' &&
            battleState.turn === myPlayerData.id &&
            !battleState.attackerAction;

        if (!canAct) {
            alert('공격권을 얻었을 때만 펫을 교체할 수 있습니다.');
            return;
        }

        if (myInfo?.pet?.status?.bound) {
            alert('속박 상태에서는 펫을 교체할 수 없습니다.');
            return;
        }

        const selectedPet = switchablePets.find(pet => pet.id === nextPetId);
        if (!selectedPet) {
            alert('교체할 수 없는 펫입니다.');
            return;
        }

        setIsProcessing(true);

        try {
            const battleRef = doc(db, 'classes', classId, 'battles', battleId);

            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();

                const txCanAct =
                    data.status === 'action' &&
                    data.turn === myPlayerData.id &&
                    !data.attackerAction;

                if (!txCanAct) return null;

                const iAmChallenger = myPlayerData.id === data.challenger.id;
                const myRole = iAmChallenger ? 'challenger' : 'opponent';
                const opponentRole = iAmChallenger ? 'opponent' : 'challenger';

                const participant = data[myRole];
                const opponentParticipant = data[opponentRole];

                if (participant?.pet?.status?.bound) {
                    return null;
                }

                const team = Array.isArray(participant.team) && participant.team.length > 0
                    ? participant.team
                    : participant.pet
                        ? [participant.pet]
                        : [];

                const currentPet = {
                    ...(participant.pet || {}),
                    status: { ...(participant.pet?.status || {}) },
                };

                const opponentPet = {
                    ...(opponentParticipant.pet || {}),
                    status: { ...(opponentParticipant.pet?.status || {}) },
                };

                const activeIndexById = participant.activePetId
                    ? team.findIndex(pet => pet?.id === participant.activePetId)
                    : -1;

                const activeIndex = activeIndexById >= 0
                    ? activeIndexById
                    : Math.max(0, Number(participant.activePetIndex ?? 0));

                const currentTurnParticipant = {
                    ...participant,
                    pet: currentPet,
                };

                const opponentTurnParticipant = {
                    ...opponentParticipant,
                    pet: opponentPet,
                };

                // 펫 교체도 한 턴 종료로 간주합니다.
                // 따라서 교체하는 쪽뿐 아니라 상대 active pet도 DOT/턴수 감소를 받습니다.
                const switcherStatusLog = applyEndOfTurnDotAndStatus(currentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(currentTurnParticipant.pet?.status) });
                const opponentStatusLog = applyEndOfTurnDotAndStatus(opponentTurnParticipant, { eligibleStatusKeys: getActiveStatusKeys(opponentTurnParticipant.pet?.status) });

                const currentPetAfterTurn = currentTurnParticipant.pet;

                const syncedTeam = team.map((pet, index) => (
                    index === activeIndex
                        ? { ...currentPetAfterTurn, status: { ...(currentPetAfterTurn.status || {}) } }
                        : { ...pet, status: { ...(pet?.status || {}) } }
                ));

                const nextIndex = syncedTeam.findIndex(pet => (
                    pet?.id === nextPetId && Number(pet?.hp ?? 0) > 0
                ));

                if (nextIndex < 0 || nextIndex === activeIndex) return null;

                const nextPet = {
                    ...syncedTeam[nextIndex],
                    status: { ...(syncedTeam[nextIndex]?.status || {}) },
                };

                const nextTeam = syncedTeam.map((pet, index) => (
                    index === nextIndex ? nextPet : pet
                ));

                const participatedPetIds = [
                    ...new Set([
                        ...(Array.isArray(participant.participatedPetIds) ? participant.participatedPetIds : []),
                        currentPetAfterTurn.id,
                        nextPet.id,
                    ].filter(Boolean)),
                ];

                const nextParticipantBeforeResolve = {
                    ...participant,
                    pet: nextPet,
                    team: nextTeam,
                    activePetIndex: nextIndex,
                    activePetId: nextPet.id || null,
                    participatedPetIds,
                };

                const opponentResolved = resolveFaintedActiveParticipant(opponentTurnParticipant);
                const nextOpponentParticipant = opponentResolved.participant;

                const opponentTeamDefeated = opponentResolved.teamDefeated;
                const isFinished = opponentTeamDefeated;
                const winnerId = isFinished ? nextParticipantBeforeResolve.id : null;

                const nextQuiz = getNextQuizObj(data.usedQuestions);

                const switchLog = `🔁 ${participant.name}이(가) ${currentPetAfterTurn.name || '펫'}을(를) 불러들이고 ${nextPet.name}을(를) 내보냈습니다! 공격 기회를 사용했습니다.`;

                const log = [
                    switcherStatusLog,
                    opponentStatusLog,
                    switchLog,
                    opponentResolved.log,
                    isFinished ? '전투가 종료되었습니다!' : null,
                ].filter(Boolean).join(' ');

                const updateData = {
                    [myRole]: nextParticipantBeforeResolve,
                    [opponentRole]: nextOpponentParticipant,
                    status: isFinished ? 'finished' : 'switching',
                    winner: winnerId,
                    turn: null,
                    attackerAction: null,
                    attackerActionPayload: null,
                    defenderAction: null,
                    chat: {},
                    log,
                    ...(isFinished ? {} : buildSwitchPauseUpdate(data, nextQuiz))
                };

                transaction.update(battleRef, updateData);

                return {
                    isFinished,
                    winnerId,
                    finalChallenger: myRole === 'challenger' ? nextParticipantBeforeResolve : nextOpponentParticipant,
                    finalOpponent: myRole === 'opponent' ? nextParticipantBeforeResolve : nextOpponentParticipant,
                    switchedPetName: nextPet.name,
                };
            });

            setActionSubMenu(null);

            if (result?.switchedPetName) {
                setSwitchMessage(`🔁 ${result.switchedPetName} 등장!`);
                setSwitchIntro(prev => ({ ...prev, my: true }));

                clearTimeout(switchIntroTimerRef.current);
                clearTimeout(switchMessageTimerRef.current);

                switchIntroTimerRef.current = setTimeout(() => {
                    setSwitchIntro({ my: false, opponent: false });
                }, 1200);

                switchMessageTimerRef.current = setTimeout(() => {
                    setSwitchMessage('');
                }, 1800);
            }

            if (result && result.isFinished && result.winnerId) {
                const winnerPet = result.winnerId === result.finalChallenger.id
                    ? result.finalChallenger.pet
                    : result.finalOpponent.pet;

                const loserPet = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent.pet
                    : result.finalChallenger.pet;

                const loserId = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent.id
                    : result.finalChallenger.id;

                const winnerParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalChallenger
                    : result.finalOpponent;

                const loserParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent
                    : result.finalChallenger;

                                const resultSummary = await processBattleResults(
                    classId,
                    result.winnerId,
                    loserId,
                    false,
                    winnerPet,
                    loserPet,
                    winnerParticipant.team || [winnerPet],
                    loserParticipant.team || [loserPet],
                    winnerParticipant.participatedPetIds || null,
                    loserParticipant.participatedPetIds || null
                );
                if (resultSummary) {
                    setLocalResultSummary(resultSummary);
                    await updateDoc(battleRef, { resultSummary });
                }
            }
        } catch (error) {
            console.error('Manual pet switch error:', error);
            alert('펫 교체 중 오류가 발생했습니다.');
        } finally {
            setTimeout(() => setIsProcessing(false), 300);
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

                let resolvedActionId = actionId;
                if (myPet.status?.recharging) {
                    resolvedActionId = 'TACKLE';
                    delete myPet.status.recharging;
                }

                const updates = { attackerAction: resolvedActionId };
                const opponentIsStunned = battleState[opponentRole].pet.status?.stunned;
                const opponentIsBound = battleState[opponentRole].pet.status?.bound;

                if (opponentIsStunned) {
                    updates.defenderAction = 'STUNNED';
                    updates.log = `${myPet.name}의 공격! (상대방은 혼란 상태라 방어 불가!)`;
                } else if (opponentIsBound) {
                    updates.defenderAction = 'BOUND';
                    updates.log = `${myPet.name}의 공격! (상대방은 속박 상태라 방어 불가!)`;
                }

                if (myPet.status?.recharging === false && resolvedActionId === 'TACKLE') {
                    updates.log = `💤 ${myPet.name}은(는) 반동으로 지쳐 쉬었습니다!`;
                    updates.defenderAction = updates.defenderAction || 'BRACE';
                }

                await updateDoc(battleRef, updates);
            } else {
                if (actionId === 'FLEE') {
                    const myId = myPlayerData.id;
                    const opponentId = battleState.turn;
                    const fleeAttemptedBy = Array.isArray(battleState.fleeAttemptedBy)
                        ? battleState.fleeAttemptedBy
                        : [];

                    if (fleeAttemptedBy.includes(myId)) {
                        alert('이번 배틀에서는 이미 도망을 시도했습니다.');
                        return;
                    }

                    const nextFleeAttemptedBy = [...new Set([...fleeAttemptedBy, myId])];

                    const isChallengerMe = myPlayerData.id === battleState.challenger.id;
                    const myParticipant = isChallengerMe ? battleState.challenger : battleState.opponent;
                    const opponentParticipant = isChallengerMe ? battleState.opponent : battleState.challenger;
                    const myPet = myParticipant.pet;
                    const opponentPet = opponentParticipant.pet;

                    if (Math.random() < 0.3) {
                        await updateDoc(battleRef, {
                            status: 'finished',
                            winner: opponentId,
                            fledBy: myId,
                            fleeAttemptedBy: nextFleeAttemptedBy,
                            defenderAction: 'FLEE_SUCCESS',
                            log: `🏃 ${myPet.name}이(가) 도망쳤습니다! ${opponentParticipant.name}의 승리로 처리됩니다.`
                        });

                        const resultSummary = await processBattleResults(
                            classId,
                            opponentId,
                            myId,
                            true,
                            opponentPet,
                            myPet,
                            opponentParticipant?.team || [opponentPet],
                            myParticipant?.team || [myPet],
                            opponentParticipant?.participatedPetIds || null,
                            myParticipant?.participatedPetIds || null
                        );

                        if (resultSummary) {
                            setLocalResultSummary(resultSummary);
                            await updateDoc(battleRef, { resultSummary });
                        }

                        // M18H_MINIMAL_RESULT_SUMMARY_SAVE_PATCH
                        // 도망 결과도 결과창에서 확인할 수 있도록 자동 이동하지 않습니다.
                    } else {
                        await updateDoc(battleRef, {
                            defenderAction: 'FLEE_FAILED',
                            fleeAttemptedBy: nextFleeAttemptedBy,
                            log: '도망치기에 실패했다! 이번 배틀에서는 더 이상 도망칠 수 없습니다.'
                        });
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

    const handleResolution = async (battleRef) => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const battleDoc = await transaction.get(battleRef);
                if (!battleDoc.exists()) return null;

                const data = battleDoc.data();
                if (data.status !== 'action' || data.status === 'finished') return null;

                let { challenger, opponent, turn, attackerAction, defenderAction } = data;

                
                if (!attackerAction || !defenderAction) return null;

                const isChallengerAttacker = turn === challenger.id;
                let attacker = isChallengerAttacker ? { ...challenger } : { ...opponent };
                let defender = isChallengerAttacker ? { ...opponent } : { ...challenger };

                
                // M5_NEW_CC_CARD_TURNS_FIX_V2
                if (!attacker.pet.status) attacker.pet.status = {};
                if (!defender.pet.status) defender.pet.status = {};

                // M5_REMOVE_LEGACY_DOT_BLOCK_PATCH
                // 스킬/공격 처리 전 상태만 턴 종료 처리 대상으로 삼습니다.
                // 이번 공격으로 새로 걸린 화상/중독/속박은 같은 턴에는 DOT/턴감소가 없습니다.
                const initialAttackerStatusKeys = getActiveStatusKeys(attacker.pet.status);
                const initialDefenderStatusKeys = getActiveStatusKeys(defender.pet.status);
if (defender.pet.status?.stunned) {
                    delete defender.pet.status.stunned;
                }

                let skillId = String(attackerAction || '').toUpperCase();
                let skill = SKILLS[skillId];
                let isSpInsufficient = false;
                const originalSkillName = skill?.name;

                const getResolvedSkillCost = (targetSkill, targetPet, targetPlayer) => {
                    if (!targetSkill) return 0;

                    const baseCost = Number(targetSkill.cost ?? 0);
                    if (baseCost <= 0) return 0;

                    const scaledCost = Number(getScaledSkillCost(baseCost, targetPet?.level));

                    // getScaledSkillCost가 0/NaN/undefined를 반환해도 기본 cost로 복구
                    let resolvedCost = Number.isFinite(scaledCost) && scaledCost > 0
                        ? scaledCost
                        : baseCost;

                    if (targetPlayer?.equippedTitle === 'classroom_intellectual') {
                        resolvedCost = Math.floor(resolvedCost * 0.8);
                    }

                    return Math.max(0, resolvedCost);
                };

                let actualCost = getResolvedSkillCost(skill, attacker.pet, attacker);

                if (skill && actualCost > Number(attacker.pet.sp ?? 0)) {
                    skillId = 'TACKLE';
                    skill = SKILLS.TACKLE;
                    isSpInsufficient = true;
                    actualCost = 0;
                }

                let log = "";

                
                const preHp = defender.pet.hp;
                const actionName = skill?.name || '공격';

                const resolveNormalAction = () => {
                    if (skill && skill.effect) {
                        log = skill.effect(attacker, defender, defenderAction);

                        if (isSpInsufficient) {
                            log = `(SP 부족!) ${originalSkillName} 실패.. 대신 ${log}`;
                        }
                    } else {
                        let damage = 20 + attacker.pet.atk * 2;

                        if (attacker.pet.status?.aching) {
                            damage *= 0.7;
                        }

                        if (defenderAction === 'BRACE') damage *= 0.7;

                        if (defender.pet.status?.aching) {
                            damage *= 1.3;
                        }

                        damage = Math.round(damage);
                        defender.pet.hp = Math.max(0, defender.pet.hp - damage);
                        log += `${attacker.pet.name}의 공격! ${damage}의 피해!`;
                    }
                };

                // ☀️ 눈부심: 다음 공격 1회 무조건 빗나감
                // 🙈 실명/도발: 다음 공격 1회 50% 확률로 빗나감
                // 둘 다 skill.effect 실행 전에 전역 처리해야 기본공격/스킬 모두에 동일하게 적용됩니다.
                const isDazzled = !!attacker.pet.status?.dazzled;
                const isBlinded = !!attacker.pet.status?.blind;

                if (isDazzled) {
                    delete attacker.pet.status.dazzled;

                    log = `☀️ ${attacker.pet.name}은(는) 눈부심 때문에 ${actionName}을(를) 제대로 쓰지 못했습니다! 공격이 빗나갔습니다!`;

                    if (isSpInsufficient) {
                        log = `(SP 부족!) ${originalSkillName} 실패.. 대신 ${log}`;
                    }
                } else if (isBlinded) {
                    delete attacker.pet.status.blind;

                    if (Math.random() < 0.5) {
                        log = `🙈 ${attacker.pet.name}은(는) 시야가 흔들려 ${actionName}을(를) 제대로 쓰지 못했습니다! 공격이 빗나갔습니다!`;

                        if (isSpInsufficient) {
                            log = `(SP 부족!) ${originalSkillName} 실패.. 대신 ${log}`;
                        }
                    } else {
                        resolveNormalAction();
                    }
                } else {
                    resolveNormalAction();
                }

                // SP 소모는 명중/빗나감과 관계없이 스킬을 선택했다면 여기서 확정 처리합니다.
                // 단, SP 부족으로 기본공격으로 대체된 경우 actualCost는 0입니다.
                if (skill && actualCost > 0) {
                    attacker.pet.sp = Math.max(0, Number(attacker.pet.sp ?? 0) - actualCost);
                }

                // --- ⚔️ 반격 (Counter) 시스템 처리 ---
                const damageTaken = preHp - defender.pet.hp;
                if (defender.pet.status?.counterReady && damageTaken > 0) {
                    const reflectDamage = Math.round(damageTaken * defender.pet.status.counterReady);
                    attacker.pet.hp = Math.max(0, attacker.pet.hp - reflectDamage);
                    log += ` \n⚔️ [반격 발동!] 상대의 공격을 쳐내어 ${reflectDamage}의 피해를 돌려주었습니다!`;
                    delete defender.pet.status.counterReady;
                }

                // M5_REMOVE_LEGACY_DOT_BLOCK_PATCH
                // 기존 BattlePage 하드코딩 DOT 블록 제거.
                // 이제 DOT/CC 턴감소는 applyEndOfTurnDotAndStatus에서만 처리합니다.
                if (attacker.pet.status?.focusCharge) {
                    attacker.pet.status.focusCharge = 0;
                }

                if (attacker.pet.status?.defenseUp) {
                    attacker.pet.status.defenseUpTurns = (attacker.pet.status.defenseUpTurns ?? 2) - 1;
                    if (attacker.pet.status.defenseUpTurns <= 0) {
                        delete attacker.pet.status.defenseUp;
                        delete attacker.pet.status.defenseUpTurns;
                        log += ` (${attacker.pet.name}의 방어력 강화가 풀렸습니다.)`;
                    }
                }

                if (attacker.equippedTitle === 'diligent_tree') {
                    const heal = Math.floor(attacker.pet.maxHp * 0.05);
                    attacker.pet.hp = Math.min(attacker.pet.maxHp, attacker.pet.hp + heal);
                    log += ` 🌳 [성실한 나무 효과로 HP +${heal} 회복]`;
                }

                // M10_FAINTED_SWITCH_CHOICE_PATCH
                // 공격/스킬 처리 후 쓰러진 active 펫 처리:
                // 대기 0마리: 종료, 대기 1마리: 자동교체, 대기 2마리 이상: 직접 선택
                const ccDotLogs = [
                    applyEndOfTurnDotAndStatus(attacker, { eligibleStatusKeys: initialAttackerStatusKeys }),
                    applyEndOfTurnDotAndStatus(defender, { eligibleStatusKeys: initialDefenderStatusKeys }),
                ].filter(Boolean);

                if (ccDotLogs.length > 0) {
                    log += ` ${ccDotLogs.join(' ')}`;
                }

                const attackerFaintState = getFaintedSwitchState(attacker);
                attacker = attackerFaintState.participant;

                const defenderFaintState = getFaintedSwitchState(defender);
                defender = defenderFaintState.participant;

                const pendingSwitchRoles = [];
                const switchMessages = [];

                if (attackerFaintState.log) switchMessages.push(attackerFaintState.log);
                if (defenderFaintState.log) switchMessages.push(defenderFaintState.log);

                if (attackerFaintState.needsChoice) {
                    pendingSwitchRoles.push(isChallengerAttacker ? 'challenger' : 'opponent');
                }

                if (defenderFaintState.needsChoice) {
                    pendingSwitchRoles.push(isChallengerAttacker ? 'opponent' : 'challenger');
                }

                const isFinished = attackerFaintState.teamDefeated || defenderFaintState.teamDefeated;
                let winnerId = null;

                if (isFinished) {
                    if (attackerFaintState.teamDefeated && !defenderFaintState.teamDefeated) winnerId = defender.id;
                    else if (defenderFaintState.teamDefeated && !attackerFaintState.teamDefeated) winnerId = attacker.id;
                    log += ` ${switchMessages.join(' ')} 전투 종료!`;
                } else if (switchMessages.length > 0) {
                    log += ` ${switchMessages.join(' ')}`;
                }

                const nextQuiz = getNextQuizObj(data.usedQuestions);
                const hasPendingSwitch = !isFinished && pendingSwitchRoles.length > 0;
                const hasSwitchPause = !isFinished && !hasPendingSwitch && switchMessages.length > 0;
                const nextTurnUpdate = hasPendingSwitch
                    ? buildPendingSwitchUpdate(data, nextQuiz, pendingSwitchRoles)
                    : hasSwitchPause
                        ? buildSwitchPauseUpdate(data, nextQuiz)
                        : buildNextQuizUpdate(data, nextQuiz);

                const updateData = {
                    log,
                    challenger: syncBattleParticipantActivePet(isChallengerAttacker ? attacker : defender),
                    opponent: syncBattleParticipantActivePet(isChallengerAttacker ? defender : attacker),
                    status: isFinished ? 'finished' : hasPendingSwitch ? 'pending_switch' : hasSwitchPause ? 'switching' : 'quiz',
                    winner: winnerId,
                    ...(!isFinished && {
                        ...nextTurnUpdate,
                        turn: null,
                        attackerAction: null,
                        defenderAction: null,
                    })
                };

                transaction.update(battleRef, updateData);
                return {
                    isFinished,
                    winnerId,
                    finalChallenger: updateData.challenger,
                    finalOpponent: updateData.opponent,
                };
            });

                        if (result && result.isFinished) {
                // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH
                // team 전체 HP/SP는 저장하되, 경험치/전적은 실제 출전 펫에게만 적용합니다.
                const winnerParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalChallenger
                    : result.finalOpponent;
            
                const loserParticipant = result.winnerId === result.finalChallenger.id
                    ? result.finalOpponent
                    : result.finalChallenger;
            
                const winnerPet = winnerParticipant.pet;
                const loserPet = loserParticipant.pet;
                const loserId = loserParticipant.id;
            
                                const resultSummary = await processBattleResults(
                    classId,
                    result.winnerId,
                    loserId,
                    false,
                    winnerPet,
                    loserPet,
                    winnerParticipant.team || [winnerPet],
                    loserParticipant.team || [loserPet],
                    winnerParticipant.participatedPetIds || null,
                    loserParticipant.participatedPetIds || null
                );
                if (resultSummary) {
                    setLocalResultSummary(resultSummary);
                    await updateDoc(battleRef, { resultSummary });
                }
            }
        } catch (error) {
            console.error("Battle resolution error:", error);
        } finally {
            setIsProcessing(false);
        }
    };


    const getSkillCost = (skill) => {
        const scaled = getScaledSkillCost(skill.cost, myInfo?.pet?.level);
        return myInfo.equippedTitle === 'classroom_intellectual' ? Math.floor(scaled * 0.8) : scaled;
    };

    const renderHpBar = (hp, maxHp) => {
        return <BattleHpBar hp={hp} maxHp={maxHp} />;
    };

    const renderSpBar = (sp, maxSp) => {
        return <BattleSpBar sp={sp} maxSp={maxSp} />;
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
    const opponentRole = IamChallenger ? 'opponent' : 'challenger';

    // M3_ACTIVE_PET_COMPAT_PATCH
    // 지금은 단일 펫 구조를 그대로 쓰고, 나중에 team/activePetIndex가 생기면 여기서 active pet으로 정규화합니다.
    const rawMyInfo = battleState[myRole];
    const rawOpponentInfo = battleState[opponentRole];
    const myInfo = normalizeBattleParticipantForBattle(rawMyInfo);
    const opponentInfo = normalizeBattleParticipantForBattle(rawOpponentInfo);

    const isAttacker = battleState.turn === myPlayerData.id;
    // M5_MANUAL_SWITCH_PATCH_V1
    const switchablePets = (() => {
        // M5_CC_FIXED_TURNS_SWITCH_BOUND_GUARD
        if (myInfo?.pet?.status?.bound) return [];
        // M5_CC_DOT_SWITCH_GUARD_PATCH_V2
        if (myInfo?.pet?.status?.bound) return [];
        if (!myInfo) return [];
        const team = Array.isArray(myInfo.team) && myInfo.team.length > 0
            ? myInfo.team
            : myInfo.pet
                ? [myInfo.pet]
                : [];

        const activePetId = myInfo.activePetId || myInfo.pet?.id || null;

        return team.filter(pet => (
            pet?.id &&
            pet.id !== activePetId &&
            Number(pet.hp ?? 0) > 0
        ));
    })();

    const pendingSwitchRoles = Array.isArray(battleState.pendingSwitch?.roles)
        ? battleState.pendingSwitch.roles
        : [];
    const pendingSwitchForMe = battleState.status === 'pending_switch' && pendingSwitchRoles.includes(myRole);
    const pendingSwitchPets = (() => {
        if (!pendingSwitchForMe || !myInfo) return [];

        const team = Array.isArray(myInfo.team) && myInfo.team.length > 0
            ? myInfo.team
            : myInfo.pet
                ? [myInfo.pet]
                : [];

        const activePetId = myInfo.activePetId || myInfo.pet?.id || null;

        return team.filter(pet => (
            pet?.id &&
            pet.id !== activePetId &&
            Number(pet.hp ?? 0) > 0
        ));
    })();

    const showActionMenu = battleState.status === 'action' && isAttacker && !battleState.attackerAction;
    const showDefenseMenu = battleState.status === 'action' && !isAttacker && !battleState.defenderAction;

    // M15_FLEE_LIMIT_AND_FLEE_WIN_PATCH
    // 도망은 플레이어당 전투 1회만 시도할 수 있습니다.
    const fleeAttemptedByMe = Array.isArray(battleState.fleeAttemptedBy)
        && battleState.fleeAttemptedBy.includes(myPlayerData.id);

    const availableDefenseActions = fleeAttemptedByMe
        ? Object.fromEntries(Object.entries(DEFENSE_ACTIONS).filter(([key]) => key !== 'FLEE'))
        : DEFENSE_ACTIONS;

    const myEquippedSkills = (myInfo.pet.equippedSkills || [])
        .filter(id => id.toLowerCase() !== 'tackle')
        .map(id => {
            const skill = SKILLS[id.toUpperCase()];
            return skill ? { ...skill, id: id.toUpperCase() } : null;
        })
        .filter(Boolean);

    const showTimer = (battleState.status === 'quiz' || battleState.status === 'action' || battleState.status === 'pending_switch');
    const isStunned = myInfo.pet.status?.stunned;
    const isBound = myInfo.pet.status?.bound;
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

                <button
                    onClick={handleToggleBgm}
                    title={bgmEnabled ? '배틀 배경음악 끄기' : '배틀 배경음악 켜기'}
                    style={{
                        padding: '0.2rem 0.7rem',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        border: bgmEnabled ? '1px solid #51cf66' : '1px solid #dee2e6',
                        background: bgmEnabled ? '#ebfbee' : '#f8f9fa',
                        color: bgmEnabled ? '#2b8a3e' : '#495057',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    {bgmEnabled ? '🎵 BGM ON' : '🎵 BGM OFF'}
                </button>
            </ScaleControlBar>
            <Arena $scale={battleScale}>
                {battleState.status === 'pending' || battleState.status === 'starting' ? (
                    <WaitingText>{battleState.log}</WaitingText>
                ) : (
                    <>
                        <BattleField>
                            {showTimer && <Timer $variant={battleState.status === 'pending_switch' ? 'switch' : undefined}>{timeLeft}</Timer>}
                            {switchMessage && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, calc(-50% + 78px))',
                                        zIndex: 30,
                                        padding: '0.65rem 1.1rem',
                                        borderRadius: '999px',
                                        background: 'rgba(33, 37, 41, 0.88)',
                                        color: 'white',
                                        fontWeight: 900,
                                        fontSize: '1rem',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                                        pointerEvents: 'none',
                                        textAlign: 'center',
                                        maxWidth: '80%',
                                    }}
                                >
                                    ✨ {switchMessage}
                                </div>
                            )}
                            {currentEffect && (
                                <BattleSkillEffect
                                    type={currentEffect.type}
                                    isMine={currentEffect.isMine}
                                />
                            )}

                            {/* --- 상대 정보 표시 --- */}
                            <BattlePlayerPanel
                                isMine={false}
                                info={opponentInfo}
                                avatarSourceInfo={opponentInfo}
                                WrapperComponent={OpponentProfileWrapper}
                                AvatarBoxComponent={AvatarBox}
                                InfoBoxComponent={OpponentInfoBox}
                                renderHpBar={renderHpBar}
                                renderSpBar={renderSpBar}
                            />
                            <BattleTeamMiniBar
                                isMine={false}
                                info={opponentInfo}
                                getPetImageSrc={getPetImageSrc}
                            />

                            {/* --- 나의 정보 표시 --- */}
                            <BattlePlayerPanel
                                isMine={true}
                                info={myInfo}
                                avatarSourceInfo={myPlayerData}
                                WrapperComponent={MyProfileWrapper}
                                AvatarBoxComponent={AvatarBox}
                                InfoBoxComponent={MyInfoBox}
                                renderHpBar={renderHpBar}
                                renderSpBar={renderSpBar}
                            />
                            <BattleTeamMiniBar
                                isMine={true}
                                info={myInfo}
                                getPetImageSrc={getPetImageSrc}
                            />
                            <BattlePetSlot
                                isMine={false}
                                info={opponentInfo}
                                imageSrc={getPetImageSrc(opponentInfo, false)}
                                hitState={hitState.opponent}
                                animType={animState.opponent}
                                introActive={(typeof introActive !== 'undefined' ? introActive : false) || switchIntro.opponent}
                                dotEffect={dotEffect}
                                chatEntry={battleState.chat?.[opponentInfo.id]}
                                WrapperComponent={OpponentPetContainerWrapper}
                                PetContainerComponent={PetContainer}
                                PetImageComponent={PetImage}
                                ChatBubbleComponent={ChatBubble}
                            />
                            <BattlePetSlot
                                isMine={true}
                                info={myInfo}
                                imageSrc={getPetImageSrc(myInfo, true)}
                                hitState={hitState.my}
                                animType={animState.my}
                                introActive={(typeof introActive !== 'undefined' ? introActive : false) || switchIntro.my}
                                dotEffect={dotEffect}
                                chatEntry={battleState.chat?.[myInfo.id]}
                                WrapperComponent={MyPetContainerWrapper}
                                PetContainerComponent={PetContainer}
                                PetImageComponent={PetImage}
                                ChatBubbleComponent={ChatBubble}
                            />
                        </BattleField>

                        <QuizArea>
                            <div>
                                <LogText>{battleState.log}</LogText>
                                {battleState.status === 'switching' && (
                                    <div style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        borderRadius: '16px',
                                        background: '#fff9db',
                                        border: '2px solid #ffd43b',
                                        color: '#5f3dc4',
                                        fontWeight: 900,
                                        textAlign: 'center',
                                        lineHeight: 1.6,
                                    }}>
                                        <div style={{ fontSize: '1.25rem' }}>🔁 펫 교체 중!</div>
                                        <div>새 펫이 등장했습니다. 잠시 후 다음 문제가 시작됩니다.</div>
                                    </div>
                                )}
                                {battleState.status === 'pending_switch' && (
                                    <RightTaskCard style={{
                                        marginTop: '1rem',
                                        background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                        borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                        color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                                    }}>
                                        {pendingSwitchForMe ? (
                                            <>
                                                <div style={{ fontSize: '1.18rem', marginBottom: '0.25rem' }}>💫 다음 펫 선택</div>
                                                <div style={{ fontSize: '0.9rem' }}>오른쪽 영역에서 다음 펫을 고르세요.</div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '1.18rem' }}>⏳ 상대 선택 대기 중</div>
                                                <div style={{ fontSize: '0.9rem' }}>상대가 다음 펫을 고르는 중입니다.</div>
                                            </>
                                        )}
                                    </RightTaskCard>
                                )}
                                {battleState.status === 'quiz' && battleState.question && (
                                    <>
                                        <BattlePrompt>Q. {battleState.question.question}</BattlePrompt>
                                        {isStunned ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: '#e03131', background: '#fff5f5', borderColor: '#ffc9c9' }}>
                                                <div style={{ fontSize: '1.15rem' }}>😵 혼란 상태!</div>
                                                <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>아무것도 할 수 없습니다. 상대방의 행동을 기다립니다.</div>
                                            </RightTaskCard>
                                        ) : hasSubmitted && (isOX || hasOptions) ? (
                                            <RightTaskCard style={{ marginTop: '1rem', color: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#2b8a3e' : '#c92a2a', background: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#ebfbee' : '#fff5f5', borderColor: battleState.chat?.[myPlayerData.id]?.isCorrect ? '#b2f2bb' : '#ffc9c9' }}>
                                                {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                    ? "정답입니다! 오른쪽 영역에서 다음 행동을 기다려주세요."
                                                    : "오답입니다... 상대방의 결과를 기다리고 있습니다."}
                                            </RightTaskCard>
                                        ) : (
                                            <div style={{ marginTop: '0.75rem', color: '#868e96', fontWeight: 800 }}>
                                                정답 입력과 선택지는 오른쪽 영역에 표시됩니다.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <RightActionPanel>
                                {battleState.status === 'pending_switch' && (
                                    <RightTaskCard style={{
                                        background: pendingSwitchForMe ? '#f3f0ff' : '#f8f9fa',
                                        borderColor: pendingSwitchForMe ? '#7950f2' : '#dee2e6',
                                        color: pendingSwitchForMe ? '#5f3dc4' : '#495057',
                                    }}>
                                        {pendingSwitchForMe ? (
                                            <>
                                                <div style={{ fontSize: '1.12rem', marginBottom: '0.45rem' }}>💫 출전할 펫 선택</div>
                                                <div style={{ fontSize: '0.84rem', marginBottom: '0.65rem', opacity: 0.85 }}>
                                                    10초 안에 고르세요. 시간이 지나면 자동 선택됩니다.
                                                </div>
                                                <div style={{ display: 'grid', gap: '0.55rem' }}>
                                                    {pendingSwitchPets.map(pet => (
                                                        <MenuItem
                                                            key={pet.id}
                                                            onClick={() => handleFaintedPetSwitch(pet.id)}
                                                            disabled={isProcessing}
                                                            style={{
                                                                backgroundColor: 'white',
                                                                borderColor: '#7950f2',
                                                                color: '#5f3dc4',
                                                                flexDirection: 'column',
                                                                gap: '0.15rem',
                                                            }}
                                                        >
                                                            <span>{pet.name}</span>
                                                            <small>Lv.{pet.level || 1} · HP {Math.max(0, Number(pet.hp ?? 0))}/{pet.maxHp ?? '?'}</small>
                                                        </MenuItem>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '1.12rem' }}>⏳ 상대 선택 대기</div>
                                                <div style={{ fontSize: '0.86rem', marginTop: '0.35rem', opacity: 0.85 }}>
                                                    상대가 선택하거나 시간이 지나면 다음 문제가 시작됩니다.
                                                </div>
                                            </>
                                        )}
                                    </RightTaskCard>
                                )}

                                {battleState.status === 'quiz' && battleState.question && !isStunned && (
                                    <RightTaskCard style={{ background: '#ffffff', borderColor: '#339af0' }}>
                                        <div style={{ fontSize: '1.05rem', marginBottom: '0.6rem', color: '#1864ab' }}>✏️ 정답 선택</div>
                                        {(() => {
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
                                        {hasSubmitted && (isOX || hasOptions) && (
                                            <div style={{ textAlign: 'center', marginTop: '12px', color: '#666', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                {battleState.chat?.[myPlayerData.id]?.isCorrect
                                                    ? "정답입니다! 처리 중..."
                                                    : "오답입니다... 대기 중"}
                                            </div>
                                        )}
                                    </RightTaskCard>
                                )}

                                <BattleActionMenu
                                    isStunned={isStunned}
                                    isBound={isBound}
                                    showActionMenu={showActionMenu}
                                    showDefenseMenu={showDefenseMenu}
                                    actionSubMenu={actionSubMenu}
                                    setActionSubMenu={setActionSubMenu}
                                    myEquippedSkills={myEquippedSkills}
                                    myInfo={myInfo}
                                    usableItems={usableItems}
                                    getSkillCost={getSkillCost}
                                    handleActionSelect={handleActionSelect}
                                    handleUseItem={handleUseItem}
                                    switchablePets={showActionMenu && !myInfo?.pet?.status?.bound ? switchablePets : []}
                                    handleManualSwitch={handleManualSwitch}
                                    DEFENSE_ACTIONS={availableDefenseActions}
                                    ActionMenuComponent={ActionMenu}
                                    MenuItemComponent={MenuItem}
                                />
                            </RightActionPanel>
                        </QuizArea>
                    </>
                )}
            </Arena>
            {battleState?.status === 'finished' && (() => {
                const isWin = battleState.winner === myPlayerData?.id;
                const isDraw = !battleState.winner;
                // M17_TEAM_RESULT_MODAL_PATCH
                // 2v2/3v3에서는 파트너 펫 1마리보다 이번 배틀 팀 전체를 보여주는 편이 자연스럽습니다.
                const resultParticipant = rawMyInfo || myInfo || {};
                const battleTeam = Array.isArray(resultParticipant.team) && resultParticipant.team.length > 0
                    ? resultParticipant.team
                    : resultParticipant.pet
                        ? [resultParticipant.pet]
                        : [];

                const latestPetMap = new Map((myPlayerData?.pets || []).map(pet => [pet.id, pet]));
                const participatedIds = new Set([
                    ...(Array.isArray(resultParticipant.participatedPetIds) ? resultParticipant.participatedPetIds : []),
                    resultParticipant.pet?.id,
                ].filter(Boolean));

                const resultTeamPets = battleTeam.map(pet => ({
                    ...pet,
                    ...(latestPetMap.get(pet.id) || {}),
                    participated: participatedIds.has(pet.id),
                }));

                const resultSummary = battleState.resultSummary || localResultSummary || null;
                const isFleeResult = Boolean(battleState.fledBy || resultSummary?.fled);
                const pointChange = resultSummary?.pointChanges?.[myPlayerData?.id];
                const pointChangeText = Number.isFinite(Number(pointChange))
                    ? Number(pointChange) > 0
                        ? `+${Number(pointChange)}P`
                        : Number(pointChange) < 0
                            ? `${Number(pointChange)}P`
                            : '0P'
                    : null;

                const myExpGains = resultSummary
                    ? (
                        battleState.winner === myPlayerData?.id
                            ? (resultSummary.winnerPetExpGains || [])
                            : (resultSummary.loserPetExpGains || [])
                    )
                    : [];

                const totalExpGain = myExpGains.reduce((sum, item) => sum + Number(item.exp || 0), 0);
                const expGainMap = new Map(myExpGains.map(item => [item.petId, item.exp]));
                const hasRewardSummary = Boolean(resultSummary && (pointChangeText !== null || totalExpGain > 0));
                const color = isDraw ? '#6c757d' : isWin ? '#007bff' : '#dc3545';
                return (
                    <ModalBackground>
                        <ModalContent $color={color}>
                            <h2>
                                {isDraw
                                    ? '무승부'
                                    : isFleeResult && isWin
                                        ? '🏃 도망 승리!'
                                        : isFleeResult
                                            ? '🏃 도망 처리'
                                            : isWin
                                                ? '🏆 승리!'
                                                : '💀 패배...'}
                            </h2>
                            <p>{battleState.log}</p>
                            {!isDraw && !hasRewardSummary && battleState.resultSummaryError && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.18)',
                                    borderRadius: '12px',
                                    padding: '0.8rem 1rem',
                                    margin: '0.6rem 0 1rem',
                                    fontWeight: 900,
                                }}>
                                    ⚠️ 보상 요약을 불러오지 못했습니다. 실제 보상은 처리되었을 수 있습니다.
                                </div>
                            )}
                            {hasRewardSummary && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.18)',
                                    borderRadius: '12px',
                                    padding: '0.8rem 1rem',
                                    margin: '0.6rem 0 1rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: '0.6rem',
                                    fontWeight: 900,
                                }}>
                                    {pointChangeText !== null && (
                                        <div>
                                            <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>포인트 변화</div>
                                            <div style={{ fontSize: '1.1rem' }}>
                                                {Number(pointChange) > 0 ? '💰 ' : Number(pointChange) < 0 ? '💸 ' : '➖ '}
                                                {pointChangeText}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>획득 경험치</div>
                                        <div style={{ fontSize: '1.1rem' }}>✨ +{totalExpGain} EXP</div>
                                    </div>
                                    {isFleeResult && resultSummary?.fleeRewardPercent && (
                                        <div>
                                            <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>도망 보상</div>
                                            <div style={{ fontSize: '1.1rem' }}>{resultSummary.fleeRewardPercent}% 반영</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {resultTeamPets.length > 0 && (
                                <div style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    borderRadius: '12px',
                                    padding: '0.75rem 1rem',
                                    margin: '0.5rem 0 1rem',
                                    fontSize: '0.88rem',
                                }}>
                                    <div style={{ fontWeight: 900, marginBottom: '0.55rem', opacity: 0.9 }}>
                                        이번 배틀 팀
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                        gap: '0.5rem',
                                    }}>
                                        {resultTeamPets.map(pet => (
                                            <div
                                                key={pet.id}
                                                style={{
                                                    background: pet.participated ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
                                                    border: pet.participated ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.16)',
                                                    borderRadius: '10px',
                                                    padding: '0.5rem',
                                                    opacity: pet.participated ? 1 : 0.72,
                                                }}
                                            >
                                                <div style={{ fontWeight: 900, marginBottom: '0.25rem' }}>
                                                    {pet.participated ? '✅' : '대기'} {pet.name}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                                                    Lv.{pet.level || 1} · HP {Math.max(0, Number(pet.hp ?? 0))}/{pet.maxHp ?? '?'}
                                                </div>
                                                {Number(expGainMap.get(pet.id) || 0) > 0 && (
                                                    <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', fontWeight: 900 }}>
                                                        ✨ +{expGainMap.get(pet.id)} EXP
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', opacity: 0.9 }}>
                                                    🏆 {pet.battleWins || 0}승 · 💀 {pet.battleLosses || 0}패
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '0.45rem', fontSize: '0.76rem', opacity: 0.78 }}>
                                        ✅ 표시된 펫은 이번 배틀에 실제로 출전한 펫입니다.
                                    </div>
                                </div>
                            )}
                            <button onClick={() => navigate('/pet')}>확인</button>
                        </ModalContent>
                    </ModalBackground>
                );
            })()}
        </>
    );
}

export default BattlePage;