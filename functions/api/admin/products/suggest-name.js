import { z } from "zod";
import {
  ensureOwner,
  getRequestId,
  handleError,
  json,
  parseJsonBody,
} from "../../_utils.js";

const payloadSchema = z.object({
  titleHint: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().min(1).optional().nullable(),
  ingredients: z.array(z.string().trim().min(1)).default([]),
  category: z.string().trim().min(1).optional().nullable(),
  images: z.array(z.string().trim().min(1)).default([]),
});

const STOP_WORDS = new Set([
  "и",
  "в",
  "на",
  "с",
  "со",
  "из",
  "по",
  "для",
  "без",
  "или",
  "как",
  "это",
  "что",
  "то",
  "мы",
  "вы",
  "они",
  "она",
  "оно",
  "там",
  "тут",
  "же",
  "же",
  "бы",
  "ли",
  "за",
  "под",
  "над",
  "при",
  "от",
  "до",
  "the",
  "and",
  "with",
  "without",
  "for",
  "from",
  "about",
]);

const ADJECTIVES = [
  "Авторская",
  "Домашняя",
  "Фирменная",
  "Сытная",
  "Пикантная",
  "Сырная",
  "Мясная",
  "Овощная",
  "Ароматная",
  "Хрустящая",
  "Ночная",
  "Летняя",
];

const DESCRIPTORS = [
  "Экспромт",
  "Комбо",
  "Дуэт",
  "Трио",
  "Фьюжн",
  "Классика",
  "Вдохновение",
];

function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !STOP_WORDS.has(item));
}

function titleize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function uniq(items) {
  return Array.from(new Set(items));
}

function pickBaseTokens(ingredients, tokens) {
  const ingredientTokens = ingredients.flatMap((item) => normalizeText(item));
  const baseTokens = ingredientTokens.length ? ingredientTokens : tokens;
  return uniq(baseTokens).slice(0, 3);
}

function buildBases(tokens) {
  if (!tokens.length) return [];
  const bases = [titleize(tokens[0])];
  if (tokens.length > 1) {
    bases.push(`${titleize(tokens[0])} и ${tokens[1]}`);
  }
  if (tokens.length > 2) {
    bases.push(`${titleize(tokens[0])}, ${tokens[1]} и ${tokens[2]}`);
  }
  return bases;
}

async function fetchDuckDuckGo(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];
    const data = await response.json();
    const related = [];
    const collect = (items) => {
      items.forEach((item) => {
        if (item?.Text) related.push(item.Text);
        if (item?.Name) related.push(item.Name);
        if (Array.isArray(item?.Topics)) collect(item.Topics);
      });
    };
    if (Array.isArray(data?.RelatedTopics)) collect(data.RelatedTopics);
    if (data?.Heading) related.push(data.Heading);
    if (data?.AbstractText) related.push(data.AbstractText);
    return related;
  } catch (error) {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildSuggestions({ bases, tokens }) {
  const suggestions = [];
  const base = bases[0];
  if (base) {
    suggestions.push(base);
  }
  if (bases[1]) {
    suggestions.push(bases[1]);
    suggestions.push(`Пицца ${bases[1]}`);
  }
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  if (adjective && base) {
    suggestions.push(`${adjective} ${base}`);
  }
  const descriptor = DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)];
  if (descriptor && base) {
    suggestions.push(`${descriptor} ${base}`);
  }
  if (tokens.length > 1) {
    suggestions.push(`${titleize(tokens[1])} ${titleize(tokens[0])}`);
  }
  return uniq(suggestions).slice(0, 5);
}

export async function onRequest({ env, request }) {
  const requestId = getRequestId(request);
  try {
    await ensureOwner(request, env);
    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    const body = await parseJsonBody(request, payloadSchema);
    const searchSeed = [
      body.titleHint,
      body.description,
      body.category,
      body.ingredients.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const searchTexts = searchSeed
      ? await fetchDuckDuckGo(`${searchSeed} pizza`)
      : [];
    const extraTokens = normalizeText(searchTexts.join(" "));
    const imageTokens = normalizeText(body.images.join(" "));
    const inputTokens = normalizeText(
      [body.titleHint, body.description, body.category].filter(Boolean).join(" ")
    );
    const tokens = uniq([...inputTokens, ...extraTokens, ...imageTokens]);
    const baseTokens = pickBaseTokens(body.ingredients, tokens);
    const bases = buildBases(baseTokens);

    const suggestions = buildSuggestions({ bases, tokens: baseTokens });
    return json({ items: suggestions }, 200, { "x-request-id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
}
