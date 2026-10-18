/**
 * REAL MODEL OUTPUT (CR-007 G43). The recorded run of ONE real analysis: provider ChatGPT account (local bridge),
 * model gpt-6.1-sol, 2026-10-09, on the user's real Maliss 40+15 deck, goal A with Allied Code Talker @Ignister and
 * Firewall Dragon preferred. This is AI-GENERATED data — not hand-written, not a mocked answer. The JSON content is
 * identical to docs/dev/validation/rev7-real-ai/run-record.json (that file is the human-readable evidence copy).
 * Used only as a fixed fixture to re-check and re-evaluate with the current local code. Excluded from the app build.
 */
export const REAL_RUN_RECORD: any = {
 "id": "db045525-d2e5-40bb-ab9f-7015c73d43c0",
 "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
 "deckName": "瑪麗絲（實際牌表）",
 "deckVersion": 1,
 "deckFingerprint": "fp1-1a1362449c32fd",
 "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
 "assumptions": [
  "Yu-Gi-Oh! MASTER DUEL 當期規則（2020 年 4 月修訂的大師規則：額外牌組怪獸除連結怪獸與從額外牌組特殊召喚的靈擺怪獸外，可直接召喚到主要怪獸區）",
  "先攻第 1 回合：起手 5 張、不抽牌、不能攻擊",
  "雙方場上為空；假設對手不發動任何效果（無干擾）",
  "每回合 1 次通常召喚（卡片效果另外給予者除外）",
  "只使用此牌組的主牌組與額外牌組；備牌不使用"
 ],
 "provider": "chatgpt",
 "model": "gpt-6.1-sol",
 "params": {
  "timeoutSeconds": 900,
  "store": false,
  "stream": true,
  "structuredOutput": true
 },
 "scope": {
  "single": true,
  "multi": true,
  "extenders": true,
  "maxRoutes": 5,
  "candidates": 6
 },
 "goal": {
  "kind": "interruptions",
  "preferredExtraIds": [
   5043010,
   39138610
  ]
 },
 "promptVersion": "deck-analysis-v2",
 "cacheKey": "ai1-1988fa7ffaf7ef",
 "startedAt": "2026-10-09T07:16:30.537Z",
 "finishedAt": "2026-10-09T07:22:05.660Z",
 "durationMs": 335120,
 "status": "succeeded",
 "usage": {
  "inputTokens": 10408,
  "outputTokens": 13082
 },
 "servedModel": "gpt-6.1-sol",
 "summary": "以下為依牌表推導的候選路線，未經 MASTER DUEL 實測。優先列出 Firewall Dragon＋Maliss <Q> Hearts Crypter 的兩次干擾終場，再列 Allied Code Talker @Ignister 的否定與墓地干擾配置；單卡路線保留一張可用的除外資源，不依賴隨機抽牌。",
 "starters": [
  {
   "cardIds": [
    32061192
   ],
   "kind": "single",
   "description": "通常召喚後除外 Maliss <P> White Rabbit，取得陷阱與展開素材。"
  },
  {
   "cardIds": [
    75500286
   ],
   "kind": "single",
   "description": "除外 Maliss <P> Dormouse 並復活，可銜接單卡展開。"
  },
  {
   "cardIds": [
    68337209
   ],
   "kind": "single",
   "description": "發動時除外 Maliss <P> Dormouse，復活後展開。"
  },
  {
   "cardIds": [
    69272449
   ],
   "kind": "single",
   "description": "蓋放 Maliss <C> MTP-07，除外自身並搜尋 Maliss <P> Dormouse 後續展開。"
  },
  {
   "cardIds": [
    30118811
   ],
   "kind": "single",
   "description": "通常召喚並搜尋 Maliss <P> March Hare，棄掉另一張手牌後可透過 Link Decoder 啟動；需要額外棄牌資源。"
  },
  {
   "cardIds": [
    32061192,
    30118811
   ],
   "kind": "multi",
   "description": "Maliss <P> Dormouse 提供基本素材，Backup @Ignister 搜尋 Wizard @Ignister 補足高階終場。"
  },
  {
   "cardIds": [
    96676583,
    32061192
   ],
   "kind": "multi",
   "description": "Maliss <P> Chessy Cat 除外手中的 Maliss <P> Dormouse；抽牌不作為後續必要資源。"
  },
  {
   "cardIds": [
    20938824,
    32061192
   ],
   "kind": "multi",
   "description": "Maliss <P> March Hare 除外手中的 Maliss <P> Dormouse，兩者特殊召喚後展開。"
  },
  {
   "cardIds": [
    54143349
   ],
   "kind": "single",
   "description": "特殊召喚並搜尋 Radiant Typhoon Swen，可提供兩個等級３素材與魔陷檢索。"
  },
  {
   "cardIds": [
    67115133
   ],
   "kind": "single",
   "description": "搜尋 Radiant Typhoon Eldam，再銜接 Radiant Typhoon Swen 的素材鏈。"
  }
 ],
 "extenders": [
  {
   "cardId": 30118811,
   "requires": "控制從額外牌組特殊召喚的電子界族怪獸。",
   "description": "從手牌特殊召喚，搜尋 Wizard @Ignister 或 Maliss 怪獸後棄牌。"
  },
  {
   "cardId": 3723262,
   "requires": "控制從額外牌組特殊召喚的電子界族怪獸，墓地有闇屬性電子界族。",
   "description": "自身與墓地目標一起特殊召喚；之後只能特殊召喚電子界族。"
  },
  {
   "cardId": 20938824,
   "requires": "手牌或墓地有另一張 Maliss 卡。",
   "description": "除外該卡並特殊召喚自身，也能觸發尚未使用的除外復活效果。"
  },
  {
   "cardId": 54143349,
   "requires": "對手沒有魔法、陷阱；本題起始狀態符合。",
   "description": "不耗通常召喚提供素材，並搜尋 Radiant Typhoon Swen。"
  },
  {
   "cardId": 80538047,
   "requires": "對手沒有魔法、陷阱；須在電子界族特殊召喚限制前使用。",
   "description": "提供等級３素材，並搜尋 Radiant Typhoon 魔陷或 Mystical Space Typhoon。"
  },
  {
   "cardId": 33854624,
   "requires": "墓地有光或闇怪獸，且尚未受到電子界族特殊召喚限制。",
   "description": "除外墓地 Maliss 怪獸可觸發復活；不可與本回合使用 Transcode Talker 復活效果並用。"
  },
  {
   "cardId": 6637331,
   "requires": "墓地有光或闇怪獸，且尚未受到電子界族特殊召喚限制。",
   "description": "提供額外素材並觸發 Maliss 復活；先攻空場不能取得送墓除去。"
  },
  {
   "cardId": 65681983,
   "requires": "牌組仍有要宣言的 Maliss 怪獸。",
   "description": "可除外該怪獸啟動其除外區效果，但同名場上效果當回合受到否定。"
  },
  {
   "cardId": 20726052,
   "requires": "已有可復活的 Maliss 怪獸；當回合發動須除外場上 Maliss。",
   "description": "補充素材，也可在對手回合復活 Maliss <Q> White Binder 干擾墓地。"
  }
 ],
 "candidates": [
  {
   "route": {
    "schemaVersion": 1,
    "id": "fb569ae0-cedc-498f-b30b-c196409cb010",
    "version": 1,
    "name": "雙卡防火龍雙干擾",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "其餘三張起手牌不參與路線。\n不使用任何隨機抽牌；Maliss <Q> White Binder 的可選抽牌不執行。\n全程只特殊召喚電子界族，符合 Transcode Talker 的整回合限制。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        32061192
       ],
       "count": 1
      },
      {
       "anyOf": [
        30118811
       ],
       "count": 1
      }
     ],
     "mustRemainInMain": [
      {
       "cardId": 69272449,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20938824,
       "count": 1
      },
      {
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      }
     ],
     "mustExistInExtra": [
      {
       "cardId": 30342076,
       "count": 1
      },
      {
       "cardId": 95454996,
       "count": 1
      },
      {
       "cardId": 5043010,
       "count": 1
      },
      {
       "cardId": 46947713,
       "count": 1
      },
      {
       "cardId": 21848500,
       "count": 1
      }
     ],
     "setup": {
      "turnOrder": "first",
      "emptyBoard": true,
      "normalSummonAvailable": true,
      "noInterruption": true
     }
    },
    "steps": [
     {
      "id": "9fc16861-4deb-49be-add5-b5dda2545077",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "將 Maliss <P> Dormouse 放在 M1。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "取得展開起點。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "d0fbb778-e2e6-459c-bdc3-e65e4f7cf6f8",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外牌組怪獸",
      "description": "使用 Maliss <P> Dormouse 除外 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "從牌組除外一隻 Maliss 怪獸。",
      "resultText": "Maliss <P> White Rabbit 進入除外區。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "deck",
        "to": "banished"
       }
      ],
      "effectRef": "32061192#1"
     },
     {
      "id": "ef54d1dd-5f40-4ed7-8d1e-a30c6b579d62",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔復活",
      "description": "支付生命值，將 Maliss <P> White Rabbit 特殊召喚至 M3。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "從除外區特殊召喚自身。",
      "resultText": "本回合額外牌組只能特殊召喚連結怪獸。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "181ea528-f394-4e24-b220-1ae7ed72c12e",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔蓋陷阱",
      "description": "從牌組蓋放 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "蓋放墓地沒有同名卡的 Maliss 陷阱。",
      "resultText": "Maliss <C> MTP-07 位於 S1。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "69272449#1"
     },
     {
      "id": "cbbc0c74-87e8-4980-9edb-523c4e0d6a3d",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "製作解碼器",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "resultText": "Link Decoder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 30342076,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "3a5ef3f1-480e-4516-946d-cb2eab5293c8",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "陷阱搜尋",
      "description": "除外 Maliss <P> White Rabbit，使剛蓋放的 Maliss <C> MTP-07 可以發動。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       20938824
      ],
      "costText": "除外 M3 的 Maliss <P> White Rabbit。",
      "effectText": "搜尋 Maliss <P> March Hare；此時沒有 Maliss 連結怪獸，不執行場上除外。",
      "resultText": "取得 Maliss <P> March Hare；白兔本回合不能再次使用除外復活。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 20938824,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 94722358,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "94722358#1"
     },
     {
      "id": "27abcbdb-ddde-40a4-a13b-dc12ba840a72",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "三月兔登場",
      "description": "Maliss <P> March Hare 除外墓地的 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "除外另一張 Maliss 卡，特殊召喚自身。",
      "resultText": "Maliss <P> March Hare 位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "40854fa9-5114-4a55-afd4-e36609ca1c81",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "睡鼠復活",
      "description": "支付生命值復活 Maliss <P> Dormouse。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "從除外區特殊召喚自身。",
      "resultText": "Maliss <P> Dormouse 位於 M3。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "db990d38-4158-4949-bd20-cbc917629512",
      "order": 9,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "製作白色綁定者",
      "description": "使用三隻怪獸連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       20938824,
       32061192
      ],
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 95454996,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "dbb01a0a-95e0-4a8b-b5db-5c2db05dbaf3",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "解碼器復活",
      "description": "Link Decoder 因成為原攻擊力2300的電子界族連結素材而復活。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "Link Decoder 位於 M2；墓地復活不要求連結箭頭。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "156b6e76-e653-4310-a08e-f555838c5b89",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "綁定者除外三月兔",
      "description": "Maliss <Q> White Binder 只除外墓地的 Maliss <P> March Hare。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824
      ],
      "effectText": "除外指定墓地卡片。",
      "resultText": "保留墓地的 Maliss <P> Dormouse 給 Wizard @Ignister。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "237f507b-3260-4808-9e51-244cc3068e8a",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "回收白兔",
      "description": "Maliss <P> March Hare 回收除外的 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       69272449
      ],
      "costText": "支付300 LP。",
      "effectText": "將指定的除外 Maliss 怪獸加入手牌。",
      "resultText": "取得固定棄牌資源，Maliss <P> March Hare 留在除外區。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "62f153a6-74f6-4143-aabc-ee06fd255ed0",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "蓋放復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組蓋放 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "蓋放一張 Maliss 陷阱。",
      "resultText": "Maliss <C> GWC-06 位於 S1。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "2c5cad8f-18e0-4222-8de0-6cfc55b36f78",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "備援登場",
      "description": "控制額外牌組特殊召喚的電子界族，特殊召喚 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "Backup @Ignister 位於 M3。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "5a00d080-8efd-4345-87ec-b11382043fd3",
      "order": 15,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "搜尋巫師",
      "description": "搜尋 Wizard @Ignister，再棄掉回收的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       69272449
      ],
      "effectText": "搜尋闇屬性電子界族後棄一張牌。",
      "resultText": "Wizard @Ignister 加入手牌。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 69272449,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "2bf4d317-004f-4dc2-8e4c-bca9f8285c57",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "巫師雙體展開",
      "description": "Wizard @Ignister 指定墓地的 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "自身與墓地目標以守備表示特殊召喚。",
      "resultText": "Wizard @Ignister 位於 M4，Maliss <P> Dormouse 位於 M5；之後只能特殊召喚電子界族。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "3c86b0e2-8728-4e5a-bde8-b6dcf4e1fa13",
      "order": 17,
      "actionType": "link-summon",
      "actorCardIds": [
       5043010
      ],
      "title": "製作防火龍",
      "description": "以 Maliss <Q> White Binder 計為３，Backup @Ignister 計為１。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       30118811
      ],
      "resultText": "Firewall Dragon 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 5043010,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "a0447366-87ca-44f1-bb67-992c26993d46",
      "order": 18,
      "actionType": "link-summon",
      "actorCardIds": [
       46947713
      ],
      "title": "製作轉碼者",
      "description": "使用 Link Decoder、Wizard @Ignister 與 Maliss <P> Dormouse。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       3723262,
       32061192
      ],
      "resultText": "Transcode Talker 位於 Firewall Dragon 指向的 M2，兩者互相連結。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M2"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 46947713,
        "from": "extra",
        "to": "field",
        "slot": "M2"
       }
      ]
     },
     {
      "id": "53d9556f-613f-4e75-a25d-3c09630c93a6",
      "order": 19,
      "actionType": "activate",
      "actorCardIds": [
       46947713
      ],
      "title": "復活綁定者",
      "description": "Transcode Talker 將 Maliss <Q> White Binder 復活至右側 M3。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "effectText": "復活墓地連結３以下的電子界族連結怪獸。",
      "resultText": "Maliss <Q> White Binder 位於 M3；其特殊召喚效果本回合已用過。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "46947713#1"
     },
     {
      "id": "e6605ab9-2652-46ca-b7c8-1e118b2c438a",
      "order": 20,
      "actionType": "activate",
      "actorCardIds": [
       20726052
      ],
      "title": "復活陷阱補素材",
      "description": "除外 Maliss <Q> White Binder，發動剛蓋放的 Maliss <C> GWC-06。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       32061192
      ],
      "costText": "除外 M3 的 Maliss <Q> White Binder。",
      "effectText": "復活墓地的 Maliss <P> Dormouse；此時不控制 Maliss 連結怪獸，不回復生命值。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       },
       {
        "cardId": 20726052,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "20726052#1"
     },
     {
      "id": "9162f123-037d-47ff-b04b-4d671c6b9148",
      "order": 21,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "綁定者除外復活",
      "description": "支付生命值復活 Maliss <Q> White Binder，不執行可選抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付900 LP。",
      "effectText": "從除外區特殊召喚自身。",
      "resultText": "Maliss <Q> White Binder 位於 M3。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "95454996#3"
     },
     {
      "id": "675af71b-1bf8-49af-9c37-41c073289478",
      "order": 22,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "製作紅心加密者",
      "description": "三隻素材均計為１，使用 Transcode Talker、Maliss <Q> White Binder 與 Maliss <P> Dormouse。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       46947713,
       95454996,
       32061192
      ],
      "resultText": "Maliss <Q> Hearts Crypter 位於 M2，與 Firewall Dragon 互相連結。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "field",
        "to": "gy",
        "slot": "M2"
       },
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 21848500,
        "from": "extra",
        "to": "field",
        "slot": "M2"
       }
      ]
     }
    ],
    "endBoard": [
     {
      "cardId": 5043010,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；與 M2 互相連結，可快速返回一隻怪獸。"
     },
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "M2；指向 Firewall Dragon，可用除外的 Maliss <P> March Hare 支付效果需求。"
     },
     {
      "cardId": 20938824,
      "zone": "除外",
      "count": 1,
      "note": "保留給 Maliss <Q> Hearts Crypter 洗回牌組。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "離場除外。"
     },
     {
      "cardId": 95454996,
      "zone": "墓地",
      "count": 1,
      "note": "後續復活資源。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "db045525-d2e5-40bb-ab9f-7015c73d43c0",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v2",
     "generatedAt": "2026-10-09T07:22:05.635Z",
     "starterCardIds": [
      32061192
     ],
     "preconditions": [
      "其餘三張起手牌不參與路線。",
      "不使用任何隨機抽牌；Maliss <Q> White Binder 的可選抽牌不執行。",
      "全程只特殊召喚電子界族，符合 Transcode Talker 的整回合限制。"
     ],
     "pros": [
      "終場具一次怪獸返回與一次場上卡片除外，兩者各有實際可用條件。",
      "Maliss <Q> Hearts Crypter 指向怪獸，其效果與發動不能被否定。",
      "不消耗其餘三張起手牌，也不依賴抽牌。"
     ],
     "cons": [
      "高度依賴 Maliss <P> White Rabbit、Wizard @Ignister 與兩張指定陷阱仍在牌組。",
      "Firewall Dragon 的返回只能指定一隻怪獸，不是兩次干擾。",
      "若互相連結結構被拆掉，Firewall Dragon 可能失去返回目標數。"
     ],
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T07:22:05.635Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T07:22:05.635Z",
    "updatedAt": "2026-10-09T07:22:05.635Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "97607eec-3165-4d7b-8d39-b1526c5e4747",
    "version": 1,
    "name": "雙卡聯合否定與墓地干擾",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "其餘三張起手牌不參與路線。\n所有特殊召喚均為電子界族；保留 Maliss <C> GWC-06 到對手回合。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        32061192
       ],
       "count": 1
      },
      {
       "anyOf": [
        30118811
       ],
       "count": 1
      }
     ],
     "mustRemainInMain": [
      {
       "cardId": 69272449,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20938824,
       "count": 1
      },
      {
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      }
     ],
     "mustExistInExtra": [
      {
       "cardId": 30342076,
       "count": 1
      },
      {
       "cardId": 95454996,
       "count": 1
      },
      {
       "cardId": 46947713,
       "count": 1
      },
      {
       "cardId": 39138610,
       "count": 1
      }
     ],
     "setup": {
      "turnOrder": "first",
      "emptyBoard": true,
      "normalSummonAvailable": true,
      "noInterruption": true
     }
    },
    "steps": [
     {
      "id": "c2c45fa4-acaa-4a38-b3a7-15f7d20f5b14",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "aca75229-dde5-4345-b0c0-236c6d689ff2",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外白兔",
      "description": "Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外牌組一隻 Maliss 怪獸。",
      "resultText": "白兔可發動除外復活。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "deck",
        "to": "banished"
       }
      ],
      "effectRef": "32061192#1"
     },
     {
      "id": "12e74897-ecdb-4e7f-92a1-413ac0c092c9",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔復活",
      "description": "支付生命值復活 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，之後額外牌組只能特殊召喚連結怪獸。",
      "resultText": "位於 M3。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "5ff36812-2168-45f1-ab51-e8760c05413d",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "蓋放搜尋陷阱",
      "description": "Maliss <P> White Rabbit 蓋放 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "从牌組蓋放 Maliss 陷阱。",
      "resultText": "位於 S1。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "69272449#1"
     },
     {
      "id": "a77d8edf-7b6b-4f22-8e89-ecff37db5942",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "製作解碼器",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "resultText": "位於 EMZ-L。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 30342076,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "b58f6b6b-258b-45a6-8187-7106b8fe1b86",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "搜尋三月兔",
      "description": "除外 Maliss <P> White Rabbit，發動當回合蓋放的陷阱。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       20938824
      ],
      "costText": "除外 M3 的 Maliss <P> White Rabbit。",
      "effectText": "搜尋 Maliss <P> March Hare；不執行場上除外。",
      "resultText": "白兔留在除外區，三月兔加入手牌。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 20938824,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 94722358,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "94722358#1"
     },
     {
      "id": "e5860e87-4c05-491e-9d03-f200af8cddfb",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "三月兔登場",
      "description": "除外墓地 Maliss <P> Dormouse，特殊召喚 Maliss <P> March Hare。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "除外另一張 Maliss 卡並特殊召喚自身。",
      "resultText": "三月兔位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "8a4df3f2-132c-4695-9f8f-960b6f18b946",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "睡鼠復活",
      "description": "支付生命值復活 Maliss <P> Dormouse。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "從除外區特殊召喚自身。",
      "resultText": "位於 M3。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "ae8923e4-f68d-4a57-a73a-97012cbcc625",
      "order": 9,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "製作白色綁定者",
      "description": "使用 Link Decoder、Maliss <P> March Hare 與 Maliss <P> Dormouse。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       20938824,
       32061192
      ],
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 95454996,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "0dd64f4b-0668-4bea-b583-17ce430ca0bc",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "解碼器復活",
      "description": "Link Decoder 因成為符合攻擊力條件的連結素材而復活。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "位於 M2。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "254035a6-99eb-45fb-a9a4-7b2eccbcf161",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外三月兔",
      "description": "Maliss <Q> White Binder 只除外墓地的 Maliss <P> March Hare。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824
      ],
      "effectText": "除外指定墓地卡片。",
      "resultText": "保留墓地睡鼠。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "892d98ce-a9f4-47d4-88a6-3b606b51abfe",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "回收白兔",
      "description": "Maliss <P> March Hare 回收除外的 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       69272449
      ],
      "costText": "支付300 LP。",
      "effectText": "將除外 Maliss 怪獸加入手牌。",
      "resultText": "取得固定棄牌資源。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "9f49b71b-4a53-4b3c-bdc9-0f45729f1baf",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "保留復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組蓋放 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "蓋放 Maliss 陷阱。",
      "resultText": "位於 S1，保留至對手回合。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "db85c7bf-0164-4d66-afed-478d488bef0d",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "備援登場",
      "description": "特殊召喚手牌 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "控制額外牌組特殊召喚的電子界族時，特殊召喚自身。",
      "resultText": "位於 M3。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "2792c971-5a15-4d15-a80a-d2635df3a6a3",
      "order": 15,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "搜尋巫師",
      "description": "搜尋 Wizard @Ignister，再棄掉 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       69272449
      ],
      "effectText": "搜尋後棄一張牌。",
      "resultText": "Wizard @Ignister 加入手牌。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 69272449,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "28e2859c-da40-47f4-93f8-df2a16cb1ed9",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "巫師雙體展開",
      "description": "Wizard @Ignister 與墓地 Maliss <P> Dormouse 一起特殊召喚。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "兩者以守備表示特殊召喚，之後只能特殊召喚電子界族。",
      "resultText": "巫師位於 M4，睡鼠位於 M5。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "8eb9b04a-9390-406f-938c-bf48ca2ab091",
      "order": 17,
      "actionType": "link-summon",
      "actorCardIds": [
       46947713
      ],
      "title": "製作轉碼者",
      "description": "Maliss <Q> White Binder、Link Decoder 與 Backup @Ignister 均計為１。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       30342076,
       30118811
      ],
      "resultText": "Transcode Talker 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M2"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 46947713,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "7d315c19-38d6-4b4a-880a-078ff3017bb4",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       46947713
      ],
      "title": "復活綁定者",
      "description": "Transcode Talker 復活 Maliss <Q> White Binder 至 M2。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "effectText": "復活至自身箭頭指向的區域。",
      "resultText": "兩者互相連結；綁定者本回合不再使用墓地除外效果。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "46947713#1"
     },
     {
      "id": "871d9fb2-cb9c-4f48-9d0d-4fe16c1a2290",
      "order": 19,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "製作聯合碼語者",
      "description": "Transcode Talker 計為３，Wizard @Ignister 與 Maliss <P> Dormouse 各計為１。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       46947713,
       3723262,
       32061192
      ],
      "resultText": "Allied Code Talker @Ignister 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 39138610,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "22d9f3e5-d7b6-45d8-a39f-48d74ea80202",
      "order": 20,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "復活否定素材",
      "description": "Allied Code Talker @Ignister 復活墓地攻擊力2300的 Transcode Talker。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       46947713
      ],
      "effectText": "復活至自身指向的區域，之後本回合不能再特殊召喚。",
      "resultText": "Transcode Talker 位於 M1；M2 的 Maliss <Q> White Binder 也在其箭頭下。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "39138610#1"
     }
    ],
    "endBoard": [
     {
      "cardId": 39138610,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；可解放 M1 或 M2 的連結怪獸，否定一次發動並除外。"
     },
     {
      "cardId": 46947713,
      "zone": "場上",
      "count": 1,
      "note": "M1；建議保留作為否定解放素材之一。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M2；可先作為否定解放素材，再由陷阱復活以除外墓地卡片。"
     },
     {
      "cardId": 20726052,
      "zone": "場上",
      "count": 1,
      "note": "S1 蓋牌；對手回合復活被解放的綁定者。"
     },
     {
      "cardId": 20938824,
      "zone": "除外",
      "count": 1,
      "note": "可作為陷阱的備用復活目標。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "離場除外。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "db045525-d2e5-40bb-ab9f-7015c73d43c0",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v2",
     "generatedAt": "2026-10-09T07:22:05.635Z",
     "starterCardIds": [
      32061192
     ],
     "preconditions": [
      "其餘三張起手牌不參與路線。",
      "所有特殊召喚均為電子界族；保留 Maliss <C> GWC-06 到對手回合。"
     ],
     "pros": [
      "Allied Code Talker @Ignister 有兩隻實際指向的連結怪獸，否定條件已備妥。",
      "否定時解放 Maliss <Q> White Binder，之後可用 Maliss <C> GWC-06 復活並除外至多三張墓地卡。",
      "保留復活陷阱與更多場上資源。"
     ],
     "cons": [
      "墓地除外屬條件式第二層干擾，須先使綁定者進入墓地且對手有值得除外的資源。",
      "兩隻解放素材不代表兩次否定；Allied Code Talker @Ignister 的否定每回合只能使用一次。",
      "Maliss <C> GWC-06 必須在需要的墓地效果處理前安排復活時機。"
     ],
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T07:22:05.635Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T07:22:05.635Z",
    "updatedAt": "2026-10-09T07:22:05.635Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "97190b13-a0fd-40b1-8c71-6a7d908db68d",
    "version": 1,
    "name": "單卡紅心除外",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "其餘四張起手牌不參與路線。\n保留除外的 Maliss <P> White Rabbit，不提前使用 Maliss <Q> Hearts Crypter 的除外效果。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        32061192
       ],
       "count": 1
      }
     ],
     "mustRemainInMain": [
      {
       "cardId": 69272449,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20938824,
       "count": 1
      }
     ],
     "mustExistInExtra": [
      {
       "cardId": 30342076,
       "count": 1
      },
      {
       "cardId": 21848500,
       "count": 1
      }
     ],
     "setup": {
      "turnOrder": "first",
      "emptyBoard": true,
      "normalSummonAvailable": true,
      "noInterruption": true
     }
    },
    "steps": [
     {
      "id": "11782afd-d085-4049-bb1c-315da4f5fce3",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "afe375d6-eabf-475f-a1e1-d766a8eb4042",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外白兔",
      "description": "Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外牌組的 Maliss 怪獸。",
      "resultText": "白兔進入除外區。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "deck",
        "to": "banished"
       }
      ],
      "effectRef": "32061192#1"
     },
     {
      "id": "a9862575-cbdd-4485-a9bb-470005fdae2d",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔復活",
      "description": "支付生命值復活 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，之後額外牌組只能特殊召喚連結怪獸。",
      "resultText": "位於 M3。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "faf2565e-9d9a-4af9-ab5d-d832767cce15",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "蓋放搜尋陷阱",
      "description": "Maliss <P> White Rabbit 蓋放 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "從牌組蓋放 Maliss 陷阱。",
      "resultText": "位於 S1。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "69272449#1"
     },
     {
      "id": "d2a3a091-8640-48a0-b6e4-e234b6e6d9f7",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "製作解碼器",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "resultText": "位於 EMZ-L。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 30342076,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "a8832a6f-9022-4fd5-aae7-797530d0aef4",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "搜尋三月兔",
      "description": "除外 Maliss <P> White Rabbit，發動剛蓋放的 Maliss <C> MTP-07。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       20938824
      ],
      "costText": "除外 M3 的 Maliss <P> White Rabbit。",
      "effectText": "搜尋 Maliss <P> March Hare；不執行場上除外。",
      "resultText": "白兔留在除外區。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 20938824,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 94722358,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "94722358#1"
     },
     {
      "id": "01d3d7a4-6714-4a30-91cd-c297cf54b3fd",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "三月兔登場",
      "description": "除外墓地 Maliss <P> Dormouse，特殊召喚 Maliss <P> March Hare。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "除外另一張 Maliss 卡並特殊召喚自身。",
      "resultText": "三月兔位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "d4483d57-6c99-46f5-92b9-7685bacb0a9d",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "睡鼠復活",
      "description": "支付生命值復活 Maliss <P> Dormouse。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300 LP。",
      "effectText": "從除外區特殊召喚自身。",
      "resultText": "位於 M3。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "4afe1d3c-32c0-460f-bae9-119e9fc7d75f",
      "order": 9,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "製作紅心加密者",
      "description": "使用 Link Decoder、Maliss <P> March Hare 與 Maliss <P> Dormouse。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       20938824,
       32061192
      ],
      "resultText": "Maliss <Q> Hearts Crypter 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 21848500,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "94254e6d-f73e-4399-a26c-5a4c965fc298",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "解碼器復活",
      "description": "Link Decoder 復活至 Maliss <Q> Hearts Crypter 指向的 M1。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "紅心加密者指向怪獸，除外資源也已保留。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30342076#1"
     }
    ],
    "endBoard": [
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；可洗回除外白兔，除外場上一張卡。"
     },
     {
      "cardId": 30342076,
      "zone": "場上",
      "count": 1,
      "note": "M1；使紅心加密者的效果及發動不能被否定，離場時除外。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "紅心加密者的必要除外資源。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "後續資源。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "後續資源。"
     },
     {
      "cardId": 94722358,
      "zone": "墓地",
      "count": 1,
      "note": "已使用的搜尋陷阱。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "db045525-d2e5-40bb-ab9f-7015c73d43c0",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v2",
     "generatedAt": "2026-10-09T07:22:05.635Z",
     "starterCardIds": [
      32061192
     ],
     "preconditions": [
      "其餘四張起手牌不參與路線。",
      "保留除外的 Maliss <P> White Rabbit，不提前使用 Maliss <Q> Hearts Crypter 的除外效果。"
     ],
     "pros": [
      "單張起手提供一次場上卡片除外。",
      "不使用其他起手牌，保留手坑或蓋牌空間。",
      "Link Decoder 在箭頭下，使紅心加密者取得抗否定條件。"
     ],
     "cons": [
      "只有一次場上干擾，沒有發動否定。",
      "需要白兔、三月兔與指定陷阱仍在牌組。",
      "除外白兔若被提前移走，紅心加密者失去本路線保留的效果資源。"
     ],
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T07:22:05.635Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T07:22:05.635Z",
    "updatedAt": "2026-10-09T07:22:05.635Z"
   },
   "schemaErrors": []
  }
 ],
 "explored": [
  {
   "name": "防火龍與紅心互連",
   "handCardIds": [
    32061192,
    30118811
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    5043010,
    46947713,
    21848500
   ],
   "finalBoardCardIds": [
    5043010,
    21848500
   ],
   "routeName": "雙卡防火龍雙干擾",
   "note": "保留 Firewall Dragon，Transcode Talker 與 Maliss <Q> White Binder 僅作途中素材。"
  },
  {
   "name": "聯合碼語者復活轉碼者",
   "handCardIds": [
    32061192,
    30118811
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    46947713,
    39138610
   ],
   "finalBoardCardIds": [
    39138610,
    95454996,
    46947713,
    20726052
   ],
   "routeName": "雙卡聯合否定與墓地干擾",
   "note": "保留 Allied Code Talker @Ignister；墓地除外是需要安排解放與復活時機的條件式干擾。"
  },
  {
   "name": "睡鼠單卡紅心",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    30342076,
    21848500
   ],
   "finalBoardCardIds": [
    21848500,
    30342076
   ],
   "routeName": "單卡紅心除外",
   "note": "完整列出一張起手、不依賴抽牌的候選路線。"
  },
  {
   "name": "其他除外起動替換",
   "handCardIds": [
    75500286
   ],
   "extraDeckCardIds": [
    30342076,
    21848500
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮先除外睡鼠再銜接單卡路線；未逐步列出，不能直接視為同一份路線。"
  },
  {
   "name": "地下場地起動",
   "handCardIds": [
    68337209
   ],
   "extraDeckCardIds": [
    30342076,
    21848500
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮場地除外睡鼠後展開；未展開完整步驟與終場。"
  },
  {
   "name": "白兔與陷阱起動",
   "handCardIds": [
    69272449
   ],
   "extraDeckCardIds": [
    30342076,
    21848500
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮陷阱搜尋睡鼠的起動方式；尚未逐步列出。"
  },
  {
   "name": "備援單卡起動",
   "handCardIds": [
    30118811
   ],
   "extraDeckCardIds": [
    30342076,
    52698008,
    95454996,
    39138610
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮搜尋三月兔、經 Cyberse Wicckid 補資源；需要固定棄牌與更多細節，未宣稱可達偏好終場。"
  },
  {
   "name": "風暴等級３素材鏈",
   "handCardIds": [
    54143349
   ],
   "extraDeckCardIds": [
    58699500,
    9763474,
    29301450
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 Cherubini, Ebon Angel of the Burning Abyss 送墓與 Haggard Lizardose 除外復活；非電子界族特殊召喚會妨礙當回合使用 Transcode Talker。"
  },
  {
   "name": "風暴本家連結",
   "handCardIds": [
    54143349
   ],
   "extraDeckCardIds": [
    39341885
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "Radiant Typhoon Varuroon, the Marine Eidolon 的放置效果不是快速效果，牌組也没有其可放置的永續陷阱；未列為先攻干擾終場。"
  },
  {
   "name": "泛用雙體暫時除外",
   "handCardIds": [
    32061192,
    54143349
   ],
   "extraDeckCardIds": [
    29301450,
    9763474
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 S:P Little Knight 作為不同終場，但不能在 Wizard @Ignister 或 Splash Mage 的電子界族限制後特殊召喚。"
  },
  {
   "name": "電子界復活支線",
   "handCardIds": [
    32061192,
    30118811
   ],
   "extraDeckCardIds": [
    59859086,
    52698008,
    60303245,
    24842059
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 Splash Mage、Cyberse Wicckid、Salamangreat Almiraj 與 Linguriboh；本次未列出比主路線更好的完整干擾終場。"
  },
  {
   "name": "連碼先攻終場",
   "handCardIds": [
    32061192,
    30118811
   ],
   "extraDeckCardIds": [
    86066372
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "Accesscode Talker 沒有對手回合主動干擾，保留作後攻與後續斬殺，不列為本題優先終場。"
  },
  {
   "name": "偏好怪獸僅作素材",
   "handCardIds": [
    32061192,
    30118811
   ],
   "extraDeckCardIds": [
    5043010,
    39138610
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "未找到值得列出的 Firewall Dragon 純過渡變體；Allied Code Talker @Ignister 使用復活效果後不能再特殊召喚，不採用復活後繼續連結的變體。"
  }
 ]
};
