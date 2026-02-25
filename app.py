import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__)
BASE_DIR = os.path.abspath(".")
STATE_FILE = os.path.join(BASE_DIR, "progress.json")

# ⚙️ CONFIGURATION ZONE ⚙️
# ⚙️ CONFIGURATION ZONE ⚙️
TIERS = [
    {"id": "ssp", "name": "X+", "color": "#f38ba8"},         # Red
    {"id": "ss", "name": "X", "color": "#f38ba8"},           # Red
    {"id": "sp", "name": "S+", "color": "#fab387"},          # Peach
    {"id": "s", "name": "S", "color": "#fab387"},            # Peach
    {"id": "a", "name": "A", "color": "#f9e2af"},            # Yellow
    {"id": "b", "name": "B", "color": "#a6e3a1"},            # Green
    {"id": "c", "name": "C", "color": "#89b4fa"},            # Blue
    {"id": "d", "name": "D", "color": "#cba6f7"},            # Mauve
    {"id": "f", "name": "F", "color": "#800080"},            # Purple
    {"id": "not_waifu", "name": "Not Waifu", "color": "#9399b2"}, 
    {"id": "uhhh", "name": "uhhh", "color": "#6c7086"}
]

state = {
    "pending": [],
    "results": {tier['id']: [] for tier in TIERS}
}

def load_all_images_from_disk():
    images = []
    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['templates', 'static']]
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                brand = os.path.basename(root).upper()
                if brand == os.path.basename(BASE_DIR).upper():
                    brand = "UNCATEGORIZED"
                product = os.path.splitext(file)[0]
                rel_path = os.path.relpath(os.path.join(root, file), BASE_DIR).replace("\\", "/")
                
                images.append({
                    "path": rel_path,
                    "display_name": f"[{brand}] {product}"
                })
    return images

def load_or_init_state():
    global state
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            state = json.load(f)
    else:
        state["pending"] = load_all_images_from_disk()
        state["results"] = {tier['id']: [] for tier in TIERS}
        save_state()

def save_state():
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=4)

@app.route('/')
def index():
    load_or_init_state()
    return render_template('index.html', tiers=TIERS)

@app.route('/api/state')
def get_state():
    # Send the current layout to the frontend
    total_images = len(state["pending"]) + sum(len(items) for items in state["results"].values())
    current_index = sum(len(items) for items in state["results"].values()) + 1
    
    return jsonify({
        "results": state["results"],
        "next_item": state["pending"][0] if state["pending"] else None,
        "progress": {"current": current_index, "total": total_images}
    })

@app.route('/api/action', methods=['POST'])
def handle_action():
    global state
    data = request.json
    action = data.get('action')
    
    if action == 'rank_new':
        tier_id = data.get('tier_id')
        note = data.get('note', '')
        if state["pending"]:
            item = state["pending"].pop(0)
            item["note"] = note
            state["results"][tier_id].append(item)
            
    elif action == 'move':
        old_tier = data.get('old_tier')
        new_tier = data.get('new_tier')
        path = data.get('path')
        
        # Find and remove from old tier
        item_to_move = None
        for i, item in enumerate(state["results"][old_tier]):
            if item["path"] == path:
                item_to_move = state["results"][old_tier].pop(i)
                break
                
        # Add to new tier
        if item_to_move:
            state["results"][new_tier].append(item_to_move)

    elif action == 'update_note':
        tier_id = data.get('tier_id')
        path = data.get('path')
        new_note = data.get('note')
        
        for item in state["results"][tier_id]:
            if item["path"] == path:
                item["note"] = new_note
                break

    save_state()
    return jsonify({"status": "success"})

@app.route('/api/save_txt', methods=['POST'])
def save_tierlist_txt():
    tier_name_map = {t['id']: t['name'] for t in TIERS}
    with open("tierlist.txt", "w", encoding="utf-8") as f:
        for tier_id, items in state["results"].items():
            f.write(f"=== {tier_name_map[tier_id]} ===\n")
            for item in items:
                line = f" - {item['display_name']}"
                if item.get('note'):
                    line += f" | Note: {item['note']}"
                f.write(line + "\n")
            f.write("\n")
    return jsonify({"status": "saved"})

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    load_or_init_state()
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)
