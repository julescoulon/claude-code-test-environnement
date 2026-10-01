# Méthode : comment « Graine 0 » a été fabriqué

Ce document explique la fabrication du film et la façon de réutiliser les outils pour un autre court-métrage. Le récit et les choix artistiques sont dans `NOTES.md`.

En bref :

- **Tout est du code.** Un moteur WebGL (three.js) dessine chaque image en fonction du temps `t`. Un navigateur sans tête capture les images.
- **Un seul plan photoréaliste**, rendu avec Blender (Cycles) piloté en Python.
- **Assemblage en Python** : le Big Crunch, le MP4 et les planches sont produits par des scripts Python et ffmpeg.
- **Une commande refait tout** : `./render.sh`.

---

## 1. Les outils

### Utilisés

| Outil | Version | Licence | Rôle |
|---|---|---|---|
| Node.js | 22.22 | MIT | exécute le serveur local et la capture |
| three.js (`three`) | 0.186.1 | MIT | 3D, passes plein écran, cibles de rendu |
| playwright-core | 1.63.0 | Apache 2.0 | pilote Chromium sans tête |
| Chromium | 141.0.7390 | BSD (et licences tierces) | rendu WebGL2 |
| SwiftShader (inclus dans Chromium) | | Apache 2.0 | WebGL logiciel, sans carte graphique |
| @fontsource/jetbrains-mono | 5.3.0 | OFL 1.1 | glyphes de la phase 3, texte imprimé de la feuille |
| @fontsource/caveat | 5.3.0 | OFL 1.1 | écriture manuscrite de la feuille de storyboard |
| Python | 3.11 | PSF | orchestration, Crunch, assemblage, feuille |
| bpy (Blender en module Python) | 4.2.0 | GPL 3 | plan photoréaliste, moteur Cycles sur CPU |
| OpenImageDenoise (inclus dans bpy) | | Apache 2.0 | débruitage des images Cycles |
| numpy | 2.4.6 | BSD 3 | calcul d'images (Crunch, feuille, script couleur) |
| Pillow | 12.3.0 | HPND (type MIT) | lecture et écriture des PNG, dessin du texte |
| fontTools + brotli | 4.66.1 | MIT | conversion des polices woff2 en TTF pour Pillow |
| imageio-ffmpeg | 0.6.0 | BSD 2 | ffmpeg de secours si aucun n'est installé |
| ffmpeg (système) + libx264 | 6.1.1 | LGPL / GPL (x264) | encodage H.264 |
| git-lfs | 3.4.1 | MIT | stockage du MP4 (171 Mo, au-delà de la limite de GitHub) |

Aucune API externe, aucun service payant, aucun modèle de génération d'images.

### Essayés puis écartés

| Essai | Pourquoi écarté |
|---|---|
| Traînées de particules par tampon de rétroaction (accumulation d'une image à la suivante) | Une image dépendrait de la précédente, donc impossible de reprendre un plan au milieu. Remplacé par des trajectoires analytiques : chaque segment de traînée recalcule la position à `t` moins un petit décalage. |
| Blender en 1080p natif, 96 échantillons | Mesuré à environ 8 min par image, soit 17 h pour le plan. Rendu final en 1440×810 à 40 échantillons, puis agrandissement bicubique. |
| Filmic / AgX dans Blender | Ils modifient les couleurs de l'image du film affichée dans la bille. La transformation « Standard » restitue exactement les pixels du navigateur, ce qui rend le raccord invisible. |
| Lumière du cœur à 0,35 W dans la bille | Image entièrement brûlée (le papier est à 1 cm). Réglé à 0,004 W. |
| Disque intérieur opaque | Il formait une pupille noire géante. Le noir devient transparent à mesure que la caméra sort de la bille. |
| Premier portail de la faille, en étoile dentelée | Peu lisible et sans rapport avec le récit. Remplacé par une fente en amande qui s'ouvre comme une paupière, en rime avec l'iris. |
| Cycle de palette sur 5 couleurs | Scintillement global désagréable. Limité aux 3 tons moyens, en vagues décalées dans l'espace. |
| Réaction-diffusion « corail » | Grosses taches blanches envahissantes. Passée en régime « mitose » (cellules qui se divisent), avec une contribution plafonnée. |
| Profil du Big Crunch en sinus étroit | Restait 2 s à vitesse 1× puis accélérait d'un coup. Remplacé par une rampe exponentielle régulière. |
| `pngjs`, police Major Mono Display | Installées au départ, jamais utilisées : retirées. |
| Plans B prévus par le brief (`@sparticuz/chromium`, `skia-python`, scène photoréaliste en three.js) | Non nécessaires : le Chromium de Playwright et `bpy` ont fonctionné du premier coup. |

---

## 2. Le procédé, étape par étape

### Étape 0 : installer (une fois)

```bash
git lfs install && git clone <dépôt> && cd <dépôt>
npm ci                                  # three, playwright-core, polices
npx playwright install chromium         # seulement si aucun Chromium n'est présent (sinon CHROME=/chemin/chrome)
python3.11 -m pip install -r requirements.txt   # bpy 4.2 exige Python 3.11
```

ffmpeg système est préférable ; à défaut, `imageio-ffmpeg` en fournit un.

### Étape 1 : la partition (avant tout code)

J'ai d'abord écrit `NOTES.md` : l'intention, le script couleur, la grille de tempo, le tableau des transitions et les familles techniques par phase. Les temps clés de cette partition sont recopiés dans `src/tempo.js` (objet `B`). Tout le reste en découle.

### Étape 2 : valider la chaîne sur une transition

J'ai rendu quelques images de test avec la capture, en 540p, puis vérifié sur des planches-contact :

```bash
node pipeline/capture.mjs --out render/test/p3 --w 960 --h 540 --times 9.6,10.2,10.8,11.3
python3 pipeline/contact.py render/test/p3 render/test/p3.png --cols 4 --width 480
```

`--times` rend des instants précis ; `--from` et `--to` rendent un intervalle complet.

### Étape 3 : construire les phases une par une

Pour chaque phase, j'ai suivi la même boucle :
1. écrire le calque dans `src/layers/` ;
2. le brancher dans `direct(t)` (paramètres) et `renderScene(t)` (composition) de `src/main.js` ;
3. rendre 10 à 20 instants clés en 540p ;
4. regarder la planche-contact ;
5. corriger, et recommencer.

### Étape 4 : la maquette complète (480p, 12 i/s)

```bash
./render.sh --preview        # environ 20 min ; résultat dans preview/film_maquette.mp4
python3 pipeline/contact.py preview/04_structures render/test/pv04.png --cols 8 --width 240 --every 3 --fps 12
```

J'ai relu chaque plan sur une planche dense, puis corrigé : scintillement de palette, chimie, poussée caméra, Big Crunch, disque de la bille, exposition Blender.

### Étape 5 : le rendu final, en arrière-plan

```bash
nohup ./render.sh > render/logs/final.log 2>&1 &
tail -f render/logs/final.log              # « terminé. » à la fin
```

`render.sh` appelle `pipeline/render_all.py`, qui enchaîne :
1. les six plans navigateur, deux en parallèle ;
2. l'intérieur de la bille (`--query mode=feed`) ;
3. la feuille de storyboard, tirée des images déjà rendues ;
4. Blender ;
5. la composition du plan Lumière ;
6. le Big Crunch ;
7. l'assemblage final.

Durées mesurées sur 4 cœurs sans GPU : environ 1 h 15 de navigateur et 4 h de Cycles.

### Étape 6 : vérifier

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames \
        -show_entries format=duration,nb_streams out/film.mp4
```

La boucle se vérifie en comparant l'image 1151 à l'image 0. Leur écart moyen doit égaler celui entre deux images voisines. Le calcul (numpy) est décrit dans `NOTES.md`, section « Vérifications ».

---

## 3. La structure

```
render.sh                 commande unique : installe ce qui manque, puis lance pipeline/render_all.py
package.json, package-lock.json   dépendances Node figées
requirements.txt          dépendances Python figées (Python 3.11)
.gitignore                exclut node_modules/, render/, preview/ (images intermédiaires)
.gitattributes            out/film.mp4 stocké par Git LFS
NOTES.md                  partition : intention, couleurs, tempo, transitions, bilan
METHODE.md                ce document
STATE.md                  état de reprise (utile si une session est interrompue)

src/                      le moteur, chargé dans Chromium
  index.html              page de rendu : polices, carte d'import de three.js, canvas
  main.js                 window.renderFrame(t) : direction (direct), mondes, plans, flou de mouvement, raccord Cycles
  tempo.js                grille rythmique 100 → 140 BPM, temps clés (B, T), impulsions (pulse, hit)
  anim.js                 courbes d'animation : ressort, anticipation, dépassement, fenêtres
  rng.js                  aléatoire déterministe (graine 0), bruit 1D
  gl.js                   outils three.js : cibles de rendu, passes plein écran
  glsl.js                 GLSL partagé : bruit simplex, fbm, hachages, tonemapping ACES, rampe de chaleur
  post.js                 post-production : accumulation, choc et aberration, bloom, reflet anamorphique, grain, papier
  layers/vector.js        Canvas 2D : cercle au crayon, oscilloscope, déchirure
  layers/particles.js     40 000 particules analytiques, toile cosmique, gel sur la grille
  layers/core.js          le cœur, ondes de choc, écume quantique, nébuleuse
  layers/matter.js        phase 3 : quantification, tramage, pixel-sort, réaction-diffusion, glyphes, anneaux
  layers/world3d.js       phase 4 : colonnes instanciées, planètes, cel-shading, L-systems, essaims
  layers/structures.js    phase 4 : caméra, fond, encre, cœur masqué, plongée dans la faille
  layers/complexity.js    phase 5 : fractale raymarchée, remplacement, physarum, attracteur, iris

blender/
  lumiere.py              scène Cycles complète (bille, disque, feuille, crayon, lampes, poussières, caméra)
  paper_texture.py        feuille de storyboard : vignettes au crayon, écriture manuscrite, cercle

pipeline/
  capture.mjs             serveur local + Chromium : une image PNG par appel de renderFrame(t), avec reprise
  render_all.py           liste des plans, ordre de rendu, parallélisme, chronométrage (timing.json)
  crunch.py               Big Crunch : lecture inverse, profil de vitesse, fusion d'images
  assemble.py             MP4, poster, planche-contact, script couleur
  contact.py              planches-contact de travail (relecture)

out/                      livrables : film.mp4, poster.png, contact-sheet.png, color-script.png
render/  (non versionné)  un dossier par plan, logs, paper.png, final_src/ (liens vers chaque image)
preview/ (non versionné)  même chose pour la maquette
```

---

## 4. Les illustrations

Aucune image n'est téléchargée ni générée par une IA. Tout est calculé :

- **Formes et matières** : du code GLSL (bruit, champs de distance, fractale de Mandelbulb, réaction-diffusion, physarum), des géométries three.js (boîtes instanciées, icosphères, arbres L-system) et du Canvas 2D (traits de crayon avec tremblement, courbes de Lissajous, attracteur d'Aizawa).
- **Glyphes** : un atlas de caractères dessiné au lancement dans un canvas, avec la police JetBrains Mono. Chaque cellule choisit son caractère selon la luminosité et l'orientation du contour (`/`, `\`, `|`, `-`).
- **Papier du stop-motion** : une texture de fibres générée par shader (`paperTexture()` dans `post.js`).
- **Feuille de storyboard** (`blender/paper_texture.py`) :
  - six images du film lui-même passent par une détection de contours, puis des hachures et un léger flou ;
  - les annotations sont écrites en police Caveat ;
  - le cercle au crayon est tracé en trois passages irréguliers, exactement là où la bille est posée dans la scène 3D.
- **Objets photoréalistes** : bille, crayon, bois du bureau et poussières sont modélisés et texturés par code dans `lumiere.py`. Le bois et les fibres du papier sont des textures procédurales.

---

## 5. Le rythme et la durée des « textes »

Le film est muet et n'a ni carton ni sous-titre. Les seuls textes sont des éléments de décor : les anneaux de glyphes et le « Ø » de la phase 3, les notes manuscrites de la feuille. Leur durée d'affichage n'est pas calculée en temps de lecture. Elle est calée sur la grille de tempo :

- `src/tempo.js` définit BPM(t) = 100 + 40·t/37, et donc le numéro de temps `beatAt(t)` et l'inverse `beatTime(n)`.
- Les événements sont nommés en numéros de temps (objet `B`) : glyphes au temps 25, anneaux au temps 29, « Ø » au temps 31, bascule au temps 33, etc. Leur durée va d'un temps clé au suivant ; par exemple les anneaux restent de 16,0 s à la bascule de 18,0 s.
- Chaque apparition passe par une courbe de `anim.js` (fondu doux, ressort) qui démarre sur le temps.
- Les petites pulsations (respiration du cœur, battement de la pupille) utilisent `pulse(t)`, qui décroît après chaque temps.
- Le tableau exact temps → image → événement est dans `NOTES.md`.

Pour un film avec des textes à lire, il faudrait ajouter une règle de durée minimale (par exemple 1 s plus 0,06 s par caractère), arrondie au temps suivant de la grille.

---

## 6. Les difficultés et les contournements

| Problème | Cause | Solution |
|---|---|---|
| `main.js` gonflé à 5,7 Mo, page qui ne charge plus | Un remplacement de texte par script Python a dupliqué un bloc | Fichier réécrit entièrement ; ensuite, un `node --check` après chaque modification automatisée |
| Fractale invisible | Erreur de compilation GLSL (`uPal` utilisé avant d'être déclaré), noyée dans les logs | Lecture directe de la cible de rendu depuis Playwright (`readRenderTargetPixels`) pour diagnostiquer |
| Glyphes dessinés avec une police de secours | `document.fonts.ready` ne garantit pas que la police est chargée | `document.fonts.load(...)` explicite avant de dessiner l'atlas |
| Flèches remplacées par des carrés sur la feuille | Le sous-ensemble « latin » de Caveat n'a pas `→` | Textes reformulés sans flèches ; la flèche « et tout revient ici » est dessinée au trait |
| Toutes les images Blender identiques | `frame_set()` réévaluait l'animation et écrasait la position calculée juste avant | Ordre inversé : `frame_set`, puis placement, puis clé |
| Disque blanc dans la pupille de la bille | La lampe ponctuelle du cœur était visible par la caméra | `visible_camera = False`, rayon réduit |
| Verre qui bloque la lumière du cœur | Cycles ne laisse pas passer les rayons d'ombre à travers le verre | *Shadow linking* (Blender 4.x) : la bille ne fait pas d'ombre à la lumière du cœur |
| Attente de fin de rendu qui ne finissait jamais | `pgrep -f lumiere.py` trouvait la boucle d'attente elle-même | Attente sur un mot du log (« terminé. ») plutôt que sur un processus |
| Rendu Cycles trop lent | CPU seul, verre, profondeur de champ, flou de mouvement | Mesure sur quelques images, puis 75 % de résolution et 40 échantillons débruités |
| MP4 de 171 Mo | Le grain renouvelé à chaque image se compresse mal en CRF 18 | Fichier stocké par Git LFS (CRF 18 imposé par le brief) |
| Plongée qui saute d'un coup | Courbe d'accélération trop raide | Approche progressive, contact avec la surface recalé sur le temps fort |

Plusieurs essais ont aussi été nécessaires sur :
- l'exposition du Big Bang (flash, adaptation de l'œil) ;
- la lisibilité des traînées ;
- la composition des planètes (caméra rapprochée, lumière principale ajoutée, car la planète centrale était éclairée de l'intérieur) ;
- le cadrage de la fractale.

---

## 7. Réutiliser la méthode pour un autre film

### Ce qui est générique (à garder tel quel)

- `pipeline/capture.mjs` : capture déterministe de n'importe quelle page qui expose `window.renderFrame(t)` et `window.ready`.
- `pipeline/render_all.py` : découpage en plans, parallélisme, reprise. Seule la liste `SHOTS` et les temps de fin sont propres au film.
- `pipeline/assemble.py`, `pipeline/contact.py` : génériques. Paramètres : `--fps`, `--poster`, durée de 48 s codée dans `N = 48 * fps`.
- `pipeline/crunch.py` : générique pour toute fin « rembobinée ». Paramètres : `--start`, `--end`, `--vmax`.
- `src/gl.js`, `src/post.js`, `src/anim.js`, `src/rng.js`, `src/glsl.js`, `src/tempo.js` (seules les constantes de tempo et l'objet `B` sont à changer).
- La structure de `blender/lumiere.py` : rendu image par image avec reprise, clés à chaque demi-image pour le flou de mouvement, transformation « Standard » pour raccorder une image navigateur.

### Ce qui est propre à « Graine 0 »

- `src/layers/*` : le contenu des phases.
- `direct(t)` et `renderScene(t)` dans `src/main.js` : la mise en scène.
- La scène de `blender/lumiere.py` (bille, feuille, crayon) et les légendes de `blender/paper_texture.py`.
- Les constantes de temps : `T_PULL = 36.5714` (dans `render_all.py` et `lumiere.py`), 42 s et 48 s (Crunch, assemblage), et les instants choisis pour les vignettes de la feuille (`render_all.py`, étape 3).

### Pour un nouveau film

1. Écrire la partition dans `NOTES.md`, puis reporter le tempo et les temps clés dans `src/tempo.js`.
2. Écrire ou adapter les calques dans `src/layers/`, puis la mise en scène dans `src/main.js`.
3. Mettre à jour `SHOTS` dans `pipeline/render_all.py` (coupures pendant les respirations) et les constantes de durée.
4. Adapter ou retirer l'étape Blender. `--skip-blender` rend tous les plans navigateur et la feuille, puis s'arrête avant le plan Lumière.
5. Itérer avec `node pipeline/capture.mjs --times ...` et `pipeline/contact.py`, puis `./render.sh --preview`, puis `./render.sh`.

Pour repartir de zéro sur un plan, supprimer son dossier `render/<plan>/`. La reprise saute tout ce qui existe déjà.

---

## 8. Les limites

### Ce que je referais autrement avec plus de temps

- **Cycles en 1080p natif** avec plus d'échantillons, éventuellement sur GPU, et des caustiques plus marquées.
- **Phase 3** : des nœuds de matière moins saturés, et une chimie mieux dosée en 1080p.
- **Taille du MP4** : un grain moins fort ou synthétisé à la lecture (par exemple via `film-grain` d'AV1), pour rester sous 100 Mo en CRF 18.
- **Tests automatiques** : comparer des images de référence à chaque modification, pour détecter tout de suite une régression.
- **Un fichier de configuration unique** pour les temps (fin des phases, début du Crunch), au lieu de constantes répétées entre JavaScript et Python.

### Ce que la méthode ne sait pas faire aujourd'hui

- **Voix off et son** : la chaîne est muette (`-an`). Ajouter une piste préparée se ferait à l'assemblage, avec `ffmpeg -i film.mp4 -i son.wav -c:v copy -c:a aac`. La synthèse vocale n'est pas prévue (aucun service externe utilisé).
- **Vidéo filmée** : non prise en charge. Techniquement, une séquence d'images extraite par ffmpeg pourrait servir de texture, comme les images Cycles dans `renderLumiere()`, mais rien n'est en place.
- **Sous-titres** : non prévus. On pourrait les incruster avec le filtre `subtitles` de ffmpeg à partir d'un `.srt`, ou les dessiner dans le moteur et les caler sur la grille de tempo.
- **Machine sans Python 3.11** : `bpy` 4.2 n'existe pas pour une autre version de Python. Il faut alors installer Python 3.11 à part, ou utiliser `--skip-blender`, qui s'arrête avant le plan Lumière (pas de film assemblé).
