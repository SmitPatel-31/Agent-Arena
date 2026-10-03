import { NewRaceForm, type TaskOption } from '@/components/new-race-form';
import { DEFAULT_MODELS, MODELS } from '@/lib/models';
import { TASKS } from '@/tasks';

const STEPS = [
  {
    n: '01',
    title: 'Same tools, same task',
    body: 'Both models get an identical, curated set of Composio tools and act on the same real GitHub and Notion accounts, each writing only to its own labeled destination.',
  },
  {
    n: '02',
    title: 'Every call, live',
    body: 'Each tool call is timed by one instrumented wrapper and streamed to both lanes as it happens, including the errors and the rate-limit stalls.',
  },
  {
    n: '03',
    title: 'The world keeps score',
    body: "When the agents stop, the server checks the real result through Composio itself. A model's claim that it finished counts for nothing.",
  },
];

export default function Home() {
  // Task definitions hold functions; hand the client only plain data.
  const tasks: TaskOption[] = TASKS.map(({ id, title, summary, difficulty, toolkits }) => ({
    id,
    title,
    summary,
    difficulty,
    toolkits: [...toolkits],
  }));

  return (
    <div className="space-y-16">
      <section className="relative">
        <div className="bg-track pointer-events-none absolute -inset-x-6 -top-10 bottom-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="animate-rise-in flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-racer-a" /> Agent benchmark on real apps
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.4rem)] font-bold leading-[0.95] tracking-[-0.035em]">
            <span className="animate-rise-in block [animation-delay:80ms]">Two agents.</span>
            <span className="animate-rise-in block [animation-delay:160ms]">One real task.</span>
            <span className="animate-rise-in block text-muted [animation-delay:240ms]">The world keeps score.</span>
          </h1>
          <p className="animate-rise-in mt-6 max-w-[58ch] text-lg leading-relaxed text-muted [animation-delay:320ms]">
            Pick a task and two Gemini models. They race through the same Composio tools while you watch every call, then the app
            verifies the outcome itself.
          </p>
        </div>
      </section>

      <div className="animate-rise-in [animation-delay:400ms]">
        <NewRaceForm tasks={tasks} models={[...MODELS]} defaults={DEFAULT_MODELS} />
      </div>

      <section aria-labelledby="how" className="animate-rise-in [animation-delay:500ms]">
        <h2 id="how" className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          How a race works
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="group bg-surface p-6 transition-colors hover:bg-surface-2/60">
              <span className="font-mono text-xs text-muted transition-colors group-hover:text-racer-a">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
