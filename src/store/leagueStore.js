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
    adjustPlayerPoints,
    createPlayerFromUser,
    getNotificationsForUser,
    markNotificationsAsRead,
    getTodaysQuizHistory, // 퀴즈 기록 함수 import
    submitQuizAnswer as firebaseSubmitQuizAnswer, // 이름 충돌 방지를 위해 별칭 사용
    requestMissionApproval
} from '../api/firebase';
import { auth } from '../api/firebase'; // auth import 추가
import allQuizzes from '../assets/missions.json'; // 퀴즈 JSON 데이터 import

export const useLeagueStore = create((set, get) => ({
    // --- State ---
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
    dailyQuiz: null, // 오늘의 퀴즈 상태
    quizHistory: [], // 오늘 푼 퀴즈 기록
    currentUser: null, // 현재 로그인 사용자 정보


    // --- Actions ---
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

            // auth.currentUser를 직접 사용하여 최신 로그인 상태를 확인합니다.
            const currentUser = auth.currentUser;
            set({ currentUser }); // 스토어 상태에 현재 사용자 저장

            const seasons = await getSeasons();
            const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'preparing') || seasons[0] || null;

            if (!activeSeason) {
                console.log("활성화된 시즌이 없습니다.");
                return set({ isLoading: false, players: [], teams: [], matches: [], users: [], avatarParts: [], missions: [] });
            }

            const [
                playersData,
                teamsData,
                matchesData,
                usersData,
                avatarPartsData,
                activeMissionsData,
                archivedMissionsData,
                submissionsData
            ] = await Promise.all([
                getPlayers(),
                getTeams(activeSeason.id),
                getMatches(activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMissions('active'),
                getMissions('archived'),
                getMissionSubmissions()
            ]);

            if (currentUser) {
                get().fetchNotifications(currentUser.uid);
            }

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
            get().fetchInitialData();
        } catch (error) {
            console.error('미션 보관 오류:', error);
            alert('미션 보관 중 오류가 발생했습니다.');
        }
    },

    unarchiveMission: async (missionId) => {
        try {
            await updateMissionStatus(missionId, 'active');
            alert('미션이 다시 활성화되었습니다.');
            get().fetchInitialData();
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
            get().fetchInitialData();
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
        const { players, currentUser } = get();
        const myPlayerData = players.find(p => p.authUid === currentUser?.uid);
        if (!myPlayerData) {
            alert('선수 정보를 찾을 수 없습니다.');
            return;
        }

        try {
            await requestMissionApproval(missionId, myPlayerData.id, myPlayerData.name);
            alert('미션 완료를 요청했습니다. 기록원이 확인할 때까지 잠시 기다려주세요!');

            const submissionsData = await getMissionSubmissions();
            set({ missionSubmissions: submissionsData });

        } catch (error) {
            console.error("미션 제출 오류:", error);
            alert(error.message);
        }
    },

    adjustPoints: async (playerId, amount, reason) => {
        if (!playerId || amount === 0 || !reason.trim()) {
            alert('플레이어, 0이 아닌 포인트, 그리고 사유를 모두 입력해야 합니다.');
            return;
        }

        const playerName = get().players.find(p => p.id === playerId)?.name;
        if (!playerName) {
            alert('선택된 플레이어를 찾을 수 없습니다.');
            return;
        }

        const actionText = amount > 0 ? '지급' : '차감';
        const confirmationMessage = `${playerName} 선수에게 ${Math.abs(amount)} 포인트를 ${actionText}하시겠습니까?\n\n사유: ${reason}`;

        if (!window.confirm(confirmationMessage)) {
            return;
        }

        try {
            set({ isLoading: true });
            await adjustPlayerPoints(playerId, amount, reason);
            alert('포인트가 성공적으로 조정되었습니다.');
            await get().fetchInitialData();
        } catch (error) {
            console.error("포인트 조정 액션 오류:", error);
            alert(`포인트 조정 중 오류가 발생했습니다: ${error.message}`);
            set({ isLoading: false });
        }
    },

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

    fetchNotifications: async (userId) => {
        if (!userId) return;
        const notifications = await getNotificationsForUser(userId);
        const unreadCount = notifications.filter(n => !n.isRead).length;
        set({ notifications, unreadNotificationCount: unreadCount });
    },

    markAsRead: async () => {
        const userId = auth.currentUser?.uid;
        if (!userId || get().unreadNotificationCount === 0) return;

        await markNotificationsAsRead(userId);
        set(state => ({
            notifications: state.notifications.map(n => ({ ...n, isRead: true })),
            unreadNotificationCount: 0
        }));
    },

    // --- 퀴즈 관련 액션 ---
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

        if (isCorrect) {
            const playersData = await getPlayers();
            set({ players: playersData });
        }

        return isCorrect;
    },
}));