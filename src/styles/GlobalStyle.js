// src/styles/GlobalStyle.js

// 1. createGlobalStyle 옆에 keyframes를 추가로 import 합니다.
import { createGlobalStyle, keyframes } from 'styled-components';

// 2. keyframes 함수를 사용해 bounce 애니메이션을 정의하고 export 합니다.
export const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
`;

// 3. GlobalStyle에서는 @keyframes 정의를 삭제합니다.
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f0f2f5;
  }

  * {
    box-sizing: border-box;
  }

  @keyframes battlePetIntroMine {
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
      filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));
    }
  }

  @keyframes battlePetIntroOpponent {
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
      filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));
    }
  }

  /*
    BattlePage 1차 연출 개선
    - styled-components 내부 파일을 대규모로 건드리지 않고, 배틀 필드 DOM 구조와 펫 이미지 alt를 기준으로 적용합니다.
    - 이후 BattlePage 컴포넌트 분리 단계에서 전용 styled component로 옮기기 좋게 독립된 블록으로 둡니다.
  */
  div:has(> div > div > img[alt="나의 펫"]):has(> div > div > img[alt="상대 펫"]) {
    overflow: hidden !important;
    border: 3px solid #8ce99a !important;
    background:
      linear-gradient(
        to bottom,
        #a5d8ff 0%,
        #d0ebff 38%,
        #b2f2bb 39%,
        #8ce99a 100%
      ) !important;
    box-shadow:
      inset 0 0 0 4px rgba(255,255,255,0.45),
      inset 0 -18px 0 rgba(47, 158, 68, 0.18),
      0 8px 20px rgba(0,0,0,0.08) !important;
  }

  div:has(> div > div > img[alt="나의 펫"]):has(> div > div > img[alt="상대 펫"])::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.45;
    background-image:
      linear-gradient(rgba(255,255,255,0.42) 2px, transparent 2px),
      linear-gradient(90deg, rgba(255,255,255,0.32) 2px, transparent 2px);
    background-size: 24px 24px;
    image-rendering: pixelated;
    z-index: 0;
  }

  div:has(> div > div > img[alt="나의 펫"]):has(> div > div > img[alt="상대 펫"])::after {
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

  div:has(> div > div > img[alt="나의 펫"]):has(> div > div > img[alt="상대 펫"]) > * {
    position: relative;
    z-index: 1;
  }

  img[alt="나의 펫"] {
    animation: battlePetIntroMine 1.05s cubic-bezier(.18,.89,.32,1.28) both;
  }

  img[alt="상대 펫"] {
    animation: battlePetIntroOpponent 1.05s cubic-bezier(.18,.89,.32,1.28) both;
  }

  @media (prefers-reduced-motion: reduce) {
    img[alt="나의 펫"],
    img[alt="상대 펫"] {
      animation: none;
    }
  }
`;

export default GlobalStyle;
