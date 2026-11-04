// The first screen. Step E6 replaces it with the real layout: sidebar, graph and detail panel.
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-lg font-semibold text-neutral-100">GilderAi Docs Explorer</h1>
      <p className="text-sm text-neutral-400">
        Architecture, request flows and the real source code arrive in the next steps.
      </p>
    </main>
  );
}
