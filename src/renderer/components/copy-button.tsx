import { useEffect, useState } from 'react';
import { Button } from './button';
import { useToast } from './toast';

/**
 * Copies text for manual handoff. Shows "Copied" for a moment and confirms with
 * a toast; on failure tells the operator to copy by hand.
 */
export function CopyButton({ text, what }: { text: string; what: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.show('Copied to clipboard', 'success');
    } catch (err) {
      console.error('[copy] clipboard write failed', err);
      toast.show("Couldn't copy to the clipboard. Select the text and copy it manually.", 'error');
    }
  };

  return (
    <Button size="sm" onClick={copy} aria-label={`${copied ? 'Copied' : 'Copy'} ${what}`} style={{ minWidth: 76 }}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
