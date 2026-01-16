// src/pages/DashboardPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, getActiveGoals, donatePointsToGoal, getPlayerSeasonStats } from '../api/firebase';
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

    // 모드 상태 관리
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboardViewMode') || 'simple');
    const [bgMode, setBgMode] = useState(() => localStorage.getItem('dashboardBgMode') || 'default');

    // 심플 모드 배경색 상태 관리
    const [simpleBgColor, setSimpleBgColor] = useState(() => localStorage.getItem('simpleBgColor') || '#f8f9fa');

    // 우승 횟수 상태 관리
    const [winCounts, setWinCounts] = useState({});

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

    // 우승 횟수 조회 로직
    useEffect(() => {
        const fetchWinCounts = async () => {
            if (!classId) return;
            const targets = [];
            if (myPlayerData) targets.push(myPlayerData.id);
            if (todaysFriend) targets.push(todaysFriend.id);

            const uniqueTargets = [...new Set(targets)];
            const newCounts = {};

            await Promise.all(uniqueTargets.map(async (playerId) => {
                try {
                    const stats = await getPlayerSeasonStats(classId, playerId);
                    const wins = stats.filter(s => s.rank === 1 && s.season?.status === 'completed').length;
                    newCounts[playerId] = wins;
                } catch (err) {
                    console.error("우승 기록 조회 실패:", err);
                    newCounts[playerId] = 0;
                }
            }));

            setWinCounts(newCounts);
        };

        fetchWinCounts();
    }, [classId, myPlayerData?.id, todaysFriend?.id]);

    const myPlayerDataWithWins = useMemo(() => {
        if (!myPlayerData) return null;
        return { ...myPlayerData, win_count: winCounts[myPlayerData.id] || 0 };
    }, [myPlayerData, winCounts]);

    const todaysFriendWithWins = useMemo(() => {
        if (!todaysFriend) return null;
        return { ...todaysFriend, win_count: winCounts[todaysFriend.id] || 0 };
    }, [todaysFriend, winCounts]);


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
    // [수정] 리그 순위 최대 6개 팀 표시 (기존 3개 -> 5개)
    const topRankedTeams = useMemo(() => standingsData().slice(0, 5), [standingsData]);
    const rankIcons = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"];

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

    const handleSimpleBgChange = (color) => {
        setSimpleBgColor(color);
        localStorage.setItem('simpleBgColor', color);
    };

    if (!currentUser || !myPlayerData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
                <JoinLeagueButton onClick={registerAsPlayer} style={{ maxWidth: '300px' }}>
                    👋 선수 등록하고 입장하기
                </JoinLeagueButton>
            </div>
        );
    }

    const currentBgUrl = (bgMode === 'myroom' && myPlayerData.myRoomSnapshotUrl)
        ? myPlayerData.myRoomSnapshotUrl
        : defaultForestBg;

    return (
        <PageWrapper>
            <ViewModeToggle>
                <ToggleBtn onClick={toggleViewMode}>
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
                    myPlayerData={myPlayerDataWithWins}
                    myAvatarUrls={myAvatarUrls}
                    myPartnerPet={myPartnerPet}
                    todaysFriend={todaysFriendWithWins}
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
                    myPlayerData={myPlayerDataWithWins}
                    myAvatarUrls={myAvatarUrls}
                    myPartnerPet={myPartnerPet}
                    equippedTitle={equippedTitle}
                    todaysFriend={todaysFriendWithWins}
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
                    simpleBgColor={simpleBgColor}
                    onBgColorChange={handleSimpleBgChange}
                />
            )}
        </PageWrapper>
    );
}

export default DashboardPage;