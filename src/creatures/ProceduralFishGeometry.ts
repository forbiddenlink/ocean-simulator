import * as THREE from 'three';

/**
 * Procedural Fish Geometry Generator
 * Creates realistic-looking fish with smooth bodies, proper fins, and tails
 */
export class ProceduralFishGeometry {

    /**
     * Create a realistic fish geometry with smooth body and proper fins
     */
    public static createFish(params: {
        length?: number;
        bodyThickness?: number;
        species?: 'small' | 'medium' | 'large';
    } = {}): THREE.BufferGeometry {
        let {
            length = 1.0,
            bodyThickness = 0.3,
            species = 'medium'
        } = params;

        // Adjust dimensions based on species
        switch (species) {
            case 'small':
                length *= 0.6;
                bodyThickness *= 0.7;
                break;
            case 'large':
                length *= 1.5;
                bodyThickness *= 1.3;
                break;
            case 'medium':
            default:
                // Use default values
                break;
        }

        // Create smooth fish body using merged geometries
        const group = new THREE.Group();

        // Main body - elongated smooth shape with higher detail
        const bodyGeometry = this.createFishBody(length, bodyThickness);
        const bodyMesh = new THREE.Mesh(bodyGeometry);
        group.add(bodyMesh);
        
        // Add subtle body details (ridges, gills)
        const gillGeometry = this.createGillDetail(length, bodyThickness);
        const gillMesh = new THREE.Mesh(gillGeometry);
        gillMesh.position.x = -length * 0.2;
        group.add(gillMesh);

        // Tail fin - more detailed
        const tailGeometry = this.createTailFin(length, bodyThickness);
        const tailMesh = new THREE.Mesh(tailGeometry);
        tailMesh.position.x = length * 0.4;
        group.add(tailMesh);

        // Dorsal fin (top) - improved shape
        const dorsalGeometry = this.createDorsalFin(length, bodyThickness);
        const dorsalMesh = new THREE.Mesh(dorsalGeometry);
        dorsalMesh.position.y = bodyThickness * 0.4;
        group.add(dorsalMesh);
        
        // Anal fin (bottom) for balance
        const analGeometry = this.createAnalFin(length, bodyThickness);
        const analMesh = new THREE.Mesh(analGeometry);
        analMesh.position.y = -bodyThickness * 0.25;
        analMesh.position.x = length * 0.1;
        group.add(analMesh);

        // Pectoral fins (sides) - larger and more detailed
        const pectoralGeometry = this.createPectoralFin(length, bodyThickness);
        const pectoralLeft = new THREE.Mesh(pectoralGeometry);
        pectoralLeft.position.set(-length * 0.15, -bodyThickness * 0.05, bodyThickness * 0.35);
        pectoralLeft.rotation.set(0.2, 0, Math.PI * 0.15);
        group.add(pectoralLeft);

        const pectoralRight = new THREE.Mesh(pectoralGeometry);
        pectoralRight.position.set(-length * 0.15, -bodyThickness * 0.05, -bodyThickness * 0.35);
        pectoralRight.rotation.set(0.2, 0, -Math.PI * 0.15);
        group.add(pectoralRight);
        
        // Pelvic fins
        const pelvicGeometry = this.createPelvicFin(length, bodyThickness);
        const pelvicLeft = new THREE.Mesh(pelvicGeometry);
        pelvicLeft.position.set(0, -bodyThickness * 0.3, bodyThickness * 0.15);
        pelvicLeft.rotation.set(0.5, 0, 0.3);
        group.add(pelvicLeft);
        
        const pelvicRight = new THREE.Mesh(pelvicGeometry);
        pelvicRight.position.set(0, -bodyThickness * 0.3, -bodyThickness * 0.15);
        pelvicRight.rotation.set(0.5, 0, -0.3);
        group.add(pelvicRight);

        // Eyes - create with proper structure (white sclera + dark pupil)
        const eyeSize = bodyThickness * 0.18;
        
        // Left eye
        const eyeLeftOuter = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 16, 16));
        eyeLeftOuter.position.set(-length * 0.35, bodyThickness * 0.15, bodyThickness * 0.28);
        eyeLeftOuter.name = "eye_white";
        group.add(eyeLeftOuter);
        
        // Left pupil
        const pupilLeftGeom = new THREE.SphereGeometry(eyeSize * 0.5, 12, 12);
        const pupilLeft = new THREE.Mesh(pupilLeftGeom);
        pupilLeft.position.set(-length * 0.35 - eyeSize * 0.3, bodyThickness * 0.15, bodyThickness * 0.28 + eyeSize * 0.4);
        pupilLeft.name = "eye_pupil";
        group.add(pupilLeft);
        
        // Right eye
        const eyeRightOuter = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 16, 16));
        eyeRightOuter.position.set(-length * 0.35, bodyThickness * 0.15, -bodyThickness * 0.28);
        eyeRightOuter.name = "eye_white";
        group.add(eyeRightOuter);
        
        // Right pupil
        const pupilRight = new THREE.Mesh(pupilLeftGeom);
        pupilRight.position.set(-length * 0.35 - eyeSize * 0.3, bodyThickness * 0.15, -bodyThickness * 0.28 - eyeSize * 0.4);
        pupilRight.name = "eye_pupil";
        group.add(pupilRight);

        // Merge all geometries into one
        const mergedGeometry = this.mergeGroup(group);
        mergedGeometry.computeVertexNormals();

        return mergedGeometry;
    }

    // ... (createFishBody, createTailFin, createDorsalFin, createPectoralFin methods remain identical)
    /**
     * Create smooth fish body using a tapered cylinder with proper anatomical shape
     */
    private static createFishBody(length: number, thickness: number): THREE.BufferGeometry {
        const segments = 32; // Increased for smoother body
        const radialSegments = 16; // Increased for rounder body

        const positions: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];

        // Create body with realistic fish taper profile
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = (t - 0.5) * length;

            // Realistic fish body profile using a compound curve
            // Head (t=0 to 0.2): rounded snout
            // Body (t=0.2 to 0.6): maximum girth
            // Tail (t=0.6 to 1.0): rapid taper
            let profile: number;
            if (t < 0.2) {
                // Head taper
                const headT = t / 0.2;
                profile = 0.3 + headT * 0.7; // Gradual increase
            } else if (t < 0.6) {
                // Main body - maximum girth
                const bodyT = (t - 0.2) / 0.4;
                profile = 1.0 - bodyT * 0.3; // Slight taper
            } else {
                // Tail - rapid taper
                const tailT = (t - 0.6) / 0.4;
                profile = 0.7 * (1.0 - tailT * tailT); // Quadratic taper
            }
            
            const radius = thickness * profile;

            // Fish body cross-section: taller than wide (fusiform/streamlined)
            const yScale = 1.0; // Height
            const zScale = 0.7; // Width (compressed laterally)

            for (let j = 0; j <= radialSegments; j++) {
                const angle = (j / radialSegments) * Math.PI * 2;
                const y = Math.cos(angle) * radius * yScale;
                const z = Math.sin(angle) * radius * zScale;

                positions.push(x, y, z);
                
                // Vertex colors: lighter belly, darker back
                const dorsalVentralGradient = (Math.cos(angle) + 1.0) / 2.0; // 1.0 at top, 0.0 at bottom
                const backColor = 1.0; // Full color on back
                const bellyColor = 1.2; // Lighter belly
                const colorMix = dorsalVentralGradient * backColor + (1.0 - dorsalVentralGradient) * bellyColor;
                colors.push(colorMix, colorMix, colorMix);
            }
        }

        // Create indices
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const a = i * (radialSegments + 1) + j;
                const b = a + radialSegments + 1;
                const c = a + 1;
                const d = b + 1;

                indices.push(a, b, c);
                indices.push(c, b, d);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        return geometry;
    }

    /**
     * Create tail fin with realistic forked or rounded shape
     */
    private static createTailFin(length: number, thickness: number): THREE.BufferGeometry {
        const finLength = length * 0.35; // Larger tail

        const positions: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];

        // Create a forked tail shape (lunate tail like tuna/fast swimmers)
        const segments = 12;
        
        // Center attachment point
        const baseX = 0;
        
        // Upper lobe
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = -Math.PI * 0.4 + t * Math.PI * 0.3; // Upper arc
            const radius = finLength * (0.5 + t * 0.5); // Gets longer toward tip
            
            const x = baseX + Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const z = t * thickness * 0.15 - thickness * 0.075;
            
            positions.push(x, y, z);
            colors.push(0.9, 0.9, 0.9); // Slight lighten for fins
        }
        
        // Lower lobe (mirror)
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = Math.PI * 0.4 - t * Math.PI * 0.3; // Lower arc
            const radius = finLength * (0.5 + t * 0.5);
            
            const x = baseX + Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const z = t * thickness * 0.15 - thickness * 0.075;
            
            positions.push(x, y, z);
            colors.push(0.9, 0.9, 0.9);
        }

        // Create triangles to form the tail
        const upperCount = segments + 1;
        for (let i = 0; i < segments; i++) {
            // Upper lobe triangles
            indices.push(0, i, i + 1);
            
            // Lower lobe triangles
            indices.push(upperCount, upperCount + i + 1, upperCount + i);
        }
        
        // Connect upper and lower lobes
        for (let i = 0; i < segments; i++) {
            indices.push(i, upperCount + i, i + 1);
            indices.push(i + 1, upperCount + i, upperCount + i + 1);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        return geometry;
    }

    /**
     * Create dorsal fin (top fin) with realistic shape
     */
    private static createDorsalFin(length: number, thickness: number): THREE.BufferGeometry {
        const finLength = length * 0.35;
        const finHeight = thickness * 1.2;

        const positions: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];

        // Create triangular dorsal fin with curved profile
        const segments = 10;
        
        // Base of fin (attached to body)
        for (let i = 0; i <= segments; i++) {
            positions.push(i * finLength / segments - finLength * 0.5, 0, 0);
            colors.push(0.95, 0.95, 0.95);
        }
        
        // Tip of fin (curved profile)
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = t * finLength - finLength * 0.5;
            // Curved height profile - highest in middle
            const heightProfile = Math.sin(t * Math.PI);
            const y = heightProfile * finHeight;
            const z = heightProfile * thickness * 0.1; // Slight curve forward
            
            positions.push(x, y, z);
            colors.push(0.85, 0.85, 0.85); // Slightly darker at tip
        }

        // Create triangles
        for (let i = 0; i < segments; i++) {
            const base1 = i;
            const base2 = i + 1;
            const tip1 = segments + 1 + i;
            const tip2 = segments + 1 + i + 1;
            
            indices.push(base1, tip1, base2);
            indices.push(base2, tip1, tip2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        return geometry;
    }

    /**
     * Create pectoral fin (side fin) with realistic fan shape
     */
    private static createPectoralFin(length: number, _thickness: number): THREE.BufferGeometry {
        const finLength = length * 0.28;

        const positions: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];

        // Create fan-shaped pectoral fin
        const radialSegments = 8;
        const lengthSegments = 4;
        
        // Base attachment point
        positions.push(0, 0, 0);
        colors.push(1.0, 1.0, 1.0);
        
        // Create fan shape
        for (let i = 0; i <= lengthSegments; i++) {
            const radius = (i / lengthSegments) * finLength;
            
            for (let j = 0; j <= radialSegments; j++) {
                const t = j / radialSegments;
                const angle = (t - 0.5) * Math.PI * 0.6; // Fan spread
                
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius * 0.8; // Slightly compressed vertically
                const z = radius * 0.2; // Curves outward
                
                positions.push(x, y, z);
                
                // Gradient from base to tip
                const colorValue = 1.0 - i / lengthSegments * 0.15;
                colors.push(colorValue, colorValue, colorValue);
            }
        }

        // Create triangles
        // Connect base to first ring
        for (let j = 0; j < radialSegments; j++) {
            indices.push(0, j + 1, j + 2);
        }
        
        // Connect rings
        for (let i = 0; i < lengthSegments; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const current = 1 + i * (radialSegments + 1) + j;
                const next = current + radialSegments + 1;
                
                indices.push(current, next, current + 1);
                indices.push(current + 1, next, next + 1);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        return geometry;
    }
    
    /**
     * Create anal fin (bottom rear fin)
     */
    private static createAnalFin(length: number, bodyThickness: number): THREE.BufferGeometry {
        const finLength = length * 0.15;
        const finHeight = bodyThickness * 0.35;
        
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(finLength * 0.3, -finHeight * 0.7, finLength * 0.6, -finHeight);
        shape.quadraticCurveTo(finLength * 0.4, -finHeight * 0.5, 0, 0);
        
        const extrudeSettings = {
            depth: bodyThickness * 0.02,
            bevelEnabled: false
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        return geometry;
    }
    
    /**
     * Create pelvic fins (small bottom fins)
     */
    private static createPelvicFin(length: number, bodyThickness: number): THREE.BufferGeometry {
        const finLength = length * 0.12;
        const finWidth = bodyThickness * 0.25;
        
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(finLength * 0.5, -finWidth * 0.8, finLength, -finWidth * 0.6);
        shape.quadraticCurveTo(finLength * 0.6, -finWidth * 0.3, 0, 0);
        
        const extrudeSettings = {
            depth: bodyThickness * 0.015,
            bevelEnabled: false
        };
        
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        return geometry;
    }
    
    /**
     * Create gill detail
     */
    private static createGillDetail(length: number, bodyThickness: number): THREE.BufferGeometry {
        const geometry = new THREE.BoxGeometry(
            length * 0.08,
            bodyThickness * 0.15,
            bodyThickness * 0.6
        );
        
        // Add slight curve to gill cover
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const curve = Math.abs(y) * 0.1;
            positions.setX(i, x - curve);
        }
        
        geometry.computeVertexNormals();
        return geometry;
    }

    /**
     * Merge all meshes in a group into a single geometry AND compute vertex colors
     */
    private static mergeGroup(group: THREE.Group): THREE.BufferGeometry {
        const geometries: { geo: THREE.BufferGeometry; name: string }[] = [];

        group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry) {
                let geometry = child.geometry.clone();

                if (geometry.index) {
                    geometry = geometry.toNonIndexed();
                }

                child.updateMatrix();
                geometry.applyMatrix4(child.matrix);

                geometries.push({ geo: geometry, name: child.name });
            }
        });

        const mergedGeometry = new THREE.BufferGeometry();

        if (geometries.length === 0) {
            return mergedGeometry;
        }

        let totalVertices = 0;
        for (const item of geometries) {
            totalVertices += item.geo.getAttribute('position').count;
        }

        const mergedPositions = new Float32Array(totalVertices * 3);
        const mergedColors = new Float32Array(totalVertices * 3);

        let offset = 0;

        for (const item of geometries) {
            const positions = item.geo.getAttribute('position');
            const existingColors = item.geo.getAttribute('color'); // Check if geometry already has colors
            const isEyeWhite = item.name === 'eye_white';
            const isEyePupil = item.name === 'eye_pupil';

            if (positions) {
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = positions.getZ(i);

                    mergedPositions[offset * 3] = x;
                    mergedPositions[offset * 3 + 1] = y;
                    mergedPositions[offset * 3 + 2] = z;

                    // Use existing vertex colors if available, otherwise apply counter-shading
                    if (existingColors) {
                        // Use pre-computed colors from geometry
                        mergedColors[offset * 3] = existingColors.getX(i);
                        mergedColors[offset * 3 + 1] = existingColors.getY(i);
                        mergedColors[offset * 3 + 2] = existingColors.getZ(i);
                    } else if (isEyeWhite) {
                        // White/silver eye
                        mergedColors[offset * 3] = 1.5; // Slightly brighter than body
                        mergedColors[offset * 3 + 1] = 1.5;
                        mergedColors[offset * 3 + 2] = 1.5;
                    } else if (isEyePupil) {
                        // Black pupil
                        mergedColors[offset * 3] = 0.05;
                        mergedColors[offset * 3 + 1] = 0.05;
                        mergedColors[offset * 3 + 2] = 0.05;
                    } else {
                        // Counter-shading for parts without pre-computed colors
                        let shade = 1.0;
                        if (y > 0) {
                            shade = 1.0 - Math.min(y * 2.0, 0.6); // Darkens up to 0.4
                        } else {
                            shade = 1.0 + Math.min(Math.abs(y) * 2.0, 0.5); // Lightens up to 1.5
                        }

                        mergedColors[offset * 3] = shade;
                        mergedColors[offset * 3 + 1] = shade;
                        mergedColors[offset * 3 + 2] = shade;
                    }

                    offset++;
                }
            }
        }

        mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
        mergedGeometry.setAttribute('color', new THREE.BufferAttribute(mergedColors, 3));

        return mergedGeometry;
    }
}
