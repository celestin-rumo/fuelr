/**
 * How a finished timer makes itself known: a sound, a buzz, a notification.
 *
 * Every one of them is allowed to be missing. A browser with no audio, a
 * phone that does not vibrate, notifications refused — none of that may stop
 * the timer from ending, because the in-page alert is what actually carries
 * the message and it always fires.
 */

let context: AudioContext | null = null;

type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/**
 * Called from the tap that starts a timer, and only from there: a page cannot
 * create or resume an audio context outside a gesture, so arming it later —
 * when the timer actually ends — is silence.
 */
export function armAlarm() {
  if (typeof window === "undefined") return;
  if (context) {
    if (context.state === "suspended") void context.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
  if (!Ctor) return;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
}

/** Three short beeps: audible over a fan, short enough not to be an insult. */
export function sound() {
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  const start = context.currentTime;
  for (let beep = 0; beep < 3; beep += 1) {
    const at = start + beep * 0.35;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.3);
  }
}

export function vibrate() {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // A browser that exposes it and refuses it anyway. Nothing to say.
  }
}

/**
 * Asked from the first timer the cook starts, never on page load — and never
 * twice. Once the answer is "denied" the browser keeps it, and asking again
 * is both impossible and rude.
 */
export async function askForNotifications() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Some browsers reject it outside a gesture. The alert still fires.
  }
}

export function notify(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    // Android requires a service worker for notifications; until there is
    // one, the sound and the in-page alert carry it.
  }
}
