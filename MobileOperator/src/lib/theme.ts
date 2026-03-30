const CSS_VARIABLE_KEYS = [
  'background',
  'foreground',
  'card',
  'popover',
  'primary',
  'secondary',
  'muted',
  'accent',
  'destructive',
  'border',
  'input',
  'ring',
  'radius',
] as const;

export const NAV_THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    border: 'hsl(214.3 31.8% 91.4%)',
    card: 'hsl(0 0% 100%)',
    notification: 'hsl(0 84.2% 60.2%)',
    primary: 'hsl(222.2 47.4% 11.2%)',
    text: 'hsl(222.2 84% 4.9%)',
  },
  dark: {
    background: 'hsl(222.2 84% 4.9%)',
    border: 'hsl(217.2 32.6% 17.5%)',
    card: 'hsl(222.2 84% 4.9%)',
    notification: 'hsl(0 62.8% 30.6%)',
    primary: 'hsl(210 40% 98%)',
    text: 'hsl(210 40% 98%)',
  },
} as const;

export { CSS_VARIABLE_KEYS };
