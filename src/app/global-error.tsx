"use client";

/** Last-resort boundary (root layout failed, e.g. database unreachable). No app styles are guaranteed here. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f3ef", color: "#0d0d0f", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, letterSpacing: "-0.03em" }}>Сервис временно недоступен</h1>
          <p style={{ color: "#7a7a80" }}>Мы уже чиним. Попробуйте через минуту.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 48, padding: "0 24px", borderRadius: 16, border: 0, background: "#0d0d0f", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Повторить
          </button>
        </div>
      </body>
    </html>
  );
}
