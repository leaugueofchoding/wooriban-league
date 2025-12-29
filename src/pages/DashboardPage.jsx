// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, getActiveGoals, donatePointsToGoal } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import baseAvatar from '../assets/base-avatar.png';
import QuizWidget from '../components/QuizWidget';
import confetti from 'canvas-confetti';
import { petImageMap } from '../utils/petImageMap';
import { writeBatch, collection, getDocs, doc } from "firebase/firestore";
import { db } from '../api/firebase';

// --- Animations ---
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
`;

// --- Styled Components ---

const DashboardWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  font-family: 'Pretendard', sans-serif;
`;

const JoinLeagueButton = styled.button`
  width: 100%;
  padding: 1.2rem;
  font-size: 1.2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #4dabf7, #1c7ed6);
  color: white;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(28, 126, 214, 0.2);
  transition: transform 0.2s;
  &:hover { transform: translateY(-3px); }
`;

// === 1. Hero Section (파란색 영역) ===
const HeroSection = styled.section`
  display: flex;
  gap: 1.5rem;
  @media (max-width: 768px) { flex-direction: column; }
`;

const IDCard = styled(Link)`
  flex: 3;
  text-decoration: none;
  color: #343a40;
  background: white;
  border-radius: 24px;
  padding: 1.8rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.06);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  /* 파란색 배경 효과 */
  &::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 150px; height: 100%;
    background: linear-gradient(135deg, rgba(77, 171, 247, 0.1) 0%, rgba(28, 126, 214, 0.1) 100%);
    clip-path: polygon(20% 0, 100% 0, 100% 100%, 0% 100%);
  }
  &:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.1); }
  @media (max-width: 768px) { flex-direction: column; text-align: center; gap: 1rem; }
`;

const IDPhotoFrame = styled.div`
  width: 110px; height: 110px;
  border-radius: 24px;
  background: #f8f9fa;
  overflow: hidden; flex-shrink: 0;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);
  border: 4px solid white;
  position: relative;
`;

const IDPhotoContainer = styled.div`
  width: 100%; height: 100%; position: relative;
  transform: scale(2.2) translateY(12%);
`;

const IDInfo = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem; z-index: 1;
`;

const RoleBadge = styled.span`
  font-size: 0.85rem; font-weight: 700; color: #adb5bd; text-transform: uppercase; letter-spacing: 0.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
`;

const NameTitle = styled.h2`
  margin: 0; font-size: 1.8rem; font-weight: 800; color: #212529;
  display: flex; align-items: center; gap: 0.5rem;
  @media (max-width: 768px) { justify-content: center; }
`;

const StarContainer = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6em; 
  vertical-align: middle;
  margin-left: 4px;
`;

const StatBadges = styled.div`
  display: flex; gap: 0.6rem; margin-top: 0.5rem; flex-wrap: wrap;
  align-items: center;
  @media (max-width: 768px) { justify-content: center; }
`;

const Badge = styled.div`
  background: ${props => props.$bg || '#f1f3f5'};
  color: ${props => props.$color || '#495057'};
  padding: 0.4rem 0.8rem; border-radius: 12px;
  font-size: 0.9rem; font-weight: 700; display: flex; align-items: center; gap: 0.3rem;
  
  img.pet-icon {
    width: 20px; height: 20px; object-fit: contain;
  }
`;

const QuickMenuGrid = styled.div`
  flex: 2; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 1rem;
`;

const QuickBtn = styled(Link)`
  background: white; border-radius: 20px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-decoration: none; box-shadow: 0 4px 15px rgba(0,0,0,0.04);
  transition: all 0.2s ease; position: relative; overflow: hidden;
  border: 1px solid transparent;

  &:hover {
    transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    border-color: ${props => props.$themeColor};
    .icon-bg { transform: scale(1.2); opacity: 0.2; }
  }
  .icon-emoji { font-size: 1.8rem; margin-bottom: 0.4rem; z-index: 1; }
  .label { font-size: 0.95rem; font-weight: 700; color: #495057; z-index: 1; }
  .icon-bg { position: absolute; right: -10px; bottom: -10px; font-size: 4rem; opacity: 0.1; transition: all 0.3s ease; filter: grayscale(100%); }
`;

// === 2. Main Grid Section ===
const MainGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const WidgetCard = styled(Link)`
  background: white; border-radius: 24px; padding: 1.5rem;
  text-decoration: none; color: inherit;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  display: flex; flex-direction: column;
  height: 100%; 
  min-height: 170px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 2px solid transparent; position: relative; overflow: hidden;

  &:hover {
    transform: translateY(-5px); box-shadow: 0 12px 30px rgba(0,0,0,0.1);
    border-color: ${props => props.$color || 'transparent'};
  }
`;

const WidgetHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; z-index: 2;
  h3 { margin: 0; font-size: 1.3rem; font-weight: 800; color: #343a40; display: flex; align-items: center; gap: 0.5rem; }
`;

// === [연두색 영역] 오늘의 친구 카드 스타일 ===
const FriendSection = styled(WidgetCard)`
  background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%);
  border: none;
`;

const FriendCardContent = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 1rem;
  height: 100%; padding-bottom: 0.5rem;
  position: relative; z-index: 1;
`;

const SpotLight = styled.div`
  position: absolute; top: 50%; left: 30%; transform: translate(-50%, -50%);
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255,255,255,0) 70%);
  z-index: 0;
`;

const FriendAvatarGroup = styled.div`
  position: relative; width: 120px; height: 120px;
  animation: ${float} 3s ease-in-out infinite; flex-shrink: 0; z-index: 1;
`;

const FullBodyAvatar = styled.div`
  width: 100%; height: 100%; position: relative;
  filter: drop-shadow(0px 8px 8px rgba(0,0,0,0.15));
  img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; transform: scale(1.1); }
`;

const FriendPet = styled.div`
  position: absolute; bottom: 0; right: -5px;
  width: 45px; height: 45px; z-index: 2;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  img { width: 100%; height: 100%; object-fit: contain; }
`;

const FriendPetLevelBadge = styled.div`
  position: absolute; bottom: -8px; right: -5px;
  background: #fff; color: #2b8a3e;
  font-size: 0.7rem; font-weight: 800;
  padding: 0.1rem 0.5rem; border-radius: 10px;
  z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: 1px solid #d3f9d8;
  white-space: nowrap;
`;

const FriendInfo = styled.div`
  display: flex; flex-direction: column; gap: 0.3rem; z-index: 2; flex-grow: 1;
`;

// [NEW] 친구 이름 위 회색 칭호 배지
const FriendRoleBadge = styled.div`
  font-size: 0.85rem; font-weight: 700; color: #868e96; 
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 2px;
`;

const FriendName = styled.div`
  font-size: 1.5rem; font-weight: 800; color: #2b8a3e; line-height: 1.2;
  display: flex; align-items: center; gap: 0.4rem;
  text-shadow: 0 1px 1px rgba(255,255,255,0.5);
`;

const InfoBadge = styled.div`
  background: rgba(255, 255, 255, 0.6);
  padding: 0.25rem 0.6rem; border-radius: 8px;
  font-size: 0.8rem; font-weight: 700; color: #2b8a3e;
  display: inline-flex; align-items: center; gap: 0.3rem; width: fit-content;
`;

const PartImage = styled.img`
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;
`;

// === 3. Goal Section ===
const GoalSection = styled.div`
  background: white; border-radius: 24px; padding: 2rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid #f1f3f5;
`;

const GoalHeader = styled.div`
  display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem;
`;

const GoalTitle = styled.h3`
  margin: 0; font-size: 1.4rem; font-weight: 800; display: flex; align-items: center; gap: 0.8rem; color: #343a40;
`;

const GoalProgress = styled.div`
  width: 100%; height: 16px; background-color: #f1f3f5; border-radius: 10px; overflow: hidden; position: relative;
  &::after {
    content: ''; position: absolute; top: 0; left: 0; bottom: 0;
    width: ${props => props.$percent}%; background: linear-gradient(90deg, #ffc107, #fd7e14);
    border-radius: 10px; transition: width 1s ease;
  }
`;

const DonateBox = styled.div`
  display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; align-items: center;
  input { padding: 0.8rem 1rem; border: 2px solid #e9ecef; border-radius: 12px; width: 120px; text-align: center; font-size: 1rem; font-weight: bold; outline: none; &:focus { border-color: #20c997; } }
  button { padding: 0.8rem 1.5rem; background: #20c997; color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; &:hover { background: #12b886; transform: translateY(-2px); } &:disabled { background: #adb5bd; transform: none; } }
`;

// --- Helper Functions ---

const getAvatarUrls = (config, avatarParts) => {
    if (!config || !avatarParts.length) return [baseAvatar];
    const RENDER_ORDER = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];
    RENDER_ORDER.forEach(category => {
        const partId = config[category];
        if (partId) {
            const part = avatarParts.find(p => p.id === partId);
            if (part) urls.push(part.src);
        }
    });
    if (config.accessories) {
        Object.values(config.accessories).forEach(partId => {
            const part = avatarParts.find(p => p.id === partId);
            if (part) urls.push(part.src);
        });
    }
    return Array.from(new Set(urls));
};

const getTodayStar = (playerList, myId) => {
    if (!playerList || playerList.length <= 1) return null;
    const candidates = playerList.filter(p => p.id !== myId && p.status !== 'inactive').sort((a, b) => a.id.localeCompare(b.id));
    if (candidates.length === 0) return null;

    const epoch = new Date('2025-01-01').getTime();
    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24;

    let businessDays = 0;
    let current = epoch;
    const target = now.getTime();

    while (current < target) {
        const d = new Date(current);
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            businessDays++;
        }
        current += oneDay;
    }

    const index = businessDays % candidates.length;
    return candidates[index];
};

const getWinningStars = (count) => {
    if (!count || count <= 0) return null;
    const purpleStars = Math.floor(count / 5);
    const yellowStars = count % 5;
    const stars = [];
    for (let i = 0; i < purpleStars; i++) {
        stars.push(<span key={`p-${i}`} style={{ color: '#7950f2', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>★</span>);
    }
    for (let i = 0; i < yellowStars; i++) {
        stars.push(<span key={`y-${i}`} style={{ color: '#fcc419', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>★</span>);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', background: '#f8f9fa', borderRadius: '16px', marginBottom: '0.8rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mission.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#868e96', fontWeight: '600' }}>💰 {mission.reward} P</div>
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
                        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
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

// --- Main Component ---

function DashboardPage() {
    const { classId } = useClassStore();
    const { players, missions, registerAsPlayer, missionSubmissions, avatarParts, standingsData, titles } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [activeGoal, setActiveGoal] = useState(null);
    const [donationAmount, setDonationAmount] = useState('');
    const navigate = useNavigate();

    const myPlayerData = useMemo(() => currentUser ? players.find(p => p.authUid === currentUser.uid) : null, [players, currentUser]);
    const todaysFriend = useMemo(() => getTodayStar(players, myPlayerData?.id), [players, myPlayerData]);
    const equippedTitle = useMemo(() => (myPlayerData?.equippedTitle && titles.length) ? titles.find(t => t.id === myPlayerData.equippedTitle) : null, [myPlayerData, titles]);

    // [중요] 내 파트너 펫 찾기
    const myPartnerPet = useMemo(() => {
        if (!myPlayerData?.pets || !myPlayerData.pets.length) return null;
        return myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) || myPlayerData.pets[0];
    }, [myPlayerData]);

    // [중요] 오늘의 친구 파트너 펫 찾기
    const friendPartnerPet = useMemo(() => {
        if (!todaysFriend?.pets || !todaysFriend.pets.length) return null;
        return todaysFriend.pets.find(p => p.id === todaysFriend.partnerPetId) || todaysFriend.pets[0];
    }, [todaysFriend]);

    // 오늘의 친구 칭호 찾기 (배지 표시용)
    const friendTitle = useMemo(() => {
        if (!todaysFriend?.equippedTitle || !titles.length) return null;
        return titles.find(t => t.id === todaysFriend.equippedTitle);
    }, [todaysFriend, titles]);

    const myAvatarUrls = useMemo(() => getAvatarUrls(myPlayerData?.avatarConfig, avatarParts), [myPlayerData, avatarParts]);
    const friendAvatarUrls = useMemo(() => getAvatarUrls(todaysFriend?.avatarConfig, avatarParts), [todaysFriend, avatarParts]);

    const friendTeamName = useMemo(() => {
        if (!todaysFriend?.teamId) return "무소속";
        const team = standingsData().find(t => t.id === todaysFriend.teamId);
        return team ? team.teamName : "무소속";
    }, [todaysFriend, standingsData]);

    const topRankedTeams = useMemo(() => standingsData().slice(0, 3), [standingsData]);
    const rankIcons = ["🥇", "🥈", "🥉"];

    const mySubmissions = useMemo(() => {
        if (!myPlayerData) return {};
        const map = {};
        missionSubmissions.filter(sub => sub.studentId === myPlayerData.id).forEach(sub => {
            map[sub.missionId] = sub;
        });
        return map;
    }, [missionSubmissions, myPlayerData]);

    const activeMissions = useMemo(() => {
        if (!missions) return [];
        return missions.filter(m => {
            const sub = mySubmissions[m.id];
            if (sub && sub.status === 'approved' && !m.isFixed) return false;
            if (m.isFixed && sub && sub.status === 'approved' && sub.approvedAt) {
                const approvedDate = new Date(sub.approvedAt.toDate()).toDateString();
                const todayDate = new Date().toDateString();
                if (approvedDate === todayDate) return false;
            }
            return true;
        });
    }, [missions, mySubmissions]);

    const recentMissions = useMemo(() => activeMissions.slice(0, 3), [activeMissions]);

    useEffect(() => {
        if (!classId || !myPlayerData) return;
        getActiveGoals(classId).then(goals => {
            if (goals.length > 0) {
                setActiveGoal(goals[0]);
                if (goals[0].currentPoints >= goals[0].targetPoints) confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 } });
            } else {
                setActiveGoal(null);
            }
        });
    }, [myPlayerData, classId]);

    const handleDonate = async () => {
        const amount = Number(donationAmount);
        if (amount <= 0 || myPlayerData.points < amount) return alert('포인트가 부족하거나 올바르지 않습니다.');
        if (window.confirm(`${amount}P를 기부하시겠습니까?`)) {
            try {
                await donatePointsToGoal(classId, myPlayerData.id, activeGoal.id, amount);
                alert('기부 성공! 👍');
                setDonationAmount('');
                const goals = await getActiveGoals(classId);
                if (goals.length > 0) setActiveGoal(goals[0]);
            } catch (error) {
                alert(error.message);
            }
        }
    };

    return (
        <DashboardWrapper>
            {currentUser && !myPlayerData && (
                <JoinLeagueButton onClick={registerAsPlayer}>
                    👋 안녕! 선수 등록하고 시작하기
                </JoinLeagueButton>
            )}

            {myPlayerData && (
                <>
                    {/* 1. HERO SECTION (파란색) - 내 정보 & 펫 레벨 표시 */}
                    <HeroSection>
                        <IDCard to="/profile">
                            <IDPhotoFrame>
                                <IDPhotoContainer>
                                    {myAvatarUrls.map((src, i) => <PartImage key={i} src={src} style={{ zIndex: i }} />)}
                                </IDPhotoContainer>
                            </IDPhotoFrame>
                            <IDInfo>
                                <RoleBadge>
                                    {equippedTitle ? equippedTitle.name : (myPlayerData.role === 'admin' ? 'TEACHER' : 'PLAYER')}
                                </RoleBadge>
                                <NameTitle>
                                    {myPlayerData.name}
                                    {getWinningStars(myPlayerData.win_count || 0)}
                                </NameTitle>
                                <StatBadges>
                                    {/* 내 펫 레벨 표시 */}
                                    <Badge $bg="#e6fcf5" $color="#0ca678">
                                        {myPartnerPet ? (
                                            <>
                                                <img src={petImageMap[`${myPartnerPet.appearanceId}_idle`] || baseAvatar} alt="pet" className="pet-icon" />
                                                <span>Lv.{myPartnerPet.level} {myPartnerPet.name}</span>
                                            </>
                                        ) : (
                                            "펫 없음"
                                        )}
                                    </Badge>
                                    <Badge $bg="#fff9db" $color="#f59f00">💰 {myPlayerData.points?.toLocaleString()}</Badge>
                                    <Badge $bg="#fff5f5" $color="#fa5252">❤️ {myPlayerData.totalLikes?.toLocaleString()}</Badge>
                                </StatBadges>
                            </IDInfo>
                        </IDCard>

                        <QuickMenuGrid>
                            <QuickBtn to="/pet" $themeColor="#20c997">
                                <span className="icon-emoji">🥚</span><span className="label">펫 센터</span><span className="icon-bg">🥚</span>
                            </QuickBtn>
                            <QuickBtn to="/shop" $themeColor="#fcc419">
                                <span className="icon-emoji">🛒</span><span className="label">상점</span><span className="icon-bg">🛒</span>
                            </QuickBtn>
                            <QuickBtn to="/mission-gallery" $themeColor="#ff6b6b">
                                <span className="icon-emoji">🖼️</span><span className="label">갤러리</span><span className="icon-bg">🖼️</span>
                            </QuickBtn>
                            <QuickBtn to="/suggestions" $themeColor="#339af0">
                                <span className="icon-emoji">💌</span><span className="label">건의함</span><span className="icon-bg">💌</span>
                            </QuickBtn>
                        </QuickMenuGrid>
                    </HeroSection>

                    {/* 2. GRID SECTION */}
                    <MainGrid>
                        <WidgetCard to="/missions" $color="#339af0">
                            <WidgetHeader>
                                <h3>📝 오늘의 미션</h3>
                                <span style={{ fontSize: '0.9rem', color: '#868e96' }}>{activeMissions.length}개 남음</span>
                            </WidgetHeader>
                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                {recentMissions.length > 0 ? (
                                    recentMissions.map(mission => (
                                        <MissionItem key={mission.id} mission={mission} mySubmissions={mySubmissions} canSubmitMission={true} />
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#adb5bd', padding: '1rem' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div><div>모든 미션 완료!</div>
                                    </div>
                                )}
                            </div>
                        </WidgetCard>

                        <WidgetCard to="/league" $color="#845ef7">
                            <WidgetHeader>
                                <h3>🏆 리그 순위</h3>
                            </WidgetHeader>
                            <div style={{ flexGrow: 1 }}>
                                {topRankedTeams.length > 0 ? (
                                    topRankedTeams.map((team, index) => (
                                        <div key={team.id} style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #f1f3f5' }}>
                                            <span style={{ width: '30px', fontSize: '1.2rem' }}>{rankIcons[index]}</span>
                                            <span style={{ fontWeight: '700', flex: 1, color: '#495057' }}>{team.teamName}</span>
                                            <span style={{ fontWeight: '800', color: '#845ef7' }}>{team.points}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '1rem' }}>리그 준비 중</div>
                                )}
                            </div>
                        </WidgetCard>

                        <WidgetCard to="#" as="div" $color="#20c997" style={{ cursor: 'default' }}>
                            <WidgetHeader>
                                <h3>🧠 퀴즈 풀기</h3>
                            </WidgetHeader>
                            <QuizWidget />
                        </WidgetCard>

                        {/* [연두색 영역] 오늘의 친구 */}
                        {todaysFriend ? (
                            <FriendSection to={`/my-room/${todaysFriend.id}`}>
                                <WidgetHeader>
                                    <h3 style={{ color: '#2b8a3e' }}>🌟 오늘의 친구</h3>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2b8a3e', background: 'rgba(255,255,255,0.8)', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>VISIT</span>
                                </WidgetHeader>
                                <FriendCardContent>
                                    <SpotLight />
                                    <FriendAvatarGroup>
                                        <FullBodyAvatar>
                                            {friendAvatarUrls.map((src, i) => <PartImage key={i} src={src} style={{ zIndex: i }} />)}
                                        </FullBodyAvatar>

                                        {/* 친구 파트너 펫 & 레벨 표시 */}
                                        {friendPartnerPet && (
                                            <FriendPet>
                                                <img
                                                    src={petImageMap[`${friendPartnerPet.appearanceId}_idle`] || baseAvatar}
                                                    alt="pet"
                                                />
                                                <FriendPetLevelBadge>
                                                    Lv.{friendPartnerPet.level}
                                                </FriendPetLevelBadge>
                                            </FriendPet>
                                        )}
                                    </FriendAvatarGroup>
                                    <FriendInfo>
                                        {/* ▼▼▼ 친구 칭호(Title) 표시 - 이름 위에 회색 글씨로 ▼▼▼ */}
                                        <FriendRoleBadge>
                                            {friendTitle ? friendTitle.name : (todaysFriend.role === 'admin' ? 'TEACHER' : 'PLAYER')}
                                        </FriendRoleBadge>
                                        {/* ▲▲▲ ------------------------------------------ ▲▲▲ */}

                                        <FriendName>
                                            {todaysFriend.name}
                                            {getWinningStars(todaysFriend.win_count || 0)}
                                        </FriendName>

                                        {/* 친구 펫 이름 표시 추가 */}
                                        {friendPartnerPet && (
                                            <InfoBadge>
                                                <span style={{ fontSize: '0.9rem' }}>🐾</span>{friendPartnerPet.name}
                                            </InfoBadge>
                                        )}

                                        <InfoBadge><span style={{ fontSize: '0.9rem' }}>🛡️</span>{friendTeamName}</InfoBadge>
                                    </FriendInfo>
                                </FriendCardContent>
                            </FriendSection>
                        ) : (
                            <WidgetCard to="#" as="div">
                                <WidgetHeader><h3>🌟 오늘의 친구</h3></WidgetHeader>
                                <div style={{ textAlign: 'center', color: '#adb5bd', marginTop: '2rem' }}>아직 친구가 없어요 🥲</div>
                            </WidgetCard>
                        )}
                    </MainGrid>

                    {/* 3. Footer Goal */}
                    <GoalSection>
                        <GoalHeader>
                            <GoalTitle>🔥 우리 반 공동 목표</GoalTitle>
                            {activeGoal && (
                                <span style={{ fontWeight: '800', color: '#868e96' }}>
                                    {activeGoal.currentPoints.toLocaleString()} / {activeGoal.targetPoints.toLocaleString()}
                                </span>
                            )}
                        </GoalHeader>
                        {activeGoal ? (
                            <>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#495057' }}>{activeGoal.title}</h4>
                                <GoalProgress $percent={Math.min((activeGoal.currentPoints / activeGoal.targetPoints) * 100, 100)} />
                                <DonateBox>
                                    <input type="number" placeholder="P" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} />
                                    <button onClick={handleDonate} disabled={activeGoal.status === 'paused'}>
                                        {activeGoal.status === 'paused' ? '일시정지' : '기부하기'}
                                    </button>
                                </DonateBox>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#adb5bd' }}>진행 중인 목표가 없습니다.</div>
                        )}
                    </GoalSection>
                </>
            )}
        </DashboardWrapper>
    );
}

export default DashboardPage;