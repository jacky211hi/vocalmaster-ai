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
  {
    trackName: "像风一样 (Live)",
    artistName: "单依纯",
    plainLyrics: "像風一樣 你靠近雲都下降",
    syncedLyrics: "[00:46.89] 像風一樣 你靠近雲都下降",
  },
  {
    trackName: "像風一樣",
    artistName: "薛之謙",
    plainLyrics: "像風一樣 你靠近雲都下降",
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

const tradCover = pickLyricHit("像風一樣", "單依純", hits);
assert(
  tradCover?.artistName === "单依纯",
  "trad input matches simplified cover metadata"
);
assert(
  Boolean(tradCover?.syncedLyrics?.includes("像風一樣")),
  "cover lyrics body kept"
);

const simpSame = pickLyricHit("像风一样", "单依纯", hits);
assert(simpSame?.artistName === "单依纯", "simplified input still matches");

console.log("lyrics pick ok");
