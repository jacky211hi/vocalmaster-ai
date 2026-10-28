import { pickLyricHit } from "./lyrics";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const hits = [
  {
    trackName: "富士山下",
    artistName: "陳奕迅",
    plainLyrics: "迎著風",
    syncedLyrics: "[00:18.00] 迎著風",
  },
  {
    trackName: "富士山下 (Live)",
    artistName: "陳奕迅",
    plainLyrics: "其他",
    syncedLyrics: null,
  },
  {
    trackName: "十年",
    artistName: "陳奕迅",
    plainLyrics: "如果那兩個字沒有顫抖",
    syncedLyrics: null,
  },
];

const exact = pickLyricHit("富士山下", "陳奕迅", hits);
assert(exact?.syncedLyrics?.includes("迎著風"), "exact synced match");

const live = pickLyricHit("富士山下 (Live)", "陳奕迅", hits);
assert(live?.syncedLyrics?.includes("迎著風"), "live title still finds studio lyrics");

const wrongArtist = pickLyricHit("十年", "周杰倫", hits);
assert(wrongArtist == null, "reject different artist");

const missing = pickLyricHit("沒有這首歌", "陳奕迅", hits);
assert(missing == null, "missing song");

console.log("lyrics pick ok");
