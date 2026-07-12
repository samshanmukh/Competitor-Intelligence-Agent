'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { getWorkspace } from '../lib/auth';
import { useToast } from '../components/ui';

export function marketResearchJobKey() {
  return `cia_market_job_${getWorkspace()?.id || 'x'}`;
}

export function useMarketResearch({ onComplete } = {}) {
  const [researching, setResearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState('');
  const pollRef = useRef(null);
  const tickRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const toast = useToast();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = tickRef.current = null;
    setResearching(false);
    setPhase('');
    try {
      localStorage.removeItem(marketResearchJobKey());
    } catch {}
  }, []);

  const beginPolling = useCallback(
    (jobId, startedAt, { successTitle = 'Distribution updated' } = {}) => {
      try {
        localStorage.setItem(marketResearchJobKey(), JSON.stringify({ jobId, startedAt }));
      } catch {}
      setResearching(true);
      const tick = () => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(s);
        setPhase(phaseForElapsed(s));
      };
      tick();
      tickRef.current = setInterval(tick, 1000);

      const check = async () => {
        try {
          const { status, error } = await api.marketStatus(jobId);
          if (status === 'done') {
            stopPolling();
            await onCompleteRef.current?.();
            toast({ type: 'success', title: successTitle });
          } else if (status === 'error') {
            stopPolling();
            toast({ type: 'error', title: 'Research failed', message: error });
          }
        } catch (err) {
          if (err.code === 'JOB_NOT_FOUND') {
            stopPolling();
            toast({ type: 'error', title: 'Job expired', message: 'Please run again.' });
          }
        }
      };
      pollRef.current = setInterval(check, 5000);
      check();
    },
    [stopPolling, toast]
  );

  const runResearch = useCallback(async () => {
    try {
      const { jobId } = await api.marketStart();
      beginPolling(jobId, Date.now());
    } catch (err) {
      toast({ type: 'error', title: 'Could not start research', message: err.message });
    }
  }, [beginPolling, toast]);

  useEffect(() => {
    let raw;
    try {
      raw = localStorage.getItem(marketResearchJobKey());
    } catch {}
    if (raw) {
      try {
        const { jobId, startedAt } = JSON.parse(raw);
        if (jobId) beginPolling(jobId, startedAt || Date.now(), { successTitle: 'Research complete' });
      } catch {}
    }
    return () => stopPolling();
  }, [beginPolling, stopPolling]);

  return { researching, elapsed, phase, runResearch, stopPolling };
}

function phaseForElapsed(seconds) {
  if (seconds < 20) return 'Starting finance research…';
  if (seconds < 60) return 'Gathering traffic & review signals…';
  if (seconds < 120) return 'Triangulating market presence…';
  if (seconds < 180) return 'Checking syndicated share…';
  return 'Finalizing distribution & insights…';
}
