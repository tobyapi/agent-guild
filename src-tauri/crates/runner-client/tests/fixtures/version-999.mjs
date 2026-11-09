// 版の合わない ready を送る偽ランナー
import { startFakeRunner } from './fake-runner.mjs';

startFakeRunner({ protocolVersion: 999 });
