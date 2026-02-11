'use client';

import { useEffect } from 'react';

const RECOVERY_STATE_KEY = 'andra-meals:chunk-load-recovery';
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

type RecoveryState = {
  source: string;
  at: number;
};

function safeReadState(): RecoveryState | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STATE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RecoveryState>;
    if (typeof parsed.source !== 'string' || typeof parsed.at !== 'number') {
      sessionStorage.removeItem(RECOVERY_STATE_KEY);
      return null;
    }

    if (Date.now() - parsed.at > RECOVERY_WINDOW_MS) {
      sessionStorage.removeItem(RECOVERY_STATE_KEY);
      return null;
    }

    return { source: parsed.source, at: parsed.at };
  } catch {
    return null;
  }
}

function safeWriteState(source: string) {
  try {
    const payload: RecoveryState = { source, at: Date.now() };
    sessionStorage.setItem(RECOVERY_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore write failures (private mode/storage restrictions).
  }
}

function isChunkAssetPath(value: string) {
  return value.includes('/_next/static/chunks/');
}

function isChunkErrorText(value: string) {
  const text = value.toLowerCase();
  return (
    text.includes('chunkloaderror') ||
    text.includes('loading chunk') ||
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('/_next/static/chunks/')
  );
}

function extractChunkSource(value: string): string {
  const match = value.match(/https?:\/\/[^\s"'`]+\/_next\/static\/chunks\/[^\s"'`)]+/i);
  if (match?.[0]) return match[0];
  return value;
}

function getSourceFromErrorEvent(event: ErrorEvent): string {
  const eventTarget = event.target as
    | (EventTarget & { src?: string; href?: string })
    | null;

  if (eventTarget?.src && isChunkAssetPath(eventTarget.src)) {
    return eventTarget.src;
  }

  if (eventTarget?.href && isChunkAssetPath(eventTarget.href)) {
    return eventTarget.href;
  }

  if (event.filename && isChunkAssetPath(event.filename)) {
    return event.filename;
  }

  return `${event.message || 'unknown-error'}`;
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const attemptRecovery = (source: string) => {
      const normalizedSource = source.trim();
      if (!normalizedSource) return;

      const previous = safeReadState();
      if (previous?.source === normalizedSource) {
        return;
      }

      safeWriteState(normalizedSource);
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const source = getSourceFromErrorEvent(event);
      if (!isChunkAssetPath(source) && !isChunkErrorText(source)) {
        return;
      }

      attemptRecovery(source);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : typeof reason === 'string'
            ? reason
            : JSON.stringify(reason);

      if (!message || !isChunkErrorText(message)) {
        return;
      }

      attemptRecovery(extractChunkSource(message));
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
