// src/pages/TermsPage.jsx

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---
const PageContainer = styled.div`
  min-height: 100vh;
  padding: 4rem 1rem;
  font-family: 'Pretendard', sans-serif;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #f8f9fa;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 900px;
  background: white;
  border-radius: 24px;
  padding: 3rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  animation: ${fadeIn} 0.5s ease-out;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;

  h1 {
    font-size: 2rem;
    font-weight: 900;
    color: #343a40;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: #868e96;
    font-size: 1rem;
  }
`;

const TabContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f1f3f5;
  padding-bottom: 1rem;
`;

const TabButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1.1rem;
  font-weight: 800;
  border: none;
  background: none;
  color: ${props => props.$active ? '#339af0' : '#868e96'};
  cursor: pointer;
  position: relative;
  transition: all 0.2s;

  &::after {
    content: '';
    position: absolute;
    bottom: -1rem;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: #339af0;
    transform: scaleX(${props => props.$active ? 1 : 0});
    transition: transform 0.2s;
  }

  &:hover {
    color: #339af0;
  }
`;

const TextView = styled.div`
  background: #fcfcfc;
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  white-space: pre-wrap;
  line-height: 1.7;
  color: #495057;
  font-size: 0.95rem;
  height: 60vh;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #dee2e6;
    border-radius: 4px;
  }

  strong {
    color: #343a40;
    font-weight: 800;
  }
  
  h4 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: #339af0;
    font-size: 1.1rem;
  }
`;

// [통일된 버튼 스타일]
const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 3rem;
`;

const ActionButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: 800;
  color: ${props => props.$primary ? 'white' : '#495057'};
  background: ${props => props.$primary ? '#339af0' : '#f1f3f5'};
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.1);
    filter: brightness(0.95);
  }
`;

// --- 수정된 약관 텍스트 (학생 가입 절차 포함) ---

const TERMS_TEXT = `
[서비스 이용약관]

제 1 장 총 칙

제 1 조 (목적)
본 약관은 '우리반 리그'(이하 “서비스”)가 제공하는 교육용 게이미피케이션 플랫폼 서비스의 이용과 관련하여 서비스 운영진과 회원(교사 및 학생) 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제 2 조 (용어의 정의)
1. “서비스”라 함은 구현되는 단말기(PC, 휴대형 단말기 등)와 상관없이 이용할 수 있는 '우리반 리그' 및 제반 기능을 의미합니다.
2. “교사 회원”이라 함은 본 약관에 따라 가입하여 학급을 개설하고 운영하는 관리자 권한을 가진 사용자를 말합니다.
3. “학생 회원”이라 함은 교사 회원이 개설한 학급에 참여하기 위해 가입 절차를 거쳐 서비스를 이용하는 사용자를 말합니다.

제 2 장 이용계약 및 서비스 이용

제 3 조 (이용계약의 성립)
1. 이용계약은 가입신청자(교사 또는 학생)가 약관에 동의하고 가입을 신청한 후, 운영진이 이를 승낙함으로써 체결됩니다.
2. 학생 회원의 가입은 학교에서 제공받은 계정(Google Workspace for Education 등) 또는 소셜 로그인을 통해 이루어지며, 이는 교사 회원의 교육적 지도하에 진행되는 것으로 간주합니다.
3. 서비스 운영진은 기술상 지장이 있거나 운영상 필요하다고 판단되는 경우 가입 승낙을 보류하거나 거절할 수 있습니다.

제 4 조 (서비스의 제공 및 변경)
1. 서비스는 학급 관리, 학생 보상 시스템(경험치, 포인트), 미션 및 퀘스트, 게이미피케이션 콘텐츠 등을 제공합니다.
2. 운영진은 운영상, 기술상의 필요에 따라 제공하고 있는 서비스의 전부 또는 일부를 수정, 변경, 중단할 수 있으며, 이에 대하여 관련 법령에 특별한 규정이 없는 한 회원에게 별도의 보상을 하지 않습니다.

제 5 조 (개인정보 보호 및 가명 처리 의무)
1. 교사 회원은 학생들에게 서비스 가입을 안내할 때, 불필요한 민감 정보(집 주소, 개인 휴대전화 번호 등)가 수집되지 않도록 지도해야 합니다.
2. 서비스 내에서 학생을 식별하는 정보는 '닉네임', '출석 번호' 등 가명 정보를 사용하는 것을 원칙으로 합니다.
3. 학생 회원은 본인의 계정 정보를 타인에게 공유해서는 안 되며, 계정 관리에 대한 책임은 본인에게 있습니다.

제 6 조 (서비스의 중단 및 종료)
1. 운영진은 설비 점검, 교체, 고장, 통신 두절 등 불가피한 사유가 발생한 경우 서비스 제공을 일시적으로 중단할 수 있습니다.
2. 운영진은 경영상의 이유, 수익성 악화, 서비스 통합 및 폐지 등 운영진의 판단에 따라 서비스를 영구적으로 종료할 수 있습니다.
3. 제2항에 따라 서비스를 종료하는 경우, 운영진은 종료일 30일 전까지 공지사항 등을 통해 통지합니다. 회원은 서비스 종료에 대해 손해배상을 청구할 수 없습니다.

제 3 장 계약 당사자의 의무

제 7 조 (회원의 의무)
1. 회원은 관계 법령, 본 약관, 이용안내 및 공지사항을 준수하여야 합니다.
2. 회원은 타인의 정보를 도용하거나, 서비스의 지적재산권을 침해하는 행위를 해서는 안 됩니다.
3. 교사 회원은 학급 운영이 종료되거나 해당 학년도가 끝나는 즉시, 서비스 내 기능을 이용하여 학생 데이터를 삭제하거나 초기화해야 합니다.

제 4 장 결제 및 환불

제 8 조 (유료 서비스 및 환불)
1. 회원은 서비스가 제공하는 결제수단을 통하여 유료 서비스를 이용할 수 있습니다.
2. 결제일로부터 7일 이내에 사용 내역이 없는 경우 청약철회가 가능합니다. 이미 사용한 아이템 및 기능은 환불이 제한될 수 있습니다.
3. 서비스 종료 시, 사용하지 않은 잔여 유료 재화에 대해서는 관련 법령에 따라 환불 절차를 안내합니다.

제 9 조 (교육 기관 예산 결제 특약)
1. 교사 회원이 개인 카드로 결제 후 소속 교육 기관(학교)으로부터 비용을 환급받는 경우, 실질적 구매자는 '교육 기관'으로 봅니다.
2. 위 경우 환불 시, 운영진은 반드시 해당 교육 기관의 법인 계좌 또는 원 결제 수단으로만 환불하며, 교사 개인 계좌로의 현금 환불은 불가능합니다.

제 5 장 기타

제 10 조 (면책조항)
1. 운영진은 무료로 제공되는 서비스 이용과 관련하여 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.
2. 운영진은 회원이 서비스를 이용하여 기대하는 수익(교육적 성과 등)을 상실한 것에 대하여 책임을 지지 않으며, 서비스를 통해 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.
3. 운영진은 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.

제 11 조 (준거법 및 관할)
본 약관과 관련된 분쟁은 대한민국 법을 준거법으로 하며, 운영진의 소재지를 관할하는 법원을 전속 관할법원으로 합니다.

부칙
본 약관은 2026년 1월 18일부터 적용됩니다.
`;

const PRIVACY_TEXT = `
[개인정보 처리방침]

'우리반 리그'(이하 "서비스")는 이용자의 개인정보를 중요시하며, "개인정보보호법" 등 관련 법령을 준수하고 있습니다.

1. 개인정보의 수집 및 이용 목적
- 회원 가입 및 본인 식별 (OAuth 연동)
- 학급 경영 도구 서비스 제공 및 운영
- 서비스 관련 공지사항 전달 및 민원 처리

2. 수집하는 개인정보의 항목
- [필수] 로그인 ID(이메일), 이름(또는 닉네임), 프로필 사진 (Google/Kakao OAuth 연동 정보)
- [자동 수집] 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보
- **[아동 개인정보 처리]**: 본 서비스는 학교 교육 활동의 일환으로 만 14세 미만 아동(학생)의 가입을 허용하나, 가입 시 수집되는 정보는 학교 계정(Google Workspace 등) 연동 정보에 한합니다. 실명, 전화번호, 주소 등 불필요한 민감 정보는 수집하지 않습니다.

3. 개인정보의 보유 및 이용 기간
- 회원 탈퇴 시 지체 없이 파기하는 것을 원칙으로 합니다.
- 단, 관계 법령(통신비밀보호법 등)에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.

4. 개인정보의 제3자 제공 및 위탁
- 서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.
- 원활한 서비스 제공을 위해 데이터 호스팅 및 보관 업무를 Google Cloud Platform (Firebase)에 위탁하고 있습니다.

5. 정보주체의 권리
- 이용자는 언제든지 자신의 개인정보를 열람, 정정, 삭제(탈퇴)할 수 있습니다.
- 권리 행사는 서비스 내 설정 메뉴를 통해 직접 하거나 고객센터를 통해 요청할 수 있습니다.

6. 개인정보의 파기
- 이용 목적 달성 후, 해당 정보를 복구할 수 없는 기술적 방법을 사용하여 영구 삭제합니다.
- 교사 회원이 학급을 삭제하거나 탈퇴할 경우, 해당 학급에 소속된 학생들의 활동 데이터도 함께 파기됩니다.

7. 개인정보 보호책임자
- 서비스 이용 중 발생하는 모든 개인정보보호 관련 문의는 아래 연락처로 문의해 주시기 바랍니다.
- 이메일: (여기에 관리자 이메일 입력)

부칙
본 방침은 2026년 1월 18일부터 시행됩니다.
`;

function TermsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('terms');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'privacy') {
            setActiveTab('privacy');
        } else {
            setActiveTab('terms');
        }
    }, [location]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    return (
        <PageContainer>
            <ContentWrapper>
                <Header>
                    <h1>서비스 정책</h1>
                    <p>서비스 이용을 위한 약관 및 개인정보 처리방침입니다.</p>
                </Header>

                <TabContainer>
                    <TabButton
                        $active={activeTab === 'terms'}
                        onClick={() => handleTabChange('terms')}
                    >
                        이용약관
                    </TabButton>
                    <TabButton
                        $active={activeTab === 'privacy'}
                        onClick={() => handleTabChange('privacy')}
                    >
                        개인정보 처리방침
                    </TabButton>
                </TabContainer>

                <TextView>
                    {activeTab === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}
                </TextView>

                {/* 통일된 스타일의 하단 버튼 */}
                <ButtonGroup>
                    <ActionButton onClick={() => navigate(-1)}>뒤로 가기</ActionButton>
                    <ActionButton $primary onClick={() => navigate('/')}>홈으로</ActionButton>
                </ButtonGroup>
            </ContentWrapper>
        </PageContainer>
    );
}

export default TermsPage;