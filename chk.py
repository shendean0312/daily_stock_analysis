import codecs 
f = codecs.open('logs/stock_analysis_debug_20260311.log', 'r', 'utf-8', 'ignore') 
content = f.read() 
f.close() 
idx = content.find('Historical Analysis Tracker') 
print('Found:', idx) 
