// src/store/leagueStore.js 파일의 모든 내용을 지우고 아래 코드를 붙여넣으세요.

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
    batchAddMatches
} from '../api/firebase';

export const useLeagueStore = create((set, get) => ({
    players: [],
    teams: [],
    matches: [],
    currentSeasonId: 1,
    isLoading: true,
    leagueType: 'mixed',

    setLeagueType: (type) => set({ leagueType: type }),

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
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
        }
    },

    addNewPlayer: async (playerName, playerGender) => {
        if (!playerName.trim()) return alert('선수 이름을 입력해주세요.');
        await addPlayer({
            name: playerName,
            gender: playerGender,
            status: '재학중',
            wins: 0,
            score: 0,
            studentId: Date.now(),
        });
        get().fetchInitialData();
    },

    removePlayer: async (playerId) => {
        if (!confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(playerId);
        get().fetchInitialData();
    },

    addNewTeam: async (teamName) => {
        if (!teamName.trim()) return alert('팀 이름을 입력해주세요.');
        await addTeam({
            teamName: teamName,
            seasonId: get().currentSeasonId,
            captainId: null,
            members: [],
        });
        get().fetchInitialData();
    },

    removeTeam: async (teamId) => {
        if (!confirm('정말로 이 팀을 삭제하시겠습니까?')) return;
        await deleteTeam(teamId);
        get().fetchInitialData();
    },

    batchCreateTeams: async (maleCount, femaleCount) => {
        const seasonId = get().currentSeasonId;
        const newTeams = [];
        for (let i = 1; i <= maleCount; i++) {
            newTeams.push({ teamName: `남자 ${i}팀`, gender: '남', seasonId, captainId: null, members: [] });
        }
        for (let i = 1; i <= femaleCount; i++) {
            newTeams.push({ teamName: `여자 ${i}팀`, gender: '여', seasonId, captainId: null, members: [] });
        }
        if (newTeams.length > 0 && confirm(`${newTeams.length}개의 팀을 생성하시겠습니까?`)) {
            try {
                await batchAddTeams(newTeams);
                alert('팀이 성공적으로 생성되었습니다.');
                get().fetchInitialData();
            } catch (error) {
                console.error("팀 일괄 생성 오류:", error);
                alert('팀 생성 중 오류가 발생했습니다.');
            }
        }
    },

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

    autoAssignTeams: async () => {
        if (!confirm('팀원 자동 배정을 실행하시겠습니까?')) return;
        const { players, teams, leagueType } = get();
        if (players.length === 0 || teams.length === 0) return alert('선수와 팀이 모두 필요합니다.');

        let teamUpdates = [];
        if (leagueType === 'separated') {
            const malePlayers = players.filter(p => p.gender === '남').sort(() => 0.5 - Math.random());
            const femalePlayers = players.filter(p => p.gender === '여').sort(() => 0.5 - Math.random());
            const maleTeams = teams.filter(t => t.gender === '남');
            const femaleTeams = teams.filter(t => t.gender === '여');

            const assign = (playerList, teamList) => {
                const updates = teamList.map(t => ({ id: t.id, members: [], captainId: null }));
                playerList.forEach((player, index) => {
                    updates[index % teamList.length].members.push(player.id);
                });
                return updates;
            };

            teamUpdates = [...assign(malePlayers, maleTeams), ...assign(femalePlayers, femaleTeams)];
        } else {
            const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
            teamUpdates = teams.map(t => ({ id: t.id, members: [], captainId: null }));
            shuffledPlayers.forEach((player, index) => {
                teamUpdates[index % teams.length].members.push(player.id);
            });
        }

        teamUpdates.forEach(update => {
            if (update.members.length > 0) update.captainId = update.members[0];
        });

        try {
            await batchUpdateTeams(teamUpdates);
            alert('자동 배정이 완료되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("자동 배정 오류:", error);
            alert('자동 배정 중 오류가 발생했습니다.');
        }
    },

    generateSchedule: async () => {
        if (!confirm('경기 일정을 새로 생성하시겠습니까? 기존 일정은 삭제됩니다.')) return;
        const { teams, leagueType, currentSeasonId } = get();
        if (teams.length < 2) return alert('최소 2팀이 필요합니다.');

        let matchesToCreate = [];
        const createRoundRobin = (teamList) => {
            const schedule = [];
            for (let i = 0; i < teamList.length; i++) {
                for (let j = i + 1; j < teamList.length; j++) {
                    schedule.push({ seasonId: currentSeasonId, teamA_id: teamList[i].id, teamB_id: teamList[j].id, teamA_score: null, teamB_score: null, status: '예정' });
                }
            }
            return schedule;
        };

        if (leagueType === 'separated') {
            const maleTeams = teams.filter(t => t.gender === '남');
            const femaleTeams = teams.filter(t => t.gender === '여');
            matchesToCreate = [...createRoundRobin(maleTeams), ...createRoundRobin(femaleTeams)];
        } else {
            matchesToCreate = createRoundRobin(teams);
        }

        if (matchesToCreate.length === 0) return alert('생성할 경기가 없습니다.');

        try {
            await deleteMatchesBySeason(currentSeasonId);
            await batchAddMatches(matchesToCreate);
            alert('경기 일정이 성공적으로 생성되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("경기 일정 생성 오류:", error);
            alert('경기 일정 생성 중 오류가 발생했습니다.');
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