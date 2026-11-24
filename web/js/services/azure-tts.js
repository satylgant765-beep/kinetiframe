// Text to speech with Azure AI Speech (REST API).
// The key and region are stored only in this browser (localStorage) and never in project files.

const SETTINGS_KEY = 'tas:azure-speech';

export const VOICES = [
  { id: 'kk-KZ-AigulNeural', label: 'Айгүл (қазақша)' },
  { id: 'kk-KZ-DauletNeural', label: 'Дәулет (қазақша)' },
  { id: 'ru-RU-SvetlanaNeural', label: 'Светлана (русский)' },
  { id: 'ru-RU-DmitryNeural', label: 'Дмитрий (русский)' },
  { id: 'en-US-AnaNeural', label: 'Ana, ребёнок (English)' },
  { id: 'en-US-GuyNeural', label: 'Guy (English)' },
];

/** Cartoon voice styles made from pitch and speed. */
export const STYLES = {
  normal: { label: 'Обычный', pitch: '0%', rate: '0%' },
  cartoon: { label: 'Мультяшный', pitch: '+35%', rate: '+10%' },
  tiny: { label: 'Малыш', pitch: '+60%', rate: '+15%' },
  giant: { label: 'Великан', pitch: '-35%', rate: '-15%' },
  robot: { label: 'Медленный', pitch: '-10%', rate: '-30%' },
};

export function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { key: data.key || '', region: data.region || '' };
  } catch {
    return { key: '', region: '' };
  }
}

export function saveSettings({ key, region }) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ key: key.trim(), region: region.trim().toLowerCase() }));
    return true;
  } catch {
    return false;
  }
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function buildSsml(text, voice, style) {
  const s = STYLES[style] || STYLES.normal;
  const lang = voice.split('-').slice(0, 2).join('-');
  return `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">`
    + `<prosody pitch="${s.pitch}" rate="${s.rate}">${escapeXml(text)}</prosody></voice></speak>`;
}

/** Returns an MP3 Blob with the spoken text. Throws a readable error. */
export async function synthesize(text, voice, style) {
  const { key, region } = loadSettings();
  if (!key || !region) throw new Error('Сначала укажите ключ и регион Azure в настройках ниже.');
  if (!/^[a-z0-9]+$/.test(region)) throw new Error('Регион пишется латиницей без пробелов, например westeurope.');
  if (!text.trim()) throw new Error('Напишите текст, который нужно озвучить.');
  let response;
  try {
    response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: buildSsml(text.trim(), voice, style),
    });
  } catch {
    throw new Error('Не удалось связаться с Azure. Проверьте интернет и регион.');
  }
  if (response.status === 401 || response.status === 403) throw new Error('Azure не принял ключ. Проверьте ключ и регион ресурса Speech.');
  if (response.status === 429) throw new Error('Превышен лимит Azure. Подождите минуту и попробуйте снова.');
  if (!response.ok) throw new Error(`Azure ответил ошибкой ${response.status}.`);
  return response.blob();
}
