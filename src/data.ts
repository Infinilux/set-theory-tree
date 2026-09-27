import raw from "../data/techs.json";
import rawEras from "../data/eras.json";
import rawCats from "../data/categories.json";
import type { RawTech, Era, Category, Tech } from "./types";

const eras = (rawEras as { eras: Era[] }).eras;
const categories = (rawCats as { categories: Category[] }).categories;
const eraIndex = new Map(eras.map((e, i) => [e.id, i]));
const catIndex = new Map(categories.map((c, i) => [c.id, i]));

const rawTechs = (raw as { techs: RawTech[] }).techs;

export const techs: Tech[] = rawTechs.map((t, i) => ({
  ...t, index: i,
  eraIndex: eraIndex.get(t.era) ?? 0,
  categoryIndex: catIndex.get(t.category) ?? 0,
  prereqIdx: [], relatedIdx: [],
}));

// 字符串 id -> 索引，供依赖边解析
const byId = new Map(techs.map((t) => [t.id, t.index]));
for (const t of techs) {
  t.prereqIdx = t.prereqs.map((p) => byId.get(p)).filter((v): v is number => v !== undefined);
  t.relatedIdx = t.related.map((p) => byId.get(p)).filter((v): v is number => v !== undefined);
}

export { eras, categories };
export const categoryById = new Map(categories.map((c) => [c.id, c]));