import sqlite3

# Connect to the database
conn = sqlite3.connect('yuvindu_data.db')
cursor = conn.cursor()

# Check total records
cursor.execute('SELECT COUNT(*) FROM exported_metrics')
total_records = cursor.fetchone()[0]
print(f'Total records: {total_records}')

# Show sample data
cursor.execute('SELECT session_id, window_start, window_end, block_focus FROM exported_metrics LIMIT 5')
rows = cursor.fetchall()
print('\nSample records:')
for row in rows:
    print(f'  Session {row[0]}: {row[1]} to {row[2]} (focus: {row[3]})')

# Check session distribution
cursor.execute('SELECT session_id, COUNT(*) FROM exported_metrics GROUP BY session_id')
sessions = cursor.fetchall()
print('\nRecords per session:')
for session_id, count in sessions:
    print(f'  Session {session_id}: {count} records')

conn.close()
