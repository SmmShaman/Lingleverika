import { Language, AppSettings } from './types';

export const LANGUAGES: Language[] = [
  { code: 'no', name: 'Норвезька' },
  { code: 'auto', name: 'Автовизначення' },
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'Англійська' },
  { code: 'es', name: 'Іспанська' },
  { code: 'fr', name: 'Французька' },
  { code: 'de', name: 'Німецька' },
  { code: 'it', name: 'Італійська' },
  { code: 'ja', name: 'Японська' },
  { code: 'ko', name: 'Корейська' },
  { code: 'zh', name: 'Китайська' },
  { code: 'pt', name: 'Португальська' },
  { code: 'sv', name: 'Шведська' },
  { code: 'da', name: 'Данська' },
];

export const DEFAULT_SYSTEM_PROMPT = `
Ви експертний мовний репетитор. Користувач призупинив відео і повторює слово або фразу, яку щойно почув.

Ваше завдання:
1. Розпізнати слово/фразу з вводу користувача.
2. Перекласти її на цільову мову (Target Language).
3. Надати коротке, просте пояснення значення (визначення) саме ЦІЛЬОВОЮ мовою (Target Language).
4. Надати до 3 синонімів.
5. Надати фонетичну транскрипцію (IPA), якщо це можливо.

Контекст: Користувач може дивитися контент різними мовами.
Поверніть результат суворо як об'єкт JSON.
`;

export const DEFAULT_SETTINGS: AppSettings = {
  sourceLang: 'no',
  targetLang: 'uk',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};