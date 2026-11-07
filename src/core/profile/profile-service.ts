import type { ApplioApi } from '../../shared/api';
import { DEFAULT_PREFERENCES, EMPTY_CONTACT } from '../../shared/defaults';
import { AppError } from '../../shared/errors';
import type { Answer, Contact, Fact, FactGroup, Preferences, ReferenceResume, ResumeImport } from '../../shared/types';
import { suggestFacts } from './suggest-facts';

/** Ports this service needs; `src/infra/db` implements them. */
export interface ProfilePorts {
  store: {
    listFacts(): Fact[];
    saveFact(fact: Fact): void;
    deleteFact(id: string): void;
    listFactGroups(): FactGroup[];
    replaceFactGroups(groups: readonly FactGroup[]): void;
    listAnswers(): Answer[];
    saveAnswer(answer: Answer): void;
    deleteAnswer(id: string): void;
  };
  kv: { get(key: string): unknown; set(key: string, value: unknown): void };
  newId: () => string;
  now: () => Date;
}

type ProfileMethods = 'getProfile' | 'saveFact' | 'deleteFact' | 'saveAnswer' | 'deleteAnswer' | 'savePreferences' | 'saveContact' | 'saveFactGroup';
/** The profile API methods, synchronously, plus recording a résumé the backend has already read. */
export type ProfileService = { [M in ProfileMethods]: (...args: Parameters<ApplioApi[M]>) => Awaited<ReturnType<ApplioApi[M]>> } & {
  /** Records the reference résumé and returns fact suggestions; adds nothing to the bank. */
  recordResume(fileName: string, text: string): ResumeImport;
};

const invalid = (message: string) => new AppError('INVALID_PROFILE', message);

/** The operator's fact bank, answer bank, preferences and reference résumé (SPEC F1). */
export function createProfileService({ store, kv, newId, now }: ProfilePorts): ProfileService {
  /** New groups go last, so the fact bank shows sections in the order they first appeared. */
  const ensureGroup = (name: string) => {
    const groups = store.listFactGroups();
    if (!groups.some((g) => g.name === name)) store.replaceFactGroups([...groups, { name }]);
  };

  return {
    getProfile: () => ({
      facts: store.listFacts(),
      factGroups: store.listFactGroups(),
      skills: (kv.get('skills') as string[] | undefined) ?? [],
      answers: store.listAnswers(),
      preferences: (kv.get('preferences') as Preferences | undefined) ?? DEFAULT_PREFERENCES,
      referenceResume: kv.get('referenceResume') as ReferenceResume | undefined,
      contact: (kv.get('contact') as Contact | undefined) ?? EMPTY_CONTACT,
    }),

    saveContact: (input) => {
      const links = input.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
      if (links.some((l) => !l.label)) throw invalid('Give each link a label, e.g. Portfolio or GitHub');
      const contact: Contact = { phone: input.phone.trim(), location: input.location.trim(), links, education: input.education.trim(), notes: input.notes.trim() };
      kv.set('contact', contact);
      return contact;
    },

    saveFactGroup: (input) => {
      const groups = store.listFactGroups();
      if (!groups.some((g) => g.name === input.name)) throw invalid('That section no longer exists. Reload Profile and try again.');
      // Empty fields are dropped, so clearing one removes it.
      const next: FactGroup = { name: input.name };
      if (input.kind) next.kind = input.kind;
      for (const key of ['dates', 'context', 'link'] as const) {
        const v = input[key]?.trim();
        if (v) next[key] = v;
      }
      store.replaceFactGroups(groups.map((g) => (g.name === input.name ? next : g)));
      return store.listFactGroups();
    },

    saveFact: (input) => {
      const text = input.text.trim();
      if (!text) throw invalid('Write the fact first');
      const existing = input.id ? store.listFacts().find((f) => f.id === input.id) : undefined;
      if (input.id && !existing) throw invalid('That fact was deleted. Add it again as a new fact.');
      const fact: Fact = existing ? { ...existing, group: input.group, text } : { id: newId(), group: input.group, text, tags: [], timesUsed: 0 };
      ensureGroup(fact.group);
      store.saveFact(fact);
      return fact;
    },

    deleteFact: (id) => store.deleteFact(id),

    saveAnswer: (input) => {
      const question = input.question.trim();
      const answer = input.answer.trim();
      if (!question || !answer) throw invalid('Fill in both the question and the answer');
      const existing = input.id ? store.listAnswers().find((a) => a.id === input.id) : undefined;
      if (input.id && !existing) throw invalid('That answer was deleted. Add it again as a new answer.');
      const saved: Answer = existing ? { ...existing, question, answer } : { id: newId(), question, answer, origin: 'you', timesReused: 0 };
      store.saveAnswer(saved);
      return saved;
    },

    deleteAnswer: (id) => store.deleteAnswer(id),

    savePreferences: (preferences) => {
      kv.set('preferences', preferences);
      return preferences;
    },

    recordResume: (fileName, text) => {
      const suggestions = suggestFacts(text, store.listFacts().map((f) => f.text));
      const resume: ReferenceResume = { fileName, uploadedAt: now().toISOString(), factsFound: suggestions.length };
      kv.set('referenceResume', resume);
      return { resume, suggestions };
    },
  };
}
