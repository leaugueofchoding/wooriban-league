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
    batchUpdateTeams
} from '../api/firebase';

export const useLeagueStore = create((set, get) => ({
    // --- 1. State (데이터 보관 장소) ---
    players: [],
    teams: [],
    matches: [],
    currentSeasonId: 1,
    isLoading: true,
    leagueType: 'mixed', // 'mixed' 또는 'separated'

    // 리그 방식을 변경하는 함수
    setLeagueType: (type) => set({ leagueType: type }),

    // # 초기 데이터 로딩
    fetchInitialData: async () => {
        try {
            set({ isLoading: true });
            const seasonId = get().currentSeasonId;

            const [playersData, teamsData, matchesData] = await Promise.all([
                getPlayers(),
                getTeams(seasonId),
                getMatches(seasonId),
            ]);

            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
                isLoading: false,
            });
        } catch (error) {
            console.error("데이터를 불러오는 중 오류 발생:", error);
            set({ isLoading: false });
        }
    },

    // # 선수 관리
    addNewPlayer: async (playerName) => {
        if (!playerName.trim()) return alert('선수 이름을 입력해주세요.');
        const newPlayerData = {
            name: playerName, status: '재학중', wins: 0, score: 0, studentId: Date.now(),
        };
        await addPlayer(newPlayerData);
        get().fetchInitialData();
    },
    removePlayer: async (playerId) => {
        if (!confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(playerId);
        set((state) => ({
            players: state.players.filter((p) => p.id !== playerId),
        }));
    },

    // # 팀 관리
    addNewTeam: async (teamName) => {
        if (!teamName.trim()) return alert('팀 이름을 입력해주세요.');
        const newTeamData = {
            teamName: teamName, seasonId: get().currentSeasonId, captainId: null, members: [],
        };
        await addTeam(newTeamData);
        get().fetchInitialData();
    },
    removeTeam: async (teamId) => {
        if (!confirm('정말로 이 팀을 삭제하시겠습니까?')) return;
        await deleteTeam(teamId);
        set((state) => ({
            teams: state.teams.filter((t) => t.id !== teamId),
        }));
    },

    // # 팀원 배정 관리
    assignPlayerToTeam: async (teamId, playerId) => {
        if (!playerId) return;
        const team = get().teams.find(t => t.id === teamId);
        if (team.members.includes(playerId)) return alert('이미 팀에 속한 선수입니다.');

        const newMembers = [...team.members, playerId];
        await updateTeamMembers(teamId, newMembers);
        get().fetchInitialData();
    },
    unassignPlayerFromTeam: async (teamId, playerId) => {
        const team = get().teams.find(t => t.id === teamId);
        const newMembers = team.members.filter(memberId => memberId !== playerId);
        await updateTeamMembers(teamId, newMembers);
        get().fetchInitialData();
    },
    // 팀원 자동 배정 함수 (에러 처리 추가)
    autoAssignTeams: async () => {
        if (!confirm('모든 팀의 현재 팀원 구성이 초기화되고, 모든 선수가 자동으로 재배정됩니다. 계속하시겠습니까?')) return;

        // 1. 상태를 가져오는 부분은 try 블록 밖에 두는 것이 더 안전합니다.
        const players = get().players;
        const teams = get().teams;

        if (players.length === 0 || teams.length === 0) {
            alert('선수와 팀이 모두 있어야 자동 배정을 할 수 있습니다.');
            return;
        }

        try {
            const shuffledPlayers = [...players];
            for (let i = shuffledPlayers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
            }

            const teamUpdates = teams.map(team => ({
                id: team.id,
                members: [],
                captainId: null,
            }));

            shuffledPlayers.forEach((player, index) => {
                const teamIndex = index % teams.length;
                teamUpdates[teamIndex].members.push(player.id);
            });

            teamUpdates.forEach(update => {
                if (update.members.length > 0) {
                    update.captainId = update.members[0];
                }
            });

            await batchUpdateTeams(teamUpdates);

            const updatedTeams = get().teams.map(team => {
                const updateInfo = teamUpdates.find(u => u.id === team.id);
                return updateInfo ? { ...team, ...updateInfo } : team;
            });
            set({ teams: updatedTeams });

            alert('자동 배정이 완료되었습니다.');

        } catch (error) {
            // 만약 위 과정에서 오류가 발생하면, 사용자에게 알려주고 콘솔에 기록합니다.
            console.error("자동 배정 중 오류 발생:", error);
            alert('자동 배정 중 오류가 발생했습니다. 개발자 콘솔(F12)을 확인해주세요.');
        }
    },
    // # 경기 결과 관리
    saveScores: async (matchId, scores) => {
        try {
            await updateMatchScores(matchId, scores);
            const updatedMatches = get().matches.map(match =>
                match.id === matchId
                    ? { ...match, teamA_score: scores.a, teamB_score: scores.b, status: '완료' }
                    : match
            );
            set({ matches: updatedMatches });
        } catch (error) {
            console.error("점수 저장 중 오류 발생:", error);
        }
    },
}));