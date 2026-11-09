// ready を送らない偽ランナー（起動待ちのタイムアウト用）
import { startFakeRunner } from './fake-runner.mjs';

startFakeRunner({ sendReady: false });
