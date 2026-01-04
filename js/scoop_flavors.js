document.addEventListener('DOMContentLoaded', () => {
    // Event delegation: catch submits from any form.add-batch
    document.addEventListener('submit', (event) => {
		alert('hi?');
        const form = event.target;

        if (!form.classList.contains('add-batch')) {
            return; // not our form
        }

        event.preventDefault();

        const flavorInput = form.querySelector('input[name="flavor"]');
        const countInput  = form.querySelector('input[name="count"]');
        const button      = form.querySelector('button[type="submit"]');

        if (!flavorInput || !countInput || !button) {
            return;
        }

        const flavor = flavorInput.value;
        const count  = parseInt(countInput.value, 10) || 1;

        if (!flavor || count < 1) {
            return;
        }

        // UI feedback
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = '…';

        // Build POST body
        const params = new URLSearchParams();
        params.append('action', 'scoop_add_batches');
        params.append('flavor', flavor);
        params.append('count', String(count));
        params.append('nonce', SCOOP_FLAVORS.nonce);
		console.log(params);
        fetch(SCOOP_FLAVORS.ajax_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: params.toString()
        })
        .then((response) => response.json())
        .then((data) => {
            if (data && data.success) {
                // simplest: reload to show new batches/tubs
                window.location.reload();
            } else {
                console.error('Add batches failed', data);
                button.disabled = false;
                button.textContent = originalText;
            }
        })
        .catch((error) => {
            console.error('AJAX error adding batches', error);
            button.disabled = false;
            button.textContent = originalText;
        });
    });
});