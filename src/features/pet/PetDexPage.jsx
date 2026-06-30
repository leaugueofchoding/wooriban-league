// src/features/pet/PetDexPage.jsx

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import { PET_DATA, SKILLS } from './petData';
import { petImageMap } from '../../utils/petImageMap';

const elementColorMap = {
  '불': '#fa5252',
  '바람': '#15aabf',
  '풀': '#40c057',
  '물': '#228be6',
  '번개': '#f08c00',
  '얼음': '#4dabf7',
  '흙': '#7950f2',
};

const elementIconMap = {
  '불': '🔥',
  '바람': '🌪️',
  '풀': '🌿',
  '물': '💧',
  '번개': '⚡',
  '얼음': '❄️',
  '흙': '🪨',
};

const stageLabelMap = {
  1: '기본',
  2: '1차',
  3: '최종',
};

const reactionAffinityGuide = [
  { element: '물', strong: '불', weak: '얼음' },
  { element: '불', strong: '풀', weak: '물' },
  { element: '풀', strong: '번개', weak: '불' },
  { element: '번개', strong: '바람', weak: '풀' },
  { element: '바람', strong: '얼음', weak: '번개' },
  { element: '얼음', strong: '물', weak: '바람' },
];

const affinityChainText = '💧 물 > 🔥 불 > 🌿 풀 > ⚡ 번개 > 🌪️ 바람 > ❄️ 얼음 > 💧 물';

function getStageFromAppearanceId(appearanceId) {
  const match = String(appearanceId || '').match(/_lv(\d)/);
  return match ? Number(match[1]) : 1;
}

function normalizeSkill(skillOrId) {
  if (!skillOrId) return null;

  if (typeof skillOrId === 'string') {
    return SKILLS[skillOrId.toUpperCase()]
      || Object.values(SKILLS).find(skill => skill.id === skillOrId)
      || null;
  }

  return skillOrId;
}

function getStageSkills(stage) {
  return (stage.skills || []).map(normalizeSkill).filter(Boolean);
}

function getStageList(speciesKey, data) {
  const lv10 = data.evolution?.lv10;
  const lv20 = data.evolution?.lv20;

  return [
    {
      stage: 1,
      appearanceId: `${speciesKey}_lv1`,
      name: data.name,
      condition: '처음 만나는 모습',
      description: data.description,
      skills: [data.skill],
    },
    {
      stage: 2,
      appearanceId: lv10?.appearanceId,
      name: lv10?.name || '1차 진화',
      condition: 'Lv.10 + 진화의 돌',
      description: lv10?.description || '',
      skills: [lv10?.newSkill],
    },
    {
      stage: 3,
      appearanceId: lv20?.appearanceId,
      name: lv20?.name || '최종 진화',
      condition: 'Lv.20 + 진화의 돌',
      description: lv20?.description || '',
      skills: lv20?.newSkills || [lv20?.newSkill],
    },
  ].filter(stage => stage.appearanceId);
}

function buildHighestStageBySpecies(pets = []) {
  return pets.reduce((acc, pet) => {
    if (!pet?.species) return acc;

    const stage = getStageFromAppearanceId(pet.appearanceId);
    acc[pet.species] = Math.max(acc[pet.species] || 0, stage);

    return acc;
  }, {});
}

function buildClassDexStats(players = []) {
  const classHighestStageBySpecies = {};
  const discoverersBySpeciesStage = {};

  players.forEach(player => {
    const perPlayerHighest = buildHighestStageBySpecies(player.pets || []);

    Object.entries(perPlayerHighest).forEach(([species, highestStage]) => {
      classHighestStageBySpecies[species] = Math.max(
        classHighestStageBySpecies[species] || 0,
        highestStage
      );

      if (!discoverersBySpeciesStage[species]) discoverersBySpeciesStage[species] = {};

      for (let stage = 1; stage <= highestStage; stage += 1) {
        if (!discoverersBySpeciesStage[species][stage]) discoverersBySpeciesStage[species][stage] = [];
        if (player.name && !discoverersBySpeciesStage[species][stage].includes(player.name)) {
          discoverersBySpeciesStage[species][stage].push(player.name);
        }
      }
    });
  });

  return { classHighestStageBySpecies, discoverersBySpeciesStage };
}

function getAffinitySummary(element) {
  const guide = reactionAffinityGuide.find(item => item.element === element);
  if (!guide) return null;

  return {
    strong: `${elementIconMap[guide.element] || ''} ${guide.element} > ${elementIconMap[guide.strong] || ''} ${guide.strong}`,
    weak: `${elementIconMap[guide.weak] || ''} ${guide.weak} > ${elementIconMap[guide.element] || ''} ${guide.element}`,
  };
}

function buildDexEntries(speciesEntries) {
  let dexNo = 151;

  return speciesEntries.flatMap(([speciesKey, data]) => (
    getStageList(speciesKey, data).map(stage => ({
      dexNo: dexNo++,
      id: `${speciesKey}-${stage.stage}`,
      speciesKey,
      speciesData: data,
      ...stage,
    }))
  ));
}

function PetDexPage() {
  const navigate = useNavigate();
  const { players } = useLeagueStore();
  const [selectedDexId, setSelectedDexId] = useState(null);

  const myPlayerData = useMemo(
    () => players.find(player => player.authUid === auth.currentUser?.uid),
    [players]
  );

  const myHighestStageBySpecies = useMemo(
    () => buildHighestStageBySpecies(myPlayerData?.pets || []),
    [myPlayerData]
  );

  const { classHighestStageBySpecies, discoverersBySpeciesStage } = useMemo(
    () => buildClassDexStats(players),
    [players]
  );

  const speciesEntries = Object.entries(PET_DATA);
  const dexEntries = useMemo(() => buildDexEntries(speciesEntries), [speciesEntries]);

  const totalStageCount = dexEntries.length;
  const myUnlockedStageCount = dexEntries.filter(entry => (
    (myHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage
  )).length;
  const classUnlockedStageCount = dexEntries.filter(entry => (
    (classHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage
  )).length;

  const fallbackSelectedEntry = dexEntries.find(entry => (
    (myHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage
  )) || dexEntries.find(entry => (
    (classHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage
  )) || dexEntries[0];

  const selectedEntry = dexEntries.find(entry => entry.id === selectedDexId) || fallbackSelectedEntry;
  const selectedSpeciesData = selectedEntry?.speciesData || {};
  const selectedElement = selectedSpeciesData.element;
  const selectedElementColor = elementColorMap[selectedElement] || '#495057';
  const selectedImageSrc = selectedEntry ? petImageMap[`${selectedEntry.appearanceId}_idle`] : null;
  const selectedClassUnlocked = selectedEntry
    ? (classHighestStageBySpecies[selectedEntry.speciesKey] || 0) >= selectedEntry.stage
    : false;
  const selectedMineUnlocked = selectedEntry
    ? (myHighestStageBySpecies[selectedEntry.speciesKey] || 0) >= selectedEntry.stage
    : false;
  const selectedSkills = selectedEntry && selectedClassUnlocked ? getStageSkills(selectedEntry) : [];
  const selectedAffinity = getAffinitySummary(selectedElement);
  const discoverers = selectedEntry
    ? (discoverersBySpeciesStage[selectedEntry.speciesKey]?.[selectedEntry.stage] || [])
    : [];

  return (
    <div className="dex-page">
      <style>{`
        .dex-page {
          min-height: 100vh;
          padding: 1.2rem 0.8rem 4rem;
          font-family: 'Pretendard', sans-serif;
          background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
          color: #1f2937;
        }

        .dex-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .dex-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .back-button {
          border: none;
          background: #e7f5ff;
          color: #1971c2;
          font-weight: 900;
          border-radius: 999px;
          padding: 0.5rem 0.9rem;
          cursor: pointer;
          margin-bottom: 0.55rem;
        }

        .dex-title {
          margin: 0;
          font-size: 2rem;
          font-weight: 1000;
        }

        .dex-subtitle {
          margin: 0.35rem 0 0;
          color: #667085;
          font-weight: 800;
          line-height: 1.45;
        }

        .progress-card {
          background: white;
          border-radius: 18px;
          padding: 0.85rem 1.1rem;
          box-shadow: 0 10px 26px rgba(0,0,0,0.06);
          border: 1px solid #eef2f7;
          min-width: 220px;
        }

        .progress-label {
          font-size: 0.78rem;
          color: #868e96;
          font-weight: 900;
          margin-bottom: 0.25rem;
        }

        .progress-count {
          font-size: 1.28rem;
          font-weight: 1000;
        }

        .pokedex-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
          gap: 1rem;
          align-items: start;
        }

        .pokedex-left {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          border: 4px solid #2f6fdb;
          border-radius: 18px;
          overflow: hidden;
          background: #f8f9fa;
          box-shadow: 0 14px 36px rgba(0,0,0,0.10);
          min-height: 560px;
        }

        .pokedex-rail {
          background: linear-gradient(180deg, #ff4d5e 0%, #e03131 100%);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.55rem;
          padding: 0.55rem 0.25rem;
          border-right: 4px solid #143d8f;
        }

        .rail-play {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          background: #111827;
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          color: #51cf66;
          box-shadow: inset 0 0 0 2px white;
        }

        .rail-text {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 0.72rem;
          font-weight: 1000;
          letter-spacing: 0.08em;
          margin-top: 0.3rem;
        }

        .pokedex-main {
          display: flex;
          flex-direction: column;
          min-width: 0;
          background:
            linear-gradient(90deg, rgba(47,111,219,0.10) 1px, transparent 1px),
            linear-gradient(180deg, rgba(47,111,219,0.08) 1px, transparent 1px),
            #ffffff;
          background-size: 26px 26px;
        }

        .dex-grid-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.7rem;
          padding: 0.7rem 0.8rem;
          background: #f1f3f5;
          border-bottom: 3px solid #2f6fdb;
          font-weight: 1000;
          color: #495057;
          flex-wrap: wrap;
        }

        .dex-grid-toolbar small {
          color: #868e96;
          font-weight: 900;
        }

        .dex-grid-scroll {
          flex: 1;
          max-height: 520px;
          overflow-y: auto;
          padding: 0.8rem;
        }

        .dex-grid-scroll::-webkit-scrollbar {
          width: 13px;
        }

        .dex-grid-scroll::-webkit-scrollbar-track {
          background: #dbe4ff;
          border-left: 2px solid #2f6fdb;
        }

        .dex-grid-scroll::-webkit-scrollbar-thumb {
          background: #748ffc;
          border: 2px solid #2f6fdb;
          border-radius: 999px;
        }

        .dex-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
          gap: 0.42rem;
        }

        .dex-cell {
          position: relative;
          border: 2px solid #ced4da;
          border-radius: 10px;
          background: #ffffff;
          min-height: 86px;
          cursor: pointer;
          padding: 0.3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
        }

        .dex-cell:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(0,0,0,0.10);
        }

        .dex-cell.selected {
          border: 4px solid #ff6b6b;
          background: #fff5f5;
        }

        .dex-cell.owned {
          background: #ebfbee;
          border-color: #51cf66;
        }

        .dex-cell.class-found:not(.owned) {
          background: #e7f5ff;
          border-color: #74c0fc;
        }

        .dex-no {
          position: absolute;
          top: 0.18rem;
          left: 0.25rem;
          font-size: 0.64rem;
          color: #868e96;
          font-weight: 1000;
        }

        .dex-stage {
          position: absolute;
          top: 0.18rem;
          right: 0.25rem;
          font-size: 0.6rem;
          color: #495057;
          font-weight: 1000;
        }

        .dex-sprite {
          width: 54px;
          height: 54px;
          object-fit: contain;
          margin-top: 0.3rem;
        }

        .dex-sprite.silhouette {
          filter: brightness(0) saturate(0) opacity(0.42) drop-shadow(0 6px 7px rgba(0,0,0,0.22));
        }

        .dex-mini-name {
          max-width: 72px;
          margin-top: 0.1rem;
          font-size: 0.64rem;
          font-weight: 1000;
          color: #343a40;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bottom-menu {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: #edf2ff;
          border-top: 3px solid #2f6fdb;
        }

        .bottom-menu span {
          padding: 0.55rem 0.25rem;
          text-align: center;
          color: #1c3d8f;
          font-size: 0.76rem;
          font-weight: 1000;
          border-right: 1px solid #bac8ff;
        }

        .bottom-menu span:last-child {
          border-right: none;
        }

        .detail-card {
          background: white;
          border-radius: 24px;
          border: 1px solid #eef2f7;
          box-shadow: 0 14px 36px rgba(0,0,0,0.08);
          padding: 1.1rem;
          position: sticky;
          top: 1rem;
        }

        .detail-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 0.85rem;
        }

        .detail-no {
          background: #343a40;
          color: white;
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          font-weight: 1000;
          font-size: 0.82rem;
        }

        .status-badge {
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          font-weight: 1000;
          font-size: 0.78rem;
        }

        .status-badge.owned {
          background: #d3f9d8;
          color: #2b8a3e;
        }

        .status-badge.class-found {
          background: #d0ebff;
          color: #1971c2;
        }

        .status-badge.unknown {
          background: #f1f3f5;
          color: #868e96;
        }

        .detail-image-box {
          height: 210px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background: radial-gradient(circle, #fff 20%, #f1f3f5 72%);
          margin-bottom: 1rem;
        }

        .detail-image {
          max-width: 170px;
          max-height: 170px;
          object-fit: contain;
          filter: drop-shadow(0 12px 18px rgba(0,0,0,0.16));
        }

        .detail-image.silhouette {
          filter: brightness(0) saturate(0) opacity(0.42) drop-shadow(0 12px 18px rgba(0,0,0,0.22));
        }

        .detail-name {
          margin: 0;
          font-size: 1.55rem;
          font-weight: 1000;
          color: #1f2937;
        }

        .detail-sub {
          margin: 0.35rem 0 0;
          color: #868e96;
          font-weight: 850;
          line-height: 1.5;
        }

        .pill-row {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin: 0.75rem 0;
        }

        .pill {
          border-radius: 999px;
          padding: 0.28rem 0.65rem;
          color: white;
          font-size: 0.78rem;
          font-weight: 1000;
        }

        .info-section {
          margin-top: 0.8rem;
          padding: 0.85rem;
          border-radius: 16px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
        }

        .info-section h3 {
          margin: 0 0 0.45rem;
          font-size: 0.96rem;
          font-weight: 1000;
          color: #343a40;
        }

        .info-section p {
          margin: 0;
          color: #495057;
          line-height: 1.55;
          font-weight: 750;
          font-size: 0.88rem;
        }

        .skill-list {
          display: grid;
          gap: 0.45rem;
        }

        .skill-item {
          background: white;
          border-radius: 12px;
          padding: 0.65rem;
          border: 1px solid #e9ecef;
        }

        .skill-name {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          font-weight: 1000;
          color: #343a40;
          margin-bottom: 0.25rem;
        }

        .skill-desc {
          color: #667085;
          font-size: 0.78rem;
          font-weight: 750;
          line-height: 1.45;
        }

        .reaction-note {
          margin-top: 1rem;
          background: linear-gradient(180deg, #fff9db 0%, #fff4e6 100%);
          border: 2px solid #ffe066;
          border-radius: 20px;
          padding: 0.95rem;
        }

        .reaction-note h2 {
          margin: 0 0 0.5rem;
          color: #7c4a03;
          font-size: 1.04rem;
          font-weight: 1000;
        }

        .reaction-note-grid {
          display: grid;
          gap: 0.5rem;
        }

        .reaction-line {
          background: rgba(255,255,255,0.78);
          border-radius: 12px;
          padding: 0.6rem;
          color: #343a40;
          font-size: 0.83rem;
          font-weight: 850;
          line-height: 1.5;
        }

        @media (max-width: 980px) {
          .pokedex-layout {
            grid-template-columns: 1fr;
          }

          .detail-card {
            position: static;
          }

          .pokedex-left {
            min-height: auto;
          }

          .dex-grid-scroll {
            max-height: 430px;
          }
        }

        @media (max-width: 560px) {
          .dex-page {
            padding: 0.7rem 0.45rem 3.5rem;
          }

          .dex-title {
            font-size: 1.55rem;
          }

          .pokedex-left {
            grid-template-columns: 34px minmax(0, 1fr);
            border-width: 3px;
          }

          .dex-grid {
            grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
            gap: 0.35rem;
          }

          .dex-cell {
            min-height: 76px;
            border-radius: 9px;
          }

          .dex-sprite {
            width: 46px;
            height: 46px;
          }

          .bottom-menu span {
            font-size: 0.66rem;
            padding: 0.46rem 0.12rem;
          }

          .detail-image-box {
            height: 170px;
          }

          .detail-image {
            max-width: 135px;
            max-height: 135px;
          }
        }
      `}</style>

      <div className="dex-shell">
        <header className="dex-header">
          <div>
            <button className="back-button" onClick={() => navigate('/pet')}>
              ← 펫 페이지
            </button>
            <h1 className="dex-title">📖 펫 도감</h1>
            <p className="dex-subtitle">
              발견한 펫은 채색, 아직 발견하지 못한 펫은 실루엣으로 표시됩니다.
            </p>
          </div>

          <div className="progress-card">
            <div className="progress-label">내 수집 현황</div>
            <div className="progress-count">{myUnlockedStageCount} / {totalStageCount} 단계</div>
            <div className="progress-label" style={{ marginTop: '0.35rem' }}>
              우리 반 발견 {classUnlockedStageCount} / {totalStageCount}
            </div>
          </div>
        </header>

        <main className="pokedex-layout">
          <section className="pokedex-left" aria-label="펫 도감 목록">
            <aside className="pokedex-rail">
              <div className="rail-play">▶</div>
              <div className="rail-text">START</div>
            </aside>

            <div className="pokedex-main">
              <div className="dex-grid-toolbar">
                <span>도감 목록</span>
                <small>발견: 채색 · 미발견: 실루엣 · 보유: 초록 테두리</small>
              </div>

              <div className="dex-grid-scroll">
                <div className="dex-grid">
                  {dexEntries.map(entry => {
                    const classUnlocked = (classHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage;
                    const mineUnlocked = (myHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage;
                    const isSelected = selectedEntry?.id === entry.id;
                    const imageSrc = petImageMap[`${entry.appearanceId}_idle`];
                    const displayName = classUnlocked ? entry.name : '???';

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={[
                          'dex-cell',
                          isSelected ? 'selected' : '',
                          mineUnlocked ? 'owned' : '',
                          classUnlocked ? 'class-found' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setSelectedDexId(entry.id)}
                      >
                        <span className="dex-no">No.{entry.dexNo}</span>
                        <span className="dex-stage">{stageLabelMap[entry.stage]}</span>
                        {imageSrc ? (
                          <img
                            className={`dex-sprite ${classUnlocked ? '' : 'silhouette'}`}
                            src={imageSrc}
                            alt={displayName}
                          />
                        ) : (
                          <span style={{ fontWeight: 1000, color: '#adb5bd' }}>?</span>
                        )}
                        <span className="dex-mini-name">{displayName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bottom-menu">
                <span>🔍 검색</span>
                <span>🔊 울음소리</span>
                <span>📘 자세히</span>
                <span>🎒 닫는다</span>
              </div>
            </div>
          </section>

          <aside className="detail-card" aria-label="선택한 펫 상세 정보">
            {selectedEntry ? (
              <>
                <div className="detail-top">
                  <span className="detail-no">No.{selectedEntry.dexNo}</span>
                  <span
                    className={[
                      'status-badge',
                      selectedMineUnlocked ? 'owned' : selectedClassUnlocked ? 'class-found' : 'unknown',
                    ].join(' ')}
                  >
                    {selectedMineUnlocked ? '내 도감 등록' : selectedClassUnlocked ? '우리 반 발견' : '미발견'}
                  </span>
                </div>

                <div className="detail-image-box">
                  {selectedImageSrc ? (
                    <img
                      className={`detail-image ${selectedClassUnlocked ? '' : 'silhouette'}`}
                      src={selectedImageSrc}
                      alt={selectedClassUnlocked ? selectedEntry.name : '미발견 펫'}
                    />
                  ) : (
                    <div style={{ color: '#adb5bd', fontWeight: 1000 }}>이미지 없음</div>
                  )}
                </div>

                <h2 className="detail-name">
                  {selectedClassUnlocked ? selectedEntry.name : '???'}
                </h2>
                <p className="detail-sub">
                  {selectedClassUnlocked
                    ? selectedEntry.description
                    : '아직 우리 반에서 발견하지 못한 모습입니다. 누군가 이 단계까지 성장시키면 정보가 공개됩니다.'}
                </p>

                <div className="pill-row">
                  <span className="pill" style={{ background: selectedElementColor }}>
                    {elementIconMap[selectedElement] || ''} {selectedElement || '속성 없음'}
                  </span>
                  <span className="pill" style={{ background: '#495057' }}>
                    {stageLabelMap[selectedEntry.stage]} 단계
                  </span>
                  <span className="pill" style={{ background: '#845ef7' }}>
                    조건: {selectedEntry.condition}
                  </span>
                </div>

                <section className="info-section">
                  <h3>전투 역할</h3>
                  <p>{selectedSpeciesData.battleRoleLabel || '역할 정보 없음'}</p>
                  {selectedSpeciesData.battleRoleNote && (
                    <p style={{ marginTop: '0.4rem', color: '#667085' }}>{selectedSpeciesData.battleRoleNote}</p>
                  )}
                </section>

                <section className="info-section">
                  <h3>스킬</h3>
                  {selectedClassUnlocked && selectedSkills.length > 0 ? (
                    <div className="skill-list">
                      {selectedSkills.map(skill => (
                        <div className="skill-item" key={skill.id || skill.name}>
                          <div className="skill-name">
                            <span>{skill.name}</span>
                            <span>{elementIconMap[skill.element] || ''} {skill.element || '무'}</span>
                          </div>
                          <div className="skill-desc">
                            위력 {skill.basePower ?? '-'} · SP {skill.cost ?? 0}<br />
                            {skill.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>발견하면 대표 스킬이 공개됩니다.</p>
                  )}
                </section>

                <section className="info-section">
                  <h3>상성</h3>
                  {selectedAffinity ? (
                    <>
                      <p>유리: {selectedAffinity.strong}</p>
                      <p style={{ marginTop: '0.25rem' }}>불리: {selectedAffinity.weak}</p>
                    </>
                  ) : (
                    <p>상성 정보가 없습니다.</p>
                  )}
                </section>

                {discoverers.length > 0 && (
                  <section className="info-section">
                    <h3>발견한 친구</h3>
                    <p>{discoverers.slice(0, 8).join(', ')}{discoverers.length > 8 ? ` 외 ${discoverers.length - 8}명` : ''}</p>
                  </section>
                )}

                <section className="reaction-note">
                  <h2>🧪 원소반응·상성 노트</h2>
                  <div className="reaction-note-grid">
                    <div className="reaction-line">
                      <strong>상성 순환</strong><br />
                      {affinityChainText}
                    </div>
                    <div className="reaction-line">
                      <strong>원소반응</strong><br />
                      속성 스킬은 흔적을 남기고, 다른 속성 스킬로 공격하면 원소반응이 발생합니다.
                    </div>
                    <div className="reaction-line">
                      <strong>상성 판정</strong><br />
                      마지막 공격 스킬 속성 기준입니다. 원소반응 추가 피해만 바뀌고 CC는 그대로입니다.
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <p>도감 정보를 불러오는 중입니다.</p>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}

export default PetDexPage;
