export interface ColorPalette {
  brand: Record<string, string>;
  text: Record<string, string>;
  background: Record<string, string>;
  border: Record<string, string>;
  status: Record<string, string>;
  dark: Record<string, string>;
}

export interface TypographyTokens {
  fontFamily: {
    sans: string;
    mono: string;
    [key: string]: string;
  };
  fontSize: Record<string, string>;
  lineHeight: Record<string, number>;
  fontWeight: Record<string, number>;
}

export declare const colors: ColorPalette;
export declare const typography: TypographyTokens;
export declare const spacing: Record<string | number, string>;
export declare const breakpoints: Record<string, string>;
