import { create } from 'zustand';
import {
    getPlayers,
    getTeams,
    getMatches,
    updateMatchScores,
    addPlayer,
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
    getAvatarParts // getAvatarParts import 추가
} from '../api/firebase';

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    players: [],
    teams: [],
    matches: [],
    users: [],
    avatarParts: [], // 아바타 파츠를 저장할 상태 추가
    currentSeason: null,
    isLoading: true,
    leagueType: 'mixed',

    setLeagueType: (type) => set({ leagueType: type }),

    fetchInitialData: async () => {
        try {
            set({ isLoading: true });
            const seasons = await getSeasons();
            const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'preparing') || seasons[0] || null;

            if (!activeSeason) {
                console.log("활성화된 시즌이 없습니다.");
                return set({ isLoading: false, players: [], teams: [], matches: [], users: [], avatarParts: [] });
            }

            const [playersData, teamsData, matchesData, usersData, avatarPartsData] = await Promise.all([
                getPlayers(),
                getTeams(activeSeason.id),
                getMatches(activeSeason.id),
                getUsers(),
                getAvatarParts() // avatarParts 데이터도 함께 불러옵니다.
            ]);

            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
                users: usersData,
                avatarParts: avatarPartsData, // 상태에 저장
                currentSeason: activeSeason,
                isLoading: false,
            });
        } catch (error) {
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
        }
    },

    // ======== 시즌 관리 액션 ========
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

    // ======== 역할 관리 액션 ========
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

    // ======== 선수 등록/관리 ========
    registerAsPlayer: async (user) => {
        if (!user) return alert('로그인 정보가 없습니다.');
        const newPlayerData = {
            authUid: user.uid,
            id: user.uid, // 문서 ID를 authUid와 동일하게 설정
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            gender: null,
            role: 'player',
            points: 100,
            wins: 0,
            seasonStats: {}
        };
        try {
            await addPlayer(newPlayerData);
            alert(`${user.displayName}님, 선수 등록이 완료되었습니다!`);
            get().fetchInitialData();
        } catch (error) {
            console.error("선수 등록 오류:", error);
        }
    },

    removePlayer: async (playerId) => {
        if (!confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(playerId);
        get().fetchInitialData();
    },

    // ======== 팀 관리 ========
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

    // ======== 팀원 배정 ========
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

    // ======== 경기 관리 ========
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
}));