/**
 * Web Audio API - Bel Restoran / Dapur
 * Memainkan lonceng bel bernada ganda (Ding-Dong) 3 kali berturut-turut.
 * Murni client-side, tanpa perlu mengunduh file MP3 eksternal.
 */

function playSingleDing(ctx: AudioContext, delaySeconds: number) {
  const startTime = ctx.currentTime + delaySeconds;

  // Oscillator 1: Nada Utama D5 (587.33 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();

  osc1.type = "sine";
  osc1.frequency.setValueAtTime(587.33, startTime);
  osc1.frequency.exponentialRampToValueAtTime(880, startTime + 0.12); // Meluncur ke A5

  gain1.gain.setValueAtTime(0.4, startTime);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(startTime);
  osc1.stop(startTime + 0.65);

  // Oscillator 2: Harmoni nada tinggi C6 (1046.5 Hz) untuk efek pantulan bel logam
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(1046.5, startTime + 0.05);

  gain2.gain.setValueAtTime(0.15, startTime + 0.05);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(startTime + 0.05);
  osc2.stop(startTime + 0.5);
}

export function playKitchenChimeTriple() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const ctx = new AudioCtx();

    // Bunyi 3 kali: detik 0, detik 0.7, dan detik 1.4
    playSingleDing(ctx, 0);
    playSingleDing(ctx, 0.7);
    playSingleDing(ctx, 1.4);
  } catch (err) {
    console.log("Audio notification tidak diizinkan oleh browser:", err);
  }
}

