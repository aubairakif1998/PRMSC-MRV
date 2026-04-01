import Config from 'react-native-config';

export const API_URL =
  (Config.API_URL || '').trim() || 'http://localhost:5001/api';
