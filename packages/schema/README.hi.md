<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

[वर्ल्ड फोर्ज](https://github.com/mcp-tool-shop-org/world-forge) के लिए मुख्य टाइपस्क्रिप्ट प्रकार - एक 2डी दुनिया निर्माण स्टूडियो, जो एआई आरपीजी इंजन के लिए है।

## प्रकार

- **स्थानिक:** `WorldMap` (विश्व मानचित्र), `Zone` (क्षेत्र), `ZoneExit` (क्षेत्र से बाहर निकलने का मार्ग), `ZoneConnection` (क्षेत्र कनेक्शन), `Landmark` (महत्वपूर्ण स्थान), `Interactable` (इंटरैक्ट करने योग्य)।
- **जिले:** `District` (जिला), `DistrictMetrics` (जिला मेट्रिक्स), `EconomyProfile` (अर्थव्यवस्था प्रोफाइल), `FactionPresence` (गुट की उपस्थिति), `PressureHotspot` (दबाव का केंद्र)।
- **इकाइयां:** `EntityPlacement` (इकाई का स्थान) (जिसमें `EntityStats` (इकाई आँकड़े), `EntityResources` (इकाई संसाधन), `EntityAI` (इकाई कृत्रिम बुद्धिमत्ता) शामिल हैं), `ItemPlacement` (वस्तु का स्थान) (जिसमें `ItemSlot` (वस्तु स्लॉट), `ItemRarity` (वस्तु की दुर्लभता) शामिल हैं), `SpawnPoint` (उत्पत्ति बिंदु), `EncounterAnchor` (मुठभेड़ बिंदु), `CraftingStation` (निर्माण स्टेशन), `MarketNode` (बाजार नोड)।
- **दृश्य:** `Tileset` (टाइल्स का सेट), `TileDefinition` (टाइल्स की परिभाषा), `TileLayer` (टाइल्स की परत), `PropDefinition` (वस्तु की परिभाषा), `PropPlacement` (वस्तु का स्थान), `AmbientLayer` (वातावरण परत)।
- **परियोजना:** `WorldProject` - पूरी निर्मित दुनिया का कंटेनर।
- **सत्यापन:** `validateProject()` जिसमें 54 संरचनात्मक जांच शामिल हैं।

## स्थापना

```bash
npm install @world-forge/schema
```

## उपयोग

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## लाइसेंस

एमआईटी
