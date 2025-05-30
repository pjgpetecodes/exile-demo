import { Astronaut } from './types/index.js';

export function handleControls(astronaut: Astronaut) {
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'q':
                if (astronaut.isLanded) astronaut.position.x -= 5;
                break;
            case 'w':
                if (astronaut.isLanded) astronaut.position.x += 5;
                break;
            case 'p':
                if (astronaut.isLanded) {
                    astronaut.isFlying = true;
                    astronaut.isLanded = false;
                    astronaut.velocity.y = -5;
                }
                break;
            case 'l':
                if (!astronaut.isLanded) astronaut.position.y += 5;
                break;
            case 'ArrowDown':
                // Do nothing if landed
                break;
        }
    });
}