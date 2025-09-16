// src/api/firebase.js

import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion, getDoc, increment, Timestamp, serverTimestamp, limit, collectionGroup
} from "firebase/firestore";
import initialTitles from '../assets/titles.json';
import imageCompression from 'browser-image-compression';

// Firebase 구성 정보
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =================================================================
// ▼▼▼ [수정] 칭호 데이터 자동 등록(seeding) 함수 (classId 추가) ▼▼▼
// =================================================================
export async function seedInitialTitles(classId) {
  if (!classId) return;
  const titlesRef = collection(db, "classes", classId, "titles");
  const snapshot = await getDocs(query(titlesRef, limit(1)));

  if (snapshot.empty) {
    console.log(`[${classId}] 칭호 데이터가 비어있어, titles.json의 기본값으로 자동 등록을 시작합니다.`);
    const batch = writeBatch(db);
    initialTitles.forEach(title => {
      const docRef = doc(titlesRef, title.id);
      batch.set(docRef, {
        ...title,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    console.log(`[${classId}] 기본 칭호 데이터 자동 등록 완료.`);
  }
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
export async function updatePlayerAvatar(classId, playerId, avatarConfig) {
  if (!classId) return;
  const playerRef = doc(db, 'classes', classId, 'players', playerId);
  await updateDoc(playerRef, { avatarConfig });
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
async function checkAndGrantAutoTitles(classId, studentId, studentAuthUid) {
  if (!classId || !studentId || !studentAuthUid) return;

  const playerRef = doc(db, 'classes', classId, 'players', studentId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return;
  const playerData = playerSnap.data();

  const titlesRef = collection(db, "classes", classId, "titles");
  const qTitles = query(titlesRef, where("type", "==", "auto"));
  const titlesSnapshot = await getDocs(qTitles);
  const autoTitles = titlesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const submissionsRef = collection(db, "classes", classId, "missionSubmissions");
  const qSubmissions = query(submissionsRef, where("studentId", "==", studentId), where("status", "==", "approved"));
  const submissionsSnapshot = await getDocs(qSubmissions);
  const approvedMissionCount = submissionsSnapshot.size;

  const quizHistoryRef = collection(db, "classes", classId, "quiz_history");
  const qQuiz = query(quizHistoryRef, where("studentId", "==", studentId), where("isCorrect", "==", true));
  const quizSnapshot = await getDocs(qQuiz);
  const correctQuizCount = quizSnapshot.size;

  const contributionsQuery = query(collectionGroup(db, 'contributions'), where('classId', '==', classId), where('playerId', '==', studentId));
  const contributionsSnapshot = await getDocs(contributionsQuery);
  const totalDonation = contributionsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

  const likesQuery = query(collection(db, "classes", classId, "players", studentId, "myRoomLikes"));
  const likesSnapshot = await getDocs(likesQuery);
  const myRoomLikesCount = likesSnapshot.size;

  for (const title of autoTitles) {
    if (playerData.ownedTitles && playerData.ownedTitles.includes(title.id)) {
      continue;
    }

    let conditionMet = false;
    if (title.conditionId === 'mission_30_completed' && approvedMissionCount >= 30) conditionMet = true;
    else if (title.conditionId === 'quiz_50_correct' && correctQuizCount >= 50) conditionMet = true;
    else if (title.conditionId === 'point_10000_owned' && playerData.points >= 10000) conditionMet = true;
    else if (title.conditionId === 'donation_5000_points' && totalDonation >= 5000) conditionMet = true;
    else if (title.conditionId === 'myroom_20_likes' && myRoomLikesCount >= 20) conditionMet = true;
    else if (title.conditionId === 'attendance_30_consecutive' && (playerData.consecutiveAttendanceDays || 0) >= 30) conditionMet = true;

    if (conditionMet) {
      await grantTitleToPlayer(classId, studentId, title.id);
      createNotification(
        studentAuthUid,
        `✨ 칭호 획득! [${title.name}]`,
        title.description,
        "title_acquired",
        "/profile"
      );
      await adjustPlayerPoints(classId, studentId, 500, `칭호 [${title.name}] 획득 보상`);
    }
  }
}

// --- 미션 관리 (classId 추가) ---
export async function approveMissionsInBatch(classId, missionId, studentIds, recorderId, reward) {
  if (!classId) throw new Error("학급 정보가 없습니다.");
  const batch = writeBatch(db);
  const missionRef = doc(db, 'classes', classId, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();

  // 학생들에게 포인트 지급
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
          approvedAt: serverTimestamp()
        });
      }

      batch.update(playerRef, { points: increment(reward) });

      createNotification(
        playerData.authUid,
        `'${missionData.title}' 미션 완료!`,
        `${reward}P를 획득했습니다.`,
        'mission'
      );

      await addPointHistory(
        classId,
        playerData.authUid,
        playerData.name,
        reward,
        `${missionData.title} 미션 완료`
      );

      await checkAndGrantAutoTitles(classId, studentId, playerData.authUid);
    }
  }

  // --- 기록원에게 인센티브 지급 ---
  const incentiveAmount = studentIds.length * 10;
  if (incentiveAmount > 0) {
    const playersRef = collection(db, 'classes', classId, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(incentiveAmount) });

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
    }
  }

  await batch.commit();
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
  const commentsRef = collection(db, "classes", classId, "missionSubmissions", submissionId, "comments");
  // 🔽 [수정] commentData와 함께 classId를 명시적으로 추가합니다.
  await addDoc(commentsRef, {
    ...commentData,
    classId, // classId 필드 추가
    createdAt: serverTimestamp(),
  });

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
export async function adjustPlayerPoints(classId, playerId, amount, reason) {
  if (!classId) return;
  const playerRef = doc(db, "classes", classId, "players", playerId);

  await runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("해당 플레이어를 찾을 수 없습니다.");
    }
    const playerData = playerDoc.data();
    transaction.update(playerRef, { points: increment(amount) });

    const title = `${amount > 0 ? '+' : ''}${amount}P 포인트 조정`;
    const body = `사유: ${reason}`;

    createNotification(
      playerData.authUid,
      title,
      body,
      'point',
      null,
      { amount, reason, title }
    );

    await addPointHistory(
      classId,
      playerData.authUid,
      playerData.name,
      amount,
      reason
    );
  });
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

export async function getUsers() {
  const usersRef = collection(db, 'users');
  const querySnapshot = await getDocs(usersRef);
  return querySnapshot.docs.map(doc => doc.data());
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
        '/admin'
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
  return querySnapshot.docs.map(doc => doc.data());
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
  const q = query(matchesRef, where("seasonId", "==", seasonId));
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

  batch.update(matchRef, {
    teamA_score: scores.a,
    teamB_score: scores.b,
    status: '완료',
    scorers: scorers || {}
  });

  if (recorderId) {
    const playersRef = collection(db, 'classes', classId, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(30) });
      addPointHistory(classId, recorderId, recorderData.name, 30, `보너스 (경기 결과 기록)`);
    }
  }

  const VICTORY_REWARD = 50;
  const DEFEAT_REWARD = 15;
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
  newMatchesData.forEach(matchData => {
    const newMatchRef = doc(matchesRef);
    batch.set(newMatchRef, matchData);
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

  const historyRef = collection(db, 'classes', classId, 'quiz_history'); // ✅ classId 경로 추가
  await addDoc(historyRef, {
    studentId, quizId, userAnswer, isCorrect,
    date: getTodayDateString(), timestamp: serverTimestamp(),
  });

  if (isCorrect) {
    const playerDoc = await getDoc(doc(db, 'classes', classId, 'players', studentId)); // ✅ classId 경로 추가
    if (playerDoc.exists()) {
      const playerData = playerDoc.data();
      await adjustPlayerPoints(classId, studentId, 50, `'${quizId}' 퀴즈 정답`);
      await checkAndGrantAutoTitles(classId, studentId, playerData.authUid);
    }
  }
  return isCorrect;
}

export async function createMission(classId, missionData) {
  if (!classId) return;
  const missionsRef = collection(db, 'classes', classId, 'missions'); // ✅ classId 경로 추가
  const { reward, ...restOfData } = missionData;
  await addDoc(missionsRef, {
    ...restOfData,
    reward: missionData.rewards[0] || 0, // [수정] 기본값 보장
    createdAt: new Date(),
    status: 'active',
    displayOrder: Date.now(),
    placeholderText: missionData.placeholderText || '' // [추가] placeholderText 필드 추가
  });
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
export async function updateMission(missionId, missionData) {
  const missionRef = doc(db, 'missions', missionId);
  await updateDoc(missionRef, missionData);
}

export async function getMissionSubmissions() {
  const submissionsRef = collection(db, 'missionSubmissions');
  // 최신순으로 정렬하는 로직 추가
  const q = query(submissionsRef, orderBy("requestedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMissionStatus(missionId, status) {
  const missionRef = doc(db, 'missions', missionId);
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
  if (amount <= 0) {
    throw new Error("기부할 포인트를 올바르게 입력해주세요.");
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
      classId, // 기부 내역에도 classId 추가
      playerId,
      playerName: playerData.name,
      amount: amount,
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
  if (!classId) return;
  const roomOwnerRef = doc(db, "classes", classId, "players", roomId); // ✅ classId 경로 추가
  const likerRef = doc(db, "classes", classId, "players", likerId); // ✅ classId 경로 추가
  const likeHistoryRef = doc(db, "classes", classId, "players", roomId, "myRoomLikes", likerId); // ✅ classId 경로 추가

  const currentMonth = new Date().toISOString().slice(0, 7);

  return runTransaction(db, async (transaction) => {
    // --- 모든 읽기 작업을 위로 이동 ---
    const likeHistorySnap = await transaction.get(likeHistoryRef);
    const roomOwnerSnap = await transaction.get(roomOwnerRef);

    // --- 읽은 데이터를 기반으로 로직 처리 ---
    if (likeHistorySnap.exists() && likeHistorySnap.data().lastLikedMonth === currentMonth) {
      throw new Error("이번 달에는 이미 '좋아요'를 눌렀습니다.");
    }
    if (!roomOwnerSnap.exists()) {
      throw new Error("방 주인의 정보를 찾을 수 없습니다.");
    }

    const roomOwnerData = roomOwnerSnap.data();
    const roomOwnerName = roomOwnerData.name || '친구';

    // --- 모든 쓰기 작업을 아래로 이동 ---
    transaction.update(likerRef, { points: increment(100) });
    transaction.set(likeHistoryRef, {
      likerName: likerName,
      lastLikedMonth: currentMonth,
      timestamp: serverTimestamp()
    }, { merge: true });

    // --- 트랜잭션이 아닌 작업들은 순서에 영향 없음 ---
    await addPointHistory(classId, likerId, likerName, 100, `${roomOwnerName}의 마이룸 '좋아요' 보상`);

    createNotification(
      roomId,
      `❤️ ${likerName}님이 내 마이룸을 좋아합니다!`,
      "내 마이룸을 방문해서 확인해보세요!",
      "myroom_like",
      `/my-room/${roomId}`
    );

    await checkAndGrantAutoTitles(classId, roomId, roomOwnerData.authUid);
  });
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
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "players", roomId, "myRoomComments", commentId);

  if (likerId === roomId) {
    return runTransaction(db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) throw new Error("댓글을 찾을 수 없습니다.");
      const commentData = commentSnap.data();
      if (commentData.likes.includes(likerId)) {
        throw new Error("이미 '좋아요'를 누른 댓글입니다.");
      }
      const commenterRef = doc(db, "classes", classId, "players", commentData.commenterId);
      const commenterSnap = await transaction.get(commenterRef);
      if (!commenterSnap.exists()) throw new Error("댓글 작성자 정보를 찾을 수 없습니다.");

      transaction.update(commenterRef, { points: increment(30) });
      transaction.update(commentRef, { likes: arrayUnion(likerId) });

      await addPointHistory(classId, commentData.commenterId, commentData.commenterName, 30, "칭찬 댓글 '좋아요' 보상");

      await createOrUpdateAggregatedNotification(
        commentData.commenterId,
        "comment_like",
        30,
        "❤️ 내 댓글에 '좋아요'를 받았어요!",
        "칭찬 댓글 보상으로 {amount}P를 획득했습니다!"
      );
    });
  } else {
    const commentDoc = await getDoc(commentRef);
    if (!commentDoc.exists()) throw new Error("댓글을 찾을 수 없습니다.");
    if (commentDoc.data().likes.includes(likerId)) {
      throw new Error("이미 '좋아요'를 누른 댓글입니다.");
    }
    await updateDoc(commentRef, {
      likes: arrayUnion(likerId)
    });
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

  return runTransaction(db, async (transaction) => {
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
    if (replies[replyIndex].likes.includes(likerId)) throw new Error("이미 '좋아요'를 누른 답글입니다.");

    transaction.update(roomOwnerRef, { points: increment(15) });
    replies[replyIndex].likes.push(likerId);
    transaction.update(commentRef, { replies: replies });

    const roomOwnerData = roomOwnerSnap.data();
    await addPointHistory(classId, roomId, roomOwnerData.name, 15, "내 답글 '좋아요' 보상");

    await createOrUpdateAggregatedNotification(
      roomId,
      "reply_like",
      15,
      "❤️ 내 답글에 '좋아요'를 받았어요!",
      "답글 '좋아요' 보상으로 {amount}P를 획득했습니다!"
    );
  });
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
  return querySnapshot.docs.map(doc => doc.data());
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

export async function toggleSubmissionLike(classId, submissionId, likerId) {
  if (!classId) return;
  const submissionRef = doc(db, "classes", classId, "missionSubmissions", submissionId);

  // 1. 좋아요 상태를 먼저 업데이트합니다. (트랜잭션 분리)
  const submissionDoc = await getDoc(submissionRef);
  if (!submissionDoc.exists()) throw new Error("Submission not found");

  const submissionData = submissionDoc.data();
  const likes = submissionData.likes || [];
  const newLikes = likes.includes(likerId)
    ? likes.filter(id => id !== likerId)
    : [...likes, likerId];

  await updateDoc(submissionRef, { likes: newLikes });

  // 2. 좋아요가 10개 이상이고, 보상이 지급되지 않았다면 별도로 보상을 지급합니다.
  const POPULARITY_THRESHOLD = 10;
  const REWARD_AMOUNT = 200;

  if (newLikes.length >= POPULARITY_THRESHOLD && !submissionData.popularRewardGranted) {
    const authorId = submissionData.studentId;
    const authorRef = doc(db, "classes", classId, "players", authorId);
    const authorDoc = await getDoc(authorRef);

    if (authorDoc.exists()) {
      const authorData = authorDoc.data();
      // 보상 지급과 보상 지급 완료 상태 업데이트를 함께 처리
      const batch = writeBatch(db);
      batch.update(authorRef, { points: increment(REWARD_AMOUNT) });
      batch.update(submissionRef, { popularRewardGranted: true });
      await batch.commit();

      addPointHistory(
        classId,
        authorData.authUid,
        authorData.name,
        REWARD_AMOUNT,
        "미션 갤러리 인기 게시물 보상"
      );
      createNotification(
        authorData.authUid,
        `🏆 미션 갤러리 인기 게시물 선정!`,
        `축하합니다! 내 게시물이 '좋아요' ${POPULARITY_THRESHOLD}개를 달성하여 ${REWARD_AMOUNT}P를 받았습니다!`,
        'gallery_reward',
        '/mission-gallery'
      );
    }
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

  await adjustPlayerPoints(classId, playerId, 500, `칭호 [${title.name}] 획득 보상`);
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
        await adjustPlayerPoints(classId, playerId, 500, `칭호 [${title.name}] 획득 보상`);
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

export async function toggleCommentLike(classId, submissionId, commentId, likerId) {
  if (!classId) return;
  const commentRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId); // ✅ classId 경로 추가
  await runTransaction(db, async (transaction) => {
    const commentDoc = await transaction.get(commentRef);
    if (!commentDoc.exists()) throw new Error("Comment not found");
    const likes = commentDoc.data().likes || [];
    const newLikes = likes.includes(likerId)
      ? likes.filter(id => id !== likerId)
      : [...likes, likerId];
    transaction.update(commentRef, { likes: newLikes });
  });
}

export async function toggleReplyLike(classId, submissionId, commentId, replyId, likerId) {
  if (!classId) return;
  const replyRef = doc(db, "classes", classId, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId); // ✅ classId 경로 추가
  await runTransaction(db, async (transaction) => {
    const replyDoc = await transaction.get(replyRef);
    if (!replyDoc.exists()) throw new Error("Reply not found");
    const likes = replyDoc.data().likes || [];
    const newLikes = likes.includes(likerId)
      ? likes.filter(id => id !== likerId)
      : [...likes, likerId];
    transaction.update(replyRef, { likes: newLikes });
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

// src/api/firebase.js (교체할 내용)
export async function getTotalLikesForPlayer(classId, playerId) {
  if (!classId || !playerId) return 0;
  let totalLikes = 0;

  // 1. 마이룸 자체 '좋아요' 수
  const myRoomLikesQuery = query(collection(db, "classes", classId, "players", playerId, "myRoomLikes"));
  const myRoomLikesSnapshot = await getDocs(myRoomLikesQuery);
  totalLikes += myRoomLikesSnapshot.size;

  // 2. 미션 갤러리 게시물이 받은 '좋아요' 수
  const submissionsQuery = query(collection(db, "classes", classId, "missionSubmissions"), where("studentId", "==", playerId));
  const submissionsSnapshot = await getDocs(submissionsQuery);
  submissionsSnapshot.forEach(doc => {
    totalLikes += (doc.data().likes || []).length;
  });

  // 3. 내 마이룸 방명록의 댓글과 답글이 받은 '좋아요' 수
  const myRoomCommentsQuery = query(collection(db, "classes", classId, "players", playerId, "myRoomComments"));
  const myRoomCommentsSnapshot = await getDocs(myRoomCommentsQuery);

  myRoomCommentsSnapshot.forEach(doc => {
    const commentData = doc.data();
    // 댓글이 받은 좋아요
    totalLikes += (commentData.likes || []).length;
    // 답글들이 받은 좋아요
    if (commentData.replies && Array.isArray(commentData.replies)) {
      commentData.replies.forEach(reply => {
        totalLikes += (reply.likes || []).length;
      });
    }
  });

  return totalLikes;
}