export interface SruConfig {
  sruUrl: string;
  username: string;
  password: string;
  headerLabelCs: string;
  headerLabelEn: string;
}

export const DEFAULT_SRU_CONFIG: SruConfig = {
  sruUrl: '',
  username: '',
  password: '',
  headerLabelCs: 'Knihovna',
  headerLabelEn: 'Library'
};

export function normalizeSruConfig(value: any): SruConfig {
  return {
    sruUrl: String(value?.sruUrl || '').trim(),
    username: String(value?.username || '').trim(),
    password: String(value?.password || ''),
    headerLabelCs: String(value?.headerLabelCs || 'Knihovna').trim() || 'Knihovna',
    headerLabelEn: String(value?.headerLabelEn || 'Library').trim() || 'Library'
  };
}
