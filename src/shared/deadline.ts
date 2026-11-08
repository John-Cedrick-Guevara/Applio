/**
 * Settles with `work`, or rejects with `message` once `ms` pass first. Used where a
 * hung call would otherwise leave the operator watching a spinner forever.
 * @throws Error(message) when the deadline passes first.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}
