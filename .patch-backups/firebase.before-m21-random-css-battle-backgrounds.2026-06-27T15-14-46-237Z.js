import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion, getDoc, increment, Timestamp, serverTimestamp, limit, collectionGroup, onSnapshot
} from "firebase/firestore";
import initialTitles from '../assets/titles.json';
import imageCompression from 'browser-image-compression';
import { PET_DATA, SKILLS } from "@/features/pet/petData";
import { deleteField } from "firebase/firestore";
import allQuizzesData from '../assets/missions.json';


// Firebase 구성 정보
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app); // <- export를 추가해주세요.
export const auth = getAuth(app);
export const db = getFirestore(app);

// src/api/firebase.js

export async function seedInitialTitles(classId) {
  if (!classId) return;
  const titlesRef = collection(db, "classes", classId, "titles");

  // [수정됨] 기존에는 비어있을 때만(snapshot.empty) 넣었지만, 
  // 이제는 앱이 실행될 때마다 titles.json의 최신 데이터로 기존 DB를 업데이트(merge) 합니다.
  console.log(`[${classId}] titles.json의 최신 내용으로 칭호 데이터를 강제 동기화합니다.`);

  const batch = writeBatch(db);
  initialTitles.forEach(title => {
    const docRef = doc(titlesRef, title.id);
    // merge: true 옵션을 주면 기존에 유저들이 획득한 기록은 안전하게 놔두고,
    // 설명(description)이나 아이콘 같은 정보만 최신으로 덮어씌웁니다.
    batch.set(docRef, {
      ...title,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
  console.log(`[${classId}] 칭호 데이터 강제 동기화 완료.`);
}

// --- 포인트 기록 헬퍼 함수 (classId 추가) ---
const addPointHistory = async (classId, playerId, playerName, changeAmount, reason) => {
  if (!classId) return;
  try {
    await addDoc(collection(db, 'classes', classId, 'point_history'), {
      playerId,
      playerName,
      changeAmount,
      reason,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('포인트 변동 내역 기록 중 오류 발생:', error);
  }
};

// --- 상점 및 아바타 (classId 추가) ---
export async function updatePlayerAvatar(classId, playerId, avatarConfig, snapshotUrl = null) {
  if (!classId) return;

  const playerRef = doc(db, "classes", classId, "players", playerId);
  const updateData = { avatarConfig };

  // 스냅샷 URL이 넘어왔을 경우에만 DB에 저장
  if (snapshotUrl) {
    updateData.avatarSnapshotUrl = snapshotUrl;
  }

  await updateDoc(playerRef, updateData);
}

export async function buyAvatarPart(classId, playerId, part) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, 'classes', classId, 'players', playerId);
  const playerDoc = await getDoc(playerRef);
  if (!playerDoc.exists()) {
    throw new Error("플레이어 정보를 찾을 수 없습니다.");
  }
  const playerData = playerDoc.data();

  const now = new Date();
  let finalPrice = part.price;

  if (part.isSale && part.saleStartDate && part.saleEndDate) {
    const startDate = part.saleStartDate.toDate();
    const endDate = part.saleEndDate.toDate();
    if (now >= startDate && now <= endDate) {
      finalPrice = part.salePrice;
    }
  }

  await runTransaction(db, async (transaction) => {
    const freshPlayerDoc = await transaction.get(playerRef);
    const freshPlayerData = freshPlayerDoc.data();

    if (freshPlayerData.points < finalPrice) {
      throw "포인트가 부족합니다.";
    }
    if (freshPlayerData.ownedParts?.includes(part.id)) {
      throw "이미 소유하고 있는 아이템입니다.";
    }

    const newPoints = freshPlayerData.points - finalPrice;
    transaction.update(playerRef, {
      points: newPoints,
      ownedParts: arrayUnion(part.id)
    });
  });

  await addPointHistory(
    classId,
    playerData.authUid,
    playerData.name,
    -finalPrice,
    `${part.id} 구매`
  );
  return "구매에 성공했습니다!";
}

// =================================================================
// ▼▼▼ [수정] 자동 칭호 획득 조건 검사 및 부여 헬퍼 함수 (classId 추가) ▼▼▼
// =================================================================
export async function checkAndGrantAutoTitles(classId, studentId, studentAuthUid) {
  // AUTO_TITLE_ATOMIC_REWARD_V1
  if (!classId || !studentId) return 0;

  const playerRef = doc(db, 'classes', classId, 'players', studentId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return 0;

  const playerData = playerSnap.data();
  const targetAuthUid = studentAuthUid || playerData.authUid || studentId;

  const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const titlesRef = collection(db, "classes", classId, "titles");
  const qTitles = query(titlesRef, where("type", "==", "auto"));
  const titlesSnapshot = await getDocs(qTitles);
  const autoTitles = titlesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const submissionsRef = collection(db, "classes", classId, "missionSubmissions");
  const qSubmissions = query(
    submissionsRef,
    where("studentId", "==", studentId),
    where("status", "==", "approved")
  );
  const submissionsSnapshot = await getDocs(qSubmissions);
  const approvedMissionCount = Math.max(
    submissionsSnapshot.size,
    toNumber(playerData.approvedMissionCount),
    toNumber(playerData.completedMissionCount),
    toNumber(playerData.missionCompletedCount),
    toNumber(playerData.missionCompleteCount)
  );

  const quizHistoryRef = collection(db, "classes", classId, "quiz_history");
  const qQuiz = query(
    quizHistoryRef,
    where("studentId", "==", studentId),
    where("isCorrect", "==", true)
  );
  const quizSnapshot = await getDocs(qQuiz);
  const correctQuizCount = Math.max(
    quizSnapshot.size,
    toNumber(playerData.correctQuizCount),
    toNumber(playerData.quizCorrectCount),
    toNumber(playerData.totalCorrectQuizCount),
    toNumber(playerData.correctQuizTotal)
  );

  const contributionsQuery = query(
    collectionGroup(db, 'contributions'),
    where('classId', '==', classId),
    where('playerId', '==', studentId)
  );
  const contributionsSnapshot = await getDocs(contributionsQuery);
  const totalDonationFromDocs = contributionsSnapshot.docs.reduce((sum, doc) => sum + toNumber(doc.data().amount), 0);
  const totalDonation = Math.max(
    totalDonationFromDocs,
    toNumber(playerData.totalDonation),
    toNumber(playerData.donationTotal),
    toNumber(playerData.totalDonatedPoints)
  );

  const likesQuery = query(collection(db, "classes", classId, "players", studentId, "myRoomLikes"));
  const likesSnapshot = await getDocs(likesQuery);
  const myRoomLikesCount = Math.max(
    toNumber(playerData.myRoomLikesTotal),
    toNumber(playerData.myRoomLikeCount),
    toNumber(playerData.myRoomLikesCount),
    likesSnapshot.size
  );

  const attendanceCount = Math.max(
    toNumber(playerData.totalAttendanceDays),
    toNumber(playerData.cumulativeAttendanceDays),
    toNumber(playerData.attendanceCount),
    toNumber(playerData.consecutiveAttendanceDays)
  );

  const pointOwned = toNumber(playerData.points);
  let grantedCount = 0;

  for (const title of autoTitles) {
    let conditionMet = false;

    if (title.conditionId === 'mission_30_completed' && approvedMissionCount >= 30) conditionMet = true;
    else if (title.conditionId === 'quiz_50_correct' && correctQuizCount >= 50) conditionMet = true;
    else if (title.conditionId === 'point_10000_owned' && pointOwned >= 10000) conditionMet = true;
    else if (title.conditionId === 'donation_5000_points' && totalDonation >= 5000) conditionMet = true;
    else if (title.conditionId === 'myroom_20_likes' && myRoomLikesCount >= 20) conditionMet = true;
    else if (title.conditionId === 'attendance_30_consecutive' && attendanceCount >= 30) conditionMet = true;
    else if (title.conditionId === 'league_winner' && (
      toNumber(playerData.leagueWins) > 0 ||
      toNumber(playerData.leagueWinnerCount) > 0 ||
      playerData.isLeagueWinner === true
    )) conditionMet = true;
    else if (title.conditionId === 'top_scorer' && (
      toNumber(playerData.topScorerCount) > 0 ||
      playerData.isTopScorer === true
    )) conditionMet = true;

    if (!conditionMet) continue;

    const rewardReason = `칭호 [${title.name}] 획득 보상`;

    // 과거 버전에서 이미 같은 칭호 보상 내역이 있다면, 포인트는 다시 주지 않고
    // ownedTitles / autoTitleRewardsGranted만 정리합니다.
    let hasExistingRewardHistory = false;
    const rewardAuthUidForHistoryCheck = targetAuthUid || playerData.authUid || studentId;

    try {
      const historyRef = collection(db, 'classes', classId, 'point_history');
      const qHistory = query(
        historyRef,
        where('playerId', '==', rewardAuthUidForHistoryCheck),
        where('reason', '==', rewardReason),
        limit(1)
      );
      const historySnapshot = await getDocs(qHistory);
      hasExistingRewardHistory = !historySnapshot.empty;
    } catch (historyError) {
      console.warn('[자동칭호] 기존 보상 이력 확인 실패, ownedTitles/marker 기준으로 진행:', historyError);
    }

    const result = await runTransaction(db, async (transaction) => {
      const latestSnap = await transaction.get(playerRef);
      if (!latestSnap.exists()) {
        return { granted: false, rewardPaid: false, authUid: null, name: null };
      }

      const latestData = latestSnap.data();
      const ownedTitles = Array.isArray(latestData.ownedTitles) ? latestData.ownedTitles : [];
      const rewardMarkers = latestData.autoTitleRewardsGranted || {};
      const alreadyOwnsTitle = ownedTitles.includes(title.id);
      const alreadyRewarded = Boolean(rewardMarkers[title.id]) || hasExistingRewardHistory;

      if (alreadyOwnsTitle || alreadyRewarded) {
        const updateData = {};
        if (!alreadyOwnsTitle) updateData.ownedTitles = arrayUnion(title.id);
        if (!rewardMarkers[title.id]) updateData[`autoTitleRewardsGranted.${title.id}`] = true;

        if (Object.keys(updateData).length > 0) {
          transaction.update(playerRef, updateData);
        }

        return {
          granted: !alreadyOwnsTitle,
          rewardPaid: false,
          authUid: latestData.authUid || targetAuthUid || studentId,
          name: latestData.name || playerData.name || ''
        };
      }

      transaction.update(playerRef, {
        ownedTitles: arrayUnion(title.id),
        points: increment(2000),
        [`autoTitleRewardsGranted.${title.id}`]: serverTimestamp()
      });

      return {
        granted: true,
        rewardPaid: true,
        authUid: latestData.authUid || targetAuthUid || studentId,
        name: latestData.name || playerData.name || ''
      };
    });

    if (result.granted) {
      grantedCount += 1;

      if (result.authUid) {
        createNotification(
          result.authUid,
          `✨ 칭호 획득! [${title.name}]`,
          title.description,
          "title_acquired",
          "/profile"
        );
      }
    }

    if (result.rewardPaid && result.authUid) {
      // AUTO_TITLE_REWARD_POINT_POPUP_V1
      // 포인트는 transaction에서 이미 지급됨. 여기서는 모달/알림/내역만 생성합니다.
      // PointAdjustmentModal은 type='point'이고 data.amount가 있는 알림만 감지합니다.
      await addDoc(collection(db, 'notifications'), {
        userId: result.authUid,
        title: `+2000P 포인트 조정`,
        body: `사유: ${rewardReason}`,
        type: 'point',
        link: null,
        isRead: false,
        createdAt: serverTimestamp(),
        data: {
          amount: 2000,
          reason: rewardReason,
          title: `+2000P 포인트 조정`,
          autoTitleReward: true,
          titleId: title.id,
          titleName: title.name
        }
      });

      await addPointHistory(
        classId,
        result.authUid,
        result.name,
        2000,
        rewardReason
      );
    }
  }

  return grantedCount;
}


export async function syncMissingAutoTitlesForClass(classId) {
  // AUTO_TITLE_RECHECK_MYROOM_LIKES_V3
  if (!classId) return { checked: 0, granted: 0 };

  const playersRef = collection(db, 'classes', classId, 'players');
  const playersSnapshot = await getDocs(playersRef);

  let checked = 0;
  let granted = 0;

  for (const playerDoc of playersSnapshot.docs) {
    const player = { id: playerDoc.id, ...playerDoc.data() };
    if (player.status === 'inactive') continue;

    checked += 1;
    granted += await checkAndGrantAutoTitles(classId, player.id, player.authUid);
  }

  return { checked, granted };
}



// --- 미션 관리 (classId 추가) ---
// src/api/firebase.js

// src/api/firebase.js

export async function approveMissionsInBatch(classId, missionId, studentIds, recorderId, reward) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const batch = writeBatch(db);
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();
  const heartReward = Number(missionData.heartReward || 0);
  const MISSION_EXP_REWARD = 100;

  // [수정] batch.commit() 이후에 실행할 작업들을 별도로 수집
  const postCommitTasks = [];

  for (const studentId of studentIds) {
    const playerRef = doc(db, 'classes', classId, 'players', studentId);
    const playerDoc = await getDoc(playerRef);

    if (playerDoc.exists()) {
      const playerData = playerDoc.data();

      const submissionQuery = query(
        collection(db, "classes", classId, "missionSubmissions"),
        where("missionId", "==", missionId),
        where("studentId", "==", studentId),
        where("status", "==", "pending")
      );
      const submissionSnapshot = await getDocs(submissionQuery);

      if (!submissionSnapshot.empty) {
        const submissionDoc = submissionSnapshot.docs[0];
        batch.update(submissionDoc.ref, {
          status: 'approved',
          checkedBy: recorderId,
          approvedAt: serverTimestamp(),
          approvedReward: reward,
          approvedHeartReward: heartReward
        });
      } else {
        const newSubmissionRef = doc(collection(db, "classes", classId, "missionSubmissions"));
        batch.set(newSubmissionRef, {
          missionId,
          studentId,
          studentName: playerData.name,
          status: 'approved',
          requestedAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
          approvedReward: reward,
          approvedHeartReward: heartReward,
          checkedBy: recorderId,
          text: '(관리자 직접 승인)',
          photoUrls: [],
          isPublic: false
        });
      }

      const playerRewardUpdate = {
        points: increment(reward)
      };

      if (heartReward > 0) {
        playerRewardUpdate.totalLikes = increment(heartReward);
      }

      batch.update(playerRef, playerRewardUpdate);

      // [수정] addPointHistory, 펫 경험치, 알림, 칭호 체크는 batch.commit() 이후로 이동
      postCommitTasks.push(async () => {
        await addPointHistory(
          classId,
          playerData.authUid,
          playerData.name,
          reward,
          `${missionData.title} 미션 완료`
        );
        if (playerData.pets && playerData.pets.length > 0) {
          await updatePetExperience(playerRef, MISSION_EXP_REWARD);
        }
        const heartRewardText = heartReward > 0 ? ` · ❤️ ${heartReward}` : '';
        const missionNotifTitle = `✅ 미션 승인: ${missionData.title}`;
        createNotification(
          playerData.authUid,
          `+${reward}P${heartRewardText} 보상 획득`,
          `${missionData.title} 미션 완료`,
          'point',
          null,
          {
            amount: reward,
            heartReward,
            reason: `${missionData.title} 미션 완료`,
            title: `+${reward}P${heartRewardText} 보상 획득`,
            questTitle: missionNotifTitle
          }
        );
        await checkAndGrantAutoTitles(classId, studentId, playerData.authUid);
      });
    }
  }

  // 보너스 지급 로직
  const incentiveAmount = studentIds.length * 10;
  let recorderPostTask = null;
  if (incentiveAmount > 0) {
    const playersRef = collection(db, 'classes', classId, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(incentiveAmount) });

      // [수정] 보너스 내역 기록도 commit 이후로 이동
      recorderPostTask = async () => {
        await addPointHistory(
          classId,
          recorderId,
          recorderData.name,
          incentiveAmount,
          `보너스 (미션 승인 ${studentIds.length}건)`
        );
        createNotification(
          recorderId,
          `✅ 미션 승인 완료`,
          `${studentIds.length}건의 미션을 확인하여 ${incentiveAmount}P를 획득했습니다.`,
          'mission_reward'
        );
      };
    }
  }

  // [수정] 모든 DB 쓰기를 원자적으로 커밋한 뒤 부수 작업 실행
  await batch.commit();

  // commit 성공 후 포인트 내역 기록 및 알림 처리
  for (const task of postCommitTasks) {
    await task();
  }
  if (recorderPostTask) await recorderPostTask();
}

export async function uploadMissionSubmissionFile(classId, missionId, studentId, files) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const uploadPromises = files.map(async (file) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);
    const storageRef = ref(storage, `classes/${classId}/mission-submissions/${missionId}/${studentId}/${Date.now()}_${compressedFile.name}`);
    const uploadResult = await uploadBytes(storageRef, compressedFile);
    return getDownloadURL(uploadResult.ref);
  });
  return await Promise.all(uploadPromises);
}

export async function cancelMissionSubmission(classId, missionId, studentId) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
  const q = query(
    submissionsRef,
    where('missionId', '==', missionId),
    where('studentId', '==', studentId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('취소할 수 있는 제출이 없습니다.');
  // pending → cancelled로 변경 (내용은 보존)
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { status: 'cancelled' }));
  await batch.commit();
}

export async function requestMissionApproval(classId, missionId, studentId, studentName, submissionData = {}) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);

  if (submissionData.photoUrl) {
    submissionData.photoUrls = [submissionData.photoUrl];
    delete submissionData.photoUrl;
  }

  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();

  const q = query(
    submissionsRef,
    where("missionId", "==", missionId),
    where("studentId", "==", studentId)
  );
  const querySnapshot = await getDocs(q);
  const submissions = querySnapshot.docs.map(doc => doc.data());

  let existingSubmission = null;
  if (missionData.isFixed) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    existingSubmission = submissions.find(sub => {
      const subDate = sub.requestedAt?.toDate();
      return subDate && subDate >= today && ['pending', 'approved'].includes(sub.status);
    });

    if (existingSubmission) {
      throw new Error("오늘 이미 완료한 미션입니다.");
    }
  } else {
    existingSubmission = submissions.find(sub => ['pending', 'approved'].includes(sub.status));

    if (existingSubmission) {
      const status = existingSubmission.status;
      if (status === 'pending') throw new Error("이미 승인을 요청했습니다. 잠시만 기다려주세요.");
      if (status === 'approved') throw new Error("이미 완료된 미션입니다.");
    }
  }

  const newSubmissionRef = doc(collection(db, 'classes', classId, 'missionSubmissions'));
  await setDoc(newSubmissionRef, {
    missionId,
    studentId,
    studentName,
    status: 'pending',
    requestedAt: serverTimestamp(),
    checkedBy: null,
    isPublic: submissionData.isPublic,
    ...submissionData
  });

  const playersRef = collection(db, 'classes', classId, 'players');
  const adminRecorderQuery = query(playersRef, where('role', 'in', ['admin', 'recorder']));
  const adminRecorderSnapshot = await getDocs(adminRecorderQuery);

  adminRecorderSnapshot.forEach(userDoc => {
    const user = userDoc.data();
    if (user.authUid) {
      const link = user.role === 'recorder' ? '/recorder-dashboard' : '/admin/mission';
      createNotification(
        user.authUid,
        '미션 승인 요청',
        `[${missionData.title}] ${studentName} 학생이 완료를 요청했습니다.`,
        'mission_request',
        link
      );
    }
  });
}

export async function rejectMissionSubmission(classId, submissionId, studentAuthUid, missionTitle) {
  if (!classId) return;
  const submissionRef = doc(db, 'classes', classId, 'missionSubmissions', submissionId);
  await updateDoc(submissionRef, {
    status: 'rejected'
  });

  if (studentAuthUid) {
    createNotification(
      studentAuthUid,
      '😢 미션이 반려되었습니다.',
      `'${missionTitle}' 미션이 반려되었습니다. 다시 확인 후 제출해주세요.`,
      'mission',
      '/missions'
    );
  }
}

/**
 * [이슈 8] 승인된 미션을 취소하고 포인트를 회수합니다.
 * - newReward: null이면 전액 회수, 숫자면 차등 보상 정정 (차액 지급 또는 회수)
 */
export async function cancelMissionApproval(classId, submissionId, originalReward, newReward = null) {
  if (!classId) throw new Error("학급 정보가 없습니다.");

  const submissionRef = doc(db, 'classes', classId, 'missionSubmissions', submissionId);
  const submissionSnap = await getDoc(submissionRef);
  if (!submissionSnap.exists()) throw new Error("제출 내역을 찾을 수 없습니다.");

  const submissionData = submissionSnap.data();
  if (submissionData.status !== 'approved') throw new Error("승인된 제출 내역만 취소할 수 있습니다.");

  const playerRef = doc(db, 'classes', classId, 'players', submissionData.studentId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) throw new Error("학생 정보를 찾을 수 없습니다.");
  const playerData = playerSnap.data();

  const missionRef = doc(db, 'classes', classId, 'missions', submissionData.missionId);
  const missionSnap = await getDoc(missionRef);
  const missionTitle = missionSnap.exists() ? missionSnap.data().title : '(삭제된 미션)';

  const isCorrection = newReward !== null; // true: 차등 보상 정정, false: 전액 취소
  const pointDiff = isCorrection ? (newReward - originalReward) : -originalReward;
  const originalHeartReward = Number(submissionData.approvedHeartReward || 0);

  const batch = writeBatch(db);

  if (isCorrection) {
    // 차등 보상 정정: 승인 상태 유지, 보상만 변경
    batch.update(submissionRef, { approvedReward: newReward });
  } else {
    // 전액 취소: 상태를 pending으로 되돌려 재승인 가능하게 함
    batch.update(submissionRef, {
      status: 'pending',
      approvedAt: null,
      checkedBy: null,
      approvedReward: null,
      approvedHeartReward: null,
      cancelledAt: serverTimestamp()
    });
  }

  const playerUpdate = {};

  if (pointDiff !== 0) {
    playerUpdate.points = increment(pointDiff);
  }

  if (!isCorrection && originalHeartReward > 0) {
    playerUpdate.totalLikes = increment(-originalHeartReward);
  }

  if (Object.keys(playerUpdate).length > 0) {
    batch.update(playerRef, playerUpdate);
  }

  await batch.commit();

  if (pointDiff !== 0) {
    const reason = isCorrection
      ? `${missionTitle} 미션 보상 정정 (${originalReward}P → ${newReward}P)`
      : `${missionTitle} 미션 승인 취소 (포인트 회수)`;
    await addPointHistory(classId, playerData.authUid, playerData.name, pointDiff, reason);
  }

  createNotification(
    playerData.authUid,
    isCorrection ? '📝 미션 보상이 정정되었습니다.' : '↩️ 미션 승인이 취소되었습니다.',
    isCorrection
      ? `'${missionTitle}' 미션 보상이 ${originalReward}P에서 ${newReward}P로 정정되었습니다.`
      : `'${missionTitle}' 미션 승인이 취소되었습니다. ${originalReward}P가 회수됩니다.`,
    'mission'
  );
}

export async function deleteMission(classId, missionId) {
  if (!classId) return;
  const batch = writeBatch(db);
  const submissionsRef = collection(db, "classes", classId, "missionSubmissions");
  const q = query(submissionsRef, where("missionId", "==", missionId));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);
  batch.delete(missionRef);
  await batch.commit();
}

export async function getMissionHistory(classId, studentId, missionId) {
  if (!classId) return [];
  const q = query(
    collection(db, "classes", classId, "missionSubmissions"),
    where("studentId", "==", studentId),
    where("missionId", "==", missionId),
    orderBy("requestedAt", "desc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addMissionComment(classId, submissionId, commentData, studentAuthUid, missionTitle) {
  if (!classId) return;

  const submissionRef = doc(db, "classes", classId, "missionSubmissions", submissionId);
  const commenterRef = doc(db, "classes", classId, "players", commentData.commenterId);
  const commentsRef = collection(db, "classes", classId, "missionSubmissions", submissionId, "comments");

  let rewardAmount = 0;
  let commenterAuthUid = null;
  let commenterName = null;

  await runTransaction(db, async (transaction) => {
    const submissionSnap = await transaction.get(submissionRef);
    const commenterSnap = await transaction.get(commenterRef);

    if (submissionSnap.exists() && commenterSnap.exists()) {
      const submissionData = submissionSnap.data();
      const commenterData = commenterSnap.data();

      // [방어] 타인의 미션일 것
      if (submissionData.studentId !== commentData.commenterId) {
        const todayStr = new Date().toLocaleDateString();
        let dailyCommentCount = commenterData.dailyMissionCommentCount || 0;
        let dailyCommentedUsers = commenterData.dailyMissionCommentedUsers || [];

        if (commenterData.lastMissionCommentDate !== todayStr) {
          dailyCommentCount = 0;
          dailyCommentedUsers = [];
        }

        const alreadyCommentedOnThisUser = dailyCommentedUsers.includes(submissionData.studentId);

        // 하루 최대 10회, 동일 친구 미션에 중복 보상 방지
        if ((dailyCommentCount < 10) && !alreadyCommentedOnThisUser) {
          rewardAmount = 10;
          commenterAuthUid = commenterData.authUid;
          commenterName = commenterData.name;

          transaction.update(commenterRef, {
            points: increment(rewardAmount),
            dailyMissionCommentCount: dailyCommentCount + 1,
            dailyMissionCommentedUsers: [...dailyCommentedUsers, submissionData.studentId],
            lastMissionCommentDate: todayStr
          });
        }
      }
    }
  });

  await addDoc(commentsRef, {
    ...commentData,
    classId,
    createdAt: serverTimestamp(),
  });

  if (rewardAmount > 0 && commenterAuthUid) {
    await addPointHistory(classId, commenterAuthUid, commenterName, rewardAmount, "친구 미션 칭찬 댓글 보상");
  }

  if (studentAuthUid && commentData.commenterId !== studentAuthUid) {
    createNotification(
      studentAuthUid,
      `💬 ${missionTitle} 게시물에 댓글이 달렸습니다.`,
      `${commentData.commenterName}: "${commentData.text}"`,
      "mission_comment",
      `/mission-gallery`
    );
  }
}

export async function addMissionReply(classId, submissionId, commentId, replyData, originalComment) {
  if (!classId) return;
  const repliesRef = collection(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies");
  await addDoc(repliesRef, {
    ...replyData,
    createdAt: serverTimestamp(),
  });

  const replierAuthUid = auth.currentUser?.uid;
  const originalCommenterAuthUid = originalComment.commenterAuthUid;
  const link = `/missions?openHistoryForSubmission=${submissionId}`;

  if (replierAuthUid && originalCommenterAuthUid && replierAuthUid !== originalCommenterAuthUid) {
    createNotification(
      originalCommenterAuthUid,
      `RE: ${originalComment.missionTitle}`,
      `${replyData.replierName}: "${replyData.text}"`,
      "mission_comment",
      link
    );
  }
}

const getSafeKeyFromUrl = (url) => {
  try {
    return btoa(url)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (e) {
    return url.replace(/[^a-zA-Z0-9]/g, '');
  }
};

export async function toggleSubmissionImageRotation(classId, submissionId, imageUrl) {
  if (!classId) return;
  const submissionRef = doc(db, "classes", classId, "missionSubmissions", submissionId);
  const imageKey = getSafeKeyFromUrl(imageUrl);

  try {
    await runTransaction(db, async (transaction) => {
      const submissionDoc = await transaction.get(submissionRef);
      if (!submissionDoc.exists()) {
        throw "Submission document does not exist!";
      }
      const currentRotations = submissionDoc.data().rotations || {};
      const currentRotation = currentRotations[imageKey] || 0;
      const newRotation = (currentRotation + 90) % 360;

      transaction.update(submissionRef, {
        [`rotations.${imageKey}`]: newRotation
      });
    });
  } catch (error) {
    console.error("Transaction failed: ", error);
    throw error;
  }
}

// --- 포인트 수동 조정 (classId 추가) ---
export async function adjustPlayerPoints(classId, playerId, amount, reason, extraNotificationData = {}) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId);
  let playerAuthUid = null;
  let playerName = null;

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("해당 플레이어를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    playerAuthUid = playerData.authUid;
    playerName = playerData.name;
    transaction.update(playerRef, { points: increment(amount) });
  });

  // transaction 완료 후 알림·히스토리 기록 (transaction 안에서는 addDoc 불가)
  const title = `${amount > 0 ? '+' : ''}${amount}P 포인트 조정`;
  const body = `사유: ${reason}`;
  const notifData = { amount, reason, title, ...extraNotificationData };
  console.log('[adjustPlayerPoints] 알림 생성:', { playerAuthUid, title, notifData });
  if (playerAuthUid) {
    await createNotification(playerAuthUid, title, body, 'point', null, notifData);
    await addPointHistory(classId, playerAuthUid, playerName, amount, reason);
  }
}

export async function batchAdjustPlayerPoints(classId, playerIds, amount, reason) {
  if (!classId) return;
  const batch = writeBatch(db);

  for (const playerId of playerIds) {
    const playerRef = doc(db, "classes", classId, "players", playerId);
    const playerDoc = await getDoc(playerRef);

    if (playerDoc.exists()) {
      const playerData = playerDoc.data();
      batch.update(playerRef, { points: increment(amount) });

      const title = `${amount > 0 ? '+' : ''}${amount}P 포인트 조정`;
      const body = `사유: ${reason}`;

      createNotification(
        playerData.authUid,
        title,
        body,
        'point',
        `/profile/${playerId}`,
        { amount, reason, title }
      );

      await addPointHistory(
        classId,
        playerData.authUid,
        playerData.name,
        amount,
        reason
      );
    }
  }

  await batch.commit();
}

// =================================================================
// ▼▼▼ [신규] 학급 가입 및 생성 관련 함수 ▼▼▼
// =================================================================

/**
 * 초대 코드를 사용하여 해당하는 classId를 찾습니다.
 * @param {string} inviteCode - 확인할 초대 코드
 * @returns {string|null} - 일치하는 학급의 ID 또는 null
 */
export async function getClassIdByInviteCode(inviteCode) {
  if (!inviteCode) return null;
  const classesRef = collection(db, "classes");
  const q = query(classesRef, where("inviteCode", "==", inviteCode), limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.error(`'${inviteCode}'에 해당하는 학급을 찾을 수 없습니다.`);
    return null;
  }
  return querySnapshot.docs[0].id;
}

/**
 * 특정 학급에 새로운 선수를 등록합니다.
 * @param {string} classId - 가입할 학급의 ID
 * @param {object} user - Firebase Auth를 통해 로그인한 사용자 객체
 */
export async function registerPlayerInClass(classId, user) {
  if (!classId || !user) throw new Error("학급 ID와 사용자 정보가 필요합니다.");

  const playerRef = doc(db, 'classes', classId, 'players', user.uid);
  const playerSnap = await getDoc(playerRef);

  if (playerSnap.exists()) {
    // 이미 해당 학급에 등록된 경우, 오류 대신 그냥 넘어갈 수 있도록 처리합니다.
    console.warn(`${user.displayName}님은 이미 '${classId}' 학급에 등록되어 있습니다.`);
    return playerSnap.data();
  }

  const playerData = {
    authUid: user.uid,
    id: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    points: 100, // 신규 가입 포인트
    ownedParts: [],
    avatarConfig: {},
    role: 'player',
    status: 'active',
    createdAt: serverTimestamp(),
  };
  await setDoc(playerRef, playerData);
  return playerData;
}

/**
 * [관리자용] 새로운 학급을 생성하고 초대 코드를 발급합니다.
 * @param {string} className - 새로 생성할 학급의 이름
 * @param {object} adminUser - 관리자(생성자)의 Firebase Auth 사용자 객체
 * @returns {object} - 생성된 학급 ID와 초대 코드
 */
export async function createNewClass(className, adminUser) {
  const newClassRef = doc(collection(db, 'classes'));

  // 4자리-4자리 형태의 랜덤 초대 코드 생성
  const inviteCode = `${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  await setDoc(newClassRef, {
    name: className,
    adminId: adminUser.uid,
    createdAt: serverTimestamp(),
    inviteCode: inviteCode,
  });

  // 새 학급에 기본 칭호 데이터를 자동으로 넣어줍니다.
  await seedInitialTitles(newClassRef.id);

  return { classId: newClassRef.id, inviteCode, name: className };
}
// --- 사용자 및 선수 관리 (classId 추가) ---
export async function updateUserProfile(user) {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  }, { merge: true });
}

// ⚠️ 전체 users 컬렉션 조회 - 관리자 기능에서만 사용할 것
// 학급 내 플레이어 목록은 getPlayers(classId)를 사용
export async function getUsers() {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

// 특정 uid들의 user 데이터만 조회 (비용 효율적)
export async function getUsersByUids(uids) {
  if (!uids || uids.length === 0) return [];
  const results = await Promise.all(
    uids.map(uid => getDoc(doc(db, 'users', uid)))
  );
  return results.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() }));
}

export async function linkPlayerToAuth(classId, playerId, authUid, role) {
  if (!classId) return;
  const playerRef = doc(db, 'classes', classId, 'players', playerId);
  await updateDoc(playerRef, { authUid, role });
}

export async function addPlayer(classId, playerData) {
  if (!classId) return;
  const playerRef = doc(db, 'classes', classId, 'players', playerData.authUid);
  await setDoc(playerRef, playerData);
}

export async function getPlayers(classId) {
  if (!classId) return [];
  const playersRef = collection(db, 'classes', classId, 'players');
  const querySnapshot = await getDocs(playersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deletePlayer(classId, playerId) {
  if (!classId) return;
  await deleteDoc(doc(db, 'classes', classId, 'players', playerId));
}

export async function updatePlayerStatus(classId, playerId, status) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId);
  await updateDoc(playerRef, { status });
}

export async function submitSuggestion(classId, suggestionData) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const { studentId, studentName, message } = suggestionData;
  if (!message.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date();
  await addDoc(collection(db, "classes", classId, "suggestions"), {
    studentId,
    studentName,
    message,
    conversation: [
      {
        sender: 'student',
        content: message,
        createdAt: now
      }
    ],
    status: "pending",
    createdAt: now,
    lastMessageAt: now,
  });

  const playersRef = collection(db, 'classes', classId, 'players');
  const adminRecorderQuery = query(playersRef, where('role', 'in', ['admin']));
  const adminRecorderSnapshot = await getDocs(adminRecorderQuery);
  adminRecorderSnapshot.forEach(userDoc => {
    const user = userDoc.data();
    if (user.authUid) {
      createNotification(
        user.authUid,
        '💌 새로운 메시지',
        `${studentName} 학생에게서 새로운 메시지가 도착했습니다.`,
        'suggestion_admin',
        '/admin?tab=messages'
      );
    }
  });
}

export async function getSuggestionsForStudent(classId, studentId) {
  if (!classId || !studentId) return [];
  const q = query(
    collection(db, "classes", classId, "suggestions"),
    where("studentId", "==", studentId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getAllSuggestions(classId) {
  if (!classId) return [];
  const q = query(collection(db, "classes", classId, "suggestions"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function replyToSuggestion(classId, suggestionId, replyContent, studentAuthUid) {
  if (!classId) return;
  if (!replyContent.trim()) {
    throw new Error("답글 내용을 입력해야 합니다.");
  }
  const suggestionRef = doc(db, "classes", classId, "suggestions", suggestionId);

  const replyData = {
    content: replyContent,
    sender: 'admin',
    createdAt: new Date()
  };

  await updateDoc(suggestionRef, {
    conversation: arrayUnion(replyData),
    status: "replied",
    lastMessageAt: serverTimestamp(),
  });

  if (studentAuthUid) {
    createNotification(
      studentAuthUid,
      "💌 선생님의 답변이 도착했습니다.",
      "내가 보낸 메시지를 확인해보세요!",
      "suggestion",
      "/suggestions"
    );
  }
}

export async function uploadAvatarPart(file, category) {
  const storageRef = ref(storage, `avatar-parts/${category}/${file.name}`);
  const uploadResult = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(uploadResult.ref);

  const newPartData = {
    id: file.name,
    category: category,
    src: downloadURL,
    status: 'visible',
    createdAt: serverTimestamp(),
    displayName: file.name.split('.')[0], // 파일명을 기본 표시 이름으로 사용
    price: 0,
    isSale: false,
    salePrice: null,
    originalPrice: null,
    saleStartDate: null,
    saleEndDate: null,
    saleDays: [],
    slot: 'face' // 액세서리를 위한 기본값
  };

  const partDocRef = doc(db, 'avatarParts', file.name);
  await setDoc(partDocRef, newPartData);

  // Firestore에서 반환된 Timestamp 객체를 포함하여 반환해야 로컬 상태와 동기화됩니다.
  const savedDoc = await getDoc(partDocRef);
  return savedDoc.data();
}

export async function updateAvatarPartStatus(partId, status) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { status: status });
}

export async function getAvatarParts() {
  const partsRef = collection(db, 'avatarParts');
  const querySnapshot = await getDocs(partsRef);
  const parts = querySnapshot.docs.map(doc => doc.data());

  // gs:// URL은 브라우저에서 직접 렌더링 불가 → HTTPS downloadURL로 변환
  const resolved = await Promise.all(
    parts.map(async (part) => {
      if (part.src && part.src.startsWith('gs://')) {
        try {
          const storageRef = ref(storage, part.src);
          const downloadUrl = await getDownloadURL(storageRef);
          return { ...part, src: downloadUrl };
        } catch (e) {
          console.warn(`아바타 파트 URL 변환 실패 (${part.id}):`, e);
          return { ...part, src: '' }; // 실패 시 빈 문자열로 안전 처리
        }
      }
      return part;
    })
  );
  return resolved;
}

export async function updateAvatarPartPrice(partId, price) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { price: price });
}

export async function batchUpdateAvatarPartPrices(updates) {
  const batch = writeBatch(db);
  updates.forEach(item => {
    const partRef = doc(db, 'avatarParts', item.id);
    batch.update(partRef, { price: item.price });
  });
  await batch.commit();
}

// ▼▼▼ [신규] 가격과 착용 부위(slot)를 함께 저장하는 함수 ▼▼▼
export async function batchUpdateAvatarPartDetails(priceUpdates, slotUpdates) {
  const batch = writeBatch(db);

  priceUpdates.forEach(item => {
    const partRef = doc(db, 'avatarParts', item.id);
    batch.update(partRef, { price: item.price });
  });

  // slotUpdates가 있을 경우에만 실행
  if (slotUpdates && slotUpdates.length > 0) {
    slotUpdates.forEach(item => {
      const partRef = doc(db, 'avatarParts', item.id);
      batch.update(partRef, { slot: item.slot });
    });
  }

  await batch.commit();
}

export async function batchUpdateSaleInfo(partIds, salePercent, startDate, endDate) {
  const batch = writeBatch(db);

  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    const partSnap = await getDoc(partRef);

    if (partSnap.exists()) {
      const partData = partSnap.data();
      const originalPrice = partData.price;
      const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));

      batch.update(partRef, {
        isSale: true,
        originalPrice: originalPrice,
        salePrice: salePrice,
        saleStartDate: startDate,
        saleEndDate: endDate,
      });
    }
  }
  await batch.commit();
}

export async function batchEndSale(partIds) {
  const batch = writeBatch(db);
  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, {
      isSale: false,
      salePrice: null,
    });
  }
  await batch.commit();
}

// --- 팀 및 경기 관리 (classId 추가) ---
export async function getTeams(classId, seasonId) {
  if (!classId || !seasonId) return [];
  const teamsRef = collection(db, 'classes', classId, 'teams');
  const q = query(teamsRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addTeam(classId, newTeamData) {
  if (!classId) return;
  await addDoc(collection(db, 'classes', classId, 'teams'), newTeamData);
}

export async function deleteTeam(classId, teamId) {
  if (!classId) return;
  await deleteDoc(doc(db, 'classes', classId, 'teams', teamId));
}

export async function uploadTeamEmblem(classId, teamId, file) {
  if (!classId) return;
  const storageRef = ref(storage, `classes/${classId}/team-emblems/${teamId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function updateTeamInfo(classId, teamId, newName, emblemId, emblemUrl) {
  if (!classId) return;
  const teamRef = doc(db, 'classes', classId, 'teams', teamId);
  const updateData = {
    teamName: newName,
    emblemId: emblemId || null,
    emblemUrl: emblemUrl || null
  };
  await updateDoc(teamRef, updateData);
}

export async function updateTeamMembers(classId, teamId, newMembers) {
  if (!classId) return;
  await updateDoc(doc(db, 'classes', classId, 'teams', teamId), { members: newMembers });
}

export async function updateTeamCaptain(classId, teamId, captainId) {
  if (!classId) return;
  const teamRef = doc(db, 'classes', classId, 'teams', teamId);
  await updateDoc(teamRef, { captainId: captainId });
}

export async function batchAddTeams(classId, newTeamsData) {
  if (!classId) return;
  const batch = writeBatch(db);
  const teamsRef = collection(db, 'classes', classId, 'teams');
  newTeamsData.forEach(teamData => {
    const newTeamRef = doc(teamsRef);
    batch.set(newTeamRef, teamData);
  });
  await batch.commit();
}

export async function batchUpdateTeams(classId, teamUpdates) {
  if (!classId) return;
  const batch = writeBatch(db);
  teamUpdates.forEach(update => {
    const teamRef = doc(db, 'classes', classId, 'teams', update.id);
    batch.update(teamRef, {
      members: update.members,
      captainId: update.captainId,
    });
  });
  await batch.commit();
}

export async function getMatches(classId, seasonId) {
  if (!classId || !seasonId) return [];
  const matchesRef = collection(db, 'classes', classId, 'matches');
  // [수정] matchOrder로 정렬: 알고리즘이 계산한 경기 순서 유지
  const q = query(matchesRef, where("seasonId", "==", seasonId), orderBy("matchOrder"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMatchScores(classId, matchId, scores, scorers, recorderId) {
  if (!classId) return;
  const batch = writeBatch(db);
  const matchRef = doc(db, 'classes', classId, 'matches', matchId);
  const matchSnap = await getDoc(matchRef);

  if (!matchSnap.exists()) {
    throw new Error("경기를 찾을 수 없습니다.");
  }
  const matchData = matchSnap.data();

  const RECORDER_REWARD = 100;
  const VICTORY_REWARD = 100;
  const DEFEAT_REWARD = 50;
  const GOAL_REWARD = 20;

  batch.update(matchRef, {
    teamA_score: scores.a,
    teamB_score: scores.b,
    status: '완료',
    scorers: scorers || {},
    rewardPolicy: {
      recorder: RECORDER_REWARD,
      victory: VICTORY_REWARD,
      participation: DEFEAT_REWARD,
      goal: GOAL_REWARD,
    }
  });

  if (recorderId) {
    const playersRef = collection(db, 'classes', classId, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(RECORDER_REWARD) });
      addPointHistory(classId, recorderId, recorderData.name, RECORDER_REWARD, `보너스 (경기 결과 기록)`);
    }
  }
let winningTeamId = null;
  let losingTeamId = null;

  if (scores.a > scores.b) {
    winningTeamId = matchData.teamA_id;
    losingTeamId = matchData.teamB_id;
  } else if (scores.b > scores.a) {
    winningTeamId = matchData.teamB_id;
    losingTeamId = matchData.teamA_id;
  }

  if (winningTeamId) {
    const teamSnap = await getDoc(doc(db, 'classes', classId, 'teams', winningTeamId));
    if (teamSnap.exists()) {
      const winningTeamData = teamSnap.data();
      for (const memberId of winningTeamData.members) {
        const playerRef = doc(db, 'classes', classId, 'players', memberId);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
          batch.update(playerRef, { points: increment(VICTORY_REWARD) });
          addPointHistory(classId, playerData.authUid, playerData.name, VICTORY_REWARD, "가가볼 리그 승리 수당");
          createNotification(playerData.authUid, `🎉 리그 승리! +${VICTORY_REWARD}P`, `'${winningTeamData.teamName}' 팀의 승리를 축하합니다!`, 'point');
        }
      }
    }
  }

  if (losingTeamId) {
    const teamSnap = await getDoc(doc(db, 'classes', classId, 'teams', losingTeamId));
    if (teamSnap.exists()) {
      const losingTeamData = teamSnap.data();
      for (const memberId of losingTeamData.members) {
        const playerRef = doc(db, 'classes', classId, 'players', memberId);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
          batch.update(playerRef, { points: increment(DEFEAT_REWARD) });
          addPointHistory(classId, playerData.authUid, playerData.name, DEFEAT_REWARD, "가가볼 리그 참가 수당");
          createNotification(playerData.authUid, `+${DEFEAT_REWARD}P 획득`, `값진 경기에 대한 참가 수당이 지급되었습니다.`, 'point');
        }
      }
    }
  }

  await batch.commit();
}

export async function updateMatchStartTime(classId, matchId) {
  if (!classId) return;
  const matchRef = doc(db, 'classes', classId, 'matches', matchId);
  await updateDoc(matchRef, { startTime: serverTimestamp() });
}

export async function updateMatchStatus(classId, matchId, newStatus) {
  if (!classId) return;
  const matchRef = doc(db, 'classes', classId, 'matches', matchId);
  await updateDoc(matchRef, { status: newStatus });
}

/**
 * 경기 결과 수정 + 포인트 재정산
 * 기존 승/패 포인트를 회수하고 새 결과에 따라 재지급합니다.
 */
export async function updateMatchScoresWithPointAdjust(classId, matchId, newScores, newScorers) {
  if (!classId) return;

  const VICTORY_REWARD = 100;
  const DEFEAT_REWARD = 50;
  const DRAW_REWARD = 0;
  const GOAL_REWARD = 20;

  const matchRef = doc(db, 'classes', classId, 'matches', matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) throw new Error('경기를 찾을 수 없습니다.');
  const matchData = matchSnap.data();

  const previousRewardPolicy = matchData.rewardPolicy || {};
  const PREVIOUS_VICTORY_REWARD = Number(previousRewardPolicy.victory ?? 50);
  const PREVIOUS_DEFEAT_REWARD = Number(previousRewardPolicy.participation ?? 15);
  const PREVIOUS_DRAW_REWARD = Number(previousRewardPolicy.draw ?? 0);
  const PREVIOUS_GOAL_REWARD = Number(previousRewardPolicy.goal ?? 0);

  const batch = writeBatch(db);

  // 1. 점수 및 scorers 업데이트
  batch.update(matchRef, {
    teamA_score: newScores.a,
    teamB_score: newScores.b,
    scorers: newScorers || {},
    rewardPolicy: {
      victory: VICTORY_REWARD,
      participation: DEFEAT_REWARD,
      draw: DRAW_REWARD,
      goal: GOAL_REWARD,
    },
  });

  // 2. 기존 결과 기반 포인트 회수
  const prevA = matchData.teamA_score ?? 0;
  const prevB = matchData.teamB_score ?? 0;
  let prevWinnerId = null, prevLoserId = null, prevDraw = false;
  if (prevA > prevB) { prevWinnerId = matchData.teamA_id; prevLoserId = matchData.teamB_id; }
  else if (prevB > prevA) { prevWinnerId = matchData.teamB_id; prevLoserId = matchData.teamA_id; }
  else prevDraw = true;

  const getTeamMembers = async (teamId) => {
    if (!teamId) return [];
    const tSnap = await getDoc(doc(db, 'classes', classId, 'teams', teamId));
    if (!tSnap.exists()) return [];
    return tSnap.data().members || [];
  };

  const adjustPoints = async (teamId, deductAmount, addAmount, deductReason, addReason) => {
    const members = await getTeamMembers(teamId);
    for (const memberId of members) {
      const pRef = doc(db, 'classes', classId, 'players', memberId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) continue;
      const pData = pSnap.data();
      const netDiff = addAmount - deductAmount;
      if (netDiff === 0) continue;
      batch.update(pRef, { points: increment(netDiff) });
      const reason = netDiff > 0
        ? `경기 결과 수정 (추가 +${addAmount}P${deductAmount ? ` / 회수 -${deductAmount}P` : ''})`
        : `경기 결과 수정 (회수 -${deductAmount}P${addAmount ? ` / 추가 +${addAmount}P` : ''})`;
      addPointHistory(classId, pData.authUid, pData.name, netDiff, reason);
      createNotification(pData.authUid, `${netDiff > 0 ? '+' : ''}${netDiff}P 경기 결과 수정`, reason, 'point');
    }
  };

  // 새 결과 기반 승/패 팀 결정
  let newWinnerId = null, newLoserId = null, newDraw = false;
  if (newScores.a > newScores.b) { newWinnerId = matchData.teamA_id; newLoserId = matchData.teamB_id; }
  else if (newScores.b > newScores.a) { newWinnerId = matchData.teamB_id; newLoserId = matchData.teamA_id; }
  else newDraw = true;

  // 팀별 예전 지급액 vs 새 지급액 계산
  const getOldReward = (teamId) => {
    if (prevDraw) return 0; // 무승부 시 수당 없음(원래 로직)
    if (teamId === prevWinnerId) return VICTORY_REWARD;
    if (teamId === prevLoserId) return DEFEAT_REWARD;
    return 0;
  };
  const getNewReward = (teamId) => {
    if (newDraw) return DRAW_REWARD;
    if (teamId === newWinnerId) return VICTORY_REWARD;
    if (teamId === newLoserId) return DEFEAT_REWARD;
    return 0;
  };

  const allTeamIds = [...new Set([matchData.teamA_id, matchData.teamB_id].filter(Boolean))];
  for (const teamId of allTeamIds) {
    const oldR = getOldReward(teamId);
    const newR = getNewReward(teamId);
    if (oldR !== newR) {
      await adjustPoints(teamId, oldR, newR, `이전 수당 회수`, `새 결과 수당`);
    }
  }

  await batch.commit();
}

export async function deleteNotification(notificationId) {
  const notificationRef = doc(db, 'notifications', notificationId);
  await deleteDoc(notificationRef);
}

export async function deleteAllNotifications(userId) {
  if (!userId) return;
  const batch = writeBatch(db);
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function deleteMatchesBySeason(classId, seasonId) {
  if (!classId || !seasonId) return;
  const matchesRef = collection(db, 'classes', classId, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function batchAddMatches(classId, newMatchesData) {
  if (!classId) return;
  const batch = writeBatch(db);
  const matchesRef = collection(db, 'classes', classId, 'matches');
  // [수정] matchOrder 필드 추가: 알고리즘이 계산한 경기 순서를 Firestore에 보존
  // orderBy 없이 조회하면 문서 ID 기준으로 뒤섞이므로 반드시 필요
  newMatchesData.forEach((matchData, index) => {
    const newMatchRef = doc(matchesRef);
    batch.set(newMatchRef, { ...matchData, matchOrder: index });
  });
  await batch.commit();
}

// --- 시즌 관리 (classId 추가) ---
export async function getSeasons(classId) {
  if (!classId) return [];
  const seasonsRef = collection(db, 'classes', classId, 'seasons');
  const q = query(seasonsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateSeason(classId, seasonId, dataToUpdate) {
  if (!classId) return;
  const seasonDoc = doc(db, 'classes', classId, 'seasons', seasonId);
  await updateDoc(seasonDoc, dataToUpdate);
}

export async function createNewSeason(classId, seasonName) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  if (!seasonName || !seasonName.trim()) {
    throw new Error("시즌 이름을 입력해야 합니다.");
  }
  await addDoc(collection(db, 'classes', classId, 'seasons'), {
    seasonName: seasonName.trim(),
    status: 'preparing',
    createdAt: serverTimestamp(),
    winningPrize: 0
  });
}

export async function saveAvatarMemorials(classId, seasonId, playersInSeason) {
  if (!classId) return;
  const batch = writeBatch(db);
  playersInSeason.forEach(player => {
    if (player.avatarConfig) {
      const memorialRef = doc(db, 'classes', classId, 'seasons', seasonId, 'memorials', player.id);
      batch.set(memorialRef, {
        playerId: player.id,
        playerName: player.name,
        avatarConfig: player.avatarConfig
      });
    }
  });
  await batch.commit();
}

export async function createPlayerFromUser(classId, user) {
  if (!classId) return;
  const playerRef = doc(db, 'classes', classId, 'players', user.uid);
  const playerData = {
    authUid: user.uid,
    id: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    points: 100,
    ownedParts: [],
    avatarConfig: {},
    role: 'player'
  };
  await setDoc(playerRef, playerData);
}

export async function getTodaysQuizHistory(classId, studentId) {
  if (!classId || !studentId) return [];
  const todayStr = getTodayDateString();
  const historyRef = collection(db, 'classes', classId, 'quiz_history');
  const q = query(historyRef, where('studentId', '==', studentId), where('date', '==', todayStr));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data());
}

export async function submitQuizAnswer(classId, studentId, quizId, userAnswer, correctAnswer) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const isCorrect = userAnswer.trim().toLowerCase() === String(correctAnswer).toLowerCase();
  const QUIZ_EXP_REWARD = 10; // 퀴즈 정답 시 펫 경험치 10 지급

  const historyRef = collection(db, 'classes', classId, 'quiz_history');
  await addDoc(historyRef, {
    studentId, quizId, userAnswer, isCorrect,
    date: getTodayDateString(), timestamp: serverTimestamp(),
  });

  if (isCorrect) {
    const playerRef = doc(db, 'classes', classId, 'players', studentId);
    const playerDoc = await getDoc(playerRef);
    if (playerDoc.exists()) {
      const playerData = playerDoc.data();
      await adjustPlayerPoints(classId, studentId, 50, `'${quizId}' 퀴즈 정답`);

      // ▼▼▼ [수정] 아래 한 줄이 누락되었습니다! 이 코드를 다시 추가합니다. ▼▼▼
      if (playerData.pets && playerData.pets.length > 0) {
        await updatePetExperience(playerRef, QUIZ_EXP_REWARD);
      }

      await checkAndGrantAutoTitles(classId, studentId, playerData.authUid);
    }
  }
  return isCorrect;
}

export async function createMission(classId, missionData) {
  if (!classId) return;
  const missionsRef = collection(db, 'classes', classId, 'missions');
  const { reward, ...restOfData } = missionData;
  const docRef = await addDoc(missionsRef, {
    ...restOfData,
    reward: missionData.rewards[0] || 0,
    createdAt: new Date(),
    status: 'active',
    displayOrder: Date.now(),
    placeholderText: missionData.placeholderText || ''
  });
  return docRef.id;
}

export async function getMissions(classId) {
  if (!classId) return [];
  const missionsRef = collection(db, 'classes', classId, 'missions'); // ✅ classId 경로 추가
  // '활성'과 '숨김' 상태의 모든 미션을 가져옵니다. (삭제된 미션 제외)
  const q = query(missionsRef, where("status", "in", ["active", "archived"]));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * [수정] 미션 갤러리를 위해 승인된 제출물을 페이지별로 가져옵니다.
 * @param {number} limitCount - 한 번에 불러올 게시물 수
 * @param {object|null} lastVisible - 마지막으로 불러온 문서 (다음 페이지의 시작점)
 */
/**
 * [수정] 미션 갤러리를 위해 승인된 모든 제출물을 가져옵니다. (페이지네이션 제거)
 */
export async function getApprovedSubmissions(classId) {
  if (!classId) return [];
  const submissionsRef = collection(db, "classes", classId, "missionSubmissions"); // ✅ classId 경로 추가
  const q = query(submissionsRef, where("status", "==", "approved"), orderBy("approvedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function batchUpdateMissionOrder(classId, reorderedMissions) {
  if (!classId) return;
  const batch = writeBatch(db);
  reorderedMissions.forEach((mission, index) => {
    const missionRef = doc(db, 'classes', classId, 'missions', mission.id); // ✅ classId 경로 추가
    batch.update(missionRef, { displayOrder: index });
  });
  await batch.commit();
}

export async function checkMissionForStudent(missionId, studentId, recorderId) {
  const submissionRef = collection(db, 'missionSubmissions');
  const q = query(submissionRef, where("missionId", "==", missionId), where("studentId", "==", studentId));
  const existingSubmission = await getDocs(q);

  if (!existingSubmission.empty) {
    throw new Error("이미 확인 요청된 미션입니다.");
  }

  await addDoc(submissionRef, {
    missionId,
    studentId,
    checkedBy: recorderId,
    status: 'pending',
    createdAt: new Date(),
  });
}

// 미션 수정 함수
export async function updateMission(classId, missionId, missionData) {
  if (!classId) return;
  // 수정: doc 경로에 'classes', classId 추가
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);
  await updateDoc(missionRef, missionData);
}

export async function getMissionSubmissions(classId) {
  if (!classId) return [];
  const submissionsRef = collection(db, 'classes', classId, 'missionSubmissions');
  const q = query(submissionsRef, orderBy("requestedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMissionStatus(classId, missionId, status) {
  if (!classId) return;
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);
  await updateDoc(missionRef, { status });
}

// --- 아바타 파츠 기타 ---
// --- 아바타 파츠 기타 (classId 추가) ---
export async function updateAvatarPartDisplayName(partId, displayName) {
  // avatarParts는 최상위 컬렉션 유지
  const partRef = doc(db, "avatarParts", partId);
  await updateDoc(partRef, { displayName });
}

export async function batchUpdateSaleDays(partIds, saleDays) {
  const batch = writeBatch(db);
  for (const partId of partIds) {
    // avatarParts는 최상위 컬렉션 유지
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, {
      saleDays: saleDays,
    });
  }
  await batch.commit();
}

export async function buyMultipleAvatarParts(classId, playerId, partsToBuy) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  if (!partsToBuy || partsToBuy.length === 0) {
    throw new Error("구매할 아이템이 없습니다.");
  }

  const playerRef = doc(db, "classes", classId, "players", playerId);

  try {
    await runTransaction(db, async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      if (!playerDoc.exists()) {
        throw new Error("플레이어를 찾을 수 없습니다.");
      }

      const playerData = playerDoc.data();
      const totalCost = partsToBuy.reduce((sum, part) => sum + part.price, 0);

      if (playerData.points < totalCost) {
        throw new Error("포인트가 부족합니다.");
      }

      const newPartIds = partsToBuy.map(part => part.id);
      const alreadyOwned = newPartIds.some(id => playerData.ownedParts?.includes(id));
      if (alreadyOwned) {
        throw new Error("이미 소유한 아이템이 구매 목록에 포함되어 있습니다.");
      }

      const newPoints = playerData.points - totalCost;
      transaction.update(playerRef, {
        points: newPoints,
        ownedParts: arrayUnion(...newPartIds)
      });

      for (const part of partsToBuy) {
        addPointHistory(
          classId,
          playerData.authUid,
          playerData.name,
          -part.price,
          `${part.displayName || part.id} 구매`
        );
      }
    });

    return "선택한 아이템을 모두 구매했습니다!";
  } catch (error) {
    console.error("일괄 구매 트랜잭션 실패:", error);
    throw error;
  }
}

export async function buyMyRoomItem(classId, playerId, item) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);

  return runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("플레이어 정보를 찾을 수 없습니다.");
    }
    const playerData = playerDoc.data();

    const now = new Date();
    let finalPrice = item.price;
    if (item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate()) {
      finalPrice = item.salePrice;
    }

    if (playerData.points < finalPrice) {
      throw new Error("포인트가 부족합니다.");
    }
    if (playerData.ownedMyRoomItems?.includes(item.id)) {
      throw new Error("이미 소유하고 있는 아이템입니다.");
    }

    transaction.update(playerRef, {
      points: increment(-finalPrice),
      ownedMyRoomItems: arrayUnion(item.id)
    });

    await addPointHistory(
      classId,
      playerData.authUid,
      playerData.name,
      -finalPrice,
      `마이룸 아이템 '${item.displayName || item.id}' 구매`
    );
  });
}

// [이슈 4] 마이룸 아이템 다중 구매 함수
export async function buyMultipleMyRoomItems(classId, playerId, items) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const now = new Date();

  const getFinalPrice = (item) => {
    if (item.isSale && item.saleStartDate?.toDate() < now && now < item.saleEndDate?.toDate()) {
      return item.salePrice;
    }
    return item.price;
  };

  const totalCost = items.reduce((sum, item) => sum + getFinalPrice(item), 0);
  const itemIds = items.map(i => i.id);

  let playerAuthUid = null;
  let playerName = null;

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();

    if (playerData.points < totalCost) throw new Error("포인트가 부족합니다.");

    const alreadyOwned = itemIds.filter(id => playerData.ownedMyRoomItems?.includes(id));
    if (alreadyOwned.length > 0) throw new Error(`이미 소유한 아이템이 포함되어 있습니다.`);

    playerAuthUid = playerData.authUid;
    playerName = playerData.name;

    transaction.update(playerRef, {
      points: increment(-totalCost),
      ownedMyRoomItems: [...(playerData.ownedMyRoomItems || []), ...itemIds]
    });
  });

  await addPointHistory(
    classId,
    playerAuthUid,
    playerName,
    -totalCost,
    `마이룸 아이템 ${items.length}개 구매`
  );
}

export async function updatePlayerProfile(classId, playerId, profileData) {
  if (!classId) return;
  if (profileData.name && profileData.name.trim().length === 0) {
    throw new Error("이름을 비워둘 수 없습니다.");
  }
  const playerRef = doc(db, "classes", classId, "players", playerId);
  await updateDoc(playerRef, profileData);
}

// --- 학급 공동 목표 (classId 추가) ---
export async function createClassGoal(classId, goalData) {
  if (!classId) return;
  await addDoc(collection(db, "classes", classId, "classGoals"), {
    ...goalData,
    currentPoints: 0,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function getActiveGoals(classId) {
  if (!classId) return [];
  const goalsRef = collection(db, "classes", classId, "classGoals");
  const q = query(goalsRef, where("status", "in", ["active", "paused"]), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);

  const goals = [];
  for (const goalDoc of querySnapshot.docs) {
    const goalData = { id: goalDoc.id, ...goalDoc.data() };
    const contributionsRef = collection(db, "classes", classId, "classGoals", goalDoc.id, "contributions");
    const contributionsSnap = await getDocs(contributionsRef);
    goalData.contributions = contributionsSnap.docs.map(doc => doc.data());
    goals.push(goalData);
  }
  return goals;
}

export async function donatePointsToGoal(classId, playerId, goalId, amount) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  if (amount <= 0) throw new Error("기부할 포인트를 올바르게 입력해주세요.");
  if (amount % 10 !== 0) throw new Error("10P 단위로만 기부할 수 있습니다.");

  // 오늘 이미 기부한 금액 확인 (하루 500P 상한)
  const todayStr = getTodayDateString();
  const contribsRef = collection(db, 'classes', classId, 'classGoals', goalId, 'contributions');
  const todayQuery = query(contribsRef,
    where('playerId', '==', playerId),
    where('date', '==', todayStr)
  );
  const todaySnap = await getDocs(todayQuery);
  const todayTotal = todaySnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
  const DAILY_LIMIT = 500;
  if (todayTotal >= DAILY_LIMIT) throw new Error(`오늘은 이미 최대 기부액(${DAILY_LIMIT}P)을 달성했습니다.`);
  if (todayTotal + amount > DAILY_LIMIT) {
    throw new Error(`오늘 남은 기부 가능액은 ${DAILY_LIMIT - todayTotal}P입니다.`);
  }

  const playerRef = doc(db, "classes", classId, "players", playerId);
  const goalRef = doc(db, "classes", classId, "classGoals", goalId);
  const contributionRef = doc(collection(db, "classes", classId, "classGoals", goalId, "contributions"));

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    const goalDoc = await transaction.get(goalRef);

    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    if (!goalDoc.exists()) throw new Error("존재하지 않는 목표입니다.");

    const playerData = playerDoc.data();
    const goalData = goalDoc.data();

    if (goalData.status === 'paused') {
      throw new Error("현재 기부가 일시중단된 목표입니다.");
    }
    if (goalData.status === 'completed' || goalData.currentPoints >= goalData.targetPoints) {
      throw new Error("이미 달성된 목표입니다.");
    }
    if (playerData.points < amount) {
      throw new Error("포인트가 부족합니다.");
    }

    transaction.update(playerRef, { points: increment(-amount) });
    const newTotalPoints = goalData.currentPoints + amount;
    transaction.update(goalRef, { currentPoints: increment(amount) });

    transaction.set(contributionRef, {
      classId,
      playerId,
      playerName: playerData.name,
      amount: amount,
      date: getTodayDateString(),
      timestamp: serverTimestamp()
    });

    addPointHistory(
      classId,
      playerData.authUid,
      playerData.name,
      -amount,
      `'${goalData.title}' 목표에 기부`
    );

    if (newTotalPoints >= goalData.targetPoints) {
      const allPlayers = await getPlayers(classId);
      allPlayers.forEach(p => {
        if (p.authUid) {
          createNotification(
            p.authUid,
            `🎉 목표 달성: ${goalData.title}`,
            "우리 반 공동 목표를 달성했습니다! 모두 축하해주세요!",
            'goal'
          );
        }
      });
    }

    await checkAndGrantAutoTitles(classId, playerId, playerData.authUid);
  });
}

export async function updateClassGoalStatus(classId, goalId, newStatus) {
  if (!classId) return;
  const goalRef = doc(db, "classes", classId, "classGoals", goalId); // ✅ classId 경로 추가
  await updateDoc(goalRef, { status: newStatus });
}

export async function completeClassGoal(classId, goalId) {
  if (!classId) return;
  const goalRef = doc(db, "classes", classId, "classGoals", goalId); // ✅ classId 경로 추가
  await updateDoc(goalRef, { status: "completed" });
}

export async function deleteClassGoal(classId, goalId) {
  if (!classId) return;
  const goalRef = doc(db, "classes", classId, "classGoals", goalId); // ✅ classId 경로 추가
  await deleteDoc(goalRef);
}

export async function batchDeleteAvatarParts(partsToDelete) {
  const batch = writeBatch(db);

  for (const part of partsToDelete) {
    const partRef = doc(db, "avatarParts", part.id);
    batch.delete(partRef);

    const imageRef = ref(storage, part.src);
    try {
      await deleteObject(imageRef);
    } catch (error) {
      console.error("이미지 파일 삭제 실패 (이미 존재하지 않을 수 있음):", error);
    }
  }

  await batch.commit();
}

// --- 마이룸 아이템 세일 관리 ---

export async function batchUpdateMyRoomItemSaleInfo(itemIds, salePercent, startDate, endDate) {
  const batch = writeBatch(db);

  for (const itemId of itemIds) {
    const itemRef = doc(db, "myRoomItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (itemSnap.exists()) {
      const itemData = itemSnap.data();
      const originalPrice = itemData.price;
      const salePrice = Math.floor(originalPrice * (1 - salePercent / 100));

      batch.update(itemRef, {
        isSale: true,
        originalPrice: originalPrice,
        salePrice: salePrice,
        saleStartDate: startDate,
        saleEndDate: endDate,
      });
    }
  }
  await batch.commit();
}

export async function batchEndMyRoomItemSale(itemIds) {
  const batch = writeBatch(db);
  for (const itemId of itemIds) {
    const itemRef = doc(db, "myRoomItems", itemId);
    batch.update(itemRef, {
      isSale: false,
      salePrice: null,
      originalPrice: null,
      saleStartDate: null,
      saleEndDate: null,
    });
  }
  await batch.commit();
}

export async function batchUpdateMyRoomItemSaleDays(itemIds, saleDays) {
  const batch = writeBatch(db);
  for (const itemId of itemIds) {
    const itemRef = doc(db, "myRoomItems", itemId);
    batch.update(itemRef, {
      saleDays: saleDays,
    });
  }
  await batch.commit();
}


// --- 알림 관련 ---
export async function createNotification(userId, title, body, type, link = null, data = null) {
  if (!userId) return;
  const notificationData = {
    userId,
    title,
    body,
    type,
    link,
    isRead: false,
    createdAt: serverTimestamp(),
  };
  if (data) {
    notificationData.data = data;
  }
  await addDoc(collection(db, 'notifications'), notificationData);
}

export async function getNotificationsForUser(userId) {
  if (!userId) return [];
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function markNotificationsAsRead(userId) {
  const notifsRef = collection(db, 'notifications');
  const q = query(notifsRef, where('userId', '==', userId), where('isRead', '==', false));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return;

  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.update(doc.ref, { isRead: true });
  });
  await batch.commit();
}

// --- 출석 체크 관련 함수 ---
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function isAttendanceRewardAvailable(classId, playerId) {
  if (!classId) return false;
  const playerRef = doc(db, "classes", classId, "players", playerId); // ✅ classId 경로 추가
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) {
    console.error("출석 체크 대상 플레이어를 찾을 수 없습니다.");
    return false;
  }
  const playerData = playerSnap.data();
  const todayStr = getTodayDateString();
  return playerData.lastAttendance !== todayStr;
}

export async function grantAttendanceReward(classId, playerId, rewardAmount) {
  if (!classId) return;
  const isAvailable = await isAttendanceRewardAvailable(classId, playerId);
  if (!isAvailable) {
    throw new Error("이미 오늘 출석 보상을 받았습니다.");
  }

  const playerRef = doc(db, "classes", classId, "players", playerId); // ✅ classId 경로 추가
  const todayStr = getTodayDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const playerDoc = await getDoc(playerRef);
  if (!playerDoc.exists()) return;
  const playerData = playerDoc.data();

  let consecutiveDays = playerData.consecutiveAttendanceDays || 0;
  if (playerData.lastAttendance === yesterdayStr) {
    consecutiveDays += 1;
  } else {
    consecutiveDays = 1;
  }

  await updateDoc(playerRef, {
    points: increment(rewardAmount),
    lastAttendance: todayStr,
    consecutiveAttendanceDays: consecutiveDays,
    totalAttendanceDays: increment(1),  // [추가] 누적 출석일 카운트
  });

  await addPointHistory( // ✅ classId 전달
    classId,
    playerData.authUid,
    playerData.name,
    rewardAmount,
    "출석 체크 보상"
  );

  createNotification(
    playerData.authUid,
    "🎉 출석 체크 완료!",
    `오늘의 출석 보상으로 ${rewardAmount}P를 획득했습니다. (${consecutiveDays}일 연속 출석)`,
    'attendance'
  );

  await checkAndGrantAutoTitles(classId, playerId, playerData.authUid); // ✅ classId 전달
}

export async function getAvatarMemorials(classId, seasonId) {
  if (!classId) return [];
  const memorialsRef = collection(db, 'classes', classId, 'seasons', seasonId, 'memorials'); // ✅ classId 경로 추가
  const querySnapshot = await getDocs(memorialsRef);
  return querySnapshot.docs.map(doc => doc.data());
}

// [수정] 선수의 전체 시즌 기록(득점, 경기목록, 순위 포함)을 가져오는 함수
export async function getPlayerSeasonStats(classId, playerId) {
  if (!classId || !playerId) return [];

  const allSeasons = await getSeasons(classId); // ✅ classId 전달
  const statsBySeason = {};

  for (const season of allSeasons) {
    const seasonId = season.id;
    const allTeamsInSeason = await getTeams(classId, seasonId); // ✅ classId 전달
    const playerTeam = allTeamsInSeason.find(t => t.members.includes(playerId));

    if (playerTeam) {
      const memorialsRef = collection(db, 'classes', classId, 'seasons', seasonId, 'memorials'); // ✅ classId 경로 추가
      const memorialsSnap = await getDocs(memorialsRef);
      const memorialsMap = new Map(memorialsSnap.docs.map(doc => [doc.id, doc.data().avatarConfig]));
      // [수정 끝]

      const allMatchesInSeason = await getMatches(classId, seasonId); // ✅ classId 전달
      const completedMatches = allMatchesInSeason.filter(m => m.status === '완료');

      const seasonScorers = {};
      completedMatches.forEach(match => {
        if (match.scorers) {
          for (const [pId, goals] of Object.entries(match.scorers)) {
            seasonScorers[pId] = (seasonScorers[pId] || 0) + goals;
          }
        }
      });

      const topScorerGoals = Math.max(0, ...Object.values(seasonScorers));
      const isTopScorer = (seasonScorers[playerId] || 0) === topScorerGoals && topScorerGoals > 0;

      let standings = allTeamsInSeason.map(t => ({
        id: t.id, teamName: t.teamName, points: 0, goalDifference: 0, goalsFor: 0,
      }));

      completedMatches.forEach(match => {
        const teamA = standings.find(t => t.id === match.teamA_id);
        const teamB = standings.find(t => t.id === match.teamB_id);
        if (!teamA || !teamB) return;
        teamA.goalsFor += match.teamA_score;
        teamB.goalsFor += match.teamB_score;
        teamA.goalDifference += match.teamA_score - match.teamB_score;
        teamB.goalDifference += match.teamB_score - match.teamA_score;
        if (match.teamA_score > match.teamB_score) teamA.points += 3;
        else if (match.teamB_score > match.teamA_score) teamB.points += 3;
        else { teamA.points++; teamB.points++; }
      });

      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });

      const myRank = standings.findIndex(t => t.id === playerTeam.id) + 1;

      const myCompletedMatches = completedMatches.filter(m => m.teamA_id === playerTeam.id || m.teamB_id === playerTeam.id);
      const stats = { wins: 0, draws: 0, losses: 0, played: myCompletedMatches.length, goals: seasonScorers[playerId] || 0 };

      myCompletedMatches.forEach(match => {
        const isTeamA = match.teamA_id === playerTeam.id;
        const myScore = isTeamA ? match.teamA_score : match.teamB_score;
        const opponentScore = isTeamA ? match.teamB_score : match.teamA_score;

        if (myScore > opponentScore) stats.wins++;
        else if (myScore < opponentScore) stats.losses++;
        else stats.draws++;
      });

      // [수정] 불러온 모든 박제 정보를 statsBySeason 객체에 포함시킵니다.
      statsBySeason[seasonId] = {
        season,
        team: playerTeam,
        rank: myRank,
        isTopScorer,
        stats,
        matches: myCompletedMatches,
        memorialsMap, // memorialsMap을 여기에 포함
      };
    }
  }

  return Object.values(statsBySeason).sort((a, b) => b.season.createdAt.toMillis() - a.season.createdAt.toMillis());
}

/**
 * 특정 마이룸에 '좋아요'를 누르고 보상을 지급합니다. (월 1회)
 * @param {string} roomId - '좋아요'를 받을 마이룸의 주인 플레이어 ID
 * @param {string} likerId - '좋아요'를 누르는 플레이어 ID
 * @param {string} likerName - '좋아요'를 누르는 플레이어 이름
 */
export async function likeMyRoom(classId, roomId, likerId, likerName) {
  // AUTO_TITLE_RECHECK_MYROOM_LIKES_V3
  if (!classId) throw new Error("학급 정보가 없습니다.");

  const roomOwnerRef = doc(db, "classes", classId, "players", roomId);
  const likerRef = doc(db, "classes", classId, "players", likerId);
  const likeHistoryRef = doc(db, "classes", classId, "players", roomId, "myRoomLikes", likerId);
  const likesCollectionRef = collection(db, "classes", classId, "players", roomId, "myRoomLikes");

  const currentMonth = new Date().toISOString().slice(0, 7);

  // 기존 누적 필드가 없는 반을 위해 현재 남아 있는 unique 좋아요 문서 수를 baseline으로 사용합니다.
  // 이미 같은 친구가 이전 달에 여러 번 눌렀던 기록은 문서가 덮어써져 복구할 수 없지만,
  // 현재 남아 있는 친구 수에서 1부터 다시 시작하는 문제는 막습니다.
  const existingLikesSnapshot = await getDocs(likesCollectionRef);
  const existingUniqueLikeCount = existingLikesSnapshot.size;

  let roomOwnerName = '친구';
  let roomOwnerAuthUid = null;
  let nextMyRoomLikesTotal = null;

  await runTransaction(db, async (transaction) => {
    const likeHistorySnap = await transaction.get(likeHistoryRef);
    if (likeHistorySnap.exists() && likeHistorySnap.data().lastLikedMonth === currentMonth) {
      throw new Error("이번 달에는 이미 '좋아요'를 눌렀습니다.");
    }

    const roomOwnerSnap = await transaction.get(roomOwnerRef);
    if (!roomOwnerSnap.exists()) throw new Error("방 주인의 정보를 찾을 수 없습니다.");

    const roomOwnerData = roomOwnerSnap.data();
    roomOwnerName = roomOwnerData.name || '친구';
    roomOwnerAuthUid = roomOwnerData.authUid || roomId;

    const currentMyRoomLikesTotal = Number(roomOwnerData.myRoomLikesTotal || 0);
    nextMyRoomLikesTotal = Math.max(currentMyRoomLikesTotal, existingUniqueLikeCount) + 1;

    transaction.update(likerRef, { points: increment(100) });

    transaction.update(roomOwnerRef, {
      myRoomLikesTotal: nextMyRoomLikesTotal,
      totalLikes: increment(1)
    });

    transaction.set(likeHistoryRef, {
      likerName,
      lastLikedMonth: currentMonth,
      timestamp: serverTimestamp()
    }, { merge: true });
  });

  await addPointHistory(classId, likerId, likerName, 100, `${roomOwnerName}의 마이룸 '좋아요' 보상`);

  if (roomOwnerAuthUid) {
    createNotification(
      roomOwnerAuthUid,
      `❤️ ${likerName}님이 내 마이룸을 좋아합니다!`,
      "내 마이룸을 방문해서 확인해보세요!",
      "myroom_like",
      `/my-room/${roomId}`
    );
  }

  await checkAndGrantAutoTitles(classId, roomId, roomOwnerAuthUid);

  return { myRoomLikesTotal: nextMyRoomLikesTotal };
}



/**
 * 마이룸에 댓글을 작성합니다.
 * @param {string} roomId - 댓글이 달릴 마이룸의 주인 플레이어 ID
 * @param {object} commentData - 댓글 데이터 (commenterId, commenterName, text)
 */
export async function addMyRoomComment(classId, roomId, commentData) {
  if (!classId) return;
  const commentsRef = collection(db, "classes", classId, "players", roomId, "myRoomComments");
  // 🔽 [수정] commentData와 함께 classId를 명시적으로 추가합니다.
  await addDoc(commentsRef, { ...commentData, classId, createdAt: serverTimestamp(), likes: [] });

  // 마이룸 주인에게 알림 전송
  const roomOwnerDoc = await getDoc(doc(db, "classes", classId, "players", roomId));
  if (roomOwnerDoc.exists()) {
    const roomOwnerData = roomOwnerDoc.data();
    createNotification(
      roomOwnerData.authUid,
      `💬 ${commentData.commenterName}님이 댓글을 남겼습니다.`,
      `"${commentData.text}"`,
      "myroom_comment",
      `/my-room/${roomId}`
    );
  }
}

/**
 * 마이룸 댓글에 '좋아요'를 누르고, 방 주인이 누를 경우에만 보상을 지급합니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - '좋아요'를 받을 댓글 ID
 * @param {string} likerId - '좋아요'를 누르는 사람 ID
 */
export async function likeMyRoomComment(classId, roomId, commentId, likerId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);
  const roomOwnerRef = doc(db, "classes", classId, "players", roomId);

  let rewardNeeded = false;
  let commenterAuthUid = null;
  let commenterName = null;

  await runTransaction(db, async (transaction) => {
    const commentSnap = await transaction.get(commentRef);
    const roomOwnerSnap = await transaction.get(roomOwnerRef);

    if (!commentSnap.exists()) throw new Error("댓글을 찾을 수 없습니다.");
    if (!roomOwnerSnap.exists()) throw new Error("방 주인 정보를 찾을 수 없습니다.");

    const commentData = commentSnap.data();
    const roomOwnerData = roomOwnerSnap.data();
    const likes = commentData.likes || [];
    if (likes.includes(likerId)) return;

    // [방어 1] 자기 추천 금지
    const isRoomOwnerLiking = likerId === roomId;
    const isNotSelfComment = commentData.commenterId !== roomId;

    // [방어 2] 일일 한도(10회) 및 특정인 중복 보상 방지
    const todayStr = new Date().toLocaleDateString();
    let dailyRewardCount = roomOwnerData.dailyCommentRewardCount || 0;
    let dailyRewardedUsers = roomOwnerData.dailyCommentRewardedUsers || [];

    if (roomOwnerData.lastCommentRewardDate !== todayStr) {
      dailyRewardCount = 0;
      dailyRewardedUsers = [];
    }

    const alreadyRewardedThisUser = dailyRewardedUsers.includes(commentData.commenterId);
    const shouldReward = isRoomOwnerLiking && isNotSelfComment && (dailyRewardCount < 10) && !alreadyRewardedThisUser;

    if (shouldReward) {
      const commenterRef = doc(db, "classes", classId, "players", commentData.commenterId);
      const commenterSnap = await transaction.get(commenterRef);
      if (commenterSnap.exists()) {
        commenterAuthUid = commenterSnap.data().authUid;
        commenterName = commenterSnap.data().name;
        rewardNeeded = true;

        transaction.update(commenterRef, { points: increment(30), totalLikes: increment(1) });

        // 방 주인의 지급 기록 업데이트
        transaction.update(roomOwnerRef, {
          dailyCommentRewardCount: dailyRewardCount + 1,
          dailyCommentRewardedUsers: [...dailyRewardedUsers, commentData.commenterId],
          lastCommentRewardDate: todayStr
        });
      }
    }

    transaction.update(commentRef, { likes: [...likes, likerId] });
  });

  if (rewardNeeded && commenterAuthUid) {
    await addPointHistory(classId, commenterAuthUid, commenterName, 30, "칭찬 댓글 '좋아요' 보상");
    await createOrUpdateAggregatedNotification(
      commenterAuthUid,
      "comment_like",
      30,
      "❤️ 내 댓글에 '좋아요'를 받았어요!",
      "칭찬 댓글 보상으로 {amount}P를 획득했습니다!"
    );
  }
}


/**
 * 마이룸 대댓글에 '좋아요'를 누르고 방 주인에게 보상을 지급합니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 댓글 ID
 * @param {object} reply - '좋아요'를 받을 답글 객체
 * @param {string} likerId - '좋아요'를 누르는 사람 (원본 댓글 작성자) ID
 */
export async function likeMyRoomReply(classId, roomId, commentId, reply, likerId) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);
  const roomOwnerRef = doc(db, "classes", classId, "players", roomId);

  let shouldReward = false;
  let roomOwnerName = '';

  await runTransaction(db, async (transaction) => {
    const commentSnap = await transaction.get(commentRef);
    const roomOwnerSnap = await transaction.get(roomOwnerRef);

    if (!commentSnap.exists()) throw new Error("댓글을 찾을 수 없습니다.");
    if (!roomOwnerSnap.exists()) throw new Error("방 주인 정보를 찾을 수 없습니다.");

    const commentData = commentSnap.data();
    const replies = commentData.replies || [];
    const replyIndex = replies.findIndex(r =>
      r.createdAt?.toDate().getTime() === reply.createdAt?.toDate().getTime() && r.text === reply.text
    );

    if (replyIndex === -1) throw new Error("답글을 찾을 수 없습니다.");
    if (replies[replyIndex].likes?.includes(likerId)) throw new Error("이미 '좋아요'를 누른 답글입니다.");

    const roomOwnerData = roomOwnerSnap.data();
    roomOwnerName = roomOwnerData.name;

    // [방어 1] 내(방 주인)가 쓴 글이고, 내가 누른 하트가 아닐 것
    const isReplyByRoomOwner = replies[replyIndex].replierId === roomId;
    const isNotSelfLike = likerId !== roomId;

    // [방어 2] 일일 한도(10회) 및 동일 친구 하트 중복 보상 방지
    const todayStr = new Date().toLocaleDateString();
    let dailyReplyRewardCount = roomOwnerData.dailyReplyRewardCount || 0;
    let dailyReplyRewardedUsers = roomOwnerData.dailyReplyRewardedUsers || []; // 하트를 눌러준 사람 목록

    if (roomOwnerData.lastReplyRewardDate !== todayStr) {
      dailyReplyRewardCount = 0;
      dailyReplyRewardedUsers = [];
    }

    const alreadyRewardedByThisUser = dailyReplyRewardedUsers.includes(likerId);

    if (isReplyByRoomOwner && isNotSelfLike && (dailyReplyRewardCount < 10) && !alreadyRewardedByThisUser) {
      transaction.update(roomOwnerRef, {
        points: increment(15),
        totalLikes: increment(1),
        dailyReplyRewardCount: dailyReplyRewardCount + 1,
        dailyReplyRewardedUsers: [...dailyReplyRewardedUsers, likerId],
        lastReplyRewardDate: todayStr
      });
      shouldReward = true;
    }

    replies[replyIndex] = {
      ...replies[replyIndex],
      likes: [...(replies[replyIndex].likes || []), likerId]
    };
    transaction.update(commentRef, { replies });
  });

  if (shouldReward) {
    await addPointHistory(classId, roomId, roomOwnerName, 15, "내 답글 '좋아요' 보상");
  }
}

/**
 * 특정 마이룸의 모든 댓글을 불러옵니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @returns {Array<object>} - 댓글 목록
 */
export async function getMyRoomComments(classId, roomId) {
  if (!classId) return [];
  const commentsRef = collection(db, "classes", classId, "players", roomId, "myRoomComments");
  const q = query(commentsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


/**
 * [관리자용] 모든 마이룸의 모든 댓글을 불러옵니다.
 * @param {string} classId - 학급 ID
 * @returns {Array<object>} - 모든 댓글 목록
 */
export async function getAllMyRoomComments(classId) {
  if (!classId) return [];
  const commentsQuery = query(collectionGroup(db, 'myRoomComments'), where('classId', '==', classId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(commentsQuery);
  return querySnapshot.docs.map(doc => {
    const parentPath = doc.ref.parent.parent.path;
    const roomId = parentPath.split('/').pop();
    return { id: doc.id, roomId, ...doc.data() };
  });
}

/**
 * [관리자용] 특정 마이룸의 댓글을 삭제합니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 삭제할 댓글 ID
 */
export async function deleteMyRoomComment(classId, roomId, commentId) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);
  await deleteDoc(commentRef);
}

/**
 * [관리자용] 특정 마이룸의 대댓글을 삭제합니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 댓글 ID
 * @param {object} replyToDelete - 삭제할 답글 객체
 */
export async function deleteMyRoomReply(classId, roomId, commentId, replyToDelete) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);
  const commentSnap = await getDoc(commentRef);
  if (commentSnap.exists()) {
    const commentData = commentSnap.data();
    const updatedReplies = (commentData.replies || []).filter(reply =>
      !(reply.createdAt.isEqual(replyToDelete.createdAt) && reply.text === replyToDelete.text)
    );
    await updateDoc(commentRef, { replies: updatedReplies });
  }
}

/**
 * 마이룸 댓글에 답글(대댓글)을 작성합니다.
 * @param {string} classId - 학급 ID
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 답글을 달 댓글 ID
 * @param {object} replyData - 답글 데이터 (replierId, replierName, text)
 */
export async function addMyRoomReply(classId, roomId, commentId, replyData) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);
  const commentSnap = await getDoc(commentRef);

  if (!commentSnap.exists()) {
    throw new Error("원본 댓글을 찾을 수 없습니다.");
  }
  const commentData = commentSnap.data();

  const reply = {
    ...replyData,
    createdAt: new Date(),
    likes: []
  };

  await updateDoc(commentRef, {
    replies: arrayUnion(reply)
  });

  createNotification(
    commentData.commenterId,
    `💬 ${replyData.replierName}님이 내 댓글에 답글을 남겼습니다.`,
    `"${replyData.text}"`,
    "myroom_reply",
    `/my-room/${roomId}`
  );
}


async function createOrUpdateAggregatedNotification(userId, type, amount, title, bodyTemplate) {
  if (!userId) return;

  const notifsRef = collection(db, 'notifications');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const q = query(
    notifsRef,
    where('userId', '==', userId),
    where('type', '==', type),
    where('isRead', '==', false),
    where('createdAt', '>=', fiveMinutesAgo),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    // 5분 내에 읽지 않은 동일 타입의 알림이 있으면, 해당 알림을 업데이트
    const existingNotifDoc = querySnapshot.docs[0];
    const existingNotifData = existingNotifDoc.data();
    const existingAmount = existingNotifData.aggregatedAmount || 0;
    const newAmount = existingAmount + amount;

    await updateDoc(existingNotifDoc.ref, {
      body: bodyTemplate.replace('{amount}', newAmount),
      createdAt: serverTimestamp(), // 최신 시간으로 갱신
      aggregatedAmount: newAmount,
      aggregationCount: (existingNotifData.aggregationCount || 1) + 1
    });
  } else {
    // 없으면 새로 생성
    await addDoc(notifsRef, {
      userId,
      title,
      body: bodyTemplate.replace('{amount}', amount),
      type,
      link: null,
      isRead: false,
      createdAt: serverTimestamp(),
      aggregatedAmount: amount,
      aggregationCount: 1
    });
  }
}

// =================================================================
// ▼▼▼ 3단계 '하우징 시스템' 신규 추가 함수들 ▼▼▼
// =================================================================

// --- 마이룸 아이템(가구 등) 관리 ---

/**
 * 관리자가 새로운 마이룸 아이템을 Storage에 업로드하고 Firestore에 정보를 등록합니다.
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} category - 아이템 카테고리 (바닥, 벽지, 가구, 소품)
 * @returns {object} - 등록된 아이템 정보
 * @param {string} itemId - 수정할 아이템의 ID
 * @param {string} displayName - 새로운 표시 이름
 */

export async function updateMyRoomItemDisplayName(itemId, displayName) {
  const itemRef = doc(db, "myRoomItems", itemId);
  await updateDoc(itemRef, { displayName });
}

export async function uploadMyRoomItem(file, category) {
  const storageRef = ref(storage, `myroom-items/${category}/${file.name}`);
  const uploadResult = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(uploadResult.ref);

  const itemDocRef = doc(db, 'myRoomItems', file.name);
  await setDoc(itemDocRef, {
    id: file.name,
    category: category,
    src: downloadURL,
    status: 'visible',
    createdAt: serverTimestamp(),
  });
  return { id: file.name, category, src: downloadURL, status: 'visible' };
}

/**
 * 모든 마이룸 아이템 목록을 Firestore에서 가져옵니다.
 * @returns {Array<object>} - 모든 마이룸 아이템 정보 배열
 */
export async function getMyRoomItems() {
  const itemsRef = collection(db, 'myRoomItems');
  const querySnapshot = await getDocs(itemsRef);
  const items = querySnapshot.docs.map(doc => doc.data());

  // gs:// URL은 브라우저에서 직접 렌더링 불가 → HTTPS downloadURL로 변환
  const resolved = await Promise.all(
    items.map(async (item) => {
      if (item.src && item.src.startsWith('gs://')) {
        try {
          const storageRef = ref(storage, item.src);
          const downloadUrl = await getDownloadURL(storageRef);
          return { ...item, src: downloadUrl };
        } catch (e) {
          console.warn(`마이룸 아이템 URL 변환 실패 (${item.id}):`, e);
          return { ...item, src: '' };
        }
      }
      return item;
    })
  );
  return resolved;
}

/**
 * 여러 마이룸 아이템의 상세 정보(가격, 크기 등)를 일괄 업데이트합니다.
 * @param {Array<object>} updates - 업데이트할 아이템 정보 배열 (e.g., [{ id: 'sofa1', price: 500, width: 20 }])
 */
export async function batchUpdateMyRoomItemDetails(updates) {
  const batch = writeBatch(db);
  updates.forEach(item => {
    const itemRef = doc(db, 'myRoomItems', item.id);
    const dataToUpdate = {};
    // undefined가 아닌 경우에만 업데이트 객체에 추가
    if (item.price !== undefined) dataToUpdate.price = Number(item.price);
    if (item.width !== undefined) dataToUpdate.width = Number(item.width);

    // 업데이트할 내용이 있을 경우에만 batch에 추가
    if (Object.keys(dataToUpdate).length > 0) {
      batch.update(itemRef, dataToUpdate);
    }
  });
  await batch.commit();
}

/**
 * 여러 마이룸 아이템을 영구적으로 삭제합니다. (Storage 파일 포함)
 * @param {Array<object>} itemsToDelete - 삭제할 아이템 객체 배열
 */
export async function batchDeleteMyRoomItems(itemsToDelete) {
  const batch = writeBatch(db);

  for (const item of itemsToDelete) {
    // Firestore에서 문서 삭제
    const itemRef = doc(db, "myRoomItems", item.id);
    batch.delete(itemRef);

    // Storage에서 이미지 파일 삭제
    const imageRef = ref(storage, item.src);
    try {
      await deleteObject(imageRef);
    } catch (error) {
      console.error("이미지 파일 삭제 실패 (이미 존재하지 않을 수 있음):", error);
    }
  }

  await batch.commit();
}
// --- 아바타 파츠 기타 (classId 추가) ---
export async function updateAvatarPartCategory(partId, newCategory) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { category: newCategory });
}

export async function updateMyRoomItemCategory(itemId, newCategory) {
  const itemRef = doc(db, "myRoomItems", itemId);
  await updateDoc(itemRef, { category: newCategory });
}

export async function batchUpdateAvatarPartCategory(partIds, newCategory) {
  const batch = writeBatch(db);
  partIds.forEach(partId => {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, { category: newCategory });
  });
  await batch.commit();
}

export async function batchUpdateMyRoomItemCategory(itemIds, newCategory) {
  const batch = writeBatch(db);
  itemIds.forEach(itemId => {
    const itemRef = doc(db, "myRoomItems", itemId);
    batch.update(itemRef, { category: newCategory });
  });
  await batch.commit();
}

export async function getAttendanceByDate(classId, date) {
  if (!classId) return [];
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const historyRef = collection(db, 'classes', classId, 'point_history');
  const q = query(
    historyRef,
    where('reason', '==', "출석 체크 보상"),
    where('timestamp', '>=', startOfDay),
    where('timestamp', '<=', endOfDay)
  );

  const querySnapshot = await getDocs(q);
  const attendedAuthUids = [...new Set(querySnapshot.docs.map(doc => doc.data().playerId))];
  return attendedAuthUids;
}

// --- 관리자 <-> 학생 1:1 대화 (classId 추가) ---
export async function adminInitiateConversation(classId, studentId, studentName, adminMessage, studentAuthUid) {
  if (!classId) return;
  if (!adminMessage.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date();

  await addDoc(collection(db, "classes", classId, "suggestions"), {
    studentId,
    studentName,
    message: `(선생님이 보낸 메시지) ${adminMessage}`,
    conversation: [
      {
        sender: 'admin',
        content: adminMessage,
        createdAt: now
      }
    ],
    status: "replied",
    createdAt: now,
    lastMessageAt: now,
  });

  if (studentAuthUid) {
    createNotification(
      studentAuthUid,
      "💌 선생님께 메시지가 도착했습니다.",
      "선생님께서 보낸 메시지를 확인해보세요!",
      "suggestion",
      "/suggestions"
    );
  }
}

export async function sendBulkMessageToAllStudents(classId, adminMessage) {
  if (!classId) return;
  if (!adminMessage.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date();

  const allPlayers = await getPlayers(classId);
  const students = allPlayers.filter(p => p.role !== 'admin' && p.status !== 'inactive');

  for (const student of students) {
    const suggestionsRef = collection(db, "classes", classId, "suggestions");
    const q = query(suggestionsRef, where("studentId", "==", student.id), orderBy("createdAt", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    const adminMessageData = {
      sender: 'admin',
      content: adminMessage,
      createdAt: now
    };

    if (!querySnapshot.empty) {
      const lastMessageDocRef = querySnapshot.docs[0].ref;
      await updateDoc(lastMessageDocRef, {
        conversation: arrayUnion(adminMessageData),
        lastMessageAt: now
      });
    } else {
      await addDoc(collection(db, "classes", classId, "suggestions"), {
        studentId: student.id,
        studentName: student.name,
        message: `(선생님이 보낸 전체 메시지) ${adminMessage}`,
        conversation: [adminMessageData],
        status: "replied",
        createdAt: now,
        lastMessageAt: now,
      });
    }

    if (student.authUid) {
      createNotification(
        student.authUid,
        "📢 선생님께 전체 메시지가 도착했습니다.",
        adminMessage,
        "suggestion",
        "/suggestions"
      );
    }
  }
}

// --- 칭호 시스템 (classId 추가) ---
export async function getTitles(classId) {
  if (!classId) return [];
  const titlesRef = collection(db, "classes", classId, "titles");
  const q = query(titlesRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createTitle(classId, titleData) {
  if (!classId) return;
  await addDoc(collection(db, "classes", classId, "titles"), {
    ...titleData,
    color: titleData.color || '#000000',
    createdAt: serverTimestamp(),
  });
}

export async function updateTitle(classId, titleId, dataToUpdate) {
  if (!classId) return;
  const titleRef = doc(db, "classes", classId, "titles", titleId);
  await updateDoc(titleRef, {
    ...dataToUpdate,
    color: dataToUpdate.color || '#000000'
  });
}

export async function deleteTitle(classId, titleId) {
  if (!classId) return;
  const titleRef = doc(db, "classes", classId, "titles", titleId);
  await deleteDoc(titleRef);
}

export async function grantTitleToPlayer(classId, playerId, titleId) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId);
  await updateDoc(playerRef, {
    ownedTitles: arrayUnion(titleId)
  });
}

// --- 미션 댓글 및 좋아요 (classId 추가) ---
export async function updateMissionComment(classId, submissionId, commentId, newText) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId);
  await updateDoc(commentRef, { text: newText });
}

export async function deleteMissionComment(classId, submissionId, commentId) {
  if (!classId) return;
  const repliesRef = collection(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies");
  const repliesSnap = await getDocs(repliesRef);
  const batch = writeBatch(db);
  repliesSnap.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  const commentRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId);
  await deleteDoc(commentRef);
}

export async function updateMissionReply(classId, submissionId, commentId, replyId, newText) {
  if (!classId) return;
  const replyRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId);
  await updateDoc(replyRef, { text: newText });
}

export async function deleteMissionReply(classId, submissionId, commentId, replyId) {
  if (!classId) return;
  const replyRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId);
  await deleteDoc(replyRef);
}

// ▼▼▼ [수정] totalLikes를 직접 업데이트하도록 로직 변경 ▼▼▼
export async function toggleSubmissionLike(classId, submissionId, likerId) {
  if (!classId) return;
  const submissionRef = doc(db, "classes", classId, "missionSubmissions", submissionId);
  const likerRef = doc(db, "classes", classId, "players", likerId);

  let rewardAmount = 0;
  let likerAuthUid = null;
  let likerName = null;

  await runTransaction(db, async (transaction) => {
    const submissionDoc = await transaction.get(submissionRef);
    if (!submissionDoc.exists()) throw new Error("Submission not found");

    const likerDoc = await transaction.get(likerRef);
    if (!likerDoc.exists()) throw new Error("Liker not found");

    const submissionData = submissionDoc.data();
    const likerData = likerDoc.data();
    const likes = submissionData.likes || [];
    const authorRef = doc(db, "classes", classId, "players", submissionData.studentId);
    const isLiked = likes.includes(likerId);

    if (isLiked) {
      transaction.update(submissionRef, { likes: likes.filter(id => id !== likerId) });
      transaction.update(authorRef, { totalLikes: increment(-1) });
    } else {
      transaction.update(submissionRef, { likes: [...likes, likerId] });
      transaction.update(authorRef, { totalLikes: increment(1) });

      // [신규 & 방어] 미션 하트 상호작용 보상 (하루 10회 한도 및 동일인 중복 방지)
      const todayStr = new Date().toLocaleDateString();
      let dailyLikeCount = likerData.dailyMissionLikeCount || 0;
      let dailyLikedUsers = likerData.dailyMissionLikedUsers || []; // 오늘 하트를 눌러준 미션 주인 목록

      if (likerData.lastMissionLikeDate !== todayStr) {
        dailyLikeCount = 0;
        dailyLikedUsers = [];
      }

      const alreadyLikedThisUser = dailyLikedUsers.includes(submissionData.studentId);

      // 내 미션이 아니고, 일일 한도 내이며, 오늘 이 친구에게 보상을 받은 적 없을 때 5P 지급
      if (submissionData.studentId !== likerId && (dailyLikeCount < 10) && !alreadyLikedThisUser) {
        rewardAmount = 5;
        likerAuthUid = likerData.authUid;
        likerName = likerData.name;
        transaction.update(likerRef, {
          points: increment(rewardAmount),
          dailyMissionLikeCount: dailyLikeCount + 1,
          dailyMissionLikedUsers: [...dailyLikedUsers, submissionData.studentId],
          lastMissionLikeDate: todayStr
        });
      }
    }
  });

  if (rewardAmount > 0 && likerAuthUid) {
    await addPointHistory(classId, likerAuthUid, likerName, rewardAmount, "친구 미션 응원(하트) 보상");
  }

  // (아래에 기존에 있던 인기 게시물 보상 로직 그대로 유지)
  const submissionDoc = await getDoc(submissionRef);
  const submissionData = submissionDoc.data();
  const POPULARITY_THRESHOLD = 10;

  if ((submissionData.likes.length >= POPULARITY_THRESHOLD) && !submissionData.popularRewardGranted) {
    // ...
  }
}

export async function grantTitleToPlayerManually(classId, playerId, titleId) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const playerSnap = await getDoc(playerRef);

  if (!playerSnap.exists()) {
    throw new Error("플레이어를 찾을 수 없습니다.");
  }
  const playerData = playerSnap.data();

  if (playerData.ownedTitles && playerData.ownedTitles.includes(titleId)) {
    throw new Error("이미 소유하고 있는 칭호입니다.");
  }

  const titleRef = doc(db, "classes", classId, "titles", titleId);
  const titleSnap = await getDoc(titleRef);
  if (!titleSnap.exists()) {
    throw new Error("칭호 정보를 찾을 수 없습니다.");
  }
  const title = titleSnap.data();

  await updateDoc(playerRef, {
    ownedTitles: arrayUnion(titleId)
  });

  await adjustPlayerPoints(classId, playerId, 2000, `칭호 [${title.name}] 획득 보상`);
}

export async function grantTitleToPlayersBatch(classId, playerIds, titleId) {
  if (!classId) return;
  const titleRef = doc(db, "classes", classId, "titles", titleId);
  const titleSnap = await getDoc(titleRef);
  if (!titleSnap.exists()) {
    throw new Error("칭호 정보를 찾을 수 없습니다.");
  }
  const title = titleSnap.data();

  for (const playerId of playerIds) {
    const playerRef = doc(db, "classes", classId, "players", playerId);
    const playerSnap = await getDoc(playerRef);

    if (playerSnap.exists()) {
      const playerData = playerSnap.data();
      if (!playerData.ownedTitles || !playerData.ownedTitles.includes(titleId)) {
        await updateDoc(playerRef, {
          ownedTitles: arrayUnion(titleId)
        });
        await adjustPlayerPoints(classId, playerId, 2000, `칭호 [${title.name}] 획득 보상`);
      }
    }
  }
}

/**
 * 학생이 장착할 칭호를 설정합니다.
 * @param {string} playerId - 학생 ID
 * @param {string} titleId - 장착할 칭호 ID (해제는 null)
 */
export async function equipTitle(classId, playerId, titleId) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId); // ✅ classId 경로 추가
  await updateDoc(playerRef, {
    equippedTitle: titleId
  });
}

export async function toggleSubmissionAdminVisibility(classId, submissionId) {
  if (!classId) return;
  const submissionRef = doc(db, "classes", classId, "missionSubmissions", submissionId); // ✅ classId 경로 추가
  await runTransaction(db, async (transaction) => {
    const submissionDoc = await transaction.get(submissionRef);
    if (!submissionDoc.exists()) throw new Error("Submission not found");
    const currentStatus = submissionDoc.data().adminHidden || false;
    transaction.update(submissionRef, { adminHidden: !currentStatus });
  });
}

// ▼▼▼ [수정] totalLikes를 직접 업데이트하도록 로직 변경 ▼▼▼
export async function toggleCommentLike(classId, submissionId, commentId, likerId) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId);

  await runTransaction(db, async (transaction) => {
    const commentDoc = await transaction.get(commentRef);
    if (!commentDoc.exists()) throw new Error("Comment not found");

    const commentData = commentDoc.data();
    const likes = commentData.likes || [];
    const authorRef = doc(db, "classes", classId, "players", commentData.commenterId);
    const isLiked = likes.includes(likerId);

    if (isLiked) {
      transaction.update(commentRef, { likes: likes.filter(id => id !== likerId) });
      transaction.update(authorRef, { totalLikes: increment(-1) });
    } else {
      transaction.update(commentRef, { likes: [...likes, likerId] });
      transaction.update(authorRef, { totalLikes: increment(1) });
    }
  });
}

// ▼▼▼ [수정] totalLikes를 직접 업데이트하도록 로직 변경 ▼▼▼
export async function toggleReplyLike(classId, submissionId, commentId, replyId, likerId) {
  if (!classId) return;
  const replyRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId);

  await runTransaction(db, async (transaction) => {
    const replyDoc = await transaction.get(replyRef);
    if (!replyDoc.exists()) throw new Error("Reply not found");

    const replyData = replyDoc.data();
    const likes = replyData.likes || [];
    const authorRef = doc(db, "classes", classId, "players", replyData.replierId);
    const isLiked = likes.includes(likerId);

    if (isLiked) {
      transaction.update(replyRef, { likes: likes.filter(id => id !== likerId) });
      transaction.update(authorRef, { totalLikes: increment(-1) });
    } else {
      transaction.update(replyRef, { likes: [...likes, likerId] });
      transaction.update(authorRef, { totalLikes: increment(1) });
    }
  });
}


/**
// [관리자용] 모든 미션 제출물의 모든 댓글을 불러옵니다.
 * @returns {Array<object>} - 모든 댓글 목록
 */
export async function getAllMissionComments(classId) {
  if (!classId) return [];
  // ✅ collectionGroup 쿼리에 classId 필터링을 추가합니다.
  // **(중요) 이를 위해 addMissionComment 함수에서 댓글 데이터에 classId를 함께 저장해야 합니다.**
  const commentsQuery = query(collectionGroup(db, 'comments'), where('classId', '==', classId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(commentsQuery);
  return querySnapshot.docs.map(doc => {
    const parentPath = doc.ref.parent.parent.path;
    const submissionId = parentPath.split('/').pop();
    return { id: doc.id, submissionId, ...doc.data() };
  });
}

// [삭제] 더 이상 필요하지 않은 계산 함수
// export async function getTotalLikesForPlayer(classId, playerId) { ... }

export async function migratePetData(classId, player) {
  if (!classId || !player) return null;
  // 이미 새로운 pets 구조를 가지고 있거나, 기존 pet 객체가 없으면 변환할 필요 없음
  if (!player.pet || (player.pets && player.pets.length > 0)) {
    return null;
  }

  console.log(`[데이터 마이그레이션] ${player.name}님의 펫 데이터를 변환합니다...`);
  const playerRef = doc(db, "classes", classId, "players", player.id);
  const petId = Date.now().toString();

  const newPetObject = {
    ...player.pet,
    id: petId, // 새로운 고유 ID 부여
  };

  // DB 업데이트: pets 배열 추가, partnerPetId 설정, 기존 pet 필드 삭제
  await updateDoc(playerRef, {
    pets: [newPetObject],
    partnerPetId: petId,
    pet: deleteField()
  });

  const updatedPlayerSnap = await getDoc(playerRef);
  console.log(`[데이터 마이그레이션] 변환 완료!`);
  return updatedPlayerSnap.data();
}

async function updatePetExperience(playerRef, expAmount) {
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return;

  const playerData = playerSnap.data();
  // 'pet'이 아닌 'pets' 배열을 확인하도록 수정
  if (!playerData.pets || playerData.pets.length === 0) return;

  let pets = [...playerData.pets];
  // 파트너 펫이 없으면 첫 번째 펫을 대상으로 함
  const partnerPetId = playerData.partnerPetId || pets[0].id;
  const petIndex = pets.findIndex(p => p.id === partnerPetId);

  if (petIndex === -1) return;

  let pet = { ...pets[petIndex] };
  pet.exp += expAmount;

  // [변경] 공통 계산 함수 호출로 로직 단순화
  const { leveledUpPet, levelUps } = calculateLevelUp(pet);

  if (levelUps > 0) {
    createNotification(
      playerData.authUid,
      `🎉 레벨업!`,
      `${leveledUpPet.name}의 레벨이 ${leveledUpPet.level}(으)로 올랐습니다!`,
      'pet_levelup',
      '/pet'
    );
  }

  pets[petIndex] = leveledUpPet;
  await updateDoc(playerRef, { pets });
}

export async function selectInitialPet(classId, species, name) {
  const user = auth.currentUser;
  if (!classId || !user) throw new Error("사용자 또는 학급 정보가 없습니다.");

  const playerRef = doc(db, "classes", classId, "players", user.uid);
  const petId = Date.now().toString();
  const baseData = PET_DATA[species];

  const randomize = (stat) => Math.round(stat * (0.9 + Math.random() * 0.2));

  const randomizedMaxHp = randomize(baseData.baseStats.maxHp);
  const randomizedMaxSp = randomize(baseData.baseStats.maxSp);
  const randomizedAtk = randomize(baseData.baseStats.atk);

  const petData = {
    id: petId,
    name: name,
    species: species,
    level: 1,
    exp: 0,
    maxExp: 270, // [수정] 공식: 150 + (50 * 1) = 200
    hp: randomizedMaxHp,
    maxHp: randomizedMaxHp,
    sp: randomizedMaxSp,
    maxSp: randomizedMaxSp,
    atk: randomizedAtk,
    equippedSkills: baseData.initialSkills,
    skills: baseData.initialSkills,
    appearanceId: `${species}_lv1`
  };

  await updateDoc(playerRef, {
    pets: arrayUnion(petData),
    partnerPetId: petId,
  });
  await adjustPlayerPoints(classId, user.uid, 200, "첫 파트너 펫 선택 보상");

  const playerSnap = await getDoc(playerRef);
  return playerSnap.data();
}

export async function buyPetItem(classId, playerId, item, quantity = 1) {
  if (!classId) throw new Error("학급 정보가 없습니다.");

  // 수량 안전 장치
  const count = parseInt(quantity, 10);
  if (isNaN(count) || count <= 0) throw new Error("구매 수량이 올바르지 않습니다.");

  const playerRef = doc(db, 'classes', classId, 'players', playerId);

  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const totalCost = item.price * count; // 가격 * 수량

    if (playerData.points < totalCost) {
      throw new Error(`포인트가 부족합니다. (필요: ${totalCost}P, 보유: ${playerData.points}P)`);
    }

    const newInventory = { ...playerData.petInventory };
    // [핵심] 기존 수량에 구매 수량(count)만큼 더하기
    newInventory[item.id] = (newInventory[item.id] || 0) + count;

    transaction.update(playerRef, {
      points: increment(-totalCost),
      petInventory: newInventory
    });
  }).then(async () => {
    const playerDoc = await getDoc(playerRef);
    const playerData = playerDoc.data();
    const totalCost = item.price * count;
    await addPointHistory(classId, playerData.authUid, playerData.name, -totalCost, `펫 아이템 '${item.name}' ${count}개 구매`);
    return playerData;
  });
}

// ▼▼▼ [수정] usePetItem 함수 수정 ▼▼▼
// [교체할 함수] usePetItem
export async function usePetItem(classId, playerId, itemId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const inventory = playerData.petInventory || {};
    let pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) throw new Error("대상이 되는 펫을 찾을 수 없습니다.");
    if (!inventory[itemId] || inventory[itemId] <= 0) throw new Error("아이템이 없습니다.");

    let pet = pets[petIndex];
    switch (itemId) {
      case 'brain_snack':
        pet.hp = Math.min(pet.maxHp, pet.hp + Math.floor(pet.maxHp * 0.15));
        pet.sp = Math.min(pet.maxSp, pet.sp + Math.floor(pet.maxSp * 0.15));
        break;
      case 'secret_notebook': {
        const currentSkills = pet.skills || [];
        const allLearnableSkills = Object.keys(SKILLS).filter(id => SKILLS[id].type === 'common');
        const availableSkills = allLearnableSkills.filter(id => !currentSkills.includes(id));

        if (availableSkills.length === 0) {
          throw new Error("이미 모든 스킬을 배웠습니다.");
        }

        const randomSkillId = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        pet.skills = [...currentSkills, randomSkillId];
        break;
      }
      // ▼▼▼ [신규 추가] 비타민 젤리 (배틀 횟수 초기화) ▼▼▼
      case 'vitamin_jelly':
        pet.dailyBattleCount = 0;
        pet.lastBattleDate = new Date().toLocaleDateString();
        break;
      // ▼▼▼ [추가] 이름 변경권 — 인벤토리 차감만, 실제 이름 변경은 consumeRenameItem 사용
      case 'pet_rename':
        // 인벤토리 차감은 공통 로직에서 처리됨. 여기서는 아무 효과 없음 (이름 변경은 별도 함수)
        break;
      default:
        throw new Error("알 수 없는 아이템입니다.");
    }

    const { leveledUpPet } = calculateLevelUp(pet);
    pets[petIndex] = leveledUpPet;

    const newInventory = { ...inventory };
    newInventory[itemId] -= 1;

    transaction.update(playerRef, {
      pets: pets,
      petInventory: newInventory
    });
  });

  const updatedPlayerDoc = await getDoc(playerRef);
  return updatedPlayerDoc.data();
}

export async function updatePetSkills(classId, playerId, petId, equippedSkills) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) throw new Error("펫을 찾을 수 없습니다.");

    pets[petIndex].equippedSkills = equippedSkills;
    transaction.update(playerRef, { pets: pets });
  });

  const updatedPlayerSnap = await getDoc(playerRef);
  return updatedPlayerSnap.data();
}

export async function evolvePet(classId, playerId, petId, evolutionStoneId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);

  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const inventory = playerData.petInventory || {};
    let pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) throw new Error("진화할 펫을 찾을 수 없습니다.");

    let pet = { ...pets[petIndex] };

    const oldPetName = pet.name;

    if (!inventory[evolutionStoneId] || inventory[evolutionStoneId] <= 0) {
      throw new Error("진화 아이템이 없습니다.");
    }

    const currentStage = parseInt(pet.appearanceId.match(/_lv(\d)/)?.[1] || '1');
    const evolutionLevel = currentStage === 1 ? 10 : 20;

    if (pet.level < evolutionLevel) {
      throw new Error(`레벨 ${evolutionLevel} 이상만 진화할 수 있습니다.`);
    }

    if (currentStage >= 3) {
      throw new Error("이미 최종 단계로 진화했습니다.");
    }

    const speciesData = PET_DATA[pet.species];
    const evolutionData = speciesData.evolution[`lv${evolutionLevel}`];

    // 사용자가 직접 이름을 바꾼 펫인지 확인
    // customName 필드가 없는 기존 펫도 고려해서,
    // 현재 이름이 공식 진화 이름 목록에 없으면 커스텀 이름으로 판단합니다.
    const officialNames = [
      speciesData.name,
      ...Object.values(speciesData.evolution || {}).map(evo => evo.name),
    ].filter(Boolean);

    const hasCustomName =
      pet.customName === true ||
      (pet.name && !officialNames.includes(pet.name));

    const preservedName = hasCustomName ? pet.name : evolutionData.name;
    const evolvedSpeciesName = evolutionData.name;

    pet.appearanceId = evolutionData.appearanceId;
    pet.name = preservedName;
    pet.customName = hasCustomName;

    // 진화 보너스 스탯 적용
    pet.maxHp = Math.floor(pet.maxHp * evolutionData.statBoost.hp);
    pet.maxSp = Math.floor(pet.maxSp * evolutionData.statBoost.sp);
    pet.atk = Math.floor(pet.atk * evolutionData.statBoost.atk);

    // 진화 시 체력/SP 완전 회복
    pet.hp = pet.maxHp;
    pet.sp = pet.maxSp;

    // 진화 전까지 누적된 경험치로 즉시 레벨업 처리
    const { leveledUpPet, levelUps } = calculateLevelUp(pet);
    const finalPet = leveledUpPet;

    // 진화 시 고유 스킬 자동 습득
    if (!finalPet.skills) finalPet.skills = [];

    if (evolutionData.newSkill) {
      const newSkillId = evolutionData.newSkill.id || evolutionData.newSkill;
      if (!finalPet.skills.includes(newSkillId)) {
        finalPet.skills.push(newSkillId);
      }
    }

    if (evolutionData.newSkills && Array.isArray(evolutionData.newSkills)) {
      evolutionData.newSkills.forEach(skill => {
        const skillId = skill.id || skill;
        if (!finalPet.skills.includes(skillId)) {
          finalPet.skills.push(skillId);
        }
      });
    }

    const newInventory = { ...inventory };
    newInventory[evolutionStoneId] -= 1;

    pets[petIndex] = finalPet;

    transaction.update(playerRef, {
      pets,
      petInventory: newInventory,
    });

    const levelUpMsg = levelUps > 0 ? ` 누적 경험치로 ${levelUps}레벨 상승!` : '';
    const nameKeepMsg = hasCustomName ? ` 이름은 '${finalPet.name}' 그대로 유지됩니다.` : '';

    createNotification(
      playerData.authUid,
      `🎉 펫 진화 성공!`,
      `${oldPetName}(이)가 ${evolvedSpeciesName}(으)로 진화했습니다!${nameKeepMsg} 신규 스킬을 획득했습니다.${levelUpMsg}`,
      'pet_evolution',
      '/pet'
    );

    return { ...playerData, pets, petInventory: newInventory };
  });
}

export async function hatchPetEgg(classId, playerId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  let hatchedPetData = null;

  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const inventory = playerData.petInventory || {};
    if (!inventory.pet_egg || inventory.pet_egg <= 0) throw new Error("부화할 알이 없습니다.");

    // ▼▼▼ [수정] 이미 보유한 종은 제외하고 부화 (모두 보유 시 전체 허용) ▼▼▼
    const availableSpecies = Object.keys(PET_DATA);
    const ownedSpecies = new Set((playerData.pets || []).map(p => p.species));
    const unownedSpecies = availableSpecies.filter(s => !ownedSpecies.has(s));
    const hatchPool = unownedSpecies.length > 0 ? unownedSpecies : availableSpecies;
    const randomSpecies = hatchPool[Math.floor(Math.random() * hatchPool.length)];
    // ▲▲▲ [수정 끝] ▲▲▲

    const petId = Date.now().toString();
    const baseData = PET_DATA[randomSpecies];

    const randomize = (stat) => Math.round(stat * (0.9 + Math.random() * 0.2));

    const randomizedMaxHp = randomize(baseData.baseStats.maxHp);
    const randomizedMaxSp = randomize(baseData.baseStats.maxSp);
    const randomizedAtk = randomize(baseData.baseStats.atk);

    const newPet = {
      id: petId,
      name: baseData.name,
      species: randomSpecies,
      element: baseData.element, // 💡 [중요] 배틀 상성 연동을 위해 속성(Element) 데이터 주입!
      level: 1,
      exp: 0,
      maxExp: 270,
      hp: randomizedMaxHp,
      maxHp: randomizedMaxHp,
      sp: randomizedMaxSp,
      maxSp: randomizedMaxSp,
      atk: randomizedAtk,
      equippedSkills: [...baseData.initialSkills], // 주소 복사 방지를 위해 스프레드 연산자 권장
      skills: [...baseData.initialSkills],
      appearanceId: `${randomSpecies}_lv1` // monkey_lv1, dragon_lv1 등으로 자동 매핑
    };
    hatchedPetData = newPet;

    const newInventory = { ...inventory };
    newInventory.pet_egg -= 1;

    transaction.update(playerRef, {
      pets: arrayUnion(newPet),
      petInventory: newInventory
    });
  }).then(async () => {
    const updatedPlayerSnap = await getDoc(playerRef);
    return { updatedPlayerData: updatedPlayerSnap.data(), hatchedPet: hatchedPetData };
  });
}

export async function setPartnerPet(classId, playerId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  await updateDoc(playerRef, { partnerPetId: petId });
  const playerSnap = await getDoc(playerRef);
  return playerSnap.data();
}

export async function updatePetName(classId, playerId, petId, newName) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  if (!newName || newName.length > 10) {
    throw new Error("이름은 1자 이상 10자 이하로 입력해주세요.");
  }

  const playerRef = doc(db, "classes", classId, "players", playerId);

  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    const pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) throw new Error("펫을 찾을 수 없습니다.");

    pets[petIndex] = {
      ...pets[petIndex],
      name: newName,
      customName: true,
    };

    transaction.update(playerRef, { pets });

    return {
      ...playerData,
      pets,
    };
  });
}

export async function convertLikesToExp(classId, playerId, amount, petId) { // petId 인자 확인
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  let expGained = 0;
  let levelUps = 0;
  let leveledUpPetName = '';

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("플레이어 정보를 찾을 수 없습니다.");
    }

    const playerData = playerDoc.data();
    const totalLikes = Number(playerData.totalLikes || 0);

    if (totalLikes < amount) {
      throw new Error("교환할 하트가 부족합니다.");
    }

    let pets = playerData.pets || [];
    // partnerPetId 대신 전달받은 petId로 펫을 찾음
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) {
      throw new Error("경험치를 받을 펫을 찾을 수 없습니다.");
    }

    // [수정] 하트 1개당 경험치 50으로 상향 (기존 10 -> 50)
    // 미션 보상(100XP)의 절반 가치로 설정하여 소셜 활동의 의미 부여
    expGained = amount * 50;

    let pet = { ...pets[petIndex] };
    pet.exp += expGained;

    const result = calculateLevelUp(pet);
    pets[petIndex] = result.leveledUpPet;
    levelUps = result.levelUps;
    leveledUpPetName = result.leveledUpPet.name;

    transaction.update(playerRef, {
      pets: pets,
      totalLikes: increment(-amount)
    });
  });

  if (levelUps > 0) {
    const user = auth.currentUser;
    if (user) {
      createNotification(user.uid, `🎉 레벨업!`, `${leveledUpPetName}의 레벨이 ${levelUps} 올랐습니다!`, 'pet_levelup', '/pet');
    }
  }

  const updatedPlayerSnap = await getDoc(playerRef);
  return { expGained, updatedPlayerData: updatedPlayerSnap.data() };
}

// src/api/firebase.js

export async function processBattleResults(
  classId,
  winnerId,
  loserId,
  fled = false,
  finalWinnerPet,
  finalLoserPet,
  finalWinnerTeam = null,
  finalLoserTeam = null,
  finalWinnerParticipatedPetIds = null,
  finalLoserParticipatedPetIds = null
) {
  // M5_BATTLE_FINAL_PARTICIPATED_PERSIST_PATCH_FIX_AFTER_V2
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const winnerRef = doc(db, "classes", classId, "players", winnerId);
  const loserRef = doc(db, "classes", classId, "players", loserId);

  return await runTransaction(db, async (transaction) => {
    const winnerDoc = await transaction.get(winnerRef);
    const loserDoc = await transaction.get(loserRef);

    if (!winnerDoc.exists() || !loserDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const winnerData = winnerDoc.data();
    const loserData = loserDoc.data();

    const winnerTitle = winnerData.equippedTitle;
    const loserTitle = loserData.equippedTitle;

    // 포인트 보상/페널티는 플레이어 단위로 한 번만 적용
    let victoryReward = 150;
    let fleeRewardNote = '';
    let fleeExpMultiplier = 1;
    let fleeRewardPercent = null;

    // M15_FLEE_LIMIT_AND_FLEE_WIN_PATCH
    // 도망 성공은 상대 승리로 처리하되, 즉시 도망 어뷰징을 막기 위해
    // 도망친 팀이 얼마나 몰렸는지에 따라 승리 포인트를 40~100%로 조정합니다.
    if (fled) {
      const fleeingTeam = Array.isArray(finalLoserTeam) && finalLoserTeam.length > 0
        ? finalLoserTeam
        : finalLoserPet
          ? [finalLoserPet]
          : [];

      const totalMaxHp = fleeingTeam.reduce((sum, pet) => sum + Math.max(0, Number(pet?.maxHp ?? 0)), 0);
      const totalCurrentHp = fleeingTeam.reduce((sum, pet) => sum + Math.max(0, Number(pet?.hp ?? 0)), 0);
      const damageProgress = totalMaxHp > 0
        ? Math.max(0, Math.min(1, 1 - (totalCurrentHp / totalMaxHp)))
        : 1;

      const fleeRewardMultiplier = Math.max(0.4, Math.min(1, 0.4 + damageProgress * 0.6));
      victoryReward = Math.floor(victoryReward * fleeRewardMultiplier);
      fleeRewardPercent = Math.round(fleeRewardMultiplier * 100);
      fleeRewardNote = ` (도망 승리 보상 ${fleeRewardPercent}%)`;
      fleeExpMultiplier = fleeRewardMultiplier;
    }
    if (winnerTitle === 'point_rich') {
      victoryReward = Math.floor(victoryReward * 1.2);
    }

    let defeatPenalty = fled ? 0 : 50;
    // M20E_DILIGENT_GIVER_STACK_PENALTY_PATCH
    // 성실한 기부천사 감면은 레벨차 감면까지 반영된 "최종 패널티"에 마지막으로 적용합니다.
    let diligentGiverPenaltyNote = '';

    // M9_EFFECTIVE_TEAM_LEVEL_SCALE_PATCH
    // 레벨 차 보상/패널티는 마지막 active 펫 1마리가 아니라,
    // 선택/편성된 팀 배열(finalTeam) 전체의 실질 팀 레벨 기준으로 계산합니다.
    // 실질 팀 레벨 = 최고 레벨 70% + 평균 레벨 30%
    // 예: 30 + 2 팀은 평균 16이지만 실질 레벨은 약 26으로 계산되어,
    // 16 + 16 팀보다 강한 팀으로 판정됩니다.
    let levelGap = 0;
    let levelScaleNote = '';
    let teamSizeRewardNote = '';
    let lossExpScaleNote = '';
    let defeatPenaltyLevelNote = '';
    let winExpMultiplier = 1.0;
    let loseExpMultiplier = 1.0;

    let winnerPets = [...(winnerData.pets || [])];
    let loserPets = [...(loserData.pets || [])];

    const clampBattleHp = (storedPet, battlePet) => {
      const rawHp = Number(battlePet?.hp);
      const fallbackHp = Number(storedPet?.hp ?? 0);
      const hp = Number.isFinite(rawHp) ? rawHp : fallbackHp;
      return Math.min(Number(storedPet?.maxHp ?? hp), Math.max(0, hp));
    };

    const normalizeBattleSp = (storedPet, battlePet) => {
      const rawSp = Number(battlePet?.sp);
      const fallbackSp = Number(storedPet?.sp ?? 0);
      const sp = Number.isFinite(rawSp) ? rawSp : fallbackSp;
      return Math.max(0, sp);
    };

    const dedupeBattleTeam = (team, fallbackPet) => {
      const list = Array.isArray(team) && team.length > 0
        ? team
        : fallbackPet
          ? [fallbackPet]
          : [];

      const map = new Map();
      list.filter(Boolean).forEach(pet => {
        if (pet?.id && !map.has(pet.id)) {
          map.set(pet.id, pet);
        }
      });

      return Array.from(map.values());
    };

    // M12_TEAM_SIZE_POINT_REWARD_PATCH
    // 대전 규모가 클수록 시간이 오래 걸리고 여러 펫의 HP/SP가 소모되므로
    // 승리 포인트 보상만 완만하게 올립니다. 경험치 배율은 M9 레벨 보정만 따릅니다.
    const getBattleTeamSizeForReward = () => {
      const winnerTeamSize = dedupeBattleTeam(finalWinnerTeam, finalWinnerPet).length || 1;
      const loserTeamSize = dedupeBattleTeam(finalLoserTeam, finalLoserPet).length || 1;

      // 원칙적으로 양쪽 팀 크기는 같지만, 혹시 과거 문서나 예외 데이터가 있으면
      // 더 작은 쪽을 기준으로 하여 과한 보상을 방지합니다.
      return Math.min(3, Math.max(1, Math.min(winnerTeamSize, loserTeamSize)));
    };

    const battleTeamSizeForReward = getBattleTeamSizeForReward();
    const teamSizeRewardMultiplier = battleTeamSizeForReward >= 3
      ? 2
      : battleTeamSizeForReward >= 2
        ? 1.5
        : 1;

    if (teamSizeRewardMultiplier > 1) {
      victoryReward = Math.floor(victoryReward * teamSizeRewardMultiplier);
      teamSizeRewardNote = ` (${battleTeamSizeForReward} vs ${battleTeamSizeForReward} 보상 x${teamSizeRewardMultiplier})`;
    }


    const getEffectiveTeamLevel = (finalTeam, fallbackPet) => {
      const battleTeam = dedupeBattleTeam(finalTeam, fallbackPet);

      if (battleTeam.length === 0) {
        const fallbackLevel = Number(fallbackPet?.level ?? 1);
        return Number.isFinite(fallbackLevel) && fallbackLevel > 0 ? fallbackLevel : 1;
      }

      const levels = battleTeam
        .map(pet => Number(pet?.level ?? 1))
        .filter(level => Number.isFinite(level) && level > 0);

      if (levels.length === 0) return 1;

      const maxLevel = Math.max(...levels);
      const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length;

      // 3 vs 3에서도 그대로 작동:
      // 최고 레벨은 원맨 캐리 위협을 반영하고, 평균 레벨은 나머지 팀 전력을 반영합니다.
      return Math.max(1, Math.round(maxLevel * 0.7 + averageLevel * 0.3));
    };

    const getTeamMaxLevel = (finalTeam, fallbackPet) => {
      const battleTeam = dedupeBattleTeam(finalTeam, fallbackPet);

      if (battleTeam.length === 0) {
        const fallbackLevel = Number(fallbackPet?.level ?? 1);
        return Number.isFinite(fallbackLevel) && fallbackLevel > 0 ? fallbackLevel : 1;
      }

      const levels = battleTeam
        .map(pet => Number(pet?.level ?? 1))
        .filter(level => Number.isFinite(level) && level > 0);

      return levels.length > 0 ? Math.max(...levels) : 1;
    };

    const winnerEffectiveLevel = getEffectiveTeamLevel(finalWinnerTeam, finalWinnerPet);
    const loserEffectiveLevel = getEffectiveTeamLevel(finalLoserTeam, finalLoserPet);
    const winnerMaxLevel = getTeamMaxLevel(finalWinnerTeam, finalWinnerPet);
    const loserMaxLevel = getTeamMaxLevel(finalLoserTeam, finalLoserPet);
    const maxLevelGap = winnerMaxLevel - loserMaxLevel;

    levelGap = winnerEffectiveLevel - loserEffectiveLevel;

    if (levelGap >= 10) {
      victoryReward = Math.floor(victoryReward * 0.5);
      winExpMultiplier = 0.5;
      loseExpMultiplier = 1.5;
      levelScaleNote = ` (실질 팀 레벨 +${levelGap}: 보상 크게 감소)`;
      lossExpScaleNote = ` (상대 실질 팀 레벨 +${levelGap}: 패배 경험치 보정)`;
    } else if (levelGap >= 5) {
      victoryReward = Math.floor(victoryReward * 0.75);
      winExpMultiplier = 0.75;
      loseExpMultiplier = 1.25;
      levelScaleNote = ` (실질 팀 레벨 +${levelGap}: 보상 약간 감소)`;
      lossExpScaleNote = ` (상대 실질 팀 레벨 +${levelGap}: 패배 경험치 보정)`;
    } else if (levelGap <= -10) {
      victoryReward = Math.floor(victoryReward * 1.5);
      winExpMultiplier = 1.5;
      loseExpMultiplier = 0.5;
      levelScaleNote = ` (실질 팀 레벨 ${Math.abs(levelGap)} 낮은 팀 승리 보너스)`;
      lossExpScaleNote = ` (높은 팀 패배: 패배 경험치 감소)`;
    } else if (levelGap <= -5) {
      victoryReward = Math.floor(victoryReward * 1.25);
      winExpMultiplier = 1.25;
      loseExpMultiplier = 0.75;
      levelScaleNote = ` (실질 팀 레벨 ${Math.abs(levelGap)} 낮은 팀 승리 보너스)`;
      lossExpScaleNote = ` (높은 팀 패배: 패배 경험치 약간 감소)`;
    }

    // M9B_STRONG_OPPONENT_DEFEAT_PENALTY_PATCH
    // 패배 포인트는 "팀 실질 레벨"보다 상대 최고레벨 격차를 더 민감하게 봅니다.
    // 예: 11+1 vs 5+6은 실질 팀 레벨 차이는 작지만, 최고레벨 차이는 +5이므로
    // 낮은 최고레벨 팀이 졌을 때 패배 페널티를 50P → 25P로 줄입니다.
    if (!fled && maxLevelGap >= 5 && defeatPenalty > 25) {
      defeatPenalty = 25;
      defeatPenaltyLevelNote = ` (상대 최고 레벨 +${maxLevelGap}: 강팀 상대 감면)`;
    }

    // M20E_DILIGENT_GIVER_STACK_PENALTY_PATCH
    // 성실한 기부천사는 레벨차/도망 여부까지 계산된 최종 패배 페널티를 다시 50% 감면합니다.
    // 예: 기본 50P → 강팀 상대 감면 25P → 기부천사 추가 감면 12P
    if (loserTitle === 'diligent_giver' && defeatPenalty > 0) {
      const beforeDiligentGiverPenalty = defeatPenalty;
      defeatPenalty = Math.max(1, Math.floor(defeatPenalty * 0.5));
      diligentGiverPenaltyNote = ` (기부천사 추가 감면 ${beforeDiligentGiverPenalty}P→${defeatPenalty}P)`;
    }

    // M15B_FLEE_EXP_SCALE_PATCH


    // 도망 성공 승리는 포인트뿐 아니라 승리 경험치도 같은 비율로 줄입니다.


    // 이후 applyTeamOutcome에서 참여한 승리 펫에게 Math.round(100 * winExpMultiplier)가 적용됩니다.


    if (fled && fleeExpMultiplier < 1) {


      winExpMultiplier = Math.max(0.1, winExpMultiplier * fleeExpMultiplier);


    }


    


    const getParticipatedIds = (explicitIds, battleTeam, fallbackPet) => {
      const ids = new Set();

      if (Array.isArray(explicitIds)) {
        explicitIds.filter(Boolean).forEach(id => ids.add(id));
      }

      // 과거/부분 패치 문서 fallback:
      // 선발 펫(team[0])과 마지막 active 펫은 최소 출전 처리
      if (battleTeam?.[0]?.id) ids.add(battleTeam[0].id);
      if (fallbackPet?.id) ids.add(fallbackPet.id);

      return ids;
    };

    const applyTeamOutcome = (storedPets, finalTeam, fallbackPet, explicitParticipatedIds, outcome) => {
      const battleTeam = dedupeBattleTeam(finalTeam, fallbackPet);
      if (battleTeam.length === 0) return storedPets;

      const participatedIds = getParticipatedIds(explicitParticipatedIds, battleTeam, fallbackPet);
      const nextPets = [...storedPets];

      battleTeam.forEach((battlePet) => {
        if (!battlePet?.id) return;

        const idx = nextPets.findIndex(p => p.id === battlePet.id);
        if (idx === -1) return;

        const nextHp = clampBattleHp(nextPets[idx], battlePet);
        const nextSp = normalizeBattleSp(nextPets[idx], battlePet);
        const wasFainted = nextHp <= 0;
        const participated = participatedIds.has(battlePet.id);

        let nextPet = {
          ...nextPets[idx],
          hp: nextHp,
          sp: nextSp,
          status: {},
          battleWins: nextPets[idx].battleWins || 0,
          battleLosses: nextPets[idx].battleLosses || 0,
          battleFlees: nextPets[idx].battleFlees || 0,
        };

        // 경험치/전적은 실제 필드에 나온 펫만 적용
        if (participated) {
          if (outcome === 'win') {
            nextPet.battleWins = (nextPet.battleWins || 0) + 1;
            nextPet.exp = (nextPet.exp || 0) + Math.round(100 * winExpMultiplier);
          } else if (outcome === 'lose') {
            nextPet.battleLosses = (nextPet.battleLosses || 0) + (fled ? 0 : 1);
            nextPet.battleFlees = (nextPet.battleFlees || 0) + (fled ? 1 : 0);
            const baseExp = fled ? 10 : 30;
            nextPet.exp = (nextPet.exp || 0) + Math.round(baseExp * loseExpMultiplier);
          }

          const { leveledUpPet } = calculateLevelUp(nextPet);
          nextPet = leveledUpPet;
        }

        // 레벨업으로 HP가 회복되는 것을 방지.
        // 전투 중 쓰러진 펫은 전투 후에도 HP 0으로 유지한다.
        if (wasFainted) {
          nextPet.hp = 0;
        } else {
          nextPet.hp = Math.min(nextPet.maxHp, nextPet.hp);
        }

        nextPet.sp = Math.max(0, nextPet.sp ?? nextSp);
        nextPet.status = {};

        nextPets[idx] = nextPet;
      });

      return nextPets;
    };

    // HP/SP는 team 전체 저장, 경험치/전적은 participatedPetIds 기준 적용
    winnerPets = applyTeamOutcome(
      winnerPets,
      finalWinnerTeam,
      finalWinnerPet,
      finalWinnerParticipatedPetIds,
      'win'
    );

    loserPets = applyTeamOutcome(
      loserPets,
      finalLoserTeam,
      finalLoserPet,
      finalLoserParticipatedPetIds,
      'lose'
    );

    // M18_RESULT_REWARD_SUMMARY_PATCH
    // 결과창에서 보여줄 포인트/경험치 요약을 생성합니다.
    const winnerParticipatedIdsForSummary = getParticipatedIds(
      finalWinnerParticipatedPetIds,
      dedupeBattleTeam(finalWinnerTeam, finalWinnerPet),
      finalWinnerPet
    );
    const loserParticipatedIdsForSummary = getParticipatedIds(
      finalLoserParticipatedPetIds,
      dedupeBattleTeam(finalLoserTeam, finalLoserPet),
      finalLoserPet
    );

    const winnerExpGain = Math.round(100 * winExpMultiplier);
    const loserBaseExp = fled ? 10 : 30;
    const loserExpGain = Math.round(loserBaseExp * loseExpMultiplier);

    const buildPetExpGains = (team, fallbackPet, participatedIds, expGain) => {
      return dedupeBattleTeam(team, fallbackPet)
        .filter(pet => pet?.id && participatedIds.has(pet.id))
        .map(pet => ({
          petId: pet.id,
          name: pet.name || '펫',
          exp: expGain,
        }));
    };

    const battleResultSummary = {
      winnerId,
      loserId,
      fled,
      fleeRewardPercent,
      battleTeamSize: battleTeamSizeForReward,
      winnerPoints: victoryReward,
      loserPoints: -defeatPenalty,
      pointChanges: {
        [winnerId]: victoryReward,
        [loserId]: -defeatPenalty,
      },
      winnerExpGain,
      loserExpGain,
      winnerPetExpGains: buildPetExpGains(finalWinnerTeam, finalWinnerPet, winnerParticipatedIdsForSummary, winnerExpGain),
      loserPetExpGains: buildPetExpGains(finalLoserTeam, finalLoserPet, loserParticipatedIdsForSummary, loserExpGain),
      notes: [fleeRewardNote, teamSizeRewardNote, levelScaleNote, defeatPenaltyLevelNote, diligentGiverPenaltyNote, lossExpScaleNote].filter(Boolean),
    };

    transaction.update(winnerRef, { points: increment(victoryReward), pets: winnerPets });
    transaction.update(loserRef, { points: increment(-defeatPenalty), pets: loserPets });

    await addPointHistory(
      classId,
      winnerData.authUid,
      winnerData.name,
      victoryReward,
      "퀴즈 배틀 승리" + (winnerTitle === 'point_rich' ? ' (포인트 부자 보너스)' : '') + fleeRewardNote + teamSizeRewardNote + levelScaleNote
    );

    if (defeatPenalty > 0) {
      await addPointHistory(
        classId,
        loserData.authUid,
        loserData.name,
        -defeatPenalty,
        "퀴즈 배틀 패배" + defeatPenaltyLevelNote + diligentGiverPenaltyNote + lossExpScaleNote
      );
    }

    return battleResultSummary;
  });
}


// [추가] 무승부/도망 처리 (경험치/포인트 변화 없이 상태만 저장)
export async function processBattleDraw(classId, player1Id, player2Id, player1Pet, player2Pet, player1Team = null, player2Team = null) {
  // M5_DRAW_TEAM_STATE_PERSIST_PATCH
  if (!classId) return;
  const p1Ref = doc(db, "classes", classId, "players", player1Id);
  const p2Ref = doc(db, "classes", classId, "players", player2Id);

  await runTransaction(db, async (transaction) => {
    const p1Doc = await transaction.get(p1Ref);
    const p2Doc = await transaction.get(p2Ref);
    if (!p1Doc.exists() || !p2Doc.exists()) return;

    const clampBattleHp = (storedPet, battlePet) => {
      const rawHp = Number(battlePet?.hp);
      const fallbackHp = Number(storedPet?.hp ?? 0);
      const hp = Number.isFinite(rawHp) ? rawHp : fallbackHp;
      return Math.min(Number(storedPet?.maxHp ?? hp), Math.max(0, hp));
    };

    const normalizeBattleSp = (storedPet, battlePet) => {
      const rawSp = Number(battlePet?.sp);
      const fallbackSp = Number(storedPet?.sp ?? 0);
      const sp = Number.isFinite(rawSp) ? rawSp : fallbackSp;
      return Math.max(0, sp);
    };

    const dedupeBattleTeam = (team, fallbackPet) => {
      const list = Array.isArray(team) && team.length > 0
        ? team
        : fallbackPet
          ? [fallbackPet]
          : [];

      const map = new Map();
      list.filter(Boolean).forEach(pet => {
        if (pet?.id && !map.has(pet.id)) {
          map.set(pet.id, pet);
        }
      });

      return Array.from(map.values());
    };

    const updateTeamPetStates = (playerData, finalPetState, finalTeamState) => {
      const storedPets = [...(playerData.pets || [])];
      const battleTeam = dedupeBattleTeam(finalTeamState, finalPetState);

      if (battleTeam.length === 0) return storedPets;

      battleTeam.forEach((battlePet) => {
        if (!battlePet?.id) return;

        const idx = storedPets.findIndex(p => p.id === battlePet.id);
        if (idx === -1) return;

        storedPets[idx] = {
          ...storedPets[idx],
          hp: clampBattleHp(storedPets[idx], battlePet),
          sp: normalizeBattleSp(storedPets[idx], battlePet),
          status: {},
        };
      });

      return storedPets;
    };

    transaction.update(p1Ref, {
      pets: updateTeamPetStates(p1Doc.data(), player1Pet, player1Team),
    });

    transaction.update(p2Ref, {
      pets: updateTeamPetStates(p2Doc.data(), player2Pet, player2Team),
    });
  });
}


export async function revivePet(classId, playerId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const REVIVE_COST = 500; // 부활 비용

  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");

    const playerData = playerDoc.data();
    let pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);

    if (petIndex === -1) throw new Error("치료할 펫을 찾을 수 없습니다.");
    if (pets[petIndex].hp > 0) throw new Error("이미 건강한 펫입니다.");

    // 무료 부활 로직 (예: 하루에 한 번)
    const todayStr = new Date().toLocaleDateString();
    if (playerData.lastFreeRevive !== todayStr) {
      pets[petIndex].hp = pets[petIndex].maxHp;
      transaction.update(playerRef, { pets, lastFreeRevive: todayStr });
      return { free: true, cost: 0, updatedData: { ...playerData, pets, lastFreeRevive: todayStr } };
    }

    // 유료 부활 로직
    if (playerData.points < REVIVE_COST) {
      throw new Error(`포인트가 부족합니다. (필요: ${REVIVE_COST}P)`);
    }
    pets[petIndex].hp = pets[petIndex].maxHp;
    transaction.update(playerRef, {
      pets,
      points: increment(-REVIVE_COST)
    });

    return { free: false, cost: REVIVE_COST, updatedData: { ...playerData, points: playerData.points - REVIVE_COST, pets } };
  }).then(async ({ free, cost, updatedData }) => {
    if (!free) {
      await addPointHistory(classId, updatedData.authUid, updatedData.name, -cost, "펫 센터 치료");
    }
    return updatedData;
  });
}

// HP 치료 (150P)
export async function healPetHp(classId, playerId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const HEAL_HP_COST = 150;
  let savedPlayerData = null;

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    if (playerData.points < HEAL_HP_COST) throw new Error(`포인트가 부족합니다. (필요: ${HEAL_HP_COST}P)`);
    const pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);
    if (petIndex === -1) throw new Error("치료할 펫을 찾을 수 없습니다.");
    const pet = pets[petIndex];
    if (pet.hp === pet.maxHp) throw new Error("이미 HP가 가득 찬 펫입니다.");
    const updatedPets = pets.map((p, i) => i === petIndex ? { ...p, hp: p.maxHp } : p);
    transaction.update(playerRef, { pets: updatedPets, points: increment(-HEAL_HP_COST) });
    savedPlayerData = playerData;
  });
  if (savedPlayerData) {
    await addPointHistory(classId, savedPlayerData.authUid, savedPlayerData.name, -HEAL_HP_COST, "펫 센터 HP 치료");
  }
  return (await getDoc(playerRef)).data();
}

// SP 치료 (100P)
export async function healPetSp(classId, playerId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const HEAL_SP_COST = 100;
  let savedPlayerData = null;

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    if (playerData.points < HEAL_SP_COST) throw new Error(`포인트가 부족합니다. (필요: ${HEAL_SP_COST}P)`);
    const pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);
    if (petIndex === -1) throw new Error("치료할 펫을 찾을 수 없습니다.");
    const pet = pets[petIndex];
    if (pet.sp === pet.maxSp) throw new Error("이미 SP가 가득 찬 펫입니다.");
    const updatedPets = pets.map((p, i) => i === petIndex ? { ...p, sp: p.maxSp } : p);
    transaction.update(playerRef, { pets: updatedPets, points: increment(-HEAL_SP_COST) });
    savedPlayerData = playerData;
  });
  if (savedPlayerData) {
    await addPointHistory(classId, savedPlayerData.authUid, savedPlayerData.name, -HEAL_SP_COST, "펫 센터 SP 치료");
  }
  return (await getDoc(playerRef)).data();
}

// 하위호환: 기존 healPet = HP+SP 동시 치료 (250P)
export async function healPet(classId, playerId, petId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const HEAL_COST = 250;
  let savedPlayerData = null;
  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    if (playerData.points < HEAL_COST) throw new Error(`포인트가 부족합니다. (필요: ${HEAL_COST}P)`);
    const pets = playerData.pets || [];
    const petIndex = pets.findIndex(p => p.id === petId);
    if (petIndex === -1) throw new Error("치료할 펫을 찾을 수 없습니다.");
    const pet = pets[petIndex];
    if (pet.hp === pet.maxHp && pet.sp === pet.maxSp) throw new Error("이미 건강한 펫입니다.");
    const updatedPets = pets.map((p, i) => i === petIndex ? { ...p, hp: p.maxHp, sp: p.maxSp } : p);
    transaction.update(playerRef, { pets: updatedPets, points: increment(-HEAL_COST) });
    savedPlayerData = playerData;
  });
  if (savedPlayerData) {
    await addPointHistory(classId, savedPlayerData.authUid, savedPlayerData.name, -HEAL_COST, "펫 센터 HP+SP 전체 치료");
  }
  return (await getDoc(playerRef)).data();
}

// 전체 HP 치료 (350P)
export async function healAllPetsHp(classId, playerId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const COST = 350;
  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    if (playerData.points < COST) throw new Error(`포인트가 부족합니다. (필요: ${COST}P)`);
    const pets = playerData.pets || [];
    if (pets.every(p => p.hp === p.maxHp)) throw new Error("모든 펫의 HP가 이미 가득 찼습니다.");
    const healedPets = pets.map(pet => ({ ...pet, hp: pet.maxHp }));
    transaction.update(playerRef, { pets: healedPets, points: increment(-COST) });
  }).then(async () => {
    const d = await getDoc(playerRef);
    const pd = d.data();
    await addPointHistory(classId, pd.authUid, pd.name, -COST, "펫 센터 전체 HP 치료");
    return d.data();
  });
}

// 전체 HP+SP 치료 (600P)
export async function healAllPets(classId, playerId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const playerRef = doc(db, "classes", classId, "players", playerId);
  const HEAL_ALL_COST = 600;
  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error("플레이어 정보를 찾을 수 없습니다.");
    const playerData = playerDoc.data();
    if (playerData.points < HEAL_ALL_COST) throw new Error(`포인트가 부족합니다. (필요: ${HEAL_ALL_COST}P)`);
    const pets = playerData.pets || [];
    if (pets.every(p => p.hp === p.maxHp && p.sp === p.maxSp)) throw new Error("모든 펫이 이미 건강합니다.");
    const healedPets = pets.map(pet => ({ ...pet, hp: pet.maxHp, sp: pet.maxSp }));
    transaction.update(playerRef, { pets: healedPets, points: increment(-HEAL_ALL_COST) });
  }).then(async () => {
    const d = await getDoc(playerRef);
    const pd = d.data();
    await addPointHistory(classId, pd.authUid, pd.name, -HEAL_ALL_COST, "펫 센터 전체 HP+SP 치료");
    return d.data();
  });
}
// =================================================================
// ▼▼▼ [수정] 실시간 배틀 시스템을 위한 함수들 ▼▼▼
// =================================================================

/**
 * 새로운 배틀 문서를 생성하거나 기존 배틀에 참가합니다.
 * @param {string} classId 학급 ID
 * @param {string} matchId 경기 ID
 * @param {object} myPlayerData 내 플레이어 데이터
 * @param {object} opponentPlayerData 상대 플레이어 데이터
 * @param {object} randomQuiz 배틀에 사용할 퀴즈 객체
 * @returns {string} 배틀 문서 ID
 */
// ▼▼▼ [수정] createOrJoinBattle 함수가 randomQuiz를 인자로 받도록 변경 ▼▼▼
// src/api/firebase.js

export async function createOrJoinBattle(classId, matchId, myPlayerData, opponentPlayerData, randomQuiz) {
  const battleRef = doc(db, "classes", classId, "battles", matchId);
  const battleSnap = await getDoc(battleRef);

  if (battleSnap.exists() && battleSnap.data().gameState) {
    return matchId;
  }

  let myPet = { ...myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) };
  let opponentPet = { ...opponentPlayerData.pets.find(p => p.id === opponentPlayerData.partnerPetId) };

  // ▼▼▼ [버프 적용] 시작 시 발동하는 스탯 보너스 ▼▼▼
  // 1. 숨은 영웅(god_of_tidiness): 최대 HP 5% 쉴드 보너스
  if (myPlayerData.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(myPet.maxHp * 0.05);
    myPet.hp += shield;
  }
  if (opponentPlayerData.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(opponentPet.maxHp * 0.05);
    opponentPet.hp += shield;
  }

  // 2. [변경] 인기스타(popular_star): 초기 SP 20% 오버차지
  if (myPlayerData.equippedTitle === 'popular_star') {
    myPet.sp = Math.floor(myPet.maxSp * 1.2);
  }
  if (opponentPlayerData.equippedTitle === 'popular_star') {
    opponentPet.sp = Math.floor(opponentPet.maxSp * 1.2);
  }
  // ▲▲▲ [버프 적용 끝] ▲▲▲

  const firstTurnPlayerId = Math.random() < 0.5 ? myPlayerData.id : opponentPlayerData.id;

  const initialBattleState = {
    matchId: matchId,
    playerA: { id: myPlayerData.id, name: myPlayerData.name, pet: { ...myPet, status: {} }, equippedTitle: myPlayerData.equippedTitle },
    playerB: { id: opponentPlayerData.id, name: opponentPlayerData.name, pet: { ...opponentPet, status: {} }, equippedTitle: opponentPlayerData.equippedTitle },
    turn: firstTurnPlayerId,
    gameState: 'TURN_START',
    log: `${myPlayerData.name}이(가) ${opponentPlayerData.name}에게 대결을 신청했습니다!`,
    currentQuestion: randomQuiz,
    winner: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(battleRef, initialBattleState, { merge: true });
  return matchId;
}

/**
 * 배틀 상태에 대한 실시간 리스너를 설정합니다.
 */
export function listenToBattle(classId, battleId, callback) {
  const battleRef = doc(db, "classes", classId, "battles", battleId);
  return onSnapshot(battleRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}

/**
 * 플레이어의 행동을 받아 배틀 상태를 업데이트합니다.
 */
// ▼▼▼ [수정] submitBattleAction 함수에 allQuizzesData를 인자로 전달 ▼▼▼
// src/api/firebase.js 내부 submitBattleAction 함수 교체

export async function submitBattleAction(classId, battleId, actionData, allQuizzesData) {
  const battleRef = doc(db, "classes", classId, "battles", battleId);

  if (actionData.type === 'item') {
    const playerRef = doc(db, 'classes', classId, 'players', actionData.playerId);

    await runTransaction(db, async (transaction) => {
      const playerDoc = await transaction.get(playerRef);
      const playerData = playerDoc.data();

      if (playerData.petInventory[actionData.itemId] > 0) {
        playerData.petInventory[actionData.itemId] -= 1;
      }

      const targetPet = playerData.pets.find(p => p.id === playerData.partnerPetId);
      const healHp = Math.floor(targetPet.maxHp * 0.30);
      const healSp = Math.floor(targetPet.maxSp * 0.30);

      targetPet.hp = Math.min(targetPet.maxHp, targetPet.hp + healHp);
      targetPet.sp = Math.min(targetPet.maxSp, targetPet.sp + healSp);

      transaction.update(playerRef, {
        petInventory: playerData.petInventory,
        pets: playerData.pets
      });

      transaction.update(battleRef, {
        [`actions.${actionData.playerId}`]: actionData,
        logs: arrayUnion(`${playerData.name}의 펫이 두뇌 간식을 먹고 체력을 회복했습니다! (HP +${healHp})`)
      });
    });
    return;
  }

  return runTransaction(db, async (transaction) => {
    const battleDoc = await transaction.get(battleRef);
    if (!battleDoc.exists()) throw new Error("배틀을 찾을 수 없습니다.");

    let battleData = battleDoc.data();
    if (battleData.gameState === 'FINISHED') return;

    const { type, payload } = actionData;
    // ▼ [수정됨] 띄어쓰기 오타 해결
    const isPlayerA_Turn = battleData.turn === battleData.playerA.id;

    const attackerKey = isPlayerA_Turn ? 'playerA' : 'playerB';
    const defenderKey = isPlayerA_Turn ? 'playerB' : 'playerA';

    let attacker = battleData[attackerKey];
    let defender = battleData[defenderKey];
    let newBattleData = { ...battleData };

    switch (type) {
      case 'quiz':
        const { userAnswer } = payload;
        const isCorrect = userAnswer.trim().toLowerCase() === newBattleData.currentQuestion.answer.toLowerCase();
        if (isCorrect) {
          if (attacker.equippedTitle === 'daily_helper') {
            newBattleData.log = "💡 일타강사의 명쾌한 정답! 공격 주도권을 완벽히 잡았습니다!";
          } else {
            newBattleData.log = "정답! 행동을 선택하세요!";
          }
          newBattleData.gameState = 'ACTION';
        } else {
          newBattleData.log = `오답! 상대방 턴! (정답: ${newBattleData.currentQuestion.answer})`;
          newBattleData.turn = defender.id;
          newBattleData.gameState = 'TURN_START';
        }
        break;

      case 'attack':
        const { skillId } = payload;
        const skill = SKILLS[skillId.toUpperCase()];

        if (attacker.pet.sp < skill.cost) {
          newBattleData.log = "SP가 부족하여 스킬을 사용할 수 없습니다!";
          newBattleData.gameState = 'ACTION';
          break;
        }

        if (skill.cost > 0) attacker.pet.sp -= skill.cost;

        if (skillId.toLowerCase() === 'charge') {
          let spGain = 20;
          if (attacker.equippedTitle === 'idea_bank') {
            spGain = Math.floor(spGain * 1.2);
          }
          attacker.pet.sp = Math.min(attacker.pet.maxSp, attacker.pet.sp + spGain);

          let treeHeal = 0;
          if (attacker.equippedTitle === 'diligent_tree') {
            treeHeal = Math.floor(attacker.pet.maxHp * 0.02);
            attacker.pet.hp = Math.min(attacker.pet.maxHp, attacker.pet.hp + treeHeal);
          }

          newBattleData.log = `${attacker.name}의 펫이 집중하여 에너지를 모았습니다! (SP +${spGain})${treeHeal > 0 ? ` [성실한 나무 효과로 HP +${treeHeal} 회복]` : ''}`;
        } else {
          let baseDamage = Math.floor(attacker.pet.atk * skill.multiplier);

          if (attacker.equippedTitle === 'goal_machine') {
            baseDamage = Math.floor(baseDamage * 1.05);
          }

          let isCritical = false;
          if (attacker.equippedTitle === 'ruler_of_the_league' && Math.random() < 0.15) {
            baseDamage = Math.floor(baseDamage * 1.5);
            isCritical = true;
          }

          if (defender.equippedTitle === 'icon_of_diligence') {
            baseDamage = Math.floor(baseDamage * 0.95);
          }
          if (defender.equippedTitle === 'star_of_compliments') {
            baseDamage = Math.floor(baseDamage * 0.97);
          }

          const finalDamage = Math.max(1, baseDamage);
          defender.pet.hp = Math.max(0, defender.pet.hp - finalDamage);

          let treeHeal = 0;
          if (attacker.equippedTitle === 'diligent_tree') {
            treeHeal = Math.floor(attacker.pet.maxHp * 0.02);
            attacker.pet.hp = Math.min(attacker.pet.maxHp, attacker.pet.hp + treeHeal);
          }

          newBattleData.log = `${isCritical ? '💥 [치명타 매치!] ' : ''}${attacker.name}의 펫이 [${skill.name}] 스킬을 사용하여 ${defender.name}의 펫에게 ${finalDamage}의 데미지를 입혔습니다!${treeHeal > 0 ? ` (성실한 나무 효과로 HP +${treeHeal} 회복)` : ''}`;
        }

        if (defender.pet.hp <= 0) {
          defender.pet.hp = 0;
          newBattleData.gameState = 'FINISHED';
          newBattleData.winner = attacker.id;
          newBattleData.log = `🏆 ${attacker.name}의 펫이 승리했습니다!`;
        } else {
          newBattleData.turn = defender.id;
          newBattleData.gameState = 'TURN_START';
        }
        break;
    }

    if (newBattleData.gameState === 'TURN_START') {
      const allQuizList = Object.values(allQuizzesData).flat();
      newBattleData.currentQuestion = allQuizList[Math.floor(Math.random() * allQuizList.length)];
    }

    transaction.update(battleRef, newBattleData);
  });
}

// M3_BATTLE_TEAM_DATA_ON_CREATE_PATCH
// 현재는 1펫 배틀을 유지하되, 배틀 문서에 team/activePetIndex/activePetId 구조를 함께 저장합니다.
// 이후 2펫/3펫 선택 기능이 들어오면 이 helper의 team 인자만 확장하면 됩니다.
const createBattleParticipantSnapshot = (player, battlePet, extra = {}, teamPets = null) => {
  // M4_CHALLENGER_TEAM_SELECT_PATCH
  // battlePet은 선발 펫, teamPets는 선발+대기 펫 목록입니다.
  const rawTeam = Array.isArray(teamPets) && teamPets.length > 0 ? teamPets : [battlePet];

  let safeTeam = rawTeam
    .filter(Boolean)
    .map(pet => ({
      ...pet,
      status: { ...(pet?.status || {}) },
    }));

  const activeIndexById = safeTeam.findIndex(pet => pet?.id === battlePet?.id);
  const activePetIndex = activeIndexById >= 0 ? activeIndexById : 0;

  // M20_TITLE_EFFECTS_TEAM_BATTLE_FIX
  // 숨은 영웅 HP 실드 / 인기스타 SP 오버차지처럼 battlePet에 적용된 시작 버프가
  // 다중 배틀 team[activePetIndex] 원본으로 덮여 사라지지 않도록 active slot에 다시 반영합니다.
  const activeTeamPet = safeTeam[activePetIndex] || {};
  const safePet = battlePet?.id
    ? {
        ...activeTeamPet,
        ...battlePet,
        status: {
          ...(activeTeamPet.status || {}),
          ...(battlePet.status || {}),
        },
      }
    : {
        ...activeTeamPet,
        status: { ...(activeTeamPet.status || {}) },
      };

  if (safePet?.id) {
    safeTeam = safeTeam.length > 0
      ? safeTeam.map((pet, index) => (
          index === activePetIndex
            ? safePet
            : { ...pet, status: { ...(pet?.status || {}) } }
        ))
      : [safePet];
  }

  return {
    id: player.id,
    name: player.name,
    pet: safePet,
    team: safeTeam.length > 0 ? safeTeam : [safePet],
    activePetIndex,
    activePetId: safePet.id || null,
    participatedPetIds: safePet.id ? [safePet.id] : [],
    equippedTitle: player.equippedTitle || null,
    avatarSnapshotUrl: player.avatarSnapshotUrl || null,
    photoURL: player.photoURL || null,
    ...extra,
  };
};

export async function createBattleChallenge(classId, challengerObj, opponentObj, options = {}) {
  if (!classId || !challengerObj?.id || !opponentObj?.id) {
    throw new Error("챌린지 생성에 필요한 정보가 부족합니다.");
  }

  // ▼▼▼ [추가] 주말(토·일) 배틀 차단 (관리자는 제외) ▼▼▼
  const isAdminChallenger = challengerObj?.role === 'admin';
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일, 6=토
  if (!isAdminChallenger && (dayOfWeek === 0 || dayOfWeek === 6)) {
    throw new Error("주말에는 배틀을 진행할 수 없습니다. 🗓️\n월요일에 다시 도전해보세요!");
  }

  // ▼▼▼ [추가] 관리자 배틀 ON/OFF 체크 ▼▼▼
  const classSnap = await getDoc(doc(db, 'classes', classId));
  if (classSnap.exists() && classSnap.data().battleEnabled === false) {
    throw new Error("현재 선생님이 배틀 기능을 일시 중지했습니다. ⚔️\n잠시 후 다시 시도해주세요.");
  }

  const challengerId = challengerObj.id;
  const opponentId = opponentObj.id;

  // 1. 최신 정보 조회
  const challengerRef = doc(db, 'classes', classId, 'players', challengerId);
  const [challengerSnap, opponentSnap] = await Promise.all([
    getDoc(challengerRef),
    getDoc(doc(db, 'classes', classId, 'players', opponentId))
  ]);

  if (!challengerSnap.exists() || !opponentSnap.exists()) throw new Error("선수 정보를 찾을 수 없습니다.");

  const challenger = { id: challengerSnap.id, ...challengerSnap.data() };
  const opponent = { id: opponentSnap.id, ...opponentSnap.data() };

  // -----------------------------------------------------------
  // ▼▼▼ [추가] 상대방이 현재 '다른 사람'과 대결 중인지 확인 ▼▼▼
  // -----------------------------------------------------------
  const battlesRef = collection(db, 'classes', classId, 'battles');
  // 배틀 진행 중으로 간주할 상태 목록 (pending 포함)
  const activeStatuses = ['pending', 'starting', 'quiz', 'action', 'resolution', 'switching', 'pending_switch'];

  // 1. 상대방이 '도전자(challenger)'로서 대결 중인 경우 조회
  const q1 = query(
    battlesRef,
    where('challenger.id', '==', opponent.id),
    where('status', 'in', activeStatuses)
  );

  // 2. 상대방이 '상대(opponent)'로서 대결 중인 경우 조회
  const q2 = query(
    battlesRef,
    where('opponent.id', '==', opponent.id),
    where('status', 'in', activeStatuses)
  );

  // 3. 내가 '도전자(challenger)'로서 이미 대결 중인 경우 조회
  const q3 = query(
    battlesRef,
    where('challenger.id', '==', challenger.id),
    where('status', 'in', activeStatuses)
  );

  // 4. 내가 '상대(opponent)'로서 이미 대결 중인 경우 조회
  const q4 = query(
    battlesRef,
    where('opponent.id', '==', challenger.id),
    where('status', 'in', activeStatuses)
  );

  const [busyAsChallenger, busyAsOpponent, meBusyAsChallenger, meBusyAsOpponent] = await Promise.all([
    getDocs(q1), getDocs(q2), getDocs(q3), getDocs(q4)
  ]);

  const now = Date.now();
  // 좀비 판정 기준: pending은 5분, 그 외 active는 3분 이상 무활동
  const isZombie = (docData) => {
    const status = docData.status;
    const lastActivity = docData.turnStartTime || docData.createdAt?.toMillis() || 0;
    const elapsed = now - lastActivity;
    if (status === 'pending') return elapsed > 5 * 60 * 1000;
    return elapsed > 3 * 60 * 1000;
  };

  // 좀비 배틀 자동 cancelled 처리 (비동기, 결과를 기다리지 않아도 됨)
  const allActiveDocs = [
    ...busyAsChallenger.docs,
    ...busyAsOpponent.docs,
    ...meBusyAsChallenger.docs,
    ...meBusyAsOpponent.docs,
  ];
  const uniqueZombies = new Map();
  allActiveDocs.forEach(d => {
    if (isZombie(d.data()) && !uniqueZombies.has(d.id)) {
      uniqueZombies.set(d.id, d.ref);
    }
  });
  if (uniqueZombies.size > 0) {
    const zombieBatch = writeBatch(db);
    uniqueZombies.forEach((ref) => {
      zombieBatch.update(ref, { status: 'cancelled', log: '⏰ 무활동으로 자동 종료된 배틀입니다.' });
    });
    zombieBatch.commit().catch(e => console.warn('좀비 배틀 정리 실패:', e));
  }

  // 살아있는(non-zombie) 배틀만 충돌 판정에 사용
  const opponentLiveBattles = [
    ...busyAsChallenger.docs,
    ...busyAsOpponent.docs,
  ].filter(d => !isZombie(d.data()));

  if (opponentLiveBattles.length > 0) {
    throw new Error("상대방이 현재 다른 친구와 대결을 진행 중입니다. 잠시 후에 신청해주세요.");
  }

  // 내가 이미 다른 배틀에 참여 중인 경우 (현재 신청할 상대와의 배틀 제외, 좀비 제외)
  const battleId = [challenger.id, opponent.id].sort().join('_');
  const myActiveBattles = [
    ...meBusyAsChallenger.docs,
    ...meBusyAsOpponent.docs,
  ].filter(d => d.id !== battleId && !isZombie(d.data()));

  if (myActiveBattles.length > 0) {
    throw new Error("이미 다른 대결이 진행 중입니다. 기존 대결을 완료하거나 취소 후 신청해주세요.");
  }
  // ▲▲▲ [추가 끝] ▲▲▲

  // 쿨타임 체크 (3분)
  if (challenger.battleCooldowns && challenger.battleCooldowns[opponentId]) {
    const cooldownTime = challenger.battleCooldowns[opponentId];
    const now = Date.now();
    const remainingTime = cooldownTime - now;
    if (remainingTime > 0) {
      const minutes = Math.floor(remainingTime / 60000);
      const seconds = Math.floor((remainingTime % 60000) / 1000);
      throw new Error(`거절당한 상대입니다. 잠시 뒤 다시 신청해주세요. (${minutes}분 ${seconds}초 남음)`);
    }
  }

  if (!challenger.partnerPetId || !opponent.partnerPetId) throw new Error("양쪽 플레이어 모두 파트너 펫을 선택해야 합니다.");


  // =========================================================
  // ▼▼▼ [수정] 펫 정보 가져오기 및 숨은 영웅 쉴드 버프 부여 ▼▼▼
  // =========================================================
  let challengerPets = challenger.pets || [];
  let opponentPets = opponent.pets || [];

  // M4_CHALLENGER_TEAM_SELECT_PATCH
  // 신청자가 선택한 선발/대기 펫을 battle team으로 구성합니다.
  // 아직 수락자 쪽 선택 플로우는 없으므로 opponent는 기존 파트너 펫 1마리만 사용합니다.
  const buildBattleTeamFromIds = (pets, requestedPetIds, fallbackPetId, maxTeamSize = 3) => {
    const alivePets = (pets || []).filter(pet => Number(pet?.hp ?? 0) > 0);
    const byId = new Map(alivePets.map(pet => [pet.id, pet]));

    const normalizedIds = Array.isArray(requestedPetIds)
      ? requestedPetIds.filter(Boolean)
      : [];

    const picked = [];
    normalizedIds.forEach(id => {
      const pet = byId.get(id);
      if (pet && !picked.some(existing => existing.id === pet.id)) {
        picked.push(pet);
      }
    });

    if (picked.length === 0 && fallbackPetId && byId.has(fallbackPetId)) {
      picked.push(byId.get(fallbackPetId));
    }

    if (picked.length === 0 && alivePets[0]) {
      picked.push(alivePets[0]);
    }

    return picked.slice(0, maxTeamSize).map(pet => ({
      ...pet,
      status: { ...(pet.status || {}) },
    }));
  };

  const challengerRequestedTeamIds = Array.isArray(options?.challengerTeamPetIds)
    ? options.challengerTeamPetIds
    : [];

  const opponentRequestedTeamIds = Array.isArray(options?.opponentTeamPetIds)
    ? options.opponentTeamPetIds
    : [];

  const opponentAlivePetCount = (opponentPets || []).filter(pet => Number(pet?.hp ?? 0) > 0).length;
  const challengerTeamLimit = Math.min(3, Math.max(1, opponentAlivePetCount));

  // M11C_CAP_TEAM_SIZE_BY_OPPONENT_PATCH
  // 클라이언트가 우회되더라도 신청자 팀은 피신청자의 생존 펫 수보다 크게 만들 수 없습니다.
  const challengerBattleTeam = buildBattleTeamFromIds(challengerPets, challengerRequestedTeamIds, challenger.partnerPetId, challengerTeamLimit);
  const opponentBattleTeam = buildBattleTeamFromIds(opponentPets, opponentRequestedTeamIds, opponent.partnerPetId, 3);

  // (중요) DB에 영구적으로 체력이 늘어나지 않도록 얕은 복사(...)를 사용합니다.
  let challengerPet = { ...(challengerBattleTeam[0] || {}) };
  let opponentPet = { ...(opponentBattleTeam[0] || {}) };

  if (!challengerPet?.id) throw new Error("나의 출전 가능한 펫을 찾을 수 없습니다.");
  if (!opponentPet?.id) throw new Error("상대방의 출전 가능한 펫을 찾을 수 없습니다.");

  // M20_TITLE_EFFECTS_TEAM_BATTLE_FIX
  // [시작 버프] 숨은 영웅(god_of_tidiness): 배틀 시작 시 최대 HP 5% 실드 부여
  // hp가 maxHp를 넘으면 BattleHpBar에서 보라색 실드 구간으로 표시됩니다.
  if (challenger.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(Number(challengerPet.maxHp ?? 0) * 0.05);
    challengerPet.hp = Number(challengerPet.hp ?? 0) + shield;
  }
  if (opponent.equippedTitle === 'god_of_tidiness') {
    const shield = Math.floor(Number(opponentPet.maxHp ?? 0) * 0.05);
    opponentPet.hp = Number(opponentPet.hp ?? 0) + shield;
  }

  // [시작 버프] 인기스타(popular_star): 배틀 시작 시 SP 20% 오버차지
  // sp가 maxSp를 넘으면 BattleSpBar에서 노란색 오버차지 구간으로 표시됩니다.
  if (challenger.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(Number(challengerPet.maxSp ?? 0) * 0.2);
    challengerPet.sp = Number(challengerPet.maxSp ?? challengerPet.sp ?? 0) + bonusSp;
  }
  if (opponent.equippedTitle === 'popular_star') {
    const bonusSp = Math.floor(Number(opponentPet.maxSp ?? 0) * 0.2);
    opponentPet.sp = Number(opponentPet.maxSp ?? opponentPet.sp ?? 0) + bonusSp;
  }
  // ▲▲▲ [버프 적용 완료] ▲▲▲
  // M20C_TEAM_TITLE_AND_FOCUS_ACTIONS_PATCH
  // 다중 펫 배틀에서는 편성된 팀 전체가 "배틀 시작" 상태에 들어간 것으로 봅니다.
  // 숨은 영웅 HP 실드와 인기스타 SP 오버차지를 선발 1마리뿐 아니라 팀 전체에 적용합니다.
  const applyBattleStartTitleEffectsToTeam = (team, equippedTitle) => {
    const safeTeam = Array.isArray(team) && team.length > 0 ? team : [];

    return safeTeam.map((pet) => {
      const nextPet = {
        ...pet,
        status: { ...(pet?.status || {}) },
      };

      if (!nextPet?.id) return nextPet;

      if (equippedTitle === 'god_of_tidiness') {
        const shield = Math.floor(Number(nextPet.maxHp ?? 0) * 0.05);
        nextPet.hp = Number(nextPet.hp ?? 0) + shield;
      }

      if (equippedTitle === 'popular_star') {
        const bonusSp = Math.floor(Number(nextPet.maxSp ?? 0) * 0.2);
        nextPet.sp = Number(nextPet.maxSp ?? nextPet.sp ?? 0) + bonusSp;
      }

      return nextPet;
    });
  };

  const challengerBattleTeamWithTitleEffects = applyBattleStartTitleEffectsToTeam(challengerBattleTeam, challenger.equippedTitle);
  const opponentBattleTeamWithTitleEffects = applyBattleStartTitleEffectsToTeam(opponentBattleTeam, opponent.equippedTitle);

  // 기존 active pet에만 적용되던 시작 버프 값은 팀 전체 버프 결과로 다시 확정합니다.
  challengerPet = { ...(challengerBattleTeamWithTitleEffects[0] || challengerPet), status: { ...((challengerBattleTeamWithTitleEffects[0] || challengerPet)?.status || {}) } };
  opponentPet = { ...(opponentBattleTeamWithTitleEffects[0] || opponentPet), status: { ...((opponentBattleTeamWithTitleEffects[0] || opponentPet)?.status || {}) } };

  // 기절 상태 체크
  if (challengerPet.hp <= 0) throw new Error("나의 펫이 기절 상태입니다. 펫 센터에서 치료 후 신청해주세요.");
  if (opponentPet.hp <= 0) throw new Error("상대방의 펫이 기절 상태라 대결을 신청할 수 없습니다.");

  // ▼▼▼ 하루 배틀 횟수 제한 로직 (펫별 10회, 관리자 제외) ▼▼▼
  const todayStr = new Date().toLocaleDateString();
  let dailyCount = challengerPet.dailyBattleCount || 0;

  // 날짜가 바뀌었으면 카운트 초기화
  if (challengerPet.lastBattleDate !== todayStr) {
    dailyCount = 0;
  }

  // 10회 이상이면 차단 (관리자는 무제한)
  if (!isAdminChallenger && dailyCount >= 10) {
    throw new Error(`'${challengerPet.name}'(은)는 오늘 너무 지쳤어요! 🛌\n파트너펫을 교체하여 배틀을 진행해주세요.`);
  }

  // ★ 배틀 횟수는 신청 시점이 아닌 실제 배틀 수락(starting) 시점에 증가시킴
  // (거절/취소/무응답으로 소모되는 횟수 방지)

  const battleRef = doc(db, 'classes', classId, 'battles', battleId);
  const battleSnap = await getDoc(battleRef);

  // ★ 좀비 배틀(멈춘 방) 정리 및 재입장 로직
  if (battleSnap.exists()) {
    const data = battleSnap.data();
    const status = data.status;
    const lastActivity = data.turnStartTime || data.createdAt?.toMillis() || 0;
    const timeSinceLastActivity = Date.now() - lastActivity;

    if (status === 'pending') {
      if (data.challenger.id === challenger.id) return battleId; // 내 방이면 재입장
      if (data.opponent.id === challenger.id) {
        if (timeSinceLastActivity < 5 * 60 * 1000) throw new Error("상대방이 이미 대결을 신청해둔 상태입니다.");
      }
    }

    // 진행 중인데 1분 이상 멈춰있으면 좀비 방 -> 덮어쓰기 허용
    if (['starting', 'quiz', 'action', 'resolution'].includes(status)) {
      if (timeSinceLastActivity <= 60 * 1000) {
        return battleId; // 정상 진행 중이면 재입장
      }
    }
  }

  // 새 배틀 생성 (덮어쓰기)
  const battleTeamSize = Math.max(challengerBattleTeamWithTitleEffects.length, opponentBattleTeamWithTitleEffects.length);
  const battleMode = battleTeamSize > 1 ? 'team-preview' : 'single';

  const battleData = {
    id: battleId,
    status: 'pending',
    battleSchemaVersion: 2,
    battleMode,
    teamSize: battleTeamSize,
    // 칭호가 없을 경우 undefined 대신 null을 넣도록 방어 처리!
    challenger: createBattleParticipantSnapshot(challenger, challengerPet, {}, challengerBattleTeamWithTitleEffects),
    opponent: createBattleParticipantSnapshot(opponent, opponentPet, { accepted: false }, opponentBattleTeamWithTitleEffects),
    log: `${challenger.name}님이 ${opponent.name}님에게 대결을 신청했습니다!`,
    turn: null,
    question: null,
    turnStartTime: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(battleRef, battleData);
  createNotification(opponent.authUid, '⚔️ 대결 신청!', `${challenger.name}님이 퀴즈 대결을 신청했습니다!`, 'battle_request');

  return battleId;
}

// [2. 수정] 배틀 거절 (쿨타임 부여) //
export async function rejectBattleChallenge(classId, battleId) {
  if (!classId || !battleId) return;
  const battleRef = doc(db, 'classes', classId, 'battles', battleId);
  const battleSnap = await getDoc(battleRef);
  if (!battleSnap.exists()) return;

  await updateDoc(battleRef, { status: 'rejected', log: '상대방이 대결을 거절했습니다.' });

  // 신청자에게 쿨타임 부여
  const { challenger } = battleSnap.data();
  if (challenger && challenger.id) {
    const challengerRef = doc(db, 'classes', classId, 'players', challenger.id);
    const cooldownKey = `battleCooldowns.${battleSnap.data().opponent.id}`;
    const expireTime = Date.now() + (3 * 60 * 1000);
    await updateDoc(challengerRef, { [cooldownKey]: expireTime });
  }
}

// [3. 추가] 배틀 신청 취소
export async function cancelBattleChallenge(classId, battleId) {
  if (!classId || !battleId) return;
  const battleRef = doc(db, 'classes', classId, 'battles', battleId);
  await updateDoc(battleRef, { status: 'cancelled', log: '배틀 신청이 취소되었습니다.' });
}

/**
 * [관리자용] 학급 내 모든 좀비 배틀(무활동 상태)을 cancelled로 정리합니다.
 * @param {string} classId
 * @returns {{ cleaned: number, details: Array }} 정리된 배틀 수와 상세 정보
 */
export async function adminCleanupZombieBattles(classId) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  const battlesRef = collection(db, 'classes', classId, 'battles');
  const activeStatuses = ['pending', 'starting', 'quiz', 'action', 'resolution', 'switching', 'pending_switch'];
  const q = query(battlesRef, where('status', 'in', activeStatuses));
  const snapshot = await getDocs(q);

  const now = Date.now();
  const zombies = snapshot.docs.filter(d => {
    const data = d.data();
    const lastActivity = data.turnStartTime || data.createdAt?.toMillis() || 0;
    const elapsed = now - lastActivity;
    if (data.status === 'pending') return elapsed > 5 * 60 * 1000;  // pending: 5분
    return elapsed > 3 * 60 * 1000;  // 그 외: 3분
  });

  if (zombies.length === 0) return { cleaned: 0, details: [] };

  const batch = writeBatch(db);
  const details = [];
  zombies.forEach(d => {
    const data = d.data();
    batch.update(d.ref, { status: 'cancelled', log: '⏰ 관리자에 의해 정리된 배틀입니다.' });
    details.push({
      id: d.id,
      status: data.status,
      challenger: data.challenger?.name || '?',
      opponent: data.opponent?.name || '?',
    });
  });
  await batch.commit();
  return { cleaned: zombies.length, details };
}

/**
 * 배틀 채팅 메시지를 업데이트합니다. (정답/오답 여부 포함)
 * @param {string} classId - 학급 ID
 * @param {string} battleId - 배틀 ID
 * @param {string} playerId - 메시지를 보낸 플레이어 ID
 * @param {string} message - 메시지 내용
 * @param {boolean} isCorrect - 정답 여부
 */
export async function updateBattleChat(classId, battleId, playerId, message, isCorrect) {
  if (!classId || !battleId || !playerId) return;
  const battleRef = doc(db, "classes", classId, "battles", battleId);

  const chatData = {
    text: message,
    isCorrect: isCorrect,
    timestamp: Date.now(), // 타임스탬프 추가
  };

  await updateDoc(battleRef, {
    [`chat.${playerId}`]: chatData
  });

  // 2초 뒤에 해당 플레이어의 채팅만 초기화
  setTimeout(async () => {
    const currentBattleDoc = await getDoc(battleRef);
    if (currentBattleDoc.exists() && currentBattleDoc.data().chat?.[playerId]?.timestamp === chatData.timestamp) {
      await updateDoc(battleRef, {
        [`chat.${playerId}`]: null
      });
    }
  }, 2000);
}

/**
 * [밸런스] 레벨에 따라 스킬 SP 소모량을 스케일링합니다.
 * - Lv 1~14:  기본 비용 × 1.0
 * - Lv 15~29: 기본 비용 × 1.5
 * - Lv 30+:   기본 비용 × 2.0
 * 이렇게 하면 고레벨에서도 SP 관리의 의미가 유지되면서,
 * 쪼렙 때보다 여유롭게 스킬을 쓰는 느낌은 살아있습니다.
 */
export function getScaledSkillCost(baseCost, petLevel) {
  if (baseCost === 0) return 0; // 기본기(몸통박치기)는 항상 무료
  const scale = 1 + Math.floor((petLevel || 1) / 15) * 0.5;
  return Math.round(baseCost * scale);
}

const MAX_PET_LEVEL = 30;

const getRequiredExpForLevel = (level) => {
  // Lv.1 기준 270부터 시작
  return 200 + (level * 70);
};

const getPetStage = (pet) => {
  return parseInt(pet.appearanceId?.match(/_lv(\d)/)?.[1] || '1', 10);
};

const getLevelCapByStage = (pet) => {
  const stage = getPetStage(pet);

  if (stage === 1) return 10;
  if (stage === 2) return 20;
  return MAX_PET_LEVEL;
};

function calculateLevelUp(pet) {
  const leveledUpPet = { ...pet };
  let levelUps = 0;

  leveledUpPet.level = Number(leveledUpPet.level || 1);
  leveledUpPet.exp = Number(leveledUpPet.exp || 0);
  leveledUpPet.maxExp = Number(
    leveledUpPet.maxExp || getRequiredExpForLevel(leveledUpPet.level)
  );

  const levelCap = getLevelCapByStage(leveledUpPet);

  // 현재 진화 단계의 상한에 도달한 경우:
  // 레벨업은 막지만 exp는 보존한다.
  // 그래야 진화 후 calculateLevelUp이 다시 호출될 때 한꺼번에 반영된다.
  if (leveledUpPet.level >= levelCap) {
    leveledUpPet.level = levelCap;
    leveledUpPet.maxExp = getRequiredExpForLevel(levelCap);
    leveledUpPet.isLevelCapped = levelCap < MAX_PET_LEVEL;
    leveledUpPet.isMaxLevel = levelCap >= MAX_PET_LEVEL;
    return { leveledUpPet, levelUps };
  }

  while (
    leveledUpPet.level < levelCap &&
    leveledUpPet.exp >= leveledUpPet.maxExp
  ) {
    leveledUpPet.exp -= leveledUpPet.maxExp;
    leveledUpPet.level += 1;
    levelUps += 1;

    const petData = PET_DATA[leveledUpPet.species];

    if (petData?.growth) {
      leveledUpPet.maxHp += petData.growth.hp;
      leveledUpPet.maxSp += petData.growth.sp;
      leveledUpPet.atk += petData.growth.atk;

      leveledUpPet.hp = Math.min(
        leveledUpPet.maxHp,
        Number(leveledUpPet.hp || 0) + petData.growth.hp
      );

      leveledUpPet.sp = Math.min(
        leveledUpPet.maxSp,
        Number(leveledUpPet.sp || 0) + petData.growth.sp
      );
    }

    leveledUpPet.maxExp = getRequiredExpForLevel(leveledUpPet.level);
  }

  // 레벨업 결과 상한에 도달했을 때
  if (leveledUpPet.level >= levelCap) {
    leveledUpPet.level = levelCap;
    leveledUpPet.maxExp = getRequiredExpForLevel(levelCap);
    leveledUpPet.isLevelCapped = levelCap < MAX_PET_LEVEL;
    leveledUpPet.isMaxLevel = levelCap >= MAX_PET_LEVEL;

    // 30 만렙일 때만 남은 경험치 제거
    // 10/20 진화 대기 상태에서는 경험치를 남겨야 진화 후 한꺼번에 반영됨
    if (levelCap >= MAX_PET_LEVEL) {
      leveledUpPet.exp = 0;
    }
  } else {
    leveledUpPet.isLevelCapped = false;
    leveledUpPet.isMaxLevel = false;
  }

  return { leveledUpPet, levelUps };
}

// 1. 문제집(Quiz Set) 생성
export const createQuizSet = async (quizSetData) => {
  try {
    await addDoc(collection(db, "quiz_sets"), {
      ...quizSetData,
      createdAt: serverTimestamp(),
      playCount: 0, // 푼 횟수
    });
  } catch (error) {
    console.error("Error creating quiz set: ", error);
    throw error;
  }
};

// 2. 문제집 목록 불러오기
export const getQuizSets = async (userId, isAdmin = false) => {
  try {
    const q = query(collection(db, "quiz_sets"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const allSets = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (isAdmin) return allSets;

    // 내 문제집 + 공용 문제집
    return allSets.filter(set => set.creatorId === userId || set.isPublic);
  } catch (error) {
    console.error("Error fetching quiz sets: ", error);
    throw error;
  }
};

// 3. 문제집 삭제
export const deleteQuizSet = async (setId) => {
  try {
    await deleteDoc(doc(db, "quiz_sets", setId));
  } catch (error) {
    console.error("Error deleting quiz set: ", error);
    throw error;
  }
};

// 4. 문제집 공개/비공개 토글
export const toggleQuizSetPublic = async (setId, currentStatus) => {
  try {
    await updateDoc(doc(db, "quiz_sets", setId), {
      isPublic: !currentStatus
    });
  } catch (error) {
    console.error("Error updating quiz set status: ", error);
    throw error;
  }
};

// 5. [학생용] 우리 반에 할당된(활성) 퀴즈 세트 가져오기
export const getActiveQuizSets = async (classId) => {
  try {
    const classDoc = await getDoc(doc(db, "classes", classId));
    if (!classDoc.exists()) return [];

    const data = classDoc.data();
    let setIds = [];

    // 하위 호환성: 옛날 방식(activeQuizSetId)이 있으면 배열로 변환
    if (data.activeQuizSetIds && Array.isArray(data.activeQuizSetIds)) {
      setIds = data.activeQuizSetIds;
    } else if (data.activeQuizSetId) {
      setIds = [data.activeQuizSetId];
    }

    if (setIds.length === 0) return [];

    // 병렬로 모든 퀴즈셋 문서 가져오기
    const promises = setIds.map(id => getDoc(doc(db, "quiz_sets", id)));
    const docs = await Promise.all(promises);

    // 존재하는 것만 필터링해서 반환
    return docs
      .filter(d => d.exists())
      .map(d => ({ id: d.id, ...d.data() }));

  } catch (error) {
    console.error("Error getting active quiz sets:", error);
    return [];
  }
}

// 6. [선생님용] 우리 반 퀴즈 목록 설정하기 (배열 저장)
export const setClassActiveQuizSets = async (classId, quizSetIds) => {
  try {
    await updateDoc(doc(db, "classes", classId), {
      activeQuizSetIds: quizSetIds, // 배열로 저장
      activeQuizSetId: deleteField() // 구버전 필드는 삭제 (청소)
    });
  } catch (error) {
    console.error("Error setting class quiz sets:", error);
    throw error;
  }
}

export async function getClassInfoByInviteCode(inviteCode) {
  try {
    const classesRef = collection(db, "classes");
    const q = query(classesRef, where("inviteCode", "==", inviteCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docData = querySnapshot.docs[0].data();

    // 1. 상세 정보(학교, 학년, 반)가 모두 있는 경우 (신규 생성 로직 대응)
    if (docData.schoolName && docData.grade && docData.classNumber) {
      return `${docData.schoolName} ${docData.grade}학년 ${docData.classNumber}반`;
    }

    // 2. 상세 정보가 없는 경우 (기존 학급) -> 기존 name 필드 반환
    return docData.name || "알 수 없는 학급";
  } catch (error) {
    console.error("학급 정보 조회 실패:", error);
    return null;
  }
}
// =====================================================
// ▼▼▼ [공지사항] 게시판 관련 함수 ▼▼▼
// =====================================================

/**
 * 공지사항 목록 실시간 구독
 */
export function listenNotices(classId, callback) {
  if (!classId) return () => { };
  const noticesRef = collection(db, 'classes', classId, 'notices');
  const q = query(noticesRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const notices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(notices);
  });
}


/**
 * 공지사항 삭제 (교사만 호출)
 */
export async function deleteNotice(classId, noticeId) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  await deleteDoc(doc(db, 'classes', classId, 'notices', noticeId));
}

/**
 * 공지사항에 이미지 업로드 (Firebase Storage)
 */
export async function uploadNoticeImage(classId, file) {
  const storageRef = ref(storage, `classes/${classId}/notices/${Date.now()}_${file.name}`);
  const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true };
  let fileToUpload = file;
  try {
    fileToUpload = await imageCompression(file, options);
  } catch (_) { /* 압축 실패 시 원본 사용 */ }
  const snapshot = await uploadBytes(storageRef, fileToUpload);
  return await getDownloadURL(snapshot.ref);
}

// =====================================================
// ▼▼▼ [배틀 설정] 관리자 ON/OFF + 주말 차단 ▼▼▼
// =====================================================

/**
 * 배틀 활성화 여부 조회
 */
export async function getBattleEnabled(classId) {
  if (!classId) return true;
  const classRef = doc(db, 'classes', classId);
  const snap = await getDoc(classRef);
  if (!snap.exists()) return true;
  const data = snap.data();
  // battleEnabled 필드가 없으면 기본값 true
  return data.battleEnabled !== false;
}

/**
 * 배틀 활성화 여부 설정 (관리자 전용)
 */
export async function setBattleEnabled(classId, enabled) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  await updateDoc(doc(db, 'classes', classId), { battleEnabled: enabled });
}

// =====================================================
// ▼▼▼ [추가] 펫 이름 변경권 소모 + 이름 변경 ▼▼▼
// =====================================================
export async function renamePetWithItem(classId, playerId, petId, newName) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  const playerRef = doc(db, 'classes', classId, 'players', playerId);
  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');
    const data = playerDoc.data();
    const inventory = data.petInventory || {};
    if (!inventory.pet_rename || inventory.pet_rename <= 0) {
      throw new Error('이름 변경권이 없습니다. 펫센터 상점에서 구매하세요!');
    }
    const pets = [...(data.pets || [])];
    const idx = pets.findIndex(p => p.id === petId);
    if (idx === -1) throw new Error('펫을 찾을 수 없습니다.');
    pets[idx] = { ...pets[idx], name: newName };
    transaction.update(playerRef, {
      pets,
      'petInventory.pet_rename': inventory.pet_rename - 1,
    });
    return { pets, remainingRenames: inventory.pet_rename - 1 };
  });
}

// =====================================================
// ▼▼▼ [추가] 펫 분양하기 (삭제 + 포인트 환급) ▼▼▼
// =====================================================
export async function releasePet(classId, playerId, petId) {
  if (!classId) throw new Error('학급 정보가 없습니다.');
  const RELEASE_REWARD = 2500;
  const playerRef = doc(db, 'classes', classId, 'players', playerId);
  return await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) throw new Error('플레이어 정보를 찾을 수 없습니다.');
    const data = playerDoc.data();
    const pets = data.pets || [];
    if (pets.length <= 1) throw new Error('마지막 남은 펫은 분양할 수 없습니다.');
    const pet = pets.find(p => p.id === petId);
    if (!pet) throw new Error('펫을 찾을 수 없습니다.');
    const newPets = pets.filter(p => p.id !== petId);
    // 파트너 펫이 분양된 경우 첫 번째 남은 펫으로 자동 변경
    const newPartnerPetId = data.partnerPetId === petId
      ? (newPets[0]?.id || null)
      : data.partnerPetId;
    transaction.update(playerRef, {
      pets: newPets,
      partnerPetId: newPartnerPetId,
      points: increment(RELEASE_REWARD),
    });
    await addPointHistory(classId, data.authUid, data.name, RELEASE_REWARD, `펫 [${pet.name}] 분양`);
    return { releasedPetName: pet.name, reward: RELEASE_REWARD };
  });
}

// =====================================================
// ▼▼▼ [추가] 공지사항 읽음 처리 ▼▼▼
// =====================================================
export async function markNoticeRead(classId, noticeId, playerId, playerName) {
  if (!classId || !noticeId || !playerId) return;
  const readerRef = doc(db, 'classes', classId, 'notices', noticeId, 'readers', playerId);
  await setDoc(readerRef, { playerId, playerName, readAt: serverTimestamp() }, { merge: true });
}

export function listenNoticeReaders(classId, noticeId, callback) {
  if (!classId || !noticeId) return () => { };
  const q = collection(db, 'classes', classId, 'notices', noticeId, 'readers');
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data())));
}

// =====================================================
// ▼▼▼ [추가] 공지사항 댓글 ▼▼▼
// =====================================================
export async function addNoticeComment(classId, noticeId, playerId, playerName, text) {
  if (!classId || !noticeId || !text?.trim()) return;
  await addDoc(collection(db, 'classes', classId, 'notices', noticeId, 'comments'), {
    playerId, playerName, text: text.trim(), createdAt: serverTimestamp(),
  });
}

export async function deleteNoticeComment(classId, noticeId, commentId) {
  await deleteDoc(doc(db, 'classes', classId, 'notices', noticeId, 'comments', commentId));
}

export function listenNoticeComments(classId, noticeId, callback) {
  if (!classId || !noticeId) return () => { };
  const q = query(
    collection(db, 'classes', classId, 'notices', noticeId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// =====================================================
// ▼▼▼ [추가] 공지사항 하트(좋아요) ▼▼▼
// =====================================================
export async function toggleNoticeHeart(classId, noticeId, playerId) {
  if (!classId || !noticeId || !playerId) return;
  const heartRef = doc(db, 'classes', classId, 'notices', noticeId, 'hearts', playerId);
  const snap = await getDoc(heartRef);
  if (snap.exists()) {
    await deleteDoc(heartRef);
    return false; // 취소
  } else {
    await setDoc(heartRef, { playerId, heartedAt: serverTimestamp() });
    return true; // 추가
  }
}

export function listenNoticeHearts(classId, noticeId, callback) {
  if (!classId || !noticeId) return () => { };
  const q = collection(db, 'classes', classId, 'notices', noticeId, 'hearts');
  return onSnapshot(q, snap => callback(snap.docs.map(d => d.data().playerId)));
}

// =====================================================
// ▼▼▼ [추가] 댓글 신고 기능 ▼▼▼
// =====================================================

/**
 * 댓글 신고 접수
 * @param {object} reportData - { classId, reporterId, reporterName, targetType('myroom'|'mission'), commentId, commentText, commenterName, commenterId, reason, customReason, submissionId, roomId }
 */
export async function reportComment(reportData) {
  const {
    classId, reporterId, reporterName,
    targetType, commentId, commentText,
    commenterName, commenterId,
    reason, customReason,
    submissionId, roomId,
  } = reportData;
  if (!classId || !commentId) throw new Error('필수 정보 누락');

  const reasonLabel = reason === 'abuse' ? '모욕성' : reason === 'spam' ? '도배성' : '기타';
  const preview = commentText.slice(0, 40) + (commentText.length > 40 ? '...' : '');

  await addDoc(collection(db, 'classes', classId, 'commentReports'), {
    classId,
    reporterId,
    reporterName,
    targetType,
    commentId,
    commentText,
    commenterName,
    commenterId,
    reason,
    customReason: customReason || '',
    submissionId: submissionId || null,
    roomId: roomId || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    adminNote: '',
  });

  // 관리자(admin role)에게 notifications 컬렉션으로 실제 알림 전송
  const playersRef = collection(db, 'classes', classId, 'players');
  const adminQuery = query(playersRef, where('role', '==', 'admin'));
  const adminSnapshot = await getDocs(adminQuery);
  adminSnapshot.forEach(userDoc => {
    const adminData = userDoc.data();
    if (adminData.authUid) {
      createNotification(
        adminData.authUid,
        `🚨 댓글 신고: ${commenterName}`,
        `"${preview}" — 사유: ${reasonLabel}`,
        'comment_report',
        '/admin?tab=reports'
      );
    }
  });
}

/**
 * 신고 목록 실시간 구독
 */
export function listenCommentReports(classId, callback) {
  if (!classId) return () => { };
  const q = query(
    collection(db, 'classes', classId, 'commentReports'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * 신고 상태 업데이트 (resolved | dismissed) + 관리자 메모
 */
export async function updateCommentReportStatus(classId, reportId, status, adminNote = '') {
  if (!classId || !reportId) return;
  const reportRef = doc(db, 'classes', classId, 'commentReports', reportId);
  await updateDoc(reportRef, {
    status,
    adminNote,
    resolvedAt: serverTimestamp(),
  });
}

/**
 * 신고된 댓글 삭제 (마이룸 | 미션)
 */
export async function deleteReportedComment(classId, report) {
  if (!classId || !report) return;
  if (report.targetType === 'myroom' && report.roomId) {
    await deleteMyRoomComment(classId, report.roomId, report.commentId);
  } else if (report.targetType === 'mission' && report.submissionId) {
    await deleteMissionComment(classId, report.submissionId, report.commentId);
  }
}

/**
 * 신고자에게 페널티 포인트 차감
 */
export async function applyReportPenalty(classId, playerId, amount, reason) {
  // 차감은 음수 amount로 adjustPlayerPoints 재활용
  await adjustPlayerPoints(classId, playerId, -Math.abs(amount), reason || '댓글 신고 페널티');
}

// =====================================================
// ▼▼▼ [추가] 퀘스트 기능 ▼▼▼
// =====================================================

/**
 * 퀘스트 생성
 * questData: { title, description, reward, maxAcceptors, deadline(optional), icon }
 */
export async function createQuest(classId, questData) {
  if (!classId) return;
  const ref = collection(db, 'classes', classId, 'quests');
  const docRef = await addDoc(ref, {
    ...questData,
    status: 'open',           // open | closed
    acceptors: [],            // [{ playerId, playerName, acceptedAt, completionStatus }]
    createdAt: serverTimestamp(),
    closedAt: null,
  });
  // 전체 학생 알림
  const playersSnap = await getDocs(query(collection(db, 'classes', classId, 'players'), where('role', '!=', 'admin')));
  playersSnap.forEach(d => {
    const p = d.data();
    if (p.authUid) createNotification(p.authUid, `⚔️ 새 퀘스트: ${questData.title}`, questData.description?.slice(0, 60) || '', 'quest', '/missions');
  });
  return docRef.id;
}

/** 퀘스트 수정 */
export async function updateQuest(classId, questId, updates) {
  if (!classId || !questId) return;
  await updateDoc(doc(db, 'classes', classId, 'quests', questId), updates);
}

/** 퀘스트 삭제 */
export async function deleteQuest(classId, questId) {
  if (!classId || !questId) return;
  await deleteDoc(doc(db, 'classes', classId, 'quests', questId));
}

/** 퀘스트 실시간 구독 */
export function listenQuests(classId, callback) {
  if (!classId) return () => { };
  const q = query(collection(db, 'classes', classId, 'quests'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

/**
 * 퀘스트 수락 (선착순 트랜잭션)
 * 반환값: 'accepted' | 'full' | 'already'
 */
export async function acceptQuest(classId, questId, player) {
  if (!classId || !questId) return;
  const questRef = doc(db, 'classes', classId, 'quests', questId);
  let result = 'accepted';
  let questTitle = '';

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(questRef);
    if (!snap.exists()) throw new Error('퀘스트를 찾을 수 없습니다.');
    const data = snap.data();
    questTitle = data.title || '';

    const acceptors = data.acceptors || [];
    if (acceptors.some(a => a.playerId === player.id)) { result = 'already'; return; }
    if (acceptors.length >= (data.maxAcceptors || 1)) { result = 'full'; return; }

    transaction.update(questRef, {
      acceptors: arrayUnion({ playerId: player.id, playerName: player.name, acceptedAt: new Date().toISOString(), completionStatus: 'accepted' })
    });
  });

  // 수락 성공 시 학생에게 알림, 관리자에게도 알림
  if (result === 'accepted' && questTitle) {
    // 학생 본인에게 알림
    if (player.authUid) {
      createNotification(player.authUid, `⚔️ 퀘스트 수락됨`, `'${questTitle}' 퀘스트를 수락했습니다. 완료 후 선생님께 확인 요청하세요!`, 'quest', '/missions');
    }
    // 관리자(admin role)에게 알림
    try {
      const adminsSnap = await getDocs(query(collection(db, 'classes', classId, 'players'), where('role', '==', 'admin')));
      adminsSnap.forEach(d => {
        const a = d.data();
        if (a.authUid) createNotification(a.authUid, `⚔️ 퀘스트 수락`, `${player.name} 학생이 '${questTitle}' 퀘스트를 수락했습니다.`, 'quest', null);
      });
    } catch (e) { /* 알림 실패는 무시 */ }
  }

  return result;
}

/**
 * 퀘스트 완료 처리 (관리자) — 포인트 지급 포함
 */
export async function completeQuestForPlayer(classId, questId, playerId, playerName, reward, heartReward = 0) {
  if (!classId) return;
  const questRef = doc(db, 'classes', classId, 'quests', questId);
  const snap = await getDoc(questRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const newAcceptors = data.acceptors.map(a =>
    a.playerId === playerId ? { ...a, completionStatus: 'completed' } : a
  );
  await updateDoc(questRef, { acceptors: newAcceptors });

  // 포인트 지급 (heartReward 포함하여 PointAdjustmentModal에 표시)
  const questTitle = `✅ 퀘스트 승인: ${data.title}`;
  await adjustPlayerPoints(
    classId,
    playerId,
    reward,
    `퀘스트 완료: ${data.title}`,
    heartReward > 0 ? { heartReward, questTitle } : { questTitle }
  );

  // 하트(좋아요) 지급
  if (heartReward > 0) {
    const playerRef = doc(db, 'classes', classId, 'players', playerId);
    await updateDoc(playerRef, {
      totalLikes: increment(heartReward),
    });
  }

  // 펫 경험치 100 지급
  try {
    const playerRef = doc(db, 'classes', classId, 'players', playerId);
    const playerSnap = await getDoc(playerRef);
    if (playerSnap.exists()) {
      const pData = playerSnap.data();
      if (pData.pets && pData.pets.length > 0) {
        await updatePetExperience(playerRef, 100);
      }
    }
  } catch (e) { /* 경험치 실패는 무시 */ }
}

/**
 * 퀘스트 수락 취소 (학생)
 */
export async function cancelQuestAcceptance(classId, questId, playerId) {
  if (!classId) return;
  const questRef = doc(db, 'classes', classId, 'quests', questId);
  const snap = await getDoc(questRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const newAcceptors = data.acceptors.filter(a => a.playerId !== playerId);
  await updateDoc(questRef, { acceptors: newAcceptors });
}


/**
 * 퀘스트 완료 반려 (관리자) — completionStatus: 'rejected'로 변경, 학생은 재제출 가능
 */
export async function rejectQuestCompletion(classId, questId, playerId, reason) {
  if (!classId) return;
  const questRef = doc(db, 'classes', classId, 'quests', questId);
  const snap = await getDoc(questRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const newAcceptors = data.acceptors.map(a =>
    a.playerId === playerId
      ? { ...a, completionStatus: 'rejected', rejectedReason: reason || '' }
      : a
  );
  await updateDoc(questRef, { acceptors: newAcceptors });

  // 학생에게 반려 알림
  try {
    const playerRef = doc(db, 'classes', classId, 'players', playerId);
    const playerSnap = await getDoc(playerRef);
    if (playerSnap.exists()) {
      const pData = playerSnap.data();
      if (pData.authUid) {
        createNotification(
          pData.authUid,
          `❌ 퀘스트 반려됨`,
          `'${data.title}' 퀘스트 완료 요청이 반려됐습니다.${reason ? ' 사유: ' + reason : ''} 다시 도전해보세요!`,
          'quest',
          '/missions'
        );
      }
    }
  } catch (e) { /* 알림 실패 무시 */ }
}

export async function requestQuestCompletion(classId, questId, playerId, submissionData) {
  if (!classId) return;
  const questRef = doc(db, 'classes', classId, 'quests', questId);
  const snap = await getDoc(questRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const playerName = (data.acceptors || []).find(a => a.playerId === playerId)?.playerName || '';
  const newAcceptors = data.acceptors.map(a =>
    a.playerId === playerId ? {
      ...a,
      completionStatus: 'pending',
      submissionText: submissionData?.text || null,
      submissionPhotoCount: submissionData?.photos?.length || 0,
    } : a
  );
  await updateDoc(questRef, { acceptors: newAcceptors });

  // 관리자에게 완료 요청 알림
  try {
    const adminsSnap = await getDocs(query(collection(db, 'classes', classId, 'players'), where('role', '==', 'admin')));
    adminsSnap.forEach(d => {
      const a = d.data();
      if (a.authUid) createNotification(
        a.authUid,
        `⚔️ 퀘스트 완료 요청`,
        `${playerName} 학생이 '${data.title}' 퀘스트 완료를 요청했습니다. 확인해주세요!`,
        'quest',
        null
      );
    });
  } catch (e) { /* 알림 실패 무시 */ }
}
/**
 * 특정 댓글의 기존 신고 상태 조회
 * returns: null | { status: 'pending'|'resolved'|'dismissed' }
 */
export async function getCommentReportStatus(classId, commentId) {
  if (!classId || !commentId) return null;
  const q = query(
    collection(db, 'classes', classId, 'commentReports'),
    where('commentId', '==', commentId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { status: snap.docs[0].data().status, id: snap.docs[0].id };
}

// =====================================================
// ▼▼▼ [추가] 수업 시간표 설정 ▼▼▼
// =====================================================

/** 수업 시간표 저장 (schedules: [{label, start, end}, ...]) */
export async function saveClassSchedules(classId, schedules) {
  if (!classId) return;
  await updateDoc(doc(db, 'classes', classId), { schedules });
}

/** 수업 시간표 불러오기 */
export async function getClassSchedules(classId) {
  if (!classId) return [];
  const snap = await getDoc(doc(db, 'classes', classId));
  return snap.exists() ? (snap.data().schedules || []) : [];
}

/** 시간표 실시간 구독 */
export function listenClassSchedules(classId, callback) {
  if (!classId) return () => { };
  return onSnapshot(doc(db, 'classes', classId), snap => {
    callback(snap.exists() ? (snap.data().schedules || []) : []);
  });
}

/// 1. 기존 createNotice 함수를 아래 코드로 덮어쓰기 해주세요.
// (파라미터 맨 끝에 poll = null 이 추가되었고, 저장 객체에 poll이 들어갑니다.)
export const createNotice = async (classId, authorName, title, content, imageUrls, tab, poll = null, publishAt = null) => {
  const docRef = await addDoc(collection(db, 'classes', classId, 'notices'), {
    authorName,
    title,
    content,
    imageUrls,
    tab,
    poll, // ✅ 투표 데이터 서버 저장 완료!
    publishAt, // 예약 게시 시간. null이면 즉시 게시
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef;
};

// ---------------------------------------------------------

// 2. 아래 두 함수는 파일 맨 아래에 그대로 두시거나 추가해 주시면 됩니다.
/** 투표 데이터 실시간 리스너 */
export const listenNoticeVotes = (classId, noticeId, callback) => {
  const votesRef = collection(db, 'classes', classId, 'notices', noticeId, 'votes');
  return onSnapshot(votesRef, (snapshot) => {
    const votes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(votes);
  });
};

/** 투표 하기 / 취소하기 토글 함수 */
export const toggleNoticeVote = async (classId, noticeId, playerId, optionIndex, isMultiple) => {
  const voteDocRef = doc(db, 'classes', classId, 'notices', noticeId, 'votes', playerId);
  const voteSnap = await getDoc(voteDocRef);

  if (voteSnap.exists()) {
    const data = voteSnap.data();
    let currentOptions = data.options || [];

    if (isMultiple) {
      // 복수 선택: 있으면 제거, 없으면 추가
      if (currentOptions.includes(optionIndex)) {
        currentOptions = currentOptions.filter(opt => opt !== optionIndex);
      } else {
        currentOptions.push(optionIndex);
      }

      // 선택한 항목이 없으면 문서 삭제, 있으면 업데이트
      if (currentOptions.length === 0) {
        await deleteDoc(voteDocRef);
      } else {
        await updateDoc(voteDocRef, { options: currentOptions });
      }
    } else {
      // 단일 선택: 이미 선택된 항목을 또 누르면 취소, 다른 걸 누르면 변경
      if (currentOptions.includes(optionIndex)) {
        await deleteDoc(voteDocRef); // 취소
      } else {
        await updateDoc(voteDocRef, { options: [optionIndex] }); // 변경
      }
    }
  } else {
    // 투표 기록이 없을 경우 새로 생성
    await setDoc(voteDocRef, {
      playerId,
      options: [optionIndex],
      votedAt: serverTimestamp()
    });
  }
};

/** 투표 최종 제출(수정 불가) 처리 */
export const finalizeNoticeVote = async (classId, noticeId, playerId) => {
  const voteDocRef = doc(db, 'classes', classId, 'notices', noticeId, 'votes', playerId);
  await updateDoc(voteDocRef, { isFinalized: true });
};

export async function giftPetEventItemsToAllStudents(classId) {
  if (!classId) throw new Error("학급 정보가 없습니다.");

  const playersRef = collection(db, "classes", classId, "players");
  const snapshot = await getDocs(playersRef);

  const targets = snapshot.docs.filter(playerDoc => {
    const player = playerDoc.data();

    // 관리자 계정 제외, 학생/기록원 등은 포함
    if (player.role === "admin") return false;

    // 비활성 학생이 있다면 제외
    if (player.status === "inactive") return false;

    return true;
  });

  if (targets.length === 0) {
    return { count: 0 };
  }

  let batch = writeBatch(db);
  let opCount = 0;
  let giftedCount = 0;

  const commitAndReset = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  for (const playerDoc of targets) {
    batch.update(playerDoc.ref, {
      "petInventory.evolution_stone": increment(1),
      "petInventory.pet_egg": increment(1),
      latestGift: {
        id: `pet_gift_${Date.now()}`,
        title: "🎁 선물이 도착했어요!",
        message: "진화의 돌 1개와 펫 알 1개를 받았어요!",
        items: [
          { id: "evolution_stone", name: "진화의 돌", amount: 1 },
          { id: "pet_egg", name: "펫 알", amount: 1 },
        ],
        createdAt: new Date().toISOString(),
      },
    });

    giftedCount += 1;
    opCount += 1;

    // Firestore batch 제한 대비
    if (opCount >= 450) {
      await commitAndReset();
    }
  }

  await commitAndReset();

  return { count: giftedCount };
}