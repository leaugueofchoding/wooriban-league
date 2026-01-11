import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, getActiveGoals, donatePointsToGoal } from '../api/firebase';
import DashboardGameMode from '../components/dashboard/DashboardGameMode';
import DashboardSimpleMode from '../components/dashboard/DashboardSimpleMode';
import confetti from 'canvas-confetti';
import baseAvatar from '../assets/base-avatar.png';
import defaultForestBg from '../assets/Background_forest.png';

const PageWrapper = styled.div`
  font-family: 'Pretendard', sans-serif;
  min-height: 100vh;
  position: relative;
`;

const JoinLeagueButton = styled.button`
  width: 100%; padding: 1.2rem; font-size: 1.2rem; font-weight: 800; background: linear-gradient(135deg, #4dabf7, #1c7ed6); color: white; border: none; border-radius: 16px; cursor: pointer; box-shadow: 0 8px 16px rgba(28, 126, 214, 0.2); transition: transform 0.2s;
  &:hover { transform: translateY(-3px); }
`;

// 토글 버튼 위치: 왼쪽 상단
const ViewModeToggle = styled.div`
  position: fixed;
  top: 15px;
  left: 15px;
  z-index: 9999;
  display: flex;
  gap: 8px;
`;

const ToggleBtn = styled.button`
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 12px;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #495057;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;

  &:hover {
    transform: translateY(-2px);
    background: white;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }
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

function DashboardPage() {
    const { classId } = useClassStore();
    const { players, missions, registerAsPlayer, missionSubmissions, avatarParts, titles, standingsData } = useLeagueStore();
    const currentUser = auth.currentUser;
    const [activeGoal, setActiveGoal] = useState(null);

    // 모드 상태 관리 (로컬 스토리지)
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboardViewMode') || 'simple');
    const [bgMode, setBgMode] = useState(() => localStorage.getItem('dashboardBgMode') || 'default');

    const myPlayerData = useMemo(() => currentUser ? players.find(p => p.authUid === currentUser.uid) : null, [players, currentUser]);

    const myPartnerPet = useMemo(() => {
        if (!myPlayerData) return null;
        if (myPlayerData.pets && myPlayerData.pets.length > 0) return myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) || myPlayerData.pets[0];
        if (myPlayerData.pet) return myPlayerData.pet;
        return null;
    }, [myPlayerData]);

    const getTodayStar = (playerList, myId) => {
        if (!playerList || playerList.length <= 1) return null;
        const candidates = playerList.filter(p => p.id !== myId && p.status !== 'inactive').sort((a, b) => a.id.localeCompare(b.id));
        if (candidates.length === 0) return null;
        const epoch = new Date('2025-01-01').getTime();
        const index = Math.floor((Date.now() - epoch) / (1000 * 60 * 60 * 24)) % candidates.length;
        return candidates[index];
    };

    const todaysFriend = useMemo(() => getTodayStar(players, myPlayerData?.id), [players, myPlayerData]);
    const equippedTitle = useMemo(() => (myPlayerData?.equippedTitle && titles.length) ? titles.find(t => t.id === myPlayerData.equippedTitle) : null, [myPlayerData, titles]);

    const friendPartnerPet = useMemo(() => {
        if (!todaysFriend) return null;
        if (todaysFriend.pets && todaysFriend.pets.length > 0) return todaysFriend.pets.find(p => p.id === todaysFriend.partnerPetId) || todaysFriend.pets[0];
        if (todaysFriend.pet) return todaysFriend.pet;
        return null;
    }, [todaysFriend]);

    const friendTitle = useMemo(() => {
        if (!todaysFriend?.equippedTitle || !titles.length) return null;
        return titles.find(t => t.id === todaysFriend.equippedTitle);
    }, [todaysFriend, titles]);

    const friendTeamName = useMemo(() => {
        if (!todaysFriend?.teamId) return "무소속";
        const team = standingsData().find(t => t.id === todaysFriend.teamId);
        return team ? team.teamName : "무소속";
    }, [todaysFriend, standingsData]);

    const myAvatarUrls = useMemo(() => getAvatarUrls(myPlayerData?.avatarConfig, avatarParts), [myPlayerData, avatarParts]);
    const friendAvatarUrls = useMemo(() => getAvatarUrls(todaysFriend?.avatarConfig, avatarParts), [todaysFriend, avatarParts]);

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
            if (m.isFixed && sub && sub.status === 'approved' && sub.approvedAt) {
                const approvedDate = new Date(sub.approvedAt.toDate()).toDateString();
                const todayDate = new Date().toDateString();
                if (approvedDate === todayDate) return false;
            } else if (sub && sub.status === 'approved') {
                return false;
            }
            return true;
        });
    }, [missions, mySubmissions]);

    const recentMissions = activeMissions.slice(0, 3);
    const topRankedTeams = useMemo(() => standingsData().slice(0, 3), [standingsData]);
    const rankIcons = ["🥇", "🥈", "🥉"];

    useEffect(() => {
        if (!classId) return;
        getActiveGoals(classId).then(goals => {
            if (goals.length > 0) {
                setActiveGoal(goals[0]);
                if (goals[0].currentPoints >= goals[0].targetPoints) confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 } });
            } else {
                setActiveGoal(null);
            }
        });
    }, [classId]);

    const handleDonate = async (amountStr) => {
        const amount = Number(amountStr);
        if (amount <= 0 || myPlayerData.points < amount) return alert('포인트가 부족하거나 올바르지 않습니다.');
        if (window.confirm(`${amount}P를 기부하시겠습니까?`)) {
            try {
                await donatePointsToGoal(classId, myPlayerData.id, activeGoal.id, amount);
                alert('기부 성공! 👍');
                // 목표 업데이트
                const goals = await getActiveGoals(classId);
                if (goals.length > 0) setActiveGoal(goals[0]);
            } catch (error) {
                alert(error.message);
            }
        }
    };

    const toggleViewMode = () => {
        const newMode = viewMode === 'game' ? 'simple' : 'game';
        setViewMode(newMode);
        localStorage.setItem('dashboardViewMode', newMode);
    };

    const toggleBgMode = () => {
        if (!myPlayerData?.myRoomSnapshotUrl && bgMode === 'default') {
            alert("저장된 마이룸 스냅샷이 없습니다. 마이룸에서 '저장'을 먼저 해주세요!");
            return;
        }
        const newBgMode = bgMode === 'default' ? 'myroom' : 'default';
        setBgMode(newBgMode);
        localStorage.setItem('dashboardBgMode', newBgMode);
    };

    // 렌더링
    if (!currentUser || !myPlayerData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
                <JoinLeagueButton onClick={registerAsPlayer} style={{ maxWidth: '300px' }}>
                    👋 선수 등록하고 입장하기
                </JoinLeagueButton>
            </div>
        );
    }

    // 배경 URL
    const currentBgUrl = (bgMode === 'myroom' && myPlayerData.myRoomSnapshotUrl)
        ? myPlayerData.myRoomSnapshotUrl
        : defaultForestBg;

    return (
        <PageWrapper>
            <ViewModeToggle>
                <ToggleBtn onClick={toggleViewMode}>
                    {/* [수정] 토글 이름 변경: 마이룸 모드 */}
                    {viewMode === 'game' ? '🏠 마이룸 모드' : '📋 심플 모드'}
                </ToggleBtn>
                {viewMode === 'game' && (
                    <ToggleBtn onClick={toggleBgMode} title="배경 변경 (기본/마이룸)">
                        {bgMode === 'default' ? '🖼️ 기본 배경' : '📷 내 방 배경'}
                    </ToggleBtn>
                )}
            </ViewModeToggle>

            {viewMode === 'game' ? (
                <DashboardGameMode
                    myPlayerData={myPlayerData}
                    myAvatarUrls={myAvatarUrls}
                    myPartnerPet={myPartnerPet}
                    todaysFriend={todaysFriend}
                    friendAvatarUrls={friendAvatarUrls}
                    friendPartnerPet={friendPartnerPet}
                    activeGoal={activeGoal}
                    activeMissions={activeMissions}
                    recentMissions={recentMissions}
                    bgUrl={currentBgUrl}
                    onDonate={handleDonate}
                />
            ) : (
                <DashboardSimpleMode
                    myPlayerData={myPlayerData}
                    myAvatarUrls={myAvatarUrls}
                    myPartnerPet={myPartnerPet}
                    equippedTitle={equippedTitle}
                    todaysFriend={todaysFriend}
                    friendAvatarUrls={friendAvatarUrls}
                    friendPartnerPet={friendPartnerPet}
                    friendTitle={friendTitle}
                    friendTeamName={friendTeamName}
                    activeGoal={activeGoal}
                    activeMissions={activeMissions}
                    recentMissions={recentMissions}
                    topRankedTeams={topRankedTeams}
                    rankIcons={rankIcons}
                    onDonate={handleDonate}
                    mySubmissions={mySubmissions}
                />
            )}
        </PageWrapper>
    );
}

export default DashboardPage;