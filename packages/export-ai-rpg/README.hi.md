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
if ('ok' in result) {
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

## यह क्या बदलता है

| वर्ल्ड फोर्ज | इंजन |
|-------------|--------|
| ज़ोन | `ZoneDefinition[]` |
| ज़िले | `DistrictDefinition[]` |
| एंटिटी प्लेसमेंट | `EntityBlueprint[]` (आंकड़ों, संसाधनों और एआई के साथ) |
| आइटम प्लेसमेंट | `ItemDefinition[]` (स्लॉट, दुर्लभता और संशोधकों के साथ) |
| प्रोजेक्ट मेटाडेटा | `GameManifest` + `PackMetadata` |

## लाइसेंस

एमआईटी
