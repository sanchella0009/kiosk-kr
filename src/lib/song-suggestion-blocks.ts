export const SONG_SUGGESTION_BLOCK_REASON_OPTIONS = [
  { value: "FOREIGN_AGENT", label: "Иноагент" },
  { value: "EXPLICIT_LANGUAGE", label: "Мат" },
  { value: "DIRECTOR_BANNED", label: "Директор запретила" },
  { value: "CUSTOM", label: "Своя причина" },
] as const;

export type SongSuggestionBlockReasonValue =
  (typeof SONG_SUGGESTION_BLOCK_REASON_OPTIONS)[number]["value"];

const SONG_SUGGESTION_BLOCK_REASON_LABELS: Record<
  Exclude<SongSuggestionBlockReasonValue, "CUSTOM">,
  string
> = {
  FOREIGN_AGENT: "Иноагент",
  EXPLICIT_LANGUAGE: "Мат",
  DIRECTOR_BANNED: "Директор запретила",
};

const SONG_SUGGESTION_BLOCK_REASON_MESSAGES: Record<
  Exclude<SongSuggestionBlockReasonValue, "CUSTOM">,
  string
> = {
  FOREIGN_AGENT: "Эту песню сейчас нельзя заказать по правилам лагеря.",
  EXPLICIT_LANGUAGE: "Эту песню сейчас нельзя заказать: в ней есть плохие слова.",
  DIRECTOR_BANNED: "Эту песню сейчас нельзя заказать по правилам лагеря.",
};

const TRY_ANOTHER_SONG_SUFFIX = "Попробуй заказать другую песню.";

const appendTryAnotherSongSuffix = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return TRY_ANOTHER_SONG_SUFFIX;
  if (trimmed.endsWith(TRY_ANOTHER_SONG_SUFFIX)) return trimmed;
  if (/[.!?…]$/.test(trimmed)) {
    return `${trimmed} ${TRY_ANOTHER_SONG_SUFFIX}`;
  }
  return `${trimmed}. ${TRY_ANOTHER_SONG_SUFFIX}`;
};

export const isSongSuggestionBlockReason = (
  value: string
): value is SongSuggestionBlockReasonValue =>
  SONG_SUGGESTION_BLOCK_REASON_OPTIONS.some((option) => option.value === value);

export const normalizeSongSuggestionBlockReason = (
  value: string | null | undefined
): SongSuggestionBlockReasonValue => {
  const normalizedValue = value ?? "";
  return isSongSuggestionBlockReason(normalizedValue)
    ? normalizedValue
    : "CUSTOM";
};

export const formatSongSuggestionBlockReasonLabel = (
  reasonType: SongSuggestionBlockReasonValue,
  reasonText?: string | null
) => {
  const customReason = reasonText?.trim();
  if (reasonType === "CUSTOM") return customReason || "Своя причина";
  return SONG_SUGGESTION_BLOCK_REASON_LABELS[reasonType];
};

export const findSongSuggestionBlockReasons = (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [] as SongSuggestionBlockReasonValue[];

  return SONG_SUGGESTION_BLOCK_REASON_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(normalizedQuery)
  ).map((option) => option.value);
};

export const formatSongSuggestionBlockReasonMessage = (
  reasonType: SongSuggestionBlockReasonValue,
  reasonText?: string | null
) => {
  const customReason = reasonText?.trim();
  if (reasonType === "CUSTOM") {
    return appendTryAnotherSongSuffix(
      customReason || "Эту песню сейчас нельзя заказать."
    );
  }
  return appendTryAnotherSongSuffix(
    SONG_SUGGESTION_BLOCK_REASON_MESSAGES[reasonType]
  );
};
