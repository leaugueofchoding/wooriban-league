// src/components/dashboard/DashboardSimpleMode.jsx

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import baseAvatar from '../../assets/base-avatar.png';
import { petImageMap } from '../../utils/petImageMap';
import QuizWidget from '../QuizWidget';

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
`;

const shine = keyframes`
  0% { left: -100%; }
  100% { left: 200%; }
`;

const DashboardWrapper = styled.div`
  min-height: 100vh;
  background-color: ${props => props.$bgColor || '#f8f9fa'}; 
  padding: 4rem 1rem 4rem 1rem;
  font-family: 'Pretendard', sans-serif;
  overflow-x: hidden;
  transition: background-color 0.3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

// [수정] 팔레트 스타일 변경 (고정 위치 제거 -> 페이지 하단 배치)
const PaletteContainer = styled.div`
  margin-top: 3rem; /* 위쪽 콘텐츠와 넉넉한 간격 */
  padding: 0.5rem 1rem;
  
  display: flex;
  gap: 0.8rem;
  background: rgba(255, 255, 255, 0.4); /* 배경 더 투명하게 */
  border-radius: 30px;
  backdrop-filter: blur(5px);
  /* 그림자와 테두리 제거하여 플랫하게 */
  box-shadow: none; 
  border: none;
`;

const ColorDot = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  background-color: ${props => props.$color};
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: transform 0.2s;
  
  &:hover { transform: scale(1.2); }
  ${props => props.$active && `
    box-shadow: 0 0 0 2px #339af0;
    transform: scale(1.1);
  `}
`;

const CustomColorBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:hover { transform: scale(1.2); }
  
  input[type="color"] {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  ${props => props.$active && `
    box-shadow: 0 0 0 2px #339af0;
    transform: scale(1.1);
  `}
  
  &::after {
    content: '+';
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    display: ${props => props.$hasCustomColor ? 'none' : 'block'};
  }
`;

const ContentContainer = styled.div`
  width: 100%;
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  /* flex-grow: 1; 삭제 또는 유지 (DashboardWrapper가 flex column이므로 내용물이 적으면 Palette가 올라올 수 있음. margin-top: auto로 해결) */
`;

const CommonCardStyle = styled(Link)`
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  padding: 1.5rem;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  border: 1px solid rgba(255, 255, 255, 0.6);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.12);
    border-color: rgba(255, 255, 255, 0.9);
    z-index: 10;
  }
`;

const HeroSection = styled.section`
  display: flex;
  gap: 1.2rem;
  @media (max-width: 768px) { flex-direction: column; }
`;

const IDCard = styled(CommonCardStyle)`
  flex: 3;
  display: flex;
  align-items: center;
  gap: 2rem;
  color: #343a40;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.08); 
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);

  &::before {
    content: '';
    position: absolute;
    top: -50%; right: -20%;
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(77, 171, 247, 0.15) 0%, rgba(255,255,255,0) 70%);
    z-index: 0;
  }

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(51, 154, 240, 0.15);
    border-color: rgba(51, 154, 240, 0.3);
  }

  @media (max-width: 768px) { flex-direction: column; text-align: center; gap: 1rem; }
`;

const IDPhotoFrame = styled.div`
  width: 130px; height: 130px;
  border-radius: 24px;
  border: 3px solid rgba(255, 255, 255, 0.5); 
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  background: linear-gradient(135deg, #f1f3f5 0%, #e9ecef 100%);
  overflow: hidden; flex-shrink: 0;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;

  ${IDCard}:hover & {
    box-shadow: 0 12px 25px rgba(51, 154, 240, 0.2);
    border-color: white;
  }
`;

const IDPhotoContainer = styled.div`
  width: 100%; height: 100%; position: relative;
  transform: scale(1.5) translateY(10%);
`;

const IDInfo = styled.div`
  display: flex; flex-direction: column; gap: 0.4rem; z-index: 1;
  justify-content: center;
`;

const RoleBadge = styled.span`
  font-size: 0.8rem; font-weight: 800; color: #868e96; text-transform: uppercase; letter-spacing: 1px;
  background: #f1f3f5; padding: 2px 8px; border-radius: 4px; align-self: flex-start;
  @media (max-width: 768px) { align-self: center; }
`;

const NameTitle = styled.h2`
  margin: 0; font-size: 1.8rem; font-weight: 900; color: #212529;
  display: flex; align-items: center; gap: 0.5rem;
  text-shadow: 2px 2px 0px rgba(255,255,255,1);
  @media (max-width: 768px) { justify-content: center; }
`;

const StarContainer = styled.span`
  display: inline-flex; align-items: center; gap: 2px;
  font-size: 0.6em; margin-left: 6px;
  vertical-align: middle;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
`;

const StatBadges = styled.div`
  display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;
  align-items: center;
  @media (max-width: 768px) { justify-content: center; }
`;

const Badge = styled.div`
  background: ${props => props.$bg || 'white'};
  color: ${props => props.$color || '#495057'};
  padding: 0.4rem 0.8rem; border-radius: 12px;
  font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.05);
  
  img.pet-icon {
    width: 22px; height: 22px; object-fit: contain;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
  }
`;

const QuickMenuGrid = styled.div`
  flex: 2; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0.8rem;
`;

const QuickBtn = styled(Link)`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  display: flex; flex-direction: row;
  align-items: center; justify-content: flex-start; padding-left: 1.2rem;
  text-decoration: none; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative; overflow: hidden;
  border: 2px solid transparent;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
    background: white;
    border-color: ${props => props.$themeColor};
  }
  
  .icon-emoji { font-size: 1.5rem; margin-right: 0.5rem; z-index: 2; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1)); }
  .label { font-size: 1rem; font-weight: 800; color: #495057; z-index: 2; }
  .icon-bg { 
    position: absolute; right: -5px; bottom: -10px; 
    font-size: 3.5rem; opacity: 0.15; 
    transform: rotate(-15deg);
    transition: all 0.3s ease; 
  }
  
  &:hover .icon-bg { transform: rotate(0deg) scale(1.1); opacity: 0.25; }
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.2rem;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const WidgetCard = styled(CommonCardStyle)`
  display: flex; flex-direction: column; height: 100%; min-height: 180px;
  border-color: 2px solid transparent;
  &:hover { border-color: ${props => props.$color || 'transparent'}; }
`;

const WidgetHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; z-index: 2;
  h3 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #343a40; display: flex; align-items: center; gap: 0.5rem; }
  h3::before { content: '${props => props.$icon || ''}'; font-size: 1.4rem; }
`;

const FriendSection = styled(WidgetCard)`
  background: linear-gradient(135deg, rgba(212, 252, 121, 0.85) 0%, rgba(150, 230, 161, 0.85) 100%);
  border: 2px solid white;
  &:hover { border-color: #51cf66; }
`;

const FriendCardContent = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 1rem; height: 100%; padding-bottom: 0.5rem; position: relative; z-index: 1;
`;
const SpotLight = styled.div`
  position: absolute; top: 50%; left: 30%; transform: translate(-50%, -50%); width: 140px; height: 140px; background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(255,255,255,0) 70%); z-index: 0; animation: ${float} 4s ease-in-out infinite alternate;
`;
const FriendAvatarGroup = styled.div`
  position: relative; width: 130px; height: 130px; animation: ${float} 3s ease-in-out infinite; flex-shrink: 0; z-index: 1;
`;
const FullBodyAvatar = styled.div`
  width: 100%; height: 100%; position: relative; filter: drop-shadow(0px 8px 8px rgba(0,0,0,0.2));
  img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; transform: scale(1.1); }
`;
const FriendPet = styled.div`
  position: absolute; bottom: 5px; right: -10px; width: 50px; height: 50px; z-index: 2; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.2)); animation: ${float} 2s ease-in-out infinite alternate-reverse;
  img { width: 100%; height: 100%; object-fit: contain; }
`;
const FriendPetLevelBadge = styled.div`
  position: absolute; bottom: -5px; right: 0; background: #2b8a3e; color: white; font-size: 0.7rem; font-weight: 800; padding: 0.1rem 0.4rem; border-radius: 8px; z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;
const FriendInfo = styled.div`
  display: flex; flex-direction: column; gap: 0.3rem; z-index: 2; flex-grow: 1; background: rgba(255,255,255,0.4); padding: 0.8rem; border-radius: 16px; backdrop-filter: blur(4px);
`;
const FriendRoleBadge = styled.div`
  font-size: 0.75rem; font-weight: 800; color: #2b8a3e; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;
`;
const FriendName = styled.div`
  font-size: 1.4rem; font-weight: 900; color: #2b8a3e; line-height: 1.1; display: flex; align-items: center; gap: 0.4rem; text-shadow: 0 2px 0 rgba(255,255,255,0.8);
`;
const InfoBadge = styled.div`
  background: white; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: #2b8a3e; display: inline-flex; align-items: center; gap: 0.3rem; width: fit-content; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
`;

const GoalSection = styled.div`
  background: rgba(255, 255, 255, 0.95); border-radius: 24px; padding: 1.5rem 2rem; box-shadow: 0 8px 30px rgba(0,0,0,0.1); border: 4px solid #fff; position: relative; overflow: hidden;
  &::before { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.8), transparent); transform: skewX(-25deg); animation: ${shine} 6s infinite; }
`;
const GoalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem; position: relative; z-index: 1;
`;
const GoalTitle = styled.h3`
  margin: 0; font-size: 1.4rem; font-weight: 900; display: flex; align-items: center; gap: 0.8rem; color: #343a40;
`;
const GoalProgress = styled.div`
  width: 100%; height: 20px; background-color: #e9ecef; border-radius: 12px; overflow: hidden; position: relative; border: 2px solid #dee2e6;
  &::after { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: ${props => props.$percent}%; background: linear-gradient(90deg, #ffc107, #fd7e14); box-shadow: 0 0 10px rgba(253, 126, 20, 0.5); border-radius: 8px; transition: width 1s ease; }
`;
const DonateBox = styled.div`
  display: flex; gap: 0.8rem; justify-content: center; margin-top: 1.5rem; align-items: center; position: relative; z-index: 1;
  input { padding: 0.8rem 1rem; border: 3px solid #e9ecef; border-radius: 16px; width: 140px; text-align: center; font-size: 1.1rem; font-weight: 800; outline: none; transition: all 0.2s; &:focus { border-color: #20c997; box-shadow: 0 0 0 4px rgba(32, 201, 151, 0.2); } }
  button { padding: 0.8rem 1.5rem; background: #20c997; color: white; border: none; border-radius: 16px; font-weight: 900; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 0 #12b886; &:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #12b886; } &:active { transform: translateY(2px); box-shadow: 0 0 0 #12b886; } &:disabled { background: #adb5bd; box-shadow: none; transform: none; cursor: not-allowed; } }
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;
`;

const getWinningStars = (count) => {
  if (!count || count <= 0) return null;
  const purpleStars = Math.floor(count / 5);
  const yellowStars = count % 5;
  const stars = [];
  for (let i = 0; i < purpleStars; i++) {
    stars.push(<span key={`p-${i}`} style={{ color: '#7950f2', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>★</span>);
  }
  for (let i = 0; i < yellowStars; i++) {
    stars.push(<span key={`y-${i}`} style={{ color: '#fcc419', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>★</span>);
  }
  return <StarContainer>{stars}</StarContainer>;
};

function MissionItem({ mission, mySubmissions, canSubmitMission }) {
  const navigate = useNavigate();
  const submission = mySubmissions[mission.id];
  let submissionStatus = submission?.status;
  const isCompletedToday = mission.isFixed && submissionStatus === 'approved' && submission?.approvedAt &&
    new Date(submission.approvedAt.toDate()).toDateString() === new Date().toDateString();

  if (mission.isFixed && submissionStatus === 'approved' && !isCompletedToday) submissionStatus = null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', background: 'rgba(248, 249, 250, 0.7)', borderRadius: '16px', marginBottom: '0.6rem', border: '1px solid #e9ecef' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#343a40' }}>{mission.title}</div>
        <div style={{ fontSize: '0.8rem', color: '#868e96', fontWeight: '700' }}>💰 {mission.reward} P</div>
      </div>
      {canSubmitMission && (
        <button
          onClick={(e) => { e.preventDefault(); navigate('/missions'); }}
          disabled={isCompletedToday || submissionStatus === 'pending'}
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            border: 'none',
            borderRadius: '10px',
            background: isCompletedToday ? '#e6fcf5' : (submissionStatus === 'pending' ? '#f1f3f5' : (submissionStatus === 'rejected' ? '#fff5f5' : '#e7f5ff')),
            color: isCompletedToday ? '#0ca678' : (submissionStatus === 'pending' ? '#495057' : (submissionStatus === 'rejected' ? '#fa5252' : '#1c7ed6')),
            fontWeight: '800',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 2px 0 rgba(0,0,0,0.05)',
            marginLeft: '0.5rem',
            flexShrink: 0
          }}
        >
          {isCompletedToday ? "완료!" : (submissionStatus === 'pending' ? "확인중" : (submissionStatus === 'rejected' ? "재도전" : "GO"))}
        </button>
      )}
    </div>
  );
}

const PALETTE = ['#f8f9fa', '#e3fafc', '#eebefa', '#fff3bf', '#d3f9d8'];

function DashboardSimpleMode({
  myPlayerData, myAvatarUrls, myPartnerPet, equippedTitle, todaysFriend, friendAvatarUrls, friendPartnerPet, friendTitle, friendTeamName,
  activeGoal, activeMissions, recentMissions, topRankedTeams, rankIcons, onDonate, mySubmissions,
  simpleBgColor, onBgColorChange
}) {
  const [donationAmount, setDonationAmount] = useState('');
  const [customColor, setCustomColor] = useState(null);

  const handleDonateClick = () => { onDonate(donationAmount); setDonationAmount(''); };

  const handleCustomColorChange = (e) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onBgColorChange(newColor);
  };

  return (
    <DashboardWrapper $bgColor={simpleBgColor}>
      <ContentContainer>
        <HeroSection>
          <IDCard to="/profile">
            <IDPhotoFrame>
              <IDPhotoContainer>
                {myAvatarUrls.map((src, i) => <PartImage key={i} src={src} style={{ zIndex: i }} />)}
              </IDPhotoContainer>
            </IDPhotoFrame>
            <IDInfo>
              <RoleBadge>{equippedTitle ? equippedTitle.name : (myPlayerData.role === 'admin' ? 'TEACHER' : 'PLAYER')}</RoleBadge>
              <NameTitle>
                {myPlayerData.name}
                {getWinningStars(myPlayerData.win_count || 0)}
              </NameTitle>

              <StatBadges>
                <Badge $bg="#e6fcf5" $color="#0ca678">
                  {myPartnerPet ? <><img src={petImageMap[`${myPartnerPet.appearanceId}_idle`] || baseAvatar} alt="pet" className="pet-icon" /><span>Lv.{myPartnerPet.level} {myPartnerPet.name}</span></> : "펫 없음"}
                </Badge>
                <Badge $bg="#fff9db" $color="#f59f00">💰 {myPlayerData.points?.toLocaleString()}</Badge>
                <Badge $bg="#fff5f5" $color="#fa5252">❤️ {myPlayerData.totalLikes?.toLocaleString()}</Badge>
              </StatBadges>
            </IDInfo>
          </IDCard>

          <QuickMenuGrid>
            <QuickBtn to="/pet" $themeColor="#20c997"><span className="icon-emoji">🥚</span><span className="label">펫 센터</span><span className="icon-bg">🥚</span></QuickBtn>
            <QuickBtn to="/shop" $themeColor="#fcc419"><span className="icon-emoji">🛒</span><span className="label">상점</span><span className="icon-bg">🛒</span></QuickBtn>
            <QuickBtn to="/mission-gallery" $themeColor="#ff6b6b"><span className="icon-emoji">🖼️</span><span className="label">갤러리</span><span className="icon-bg">🖼️</span></QuickBtn>
            <QuickBtn to="/suggestions" $themeColor="#339af0"><span className="icon-emoji">💌</span><span className="label">건의함</span><span className="icon-bg">💌</span></QuickBtn>
          </QuickMenuGrid>
        </HeroSection>

        <MainGrid>
          <WidgetCard to="/missions" $color="#339af0">
            <WidgetHeader $icon="📝"><h3>오늘의 미션</h3><span style={{ fontSize: '0.9rem', color: '#495057', fontWeight: '700' }}>{activeMissions.length}개 남음</span></WidgetHeader>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {recentMissions.length > 0 ? recentMissions.map(m => <MissionItem key={m.id} mission={m} mySubmissions={mySubmissions} canSubmitMission={true} />) : <div style={{ textAlign: 'center', color: '#868e96', padding: '1rem' }}><div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div><div>모든 미션 완료!</div></div>}
            </div>
          </WidgetCard>

          <WidgetCard to="/league" $color="#845ef7">
            <WidgetHeader $icon="🏆"><h3>리그 순위</h3></WidgetHeader>
            <div style={{ flexGrow: 1 }}>
              {topRankedTeams.length > 0 ? topRankedTeams.map((team, index) => (
                <div key={team.id} style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ width: '30px', fontSize: '1.2rem' }}>{rankIcons[index]}</span>
                  <span style={{ fontWeight: '700', flex: 1, color: '#495057' }}>{team.teamName}</span>
                  <span style={{ fontWeight: '800', color: '#845ef7' }}>{team.points}</span>
                </div>
              )) : <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '1rem' }}>리그 준비 중</div>}
            </div>
          </WidgetCard>

          <WidgetCard to="#" as="div" $color="#20c997" style={{ cursor: 'default' }}>
            <WidgetHeader $icon="🧠"><h3>퀴즈 풀기</h3></WidgetHeader>
            <QuizWidget />
          </WidgetCard>

          {todaysFriend ? (
            <FriendSection to={`/my-room/${todaysFriend.id}`}>
              <WidgetHeader>
                <h3 style={{ color: '#2b8a3e' }}>🌟 오늘의 친구</h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2b8a3e', background: 'rgba(255,255,255,0.7)', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>VISIT</span>
              </WidgetHeader>
              <FriendCardContent>
                <SpotLight />
                <FriendAvatarGroup>
                  <FullBodyAvatar>
                    {friendAvatarUrls.map((src, i) => <PartImage key={i} src={src} style={{ zIndex: i }} />)}
                  </FullBodyAvatar>
                  {friendPartnerPet && (
                    <FriendPet>
                      <img src={petImageMap[`${friendPartnerPet.appearanceId}_idle`] || baseAvatar} alt="pet" />
                      <FriendPetLevelBadge>Lv.{friendPartnerPet.level}</FriendPetLevelBadge>
                    </FriendPet>
                  )}
                </FriendAvatarGroup>
                <FriendInfo>
                  <FriendRoleBadge>{friendTitle ? friendTitle.name : (todaysFriend.role === 'admin' ? 'TEACHER' : 'PLAYER')}</FriendRoleBadge>
                  <FriendName>
                    {todaysFriend.name}
                    {getWinningStars(todaysFriend.win_count || 0)}
                  </FriendName>

                  {friendPartnerPet && <InfoBadge><span style={{ fontSize: '0.9rem' }}>🐾</span>{friendPartnerPet.name}</InfoBadge>}
                  <InfoBadge><span style={{ fontSize: '0.9rem' }}>🛡️</span>{friendTeamName}</InfoBadge>
                </FriendInfo>
              </FriendCardContent>
            </FriendSection>
          ) : (
            <WidgetCard to="#" as="div"><WidgetHeader><h3>🌟 오늘의 친구</h3></WidgetHeader><div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '2rem' }}>아직 친구가 없어요 🥲</div></WidgetCard>
          )}
        </MainGrid>

        <GoalSection>
          <GoalHeader>
            <GoalTitle>🔥 우리 반 공동 목표</GoalTitle>
            {activeGoal && <span style={{ fontWeight: '800', color: '#868e96' }}>{activeGoal.currentPoints.toLocaleString()} / {activeGoal.targetPoints.toLocaleString()}</span>}
          </GoalHeader>
          {activeGoal ? (
            <>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#495057' }}>{activeGoal.title}</h4>
              <GoalProgress $percent={Math.min((activeGoal.currentPoints / activeGoal.targetPoints) * 100, 100)} />
              <DonateBox>
                <input type="number" placeholder="P" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} />
                <button onClick={handleDonateClick} disabled={activeGoal.status === 'paused'}>{activeGoal.status === 'paused' ? '일시정지' : '기부하기'}</button>
              </DonateBox>
            </>
          ) : <div style={{ textAlign: 'center', color: '#adb5bd' }}>진행 중인 목표가 없습니다.</div>}
        </GoalSection>
      </ContentContainer>

      <PaletteContainer>
        {PALETTE.map(color => (
          <ColorDot
            key={color}
            $color={color}
            $active={simpleBgColor === color}
            onClick={() => {
              setCustomColor(null);
              onBgColorChange(color);
            }}
          />
        ))}
        <CustomColorBtn $active={!!customColor && simpleBgColor === customColor} $hasCustomColor={!!customColor}>
          <input type="color" onChange={handleCustomColorChange} value={customColor || '#ffffff'} />
        </CustomColorBtn>
      </PaletteContainer>
    </DashboardWrapper>
  );
}

export default DashboardSimpleMode;