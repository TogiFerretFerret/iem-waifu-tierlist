document.addEventListener('DOMContentLoaded', () => {
    const imgContainer = document.getElementById('image-container');
    const activeImg = document.getElementById('active-image');
    let currentPendingItem = null;

    // Fetch the entire board state on load/reload
    refreshBoard();

    function refreshBoard() {
        fetch('/api/state')
            .then(res => res.json())
            .then(data => {
                renderTiers(data.results);
                updateCenterStage(data.next_item, data.progress);
            });
    }

    function updateCenterStage(nextItem, progress) {
        if (!nextItem) {
            document.getElementById('item-name').textContent = "All Caught Up!";
            document.getElementById('progress-text').textContent = "Everything is ranked.";
            activeImg.style.display = 'none';
            currentPendingItem = null;
        } else {
            currentPendingItem = nextItem;
            document.getElementById('item-name').textContent = nextItem.display_name;
            document.getElementById('progress-text').textContent = `Ranking: ${progress.current} of ${progress.total}`;
            activeImg.src = '/images/' + nextItem.path;
            activeImg.style.display = 'block';
        }
    }

    function renderTiers(results) {
        // Clear all dropzones
        document.querySelectorAll('.tier-dropzone').forEach(dz => dz.innerHTML = '');

        // Populate items
        for (const [tierId, items] of Object.entries(results)) {
            const dropzone = document.getElementById(`dropzone-${tierId}`);
            if (!dropzone) continue;

            items.forEach(item => {
                const wrapper = document.createElement('div');
                wrapper.className = 'thumb-wrapper';
                wrapper.draggable = true;
                
                const img = document.createElement('img');
                img.src = '/images/' + item.path;
                img.className = 'ranked-thumbnail';
                wrapper.appendChild(img);

                // Add note badge if it has a note
                if (item.note) {
                    const badge = document.createElement('div');
                    badge.className = 'note-badge';
                    badge.textContent = '📝';
                    wrapper.appendChild(badge);
                }

                // Drag to move an already ranked item
                wrapper.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        source: 'tier',
                        old_tier: tierId,
                        path: item.path
                    }));
                    setTimeout(() => wrapper.style.opacity = '0.5', 0);
                });
                wrapper.addEventListener('dragend', () => wrapper.style.opacity = '1');

                // Click to read/edit note
                wrapper.addEventListener('click', () => {
                    const currentNote = item.note || "";
                    const newNote = prompt(`Notes for ${item.display_name}:\n(Edit below or leave empty to clear)`, currentNote);
                    
                    if (newNote !== null && newNote !== currentNote) {
                        fetch('/api/action', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'update_note', tier_id: tierId, path: item.path, note: newNote.trim() })
                        }).then(refreshBoard);
                    }
                });

                dropzone.appendChild(wrapper);
            });
        }
    }

    // Dragging the main unranked image
    activeImg.addEventListener('dragstart', (e) => {
        if (!currentPendingItem) return;
        e.dataTransfer.setData('application/json', JSON.stringify({
            source: 'center'
        }));
    });

    // Setup Dropzones
    document.querySelectorAll('.tier-row').forEach(row => {
        const dropzone = row.querySelector('.tier-dropzone');
        const tierId = row.dataset.tierId;

        dropzone.addEventListener('dragover', e => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            
            const payload = JSON.parse(e.dataTransfer.getData('application/json'));

            if (payload.source === 'center') {
                // Ranking a new item
                let note = prompt(`Ranking in [${tierId}]\nAny notes? (Leave blank to skip)`);
                if (note === null) return; 

                fetch('/api/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'rank_new', tier_id: tierId, note: note.trim() })
                }).then(refreshBoard);

            } else if (payload.source === 'tier') {
                // Moving an existing item
                if (payload.old_tier !== tierId) {
                    fetch('/api/action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'move', old_tier: payload.old_tier, new_tier: tierId, path: payload.path })
                    }).then(refreshBoard);
                }
            }
        });
    });

    document.getElementById('finish-btn').addEventListener('click', () => {
        fetch('/api/save_txt', { method: 'POST' })
            .then(() => alert('Successfully exported to tierlist.txt!'));
    });

    document.addEventListener('keydown', e => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            imgContainer.classList.toggle('bg-white');
            imgContainer.classList.toggle('bg-black');
        }
    });
});
