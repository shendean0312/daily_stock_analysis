import sys 
sys.path.insert(0, '.') 
import src.analyzer as m 
print([x for x in dir(m) if not x.startswith('_')]) 
