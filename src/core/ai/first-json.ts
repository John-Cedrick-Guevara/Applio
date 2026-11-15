/** The first `{…}` object in a model's reply (it may wrap the JSON in prose), parsed; undefined when there isn't one. */
export function firstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    return start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : undefined;
  } catch {
    return undefined;
  }
}
