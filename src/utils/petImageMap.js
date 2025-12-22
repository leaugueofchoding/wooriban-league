// src/utils/petImageMap.js

// --- Dragon Assets ---
import dragon1_portrait from '@/assets/pets/dragon1_portrait.png';
import dragon1_back from '@/assets/pets/dragon1_back.png';
import dragon1_crunch from '@/assets/pets/dragon1_crunch.png';
import dragon1_crunch_back from '@/assets/pets/dragon1_crunch_back.png';

import dragon2_portrait from '@/assets/pets/dragon2_portrait.png';
import dragon2_back from '@/assets/pets/dragon2_back.png';
import dragon2_crunch from '@/assets/pets/dragon2_crunch.png';
import dragon2_crunch_back from '@/assets/pets/dragon2_crunch_back.png';

import dragon3_portrait from '@/assets/pets/dragon3_portrait.png';
import dragon3_back from '@/assets/pets/dragon3_back.png';
import dragon3_crunch from '@/assets/pets/dragon3_crunch.png';
import dragon3_crunch_back from '@/assets/pets/dragon3_crunch_back.png';

// --- Rabbit Assets ---
import rabbit1_portrait from '@/assets/pets/rabbit1_portrait.png';
import rabbit1_back from '@/assets/pets/rabbit1_back.png';
import rabbit1_crunch from '@/assets/pets/rabbit1_crunch.png';
import rabbit1_crunch_back from '@/assets/pets/rabbit1_crunch_back.png';

import rabbit2_portrait from '@/assets/pets/rabbit2_portrait.png';
import rabbit2_back from '@/assets/pets/rabbit2_back.png';
import rabbit2_crunch from '@/assets/pets/rabbit2_crunch.png';
import rabbit2_crunch_back from '@/assets/pets/rabbit2_crunch_back.png';

import rabbit3_portrait from '@/assets/pets/rabbit3_portrait.png';
import rabbit3_back from '@/assets/pets/rabbit3_back.png';
import rabbit3_crunch from '@/assets/pets/rabbit3_crunch.png';
import rabbit3_crunch_back from '@/assets/pets/rabbit3_crunch_back.png';

// --- Bird (Turtle) Assets ---
import bird1_portrait from '@/assets/pets/bird1_portrait.png';
import bird1_back from '@/assets/pets/bird1_back.png';
import bird1_crunch from '@/assets/pets/bird1_crunch.png';
import bird1_crunch_back from '@/assets/pets/bird1_crunch_back.png';

import bird2_portrait from '@/assets/pets/bird2_portrait.png';
import bird2_back from '@/assets/pets/bird2_back.png';
import bird2_crunch from '@/assets/pets/bird2_crunch.png';
import bird2_crunch_back from '@/assets/pets/bird2_crunch_back.png';

import bird3_portrait from '@/assets/pets/bird3_portrait.png';
import bird3_back from '@/assets/pets/bird3_back.png';
import bird3_crunch from '@/assets/pets/bird3_crunch.png';
import bird3_crunch_back from '@/assets/pets/bird3_crunch_back.png';


export const petImageMap = {
    // === Dragon ===
    dragon_lv1_idle: dragon1_portrait,
    dragon_lv1_battle: dragon1_back,
    dragon_lv1_brace: dragon1_crunch,
    dragon_lv1_brace_back: dragon1_crunch_back,

    dragon_lv2_idle: dragon2_portrait,
    dragon_lv2_battle: dragon2_back,
    dragon_lv2_brace: dragon2_crunch,
    dragon_lv2_brace_back: dragon2_crunch_back,

    dragon_lv3_idle: dragon3_portrait,
    dragon_lv3_battle: dragon3_back,
    dragon_lv3_brace: dragon3_crunch,
    dragon_lv3_brace_back: dragon3_crunch_back,

    // === Rabbit ===
    rabbit_lv1_idle: rabbit1_portrait,
    rabbit_lv1_battle: rabbit1_back,
    rabbit_lv1_brace: rabbit1_crunch,
    rabbit_lv1_brace_back: rabbit1_crunch_back,

    rabbit_lv2_idle: rabbit2_portrait,
    rabbit_lv2_battle: rabbit2_back,
    rabbit_lv2_brace: rabbit2_crunch,
    rabbit_lv2_brace_back: rabbit2_crunch_back,

    rabbit_lv3_idle: rabbit3_portrait,
    rabbit_lv3_battle: rabbit3_back,
    rabbit_lv3_brace: rabbit3_crunch,
    rabbit_lv3_brace_back: rabbit3_crunch_back,

    // === Turtle (Uses Bird Assets) ===
    // Lv1: 새싹치 (Turtle ID but uses Bird1 images)
    turtle_lv1_idle: bird1_portrait,
    turtle_lv1_battle: bird1_back,
    turtle_lv1_brace: bird1_crunch,
    turtle_lv1_brace_back: bird1_crunch_back,

    // [핵심 수정] Lv2: 꽃잎치 (ID: bird_lv2 -> Bird2 images)
    bird_lv2_idle: bird2_portrait,
    bird_lv2_battle: bird2_back,
    bird_lv2_brace: bird2_crunch,
    bird_lv2_brace_back: bird2_crunch_back,

    // [핵심 수정] Lv3: 열매치 (ID: bird_lv3 -> Bird3 images)
    bird_lv3_idle: bird3_portrait,
    bird_lv3_battle: bird3_back,
    bird_lv3_brace: bird3_crunch,
    bird_lv3_brace_back: bird3_crunch_back,
};