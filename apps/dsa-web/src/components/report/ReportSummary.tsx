import React, { useState } from 'react';
import type { AnalysisResult, AnalysisReport } from '../../types/analysis';
import { ReportOverview } from './ReportOverview';
import { ReportStrategy } from './ReportStrategy';
import { ReportNews } from './ReportNews';
import { ReportDetails } from './ReportDetails';
import { Drawer, Collapsible } from '../common';
import { historyApi } from '../../api/history';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportSummaryProps {
  data: AnalysisResult | AnalysisReport;
  isHistory?: boolean;
}

/**
 * 完整报告展示组件
 * 整合概览、策略、资讯、详情四个区域
 */
export const ReportSummary: React.FC<ReportSummaryProps> = ({
  data,
  isHistory = false,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoadingMd, setIsLoadingMd] = useState(false);

  // 兼容 AnalysisResult 和 AnalysisReport 两种数据格式
  const report: AnalysisReport = 'report' in data ? data.report : data;
  // 使用 report id，因为 queryId 在批量分析时可能重复，且历史报告详情接口需要 recordId 来获取关联资讯和详情数据
  const recordId = report.meta.id;

  const { meta, summary, strategy, details } = report;
  const modelUsed = (meta.modelUsed || '').trim();
  const shouldShowModel = Boolean(
    modelUsed && !['unknown', 'error', 'none', 'null', 'n/a'].includes(modelUsed.toLowerCase()),
  );

  const handleOpenReport = async () => {
    setIsDrawerOpen(true);
    if (!markdownContent && recordId) {
      setIsLoadingMd(true);
      try {
        const md = await historyApi.getMarkdown(recordId);
        setMarkdownContent(md);
      } catch (err) {
        console.error('Failed to fetch markdown', err);
        setMarkdownContent('无法加载报告内容，请稍后重试。');
      } finally {
        setIsLoadingMd(false);
      }
    }
  };

  const handleExport = () => {
    if (!markdownContent) return;
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `分析报告_${meta.stockCode}_${meta.createdAt || '最新'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* 概览区（首屏） */}
      <ReportOverview
        meta={meta}
        summary={summary}
        isHistory={isHistory}
        onViewReport={recordId ? handleOpenReport : undefined}
      />

      {/* 策略点位区 */}
      <ReportStrategy strategy={strategy} />

      {/* 历史复盘区（插在策略和资讯之间） */}
      {details?.historyBlock && (
        <Collapsible title="历史复盘追踪" defaultOpen={true}>
          <div className="prose prose-invert max-w-none prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {details.historyBlock}
            </ReactMarkdown>
          </div>
        </Collapsible>
      )}

      {/* 资讯区 */}
      <ReportNews recordId={recordId} />

      {/* 透明度与追溯区 */}
      <ReportDetails details={details} recordId={recordId} />

      {/* 分析模型标记（Issue #528）— 报告末尾 */}
      {shouldShowModel && (
        <p className="text-xs text-gray-500 mt-3">
          分析模型: {modelUsed}
        </p>
      )}

      {/* 详细报告抽屉 */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="详细分析报告"
        width="max-w-4xl"
      >
        <div className="flex justify-end mb-4">
          <button
            onClick={handleExport}
            disabled={!markdownContent || isLoadingMd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan text-sm hover:bg-cyan/20 transition-colors disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出报告 (.md)
          </button>
        </div>
        
        <div className="prose prose-invert max-w-none">
          {isLoadingMd ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-cyan/20 border-t-cyan rounded-full animate-spin" />
              <p className="mt-3 text-secondary text-sm">正在生成排版...</p>
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
            </ReactMarkdown>
          )}
        </div>
      </Drawer>
    </div>
  );
};
