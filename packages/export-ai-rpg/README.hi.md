<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

[वर्ल्ड फोर्ज](https://github.com/mcp-tool-shop-org/world-forge) के लिए एक्सपोर्ट पाइपलाइन — यह एक `WorldProject` को [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) के `ContentPack` में बदलता है।

## इंस्टॉलेशन

```bash
npm install @world-forge/export-ai-rpg
```

## एपीआई

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);
if (!result.success) {
  console.error(result.errors);
} else {
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## सीएलआई

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## कौन सा एक्सपोर्टर चुनें?

वर्ल्ड फोर्ज कई इंजन एक्सपोर्टर प्रदान करता है। वह चुनें जो आपके
लक्षित रनटाइम से मेल खाता हो:

| एक्सपोर्टर | लक्ष्य | कब उपयोग करें... |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (यह पैकेज) | [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) `ContentPack` | यदि आप एक टेक्स्ट-आधारित, सिस्टम-संचालित एआई आरपीजी चाहते हैं — जैसे एनपीसी, जिले, गुट, संवाद ग्राफ, प्रगति वृक्ष। |
| `@world-forge/export-unreal` | अनरियल इंजन 5 2.5D प्रोजेक्ट | यदि आप एक 2.5D अनरियल गेम बना रहे हैं और आपको लेवल/एक्टर/डेटा-टेबल की आवश्यकता है। |
| `@world-forge/export-godot` | गोडॉट 4 प्रोजेक्ट | यदि आप एक गोडॉट 4 आरपीजी बना रहे हैं और आपको सीन और संसाधन चाहिए। |

यदि आप निश्चित नहीं हैं, तो यहां से शुरुआत करें (`export-ai-rpg`) — यह संदर्भ एक्सपोर्टर है और यह सबसे समृद्ध सिस्टम लेयर प्रदान करता है।

## यह क्या बदलता है

| वर्ल्ड फोर्ज | इंजन |
|-------------|--------|
| ज़ोन | `ZoneDefinition[]` |
| जिले | `DistrictDefinition[]` |
| इकाई प्लेसमेंट | `EntityBlueprint[]` (आंकड़ों, संसाधनों, एआई के साथ) |
| आइटम प्लेसमेंट | `ItemDefinition[]` (स्लॉट, दुर्लभता, संशोधक के साथ) |
| प्रोजेक्ट मेटाडेटा | `GameManifest` + `PackMetadata` |

## लाइसेंस

एमआईटी
