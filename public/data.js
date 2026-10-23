window.FLARE_DATA = {
  eventDate: "2026-12-05T00:00:00+05:00",
  ballotDeadline: "2026-11-22T00:00:00+05:00",
  participants: [
    "Akirakume", "Awal", "Dony_zq", "Eozik", "Flourin", "Izumrudik",
    "Maronnix", "Nodben", "Qusti", "Rezo1n", "Balabol", "Cloury",
    "Denis_185", "Fines Stark"
  ],
  nominations: [
    {
      id: "flare-king",
      title: "FLARE KING",
      category: "main",
      kind: "participant",
      visual: "crown",
      description: "Участник, который стал главной легендой сервера и настоящим королём этого года.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti", "Rezo1n"].map((name) => ({ id: `flare-king-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "multigaming",
      title: "MULTIGAMING ГОДА",
      category: "main",
      kind: "participant",
      visual: "arcade",
      description: "Участник, который жаждет сыграть во все новинки года и уже успел перепробовать их больше, чем кто-либо другой.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Dony_zq", "Izumrudik", "Maronnix"].map((name) => ({ id: `multigaming-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "cs-player",
      title: "ЛУЧШИЙ CS-УЧАСТНИК",
      category: "main",
      kind: "participant",
      visual: "crosshair",
      description: "Участник, чья игра в CS этого года запомнилась больше всего — будь то один яркий момент или вся игра целиком.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Balabol", "Cloury", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti", "Rezo1n"].map((name) => ({ id: `cs-player-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "rematch-player",
      title: "ЛУЧШИЙ REMATCH-УЧАСТНИК",
      category: "main",
      kind: "participant",
      visual: "stadium",
      description: "Участник, который в REMATCH обводит так, будто поле принадлежит только ему.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Dony_zq", "Eozik", "Maronnix", "Nodben", "Rezo1n"].map((name) => ({ id: `rematch-player-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "meme-person",
      title: "ЧЕЛОВЕК-МЕМ ГОДА",
      category: "main",
      kind: "participant",
      visual: "meme",
      description: "Участник, который любой разговор превращает в коллекцию шуток, а каждое его сообщение мгновенно становится мемом.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Balabol", "Cloury", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Qusti"].map((name) => ({ id: `meme-person-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "breakthrough",
      title: "ПРОРЫВ ГОДА",
      category: "main",
      kind: "participant",
      visual: "rise",
      description: "Участник, который начинал год как типичный участник сервера, а теперь общается со всеми и присутствует везде.",
      selfVoteAllowed: false,
      nominees: ["Awal", "Balabol", "Izumrudik"].map((name) => ({ id: `breakthrough-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "vibe",
      title: "ВАЙБ ГОДА",
      category: "main",
      kind: "participant",
      visual: "vibe",
      description: "Участник, от которого веет чем-то хорошим и рядом с которым чаще всего либо смешно, либо приятно.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Balabol", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Qusti", "Rezo1n"].map((name) => ({ id: `vibe-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "kidalovo",
      title: "КИДАЛОВО ГОДА",
      category: "main",
      kind: "mixed",
      visual: "vanish",
      description: "Участник, который обещал быть рядом, а по итогу пропал на долгое время. Коллективный вариант — отдельный номинант.",
      selfVoteAllowed: true,
      nominees: [
        { id: "kidalovo-nodben", label: "Nodben", type: "participant", personNickname: "Nodben" },
        { id: "kidalovo-qusti", label: "Qusti", type: "participant", personNickname: "Qusti" },
        { id: "kidalovo-akirakume", label: "Akirakume", type: "participant", personNickname: "Akirakume" },
        { id: "kidalovo-group", label: "Akirakume, Dony_zq и Nodben", type: "image", cover: "vanish", coverTitle: "ТРОЙНОЙ КАМБЭК", personNickname: null }
      ]
    },
    {
      id: "game-of-year",
      title: "ИГРА ГОДА",
      category: "main",
      kind: "image",
      visual: "game",
      description: "Главный хит этого года, в который хотелось играть снова и снова.",
      selfVoteAllowed: true,
      nominees: [
        { id: "game-cs2", label: "Counter-Strike 2", type: "image", cover: "cs", coverTitle: "CS2" },
        { id: "game-mechcha", label: "MECCHA CHAMELEON", type: "image", cover: "mech", coverTitle: "MECCHA" },
        { id: "game-minecraft", label: "Minecraft", type: "image", cover: "minecraft", coverTitle: "MINECRAFT" },
        { id: "game-rematch", label: "REMATCH", type: "image", cover: "rematch", coverTitle: "REMATCH" }
      ]
    },
    {
      id: "conflict",
      title: "КОНФЛИКТ ГОДА",
      category: "main",
      kind: "image",
      visual: "conflict",
      description: "Самое жаркое противостояние года — будь то разовая вспышка или постоянная перепалка.",
      selfVoteAllowed: true,
      nominees: [
        { id: "conflict-akira-maronnix", label: "Akirakume, Dony_zq, Nodben vs Maronnix", type: "image", cover: "conflict-orange", coverTitle: "СТОРОНА A / СТОРОНА B" },
        { id: "conflict-eozik-denis", label: "Eozik, Flourin, Maronnix vs Denis_185, Fines Stark", type: "image", cover: "conflict-violet", coverTitle: "СТОЛКНОВЕНИЕ" },
        { id: "conflict-flourin-qusti", label: "Flourin vs Qusti", type: "image", cover: "conflict-red", coverTitle: "ОДИН НА ОДИН" }
      ]
    },
    {
      id: "clip-of-year",
      title: "КЛИП ГОДА",
      category: "main",
      kind: "video",
      visual: "film",
      description: "То самое видео, которое пересматривают снова и снова.",
      selfVoteAllowed: true,
      nominees: Array.from({ length: 6 }, (_, index) => ({
        id: `clip-${String(index + 1).padStart(2, "0")}`,
        label: `Клип №${String(index + 1).padStart(2, "0")}`,
        type: "video",
        cover: `clip-${index + 1}`,
        coverTitle: `FLARE / CLIP 0${index + 1}`,
        videoUrl: ""
      }))
    },
    {
      id: "event-of-year",
      title: "СОБЫТИЕ ГОДА",
      category: "main",
      kind: "video",
      visual: "moment",
      description: "То самое событие, которое оставило след в жизни сервера в этом году — будь то важный момент или шутка, ставшая частью общих воспоминаний.",
      selfVoteAllowed: true,
      nominees: [
        { id: "event-akirakume-rights", label: "Akirakume получил права", type: "video", cover: "event-rights", coverTitle: "НОВАЯ ГЛАВА", videoUrl: "" },
        { id: "event-minecraft-survival", label: "Выживание в Minecraft", type: "video", cover: "event-minecraft", coverTitle: "ВЫЖИВАНИЕ", videoUrl: "" },
        { id: "event-left-server", label: "Ливнули с сервера", type: "video", cover: "event-escape", coverTitle: "ПОСЛЕДНИЙ ВЫХОД", videoUrl: "" },
        { id: "event-njdc", label: "NJDC-2026", type: "video", cover: "event-njdc", coverTitle: "NJDC / 2026", videoUrl: "" }
      ]
    },
    {
      id: "style",
      title: "СТИЛЬ ГОДА",
      category: "extra",
      kind: "participant",
      visual: "style",
      description: "Участник, который лучше всех умеет оформить себя, чтобы на него хотелось смотреть.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti"].map((name) => ({ id: `style-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "aura",
      title: "АУРА ГОДА",
      category: "extra",
      kind: "participant",
      visual: "aura",
      description: "Участник, который своим поведением и стилем жёстко фармит ауру на сервере.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Balabol", "Cloury", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti", "Rezo1n"].map((name) => ({ id: `aura-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "shame",
      title: "ПОЗОР ГОДА",
      category: "extra",
      kind: "participant",
      visual: "shame",
      description: "Участник, которому ещё долго припоминали один и тот же неловкий момент.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Balabol", "Cloury", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti", "Rezo1n"].map((name) => ({ id: `shame-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "chatter",
      title: "ЧАТТЕР ГОДА",
      category: "extra",
      kind: "participant",
      visual: "chat",
      description: "Участник, который часто поддерживает разговор в чате и без которого переписки на сервере бы не было.",
      selfVoteAllowed: false,
      nominees: ["Akirakume", "Awal", "Dony_zq", "Eozik", "Flourin", "Izumrudik", "Maronnix", "Nodben", "Qusti", "Rezo1n"].map((name) => ({ id: `chatter-${name.toLowerCase()}`, label: name, type: "participant", personNickname: name }))
    },
    {
      id: "squad-of-year",
      title: "КОМПАШКА ГОДА",
      category: "extra",
      kind: "image",
      visual: "squad",
      description: "Та самая группа людей, которая часто собирается вместе, чтобы во что-то поиграть или пообщаться на сервере.",
      selfVoteAllowed: true,
      nominees: [
        { id: "squad-akira-dony-nodben", label: "Akirakume, Dony_zq, Nodben", type: "image", cover: "squad-gold", coverTitle: "ТРОЕ В ИГРЕ" },
        { id: "squad-eozik-flourin-maronnix", label: "Eozik, Flourin, Maronnix", type: "image", cover: "squad-violet", coverTitle: "СВОЯ ВОЛНА" },
        { id: "squad-five-friends", label: "Akirakume, Dony_zq, Maronnix, Nodben, Qusti", type: "image", cover: "squad-blue", coverTitle: "ПЯТЬ НА ОДНОЙ ВОЛНЕ" },
        { id: "squad-akira-rezoin", label: "Akirakume, Dony_zq, Maronnix, Rezo1n", type: "image", cover: "squad-rose", coverTitle: "КОМАНДА ГОДА" }
      ]
    },
    {
      id: "sos",
      title: "С.О.С. ГОДА",
      category: "extra",
      kind: "video",
      visual: "sos",
      description: "То самое событие, которого ждали многие, и оно наконец свершилось.",
      selfVoteAllowed: true,
      nominees: [
        { id: "sos-cybershoke", label: "Камбэк CYBERSHOKE летом", type: "video", cover: "sos-cybershoke", coverTitle: "ЛЕТНИЙ КАМБЭК", videoUrl: "" },
        { id: "sos-return-server", label: "Возвращение на сервер", type: "video", cover: "sos-return", coverTitle: "СНОВА ДОМА", videoUrl: "" },
        { id: "sos-gta-vi", label: "Выход GTA VI", type: "video", cover: "sos-gta", coverTitle: "НАЧАЛО ОЖИДАНИЯ", videoUrl: "" },
        { id: "sos-nodben-internet", label: "Починили инет Nodben", type: "video", cover: "sos-internet", coverTitle: "СВЯЗЬ ЕСТЬ", videoUrl: "" }
      ]
    }
  ],
  previousWinners: []
};
