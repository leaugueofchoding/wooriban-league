// src/utils/emblemMap.js

import defaultEmblem from '../assets/default-emblem.png';
import emblemTokki from '../assets/emblem_tokki.png';
import emblemTiger from '../assets/emblem_tiger.png';
import emblemLion from '../assets/emblem_lion.png';
import emblemPig from '../assets/emblem_pig.png';
import emblemDaramjui from '../assets/emblem_daramjui.png';
import emblemCat from '../assets/emblem_cat.png';
import emblemDog from '../assets/emblem_dog.png';

// ID와 실제 이미지 import 변수를 매핑하는 객체
export const emblemMap = {
    tokki: emblemTokki,
    tiger: emblemTiger,
    lion: emblemLion,
    pig: emblemPig,
    daramjui: emblemDaramjui,
    cat: emblemCat,
    dog: emblemDog,
    default: defaultEmblem,
};

// 기존 presetEmblems 배열도 여기서 관리합니다.
export const presetEmblems = [
    { id: 'tokki', src: emblemTokki },
    { id: 'tiger', src: emblemTiger },
    { id: 'lion', src: emblemLion },
    { id: 'pig', src: emblemPig },
    { id: 'daramjui', src: emblemDaramjui },
    { id: 'cat', src: emblemCat },
    { id: 'dog', src: emblemDog },
    { id: 'default', src: defaultEmblem }
];