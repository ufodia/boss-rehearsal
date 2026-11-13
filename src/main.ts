import './style.css';
import runtimeScript from '../.generated/player.js?raw';
import { sampleLesson, validateLesson, inputLabel, exportLessonHtml } from './core';

type Lesson = ReturnType<typeof sampleLesson>;
type Cue = Lesson['cues'][number];
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Boss Rehearsal application root is missing.');
let lesson: Lesson = sampleLesson();
let selectedCueId = lesson.cues[0]!.id;
let mediaUrl: string | null = null;
let duration: number | null = null;
let currentTime = 0;
let mediaKind: 'sample' | 'upload' | 'import' | 'missing' = 'missing';
let loadingVideo = false;
let loadEpoch = 0;
let includeVideo = true;
let unsaved = false;
let playerHtml: string | null = null;
let recordingInput = false;
let message = 'Loading the original training clip. Your footage stays on your computer.';
let messageKind: 'info' | 'success' | 'error' = 'info';
const maxVideoBytes = 80 * 1024 * 1024;
const keyboardInputs = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  ...Array.from({ length: 26 }, (_, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
];
const gamepadInputs = Array.from({ length: 16 }, (_, i) => `Gamepad${i}`);

function h(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}
function icon(name: string): string {
  const paths: Record<string, string> = {
    play: '<path d="m8 4 12 8-12 8V4Z"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    coffee:
      '<path d="M4 7h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Zm13 1h2a3 3 0 0 1 0 6h-2M7 2v2m4-2v2m4-2v2"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4"/>',
    target:
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    key: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}
function timecode(time: number): string {
  if (!Number.isFinite(time)) return '—:—';
  const minutes = Math.floor(Math.max(0, time) / 60),
    seconds = Math.max(0, time) % 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
}
function selectedCue(): Cue {
  return lesson.cues.find((cue) => cue.id === selectedCueId) || lesson.cues[0]!;
}
function tell(text: string, kind: typeof messageKind = 'info'): void {
  message = text;
  messageKind = kind;
}
function validityError(): string | null {
  try {
    validateLesson(lesson, duration ?? undefined);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Review the lesson before practicing.';
  }
}
function canPractice(): boolean {
  return !!lesson.videoDataUrl && duration !== null && !loadingVideo && !validityError();
}
function pauseEditor(): void {
  const video = document.getElementById('practice-video') as HTMLVideoElement | null;
  if (video) {
    video.ontimeupdate = null;
    video.onseeked = null;
    video.onloadedmetadata = null;
    video.pause();
  }
}
function changed(): void {
  playerHtml = null;
  unsaved = true;
  pauseEditor();
  const error = validityError();
  tell(error || 'Lesson updated. Save it to keep your cues and footage.', error ? 'error' : 'info');
}
function applyLesson(next: Lesson): void {
  lesson = validateLesson(next);
  changed();
}
function updateCue(next: Cue): void {
  applyLesson({ ...lesson, cues: lesson.cues.map((cue) => (cue.id === next.id ? next : cue)) });
}
function safeName(): string {
  return (
    lesson.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'boss-rehearsal'
  );
}
function download(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function stopPractice(): void {
  playerHtml = null;
  const frame = document.getElementById('practice-player') as HTMLIFrameElement | null;
  if (frame) {
    frame.srcdoc = '';
    frame.remove();
  }
  const dialog = document.getElementById('practice-dialog') as HTMLDialogElement | null;
  if (dialog?.open) dialog.close();
}
function revokeMedia(): void {
  pauseEditor();
  if (mediaUrl) {
    URL.revokeObjectURL(mediaUrl);
    mediaUrl = null;
  }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error('The video could not be read. Try a different local file.'));
    reader.readAsDataURL(blob);
  });
}
/** Inspect real media metadata. A seek may finalize duration for some WebM files. */
function probeMedia(blob: Blob): Promise<{ url: string; duration: number }> {
  const url = URL.createObjectURL(blob);
  const probe = document.createElement('video');
  probe.preload = 'metadata';
  probe.muted = true;
  return new Promise((resolve, reject) => {
    let settled = false;
    let attemptedSeek = false;
    const timer = window.setTimeout(
      () =>
        finish(
          new Error(
            'This video did not expose a finite duration. Re-export a finalized MP4 or WebM, then try again.',
          ),
        ),
      15000,
    );
    function finish(error?: Error): void {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const actualDuration = probe.duration;
      probe.onloadedmetadata = null;
      probe.ondurationchange = null;
      probe.onseeked = null;
      probe.onerror = null;
      probe.pause();
      probe.removeAttribute('src');
      probe.load();
      if (error) {
        URL.revokeObjectURL(url);
        reject(error);
      } else resolve({ url, duration: actualDuration });
    }
    function inspect(): void {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        finish(
          probe.duration > 21600
            ? new Error('Use a practice video no longer than six hours.')
            : undefined,
        );
        return;
      }
      if (probe.readyState >= 1 && !attemptedSeek) {
        attemptedSeek = true;
        try {
          probe.currentTime = 1e10;
        } catch {
          finish(
            new Error(
              'The video has unreadable duration metadata. Re-export a finalized MP4 or WebM.',
            ),
          );
        }
      }
    }
    probe.onloadedmetadata = inspect;
    probe.ondurationchange = inspect;
    probe.onseeked = inspect;
    probe.onerror = () =>
      finish(
        new Error(
          'This browser could not read the video. Use a playable MP4 or WebM with finalized duration metadata.',
        ),
      );
    probe.src = url;
  });
}
async function loadMedia(
  blob: Blob,
  videoName: string,
  kind: typeof mediaKind,
  existingData?: string,
): Promise<void> {
  const epoch = ++loadEpoch;
  stopPractice();
  pauseEditor();
  loadingVideo = true;
  recordingInput = false;
  tell('Reading the video and checking its actual duration. Nothing is uploaded.');
  render();
  let probed: { url: string; duration: number } | null = null;
  try {
    if (blob.size > maxVideoBytes)
      throw new Error(
        'Practice videos must be no larger than 80 MiB. Trim or compress a copy first.',
      );
    if (!['video/mp4', 'video/webm'].includes(blob.type))
      throw new Error('Choose an MP4 or WebM practice video.');
    const embedded = existingData || (await dataUrl(blob));
    const next = validateLesson({
      ...lesson,
      videoName: videoName.slice(0, 160),
      videoDataUrl: embedded,
    });
    probed = await probeMedia(blob);
    if (epoch !== loadEpoch) {
      URL.revokeObjectURL(probed.url);
      return;
    }
    revokeMedia();
    mediaUrl = probed.url;
    duration = probed.duration;
    lesson = next;
    mediaKind = kind;
    currentTime = 0;
    unsaved = kind === 'sample' ? unsaved : true;
    const invalid = validityError();
    tell(
      invalid
        ? `Video loaded (${timecode(duration)}). ${invalid} Adjust or remove any out-of-range cues before practicing.`
        : `${kind === 'sample' ? 'Original training clip' : 'Practice video'} ready · ${timecode(duration)}. Scrub to a tell, add a cue, and rehearse the response.`,
      invalid ? 'error' : 'success',
    );
  } catch (error) {
    if (probed) URL.revokeObjectURL(probed.url);
    if (epoch === loadEpoch)
      tell(error instanceof Error ? error.message : 'The video could not be loaded.', 'error');
  } finally {
    if (epoch === loadEpoch) {
      loadingVideo = false;
      render();
    }
  }
}
async function loadSample(): Promise<void> {
  const epoch = ++loadEpoch;
  stopPractice();
  revokeMedia();
  lesson = sampleLesson();
  selectedCueId = lesson.cues[0]!.id;
  duration = null;
  currentTime = 0;
  mediaKind = 'missing';
  unsaved = false;
  loadingVideo = true;
  tell('Loading the original, synthetic training clip.');
  render();
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}demo/training.webm`);
    if (!response.ok)
      throw new Error(
        'The original sample clip is unavailable. Upload a local MP4 or WebM to continue.',
      );
    const bytes = await response.arrayBuffer();
    if (epoch !== loadEpoch) return;
    await loadMedia(new Blob([bytes], { type: 'video/webm' }), 'training.webm', 'sample');
  } catch (error) {
    if (epoch === loadEpoch) {
      loadingVideo = false;
      tell(error instanceof Error ? error.message : 'The sample could not be loaded.', 'error');
      render();
    }
  }
}
function inputOptions(current: string): string {
  return `<optgroup label="Keyboard">${keyboardInputs.map((input) => `<option value="${input}" ${input === current ? 'selected' : ''}>${h(inputLabel(input))}</option>`).join('')}</optgroup><optgroup label="Gamepad buttons">${gamepadInputs.map((input) => `<option value="${input}" ${input === current ? 'selected' : ''}>${h(inputLabel(input))}</option>`).join('')}</optgroup>`;
}

function render(): void {
  pauseEditor();
  const cue = selectedCue();
  const selectedIndex = lesson.cues.indexOf(cue);
  const valid = canPractice();
  const error = validityError();
  const timelineDuration = duration || Math.max(8, ...lesson.cues.map((item) => item.time + 1));
  root!.innerHTML = `<header class="site-header"><a class="brand" href="./" aria-label="Boss Rehearsal home"><span class="brand-mark" aria-hidden="true"><i></i></span><span>boss<span>rehearsal</span><sup>↗</sup></span></a><span class="header-caption">RECOGNIZE THE TELL.<br><b>PRACTICE THE DECISION.</b></span><nav class="header-actions" aria-label="Lesson actions"><button class="button quiet" data-action="sample" ${loadingVideo ? 'disabled' : ''}>Load sample</button><button class="button quiet" data-action="open" ${loadingVideo ? 'disabled' : ''}>${icon('upload')} Open lesson</button><button class="button outline" data-action="save" ${loadingVideo || error ? 'disabled' : ''}>${icon('save')} Save lesson</button><a class="support-button" href="https://buymeacoffee.com/ufodia" target="_blank" rel="noopener noreferrer" aria-label="Support ufodia on Buy Me a Coffee">${icon('coffee')}<span>Keep the reel rolling</span></a></nav></header>
  <main><section class="intro"><div><p class="eyebrow"><span class="record-dot"></span> TRAINING FILM / LESSON EDITOR</p><h1>The tell is there. <span>Learn to see it.</span></h1><p>Your own footage. A few deliberate cues. A better next attempt.</p></div><div class="local-badge"><span class="local-symbol">${icon('film')}</span><div><strong>Replay the moment.</strong><span>Local video · No game hooks · No uploads</span></div></div></section>
  <section class="lesson-strip" aria-label="Lesson details"><label>LESSON NAME<input data-lesson-field="name" aria-label="Lesson name" value="${h(lesson.name)}" maxlength="120"></label><label>WHAT YOU ARE WORKING ON<input data-lesson-field="description" aria-label="Lesson description" value="${h(lesson.description)}" maxlength="800"></label><div class="lesson-count"><span>MARKED MOMENTS</span><strong>${lesson.cues.length.toString().padStart(2, '0')}</strong></div></section>
  <div class="status-line ${messageKind}" role="status" aria-live="polite"><i></i><span>${h(message)}</span>${loadingVideo ? '<span class="loading-label"><i class="spinner"></i> READING MEDIA</span>' : '<span class="local-label">YOUR COMPUTER IS THE TRAINING ROOM</span>'}</div>
  <div class="editor-layout"><section class="film-workspace"><div class="video-panel panel"><div class="video-heading"><div><span class="eyebrow">01 / THE FOOTAGE</span><h2>${h(lesson.videoName)}</h2></div><div class="media-actions"><span class="media-badge">${mediaKind === 'sample' ? 'ORIGINAL SAMPLE' : mediaKind === 'upload' ? 'YOUR LOCAL VIDEO' : mediaKind === 'import' ? 'IMPORTED VIDEO' : 'VIDEO NEEDED'}</span><button class="button outline small" data-action="upload" ${loadingVideo ? 'disabled' : ''}>${icon('upload')} Upload video</button></div></div><div class="video-screen"><video id="practice-video" data-testid="video-editor" controls playsinline preload="metadata" aria-label="Practice video editor"></video>${!mediaUrl ? `<div class="video-empty"><div class="empty-reticle">${icon('target')}</div><strong>${loadingVideo ? 'Preparing the training film…' : 'Bring the moment into focus.'}</strong><p>${loadingVideo ? 'Checking the file and its real duration.' : `Load ${h(lesson.videoName)} or another local MP4 / WebM to edit and practice this lesson.`}</p><span>${loadingVideo ? 'NO FOOTAGE LEAVES YOUR COMPUTER' : 'UP TO 80 MiB · MP4 / WEBM'}</span></div>` : ''}<span class="video-corner top-left"></span><span class="video-corner top-right"></span><span class="video-corner bottom-left"></span><span class="video-corner bottom-right"></span></div><div class="playhead-toolbar"><span class="playhead-caption">PLAYHEAD <strong id="playhead-value">${timecode(currentTime)}</strong><span>/ ${duration === null ? 'duration not loaded' : timecode(duration)}</span></span><button class="button red small" data-action="add-cue" ${duration === null || loadingVideo || lesson.cues.length >= 32 ? 'disabled' : ''}>${icon('plus')} Add cue at playhead</button></div><div class="timeline"><div class="timeline-scale"><span>00:00</span><span>${duration === null ? 'LOAD VIDEO TO SCRUB' : timecode(duration)}</span></div><div class="cue-track" aria-label="Cue positions">${lesson.cues.map((item, index) => `<button class="timeline-cue ${item.id === cue.id ? 'selected' : ''}" data-action="seek-cue" data-id="${h(item.id)}" style="left:${Math.min(99, (item.time / timelineDuration) * 100)}%" aria-label="Seek to ${h(item.title)} at ${timecode(item.time)}" ${duration === null ? 'disabled' : ''}><i></i><span>${index + 1}</span></button>`).join('')}<span id="timeline-playhead" class="timeline-playhead" style="left:${(currentTime / timelineDuration) * 100}%"></span></div><label class="sr-only" for="playhead-slider">Playhead in seconds</label><input id="playhead-slider" type="range" min="0" max="${duration || 0}" step="0.01" value="${currentTime}" ${duration === null ? 'disabled' : ''}></div><p class="footage-note">${mediaKind === 'sample' ? 'This original synthetic clip demonstrates visual cues. Bring your own recordings for game-specific practice.' : 'Use footage you have the right to work with. The editor reads it locally and never connects to the game process.'}</p></div>
  <section class="cues-panel panel"><div class="panel-heading"><div><p class="eyebrow">02 / THE MOMENTS THAT MATTER</p><h2>Your cue sheet</h2></div><span class="cue-cap">${lesson.cues.length} / 32</span></div><div class="cue-list" data-testid="cue-list">${lesson.cues.map((item, index) => `<article class="cue-row ${item.id === cue.id ? 'selected' : ''} ${duration !== null && item.time >= duration ? 'out-of-range' : ''}"><button class="cue-select" data-action="select-cue" data-id="${h(item.id)}" aria-label="Edit cue ${index + 1}: ${h(item.title)}" aria-current="${item.id === cue.id ? 'true' : 'false'}"><span class="cue-index">${String(index + 1).padStart(2, '0')}</span><span class="cue-title"><strong>${h(item.title)}</strong><small>${item.mode === 'decision' ? 'DECISION' : 'TIMING WINDOW'}</small></span><span class="cue-time">${timecode(item.time)}</span><span class="input-chip">${h(inputLabel(item.expectedInput))}</span></button><button class="icon-button remove-cue" data-action="remove-cue" data-id="${h(item.id)}" aria-label="Delete ${h(item.title)} cue" ${lesson.cues.length <= 1 ? 'disabled' : ''}>${icon('close')}</button></article>`).join('')}</div><p class="cue-sheet-note">Cue times are checked against the loaded video. Select a moment to edit its response; seek with the timeline markers above.</p></section></section>
  <aside class="cue-inspector panel" data-testid="cue-editor"><div class="panel-heading"><div><p class="eyebrow">03 / THE RESPONSE</p><h2>Train the decision.</h2></div><span class="selected-cue-index">${String(selectedIndex + 1).padStart(2, '0')}</span></div><div class="inspector-fields"><label>Cue title<input data-cue-field="title" aria-label="Cue title" value="${h(cue.title)}" maxlength="80"></label><label>Cue time <span>seconds</span><input data-cue-field="time" aria-label="Cue time in seconds" type="number" min="0" max="${duration !== null ? Math.max(0, duration - 0.001) : 21600}" step="0.01" value="${cue.time}"></label><label>Expected input<select data-cue-field="expectedInput" aria-label="Expected input">${inputOptions(cue.expectedInput)}</select></label><button class="record-input ${recordingInput ? 'recording' : ''}" data-action="record-input">${icon('key')}${recordingInput ? 'Press a key… Escape to cancel' : 'Record a keyboard input'}</button><label>Practice mode<select data-cue-field="mode" aria-label="Practice mode"><option value="decision" ${cue.mode === 'decision' ? 'selected' : ''}>Decision · recognize and choose</option><option value="timing" ${cue.mode === 'timing' ? 'selected' : ''}>Timing · find the response window</option></select></label><p class="field-hint">${cue.mode === 'decision' ? 'Practice recognizing the cue and choosing its expected input.' : 'Practice the chosen input against a target response delay and tolerance.'}</p><div class="timing-fields"><label>Target delay <span>ms</span><input data-cue-field="targetDelayMs" aria-label="Target delay in milliseconds" type="number" min="0" max="5000" step="1" value="${cue.targetDelayMs}" ${cue.mode === 'decision' ? 'disabled' : ''}></label><label>Tolerance <span>± ms</span><input data-cue-field="toleranceMs" aria-label="Timing tolerance in milliseconds" type="number" min="20" max="2000" step="1" value="${cue.toleranceMs}" ${cue.mode === 'decision' ? 'disabled' : ''}></label></div></div><div class="session-settings"><h3>${icon('clock')} The run-up</h3><label>Lead-in <span>seconds</span><input data-lesson-field="leadInSeconds" aria-label="Lead-in in seconds" type="number" min="0.25" max="10" step="0.05" value="${lesson.leadInSeconds}"></label><label>Playback speed<select data-lesson-field="playbackRate" aria-label="Playback speed">${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => `<option value="${rate}" ${Math.abs(rate - lesson.playbackRate) < 0.001 ? 'selected' : ''}>${rate}×${rate === 1 ? ' · original speed' : ''}</option>`).join('')}${![0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(lesson.playbackRate) ? `<option value="${lesson.playbackRate}" selected>${lesson.playbackRate}× · custom</option>` : ''}</select></label><p class="field-hint">A little context before each cue. Keep the run-up short enough to repeat.</p></div><div class="practice-actions"><button class="button red" data-action="practice" ${!valid ? 'disabled' : ''}>${icon('play')} Start practice ${icon('arrow')}</button><button class="button outline" data-action="download" ${!valid ? 'disabled' : ''}>${icon('download')} Download trainer</button>${!valid ? `<p class="practice-requirement">${h(loadingVideo ? 'Wait for the video to finish loading.' : error || 'Load the video to enable practice and portable trainer export.')}</p>` : '<p class="practice-requirement">Keyboard and gamepad input · no connection to the game</p>'}</div></aside></div>
  <section class="portable-note"><span class="portable-icon">${icon('save')}</span><div><h2>Keep the lesson. Take the practice.</h2><p>Lesson files include the video by default. A downloaded trainer carries its own player and footage.</p></div><label><input id="include-video" type="checkbox" ${includeVideo ? 'checked' : ''}> Include video when saving the lesson</label></section><footer class="site-footer"><span><i></i> Repetition, with a reason.</span><span>MIT © ufodia <a href="https://github.com/ufodia/boss-rehearsal" target="_blank" rel="noopener noreferrer">View source ↗</a></span></footer></main>
  <input id="video-file" type="file" accept="video/mp4,video/webm,.mp4,.webm" aria-label="Upload practice video" hidden><input id="lesson-file" type="file" accept="application/json,.json" aria-label="Import lesson" hidden><dialog id="practice-dialog" aria-labelledby="practice-dialog-title"><div class="practice-dialog-header"><div><p class="eyebrow">PRACTICE ROOM</p><h2 id="practice-dialog-title">${h(lesson.name)}</h2></div><button class="button outline" data-action="close-practice">${icon('close')} Close practice</button></div>${playerHtml ? '<iframe id="practice-player" data-testid="player-frame" title="Boss Rehearsal practice player" allow="autoplay" sandbox="allow-scripts allow-same-origin"></iframe>' : ''}</dialog>`;
  bindEvents();
  setupEditorVideo();
  if (playerHtml) {
    (document.getElementById('practice-player') as HTMLIFrameElement).srcdoc = playerHtml;
    (document.getElementById('practice-dialog') as HTMLDialogElement).showModal();
  }
}

function updatePlayhead(): void {
  const display = document.getElementById('playhead-value');
  if (display) display.textContent = timecode(currentTime);
  const slider = document.getElementById('playhead-slider') as HTMLInputElement | null;
  if (slider) slider.value = String(currentTime);
  const marker = document.getElementById('timeline-playhead');
  if (marker) marker.style.left = `${duration ? (currentTime / duration) * 100 : 0}%`;
}
function setupEditorVideo(): void {
  const video = document.getElementById('practice-video') as HTMLVideoElement;
  if (!mediaUrl) return;
  video.src = mediaUrl;
  video.playbackRate = lesson.playbackRate;
  video.onloadedmetadata = () => {
    if (duration !== null) video.currentTime = Math.min(currentTime, Math.max(0, duration - 0.001));
  };
  video.ontimeupdate = () => {
    currentTime = video.currentTime;
    updatePlayhead();
  };
  video.onseeked = () => {
    currentTime = video.currentTime;
    updatePlayhead();
  };
}
function seek(time: number): void {
  if (duration === null) return;
  currentTime = Math.max(0, Math.min(time, duration - 0.001));
  const video = document.getElementById('practice-video') as HTMLVideoElement | null;
  if (video) {
    video.pause();
    video.currentTime = currentTime;
  }
  updatePlayhead();
}
async function importLesson(file: File): Promise<void> {
  if (file.size > 112 * 1024 * 1024)
    throw new Error('Lesson JSON must be no larger than 112 MiB, including any embedded video.');
  const imported = validateLesson(JSON.parse(await file.text()));
  if (
    unsaved &&
    !window.confirm('Replace this unsaved lesson? Save it first if you want to keep your changes.')
  )
    return;
  ++loadEpoch;
  stopPractice();
  revokeMedia();
  lesson = imported;
  selectedCueId = lesson.cues[0]!.id;
  currentTime = 0;
  duration = null;
  mediaKind = 'missing';
  recordingInput = false;
  unsaved = false;
  if (imported.videoDataUrl) {
    const response = await fetch(imported.videoDataUrl);
    const blob = await response.blob();
    await loadMedia(blob, imported.videoName, 'import', imported.videoDataUrl);
    unsaved = false;
  } else {
    tell(
      `Lesson opened. Reload “${imported.videoName}” from your computer to verify its cue times and practice.`,
      'info',
    );
    render();
  }
}

function bindEvents(): void {
  root!.onclick = (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    try {
      if (action === 'sample') {
        if (unsaved && !window.confirm('Replace this unsaved lesson with the original sample?'))
          return;
        void loadSample();
        return;
      }
      if (action === 'upload') {
        document.getElementById('video-file')!.click();
        return;
      }
      if (action === 'open') {
        document.getElementById('lesson-file')!.click();
        return;
      }
      if (action === 'save') {
        const checked = validateLesson(lesson, duration ?? undefined);
        if (includeVideo)
          download(
            JSON.stringify(checked, null, 2),
            `${safeName()}.boss-rehearsal.json`,
            'application/json',
          );
        else {
          const { videoDataUrl: _video, ...withoutVideo } = checked;
          download(
            JSON.stringify(withoutVideo, null, 2),
            `${safeName()}.boss-rehearsal.json`,
            'application/json',
          );
        }
        unsaved = false;
        tell(
          includeVideo && lesson.videoDataUrl
            ? 'Portable lesson saved with its video and cues.'
            : 'Lesson metadata saved. Reload the named video when reopening this file.',
          'success',
        );
      }
      if (action === 'select-cue') {
        selectedCueId = button.dataset.id!;
        recordingInput = false;
      }
      if (action === 'seek-cue') {
        const cue = lesson.cues.find((item) => item.id === button.dataset.id);
        if (cue) {
          selectedCueId = cue.id;
          seek(cue.time);
          render();
        }
        return;
      }
      if (action === 'add-cue') {
        if (duration === null || currentTime >= duration || lesson.cues.length >= 32)
          throw new Error('Load a video, move before its end, and keep the lesson within 32 cues.');
        const cue: Cue = {
          id: `cue-${crypto.randomUUID()}`,
          title: `Moment ${lesson.cues.length + 1}`,
          time: Math.round(currentTime * 100) / 100,
          expectedInput: 'Space',
          mode: 'decision',
          targetDelayMs: 350,
          toleranceMs: 150,
        };
        if (cue.time >= duration) cue.time = Math.max(0, duration - 0.001);
        applyLesson({ ...lesson, cues: [...lesson.cues, cue] });
        selectedCueId = cue.id;
        tell(`Cue marked at ${timecode(cue.time)}. Choose the response you want to practice.`);
      }
      if (action === 'remove-cue') {
        if (lesson.cues.length <= 1) throw new Error('Keep at least one cue in the lesson.');
        const index = lesson.cues.findIndex((cue) => cue.id === button.dataset.id);
        applyLesson({ ...lesson, cues: lesson.cues.filter((cue) => cue.id !== button.dataset.id) });
        if (selectedCueId === button.dataset.id)
          selectedCueId = lesson.cues[Math.min(index, lesson.cues.length - 1)]!.id;
      }
      if (action === 'record-input') {
        recordingInput = !recordingInput;
        pauseEditor();
        tell(
          recordingInput
            ? 'Press an arrow, Space, letter or digit. Escape cancels. Gamepad buttons can be selected from the input menu.'
            : 'Input recording canceled.',
        );
      }
      if (action === 'practice' || action === 'download') {
        if (!canPractice() || duration === null)
          throw new Error('Load the video and correct all cue times before opening the trainer.');
        const html = exportLessonHtml(validateLesson(lesson, duration), runtimeScript);
        recordingInput = false;
        pauseEditor();
        if (action === 'practice') {
          playerHtml = html;
          tell('Practice is open. Close it to return to the cue sheet.');
        } else {
          download(html, `${safeName()}-trainer.html`, 'text/html');
          tell('Standalone trainer downloaded with its player, cues and video.', 'success');
        }
      }
      if (action === 'close-practice') {
        stopPractice();
        tell('Practice closed. Adjust a cue or take another run.');
      }
      render();
    } catch (error) {
      tell(error instanceof Error ? error.message : 'That action could not be completed.', 'error');
      render();
    }
  };
  root!.onchange = (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    try {
      if (input.dataset.lessonField) {
        const field = input.dataset.lessonField;
        const value =
          field === 'leadInSeconds' || field === 'playbackRate'
            ? Number(input.value)
            : input.value.trim();
        applyLesson({ ...lesson, [field]: value });
      } else if (input.dataset.cueField) {
        const field = input.dataset.cueField;
        const value = ['time', 'targetDelayMs', 'toleranceMs'].includes(field)
          ? Number(input.value)
          : input.value.trim();
        updateCue({ ...selectedCue(), [field]: value });
      } else if (input.id === 'include-video') {
        includeVideo = (input as HTMLInputElement).checked;
        tell(
          includeVideo
            ? 'Lesson saves will include the video when it is loaded.'
            : 'Lesson saves will contain metadata only. The video must be reloaded when reopened.',
        );
      } else return;
      render();
    } catch (error) {
      tell(error instanceof Error ? error.message : 'Check that value.', 'error');
      render();
    }
  };
  (document.getElementById('playhead-slider') as HTMLInputElement).oninput = (event) =>
    seek(Number((event.target as HTMLInputElement).value));
  document.getElementById('video-file')!.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const type =
      file.type === 'video/mp4' || file.type === 'video/webm'
        ? file.type
        : /\.mp4$/i.test(file.name)
          ? 'video/mp4'
          : /\.webm$/i.test(file.name)
            ? 'video/webm'
            : '';
    void loadMedia(new Blob([file], { type }), file.name, 'upload');
  });
  document.getElementById('lesson-file')!.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file)
      void importLesson(file).catch((error) => {
        tell(error instanceof Error ? error.message : 'Could not open the lesson.', 'error');
        render();
      });
  });
  (document.getElementById('practice-dialog') as HTMLDialogElement).addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      stopPractice();
      tell('Practice closed.');
      render();
    },
  );
}

document.addEventListener(
  'keydown',
  (event) => {
    if (!recordingInput) return;
    if ((event.target as Element | null)?.closest('input,select,textarea')) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      recordingInput = false;
      tell('Input recording canceled.');
      render();
      return;
    }
    if (!keyboardInputs.includes(event.code) || event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      updateCue({ ...selectedCue(), expectedInput: event.code });
      recordingInput = false;
      tell(`Expected input set to ${inputLabel(event.code)}.`, 'success');
      render();
    } catch (error) {
      tell(error instanceof Error ? error.message : 'Could not record that key.', 'error');
      render();
    }
  },
  true,
);
window.addEventListener('beforeunload', (event) => {
  if (unsaved) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('pagehide', () => {
  ++loadEpoch;
  stopPractice();
  revokeMedia();
});
render();
void loadSample();
