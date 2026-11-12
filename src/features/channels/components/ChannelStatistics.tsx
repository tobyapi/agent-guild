import { useEffect, useState } from 'react';
import { useBackend } from '@/features/runtime';
import { errorMessage } from '@/shared/lib/errors';
import type { Channel, ChannelStatistics, DelegationStatistics, ModelStatistics } from '@/shared/types/domain';
import { Button, Dialog, Icon, IconButton } from '@/shared/ui';
import { currentLanguage } from '@/shared/i18n';
import { channelsApi } from '../api';
import { tStats } from '../i18n/statistics';
import styles from './ChannelStatistics.module.css';

// 数の書き方は表示の言語に合わせる（描画のたびに引く）
const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(currentLanguage(), options).format(value);
const integer = (value: number) => formatNumber(value);
const percent = (value: number) => formatNumber(value, { style: 'percent', maximumFractionDigits: 1 });
const seconds = (value: number) => formatNumber(value, { maximumFractionDigits: 2 });
const dollars = (value: number) => formatNumber(value, { maximumFractionDigits: 9 });

export function ChannelStatisticsButton({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={tStats('title')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
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
      title={tStats('title')}
      description={tStats('description', { name: channel.name })}
      size="lg"
      onClose={onClose}
      footer={
        <Button onClick={refresh} disabled={result === null}>
          {tStats('refresh')}
        </Button>
      }
    >
      {result === null && (
        <p role="status" className={styles.note}>
          {tStats('loading')}
        </p>
      )}
      {result !== null && 'error' in result && <p role="alert">{tStats('loadFailed', { error: result.error })}</p>}
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
  const rate = settled === 0 ? '—' : percent(counts.reported / settled);
  return (
    <section className={styles.section}>
      <h3>{tStats('delegation')}</h3>
      <dl className={styles.cards}>
        <div>
          <dt>{tStats('delegationCount')}</dt>
          <dd>{tStats('count', { count: integer(counts.delegations) })}</dd>
        </div>
        <div>
          <dt>{tStats('reportRate')}</dt>
          <dd>
            {rate}
            <small>{tStats('ratio', { done: integer(counts.reported), total: integer(settled) })}</small>
          </dd>
        </div>
        <div>
          <dt>{tStats('failedSubtasks')}</dt>
          <dd>{tStats('count', { count: integer(counts.failed) })}</dd>
        </div>
        <div>
          <dt>{tStats('cancelledSubtasks')}</dt>
          <dd>{tStats('count', { count: integer(counts.cancelled) })}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        {tStats('delegationNote', {
          subtasks: integer(counts.subtasks),
          pending: integer(counts.pending),
        })}
      </p>
    </section>
  );
}

function duration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return tStats('seconds', { seconds: seconds(totalSeconds) });
  const minutes = Math.floor(totalSeconds / 60);
  return tStats('minutes', { minutes: integer(minutes), seconds: Math.floor(totalSeconds % 60) });
}

function ModelTable({ models }: { models: ModelStatistics[] }) {
  return (
    <section className={styles.section}>
      <h3>{tStats('byModel')}</h3>
      {models.length === 0 ? (
        <p className={styles.note}>{tStats('noRuns')}</p>
      ) : (
        <>
          <p className={styles.note}>{tStats('modelNote')}</p>
          <div className={styles.tableScroll}>
            <table className={styles.table} aria-label={tStats('byModel')}>
              <thead>
                <tr>
                  <th scope="col">{tStats('columnModel')}</th>
                  <th scope="col">{tStats('columnRuns')}</th>
                  <th scope="col">{tStats('columnTime')}</th>
                  <th scope="col">{tStats('columnTokens')}</th>
                  <th scope="col">{tStats('columnCost')}</th>
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
        {model.model ?? tStats('defaultModel')}
        <small>{model.backend}</small>
      </th>
      <td>{tStats('count', { count: integer(model.runs) })}</td>
      <td>
        {duration(model.totalDurationMs)}
        <small>{tStats('average', { duration: duration(model.totalDurationMs / model.runs) })}</small>
      </td>
      <td>
        {model.inputTokens === null && model.outputTokens === null ? (
          tStats('unavailable')
        ) : (
          <>
            {tStats('input', { count: tokenCount(model.inputTokens) })}
            <br />
            {tStats('output', { count: tokenCount(model.outputTokens) })}
            <small>{tStats('fetched', { done: model.tokenRuns, total: model.runs })}</small>
          </>
        )}
      </td>
      <td>
        <RunCost model={model} />
      </td>
    </tr>
  );
}

const tokenCount = (count: number | null): string => (count === null ? tStats('unavailable') : integer(count));

function RunCost({ model }: { model: ModelStatistics }) {
  const local = useBackend(model.backend)?.local === true;
  if (local)
    return (
      <>
        0 USD<small>{tStats('local')}</small>
      </>
    );
  if (model.estimatedCostNanoUsd === null) return <>{tStats('unavailable')}</>;
  return (
    <>
      {dollars(model.estimatedCostNanoUsd / 1_000_000_000)} USD
      <small>{tStats('estimated', { done: model.costRuns, total: model.runs })}</small>
    </>
  );
}
