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
    getAvatarParts,
    getMissions, // getMissions import
    getMissionSubmissions,
    updateMissionStatus, // 추가
    deleteMission,
    adjustPlayerPoints
} from '../api/firebase';

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    players: [],
    teams: [],
    matches: [],
    users: [],
    avatarParts: [],
    missions: [], // missions 상태 추가
    archivedMissions: [], // 보관된 미션 목록
    missionSubmissions: [], // missionSubmissions 상태 추가
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
                return set({ isLoading: false, players: [], teams: [], matches: [], users: [], avatarParts: [], missions: [] });
            }

            // ▼▼▼▼▼ 이 부분의 변수 목록을 수정했습니다 ▼▼▼▼▼
            const [
                playersData,
                teamsData,
                matchesData,
                usersData,
                avatarPartsData,
                activeMissionsData, // 활성 미션
                archivedMissionsData, // 보관된 미션
                submissionsData
            ] = await Promise.all([
                getPlayers(),
                getTeams(activeSeason.id),
                getMatches(activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMissions('active'), // 'active' 상태 미션 가져오기
                getMissions('archived'), // 'archived' 상태 미션 가져오기
                getMissionSubmissions()
            ]);


            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
                users: usersData,
                avatarParts: avatarPartsData,
                missions: activeMissionsData,
                archivedMissions: archivedMissionsData, // 상태에 저장
                missionSubmissions: submissionsData,
                currentSeason: activeSeason,
                isLoading: false,

                archiveMission: async (missionId) => {
                    if (!confirm('미션을 숨기면 활성 목록에서 사라집니다. 정말 숨기시겠습니까?')) return;
                    try {
                        await updateMissionStatus(missionId, 'archived');
                        alert('미션이 보관되었습니다.');
                        get().fetchInitialData(); // 데이터를 새로고침하여 목록을 갱신합니다.
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
            });
        } catch (error) {
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
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
            await get().fetchInitialData(); // 전체 데이터를 새로고침하여 변경사항을 즉시 반영합니다.
        } catch (error) {
            console.error("포인트 조정 액션 오류:", error);
            alert(`포인트 조정 중 오류가 발생했습니다: ${error.message}`);
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