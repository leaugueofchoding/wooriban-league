// src/store/leagueStore.js

import { create } from 'zustand';
import {
    getPlayers,
    getTeams,
    getMatches,
    updateMatchScores,
    deletePlayer,
    addTeam,
    deleteTeam,
    updateTeamMembers,
    batchUpdateTeams,
    batchAddTeams,
    deleteMatchesBySeason,
    batchAddMatches,
    getSeasons,
    updateSeason,
    getUsers,
    linkPlayerToAuth,
    getAvatarParts,
    getMissions,
    getMissionSubmissions,
    updateMissionStatus,
    deleteMission,
    createPlayerFromUser,
    markNotificationsAsRead,
    getTodaysQuizHistory,
    submitQuizAnswer as firebaseSubmitQuizAnswer,
    requestMissionApproval,
    batchAdjustPlayerPoints,
    isAttendanceRewardAvailable,
    grantAttendanceReward,
    db
} from '../api/firebase';
// [수정] onSnapshot과 doc 함수 import
import { collection, query, where, orderBy, limit, onSnapshot, doc, Timestamp } from "firebase/firestore"; // Timestamp 추가
import { auth } from '../api/firebase';
import allQuizzes from '../assets/missions.json';

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    showAttendanceModal: false,
    players: [],
    teams: [],
    matches: [],
    users: [],
    avatarParts: [],
    missions: [],
    archivedMissions: [],
    missionSubmissions: [],
    currentSeason: null,
    isLoading: true,
    leagueType: 'mixed',
    notifications: [],
    unreadNotificationCount: 0,
    approvalBonus: 0, // [추가] 오늘의 승인 보너스 총합
    listeners: {
        notifications: null,
        playerData: null,
        missionSubmissions: null,
        approvalBonus: null, // [추가] 승인 보너스 리스너

    },
    dailyQuiz: null,
    quizHistory: [],
    currentUser: null,


    // --- Actions ---
    setLoading: (status) => set({ isLoading: status }),
    setLeagueType: (type) => set({ leagueType: type }),

    updateLocalAvatarPartStatus: (partId, newStatus) => {
        set(state => ({
            avatarParts: state.avatarParts.map(part =>
                part.id === partId ? { ...part, status: newStatus } : part
            )
        }));
    },

    updateLocalAvatarPartDisplayName: (partId, newName) => {
        set(state => ({
            avatarParts: state.avatarParts.map(part =>
                part.id === partId ? { ...part, displayName: newName } : part
            )
        }));
    },

    fetchInitialData: async () => {
        try {
            set({ isLoading: true });

            const currentUser = auth.currentUser;
            set({ currentUser });

            // 사용자가 로그인하면 실시간 구독 시작
            if (currentUser) {
                get().cleanupListeners(); // 기존 리스너 정리
                // 플레이어 데이터를 먼저 가져온 후에 구독 시작
                const playersData = await getPlayers();
                set({ players: playersData });

                get().subscribeToNotifications(currentUser.uid);
                get().subscribeToPlayerData(currentUser.uid);
                get().subscribeToMissionSubmissions(currentUser.uid);
                const myPlayerData = playersData.find(p => p.authUid === currentUser.uid);
                if (myPlayerData && ['admin', 'recorder'].includes(myPlayerData.role)) {
                    get().subscribeToApprovalBonus(currentUser.uid);
                }
            }

            const seasons = await getSeasons();
            const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'preparing') || seasons[0] || null;

            if (!activeSeason) {
                console.log("활성화된 시즌이 없습니다.");
                const [usersData, avatarPartsData] = await Promise.all([getUsers(), getAvatarParts()]);
                return set({
                    isLoading: false,
                    teams: [], matches: [], missions: [],
                    users: usersData, avatarParts: avatarPartsData
                });
            }

            const [
                playersData, // fetchInitialData 호출 시 players는 이미 위에서 가져왔으므로 한번 더 가져오지 않아도 됨
                teamsData,
                matchesData,
                usersData,
                avatarPartsData,
                activeMissionsData,
                archivedMissionsData,
                submissionsData
            ] = await Promise.all([
                get().players.length > 0 ? Promise.resolve(get().players) : getPlayers(), // 플레이어 데이터가 없으면 다시 가져옴
                getTeams(activeSeason.id),
                getMatches(activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMissions('active'),
                getMissions('archived'),
                getMissionSubmissions()
            ]);

            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
                users: usersData,
                avatarParts: avatarPartsData,
                missions: activeMissionsData,
                archivedMissions: archivedMissionsData,
                missionSubmissions: submissionsData,
                currentSeason: activeSeason,
                isLoading: false,
            });
        } catch (error) {
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
        }
    },

    archiveMission: async (missionId) => {
        if (!confirm('미션을 숨기면 활성 목록에서 사라집니다. 정말 숨기시겠습니까?')) return;
        try {
            await updateMissionStatus(missionId, 'archived');
            alert('미션이 보관되었습니다.');
            await get().fetchInitialData();
        } catch (error) {
            console.error('미션 보관 오류:', error);
            alert('미션 보관 중 오류가 발생했습니다.');
        }
    },

    unarchiveMission: async (missionId) => {
        try {
            await updateMissionStatus(missionId, 'active');
            alert('미션이 다시 활성화되었습니다.');
            await get().fetchInitialData();
        } catch (error) {
            console.error('미션 활성화 오류:', error);
            alert('미션 활성화 중 오류가 발생했습니다.');
        }
    },

    removeMission: async (missionId) => {
        if (!confirm('정말로 미션을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await deleteMission(missionId);
            alert('미션이 삭제되었습니다.');
            await get().fetchInitialData();
        } catch (error) {
            console.error('미션 삭제 오류:', error);
            alert('미션 삭제 중 오류가 발생했습니다.');
        }
    },

    registerAsPlayer: async () => {
        const user = auth.currentUser;
        if (!user) return alert('로그인이 필요합니다.');
        if (window.confirm('리그에 선수로 참가하시겠습니까? 참가 시 기본 정보가 등록됩니다.')) {
            try {
                await createPlayerFromUser(user);
                alert('리그 참가 신청이 완료되었습니다!');
                await get().fetchInitialData();
            } catch (error) {
                console.error("리그 참가 오류:", error);
                alert('참가 신청 중 오류가 발생했습니다.');
            }
        }
    },

    submitMissionForApproval: async (missionId) => {
        const { players } = get();
        const user = auth.currentUser;

        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        const myPlayerData = players.find(p => p.authUid === user.uid);

        if (!myPlayerData) {
            alert('선수 정보를 찾을 수 없습니다.');
            return;
        }

        try {
            await requestMissionApproval(missionId, myPlayerData.id, myPlayerData.name);
            alert('미션 완료를 요청했습니다. 기록원이 확인할 때까지 잠시 기다려주세요!');
        } catch (error) {
            console.error("미션 제출 오류:", error);
            alert(error.message);
        }
    },

    batchAdjustPoints: async (playerIds, amount, reason) => {
        if (playerIds.length === 0 || amount === 0 || !reason.trim()) {
            alert('플레이어, 0이 아닌 포인트, 그리고 사유를 모두 입력해야 합니다.');
            return;
        }
        const playerNames = playerIds.map(id => get().players.find(p => p.id === id)?.name).join(', ');
        const actionText = amount > 0 ? '지급' : '차감';
        const confirmationMessage = `${playerNames} 선수들에게 ${Math.abs(amount)} 포인트를 ${actionText}하시겠습니까?\n\n사유: ${reason}`;
        if (!window.confirm(confirmationMessage)) return;

        try {
            set({ isLoading: true });
            await batchAdjustPlayerPoints(playerIds, amount, reason);
            alert('포인트가 성공적으로 일괄 조정되었습니다.');
            // 전체 데이터를 다시 로드하는 대신 필요한 데이터만 갱신 (실시간 리스너가 처리)
            await get().fetchInitialData();
        } catch (error) {
            console.error("포인트 일괄 조정 액션 오류:", error);
            alert(`포인트 조정 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            set({ isLoading: false });
        }
    },

    // --- Realtime Listeners ---
    subscribeToPlayerData: (userId) => {
        const playerDocRef = doc(db, 'players', userId);
        const unsubscribe = onSnapshot(playerDocRef, (doc) => {
            if (doc.exists()) {
                const updatedPlayerData = { id: doc.id, ...doc.data() };
                set(state => ({
                    players: state.players.map(p => p.id === userId ? updatedPlayerData : p)
                }));
            }
        }, (error) => console.error("플레이어 데이터 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, playerData: unsubscribe } }));
    },

    subscribeToMissionSubmissions: (userId) => {
        const player = get().players.find(p => p.authUid === userId);
        if (!player) return;

        const submissionsRef = collection(db, 'missionSubmissions');
        const q = query(submissionsRef, where('studentId', '==', player.id));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const mySubmissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            set(state => {
                const othersSubmissions = state.missionSubmissions.filter(sub => sub.studentId !== player.id);
                return { missionSubmissions: [...othersSubmissions, ...mySubmissions] };
            });
        }, (error) => console.error("미션 제출 기록 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, missionSubmissions: unsubscribe } }));
    },

    subscribeToNotifications: (userId) => {
        const notifsRef = collection(db, 'notifications');
        const q = query(notifsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const notifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const unreadCount = notifications.filter(n => !n.isRead).length;
            set({ notifications, unreadNotificationCount: unreadCount });
        }, (error) => console.error("알림 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, notifications: unsubscribe } }));
    },

    subscribeToApprovalBonus: (userId) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 오늘 날짜의 시작
        const todayTimestamp = Timestamp.fromDate(today);

        const historyRef = collection(db, 'point_history');
        const q = query(
            historyRef,
            where('playerId', '==', userId),
            where('reason', '>=', '미션 승인 보너스'),
            where('reason', '<=', '미션 승인 보너스\uf8ff'), // '미션 승인 보너스'로 시작하는 모든 항목을 찾는 쿼리
            where('timestamp', '>=', todayTimestamp)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            let totalBonus = 0;
            querySnapshot.forEach(doc => {
                totalBonus += doc.data().changeAmount;
            });
            set({ approvalBonus: totalBonus });
        }, (error) => console.error("승인 보너스 실시간 수신 오류:", error));

        set(state => ({ listeners: { ...state.listeners, approvalBonus: unsubscribe } }));
    },

    cleanupListeners: () => {
        const { listeners } = get();
        Object.values(listeners).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        set({
            listeners: { notifications: null, playerData: null, missionSubmissions: null, approvalBonus: null },
            approvalBonus: 0 // 로그아웃 시 보너스 초기화
        });
    },

    markAsRead: async () => {
        const userId = auth.currentUser?.uid;
        if (!userId || get().unreadNotificationCount === 0) return;
        await markNotificationsAsRead(userId);
    },

    fetchDailyQuiz: async (studentId) => {
        const todaysHistory = await getTodaysQuizHistory(studentId);
        set({ quizHistory: todaysHistory });
        if (todaysHistory.length >= 5) {
            set({ dailyQuiz: null });
            return;
        }
        const solvedQuizIds = todaysHistory.map(h => h.quizId);
        const allQuizList = Object.values(allQuizzes).flat();
        const availableQuizzes = allQuizList.filter(q => !solvedQuizIds.includes(q.id));
        if (availableQuizzes.length === 0) {
            set({ dailyQuiz: null });
            return;
        }
        const randomQuiz = availableQuizzes[Math.floor(Math.random() * availableQuizzes.length)];
        set({ dailyQuiz: randomQuiz });
    },

    submitQuizAnswer: async (quizId, userAnswer) => {
        const myPlayerData = get().players.find(p => p.authUid === auth.currentUser?.uid);
        if (!myPlayerData) return false;

        const correctAnswer = get().dailyQuiz.answer;
        const isCorrect = await firebaseSubmitQuizAnswer(myPlayerData.id, quizId, userAnswer, correctAnswer);
        // 포인트 업데이트는 실시간 리스너가 처리
        return isCorrect;
    },

    // --- Season & League Management (기존과 동일) ---
    startSeason: async () => {
        const season = get().currentSeason;
        if (!season || season.status !== 'preparing') return alert('준비 중인 시즌만 시작할 수 있습니다.');
        if (!confirm('시즌을 시작하면 선수/팀 구성 및 경기 일정 생성이 불가능해집니다. 시작하시겠습니까?')) return;
        try {
            await updateSeason(season.id, { status: 'active' });
            await get().fetchInitialData();
        } catch (error) {
            console.error("시즌 시작 오류:", error);
        }
    },

    endSeason: async () => {
        const season = get().currentSeason;
        if (!season || season.status !== 'active') return alert('진행 중인 시즌만 종료할 수 있습니다.');
        if (!confirm('시즌을 종료하시겠습니까?')) return;
        try {
            await updateSeason(season.id, { status: 'completed' });
            alert('시즌이 종료되었습니다.');
            await get().fetchInitialData();
        } catch (error) {
            console.error("시즌 종료 오류:", error);
        }
    },

    linkPlayer: async (playerId, authUid, role) => {
        if (!playerId || !authUid || !role) {
            return alert('선수, 사용자, 역할을 모두 선택해야 합니다.');
        }
        try {
            await linkPlayerToAuth(playerId, authUid, role);
            alert('성공적으로 연결되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("계정 연결 오류:", error);
        }
    },

    removePlayer: async (playerId) => {
        if (!confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(playerId);
        get().fetchInitialData();
    },

    addNewTeam: async (teamName) => {
        if (!teamName.trim()) return alert('팀 이름을 입력해주세요.');
        const seasonId = get().currentSeason?.id;
        if (!seasonId) return alert('현재 시즌 정보를 불러올 수 없습니다.');
        await addTeam({ teamName, seasonId, captainId: null, members: [] });
        get().fetchInitialData();
    },

    removeTeam: async (teamId) => {
        if (!confirm('정말로 이 팀을 삭제하시겠습니까?')) return;
        await deleteTeam(teamId);
        get().fetchInitialData();
    },

    batchCreateTeams: async (maleCount, femaleCount) => {
        const seasonId = get().currentSeason?.id;
        if (!seasonId) return alert('현재 시즌 정보를 불러올 수 없습니다.');
        const newTeams = [];
        for (let i = 1; i <= maleCount; i++) newTeams.push({ teamName: `남자 ${i}팀`, gender: '남', seasonId, captainId: null, members: [] });
        for (let i = 1; i <= femaleCount; i++) newTeams.push({ teamName: `여자 ${i}팀`, gender: '여', seasonId, captainId: null, members: [] });
        if (newTeams.length > 0 && confirm(`${newTeams.length}개의 팀을 생성하시겠습니까?`)) {
            try {
                await batchAddTeams(newTeams);
                alert('팀이 성공적으로 생성되었습니다.');
                get().fetchInitialData();
            } catch (error) {
                console.error("팀 일괄 생성 오류:", error);
            }
        }
    },

    assignPlayerToTeam: async (teamId, playerId) => {
        if (!playerId) return;
        const team = get().teams.find(t => t.id === teamId);
        if (team.members.includes(playerId)) return alert('이미 팀에 속한 선수입니다.');
        await updateTeamMembers(teamId, [...team.members, playerId]);
        get().fetchInitialData();
    },

    unassignPlayerFromTeam: async (teamId, playerId) => {
        const team = get().teams.find(t => t.id === teamId);
        await updateTeamMembers(teamId, team.members.filter(id => id !== playerId));
        get().fetchInitialData();
    },

    autoAssignTeams: async () => {
        if (!confirm('팀원을 자동 배정하시겠습니까?')) return;
        const { players, teams } = get();
        if (players.length === 0 || teams.length === 0) return alert('선수와 팀이 모두 필요합니다.');
        try {
            const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
            const teamUpdates = teams.map(team => ({ id: team.id, members: [], captainId: null }));
            shuffledPlayers.forEach((player, index) => {
                teamUpdates[index % teams.length].members.push(player.id);
            });
            teamUpdates.forEach(update => {
                if (update.members.length > 0) update.captainId = update.members[0];
            });
            await batchUpdateTeams(teamUpdates);
            alert('자동 배정이 완료되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("자동 배정 중 오류 발생:", error);
        }
    },

    generateSchedule: async () => {
        if (!confirm('경기 일정을 새로 생성하시겠습니까?')) return;
        const { teams, leagueType, currentSeason } = get();
        if (!currentSeason) return alert('현재 시즌 정보가 없습니다.');
        if (teams.length < 2) return alert('최소 2팀이 필요합니다.');
        let matchesToCreate = [];
        const createRoundRobin = (teamList) => {
            const schedule = [];
            for (let i = 0; i < teamList.length; i++) {
                for (let j = i + 1; j < teamList.length; j++) {
                    schedule.push({ seasonId: currentSeason.id, teamA_id: teamList[i].id, teamB_id: teamList[j].id, teamA_score: null, teamB_score: null, status: '예정' });
                }
            }
            return schedule;
        };
        if (leagueType === 'separated') {
            matchesToCreate = [...createRoundRobin(teams.filter(t => t.gender === '남')), ...createRoundRobin(teams.filter(t => t.gender === '여'))];
        } else {
            matchesToCreate = createRoundRobin(teams);
        }
        if (matchesToCreate.length === 0) return alert('생성할 경기가 없습니다.');
        try {
            await deleteMatchesBySeason(currentSeason.id);
            await batchAddMatches(matchesToCreate);
            alert('경기 일정이 성공적으로 생성되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("경기 일정 생성 오류:", error);
        }
    },

    saveScores: async (matchId, scores) => {
        try {
            await updateMatchScores(matchId, scores);
            get().fetchInitialData();
        } catch (error) {
            console.error("점수 저장 오류:", error);
        }
    },

    checkAttendance: async () => {
        const user = auth.currentUser;
        if (!user) return;
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) return;
        try {
            const isAvailable = await isAttendanceRewardAvailable(myPlayerData.id);
            if (isAvailable) {
                set({ showAttendanceModal: true });
            }
        } catch (error) {
            console.error("출석 체크 가능 여부 확인 중 오류:", error);
        }
    },

    claimAttendanceReward: async () => {
        const user = auth.currentUser;
        if (!user) return;
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) return;
        try {
            const rewardAmount = 50;
            await grantAttendanceReward(myPlayerData.id, rewardAmount);
            set({ showAttendanceModal: false });
            // 포인트 업데이트는 실시간 리스너가 처리하므로 fetch 불필요
        } catch (error) {
            console.error("출석 보상 지급 중 오류:", error);
            alert(error.message);
        }
    },

    closeAttendanceModal: () => {
        set({ showAttendanceModal: false });
    },
}));