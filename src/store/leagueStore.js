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
    updateTeamCaptain,
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
    db,
    updatePlayerStatus,
    createNewSeason
} from '../api/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, Timestamp } from "firebase/firestore";
import { auth } from '../api/firebase';
import allQuizzes from '../assets/missions.json';

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    seasons: [],
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
    approvalBonus: 0,
    listeners: {
        notifications: null,
        playerData: null,
        missionSubmissions: null,
        approvalBonus: null,
    },
    dailyQuiz: null, // 현재 풀어야 할 퀴즈
    dailyQuizSet: { date: null, quizzes: [] }, // 오늘 풀어야 할 5개의 퀴즈 묶음
    quizHistory: [], // 오늘 푼 퀴즈 기록
    currentUser: null,
    pointAdjustmentNotification: null, // [추가]


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

            const seasonsData = await getSeasons();
            set({ seasons: seasonsData });
            const activeSeason = seasonsData.find(s => s.status === 'active' || s.status === 'preparing') || seasonsData[0] || null;

            if (currentUser) {
                get().cleanupListeners();
                const playersData = await getPlayers();
                set({ players: playersData });

                get().subscribeToNotifications(currentUser.uid);
                get().subscribeToPlayerData(currentUser.uid);
                get().subscribeToMissionSubmissions(currentUser.uid);

                const myPlayerData = playersData.find(p => p.authUid === currentUser.uid);
                if (myPlayerData && ['admin', 'recorder'].includes(myPlayerData.role)) {
                    get().subscribeToRecorderBonus(currentUser.uid); // [수정] 함수 이름 변경
                }
            }

            if (!activeSeason) {
                const [usersData, avatarPartsData] = await Promise.all([getUsers(), getAvatarParts()]);
                return set({
                    isLoading: false,
                    teams: [], matches: [], missions: [],
                    users: usersData, avatarParts: avatarPartsData, currentSeason: null
                });
            }

            const [
                playersData, teamsData, matchesData, usersData,
                avatarPartsData, activeMissionsData, archivedMissionsData, submissionsData
            ] = await Promise.all([
                get().players.length > 0 ? Promise.resolve(get().players) : getPlayers(),
                getTeams(activeSeason.id),
                getMatches(activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMissions('active'),
                getMissions('archived'),
                getMissionSubmissions()
            ]);

            set({
                players: playersData, teams: teamsData, matches: matchesData, users: usersData,
                avatarParts: avatarPartsData, missions: activeMissionsData,
                archivedMissions: archivedMissionsData, missionSubmissions: submissionsData,
                currentSeason: activeSeason, isLoading: false,
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
            const activeMissions = await getMissions('active');
            const archivedMissions = await getMissions('archived');
            set({ missions: activeMissions, archivedMissions: archivedMissions });
            alert('미션이 보관되었습니다.');
        } catch (error) {
            alert('미션 보관 중 오류가 발생했습니다.');
        }
    },

    unarchiveMission: async (missionId) => {
        try {
            await updateMissionStatus(missionId, 'active');
            const activeMissions = await getMissions('active');
            const archivedMissions = await getMissions('archived');
            set({ missions: activeMissions, archivedMissions: archivedMissions });
            alert('미션이 다시 활성화되었습니다.');
        } catch (error) {
            alert('미션 활성화 중 오류가 발생했습니다.');
        }
    },

    removeMission: async (missionId) => {
        if (!confirm('정말로 미션을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await deleteMission(missionId);
            const activeMissions = await getMissions('active');
            const archivedMissions = await getMissions('archived');
            set({ missions: activeMissions, archivedMissions: archivedMissions });
            alert('미션이 삭제되었습니다.');
        } catch (error) {
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
        if (!user) return alert('로그인이 필요합니다.');
        const myPlayerData = players.find(p => p.authUid === user.uid);
        if (!myPlayerData) return alert('선수 정보를 찾을 수 없습니다.');
        try {
            await requestMissionApproval(missionId, myPlayerData.id, myPlayerData.name);
            alert('미션 완료를 요청했습니다. 기록원이 확인할 때까지 잠시 기다려주세요!');
        } catch (error) {
            alert(error.message);
        }
    },

    batchAdjustPoints: async (playerIds, amount, reason) => {
        const playerNames = playerIds.map(id => get().players.find(p => p.id === id)?.name).join(', ');
        const actionText = amount > 0 ? '지급' : '차감';
        const confirmationMessage = `${playerNames} 선수들에게 ${Math.abs(amount)} 포인트를 ${actionText}하시겠습니까?\n\n사유: ${reason}`;
        if (!window.confirm(confirmationMessage)) return;
        try {
            await batchAdjustPlayerPoints(playerIds, amount, reason);
            const players = await getPlayers();
            set({ players });
            alert('포인트가 성공적으로 일괄 조정되었습니다.');
        } catch (error) {
            alert(`포인트 조정 중 오류가 발생했습니다: ${error.message}`);
        }
    },

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

            // [추가] 포인트 조정 알림 감지 및 모달 상태 업데이트
            const latestPointNotification = notifications.find(n => n.type === 'point' && !n.isRead && n.data);
            if (latestPointNotification) {
                set({ pointAdjustmentNotification: latestPointNotification });
            }

            set({ notifications, unreadNotificationCount: unreadCount });
        }, (error) => console.error("알림 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, notifications: unsubscribe } }));
    },
    subscribeToRecorderBonus: (userId) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const historyRef = collection(db, 'point_history');
        const q = query(
            historyRef,
            where('playerId', '==', userId),
            where('reason', '>=', '보너스'),
            where('reason', '<=', '보너스\uf8ff'),
            where('timestamp', '>=', todayTimestamp)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            let totalBonus = 0;
            // [수정] querySnapshot.forEach 내부의 if문 삭제
            querySnapshot.forEach(doc => {
                totalBonus += doc.data().changeAmount;
            });
            set({ approvalBonus: totalBonus });
        }, (error) => console.error("기록원 보너스 실시간 수신 오류:", error));

        set(state => ({ listeners: { ...state.listeners, approvalBonus: unsubscribe } }));
    },

    cleanupListeners: () => {
        const { listeners } = get();
        Object.values(listeners).forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        set({
            listeners: { notifications: null, playerData: null, missionSubmissions: null, approvalBonus: null },
            approvalBonus: 0
        });
    },

    markAsRead: async () => {
        const userId = auth.currentUser?.uid;
        if (!userId || get().unreadNotificationCount === 0) return;
        await markNotificationsAsRead(userId);
    },

    fetchDailyQuiz: async (studentId) => {
        const todayStr = new Date().toLocaleDateString('ko-KR');

        // ▼▼▼ [수정] localStorage에서 오늘의 퀴즈 목록을 불러옵니다 ▼▼▼
        const storedQuizSet = JSON.parse(localStorage.getItem('dailyQuizSet'));
        let todaysQuizzes = [];

        // 저장된 퀴즈가 있고, 날짜가 오늘과 같으면 그대로 사용
        if (storedQuizSet && storedQuizSet.date === todayStr) {
            todaysQuizzes = storedQuizSet.quizzes;
        } else {
            // 날짜가 다르거나 저장된 퀴즈가 없으면 새로 5개를 생성
            const allQuizList = Object.values(allQuizzes).flat();
            const shuffled = allQuizList.sort(() => 0.5 - Math.random());
            todaysQuizzes = shuffled.slice(0, 5);
            // 새로 만든 퀴즈 목록을 localStorage에 저장
            localStorage.setItem('dailyQuizSet', JSON.stringify({ date: todayStr, quizzes: todaysQuizzes }));
        }

        set({ dailyQuizSet: { date: todayStr, quizzes: todaysQuizzes } });

        const todaysHistory = await getTodaysQuizHistory(studentId);
        set({ quizHistory: todaysHistory });

        if (todaysHistory.length >= 5) {
            set({ dailyQuiz: null });
            return;
        }

        const nextQuiz = todaysQuizzes.find(quiz => !todaysHistory.some(h => h.quizId === quiz.id));
        set({ dailyQuiz: nextQuiz || null });
    },

    submitQuizAnswer: async (quizId, userAnswer) => {
        const myPlayerData = get().players.find(p => p.authUid === auth.currentUser?.uid);
        if (!myPlayerData) return false;

        const { dailyQuiz } = get();
        if (!dailyQuiz) return false;

        const isCorrect = await firebaseSubmitQuizAnswer(myPlayerData.id, quizId, userAnswer, dailyQuiz.answer);

        // 답변 제출 후, 다음 퀴즈를 불러오기 위해 fetchDailyQuiz 다시 호출
        await get().fetchDailyQuiz(myPlayerData.id);

        return isCorrect; // 정답 여부 반환
    },
    // ▲▲▲ 여기까지 수정 ▲▲▲

    createSeason: async (seasonName) => {
        await createNewSeason(seasonName);
        const seasonsData = await getSeasons();
        const activeSeason = seasonsData.find(s => s.status === 'active' || s.status === 'preparing') || seasonsData[0] || null;
        set({ seasons: seasonsData, currentSeason: activeSeason });
    },

    startSeason: async () => {
        const season = get().currentSeason;
        if (!season || season.status !== 'preparing') return alert('준비 중인 시즌만 시작할 수 있습니다.');
        if (!confirm('시즌을 시작하면 선수/팀 구성 및 경기 일정 생성이 불가능해집니다. 시작하시겠습니까?')) return;
        try {
            await updateSeason(season.id, { status: 'active' });
            set(state => ({ currentSeason: { ...state.currentSeason, status: 'active' } }));
        } catch (error) { console.error("시즌 시작 오류:", error); }
    },


    endSeason: async () => {
        const season = get().currentSeason;
        if (!season || season.status !== 'active') return alert('진행 중인 시즌만 종료할 수 있습니다.');
        if (!confirm('시즌을 종료하시겠습니까? 시즌의 모든 활동을 마감하고 순위별 보상을 지급합니다.')) return;

        try {
            const { teams, matches, players, batchAdjustPoints } = get();
            const completedMatches = matches.filter(m => m.status === '완료');

            // --- 1. 순위 계산 ---
            let stats = teams.map(team => ({
                id: team.id, teamName: team.teamName, points: 0, goalDifference: 0, goalsFor: 0,
            }));
            completedMatches.forEach(match => {
                const teamA = stats.find(t => t.id === match.teamA_id);
                const teamB = stats.find(t => t.id === match.teamB_id);
                if (!teamA || !teamB) return;
                teamA.goalsFor += match.teamA_score;
                teamB.goalsFor += match.teamB_score;
                teamA.goalDifference += match.teamA_score - match.teamB_score;
                teamB.goalDifference += match.teamB_score - match.teamA_score;
                if (match.teamA_score > match.teamB_score) teamA.points += 3;
                else if (match.teamB_score > match.teamA_score) teamB.points += 3;
                else { teamA.points++; teamB.points++; }
            });
            stats.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            // --- 2. 순위별 보상 지급 ---
            const prizeConfig = [
                { rank: 1, prize: season.winningPrize || 0, label: "우승" },
                { rank: 2, prize: season.secondPlacePrize || 0, label: "준우승" },
                { rank: 3, prize: season.thirdPlacePrize || 0, label: "3위" }
            ];

            for (const config of prizeConfig) {
                if (stats.length >= config.rank && config.prize > 0) {
                    const rankedTeamId = stats[config.rank - 1].id;
                    const rankedTeam = teams.find(t => t.id === rankedTeamId);
                    if (rankedTeam && rankedTeam.members.length > 0) {
                        await batchAdjustPoints(rankedTeam.members, config.prize, `${season.seasonName} ${config.label} 보상`);
                    }
                }
            }

            // ▼▼▼ [추가] 3. 득점왕 계산 및 보상 지급 로직 ▼▼▼
            const topScorerPrize = season.topScorerPrize || 0;
            if (topScorerPrize > 0) {
                const scorerPoints = {};
                completedMatches.forEach(match => {
                    if (match.scorers) {
                        Object.entries(match.scorers).forEach(([playerId, goals]) => {
                            scorerPoints[playerId] = (scorerPoints[playerId] || 0) + goals;
                        });
                    }
                });

                const maxGoals = Math.max(0, ...Object.values(scorerPoints));

                if (maxGoals > 0) {
                    const topScorers = Object.keys(scorerPoints).filter(playerId => scorerPoints[playerId] === maxGoals);
                    if (topScorers.length > 0) {
                        await batchAdjustPoints(topScorers, topScorerPrize, `${season.seasonName} 득점왕 보상`);
                    }
                }
            }
            // ▲▲▲ 여기까지 추가 ▲▲▲


            await updateSeason(season.id, { status: 'completed' });
            set(state => ({ currentSeason: { ...state.currentSeason, status: 'completed' } }));
            alert('시즌이 종료되고 순위별 보상이 지급되었습니다.');

        } catch (error) {
            console.error("시즌 종료 및 보상 지급 오류:", error);
            alert("시즌 종료 중 오류가 발생했습니다.");
        }
    },

    updateSeasonDetails: async (seasonId, dataToUpdate) => {
        try {
            await updateSeason(seasonId, dataToUpdate);
            set(state => ({
                seasons: state.seasons.map(s => s.id === seasonId ? { ...s, ...dataToUpdate } : s),
                currentSeason: state.currentSeason?.id === seasonId ? { ...state.currentSeason, ...dataToUpdate } : state.currentSeason
            }));
        } catch (error) {
            console.error("시즌 정보 업데이트 오류:", error);
            throw error;
        }
    },

    linkPlayer: async (playerId, authUid, role) => {
        if (!playerId || !authUid || !role) return alert('선수, 사용자, 역할을 모두 선택해야 합니다.');
        try {
            await linkPlayerToAuth(playerId, authUid, role);
            const players = await getPlayers();
            set({ players });
            alert('성공적으로 연결되었습니다.');
        } catch (error) { console.error("계정 연결 오류:", error); }
    },

    removePlayer: async (playerId) => {
        if (!confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(playerId);
        const players = await getPlayers();
        set({ players });
    },

    togglePlayerStatus: async (playerId, currentStatus) => {
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
        const actionText = newStatus === 'inactive' ? '비활성화' : '활성화';
        if (!confirm(`이 선수를 ${actionText} 상태로 변경하시겠습니까?`)) return;

        try {
            await updatePlayerStatus(playerId, newStatus);
            // 상태를 로컬에서도 즉시 업데이트하여 빠른 UI 반응을 유도
            set(state => ({
                players: state.players.map(p =>
                    p.id === playerId ? { ...p, status: newStatus } : p
                )
            }));
            alert(`선수가 ${actionText} 처리되었습니다.`);
        } catch (error) {
            console.error("선수 상태 변경 오류:", error);
            alert("상태 변경 중 오류가 발생했습니다.");
        }
    },

    addNewTeam: async (teamName) => {
        if (!teamName.trim()) return alert('팀 이름을 입력해주세요.');
        const seasonId = get().currentSeason?.id;
        if (!seasonId) return alert('현재 시즌 정보를 불러올 수 없습니다.');
        await addTeam({ teamName, seasonId, captainId: null, members: [] });
        const updatedTeams = await getTeams(seasonId);
        set({ teams: updatedTeams });
    },

    removeTeam: async (teamId) => {
        if (!confirm('정말로 이 팀을 삭제하시겠습니까?')) return;
        await deleteTeam(teamId);
        const seasonId = get().currentSeason?.id;
        const updatedTeams = await getTeams(seasonId);
        set({ teams: updatedTeams });
    },

    setTeamCaptain: async (teamId, captainId) => {
        try {
            await updateTeamCaptain(teamId, captainId);
            const seasonId = get().currentSeason?.id;
            if (seasonId) {
                const updatedTeams = await getTeams(seasonId);
                set({ teams: updatedTeams });
            }
            alert('주장이 임명되었습니다.');
        } catch (error) {
            alert('주장 임명 중 오류가 발생했습니다.');
        }
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
                const updatedTeams = await getTeams(seasonId);
                set({ teams: updatedTeams });
                alert('팀이 성공적으로 생성되었습니다.');
            } catch (error) { console.error("팀 일괄 생성 오류:", error); }
        }
    },

    assignPlayerToTeam: async (teamId, playerId) => {
        if (!playerId) return;
        const team = get().teams.find(t => t.id === teamId);
        if (team.members.includes(playerId)) return alert('이미 팀에 속한 선수입니다.');
        await updateTeamMembers(teamId, [...team.members, playerId]);
        const seasonId = get().currentSeason?.id;
        const updatedTeams = await getTeams(seasonId);
        set({ teams: updatedTeams });
    },

    unassignPlayerFromTeam: async (teamId, playerId) => {
        const team = get().teams.find(t => t.id === teamId);
        await updateTeamMembers(teamId, team.members.filter(id => id !== playerId));
        const seasonId = get().currentSeason?.id;
        const updatedTeams = await getTeams(seasonId);
        set({ teams: updatedTeams });
    },

    autoAssignTeams: async () => {
        if (!confirm('팀원을 자동 배정하시겠습니까? 기존 팀 배정은 모두 초기화됩니다.')) return;
        const { players, teams, currentSeason } = get();
        if (players.length === 0 || teams.length === 0) return alert('선수와 팀이 모두 필요합니다.');

        try {
            // ▼▼▼ [수정] 성비 균등 배정 로직 ▼▼▼
            const malePlayers = players.filter(p => p.gender === '남').sort(() => 0.5 - Math.random());
            const femalePlayers = players.filter(p => p.gender === '여').sort(() => 0.5 - Math.random());
            const unassignedPlayers = players.filter(p => !p.gender || (p.gender !== '남' && p.gender !== '여')).sort(() => 0.5 - Math.random());

            const teamUpdates = teams.map(team => ({ id: team.id, members: [], captainId: null }));

            // 남자, 여자, 미지정 순서로 순환하며 배정
            [...malePlayers, ...femalePlayers, ...unassignedPlayers].forEach((player, index) => {
                teamUpdates[index % teams.length].members.push(player.id);
            });

            // 각 팀의 첫 번째 멤버를 임시 주장으로 임명
            teamUpdates.forEach(update => {
                if (update.members.length > 0) {
                    update.captainId = update.members[0];
                }
            });
            // ▲▲▲ 여기까지 수정 ▲▲▲

            await batchUpdateTeams(teamUpdates);
            const updatedTeams = await getTeams(currentSeason.id);
            set({ teams: updatedTeams });
            alert('성비 균등 자동 배정이 완료되었습니다.');
        } catch (error) {
            console.error("자동 배정 중 오류 발생:", error);
            alert("자동 배정 중 오류가 발생했습니다.");
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
            const updatedMatches = await getMatches(currentSeason.id);
            set({ matches: updatedMatches });
            alert('경기 일정이 성공적으로 생성되었습니다.');
        } catch (error) { console.error("경기 일정 생성 오류:", error); }
    },

    saveScores: async (matchId, scores, scorers) => {
        try {
            const recorderId = auth.currentUser?.uid;
            if (!recorderId) {
                alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
                return;
            }
            await updateMatchScores(matchId, scores, scorers, recorderId);
            const updatedMatches = await getMatches(get().currentSeason.id);
            set({ matches: updatedMatches });
        } catch (error) { console.error("점수 저장 오류:", error); }
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
            const rewardAmount = 100;
            await grantAttendanceReward(myPlayerData.id, rewardAmount);
            set({ showAttendanceModal: false });
        } catch (error) {
            console.error("출석 보상 지급 중 오류:", error);
            alert(error.message);
        }
    },

    closeAttendanceModal: () => {
        set({ showAttendanceModal: false });
    },

    clearPointAdjustmentNotification: () => {
        set({ pointAdjustmentNotification: null });
    },
}));