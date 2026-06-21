// src/pages/GardenPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useLeagueStore, useClassStore } from '../store/leagueStore';
import { auth, db } from '../api/firebase';
import baseAvatar from '../assets/base-avatar.png';
import { petImageMap } from '../utils/petImageMap';

const CROPS = {
  carrot: {
    id: 'carrot',
    name: '당근',
    emoji: '🥕',
    maxStage: 3,
    sellValue: 20,
    feedExp: 10,
    stages: ['씨앗', '새싹', '자라는 중', '수확 가능']
  },
  tomato: {
    id: 'tomato',
    name: '토마토',
    emoji: '🍅',
    maxStage: 4,
    sellValue: 35,
    feedExp: 16,
    stages: ['씨앗', '새싹', '줄기', '열매 맺는 중', '수확 가능']
  },
  potato: {
    id: 'potato',
    name: '감자',
    emoji: '🥔',
    maxStage: 3,
    sellValue: 25,
    feedExp: 12,
    stages: ['씨앗감자', '새싹', '자라는 중', '수확 가능']
  },
  strawberry: {
    id: 'strawberry',
    name: '딸기',
    emoji: '🍓',
    maxStage: 4,
    sellValue: 45,
    feedExp: 22,
    stages: ['씨앗', '새싹', '꽃', '열매 맺는 중', '수확 가능']
  }
};

function createInitialGarden() {
  return {
    version: 1,
    updatedAt: null,
    materials: {
      water: 5,
      sunlight: 0,
      fertilizer: 1,
      seedBasic: 4
    },
    inventory: {
      carrot: 0,
      tomato: 0,
      potato: 0,
      strawberry: 0
    },
    walletPoints: 0,
    plots: Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      cropId: null,
      stage: 0,
      plantedAt: null,
      updatedAt: null
    })),
    logs: [
      { id: 1, text: '텃밭이 열렸어요. 씨앗을 심어보세요!' }
    ]
  };
}

function normalizeGarden(rawGarden) {
  const initial = createInitialGarden();

  if (!rawGarden || typeof rawGarden !== 'object') {
    return initial;
  }

  const rawPlots = Array.isArray(rawGarden.plots) ? rawGarden.plots : [];

  return {
    ...initial,
    ...rawGarden,
    materials: {
      ...initial.materials,
      ...(rawGarden.materials || {})
    },
    inventory: {
      ...initial.inventory,
      ...(rawGarden.inventory || {})
    },
    plots: initial.plots.map((defaultPlot, index) => ({
      ...defaultPlot,
      ...(rawPlots[index] || {}),
      id: index + 1
    })),
    logs: Array.isArray(rawGarden.logs) ? rawGarden.logs : initial.logs
  };
}

function loadGarden(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return createInitialGarden();
    return normalizeGarden(JSON.parse(raw));
  } catch (error) {
    console.error(error);
    return createInitialGarden();
  }
}

function pushLog(garden, text) {
  return {
    ...garden,
    logs: [
      { id: Date.now(), text },
      ...(garden.logs || [])
    ].slice(0, 6)
  };
}

function getPlotEmoji(plot) {
  if (!plot.cropId) return '🟫';

  const crop = CROPS[plot.cropId];
  if (!crop) return '🌱';

  if (plot.stage >= crop.maxStage) return crop.emoji;
  if (plot.stage <= 0) return '🌰';
  if (plot.stage === 1) return '🌱';
  if (plot.stage === 2) return '🌿';
  return '🌾';
}

function getPlotLabel(plot) {
  if (!plot.cropId) return '빈 밭';

  const crop = CROPS[plot.cropId];
  if (!crop) return '알 수 없는 작물';

  if (plot.stage >= crop.maxStage) return crop.name + ' 수확 가능';

  return crop.name + ' · ' + (crop.stages[plot.stage] || '성장 중');
}

function getPlotProgress(plot) {
  if (!plot.cropId) return 0;

  const crop = CROPS[plot.cropId];
  if (!crop) return 0;

  return Math.min(100, Math.round((plot.stage / crop.maxStage) * 100));
}

function GardenPage() {
  const { players, avatarParts } = useLeagueStore();
  const { classId } = useClassStore();
  const currentUser = auth.currentUser;

  const storageKey = useMemo(() => {
    return 'gardenMvp:' + (currentUser?.uid || 'guest');
  }, [currentUser]);

  const [garden, setGarden] = useState(() => loadGarden(storageKey));
  const [selectedCropId, setSelectedCropId] = useState('carrot');
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('local');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const myPlayerData = useMemo(() => {
    return players.find(p => p.authUid === currentUser?.uid);
  }, [players, currentUser]);

  useEffect(() => {
    if (!myPlayerData) {
      setGarden(loadGarden(storageKey));
      return;
    }

    if (myPlayerData.garden) {
      setGarden(normalizeGarden(myPlayerData.garden));
      setSaveStatus('saved');
      setLastSavedAt(myPlayerData.garden.updatedAt || null);
      return;
    }

    setGarden(loadGarden(storageKey));
    setSaveStatus('local');
  }, [storageKey, myPlayerData?.id, myPlayerData?.garden?.updatedAt]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(garden));
  }, [storageKey, garden]);

  const updateGarden = (updater) => {
    setGarden(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return {
        ...next,
        updatedAt: Date.now()
      };
    });
    setSaveStatus('dirty');
  };

  const saveGardenToFirestore = async () => {
    if (!classId || !myPlayerData?.id) {
      alert('학급 또는 학생 정보를 아직 불러오지 못했어요.');
      return;
    }

    setIsSaving(true);

    try {
      const gardenToSave = {
        ...garden,
        updatedAt: Date.now()
      };

      await updateDoc(doc(db, 'classes', classId, 'players', myPlayerData.id), {
        garden: gardenToSave,
        gardenSavedAt: serverTimestamp()
      });

      localStorage.setItem(storageKey, JSON.stringify(gardenToSave));
      setGarden(gardenToSave);
      setSaveStatus('saved');
      setLastSavedAt(gardenToSave.updatedAt);
    } catch (error) {
      console.error(error);
      setSaveStatus('error');
      alert('텃밭 저장 중 오류가 발생했어요: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const myPartnerPet = useMemo(() => {
    if (!myPlayerData) return null;
    if (myPlayerData.pets && myPlayerData.pets.length > 0) {
      return myPlayerData.pets.find(p => p.id === myPlayerData.partnerPetId) || myPlayerData.pets[0];
    }
    if (myPlayerData.pet) return myPlayerData.pet;
    return null;
  }, [myPlayerData]);

  const avatarUrls = useMemo(() => {
    if (!myPlayerData?.avatarConfig || !avatarParts?.length) return [baseAvatar];

    const order = ['shoes', 'bottom', 'top', 'hair', 'face', 'eyes', 'nose', 'mouth'];
    const urls = [baseAvatar];

    order.forEach(category => {
      const partId = myPlayerData.avatarConfig[category];
      const part = avatarParts.find(p => p.id === partId);
      if (part?.src) urls.push(part.src);
    });

    if (myPlayerData.avatarConfig.accessories) {
      Object.values(myPlayerData.avatarConfig.accessories).forEach(partId => {
        const part = avatarParts.find(p => p.id === partId);
        if (part?.src) urls.push(part.src);
      });
    }

    return Array.from(new Set(urls));
  }, [myPlayerData, avatarParts]);

  const selectedPlot = garden.plots.find(plot => plot.id === selectedPlotId) || null;
  const selectedCrop = CROPS[selectedCropId];

  const plantCrop = (plotId) => {
    updateGarden(prev => {
      const plot = prev.plots.find(p => p.id === plotId);
      if (!plot) return prev;

      if (plot.cropId) {
        return pushLog(prev, '이미 작물이 심어진 밭이에요.');
      }

      if ((prev.materials.seedBasic || 0) <= 0) {
        return pushLog(prev, '씨앗이 부족해요. 나중에 미션/퀘스트 보상과 연결할 예정이에요.');
      }

      const next = {
        ...prev,
        materials: {
          ...prev.materials,
          seedBasic: prev.materials.seedBasic - 1
        },
        plots: prev.plots.map(p => {
          if (p.id !== plotId) return p;
          return {
            ...p,
            cropId: selectedCropId,
            stage: 0,
            plantedAt: Date.now(),
            updatedAt: Date.now()
          };
        })
      };

      return pushLog(next, selectedCrop.name + ' 씨앗을 심었어요.');
    });
  };

  const waterPlot = (plotId) => {
    updateGarden(prev => {
      const plot = prev.plots.find(p => p.id === plotId);
      if (!plot?.cropId) return pushLog(prev, '먼저 씨앗을 심어야 해요.');

      const crop = CROPS[plot.cropId];
      if (!crop) return prev;

      if (plot.stage >= crop.maxStage) {
        return pushLog(prev, crop.name + '은(는) 이미 수확할 수 있어요.');
      }

      if ((prev.materials.water || 0) <= 0) {
        return pushLog(prev, '물이 부족해요. 다음 단계에서 미션 보상으로 물을 얻도록 연결할 예정이에요.');
      }

      const nextStage = Math.min(crop.maxStage, plot.stage + 1);

      const next = {
        ...prev,
        materials: {
          ...prev.materials,
          water: prev.materials.water - 1
        },
        plots: prev.plots.map(p => {
          if (p.id !== plotId) return p;
          return {
            ...p,
            stage: nextStage,
            updatedAt: Date.now()
          };
        })
      };

      return pushLog(next, crop.name + '에 물을 줬어요.');
    });
  };

  const fertilizePlot = (plotId) => {
    updateGarden(prev => {
      const plot = prev.plots.find(p => p.id === plotId);
      if (!plot?.cropId) return pushLog(prev, '먼저 씨앗을 심어야 해요.');

      const crop = CROPS[plot.cropId];
      if (!crop) return prev;

      if (plot.stage >= crop.maxStage) {
        return pushLog(prev, crop.name + '은(는) 이미 수확할 수 있어요.');
      }

      if ((prev.materials.fertilizer || 0) <= 0) {
        return pushLog(prev, '비료가 부족해요.');
      }

      const nextStage = Math.min(crop.maxStage, plot.stage + 2);

      const next = {
        ...prev,
        materials: {
          ...prev.materials,
          fertilizer: prev.materials.fertilizer - 1
        },
        plots: prev.plots.map(p => {
          if (p.id !== plotId) return p;
          return {
            ...p,
            stage: nextStage,
            updatedAt: Date.now()
          };
        })
      };

      return pushLog(next, crop.name + '에 비료를 줬어요.');
    });
  };

  const harvestPlot = (plotId) => {
    updateGarden(prev => {
      const plot = prev.plots.find(p => p.id === plotId);
      if (!plot?.cropId) return pushLog(prev, '수확할 작물이 없어요.');

      const crop = CROPS[plot.cropId];
      if (!crop) return prev;

      if (plot.stage < crop.maxStage) {
        return pushLog(prev, '아직 수확할 수 없어요. 조금 더 키워보세요.');
      }

      const next = {
        ...prev,
        inventory: {
          ...prev.inventory,
          [crop.id]: (prev.inventory[crop.id] || 0) + 1
        },
        plots: prev.plots.map(p => {
          if (p.id !== plotId) return p;
          return {
            ...p,
            cropId: null,
            stage: 0,
            plantedAt: null,
            updatedAt: null
          };
        })
      };

      return pushLog(next, crop.name + '을(를) 수확했어요.');
    });
  };

  const sellCrop = (cropId) => {
    const crop = CROPS[cropId];

    updateGarden(prev => {
      if ((prev.inventory[cropId] || 0) <= 0) {
        return pushLog(prev, crop.name + '이(가) 없어요.');
      }

      const next = {
        ...prev,
        inventory: {
          ...prev.inventory,
          [cropId]: prev.inventory[cropId] - 1
        },
        walletPoints: (prev.walletPoints || 0) + crop.sellValue
      };

      return pushLog(next, crop.name + '을(를) 텃밭 지갑에 판매해서 ' + crop.sellValue + 'P를 얻었어요.');
    });
  };

  const giveTestMaterials = () => {
    updateGarden(prev => {
      const next = {
        ...prev,
        materials: {
          ...prev.materials,
          water: (prev.materials.water || 0) + 3,
          seedBasic: (prev.materials.seedBasic || 0) + 2,
          fertilizer: (prev.materials.fertilizer || 0) + 1
        }
      };

      return pushLog(next, '테스트 재료를 받았어요. 실제 보상 연결 전 임시 기능이에요.');
    });
  };

  const resetGarden = () => {
    if (!window.confirm('텃밭 테스트 데이터를 초기화할까요? 저장 전이면 Firestore에는 반영되지 않아요.')) return;
    updateGarden(createInitialGarden());
  };

  const pageStyle = {
    minHeight: '100vh',
    padding: '4.5rem 1rem 5rem',
    fontFamily: 'Pretendard, sans-serif',
    background: 'radial-gradient(circle at 20% 10%, rgba(255, 236, 153, 0.55), transparent 28%), linear-gradient(180deg, #d8f5a2 0%, #b2f2bb 42%, #8ce99a 100%)'
  };

  const shellStyle = {
    width: '100%',
    maxWidth: '1080px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.9)',
    border: '2px solid rgba(255,255,255,0.8)',
    borderRadius: '24px',
    padding: '1.2rem',
    boxShadow: '0 10px 28px rgba(43, 138, 62, 0.12)'
  };

  const buttonStyle = {
    border: 'none',
    borderRadius: '14px',
    padding: '0.7rem 0.9rem',
    fontWeight: 900,
    cursor: 'pointer',
    background: '#2f9e44',
    color: 'white',
    boxShadow: '0 4px 10px rgba(0,0,0,0.12)'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    background: 'white',
    color: '#2f9e44',
    border: '1px solid #d3f9d8'
  };

  const navLinkStyle = {
    textDecoration: 'none',
    borderRadius: '999px',
    padding: '0.65rem 1rem',
    fontWeight: 900,
    color: '#2f9e44',
    background: 'white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  };

  const saveStatusText = {
    local: '브라우저 임시 저장',
    dirty: '저장 필요',
    saved: 'Firestore 저장됨',
    error: '저장 오류'
  }[saveStatus] || '저장 상태 확인 중';

  const saveStatusColor = {
    local: '#868e96',
    dirty: '#f76707',
    saved: '#2f9e44',
    error: '#fa5252'
  }[saveStatus] || '#868e96';

  if (!myPlayerData) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <section style={cardStyle}>
            <h2 style={{ margin: 0, color: '#2b8a3e' }}>🌱 텃밭 정보를 불러오는 중...</h2>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <header style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#2b8a3e', fontWeight: 950 }}>🌱 {myPlayerData.name}의 텃밭</h1>
            <p style={{ margin: '0.35rem 0 0', color: '#5c7cfa', fontWeight: 800 }}>
              씨앗을 심고, 물을 주고, 작물을 수확하는 텃밭 MVP예요.
            </p>
            <div style={{ marginTop: '0.45rem', fontSize: '0.85rem', fontWeight: 900, color: saveStatusColor }}>
              저장 상태: {saveStatusText}
              {lastSavedAt ? ' · ' + new Date(lastSavedAt).toLocaleTimeString() : ''}
            </div>
          </div>

          <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={saveGardenToFirestore}
              disabled={isSaving}
              style={{
                ...buttonStyle,
                opacity: isSaving ? 0.65 : 1
              }}
            >
              {isSaving ? '저장 중...' : '텃밭 저장'}
            </button>
            <Link to="/" style={navLinkStyle}>대시보드</Link>
            <Link to="/missions" style={navLinkStyle}>미션</Link>
            <Link to="/pet" style={navLinkStyle}>펫센터</Link>
            <Link to={'/my-room/' + myPlayerData.id} style={navLinkStyle}>마이룸</Link>
          </nav>
        </header>

        <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: '1rem', alignItems: 'start' }}>
          <section style={{
            position: 'relative',
            minHeight: '560px',
            borderRadius: '30px',
            border: '6px solid white',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(129, 226, 160, 0.88), rgba(43, 138, 62, 0.72))',
            boxShadow: '0 16px 40px rgba(43, 138, 62, 0.22)'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: '120px',
              background: 'rgba(183, 228, 199, 0.9)',
              borderBottom: '8px solid rgba(45, 106, 79, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              fontSize: '2rem'
            }}>
              <span>🌳</span><span>🌼</span><span>🌲</span><span>🌻</span><span>🌳</span>
            </div>

            <div style={{
              position: 'relative',
              zIndex: 2,
              padding: '145px 1.4rem 190px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))',
              gap: '1rem',
              maxWidth: '650px',
              margin: '0 auto'
            }}>
              {garden.plots.map(plot => {
                const progress = getPlotProgress(plot);
                const isSelected = selectedPlotId === plot.id;

                return (
                  <button
                    key={plot.id}
                    onClick={() => setSelectedPlotId(plot.id)}
                    style={{
                      minHeight: '126px',
                      border: isSelected ? '4px solid #ffd43b' : '4px solid #6f4e37',
                      borderRadius: '22px',
                      background: 'linear-gradient(180deg, #8d6e4f, #6f4e37)',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 5px rgba(255, 212, 59, 0.35), 0 10px 0 #4b3424' : '0 8px 0 #4b3424, 0 14px 18px rgba(0,0,0,0.16)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 950
                    }}
                  >
                    <span style={{ fontSize: '2.4rem' }}>{getPlotEmoji(plot)}</span>
                    <span>{getPlotLabel(plot)}</span>
                    <span style={{ fontSize: '0.76rem', opacity: 0.86 }}>성장도 {progress}%</span>
                    <div style={{ width: '72%', height: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: progress + '%', height: '100%', background: '#69db7c' }} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{
              position: 'absolute',
              left: '50%',
              bottom: '1rem',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '1.4rem',
              zIndex: 3
            }}>
              <div style={{ width: '120px', height: '160px', position: 'relative', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.25))' }}>
                {myPlayerData.avatarSnapshotUrl ? (
                  <img src={myPlayerData.avatarSnapshotUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  avatarUrls.map((src, index) => (
                    <img key={index} src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: index }} />
                  ))
                )}
              </div>

              <div style={{ position: 'relative', width: '110px', height: '110px', filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.22))' }}>
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '-42px',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  background: 'white',
                  color: '#2b8a3e',
                  border: '3px solid #2b8a3e',
                  borderRadius: '999px',
                  padding: '0.45rem 0.8rem',
                  fontWeight: 950,
                  fontSize: '0.82rem',
                  boxShadow: '0 5px 14px rgba(0,0,0,0.14)'
                }}>
                  오늘 밭 상태 좋아!
                </div>

                {myPartnerPet ? (
                  <img
                    src={petImageMap[(myPartnerPet.appearanceId || '') + '_idle'] || baseAvatar}
                    alt={myPartnerPet.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ fontSize: '4rem', textAlign: 'center' }}>🥚</div>
                )}
              </div>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.8rem', color: '#2b8a3e' }}>🎒 재료가방</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                <div style={materialStyle()}>💧 물 <strong>{garden.materials.water}</strong></div>
                <div style={materialStyle()}>☀️ 햇빛 <strong>{garden.materials.sunlight}</strong></div>
                <div style={materialStyle()}>🌿 비료 <strong>{garden.materials.fertilizer}</strong></div>
                <div style={materialStyle()}>🌰 씨앗 <strong>{garden.materials.seedBasic}</strong></div>
              </div>
              <button onClick={giveTestMaterials} style={{ ...secondaryButtonStyle, width: '100%', marginTop: '0.8rem' }}>
                테스트 재료 받기
              </button>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.8rem', color: '#2b8a3e' }}>🌰 심을 작물</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {Object.values(CROPS).map(crop => (
                  <button
                    key={crop.id}
                    onClick={() => setSelectedCropId(crop.id)}
                    style={{
                      ...secondaryButtonStyle,
                      background: selectedCropId === crop.id ? '#d3f9d8' : 'white'
                    }}
                  >
                    {crop.emoji} {crop.name}
                  </button>
                ))}
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.8rem', color: '#2b8a3e' }}>🧺 선택한 밭</h2>
              {selectedPlot ? (
                <>
                  <p style={{ margin: '0 0 0.8rem', color: '#495057', fontWeight: 800, lineHeight: 1.5 }}>
                    {getPlotEmoji(selectedPlot)} {getPlotLabel(selectedPlot)}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <button onClick={() => plantCrop(selectedPlot.id)} style={buttonStyle}>심기</button>
                    <button onClick={() => waterPlot(selectedPlot.id)} style={buttonStyle}>물 주기</button>
                    <button onClick={() => fertilizePlot(selectedPlot.id)} style={buttonStyle}>비료</button>
                    <button onClick={() => harvestPlot(selectedPlot.id)} style={buttonStyle}>수확</button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: '#868e96', fontWeight: 800 }}>밭을 누르면 행동 버튼이 나와요.</p>
              )}
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.8rem', color: '#2b8a3e' }}>📦 수확물</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.values(CROPS).map(crop => (
                  <div key={crop.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: '#f8f9fa', borderRadius: '14px', padding: '0.55rem 0.7rem', fontWeight: 900 }}>
                    <span>{crop.emoji} {crop.name} × {garden.inventory[crop.id] || 0}</span>
                    <button onClick={() => sellCrop(crop.id)} style={{ ...secondaryButtonStyle, padding: '0.45rem 0.7rem' }}>
                      {crop.sellValue}P 판매
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', fontWeight: 950, color: '#f76707' }}>
                텃밭 지갑: {garden.walletPoints.toLocaleString()}P
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', fontWeight: 800, color: '#868e96' }}>
                아직 실제 포인트에는 반영하지 않는 테스트 지갑입니다.
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.8rem', color: '#2b8a3e' }}>📜 텃밭 기록</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {garden.logs.map(log => (
                  <div key={log.id} style={{ fontSize: '0.86rem', color: '#495057', fontWeight: 800, background: '#f8f9fa', borderRadius: '12px', padding: '0.55rem 0.7rem' }}>
                    {log.text}
                  </div>
                ))}
              </div>
              <button onClick={resetGarden} style={{ ...secondaryButtonStyle, width: '100%', marginTop: '0.8rem', color: '#fa5252' }}>
                테스트 데이터 초기화
              </button>
            </section>
          </aside>
        </main>

        <section style={{ ...cardStyle, background: '#fff9db', borderColor: '#ffe066' }}>
          <strong style={{ color: '#e67700' }}>[마일스톤 3-2]</strong>
          <span style={{ color: '#e67700', fontWeight: 800 }}> 텃밭 데이터는 브라우저에 임시 저장되고, [텃밭 저장]을 누르면 Firestore의 내 player 문서에 저장됩니다.</span>
        </section>
      </div>
    </div>
  );
}

function materialStyle() {
  return {
    background: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '16px',
    padding: '0.8rem',
    fontWeight: 950,
    color: '#495057',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };
}

export default GardenPage;
