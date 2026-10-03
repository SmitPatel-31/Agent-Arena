import { notFound } from 'next/navigation';
import { RaceView } from '@/components/race/race-view';
import { getRace } from '@/lib/db';
import { getTask } from '@/tasks';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RacePage({ params }: PageProps<'/race/[id]'>) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const race = await getRace(id);
  if (!race) notFound();

  return <RaceView race={race} taskTitle={getTask(race.taskId)?.title ?? race.taskId} />;
}
