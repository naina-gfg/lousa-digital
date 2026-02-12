
export interface TextStyles {
  fontSize: number;
  lineHeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
}

export interface SlideStyle {
  template: 'classic' | 'modern' | 'minimalist' | 'blueprint';
  primaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  titleStyles: TextStyles;
  bodyStyles: TextStyles;
}

export interface Slide {
  id: string;
  title: string;
  content: string[];
  summary: string;
  keywords: string[];
  imageUrl?: string;
  sourceImageIndex?: number;
}

export interface BoardProject {
  id: string;
  name: string;
  course: string;
  topic: string;
  originalImages: string[];
  slides: Slide[];
  createdAt: number;
  style: SlideStyle;
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K'
}

export interface ApiResponse {
  slides: Omit<Slide, 'id' | 'imageUrl'>[];
  theme: string;
}
