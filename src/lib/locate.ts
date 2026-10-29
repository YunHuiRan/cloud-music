import { toast } from "./toast";

let timer: number | undefined;

export function locateCurrent(trackId: string | null): void {
  if (!trackId) {
    toast("还没有正在播放的歌曲");
    return;
  }
  const row = Array.from(
    document.querySelectorAll<HTMLElement>("[data-track-id]"),
  ).find((element) => element.dataset.trackId === trackId);
  if (!row) {
    const event = new CustomEvent<string>("shiyin:locate-track", {
      detail: trackId,
      cancelable: true,
    });
    if (window.dispatchEvent(event)) {
      toast("当前歌曲不在这个列表中");
    }
    return;
  }
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.remove("is-locating");
  void row.offsetWidth;
  row.classList.add("is-locating");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => row.classList.remove("is-locating"), 1800);
}
