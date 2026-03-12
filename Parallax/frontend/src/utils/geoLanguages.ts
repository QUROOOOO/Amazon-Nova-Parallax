export const ALL_YOUTUBE_LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Assamese", "Aymara", "Azerbaijani", 
  "Bambara", "Bangla", "Basque", "Belarusian", "Bengali", "Bhojpuri", "Bosnian", "Bulgarian", 
  "Burmese", "Catalan", "Cebuano", "Chinese (Simplified)", "Chinese (Traditional)", "Corsican", 
  "Croatian", "Czech", "Danish", "Dhivehi", "Dogri", "Dutch", "English", "Esperanto", "Estonian", 
  "Ewe", "Filipino", "Finnish", "French", "Frisian", "Galician", "Ganda", "Georgian", "German", 
  "Goan Konkani", "Greek", "Guarani", "Gujarati", "Haitian Creole", "Hausa", "Hawaiian", "Hebrew", 
  "Hindi", "Hmong", "Hungarian", "Icelandic", "Igbo", "Iloko", "Indonesian", "Irish", "Italian", 
  "Japanese", "Javanese", "Kannada", "Kazakh", "Khmer", "Kinyarwanda", "Korean", "Krio", "Kurdish (Kurmanji)", 
  "Kurdish (Sorani)", "Kyrgyz", "Lao", "Latin", "Latvian", "Lingala", "Lithuanian", "Luxembourgish", 
  "Macedonian", "Maithili", "Malagasy", "Malay", "Malayalam", "Maltese", "Maori", "Marathi", "Meiteilon (Manipuri)", 
  "Mizo", "Mongolian", "Myanmar (Burmese)", "Nepali", "Northern Sotho", "Norwegian", "Nyanja (Chichewa)", 
  "Odia (Oriya)", "Oromo", "Pashto", "Persian", "Polish", "Portuguese", "Punjabi", "Quechua", "Romanian", 
  "Russian", "Samoan", "Sanskrit", "Scots Gaelic", "Serbian", "Sesotho", "Shona", "Sindhi", "Sinhala", 
  "Slovak", "Slovenian", "Somali", "Spanish", "Sundanese", "Swahili", "Swedish", "Tajik", "Tamil", "Tatar", 
  "Telugu", "Thai", "Tigrinya", "Tsonga", "Turkish", "Turkmen", "Ukrainian", "Urdu", "Uyghur", "Uzbek", 
  "Vietnamese", "Welsh", "Xhosa", "Yiddish", "Yoruba", "Zulu"
];

// Fallback languages if IP fetch fails (e.g. adblocker)
const FALLBACK_LANGUAGES = ["English", "Spanish", "French", "German"];

/**
 * Fetches the user's location via ipapi.co and maps it to a list of primary languages spoken there.
 * Guaranteed to return "English" as the first element.
 */
export async function getUserLocationLanguages(): Promise<string[]> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('Failed to fetch IP geo');
    const data = await res.json();
    
    // Explicitly map IN country code to all major requested regional languages
    if (data.country === 'IN') {
      const inLangs = ['English', 'Hindi', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Malayalam', 'Odia (Oriya)', 'Punjabi'];
      return inLangs;
    }

    if (data.languages && typeof data.languages === 'string') {
      const langCodes = data.languages.split(',').map((l: string) => l.split('-')[0].toLowerCase().trim());
      
      const localLangs = new Set<string>();
      
      // Simple map of common alpha-2 codes to names as an approximation
      // A full production app would use an intl. locale library.
      const codeToName: Record<string, string> = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'pt': 'Portuguese', 'zh': 'Chinese (Simplified)', 'ja': 'Japanese', 'ko': 'Korean', 'ru': 'Russian',
        'ar': 'Arabic', 'nl': 'Dutch', 'it': 'Italian', 'tr': 'Turkish', 'pl': 'Polish',
        'id': 'Indonesian', 'vi': 'Vietnamese', 'th': 'Thai', 'tl': 'Filipino',
        'sv': 'Swedish', 'fi': 'Finnish', 'no': 'Norwegian', 'da': 'Danish',
        'cs': 'Czech', 'el': 'Greek', 'he': 'Hebrew', 'ro': 'Romanian', 'hu': 'Hungarian'
      };

      for (const code of langCodes) {
        if (codeToName[code] && ALL_YOUTUBE_LANGUAGES.includes(codeToName[code])) {
          localLangs.add(codeToName[code]);
        }
      }

      // Format result: English always first
      localLangs.delete('English');
      return ['English', ...Array.from(localLangs)];
    }
    
    return ['English', ...FALLBACK_LANGUAGES.filter(l => l !== 'English')];

  } catch (error) {
    console.warn("Geo-IP language fetch failed, using fallback.", error);
    return ['English', ...FALLBACK_LANGUAGES.filter(l => l !== 'English')];
  }
}
