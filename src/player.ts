import {
  inputLabel,
  scoreResponse,
  shuffledCues,
  summarize,
  validateLesson,
  type Cue,
  type Lesson,
  type TrialResult,
} from './core';

type Phase = 'loading' | 'ready' | 'lead-in' | 'armed' | 'feedback' | 'interrupted' | 'summary';
const SUPPORTED_KEY = /^(?:Arrow(?:Up|Down|Left|Right)|Space|Key[A-Z]|Digit[0-9])$/;

/** Bundled as an IIFE. The exported file requires no server or external assets. */
function boot(): void {
  const root = document.getElementById('boss-player');
  const lessonNode = document.getElementById('boss-lesson');
  if (!root || !lessonNode) return;
  let lesson: Lesson;
  try {
    lesson = validateLesson(JSON.parse(lessonNode.textContent ?? ''));
  } catch {
    const p = document.createElement('p');
    p.textContent = 'This lesson is invalid. Ask its creator to export it again.';
    root.replaceChildren(p);
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
  :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f1f1f5;background:#101116;color-scheme:dark;font-synthesis:none}*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button{border:1px solid #464651;color:#e9e8ed;background:#24242d;border-radius:8px;padding:11px 15px;font-size:12px;font-weight:650;cursor:pointer}button:disabled{opacity:.38;cursor:default}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #f8a2aa;outline-offset:4px}.primary{background:#e85f70;color:#170c10;border-color:#e85f70}.quiet{background:transparent}.shell{max-width:1240px;margin:auto;padding:30px 36px 50px}.header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid #34343e;padding-bottom:24px}.wordmark{font-size:17px;font-weight:850;letter-spacing:-.7px}.wordmark span{color:#f07887}.header small{color:#888995;font:10px ui-monospace,monospace;letter-spacing:2px}.header a{font-size:11px;color:#d89aa2}.intro{padding:36px 0 28px}.eyebrow{font:10px ui-monospace,monospace;letter-spacing:2px;color:#e08793;text-transform:uppercase}h1{font-size:38px;letter-spacing:-1.7px;line-height:1.12;margin:12px 0}h2{font-size:22px;letter-spacing:-.7px;margin:8px 0 14px}h3{font-size:13px;margin:0 0 18px}.intro p{font-size:14px;line-height:1.7;color:#a9a8b5;max-width:800px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}.panel{border:1px solid #383842;border-radius:13px;background:#191a22;overflow:hidden}.video-stage{position:relative;background:#08090c;min-height:250px}.video-stage video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}.phase-pill{position:absolute;top:16px;left:16px;padding:7px 10px;border-radius:5px;background:#17151ee8;border:1px solid #6c4c56;color:#ef9aa6;font:10px ui-monospace,monospace;letter-spacing:1.5px;pointer-events:none}.phase-pill[data-phase=armed]{background:#d95669;color:#160a0e;border-color:#f18b98}.phase-pill[data-phase=feedback]{background:#243c35;color:#c6e7d5;border-color:#547263}.cue-copy{padding:24px 26px}.cue-meta{display:flex;align-items:center;justify-content:space-between;gap:15px;color:#8e8d9b;font-size:10px}.cue-meta strong{font:10px ui-monospace,monospace;letter-spacing:1px;color:#e0929b}.expected{display:flex;align-items:center;gap:10px;color:#b9b7c3;font-size:12px;margin:0 0 15px}.keycap{display:inline-flex;align-items:center;min-height:32px;padding:5px 12px;border:1px solid #69515e;border-bottom-width:3px;background:#30232c;border-radius:7px;color:#f0b1bb;font-size:14px;font-weight:750}.message{min-height:45px;color:#c3bfcd;font-size:13px;line-height:1.7;margin:0}.trial-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}.trial-actions button{flex:1;min-width:110px}.release-hint{font-size:10px;line-height:1.6;color:#a393a0;min-height:18px;margin:12px 0 0}.session-controls{padding:23px}.shuffle{display:flex;align-items:center;gap:9px;font-size:12px;color:#c6bfcd;margin:0 0 19px}.shuffle input{accent-color:#ec7a89;width:17px;height:17px}.session-controls>.primary{width:100%}.session-note{font-size:11px;line-height:1.7;color:#92909f;margin:17px 0}.settings{display:grid;grid-template-columns:1fr 1fr;gap:14px;border-top:1px solid #38343f;margin-top:20px;padding-top:20px}.setting span{display:block;color:#8a8797;font-size:9px;text-transform:uppercase;letter-spacing:1.4px}.setting strong{display:block;color:#ddd5e4;font-size:16px;margin-top:6px;font-weight:600}.device-status{border-top:1px solid #38343f;margin-top:20px;padding-top:17px;color:#9891a4;font-size:10px;line-height:1.7}.queue{padding:22px;margin-top:20px}.cue-list{list-style:none;padding:0;margin:0}.cue-list li{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #302d38;font-size:11px;color:#8f889c}.cue-list li:last-child{border-bottom:0}.cue-list li span{width:20px;height:20px;border:1px solid #514251;border-radius:50%;display:grid;place-items:center;font:9px ui-monospace,monospace;flex:none}.cue-list li[data-state=current]{color:#f4c4cc}.cue-list li[data-state=current] span{background:#a14353;border-color:#db8190;color:white}.cue-list li[data-state=done] span{background:#30463d;border-color:#537365;color:#c6e4d5}.footer-actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}.footer-actions button{flex:1}.summary{margin-top:24px;padding:24px 26px}.summary[hidden]{display:none}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:20px 0}.summary-stat{border:1px solid #413542;border-radius:9px;padding:17px}.summary-stat strong{display:block;font-size:23px;letter-spacing:-.7px;color:#f4bcc5}.summary-stat span{display:block;font-size:10px;color:#b4a7ba;margin-top:7px}.summary p{font-size:12px;line-height:1.7;color:#aaa0b4}.results{width:100%;border-collapse:collapse;font-size:11px}.results th,.results td{text-align:left;border-bottom:1px solid #38313f;padding:11px 8px}.results th{color:#a898b3;font-size:9px;text-transform:uppercase;letter-spacing:1px}.fine-print{font-size:10px;line-height:1.7;color:#918797;margin:17px 0 0}.loading-error{color:#f1a2ad}.screenreader{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media(max-width:900px){.layout{grid-template-columns:minmax(0,1fr) 260px}.shell{padding:24px}.cue-copy{padding:20px}.summary-grid{grid-template-columns:1fr 1fr}}@media(max-width:700px){.shell{padding:20px 16px}.header small{display:none}.layout{grid-template-columns:1fr}.intro{padding-top:28px}h1{font-size:31px}.summary-grid{grid-template-columns:1fr 1fr}.results{font-size:10px}.results th,.results td{padding:10px 3px}.trial-actions button{min-width:90px}.queue{margin-top:18px}.video-stage{min-height:170px}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  document.head.append(style);
  root.innerHTML = `<div class="shell"><header class="header"><div class="wordmark">boss<span>rehearsal</span> <span aria-hidden="true">↗</span></div><small>READ THE TELL. REHEARSE YOUR RESPONSE.</small><a href="https://buymeacoffee.com/ufodia" target="_blank" rel="noopener noreferrer">Support the maker ↗</a></header><section class="intro"><span class="eyebrow">Your footage. Your practice loop.</span><h1 id="lesson-title"></h1><p id="lesson-description"></p></section><div class="layout"><section><div class="panel"><div class="video-stage"><video id="training-video" controls playsinline muted preload="auto"></video><span id="phase-label" class="phase-pill" data-phase="loading">LOADING</span></div><div class="cue-copy"><div class="cue-meta"><strong id="trial-count">GET READY</strong><span id="cue-kind"></span></div><h2 id="current-cue"></h2><p class="expected">Response <span id="expected-input" class="keycap"></span><span id="timing-window"></span></p><p id="feedback-message" class="message" aria-live="polite">Preparing the embedded video…</p><div class="trial-actions"><button id="pause-trial" type="button" class="quiet" disabled>Pause trial</button><button id="skip-trial" type="button" class="quiet" disabled>Skip cue</button><button id="resume-trial" type="button" hidden>Resume trial</button><button id="next-trial" type="button" class="primary" disabled>Next cue</button></div><p id="release-hint" class="release-hint"></p></div></div><div id="session-summary" class="panel summary" hidden><span class="eyebrow">A record of this session</span><h2>Review the decisions.</h2><div class="summary-grid"><div class="summary-stat"><strong id="decision-accuracy">—</strong><span>Decision accuracy</span></div><div class="summary-stat"><strong id="timing-success">—</strong><span>Timing success</span></div><div class="summary-stat"><strong id="median-latency">—</strong><span>Correct-decision median</span></div><div class="summary-stat"><strong id="skip-count">0</strong><span>Skipped cues</span></div></div><table class="results"><thead><tr><th>Cue</th><th>Mode</th><th>Result</th><th>Browser estimate</th></tr></thead><tbody id="result-rows"></tbody></table><p>Decision accuracy and timing success are separate. Skips are excluded from both. Interrupted attempts are unscored and are retried only when you choose Resume.</p></div><p class="fine-print">Times are browser-measured estimates. Display, decoding, input polling and device latency affect them. These results do not measure in-game skill or prove improvement.</p></section><aside><section class="panel session-controls"><h3>Build a deliberate practice loop</h3><label class="shuffle"><input id="shuffle-cues" type="checkbox">Shuffle cues this session</label><button id="start-session" type="button" class="primary" disabled>Start session</button><p class="session-note">Watch the lead-in. When the picture freezes, make a fresh response. Held keys and gamepad buttons do not answer a new cue.</p><div class="settings"><div class="setting"><span>Lead-in</span><strong id="lead-setting"></strong></div><div class="setting"><span>Playback</span><strong id="rate-setting"></strong></div></div><p id="gamepad-status" class="device-status">Keyboard ready. Standard gamepad: press and release a button once to connect.</p><div class="footer-actions"><button id="restart-session" type="button" disabled>Restart session</button><button id="download-session" type="button" disabled>Save results</button></div></section><section class="panel queue"><h3>The practice queue</h3><ol id="cue-list" class="cue-list"></ol></section></aside></div></div>`;

  const element = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
  const video = element<HTMLVideoElement>('training-video');
  const shuffle = element<HTMLInputElement>('shuffle-cues');
  const startButton = element<HTMLButtonElement>('start-session');
  const nextButton = element<HTMLButtonElement>('next-trial');
  const pauseButton = element<HTMLButtonElement>('pause-trial');
  const skipButton = element<HTMLButtonElement>('skip-trial');
  const resumeButton = element<HTMLButtonElement>('resume-trial');
  const restartButton = element<HTMLButtonElement>('restart-session');
  const downloadButton = element<HTMLButtonElement>('download-session');
  const cleanups: (() => void)[] = [];
  const objectUrls = new Set<string>();
  const downloadTimers = new Set<ReturnType<typeof setTimeout>>();
  const heldKeys = new Set<string>();
  let heldGamepad = new Set<string>();
  const previousPads = new Map<number, boolean[]>();
  let phase: Phase = 'loading';
  let currentIndex = 0;
  let cueOrder = lesson.cues.map((cue) => ({ ...cue }));
  let results: TrialResult[] = [];
  let seed = 0;
  let sessionShuffled = false;
  let sessionStartedAt = '';
  let responseStart: number | null = null;
  let ready = false;
  let destroyed = false;
  let internalSeeks = 0;
  let expectedPauses = 0;
  let attempt: AbortController | null = null;
  let monitorAnimation = 0;
  let monitorVideo = 0;
  let pollAnimation = 0;

  element('lesson-title').textContent = lesson.name;
  element('lesson-description').textContent = lesson.description;
  element('lead-setting').textContent = `${lesson.leadInSeconds}s`;
  element('rate-setting').textContent = `${lesson.playbackRate}×`;
  video.muted = true;

  function listen(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  }
  const allReleased = () => heldKeys.size === 0 && heldGamepad.size === 0;
  const active = () => phase === 'lead-in' || phase === 'armed';
  const currentCue = (): Cue => cueOrder[currentIndex]!;

  function rebuildQueue(): void {
    element('cue-list').replaceChildren();
    cueOrder.forEach((cue, index) => {
      const li = document.createElement('li');
      const badge = document.createElement('span');
      badge.textContent = String(index + 1);
      const name = document.createElement('div');
      name.textContent = cue.title;
      li.append(badge, name);
      li.dataset.index = String(index);
      element('cue-list').append(li);
    });
  }

  function syncControls(): void {
    const released = allReleased();
    startButton.disabled = !ready || phase !== 'ready' || !released;
    nextButton.disabled = phase !== 'feedback' || !released;
    pauseButton.disabled = !active();
    skipButton.disabled = !active();
    resumeButton.hidden = phase !== 'interrupted';
    resumeButton.disabled = !ready || phase !== 'interrupted' || !released;
    restartButton.disabled = !ready || phase === 'loading' || !released;
    downloadButton.disabled = results.length === 0;
    shuffle.disabled = phase !== 'ready' && phase !== 'summary';
    element('release-hint').textContent = released
      ? phase === 'feedback'
        ? 'Choose Next cue when you are ready. Nothing advances automatically.'
        : ''
      : 'Release all controls before starting, resuming or continuing.';
  }

  function render(message?: string): void {
    root!.dataset.phase = phase;
    const badge = element('phase-label');
    badge.textContent = phase.toUpperCase().replace('-', ' ');
    badge.dataset.phase = phase;
    element('trial-count').textContent =
      phase === 'ready'
        ? `${cueOrder.length} CUES / READY`
        : phase === 'summary'
          ? 'SESSION COMPLETE'
          : `CUE ${currentIndex + 1} OF ${cueOrder.length}`;
    const cue = currentCue();
    element('current-cue').textContent =
      phase === 'summary' ? 'A good place to review.' : cue.title;
    element('cue-kind').textContent = cue.mode === 'decision' ? 'DECISION' : 'TIMING';
    element('expected-input').textContent = inputLabel(cue.expectedInput);
    element('timing-window').textContent =
      cue.mode === 'timing'
        ? `${cue.targetDelayMs} ± ${cue.toleranceMs} ms`
        : 'Choose the right input';
    nextButton.textContent = currentIndex === cueOrder.length - 1 ? 'View summary' : 'Next cue';
    if (message !== undefined) element('feedback-message').textContent = message;
    [...element('cue-list').children].forEach((li, index) => {
      (li as HTMLElement).dataset.state =
        phase === 'summary' || index < currentIndex
          ? 'done'
          : index === currentIndex
            ? 'current'
            : 'waiting';
    });
    syncControls();
  }

  function internalPause(): void {
    if (!video.paused) {
      expectedPauses++;
      video.pause();
    }
  }

  function cancelAttempt(): void {
    attempt?.abort();
    attempt = null;
    responseStart = null;
    cancelAnimationFrame(monitorAnimation);
    monitorAnimation = 0;
    if (monitorVideo && typeof video.cancelVideoFrameCallback === 'function')
      video.cancelVideoFrameCallback(monitorVideo);
    monitorVideo = 0;
  }

  function interrupt(reason: string): void {
    if (!active()) return;
    phase = 'interrupted';
    cancelAttempt();
    internalPause();
    render(`${reason} This attempt is unscored. Resume retries the same cue from its lead-in.`);
  }

  /** Confirm decoded current data after seeking, then give it a paint opportunity. */
  async function seekFrame(target: number, signal: AbortSignal): Promise<void> {
    internalSeeks++;
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          video.removeEventListener('seeked', check);
          video.removeEventListener('loadeddata', check);
          video.removeEventListener('error', fail);
          signal.removeEventListener('abort', abort);
          if (error) reject(error);
          else resolve();
        };
        const check = () => {
          if (
            !video.seeking &&
            video.readyState >= 2 &&
            Math.abs(video.currentTime - target) < 0.06
          )
            finish();
        };
        const fail = () => finish(new Error('The video could not decode this cue.'));
        const abort = () => finish(new DOMException('Trial cancelled', 'AbortError'));
        const timer = setTimeout(
          () => finish(new Error('The cue frame did not become ready.')),
          8000,
        );
        video.addEventListener('seeked', check);
        video.addEventListener('loadeddata', check);
        video.addEventListener('error', fail);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
          abort();
          return;
        }
        try {
          video.currentTime = target;
          queueMicrotask(check);
        } catch {
          fail();
        }
      });
      await new Promise<void>((resolve, reject) => {
        let first = 0;
        let second = 0;
        let done = false;
        const finish = (error?: Error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          cancelAnimationFrame(first);
          cancelAnimationFrame(second);
          signal.removeEventListener('abort', abort);
          if (error) reject(error);
          else resolve();
        };
        const abort = () => finish(new DOMException('Trial cancelled', 'AbortError'));
        const timer = setTimeout(
          () => finish(new Error('The decoded cue frame could not be presented.')),
          2000,
        );
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
          abort();
          return;
        }
        first = requestAnimationFrame(() => {
          second = requestAnimationFrame(() => {
            if (!video.seeking && video.readyState >= 2) finish();
            else finish(new Error('The cue frame is not ready.'));
          });
        });
      });
    } finally {
      internalSeeks--;
    }
  }

  async function armCue(controller: AbortController): Promise<void> {
    if (controller !== attempt || controller.signal.aborted || phase !== 'lead-in') return;
    cancelAnimationFrame(monitorAnimation);
    monitorAnimation = 0;
    if (monitorVideo && typeof video.cancelVideoFrameCallback === 'function')
      video.cancelVideoFrameCallback(monitorVideo);
    monitorVideo = 0;
    internalPause();
    render('Preparing the paused cue frame…');
    try {
      await seekFrame(currentCue().time, controller.signal);
      if (controller !== attempt || controller.signal.aborted || destroyed) return;
      phase = 'armed';
      responseStart = performance.now();
      render(
        currentCue().mode === 'decision'
          ? 'Picture frozen. Make a fresh decision now.'
          : `Picture frozen. Aim for ${currentCue().targetDelayMs} ms after this cue. Your response uses real elapsed time.`,
      );
    } catch (error) {
      if (!controller.signal.aborted && error instanceof Error) interrupt(error.message);
    }
  }

  function monitor(controller: AbortController): void {
    const frame = () => {
      monitorVideo = 0;
      monitorAnimation = 0;
      if (controller !== attempt || controller.signal.aborted || phase !== 'lead-in') return;
      if (video.currentTime >= currentCue().time - 0.004) {
        void armCue(controller);
        return;
      }
      if (typeof video.requestVideoFrameCallback === 'function')
        monitorVideo = video.requestVideoFrameCallback(frame);
      else monitorAnimation = requestAnimationFrame(frame);
    };
    if (typeof video.requestVideoFrameCallback === 'function')
      monitorVideo = video.requestVideoFrameCallback(frame);
    else monitorAnimation = requestAnimationFrame(frame);
  }

  async function beginTrial(): Promise<void> {
    if (!ready || destroyed || !allReleased()) return;
    cancelAttempt();
    internalPause();
    const controller = new AbortController();
    attempt = controller;
    phase = 'lead-in';
    render(
      'Watch the lead-in. The response clock starts only after the cue picture is paused and ready.',
    );
    try {
      const cue = currentCue();
      const from = Math.max(0, cue.time - lesson.leadInSeconds);
      await seekFrame(from, controller.signal);
      if (controller !== attempt || controller.signal.aborted || destroyed) return;
      video.playbackRate = lesson.playbackRate;
      if (cue.time - from < 0.004) {
        await armCue(controller);
        return;
      }
      await video.play();
      if (controller !== attempt || controller.signal.aborted || destroyed) {
        internalPause();
        return;
      }
      monitor(controller);
    } catch (error) {
      if (!controller.signal.aborted && error instanceof Error)
        interrupt(error.message || 'Video playback could not start.');
    }
  }

  function recordInput(input: string): void {
    if (phase !== 'armed' || responseStart === null) return;
    const cue = currentCue();
    const score = scoreResponse(cue, input, Math.max(0, performance.now() - responseStart));
    results.push({
      cueId: cue.id,
      cueTitle: cue.title,
      mode: cue.mode,
      expectedInput: cue.expectedInput,
      input,
      ...score,
      skipped: false,
    });
    phase = 'feedback';
    cancelAttempt();
    internalPause();
    const latency = `${Math.round(score.latencyMs)} ms`;
    let message: string;
    if (!score.correctInput)
      message = `${inputLabel(input)} was not the expected response. Expected ${inputLabel(cue.expectedInput)} · browser estimate ${latency}.`;
    else if (cue.mode === 'decision') message = `Correct decision · browser estimate ${latency}.`;
    else if (score.success)
      message = `Correct input, inside the timing window · ${Math.round(score.deltaMs)} ms from target.`;
    else
      message = `Correct input, outside the timing window · ${Math.abs(Math.round(score.deltaMs))} ms ${score.deltaMs < 0 ? 'before' : 'after'} target.`;
    render(message);
  }

  function recordSkip(): void {
    if (!active()) return;
    const cue = currentCue();
    results.push({
      cueId: cue.id,
      cueTitle: cue.title,
      mode: cue.mode,
      expectedInput: cue.expectedInput,
      input: null,
      latencyMs: null,
      deltaMs: null,
      correctInput: false,
      withinWindow: false,
      success: false,
      skipped: true,
    });
    phase = 'feedback';
    cancelAttempt();
    internalPause();
    render('Cue skipped. It is counted separately and does not enter either accuracy score.');
  }

  function showSummary(): void {
    phase = 'summary';
    cancelAttempt();
    internalPause();
    const summary = summarize(results);
    const percent = (value: number | null) =>
      value === null ? '—' : `${Math.round(value * 100)}%`;
    element('decision-accuracy').textContent = percent(summary.decision.accuracy);
    element('timing-success').textContent = percent(summary.timing.successRate);
    element('median-latency').textContent =
      summary.decision.medianLatencyMs === null
        ? '—'
        : `${Math.round(summary.decision.medianLatencyMs)} ms`;
    element('skip-count').textContent = String(summary.skipped);
    element('result-rows').replaceChildren();
    for (const result of results) {
      const row = document.createElement('tr');
      const values = [
        result.cueTitle,
        result.mode,
        result.skipped
          ? 'Skipped'
          : result.success
            ? 'Successful'
            : result.correctInput
              ? 'Outside window'
              : 'Wrong input',
        result.latencyMs === null ? '—' : `${Math.round(result.latencyMs)} ms`,
      ];
      values.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      element('result-rows').append(row);
    }
    element('session-summary').hidden = false;
    render(
      'Session complete. Review the separate scores, save the record, or restart with a new cue order.',
    );
  }

  listen(startButton, 'click', () => {
    if (phase !== 'ready' || !ready || !allReleased()) return;
    seed = Date.now() >>> 0;
    sessionShuffled = shuffle.checked;
    cueOrder = sessionShuffled
      ? shuffledCues(lesson.cues, seed)
      : lesson.cues.map((cue) => ({ ...cue }));
    currentIndex = 0;
    results = [];
    sessionStartedAt = new Date().toISOString();
    element('session-summary').hidden = true;
    rebuildQueue();
    void beginTrial();
  });
  listen(nextButton, 'click', () => {
    if (phase !== 'feedback' || !allReleased()) return;
    if (currentIndex === cueOrder.length - 1) showSummary();
    else {
      currentIndex++;
      void beginTrial();
    }
  });
  listen(skipButton, 'click', recordSkip);
  listen(pauseButton, 'click', () => interrupt('Paused by you.'));
  listen(resumeButton, 'click', () => {
    if (phase === 'interrupted' && allReleased()) void beginTrial();
  });
  listen(restartButton, 'click', () => {
    if (!ready || !allReleased()) return;
    cancelAttempt();
    internalPause();
    results = [];
    currentIndex = 0;
    cueOrder = lesson.cues.map((cue) => ({ ...cue }));
    phase = 'ready';
    element('session-summary').hidden = true;
    rebuildQueue();
    render('Ready for another deliberate session. Choose the order, then Start session.');
  });
  listen(downloadButton, 'click', () => {
    if (!results.length) return;
    const record = {
      version: 1,
      lessonName: lesson.name,
      videoName: lesson.videoName,
      sessionStartedAt,
      savedAt: new Date().toISOString(),
      shuffled: sessionShuffled,
      seed,
      playbackRate: lesson.playbackRate,
      leadInSeconds: lesson.leadInSeconds,
      cueOrder: cueOrder.map((cue) => cue.id),
      results,
      summary: summarize(results),
      note: 'Browser-measured estimates; interrupted attempts are excluded. This is not an in-game skill measurement.',
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
    );
    objectUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boss-rehearsal-session.json';
    link.click();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      objectUrls.delete(url);
      downloadTimers.delete(timer);
    }, 1000);
    downloadTimers.add(timer);
  });

  listen(window, 'keydown', (event) => {
    const key = event as KeyboardEvent;
    if (!SUPPORTED_KEY.test(key.code)) return;
    const previouslyHeld = heldKeys.has(key.code);
    heldKeys.add(key.code);
    if (phase !== 'ready' && phase !== 'loading' && phase !== 'summary') key.preventDefault();
    if (
      phase === 'armed' &&
      !key.repeat &&
      !previouslyHeld &&
      responseStart !== null &&
      key.timeStamp >= responseStart - 1
    )
      recordInput(key.code);
    syncControls();
  });
  listen(window, 'keyup', (event) => {
    const key = event as KeyboardEvent;
    if (!SUPPORTED_KEY.test(key.code)) return;
    if (phase !== 'ready' && phase !== 'loading' && phase !== 'summary') key.preventDefault();
    heldKeys.delete(key.code);
    syncControls();
  });
  listen(window, 'blur', () => {
    interrupt('The window lost focus.');
    heldKeys.clear();
    syncControls();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      interrupt('The tab became hidden.');
      heldKeys.clear();
      syncControls();
    }
  });
  listen(video, 'seeking', () => {
    if (active() && internalSeeks === 0) interrupt('The video position changed unexpectedly.');
  });
  listen(video, 'pause', () => {
    if (expectedPauses > 0) {
      expectedPauses--;
      return;
    }
    if (active()) interrupt('Video playback was paused outside the trial controls.');
  });
  listen(video, 'play', () => {
    if (phase === 'armed') interrupt('Video playback changed while a response was armed.');
  });
  listen(video, 'ended', () => {
    if (active()) interrupt('The video ended before the cue could be completed.');
  });
  listen(video, 'error', () => {
    ready = false;
    if (active()) interrupt('The embedded video reported a media error.');
    else {
      phase = 'interrupted';
      render(
        'The embedded video could not be decoded. Ask the lesson creator for a supported MP4 or WebM export.',
      );
    }
    syncControls();
  });

  function pollGamepads(): void {
    if (destroyed) return;
    let pads: (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    } catch {
      /* Keyboard remains available. */
    }
    const current = new Set<string>();
    const fresh: string[] = [];
    const connected = new Set<number>();
    for (const pad of pads) {
      if (!pad?.connected || pad.mapping !== 'standard') continue;
      connected.add(pad.index);
      const previous = previousPads.get(pad.index);
      const pressed = Array.from(
        { length: 16 },
        (_, index) =>
          !!pad.buttons[index] && (pad.buttons[index]!.pressed || pad.buttons[index]!.value > 0.5),
      );
      pressed.forEach((down, index) => {
        if (down) {
          current.add(`${pad.index}:${index}`);
          if (previous && !previous[index]) fresh.push(`Gamepad${index}`);
        }
      });
      previousPads.set(pad.index, pressed);
    }
    for (const index of previousPads.keys()) if (!connected.has(index)) previousPads.delete(index);
    heldGamepad = current;
    for (const input of fresh)
      if (phase === 'armed') {
        recordInput(input);
        break;
      }
    element('gamepad-status').textContent = connected.size
      ? `${connected.size} standard gamepad${connected.size === 1 ? '' : 's'} connected. Fresh release → press edges are used; keyboard remains available.`
      : 'Keyboard ready. Standard gamepad: press and release a button once to connect.';
    syncControls();
    pollAnimation = requestAnimationFrame(pollGamepads);
  }

  function teardown(): void {
    if (destroyed) return;
    destroyed = true;
    cancelAttempt();
    cancelAnimationFrame(pollAnimation);
    internalPause();
    for (const cleanup of cleanups.splice(0)) cleanup();
    for (const timer of downloadTimers) clearTimeout(timer);
    downloadTimers.clear();
    video.removeAttribute('src');
    video.load();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    heldKeys.clear();
    heldGamepad.clear();
    previousPads.clear();
  }
  listen(window, 'pagehide', teardown);

  async function loadVideo(): Promise<void> {
    if (!lesson.videoDataUrl) {
      phase = 'interrupted';
      render(
        'This standalone lesson has no embedded video. Ask its creator to export it with the local clip.',
      );
      return;
    }
    try {
      const comma = lesson.videoDataUrl.indexOf(',');
      const encoded = lesson.videoDataUrl.slice(comma + 1);
      const parts: ArrayBuffer[] = [];
      for (let offset = 0; offset < encoded.length; offset += 32768) {
        const decoded = atob(encoded.slice(offset, offset + 32768));
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index++)
          bytes[index] = decoded.charCodeAt(index);
        parts.push(bytes.buffer);
        if (offset % (32768 * 16) === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        if (destroyed) return;
      }
      const type = lesson.videoDataUrl.startsWith('data:video/mp4') ? 'video/mp4' : 'video/webm';
      const url = URL.createObjectURL(new Blob(parts, { type }));
      objectUrls.add(url);
      listen(video, 'loadedmetadata', () => {
        try {
          lesson = validateLesson(lesson, video.duration);
          ready = true;
          if (phase === 'loading') {
            phase = 'ready';
            render(
              'Video ready. Start a session, watch each lead-in, and respond when its picture freezes.',
            );
          }
        } catch (error) {
          ready = false;
          phase = 'interrupted';
          render(
            error instanceof Error ? error.message : 'The lesson cues do not match this video.',
          );
        }
      });
      video.src = url;
      video.load();
    } catch {
      ready = false;
      phase = 'interrupted';
      render(
        'The embedded video could not be prepared. Ask its creator to export the local clip again.',
      );
    }
  }

  rebuildQueue();
  render();
  pollAnimation = requestAnimationFrame(pollGamepads);
  void loadVideo();
}

boot();
