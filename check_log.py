f=open('logs/stock_analysis_debug_20260311.log',encoding='utf-8',errors='ignore') 
lines=f.readlines() 
f.close() 
hits=[i for i,l in enumerate(lines) if '历史分析追踪' in l or '记忆层' in l] 
print('找到',len(hits),'处匹配') 
[print(f'行{i}:',lines[i][:200]) for i in hits[:3]] 
