/**
 * Animated Eagle Favicon
 * Cycles through 4 frames of a flapping eagle every 150ms.
 */
(function() {
    // Create an off-screen canvas for drawing the favicon
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Get or create the favicon link element
    let favicon = document.getElementById('favicon');
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.id = 'favicon';
        favicon.rel = 'icon';
        favicon.type = 'image/png';
        document.head.appendChild(favicon);
    }

    let frame = 0;

    /**
     * Draws a specific phase of the eagle animation.
     * @param {number} phase - The animation phase (0-3).
     */
    function drawEagle(phase) {
        ctx.clearRect(0, 0, 16, 16);
        
        // Eagle body (side view - facing right)
        ctx.fillStyle = "#8B4513";
        
        // Body
        ctx.fillRect(7, 7, 4, 3);
        
        // Head (front)
        ctx.fillRect(11, 6, 2, 3);
        
        // Beak
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(13, 7, 1, 1);
        
        // Eye
        ctx.fillStyle = "#000";
        ctx.fillRect(12, 7, 1, 1);
        
        // Tail feathers (back)
        ctx.fillStyle = "#654321";
        ctx.fillRect(5, 7, 2, 1);
        ctx.fillRect(4, 8, 2, 1);
        ctx.fillRect(3, 8, 1, 1);
        
        // Wings - 4 phases for flapping animation (side view)
        ctx.fillStyle = "#8B4513";
        
        if (phase === 0) {
            // Wings up high - upstroke
            ctx.fillRect(7, 3, 4, 1);
            ctx.fillRect(6, 4, 5, 1);
            ctx.fillRect(5, 5, 6, 1);
            ctx.fillRect(6, 6, 4, 1);
            // Wing tips darker
            ctx.fillStyle = "#654321";
            ctx.fillRect(5, 5, 1, 1);
            ctx.fillRect(6, 4, 1, 1);
        }
        else if (phase === 1) {
            // Wings mid-up
            ctx.fillRect(6, 5, 5, 1);
            ctx.fillRect(5, 6, 6, 1);
            ctx.fillRect(5, 7, 5, 1);
            // Wing tips
            ctx.fillStyle = "#654321";
            ctx.fillRect(5, 6, 1, 1);
            ctx.fillRect(5, 7, 1, 1);
        }
        else if (phase === 2) {
            // Wings mid-down
            ctx.fillRect(5, 8, 6, 1);
            ctx.fillRect(6, 9, 5, 1);
            ctx.fillRect(6, 10, 4, 1);
            // Wing tips
            ctx.fillStyle = "#654321";
            ctx.fillRect(5, 8, 1, 1);
            ctx.fillRect(6, 9, 1, 1);
        }
        else {
            // Wings down - downstroke
            ctx.fillRect(6, 10, 4, 1);
            ctx.fillRect(5, 11, 5, 1);
            ctx.fillRect(6, 12, 4, 1);
            ctx.fillRect(7, 13, 2, 1);
            // Wing tips
            ctx.fillStyle = "#654321";
            ctx.fillRect(5, 11, 1, 1);
            ctx.fillRect(6, 12, 1, 1);
        }
        
        // Legs
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(8, 10, 1, 1);
        ctx.fillRect(10, 10, 1, 1);
    }

    /**
     * Animation loop.
     */
    function animate() {
        drawEagle(frame % 4);
        
        // Update favicon
        favicon.href = canvas.toDataURL("image/png");
        
        frame++;
        setTimeout(animate, 150);
    }

    // Start the animation
    animate();
})();
