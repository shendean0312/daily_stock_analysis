import type React from 'react';
import { useState, useEffect } from 'react';
import type { HistoryItem } from '../../types/analysis';
import { getSentimentColor } from '../../types/analysis';
import { formatDateTime } from '../../utils/format';
import { Pagination } from '../common/Pagination';

interface HistoryListProps {
  items: HistoryItem[];
  isLoading: boolean;
  selectedId?: number;  // Selected history record ID
  onItemClick: (recordId: number) => void;  // Callback with record ID
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * 历史记录列表组件
 * 显示最近的股票分析历史，支持搜索过滤和分页
 */
export const HistoryList: React.FC<HistoryListProps> = ({
  items,
  isLoading,
  selectedId,
  onItemClick,
  keyword,
  onKeywordChange,
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  const [localKeyword, setLocalKeyword] = useState(keyword);

  // 防抖处理搜索输入
  useEffect(() => {
    const timer = setTimeout(() => {
      onKeywordChange(localKeyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [localKeyword, onKeywordChange]);

  useEffect(() => {
    setLocalKeyword(keyword);
  }, [keyword]);

  return (
    <aside className={`glass-card overflow-hidden flex flex-col ${className}`}>
      <div className="p-3 border-b border-white/5 shrink-0 flex flex-col gap-3">
        <h2 className="text-xs font-medium text-purple uppercase tracking-wider flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          历史记录
        </h2>
        <div className="relative">
          <input
            type="text"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            placeholder="搜索代码或名称..."
            className="input-terminal w-full pl-8 h-8 text-xs"
          />
          <svg className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted text-xs">
            暂无历史记录
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick(item.id)}
                className={`history-item w-full text-left ${selectedId === item.id ? 'active' : ''}`}
              >
                <div className="flex items-center gap-2 w-full">
                  {/* 情感分数指示条 */}
                  {item.sentimentScore !== undefined && (
                    <span
                      className="w-0.5 h-8 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: getSentimentColor(item.sentimentScore),
                        boxShadow: `0 0 6px ${getSentimentColor(item.sentimentScore)}40`
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-medium text-white truncate text-xs">
                        {item.stockName || item.stockCode}
                      </span>
                      {item.sentimentScore !== undefined && (
                        <span
                          className="text-xs font-mono font-semibold px-1 py-0.5 rounded"
                          style={{
                            color: getSentimentColor(item.sentimentScore),
                            backgroundColor: `${getSentimentColor(item.sentimentScore)}15`
                          }}
                        >
                          {item.sentimentScore}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted font-mono">
                        {item.stockCode}
                      </span>
                      <span className="text-xs text-muted/50">·</span>
                      <span className="text-xs text-muted">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 shrink-0 flex justify-center">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </aside>
  );
};
