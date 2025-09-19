// src/features/pet/petItems.js

// 펫 이미지를 import하여 상점에서 보여줍니다.
import brainSnackImg from '@/assets/items/item_brain_snack.png';
import evolutionStoneImg from '@/assets/items/item_evolution_stone.png';
import firstAidKitImg from '@/assets/items/item_first_aid_kit.png';
import petEggImg from '@/assets/items/item_pet_egg.png';

export const PET_ITEMS = {
    brain_snack: {
        id: 'brain_snack',
        name: '두뇌 간식',
        description: '펫의 경험치를 100 올려주는 맛있는 간식입니다.',
        price: 150,
        image: brainSnackImg,
    },
    first_aid_kit: {
        id: 'first_aid_kit',
        name: '구급상자',
        description: '전투 불능 상태가 된 펫을 최대 HP의 50%로 부활시킵니다.',
        price: 300,
        image: firstAidKitImg,
    },
    evolution_stone: {
        id: 'evolution_stone',
        name: '진화의 돌',
        description: '일정 레벨에 도달한 펫을 다음 단계로 진화시키는 신비한 돌입니다.',
        price: 10000, // 10000P로 인상
        image: evolutionStoneImg,
    },
    pet_egg: {
        id: 'pet_egg',
        name: '펫 알',
        description: '어떤 펫이 부화할지 모르는 신비한 알입니다. 새로운 파트너를 만나보세요!',
        price: 8000, // 8000P로 설정
        image: petEggImg,
    },
};