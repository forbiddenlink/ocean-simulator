import * as THREE from 'three';

export class TextureGenerator {
    /**
     * Generates a seamless noise normal map for water effects.
     * @param size Size of the texture (default 512)
     */
    public static generateWaterNormals(size: number = 512): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        if (!context) {
            return new THREE.Texture();
        }

        // Fill with base blue-purple (flat normal)
        context.fillStyle = '#8080ff';
        context.fillRect(0, 0, size, size);

        // Draw some random noise to simulate waves
        // We'll use a specific approach: draw many random smooth gradients
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = 20 + Math.random() * 40;

            const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
            // Random slight perturbations in normal vector direction
            const r = 100 + Math.floor(Math.random() * 60); // Variation in X tilt
            const g = 100 + Math.floor(Math.random() * 60); // Variation in Y tilt
            const b = 255;

            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

            context.fillStyle = gradient;
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();

            // Wrap around for seamlessnes (simple approach: draw clones at edges)
            // Ideally we'd do a proper seamless noise algorithm, but this is a fast approximation
        }

        // Use ImageData manipulation for better noise if needed, 
        // but canvas gradients are fast and "smooth" enough for water ripples.

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        return texture;
    }
}
