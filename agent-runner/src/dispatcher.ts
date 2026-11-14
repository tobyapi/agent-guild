import { assertBackendFolderScope } from './backends/folder-scope.ts';
import { toErrorEvent } from './dispatcher-errors.ts';
import { manageApiKey } from './credentials/store.ts';
import { applyBackendAuthMode } from './backends/auth-mode-request.ts';
import type { BackendRegistry } from './backends/registry.ts';
import { usableRequest, type BackendAdapter, type ImageRequest, type RunRequest } from './backends/types.ts';
import type { ParsedLine } from './line-parser.ts';
import { setLanguage } from './i18n.ts';
import { logError } from './log.ts';
import { PROTOCOL_VERSION, type ErrorCode, type RunnerEvent, type RunnerRequest } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';
import { t } from './texts/index.ts';

type Work = (signal: AbortSignal, isCurrent: () => boolean) => Promise<string>;
export interface DispatcherOptions {
  registry: BackendRegistry;
  runnerVersion: string;
  send: (event: RunnerEvent) => void;
  /** shutdown 繧貞・逅・＠邨ゅ∴縺溘ｉ蜻ｼ縺ｰ繧後ｋ・医・繝ｭ繧ｻ繧ｹ繧堤ｵゅｏ繧峨○繧具ｼ・*/
  exit: () => void;
}

export class Dispatcher {
  readonly #options: DispatcherOptions;
  /** 螳溯｡御ｸｭ縺ｮ繧ｸ繝ｧ繝悶らｵらｫｯ繧､繝吶Φ繝医ｒ騾√▲縺溘ｉ豸医☆ */
  readonly #jobs = new Map<string, AbortController>();
  #closed = false;
  constructor(options: DispatcherOptions) {
    this.#options = options;
  }

  /** 襍ｷ蜍慕峩蠕後↓1蝗槭□縺鷹√ｋ謠｡謇具ｼ亥推繝舌ャ繧ｯ繧ｨ繝ｳ繝峨・迥ｶ諷九ｒ遒ｺ縺九ａ縺ｦ縺九ｉ騾√ｋ・・*/
  async announce(): Promise<void> {
    const { registry, runnerVersion, send } = this.#options;
    const backends = await registry.describe();
    send({ type: 'ready', protocolVersion: PROTOCOL_VERSION, runnerVersion, backends });
  }

  receive(line: ParsedLine): void {
    if (this.#closed || line.kind === 'empty') return;
    if (line.kind === 'malformed') {
      this.#fail(null, 'bad_request', line.reason);
      return;
    }
    const decoded = decodeRequest(line.value);
    if (decoded.ok) this.#handle(decoded.request);
    else if (decoded.id !== null) this.#fail(decoded.id, 'bad_request', decoded.message);
    else logError(`荳肴ｭ｣縺ｪ隕∵ｱゅｒ辟｡隕悶＠縺ｾ縺励◆: ${decoded.message}`);
  }

  /** 螳溯｡御ｸｭ縺ｮ繧ｸ繝ｧ繝悶ｒ荳ｭ譁ｭ縺励※ cancelled 繧定ｿ斐☆縲ょｭ伜惠縺励↑縺代ｌ縺ｰ菴輔ｂ縺励↑縺・ｼ域里縺ｫ邨ゅｏ縺｣縺溘ず繝ｧ繝悶↑縺ｩ・・*/
  cancel(id: string): void {
    const controller = this.#jobs.get(id);
    if (!controller) return;
    this.#jobs.delete(id);
    controller.abort();
    this.#fail(id, 'cancelled', t('cancelled'));
  }

  /** 螳溯｡御ｸｭ縺ｮ繧ｸ繝ｧ繝悶ｒ縺吶∋縺ｦ荳ｭ譁ｭ縺励※邨ゅｏ繧九ゆｻ･蠕後・蜈･蜉帙・辟｡隕悶☆繧・*/
  shutdown(): void {
    if (this.#closed) return;
    for (const id of [...this.#jobs.keys()]) this.cancel(id);
    this.#closed = true;
    this.#options.exit();
  }

  #handle(request: RunnerRequest): void {
    if (request.type === 'run') this.#run(request);
    else if (request.type === 'image') this.#image(request);
    else if (request.type === 'apiKey') this.#apiKey(request);
    else if (request.type === 'backendAuthMode') {
      this.#track(request.id, () => applyBackendAuthMode(request.backend, request.mode, () => this.#refreshBackends()));
    } else if (request.type === 'login') this.#login(request);
    else if (request.type === 'cancel') this.cancel(request.id);
    else if (request.type === 'setLanguage') {
      // 霑比ｺ九・縺ｪ縺・・ackendInfo 縺ｮ隱ｬ譏趣ｼ育憾諷九・隱ｬ譏弱・遒ｺ縺九ａ縺滓凾轤ｹ縺ｮ險隱槭〒菴懊ｋ・峨ｒ譁ｰ縺励＞險隱槭〒騾√ｊ逶ｴ縺・
      setLanguage(request.language);
      void this.#probe();
    } else if (request.type === 'probe') {
      if (this.#jobs.has(request.id)) {
        this.#fail(request.id, 'bad_request', 'Duplicate probe id');
        return;
      }
      this.#track(request.id, async () => {
        await this.#refreshBackends();
        return '';
      });
    } else this.shutdown();
  }

  #apiKey(request: Extract<RunnerRequest, { type: 'apiKey' }>): void {
    const info = this.#claim(request.id, request.backend)?.info();
    if (!info) return;
    const spec = info.setup.apiKey;
    if (spec === null) {
      this.#fail(request.id, 'bad_request', t('noApiKey', { backend: info.label }));
      return;
    }
    this.#track(request.id, async () => {
      const status = await manageApiKey(request.backend, spec.envVar, request.action, request.key);
      await this.#probe();
      return status;
    });
  }

  async #probe(): Promise<void> {
    try {
      await this.#refreshBackends();
    } catch (error) {
      logError('繝舌ャ繧ｯ繧ｨ繝ｳ繝峨・迥ｶ諷九ｒ遒ｺ隱阪〒縺阪∪縺帙ｓ縺ｧ縺励◆', error);
    }
  }

  async #refreshBackends(): Promise<void> {
    const backends = await this.#options.registry.describe();
    if (!this.#closed) this.#options.send({ type: 'backends', backends });
  }

  #run(request: RunRequest): void {
    const { id } = request;
    const adapter = this.#claim(id, request.backend);
    if (!adapter) return;
    this.#track(id, (signal, isCurrent) => {
      // 騾比ｸｭ邨碁℃縺ｨ騾比ｸｭ縺ｮ謚慕ｨｿ縺ｯ縲∫ｵらｫｯ繧､繝吶Φ繝医ｒ騾√ｋ縺ｾ縺ｧ縺ｮ縺ゅ＞縺縺縺鷹√ｋ
      const send = (event: RunnerEvent): void => {
        if (isCurrent()) this.#options.send(event);
      };
      assertBackendFolderScope(adapter.info(), request);
      // 萓晞ｼ縺ｮ讓ｩ髯舌・蠖ｹ蜑ｲ縺ｧ豎ｺ縺ｾ繧具ｼ医ヰ繝・け繧ｨ繝ｳ繝峨〒縺ｯ螟峨ｏ繧峨↑縺・ｼ峨ゅい繝繝励ち縺ｫ縺ｯ縲√◎縺ｮ荳ｭ縺ｧ縺薙・繝舌ャ繧ｯ繧ｨ繝ｳ繝峨′螳医ｌ繧区桃菴懊□縺代ｒ貂｡縺・
      return adapter.run(usableRequest(request, adapter.info()), {
        signal,
        onActivity: (detail) => send({ type: 'activity', id, detail }),
        onPost: (text) => send({ type: 'post', id, text }),
        onUsage: (usage) => send({ type: 'usage', id, usage }),
      });
    });
  }

  /** 逕ｻ蜒上ｒ謠上￥・域棧縺ｮ逕滓・繧堤筏蜻翫＠縺ｦ image 繧呈戟縺､繧｢繝繝励ち縺縺托ｼ峨１NG 繧・output 縺ｫ譖ｸ縺・◆繧・result・・ext 縺ｯ遨ｺ・・*/
  #image(request: ImageRequest): void {
    const { id } = request;
    const adapter = this.#claim(id, request.backend);
    if (!adapter) return;
    const { image } = adapter;
    if (!image || !adapter.info().frameGeneration) {
      this.#fail(id, 'bad_request', t('noImage', { backend: adapter.info().label }));
      return;
    }
    this.#track(id, async (signal, isCurrent) => {
      const onActivity = (detail: string): void => {
        if (isCurrent()) this.#options.send({ type: 'activity', id, detail });
      };
      await image(request, { signal, onActivity });
      return '';
    });
  }

  /** 繝ｭ繧ｰ繧､繝ｳ縺檎ｵゅｏ縺｣縺溘ｉ・域・蜷ｦ縺ｫ縺九°繧上ｉ縺夲ｼ臥憾諷九ｒ遒ｺ縺九ａ逶ｴ縺励※縺九ｉ邨らｫｯ繧､繝吶Φ繝医ｒ騾√ｋ */
  #login({ id, backend }: Extract<RunnerRequest, { type: 'login' }>): void {
    const adapter = this.#claim(id, backend);
    if (!adapter) return;
    const { login } = adapter;
    if (!login || adapter.info().setup.login === null) {
      this.#fail(id, 'bad_request', t('noLogin', { backend: adapter.info().label }));
      return;
    }
    this.#track(id, async (signal) => {
      try {
        await login({ signal });
        return '';
      } finally {
        await this.#probe();
      }
    });
  }

  /** id 縺檎ｩｺ縺・※縺・※ backend 縺梧里遏･縺ｪ繧峨√◎縺ｮ繧｢繝繝励ち縲ゅ◎縺・〒縺ｪ縺代ｌ縺ｰ error 繧定ｿ斐＠縺ｦ undefined */
  #claim(id: string, backend: string): BackendAdapter | undefined {
    if (this.#jobs.has(id)) {
      this.#fail(id, 'bad_request', t('duplicateJob', { id }));
      return undefined;
    }
    const adapter = this.#options.registry.find(backend);
    if (!adapter) this.#fail(id, 'unknown_backend', t('unknownBackend', { backend }));
    return adapter;
  }

  #track(id: string, work: Work): void {
    const controller = new AbortController();
    this.#jobs.set(id, controller);
    this.#settle(id, controller, work).catch((error: unknown) => {
      logError(`繧ｸ繝ｧ繝・${id} 縺ｮ蠢懃ｭ斐ｒ騾√ｌ縺ｾ縺帙ｓ縺ｧ縺励◆`, error);
    });
  }

  async #settle(id: string, controller: AbortController, work: Work): Promise<void> {
    const isCurrent = (): boolean => this.#jobs.get(id) === controller;
    let event: RunnerEvent | undefined;
    try {
      event = { type: 'result', id, text: await work(controller.signal, isCurrent) };
    } catch (error) {
      // cancel 貂医∩縺ｪ繧我ｸｭ譁ｭ縺ｫ繧医ｋ螟ｱ謨励↑縺ｮ縺ｧ險倬鹸縺励↑縺・
      event = isCurrent() ? toErrorEvent(id, error) : undefined;
    }
    // cancel 貂医∩縺ｪ繧臥ｵらｫｯ繧､繝吶Φ繝茨ｼ・ancelled・峨・騾√▲縺ｦ縺ゅｋ縺ｮ縺ｧ縲・≦繧後※螻翫＞縺溽ｵ先棡縺ｯ謐ｨ縺ｦ繧・
    if (event === undefined || !isCurrent()) return;
    this.#jobs.delete(id);
    this.#options.send(event);
  }

  #fail(id: string | null, code: ErrorCode, message: string): void {
    this.#options.send({ type: 'error', id, code, message });
  }
}
