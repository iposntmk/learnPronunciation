import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Volume2, Search, ChevronLeft, RotateCcw, BookOpen, Library, ExternalLink, Play, Square, Home, Plus, Minus } from 'lucide-react'
import {
  SOUNDS, VOWEL_GROUPS, CONSONANT_GROUPS,
  SPANISH_SOUNDS, SPANISH_VOWEL_GROUPS, SPANISH_CONSONANT_GROUPS, SPANISH_PHONEME_INFO,
  ITALIAN_SOUNDS, ITALIAN_VOWEL_GROUPS, ITALIAN_CONSONANT_GROUPS, ITALIAN_PHONEME_INFO,
  FRENCH_SOUNDS,  FRENCH_VOWEL_GROUPS,  FRENCH_CONSONANT_GROUPS,  FRENCH_PHONEME_INFO,
} from './data.js'
import { scoreWord } from './scorer.js'
import { getAzureUsageSummary } from './azureUsage.js'
import { speakNeural, speakPhoneme } from './tts.js'
import { COMMON_3000_WORDS, COMMON_3000_LEVELS, COMMON_3000_COUNTS } from './commonWords.js'
import { COMMON_3000_DETAIL_MAP } from './commonWordDetails.js'

// ─── RACHEL'S ENGLISH LINKS ────────────────────────────────────────────────

const RACHEL_URLS = {
  'iː': 'https://rachelsenglish.com/english-pronounce-ee-vowel/',
  'ɪ':  'https://rachelsenglish.com/english-pronounce-ih-vowel/',
  'ɛ':  'https://rachelsenglish.com/english-pronounce-eh-vowel/',
  'æ':  'https://rachelsenglish.com/english-pronounce-aa-ae-vowel/',
  'ʌ':  'https://rachelsenglish.com/english-pronounce-uh-butter-vowel/',
  'ə':  'https://rachelsenglish.com/english-pronounce-schwa/',
  'ɜː': 'https://rachelsenglish.com/english-pronounce-ur-vowel/',
  'uː': 'https://rachelsenglish.com/english-pronounce-oo-vowel/',
  'ʊ':  'https://rachelsenglish.com/english-pronounce-uh-push-vowel/',
  'ɔː': 'https://rachelsenglish.com/english-pronounce-aw-vowel/',
  'ɑː': 'https://rachelsenglish.com/english-pronounce-ah-vowel/',
  'oʊ': 'https://rachelsenglish.com/english-pronounce-oh-diphthong/',
  'eɪ': 'https://rachelsenglish.com/english-pronounce-ay-diphthong/',
  'aɪ': 'https://rachelsenglish.com/english-pronounce-ai-diphthong/',
  'ɔɪ': 'https://rachelsenglish.com/english-pronounce-oy-diphthong/',
  'aʊ': 'https://rachelsenglish.com/english-pronounce-ow-diphthong/',
  'ɑːr':'https://rachelsenglish.com/pronounce-ar-orn-etc/',
  'ɔːr':'https://rachelsenglish.com/pronounce-word-2/',
  'ɛər':'https://rachelsenglish.com/how-to-pronounce-air/',
  'ɪər':'https://rachelsenglish.com/vowels-ipa-pronunciation-international-phonetic-alphabet/',
  'p':  'https://rachelsenglish.com/english-pronounce-b-p-consonants/',
  'b':  'https://rachelsenglish.com/english-pronounce-b-p-consonants/',
  't':  'https://rachelsenglish.com/english-pronounce-t-d-consonants/',
  'd':  'https://rachelsenglish.com/english-pronounce-t-d-consonants/',
  'k':  'https://rachelsenglish.com/english-pronounce-g-k-consonants/',
  'g':  'https://rachelsenglish.com/english-pronounce-g-k-consonants/',
  'm':  'https://rachelsenglish.com/english-pronounce-m-consonant/',
  'n':  'https://rachelsenglish.com/english-pronounce-n-consonant/',
  'ŋ':  'https://rachelsenglish.com/pronounce-n-n-vs-ng-n/',
  'f':  'https://rachelsenglish.com/english-pronounce-f-v-consonants/',
  'v':  'https://rachelsenglish.com/english-pronounce-f-v-consonants/',
  'θ':  'https://rachelsenglish.com/english-pronounce-th-consonants/',
  'ð':  'https://rachelsenglish.com/english-pronounce-th-consonants/',
  's':  'https://rachelsenglish.com/english-pronounce-s-z-consonants/',
  'z':  'https://rachelsenglish.com/english-pronounce-s-z-consonants/',
  'ʃ':  'https://rachelsenglish.com/english-pronounce-sh-zh-consonants/',
  'ʒ':  'https://rachelsenglish.com/english-pronounce-sh-zh-consonants/',
  'h':  'https://rachelsenglish.com/english-pronounce-h-consonant/',
  'r':  'https://rachelsenglish.com/5-tips-for-r-in-american-english/',
  'j':  'https://rachelsenglish.com/english-pronounce-y-consonant/',
  'w':  'https://rachelsenglish.com/pronounce-w-consonant/',
  'l':  'https://rachelsenglish.com/english-pronounce-l-consonant/',
  'tʃ': 'https://rachelsenglish.com/english-pronounce-ch-jj-sounds/',
  'dʒ': 'https://rachelsenglish.com/english-pronounce-ch-jj-sounds/',
  'ɾ':  'https://rachelsenglish.com/t-pronunciations/',
}

// YouTube search URL for Rachel's English for a given IPA label
function rachelYouTubeSearch(label) {
  return `https://www.youtube.com/results?search_query=rachel%27s+english+${encodeURIComponent(label)}+sound`
}

// ─── PHONEME ENGINE ────────────────────────────────────────────────────────

const PHONEME_INFO = {
  'θ':  { tip: 'Đặt đầu lưỡi giữa hai hàm răng, thổi khí không rung họng', hard: true },
  'ð':  { tip: 'Lưỡi giữa răng nhưng rung họng (voiced)', hard: true },
  'r':  { tip: 'Cuộn lưỡi ra sau không chạm gì, môi hơi tròn', hard: true },
  'l':  { tip: 'Đầu lưỡi chạm sau răng cửa trên', hard: false },
  'æ':  { tip: 'Mở miệng rộng, kéo về phía trước — "cat, bad"', hard: true },
  'ɪ':  { tip: 'Âm /i/ ngắn — lưỡi cao, miệng thư giãn hơn /iː/', hard: false },
  'iː': { tip: 'Âm /i/ dài, kéo hai góc môi sang ngang', hard: false },
  'ʌ':  { tip: 'Giống "ă" Việt, miệng mở vừa, lưỡi giữa-thấp', hard: true },
  'ɜː': { tip: 'Môi tròn nhẹ, lưỡi giữa, cuộn ra sau — "bird, word"', hard: true },
  'ɑː': { tip: 'Âm "a" dài, mở miệng rộng', hard: false },
  'ɔː': { tip: 'Môi tròn, miệng mở vừa — "saw, call"', hard: false },
  'ʊ':  { tip: 'Âm /u/ ngắn, môi tròn nhẹ — "book, good"', hard: true },
  'uː': { tip: 'Âm /u/ dài, môi tròn căng — "food, moon"', hard: false },
  'ə':  { tip: 'Schwa — âm trung hòa, miệng hoàn toàn thư giãn', hard: false },
  'ər': { tip: 'Schwa + cuộn lưỡi nhẹ (giọng Mỹ)', hard: false },
  'eɪ': { tip: 'Diphthong: "e" trượt lên "i" — "day, make"', hard: false },
  'aɪ': { tip: 'Diphthong: "a" rộng trượt lên "i" — "night, like"', hard: false },
  'aɪər':{ tip: 'Diphthong + đuôi r-colored — "fire, acquire"', hard: false },
  'aʊər':{ tip: 'Diphthong + đuôi r-colored — "hour, power"', hard: false },
  'aʊ': { tip: 'Diphthong: "a" trượt lên "u" — "now, out"', hard: false },
  'oʊ': { tip: 'Diphthong: "o" trượt lên "u" — "go, road"', hard: false },
  'ɔɪ': { tip: 'Diphthong: "oi" trong "boy, voice"', hard: false },
  'ɛər':{ tip: 'Diphthong: /ɛ/ + /ər/ — "there, where"', hard: false },
  'ɪər':{ tip: 'Diphthong: /ɪ/ + /ər/ — "here, ear"', hard: false },
  'ɑːr':{ tip: 'Âm "a" dài + cuộn lưỡi — "car, large"', hard: false },
  'ɔːr':{ tip: 'Âm "ô" tròn + cuộn lưỡi — "more, door"', hard: false },
  'ɾ':  { tip: 'Flap — /t/ hoặc /d/ giữa nguyên âm trong giọng Mỹ, như "d" nhanh', hard: true },
  'v':  { tip: 'Răng cửa trên đặt lên môi dưới, rung họng', hard: true },
  'w':  { tip: 'Chu môi tròn như "oa", không dùng răng', hard: true },
  'f':  { tip: 'Răng trên + môi dưới, thổi khí không rung', hard: false },
  'ŋ':  { tip: 'Lưỡi chạm vòm mềm phía sau, âm mũi', hard: false },
  'ŋk': { tip: 'Lưỡi chạm vòm mềm + bật k nhẹ cuối', hard: false },
  'ŋg': { tip: 'Lưỡi chạm vòm mềm + g rung', hard: false },
  'ʃ':  { tip: 'Chu môi nhẹ, thổi khí — "sh" trong "ship"', hard: false },
  'tʃ': { tip: 'Kết hợp t + ʃ — "ch" trong "church"', hard: false },
  'dʒ': { tip: 'Kết hợp d + ʒ — "j" trong "judge"', hard: false },
  'ʒ':  { tip: 'Giống "sh" nhưng rung họng — "s" trong "measure"', hard: true },
  'n':  { tip: 'Lưỡi chạm sau răng trên, âm mũi', hard: false },
  'm':  { tip: 'Khép môi, rung mũi', hard: false },
  'p':  { tip: 'Bật môi, thổi khí (aspirated)', hard: false },
  'b':  { tip: 'Bật môi, rung họng', hard: false },
  't':  { tip: 'Lưỡi chạm sau răng trên, bật ra', hard: false },
  'd':  { tip: 'Lưỡi chạm sau răng, rung họng', hard: false },
  'k':  { tip: 'Lưỡi chạm vòm mềm, bật ra', hard: false },
  'g':  { tip: 'Lưỡi chạm vòm mềm, rung họng', hard: false },
  's':  { tip: 'Đầu lưỡi gần răng trên, thổi khí', hard: false },
  'z':  { tip: 'Giống /s/ nhưng rung họng', hard: false },
  'h':  { tip: 'Thổi khí từ họng nhẹ nhàng', hard: false },
  'j':  { tip: 'Âm "y" đầu — lưỡi cao, miệng hé', hard: false },
}

const WORD_IPA_RAW = {
  about:[['a','ə'],['b','b'],['ou','aʊ'],['t','t']],
  after:[['a','æ'],['f','f'],['ter','tər']],
  again:[['a','ə'],['g','g'],['ai','eɪ'],['n','n']],
  all:[['all','ɔːl']],
  also:[['al','ɔːl'],['so','soʊ']],
  always:[['al','ɔːl'],['ways','weɪz']],
  another:[['an','ə'],['oth','ʌð'],['er','ər']],
  answer:[['an','æn'],['swer','sər']],
  ask:[['a','æ'],['sk','sk']],
  back:[['b','b'],['a','æ'],['ck','k']],
  bad:[['b','b'],['a','æ'],['d','d']],
  bath:[['b','b'],['a','æ'],['th','θ']],
  beautiful:[['beau','bjuː'],['ti','tɪ'],['ful','fəl']],
  because:[['be','bɪ'],['cause','kɔːz']],
  bed:[['b','b'],['e','ɛ'],['d','d']],
  bird:[['b','b'],['ir','ɜː'],['d','d']],
  book:[['b','b'],['oo','ʊ'],['k','k']],
  both:[['b','b'],['o','oʊ'],['th','θ']],
  brother:[['br','br'],['o','ʌ'],['th','ð'],['er','ər']],
  but:[['b','b'],['u','ʌ'],['t','t']],
  call:[['c','k'],['all','ɔːl']],
  can:[['c','k'],['a','æ'],['n','n']],
  cat:[['c','k'],['a','æ'],['t','t']],
  careful:[['care','kɛər'],['ful','fəl']],
  chair:[['ch','tʃ'],['air','ɛər']],
  child:[['ch','tʃ'],['i','aɪ'],['ld','ld']],
  city:[['ci','sɪ'],['ty','ɾi']],
  cold:[['c','k'],['o','oʊ'],['ld','ld']],
  come:[['c','k'],['ome','ʌm']],
  computer:[['com','kəm'],['pu','pjuː'],['ter','tər']],
  cup:[['c','k'],['u','ʌ'],['p','p']],
  day:[['d','d'],['ay','eɪ']],
  different:[['dif','dɪf'],['fer','fər'],['ent','ənt']],
  do:[['d','d'],['o','uː']],
  dog:[['d','d'],['o','ɑː'],['g','g']],
  each:[['ea','iː'],['ch','tʃ']],
  earth:[['ear','ɜː'],['th','θ']],
  eat:[['ea','iː'],['t','t']],
  enjoy:[['en','ɪn'],['joy','dʒɔɪ']],
  enough:[['e','ɪ'],['nough','nʌf']],
  every:[['ev','ɛv'],['er','ər'],['y','i']],
  face:[['f','f'],['a','eɪ'],['ce','s']],
  family:[['fam','fæm'],['i','ɪ'],['ly','li']],
  father:[['fa','fɑː'],['th','ð'],['er','ər']],
  feel:[['f','f'],['ee','iː'],['l','l']],
  find:[['f','f'],['i','aɪ'],['nd','nd']],
  five:[['f','f'],['ive','aɪv']],
  flower:[['fl','fl'],['ow','aʊ'],['er','ər']],
  food:[['f','f'],['oo','uː'],['d','d']],
  friend:[['fr','fr'],['ie','ɛ'],['nd','nd']],
  funny:[['fun','fʌn'],['ny','i']],
  future:[['fu','fjuː'],['ture','tʃər']],
  get:[['g','g'],['e','ɛ'],['t','t']],
  giant:[['gi','dʒaɪ'],['ant','ənt']],
  girl:[['g','g'],['ir','ɜː'],['l','l']],
  give:[['g','g'],['ive','ɪv']],
  good:[['g','g'],['oo','ʊ'],['d','d']],
  great:[['gr','gr'],['ea','eɪ'],['t','t']],
  hand:[['h','h'],['a','æ'],['nd','nd']],
  happy:[['hap','hæp'],['py','pi']],
  hard:[['h','h'],['ar','ɑːr'],['d','d']],
  have:[['h','h'],['a','æ'],['ve','v']],
  hear:[['h','h'],['ear','ɪər']],
  heart:[['h','h'],['ear','ɑːr'],['t','t']],
  hello:[['hel','hɛl'],['lo','oʊ']],
  help:[['h','h'],['e','ɛ'],['lp','lp']],
  here:[['h','h'],['ere','ɪər']],
  high:[['h','h'],['igh','aɪ']],
  hippo:[['hip','hɪp'],['po','oʊ']],
  home:[['h','h'],['ome','oʊm']],
  house:[['h','h'],['ou','aʊ'],['se','z']],
  how:[['h','h'],['ow','aʊ']],
  important:[['im','ɪm'],['por','pɔːr'],['tant','tənt']],
  just:[['j','dʒ'],['u','ʌ'],['st','st']],
  keep:[['k','k'],['ee','iː'],['p','p']],
  know:[['kn','n'],['ow','oʊ']],
  knowledge:[['know','nɑː'],['ledge','lɪdʒ']],
  language:[['lan','læŋ'],['guage','gwɪdʒ']],
  large:[['l','l'],['ar','ɑːr'],['ge','dʒ']],
  last:[['l','l'],['a','æ'],['st','st']],
  lazy:[['la','leɪ'],['zy','zi']],
  learn:[['l','l'],['ear','ɜː'],['n','n']],
  lemon:[['lem','lɛm'],['on','ən']],
  light:[['l','l'],['igh','aɪ'],['t','t']],
  like:[['l','l'],['i','aɪ'],['ke','k']],
  little:[['lit','lɪt'],['tle','əl']],
  live:[['l','l'],['i','ɪ'],['ve','v']],
  lollipop:[['lol','lɑːl'],['li','ɪ'],['pop','pɑːp']],
  look:[['l','l'],['oo','ʊ'],['k','k']],
  loud:[['l','l'],['ou','aʊ'],['d','d']],
  love:[['l','l'],['ove','ʌv']],
  make:[['m','m'],['a','eɪ'],['ke','k']],
  man:[['m','m'],['a','æ'],['n','n']],
  match:[['m','m'],['a','æ'],['tch','tʃ']],
  measure:[['mea','mɛ'],['sure','ʒər']],
  moon:[['m','m'],['oo','uː'],['n','n']],
  more:[['m','m'],['ore','ɔːr']],
  mother:[['m','m'],['o','ʌ'],['th','ð'],['er','ər']],
  much:[['m','m'],['u','ʌ'],['ch','tʃ']],
  music:[['mu','mjuː'],['sic','zɪk']],
  name:[['n','n'],['a','eɪ'],['me','m']],
  nature:[['na','neɪ'],['ture','tʃər']],
  near:[['n','n'],['ear','ɪər']],
  need:[['n','n'],['ee','iː'],['d','d']],
  next:[['n','n'],['e','ɛ'],['xt','kst']],
  nice:[['n','n'],['i','aɪ'],['ce','s']],
  night:[['n','n'],['igh','aɪ'],['t','t']],
  notes:[['n','n'],['otes','oʊts']],
  nothing:[['no','nʌ'],['th','θ'],['ing','ɪŋ']],
  now:[['n','n'],['ow','aʊ']],
  often:[['of','ɔː'],['ten','tən']],
  old:[['o','oʊ'],['ld','ld']],
  only:[['on','oʊn'],['ly','li']],
  open:[['o','oʊ'],['pen','pən']],
  other:[['o','ʌ'],['th','ð'],['er','ər']],
  out:[['ou','aʊ'],['t','t']],
  people:[['peo','piː'],['ple','pəl']],
  phone:[['ph','f'],['one','oʊn']],
  photo:[['pho','foʊ'],['to','toʊ']],
  place:[['pl','pl'],['a','eɪ'],['ce','s']],
  please:[['pl','pl'],['ea','iː'],['se','z']],
  problem:[['pro','prɑː'],['blem','bləm']],
  pronunciation:[['pro','prə'],['nun','nʌn'],['ci','sɪ'],['a','eɪ'],['tion','ʃən']],
  put:[['p','p'],['u','ʊ'],['t','t']],
  question:[['que','kwɛs'],['tion','tʃən']],
  read:[['r','r'],['ea','iː'],['d','d']],
  really:[['r','r'],['ea','iː'],['ll','l'],['y','i']],
  red:[['r','r'],['e','ɛ'],['d','d']],
  right:[['r','r'],['igh','aɪ'],['t','t']],
  ring:[['r','r'],['ing','ɪŋ']],
  road:[['r','r'],['oa','oʊ'],['d','d']],
  run:[['r','r'],['u','ʌ'],['n','n']],
  same:[['s','s'],['a','eɪ'],['me','m']],
  say:[['s','s'],['ay','eɪ']],
  school:[['sch','sk'],['ool','uːl']],
  she:[['sh','ʃ'],['e','iː']],
  should:[['sh','ʃ'],['oul','ʊ'],['d','d']],
  sister:[['sis','sɪs'],['ter','tər']],
  sleep:[['sl','sl'],['ee','iː'],['p','p']],
  small:[['sm','sm'],['all','ɔːl']],
  soft:[['s','s'],['o','ɔː'],['ft','ft']],
  song:[['s','s'],['ong','ɔːŋ']],
  sound:[['s','s'],['ou','aʊ'],['nd','nd']],
  south:[['s','s'],['ou','aʊ'],['th','θ']],
  speak:[['sp','sp'],['ea','iː'],['k','k']],
  start:[['st','st'],['ar','ɑːr'],['t','t']],
  stop:[['st','st'],['o','ɑː'],['p','p']],
  story:[['sto','stɔːr'],['y','i']],
  study:[['stu','stʌ'],['dy','di']],
  sweater:[['sw','sw'],['eat','ɛt'],['er','ər']],
  table:[['ta','teɪ'],['ble','bəl']],
  take:[['t','t'],['a','eɪ'],['ke','k']],
  teacher:[['tea','tiː'],['cher','tʃər']],
  that:[['th','ð'],['a','æ'],['t','t']],
  the:[['th','ð'],['e','ə']],
  their:[['th','ð'],['eir','ɛər']],
  them:[['th','ð'],['em','ɛm']],
  then:[['th','ð'],['en','ɛn']],
  there:[['th','ð'],['ere','ɛər']],
  these:[['th','ð'],['ese','iːz']],
  they:[['th','ð'],['ey','eɪ']],
  thing:[['th','θ'],['ing','ɪŋ']],
  think:[['th','θ'],['i','ɪ'],['nk','ŋk']],
  this:[['th','ð'],['i','ɪ'],['s','z']],
  those:[['th','ð'],['ose','oʊz']],
  though:[['th','ð'],['ough','oʊ']],
  three:[['thr','θr'],['ee','iː']],
  through:[['thr','θr'],['ough','uː']],
  time:[['t','t'],['i','aɪ'],['me','m']],
  today:[['to','tə'],['day','deɪ']],
  together:[['to','tə'],['geth','gɛð'],['er','ər']],
  treasure:[['trea','trɛ'],['sure','ʒər']],
  tree:[['tr','tr'],['ee','iː']],
  turn:[['t','t'],['ur','ɜː'],['n','n']],
  under:[['un','ʌn'],['der','dər']],
  university:[['u','juː'],['ni','nɪ'],['ver','vɜː'],['si','sɪ'],['ty','ti']],
  usual:[['u','juː'],['su','ʒu'],['al','əl']],
  vegetable:[['veg','vɛdʒ'],['e','ɪ'],['ta','tə'],['ble','bəl']],
  very:[['v','v'],['er','ɛr'],['y','i']],
  vine:[['v','v'],['i','aɪ'],['ne','n']],
  vision:[['vi','vɪ'],['sion','ʒən']],
  vital:[['vi','vaɪ'],['tal','təl']],
  voice:[['v','v'],['oi','ɔɪ'],['ce','s']],
  want:[['w','w'],['an','ɑːn'],['t','t']],
  water:[['wa','wɔː'],['ter','ɾər']],
  weather:[['w','w'],['ea','ɛ'],['th','ð'],['er','ər']],
  well:[['w','w'],['e','ɛ'],['ll','l']],
  what:[['wh','w'],['a','ɑː'],['t','t']],
  when:[['wh','w'],['en','ɛn']],
  where:[['wh','w'],['ere','ɛər']],
  which:[['wh','w'],['ich','ɪtʃ']],
  who:[['wh','h'],['o','uː']],
  why:[['wh','w'],['y','aɪ']],
  will:[['w','w'],['i','ɪ'],['ll','l']],
  wish:[['w','w'],['ish','ɪʃ']],
  with:[['w','w'],['i','ɪ'],['th','θ']],
  without:[['with','wɪð'],['out','aʊt']],
  wonderful:[['won','wʌn'],['der','dər'],['ful','fəl']],
  word:[['w','w'],['or','ɜː'],['d','d']],
  world:[['w','w'],['or','ɜː'],['l','l'],['d','d']],
  wow:[['w','w'],['ow','aʊ']],
  write:[['wr','r'],['i','aɪ'],['te','t']],
  year:[['y','j'],['ear','ɪər']],
  yogurt:[['yo','joʊ'],['gurt','gərt']],
  you:[['y','j'],['ou','uː']],
  your:[['y','j'],['our','ɔːr']],
  yummy:[['yum','jʌm'],['my','i']],
  zebra:[['ze','ziː'],['bra','brə']],
  better:[['bet','bɛt'],['ter','ɾər']],
  muddy:[['mud','mʌd'],['dy','i']],
  // words in SOUNDS data not previously covered
  bee:[['b','b'],['ee','iː']],
  feet:[['f','f'],['ee','iː'],['t','t']],
  fish:[['f','f'],['i','ɪ'],['sh','ʃ']],
  sit:[['s','s'],['i','ɪ'],['t','t']],
  bit:[['b','b'],['i','ɪ'],['t','t']],
  quick:[['qu','kw'],['i','ɪ'],['ck','k']],
  egg:[['e','ɛ'],['gg','g']],
  bag:[['b','b'],['a','æ'],['g','g']],
  black:[['bl','bl'],['a','æ'],['ck','k']],
  bus:[['b','b'],['u','ʌ'],['s','s']],
  duck:[['d','d'],['u','ʌ'],['ck','k']],
  banana:[['ba','bə'],['na','næ'],['na','nə']],
  blue:[['bl','bl'],['ue','uː']],
  ball:[['b','b'],['all','ɔːl']],
  hot:[['h','h'],['o','ɑː'],['t','t']],
  clock:[['cl','kl'],['o','ɑː'],['ck','k']],
  dollar:[['d','d'],['o','ɑː'],['ll','l'],['ar','ər']],
  go:[['g','g'],['o','oʊ']],
  bike:[['b','b'],['i','aɪ'],['ke','k']],
  boy:[['b','b'],['oy','ɔɪ']],
  oil:[['oi','ɔɪ'],['l','l']],
  car:[['c','k'],['ar','ɑːr']],
  door:[['d','d'],['oor','ɔːr']],
  pretty:[['pr','pr'],['ett','ɪt'],['y','i']],
  plant:[['pl','pl'],['a','æ'],['nt','nt']],
  baby:[['ba','beɪ'],['by','bi']],
  big:[['b','b'],['i','ɪ'],['g','g']],
  tiny:[['ti','taɪ'],['ny','ni']],
  turtle:[['tur','tɜː'],['tle','təl']],
  dinner:[['din','dɪn'],['ner','nər']],
  date:[['d','d'],['a','eɪ'],['te','t']],
  deep:[['d','d'],['ee','iː'],['p','p']],
  candy:[['can','kæn'],['dy','di']],
  cane:[['c','k'],['a','eɪ'],['ne','n']],
  kind:[['k','k'],['i','aɪ'],['nd','nd']],
  giggly:[['gig','gɪg'],['gly','li']],
  meek:[['m','m'],['ee','iː'],['k','k']],
  mouse:[['m','m'],['ou','aʊ'],['se','s']],
  new:[['n','n'],['ew','juː']],
  necklace:[['neck','nɛk'],['lace','lɪs']],
  furry:[['fur','fɜː'],['ry','ri']],
  nose:[['n','n'],['o','oʊ'],['se','z']],
  shiny:[['sh','ʃ'],['i','aɪ'],['ny','ni']],
  shoes:[['sh','ʃ'],['oes','uːz']],
  prickly:[['pr','pr'],['i','ɪ'],['ck','k'],['ly','li']],
  branch:[['br','br'],['a','æ'],['n','n'],['ch','tʃ']],
  whale:[['wh','w'],['a','eɪ'],['le','l']],
  cheddar:[['ch','tʃ'],['e','ɛ'],['dd','d'],['ar','ər']],
  cheese:[['ch','tʃ'],['ee','iː'],['se','z']],
  church:[['ch','tʃ'],['ur','ɜː'],['ch','tʃ']],
  gentle:[['gen','dʒɛn'],['tle','təl']],
  city_tap:[['ci','sɪ'],['ty','ɾi']],
  butter:[['but','bʌt'],['ter','ɾər']],
  before:[['be','bɪ'],['fore','fɔːr']],
  breathe:[['br','br'],['eathe','iːð']],
  morning:[['mor','mɔːr'],['ning','nɪŋ']],
  learning:[['learn','lɜːrn'],['ing','ɪŋ']],
}

// Primary stress index (0-based) by vowel nucleus / stressed syllable.
// Only multi-syllable words are listed; single-syllable words need no ˈ mark.
const WORD_STRESS_IDX = {
  // stress on 2nd group
  about: 1, again: 1, another: 1, banana: 1, because: 1, before: 1,
  enjoy: 1, enough: 1, hello: 1, today: 1, together: 1, without: 1,
  // stress on 1st group (most 2-syllable nouns / adjectives)
  after: 0, also: 0, always: 0, answer: 0, baby: 0, better: 0, brother: 0,
  butter: 0, candy: 0, careful: 0, cheddar: 0, city: 0, city_tap: 0,
  different: 0, dinner: 0, dollar: 0, every: 0, family: 0, father: 0,
  flower: 0, funny: 0, furry: 0, future: 0, gentle: 0, giant: 0, giggly: 0,
  happy: 0, hippo: 0, knowledge: 0, language: 0, lazy: 0, learning: 0,
  lemon: 0, little: 0, measure: 0, morning: 0, mother: 0, muddy: 0,
  music: 0, nature: 0, necklace: 0, nothing: 0, often: 0, only: 0,
  open: 0, other: 0, people: 0, photo: 0, pretty: 0, prickly: 0,
  problem: 0, question: 0, really: 0, shiny: 0, sister: 0, story: 0,
  study: 0, sweater: 0, table: 0, teacher: 0, tiny: 0, treasure: 0,
  turtle: 0, under: 0, very: 0, vision: 0, vital: 0, water: 0,
  weather: 0, wonderful: 0, yogurt: 0, yummy: 0, zebra: 0,
  // 3+ syllable words
  beautiful: 0, computer: 1, important: 1, lollipop: 0,
  pronunciation: 3, university: 2, usual: 0, vegetable: 0,
}

const STRESS_VOWEL_MARKERS = [
  'ɛər', 'ɪər', 'ɑːr', 'ɔːr', 'ər',
  'iː', 'ɜː', 'uː', 'ɔː', 'ɑː',
  'oʊ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ',
  'ə', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ',
]

function hasStressBearingVowel(ipa) {
  return STRESS_VOWEL_MARKERS.some(marker => ipa.includes(marker))
}

function unsupportedWord(word) {
  return [{
    text: word,
    ipa: '?',
    tip: 'Từ này chưa có IPA đáng tin trong từ điển English hiện tại',
    isHard: false,
    isStressed: false,
    canScore: false,
    lookupNote: 'Chưa hỗ trợ từ này trong English dictionary. App sẽ chỉ chấm những từ có IPA đã được kiểm chứng.',
  }]
}

function normalizeWordEntry(raw, stressIdx = -1) {
  let vowelIdx = -1
  return raw.map(([text, ipa], i) => ({
    ...(hasStressBearingVowel(ipa) ? { __vowelIdx: ++vowelIdx } : { __vowelIdx: null }),
    text, ipa,
    tip: PHONEME_INFO[ipa]?.tip || `Âm /${ipa}/`,
    isHard: PHONEME_INFO[ipa]?.hard || false,
    isStressed: hasStressBearingVowel(ipa) && vowelIdx === stressIdx,
    canScore: true,
    lookupNote: null,
  })).map(({ __vowelIdx, ...entry }) => entry)
}

const EXTERNAL_DICT_CACHE = new Map()

const EN_FALLBACK_IPA_OVERRIDES = {
  commitment: '/kəˈmɪtmənt/',
  committee: '/kəˈmɪti/',
  competitor: '/kəmˈpetətər/',
  complex: '/kəmˈpleks/',
}

function stripIpaDecorators(ipa) {
  return ipa
    .replace(/^\/|\/$/g, '')
    .replace(/^\[|\]$/g, '')
    .replace(/[()]/g, '')
    .replace(/\./g, '')
    .replace(/ˌ/g, '')
    .trim()
}

function normalizeExternalIpa(ipa) {
  return stripIpaDecorators(ipa)
    .normalize('NFC')
    .replace(/ː/g, 'ː')
    .replace(/ˑ/g, 'ː')
    .replace(/l̩/g, 'əl')
    .replace(/m̩/g, 'əm')
    .replace(/n̩/g, 'ən')
    .replace(/ɹ/g, 'r')
    .replace(/ɡ/g, 'g')
    .replace(/ɚ/g, 'ər')
    .replace(/ɝ/g, 'ɜː')
    .replace(/ɜr/g, 'ɜːr')
    .replace(/ɫ/g, 'l')
    .replace(/ᵻ/g, 'ɪ')
    .replace(/ᵿ/g, 'ʊ')
    .replace(/ʔ/g, 't')
    .replace(/əʊ/g, 'oʊ')
    .replace(/əu/g, 'oʊ')
    .replace(/oː/g, 'oʊ')
    .replace(/ɔːɹ/g, 'ɔːr')
    .replace(/ɑːɹ/g, 'ɑːr')
    .replace(/ɜːɹ/g, 'ɜːr')
    .replace(/eə/g, 'ɛər')
    .replace(/ɪə/g, 'ɪər')
    .replace(/ʊə/g, 'ɔːr')
    .replace(/aə/g, 'aɪər')
}

const EXTERNAL_IPA_ATOMS = [
  'aɪər', 'aʊər', 'tʃ', 'dʒ', 'iː', 'ɜː', 'uː', 'ɔː', 'ɑː', 'oʊ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ',
  'ɛər', 'ɪər', 'ɑːr', 'ɔːr', 'ɜːr', 'ər', 'juː', 'kw', 'ks',
  'ŋk', 'ŋg', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ',
  'ə', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ', 'i', 'ɑ', 'ɒ', 'ɔ', 'e', 'a', 'ɜ', 'ɐ', 'ɾ',
  'p', 'b', 't', 'd', 'k', 'g', 'm', 'n', 'f', 'v', 's', 'z', 'h', 'r', 'j', 'w', 'l',
]

function tokenizeExternalIpa(rawIpa) {
  const ipa = normalizeExternalIpa(rawIpa)
  if (!ipa) return []

  const out = []
  let i = 0
  let stressNext = false

  while (i < ipa.length) {
    const ch = ipa[i]
    if (ch === 'ˈ') {
      stressNext = true
      i++
      continue
    }

    const atom = EXTERNAL_IPA_ATOMS.find(item => ipa.startsWith(item, i))
    if (!atom) {
      if (/[\s,_-]/.test(ch)) {
        i++
        continue
      }
      out.push({ ipa: ch, isStressed: stressNext })
      stressNext = false
      i++
      continue
    }
    out.push({ ipa: atom, isStressed: stressNext })
    stressNext = false
    i += atom.length
  }

  return out
}

function splitWordAcrossPhonemes(word, count) {
  const clean = word.trim()
  if (count <= 1) return [clean]

  const out = []
  let cursor = 0
  for (let i = 0; i < count; i++) {
    const remainingLetters = clean.length - cursor
    const remainingSlots = count - i
    const size = Math.max(1, Math.ceil(remainingLetters / remainingSlots))
    out.push(clean.slice(cursor, cursor + size))
    cursor += size
  }
  if (cursor < clean.length) out[out.length - 1] += clean.slice(cursor)
  return out
}

function buildExternalWordEntry(word, rawIpa) {
  const tokens = tokenizeExternalIpa(rawIpa)
  if (tokens.length === 0) return null
  const chunks = splitWordAcrossPhonemes(word, tokens.length)
  return tokens.map((token, index) => ({
    text: chunks[index] || '',
    ipa: token.ipa,
    tip: PHONEME_INFO[token.ipa]?.tip || `Âm /${token.ipa}/`,
    isHard: PHONEME_INFO[token.ipa]?.hard || false,
    isStressed: token.isStressed,
    canScore: true,
    lookupNote: null,
  }))
}

function buildRuleBasedWordEntry(word) {
  const fallbackIpa = EN_FALLBACK_IPA_OVERRIDES[word.toLowerCase()]
  const built = fallbackIpa ? buildExternalWordEntry(word, fallbackIpa) : null
  if (built) return built
  return g2p(word).map(p => ({
    ...p,
    canScore: true,
    lookupNote: null,
  }))
}

async function fetchEnglishDictionaryPhonemes(word) {
  const key = word.toLowerCase().trim()
  if (!key) return null
  if (EXTERNAL_DICT_CACHE.has(key)) return EXTERNAL_DICT_CACHE.get(key)

  const promise = (async () => {
    try {
      const phraseParts = key.split(/\s+/).filter(Boolean)
      if (phraseParts.length > 1) {
        const parts = []
        for (const part of phraseParts) {
          const found = await fetchEnglishDictionaryPhonemes(part)
          if (!found) return null
          parts.push(found)
        }
        return parts.flatMap((partEntries, partIndex) => partEntries.map((entry, entryIndex) => ({
          ...entry,
          text: partIndex > 0 && entryIndex === 0 ? ` ${entry.text}` : entry.text,
        })))
      }

      let resp = null
      for (let i = 0; i < 3; i++) {
        resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
        if (resp.ok) break
        await new Promise(resolve => setTimeout(resolve, 250 * (i + 1)))
      }
      if (!resp?.ok) return buildRuleBasedWordEntry(key)
      const data = await resp.json()
      if (!Array.isArray(data)) return buildRuleBasedWordEntry(key)

      for (const entry of data) {
        const candidates = [
          ...(entry.phonetics || [])
            .filter(p => p?.text)
            .sort((a, b) => {
              const aUs = /\/us_|-us\.mp3|us_pron/i.test(a.audio || '')
              const bUs = /\/us_|-us\.mp3|us_pron/i.test(b.audio || '')
              return Number(bUs) - Number(aUs)
            })
            .map(p => p.text),
          entry.phonetic,
        ].filter(Boolean)

        for (const candidate of candidates) {
          const built = buildExternalWordEntry(key, candidate)
          if (built) return built
        }
      }
      return buildRuleBasedWordEntry(key)
    } catch {
      return buildRuleBasedWordEntry(key)
    }
  })()

  EXTERNAL_DICT_CACHE.set(key, promise)
  return promise
}

function lookupWord(word, { allowGuess = true } = {}) {
  const w = word.toLowerCase().trim().replace(/[^a-z]/g, '')
  const raw = WORD_IPA_RAW[w]
  if (raw) {
    const stressIdx = WORD_STRESS_IDX[w] ?? -1
    return normalizeWordEntry(raw, stressIdx)
  }
  return allowGuess ? g2p(w) : unsupportedWord(w || word)
}

function g2p(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return unsupportedWord(word)
  const out = []
  let i = 0
  const voiced_th_words = new Set(['the','this','that','there','they','them','their','these','those','though','with','other','mother','father','brother','whether','weather','another','together','smooth','breathe'])
  const isVoicedThWord = voiced_th_words.has(w)

  while (i < w.length) {
    const rest = w.slice(i)
    const prev = i > 0 ? w[i - 1] : ''
    const next = w[i + 1] || ''
    let found = false
    const try2 = (pat, ipa) => {
      if (rest.startsWith(pat)) { out.push({ text: pat, ipa }); i += pat.length; found = true }
    }
    if (!found) try2('tch', 'tʃ')
    if (!found) try2('dge', 'dʒ')
    if (!found) try2('igh', 'aɪ')
    if (!found) try2('ght', 't')
    if (!found && rest.startsWith('tion')) { out.push({ text: 'tion', ipa: 'ʃən' }); i += 4; found = true }
    if (!found && rest.startsWith('sion')) { out.push({ text: 'sion', ipa: 'ʒən' }); i += 4; found = true }
    if (!found && rest.startsWith('ture')) { out.push({ text: 'ture', ipa: 'tʃər' }); i += 4; found = true }
    if (!found && rest.startsWith('th')) { out.push({ text: 'th', ipa: (isVoicedThWord || i > 0) ? 'ð' : 'θ' }); i += 2; found = true }
    if (!found) try2('sh', 'ʃ')
    if (!found) try2('ch', 'tʃ')
    if (!found) try2('ph', 'f')
    if (!found && rest.startsWith('wh')) { out.push({ text: 'wh', ipa: next === 'o' ? 'h' : 'w' }); i += 2; found = true }
    if (!found) try2('ck', 'k')
    if (!found && rest.startsWith('ng')) { out.push({ text: 'ng', ipa: 'aeiou'.includes(w[i + 2] || '') ? 'ŋg' : 'ŋ' }); i += 2; found = true }
    if (!found) try2('qu', 'kw')
    if (!found) try2('kn', 'n')
    if (!found) try2('wr', 'r')
    if (!found && rest.startsWith('mb') && i === w.length - 2) { out.push({ text: 'mb', ipa: 'm' }); i += 2; found = true }
    if (!found) try2('ee', 'iː')
    if (!found) try2('ea', 'iː')
    if (!found) try2('ai', 'eɪ')
    if (!found) try2('ay', 'eɪ')
    if (!found) try2('oa', 'oʊ')
    if (!found) try2('oi', 'ɔɪ')
    if (!found) try2('oy', 'ɔɪ')
    if (!found) try2('oo', 'uː')
    if (!found) try2('ou', 'aʊ')
    if (!found) try2('ow', 'aʊ')
    if (!found) try2('ew', 'juː')
    if (!found) try2('ue', 'uː')
    if (!found) try2('au', 'ɔː')
    if (!found) try2('aw', 'ɔː')
    if (!found) try2('er', 'ər')
    if (!found) try2('ir', 'ɜː')
    if (!found) try2('ur', 'ɜː')
    if (!found) try2('or', 'ɔːr')
    if (!found) try2('ar', 'ɑːr')
    if (!found) {
      const c = w[i]
      let ipa = c
      if (c === 'a') ipa = 'æ'
      else if (c === 'e') ipa = i === w.length - 1 ? null : 'ɛ'
      else if (c === 'i') ipa = 'ɪ'
      else if (c === 'o') ipa = 'ɑː'
      else if (c === 'u') ipa = 'ʌ'
      else if (c === 'y') ipa = i === 0 ? 'j' : 'i'
      else if (c === 'c') ipa = 'eiy'.includes(next) ? 's' : 'k'
      else if (c === 'g') ipa = 'eiy'.includes(next) ? 'dʒ' : 'g'
      else if (c === 's') ipa = 'aeiou'.includes(prev) && 'aeiou'.includes(next) ? 'z' : 's'
      else if (c === 'x') ipa = 'ks'
      else if (c === 'z') ipa = 'z'
      if (ipa !== null) out.push({ text: c, ipa })
      i++
    }
  }
  return out
    .filter(p => p.ipa && p.ipa !== '∅')
    .map(p => ({
      ...p,
      tip: PHONEME_INFO[p.ipa]?.tip || `Âm /${p.ipa}/`,
      isHard: PHONEME_INFO[p.ipa]?.hard || false,
      isStressed: false,
      canScore: false,
      lookupNote: 'IPA này được đoán theo rule, không đủ tin cậy để chấm điểm English dictionary.',
    }))
}


// Build a phoneme array from a word's embedded [text, ipa] pairs + language phoneme info
function buildPhonemes(pairs, infoMap) {
  return pairs
    .map(([text, ipa]) => ({
      text, ipa,
      tip: infoMap[ipa]?.tip || `/${ipa}/`,
      isHard: infoMap[ipa]?.hard || false,
      isStressed: false,
      audioOffset: null,
      audioDuration: null,
    }))
    .filter(p => p.ipa)
}

// ─── AUDIO HELPERS ────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const candidates = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4']
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || ''
}


// ─── UI HELPERS ───────────────────────────────────────────────────────────

function scoreColor(s) { return s >= 85 ? 'text-emerald-400' : s >= 65 ? 'text-yellow-400' : 'text-red-400' }
function scoreBg(s) { return s >= 85 ? 'bg-emerald-500/20 border-emerald-500/50' : s >= 65 ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-red-500/20 border-red-500/50' }
function scoreLabel(s) { return s >= 90 ? 'Xuất sắc! 🎉' : s >= 75 ? 'Tốt lắm! 👍' : s >= 60 ? 'Gần đúng 💪' : 'Luyện thêm nhé 📚' }
function formatIpa(p) { return `${p.isStressed ? 'ˈ' : ''}${p.ipa}` }
function googleTranslateApiUrl(text) {
  return `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`
}

async function fetchVietnameseTranslation(text) {
  const resp = await fetch(googleTranslateApiUrl(text))
  if (!resp.ok) throw new Error('Không dịch tự động được.')
  const data = await resp.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0]).filter(Boolean).join('')
    : ''
  if (!translated) throw new Error('Không có kết quả dịch.')
  return translated
}

const INCORRECT_WORD_REPORTS_KEY = 'incorrectWordReports'

function loadIncorrectWordReports() {
  try {
    const raw = localStorage.getItem(INCORRECT_WORD_REPORTS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveIncorrectWordReports(reports) {
  localStorage.setItem(INCORRECT_WORD_REPORTS_KEY, JSON.stringify(reports))
}

function playScoreFeedbackSound(score) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.65)
    master.connect(ctx.destination)

    const notes = score >= 90
      ? [523.25, 659.25, 783.99, 1046.5]
      : score >= 75
        ? [440, 554.37, 659.25]
        : score >= 60
          ? [392, 440]
          : [220, 196]

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = ctx.currentTime + index * 0.11
      const end = start + (score >= 60 ? 0.16 : 0.22)
      osc.type = score >= 60 ? 'sine' : 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.45, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(gain)
      gain.connect(master)
      osc.start(start)
      osc.stop(end + 0.02)
    })

    setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch {
    // Feedback sound is non-critical; scoring should never fail because audio playback is blocked.
  }
}

// ─── PRONUNCIATION PRACTICE (shared) ─────────────────────────────────────


function PronunciationPractice({
  word,
  meaning,
  emoji,
  lang = 'en-US',
  prebuiltPhonemes = null,
  strictLookup = false,
  compact = false,
  learnedControl = null,
  detail = null,
  onBack,
  onNext = null,
  onPrev = null,
  onSearchWord = null,
}) {
  const [phonemes, setPhonemes] = useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: !strictLookup }))
  const [isResolvingPhonemes, setIsResolvingPhonemes] = useState(false)
  const canScoreWord = phonemes.length > 0 && phonemes.every(p => p.canScore !== false && p.ipa && p.ipa !== '?')
  const lookupNote = phonemes.find(p => p.lookupNote)?.lookupNote || null
  // phases: ready → recording → scoring → result
  const [phase, setPhase] = useState('ready')
  const [errorMsg, setErrorMsg] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [recordingUrl, setRecordingUrl] = useState(null)
  const [isPlayingBack, setIsPlayingBack] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const [isMeaningExpanded, setIsMeaningExpanded] = useState(false)
  const [incorrectReports, setIncorrectReports] = useState(() => loadIncorrectWordReports())
  const [translation, setTranslation] = useState({ word: '', text: '', loading: false, error: null })
  const [recordingDuration, setRecordingDuration] = useState(() => {
    const saved = localStorage.getItem('recordingDuration')
    return saved ? parseInt(saved, 10) : 3
  })
  const [countdown, setCountdown] = useState(3)
  const mrRef = useRef(null)
  const streamRef = useRef(null)
  const speechRef = useRef(null)
  const audioRef = useRef(null)
  const timeoutRef = useRef(null)
  const countdownRef = useRef(null)
  const blobRef = useRef(null)

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
  }, [recordingUrl])

  useEffect(() => {
    setIsMeaningExpanded(false)
    setTranslation({ word, text: '', loading: false, error: null })
  }, [word])

  useEffect(() => {
    let cancelled = false

    if (prebuiltPhonemes) {
      setPhonemes(prebuiltPhonemes)
      setIsResolvingPhonemes(false)
      return () => { cancelled = true }
    }

    const local = lookupWord(word, { allowGuess: !strictLookup })
    setPhonemes(local)

    if (!strictLookup || local.every(p => p.canScore !== false)) {
      setIsResolvingPhonemes(false)
      return () => { cancelled = true }
    }

    setIsResolvingPhonemes(true)
    fetchEnglishDictionaryPhonemes(word).then(found => {
      if (cancelled) return
      setPhonemes(found || unsupportedWord(word))
      setIsResolvingPhonemes(false)
    })

    return () => { cancelled = true }
  }, [prebuiltPhonemes, strictLookup, word])

  const startBlobRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream
        const mimeType = getSupportedMimeType()
        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {})
        mrRef.current = mr
        const chunks = []
        mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        mr.onstop = async () => {
          clearInterval(countdownRef.current)
          stream.getTracks().forEach(t => t.stop())
          if (chunks.length === 0) { setErrorMsg('Không ghi được âm thanh. Thử lại.'); setPhase('ready'); return }
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
          blobRef.current = blob
          setRecordingUrl(URL.createObjectURL(blob))
          setPhase('scoring')
          try {
            const data = await scoreWord(blob, phonemes, lang)
            setResult(data); setPhase('result'); playScoreFeedbackSound(data.overall)
          } catch (err) {
            setErrorMsg(`Lỗi chấm điểm: ${err.message}`); setPhase('ready')
          }
        }
        mr.start(100)
        setPhase('recording')
        setCountdown(recordingDuration)
        countdownRef.current = setInterval(() => {
          setCountdown(prev => Math.max(0, prev - 1))
        }, 1000)
        timeoutRef.current = setTimeout(() => {
          if (mrRef.current?.state === 'recording') mrRef.current.stop()
        }, recordingDuration * 1000)
      })
      .catch(err => {
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        setErrorMsg(isDenied
          ? 'Chưa cấp quyền microphone — nhấn icon 🔒 trên thanh địa chỉ và bật Microphone.'
          : `Lỗi microphone: ${err.message}`)
      })
  }, [phonemes, recordingDuration])

  const startRecording = useCallback(() => {
    if (isResolvingPhonemes) {
      setErrorMsg('Đang tìm IPA cho từ này...')
      return
    }
    if (!canScoreWord) {
      setErrorMsg(lookupNote || 'Từ này chưa có IPA đủ tin cậy để chấm điểm.')
      return
    }
    setRecordingUrl(null)
    setErrorMsg(null)
    startBlobRecording()
  }, [canScoreWord, isResolvingPhonemes, lookupNote, startBlobRecording])

  const stopRecording = () => {
    clearTimeout(timeoutRef.current)
    clearInterval(countdownRef.current)
    if (mrRef.current?.state === 'recording') mrRef.current.stop()
  }

  const playPhoneme = useCallback(async (p) => {
    if (!blobRef.current || p.audioOffset === null) return
    try {
      const ab = await blobRef.current.arrayBuffer()
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(ab)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      const dur = p.audioDuration > 0.02 ? p.audioDuration : undefined
      src.start(0, p.audioOffset, dur)
      src.onended = () => ctx.close()
    } catch (e) { /* ignore */ }
  }, [])

  const reset = () => {
    clearTimeout(timeoutRef.current)
    clearInterval(countdownRef.current)
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    blobRef.current = null
    setPhase('ready'); setResult(null); setSelectedIdx(null)
    setRecordingUrl(null); setIsPlayingBack(false); setErrorMsg(null)
  }

  const resetAndRecord = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearInterval(countdownRef.current)
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    blobRef.current = null
    setResult(null); setSelectedIdx(null)
    setRecordingUrl(null); setIsPlayingBack(false); setErrorMsg(null)
    startBlobRecording()
  }, [startBlobRecording])

  const playbackRecording = () => {
    if (!recordingUrl || !audioRef.current) return
    if (isPlayingBack) {
      audioRef.current.pause(); audioRef.current.currentTime = 0; setIsPlayingBack(false); return
    }
    audioRef.current.src = recordingUrl
    audioRef.current.onended = () => setIsPlayingBack(false)
    audioRef.current.play().then(() => setIsPlayingBack(true)).catch(() => setIsPlayingBack(false))
  }

  const sel = selectedIdx !== null && result ? result.phonemes[selectedIdx] : null
  const hasNav = onPrev !== null || onNext !== null
  const detailMeanings = detail?.meanings || []
  const needsMachineTranslation = detailMeanings.length === 0 || detailMeanings.some(item => item.pos === 'translate')
  const visibleDetailMeanings = isMeaningExpanded ? detailMeanings : detailMeanings.slice(0, 1)
  const wordReportKey = `${lang}:${word.toLowerCase()}`
  const isReportedIncorrect = Boolean(incorrectReports[wordReportKey])
  const toggleIncorrectReport = () => {
    setIncorrectReports(prev => {
      const next = { ...prev }
      if (next[wordReportKey]) {
        delete next[wordReportKey]
      } else {
        next[wordReportKey] = {
          word,
          lang,
          ipa: phonemes.map(formatIpa).join(''),
          meaning,
          reportedAt: new Date().toISOString(),
        }
      }
      saveIncorrectWordReports(next)
      return next
    })
  }
  const translateInApp = useCallback(async () => {
    setTranslation({ word, text: '', loading: true, error: null })
    try {
      const text = await fetchVietnameseTranslation(word)
      setTranslation({ word, text, loading: false, error: null })
    } catch (err) {
      setTranslation({ word, text: '', loading: false, error: err.message || 'Không dịch tự động được.' })
    }
  }, [word])

  useEffect(() => {
    if (needsMachineTranslation) translateInApp()
  }, [needsMachineTranslation, translateInApp])

  const navButtons = hasNav ? (
    <div className="flex flex-col gap-2.5 pt-1">
      <button onClick={onPrev} disabled={!onPrev} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onPrev ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>‹ Từ trước</button>
      <button onClick={onNext} disabled={!onNext} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onNext ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>Từ sau ›</button>
    </div>
  ) : null

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} className="hidden" />

      {/* Tiêu đề từ + IPA breakdown */}
      <div className={`text-center px-4 ${compact ? 'py-1' : 'py-6'}`}>
        <div className={`${compact ? 'hidden' : 'text-5xl mb-2'}`}>{emoji}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => speakNeural(word, lang)} className={`${compact ? 'text-4xl' : 'text-5xl'} font-extrabold text-white hover:text-blue-300 transition-colors flex items-center gap-2 leading-tight`}>
            {word}
            <Volume2 size={compact ? 24 : 28} className="text-white/55" />
          </button>
        </div>
        <div className={`${compact ? 'text-sm' : 'text-xs'} text-white/55 mt-0.5`}>{meaning}</div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-cyan-100/90 font-mono font-semibold break-all leading-tight`}>/{phonemes.map(formatIpa).join('')}/</div>
          <label className={`shrink-0 rounded-xl border px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${isReportedIncorrect ? 'bg-red-500/20 border-red-400/40 text-red-200' : 'bg-white/5 border-white/10 text-white/55'}`}>
            <input
              type="checkbox"
              checked={isReportedIncorrect}
              onChange={toggleIncorrectReport}
              className="accent-red-400"
            />
            Incorrect
          </label>
          <button
            type="button"
            onClick={translateInApp}
            disabled={translation.loading}
            className="shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 px-2.5 py-1 text-xs font-semibold active:scale-95"
          >
            {translation.loading ? 'Đang dịch' : 'Dịch'}
          </button>
        </div>

        {(translation.loading || translation.text || translation.error) && (
          <div className="mt-2 mx-auto max-w-xl rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-left">
            <div className="text-cyan-100/60 text-[11px] font-semibold uppercase tracking-wide">Dịch tiếng Việt</div>
            {translation.loading && <div className="text-cyan-100/70 text-sm mt-0.5">Đang dịch trong app...</div>}
            {translation.text && <div className="text-cyan-50 text-base font-semibold leading-snug mt-0.5">{translation.text}</div>}
            {translation.error && <div className="text-red-200 text-sm mt-0.5">{translation.error}</div>}
          </div>
        )}

        {detailMeanings.length > 0 && (
          <div className={`${compact ? 'mt-1 px-2 py-1.5' : 'mt-3 px-3 py-2.5'} text-left bg-white/5 border border-white/10 rounded-xl`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white/45 text-xs font-semibold uppercase tracking-wide">Nghĩa & ví dụ</span>
              {detailMeanings.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsMeaningExpanded(prev => !prev)}
                  className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 text-white/70 flex items-center justify-center active:scale-95 transition-transform"
                  aria-label={isMeaningExpanded ? 'Thu gọn nghĩa và ví dụ' : 'Mở rộng nghĩa và ví dụ'}
                >
                  {isMeaningExpanded ? <Minus size={15} /> : <Plus size={15} />}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {visibleDetailMeanings.map((item, idx) => (
                <div key={`${word}-${item.pos}-${idx}`} className="min-w-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-emerald-300 border border-emerald-400/25 rounded px-1.5 py-0.5">{item.pos}</span>
                    <span className="text-white/85 text-sm leading-snug">{item.meaningVi}</span>
                  </div>
                  <div className="text-white/50 text-sm leading-snug">{item.exampleEn} · {item.exampleVi}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`flex flex-nowrap justify-start gap-1 overflow-x-auto pb-1 ${compact ? 'mt-1' : 'mt-4'}`}>
          {phonemes.map((p, idx) => {
            const r = result?.phonemes[idx]
            const hasScore = r && result?.spokenWord !== null
            const bg = hasScore ? scoreBg(r.score) : 'bg-white/5 border-white/10'
            const tc = hasScore ? scoreColor(r.score) : 'text-white/60'
            return (
              <button key={idx}
                onClick={() => { speakPhoneme(p.text, p.ipa, lang); if (hasScore) setSelectedIdx(selectedIdx === idx ? null : idx) }}
                className={`shrink-0 border rounded-xl ${compact ? 'px-2.5 py-1' : 'px-3 py-2'} flex flex-col items-center gap-0.5 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${bg} ${selectedIdx === idx ? 'ring-2 ring-white/40' : ''}`}
              >
                <span className="text-white font-semibold text-sm">{p.text}</span>
                <span className="text-white/45 font-mono text-sm">/{formatIpa(p)}/</span>
                {hasScore && <span className={`text-xs font-bold ${tc}`}>{r.score}%</span>}
                {p.isHard && !hasScore && <span className="text-yellow-400 text-xs">★</span>}
              </button>
            )
          })}
        </div>

        {sel && (
          <div className={`mt-3 mx-4 rounded-2xl p-3 border text-left ${scoreBg(sel.score)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-semibold">{sel.text} <span className="text-white/40 font-mono text-sm">/{sel.ipa}/</span></span>
              <div className="flex items-center gap-2">
                {sel.audioOffset !== null && (
                  <button onClick={() => playPhoneme(sel)}
                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 text-white/70 text-xs active:scale-95 transition-transform">
                    <Play size={11} className="fill-white/70 text-white/70" />
                    Bạn nói
                  </button>
                )}
                <span className={`font-bold ${scoreColor(sel.score)}`}>{sel.score}%</span>
              </div>
            </div>
            {sel.note && <p className="text-red-300 text-sm mb-1">{sel.note}</p>}
            <p className="text-white/70 text-sm">{sel.tip}</p>
          </div>
        )}
      </div>

      {/* Kết quả tổng */}
      {result && (() => {
        return (
          <div className="mx-4 mb-1 rounded-xl p-2 border bg-white/5 border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-sm">Kết quả:</span>
              <span className="text-white/40 text-sm">Từ: "{result.spokenWord || '—'}"</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${result.overall >= 85 ? 'bg-emerald-400' : result.overall >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${result.overall}%` }} />
              </div>
              <span className={`font-bold text-lg ${scoreColor(result.overall)}`}>{result.overall}%</span>
            </div>
            <p className={`text-sm mt-1 ${scoreColor(result.overall)}`}>{scoreLabel(result.overall)}</p>
            {!compact && <p className="text-white/40 text-xs mt-1">Nhấn vào từng âm để xem chi tiết</p>}
          </div>
        )
      })()}

      {/* Nút điều khiển */}
      <div className={`px-4 pb-4 mt-auto flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>

        {errorMsg && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-red-400 text-lg mt-0.5">⚠️</span>
            <p className="text-red-300 text-sm leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {!compact && lookupNote && phase === 'ready' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
            <p className="text-amber-200 text-sm leading-relaxed">{lookupNote}</p>
          </div>
        )}

        {isResolvingPhonemes && phase === 'ready' && (
          <div className="w-full rounded-2xl py-3 bg-white/5 border border-white/10 text-white/50 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Đang tìm IPA cho từ này...
          </div>
        )}

        {/* Nghe mẫu — trên cùng khi ready/recording */}
        {(phase === 'ready' || phase === 'recording') && (
          <button onClick={() => speakNeural(word, lang)} className={`w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
            <Volume2 size={18} />
            Nghe mẫu
          </button>
        )}

        {/* Scoring phase */}
        {phase === 'scoring' && (
          <>
            {recordingUrl && (
              <button onClick={playbackRecording}
                className={`w-full rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform border ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
                {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
                {isPlayingBack ? 'Dừng' : 'Nghe lại bản ghi'}
              </button>
            )}
            <div className="w-full rounded-2xl py-3 bg-white/5 border border-white/10 text-white/50 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Đang phân tích phát âm...
            </div>
            <button onClick={reset} className={`w-full bg-white/5 border border-white/10 text-white/50 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
              <RotateCcw size={18} />
              Thử lại
            </button>
          </>
        )}

        {/* Result phase */}
        {phase === 'result' && (
          <>
            {recordingUrl && (
              <button onClick={playbackRecording}
                className={`w-full rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform border ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
                {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
                {isPlayingBack ? 'Dừng' : 'Nghe lại'}
              </button>
            )}
            <button onClick={() => speakNeural(word, lang)} className={`w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
              <Volume2 size={16} />
              Nghe mẫu
            </button>
            <button onClick={resetAndRecord} className={`w-full bg-white/5 border border-white/10 text-white/50 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
              <RotateCcw size={18} />
              Thử lại
            </button>
          </>
        )}

        {/* Nút ghi âm lớn — luôn ở cuối cùng */}
        {phase === 'ready' && (
          <button onClick={startRecording} disabled={!canScoreWord || isResolvingPhonemes}
            className={`w-full rounded-2xl ${compact ? 'py-2 text-base' : 'py-6 text-xl'} flex items-center justify-center gap-3 font-bold transition-transform shadow-lg ${
              canScoreWord && !isResolvingPhonemes
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white active:scale-95 shadow-red-900/30'
                : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed shadow-none'
            }`}>
            <Mic size={28} />
            {isResolvingPhonemes ? 'Đang tìm IPA...' : canScoreWord ? `Ghi âm (${recordingDuration}s)` : 'Chưa thể chấm từ này'}
          </button>
        )}
        {phase === 'recording' && (
          <button onClick={stopRecording}
            className={`w-full bg-red-600/20 border-2 border-red-500/50 rounded-2xl ${compact ? 'py-2 text-base' : 'py-6'} flex items-center justify-center gap-3 text-red-400 active:scale-95 transition-transform`}>
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold text-xl">Đang ghi âm...</span>
            <span className="font-bold tabular-nums text-red-300 text-2xl">{countdown}s</span>
          </button>
        )}

        {learnedControl && (
          <button
            type="button"
            onClick={() => learnedControl.onToggle(result?.overall ?? null)}
            className={`w-full rounded-2xl ${compact ? 'py-2 text-base' : 'py-5 text-lg'} flex items-center justify-center gap-3 font-bold border transition-transform active:scale-95 ${learnedControl.checked ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200' : 'bg-white/5 border-white/10 text-white/75'}`}
          >
            <span className={`w-6 h-6 rounded-md border flex items-center justify-center ${learnedControl.checked ? 'bg-emerald-400 border-emerald-300 text-gray-950' : 'border-white/30 text-transparent'}`}>✓</span>
            Đã học
          </button>
        )}

        {navButtons}

        {/* Ô tìm kiếm — luôn hiển thị khi có callback */}
        {onSearchWord && !compact && (
          <form onSubmit={e => { e.preventDefault(); const w = searchVal.trim(); if (w) { onSearchWord(w); setSearchVal('') } }}
            className="flex gap-2 pt-1 border-t border-white/10 mt-1">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="Luyện từ khác..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25"
              />
            </div>
            <button type="submit"
              className="bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl px-4 text-sm font-semibold transition-colors active:scale-95">
              Tra
            </button>
          </form>
        )}

      </div>
    </div>
  )
}

// ─── SCREENS ──────────────────────────────────────────────────────────────

const LANG_CONFIG = {
  en: { label: '🇺🇸 EN', sounds: SOUNDS,        vowelGroups: VOWEL_GROUPS,          consonantGroups: CONSONANT_GROUPS,         azureCode: 'en-US', subtitle: '48 âm chuẩn tiếng Anh' },
  es: { label: '🇪🇸 ES', sounds: SPANISH_SOUNDS, vowelGroups: SPANISH_VOWEL_GROUPS,  consonantGroups: SPANISH_CONSONANT_GROUPS, azureCode: 'es-ES', subtitle: 'Tiếng Tây Ban Nha' },
  it: { label: '🇮🇹 IT', sounds: ITALIAN_SOUNDS, vowelGroups: ITALIAN_VOWEL_GROUPS,  consonantGroups: ITALIAN_CONSONANT_GROUPS, azureCode: 'it-IT', subtitle: 'Tiếng Ý' },
  fr: { label: '🇫🇷 FR', sounds: FRENCH_SOUNDS,  vowelGroups: FRENCH_VOWEL_GROUPS,   consonantGroups: FRENCH_CONSONANT_GROUPS,  azureCode: 'fr-FR', subtitle: 'Tiếng Pháp' },
}

function AzureUsageBadge() {
  const { used, total, pct, usedLabel } = getAzureUsageSummary()
  const color = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-emerald-400'
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">Azure</span>
          <span className={`text-xs font-semibold ${color}`}>{usedLabel} đã dùng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-[11px]">Tháng này</span>
          <span className="text-white/50 text-[11px]">{used.toFixed(2)}h / {total}h free</span>
        </div>
        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function SoundLibraryScreen({ lang, onSelectSound, onGoDict, onChangeLang }) {
  const [tab, setTab] = useState('vowels')
  const cfg = LANG_CONFIG[lang]
  const groups = tab === 'vowels' ? cfg.vowelGroups : cfg.consonantGroups
  const sounds = cfg.sounds.filter(s => tab === 'vowels' ? s.type === 'vowel' : s.type === 'consonant')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      {/* Header */}
      <div className="px-4 pt-10 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">Sound Library</h1>
            <p className="text-white/40 text-sm">{cfg.subtitle}</p>
          </div>
          <AzureUsageBadge />
        </div>
        {/* Language selector */}
        <div className="flex gap-2 mt-3">
          {Object.entries(LANG_CONFIG).map(([key, c]) => (
            <button key={key} onClick={() => { onChangeLang(key); setTab('vowels') }}
              className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-all ${lang === key ? 'bg-white text-gray-900' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vowel / Consonant tabs */}
      <div className="px-4 mb-4 flex gap-2">
        {['vowels','consonants'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-2xl font-semibold text-sm transition-all ${tab === t ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
            {t === 'vowels'
              ? `Nguyên Âm (${cfg.sounds.filter(s=>s.type==='vowel').length})`
              : `Phụ Âm (${cfg.sounds.filter(s=>s.type==='consonant').length})`}
          </button>
        ))}
      </div>

      {/* Sound groups */}
      {groups.map(g => {
        const groupSounds = sounds.filter(s => s.group === g.key)
        if (!groupSounds.length) return null
        return (
          <div key={g.key} className="mb-6">
            <div className="px-4 mb-3 flex items-center gap-2">
              <span className="text-white/80 font-semibold text-sm">{g.label}</span>
              <span className="text-white/30 text-xs">{groupSounds.length} âm</span>
            </div>
            <div className="px-4 grid grid-cols-4 gap-2">
              {groupSounds.map(s => (
                <button key={s.id} onClick={() => onSelectSound(s)}
                  className={`relative rounded-2xl p-3 flex flex-col items-center gap-1 bg-gradient-to-b ${s.grad} active:scale-95 transition-transform shadow-lg`}>
                  <span className="text-white font-bold text-base">{s.label}</span>
                  <span className="text-white/60 font-mono text-xs">/{s.ipa}/</span>
                  {s.hard && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full" />}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SoundDetailScreen({ sound, lang, onBack, onPracticeWord }) {
  const azureCode = LANG_CONFIG[lang]?.azureCode || 'en-US'
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      {/* Back */}
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">{sound.group}</span>
      </div>

      {/* Sound card */}
      <div className={`mx-4 rounded-3xl p-6 bg-gradient-to-br ${sound.grad} mb-6`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-5xl font-bold text-white">{sound.label}</div>
            <div className="text-white/70 font-mono text-xl">/{sound.ipa}/</div>
          </div>
          <button onClick={() => speakNeural(sound.words[0].word, azureCode)} className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center active:scale-95 transition-transform">
            <Volume2 size={26} className="text-white" />
          </button>
        </div>
        {sound.hard && <span className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-xs rounded-lg px-2 py-0.5">★ Khó với người Việt</span>}
        <div className="mt-4 bg-white/10 rounded-2xl p-3">
          <p className="text-white/90 text-sm leading-relaxed">{sound.tip}</p>
        </div>
      </div>

      {/* Learn more links (English only) */}
      {lang === 'en' && (
        <div className="px-4 mb-6">
          <div className="text-white/60 text-xs uppercase tracking-wider mb-3 font-semibold">Học thêm</div>
          <div className="flex flex-col gap-2">
            {RACHEL_URLS[sound.ipa] && (
              <a href={RACHEL_URLS[sound.ipa]} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors active:scale-98">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-rose-400 text-xs font-bold">RE</span>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white/80 text-sm font-medium">Rachel's English</div>
                  <div className="text-white/40 text-xs">Hướng dẫn chi tiết âm /{sound.ipa}/</div>
                </div>
                <ExternalLink size={14} className="text-white/30" />
              </a>
            )}
            <a href={rachelYouTubeSearch(sound.label)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 hover:bg-white/10 transition-colors active:scale-98">
              <div className="w-8 h-8 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0">
                <Play size={14} className="text-red-400 fill-red-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white/80 text-sm font-medium">YouTube — Rachel's English</div>
                <div className="text-white/40 text-xs">Video hướng dẫn âm {sound.label}</div>
              </div>
              <ExternalLink size={14} className="text-white/30" />
            </a>
          </div>
        </div>
      )}

      {/* Practice words */}
      <div className="px-4">
        <div className="text-white/60 text-xs uppercase tracking-wider mb-3 font-semibold">Luyện tập với từ</div>
        <div className="flex flex-col gap-3">
          {sound.words.map((w, idx) => (
            <button key={w.word} onClick={() => onPracticeWord(w, idx)}
              className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-4 active:scale-98 hover:bg-white/8 transition-all text-left">
              <span className="text-3xl">{w.emoji}</span>
              <div className="flex-1">
                <div className="text-white font-semibold">{w.word}</div>
                <div className="text-white/40 text-sm">{w.meaning}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); speakNeural(w.word, azureCode) }} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Volume2 size={14} className="text-white/60" />
                </button>
                <div className="text-white/20 text-lg">›</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PracticeWordScreen({ word, meaning, emoji, lang, prebuiltPhonemes, strictLookup = false, onBack, onNext, onPrev, onSearchWord }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">Luyện phát âm</span>
      </div>
      <PronunciationPractice key={word} word={word} meaning={meaning} emoji={emoji} lang={lang} prebuiltPhonemes={prebuiltPhonemes} strictLookup={strictLookup} onBack={onBack} onNext={onNext} onPrev={onPrev} onSearchWord={onSearchWord} />
    </div>
  )
}

const COMMON_3000_LEARNED_KEY = 'common3000LearnedWords'
const COMMON_3000_SCORES_KEY = 'common3000LearnedScores'

function loadLearnedCommonWords() {
  try {
    const raw = localStorage.getItem(COMMON_3000_LEARNED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveLearnedCommonWords(words) {
  localStorage.setItem(COMMON_3000_LEARNED_KEY, JSON.stringify([...words].sort()))
}

function loadCommonWordScores() {
  try {
    const raw = localStorage.getItem(COMMON_3000_SCORES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveCommonWordScores(scores) {
  localStorage.setItem(COMMON_3000_SCORES_KEY, JSON.stringify(scores))
}

function isUsefulWordMeaning(item) {
  const meaning = item?.meaningVi || ''
  const definition = item?.definitionEn || ''
  return Boolean(meaning)
    && !/^Một .+ tiếng Anh thông dụng\./i.test(meaning)
    && !/^Một .+ thông dụng trong tiếng Anh\./i.test(meaning)
    && !/^A common English /i.test(definition)
}

function getUsefulWordDetail(word) {
  const raw = COMMON_3000_DETAIL_MAP[word.toLowerCase()]
  if (!raw?.meanings?.length) return null
  const meanings = raw.meanings.filter(isUsefulWordMeaning)
  return meanings.length > 0 ? { ...raw, meanings } : null
}

function buildTranslateFallbackDetail(word) {
  return {
    word,
    level: null,
    meanings: [{
      pos: 'translate',
      definitionEn: '',
      meaningVi: 'Dịch tự động trong app để xem nghĩa tiếng Việt của từ này.',
      exampleEn: `Translate: ${word}`,
      exampleVi: 'App chưa có nghĩa/ví dụ đủ tốt cho từ này.',
    }],
  }
}

function DictionaryScreen({ onBack }) {
  const [query, setQuery] = useState('')
  const [commonQuery, setCommonQuery] = useState('')
  const [commonLevel, setCommonLevel] = useState('all')
  const [commonLearnedFilter, setCommonLearnedFilter] = useState('all')
  const [learnedCommonWords, setLearnedCommonWords] = useState(() => loadLearnedCommonWords())
  const [commonWordScores, setCommonWordScores] = useState(() => loadCommonWordScores())
  const [expandedCommonWords, setExpandedCommonWords] = useState(() => new Set())
  const [commonTranslations, setCommonTranslations] = useState({})
  const [recordingDurationSetting, setRecordingDurationSetting] = useState(() => {
    const saved = localStorage.getItem('recordingDuration')
    return saved ? parseInt(saved, 10) : 3
  })
  const [activeWord, setActiveWord] = useState(null)
  const inputRef = useRef(null)
  const openWord = (word, meta = {}) => {
    const w = word.trim().toLowerCase()
    const usefulDetail = meta.detail || getUsefulWordDetail(w)
    const fallbackDetail = usefulDetail || buildTranslateFallbackDetail(w)
    const firstMeaning = usefulDetail?.meanings?.[0]
    if (w) setActiveWord({
      word: w,
      meaning: meta.meaning || firstMeaning?.meaningVi || 'Dịch tự động trong app',
      emoji: meta.emoji || '📖',
      strictLookup: meta.strictLookup ?? true,
      source: meta.source || 'search',
      entry: meta.entry || null,
      detail: fallbackDetail,
      commonList: meta.commonList || null,
      commonIndex: meta.commonIndex ?? null,
    })
  }

  const handleSearch = (e) => {
    e.preventDefault()
    openWord(query)
  }

  const toggleCommonLearned = (word, score = null) => {
    const key = word.toLowerCase()
    setLearnedCommonWords(prev => {
      const next = new Set(prev)
      const willLearn = !next.has(key)
      if (willLearn) next.add(key)
      else next.delete(key)
      saveLearnedCommonWords(next)
      setCommonWordScores(prevScores => {
        const nextScores = { ...prevScores }
        if (willLearn && Number.isFinite(score)) {
          nextScores[key] = Math.round(score)
        } else if (!willLearn) {
          delete nextScores[key]
        }
        saveCommonWordScores(nextScores)
        return nextScores
      })
      return next
    })
  }

  const changeRecordingDurationSetting = (value) => {
    const next = Math.max(1, Math.min(10, value))
    setRecordingDurationSetting(next)
    localStorage.setItem('recordingDuration', next)
  }

  const toggleCommonDetail = (word) => {
    const key = word.toLowerCase()
    setExpandedCommonWords(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const translateCommonInList = async (word) => {
    const key = word.toLowerCase()
    setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: true, error: null } }))
    try {
      const text = await fetchVietnameseTranslation(word)
      setCommonTranslations(prev => ({ ...prev, [key]: { text, loading: false, error: null } }))
    } catch (err) {
      setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: false, error: err.message || 'Không dịch tự động được.' } }))
    }
  }

  const normalizedCommonQuery = commonQuery.trim().toLowerCase()
  const levelScopedCommonWords = COMMON_3000_WORDS.filter(entry => {
    const levelMatch = commonLevel === 'all' || entry.level === commonLevel
    const queryMatch = !normalizedCommonQuery || entry.word.toLowerCase().includes(normalizedCommonQuery)
    return levelMatch && queryMatch
  })
  const filteredCommonWords = levelScopedCommonWords.filter(entry => {
    const isLearned = learnedCommonWords.has(entry.word.toLowerCase())
    return commonLearnedFilter === 'all'
      || (commonLearnedFilter === 'learned' && isLearned)
      || (commonLearnedFilter === 'unlearned' && !isLearned)
  })
  const scopedLearnedCount = levelScopedCommonWords.filter(entry => learnedCommonWords.has(entry.word.toLowerCase())).length
  const scopedUnlearnedCount = Math.max(0, levelScopedCommonWords.length - scopedLearnedCount)

  if (activeWord) {
    const isCommonWord = activeWord.source === 'common'
    const isLearned = learnedCommonWords.has(activeWord.word)
    const commonList = activeWord.commonList || []
    const commonIndex = activeWord.commonIndex ?? -1
    const commonEntry = activeWord.entry || commonList[commonIndex] || null
    const commonDetail = activeWord.detail || getUsefulWordDetail(activeWord.word) || buildTranslateFallbackDetail(activeWord.word)
    const openCommonAt = (nextIndex) => {
      const nextEntry = commonList[nextIndex]
      if (!nextEntry) return
      const nextDetail = getUsefulWordDetail(nextEntry.word.toLowerCase()) || buildTranslateFallbackDetail(nextEntry.word)
      openWord(nextEntry.word, {
        meaning: nextDetail.meanings?.[0]?.meaningVi || `${nextEntry.level} · ${nextEntry.pos}`,
        emoji: '📚',
        strictLookup: true,
        source: 'common',
        entry: nextEntry,
        detail: nextDetail,
        commonList,
        commonIndex: nextIndex,
      })
    }
    const onPrevCommon = isCommonWord && commonIndex > 0 ? () => openCommonAt(commonIndex - 1) : null
    const onNextCommon = isCommonWord && commonIndex >= 0 && commonIndex < commonList.length - 1 ? () => openCommonAt(commonIndex + 1) : null

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
        <div className="px-4 pt-6 pb-2 flex items-center gap-3">
          <button onClick={() => setActiveWord(null)} className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70">
            <ChevronLeft size={20} />
          </button>
          <span className="text-white/50 text-sm">Từ điển phát âm</span>
        </div>
        <PronunciationPractice
          key={activeWord.word}
          word={activeWord.word}
          meaning={isCommonWord ? `${commonIndex + 1}/${commonList.length}${commonEntry ? ` · ${commonEntry.level} · ${commonEntry.pos}` : ''}` : activeWord.meaning}
          emoji={activeWord.emoji}
          strictLookup={activeWord.strictLookup}
          compact={isCommonWord}
          detail={commonDetail}
          learnedControl={isCommonWord ? {
            checked: isLearned,
            onToggle: (latestScore) => toggleCommonLearned(activeWord.word, latestScore),
          } : null}
          onBack={() => setActiveWord(null)}
          onPrev={onPrevCommon}
          onNext={onNextCommon}
          onSearchWord={openWord}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold text-white">Từ Điển Phát Âm</h1>
        <p className="text-white/40 text-sm">Nhập từ để chẩn đoán phát âm</p>
      </div>
      <form onSubmit={handleSearch} className="px-4 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nhập từ tiếng Anh..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-5 font-semibold transition-colors">
            Tra
          </button>
        </div>
      </form>

      <div className="px-4">
        <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-white/70 text-sm font-semibold">Setting</div>
              <div className="text-white/35 text-xs">Thời gian ghi âm</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => changeRecordingDurationSetting(recordingDurationSetting - 1)}
                className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 text-white/70 text-lg font-bold flex items-center justify-center active:scale-90">
                −
              </button>
              <span className="text-white/70 text-sm w-10 text-center">{recordingDurationSetting}s</span>
              <button onClick={() => changeRecordingDurationSetting(recordingDurationSetting + 1)}
                className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 text-white/70 text-lg font-bold flex items-center justify-center active:scale-90">
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-white font-semibold">3000 từ thông dụng</h2>
            <p className="text-white/40 text-xs">{COMMON_3000_WORDS.length} từ A1-B2 để luyện phát âm</p>
          </div>
          <div className="text-white/35 text-xs shrink-0">{filteredCommonWords.length} từ</div>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={commonQuery}
            onChange={e => setCommonQuery(e.target.value)}
            placeholder="Tìm trong 3000 từ..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3">
          <button
            onClick={() => setCommonLevel('all')}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLevel === 'all' ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            Tất cả
          </button>
          {COMMON_3000_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setCommonLevel(level)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLevel === level ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
            >
              {level} · {COMMON_3000_COUNTS[level]}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3">
          {[
            ['all', `Tất cả · ${levelScopedCommonWords.length}`],
            ['unlearned', `Chưa học · ${scopedUnlearnedCount}`],
            ['learned', `Đã học · ${scopedLearnedCount}`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCommonLearnedFilter(key)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLearnedFilter === key ? 'bg-emerald-400 text-gray-950 border-emerald-300' : 'bg-white/5 text-white/60 border-white/10'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {filteredCommonWords.map((entry, index) => {
            const key = entry.word.toLowerCase()
            const isLearned = learnedCommonWords.has(entry.word.toLowerCase())
            const savedScore = commonWordScores[entry.word.toLowerCase()]
            const detail = getUsefulWordDetail(entry.word) || buildTranslateFallbackDetail(entry.word)
            const firstMeaning = detail?.meanings?.[0]
            const isExpanded = expandedCommonWords.has(key)
            const hasDetails = detail?.meanings?.length > 0
            const needsListTranslation = detail?.meanings?.some(item => item.pos === 'translate')
            const listTranslation = commonTranslations[key]
            return (
            <div
              key={`${entry.level}-${entry.word}`}
              className={`min-w-0 border rounded-xl transition ${isLearned ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}
            >
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => openWord(entry.word, {
                meaning: firstMeaning?.meaningVi || `${entry.level} · ${entry.pos}`,
                emoji: '📚',
                    strictLookup: true,
                    source: 'common',
                    entry,
                    detail,
                    commonList: filteredCommonWords,
                    commonIndex: index,
                  })}
                  className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-white/10 active:scale-[0.98] transition rounded-l-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white text-sm font-medium">{entry.word}</span>
                    {isLearned && <span className="shrink-0 text-emerald-300 text-xs">✓</span>}
                    {Number.isFinite(savedScore) && (
                      <span className={`shrink-0 text-[10px] leading-none rounded px-1.5 py-1 border ${savedScore >= 85 ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10' : savedScore >= 65 ? 'text-yellow-200 border-yellow-400/30 bg-yellow-500/10' : 'text-red-200 border-red-400/30 bg-red-500/10'}`}>
                        {savedScore}%
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] leading-none text-white/50 border border-white/10 rounded px-1.5 py-1">{entry.level}</span>
                  </div>
                  <div className="text-white/35 text-xs mt-1">
                    {firstMeaning?.meaningVi || entry.pos}
                  </div>
                </button>
                {hasDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleCommonDetail(entry.word)
                      if (!isExpanded && needsListTranslation && !listTranslation?.text && !listTranslation?.loading) {
                        translateCommonInList(entry.word)
                      }
                    }}
                    className="w-12 shrink-0 border-l border-white/10 text-white/65 flex items-center justify-center rounded-r-xl hover:bg-white/10 active:scale-95 transition-transform"
                    aria-label={isExpanded ? 'Thu gọn nghĩa và ví dụ' : 'Mở rộng nghĩa và ví dụ'}
                  >
                    {isExpanded ? <Minus size={18} /> : <Plus size={18} />}
                  </button>
                )}
              </div>
              {isExpanded && hasDetails && (
                <div className="border-t border-white/10 px-3 py-2.5 flex flex-col gap-2">
                  {detail.meanings.map((item, itemIndex) => (
                    <div key={`${entry.word}-${item.pos}-${itemIndex}`} className="min-w-0">
                      {item.pos === 'translate' ? (
                        <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-2">
                          <div className="text-cyan-100/60 text-[10px] font-semibold uppercase tracking-wide">Dịch tiếng Việt</div>
                          {listTranslation?.loading && <div className="text-cyan-100/70 text-sm mt-0.5">Đang dịch trong app...</div>}
                          {listTranslation?.text && <div className="text-cyan-50 text-sm font-semibold leading-snug mt-0.5">{listTranslation.text}</div>}
                          {listTranslation?.error && <div className="text-red-200 text-xs mt-0.5">{listTranslation.error}</div>}
                          {!listTranslation?.loading && !listTranslation?.text && (
                            <button
                              type="button"
                              onClick={() => translateCommonInList(entry.word)}
                              className="mt-1 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 px-2 py-1 text-xs font-semibold active:scale-95"
                            >
                              Dịch trong app
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-emerald-300 border border-emerald-400/25 rounded px-1.5 py-0.5">{item.pos}</span>
                            <span className="text-white/85 text-sm leading-snug">{item.meaningVi}</span>
                          </div>
                          <div className="text-white/45 text-xs leading-snug mt-1">{item.exampleEn}</div>
                          <div className="text-white/35 text-xs leading-snug">{item.exampleVi}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          })}
        </div>

        {filteredCommonWords.length === 0 && (
          <div className="text-white/40 text-sm py-10 text-center">Không tìm thấy từ phù hợp.</div>
        )}
      </div>
    </div>
  )
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────

function BottomNav({ screen, onNavigate }) {
  const items = [
    { label: 'Trang Chủ',     icon: Home,     target: 'library',    active: screen === 'library' },
    { label: 'Sound Library', icon: Library,  target: 'library',    active: ['soundDetail', 'practiceWord'].includes(screen) },
    { label: 'Từ Điển',       icon: BookOpen, target: 'dictionary', active: screen === 'dictionary' },
  ]
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-white/10 flex z-40">
      {items.map(({ label, icon: Icon, target, active }) => (
        <button key={label} onClick={() => onNavigate(target)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
          <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
          <span className="text-xs">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('library')
  const [selectedSound, setSelectedSound] = useState(null)
  const [practiceWord, setPracticeWord] = useState(null)
  const [practiceWordIdx, setPracticeWordIdx] = useState(0)
  const [dictionaryScreenKey, setDictionaryScreenKey] = useState(0)
  const [lang, setLang] = useState('en')   // 'en' | 'es' | 'it'

  const azureCode = LANG_CONFIG[lang].azureCode

  const handleSelectSound = (sound) => { setSelectedSound(sound); setScreen('soundDetail') }
  const handlePracticeWord = (w, idx = 0) => { setPracticeWord(w); setPracticeWordIdx(idx); setScreen('practiceWord') }
  const handleNavigate = (s) => {
    setScreen(s)
    setSelectedSound(null)
    setPracticeWord(null)
    if (s === 'dictionary') setDictionaryScreenKey(prev => prev + 1)
  }
  const handleChangeLang = (l) => { setLang(l); setSelectedSound(null); setPracticeWord(null) }

  const soundWords = selectedSound?.words || []
  const onNextWord = practiceWordIdx < soundWords.length - 1
    ? () => { const i = practiceWordIdx + 1; setPracticeWord(soundWords[i]); setPracticeWordIdx(i) }
    : null
  const onPrevWord = practiceWordIdx > 0
    ? () => { const i = practiceWordIdx - 1; setPracticeWord(soundWords[i]); setPracticeWordIdx(i) }
    : null

  // Build prebuilt phonemes for Spanish/Italian words
  const phonemeInfoMap = lang === 'es' ? SPANISH_PHONEME_INFO : lang === 'it' ? ITALIAN_PHONEME_INFO : lang === 'fr' ? FRENCH_PHONEME_INFO : null
  const getWordPhonemes = (w) => {
    if (!phonemeInfoMap || !w?.phonemes) return null
    return buildPhonemes(w.phonemes, phonemeInfoMap)
  }

  return (
    <div className="max-w-md mx-auto bg-[#0f0f1a] min-h-screen relative">
      {screen === 'library' && (
        <SoundLibraryScreen lang={lang} onSelectSound={handleSelectSound} onGoDict={() => handleNavigate('dictionary')} onChangeLang={handleChangeLang} />
      )}
      {screen === 'soundDetail' && selectedSound && (
        <SoundDetailScreen sound={selectedSound} lang={lang} onBack={() => setScreen('library')} onPracticeWord={handlePracticeWord} />
      )}
      {screen === 'practiceWord' && practiceWord && (
        <PracticeWordScreen
          word={practiceWord.word}
          meaning={practiceWord.meaning}
          emoji={practiceWord.emoji}
          lang={azureCode}
          prebuiltPhonemes={getWordPhonemes(practiceWord)}
          onBack={() => setScreen('soundDetail')}
          onNext={onNextWord}
          onPrev={onPrevWord}
        />
      )}
      {screen === 'dictionary' && (
        <DictionaryScreen key={dictionaryScreenKey} onBack={() => handleNavigate('library')} />
      )}
      <BottomNav screen={screen} onNavigate={handleNavigate} />
    </div>
  )
}
