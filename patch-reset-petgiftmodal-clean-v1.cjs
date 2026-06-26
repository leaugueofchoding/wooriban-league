#!/usr/bin/env node
/**
 * patch-reset-petgiftmodal-clean-v1.cjs
 *
 * 증상:
 * - Identifier 'auth' has already been declared
 * - Identifier 'getSeenKey' has already been declared
 *
 * 원인:
 * - PetGiftModal.jsx에 여러 부분 패치가 누적되면서 import/helper/component가 중복됨.
 *
 * 해결:
 * - src/components/PetGiftModal.jsx 전체를 깨끗한 단일 버전으로 교체.
 * - 기능:
 *   1) 같은 선물 모달은 localStorage + Firestore 서버 마커로 중복 표시 방지
 *   2) 확인 버튼 클릭 시 players/{playerId}에 seenGiftIds / giftConfirmations / latestGift.confirmedAt 저장
 *   3) 다른 브라우저에서도 같은 선물 모달이 다시 뜨지 않게 처리
 *
 * 실행:
 *   node patch-reset-petgiftmodal-clean-v1.cjs
 *   npm run dev
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const filePath = path.join(root, 'src', 'components', 'PetGiftModal.jsx');

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function backupFile(filePath, suffix) {
  const backupDir = path.join(root, '.patch-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.${suffix}.${timestamp}.bak`);
  fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'), 'utf8');
  return backupPath;
}

if (!fs.existsSync(filePath)) {
  fail(`파일을 찾지 못했습니다: ${filePath}`);
}

const backup = backupFile(filePath, 'reset-clean-v1');

const cleanCode = `// src/components/PetGiftModal.jsx

import React, { useEffect, useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../api/firebase';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { PET_ITEMS } from '../features/pet/petItems';

const pop = keyframes\`
  from { opacity: 0; transform: translateY(18px) scale(0.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
\`;

const Backdrop = styled.div\`
  position: fixed;
  inset: 0;
  z-index: 3500;
  background: rgba(0,0,0,0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  backdrop-filter: blur(5px);
\`;

const Modal = styled.div\`
  width: min(460px, 100%);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(255,212,59,0.28), transparent 42%),
    radial-gradient(circle at bottom right, rgba(116,192,252,0.30), transparent 46%),
    #ffffff;
  box-shadow: 0 24px 70px rgba(0,0,0,0.30);
  padding: 2rem;
  text-align: center;
  animation: \${pop} 0.28s ease-out;
  border: 4px solid #fff3bf;
\`;

const GiftIcon = styled.div\`
  width: 92px;
  height: 92px;
  margin: 0 auto 0.8rem;
  border-radius: 30px;
  background: linear-gradient(135deg, #ffd43b, #ff922b);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.6rem;
  box-shadow: 0 12px 28px rgba(255,146,43,0.35);
\`;

const Title = styled.h2\`
  margin: 0 0 0.5rem;
  color: #212529;
  font-size: 1.85rem;
  font-weight: 1000;
\`;

const Message = styled.p\`
  margin: 0 0 1.4rem;
  color: #495057;
  line-height: 1.6;
  font-weight: 800;
\`;

const ItemList = styled.div\`
  display: grid;
  gap: 0.8rem;
  margin: 1.2rem 0 1.6rem;
\`;

const ItemRow = styled.div\`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  border-radius: 18px;
  background: rgba(255,255,255,0.82);
  border: 2px solid #e9ecef;
  padding: 0.9rem;
  text-align: left;

  img {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 14px;
    background: #f8f9fa;
    padding: 0.25rem;
  }

  .fallback-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: #f8f9fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.7rem;
  }

  strong {
    display: block;
    color: #212529;
    font-size: 1.02rem;
  }

  span {
    color: #868e96;
    font-weight: 800;
    font-size: 0.88rem;
  }
\`;

const ConfirmButton = styled.button\`
  width: 100%;
  border: none;
  border-radius: 16px;
  padding: 1rem 1.2rem;
  background: linear-gradient(135deg, #339af0, #1864ab);
  color: white;
  font-size: 1.05rem;
  font-weight: 1000;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(51,154,240,0.30);

  &:hover {
    transform: translateY(-2px);
  }
\`;

function getSeenKey(classId, giftId, userId) {
  return \`seen-pet-gift:\${classId || 'default'}:\${userId || 'unknown'}:\${giftId}\`;
}

function getSafeGiftKey(giftId) {
  return String(giftId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getGiftItems(gift) {
  return Array.isArray(gift?.items) && gift.items.length > 0
    ? gift.items
    : [
        { id: 'evolution_stone', name: '진화의 돌', amount: 1 },
        { id: 'pet_egg', name: '펫 알', amount: 1 },
      ];
}

function isGiftConfirmedForPlayer(gift, player) {
  if (!gift?.id || !player) return false;

  const safeGiftKey = getSafeGiftKey(gift.id);
  const seenGiftIds = Array.isArray(player.seenGiftIds) ? player.seenGiftIds : [];
  const confirmations = player.giftConfirmations || {};

  return Boolean(
    gift.seenAt ||
    gift.confirmedAt ||
    gift.acknowledgedAt ||
    gift.dismissedAt ||
    gift.isConfirmed ||
    gift.seen === true ||
    gift.confirmed === true ||
    seenGiftIds.includes(gift.id) ||
    confirmations[gift.id] ||
    confirmations[safeGiftKey]
  );
}

function PetGiftModal() {
  const { players } = useLeagueStore();
  const { classId } = useClassStore();
  const [isOpen, setIsOpen] = useState(false);

  const myPlayerData = useMemo(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    return players.find(player => player.authUid === uid);
  }, [players]);

  const latestGift = myPlayerData?.latestGift;

  useEffect(() => {
    if (!latestGift?.id || !myPlayerData?.authUid) {
      setIsOpen(false);
      return;
    }

    if (isGiftConfirmedForPlayer(latestGift, myPlayerData)) {
      setIsOpen(false);
      return;
    }

    const seenKey = getSeenKey(classId, latestGift.id, myPlayerData.authUid);
    const alreadySeenInThisBrowser = localStorage.getItem(seenKey);

    setIsOpen(!alreadySeenInThisBrowser);
  }, [
    classId,
    latestGift?.id,
    latestGift?.seenAt,
    latestGift?.confirmedAt,
    latestGift?.acknowledgedAt,
    latestGift?.dismissedAt,
    latestGift?.isConfirmed,
    latestGift?.seen,
    latestGift?.confirmed,
    myPlayerData?.authUid,
    myPlayerData?.seenGiftIds,
    myPlayerData?.giftConfirmations,
  ]);

  if (!isOpen || !latestGift) return null;

  const items = getGiftItems(latestGift);

  const markGiftSeenOnServer = async () => {
    if (!classId || !myPlayerData?.id || !myPlayerData?.authUid || !latestGift?.id) return;
    if (isGiftConfirmedForPlayer(latestGift, myPlayerData)) return;

    const safeGiftKey = getSafeGiftKey(latestGift.id);
    const playerRef = doc(db, 'classes', classId, 'players', myPlayerData.id);

    await updateDoc(playerRef, {
      seenGiftIds: arrayUnion(latestGift.id),
      [\`giftConfirmations.\${safeGiftKey}\`]: {
        id: latestGift.id,
        confirmedAt: new Date().toISOString(),
        confirmedBy: myPlayerData.authUid,
      },
      'latestGift.seenAt': serverTimestamp(),
      'latestGift.confirmedAt': serverTimestamp(),
      'latestGift.confirmedBy': myPlayerData.authUid,
    });
  };

  const handleClose = async () => {
    if (latestGift?.id && myPlayerData?.authUid) {
      localStorage.setItem(getSeenKey(classId, latestGift.id, myPlayerData.authUid), '1');
    }

    setIsOpen(false);

    try {
      await markGiftSeenOnServer();
    } catch (error) {
      console.error('선물 확인 상태 서버 저장 실패:', error);
    }
  };

  return (
    <Backdrop>
      <Modal>
        <GiftIcon>🎁</GiftIcon>
        <Title>{latestGift.title || '선물이 도착했어요!'}</Title>
        <Message>
          {latestGift.message || '선생님이 특별한 선물을 보내셨어요.'}
        </Message>

        <ItemList>
          {items.map((item, index) => {
            const itemInfo = PET_ITEMS[item.id];
            const image = itemInfo?.image || itemInfo?.icon;

            return (
              <ItemRow key={\`\${item.id}-\${index}\`}>
                {image ? (
                  <img src={image} alt={item.name || itemInfo?.name || item.id} />
                ) : (
                  <div className="fallback-icon">{item.id === 'pet_egg' ? '🥚' : '✨'}</div>
                )}

                <div>
                  <strong>{item.name || itemInfo?.name || item.id} × {item.amount ?? 1}</strong>
                  <span>펫 가방에서 확인할 수 있어요.</span>
                </div>
              </ItemRow>
            );
          })}
        </ItemList>

        <ConfirmButton onClick={handleClose}>
          고마워요! 확인했어요
        </ConfirmButton>
      </Modal>
    </Backdrop>
  );
}

export default PetGiftModal;
`;

fs.writeFileSync(filePath, cleanCode, 'utf8');

ok(`백업 생성: ${path.relative(root, backup)}`);
ok('PetGiftModal.jsx 전체를 깨끗한 단일 버전으로 교체 완료');

console.log('\n다음 명령으로 확인하세요:\n');
console.log('  npm run dev\n');
console.log('확인 명령:');
console.log('  Select-String -Path .\\src\\components\\PetGiftModal.jsx -Pattern "function getSeenKey|function isGiftConfirmedForPlayer|import \\{ auth, db \\}" -Context 1,1\n');
console.log('테스트:');
console.log('  1. 빈 화면 에러가 사라지는지');
console.log('  2. 선물 모달 확인 후 player 문서에 seenGiftIds / giftConfirmations / latestGift.confirmedAt 저장되는지');
console.log('  3. 새 브라우저에서 같은 학생으로 접속해도 같은 선물 모달이 다시 뜨지 않는지');
console.log('');
