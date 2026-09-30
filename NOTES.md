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

*(Les sections outils, temps de rendu, bilan et plans B sont complétées en fin de production.)*
