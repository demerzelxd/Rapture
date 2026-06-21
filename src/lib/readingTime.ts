export function getReadingTime(body: string) {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const minutes = Math.max(1, Math.ceil(words.length / 220));
  return `${minutes} min read`;
}
