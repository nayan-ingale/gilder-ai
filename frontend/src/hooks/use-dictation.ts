'use client';

import { useRef, useState, useSyncExternalStore } from 'react';

/** The parts of the browser's speech recognition this hook uses. */
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  results: { length: number; [index: number]: SpeechResult };
}
interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognizerClass = new () => SpeechRecognizer;

function recognizerClass(): RecognizerClass | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognizerClass;
    webkitSpeechRecognition?: RecognizerClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

const noSubscription = () => () => {};

export interface Dictation {
  /** False on the server and in browsers without speech recognition, where the mic is hidden. */
  supported: boolean;
  listening: boolean;
  /** Starts listening, or stops if it already is. */
  toggle: () => void;
}

/**
 * Speech to text with the browser's own recognition (Chrome, Edge and Safari). While it listens,
 * `onText` gets the text so far after `base`, the words already in the box.
 */
export function useDictation(
  base: () => string,
  onText: (text: string) => void,
  onBlocked: () => void,
): Dictation {
  const supported = useSyncExternalStore(
    noSubscription,
    () => recognizerClass() !== undefined,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const recognizer = useRef<SpeechRecognizer | null>(null);

  function toggle() {
    if (recognizer.current) {
      recognizer.current.stop();
      return;
    }
    const Recognizer = recognizerClass();
    if (!Recognizer) {
      return;
    }
    const start = base();
    const lead = start === '' || /\s$/.test(start) ? start : `${start} `;
    const instance = new Recognizer();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || 'en-IN';
    instance.onresult = (event) => {
      let spoken = '';
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += event.results[index]?.[0].transcript ?? '';
      }
      onText(`${lead}${spoken.trimStart()}`);
    };
    instance.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onBlocked();
      }
    };
    instance.onend = () => {
      recognizer.current = null;
      setListening(false);
    };
    recognizer.current = instance;
    setListening(true);
    instance.start();
  }

  return { supported, listening, toggle };
}
