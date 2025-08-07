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
    batchUpdateMissionOrder, // 새로운 함수를 import 합니다.
    createPlayerFromUser,
    markNotificationsAsRead,
    getTodaysQuizHistory,
    submitQuizAnswer as firebaseSubmitQuizAnswer,
    requestMissionApproval,
    uploadMissionSubmissionFile,
    batchAdjustPlayerPoints,
    isAttendanceRewardAvailable,
    grantAttendanceReward,
    db,
    updatePlayerStatus,
    createNewSeason,
    saveAvatarMemorials,
    getMyRoomItems, // 마이룸 아이템 함수 추가
    updateMyRoomItemDisplayName,
    buyMyRoomItem,
    buyMultipleAvatarParts, // [복원] 누락되었던 함수 import
    updatePlayerProfile, // [복원] 누락되었던 함수 import
    updateMatchStatus,
    batchUpdateAvatarPartCategory, // [추가]
    batchUpdateMyRoomItemCategory // [추가]
} from '../api/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, Timestamp } from "firebase/firestore";
import { auth } from '../api/firebase';
import allQuizzes from '../assets/missions.json';
import defaultEmblem from '../assets/default-emblem.png'; // [수정] defaultEmblem 경로 수정

export const useLeagueStore = create((set, get) => ({
    // --- State ---
    seasons: [],
    showAttendanceModal: false,
    players: [],
    teams: [],
    matches: [],
    users: [],
    avatarParts: [],
    myRoomItems: [], // 마이룸 아이템 상태 추가
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
        matches: null,
    },
    dailyQuiz: null,
    dailyQuizSet: { date: null, quizzes: [] },
    quizHistory: [],
    currentUser: null,
    pointAdjustmentNotification: null,


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

    // ▼▼▼ [신규] 마이룸 아이템 이름 로컬 업데이트 함수 ▼▼▼
    updateLocalMyRoomItemDisplayName: (itemId, newName) => {
        set(state => ({
            myRoomItems: state.myRoomItems.map(item =>
                item.id === itemId ? { ...item, displayName: newName } : item
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
                    get().subscribeToRecorderBonus(currentUser.uid);
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

            get().subscribeToMatches(activeSeason.id);
            const [
                playersData, teamsData, usersData,
                avatarPartsData, myRoomItemsData, // myRoomItemsData 추가
                activeMissionsData, archivedMissionsData, submissionsData
            ] = await Promise.all([
                get().players.length > 0 ? Promise.resolve(get().players) : getPlayers(),
                getTeams(activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMyRoomItems(), // getMyRoomItems 호출 추가
                getMissions('active'),
                getMissions('archived'),
                getMissionSubmissions()
            ]);

            const sortMissions = (missions) => {
                return missions.sort((a, b) => {
                    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : a.createdAt?.toMillis() || Infinity;
                    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : b.createdAt?.toMillis() || Infinity;
                    return orderA - orderB;
                });
            };

            set({
                players: playersData, teams: teamsData, users: usersData,
                avatarParts: avatarPartsData,
                myRoomItems: myRoomItemsData, // 상태 업데이트
                missions: sortMissions(activeMissionsData),
                archivedMissions: sortMissions(archivedMissionsData),
                missionSubmissions: submissionsData,
                currentSeason: activeSeason, isLoading: false,
            });
        } catch (error) {
            console.error("데이터 로딩 오류:", error);
            set({ isLoading: false });
        }
    },

    subscribeToMatches: (seasonId) => {
        const matchesRef = collection(db, 'matches');
        const q = query(matchesRef, where("seasonId", "==", seasonId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            set({ matches: matchesData });
        }, (error) => console.error("경기 데이터 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, matches: unsubscribe } }));
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

    reorderMissions: async (reorderedMissions, listKey) => {
        // 1. 로컬 상태를 즉시 업데이트하여 UI에 먼저 반영
        set(state => ({
            ...state,
            [listKey]: reorderedMissions
        }));

        // 2. 변경된 순서 전체를 Firestore에 저장
        try {
            await batchUpdateMissionOrder(reorderedMissions);
        } catch (error) {
            console.error("미션 순서 업데이트 실패:", error);
            alert("순서 저장에 실패했습니다. 새로고침 후 다시 시도해주세요.");
            // 오류 발생 시 데이터 동기화를 위해 전체 데이터를 다시 불러옴
            get().fetchInitialData();
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

    submitMissionForApproval: async (missionId, submissionData) => {
        const { players } = get();
        const user = auth.currentUser;
        if (!user) throw new Error('로그인이 필요합니다.');

        const myPlayerData = players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error('선수 정보를 찾을 수 없습니다.');

        const dataToSend = {};
        if (submissionData.text) {
            dataToSend.text = submissionData.text;
        }
        if (submissionData.photo) {
            const photoUrl = await uploadMissionSubmissionFile(missionId, myPlayerData.id, submissionData.photo);
            dataToSend.photoUrl = photoUrl;
        }

        try {
            await requestMissionApproval(missionId, myPlayerData.id, myPlayerData.name, dataToSend);
            const submissionsData = await getMissionSubmissions();
            set({ missionSubmissions: submissionsData });
        } catch (error) {
            throw error;
        }
    },

    buyMultipleAvatarParts: async (partsToBuy) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        // 1. Firebase 데이터 업데이트 (기존과 동일)
        await buyMultipleAvatarParts(myPlayerData.id, partsToBuy);

        // 2. fetchInitialData() 대신 로컬 상태 즉시 업데이트
        const totalCost = partsToBuy.reduce((sum, part) => sum + part.price, 0);
        const newPartIds = partsToBuy.map(part => part.id);

        set(state => ({
            players: state.players.map(p =>
                p.id === myPlayerData.id
                    ? {
                        ...p,
                        points: p.points - totalCost,
                        ownedParts: [...(p.ownedParts || []), ...newPartIds]
                    }
                    : p
            )
        }));
    },

    buyMyRoomItem: async (item) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        // 1. Firebase 데이터 업데이트 (기존과 동일)
        await buyMyRoomItem(myPlayerData.id, item);

        // 2. fetchInitialData() 대신 로컬 상태 즉시 업데이트
        const now = new Date();
        const isCurrentlyOnSale = item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate();
        const finalPrice = isCurrentlyOnSale ? item.salePrice : item.price;

        set(state => ({
            players: state.players.map(p =>
                p.id === myPlayerData.id
                    ? {
                        ...p,
                        points: p.points - finalPrice,
                        ownedMyRoomItems: [...(p.ownedMyRoomItems || []), item.id]
                    }
                    : p
            )
        }));
    },
    batchMoveAvatarPartCategory: async (partIds, newCategory) => {
        try {
            await batchUpdateAvatarPartCategory(partIds, newCategory);
            // 로컬 상태를 즉시 업데이트하여 빠른 UI 반응성 제공
            set(state => ({
                avatarParts: state.avatarParts.map(part =>
                    partIds.includes(part.id) ? { ...part, category: newCategory } : part
                )
            }));
        } catch (error) {
            alert(`아이템 이동 중 오류가 발생했습니다: ${error.message}`);
            // 에러 발생 시 데이터 동기화를 위해 전체 데이터를 다시 불러옴
            get().fetchInitialData();
        }
    },

    batchMoveMyRoomItemCategory: async (itemIds, newCategory) => {
        try {
            await batchUpdateMyRoomItemCategory(itemIds, newCategory);
            set(state => ({
                myRoomItems: state.myRoomItems.map(item =>
                    itemIds.includes(item.id) ? { ...item, category: newCategory } : item
                )
            }));
        } catch (error) {
            alert(`아이템 이동 중 오류가 발생했습니다: ${error.message}`);
            get().fetchInitialData();
        }
    },
    // ▲▲▲ 여기까지 추가 ▲▲▲

    updatePlayerProfile: async (profileData) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        await updatePlayerProfile(myPlayerData.id, profileData);
        await get().fetchInitialData();
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
            listeners: { notifications: null, playerData: null, missionSubmissions: null, approvalBonus: null, matches: null },
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
        const storedQuizSet = JSON.parse(localStorage.getItem('dailyQuizSet'));
        let todaysQuizzes = [];

        if (storedQuizSet && storedQuizSet.date === todayStr) {
            todaysQuizzes = storedQuizSet.quizzes;
        } else {
            const allQuizList = Object.values(allQuizzes).flat();
            const shuffled = allQuizList.sort(() => 0.5 - Math.random());
            todaysQuizzes = shuffled.slice(0, 5);
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

        await get().fetchDailyQuiz(myPlayerData.id);

        return isCorrect;
    },

    // ▼▼▼ [핵심 수정] batchAdjustPoints를 스토어 액션으로 추가 ▼▼▼
    batchAdjustPoints: async (playerIds, amount, reason) => {
        try {
            await batchAdjustPlayerPoints(playerIds, amount, reason);
            // 성공 후 로컬 상태 업데이트
            set(state => ({
                players: state.players.map(player => {
                    if (playerIds.includes(player.id)) {
                        return { ...player, points: (player.points || 0) + amount };
                    }
                    return player;
                })
            }));
        } catch (error) {
            console.error("포인트 일괄 조정 오류:", error);
            alert("포인트 조정 중 오류가 발생했습니다.");
        }
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
            const { teams, matches, players } = get();
            const completedMatches = matches.filter(m => m.status === '완료');

            let stats = teams.map(team => ({
                id: team.id, teamName: team.teamName,
                emblemId: team.emblemId,
                emblemUrl: team.emblemUrl,
                played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
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
                        await get().batchAdjustPoints(rankedTeam.members, config.prize, `${season.seasonName} ${config.label} 보상`);
                    }
                }
            }

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
                        await get().batchAdjustPoints(topScorers, topScorerPrize, `${season.seasonName} 득점왕 보상`);
                    }
                }
            }

            const playersInSeason = teams.flatMap(team => team.members)
                .map(playerId => players.find(p => p.id === playerId))
                .filter(Boolean);

            if (playersInSeason.length > 0) {
                await saveAvatarMemorials(season.id, playersInSeason);
            }

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
        const actionText = newStatus === 'inactive' ? '활성화' : '비활성화';
        if (!confirm(`이 선수를 ${actionText} 상태로 변경하시겠습니까?`)) return;

        try {
            await updatePlayerStatus(playerId, newStatus);
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
            const malePlayers = players.filter(p => p.gender === '남').sort(() => 0.5 - Math.random());
            const femalePlayers = players.filter(p => p.gender === '여').sort(() => 0.5 - Math.random());
            const unassignedPlayers = players.filter(p => !p.gender || (p.gender !== '남' && p.gender !== '여')).sort(() => 0.5 - Math.random());

            const teamUpdates = teams.map(team => ({ id: team.id, members: [], captainId: null }));

            [...malePlayers, ...femalePlayers, ...unassignedPlayers].forEach((player, index) => {
                teamUpdates[index % teams.length].members.push(player.id);
            });

            teamUpdates.forEach(update => {
                if (update.members.length > 0) {
                    update.captainId = update.members[0];
                }
            });

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
        if (!confirm('경기 일정을 새로 생성하시겠습니까? 기존 팀 배정은 모두 초기화됩니다.')) return;
        const { teams, leagueType, currentSeason } = get();
        if (!currentSeason) return alert('현재 시즌 정보가 없습니다.');
        if (teams.length < 2) return alert('최소 2팀이 필요합니다.');

        let matchesToCreate = [];

        const createRoundRobinSchedule = (teamList) => {
            const schedule = [];
            if (teamList.length < 2) return schedule;

            const localTeams = [...teamList];
            if (localTeams.length % 2 !== 0) {
                localTeams.push({ id: 'BYE', teamName: 'BYE' });
            }

            const numTeams = localTeams.length;
            const numRounds = numTeams - 1;
            const half = numTeams / 2;

            const teamIndexes = localTeams.map((_, i) => i);
            const rounds = [];

            for (let round = 0; round < numRounds; round++) {
                const roundMatches = [];
                for (let i = 0; i < half; i++) {
                    const team1Index = teamIndexes[i];
                    const team2Index = teamIndexes[numTeams - 1 - i];
                    if (localTeams[team1Index].id !== 'BYE' && localTeams[team2Index].id !== 'BYE') {
                        roundMatches.push({
                            teamA_id: localTeams[team1Index].id,
                            teamB_id: localTeams[team2Index].id,
                        });
                    }
                }
                rounds.push(roundMatches);

                const lastTeamIndex = teamIndexes.pop();
                teamIndexes.splice(1, 0, lastTeamIndex);
            }

            const homeAndAway = [];
            rounds.forEach(round => {
                round.forEach(match => {
                    homeAndAway.push({ ...match });
                    homeAndAway.push({ teamA_id: match.teamB_id, teamB_id: match.teamA_id });
                });
            });

            for (let i = homeAndAway.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [homeAndAway[i], homeAndAway[j]] = [homeAndAway[j], homeAndAway[i]];
            }

            return homeAndAway.map(match => ({
                ...match,
                seasonId: currentSeason.id,
                teamA_score: null,
                teamB_score: null,
                status: '예정'
            }));
        };

        if (leagueType === 'separated') {
            const maleTeams = teams.filter(t => t.gender === '남');
            const femaleTeams = teams.filter(t => t.gender === '여');
            const maleMatches = createRoundRobinSchedule(maleTeams);
            const femaleMatches = createRoundRobinSchedule(femaleMatches);

            let i = 0, j = 0;
            while (i < maleMatches.length || j < femaleMatches.length) {
                if (i < maleMatches.length) matchesToCreate.push(maleMatches[i++]);
                if (j < femaleMatches.length) matchesToCreate.push(femaleMatches[j++]);
            }
        } else {
            matchesToCreate = createRoundRobinSchedule(teams);
        }

        if (matchesToCreate.length === 0) return alert('생성할 경기가 없습니다. 팀 구성을 확인해주세요.');

        try {
            await deleteMatchesBySeason(currentSeason.id);
            await batchAddMatches(matchesToCreate);
            const updatedMatches = await getMatches(currentSeason.id);
            set({ matches: updatedMatches });
            alert('새로운 경기 일정이 성공적으로 생성되었습니다.');
        } catch (error) {
            console.error("경기 일정 생성 오류:", error);
            alert(`경기 일정 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    },

    saveScores: async (matchId, scores, scorers) => {
        try {
            const recorderId = auth.currentUser?.uid;
            if (!recorderId) {
                alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
                return;
            }
            await updateMatchScores(matchId, scores, scorers, recorderId);
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

    // --- Selectors ---
    standingsData: () => {
        const { teams, matches } = get();
        if (!teams || teams.length === 0) return [];

        const completedMatches = matches.filter(m => m.status === '완료');
        let stats = teams.map(team => ({
            id: team.id, teamName: team.teamName, emblemUrl: team.emblemUrl || defaultEmblem,
            played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
        }));

        completedMatches.forEach(match => {
            const teamA = stats.find(t => t.id === match.teamA_id);
            const teamB = stats.find(t => t.id === match.teamB_id);
            if (!teamA || !teamB) return;
            teamA.played++; teamB.played++;
            teamA.goalsFor += match.teamA_score; teamA.goalsAgainst += match.teamB_score;
            teamB.goalsFor += match.teamB_score; teamB.goalsAgainst += match.teamA_score;
            if (match.teamA_score > match.teamB_score) {
                teamA.wins++; teamA.points += 3; teamB.losses++;
            } else if (match.teamB_score > match.teamA_score) {
                teamB.wins++; teamB.points += 3; teamA.losses++;
            } else {
                teamA.draws++; teamB.draws++; teamA.points += 1; teamB.points += 1;
            }
        });

        stats.forEach(team => { team.goalDifference = team.goalsFor - team.goalsAgainst; });

        stats.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });

        let rank = 1;
        for (let i = 0; i < stats.length; i++) {
            if (i > 0 && (
                stats[i].points !== stats[i - 1].points ||
                stats[i].goalDifference !== stats[i - 1].goalDifference ||
                stats[i].goalsFor !== stats[i - 1].goalsFor
            )) {
                rank = i + 1;
            }
            stats[i].rank = rank;
        }

        return stats;
    }
}));