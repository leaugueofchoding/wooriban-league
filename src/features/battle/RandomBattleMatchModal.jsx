// src/features/battle/RandomBattleMatchModal.jsx
// GLOBAL_RANDOM_BATTLE_MATCH_MODAL_PATCH
// GLOBAL_RANDOM_BATTLE_AUTO_MATCH_FIX_PATCH
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { useClassStore, useLeagueStore } from '../../store/leagueStore';
import {
  cancelRandomBattleQueueEntry,
  enterRandom1v1Battle,
  enterRandomTeamBattle,
  forfeitRandomTeamBattleAndRequeue,
  tryMatchRandomBattleQueue,
} from './randomBattleApi';

function RandomBattleMatchModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { classId } = useClassStore();
  const { players } = useLeagueStore();

  const myPlayerData = useMemo(() => (
    players.find(player => player.authUid === auth.currentUser?.uid)
  ), [players]);

  const [queueEntries, setQueueEntries] = useState({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!classId || !myPlayerData?.id) {
      setQueueEntries({});
      return;
    }

    const refs = {
      'random-1v1': doc(db, 'classes', classId, 'randomBattleQueue', myPlayerData.id + '_1v1'),
      'random-team': doc(db, 'classes', classId, 'randomBattleQueue', myPlayerData.id + '_team'),
    };

    const unsubscribes = Object.entries(refs).map(([mode, queueRef]) => (
      onSnapshot(queueRef, (snap) => {
        setQueueEntries(prev => ({
          ...prev,
          [mode]: snap.exists() ? { id: snap.id, mode, ...snap.data() } : null,
        }));
      })
    ));

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [classId, myPlayerData?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const random1v1Entry = queueEntries['random-1v1'];
  const randomTeamEntry = queueEntries['random-team'];

  const waitingModes = useMemo(() => {
    const modes = [];

    if (random1v1Entry?.status === 'waiting') {
      modes.push('random-1v1');
    }

    if (randomTeamEntry?.status === 'waiting') {
      modes.push('random-team');
    }

    return modes;
  }, [random1v1Entry?.status, randomTeamEntry?.status]);

  const waitingModeKey = waitingModes.join('|');

  useEffect(() => {
    if (!classId || !myPlayerData?.id || !waitingModes.length) return;

    let cancelled = false;

    const tryMatch = async () => {
      for (const mode of waitingModes) {
        if (cancelled) return;

        try {
          await tryMatchRandomBattleQueue(classId, myPlayerData.id, mode);
        } catch (error) {
          console.warn('전역 랜덤대전 매칭 시도 오류:', error);
        }
      }
    };

    tryMatch();
    const intervalId = window.setInterval(tryMatch, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [classId, myPlayerData?.id, waitingModeKey]);

  const activeTeam = randomTeamEntry && ['matched', 'entering'].includes(randomTeamEntry.status)
    ? randomTeamEntry
    : null;

  const active1v1 = random1v1Entry && ['matched', 'entering'].includes(random1v1Entry.status)
    ? random1v1Entry
    : null;

  const activeEntry = activeTeam || active1v1;
  const isTeam = activeEntry?.mode === 'random-team';
  const isBattleRoute = location.pathname.startsWith('/battle/');

  if (!classId || !myPlayerData?.id || !activeEntry || isBattleRoute) {
    return null;
  }

  const queuedAtMs = Number(activeEntry.queueStartedAtMs || 0);
  const waitSeconds = queuedAtMs > 0 ? Math.max(0, Math.floor((nowMs - queuedAtMs) / 1000)) : null;

  const handleEnter = async () => {
    if (!classId || !myPlayerData?.id) return;

    try {
      setIsProcessing(true);

      if (isTeam) {
        const result = await enterRandomTeamBattle(classId, myPlayerData.id);
        navigate('/battle/team/' + encodeURIComponent(result.matchId));
        return;
      }

      const result = await enterRandom1v1Battle(classId, myPlayerData.id);
      const query = result.matchId ? '?randomMatchId=' + encodeURIComponent(result.matchId) : '';
      navigate('/battle/' + encodeURIComponent(result.opponentId) + query);
    } catch (error) {
      alert((isTeam ? '팀대전 입장 실패: ' : '1:1 대전 입장 실패: ') + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!classId || !myPlayerData?.id) return;

    const message = isTeam
      ? '팀대전 매칭을 거절하면 3분 동안 팀대전에 다시 참가할 수 없습니다. 정말 거절할까요?'
      : '이번 랜덤대전을 취소할까요?';

    const ok = window.confirm(message);
    if (!ok) return;

    try {
      setIsProcessing(true);

      if (isTeam) {
        await forfeitRandomTeamBattleAndRequeue(classId, myPlayerData.id);
      } else {
        await cancelRandomBattleQueueEntry(classId, myPlayerData.id);
      }
    } catch (error) {
      alert('랜덤대전 취소 실패: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  };

  const modalStyle = {
    width: 'min(420px, 100%)',
    background: 'white',
    borderRadius: '24px',
    border: '5px solid #5f3dc4',
    padding: '1.25rem',
    textAlign: 'center',
    fontFamily: 'Pretendard, sans-serif',
    boxShadow: '0 18px 48px rgba(0,0,0,0.25)',
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0.65rem auto 0',
    padding: '0.45rem 0.75rem',
    borderRadius: '999px',
    background: '#f3f0ff',
    color: '#5f3dc4',
    fontWeight: 1000,
    fontSize: '0.88rem',
  };

  const buttonRowStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.6rem',
    marginTop: '1rem',
  };

  const enterButtonStyle = {
    border: 'none',
    borderRadius: '14px',
    padding: '0.85rem 0.75rem',
    color: 'white',
    fontWeight: 1000,
    cursor: isProcessing ? 'not-allowed' : 'pointer',
    background: isProcessing ? '#adb5bd' : '#5f3dc4',
    boxShadow: isProcessing ? 'none' : '0 4px 0 rgba(0,0,0,0.16)',
  };

  const rejectButtonStyle = {
    ...enterButtonStyle,
    background: isProcessing ? '#adb5bd' : '#fa5252',
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, color: '#343a40', fontSize: '1.45rem', fontWeight: 1000 }}>
          {isTeam ? '👥 팀대전 매칭 완료!' : '⚔️ 1:1 대전 매칭 완료!'}
        </h2>

        <div style={badgeStyle}>
          {isTeam ? '2:2 팀대전 베타' : '랜덤 1:1 대전'}
        </div>

        <p style={{ margin: '0.75rem 0 1rem', color: '#495057', fontWeight: 850, lineHeight: 1.5 }}>
          {isTeam
            ? '4명이 모였습니다. 팀과 펫 정보는 모두 입장한 뒤 공개됩니다.'
            : '상대가 정해졌습니다. 입장하면 대기방으로 이동합니다.'}
          {waitSeconds !== null && (
            <>
              <br />
              대기 {waitSeconds}초
            </>
          )}
        </p>

        <div style={buttonRowStyle}>
          <button type="button" onClick={handleEnter} disabled={isProcessing} style={enterButtonStyle}>
            {isProcessing ? '처리 중...' : (isTeam ? '팀대전 입장' : '입장하기')}
          </button>

          <button type="button" onClick={handleReject} disabled={isProcessing} style={rejectButtonStyle}>
            {isTeam ? '거절하기' : '이번엔 쉬기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RandomBattleMatchModal;
