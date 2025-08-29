// src/api/firebase.js

import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, getDocs, query, where, doc,
  updateDoc, addDoc, deleteDoc, writeBatch, orderBy, setDoc,
  runTransaction, arrayUnion, getDoc, increment, Timestamp, serverTimestamp, limit, collectionGroup
} from "firebase/firestore";
import initialTitles from '../assets/titles.json'; // [추가] titles.json 파일 import
import imageCompression from 'browser-image-compression'; // 라이브러리 import

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
// ▼▼▼ [신규] 칭호 데이터 자동 등록(seeding) 함수 ▼▼▼
// =================================================================
export async function seedInitialTitles() {
  const titlesRef = collection(db, "titles");
  const snapshot = await getDocs(query(titlesRef, limit(1))); // 1개만 가져와서 비어있는지 확인

  if (snapshot.empty) {
    console.log("칭호 데이터가 비어있어, titles.json의 기본값으로 자동 등록을 시작합니다.");
    const batch = writeBatch(db);
    initialTitles.forEach(title => {
      const docRef = doc(titlesRef, title.id); // JSON에 정의된 id를 문서 ID로 사용
      batch.set(docRef, {
        ...title,
        createdAt: serverTimestamp() // 생성 시간 추가
      });
    });
    await batch.commit();
    console.log("기본 칭호 데이터 자동 등록 완료.");
  }
}


// --- 포인트 기록 헬퍼 함수 ---
const addPointHistory = async (playerId, playerName, changeAmount, reason) => {
  try {
    await addDoc(collection(db, 'point_history'), {
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

// --- 상점 및 아바타 ---
export async function updatePlayerAvatar(playerId, avatarConfig) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, { avatarConfig });
}

export async function buyAvatarPart(playerId, part) {
  const playerRef = doc(db, 'players', playerId);
  const playerDoc = await getDoc(playerRef);
  if (!playerDoc.exists()) {
    throw new Error("플레이어 정보를 찾을 수 없습니다.");
  }
  const playerData = playerDoc.data();

  const now = new Date();
  let finalPrice = part.price;
  let isCurrentlyOnSale = false;

  if (part.isSale && part.saleStartDate && part.saleEndDate) {
    const startDate = part.saleStartDate.toDate();
    const endDate = part.saleEndDate.toDate();

    if (now >= startDate && now <= endDate) {
      finalPrice = part.salePrice;
      isCurrentlyOnSale = true;
    }
  }

  await runTransaction(db, async (transaction) => {
    if (playerData.points < finalPrice) {
      throw "포인트가 부족합니다.";
    }
    if (playerData.ownedParts?.includes(part.id)) {
      throw "이미 소유하고 있는 아이템입니다.";
    }

    const newPoints = playerData.points - finalPrice;
    transaction.update(playerRef, {
      points: newPoints,
      ownedParts: arrayUnion(part.id)
    });
  });

  await addPointHistory(
    playerData.authUid,
    playerData.name,
    -finalPrice,
    `${part.id} 구매`
  );
  return "구매에 성공했습니다!";
}

// =================================================================
// ▼▼▼ [신규] 자동 칭호 획득 조건 검사 및 부여 헬퍼 함수 ▼▼▼
// =================================================================
async function checkAndGrantAutoTitles(studentId, studentAuthUid) {
  if (!studentId || !studentAuthUid) return;

  const playerRef = doc(db, 'players', studentId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return;
  const playerData = playerSnap.data();

  // 1. 모든 '자동 획득' 칭호 목록 가져오기
  const titlesRef = collection(db, "titles");
  const qTitles = query(titlesRef, where("type", "==", "auto"));
  const titlesSnapshot = await getDocs(qTitles);
  const autoTitles = titlesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. 학생의 모든 '승인'된 미션 제출 기록 수 세기
  const submissionsRef = collection(db, "missionSubmissions");
  const qSubmissions = query(submissionsRef, where("studentId", "==", studentId), where("status", "==", "approved"));
  const submissionsSnapshot = await getDocs(qSubmissions);
  const approvedMissionCount = submissionsSnapshot.size;

  // 3. 학생의 모든 '정답' 퀴즈 기록 수 세기
  const quizHistoryRef = collection(db, "quiz_history");
  const qQuiz = query(quizHistoryRef, where("studentId", "==", studentId), where("isCorrect", "==", true));
  const quizSnapshot = await getDocs(qQuiz);
  const correctQuizCount = quizSnapshot.size;

  // 4. 학생의 누적 기부액 계산
  const contributionsQuery = query(collectionGroup(db, 'contributions'), where('playerId', '==', studentId));
  const contributionsSnapshot = await getDocs(contributionsQuery);
  const totalDonation = contributionsSnapshot.docs.reduce((sum, doc) => sum + doc.data().amount, 0);

  // 5. 학생의 마이룸 '좋아요' 수 계산
  const likesQuery = query(collection(db, "players", studentId, "myRoomLikes"));
  const likesSnapshot = await getDocs(likesQuery);
  const myRoomLikesCount = likesSnapshot.size;


  // 각 칭호의 획득 조건 확인 및 부여
  for (const title of autoTitles) {
    // 이미 보유한 칭호는 건너뛰기
    if (playerData.ownedTitles && playerData.ownedTitles.includes(title.id)) {
      continue;
    }

    let conditionMet = false;
    // [수정] 칭호의 고유 ID가 아닌, '조건 ID' 필드를 기준으로 조건을 확인합니다.
    if (title.conditionId === 'mission_30_completed' && approvedMissionCount >= 30) {
      conditionMet = true;
    }
    // 추후 다른 자동 획득 칭호 조건을 여기에 추가 (예: quiz_50_correct, league_winner 등)

    if (title.conditionId === 'mission_30_completed' && approvedMissionCount >= 30) {
      conditionMet = true;
    } else if (title.conditionId === 'quiz_50_correct' && correctQuizCount >= 50) {
      conditionMet = true;
    } else if (title.conditionId === 'point_10000_owned' && playerData.points >= 10000) {
      conditionMet = true;
    } else if (title.conditionId === 'donation_5000_points' && totalDonation >= 5000) {
      conditionMet = true;
    } else if (title.conditionId === 'myroom_20_likes' && myRoomLikesCount >= 20) {
      conditionMet = true;
    } else if (title.conditionId === 'attendance_30_consecutive' && (playerData.consecutiveAttendanceDays || 0) >= 30) {
      conditionMet = true;
    }

    if (conditionMet) {
      await grantTitleToPlayer(studentId, title.id);
      createNotification(
        studentAuthUid,
        `✨ 칭호 획득! [${title.name}]`,
        title.description,
        "title_acquired"
      );
    }
    if (conditionMet) {
      await grantTitleToPlayer(studentId, title.id);

      // 칭호 획득 알림 생성
      createNotification(
        studentAuthUid,
        `✨ 칭호 획득! [${title.name}]`,
        title.description,
        "title_acquired",
        "/profile"
      );

      // [추가] 칭호 획득 보상 500P 지급 및 모달 호출
      await adjustPlayerPoints(studentId, 500, `칭호 [${title.name}] 획득 보상`);
    }
    // 교체할 부분의 아랫 한 줄 코드
  }
}

// =================================================================
// ▼▼▼ [신규] 관리자용 댓글/답글 수정 및 삭제 함수 ▼▼▼
// =================================================================
export async function updateMissionComment(submissionId, commentId, newText) {
  const commentRef = doc(db, "missionSubmissions", submissionId, "comments", commentId);
  await updateDoc(commentRef, { text: newText });
}

export async function deleteMissionComment(submissionId, commentId) {
  // 먼저 댓글 하위의 모든 답글을 삭제합니다.
  const repliesRef = collection(db, "missionSubmissions", submissionId, "comments", commentId, "replies");
  const repliesSnap = await getDocs(repliesRef);
  const batch = writeBatch(db);
  repliesSnap.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // 그 다음 댓글 자체를 삭제합니다.
  const commentRef = doc(db, "missionSubmissions", submissionId, "comments", commentId);
  await deleteDoc(commentRef);
}

export async function updateMissionReply(submissionId, commentId, replyId, newText) {
  const replyRef = doc(db, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId);
  await updateDoc(replyRef, { text: newText });
}

export async function deleteMissionReply(submissionId, commentId, replyId) {
  const replyRef = doc(db, "missionSubmissions", submissionId, "comments", commentId, "replies", replyId);
  await deleteDoc(replyRef);
}

// [신규] 미션 제출물에 관리자 피드백(댓글)을 추가/수정하는 함수
export async function upsertAdminFeedback(submissionId, feedbackText) {
  const submissionRef = doc(db, "missionSubmissions", submissionId);
  await updateDoc(submissionRef, {
    adminFeedback: feedbackText,
    feedbackUpdatedAt: serverTimestamp()
  });
}

// [신규] 미션 제출물에서 관리자 피드백(댓글)을 삭제하는 함수
export async function deleteAdminFeedback(submissionId) {
  const submissionRef = doc(db, "missionSubmissions", submissionId);
  await updateDoc(submissionRef, {
    adminFeedback: null,
    feedbackUpdatedAt: null
  });
}

// [신규] 학생이 관리자 피드백에 '좋아요'를 누르는 기능
export async function toggleAdminFeedbackLike(submissionId, studentId) {
  const submissionRef = doc(db, "missionSubmissions", submissionId);
  const submissionSnap = await getDoc(submissionRef);

  if (!submissionSnap.exists()) {
    throw new Error("Submission not found");
  }

  const submissionData = submissionSnap.data();
  const likes = submissionData.adminFeedbackLikes || [];

  if (likes.includes(studentId)) {
    // 이미 '좋아요'를 눌렀다면 취소
    await updateDoc(submissionRef, {
      adminFeedbackLikes: likes.filter(id => id !== studentId)
    });
  } else {
    // '좋아요'를 누르지 않았다면 추가
    await updateDoc(submissionRef, {
      adminFeedbackLikes: [...likes, studentId]
    });
  }
}

// [신규] 미션 제출물 자체에 '좋아요'를 누르는 기능 (관리자, 학생 공용)
export async function toggleSubmissionLike(submissionId, likerId) {
  const submissionRef = doc(db, "missionSubmissions", submissionId);
  const submissionSnap = await getDoc(submissionRef);

  if (!submissionSnap.exists()) {
    throw new Error("Submission not found");
  }

  const submissionData = submissionSnap.data();
  const likes = submissionData.likes || [];

  if (likes.includes(likerId)) {
    // 이미 '좋아요'를 눌렀다면 취소
    await updateDoc(submissionRef, {
      likes: likes.filter(id => id !== likerId)
    });
  } else {
    // '좋아요'를 누르지 않았다면 추가
    await updateDoc(submissionRef, {
      likes: [...likes, likerId]
    });
  }
}

// --- 미션 관리 ---
export async function approveMissionsInBatch(missionId, studentIds, recorderId, reward) {
  const batch = writeBatch(db);
  const missionRef = doc(db, 'missions', missionId);
  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();

  // 학생들에게 포인트 지급
  for (const studentId of studentIds) {
    const playerRef = doc(db, 'players', studentId);
    const playerDoc = await getDoc(playerRef);

    if (playerDoc.exists()) {
      const playerData = playerDoc.data();

      const submissionQuery = query(
        collection(db, "missionSubmissions"),
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
        playerData.authUid,
        playerData.name,
        reward,
        `${missionData.title} 미션 완료`
      );

      // [추가] 미션 승인 후, 자동 칭호 획득 조건을 확인합니다.
      await checkAndGrantAutoTitles(studentId, playerData.authUid);
    }
  }

  // --- 기록원에게 인센티브 지급 ---
  const incentiveAmount = studentIds.length * 10;
  if (incentiveAmount > 0) {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(incentiveAmount) });

      await addPointHistory(
        recorderId,
        recorderData.name,
        incentiveAmount,
        `보너스 (미션 승인 ${studentIds.length}건)` // [수정] "보너스"로 시작하도록 변경
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

export async function uploadMissionSubmissionFile(missionId, studentId, files) {
  const uploadPromises = files.map(async (file) => {
    // 이미지 압축 로직을 여기에 포함하여 개별 파일에 적용합니다.
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);
    const storageRef = ref(storage, `mission-submissions/${missionId}/${studentId}/${Date.now()}_${compressedFile.name}`);
    const uploadResult = await uploadBytes(storageRef, compressedFile);
    return getDownloadURL(uploadResult.ref);
  });
  return await Promise.all(uploadPromises);
}

export async function requestMissionApproval(missionId, studentId, studentName, submissionData = {}) {
  const submissionsRef = collection(db, 'missionSubmissions');
  const missionRef = doc(db, 'missions', missionId);

  // [수정] photoUrl 필드 대신 photoUrls 필드를 사용하도록 합니다.
  if (submissionData.photoUrl) {
    submissionData.photoUrls = [submissionData.photoUrl];
    delete submissionData.photoUrl;
  }

  const missionSnap = await getDoc(missionRef);
  if (!missionSnap.exists()) {
    throw new Error("미션을 찾을 수 없습니다.");
  }
  const missionData = missionSnap.data();

  // 1. Firestore에 단순하게 "해당 학생의 해당 미션 기록 전체"를 요청합니다.
  const q = query(
    submissionsRef,
    where("missionId", "==", missionId),
    where("studentId", "==", studentId)
  );
  const querySnapshot = await getDocs(q);
  const submissions = querySnapshot.docs.map(doc => doc.data());

  // 2. 가져온 데이터를 코드(Javascript)에서 직접 필터링합니다.
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

  // 중복이 아니므로 새로운 제출 기록 생성
  const newSubmissionRef = doc(collection(db, 'missionSubmissions'));
  await setDoc(newSubmissionRef, {
    missionId,
    studentId,
    studentName,
    status: 'pending',
    requestedAt: serverTimestamp(),
    checkedBy: null,
    ...submissionData
  });

  // 관리자/기록원에게 알림 전송
  const playersRef = collection(db, 'players');
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

export async function rejectMissionSubmission(submissionId, studentAuthUid, missionTitle) {
  const submissionRef = doc(db, 'missionSubmissions', submissionId);
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

export async function deleteMission(missionId) {
  const batch = writeBatch(db);
  const submissionsRef = collection(db, "missionSubmissions");
  const q = query(submissionsRef, where("missionId", "==", missionId));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  const missionRef = doc(db, 'missions', missionId);
  batch.delete(missionRef);
  await batch.commit();
}

export async function getMissionHistory(studentId, missionId) {
  const q = query(
    collection(db, "missionSubmissions"),
    where("studentId", "==", studentId),
    where("missionId", "==", missionId),
    orderBy("requestedAt", "desc") // 모든 기록을 최신순으로 정렬
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// =================================================================
// ▼▼▼ [신규] 미션 댓글/답글 관련 함수 ▼▼▼
// =================================================================
/**
 * 미션 제출 기록에 댓글을 추가합니다.
 * @param {string} submissionId - 댓글을 달 미션 제출 기록의 ID
 * @param {object} commentData - 댓글 데이터 (작성자 ID, 이름, 내용 등)
 * @param {object} studentData - 미션 제출 학생의 정보 (알림 전송용)
 * @param {string} missionTitle - 미션 제목 (알림 내용용)
 */
export async function addMissionComment(submissionId, commentData, studentData, missionTitle) {
  const commentsRef = collection(db, "missionSubmissions", submissionId, "comments");
  await addDoc(commentsRef, {
    ...commentData,
    createdAt: serverTimestamp(),
  });

  const link = `/missions?openHistoryForSubmission=${submissionId}`;

  if (commentData.commenterRole === 'player') {
    // 학생이 댓글 작성 -> 관리자에게만 알림
    const playersRef = collection(db, 'players');
    const adminQuery = query(playersRef, where('role', 'in', ['admin']));
    const adminSnapshot = await getDocs(adminQuery);
    adminSnapshot.forEach(userDoc => {
      const user = userDoc.data();
      if (user.authUid) {
        createNotification(
          user.authUid,
          `댓글: ${missionTitle}`,
          `${commentData.commenterName}: "${commentData.text}"`,
          "mission_comment",
          link
        );
      }
    });
  } else if (studentData?.authUid) {
    // 관리자가 댓글 작성 -> 학생에게 알림
    createNotification(
      studentData.authUid,
      `📝 '${missionTitle}' 미션에 댓글이 달렸어요!`,
      `${commentData.commenterName}: "${commentData.text}"`,
      "mission_comment",
      link
    );
  }
}


/**
 * 미션 댓글에 답글을 추가합니다.
 * @param {string} submissionId - 댓글이 있는 미션 제출 기록의 ID
 * @param {string} commentId - 답글을 달 댓글의 ID
 * @param {object} replyData - 답글 데이터 (작성자 ID, 이름, 내용 등)
 * @param {object} originalComment - 원본 댓글 데이터 (알림 전송용)
 */
export async function addMissionReply(submissionId, commentId, replyData, originalComment) {
  const repliesRef = collection(db, "missionSubmissions", submissionId, "comments", commentId, "replies");
  await addDoc(repliesRef, {
    ...replyData,
    createdAt: serverTimestamp(),
  });

  const replierAuthUid = auth.currentUser?.uid;
  const originalCommenterAuthUid = originalComment.commenterAuthUid;
  const link = `/missions?openHistoryForSubmission=${submissionId}`;

  // 답글 작성자가 원 댓글 작성자가 아니고, 원 댓글 작성자의 정보가 있을 경우에만 알림 전송
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

// --- 포인트 수동 조정 ---
export async function adjustPlayerPoints(playerId, amount, reason) {
  const playerRef = doc(db, "players", playerId);

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
      { amount, reason, title } // 모달에 전달할 데이터
    );

    await addPointHistory(
      playerData.authUid,
      playerData.name,
      amount,
      reason
    );
  });
  console.log("포인트 조정 및 기록이 성공적으로 완료되었습니다.");
}

export async function batchAdjustPlayerPoints(playerIds, amount, reason) {
  const batch = writeBatch(db);

  for (const playerId of playerIds) {
    const playerRef = doc(db, "players", playerId);
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
        { amount, reason, title } // 모달에 전달할 데이터
      );

      await addPointHistory(
        playerData.authUid,
        playerData.name,
        amount,
        reason
      );
    }
  }

  await batch.commit();
}

// --- 사용자 및 선수 관리 ---
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

export async function linkPlayerToAuth(playerId, authUid, role) {
  const playerRef = doc(db, 'players', playerId);
  await updateDoc(playerRef, { authUid, role });
}

export async function addPlayer(playerData) {
  const playerRef = doc(db, 'players', playerData.authUid);
  await setDoc(playerRef, playerData);
}

export async function getPlayers() {
  const playersRef = collection(db, 'players');
  const querySnapshot = await getDocs(playersRef);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deletePlayer(playerId) {
  await deleteDoc(doc(db, 'players', playerId));
}

export async function updatePlayerStatus(playerId, status) {
  const playerRef = doc(db, "players", playerId);
  await updateDoc(playerRef, { status });
}

export async function submitSuggestion(suggestionData) {
  const { studentId, studentName, message } = suggestionData;
  if (!message.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date(); // [수정] 클라이언트의 현재 시간을 사용
  await addDoc(collection(db, "suggestions"), {
    studentId,
    studentName,
    message,
    conversation: [
      {
        sender: 'student',
        content: message,
        createdAt: now // [수정] serverTimestamp() 대신 Date 객체 사용
      }
    ],
    status: "pending",
    createdAt: now,
    lastMessageAt: now,
  });

  // [추가] 관리자 및 기록원에게 알림 전송
  const playersRef = collection(db, 'players');
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

// 특정 학생의 건의사항 목록을 불러오는 함수
export async function getSuggestionsForStudent(studentId) {
  if (!studentId) return [];
  const q = query(
    collection(db, "suggestions"),
    where("studentId", "==", studentId),
    orderBy("createdAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 관리자가 모든 건의사항 목록을 불러오는 함수
export async function getAllSuggestions() {
  const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function replyToSuggestion(suggestionId, replyContent, studentAuthUid) {
  if (!replyContent.trim()) {
    throw new Error("답글 내용을 입력해야 합니다.");
  }
  const suggestionRef = doc(db, "suggestions", suggestionId);

  // [수정] 단일 답글을 대화 배열에 추가하는 방식으로 변경
  const replyData = {
    content: replyContent,
    sender: 'admin',
    createdAt: new Date() // serverTimestamp()를 new Date()로 변경
  };

  await updateDoc(suggestionRef, {
    conversation: arrayUnion(replyData), // conversation 필드에 배열로 추가
    status: "replied",
    lastMessageAt: serverTimestamp(), // 마지막 메시지 시간 갱신
  });

  // 학생에게 답글 알림 보내기
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

// --- 팀 및 경기 관리 ---
export async function getTeams(seasonId) {
  const teamsRef = collection(db, 'teams');
  const q = query(teamsRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addTeam(newTeamData) {
  await addDoc(collection(db, 'teams'), newTeamData);
}

export async function deleteTeam(teamId) {
  await deleteDoc(doc(db, 'teams', teamId));
}

export async function uploadTeamEmblem(teamId, file) {
  const storageRef = ref(storage, `team-emblems/${teamId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ▼▼▼ [수정] updateTeamInfo 함수 수정 ▼▼▼
export async function updateTeamInfo(teamId, newName, emblemId, emblemUrl) {
  const teamRef = doc(db, 'teams', teamId);
  const updateData = {
    teamName: newName,
    emblemId: emblemId || null, // 프리셋 ID 저장
    emblemUrl: emblemUrl || null // 직접 업로드 URL 저장
  };
  await updateDoc(teamRef, updateData);
}

export async function updateTeamMembers(teamId, newMembers) {
  await updateDoc(doc(db, 'teams', teamId), { members: newMembers });
}

export async function updateTeamCaptain(teamId, captainId) {
  const teamRef = doc(db, 'teams', teamId);
  await updateDoc(teamRef, { captainId: captainId });
}

export async function batchAddTeams(newTeamsData) {
  const batch = writeBatch(db);
  const teamsRef = collection(db, 'teams');
  newTeamsData.forEach(teamData => {
    const newTeamRef = doc(teamsRef);
    batch.set(newTeamRef, teamData);
  });
  await batch.commit();
}

export async function batchUpdateTeams(teamUpdates) {
  const batch = writeBatch(db);
  teamUpdates.forEach(update => {
    const teamRef = doc(db, 'teams', update.id);
    batch.update(teamRef, {
      members: update.members,
      captainId: update.captainId,
    });
  });
  await batch.commit();
}

export async function getMatches(seasonId) {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateMatchScores(matchId, scores, scorers, recorderId) {
  const batch = writeBatch(db);
  const matchRef = doc(db, 'matches', matchId);
  const matchSnap = await getDoc(matchRef);

  if (!matchSnap.exists()) {
    throw new Error("경기를 찾을 수 없습니다.");
  }
  const matchData = matchSnap.data();

  // 1. 경기 정보 업데이트
  batch.update(matchRef, {
    teamA_score: scores.a,
    teamB_score: scores.b,
    status: '완료',
    scorers: scorers || {}
  });

  // 2. 기록원에게 보너스 지급 (10P)
  if (recorderId) {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where("authUid", "==", recorderId), limit(1));
    const recorderSnapshot = await getDocs(q);

    if (!recorderSnapshot.empty) {
      const recorderDoc = recorderSnapshot.docs[0];
      const recorderData = recorderDoc.data();
      batch.update(recorderDoc.ref, { points: increment(30) });
      addPointHistory(recorderId, recorderData.name, 30, `보너스 (경기 결과 기록)` // [수정] "보너스"로 시작하도록 변경
      );
      // [삭제] 개별 알림 생성 코드 제거
    }
  }

  // 3. 승리팀/패배팀 수당 지급
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

  // 승리팀 보상 지급
  if (winningTeamId) {
    const teamSnap = await getDoc(doc(db, 'teams', winningTeamId));
    if (teamSnap.exists()) {
      const winningTeamData = teamSnap.data();
      for (const memberId of winningTeamData.members) {
        const playerRef = doc(db, 'players', memberId);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
          batch.update(playerRef, { points: increment(VICTORY_REWARD) });
          addPointHistory(playerData.authUid, playerData.name, VICTORY_REWARD, "가가볼 리그 승리 수당");
          createNotification(playerData.authUid, `🎉 리그 승리! +${VICTORY_REWARD}P`, `'${winningTeamData.teamName}' 팀의 승리를 축하합니다!`, 'point');
        }
      }
    }
  }

  // 패배팀 보상 지급
  if (losingTeamId) {
    const teamSnap = await getDoc(doc(db, 'teams', losingTeamId));
    if (teamSnap.exists()) {
      const losingTeamData = teamSnap.data();
      for (const memberId of losingTeamData.members) {
        const playerRef = doc(db, 'players', memberId);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
          batch.update(playerRef, { points: increment(DEFEAT_REWARD) });
          addPointHistory(playerData.authUid, playerData.name, DEFEAT_REWARD, "가가볼 리그 참가 수당");
          createNotification(playerData.authUid, `+${DEFEAT_REWARD}P 획득`, `값진 경기에 대한 참가 수당이 지급되었습니다.`, 'point');
        }
      }
    }
  }

  await batch.commit();
}

// ▼▼▼ [신규] 경기 시작 시간 기록 함수 추가 ▼▼▼
export async function updateMatchStartTime(matchId) {
  const matchRef = doc(db, 'matches', matchId);
  await updateDoc(matchRef, { startTime: serverTimestamp() });
}

export async function updateMatchStatus(matchId, newStatus) {
  const matchRef = doc(db, 'matches', matchId);
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

export async function deleteMatchesBySeason(seasonId) {
  const matchesRef = collection(db, 'matches');
  const q = query(matchesRef, where("seasonId", "==", seasonId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

export async function batchAddMatches(newMatchesData) {
  const batch = writeBatch(db);
  const matchesRef = collection(db, 'matches');
  newMatchesData.forEach(matchData => {
    const newMatchRef = doc(matchesRef);
    batch.set(newMatchRef, matchData);
  });
  await batch.commit();
}

// --- 시즌 관리 ---
export async function getSeasons() {
  const seasonsRef = collection(db, 'seasons');
  const q = query(seasonsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateSeason(seasonId, dataToUpdate) {
  const seasonDoc = doc(db, 'seasons', seasonId);
  await updateDoc(seasonDoc, dataToUpdate);
}

export async function createNewSeason(seasonName) {
  if (!seasonName || !seasonName.trim()) {
    throw new Error("시즌 이름을 입력해야 합니다.");
  }
  await addDoc(collection(db, 'seasons'), {
    seasonName: seasonName.trim(),
    status: 'preparing',
    createdAt: serverTimestamp(),
    winningPrize: 0
  });
}

export async function saveAvatarMemorials(seasonId, playersInSeason) {
  const batch = writeBatch(db);
  playersInSeason.forEach(player => {
    // avatarConfig가 있는 선수만 저장
    if (player.avatarConfig) {
      const memorialRef = doc(db, 'seasons', seasonId, 'memorials', player.id);
      batch.set(memorialRef, {
        playerId: player.id,
        playerName: player.name,
        avatarConfig: player.avatarConfig
      });
    }
  });
  await batch.commit();
}

export async function createPlayerFromUser(user) {
  const playerRef = doc(db, 'players', user.uid);
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

export async function getTodaysQuizHistory(studentId) {
  if (!studentId) return [];
  const todayStr = getTodayDateString();
  const historyRef = collection(db, 'quiz_history');
  const q = query(historyRef, where('studentId', '==', studentId), where('date', '==', todayStr));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data());
}

export async function submitQuizAnswer(studentId, quizId, userAnswer, correctAnswer) {
  const isCorrect = userAnswer.trim().toLowerCase() === String(correctAnswer).toLowerCase();

  const historyRef = collection(db, 'quiz_history');
  await addDoc(historyRef, {
    studentId,
    quizId,
    userAnswer,
    isCorrect,
    date: getTodayDateString(),
    timestamp: serverTimestamp(),
  });

  if (isCorrect) {
    const playerDoc = await getDoc(doc(db, 'players', studentId));
    if (playerDoc.exists()) {
      await adjustPlayerPoints(studentId, 50, `'${quizId}' 퀴즈 정답`);
    }
  }

  if (isCorrect) {
    const playerDoc = await getDoc(doc(db, 'players', studentId));
    if (playerDoc.exists()) {
      const playerData = playerDoc.data();
      await adjustPlayerPoints(studentId, 50, `'${quizId}' 퀴즈 정답`);
      // [추가] 퀴즈 정답 후, 자동 칭호 획득 조건을 확인합니다.
      await checkAndGrantAutoTitles(studentId, playerData.authUid);
    }
  }

  return isCorrect;
}

export async function createMission(missionData) {
  const missionsRef = collection(db, 'missions');
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

export async function getMissions(status = 'active') {
  const missionsRef = collection(db, 'missions');
  const q = query(missionsRef, where("status", "==", status));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function batchUpdateMissionOrder(reorderedMissions) {
  const batch = writeBatch(db);
  reorderedMissions.forEach((mission, index) => {
    const missionRef = doc(db, 'missions', mission.id);
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
export async function updateAvatarPartDisplayName(partId, displayName) {
  const partRef = doc(db, "avatarParts", partId);
  await updateDoc(partRef, { displayName });
}

export async function batchUpdateSaleDays(partIds, saleDays) {
  const batch = writeBatch(db);
  for (const partId of partIds) {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, {
      saleDays: saleDays,
    });
  }
  await batch.commit();
}

export async function buyMultipleAvatarParts(playerId, partsToBuy) {
  if (!partsToBuy || partsToBuy.length === 0) {
    throw new Error("구매할 아이템이 없습니다.");
  }

  const playerRef = doc(db, "players", playerId);

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

// ▼▼▼ [신규] 마이룸 아이템 구매 함수 ▼▼▼
export async function buyMyRoomItem(playerId, item) {
  const playerRef = doc(db, "players", playerId);

  return runTransaction(db, async (transaction) => {
    const playerDoc = await transaction.get(playerRef);
    if (!playerDoc.exists()) {
      throw new Error("플레이어 정보를 찾을 수 없습니다.");
    }
    const playerData = playerDoc.data();

    // sale 로직 추가
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
      ownedMyRoomItems: arrayUnion(item.id) // ownedParts가 아닌 ownedMyRoomItems에 추가
    });

    await addPointHistory(
      playerData.authUid,
      playerData.name,
      -finalPrice,
      `마이룸 아이템 '${item.displayName || item.id}' 구매`
    );
  });
}

export async function updatePlayerProfile(playerId, profileData) {
  if (profileData.name && profileData.name.trim().length === 0) {
    throw new Error("이름을 비워둘 수 없습니다.");
  }
  const playerRef = doc(db, "players", playerId);
  await updateDoc(playerRef, profileData);
}


// --- 학급 공동 목표 ---
export async function createClassGoal(goalData) {
  await addDoc(collection(db, "classGoals"), {
    ...goalData,
    currentPoints: 0,
    status: "active",
    createdAt: serverTimestamp(),
  });
}

export async function getActiveGoals() {
  const goalsRef = collection(db, "classGoals");
  // ▼▼▼ [수정] 'active' 와 'paused' 상태의 목표를 모두 가져오도록 변경 ▼▼▼
  const q = query(goalsRef, where("status", "in", ["active", "paused"]), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);

  const goals = [];
  for (const goalDoc of querySnapshot.docs) {
    const goalData = { id: goalDoc.id, ...goalDoc.data() };
    const contributionsRef = collection(db, "classGoals", goalDoc.id, "contributions");
    const contributionsSnap = await getDocs(contributionsRef);
    goalData.contributions = contributionsSnap.docs.map(doc => doc.data());
    goals.push(goalData);
  }
  return goals;
}

export async function donatePointsToGoal(playerId, goalId, amount) {
  if (amount <= 0) {
    throw new Error("기부할 포인트를 올바르게 입력해주세요.");
  }

  const playerRef = doc(db, "players", playerId);
  const goalRef = doc(db, "classGoals", goalId);
  const contributionRef = doc(collection(db, "classGoals", goalId, "contributions"));

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
      playerId: playerId,
      playerName: playerData.name,
      amount: amount,
      timestamp: serverTimestamp()
    });

    addPointHistory(
      playerData.authUid,
      playerData.name,
      -amount,
      `'${goalData.title}' 목표에 기부`
    );

    if (newTotalPoints >= goalData.targetPoints) {
      const allPlayers = await getPlayers();
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

    // [위치 수정] 이 줄을 runTransaction 안으로 이동했습니다.
    await checkAndGrantAutoTitles(playerId, playerData.authUid);
  });
}


// ▼▼▼ [추가] 목표 상태를 변경하는 함수 추가 ▼▼▼
export async function updateClassGoalStatus(goalId, newStatus) {
  const goalRef = doc(db, "classGoals", goalId);
  await updateDoc(goalRef, {
    status: newStatus
  });
}

export async function completeClassGoal(goalId) {
  const goalRef = doc(db, "classGoals", goalId);
  await updateDoc(goalRef, {
    status: "completed"
  });
}

export async function deleteClassGoal(goalId) {
  const goalRef = doc(db, "classGoals", goalId);
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

export async function isAttendanceRewardAvailable(playerId) {
  const playerRef = doc(db, "players", playerId);
  const playerSnap = await getDoc(playerRef);

  if (!playerSnap.exists()) {
    console.error("출석 체크 대상 플레이어를 찾을 수 없습니다.");
    return false;
  }

  const playerData = playerSnap.data();
  const todayStr = getTodayDateString();

  if (playerData.lastAttendance === todayStr) {
    return false;
  }

  return true;
}

export async function grantAttendanceReward(playerId, rewardAmount) {
  const isAvailable = await isAttendanceRewardAvailable(playerId);
  if (!isAvailable) {
    throw new Error("이미 오늘 출석 보상을 받았습니다.");
  }

  const playerRef = doc(db, "players", playerId);
  const todayStr = getTodayDateString();

  // 어제 날짜 계산
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const playerDoc = await getDoc(playerRef);
  if (!playerDoc.exists()) return;
  const playerData = playerDoc.data();

  // 연속 출석일 계산
  let consecutiveDays = playerData.consecutiveAttendanceDays || 0;
  if (playerData.lastAttendance === yesterdayStr) {
    consecutiveDays += 1; // 어제도 출석했으면 +1
  } else {
    consecutiveDays = 1; // 연속 출석이 끊겼으면 1로 초기화
  }

  await updateDoc(playerRef, {
    points: increment(rewardAmount),
    lastAttendance: todayStr,
    consecutiveAttendanceDays: consecutiveDays,
  });

  await addPointHistory(
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

  // [추가] 출석 보상 지급 후, 자동 칭호 획득 조건을 확인합니다.
  await checkAndGrantAutoTitles(playerId, playerData.authUid);
}

export async function getAvatarMemorials(seasonId) {
  const memorialsRef = collection(db, 'seasons', seasonId, 'memorials');
  const querySnapshot = await getDocs(memorialsRef);
  return querySnapshot.docs.map(doc => doc.data());
}

// [수정] 선수의 전체 시즌 기록(득점, 경기목록, 순위 포함)을 가져오는 함수
export async function getPlayerSeasonStats(playerId) {
  if (!playerId) return [];

  const allSeasons = await getSeasons();
  const allPlayers = await getPlayers(); // players를 한 번만 불러오도록 수정

  const statsBySeason = {};

  for (const season of allSeasons) {
    const seasonId = season.id;
    const allTeamsInSeason = await getTeams(seasonId);
    const playerTeam = allTeamsInSeason.find(t => t.members.includes(playerId));

    if (playerTeam) {
      // [수정 시작] 해당 시즌의 '모든' 박제 정보를 한 번에 불러옵니다.
      const memorialsRef = collection(db, 'seasons', seasonId, 'memorials');
      const memorialsSnap = await getDocs(memorialsRef);
      const memorialsMap = new Map(memorialsSnap.docs.map(doc => [doc.id, doc.data().avatarConfig]));
      // [수정 끝]

      const allMatchesInSeason = await getMatches(seasonId);
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
export async function likeMyRoom(roomId, likerId, likerName) {
  const roomOwnerRef = doc(db, "players", roomId);
  const likerRef = doc(db, "players", likerId);
  const likeHistoryRef = doc(db, "players", roomId, "myRoomLikes", likerId);

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
    await addPointHistory(likerId, likerName, 100, `${roomOwnerName}의 마이룸 '좋아요' 보상`);

    createNotification(
      roomId,
      `❤️ ${likerName}님이 내 마이룸을 좋아합니다!`,
      "내 마이룸을 방문해서 확인해보세요!",
      "myroom_like",
      `/my-room/${roomId}`
    );

    await checkAndGrantAutoTitles(roomId, roomOwnerData.authUid);
  });
}

/**
 * 마이룸에 댓글을 작성합니다.
 * @param {string} roomId - 댓글이 달릴 마이룸의 주인 플레이어 ID
 * @param {object} commentData - 댓글 데이터 (commenterId, commenterName, text)
 */
export async function addMyRoomComment(roomId, commentData) {
  const commentsRef = collection(db, "players", roomId, "myRoomComments");
  await addDoc(commentsRef, {
    ...commentData,
    createdAt: serverTimestamp(),
    likes: [] // '좋아요'를 누른 사람 목록
  });

  // 마이룸 주인에게 알림 전송
  createNotification(
    roomId,
    `💬 ${commentData.commenterName}님이 댓글을 남겼습니다.`,
    `"${commentData.text}"`,
    "myroom_comment",
    `/my-room/${roomId}`
  );
}

/**
 * 마이룸 댓글에 '좋아요'를 누르고, 방 주인이 누를 경우에만 보상을 지급합니다.
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - '좋아요'를 받을 댓글 ID
 * @param {string} likerId - '좋아요'를 누르는 사람 ID
 */
export async function likeMyRoomComment(roomId, commentId, likerId) {
  const commentRef = doc(db, "players", roomId, "myRoomComments", commentId);

  // 방 주인이 좋아요를 눌렀을 때만 포인트 지급 트랜잭션 실행
  if (likerId === roomId) {
    return runTransaction(db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) throw new Error("댓글을 찾을 수 없습니다.");

      const commentData = commentSnap.data();
      if (commentData.likes.includes(likerId)) {
        throw new Error("이미 '좋아요'를 누른 댓글입니다.");
      }

      const commenterRef = doc(db, "players", commentData.commenterId);
      const commenterSnap = await transaction.get(commenterRef);
      if (!commenterSnap.exists()) throw new Error("댓글 작성자 정보를 찾을 수 없습니다.");

      // 댓글 작성자에게 30P 지급
      transaction.update(commenterRef, { points: increment(30) });
      // 댓글에 '좋아요' 누른 사람 기록
      transaction.update(commentRef, { likes: arrayUnion(likerId) });

      await addPointHistory(commentData.commenterId, commentData.commenterName, 30, "칭찬 댓글 '좋아요' 보상");

      // ▼▼▼ [수정] 알림 통합 로직으로 변경 ▼▼▼
      await createOrUpdateAggregatedNotification(
        commentData.commenterId,
        "comment_like",
        30,
        "❤️ 내 댓글에 '좋아요'를 받았어요!",
        "칭찬 댓글 보상으로 {amount}P를 획득했습니다!"
      );
    });
  } else {
    // 방문자가 '좋아요'를 누를 경우, 포인트 지급 없이 '좋아요' 기록만 추가
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
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 댓글 ID
 * @param {object} reply - '좋아요'를 받을 답글 객체
 * @param {string} likerId - '좋아요'를 누르는 사람 (원본 댓글 작성자) ID
 */
export async function likeMyRoomReply(roomId, commentId, reply, likerId) {
  const commentRef = doc(db, "players", roomId, "myRoomComments", commentId);
  const roomOwnerRef = doc(db, "players", roomId); // Read 대상을 미리 지정

  return runTransaction(db, async (transaction) => {
    // ▼▼▼ 모든 Read 작업을 transaction 시작 부분으로 이동 ▼▼▼
    const commentSnap = await transaction.get(commentRef);
    const roomOwnerSnap = await transaction.get(roomOwnerRef);

    if (!commentSnap.exists()) throw new Error("댓글을 찾을 수 없습니다.");
    if (!roomOwnerSnap.exists()) throw new Error("방 주인 정보를 찾을 수 없습니다.");

    const commentData = commentSnap.data();
    const replies = commentData.replies || [];
    // Firestore 타임스탬프 객체는 toDate()로 변환 후 비교해야 정확합니다.
    const replyIndex = replies.findIndex(r =>
      r.createdAt?.toDate().getTime() === reply.createdAt?.toDate().getTime() && r.text === reply.text
    );

    if (replyIndex === -1) throw new Error("답글을 찾을 수 없습니다.");
    if (replies[replyIndex].likes.includes(likerId)) throw new Error("이미 '좋아요'를 누른 답글입니다.");

    // ▼▼▼ 모든 Write 작업을 Read 이후에 실행 ▼▼▼
    transaction.update(roomOwnerRef, { points: increment(15) });

    replies[replyIndex].likes.push(likerId);
    transaction.update(commentRef, { replies: replies });

    const roomOwnerData = roomOwnerSnap.data();
    await addPointHistory(roomId, roomOwnerData.name, 15, "내 답글 '좋아요' 보상");

    await createOrUpdateAggregatedNotification(
      roomId, // 알림 받을 사람 (방 주인)
      "reply_like",
      15,
      "❤️ 내 답글에 '좋아요'를 받았어요!",
      "답글 '좋아요' 보상으로 {amount}P를 획득했습니다!"
    );
    // ▲▲▲ [수정 완료] ▲▲▲
  });
}


/**
 * 특정 마이룸의 모든 댓글을 불러옵니다.
 * @param {string} roomId - 마이룸 주인 ID
 * @returns {Array<object>} - 댓글 목록
 */
export async function getMyRoomComments(roomId) {
  const commentsRef = collection(db, "players", roomId, "myRoomComments");
  const q = query(commentsRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * [관리자용] 모든 마이룸의 모든 댓글을 불러옵니다.
 * @returns {Array<object>} - 모든 댓글 목록
 */
export async function getAllMyRoomComments() {
  const commentsQuery = query(collectionGroup(db, 'myRoomComments'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(commentsQuery);
  // 각 댓글 문서에서 부모(플레이어) ID를 가져와서 데이터에 추가
  return querySnapshot.docs.map(doc => {
    const parentPath = doc.ref.parent.parent.path;
    const roomId = parentPath.split('/').pop();
    return { id: doc.id, roomId, ...doc.data() };
  });
}

/**
 * [관리자용] 특정 마이룸의 댓글을 삭제합니다.
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 삭제할 댓글 ID
 */
export async function deleteMyRoomComment(roomId, commentId) {
  const commentRef = doc(db, "players", roomId, "myRoomComments", commentId);
  await deleteDoc(commentRef);
}

/**
 * [관리자용] 특정 마이룸의 대댓글을 삭제합니다.
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 댓글 ID
 * @param {object} replyToDelete - 삭제할 답글 객체
 */
export async function deleteMyRoomReply(roomId, commentId, replyToDelete) {
  const commentRef = doc(db, "players", roomId, "myRoomComments", commentId);
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
 * @param {string} roomId - 마이룸 주인 ID
 * @param {string} commentId - 답글을 달 댓글 ID
 * @param {object} replyData - 답글 데이터 (replierId, replierName, text)
 */
export async function addMyRoomReply(roomId, commentId, replyData) {
  const commentRef = doc(db, "players", roomId, "myRoomComments", commentId);
  const commentSnap = await getDoc(commentRef);

  if (!commentSnap.exists()) {
    throw new Error("원본 댓글을 찾을 수 없습니다.");
  }
  const commentData = commentSnap.data();

  const reply = {
    ...replyData,
    createdAt: new Date(), // serverTimestamp()를 new Date()로 변경
    likes: []
  };

  // replies 필드가 없으면 생성하고, 있으면 추가합니다.
  await updateDoc(commentRef, {
    replies: arrayUnion(reply)
  });

  // 원본 댓글 작성자에게 알림 전송
  createNotification(
    commentData.commenterId, // 알림 받을 사람 (댓글 작성자)
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

export async function updateAvatarPartCategory(partId, newCategory) {
  const partRef = doc(db, 'avatarParts', partId);
  await updateDoc(partRef, { category: newCategory });
}

// [신규] 마이룸 아이템 카테고리 업데이트 함수
export async function updateMyRoomItemCategory(itemId, newCategory) {
  const itemRef = doc(db, "myRoomItems", itemId);
  await updateDoc(itemRef, { category: newCategory });
}

// [신규] 아바타 파츠 카테고리 일괄 업데이트 함수
export async function batchUpdateAvatarPartCategory(partIds, newCategory) {
  const batch = writeBatch(db);
  partIds.forEach(partId => {
    const partRef = doc(db, "avatarParts", partId);
    batch.update(partRef, { category: newCategory });
  });
  await batch.commit();
}

// [신규] 마이룸 아이템 카테고리 일괄 업데이트 함수
export async function batchUpdateMyRoomItemCategory(itemIds, newCategory) {
  const batch = writeBatch(db);
  itemIds.forEach(itemId => {
    const itemRef = doc(db, "myRoomItems", itemId);
    batch.update(itemRef, { category: newCategory });
  });
  await batch.commit();
}

export async function getAttendanceByDate(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const historyRef = collection(db, 'point_history');
  const q = query(
    historyRef,
    where('reason', '==', "출석 체크 보상"),
    where('timestamp', '>=', startOfDay),
    where('timestamp', '<=', endOfDay)
  );

  const querySnapshot = await getDocs(q);
  // 중복된 authUid를 제거하여 한 학생이 여러 번 기록되었더라도 한 번만 표시되도록 합니다.
  const attendedAuthUids = [...new Set(querySnapshot.docs.map(doc => doc.data().playerId))];
  return attendedAuthUids;
}

// =================================================================
// ▼▼▼ [신규] 관리자가 1:1 대화를 시작하는 함수 ▼▼▼
// =================================================================

/**
 * 관리자가 학생에게 첫 메시지를 보내 대화를 시작합니다.
 * @param {string} studentId - 메시지를 받을 학생의 ID
 * @param {string} studentName - 메시지를 받을 학생의 이름
 * @param {string} adminMessage - 관리자가 보내는 첫 메시지 내용
 * @param {string} studentAuthUid - 학생의 Firebase Auth UID (알림 전송용)
 */
export async function adminInitiateConversation(studentId, studentName, adminMessage, studentAuthUid) {
  if (!adminMessage.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date();

  // 새로운 대화 문서를 생성합니다.
  await addDoc(collection(db, "suggestions"), {
    studentId,
    studentName,
    message: `(선생님이 보낸 메시지) ${adminMessage}`, // 원본 메시지 필드 형식 유지
    conversation: [
      {
        sender: 'admin',
        content: adminMessage,
        createdAt: now
      }
    ],
    status: "replied", // 관리자가 시작했으므로 바로 'replied' 상태
    createdAt: now,
    lastMessageAt: now,
  });

  // 학생에게 알림을 보냅니다.
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

// =================================================================
// ▼▼▼ [신규] 관리자가 전체 학생에게 메시지를 발송하는 함수 ▼▼▼
// =================================================================

/**
 * 관리자가 모든 학생에게 전체 메시지를 발송합니다.
 * @param {string} adminMessage - 발송할 메시지 내용
 */
export async function sendBulkMessageToAllStudents(adminMessage) {
  if (!adminMessage.trim()) {
    throw new Error("메시지 내용을 입력해야 합니다.");
  }
  const now = new Date();

  const allPlayers = await getPlayers();
  // [수정] 'admin' 역할을 제외한 모든 학생에게 메시지를 보내도록 필터를 수정합니다.
  const students = allPlayers.filter(p => p.role !== 'admin' && p.status !== 'inactive');

  for (const student of students) {
    const suggestionsRef = collection(db, "suggestions");
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
      await addDoc(collection(db, "suggestions"), {
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

// =================================================================
// ▼▼▼ [신규] 칭호 시스템 관련 함수들 ▼▼▼
// =================================================================

/**
 * 모든 칭호 목록을 가져옵니다.
 * @returns {Promise<Array<object>>} 칭호 객체 배열
 */
export async function getTitles() {
  const titlesRef = collection(db, "titles");
  const q = query(titlesRef, orderBy("createdAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * 새로운 칭호를 생성합니다.
 * @param {object} titleData - 칭호 데이터 (name, description, icon, type 등)
 */
export async function createTitle(titleData) {
  await addDoc(collection(db, "titles"), {
    ...titleData,
    color: titleData.color || '#000000', // [추가] 색상 필드 (기본값: 검정)
    createdAt: serverTimestamp(),
  });
}

/**
 * 특정 칭호 정보를 업데이트합니다.
  * @param {object} dataToUpdate - 수정할 데이터
 */
export async function updateTitle(titleId, dataToUpdate) {
  const titleRef = doc(db, "titles", titleId);
  // [수정] color 필드도 업데이트 목록에 포함시킵니다.
  await updateDoc(titleRef, {
    ...dataToUpdate,
    color: dataToUpdate.color || '#000000'
  });
}

/**
 * 특정 칭호를 삭제합니다.
 * @param {string} titleId - 삭제할 칭호의 ID
 */
export async function deleteTitle(titleId) {
  const titleRef = doc(db, "titles", titleId);
  await deleteDoc(titleRef);
}

/**
 * 특정 학생에게 칭호를 수동으로 부여합니다.
 * @param {string} playerId - 칭호를 받을 학생의 ID
 * @param {string} titleId - 부여할 칭호의 ID
 */
export async function grantTitleToPlayer(playerId, titleId) {
  const playerRef = doc(db, "players", playerId);
  await updateDoc(playerRef, {
    ownedTitles: arrayUnion(titleId)
  });
}

// 교체할 내용
/**
 * [신규] 관리자가 학생에게 칭호를 수동으로 부여하고 보상을 지급합니다.
 * @param {string} playerId - 칭호를 받을 학생의 ID
 * @param {string} titleId - 부여할 칭호의 ID
 */
export async function grantTitleToPlayerManually(playerId, titleId) {
  const playerRef = doc(db, "players", playerId);
  const playerSnap = await getDoc(playerRef);

  if (!playerSnap.exists()) {
    throw new Error("플레이어를 찾을 수 없습니다.");
  }
  const playerData = playerSnap.data();

  // 이미 칭호를 소유하고 있는지 확인
  if (playerData.ownedTitles && playerData.ownedTitles.includes(titleId)) {
    throw new Error("이미 소유하고 있는 칭호입니다.");
  }

  // 칭호 정보 가져오기 (보상 메시지에 사용)
  const titleRef = doc(db, "titles", titleId);
  const titleSnap = await getDoc(titleRef);
  if (!titleSnap.exists()) {
    throw new Error("칭호 정보를 찾을 수 없습니다.");
  }
  const title = titleSnap.data();

  // 1. 칭호 부여
  await updateDoc(playerRef, {
    ownedTitles: arrayUnion(titleId)
  });

  // 2. 보상 지급 (adjustPlayerPoints 재활용)
  await adjustPlayerPoints(playerId, 500, `칭호 [${title.name}] 획득 보상`);
}

// [추가] 여러 학생에게 칭호를 일괄 부여하는 함수
export async function grantTitleToPlayersBatch(playerIds, titleId) {
  const titleRef = doc(db, "titles", titleId);
  const titleSnap = await getDoc(titleRef);
  if (!titleSnap.exists()) {
    throw new Error("칭호 정보를 찾을 수 없습니다.");
  }
  const title = titleSnap.data();

  for (const playerId of playerIds) {
    const playerRef = doc(db, "players", playerId);
    const playerSnap = await getDoc(playerRef);

    if (playerSnap.exists()) {
      const playerData = playerSnap.data();
      if (!playerData.ownedTitles || !playerData.ownedTitles.includes(titleId)) {
        await updateDoc(playerRef, {
          ownedTitles: arrayUnion(titleId)
        });
        await adjustPlayerPoints(playerId, 500, `칭호 [${title.name}] 획득 보상`);
      }
    }
  }
}

// 교체할 부분의 아랫 한 줄 코드
/**
 * 학생이 장착할 칭호를 설정합니다.
 * @param {string} playerId - 학생 ID
 * @param {string} titleId - 장착할 칭호 ID (해제는 null)
 */
export async function equipTitle(playerId, titleId) {
  const playerRef = doc(db, "players", playerId);
  await updateDoc(playerRef, {
    equippedTitle: titleId
  });
}

