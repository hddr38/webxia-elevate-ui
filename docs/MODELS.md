# Modèles NVIDIA utilisés par Webi

## Chat — primaire (défaut)

- **Modèle** : `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
- **Env** : `NVIDIA_NIM_DEFAULT_MODEL`
- **Rôle** : réponses par défaut du chat
- **Justification** : modèle multimodal (omni) — prépare les futurs inputs
  vocaux et images. Modèle de raisonnement, adapté aux interactions riches.

## Chat — fallback

- **Modèle** : `nvidia/nemotron-3.5-lightning-30b-a3b`
- **Env** : `NVIDIA_NIM_FALLBACK_MODEL`
- **Déclencheurs** : TIMEOUT, 5xx, 429 (voir « Runtime — fallback »)
- **Rôle** : rattraper les échecs du primaire — latence optimisée

## Runtime — fallback (LOT 22)

Le `ModelRouter` **implémente `LLMProvider`** et est passé tel quel à
l'orchestrateur (`chat.ts`) : le fallback tourne en production, pas
seulement dans les tests.

**Déclencheurs de bascule** (primaire → fallback) :

1. Chunk d'erreur recoverable `TIMEOUT` / `UNAVAILABLE` / `RATE_LIMIT`
   reçu **avant tout contenu streamé** (saturation, file d'attente NIM).
2. Erreur in-band SSE (`HTTP 200` + `{"error":{...}}`) — typiquement
   `ResourceExhausted: Worker local total request limit reached (16/16)`,
   saturation intermittente du déploiement nano-omni :
   `EXHAUSTED`/`429` → `RATE_LIMIT` · 5xx → `UNAVAILABLE` · 4xx →
   `INVALID_REQUEST` (non-recoverable, **pas** de fallback).
3. Flux primaire terminé **sans aucun chunk** (erreur avaliee en amont).

**Ne bascule jamais** après qu'un contenu a déjà été transmis au client
(éviterait un texte en double) ni sur les erreurs 4xx logiques.

**Sticky** : une fois le fallback engagé (le router est créé par requête),
tous les appels suivants — dont les steps de tool-loop — partent
directement sur le modèle fallback, sans re-payer le timeout primaire.

**Fenêtres de timeout** (obligatoirement croisées, sinon le lifecycle tue
la requête avant que le fallback puisse se déclencher) :

| Qui                    | Valeur    | Source                   |
| ---------------------- | --------- | ------------------------ |
| TTFB LLM (primaire)    | **45 s**  | `llmConfig` dans chat.ts |
| TTFB embeddings        | 120 s     | `nvidiaConfig` chat.ts   |
| Lifecycle requête      | 110 s     | `CHAT_REQUEST_TIMEOUT_MS` (`.env`) — défaut 60 s si absent |

**Observabilité** : `[Webi] FALLBACK <provider>/<primaire> → <fallback> (<REASON>)`
en `console.warn` — raison = code de l'erreur ou `EMPTY_STREAM`.

**Chronologie type (saturation)** : T0 requête → T+45 s timeout primaire →
bascule lightning → réponse ≈ T+46 s, dans le budget lifecycle 110 s.

## Embeddings (RAG + mémoire)

- **Modèle** : `nvidia/nemotron-3-embed-1b`
- **Env** : `NVIDIA_NIM_EMBEDDING_MODEL` (nom seul — dimensions verrouillées)
- **Dimensions** : `vector(2048)` (non configurable par env)
- **Rôle** : indexation Knowledge Base + retrieval + ai_memory
- **Note** : toute rotation de ce modèle implique une migration DB
  (dimensions + HNSW) et une régénération des embeddings — lot dédié

## Endpoint

- `NVIDIA_NIM_BASE_URL` = `https://integrate.api.nvidia.com/v1`

## Reasoning — état actuel

**Configuration actuelle** : le provider envoie
`chat_template_kwargs: { enable_thinking: false }` en top-level pour
tout modèle déclaré `capabilities.thinking === true` (nano-omni,
lightning). Choix produit : priorité au TTFB (Time To First Byte)
sur le raisonnement explicite.

**Non utilisé actuellement** :

- `reasoning_budget` : aucune occurrence dans le code
- `extra_body` : aucune occurrence
- `reasoning_content` : compté dans les deltas mais non rendu côté texte

**À activer dans un lot dédié** (si pertinent) :

- Configurer `reasoning_budget` et `enable_thinking` par rôle
- Exposer `reasoning_content` en événement SSE séparé (optionnel)
- Mesurer l'impact TTFB réel (appels NVIDIA facturés)
- Pour les futurs inputs multimodaux (image, audio), activer le
  raisonnement uniquement sur ces requêtes (analyse complexe) plutôt
  que sur le chat texte courant

## Notes

- Aucun tier "raisonnement" configuré pour l'instant.
- Le modèle `ultra-550b-a55b` n'est plus utilisé (retiré des fixtures
  au LOT 20).
