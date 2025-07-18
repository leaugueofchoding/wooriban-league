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
    getSeasons,      // 새로 추가
    updateSeason     // 새로 추가
} from '../api/firebase';

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    players: [],
    teams: [],
    matches: [],
    currentSeason: null, // 기존 currentSeasonId를 객체로 변경
    isLoading: true,
    leagueType: 'mixed',

    setLeagueType: (type) => set({ leagueType: type }),

    fetchInitialData: async () => {
        try {
            set({ isLoading: true });
            const seasons = await getSeasons();
            // 현재 진행중이거나 준비중인 시즌을 찾고, 없으면 첫번째 시즌을 선택
            const activeSeason = seasons.find(s => s.status === 'active' || s.status === 'preparing') || seasons[0] || null;

            if (!activeSeason) {
                console.log("활성화된 시즌이 없습니다.");
                set({ isLoading: false });
                return;
            }

            const seasonId = activeSeason.id;
            const [playersData, teamsData, matchesData] = await Promise.all([
                getPlayers(),
                getTeams(seasonId),
                getMatches(seasonId),
            ]);

            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
                currentSeason: activeSeason, // 시즌 정보 전체를 저장
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
        if (!confirm('시즌을 시작하시겠습니까? 시작 후에는 선수 및 팀 구성 변경, 경기 일정 생성이 불가능합니다.')) return;

        try {
            await updateSeason(season.id, { status: 'active' });
            get().fetchInitialData();
        } catch (error) {
            console.error("시즌 시작 오류:", error);
            alert('시즌 시작 중 오류가 발생했습니다.');
        }
    },

    endSeason: async () => {
        const season = get().currentSeason;
        if (!season || season.status !== 'active') return alert('진행 중인 시즌만 종료할 수 있습니다.');
        if (!confirm('시즌을 종료하시겠습니까?')) return;

        // ## 향후 구현될 로직 위치 ##
        // 1. 순위표 데이터 가져오기
        // 2. 1위 팀 찾아서 winnerTeamId로 지정
        // 3. 우승팀 선수들의 wins: +1 업데이트 (batchUpdate 사용)

        try {
            await updateSeason(season.id, { status: 'completed' /*, winnerTeamId: 'ID' */ });
            alert('시즌이 종료되었습니다.');
            get().fetchInitialData();
        } catch (error) {
            console.error("시즌 종료 오류:", error);
            alert('시즌 종료 중 오류가 발생했습니다.');
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