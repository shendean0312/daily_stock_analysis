import sys 
sys.path.insert(0, '.') 
from src.analyzer import StockAnalyzer 
import inspect 
src = inspect.getsource(StockAnalyzer._format_prompt) 
print('Has memory patch:', 'build_history_section' in src) 
print('Has memory_patch import:', 'memory_patch' in src) 
