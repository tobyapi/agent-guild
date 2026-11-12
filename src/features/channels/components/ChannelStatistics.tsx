import { useEffect, useState } from 'react';
import { useBackend } from '@/features/runtime';
import { errorMessage } from '@/shared/lib/errors';
import type { Channel, ChannelStatistics, DelegationStatistics, ModelStatistics } from '@/shared/types/domain';
import { Button, Dialog, Icon, IconButton } from '@/shared/ui';
import { channelsApi } from '../api';
import styles from './ChannelStatistics.module.css';

const integer = new Intl.NumberFormat('ja-JP');
const percent = new Intl.NumberFormat('ja-JP', { style: 'percent', maximumFractionDigits: 1 });
const seconds = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 9 });

export function ChannelStatisticsButton({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="運用統計" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="chart" />
      </IconButton>
      {open && <StatisticsDialog channel={channel} onClose={() => setOpen(false)} />}
    </>
  );
}

type LoadResult = { data: ChannelStatistics } | { error: string };

function StatisticsDialog({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const [result, setResult] = useState<LoadResult | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void channelsApi.statistics(channel.id).then(
      (data) => {
        if (active) setResult({ data });
      },
      (error: unknown) => {
        if (active) setResult({ error: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [channel.id, revision]);

  function refresh() {
    setResult(null);
    setRevision((previous) => previous + 1);
  }

  return (
    <Dialog
      title="運用統計"
      description={`# ${channel.name} · 全期間`}
      size="lg"
      onClose={onClose}
      footer={
        <Button onClick={refresh} disabled={result === null}>
          更新
        </Button>
      }
    >
      {result === null && (
        <p role="status" className={styles.note}>
          運用統計を読み込んでいます…
        </p>
      )}
      {result !== null && 'error' in result && <p role="alert">統計を読み込めませんでした。{result.error}</p>}
      {result !== null && 'data' in result && (
        <>
          <DelegationSummary counts={result.data.delegation} />
          <ModelTable models={result.data.models} />
        </>
      )}
    </Dialog>
  );
}

function DelegationSummary({ counts }: { counts: DelegationStatistics }) {
  const settled = counts.subtasks - counts.pending;
  const rate = settled === 0 ? '—' : percent.format(counts.reported / settled);
  return (
    <section className={styles.section}>
      <h3>割り振り</h3>
      <dl className={styles.cards}>
        <div>
          <dt>割り振り件数</dt>
          <dd>{integer.format(counts.delegations)} 件</dd>
        </div>
        <div>
          <dt>結果報告率</dt>
          <dd>
            {rate}
            <small>
              {integer.format(counts.reported)} / {integer.format(settled)} 件
            </small>
          </dd>
        </div>
        <div>
          <dt>失敗したサブタスク</dt>
          <dd>{integer.format(counts.failed)} 件</dd>
        </div>
        <div>
          <dt>中断したサブタスク</dt>
          <dd>{integer.format(counts.cancelled)} 件</dd>
        </div>
      </dl>
      <p className={styles.note}>
        サブタスク {integer.format(counts.subtasks)} 件（未決着 {integer.format(counts.pending)}{' '}
        件）。結果報告率は、失敗・中断を含む決着済みのサブタスクのうち、結果が投稿された割合です。
      </p>
    </section>
  );
}

function duration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${seconds.format(totalSeconds)} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${integer.format(minutes)} 分 ${Math.floor(totalSeconds % 60)} 秒`;
}

function ModelTable({ models }: { models: ModelStatistics[] }) {
  return (
    <section className={styles.section}>
      <h3>モデル別の実行</h3>
      {models.length === 0 ? (
        <p className={styles.note}>まだ実行記録がありません。今後のエージェント実行がここに表示されます。</p>
      ) : (
        <>
          <p className={styles.note}>
            主モデルごとの集計です。時間は待ち行列を除きます。トークンと費用は、補助モデルも含めて取得できた分を表示します。
          </p>
          <div className={styles.tableScroll}>
            <table className={styles.table} aria-label="モデル別の実行">
              <thead>
                <tr>
                  <th scope="col">モデル</th>
                  <th scope="col">実行</th>
                  <th scope="col">時間</th>
                  <th scope="col">トークン</th>
                  <th scope="col">API 費用</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <ModelRow key={JSON.stringify([model.backend, model.model])} model={model} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function ModelRow({ model }: { model: ModelStatistics }) {
  return (
    <tr>
      <th scope="row">
        {model.model ?? '既定モデル（名前未取得）'}
        <small>{model.backend}</small>
      </th>
      <td>{integer.format(model.runs)} 件</td>
      <td>
        {duration(model.totalDurationMs)}
        <small>平均 {duration(model.totalDurationMs / model.runs)}</small>
      </td>
      <td>
        {model.inputTokens === null && model.outputTokens === null ? (
          '未取得'
        ) : (
          <>
            入力 {tokenCount(model.inputTokens)}
            <br />
            出力 {tokenCount(model.outputTokens)}
            <small>
              取得 {model.tokenRuns} / {model.runs} 件
            </small>
          </>
        )}
      </td>
      <td>
        <RunCost model={model} />
      </td>
    </tr>
  );
}

const tokenCount = (count: number | null): string => (count === null ? '未取得' : integer.format(count));

function RunCost({ model }: { model: ModelStatistics }) {
  const local = useBackend(model.backend)?.local === true;
  if (local)
    return (
      <>
        0 USD<small>ローカル実行</small>
      </>
    );
  if (model.estimatedCostNanoUsd === null) return <>未取得</>;
  return (
    <>
      {dollars.format(model.estimatedCostNanoUsd / 1_000_000_000)} USD
      <small>
        推定 · 取得 {model.costRuns} / {model.runs} 件
      </small>
    </>
  );
}
