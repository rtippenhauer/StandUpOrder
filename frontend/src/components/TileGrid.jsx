import Tile from './Tile.jsx'

export default function TileGrid({ tiles, timerMinutes, timerEnabled, onRemove }) {
  return (
    <div
      id="tile-grid"
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
    >
      {tiles.map((tile) => (
        <Tile
          key={tile.name}
          tile={tile}
          timerMinutes={timerMinutes}
          timerEnabled={timerEnabled}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
