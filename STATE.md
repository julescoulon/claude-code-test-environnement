# STATE — reprise de session

- Phase en cours : rendu final (`nohup ./render.sh > render/logs/final.log 2>&1 &`)
- Maquette complète validée : preview/film_maquette.mp4 (480p, 12 i/s), relue plan par plan
- Plans : voir `render/<plan>/DONE` ; la reprise saute les images et plans déjà rendus
- Prochaine étape : quand `render/logs/final.log` affiche « terminé. », vérifier out/film.mp4 (ffprobe, boucle),
  relire la planche-contact, compléter NOTES.md (temps réels dans render/timing.json), committer out/ et pousser
