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
    batchUpdateMissionOrder,
    updateMission,
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
    getMyRoomItems,
    updateMyRoomItemDisplayName,
    buyMyRoomItem,
    updatePlayerProfile,
    updateMatchStatus,
    batchUpdateAvatarPartCategory,
    batchUpdateMyRoomItemCategory,
    buyMultipleAvatarParts as firebaseBuyMultipleAvatarParts,
    deleteNotification,
    deleteAllNotifications,
    getTitles,
    seedInitialTitles,
    grantTitleToPlayer,
} from '../api/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, Timestamp } from "firebase/firestore";
import { auth } from '../api/firebase';
import allQuizzes from '../assets/missions.json';

// ▼▼▼ [신규] classId를 관리하는 스토어 생성 ▼▼▼
export const useClassStore = create((set) => ({
    classId: null,
    setClassId: (classId) => set({ classId }),
}));


export const useLeagueStore = create((set, get) => ({
    // --- [수정] State ---
    classId: null, // 학급 ID 추가
    seasons: [],
    showAttendanceModal: false,
    players: [],
    teams: [],
    matches: [],
    users: [],
    avatarParts: [],
    myRoomItems: [],
    titles: [],
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

    // --- [수정] Actions ---
    setLoading: (status) => set({ isLoading: status }),
    setLeagueType: (type) => set({ leagueType: type }),

    // [신규] classId를 설정하고 데이터를 다시 불러오는 액션
    initializeClass: (newClassId) => {
        set({ classId: newClassId, isLoading: true });
        get().fetchInitialData();
    },

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

    updateLocalMyRoomItemDisplayName: (itemId, newName) => {
        set(state => ({
            myRoomItems: state.myRoomItems.map(item =>
                item.id === itemId ? { ...item, displayName: newName } : item
            )
        }));
    },

    fetchInitialData: async () => {
        const { classId } = get();
        if (!classId) {
            // console.log("학급 ID가 설정되지 않아 데이터 로딩을 중단합니다.");
            return set({ isLoading: false });
        }
        try {
            set({ isLoading: true });

            await seedInitialTitles(classId);

            const currentUser = auth.currentUser;
            set({ currentUser });

            const seasonsData = await getSeasons(classId);
            set({ seasons: seasonsData });
            const activeSeason = seasonsData.find(s => s.status === 'active' || s.status === 'preparing') || seasonsData[0] || null;

            if (currentUser) {
                get().cleanupListeners();
                const playersData = await getPlayers(classId);
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
                const [usersData, avatarPartsData, myRoomItemsData] = await Promise.all([getUsers(), getAvatarParts(), getMyRoomItems()]);
                return set({
                    isLoading: false,
                    teams: [], matches: [], missions: [],
                    users: usersData, avatarParts: avatarPartsData, myRoomItems: myRoomItemsData, currentSeason: null
                });
            }

            get().subscribeToMatches(activeSeason.id);
            const [
                playersData, teamsData, usersData,
                avatarPartsData, myRoomItemsData,
                titlesData,
                allMissionsData, submissionsData
            ] = await Promise.all([
                get().players.length > 0 ? Promise.resolve(get().players) : getPlayers(classId),
                getTeams(classId, activeSeason.id),
                getUsers(),
                getAvatarParts(),
                getMyRoomItems(),
                getTitles(classId),
                getMissions(classId),
                getMissionSubmissions(classId)
            ]);

            const activeMissionsData = allMissionsData.filter(m => m.status === 'active');
            const archivedMissionsData = allMissionsData.filter(m => m.status === 'archived');

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
                myRoomItems: myRoomItemsData,
                titles: titlesData,
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
        const { classId } = get();
        if (!classId) return;
        const matchesRef = collection(db, 'classes', classId, 'matches');
        const q = query(matchesRef, where("seasonId", "==", seasonId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const matchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            set({ matches: matchesData });
        }, (error) => console.error("경기 데이터 실시간 수신 오류:", error));
        set(state => ({ listeners: { ...state.listeners, matches: unsubscribe } }));
    },

    archiveMission: async (missionId) => {
        const { classId } = get();
        if (!confirm('미션을 숨기면 활성 목록에서 사라집니다. 정말 숨기시겠습니까?')) return;
        try {
            await updateMissionStatus(classId, missionId, 'archived');
            set(state => {
                const missionToArchive = state.missions.find(m => m.id === missionId);
                if (!missionToArchive) return state;
                return {
                    missions: state.missions.filter(m => m.id !== missionId),
                    archivedMissions: [...state.archivedMissions, { ...missionToArchive, status: 'archived' }]
                };
            });
            alert('미션이 보관되었습니다.');
        } catch (error) {
            alert('미션 보관 중 오류가 발생했습니다.');
        }
    },

    reorderMissions: async (reorderedMissions, listKey) => {
        const { classId } = get();
        set(state => ({
            ...state,
            [listKey]: reorderedMissions
        }));

        try {
            await batchUpdateMissionOrder(classId, reorderedMissions);
        } catch (error) {
            console.error("미션 순서 업데이트 실패:", error);
            alert("순서 저장에 실패했습니다. 새로고침 후 다시 시도해주세요.");
            get().fetchInitialData();
        }
    },

    unarchiveMission: async (missionId) => {
        const { classId } = get();
        try {
            await updateMissionStatus(classId, missionId, 'active');
            set(state => {
                const missionToUnarchive = state.archivedMissions.find(m => m.id === missionId);
                if (!missionToUnarchive) return state;
                return {
                    archivedMissions: state.archivedMissions.filter(m => m.id !== missionId),
                    missions: [...state.missions, { ...missionToUnarchive, status: 'active' }]
                };
            });
            alert('미션이 다시 활성화되었습니다.');
        } catch (error) {
            alert('미션 활성화 중 오류가 발생했습니다.');
        }
    },

    removeMission: async (missionId) => {
        const { classId } = get();
        if (!confirm('정말로 미션을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        try {
            await deleteMission(classId, missionId);
            const activeMissions = await getMissions(classId, 'active');
            const archivedMissions = await getMissions(classId, 'archived');
            set({ missions: activeMissions, archivedMissions: archivedMissions });
            alert('미션이 삭제되었습니다.');
        } catch (error) {
            alert('미션 삭제 중 오류가 발생했습니다.');
        }
    },

    editMission: async (missionId, missionData) => {
        const { classId } = get();
        await updateMission(classId, missionId, missionData);
        set(state => {
            const updateInList = (list) => list.map(m => m.id === missionId ? { ...m, ...missionData } : m);
            return {
                missions: updateInList(state.missions),
                archivedMissions: updateInList(state.archivedMissions)
            };
        });
    },

    registerAsPlayer: async () => {
        const { classId } = get();
        const user = auth.currentUser;
        if (!user) return alert('로그인이 필요합니다.');
        if (window.confirm('리그에 선수로 참가하시겠습니까? 참가 시 기본 정보가 등록됩니다.')) {
            try {
                await createPlayerFromUser(classId, user);
                alert('리그 참가 신청이 완료되었습니다!');
                await get().fetchInitialData();
            } catch (error) {
                console.error("리그 참가 오류:", error);
                alert('참가 신청 중 오류가 발생했습니다.');
            }
        }
    },

    submitMissionForApproval: async (missionId, submissionData) => {
        const { players, classId } = get();
        const user = auth.currentUser;
        if (!user) throw new Error('로그인이 필요합니다.');

        const myPlayerData = players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error('선수 정보를 찾을 수 없습니다.');

        const dataToSend = { isPublic: submissionData.isPublic };
        if (submissionData.text) {
            dataToSend.text = submissionData.text;
        }
        if (submissionData.photos && submissionData.photos.length > 0) {
            const photoUrls = await uploadMissionSubmissionFile(classId, missionId, myPlayerData.id, submissionData.photos);
            dataToSend.photoUrls = photoUrls;
        }

        try {
            await requestMissionApproval(classId, missionId, myPlayerData.id, myPlayerData.name, dataToSend);
        } catch (error) {
            throw error;
        }
    },

    buyMultipleAvatarParts: async (partsToBuy) => {
        const { classId } = get();
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        await firebaseBuyMultipleAvatarParts(classId, myPlayerData.id, partsToBuy);

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
        const { classId } = get();
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        await buyMyRoomItem(classId, myPlayerData.id, item);

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
            set(state => ({
                avatarParts: state.avatarParts.map(part =>
                    partIds.includes(part.id) ? { ...part, category: newCategory } : part
                )
            }));
        } catch (error) {
            alert(`아이템 이동 중 오류가 발생했습니다: ${error.message}`);
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
        }
    },

    updatePlayerProfile: async (profileData) => {
        const { classId } = get();
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) throw new Error("Player data not found.");

        await updatePlayerProfile(classId, myPlayerData.id, profileData);
        await get().fetchInitialData();
    },

    removeAllNotifications: async (userId) => {
        if (!userId) return;
        try {
            await deleteAllNotifications(userId);
            set({
                notifications: [],
                unreadNotificationCount: 0,
            });
        } catch (error) {
            console.error("알림 전체 삭제 중 오류 발생:", error);
            alert("알림을 삭제하는 데 실패했습니다.");
        }
    },

    subscribeToPlayerData: (userId) => {
        const { classId } = get();
        if (!classId) return;
        const playerDocRef = doc(db, 'classes', classId, 'players', userId);
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
        const { classId } = get();
        if (!classId) return;
        const player = get().players.find(p => p.authUid === userId);
        if (!player) return;

        const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
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
            const notifications = [];
            let unreadCount = 0;

            querySnapshot.forEach(doc => {
                const notification = { id: doc.id, ...doc.data() };
                notifications.push(notification);
                if (!notification.isRead) {
                    unreadCount++;
                }
            });

            // 가장 최근의 읽지 않은 포인트 조정 알림을 찾습니다.
            const latestPointNotification = notifications.find(n => n.type === 'point' && !n.isRead && n.data);

            // 상태를 업데이트합니다.
            set(state => {
                // 새로운 포인트 조정 알림이 있고, 현재 표시된 알림과 다를 경우에만 상태를 업데이트합니다.
                if (latestPointNotification && latestPointNotification.id !== state.pointAdjustmentNotification?.id) {
                    return { notifications, unreadNotificationCount: unreadCount, pointAdjustmentNotification: latestPointNotification };
                }
                // 그 외의 경우에는 일반 알림 목록과 카운트만 업데이트합니다.
                return { notifications, unreadNotificationCount: unreadCount };
            });

        }, (error) => console.error("알림 실시간 수신 오류:", error));

        set(state => ({ listeners: { ...state.listeners, notifications: unsubscribe } }));
    },

    subscribeToRecorderBonus: (userId) => {
        const { classId } = get();
        if (!classId) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const historyRef = collection(db, 'classes', classId, 'point_history');
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
        const { classId } = get();
        if (!classId) return;

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

        const todaysHistory = await getTodaysQuizHistory(classId, studentId);
        set({ quizHistory: todaysHistory });

        if (todaysHistory.length >= 5) {
            set({ dailyQuiz: null });
            return;
        }

        const nextQuiz = todaysQuizzes.find(quiz => !todaysHistory.some(h => h.quizId === quiz.id));
        set({ dailyQuiz: nextQuiz || null });
    },

    submitQuizAnswer: async (quizId, userAnswer) => {
        const { players, dailyQuiz, classId } = get();
        const myPlayerData = players.find(p => p.authUid === auth.currentUser?.uid);
        if (!myPlayerData || !dailyQuiz || !classId) return false;

        const isCorrect = await firebaseSubmitQuizAnswer(classId, myPlayerData.id, quizId, userAnswer, dailyQuiz.answer);

        await get().fetchDailyQuiz(myPlayerData.id);

        return isCorrect;
    },

    batchAdjustPoints: async (playerIds, amount, reason) => {
        const { classId } = get();
        if (!classId) return;
        try {
            await batchAdjustPlayerPoints(classId, playerIds, amount, reason);
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

    createSeason: async (seasonName) => {
        const { classId } = get();
        if (!classId) return;
        await createNewSeason(classId, seasonName);
        const seasonsData = await getSeasons(classId);
        const activeSeason = seasonsData.find(s => s.status === 'active' || s.status === 'preparing') || seasonsData[0] || null;
        set({ seasons: seasonsData, currentSeason: activeSeason });
    },

    startSeason: async () => {
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason || currentSeason.status !== 'preparing') return alert('준비 중인 시즌만 시작할 수 있습니다.');
        if (!confirm('시즌을 시작하면 선수/팀 구성 및 경기 일정 생성이 불가능해집니다. 시작하시겠습니까?')) return;
        try {
            await updateSeason(classId, currentSeason.id, { status: 'active' });
            set(state => ({ currentSeason: { ...state.currentSeason, status: 'active' } }));
        } catch (error) { console.error("시즌 시작 오류:", error); }
    },

    endSeason: async () => {
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason || currentSeason.status !== 'active') return alert('진행 중인 시즌만 종료할 수 있습니다.');
        if (!confirm('시즌을 종료하시겠습니까? 시즌의 모든 활동을 마감하고 순위별 보상을 지급합니다.')) return;

        try {
            const players = await getPlayers(classId);
            const teams = await getTeams(classId, currentSeason.id);
            const matches = await getMatches(classId, currentSeason.id);
            const completedMatches = matches.filter(m => m.status === '완료');

            let stats = teams.map(team => ({
                id: team.id, teamName: team.teamName, emblemId: team.emblemId, emblemUrl: team.emblemUrl,
                played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, goalDifference: 0
            }));

            completedMatches.forEach(match => {
                const teamA = stats.find(t => t.id === match.teamA_id);
                const teamB = stats.find(t => t.id === match.teamB_id);
                if (!teamA || !teamB) return;
                teamA.goalsFor += match.teamA_score; teamB.goalsFor += match.teamB_score;
                teamA.goalDifference += match.teamA_score - match.teamB_score;
                teamB.goalDifference += match.teamB_score - match.teamA_score;
                if (match.teamA_score > match.teamB_score) { teamA.points += 3; teamA.wins++; teamB.losses++; }
                else if (match.teamB_score > match.teamA_score) { teamB.points += 3; teamB.wins++; teamA.losses++; }
                else { teamA.points++; teamB.points++; teamA.draws++; teamB.draws++; }
            });

            stats.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                return b.goalsFor - a.goalsFor;
            });

            if (stats.length > 0) {
                const winningTeam = teams.find(t => t.id === stats[0].id);
                if (winningTeam?.members.length > 0) {
                    for (const memberId of winningTeam.members) {
                        await grantTitleToPlayer(classId, memberId, 'ruler_of_the_league');
                    }
                }
            }

            const prizeConfig = [
                { rank: 1, prize: currentSeason.winningPrize || 0, label: "우승" },
                { rank: 2, prize: currentSeason.secondPlacePrize || 0, label: "준우승" },
                { rank: 3, prize: currentSeason.thirdPlacePrize || 0, label: "3위" }
            ];

            for (const config of prizeConfig) {
                if (stats.length >= config.rank && config.prize > 0) {
                    const rankedTeam = teams.find(t => t.id === stats[config.rank - 1].id);
                    if (rankedTeam?.members.length > 0) {
                        await get().batchAdjustPoints(rankedTeam.members, config.prize, `${currentSeason.seasonName} ${config.label} 보상`);
                    }
                }
            }

            const topScorerPrize = currentSeason.topScorerPrize || 0;
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
                    if (topScorerPrize > 0) {
                        await get().batchAdjustPoints(topScorers, topScorerPrize, `${currentSeason.seasonName} 득점왕 보상`);
                    }
                    for (const scorerId of topScorers) {
                        await grantTitleToPlayer(classId, scorerId, 'goal_machine');
                    }
                }
            }

            const playersInSeason = teams.flatMap(team => team.members)
                .map(playerId => players.find(p => p.id === playerId)).filter(Boolean);

            if (playersInSeason.length > 0) {
                try {
                    await saveAvatarMemorials(classId, currentSeason.id, playersInSeason);
                } catch (error) {
                    console.error("아바타 박제 중 오류 발생:", error);
                    alert("시즌 종료 시 아바타 박제에 실패했습니다.");
                }
            }

            await updateSeason(classId, currentSeason.id, { status: 'completed' });
            set(state => ({ currentSeason: { ...state.currentSeason, status: 'completed' } }));
            alert('시즌이 종료되고 순위별 보상 및 칭호가 지급되었습니다.');

        } catch (error) {
            console.error("시즌 종료 및 보상 지급 오류:", error);
            alert("시즌 종료 중 오류가 발생했습니다.");
        }
    },

    updateSeasonDetails: async (seasonId, dataToUpdate) => {
        const { classId } = get();
        if (!classId) return;
        try {
            await updateSeason(classId, seasonId, dataToUpdate);
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
        const { classId } = get();
        if (!classId || !playerId || !authUid || !role) return alert('선수, 사용자, 역할을 모두 선택해야 합니다.');
        try {
            await linkPlayerToAuth(classId, playerId, authUid, role);
            const players = await getPlayers(classId);
            set({ players });
            alert('성공적으로 연결되었습니다.');
        } catch (error) { console.error("계정 연결 오류:", error); }
    },

    removePlayer: async (playerId) => {
        const { classId } = get();
        if (!classId || !confirm('정말로 이 선수를 삭제하시겠습니까?')) return;
        await deletePlayer(classId, playerId);
        const players = await getPlayers(classId);
        set({ players });
    },

    togglePlayerStatus: async (playerId, currentStatus) => {
        const { classId } = get();
        if (!classId) return;
        const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
        const actionText = newStatus === 'inactive' ? '비활성화' : '활성화';
        if (!confirm(`이 선수를 ${actionText} 상태로 변경하시겠습니까?`)) return;

        try {
            await updatePlayerStatus(classId, playerId, newStatus);
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
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason) return alert('현재 시즌 정보를 불러올 수 없습니다.');
        if (!teamName.trim()) return alert('팀 이름을 입력해주세요.');

        await addTeam(classId, { teamName, seasonId: currentSeason.id, captainId: null, members: [] });
        const updatedTeams = await getTeams(classId, currentSeason.id);
        set({ teams: updatedTeams });
    },

    removeTeam: async (teamId) => {
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason || !confirm('정말로 이 팀을 삭제하시겠습니까?')) return;
        await deleteTeam(classId, teamId);
        const updatedTeams = await getTeams(classId, currentSeason.id);
        set({ teams: updatedTeams });
    },

    setTeamCaptain: async (teamId, captainId) => {
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason) return;
        try {
            await updateTeamCaptain(classId, teamId, captainId);
            const updatedTeams = await getTeams(classId, currentSeason.id);
            set({ teams: updatedTeams });
            alert('주장이 임명되었습니다.');
        } catch (error) {
            alert('주장 임명 중 오류가 발생했습니다.');
        }
    },

    batchCreateTeams: async (maleCount, femaleCount) => {
        const { classId, currentSeason } = get();
        if (!classId || !currentSeason) return alert('현재 시즌 정보를 불러올 수 없습니다.');

        const newTeams = [];
        for (let i = 1; i <= maleCount; i++) newTeams.push({ teamName: `남자 ${i}팀`, gender: '남', seasonId: currentSeason.id, captainId: null, members: [] });
        for (let i = 1; i <= femaleCount; i++) newTeams.push({ teamName: `여자 ${i}팀`, gender: '여', seasonId: currentSeason.id, captainId: null, members: [] });

        if (newTeams.length > 0 && confirm(`${newTeams.length}개의 팀을 생성하시겠습니까?`)) {
            try {
                await batchAddTeams(classId, newTeams);
                const updatedTeams = await getTeams(classId, currentSeason.id);
                set({ teams: updatedTeams });
                alert('팀이 성공적으로 생성되었습니다.');
            } catch (error) { console.error("팀 일괄 생성 오류:", error); }
        }
    },

    assignPlayerToTeam: async (teamId, playerId) => {
        const { classId, teams, currentSeason } = get();
        if (!classId || !currentSeason || !playerId) return;

        const team = teams.find(t => t.id === teamId);
        if (team.members.includes(playerId)) return alert('이미 팀에 속한 선수입니다.');

        await updateTeamMembers(classId, teamId, [...team.members, playerId]);
        const updatedTeams = await getTeams(classId, currentSeason.id);
        set({ teams: updatedTeams });
    },

    unassignPlayerFromTeam: async (teamId, playerId) => {
        const { classId, teams, currentSeason } = get();
        if (!classId || !currentSeason) return;

        const team = teams.find(t => t.id === teamId);
        await updateTeamMembers(classId, teamId, team.members.filter(id => id !== playerId));
        const updatedTeams = await getTeams(classId, currentSeason.id);
        set({ teams: updatedTeams });
    },

    autoAssignTeams: async () => {
        const { classId, players, teams, currentSeason } = get();
        if (!classId || !currentSeason || !confirm('팀원을 자동 배정하시겠습니까? 기존 팀 배정은 모두 초기화됩니다.')) return;

        const numTeams = teams.length;
        if (players.length === 0 || numTeams === 0) return alert('선수와 팀이 모두 필요합니다.');

        try {
            const allSeasons = await getSeasons(classId);
            const pastSeasons = allSeasons.filter(s => s.id !== currentSeason.id && s.status === 'completed');
            const pastMatchesPromises = pastSeasons.map(s => getMatches(classId, s.id));
            const pastMatchesBySeason = await Promise.all(pastMatchesPromises);
            const allPastMatches = pastMatchesBySeason.flat();

            const playerGoals = players.reduce((acc, player) => ({ ...acc, [player.id]: 0 }), {});
            allPastMatches.forEach(match => {
                if (match.scorers) {
                    Object.entries(match.scorers).forEach(([playerId, goals]) => {
                        if (playerGoals.hasOwnProperty(playerId)) {
                            playerGoals[playerId] += goals;
                        }
                    });
                }
            });

            const activePlayers = players.filter(p => p.status !== 'inactive' && p.role !== 'admin');
            const sortedPlayers = [...activePlayers].sort((a, b) => (playerGoals[b.id] || 0) - (playerGoals[a.id] || 0));

            const teamUpdates = teams.map(team => ({ id: team.id, members: [], captainId: null, genderCount: { '남': 0, '여': 0 } }));

            const topPlayers = sortedPlayers.splice(0, numTeams);
            const shuffledTeamUpdates = [...teamUpdates].sort(() => 0.5 - Math.random());
            topPlayers.forEach((player, index) => {
                const team = shuffledTeamUpdates[index];
                if (team) {
                    team.members.push(player.id);
                    if (player.gender) team.genderCount[player.gender]++;
                }
            });

            const remainingMalePlayers = sortedPlayers.filter(p => p.gender === '남').sort(() => 0.5 - Math.random());
            const remainingFemalePlayers = sortedPlayers.filter(p => p.gender === '여').sort(() => 0.5 - Math.random());

            const assignRemainingPlayers = (playersToAssign, gender) => {
                playersToAssign.forEach(player => {
                    teamUpdates.sort((a, b) => {
                        if (a.genderCount[gender] !== b.genderCount[gender]) {
                            return a.genderCount[gender] - b.genderCount[gender];
                        }
                        return a.members.length - b.members.length;
                    });
                    const targetTeam = teamUpdates[0];
                    if (targetTeam) {
                        targetTeam.members.push(player.id);
                        targetTeam.genderCount[gender]++;
                    }
                });
            };

            assignRemainingPlayers(remainingMalePlayers, '남');
            assignRemainingPlayers(remainingFemalePlayers, '여');

            teamUpdates.forEach(team => {
                if (team.members.length > 0) {
                    const randomIndex = Math.floor(Math.random() * team.members.length);
                    team.captainId = team.members[randomIndex];
                }
            });

            const finalTeamUpdates = teamUpdates.map(({ id, members, captainId }) => ({ id, members, captainId }));
            await batchUpdateTeams(classId, finalTeamUpdates);

            const updatedTeams = await getTeams(classId, currentSeason.id);
            set({ teams: updatedTeams });
            alert('자동 배정이 완료되었습니다.');

        } catch (error) {
            console.error("자동 배정 중 오류 발생:", error);
            alert(`자동 배정 중 오류가 발생했습니다: ${error.message}`);
        }
    },

    generateSchedule: async () => {
        const { classId, teams, leagueType, currentSeason } = get();
        if (!classId || !currentSeason) return alert('현재 시즌 정보가 없습니다.');
        if (teams.length < 2) return alert('최소 2팀이 필요합니다.');
        if (!confirm('경기 일정을 새로 생성하시겠습니까? 기존 경기 일정은 모두 삭제됩니다.')) return;

        let matchesToCreate = [];
        const createRoundRobinSchedule = (teamList) => {
            if (teamList.length < 2) return [];
            let scheduleTeams = [...teamList];
            if (scheduleTeams.length % 2 !== 0) scheduleTeams.push({ id: 'BYE' });

            const numTeams = scheduleTeams.length;
            const rounds = [];
            for (let round = 0; round < numTeams - 1; round++) {
                const roundMatches = [];
                for (let i = 0; i < numTeams / 2; i++) {
                    const teamA = scheduleTeams[i];
                    const teamB = scheduleTeams[numTeams - 1 - i];
                    if (teamA.id !== 'BYE' && teamB.id !== 'BYE') {
                        roundMatches.push({ teamA_id: teamA.id, teamB_id: teamB.id });
                    }
                }
                rounds.push(roundMatches);
                scheduleTeams.splice(1, 0, scheduleTeams.pop());
            }
            const homeAndAway = [...rounds, ...rounds.map(round => round.map(match => ({ teamA_id: match.teamB_id, teamB_id: match.teamA_id })))];
            return homeAndAway.flat().map(match => ({
                ...match, seasonId: currentSeason.id, teamA_score: null, teamB_score: null, status: '예정'
            }));
        };

        if (leagueType === 'separated') {
            const maleTeams = teams.filter(t => t.gender === '남');
            const femaleTeams = teams.filter(t => t.gender === '여');
            matchesToCreate = [...createRoundRobinSchedule(maleTeams), ...createRoundRobinSchedule(femaleTeams)];
        } else {
            matchesToCreate = createRoundRobinSchedule(teams);
        }

        if (matchesToCreate.length === 0) return alert('생성할 경기가 없습니다. 팀 구성을 확인해주세요.');

        try {
            await deleteMatchesBySeason(classId, currentSeason.id);
            await batchAddMatches(classId, matchesToCreate);
            const updatedMatches = await getMatches(classId, currentSeason.id);
            set({ matches: updatedMatches });
            alert('새로운 경기 일정이 성공적으로 생성되었습니다.');
        } catch (error) {
            console.error("경기 일정 생성 오류:", error);
            alert(`경기 일정 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    },

    saveScores: async (matchId, scores, scorers) => {
        const { classId } = get();
        if (!classId) return;
        try {
            const recorderId = auth.currentUser?.uid;
            if (!recorderId) {
                alert("로그인 정보가 없습니다. 다시 로그인해주세요.");
                return;
            }
            await updateMatchScores(classId, matchId, scores, scorers, recorderId);
        } catch (error) { console.error("점수 저장 오류:", error); }
    },

    checkAttendance: async () => {
        const { classId } = get();
        const user = auth.currentUser;
        if (!classId || !user) return;

        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) return;
        try {
            const isAvailable = await isAttendanceRewardAvailable(classId, myPlayerData.id);
            if (isAvailable) {
                set({ showAttendanceModal: true });
            }
        } catch (error) {
            console.error("출석 체크 가능 여부 확인 중 오류:", error);
        }
    },

    claimAttendanceReward: async () => {
        const { classId } = get();
        const user = auth.currentUser;
        if (!classId || !user) return;

        const myPlayerData = get().players.find(p => p.authUid === user.uid);
        if (!myPlayerData) return;
        try {
            const rewardAmount = 100;
            await grantAttendanceReward(classId, myPlayerData.id, rewardAmount);
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

    standingsData: () => {
        const { teams, matches } = get();
        if (!teams || teams.length === 0) return [];

        const completedMatches = matches.filter(m => m.status === '완료');
        let stats = teams.map(team => ({
            id: team.id, teamName: team.teamName, emblemId: team.emblemId, emblemUrl: team.emblemUrl,
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