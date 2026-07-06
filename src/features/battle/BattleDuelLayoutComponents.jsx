// src/features/battle/BattleDuelLayoutComponents.jsx
// BATTLE_DUEL_LAYOUT_COMPONENTS_EXTRACTED_FROM_BATTLE_PAGE
// 기존 BattlePage.jsx의 전투 화면 styled-components를 그대로 복사한 공통 레이아웃 모듈입니다.
// 전투 규칙이 아니라 화면 스타일만 담당합니다.

import styled, { keyframes, css } from 'styled-components';

const BattleUtilityBar = styled.div`
  max-width: 1200px;
  margin: 0.35rem auto 0.35rem;
  padding: 0 0.5rem;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.45rem;
  pointer-events: auto;

  @media (orientation: landscape) and (max-height: 760px) {
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100vw;
    max-width: none;
    margin: 0;
    padding: 0.25rem 0.45rem;
    background: rgba(240, 248, 255, 0.92);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(51, 154, 240, 0.18);
  }
`;

const UtilityButton = styled.button`
  padding: 0.38rem 0.7rem;
  font-size: 0.82rem;
  line-height: 1;
  border-radius: 999px;
  border: 1px solid ${props => props.$active ? '#51cf66' : '#339af0'};
  background: ${props => props.$active ? '#ebfbee' : '#ffffff'};
  color: ${props => props.$active ? '#2b8a3e' : '#1864ab'};
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);

  &:active {
    transform: translateY(1px);
  }

  @media (orientation: landscape) and (max-height: 760px) {
    padding: 0.32rem 0.62rem;
    font-size: 0.76rem;
  }
`;

const Arena = styled.div`
  max-width: 1200px;
  margin: 1rem auto 2rem;
  padding: 1.25rem;
  background-color: #f0f8ff;
  border-radius: 24px;
  border: 5px solid #a5d8ff;
  overflow: visible;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);

  @media (orientation: landscape) and (max-height: 760px) {
    width: 100vw;
    max-width: none;
    min-height: auto;
    margin: 0;
    padding: 0.45rem;
    border-radius: 0;
    border-width: 0;
    box-shadow: none;
  }

  @media (max-width: 900px) {
    margin-top: 0.5rem;
    padding: 0.75rem;
  }
`;

const WaitingText = styled.div`
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    height: 300px; font-size: 1.5rem; color: #495057; gap: 1.5rem; font-weight: 700;
`;

const getBattleFieldThemeCss = (theme = 'forest') => {
  switch (theme) {
    case 'sunset':
      return css`
        border-color: #ff922b;
        background:
          radial-gradient(circle at 18% 18%, rgba(255, 236, 153, 0.9) 0 8%, transparent 9%),
          linear-gradient(to bottom, #ff922b 0%, #ffc078 35%, #ffe8cc 36%, #ffa94d 100%);
        box-shadow:
          inset 0 0 0 4px rgba(255,255,255,0.42),
          inset 0 -18px 0 rgba(230, 119, 0, 0.2),
          0 8px 20px rgba(0,0,0,0.1);

        &::before {
          opacity: 0.33;
          background-image:
            linear-gradient(rgba(255,255,255,0.38) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255,255,255,0.22) 2px, transparent 2px);
          background-size: 26px 26px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(201, 101, 0, 0.26) 0 8px,
              rgba(255, 169, 77, 0.28) 8px 16px
            );
          border-color: rgba(230, 119, 0, 0.38);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.25),
            0 12px 0 rgba(230, 119, 0, 0.16);
        }
      `;

    case 'ice':
      return css`
        border-color: #74c0fc;
        background:
          radial-gradient(circle at 20% 22%, rgba(255,255,255,0.75) 0 7%, transparent 8%),
          radial-gradient(circle at 78% 18%, rgba(255,255,255,0.45) 0 5%, transparent 6%),
          linear-gradient(to bottom, #d0ebff 0%, #e7f5ff 37%, #a5d8ff 38%, #74c0fc 100%);
        box-shadow:
          inset 0 0 0 4px rgba(255,255,255,0.55),
          inset 0 -18px 0 rgba(24, 100, 171, 0.16),
          0 8px 20px rgba(0,0,0,0.08);

        &::before {
          opacity: 0.42;
          background-image:
            linear-gradient(135deg, rgba(255,255,255,0.7) 2px, transparent 2px),
            linear-gradient(45deg, rgba(255,255,255,0.28) 2px, transparent 2px);
          background-size: 28px 28px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(116, 192, 252, 0.28) 0 8px,
              rgba(208, 235, 255, 0.35) 8px 16px
            );
          border-color: rgba(51, 154, 240, 0.42);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.32),
            0 12px 0 rgba(24, 100, 171, 0.12);
        }
      `;

    case 'star':
      return css`
        border-color: #845ef7;
        background:
          radial-gradient(circle at 16% 20%, rgba(255,255,255,0.95) 0 2px, transparent 3px),
          radial-gradient(circle at 68% 14%, rgba(255,255,255,0.85) 0 2px, transparent 3px),
          radial-gradient(circle at 86% 30%, rgba(255,255,255,0.75) 0 2px, transparent 3px),
          linear-gradient(to bottom, #343a40 0%, #5f3dc4 38%, #6741d9 39%, #9775fa 100%);
        box-shadow:
          inset 0 0 0 4px rgba(255,255,255,0.25),
          inset 0 -18px 0 rgba(52, 58, 64, 0.18),
          0 8px 22px rgba(0,0,0,0.14);

        &::before {
          opacity: 0.28;
          background-image:
            linear-gradient(rgba(255,255,255,0.38) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255,255,255,0.25) 2px, transparent 2px);
          background-size: 24px 24px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(95, 61, 196, 0.32) 0 8px,
              rgba(151, 117, 250, 0.28) 8px 16px
            );
          border-color: rgba(255,255,255,0.34);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.20),
            0 12px 0 rgba(52, 58, 64, 0.18);
        }
      `;

    case 'thunder':
      return css`
        border-color: #ffd43b;
        background:
          linear-gradient(135deg, transparent 0 58%, rgba(255, 212, 59, 0.78) 59% 62%, transparent 63%),
          radial-gradient(circle at 70% 18%, rgba(255, 236, 153, 0.7) 0 9%, transparent 10%),
          linear-gradient(to bottom, #495057 0%, #868e96 38%, #ced4da 39%, #ffd43b 100%);
        box-shadow:
          inset 0 0 0 4px rgba(255,255,255,0.28),
          inset 0 -18px 0 rgba(245, 159, 0, 0.22),
          0 8px 22px rgba(0,0,0,0.13);

        &::before {
          opacity: 0.36;
          background-image:
            linear-gradient(rgba(255,255,255,0.34) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255, 212, 59, 0.35) 2px, transparent 2px);
          background-size: 24px 24px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(245, 159, 0, 0.30) 0 8px,
              rgba(255, 212, 59, 0.30) 8px 16px
            );
          border-color: rgba(245, 159, 0, 0.45);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.22),
            0 12px 0 rgba(52, 58, 64, 0.16);
        }
      `;

    case 'cherry':
      return css`
        border-color: #f783ac;
        background:
          radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.72) 0 5%, transparent 6%),
          radial-gradient(circle at 78% 22%, rgba(255, 222, 235, 0.9) 0 8%, transparent 9%),
          linear-gradient(to bottom, #fcc2d7 0%, #ffe3ec 38%, #d8f5a2 39%, #b2f2bb 100%);
        box-shadow:
          inset 0 0 0 4px rgba(255,255,255,0.48),
          inset 0 -18px 0 rgba(201, 42, 42, 0.12),
          0 8px 20px rgba(0,0,0,0.08);

        &::before {
          opacity: 0.38;
          background-image:
            radial-gradient(circle, rgba(240, 101, 149, 0.38) 0 3px, transparent 4px),
            linear-gradient(rgba(255,255,255,0.28) 2px, transparent 2px);
          background-size: 30px 30px, 24px 24px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(240, 101, 149, 0.18) 0 8px,
              rgba(81, 207, 102, 0.22) 8px 16px
            );
          border-color: rgba(240, 101, 149, 0.32);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.28),
            0 12px 0 rgba(47, 158, 68, 0.12);
        }
      `;

    case 'forest':
    default:
      return css`
        border-color: #8ce99a;
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
          opacity: 0.45;
          background-image:
            linear-gradient(rgba(255,255,255,0.42) 2px, transparent 2px),
            linear-gradient(90deg, rgba(255,255,255,0.32) 2px, transparent 2px);
          background-size: 24px 24px;
        }

        &::after {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(43, 138, 62, 0.22) 0 8px,
              rgba(81, 207, 102, 0.22) 8px 16px
            );
          border-color: rgba(47, 158, 68, 0.35);
          box-shadow:
            inset 0 0 0 6px rgba(255,255,255,0.25),
            0 12px 0 rgba(47, 158, 68, 0.15);
        }
      `;
  }
};

const BattleField = styled.div`
  height: 550px;
  position: relative;
  margin-bottom: 1.25rem;
  overflow: visible;
  border-radius: 20px;
  border: 3px solid;
  transition: background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease;

  ${props => getBattleFieldThemeCss(props.$theme)}

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 17px;
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
    border: 4px solid;
    z-index: 0;
  }

  > * {
    z-index: 1;
  }

  @media (orientation: landscape) and (max-height: 760px) {
    height: clamp(315px, 48dvh, 380px);
    margin-bottom: 0.45rem;
    border-radius: 14px;
    border-width: 2px;

    &::before {
      border-radius: 12px;
      background-size: 18px 18px;
    }

    &::after {
      bottom: 20px;
      height: 70px;
      border-width: 3px;
    }
  }
`;

const QuizArea = styled.div`
  padding: 1.15rem;
  background-color: #fff;
  border: 2px solid #339af0;
  border-radius: 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
  gap: 1.25rem;
  min-height: 190px;
  box-shadow: 0 4px 15px rgba(51, 154, 240, 0.1);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  @media (orientation: landscape) and (max-height: 760px) {
    grid-template-columns: minmax(0, 1fr) minmax(250px, 31vw);
    gap: 0.6rem;
    min-height: 0;
    padding: 0.65rem;
    border-radius: 14px;
  }
`;

const PetContainerWrapper = styled.div`
  position: absolute;
  width: 400px;
  height: 400px;

  @media (max-width: 768px) {
    width: 300px;
    height: 300px;
  }

  @media (orientation: landscape) and (max-height: 760px) {
    width: clamp(190px, 26dvh, 245px);
    height: clamp(190px, 26dvh, 245px);
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

  span {
    font-weight: 800;
    color: #343a40;
    font-size: 1.05rem;
    margin-bottom: 0.2rem;
  }

  @media (max-width: 768px) {
    width: 170px;
    padding: 0.8rem;

    span {
      font-size: 0.9rem;
    }
  }

  @media (orientation: landscape) and (max-height: 760px) {
    width: 172px;
    padding: 0.55rem;
    gap: 0.28rem;
    border-radius: 12px;

    span {
      font-size: 0.82rem;
      margin-bottom: 0;
    }
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

const LogText = styled.p`
  font-size: 1.2rem;
  font-weight: 700;
  min-height: 42px;
  margin: 0 0 0.65rem 0;
  color: #343a40;
  display: flex;
  align-items: center;
  white-space: pre-line;

  @media (orientation: landscape) and (max-height: 760px) {
    font-size: 0.95rem;
    min-height: 28px;
    margin-bottom: 0.35rem;
    line-height: 1.35;
  }

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    font-size: 0.86rem;
    min-height: 24px;
    margin-bottom: 0.28rem;
    line-height: 1.28;
  }
`;

const BattlePrompt = styled.h3`
  margin: 0.65rem 0 0;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  color: #212529;
  font-size: 1.15rem;
  line-height: 1.5;

  @media (orientation: landscape) and (max-height: 760px) {
    margin-top: 0.35rem;
    padding: 0.56rem 0.7rem;
    border-radius: 12px;
    font-size: 0.94rem;
    line-height: 1.35;
  }

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    margin-top: 0.32rem;
    padding: 0.52rem 0.62rem;
    font-size: 0.88rem;
    line-height: 1.32;
  }
`;

const RightTaskCard = styled.div`
  padding: 0.9rem;
  border-radius: 16px;
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  color: #343a40;
  font-weight: 900;
  text-align: center;
  line-height: 1.5;

  @media (orientation: landscape) and (max-height: 760px) {
    padding: 0.62rem;
    border-radius: 12px;
    line-height: 1.32;
  }

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    padding: 0.52rem;
    border-radius: 11px;
    line-height: 1.28;
  }
`;

const OptionButton = styled.button`
    padding: 1rem;
    font-size: 1.02rem;
    font-weight: 800;
    border: 2px solid #dee2e6;
    border-radius: 12px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s;
    color: #495057;
    word-break: keep-all;

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

    @media (orientation: landscape) and (max-height: 760px) {
        min-height: 58px;
        padding: 0.56rem;
        font-size: 0.88rem;
        line-height: 1.25;
        border-radius: 10px;
    }

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    min-height: 54px;
    padding: 0.48rem;
    font-size: 0.82rem;
    line-height: 1.22;
  }
`;

const OXButton = styled.button`
    padding: 1.25rem;
    font-size: 2.8rem;
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

    @media (orientation: landscape) and (max-height: 760px) {
        padding: 0.72rem;
        font-size: 2.15rem;
        border-radius: 12px;
    }

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    padding: 0.68rem;
    font-size: 2rem;
  }
`;

const ActionMenu = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem;

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    gap: 0.45rem;
  }
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

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    min-height: 48px;
    padding: 0.48rem;
    font-size: 0.82rem;
    line-height: 1.22;
  }
`;

const BattleContentGrid = styled.div`
  display: block;

  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(300px, 31vw, 345px);
    gap: 0.55rem;
    align-items: stretch;
    overflow: visible;

    ${BattleField} {
      height: clamp(390px, calc(100dvh - 112px), 520px);
      margin-bottom: 0;
      overflow: visible;
    }

    ${QuizArea} {
      height: clamp(390px, calc(100dvh - 112px), 520px);
      min-height: 0;
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 0.55rem;
      align-content: start;
      padding: 0.62rem;
      overflow-y: auto;
      overflow-x: visible;
      overscroll-behavior: contain;
    }

    ${PetContainerWrapper} {
      width: clamp(285px, 45dvh, 360px);
      height: clamp(285px, 45dvh, 360px);
    }

    ${InfoBox} {
      width: clamp(150px, 17vw, 185px);
      padding: 0.48rem;
      gap: 0.24rem;
      border-radius: 12px;
    }

    ${InfoBox} span {
      font-size: 0.78rem;
      margin-bottom: 0;
    }

    ${AvatarBox} {
      gap: 3px;
    }

    ${AvatarBox} .avatar-img-frame {
      width: 42px;
      height: 42px;
      border-width: 2px;
      border-radius: 10px;
    }

    ${AvatarBox} .name-badge {
      font-size: 0.64rem;
      padding: 2px 7px;
      border-radius: 999px;
    }
  }

  @media (orientation: landscape) and (max-height: 700px) and (min-width: 920px) {
    grid-template-columns: minmax(0, 1fr) clamp(288px, 30vw, 330px);
    gap: 0.45rem;

    ${BattleField} {
      height: clamp(360px, calc(100dvh - 106px), 480px);
    }

    ${QuizArea} {
      height: clamp(360px, calc(100dvh - 106px), 480px);
      padding: 0.55rem;
      gap: 0.45rem;
    }

    ${PetContainerWrapper} {
      width: clamp(260px, 41dvh, 325px);
      height: clamp(260px, 41dvh, 325px);
    }

    ${InfoBox} {
      width: clamp(142px, 16vw, 172px);
      padding: 0.42rem;
    }
  }

  @media (orientation: landscape) and (max-height: 620px) and (min-width: 920px) {
    grid-template-columns: minmax(0, 1fr) clamp(276px, 29vw, 315px);

    ${BattleField} {
      height: clamp(330px, calc(100dvh - 96px), 430px);
    }

    ${QuizArea} {
      height: clamp(330px, calc(100dvh - 96px), 430px);
    }

    ${PetContainerWrapper} {
      width: clamp(235px, 38dvh, 285px);
      height: clamp(235px, 38dvh, 285px);
    }
  }

  /* M35_RIGHT_PANEL_READABLE_FONT_PATCH
     태블릿 가로 오른쪽 문제 패널에서 학생이 실제로 읽고 누르는 영역만 선택적으로 키웁니다. */
  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    ${QuizArea} {
      font-size: 0.95rem;
    }

    ${LogText} {
      font-size: 0.92rem;
      line-height: 1.34;
      min-height: 28px;
      margin-bottom: 0.34rem;
    }

    ${BattlePrompt} {
      font-size: 1rem;
      line-height: 1.38;
      padding: 0.62rem 0.72rem;
      margin-top: 0.36rem;
    }

    ${RightTaskCard} {
      font-size: 0.94rem;
      line-height: 1.34;
    }

    ${RightTaskCard} > div:first-child {
      font-size: 0.98rem !important;
    }

    ${OptionButton} {
      min-height: 58px;
      font-size: 0.95rem;
      line-height: 1.25;
      padding: 0.55rem;
    }

    ${OXButton} {
      font-size: 2.08rem;
      padding: 0.68rem;
    }
  }

  @media (orientation: landscape) and (max-height: 700px) and (min-width: 920px) {
    ${LogText} {
      font-size: 0.88rem;
      line-height: 1.28;
      min-height: 24px;
    }

    ${BattlePrompt} {
      font-size: 0.94rem;
      line-height: 1.32;
      padding: 0.52rem 0.62rem;
    }

    ${RightTaskCard} {
      font-size: 0.9rem;
      line-height: 1.28;
    }

    ${RightTaskCard} > div:first-child {
      font-size: 0.94rem !important;
    }

    ${OptionButton} {
      min-height: 54px;
      font-size: 0.9rem;
      line-height: 1.22;
      padding: 0.48rem;
    }

    ${OXButton} {
      font-size: 1.96rem;
      padding: 0.62rem;
    }
  }

  /* M36_RIGHT_PANEL_UNIFIED_FONT_PATCH
     오른쪽 문제 패널에서 문제/선택지 단계와 공격/방어 버튼 단계의 글씨 크기 차이를 줄입니다.
     학생이 읽고 누르는 패널 내부 요소를 0.96rem~1rem 톤으로 통일합니다. */
  @media (orientation: landscape) and (max-height: 1000px) and (min-width: 920px) {
    ${QuizArea} {
      font-size: 0.98rem;
    }

    ${LogText} {
      font-size: 0.94rem;
      line-height: 1.34;
      min-height: 28px;
      margin-bottom: 0.32rem;
    }

    ${BattlePrompt} {
      font-size: 1rem;
      line-height: 1.36;
      padding: 0.58rem 0.68rem;
      margin-top: 0.32rem;
    }

    ${RightTaskCard} {
      font-size: 0.96rem;
      line-height: 1.34;
    }

    ${RightTaskCard} > div:first-child {
      font-size: 0.98rem !important;
      line-height: 1.3;
    }

    ${OptionButton} {
      min-height: 58px;
      font-size: 0.96rem;
      line-height: 1.25;
      padding: 0.54rem;
    }

    ${OXButton} {
      font-size: 2.04rem;
      padding: 0.66rem;
    }

    ${ActionMenu} {
      gap: 0.46rem;
    }

    ${MenuItem} {
      min-height: 52px;
      font-size: 0.96rem;
      line-height: 1.24;
      padding: 0.52rem 0.56rem;
    }

    ${MenuItem} strong,
    ${MenuItem} span,
    ${MenuItem} small {
      font-size: inherit;
      line-height: inherit;
    }

  }

  @media (orientation: landscape) and (max-height: 700px) and (min-width: 920px) {
    ${QuizArea} {
      font-size: 0.92rem;
    }

    ${LogText} {
      font-size: 0.88rem;
      line-height: 1.28;
      min-height: 24px;
    }

    ${BattlePrompt} {
      font-size: 0.92rem;
      line-height: 1.3;
      padding: 0.48rem 0.58rem;
    }

    ${RightTaskCard} {
      font-size: 0.9rem;
      line-height: 1.28;
    }

    ${RightTaskCard} > div:first-child {
      font-size: 0.92rem !important;
    }

    ${OptionButton} {
      min-height: 52px;
      font-size: 0.9rem;
      line-height: 1.22;
      padding: 0.46rem;
    }

    ${OXButton} {
      font-size: 1.9rem;
      padding: 0.58rem;
    }

    ${MenuItem} {
      min-height: 48px;
      font-size: 0.9rem;
      line-height: 1.22;
      padding: 0.46rem 0.5rem;
    }

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

const floatingDamagePop = keyframes`
  0% {
    opacity: 0;
    transform: translate(-50%, 10px) scale(0.72);
    filter: brightness(1);
  }
  16% {
    opacity: 1;
    transform: translate(-50%, -10px) scale(1.22);
    filter: brightness(1.35);
  }
  42% {
    opacity: 1;
    transform: translate(-50%, -26px) scale(1);
    filter: brightness(1.08);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -72px) scale(0.92);
    filter: brightness(1);
  }
`;

const FloatingDamageNumber = styled.div`
  position: absolute;
  z-index: 92;
  pointer-events: none;
  left: ${props => props.$side === 'my' ? '210px' : 'auto'};
  right: ${props => props.$side === 'opponent' ? '210px' : 'auto'};
  bottom: ${props => props.$side === 'my' ? '258px' : 'auto'};
  top: ${props => props.$side === 'opponent' ? '168px' : 'auto'};
  min-width: 118px;
  text-align: center;
  font-family: inherit;
  font-weight: 1000;
  letter-spacing: -0.04em;
  color: ${props => props.$color};
  text-shadow:
    -2px -2px 0 ${props => props.$stroke},
    2px -2px 0 ${props => props.$stroke},
    -2px 2px 0 ${props => props.$stroke},
    2px 2px 0 ${props => props.$stroke},
    0 0 14px ${props => props.$glow},
    0 5px 10px rgba(0,0,0,0.26);
  opacity: 0;
  margin-left: ${props => `${Number(props.$lane ?? 0) * 32}px`};
  animation: ${floatingDamagePop} ${props => props.$kind === 'critical' || props.$kind === 'reaction' ? '1.7s' : '1.45s'} cubic-bezier(.16,.88,.31,1.16) forwards;
  animation-delay: ${props => props.$delay ?? 0}ms;

  .damageLabel {
    display: block;
    margin-bottom: -0.08rem;
    font-size: ${props => props.$kind === 'critical' ? '1.18rem' : props.$kind === 'reaction' ? '0.88rem' : '0.74rem'};
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .damageAmount {
    display: block;
    font-size: ${props => props.$kind === 'critical' ? '3.45rem' : props.$kind === 'reaction' ? '2.55rem' : '2.12rem'};
    line-height: 1;
  }

  @media (max-width: 768px) {
    left: ${props => props.$side === 'my' ? '160px' : 'auto'};
    right: ${props => props.$side === 'opponent' ? '160px' : 'auto'};
    bottom: ${props => props.$side === 'my' ? '220px' : 'auto'};
    top: ${props => props.$side === 'opponent' ? '150px' : 'auto'};
  }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const reactionFlashPop = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.58) rotate(-4deg); filter: brightness(1); }
  18% { opacity: 1; transform: translate(-50%, -50%) scale(1.16) rotate(2deg); filter: brightness(1.42); }
  52% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); filter: brightness(1.16); }
  100% { opacity: 0; transform: translate(-50%, -58%) scale(1.22); filter: brightness(1); }
`;

const reactionFlashRing = keyframes`
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.42); }
  24% { opacity: 0.78; transform: translate(-50%, -50%) scale(1.0); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.85); }
`;

const ReactionFlashOverlay = styled.div`
  position: absolute;
  left: 50%;
  top: 46%;
  z-index: 90;
  pointer-events: none;
  min-width: 240px;
  padding: 0.9rem 1.55rem;
  border-radius: 999px;
  border: 3px solid color-mix(in srgb, ${props => props.$toneA} 58%, ${props => props.$toneB});
  background:
    radial-gradient(circle at 18% 30%, color-mix(in srgb, ${props => props.$toneA} 38%, transparent), transparent 42%),
    radial-gradient(circle at 82% 72%, color-mix(in srgb, ${props => props.$toneB} 42%, transparent), transparent 46%),
    rgba(255,255,255,0.88);
  box-shadow:
    0 0 28px color-mix(in srgb, ${props => props.$toneA} 46%, transparent),
    0 0 44px color-mix(in srgb, ${props => props.$toneB} 38%, transparent),
    inset 0 0 18px rgba(255,255,255,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.42rem;
  animation: ${reactionFlashPop} 1.15s ease-out forwards;

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 360px;
    height: 150px;
    border-radius: 999px;
    border: 4px solid color-mix(in srgb, ${props => props.$toneA} 42%, ${props => props.$toneB});
    box-shadow: 0 0 30px color-mix(in srgb, ${props => props.$toneB} 36%, transparent);
    animation: ${reactionFlashRing} 1.05s ease-out forwards;
  }

  .reactionIcon {
    position: relative;
    z-index: 1;
    font-size: 2.25rem;
    line-height: 1;
    filter: drop-shadow(0 0 6px rgba(255,255,255,0.9));
  }

  .reactionLabel {
    position: relative;
    z-index: 1;
    font-size: 1.65rem;
    font-weight: 1000;
    color: ${props => props.$text};
    letter-spacing: -0.03em;
    text-shadow: 0 2px 0 rgba(255,255,255,0.92), 0 0 10px rgba(255,255,255,0.9);
    white-space: nowrap;
  }
`;

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

const OpponentInfoBox = styled(InfoBox)` border-color: #fa5252; `;

const MyInfoBox = styled(InfoBox)` border-color: #339af0; `;

const OpponentPetContainerWrapper = styled(PetContainerWrapper)` top: 10px; right: 10px; `;

const MyPetContainerWrapper = styled(PetContainerWrapper)` bottom: 10px; left: 10px; `;

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
                                                        props.$animType === 'WAVE_MARK' ? css`${props.$isMine ? waterBallRight : waterBallLeft} 0.95s ease-in-out` :
                                                            props.$animType === 'BLOSSOM_CURRENT' ? css`${props.$isMine ? waterBallRight : waterBallLeft} 1.25s ease-in-out` :
                                                                props.$animType === 'ARA_BLOOM' ? css`${props.$isMine ? tornadoSweepRight : tornadoSweepLeft} 1.75s ease-in-out` :
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
  filter: ${props => props.$forceHidden
        ? 'brightness(1.35) drop-shadow(0 0 18px rgba(255,255,255,0.95))'
        : props.$isFainted
            ? 'grayscale(100%) brightness(0.75)'
            : 'drop-shadow(0 10px 10px rgba(0,0,0,0.1))'};
  opacity: ${props => props.$forceHidden ? 0 : props.$isFainted ? 0.55 : 1};
  transform: ${props => props.$forceHidden
        ? 'translateY(-18px) scale(0.78)'
        : props.$isFainted
            ? 'translateY(18px) rotate(-4deg) scale(0.92)'
            : 'none'};
  transition: filter 0.22s, opacity 0.16s ease, transform 0.22s ease;
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

const RightActionPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  align-self: stretch;
`;

const OXGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 1rem;


    @media (orientation: landscape) and (max-height: 760px) {
        gap: 7px;
        margin-top: 0.55rem;
    }
`;

const OptionGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 1rem;


    @media (orientation: landscape) and (max-height: 760px) {
        gap: 7px;
        margin-top: 0.55rem;
    }
`;

const AnswerInput = styled.input`
  width: 100%; padding: 1rem; font-size: 1.2rem; text-align: center;
  border: 2px solid #dee2e6; border-radius: 12px; margin-top: 1rem;
  font-weight: 700;
  &:focus { outline: none; border-color: #339af0; box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.1); }
`;

export const battleDuelLayoutComponents = {
    BattleUtilityBar,
    UtilityButton,
    Arena,
    WaitingText,
    BattleContentGrid,
    BattleField,
    Timer,
    FloatingDamageNumber,
    ReactionFlashOverlay,
    OpponentProfileWrapper,
    MyProfileWrapper,
    AvatarBox,
    OpponentInfoBox,
    MyInfoBox,
    OpponentPetContainerWrapper,
    MyPetContainerWrapper,
    PetContainer,
    PetImage,
    ChatBubble,
    QuizArea,
    LogText,
    RightTaskCard,
    BattlePrompt,
    RightActionPanel,
    OXGrid,
    OXButton,
    OptionGrid,
    OptionButton,
    AnswerInput,
    ActionMenu,
    MenuItem,
};
