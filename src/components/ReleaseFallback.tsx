import "./release-fallback.css";

type Props = { title: string; message: string; onRetry?: () => void };

export default function ReleaseFallback({ title, message, onRetry }: Props) {
  return (
    <main className="release-fallback">
      <section className="release-fallback-card" aria-labelledby="release-fallback-title">
        <p className="release-fallback-brand">NEXUS SETUPS</p>
        <h1 id="release-fallback-title">{title}</h1>
        <p>{message}</p>
        <div className="release-fallback-actions">
          {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
          <a href="/">Return to Nexus Setups</a>
        </div>
      </section>
    </main>
  );
}
