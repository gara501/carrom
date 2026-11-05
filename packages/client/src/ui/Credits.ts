import { PAL, u } from '../theme';
import type { InfoContent } from './InfoOverlay';
import { addText } from './widgets';

const SECTIONS: { title: string; lines: string[] }[] = [
  { title: 'INTERFAZ Y EFECTOS DE SONIDO', lines: ['Kenney — UI Pack (CC0)', 'kenney.nl'] },
  {
    title: 'MÚSICA',
    lines: [
      'Gabriela Ayres — Desert Horizon (Handpan & Ney)',
      'JuliusH — Bandari, Persian Arabic Music (Khaliji)',
      'Sounova Music — Ancient Persian Music',
      'Kiravale — Indian Classical Music',
      'Sub Clair — Indian',
      'VJ Galaxy — Ancient Persia Epic Soundtrack 01, 02 y 03',
    ],
  },
  { title: 'TIPOGRAFÍA', lines: ['Play — Jonas Hecksher (Playtypes)', 'SIL Open Font License'] },
];

/** Créditos: "creado por" con el logo (si existe `logo.png`) y las atribuciones de assets. */
export function creditsContent(wide: boolean, hasLogo: boolean): InfoContent {
  const w = wide ? u(560) : u(420);
  return {
    w,
    h: u(hasLogo ? 130 : 30) + SECTIONS.reduce((a, s) => a + u(26) + s.lines.length * u(20) + u(12), 0),
    build(scene, c) {
      let y = 0;
      if (hasLogo) {
        c.add(addText(scene, w / 2, y + u(8), 'CREADO POR', 12, { color: PAL.inkSoftCss }));
        const img = scene.add.image(w / 2, y + u(24), 'logo').setOrigin(0.5, 0);
        img.setScale(Math.min(u(90) / img.height, (w * 0.6) / img.width));
        c.add(img);
        y += u(130);
      } else y += u(10);
      for (const s of SECTIONS) {
        c.add(addText(scene, w / 2, y + u(8), s.title, 12, { color: '#1e9fd8' }));
        y += u(26);
        for (const l of s.lines) {
          c.add(addText(scene, w / 2, y + u(8), l, 13, { color: PAL.inkCss, wrap: w - u(16), align: 'center' }));
          y += u(20);
        }
        y += u(12);
      }
    },
  };
}
