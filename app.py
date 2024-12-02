from flask import Flask, render_template, jsonify, request
from ytmusicapi import YTMusic
import json

app = Flask(__name__)
ytmusic = YTMusic()

# Store the current playlist queue
playlist_queue = []
current_track_index = 0

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    query = request.json.get('query', '')
    try:
        search_results = ytmusic.search(query, filter='songs', limit=10)
        formatted_results = []
        
        for song in search_results:
            # Extract relevant information
            song_data = {
                'title': song.get('title', 'N/A'),
                'duration': song.get('duration', 'N/A'),
                'videoId': song.get('videoId', 'N/A'),
                'artists': [artist['name'] for artist in song.get('artists', [])],
                'thumbnail': song.get('thumbnails', [{}])[-1].get('url', 'N/A'),
                'album': song.get('album', {}).get('name', 'N/A')
            }
            formatted_results.append(song_data)
            
        return jsonify({'results': formatted_results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/add_to_queue', methods=['POST'])
def add_to_queue():
    track = request.json
    playlist_queue.append(track)
    return jsonify({'message': 'Added to queue', 'queue_length': len(playlist_queue)})

@app.route('/get_queue')
def get_queue():
    return jsonify({
        'queue': playlist_queue,
        'current_index': current_track_index
    })

@app.route('/next_track')
def next_track():
    global current_track_index
    if current_track_index < len(playlist_queue) - 1:
        current_track_index += 1
        return jsonify(playlist_queue[current_track_index])
    return jsonify({'error': 'No more tracks'}), 404

@app.route('/previous_track')
def previous_track():
    global current_track_index
    if current_track_index > 0:
        current_track_index -= 1
        return jsonify(playlist_queue[current_track_index])
    return jsonify({'error': 'No previous tracks'}), 404

if __name__ == '__main__':
    app.run(debug=True)
