import { OrderGlyph, ShuffleGlyph } from "./TransportGlyphs";

type Mode = "shuffle" | "order";

interface ModeButtonsProps {
  activeMode: Mode | null;
  onSelect: (mode: Mode) => void;
}

export function ModeButtons({ activeMode, onSelect }: ModeButtonsProps) {
  return (
    <div className="mode-buttons" role="group" aria-label="播放模式">
      <button
        type="button"
        className={`mode-button ${activeMode === "shuffle" ? "is-active" : ""}`}
        onClick={() => onSelect("shuffle")}
        title="随机播放当前列表"
        aria-label="随机播放当前列表"
        aria-pressed={activeMode === "shuffle"}
      >
        <ShuffleGlyph size={18} />
        <span>随机</span>
      </button>
      <button
        type="button"
        className={`mode-button ${activeMode === "order" ? "is-active" : ""}`}
        onClick={() => onSelect("order")}
        title="顺序播放当前列表"
        aria-label="顺序播放当前列表"
        aria-pressed={activeMode === "order"}
      >
        <OrderGlyph size={18} />
        <span>顺序</span>
      </button>
    </div>
  );
}
