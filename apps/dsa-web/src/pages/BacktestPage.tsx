import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { backtestApi } from '../api/backtest';
import type { ParsedApiError } from '../api/error';
import { getParsedApiError } from '../api/error';
import { ApiErrorAlert, Card, Badge, Pagination } from '../components/common';
import type {
  BacktestResultItem,
  BacktestRunResponse,
  PerformanceMetrics,
  HistoryTrackingItem,
} from '../types/backtest';
import { getSentimentColor } from '../types/analysis';

// ============ Helpers ============

function pct(value?: number | null): string {
  if (value == null) return '--';
  return `${value.toFixed(1)}%`;
}

function outcomeBadge(outcome?: string) {
  if (!outcome) return <Badge variant="default">--</Badge>;
  switch (outcome) {
    case 'win':
      return <Badge variant="success" glow>WIN</Badge>;
    case 'loss':
      return <Badge variant="danger" glow>LOSS</Badge>;
    case 'neutral':
      return <Badge variant="warning">NEUTRAL</Badge>;
    default:
      return <Badge variant="default">{outcome}</Badge>;
  }
}

function statusBadge(status: string, analysisDate?: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">已完成</Badge>;
    case 'insufficient_data': {
      let daysHint = '';
      if (analysisDate) {
        const analysis = new Date(analysisDate);
        const daysElapsed = Math.floor((Date.now() - analysis.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 10 - daysElapsed);
        daysHint = daysLeft > 0 ? `还需 ${daysLeft} 天` : '待评估';
      }
      return <Badge variant="warning">数据不足{daysHint ? ` · ${daysHint}` : ''}</Badge>;
    }
    case 'error':
      return <Badge variant="danger">错误</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

function boolIcon(value?: boolean | null) {
  if (value === true) return <span className="text-emerald-400">&#10003;</span>;
  if (value === false) return <span className="text-red-400">&#10007;</span>;
  return <span className="text-muted">--</span>;
}

// ============ Metric Row ============

const MetricRow: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
    <span className="text-xs text-secondary">{label}</span>
    <span className={`text-sm font-mono font-semibold ${accent ? 'text-cyan' : 'text-white'}`}>{value}</span>
  </div>
);

// ============ History Tracking Row ============

const HistoryTrackingRow: React.FC<{ item: HistoryTrackingItem }> = ({ item }) => {
  const returnPct = item.backtestResult?.simulatedReturnPct;
  const outcome = item.backtestResult?.outcome;

  const returnColor = returnPct != null
    ? returnPct > 0 ? 'text-emerald-400' : returnPct < 0 ? 'text-red-400' : 'text-secondary'
    : 'text-muted';

  const outcomeVariant = outcome === 'win' ? 'success' : outcome === 'loss' ? 'danger' : outcome === 'neutral' ? 'warning' : 'default';

  return (
    <tr className="border-t border-white/5 hover:bg-hover transition-colors">
      <td className="px-2 py-1.5 font-mono text-cyan text-xs">{item.code}</td>
      <td className="px-2 py-1.5 text-xs text-secondary">{item.date}</td>
      <td className="px-2 py-1.5 text-xs">
        {item.sentimentScore != null ? (
          <span
            className="font-mono font-semibold text-xs px-1.5 py-0.5 rounded"
            style={{
              color: getSentimentColor(item.sentimentScore),
              backgroundColor: `${getSentimentColor(item.sentimentScore)}15`
            }}
          >
            {item.sentimentScore}
          </span>
        ) : '--'}
      </td>
      <td className="px-2 py-1.5 text-xs text-white truncate max-w-[120px]" title={item.operationAdvice || ''}>
        {item.operationAdvice || '--'}
      </td>
      <td className="px-2 py-1.5">
        {outcome ? <Badge variant={outcomeVariant} glow={outcome === 'win'}>{outcome.toUpperCase()}</Badge> : '--'}
      </td>
      <td className="px-2 py-1.5 text-xs font-mono text-right">
        <span className={returnColor}>
          {returnPct != null ? `${returnPct.toFixed(1)}%` : '--'}
        </span>
      </td>
    </tr>
  );
};

// ============ Performance Card ============

const PerformanceCard: React.FC<{ metrics: PerformanceMetrics; title: string }> = ({ metrics, title }) => (
  <Card variant="gradient" padding="md" className="animate-fade-in">
    <div className="mb-3">
      <span className="label-uppercase">{title}</span>
    </div>
    <MetricRow label="Direction Accuracy" value={pct(metrics.directionAccuracyPct)} accent />
    <MetricRow label="Win Rate" value={pct(metrics.winRatePct)} accent />
    <MetricRow label="Avg Sim. Return" value={pct(metrics.avgSimulatedReturnPct)} />
    <MetricRow label="Avg Stock Return" value={pct(metrics.avgStockReturnPct)} />
    <MetricRow label="SL Trigger Rate" value={pct(metrics.stopLossTriggerRate)} />
    <MetricRow label="TP Trigger Rate" value={pct(metrics.takeProfitTriggerRate)} />
    <MetricRow label="Avg Days to Hit" value={metrics.avgDaysToFirstHit != null ? metrics.avgDaysToFirstHit.toFixed(1) : '--'} />
    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
      <span className="text-xs text-muted">Evaluations</span>
      <span className="text-xs text-secondary font-mono">
        {Number(metrics.completedCount)} / {Number(metrics.totalEvaluations)}
      </span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">W / L / N</span>
      <span className="text-xs font-mono">
        <span className="text-emerald-400">{metrics.winCount}</span>
        {' / '}
        <span className="text-red-400">{metrics.lossCount}</span>
        {' / '}
        <span className="text-amber-400">{metrics.neutralCount}</span>
      </span>
    </div>
  </Card>
);

// ============ Run Summary ============

const RunSummary: React.FC<{ data: BacktestRunResponse }> = ({ data }) => (
  <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-elevated border border-white/5 text-xs font-mono animate-fade-in">
    <span className="text-secondary">Processed: <span className="text-white">{data.processed}</span></span>
    <span className="text-secondary">Saved: <span className="text-cyan">{data.saved}</span></span>
    <span className="text-secondary">Completed: <span className="text-emerald-400">{data.completed}</span></span>
    <span className="text-secondary">Insufficient: <span className="text-amber-400">{data.insufficient}</span></span>
    {data.errors > 0 && (
      <span className="text-secondary">Errors: <span className="text-red-400">{data.errors}</span></span>
    )}
  </div>
);

// ============ Main Page ============

const BacktestPage: React.FC = () => {
  // Input state
  const [codeFilter, setCodeFilter] = useState('');
  const [evalDays, setEvalDays] = useState('');
  const [forceRerun, setForceRerun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<BacktestRunResponse | null>(null);
  const [runError, setRunError] = useState<ParsedApiError | null>(null);
  const [pageError, setPageError] = useState<ParsedApiError | null>(null);

  // Results state
  const [results, setResults] = useState<BacktestResultItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const pageSize = 20;

  // Performance state
  const [overallPerf, setOverallPerf] = useState<PerformanceMetrics | null>(null);
  const [stockPerf, setStockPerf] = useState<PerformanceMetrics | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);

  // History tracking state
  const [historyTracking, setHistoryTracking] = useState<HistoryTrackingItem[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);

  // Fetch results
  const fetchResults = useCallback(async (page = 1, code?: string, windowDays?: number) => {
    setIsLoadingResults(true);
    try {
      const response = await backtestApi.getResults({ code: code || undefined, evalWindowDays: windowDays, page, limit: pageSize });
      setResults(response.items);
      setTotalResults(response.total);
      setCurrentPage(response.page);
      setPageError(null);
    } catch (err) {
      console.error('Failed to fetch backtest results:', err);
      setPageError(getParsedApiError(err));
    } finally {
      setIsLoadingResults(false);
    }
  }, []);

  // Fetch performance
  const fetchPerformance = useCallback(async (code?: string, windowDays?: number) => {
    setIsLoadingPerf(true);
    try {
      const overall = await backtestApi.getOverallPerformance(windowDays);
      setOverallPerf(overall);

      if (code) {
        const stock = await backtestApi.getStockPerformance(code, windowDays);
        setStockPerf(stock);
      } else {
        setStockPerf(null);
      }
      setPageError(null);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
      setPageError(getParsedApiError(err));
    } finally {
      setIsLoadingPerf(false);
    }
  }, []);

  // Fetch history tracking
  const fetchHistoryTracking = useCallback(async (code?: string) => {
    setIsLoadingTracking(true);
    try {
      const data = await backtestApi.getHistoryTracking({ code, days: 30 });
      setHistoryTracking(data.items);
    } catch (err) {
      console.error('Failed to fetch history tracking:', err);
    } finally {
      setIsLoadingTracking(false);
    }
  }, []);

  // Initial load — fetch performance first, then filter results by its window
  useEffect(() => {
    const init = async () => {
      // Get latest performance (unfiltered returns most recent summary)
      const overall = await backtestApi.getOverallPerformance();
      setOverallPerf(overall);
      // Use the summary's eval_window_days to filter results consistently
      const windowDays = overall?.evalWindowDays;
      if (windowDays && !evalDays) {
        setEvalDays(String(windowDays));
      }
      fetchResults(1, undefined, windowDays);
      // Fetch history tracking
      fetchHistoryTracking();
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Run backtest
  const handleRun = async () => {
    setIsRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const code = codeFilter.trim() || undefined;
      const evalWindowDays = evalDays ? parseInt(evalDays, 10) : undefined;
      const response = await backtestApi.run({
        code,
        force: forceRerun || undefined,
        minAgeDays: forceRerun ? 0 : undefined,
        evalWindowDays,
      });
      setRunResult(response);
      // Refresh data with same eval_window_days
      fetchResults(1, codeFilter.trim() || undefined, evalWindowDays);
      fetchPerformance(codeFilter.trim() || undefined, evalWindowDays);
      fetchHistoryTracking(codeFilter.trim() || undefined);
    } catch (err) {
      setRunError(getParsedApiError(err));
    } finally {
      setIsRunning(false);
    }
  };

  // Filter by code
  const handleFilter = () => {
    const code = codeFilter.trim() || undefined;
    const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
    setCurrentPage(1);
    fetchResults(1, code, windowDays);
    fetchPerformance(code, windowDays);
    fetchHistoryTracking(code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilter();
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalResults / pageSize);
  const handlePageChange = (page: number) => {
    const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
    fetchResults(page, codeFilter.trim() || undefined, windowDays);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 max-w-4xl">
          <div className="flex-1 relative">
            <input
              type="text"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Filter by stock code (leave empty for all)"
              disabled={isRunning}
              className="input-terminal w-full"
            />
          </div>
          <button
            type="button"
            onClick={handleFilter}
            disabled={isLoadingResults}
            className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
          >
            Filter
          </button>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-xs text-muted">Window</span>
            <input
              type="number"
              min={1}
              max={120}
              value={evalDays}
              onChange={(e) => setEvalDays(e.target.value)}
              placeholder="10"
              disabled={isRunning}
              className="input-terminal w-14 text-center text-xs py-2"
            />
          </div>
          <button
            type="button"
            onClick={() => setForceRerun(!forceRerun)}
            disabled={isRunning}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              transition-all duration-200 whitespace-nowrap border cursor-pointer
              ${forceRerun
                ? 'border-cyan/40 bg-cyan/10 text-cyan shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                : 'border-white/10 bg-transparent text-muted hover:border-white/20 hover:text-secondary'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <span className={`
              inline-block w-1.5 h-1.5 rounded-full transition-colors duration-200
              ${forceRerun ? 'bg-cyan shadow-[0_0_4px_rgba(0,212,255,0.6)]' : 'bg-white/20'}
            `} />
            Force
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
          >
            {isRunning ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </>
            ) : (
              'Run Backtest'
            )}
          </button>
        </div>
        {runResult && (
          <div className="mt-2 max-w-4xl">
            <RunSummary data={runResult} />
          </div>
        )}
        {runError && (
          <ApiErrorAlert error={runError} className="mt-2 max-w-4xl" />
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left sidebar - Performance */}
        <div className="flex flex-col gap-3 w-64 flex-shrink-0 overflow-y-auto">
          {isLoadingPerf ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
            </div>
          ) : overallPerf ? (
            <PerformanceCard metrics={overallPerf} title="Overall Performance" />
          ) : (
            <Card padding="md">
              <p className="text-xs text-muted text-center py-4">
                No backtest data yet. Run a backtest to see performance metrics.
              </p>
            </Card>
          )}

          {stockPerf && (
            <PerformanceCard metrics={stockPerf} title={`${stockPerf.code || codeFilter}`} />
          )}

          {/* History Tracking Section */}
          <Card padding="sm" className="animate-fade-in">
            <div className="mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="label-uppercase">历史追踪 (30天)</span>
            </div>

            {isLoadingTracking ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-purple/20 border-t-purple rounded-full animate-spin" />
              </div>
            ) : historyTracking.length === 0 ? (
              <p className="text-xs text-muted text-center py-3">
                暂无追踪数据
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-2 py-1 font-medium">代码</th>
                      <th className="px-2 py-1 font-medium">日期</th>
                      <th className="px-2 py-1 font-medium">评分</th>
                      <th className="px-2 py-1 font-medium">建议</th>
                      <th className="px-2 py-1 font-medium">结果</th>
                      <th className="px-2 py-1 font-medium text-right">涨跌</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyTracking.slice(0, 10).map((item) => (
                      <HistoryTrackingRow key={`${item.code}-${item.date}-${item.historyId}`} item={item} />
                    ))}
                  </tbody>
                </table>
                {historyTracking.length > 10 && (
                  <p className="text-xs text-muted text-center mt-2">
                    还有 {historyTracking.length - 10} 条记录...
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right content - Results table */}
        <section className="flex-1 overflow-y-auto">
          {pageError ? (
            <ApiErrorAlert error={pageError} className="mb-3" />
          ) : null}
          {isLoadingResults ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-10 h-10 border-3 border-cyan/20 border-t-cyan rounded-full animate-spin" />
              <p className="mt-3 text-secondary text-sm">Loading results...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-12 h-12 mb-3 rounded-xl bg-elevated flex items-center justify-center">
                <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-white mb-1.5">No Results</h3>
              <p className="text-xs text-muted max-w-xs">
                Run a backtest to evaluate historical analysis accuracy
              </p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-elevated text-left">
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Code</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Advice</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Dir.</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Outcome</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider text-right">Return%</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider text-center">SL</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider text-center">TP</th>
                      <th className="px-3 py-2.5 text-xs font-medium text-secondary uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row) => (
                      <tr
                        key={row.analysisHistoryId}
                        className="border-t border-white/5 hover:bg-hover transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-cyan text-xs">{row.code}</td>
                        <td className="px-3 py-2 text-xs text-secondary">{row.analysisDate || '--'}</td>
                        <td className="px-3 py-2 text-xs text-white truncate max-w-[140px]" title={row.operationAdvice || ''}>
                          {row.operationAdvice || '--'}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="flex items-center gap-1">
                            {boolIcon(row.directionCorrect)}
                            <span className="text-muted">{row.directionExpected || ''}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2">{outcomeBadge(row.outcome)}</td>
                        <td className="px-3 py-2 text-xs font-mono text-right">
                          <span className={
                            row.simulatedReturnPct != null
                              ? row.simulatedReturnPct > 0 ? 'text-emerald-400' : row.simulatedReturnPct < 0 ? 'text-red-400' : 'text-secondary'
                              : 'text-muted'
                          }>
                            {pct(row.simulatedReturnPct)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{boolIcon(row.hitStopLoss)}</td>
                        <td className="px-3 py-2 text-center">{boolIcon(row.hitTakeProfit)}</td>
                        <td className="px-3 py-2">{statusBadge(row.evalStatus || '', row.analysisDate || undefined)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>

              <p className="text-xs text-muted text-center mt-2">
                {totalResults} result{totalResults !== 1 ? 's' : ''} total
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default BacktestPage;
