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
- **Déclencheurs** : TIMEOUT, 5xx, 429
- **Rôle** : rattraper les échecs du primaire — latence optimisée

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
