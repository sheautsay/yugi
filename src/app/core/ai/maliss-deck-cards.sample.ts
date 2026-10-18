/**
 * TEST DATA ONLY — the 41 distinct cards of the user's Maliss deck ({@link EDGE_SAMPLE}, 40 main + 15 extra)
 * exactly as the YGOPRODeck API v7 returns them (cardinfo.php?id=…&misc=yes, fetched 2026-10-09): name, type,
 * full English text, link rating, link arrows and type tags. Used as fixed card data for the CR-006 tests,
 * so no test needs the network. Excluded from the app build (`*.sample.ts`).
 */
import type { ApiCard } from '../card-api';

export const MALISS_DECK_API_CARDS: Array<ApiCard & { linkmarkers?: string[]; typeline?: string[] }> = [
  {
    "id": 94145021,
    "name": "Droll & Lock Bird",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If a card(s) is added from the Main Deck to your opponent's hand, except during the Draw Phase (Quick Effect): You can send this card from your hand to the GY; for the rest of this turn, cards cannot be added from either player's Main Deck to the hand.",
    "race": "Spellcaster",
    "attribute": "WIND",
    "level": 1,
    "atk": 0,
    "def": 0,
    "typeline": [
      "Spellcaster",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 23434538,
    "name": "Maxx \"C\"",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "During either player's turn: You can send this card from your hand to the Graveyard; this turn, each time your opponent Special Summons a monster(s), immediately draw 1 card. You can only use 1 \"Maxx \"C\"\" per turn.",
    "race": "Insect",
    "attribute": "EARTH",
    "archetype": "\"C\"",
    "level": 2,
    "atk": 500,
    "def": 200,
    "typeline": [
      "Insect",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Speed Duel",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 14558127,
    "name": "Ash Blossom & Joyous Spring",
    "type": "Tuner Monster",
    "frameType": "effect",
    "desc": "When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect.\n● Add a card from the Deck to the hand.\n● Special Summon from the Deck.\n● Send a card from the Deck to the GY.\nYou can only use this effect of \"Ash Blossom & Joyous Spring\" once per turn.",
    "race": "Zombie",
    "attribute": "FIRE",
    "level": 3,
    "atk": 0,
    "def": 1800,
    "typeline": [
      "Zombie",
      "Tuner",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 73642296,
    "name": "Ghost Belle & Haunted Mansion",
    "type": "Tuner Monster",
    "frameType": "effect",
    "desc": "When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that activation.\n● Add a card(s) from the GY to the hand, Deck, and/or Extra Deck.\n● Special Summon a Monster Card(s) from the GY.\n● Banish a card(s) from the GY.\nYou can only use this effect of \"Ghost Belle & Haunted Mansion\" once per turn.",
    "race": "Zombie",
    "attribute": "EARTH",
    "level": 3,
    "atk": 0,
    "def": 1800,
    "typeline": [
      "Zombie",
      "Tuner",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 69272449,
    "name": "Maliss <P> White Rabbit",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "You take no damage from battles involving \"Maliss\" Link Monsters that point to this card. You can only use each of the following effects of \"Maliss White Rabbit\" once per turn. If this card is Normal or Special Summoned: You can Set 1 \"Maliss\" Trap from your Deck with a different name than the cards in your GY. If this card is banished: You can pay 300 LP; Special Summon it, also you cannot Special Summon from the Extra Deck for the rest of this turn, except Link Monsters.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "level": 3,
    "atk": 1200,
    "def": 300,
    "typeline": [
      "Cyberse",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 96676583,
    "name": "Maliss <P> Chessy Cat",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "Any monster destroyed by battle with a \"Maliss\" Link Monster that points to this card is banished. You can only use each of the following effects of \"Maliss Chessy Cat\" once per turn. During your Main Phase: You can banish 1 \"Maliss\" card from your hand, then you can draw 2 cards. If this card is banished: You can pay 300 LP; Special Summon it, also you cannot Special Summon from the Extra Deck for the rest of this turn, except Link Monsters.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "level": 3,
    "atk": 1500,
    "def": 300,
    "typeline": [
      "Cyberse",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 32061192,
    "name": "Maliss <P> Dormouse",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "\"Maliss\" Link Monsters that point to this card cannot be destroyed by card effects. You can only use each of the following effects of \"Maliss Dormouse\" once per turn. During your Main Phase: You can activate this effect; banish 1 \"Maliss\" monster from your Deck, also for the rest of this turn, \"Maliss\" monsters you control gain 600 ATK. If this card is banished: You can pay 300 LP; Special Summon it, also you cannot Special Summon from the Extra Deck for the rest of this turn, except Link Monsters.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "level": 3,
    "atk": 900,
    "def": 300,
    "typeline": [
      "Cyberse",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 30118811,
    "name": "Backup @Ignister",
    "type": "Tuner Monster",
    "frameType": "effect",
    "desc": "If you control a Cyberse monster that was Special Summoned from the Extra Deck: You can Special Summon this card from your hand. If this card is Normal or Special Summoned: You can add 1 DARK Cyberse monster from your Deck to your hand, except \"Backup @Ignister\", then discard 1 card. You can only use each effect of \"Backup @Ignister\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "@Ignister",
    "level": 3,
    "atk": 1200,
    "def": 800,
    "typeline": [
      "Cyberse",
      "Tuner",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 20938824,
    "name": "Maliss <P> March Hare",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "Your opponent cannot target \"Maliss\" Link Monsters that point to this card with card effects. You can only use each of the following effects of \"Maliss March Hare\" once per turn. During the Main Phase, if this card is in your hand (Quick Effect): You can banish 1 other \"Maliss\" card from your hand or GY, and if you do, Special Summon this card. If this card is banished: You can pay 300 LP, then target 1 of your banished \"Maliss\" monsters; add it to your hand.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "level": 3,
    "atk": 600,
    "def": 300,
    "typeline": [
      "Cyberse",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 54143349,
    "name": "Radiant Typhoon Eldam",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If you have \"Mystical Space Typhoon\" in your GY, or your opponent controls no Spells/Traps, you can Special Summon this card (from your hand). You can only Special Summon \"Radiant Typhoon Eldam\" once per turn this way. If this card is Normal or Special Summoned: You can add 1 \"Radiant Typhoon\" monster (except \"Radiant Typhoon Eldam\") or 1 \"Mystical Space Typhoon\" from your Deck to your hand. You can only use this effect of \"Radiant Typhoon Eldam\" once per turn.",
    "race": "Beast",
    "attribute": "WIND",
    "archetype": "Radiant Typhoon",
    "level": 3,
    "atk": 1300,
    "def": 800,
    "typeline": [
      "Beast",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 80538047,
    "name": "Radiant Typhoon Swen",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If you have \"Mystical Space Typhoon\" in your GY, or your opponent controls no Spells/Traps, you can Special Summon this card (from your hand). You can only Special Summon \"Radiant Typhoon Swen\" once per turn this way. If this card is Normal or Special Summoned: You can add 1 \"Radiant Typhoon\" Spell/Trap or 1 \"Mystical Space Typhoon\" from your Deck to your hand. You can only use this effect of \"Radiant Typhoon Swen\" once per turn.",
    "race": "Beast-Warrior",
    "attribute": "WIND",
    "archetype": "Radiant Typhoon",
    "level": 3,
    "atk": 1600,
    "def": 400,
    "typeline": [
      "Beast-Warrior",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 42141493,
    "name": "Mulcharmy Fuwalos",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If you control no cards (Quick Effect): You can discard this card; apply these effects this turn.\n● Each time your opponent Special Summons a monster(s) from the Deck and/or Extra Deck, immediately draw 1 card.\n● Once, during this End Phase, if the number of cards in your hand is more than the number of cards your opponent controls +6, you must randomly shuffle cards from your hand into the Deck so the number in your hand equals the number your opponent controls +6.\nYou can only activate 1 other \"Mulcharmy\" monster effect, the turn you activate this effect.",
    "race": "Winged Beast",
    "attribute": "WIND",
    "archetype": "Mulcharmy",
    "level": 4,
    "atk": 100,
    "def": 600,
    "typeline": [
      "Winged Beast",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 3723262,
    "name": "Wizard @Ignister",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If you control a Cyberse monster that was Special Summoned from the Extra Deck: You can target 1 DARK Cyberse monster in your GY; Special Summon both this card in your hand and that monster, in Defense Position, also you cannot Special Summon for the rest of this turn, except Cyberse monsters. You can banish this card from your field or GY, then target 1 monster your opponent controls; change its battle position. You can only use each effect of \"Wizard @Ignister\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "@Ignister",
    "level": 4,
    "atk": 1800,
    "def": 800,
    "typeline": [
      "Cyberse",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 33854624,
    "name": "Bystial Magnamhut",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "You can target 1 LIGHT or DARK monster in either GY; banish it, and if you do, Special Summon this card from your hand. This is a Quick Effect if your opponent controls a monster. If this card is Special Summoned: You can activate this effect; during the End Phase of this turn, add 1 Dragon monster from your Deck or GY to your hand, except \"Bystial Magnamhut\". You can only use each effect of \"Bystial Magnamhut\" once per turn.",
    "race": "Dragon",
    "attribute": "DARK",
    "archetype": "Bystial",
    "level": 6,
    "atk": 2500,
    "def": 2000,
    "typeline": [
      "Dragon",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 6637331,
    "name": "Bystial Druiswurm",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "You can target 1 LIGHT or DARK monster in either GY; banish it, and if you do, Special Summon this card from your hand. This is a Quick Effect if your opponent controls a monster. If this card is sent from the field to the GY: You can target 1 Special Summoned monster your opponent controls; send it to the GY. You can only use each effect of \"Bystial Druiswurm\" once per turn.",
    "race": "Dragon",
    "attribute": "DARK",
    "archetype": "Bystial",
    "level": 6,
    "atk": 2500,
    "def": 2000,
    "typeline": [
      "Dragon",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Speed Duel",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 27204311,
    "name": "Nibiru, the Primal Being",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "During the Main Phase, if your opponent Normal or Special Summoned 5 or more monsters this turn (Quick Effect): You can Tribute as many face-up monsters on the field as possible, and if you do, Special Summon this card from your hand, then Special Summon 1 \"Primal Being Token\" (Rock/LIGHT/Level 11/ATK ?/DEF ?) to your opponent's field. (This Token's ATK/DEF become the combined original ATK/DEF of the Tributed monsters.) You can only use this effect of \"Nibiru, the Primal Being\" once per turn.",
    "race": "Rock",
    "attribute": "LIGHT",
    "level": 11,
    "atk": 3000,
    "def": 600,
    "typeline": [
      "Rock",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 75500286,
    "name": "Gold Sarcophagus",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Banish 1 card from your Deck, face-up. During your second Standby Phase after this card's activation, add that card to the hand.",
    "race": "Normal",
    "misc_info": [
      {
        "formats": [
          "Duel Links",
          "Common Charity",
          "Edison",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 68337209,
    "name": "Maliss in Underground",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "When this card is activated: You can banish 1 \"Maliss\" card from your hand, Deck, or GY. While 3 or more of your \"Maliss\" Traps with different names are banished, \"Maliss\" Link Monsters you control gain 3000 ATK. While you control a \"Maliss\" Link Monster, your opponent's monsters can only target \"Maliss\" Link Monsters for attacks. You can only activate 1 \"Maliss in Underground\" per turn.",
    "race": "Field",
    "archetype": "Maliss",
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 5318639,
    "name": "Mystical Space Typhoon",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Target 1 Spell/Trap on the field; destroy that target.",
    "race": "Quick-Play",
    "misc_info": [
      {
        "formats": [
          "GOAT",
          "OCG GOAT",
          "Duel Links",
          "Common Charity",
          "Edison",
          "Speed Duel",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 65681983,
    "name": "Crossout Designator",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Declare 1 card name; banish 1 of that declared card from your Main Deck, and if you do, negate its effects, as well as the activated effects and effects on the field of cards with the same original name, until the end of this turn. You can only activate 1 \"Crossout Designator\" per turn.",
    "race": "Quick-Play",
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 67115133,
    "name": "Radiant Typhoon Chant",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "If this card is destroyed by the effect of \"Mystical Space Typhoon\": You can Set this card. Activate 1 of these effects (but you can only use each of these effects of \"Radiant Typhoon Chant\" once per turn);\n● Add 1 Level 4 or lower \"Radiant Typhoon\" monster from your Deck to your hand.\n● Add 1 \"Mystical Space Typhoon\" from your Deck or GY to your hand.",
    "race": "Quick-Play",
    "archetype": "Radiant Typhoon",
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 20508881,
    "name": "Radiant Typhoon Vision",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "If this card is destroyed by the effect of \"Mystical Space Typhoon\": You can Set this card. Activate 1 of these effects (but you can only use each of these effects of \"Radiant Typhoon Vision\" once per turn);\n● Draw 2 cards, then if you have a \"Radiant Typhoon\" card or a Quick-Play Spell in your hand, discard 1 of them, or your entire hand if you don't.\n● Add 1 \"Mystical Space Typhoon\" from your Deck or GY to your hand.",
    "race": "Quick-Play",
    "archetype": "Radiant Typhoon",
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 10045474,
    "name": "Infinite Impermanence",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Target 1 face-up monster your opponent controls; negate its effects (until the end of this turn), then, if this card was Set before activation and is on the field at resolution, for the rest of this turn all other Spell/Trap effects in this column are negated. If you control no cards, you can activate this card from your hand.",
    "race": "Normal",
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 94722358,
    "name": "Maliss <C> MTP-07",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "You can activate this card the turn it was Set, by banishing 1 face-up \"Maliss\" monster you control. Add 1 \"Maliss\" monster from your Deck to your hand, then if you control a \"Maliss\" Link Monster, you can banish 1 card on the field. You can only activate 1 \"Maliss MTP-07\" per turn.",
    "race": "Normal",
    "archetype": "Maliss",
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 20726052,
    "name": "Maliss <C> GWC-06",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "You can activate this card the turn it was Set, by banishing 1 face-up \"Maliss\" monster you control. Special Summon 1 of your \"Maliss\" monsters that is banished or in your GY, then if you control a \"Maliss\" Link Monster, you can gain LP equal to the original ATK of that Special Summoned monster. You can only activate 1 \"Maliss GWC-06\" per turn.",
    "race": "Normal",
    "archetype": "Maliss",
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 57111661,
    "name": "Maliss <C> TB-11",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "You can activate this card the turn it was Set, by banishing 1 face-up \"Maliss\" monster you control. Special Summon 1 \"Maliss\" monster from your Deck, or if your opponent controls 3 or more cards, you can Special Summon 1 \"Maliss\" Link Monster from your Extra Deck instead. For the rest of this turn, that Summoned monster cannot attack and neither player can activate its effects. You can only activate 1 \"Maliss TB-11\" per turn.",
    "race": "Normal",
    "archetype": "Maliss",
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 60303245,
    "name": "Salamangreat Almiraj",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "1 Normal Summoned monster with 1000 or less ATK\n(Quick Effect): You can Tribute this card, then target 1 monster you control; it cannot be destroyed by your opponent's card effects this turn. When a Normal Summoned monster you control is destroyed by battle, while this card is in your GY: You can Special Summon this card. You can only use this effect of \"Salamangreat Almiraj\" once per turn.",
    "race": "Cyberse",
    "attribute": "FIRE",
    "archetype": "Salamangreat",
    "linkval": 1,
    "atk": 0,
    "linkmarkers": [
      "Bottom-Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 24842059,
    "name": "Linguriboh",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "1 Level 4 or lower Cyberse monster\nWhen your opponent activates a Trap Card (Quick Effect): You can Tribute this card; negate that card's effect, and if you do, banish it. If this card is in your GY (Quick Effect): You can Tribute 1 \"@Ignister\" monster that was Summoned from the Extra Deck; Special Summon this card. You can only use each effect of \"Linguriboh\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Kuriboh",
    "linkval": 1,
    "atk": 300,
    "linkmarkers": [
      "Bottom-Left"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 30342076,
    "name": "Link Decoder",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "1 Level 4 or lower Cyberse monster\nIf this card is sent to the GY as material for a Cyberse Link Monster with 2300 or more original ATK: You can Special Summon this card, but banish it when it leaves the field. You can only use this effect of \"Link Decoder\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "linkval": 1,
    "atk": 300,
    "linkmarkers": [
      "Bottom"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 58699500,
    "name": "Cherubini, Ebon Angel of the Burning Abyss",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 Level 3 monsters\nMonsters this card points to cannot be destroyed by card effects. If this card would be destroyed by battle or an opponent's card effect, you can send 1 other card you control to the GY instead. You can send 1 Level 3 monster from your Deck to the GY, then target 1 \"Burning Abyss\" monster on the field; it gains ATK/DEF equal to the ATK/DEF of the monster sent to the GY, until the end of this turn. You can only use this effect of \"Cherubini, Ebon Angel of the Burning Abyss\" once per turn.",
    "race": "Fairy",
    "attribute": "DARK",
    "archetype": "Burning Abyss",
    "level": 0,
    "linkval": 2,
    "atk": 500,
    "linkmarkers": [
      "Bottom-Left",
      "Bottom-Right"
    ],
    "typeline": [
      "Fairy",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 52698008,
    "name": "Cyberse Wicckid",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 Cyberse monsters\nThis Link Summoned card cannot be destroyed by battle or card effects. Cyberse monsters this card points to cannot be destroyed by card effects. If a monster(s) is Special Summoned to a zone(s) this card points to while you control this monster (except during the Damage Step): You can banish 1 Cyberse monster from your GY; add 1 Cyberse Tuner from your Deck to your hand. You can only use this effect of \"Cyberse Wicckid\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "linkval": 2,
    "atk": 800,
    "linkmarkers": [
      "Bottom",
      "Bottom-Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 59859086,
    "name": "Splash Mage",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 Cyberse monsters\nYou can target 1 Cyberse monster in your GY; Special Summon it in Defense Position, but negate its effects, also you cannot Special Summon monsters for the rest of this turn, except Cyberse monsters. You can only use this effect of \"Splash Mage\" once per turn.",
    "race": "Cyberse",
    "attribute": "WATER",
    "linkval": 2,
    "atk": 1100,
    "linkmarkers": [
      "Top-Right",
      "Bottom-Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 29301450,
    "name": "S:P Little Knight",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 Effect Monsters\nIf this card is Link Summoned using a Fusion, Synchro, Xyz, or Link Monster as material: You can target 1 card on the field or in either GY; banish it, also your monsters cannot attack directly this turn. When your opponent activates a card or effect (Quick Effect): You can target 2 face-up monsters on the field, including a monster you control; banish both until the End Phase. You can only use each effect of \"S:P Little Knight\" once per turn.",
    "race": "Warrior",
    "attribute": "DARK",
    "linkval": 2,
    "atk": 1600,
    "linkmarkers": [
      "Left",
      "Right"
    ],
    "typeline": [
      "Warrior",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 9763474,
    "name": "Haggard Lizardose",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 monsters with different names\nYou can banish 1 monster from your face-up field or GY with 2000 or less ATK, then target 1 face-up monster on the field; make its ATK become equal to the original ATK of the monster banished to activate this effect (until the end of this turn), then if you banished a monster that was originally Reptile, draw 1 card. You can only use this effect of \"Haggard Lizardose\" once per turn.",
    "race": "Reptile",
    "attribute": "WATER",
    "linkval": 2,
    "atk": 800,
    "linkmarkers": [
      "Right",
      "Bottom"
    ],
    "typeline": [
      "Reptile",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 39341885,
    "name": "Radiant Typhoon Varuroon, the Marine Eidolon",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2 \"Radiant Typhoon\" monsters\nIf this card is Link Summoned: You can add 1 \"Mystical Space Typhoon\" from your Deck or GY to your hand. You can target 2 face-up monsters on the field, including 1 \"Radiant Typhoon\" monster you control; place them face-up in their owners' Spell & Trap Zones as Continuous Spells. If a Quick-Play Spell Card is activated (except during the Damage Step): You can place 1 \"Radiant Typhoon\" Continuous Trap from your Deck or GY, face-up on your field. You can only use each effect of \"Radiant Typhoon Varuroon, the Marine Eidolon\" once per turn.",
    "race": "Aqua",
    "attribute": "WIND",
    "archetype": "Radiant Typhoon",
    "linkval": 2,
    "atk": 0,
    "linkmarkers": [
      "Bottom-Left",
      "Bottom-Right"
    ],
    "typeline": [
      "Aqua",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 46947713,
    "name": "Transcode Talker",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2+ Effect Monsters\nWhile this card is co-linked, it and its co-linked monsters gain 500 ATK, also your opponent cannot target any of them with card effects. You can target 1 Link-3 or lower Cyberse Link Monster in your GY, except \"Transcode Talker\"; Special Summon it to your zone this card points to. You cannot Special Summon monsters the turn you activate this effect, except Cyberse monsters. You can only use this effect of \"Transcode Talker\" once per turn.",
    "race": "Cyberse",
    "attribute": "EARTH",
    "archetype": "Code Talker",
    "level": 0,
    "linkval": 3,
    "atk": 2300,
    "linkmarkers": [
      "Top",
      "Right",
      "Bottom"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 95454996,
    "name": "Maliss <Q> White Binder",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2+ monsters, including a \"Maliss\" monster\nIf this card is Special Summoned: You can target up to 3 cards in any GY(s); banish them. During your Main Phase: You can Set 1 \"Maliss\" Trap from your Deck or GY. If this card is banished: You can pay 900 LP; Special Summon it, then you can draw 1 card. You can only use each effect of \"Maliss White Binder\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "linkval": 3,
    "atk": 2300,
    "linkmarkers": [
      "Top",
      "Left",
      "Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 21848500,
    "name": "Maliss <Q> Hearts Crypter",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "3 monsters, including a \"Maliss\" monster\n(Quick Effect): You can target 1 of your banished \"Maliss\" cards; shuffle it into the Deck, and if you do, banish 1 card on the field (while this card points to a monster, this effect and its activation cannot be negated). If this card is banished: You can pay 900 LP; Special Summon it and double its ATK. You can only use each effect of \"Maliss Hearts Crypter\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Maliss",
    "linkval": 3,
    "atk": 2500,
    "linkmarkers": [
      "Top",
      "Bottom-Left",
      "Bottom-Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Common Charity",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 5043010,
    "name": "Firewall Dragon",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2+ monsters\nOnce while face-up on the field (Quick Effect): You can target monsters on the field and/or GY up to the number of monsters co-linked to this card; return them to the hand. If a monster this card points to is destroyed by battle or sent to the GY: You can Special Summon 1 Cyberse monster from your hand. You can only use each effect of \"Firewall Dragon\" once per turn.",
    "race": "Cyberse",
    "attribute": "LIGHT",
    "linkval": 4,
    "atk": 2500,
    "linkmarkers": [
      "Top",
      "Left",
      "Right",
      "Bottom"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "Duel Links",
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 86066372,
    "name": "Accesscode Talker",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "2+ Effect Monsters\nYour opponent cannot activate cards or effects in response to this card's effect activations. If this card is Link Summoned: You can target 1 Link Monster that was used as material for its Link Summon; this card gains ATK equal to that monster's Link Rating x 1000. You can banish 1 Link Monster from your field or GY; destroy 1 card your opponent controls, also for the rest of this turn, you cannot banish monsters with that same Attribute to activate this effect of \"Accesscode Talker\".",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "Code Talker",
    "linkval": 4,
    "atk": 2300,
    "linkmarkers": [
      "Top",
      "Left",
      "Right",
      "Bottom"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  },
  {
    "id": 39138610,
    "name": "Allied Code Talker @Ignister",
    "type": "Link Monster",
    "frameType": "link",
    "desc": "3+ Effect Monsters\nIf this card is Link Summoned: You can Special Summon as many Cyberse monsters with 2300 ATK from your GY as possible to your zones this card points to, and if you do, this card gains 500 ATK for each, also you cannot Special Summon for the rest of this turn. When your opponent activates a card or effect (Quick Effect): You can Tribute 1 of your Link Monsters this card points to; negate the activation, and if you do, banish that card. You can only use this effect of \"Allied Code Talker @Ignister\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "archetype": "@Ignister",
    "linkval": 5,
    "atk": 2300,
    "linkmarkers": [
      "Left",
      "Right",
      "Bottom-Left",
      "Bottom",
      "Bottom-Right"
    ],
    "typeline": [
      "Cyberse",
      "Link",
      "Effect"
    ],
    "misc_info": [
      {
        "formats": [
          "TCG",
          "OCG",
          "Master Duel"
        ]
      }
    ]
  }
];
