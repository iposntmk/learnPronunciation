import React, { Suspense, lazy, useState, useRef, useEffect, useCallback, useDeferredValue, useMemo } from 'react'
import { Mic, Volume2, Search, ChevronLeft, ChevronRight, BookOpen, Library, ExternalLink, Play, Square, Home, Plus, Minus, Settings, Shield, LogOut, Pencil } from 'lucide-react'
import {
  SOUNDS, VOWEL_GROUPS, CONSONANT_GROUPS,
  SPANISH_SOUNDS, SPANISH_VOWEL_GROUPS, SPANISH_CONSONANT_GROUPS, SPANISH_PHONEME_INFO,
  ITALIAN_SOUNDS, ITALIAN_VOWEL_GROUPS, ITALIAN_CONSONANT_GROUPS, ITALIAN_PHONEME_INFO,
  FRENCH_SOUNDS,  FRENCH_VOWEL_GROUPS,  FRENCH_CONSONANT_GROUPS,  FRENCH_PHONEME_INFO,
} from './data.js'
import { speakNeural, speakPhoneme } from './tts.js'
import AuthGate from './AuthGate.jsx'
import ScoreCircle from './components/common/ScoreCircle.jsx'
import AzureUsageBadge from './components/common/AzureUsageBadge.jsx'
import LevelCombobox from './components/common/LevelCombobox.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import SentenceLibraryScreen from './components/sentence/SentenceLibraryScreen.jsx'
import PracticeSentenceScreen from './components/sentence/PracticeSentenceScreen.jsx'
import { DICTIONARY_CACHE_KEY, DICTIONARY_CATEGORIES_CACHE_KEY, DICTIONARY_PAGE_SIZE, buildSupabaseWordDetail, buildTranslateFallbackDetail, dictionaryWordKey, isUsefulWordMeaning, loadDictionaryCache, practiceExampleForLanguage, saveDictionaryCache, searchDictionaryEntries, supabaseWordToEntry } from './utils/dictionaryHelpers.js'
import RecordingConsole from './components/practice/RecordingConsole.jsx'
import WordPhonemeGrid from './components/practice/WordPhonemeGrid.jsx'
import WordHeader from './components/practice/WordHeader.jsx'
import WordIpaPanel from './components/practice/WordIpaPanel.jsx'
import WordUsagePanel from './components/practice/WordUsagePanel.jsx'
import RootWordBadge from './components/practice/RootWordBadge.jsx'
import PracticeStatusMessages from './components/practice/PracticeStatusMessages.jsx'
import PracticeNavigationActions from './components/practice/PracticeNavigationActions.jsx'
import { scoreBg, scoreColor, scoreTextBg } from './utils/scoring/scoreUi.js'
import { formatIpa } from './utils/phonemes/phonemeFormat.js'
import { cleanPracticeWord } from './utils/words/wordNormalize.js'
import { DEFAULT_PRACTICE_SETTINGS } from './utils/storage/practiceSettingsStorage.js'
import { loadIncorrectWordReports, saveIncorrectWordReports } from './utils/storage/incorrectWordReportsStorage.js'
import { AZURE_TO_LANGUAGE, DICTIONARY_LANGUAGES, LANGUAGE_FLAG, LANGUAGE_LABEL, LANGUAGE_SHORT, LANGUAGE_TO_APP_LANG, LANGUAGE_TO_AZURE } from './utils/constants/languages.js'
import { usePracticeSettings } from './hooks/usePracticeSettings.js'
import { useProgress } from './hooks/useProgress.js'
import { useSentenceProgress } from './hooks/useSentenceProgress.js'
import { useWordPronunciation } from './hooks/useWordPronunciation.js'
import { useSentencePronunciation } from './hooks/useSentencePronunciation.js'
import { supabase } from './supabaseClient.js'
import { LEVELS, WORD_LANGUAGES, fetchAllWords, getWordByText, listCategories, listLevels, listSentenceTopics, listSentences, listWords, normalizeLanguage, updateWordIpa, updateWordStudyFields, upsertWord } from './supabaseData.js'

const AdminScreen = lazy(() => import('./AdminScreen.jsx'))

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

function splitSourceTextAcrossPhonemes(word, count) {
  const clean = String(word || '').trim()
  if (!clean || count <= 0) return []
  const chars = Array.from(clean)
  const spokenChars = chars.filter(ch => !/\s/.test(ch))
  if (spokenChars.length === count) {
    const chunks = []
    let pendingSpace = ''
    for (const ch of chars) {
      if (/\s/.test(ch)) {
        pendingSpace += ch
      } else {
        chunks.push(`${pendingSpace}${ch}`)
        pendingSpace = ''
      }
    }
    return chunks
  }
  return splitWordAcrossPhonemes(clean, count)
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

// ─── UI HELPERS ───────────────────────────────────────────────────────────


const GOOGLE_SOURCE_LANGUAGE = {
  english: 'en',
  spanish: 'es',
  italian: 'it',
  french: 'fr',
}

function googleTranslateApiUrl(text, language = 'english') {
  const source = GOOGLE_SOURCE_LANGUAGE[normalizeLanguage(language)] || 'en'
  return `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=vi&dt=t&q=${encodeURIComponent(text)}`
}

async function fetchVietnameseTranslation(text, language = 'english') {
  const resp = await fetch(googleTranslateApiUrl(text, language))
  if (!resp.ok) throw new Error('Không dịch tự động được.')
  const data = await resp.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0]).filter(Boolean).join('')
    : ''
  if (!translated) throw new Error('Không có kết quả dịch.')
  return translated
}

async function fetchJsonOrNull(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

function uniqueCleanList(values, blocked = []) {
  const blockedSet = new Set(blocked.map(value => String(value).toLowerCase()))
  const seen = new Set()
  return values
    .map(value => String(value || '').trim().toLowerCase())
    .filter(value => value && !blockedSet.has(value) && /^[a-z][a-z\s'-]*$/i.test(value))
    .filter(value => {
      if (seen.has(value)) return false
      seen.add(value)
      return true
    })
}

function deriveRootWord(word) {
  const value = String(word || '').trim().toLowerCase()
  if (!value || value.includes(' ')) return ''
  const rules = [
    [/ies$/, 'y'],
    [/ied$/, 'y'],
    [/ing$/, ''],
    [/ed$/, ''],
    [/ly$/, ''],
    [/es$/, ''],
    [/s$/, ''],
  ]
  for (const [pattern, replacement] of rules) {
    if (!pattern.test(value)) continue
    const root = value.replace(pattern, replacement)
    if (root.length >= 3 && root !== value) return root
  }
  return ''
}

function flattenDictionaryMeanings(entries) {
  return (Array.isArray(entries) ? entries : [])
    .flatMap(entry => entry?.meanings || [])
    .flatMap(meaning => (meaning?.definitions || []).map(definition => ({
      partOfSpeech: meaning.partOfSpeech || '',
      definition: definition.definition || '',
      example: definition.example || '',
      synonyms: [...(meaning.synonyms || []), ...(definition.synonyms || [])],
        antonyms: [...(meaning.antonyms || []), ...(definition.antonyms || [])],
    })))
}

function normalizePartOfSpeech(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'adjective' || text === 'adj') return 'adjective'
  if (text === 'adverb' || text === 'adv') return 'adverb'
  if (text === 'noun' || text === 'n') return 'noun'
  if (text === 'verb' || text === 'v') return 'verb'
  if (text === 'phrase' || text === 'idiom') return 'phrase'
  return text
}

function partOfSpeechMatches(actual, expected) {
  const a = normalizePartOfSpeech(actual)
  const e = normalizePartOfSpeech(expected)
  if (!e || e === 'other') return true
  if (e === 'phrase') return a === 'phrase' || a === 'idiom'
  return a === e
}

async function fetchWordStudyFields(word, type = 'other', language = 'english') {
  const normalized = String(word || '').trim().toLowerCase()
  if (!normalized) throw new Error('Word is required.')
  const sourceLanguage = normalizeLanguage(language)

  if (sourceLanguage !== 'english') {
    const vietnameseDefinition = await fetchVietnameseTranslation(normalized, sourceLanguage)
    return {
      vietnamese_definition: vietnameseDefinition,
      example_sentence: practiceExampleForLanguage(normalized, sourceLanguage),
      root_word: '',
      family_words: [],
      synonyms: [],
      antonyms: [],
      language: sourceLanguage,
    }
  }

  const [dictionaryResult, synonymResult, antonymResult] = await Promise.allSettled([
    fetchJsonOrNull(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`),
    fetchJsonOrNull(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(normalized)}&max=10`),
    fetchJsonOrNull(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(normalized)}&max=10`),
  ])
  const dictionaryEntries = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null
  const dictionaryMeanings = flattenDictionaryMeanings(dictionaryEntries)
  const typeMeanings = dictionaryMeanings.filter(item => partOfSpeechMatches(item.partOfSpeech, type))
  const scopedMeanings = typeMeanings.length ? typeMeanings : dictionaryMeanings
  const firstMeaning = scopedMeanings.find(item => item.definition) || null
  const example = scopedMeanings.find(item => item.example)?.example || `I can use "${normalized}" in a sentence.`
  const definitionText = firstMeaning?.definition || normalized

  let vietnameseDefinition = type === 'other'
    ? await fetchVietnameseTranslation(normalized, sourceLanguage)
    : ''
  if (!vietnameseDefinition || vietnameseDefinition.toLowerCase() === normalized) {
    vietnameseDefinition = await fetchVietnameseTranslation(definitionText, sourceLanguage)
  }

  const rootWord = deriveRootWord(normalized)
  const familyQuery = rootWord || normalized
  const familyResult = familyQuery
    ? await fetchJsonOrNull(`https://api.datamuse.com/words?sp=${encodeURIComponent(familyQuery)}*&max=12`)
    : null

  const synonyms = uniqueCleanList([
    ...scopedMeanings.flatMap(item => item.synonyms || []),
    ...((synonymResult.status === 'fulfilled' && Array.isArray(synonymResult.value)) ? synonymResult.value.map(item => item.word) : []),
  ], [normalized]).slice(0, 8)

  const antonyms = uniqueCleanList([
    ...scopedMeanings.flatMap(item => item.antonyms || []),
    ...((antonymResult.status === 'fulfilled' && Array.isArray(antonymResult.value)) ? antonymResult.value.map(item => item.word) : []),
  ], [normalized]).slice(0, 8)

  const familyWords = uniqueCleanList(
    Array.isArray(familyResult) ? familyResult.map(item => item.word) : [],
    [normalized, rootWord]
  ).slice(0, 8)

  return {
    vietnamese_definition: vietnameseDefinition,
    example_sentence: example,
    root_word: rootWord,
    family_words: familyWords,
    synonyms,
    antonyms,
    language: sourceLanguage,
  }
}

function uniqueList(items) {
  const seen = new Set()
  return items
    .map(item => String(item || '').trim())
    .filter(item => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const WORD_RELATION_OVERRIDES = {
  good: { family: ['goodness'], synonyms: ['great', 'fine', 'excellent'], antonyms: ['bad', 'poor'] },
  bad: { family: ['badly'], synonyms: ['poor', 'wrong'], antonyms: ['good', 'excellent'] },
  happy: { family: ['happiness', 'happily'], synonyms: ['glad', 'pleased'], antonyms: ['sad', 'unhappy'] },
  sad: { family: ['sadness', 'sadly'], synonyms: ['unhappy', 'upset'], antonyms: ['happy', 'glad'] },
  fast: { family: ['faster', 'fastest'], synonyms: ['quick', 'rapid'], antonyms: ['slow'] },
  slow: { family: ['slowly', 'slower'], synonyms: ['gradual'], antonyms: ['fast', 'quick'] },
  easy: { family: ['easily'], synonyms: ['simple'], antonyms: ['difficult', 'hard'] },
  difficult: { family: ['difficulty'], synonyms: ['hard', 'challenging'], antonyms: ['easy', 'simple'] },
  big: { family: ['bigger', 'biggest'], synonyms: ['large', 'great'], antonyms: ['small', 'little'] },
  small: { family: ['smaller', 'smallest'], synonyms: ['little', 'tiny'], antonyms: ['big', 'large'] },
  hot: { family: ['heat', 'heated'], synonyms: ['warm'], antonyms: ['cold', 'cool'] },
  cold: { family: ['coldly'], synonyms: ['cool', 'chilly'], antonyms: ['hot', 'warm'] },
  clear: { family: ['clearly', 'clarity'], synonyms: ['obvious', 'clean'], antonyms: ['unclear', 'confusing'] },
  speak: { family: ['speaker', 'speaking', 'speech'], synonyms: ['say', 'talk'], antonyms: ['listen', 'silence'] },
  learn: { family: ['learner', 'learning', 'learned'], synonyms: ['study', 'practice'], antonyms: ['forget'] },
  correct: { family: ['correction', 'correctly'], synonyms: ['right', 'accurate'], antonyms: ['wrong', 'incorrect'] },
  wrong: { family: ['wrongly'], synonyms: ['incorrect'], antonyms: ['right', 'correct'] },
  start: { family: ['starter', 'starting'], synonyms: ['begin'], antonyms: ['finish', 'end'] },
  finish: { family: ['finished'], synonyms: ['end', 'complete'], antonyms: ['start', 'begin'] },
}

const WORD_STRUCTURE_OVERRIDES = {
  access: [
    'access to sth',
    'have/get/gain access to sth',
    'provide/give access to sth',
    'access a file/database/system/account',
  ],
  suppose: [
    'be supposed to do sth',
    'suppose that + clause',
    'I suppose so / I suppose not',
  ],
  supposed: [
    'be supposed to do sth',
    'be supposed to be + adj/noun',
    'not be supposed to do sth',
  ],
  speak: [
    'speak to sb',
    'speak with sb',
    'speak about sth',
    'speak English clearly',
  ],
  listen: [
    'listen to sb/sth',
    'listen for sth',
    'listen carefully',
  ],
  look: [
    'look at sb/sth',
    'look for sb/sth',
    'look like sb/sth',
  ],
  depend: [
    'depend on sb/sth',
    'depend on sb to do sth',
  ],
  interested: [
    'be interested in sth',
    'be interested in doing sth',
  ],
  good: [
    'be good at sth/doing sth',
    'be good for sb/sth',
    'be good to sb',
  ],
  afraid: [
    'be afraid of sb/sth',
    'be afraid to do sth',
    'be afraid that + clause',
  ],
}

function baseWordForms(word) {
  const key = word.toLowerCase().trim()
  const forms = new Set([key])
  if (key.endsWith('ing') && key.length > 5) forms.add(key.slice(0, -3))
  if (key.endsWith('ed') && key.length > 4) forms.add(key.slice(0, -2))
  if (key.endsWith('ly') && key.length > 4) forms.add(key.slice(0, -2))
  if (key.endsWith('ness') && key.length > 6) forms.add(key.slice(0, -4))
  if (key.endsWith('s') && key.length > 3) forms.add(key.slice(0, -1))
  return [...forms]
}

function buildWordRelations(word, detail = null) {
  const key = word.toLowerCase().trim()
  const override = WORD_RELATION_OVERRIDES[key] || {}
  const detailRelations = detail?.relations || {}

  const explicitRoot = String(detailRelations.rootWord || '').trim().toLowerCase()
  const derivedRoot = explicitRoot || deriveRootWord(key)
  const rootWord = derivedRoot && derivedRoot !== key ? derivedRoot : ''

  return {
    rootWord,
    family: uniqueList([...(detailRelations.family || []), ...(override.family || [])]).slice(0, 8),
    synonyms: uniqueList([...(detailRelations.synonyms || []), ...(override.synonyms || [])]).slice(0, 8),
    antonyms: uniqueList([...(detailRelations.antonyms || []), ...(override.antonyms || [])]).slice(0, 8),
  }
}

function looksLikeIpaForScoring(raw, language = 'english') {
  const value = String(raw || '').trim()
  if (!value) return false
  if (normalizeLanguage(language) !== 'english') return true
  return /[əɪɛæʌʊɑɒɔɜθðʃʒŋˈː]/.test(value) || value.includes('´') || value.includes('’') || value.includes('з')
}

function normalizeSupabaseIpa(raw) {
  return String(raw || '')
    .trim()
    .replace(/\u00C2\u00B4/g, 'ˈ')
    .replace(/\u00B4/g, 'ˈ')
    .replace(/[’']/g, 'ˈ')
    .replace(/з/g, 'ə')
}

function phonemeInfoForLanguage(language) {
  switch (language) {
    case 'spanish': return SPANISH_PHONEME_INFO
    case 'italian': return ITALIAN_PHONEME_INFO
    case 'french': return FRENCH_PHONEME_INFO
    default: return PHONEME_INFO
  }
}

function phonemesFromSupabaseIpa(rawIpa, language = 'english', word = '') {
  if (!looksLikeIpaForScoring(rawIpa, language)) return null
  const normalized = normalizeSupabaseIpa(rawIpa)
  const tokens = tokenizeExternalIpa(normalized)
  const ipaParts = tokens.map(t => t.ipa).filter(Boolean)
  if (ipaParts.length < 2) return null
  const info = phonemeInfoForLanguage(language)
  const chunks = word ? splitSourceTextAcrossPhonemes(word, ipaParts.length) : []
  return ipaParts.map((ipa, index) => ({
    text: chunks[index] || ipa,
    ipa,
    tip: info[ipa]?.tip || PHONEME_INFO[ipa]?.tip || `Âm /${ipa}/`,
    isHard: info[ipa]?.hard ?? PHONEME_INFO[ipa]?.hard ?? false,
    isStressed: Boolean(tokens[index]?.isStressed),
    canScore: true,
    lookupNote: null,
    audioOffset: null,
    audioDuration: null,
  }))
}

function buildWordStructures(word) {
  const key = word.toLowerCase().trim()
  const forms = baseWordForms(key)
  return uniqueList(forms.flatMap(form => WORD_STRUCTURE_OVERRIDES[form] || [])).slice(0, 6)
}

// ─── PRONUNCIATION PRACTICE (shared) ─────────────────────────────────────


function PronunciationPractice({
  word,
  meaning,
  metaLine = null,
  lang = 'en-US',
  prebuiltPhonemes = null,
  strictLookup = false,
  compact = false,
  learnedControl = null,
  detail = null,
  source = null,
  onBack,
  onHome = null,
  onLibrary = null,
  onDictionary = null,
  onNext = null,
  onPrev = null,
  onSearchWord = null,
  onScoreResult = null,
  onRefreshMeaning = null,
  practiceSettings = DEFAULT_PRACTICE_SETTINGS,
  recordingDurationSetting = null,
}) {
  const [phonemes, setPhonemes] = useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: !strictLookup }))
  const [isResolvingPhonemes, setIsResolvingPhonemes] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ loading: false, error: null, saved: false })
  const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(false)
  const hasUnverifiedIpa = phonemes.some(p => p.canScore === false && p.ipa && p.ipa !== '?')
  const canScoreWord = phonemes.length > 0 && phonemes.every(p => (p.canScore !== false || useGuessedIpaForScore) && p.ipa && p.ipa !== '?')
  const lookupNote = phonemes.find(p => p.lookupNote)?.lookupNote || null
  // phases: ready → recording → scoring → result
  const [searchVal, setSearchVal] = useState('')
  const [isUsageExpanded, setIsUsageExpanded] = useState(false)
  const [incorrectReports, setIncorrectReports] = useState(() => loadIncorrectWordReports())
  const [translation, setTranslation] = useState({ word: '', text: '', loading: false, error: null })
  const [meaningRefresh, setMeaningRefresh] = useState({ loading: false, error: null, text: '' })
  const [dictionaryIpa, setDictionaryIpa] = useState('')
  const [ipaSaveStatus, setIpaSaveStatus] = useState({ loading: false, error: null, savedIpa: '' })
  const [recordingDuration, setRecordingDuration] = useState(() => {
    const saved = localStorage.getItem('recordingDuration')
    return saved ? parseInt(saved, 10) : 3
  })
  const {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    phase,
    errorMsg,
    result,
    selectedIdx,
    setSelectedIdx,
    startRecording,
    stopRecording,
    reset,
    resetAndRecord,
    playbackRecording,
    playPhoneme,
  } = useWordPronunciation({
    phonemes,
    lang,
    recordingDuration,
    canScoreWord,
    isResolvingPhonemes,
    lookupNote,
    onScoreResult,
  })
  const practiceLanguage = normalizeLanguage(AZURE_TO_LANGUAGE[lang] || 'english')
  const showRefreshMeaningAction = practiceSettings.showRefreshMeaningAction !== false
  const showIncorrectAction = practiceSettings.showIncorrectAction !== false
  const showTranslateAction = practiceSettings.showTranslateAction !== false

  useEffect(() => {
    if (Number.isFinite(recordingDurationSetting)) {
      setRecordingDuration(recordingDurationSetting)
    }
  }, [recordingDurationSetting])

  useEffect(() => {
    setIsUsageExpanded(Boolean(practiceSettings.autoExpandUsage))
    setTranslation({ word, text: '', loading: false, error: null })
    setMeaningRefresh({ loading: false, error: null, text: '' })
    setDictionaryIpa('')
    setIpaSaveStatus({ loading: false, error: null, savedIpa: '' })
    setUseGuessedIpaForScore(false)
  }, [practiceSettings.autoExpandUsage, word])

  useEffect(() => {
    let cancelled = false
    const key = String(word || '').trim().toLowerCase()
    const practiceLang = normalizeLanguage(AZURE_TO_LANGUAGE[lang] || 'english')
    if (!key || practiceLang !== 'english' || key.includes(' ')) return
    fetchJsonOrNull(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
      .then(entries => {
        if (cancelled) return
        const phonetics = Array.isArray(entries) ? entries.flatMap(e => e?.phonetics || []) : []
        const text = entries?.[0]?.phonetic || phonetics.find(p => p?.text)?.text || ''
        const clean = String(text || '').trim().replace(/^\/|\/$/g, '')
        if (clean) setDictionaryIpa(clean)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [word, lang])

  // No slow-motion score animation.

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

  const sel = selectedIdx !== null && result ? result.phonemes[selectedIdx] : null
  const hasNav = onPrev !== null || onNext !== null
  const detailMeanings = detail?.meanings || []
  const usageMeanings = detailMeanings.filter(item => item.pos !== 'translate')
  const needsMachineTranslation = detailMeanings.length === 0 || detailMeanings.some(item => item.pos === 'translate')
  const wordRelations = buildWordRelations(word, detail)
  const wordStructures = buildWordStructures(word)
  const wordReportKey = `${practiceLanguage}:${word.toLowerCase()}`
  const isReportedIncorrect = Boolean(incorrectReports[wordReportKey])
  const toggleIncorrectReport = () => {
    setIncorrectReports(prev => {
      const next = { ...prev }
      if (next[wordReportKey]) {
        delete next[wordReportKey]
      } else {
        next[wordReportKey] = {
          word,
          lang: practiceLanguage,
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
      const text = await fetchVietnameseTranslation(word, practiceLanguage)
      setTranslation({ word, text, loading: false, error: null })
    } catch (err) {
      setTranslation({ word, text: '', loading: false, error: err.message || 'Không dịch tự động được.' })
    }
  }, [practiceLanguage, word])

  const refreshMeaningFromWeb = useCallback(async () => {
    if (!onRefreshMeaning) return
    setMeaningRefresh({ loading: true, error: null, text: '' })
    try {
      const text = await onRefreshMeaning(word, practiceLanguage)
      setMeaningRefresh({ loading: false, error: null, text })
    } catch (err) {
      setMeaningRefresh({ loading: false, error: err.message || 'Không cập nhật nghĩa được.', text: '' })
    }
  }, [onRefreshMeaning, practiceLanguage, word])

  useEffect(() => {
    if (practiceSettings.readNewWordAloud) {
      const timer = setTimeout(() => speakNeural(word, lang), 250)
      return () => clearTimeout(timer)
    }
  }, [lang, practiceSettings.readNewWordAloud, word])

  const playModel = useCallback(() => {
    speakNeural(word, lang)
  }, [lang, word])

  const toggleLearnedControl = useCallback(() => {
    if (!learnedControl) return
    learnedControl.onToggle(result?.overall ?? null)
  }, [learnedControl, result])

  const azureIpa = result?.azureIpa || ''
  const canSaveAzureIpa = Boolean(azureIpa) && ipaSaveStatus.savedIpa !== azureIpa

  const saveAzureIpaToDb = async () => {
    if (!azureIpa) return
    setIpaSaveStatus({ loading: true, error: null, savedIpa: '' })
    try {
      await updateWordIpa(word, azureIpa, practiceLanguage)
      setIpaSaveStatus({ loading: false, error: null, savedIpa: azureIpa })
    } catch (err) {
      setIpaSaveStatus({ loading: false, error: err.message || 'Lỗi khi lưu IPA.', savedIpa: '' })
    }
  }

  const saveWordToDb = async () => {
    setSaveStatus({ loading: true, error: null, saved: false })
    try {
      let finalMeaning = meaning
      if (!finalMeaning || finalMeaning === 'Google Translate available' || finalMeaning === 'Search result (not in DB)') {
        finalMeaning = await fetchVietnameseTranslation(word, practiceLanguage)
      }
      const ipa = phonemes.map(formatIpa).join('')
      await upsertWord({
        word,
        vietnamese_definition: finalMeaning,
        ipa,
        language: practiceLanguage,
        source: 'user_search'
      })
      setSaveStatus({ loading: false, error: null, saved: true })
    } catch (err) {
      setSaveStatus({ loading: false, error: err.message || 'Lỗi khi lưu từ.', saved: false })
    }
  }

  useEffect(() => {
    if (showTranslateAction && (needsMachineTranslation || practiceSettings.autoTranslateOnLoad)) translateInApp()
  }, [needsMachineTranslation, practiceSettings.autoTranslateOnLoad, showTranslateAction, translateInApp])

  const navButtons = hasNav ? (
    <div className="flex flex-col gap-2.5 pt-1">
      <button onClick={onPrev} disabled={!onPrev} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onPrev ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>‹ Back</button>
      <button onClick={onNext} disabled={!onNext} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onNext ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>Next ›</button>
    </div>
  ) : null

  return (
    <div className={`flex flex-col ${compact ? 'h-full pb-52' : 'min-h-screen pb-64'}`}>
      <audio ref={audioRef} className="hidden" />

      {/* Tiêu đề từ + IPA breakdown */}
      <div className={`text-center px-4 ${compact ? 'py-1' : 'py-6'}`}>
        <WordHeader
          word={word}
          meaning={meaning}
          metaLine={metaLine}
          compact={compact}
          practiceLanguage={practiceLanguage}
          languageFlag={LANGUAGE_FLAG[practiceLanguage]}
          result={result}
          playModel={playModel}
          showRefreshMeaningAction={showRefreshMeaningAction}
          onRefreshMeaning={onRefreshMeaning}
          refreshMeaningFromWeb={refreshMeaningFromWeb}
          meaningRefresh={meaningRefresh}
          source={source}
          saveWordToDb={saveWordToDb}
          saveStatus={saveStatus}
        />
        <RootWordBadge rootWord={wordRelations.rootWord} currentWord={word} onSearchWord={onSearchWord} />
        <WordIpaPanel
          compact={compact}
          phonemes={phonemes}
          hasUnverifiedIpa={hasUnverifiedIpa}
          phase={phase}
          useGuessedIpaForScore={useGuessedIpaForScore}
          setUseGuessedIpaForScore={setUseGuessedIpaForScore}
          showIncorrectAction={showIncorrectAction}
          isReportedIncorrect={isReportedIncorrect}
          toggleIncorrectReport={toggleIncorrectReport}
          showTranslateAction={showTranslateAction}
          translateInApp={translateInApp}
          translation={translation}
          dictionaryIpa={dictionaryIpa}
          azureIpa={azureIpa}
          saveAzureIpaToDb={saveAzureIpaToDb}
          ipaSaveStatus={ipaSaveStatus}
          canSaveAzureIpa={canSaveAzureIpa}
        />
        <WordUsagePanel
          compact={compact}
          word={word}
          usageMeanings={usageMeanings}
          isUsageExpanded={isUsageExpanded}
          setIsUsageExpanded={setIsUsageExpanded}
          wordStructures={wordStructures}
          wordRelations={wordRelations}
        />
        <WordPhonemeGrid
          phonemes={phonemes}
          result={result}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          compact={compact}
          lang={lang}
          selectedPhoneme={sel}
          playPhoneme={playPhoneme}
        />
      </div>

      {/* Kết quả tổng */}
      {result && !compact && <p className="mx-4 mb-1 text-center text-white/40 text-xs">Tap each sound for details</p>}

        {/* Nút điều khiển */}
      <PracticeStatusMessages
        compact={compact}
        errorMsg={errorMsg}
        lookupNote={lookupNote}
        phase={phase}
        isResolvingPhonemes={isResolvingPhonemes}
      />

      <PracticeNavigationActions
        compact={compact}
        learnedControl={learnedControl}
        onToggleLearned={toggleLearnedControl}
        navButtons={navButtons}
        onDictionary={onDictionary}
        onSearchWord={onSearchWord}
        searchVal={searchVal}
        setSearchVal={setSearchVal}
      />
      <RecordingConsole
        compact={compact}
        phase={phase}
        playModel={playModel}
        recordingUrl={recordingUrl}
        playbackRecording={playbackRecording}
        isPlayingBack={isPlayingBack}
        reset={reset}
        resetAndRecord={resetAndRecord}
        source={source}
        onBack={onBack}
        startRecording={startRecording}
        canScoreWord={canScoreWord}
        isResolvingPhonemes={isResolvingPhonemes}
        recordingDuration={recordingDuration}
        countdown={countdown}
        stopRecording={stopRecording}
      />
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

function PracticeWordScreen({ word, meaning, lang, prebuiltPhonemes, strictLookup = false, detail = null, source = null, onBack, onHome, onLibrary, onDictionary, onNext, onPrev, onSearchWord, onScoreResult, practiceSettings, recordingDurationSetting }) {
  const [supabaseDetail, setSupabaseDetail] = useState(null)
  const [supabaseMeaning, setSupabaseMeaning] = useState(null)
  const [supabasePhonemes, setSupabasePhonemes] = useState(null)
  const [supabaseLanguage, setSupabaseLanguage] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSupabaseDetail(null)
    setSupabaseMeaning(null)
    setSupabasePhonemes(null)
    setSupabaseLanguage(null)
    const uiLanguage = AZURE_TO_LANGUAGE[lang] || null
    getWordByText(word, uiLanguage)
      .then(row => {
        if (cancelled || !row) return
        const entry = supabaseWordToEntry(row)
        const nextDetail = buildSupabaseWordDetail(entry)
        const nextMeaning = row.vietnamese_definition || null
        const nextLanguage = normalizeLanguage(row.language)
        const nextPhonemes = row.ipa ? phonemesFromSupabaseIpa(row.ipa, nextLanguage, row.word || word) : null
        if (nextMeaning || row.ipa) {
          setSupabaseDetail(nextDetail)
          setSupabaseMeaning(nextMeaning)
          setSupabasePhonemes(nextPhonemes)
          setSupabaseLanguage(nextLanguage)
        }
      })
      .catch(err => console.warn('[Supabase] word fetch failed:', err.message))
    return () => { cancelled = true }
  }, [word, lang])

  const effectiveLanguage = normalizeLanguage(supabaseLanguage || detail?.language || AZURE_TO_LANGUAGE[lang] || 'english')
  const effectiveMeaning = supabaseMeaning || meaning
  const practiceDetail = supabaseDetail || detail || buildTranslateFallbackDetail(word, effectiveMeaning, effectiveLanguage)
  const effectivePhonemes = supabasePhonemes || prebuiltPhonemes
  const effectiveLang = LANGUAGE_TO_AZURE[effectiveLanguage] || lang
  const effectiveSource = source || (supabaseDetail || supabaseMeaning ? 'common' : 'external')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">Pronunciation Practice</span>
      </div>
      <PronunciationPractice key={`${word}:${effectiveLang}`} word={word} meaning={effectiveMeaning} lang={effectiveLang} prebuiltPhonemes={effectivePhonemes} strictLookup={strictLookup} detail={practiceDetail} source={effectiveSource} onBack={onBack} onHome={onHome} onLibrary={onLibrary} onDictionary={onDictionary} onNext={onNext} onPrev={onPrev} onSearchWord={onSearchWord} onScoreResult={(result) => onScoreResult?.(result, { language: effectiveLanguage, azureLanguage: effectiveLang })} practiceSettings={practiceSettings} recordingDurationSetting={recordingDurationSetting} />
    </div>
  )
}

function DictionaryScreen({ onBack, practiceSettings, recordingDurationSetting, learnedCommonWords, commonWordScores, onToggleCommonLearned, onPronunciationResult }) {
  const [query, setQuery] = useState('')
  const [commonQuery, setCommonQuery] = useState('')
  const deferredCommonQuery = useDeferredValue(commonQuery)
  const [commonLevel, setCommonLevel] = useState('all')
  const [commonCategory, setCommonCategory] = useState('all')
  const [commonLanguage, setCommonLanguage] = useState('all')
  const [searchLanguages, setSearchLanguages] = useState(['english'])
  const [commonLearnedFilter, setCommonLearnedFilter] = useState('all')
  const [supabaseWords, setSupabaseWords] = useState([])
  const [supabaseCategories, setSupabaseCategories] = useState([])
  const [supabaseLevels, setSupabaseLevels] = useState(LEVELS)
  const [dictionaryCacheLoaded, setDictionaryCacheLoaded] = useState(false)
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false)
  const [dictionaryCachedAt, setDictionaryCachedAt] = useState(null)
  const [visibleCommonLimit, setVisibleCommonLimit] = useState(DICTIONARY_PAGE_SIZE)
  const [supabaseLoading, setSupabaseLoading] = useState(true)
  const [supabaseError, setSupabaseError] = useState(null)
  const learnedWords = learnedCommonWords || loadLearnedCommonWords()
  const wordScores = commonWordScores || loadCommonWordScores()
  const [expandedCommonWords, setExpandedCommonWords] = useState(() => new Set())
  const [commonTranslations, setCommonTranslations] = useState({})
  const [meaningUpdates, setMeaningUpdates] = useState({})
  const [activeWord, setActiveWord] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const inputRef = useRef(null)
  const showRefreshMeaningAction = practiceSettings.showRefreshMeaningAction !== false
  const showDictionarySearch = practiceSettings.showDictionarySubtitle !== false
  const refreshDictionary = useCallback(async ({ shouldApply = () => true } = {}) => {
    setSupabaseLoading(true)
    setSupabaseError(null)
    try {
      const [rows, categories] = await Promise.all([fetchAllWords(), listCategories()])
      if (!shouldApply()) return
      const entries = rows.map(supabaseWordToEntry)
      const stamp = new Date().toISOString()
      setSupabaseWords(entries)
      setSupabaseCategories(categories)
      setDictionaryCachedAt(stamp)
      setDictionaryLoaded(true)
      saveDictionaryCache(DICTIONARY_CACHE_KEY, entries)
      saveDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY, categories)
    } catch (err) {
      if (shouldApply()) setSupabaseError(err.message)
    } finally {
      if (shouldApply()) setSupabaseLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => {
      const wordCache = loadDictionaryCache(DICTIONARY_CACHE_KEY)
      const categoryCache = loadDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY)
      if (cancelled) return
      if (wordCache?.items) {
        setSupabaseWords(wordCache.items)
        setDictionaryCachedAt(wordCache.updatedAt || null)
        setDictionaryLoaded(true)
        setSupabaseLoading(false)
      }
      if (categoryCache?.items) setSupabaseCategories(categoryCache.items)
      setDictionaryCacheLoaded(true)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [])
  useEffect(() => {
    if (!dictionaryCacheLoaded) return
    let cancelled = false
    refreshDictionary({ shouldApply: () => !cancelled })
    return () => {
      cancelled = true
    }
  }, [dictionaryCacheLoaded, refreshDictionary])

  useEffect(() => {
    setVisibleCommonLimit(DICTIONARY_PAGE_SIZE)
  }, [commonCategory, deferredCommonQuery, commonLanguage, commonLearnedFilter, commonLevel, supabaseWords])

  useEffect(() => {
    if (!dictionaryCacheLoaded || supabaseCategories.length > 0) return
    let cancelled = false
    listCategories()
      .then(categories => {
        if (cancelled) return
        setSupabaseCategories(categories)
        saveDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY, categories)
      })
      .catch(err => {
        if (!cancelled) setSupabaseError(err.message)
      })
    return () => { cancelled = true }
  }, [dictionaryCacheLoaded, supabaseCategories.length])

  useEffect(() => {
    let cancelled = false
    listLevels()
      .then(rows => {
        if (cancelled) return
        const codes = rows.map(r => r.code)
        if (codes.length > 0) setSupabaseLevels(codes)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const openWord = (word, meta = {}) => {
    const w = word.trim().toLowerCase()
    const initialLanguage = normalizeLanguage(
      meta.language || meta.entry?.language || meta.detail?.language || (commonLanguage !== 'all' ? commonLanguage : 'english')
    )
    const fallbackDetail = meta.detail || buildTranslateFallbackDetail(w, meta.meaning, initialLanguage)
    const firstMeaning = fallbackDetail?.meanings?.find(item => item.pos !== 'translate')
    if (!w) return
    setActiveWord({
      word: w,
      meaning: meta.meaning || firstMeaning?.meaningVi || 'Google Translate available',
      strictLookup: meta.strictLookup ?? true,
      source: meta.source || 'search',
      entry: meta.entry || null,
      detail: fallbackDetail,
      language: initialLanguage,
      commonList: meta.commonList || null,
      commonIndex: meta.commonIndex ?? null,
    })
    if (!meta.entry && !meta.detail) {
      getWordByText(w, commonLanguage !== 'all' ? commonLanguage : null)
        .then(row => {
          if (!row) return
          const entry = supabaseWordToEntry(row)
          const detail = buildSupabaseWordDetail(entry)
          const meaning = detail.meanings?.[0]?.meaningVi || entry.meaningVi || 'Google Translate available'
          setActiveWord(prev => {
            if (!prev || prev.word !== w) return prev
            return {
              ...prev,
              word: entry.word,
              meaning,
              strictLookup: true,
              source: 'common',
              entry,
              detail,
              language: normalizeLanguage(entry.language),
              commonList: [entry],
              commonIndex: 0,
            }
          })
        })
        .catch(err => setSupabaseError(err.message))
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    setSupabaseError(null)
    setSearchResult(null)

    const langsToSearch = searchLanguages.length > 0 ? searchLanguages : ['english']
    
    for (const lang of langsToSearch) {
      const localMatch = searchDictionaryEntries(supabaseWords, term, lang)[0]
      if (localMatch) {
        setSearchResult({
          word: localMatch.word,
          meaning: localMatch.meaningVi,
          language: lang,
          source: 'common',
          entry: localMatch
        })
        return
      }
    }

    try {
      setSupabaseLoading(true)
      for (const lang of langsToSearch) {
        const rows = await listWords({ query: term, language: lang, limit: 1 })
        const entry = rows[0] ? supabaseWordToEntry(rows[0]) : null
        if (entry) {
          setSearchResult({
            word: entry.word,
            meaning: entry.meaningVi,
            language: lang,
            source: 'common',
            entry: entry
          })
          return
        }
      }

      const firstLang = langsToSearch[0]
      setSearchResult({
        word: term,
        meaning: 'Chưa có trong từ điển',
        language: firstLang,
        source: 'external'
      })
    } catch (err) {
      setSupabaseError(err.message)
    } finally {
      setSupabaseLoading(false)
    }
  }

  const toggleCommonLearned = (word, score = null, language = 'english') => {
    const key = word.toLowerCase()
    const willLearn = !learnedWords.has(key)
    onToggleCommonLearned?.(word, willLearn, score, { language })
  }

  const toggleCommonDetail = (word, language = 'english') => {
    const key = dictionaryWordKey(word, language)
    setExpandedCommonWords(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const translateCommonInList = async (word, language = 'english') => {
    const key = dictionaryWordKey(word, language)
    setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: true, error: null } }))
    try {
      const text = await fetchVietnameseTranslation(word, language)
      setCommonTranslations(prev => ({ ...prev, [key]: { text, loading: false, error: null } }))
    } catch (err) {
      setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: false, error: err.message || 'Không dịch tự động được.' } }))
    }
  }

  const updateMeaningFromWeb = useCallback(async (word, type = 'other', language = 'english') => {
    const sourceLanguage = normalizeLanguage(language)
    const wordKey = word.toLowerCase()
    const key = dictionaryWordKey(word, sourceLanguage)
    setMeaningUpdates(prev => ({ ...prev, [key]: { loading: true, error: null, text: '', type } }))
    try {
      const fields = await fetchWordStudyFields(word, type, sourceLanguage)
      const row = await updateWordStudyFields(word, fields, sourceLanguage)
      const entry = supabaseWordToEntry(row)
      const matchesLanguage = item => item.word.toLowerCase() === wordKey && normalizeLanguage(item.language) === sourceLanguage
      const stamp = new Date().toISOString()
      setSupabaseWords(prev => {
        const next = prev.map(item => matchesLanguage(item) ? entry : item)
        saveDictionaryCache(DICTIONARY_CACHE_KEY, next)
        return next
      })
      setDictionaryCachedAt(stamp)
      setActiveWord(prev => {
        if (!prev || prev.word.toLowerCase() !== wordKey || normalizeLanguage(prev.language || prev.entry?.language) !== sourceLanguage) return prev
        const nextDetail = buildSupabaseWordDetail(entry)
        return {
          ...prev,
          meaning: fields.vietnamese_definition,
          entry,
          detail: nextDetail,
          language: normalizeLanguage(entry.language),
          commonList: prev.commonList?.map(item => matchesLanguage(item) ? entry : item) || prev.commonList,
        }
      })
      setCommonTranslations(prev => ({ ...prev, [key]: { text: fields.vietnamese_definition, loading: false, error: null } }))
      setMeaningUpdates(prev => ({ ...prev, [key]: { loading: false, error: null, text: fields.vietnamese_definition, type } }))
      return fields.vietnamese_definition
    } catch (err) {
      const message = err.message || 'Không cập nhật nghĩa được.'
      setMeaningUpdates(prev => ({ ...prev, [key]: { loading: false, error: message, text: '', type } }))
      throw new Error(message)
    }
  }, [])

  const levelScopedCommonWords = useMemo(() => {
    let list = supabaseWords
    if (commonLanguage !== 'all') {
      const language = normalizeLanguage(commonLanguage)
      list = list.filter(entry => normalizeLanguage(entry.language) === language)
    }
    if (commonLevel === 'none') list = list.filter(entry => !entry.level)
    else if (commonLevel !== 'all') list = list.filter(entry => entry.level === commonLevel)
    if (commonCategory !== 'all') list = list.filter(entry => entry.categoryId === commonCategory)
    const matchesQuery = searchDictionaryEntries(list, deferredCommonQuery, 'all')
    return deferredCommonQuery.trim() ? matchesQuery : list
  }, [commonCategory, commonLanguage, commonLevel, deferredCommonQuery, supabaseWords])

  const filteredCommonWords = useMemo(() => levelScopedCommonWords.filter(entry => {
    const isLearned = learnedWords.has(entry.word.toLowerCase())
    return commonLearnedFilter === 'all'
      || (commonLearnedFilter === 'learned' && isLearned)
      || (commonLearnedFilter === 'unlearned' && !isLearned)
  }), [commonLearnedFilter, learnedWords, levelScopedCommonWords])

  const visibleCommonWords = useMemo(
    () => filteredCommonWords.slice(0, visibleCommonLimit),
    [filteredCommonWords, visibleCommonLimit]
  )
  const scopedLearnedCount = useMemo(
    () => levelScopedCommonWords.filter(entry => learnedWords.has(entry.word.toLowerCase())).length,
    [learnedWords, levelScopedCommonWords]
  )
  const scopedUnlearnedCount = Math.max(0, levelScopedCommonWords.length - scopedLearnedCount)

  if (activeWord) {
    const isCommonWord = activeWord.source === 'common'
    const isLearned = learnedWords.has(activeWord.word)
    const commonList = activeWord.commonList || []
    const commonIndex = activeWord.commonIndex ?? -1
    const commonEntry = activeWord.entry || commonList[commonIndex] || null
    const activeLanguage = normalizeLanguage(activeWord.language || commonEntry?.language || activeWord.detail?.language || 'english')
    const activeAzureCode = LANGUAGE_TO_AZURE[activeLanguage] || 'en-US'
    const activePhonemes = commonEntry?.ipa ? phonemesFromSupabaseIpa(commonEntry.ipa, activeLanguage, activeWord.word) : null
    const commonDetail = activeWord.detail || buildTranslateFallbackDetail(activeWord.word, activeWord.meaning, activeLanguage)
    const openCommonAt = (nextIndex) => {
      const nextEntry = commonList[nextIndex]
      if (!nextEntry) return
      const nextDetail = nextEntry.detail || buildSupabaseWordDetail(nextEntry)
      openWord(nextEntry.word, {
        meaning: nextDetail.meanings?.[0]?.meaningVi || `${nextEntry.level} · ${nextEntry.pos}`,
        strictLookup: true,
        source: 'common',
        entry: nextEntry,
        detail: nextDetail,
        language: normalizeLanguage(nextEntry.language),
        commonList,
        commonIndex: nextIndex,
      })
    }
    const findCommonNavIndex = (direction) => {
      if (!isCommonWord || commonIndex < 0) return -1
      for (let i = commonIndex + direction; i >= 0 && i < commonList.length; i += direction) {
        if (!practiceSettings.unlearnedNavOnly || !learnedWords.has(commonList[i].word.toLowerCase())) return i
      }
      return -1
    }
    const prevCommonIndex = findCommonNavIndex(-1)
    const nextCommonIndex = findCommonNavIndex(1)
    const onPrevCommon = prevCommonIndex >= 0 ? () => openCommonAt(prevCommonIndex) : null
    const onNextCommon = nextCommonIndex >= 0 ? () => openCommonAt(nextCommonIndex) : null

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
        <div className="px-4 pt-6 pb-2 flex items-center gap-3">
          <button onClick={() => setActiveWord(null)} aria-label="Back" className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70">
            <ChevronLeft size={20} />
          </button>
          <span className="text-white/50 text-sm">Dictionary</span>
        </div>
        <PronunciationPractice
          key={`${activeWord.word}:${activeAzureCode}`}
          word={activeWord.word}
          meaning={activeWord.meaning}
          metaLine={isCommonWord ? `${commonIndex + 1}/${commonList.length}${commonEntry ? ` · ${commonEntry.level} · ${commonEntry.pos} · ${LANGUAGE_SHORT[activeLanguage]}` : ''}` : null}
          lang={activeAzureCode}
          prebuiltPhonemes={activePhonemes}
          strictLookup={activeWord.strictLookup}
          compact={isCommonWord}
          detail={commonDetail}
          source={activeWord.source}
          learnedControl={isCommonWord ? {
            checked: isLearned,
            onToggle: (latestScore) => toggleCommonLearned(activeWord.word, latestScore, activeLanguage),
          } : null}
          onBack={() => setActiveWord(null)}
          onHome={onBack}
          onLibrary={onBack}
          onDictionary={() => setActiveWord(null)}
          onPrev={onPrevCommon}
          onNext={onNextCommon}
          onSearchWord={openWord}
          onScoreResult={(result) => onPronunciationResult?.(activeWord.word, result, {
            meaning: commonDetail?.meanings?.find(item => item.pos !== 'translate')?.meaningVi || activeWord.meaning,
            level: commonEntry?.level || null,
            pos: commonEntry?.pos || null,
            language: activeLanguage,
            source: activeWord.source || 'dictionary',
          })}
          onRefreshMeaning={isCommonWord ? (word, language) => updateMeaningFromWeb(word, commonEntry?.pos || activeWord.entry?.pos || 'other', language || activeLanguage) : null}
          practiceSettings={practiceSettings}
          recordingDurationSetting={recordingDurationSetting}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold text-white">Từ Điển Phát Âm</h1>
        {showDictionarySearch && <p className="text-white/40 text-sm">Nhập từ để chẩn đoán phát âm</p>}
      </div>
      {showDictionarySearch && (
        <>
          <form onSubmit={handleSearch} className="px-4 mb-6">
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Nhập từ cần tra..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-5 font-semibold transition-colors">
                Tra
              </button>
            </div>

            <div className="flex flex-wrap gap-3 px-1">
              {DICTIONARY_LANGUAGES.map(lang => (
                <label key={lang} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={searchLanguages.includes(lang)}
                    onChange={e => {
                      if (e.target.checked) setSearchLanguages(prev => [...prev, lang])
                      else setSearchLanguages(prev => prev.filter(l => l !== lang))
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-blue-600 focus:ring-blue-600 focus:ring-offset-gray-900"
                  />
                  <span className={`text-xs font-medium transition-colors ${searchLanguages.includes(lang) ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                    {LANGUAGE_FLAG[lang]} {LANGUAGE_SHORT[lang]}
                  </span>
                </label>
              ))}
            </div>
          </form>

          {searchResult && (
            <div className="px-4 mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Search size={16} className="text-blue-400" />
                  Kết quả tìm kiếm
                </h2>
                <button onClick={() => setSearchResult(null)} className="text-[10px] text-white/40 hover:text-white/60">Xóa</button>
              </div>
              <button
                onClick={() => openWord(searchResult.word, {
                  meaning: searchResult.meaning,
                  source: searchResult.source,
                  language: searchResult.language,
                  entry: searchResult.entry,
                  strictLookup: searchResult.source === 'common'
                })}
                className="w-full text-left rounded-3xl bg-blue-600/10 border border-blue-500/30 p-5 group active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">{searchResult.word}</span>
                      <span className="text-lg">{LANGUAGE_FLAG[searchResult.language]}</span>
                    </div>
                    <div className="text-white/60 text-sm italic line-clamp-2">{searchResult.meaning}</div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${searchResult.source === 'common' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                        {searchResult.source === 'common' ? 'Trong thư viện' : 'Tìm thấy bên ngoài'}
                      </span>
                      <span className="text-[10px] text-white/30">Chạm để luyện phát âm →</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-300 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg shadow-blue-900/20">
                    <ChevronRight size={24} />
                  </div>
                </div>
              </button>
            </div>
          )}
        </>
      )}

      <div className="px-4">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-white font-semibold">Supabase Vocabulary</h2>
            <p className="text-white/40 text-xs">Dữ liệu từ bảng words/categories</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-white/35 text-xs">{visibleCommonWords.length}/{filteredCommonWords.length} từ</div>
            <button
              type="button"
              onClick={() => refreshDictionary()}
              disabled={supabaseLoading}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/55 disabled:opacity-40"
            >
              Tải lại
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={commonQuery}
            onChange={e => setCommonQuery(e.target.value)}
            placeholder="Tìm từ trong Supabase..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setCommonLanguage('all')}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLanguage === 'all' ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            🌐 Tất cả
          </button>
          {DICTIONARY_LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => setCommonLanguage(lang)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors flex items-center gap-1 ${commonLanguage === lang ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
            >
              <span>{LANGUAGE_FLAG[lang]}</span>
              <span>{LANGUAGE_SHORT[lang]}</span>
            </button>
          ))}
        </div>

        <div className="pb-3">
          <LevelCombobox value={commonLevel} onChange={setCommonLevel} levels={supabaseLevels} />
        </div>

        <select
          value={commonCategory}
          onChange={e => setCommonCategory(e.target.value)}
          className="w-full mb-3 bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-white focus:outline-none focus:border-white/30 text-sm"
        >
          <option value="all">Tất cả chủ đề</option>
          {supabaseCategories.map(category => (
            <option key={category.id} value={category.id}>
              {category.level ? `${category.level} · ` : ''}{category.name}
            </option>
          ))}
        </select>

        {supabaseError && (
          <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-100 text-sm">
            Supabase error: {supabaseError}
          </div>
        )}

        {supabaseLoading && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/50 text-sm">
            {supabaseWords.length > 0 ? 'Đang cập nhật dữ liệu nền...' : 'Đang tải từ Supabase...'}
          </div>
        )}

        {!supabaseLoading && dictionaryCachedAt && (
          <div className="mb-3 text-[11px] text-white/30">
            Cache local: {new Date(dictionaryCachedAt).toLocaleString()}
            {commonQuery !== deferredCommonQuery ? ' · đang lọc...' : ''}
          </div>
        )}

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
          {visibleCommonWords.map((entry, index) => {
            const key = dictionaryWordKey(entry.word, entry.language)
            const isLearned = learnedWords.has(entry.word.toLowerCase())
            const savedScore = wordScores[entry.word.toLowerCase()]
            const detail = buildSupabaseWordDetail(entry)
            const firstMeaning = detail?.meanings?.find(item => item.pos !== 'translate')
            const isExpanded = expandedCommonWords.has(key)
            const hasDetails = detail?.meanings?.length > 0
            const listTranslation = commonTranslations[key]
            const meaningUpdate = meaningUpdates[key]
            const listStructures = buildWordStructures(entry.word)
            return (
            <div
              key={entry.id || `${entry.level}-${entry.word}`}
              className={`min-w-0 border rounded-xl transition ${isLearned ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}
            >
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => openWord(entry.word, {
                meaning: firstMeaning?.meaningVi || `${entry.level} · ${entry.pos}`,
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
                    <span className="shrink-0 text-base leading-none" title={entry.language || 'english'}>{LANGUAGE_FLAG[entry.language || 'english']}</span>
                    <span className="text-white text-sm font-medium">{entry.word}</span>
                    {entry.ipa && <span className="shrink-0 text-white/35 font-mono text-[11px]">/{entry.ipa}/</span>}
                    {isLearned && <span className="shrink-0 text-emerald-300 text-xs">✓</span>}
                    {Number.isFinite(savedScore) && (
                      <span className={`shrink-0 text-[10px] leading-none rounded px-1.5 py-1 border ${savedScore >= 85 ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10' : savedScore >= 65 ? 'text-yellow-200 border-yellow-400/30 bg-yellow-500/10' : 'text-red-200 border-red-400/30 bg-red-500/10'}`}>
                        {savedScore}%
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] leading-none text-white/50 border border-white/10 rounded px-1.5 py-1">{entry.level}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-white/35 text-xs">
                    <span>
                      {firstMeaning?.meaningVi || entry.pos}
                      {entry.categoryName ? ` · ${entry.categoryName}` : ''}
                    </span>
                    {showRefreshMeaningAction && (
                      <>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            updateMeaningFromWeb(entry.word, entry.pos, entry.language).catch(() => {})
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            updateMeaningFromWeb(entry.word, entry.pos, entry.language).catch(() => {})
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${meaningUpdate?.loading ? 'border-white/10 bg-white/5 text-white/35' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'}`}
                          aria-label={`Tự tìm và cập nhật dữ liệu cho ${entry.word}`}
                        >
                          <Pencil size={10} />
                          {meaningUpdate?.loading ? 'Đang cập nhật' : 'Sửa nghĩa'}
                        </span>
                        {meaningUpdate?.error && <span className="text-red-200">{meaningUpdate.error}</span>}
                        {meaningUpdate?.text && !meaningUpdate.loading && !meaningUpdate.error && <span className="text-emerald-200">Đã cập nhật theo {meaningUpdate.type || entry.pos}</span>}
                      </>
                    )}
                  </div>
                </button>
                {hasDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleCommonDetail(entry.word, entry.language)
                      if (!isExpanded && !listTranslation?.text && !listTranslation?.loading) {
                        translateCommonInList(entry.word, entry.language)
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
                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-2">
                    <div className="text-cyan-100/60 text-[10px] font-semibold uppercase tracking-wide">Google Translate</div>
                    {listTranslation?.loading && <div className="text-cyan-100/70 text-sm mt-0.5">Translating...</div>}
                    {listTranslation?.text && <div className="text-cyan-50 text-sm font-semibold leading-snug mt-0.5">Google Translate: {listTranslation.text}</div>}
                    {listTranslation?.error && <div className="text-red-200 text-xs mt-0.5">{listTranslation.error}</div>}
                  </div>
                  {detail.meanings.map((item, itemIndex) => (
                    <div key={`${entry.word}-${item.pos}-${itemIndex}`} className="min-w-0">
                      {item.pos !== 'translate' && (
                        <>
                          <div className="text-emerald-300 font-semibold text-sm capitalize leading-snug">{item.pos}</div>
                          <div className="text-white/85 text-sm leading-snug"><span className="text-emerald-300 font-semibold">Meaning:</span> {item.meaningVi}</div>
                          <div className="text-white/45 text-xs leading-snug mt-1"><span className="text-emerald-300 font-semibold">Example:</span> {item.exampleEn}</div>
                          <div className="text-white/35 text-xs leading-snug">{item.exampleVi}</div>
                        </>
                      )}
                    </div>
                  ))}
                  {['family', 'synonyms', 'antonyms'].map(keyName => {
                    const values = detail.relations?.[keyName] || []
                    if (!values.length) return null
                    return (
                      <div key={keyName} className="border-t border-white/10 pt-2">
                        <div className="text-emerald-300 font-semibold text-sm leading-snug capitalize">{keyName}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {values.map(value => (
                            <span key={value} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/70 text-xs">{value}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {listStructures.length > 0 && (
                    <div className="border-t border-white/10 pt-2">
                      <div className="text-emerald-300 font-semibold text-sm leading-snug">Collocations & Structures:</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {listStructures.map(pattern => (
                          <span key={pattern} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-white/75 text-xs">{pattern}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })}
          {visibleCommonWords.length < filteredCommonWords.length && (
            <button
              type="button"
              onClick={() => setVisibleCommonLimit(limit => limit + DICTIONARY_PAGE_SIZE)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 active:scale-[0.99]"
            >
              Xem thêm {Math.min(DICTIONARY_PAGE_SIZE, filteredCommonWords.length - visibleCommonWords.length)} từ
            </button>
          )}
        </div>

        {filteredCommonWords.length === 0 && (
          <div className="text-white/40 text-sm py-10 text-center">Không tìm thấy từ phù hợp.</div>
        )}
      </div>
    </div>
  )
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────

function MainApp({ profile }) {
  const [screen, setScreen] = useState('library')
  const [selectedSound, setSelectedSound] = useState(null)
  const [practiceWord, setPracticeWord] = useState(null)
  const [practiceSentence, setPracticeSentence] = useState(null)
  const [practiceWordIdx, setPracticeWordIdx] = useState(0)
  const [lang, setLang] = useState('en')   // 'en' | 'es' | 'it'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    practiceSettings,
    setPracticeSettings,
    recordingDurationSetting,
    changeRecordingDurationSetting,
    sentenceRecordingDurationSetting,
    changeSentenceRecordingDurationSetting,
  } = usePracticeSettings()
  const {
    learnedCommonWords,
    commonWordScores,
    toggleCommonLearned: handleToggleCommonLearned,
    saveWordPronunciationResult: handlePronunciationResult,
  } = useProgress()
  const {
    sentenceProgress,
    saveSentenceResult: handleSentencePronunciationResult,
  } = useSentenceProgress()

  const azureCode = LANG_CONFIG[lang].azureCode

  const handleSelectSound = (sound) => { setSelectedSound(sound); setScreen('soundDetail') }
  const handlePracticeWord = (w, idx = 0) => { setPracticeWord(w); setPracticeWordIdx(idx); setScreen('practiceWord') }
  const handlePracticeSentence = (item) => { setPracticeSentence(item); setScreen('practiceSentence') }
  const handleSearchPracticeWord = (raw) => {
    const next = String(raw || '').trim()
    if (!next) return
    setPracticeWord({ word: next.toLowerCase(), meaning: '' })
    setPracticeWordIdx(-1)
    setScreen('practiceWord')
  }
  const handlePracticeSentenceWord = (raw) => {
    const next = cleanPracticeWord(raw)
    if (!next) return
    const sentenceLanguage = normalizeLanguage(practiceSentence?.language || 'english')
    setLang(LANGUAGE_TO_APP_LANG[sentenceLanguage] || 'en')
    setPracticeWord({ word: next, meaning: 'Sentence word' })
    setPracticeWordIdx(-1)
    setScreen('practiceWord')
  }
  const handleNavigate = (s) => {
    setScreen(s)
    setSelectedSound(null)
    setPracticeWord(null)
    setPracticeSentence(null)
    setSettingsOpen(false)
  }
  const handleChangeLang = (l) => { setLang(l); setSelectedSound(null); setPracticeWord(null) }

  const soundWords = selectedSound?.words || []
  const onNextWord = practiceWordIdx >= 0 && practiceWordIdx < soundWords.length - 1
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
      <button
        type="button"
        onClick={() => supabase?.auth.signOut()}
        className="fixed top-3 right-3 z-50 w-9 h-9 rounded-xl bg-gray-950/70 border border-white/10 text-white/55 flex items-center justify-center"
        aria-label="Logout"
      >
        <LogOut size={16} />
      </button>
      {screen === 'library' && (
        <SoundLibraryScreen lang={lang} onSelectSound={handleSelectSound} onGoDict={() => handleNavigate('dictionary')} onChangeLang={handleChangeLang} />
      )}
      {screen === 'admin' && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading admin tools...</div>}>
          <AdminScreen profile={profile} onBack={() => handleNavigate('library')} />
        </Suspense>
      )}
      {screen === 'soundDetail' && selectedSound && (
        <SoundDetailScreen sound={selectedSound} lang={lang} onBack={() => setScreen('library')} onPracticeWord={handlePracticeWord} />
      )}
      {screen === 'practiceWord' && practiceWord && (
        <PracticeWordScreen
          word={practiceWord.word}
          meaning={practiceWord.meaning}
          lang={azureCode}
          prebuiltPhonemes={getWordPhonemes(practiceWord)}
          source={practiceSentence ? 'sentence-word' : null}
          onBack={() => practiceSentence ? setScreen('practiceSentence') : setScreen('soundDetail')}
          onHome={() => handleNavigate('library')}
          onLibrary={() => handleNavigate('library')}
          onDictionary={() => handleNavigate('dictionary')}
          onNext={onNextWord}
          onPrev={onPrevWord}
          onSearchWord={handleSearchPracticeWord}
          onScoreResult={(result, scoreMeta = {}) => handlePronunciationResult(practiceWord.word, result, {
            meaning: practiceWord.meaning,
            language: scoreMeta.language || AZURE_TO_LANGUAGE[azureCode] || 'english',
            source: practiceSentence ? 'sentence-word' : 'sound-library',
          })}
          practiceSettings={practiceSettings}
          recordingDurationSetting={recordingDurationSetting}
        />
      )}
      {screen === 'dictionary' && (
        <DictionaryScreen
          onBack={() => handleNavigate('library')}
          practiceSettings={practiceSettings}
          recordingDurationSetting={recordingDurationSetting}
          learnedCommonWords={learnedCommonWords}
          commonWordScores={commonWordScores}
          onToggleCommonLearned={handleToggleCommonLearned}
          onPronunciationResult={handlePronunciationResult}
        />
      )}
      {screen === 'sentences' && (
        <SentenceLibraryScreen
          sentenceProgress={sentenceProgress}
          onPracticeSentence={handlePracticeSentence}
        />
      )}
      {screen === 'practiceSentence' && practiceSentence && (
        <PracticeSentenceScreen
          sentenceItem={practiceSentence}
          onBack={() => setScreen('sentences')}
          onSaveResult={(result) => handleSentencePronunciationResult(practiceSentence.id, result)}
          onPracticeWord={handlePracticeSentenceWord}
          recordingDurationSetting={sentenceRecordingDurationSetting}
        />
      )}
      <BottomNav
        screen={screen}
        onNavigate={handleNavigate}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        recordingDurationSetting={recordingDurationSetting}
        onRecordingDurationChange={changeRecordingDurationSetting}
        sentenceRecordingDurationSetting={sentenceRecordingDurationSetting}
        onSentenceRecordingDurationChange={changeSentenceRecordingDurationSetting}
        practiceSettings={practiceSettings}
        onPracticeSettingsChange={setPracticeSettings}
        canAdmin={profile?.role === 'admin'}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {({ profile }) => <MainApp profile={profile} />}
    </AuthGate>
  )
}
