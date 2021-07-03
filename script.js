////// ////// /////// ////// ////// ///////
//  // //       //    //  // //       //             //////
/////  /////    //    /////  /////    //    //   //     //
//     //       //    //     //       //    // //   //
//     //////   //    //     //////   //     //    //////

// do whatever u want with the code
// show me on twitter.com/stvpvd if u do something cool with it tho

"use strict";
/* global GIF, requestInterval, clearRequestInterval */
// Global constants
const MAX_FRAME = 4;
const OUT_SIZE = 112;
const CACHE_SIZE = 256;
const DEFAULTS = Object.freeze({
  squish: 1.25,
  scale: 0.875,
  delay: 60,
  spriteX: 14,
  spriteY: 20,
  spriteWidth: 112,
  spriteHeight: 112,
  currentFrame: 0,
  flip: false,
});

const CANVAS_OPTIONS = Object.freeze({
  antialias: false,
  powerPreference: "low-power",
});

const GIF_RENDERER_OPTIONS = Object.freeze({
  workers: 2,
  workerScript: "gif.worker.js",
  width: OUT_SIZE,
  height: OUT_SIZE,
  transparent: 0x00ff00,
});

// global variables
const g = { ...DEFAULTS };

(() => {
  // utils
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selectors) => document.querySelectorAll(selectors);
  const clamp = (num, min, max) => (num < min ? min : num > max ? max : num);
  const truncateStr = (str, len) =>
    str.length < len
      ? str
      : `${str.substr(0, ~~(len / 2))}â‹¯${str.substr(str.length - ~~(len / 2), str.length)}`;

  /**
   * Loads and scales an image to a set size to improve performance
   * @param {(data: string) => void} load
   * @param {(error: Event | string, data: string) => void} error
   */
  const ImageLoader = (load, error) => {
    const cacheCanvas = document.createElement("canvas");
    const cacheCtx = cacheCanvas.getContext("2d");
    cacheCanvas.width = cacheCanvas.height = CACHE_SIZE;

    let dataURLCache = "";
    const image = new Image();
    // Allow loading external images into the canvas
    image.crossOrigin = "Anonymous";

    // scale image and convert to base64 on load. *probably* helps with performance
    image.onload = () => {
      cacheCanvas.height = CACHE_SIZE * (image.naturalHeight / image.naturalWidth);
      cacheCtx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
      cacheCtx.drawImage(image, 0, 0, cacheCanvas.width, cacheCanvas.height);
      dataURLCache = cacheCanvas.toDataURL();
      load(dataURLCache);
    };

    image.addEventListener("error", (e) => error(e, dataURLCache));

    return {
      /**
       * Load image from URL
       * @param {string} src
       */
      loadImage: (src) => {
        URL.revokeObjectURL(image.src);
        image.src = src;
      },
    };
  };

  /** Animation loop */
  let loop = null;
  // let ticker = null;

  /**
   * Animation handler
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLImageElement} hand
   * @param {HTMLImageElement} sprite
   */
  const PetPetAnimation = (canvas, hand, sprite) => {
    let allowAdjust = false;
    const ctx = canvas.getContext("2d", CANVAS_OPTIONS);
    ctx.imageSmoothingEnabled = false;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ff0000";

    /// SPRITE
    /** Refresh sprite dimensions to match the original images proportions */
    const refreshSprite = () => {
      g.spriteHeight = g.spriteWidth * (sprite.naturalHeight / sprite.naturalWidth);
    };

    // Automatically refresh dimensions when the sprite image changes
    sprite.addEventListener("load", refreshSprite);

    /// ANIMATION
    /** Frame offset values */
    const frameOffsets = [
      { x: 0, y: 0, w: 0, h: 0 },
      { x: -4, y: 12, w: 4, h: -12 },
      { x: -12, y: 18, w: 12, h: -18 },
      { x: -8, y: 12, w: 4, h: -12 },
      { x: -4, y: 0, w: 0, h: 0 },
    ];

    /**
     * Get the sprite's positioning for a frame
     * @param {number} frame
     */
    const getSpriteFrame = (frame) => {
      const offset = frameOffsets[frame];
      return {
        dx: ~~(g.spriteX + offset.x * (g.squish * 0.4)),
        dy: ~~(g.spriteY + offset.y * (g.squish * 0.9)),
        dw: ~~((g.spriteWidth + offset.w * g.squish) * g.scale),
        dh: ~~((g.spriteHeight + offset.h * g.squish) * g.scale),
      };
    };

    /** Render animation frame */
    const renderFrame = (_frame, _ctx, _adjust) => {
      const cf = getSpriteFrame(_frame);

      // reset canvas
      if (_ctx.globalAlpha !== 1) _ctx.globalAlpha = 1;
      _ctx.clearRect(0, 0, OUT_SIZE, OUT_SIZE);

      // flipping the sprite is super annoying. first we translate canvas to where the sprite will
      // be which allows us to draw the hand sprite (and the outline for adjust mode) at (0,0). then
      // we flip the whole canvas and draw what ever we need to draw flipped, and then finally reset
      // the scale/translation and draw the hand
      _ctx.save();
      _ctx.translate(cf.dx, cf.dy);

      if (g.flip) {
        _ctx.scale(-1, 1);
        cf.dw *= -1; // invert the width or the sprite gets drawn off canvas
      }

      // draw sprite and outline
      _ctx.drawImage(sprite, 0, 0, cf.dw, cf.dh);
      if (_adjust) _ctx.strokeRect(0, 0, cf.dw, cf.dh);
      _ctx.restore();

      // draw hand
      if (_adjust) _ctx.globalAlpha = 0.75;
      _ctx.drawImage(
        hand,
        _frame * OUT_SIZE, //sx
        0, //sy
        OUT_SIZE, //sw
        OUT_SIZE, //sh
        0, //dx
        // don't ask where these numbers are from they just work....
        Math.max(0, ~~(cf.dy * 0.75 - Math.max(0, g.spriteY) - 0.5)), //dy
        OUT_SIZE, //dw
        OUT_SIZE //dh
      );
    };

    /** Render frame with request anim frame */
    const tick = () => {
      requestAnimationFrame(() => {
        renderFrame(g.currentFrame, ctx, allowAdjust);
      });
    };

    /** Animation loop */
    const play = () => {
      if (!loop) {
        loop = requestInterval(() => {
          renderFrame(g.currentFrame, ctx, allowAdjust);
          g.currentFrame = (g.currentFrame + 1) % 5;
        }, g.delay);
      }
    };

    /** Stop animation */
    const stop = () => {
      if (loop) {
        loop = clearRequestInterval(loop);
      }
      tick();
    };

    /** Seek to relative frame */
    const seek = (amount) => {
      stop();
      const newFrame = (g.currentFrame + amount) % 5;
      g.currentFrame = newFrame < 0 ? MAX_FRAME : newFrame;
      tick();
    };

    /// ADJUST SPRITE
    let offsetX = 0;
    let offsetY = 0;
    let offsetScale = 1;
    let startX = 1;
    let startY = 1;
    let dragging = false;

    /**
     * Check if mouse position is within the bounds of the sprite
     * @param {number} frame
     * @param {number} posX
     * @param {number} posY
     */
    const inSpriteBounds = (frame, posX, posY) => {
      const offset = getSpriteFrame(frame);
      const left = offset.dx;
      const right = offset.dx + offset.dw;
      const top = offset.dy;
      const bottom = offset.dy + offset.dh;
      return posX > left && posX < right && posY > top && posY < bottom;
    };

    /** Find where the canvas is right now */
    const updateRelativeOffset = () => {
      if (!allowAdjust) return;
      const bounds = canvas.getBoundingClientRect();
      offsetX = bounds.left;
      offsetY = bounds.top;
      offsetScale = OUT_SIZE / bounds.width;
    };

    /** Toggle adjust mode */
    const toggleAdjust = (force) => {
      allowAdjust = force !== undefined ? force : !allowAdjust;
      if (allowAdjust === true) {
        g.currentFrame = 0;
        stop();
      }
      updateRelativeOffset();
      tick();
    };

    // Update offsets on scroll or resize
    window.addEventListener("scroll", updateRelativeOffset);
    window.addEventListener("resize", updateRelativeOffset);
    canvas.addEventListener("resize", updateRelativeOffset);

    // Start drag
    canvas.addEventListener("pointerdown", (e) => {
      if (!allowAdjust) return;
      e.preventDefault();
      e.stopPropagation();

      // Since the canvas is being scaled on the page, get the scale of it so we can normalize the
      // positions to match the original size of the canvas
      startX = ~~((e.clientX - offsetX) * offsetScale);
      startY = ~~((e.clientY - offsetY) * offsetScale);

      // Check if we are clicking the character
      dragging = inSpriteBounds(g.currentFrame, startX, startY);
    });

    // Move on drag
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();

      // Get mouse pos
      const mouseX = ~~((e.clientX - offsetX) * offsetScale);
      const mouseY = ~~((e.clientY - offsetY) * offsetScale);

      // Get amount moved
      g.spriteX += mouseX - startX;
      g.spriteY += mouseY - startY;

      tick();

      startX = mouseX;
      startY = mouseY;
    });

    // Stop drag
    ["pointerup", "pointerout"].forEach((event) => {
      canvas.addEventListener(event, (e) => {
        if (!dragging) return;
        e.preventDefault();
        e.stopPropagation();
        dragging = false;
      });
    });

    /// KEYBOARD ADJUST
    let lastClick = null;

    // Store last clicked element so we know to handle keyboard events only when the canvas is
    // focused
    document.addEventListener("click", (e) => (lastClick = e.target));

    // Change image position with arrow keys
    document.addEventListener("keydown", (e) => {
      if (lastClick === canvas && !e.defaultPrevented) {
        switch (e.key) {
          case "Left":
          case "ArrowLeft":
            g.spriteX -= 1;
            break;
          case "Up":
          case "ArrowUp":
            g.spriteY -= 1;
            break;
          case "Right":
          case "ArrowRight":
            g.spriteX += 1;
            break;
          case "Down":
          case "ArrowDown":
            g.spriteY += 1;
            break;
          default:
            return;
        }
        e.preventDefault();
        tick();
      }
    });

    return {
      tick,
      play,
      stop,
      seek,
      renderFrame,
      toggleAdjust,
      refreshSprite,
    };
  };

  /**
   * Gif renderer
   * @param {PetPetAnimation} animation
   * @param {(startTime: number) => void} start
   * @param {(progress: number) => void} progress
   * @param {(blob: Blob, endTime: number) => void} finish
   */
  const GifRenderer = (animation, start, progress, finish) => {
    const renderCanvas = document.createElement("canvas");
    const renderCtx = renderCanvas.getContext("2d", CANVAS_OPTIONS);
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d", CANVAS_OPTIONS);
    renderCanvas.width = renderCanvas.width = tempCanvas.width = tempCanvas.height = OUT_SIZE;
    renderCtx.fillStyle = "#0f0";

    /**
     * Replace transparent pixels with green since gif.js doesn't dither transparency
     * @param {Uint8ClampedArray} data
     */
    const optimizeFrameColors = (data) => {
      for (let i = 0; i < data.length; i += 4) {
        // clamp greens to avoid pure greens in the image from turning transparent
        // basically a hack and it's not really noticeable and it works
        data[i + 1] = data[i + 1] > 250 ? 250 : data[i + 1];

        // Set transparent pixels to green
        if (data[i + 3] < 120) {
          data[i + 0] = 0;
          data[i + 1] = 255;
          data[i + 2] = 0;
        }

        // No more transparent pixels
        data[i + 3] = 255;
      }
    };

    return {
      /** Render gif */
      render() {
        const gif = new GIF(GIF_RENDERER_OPTIONS);
        const frameDelay = clamp(g.delay, 20, 1000);

        // draw frames
        for (let i = 0; i <= MAX_FRAME; i++) {
          // render frame on tempCtx
          animation.renderFrame(i, tempCtx, false);

          // fix transparency
          const imgData = tempCtx.getImageData(0, 0, OUT_SIZE, OUT_SIZE);
          optimizeFrameColors(imgData.data);

          renderCtx.putImageData(imgData, 0, 0);
          gif.addFrame(renderCtx, { copy: true, delay: frameDelay });
        }

        gif.on("start", () => start(window.performance.now()));
        gif.on("progress", (p) => progress(p));
        gif.on("finished", (blob) => finish(blob, window.performance.now()));
        gif.render();
      },
    };
  };

  window.addEventListener("DOMContentLoaded", () => {
    const $canvas = $("#canvas");
    const $preview = $("#uploadPreview");
    const $hand = new Image();
    $hand.crossOrigin = "Anonymous";
    const animation = PetPetAnimation($canvas, $hand, $preview);
    const imageLoader = ImageLoader(
      /** Image load listener */
      (data) => {
        $preview.src = data;
        animation.tick();
      },
      /** Image error listener */
      (e) => {
        console.error("Error loading image", e);
        $preview.classList.add("error");
        $("#uploadError").innerText = "could not load the image!";
      }
    );

    /** Reset transformations */
    const reset = () => {
      // Reset animation
      Object.assign(g, DEFAULTS);
      animation.refreshSprite();
      if (loop) {
        loop = clearRequestInterval(loop);
        animation.play();
      } else {
        animation.tick();
      }

      // Reset inputs
      $("#squish").value = ~~(DEFAULTS.squish * 100);
      $("#scale").value = DEFAULTS.scale * 100;
      $("#fps").value = $("#fpsVal").value = ~~(1000 / DEFAULTS.delay);
      $("#toggleFlip").checked = false;
    };

    /** Reset to default values */
    $("#reset").addEventListener("click", reset);

    /// File upload
    const dropArea = $("#dropArea");
    const fileUpload = $("#uploadFile");
    const fileUploadName = $("#uploadFileName");

    const handleFiles = (file) => {
      $("#uploadError").innerText = "";
      fileUploadName.title = file.name;
      fileUploadName.innerText = truncateStr(file.name, 20);
      $preview.classList.remove("error");
      imageLoader.loadImage(URL.createObjectURL(file));
    };

    // File drop-area events
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      dropArea.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    ["dragenter", "dragover"].forEach((ev) => {
      dropArea.addEventListener(ev, () => {
        dropArea.classList.add("highlight");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      dropArea.addEventListener(ev, () => {
        dropArea.classList.remove("highlight");
      });
    });
    dropArea.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      handleFiles(file);
    });
    fileUpload.addEventListener("change", () => {
      if (!fileUpload.files[0]) return;
      handleFiles(fileUpload.files[0]);
    });

    // URL upload handler
    $("#uploadUrlBtn").addEventListener("click", () => {
      const url = $("#uploadUrl").value;
      if (url === "") return;
      $("#uploadError").innerText = "";
      $preview.classList.remove("error");
      imageLoader.loadImage(url);
    });

    /// Playback controls
    // Play/pause button
    const $playButton = $("#play");
    const playPauseButton = (stop = false) => {
      if (stop || !$playButton.classList.contains("paused")) {
        animation.stop();
        $playButton.classList.add("paused");
      } else {
        animation.play();
        $playButton.classList.remove("paused");
      }
    };

    $playButton.addEventListener("click", () => playPauseButton());

    // Prev/next buttons
    $$("#prev, #next").forEach((el) => {
      el.addEventListener("click", (e) => {
        playPauseButton(true);
        animation.seek(e.target.id === "prev" ? -1 : 1);
      });
    });

    /// Customizations
    ["input", "change"].forEach((event) => {
      // Change squishiness
      $("#squish").addEventListener(
        event,
        (e) => {
          const newSquish = (clamp(parseInt(e.target.value), 100, 300) / 100).toFixed(3);
          if (g.squish !== newSquish) {
            g.squish = newSquish;
            animation.tick();
          }
        },
        { passive: true, capture: true }
      );

      // Change size
      $("#scale").addEventListener(
        event,
        (e) => {
          const newScale = (clamp(parseInt(e.target.value), 20, 200) / 100).toFixed(3);
          if (g.scale !== newScale) {
            g.scale = newScale;
            animation.tick();
          }
        },
        { passive: true, capture: true }
      );
    });

    // Change speed
    $$("#fps, #fpsVal").forEach((el) =>
      el.addEventListener("change", (e) => {
        // Round fps to nearest 10. This makes it *closer* to the actual gif output but not really
        // const newDelay = ~~(~~(1000 / clamp(parseInt(e.target.value), 2, 50) / 10) * 10);
        const newDelay = ~~(1000 / clamp(parseInt(e.target.value), 2, 60));

        // Restart animation loop with new delay, if it changed
        if (newDelay !== g.delay) {
          g.delay = newDelay;
          if (loop) {
            loop = clearRequestInterval(loop);
            animation.play();
          }
        }
      })
    );

    // update input to match slider and vice versa
    $("#fps").addEventListener("input", (e) => {
      $("#fpsVal").value = e.target.value;
    });
    $("#fpsVal").addEventListener("input", (e) => {
      $("#fps").value = e.target.value;
    });

    // flip sprite
    $("#toggleFlip").addEventListener("change", (e) => {
      g.flip = e.target.checked;
      animation.tick();
    });

    /// Adjust mode
    $("#toggleAdjust").addEventListener("click", (e) => {
      $canvas.classList.toggle("adjust-mode", e.target.checked);
      if (e.target.checked) {
        playPauseButton(true);
      }
      animation.toggleAdjust();
    });

    /// Gif export
    let btnTxt = "";
    let gifTime = 0;
    const $renderResult = $("#result");
    const $renderInfo = $("#info");
    const $exportBtn = $("#export");
    const renderer = GifRenderer(
      animation,
      /** Gif renderer start */
      (startTime) => {
        gifTime = startTime;
        URL.revokeObjectURL($renderResult.src);
        $exportBtn.disabled = true;
        btnTxt = $exportBtn.innerText;
      },
      /** Gif renderer progress */
      (progress) => {
        const p = `${Math.round(progress * 100)}%`;
        $exportBtn.innerText = p;
        $renderInfo.innerText = p;
      },
      /** Gif renderer finish */
      (blob, endTime) => {
        const timeTaken = ((endTime - gifTime) / 1000).toFixed(2);
        const fileSize = (blob.size / 1000).toFixed(2);
        $renderInfo.innerText = `100%, ${timeTaken}secs, ${fileSize}kb`;
        $exportBtn.innerText = btnTxt;
        $exportBtn.disabled = false;
        $renderResult.src = URL.createObjectURL(blob);
      }
    );

    $exportBtn.addEventListener("click", () => renderer.render());

    // Load sprites
    $hand.src = "";
    imageLoader.loadImage("data:image/png;base64,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");

    // Play animation once everything loads
    window.addEventListener("load", () => animation.play());

    // Exposing these to the console so you can mess around with the global variables and break
    // stuff you want :)
    window.petpet = {
      // You can change the sprite of the hand using the console. Download a copy of the sprite
      // sheet (./img/sprite.png) and edit it, just make sure you dont change the size or positions
      // of the hands or it will mess up. Then you can just upload the new sprite sheet somewhere
      // (imgur works) and in the console do `petpet.$hand.src = "<url>"`
      $hand,
      reset,
      renderer,
      DEFAULTS,
      animation,
      imageLoader,
    };
  });
})();
