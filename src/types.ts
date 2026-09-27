export interface RawTech {
  id: string; name: string; nameEn: string; year: number; year_basis: string;
  year_note: string; era: string; category: string; kind: string;
  importance: number; status: string; desc: string; prereqs: string[]; related: string[];
}
export interface Era { id: string; name: string; start: number; end: number }
export interface Category { id: string; name: string; group: string }
export interface Tech extends RawTech {
  index: number; eraIndex: number; categoryIndex: number;
  prereqIdx: number[]; relatedIdx: number[];
}
export interface Positioned {
  tech: Tech; x: number; y: number; z: number;
  layerRadius: number; angle: number; radius: number;
}
export interface Layout {
  nodes: Positioned[]; eras: Era[]; categories: Category[];
  layerY: number[]; layerRadius: number[]; layerCount: number[];
  height: number; maxRadius: number; viewDistance: number;
}