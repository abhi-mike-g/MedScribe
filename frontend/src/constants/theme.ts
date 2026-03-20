export const Colors = {
  light: {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    primary: '#0033A0',
    secondary: '#7A8BFF',
    textPrimary: '#0A0A0A',
    textSecondary: '#52525B',
    border: '#E4E4E7',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    successBg: '#ECFDF5',
    errorBg: '#FEF2F2',
    cardBg: '#FFFFFF',
    inputBg: '#F4F4F5',
  },
  dark: {
    background: '#05050A',
    surface: '#12121A',
    primary: '#4A72FF',
    secondary: '#2A2A3A',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0AB',
    border: '#27272A',
    success: '#059669',
    error: '#F87171',
    warning: '#FBBF24',
    successBg: '#052E16',
    errorBg: '#450A0A',
    cardBg: '#12121A',
    inputBg: '#1A1A24',
  },
};

// Use light theme as default for medical context (cleaner, more readable)
export const theme = Colors.light;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
};
