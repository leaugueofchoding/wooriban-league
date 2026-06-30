// src/features/pet/PetDexPage.jsx

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '../../store/leagueStore';
import { auth } from '../../api/firebase';
import { PET_DATA, SKILLS } from './petData';
import { petImageMap } from '../../utils/petImageMap';
import SkillPreview from './SkillPreview';

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

const stageLabelMap = { 1: '기본', 2: '1차', 3: '최종' };

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
      classHighestStageBySpecies[species] = Math.max(classHighestStageBySpecies[species] || 0, highestStage);
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
  let dexNo = 1;
  return speciesEntries.flatMap(([speciesKey, data]) => (
    getStageList(speciesKey, data).map(stage => {
      const no = dexNo;
      dexNo += 1;
      return {
        dexNo: no,
        dexNoLabel: String(no).padStart(3, '0'),
        id: `${speciesKey}-${stage.stage}`,
        speciesKey,
        speciesData: data,
        ...stage,
      };
    })
  ));
}

function normalizeSearchText(text) {
  return String(text || '').trim().toLowerCase();
}

function PetDexPage() {
  const navigate = useNavigate();
  const { players } = useLeagueStore();

  const [selectedDexId, setSelectedDexId] = useState(null);
  const [isCardOpen, setIsCardOpen] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showAffinityNote, setShowAffinityNote] = useState(false);
  const [showMoreDetail, setShowMoreDetail] = useState(false);
  const [skillPreviewState, setSkillPreviewState] = useState({ skill: null, replayKey: 0 });

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

  const speciesEntries = useMemo(() => Object.entries(PET_DATA), []);
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
  const selectedBattleImageSrc = selectedEntry
    ? (petImageMap[`${selectedEntry.appearanceId}_battle`] || selectedImageSrc)
    : null;
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

  const visibleDiscoverers = discoverers.slice(0, 8);
  const hiddenDiscovererCount = Math.max(0, discoverers.length - visibleDiscoverers.length);
  const discovererTooltipText = discoverers.join(', ');

  const normalizedSearch = normalizeSearchText(searchText);
  const filteredDexEntries = useMemo(() => {
    if (!normalizedSearch) return dexEntries;
    return dexEntries.filter(entry => {
      const skills = getStageSkills(entry).map(skill => `${skill.name} ${skill.element || ''}`).join(' ');
      const haystack = [
        entry.dexNoLabel,
        entry.name,
        entry.speciesData?.name,
        entry.speciesData?.element,
        stageLabelMap[entry.stage],
        skills,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [dexEntries, normalizedSearch]);

  const targetPreviewImageSrc = useMemo(() => {
    const otherEntry = dexEntries.find(entry => (
      entry.id !== selectedEntry?.id && petImageMap[`${entry.appearanceId}_idle`]
    ));
    return otherEntry ? petImageMap[`${otherEntry.appearanceId}_idle`] : selectedImageSrc;
  }, [dexEntries, selectedEntry?.id, selectedImageSrc]);

  const handleSelectEntry = (entryId) => {
    setSelectedDexId(entryId);
    setIsCardOpen(true);
  };

  const handlePreviewSkill = (skill) => {
    if (!skill) return;
    setSkillPreviewState(prev => ({ skill, replayKey: prev.replayKey + 1 }));
  };

  return (
    <div className="dex-page">
      <style>{`
        .dex-page { min-height: 100vh; padding: 0.85rem 0.65rem 3rem; font-family: 'Pretendard', sans-serif; background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%); color: #1f2937; }
        .dex-shell { max-width: 1040px; margin: 0 auto; }
        .dex-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.8rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .back-button { border: none; background: #e7f5ff; color: #1971c2; font-weight: 900; border-radius: 999px; padding: 0.42rem 0.8rem; cursor: pointer; margin-bottom: 0.35rem; }
        .dex-title { margin: 0; font-size: 1.65rem; font-weight: 1000; }
        .dex-subtitle { margin: 0.25rem 0 0; color: #667085; font-size: 0.86rem; font-weight: 800; line-height: 1.35; }
        .progress-card { background: white; border-radius: 16px; padding: 0.65rem 0.9rem; box-shadow: 0 8px 22px rgba(0,0,0,0.06); border: 1px solid #eef2f7; min-width: 210px; }
        .progress-label { font-size: 0.74rem; color: #868e96; font-weight: 900; margin-bottom: 0.18rem; }
        .progress-count { font-size: 1.12rem; font-weight: 1000; }

        .pokedex-layout { display: grid; grid-template-columns: minmax(500px, 560px) minmax(300px, 360px); gap: 0.85rem; align-items: start; justify-content: center; }
        .pokedex-layout.card-hidden { grid-template-columns: 1fr; }
        .pokedex-left, .detail-card { height: clamp(500px, calc(100dvh - 128px), 620px); }
        .pokedex-left { display: grid; grid-template-columns: 38px minmax(0, 1fr); border: 4px solid #2f6fdb; border-radius: 18px; overflow: hidden; background: #f8f9fa; box-shadow: 0 14px 36px rgba(0,0,0,0.10); }
        .pokedex-rail { background: linear-gradient(180deg, #ff4d5e 0%, #e03131 100%); color: white; display: flex; flex-direction: column; align-items: center; gap: 0.55rem; padding: 0.48rem 0.2rem; border-right: 4px solid #143d8f; }
        .rail-play { width: 20px; height: 20px; border-radius: 5px; background: #111827; display: grid; place-items: center; font-size: 0.64rem; color: #51cf66; box-shadow: inset 0 0 0 2px white; }
        .rail-text { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 0.68rem; font-weight: 1000; letter-spacing: 0.08em; margin-top: 0.3rem; }
        .pokedex-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: linear-gradient(90deg, rgba(47,111,219,0.10) 1px, transparent 1px), linear-gradient(180deg, rgba(47,111,219,0.08) 1px, transparent 1px), #ffffff; background-size: 24px 24px; }
        .dex-grid-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 0.55rem; padding: 0.52rem 0.65rem; background: #f1f3f5; border-bottom: 3px solid #2f6fdb; font-weight: 1000; color: #495057; flex-wrap: wrap; }
        .dex-grid-toolbar small { color: #868e96; font-weight: 900; }
        .search-panel { display: ${showSearch ? 'block' : 'none'}; padding: 0.5rem 0.65rem; background: #edf2ff; border-bottom: 2px solid #bac8ff; }
        .search-panel input { width: 100%; box-sizing: border-box; border: 2px solid #748ffc; border-radius: 12px; padding: 0.55rem 0.75rem; font-size: 0.92rem; font-weight: 850; outline: none; }
        .dex-grid-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0.65rem; }
        .dex-grid-scroll::-webkit-scrollbar, .detail-card::-webkit-scrollbar { width: 11px; }
        .dex-grid-scroll::-webkit-scrollbar-track, .detail-card::-webkit-scrollbar-track { background: #dbe4ff; border-left: 2px solid #2f6fdb; }
        .dex-grid-scroll::-webkit-scrollbar-thumb, .detail-card::-webkit-scrollbar-thumb { background: #748ffc; border: 2px solid #2f6fdb; border-radius: 999px; }
        .dex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 0.42rem; }

        .dex-cell { position: relative; border: 2px solid #ced4da; border-radius: 10px; background: #f1f3f5; min-height: 86px; cursor: pointer; padding: 0.3rem; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease; }
        .dex-cell:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,0.10); }
        .dex-cell.selected { border: 4px solid #ff6b6b; background: #fff5f5; }
        .dex-cell.owned { background: #d0ebff; border-color: #228be6; }
        .dex-cell.class-found:not(.owned) { background: #d3f9d8; border-color: #51cf66; }
        .dex-cell.unknown:not(.selected) { background: #f1f3f5; border-color: #ced4da; }
        .dex-no { position: absolute; top: 0.12rem; left: 0.2rem; font-size: 0.57rem; color: #868e96; font-weight: 1000; }
        .dex-stage { position: absolute; top: 0.12rem; right: 0.2rem; font-size: 0.55rem; color: #495057; font-weight: 1000; }
        .dex-sprite { width: 54px; height: 54px; object-fit: contain; margin-top: 0.3rem; }
        .dex-sprite.silhouette { filter: brightness(0) saturate(0) opacity(0.42) drop-shadow(0 6px 7px rgba(0,0,0,0.22)); }
        .dex-mini-name { max-width: 72px; margin-top: 0.1rem; font-size: 0.64rem; font-weight: 1000; color: #343a40; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .no-result { padding: 2rem; text-align: center; color: #868e96; font-weight: 950; }

        .bottom-menu { display: grid; grid-template-columns: repeat(4, 1fr); background: #edf2ff; border-top: 3px solid #2f6fdb; }
        .bottom-menu button { padding: 0.48rem 0.2rem; text-align: center; color: #1c3d8f; font-size: 0.72rem; font-weight: 1000; border: none; border-right: 1px solid #bac8ff; background: transparent; cursor: pointer; }
        .bottom-menu button:last-child { border-right: none; }
        .bottom-menu button.active { background: #d0ebff; color: #0b7285; }

        .detail-card { background: white; border-radius: 22px; border: 1px solid #eef2f7; box-shadow: 0 14px 36px rgba(0,0,0,0.08); padding: 0.9rem; position: sticky; top: 0.7rem; overflow-y: auto; box-sizing: border-box; }
        .detail-top { display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; margin-bottom: 0.65rem; }
        .detail-no { background: #343a40; color: white; border-radius: 999px; padding: 0.28rem 0.62rem; font-weight: 1000; font-size: 0.78rem; }
        .status-badge { border-radius: 999px; padding: 0.28rem 0.62rem; font-weight: 1000; font-size: 0.74rem; }
        .status-badge.owned { background: #d0ebff; color: #1971c2; }
        .status-badge.class-found { background: #d3f9d8; color: #2b8a3e; }
        .status-badge.unknown { background: #f1f3f5; color: #868e96; }
        .detail-compact-head { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 0.7rem; align-items: center; }
        .detail-image-box { height: 108px; display: grid; place-items: center; border-radius: 16px; background: radial-gradient(circle, #fff 20%, #f1f3f5 72%); }
        .detail-image { max-width: 92px; max-height: 92px; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.16)); }
        .detail-image.silhouette { filter: brightness(0) saturate(0) opacity(0.42) drop-shadow(0 10px 14px rgba(0,0,0,0.22)); }
        .detail-name { margin: 0; font-size: 1.34rem; font-weight: 1000; color: #1f2937; }
        .detail-sub { margin: 0.34rem 0 0; color: #667085; font-weight: 800; line-height: 1.45; font-size: 0.84rem; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
        .pill-row { display: flex; gap: 0.35rem; flex-wrap: wrap; margin: 0.55rem 0; }
        .pill { border-radius: 999px; padding: 0.22rem 0.55rem; color: white; font-size: 0.72rem; font-weight: 1000; }

        .info-section { margin-top: 0.65rem; padding: 0.7rem; border-radius: 14px; background: #f8f9fa; border: 1px solid #e9ecef; }
        .info-section h3 { margin: 0 0 0.38rem; font-size: 0.9rem; font-weight: 1000; color: #343a40; }
        .info-section p { margin: 0; color: #495057; line-height: 1.45; font-weight: 750; font-size: 0.82rem; }
        .skill-list { display: grid; gap: 0.42rem; }
        .skill-item { background: white; border-radius: 12px; padding: 0.55rem; border: 1px solid #e9ecef; }
        .skill-name { display: flex; justify-content: space-between; gap: 0.5rem; font-weight: 1000; color: #343a40; margin-bottom: 0.2rem; font-size: 0.84rem; }
        .skill-desc { color: #667085; font-size: 0.74rem; font-weight: 750; line-height: 1.38; }
        .skill-preview-button { margin-top: 0.45rem; width: 100%; border: none; border-radius: 10px; padding: 0.38rem 0.55rem; background: #e7f5ff; color: #1971c2; font-size: 0.76rem; font-weight: 950; cursor: pointer; }
        .reaction-note { margin-top: 0.65rem; background: linear-gradient(180deg, #fff9db 0%, #fff4e6 100%); border: 2px solid #ffe066; border-radius: 16px; padding: 0.72rem; }
        .reaction-note h2 { margin: 0 0 0.42rem; color: #7c4a03; font-size: 0.94rem; font-weight: 1000; }
        .reaction-line { background: rgba(255,255,255,0.78); border-radius: 12px; padding: 0.52rem; color: #343a40; font-size: 0.78rem; font-weight: 850; line-height: 1.4; margin-top: 0.4rem; }

        /* M15_V3F_TABLET_TWO_COLUMN_COMPACT */
        @media (min-width: 861px) and (max-width: 1080px) {
          .dex-shell { max-width: 960px; }
          .pokedex-layout {
            grid-template-columns: minmax(470px, 535px) minmax(285px, 335px);
            gap: 0.7rem;
          }
          .dex-grid { grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); }
          .dex-cell { min-height: 80px; }
          .dex-sprite { width: 50px; height: 50px; }
          .detail-card { padding: 0.75rem; }
        }

        .discoverer-section {
          position: relative;
        }

        .discoverer-name-line {
          display: flex;
          flex-wrap: wrap;
          gap: 0.28rem;
          align-items: center;
        }

        .discoverer-chip {
          display: inline-flex;
          align-items: center;
          max-width: 92px;
          padding: 0.18rem 0.42rem;
          border-radius: 999px;
          background: #e7f5ff;
          color: #1971c2;
          font-size: 0.72rem;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .discoverer-more {
          display: inline-flex;
          align-items: center;
          padding: 0.18rem 0.42rem;
          border-radius: 999px;
          background: #fff3bf;
          color: #e67700;
          font-size: 0.72rem;
          font-weight: 1000;
        }

        .discoverer-tooltip {
          display: none;
          position: absolute;
          left: 0;
          right: 0;
          bottom: calc(100% + 8px);
          z-index: 80;
          padding: 0.65rem;
          border-radius: 14px;
          background: rgba(33, 37, 41, 0.97);
          color: white;
          box-shadow: 0 14px 32px rgba(0,0,0,0.26);
          border: 1px solid rgba(255,255,255,0.12);
          max-height: 180px;
          overflow-y: auto;
          font-size: 0.78rem;
          font-weight: 850;
          line-height: 1.45;
        }

        .discoverer-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 28px;
          border: 7px solid transparent;
          border-top-color: rgba(33, 37, 41, 0.97);
        }

        .discoverer-section:hover .discoverer-tooltip,
        .discoverer-section:focus-within .discoverer-tooltip {
          display: block;
        }

        .discoverer-tooltip-title {
          margin-bottom: 0.35rem;
          color: #ffd43b;
          font-size: 0.78rem;
          font-weight: 1000;
        }

        .discoverer-tooltip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }

        .discoverer-tooltip-chip {
          padding: 0.18rem 0.42rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
          color: white;
          white-space: nowrap;
        }

        @media (max-width: 860px) {
          .pokedex-layout { grid-template-columns: 1fr; }
          .detail-card { position: static; height: auto; max-height: 420px; }
          .pokedex-left { height: clamp(470px, calc(100dvh - 128px), 590px); }
        }
        @media (max-width: 560px) {
          .dex-page { padding: 0.55rem 0.36rem 3rem; }
          .dex-title { font-size: 1.35rem; }
          .pokedex-left { grid-template-columns: 32px minmax(0, 1fr); border-width: 3px; }
          .dex-grid { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 0.35rem; }
          .dex-cell { min-height: 76px; border-radius: 9px; }
          .dex-sprite { width: 46px; height: 46px; }
          .detail-compact-head { grid-template-columns: 104px minmax(0, 1fr); }
          .detail-image-box { height: 104px; }
          .detail-image { max-width: 88px; max-height: 88px; }
          .bottom-menu button { font-size: 0.64rem; padding: 0.42rem 0.1rem; }
        }
      `}</style>

      <div className="dex-shell">
        <header className="dex-header">
          <div>
            <button className="back-button" onClick={() => navigate('/pet')}>← 펫 페이지</button>
            <h1 className="dex-title">📖 펫 도감</h1>
            <p className="dex-subtitle">미발견은 실루엣, 미보유 발견 펫은 초록색, 내가 보유한 펫은 파란색입니다.</p>
          </div>

          <div className="progress-card">
            <div className="progress-label">내 수집 현황</div>
            <div className="progress-count">{myUnlockedStageCount} / {totalStageCount} 단계</div>
            <div className="progress-label" style={{ marginTop: '0.35rem' }}>우리 반 발견 {classUnlockedStageCount} / {totalStageCount}</div>
          </div>
        </header>

        <main className={`pokedex-layout ${isCardOpen ? '' : 'card-hidden'}`}>
          <section className="pokedex-left" aria-label="펫 도감 목록">
            <aside className="pokedex-rail">
              <div className="rail-play">▶</div>
              <div className="rail-text">START</div>
            </aside>

            <div className="pokedex-main">
              <div className="dex-grid-toolbar">
                <span>도감 목록</span>
                <small>검색 {filteredDexEntries.length}/{dexEntries.length}</small>
              </div>

              <div className="search-panel">
                <input
                  value={searchText}
                  onChange={event => setSearchText(event.target.value)}
                  placeholder="번호, 이름, 속성, 스킬로 검색"
                  autoFocus={showSearch}
                />
              </div>

              <div className="dex-grid-scroll">
                {filteredDexEntries.length > 0 ? (
                  <div className="dex-grid">
                    {filteredDexEntries.map(entry => {
                      const classUnlocked = (classHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage;
                      const mineUnlocked = (myHighestStageBySpecies[entry.speciesKey] || 0) >= entry.stage;
                      const isSelected = selectedEntry?.id === entry.id && isCardOpen;
                      const imageSrc = petImageMap[`${entry.appearanceId}_idle`];
                      const displayName = classUnlocked ? entry.name : '???';

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={[
                            'dex-cell',
                            isSelected ? 'selected' : '',
                            mineUnlocked ? 'owned' : classUnlocked ? 'class-found' : 'unknown',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            setSelectedDexId(entry.id);
                            setIsCardOpen(true);
                          }}
                        >
                          <span className="dex-no">No.{entry.dexNoLabel}</span>
                          <span className="dex-stage">{stageLabelMap[entry.stage]}</span>
                          {imageSrc ? (
                            <img className={`dex-sprite ${classUnlocked ? '' : 'silhouette'}`} src={imageSrc} alt={displayName} />
                          ) : (
                            <span style={{ fontWeight: 1000, color: '#adb5bd' }}>?</span>
                          )}
                          <span className="dex-mini-name">{displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-result">검색 결과가 없습니다.</div>
                )}
              </div>

              <div className="bottom-menu">
                <button type="button" className={showSearch ? 'active' : ''} onClick={() => setShowSearch(prev => !prev)}>🔍 검색</button>
                <button type="button" className={showAffinityNote ? 'active' : ''} onClick={() => { setIsCardOpen(true); setShowAffinityNote(prev => !prev); }}>🧪 상성노트</button>
                <button type="button" className={showMoreDetail ? 'active' : ''} onClick={() => { setIsCardOpen(true); setShowMoreDetail(prev => !prev); }}>📘 자세히</button>
                <button type="button" onClick={() => setIsCardOpen(false)}>🎒 닫는다</button>
              </div>
            </div>
          </section>

          {isCardOpen && (
            <aside className="detail-card" aria-label="선택한 펫 상세 정보">
              {selectedEntry ? (
                <>
                  <div className="detail-top">
                    <span className="detail-no">No.{selectedEntry.dexNoLabel}</span>
                    <span className={['status-badge', selectedMineUnlocked ? 'owned' : selectedClassUnlocked ? 'class-found' : 'unknown'].join(' ')}>
                      {selectedMineUnlocked ? '보유' : selectedClassUnlocked ? '미보유' : '미발견'}
                    </span>
                  </div>

                  <div className="detail-compact-head">
                    <div className="detail-image-box">
                      {selectedImageSrc ? (
                        <img className={`detail-image ${selectedClassUnlocked ? '' : 'silhouette'}`} src={selectedImageSrc} alt={selectedClassUnlocked ? selectedEntry.name : '미발견 펫'} />
                      ) : (
                        <div style={{ color: '#adb5bd', fontWeight: 1000 }}>이미지 없음</div>
                      )}
                    </div>

                    <div>
                      <h2 className="detail-name">{selectedClassUnlocked ? selectedEntry.name : '???'}</h2>
                      <div className="pill-row">
                        <span className="pill" style={{ background: selectedElementColor }}>{elementIconMap[selectedElement] || ''} {selectedElement || '속성 없음'}</span>
                        <span className="pill" style={{ background: '#495057' }}>{stageLabelMap[selectedEntry.stage]} 단계</span>
                      </div>
                      <p className="detail-sub">
                        {selectedClassUnlocked
                          ? selectedEntry.description
                          : '아직 우리 반에서 발견하지 못한 모습입니다. 누군가 이 단계까지 성장시키면 정보가 공개됩니다.'}
                      </p>
                    </div>
                  </div>

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
                            <button type="button" className="skill-preview-button" onClick={() => handlePreviewSkill(skill)}>▶ 스킬 미리보기</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>발견하면 대표 스킬이 공개됩니다.</p>
                    )}
                  </section>

                  {showMoreDetail && (
                    <>
                      <section className="info-section">
                        <h3>전투 역할</h3>
                        <p>{selectedSpeciesData.battleRoleLabel || '역할 정보 없음'}</p>
                        {selectedSpeciesData.battleRoleNote && <p style={{ marginTop: '0.4rem', color: '#667085' }}>{selectedSpeciesData.battleRoleNote}</p>}
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
                    </>
                  )}

                  {showAffinityNote && (
                    <section className="reaction-note">
                      <h2>🧪 원소반응·상성 노트</h2>
                      <div className="reaction-line"><strong>상성 순환</strong><br />{affinityChainText}</div>
                      <div className="reaction-line"><strong>원소반응</strong><br />속성 스킬은 흔적을 남기고, 다른 속성 스킬로 공격하면 원소반응이 발생합니다.</div>
                      <div className="reaction-line"><strong>상성 판정</strong><br />마지막 공격 스킬 속성 기준입니다. 원소반응 추가 피해만 바뀌고 CC는 그대로입니다.</div>
                    </section>
                  )}

                  {/* M15_DISCOVERERS_ALWAYS_BOTTOM */}
                  {discoverers.length > 0 && (
                    <section
                      className="info-section discoverer-section"
                      tabIndex={0}
                      aria-label={`발견한 사람 전체 명단: ${discovererTooltipText}`}
                    >
                      {/* M15_DISCOVERER_HOVER_TOOLTIP */}
                      <h3>발견한 사람</h3>
                      <div className="discoverer-name-line">
                        {visibleDiscoverers.map(name => (
                          <span className="discoverer-chip" key={name}>{name}</span>
                        ))}
                        {hiddenDiscovererCount > 0 && (
                          <span className="discoverer-more">외 {hiddenDiscovererCount}명</span>
                        )}
                      </div>

                      <div className="discoverer-tooltip" role="tooltip">
                        <div className="discoverer-tooltip-title">
                          전체 발견자 {discoverers.length}명
                        </div>
                        <div className="discoverer-tooltip-list">
                          {discoverers.map(name => (
                            <span className="discoverer-tooltip-chip" key={name}>{name}</span>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <p>도감 정보를 불러오는 중입니다.</p>
              )}
              {skillPreviewState.skill && (
                <SkillPreview
                  skill={skillPreviewState.skill}
                  casterImageSrc={selectedBattleImageSrc}
                  targetImageSrc={targetPreviewImageSrc}
                  replayKey={skillPreviewState.replayKey}
                  onClose={() => setSkillPreviewState({ skill: null, replayKey: 0 })}
                  displayMode="cardOverlay"
                />
              )}
            </aside>
          )}
        </main>
      </div>

    </div>
  );
}

export default PetDexPage;
