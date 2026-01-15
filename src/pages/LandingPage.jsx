// src/pages/LandingPage.jsx

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, updateUserProfile } from '../api/firebase.js';
import { useNavigate } from 'react-router-dom';

// ▼▼▼ [이미지 넣는 법] ▼▼▼
// 1. 캡처한 이미지를 src/assets/landing 폴더에 저장하세요. (예: league.png)
// 2. 아래처럼 import 하세요. (지금은 예시로 비워둠)
// import imgLeague from '../assets/landing/league.png';
// import imgMission from '../assets/landing/mission.png';
// import imgPet from '../assets/landing/pet.png';
// import imgRoom from '../assets/landing/room.png';

// --- Animations ---
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

// --- Layout & Sections ---
const PageContainer = styled.div`
  overflow-x: hidden;
  width: 100%;
`;

const Section = styled.section`
  padding: 6rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  
  &.hero {
    min-height: 100vh;
    padding-top: 4rem;
    background: radial-gradient(circle at 50% 50%, #ffffff 0%, #f1f3f5 100%);
  }

  &.dark {
    background-color: #212529;
    color: white;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: ${props => props.$column ? 'column' : 'row'};
  align-items: center;
  justify-content: space-between;
  gap: 4rem;

  @media (max-width: 968px) {
    flex-direction: column;
    text-align: center;
    gap: 3rem;
  }
`;

// --- Hero Section Components ---
const HeroTextGroup = styled.div`
  flex: 1;
  animation: ${fadeInUp} 0.8s ease-out;
  
  h1 {
    font-size: 3.5rem;
    font-weight: 900;
    line-height: 1.2;
    margin-bottom: 1.5rem;
    color: #343a40;
    
    span {
      color: #339af0;
      display: inline-block;
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        bottom: 5px;
        left: 0;
        width: 100%;
        height: 15px;
        background-color: rgba(51, 154, 240, 0.2);
        z-index: -1;
      }
    }
  }

  p {
    font-size: 1.25rem;
    color: #868e96;
    line-height: 1.6;
    margin-bottom: 2.5rem;
    word-break: keep-all;
  }

  @media (max-width: 768px) {
    h1 { font-size: 2.5rem; }
    p { font-size: 1.1rem; }
  }
`;

const LoginCard = styled.div`
  flex: 0 0 400px;
  background: white;
  padding: 2.5rem;
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.1);
  border: 1px solid #dee2e6;
  animation: ${fadeInUp} 1s ease-out 0.2s backwards;
  
  @media (max-width: 768px) {
    flex: 1;
    width: 100%;
    max-width: 400px;
  }
`;

// --- Feature Components ---
const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  width: 100%;
  margin-top: 3rem;
`;

const FeatureCard = styled.div`
  background: white;
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  text-align: center;
  transition: transform 0.3s ease;
  border: 1px solid #f1f3f5;
  overflow: hidden; /* 이미지가 튀어나오지 않게 */

  &:hover {
    transform: translateY(-10px);
    box-shadow: 0 15px 40px rgba(0,0,0,0.1);
  }

  h3 {
    font-size: 1.4rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: #343a40;
  }

  p {
    font-size: 0.95rem;
    color: #868e96;
    line-height: 1.5;
    margin-bottom: 0;
  }
`;

// [신규] 이미지 컨테이너 (스크린샷 들어갈 자리)
const FeatureImageBox = styled.div`
  width: 100%;
  height: 180px; /* 적당한 높이 고정 */
  background-color: #f1f3f5; /* 이미지가 없을 때 회색 배경 */
  border-radius: 12px;
  margin-bottom: 1.5rem;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #adb5bd;
  font-weight: 700;
  border: 1px solid #e9ecef;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover; /* 비율 유지하며 꽉 채우기 */
    transition: transform 0.5s ease;
  }

  ${FeatureCard}:hover img {
    transform: scale(1.05); /* 호버 시 살짝 확대 */
  }
`;

// --- UI Elements ---
const GoogleBtn = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #ced4da;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 2rem;

  &:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
    transform: translateY(-2px);
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  color: #adb5bd;
  font-size: 0.9rem;
  margin: 1.5rem 0;
  &::before, &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e9ecef;
  }
  &::before { margin-right: 1rem; }
  &::after { margin-left: 1rem; }
`;

const InviteInput = styled.input`
  width: 100%;
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 1rem;
  margin-bottom: 0.8rem;
  text-align: center;
  transition: border-color 0.2s;
  &:focus { border-color: #339af0; outline: none; }
`;

const JoinBtn = styled.button`
  width: 100%;
  padding: 1rem;
  background: #20c997;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #12b886; transform: translateY(-2px); }
`;

const ScrollDown = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  color: #adb5bd;
  font-size: 0.9rem;
  animation: ${float} 2s infinite;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.8;
`;

const TitleBadge = styled.span`
  background: #e7f5ff;
  color: #1c7ed6;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

// [추가] 배경에 떠다니는 디자인 요소 (Blob)
const BackgroundShape = styled.div`
  position: absolute;
  filter: blur(80px); /* 아주 흐릿하게 */
  z-index: -1; /* 뒤로 배치 */
  opacity: 0.6; /* 은은하게 */
  border-radius: 50%;
`;

const Shape1 = styled(BackgroundShape)`
  top: -10%; left: -10%; width: 50vw; height: 50vw;
  background: radial-gradient(circle, rgba(51, 154, 240, 0.4) 0%, rgba(132, 94, 247, 0.2) 100%);
`;

const Shape2 = styled(BackgroundShape)`
  bottom: -10%; right: -10%; width: 60vw; height: 60vw;
  background: radial-gradient(circle, rgba(32, 201, 151, 0.4) 0%, rgba(51, 154, 240, 0.2) 100%);
`;

function LandingPage() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');

  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        updateUserProfile(result.user);
      })
      .catch((error) => console.error("Google 로그인 오류:", error));
  };

  const handleJoinWithCode = () => {
    if (!inviteCode.trim()) {
      alert("초대 코드를 입력해주세요.");
      return;
    }
    alert("먼저 Google 계정으로 로그인해주세요!\n로그인 완료 후 자동으로 가입 화면으로 이동합니다.");
    sessionStorage.setItem('inviteCode', inviteCode);
    handleGoogleLogin();
  };

  return (
    <PageContainer>
      {/* 1. Hero Section */}
      <Section className="hero">
        <Shape1 />
        <Shape2 />
        <ContentWrapper>
          <HeroTextGroup>
            <TitleBadge>Gamification Class Platform</TitleBadge>
            <h1>
              우리 반이 하나 되는<br />
              <span>즐거운 리그의 시작</span>
            </h1>
            <p>
              지루한 학교 생활은 이제 그만! <br />
              친구들과 팀을 이루어 미션을 수행하고, <br />
              펫을 키우며 함께 성장하는 우리 반만의 메타버스
            </p>
          </HeroTextGroup>

          <LoginCard>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.3rem' }}>바로 시작하기</h3>
            <GoogleBtn onClick={handleGoogleLogin}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" width="20" />
              구글 계정으로 로그인
            </GoogleBtn>

            <Divider>또는 초대 코드로</Divider>

            <InviteInput
              placeholder="초대 코드 (예: ABCD-1234)"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
            />
            <JoinBtn onClick={handleJoinWithCode}>학급 참여하기</JoinBtn>
          </LoginCard>
        </ContentWrapper>

        <ScrollDown>
          <span>기능 미리보기</span>
          <span>▼</span>
        </ScrollDown>
      </Section>

      {/* 2. Feature Section */}
      <Section>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '1rem', color: '#343a40' }}>
            왜 '우리반 리그'일까요?
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#868e96' }}>
            선생님과 학생 모두가 행복해지는 특별한 기능들을 소개합니다.
          </p>
        </div>

        <ContentWrapper $column>
          <FeatureGrid>
            {/* 1. 실시간 리그 */}
            <FeatureCard>
              <FeatureImageBox>
                {/* <img src={imgLeague} alt="리그화면" /> */}
                <span>📷 리그 순위 화면</span>
              </FeatureImageBox>
              <h3>🏫 우리 반 스포츠 리그</h3>
              <p>
                복잡한 점수 계산, 팀 편성은 이제 그만!<br />
                <strong>팀 자동 배정부터 경기 기록, 실시간 순위</strong>까지<br />
                클릭 한 번으로 완벽하게 운영하세요.
              </p>
            </FeatureCard>

            {/* 2. 미션 인증 */}
            <FeatureCard>
              <FeatureImageBox>
                {/* <img src={imgMission} alt="미션화면" /> */}
                <span>📷 미션 인증 화면</span>
              </FeatureImageBox>
              <h3>🌱 스스로 하는 성장 습관</h3>
              <p>
                청소, 숙제, 독서 등 생활 습관 미션!<br />
                아이들이 <strong>스스로 인증하고 보상</strong>을 받으며<br />
                자연스럽게 올바른 생활 습관을 기릅니다.
              </p>
            </FeatureCard>

            {/* 3. 펫 키우기 */}
            <FeatureCard>
              <FeatureImageBox>
                {/* <img src={imgPet} alt="펫화면" /> */}
                <span>📷 펫 육성 화면</span>
              </FeatureImageBox>
              <h3>🧠 즐거운 퀴즈 배틀</h3>
              <p>
                공부도 게임처럼! <strong>배운 내용으로 퀴즈 대결</strong>을 하며<br />
                나만의 펫을 성장시킵니다.<br />
                학습 동기 부여와 복습 효과를 동시에 잡으세요.
              </p>
            </FeatureCard>

            {/* 4. 마이룸 */}
            <FeatureCard>
              <FeatureImageBox>
                {/* <img src={imgRoom} alt="마이룸화면" /> */}
                <span>📷 마이룸 화면</span>
              </FeatureImageBox>
              <h3>💖 소속감과 성취감</h3>
              <p>
                열심히 모은 포인트로 나만의 공간을 꾸미고<br />
                친구들의 방명록에 따뜻한 말을 남겨요.<br />
                <strong>학급에 대한 애정과 소속감</strong>이 쑥쑥 자라납니다.
              </p>
            </FeatureCard>
          </FeatureGrid>
        </ContentWrapper>
      </Section>

      {/* 3. CTA Section */}
      <Section className="dark" style={{ padding: '5rem 2rem' }}>
        <ContentWrapper $column style={{ gap: '2rem' }}>
          <h2 style={{ fontSize: '2.2rem', margin: 0 }}>지금 바로 우리 반 리그를 시작해보세요!</h2>
          <p style={{ color: '#adb5bd', fontSize: '1.2rem', margin: 0 }}>
            선생님은 학급 관리를 편하게, 학생들은 학교 생활을 즐겁게.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#212529',
              background: '#20c997',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              marginTop: '1rem',
              boxShadow: '0 4px 15px rgba(32, 201, 151, 0.4)'
            }}
          >
            무료로 시작하기 🚀
          </button>
        </ContentWrapper>
      </Section>

      {/* Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', color: '#868e96', background: '#f8f9fa', fontSize: '0.9rem' }}>
        © 2026 Wooriban League. All rights reserved.<br />
        Designed for happy classrooms.
      </footer>
    </PageContainer>
  );
}

export default LandingPage;