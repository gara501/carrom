import Phaser from "phaser";
import { PAL, u } from "../theme";
import { drawPiece } from "../render/PieceRenderer";
import { Modal } from "../ui/Modal";
import { InfoOverlay } from "../ui/InfoOverlay";
import { fadeIn, fadeTo } from "../ui/transition";
import { howToPlayContent } from "../ui/HowToPlay";
import { creditsContent } from "../ui/Credits";
import { UIButton, addText } from "../ui/widgets";
import { Sfx } from "../audio/sfx";
import { saveSettings, settings } from "../audio/settings";
import type { PieceKind } from "@carrom/core";

interface Drifter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: PieceKind;
}

const RULES = [
  "Embolsa tus 9 piezas (blancas o negras) golpeando con el striker desde tu pista.",
  "Si embolsas una pieza propia, sigues tirando. Si no, pasa el turno.",
  "La reina vale 3 y hay que cubrirla embolsando una pieza propia en ese tiro o en el siguiente.",
  "Embolsar el striker es falta: se devuelve una pieza tuya al centro (o quedas en deuda).",
  "Pierdes el tablero si embolsas todas tus piezas dejando la reina, o la última pieza del rival.",
  "Ganas el tablero sumando las piezas que le quedan al rival. La partida es a 25 puntos u 8 tableros; con 22 o más ya no se cobra la reina.",
];

/** Menú principal: título, monedas flotantes de fondo y botones de Kenney. */
export class MenuScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private drifters: Drifter[] = [];
  private ui: Phaser.GameObjects.GameObject[] = [];
  private modal!: Modal;
  private info!: InfoOverlay;
  private sfx!: Sfx;

  constructor() {
    super("Menu");
  }

  create() {
    this.cameras.main.setBackgroundColor("#fef6eb");
    fadeIn(this);
    this.sfx = new Sfx(this);
    this.bg = this.add.graphics();
    this.modal = new Modal(this);
    this.modal.onPress = () => this.sfx.play("click-a");
    this.info = new InfoOverlay(this);
    this.info.onPress = () => this.sfx.play("click-a");
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () =>
      this.scale.off("resize", this.layout, this)
    );
  }

  private seedDrifters() {
    const kinds: PieceKind[] = [
      "white",
      "black",
      "white",
      "black",
      "queen",
      "white",
      "black",
      "striker",
    ];
    const { width: W, height: H } = this.scale;
    this.drifters = kinds.map((kind) => ({
      kind,
      x: Math.random() * W,
      y: Math.random() * H,
      r: u(18 + Math.random() * 16),
      vx: (Math.random() - 0.5) * u(26),
      vy: (Math.random() - 0.5) * u(26),
    }));
  }

  private view: "main" | "diff" = "main";
  private intro?: Phaser.GameObjects.Image;

  private layout() {
    for (const o of this.ui) o.destroy();
    this.ui = [];
    const { width: W, height: H } = this.scale;
    const cx = W / 2;
    const press = () => this.sfx.play("click-a");
    const bw = Math.min(u(300), W - u(88)),
      bh = u(54),
      gap = u(12);

    type Item = {
      label: string;
      style: "gloss" | "border";
      color: "blue" | "green" | "grey" | "red";
      onClick: () => void;
      disabled?: boolean;
    };
    const play =
      (mode: "ai" | "local", difficulty?: "easy" | "medium" | "hard") => () =>
        {
          if (difficulty) saveSettings({ difficulty });
          fadeTo(this, 'Game', { mode, difficulty });
        };
    const rules = () =>
      this.modal.show({
        title: "Reglas",
        lines: RULES.flatMap((r, i) => (i ? ["", r] : [r])),
        buttons: [{ label: "ENTENDIDO", color: "green", onClick: () => {} }],
      });
    const rows: Item[][] =
      this.view === "main"
        ? [
            [
              {
                label: "JUGAR CONTRA LA IA",
                style: "gloss",
                color: "blue",
                onClick: () => {
                  this.view = "diff";
                  this.layout();
                },
              },
            ],
            [
              {
                label: "JUGAR 2 JUGADORES (LOCAL)",
                style: "border",
                color: "blue",
                onClick: play("local"),
              },
            ],
            [
              {
                label: "EN LÍNEA (PRÓXIMAMENTE)",
                style: "border",
                color: "grey",
                onClick: () => {},
                disabled: true,
              },
            ],
            [
              {
                label: "REGLAS",
                style: "border",
                color: "blue",
                onClick: rules,
              },
              {
                label: "CONTROLES",
                style: "border",
                color: "blue",
                onClick: () =>
                  this.info.open("Cómo se juega", howToPlayContent),
              },
              {
                label: "CRÉDITOS",
                style: "border",
                color: "blue",
                onClick: () =>
                  this.info.open(
                    "Créditos",
                    (wide) =>
                      creditsContent(wide, this.textures.exists("logo")),
                    "CERRAR"
                  ),
              },
            ],
          ]
        : [
            [
              {
                label: "FÁCIL",
                style: settings.difficulty === "easy" ? "gloss" : "border",
                color: "blue",
                onClick: play("ai", "easy"),
              },
            ],
            [
              {
                label: "MEDIO",
                style: settings.difficulty === "medium" ? "gloss" : "border",
                color: "blue",
                onClick: play("ai", "medium"),
              },
            ],
            [
              {
                label: "DIFÍCIL",
                style: settings.difficulty === "hard" ? "gloss" : "border",
                color: "blue",
                onClick: play("ai", "hard"),
              },
            ],
            [
              {
                label: "VOLVER",
                style: "border",
                color: "grey",
                onClick: () => {
                  this.view = "main";
                  this.layout();
                },
              },
            ],
          ];

    // Portada: la imagen ocupa la parte alta y los botones van en el espacio libre de abajo.
    const imgH = Math.min((W * 1287) / 1222, H * 0.6);
    const sc = imgH / 1287;
    const img = this.add.image(cx, 0, "intro").setOrigin(0.5, 0).setScale(sc);
    this.intro = img;
    this.ui.push(img);
    const boardBottom = imgH * 0.8;
    const head = this.view === "diff" ? u(26) : 0;
    const avail = H - boardBottom - u(36) - head;
    const bh2 = Math.min(bh, (avail - gap * (rows.length - 1)) / rows.length);
    let y = boardBottom + u(6);
    if (this.view === "diff") {
      this.ui.push(
        addText(this, cx, y + u(10), "ELIGE LA DIFICULTAD", 13, {
          color: PAL.inkCss,
        })
      );
      y += head;
    }
    for (const row of rows) {
      const g2 = u(8),
        n = row.length,
        w1 = (bw - g2 * (n - 1)) / n;
      row.forEach((it, k) => {
        const x = cx - bw / 2 + w1 / 2 + k * (w1 + g2);
        this.ui.push(
          new UIButton(this, x, y + bh2 / 2, w1, bh2, it.label, {
            color: it.color,
            style: it.style,
            fontSize: n > 1 ? 12 : 16,
            onClick: it.onClick,
            onPress: press,
            disabled: it.disabled,
          })
        );
      });
      y += bh2 + gap;
    }
    this.ui.push(
      addText(this, cx, H - u(14), "UI: Kenney (CC0)", 10, {
        color: PAL.inkSoftCss,
      })
    );
    this.modal.relayout();
    this.info.relayout();
  }

  update(_t: number) {
    this.bg.clear();
    if (this.intro) this.intro.y = Math.sin(_t / 900) * u(3);
  }
}
