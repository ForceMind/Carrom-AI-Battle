import './style.css'
import { Game } from './src/core/Game'

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    
    document.getElementById('reset-btn').onclick = () => {
        game.reset();
    };
});
