# Ce site est fermé — tout est passé sur Mijoto

**24/09/2026.** `www.foxfood.fr` redirige désormais vers
`https://www.mijoto.com/login`. Le code de cette application n'est plus servi.

## Pourquoi

La bascule vers la v2 a eu lieu le **18/08/2026**, mais ce site est resté en
ligne. Pendant cinq semaines, il a continué de vivre sa vie :

- **7 clientes s'y sont inscrites** après la bascule — elles n'existaient donc
  pas dans la v2 et ne pouvaient pas s'y connecter. L'une d'elles a fini par
  écrire à Emeric : *« mon mot de passe marche sur l'ancien lien, pas sur le
  nouveau »*. C'est ce message qui a fait découvrir le reste.
- **25 commandes y ont été passées**, dont **7 pour la semaine du 21/09** —
  invisibles dans le planning de la v2.
- **Le cron tournait toujours** : 45 relances envoyées aux clientes le 23/09 au
  matin, en plus de celles de la v2. Elles recevaient deux rappels pour la même
  semaine, depuis deux systèmes différents.

Deux applications vivantes sur le même fichier client, ça ne se répare pas au
cas par cas : il faut en fermer une.

## Ce qui a été fait

- `vercel.json` : toutes les routes redirigent vers la page de connexion de
  Mijoto. **Redirection temporaire (307), pas permanente** — une 308 est mise
  en cache par les navigateurs pour toujours et serait très pénible à défaire
  si l'on devait rouvrir en urgence.
- **Le cron a été retiré** du même fichier. C'était l'autre moitié du problème :
  sans ça, le site aurait continué d'écrire aux clientes même redirigé, puisque
  les tâches planifiées ne passent pas par les redirections.
- Les clientes restées de ce côté ont été migrées vers la v2 avec leur mot de
  passe, leurs favoris et leur historique
  (`foxfood-v2/scripts/migrer-clientes-v1.ts`).

## La base de données n'est pas touchée

Elle reste en ligne et lisible (projet Neon `ep-calm-band-abjxishc`). C'est la
seule copie de référence de l'avant-bascule : recettes d'origine, historique
complet, favoris. **Ne pas la supprimer** tant que la v2 n'a pas tourné
plusieurs mois.

Pour la relire :

```bash
cd foxfood-v2
OLD_POSTGRES_URL=<url v1> npx tsx --env-file=.env.prod.backup <script>
```

## Pour rouvrir (si un jour il le faut)

Retirer le bloc `redirects` de `vercel.json` et redéployer. Le code est intact,
rien n'a été supprimé.
