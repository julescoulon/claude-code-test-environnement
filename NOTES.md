# Graine 0

*Court-métrage muet, 48 s, en boucle parfaite. Tout ce qui est à l'écran est construit en code.*

## Note d'intention

Un univers naît d'un point. Il explose, refroidit, s'écrit, prend du volume, devient vertigineux, jusqu'à pouvoir se regarder lui-même (un iris). Puis la caméra recule, traverse une paroi de verre, et révèle que tout ce monde tenait dans une **bille**, posée sur la **feuille de storyboard** de l'animateur qui l'a imaginé, sous une lampe de bureau. Le temps se rembobine, la bille redevient un point.

Le titre vient de la graine aléatoire du rendu : tout le film est calculé à partir d'un nombre fixe. Ce nombre est la singularité.

**Leitmotiv : le cercle.** Point → cercle au crayon → anneau de choc → front de refroidissement → anneau de glyphes → planète → bulbe fractal → iris → bille → point. Toutes les transitions majeures raccordent sur ce cercle, centré sur le cœur lumineux.

**Le cœur est un personnage.** Il respire sur chaque temps, cligne avant le Big Bang, se contracte avant chaque transition (anticipation) et relâche l'énergie sur le temps fort.

## Script couleur

| Phase | Temps | Dominante | Accent |
|---|---|---|---|
| 1 Singularité | 0 – 2,95 s | noir, blanc froid | violet |
| 2 Expansion | 2,95 – 9,7 s | orange incandescent → magenta | blanc de choc |
| 3 Matière | 9,7 – 18,0 s | cyan électrique | bleu nuit |
| 4 Structures | 18,0 – 27,7 s | vert acide | encre noire, crème |
| 5 Complexité | 27,7 – 36,6 s | magenta + or | toutes les couleurs passées, en calques |
| 6 Lumière | 36,6 – 42,0 s | ambre, blanc chaud | caustiques irisées |
| 7 Big Crunch | 42,0 – 48,0 s | toutes, à l'envers | — |

## Grille de tempo

- BPM(t) = 100 + 40·t/37 pour t ≤ 37 s (100 → 140 BPM). Le numéro de temps vaut `(100·t + 20·t²/37) / 60`.
- Les temps 0 à 4 forment une **anacrouse** (la singularité). Le **Big Bang tombe sur le temps 5**. Les mesures de 4 temps commencent ensuite aux temps 5, 9, 13, etc.
- Lumière : le tempo est suspendu (un seul souffle lent). Crunch : les temps défilent à la vitesse de lecture inverse.

| Temps | t (s) | Image | Événement |
|---|---|---|---|
| 0 | 0,000 | 0 | point seul |
| 1–3 | 0,60 / 1,19 / 1,78 | 14 / 29 / 43 | respiration du cœur, le tracé du cercle avance |
| 4 | 2,370 | 57 | anticipation : tout est aspiré, le cœur cligne |
| **5** | **2,953** | **71** | **Big Bang** : flash, anneau de choc |
| 9 | 5,251 | 126 | onde de choc secondaire |
| 13 | 7,496 | 180 | onde de choc secondaire, puis respiration |
| **17** | **9,692** | **233** | **début du refroidissement** (front circulaire) |
| 21 | 11,842 | 284 | le front atteint le cœur : matière figée ; respiration |
| 23 | 12,900 | 310 | chimie : réaction-diffusion, cycle de palette |
| **25** | **13,948** | **335** | **pixels → glyphes** (onde depuis le cœur) |
| 29 | 16,014 | 384 | glyphes posés, anneaux de texte ; respiration |
| 31 | 17,032 | 409 | les glyphes dessinent le « 0 » |
| **33** | **18,041** | **433** | **bascule du plan, extrusion** |
| 37 | 20,031 | 481 | fil de fer → faces plates |
| 39 | 21,013 | 504 | faces plates → ombrage |
| **41** | **21,987** | **528** | **les colonnes s'enroulent en planètes** |
| 45 | 23,910 | 574 | planètes posées ; respiration |
| 47 | 24,859 | 597 | cel-shading, encre, trame BD |
| 49 | 25,802 | 619 | L-systems, essaims |
| **53** | **27,663** | **664** | **plongée dans la fissure** |
| **57** | **29,497** | **708** | **fractale + passage en stop-motion 12 i/s** |
| 61–68 | 31,30 – 34,40 | 751 – 826 | raccords de forme sur les temps |
| 69 | 34,839 | 836 | l'iris se forme |
| 72 | 36,140 | 867 | anticipation : contraction dans la pupille |
| **73** | **36,571** | **878** | **travelling arrière : sortie de la bille** |
| — | 42,000 | 1008 | début du Big Crunch |
| — | 48,000 | 1152 | = image 0 (boucle) |

## Transitions

| De → vers | Élément de continuité | Mécanisme | Sens |
|---|---|---|---|
| Singularité → Expansion | le cercle au crayon, le cœur | le tracé se déchire : ses sommets deviennent des particules. Anticipation, arrêt du temps, flash, explosion | la tension se relâche |
| Expansion → Matière | positions et couleurs des particules | onde de refroidissement circulaire ; derrière elle, les particules s'aimantent sur une grille, la résolution et la palette se quantifient, pixel-sort sur le front | la matière se fige en refroidissant |
| Pixels → glyphes | chaque cellule | substitution cellule par cellule guidée par l'orientation des bords, en onde depuis le cœur | le numérique est fait de symboles |
| Matière → Structures | la grille et ses couleurs | apparition d'une dimension : le plan bascule et s'extrude, les colonnes s'enroulent en planètes | la gravité donne du volume |
| Structures → Complexité | la planète centrale et ses contours d'encre | changement d'échelle : plongée dans une fissure ; l'encre devient l'arête d'une fractale ; passage en 12 i/s sur le temps fort | l'intérieur d'un monde est infini |
| Raccords internes (phase 5) | le cercle au centre | coupes motivées, sur les temps | tout se répond |
| Complexité → Lumière | la pupille, le cœur, sa position à l'écran | recul d'échelle et changement de matière : on sort d'une bille de verre ; Blender affiche nos propres images à l'intérieur de la bille | tout un monde n'était qu'un détail |
| Lumière → Big Crunch | l'image elle-même | inversion du temps, accélération 1× → 30× | la gravité l'emporte |
| Big Crunch → image 0 | la singularité | décélération qui se pose sur l'image 1 | le cycle recommence |

## Familles techniques par phase

| Phase | Nouvelle(s) famille(s) | Réinterprétation |
|---|---|---|
| 1 | tracés vectoriels (crayon, oscilloscope), morphing | — |
| 2 | particules, bruit GLSL, flou de mouvement, optique (choc, aberration) | le tracé devient trajectoire |
| 3 | pixel (quantif, tramage, palette, cycle), pixel-sort, réaction-diffusion, glyphes | les particules deviennent matière discrète |
| 4 | 3D polygonale (fil de fer → plat → lisse), cel-shading + encre, trame BD, L-systems, essaims | pixels et glyphes prennent du volume ; tracés = orbites |
| 5 | raymarching, fractale, stop-motion, physarum, attracteurs | tout, en calques autour du cœur |
| 6 | photoréalisme Cycles + OIDN | papier, cercle au crayon, caustiques-cellules |
| 7 | lecture inverse accélérée + fusion d'images | le film entier |

## Bible d'animation

Tout le mouvement passe par `src/anim.js`, pour que le film parle une seule langue :

- **Anticipation** : le cœur inspire avant le Big Bang, la caméra recule avant la plongée, la pupille se contracte avant la sortie de la bille.
- **Dépassement et stabilisation** : colonnes extrudées, planètes qui se forment et « 0 » des anneaux arrivent tous sur un ressort amorti.
- **Écrasement-étirement** : les colonnes s'étirent en vol et s'écrasent à l'atterrissage, les éclats de crayon sont étirés (*smear*) par la vitesse.
- **Retard et chevauchement** : les ondes (extrusion, papillonnement des glyphes, encre, repeint vert) partent du cœur et se propagent vers l'extérieur.
- **Rampes de vitesse** : le temps de l'explosion suit un ralenti « bullet time » (`tauOf`), et le refroidissement ralentit les particules avant de les figer.
- **Langage caméra** : adaptation de l'œil après le flash, secousse amortie, effet vertigo pendant la bascule, orbite lente, chute accélérée dans la faille, caméra « posée à la main » en stop-motion, travelling arrière macro.

## Découpage en plans (rendu)

Chaque plan est une tranche de `renderFrame(t)`, coupée pendant une respiration :

| Plan | Temps | Contenu |
|---|---|---|
| `01_singularite_expansion` | 0 – 8,5 s | singularité, Big Bang, expansion, début de la toile cosmique |
| `02_refroidissement` | 8,5 – 12,6 s | front de refroidissement, gel en pixels |
| `03_glyphes` | 12,6 – 17,9 s | chimie, glyphes, anneaux, « Ø » |
| `04_structures` | 17,9 – 24,4 s | bascule, extrusion, planètes |
| `05_vie_plongee` | 24,4 – 29,9 s | cel-shading, vie, plongée dans la faille, arrivée dans la fractale |
| `06_complexite` | 29,9 – 36,57 s | fractale, montage par remplacement, iris |
| `07_interieur` | 36,57 – 42 s | l'univers vu dans la bille (texture du disque pour Blender) |
| `blender` | 36,57 – 42 s | Cycles : sortie de la bille, feuille de storyboard |
| `08_lumiere` | 36,57 – 42 s | raccord navigateur → Cycles, halo optique, grain |
| `09_crunch` | 42 – 48 s | lecture inverse accélérée des images 1006 → 1 |

Les transitions sont toutes internes à un plan : dans le moteur, les deux mondes coexistent et sont composés image par image (masque de refroidissement, texture des colonnes = image de la phase 3, fente de la faille, disque de la bille).

## Pipeline

- **Une commande** : `./render.sh` (film 1080p24 → `out/`) ou `./render.sh --preview` (maquette 854×480 à 12 i/s → `preview/`). Elle installe les dépendances manquantes puis lance `pipeline/render_all.py`.
- **Rendu déterministe** : `window.renderFrame(t)` (src/main.js) ne dépend que de `t`. Aucun `Math.random`, `Date` ni `performance` ; toute la variation vient de la graine 0 (`src/rng.js`). Les simulations (réaction-diffusion, physarum, essaims) avancent à pas fixe et sont rejouées depuis leur début quand un plan reprend ; les particules sont analytiques.
- **Capture** : Playwright (`playwright-core`) pilote le Chromium installé dans `/opt/pw-browsers`, en WebGL logiciel (SwiftShader). Chaque image est exportée en PNG depuis le canvas.
- **Flou de mouvement** : accumulation de 3 à 8 sous-images (obturateur 180°) sur les mouvements rapides (Big Bang, expansion, envol des colonnes, plongée) ; flou natif de Cycles pour le plan Lumière ; fusion d'images pour le Crunch.
- **Reprise** : chaque plan a son dossier (`render/<plan>/`), avec un fichier `DONE` en fin de plan. Les images existantes sont sautées.
- **Assemblage** : ffmpeg système (repli sur `imageio-ffmpeg`), H.264 `yuv420p`, CRF 18, `+faststart`, sans audio.

## Outils et versions

| Outil | Version | Usage |
|---|---|---|
| Node.js | 22.22 | moteur, capture |
| three.js | 0.186.1 | 3D, passes plein écran |
| playwright-core | 1.63.0 | navigateur sans tête |
| Chromium | 141.0.7390 (SwiftShader) | rendu WebGL2 logiciel |
| @fontsource | jetbrains-mono, major-mono-display, caveat | glyphes, annotations manuscrites |
| Python | 3.11 | orchestration, Crunch, assemblage |
| bpy (Blender) | 4.2.0 | Cycles CPU + OpenImageDenoise |
| numpy / Pillow / fontTools | 2.4 / 12.3 / — | feuille de storyboard, planches |
| ffmpeg | 6.1.1 | encodage |

## Temps de rendu (machine : 4 cœurs CPU, sans GPU)

| Plan | Images | Temps | Par image |
|---|---|---|---|
| 01_singularite_expansion | 204 | 23,8 min | ≈7 s (flou de mouvement jusqu'à 8 sous-images) |
| 02_refroidissement | 99 | 6,0 min | ≈3,6 s |
| 03_glyphes | 127 | 6,3 min | ≈3 s |
| 04_structures | 156 | 8,3 min | ≈3,2 s |
| 05_vie_plongee | 132 | 9,5 min | ≈4,3 s |
| 06_complexite | 160 | 12,5 min | ≈4,7 s (raymarching à 75 %, 12 i/s) |
| 07_interieur | 130 | 9,2 min | ≈4,2 s |
| blender (Cycles) | 130 | 246,6 min | 32 à 170 s (≈114 s en moyenne) |
| 08_lumiere | 130 | 1,7 min | composition |
| 09_crunch | 144 | 5,8 min | fusion d'images |

Les plans navigateur tournent par deux en parallèle (≈1 h 15 au total). La maquette 480p à 12 i/s complète prend environ 20 min.

## Vérifications

- `ffprobe out/film.mp4` : h264, 1920×1080, `yuv420p`, 24 i/s, 1152 images, 48,000 s, un seul flux (aucun audio), `faststart`.
- **Boucle** : la dernière image (1151) est exactement l'image source 1 ; l'écart moyen 1151 → 0 (2,25/255) est identique à l'écart 0 → 1. Pas d'image en double, pas de saut.
- **Déterminisme** : tout dérive de `t` et de la graine 0 ; les simulations sont rejouées depuis leur début. Les plans ont été rendus en processus séparés, sans jonction visible.
- **Big Crunch** : rampe exponentielle de 1× à ≈28× (pic vers 70 %), puis décélération qui se pose à 1× sur l'image 1. Le profil exact est dans `render/09_crunch/profil.txt`.

## Ce qui a marché

- **Un seul moteur, une seule horloge** : les transitions sont des compositions au sein d'une même fonction, jamais des collages de plans. Le raccord 3 → 4 est exact au pixel : les faces supérieures des colonnes sont l'image de la phase 3, vue par une caméra qui démarre exactement à la position de la poussée 2D.
- **Le cercle comme fil rouge** : il porte presque tous les raccords (front de refroidissement, anneaux de glyphes, anneaux planétaires, bulbe, iris, bille, cercle au crayon sur la feuille).
- **La fente en amande** de la faille préfigure l'œil ; l'**iris** devient l'œil de chat d'une bille ; la **feuille de storyboard** est générée à partir des images du film lui-même.
- **Le raccord navigateur → Cycles** : le disque dans la bille couvre exactement la diagonale du cadre au premier plan, donc la première image Blender reproduit l'image navigateur, puis la caméra sort du verre.

## Limites et choix assumés

- **Cycles en 1440×810, agrandi en 1080p** (bicubique Catmull-Rom dans le compositeur) : en 1080p natif, le plan aurait pris 7 à 8 h. La profondeur de champ macro rend l'agrandissement peu visible.
- **Taille du film** : en CRF 18, le grain renouvelé à chaque image coûte cher, et le MP4 fait 171 Mo. Il dépasse la limite de 100 Mo de GitHub, il est donc versionné avec **Git LFS** (`.gitattributes`).
- **Phase 3** : les nœuds de la toile cosmique figés sont très lumineux et forment de grandes taches claires (lisibles, mais moins fines que le reste).
- **Flash du Big Bang** : une image presque blanche avec un léger dégradé en paliers (8 bits). C'est voulu comme impact, mais ce n'est pas parfait.
- **Caustiques** : la caustique de la lampe à travers la bille (MNEE) reste discrète à 40 échantillons débruités.

## Plans B

- Navigateur : le Chromium préinstallé (`/opt/pw-browsers`) a fonctionné en WebGL2 logiciel (SwiftShader, rendu flottant disponible). Aucun plan B nécessaire.
- Blender : `pip install bpy==4.2.0` a fonctionné avec Python 3.11, OIDN compris. Pas de repli Three.js.
- ffmpeg : celui du système (6.1.1) ; `imageio-ffmpeg` reste en repli dans `assemble.py`.
- Polices : les woff2 de `@fontsource` sont convertis en TTF par `fontTools` pour Pillow (feuille de storyboard).

## Livrables

- `out/film.mp4`, `out/poster.png` (26,5 s : la planète-ville en cel-shading), `out/contact-sheet.png` (1 image/s), et en bonus `out/color-script.png` (couleur moyenne et dominante de chaque image).
- Sources : `src/` (moteur), `blender/` (scène Cycles, feuille de storyboard), `pipeline/` (capture, orchestration, Crunch, assemblage), `render.sh`.
