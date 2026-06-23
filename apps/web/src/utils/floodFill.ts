function hexToRgba(hex: string) {
  let r = 0,
    g = 0,
    b = 0;
  const a = 255;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return [r, g, b, a];
}

export function applyFloodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imageData.data;

  const x = Math.floor(startX);
  const y = Math.floor(startY);
  const startIndex = (y * canvasWidth + x) * 4;

  const startR = data[startIndex];
  const startG = data[startIndex + 1];
  const startB = data[startIndex + 2];
  const startA = data[startIndex + 3];
  const [fillR, fillG, fillB, fillA] = hexToRgba(fillColorHex);

  if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

  const matchStartColor = (index: number) => {
    return (
      data[index] === startR &&
      data[index + 1] === startG &&
      data[index + 2] === startB &&
      data[index + 3] === startA
    );
  };

  const colorPixel = (index: number) => {
    data[index] = fillR;
    data[index + 1] = fillG;
    data[index + 2] = fillB;
    data[index + 3] = fillA;
  };

  const pixelStack = [[x, y]];

  while (pixelStack.length > 0) {
    const newPos = pixelStack.pop()!;
    const px = newPos[0];
    let py = newPos[1];
    let pixelPos = (py * canvasWidth + px) * 4;

    while (py >= 0 && matchStartColor(pixelPos)) {
      py--;
      pixelPos -= canvasWidth * 4;
    }
    pixelPos += canvasWidth * 4;
    py++;
    let reachLeft = false;
    let reachRight = false;

    while (py < canvasHeight && matchStartColor(pixelPos)) {
      colorPixel(pixelPos);

      if (px > 0) {
        if (matchStartColor(pixelPos - 4)) {
          if (!reachLeft) {
            pixelStack.push([px - 1, py]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }
      if (px < canvasWidth - 1) {
        if (matchStartColor(pixelPos + 4)) {
          if (!reachRight) {
            pixelStack.push([px + 1, py]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      py++;
      pixelPos += canvasWidth * 4;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
