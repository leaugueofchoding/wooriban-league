import { createGlobalStyle } from 'styled-components';

// 모든 페이지의 기본 배경색, 글꼴 등을 설정하는 코드
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f0f2f5; // 기본 배경색을 연한 회색으로
  }

  * {
    box-sizing: border-box;
  }
`;

export default GlobalStyle;