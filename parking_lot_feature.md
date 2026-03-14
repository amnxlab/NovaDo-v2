# 💡 Parking Lot Feature

A quick-capture widget for dumping random thoughts mid-task without losing focus.

## What It Did

- **Floating amber 💡 button** (`fixed bottom-right`) — toggled the panel open/closed. Also openable via keyboard shortcut `i`.
- **Panel** — appeared bottom-right, showed a text input and a list of captured thoughts.
- **Quick capture** — type a thought, press Enter or `+` to save it instantly.
- **Promote to Task** — any captured item could be moved into the main Task list with one click (📋 button).
- **Discard** — remove an item from the lot (× button).
- **Badge count** — a red badge on the 💡 button showed how many unresolved thoughts were parked.
- **Persistence** — items were stored via `zustand/persist` in a local file (`parking-lot-storage`).

## Files Removed

| File | Role |
|---|---|
| `src/components/ParkingLot.jsx` | UI component (panel + trigger button) |
| `src/store/parkingLotStore.js` | Zustand store (add, remove, promote, persist) |

## Layout.jsx Changes Removed

- `import ParkingLot` statement
- `parkingLotOpen` state
- `setParkingLotOpen` keyboard shortcut (`i` key)
- `<ParkingLot>` render + floating `<motion.button>` trigger
