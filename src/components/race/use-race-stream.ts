'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { applyEvent, initialRaceState, type RaceState } from '@/lib/race-state';
import type { RaceSummary, StreamEvent } from '@/lib/types';

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'done' | 'failed';

export interface RaceStream {
  state: RaceState;
  final: { race: RaceSummary; interrupted: boolean } | null;
  connection: Connection;
  error: string | null;
}

export function useRaceStream(raceId: string): RaceStream {
  const [state, dispatch] = useReducer(applyEvent, undefined, initialRaceState);
  const [final, setFinal] = useState<RaceStream['final']>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState<string | null>(null);
  // EventSource resumes with Last-Event-ID, and dev-mode effects run twice: drop anything already applied.
  const lastId = useRef(0);

  useEffect(() => {
    const source = new EventSource(`/api/races/${raceId}/stream`);

    source.onopen = () => setConnection('live');
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) setConnection('failed');
      else setConnection('reconnecting');
    };
    source.addEventListener('run', (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as StreamEvent;
      if (event.id <= lastId.current) return;
      lastId.current = event.id;
      dispatch(event);
    });
    source.addEventListener('done', (message) => {
      setFinal(JSON.parse((message as MessageEvent<string>).data) as RaceStream['final']);
      setConnection('done');
      source.close();
    });
    source.addEventListener('stream_error', (message) => {
      const { message: text } = JSON.parse((message as MessageEvent<string>).data) as { message: string };
      setError(text);
    });

    return () => source.close();
  }, [raceId]);

  return { state, final, connection, error };
}
