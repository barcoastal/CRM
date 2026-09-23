export interface StadiumAudio { touchdown: AudioBuffer }

/** Audio is hosted by the CRM and only enabled after an explicit user gesture. */
export async function loadStadiumAudio(context: AudioContext): Promise<StadiumAudio> {
  const response = await fetch("/audio/scoreboard/football-touchdown-5s.mp3", { cache: "force-cache" });
  if (!response.ok) throw new Error("Touchdown audio could not load.");
  return { touchdown: await context.decodeAudioData(await response.arrayBuffer()) };
}

export function playStadiumTouchdown(context: AudioContext, audio: StadiumAudio): () => void {
  if (context.state !== "running") return () => {};
  const master = context.createGain();
  master.connect(context.destination);
  const start = context.currentTime;
  master.gain.setValueAtTime(.8, start);
  master.gain.setValueAtTime(.8, start + 4.9);
  master.gain.linearRampToValueAtTime(0, start + 5);
  const sources = [
    { buffer: audio.touchdown, delay: 0, volume: 1 },
  ].map(({ buffer, delay, volume }) => {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer; gain.gain.value = volume;
    source.connect(gain); gain.connect(master);
    source.start(start + delay); source.stop(start + Math.min(buffer.duration, 5));
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    return source;
  });
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } }
    master.disconnect();
  };
}

/** A short air rush follows the ball's flight, independent of the stadium clip. */
export function playPassSound(context: AudioContext): () => void {
  if (context.state !== "running") return () => {};
  const start = context.currentTime + .6;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.8), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource(); source.buffer = buffer;
  const filter = context.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = .65;
  filter.frequency.setValueAtTime(350, start);
  filter.frequency.exponentialRampToValueAtTime(2200, start + .65);
  filter.frequency.exponentialRampToValueAtTime(250, start + 1.7);
  const gain = context.createGain(); gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(.28, start + .6); gain.gain.linearRampToValueAtTime(0, start + 1.7);
  source.connect(filter); filter.connect(gain); gain.connect(context.destination);
  source.start(start); source.stop(start + 1.8);
  let stopped = false;
  const disconnect = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.onended = disconnect;
  return () => { if (!stopped) { stopped = true; try { source.stop(); } catch { /* Already ended. */ } disconnect(); } };
}
