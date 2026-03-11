import sys 
sys.path.insert(0, '.') 
from src.analyzer import GeminiAnalyzer 
import inspect 
src = inspect.getsource(GeminiAnalyzer._format_prompt) 
print('Has build_history_section:', 'build_history_section' in src) 
print('Has memory_patch:', 'memory_patch' in src) 
