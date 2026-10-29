"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SAMPLE_RATE = 22050;

const TRACKS = [
  {
    file: "晨雾 - 林间电台.wav",
    seconds: 26,
    key: 60,
    progression: [
      [0, 4, 7, 11],
      [-3, 2, 5, 9],
      [-7, -2, 2, 5],
      [-5, 0, 4, 7],
    ],
    step: 0.32,
  },
  {
    file: "Afterglow - Nova & 林间电台.wav",
    seconds: 30,
    key: 57,
    progression: [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [-7, -2, 2, 5],
      [-5, 0, 3, 7],
    ],
    step: 0.36,
  },
  {
    file: "潮汐来信 - 海边的房间 & 林间电台.wav",
    seconds: 28,
    key: 62,
    progression: [
      [0, 4, 7, 14],
      [-3, 2, 5, 9],
      [-7, -2, 2, 5],
      [-5, 0, 4, 7],
    ],
    step: 0.3,
  },
  {
    file: "Paper Boat - June & Nova.wav",
    seconds: 24,
    key: 55,
    progression: [
      [0, 4, 7, 11],
      [-3, 0, 4, 7],
      [-7, -2, 2, 7],
      [-5, 0, 4, 9],
    ],
    step: 0.34,
  },
  {
    file: "慢慢 - 陈默.wav",
    seconds: 32,
    key: 53,
    progression: [
      [0, 3, 7, 10],
      [-4, 0, 3, 10],
      [-2, 2, 5, 9],
      [-7, -2, 0, 5],
    ],
    step: 0.42,
  },
  {
    file: "夜行列车 - 北纬三十度 & 陈默.wav",
    seconds: 34,
    key: 52,
    progression: [
      [0, 7, 12, 15],
      [-2, 5, 10, 14],
      [-4, 3, 7, 12],
      [-5, 2, 7, 11],
    ],
    step: 0.33,
  },
  {
    file: "Sunday Morning - June.wav",
    seconds: 22,
    key: 65,
    progression: [
      [0, 4, 7, 11],
      [-3, 2, 5, 9],
      [-7, -2, 2, 5],
      [-5, 0, 4, 7],
    ],
    step: 0.31,
  },
];

function midiToHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function synthTrack(config) {
  const total = Math.floor(SAMPLE_RATE * config.seconds);
  const samples = new Float32Array(total);
  const chordLength = config.seconds / config.progression.length;
  const phase = hash(config.file) / 0xffffffff;
  const step = config.step;

  for (let index = 0; index < total; index += 1) {
    const time = index / SAMPLE_RATE;
    const chordIndex = Math.min(
      config.progression.length - 1,
      Math.floor(time / chordLength),
    );
    const chord = config.progression[chordIndex];
    let sample = 0;

    for (let voice = 0; voice < chord.length; voice += 1) {
      const frequency = midiToHz(config.key + chord[voice]);
      const detune = 1 + (voice % 2 === 0 ? 0.0015 : -0.0012);
      const local = time - chordIndex * chordLength;
      const attack = smoothstep(local / 1.4);
      const release = smoothstep((chordLength - local) / 1.8);
      const level = 0.038 * attack * release;
      sample += Math.sin(2 * Math.PI * frequency * detune * time) * level;
      sample +=
        Math.sin(2 * Math.PI * frequency * 2 * time + 0.4) * level * 0.18;
      sample +=
        Math.sin(2 * Math.PI * frequency * 0.5 * time) * level * 0.12;
    }

    const beat = Math.floor(time / step);
    const beatTime = time - beat * step;
    const arpNote =
      config.key +
      chord[beat % chord.length] +
      (beat % 8 >= 4 ? 12 : 0);
    const arpFreq = midiToHz(arpNote);
    const pluck = Math.exp(-beatTime * 4.6) * 0.12;
    sample += Math.sin(2 * Math.PI * arpFreq * time) * pluck;
    sample += Math.sin(2 * Math.PI * arpFreq * 2 * time + 0.2) * pluck * 0.22;

    const sway = 0.86 + 0.14 * Math.sin(2 * Math.PI * 0.055 * time + phase * 6);
    const fade = Math.min(1, time / 1.6, (config.seconds - time) / 2.2);
    samples[index] = sample * sway * Math.max(0, fade);
  }

  let peak = 0;
  for (let index = 0; index < total; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const scale = peak > 0 ? 0.72 / peak : 1;

  const buffer = Buffer.alloc(44 + total * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + total * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(total * 2, 40);
  for (let index = 0; index < total; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] * scale));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

function ensureDemoFiles(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const track of TRACKS) {
    const target = path.join(directory, track.file);
    if (fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.size > 44) continue;
    }
    fs.writeFileSync(target, synthTrack(track));
  }
  return directory;
}

module.exports = { TRACKS, ensureDemoFiles };
