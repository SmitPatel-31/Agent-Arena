import { NewRaceForm, type TaskOption } from '@/components/new-race-form';
import { DEFAULT_MODELS, MODELS } from '@/lib/models';
import { TASKS } from '@/tasks';

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
    <div className="mx-auto max-w-4xl">
      <section className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Two models. One real task. No self-grading.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Both racers get the same Composio tools and act on real accounts (GitHub, Notion and more). Every tool call streams live,
          and when they finish the app checks the real world itself, not the model&apos;s word, to decide who actually won.
        </p>
      </section>
      <NewRaceForm tasks={tasks} models={[...MODELS]} defaults={DEFAULT_MODELS} />
    </div>
  );
}
