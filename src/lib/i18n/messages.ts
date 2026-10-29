import type { Locale } from "./config";

export type MessageKey = keyof typeof messages.hk;

const messages = {
  hk: {
    "brand.tagline": "AI 聲樂教練",
    "nav.practice": "練習室",
    "nav.sing": "唱歌",
    "nav.friends": "朋友",
    "nav.leaderboard": "排行榜",
    "nav.profile": "個人檔案",
    "nav.logout": "登出",
    "nav.locale": "語言",

    "leaderboard.title": "排行榜",
    "leaderboard.descBefore": "全球、朋友圈同個人成績。見到",
    "leaderboard.descAfter":
      "代表該榜可以收聽；全球同朋友分享係分開設定，預設唔公開音檔。",
    "leaderboard.tab.global": "全球",
    "leaderboard.tab.friends": "朋友",
    "leaderboard.tab.personal": "個人最佳",
    "leaderboard.empty.personal": "尚未有個人成績，去錄一首吧！",
    "leaderboard.empty.friends.nofriends":
      "尚未有朋友。先去朋友頁加好友，再返嚟睇朋友排行。",
    "leaderboard.empty.friends.none": "朋友圈暫時未有錄音成績。",
    "leaderboard.empty.global": "全球榜暫時沒有資料。",
    "leaderboard.goSing": "去唱歌 →",
    "leaderboard.goFriends": "去加朋友 →",
    "leaderboard.shared": "已分享音樂檔",
    "leaderboard.unknownArtist": "未知歌手",

    "share.noAudio": "未保存音檔（非個人 Top 10），無法分享音樂到排行榜。",
    "share.friends.title": "分享音樂檔到朋友排行榜",
    "share.friends.desc":
      "開啟後，已接受嘅朋友喺朋友榜／結果頁可以收聽。其他人仍然聽唔到。",
    "share.global.title": "分享音樂檔到全球排行榜",
    "share.global.desc":
      "開啟後，任何登入用戶喺全球榜／結果頁可以收聽你呢次錄音。",

    "result.back.leaderboard": "排行榜",
    "result.back.practice": "練習室",
    "result.back.friendPractice": "{name} 練習室",
    "result.singer": "演唱者",
    "result.you": "你",
    "result.anonymous": "匿名",
    "result.singAgain": "再唱一首",
    "result.noShare": "歌手未開放分享此錄音音樂檔；分數同 AI 報告仍可睇。",
    "result.noAudioKept":
      "此錄音未進入個人 Top 10，音檔未保存；分數與 AI 分析報告仍然保留。",
    "result.analyzing": "AI 分析進行中，請稍後刷新頁面。",
    "result.radar": "六維雷達圖",
    "result.scores": "分項評分",
    "result.report": "AI 診斷報告",
    "result.advice": "改善建議",
    "result.total": "Total Score",

    "sing.title": "準備練歌",
    "sing.desc": "跟譜練習練完即棄。自由錄音先會交俾 Gemini 出六維報告同排行榜。",
    "sing.mode.exercise": "跟譜練習",
    "sing.mode.free": "自由錄音",
    "sing.card.exercise": "跟譜計分",
    "sing.card.free": "提交錄音",
    "sing.desc.exercise":
      "戴上耳機跟住提示音唱。練完即棄，唔會計入報告或排行榜。",
    "sing.desc.free": "建議錄 15–60 秒副歌或高音段。整首歌可以，但分析會較慢。",

    "friends.title": "朋友",
    "friends.desc":
      "立刻挑戰朋友的歌喉，在排行榜一決高下！撳朋友可睇佢練習室。",
    "friends.viewPractice": "睇練習室",
    "friends.practiceRoom": "朋友練習室",
    "friends.practiceHint": "睇吓朋友嘅分數、聲線畫像同最近錄音。",
    "friends.back": "返回朋友",
    "friends.noProfile": "呢位朋友暫時未有完成嘅 AI 分析，未有聲線畫像。",
    "friends.sharedListen": "已分享音樂檔，可收聽",

    "dashboard.practice": "練習室",
    "dashboard.noProfile":
      "完成至少一次 AI 分析後，呢度會顯示你嘅音域風格、強弱項同練習建議。",

    "advice.listen": "聽示範",
    "advice.stop": "停止",
    "advice.synthNote": "示範係合成男聲，用嚟聽音高同節奏，唔係真人錄音。",
    "advice.empty": "暫無具體練習建議。",

    "comments.placeholder": "寫下你嘅感想或鼓勵…",
    "comments.empty": "尚未有留言，做第一個留言嘅人啦。",
    "comments.send": "發送",
    "comments.title": "留言",
    "comments.deleteConfirm": "確定刪除呢條留言？",

    "analysis.keepOpen": "通常 20–60 秒。請唔好關閉頁面。",
    "analysis.retryHint":
      "分析已觸發過。如果未完成，請撳下面重試（注意免費額度有限）。",

    "auth.welcomeBack": "歡迎回來",
    "auth.createAccount": "建立帳戶",
    "auth.loginDesc": "登入以繼續你的練唱紀錄與 AI 分析",
    "auth.signupDesc": "註冊後即可錄音、評分與追蹤進度",
    "auth.forgotTitle": "重設密碼",
    "auth.forgotDesc": "輸入註冊電郵，我哋會寄重設連結俾你。",
    "auth.username": "用戶名稱",
    "auth.email": "電郵",
    "auth.password": "密碼",
    "auth.passwordHint": "至少 6 位",
    "auth.login": "登入",
    "auth.signup": "註冊",
    "auth.forgot": "忘記密碼？",
    "auth.sendReset": "寄出重設電郵",
    "auth.backToLogin": "返回登入",
    "auth.noAccount": "還沒有帳戶？",
    "auth.hasAccount": "已經有帳戶？",
    "auth.processing": "處理中…",
    "auth.resetSent": "如果呢個電郵有註冊，你會收到重設密碼連結。請檢查信箱（同垃圾郵件）。",
    "auth.signupOk": "註冊成功！若啟用電郵驗證，請先到信箱確認，否則可直接登入。",
    "auth.failed": "認證失敗",
    "auth.resetPageTitle": "設定新密碼",
    "auth.resetPageDesc": "請輸入新密碼以完成重設。",
    "auth.newPassword": "新密碼",
    "auth.confirmPassword": "確認新密碼",
    "auth.savePassword": "儲存新密碼",
    "auth.passwordMismatch": "兩次輸入嘅密碼不一致",
    "auth.passwordTooShort": "密碼至少要 6 位",
    "auth.resetOk": "密碼已更新，而家可以用新密碼登入。",
    "auth.resetNeedLink": "請先用電郵入面嘅重設連結開啟呢頁。",
    "auth.goLogin": "去登入",

    "common.unknownArtist": "未知歌手",
  },
  tw: {
    "brand.tagline": "AI 聲樂教練",
    "nav.practice": "練習室",
    "nav.sing": "唱歌",
    "nav.friends": "朋友",
    "nav.leaderboard": "排行榜",
    "nav.profile": "個人檔案",
    "nav.logout": "登出",
    "nav.locale": "語言",

    "leaderboard.title": "排行榜",
    "leaderboard.descBefore": "全球、朋友圈與個人成績。看到",
    "leaderboard.descAfter":
      "代表該榜可收聽；全球與朋友分享為分開設定，預設不公開音檔。",
    "leaderboard.tab.global": "全球",
    "leaderboard.tab.friends": "朋友",
    "leaderboard.tab.personal": "個人最佳",
    "leaderboard.empty.personal": "尚無個人成績，去錄一首吧！",
    "leaderboard.empty.friends.nofriends":
      "尚無朋友。請先到朋友頁加入好友，再回來查看朋友排行。",
    "leaderboard.empty.friends.none": "朋友圈暫時沒有錄音成績。",
    "leaderboard.empty.global": "全球榜暫時沒有資料。",
    "leaderboard.goSing": "去唱歌 →",
    "leaderboard.goFriends": "去加朋友 →",
    "leaderboard.shared": "已分享音樂檔",
    "leaderboard.unknownArtist": "未知歌手",

    "share.noAudio": "未保存音檔（非個人 Top 10），無法分享音樂到排行榜。",
    "share.friends.title": "分享音樂檔到朋友排行榜",
    "share.friends.desc":
      "開啟後，已接受的朋友可在朋友榜／結果頁收聽。其他人仍無法收聽。",
    "share.global.title": "分享音樂檔到全球排行榜",
    "share.global.desc":
      "開啟後，任何登入用戶可在全球榜／結果頁收聽你這次錄音。",

    "result.back.leaderboard": "排行榜",
    "result.back.practice": "練習室",
    "result.back.friendPractice": "{name} 練習室",
    "result.singer": "演唱者",
    "result.you": "你",
    "result.anonymous": "匿名",
    "result.singAgain": "再唱一首",
    "result.noShare": "演唱者未開放分享此錄音；分數與 AI 報告仍可查看。",
    "result.noAudioKept":
      "此錄音未進入個人 Top 10，音檔未保存；分數與 AI 分析報告仍然保留。",
    "result.analyzing": "AI 分析進行中，請稍後重新整理頁面。",
    "result.radar": "六維雷達圖",
    "result.scores": "分項評分",
    "result.report": "AI 診斷報告",
    "result.advice": "改善建議",
    "result.total": "Total Score",

    "sing.title": "準備練歌",
    "sing.desc":
      "跟譜練習結束後不會保存。自由錄音會交給 Gemini 產出六維報告並進入排行榜。",
    "sing.mode.exercise": "跟譜練習",
    "sing.mode.free": "自由錄音",
    "sing.card.exercise": "跟譜計分",
    "sing.card.free": "提交錄音",
    "sing.desc.exercise":
      "請戴耳機跟著提示音唱。練習結束即捨棄，不會計入報告或排行榜。",
    "sing.desc.free": "建議錄 15–60 秒副歌或高音段。整首歌可以，但分析會較慢。",

    "friends.title": "朋友",
    "friends.desc":
      "立刻挑戰朋友的歌喉，在排行榜一決高下！點選朋友可查看練習室。",
    "friends.viewPractice": "查看練習室",
    "friends.practiceRoom": "朋友練習室",
    "friends.practiceHint": "查看朋友的分數、聲線畫像與最近錄音。",
    "friends.back": "返回朋友",
    "friends.noProfile": "這位朋友尚無完成的 AI 分析，暫無聲線畫像。",
    "friends.sharedListen": "已分享音樂檔，可收聽",

    "dashboard.practice": "練習室",
    "dashboard.noProfile":
      "完成至少一次 AI 分析後，這裡會顯示你的音域風格、強弱項與練習建議。",

    "advice.listen": "聽示範",
    "advice.stop": "停止",
    "advice.synthNote": "示範為合成男聲，用來聽音高與節奏，不是真人錄音。",
    "advice.empty": "暫無具體練習建議。",

    "comments.placeholder": "寫下你的感想或鼓勵…",
    "comments.empty": "尚無留言，來當第一個留言的人吧。",
    "comments.send": "發送",
    "comments.title": "留言",
    "comments.deleteConfirm": "確定刪除這則留言？",

    "analysis.keepOpen": "通常 20–60 秒。請不要關閉頁面。",
    "analysis.retryHint":
      "分析已觸發過。若尚未完成，請點下方重試（注意免費額度有限）。",

    "auth.welcomeBack": "歡迎回來",
    "auth.createAccount": "建立帳戶",
    "auth.loginDesc": "登入以繼續你的練唱紀錄與 AI 分析",
    "auth.signupDesc": "註冊後即可錄音、評分與追蹤進度",
    "auth.forgotTitle": "重設密碼",
    "auth.forgotDesc": "輸入註冊用的電子郵件，我們會寄送重設連結。",
    "auth.username": "用戶名稱",
    "auth.email": "電子郵件",
    "auth.password": "密碼",
    "auth.passwordHint": "至少 6 位",
    "auth.login": "登入",
    "auth.signup": "註冊",
    "auth.forgot": "忘記密碼？",
    "auth.sendReset": "寄出重設郵件",
    "auth.backToLogin": "返回登入",
    "auth.noAccount": "還沒有帳戶？",
    "auth.hasAccount": "已經有帳戶？",
    "auth.processing": "處理中…",
    "auth.resetSent": "如果這個電子郵件有註冊，你會收到重設密碼連結。請檢查收件匣（與垃圾郵件）。",
    "auth.signupOk": "註冊成功！若啟用電子郵件驗證，請先到信箱確認，否則可直接登入。",
    "auth.failed": "認證失敗",
    "auth.resetPageTitle": "設定新密碼",
    "auth.resetPageDesc": "請輸入新密碼以完成重設。",
    "auth.newPassword": "新密碼",
    "auth.confirmPassword": "確認新密碼",
    "auth.savePassword": "儲存新密碼",
    "auth.passwordMismatch": "兩次輸入的密碼不一致",
    "auth.passwordTooShort": "密碼至少要 6 位",
    "auth.resetOk": "密碼已更新，現在可以用新密碼登入。",
    "auth.resetNeedLink": "請先使用郵件中的重設連結開啟此頁。",
    "auth.goLogin": "去登入",

    "common.unknownArtist": "未知歌手",
  },
  en: {
    "brand.tagline": "AI Vocal Coach",
    "nav.practice": "Practice",
    "nav.sing": "Sing",
    "nav.friends": "Friends",
    "nav.leaderboard": "Leaderboard",
    "nav.profile": "Profile",
    "nav.logout": "Log out",
    "nav.locale": "Language",

    "leaderboard.title": "Leaderboard",
    "leaderboard.descBefore": "Global, friends, and personal scores.",
    "leaderboard.descAfter":
      "means audio is shared on that board. Global and friends sharing are separate; audio is private by default.",
    "leaderboard.tab.global": "Global",
    "leaderboard.tab.friends": "Friends",
    "leaderboard.tab.personal": "Personal Best",
    "leaderboard.empty.personal": "No personal scores yet — record a song!",
    "leaderboard.empty.friends.nofriends":
      "No friends yet. Add friends first, then check the friends board.",
    "leaderboard.empty.friends.none": "No recordings in your friends circle yet.",
    "leaderboard.empty.global": "No global rankings yet.",
    "leaderboard.goSing": "Go sing →",
    "leaderboard.goFriends": "Add friends →",
    "leaderboard.shared": "Audio shared",
    "leaderboard.unknownArtist": "Unknown artist",

    "share.noAudio":
      "No saved audio (not in personal Top 10), so sharing is unavailable.",
    "share.friends.title": "Share audio on friends leaderboard",
    "share.friends.desc":
      "Accepted friends can listen on the friends board / result page. Others still cannot.",
    "share.global.title": "Share audio on global leaderboard",
    "share.global.desc":
      "Any signed-in user can listen on the global board / result page.",

    "result.back.leaderboard": "Leaderboard",
    "result.back.practice": "Practice room",
    "result.back.friendPractice": "{name}'s practice room",
    "result.singer": "Performer",
    "result.you": "You",
    "result.anonymous": "Anonymous",
    "result.singAgain": "Sing again",
    "result.noShare":
      "The performer has not shared this audio; scores and the AI report are still visible.",
    "result.noAudioKept":
      "This take was not in personal Top 10, so audio was not kept. Scores and the AI report remain.",
    "result.analyzing": "AI analysis in progress — refresh shortly.",
    "result.radar": "Six-dimension radar",
    "result.scores": "Category scores",
    "result.report": "AI diagnostic report",
    "result.advice": "Practice tips",
    "result.total": "Total Score",

    "sing.title": "Ready to sing",
    "sing.desc":
      "Follow-along drills are discarded after practice. Free recordings go to Gemini for a six-dimension report and the leaderboard.",
    "sing.mode.exercise": "Follow-along",
    "sing.mode.free": "Free recording",
    "sing.card.exercise": "Pitch drill scoring",
    "sing.card.free": "Submit recording",
    "sing.desc.exercise":
      "Wear headphones and sing with the guide tones. Discarded after practice — not saved to reports or leaderboards.",
    "sing.desc.free":
      "Aim for 15–60 seconds of a chorus or high part. Full songs work but analysis is slower.",

    "friends.title": "Friends",
    "friends.desc":
      "Challenge your friends and compete on the leaderboard. Tap a friend to open their practice room.",
    "friends.viewPractice": "Practice room",
    "friends.practiceRoom": "Friend practice room",
    "friends.practiceHint":
      "See their scores, vocal profile, and recent recordings.",
    "friends.back": "Back to friends",
    "friends.noProfile":
      "This friend has no completed AI analyses yet, so there is no vocal profile.",
    "friends.sharedListen": "Audio shared — can listen",

    "dashboard.practice": "Practice room",
    "dashboard.noProfile":
      "After at least one AI analysis, your range style, strengths, and practice tips appear here.",

    "advice.listen": "Hear demo",
    "advice.stop": "Stop",
    "advice.synthNote":
      "Demos are a synthesized male voice for pitch and timing — not a real recording.",
    "advice.empty": "No specific practice tips yet.",

    "comments.placeholder": "Share a thought or encouragement…",
    "comments.empty": "No comments yet — be the first!",
    "comments.send": "Send",
    "comments.title": "Comments",
    "comments.deleteConfirm": "Delete this comment?",

    "analysis.keepOpen": "Usually 20–60 seconds. Please keep this page open.",
    "analysis.retryHint":
      "Analysis was already started. If it is stuck, retry below (free quota is limited).",

    "auth.welcomeBack": "Welcome back",
    "auth.createAccount": "Create account",
    "auth.loginDesc": "Sign in to continue your practice history and AI analysis",
    "auth.signupDesc": "Sign up to record, score, and track progress",
    "auth.forgotTitle": "Reset password",
    "auth.forgotDesc": "Enter your signup email and we will send a reset link.",
    "auth.username": "Username",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.passwordHint": "At least 6 characters",
    "auth.login": "Log in",
    "auth.signup": "Sign up",
    "auth.forgot": "Forgot password?",
    "auth.sendReset": "Send reset email",
    "auth.backToLogin": "Back to login",
    "auth.noAccount": "No account yet?",
    "auth.hasAccount": "Already have an account?",
    "auth.processing": "Working…",
    "auth.resetSent":
      "If that email is registered, you will get a reset link. Check inbox and spam.",
    "auth.signupOk":
      "Sign-up successful! If email verification is on, confirm your inbox first; otherwise you can log in.",
    "auth.failed": "Authentication failed",
    "auth.resetPageTitle": "Set a new password",
    "auth.resetPageDesc": "Enter a new password to finish resetting.",
    "auth.newPassword": "New password",
    "auth.confirmPassword": "Confirm new password",
    "auth.savePassword": "Save new password",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.passwordTooShort": "Password must be at least 6 characters",
    "auth.resetOk": "Password updated. You can log in with the new password.",
    "auth.resetNeedLink": "Open this page from the reset link in your email first.",
    "auth.goLogin": "Go to login",

    "common.unknownArtist": "Unknown artist",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type Messages = (typeof messages)[Locale];

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const table = messages[locale] ?? messages.hk;
  let text: string = table[key] ?? messages.hk[key] ?? String(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export { messages };
