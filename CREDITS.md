# Credits

| Asset | Author | Licence | Used for |
|---|---|---|---|
| [Universal Base Characters [Standard]](https://quaternius.itch.io/universal-base-characters) | Quaternius | CC0 1.0 | Human bodies, faces, hair → `assets/people/male*.glb`, `female*.glb` (clothing regions added by `art/build_people.py`) |
| [Universal Animation Library [Standard]](https://quaternius.itch.io/universal-animation-library) | Quaternius | CC0 1.0 | Walk, formal walk, idle and sitting animations → `assets/people/anims.glb` |
| [three.js](https://threejs.org) r186 | three.js authors | MIT (`vendor/THREE-LICENSE`) | 3D engine, loaders, controls |

Rebuild the people assets with Blender 5.x:

```
blender -b --python art/build_people.py -- "<Universal Base Characters[Standard] folder>" "<UAL1_Standard.glb>" assets/people
```
