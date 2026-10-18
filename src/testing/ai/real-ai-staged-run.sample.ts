/**
 * REAL MODEL OUTPUT (CR-008). The recorded run of ONE real PHASED analysis: provider ChatGPT account (local bridge),
 * model gpt-6.1-sol, 2026-10-09, on the user's real Maliss 40+15 deck, goal A with Allied Code Talker @Ignister and
 * Firewall Dragon preferred, sizes 1+2+3, default budgets (5 requests). AI-GENERATED data — not hand-written, not a
 * mocked answer. The JSON content is identical to docs/dev/validation/rev8-real-ai/run-record.json (the human-readable copy).
 * Used only as a fixed fixture to re-check and re-evaluate with the current local code. Excluded from the app build.
 */
export const REAL_STAGED_RUN: any = {
 "id": "8e9209ef-9751-409b-bdd6-990ca0321501",
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
  "candidates": 6,
  "triple": true
 },
 "goal": {
  "kind": "interruptions",
  "preferredExtraIds": [
   5043010,
   39138610
  ]
 },
 "promptVersion": "deck-analysis-v3-staged",
 "cacheKey": "ai1-130afcd3153130",
 "startedAt": "2026-10-09T10:45:49.606Z",
 "finishedAt": "2026-10-09T11:14:08.478Z",
 "durationMs": 1698872,
 "status": "succeeded",
 "staged": {
  "combos": [
   {
    "cardIds": [
     32061192,
     30118811,
     20938824
    ],
    "size": 3,
    "priority": 1,
    "reason": "本家除外啟動、電子界檢索與手牌除外延伸互補，優先比較高資源終場；三張皆參與展開。",
    "targetExtraIds": [
     5043010,
     39138610,
     21848500,
     95454996
    ],
    "target": "優先研究 Firewall Dragon 與 Allied Code Talker @Ignister 共存，搭配 Maliss <Q> Hearts Crypter 或本家陷阱；檢查互相連結、無效代價與除外資源，並比較兩張偏好怪獸僅作中繼的變體。",
    "status": "done",
    "routes": 2,
    "usage": {
     "inputTokens": 11066,
     "outputTokens": 18725
    }
   },
   {
    "cardIds": [
     68337209,
     30118811
    ],
    "size": 2,
    "priority": 2,
    "reason": "場地啟動本家並保留通常召喚；Backup @Ignister 增加檢索與素材，適合比較雙卡的干擾效率。",
    "targetExtraIds": [
     5043010,
     39138610,
     21848500,
     95454996
    ],
    "target": "分別研究 Firewall Dragon 互相連結留場與 Allied Code Talker @Ignister 帶無效代價留場的終場，搭配本家除外或陷阱干擾；資源足夠才追求共存。",
    "status": "done",
    "routes": 2,
    "usage": {
     "inputTokens": 11034,
     "outputTokens": 15240
    }
   },
   {
    "cardIds": [
     32061192
    ],
    "size": 1,
    "priority": 3,
    "reason": "不依賴額外起手或抽牌的核心單卡基準，可衡量增加起手卡實際帶來的干擾提升。",
    "targetExtraIds": [
     21848500,
     95454996,
     5043010,
     39138610
    ],
    "target": "優先研究 Maliss <Q> Hearts Crypter 與可用本家陷阱；另檢查兩張偏好怪獸各自留場或作中繼的上限，不預設單卡能全部共存。",
    "status": "done",
    "routes": 2,
    "usage": {
     "inputTokens": 11018,
     "outputTokens": 10784
    }
   },
   {
    "cardIds": [
     54143349,
     20938824,
     30118811
    ],
    "size": 3,
    "priority": 4,
    "reason": "Radiant Typhoon Eldam 提供等級3素材與檢索；墓地本家資源和 Maliss <P> March Hare 連動，再由 Backup @Ignister 補電子界資源。",
    "targetExtraIds": [
     58699500,
     95454996,
     21848500,
     5043010,
     39138610
    ],
    "target": "研究非電子界引擎轉入本家後的快速除外、回手與發動無效終場；排除 Transcode Talker 復活效果，分別比較兩張偏好怪獸留場及中繼用途。",
    "status": "done",
    "routes": 2,
    "usage": {
     "inputTokens": 11075,
     "outputTokens": 17676
    }
   }
  ],
  "rejected": [],
  "budget": {
   "maxRequests": 6,
   "tokenBudget": 150000,
   "requests": 5,
   "tokens": 118847,
   "stoppedBy": null
  },
  "notAnalyzed": 0,
  "failed": 0,
  "exhaustive": false,
  "plan": {
   "summary": "以下為候選角色與待分析起手，不含操作路線。以不抽牌、不依賴其餘起手牌為前提，優先研究有效干擾與資源配置。Firewall Dragon 須有互相連結才能計入回手干擾；Allied Code Talker @Ignister 須保留其箭頭指向的連結怪獸。兩者留場及僅作中繼的變體尚待後續分析，不預先承諾共存或干擾數。",
   "roles": [
    {
     "cardId": 94145021,
     "roles": [
      "hand-trap"
     ],
     "note": "限制後續牌組加手；須等對手滿足觸發條件。"
    },
    {
     "cardId": 23434538,
     "roles": [
      "hand-trap"
     ],
     "note": "對手回合的抽牌壓力；本次不抽牌展開不依賴它。"
    },
    {
     "cardId": 14558127,
     "roles": [
      "hand-trap"
     ],
     "note": "阻止包含牌組加手、特召或送墓的效果。"
    },
    {
     "cardId": 73642296,
     "roles": [
      "hand-trap"
     ],
     "note": "對應指定類型的墓地資源效果。"
    },
    {
     "cardId": 69272449,
     "roles": [
      "starter",
      "searcher",
      "extender"
     ],
     "note": "召喚取得陷阱；遭除外可回場增加素材。"
    },
    {
     "cardId": 96676583,
     "roles": [
      "combo-piece",
      "extender"
     ],
     "note": "遭除外可回場；本次不使用其抽牌效果。"
    },
    {
     "cardId": 32061192,
     "roles": [
      "starter",
      "extender"
     ],
     "note": "從牌組除外本家怪獸，是主要單卡起點。"
    },
    {
     "cardId": 30118811,
     "roles": [
      "starter",
      "extender",
      "searcher"
     ],
     "note": "檢索暗屬性電子界族並棄牌；額外電子界怪獸支援手牌特召。"
    },
    {
     "cardId": 20938824,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "除外手牌或墓地本家卡以特召；自身遭除外則回收怪獸。"
    },
    {
     "cardId": 54143349,
     "roles": [
      "starter",
      "extender",
      "searcher"
     ],
     "note": "空場可自行特召並檢索另一隻本家，提供等級3素材。"
    },
    {
     "cardId": 80538047,
     "roles": [
      "starter",
      "extender",
      "searcher"
     ],
     "note": "空場可自行特召；檢索本家魔陷或 Mystical Space Typhoon。"
    },
    {
     "cardId": 42141493,
     "roles": [
      "hand-trap"
     ],
     "note": "須自己場上沒有卡；建立終場後通常不能發動。"
    },
    {
     "cardId": 3723262,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "配合額外電子界怪獸與墓地暗屬性電子界族提供兩個素材。"
    },
    {
     "cardId": 33854624,
     "roles": [
      "extender",
      "hand-trap",
      "searcher"
     ],
     "note": "除外墓地光暗怪獸特召；可觸發本家回場並於結束階段補龍族。"
    },
    {
     "cardId": 6637331,
     "roles": [
      "extender",
      "hand-trap"
     ],
     "note": "提供墓地除外；場上送墓的移除效果仍須對手有特召怪獸。"
    },
    {
     "cardId": 27204311,
     "roles": [
      "hand-trap"
     ],
     "note": "大量召喚後清場；可能同時犧牲自己的終場。"
    },
    {
     "cardId": 75500286,
     "roles": [
      "starter"
     ],
     "note": "直接除外牌組本家怪獸，啟動其除外效果。"
    },
    {
     "cardId": 68337209,
     "roles": [
      "starter",
      "extender"
     ],
     "note": "發動時除外本家卡，可啟動怪獸回場或回收。"
    },
    {
     "cardId": 5318639,
     "roles": [
      "other",
      "combo-piece"
     ],
     "note": "魔陷移除；與本家速攻魔法的被破壞重蓋效果連動。"
    },
    {
     "cardId": 65681983,
     "roles": [
      "other"
     ],
     "note": "主要防禦同名干擾；除外本家怪獸也會抑制其當回合效果。"
    },
    {
     "cardId": 67115133,
     "roles": [
      "starter",
      "searcher"
     ],
     "note": "檢索低等級本家怪獸，銜接空場特召引擎。"
    },
    {
     "cardId": 20508881,
     "roles": [
      "searcher",
      "other"
     ],
     "note": "本次僅考慮回收或檢索 Mystical Space Typhoon，不採抽牌效果。"
    },
    {
     "cardId": 10045474,
     "roles": [
      "hand-trap",
      "other"
     ],
     "note": "先攻可覆蓋，作為對手回合怪獸效果無效。"
    },
    {
     "cardId": 94722358,
     "roles": [
      "searcher",
      "extender",
      "combo-piece"
     ],
     "note": "檢索本家怪獸；控制本家連結時另有場上除外干擾。"
    },
    {
     "cardId": 20726052,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "復活墓地或除外本家；可支援對手回合的召喚觸發效果。"
    },
    {
     "cardId": 57111661,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "從牌組補素材，但該怪獸當回合不能發動效果。"
    },
    {
     "cardId": 60303245,
     "roles": [
      "combo-piece",
      "other"
     ],
     "note": "低攻通常召喚怪獸的轉換點；另提供效果破壞保護。"
    },
    {
     "cardId": 24842059,
     "roles": [
      "combo-piece",
      "other"
     ],
     "note": "低等級電子界族轉換點；留場可對應陷阱發動。"
    },
    {
     "cardId": 30342076,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "作為高攻電子界連結素材後回場，補充連結資源。"
    },
    {
     "cardId": 58699500,
     "roles": [
      "combo-piece"
     ],
     "note": "等級3素材橋接，將等級3本家怪獸送墓供後續除外。"
    },
    {
     "cardId": 52698008,
     "roles": [
      "searcher",
      "extender",
      "combo-piece"
     ],
     "note": "箭頭區特召後除外墓地電子界族並檢索調整。"
    },
    {
     "cardId": 59859086,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "復活電子界族補素材；發動後限制特召種族。"
    },
    {
     "cardId": 29301450,
     "roles": [
      "other",
      "combo-piece"
     ],
     "note": "對手回合暫時除外；須避開電子界族特召限制。"
    },
    {
     "cardId": 9763474,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "除外場上或墓地低攻本家怪獸，觸發回場效果。"
    },
    {
     "cardId": 39341885,
     "roles": [
      "searcher",
      "combo-piece",
      "other"
     ],
     "note": "回收 Mystical Space Typhoon；牌表沒有可放置的本家永續陷阱。"
    },
    {
     "cardId": 46947713,
     "roles": [
      "extender",
      "combo-piece"
     ],
     "note": "復活電子界連結；效果要求整回合未特召非電子界族。"
    },
    {
     "cardId": 95454996,
     "roles": [
      "extender",
      "searcher",
      "combo-piece"
     ],
     "note": "墓地除外與陷阱覆蓋核心；本次回場不採可選抽牌。"
    },
    {
     "cardId": 21848500,
     "roles": [
      "combo-piece",
      "other"
     ],
     "note": "主要快速除外干擾；須保留可洗回牌組的除外本家卡。"
    },
    {
     "cardId": 5043010,
     "roles": [
      "extender",
      "combo-piece",
      "other"
     ],
     "note": "互相連結時提供快速回手；箭頭區送墓可特召手牌電子界族。"
    },
    {
     "cardId": 86066372,
     "roles": [
      "other",
      "combo-piece"
     ],
     "note": "偏向後攻解場；先攻沒有直接的對手回合干擾。"
    },
    {
     "cardId": 39138610,
     "roles": [
      "extender",
      "combo-piece",
      "other"
     ],
     "note": "復活2300攻電子界族後停止特召；須有箭頭區連結怪獸供無效代價。"
    }
   ]
  }
 },
 "candidates": [
  {
   "route": {
    "schemaVersion": 1,
    "id": "13533ab3-8f1a-4b4b-9737-e8ddd7de20f7",
    "version": 1,
    "name": "雙碼共存與雙向互連",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應；另外兩張起手不使用。\n所有 requiredInMain 組件仍在牌組；起始生命值為8000。\nMaliss <Q> White Binder 的選擇性抽牌不使用。\n墓地復活的連結怪獸放主怪獸區，不需連結箭頭；本路線的額外牌組連結召喚均使用空出的額外怪獸區或有效箭頭區。",
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
      },
      {
       "anyOf": [
        20938824
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
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      },
      {
       "cardId": 96676583,
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
       "cardId": 59859086,
       "count": 1
      },
      {
       "cardId": 46947713,
       "count": 1
      },
      {
       "cardId": 5043010,
       "count": 1
      },
      {
       "cardId": 24842059,
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
      "id": "b20ac852-3c9e-46b1-b790-df2f1bee2608",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse 至 M1。",
      "fromZone": "手牌",
      "toZone": "場上",
      "costText": "使用本回合通常召喚。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
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
      "id": "b85032c5-f4e6-4988-a5cf-8c5e6f9b806c",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外白兔",
      "description": "使用 Maliss <P> Dormouse，從牌組除外 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "costText": "無。",
      "effectText": "從牌組除外一隻 Maliss 怪獸；本回合己方 Maliss 怪獸增加600攻擊力。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "c4031f43-5725-4ec6-85f4-183c97a7fecd",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔返回",
      "description": "使用 Maliss <P> White Rabbit 的除外誘發效果，特殊召喚至 M3。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於 M3。",
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
      "id": "f3d8145f-cf3a-4c4b-8fda-ef345040ba49",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "蓋放檢索陷阱",
      "description": "Maliss <P> White Rabbit 從牌組蓋放 Maliss <C> MTP-07 至 S1。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "costText": "無。",
      "effectText": "從牌組蓋放一張與墓地卡名不同的 Maliss 陷阱。",
      "resultText": "S1 有蓋放的 Maliss <C> MTP-07。",
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
      "id": "ca488d4a-3ece-40c0-bb7f-de06ac110205",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "連結解碼",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder 至 EMZ-L。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "costText": "使用一隻等級4以下電子界族。",
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
      "id": "c525bcda-3920-4d8c-bad1-e6e12b35a319",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "後援登場",
      "description": "因控制額外牌組特召的電子界族，特殊召喚 Backup @Ignister 至 M4。",
      "fromZone": "手牌",
      "toZone": "場上",
      "costText": "無。",
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "Backup @Ignister 位於 M4。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "286bb333-a9b1-4b75-8afd-0403d673bf7d",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索復活組件",
      "description": "Backup @Ignister 檢索 Wizard @Ignister，再丟棄指定起手的 Maliss <P> March Hare。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       20938824
      ],
      "costText": "無；丟棄是效果處理。",
      "effectText": "加入一隻非同名闇屬性電子界族，再丟棄一張手牌。",
      "resultText": "Wizard @Ignister 在手；Maliss <P> March Hare 在墓地。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "9a808319-91ee-44d0-98ac-5a44a7e2d99b",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "雙體特殊召喚",
      "description": "Wizard @Ignister 指定墓地 Maliss <P> Dormouse，同時特殊召喚兩者。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "costText": "無。",
      "effectText": "自身與指定怪獸以守備表示特殊召喚；之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M5，Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "b063235b-0e34-475c-984f-b07af10ddfdf",
      "order": 9,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "連結白色綁定",
      "description": "以 Link Decoder、Backup @Ignister 與 Maliss <P> White Rabbit 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       30118811,
       69272449
      ],
      "costText": "三個連結值，且包含 Maliss 怪獸。",
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 69272449,
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
      "id": "4eb777b8-fc86-438b-9bd6-92814bf13328",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "解碼復活",
      "description": "Link Decoder 因作為原攻擊力2300的電子界族連結素材而復活至 M2。",
      "fromZone": "墓地",
      "toZone": "場上",
      "costText": "無。",
      "effectText": "特殊召喚自身；離場時除外。",
      "resultText": "Link Decoder 位於 M2。",
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
      "id": "e4ca3c04-9c55-4220-993a-2d9d56c9e6e1",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外並回收準備",
      "description": "Maliss <Q> White Binder 除外墓地 Maliss <P> March Hare 與 Backup @Ignister。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824,
       30118811
      ],
      "costText": "無。",
      "effectText": "指定並除外最多三張墓地卡。",
      "resultText": "兩張指定卡被除外；Maliss <P> White Rabbit 留在墓地。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 30118811,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "35fa4822-bf74-4a3b-89ba-d71157a0dd8d",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "回收三月兔",
      "description": "Maliss <P> March Hare 的除外誘發效果指定自身，將自身加入手牌。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       20938824
      ],
      "costText": "支付300生命值。",
      "effectText": "將一隻己方除外的 Maliss 怪獸加入手牌。",
      "resultText": "指定起手的 Maliss <P> March Hare 回到手牌。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "815ab74c-1175-4f67-82fd-3b7e75fba2e8",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "蓋放復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組蓋放 Maliss <C> GWC-06 至 S2。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "costText": "無。",
      "effectText": "從牌組或墓地蓋放一張 Maliss 陷阱。",
      "resultText": "S2 有蓋放的 Maliss <C> GWC-06。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "69b41183-7abc-4448-a13d-e0c29a9685cf",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "三月兔延伸",
      "description": "Maliss <P> March Hare 除外墓地 Maliss <P> White Rabbit，再特殊召喚至 M4。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       69272449
      ],
      "costText": "無；除外是效果處理。",
      "effectText": "除外另一張手牌或墓地 Maliss 卡，成功後特殊召喚自身。",
      "resultText": "Maliss <P> White Rabbit 保持除外，因其本回合復活效果已使用。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "9714fcc4-7e7e-41df-9367-6fef783d5d39",
      "order": 15,
      "actionType": "link-summon",
      "actorCardIds": [
       59859086
      ],
      "title": "連結飛濺法師",
      "description": "將 Maliss <Q> White Binder 視為一個素材值，與 Wizard @Ignister 連結召喚 Splash Mage。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       3723262
      ],
      "costText": "兩隻電子界族，連結值合計2。",
      "resultText": "Splash Mage 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 59859086,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "22794e67-be49-4548-855f-1ed8ad7459bc",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       59859086
      ],
      "title": "法師復活素材",
      "description": "Splash Mage 指定墓地 Wizard @Ignister，復活至 M5。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       3723262
      ],
      "costText": "無。",
      "effectText": "以守備表示復活電子界族，效果無效；之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M5，效果無效。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "59859086#1"
     },
     {
      "id": "5278653a-76b7-40b7-b89d-5132fc34f348",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       20726052
      ],
      "title": "陷阱復活綁定",
      "description": "除外 M1 的 Maliss <P> Dormouse，當回合發動 Maliss <C> GWC-06，復活 Maliss <Q> White Binder。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       95454996
      ],
      "costText": "為當回合發動蓋放陷阱，除外場上 Maliss <P> Dormouse。",
      "effectText": "特殊召喚墓地 Maliss <Q> White Binder 至 M3；處理時尚未控制 Maliss 連結怪獸，不計回血。",
      "resultText": "Maliss <Q> White Binder 位於 M3；陷阱進墓地。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 20726052,
        "from": "field",
        "to": "gy",
        "slot": "S2"
       }
      ],
      "effectRef": "20726052#1"
     },
     {
      "id": "f756a9ae-127f-4950-8710-9057634481e7",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "睡鼠返回",
      "description": "Maliss <P> Dormouse 使用除外誘發效果，返回 M1。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "1f4db642-769e-4761-9715-e5c2eb51d531",
      "order": 19,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "檢索手牌素材",
      "description": "除外 M3 的 Maliss <Q> White Binder，當回合發動 Maliss <C> MTP-07，檢索 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "為當回合發動蓋放陷阱，除外場上 Maliss <Q> White Binder。",
      "effectText": "從牌組加入一隻 Maliss 怪獸；此時不控制 Maliss 連結怪獸，不處理追加除外。",
      "resultText": "Maliss <P> Chessy Cat 在手；陷阱進墓地。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 96676583,
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
      "id": "1cf01f3e-7b9c-469c-8e98-539f5dea8637",
      "order": 20,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "綁定返回",
      "description": "Maliss <Q> White Binder 使用除外誘發效果，返回 M3；不進行選擇性抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付900生命值。",
      "effectText": "特殊召喚自身，之後可以抽一張；本路線不抽。",
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
      "id": "d3c88eab-d3b3-49ae-a017-2597daddd906",
      "order": 21,
      "actionType": "link-summon",
      "actorCardIds": [
       46947713
      ],
      "title": "連結轉碼",
      "description": "以 Splash Mage 與 Link Decoder 連結召喚 Transcode Talker 至 EMZ-L。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       30342076
      ],
      "costText": "兩隻效果怪獸，連結值2加1。",
      "resultText": "Transcode Talker 位於 EMZ-L；Link Decoder 因離場除外。",
      "moves": [
       {
        "cardId": 59859086,
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
        "cardId": 46947713,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "062d2fcc-c02c-45ae-a0ca-08a77ce0a34f",
      "order": 22,
      "actionType": "activate",
      "actorCardIds": [
       46947713
      ],
      "title": "轉碼復活法師",
      "description": "Transcode Talker 復活 Splash Mage 至其下箭頭指向的 M2。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       59859086
      ],
      "costText": "無。",
      "effectText": "復活連結3以下電子界族連結怪獸至箭頭區；本回合不能有非電子界族特殊召喚。",
      "resultText": "Splash Mage 位於 M2。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "gy",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "46947713#1"
     },
     {
      "id": "c6c85658-b466-4563-be1c-3b8e66845bbc",
      "order": 23,
      "actionType": "link-summon",
      "actorCardIds": [
       5043010
      ],
      "title": "連結防火牆",
      "description": "以 Splash Mage、Maliss <P> March Hare 與 Wizard @Ignister 連結召喚 Firewall Dragon 至 M2。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       20938824,
       3723262
      ],
      "costText": "三隻怪獸，連結值2加1加1。",
      "resultText": "Firewall Dragon 位於 Transcode Talker 指向的 M2，右側與 M3 的 Maliss <Q> White Binder 互相連結。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "field",
        "to": "gy",
        "slot": "M2"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 5043010,
        "from": "extra",
        "to": "field",
        "slot": "M2"
       }
      ]
     },
     {
      "id": "0da1ffc6-ec34-432c-a757-2e20d9d1e70b",
      "order": 24,
      "actionType": "link-summon",
      "actorCardIds": [
       24842059
      ],
      "title": "連結栗子",
      "description": "以 Maliss <P> Dormouse 連結召喚 Linguriboh 至 Firewall Dragon 左箭頭指向的 M1。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "costText": "一隻等級4以下電子界族。",
      "resultText": "Maliss <P> Dormouse 從 Firewall Dragon 指向的區域送墓，滿足其手牌特殊召喚誘發條件。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 24842059,
        "from": "extra",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "6d97b76b-9a1c-42af-beb0-f784e8490041",
      "order": 25,
      "actionType": "activate",
      "actorCardIds": [
       5043010
      ],
      "title": "防火牆補素材",
      "description": "Firewall Dragon 特殊召喚手牌 Maliss <P> Chessy Cat 至 M4。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       96676583
      ],
      "costText": "無。",
      "effectText": "其指向的怪獸送墓後，從手牌特殊召喚一隻電子界族。",
      "resultText": "Maliss <P> Chessy Cat 位於 M4；不使用抽牌效果。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "5043010#2"
     },
     {
      "id": "868551e7-3915-4fcf-b1fb-d7122564d311",
      "order": 26,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "連結聯合碼",
      "description": "以 Transcode Talker、Linguriboh 與 Maliss <P> Chessy Cat 連結召喚 Allied Code Talker @Ignister 至 EMZ-L。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       46947713,
       24842059,
       96676583
      ],
      "costText": "三隻效果怪獸，連結值3加1加1。",
      "resultText": "Allied Code Talker @Ignister 與 M2 的 Firewall Dragon 互相連結。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 24842059,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M4"
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
      "id": "391059ee-9cd7-4948-bd47-41878477be66",
      "order": 27,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "建立無效代價",
      "description": "Allied Code Talker @Ignister 復活墓地原攻擊力2300的 Transcode Talker 至 M1。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       46947713
      ],
      "costText": "無。",
      "effectText": "盡可能復活墓地攻擊力2300的電子界族至箭頭區；之後本回合不能特殊召喚。",
      "resultText": "Transcode Talker 位於 M1，可作為無效效果的解放代價；Allied Code Talker @Ignister 增加500攻擊力。",
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
      "note": "EMZ-L；指向 M1、M2、M3，優先解放 M1 的 Transcode Talker 發動一次無效並除外。"
     },
     {
      "cardId": 5043010,
      "zone": "場上",
      "count": 1,
      "note": "M2；與 EMZ-L 的 Allied Code Talker @Ignister、M3 的 Maliss <Q> White Binder 互相連結，可一次指定最多兩隻怪獸彈回。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M3；維持 Firewall Dragon 的第二組互相連結，下一己方主要階段可再蓋放本家陷阱。"
     },
     {
      "cardId": 46947713,
      "zone": "場上",
      "count": 1,
      "note": "M1；供 Allied Code Talker @Ignister 解放，解放它不減少 Firewall Dragon 的互相連結數。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "保留本家資源。"
     },
     {
      "cardId": 30118811,
      "zone": "除外",
      "count": 1,
      "note": "由 Maliss <Q> White Binder 除外。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "復活後作為素材離場而除外。"
     },
     {
      "cardId": 94722358,
      "zone": "墓地",
      "count": 1,
      "note": "本回合已發動；可作後續蓋放資源。"
     },
     {
      "cardId": 20726052,
      "zone": "墓地",
      "count": 1,
      "note": "本回合已發動；可作後續蓋放資源。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "指定起手的副本，最終作為連結素材送墓。"
     },
     {
      "cardId": 3723262,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 59859086,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 24842059,
      "zone": "墓地",
      "count": 1,
      "note": "本回合未使用墓地復活效果；對手回合可解放額外牌組召喚的 Allied Code Talker @Ignister 復活，但會犧牲核心終場。"
     },
     {
      "cardId": 96676583,
      "zone": "墓地",
      "count": 1,
      "note": "由 Firewall Dragon 特殊召喚後作為素材。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      32061192,
      30118811,
      20938824
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應；另外兩張起手不使用。",
      "所有 requiredInMain 組件仍在牌組；起始生命值為8000。",
      "Maliss <Q> White Binder 的選擇性抽牌不使用。",
      "墓地復活的連結怪獸放主怪獸區，不需連結箭頭；本路線的額外牌組連結召喚均使用空出的額外怪獸區或有效箭頭區。"
     ],
     "pros": [
      "兩張偏好怪獸共存；一次無效與一次最多彈回兩隻怪獸，並非兩次獨立彈回。",
      "優先解放 Transcode Talker 支付無效代價，可保留 Firewall Dragon 的兩組互相連結。",
      "保留 Maliss <Q> White Binder 與兩張墓地陷阱，提供後續資源。",
      "不依賴抽牌結果，也不使用另外兩張起手。"
     ],
     "cons": [
      "展開長，Backup @Ignister、Wizard @Ignister 與兩張本家陷阱均是重要銜接點。",
      "沒有蓋放陷阱留在終場；Maliss <Q> White Binder 本身不算對手回合即時干擾。",
      "Firewall Dragon 的彈回數取決於處理前仍存在的互相連結，不能把 Link Rating 當作干擾數。",
      "本路線支付1800生命值；指定牌組組件上手會改變手牌丟棄與檢索安排。"
     ],
     "combo": {
      "required": [
       32061192,
       30118811,
       20938824
      ],
      "alternatives": [
       {
        "cardId": 32061192,
        "instead": [
         75500286,
         68337209
        ],
        "note": "可提供牌組除外啟動，但不直接保證本路線的素材數與通常召喚配置；僅為角色替代標籤。"
       },
       {
        "cardId": 30118811,
        "instead": [],
        "note": "指定三卡內沒有可直接替代其手牌特殊召喚、檢索與丟棄功能的卡。"
       },
       {
        "cardId": 20938824,
        "instead": [],
        "note": "此線同時利用其被除外時回收自身及手牌特殊召喚，沒有直接替代卡。"
       }
      ],
      "extenders": [
       75500286,
       68337209
      ],
      "avoidInHand": [
       69272449,
       3723262,
       94722358,
       20726052,
       96676583
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "9b3102cf-1448-4685-a4c0-ac59d65a7c84",
    "version": 1,
    "name": "聯合碼與紅心除外",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應；另外兩張起手不使用。\n所有 requiredInMain 組件仍在牌組；起始生命值為8000。\n不使用 Maliss <Q> White Binder 的選擇性抽牌。\n保留除外的 Maliss <P> White Rabbit，供 Maliss <Q> Hearts Crypter 在對手回合指定。",
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
      },
      {
       "anyOf": [
        20938824
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
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      },
      {
       "cardId": 96676583,
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
       "cardId": 59859086,
       "count": 1
      },
      {
       "cardId": 46947713,
       "count": 1
      },
      {
       "cardId": 21848500,
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
      "id": "43908855-df3f-430a-91f7-ee8c969a6e6c",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse 至 M1。",
      "fromZone": "手牌",
      "toZone": "場上",
      "costText": "使用本回合通常召喚。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
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
      "id": "939278c2-8e46-43bc-9105-9529887bdf00",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外白兔",
      "description": "Maliss <P> Dormouse 從牌組除外 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "costText": "無。",
      "effectText": "從牌組除外一隻 Maliss 怪獸；本回合己方 Maliss 怪獸增加600攻擊力。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "e421b945-1bec-41ea-8185-3cae1e6edeff",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔返回",
      "description": "Maliss <P> White Rabbit 使用除外誘發效果，特殊召喚至 M3。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於 M3。",
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
      "id": "7c6c4a90-b5a9-47f4-afa1-67c3a90e5772",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "蓋放檢索陷阱",
      "description": "Maliss <P> White Rabbit 從牌組蓋放 Maliss <C> MTP-07 至 S1。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "costText": "無。",
      "effectText": "蓋放與墓地卡名不同的 Maliss 陷阱。",
      "resultText": "S1 有蓋放的 Maliss <C> MTP-07。",
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
      "id": "2e7a3ac4-f42b-4fd5-8bc2-de5c193f0c02",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "連結解碼",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder 至 EMZ-L。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "costText": "一隻等級4以下電子界族。",
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
      "id": "adffb7b7-92d0-4c0a-8d46-d81f880aff17",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "後援登場",
      "description": "因控制額外牌組特召的電子界族，特殊召喚 Backup @Ignister 至 M4。",
      "fromZone": "手牌",
      "toZone": "場上",
      "costText": "無。",
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "Backup @Ignister 位於 M4。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "c10c8343-3bcf-4ce2-8e57-33cb7cb0be0d",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索復活組件",
      "description": "Backup @Ignister 檢索 Wizard @Ignister，再丟棄指定起手的 Maliss <P> March Hare。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       20938824
      ],
      "costText": "無；丟棄是效果處理。",
      "effectText": "加入一隻非同名闇屬性電子界族，再丟棄一張手牌。",
      "resultText": "Wizard @Ignister 在手；Maliss <P> March Hare 在墓地。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "dfac6de9-1beb-4f82-90ff-30db41812247",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "雙體特殊召喚",
      "description": "Wizard @Ignister 指定墓地 Maliss <P> Dormouse，同時特殊召喚兩者。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "costText": "無。",
      "effectText": "自身與指定怪獸以守備表示特殊召喚；之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M5，Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "5426ce4e-a6d5-4eb5-8021-9ada9a571bb8",
      "order": 9,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "連結白色綁定",
      "description": "以 Link Decoder、Backup @Ignister 與 Maliss <P> White Rabbit 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       30118811,
       69272449
      ],
      "costText": "三個連結值，且包含 Maliss 怪獸。",
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 69272449,
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
      "id": "0f4e72a3-7948-432e-a383-472b3d2f8473",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "解碼復活",
      "description": "Link Decoder 因作為原攻擊力2300的電子界族連結素材而复活至 M2。",
      "fromZone": "墓地",
      "toZone": "場上",
      "costText": "無。",
      "effectText": "特殊召喚自身；離場時除外。",
      "resultText": "Link Decoder 位於 M2。",
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
      "id": "e5f1b445-0f2f-4ce9-97d6-d01e74ad077d",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外並回收準備",
      "description": "Maliss <Q> White Binder 除外墓地 Maliss <P> March Hare 與 Backup @Ignister。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824,
       30118811
      ],
      "costText": "無。",
      "effectText": "指定並除外最多三張墓地卡。",
      "resultText": "兩張指定卡被除外；Maliss <P> White Rabbit 留在墓地。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 30118811,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "7c3820b6-571a-4067-9eb7-8bf73891c9c3",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "回收三月兔",
      "description": "Maliss <P> March Hare 的除外誘發效果指定自身，將自身加入手牌。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       20938824
      ],
      "costText": "支付300生命值。",
      "effectText": "將一隻己方除外的 Maliss 怪獸加入手牌。",
      "resultText": "指定起手的 Maliss <P> March Hare 回到手牌。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "a80cc92f-be0a-4003-8f62-8de171e652fd",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "蓋放復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組蓋放 Maliss <C> GWC-06 至 S2。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "costText": "無。",
      "effectText": "從牌組或墓地蓋放一張 Maliss 陷阱。",
      "resultText": "S2 有蓋放的 Maliss <C> GWC-06。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "4b47f19c-817e-4376-9054-3fd8ebbf69a9",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "三月兔延伸",
      "description": "Maliss <P> March Hare 除外墓地 Maliss <P> White Rabbit，再特殊召喚至 M4。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       69272449
      ],
      "costText": "無；除外是效果處理。",
      "effectText": "除外另一張手牌或墓地 Maliss 卡，成功後特殊召喚自身。",
      "resultText": "Maliss <P> White Rabbit 留在除外區，供終場使用。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "b88938a3-949f-4188-b78f-a023cd2c75ac",
      "order": 15,
      "actionType": "link-summon",
      "actorCardIds": [
       59859086
      ],
      "title": "連結飛濺法師",
      "description": "將 Maliss <Q> White Binder 視為一個素材值，與 Wizard @Ignister 連結召喚 Splash Mage。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       3723262
      ],
      "costText": "兩隻電子界族，連結值合計2。",
      "resultText": "Splash Mage 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 59859086,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "6f71f0b9-86af-47e5-a139-0b21c3ca2328",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       59859086
      ],
      "title": "法師復活素材",
      "description": "Splash Mage 指定墓地 Wizard @Ignister，復活至 M5。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       3723262
      ],
      "costText": "無。",
      "effectText": "以守備表示復活電子界族，效果無效；之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M5，效果無效。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "59859086#1"
     },
     {
      "id": "b83f5353-f6c2-4a05-b17d-c252c3a2bf43",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       20726052
      ],
      "title": "陷阱復活綁定",
      "description": "除外 M1 的 Maliss <P> Dormouse，當回合發動 Maliss <C> GWC-06，復活 Maliss <Q> White Binder。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       95454996
      ],
      "costText": "為當回合發動蓋放陷阱，除外場上 Maliss <P> Dormouse。",
      "effectText": "特殊召喚墓地 Maliss <Q> White Binder 至 M3；處理時尚未控制 Maliss 連結怪獸，不計回血。",
      "resultText": "Maliss <Q> White Binder 位於 M3；陷阱進墓地。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 20726052,
        "from": "field",
        "to": "gy",
        "slot": "S2"
       }
      ],
      "effectRef": "20726052#1"
     },
     {
      "id": "20a65fa3-86e4-423e-b8e2-24f666f98ddf",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "睡鼠返回",
      "description": "Maliss <P> Dormouse 使用除外誘發效果，返回 M1。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "ea6b7553-8add-44b5-bc7d-8581c59f6298",
      "order": 19,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "檢索後續資源",
      "description": "除外 M3 的 Maliss <Q> White Binder，當回合發動 Maliss <C> MTP-07，檢索 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "為當回合發動蓋放陷阱，除外場上 Maliss <Q> White Binder。",
      "effectText": "從牌組加入一隻 Maliss 怪獸；此時不控制 Maliss 連結怪獸，不處理追加除外。",
      "resultText": "Maliss <P> Chessy Cat 留在手牌作為後續資源；陷阱進墓地。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "M3"
       },
       {
        "cardId": 96676583,
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
      "id": "c1ba14b3-4ce6-4adc-9727-284ca130bb2b",
      "order": 20,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "綁定返回",
      "description": "Maliss <Q> White Binder 使用除外誘發效果，返回 M3；不進行選擇性抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付900生命值。",
      "effectText": "特殊召喚自身，之後可以抽一張；本路線不抽。",
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
      "id": "ebb886f7-e446-401d-a9a0-37c654832d05",
      "order": 21,
      "actionType": "link-summon",
      "actorCardIds": [
       46947713
      ],
      "title": "連結轉碼",
      "description": "以 Splash Mage 與 Link Decoder 連結召喚 Transcode Talker 至 EMZ-L。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       30342076
      ],
      "costText": "兩隻效果怪獸，連結值2加1。",
      "resultText": "Transcode Talker 位於 EMZ-L；Link Decoder 因離場除外。",
      "moves": [
       {
        "cardId": 59859086,
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
        "cardId": 46947713,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "a921734d-8de8-4d58-8755-a9bd8743fe68",
      "order": 22,
      "actionType": "activate",
      "actorCardIds": [
       46947713
      ],
      "title": "轉碼復活法師",
      "description": "Transcode Talker 復活 Splash Mage 至下箭頭指向的 M2。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       59859086
      ],
      "costText": "無。",
      "effectText": "復活連結3以下電子界族連結怪獸至箭頭區；本回合不能有非電子界族特殊召喚。",
      "resultText": "Splash Mage 位於 M2。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "gy",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "46947713#1"
     },
     {
      "id": "ff84c407-48d7-4785-8619-e4b5ed37bd1f",
      "order": 23,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "連結紅心",
      "description": "將 Splash Mage 視為一個素材值，與 Maliss <P> March Hare、Wizard @Ignister 連結召喚 Maliss <Q> Hearts Crypter 至 M2。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       20938824,
       3723262
      ],
      "costText": "恰好三隻怪獸，連結值1加1加1，且包含 Maliss 怪獸。",
      "resultText": "Maliss <Q> Hearts Crypter 位於 Transcode Talker 指向的 M2；不使用本回合快速效果。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "field",
        "to": "gy",
        "slot": "M2"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 21848500,
        "from": "extra",
        "to": "field",
        "slot": "M2"
       }
      ]
     },
     {
      "id": "1b369d90-c541-4aed-b7e9-dcb6541fecf7",
      "order": 24,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "連結聯合碼",
      "description": "以 Transcode Talker、視為一個素材值的 Maliss <Q> White Binder，以及 Maliss <P> Dormouse 連結召喚 Allied Code Talker @Ignister。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       46947713,
       95454996,
       32061192
      ],
      "costText": "三隻效果怪獸，連結值3加1加1。",
      "resultText": "Allied Code Talker @Ignister 位於 EMZ-L，與 M2 的 Maliss <Q> Hearts Crypter 互相連結。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
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
        "cardId": 39138610,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "c4d855fb-3a4d-4178-84a7-17400a03c1f3",
      "order": 25,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "復活兩個資源",
      "description": "Allied Code Talker @Ignister 復活 Maliss <Q> White Binder 至 M1，以及 Transcode Talker 至 M3。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       95454996,
       46947713
      ],
      "costText": "無。",
      "effectText": "盡可能復活墓地攻擊力2300的電子界族至箭頭區；之後本回合不能特殊召喚。",
      "resultText": "兩隻均可作無效代價；Allied Code Talker @Ignister 增加1000攻擊力，Maliss <Q> White Binder 的本回合誘發效果已使用。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       },
       {
        "cardId": 46947713,
        "from": "gy",
        "to": "field",
        "slot": "M3"
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
      "note": "EMZ-L；可優先解放 M3 的 Transcode Talker，提供一次無效並除外。"
     },
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "M2；上箭頭指向 Allied Code Talker @Ignister，可指定除外的 Maliss <P> White Rabbit 洗回牌組，再除外場上一張卡；其效果與發動不能被無效。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M1；保留下一己方主要階段的陷阱蓋放能力，也可作無效代價。"
     },
     {
      "cardId": 46947713,
      "zone": "場上",
      "count": 1,
      "note": "M3；供 Allied Code Talker @Ignister 解放，本位置沒有成立其互相連結保護。"
     },
     {
      "cardId": 96676583,
      "zone": "手牌",
      "count": 1,
      "note": "確定檢索的後續資源，不算對手回合干擾。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "Maliss <Q> Hearts Crypter 快速效果的有效指定資源。"
     },
     {
      "cardId": 30118811,
      "zone": "除外",
      "count": 1,
      "note": "不是 Maliss 卡，不能作為 Maliss <Q> Hearts Crypter 的指定資源。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "不是 Maliss 卡，不能作為 Maliss <Q> Hearts Crypter 的指定資源。"
     },
     {
      "cardId": 94722358,
      "zone": "墓地",
      "count": 1,
      "note": "可作後續蓋放資源。"
     },
     {
      "cardId": 20726052,
      "zone": "墓地",
      "count": 1,
      "note": "可作後續蓋放資源。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "指定起手的副本，最終作為連結素材送墓。"
     },
     {
      "cardId": 3723262,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 59859086,
      "zone": "墓地",
      "count": 1,
      "note": "连結素材。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      32061192,
      30118811,
      20938824
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應；另外兩張起手不使用。",
      "所有 requiredInMain 組件仍在牌組；起始生命值為8000。",
      "不使用 Maliss <Q> White Binder 的選擇性抽牌。",
      "保留除外的 Maliss <P> White Rabbit，供 Maliss <Q> Hearts Crypter 在對手回合指定。"
     ],
     "pros": [
      "一次無效並除外，加上一次場上任意卡除外；後者不限怪獸。",
      "Maliss <Q> Hearts Crypter 指向 Allied Code Talker @Ignister，其快速效果與發動不能被無效。",
      "有明確保留的除外 Maliss 資源，沒有把無法支付資源的效果計為干擾。",
      "保留 Maliss <P> Chessy Cat 手牌與 Maliss <Q> White Binder，後續資源較多。"
     ],
     "cons": [
      "此變體不召喚 Firewall Dragon，不能滿足兩張偏好怪獸共存。",
      "只有一張除外 Maliss 資源；若先被移走，Maliss <Q> Hearts Crypter 無法按原計畫發動。",
      "Allied Code Talker @Ignister 離場後，Maliss <Q> Hearts Crypter 不再由上箭頭指向怪獸，失去不可無效條件。",
      "兩張本家陷阱都用於展開，終場沒有蓋放陷阱；本路線支付1800生命值。"
     ],
     "combo": {
      "required": [
       32061192,
       30118811,
       20938824
      ],
      "alternatives": [
       {
        "cardId": 32061192,
        "instead": [
         75500286,
         68337209
        ],
        "note": "可提供牌組除外啟動，但需另行重算通常召喚與素材配置；僅為角色替代標籤。"
       },
       {
        "cardId": 30118811,
        "instead": [],
        "note": "没有直接替代其特殊召喚、檢索與丟棄三項功能的單卡。"
       },
       {
        "cardId": 20938824,
        "instead": [],
        "note": "本線利用自身回收與手牌特殊召喚兩項效果，沒有直接替代卡。"
       }
      ],
      "extenders": [
       75500286,
       68337209
      ],
      "avoidInHand": [
       69272449,
       3723262,
       94722358,
       20726052,
       96676583
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "3fb4f083-31c6-4d81-a4a9-288f82d3ebd8",
    "version": 1,
    "name": "Firewall 互相連結",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上沒有卡，對手不回應。\n其餘三張起手不參與展開，也不作為捨棄代價。\n所列牌組組件仍在牌組；所有同名效果尚未使用。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        68337209
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
       "cardId": 32061192,
       "count": 1
      },
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
      "id": "4b09e1d0-0702-4743-8950-a3a5ab3bda54",
      "order": 1,
      "actionType": "activate",
      "actorCardIds": [
       68337209
      ],
      "title": "場地除外",
      "description": "發動 Maliss in Underground，除外牌組的 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "發動時除外一張「Maliss」卡。",
      "resultText": "場地留場，Maliss <P> Dormouse 被除外。",
      "moves": [
       {
        "cardId": 68337209,
        "from": "hand",
        "to": "field",
        "slot": "FZ"
       },
       {
        "cardId": 32061192,
        "from": "deck",
        "to": "banished"
       }
      ],
      "effectRef": "68337209#1"
     },
     {
      "id": "0edb91c3-ba5c-4904-94a8-6d41e69a8cf0",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外後返回",
      "description": "使用 Maliss <P> Dormouse 的除外效果特殊召喚自身。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "02348890-be5c-497b-b16c-81956b5a8f35",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外另一素材",
      "description": "Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外牌組一隻「Maliss」怪獸，本回合己方「Maliss」怪獸增加600 ATK。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "65a42e79-9b86-4558-9fd8-92456b5af441",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "第二隻返回",
      "description": "使用 Maliss <P> White Rabbit 的除外效果特殊召喚自身。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       69272449
      ],
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於 M3。",
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
      "id": "000970e9-cd5f-4dee-b4f3-b296d80f62c0",
      "order": 5,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "覆蓋檢索陷阱",
      "description": "Maliss <P> White Rabbit 從牌組覆蓋 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "覆蓋一張與墓地卡片名稱不同的「Maliss」陷阱。",
      "resultText": "Maliss <C> MTP-07 覆蓋於 S1。",
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
      "id": "8c721037-0f5f-4bd0-a2bf-a47568ca2a44",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "取得捨棄資源",
      "description": "除外 Maliss <P> White Rabbit，發動剛覆蓋的 Maliss <C> MTP-07，檢索 Maliss <P> March Hare。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       20938824
      ],
      "costText": "為在覆蓋當回合發動，除外 M3 的 Maliss <P> White Rabbit。",
      "effectText": "加入一隻「Maliss」怪獸；目前沒有本家連結怪獸，不適用後段除外。",
      "resultText": "取得 Maliss <P> March Hare；Maliss <P> White Rabbit 本回合的返回效果已用過。",
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
      "id": "f50d0808-07b6-4575-a6ac-a94d7f3bed54",
      "order": 7,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "建立額外怪獸",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "costText": "使用一隻等級4以下電子界族。",
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
      "id": "b85bc208-c5ed-4623-a6df-623b089c93b9",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "追加手牌素材",
      "description": "控制從額外牌組特殊召喚的電子界族，特殊召喚 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       30118811
      ],
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "Backup @Ignister 位於 M1。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "1badd473-7e3f-45d2-8ef6-c6d46f0bd94a",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索並捨棄",
      "description": "Backup @Ignister 檢索 Wizard @Ignister，接著捨棄 Maliss <P> March Hare。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       20938824
      ],
      "effectText": "加入一隻其他闇屬性電子界族，之後捨棄一張手牌。",
      "resultText": "Wizard @Ignister 在手牌，Maliss <P> March Hare 在墓地。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "27a0ce43-2d94-4308-80c3-a8a9acc4c18d",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "同時追加兩體",
      "description": "Wizard @Ignister 指定墓地的 Maliss <P> Dormouse，特殊召喚兩者。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "兩者守備表示特殊召喚；本回合之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M4，Maliss <P> Dormouse 位於 M2。",
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
        "slot": "M2"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "b82304ea-a1f8-40c6-bf55-2edc685927e5",
      "order": 11,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "建立本家連結",
      "description": "以 Link Decoder、Backup @Ignister 與 Maliss <P> Dormouse 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       30118811,
       32061192
      ],
      "costText": "三者各計為一個連結素材，包含「Maliss」怪獸。",
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "6615783f-cc4c-4db5-bab7-39253180d0c0",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收墓地素材",
      "description": "Link Decoder 因成為原始攻擊力2300的電子界族連結素材，特殊召喚自身。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       30342076
      ],
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "Link Decoder 位於 M1，帶有離場除外處理。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "743815ed-ad08-4d40-b522-63704b0e62db",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外手牌資源",
      "description": "Maliss <Q> White Binder 的特殊召喚效果只指定墓地的 Maliss <P> March Hare。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824
      ],
      "effectText": "除外指定的墓地卡片。",
      "resultText": "Maliss <P> March Hare 被除外。",
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
      "id": "22c91dca-9e91-4f70-9c86-f738aec78b5e",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "取回自身",
      "description": "Maliss <P> March Hare 的除外效果指定自身，將自身加入手牌。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       20938824
      ],
      "costText": "支付300 LP。",
      "effectText": "將一隻己方除外的「Maliss」怪獸加入手牌。",
      "resultText": "Maliss <P> March Hare 回到手牌。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "26281a2b-7522-4b3b-852b-83759077f179",
      "order": 15,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "以陷阱換素材",
      "description": "Maliss <P> March Hare 除外墓地的 Maliss <C> MTP-07，特殊召喚自身。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "除外另一張手牌或墓地的「Maliss」卡，成功後特殊召喚自身。",
      "resultText": "Maliss <P> March Hare 位於 M5，Maliss <C> MTP-07 被除外。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "f0dadc79-89c8-4ef7-b714-e03eaed231f9",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "覆蓋復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組覆蓋 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "從牌組或墓地覆蓋一張「Maliss」陷阱。",
      "resultText": "Maliss <C> GWC-06 覆蓋於 S1。",
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
      "id": "cfc9dd4a-3fca-4bfa-bf2c-0d35664cca52",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       20726052
      ],
      "title": "騰出額外區",
      "description": "除外 Maliss <Q> White Binder，發動 Maliss <C> GWC-06，特殊召喚墓地的 Maliss <P> Dormouse。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       32061192
      ],
      "costText": "為在覆蓋當回合發動，除外 EMZ-L 的 Maliss <Q> White Binder。",
      "effectText": "特殊召喚一隻墓地或除外的「Maliss」怪獸；解決時沒有本家連結怪獸，不回復LP。",
      "resultText": "Maliss <P> Dormouse 位於 M3，額外怪獸區空出。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M3"
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
      "id": "96f7d0d3-9b94-4a82-be3d-0ef9d2bec5b4",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "返回中央主區",
      "description": "Maliss <Q> White Binder 從除外特殊召喚到 M2，選擇不抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "costText": "支付900 LP。",
      "effectText": "特殊召喚自身，之後可以抽一張牌。",
      "resultText": "Maliss <Q> White Binder 位於 M2，其上箭頭指向 EMZ-L。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "95454996#3"
     },
     {
      "id": "3a9cd599-e044-4a25-a1b7-4ba4de509401",
      "order": 19,
      "actionType": "link-summon",
      "actorCardIds": [
       5043010
      ],
      "title": "完成互相連結",
      "description": "以 Link Decoder、Wizard @Ignister、Maliss <P> Dormouse 與 Maliss <P> March Hare 連結召喚 Firewall Dragon。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       3723262,
       32061192,
       20938824
      ],
      "costText": "四者各計為一個連結素材。",
      "resultText": "Firewall Dragon 位於 EMZ-L，與 M2 的 Maliss <Q> White Binder 互相連結。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M1"
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
        "slot": "M3"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M5"
       },
       {
        "cardId": 5043010,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     }
    ],
    "endBoard": [
     {
      "cardId": 5043010,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；與 Maliss <Q> White Binder 互相連結，可指定最多一隻怪獸回手。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M2；下回合可再覆蓋本家陷阱。"
     },
     {
      "cardId": 68337209,
      "zone": "場上",
      "count": 1,
      "note": "FZ；限制對手的攻擊對象。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "本家後續資源。"
     },
     {
      "cardId": 94722358,
      "zone": "除外",
      "count": 1,
      "note": "本家後續資源；目前沒有除外效果可用。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "因離場除外處理而被除外。"
     },
     {
      "cardId": 20726052,
      "zone": "墓地",
      "count": 1,
      "note": "可由 Maliss <Q> White Binder 下回合覆蓋。"
     },
     {
      "cardId": 30118811,
      "zone": "墓地",
      "count": 1,
      "note": "後續電子界族素材。"
     },
     {
      "cardId": 3723262,
      "zone": "墓地",
      "count": 1,
      "note": "變更表示形式不是快速效果，不計為對手回合干擾。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "本家後續資源。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "本家後續資源。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      68337209,
      30118811
     ],
     "preconditions": [
      "先攻第一回合，雙方場上沒有卡，對手不回應。",
      "其餘三張起手不參與展開，也不作為捨棄代價。",
      "所列牌組組件仍在牌組；所有同名效果尚未使用。"
     ],
     "pros": [
      "Firewall Dragon 有一隻互相連結怪獸，提供一次最多一隻怪獸回手的快速效果。",
      "保留 Maliss <Q> White Binder，提供下回合陷阱續航。",
      "未使用通常召喚，也不依賴其餘起手或隨機抽牌。"
     ],
     "cons": [
      "只有一次主要干擾；Maliss <Q> White Binder 沒有對手回合快速除外效果。",
      "移除任一互相連結怪獸後，Firewall Dragon 的回手數量可能降為零。",
      "本家兩隻下級的除外返回效果與多個檢索都是展開關鍵。"
     ],
     "combo": {
      "required": [
       68337209,
       30118811
      ],
      "alternatives": [],
      "extenders": [
       75500286,
       20938824
      ],
      "avoidInHand": [
       32061192,
       69272449,
       94722358,
       20938824,
       3723262,
       20726052
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "c8bafa8a-b240-4bd1-a704-2240b8d663e6",
    "version": 1,
    "name": "Allied 保留無效代價",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上沒有卡，對手不回應。\n其餘三張起手不參與展開，也不作為捨棄代價。\n本回合所有特殊召喚均為電子界族，符合 Transcode Talker 的整回合限制。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        68337209
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
       "cardId": 32061192,
       "count": 1
      },
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
      "id": "5531a874-0c14-4aeb-91aa-8257612194a9",
      "order": 1,
      "actionType": "activate",
      "actorCardIds": [
       68337209
      ],
      "title": "場地除外",
      "description": "發動 Maliss in Underground，除外牌組的 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "發動時除外一張「Maliss」卡。",
      "resultText": "場地留場，Maliss <P> Dormouse 被除外。",
      "moves": [
       {
        "cardId": 68337209,
        "from": "hand",
        "to": "field",
        "slot": "FZ"
       },
       {
        "cardId": 32061192,
        "from": "deck",
        "to": "banished"
       }
      ],
      "effectRef": "68337209#1"
     },
     {
      "id": "005908bf-9e2f-4b58-8e8e-580a8c223a8e",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外後返回",
      "description": "使用 Maliss <P> Dormouse 的除外效果特殊召喚自身。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 位於 M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "2b899746-0113-46c4-b4f0-a860e4d36d86",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外另一素材",
      "description": "Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外牌組一隻「Maliss」怪獸，本回合己方「Maliss」怪獸增加600 ATK。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "7dcc129a-360b-411f-b03e-76978f81cedd",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "第二隻返回",
      "description": "使用 Maliss <P> White Rabbit 的除外效果特殊召喚自身。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       69272449
      ],
      "costText": "支付300 LP。",
      "effectText": "特殊召喚自身，本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於 M3。",
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
      "id": "ee45482d-7729-42be-bdba-62ad2e2564cd",
      "order": 5,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "覆蓋檢索陷阱",
      "description": "Maliss <P> White Rabbit 從牌組覆蓋 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "覆蓋一張與墓地卡片名稱不同的「Maliss」陷阱。",
      "resultText": "Maliss <C> MTP-07 覆蓋於 S1。",
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
      "id": "3178094e-24c6-4b55-80dd-60beaa0361c8",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "取得捨棄資源",
      "description": "除外 Maliss <P> White Rabbit，發動剛覆蓋的 Maliss <C> MTP-07，檢索 Maliss <P> March Hare。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       20938824
      ],
      "costText": "為在覆蓋當回合發動，除外 M3 的 Maliss <P> White Rabbit。",
      "effectText": "加入一隻「Maliss」怪獸；目前沒有本家連結怪獸，不適用後段除外。",
      "resultText": "取得 Maliss <P> March Hare；Maliss <P> White Rabbit 本回合的返回效果已用過。",
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
      "id": "84564b60-c8e1-4ca0-b2ca-95254f1d8364",
      "order": 7,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "建立額外怪獸",
      "description": "以 Maliss <P> Dormouse 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       32061192
      ],
      "costText": "使用一隻等級4以下電子界族。",
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
      "id": "fd88d108-e984-4c4b-96c4-662b1d3ca0c2",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "追加手牌素材",
      "description": "控制從額外牌組特殊召喚的電子界族，特殊召喚 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       30118811
      ],
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "Backup @Ignister 位於 M1。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "b762fa13-7668-44fe-b653-005b15398ab9",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索並捨棄",
      "description": "Backup @Ignister 檢索 Wizard @Ignister，接著捨棄 Maliss <P> March Hare。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       20938824
      ],
      "effectText": "加入一隻其他闇屬性電子界族，之後捨棄一張手牌。",
      "resultText": "Wizard @Ignister 在手牌，Maliss <P> March Hare 在墓地。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "32e2dd2c-bdd0-4c7f-a6c6-1ad2b9c76e32",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "同時追加兩體",
      "description": "Wizard @Ignister 指定墓地的 Maliss <P> Dormouse，特殊召喚兩者。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "兩者守備表示特殊召喚；本回合之後只能特殊召喚電子界族。",
      "resultText": "Wizard @Ignister 位於 M4，Maliss <P> Dormouse 位於 M2。",
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
        "slot": "M2"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "52da7281-6042-4f5c-9a25-b4260a7faeb0",
      "order": 11,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "建立本家連結",
      "description": "以 Link Decoder、Backup @Ignister 與 Maliss <P> Dormouse 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       30118811,
       32061192
      ],
      "costText": "三者各計為一個連結素材，包含「Maliss」怪獸。",
      "resultText": "Maliss <Q> White Binder 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "90453dff-af4a-4918-9a23-da48acb3de3f",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收墓地素材",
      "description": "Link Decoder 因成為原始攻擊力2300的電子界族連結素材，特殊召喚自身。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       30342076
      ],
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "Link Decoder 位於 M1，帶有離場除外處理。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "1ae97ee2-d6bf-4835-9aa8-9e193385b95b",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外手牌資源",
      "description": "Maliss <Q> White Binder 的特殊召喚效果只指定墓地的 Maliss <P> March Hare。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       20938824
      ],
      "effectText": "除外指定的墓地卡片。",
      "resultText": "Maliss <P> March Hare 被除外。",
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
      "id": "1feb4aa6-79a0-4529-998b-4c72296bf320",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "取回自身",
      "description": "Maliss <P> March Hare 的除外效果指定自身，將自身加入手牌。",
      "fromZone": "除外",
      "toZone": "手牌",
      "targetCardIds": [
       20938824
      ],
      "costText": "支付300 LP。",
      "effectText": "將一隻己方除外的「Maliss」怪獸加入手牌。",
      "resultText": "Maliss <P> March Hare 回到手牌。",
      "moves": [
       {
        "cardId": 20938824,
        "from": "banished",
        "to": "hand"
       }
      ],
      "effectRef": "20938824#2"
     },
     {
      "id": "61ac57f9-3bc0-471f-9ab6-251516b0aa49",
      "order": 15,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "以陷阱換素材",
      "description": "Maliss <P> March Hare 除外墓地的 Maliss <C> MTP-07，特殊召喚自身。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "除外另一張手牌或墓地的「Maliss」卡，成功後特殊召喚自身。",
      "resultText": "Maliss <P> March Hare 位於 M5，Maliss <C> MTP-07 被除外。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 20938824,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "e262c98b-fdfb-42a3-97b0-07b05aa3e568",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "覆蓋復活陷阱",
      "description": "Maliss <Q> White Binder 從牌組覆蓋 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "從牌組或墓地覆蓋一張「Maliss」陷阱。",
      "resultText": "Maliss <C> GWC-06 覆蓋於 S1。",
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
      "id": "26d9ff74-5b8f-469b-a21c-dc266b691205",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       20726052
      ],
      "title": "騰出額外區",
      "description": "除外 Maliss <Q> White Binder，發動 Maliss <C> GWC-06，特殊召喚墓地的 Maliss <P> Dormouse。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       32061192
      ],
      "costText": "為在覆蓋當回合發動，除外 EMZ-L 的 Maliss <Q> White Binder。",
      "effectText": "特殊召喚一隻墓地或除外的「Maliss」怪獸；解決時沒有本家連結怪獸，不回復LP。",
      "resultText": "Maliss <P> Dormouse 位於 M2。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M2"
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
      "id": "9661b850-6b70-455e-82ec-c79a2e63b7cd",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "返回右側主區",
      "description": "Maliss <Q> White Binder 從除外特殊召喚到 M3，選擇不抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "costText": "支付900 LP。",
      "effectText": "特殊召喚自身，之後可以抽一張牌。",
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
      "id": "d4f89ab8-e9f2-4d06-9cd7-a10961a06d02",
      "order": 19,
      "actionType": "link-summon",
      "actorCardIds": [
       46947713
      ],
      "title": "建立復活連結",
      "description": "以 Link Decoder、Wizard @Ignister 與 Maliss <P> Dormouse 連結召喚 Transcode Talker。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       3723262,
       32061192
      ],
      "costText": "三者各計為一個連結素材，皆為效果怪獸。",
      "resultText": "Transcode Talker 位於 EMZ-L，M2 空出。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M1"
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
        "slot": "M2"
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
      "id": "9d957836-c004-4c06-b745-f4e93bd961ce",
      "order": 20,
      "actionType": "activate",
      "actorCardIds": [
       46947713
      ],
      "title": "再取本家素材",
      "description": "Transcode Talker 特殊召喚墓地的 Maliss <Q> White Binder 到 M2。",
      "targetCardIds": [
       95454996
      ],
      "effectText": "嘗試將墓地的連結3以下電子界族特殊召喚到箭頭區。",
      "resultText": "此步無法成立：Maliss <Q> White Binder 仍在 M3，不在墓地。",
      "warning": "AI 不確定：目前沒有墓地中的電子界族連結怪獸可供此效果指定；Link Decoder 已因離場處理被除外。",
      "effectRef": "46947713#1",
      "unresolved": "原構想的追加連結素材不存在，因此不發動此效果，改以現有三隻效果怪獸完成下一步。"
     },
     {
      "id": "a3581b80-7319-4e9b-8a78-df8c44bed25e",
      "order": 21,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "完成無效主體",
      "description": "以 Transcode Talker、Maliss <Q> White Binder 與 Maliss <P> March Hare 連結召喚 Allied Code Talker @Ignister。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       46947713,
       95454996,
       20938824
      ],
      "costText": "Transcode Talker 計為3，另兩者各計為1；共三隻效果怪獸。",
      "resultText": "Allied Code Talker @Ignister 位於 EMZ-L。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 20938824,
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
      "id": "647ab248-3015-4be8-80ad-345113c4a68e",
      "order": 22,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "補足無效代價",
      "description": "Allied Code Talker @Ignister 特殊召喚墓地的 Transcode Talker 與 Maliss <Q> White Binder。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       46947713,
       95454996
      ],
      "effectText": "盡可能復活攻擊力2300的電子界族到箭頭區，自身增加1000 ATK，之後本回合不能特殊召喚。",
      "resultText": "Transcode Talker 位於 M1，Maliss <Q> White Binder 位於 M2，均可作為無效代價。",
      "moves": [
       {
        "cardId": 46947713,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       },
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M2"
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
      "note": "EMZ-L；可解放箭頭區的一隻連結怪獸，無效發動並除外，一回合一次。"
     },
     {
      "cardId": 46947713,
      "zone": "場上",
      "count": 1,
      "note": "M1；可作為無效代價，優先保留 Maliss <Q> White Binder。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M2；可作為無效代價，或保留供下回合覆蓋陷阱。"
     },
     {
      "cardId": 68337209,
      "zone": "場上",
      "count": 1,
      "note": "FZ；限制對手的攻擊對象。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "本家後續資源。"
     },
     {
      "cardId": 94722358,
      "zone": "除外",
      "count": 1,
      "note": "本家後續資源。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "不能由 Transcode Talker 的墓地復活效果指定。"
     },
     {
      "cardId": 20726052,
      "zone": "墓地",
      "count": 1,
      "note": "可由 Maliss <Q> White Binder 下回合覆蓋。"
     },
     {
      "cardId": 30118811,
      "zone": "墓地",
      "count": 1,
      "note": "後續電子界族素材。"
     },
     {
      "cardId": 3723262,
      "zone": "墓地",
      "count": 1,
      "note": "變更表示形式不是快速效果，不計為對手回合干擾。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "本家後續資源。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "本家後續資源。"
     }
    ],
    "verification": {
     "status": "draft"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      68337209,
      30118811
     ],
     "preconditions": [
      "先攻第一回合，雙方場上沒有卡，對手不回應。",
      "其餘三張起手不參與展開，也不作為捨棄代價。",
      "本回合所有特殊召喚均為電子界族，符合 Transcode Talker 的整回合限制。"
     ],
     "pros": [
      "提供一次卡片或效果發動無效並除外，適用範圍比怪獸回手更廣。",
      "有兩隻可解放的連結怪獸，使用無效時可保留 Maliss <Q> White Binder。",
      "不依賴 Transcode Talker 的復活效果，也不使用通常召喚。"
     ],
     "cons": [
      "兩個解放選項仍只提供一次無效，不能計為兩次干擾。",
      "Allied Code Talker @Ignister 復活效果解決後，本回合不能再特殊召喚。",
      "沒有留場本家陷阱，也沒有 Maliss <Q> Hearts Crypter 的快速除外。"
     ],
     "combo": {
      "required": [
       68337209,
       30118811
      ],
      "alternatives": [],
      "extenders": [
       75500286,
       20938824
      ],
      "avoidInHand": [
       32061192,
       69272449,
       94722358,
       20938824,
       3723262,
       20726052
      ]
     },
     "check": {
      "passed": false,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": [
       "第 20 步：未完成：原構想的追加連結素材不存在，因此不發動此效果，改以現有三隻效果怪獸完成下一步。"
      ]
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "47c4e424-89f8-4b19-938c-e618ebc1e231",
    "version": 1,
    "name": "Hearts Crypter與本家陷阱",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應。\n其餘四張起手不使用；牌組所需組件仍在牌組。\n起始生命值為8000；全程不依賴抽牌。",
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
       "cardId": 96676583,
       "count": 1
      },
      {
       "cardId": 57111661,
       "count": 1
      },
      {
       "cardId": 94722358,
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
      "id": "e0ac6e3f-c240-463b-a493-9f90b9e9f119",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "Maliss <P> Dormouse 位於M1。",
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
      "id": "cba0e089-b6d4-4c4a-a163-93d161a3ac63",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外牌組怪獸",
      "description": "發動 Maliss <P> Dormouse，除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外一隻本家怪獸；本回合己方本家怪獸攻擊力增加600。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "ae4bbd3b-a15b-4bb6-bbf0-172c249f8efd",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "除外後回場",
      "description": "發動 Maliss <P> White Rabbit 的除外誘發效果。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於M2。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "4c51ba27-0302-40dc-9f02-d20c2002efc1",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "覆蓋展開陷阱",
      "description": "發動 Maliss <P> White Rabbit，從牌組覆蓋 Maliss <C> TB-11。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       57111661
      ],
      "effectText": "覆蓋墓地沒有同名卡的本家陷阱。",
      "resultText": "Maliss <C> TB-11 覆蓋於S1。",
      "moves": [
       {
        "cardId": 57111661,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "69272449#1"
     },
     {
      "id": "951a9791-01cc-476f-a5f9-80dc120f185f",
      "order": 5,
      "actionType": "activate",
      "actorCardIds": [
       57111661
      ],
      "title": "陷阱增加素材",
      "description": "除外 Maliss <P> Dormouse，於覆蓋回合發動 Maliss <C> TB-11，特殊召喚 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "以除外場上 Maliss <P> Dormouse 滿足覆蓋回合發動條件。",
      "effectText": "從牌組特殊召喚本家怪獸；該怪獸本回合不能攻擊或發動效果。",
      "resultText": "Maliss <P> Chessy Cat 位於M3；陷阱送墓。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 96676583,
        "from": "deck",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 57111661,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "57111661#1"
     },
     {
      "id": "b6eefd60-a789-41bd-b1b3-e8710b78678a",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "起手怪獸回場",
      "description": "發動 Maliss <P> Dormouse 的除外誘發效果。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 回到M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "487dc7a5-3b4c-4645-9a9f-600174e7bb20",
      "order": 7,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "製作回收素材",
      "description": "以 Maliss <P> Chessy Cat 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       96676583
      ],
      "costText": "使用一隻等級4以下電子界族怪獸。",
      "resultText": "Link Decoder 位於EMZ-L。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M3"
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
      "id": "26184707-b445-41d0-a3fd-52a12235389d",
      "order": 8,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "連結本家中繼",
      "description": "以 Link Decoder、Maliss <P> Dormouse 與 Maliss <P> White Rabbit 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       32061192,
       69272449
      ],
      "costText": "三個素材各計連結值1，包含本家怪獸。",
      "resultText": "Maliss <Q> White Binder 位於EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 69272449,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "e0f3ddbd-ac82-4abb-b906-94f330ee5f1e",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收連結素材",
      "description": "同一誘發連鎖以 Maliss <Q> White Binder 為連鎖1、Link Decoder 為連鎖2；先處理 Link Decoder 回場。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "作為原攻擊力2300以上電子界族連結怪獸素材送墓後特殊召喚自身。",
      "resultText": "Link Decoder 位於M2，離場時除外。",
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
      "id": "641dce77-276c-49ef-9821-0a84a1b99ea9",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外墓地資源",
      "description": "處理 Maliss <Q> White Binder 的連鎖1，除外墓地三隻本家怪獸。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       32061192,
       69272449,
       96676583
      ],
      "effectText": "除外作為對象的最多三張墓地卡。",
      "resultText": "保留兩張本家除外資源，並準備 Maliss <P> Chessy Cat 回場。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 96676583,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "718983ec-2c01-42ee-b63c-68aeb669f1e1",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       96676583
      ],
      "title": "第三素材回場",
      "description": "發動 Maliss <P> Chessy Cat 的除外誘發效果；離場後已不再是 Maliss <C> TB-11 特殊召喚的場上怪獸。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Chessy Cat 位於M3。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "96676583#2"
     },
     {
      "id": "43372fa6-947a-4d7e-be61-4ab9b194dbc1",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "覆蓋干擾陷阱",
      "description": "發動 Maliss <Q> White Binder，從牌組覆蓋 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "從牌組或墓地覆蓋一張本家陷阱。",
      "resultText": "Maliss <C> MTP-07 覆蓋於S2。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "ca80d377-4af2-4225-996f-8a991db03e22",
      "order": 13,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "完成核心終場",
      "description": "以 Maliss <Q> White Binder、Link Decoder 與 Maliss <P> Chessy Cat 連結召喚 Maliss <Q> Hearts Crypter。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       30342076,
       96676583
      ],
      "costText": "三隻怪獸各計連結值1，包含本家怪獸。",
      "resultText": "Maliss <Q> Hearts Crypter 位於EMZ-L，保留覆蓋陷阱與本家除外資源。",
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
        "cardId": 96676583,
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
     }
    ],
    "endBoard": [
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；有本家除外卡可供快速效果使用，但未指向怪獸，沒有不可無效保障。"
     },
     {
      "cardId": 94722358,
      "zone": "場上",
      "count": 1,
      "note": "S2覆蓋；對手回合可通常發動，檢索後在本家連結怪獸仍在場時除外場上一張卡。"
     },
     {
      "cardId": 32061192,
      "zone": "除外",
      "count": 1,
      "note": "快速效果可回洗的本家資源。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "另一張可回洗的本家資源。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "離場除外，不是本家資源。"
     },
     {
      "cardId": 95454996,
      "zone": "墓地",
      "count": 1,
      "note": "後續可復活的本家連結怪獸。"
     },
     {
      "cardId": 96676583,
      "zone": "墓地",
      "count": 1,
      "note": "後續本家資源。"
     },
     {
      "cardId": 57111661,
      "zone": "墓地",
      "count": 1,
      "note": "已使用的展開陷阱。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      32061192
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應。",
      "其餘四張起手不使用；牌組所需組件仍在牌組。",
      "起始生命值為8000；全程不依賴抽牌。"
     ],
     "pros": [
      "兩項可用干擾：快速效果除外，以及陷阱檢索後除外。",
      "陷阱可檢索牌組中的 Maliss <P> March Hare，增加後續資源。",
      "不使用隨機抽牌；生命值剩7100。"
     ],
     "cons": [
      "終場只有一隻怪獸；本家連結怪獸離場會使陷阱失去除外部分。",
      "快速效果未獲得不可無效保障。",
      "依賴牌組中的單張 Maliss <P> White Rabbit 與 Maliss <P> Chessy Cat。"
     ],
     "combo": {
      "required": [
       32061192
      ],
      "alternatives": [
       {
        "cardId": 32061192,
        "instead": [],
        "note": "此完整流程沒有直接同角色替代起手。"
       }
      ],
      "extenders": [
       30118811,
       3723262,
       20938824
      ],
      "avoidInHand": [
       69272449,
       96676583,
       57111661,
       94722358
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "619a50b6-2293-499f-bdc1-ec5ac4d9e983",
    "version": 1,
    "name": "Allied與White Binder留場",
    "archetype": "Maliss",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應。\n其餘四張起手不使用；牌組所需組件仍在牌組。\n起始生命值為8000；全程不依賴抽牌。",
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
       "cardId": 96676583,
       "count": 1
      },
      {
       "cardId": 57111661,
       "count": 1
      },
      {
       "cardId": 94722358,
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
      "id": "942b50e2-36b8-40e3-b1c4-4a6afa870fe4",
      "order": 1,
      "actionType": "normal-summon",
      "actorCardIds": [
       32061192
      ],
      "title": "通常召喚",
      "description": "通常召喚 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "Maliss <P> Dormouse 位於M1。",
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
      "id": "90af3604-0821-4d2b-b397-e0c3826e40f8",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "除外牌組怪獸",
      "description": "發動 Maliss <P> Dormouse，除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外一隻本家怪獸；本回合己方本家怪獸攻擊力增加600。",
      "resultText": "Maliss <P> White Rabbit 被除外。",
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
      "id": "7e44b0f6-a8f8-4f5c-aad9-0e85c50d3d8f",
      "order": 3,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "除外後回場",
      "description": "發動 Maliss <P> White Rabbit 的除外誘發效果。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> White Rabbit 位於M2。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "c639e317-a389-4351-9659-d60e38f28f6b",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "覆蓋展開陷阱",
      "description": "發動 Maliss <P> White Rabbit，從牌組覆蓋 Maliss <C> TB-11。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       57111661
      ],
      "effectText": "覆蓋墓地沒有同名卡的本家陷阱。",
      "resultText": "Maliss <C> TB-11 覆蓋於S1。",
      "moves": [
       {
        "cardId": 57111661,
        "from": "deck",
        "to": "field",
        "slot": "S1"
       }
      ],
      "effectRef": "69272449#1"
     },
     {
      "id": "b65845c9-fcaf-4757-980d-db71b43ae999",
      "order": 5,
      "actionType": "activate",
      "actorCardIds": [
       57111661
      ],
      "title": "陷阱增加素材",
      "description": "除外 Maliss <P> Dormouse，於覆蓋回合發動 Maliss <C> TB-11，特殊召喚 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "以除外場上 Maliss <P> Dormouse 滿足覆蓋回合發動條件。",
      "effectText": "從牌組特殊召喚本家怪獸；該怪獸本回合不能攻擊或發動效果。",
      "resultText": "Maliss <P> Chessy Cat 位於M3；陷阱送墓。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 96676583,
        "from": "deck",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 57111661,
        "from": "field",
        "to": "gy",
        "slot": "S1"
       }
      ],
      "effectRef": "57111661#1"
     },
     {
      "id": "731caf28-fc66-44dc-ac17-5f9a8e952469",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "起手怪獸回場",
      "description": "發動 Maliss <P> Dormouse 的除外誘發效果。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Dormouse 回到M1。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "e8076f0e-acaf-4294-850e-67cd90029dda",
      "order": 7,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "製作回收素材",
      "description": "以 Maliss <P> Chessy Cat 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       96676583
      ],
      "costText": "使用一隻等級4以下電子界族怪獸。",
      "resultText": "Link Decoder 位於EMZ-L。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M3"
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
      "id": "b341723e-5765-4af1-b087-3ff39bc42726",
      "order": 8,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "連結本家中繼",
      "description": "以 Link Decoder、Maliss <P> Dormouse 與 Maliss <P> White Rabbit 連結召喚 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       32061192,
       69272449
      ],
      "costText": "三個素材各計連結值1，包含本家怪獸。",
      "resultText": "Maliss <Q> White Binder 位於EMZ-L。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 69272449,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "51d6fb02-35fe-4ca9-b38f-afb24ae7e88e",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收連結素材",
      "description": "同一誘發連鎖以 Maliss <Q> White Binder 為連鎖1、Link Decoder 為連鎖2；先處理 Link Decoder 回場。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "作為原攻擊力2300以上電子界族連結怪獸素材送墓後特殊召喚自身。",
      "resultText": "Link Decoder 位於M2，離場時除外。",
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
      "id": "69eee4b1-f701-4bac-be35-e28121363484",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "除外墓地資源",
      "description": "處理 Maliss <Q> White Binder 的連鎖1，除外墓地三隻本家怪獸。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       32061192,
       69272449,
       96676583
      ],
      "effectText": "除外作為對象的最多三張墓地卡。",
      "resultText": "三隻本家怪獸被除外；準備 Maliss <P> Chessy Cat 回場。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       },
       {
        "cardId": 96676583,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "b1be58ef-170d-468d-8666-a5686861f03a",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       96676583
      ],
      "title": "第三素材回場",
      "description": "發動 Maliss <P> Chessy Cat 的除外誘發效果；離場後已不再是 Maliss <C> TB-11 特殊召喚的場上怪獸。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "Maliss <P> Chessy Cat 位於M3。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "banished",
        "to": "field",
        "slot": "M3"
       }
      ],
      "effectRef": "96676583#2"
     },
     {
      "id": "abf0fbdd-56ca-47f7-bf6e-3ceb355fa342",
      "order": 12,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "覆蓋干擾陷阱",
      "description": "發動 Maliss <Q> White Binder，從牌組覆蓋 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "從牌組或墓地覆蓋一張本家陷阱。",
      "resultText": "Maliss <C> MTP-07 覆蓋於S2。",
      "moves": [
       {
        "cardId": 94722358,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "85b28cbd-abf1-41c2-b0b2-191278382a5f",
      "order": 13,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "連結偏好怪獸",
      "description": "以 Maliss <Q> White Binder、Link Decoder 與 Maliss <P> Chessy Cat 連結召喚 Allied Code Talker @Ignister。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       95454996,
       30342076,
       96676583
      ],
      "costText": "三隻效果怪獸；連結值分別計3、1、1。",
      "resultText": "Allied Code Talker @Ignister 位於EMZ-L。",
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
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M3"
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
      "id": "6e34b06f-6539-4e1e-920e-ec8b28320c00",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "復活解放素材",
      "description": "發動 Allied Code Talker @Ignister，特殊召喚墓地原攻擊力2300的 Maliss <Q> White Binder。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "effectText": "特殊召喚至自身箭頭所指區域，自身攻擊力增加500；本回合不能再特殊召喚。",
      "resultText": "Maliss <Q> White Binder 位於M2，可供快速效果解放；其墓地除外效果本回合已使用。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "gy",
        "to": "field",
        "slot": "M2"
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
      "note": "EMZ-L；指向M2的本家連結怪獸，可解放它使一次發動無效並除外。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M2；提供解放素材與本家陷阱的除外條件，不把墓地除外效果另計為對手回合干擾。"
     },
     {
      "cardId": 94722358,
      "zone": "場上",
      "count": 1,
      "note": "S2覆蓋；在本家連結怪獸仍在場時可檢索並除外場上一張卡。"
     },
     {
      "cardId": 32061192,
      "zone": "除外",
      "count": 1,
      "note": "後續本家資源。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "後續本家資源。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "離場除外。"
     },
     {
      "cardId": 96676583,
      "zone": "墓地",
      "count": 1,
      "note": "後續本家資源。"
     },
     {
      "cardId": 57111661,
      "zone": "墓地",
      "count": 1,
      "note": "已使用的展開陷阱。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      32061192
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應。",
      "其餘四張起手不使用；牌組所需組件仍在牌組。",
      "起始生命值為8000；全程不依賴抽牌。"
     ],
     "pros": [
      "保留偏好怪獸，且具備實際可解放的連結怪獸。",
      "可提供一次發動無效及一次陷阱除外，涵蓋不同干擾類型。",
      "保留 Maliss <Q> White Binder 時，下回合仍可覆蓋本家陷阱。"
     ],
     "cons": [
      "應先讓陷阱的除外部分處理完成，再解放唯一的本家連結怪獸。",
      "若先使用發動無效，陷阱通常只剩檢索，不能把兩次干擾視為完全獨立。",
      "終場特殊召喚封鎖使本回合不能再用追加手牌延伸。"
     ],
     "combo": {
      "required": [
       32061192
      ],
      "alternatives": [
       {
        "cardId": 32061192,
        "instead": [],
        "note": "此完整流程沒有直接同角色替代起手。"
       }
      ],
      "extenders": [
       30118811,
       3723262,
       20938824
      ],
      "avoidInHand": [
       69272449,
       96676583,
       57111661,
       94722358
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "9dfb6344-bf49-4c3a-a005-0013e1491e30",
    "version": 1,
    "name": "保留回手與快速除外",
    "archetype": "Radiant Typhoon",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應；其餘兩張手牌不使用。\n列出的牌組元件仍在牌組；起始生命值足以支付合計1500點。\n不使用 Transcode Talker 的復活效果，也不依賴任何隨機抽牌。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        54143349
       ],
       "count": 1
      },
      {
       "anyOf": [
        20938824
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
       "cardId": 80538047,
       "count": 1
      },
      {
       "cardId": 67115133,
       "count": 1
      },
      {
       "cardId": 32061192,
       "count": 1
      },
      {
       "cardId": 69272449,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      },
      {
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 96676583,
       "count": 1
      }
     ],
     "mustExistInExtra": [
      {
       "cardId": 58699500,
       "count": 1
      },
      {
       "cardId": 30342076,
       "count": 1
      },
      {
       "cardId": 95454996,
       "count": 1
      },
      {
       "cardId": 59859086,
       "count": 1
      },
      {
       "cardId": 5043010,
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
      "id": "77491ad9-c983-4132-b572-7e587324e3b8",
      "order": 1,
      "actionType": "special-summon",
      "actorCardIds": [
       54143349
      ],
      "title": "先放風素材",
      "description": "對手沒有魔法、陷阱，特殊召喚 Radiant Typhoon Eldam。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "依自身特殊召喚條件出場。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 54143349,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "0d0d01bb-46f2-48ce-819f-50ed49490901",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       54143349
      ],
      "title": "檢索第二素材",
      "description": "發動 Radiant Typhoon Eldam 的召喚誘發效果。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       80538047
      ],
      "effectText": "加入 Radiant Typhoon Swen。",
      "resultText": "取得第二隻等級3怪獸。",
      "moves": [
       {
        "cardId": 80538047,
        "from": "deck",
        "to": "hand"
       }
      ],
      "effectRef": "54143349#1"
     },
     {
      "id": "fa95f178-e2cb-4b94-b0ab-467557a47e77",
      "order": 3,
      "actionType": "special-summon",
      "actorCardIds": [
       80538047
      ],
      "title": "補第二素材",
      "description": "對手仍沒有魔法、陷阱，特殊召喚 Radiant Typhoon Swen。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "依自身特殊召喚條件出場。",
      "resultText": "位於M3。",
      "moves": [
       {
        "cardId": 80538047,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       }
      ]
     },
     {
      "id": "36be788a-18e8-4b33-ac70-9a4058ab65d6",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       80538047
      ],
      "title": "備妥丟棄資源",
      "description": "以 Radiant Typhoon Swen 檢索 Radiant Typhoon Chant。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       67115133
      ],
      "effectText": "加入本家魔法。",
      "resultText": "保留給 Backup @Ignister 丟棄。",
      "moves": [
       {
        "cardId": 67115133,
        "from": "deck",
        "to": "hand"
       }
      ],
      "effectRef": "80538047#1"
     },
     {
      "id": "641ab9a5-0fd6-46ba-bfe7-af39ebcd28fd",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       58699500
      ],
      "title": "製作墓地入口",
      "description": "使用兩隻等級3怪獸連結召喚 Cherubini, Ebon Angel of the Burning Abyss。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       54143349,
       80538047
      ],
      "resultText": "位於EMZ-L，開放M1與M3。",
      "moves": [
       {
        "cardId": 54143349,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 80538047,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 58699500,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "bfebcfb9-18bb-4c8b-92ed-38453ecb761d",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       58699500
      ],
      "title": "送墓本家",
      "description": "以 Cherubini, Ebon Angel of the Burning Abyss 自身為對象，送墓 Maliss <P> Dormouse。",
      "fromZone": "牌組",
      "toZone": "墓地",
      "targetCardIds": [
       58699500
      ],
      "costText": "從牌組送墓1隻等級3怪獸。",
      "effectText": "自身本回合增加900攻擊力與300守備力。",
      "resultText": "墓地備妥 Maliss <P> Dormouse。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "deck",
        "to": "gy"
       }
      ],
      "effectRef": "58699500#1"
     },
     {
      "id": "3a9c5741-9dc5-4582-84d9-9f8509bfe802",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "手牌除外轉場",
      "description": "發動手牌 Maliss <P> March Hare，除外墓地 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "除外另一張本家卡後特殊召喚自身。",
      "resultText": "Maliss <P> March Hare 位於M3。",
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
        "slot": "M3"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "3f3db2d5-4987-473c-af30-4773ac382a41",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "復活送墓資源",
      "description": "發動被除外的 Maliss <P> Dormouse。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300點生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "位於M2。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "f266db84-afa9-49cf-8f57-39674fa141c3",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "從牌組除外",
      "description": "以 Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外1隻本家怪獸，本回合本家怪獸增加600攻擊力。",
      "resultText": "觸發 Maliss <P> White Rabbit。",
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
      "id": "15558971-9851-4765-ae7e-c4f9007c93ef",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔出場",
      "description": "發動被除外的 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300點生命值。",
      "effectText": "特殊召喚自身並套用額外牌組連結限制。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "efb40f58-2f3e-4045-8b87-9bfa8efe16df",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "取得檢索陷阱",
      "description": "以 Maliss <P> White Rabbit 蓋牌組的 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "覆蓋墓地沒有同名卡的本家陷阱。",
      "resultText": "覆蓋於S1。",
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
      "id": "232c6446-486c-4b56-aeaf-b8c9a26a21e5",
      "order": 12,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "建立電子界入口",
      "description": "以 Maliss <P> White Rabbit 連結召喚 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       69272449
      ],
      "resultText": "位於 Cherubini, Ebon Angel of the Burning Abyss 指向的M1。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 30342076,
        "from": "extra",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "0d9b7de6-5bb2-4f18-8b73-7377a48d1f17",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "追加手牌素材",
      "description": "控制從額外牌組特殊召喚的電子界怪獸，發動 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "位於M4。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "75126262-b42d-4f69-8fe8-22649c152070",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索雙體延伸",
      "description": "以 Backup @Ignister 檢索 Wizard @Ignister，再丟棄 Radiant Typhoon Chant。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       67115133
      ],
      "effectText": "加入1隻闇屬性電子界怪獸，然後丟棄1張卡。",
      "resultText": "Wizard @Ignister 留在手牌。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 67115133,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "286f67b7-3185-476f-9be2-2cfa26589a92",
      "order": 15,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "轉入本家連結",
      "description": "以 Cherubini, Ebon Angel of the Burning Abyss 計為2，搭配 Maliss <P> Dormouse 製作 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       58699500,
       32061192
      ],
      "resultText": "位於EMZ-L。",
      "moves": [
       {
        "cardId": 58699500,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "5251797c-43f4-4945-b524-fb5ca118e1d4",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "預留除外資源",
      "description": "以 Maliss <Q> White Binder 除外墓地的 Maliss <P> White Rabbit。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外指定墓地卡。",
      "resultText": "白兔本回合復活效果已使用，不再發動。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "517668c9-23ad-4fa8-b64e-98e0ca9e4a78",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "保留復活陷阱",
      "description": "以 Maliss <Q> White Binder 蓋牌組的 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "覆蓋1張本家陷阱。",
      "resultText": "覆蓋於S2，留到對手回合。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "83836528-141e-4fe2-958e-d1fbff62ddbf",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "陷阱換取素材",
      "description": "除外 Maliss <Q> White Binder 以發動剛覆蓋的 Maliss <C> MTP-07，檢索 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "以除外表側本家怪獸的方式於覆蓋回合發動。",
      "effectText": "加入本家怪獸；結算時沒有本家連結怪獸，不進行場上除外。",
      "resultText": "陷阱送墓，準備 Maliss <Q> White Binder 的除外誘發。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "EMZ-L"
       },
       {
        "cardId": 96676583,
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
      "id": "f257b5e2-4517-4314-b0b7-df3aeface57d",
      "order": 19,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "移至互相連結位",
      "description": "發動被除外的 Maliss <Q> White Binder，選擇不抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付900點生命值。",
      "effectText": "特殊召喚自身；不使用可選抽牌。",
      "resultText": "位於M2，左右箭頭開放M1與M3；召喚誘發除外效果已使用。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "95454996#3"
     },
     {
      "id": "e69a2e7a-4f49-4672-922d-5d95ac5d8039",
      "order": 20,
      "actionType": "normal-summon",
      "actorCardIds": [
       96676583
      ],
      "title": "使用通常召喚",
      "description": "通常召喚 Maliss <P> Chessy Cat，不發動抽牌效果。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "位於M5，本回合通常召喚已使用。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       }
      ]
     },
     {
      "id": "f8155aad-e4f6-49cc-8167-884e7b8b03ea",
      "order": 21,
      "actionType": "link-summon",
      "actorCardIds": [
       59859086
      ],
      "title": "製作復活中繼",
      "description": "以 Backup @Ignister 與 Maliss <P> March Hare 連結召喚 Splash Mage。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30118811,
       20938824
      ],
      "resultText": "位於 Maliss <Q> White Binder 指向的M3。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 59859086,
        "from": "extra",
        "to": "field",
        "slot": "M3"
       }
      ]
     },
     {
      "id": "5c05bc37-da4f-474c-b767-b835bd4d69d1",
      "order": 22,
      "actionType": "activate",
      "actorCardIds": [
       59859086
      ],
      "title": "追加墓地素材",
      "description": "以 Splash Mage 復活 Maliss <P> Dormouse。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "守備表示特殊召喚並無效效果；之後只能特殊召喚電子界怪獸。",
      "resultText": "位於M4。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "59859086#1"
     },
     {
      "id": "33436c8c-c424-47b6-b3fb-3cea6f783f7c",
      "order": 23,
      "actionType": "link-summon",
      "actorCardIds": [
       5043010
      ],
      "title": "建立回手終端",
      "description": "以 Splash Mage 計為2，搭配 Link Decoder 與 Maliss <P> Chessy Cat 製作 Firewall Dragon。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       30342076,
       96676583
      ],
      "resultText": "位於EMZ-L，與M2的 Maliss <Q> White Binder 互相連結。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M5"
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
      "id": "67722994-8a9c-4bf7-be28-8e92c44d5c8f",
      "order": 24,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收連結素材",
      "description": "Link Decoder 作為原始攻擊力2500的電子界連結素材送墓，發動復活效果。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "3b113a47-6ca9-49ad-aa39-ca8ec2386b06",
      "order": 25,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "手牌墓地雙展開",
      "description": "發動 Wizard @Ignister，以墓地 Backup @Ignister 為對象。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       30118811
      ],
      "effectText": "兩隻皆守備表示特殊召喚；之後只能特殊召喚電子界怪獸。",
      "resultText": "Wizard @Ignister 位於M3，Backup @Ignister 位於M5；後者檢索效果已使用。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 30118811,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "7139d588-1eb2-46ba-9042-76b575bced59",
      "order": 26,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "建立快速除外",
      "description": "使用 Link Decoder、Wizard @Ignister 與 Maliss <P> Dormouse 三隻怪獸製作 Maliss <Q> Hearts Crypter。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       3723262,
       32061192
      ],
      "resultText": "位於 Maliss <Q> White Binder 指向的M3；保留 Firewall Dragon 回手效果。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 21848500,
        "from": "extra",
        "to": "field",
        "slot": "M3"
       }
      ]
     }
    ],
    "endBoard": [
     {
      "cardId": 5043010,
      "zone": "場上",
      "count": 1,
      "note": "EMZ-L；與M2互相連結，可回手最多1隻場上或墓地怪獸，效果尚未使用。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M2；維持 Firewall Dragon 回手條件，對手回合被除外再復活可觸發墓地除外。"
     },
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "M3；可將除外的 Maliss <P> White Rabbit 洗回牌組並除外場上1張卡，沒有指向怪獸的抗無效條件。"
     },
     {
      "cardId": 30118811,
      "zone": "場上",
      "count": 1,
      "note": "M5；保留素材與下回合資源。"
     },
     {
      "cardId": 20726052,
      "zone": "場上",
      "count": 1,
      "note": "S2覆蓋；對手回合可復活本家，不單獨計為干擾。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "供 Maliss <Q> Hearts Crypter 的快速效果使用。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "復活後作素材離場，因此除外。"
     },
     {
      "cardId": 54143349,
      "zone": "墓地",
      "count": 1,
      "note": "初始連結素材。"
     },
     {
      "cardId": 80538047,
      "zone": "墓地",
      "count": 1,
      "note": "初始連結素材。"
     },
     {
      "cardId": 67115133,
      "zone": "墓地",
      "count": 1,
      "note": "Backup @Ignister 效果丟棄。"
     },
     {
      "cardId": 58699500,
      "zone": "墓地",
      "count": 1,
      "note": "本家轉場素材。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "可供陷阱復活。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "可供陷阱復活或後續除外回收。"
     },
     {
      "cardId": 96676583,
      "zone": "墓地",
      "count": 1,
      "note": "可供陷阱復活。"
     },
     {
      "cardId": 94722358,
      "zone": "墓地",
      "count": 1,
      "note": "已使用；下回合可再覆蓋。"
     },
     {
      "cardId": 59859086,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 3723262,
      "zone": "墓地",
      "count": 1,
      "note": "下回合可回收的延伸資源。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      54143349,
      20938824,
      30118811
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應；其餘兩張手牌不使用。",
      "列出的牌組元件仍在牌組；起始生命值足以支付合計1500點。",
      "不使用 Transcode Talker 的復活效果，也不依賴任何隨機抽牌。"
     ],
     "pros": [
      "終場具備1次怪獸回手與1次場上除外，兩者的必要條件皆有保留。",
      "Maliss <Q> Hearts Crypter 可改除外自身或 Maliss <Q> White Binder，再以除外誘發復活；後者可追加最多3張墓地卡除外。",
      "Maliss <C> GWC-06 保留復活與續航，不依賴隨機抽牌。"
     ],
     "cons": [
      "沒有發動無效；Firewall Dragon 只能回手怪獸，且失去M2的互相連結怪獸就不能回手。",
      "Maliss <Q> Hearts Crypter 沒有指向怪獸，快速效果不具備不可無效保障。",
      "需要多張單張牌組元件，早期墓地轉場與 Backup @Ignister 檢索是重要受阻點。"
     ],
     "combo": {
      "required": [
       54143349,
       20938824,
       30118811
      ],
      "alternatives": [
       {
        "cardId": 54143349,
        "instead": [
         80538047
        ],
        "note": "同樣能自行特殊召喚；需先檢索並發動 Radiant Typhoon Chant 取得 Radiant Typhoon Eldam，步驟須重排。"
       },
       {
        "cardId": 20938824,
        "instead": [],
        "note": "此具體路線需要手牌除外墓地本家並自行出場的功能。"
       },
       {
        "cardId": 30118811,
        "instead": [],
        "note": "此具體路線需要其自行出場及檢索 Wizard @Ignister 的功能。"
       }
      ],
      "extenders": [
       75500286,
       68337209,
       33854624,
       6637331
      ],
      "avoidInHand": [
       80538047,
       67115133,
       32061192,
       69272449,
       94722358,
       20726052,
       3723262,
       96676583
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  },
  {
   "route": {
    "schemaVersion": 1,
    "id": "d7b2c79b-e5db-435c-9496-dfc65b753249",
    "version": 1,
    "name": "回手中繼改發動無效",
    "archetype": "Radiant Typhoon",
    "format": "master-duel",
    "description": "先攻第一回合，雙方場上皆空，對手不回應；其餘兩張手牌不使用。\n列出的牌組元件仍在牌組；起始生命值足以支付合計1500點。\nAllied Code Talker @Ignister 的復活效果最後才使用，之後不再特殊召喚。",
    "conditions": {
     "handAllOf": [
      {
       "anyOf": [
        54143349
       ],
       "count": 1
      },
      {
       "anyOf": [
        20938824
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
       "cardId": 80538047,
       "count": 1
      },
      {
       "cardId": 67115133,
       "count": 1
      },
      {
       "cardId": 32061192,
       "count": 1
      },
      {
       "cardId": 69272449,
       "count": 1
      },
      {
       "cardId": 94722358,
       "count": 1
      },
      {
       "cardId": 20726052,
       "count": 1
      },
      {
       "cardId": 3723262,
       "count": 1
      },
      {
       "cardId": 96676583,
       "count": 1
      }
     ],
     "mustExistInExtra": [
      {
       "cardId": 58699500,
       "count": 1
      },
      {
       "cardId": 30342076,
       "count": 1
      },
      {
       "cardId": 95454996,
       "count": 1
      },
      {
       "cardId": 59859086,
       "count": 1
      },
      {
       "cardId": 5043010,
       "count": 1
      },
      {
       "cardId": 21848500,
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
      "id": "87529740-9ec2-4091-92b8-5b7c47b4c7c8",
      "order": 1,
      "actionType": "special-summon",
      "actorCardIds": [
       54143349
      ],
      "title": "先放風素材",
      "description": "對手沒有魔法、陷阱，特殊召喚 Radiant Typhoon Eldam。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "依自身特殊召喚條件出場。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 54143349,
        "from": "hand",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "0ecc8088-25c5-42f8-b59a-33e4e9fcecf9",
      "order": 2,
      "actionType": "activate",
      "actorCardIds": [
       54143349
      ],
      "title": "檢索第二素材",
      "description": "以 Radiant Typhoon Eldam 檢索 Radiant Typhoon Swen。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       80538047
      ],
      "effectText": "加入本家怪獸。",
      "resultText": "取得第二隻等級3怪獸。",
      "moves": [
       {
        "cardId": 80538047,
        "from": "deck",
        "to": "hand"
       }
      ],
      "effectRef": "54143349#1"
     },
     {
      "id": "93eb0c09-5804-4c45-9507-4c3c88624074",
      "order": 3,
      "actionType": "special-summon",
      "actorCardIds": [
       80538047
      ],
      "title": "補第二素材",
      "description": "對手仍沒有魔法、陷阱，特殊召喚 Radiant Typhoon Swen。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "依自身特殊召喚條件出場。",
      "resultText": "位於M3。",
      "moves": [
       {
        "cardId": 80538047,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       }
      ]
     },
     {
      "id": "5e892cc4-ea13-4d73-9d2c-f53be01209d5",
      "order": 4,
      "actionType": "activate",
      "actorCardIds": [
       80538047
      ],
      "title": "備妥丟棄資源",
      "description": "以 Radiant Typhoon Swen 檢索 Radiant Typhoon Chant。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       67115133
      ],
      "effectText": "加入本家魔法。",
      "resultText": "保留給 Backup @Ignister 丟棄。",
      "moves": [
       {
        "cardId": 67115133,
        "from": "deck",
        "to": "hand"
       }
      ],
      "effectRef": "80538047#1"
     },
     {
      "id": "255264ae-e868-485c-9426-2030725a05b8",
      "order": 5,
      "actionType": "link-summon",
      "actorCardIds": [
       58699500
      ],
      "title": "製作墓地入口",
      "description": "使用兩隻等級3怪獸製作 Cherubini, Ebon Angel of the Burning Abyss。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       54143349,
       80538047
      ],
      "resultText": "位於EMZ-L。",
      "moves": [
       {
        "cardId": 54143349,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 80538047,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 58699500,
        "from": "extra",
        "to": "field",
        "slot": "EMZ-L"
       }
      ]
     },
     {
      "id": "187a74d2-c32d-41ee-b74b-bf5e3c77c92d",
      "order": 6,
      "actionType": "activate",
      "actorCardIds": [
       58699500
      ],
      "title": "送墓本家",
      "description": "以 Cherubini, Ebon Angel of the Burning Abyss 自身為對象，送墓 Maliss <P> Dormouse。",
      "fromZone": "牌組",
      "toZone": "墓地",
      "targetCardIds": [
       58699500
      ],
      "costText": "從牌組送墓1隻等級3怪獸。",
      "effectText": "自身本回合增加900攻擊力與300守備力。",
      "resultText": "備妥墓地本家。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "deck",
        "to": "gy"
       }
      ],
      "effectRef": "58699500#1"
     },
     {
      "id": "58bec4da-8c23-497f-a5f6-7abf0dbcdefd",
      "order": 7,
      "actionType": "activate",
      "actorCardIds": [
       20938824
      ],
      "title": "手牌除外轉場",
      "description": "以 Maliss <P> March Hare 除外墓地 Maliss <P> Dormouse。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "除外另一張本家卡後特殊召喚自身。",
      "resultText": "位於M3。",
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
        "slot": "M3"
       }
      ],
      "effectRef": "20938824#1"
     },
     {
      "id": "e95bd4b3-cadf-4889-a744-dd91f367def0",
      "order": 8,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "復活送墓資源",
      "description": "發動被除外的 Maliss <P> Dormouse。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300點生命值。",
      "effectText": "特殊召喚自身；本回合額外牌組只能特殊召喚連結怪獸。",
      "resultText": "位於M2。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "32061192#2"
     },
     {
      "id": "eb85c499-cb4a-4db9-bfb2-93343ea20dd4",
      "order": 9,
      "actionType": "activate",
      "actorCardIds": [
       32061192
      ],
      "title": "從牌組除外",
      "description": "以 Maliss <P> Dormouse 除外牌組的 Maliss <P> White Rabbit。",
      "fromZone": "牌組",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外1隻本家怪獸，本回合本家怪獸增加600攻擊力。",
      "resultText": "準備白兔復活。",
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
      "id": "d23536ef-151b-4d09-99a5-722a97c055d0",
      "order": 10,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "白兔出場",
      "description": "發動被除外的 Maliss <P> White Rabbit。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付300點生命值。",
      "effectText": "特殊召喚自身並套用額外牌組連結限制。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "banished",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "69272449#2"
     },
     {
      "id": "586ef52a-0fe5-417b-8ece-957bfb1cae11",
      "order": 11,
      "actionType": "activate",
      "actorCardIds": [
       69272449
      ],
      "title": "取得檢索陷阱",
      "description": "以 Maliss <P> White Rabbit 蓋牌組的 Maliss <C> MTP-07。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       94722358
      ],
      "effectText": "覆蓋墓地没有同名卡的本家陷阱。",
      "resultText": "覆蓋於S1。",
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
      "id": "3ca275c1-3f35-43ca-b78c-72bb4496b42c",
      "order": 12,
      "actionType": "link-summon",
      "actorCardIds": [
       30342076
      ],
      "title": "建立電子界入口",
      "description": "以 Maliss <P> White Rabbit 製作 Link Decoder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       69272449
      ],
      "resultText": "位於 Cherubini, Ebon Angel of the Burning Abyss 指向的M1。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 30342076,
        "from": "extra",
        "to": "field",
        "slot": "M1"
       }
      ]
     },
     {
      "id": "7f35708c-b537-4de8-8283-8ad4490399a0",
      "order": 13,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "追加手牌素材",
      "description": "控制從額外牌組特殊召喚的電子界怪獸，發動 Backup @Ignister。",
      "fromZone": "手牌",
      "toZone": "場上",
      "effectText": "從手牌特殊召喚自身。",
      "resultText": "位於M4。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "hand",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "30118811#1"
     },
     {
      "id": "bf4231f2-f504-42f0-ac9c-33f16ffda190",
      "order": 14,
      "actionType": "activate",
      "actorCardIds": [
       30118811
      ],
      "title": "檢索雙體延伸",
      "description": "以 Backup @Ignister 檢索 Wizard @Ignister，再丟棄 Radiant Typhoon Chant。",
      "fromZone": "牌組",
      "toZone": "手牌",
      "targetCardIds": [
       3723262,
       67115133
      ],
      "effectText": "加入闇屬性電子界怪獸，然後丟棄1張卡。",
      "resultText": "取得延伸手牌。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "deck",
        "to": "hand"
       },
       {
        "cardId": 67115133,
        "from": "hand",
        "to": "gy"
       }
      ],
      "effectRef": "30118811#2"
     },
     {
      "id": "49d0aeca-9b3c-4b14-94f9-bb5f8eb21b2e",
      "order": 15,
      "actionType": "link-summon",
      "actorCardIds": [
       95454996
      ],
      "title": "轉入本家連結",
      "description": "以 Cherubini, Ebon Angel of the Burning Abyss 計為2，搭配 Maliss <P> Dormouse 製作 Maliss <Q> White Binder。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       58699500,
       32061192
      ],
      "resultText": "位於EMZ-L。",
      "moves": [
       {
        "cardId": 58699500,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M2"
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
      "id": "019ed829-cc42-45f6-b8c7-eeb410661d16",
      "order": 16,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "預留除外資源",
      "description": "以 Maliss <Q> White Binder 除外墓地的 Maliss <P> White Rabbit。",
      "fromZone": "墓地",
      "toZone": "除外",
      "targetCardIds": [
       69272449
      ],
      "effectText": "除外指定墓地卡。",
      "resultText": "白兔本回合復活效果已使用。",
      "moves": [
       {
        "cardId": 69272449,
        "from": "gy",
        "to": "banished"
       }
      ],
      "effectRef": "95454996#1"
     },
     {
      "id": "fe8b49d1-7988-4205-aa41-ddbc67baad85",
      "order": 17,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "保留復活陷阱",
      "description": "以 Maliss <Q> White Binder 蓋牌組的 Maliss <C> GWC-06。",
      "fromZone": "牌組",
      "toZone": "場上",
      "targetCardIds": [
       20726052
      ],
      "effectText": "覆蓋1張本家陷阱。",
      "resultText": "覆蓋於S2。",
      "moves": [
       {
        "cardId": 20726052,
        "from": "deck",
        "to": "field",
        "slot": "S2"
       }
      ],
      "effectRef": "95454996#2"
     },
     {
      "id": "160496d3-267e-42f0-bc3d-757963ede9b2",
      "order": 18,
      "actionType": "activate",
      "actorCardIds": [
       94722358
      ],
      "title": "陷阱換取素材",
      "description": "除外 Maliss <Q> White Binder 以發動剛覆蓋的 Maliss <C> MTP-07，檢索 Maliss <P> Chessy Cat。",
      "fromZone": "場上",
      "toZone": "墓地",
      "targetCardIds": [
       96676583
      ],
      "costText": "以除外表側本家怪獸的方式於覆蓋回合發動。",
      "effectText": "加入本家怪獸；結算時沒有本家連結怪獸，不進行場上除外。",
      "resultText": "陷阱送墓，準備除外誘發。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "field",
        "to": "banished",
        "slot": "EMZ-L"
       },
       {
        "cardId": 96676583,
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
      "id": "aec491ab-5286-488b-9f58-cca5564a7898",
      "order": 19,
      "actionType": "activate",
      "actorCardIds": [
       95454996
      ],
      "title": "移至互相連結位",
      "description": "發動被除外的 Maliss <Q> White Binder，選擇不抽牌。",
      "fromZone": "除外",
      "toZone": "場上",
      "costText": "支付900點生命值。",
      "effectText": "特殊召喚自身，不使用可選抽牌。",
      "resultText": "位於M2；召喚誘發除外效果已使用。",
      "moves": [
       {
        "cardId": 95454996,
        "from": "banished",
        "to": "field",
        "slot": "M2"
       }
      ],
      "effectRef": "95454996#3"
     },
     {
      "id": "ae82df5e-9aba-4e42-b486-857c17e8b6b3",
      "order": 20,
      "actionType": "normal-summon",
      "actorCardIds": [
       96676583
      ],
      "title": "使用通常召喚",
      "description": "通常召喚 Maliss <P> Chessy Cat，不發動抽牌效果。",
      "fromZone": "手牌",
      "toZone": "場上",
      "resultText": "位於M5。",
      "moves": [
       {
        "cardId": 96676583,
        "from": "hand",
        "to": "field",
        "slot": "M5"
       }
      ]
     },
     {
      "id": "921870b9-a7f5-4c20-97b2-593dcfe6ce16",
      "order": 21,
      "actionType": "link-summon",
      "actorCardIds": [
       59859086
      ],
      "title": "製作復活中繼",
      "description": "以 Backup @Ignister 與 Maliss <P> March Hare 製作 Splash Mage。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30118811,
       20938824
      ],
      "resultText": "位於 Maliss <Q> White Binder 指向的M3。",
      "moves": [
       {
        "cardId": 30118811,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 20938824,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 59859086,
        "from": "extra",
        "to": "field",
        "slot": "M3"
       }
      ]
     },
     {
      "id": "8a3bd0d0-2f76-46f7-80d3-b8c37a8b1ca6",
      "order": 22,
      "actionType": "activate",
      "actorCardIds": [
       59859086
      ],
      "title": "追加墓地素材",
      "description": "以 Splash Mage 復活 Maliss <P> Dormouse。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       32061192
      ],
      "effectText": "守備表示特殊召喚並無效效果；之後只能特殊召喚電子界怪獸。",
      "resultText": "位於M4。",
      "moves": [
       {
        "cardId": 32061192,
        "from": "gy",
        "to": "field",
        "slot": "M4"
       }
      ],
      "effectRef": "59859086#1"
     },
     {
      "id": "31e22e8d-d07b-4635-872e-bb031447933d",
      "order": 23,
      "actionType": "link-summon",
      "actorCardIds": [
       5043010
      ],
      "title": "建立回收中繼",
      "description": "以 Splash Mage 計為2，搭配 Link Decoder 與 Maliss <P> Chessy Cat 製作 Firewall Dragon。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       59859086,
       30342076,
       96676583
      ],
      "resultText": "位於EMZ-L，與M2的 Maliss <Q> White Binder 互相連結。",
      "moves": [
       {
        "cardId": 59859086,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 30342076,
        "from": "field",
        "to": "gy",
        "slot": "M1"
       },
       {
        "cardId": 96676583,
        "from": "field",
        "to": "gy",
        "slot": "M5"
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
      "id": "1101dcc8-0eaf-4fb4-885f-e9799ac0244e",
      "order": 24,
      "actionType": "activate",
      "actorCardIds": [
       30342076
      ],
      "title": "回收連結素材",
      "description": "Link Decoder 作為原始攻擊力2500的電子界連結素材送墓，發動復活效果。",
      "fromZone": "墓地",
      "toZone": "場上",
      "effectText": "特殊召喚自身，離場時除外。",
      "resultText": "位於M1。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "gy",
        "to": "field",
        "slot": "M1"
       }
      ],
      "effectRef": "30342076#1"
     },
     {
      "id": "9f9e4fa1-69b4-4733-9d4c-030ba6f83a25",
      "order": 25,
      "actionType": "activate",
      "actorCardIds": [
       3723262
      ],
      "title": "手牌墓地雙展開",
      "description": "發動 Wizard @Ignister，以墓地 Backup @Ignister 為對象。",
      "fromZone": "手牌",
      "toZone": "場上",
      "targetCardIds": [
       30118811
      ],
      "effectText": "兩隻皆守備表示特殊召喚；之後只能特殊召喚電子界怪獸。",
      "resultText": "Wizard @Ignister 位於M3，Backup @Ignister 位於M5；後者檢索效果已使用。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "hand",
        "to": "field",
        "slot": "M3"
       },
       {
        "cardId": 30118811,
        "from": "gy",
        "to": "field",
        "slot": "M5"
       }
      ],
      "effectRef": "3723262#1"
     },
     {
      "id": "576392e6-428d-4262-851f-c8b0c4e1a2b8",
      "order": 26,
      "actionType": "link-summon",
      "actorCardIds": [
       21848500
      ],
      "title": "先完成快速除外",
      "description": "以 Link Decoder、Wizard @Ignister 與 Maliss <P> Dormouse 三隻怪獸製作 Maliss <Q> Hearts Crypter。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       30342076,
       3723262,
       32061192
      ],
      "resultText": "位於 Maliss <Q> White Binder 指向的M3。",
      "moves": [
       {
        "cardId": 30342076,
        "from": "field",
        "to": "banished",
        "slot": "M1"
       },
       {
        "cardId": 3723262,
        "from": "field",
        "to": "gy",
        "slot": "M3"
       },
       {
        "cardId": 32061192,
        "from": "field",
        "to": "gy",
        "slot": "M4"
       },
       {
        "cardId": 21848500,
        "from": "extra",
        "to": "field",
        "slot": "M3"
       }
      ]
     },
     {
      "id": "04e71a32-7cf6-4ed6-bbe5-691312bff908",
      "order": 27,
      "actionType": "activate",
      "actorCardIds": [
       5043010
      ],
      "title": "中繼回收手牌",
      "description": "Firewall Dragon 有1隻互相連結怪獸，以墓地 Wizard @Ignister 為對象回手。",
      "fromZone": "墓地",
      "toZone": "手牌",
      "targetCardIds": [
       3723262
      ],
      "effectText": "將1隻墓地怪獸返回手牌。",
      "resultText": "先保留後續延伸手牌，再使用 Firewall Dragon 作素材。",
      "moves": [
       {
        "cardId": 3723262,
        "from": "gy",
        "to": "hand"
       }
      ],
      "effectRef": "5043010#1"
     },
     {
      "id": "3758bd4b-9747-408a-a7c2-4dbde3ee5393",
      "order": 28,
      "actionType": "link-summon",
      "actorCardIds": [
       39138610
      ],
      "title": "轉成發動無效",
      "description": "Firewall Dragon 計為1，Maliss <Q> White Binder 計為3，搭配 Backup @Ignister 製作 Allied Code Talker @Ignister。",
      "fromZone": "額外牌組",
      "toZone": "場上",
      "materialCardIds": [
       5043010,
       95454996,
       30118811
      ],
      "resultText": "三隻效果怪獸合計連結值5，召喚至EMZ-L；不發動 Firewall Dragon 的手牌特殊召喚效果。",
      "moves": [
       {
        "cardId": 5043010,
        "from": "field",
        "to": "gy",
        "slot": "EMZ-L"
       },
       {
        "cardId": 95454996,
        "from": "field",
        "to": "gy",
        "slot": "M2"
       },
       {
        "cardId": 30118811,
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
      "id": "5f2132c4-738c-4f6f-a9b0-88914f11057e",
      "order": 29,
      "actionType": "activate",
      "actorCardIds": [
       39138610
      ],
      "title": "補足解放資源",
      "description": "以 Allied Code Talker @Ignister 復活墓地原始攻擊力2300的 Maliss <Q> White Binder。",
      "fromZone": "墓地",
      "toZone": "場上",
      "targetCardIds": [
       95454996
      ],
      "effectText": "盡可能復活符合條件的電子界怪獸至指向區，自身增加500攻擊力；本回合不能再特殊召喚。",
      "resultText": "Maliss <Q> White Binder 位於M1，Maliss <Q> Hearts Crypter 留在M3；兩者皆可供無效效果解放。",
      "moves": [
       {
        "cardId": 95454996,
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
      "note": "EMZ-L；指向M1與M3的連結怪獸，可解放其中1隻無效發動並除外。"
     },
     {
      "cardId": 95454996,
      "zone": "場上",
      "count": 1,
      "note": "M1；優先作無效效果的解放資源，也可由陷阱復活觸發墓地除外。"
     },
     {
      "cardId": 21848500,
      "zone": "場上",
      "count": 1,
      "note": "M3；保留1次場上除外，目標資源為除外的 Maliss <P> White Rabbit。"
     },
     {
      "cardId": 20726052,
      "zone": "場上",
      "count": 1,
      "note": "S2覆蓋；可復活被解放的 Maliss <Q> White Binder，追加墓地除外。"
     },
     {
      "cardId": 3723262,
      "zone": "手牌",
      "count": 1,
      "note": "由 Firewall Dragon 回收，保留下回合延伸。"
     },
     {
      "cardId": 69272449,
      "zone": "除外",
      "count": 1,
      "note": "供 Maliss <Q> Hearts Crypter 使用。"
     },
     {
      "cardId": 30342076,
      "zone": "除外",
      "count": 1,
      "note": "復活後作素材離場，因此除外。"
     },
     {
      "cardId": 54143349,
      "zone": "墓地",
      "count": 1,
      "note": "初始連結素材。"
     },
     {
      "cardId": 80538047,
      "zone": "墓地",
      "count": 1,
      "note": "初始連結素材。"
     },
     {
      "cardId": 67115133,
      "zone": "墓地",
      "count": 1,
      "note": "Backup @Ignister 效果丟棄。"
     },
     {
      "cardId": 58699500,
      "zone": "墓地",
      "count": 1,
      "note": "轉場素材。"
     },
     {
      "cardId": 32061192,
      "zone": "墓地",
      "count": 1,
      "note": "本家復活資源。"
     },
     {
      "cardId": 20938824,
      "zone": "墓地",
      "count": 1,
      "note": "本家復活資源。"
     },
     {
      "cardId": 96676583,
      "zone": "墓地",
      "count": 1,
      "note": "本家復活資源。"
     },
     {
      "cardId": 94722358,
      "zone": "墓地",
      "count": 1,
      "note": "已使用的檢索陷阱。"
     },
     {
      "cardId": 59859086,
      "zone": "墓地",
      "count": 1,
      "note": "連結素材。"
     },
     {
      "cardId": 5043010,
      "zone": "墓地",
      "count": 1,
      "note": "僅作中繼，不計入對手回合回手干擾。"
     },
     {
      "cardId": 30118811,
      "zone": "墓地",
      "count": 1,
      "note": "可供下回合 Wizard @Ignister 復活。"
     }
    ],
    "verification": {
     "status": "unverified"
    },
    "analysis": {
     "origin": "ai",
     "runId": "8e9209ef-9751-409b-bdd6-990ca0321501",
     "deckId": "310e3f53-2517-4a6c-b1ed-62a52ac9864a",
     "deckName": "瑪麗絲（實際牌表）",
     "deckVersion": 1,
     "deckFingerprint": "fp1-1a1362449c32fd",
     "cardDataVersion": "YGOPRODeck 147.23｜2026-10-09T07:14:22",
     "provider": "chatgpt",
     "model": "gpt-6.1-sol",
     "servedModel": "gpt-6.1-sol",
     "promptVersion": "deck-analysis-v3-staged",
     "generatedAt": "2026-10-09T10:47:10.677Z",
     "starterCardIds": [
      54143349,
      20938824,
      30118811
     ],
     "preconditions": [
      "先攻第一回合，雙方場上皆空，對手不回應；其餘兩張手牌不使用。",
      "列出的牌組元件仍在牌組；起始生命值足以支付合計1500點。",
      "Allied Code Talker @Ignister 的復活效果最後才使用，之後不再特殊召喚。"
     ],
     "pros": [
      "保留1次發動無效並除外，以及1次 Maliss <Q> Hearts Crypter 場上除外。",
      "解放 Maliss <Q> White Binder 後，可用 Maliss <C> GWC-06 復活並觸發最多3張墓地卡除外。",
      "Firewall Dragon 中繼回收 Wizard @Ignister，增加下回合延伸資源。"
     ],
     "cons": [
      "Firewall Dragon 不留場，沒有對手回合回手；Allied Code Talker @Ignister 無效需要犧牲連結怪獸。",
      "若為無效而解放 Maliss <Q> Hearts Crypter，會失去其場上除外，優先解放另一隻連結怪獸。",
      "Maliss <Q> Hearts Crypter 沒有指向怪獸的抗無效保障，且最終復活後不能再特殊召喚。"
     ],
     "combo": {
      "required": [
       54143349,
       20938824,
       30118811
      ],
      "alternatives": [
       {
        "cardId": 54143349,
        "instead": [
         80538047
        ],
        "note": "同樣能自行特殊召喚；需先檢索並發動 Radiant Typhoon Chant 取得 Radiant Typhoon Eldam，步驟須重排。"
       },
       {
        "cardId": 20938824,
        "instead": [],
        "note": "此具體路線需要手牌除外墓地本家並自行出場的功能。"
       },
       {
        "cardId": 30118811,
        "instead": [],
        "note": "此具體路線需要其自行出場及檢索 Wizard @Ignister 的功能。"
       }
      ],
      "extenders": [
       75500286,
       68337209,
       33854624,
       6637331
      ],
      "avoidInHand": [
       80538047,
       67115133,
       32061192,
       69272449,
       94722358,
       20726052,
       3723262,
       96676583
      ]
     },
     "check": {
      "passed": true,
      "checkedAt": "2026-10-09T10:47:10.677Z",
      "deckFingerprint": "fp1-1a1362449c32fd",
      "problems": []
     }
    },
    "createdAt": "2026-10-09T10:47:10.677Z",
    "updatedAt": "2026-10-09T10:47:10.677Z"
   },
   "schemaErrors": []
  }
 ],
 "explored": [
  {
   "name": "雙碼共存",
   "handCardIds": [
    32061192,
    30118811,
    20938824
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    59859086,
    46947713,
    5043010,
    24842059,
    39138610
   ],
   "finalBoardCardIds": [
    39138610,
    5043010,
    95454996,
    46947713
   ],
   "routeName": "雙碼共存與雙向互連",
   "note": "已列出候選步驟；Firewall Dragon 有兩組互相連結，無效代價可由非互相連結的 Transcode Talker 支付。"
  },
  {
   "name": "紅心替代防火牆",
   "handCardIds": [
    32061192,
    30118811,
    20938824
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    59859086,
    46947713,
    21848500,
    39138610
   ],
   "finalBoardCardIds": [
    39138610,
    21848500,
    95454996,
    46947713
   ],
   "routeName": "聯合碼與紅心除外",
   "note": "已列出候選步驟；保留本家除外資源與一張確定檢索的手牌，換取不限怪獸的除外。"
  },
  {
   "name": "雙碼加紅心",
   "handCardIds": [
    32061192,
    30118811,
    20938824
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    59859086,
    46947713,
    5043010,
    21848500,
    39138610
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "未找到同時保留兩張偏好怪獸與 Maliss <Q> Hearts Crypter，且維持有效無效代價與除外資源的完整線；不將此目標列為可達終場。"
  },
  {
   "name": "偏好怪獸作中繼",
   "handCardIds": [
    32061192,
    30118811,
    20938824
   ],
   "extraDeckCardIds": [
    5043010,
    39138610,
    21848500
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "未整理出把 Firewall Dragon 或 Allied Code Talker @Ignister 僅作中繼、又優於已列終場的完整線；後者復活效果會立即禁止後續特殊召喚。"
  },
  {
   "name": "其他泛用額外候選",
   "handCardIds": [
    32061192,
    30118811,
    20938824
   ],
   "extraDeckCardIds": [
    60303245,
    58699500,
    52698008,
    29301450,
    9763474,
    39341885,
    86066372
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "已考量其素材、種族限制與對手回合用途，但未展開獨立完整線；非電子界族會衝突復活限制，Accesscode Talker 不增加此先攻目標的即時干擾。"
  },
  {
   "name": "Firewall 互相連結",
   "handCardIds": [
    68337209,
    30118811
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    5043010
   ],
   "finalBoardCardIds": [
    5043010,
    95454996,
    68337209
   ],
   "routeName": "Firewall 互相連結",
   "note": "已列出候選步驟；一組互相連結僅提供最多一隻怪獸回手。"
  },
  {
   "name": "Allied 雙代價",
   "handCardIds": [
    68337209,
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
    46947713,
    95454996,
    68337209
   ],
   "routeName": "Allied 保留無效代價",
   "note": "已列出候選步驟；捨棄不能成立的 Transcode Talker 復活構想，直接使用三隻效果怪獸完成終場。"
  },
  {
   "name": "雙主體與本家除外",
   "handCardIds": [
    68337209,
    30118811
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    5043010,
    21848500,
    39138610
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "未找到 Firewall Dragon、Allied Code Talker @Ignister 與有效本家除外共存的完整路線，不宣稱可以達成。"
  },
  {
   "name": "其他額外支援篩選",
   "handCardIds": [
    68337209,
    30118811
   ],
   "extraDeckCardIds": [
    60303245,
    24842059,
    58699500,
    52698008,
    59859086,
    29301450,
    9763474,
    39341885,
    86066372
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "已考慮素材、種族限制與箭頭用途；本次未整理出增加目標終場干擾的完整替代線，Accesscode Talker 也沒有對手回合快速破壞。"
  },
  {
   "name": "核心雙除外",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    21848500
   ],
   "finalBoardCardIds": [
    21848500,
    94722358
   ],
   "routeName": "Hearts Crypter與本家陷阱",
   "note": "以 Maliss <Q> White Binder 作中繼，保留快速除外資源與可用本家陷阱。"
  },
  {
   "name": "偏好怪獸與解放素材",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    39138610
   ],
   "finalBoardCardIds": [
    39138610,
    95454996,
    94722358
   ],
   "routeName": "Allied與White Binder留場",
   "note": "讓 Maliss <Q> White Binder 留場提供解放素材；陷阱除外與無效有使用順序限制。"
  },
  {
   "name": "Firewall互相連結方向",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    30342076,
    95454996,
    46947713,
    5043010
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮消耗 Maliss <C> MTP-07 延伸並調整位置，但未寫出完整互相連結流程；不把 Firewall Dragon 留場或其回手干擾列為已達成。"
  },
  {
   "name": "其他電子界族中繼",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    52698008,
    59859086,
    46947713
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 Cyberse Wicckid 檢索及復活中繼；未寫出優於兩條候選終場的完整單卡流程。"
  },
  {
   "name": "泛用連結替代",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    60303245,
    24842059,
    29301450,
    9763474,
    86066372
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "Salamangreat Almiraj 在起手怪獸加攻後不符素材條件；其餘替代未寫出兼顧本家陷阱且更高干擾的完整流程。"
  },
  {
   "name": "非電子界族支線",
   "handCardIds": [
    32061192
   ],
   "extraDeckCardIds": [
    58699500,
    39341885
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "Cherubini, Ebon Angel of the Burning Abyss 支線未展開；Radiant Typhoon Varuroon, the Marine Eidolon 缺少指定系列素材，不列入單卡候選。"
  },
  {
   "name": "回手與除外並存",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    58699500,
    30342076,
    95454996,
    59859086,
    5043010,
    21848500
   ],
   "finalBoardCardIds": [
    5043010,
    95454996,
    21848500,
    30118811,
    20726052
   ],
   "routeName": "保留回手與快速除外",
   "note": "寫出候選步驟；Firewall Dragon 與 Maliss <Q> White Binder 互相連結，保留回手條件。"
  },
  {
   "name": "回手終端轉無效",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    58699500,
    30342076,
    95454996,
    59859086,
    5043010,
    21848500,
    39138610
   ],
   "finalBoardCardIds": [
    39138610,
    95454996,
    21848500,
    20726052
   ],
   "routeName": "回手中繼改發動無效",
   "note": "寫出候選步驟；Firewall Dragon 作中繼，Allied Code Talker @Ignister 指向兩隻連結怪獸。"
  },
  {
   "name": "兩張偏好怪獸同留",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    58699500,
    30342076,
    95454996,
    59859086,
    5043010,
    46947713,
    39138610
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮以 Transcode Talker 僅作素材，但未整理出同時保留 Firewall Dragon 有效互相連結及 Allied Code Talker @Ignister 解放資源的完整路線。"
  },
  {
   "name": "非電子界除外中繼",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    58699500,
    29301450,
    9763474
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 S:P Little Knight 與 Haggard Lizardose 的除外轉場，但後段電子界特殊召喚限制會封鎖其出場，未寫出更佳終場。"
  },
  {
   "name": "其他電子界中繼",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    60303245,
    24842059,
    52698008,
    86066372
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 Salamangreat Almiraj、Linguriboh、Cyberse Wicckid 與 Accesscode Talker；前者需要調整通常召喚，其餘未整理出優於上述雙干擾終場的完整路線。"
  },
  {
   "name": "風引擎本家連結",
   "handCardIds": [
    54143349,
    20938824,
    30118811
   ],
   "extraDeckCardIds": [
    39341885
   ],
   "finalBoardCardIds": [],
   "routeName": "",
   "note": "考慮 Radiant Typhoon Varuroon, the Marine Eidolon，但其移入魔陷區效果不是快速效果，牌組也沒有可放置的本家永續陷阱；未採用。"
  }
 ],
 "starters": [
  {
   "cardIds": [
    32061192,
    30118811,
    20938824
   ],
   "kind": "multi",
   "description": "本家除外啟動、電子界檢索與手牌除外延伸互補，優先比較高資源終場；三張皆參與展開。"
  },
  {
   "cardIds": [
    68337209,
    30118811
   ],
   "kind": "multi",
   "description": "場地啟動本家並保留通常召喚；Backup @Ignister 增加檢索與素材，適合比較雙卡的干擾效率。"
  },
  {
   "cardIds": [
    32061192
   ],
   "kind": "single",
   "description": "不依賴額外起手或抽牌的核心單卡基準，可衡量增加起手卡實際帶來的干擾提升。"
  },
  {
   "cardIds": [
    54143349,
    20938824,
    30118811
   ],
   "kind": "multi",
   "description": "Radiant Typhoon Eldam 提供等級3素材與檢索；墓地本家資源和 Maliss <P> March Hare 連動，再由 Backup @Ignister 補電子界資源。"
  }
 ],
 "extenders": [],
 "usage": {
  "inputTokens": 53221,
  "outputTokens": 65626
 },
 "summary": "以下為候選角色與待分析起手，不含操作路線。以不抽牌、不依賴其餘起手牌為前提，優先研究有效干擾與資源配置。Firewall Dragon 須有互相連結才能計入回手干擾；Allied Code Talker @Ignister 須保留其箭頭指向的連結怪獸。兩者留場及僅作中繼的變體尚待後續分析，不預先承諾共存或干擾數。\n\n以上只涵蓋 AI 提出的起手組合，不代表已窮舉所有展開。"
};
