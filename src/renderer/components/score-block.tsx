/** Big mono match score with a bar; the bar turns solid blue at `highAt` (auto-send level). */
export function ScoreBlock({ score, note, highAt = 85, size = 'lg' }: { score: number; note?: string; highAt?: number; size?: 'lg' | 'md' }) {
  return (
    <div className="score-block">
      <div className="score">
        <span className="score-value" style={size === 'md' ? { fontSize: 28 } : undefined}>{score}</span>
        <span className="score-label">match</span>
      </div>
      <div className={score >= highAt ? 'score-bar score-bar-high' : 'score-bar'} role="meter" aria-label="Match score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div style={{ width: `${score}%` }} />
      </div>
      {note ? <div className="cell-sub score-note">{note}</div> : null}
    </div>
  );
}
