/** One field of an application form, as read from the page. */
export interface FormField {
  /** A CSS selector that finds this control (or the first control of a radio group). */
  selector: string;
  kind: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'file' | 'select' | 'radio' | 'checkbox';
  /** The question as the operator would read it. */
  label: string;
  required: boolean;
  /** Choices for a select or radio group: what's shown, and the value to set. */
  options?: { label: string; value: string; selector?: string }[];
}

/** What a form needs, as read from the page; the planner decides what to put where. */
export interface ReadForm {
  fields: FormField[];
  /** The control that submits the form, if one was found. */
  submit?: string;
  /** A CAPTCHA challenge is showing; Applio never solves one. */
  captcha: boolean;
}
