// src/features/pet/PetDexPage.jsx

import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  '흙': '#7950f2',
};

const stageLabelMap = {
  1: '1단계',
  2: '1차 진화',
  3: '최종 진화',
};

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

      if (!discoverersBySpeciesStage[species]) {
        discoverersBySpeciesStage[species] = {};
      }

      for (let stage = 1; stage <= highestStage; stage += 1) {
        if (!discoverersBySpeciesStage[species][stage]) {
          discoverersBySpeciesStage[species][stage] = [];
        }

        if (
          player.name
          && !discoverersBySpeciesStage[species][stage].includes(player.name)
        ) {
          discoverersBySpeciesStage[species][stage].push(player.name);
        }
      }
    });
  });

  return { classHighestStageBySpecies, discoverersBySpeciesStage };
}

function shuffleList(list) {
  const result = [...list];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function getRandomBaseTargetAppearanceId(excludeSpeciesKey) {
  const candidates = Object.keys(PET_DATA)
    .filter(speciesKey => speciesKey !== excludeSpeciesKey)
    .map(speciesKey => `${speciesKey}_lv1`)
    .filter(appearanceId => petImageMap[`${appearanceId}_idle`]);

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const fallback = Object.keys(PET_DATA)
    .map(speciesKey => `${speciesKey}_lv1`)
    .find(appearanceId => petImageMap[`${appearanceId}_idle`]);

  return fallback || null;
}

function PetDexPage() {
  const navigate = useNavigate();
  const { players } = useLeagueStore();

  const [discovererTooltip, setDiscovererTooltip] = React.useState(null);
  const [activeSkillPreview, setActiveSkillPreview] = React.useState(null);
  const closeTooltipTimerRef = React.useRef(null);

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

  const shuffledDiscoverersBySpeciesStage = useMemo(() => {
    const result = {};

    Object.entries(discoverersBySpeciesStage).forEach(([speciesKey, stageMap]) => {
      result[speciesKey] = {};

      Object.entries(stageMap).forEach(([stage, names]) => {
        result[speciesKey][stage] = shuffleList(names);
      });
    });

    return result;
  }, [discoverersBySpeciesStage]);

  const totalStageCount = speciesEntries.reduce(
    (sum, [speciesKey, data]) => sum + getStageList(speciesKey, data).length,
    0
  );

  const myUnlockedStageCount = speciesEntries.reduce((sum, [speciesKey, data]) => {
    const stages = getStageList(speciesKey, data);
    const myHighestStage = myHighestStageBySpecies[speciesKey] || 0;

    return sum + stages.filter(stage => myHighestStage >= stage.stage).length;
  }, 0);

  const classUnlockedStageCount = speciesEntries.reduce((sum, [speciesKey, data]) => {
    const stages = getStageList(speciesKey, data);
    const classHighestStage = classHighestStageBySpecies[speciesKey] || 0;

    return sum + stages.filter(stage => stage.stage === 1 || classHighestStage >= stage.stage).length;
  }, 0);

  const clearTooltipCloseTimer = () => {
    if (closeTooltipTimerRef.current) {
      window.clearTimeout(closeTooltipTimerRef.current);
      closeTooltipTimerRef.current = null;
    }
  };

  const closeDiscovererTooltip = (key, mode = null) => {
    clearTooltipCloseTimer();

    setDiscovererTooltip(prev => {
      if (!prev || prev.key !== key) return prev;
      if (mode && prev.mode !== mode) return prev;
      return null;
    });
  };

  const scheduleCloseDiscovererTooltip = (key, mode = null) => {
    clearTooltipCloseTimer();

    closeTooltipTimerRef.current = window.setTimeout(() => {
      closeDiscovererTooltip(key, mode);
    }, 140);
  };

  const openDiscovererTooltip = (event, key, names, mode = 'hover') => {
    clearTooltipCloseTimer();

    const rect = event.currentTarget.getBoundingClientRect();
    const margin = 12;
    const tooltipWidth = Math.min(320, window.innerWidth - margin * 2);
    const preferredMaxHeight = 260;

    const availableTop = rect.top - margin * 2;
    const availableBottom = window.innerHeight - rect.bottom - margin * 2;

    const placement = availableTop >= 170 || availableTop >= availableBottom
      ? 'top'
      : 'bottom';

    const maxHeight = Math.max(
      90,
      Math.min(
        preferredMaxHeight,
        placement === 'top' ? availableTop : availableBottom
      )
    );

    const left = Math.min(
      window.innerWidth - tooltipWidth - margin,
      Math.max(margin, rect.left + rect.width / 2 - tooltipWidth / 2)
    );

    const top = placement === 'top'
      ? Math.max(margin, rect.top - margin)
      : Math.min(window.innerHeight - margin, rect.bottom + margin);

    setDiscovererTooltip({
      key,
      names,
      left,
      top,
      width: tooltipWidth,
      maxHeight,
      placement,
      mode,
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem 1rem 5rem',
      fontFamily: "'Pretendard', sans-serif",
      background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)',
    }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1.3rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <button
              onClick={() => navigate('/pet')}
              style={{
                border: 'none',
                background: '#e7f5ff',
                color: '#1971c2',
                fontWeight: 900,
                borderRadius: '999px',
                padding: '0.55rem 1rem',
                cursor: 'pointer',
                marginBottom: '0.8rem',
              }}
            >
              ← 펫 페이지
            </button>

            <h1 style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: 1000,
              color: '#1c1c1e',
            }}>
              📖 펫 도감
            </h1>

            <p style={{
              margin: '0.45rem 0 0',
              color: '#667085',
              fontWeight: 700,
              lineHeight: 1.5,
            }}>
              우리 반에서 현재 발견한 펫의 진화 모습과 대표 스킬을 확인해요.
            </p>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '18px',
            padding: '1rem 1.2rem',
            boxShadow: '0 10px 26px rgba(0,0,0,0.06)',
            border: '1px solid #eef2f7',
            minWidth: '230px',
          }}>
            <div style={{
              fontSize: '0.82rem',
              color: '#868e96',
              fontWeight: 900,
              marginBottom: '0.35rem',
            }}>
              내 수집 현황
            </div>

            <div style={{
              fontSize: '1.4rem',
              fontWeight: 1000,
              color: '#343a40',
            }}>
              {myUnlockedStageCount} / {totalStageCount} 단계
            </div>

            <div style={{
              marginTop: '0.4rem',
              fontSize: '0.82rem',
              color: '#868e96',
              fontWeight: 800,
            }}>
              우리 반 발견 단계 {classUnlockedStageCount} / {totalStageCount}
            </div>
          </div>
        </header>

        <main style={{ display: 'grid', gap: '1.2rem' }}>
          {speciesEntries.map(([speciesKey, data]) => {
            const stages = getStageList(speciesKey, data);
            const myHighestStage = myHighestStageBySpecies[speciesKey] || 0;
            const classHighestStage = classHighestStageBySpecies[speciesKey] || 0;
            const elementColor = elementColorMap[data.element] || '#495057';

            return (
              <section
                key={speciesKey}
                style={{
                  background: 'white',
                  borderRadius: '24px',
                  padding: '1.2rem',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                  border: '1px solid #eef2f7',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '1.35rem',
                      fontWeight: 1000,
                      color: '#1f2937',
                    }}>
                      {data.name} 계열
                    </h2>

                    <div style={{
                      display: 'flex',
                      gap: '0.45rem',
                      alignItems: 'center',
                      marginTop: '0.45rem',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{
                        background: elementColor,
                        color: 'white',
                        borderRadius: '999px',
                        padding: '0.22rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 900,
                      }}>
                        {data.element} 속성
                      </span>

                      {myHighestStage > 0 ? (
                        <span style={{
                          color: '#2b8a3e',
                          fontSize: '0.82rem',
                          fontWeight: 900,
                        }}>
                          내가 보유 중
                        </span>
                      ) : (
                        <span style={{
                          color: '#adb5bd',
                          fontSize: '0.82rem',
                          fontWeight: 900,
                        }}>
                          미보유
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: '14px',
                    padding: '0.65rem 0.85rem',
                    color: '#495057',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                  }}>
                    {myHighestStage === 0
                      ? '아직 만나지 못했어요'
                      : myHighestStage === 1
                        ? '다음 목표: 1차 진화'
                        : myHighestStage === 2
                          ? '다음 목표: 최종 진화'
                          : '최종 진화 달성!'}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.9rem',
                }}>
                  {stages.map(stage => {
                    const classUnlocked = stage.stage === 1 || classHighestStage >= stage.stage;
                    const mineUnlocked = myHighestStage >= stage.stage;
                    const imageSrc = petImageMap[`${stage.appearanceId}_idle`];
                    const stageSkills = getStageSkills(stage);

                    const shuffledDiscoverers =
                      shuffledDiscoverersBySpeciesStage[speciesKey]?.[stage.stage] || [];

                    const shownDiscoverers = shuffledDiscoverers.slice(0, 3);
                    const extraCount = Math.max(0, shuffledDiscoverers.length - shownDiscoverers.length);
                    const tooltipKey = `${speciesKey}-${stage.stage}`;

                    const displayName = classUnlocked
                      ? stage.name
                      : stage.stage === 2
                        ? stage.name
                        : '???';

                    const description = classUnlocked
                      ? stage.description
                      : stage.stage === 2
                        ? '우리 반 누군가 1차 진화를 발견하면 진짜 모습과 스킬이 공개돼요.'
                        : '최종 진화는 아직 베일에 싸여 있어요. 누가 가장 먼저 발견할까요?';

                    return (
                      <article
                        key={stage.stage}
                        style={{
                          position: 'relative',
                          borderRadius: '20px',
                          padding: '1rem',
                          background: classUnlocked ? '#ffffff' : '#f8f9fa',
                          border: mineUnlocked
                            ? '3px solid #51cf66'
                            : classUnlocked
                              ? '2px solid #e9ecef'
                              : '2px dashed #ced4da',
                          overflow: 'visible',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.65rem',
                        }}>
                          <span style={{
                            background: classUnlocked ? '#e7f5ff' : '#e9ecef',
                            color: classUnlocked ? '#1971c2' : '#868e96',
                            borderRadius: '999px',
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.76rem',
                            fontWeight: 1000,
                          }}>
                            {stageLabelMap[stage.stage]}
                          </span>

                          {mineUnlocked ? (
                            <span style={{
                              fontSize: '0.76rem',
                              color: '#2b8a3e',
                              fontWeight: 1000,
                            }}>
                              내 도감 등록
                            </span>
                          ) : classUnlocked ? (
                            <span style={{
                              fontSize: '0.76rem',
                              color: '#1971c2',
                              fontWeight: 1000,
                            }}>
                              우리 반 발견
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.76rem',
                              color: '#868e96',
                              fontWeight: 1000,
                            }}>
                              미발견
                            </span>
                          )}
                        </div>

                        <div style={{
                          height: '160px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'radial-gradient(circle, #fff 20%, #f1f3f5 72%)',
                          borderRadius: '18px',
                          marginBottom: '0.9rem',
                          position: 'relative',
                        }}>
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={displayName}
                              style={{
                                maxWidth: '135px',
                                maxHeight: '135px',
                                objectFit: 'contain',
                                filter: classUnlocked
                                  ? 'drop-shadow(0 10px 16px rgba(0,0,0,0.16))'
                                  : 'brightness(0) saturate(0) opacity(0.42) drop-shadow(0 10px 16px rgba(0,0,0,0.20))',
                                transform: classUnlocked ? 'scale(1)' : 'scale(1.04)',
                              }}
                            />
                          ) : (
                            <div style={{ color: '#adb5bd', fontWeight: 900 }}>
                              이미지 없음
                            </div>
                          )}

                          {!classUnlocked && (
                            <div style={{
                              position: 'absolute',
                              bottom: '0.55rem',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: 'rgba(0,0,0,0.62)',
                              color: 'white',
                              borderRadius: '999px',
                              padding: '0.22rem 0.6rem',
                              fontSize: '0.74rem',
                              fontWeight: 900,
                              whiteSpace: 'nowrap',
                            }}>
                              실루엣 공개
                            </div>
                          )}
                        </div>

                        <h3 style={{
                          margin: '0 0 0.35rem',
                          fontSize: '1.08rem',
                          color: '#343a40',
                          fontWeight: 1000,
                        }}>
                          {displayName}
                        </h3>

                        <p style={{
                          margin: '0 0 0.65rem',
                          color: '#868e96',
                          fontSize: '0.8rem',
                          fontWeight: 900,
                        }}>
                          조건: {stage.condition}
                        </p>

                        <div style={{
                          background: classUnlocked ? '#f8f9fa' : '#fff',
                          borderRadius: '14px',
                          padding: '0.75rem',
                          marginBottom: '0.65rem',
                        }}>
                          <div style={{
                            fontSize: '0.78rem',
                            color: '#868e96',
                            fontWeight: 900,
                            marginBottom: '0.5rem',
                          }}>
                            대표 스킬
                          </div>

                          {!classUnlocked ? (
                            <>
                              <div style={{
                                fontSize: '0.95rem',
                                color: '#343a40',
                                fontWeight: 1000,
                              }}>
                                ???
                              </div>

                              <div style={{
                                fontSize: '0.76rem',
                                color: '#868e96',
                                fontWeight: 800,
                                marginTop: '0.2rem',
                              }}>
                                아직 비밀
                              </div>
                            </>
                          ) : stageSkills.length === 0 ? (
                            <div style={{
                              fontSize: '0.9rem',
                              color: '#adb5bd',
                              fontWeight: 900,
                            }}>
                              대표 스킬 없음
                            </div>
                          ) : (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: stageSkills.length >= 2
                                ? 'repeat(2, minmax(0, 1fr))'
                                : '1fr',
                              gap: '0.5rem',
                            }}>
                              {stageSkills.map((skill, skillIndex) => {
                                const skillKey = skill.id || `${skill.name}-${skillIndex}`;
                                const previewKey = `${speciesKey}-${stage.stage}-${skillKey}`;

                                const openSkillPreview = (mode = 'hover') => {
                                  setActiveSkillPreview({
                                    key: previewKey,
                                    skill,
                                    casterAppearanceId: stage.appearanceId,
                                    targetAppearanceId: getRandomBaseTargetAppearanceId(speciesKey),
                                    replayKey: `${previewKey}-${Date.now()}`,
                                    mode,
                                  });
                                };

                                const closeSkillPreview = (mode = 'hover') => {
                                  setActiveSkillPreview(prev => {
                                    if (!prev || prev.key !== previewKey) return prev;
                                    if (mode && prev.mode !== mode) return prev;
                                    return null;
                                  });
                                };

                                return (
                                  <button
                                    key={skillKey}
                                    type="button"
                                    onMouseEnter={() => openSkillPreview('hover')}
                                    onMouseLeave={() => closeSkillPreview('hover')}
                                    onFocus={() => openSkillPreview('hover')}
                                    onBlur={() => closeSkillPreview('hover')}
                                    onClick={(e) => {
                                      e.stopPropagation();

                                      if (
                                        activeSkillPreview?.key === previewKey
                                        && activeSkillPreview?.mode === 'click'
                                      ) {
                                        setActiveSkillPreview(null);
                                      } else {
                                        openSkillPreview('click');
                                      }
                                    }}
                                    style={{
                                      background: 'white',
                                      border: activeSkillPreview?.key === previewKey
                                        ? '2px solid #339af0'
                                        : '1px solid #e9ecef',
                                      borderRadius: '12px',
                                      padding: '0.65rem 0.6rem',
                                      minHeight: '70px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      boxShadow: activeSkillPreview?.key === previewKey
                                        ? '0 8px 18px rgba(51,154,240,0.18)'
                                        : 'none',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    <div style={{
                                      fontSize: '0.88rem',
                                      color: '#343a40',
                                      fontWeight: 1000,
                                      lineHeight: 1.25,
                                      wordBreak: 'keep-all',
                                    }}>
                                      {skill.name}
                                    </div>

                                    <div style={{
                                      fontSize: '0.72rem',
                                      color: '#868e96',
                                      fontWeight: 800,
                                      marginTop: '0.25rem',
                                    }}>
                                      {skill.element || '무'} · 위력 {skill.basePower || 0}
                                    </div>

                                    <div style={{
                                      fontSize: '0.66rem',
                                      color: '#339af0',
                                      fontWeight: 900,
                                      marginTop: '0.22rem',
                                    }}>
                                      미리보기
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <p style={{
                          margin: 0,
                          color: '#495057',
                          fontSize: '0.84rem',
                          lineHeight: 1.55,
                          fontWeight: 650,
                        }}>
                          {description}
                        </p>

                        {classUnlocked && shuffledDiscoverers.length > 0 && (
                          <div style={{
                            background: '#ebfbee',
                            border: '1px solid #d3f9d8',
                            borderRadius: '12px',
                            padding: '0.55rem 0.65rem',
                            marginTop: '0.75rem',
                          }}>
                            <div style={{
                              color: '#2b8a3e',
                              fontSize: '0.74rem',
                              fontWeight: 1000,
                              marginBottom: '0.3rem',
                            }}>
                              발견한 친구
                            </div>

                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.3rem',
                            }}>
                              {shownDiscoverers.map((name, index) => (
                                <span
                                  key={`${name}-${index}`}
                                  style={{
                                    background: 'white',
                                    color: '#2f9e44',
                                    borderRadius: '999px',
                                    padding: '0.18rem 0.5rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 900,
                                    border: '1px solid #c3fae8',
                                  }}
                                >
                                  {name}
                                </span>
                              ))}

                              {extraCount > 0 && (
                                <span
                                  onMouseEnter={(e) => openDiscovererTooltip(e, tooltipKey, shuffledDiscoverers, 'hover')}
                                  onMouseLeave={() => scheduleCloseDiscovererTooltip(tooltipKey, 'hover')}
                                  onFocus={(e) => openDiscovererTooltip(e, tooltipKey, shuffledDiscoverers, 'hover')}
                                  onBlur={() => scheduleCloseDiscovererTooltip(tooltipKey, 'hover')}
                                  onClick={(e) => {
                                    e.stopPropagation();

                                    if (
                                      discovererTooltip?.key === tooltipKey
                                      && discovererTooltip?.mode === 'click'
                                    ) {
                                      setDiscovererTooltip(null);
                                    } else {
                                      openDiscovererTooltip(e, tooltipKey, shuffledDiscoverers, 'click');
                                    }
                                  }}
                                  tabIndex={0}
                                  style={{
                                    background: '#e6fcf5',
                                    color: '#087f5b',
                                    borderRadius: '999px',
                                    padding: '0.18rem 0.5rem',
                                    fontSize: '0.74rem',
                                    fontWeight: 900,
                                    border: '1px solid #96f2d7',
                                    cursor: 'pointer',
                                    outline: 'none',
                                  }}
                                >
                                  +{extraCount}명
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>

        {discovererTooltip && (
          <div
            data-dex-floating-discoverer-tooltip
            onMouseEnter={clearTooltipCloseTimer}
            onMouseLeave={() => scheduleCloseDiscovererTooltip(discovererTooltip.key, 'hover')}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${discovererTooltip.left}px`,
              top: `${discovererTooltip.top}px`,
              transform: discovererTooltip.placement === 'top'
                ? 'translateY(-100%)'
                : 'none',
              width: `${discovererTooltip.width}px`,
              maxHeight: `${discovererTooltip.maxHeight}px`,
              overflowY: 'auto',
              background: '#212529',
              color: 'white',
              borderRadius: '14px',
              padding: '0.75rem',
              boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
              zIndex: 99999,
              textAlign: 'left',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '0.5rem',
            }}>
              <div style={{
                fontSize: '0.76rem',
                fontWeight: 1000,
                color: '#b2f2bb',
              }}>
                발견한 친구 전체
              </div>

              <button
                type="button"
                onClick={() => setDiscovererTooltip(null)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  borderRadius: '999px',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
            }}>
              {discovererTooltip.names.map((name, index) => (
                <span
                  key={`tooltip-${discovererTooltip.key}-${name}-${index}`}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: 'white',
                    borderRadius: '999px',
                    padding: '0.2rem 0.48rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeSkillPreview && (
          <SkillPreview
            skill={activeSkillPreview.skill}
            casterImageSrc={
              petImageMap[`${activeSkillPreview.casterAppearanceId}_battle`]
              || petImageMap[`${activeSkillPreview.casterAppearanceId}_idle`]
            }
            targetImageSrc={
              petImageMap[`${activeSkillPreview.targetAppearanceId}_brace`]
              || petImageMap[`${activeSkillPreview.targetAppearanceId}_idle`]
            }
            replayKey={activeSkillPreview.replayKey}
            onClose={() => setActiveSkillPreview(null)}
          />
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link
            to="/pet"
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              background: '#339af0',
              color: 'white',
              borderRadius: '14px',
              padding: '0.85rem 1.4rem',
              fontWeight: 1000,
              boxShadow: '0 8px 18px rgba(51,154,240,0.25)',
            }}
          >
            내 펫 보러가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PetDexPage;