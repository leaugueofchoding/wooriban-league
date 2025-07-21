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
`;

export default GlobalStyle;