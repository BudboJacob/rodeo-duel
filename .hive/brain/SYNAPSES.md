# SYNAPSES - Dependencies & Relationships

## Task Dependencies

```
T-001: Project Setup
  └── T-002: Game Architecture
       ├── T-003: Asset Creation
       ├── T-004: Core Mechanics
       │    └── T-005: Touch Controls
       │         └── T-006: Game Logic
       └── T-007: UI Polish
            └── T-008: Deploy
```

## Component Relationships

```
index.html
  └── styles.css (UI styling)
  └── game.js (main game logic)
       ├── Player class (Father/Son)
       ├── Lasso class (projectile)
       ├── Target class (what to catch)
       ├── GameState (rounds, scores)
       └── InputHandler (touch/mouse)
```

## File Structure
```
rodeo-duel/
├── index.html
├── styles.css
├── game.js
├── assets/ (if needed)
└── .hive/brain/
    ├── CORTEX.md
    ├── REASONING.md
    └── SYNAPSES.md
```
