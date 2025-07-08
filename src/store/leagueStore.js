import { create } from 'zustand';
import { getPlayers, getTeams, getMatches } from '../api/firebase';

export const useLeagueStore = create((set) => ({
    // 1. 데이터 보관 장소 (State)
    players: [],
    teams: [],
    matches: [],
    currentSeasonId: 1, // 우선 첫 번째 시즌으로 고정
    isLoading: true, // 데이터 로딩 상태

    // 2. 데이터를 변경하는 함수 (Actions)

    // 앱 시작 시 Firebase에서 모든 초기 데이터를 가져오는 함수
    fetchInitialData: async () => {
        try {
            set({ isLoading: true }); // 로딩 시작

            const seasonId = useLeagueStore.getState().currentSeasonId;

            const playersData = await getPlayers();
            const teamsData = await getTeams(seasonId);
            const matchesData = await getMatches(seasonId);

            set({
                players: playersData,
                teams: teamsData,
                matches: matchesData,
            });

        } catch (error) {
            console.error("데이터를 불러오는 중 오류 발생:", error);
        } finally {
            set({ isLoading: false }); // 로딩 끝
        }
    },
}));