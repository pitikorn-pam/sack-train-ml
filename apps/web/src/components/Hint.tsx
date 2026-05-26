/**
 * Hint — small "i" icon next to a label that reveals an explanation on hover/focus.
 *
 * Usage:
 *   <label>Epochs <Hint text="50 is a sane default for fine-tuning. More epochs..." /></label>
 */

interface HintProps {
  text: string;
}

export function Hint({ text }: HintProps) {
  return (
    <span className="hint" tabIndex={0} aria-label={text}>
      <span className="hint-icon">i</span>
      <span className="hint-tooltip">{text}</span>
    </span>
  );
}
