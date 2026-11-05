import { useState } from "react";
import { FileWarning, ShieldCheck } from "lucide-react";
import type { DuplicateChoice, DuplicateMatch } from "../lib/duplicates";
import { artistLine } from "../lib/format";
import { trackFromScanned } from "../lib/platform";
import { Dialog } from "./Dialog";

interface DuplicateDialogProps {
  matches: DuplicateMatch[];
  onCancel: () => void;
  onConfirm: (choices: Map<string, DuplicateChoice>) => void;
}

const CHOICE_LABELS: Array<{ value: DuplicateChoice; label: string }> = [
  { value: "existing", label: "保留已有" },
  { value: "incoming", label: "使用新文件" },
  { value: "both", label: "两首均保留" },
];

export function DuplicateDialog({
  matches,
  onCancel,
  onConfirm,
}: DuplicateDialogProps) {
  const [choices, setChoices] = useState<Map<string, DuplicateChoice>>(
    () =>
      new Map(
        matches.map((match) => [match.incoming.id, "existing" as const]),
      ),
  );

  const choose = (id: string, choice: DuplicateChoice) => {
    setChoices((current) => new Map(current).set(id, choice));
  };

  const chooseAll = (choice: DuplicateChoice) => {
    setChoices(
      new Map(matches.map((match) => [match.incoming.id, choice])),
    );
  };

  const counts = { existing: 0, incoming: 0, both: 0 };
  matches.forEach((match) => {
    counts[choices.get(match.incoming.id) ?? "existing"] += 1;
  });

  return (
    <Dialog
      title="发现可能重复的歌曲"
      description="这些歌曲可能已在曲库中。可以保留已有、使用新文件，或两首都保留；本地文件不会被删除。"
      width={640}
      onClose={onCancel}
      footer={
        <>
          <span className="duplicate-count">
            保留 {counts.existing} · 更新 {counts.incoming} · 新增 {counts.both}
          </span>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onConfirm(choices)}
          >
            继续导入
          </button>
        </>
      }
    >
      <div className="duplicate-bulk">
        <span>批量设置</span>
        <button type="button" className="text-button" onClick={() => chooseAll("existing")}>
          全部保留已有
        </button>
        <button type="button" className="text-button" onClick={() => chooseAll("incoming")}>
          全部使用新文件
        </button>
        <button type="button" className="text-button" onClick={() => chooseAll("both")}>
          全部保留两首
        </button>
      </div>
      <div className="duplicate-list">
        {matches.map((match) => {
          const choice = choices.get(match.incoming.id) ?? "existing";
          const parsed = trackFromScanned(match.incoming);
          const sameTitleDifferentArtist = match.sameTitle && !match.sharedArtist;
          return (
            <div className="duplicate-row" key={match.incoming.id}>
              <div className="duplicate-pair">
                <div
                  className={`duplicate-side ${choice !== "incoming" ? "is-kept" : ""}`}
                >
                  <span className="duplicate-label">
                    <ShieldCheck size={13} />
                    曲库中
                  </span>
                  <strong>{match.existing.title}</strong>
                  <small>{artistLine(match.existing.artists)}</small>
                </div>
                <span className="duplicate-arrow">→</span>
                <div
                  className={`duplicate-side ${choice !== "existing" ? "is-kept" : ""}`}
                >
                  <span className="duplicate-label">
                    <FileWarning size={13} />
                    新导入
                  </span>
                  <strong>{parsed.title}</strong>
                  <small>
                    {artistLine(parsed.artists)} · 相似度{" "}
                    {Math.round(match.score * 100)}%
                  </small>
                </div>
              </div>
              <div className="duplicate-actions">
                {sameTitleDifferentArtist && (
                  <span className="duplicate-note">
                    同名但歌手不同，可两首均保留
                  </span>
                )}
                <div
                  className="duplicate-choices"
                  role="group"
                  aria-label={`处理 ${parsed.title}`}
                >
                  {CHOICE_LABELS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`duplicate-choice ${
                        choice === option.value ? "is-selected" : ""
                      }`}
                      aria-pressed={choice === option.value}
                      onClick={() => choose(match.incoming.id, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
