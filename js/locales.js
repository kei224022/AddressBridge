/** 表示・変換結果キー・翻訳先を共通管理するロケール定義。 */
export const LOCALE_CONFIG = {
  'us':    { resultKey: 'us', label: 'American English', flag: '🇺🇸', language: 'EN-US' },
  'uk':    { resultKey: 'uk', label: 'British English', flag: '🇬🇧', language: 'EN-GB' },
  'fr':    { resultKey: 'fr', label: 'French', flag: '🇫🇷', language: 'FR' },
  'de':    { resultKey: 'de', label: 'German', flag: '🇩🇪', language: 'DE' },
  'it':    { resultKey: 'it', label: 'Italian', flag: '🇮🇹', language: 'IT' },
  'ca-en': { resultKey: 'caEn', label: 'Canadian English', flag: '🇨🇦', language: 'EN-US' },
  'ca-fr': { resultKey: 'caFr', label: 'Canadian French', flag: '🇨🇦', language: 'FR' },
  'kr':    { resultKey: 'kr', label: '한국어', flag: '🇰🇷', language: 'KO', auxKey: 'krAux' },
  'tw':    { resultKey: 'tw', label: '繁體中文', flag: '🇹🇼', language: 'ZH-HANT', auxKey: 'twAux' },
};

export const LOCALES = Object.keys(LOCALE_CONFIG);

// 補助表記も含めた既存の ConversionResult キーを維持する。
export const CONVERSION_LOCALES = [
  ...LOCALES.map(locale => ({ locale, ...LOCALE_CONFIG[locale] })),
  ...LOCALES.filter(locale => LOCALE_CONFIG[locale].auxKey).map(locale => ({
    locale: `${locale}-aux`,
    resultKey: LOCALE_CONFIG[locale].auxKey,
    language: LOCALE_CONFIG[locale].language,
  })),
];
