/** Static preview of the single ATS-safe resume template every application uses (SPEC F4). */
export function TemplatePreview() {
  return (
    <section className="card" aria-label="Resume template preview">
      <div className="spread">
        <h2 className="card-title">ATS-safe template</h2>
        <span className="cell-sub">Single column · real text · no tables or images</span>
      </div>
      <div className="doc-well">
        <div className="doc-paper resume">
          <div className="resume-name">[Your Name]</div>
          <div className="cell-sub">[Headline tailored per job] · Remote · [email] · [github]</div>
          <div className="resume-heading">Summary</div>
          <p>Two lines, rewritten for each job from your fact bank.</p>
          <div className="resume-heading">Experience</div>
          <div className="resume-role">[Company] — [Title] · [Dates]</div>
          <ul>
            <li>Facts picked and ordered by relevance to the job</li>
            <li>Metrics kept exactly as written in your fact bank</li>
          </ul>
          <div className="resume-heading">Skills</div>
          <p>Ordered to match the job's keywords</p>
        </div>
      </div>
    </section>
  );
}
